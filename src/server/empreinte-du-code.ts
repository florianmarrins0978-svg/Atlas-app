import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
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

/**
 * Le jeton du mot de passe oublié : ce que rend un code juste, et ce qu'exige
 * la pose du nouveau mot de passe.
 *
 * 32 octets ne se devinent pas, donc un SHA-256 simple suffit pour la base
 * (contrairement aux six chiffres du code, qu'un HMAC doit protéger). La base
 * n'en garde que l'empreinte : lue par-dessus l'épaule, elle ne rend rien.
 */
export function tirerUnJeton(): string {
  return randomBytes(32).toString("base64url");
}

export function empreinteDuJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}
