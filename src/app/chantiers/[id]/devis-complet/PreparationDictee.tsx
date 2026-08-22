"use client";

import { colors, font } from "@/lib/design-tokens";
import DevisDepuisDictee from "../DevisDepuisDictee";

/**
 * Le bandeau qui écrit le devis à partir de sa dictée, pendant qu'il regarde.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa panne du 21 août 2026**, dans ses mots : *« j'ai dicté la prestation du
 * chantier, j'ai rappuyé sur la note vocale, ça a enregistré. J'ai quitté
 * l'application. Je suis retourné dessus, j'ai cliqué sur Madame Lucie — or je
 * ne suis pas arrivé directement sur la page du devis comme demandé, avec mes
 * informations remplies. Corrige-moi ça, c'est le point le plus important. »*
 *
 * Deux choses lui manquaient. Le chemin — corrigé dans `chantier-etat.ts`, la
 * liste mène désormais au devis. Et le devis lui-même : **enregistrer une
 * dictée n'en fabriquait aucun.** La chaîne attendait qu'il appuie sur « Mon
 * devis → », et il ne l'a pas fait : il était chez sa cliente, il a fermé
 * l'application. L'y renvoyer sans rien préparer l'aurait mené sur une feuille
 * vide — c'est-à-dire sur la panne du 7 août, qu'il avait déjà payée.
 *
 * ─── Trois partis pris, et il faut les connaître avant d'y toucher ─────────
 *
 * 1. **DANS le flux de la page, jamais par-dessus.** La première version était
 *    un voile plein écran, et deux suites l'ont refusée le jour même :
 *    `test-rien-de-recouvert-e2e` — qui tient l'invariant « rien de touchable
 *    ne se cache sous du mobilier flottant », né de trois défauts réels — et
 *    `test-reduction-devis-e2e`, dont une frappe atterrissait sur le voile au
 *    lieu du champ. Un bandeau ne recouvre rien : il pousse, et le devis reste
 *    sous le doigt pendant qu'Atlas l'écrit.
 *
 * 2. **Le devis est là DÈS L'ARRIVÉE.** Si la chaîne échoue — pas de
 *    transcription, aucun tarif, une panne réseau —, il lui reste sa feuille et
 *    son crayon, sans avoir rien à écarter. Un écran qui n'aurait que l'échec à
 *    montrer serait un cul-de-sac.
 *
 * 3. **Aucune règle ici.** Ce qui décide de la présence du bandeau est une
 *    fonction pure (`src/lib/devis-a-preparer.ts`), et ce qui mène la chaîne
 *    est le composant qui la menait déjà (`DevisDepuisDictee`, mode `auto`).
 *    Une seconde implémentation aurait divergé au premier ajustement
 *    (`CLAUDE.md` §3).
 * ───────────────────────────────────────────────────────────────────────────
 */
export default function PreparationDictee({ chantierId }: { chantierId: string }) {
  return (
    /* **Un seul bandeau, une seule ligne.** La première version en portait deux
       — une phrase d'explication puis l'état du travail — et elle repoussait la
       flèche de retour d'un tiers d'écran, vu à la capture. Ce que le bandeau
       doit dire tient en une ligne ; le reste de la place appartient au devis. */
    <div
      className="mx-auto mb-2 w-full max-w-[820px] rounded-[10px] px-5 py-3"
      style={{ backgroundColor: colors.card, fontFamily: font.body }}
      data-atlas="preparation-dictee"
    >
      <DevisDepuisDictee chantierId={chantierId} transcriptionDisponible auto />
    </div>
  );
}
