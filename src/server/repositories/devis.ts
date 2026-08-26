import { and, asc, desc, eq, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { allureDesDocuments, formatNumeroDe } from "./entreprises";
import { conditionsDepuisEntreprise } from "@/lib/conditions-documents";
import { totauxAvecReduction, pourcentValide } from "@/lib/reduction-devis";
import type { DbOrTx } from "../db/client";
import { devis, lignesDevis, lignesPrix, chantiers, clients, entreprises } from "../db/schema";
import type { Ctx } from "./context";
import { genererPdfDevis } from "../pdf/devis-pdf";
import { enregistrerObjet } from "../storage";
import { ecrireNumero, repartChaqueAnnee } from "@/lib/numero-documents";

const TAUX_TVA_DEFAUT = "20.00";

// Numérotation atomique — le verrou de ligne posé par cet UPDATE sérialise les
// créations concurrentes pour une même entreprise (voir tests de concurrence).
// `prochain_numero_devis` représente le PROCHAIN numéro disponible, pas le dernier attribué.
//
// **LE MILLÉSIME N'EST PLUS ÉCRIT EN DUR — correctif du 26 août 2026.** Cette
// fonction rendait `` `2026-${…}` ``. En janvier 2027, ses devis auraient encore
// dit 2026 : un défaut à retardement, que le typage ne voit pas et qu'aucune
// suite n'attrape puisqu'elles tournent aujourd'hui.
//
// **LA REMISE À 1 SE FAIT DANS LE MÊME UPDATE, et c'est la seule façon sûre.**
// La lire d'abord pour l'écrire ensuite ouvrirait une fenêtre où deux devis
// créés à la même seconde le 1ᵉʳ janvier prendraient tous deux le numéro 1 —
// un doublon, exactement ce que la loi interdit. Le `CASE` tranche à l'intérieur
// du verrou de ligne.
export async function attribuerNumeroDevis(tx: DbOrTx, entrepriseId: string): Promise<string> {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = maintenant.getMonth() + 1;

  const format = await formatNumeroDe(tx, entrepriseId);
  // Sans année au numéro, le compteur ne repart jamais : le remettre à 1
  // ferait deux documents de même numéro à un an d'écart.
  const remise = repartChaqueAnnee(format);

  const result: unknown = await tx.execute(sql`
    UPDATE entreprise_compteurs
    SET prochain_numero_devis = CASE
          WHEN ${remise} AND annee_devis IS DISTINCT FROM ${annee} THEN 2
          ELSE prochain_numero_devis + 1
        END,
        annee_devis = ${annee}
    WHERE entreprise_id = ${entrepriseId}
    RETURNING prochain_numero_devis - 1 AS numero
  `);
  const numero = (result as { rows: { numero: number }[] }).rows[0].numero;
  return ecrireNumero(format, "devis", { annee, mois, numero });
}

/**
 * Les totaux du devis, réduction comprise.
 *
 * **Le calcul lui-même vit dans `src/lib/reduction-devis.ts`**, et pas ici :
 * l'écran, le PDF, la facture et son PDF en ont besoin du mot pour mot. Le
 * patron a choisi l'arrangement B le 16 août 2026 — la réduction n'est PAS une
 * ligne du tableau, donc elle ne voyage pas toute seule, et chaque endroit qui
 * recalculerait à la main serait un montant faux sur un document parti chez un
 * client. Une seule règle, appelée partout.
 */
function calculerTotaux(
  lignes: { montant: string }[],
  tauxTva: string,
  reductionPourcent?: string | null
) {
  const t = totauxAvecReduction(lignes, tauxTva, reductionPourcent);
  return {
    totalHt: t.totalHt,
    totalTva: t.totalTva,
    totalTtc: t.totalTtc,
    reductionPourcent: t.reductionPourcent,
    reductionMontant: t.reductionMontant,
  };
}

export async function getDevisPourChantier(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select()
      .from(devis)
      .where(eq(devis.chantierId, chantierId))
      .orderBy(desc(devis.numeroVersion))
      .limit(1);
    return rows[0] ?? null;
  });
}

