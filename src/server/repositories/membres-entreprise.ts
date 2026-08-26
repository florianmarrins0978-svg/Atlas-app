import { and, eq, ne } from "drizzle-orm";
import { hash } from "bcryptjs";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { equipes, membresEntreprise, users } from "../db/schema";
import type { Ctx } from "./context";
import type { PorteePlanning, Role } from "@/lib/acces-roles";
import { LONGUEUR_MINIMALE } from "@/lib/mot-de-passe";
import {
  adresseNormalisee,
  refusDeLAcces,
  refusDeLaPortee,
  refusDuChangementDeRole,
  refusDuRetrait,
  type RefusAcces,
} from "@/lib/donner-un-acces";

/** Une personne qui a un accès à cette entreprise, telle que l'écran la lit. */
export type Acces = {
  /** L'id de l'ADHÉSION, pas du compte : c'est elle qu'on change et qu'on retire. */
  id: string;
  utilisateurId: string;
  nom: string | null;
  email: string;
  role: Role;
  porteePlanning: PorteePlanning;
  equipeId: string | null;
  /** Le rang de la file du planning rattachée, pour l'afficher sans second appel. */
  equipeRang: number | null;
  createdAt: Date;
};

export type ResultatAcces = { ok: true } | { ok: false; refus: RefusAcces };

/**
 * QUI A ACCÈS À CETTE ENTREPRISE.
 *
 * **La jointure sur `users` ne fuit pas**, et il faut le dire parce que `users`
 * ne porte aucune politique d'isolation : cette table précède l'entreprise (on
 * ne sait pas encore de quelle société il s'agit au moment où l'on cherche un
 * compte). Ce qui borne la lecture ici, c'est `membres_entreprise`, qui est
 * scopée par RLS : aucune ligne d'une autre société n'entre dans la jointure,
 * donc aucun compte d'une autre société n'en sort.
 */
export async function listerAcces(ctx: Ctx): Promise<Acces[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({
        id: membresEntreprise.id,
        utilisateurId: membresEntreprise.utilisateurId,
        nom: users.nom,
        email: users.email,
        role: membresEntreprise.role,
        porteePlanning: membresEntreprise.porteePlanning,
        equipeId: membresEntreprise.equipeId,
        equipeRang: equipes.rang,
        createdAt: membresEntreprise.createdAt,
      })
      .from(membresEntreprise)
      .innerJoin(users, eq(users.id, membresEntreprise.utilisateurId))
      .leftJoin(equipes, eq(equipes.id, membresEntreprise.equipeId))
      .where(eq(membresEntreprise.entrepriseId, ctx.entrepriseId))
      // Le patron d'abord — c'est lui qu'on cherche en ouvrant l'écran —, puis
      // par ancienneté : l'ordre d'arrivée est celui qu'on a en tête.
      .orderBy(membresEntreprise.createdAt);

    return lignes.sort((a, b) =>
      a.role === b.role ? 0 : a.role === "proprietaire" ? -1 : b.role === "proprietaire" ? 1 : 0
    );
  });
}

/**
 * DONNER UN ACCÈS — c'est-à-dire créer un COMPTE, puis l'attacher.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Deux écritures, deux tables, et elles ne peuvent pas vivre dans la même
 * transaction d'isolation.** `users` précède l'entreprise et n'a pas de contexte
 * RLS ; `membres_entreprise` en exige un. La création du compte se fait donc
 * hors `withEntreprise`, l'attachement dedans.
 *
 * **Conséquence assumée, et écrite pour qu'on ne la découvre pas en panne :**
 * si l'attachement échoue, un compte reste en base sans aucune adhésion. Il
 * n'ouvre rien — `getCurrentCtx` refuse une session sans entreprise —, et la
 * même adresse ne pourra pas être redonnée tant qu'il traîne. C'est un défaut
 * visible et réparable ; l'alternative — désactiver l'isolation le temps
 * d'écrire deux lignes — est celle que `CLAUDE.md` §4 interdit.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI UN MOT DE PASSE PROVISOIRE, ET PAS UNE INVITATION PAR E-MAIL.**
 *
 * Atlas n'envoie aucun courriel à un utilisateur d'Atlas aujourd'hui (les envois
 * existants vont au CLIENT de l'artisan, par un canal qu'il a choisi). Un
 * parcours d'invitation demanderait une table de jetons, une expiration, une
 * page publique de plus — et surtout un envoi qui, s'il n'arrive pas, laisse le
 * salarié dehors sans que personne le sache. Le patron, lui, est à côté de son
 * salarié : il tape un mot de passe et le lui dit. Le salarié le change ensuite
 * dans « Mon compte », qui lui est ouvert.
 *
 * **Le mot de passe suit la MÊME règle que partout ailleurs** (douze
 * caractères) : un compte de salarié ouvre le planning de l'entreprise, il n'a
 * aucune raison d'être moins tenu que celui du patron.
 */
