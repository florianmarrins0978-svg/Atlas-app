import { and, asc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { withEntreprise } from "../db/with-entreprise";
import { allureDesDocuments, formatNumeroDe } from "./entreprises";
import { ecrireNumero, repartChaqueAnnee } from "@/lib/numero-documents";
import type { DbOrTx } from "../db/client";
import {
  chantiers,
  clients,
  devis,
  entreprises,
  factures,
  lignesDevis,
  lignesFacture,
} from "../db/schema";
import type { Ctx } from "./context";
import { lireDevisQuiFaitFoi } from "./devis";
import { genererPdfFacture, type FacturePdfData } from "../pdf/facture-pdf";
import { enregistrerObjet } from "../storage";
import { jourIso } from "../../lib/jour";
import { echeanceFacture } from "../../lib/rappels";
import { validerEcheance } from "../../lib/echeance-facture";
import { repriseDuDevis } from "../../lib/facture-face-au-devis";
import { totauxAvecReduction } from "../../lib/reduction-devis";
import { ongletDepuisJalons } from "../../lib/onglet-chantier";
import {
  dansLaPeriode,
  enAttenteDeReglement,
  entreesDuReleve,
  type Exigibilite,
} from "../../lib/exigibilite-tva";
import { exigibiliteDe, facturesAvecPaiements } from "./paiements-facture";

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
//
// **LE MILLÉSIME N'EST PLUS ÉCRIT EN DUR — correctif du 26 août 2026**, et la
// remise à 1 du 1ᵉʳ janvier se joue DANS l'UPDATE : voir le commentaire jumeau
// de `attribuerNumeroDevis`, qui porte le pourquoi en entier.
//
// **Les deux suites restent distinctes**, et c'est la règle du dessus : mêler
// devis et factures rendrait illisible la numérotation continue qu'attend un
// contrôle. D'où deux colonnes de compteur ET deux colonnes d'année — un devis
// peut partir en décembre et sa facture en janvier.
export async function attribuerNumeroFacture(tx: DbOrTx, entrepriseId: string): Promise<string> {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = maintenant.getMonth() + 1;

  const format = await formatNumeroDe(tx, entrepriseId);
  const remise = repartChaqueAnnee(format);

  const result: unknown = await tx.execute(sql`
    UPDATE entreprise_compteurs
    SET prochain_numero_facture = CASE
          WHEN ${remise} AND annee_facture IS DISTINCT FROM ${annee} THEN 2
          ELSE prochain_numero_facture + 1
        END,
        annee_facture = ${annee}
    WHERE entreprise_id = ${entrepriseId}
    RETURNING prochain_numero_facture - 1 AS numero
  `);
  const numero = (result as { rows: { numero: number }[] }).rows[0].numero;
  return ecrireNumero(format, "facture", { annee, mois, numero });
}

/**
 * CE QU'UNE FACTURE RECOPIE DE SON DEVIS — écrit une fois, appelé deux fois.
 *
 * Le tout premier instantané est celui du devis, pas celui de la base
 * aujourd'hui : la facture doit porter les coordonnées auxquelles le client a
 * répondu, et les montants qu'il a vus.
 *
 * **Pourquoi une fonction plutôt que deux listes de champs.** La création
 * (`terminerChantier`) et la reprise (`reprendreLeDevisSurLaFacture`) recopient
 * exactement les mêmes colonnes. Deux listes tenues à la main auraient divergé
 * au premier champ ajouté — et le champ oublié, ce serait un prix, une adresse
 * ou un prix accordé absent de la facture (`CLAUDE.md` §3).
 *
 * **Ce qui n'en fait PAS partie, et pourquoi :** le numéro commercial (consommé,
 * il ne se rejoue pas), la date d'émission et l'échéance (celles de la facture,
 * pas du devis), et le régime de TVA (lu sur l'entreprise — un devis n'imprime
 * pas la mention de l'article 293 B).
 */
function instantaneDuDevis(d: typeof devis.$inferSelect) {
  return {
    devisId: d.id,
    entrepriseNom: d.entrepriseNom,
    entrepriseAdresse: d.entrepriseAdresse,
    entrepriseSiret: d.entrepriseSiret,
    entrepriseEmail: d.entrepriseEmail,
    entrepriseTelephone: d.entrepriseTelephone,
    entrepriseIban: d.entrepriseIban,
    // Les trois mentions légales, et leur emplacement (migration 0072).
    entrepriseFormeJuridique: d.entrepriseFormeJuridique,
    entrepriseCapitalSocial: d.entrepriseCapitalSocial,
    entrepriseVilleRcs: d.entrepriseVilleRcs,
    entrepriseMentionsLegalesPosition: d.entrepriseMentionsLegalesPosition,
    clientNom: d.clientNom,
    clientCivilite: d.clientCivilite,
    clientAdresse: d.clientAdresse,
    clientTelephone: d.clientTelephone,
    clientEmail: d.clientEmail,
    adresseChantier: d.adresseChantier,
    conditionsPaiement: d.conditionsPaiement,
    devise: d.devise,
    tauxTva: d.tauxTva,
    totalHt: d.totalHt,
    totalTva: d.totalTva,
    totalTtc: d.totalTtc,
    // **Le prix accordé suit le devis jusqu'ici, et c'est la moitié de la
    // fonctionnalité.** Une remise consentie sur le devis puis absente de la
    // facture ferait payer au client le prix qu'on venait de lui retirer — et
    // c'est lui qui s'en apercevrait.
    reductionPourcent: d.reductionPourcent,
    reductionMontant: d.reductionMontant,
  };
}

/** Les lignes de la facture, recopiées de celles du devis. */
function lignesRecopiees(
  entrepriseId: string,
  factureId: string,
  lignes: (typeof lignesDevis.$inferSelect)[]
) {
  return lignes.map((l) => ({
    entrepriseId,
    factureId,
    libelle: l.libelle,
    quantite: l.quantite,
    prixUnitaire: l.prixUnitaire,
    montant: l.montant,
    // **Sans ce report, une facture née d'un devis à deux TVA se réglait sur un
    // seul taux** — et l'écart partait dans une déclaration trimestrielle, là
    // où il coûte à l'artisan (migration 0073).
    tauxTva: l.tauxTva,
    ordre: l.ordre,
  }));
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

    // **La dernière version ENVOYÉE, et non la dernière version.** Facturer sur
    // un brouillon reviendrait à facturer un prix que le client n'a jamais vu ;
    // mais prendre la dernière *quelle qu'elle soit* faisait refuser un chantier
    // dont la v1 était bel et bien partie, au motif — faux — qu'aucun devis
    // n'avait été envoyé. Voir `lireDevisQuiFaitFoi`.
    const [devisSource] = await lireDevisQuiFaitFoi(tx, chantierId);
    if (!devisSource) {
      // **Les deux refus n'appellent pas le même geste**, et le patron doit
      // savoir lequel : écrire le devis, ou l'envoyer.
      const [unDevisQuelconque] = await tx
        .select({ id: devis.id })
        .from(devis)
        .where(eq(devis.chantierId, chantierId))
        .limit(1);
      throw new FinChantierImpossibleError(unDevisQuelconque ? "devis_non_envoye" : "devis_absent");
    }

    const lignes = await tx
      .select()
      .from(lignesDevis)
      .where(eq(lignesDevis.devisId, devisSource.id))
      .orderBy(asc(lignesDevis.ordre));

    // Le régime de TVA se lit MAINTENANT, pour être figé dans la facture — une
    // pièce comptable garde ce qu'elle portait le jour de son émission
    // (migration 0039). Le délai de paiement se lit du même coup : c'est lui qui
    // PROPOSE l'échéance par défaut, plutôt qu'un « 30 » écrit en dur qui
    // contredisait la mention « Paiement à X jours » qu'il avait réglée.
    const [entrepriseCourante] = await tx
      .select({ regimeTva: entreprises.regimeTva, delaiPaiementJours: entreprises.delaiPaiementJours })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);

    const numeroCommercial = await attribuerNumeroFacture(tx, ctx.entrepriseId);
    // Son délai réglé quand il en a posé un (0 = comptant), 30 jours à défaut.
    const echeance = echeanceFacture(
      maintenant,
      entrepriseCourante?.delaiPaiementJours ?? DELAI_PAIEMENT_JOURS
    );

    const [facture] = await tx
      .insert(factures)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId,
        numeroCommercial,
        ...instantaneDuDevis(devisSource),
        // Le régime au jour de l'émission, figé comme le reste de l'identité
        // (migration 0039). Lu sur l'entreprise et non sur le devis : un devis
        // n'imprime pas la mention de l'article 293 B, il n'avait donc aucune
        // raison de la porter.
        entrepriseRegimeTva: entrepriseCourante?.regimeTva ?? null,
        dateEmission: jourIso(maintenant),
        dateEcheance: jourIso(echeance),
        createdBy: ctx.utilisateurId,
      })
      .returning();

    if (lignes.length > 0) {
      await tx.insert(lignesFacture).values(lignesRecopiees(ctx.entrepriseId, facture.id, lignes));
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
    // **De QUEL devis ces lignes viennent, et l'écran doit le dire.** Le PDF
    // l'écrit depuis toujours — « Établie à partir du devis n° … » —, l'écran du
    // patron non : il montrait « Reprise du devis » sans jamais nommer lequel.
    // C'est précisément l'information qui manquait pour voir qu'une v2 envoyée
    // depuis n'avait pas atteint la facture.
    const [devisRepris] = await tx
      .select({ numero: devis.numeroCommercial, version: devis.numeroVersion })
      .from(devis)
      .where(eq(devis.id, facture.devisId))
      .limit(1);
    return {
      facture,
      lignes,
      numeroDevis: devisRepris?.numero ?? null,
      versionDevis: devisRepris?.version ?? null,
    };
  });
}

