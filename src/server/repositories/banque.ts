import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { liaisonsBancaires, mouvementsBancaires, virementsRecus } from "../db/schema";
import type { Ctx } from "./context";
import { noterPaiementDans, retirerPaiementDans } from "./paiements-facture";

/**
 * MA BANQUE — la liaison et les virements reçus (migration 0140).
 *
 * Ses choix du 23 octobre 2026 : un virement devient une carte sur l'accueil
 * ET une question dans Ma TVA, et **une réponse donnée à un endroit vaut pour
 * l'autre** (`appli/banque-numero-et-termines.html`). C'est pourquoi la réponse
 * vit ici, en base, et non dans l'écran.
 *
 * Tout passe par `withEntreprise` : une liaison ou un virement d'une autre
 * entreprise est invisible, la RLS l'a déjà décidé.
 */

export type LiaisonEnregistree = {
  session: string;
  comptes: string[];
  banque: string;
  accordJusquAu: Date;
  luLe: Date | null;
};

export async function liaisonDeLEntreprise(ctx: Ctx): Promise<LiaisonEnregistree | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx.select().from(liaisonsBancaires).limit(1);
    if (!l) return null;
    return { session: l.sessionId, comptes: l.comptes, banque: l.banque ?? "", accordJusquAu: l.accordJusquAu, luLe: l.luLe };
  });
}

/** Relier à nouveau remplace : une banque par entreprise, et la lecture repart de zéro. */
export async function enregistrerLiaison(
  ctx: Ctx,
  l: { session: string; comptes: string[]; banque: string; accordJusquAu: Date }
): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const valeurs = {
      sessionId: l.session,
      comptes: l.comptes,
      banque: l.banque || null,
      accordJusquAu: l.accordJusquAu,
      luLe: null,
    };
    await tx
      .insert(liaisonsBancaires)
      .values({ ...valeurs, entrepriseId: ctx.entrepriseId, createdBy: ctx.utilisateurId })
      .onConflictDoUpdate({ target: liaisonsBancaires.entrepriseId, set: valeurs });
  });
}

/**
 * Délier. Les virements déjà lus restent, avec leurs réponses : un « oui »
 * donné a noté un paiement, et ce paiement ne disparaît pas avec la banque.
 */
export async function supprimerLiaison(ctx: Ctx): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.delete(liaisonsBancaires);
  });
}

export async function marquerBanqueLue(ctx: Ctx, quand: Date): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.update(liaisonsBancaires).set({ luLe: quand });
  });
}

export type VirementEnBase = {
  cle: string;
  date: string;
  montant: string;
  payeur: string | null;
  libelle: string;
};

/** Range les virements lus. Une clé déjà connue ne double rien. Rend combien sont nouveaux. */
export async function ajouterVirements(ctx: Ctx, virements: VirementEnBase[]): Promise<number> {
  if (virements.length === 0) return 0;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const nouveaux = await tx
      .insert(virementsRecus)
      .values(
        virements.map((v) => ({
          entrepriseId: ctx.entrepriseId,
          cle: v.cle,
          jour: v.date,
          montant: v.montant,
          payeur: v.payeur,
          libelle: v.libelle,
        }))
      )
      .onConflictDoNothing({ target: [virementsRecus.entrepriseId, virementsRecus.cle] })
      .returning({ id: virementsRecus.id });
    return nouveaux.length;
  });
}

export type VirementLuEnBase = {
  id: string;
  date: string;
  montant: string;
  payeur: string | null;
  libelle: string;
  etat: "nouveau" | "confirme" | "ecarte";
  factureId: string | null;
};

/** Les virements reçus depuis `depuis`, du plus récent au plus ancien. */
export async function virementsDepuis(ctx: Ctx, depuis: string): Promise<VirementLuEnBase[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select()
      .from(virementsRecus)
      .where(gte(virementsRecus.jour, depuis))
      .orderBy(desc(virementsRecus.jour), desc(virementsRecus.createdAt));
    return lignes.map((v) => ({
      id: v.id,
      date: v.jour,
      montant: v.montant,
      payeur: v.payeur,
      libelle: v.libelle,
      etat: v.etat,
      factureId: v.factureId,
    }));
  });
}

export type ResultatReponse = { ok: true; paiementId?: string } | { ok: false; raison: string };

/**
 * « Oui » : ce virement paie cette facture.
 *
 * **Le règlement et la réponse s'écrivent dans la MÊME transaction**, ou pas
 * du tout. Le virement est verrouillé d'abord : deux appuis — l'accueil et Ma
 * TVA ouverts sur deux téléphones — ne noteront jamais deux paiements.
 *
 * Le montant à noter est décidé par l'appelant (`montantANoter`), qui a
 * revalidé la proposition contre les factures du moment : ici, on écrit.
 */
