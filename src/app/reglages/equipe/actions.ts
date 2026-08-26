"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { LONGUEUR_MINIMALE } from "@/lib/mot-de-passe";
import { messageRefusAcces } from "@/lib/donner-un-acces";
import {
  changerLaPortee,
  changerLeRole,
  donnerUnAcces,
  retirerUnAcces,
} from "@/server/repositories/membres-entreprise";
import type { Role } from "@/lib/acces-roles";

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
  return { ok: false, message: messageRefusAcces(refus, LONGUEUR_MINIMALE) };
}

export async function donnerUnAccesAction(saisie: {
  nom: string;
  email: string;
  motDePasse: string;
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
