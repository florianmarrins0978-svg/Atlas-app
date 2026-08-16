import { and, asc, desc, eq, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { entreprises, factures, paiementsFacture } from "../db/schema";
import type { Ctx } from "./context";
import {
  etatPaiement,
  refusDuPaiement,
  resteDu,
  type EtatPaiement,
  type Exigibilite,
  type FacturePourTva,
  type Paiement,
} from "../../lib/exigibilite-tva";

/**
 * Les règlements reçus, et le régime de TVA de l'entreprise.
 *
 * **Sa demande du 14 août 2026 :** la facture émise attend dans un endroit à
 * part, et n'entre au relevé qu'une fois le paiement noté.
 *
 * **Ce fichier ne décide rien.** Le prorata d'un acompte, le refus d'un montant
 * trop grand, l'état d'une facture : tout vit dans `src/lib/exigibilite-tva.ts`,
 * en fonctions pures éprouvables sans base. Ici on lit et on écrit.
 *
 * **Tout passe par `withEntreprise`** — ce sont ses encaissements
 * (`CLAUDE.md` §3).
 */

export type PaiementEnregistre = Paiement & {
  id: string;
  moyen: "virement" | "cheque" | "especes" | "carte" | "autre" | null;
  note: string | null;
  /** `reprise` : supposé par la migration 0042, et l'écran doit le dire. */
  origine: "saisi" | "reprise" | "banque";
};

/** Une facture qui attend son règlement, telle que l'écran la montre. */
export type FactureEnAttente = {
  id: string;
  numeroCommercial: string;
  dateEmission: string;
  clientNom: string | null;
  chantierId: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  /** Ce qui reste à recevoir. */
  reste: string;
  etat: EtatPaiement;
  paiements: PaiementEnregistre[];
};

/** Le régime de l'entreprise. Aucun défaut deviné : la colonne le porte. */
export async function exigibiliteDe(ctx: Ctx): Promise<Exigibilite> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ regime: entreprises.tvaExigibilite })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId));
    return (ligne?.regime ?? "encaissements") as Exigibilite;
  });
}

export async function reglerExigibilite(ctx: Ctx, regime: Exigibilite): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(entreprises)
      .set({ tvaExigibilite: regime, updatedAt: new Date() })
      .where(eq(entreprises.id, ctx.entrepriseId));
  });
}

/**
 * Toutes les factures émises, avec leurs règlements.
 *
 * Sert au relevé comme à l'écran d'attente : une seule lecture, une seule
 * vérité. Deux requêtes qui compteraient chacune de leur côté finiraient par
 * afficher deux totaux différents sur le même écran.
 */
export async function facturesAvecPaiements(ctx: Ctx): Promise<FactureEnAttente[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [lignes, regles] = await Promise.all([
      tx
        .select({
          id: factures.id,
          numeroCommercial: factures.numeroCommercial,
          dateEmission: factures.dateEmission,
          clientNom: factures.clientNom,
          chantierId: factures.chantierId,
          totalHt: factures.totalHt,
          totalTva: factures.totalTva,
          totalTtc: factures.totalTtc,
        })
        .from(factures)
        .where(eq(factures.statut, "emise"))
        .orderBy(desc(factures.dateEmission), desc(factures.numeroCommercial)),
      tx.select().from(paiementsFacture).orderBy(asc(paiementsFacture.datePaiement)),
    ]);

    const parFacture = new Map<string, PaiementEnregistre[]>();
    for (const p of regles) {
      const liste = parFacture.get(p.factureId) ?? [];
      liste.push({
        id: p.id,
        date: p.datePaiement,
        montant: p.montant,
        moyen: p.moyen,
        note: p.note,
        origine: p.origine,
      });
      parFacture.set(p.factureId, liste);
    }

    return lignes.map((f) => {
      const paiements = parFacture.get(f.id) ?? [];
      return {
        ...f,
        paiements,
        reste: resteDu(f as FacturePourTva, paiements),
        etat: etatPaiement(f as FacturePourTva, paiements),
      };
    });
  });
}

/** Celles qui attendent encore quelque chose — l'écran « En attente ». */
export async function facturesEnAttente(ctx: Ctx): Promise<FactureEnAttente[]> {
  return (await facturesAvecPaiements(ctx)).filter((f) => f.etat !== "soldee");
}

export type ResultatPaiement = { ok: true; reste: string; etat: EtatPaiement } | { ok: false; raison: string };

/**
 * Note un règlement — ou dit pourquoi c'est impossible.
 *
 * **Le refus remonte jusqu'à l'écran**, avec sa phrase. Un montant plus grand
 * que ce qui reste dû ferait entrer au relevé plus de TVA que la facture n'en
 * porte, et c'est l'administration qui poserait la question des mois plus tard.
 */
