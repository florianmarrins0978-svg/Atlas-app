"use client";

import { useCallback, useMemo } from "react";
import { fusionnerAbsences, type AbsenceEquipe } from "@/lib/absences-equipe";
import { equipesMobilisees, libelleSalarie, salariesAffiches } from "@/lib/equipes";
import { occupationDemi, type Demi } from "@/lib/planning-jour";
import {
  cleCreneau,
  creneauxDuChantier,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  type JourIso,
} from "@/server/disponibilites";
import type { ChantierPlanning } from "@/app/planning/PlanningClient";

/**
 * QUI OCCUPE QUELLE DEMI-JOURNÉE — la règle, écrite une fois.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce fichier existe.** Depuis le 22 août 2026, deux écrans peignent
 * la même journée : le planning, et l'écran d'envoi quand le patron choisit une
 * date à proposer (sa demande, planche 91). Deux calculs séparés de la charge
 * finiraient par ne pas dire la même chose de la même journée — le planning
 * annonçant libre un jour que l'envoi refuse. Ce défaut-là s'est déjà produit
 * dans ce dépôt, et `CLAUDE.md` §3 l'interdit nommément.
 *
 * **Trois précautions y sont, chacune payée une fois :**
 *
 *   · une carte construite UNE fois plutôt qu'un parcours de la liste à chaque
 *     case : le calendrier interroge quarante-deux jours, la fiche du jour deux
 *     demi-journées, la liste sept jours ;
 *   · les absences comptent comme des chantiers — une équipe partie retire de
 *     la place, et l'ignorer ferait proposer au client un jour où personne ne
 *     peut venir ;
 *   · les GENS COCHÉS sur la demi-journée comptent, et non le seul nombre
 *     de chantiers : sans cela, un mardi où ses deux gars sont chez le même
 *     client s'annonçait « incomplet » (22 août 2026).
 *
 * **Depuis le 26 août 2026, ce qu'on coche est un SALARIÉ et non une équipe**
 * (planche 97, réponse A). La charge passe donc par `equipesMobilisees`, qui
 * plafonne le compte à la capacité : trois gars sur un même chantier ne
 * ferment pas une journée qui accepte deux chantiers. À effectif égal — le cas
 * de son entreprise — le résultat est identique à celui d'avant.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function useOccupation({
  chantiers,
  nombreEquipes,
  nombreSalaries,
  absences,
  equipesNommees,
}: {
  /** Les chantiers DATÉS à faire compter — au planning, ceux qui restent visibles. */
  chantiers: readonly ChantierPlanning[];
  /** La CAPACITÉ : combien de chantiers tiennent dans une journée. */
  nombreEquipes: number;
  /** Combien de GENS : ce qui décide des noms cochables sur une demi-journée. */
  nombreSalaries: number;
  absences: readonly AbsenceEquipe[];
  equipesNommees: readonly { rang: number; nom: string | null }[];
}) {
  const parCreneau = useMemo(() => {
    const m = new Map<string, ChantierPlanning[]>();
    for (const c of chantiers) {
      if (!c.datePlanifiee) continue;
      const creneaux = creneauxDuChantier(
        { jour: c.datePlanifiee, moment: c.creneauDebut === "apres_midi" ? "apres_midi" : "matin" },
        c.dureeDemiJournees ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES
      );
      for (const x of creneaux) {
        const cle = cleCreneau(x);
        const siens = m.get(cle);
        if (siens) siens.push(c);
        else m.set(cle, [c]);
      }
    }
    return m;
  }, [chantiers]);

  // `fusionnerAbsences` sur une carte VIDE rend exactement le nombre d'équipes
  // absentes par créneau, plafonné. La réemployer évite d'écrire une seconde
  // fois la règle des bornes incluses (`src/lib/absences-equipe.ts`).
  const absentesParCreneau = useMemo(
    () => fusionnerAbsences(new Map(), absences, nombreEquipes),
    [absences, nombreEquipes]
  );

  const occupationDe = useCallback(
    (jour: JourIso, demi: Demi) => {
      // **Le week-end porte sa charge comme les autres.** Sa règle du 23 août
      // 2026 : il y travaille en extra, et un samedi chargé qui s'affiche vide
      // lui ferait poser un second chantier par-dessus.
      const cle = cleCreneau({ jour, moment: demi });
      return occupationDemi(
        parCreneau.get(cle) ?? [],
        nombreEquipes,
        absentesParCreneau.get(cle) ?? 0,
        (c) =>
          equipesMobilisees(
            (demi === "matin" ? c.equipes.matin : c.equipes.apres_midi).length,
            nombreEquipes
          )
      );
    },
    [parCreneau, absentesParCreneau, nombreEquipes]
  );

  const lignesEquipes = useMemo(
    () => salariesAffiches(equipesNommees, nombreSalaries),
    [equipesNommees, nombreSalaries]
  );

  /**
   * Le nom d'un salarié, ou son rang en repli.
   *
   * `libelleSalarie` décide seule : elle sert aussi au serveur et aux documents,
   * et deux implémentations divergeraient le jour où l'artisan nomme le
   * troisième sans avoir touché le deuxième (`src/lib/equipes.ts`).
   */
  const nomEquipe = useCallback(
    (rang: number) =>
      libelleSalarie(lignesEquipes.find((e) => e.rang === rang) ?? null, nombreSalaries) ??
      `Salarié ${rang}`,
    [lignesEquipes, nombreSalaries]
  );

  return { occupationDe, nomEquipe, lignesEquipes };
}
