import { eq, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { chantiers, equipesDuChantier } from "../db/schema";
import { DUREE_PAR_DEFAUT_DEMI_JOURNEES, type JourIso, type Moment } from "../disponibilites";

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

/**
 * Combien d'équipes chaque chantier mobilise, par demi-journée.
 *
 * **Écrite une fois pour les trois chemins d'occupation** — l'écran d'envoi, la
 * validation de la date du patron, la revérification de la réponse du client.
 * Le planning, lui, tient déjà ces nombres à l'écran : c'est la même règle, lue
 * de deux sources, et elle doit rendre le même verdict des deux côtés
 * (`CLAUDE.md` §3). Si l'un fermait la journée pendant que l'autre l'offrait au
 * client, on n'aurait fait que déplacer le défaut du 22 août 2026.
 *
 * **Les affectations ne portent pas de jour**, seulement une demi-journée : un
 * chantier de trois jours emmène la même équipe le matin de chacun de ses
 * jours. C'est le modèle posé par la migration 0058, et il suffit — on ne
 * change pas d'équipe au milieu d'un chantier.
 */
export async function equipesParChantier(
  tx: DbOrTx,
  entrepriseId: string
): Promise<Map<string, Partial<Record<Moment, number>>>> {
  const lignes = await tx
    .select({ chantierId: equipesDuChantier.chantierId, demi: equipesDuChantier.demi })
    .from(equipesDuChantier)
    .where(eq(equipesDuChantier.entrepriseId, entrepriseId));

  const par = new Map<string, Partial<Record<Moment, number>>>();
  for (const l of lignes) {
    if (l.demi !== "matin" && l.demi !== "apres_midi") continue;
    const siennes = par.get(l.chantierId) ?? {};
    siennes[l.demi] = (siennes[l.demi] ?? 0) + 1;
    par.set(l.chantierId, siennes);
  }
  return par;
}
