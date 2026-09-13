"use client";

import { useState } from "react";
import { colors } from "@/lib/design-tokens";

/**
 * ─── L'UNITÉ D'UNE LIGNE, APRÈS LA QUANTITÉ ─────────────────────────────────
 *
 * **Sa demande du 12 septembre 2026 :** *« après Qté il faut rajouter une
 * colonne unité (pour les ml, kg, m³ etc.) »*.
 *
 * La colonne existait en base (`lignes_prix.unite`, migration 0070) et le PDF
 * l'imprimait déjà — « 4 m³ » dans la colonne Qté — sans que cet écran la
 * montre ni la saisisse. Une dictée pouvait la poser, un doigt ne le pouvait pas.
 *
 * **Les unités usuelles viennent sous le champ quand il prend le doigt**, pour
 * ne pas taper « m³ » sur un clavier de téléphone. Ce qu'il tape reste
 * possible : la rangée propose, elle n'impose rien.
 */
export const UNITES_USUELLES = ["u", "ml", "m²", "m³", "kg", "h", "forfait"] as const;

export default function ChampUnite({
  valeur,
  fige,
  aria,
  onChange,
  onFini,
}: {
  valeur: string;
  fige: boolean;
  aria: string;
  onChange: (v: string) => void;
  /** Reçoit ce qui est retenu — le champ quitté, ou l'unité touchée. */
  onFini: (valeur: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="flex flex-col items-end sm:items-stretch">
      <input
        value={valeur}
        readOnly={fige}
        placeholder="u"
        aria-label={aria}
        data-atlas="unite-ligne"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOuvert(true)}
        onBlur={(e) => {
          setOuvert(false);
          onFini(e.currentTarget.value);
        }}
        className="w-16 border-0 bg-transparent px-1 text-right outline-none focus:bg-[var(--voile-champ)] sm:w-full"
        style={{
          color: colors.ink,
          fontSize: "16px",
          minHeight: 44,
          borderBottom: valeur.trim() === "" && !fige ? `1px solid ${colors.lineSoft}` : "1px solid transparent",
        }}
      />
      {ouvert && !fige && (
        <div className="mt-1 flex flex-wrap justify-end gap-1.5 sm:justify-start" data-atlas="unites-usuelles">
          {UNITES_USUELLES.map((u) => (
            <button
              key={u}
              type="button"
              // `onMouseDown` : avant que le champ perde le focus, sinon la
              // rangée se ferme sous le doigt et le clic tombe dans le vide.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(u);
                onFini(u);
                setOuvert(false);
              }}
              aria-pressed={valeur === u}
              className="min-h-[32px] rounded-full px-3 text-[13px] font-medium"
              style={{
                border: `1px solid ${valeur === u ? colors.plein : colors.line}`,
                backgroundColor: valeur === u ? colors.plein : colors.cream,
                color: valeur === u ? colors.card : colors.ink,
              }}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
