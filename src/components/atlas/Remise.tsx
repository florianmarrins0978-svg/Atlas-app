"use client";

import { colors } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { LIBELLE_REDUCTION } from "@/lib/reduction-devis";

/**
 * ─── LA REMISE — UNE SEULE FOIS, POUR LES DEUX PIÈCES ─────────────────────
 *
 * **« Remise de N % » depuis le 13 septembre 2026** — sa planche du 12
 * (`appli/devis-remise-main-d-oeuvre-conditions.html`) : le mot a changé, le
 * geste non. Le fichier s'appelait `PrixAccordeAuClient` ; les repères de
 * suite (`data-atlas="…-prix-accorde"`) gardent l'ancien nom, délibérément —
 * ils ne sont lus par aucun écran, et les changer casserait dix suites pour
 * un mot que personne ne voit.
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
 * Le pourcentage que « + Remise » pose d'emblée.
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
export function LigneRemise({
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
  /**
   * Appelé quand le doigt quitte le champ, **avec ce que le CHAMP porte**.
   *
   * ═════════════════════════════════════════════════════════════════════════
   * **IL NE LE DONNAIT PAS, ET LA REMISE REVENAIT — 13 septembre 2026.**
   *
   * Il ne passait rien : l'appelant lisait alors son propre état React, celui
   * du DERNIER RENDU. Or React ne rend pas à la frappe, il le programme —
   * entre la dernière touche et la sortie du champ, rien ne garantit que
   * l'état porte ce qui vient d'être tapé.
   *
   * Vider la case puis toucher ailleurs réécrivait donc **l'ancien
   * pourcentage** : la remise retirée reparaissait, et l'écran, lui, ne disait
   * rien. Mesuré à la sonde — la base repassait de `15.00` à `15.00` là où
   * elle devait tomber à `null`, une fois sur deux.
   *
   * **C'est le défaut du 30 août, celui des prix de ligne** (`DevisCompletClient`,
   * « un prix tapé puis quitté partait à zéro »), resté sur cette pièce-ci
   * quand les autres l'ont appris. Le bouton « + », lui, passait déjà sa
   * valeur — d'où deux chemins dont un seul tenait.
   * ═════════════════════════════════════════════════════════════════════════
   */
  onFini: (valeur: string) => void;
  onRetirer?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ color: colors.or }}>
      <span className="flex items-center gap-1 text-[15px]">
        {!fige && onRetirer && (
          <button
            type="button"
            aria-label={`Retirer la ${LIBELLE_REDUCTION.toLowerCase()}`}
            data-atlas="retirer-prix-accorde"
            onClick={onRetirer}
            className="mr-1 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[15px] leading-none"
            style={{ border: `1px solid ${colors.or}`, color: colors.or }}
          >
            −
          </button>
        )}
        {LIBELLE_REDUCTION} de
        <input
          value={pourcent}
          readOnly={fige}
          inputMode="decimal"
          aria-label="Remise, en pourcentage"
          data-atlas="taux-prix-accorde"
          onChange={(e) => onChange(e.target.value)}
          // **Ce que le champ porte À CET INSTANT**, et non ce que l'appelant
          // croit qu'il porte : voir `onFini` ci-dessus. Passé nu, `onBlur`
          // donnerait son ÉVÉNEMENT comme pourcentage — d'où l'enveloppe.
          onBlur={(e) => onFini(e.currentTarget.value)}
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
export function BoutonRemise({ onPoser }: { onPoser: () => void }) {
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