export async function donnerUnAcces(
  ctx: Ctx,
  saisie: { nom: string; email: string; motDePasse: string; role: Role }
): Promise<ResultatAcces> {
  const email = adresseNormalisee(saisie.email);

  const [existant] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  const refus = refusDeLAcces({
    nom: saisie.nom,
    email: saisie.email,
    role: saisie.role,
    motDePasse: saisie.motDePasse,
    longueurMinimale: LONGUEUR_MINIMALE,
    emailDejaPris: Boolean(existant),
  });
  if (refus) return { ok: false, refus };

  // Coût 10 : celui d'`authorize`, du changement de mot de passe et du jeu de
  // démonstration. En changer ici rendrait ce chemin plus lent ou plus faible
  // que les autres, sans que rien ne le dise.
  const passwordHash = await hash(saisie.motDePasse, 10);
  const [compte] = await db
    .insert(users)
    .values({ email, nom: saisie.nom.trim(), passwordHash })
    .returning({ id: users.id });

  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.insert(membresEntreprise).values({
      entrepriseId: ctx.entrepriseId,
      utilisateurId: compte.id,
      role: saisie.role,
      // **Le défaut est « tout », et c'est sa décision du 13 août 2026** : un
      // salarié invité ce matin voit le planning entier tant que son patron n'a
      // rien resserré. Restreindre est un geste, pas un état de départ.
      porteePlanning: "tout",
    });
  });

  return { ok: true };
}

/**
 * CHANGER LE RÔLE D'UNE PERSONNE.
 *
 * **Le compteur de patrons se lit AVANT, dans la même seconde**, et il n'y a
 * pas de course à craindre ici : deux patrons qui se rétrograderaient
 * simultanément est un cas qui ne se produit pas sur le téléphone d'un artisan,
 * et le pire qu'il produirait — une entreprise sans patron — se répare en base.
 * Poser un verrou pour cela coûterait plus cher que le défaut.
 */
export async function changerLeRole(ctx: Ctx, accesId: string, roleVoulu: string): Promise<ResultatAcces> {
  const liste = await listerAcces(ctx);
  const cible = liste.find((l) => l.id === accesId);
  // Une adhésion qui n'est pas dans cette entreprise n'existe pas pour nous.
  if (!cible) return { ok: false, refus: "role-inconnu" };

  const refus = refusDuChangementDeRole({
    roleActuel: cible.role,
    roleVoulu,
    nombreDePatrons: liste.filter((l) => l.role === "proprietaire").length,
  });
  if (refus) return { ok: false, refus };

  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(membresEntreprise)
      .set({
        role: roleVoulu as Role,
        // **Un rôle qui n'est plus salarié perd sa portée resserrée.** Un
        // commercial voit le planning entier : lui laisser une restriction de
        // salarié lui cacherait des chantiers sans que rien ne l'explique, et
        // le patron n'aurait aucune raison d'aller la chercher.
        ...(roleVoulu === "salarie" ? {} : { porteePlanning: "tout" as const, equipeId: null }),
      })
      .where(and(eq(membresEntreprise.id, accesId), eq(membresEntreprise.entrepriseId, ctx.entrepriseId)));
  });

  return { ok: true };
}

