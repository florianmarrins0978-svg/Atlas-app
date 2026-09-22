"use client";

import { colors, font } from "@/lib/design-tokens";
import { jourDeLaRoue, titreDeLaPeriode } from "@/lib/periode";

/**
 * LE FILTRE JOUR, MOIS, ANNÉE — le titre de la période, la roue du téléphone
 * dessous, invisible. Le mois se lit en titre (« Septembre 2026 ») ; un jour
 * choisi s'y écrit (« 22 septembre 2026 »), et la croix d'à côté rend le mois
 * entier sans rouvrir la roue.
 *
 * Un seul dessin pour les fiches de sécurité et les retours d'intervention :
 * ce qui change d'un écran à l'autre, c'est ce qu'on fait de la période
 * choisie (`choisir`), jamais la façon de la choisir.
 */
export default function FiltreDeDate({ periode, choisir }: { periode: string; choisir: (periode: string) => void }) {
  const unJour = periode.length === 10;
  return (
    <div className="mx-[22px] mt-3 flex items-center justify-center gap-1">
      <TitreAvecRoue titre={titreDeLaPeriode(periode)} jour={jourDeLaRoue(periode)} choisir={choisir} dataAtlas="periode-choisie" />
      {unJour && (
        <button type="button" onClick={() => choisir(periode.slice(0, 7))} aria-label="Tout le mois" data-atlas="tout-le-mois" className="flex h-12 w-11 items-center justify-center" style={{ color: colors.muted, fontSize: 17, lineHeight: 1 }}>
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * UNE DATE ÉCRITE EN TITRE, qui ouvre la roue du téléphone au toucher.
 *
 * Sortie du filtre le 22 septembre 2026, quand le jour du passage de la fiche
 * de chantier a pris la même typographie (*« met la même typographie que
 * septembre 2026 mais rajoute le jour »*) : deux copies du dessin finiraient
 * par ne plus se ressembler.
 */
export function TitreAvecRoue({
  titre,
  jour,
  choisir,
  dataAtlas,
}: {
  titre: string;
  /** Le jour `AAAA-MM-JJ` sur lequel la roue s'ouvre. */
  jour: string;
  choisir: (jour: string) => void;
  dataAtlas: string;
}) {
  return (
    <label className="relative flex min-h-12 cursor-pointer items-center justify-center gap-2" data-atlas={dataAtlas}>
      <span className="text-[20px] leading-[1.2]" style={{ fontFamily: font.display }}>{titre}</span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: colors.or }}><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <input
        type="date"
        aria-label="Choisir un jour"
        value={jour}
        onChange={(e) => {
          if (e.target.value) choisir(e.target.value);
        }}
        className="absolute inset-0 h-full w-full opacity-0"
        style={{ fontSize: 16 }}
      />
    </label>
  );
}
