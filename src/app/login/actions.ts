"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";

const MESSAGE_GENERIQUE = "Email ou mot de passe incorrect.";

export async function connexionAction(
  _etatPrecedent: { erreur?: string } | undefined,
  formData: FormData
): Promise<{ erreur?: string }> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Limité par email : ne révèle jamais si l'email existe (même message que
  // pour un mot de passe invalide), n'entraîne jamais un blocage permanent
  // (fenêtre glissante de 15 minutes).
  const limite = await verifierLimite(`connexion:${email}`, LIMITES.connexion);
  if (!limite.autorise) {
    logger.warn("Limite de tentatives de connexion atteinte", { email });
    return { erreur: MESSAGE_GENERIQUE };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      return { erreur: MESSAGE_GENERIQUE };
    }
    throw err;
  }
  redirect("/");
}

export async function deconnexionAction() {
  await signOut({ redirectTo: "/login" });
}
