import { colors, voile } from "@/lib/design-tokens";

/**
 * Ce qu'un choix change, dit dans une plage teintée plutôt que dans un
 * paragraphe gris. Les tons sont ceux des cartes de l'accueil : ils suivent les
 * huit chartes, Nuit et Sylve comprises (`CLAUDE.md` §3).
 *
 * vert : ce qui marche, l'argent qui rentre · ambre : ce qui reste à faire ·
 * rouge : une perte · bleu : une information · or : un chiffre à retenir.
 */
export type Ton = "or" | "vert" | "ambre" | "bleu" | "rouge";

export function teintesDuTon(ton: Ton): { fond: string; texte: string } {
  switch (ton) {
    case "vert":
      return { fond: colors.carteVertFond, texte: colors.carteVertTexte };
    case "ambre":
      return { fond: colors.carteAmbreFond, texte: colors.carteAmbreTexte };
    case "bleu":
      return { fond: colors.carteBleuFond, texte: colors.carteBleuTexte };
    case "rouge":
      return { fond: colors.carteRougeFond, texte: colors.carteRougeTexte };
    case "or":
      return { fond: voile(colors.or, 0.13), texte: colors.ink };
  }
}

export default function PlageTon({
  ton,
  children,
  dataAtlas,
}: {
  ton: Ton;
  children: React.ReactNode;
  dataAtlas?: string;
}) {
  const { fond, texte } = teintesDuTon(ton);
  return (
    <div
      data-atlas={dataAtlas}
      className="rounded-[6px] px-4 py-[13px] text-[14.5px] leading-[1.45]"
      style={{ backgroundColor: fond, color: texte }}
    >
      {children}
    </div>
  );
}
