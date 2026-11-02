import { colors, voile } from "@/lib/design-tokens";
import IconeTrait, { type NomIcone } from "./IconeTrait";

/**
 * La pastille d'action des planches soignées (`.pilule` de
 * `appli/soignee/facture.html`, 2 novembre 2026) : un bouton arrondi, une icône
 * au trait, un mot. Une seule pièce pour toutes les pastilles de l'appli, sans
 * quoi chaque écran redessinerait la sienne et elles divergeraient
 * (`CLAUDE.md` §3).
 */
export default function PastilleAjout({
  libelle,
  icone,
  plus = false,
  or = false,
  onClick,
  repere,
}: {
  libelle: string;
  icone?: NomIcone;
  plus?: boolean;
  or?: boolean;
  onClick: () => void;
  repere?: string;
}) {
  return (
    <button
      type="button"
      data-atlas={repere}
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full pl-3 pr-4 text-[14.5px] font-semibold active:scale-[0.98]"
      style={{ color: or ? colors.or : colors.ink, boxShadow: `inset 0 0 0 1.5px ${or ? voile(colors.or, 0.6) : colors.line}` }}
    >
      {icone && <IconeTrait nom={icone} taille={17} />}
      {plus && (
        <span className="text-[20px] font-light leading-none" style={{ marginTop: -2 }}>
          +
        </span>
      )}
      {plus ? ` ${libelle}` : libelle}
    </button>
  );
}
