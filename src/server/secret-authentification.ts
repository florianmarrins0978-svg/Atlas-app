import { sql } from "drizzle-orm";
import { db } from "./db/client";

/**
 * Le mot de passe se vérifie EN BASE — le condensat n'en sort jamais.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE FICHIER GARANTIT, et c'est la seule chose qui compte :**
 *
 * > Une erreur future dans une requête métier ne suffit plus à exposer les
 * > condensats de tous les utilisateurs.
 *
 * `atlas_app` — le rôle sous lequel tourne l'application — n'a **plus** le droit
 * de lire `users.password_hash`, ni de l'écrire. Une injection SQL dans du code
 * métier ne rendrait donc rien, même en visant la colonne directement. Ce qui
 * lui reste est le droit d'appeler les trois fonctions ci-dessous, qui rendent
 * un identifiant ou un booléen, jamais un condensat
 * (`drizzle/0064_secret_authentification.sql`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI N'EST PAS PROTÉGÉ POUR AUTANT, dit franchement.** Ce n'est pas une
 * défense contre l'exécution de code arbitraire sur le serveur : qui obtient
 * cela peut appeler ces fonctions autant qu'il veut. Ce qu'on referme est le
 * chemin de loin le plus probable — une requête métier fautive, un jour, dans
 * un dépôt qui en compte des centaines.
 *
 * **Et une fonction reste éprouvable par force brute**, comme la page de
 * connexion : c'est `C1` (cadence et compte de tentatives) qui borne cela, pas
 * ce fichier.
 */

/**
 * L'identifiant de qui possède ce couple, ou `null`.
 *
 * Rendre `null` couvre trois cas qu'on ne distingue **délibérément pas** :
 * l'adresse est inconnue, le compte n'a pas de mot de passe, le mot de passe est
 * faux. Les séparer dirait à un inconnu quelles adresses existent.
 */
export async function identifiantSiMotDePasseJuste(
  email: string,
  motDePasse: string
): Promise<string | null> {
  const resultat = await db.execute(
    sql`SELECT public.verifier_mot_de_passe(${email}, ${motDePasse}) AS id`
  );
  return premiereLigne<{ id: string | null }>(resultat)?.id ?? null;
}

/** Le mot de passe d'un utilisateur CONNU est-il celui-là ? */
export async function motDePasseEstCeluiDe(
  utilisateurId: string,
  motDePasse: string
): Promise<boolean> {
  const resultat = await db.execute(
    sql`SELECT public.verifier_mot_de_passe_de(${utilisateurId}::uuid, ${motDePasse}) AS ok`
  );
  return premiereLigne<{ ok: boolean | null }>(resultat)?.ok === true;
}

/**
 * Poser un nouveau condensat — **l'ancien mot de passe est exigé**.
 *
 * Rend `false` si l'ancien ne correspond pas. La fonction en base le revérifie :
 * sans cela, qui peut l'appeler poserait le condensat de son choix sur le compte
 * de son choix.
 *
 * Le condensat est calculé par l'appelant, avec `bcryptjs` — la règle du coût
 * vit là où elle a toujours vécu, et n'est pas recopiée en SQL.
 */
export async function poserNouveauCondensat(
  utilisateurId: string,
  ancienMotDePasse: string,
  nouveauCondensat: string
): Promise<boolean> {
  const resultat = await db.execute(
    sql`SELECT public.changer_mot_de_passe(${utilisateurId}::uuid, ${ancienMotDePasse}, ${nouveauCondensat}) AS ok`
  );
  return premiereLigne<{ ok: boolean | null }>(resultat)?.ok === true;
}

/**
 * `db.execute` rend selon le pilote soit un tableau, soit un objet portant
 * `rows`. On lit les deux plutôt que de parier sur l'un — un pari qui ne se
 * verrait qu'à la première connexion en production.
 */
function premiereLigne<T>(resultat: unknown): T | undefined {
  if (Array.isArray(resultat)) return resultat[0] as T | undefined;
  const rows = (resultat as { rows?: unknown[] })?.rows;
  return Array.isArray(rows) ? (rows[0] as T | undefined) : undefined;
}
