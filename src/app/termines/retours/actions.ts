"use server";

import { exigerEcran } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { marquerLeRetourVu } from "@/server/repositories/retours-intervention";

/**
 * IL VIENT D'OUVRIR UN RETOUR — on s'en souvient, pour lui seul.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 9 septembre 2026** : *« il faut qu'on puisse distinguer du
 * premier coup d'œil ceux pas ouverts — comme pour les SMS sur notre
 * téléphone »*, et que la pastille compte ce qu'il n'a **pas** lu.
 *
 * **La porte est celle de l'écran, pas une de plus.** `/termines` est refusé au
 * salarié et au commercial (`test-acces-roles.ts`) : qui peut lire la liste
 * peut dire qu'il l'a lue. Poser ici une seconde règle d'accès en ferait deux
 * pour une seule question (`CLAUDE.md` §3).
 *
 * **Elle ne rend rien à l'écran, et c'est voulu.** La pastille s'éteint sous le
 * doigt, sans attendre le serveur : la lecture est un fait accompli, pas une
 * demande qui peut être refusée. Si l'appel échoue — un réseau de chantier —
 * le retour restera non lu, ce qui est le bon côté de l'erreur : il le rouvrira.
 */
export async function marquerLeRetourVuAction(retourId: string): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/termines", "ouvrir un retour d'intervention");
  await marquerLeRetourVu(ctx, retourId);
}
