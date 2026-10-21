/**
 * L'ORDRE DU FIL DE L'ACCUEIL : la date qu'il montre, la plus récente en tête.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa plainte du 20 octobre 2026 :** *« J'ai créé un chantier Simon Bandera
 * avec la fiche client. J'ai fait retour et le chantier n'apparaît pas dans les
 * chantiers en cours. »*
 *
 * Le chantier était créé. L'accueil recollait deux listes bout à bout, chacune
 * triée à sa façon : tous les contrats d'entretien d'abord (par mise à jour),
 * puis les chantiers (par création). Le fil affichait « 13 oct. », « 03 oct. »,
 * et le chantier du jour venait APRÈS, sous le pli. Un fil qui porte des dates
 * se lit dans l'ordre de ces dates : personne ne cherche aujourd'hui sous le
 * 3 octobre.
 *
 * **Une seule clé, et c'est celle qui s'affiche** (`majAt`, le quantième de la
 * ligne). Trier sur une autre date que celle qu'on montre referait le défaut
 * à la première ligne retouchée. Le tri est stable : deux lignes du même
 * instant gardent l'ordre où elles arrivent.
 */
export function dansLOrdreDuFil<T extends { majAt: Date }>(lignes: readonly T[]): T[] {
  return [...lignes].sort((a, b) => b.majAt.getTime() - a.majAt.getTime());
}
