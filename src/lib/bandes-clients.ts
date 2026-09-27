import { detacherCivilite } from "./civilite";

/**
 * L'ordre de la liste des clients, et les bandes qui l'annoncent.
 *
 * **Sa demande du 27 septembre 2026 :** *« Filtre client trier par ordre
 * alphabétique »*, puis, planche en main (`appli/clients-a-a-z.html`) : *« la
 * A, mais il faut garder le filtre qui existe aujourd'hui »*. La liste se range
 * donc de A à Z, et les bandes sont des LETTRES. La recherche ne change pas :
 * elle filtre la liste rangée, et ses résultats restent sans bande.
 *
 * **Avant, du 3 au 27 septembre**, la liste allait du chantier le plus récent
 * au plus ancien, en bandes de mois (sa remarque du 3 septembre : *« une liste
 * longue se parcourt à l'aveugle »*). Les bandes restent pour cette raison-là :
 * elles nomment l'ordre, et donnent au pouce des repères où s'arrêter.
 *
 * **Règle pure, hors de tout écran** (`CLAUDE.md` §3) : le dépôt range avec
 * `rangerParNom`, l'écran groupe avec `grouperEnBandes`, et rien d'autre ne
 * décide de l'ordre.
 */

/** Ce dont le rangement a besoin d'un client. */
export type ClientRange = { nom: string; dernierJour: string | null };

/** Un nom qui ne commence pas par une lettre (« 3F Habitat », un nom vide). */
export const BANDE_HORS_ALPHABET = "#";

/**
 * Le nom sans sa civilité, sans accents ni casse : c'est lui qui range.
 *
 * **Trier sur le nom brut rangerait toutes les « Mme » ensemble, puis tous les
 * « Mr. »** : l'ordre alphabétique ne servirait à rien. La civilité se retire
 * par la fonction qui la reconnaît déjà partout (`detacherCivilite`), jamais
 * par une seconde liste de titres.
 */
function cleDuNom(nom: string): string {
  return detacherCivilite(nom)
    .nom.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");
}

/** La bande d'un client : la première lettre de son nom sans civilité. */
export function lettreDuClient(nom: string): string {
  const premiere = cleDuNom(nom).charAt(0).toUpperCase();
  return /^[A-Z]$/.test(premiere) ? premiere : BANDE_HORS_ALPHABET;
}

/**
 * La liste rangée de A à Z, **sans toucher à celle reçue**.
 *
 * Un nom hors alphabet va en fin de liste, jamais entre deux lettres. À nom
 * égal (quatre Martins), le plus récent passe devant : c'est celui qu'il
 * cherche, et c'était l'ordre d'avant, gardé à l'intérieur du nom.
 */
export function rangerParNom<T extends ClientRange>(clients: readonly T[]): T[] {
  return [...clients].sort((a, b) => {
    const horsA = lettreDuClient(a.nom) === BANDE_HORS_ALPHABET;
    const horsB = lettreDuClient(b.nom) === BANDE_HORS_ALPHABET;
    if (horsA !== horsB) return horsA ? 1 : -1;
    const parNom = cleDuNom(a.nom).localeCompare(cleDuNom(b.nom), "fr");
    if (parNom !== 0) return parNom;
    return (b.dernierJour ?? "").localeCompare(a.dernierJour ?? "");
  });
}

/**
 * Le jour qui départage deux clients du même nom : **le plus récent qui soit
 * DÉJÀ PASSÉ.**
 *
 * **Sa capture du 26 septembre 2026 :** *« pourquoi il y a un plus ancien ? »*
 * Un client au chantier planifié en novembre passait pour le plus récent de
 * tous, montait en tête, et s'y rangeait sous « plus ancien » : un jour à venir
 * n'est dans aucun mois écoulé. Sa décision : la liste range ce qui s'est
 * produit, jamais ce qui est prévu. Le chantier à venir se lit au planning.
 *
 * Depuis le 27 septembre 2026 il ne range plus la liste entière (elle va de A
 * à Z) : il départage les homonymes, les quatre Martins.
 *
 * `null` : aucun jour passé, le client passe après ses homonymes datés.
 */
export function jourDeRangement(
  jours: readonly (string | null | undefined)[],
  aujourdHui: string
): string | null {
  let garde: string | null = null;
  for (const jour of jours) {
    if (jour && jour <= aujourdHui && (!garde || jour > garde)) garde = jour;
  }
  return garde;
}

/**
 * La liste découpée en bandes, **dans l'ordre où elle arrive**.
 *
 * **Elle ne trie RIEN**, et c'est délibéré : le tri vit dans le dépôt
 * (`listerFichesClients`, par `rangerParNom`). Retrier ici ferait deux règles
 * d'ordre pour une même liste, et c'est l'écran qui aurait tort sans que rien
 * ne le dise (`CLAUDE.md` §3).
 *
 * Les groupes suivent donc les suites de clients qui se touchent. Sur une liste
 * rangée, une lettre ne peut pas revenir deux fois ; sur une liste qui ne le
 * serait plus, elle reviendrait, et cela se verrait, ce qui vaut mieux qu'un
 * regroupement qui masquerait le désordre.
 */
export function grouperEnBandes<T extends { nom: string }>(
  clients: readonly T[]
): { bande: string; clients: T[] }[] {
  const groupes: { bande: string; clients: T[] }[] = [];
  for (const client of clients) {
    const bande = lettreDuClient(client.nom);
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.bande === bande) dernier.clients.push(client);
    else groupes.push({ bande, clients: [client] });
  }
  return groupes;
}