/**
 * Les versions de devis d'un chantier, de la plus ancienne à la plus récente.
 *
 * **Née de sa question du 25 août 2026** : *« ressors-moi le PREMIER devis de
 * M. Bernard »*. L'assistant n'avait que `getDevisPourChantier`, qui rend la
 * dernière — et il en a conclu, devant le patron, qu'Atlas ne gardait que
 * celle-là. C'est faux : un devis envoyé est conservé, et le suivant devient
 * une version 2 (`getOuCreerDevisBrouillon`).
 *
 * **Croissante, et non décroissante comme partout ailleurs :** ici on lit une
 * histoire, on ne cherche pas l'état courant. « Le premier » doit être le
 * premier de la liste.
 */
export async function listerVersionsDevis(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        numeroVersion: devis.numeroVersion,
        numeroCommercial: devis.numeroCommercial,
        statut: devis.statut,
        totalTtc: devis.totalTtc,
      })
      .from(devis)
      .where(eq(devis.chantierId, chantierId))
      .orderBy(asc(devis.numeroVersion));
    return rows;
  });
}

/**
 * Une version précise d'un devis — ou la plus récente si l'on n'en nomme aucune.
 *
 * Un seul chemin pour les deux cas : deux fonctions voisines finiraient par
 * filtrer différemment, et l'écart se verrait sur un devis qu'on croit lire.
 */
export async function lireVersionDevis(ctx: Ctx, chantierId: string, version?: number) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select()
      .from(devis)
      .where(
        version === undefined
          ? eq(devis.chantierId, chantierId)
          : and(eq(devis.chantierId, chantierId), eq(devis.numeroVersion, version))
      )
      .orderBy(desc(devis.numeroVersion))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function getLignesDevis(ctx: Ctx, devisId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(lignesDevis).where(eq(lignesDevis.devisId, devisId))
  );
}

// Utilisée par l'écran Devis/Export pour un simple affichage : si la dernière
// version a déjà été envoyée, la retourne telle quelle, en lecture seule — ne
// déclenche jamais la création d'une nouvelle version simplement parce que
// l'écran est consulté. Retourne null si aucun devis n'existe encore ou si le
// dernier est un brouillon (l'appelant doit alors passer par
// getOuCreerDevisBrouillon pour le créer/régénérer).
export async function chargerDevisPourEcran(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [dernier] = await tx
      .select()
      .from(devis)
      .where(eq(devis.chantierId, chantierId))
      .orderBy(desc(devis.numeroVersion))
      .limit(1);
    if (dernier && dernier.statut === "envoye") return dernier;
    return null;
  });
}

