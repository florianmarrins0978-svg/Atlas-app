import { colors, font } from "@/lib/design-tokens";

// L'action principale, refaite le 10 août 2026 avec le reste de l'application.
//
// **Ce bouton est sur vingt-sept écrans** : le changer, c'est changer partout
// d'un coup — et c'est bien l'intention. Trois choses le rapprochent de l'écran
// des chantiers que le patron a retenu : le rayon tombe de 16 px à 5, le libellé
// passe à la serif de titre, et la hauteur se resserre.
//
// **Le rayon est ce qui compte le plus.** Un rectangle presque droit se lit
// comme une pièce imprimée ; le même arrondi à 16 px se lit comme un bouton
// d'application — c'est très exactement ce dont le patron ne voulait plus.

export default function PrimaryButton({
  children,
  onClick,
  href,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className =
    "flex w-full items-center justify-center gap-2 py-4 text-[18px] transition-transform active:scale-[0.985]";
  const forme = { borderRadius: 5, fontFamily: font.display };

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={`${className} cursor-not-allowed`}
        style={{ ...forme, backgroundColor: colors.line, color: colors.muted }}
      >
        {children}
      </button>
    );
  }

  const style = { ...forme, backgroundColor: colors.rust, color: colors.card };

  if (href) {
    return (
      <a href={href} className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}
