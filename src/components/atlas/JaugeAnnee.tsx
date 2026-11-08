import { colors, voile } from "@/lib/design-tokens";
import { teintesDuTon, type Ton } from "./reglages/PlageTon";

/**
 * La jauge de Mon année : le plein au ton de ce qu'elle dit, le trait là où sa
 * saison de l'an dernier voulait qu'il soit (sa planche du 8 novembre 2026).
 * La même pour l'écran de Réglages et pour la ligne de Terminés.
 */
export default function JaugeAnnee({ part, trait, ton }: { part: number; trait: number | null; ton: Ton }) {
  const plein = ton === "or" ? colors.or : teintesDuTon(ton).texte;
  const pct = (x: number) => `${Math.max(0, Math.min(100, x * 100)).toFixed(1)}%`;
  return (
    <span className="relative block h-2 rounded-[4px]" style={{ backgroundColor: voile(colors.ink, 0.1) }} aria-hidden="true">
      <span className="block h-full max-w-full rounded-[4px]" style={{ width: pct(part), backgroundColor: plein }} />
      {trait !== null && (
        <i className="absolute -top-1 -ml-px block h-4 w-0.5 rounded-[1px]" style={{ left: pct(trait), backgroundColor: colors.ink }} />
      )}
    </span>
  );
}
