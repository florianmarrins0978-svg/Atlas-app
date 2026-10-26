import { colors, font } from "@/lib/design-tokens";

/**
 * UNE LIGNE DE RÉGLAGE dans son paquet : le libellé en clair, la valeur en serif.
 *
 * **Les libellés s'écrivent en toutes lettres** (planches du 25 octobre 2026) :
 * « Nom de l'entreprise » à 14 px, et non plus NOM DE L'ENTREPRISE en capitales
 * espacées de 11 px, qu'un œil de soixante-cinq ans déchiffre au lieu de lire.
 *
 * **Ce qui manque se dit en ambre, à la place du rouge, et sans cadre** : le
 * libellé passe en ambre et la phrase dessous dit la conséquence. L'ambre est
 * la couleur de ce qui reste à faire, partout dans l'appli ; le rouge, celle
 * d'une perte.
 */
export default function LigneReglage({
  libelle,
  children,
  sous,
  manque = false,
  htmlFor,
  dataAtlas,
}: {
  libelle: React.ReactNode;
  children: React.ReactNode;
  /** Une ligne dessous : la conséquence d'un manque, ou ce qu'on en déduit. */
  sous?: React.ReactNode;
  manque?: boolean;
  /** L'identifiant du champ : toucher le libellé y pose le curseur. */
  htmlFor?: string;
  dataAtlas?: string;
}) {
  const teinteLibelle = manque ? colors.carteAmbreTexte : colors.inkSoft;
  return (
    <div className="relative py-3.5" data-atlas={dataAtlas}>
      {/* Le filet se pose au-dessus de chaque ligne ; le paquet rogne le premier. */}
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-[14px] font-semibold" style={{ color: teinteLibelle }}>
          {libelle}
        </label>
      ) : (
        <span className="block text-[14px] font-semibold" style={{ color: teinteLibelle }}>
          {libelle}
        </span>
      )}
      <div className="mt-[3px]">{children}</div>
      {sous && (
        <p
          className="mt-1 text-[13.5px] leading-[1.4]"
          style={{ color: manque ? colors.carteAmbreTexte : colors.inkSoft, fontWeight: manque ? 600 : 400 }}
        >
          {sous}
        </p>
      )}
    </div>
  );
}

/** La valeur d'une ligne : serif 18 px, sans cadre, comme sur la planche. */
export const styleValeurReglage: React.CSSProperties = {
  fontFamily: font.display,
  fontSize: 18,
  lineHeight: 1.3,
  color: colors.ink,
  background: "transparent",
  border: 0,
  outline: "none",
  padding: 0,
  width: "100%",
  fontVariantNumeric: "lining-nums",
};
