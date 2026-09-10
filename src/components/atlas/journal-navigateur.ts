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

/**
 * ─── D'OÙ VIENT CETTE ENTRÉE D'HISTORIQUE ──────────────────────────────────
 *
 * **Le journal dit OÙ la flèche mène. Ceci dit si l'on peut y RECULER.**
 *
 * Les deux questions sont différentes, et c'est pourquoi il y a deux
 * mécanismes plutôt qu'une règle dédoublée (`CLAUDE.md` §3) :
 *
 * | la question | ce qui y répond |
 * |---|---|
 * | où la flèche doit-elle mener ? | le **journal de l'onglet** — il survit au rechargement, et il RETIRE un écran qu'on vient d'enregistrer |
 * | cette page est-elle littéralement l'entrée d'historique d'avant ? | **cette marque-ci**, posée sur l'entrée elle-même |
 *
 * **Pourquoi la seconde question se pose — sa remarque du 9 septembre 2026 :**
 * *« Si je clique sur un client tout en bas de la liste, je fais retour, il me
 * remet en haut de la liste. Je veux rester où j'étais ! »*
 *
 * Mesuré sur la version bâtie, quarante-sept clients descendus jusqu'au bout :
 *
 * | Le geste | Où l'on retombe |
 * |---|---|
 * | un lien vers l'écran d'avant | **0 px** — Next.js pose une page neuve en haut, et il a raison |
 * | le retour du navigateur | **2 941 px** — exactement sa place |
 *
 * Le navigateur sait donc déjà rendre sa place. Il n'y avait rien à inventer :
 * il fallait cesser de l'en empêcher, et c'est ce que fait `FlecheRetour` quand
 * cette marque confirme que la destination est bien l'entrée d'avant.
 *
 * **CE QUE CETTE MARQUE NE REMET PAS EN CAUSE**, et il faut le lire avant de la
 * toucher : les trois objections à `history.back()` écrites dans
 * `src/lib/journal-de-navigation.ts` tiennent toujours, et aucune n'est
 * contournée ici —
 *
 *   1. *« la flèche est un `<Link>`, on l'ouvre dans un onglet »* : elle en
 *      reste un, avec sa vraie adresse. Seul l'appui simple est intercepté ;
 *   2. *« `history.back()` ment après un rechargement ou un signet »* : sans
 *      marque, on ne recule pas. Une page rechargée n'en porte aucune ;
 *   3. *« après un enregistrement, il redéposerait sur le formulaire quitté »* :
 *      c'est le journal qui décide de la destination, et il a retiré ce
 *      formulaire. La marque ne pourra pas correspondre, donc on n'y recule pas.
 *
 * La marque **ne choisit jamais où l'on va** : elle autorise seulement à y aller
 * par le chemin qui rend sa place.
 */
const PROVENANCE = "atlasVenantDe";

type EtatMarque = { [PROVENANCE]?: string | null };

/** L'adresse quittée par la dernière navigation de CE document. */
let quittee: string | null = null;

/**
 * Marque l'entrée d'historique courante de l'adresse d'où elle a été ouverte.
 *
 * **Sur l'entrée elle-même, jamais dans une variable** : une variable ne dirait
 * rien des entrées qu'on retraverse — reculer de trois écrans puis avancer de
 * deux la rendrait fausse sans que rien ne le signale.
 */
export function marquerLaProvenance(ici: string): void {
  const etat: unknown = window.history.state;
  // Sans état, l'entrée n'a pas été posée par Next : on ne la marque pas, et la
  // flèche navigue comme avant — le repli sûr.
  if (etat && typeof etat === "object") {
    const marque = etat as EtatMarque;
    // Déjà marquée : c'est une entrée qu'on RETRAVERSE. La réécrire lui ferait
    // dire d'où l'on vient MAINTENANT, alors qu'elle doit dire d'où elle a été
    // ouverte la première fois.
    if (!(PROVENANCE in marque)) {
      try {
        window.history.replaceState({ ...marque, [PROVENANCE]: quittee }, "");
      } catch {
        // Un historique qui refuse d'être marqué n'est pas une panne : la
        // flèche retombe sur le lien ordinaire, comme avant ce lot.
        quittee = ici;
        return;
      }
    }
  }
  quittee = ici;
}

/** L'entrée d'historique d'avant est-elle exactement cette adresse ? */
export function onPeutReculerVers(adresse: string): boolean {
  const etat: unknown = window.history.state;
  if (!etat || typeof etat !== "object") return false;
  return (etat as EtatMarque)[PROVENANCE] === adresse;
}