// Crée le brouillon s'il n'en existe aucun, régénère ses lignes/totaux depuis
// les lignes de prix courantes s'il en existe déjà un (tant que non envoyé —
// jamais de recalcul d'un devis envoyé), ou ouvre une nouvelle version si la
// dernière version existante a déjà été envoyée.
export async function getOuCreerDevisBrouillon(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [chantier] = await tx.select().from(chantiers).where(eq(chantiers.id, chantierId)).limit(1);
    if (!chantier) throw new Error("Chantier introuvable");

    const [entreprise] = await tx.select().from(entreprises).where(eq(entreprises.id, ctx.entrepriseId)).limit(1);
    const client = chantier.clientId
      ? (await tx.select().from(clients).where(eq(clients.id, chantier.clientId)).limit(1))[0]
      : null;

    const lignesPrixActuelles = await tx.select().from(lignesPrix).where(eq(lignesPrix.chantierId, chantierId));

    const [dernier] = await tx
      .select()
      .from(devis)
      .where(eq(devis.chantierId, chantierId))
      .orderBy(desc(devis.numeroVersion))
      .limit(1);

    // **Les six conditions se figent ici**, avec l'identité : les relire au
    // moment de composer le PDF ferait changer ce qui engage un devis DÉJÀ
    // envoyé, parce qu'un réglage a bougé depuis (`ARCHITECTURE.md` §102).
    //
    // **Les cinq autres n'y étaient pas avant le 25 août 2026**, et c'est LUI
    // qui l'a vu : *« les autres qui sont en ON doivent-ils être visibles sur le
    // devis ? car je ne vois rien »*. Elles se réglaient, s'affichaient dans
    // l'aperçu des Réglages, et n'atteignaient aucun document.
    const conditions = conditionsDepuisEntreprise(entreprise);

    const snapshotEnTete = {
      validiteJours: conditions.validiteJours,
      acomptePourcent:
        conditions.acomptePourcent === null ? null : String(conditions.acomptePourcent),
      delaiPaiementJours: conditions.delaiPaiementJours,
      moyensPaiement: conditions.moyensPaiement,
      rappelerPenalites: conditions.rappelerPenalites,
      textePied: conditions.textePied,
      entrepriseNom: entreprise.nom,
      entrepriseAdresse: entreprise.adresse,
      entrepriseSiret: entreprise.siret,
      entrepriseEmail: entreprise.email,
      entrepriseTelephone: entreprise.telephone,
      entrepriseIban: entreprise.iban,
      clientNom: client?.nom,
      // Recopiée comme le nom : le document dit comment on s'adressait à son
      // destinataire CE JOUR-LÀ (migration 0038).
      clientCivilite: client?.civilite ?? null,
      clientAdresse: client?.adresse,
      clientTelephone: client?.telephone,
      clientEmail: client?.email,
      adresseChantier: chantier.adresseChantier,
    };

    // Le taux de TVA appartient au DOCUMENT : le patron peut l'avoir corrigé
    // sur son devis (10 % en rénovation, 20 % en neuf). Recalculer au taux par
    // défaut effacerait sa correction à la première ligne ajoutée.
    const taux = dernier && dernier.statut === "brouillon" ? dernier.tauxTva : TAUX_TVA_DEFAUT;
    // **La réduction survit à la régénération**, exactement comme le taux de
    // TVA juste au-dessus. Elle a été accordée au client ; ajouter une ligne au
    // devis ne la révoque pas, et la perdre en silence lui ferait renvoyer un
    // document plus cher que celui qu'il avait promis.
    const reduction = dernier && dernier.statut === "brouillon" ? dernier.reductionPourcent : null;
    const totaux = calculerTotaux(lignesPrixActuelles, taux, reduction);

    if (dernier && dernier.statut === "brouillon") {
      // Régénération : remplace les lignes et recalcule les totaux, ne change
      // ni le numéro commercial ni le numéro de version.
      await tx.delete(lignesDevis).where(eq(lignesDevis.devisId, dernier.id));
      const [d] = await tx
        .update(devis)
        .set({ ...snapshotEnTete, ...totaux })
        .where(eq(devis.id, dernier.id))
        .returning();
      if (lignesPrixActuelles.length > 0) {
        await tx.insert(lignesDevis).values(
          lignesPrixActuelles.map((l, i) => ({
            entrepriseId: ctx.entrepriseId,
            devisId: d.id,
            libelle: l.libelle,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            montant: l.montant,
            ordre: i,
          }))
        );
      }
      return d;
    }

    // Nouvelle version (aucun devis existant, ou dernier déjà envoyé).
    const numeroCommercial = dernier ? dernier.numeroCommercial : await attribuerNumeroDevis(tx, ctx.entrepriseId);
    const numeroVersion = dernier ? dernier.numeroVersion + 1 : 1;

    const [d] = await tx
      .insert(devis)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId,
        numeroCommercial,
        numeroVersion,
        statut: "brouillon",
        ...snapshotEnTete,
        dateEmission: new Date().toISOString().slice(0, 10),
        tauxTva: TAUX_TVA_DEFAUT,
        ...totaux,
        createdBy: ctx.utilisateurId,
      })
      .returning();

    if (lignesPrixActuelles.length > 0) {
      await tx.insert(lignesDevis).values(
        lignesPrixActuelles.map((l, i) => ({
          entrepriseId: ctx.entrepriseId,
          devisId: d.id,
          libelle: l.libelle,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          montant: l.montant,
          ordre: i,
        }))
      );
    }

    if (!chantier.devisGenereAt) {
      await tx.update(chantiers).set({ devisGenereAt: new Date() }).where(eq(chantiers.id, chantierId));
    }

    return d;
  });
}

