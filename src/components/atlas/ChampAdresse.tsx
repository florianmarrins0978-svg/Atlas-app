"use client";

import { useEffect, useId, useRef, useState } from "react";
import { colors, font, libelleCaps, smallCaps } from "@/lib/design-tokens";
import { memeAdresse, meriteUneRecherche, type SuggestionAdresse } from "@/lib/suggestions-adresse";

/**
 * Un champ d'adresse qui propose, comme sur les sites de commande.
 *
 * Le patron, le 7 août 2026 : *« on commence à taper l'adresse et il nous
 * propose tout un tas de listes, et plus on écrit, plus l'adresse se réduit ;
 * ensuite il n'y a plus qu'à cliquer sur notre adresse et ça la valide. »*
 *
 * Trois exigences, tirées de sa description et de ses conditions d'usage :
 *
 * 1. **Le champ reste libre.** La liste aide, elle n'enferme pas : un chemin de
 *    campagne, un lieu-dit, un chantier « derrière la scierie » ne figurent
 *    dans aucune base. Refuser ce que la base ignore rendrait l'application
 *    inutilisable là où il travaille.
 * 2. **Une panne de la liste ne casse rien.** Réseau coupé, service en panne,
 *    réponse illisible : le champ redevient un champ ordinaire, en silence.
 *    Une aide qui tombe ne doit pas emporter la saisie avec elle.
 * 3. **On n'interroge pas à chaque lettre.** Une pause dans la frappe suffit —
 *    sinon on envoie huit requêtes pour taper « 20 rue de la Paix », et la
 *    liste clignote plus qu'elle n'aide.
 */
