"use client";

import { colors, font } from "@/lib/design-tokens";
import { LIBELLE_NATURE, NATURES_ABSENCE, phraseDuCompte, type NatureAbsence } from "@/lib/nature-absence";

/**
 * « Pourquoi ? » : les six motifs d'une absence, d'un appui.
 *
 * Sa planche du 5 novembre 2026, validée (`appli/soignee/motif-absence.html`,
 * « très bien ») : sous le salarié qui manque, au planning, et dans la feuille
 * d'Équipe. Écrit une fois pour les deux, sans quoi les deux listes finiraient
 * par ne plus dire les mêmes mots.
 *
 * **Rien n'est obligé** : sans motif, l'absence se note quand même. « Pourquoi ? »
 * reste alors en ambre, et Jours travaillés le redemandera. Retoucher le motif
 * choisi le retire.
 */
export default function ChoixDeLaNature({
  nature,
  onChoisir,
  etiquette = "Pourquoi ?",
}: {
  nature: NatureAbsence | null;
  onChoisir: (nature: NatureAbsence | null) => void;
  /** « Pourquoi ? » au-dessus des motifs ; `null` quand la ligne le dit déjà (Réglages). */
  etiquette?: string | null;
}) {
  const phrase = phraseDuCompte(nature);
  return (
    <div data-atlas="choix-de-la-nature">
      {etiquette && (
        <p
          className="mb-2 mt-3.5 px-0.5 text-[15px]"
          style={{ fontFamily: font.body, fontWeight: nature ? 600 : 700, color: nature ? colors.inkSoft : colors.carteAmbreTexte }}
        >
          {etiquette}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Pourquoi il est absent">
        {NATURES_ABSENCE.map((n) => (
          <button
            key={n}
            type="button"
            data-nature={n}
            aria-pressed={nature === n}
            onClick={() => onChoisir(nature === n ? null : n)}
            className="min-h-[50px] rounded-[12px] border-0 px-2.5 text-[15.5px] font-semibold"
            style={{
              fontFamily: font.body,
              background: colors.card,
              color: colors.ink,
              boxShadow: nature === n ? `inset 0 0 0 2px ${colors.rust}` : `inset 0 0 0 1px ${colors.line}`,
              transition: "box-shadow 180ms ease-out",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {LIBELLE_NATURE[n]}
          </button>
        ))}
      </div>
      {phrase && (
        <p data-atlas="compte-de-la-nature" className="mt-2 px-0.5 text-[14px]" style={{ color: colors.inkSoft }}>
          {phrase}
        </p>
      )}
    </div>
  );
}