export async function confirmerVirement(
  ctx: Ctx,
  virementId: string,
  factureId: string,
  montant: string
): Promise<ResultatReponse> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [v] = await tx.select().from(virementsRecus).where(eq(virementsRecus.id, virementId)).for("update");
    if (!v) return { ok: false as const, raison: "Ce virement est introuvable." };
    if (v.etat !== "nouveau") return { ok: false as const, raison: "Vous avez déjà répondu pour ce virement." };

    const note = await noterPaiementDans(tx, ctx, factureId, {
      date: v.jour,
      montant,
      moyen: "virement",
      note: v.libelle ? `Virement reçu : ${v.libelle}`.slice(0, 200) : "Virement reçu",
    });
    if (!note.ok) return note;

    await tx
      .update(virementsRecus)
      .set({ etat: "confirme", factureId, paiementId: note.paiementId ?? null, reponduAt: new Date() })
      .where(eq(virementsRecus.id, virementId));
    return { ok: true as const, paiementId: note.paiementId };
  });
}

/** « Non » : ce virement ne paie aucune facture d'Atlas. Rien n'entre au relevé. */
export async function ecarterVirement(ctx: Ctx, virementId: string): Promise<ResultatReponse> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const fait = await tx
      .update(virementsRecus)
      .set({ etat: "ecarte", reponduAt: new Date() })
      .where(and(eq(virementsRecus.id, virementId), eq(virementsRecus.etat, "nouveau")))
      .returning({ id: virementsRecus.id });
    if (fait.length === 0) return { ok: false as const, raison: "Vous avez déjà répondu pour ce virement." };
    return { ok: true as const };
  });
}

/**
 * « Annuler » : la réponse se défait, et le virement redevient une question.
 *
 * Un « oui » défait retire le règlement qu'il avait noté, avec sa trace
 * (`retirerPaiementDans`, la ligne barrée de Ma TVA) : une erreur de doigt ne
 * laisse pas une TVA déclarée pour un argent qui n'était pas celui-là.
 */
export async function defaireReponse(ctx: Ctx, virementId: string): Promise<ResultatReponse> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [v] = await tx.select().from(virementsRecus).where(eq(virementsRecus.id, virementId)).for("update");
    if (!v) return { ok: false as const, raison: "Ce virement est introuvable." };
    if (v.etat === "nouveau") return { ok: true as const };
    if (v.paiementId) await retirerPaiementDans(tx, ctx, v.paiementId);
    await tx
      .update(virementsRecus)
      .set({ etat: "nouveau", factureId: null, paiementId: null, reponduAt: null })
      .where(eq(virementsRecus.id, virementId));
    return { ok: true as const };
  });
}

// ─── Pour mon comptable — chaque ligne du relevé (migration 0142) ────────────

export type MouvementEnBase = {
  cle: string;
  date: string;
  montant: string;
  sens: "entree" | "sortie";
  contrepartie: string | null;
  libelle: string;
};

/**
 * Range les lignes du relevé lues. Une clé déjà connue ne double rien.
 * Rend combien sont nouvelles.
 *
 * **Rangées à CHAQUE lecture**, et pas le jour où le dossier s'arrête : les
 * banques ne rendent d'ordinaire que quatre-vingt-dix jours d'historique.
 */
export async function ajouterMouvements(ctx: Ctx, mouvements: readonly MouvementEnBase[]): Promise<number> {
  if (mouvements.length === 0) return 0;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const nouveaux = await tx
      .insert(mouvementsBancaires)
      .values(
        mouvements.map((m) => ({
          entrepriseId: ctx.entrepriseId,
          cle: m.cle,
          jour: m.date,
          montant: m.montant,
          sens: m.sens,
          contrepartie: m.contrepartie,
          libelle: m.libelle,
        }))
      )
      .onConflictDoNothing({ target: [mouvementsBancaires.entrepriseId, mouvementsBancaires.cle] })
      .returning({ id: mouvementsBancaires.id });
    return nouveaux.length;
  });
}

export type MouvementLuEnBase = MouvementEnBase & { id: string };

/** Les lignes du relevé entre deux jours compris, dans l'ordre du relevé. */
export async function mouvementsEntre(ctx: Ctx, du: string, au: string): Promise<MouvementLuEnBase[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select()
      .from(mouvementsBancaires)
      .where(and(gte(mouvementsBancaires.jour, du), lte(mouvementsBancaires.jour, au)))
      .orderBy(asc(mouvementsBancaires.jour), asc(mouvementsBancaires.createdAt));
    return lignes.map((m) => ({
      id: m.id,
      cle: m.cle,
      date: m.jour,
      montant: m.montant,
      sens: m.sens,
      contrepartie: m.contrepartie,
      libelle: m.libelle,
    }));
  });
}
