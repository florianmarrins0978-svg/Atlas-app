import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { termesMetier, correctionsDictee } from "../db/schema";
import type { Ctx } from "./context";
import type { TermeMetier, CorrectionApprise } from "../../lib/consigne-metier";

/**
 * Le vocabulaire du métier et les règles de chiffrage.
 *
 * **Partagés, et sans contexte d'entreprise — c'est délibéré.** Cette table ne
 * contient ni nom, ni adresse, ni prix de client : des mots et des principes.
 * Elle part avec l'application chez tous les futurs clients (décision du patron
 * du 7 août 2026, `docs/QUESTIONS.md` §10), et c'est la seule raison pour
 * laquelle elle peut se lire hors de `withEntreprise` sans que ce soit une
 * entorse : il n'y a rien à isoler.
 *
 * L'écriture, elle, reste réservée à l'éditeur — la garde vit dans les actions
 * (`src/server/editeur.ts`), pas ici : un dépôt n'est pas le bon endroit pour
 * décider qui a le droit.
 */
export async function listerTermesMetier(options: { inclureInactifs?: boolean } = {}) {
  const lignes = await db
    .select()
    .from(termesMetier)
    .orderBy(asc(termesMetier.nature), asc(termesMetier.ordre), asc(termesMetier.intitule));
  return options.inclureInactifs ? lignes : lignes.filter((t) => t.actif);
}

export async function creerTermeMetier(data: {
  nature: "mot" | "regle";
  intitule: string;
  definition: string;
  consigne?: string | null;
  ordre?: number;
}) {
  const [row] = await db
    .insert(termesMetier)
    .values({
      nature: data.nature,
      intitule: data.intitule.trim(),
      definition: data.definition.trim(),
      consigne: data.consigne?.trim() || null,
      ordre: data.ordre ?? 0,
    })
    .returning();
  return row;
}

export async function modifierTermeMetier(
  id: string,
  data: { intitule?: string; definition?: string; consigne?: string | null; ordre?: number; actif?: boolean }
) {
  const [row] = await db
    .update(termesMetier)
    .set({
      ...(data.intitule !== undefined ? { intitule: data.intitule.trim() } : {}),
      ...(data.definition !== undefined ? { definition: data.definition.trim() } : {}),
      ...(data.consigne !== undefined ? { consigne: data.consigne?.trim() || null } : {}),
      ...(data.ordre !== undefined ? { ordre: data.ordre } : {}),
      ...(data.actif !== undefined ? { actif: data.actif } : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(termesMetier.id, id))
    .returning();
  return row ?? null;
}

export async function supprimerTermeMetier(id: string) {
  await db.delete(termesMetier).where(eq(termesMetier.id, id));
}

/** Ce que la lecture des dictées doit emporter — actifs seulement. */
export async function termesPourConsigne(): Promise<TermeMetier[]> {
  const lignes = await listerTermesMetier();
  return lignes.map((t) => ({
    nature: t.nature,
    intitule: t.intitule,
    definition: t.definition,
    consigne: t.consigne,
  }));
}

// =========================================================================
// Les corrections du patron — par entreprise, jamais partagées
// =========================================================================

type LigneApprise = { libelle: string; montant: string };

/**
 * Note ce qu'Atlas a proposé à partir d'une dictée — la référence de départ.
 *
 * Appelé au moment où le devis est préparé, avant toute retouche. Sans cette
 * photographie, on ne saurait plus tard que ce que le patron a écrit, jamais ce
 * qu'il a **changé** — or c'est l'écart qui enseigne.
 *
 * Une ligne par chantier : il retouche son devis plusieurs fois d'affilée, et
 * compter chaque passage remplirait la mémoire d'états intermédiaires — le
 * piège déjà rencontré avec `lecons_prix` (migration 0023).
 */
export async function noterPropositionDictee(
  ctx: Ctx,
  chantierId: string,
  dictee: string,
  propose: LigneApprise[]
): Promise<void> {
  const texte = dictee.trim();
  if (!texte) return;
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .insert(correctionsDictee)
      .values({ entrepriseId: ctx.entrepriseId, chantierId, dictee: texte, propose, retenu: propose })
      .onConflictDoUpdate({
        target: correctionsDictee.chantierId,
        set: { dictee: texte, propose, retenu: propose, updatedAt: sql`now()` },
      });
  });
}

/**
 * Note ce que le patron a finalement retenu, après ses retouches.
 *
 * Ne crée rien : sans proposition de départ enregistrée, il n'y a pas d'écart à
 * mesurer, et un devis écrit entièrement à la main n'apprend rien sur la façon
 * de LIRE une dictée. Silencieux dans ce cas, plutôt que d'inventer une leçon.
 */
export async function noterRetenu(ctx: Ctx, chantierId: string, retenu: LigneApprise[]): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(correctionsDictee)
      .set({ retenu, updatedAt: sql`now()` })
      .where(eq(correctionsDictee.chantierId, chantierId));
  });
}

/**
 * Les corrections qui enseignent quelque chose, les plus récentes d'abord.
 *
 * **Un devis accepté tel quel n'est pas une correction, c'est un accord.** Le
 * garder noierait les vrais enseignements sous des exemples qui ne montrent
 * aucun écart — et un modèle à qui l'on montre cinq fois « proposé = retenu »
 * apprend surtout à ne rien changer.
 *
 * Le tri se fait donc à la LECTURE et non à l'écriture : la photographie de
 * départ doit exister pendant que le patron retouche, même si à cet instant
 * elle n'apprend encore rien.
 */
export async function correctionsRecentes(ctx: Ctx, limite = 5): Promise<CorrectionApprise[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select()
      .from(correctionsDictee)
      .orderBy(sql`${correctionsDictee.updatedAt} DESC`)
      .limit(limite * 4);
    return lignes
      .map((l) => ({
        dictee: l.dictee,
        propose: (l.propose as LigneApprise[]) ?? [],
        retenu: (l.retenu as LigneApprise[]) ?? [],
      }))
      .filter((c) => !memesLignes(c.propose, c.retenu))
      .slice(0, limite);
  });
}

function memesLignes(a: LigneApprise[], b: LigneApprise[]): boolean {
  if (a.length !== b.length) return false;
  const cle = (l: LigneApprise) => `${l.libelle.trim().toLowerCase()}|${l.montant}`;
  const x = a.map(cle).sort();
  const y = b.map(cle).sort();
  return x.every((v, i) => v === y[i]);
}
