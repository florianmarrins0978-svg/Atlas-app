import type { ReactNode } from "react";
import { colors, voile } from "@/lib/design-tokens";

/**
 * LE RUBAN QUI GLISSE : des cases côte à côte, et la case prise se soulève sur
 * un fond qui glisse jusqu'à elle.
 *
 * **Né du « Comment » du paiement** (sa planche du 2 novembre 2026, « la A »),
 * **repris par le sens du tri de Terminés** (sa planche du 3 novembre, « le
 * sens se choisit sur la barre qui glisse, celle du moyen de paiement »). Sorti
 * de `PaiementClient` à ce moment-là : deux copies du même geste finissent par
 * ne plus glisser pareil (`CLAUDE.md` §3).
 *
 * Il ne porte que le fond et ce qui glisse ; chaque écran dessine ses cases,
 * qui posent `CASE_DU_RUBAN` pour passer au-dessus du fond.
 */
export const CASE_DU_RUBAN = "relative z-[1]";

export default function RubanGlissant({
  nombre,
  rang,
  children,
  repere,
  className,
  ...etiquette
}: {
  nombre: number;
  /** La case prise, comptée depuis 0. */
  rang: number;
  children: ReactNode;
  repere?: string;
  className?: string;
} & ({ "aria-labelledby": string } | { "aria-label": string })) {
  return (
    <div
      role="group"
      {...etiquette}
      className={`relative grid rounded-[18px] p-1 ${className ?? ""}`}
      style={{ gridTemplateColumns: `repeat(${nombre}, minmax(0, 1fr))`, backgroundColor: voile(colors.ink, 0.06) }}
      data-atlas={repere}
    >
      {/* La case se soulève, elle ne s'encadre pas. Sans animation pour qui
          l'a demandé à son téléphone. */}
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 top-1 rounded-[14px] transition-transform duration-[240ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none"
        style={{
          width: `calc((100% - 8px) / ${nombre})`,
          transform: `translateX(${rang * 100}%)`,
          backgroundColor: colors.card,
          boxShadow: `0 1px 2px ${voile(colors.ink, 0.08)}, 0 4px 12px ${voile(colors.ink, 0.08)}`,
        }}
      />
      {children}
    </div>
  );
}
