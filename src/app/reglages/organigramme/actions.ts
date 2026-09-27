"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import {
  ajouterSalarie,
  nommerChef,
  rangerSousChef,
  type RefusOrganigramme,
} from "@/server/repositories/organigramme";

/**
 * Les trois gestes de l'organigramme, au PATRON SEUL — sa règle du
 * 27 septembre 2026 : tout le monde le lit, lui seul le change.
 *
 * **Les refus se RENDENT, ils ne se lèvent pas** (`AGENTS.md`) : le message
 * d'une exception n'atteint jamais son écran. Seul le refus de rôle lève, comme
 * partout ailleurs : l'écran n'offre pas ces gestes à qui n'est pas patron.
 */
export type ResultatAction = { ok: true } | { ok: false; message: string };

function phrase(refus: RefusOrganigramme): string {
  switch (refus) {
    case "hors-compteur":
      return "Cette personne n'est plus dans la liste.";
    case "chef-invalide":
      return "Seul un chef d'équipe peut avoir des gars.";
    case "plein":
      return "Vingt personnes au plus sur le terrain.";
    case "nom-vide":
      return "Écrivez son prénom.";
  }
}

async function apres(r: { ok: true } | { ok: false; refus: RefusOrganigramme }): Promise<ResultatAction> {
  if (!r.ok) return { ok: false, message: phrase(r.refus) };
  revalidatePath("/reglages/organigramme");
  revalidatePath("/reglages/equipe");
  return { ok: true };
}

export async function nommerChefAction(rang: number, estChef: boolean): Promise<ResultatAction> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "nommer un chef d'équipe");
  return apres(await nommerChef(ctx, rang, estChef));
}

export async function rangerSousChefAction(garsRang: number, chefRang: number | null): Promise<ResultatAction> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "ranger un gars sous un chef");
  return apres(await rangerSousChef(ctx, garsRang, chefRang));
}

export async function ajouterSalarieAction(nom: string, chefRang: number | null): Promise<ResultatAction> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "ajouter un salarié");
  return apres(await ajouterSalarie(ctx, nom, chefRang));
}
