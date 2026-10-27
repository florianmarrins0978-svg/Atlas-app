"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, texteSituation } from "@/lib/design-tokens";
import type { JourIso } from "@/lib/disponibilites";
import { momentDuJour, phraseDeLaPeriode, type MomentDuJour } from "@/lib/absences-equipe";
import { jourLisible } from "@/lib/jour";
import type { AbsenceDuPlanning } from "./types-du-planning";
import { BasculeDuMoment, LES_TROIS_MOMENTS } from "./BasculeDuMoment";
import { PisteAbsence } from "./PisteAbsence";

/**
 * Ce que l'absence d'une personne prend de CE jour.
 *
 * **Lu sur le jour, plus sur la ligne** (27 octobre 2026) : une semaine qui
 * commence un jeudi après-midi se disait « journée » le jeudi, parce qu'on
 * lisait les deux bornes de la période (`momentDuJour`).
 */
function momentCeJour(absences: readonly AbsenceDuPlanning[], rang: number, jour: JourIso): MomentDuJour | null {
  const siennes = absences.filter((a) => a.rang === rang);
  const moments = siennes.map((a) => momentDuJour(a, jour)).filter((m): m is MomentDuJour => m !== null);
  if (moments.includes("journee")) return "journee";
  if (moments.includes("matin") && moments.includes("apres_midi")) return "journee";
  return moments[0] ?? null;
}

/**
 * LE GESTE D'UNE ABSENCE — un +, deux mots, aucun contour.
 *
 * **Sa décision du 9 septembre 2026**, planche `appli/salarie-s-absente.html` :
 * *« Quelqu'un pas là faut le changer par salarié absent avec un petit +
 * plutôt que le gros bouton »*, puis *« Salarié absent + sans contour ! »*.
 *
 * **CE QUI REMPLACE LE CERNE, C'EST LE +, ET CE N'EST PAS UN ORNEMENT.** Le
 * 7 septembre, ce même geste était une phrase nue et lui a échappé une journée
 * entière : *« comment savoir qu'il faut cliquer dessus ? »*. On y avait
 * répondu par une pastille ; il la trouve trop grosse, et il a raison — mais
 * on ne peut pas retirer la pastille ET laisser du texte nu, ce serait
 * remettre le défaut du 7. Le + porte ce que le cerne portait : « ceci
 * s'appuie, et ça ajoute quelque chose ».
 *
 * **L'ENCRE RÉTRÉCIT, LA CIBLE NON** : 44 px de haut, pleine largeur. Un geste
 * qu'on rate avec des gants ne vaut pas mieux qu'un geste qu'on ne voit pas.
 */
function GesteAbsence({
  children,
  onClick,
  ...reste
}: {
  children: React.ReactNode;
  onClick: () => void;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...reste}
      // **AU MILIEU — sa demande du 17 septembre 2026**, planche
      // `appli/deplacer-sur-le-calendrier.html` : *« mets la touche salarié
      // absent au milieu »*. Collée à gauche, à la taille du texte courant,
      // elle se lisait comme une ligne de la fiche et non comme un geste. Elle
      // garde sa PLACE — sous la date, au-dessus du nom.
      //
      // **EN OR, PLUS EN GRAS — sa planche du 18 septembre 2026**
      // (`appli/planning-tout-ensemble-en-mieux.html`) : sur cette fiche, un
      // mot en or est un geste, un mot noir est un fait. Le gras servait à dire
      // « ceci s'appuie » ; l'or le dit pour toute la fiche, et un mot en or ET
      // en gras crierait. Le « + » reste — *« garde le + avant salarié
      // absent ? »*, sa retouche du 18 au soir.
      //
      // **À CÔTÉ DE LA DATE depuis le 26 octobre 2026** — sa réponse devant la
      // planche soignée : *« Salarié absent, mets-le à côté »*. Il quitte le
      // milieu et la ligne d'en dessous pour la droite du titre du jour.
      className="flex min-h-[44px] flex-none items-center gap-1.5 py-[9px] text-[15px] font-semibold"
      style={{ color: colors.or, WebkitTapHighlightColor: "transparent" }}
    >
      <span
        aria-hidden="true"
        className="text-[19px] leading-none"
        style={{ flex: "none", marginTop: -2 }}
      >
        +
      </span>
      <span>{children}</span>
    </button>
  );
}

