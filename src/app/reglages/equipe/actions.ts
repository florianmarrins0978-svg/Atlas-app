"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { messageRefusAcces } from "@/lib/donner-un-acces";
import {
  changerLaPortee,
  changerLeRole,
  donnerUnAcces,
  retirerUnAcces,
} from "@/server/repositories/membres-entreprise";
import type { Role } from "@/lib/acces-roles";
import { mettreAJourEntreprise } from "@/server/repositories/entreprises";

/**
 * LES QUATRE GESTES DES ACCÈS — et les quatre commencent par la même ligne.
 *
 * **`exigerProprietaire` n'est pas une redite de `GardeAcces`.** La garde de la
 * mise en page refuse une ADRESSE ; une action serveur, elle, se poste à
 * l'adresse de la page qui l'a rendue. Se garder par le chemin seul reviendrait
 * donc à garder une action par l'écran d'où l'on croit qu'elle vient — et
 * `/reglages/equipe` n'est pas le seul endroit d'où une requête peut partir.
 *
 * C'est la leçon du 23 août 2026, déjà écrite pour « Mes prix » : *« l'écran et
 * l'action qui y pose un montant sont réservés au patron, côté serveur et plus
 * seulement à l'affichage »*.
 *
 * **Un refus attendu se REND, il ne se lève pas.** Le message d'une exception
 * levée par une action serveur n'arrive jamais jusqu'au patron : Next.js le
 * remplace en production par un identifiant opaque, et son banc sert une version
 * bâtie (`AGENTS.md`, piège 0 ter). « Un compte utilise déjà cette adresse » est
 * un refus attendu : il descend en valeur de retour.
 */

function phrase(refus: Parameters<typeof messageRefusAcces>[0]): { ok: false; message: string } {
  return { ok: false, message: messageRefusAcces(refus) };
}

export async function donnerUnAccesAction(saisie: {
  nom: string;
  email: string;
  motDePasse: string;
  confirmation: string;
  role: Role;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "donner un accès");

  const resultat = await donnerUnAcces(ctx, saisie);
  if (!resultat.ok) return phrase(resultat.refus);

  revalidatePath("/reglages/equipe");
  return { ok: true };
}

export async function changerLeRoleAction(
  accesId: string,
  role: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "changer un rôle");

  const resultat = await changerLeRole(ctx, accesId, role);
  if (!resultat.ok) return phrase(resultat.refus);

  revalidatePath("/reglages/equipe");
  return { ok: true };
}

export async function changerLaPorteeAction(
  accesId: string,
  portee: string,
  equipeId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "changer ce qu'une personne voit du planning");

  const resultat = await changerLaPortee(ctx, accesId, portee, equipeId);
  if (!resultat.ok) return phrase(resultat.refus);

  revalidatePath("/reglages/equipe");
  return { ok: true };
}

export async function retirerUnAccesAction(
  accesId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "retirer un accès");

  const resultat = await retirerUnAcces(ctx, accesId);
  if (!resultat.ok) return phrase(resultat.refus);

  revalidatePath("/reglages/equipe");
  return { ok: true };
}

/**
 * CE QUE LE PATRON EXIGE EN FIN DE CHANTIER — les deux interrupteurs.
 *
 * Sa décision du 8 septembre 2026 : *« une feuille de preuve de fin de chantier
 * que le salarié remplira ou non — ça sera au patron de décider. »*
 *
 * **`exigerProprietaire`, et pas `exigerEcran`.** Ce réglage tient toute
 * l'équipe : un commercial qui l'allumerait imposerait une photo à des gens qui
 * ne lui rendent pas de comptes. C'est la même garde que les rôles et les accès,
 * juste au-dessus.
 *
 * **La photo ne s'exige pas sans la preuve**, et c'est écrit ICI plutôt que
 * laissé à l'écran : un appel direct pourrait poser la seconde sans la première,
 * et `ceQuiManque` ne saurait alors plus quoi refuser. L'écran cache le second
 * interrupteur ; le serveur, lui, éteint la valeur.
 */
export async function reglerLaFinDeChantierAction(
  demande: boolean,
  photoExigee: boolean
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "régler la fin de chantier");

  await mettreAJourEntreprise(ctx, {
    retourDemande: demande,
    retourPhotoExigee: demande ? photoExigee : false,
  });

  revalidatePath("/reglages/equipe");
  // Le salarié lit ces règles en ouvrant sa fiche : sans cela il verrait
  // celles d'hier jusqu'au prochain rechargement.
  revalidatePath("/planning");
  return { ok: true };
}
