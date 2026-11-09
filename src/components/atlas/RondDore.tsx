import { colors, font } from "@/lib/design-tokens";

/**
 * Le rond doré au trait, en tête d'une carte : le sceau de « Mon entreprise »
 * dans les Réglages, et l'icône de « Composer ma fiche » depuis sa planche du
 * 9 novembre 2026 (*« tu gardes la D »*, la D étant « comme Réglages »).
 *
 * Un seul dessin pour les deux : recopié, le premier retouché aurait fait deux
 * ors dans la même application (`CLAUDE.md` §3). Ce qu'il porte suit
 * `currentColor` : une initiale en serif, ou une icône au trait.
 */
export default function RondDore({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-[52px] w-[52px] flex-none place-items-center rounded-full text-[22px] leading-none"
      style={{ boxShadow: `inset 0 0 0 1.5px ${colors.or}`, color: colors.or, fontFamily: font.display }}
    >
      {children}
    </span>
  );
}
