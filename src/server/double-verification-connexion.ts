import { cookies, headers } from "next/headers";
import { CredentialsSignin } from "next-auth";
import { DUREE_APPAREIL_RETENU_MS, DUREE_CONNEXION_EN_ATTENTE_MS } from "@/lib/double-verification";
import {
  codeExige,
  consommerConnexionEnAttente,
  ouvrirConnexionEnAttente,
  retenirAppareil,
} from "@/server/repositories/double-verification";

/**
 * LA DOUBLE VÉRIFICATION À LA PORTE : ce qui relie le code à la connexion.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le code s'exige DANS `authorize`, jamais avant ni après.** L'écran de
 * connexion n'est pas le seul à appeler Auth.js : le mot de passe oublié
 * reconnecte aussi, et d'autres viendront. Posée dans une action, la règle
 * s'oublierait dans la suivante ; dans `authorize`, elle tient pour tous. Les
 * routes d'Auth.js, elles, sont murées
 * (`src/app/api/auth/[...nextauth]/route.ts`), `second-facteur` compris.
 *
 * **Aucune session n'existe entre le mot de passe et le code.** Le mot de passe
 * juste ouvre une « connexion en attente » (cinq minutes, cinq essais) dont le
 * navigateur garde le jeton dans un cookie `httpOnly`. Le code passe ensuite
 * par un second fournisseur, `second-facteur`, qui seul ouvre la session. Une
 * session « à moitié entrée » aurait demandé une garde sur chaque écran, chaque
 * action et chaque route : un oubli, et elle entrait.
 *
 * **Face ID n'y passe jamais** : il vaut déjà deux preuves.
 */

export const COOKIE_ATTENTE = "atlas-connexion-en-attente";
export const COOKIE_APPAREIL = "atlas-appareil-retenu";

/** Le mot de passe est juste ; il faut maintenant le code. */
export class CodeRequis extends CredentialsSignin {
  code = "code-requis";
}

/** Le code tapé n'est pas le bon. */
export class CodeFaux extends CredentialsSignin {
  code = "code-faux";
}

/** Plus de connexion en attente : cinq minutes passées, ou cinq essais. */
export class AttenteExpiree extends CredentialsSignin {
  code = "attente-expiree";
}

/**
 * `Secure` suit le protocole que le navigateur emploie vraiment : posé sur du
 * HTTP clair, le cookie serait jeté et la connexion tournerait en rond.
 */
async function protocoleSur(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https" || (h.get("origin") ?? "").startsWith("https://");
}

/**
 * Le mot de passe (ou Google, ou Apple) vient de réussir : faut-il un code ?
 * Si oui, la connexion en attente est ouverte et son cookie posé.
 */
export async function attenteSiCodeExige(utilisateurId: string): Promise<boolean> {
  const boite = await cookies();
  if (!(await codeExige(utilisateurId, boite.get(COOKIE_APPAREIL)?.value))) return false;
  const jeton = await ouvrirConnexionEnAttente(utilisateurId);
  boite.set(COOKIE_ATTENTE, jeton, {
    httpOnly: true,
    // `lax` et non `strict` : après Google ou Apple, le navigateur revient de
    // chez eux, et un cookie strict ne serait pas renvoyé à cette arrivée-là.
    sameSite: "lax",
    secure: await protocoleSur(),
    path: "/",
    maxAge: DUREE_CONNEXION_EN_ATTENTE_MS / 1000,
  });
  return true;
}

/** Y a-t-il une connexion en attente du code, dans ce navigateur ? */
export async function connexionEnAttente(): Promise<boolean> {
  return Boolean((await cookies()).get(COOKIE_ATTENTE)?.value);
}

/** L'identifiant de la personne qui attend, pour compter ses échecs. */
export async function proprietaireDeLAttente(): Promise<string | null> {
  const jeton = (await cookies()).get(COOKIE_ATTENTE)?.value ?? "";
  const point = jeton.indexOf(".");
  return point > 0 ? jeton.slice(0, point) : null;
}

/**
 * Le cœur du fournisseur `second-facteur` : rend l'identifiant si le code
 * ouvre, lève sinon. Le cookie part dès qu'il n'a plus d'usage.
 */
export async function verifierLeCodeEnAttente(saisie: string): Promise<string> {
  const boite = await cookies();
  const verdict = await consommerConnexionEnAttente(boite.get(COOKIE_ATTENTE)?.value, saisie);
  if (verdict.ok) {
    boite.delete(COOKIE_ATTENTE);
    return verdict.utilisateurId;
  }
  if (verdict.refus === "expiree") {
    boite.delete(COOKIE_ATTENTE);
    throw new AttenteExpiree();
  }
  throw new CodeFaux();
}

/** « Ne plus demander sur cet appareil » : trente jours, sa réponse « oui ». */
export async function retenirCetAppareil(utilisateurId: string): Promise<void> {
  const { jeton } = await retenirAppareil(utilisateurId);
  (await cookies()).set(COOKIE_APPAREIL, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: await protocoleSur(),
    path: "/",
    maxAge: DUREE_APPAREIL_RETENU_MS / 1000,
  });
}
