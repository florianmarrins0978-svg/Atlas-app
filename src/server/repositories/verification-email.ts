import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { codesVerificationEmail, users } from "@/server/db/schema";
import { getEnv } from "@/server/env";
import { envoyerCourriel } from "@/server/courriel";
import { logger } from "@/server/logger";
import { VALIDITE_CODE_MS, verdictDeRenvoi, verdictDuCode } from "@/lib/code-verification";
import { empreinteDeLaSaisie, empreinteDuCode, tirerUnCode } from "@/server/empreinte-du-code";

/**
 * LE CODE DE VÉRIFICATION D'UNE ADRESSE — ce qui se lit et s'écrit en base.
 *
 * Les règles (durée, essais, renvois) vivent dans `src/lib/code-verification.ts`
 * et ne sont pas redites ici. Ce dépôt tient la ligne de
 * `codes_verification_email` : il la crée à la création du compte, la relit à
 * chaque essai, l'efface quand le code est bon.
 *
 * **Le contexte est `app.utilisateur_id`**, comme pour les documents légaux :
 * la ligne lie une personne, avant toute entreprise. Sans lui, la politique
 * d'isolation ne rend rien — silencieusement.
 */

function texteDuCourriel(code: string): { objet: string; texte: string } {
  return {
    objet: `Votre code Atlas : ${code}`,
    texte:
      `Votre code : ${code}\n\n` +
      `Il vaut un quart d'heure. Si vous n'avez pas créé de compte Atlas, ignorez ce message.`,
  };
}

async function envoyerLeCode(email: string, code: string): Promise<{ ok: true } | { ok: false; refus: string }> {
  const envoi = await envoyerCourriel({ a: email, ...texteDuCourriel(code) });
  if (envoi.ok) return { ok: true };
  logger.error("Code de vérification non envoyé", { raison: envoi.raison });
  return { ok: false, refus: "Le code n’a pas pu partir. Appuyez sur « Renvoyer »." };
}

/**
 * À la création du compte : une ligne, un code, un e-mail.
 *
 * **La ligne est écrite AVANT l'envoi.** Si l'e-mail échoue, le compte reste
 * en attente — c'est le sens du geste : sans code reçu, on n'entre pas — et
 * l'écran propose de renvoyer. L'inverse (envoyer, puis écrire) laisserait un
 * compte ouvert sur un envoi réussi suivi d'une panne de base.
 */
export async function ouvrirLaVerification(
  utilisateurId: string,
  email: string
): Promise<{ ok: true } | { ok: false; refus: string }> {
  const code = tirerUnCode();
  const empreinte = empreinteDuCode(code, utilisateurId, getEnv().authSecret);
  const expireLe = new Date(Date.now() + VALIDITE_CODE_MS);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    await tx
      .insert(codesVerificationEmail)
      .values({ utilisateurId, empreinte, expireLe })
      .onConflictDoUpdate({
        target: codesVerificationEmail.utilisateurId,
        set: { empreinte, expireLe, essais: 0, envois: 1, dernierEnvoi: new Date(), creeLe: new Date() },
      });
  });
  return envoyerLeCode(email, code);
}

/**
 * L'adresse du compte, lue en base — jamais reprise de la session.
 *
 * C'est à CETTE adresse que le code part et que l'écran dit de regarder : une
 * valeur venue du navigateur pourrait faire envoyer le code ailleurs, et un
 * inconnu « vérifierait » l'adresse d'un autre.
 */
export async function adresseDuCompte(utilisateurId: string): Promise<string | null> {
  const [ligne] = await db.select({ email: users.email }).from(users).where(eq(users.id, utilisateurId)).limit(1);
  return ligne?.email ?? null;
}

/** Le compte attend-il encore son code ? C'est la question de la garde. */
export async function verificationEnAttente(utilisateurId: string): Promise<boolean> {
  const [ligne] = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    return tx
      .select({ utilisateurId: codesVerificationEmail.utilisateurId })
      .from(codesVerificationEmail)
      .where(eq(codesVerificationEmail.utilisateurId, utilisateurId))
      .limit(1);
  });
  return Boolean(ligne);
}

export type ResultatVerification =
  | { ok: true }
  | { ok: false; refus: string; codeMort: boolean };

/**
 * Le code saisi.
 *
 * **L'essai se compte AVANT de comparer**, dans la même transaction que la
 * lecture : deux soumissions simultanées ne peuvent pas partager un essai. Un
 * code bon efface la ligne et date `users.email_verified` ; un code mort
 * (expiré, cinq essais) laisse la ligne, pour que « Renvoyer » sache que le
 * compte est encore en attente.
 */
export async function verifierLeCode(utilisateurId: string, saisie: string): Promise<ResultatVerification> {
  const secret = getEnv().authSecret;
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    const [ligne] = await tx
      .select()
      .from(codesVerificationEmail)
      .where(eq(codesVerificationEmail.utilisateurId, utilisateurId))
      .for("update")
      .limit(1);
    // Pas de ligne : rien à vérifier, le compte n'attend rien. L'écran renvoie
    // alors vers l'accueil plutôt que d'accepter n'importe quel code.
    if (!ligne) return { ok: true };

    const verdict = verdictDuCode(ligne, empreinteDeLaSaisie(saisie, utilisateurId, secret));
    if (verdict.ok) {
      await tx.delete(codesVerificationEmail).where(eq(codesVerificationEmail.utilisateurId, utilisateurId));
      await tx.update(users).set({ emailVerified: new Date() }).where(eq(users.id, utilisateurId));
      return { ok: true };
    }
    await tx
      .update(codesVerificationEmail)
      .set({ essais: ligne.essais + 1 })
      .where(eq(codesVerificationEmail.utilisateurId, utilisateurId));
    return verdict;
  });
}

/**
 * « Renvoyer » : un code neuf, si les bornes le permettent.
 *
 * Le code précédent meurt à l'instant où le nouveau est écrit — deux codes
 * vivants doubleraient les chances d'un devineur. Les essais repartent de
 * zéro avec lui.
 */
export async function renvoyerLeCode(
  utilisateurId: string,
  email: string
): Promise<{ ok: true } | { ok: false; refus: string }> {
  const code = tirerUnCode();
  const empreinte = empreinteDuCode(code, utilisateurId, getEnv().authSecret);
  const maintenant = new Date();
  const decision = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    const [ligne] = await tx
      .select()
      .from(codesVerificationEmail)
      .where(eq(codesVerificationEmail.utilisateurId, utilisateurId))
      .for("update")
      .limit(1);
    if (!ligne) return { ok: false as const, refus: "Ce compte n’attend aucun code." };
    const verdict = verdictDeRenvoi(ligne, maintenant);
    if (!verdict.ok) return verdict;
    await tx
      .update(codesVerificationEmail)
      .set({
        empreinte,
        expireLe: new Date(maintenant.getTime() + VALIDITE_CODE_MS),
        essais: 0,
        envois: verdict.nouvelleFenetre ? 1 : ligne.envois + 1,
        dernierEnvoi: maintenant,
        ...(verdict.nouvelleFenetre ? { creeLe: maintenant } : {}),
      })
      .where(eq(codesVerificationEmail.utilisateurId, utilisateurId));
    return { ok: true as const };
  });
  if (!decision.ok) return decision;
  return envoyerLeCode(email, code);
}
