"use server";

import { eq } from "drizzle-orm";
import { AuthError, type CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { rendreLimite } from "@/server/rate-limit";
import { accueilPourEmail } from "@/server/accueil-apres-connexion";
import { messageAttente, porteeTemporisation } from "@/lib/tentatives-connexion";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { attenteAvantEssai, noterEchec, oublierEchecs } from "@/server/repositories/tentatives-connexion";
import { proprietaireDeLAttente, retenirCetAppareil } from "@/server/double-verification-connexion";

export type EtatCode = { erreur?: string; recommencer?: boolean };

const EXPIREE = "Le délai est passé. Entrez de nouveau votre mot de passe.";

/**
 * Le code de l'appli d'authentification, ou un code de secours.
 *
 * **Un code faux compte comme un mot de passe faux** : même compteur, même
 * temporisation (`src/lib/tentatives-connexion.ts`). Sans cela, quelqu'un qui
 * connaît le mot de passe enchaînerait les connexions en attente, cinq codes
 * par tour, sans jamais ralentir.
 */
export async function codeAction(_etat: EtatCode | undefined, formData: FormData): Promise<EtatCode> {
  const code = String(formData.get("code") ?? "");
  const retenir = formData.get("retenir") === "on";

  const utilisateurId = await proprietaireDeLAttente();
  if (!utilisateurId) return { erreur: EXPIREE, recommencer: true };
  const [compte] = await db.select({ email: users.email }).from(users).where(eq(users.id, utilisateurId)).limit(1);
  if (!compte) return { erreur: EXPIREE, recommencer: true };
  const email = compte.email.trim().toLowerCase();

  const horsProduction = horsProductionReelle();
  const source = await sourceDuVisiteur(horsProduction);
  const portee = porteeTemporisation({ email, source, horsProduction });
  const attente = await attenteAvantEssai(portee);
  if (attente !== null) return { erreur: messageAttente(attente) };

  try {
    await signIn("second-facteur", { code, redirect: false });
  } catch (err) {
    if (err instanceof AuthError && err.type === "CredentialsSignin") {
      const motif = (err as CredentialsSignin).code;
      if (motif === "attente-expiree") return { erreur: EXPIREE, recommencer: true };
      await noterEchec(portee);
      return { erreur: "Ce code n'est pas le bon." };
    }
    if (err instanceof AuthError) {
      logger.error("Code de double vérification : la vérification a échoué", {
        type: err.type,
        cause: err.cause instanceof Error ? err.cause.message : String(err.cause ?? ""),
      });
      return { erreur: "Un service d'Atlas ne répond pas. Réessayez dans un instant." };
    }
    throw err;
  }

  await oublierEchecs(portee);
  await rendreLimite(`connexion:${email}:${source}`);
  await rendreLimite(`connexion:compte:${email}`);
  if (retenir) await retenirCetAppareil(utilisateurId);
  redirect(await accueilPourEmail(email));
}