/**
 * REPREND LE DEVIS QUI FAIT FOI SUR UNE FACTURE ENCORE EN BROUILLON.
 *
 * **Le défaut qu'elle referme, et c'était de l'argent perdu.** `terminerChantier`
 * est idempotente : rappuyer sur « Créer la facture » redonne la facture déjà
 * bâtie plutôt que d'en créer une seconde — c'est juste, un double appui est le
 * geste le plus banal sur un téléphone. Mais cela voulait dire aussi qu'un devis
 * corrigé et renvoyé APRÈS la fin de chantier n'atteignait **jamais** la
 * facture : elle gardait les lignes et les montants d'avant, et le second arrêt
 * du parcours se franchissait sur l'ancien prix, sans qu'un seul écran le dise.
 *
 * **Elle ne s'appelle JAMAIS toute seule**, et c'est le point. Réécrire ses
 * montants dans son dos les ferait changer entre le moment où il ouvre l'écran
 * et celui où il appuie — sur le seul écran qui engage son argent. La règle
 * (`src/lib/facture-face-au-devis.ts`) dit, l'écran montre, il reprend
 * (`CLAUDE.md` §4 : rien n'est validé sans un geste du patron).
 *
 * **Le refus se rend en valeur, jamais en exception** (`AGENTS.md`) : le message
 * d'une exception d'action serveur n'arrive pas jusqu'à lui.
 *
 * **Le numéro, la date et l'échéance ne bougent pas.** Un numéro de facture est
 * consommé, et sa date est celle de la facture — pas celle du devis.
 */
