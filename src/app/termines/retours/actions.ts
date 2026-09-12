"use server";

import { revalidatePath } from "next/cache";
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
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **LA LECTURE PÉRIME LES DEUX ÉCRANS QUI LA MONTRENT — 11 septembre 2026.**
 *
 * Sa plainte, capture à l'appui : *« je viens d'aller regarder le retour d'inter
 * mais le petit 1 est resté visible ; il doit seulement annoncer les retours pas
 * lus »*. Le compte était pourtant juste EN BASE, et l'écran le calcule bien à
 * partir des non-lus depuis le 9 septembre.
 *
 * **Ce qui mentait, c'est la page gardée par le navigateur.** La flèche de
 * `/termines/retours` recule par `router.back()` (`FlecheRetour.tsx`), et un
 * retour arrière REJOUE la page telle que Next l'avait mise de côté — celle
 * d'avant la lecture, avec sa pastille à 1. Une écriture qui ne dit pas quelles
 * pages elle périme laisse donc l'ancienne image sous son doigt.
 *
 * Les deux écrans se périment, pas seulement celui du compte : `/termines/retours`
 * gardé en l'état ferait revenir le point doré sur un retour qu'il a ouvert.
 *
 * **Pourquoi ce n'est pas un pansement** (`CLAUDE.md` §4 quater) : la pose d'un
 * retour fait déjà exactement cela depuis le premier jour
 * (`src/app/planning/retour-actions.ts`, « le patron le lit dans Terminés »).
 * C'est la lecture qui avait été oubliée — l'écriture était muette, pas l'écran.
 */
export async function marquerLeRetourVuAction(retourId: string): Promise<void> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/termines", "ouvrir un retour d'intervention");
  const marque = await marquerLeRetourVu(ctx, retourId);
  // Rien à périmer si le retour n'était pas le sien : la RLS l'a refusé, et
  // aucun des deux écrans n'a changé d'un pixel.
  if (!marque) return;
  revalidatePath("/termines");
  revalidatePath("/termines/retours");
}
