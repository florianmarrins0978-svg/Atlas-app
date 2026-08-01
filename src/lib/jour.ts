// Formatage et calculs sur un JOUR (« AAAA-MM-JJ »), partagés par la page du
// client et son formulaire.
//
// Volontairement sans `new Date(iso)` : une date de ce format désigne un jour,
// pas un instant. La passer par le constructeur la décalerait selon le fuseau
// du visiteur — un chantier calé le lundi 23 s'afficherait « dimanche 22 » chez
// une partie des clients, ce qui est pire qu'inutile sur un devis.

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** « lundi 23 mars », « samedi 1er août » */
export function jourLisible(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  if (!a || !m || !j) return iso;
  const jourSemaine = JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()];
  // Le premier du mois est le seul ordinal en français : « 1er août », jamais
  // « 1 août ». Sur un devis, cette faute se remarque.
  return `${jourSemaine} ${j === 1 ? "1er" : j} ${MOIS[m - 1]}`;
}

/** Délai légal de rétractation pour une acceptation à distance. */
export const DELAI_RETRACTATION_JOURS = 14;

/**
 * Le jour retenu tombe-t-il avant la fin du délai de rétractation ?
 *
 * Seule condition d'affichage de la case de démarrage anticipé : montrée en
 * permanence, elle deviendrait du décor — et une case qu'on coche sans la lire
 * ne prouve rien.
 */
export function dansDelaiRetractation(iso: string, aujourdHui: string): boolean {
  const cible = Date.parse(`${iso}T00:00:00Z`);
  const base = Date.parse(`${aujourdHui}T00:00:00Z`);
  if (Number.isNaN(cible) || Number.isNaN(base)) return false;
  return cible - base < DELAI_RETRACTATION_JOURS * 86400_000;
}
