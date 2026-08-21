"use client";

import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import DevisDepuisDictee from "../DevisDepuisDictee";

/**
 * Le voile qui fabrique le devis pendant qu'il regarde.
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
 * 1. **Le devis est rendu DESSOUS, pas remplacé.** Si la chaîne échoue — pas
 *    de transcription, aucun tarif, une panne réseau —, il lui reste sa
 *    feuille et son crayon : « Ouvrir le devis tel quel » écarte le voile et
 *    il écrit à la main. Un écran qui n'aurait que l'échec à montrer serait un
 *    cul-de-sac.
 *
 * 2. **On écarte sans naviguer.** Un renvoi vers une autre adresse ramènerait
 *    ici, où la préparation repartirait aussitôt : le voile se referme donc en
 *    mémoire, le temps de cette visite. Rien n'est écrit pour désarmer la
 *    prochaine — s'il revient, c'est qu'il veut réessayer.
 *
 * 3. **Aucune règle ici.** Ce qui décide de la présence du voile est une
 *    fonction pure (`src/lib/devis-a-preparer.ts`), et ce qui mène la chaîne
 *    est le composant qui la menait déjà (`DevisDepuisDictee`, mode `auto`).
 *    Une seconde implémentation aurait divergé au premier ajustement
 *    (`CLAUDE.md` §3).
 * ───────────────────────────────────────────────────────────────────────────
 */
export default function PreparationDictee({ chantierId }: { chantierId: string }) {
  const [ecarte, setEcarte] = useState(false);
  if (ecarte) return null;

  return (
    <div
      // Le voile couvre le devis sans le démonter : la préparation aboutie
      // rafraîchit la page, et c'est le serveur qui décide alors de ne plus le
      // rendre du tout.
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: colors.rustTint, fontFamily: font.body }}
      data-atlas="preparation-dictee"
    >
      <p
        className="mb-2 text-center text-[26px] leading-tight"
        style={{ fontFamily: font.display, color: colors.ink }}
      >
        Votre devis
      </p>
      <p className="mb-6 max-w-[300px] text-center text-[13px] leading-snug" style={{ color: colors.muted }}>
        Atlas reprend ce que vous avez dicté sur le chantier et l&apos;écrit ici.
      </p>

      <div className="w-full max-w-[380px]">
        <DevisDepuisDictee chantierId={chantierId} transcriptionDisponible auto />
      </div>

      {/* La sortie de secours, toujours là : voir le parti pris n°1 ci-dessus. */}
      <button
        type="button"
        onClick={() => setEcarte(true)}
        data-atlas="ouvrir-devis-tel-quel"
        className="mt-8 text-[13px] font-medium"
        style={{ color: colors.muted }}
      >
        Ouvrir le devis tel quel
      </button>
    </div>
  );
}