export default function ChampAdresse({
  label,
  placeholder,
  value,
  onChange,
  apparence = "carte",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  /**
   * Deux habillages, UNE seule logique de suggestion.
   *
   * `"carte"` — le champ posé sur une plage crème, celui de la fiche client
   * depuis le 7 août.
   *
   * `"ligne"` — l'étiquette fine, la valeur en serif et un filet dessous : la
   * grammaire de l'écran d'identité (`IdentiteClient`). Posé le 14 août, quand
   * le patron a demandé la même aide sur SON adresse de siège. Recopier le
   * composant pour changer son allure aurait dupliqué la règle des suggestions
   * — celle qui n'interroge pas à chaque lettre, se tait quand le réseau tombe
   * et n'enferme jamais la saisie (`CLAUDE.md` §3).
   */
  apparence?: "carte" | "ligne";
}) {
  // Les suggestions portent la saisie à laquelle elles répondent. Sans cela,
  // celles d'« 20 rue de la p » resteraient affichées pendant qu'on tape la
  // suite, et l'on pourrait toucher une adresse qui ne correspond plus à ce
  // qu'on lit dans le champ. C'est aussi ce qui évite de vider la liste à la
  // main : elle s'efface d'elle-même dès que la saisie change.
  const [resultat, setResultat] = useState<{ pour: string; liste: SuggestionAdresse[] }>({ pour: "", liste: [] });
  const [ouverte, setOuverte] = useState(false);
  const identifiant = useId();

  // Ce que le patron vient de CHOISIR ne doit pas relancer une recherche : sans
  // cela, toucher une suggestion remplit le champ, ce qui déclenche une requête,
  // qui rouvre la liste sous son doigt — sur l'adresse qu'il vient de valider.
  const choisi = useRef<string | null>(null);

  useEffect(() => {
    if (choisi.current === value) return;
    if (!meriteUneRecherche(value)) return;

    // La pause : 250 ms sans frappe. Assez court pour que la liste paraisse
    // suivre les doigts, assez long pour ne pas interroger à chaque lettre.
    const minuteur = setTimeout(async () => {
      try {
        const reponse = await fetch(`/api/adresses?q=${encodeURIComponent(value)}`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (!reponse.ok) return;
        const donnees = (await reponse.json()) as { suggestions?: SuggestionAdresse[] };
        setResultat({ pour: value, liste: Array.isArray(donnees.suggestions) ? donnees.suggestions : [] });
        setOuverte(true);
      } catch {
        // Silence volontaire : voir l'exigence 2 ci-dessus. On ne retient rien,
        // et la liste reste fermée puisqu'elle ne répond à rien.
        setResultat({ pour: value, liste: [] });
      }
    }, 250);

    return () => clearTimeout(minuteur);
  }, [value]);

  function retenir(suggestion: SuggestionAdresse) {
    choisi.current = suggestion.libelle;
    onChange(suggestion.libelle);
    setOuverte(false);
  }

  // La liste ne s'affiche que si elle répond à ce qui est ÉCRIT en ce moment.
  //
  // **Et une proposition qui répète la saisie est ÉCARTÉE.** Sa question du
  // 24 août 2026 devant son siège : « pourquoi l'adresse est marquée 2 fois de
  // suite ? » — le champ portait son écriture, la proposition la même adresse
  // en forme officielle. Une liste qui répète ce qui est déjà écrit ne propose
  // rien : elle occupe la place et fait douter de la saisie.
  const suggestions = (resultat.pour === value ? resultat.liste : []).filter(
    (s) => !memeAdresse(s.libelle, value)
  );
  const listeVisible = ouverte && suggestions.length > 0;

  const enLigne = apparence === "ligne";

  return (
    <div
      className={enLigne ? "relative border-b py-[13px]" : "relative flex flex-col gap-1.5"}
      style={enLigne ? { borderColor: colors.line } : undefined}
    >
      <label className={enLigne ? "block" : "flex flex-col gap-1.5"} htmlFor={identifiant}>
        <span
          className={enLigne ? `mb-[5px] block ${libelleCaps}` : smallCaps}
          style={{ color: colors.muted }}
        >
          {label}
        </span>
        <input
          id={identifiant}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            choisi.current = null;
            onChange(e.target.value);
          }}
          onFocus={() => setOuverte(true)}
          // `off` seul ne suffit pas sur iOS : c'est `autoCorrect` qui y
          // remplace « Bd » par « Bd. » pendant la frappe, et la suggestion ne
          // correspond alors plus à ce qui est cherché.
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={listeVisible}
          aria-autocomplete="list"
          aria-controls={`${identifiant}-liste`}
          // **La case vient de `.atlas-case`** (`globals.css`), pas d'un style
          // écrit ici : elle était en double avec `Field`, et deux écritures de
          // la même case divergent au premier ajustement (`CLAUDE.md` §3).
          // C'est aussi ce qui lui donne son état au doigt posé, qu'un style en
          // ligne ne sait pas exprimer.
          className={
            enLigne
              ? "block w-full border-0 bg-transparent p-0 outline-none"
              : "atlas-case"
          }
          // 17 px en ligne, 16 en carte (posé par `.atlas-case`) — jamais
          // moins : en dessous de 16, iOS agrandit la page à la mise au point
          // et l'écran saute.
          style={
            enLigne
              ? { color: colors.ink, fontFamily: font.display, fontSize: 17, lineHeight: 1.35 }
              : { fontFamily: font.body }
          }
        />
      </label>

      {listeVisible && (
        <ul
          id={`${identifiant}-liste`}
          role="listbox"
          aria-label="Adresses proposées"
          // `z-30` est la couche de la bulle de l'assistant, fixée en bas à
          // droite (`AssistantSidebar.tsx`). Sans ce cran au-dessus, elle
          // recouvre la troisième proposition et le doigt touche la bulle au
          // lieu de l'adresse — vu sur une capture, jamais par un test.
          className="relative z-40 overflow-hidden rounded-[4px]"
          style={{ backgroundColor: colors.card, border: `1px solid ${colors.rustTint}` }}
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.libelle} role="option" aria-selected={false}>
              {/* `onMouseDown` plutôt que `onClick` : le champ perd le focus
                  avant qu'un clic n'aboutisse, la liste se fermerait sous le
                  doigt et le choix serait perdu une fois sur deux. */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  retenir(suggestion);
                }}
                // 48 px de haut : une ligne plus fine se touche mal sur un
                // téléphone tenu d'une main, et le patron s'en sert dehors.
                className="w-full px-4 py-3 text-left"
                style={{ minHeight: 48, color: colors.ink }}
              >
                <span className="block text-[15px] leading-snug">{suggestion.libelle}</span>
                {suggestion.contexte && (
                  <span className="block text-[12px]" style={{ color: colors.muted }}>
                    {suggestion.contexte}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
