"use client";

import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";

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
 *
 * **`allure="soignee"` : le nuancier de la planche des Réglages soignés**
 * (26 octobre 2026, `appli/soignee/reglages-documents.html`), monté par
 * l'allure des devis. Le nom de la teinte prise s'écrit au-dessus, les
 * raccourcis se touchent en pastilles de 44 px, et le nuancier libre est le
 * rond « + » au bout ; le code « #FAF9F5 » part, il ne disait rien. Le titre
 * est alors porté par le paquet qui l'entoure. Le planning garde l'allure
 * d'avant tant qu'il n'a pas eu sa planche : c'est le même composant, il
 * suivra d'un mot.
 */
export function Couleur({
  titre,
  valeur,
  clef,
  aide,
  rapides,
  onChoisir,
  allure = "commune",
}: {
  titre: string;
  valeur: string;
  clef: string;
  /** Une ligne sous le réglage. Le planning n'en met pas : sa légende suffit. */
  aide?: string;
  rapides: [string, string][];
  onChoisir: (v: string) => void;
  allure?: "commune" | "soignee";
}) {
  if (allure === "soignee") {
    const prise = rapides.find(([teinte]) => teinte === valeur.toLowerCase());
    return (
      <div>
        <span
          data-atlas={`couleur-${clef}-nom`}
          className="block text-[18px] leading-[1.3]"
          style={{ fontFamily: font.display, color: colors.ink }}
        >
          {prise ? prise[1] : "Une autre couleur"}
        </span>
        <div className="mt-3 flex items-center gap-3" role="group" aria-label={titre}>
          {rapides.map(([teinte, nom]) => (
            <button
              key={teinte}
              type="button"
              aria-label={nom}
              aria-pressed={prise?.[0] === teinte}
              data-atlas={`rapide-${clef}-${teinte.slice(1)}`}
              onClick={() => onChoisir(teinte)}
              className="h-11 w-11 flex-none rounded-full transition-shadow duration-200"
              style={{
                backgroundColor: teinte,
                boxShadow:
                  prise?.[0] === teinte
                    ? `inset 0 0 0 1px ${colors.line}, 0 0 0 2px ${colors.card}, 0 0 0 4px ${colors.or}`
                    : `inset 0 0 0 1px ${colors.line}`,
              }}
            />
          ))}
          {/* **Le nuancier libre reste le réglage** (sa règle du 23 août) : posé
              sur le rond « + », il s'ouvre au doigt, et le rond se cerne d'or
              quand la teinte prise n'est aucun des raccourcis. */}
          <label
            className="relative grid h-11 w-11 flex-none cursor-pointer place-items-center rounded-full"
            style={{
              color: colors.inkSoft,
              boxShadow: prise
                ? `inset 0 0 0 1.5px ${colors.chevron}`
                : `0 0 0 2px ${colors.card}, 0 0 0 4px ${colors.or}`,
            }}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <input
              type="color"
              value={valeur}
              data-atlas={`couleur-${clef}`}
              aria-label={`Une autre couleur, ${titre.toLowerCase()}`}
              onChange={(e) => onChoisir(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer border-0 p-0 opacity-0"
            />
          </label>
        </div>
        {aide && (
          <p className="mt-2.5 text-[14px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            {aide}
          </p>
        )}
      </div>
    );
  }
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
