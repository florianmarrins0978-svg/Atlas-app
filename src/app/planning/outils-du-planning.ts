import { creneauxPoses, dureeDuChantier, type Creneau } from "@/lib/disponibilites";
import { ditLaDuree } from "@/lib/planning-jour";
import type { ChantierPlanning } from "./types-du-planning";

/**
 * Les créneaux qu'occupe un chantier posé — **ceux qu'il porte**, sinon son bloc.
 *
 * **Il recalculait le bloc, et c'est la capture qui l'a montré** (10 septembre
 * 2026) : un chantier d'une journée dont on rend le matin garde sa durée et
 * repart de l'après-midi — le bloc de deux demi-journées débordait alors sur le
 * MATIN DU LENDEMAIN, qui se noircissait au calendrier. Le jour d'après passait
 * pour occupé par un chantier qui n'y est pas, et l'écran d'envoi le retirait
 * des dates proposées au client.
 *
 * `creneauxPoses` est la seule réponse à « quelles demi-journées prend-il »
 * (`src/lib/disponibilites.ts`) : le repli sur le bloc y vit déjà, pour les
 * chantiers d'avant la migration 0085 qui n'ont pas de créneaux écrits.
 */
export function creneauxDe(c: ChantierPlanning) {
  if (!c.datePlanifiee) return [];
  return creneauxPoses({
    jour: c.datePlanifiee,
    moment: c.creneauDebut === "apres_midi" ? "apres_midi" : "matin",
    dureeDemiJournees: c.dureeDemiJournees,
    creneaux: c.creneaux as Creneau[] | undefined,
  });
}

export function ditCeQuIlOccupe(c: ChantierPlanning): string {
  const poses = creneauxDe(c).length;
  return ditLaDuree(poses > 0 ? poses : dureeDuChantier(c));
}

/** « 21 septembre » : le jour où le lien est mort, comme il le dirait. */
export function jourEnLettres(d: Date | string): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
}
