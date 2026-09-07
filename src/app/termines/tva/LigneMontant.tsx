"use client";

import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";

/**
 * Une ligne de l'addition : son intitulé, son montant, et le geste qui le copie.
 *
 * ─── CE QU'ELLE REMPLACE, ET POURQUOI ───────────────────────────────────────
 *
 * `MontantCopiable` posait deux TUILES côte à côte — « Collectée » et
 * « Déductible » —, chacune centrant son montant, et le « Reste à payer »
 * vivait dans un encadré à part. Trois conséquences, toutes vues sur capture :
 *
 * 1. **on ne voyait pas que le troisième chiffre est la soustraction des deux
 *    autres.** Trois présentations différentes pour une seule opération ;
 * 2. **deux montants centrés ne s'alignent jamais.** Un chiffre se compare sur
 *    sa colonne des unités, et deux nombres de longueurs différentes centrés
 *    dans deux tuiles ne partagent aucun bord ;
 * 3. **le « Reste à payer » ne se copiait pas.** C'est pourtant le seul des
 *    trois qu'il recopie pour payer : les deux qu'on pouvait copier étaient
 *    les deux dont il n'a pas besoin dans ce geste-là.
 *
 * Les trois lignes emploient donc la même pièce, alignée à droite sur la même
 * colonne. Chaque montant portant deux décimales, l'alignement à droite EST
 * l'alignement des virgules : il ne dépend d'aucun caractère tabulaire, donc
 * d'aucune police.
 *
 * **La hiérarchie passe par la TAILLE, plus par la couleur.** Le total était
 * en `colors.rust` quand les deux termes étaient en `colors.ink` ; or sur Nuit
 * et Sylve l'accent EST l'encre (`chartes.ts`) — la distinction n'existait que
 * sur six chartes sur huit. Vingt pixels contre trente-quatre se lisent sur les
 * huit.
 *
 * **Et le carré DIT qu'il a copié** — c'était déjà vrai, et cela ne bouge pas :
 * un bouton muet se fait appuyer trois fois, et l'on finit par coller du vide.
 * Le mot prend la place de l'intitulé, à gauche : posé ailleurs, il pousserait
 * le montant.
 */
export default function LigneMontant({
  libelle,
  montant,
  marque,
  negatif = false,
  total = false,
}: {
  libelle: string;
  /** Déjà mis en forme — « 1 620,00 € ». C'est ce texte-là qui est copié. */
  montant: string;
  /** Le repère que les suites visent, plutôt qu'un nom de balise. */
  marque: string;
  /** Pose le signe moins À GAUCHE du montant, hors de sa colonne. */
  negatif?: boolean;
  /** La ligne du total : deux fois plus grande, intitulé en or. */
  total?: boolean;
}) {
  const [dit, setDit] = useState<string | null>(null);

  async function copier() {
    if (dit) return;
    try {
      await navigator.clipboard.writeText(montant);
      setDit("copié");
    } catch {
      // Le presse-papier refuse hors page sécurisée, ou quand la permission a
      // été retirée. Le dire vaut mieux qu'un bouton qui ne répond pas.
      setDit("impossible");
    }
    setTimeout(() => setDit(null), 1600);
  }

  return (
    <button
      type="button"
      onClick={copier}
      data-atlas={marque}
      aria-label={`Copier ${libelle.toLowerCase()}`}
      className={`grid w-full items-baseline gap-x-2.5 text-left ${total ? "pt-[15px]" : "py-[11px]"}`}
      style={{ gridTemplateColumns: "1fr auto 24px", minHeight: 48 }}
    >
      <span
        className="text-[9.5px] font-medium uppercase tracking-[0.28em]"
        style={{ color: dit || total ? colors.or : colors.muted }}
      >
        {dit ?? libelle}
      </span>
      <span
        className="relative justify-self-end font-medium"
        style={{
          fontFamily: font.display,
          fontSize: total ? 34 : 20,
          letterSpacing: total ? "-0.01em" : undefined,
          color: colors.ink,
          fontVariantNumeric: "tabular-nums lining-nums",
        }}
      >
        {negatif && (
          // **Un vrai signe moins (−), et POSÉ HORS DE LA COLONNE.** Sa demande
          // du 13 août 2026 : « si le reste à payer est négatif, il faut qu'il
          // le marque négativement ». Le trait d'union du formatage est deux
          // fois plus court et posé plus bas : à trente-quatre pixels, au
          // soleil, il se lit comme une poussière. Sorti du flux, il ne décale
          // pas non plus les chiffres, qui doivent rester alignés d'une ligne
          // à l'autre.
          <span
            aria-hidden="true"
            className="absolute right-full"
            style={{ marginRight: total ? 10 : 7, color: colors.muted, fontWeight: 400 }}
          >
            {"−"}
          </span>
        )}
        {montant}
      </span>
      <svg
        width={total ? 15 : 14}
        height={total ? 15 : 14}
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.or}
        strokeWidth="1.6"
        aria-hidden="true"
        className="justify-self-end self-center"
      >
        <rect x="9" y="9" width="11" height="11" rx="2.4" />
        <path d="M15 5.6A2.6 2.6 0 0 0 12.4 3H6.6A2.6 2.6 0 0 0 4 5.6v5.8A2.6 2.6 0 0 0 6.6 14" strokeLinecap="round" />
      </svg>
    </button>
  );
}
