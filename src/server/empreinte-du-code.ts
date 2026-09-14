import { createHmac, randomInt } from "node:crypto";
import { LONGUEUR_CODE, codeNormalise } from "@/lib/code-verification";

/**
 * Ce qui, du code de vérification, a besoin de `crypto` — donc du serveur.
 * Les règles, elles, sont dans `src/lib/code-verification.ts`.
 */

/**
 * Six chiffres tirés au hasard cryptographique — jamais `Math.random`, dont la
 * suite se prédit. Les zéros de tête sont gardés : « 004213 » est un code.
 */
export function tirerUnCode(): string {
  return String(randomInt(0, 10 ** LONGUEUR_CODE)).padStart(LONGUEUR_CODE, "0");
}

/**
 * L'empreinte gardée en base à la place du code.
 *
 * **HMAC avec le secret de session, et l'identifiant du compte dans le
 * message** : une base lue ne donne pas les codes (il faut aussi le secret),
 * et deux comptes qui tirent le même code n'ont pas la même empreinte.
 */
export function empreinteDuCode(code: string, utilisateurId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${utilisateurId}:${code}`).digest("hex");
}

/** L'empreinte d'une saisie d'écran, ou `null` si ce n'est pas un code. */
export function empreinteDeLaSaisie(saisie: string, utilisateurId: string, secret: string): string | null {
  const code = codeNormalise(saisie);
  return code ? empreinteDuCode(code, utilisateurId, secret) : null;
}
