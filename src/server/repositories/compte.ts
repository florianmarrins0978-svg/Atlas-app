import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { db } from "../db/client";
import { users } from "../db/schema";
import { verifierNouveauMotDePasse, type RefusMotDePasse } from "../../lib/mot-de-passe";
import type { Ctx } from "./context";
import { motDePasseEstCeluiDe, poserNouveauCondensat } from "../secret-authentification";

/**
 * Le compte de la personne — son nom, son e-mail, son mot de passe.
 *
 * **PAS DE `withEntreprise` ICI, et ce n'est pas un oubli.** La règle du dépôt
 * (`CLAUDE.md` §3) veut que toute lecture passe par le contexte d'isolation
 * parce que toute donnée appartient à une entreprise. Celle-ci n'y appartient
 * pas : `users` est la table d'authentification, elle ne porte aucune colonne
 * `entreprise_id`, aucune politique RLS ne s'y applique, et la même personne
 * peut demain appartenir à deux entreprises sans changer de nom. Poser un
 * contexte d'entreprise pour lire son propre nom ferait croire à une isolation
 * qui n'existe pas à cet endroit — le même raisonnement que
 * `catalogue-prestations.ts` tient pour le vocabulaire partagé.
 *
 * **Ce qui remplace la RLS, et qui doit tenir sans elle : chaque requête est
 * bornée par `ctx.utilisateurId`.** Jamais par un identifiant venu de l'écran.
 * C'est la seule chose qui empêche de renommer le compte du voisin, et elle est
 * éprouvée par `scripts/test-compte-db.ts`.
 */

export type Compte = { nom: string; email: string };

export async function lireCompte(ctx: Ctx): Promise<Compte | null> {
  const [ligne] = await db
    .select({ nom: users.nom, email: users.email })
    .from(users)
    .where(eq(users.id, ctx.utilisateurId))
    .limit(1);
  if (!ligne) return null;
  return { nom: ligne.nom ?? "", email: ligne.email };
}

/**
 * Renommer son compte.
 *
 * **Le nom peut être vidé, contrairement à celui de l'entreprise.** Celui-ci ne
 * s'imprime sur aucun document : il n'est là que pour dire à qui est le compte
 * ouvert, et un compte sans nom se désigne par son e-mail.
 */
export async function renommerCompte(ctx: Ctx, nom: string): Promise<void> {
  const propre = nom.trim();
  await db
    .update(users)
    .set({ nom: propre === "" ? null : propre, updatedAt: new Date() })
    .where(eq(users.id, ctx.utilisateurId));
}

export type ResultatMotDePasse = { ok: true } | { ok: false; refus: RefusMotDePasse };

/**
 * Changer son mot de passe.
 *
 * **L'ancien est exigé, et il est vérifié ICI.** Une session ouverte sur un
 * téléphone laissé sur une table suffirait sinon à en changer — et le
 * propriétaire du compte se retrouverait dehors sans avoir rien fait.
 *
 * **Les mêmes règles qu'à l'écran**, par la même fonction pure : deux
 * rédactions finiraient par diverger, et l'artisan verrait un bouton allumé sur
 * une saisie que le serveur refuse (`CLAUDE.md` §3).
 *
 * **Ce que ce geste NE fait PAS : déconnecter les autres appareils.** C'est un
 * second geste, sur le même écran, et c'est délibéré — celui qui corrige un mot
 * de passe trop simple ne veut pas forcément se rejeter lui-même de son
 * ordinateur de bureau. L'écran le dit en toutes lettres.
 */
export async function changerMotDePasse(
  ctx: Ctx,
  actuel: string,
  nouveau: string,
  confirmation: string
): Promise<ResultatMotDePasse> {
  /**
   * **LE CONDENSAT NE SORT PLUS DE LA BASE** — constat M9, 25 août 2026. Le rôle
   * applicatif n'a plus le droit de lire `users.password_hash` ; la comparaison
   * se fait en base (`src/server/secret-authentification.ts`).
   *
   * Un compte sans mot de passe (créé pour un futur fournisseur externe) rend
   * `false` comme un mot de passe faux : le refus désigne l'actuel, qui est bien
   * ce qui manque.
   */
  if (!(await motDePasseEstCeluiDe(ctx.utilisateurId, actuel))) {
    return { ok: false, refus: "actuel-faux" };
  }

  // La comparaison « c'est déjà l'actuel » se fait sur les CLAIRS, ici, et pas
  // à l'écran : l'écran n'a jamais l'ancien mot de passe en clair — il a ce qui
  // est tapé dans le premier champ, ce qui n'est pas la même chose tant qu'on
  // ne l'a pas confronté au condensat.
  const refus = verifierNouveauMotDePasse(nouveau, confirmation, actuel);
  if (refus) return { ok: false, refus };

  /**
   * **L'ANCIEN MOT DE PASSE EST REDONNÉ ICI, et ce n'est pas une redite.** La
   * fonction en base le revérifie avant d'écrire : sans cela, elle serait une
   * porte — qui peut l'appeler poserait le condensat de son choix sur le compte
   * de son choix, puis entrerait.
   *
   * Le coût 10 est celui d'`authorize` et du jeu de démonstration : en changer
   * ici rendrait les condensats de ce chemin plus lents ou plus faibles que ceux
   * de la création, sans que rien ne le dise. Il reste calculé par
   * l'application — deux façons d'engendrer un condensat finiraient par
   * diverger.
   */
  const pose = await poserNouveauCondensat(ctx.utilisateurId, actuel, await hash(nouveau, 10));
  // Le seul cas qui reste : l'actuel a changé entre les deux vérifications —
  // une autre session vient de le modifier. Le refus désigne le bon champ.
  if (!pose) return { ok: false, refus: "actuel-faux" };
  return { ok: true };
}

/**
 * « Me déconnecter partout », y compris ici.
 *
 * Rend l'instant posé, pour que l'appelant sache ce qu'il vient d'invalider.
 *
 * **UNE SECONDE D'AVANCE, ET ELLE EST INDISPENSABLE.** Les jetons portent leur
 * émission en SECONDES entières (`iat`, la convention JWT) : un jeton émis à
 * 12:00:00,900 s'annonce à 12:00:00. Posée à la milliseconde près, la coupure
 * serait donc antérieure à sa propre seconde, et le jeton du moment
 * survivrait — le patron appuierait sur « me déconnecter partout » en restant
 * connecté sur l'appareil qui a appuyé, ce que l'écran promet explicitement.
 */
export async function deconnecterPartout(ctx: Ctx): Promise<Date> {
  const coupure = new Date(Math.ceil(Date.now() / 1000) * 1000);
  await db
    .update(users)
    .set({ jetonsValidesDepuis: coupure, updatedAt: new Date() })
    .where(eq(users.id, ctx.utilisateurId));
  return coupure;
}

/**
 * L'instant avant lequel les jetons de cette personne sont refusés.
 *
 * Lu à chaque requête par `getCurrentCtx` — d'où la sélection d'une seule
 * colonne, et l'absence de tout le reste.
 */
export async function coupureDesJetons(utilisateurId: string): Promise<Date | null> {
  const [ligne] = await db
    .select({ depuis: users.jetonsValidesDepuis })
    .from(users)
    .where(eq(users.id, utilisateurId))
    .limit(1);
  return ligne?.depuis ?? null;
}
