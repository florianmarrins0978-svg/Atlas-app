import { jourCourt, jourIso } from "./jour";

/**
 * CE QUE LE CLIENT A FAIT DE SA FACTURE, mis en mots.
 *
 * Sa question du 9 septembre 2026 : *« Atlas note l'ouverture seul, mais en cas
 * de litige, où est-ce que l'utilisateur va rechercher cette info ? »* — nulle
 * part, jusqu'ici. La réponse tient dans une ligne posée sous la facture, sur
 * « En attente de paiement » et dans le dossier du client.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **UNE SEULE DATE, ET PAS D'HEURE — sa demande du 11 septembre 2026 :** *« les
 * phrases sont trop longues… l'heure tu supprimes… et s'il coche la case,
 * marque seulement réception confirmée le 11/09, pas besoin d'avoir les deux
 * infos »*.
 *
 * Les deux dates s'écrivaient côte à côte — « Ouverte le 11 septembre à 17 h 57
 * · réception confirmée le 11 septembre » —, et la seconde rend la première
 * inutile : un client qui coche a forcément ouvert. La ligne disait donc deux
 * fois la même chose sur deux lignes de téléphone.
 *
 * **Ce que la minute prouvait en plus, elle ne le prouve qu'à nous.** Le
 * dépôt la gardait comme preuve contre « je n'ai jamais reçu cette facture » ;
 * elle reste écrite en base (`envois_factures.ouverte_at`), et c'est là qu'on
 * ira la chercher le jour d'un litige. À l'écran, c'est le JOUR qu'il regarde.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI LA PHRASE ENTIÈRE VIT ICI, ET NON DANS LES ÉCRANS.**
 *
 * Deux écrans la montrent — les impayés et le dossier du client. Le choix
 * « confirmée plutôt qu'ouverte » y était écrit deux fois : deux règles pour
 * une seule question, et c'est exactement ce que `CLAUDE.md` §3 refuse. Elle se
 * décide donc une fois, et s'éprouve sans monter un navigateur (§4 sexies : les
 * règles vivent dans `lib/`).
 */
export type ReceptionLisible = {
  /**
   * Ce qui précède la date — « Ouverte », « Réception confirmée le », ou la
   * phrase entière quand il n'y a pas de date.
   *
   * L'espace de fin est voulu : il sépare le mot du gras qui suit, et le
   * mettre dans les écrans le ferait écrire deux fois.
   */
  avant: string;
  /** Le jour, en gras à l'écran — « 11/09 » —, ou `null` si rien n'a été ouvert. */
  date: string | null;
};

export function receptionEnMots(
  reception: { ouverteLe: Date | null; accuseLe: Date | null },
  /** Le jour de l'atelier, pour décider si l'année doit s'écrire. */
  aujourdHui: string = jourIso(new Date())
): ReceptionLisible {
  // **La confirmation efface l'ouverture, elle ne s'y ajoute plus.** Cocher la
  // case suppose d'avoir ouvert : dire les deux, c'est dire deux fois.
  if (reception.accuseLe) {
    return { avant: "Réception confirmée le ", date: jourCourt(jourIso(reception.accuseLe), aujourdHui) };
  }
  if (reception.ouverteLe) {
    return { avant: "Ouverte ", date: jourCourt(jourIso(reception.ouverteLe), aujourdHui) };
  }
  // **« Pas encore ouverte » S'ÉCRIT.** Ne rien afficher ferait lire l'absence
  // de trace comme une absence de fonctionnalité — et c'est justement ce qu'il
  // vient vérifier quand un client prétend n'avoir rien reçu.
  return { avant: "Pas encore ouverte.", date: null };
}
