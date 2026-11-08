"use client";

import { colors, surPlein, voile } from "@/lib/design-tokens";

/**
 * UN INTERRUPTEUR des écrans soignés (planche du 26 octobre 2026) : le plein
 * de l'appli quand il est allumé, un voile d'encre quand il est éteint, la
 * pastille au bout du pouce. Les couleurs suivent la charte (`surPlein`,
 * `voile`) : sur Nuit et Sylve, les pôles s'inversent (`CLAUDE.md` §3).
 *
 * Né avec les services à la personne (migration 0178), qui en posent quatre
 * sur trois écrans : Mon entreprise, le devis, la facture.
 */
export default function Interrupteur({
  actif,
  libelle,
  repere,
  enCours = false,
  onChange,
}: {
  actif: boolean;
  /** Ce que l'interrupteur règle, pour qui ne voit pas l'écran. */
  libelle: string;
  /** Le repère des suites : `bascule-<repere>`. */
  repere: string;
  enCours?: boolean;
  onChange: (actif: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      disabled={enCours}
      data-atlas={`bascule-${repere}`}
      onClick={() => onChange(!actif)}
      className="relative h-[32px] w-[52px] flex-none rounded-full disabled:opacity-60"
      style={{
        backgroundColor: actif ? colors.plein : voile(colors.ink, 0.18),
        transition: "background-color .22s cubic-bezier(.22,.61,.36,1)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute left-[3px] top-[3px] h-[26px] w-[26px] rounded-full"
        style={{
          backgroundColor: actif ? surPlein : colors.card,
          boxShadow: `0 1px 2px ${voile(colors.ink, 0.2)}`,
          transform: actif ? "translateX(20px)" : "none",
          transition: "transform .24s cubic-bezier(.34,1.4,.5,1)",
        }}
      />
    </button>
  );
}
