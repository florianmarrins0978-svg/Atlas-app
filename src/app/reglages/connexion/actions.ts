"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerPreuveRecente, PreuveRecenteExigeeError } from "@/server/preuve-recente";
import { GESTES_SENSIBLES, type GesteSensible } from "@/lib/preuve-recente";
import { changerMotDePasse, deconnecterPartout, lireCompte } from "@/server/repositories/compte";
import { messageRefus } from "@/lib/mot-de-passe";
import { messageRefusCle, type CleAppareil } from "@/lib/cle-appareil";
import { enregistrerCle, optionsEnregistrement } from "@/server/cle-appareil";
import { listerCles, retirerCle } from "@/server/repositories/cles-appareil";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";

/**
 * Le mot de passe, et la déconnexion générale.
 *
 * **Aucune garde de rôle** : « Connexion » appartient à l'ensemble « Moi », et
 * c'est exactement ce qu'un salarié gardera — sa règle du 13 août 2026, *« un
 * salarié peut changer ses notifications ou son mot de passe »*.
 *
 * **Les refus sont des VALEURS.** Le message d'une exception levée par une
 * action serveur n'arrive jamais jusqu'à l'artisan : Next.js le remplace en
 * production par un identifiant opaque, et le banc sert une version bâtie
 * (`HANDOVER.md`, piège 0 ter). Un mot de passe actuel erroné est un refus
 * attendu, pas une panne — il se rend, il ne se lève pas.
 */
export type ResultatChangement = { ok: true } | { ok: false; raison: string };

export async function changerMotDePasseAction(
  actuel: string,
  nouveau: string,
  confirmation: string
): Promise<ResultatChangement> {
  const ctx = await getCurrentCtx();
  try {
    const r = await changerMotDePasse(ctx, actuel, nouveau, confirmation);
    return r.ok ? { ok: true } : { ok: false, raison: messageRefus(r.refus) };
  } catch (erreur) {
    // Journalisé AVANT de rendre : un défaut muet se répare à l'aveugle, et
    // c'est ce que `AGENTS.md` interdit.
    console.error("[reglages/connexion] changement de mot de passe interrompu", erreur);
    return { ok: false, raison: "Impossible de changer le mot de passe pour l'instant. Réessayez." };
  }
}

/**
 * « Me déconnecter partout », y compris l'appareil qui appuie.
 *
 * L'écran renvoie ensuite vers `/api/session-perimee`, qui efface les cookies
 * et ramène à la connexion. **Sans cette redirection, l'appareil resterait sur
 * une page dont la moindre action serait désormais refusée** — l'écran
 * paraîtrait figé, et c'est le piège du 10 août 2026 : un cookie mort que rien
 * n'efface.
 */
export async function deconnecterPartoutAction(): Promise<ResultatChangement> {
  const ctx = await getCurrentCtx();
  try {
    await deconnecterPartout(ctx);
    return { ok: true };
  } catch (erreur) {
    console.error("[reglages/connexion] déconnexion générale interrompue", erreur);
    return { ok: false, raison: "Impossible de vous déconnecter partout pour l'instant. Réessayez." };
  }
}


/**
 * « Ouvrir avec Face ID » — l'activation, appareil par appareil.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa règle du 23 août 2026, et elle commande tout ce fichier :** *« l'utilisateur
 * va commencer par créer son compte avec son mot de passe et ensuite il décidera
 * s'il veut ouvrir sa session avec le mot de passe ou le Face ID »*.
 *
 * D'où : on n'arrive ici **qu'une fois connecté** — `getCurrentCtx` refuse le
 * reste —, et le mot de passe n'est jamais retiré. Face ID s'ajoute.
 *
 * **Aucune garde de rôle**, comme le reste de cet écran : « Connexion »
 * appartient à l'ensemble « Moi », et un salarié a le droit de choisir comment
 * il ouvre sa propre session (sa règle du 13 août 2026).
 */

export type DefiEnregistrement =
  | { ok: true; options: PublicKeyCredentialCreationOptionsJSON }
  | { ok: false; raison: string };

export async function defiEnregistrementAction(origineNavigateur?: string): Promise<DefiEnregistrement> {
  const ctx = await getCurrentCtx();
  const limite = await verifierLimite(`cle-appareil:${ctx.utilisateurId}`, LIMITES.cleAppareil);
  if (!limite.autorise) return { ok: false, raison: limite.message };

  // L'adresse et le nom vont au téléphone : c'est ce qu'il affichera sous
  // « Enregistrer une clé pour… », et ce qu'il montrera plus tard quand il
  // proposera le compte à l'ouverture. Sans eux, l'artisan verrait une fenêtre
  // qui ne dit pas de quel compte il s'agit.
  const compte = await lireCompte(ctx);
  if (!compte) return { ok: false, raison: messageRefusCle("panne-activation") ?? "Impossible d’enregistrer cet appareil pour l’instant." };

  const r = await optionsEnregistrement(
    {
      id: ctx.utilisateurId,
      email: compte.email,
      nom: compte.nom || null,
    },
    // L'adresse de SA barre d'adresse : derrière le tunnel de son espace, c'est
    // la seule qui dise où la page est vraiment servie (`ARCHITECTURE.md` §177).
    origineNavigateur
  );
  if (!r.ok) {
    // La raison nomme la configuration, pas l'artisan. On la journalise déjà
    // dans `contexteWebAuthn` ; ici on lui rend une phrase qu'il peut lire.
    return { ok: false, raison: messageRefusCle("panne-activation") ?? "Impossible d’enregistrer cet appareil pour l’instant." };
  }
  return { ok: true, options: r.options };
}

