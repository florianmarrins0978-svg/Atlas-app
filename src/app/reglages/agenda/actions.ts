"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { configurationGoogle, urlDeConsentement } from "@/server/agenda/google";
import { basculerAgenda, debrancherAgenda } from "@/server/repositories/agendas-externes";
import { TEMOIN_ETAT_AGENDA } from "./temoin";


/**
 * Envoie l'artisan donner son accord chez Google.
 *
 * **Rien n'est écrit à ce stade**, et c'est volontaire : tant qu'il n'a pas dit
 * oui chez Google, il n'a rien relié. Un enregistrement anticipé afficherait
 * « agenda relié » à quelqu'un qui a fermé l'onglet.
 */
export async function demarrerRaccordementAction(): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "relier un agenda");

  const config = configurationGoogle();
  if (!config) {
    // Le défaut de configuration refuse, il n'accorde pas. L'écran ne propose
    // déjà pas le bouton dans ce cas ; cette barrière-ci tient si l'adresse est
    // tapée à la main.
    throw new Error("Aucun identifiant Google n'est configuré sur cette installation.");
  }

  const etat = randomBytes(32).toString("base64url");
  const boite = await cookies();
  boite.set(TEMOIN_ETAT_AGENDA, etat, {
    httpOnly: true,
    sameSite: "lax", // `lax` et non `strict` : le retour vient de chez Google.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // Dix minutes : le temps de dire oui, pas celui d'oublier.
  });

  redirect(urlDeConsentement(config, etat));
}

/** Coupe la lecture de l'agenda sans effacer le raccordement. */
export async function basculerAgendaAction(actif: boolean): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "activer ou couper l'agenda");
  await basculerAgenda(ctx, actif);
}

/** Efface le raccordement et les jetons. */
export async function debrancherAgendaAction(): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "débrancher l'agenda");
  await debrancherAgenda(ctx);
}
