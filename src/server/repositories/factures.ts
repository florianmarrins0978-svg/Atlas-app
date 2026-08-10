import { and, asc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import {
  chantiers,
  clients,
  devis,
  factures,
  lignesDevis,
  lignesFacture,
} from "../db/schema";
import type { Ctx } from "./context";
import { genererPdfFacture, type FacturePdfData } from "../pdf/facture-pdf";
import { enregistrerObjet } from "../storage";
import { jourIso } from "../../lib/jour";
import { ongletDepuisJalons } from "../../lib/onglet-chantier";

// Fin de chantier, facture et TVA — docs/AGENT.md §2.3.
//
// La facture naît du devis : mêmes lignes, mêmes montants. C'est ce qui permet
// à l'écran de confirmation d'être franchissable en un geste quand rien n'a
// bougé — il n'y a rien à ressaisir, seulement à vérifier.
//
// Rappel de §6 : Atlas PRÉPARE la facture, il ne l'émet pas au sens légal.

/** Délai de paiement porté sur la facture, à défaut d'accord particulier. */
const DELAI_PAIEMENT_JOURS = 30;

// Numérotation atomique, calquée sur celle des devis : le verrou de ligne posé
// par cet UPDATE sérialise les créations concurrentes d'une même entreprise.
// `prochain_numero_facture` est le PROCHAIN numéro libre, pas le dernier pris.
export async function attribuerNumeroFacture(tx: DbOrTx, entrepriseId: string): Promise<string> {
  const result: unknown = await tx.execute(sql`
    UPDATE entreprise_compteurs
    SET prochain_numero_facture = prochain_numero_facture + 1
    WHERE entreprise_id = ${entrepriseId}
    RETURNING prochain_numero_facture - 1 AS numero
  `);
  const numero = (result as { rows: { numero: number }[] }).rows[0].numero;
  return `F2026-${String(numero).padStart(4, "0")}`;
}

export class FinChantierImpossibleError extends Error {
  constructor(readonly motif: "devis_absent" | "devis_non_envoye" | "deja_facture") {
    super(motif);
    this.name = "FinChantierImpossibleError";
  }
}

/**
 * Déclare le chantier terminé et bâtit sa facture, en brouillon.
 *
 * Rien ne part ici : c'est précisément l'objet de l'arrêt 3 (docs/AGENT.md
 * §2.3). Le patron voit la facture avant qu'elle n'existe pour son client.
 *
 * Idempotente : rappuyer sur « Fin de chantier » redonne la facture déjà bâtie
 * plutôt que d'en créer une seconde. Un double appui est le geste le plus banal
 * qui soit sur un téléphone, et deux factures pour un chantier doubleraient la
 * TVA collectée.
 */
export async function terminerChantier(ctx: Ctx, chantierId: string, maintenant: Date = new Date()) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [existante] = await tx
      .select()
      .from(factures)
      .where(eq(factures.chantierId, chantierId))
      .limit(1);
    if (existante) {
      if (existante.statut === "emise") throw new FinChantierImpossibleError("deja_facture");
      return existante;
    }

    const [chantier] = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.id, chantierId), eq(chantiers.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!chantier) throw new FinChantierImpossibleError("devis_absent");

    const [devisSource] = await tx
      .select()
      .from(devis)
      .where(eq(devis.chantierId, chantierId))
      .orderBy(sql`${devis.numeroVersion} DESC`)
      .limit(1);
    if (!devisSource) throw new FinChantierImpossibleError("devis_absent");
    // Facturer sur un brouillon reviendrait à facturer un prix que le client
    // n'a jamais vu.
    if (devisSource.statut !== "envoye") throw new FinChantierImpossibleError("devis_non_envoye");

    const lignes = await tx
      .select()
      .from(lignesDevis)
      .where(eq(lignesDevis.devisId, devisSource.id))
      .orderBy(asc(lignesDevis.ordre));

    const numeroCommercial = await attribuerNumeroFacture(tx, ctx.entrepriseId);
    const echeance = new Date(maintenant.getTime() + DELAI_PAIEMENT_JOURS * 86_400_000);

    const [facture] = await tx
      .insert(factures)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId,
        devisId: devisSource.id,
        numeroCommercial,
        // Le tout premier instantané est celui du devis, pas celui de la base
        // aujourd'hui : la facture doit porter les coordonnées auxquelles le
        // client a répondu.
        entrepriseNom: devisSource.entrepriseNom,
        entrepriseAdresse: devisSource.entrepriseAdresse,
        entrepriseSiret: devisSource.entrepriseSiret,
        entrepriseEmail: devisSource.entrepriseEmail,
        entrepriseTelephone: devisSource.entrepriseTelephone,
        entrepriseIban: devisSource.entrepriseIban,
        clientNom: devisSource.clientNom,
        clientAdresse: devisSource.clientAdresse,
        clientTelephone: devisSource.clientTelephone,
        clientEmail: devisSource.clientEmail,
        adresseChantier: devisSource.adresseChantier,
        dateEmission: jourIso(maintenant),
        dateEcheance: jourIso(echeance),
        conditionsPaiement: devisSource.conditionsPaiement,
        devise: devisSource.devise,
        tauxTva: devisSource.tauxTva,
        totalHt: devisSource.totalHt,
        totalTva: devisSource.totalTva,
        totalTtc: devisSource.totalTtc,
        createdBy: ctx.utilisateurId,
      })
      .returning();

    if (lignes.length > 0) {
      await tx.insert(lignesFacture).values(
        lignes.map((l) => ({
          entrepriseId: ctx.entrepriseId,
          factureId: facture.id,
          libelle: l.libelle,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          montant: l.montant,
          ordre: l.ordre,
        }))
      );
    }

    await tx
      .update(chantiers)
      .set({
        termineAt: sql`COALESCE(termine_at, now())`,
        updatedBy: ctx.utilisateurId,
        updatedAt: maintenant,
      })
      .where(eq(chantiers.id, chantierId));

    return facture;
  });
}

