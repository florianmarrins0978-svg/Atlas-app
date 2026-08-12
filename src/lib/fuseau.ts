/**
 * Passer d'une heure de pendule à un instant, et retour.
 *
 * **Pourquoi ce module existe, et pourquoi il est à part.** Un agenda parle en
 * heures locales — « mardi 9 h » — et Atlas raisonne en instants. La conversion
 * paraît triviale et ne l'est pas : la France change d'heure deux fois par an,
 * un `+1` figé se trompe la moitié de l'année, et l'erreur ne se voit qu'en
 * décalant un rendez-vous d'une heure — assez peu pour passer inaperçu, assez
 * pour faire basculer une matinée d'un côté ou de l'autre de midi.
 *
 * `src/lib/agenda-externe.ts` fait déjà le trajet **instant → heure locale**.
 * Ici, c'est l'inverse : **heure locale → instant**, dont on a besoin pour lire
 * un `DTSTART;TZID=Europe/Paris:20260812T090000` et pour écrire un chantier
 * dans l'agenda. Deux directions, deux fonctions ; les mêler dans une seule
 * « utilitaire de fuseau » rendrait chaque appel ambigu à la lecture.
 */

/**
 * De combien un fuseau devance UTC à cet instant, en minutes.
 *
 * Passe par `Intl` : c'est la seule source qui connaisse les règles réelles
 * d'un fuseau — changements d'heure compris, y compris ceux qui ont changé de
 * date au fil des années.
 */
export function decalageMinutes(fuseau: string, instant: Date): number {
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const lire = (type: string) => Number(parties.find((p) => p.type === type)?.value ?? "0");
  // Ce que la pendule locale affiche, relu COMME SI c'était de l'UTC : la
  // différence avec l'instant réel est exactement le décalage cherché.
  const commeSiUtc = Date.UTC(
    lire("year"),
    lire("month") - 1,
    lire("day"),
    lire("hour"),
    lire("minute"),
    lire("second")
  );
  // Les millisecondes sont écartées des deux côtés : `formatToParts` n'en rend
  // pas, et les garder ferait osciller le résultat de moins d'une seconde.
  return Math.round((commeSiUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/**
 * L'instant que désigne une heure de pendule dans un fuseau donné.
 *
 * **Deux passes, et la seconde n'est pas une précaution superflue.** Le
 * décalage dépend de l'instant, et l'instant est justement ce qu'on cherche :
 * on part d'une estimation, on mesure le décalage qu'elle implique, on corrige,
 * puis on remesure. Sans la seconde passe, une heure située juste après un
 * changement d'heure se convertit avec le décalage de la veille — soixante
 * minutes d'écart, deux fois par an, sur les seules dates où personne ne pense
 * à regarder.
 *
 * **Les heures qui n'existent pas ou existent deux fois** — celles que le
 * changement d'heure saute ou répète — sont rendues sans erreur, en retenant le
 * décalage mesuré après correction. Aucun choix n'est juste dans ces cas-là ;
 * ce qui compte est de ne pas jeter, car une exception ici ferait tomber la
 * lecture d'un agenda entier pour un seul rendez-vous du dernier dimanche
 * d'octobre.
 */
export function instantDepuisLocal(
  parties: {
    annee: number;
    mois: number;
    jour: number;
    heure?: number;
    minute?: number;
    seconde?: number;
  },
  fuseau: string
): Date {
  const commeSiUtc = Date.UTC(
    parties.annee,
    parties.mois - 1,
    parties.jour,
    parties.heure ?? 0,
    parties.minute ?? 0,
    parties.seconde ?? 0
  );

  try {
    const premier = decalageMinutes(fuseau, new Date(commeSiUtc));
    const estimation = commeSiUtc - premier * 60000;
    const second = decalageMinutes(fuseau, new Date(estimation));
    return new Date(commeSiUtc - second * 60000);
  } catch {
    // Fuseau inconnu d'`Intl` — un agenda peut porter un `TZID` maison. Lire
    // l'heure comme de l'UTC est faux, mais borné : au pire quelques heures
    // d'écart sur un rendez-vous, là où jeter perdrait l'agenda entier.
    return new Date(commeSiUtc);
  }
}
