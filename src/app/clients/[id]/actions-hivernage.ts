"use server";

import { revalidatePath } from "next/cache";
import { exigerEcran, exigerEcritureSurLePlanning } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { getClient } from "@/server/repositories/clients";
import { annulerHivernageFait, noterHivernageFait, repondreSurLArrosage } from "@/server/repositories/hivernage";
import { poserLeClientSurLeJour } from "@/server/repositories/pose-d-un-client";
import { contextePlanning } from "@/server/contexte-planning";
import { cePlanningPorte, finDeLaSaison, jourChoisissable, TRAVAUX_DE_L_HIVERNAGE } from "@/lib/hivernage";
import { estUnJourValide, type QuandPoser } from "@/lib/planning-jour";
import { jourIso } from "@/lib/jour";

/**
 * ─── L'HIVERNAGE, DEPUIS LA FICHE D'UN CLIENT ───────────────────────────────
 *
 * Sa planche du 5 novembre 2026 (`appli/soignee/hiverner-l-arrosage.html`,
 * « la B »). Cinq gestes : répondre aux deux questions, « C'est fait » et son
 * « Annuler », regarder ce que le planning porte, « Le prévoir ».
 *
 * **Lire la fiche, c'est pouvoir y répondre** (`exigerEcran("/clients")`, la
 * garde de « Modifier ses coordonnées »). **Poser au planning, c'est écrire
 * le planning** : un salarié consulte, il ne pose pas (sa décision du
 * 30 août 2026, `exigerEcritureSurLePlanning`).
 *
 * **UN REFUS SE REND EN VALEUR, JAMAIS EN EXCEPTION** (`AGENTS.md`, piège
 * 0 ter) : le message d'une exception levée par une action serveur n'atteint
 * jamais son écran.
 */

export type ResultatHivernage = { ok: true } | { ok: false; raison: string };

const PLUS_LA = "Ce client n'existe plus.";

/** Sa réponse à « Ce client a un arrosage automatique ? » ou à « Vous faites son hivernage ? ». */
export async function repondreSurLArrosageAction(
  clientId: string,
  question: "arrosage" | "hivernage",
  oui: boolean
): Promise<ResultatHivernage> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/clients", "répondre sur l'arrosage d'un client");
  // Le type n'existe pas à l'exécution : une action se poste avec ce qu'on veut.
  if ((question !== "arrosage" && question !== "hivernage") || typeof oui !== "boolean") {
    return { ok: false, raison: "Cette réponse ne se lit pas." };
  }
  if (!(await repondreSurLArrosage(ctx, clientId, question, oui))) return { ok: false, raison: PLUS_LA };
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { ok: true };
}

/** « C'est fait » : l'hivernage noté à ce jour, et le jour d'avant rendu pour « Annuler ». */
export async function noterHivernageFaitAction(
  clientId: string
): Promise<{ ok: true; precedent: string | null } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/clients", "noter l'hivernage d'un client");
  const note = await noterHivernageFait(ctx, clientId, jourIso(new Date()));
  if (!note) return { ok: false, raison: PLUS_LA };
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { ok: true, precedent: note.precedent };
}

/** « Annuler » après « C'est fait ». */
export async function annulerHivernageFaitAction(clientId: string, precedent: string | null): Promise<ResultatHivernage> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/clients", "annuler l'hivernage d'un client");
  if (precedent !== null && (typeof precedent !== "string" || !estUnJourValide(precedent))) {
    return { ok: false, raison: "Ce jour ne se lit pas." };
  }
  if (!(await annulerHivernageFait(ctx, clientId, precedent))) return { ok: false, raison: PLUS_LA };
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { ok: true };
}

/**
 * CE QUE LE PLANNING PORTE, d'aujourd'hui à la fin février : lu quand la
 * feuille s'ouvre, pas avec la fiche, qui n'en a pas besoin pour s'afficher.
 *
 * **Le planning tel que la personne le VOIT** (`contextePlanning`, son tamis
 * compris) : la feuille ne doit nommer aucun chantier que son planning lui
 * cache.
 */
export async function cePlanningPorteAction(): Promise<Record<string, string[]>> {
  const ctx = await getCurrentCtx();
  await exigerEcritureSurLePlanning(ctx, "regarder le planning pour prévoir un hivernage");
  const maintenant = new Date();
  const aujourdHui = jourIso(maintenant);
  const fin = finDeLaSaison(aujourdHui);
  if (!fin) return {};
  const { chantiers } = await contextePlanning(ctx, maintenant);
  return cePlanningPorte(chantiers, aujourdHui, fin);
}

/**
 * « LE PRÉVOIR » : l'hivernage posé au planning, chez ce client, ce jour-là.
 *
 * **Par le geste du planning, et par lui seul** (`poserLeClientSurLeJour`,
 * celui de « Un client ») : une seconde façon de poser divergerait de la
 * première au premier ajout. Ce qui s'y ajoute : la marque « hivernage » et le
 * travail « Hivernage de l'arrosage », que le planning lit comme les travaux
 * d'un client posé sans devis.
 */
export async function prevoirLHivernageAction(
  clientId: string,
  jour: string,
  quand: QuandPoser
): Promise<{ ok: true; chantierId: string } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/clients", "prévoir l'hivernage d'un client");
  await exigerEcritureSurLePlanning(ctx, "prévoir l'hivernage d'un client");
  if (typeof jour !== "string" || !estUnJourValide(jour)) return { ok: false, raison: "Ce jour ne se lit pas." };
  if (quand !== "matin" && quand !== "apres_midi" && quand !== "journee") {
    return { ok: false, raison: "Choisissez le matin, l'après-midi ou la journée." };
  }
  // **La même règle que la feuille** (`jourChoisissable`) : un jour que l'écran
  // n'offre pas ne passe pas davantage par une action postée à la main.
  if (!jourChoisissable(jour, jourIso(new Date()))) {
    return { ok: false, raison: "Ce jour ne se choisit pas pour l'hivernage." };
  }
  const client = await getClient(ctx, clientId);
  if (!client) return { ok: false, raison: PLUS_LA };
  const chantier = await poserLeClientSurLeJour(ctx, client, jour, quand, {
    nature: "hivernage",
    travaux: [TRAVAUX_DE_L_HIVERNAGE],
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/planning");
  return { ok: true, chantierId: chantier.id };
}
