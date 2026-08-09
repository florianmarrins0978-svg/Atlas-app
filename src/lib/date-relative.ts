/**
 * « Aujourd'hui », « Hier », « 12 nov. » — la date telle qu'on la lit, pas
 * telle qu'elle est stockée.
 *
 * **Pourquoi une fonction pure, dans `src/lib/`.** Le patron l'a demandée sur
 * les cartes de l'écran Chantiers. Une date relative se trompe toujours au même
 * endroit — le passage de minuit, le fuseau, le changement d'année — et ces
 * cas-là ne s'éprouvent pas en cliquant sur un écran. Ici, ils se posent en
 * trois lignes (`scripts/test-date-relative.ts`).
 *
 * **On compare des JOURS, jamais des heures.** Un chantier touché il y a vingt
 * heures peut être « hier » ou « aujourd'hui » selon l'heure qu'il est : c'est
 * le calendrier qui décide, pas une soustraction de millisecondes. D'où le
 * passage par la date locale de l'artisan.
 */

/** Le jour civil, à l'heure de l'artisan — jamais UTC. */
function jourCivil(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function libelleDateRelative(quand: Date | string | null | undefined, maintenant = new Date()): string {
  if (!quand) return "";
  const date = quand instanceof Date ? quand : new Date(quand);
  if (Number.isNaN(date.getTime())) return "";

  const ecart = jourCivil(maintenant) - jourCivil(date);

  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return "Hier";
  // Au-delà de la semaine écoulée, « il y a 23 jours » ne dit plus rien
  // d'utile : c'est la date qu'on cherche. En deçà, elle situe mieux.
  if (ecart > 1 && ecart < 7) return `Il y a ${ecart} jours`;

  // **L'année n'apparaît que si elle diffère.** L'écrire toujours alourdit
  // douze mois de cartes pour le seul cas du chantier de l'an dernier.
  const memeAnnee = date.getFullYear() === maintenant.getFullYear();
  const jourEtMois = `${date.getDate()} ${MOIS[date.getMonth()]}`;
  return memeAnnee ? jourEtMois : `${jourEtMois} ${date.getFullYear()}`;
}
