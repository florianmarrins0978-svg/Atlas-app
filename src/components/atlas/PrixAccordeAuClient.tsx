"use client";

import { colors } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { LIBELLE_REDUCTION } from "@/lib/reduction-devis";

/**
 * ─── LE PRIX ACCORDÉ AU CLIENT — UNE SEULE FOIS, POUR LES DEUX PIÈCES ──────
 *
 * **Sa demande du 11 septembre 2026 :** *« on n'a pas mis la réduction client
 * cliquable comme sur le devis »*, puis, dans la foulée : *« reprends
 * exactement celle du devis — couleur, forme, mots »*.
 *
 * **« Exactement » ne se tient pas en recopiant.** Deux blocs jumeaux dans deux
 * écrans divergent au premier ajustement — c'est la règle dupliquée que
 * `CLAUDE.md` §3 refuse, et le dépôt vient d'en payer deux le même jour : la
 * grammaire des TVA et la case du prix, toutes deux corrigées d'un seul côté.
 * Le geste vit donc ici, et le devis comme la facture le montent.
 *
 * Ce qui vient du devis, sans un pixel de changement : l'or, le « − » de 26 px
 * (sa proposition B du 17 août 2026 — en dessous de 24 px on le rate au doigt),
 * le champ de 36 px collé au libellé, le « % » qui le suit, et le montant écrit
 * en négatif à droite.
 */

/**
 * Le pourcentage que « + Prix accordé au client » pose d'emblée.
 *
 * **Écrit ICI et nulle part ailleurs.** Il vivait en double dans le bouton du
 * devis — une fois pour l'écran, une fois pour le serveur — et deux chiffres
 * censés dire la même chose finissent toujours par diverger.
 */
export const REMISE_PAR_DEFAUT = "5";

/**
 * La ligne dorée : ce qui est consenti, entre le prix plein et le net.
 *
 * `onRetirer` absent — document figé — retire le « − » et rend le champ
 * illisible : une pièce partie ne se corrige plus.
 */
export function LignePrixAccorde({
  pourcent,
  montantRetire,
  fige = false,
  onChange,
  onFini,
  onRetirer,
}: {
  /** Ce que porte le champ, tel qu'il l'a tapé. */
  pourcent: string;
  /** Ce que la remise retire, en euros — `null` tant qu'elle ne retire rien. */
  montantRetire: string | number | null;
  fige?: boolean;
  onChange: (valeur: string) => void;
  /** Appelé quand le doigt quitte le champ : c'est l'ÉTAT qui fait foi. */
  onFini: () => void;
  onRetirer?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ color: colors.or }}>
      <span className="flex items-center gap-1 text-[15px]">
        {!fige && onRetirer && (
          <button
            type="button"
            aria-label={`Retirer le ${LIBELLE_REDUCTION.toLowerCase()}`}
            data-atlas="retirer-prix-accorde"
            onClick={onRetirer}
            className="mr-1 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[15px] leading-none"
            style={{ border: `1px solid ${colors.or}`, color: colors.or }}
          >
            −
          </button>
        )}
        {LIBELLE_REDUCTION}
        <input
          value={pourcent}
          readOnly={fige}
          inputMode="decimal"
          aria-label="Prix accordé au client, en pourcentage"
          data-atlas="taux-prix-accorde"
          onChange={(e) => onChange(e.target.value)}
          // Enveloppé, et ce n'est pas du style : passé nu, `onBlur` donnerait
          // son ÉVÉNEMENT comme pourcentage.
          onBlur={() => onFini()}
          className="w-9 border-0 bg-transparent p-0 text-right outline-none focus:bg-[var(--voile-champ)]"
          style={{ color: colors.or, fontSize: "16px" }}
        />
        %
      </span>
      <span className="text-[15px]">
        {montantRetire === null ? "" : `− ${enEuros(Number(montantRetire))}`}
      </span>
    </div>
  );
}

/**
 * Le chemin de secours pour en poser une à la main.
 *
 * Discret, et seulement quand il n'y en a pas : une pièce qui porte déjà sa
 * remise n'a pas besoin qu'on lui propose d'en poser une. Il l'a d'abord
 * demandé à la VOIX ; ceci est ce qui reste quand on n'a pas envie de parler.
 */
export function BoutonPrixAccorde({ onPoser }: { onPoser: () => void }) {
  return (
    <button
      type="button"
      data-atlas="poser-prix-accorde"
      onClick={onPoser}
      className="mt-2.5 text-[13.5px]"
      style={{ color: colors.or }}
    >
      + {LIBELLE_REDUCTION}
    </button>
  );
}