export async function getFacturePourChantier(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [facture] = await tx
      .select()
      .from(factures)
      .where(eq(factures.chantierId, chantierId))
      .limit(1);
    if (!facture) return null;
    const lignes = await tx
      .select()
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, facture.id))
      .orderBy(asc(lignesFacture.ordre));
    return { facture, lignes };
  });
}

export class FactureDejaEmiseError extends Error {
  constructor() {
    super("Cette facture a déjà été émise.");
    this.name = "FactureDejaEmiseError";
  }
}

/**
 * Fige la facture sur les montants confirmés — l'arrêt 3 franchi.
 *
 * Les montants sont recalculés depuis les lignes plutôt que repris tels quels :
 * le patron a pu corriger une ligne à l'écran de confirmation, et un total qui
 * ne correspondrait pas à son détail est le genre d'erreur qu'on ne rattrape
 * que par un avoir.
 */
/**
 * Rassemble ce que la facture imprime.
 *
 * Une seule construction pour l'aperçu et pour l'émission : deux finiraient par
 * ne plus décrire la même pièce, et l'écart n'apparaîtrait que chez le client.
 */
function donneesFacture(
  f: typeof factures.$inferSelect,
  lignes: (typeof lignesFacture.$inferSelect)[],
  numeroDevis: string | null
): FacturePdfData {
  return {
    numeroCommercial: f.numeroCommercial,
    statut: f.statut as "brouillon" | "emise",
    dateEmission: f.dateEmission,
    dateEcheance: f.dateEcheance,
    numeroDevis,
    entrepriseNom: f.entrepriseNom,
    entrepriseAdresse: f.entrepriseAdresse,
    entrepriseSiret: f.entrepriseSiret,
    entrepriseTelephone: f.entrepriseTelephone,
    entrepriseEmail: f.entrepriseEmail,
    entrepriseIban: f.entrepriseIban,
    clientNom: f.clientNom,
    clientAdresse: f.clientAdresse,
    clientTelephone: f.clientTelephone,
    adresseChantier: f.adresseChantier,
    conditionsPaiement: f.conditionsPaiement,
    devise: f.devise,
    tauxTva: f.tauxTva,
    totalHt: f.totalHt,
    totalTva: f.totalTva,
    totalTtc: f.totalTtc,
    lignes: lignes
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map((l) => ({
        libelle: l.libelle,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        montant: l.montant,
      })),
  };
}

/**
 * Le PDF d'une facture non encore émise, à la demande et jamais conservé.
 *
 * Comme pour le devis : seule la pièce réellement émise est archivée, et c'est
 * celle-là qui fait foi. Un brouillon régénéré à chaque ouverture ne peut pas
 * être pris pour la facture officielle.
 */