// Génère le PDF pour un devis (brouillon ou envoyé) sans jamais persister la
// clé de stockage pour un brouillon (seul le PDF du devis réellement envoyé est
// conservé comme référence officielle — voir envoyerDevis).
export async function genererPdfPourApercu(ctx: Ctx, devisId: string): Promise<Uint8Array> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx.select().from(devis).where(eq(devis.id, devisId)).limit(1);
    if (!d) throw new Error("Devis introuvable");
    const lignes = await tx.select().from(lignesDevis).where(eq(lignesDevis.devisId, devisId));
    const habillage = await allureDesDocuments(tx, ctx.entrepriseId);
    return genererPdfDevis({
      numeroCommercial: d.numeroCommercial,
      numeroVersion: d.numeroVersion,
      statut: d.statut as "brouillon" | "envoye",
      dateEmission: d.dateEmission,
      entrepriseNom: d.entrepriseNom,
      entrepriseAdresse: d.entrepriseAdresse,
      entrepriseSiret: d.entrepriseSiret,
      entrepriseTelephone: d.entrepriseTelephone,
      entrepriseEmail: d.entrepriseEmail,
      // Le modèle d'Arborea imprime les modalités de virement : sans l'IBAN,
      // le client reçoit un devis qu'il ne peut pas payer.
      entrepriseIban: d.entrepriseIban,
      clientNom: d.clientNom,
      clientCivilite: d.clientCivilite,
      clientAdresse: d.clientAdresse,
      clientTelephone: d.clientTelephone,
      adresseChantier: d.adresseChantier,
      conditionsPaiement: d.conditionsPaiement,
      validiteJours: d.validiteJours,
      // Les cinq conditions figées à la création (migration 0064). C'est le PDF
      // qui les met en phrases, parce que le total y est connu — le montant de
      // l'acompte en dépend.
      conditionsReglees: {
        acomptePourcent: d.acomptePourcent,
        delaiPaiementJours: d.delaiPaiementJours,
        moyensPaiement: d.moyensPaiement,
        rappelerPenalites: d.rappelerPenalites,
        textePied: d.textePied,
      },
      devise: d.devise,
      tauxTva: d.tauxTva,
      totalHt: d.totalHt,
      totalTva: d.totalTva,
      totalTtc: d.totalTtc,
      reductionPourcent: d.reductionPourcent,
      reductionMontant: d.reductionMontant,
      lignes: lignes.map((l) => ({
        libelle: l.libelle,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        montant: l.montant,
      })),
    }, habillage);
  });
}

// Envoi : génère le PDF final, le persiste, puis fait passer statut -> envoye
// et fixe pdf_storage_key dans la MÊME mise à jour — le trigger d'immuabilité
// autorise cette transition (OLD.statut vaut encore 'brouillon' à cet instant),
// mais bloquera toute modification ultérieure, PDF inclus.
export async function envoyerDevis(ctx: Ctx, devisId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [avant] = await tx.select().from(devis).where(eq(devis.id, devisId)).limit(1);
    if (!avant) throw new Error("Devis introuvable");
    if (avant.statut === "envoye") throw new Error("Ce devis a déjà été envoyé.");

    const lignes = await tx.select().from(lignesDevis).where(eq(lignesDevis.devisId, devisId));
    const habillage = await allureDesDocuments(tx, ctx.entrepriseId);
    const pdfBytes = await genererPdfDevis({
      numeroCommercial: avant.numeroCommercial,
      numeroVersion: avant.numeroVersion,
      statut: "envoye",
      dateEmission: avant.dateEmission,
      entrepriseNom: avant.entrepriseNom,
      entrepriseAdresse: avant.entrepriseAdresse,
      entrepriseSiret: avant.entrepriseSiret,
      entrepriseTelephone: avant.entrepriseTelephone,
      entrepriseEmail: avant.entrepriseEmail,
      entrepriseIban: avant.entrepriseIban,
      clientNom: avant.clientNom,
      clientCivilite: avant.clientCivilite,
      clientAdresse: avant.clientAdresse,
      clientTelephone: avant.clientTelephone,
      adresseChantier: avant.adresseChantier,
      conditionsPaiement: avant.conditionsPaiement,
      devise: avant.devise,
      tauxTva: avant.tauxTva,
      totalHt: avant.totalHt,
      totalTva: avant.totalTva,
      totalTtc: avant.totalTtc,
      reductionPourcent: avant.reductionPourcent,
      reductionMontant: avant.reductionMontant,
      lignes: lignes.map((l) => ({
        libelle: l.libelle,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        montant: l.montant,
      })),
    }, habillage);

    const objet = await enregistrerObjet(
      `chantiers/${avant.chantierId}/devis`,
      Buffer.from(pdfBytes),
      ".pdf"
    );

    const [d] = await tx
      .update(devis)
      .set({
        statut: "envoye",
        envoyeLe: new Date(),
        pdfStorageKey: objet.storageKey,
        pdfChecksum: objet.checksum,
      })
      .where(eq(devis.id, devisId))
      .returning();

    await tx
      .update(chantiers)
      .set({ devisEnvoyeAt: sql`COALESCE(devis_envoye_at, now())` })
      .where(eq(chantiers.id, d.chantierId));

    return d;
  });
}

