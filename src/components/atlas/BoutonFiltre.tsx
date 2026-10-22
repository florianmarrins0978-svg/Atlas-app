"use client";

import { colors } from "@/lib/design-tokens";

/**
 * « Filtre », et son signe à trois traits — sa demande du 27 septembre 2026,
 * sur Terminés.
 *
 * **Sorti de `ListeTermines.tsx` le 22 octobre 2026**, quand ses listes de
 * clients l'ont reçu à leur tour (*« le filtre qu'on utilise dans
 * l'application, avec le signe, avec les trois traits »*) : deux copies du même
 * geste finissent par ne plus se ressembler (`CLAUDE.md` §3).
 *
 * `actif` le remplit d'encre, sur Terminés, quand l'ordre n'est plus celui
 * d'origine. Ses listes de clients ne s'en servent pas : il y garde ses
 * couleurs, sa capture du 22 octobre (*« pas vert »*), et c'est le titre du
 * mois, au-dessus de la liste, qui dit que l'ordre a changé.
 */
export default function BoutonFiltre({
  actif = false,
  onClick,
  dataAtlas = "bouton-filtre",
}: {
  actif?: boolean;
  onClick: () => void;
  dataAtlas?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-atlas={dataAtlas}
      data-actif={actif ? "" : undefined}
      className="flex min-h-11 items-center gap-[7px] whitespace-nowrap rounded-full px-[13px] text-[12.5px]"
      style={{
        backgroundColor: actif ? colors.ink : colors.card,
        color: actif ? colors.cream : colors.inkSoft,
        boxShadow: actif ? "none" : `inset 0 0 0 1px ${colors.line}`,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 4h12M4.5 8h7M7 12h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      Filtre
    </button>
  );
}
