import { moisDuJour } from "./jour";

/**
 * Les bandes qui annoncent l'ordre de la liste des clients.
 *
 * **Sa remarque du 3 septembre 2026, maquette en main :** *« une liste longue se
 * parcourt à l'aveugle : il n'y a ni ordre annoncé, ni repère pour sauter
 * quelque part. »*
 *
 * **La liste ÉTAIT déjà rangée — du chantier le plus récent au plus ancien**
 * (`listerFichesClients`). Personne ne pouvait le savoir : rien ne le disait, et
 * `page.tsx` ne transmettait même pas la date qui commande ce tri. Ces bandes ne
 * changent donc pas l'ordre : elles le NOMMENT, et donnent au pouce des repères
 * où s'arrêter en descendant vingt et un noms.
 *
 * **Trois mois nommés, le reste groupé.** Un mois par bande donnerait neuf
 * bandes pour vingt et un clients : le repère deviendrait le bruit qu'il devait
 * réduire. Les trois derniers mois sont ceux dont il se souvient — au-delà, il
 * cherche par le nom, pas par la date.
 *
 * **Règle pure, hors de tout écran** (`CLAUDE.md` §3) : la même fonction range
 * la liste et se laisse éprouver sans base ni navigateur.
 */

/** Ce dont une bande a besoin d'un client : la date de son dernier chantier. */
export type ClientDate = { dernierJour: string | null };

/** Un client sans aucun chantier : il n'a pas de date, et il passe en dernier. */
export const BANDE_SANS_CHANTIER = "sans chantier";

/** Au-delà des trois mois nommés. */
export const BANDE_PLUS_ANCIEN = "plus ancien";

/**
 * Le nombre de mois entre deux jours « AAAA-MM-JJ ».
 *
 * **En mois de calendrier, jamais en jours divisés par trente.** Le 1er
 * septembre et le 31 août sont à un jour l'un de l'autre et dans deux bandes :
 * c'est voulu, ce sont deux mois. Compter en jours ferait sauter la frontière
 * d'un mois à l'autre selon la longueur de février.
 */
function moisDEcart(jour: string, aujourdHui: string): number | null {
  const [a, m] = jour.split("-").map(Number);
  const [aa, am] = aujourdHui.split("-").map(Number);
  if (!a || !m || !aa || !am) return null;
  return (aa - a) * 12 + (am - m);
}

/**
 * La bande d'un client, en bas de casse — l'écran la met en capitales.
 *
 * **Une date que l'on ne sait pas lire tombe dans « plus ancien »**, jamais dans
 * un « undefined » posé au milieu de sa liste. Elle ne se perd pas pour autant :
 * elle reste rangée à sa place par le tri, qui, lui, n'a pas besoin de la
 * comprendre.
 */
export function bandeDuClient(dernierJour: string | null, aujourdHui: string): string {
  if (!dernierJour) return BANDE_SANS_CHANTIER;
  const ecart = moisDEcart(dernierJour, aujourdHui);
  if (ecart === null || ecart < 0 || ecart > 2) return BANDE_PLUS_ANCIEN;
  return moisDuJour(dernierJour) ?? BANDE_PLUS_ANCIEN;
}

/**
 * La liste découpée en bandes, **dans l'ordre où elle arrive**.
 *
 * **Elle ne trie RIEN**, et c'est délibéré : le tri vit dans le dépôt
 * (`listerFichesClients`), qui range du plus récent au plus ancien. Retrier ici
 * ferait deux règles d'ordre pour une même liste — et c'est l'écran qui aurait
 * tort sans que rien ne le dise (`CLAUDE.md` §3).
 *
 * Les groupes suivent donc les suites de clients qui se touchent. Sur une liste
 * rangée, une bande ne peut pas revenir deux fois ; sur une liste qui ne le
 * serait plus, elle reviendrait — et cela se verrait, ce qui vaut mieux qu'un
 * regroupement qui masquerait le désordre.
 */
export function grouperEnBandes<T extends ClientDate>(
  clients: readonly T[],
  aujourdHui: string
): { bande: string; clients: T[] }[] {
  const groupes: { bande: string; clients: T[] }[] = [];
  for (const client of clients) {
    const bande = bandeDuClient(client.dernierJour, aujourdHui);
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.bande === bande) dernier.clients.push(client);
    else groupes.push({ bande, clients: [client] });
  }
  return groupes;
}
