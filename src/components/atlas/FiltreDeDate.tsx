"use client";

import { colors, font } from "@/lib/design-tokens";
import { jourLisible } from "@/lib/jour";
import { jourDeLaRoue, moisSuivantOuvert, moisVoisin, titreDeLaPeriode } from "@/lib/periode";

/**
 * LE MOIS QU'ON FEUILLETTE — deux chevrons d'or, et le mois au milieu ouvre la
 * roue du téléphone pour un jour.
 *
 * **SON CHOIX DU 11 OCTOBRE 2026, la proposition A** de
 * `appli/filtre-de-date-plus-simple.html`, montrée écran par écran dans
 * `appli/filtre-a-partout.html` avant d'être codée. Il trouvait le filtre
 * précédent *« dur à utiliser »* : trois mots « 11 octobre 2026 » qui se
 * touchaient chacun à part, sans que rien ne le dise, et un trait d'or comme
 * seul signe de ce que la liste montrait. On ne devinait pas.
 *
 * **Le dessin est celui du mois de Terminés** (`ListeTermines.tsx`,
 * `NavigationMois`, son choix du 13 septembre) : nom en serif 26 px centré,
 * chevrons d'or de 44 × 34, éteints quand on ne peut pas aller plus loin. Quatre
 * listes qui se feuillettent pareil, au lieu de deux dessins pour un même geste.
 *
 * **Le jour reste possible** : toucher le mois ouvre la roue, le jour choisi
 * s'écrit en entier (« Vendredi 9 octobre »), et « Tout le mois », en or
 * dessous, y revient. L'année d'un bloc n'a plus de geste : il l'a accepté en
 * choisissant A, la planche le disait.
 *
 * **Toujours aucun bouton de filtre**, sa consigne du 21 septembre : *« enlève
 * tous tes filtres boutons et garde que celui-là »*.
 *
 * Un seul dessin pour les fiches de sécurité, les retours d'intervention et
 * les rapports envoyés : ce qui change d'un écran à l'autre, c'est ce qu'on
 * fait de la période choisie (`choisir`), jamais la façon de la choisir.
 */
export default function FiltreDeDate({ periode, choisir }: { periode: string; choisir: (periode: string) => void }) {
  const unJour = periode.length === 10;
  // « Vendredi 9 octobre » : l'année n'y est que si ce n'est pas la nôtre
  // (`jourLisible`), sans quoi le titre ne tiendrait pas entre les chevrons.
  const titre = unJour ? capitale(jourLisible(periode)) : titreDeLaPeriode(periode);

  return (
    <div className="mx-[22px] mt-3" data-atlas="periode-choisie">
      <div className="flex items-center justify-center gap-0.5">
        <Chevron sens="passe" ouvert onClick={() => choisir(moisVoisin(periode, -1))} />
        <label
          className="relative flex min-h-11 min-w-0 cursor-pointer items-center"
          data-atlas="ouvrir-la-roue"
          style={{ marginInline: 2 }}
        >
          {/* **Un jour s'écrit plus long qu'un mois** : « Mercredi 30 septembre »
              ne tient pas à 26 px entre deux chevrons sur un téléphone de
              360 px. Il descend jusqu'à 20 px, jamais en dessous. */}
          <span
            className="truncate"
            style={{
              fontFamily: font.display,
              fontSize: unJour ? "clamp(20px, 6.4vw, 26px)" : 26,
              lineHeight: 1.2,
              color: colors.ink,
            }}
          >
            {titre}
          </span>
          {/* `fontSize: 16` : en dessous, iOS agrandit la page à l'ouverture. */}
          <input
            type="date"
            aria-label="Choisir un jour"
            value={jourDeLaRoue(periode)}
            onChange={(e) => {
              if (e.target.value) choisir(e.target.value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            style={{ fontSize: 16 }}
          />
        </label>
        <Chevron sens="futur" ouvert={moisSuivantOuvert(periode)} onClick={() => choisir(moisVoisin(periode, 1))} />
      </div>
      {unJour && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => choisir(periode.slice(0, 7))}
            data-atlas="tout-le-mois"
            className="min-h-11 px-3 text-[14px]"
            style={{ color: colors.or, WebkitTapHighlightColor: "transparent" }}
          >
            Tout le mois
          </button>
        </div>
      )}
    </div>
  );
}

function capitale(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * UN CHEVRON D'OR — dessiné, et non le guillemet en caractère de Terminés : un trait
 * tient la même épaisseur sur tous les téléphones, une police non.
 */
function Chevron({ sens, ouvert, onClick }: { sens: "passe" | "futur"; ouvert: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ouvert}
      aria-label={sens === "passe" ? "Mois précédent" : "Mois suivant"}
      data-atlas={sens === "passe" ? "mois-precedent" : "mois-suivant"}
      className="flex h-11 w-[34px] flex-none items-center justify-center"
      style={{ color: ouvert ? colors.or : colors.line, WebkitTapHighlightColor: "transparent" }}
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
        <path
          d={sens === "passe" ? "M8 2L2 8l6 6" : "M2 2l6 6-6 6"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * UNE DATE ÉCRITE EN TITRE, qui ouvre la roue du téléphone au toucher.
 *
 * Sortie du filtre le 22 septembre 2026, quand le jour du passage de la fiche
 * de chantier a pris la même typographie (*« met la même typographie que
 * septembre 2026 mais rajoute le jour »*) : deux copies du dessin finiraient
 * par ne plus se ressembler.
 */
export function TitreAvecRoue({
  titre,
  jour,
  choisir,
  dataAtlas,
}: {
  titre: string;
  /** Le jour `AAAA-MM-JJ` sur lequel la roue s'ouvre. */
  jour: string;
  choisir: (jour: string) => void;
  dataAtlas: string;
}) {
  return (
    <label className="relative flex min-h-12 cursor-pointer items-center justify-center gap-2" data-atlas={dataAtlas}>
      <span className="text-[20px] leading-[1.2]" style={{ fontFamily: font.display }}>{titre}</span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: colors.or }}><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <input
        type="date"
        aria-label="Choisir un jour"
        value={jour}
        onChange={(e) => {
          if (e.target.value) choisir(e.target.value);
        }}
        className="absolute inset-0 h-full w-full opacity-0"
        style={{ fontSize: 16 }}
      />
    </label>
  );
}
