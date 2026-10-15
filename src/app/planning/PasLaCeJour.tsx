"use client";

import { useState } from "react";
import { colors, texteSituation } from "@/lib/design-tokens";
import type { JourIso } from "@/lib/disponibilites";
import type { AbsenceDuPlanning, MomentEntier } from "./types-du-planning";
import { MotEnOr } from "./ElementsDuPlanning";
import { BasculeDuMoment, LES_TROIS_MOMENTS } from "./BasculeDuMoment";

/**
 * Ce que porte une absence déjà écrite : une moitié, ou la journée.
 *
 * **Les deux bornes sont des chaînes libres en base** (`AbsenceEquipe`), et
 * c'est délibéré côté dépôt. Ici on ne garde que ce qu'on sait dessiner : une
 * borne inconnue vaut la journée, comme partout ailleurs dans ce fichier.
 */
function momentDe(a: AbsenceDuPlanning): MomentEntier {
  if (a.premierDemi !== a.dernierDemi) return "journee";
  if (a.premierDemi === "matin" || a.premierDemi === "apres_midi") return a.premierDemi;
  return "journee";
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
      className="flex min-h-[44px] w-full items-center justify-center gap-2.5 py-[9px] text-center text-[14px]"
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
  jour,
  absences,
  lignesEquipes,
  nombreSalaries,
  nomEquipe,
  fermer,
  rouvrir,
}: {
  jour: JourIso;
  absences: AbsenceDuPlanning[];
  lignesEquipes: { rang: number; nom?: string | null }[];
  nombreSalaries: number;
  nomEquipe: (rang: number) => string;
  fermer: (jour: JourIso, rang: number, quand?: "matin" | "apres_midi" | null) => void;
  rouvrir: (id: string) => void;
}) {
  /**
   * LA LISTE EST-ELLE OUVERTE ?
   *
   * **Son ordre du 10 septembre 2026 :** *« l'ordre devrait être + salarié
   * absent ? puis Julien »*, et *« si on veut annuler on reclique sur + salarié
   * absent, et on verrait Julien / Annuler, puis Antoine ? »*.
   *
   * Une seule porte, donc, pour poser ET pour défaire : le + ouvre la liste des
   * gens du jour, chacun avec ce qu'on peut lui faire. Ce qui reste sous les
   * yeux le reste du temps est ce qu'il a besoin de LIRE — qui manque, et quand.
   */
  const [ouverte, setOuverte] = useState(false);
  /** Qui il vient de poser absent — le seul à qui l'interrupteur s'adresse. */
  const [quiManque, setQuiManque] = useState<number | null>(null);

  // **Le rang 1, c'est LUI.** Sans salarié, la seule ligne d'équipe qui existe
  // est la sienne : fermer le jour revient à noter son absence à ce rang-là.
  const rangs = nombreSalaries > 0 ? lignesEquipes.map((e) => e.rang) : [1];
  const absentsParRang = new Map(absences.map((a) => [a.rang, a]));

  /** Le nom qu'on écrit sur une ligne — le sien quand il travaille seul. */
  const nomDuRang = (rang: number) => (nombreSalaries > 0 ? nomEquipe(rang) : "Vous");

  /**
   * Poser une absence, ou la ramener à une moitié de journée.
   *
   * **On retire et on repose**, plutôt que de modifier. Une action de mise à
   * jour aurait ajouté un troisième chemin d'écriture sur cette table — donc un
   * troisième endroit où la réconciliation des affectations pourrait être
   * oubliée (`ARCHITECTURE.md` §294). Reposer traverse celle qui existe déjà.
   */
  function poserLeMoment(rang: number, moment: MomentEntier) {
    const a = absentsParRang.get(rang);
    if (!a) return;
    if (momentDe(a) === moment) {
      // Déjà là où il veut : ne rien réécrire, et refermer l'interrupteur.
      setQuiManque(null);
      return;
    }
    rouvrir(a.id);
    fermer(jour, rang, moment === "journee" ? null : moment);
    // **L'interrupteur s'efface une fois choisi** — sa demande du 10 septembre.
    setQuiManque(null);
  }

  const ligne = "flex min-h-[48px] w-full items-center justify-between gap-3 py-[11px] text-left";

  return (
    <div className="mt-1 border-t pt-1" style={{ borderColor: colors.lineSoft }}>
      {/* ─── LE + EN TÊTE, LES NOMS DESSOUS — 10 septembre 2026 ────────────
          *« L'ordre devrait être + salarié absent ? puis Julien. »* Il ouvre la
          liste et la referme ; c'est aussi par lui qu'on annule, ce qui libère
          la ligne d'une absence posée du mot « Annuler » qu'elle portait à
          demeure — le geste le plus rare occupait la place la plus visible.

          **Le geste se reconnaît au +, pas à un cerne** (voir `GesteAbsence`) :
          sa décision du 9 septembre, et le pourquoi y est écrit en entier. */}
      <div className="py-1">
        <GesteAbsence
          data-atlas="fermer-le-jour"
          onClick={() => {
            // **Seul et pas encore absent : un seul appui suffit.** Il n'y a
            // personne à désigner, et lui demander de se choisir dans une liste
            // d'un nom serait un geste pour rien.
            if (nombreSalaries === 0 && !absentsParRang.has(1)) {
              fermer(jour, 1);
              setQuiManque(1);
              return;
            }
            setOuverte((o) => !o);
            setQuiManque(null);
          }}
        >
          {nombreSalaries === 0 ? "Absent ?" : "Salarié absent ?"}
        </GesteAbsence>
      </div>

      {ouverte ? (
        /* ─── OUVERT : LES PRÉNOMS, EN OR, SUR UNE LIGNE ───────────────────
           Sa planche du 18 septembre 2026 : plus une ligne par personne, des
           mots. Ceux qui manquent portent « · annuler » ; les autres attendent
           d'être touchés. Les repères des suites ne bougent pas. */
        <div className="flex flex-wrap items-center gap-x-[18px]">
          {rangs.map((r) => {
            const absente = absentsParRang.get(r);
            return absente ? (
              <MotEnOr
                key={r}
                data-atlas="rouvrir-le-jour"
                onClick={() => {
                  rouvrir(absente.id);
                  if (quiManque === r) setQuiManque(null);
                }}
              >
                {nomDuRang(r)}, annuler
              </MotEnOr>
            ) : (
              <MotEnOr
                key={r}
                data-atlas="qui-nest-pas-la"
                onClick={() => {
                  // **La journée entière, tout de suite.** Le cas courant reste
                  // à un appui : il touche un nom, c'est posé. Le choix du
                  // moment ne sert qu'à restreindre, le jour où ça compte.
                  fermer(jour, r);
                  setQuiManque(r);
                  setOuverte(false);
                }}
              >
                {nomDuRang(r)}
              </MotEnOr>
            );
          })}
        </div>
      ) : (
        /* ─── FERMÉ : ON NE LIT QUE CE QUI EST POSÉ, ET QUAND ──────────────
           *« Julien absent, et là on marque soit matin, soit aprem, soit
           journée en fonction de la sélection ; le Annuler disparaît. »*

           **Et une petite croix noire, à droite de la durée** — sa retouche du
           18 septembre au soir : *« quand je mets un salarié absent, mets une
           petite croix à droite en noir pour le supprimer, à côté de la durée
           de son absence »*. Elle fait ce que fait « · annuler » derrière le
           +, sans avoir à rouvrir la liste. Le moment ne s'écrit pas pendant
           qu'on le choisit juste en dessous : il serait écrit deux fois. */
        absences.map((a) => (
          <div key={a.id} data-atlas="absence-posee" data-quand={momentDe(a)} className={ligne}>
            <span className="w-[86px] flex-shrink-0 text-[13px]" style={{ color: colors.muted }}>
              Absent
            </span>
            <span className="min-w-0 flex-1 text-[14.5px]" style={{ color: colors.ink }}>
              {nombreSalaries > 0 ? nomEquipe(a.rang) : "Vous"}
            </span>
            {quiManque !== a.rang && (
              <span className={texteSituation} style={{ color: colors.muted, flex: "none" }}>
                {LES_TROIS_MOMENTS.find((m) => m.cle === momentDe(a))?.dit}
              </span>
            )}
            <button
              type="button"
              data-atlas="retirer-absence"
              aria-label={`Supprimer l’absence de ${nomDuRang(a.rang)}`}
              onClick={() => {
                rouvrir(a.id);
                if (quiManque === a.rang) setQuiManque(null);
              }}
              className="-mr-2 flex min-h-[44px] min-w-[44px] flex-shrink-0 cursor-pointer items-center justify-end border-0 bg-transparent pr-2 text-[15px]"
              style={{ color: colors.ink, WebkitTapHighlightColor: "transparent" }}
            >
              ✕
            </button>
          </div>
        ))
      )}

      {/* ─── L'INTERRUPTEUR, SUR CELUI QU'IL VIENT DE POSER ───────────────
          Son choix D2 du 8 septembre — une absence peut ne prendre qu'une
          demi-journée — dans la forme qu'il a demandée le 10 : le bouton de
          « Déplacer », allumé sur ce qui vient d'être écrit, et qui s'efface
          dès qu'il a choisi. Le faire vivre sous chaque ligne remettrait un
          geste là où il n'en faut plus. */}
      {quiManque !== null && !ouverte && absentsParRang.has(quiManque) && (
        <BasculeDuMoment
          retenu={momentDe(absentsParRang.get(quiManque)!)}
          onChoisir={(m) => poserLeMoment(quiManque, m)}
        />
      )}
    </div>
  );
}