/**
 * Ce qui appartient au DOCUMENT, et non à ses sources : le taux de TVA et les
 * conditions imprimées au bas de la page.
 *
 * Ces deux champs ne figurent pas dans `snapshotEnTete` : ils survivent donc
 * aux régénérations du brouillon, ce qui est exactement le comportement voulu —
 * une ligne de prix ajoutée ne doit pas effacer les conditions écrites la
 * veille.
 *
 * Un devis déjà envoyé est refusé : il est immuable (trigger PostgreSQL), et le
 * corriger passe par une nouvelle version.
 */
export async function mettreAJourEnTeteDevis(
  ctx: Ctx,
  devisId: string,
  data: { tauxTva?: string; conditionsPaiement?: string; reductionPourcent?: string | null }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [avant] = await tx.select().from(devis).where(eq(devis.id, devisId)).limit(1);
    if (!avant || avant.statut === "envoye") return null;

    const valeurs: {
      tauxTva?: string;
      conditionsPaiement?: string;
      reductionPourcent?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (data.tauxTva !== undefined) {
      // Borné : un taux négatif ou à trois chiffres produirait un total que le
      // patron ne comprendrait pas, et qu'aucun client n'accepterait.
      const taux = Math.min(100, Math.max(0, Number(data.tauxTva.replace(",", "."))));
      if (Number.isFinite(taux)) valeurs.tauxTva = taux.toFixed(2);
    }
    if (data.conditionsPaiement !== undefined) valeurs.conditionsPaiement = data.conditionsPaiement;
    // **Le prix accordé au client passe par la MÊME borne que l'écran**
    // (`pourcentValide`) : une seule règle sert à construire l'écran et à
    // revalider ce qu'il renvoie, sans quoi les deux finissent par diverger
    // (`CLAUDE.md` §3). Rendre `null` retire la réduction — c'est ainsi qu'on
    // revient en arrière quand le client n'obtient finalement rien.
    if (data.reductionPourcent !== undefined) {
      valeurs.reductionPourcent = pourcentValide(data.reductionPourcent);
    }

    const lignes = await tx.select().from(lignesDevis).where(eq(lignesDevis.devisId, devisId));
    const totaux = calculerTotaux(
      lignes,
      valeurs.tauxTva ?? avant.tauxTva,
      data.reductionPourcent !== undefined ? valeurs.reductionPourcent : avant.reductionPourcent
    );

    const [row] = await tx
      .update(devis)
      .set({ ...valeurs, ...totaux })
      .where(eq(devis.id, devisId))
      .returning();
    return row ?? null;
  });
}

/**
 * Le devis d'un chantier, rendu SANS un seul prix — la feuille que le salarié
 * emporte.
 *
 * **Sa décision du 21 août 2026 :** *« le salarié ne doit pas avoir accès au
 * prix [...] je pense que le plus simple, ça serait de mettre le devis en PDF
 * sans les prix »*. Le raisonnement complet est dans `devis-pdf.ts` :
 * l'alternative — une liste de prestations saisie à côté — aurait été une
 * SECONDE version de ce qui est à faire, et les deux auraient divergé.
 *
 * **Toujours le devis ENVOYÉ, jamais un brouillon**, tant qu'il en existe un :
 * c'est celui que le client a reçu, donc celui sur lequel les deux parties se
 * sont entendues. Un brouillon en cours d'écriture enverrait l'équipe faire ce
 * qui n'a pas encore été proposé. Sans devis envoyé, on rend le brouillon —
 * mieux vaut la liste du jour que rien, et le titre du PDF dit ce qu'il est.
 *
 * **Régénéré, jamais servi depuis le stockage.** Le PDF figé au moment de
 * l'envoi porte, lui, tous les prix : le servir ici reviendrait exactement à ce
 * qu'on cherche à éviter.
 */
