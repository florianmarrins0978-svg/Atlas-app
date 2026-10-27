import { colors, font } from "@/lib/design-tokens";
import CocheRonde from "./CocheRonde";

/**
 * Un choix posé en carte, à côté de son voisin : on voit d'un coup d'œil
 * lequel est pris. Franchise ou assujettie, sous le nom ou avec le SIRET.
 *
 * Le choix pris se cerne de l'encre d'action (`rust`), pas d'or : un cadre doré
 * autour d'un bloc, il l'a retiré le 25 octobre 2026.
 */
export default function CarteChoix({
  pris,
  onChoix,
  titre,
  detail,
  children,
  police,
  dataAtlas,
}: {
  pris: boolean;
  onChoix: () => void;
  titre: string;
  detail?: string;
  /** Une illustration au-dessus du titre, par exemple l'en-tête du devis. */
  children?: React.ReactNode;
  /**
   * La police du titre. Une carte de « L'allure de mes devis » écrit le nom
   * d'une police DANS cette police : c'est la seule chose qu'on y regarde.
   */
  police?: string;
  dataAtlas?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pris}
      onClick={onChoix}
      data-atlas={dataAtlas}
      className="flex min-h-[92px] flex-col items-start gap-1 rounded-[12px] p-3.5 text-left transition-shadow duration-200"
      style={{
        backgroundColor: colors.card,
        boxShadow: pris ? `inset 0 0 0 2px ${colors.rust}` : `inset 0 0 0 1px ${colors.lineSoft}`,
      }}
    >
      {children ?? (
        <span className="mb-1.5">
          <CocheRonde pris={pris} />
        </span>
      )}
      <span className="text-[17.5px] leading-[1.2]" style={{ fontFamily: police ?? font.display, color: colors.ink }}>
        {titre}
      </span>
      {detail && (
        <span className="text-[13.5px] leading-[1.35]" style={{ color: colors.inkSoft }}>
          {detail}
        </span>
      )}
    </button>
  );
}
