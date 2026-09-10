/**
 * Le journal de navigation, côté navigateur.
 *
 * **La règle est ailleurs, et volontairement** : `src/lib/journal-de-navigation.ts`
 * dit comment le journal évolue, et s'éprouve sans navigateur. Ce fichier-ci ne
 * fait que le ranger et le relire — c'est la seule chose qu'on ne peut pas
 * éprouver hors d'un navigateur, et il n'y a donc rien d'autre dedans.
 *
 * **`sessionStorage` et non `localStorage`, ni un état de React :**
 *
 * | | |
 * |---|---|
 * | un état de React | perdu au rechargement — or son onglet reste ouvert des heures et son banc redémarre plusieurs fois par soirée (`HANDOVER.md`, piège 0) |
 * | `localStorage` | partagé entre les onglets : deux onglets ouverts se mélangeraient les fils, et la flèche de l'un renverrait où l'autre était |
 * | `sessionStorage` | un fil par onglet, qui survit au rechargement et meurt avec l'onglet. C'est exactement la durée de vie d'un bouton retour |
 *
 * **Un rangement refusé n'est pas une panne** — navigation privée, réglage du
 * navigateur, quota. Il n'y a alors pas de journal, et chaque flèche retombe
 * sur la sortie que son écran déclare : c'est le comportement d'avant ce lot.
 */
import {
  journalApresVisite,
  journalSansCetEcran,
  lireLeJournal,
} from "@/lib/journal-de-navigation";

const CLE = "atlas:journal-de-navigation";

/** Le journal de cet onglet, ou rien du tout. */
export function journalDeCetOnglet(): string[] {
  try {
    return lireLeJournal(window.sessionStorage.getItem(CLE));
  } catch {
    return [];
  }
}

function ranger(journal: string[]): void {
  try {
    window.sessionStorage.setItem(CLE, JSON.stringify(journal));
  } catch {
    // Rien à rattraper : sans rangement, il n'y a pas de journal, et les
    // flèches gardent la sortie déclarée par leur écran.
    return;
  }
}

/** On vient de poser le pied sur un écran. */
export function noterLaVisite(chemin: string): void {
  ranger(journalApresVisite(journalDeCetOnglet(), chemin));
}

/**
 * On quitte cet écran EN ARRIÈRE — ou il vient d'être effacé.
 *
 * Les deux gestes font la même chose au journal, et c'est voulu : dans les deux
 * cas, cet écran cesse d'être une destination possible (`journalSansCetEcran`).
 */
export function oublierCetEcran(chemin: string): void {
  ranger(journalSansCetEcran(journalDeCetOnglet(), chemin));
}