export async function genererPdfFacturePourApercu(ctx: Ctx, factureId: string): Promise<Uint8Array> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    if (!f) throw new Error("Facture introuvable");
    const lignes = await tx
      .select()
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, factureId));
    const [d] = await tx
      .select({ numero: devis.numeroCommercial })
      .from(devis)
      .where(eq(devis.id, f.devisId))
      .limit(1);
    return genererPdfFacture(donneesFacture(f, lignes, d?.numero ?? null));
  });
}

export async function emettreFacture(ctx: Ctx, factureId: string, maintenant: Date = new Date()) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [avant] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    if (!avant) throw new Error("Facture introuvable");
    if (avant.statut === "emise") throw new FactureDejaEmiseError();

    const lignes = await tx
      .select()
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, factureId));

    const totalHt = lignes.reduce((acc, l) => acc.plus(new Decimal(l.montant)), new Decimal(0));
    const totalTva = totalHt.times(new Decimal(avant.tauxTva)).dividedBy(100);
    const totalTtc = totalHt.plus(totalTva);

    // La pièce est figée au moment de l'émission, jamais régénérée ensuite :
    // une facture émise est immuable (trigger PostgreSQL), et un PDF reconstruit
    // depuis les données du jour ne serait plus celui que le client a reçu.
    const [d] = await tx
      .select({ numero: devis.numeroCommercial })
      .from(devis)
      .where(eq(devis.id, avant.devisId))
      .limit(1);

    const pdfBytes = await genererPdfFacture(
      donneesFacture(
        {
          ...avant,
          statut: "emise",
          totalHt: totalHt.toFixed(2),
          totalTva: totalTva.toFixed(2),
          totalTtc: totalTtc.toFixed(2),
        },
        lignes,
        d?.numero ?? null
      )
    );

    const objet = await enregistrerObjet(
      `chantiers/${avant.chantierId}/factures`,
      Buffer.from(pdfBytes),
      ".pdf"
    );

    const [facture] = await tx
      .update(factures)
      .set({
        statut: "emise",
        emiseLe: maintenant,
        totalHt: totalHt.toFixed(2),
        totalTva: totalTva.toFixed(2),
        totalTtc: totalTtc.toFixed(2),
        pdfStorageKey: objet.storageKey,
        pdfChecksum: objet.checksum,
      })
      .where(eq(factures.id, factureId))
      .returning();

    await tx
      .update(chantiers)
      .set({ factureEnvoyeeAt: sql`COALESCE(facture_envoyee_at, now())` })
      .where(eq(chantiers.id, facture.chantierId));

    return facture;
  });
}

// --- Onglet « Chantiers terminés » -----------------------------------------

export type ChantierTermine = {
  id: string;
  nom: string;
  clientNom: string | null;
  datePlanifiee: string | null;
  termineAt: Date | null;
  factureEnvoyeeAt: Date | null;
  factureId: string | null;
  factureStatut: "brouillon" | "emise" | null;
  factureNumero: string | null;
  totalTtc: string | null;
};

/**
 * Les chantiers rangés dans l'onglet « Terminés ».
 *
 * Deux populations dans une seule liste, et c'est voulu : ceux qui restent à
 * clôturer et ceux déjà facturés. Les séparer en deux écrans obligerait le
 * patron à savoir d'avance dans lequel chercher.
 *
 * **Le tri n'est pas fait ici : il vient de `ongletDepuisJalons`.** Cette
 * fonction recopiait la règle en SQL (`date_planifiee <= aujourd'hui`) là où
 * l'écran Chantiers l'appliquait en TypeScript avec un `<` strict. Un chantier
 * prévu AUJOURD'HUI tombait donc dans les deux onglets à la fois — le défaut
 * même que le patron avait signalé le 6 août 2026, revenu par la porte du
 * signe. Et un chantier clôturé AVANT sa date n'entrait dans aucun des trois :
 * sa facture en brouillon n'était plus joignable que par son adresse.
 *
 * Le SQL ne garde donc qu'un filtre de volume — un sur-ensemble sûr de ce que
 * la règle peut retenir. C'est la règle, et elle seule, qui tranche ensuite.
 */
