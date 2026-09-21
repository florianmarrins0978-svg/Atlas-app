"use client";

import { colors } from "@/lib/design-tokens";
import { LIBELLE_MAIN_DOEUVRE } from "@/lib/main-doeuvre-devis";

/**
 * ─── « DONT MAIN D'ŒUVRE HT », SOUS LE TOTAL HT ─────────────────────────────
 *
 * La lecture B de sa planche du 12 septembre 2026 : la main d'œuvre est déjà
 * dans les lignes, on la NOMME — rien ne bouge aux totaux. La même pièce que
 * la remise et les acomptes : le « − » cerclé de 26 px, le champ collé au
 * libellé, l'unité qui le suit. Mais pas l'or : l'or dit ce qui est consenti ou
 * ce qui tombe ; ceci n'est qu'une part nommée, elle se lit en second plan.
 *
 * **Le champ est vide à l'ouverture**, et c'est voulu : un montant de main
 * d'œuvre n'a pas de valeur plausible, et un chiffre d'office s'imprimerait chez
 * un client (`docs/AGENT.md` §3). La borne — jamais plus que le total HT — se
 * pose quand le doigt quitte le champ, par le serveur (`montantMainDoeuvreValide`).
 */
export default function LigneMainDoeuvre({
  montant,
  fige,
  onChange,
  onFini,
  onRetirer,
}: {
  /** Ce que le champ porte, tel qu'il l'a tapé. */
  montant: string;
  fige: boolean;
  /**
   * Les trois gestes sont ABSENTS quand la ligne est figée, et c'est le cas
   * de la page de la facture depuis le 21 septembre 2026 : elle LIT la main
   * d'œuvre, elle ne la saisit plus (c'est la page « Remplir la facture » qui
   * la pose, comme le devis). Les exiger aurait obligé cet écran-là à passer
   * trois fonctions qui ne servent à rien — du code mort déguisé en API.
   */
  onChange?: (valeur: string) => void;
  /** Appelé quand le doigt quitte le champ, avec ce que le CHAMP porte. */
  onFini?: (valeurDuChamp: string) => void;
  onRetirer?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5" style={{ color: colors.inkSoft }}>
      <span className="flex items-center gap-1 text-[14px]">
        {!fige && onRetirer && (
          <button
            type="button"
            aria-label="Retirer la main d’œuvre"
            data-atlas="retirer-main-doeuvre"
            onClick={onRetirer}
            className="mr-1 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[15px] leading-none"
            style={{ border: `1px solid ${colors.inkSoft}`, color: colors.inkSoft }}
          >
            −
          </button>
        )}
        {LIBELLE_MAIN_DOEUVRE}
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap text-[14px] tabular-nums">
        <input
          value={montant}
          readOnly={fige}
          inputMode="decimal"
          autoFocus={!fige && montant === ""}
          aria-label="Main d’œuvre HT, en euros"
          data-atlas="montant-main-doeuvre"
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={(e) => onFini?.(e.currentTarget.value)}
          className="w-20 border-0 bg-transparent p-0 text-right outline-none focus:bg-[var(--voile-champ)]"
          style={{ color: colors.ink, fontSize: "16px" }}
        />
        €
      </span>
    </div>
  );
}