/**
 * CE QU'IL VOIT DU PLANNING — tout, ou les chantiers de son équipe.
 *
 * Sa règle du 13 août 2026 : *« Accès à tout, mais le patron choisira s'il a
 * accès qu'à ses chantiers ou à tout. »* Un réglage par PERSONNE : deux salariés
 * peuvent ne pas voir la même chose.
 */
export async function changerLaPortee(
  ctx: Ctx,
  accesId: string,
  portee: string,
  equipeId: string | null
): Promise<ResultatAcces> {
  const refus = refusDeLaPortee({ portee, equipeId });
  if (refus) return { ok: false, refus };

  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(membresEntreprise)
      .set({
        porteePlanning: portee as PorteePlanning,
        // « Tout » efface l'équipe rattachée : la garder ferait resurgir une
        // restriction que personne n'a redemandée le jour où l'on resserre à
        // nouveau.
        equipeId: portee === "ses_equipes" ? equipeId : null,
      })
      .where(and(eq(membresEntreprise.id, accesId), eq(membresEntreprise.entrepriseId, ctx.entrepriseId)));
  });

  return { ok: true };
}

/**
 * RETIRER UN ACCÈS.
 *
 * **Le COMPTE n'est pas supprimé, seulement l'adhésion.** Trois raisons, et la
 * troisième suffit : les chantiers, devis et clients qu'il a créés le
 * référencent (`created_by`), et l'effacer les emporterait ou les casserait.
 * Ensuite, un même compte peut appartenir à deux entreprises. Enfin, un accès
 * retiré par erreur se redonne ; un compte effacé ne revient pas.
 *
 * **Et le retrait prend effet à la requête suivante, sans rien de plus.** Sans
 * adhésion, `getCurrentCtx` ne trouve plus d'entreprise et la session ne mène
 * plus nulle part — pas besoin d'invalider un jeton, l'adhésion est revalidée à
 * chaque appel (`with-entreprise.ts`).
 */
export async function retirerUnAcces(ctx: Ctx, accesId: string): Promise<ResultatAcces> {
  const liste = await listerAcces(ctx);
  const cible = liste.find((l) => l.id === accesId);
  if (!cible) return { ok: false, refus: "role-inconnu" };

  const refus = refusDuRetrait({
    cible: cible.utilisateurId,
    soi: ctx.utilisateurId,
    roleCible: cible.role,
    nombreDePatrons: liste.filter((l) => l.role === "proprietaire").length,
  });
  if (refus) return { ok: false, refus };

  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .delete(membresEntreprise)
      .where(and(eq(membresEntreprise.id, accesId), eq(membresEntreprise.entrepriseId, ctx.entrepriseId)));
  });

  return { ok: true };
}

/**
 * Attacher un compte DÉJÀ EXISTANT — le seul chemin de la création d'entreprise
 * et du jeu de démonstration, jamais un geste d'écran.
 */
export async function ajouterMembre(ctx: Ctx, utilisateurId: string, role: Role = "salarie") {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(membresEntreprise)
      .values({ entrepriseId: ctx.entrepriseId, utilisateurId, role })
      .returning();
    return row;
  });
}

export async function listerMembres(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(membresEntreprise).where(eq(membresEntreprise.entrepriseId, ctx.entrepriseId))
  );
}

export async function retirerMembre(ctx: Ctx, utilisateurId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .delete(membresEntreprise)
      .where(
        and(
          eq(membresEntreprise.utilisateurId, utilisateurId),
          // **Le retrait était scopé au SEUL utilisateur, sans l'entreprise.**
          // La RLS le rattrapait — la politique d'isolation borne le DELETE —,
          // mais rien ne le disait dans la requête, et une lecture rapide
          // laissait croire qu'on effaçait toutes les adhésions de la personne.
          eq(membresEntreprise.entrepriseId, ctx.entrepriseId)
        )
      );
  });
}

/** Les files du planning, pour le choix d'équipe de la portée resserrée. */
export async function equipesPourRattachement(ctx: Ctx): Promise<{ id: string; rang: number; nom: string | null }[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({ id: equipes.id, rang: equipes.rang, nom: equipes.nom })
      .from(equipes)
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), ne(equipes.rang, -1)))
      .orderBy(equipes.rang)
  );
}