export async function genererDevisSansPrix(
  ctx: Ctx,
  chantierId: string
): Promise<Uint8Array | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const d = await devisÀImprimer(tx, chantierId);
    if (!d) return null;
    const lignes = await tx.select().from(lignesDevis).where(eq(lignesDevis.devisId, d.id));
    const habillage = await allureDesDocuments(tx, ctx.entrepriseId);
    return genererPdfDevis(
      {
        numeroCommercial: d.numeroCommercial,
        numeroVersion: d.numeroVersion,
        statut: d.statut as "brouillon" | "envoye",
        dateEmission: d.dateEmission,
        entrepriseNom: d.entrepriseNom,
        entrepriseAdresse: d.entrepriseAdresse,
        entrepriseSiret: d.entrepriseSiret,
        entrepriseTelephone: d.entrepriseTelephone,
        entrepriseEmail: d.entrepriseEmail,
        // `sansChiffrage` ignore l'IBAN : il n'a rien à faire sur une feuille
        // de chantier, et le passer ne l'imprime pas.
        entrepriseIban: d.entrepriseIban,
        clientNom: d.clientNom,
        clientCivilite: d.clientCivilite,
        clientAdresse: d.clientAdresse,
        clientTelephone: d.clientTelephone,
        adresseChantier: d.adresseChantier,
        conditionsPaiement: d.conditionsPaiement,
        validiteJours: d.validiteJours,
        devise: d.devise,
        tauxTva: d.tauxTva,
        totalHt: d.totalHt,
        totalTva: d.totalTva,
        totalTtc: d.totalTtc,
        reductionPourcent: d.reductionPourcent,
        reductionMontant: d.reductionMontant,
        lignes: lignes.map((l) => ({
          libelle: l.libelle,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          montant: l.montant,
        })),
      },
      { sansChiffrage: true, ...habillage }
    );
  });
}

/**
 * Ce qu'il y a à faire sur ce chantier, en toutes lettres et sans un prix.
 *
 * C'est ce que porte la feuille du planning, sous le nom du client. Les mêmes
 * lignes que le PDF ci-dessus, lues au même endroit : deux listes construites
 * séparément finiraient par ne plus dire la même chose, et l'équipe croirait
 * l'écran plutôt que le papier.
 *
 * **Une action et non un chargement de page** : la plupart des journées ne
 * s'ouvrent sur aucune feuille, et charger les lignes de tous les chantiers
 * planifiés ferait payer à chaque ouverture du planning ce qui ne sert qu'à un
 * appui.
 */
export type FeuilleDuChantier = {
  /** Ce qu'il y a à faire, ligne par ligne, sans un prix. */
  taches: string[];
  /**
   * Un devis existe-t-il ?
   *
   * **L'écran s'en sert pour ne pas offrir un bouton qui mène à rien.** Sans
   * devis, le PDF sans les prix n'a rien à imprimer et la route répond 404 : un
   * bouton qui ouvre une erreur est pire qu'un bouton absent — il fait douter de
   * l'application entière. Le cas ne devrait pas se présenter (le planning ne
   * liste que des chantiers dont le devis est PARTI), mais « ne devrait pas »
   * n'est pas « ne peut pas ».
   */
  avecDevis: boolean;
};

export async function tachesDuChantier(
  ctx: Ctx,
  chantierId: string
): Promise<FeuilleDuChantier> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const d = await devisÀImprimer(tx, chantierId);
    if (!d) return { taches: [], avecDevis: false };
    const lignes = await tx
      .select({ libelle: lignesDevis.libelle, quantite: lignesDevis.quantite })
      .from(lignesDevis)
      .where(eq(lignesDevis.devisId, d.id))
      .orderBy(lignesDevis.ordre);
    return {
      avecDevis: true,
      taches: lignes.map((l) => {
        // **La quantité s'écrit quand elle apprend quelque chose.** « 1 » ne dit
        // rien de plus que le libellé ; « 18 » dit combien de mètres de haie.
        const q = Number(l.quantite);
        return Number.isFinite(q) && q !== 1
          ? `${l.libelle} — ${q.toLocaleString("fr-FR")}`
          : l.libelle;
      }),
    };
  });
}

/** Le devis à imprimer : l'envoyé le plus récent, sinon le brouillon. */
async function devisÀImprimer(tx: DbOrTx, chantierId: string) {
  const [envoye] = await tx
    .select()
    .from(devis)
    .where(sql`${devis.chantierId} = ${chantierId} AND ${devis.statut} = 'envoye'`)
    .orderBy(desc(devis.numeroVersion))
    .limit(1);
  if (envoye) return envoye;
  const [brouillon] = await tx
    .select()
    .from(devis)
    .where(eq(devis.chantierId, chantierId))
    .orderBy(desc(devis.numeroVersion))
    .limit(1);
  return brouillon ?? null;
}

