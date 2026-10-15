"use client";

import type { MomentEntier } from "./types-du-planning";
import { MotAChoisir } from "./ElementsDuPlanning";

/**
 * LES TROIS MOMENTS, ÉCRITS UNE FOIS — l'absence les emploie, la pose aussi.
 *
 * **Renommés le 10 septembre 2026** : ils s'appelaient « moments d'absence », et
 * poser un client ou du temps sur une journée pose exactement la même question.
 * Un second tableau aurait donné deux listes de trois mots dans le même écran,
 * et la première divergence — « Aprem » d'un côté, « Après-midi » de l'autre —
 * serait passée inaperçue.
 */
export const LES_TROIS_MOMENTS: { cle: MomentEntier; mot: string; dit: string }[] = [
  { cle: "matin", mot: "Matin", dit: "matin" },
  { cle: "apres_midi", mot: "Après-midi", dit: "après-midi" },
  { cle: "journee", mot: "Journée", dit: "journée" },
];

/**
 * LE CHOIX DU MOMENT — trois mots, un seul retenu.
 *
 * **Sa demande du 10 septembre 2026, capture à l'appui :** *« pour le choix
 * matin aprem journée utilise le bouton pour déplacer un chantier »* — c'était
 * alors un interrupteur à trois cases, recopié de `appli/deplacer-plus-simple`.
 *
 * **Des mots depuis sa planche du 18 septembre 2026**
 * (`appli/planning-tout-ensemble-en-mieux.html`) : *« j'en ai marre des gros
 * boutons ! Je veux une page élégante et minimaliste qu'on comprend direct »*.
 * Ce que l'interrupteur disait par sa forme — une seule position allumée —, le
 * mot retenu le dit en noir, souligné d'or ; les deux autres restent en or,
 * comme tout ce qui s'appuie sur cette fiche. Le contrat des suites ne bouge
 * pas : même repère, `data-quand`, `aria-pressed`.
 *
 * **44 px de haut, toujours** : l'encre rétrécit, la cible non.
 */
export function BasculeDuMoment({
  retenu,
  onChoisir,
  repere = "quand-absent",
  moments = LES_TROIS_MOMENTS,
}: {
  retenu: MomentEntier | null;
  onChoisir: (moment: MomentEntier) => void;
  /**
   * **Le repère des suites, et il change avec le GESTE.** Deux gestes de cet
   * écran posent la même question — qui n'est pas là, et quand poser — et
   * partagent donc ce dessin. Leur donner le même repère ferait viser à une
   * suite l'interrupteur de l'autre, ouvert dans la même carte.
   */
  repere?: string;
  moments?: readonly { cle: MomentEntier; mot: string }[];
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-[18px]">
      {moments.map((m) => {
        const allume = m.cle === retenu;
        return (
          <MotAChoisir
            key={m.cle}
            data-atlas={repere}
            data-quand={m.cle}
            retenu={allume}
            onClick={() => onChoisir(m.cle)}
          >
            {m.mot}
          </MotAChoisir>
        );
      })}
    </div>
  );
}
