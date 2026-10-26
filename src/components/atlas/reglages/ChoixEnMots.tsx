import { colors, voile } from "@/lib/design-tokens";

/**
 * Le choix entre deux, trois ou quatre mots : une pastille claire sous le mot
 * pris. Au mois ou à l'année, Mes fournisseurs ou Mes partenaires, le rythme
 * de la TVA, Un mot ou Une règle.
 *
 * **Une seule pièce pour tous les Réglages soignés** (planches des 25 et
 * 26 octobre 2026). Quatre écrans en avaient écrit chacun sa copie, à des
 * rayons différents (9 px, 12 px, la capsule) : deux écritures du même geste
 * finissent par ne plus se ressembler (`CLAUDE.md` §3). Aux bouts ronds, comme
 * les boutons de l'appli ; et un réglage n'est pas une action : le vert plein
 * reste au seul bouton du bas.
 *
 * Le retrait est court pour que quatre mots tiennent sur la ligne d'un
 * téléphone, « Demandes » compris. `base` élargit un mot plus long que l'autre
 * (« À l'année, 2 mois offerts » contre « Au mois »).
 */
export default function ChoixEnMots<V extends string>({
  options,
  valeur,
  onChoix,
  libelle,
  className,
}: {
  options: readonly { valeur: V; libelle: string; dataAtlas?: string; base?: string }[];
  valeur: V;
  onChoix: (v: V) => void;
  /** Ce que le lecteur d'écran annonce avant les mots. */
  libelle: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={libelle}
      className={`flex gap-1 rounded-full p-1 ${className ?? ""}`}
      style={{ backgroundColor: voile(colors.ink, 0.06) }}
    >
      {options.map((o) => {
        const pris = o.valeur === valeur;
        return (
          <button
            key={o.valeur}
            type="button"
            aria-pressed={pris}
            data-atlas={o.dataAtlas}
            onClick={() => onChoix(o.valeur)}
            className={`min-h-[44px] min-w-0 rounded-full px-1.5 text-[15px] font-semibold leading-tight transition-colors duration-200 ${o.base ? "" : "flex-1"}`}
            style={{
              flexBasis: o.base,
              flexShrink: o.base ? 0 : undefined,
              backgroundColor: pris ? colors.card : "transparent",
              color: pris ? colors.ink : colors.inkSoft,
              boxShadow: pris ? `0 1px 2px ${voile(colors.ink, 0.14)}` : "none",
            }}
          >
            {o.libelle}
          </button>
        );
      })}
    </div>
  );
}