export function PasLaCeJour({
  titre,
  jour,
  absences,
  autour,
  lignesEquipes,
  nombreSalaries,
  nomEquipe,
  poser,
}: {
  /** La date du jour, posée à gauche du geste, sur la même ligne. */
  titre: React.ReactNode;
  jour: JourIso;
  /** Les absences qui touchent ce jour. */
  absences: AbsenceDuPlanning[];
  /** Celles qui touchent ce jour ou ses deux voisins : la période écrite sous un nom. */
  autour: AbsenceDuPlanning[];
  lignesEquipes: { rang: number; nom?: string | null }[];
  nombreSalaries: number;
  nomEquipe: (rang: number) => string;
  /** L'état d'une personne pour CE jour seulement : `null` la rend présente. */
  poser: (jour: JourIso, rang: number, moment: MomentDuJour | null) => void;
}) {
  /**
   * LA FEUILLE EST-ELLE OUVERTE ?
   *
   * **Sa planche C du 27 octobre 2026** (`appli/soignee/salarie-absent.html`) :
   * « Salarié absent ? » ouvre une feuille, une ligne par salarié, et sur
   * chaque ligne la piste Présent, Matin, Après-midi, Journée. Elle remplace
   * la liste des prénoms en or (« Julien », « Antoine, annuler ») et le choix
   * du moment en second temps : un seul geste dit qui manque et quand.
   */
  const [ouverte, setOuverte] = useState(false);
  /** Seul : le moment se choisit sous la ligne qu'il vient de poser, comme avant. */
  const [aChoisir, setAChoisir] = useState(false);

  // **Le rang 1, c'est LUI.** Sans salarié, la seule ligne d'équipe qui existe
  // est la sienne : fermer le jour revient à noter son absence à ce rang-là.
  const seul = nombreSalaries === 0;
  const rangs = seul ? [1] : lignesEquipes.map((e) => e.rang);
  const absents = [...new Set(absences.map((a) => a.rang))].filter((r) => momentCeJour(absences, r, jour) !== null);

  /** Le nom qu'on écrit sur une ligne — le sien quand il travaille seul. */
  const nomDuRang = (rang: number) => (seul ? "Vous" : nomEquipe(rang));

  const ligne = "flex min-h-[48px] w-full items-center justify-between gap-3 py-[11px] text-left";

  return (
    <div className="mb-1">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{titre}</div>
        <GesteAbsence
          data-atlas="fermer-le-jour"
          onClick={() => {
            // **Seul et pas encore absent : un seul appui suffit**, sans feuille
            // (sa planche C le garde). Il n'y a personne à désigner.
            if (seul && absents.length === 0) {
              poser(jour, 1, "journee");
              setAChoisir(true);
              return;
            }
            setAChoisir(false);
            setOuverte(true);
          }}
        >
          {seul ? "Absent ?" : "Salarié absent ?"}
        </GesteAbsence>
      </div>

      {/* ─── CE QUI EST POSÉ, ET QUAND ─────────────────────────────────────
          *« Julien absent, et là on marque soit matin, soit aprem, soit
          journée en fonction de la sélection. »* Et la petite croix noire à
          droite (sa retouche du 18 septembre au soir) : **elle ne retire que
          CE jour** depuis le 27 octobre 2026. Elle retirait la ligne entière,
          et une semaine notée dans Réglages, Équipe partait avec elle. */}
      {absents.map((r) => {
        const moment = momentCeJour(absences, r, jour)!;
        return (
          <div key={r} data-atlas="absence-posee" data-quand={moment} className={ligne}>
            <span className="w-[86px] flex-shrink-0 text-[13px]" style={{ color: colors.muted }}>
              Absent
            </span>
            <span className="min-w-0 flex-1 text-[14.5px]" style={{ color: colors.ink }}>
              {nomDuRang(r)}
            </span>
            {!(seul && aChoisir) && (
              <span className={texteSituation} style={{ color: colors.muted, flex: "none" }}>
                {LES_TROIS_MOMENTS.find((m) => m.cle === moment)?.dit}
              </span>
            )}
            <button
              type="button"
              data-atlas="retirer-absence"
              aria-label={`Supprimer l’absence de ${nomDuRang(r)}`}
              onClick={() => {
                poser(jour, r, null);
                setAChoisir(false);
              }}
              className="-mr-2 flex min-h-[44px] min-w-[44px] flex-shrink-0 cursor-pointer items-center justify-end border-0 bg-transparent pr-2 text-[15px]"
              style={{ color: colors.ink, WebkitTapHighlightColor: "transparent" }}
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* Seul, le moment se restreint juste dessous, et s'efface une fois choisi
          (son choix D2 du 8 septembre, dans la forme du 10). */}
      {seul && aChoisir && absents.includes(1) && (
        <BasculeDuMoment
          retenu={momentCeJour(absences, 1, jour)}
          onChoisir={(m) => {
            if (m !== momentCeJour(absences, 1, jour)) poser(jour, 1, m);
            setAChoisir(false);
          }}
        />
      )}

      {/* **La feuille part sous `<body>`, pas là où vit le geste** — comme
          celle des périodes de Ma TVA (`CalendrierPeriodes.tsx`). La fiche du
          jour vit dans le rail des mois (`MoisCharge`), qui se déplace par un
          `transform` : une feuille `fixed` posée dedans se mesure sur le rail,
          pas sur l'écran, et glissait avec lui, coupée sur le côté (vu le
          27 octobre 2026 en jouant le glissé). Montée une fois ouverte : le
          serveur n'a pas de `document`. */}
      {ouverte && createPortal(
        <BottomSheet open onBackdropClick={() => setOuverte(false)}>
          <div data-atlas="feuille-absent">
            <h2 className="mb-2 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
              Absent le {jourLisible(jour)} ?
            </h2>
            {rangs.map((r, i) => {
              const moment = momentCeJour(absences, r, jour);
              const nom = nomDuRang(r);
              const periode = phraseDeLaPeriode(
                autour.filter((a) => a.rang === r),
                jour
              );
              return (
                <div
                  key={r}
                  data-atlas="salarie-du-jour"
                  data-rang={r}
                  className="pb-4 pt-3.5"
                  style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}
                >
                  <div className="mb-3 flex items-center gap-3.5">
                    {/* Les initiales de Vos clients ; l'ambre quand il manque. */}
                    <span
                      aria-hidden="true"
                      className="grid h-11 w-11 flex-none place-items-center rounded-full text-[18px]"
                      style={{
                        fontFamily: font.display,
                        backgroundColor: moment ? colors.carteAmbreFond : colors.rustTint,
                        color: moment ? colors.carteAmbreTexte : colors.rust,
                        transition: "background-color 240ms ease-out, color 240ms ease-out",
                      }}
                    >
                      {nom.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[21px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
                        {nom}
                      </span>
                      {periode && (
                        <span data-atlas="periode-absent" className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft }}>
                          {periode}
                        </span>
                      )}
                    </span>
                  </div>
                  <PisteAbsence nom={`${nom}, le ${jourLisible(jour)}`} retenu={moment} onChoisir={(m) => poser(jour, r, m)} />
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setOuverte(false)}
              className="mt-2 flex min-h-[48px] w-full items-center justify-center border-0 bg-transparent text-[15px] font-semibold"
              style={{ color: colors.inkSoft }}
            >
              Fermer
            </button>
          </div>
        </BottomSheet>,
        document.body
      )}
    </div>
  );
}
