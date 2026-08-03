import { desc, eq, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import { devis, lignesDevis, lignesPrix, chantiers, clients, entreprises } from "../db/schema";
import type { Ctx } from "./context";
import { genererPdfDevis } from "../pdf/devis-pdf";
import { enregistrerObjet } from "../storage";

const TAUX_TVA_DEFAUT = "20.00";

// Numérotation atomique — le verrou de ligne posé par cet UPDATE sérialise les
// créations concurrentes pour une même entreprise (voir tests de concurrence).
// `prochain_numero_devis` représente le PROCHAIN numéro disponible, pas le dernier attribué.
export async function attribuerNumeroDevis(tx: DbOrTx, entrepriseId: string): Promise<string> {
  const result: unknown = await tx.execute(sql`
    UPDATE entreprise_compteurs
    SET prochain_numero_devis = prochain_numero_devis + 1
    WHERE entreprise_id = ${entrepriseId}
    RETURNING prochain_numero_devis - 1 AS numero
  `);
  const numero = (result as { rows: { numero: number }[] }).rows[0].numero;
  return `2026-${String(numero).padStart(4, "0")}`;
}

function calculerTotaux(lignes: { montant: string }[], tauxTva: string) {
  const totalHt = lignes.reduce((acc, l) => acc.plus(new Decimal(l.montant)), new Decimal(0));
  const totalTva = totalHt.times(new Decimal(tauxTva)).dividedBy(100);
  const totalTtc = totalHt.plus(totalTva);
  return {
    totalHt: totalHt.toFixed(2),
    totalTva: totalTva.toFixed(2),
    totalTtc: totalTtc.toFixed(2),
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
    const totaux = calculerTotaux(lignesPrixActuelles, TAUX_TVA_DEFAUT);

    const [dernier] = await tx
      .select()
      .from(devis)
      .where(eq(devis.chantierId, chantierId))
      .orderBy(desc(devis.numeroVersion))
      .limit(1);

    const snapshotEnTete = {
      entrepriseNom: entreprise.nom,
      entrepriseAdresse: entreprise.adresse,
      entrepriseSiret: entreprise.siret,
      entrepriseEmail: entreprise.email,
      entrepriseTelephone: entreprise.telephone,
      entrepriseIban: entreprise.iban,
      clientNom: client?.nom,
      clientAdresse: client?.adresse,
      clientTelephone: client?.telephone,
      clientEmail: client?.email,
      adresseChantier: chantier.adresseChantier,
    };

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
      clientAdresse: d.clientAdresse,
      clientTelephone: d.clientTelephone,
      adresseChantier: d.adresseChantier,
      conditionsPaiement: d.conditionsPaiement,
      devise: d.devise,
      tauxTva: d.tauxTva,
      totalHt: d.totalHt,
      totalTva: d.totalTva,
      totalTtc: d.totalTtc,
      lignes: lignes.map((l) => ({
        libelle: l.libelle,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        montant: l.montant,
      })),
    });
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
      clientAdresse: avant.clientAdresse,
      clientTelephone: avant.clientTelephone,
      adresseChantier: avant.adresseChantier,
      conditionsPaiement: avant.conditionsPaiement,
      devise: avant.devise,
      tauxTva: avant.tauxTva,
      totalHt: avant.totalHt,
      totalTva: avant.totalTva,
      totalTtc: avant.totalTtc,
      lignes: lignes.map((l) => ({
        libelle: l.libelle,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        montant: l.montant,
      })),
    });

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
