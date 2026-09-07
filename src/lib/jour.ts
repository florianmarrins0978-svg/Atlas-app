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

/**
 * « lundi 23 mars », « samedi 1er août » — et « lundi 8 février 2027 ».
 *
 * **L'année n'apparaît que si ce n'est pas la nôtre**, et cette exception est
 * arrivée avec les dates lointaines (8 août 2026). Depuis que le patron peut
 * proposer un chantier à dix-huit mois, « lundi 8 février » ne désigne plus rien
 * : février prochain, ou celui d'après ? Il enverrait une date à un an d'écart
 * de ce qu'il croit, et son client la lirait de même.
 *
 * L'ajouter partout aurait alourdi les quatre-vingt-dix-neuf cas sur cent où
 * elle ne sert à rien — un devis pour jeudi prochain n'a pas besoin de son
 * millésime.
 */
export function jourLisible(iso: string, aujourdHui: Date = new Date()): string {
  const [a, m, j] = iso.split("-").map(Number);
  if (!a || !m || !j) return iso;
  const jourSemaine = JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()];
  // Le premier du mois est le seul ordinal en français : « 1er août », jamais
  // « 1 août ». Sur un devis, cette faute se remarque.
  const annee = a === aujourdHui.getUTCFullYear() ? "" : ` ${a}`;
  return `${jourSemaine} ${j === 1 ? "1er" : j} ${MOIS[m - 1]}${annee}`;
}

/**
 * « 04/08/2026 » — le format des documents français.
 *
 * Le patron, sur son devis : « la date est à l'envers ! C'est jour/mois/année ».
 * Le PDF imprimait la date telle qu'elle est stockée, `2026-08-04`. Ce format
 * est parfait en base — il se trie tout seul — et illisible sur une pièce que
 * l'on présente à un client : personne, en France, n'écrit une date ainsi.
 *
 * Même précaution que `jourLisible` : aucun `new Date(iso)`, qui décalerait le
 * jour selon le fuseau du lecteur.
 */
export function jourNumerique(iso: string): string {
  const [a, m, j] = iso.split("-");
  if (!a || !m || !j) return iso;
  return `${j}/${m}/${a}`;
}

/**
 * Le mois d'un jour, en toutes lettres : « septembre », « août ».
 *
 * **Une seule table de mois dans le dépôt**, et c'est celle-ci (`CLAUDE.md`
 * §3). La liste des clients en a besoin pour nommer ses bandes ; en recopier
 * une seconde, c'est se donner deux orthographes d'« août » et n'en corriger
 * qu'une le jour venu.
 */
export function moisDuJour(iso: string): string | null {
  const mois = Number(iso.split("-")[1]);
  return MOIS[mois - 1] ?? null;
}

/**
 * « 6 août », « 1er août » — le jour sans son jour de semaine ni son année.
 *
 * Pour les listes où la date n'est qu'un repère de second rang : la ligne d'un
 * achat de TVA en est l'exemple, sous le nom du fournisseur. « jeudi 6 août »
 * y prendrait la moitié de la largeur pour un mot que personne ne lit.
 *
 * **Elle existe pour qu'il n'y ait pas de seconde table de mois.** La ligne
 * d'achat en fabriquait une par `toLocaleDateString`, avec son propre fuseau à
 * midi pour ne pas décaler le jour — deux façons d'écrire « août » dans le même
 * dépôt, et une seule qui se corrigerait le jour venu (`CLAUDE.md` §3). Le
 * premier du mois garde son ordinal, comme dans `jourLisible`.
 */
export function jourEtMois(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  if (!a || !m || !j) return iso;
  return `${j === 1 ? "1er" : j} ${MOIS[m - 1]}`;
}

/** Le fuseau du patron. Ses journées se comptent chez lui, pas à Greenwich. */
export const FUSEAU_DU_PATRON = "Europe/Paris";

/**
 * Le jour d'un instant, au format « AAAA-MM-JJ », **à l'heure de son atelier**.
 *
 * Une seule définition pour tout le dépôt : les dates d'émission, d'échéance et
 * de création doivent toutes désigner le même jour, sans quoi une facture
 * pourrait porter une date et le relevé de TVA en compter une autre.
 *
 * **ELLE COMPTAIT LES JOURS EN UTC, et il l'a vu** (25 août 2026) : *« ce soir
 * à 00 h 00 il passe dans terminé ? »*. Non — il passait à **2 h du matin**,
 * l'été. Entre minuit et deux heures, Atlas croyait qu'on était encore la
 * veille : un chantier de la journée restait au planning, et une facture faite
 * en rentrant portait la date d'hier. Deux heures suffisent pour cela, et cette
 * fenêtre-là est précisément celle où un artisan finit sa journée.
 *
 * `Intl` est la seule source qui connaisse les vraies règles du fuseau —
 * l'heure d'été comprise. Un `+1` ou un `+2` figé se trompe la moitié de
 * l'année, et l'erreur ne se voit qu'un jour sur trente.
 */
export function jourIso(instant: Date): string {
  // « en-CA » rend « AAAA-MM-JJ », l'ordre dont on a besoin. Le composer à la
  // main depuis les parties reviendrait au même au prix de trois lignes.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU_DU_PATRON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
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
