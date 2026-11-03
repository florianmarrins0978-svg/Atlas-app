"use client";

import { colors } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import type { LigneAcompte as LigneCalculee } from "@/lib/acomptes-devis";
import CroixRetirer from "@/components/atlas/CroixRetirer";

/**
 * ─── LA LIGNE D'UN ACOMPTE, SOUS LE TOTAL TTC ────────────────────────────────
 *
 * La même pièce que la remise (`Remise.tsx`) :
 * l'or, la croix qui la retire (`CroixRetirer`, la planche du devis du
 * 1er novembre 2026 ; avant, un « − » cerclé de 26 px), le champ de 36 px
 * collé au libellé, le montant à droite. Seuls les MOTS changent — et le
 * montant s'écrit en positif : un acompte n'est pas une remise, c'est une part
 * du total qui tombe ce jour-là.
 *
 * **Le champ porte le taux CUMULÉ** (sa décision du 12 septembre 2026) :
 * « Acompte à mi-parcours 50 % ». Le « (50 % réglés) » qui l'expliquait est parti
 * le 13 septembre — *« enlève les parenthèses »* —, à l'écran comme sur le PDF.
 */
export default function LigneAcompte({
  ligne,
  tauxSaisi,
  fige,
  onChange,
  onFini,
  onRetirer,
}: {
  /** Ce que la règle a calculé pour cet acompte — moment, cumul borné, montant. */
  ligne: LigneCalculee;
  /** Ce que le champ porte, tel qu'il l'a tapé. */
  tauxSaisi: string;
  fige: boolean;
  onChange: (valeur: string) => void;
  /** Appelé quand le doigt quitte le champ, avec ce que le CHAMP porte. */
  onFini: (valeurDuChamp: string) => void;
  onRetirer: () => void;
}) {
  const premier = ligne.rang === 1;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5" style={{ color: colors.or }}>
      <span className="flex flex-wrap items-center gap-1 text-[15px]">
        {!fige && (
          <CroixRetirer
            libelle={`Retirer l'acompte ${ligne.moment}`}
            repere="retirer-acompte"
            onClick={onRetirer}
            className="-ml-[14px]"
          />
        )}
        {premier ? "Acompte" : `Acompte ${ligne.moment}`}
        {/* Le champ et son « % » restent ensemble : « à mi-parcours » fait
            passer à la ligne, et un « % » orphelin se lit mal. */}
        <span className="whitespace-nowrap">
          <input
            value={tauxSaisi}
            readOnly={fige}
            inputMode="decimal"
            aria-label={`Acompte ${ligne.moment}, taux cumulé en pourcentage`}
            data-atlas="taux-acompte"
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onFini(e.currentTarget.value)}
            className="w-9 border-0 bg-transparent p-0 text-right outline-none focus:bg-[var(--voile-champ)]"
            style={{ color: colors.or, fontSize: "16px" }}
          />
          {" %"}
        </span>
        {premier && ligne.moment}
      </span>
      <span className="pt-0.5 text-[15px] tabular-nums">{enEuros(ligne.montant)}</span>
    </div>
  );
}