/**
 * **Un refus attendu se rend en VALEUR, jamais en exception.**
 *
 * Le message d'une exception levée par une action serveur n'arrive jamais
 * jusqu'à l'artisan : Next.js le remplace en production par un identifiant
 * opaque, et le banc sert une version bâtie (`AGENTS.md`, `HANDOVER.md` piège
 * 0 ter). Une preuve manquante n'est pas une panne — c'est un refus prévu, dont
 * l'écran doit pouvoir faire quelque chose.
 */
async function refusFautePreuve(
  ctx: { utilisateurId: string; sessionId?: string },
  geste: GesteSensible
): Promise<{ ok: false; raison: string; preuveExigee: true } | null> {
  try {
    await exigerPreuveRecente(ctx, geste);
    return null;
  } catch (erreur) {
    if (erreur instanceof PreuveRecenteExigeeError) {
      return { ok: false, raison: erreur.message, preuveExigee: true };
    }
    throw erreur;
  }
}

export type ResultatCle =
  | { ok: true; cles: CleAppareil[] }
  /**
   * `preuveExigee` dit à l'écran d'OUVRIR la demande de mot de passe plutôt que
   * d'afficher un refus sec. **Ce n'est pas une autorisation** : le serveur a
   * refusé, et il refusera encore tant qu'aucune preuve ne sera posée en base.
   */
  | { ok: false; raison: string; preuveExigee?: boolean };

export async function enregistrerCleAction(reponse: string): Promise<ResultatCle> {
  const ctx = await getCurrentCtx();
  /**
   * **LE GESTE LE PLUS GRAVE DE CET ÉCRAN, et il n'était dans aucun audit.**
   *
   * Une session volée qui enregistre SA PROPRE clé obtient une porte qui
   * **survit au changement de mot de passe** : le patron reprend son compte, et
   * l'intrus entre toujours, indéfiniment. C'est le seul geste d'Atlas qui rend
   * un accès permanent.
   *
   * La preuve exigée est liée à CETTE session (`src/server/preuve-recente.ts`) :
   * une ré-authentification faite sur le téléphone du patron ne sert pas à
   * l'ordinateur du voleur.
   */
  const manquePreuve = await refusFautePreuve(ctx, GESTES_SENSIBLES.ajouterCleAppareil);
  if (manquePreuve) return manquePreuve;
  let lue: RegistrationResponseJSON;
  try {
    lue = JSON.parse(reponse) as RegistrationResponseJSON;
  } catch {
    return { ok: false, raison: messageRefusCle("panne-activation") ?? "Impossible d’enregistrer cet appareil pour l’instant." };
  }

  try {
    const r = await enregistrerCle(ctx.utilisateurId, lue);
    if (!r.ok) return { ok: false, raison: messageRefusCle(r.refus) ?? "Face ID n’a pas pu aboutir." };
    return { ok: true, cles: await listerCles(ctx.utilisateurId) };
  } catch (erreur) {
    console.error("[reglages/connexion] enregistrement d'une clé interrompu", erreur);
    return { ok: false, raison: messageRefusCle("panne-activation") ?? "Impossible d’enregistrer cet appareil pour l’instant." };
  }
}

/**
 * Retirer un appareil.
 *
 * **Rien ne demande le mot de passe pour ce geste**, et c'est délibéré : on
 * retire une porte, on n'en ouvre pas une. Le cas qui compte est celui du
 * téléphone perdu — depuis un autre appareil, à chaud, sans obstacle. Exiger le
 * mot de passe ici, ce serait le demander précisément au moment où l'artisan est
 * pressé et où il vient peut-être de perdre son moyen de le taper.
 */
export async function retirerCleAction(id: string): Promise<ResultatCle> {
  const ctx = await getCurrentCtx();
  // Retirer un appareil prive son propriétaire de sa porte : c'est un geste
  // hostile autant qu'un ajout, et il mérite la même exigence.
  const manquePreuveRetrait = await refusFautePreuve(ctx, GESTES_SENSIBLES.retirerCleAppareil);
  if (manquePreuveRetrait) return manquePreuveRetrait;
  try {
    // `retirerCle` porte `utilisateur_id` dans son `WHERE` : un identifiant venu
    // d'ailleurs ne retire rien. Aucune RLS ne couvre cette table.
    //
    // **Et on REGARDE ce qu'il rend.** Ignorer ce verdict ferait écrire « cet
    // appareil ne peut plus ouvrir Atlas » alors que rien n'aurait été retiré —
    // un mensonge, précisément le soir où quelqu'un vient de perdre son
    // téléphone et a besoin d'être sûr.
    const retire = await retirerCle(ctx.utilisateurId, id);
    if (!retire) {
      return { ok: false, raison: "Cet appareil n’était plus dans votre liste. Rien n’a été changé." };
    }
    return { ok: true, cles: await listerCles(ctx.utilisateurId) };
  } catch (erreur) {
    console.error("[reglages/connexion] retrait d'une clé interrompu", erreur);
    return { ok: false, raison: "Impossible de retirer cet appareil pour l’instant. Réessayez." };
  }
}
