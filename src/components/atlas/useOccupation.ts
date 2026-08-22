"use client";

import { useCallback, useMemo } from "react";
import { fusionnerAbsences, type AbsenceEquipe } from "@/lib/absences-equipe";
import { equipesAffichees, libelleEquipe } from "@/lib/equipes";
import { occupationDemi, type Demi } from "@/lib/planning-jour";
import { estWeekEndIso } from "@/lib/mois";
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
 *   · les équipes COCHÉES sur la demi-journée comptent, et non le seul nombre
 *     de chantiers : sans cela, un mardi où ses deux équipes sont chez le même
 *     client s'annonçait « incomplet » (22 août 2026).
 * ───────────────────────────────────────────────────────────────────────────
 */
export function useOccupation({
  chantiers,
  nombreEquipes,
  absences,
  equipesNommees,
}: {
  /** Les chantiers DATÉS à faire compter — au planning, ceux qui restent visibles. */
  chantiers: readonly ChantierPlanning[];
  nombreEquipes: number;
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
      if (estWeekEndIso(jour)) return occupationDemi<ChantierPlanning>([], nombreEquipes, 0);
      const cle = cleCreneau({ jour, moment: demi });
      return occupationDemi(
        parCreneau.get(cle) ?? [],
        nombreEquipes,
        absentesParCreneau.get(cle) ?? 0,
        (c) => (demi === "matin" ? c.equipes.matin : c.equipes.apres_midi).length
      );
    },
    [parCreneau, absentesParCreneau, nombreEquipes]
  );

  const lignesEquipes = useMemo(
    () => equipesAffichees(equipesNommees, nombreEquipes),
    [equipesNommees, nombreEquipes]
  );

  /**
   * Le nom d'une équipe, ou sa lettre de repli.
   *
   * `libelleEquipe` décide seule : elle sert aussi au serveur et aux documents,
   * et deux implémentations divergeraient le jour où l'artisan nomme la
   * troisième sans avoir touché la deuxième (`src/lib/equipes.ts`).
   */
  const nomEquipe = useCallback(
    (rang: number) =>
      libelleEquipe(lignesEquipes.find((e) => e.rang === rang) ?? null, nombreEquipes) ??
      `Équipe ${rang}`,
    [lignesEquipes, nombreEquipes]
  );

  return { occupationDe, nomEquipe, lignesEquipes };
}
