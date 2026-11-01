"use client";

import IconeTrait, { type NomIcone } from "@/components/atlas/IconeTrait";
import { colors, voile } from "@/lib/design-tokens";

/**
 * Un ajout du devis, en vraie pastille — la planche du chantier, choisie le
 * 1er novembre 2026 (*« laisse comme tu as fait, ensuite code ça »*). Avant,
 * des liens de 14 points en deux couleurs, qu'on ne reconnaissait pas comme
 * des boutons.
 *
 * **Le « + » reste un caractère, pas une icône**, quand il porte le nom du
 * geste : « + Ajouter une ligne » et « + Ajouter une TVA » sont les noms que
 * lisent un lecteur d'écran et trente-deux suites. Une icône muette les aurait
 * renommés en silence.
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
      onClick={onClick}
      data-atlas={repere}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full pl-3.5 pr-[18px] text-[14.5px] font-semibold active:scale-[0.98]"
      style={{
        color: or ? colors.or : colors.ink,
        boxShadow: `inset 0 0 0 1.5px ${or ? voile(colors.or, 0.6) : colors.line}`,
      }}
    >
      {icone && <IconeTrait nom={icone} taille={18} />}
      {plus && (
        <span
          className="text-[20px] font-light leading-none"
          style={{ marginTop: -2 }}
        >
          +
        </span>
      )}
      {plus ? ` ${libelle}` : libelle}
    </button>
  );
}
