import type { ChantierStatut } from "./chantier-etat";
import { jourIso } from "./jour";

/**
 * **Un chantier n'apparaît que dans un seul onglet.**
 *
 * Le patron, le 6 août 2026, capture à l'appui : « une fois le chantier mis au
 * planning il ne doit plus figurer dans la catégorie chantier mais seulement au
 * planning, et une fois facturé ou leur date de planning passée il doit figurer
 * seulement dans terminé ».
 *
 * Ce qu'il voyait : « Chez Martins », marqué FACTURÉ, dans la liste des
 * chantiers — et le même, planifié le 12 août, dans le planning. Trois onglets,
 * un chantier dans deux d'entre eux : la liste ne dit plus ce qui reste à
 * faire, elle empile tout ce qui a existé.
 *
 * La règle vit ici, en une seule fonction, parce que **trois écrans en
 * dépendent**. Recopiée trois fois, elle aurait fini par ranger le même
 * chantier à deux endroits — exactement le défaut qu'elle corrige
 * (`CLAUDE.md` §3).
 */
export type OngletChantier = "chantiers" | "planning" | "termines";

export function ongletDuChantier(
  c: { statut: ChantierStatut; datePlanifiee?: string | null },
  aujourdHui: string = jourIso(new Date())
): OngletChantier {
  // Facturé ou déclaré terminé : c'est fini, quoi qu'en dise le reste.
  if (c.statut === "facture" || c.statut === "termine") return "termines";

  // **La date passée fait basculer, même sans « Fin de chantier ».** Le travail
  // a eu lieu ; le laisser au planning encombrerait ce qui est à venir, et le
  // laisser dans les chantiers laisserait croire qu'il reste à préparer. C'est
  // dans « Terminés » qu'on le retrouve, et de là qu'on le clôture — l'écran y
  // pousse déjà les chantiers dont la date est dépassée.
  if (c.datePlanifiee && c.datePlanifiee < aujourdHui) return "termines";

  // Planifié pour aujourd'hui ou plus tard : il vit au planning, et nulle part
  // ailleurs.
  if (c.statut === "planifie" || c.datePlanifiee) return "planning";

  // Tout le reste — brouillon, devis parti, réponse attendue, refus à
  // reprendre — est du travail en cours : c'est la liste des chantiers.
  return "chantiers";
}
