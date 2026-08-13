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
import {
  basculerAgendaApple,
  debrancherAgendaApple,
  listerAgendasApple,
  reglerEcritureApple,
  relierAgendaApple,
  resynchroniserAgendaApple,
} from "@/server/repositories/agenda-apple";
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

// ─── L'agenda iCloud ───────────────────────────────────────────────────────
//
// **Pourquoi ces actions rendent une valeur au lieu de jeter.** Le message
// d'une exception levée par une action serveur n'arrive JAMAIS jusqu'au patron :
// Next.js le remplace en production par un identifiant opaque, et son banc sert
// une version bâtie (`AGENTS.md`, `HANDOVER.md` piège 0 ter). Un refus attendu
// — mot de passe recopié de travers, double authentification absente — se rend
// donc en valeur de retour, sans quoi l'écran afficherait « Une erreur est
// survenue » sur une panne qu'Apple avait pourtant nommée.

/** Ce qu'un agenda iCloud montre à l'écran de choix. */
export type AgendaProposé = { href: string; nom: string; inscriptible: boolean };

export type ResultatApple =
  | { ok: true; agendas: AgendaProposé[] }
  | { ok: false; motif: string };

/**
 * Relie le compte iCloud à partir du mot de passe pour les apps.
 *
 * **Le mot de passe n'est jamais renvoyé à l'écran**, ni en écho, ni dans un
 * message d'erreur : ce qui remonte est ce qu'Apple a répondu, pas ce qui a été
 * tapé.
 */
export async function relierAppleAction(saisie: {
  compte: string;
  motDePasse: string;
}): Promise<ResultatApple> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "relier un agenda iCloud");
  try {
    const agendas = await relierAgendaApple(ctx, saisie);
    return { ok: true, agendas: agendas.map(pourLEcran) };
  } catch (e) {
    return { ok: false, motif: motifLisible(e) };
  }
}

/** Redemande la liste des agendas, pour rouvrir le choix sans rebrancher. */
export async function listerAgendasAppleAction(): Promise<ResultatApple> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "consulter les agendas iCloud");
  try {
    return { ok: true, agendas: (await listerAgendasApple(ctx)).map(pourLEcran) };
  } catch (e) {
    return { ok: false, motif: motifLisible(e) };
  }
}

/**
 * Allume ou éteint l'écriture, et dit où écrire.
 *
 * Allumer déclenche la reprise : sans elle, l'artisan verrait un agenda vide et
 * croirait le raccordement mort alors qu'il venait de l'établir.
 */
export async function reglerEcritureAppleAction(reglage: {
  active: boolean;
  calendrier?: { href: string; nom: string } | null;
}): Promise<{ ok: true } | { ok: false; motif: string }> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "régler l'écriture dans l'agenda");
  try {
    await reglerEcritureApple(ctx, reglage);
    return { ok: true };
  } catch (e) {
    return { ok: false, motif: motifLisible(e) };
  }
}

/** Renvoie tous les chantiers planifiés dans l'agenda, après une panne. */
export async function resynchroniserAppleAction(): Promise<
  { ok: true; poses: number } | { ok: false; motif: string }
> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "renvoyer les chantiers dans l'agenda");
  const r = await resynchroniserAgendaApple(ctx);
  // `resynchroniser` ne jette pas : il rend ce qu'il a réussi à poser AVANT
  // l'échec. « 7 sur 12, puis Apple a refusé » se corrige ; « ça n'a pas
  // marché » n'apprend rien.
  if (r.erreur) return { ok: false, motif: r.erreur };
  return { ok: true, poses: r.poses };
}

/** Coupe la lecture de l'agenda iCloud sans effacer le raccordement. */
export async function basculerAppleAction(actif: boolean): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "activer ou couper l'agenda iCloud");
  await basculerAgendaApple(ctx, actif);
}

/**
 * Débranche iCloud : retire ce qu'Atlas a posé, puis oublie le mot de passe.
 *
 * Rend ce qui n'a PAS pu être retiré, s'il y a lieu. Taire des restes serait
 * lui laisser croire à un ménage qui n'a pas eu lieu — et il les découvrirait
 * un mois plus tard dans son téléphone, sans savoir d'où ils viennent.
 */
export async function debrancherAppleAction(): Promise<{ restes: string | null }> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "débrancher l'agenda iCloud");
  return debrancherAgendaApple(ctx);
}

function pourLEcran(a: { href: string; nom: string; inscriptible: boolean }): AgendaProposé {
  return { href: a.href, nom: a.nom, inscriptible: a.inscriptible };
}

function motifLisible(e: unknown): string {
  const texte = e instanceof Error ? e.message : String(e);
  return texte.slice(0, 400);
}
