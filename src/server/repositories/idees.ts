import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { entreprises, idees, ideesAlertes, membresEntreprise, users } from "../db/schema";
import { withEntreprise } from "../db/with-entreprise";
import { withEditeur } from "../editeur";
import { envoyerCourriel } from "../courriel";
import { logger } from "../logger";
import { CONTACT_ATLAS } from "../../lib/contact-atlas";
import { estRole, type Role } from "../../lib/acces-roles";
import {
  courrielDAlerte,
  nomDeLAuteur,
  texteDIdeeValide,
  ideeFaiteRecemment,
  REPONSE_IDEE_MAX,
  type EtatIdee,
  type TriIdee,
} from "../../lib/idees";
import { jourIso } from "../../lib/jour";
import type { Ctx } from "./context";

/**
 * UNE IDÉE POUR L'APPLI — l'envoi par l'artisan, le tri par l'éditeur
 * (migration 0167, sa planche du 5 novembre 2026).
 *
 * **Deux portes, et elles ne se mélangent pas.** Ce que fait l'artisan passe
 * par `withEntreprise` : il n'écrit et ne lit que dans son entreprise. Ce que
 * fait l'éditeur passe par `withEditeur` : il lit toutes les idées, et rien
 * d'autre de chez personne.
 */

/** Ce que l'artisan relit de ses idées. */
export type MonIdee = {
  id: string;
  texte: string;
  etat: EtatIdee;
  reponse: string | null;
  envoyeeLe: Date;
  traiteeLe: Date | null;
};

/** Ce que l'éditeur lit d'une idée reçue : qui, quel jour, quoi. */
export type IdeeRecue = MonIdee & {
  auteurNom: string;
  auteurRole: Role;
  entrepriseNom: string;
};

export type ResultatEnvoiIdee = { ok: true; idee: MonIdee } | { ok: false; message: string };

/**
 * **Envoyer une idée.** Le nom de l'auteur, son rôle et le nom de son
 * entreprise sont FIGÉS sur la ligne : l'éditeur les lit sans jamais ouvrir
 * `users` ni `entreprises` (`drizzle/0167`, « deux lecteurs »).
 *
 * Le courriel qui prévient l'éditeur part APRÈS la transaction, et son échec ne
 * défait pas l'envoi : l'idée est arrivée, elle se lira dans Atlas.
 */
export async function envoyerIdee(ctx: Ctx, brut: unknown): Promise<ResultatEnvoiIdee> {
  const valide = texteDIdeeValide(brut);
  if (!valide.ok) return valide;

  const envoi = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [qui] = await tx
      .select({
        prenom: users.prenom,
        nom: users.nom,
        email: users.email,
        role: membresEntreprise.role,
        entrepriseNom: entreprises.nom,
      })
      .from(membresEntreprise)
      .innerJoin(users, eq(users.id, membresEntreprise.utilisateurId))
      .innerJoin(entreprises, eq(entreprises.id, membresEntreprise.entrepriseId))
      .where(and(eq(membresEntreprise.utilisateurId, ctx.utilisateurId), eq(membresEntreprise.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    // `withEntreprise` a déjà vérifié l'adhésion : une ligne absente ici serait
    // un rôle inconnu en base, et l'on ne fabrique pas d'auteur.
    if (!qui || !estRole(qui.role)) return null;

    const [ligne] = await tx
      .insert(idees)
      .values({
        entrepriseId: ctx.entrepriseId,
        auteurId: ctx.utilisateurId,
        auteurNom: nomDeLAuteur(qui),
        auteurRole: qui.role,
        entrepriseNom: (qui.entrepriseNom?.trim() || "Une entreprise").slice(0, 200),
        texte: valide.texte,
      })
      .returning();
    return { ligne, entrepriseNom: ligne.entrepriseNom };
  });

  if (!envoi) {
    logger.warn("idee_sans_auteur", { entrepriseId: ctx.entrepriseId });
    return { ok: false, message: "Votre compte n'a pas pu être relu. L'idée n'est pas partie." };
  }

  await prevenirLEditeur(envoi.entrepriseNom);
  return { ok: true, idee: versMonIdee(envoi.ligne) };
}

/**
 * **Un seul courriel par journée.** La première idée du jour prévient, les
 * suivantes se taisent : la table `idees_alertes` ne porte qu'une date, sans
 * isolation, comme `termes_metier` (rien à y isoler).
 *
 * Le jour ne se marque qu'APRÈS un envoi réussi : un courriel refusé laisse la
 * prochaine idée réessayer. Deux idées à la même seconde peuvent donc écrire
 * deux fois ; c'est le côté sûr.
 */
async function prevenirLEditeur(entrepriseNom: string): Promise<void> {
  const jour = jourIso(new Date());
  try {
    const [deja] = await db.select({ jour: ideesAlertes.jour }).from(ideesAlertes).where(eq(ideesAlertes.jour, jour)).limit(1);
    if (deja) return;
    const resultat = await envoyerCourriel({ a: CONTACT_ATLAS, ...courrielDAlerte(entrepriseNom) });
    if (!resultat.ok) {
      logger.warn("idee_courriel_refuse", { raison: resultat.raison });
      return;
    }
    await db.insert(ideesAlertes).values({ jour }).onConflictDoNothing();
  } catch (erreur) {
    // L'idée est en base : une panne du courriel ne doit pas la faire croire
    // perdue. Elle se journalise, et la suivante réessaiera.
    logger.error("idee_courriel_panne", { erreur });
  }
}

/** Les idées de la personne connectée, les plus récentes d'abord. */
export async function mesIdees(ctx: Ctx): Promise<MonIdee[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select()
      .from(idees)
      .where(and(eq(idees.entrepriseId, ctx.entrepriseId), eq(idees.auteurId, ctx.utilisateurId)))
      .orderBy(desc(idees.envoyeeLe))
      .limit(100);
    return lignes.map(versMonIdee);
  });
}

