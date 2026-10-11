import { asc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { avoirs, factures, lignesFacture } from "../db/schema";
import type { Ctx } from "./context";
import { apresAvoirs, type AvoirPourTva } from "@/lib/exigibilite-tva";
import { calculerAvoir, type DemandeAvoir } from "@/lib/avoir";
import { allureDepuisColonnes } from "@/lib/allure-documents";
import { jourIso } from "@/lib/jour";
import { attribuerNumero, complementsDeLaFacture, donneesFacture } from "./factures";
import { allureDesDocuments } from "./entreprises";
import { genererPdfAvoir } from "../pdf/avoir-pdf";
import { enregistrerObjet, lireObjet } from "../storage";

/**
 * Les avoirs de chaque facture, tels que la TVA et le reste dû les lisent.
 *
 * **Une seule lecture pour tous ceux qui comptent ce qu'un client doit** : le
 * relevé, l'écran d'attente, la fiche client, les rappels. Chacun sa requête, et
 * l'un d'eux finirait par oublier un avoir : le client se verrait réclamer une
 * somme déjà annulée.
 *
 * S'appelle DANS la transaction de l'appelant (`withEntreprise`) : la RLS de
 * `avoirs` n'y laisse voir que ceux de l'entreprise.
 */
export async function avoirsDesFactures(
  tx: DbOrTx,
  factureIds: readonly string[]
): Promise<Map<string, AvoirPourTva[]>> {
  const parFacture = new Map<string, AvoirPourTva[]>();
  if (factureIds.length === 0) return parFacture;
  const lignes = await tx
    .select({
      factureId: avoirs.factureId,
      numero: avoirs.numero,
      date: avoirs.dateEmission,
      ht: avoirs.totalHt,
      tva: avoirs.totalTva,
      ttc: avoirs.totalTtc,
    })
    .from(avoirs)
    .where(inArray(avoirs.factureId, [...factureIds]));
  for (const { factureId, ...a } of lignes) {
    const liste = parFacture.get(factureId) ?? [];
    liste.push(a);
    parFacture.set(factureId, liste);
  }
  return parFacture;
}

// ─── Faire un avoir ──────────────────────────────────────────────────────────

export type ResultatAvoir =
  | { ok: true; avoir: { id: string; numero: string; totalTtc: string; chantierId: string } }
  | { ok: false; refus: string };

/**
 * Fait l'avoir : le calcule, le numérote, compose son papier, l'enregistre.
 *
 * **Tout dans UNE transaction** : un numéro pris sans avoir enregistré laisserait
 * un trou dans la suite des avoirs, ce que la loi interdit. Le PDF est composé
 * AVANT l'insertion, parce qu'un avoir ne se modifie plus une fois écrit
 * (`trg_avoir_immuable`) : il naît complet ou il ne naît pas.
 *
 * **Le refus est une valeur de retour**, jamais une exception : elle deviendrait
 * un identifiant opaque chez lui (`AGENTS.md`).
 */
export async function faireUnAvoir(
  ctx: Ctx,
  factureId: string,
  demande: DemandeAvoir,
  maintenant: Date = new Date()
): Promise<ResultatAvoir> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [facture] = await tx.select().from(factures).where(eq(factures.id, factureId));
    if (!facture) return { ok: false as const, refus: "Cette facture est introuvable." };
    if (facture.statut !== "emise") {
      return { ok: false as const, refus: "Un avoir ne se fait que sur une facture envoyée : celle-ci se corrige encore." };
    }

    const lignes = await tx
      .select()
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, factureId))
      .orderBy(asc(lignesFacture.ordre));
    const precedents = await tx.select().from(avoirs).where(eq(avoirs.factureId, factureId));

    const calcul = calculerAvoir(
      {
        numero: facture.numeroCommercial,
        totalHt: facture.totalHt,
        totalTva: facture.totalTva,
        totalTtc: facture.totalTtc,
        tauxTva: facture.tauxTva,
        reductionPourcent: facture.reductionPourcent,
        lignes: lignes.map((l) => ({
          id: l.id,
          libelle: l.libelle,
          quantite: l.quantite,
          unite: l.unite,
          prixUnitaire: l.prixUnitaire,
          montant: l.montant,
          tauxTva: l.tauxTva,
        })),
      },
      precedents.map((a) => ({ ligneFactureId: a.ligneFactureId, totalTtc: a.totalTtc })),
      demande
    );
    if (!calcul.ok) return { ok: false as const, refus: calcul.refus };
    const a = calcul.avoir;

    const numero = await attribuerNumero(tx, ctx.entrepriseId, "avoir");
    const date = jourIso(maintenant);

    // Ce que la facture vaut après TOUS ses avoirs, celui-ci compris.
    const apres = apresAvoirs({
      dateEmission: facture.dateEmission,
      totalHt: facture.totalHt,
      totalTva: facture.totalTva,
      totalTtc: facture.totalTtc,
      avoirs: [
        ...precedents.map((p) => ({ numero: p.numero, date: p.dateEmission, ht: p.totalHt, tva: p.totalTva, ttc: p.totalTtc })),
        { numero, date, ht: a.totalHt, tva: a.totalTva, ttc: a.totalTtc },
      ],
    });

    // **L'avoir porte l'allure de la facture qu'il corrige**, figée à son
    // émission : il se lit à côté d'elle, et un changement de réglage depuis ne
    // doit pas lui donner un autre visage.
    const { logo } = await allureDesDocuments(tx, ctx.entrepriseId);
    const allure = allureDepuisColonnes({
      typographie: facture.docTypographie,
      fond: facture.docFond,
      accent: facture.docAccent,
    });
    const pdf = await genererPdfAvoir(
      {
        facture: donneesFacture(facture, lignes, await complementsDeLaFacture(tx, ctx.entrepriseId, facture)),
        numero,
        dateEmission: date,
        motif: a.motif,
        lignes: a.lignes,
        totalHt: a.totalHt,
        totalTva: a.totalTva,
        totalTtc: a.totalTtc,
        resteHt: apres.totalHt,
        resteTva: apres.totalTva,
        resteTtc: apres.totalTtc,
      },
      { allure, logo }
    );
    const objet = await enregistrerObjet(`chantiers/${facture.chantierId}/avoirs`, Buffer.from(pdf), ".pdf");

    const [cree] = await tx
      .insert(avoirs)
      .values({
        entrepriseId: ctx.entrepriseId,
        factureId,
        numero,
        dateEmission: date,
        motif: a.motif,
        ligneFactureId: a.ligneFactureId,
        totalHt: a.totalHt,
        totalTva: a.totalTva,
        totalTtc: a.totalTtc,
        lignes: a.lignes,
        pdfStorageKey: objet.storageKey,
        pdfChecksum: objet.checksum,
        createdBy: ctx.utilisateurId,
      })
      .returning({ id: avoirs.id, numero: avoirs.numero, totalTtc: avoirs.totalTtc });

    return { ok: true as const, avoir: { ...cree!, chantierId: facture.chantierId } };
  });
}

