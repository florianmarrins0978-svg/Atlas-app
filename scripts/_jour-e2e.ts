/**
 * LE JOUR, TEL QUE L'APPLICATION LE COMPTE — pour les suites qui posent des
 * dates en base.
 *
 * **Pourquoi ce fichier existe.** Les suites écrivaient `CURRENT_DATE`, c'est-à-
 * dire le jour de PostgreSQL, qui tourne en UTC dans nos environnements. Depuis
 * que l'application compte ses journées à l'heure de l'atelier
 * (`ARCHITECTURE.md` §177), les deux divergent entre minuit et 2 h du matin :
 * un chantier posé « aujourd'hui » par la suite était déjà d'hier pour l'écran,
 * et deux suites rougissaient — sur du code juste, une nuit sur douze.
 *
 * C'est le piège que `CLAUDE.md` §3 nomme : deux définitions de la même règle
 * finissent toujours par diverger. Les suites lisent donc la MÊME que l'écran.
 */
import { jourIso } from "../src/lib/jour";

/**
 * Le jour du patron, reculé de `joursAvant` (0 = aujourd'hui).
 *
 * L'arithmétique se fait sur le calendrier, pas sur des millisecondes : reculer
 * de 24 heures se trompe d'un jour deux fois par an, quand la nuit du
 * changement d'heure dure 23 ou 25 heures.
 */
export function jourDuPatron(joursAvant = 0): string {
  const [a, m, j] = jourIso(new Date()).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j - joursAvant)).toISOString().slice(0, 10);
}
