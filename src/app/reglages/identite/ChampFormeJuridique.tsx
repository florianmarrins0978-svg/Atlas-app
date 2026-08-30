"use client";

import { useState } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { FORMES_JURIDIQUES, FORME_AUTRE, formeConnue } from "@/lib/formes-juridiques";

/**
 * La forme juridique : on choisit, on n'écrit plus.
 *
 * *Demandé par le patron le 14 août 2026 : « un bandeau déroulant avec toutes
 * les formes juridiques, et qu'on ait juste à sélectionner et cliquer. »* Il
 * avait tapé « Sas » en minuscules — un sigle mal capitalisé qui part ensuite
 * sur chaque devis.
 *
 * **« Autre » n'est pas une valeur, c'est une ISSUE.** Le choisir rouvre le
 * champ libre. Une liste fermée finirait par exclure une société civile, une
 * association, un GAEC — et l'artisan exclu ne pourrait plus rien saisir du
 * tout.
 *
 * **Ce qui est déjà en base n'est jamais écrasé.** « Sas » retrouve son entrée
 * « SAS » (comparaison sans casse ni points) ; ce que la liste ignore reste
 * affiché tel quel, sous « Autre ».
 *
 * **`onFini` reçoit la valeur, elle ne la relit jamais dans `valeur`.** En
 * cliquant une ligne de la liste, `choisir()` appelait `onChange(sigle)` puis
 * `onFini()` dans le MÊME battement — avant que React n'ait reposé l'état.
 * `onFini` lisait donc, chez l'appelant, la forme d'AVANT le clic (souvent
 * vide) : la case s'affichait juste, mais c'est cette valeur périmée qui
 * partait en base. Trouvé le 30 août 2026 en construisant le capital et le
 * RCS (migration 0072) — la première fois que la forme juridique servait à
 * autre chose qu'à s'afficher, donc la première fois que son enregistrement
 * manqué se voyait.
 */
export default function ChampFormeJuridique({
  valeur,
  onChange,
  onFini,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onFini: (v: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const connue = formeConnue(valeur);
  // Une valeur hors liste garde son champ libre ouvert : sans cela, « GAEC »
  // disparaîtrait de l'écran en donnant l'impression d'avoir été effacé.
  const [libre, setLibre] = useState(valeur.trim() !== "" && connue === null);

  function choisir(sigle: string) {
    if (sigle === FORME_AUTRE) {
      setLibre(true);
      setOuvert(false);
      return;
    }
    setLibre(false);
    setOuvert(false);
    onChange(sigle);
    onFini(sigle);
  }

  return (
    <div className="border-b py-[13px]" style={{ borderColor: colors.line }}>
      <span className={`mb-[5px] block ${libelleCaps}`} style={{ color: colors.muted }}>
        Forme juridique
      </span>

      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-3 text-left"
        style={{ minHeight: 30 }}
      >
        <span
          className="min-w-0 flex-1"
          style={{
            fontFamily: font.display,
            fontSize: 17,
            lineHeight: 1.35,
            color: valeur.trim() === "" ? colors.muted : colors.ink,
          }}
        >
          {valeur.trim() === "" ? "SASU, EI, EURL…" : valeur}
        </span>
        <span
          aria-hidden="true"
          className="-mt-[3px] h-[7px] w-[7px] flex-none rotate-45"
          style={{ borderRight: `1.5px solid ${colors.muted}`, borderBottom: `1.5px solid ${colors.muted}` }}
        />
      </button>

      {ouvert && (
        <div className="mt-2 overflow-hidden rounded-[4px]" style={{ backgroundColor: colors.card }}>
          {[...FORMES_JURIDIQUES, { sigle: FORME_AUTRE, nom: "À écrire vous-même" }].map((f) => {
            const pris = f.sigle !== FORME_AUTRE && connue?.sigle === f.sigle;
            return (
              <button
                key={f.sigle}
                type="button"
                onClick={() => choisir(f.sigle)}
                aria-pressed={pris}
                className="flex w-full items-center gap-3 border-b px-3.5 text-left last:border-b-0"
                style={{
                  borderColor: colors.line,
                  minHeight: 46,
                  backgroundColor: pris ? colors.line : "transparent",
                }}
              >
                <span className="flex-none" style={{ fontFamily: font.display, fontSize: 16 }}>
                  {f.sigle}
                </span>
                {/* Le nom complet à côté du sigle : « EURL » ne se retient pas,
                    et sans lui il faudrait chercher ailleurs pour choisir. */}
                <span className={`flex-1 text-right ${texteSituation}`} style={{ color: colors.muted }}>
                  {f.nom}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {libre && (
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-label="Forme juridique, à écrire"
          placeholder="Société civile, association…"
          value={connue ? "" : valeur}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onFini(valeur)}
          className="mt-2 block w-full rounded-[4px] border-0 px-3.5 py-3 outline-none"
          style={{
            backgroundColor: colors.card,
            fontFamily: font.display,
            fontSize: 17,
            lineHeight: 1.35,
            color: colors.ink,
          }}
        />
      )}
    </div>
  );
}