export async function listerChantiersTermines(ctx: Ctx, aujourdHui: string = jourIso(new Date())) {
  const candidats = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        clientNom: clients.nom,
        datePlanifiee: chantiers.datePlanifiee,
        termineAt: chantiers.termineAt,
        factureEnvoyeeAt: chantiers.factureEnvoyeeAt,
        factureId: factures.id,
        factureStatut: factures.statut,
        factureNumero: factures.numeroCommercial,
        totalTtc: factures.totalTtc,
        // **Le montant PRÉVU au devis, pour ce qui n'est pas encore facturé.**
        // L'écran doit dire combien attend d'être facturé — c'est la seule
        // question qu'on lui pose. Il dira aussi d'où vient ce chiffre :
        // « Montants prévus aux devis », jamais « à encaisser ». Un devis n'est
        // pas une facture, et le montant peut encore bouger
        // (`docs/AGENT.md` §3).
        //
        // La dernière version envoyée fait foi : un devis corrigé puis renvoyé
        // porte plusieurs lignes, et retenir la première annoncerait un montant
        // que le client a refusé.
        devisNumero: sql<string | null>`(
          SELECT d."numero_commercial" FROM "devis" d
          WHERE d."chantier_id" = ${chantiers.id} AND d."statut" = 'envoye'
          ORDER BY d."numero_version" DESC LIMIT 1
        )`,
        devisTotalTtc: sql<string | null>`(
          SELECT d."total_ttc" FROM "devis" d
          WHERE d."chantier_id" = ${chantiers.id} AND d."statut" = 'envoye'
          ORDER BY d."numero_version" DESC LIMIT 1
        )`,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .leftJoin(factures, eq(factures.chantierId, chantiers.id))
      .where(
        and(
          isNull(chantiers.deletedAt),
          // Sur-ensemble : un chantier sans date ET jamais clos ne peut pas être
          // rangé dans les terminés, quoi que dise la règle. Élargir ici est
          // sans danger ; restreindre serait reprendre la règle en SQL.
          or(
            isNotNull(chantiers.datePlanifiee),
            isNotNull(chantiers.termineAt),
            isNotNull(chantiers.factureEnvoyeeAt)
          )
        )
      )
      // Le plus récemment réalisé en tête : c'est celui que le patron vient
      // clôturer en rentrant du chantier.
      .orderBy(sql`${chantiers.datePlanifiee} DESC NULLS FIRST`)
  );

  return candidats.filter((c) => ongletDepuisJalons(c, aujourdHui) === "termines");
}

// --- Relevé de TVA collectée ------------------------------------------------

export type LigneReleveTva = {
  numeroCommercial: string;
  dateEmission: string;
  clientNom: string | null;
  totalHt: string;
  tauxTva: string;
  totalTva: string;
  totalTtc: string;
};

export type ReleveTva = {
  debut: string;
  fin: string;
  lignes: LigneReleveTva[];
  totalHt: string;
  totalTva: string;
  totalTtc: string;
};

/**
 * Le relevé de TVA collectée d'une période.
 *
 * Calculé à partir des factures émises, jamais stocké : une table de TVA
 * tenue en parallèle finirait par diverger de ce qui a été facturé, et c'est
 * exactement l'écart qu'un contrôle cherche. La stabilité du relevé tient à
 * l'immuabilité d'une facture émise (trigger, 0018_factures.sql), pas à une
 * copie.
 */
export async function releveTvaCollectee(ctx: Ctx, debut: string, fin: string): Promise<ReleveTva> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({
        numeroCommercial: factures.numeroCommercial,
        dateEmission: factures.dateEmission,
        clientNom: factures.clientNom,
        totalHt: factures.totalHt,
        tauxTva: factures.tauxTva,
        totalTva: factures.totalTva,
        totalTtc: factures.totalTtc,
      })
      .from(factures)
      .where(
        and(
          eq(factures.statut, "emise"),
          sql`${factures.dateEmission} >= ${debut}`,
          sql`${factures.dateEmission} <= ${fin}`
        )
      )
      .orderBy(asc(factures.dateEmission), asc(factures.numeroCommercial));

    const somme = (champ: keyof LigneReleveTva) =>
      lignes
        .reduce((acc, l) => acc.plus(new Decimal(l[champ] as string)), new Decimal(0))
        .toFixed(2);

    return {
      debut,
      fin,
      lignes,
      totalHt: somme("totalHt"),
      totalTva: somme("totalTva"),
      totalTtc: somme("totalTtc"),
    };
  });
}
