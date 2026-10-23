import { jourEtMois, jourIso } from "./jour";

/**
 * LA FIN DE L'ACCORD DONNÉ À LA BANQUE — dite à l'accueil et dans Ma banque.
 *
 * Sa planche du 21 octobre 2026 (`appli/banque-qui-previent.html`) : la banque
 * redemande l'accord du titulaire à date fixe, et un automatisme qui s'arrête
 * sans prévenir vaut moins que pas d'automatisme du tout — les paiements se
 * remettraient à se noter à la main sans qu'il le sache.
 *
 * **Une seule règle pour les deux écrans** (`CLAUDE.md` §3) : sept jours avant,
 * et les mêmes mots.
 */
export const PREVENIR_JOURS_AVANT = 7;

export type AccordEnMots = {
  joursRestants: number;
  /** Dans les sept jours, ou déjà fini : l'accueil le dit, Ma banque le colore. */
  bientot: boolean;
  /** « Votre accord se termine dans 7 jours », « … demain », « … est terminé ». */
  titre: string;
  /** La phrase de Ma banque : « Votre banque redemandera votre accord le 21 janvier. » */
  echeance: string;
  /** Ce qui se passe après, pour la carte de l'accueil. */
  consequence: string;
};

export function accordEnMots(fin: Date, maintenant: Date): AccordEnMots {
  const joursRestants = Math.ceil((fin.getTime() - maintenant.getTime()) / (24 * 3600 * 1000));
  const date = jourEtMois(jourIso(fin));
  const titre =
    joursRestants <= 0
      ? "L'accord avec votre banque est terminé"
      : joursRestants === 1
        ? "Votre accord bancaire se termine demain"
        : `Votre accord bancaire se termine dans ${joursRestants} jours`;
  return {
    joursRestants,
    bientot: joursRestants <= PREVENIR_JOURS_AVANT,
    titre,
    echeance:
      joursRestants <= 0
        ? "L'accord donné à votre banque est terminé."
        : `Votre banque redemandera votre accord le ${date}.`,
    consequence:
      joursRestants <= 0
        ? "Les paiements se notent à la main jusqu'à ce que vous la reliiez."
        : `Le ${date}. Après, les paiements se noteront à la main.`,
  };
}