export async function reprendreLeDevisSurLaFacture(
  ctx: Ctx,
  factureId: string
): Promise<{ ok: true; numeroDevis: string } | { ok: false; raison: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    // `withEntreprise` borne déjà à son entreprise : une facture d'à côté n'est
    // pas « refusée », elle n'existe tout simplement pas pour cette requête.
    if (!f) return { ok: false, raison: "Cette facture est introuvable." };
    if (f.statut !== "brouillon") {
      return { ok: false, raison: "La facture est déjà arrêtée : elle ne se réécrit plus." };
    }

    const [d] = await lireDevisQuiFaitFoi(tx, f.chantierId);
    if (!d) return { ok: false, raison: "Ce chantier n'a aucun devis envoyé à reprendre." };

    const etat = repriseDuDevis(
      { devisId: f.devisId, statut: "brouillon" },
      { id: d.id, numeroCommercial: d.numeroCommercial, numeroVersion: d.numeroVersion }
    );
    if (etat.aJour) return { ok: false, raison: "Cette facture reprend déjà le dernier devis envoyé." };

    const lignes = await tx
      .select()
      .from(lignesDevis)
      .where(eq(lignesDevis.devisId, d.id))
      .orderBy(asc(lignesDevis.ordre));

    // Les anciennes lignes partent d'abord : les garder ferait une facture qui
    // additionne deux versions du même chantier.
    await tx.delete(lignesFacture).where(eq(lignesFacture.factureId, f.id));
    if (lignes.length > 0) {
      await tx.insert(lignesFacture).values(lignesRecopiees(ctx.entrepriseId, f.id, lignes));
    }
    await tx.update(factures).set(instantaneDuDevis(d)).where(eq(factures.id, f.id));

    return { ok: true, numeroDevis: d.numeroCommercial };
  });
}