export async function noterPaiement(
  ctx: Ctx,
  factureId: string,
  demande: { date: string; montant: string; moyen?: PaiementEnregistre["moyen"]; note?: string }
): Promise<ResultatPaiement> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [facture] = await tx
      .select({
        id: factures.id,
        dateEmission: factures.dateEmission,
        totalHt: factures.totalHt,
        totalTva: factures.totalTva,
        totalTtc: factures.totalTtc,
        statut: factures.statut,
      })
      .from(factures)
      .where(eq(factures.id, factureId));

    // Une facture qu'on ne voit pas — celle d'une autre entreprise, ou un
    // identifiant inventé — ne rend rien : la RLS a déjà fait son travail.
    if (!facture) return { ok: false as const, raison: "Cette facture est introuvable." };
    if (facture.statut !== "emise") {
      return { ok: false as const, raison: "Cette facture n'est pas encore émise." };
    }

    const dejaRegles = (
      await tx.select().from(paiementsFacture).where(eq(paiementsFacture.factureId, factureId))
    ).map((p) => ({ date: p.datePaiement, montant: p.montant }));

    const montant = String(demande.montant ?? "")
      .replace(/[\s  ]/g, "")
      .replace("€", "")
      .replace(",", ".");
    const refus = refusDuPaiement(facture as FacturePourTva, dejaRegles, { date: demande.date, montant });
    if (refus) return { ok: false as const, raison: refus };

    await tx.insert(paiementsFacture).values({
      entrepriseId: ctx.entrepriseId,
      factureId,
      datePaiement: demande.date,
      montant: Number(montant).toFixed(2),
      moyen: demande.moyen ?? null,
      note: demande.note?.trim() || null,
      origine: "saisi",
    });

    const tous = [...dejaRegles, { date: demande.date, montant }];
    return {
      ok: true as const,
      reste: resteDu(facture as FacturePourTva, tous),
      etat: etatPaiement(facture as FacturePourTva, tous),
    };
  });
}

/**
 * Le geste d'un doigt : « payée », pour le solde, aujourd'hui.
 *
 * **C'est la porte qu'il a décrite** : *« je retourne sur l'endroit en attente,
 * je clique sur valider, et boum. »* Elle ne remplace pas la saisie détaillée —
 * un acompte demande une date et un montant — mais elle couvre le cas courant
 * en un appui, et c'est celui-là qui se fait cinquante fois par an.
 */
export async function soldera(ctx: Ctx, factureId: string, aujourdHui: string): Promise<ResultatPaiement> {
  const facture = (await facturesAvecPaiements(ctx)).find((f) => f.id === factureId);
  if (!facture) return { ok: false, raison: "Cette facture est introuvable." };
  if (facture.etat === "soldee") return { ok: false, raison: "Cette facture est déjà réglée." };

  // **La date d'émission plutôt qu'aujourd'hui si la facture est postérieure.**
  // Une facture datée de demain — cela arrive quand il la prépare d'avance — ne
  // peut pas avoir été encaissée hier : le règlement serait refusé, et le refus
  // parlerait d'une date qu'il n'a jamais saisie.
  const date = aujourdHui < facture.dateEmission ? facture.dateEmission : aujourdHui;
  return noterPaiement(ctx, factureId, { date, montant: facture.reste });
}

/**
 * Défait un règlement.
 *
 * **Sans lui, une erreur de doigt serait définitive** : une facture marquée
 * payée par mégarde déclarerait une TVA non encaissée, et rien ne permettrait
 * de revenir dessus. La ligne est supprimée pour de bon — contrairement aux
 * tranches de grille, il n'y a rien à préserver : c'est une saisie, pas une
 * donnée reçue.
 */
export async function retirerPaiement(ctx: Ctx, paiementId: string): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.delete(paiementsFacture).where(eq(paiementsFacture.id, paiementId));
  });
}

/** Combien de factures attendent, et depuis combien de temps la plus ancienne. */
export async function compterEnAttente(ctx: Ctx): Promise<{ nombre: number; plusAncienne: string | null }> {
  const enAttente = await facturesEnAttente(ctx);
  return {
    nombre: enAttente.length,
    plusAncienne: enAttente.reduce<string | null>(
      (min, f) => (min === null || f.dateEmission < min ? f.dateEmission : min),
      null
    ),
  };
}

/** Réservé aux suites : compter sans passer par l'écran. */
export async function compterPaiements(ctx: Ctx, factureId: string): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [r] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(paiementsFacture)
      .where(and(eq(paiementsFacture.factureId, factureId)));
    return r?.n ?? 0;
  });
}