/** « Votre idée est dans l'appli » sur la ligne des Réglages. */
export async function uneIdeeVientDEtreFaite(ctx: Ctx, maintenant: Date = new Date()): Promise<boolean> {
  const miennes = await mesIdees(ctx);
  return miennes.some((i) => ideeFaiteRecemment(i, maintenant));
}

/** Toutes les idées reçues, pour l'éditeur seul. */
export async function ideesRecues(ctx: Ctx): Promise<IdeeRecue[]> {
  return withEditeur(ctx, "lire les idées reçues", async (tx) => {
    const lignes = await tx.select().from(idees).orderBy(desc(idees.envoyeeLe)).limit(500);
    return lignes.map((l) => ({
      ...versMonIdee(l),
      auteurNom: l.auteurNom,
      auteurRole: l.auteurRole,
      entrepriseNom: l.entrepriseNom,
    }));
  });
}

/** Le nombre d'idées que l'éditeur n'a pas encore rangées : sa pastille des Réglages. */
export async function nombreDIdeesNouvelles(ctx: Ctx): Promise<number> {
  return withEditeur(ctx, "compter les idées reçues", async (tx) => {
    const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(idees).where(eq(idees.etat, "envoyee"));
    return r?.n ?? 0;
  });
}

/** Ranger une idée : prévue, pas prévue, faite. Rend `false` si elle n'existe plus. */
export async function rangerIdee(ctx: Ctx, id: string, tri: TriIdee): Promise<boolean> {
  return withEditeur(ctx, "ranger une idée", async (tx) => {
    const touchees = await tx
      .update(idees)
      .set({ etat: tri, traiteeLe: new Date() })
      .where(eq(idees.id, id))
      .returning({ id: idees.id });
    return touchees.length === 1;
  });
}

/** Répondre à une idée : l'artisan lit la phrase sous son idée. */
export async function repondreAIdee(
  ctx: Ctx,
  id: string,
  brut: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const valide = texteDIdeeValide(brut, REPONSE_IDEE_MAX, "Écrivez d'abord votre réponse.");
  if (!valide.ok) return valide;
  const touchee = await withEditeur(ctx, "répondre à une idée", async (tx) => {
    const lignes = await tx
      .update(idees)
      .set({ reponse: valide.texte, traiteeLe: new Date() })
      .where(eq(idees.id, id))
      .returning({ id: idees.id });
    return lignes.length === 1;
  });
  return touchee ? { ok: true } : { ok: false, message: "Cette idée n'existe plus." };
}

function versMonIdee(l: typeof idees.$inferSelect): MonIdee {
  return {
    id: l.id,
    texte: l.texte,
    etat: l.etat,
    reponse: l.reponse,
    envoyeeLe: l.envoyeeLe,
    traiteeLe: l.traiteeLe,
  };
}
