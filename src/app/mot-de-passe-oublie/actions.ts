"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { accueilPourEmail } from "@/server/accueil-apres-connexion";
import { logger } from "@/server/logger";
import { LIMITES, verifierLimite } from "@/server/rate-limit";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { messageRefus } from "@/lib/mot-de-passe";
import {
  envoyerUnCode,
  poserLeNouveauMotDePasse,
  verifierLeCodeOublie,
  type VerdictDuCodeOublie,
} from "@/server/repositories/mot-de-passe-oublie";

/**
 * Les trois gestes de `/mot-de-passe-oublie`, sans session : c'est tout le
 * sens de l'écran. Chaque refus attendu revient en VALEUR : le message d'une
 * exception levée par une action serveur n'arrive jamais jusqu'à l'écran
 * (`HANDOVER.md`, piège 0 ter).
 */

function adresse(saisie: string): string {
  return saisie.trim().toLowerCase();
}

export async function recevoirUnCodeAction(saisie: string): Promise<{ ok: true } | { ok: false; refus: string }> {
  const email = adresse(saisie);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, refus: "Cette adresse n’est pas complète." };

  const source = await sourceDuVisiteur(horsProductionReelle());
  const limite = await verifierLimite(`mot-de-passe-oublie:${source}`, LIMITES.motDePasseOublie);
  if (!limite.autorise) {
    logger.warn("Trop de demandes de code de mot de passe oublié depuis cette source");
    return { ok: false, refus: "Trop de demandes. Réessayez dans un quart d’heure." };
  }
  return envoyerUnCode(email);
}

export async function verifierLeCodeOublieAction(saisie: string, code: string): Promise<VerdictDuCodeOublie> {
  return verifierLeCodeOublie(adresse(saisie), code);
}

export async function choisirLeMotDePasseAction(
  saisie: string,
  jeton: string,
  nouveau: string,
  confirmation: string
): Promise<{ ok: false; refus: string; recommencer: boolean }> {
  const email = adresse(saisie);
  const pose = await poserLeNouveauMotDePasse(email, jeton, nouveau, confirmation);
  if (!pose.ok) {
    return pose.refus === "jeton-mort"
      ? { ok: false, refus: "Le délai est passé. Demandez un nouveau code.", recommencer: true }
      : { ok: false, refus: messageRefus(pose.refus), recommencer: false };
  }

  // On entre avec le mot de passe qu'il vient de choisir : le même chemin que
  // « Entrer », donc la même session, et rien à retaper.
  try {
    await signIn("credentials", { email, password: nouveau, redirect: false });
  } catch (erreur) {
    // Le mot de passe EST changé : le dire, et le renvoyer à la porte plutôt
    // que de lui laisser croire que rien ne s'est passé.
    logger.error("Mot de passe changé, mais la connexion qui suit a échoué", {
      cause: erreur instanceof Error ? erreur.message : String(erreur),
    });
    redirect("/login");
  }
  redirect(await accueilPourEmail(email));
}
