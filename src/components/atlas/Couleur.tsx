"use client";

import { colors, libelleCaps, texteSituation } from "@/lib/design-tokens";

/**
 * Une couleur : le nuancier de l'appareil, et trois ou quatre raccourcis.
 *
 * **Le nuancier libre est le réglage, les pastilles ne sont qu'un raccourci.**
 * Sa règle du 23 août : *« le fond teinté fait-le modifiable »*. Une liste
 * fermée de trois teintes n'est pas modifiable — c'est un choix, pas une
 * couleur.
 *
 * **Deux écrans la partagent** depuis le 29 septembre 2026 : l'allure des devis,
 * et les couleurs du planning, sa demande mot pour mot : *« met la même chose
 * que pour les couleurs des devis »*. Une seule, pour qu'elles ne divergent pas.
 */
export function Couleur({
  titre,
  valeur,
  clef,
  aide,
  rapides,
  onChoisir,
}: {
  titre: string;
  valeur: string;
  clef: string;
  /** Une ligne sous le réglage. Le planning n'en met pas : sa légende suffit. */
  aide?: string;
  rapides: [string, string][];
  onChoisir: (v: string) => void;
}) {
  return (
    <div className="mb-5">
      <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
        {titre}
      </p>
      <div className="flex items-center gap-2.5">
        <input
          type="color"
          value={valeur}
          data-atlas={`couleur-${clef}`}
          aria-label={titre}
          onChange={(e) => onChoisir(e.target.value)}
          // 44 px : la cible du pouce. Un nuancier plus petit se rate.
          className="h-[44px] w-[54px] flex-none cursor-pointer rounded-[8px] border-0 bg-transparent p-0"
        />
        <span
          data-atlas={`couleur-${clef}-valeur`}
          className="text-[13px]"
          style={{ color: colors.muted, fontVariantNumeric: "tabular-nums" }}
        >
          {valeur.toUpperCase()}
        </span>
        <span className="ml-auto flex gap-1.5">
          {rapides.map(([teinte, nom]) => (
            <button
              key={teinte}
              type="button"
              aria-label={nom}
              aria-pressed={valeur === teinte}
              data-atlas={`rapide-${clef}-${teinte.slice(1)}`}
              onClick={() => onChoisir(teinte)}
              className="h-[34px] w-[34px] rounded-full"
              style={{
                backgroundColor: teinte,
                boxShadow:
                  valeur === teinte
                    ? `0 0 0 2px ${colors.cream}, 0 0 0 4px ${colors.or}`
                    : `inset 0 0 0 1px ${colors.line}`,
              }}
            />
          ))}
        </span>
      </div>
      {aide && (
        <p className={`mt-1.5 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          {aide}
        </p>
      )}
    </div>
  );
}
