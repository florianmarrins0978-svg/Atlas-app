"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { poserPrixGrille, type NatureGrilleServeur } from "@/server/repositories/grille-prix";
import {
  ajouterNature,
  ajouterTechnique,
  ajouterTranche,
  rendreNature,
  rendreTranche,
  retirerNature,
  retirerTranche,
  type Ajout,
  type Retrait,
} from "@/server/repositories/grilles-reglables";
import { exigerProprietaire } from "@/server/autorisation";
import type { FormeGrille, NomAxe } from "@/lib/grille-prix";

/**
 * Poser — ou effacer — le prix d'une case, dans l'une des grilles.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **RÉSERVÉE AU PROPRIÉTAIRE — corrigé le 23 août 2026** (audit, constat E3).
 *
 * Cette action était **la seule de ce fichier** sans garde, quand ses neuf
 * voisines en portaient une. Son commentaire s'en expliquait ainsi : *« ce sont
 * les prix de l'entreprise connectée, et l'isolation par entreprise fait qu'un
 * compte ne peut toucher que les siens »*. L'argument est juste et répond à la
 * mauvaise question : il parle de l'isolation ENTRE entreprises, pas du rôle
 * DANS l'entreprise. Or la règle du patron du 13 août 2026 ne porte que sur le
 * second — *« un salarié ne doit évidemment pas pouvoir modifier les tarifs »*.
 *
 * **Ce que cela permettait :** un salarié appelait cette action depuis
 * n'importe quel écran et réécrivait la grille tarifaire de l'entreprise. Les
 * devis suivants s'en servaient. L'écran, lui, ne lui était même pas proposé —
 * la protection ne vivait que dans l'affichage.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **LA GARDE EST ICI, ET SURTOUT PAS DANS LE DÉPÔT.** `poserPrixGrille` est
 * aussi appelé par `src/server/services/apprendre-grille.ts`, qui apprend les
 * prix **tout seul** à partir des devis établis, avec l'origine « devis ». La
 * poser un cran plus bas casserait la génération d'un devis pour un salarié —
 * un remède qui fabriquerait une panne, sur un chemin que personne ne relierait
 * à un contrôle de rôle. Ce qui se ferme ici, c'est la SAISIE À LA MAIN.
 *
 * Un prix vide efface la case : elle redevient une question posée, ce qui est
 * exactement ce qu'on veut quand on se rend compte qu'un prix était faux.
 */
export async function poserPrixGrilleAction(nature: NatureGrilleServeur, cle: string, prix: string) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "poser un prix dans vos grilles");
  await poserPrixGrille(ctx, nature, cle, prix, "saisi");
  revalidatePath("/reglages/prix");
}

// ---------------------------------------------------------------------------
// Ajouter et retirer des cases — sa demande du 14 août 2026
// ---------------------------------------------------------------------------
//
// **Ces gestes-là sont réservés au propriétaire, à la différence du prix d'une
// case.** Poser un prix ne touche qu'une case ; retirer une tranche en range
// dix d'un coup sur toutes les grilles, et un salarié n'a aucune raison de
// redessiner la grille tarifaire de l'entreprise. `exigerProprietaire` protège
// déjà les vingt-trois écritures du même ordre.

export async function ajouterTrancheAction(
  axe: NomAxe,
  de: number,
  a: number | null
): Promise<Ajout> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "modifier les tranches de vos grilles");
  const r = await ajouterTranche(ctx, axe, { de, a });
  revalidatePath("/reglages/prix");
  return r;
}

export async function ajouterTechniqueAction(libelle: string): Promise<Ajout> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "modifier les façons d'abattre");
  const r = await ajouterTechnique(ctx, libelle);
  revalidatePath("/reglages/prix");
  return r;
}

export async function ajouterNatureAction(titre: string, forme: FormeGrille): Promise<Ajout> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "ajouter un travail à vos grilles");
  const r = await ajouterNature(ctx, { titre, forme });
  revalidatePath("/reglages/prix");
  return r;
}

/**
 * Retire une tranche, et rend compte de ce qu'elle emporte.
 *
 * **Aucun prix n'est effacé** : les cases restent en base et reviennent avec la
 * tranche si le patron annule. Le nombre rendu sert à le lui DIRE — un retrait
 * muet lui ferait croire qu'il n'a rien perdu.
 */
export async function retirerTrancheAction(axe: NomAxe, cle: string): Promise<Retrait> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "retirer une tranche de vos grilles");
  const r = await retirerTranche(ctx, axe, cle);
  revalidatePath("/reglages/prix");
  return r;
}

export async function rendreTrancheAction(axe: NomAxe, cle: string): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "remettre une tranche dans vos grilles");
  await rendreTranche(ctx, axe, cle);
  revalidatePath("/reglages/prix");
}

export async function retirerNatureAction(cle: string): Promise<Retrait> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "retirer un travail de vos grilles");
  const r = await retirerNature(ctx, cle);
  revalidatePath("/reglages/prix");
  return r;
}

export async function rendreNatureAction(cle: string): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "remettre un travail dans vos grilles");
  await rendreNature(ctx, cle);
  revalidatePath("/reglages/prix");
}
