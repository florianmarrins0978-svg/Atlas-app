import type { EnvoiNote } from "./envoi-note-vocale";
import { phraseDeLiaison, type EtatLiaison } from "./diagnostic-liaison";

/**
 * UNE NOTE DICTÉE SANS RÉSEAU EST GARDÉE — ce qui décide, sans navigateur.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **Sa planche du 5 novembre 2026, la B le 6** (`appli/soignee/note-sans-reseau.html`) :
 * *« je pense qu'il faut appuyer pour que la note parte »*. Jusque-là, un
 * envoi raté rendait « puis refaites la note » et le son partait avec la
 * variable qui le portait. La note reste désormais sur le téléphone ; le
 * disque dit « Gardée » tant que le serveur est injoignable, puis « Envoyer »,
 * et c'est son appui qui l'envoie.
 *
 * **Pourquoi la B ne part pas toute seule** : c'est son choix, contre la
 * recommandation A. Le risque qu'il a pris est l'oubli ; la ligne de l'accueil
 * qui le compenserait attend sa planche (`TODO.md`).
 *
 * Ce fichier ne touche ni au stockage du téléphone, ni à l'écran : l'un vit
 * dans `src/app/chantiers/[id]/notes-gardees.ts`, l'autre dans
 * `AnneauNoteVocale.tsx`. Ils ne décident de rien (`CLAUDE.md` §3).
 */

/**
 * Pourquoi la note est gardée. `serveur` : le serveur a répondu, mal, ou par
 * autre chose que la route (une page de connexion, une panne de stockage) ;
 * le son n'est pas en cause, il repartira.
 */
export type CauseGardee = EtatLiaison | "session" | "serveur";

/**
 * Faut-il garder la note après cet envoi ?
 *
 * **Tout se garde, sauf un contenu que le serveur ne recevra jamais** (un son
 * illisible, un fichier trop gros) : le renvoyer à l'identique rendrait le
 * même refus, et garder la voix du client sur le téléphone pour rien est
 * pire que de le dire.
 */
export function causeDeLaGarde(resultat: EnvoiNote): CauseGardee | null {
  if (resultat.ok) return null;
  if (resultat.nonRecevable) return null;
  if (resultat.liaison) return resultat.liaison;
  if (resultat.sessionPerimee) return "session";
  return "serveur";
}

/**
 * Le disque : « Gardée » ou « Envoyer ».
 *
 * **Seule l'absence de réseau retient le disque.** `joignable` vient d'une
 * question posée au serveur (`diagnostiquerLiaison`), pas de
 * `navigator.onLine`, qui répond « en ligne » sur un wifi sans internet :
 * le disque y proposerait Envoyer pour un envoi qui ne peut pas partir.
 * Ne pas savoir (`null`) n'est pas « revenu ».
 */
export function etatDuDisque(cause: CauseGardee, joignable: boolean | null): "gardee" | "a-envoyer" {
  return cause === "hors-ligne" && joignable !== true ? "gardee" : "a-envoyer";
}

/**
 * La phrase sous le disque — celle de la planche, et le moins de mots possible.
 *
 * **Sur une fiche NEUVE, elle dit de rester sur la page** : le chantier n'existe
 * pas encore, la note n'a donc rien à quoi s'accrocher sur le téléphone, et
 * rien ne la retrouverait depuis un autre écran (`TODO.md`, la ligne de
 * l'accueil). Le dire vaut mieux qu'une promesse que la page fermée trahirait.
 */
export function phraseDeLaNoteGardee(p: {
  cause: CauseGardee;
  joignable: boolean | null;
  /** Le chantier n'existe pas encore : sa création a échoué avec l'envoi. */
  ficheNeuve: boolean;
  /** La raison du serveur, quand c'est lui qui a répondu mal. */
  raison?: string;
  /** Le téléphone a refusé de la ranger : elle ne vit que dans cette page. */
  stockageRefuse?: boolean;
}): string {
  if (p.cause === "hors-ligne") {
    if (p.joignable === true) return "Le réseau est revenu.";
    return p.ficheNeuve || p.stockageRefuse
      ? "Envoyez-la quand le réseau revient, sans quitter cette page."
      : "Envoyez-la quand le réseau revient.";
  }
  // **Rien ici ne dit de recharger quand la page est le seul endroit où vit la
  // note** : la phrase de la page vieillie y enverrait la note à la poubelle.
  if (p.ficheNeuve) return "La fiche n'a pas pu être créée. Envoyez la note de nouveau, sans quitter cette page.";
  if (p.stockageRefuse) return "Elle n'est pas partie. Envoyez-la de nouveau, sans quitter cette page.";
  return p.cause === "serveur" || p.cause === "session" ? (p.raison ?? phraseDeLiaison("serveur-en-peine")) : phraseDeLiaison(p.cause);
}

/**
 * L'identifiant d'un envoi, une fois pour toutes la note captée.
 *
 * **Pas `crypto.randomUUID`** : il n'existe que sur une page servie en https
 * ou en local, et le banc d'un artisan peut s'ouvrir autrement. Le tirage,
 * lui, existe partout ; la forme est celle d'un UUID v4, que le serveur lit.
 */
export function nouvelIdentifiantDEnvoi(
  tirer: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))
): string {
  const o = tirer(16);
  o[6] = (o[6] & 0x0f) | 0x40;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = Array.from(o, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
