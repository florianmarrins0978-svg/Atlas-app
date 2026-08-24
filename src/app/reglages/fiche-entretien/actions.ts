"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { PHRASE_REFUS } from "@/lib/prestations-entretien";
import {
  ajouterPrestation,
  retirerPrestation,
  renommerPrestation,
  renommerFamille,
  retirerFamille,
  poserModeleFourni,
} from "@/server/repositories/prestations-entretien";
import { revalidatePath } from "next/cache";

// Les gestes de l'écran « Fiche d'entretien ».
//
// **Les refus se RENDENT, ils ne lèvent jamais** (`HANDOVER.md`, piège 0 ter) :
// l'exception d'une action serveur n'arrive pas jusqu'au patron — Next.js la
// remplace en production par un identifiant opaque, et son banc sert une
// version bâtie. Une action qui lèverait lui donnerait « Une erreur est
// survenue » et rien d'autre.
//
// **Chaque action revérifie le droit.** L'écran cache déjà la rubrique à qui
// n'est pas propriétaire ; une action serveur, elle, s'appelle sans écran.

export type Resultat = { ok: true } | { ok: false; phrase: string };

async function contexteAutorise() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) return null;
  return ctx;
}

function refus(cle: keyof typeof PHRASE_REFUS): Resultat {
  return { ok: false, phrase: PHRASE_REFUS[cle] };
}

export async function ajouterPrestationAction(
  famille: string,
  libelle: string
): Promise<Resultat> {
  const ctx = await contexteAutorise();
  if (!ctx) return refus("non_autorise");
  const r = await ajouterPrestation(ctx, { famille, libelle });
  if (!r.ok) return refus(r.refus);
  revalidatePath("/reglages/fiche-entretien");
  return { ok: true };
}

export async function retirerPrestationAction(id: string): Promise<Resultat> {
  const ctx = await contexteAutorise();
  if (!ctx) return refus("non_autorise");
  const r = await retirerPrestation(ctx, id);
  if (!r.ok) return refus(r.refus);
  revalidatePath("/reglages/fiche-entretien");
  return { ok: true };
}

export async function renommerPrestationAction(id: string, libelle: string): Promise<Resultat> {
  const ctx = await contexteAutorise();
  if (!ctx) return refus("non_autorise");
  const r = await renommerPrestation(ctx, id, libelle);
  if (!r.ok) return refus(r.refus);
  revalidatePath("/reglages/fiche-entretien");
  return { ok: true };
}

export async function renommerFamilleAction(ancienne: string, nouvelle: string): Promise<Resultat> {
  const ctx = await contexteAutorise();
  if (!ctx) return refus("non_autorise");
  const r = await renommerFamille(ctx, ancienne, nouvelle);
  if (!r.ok) return refus(r.refus);
  revalidatePath("/reglages/fiche-entretien");
  return { ok: true };
}

/**
 * Retire une famille entière — ses prestations avec elle.
 *
 * **Sa remarque du 24 août 2026** : cet écran sert à *« ajouter des catégories,
 * en enlever, en créer »*. « En enlever » manquait.
 *
 * **Appelée à la fermeture du tiroir**, comme le retrait d'une prestation :
 * tant qu'« Annuler » est à l'écran, rien n'est écrit (`useRetraits`).
 */
export async function retirerFamilleAction(famille: string): Promise<Resultat> {
  const ctx = await contexteAutorise();
  if (!ctx) return refus("non_autorise");
  const r = await retirerFamille(ctx, famille);
  if (!r.ok) return refus(r.refus);
  revalidatePath("/reglages/fiche-entretien");
  return { ok: true };
}

export async function poserModeleFourniAction(): Promise<Resultat> {
  const ctx = await contexteAutorise();
  if (!ctx) return refus("non_autorise");
  const r = await poserModeleFourni(ctx);
  if (!r.ok) return refus(r.refus);
  revalidatePath("/reglages/fiche-entretien");
  return { ok: true };
}