/** Les avoirs d'une facture, du premier au dernier : pour l'écran de la facture. */
export async function avoirsDeLaFacture(ctx: Ctx, factureId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: avoirs.id,
        numero: avoirs.numero,
        dateEmission: avoirs.dateEmission,
        motif: avoirs.motif,
        totalHt: avoirs.totalHt,
        totalTva: avoirs.totalTva,
        totalTtc: avoirs.totalTtc,
      })
      .from(avoirs)
      .where(eq(avoirs.factureId, factureId))
      .orderBy(asc(avoirs.createdAt))
  );
}

/** Le PDF d'un avoir, figé à sa naissance ; `null` s'il n'est pas visible d'ici. */
export async function pdfDeLAvoir(ctx: Ctx, avoirId: string): Promise<{ numero: string; pdf: Buffer } | null> {
  const [a] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select({ numero: avoirs.numero, cle: avoirs.pdfStorageKey }).from(avoirs).where(eq(avoirs.id, avoirId))
  );
  if (!a) return null;
  return { numero: a.numero, pdf: await lireObjet(a.cle) };
}

/**
 * Ce que l'écran « Je fais un avoir » doit savoir pour calculer comme le
 * serveur : la facture telle que `calculerAvoir` la lit, et les avoirs déjà
 * faits. `null` si le chantier n'a pas de facture partie.
 *
 * **L'écran calcule avec la MÊME fonction que l'enregistrement** : ce qu'il
 * affiche est ce qui s'écrira (`CLAUDE.md` §3). Le serveur recalcule quand
 * même : l'écran ne décide de rien.
 */
export async function preparerAvoir(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx.select().from(factures).where(eq(factures.chantierId, chantierId));
    if (!f || f.statut !== "emise") return null;
    const lignes = await tx
      .select()
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, f.id))
      .orderBy(asc(lignesFacture.ordre));
    const precedents = await tx
      .select({ ligneFactureId: avoirs.ligneFactureId, totalTtc: avoirs.totalTtc })
      .from(avoirs)
      .where(eq(avoirs.factureId, f.id));
    return {
      factureId: f.id,
      clientNom: f.clientNom,
      facture: {
        numero: f.numeroCommercial,
        totalHt: f.totalHt,
        totalTva: f.totalTva,
        totalTtc: f.totalTtc,
        tauxTva: f.tauxTva,
        reductionPourcent: f.reductionPourcent,
        lignes: lignes.map((l) => ({
          id: l.id,
          libelle: l.libelle,
          quantite: l.quantite,
          unite: l.unite,
          prixUnitaire: l.prixUnitaire,
          montant: l.montant,
          tauxTva: l.tauxTva,
        })),
      },
      dejaFaits: precedents,
    };
  });
}

/**
 * Un avoir tel que l'écran « C'est fait » le montre : ce qu'il retire, et ce
 * que la facture vaut désormais. `null` s'il n'est pas visible d'ici.
 */
export async function avoirPourEcran(ctx: Ctx, avoirId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [a] = await tx.select().from(avoirs).where(eq(avoirs.id, avoirId));
    if (!a) return null;
    const [f] = await tx.select().from(factures).where(eq(factures.id, a.factureId));
    if (!f) return null;
    const tous = (await avoirsDesFactures(tx, [f.id])).get(f.id) ?? [];
    const apres = apresAvoirs({ ...f, avoirs: tous });
    return {
      id: a.id,
      numero: a.numero,
      motif: a.motif,
      totalTtc: a.totalTtc,
      factureId: f.id,
      factureNumero: f.numeroCommercial,
      clientNom: f.clientNom,
      clientCivilite: f.clientCivilite,
      chantierId: f.chantierId,
      nouveauTtc: apres.totalTtc,
    };
  });
}