// --- Reprendre une ligne du devis d'un autre client -----------------------

/**
 * Une ligne de devis retrouvée ailleurs, avec de quoi la reconnaître.
 *
 * **Le nom du client vient du devis, pas de la fiche client.** Un devis fige le
 * nom de son destinataire au jour où il est établi (colonne `clientNom`) :
 * c'est ce nom-là qui est sur la feuille qu'il a sous les yeux, et donc celui
 * qu'il cite quand il demande « la ligne du devis de Bernard ».
 */
export type LigneDevisAilleurs = {
  ligneId: string;
  libelle: string;
  montant: string;
  quantite: string;
  prixUnitaire: string;
  client: string | null;
  chantier: string;
  numeroDevis: string;
  dateEmission: string;
};

/**
 * Cherche une ligne de devis dans TOUTE l'entreprise — tous clients confondus.
 *
 * **Sa demande du 25 août 2026 :** *« qu'il soit en mesure d'aller chercher une
 * ligne dans un devis de n'importe quel client et la poser sur un devis déjà
 * ouvert de n'importe quel client »*.
 *
 * **Ce qui borne la recherche, c'est la RLS, pas un filtre écrit ici.**
 * `withEntreprise` pose le contexte d'isolation : une entreprise voisine ne
 * remonte rien, silencieusement. C'est la seule barrière qui tienne — un `WHERE
 * entreprise_id = …` écrit à la main serait une seconde règle, et c'est
 * exactement ce que `CLAUDE.md` §3 interdit.
 *
 * **Deux filtres, tous deux facultatifs** : un mot du libellé, un bout du nom du
 * client. Sans aucun des deux, on ne rend rien plutôt que le devis entier de
 * l'entreprise : une liste de trois cents lignes ne se lit pas, et l'assistant
 * choisirait alors au hasard.
 */
export async function rechercherLignesDevisEntreprise(
  ctx: Ctx,
  filtres: { motCle?: string | null; client?: string | null },
  maximum = 12
): Promise<LigneDevisAilleurs[]> {
  const motCle = (filtres.motCle ?? "").trim();
  const nomClient = (filtres.client ?? "").trim();
  if (!motCle && !nomClient) return [];

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const conditions = [];
    if (motCle) conditions.push(sql`${lignesDevis.libelle} ILIKE ${"%" + motCle + "%"}`);
    if (nomClient) conditions.push(sql`${devis.clientNom} ILIKE ${"%" + nomClient + "%"}`);

    const lignes = await tx
      .select({
        ligneId: lignesDevis.id,
        libelle: lignesDevis.libelle,
        montant: lignesDevis.montant,
        quantite: lignesDevis.quantite,
        prixUnitaire: lignesDevis.prixUnitaire,
        client: devis.clientNom,
        chantier: chantiers.nom,
        numeroDevis: devis.numeroCommercial,
        dateEmission: devis.dateEmission,
      })
      .from(lignesDevis)
      .innerJoin(devis, eq(lignesDevis.devisId, devis.id))
      .innerJoin(chantiers, eq(devis.chantierId, chantiers.id))
      .where(sql.join(conditions, sql` AND `))
      .orderBy(desc(devis.dateEmission), lignesDevis.ordre)
      .limit(maximum);

    return lignes.map((l) => ({ ...l, dateEmission: String(l.dateEmission) }));
  });
}

/**
 * Relit UNE ligne par son identifiant, au moment de la recopier.
 *
 * **Le montant ne voyage jamais.** Ni le navigateur ni le modèle ne le
 * réémettent : ils ne portent que l'identifiant de la ligne d'origine, et le
 * prix est relu ici, à l'instant où l'on écrit. C'est le même remède que pour
 * un tarif (`ajouter_ligne_prix`), et pour la même raison : un montant transmis
 * est un montant qu'on peut changer en chemin, sur un document qui part chez un
 * client.
 *
 * Rend `null` quand la ligne a disparu — ou qu'elle appartient à une autre
 * entreprise, ce que la RLS rend indiscernable, et c'est très bien ainsi.
 */
export async function getLigneDevisPourCopie(
  ctx: Ctx,
  ligneId: string
): Promise<{ libelle: string; montant: string } | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ libelle: lignesDevis.libelle, montant: lignesDevis.montant })
      .from(lignesDevis)
      .where(eq(lignesDevis.id, ligneId))
      .limit(1);
    return ligne ?? null;
  });
}
