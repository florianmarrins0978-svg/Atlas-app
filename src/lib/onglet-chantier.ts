import type { ChantierStatut, EtatPourPlanification } from "./chantier-etat";
import { getPlanificationEtat } from "./chantier-etat";
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
 *
 * **Et c'est arrivé quand même, le 8 août 2026.** La fonction était juste, mais
 * seul l'écran Chantiers l'appelait : le planning filtrait sur
 * `datePlanifiee < aujourd'hui` en TypeScript, et le dépôt des terminés sur
 * `date_planifiee <= aujourd'hui` en SQL. Deux recopies, et un signe qui
 * diffère — un chantier prévu AUJOURD'HUI figurait dans les deux onglets. Le
 * contrôle qui prétendait couvrir la règle ne vérifiait que la fonction pure,
 * jamais que les écrans l'appellent.
 *
 * D'où les deux portes ci-dessous, et le contrôle qui exige qu'elles répondent
 * la même chose : un dépôt n'a pas de statut affiché sous la main, il a des
 * jalons datés. Lui faire dériver le statut à la main aurait été la troisième
 * recopie.
 */
export type OngletChantier = "chantiers" | "planning" | "termines";

/**
 * Le cœur de la règle, en une seule expression.
 *
 * @param fini  Le chantier est-il clos — facturé, ou déclaré terminé ?
 */
function rangement(fini: boolean, datePlanifiee: string | null | undefined, aujourdHui: string): OngletChantier {
  // Facturé ou déclaré terminé : c'est fini, quoi qu'en dise la date.
  //
  // **Y compris quand la date est encore à venir.** Le patron peut clôturer un
  // chantier plus tôt que prévu depuis sa fiche, et c'est délibéré (3 août
  // 2026). Tant que ce cas n'était pas traité ici, le chantier restait affiché
  // au planning comme si rien ne s'était passé, et la facture qu'il venait de
  // préparer n'était plus joignable que par son adresse.
  if (fini) return "termines";

  // **La date passée fait basculer, même sans « Fin de chantier ».** Le travail
  // a eu lieu ; le laisser au planning encombrerait ce qui est à venir, et le
  // laisser dans les chantiers laisserait croire qu'il reste à préparer.
  if (datePlanifiee && datePlanifiee < aujourdHui) return "termines";

  // Planifié pour aujourd'hui ou plus tard : il vit au planning, et nulle part
  // ailleurs. Aujourd'hui compte comme à venir — la journée n'est pas finie, et
  // c'est du planning que le patron le clôture en rentrant.
  if (datePlanifiee) return "planning";

  // Tout le reste — brouillon, devis parti, réponse attendue, refus à
  // reprendre — est du travail en cours : c'est la liste des chantiers.
  return "chantiers";
}

/** L'onglet, depuis le statut affiché. C'est la forme dont disposent les écrans. */
export function ongletDuChantier(
  c: { statut: ChantierStatut; datePlanifiee?: string | null },
  aujourdHui: string = jourIso(new Date())
): OngletChantier {
  const fini = c.statut === "facture" || c.statut === "termine";
  // Un statut « planifié » sans date ne devrait pas exister — `getStatutAffiche`
  // ne le rend que si la date est posée. Le filet reste : il coûte une ligne, et
  // sans lui un tel chantier retomberait dans les chantiers en cours.
  if (!fini && !c.datePlanifiee && c.statut === "planifie") return "planning";
  return rangement(fini, c.datePlanifiee, aujourdHui);
}

/**
 * L'onglet, depuis les jalons de la base. C'est la forme dont disposent les
 * dépôts, qui n'ont pas de statut affiché sous la main.
 *
 * Les deux portes rendent forcément le même onglet — `test-onglet-chantier.ts`
 * l'exige sur toutes les combinaisons.
 */
export type JalonsDeRangement = {
  datePlanifiee?: string | null;
  termineAt?: Date | string | null;
  factureEnvoyeeAt?: Date | string | null;
};

export function ongletDepuisJalons(
  c: JalonsDeRangement,
  aujourdHui: string = jourIso(new Date())
): OngletChantier {
  return rangement(Boolean(c.factureEnvoyeeAt || c.termineAt), c.datePlanifiee, aujourdHui);
}

/**
 * Le chantier figure-t-il sous « Planifiés », sur l'écran Planning ?
 *
 * **Extraite de l'écran le 8 août 2026, et c'est le vrai correctif.** Tant que
 * ce filtre vivait dans le composant, aucun contrôle ne pouvait constater qu'il
 * contredisait la règle : `test-onglet-chantier.ts` éprouvait la fonction pure,
 * qui était juste, pendant que l'écran en appliquait une copie fautive à côté.
 * Un contrôle qui ne peut pas atteindre le code qui décide ne prouve rien.
 *
 * Deux conditions, et elles ne disent pas la même chose : la première tient au
 * parcours du devis (le client a-t-il répondu ?), la seconde au rangement (le
 * chantier est-il encore à venir ?).
 */
export function estAuPlanning(
  c: JalonsDeRangement & EtatPourPlanification,
  aujourdHui: string = jourIso(new Date()),
  maintenant: Date = new Date()
): boolean {
  return getPlanificationEtat(c, maintenant) === "planifie" && ongletDepuisJalons(c, aujourdHui) === "planning";
}
