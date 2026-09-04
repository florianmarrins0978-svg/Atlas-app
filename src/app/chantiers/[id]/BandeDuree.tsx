"use client";

import { colors, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { DUREES } from "@/lib/durees-chantier";

// La bande déroulante des durées, telle que le patron l'a demandée — et posée
// aux DEUX endroits où il peut vouloir la toucher : l'écran Informations (« ce
// chantier prend combien de temps ? ») et l'écran d'envoi (« quels jours puis-je
// proposer ? »). Elle n'existait qu'au second, et il l'a cherchée au premier.
//
// Un seul composant, une seule liste (`src/lib/durees-chantier.ts`) : deux
// molettes qui divergent, c'est le patron qui choisit deux durées différentes
// pour le même chantier sans jamais savoir laquelle compte.

type Props = {
  label: string;
  /**
   * `null` quand rien n'a encore été dit de la durée. La bande affiche alors
   * « non précisé » plutôt qu'une valeur par défaut : montrer « 1 journée » sur
   * un chantier dont personne n'a parlé de la durée, c'est **inventer une
   * donnée** — et elle finirait dans un prix (`CLAUDE.md` §4).
   */
  valeur: number | null;
  onChange: (demiJournees: number) => void;
  /** Phrase sous la bande — ce que la durée change, dit dans le contexte. */
  aide?: string;
  disabled?: boolean;
};

export default function BandeDuree({ label, valeur, onChange, aide, disabled }: Props) {
  return (
    <div>
      {/* La voix des libellés — celle de l'écran retenu le 10 août 2026. Cette
          bande est sur DEUX écrans (Informations, envoi au client) : lui garder
          l'ancienne voix aurait fait bégayer la page à cet endroit-là seul. */}
      <p className={libelleCaps} style={{ color: colors.muted, marginBottom: 8 }}>
        {label}
      </p>
      <select
        aria-label="Durée du chantier"
        value={valeur ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-[4px] px-[15px] py-3 outline-none disabled:opacity-40"
        // 16 px : en dessous, iOS agrandit la page à l'ouverture de la molette
        // et le patron se retrouve avec un écran zoomé qu'il doit rétablir.
        style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
      >
        {valeur === null && <option value="">Non précisé</option>}
        {DUREES.map((d) => (
          <option key={d.demiJournees} value={d.demiJournees}>
            {d.libelle}
          </option>
        ))}
      </select>
      {/* **L'encre douce plutôt que le gris — 4 septembre 2026.** Cette phrase
          est le seul endroit où la bande apprend quelque chose : « 8 jours
          ouvrés d'affilée seront réservés ». Le gris des méta tient 2,85 à 3,59
          de contraste sur les six chartes claires, pour un seuil de 4,5 — la
          première chose qui disparaît en plein soleil, sur un chantier. Un
          avertissement qu'on ne lit pas n'a pas averti. */}
      {aide && (
        <p className={`mt-2 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          {aide}
        </p>
      )}
    </div>
  );
}
