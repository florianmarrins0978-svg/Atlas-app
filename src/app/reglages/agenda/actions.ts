"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { urlDeConsentement } from "@/server/agenda/google";
import {
  basculerAgenda,
  configurationDeLEntreprise,
  debrancherAgenda,
  enregistrerIdentifiants,
} from "@/server/repositories/agendas-externes";
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

  const config = await configurationDeLEntreprise(ctx);
  if (!config) {
    // Le défaut de configuration refuse, il n'accorde pas. L'écran ne propose
    // déjà pas le bouton dans ce cas ; cette barrière-ci tient si l'adresse est
    // tapée à la main.
    throw new Error("Aucun identifiant Google n'est enregistré pour cette entreprise.");
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

/**
 * Enregistre les identifiants collés depuis la console Google.
 *
 * **Trois champs, et aucun n'est facultatif.** Google refuse au moindre écart
 * sur l'adresse de retour ; accepter une configuration à moitié posée ferait
 * partir l'artisan vers un message d'erreur en anglais, qu'il lirait comme une
 * panne d'Atlas.
 */
export async function enregistrerIdentifiantsAction(saisie: {
  clientId: string;
  clientSecret: string;
  redirection: string;
}): Promise<{ ok: true } | { ok: false; motif: string }> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "enregistrer les identifiants Google");

  const clientId = saisie.clientId.trim();
  const clientSecret = saisie.clientSecret.trim();
  const redirection = saisie.redirection.trim();

  if (!clientId || !redirection) {
    return { ok: false, motif: "L'identifiant client et l'adresse de retour sont nécessaires." };
  }
  // Le secret peut rester vide SI un secret est déjà enregistré : Google ne le
  // remontre jamais après sa création, et redemander de le retrouver pour
  // corriger une adresse de retour serait une impasse.
  const dejaConfigure = (await configurationDeLEntreprise(ctx)) !== null;
  if (!clientSecret && !dejaConfigure) {
    return { ok: false, motif: "Le secret client est nécessaire la première fois." };
  }
  if (!/^https?:\/\//.test(redirection)) {
    return { ok: false, motif: "L'adresse de retour doit commencer par http:// ou https://" };
  }
  // Une faute de frappe fréquente : coller l'identifiant à la place du secret.
  // Les identifiants Google finissent tous par `.apps.googleusercontent.com`.
  if (clientSecret.endsWith(".apps.googleusercontent.com")) {
    return { ok: false, motif: "Le secret ressemble à un identifiant client : les deux cases sont inversées." };
  }

  await enregistrerIdentifiants(ctx, { clientId, clientSecret: clientSecret || null, redirection });
  return { ok: true };
}
