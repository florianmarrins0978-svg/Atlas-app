import { colors } from "@/lib/design-tokens";

/**
 * Une plaque d'immatriculation : la liste, la fiche et « En cas d'accident » la
 * dessinent de la même façon.
 *
 * **Aucune couleur écrite en clair** (planche du 26 octobre 2026) : la plaque se
 * dessine en traits de la charte. Une couleur posée à la main serait juste sur
 * cinq chartes et illisible sur Nuit et Sylve (`CLAUDE.md` §3).
 */
export default function Plaque({ texte }: { texte: string }) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-[5px] px-[7px] text-[14px] font-bold leading-[1.5] tracking-[0.05em]"
      style={{
        boxShadow: `inset 0 0 0 1.5px ${colors.line}`,
        color: colors.ink,
        fontFamily: "ui-monospace, Menlo, monospace",
      }}
    >
      {texte}
    </span>
  );
}
