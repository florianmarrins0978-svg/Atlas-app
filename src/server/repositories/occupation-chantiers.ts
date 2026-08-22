import { sql } from "drizzle-orm";
import { chantiers } from "../db/schema";
import { DUREE_PAR_DEFAUT_DEMI_JOURNEES, type JourIso } from "../disponibilites";

/**
 * Quels chantiers peuvent encore occuper une fenêtre qui commence à `debut`.
 *
 * **Le défaut que cette fonction répare, et il était grave.** Les trois
 * chemins qui calculent l'occupation bornaient leur requête sur
 * `date_planifiee >= debut` — le jour où le chantier *commence*. Or un chantier
 * de trois jours parti le **jeudi** tient encore le **lundi** suivant : sa date
 * de départ est hors de la fenêtre, la ligne n'est donc pas ramenée, et ce
 * lundi-là paraît **libre** alors qu'il est pris.
 *
 * Conséquence, dans les mots du patron le 22 août 2026 : *« je peux proposer le
 * 24 alors qu'un client a validé le 24 »*. Et ce n'était pas seulement l'écran
 * qui se trompait : la **revérification de la réponse du client** lisait la même
 * occupation tronquée, donc rien ne rattrapait la faute — deux chantiers se
 * seraient retrouvés le même jour, découverts sur le terrain.
 *
 * **Pourquoi la durée en JOURS suffit comme marge**, alors qu'elle est comptée
 * en demi-journées. `n` demi-journées valent `⌈n/2⌉` jours **ouvrés**, et le
 * week-end les étale : au pire, un départ le vendredi. Trois demi-journées
 * parties le vendredi occupent vendredi et lundi — trois jours calendaires
 * pour trois demi-journées. L'écart ne se creuse jamais au-delà, parce que
 * chaque semaine ajoute deux jours de week-end pour cinq jours ouvrés
 * gagnés. Reculer de `n` jours calendaires est donc toujours **généreux**.
 *
 * Trop ramener ne coûte rien : `compterOccupation` recalcule ensuite les
 * créneaux exacts, et une ligne de trop n'occupe rien qu'elle n'occupait pas.
 * Trop peu ramener coûte un chantier posé sur un autre.
 *
 * **Une durée absente vaut la journée par défaut** — le même choix que
 * `compterOccupation`, et pour la même raison : supposer moins libérerait, du
 * jour au lendemain, des demi-journées déjà prises.
 */
export function encoreEnCoursDepuis(debut: JourIso) {
  return sql`${chantiers.datePlanifiee} + (COALESCE(${chantiers.dureeDemiJournees}, ${DUREE_PAR_DEFAUT_DEMI_JOURNEES}) * INTERVAL '1 day') >= ${debut}::date`;
}
