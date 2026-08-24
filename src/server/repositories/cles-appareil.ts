import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { clesAppareil, users } from "../db/schema";
import { CLES_MAX, type CleAppareil } from "../../lib/cle-appareil";

/**
 * Les clés d'appareil — lecture et écriture.
 *
 * **PAS de `withEntreprise` ICI, et ce n'est pas un oubli** (même raisonnement
 * que `compte.ts` et `tentatives-connexion.ts`) : au moment où l'on vérifie une
 * clé, aucune session n'existe encore — c'est justement ce qu'on établit. Il
 * n'y a donc aucune entreprise dont poser le contexte, et prétendre le
 * contraire ferait croire à un cloisonnement qui n'existe pas ici
 * (`CLAUDE.md` §4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI REMPLACE LA RLS, et qui doit tenir sans elle.** Toute requête vise
 * un identifiant EXACT — la clé, ou l'utilisateur —, et **chaque écriture porte
 * `utilisateur_id` dans son `WHERE`**, y compris quand l'identifiant suffirait
 * déjà à désigner la ligne. C'est la ceinture qui remplace ce que la RLS ferait
 * ailleurs : sans elle, un identifiant de clé mal contrôlé quelque part
 * laisserait retirer la clé de quelqu'un d'autre.
 *
 * Cette table ne se parcourt jamais dans son entier.
 */

/** Les clés d'un compte, la plus ancienne d'abord — l'ordre de l'écran. */
export async function listerCles(utilisateurId: string): Promise<CleAppareil[]> {
  const lignes = await db
    .select({
      id: clesAppareil.id,
      nomAppareil: clesAppareil.nomAppareil,
      creeLe: clesAppareil.creeLe,
      dernierUsageLe: clesAppareil.dernierUsageLe,
    })
    .from(clesAppareil)
    .where(eq(clesAppareil.utilisateurId, utilisateurId))
    .orderBy(asc(clesAppareil.creeLe));
  return lignes;
}

/** Les identifiants déjà posés — pour ne pas enregistrer deux fois le même appareil. */
export async function identifiantsDe(utilisateurId: string): Promise<string[]> {
  const lignes = await db
    .select({ identifiantCle: clesAppareil.identifiantCle })
    .from(clesAppareil)
    .where(eq(clesAppareil.utilisateurId, utilisateurId));
  return lignes.map((l) => l.identifiantCle);
}

export type CleTrouvee = {
  id: string;
  identifiantCle: string;
  utilisateurId: string;
  email: string;
  nom: string | null;
  clePublique: string;
  compteur: number;
};

/**
 * Retrouver un compte À PARTIR de la clé qui vient de signer.
 *
 * C'est le seul endroit d'Atlas où l'on part d'autre chose qu'une adresse pour
 * savoir qui est en face — et c'est ce qui permet à l'artisan de n'avoir rien à
 * taper. La jointure sur `users` évite un second aller-retour : on a besoin de
 * l'adresse dans la foulée, pour le jeton.
 */
export async function cleParIdentifiant(identifiantCle: string): Promise<CleTrouvee | null> {
  const [ligne] = await db
    .select({
      id: clesAppareil.id,
      identifiantCle: clesAppareil.identifiantCle,
      utilisateurId: clesAppareil.utilisateurId,
      email: users.email,
      nom: users.nom,
      clePublique: clesAppareil.clePublique,
      compteur: clesAppareil.compteur,
    })
    .from(clesAppareil)
    .innerJoin(users, eq(users.id, clesAppareil.utilisateurId))
    .where(eq(clesAppareil.identifiantCle, identifiantCle))
    .limit(1);
  return ligne ?? null;
}

export type AjoutCle = { ok: true; id: string } | { ok: false; refus: "trop-de-cles" | "deja-enregistree" };

/**
 * Poser une clé.
 *
 * **La borne et l'écriture dans la MÊME transaction, le compte verrouillé.**
 * Deux enregistrements simultanés compteraient chacun `CLES_MAX - 1` clés et
 * passeraient tous les deux : la borne ne bornerait plus rien. Le verrou sur la
 * ligne de `users` fait attendre le second — c'est la ligne que les deux
 * touchent, et il n'y en a pas d'autre à verrouiller quand la table est vide.
 */
export async function ajouterCle(entree: {
  utilisateurId: string;
  identifiantCle: string;
  clePublique: string;
  compteur: number;
  nomAppareil: string;
}): Promise<AjoutCle> {
  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, entree.utilisateurId)).limit(1).for("update");

    const [{ combien }] = await tx
      .select({ combien: sql<number>`count(*)::int` })
      .from(clesAppareil)
      .where(eq(clesAppareil.utilisateurId, entree.utilisateurId));
    if (combien >= CLES_MAX) return { ok: false, refus: "trop-de-cles" } as const;

    const [deja] = await tx
      .select({ id: clesAppareil.id })
      .from(clesAppareil)
      .where(eq(clesAppareil.identifiantCle, entree.identifiantCle))
      .limit(1);
    if (deja) return { ok: false, refus: "deja-enregistree" } as const;

    const [pose] = await tx
      .insert(clesAppareil)
      .values({
        utilisateurId: entree.utilisateurId,
        identifiantCle: entree.identifiantCle,
        clePublique: entree.clePublique,
        compteur: entree.compteur,
        nomAppareil: entree.nomAppareil,
      })
      .returning({ id: clesAppareil.id });
    return { ok: true, id: pose.id } as const;
  });
}

/**
 * Après une connexion réussie : le compteur avance, l'usage se date.
 *
 * **Ne lève jamais.** Une connexion qui vient d'être vérifiée ne doit pas
 * échouer sur une mise à jour de confort. Ce qu'on perdrait alors, c'est la
 * détection d'un rejeu au coup suivant — et cette détection n'est déjà qu'un
 * garde-fou de second rang (voir `estRejeu`).
 */
export async function noterUsage(id: string, compteur: number): Promise<void> {
  try {
    await db
      .update(clesAppareil)
      .set({ compteur, dernierUsageLe: new Date() })
      .where(eq(clesAppareil.id, id));
  } catch (erreur) {
    // Journalisé plutôt que tu : un défaut muet se répare à l'aveugle
    // (`AGENTS.md`).
    console.error("[cles-appareil] compteur non mis à jour", erreur);
  }
}

/**
 * Retirer une clé — et **jamais celle d'un autre**.
 *
 * `utilisateur_id` est dans le `WHERE` alors que l'identifiant suffirait à
 * désigner la ligne : c'est délibéré. Aucune RLS ne couvre cette table, donc
 * rien d'autre n'empêcherait un identifiant venu d'ailleurs de retirer la clé
 * d'un autre compte. Rend `false` quand rien n'a été touché, plutôt que de
 * laisser croire à une suppression.
 */
export async function retirerCle(utilisateurId: string, id: string): Promise<boolean> {
  const retires = await db
    .delete(clesAppareil)
    .where(and(eq(clesAppareil.id, id), eq(clesAppareil.utilisateurId, utilisateurId)))
    .returning({ id: clesAppareil.id });
  return retires.length > 0;
}

/** Renommer un appareil — même précaution que ci-dessus. */
export async function renommerCle(utilisateurId: string, id: string, nom: string): Promise<boolean> {
  const touches = await db
    .update(clesAppareil)
    .set({ nomAppareil: nom })
    .where(and(eq(clesAppareil.id, id), eq(clesAppareil.utilisateurId, utilisateurId)))
    .returning({ id: clesAppareil.id });
  return touches.length > 0;
}