/**
 * Corrige l'échéance d'une facture ENCORE EN BROUILLON — sa demande du 25 août.
 *
 * **Le refus se rend en valeur, jamais en exception** (`AGENTS.md`) : le message
 * d'une exception d'action serveur n'arrive pas jusqu'au patron.
 *
 * **Une facture ARRÊTÉE ne bouge plus.** Une fois émise, elle est partie chez le
 * client et inscrite au relevé : changer sa date la ferait mentir. On refuse, et
 * l'écran ne montre le champ que tant qu'elle est brouillon — la vérification
 * ici est le vrai garde-fou, l'écran n'est qu'une politesse.
 *
 * **Elle rend la date RELUE en base**, jamais la saisie : une valeur hors bornes
 * est retombée, et l'écran doit afficher ce qui s'imprimera.
 */
export async function majEcheanceFacture(
  ctx: Ctx,
  factureId: string,
  dateEcheanceIso: string
): Promise<{ ok: true; dateEcheance: string } | { ok: false; raison: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx
      .select({ dateEmission: factures.dateEmission, statut: factures.statut })
      .from(factures)
      .where(eq(factures.id, factureId))
      .limit(1);
    // `withEntreprise` borne déjà à son entreprise : une facture d'à côté n'est
    // pas « refusée », elle n'existe tout simplement pas pour cette requête.
    if (!f) return { ok: false, raison: "Cette facture est introuvable." };
    if (f.statut !== "brouillon") {
      return { ok: false, raison: "La facture est déjà arrêtée : son échéance ne change plus." };
    }
    const v = validerEcheance(f.dateEmission, dateEcheanceIso);
    if (!v.ok) return v;
    await tx.update(factures).set({ dateEcheance: v.iso }).where(eq(factures.id, factureId));
    return { ok: true, dateEcheance: v.iso };
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
    regimeTva: f.entrepriseRegimeTva,
    entrepriseAdresse: f.entrepriseAdresse,
    entrepriseSiret: f.entrepriseSiret,
    entrepriseTelephone: f.entrepriseTelephone,
    entrepriseEmail: f.entrepriseEmail,
    entrepriseIban: f.entrepriseIban,
    entrepriseFormeJuridique: f.entrepriseFormeJuridique,
    entrepriseCapitalSocial: f.entrepriseCapitalSocial,
    entrepriseVilleRcs: f.entrepriseVilleRcs,
    entrepriseMentionsLegalesPosition: f.entrepriseMentionsLegalesPosition,
    clientNom: f.clientNom,
    clientCivilite: f.clientCivilite,
    clientAdresse: f.clientAdresse,
    clientTelephone: f.clientTelephone,
    adresseChantier: f.adresseChantier,
    conditionsPaiement: f.conditionsPaiement,
    devise: f.devise,
    tauxTva: f.tauxTva,
    totalHt: f.totalHt,
    totalTva: f.totalTva,
    totalTtc: f.totalTtc,
    reductionPourcent: f.reductionPourcent,
    reductionMontant: f.reductionMontant,
    lignes: lignes
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map((l) => ({
        libelle: l.libelle,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        montant: l.montant,
        // Le taux de sa catégorie voyage jusqu'au papier : sans lui, la facture
        // ventilerait tout sur le taux du document (migration 0073).
        tauxTva: l.tauxTva,
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
    const habillage = await allureDesDocuments(tx, ctx.entrepriseId);
    return genererPdfFacture(donneesFacture(f, lignes, d?.numero ?? null), habillage);
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

    // **La même règle que le devis, appelée et non réécrite.** Le patron a
    // choisi l'arrangement B : la réduction n'est pas une ligne, donc ce
    // recalcul-ci l'oublierait s'il additionnait seulement les lignes — et la
    // facture émise, immuable, partirait au prix plein.
    const t = totauxAvecReduction(lignes, avant.tauxTva, avant.reductionPourcent);
    const totalHt = new Decimal(t.totalHt);
    const totalTva = new Decimal(t.totalTva);
    const totalTtc = new Decimal(t.totalTtc);

    // La pièce est figée au moment de l'émission, jamais régénérée ensuite :
    // une facture émise est immuable (trigger PostgreSQL), et un PDF reconstruit
    // depuis les données du jour ne serait plus celui que le client a reçu.
    const [d] = await tx
      .select({ numero: devis.numeroCommercial })
      .from(devis)
      .where(eq(devis.id, avant.devisId))
      .limit(1);

    const habillage2 = await allureDesDocuments(tx, ctx.entrepriseId);
    const pdfBytes = await genererPdfFacture(
      donneesFacture(
        {
          ...avant,
          statut: "emise",
          totalHt: totalHt.toFixed(2),
          totalTva: totalTva.toFixed(2),
          totalTtc: totalTtc.toFixed(2),
          // **Le montant retiré se recalcule avec les totaux, jamais séparément.**
          // Les lignes peuvent avoir bougé depuis la création de la facture ; un
          // montant resté sur l'ancien HT donnerait un « Total HT après remise »
          // qui ne serait la différence de rien.
          reductionMontant: t.reductionMontant,
        },
        lignes,
        d?.numero ?? null
      )
    , habillage2);

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
        reductionMontant: t.reductionMontant,
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
  clientCivilite: "mr" | "mme" | null;
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
        clientCivilite: clients.civilite,
        datePlanifiee: chantiers.datePlanifiee,
        termineAt: chantiers.termineAt,
        factureEnvoyeeAt: chantiers.factureEnvoyeeAt,
        factureId: factures.id,
        factureStatut: factures.statut,
        factureNumero: factures.numeroCommercial,
        // **La date de la FACTURE, pas celle du chantier.** L'écran refait le
        // 22 août 2026 écrit « Facturé le 20 août » : le dire d'après
        // `datePlanifiee` affirmerait une date d'émission qu'on n'a pas — le
        // chantier a pu être fait le 20 et facturé le 30. Un écran qui invente
        // une date de facture est pire qu'un écran muet.
        factureDateEmission: factures.dateEmission,
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
  /**
   * **La date qui compte pour la période**, et non plus forcément l'émission.
   *
   * Aux encaissements, c'est celle du règlement : c'est lui qui rend la TVA
   * exigible (migration 0045). Le nom reste `dateEmission` parce qu'une
   * douzaine d'écrans et de suites le lisent ; `motif` dit laquelle des deux
   * c'est, pour que l'écran ne mente pas au patron.
   */
  dateEmission: string;
  clientNom: string | null;
  totalHt: string;
  tauxTva: string;
  totalTva: string;
  totalTtc: string;
  /** `paiement` : la ligne est un encaissement. `emission` : le régime des débits. */
  motif?: "emission" | "paiement";
};

export type ReleveTva = {
  debut: string;
  fin: string;
  lignes: LigneReleveTva[];
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  /** Sous quel régime ce relevé a été calculé — l'écran doit pouvoir le dire. */
  regime: Exigibilite;
  /** Ce qui n'y est pas encore, et qui attend son paiement. Zéro aux débits. */
  enAttente: { nombre: number; ttc: string; tva: string };
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
  // **Le régime décide de la DATE qui compte** (migration 0045). Aux
  // encaissements — le défaut légal d'une prestation de services —, une facture
  // n'entre au relevé qu'à hauteur de ce qui a été reçu, à la date où il l'a
  // été. Aux débits, elle y entre entière le jour de son émission.
  const [regime, avecPaiements] = await Promise.all([exigibiliteDe(ctx), facturesAvecPaiements(ctx)]);
  return assemblerReleve(avecPaiements, debut, fin, regime);
}

/**
 * Le relevé sous les DEUX régimes, en une seule lecture des factures.
 *
 * **Sa question du 26 août 2026 :** *« lorsque je change entre les deux, rien
 * ne se passe, c'est normal ? »* — et c'était normal : quand toutes les
 * factures d'un mois ont été payées dans le mois, les deux régimes tombent sur
 * le même chiffre. Ce qui manquait n'était pas un calcul, c'était une phrase
 * qui le DISE : un écran qui ne bouge pas sans rien dire se lit comme une
 * panne.
 *
 * **Une seule lecture, deux assemblages.** Appeler `releveTvaCollectee` deux
 * fois relirait toutes les factures et tous les règlements pour rien. Et
 * recalculer le second total à la main dans l'écran serait une seconde
 * implémentation de la même règle — ce que `CLAUDE.md` §3 interdit, parce que
 * les deux finissent toujours par diverger.
 */
export async function relevesSousLesDeuxRegimes(
  ctx: Ctx,
  debut: string,
  fin: string
): Promise<{ retenu: ReleveTva; autre: ReleveTva }> {
  const [regime, avecPaiements] = await Promise.all([exigibiliteDe(ctx), facturesAvecPaiements(ctx)]);
  const oppose: Exigibilite = regime === "encaissements" ? "debits" : "encaissements";
  return {
    retenu: assemblerReleve(avecPaiements, debut, fin, regime),
    autre: assemblerReleve(avecPaiements, debut, fin, oppose),
  };
}

/** Ce que les factures déjà lues donnent, sous un régime donné. */
function assemblerReleve(
  avecPaiements: Awaited<ReturnType<typeof facturesAvecPaiements>>,
  debut: string,
  fin: string,
  regime: Exigibilite
): ReleveTva {
  const lignes: LigneReleveTva[] = [];
  for (const f of avecPaiements) {
    const entrees = entreesDuReleve(f, f.paiements, regime);
    for (const e of entrees) {
      if (!dansLaPeriode(e, debut, fin)) continue;
      lignes.push({
        numeroCommercial: f.numeroCommercial,
        dateEmission: e.date,
        clientNom: f.clientNom,
        totalHt: e.ht,
        // Le taux figé sur la facture : un acompte ne change pas le taux, il
        // n'en encaisse qu'une part.
        tauxTva: tauxDeLaFacture(f),
        totalTva: e.tva,
        totalTtc: e.ttc,
        motif: e.motif,
      });
    }
  }

  // L'ordre du relevé : la date qui compte, puis le numéro. C'est l'ordre du
  // formulaire, et celui où il recopie.
  lignes.sort((a, b) =>
    a.dateEmission === b.dateEmission
      ? a.numeroCommercial.localeCompare(b.numeroCommercial)
      : a.dateEmission < b.dateEmission
        ? -1
        : 1
  );

  const somme = (champ: "totalHt" | "totalTva" | "totalTtc") =>
    lignes.reduce((acc, l) => acc.plus(new Decimal(l[champ])), new Decimal(0)).toFixed(2);

  return {
    debut,
    fin,
    lignes,
    totalHt: somme("totalHt"),
    totalTva: somme("totalTva"),
    totalTtc: somme("totalTtc"),
    regime,
    enAttente: enAttenteDeReglement(
      avecPaiements.map((f) => ({ facture: f, paiements: f.paiements })),
      regime
    ),
  };
}

/**
 * Le taux d'une facture, tel qu'il a été figé.
 *
 * Recalculé depuis les totaux quand la colonne manque — une facture ancienne
 * peut l'avoir laissée vide, et le relevé doit rester lisible.
 */
function tauxDeLaFacture(f: { totalHt: string; totalTva: string }): string {
  const ht = new Decimal(f.totalHt || "0");
  if (ht.lessThanOrEqualTo(0)) return "0.00";
  return new Decimal(f.totalTva || "0").dividedBy(ht).times(100).toDecimalPlaces(2).toFixed(2);
}
