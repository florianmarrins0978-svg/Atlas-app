import { colors } from "@/lib/design-tokens";
import Icone from "./Icones";

/**
 * « Ajouter une pièce », au piquage comme sous chaque réseau : une pilule
 * cernée, le « + » doré (planche soignée du 26 octobre 2026). Un seul dessin
 * pour les deux endroits, qui ne divergeront donc pas.
 */
export default function BoutonAjouter({ libelle, onClick }: { libelle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-atlas="ajouter-piece"
      className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-0 bg-transparent text-[15.5px] font-semibold"
      style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
    >
      <span style={{ color: colors.or }}>
        <Icone nom="plus" taille={20} />
      </span>
      {libelle}
    </button>
  );
}
