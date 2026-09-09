import { FUSEAU_DU_PATRON, jourEtMois, jourIso } from "./jour";

/**
 * CE QUE LE CLIENT A FAIT DE SA FACTURE, mis en mots.
 *
 * Sa question du 9 septembre 2026 : *« Atlas note l'ouverture seul, mais en cas
 * de litige, où est-ce que l'utilisateur va rechercher cette info ? »* — nulle
 * part, jusqu'ici. La réponse tient dans deux dates posées sous la ligne de la
 * facture, sur « En attente de paiement », à la place exacte qu'occupe déjà la
 * marque de l'ancien IBAN.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI C'EST UNE FONCTION PURE, ET NON DU TEXTE DANS L'ÉCRAN.**
 *
 * Cette phrase-là se relira le jour d'un litige. Elle doit dire exactement la
 * même chose partout où elle apparaît — l'écran des impayés aujourd'hui, la
 * fiche de la facture demain —, et elle doit s'éprouver sans monter un
 * navigateur (`CLAUDE.md` §3, et §4 sexies : les règles vivent dans `lib/`).
 *
 * **ET L'HEURE SE CALCULE SUR LE SERVEUR, dans le fuseau de l'atelier.** Mise
 * en mots par le téléphone, elle changerait selon l'appareil qui la lit : la
 * même ouverture s'afficherait à 14 h 12 chez lui et à 12 h 12 ailleurs. Une
 * preuve qui change d'heure selon qui la regarde ne prouve rien.
 */
export type ReceptionLisible = {
  /** « le 9 septembre à 14 h 12 », ou `null` si le lien n'a jamais été ouvert. */
  ouverte: string | null;
  /** « le 9 septembre », ou `null` si le client n'a pas coché. */
  confirmee: string | null;
};

export function receptionEnMots(reception: {
  ouverteLe: Date | null;
  accuseLe: Date | null;
}): ReceptionLisible {
  return {
    ouverte: reception.ouverteLe ? jourEtHeure(reception.ouverteLe) : null,
    // **Le jour seul pour la confirmation, et l'heure pour l'ouverture.**
    // L'heure d'ouverture est ce qu'on oppose à « je ne l'ai jamais reçue » :
    // elle situe le geste dans la journée. La confirmation, elle, est déjà un
    // aveu — la minute n'y ajoute rien, et deux heures côte à côte sur la même
    // ligne se lisent comme deux événements distincts.
    confirmee: reception.accuseLe ? `le ${jourEtMois(jourIso(reception.accuseLe))}` : null,
  };
}

/**
 * « le 9 septembre à 14 h 12 ».
 *
 * **L’heure est RECOMPOSÉE à partir des parties, jamais prise telle quelle.**
 * `format()` en `fr-FR` rend « 14:12 » sur certains moteurs et « 14 h 12 » sur
 * d’autres, avec des espaces fines insécables invisibles à la lecture d’un diff.
 * La même trace se serait donc écrite de deux façons selon la machine qui sert
 * la page — sur une preuve, c’est exactement ce qu’il ne faut pas.
 */
function jourEtHeure(instant: Date): string {
  const parties = new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU_DU_PATRON,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const heure = parties.find((p) => p.type === "hour")?.value ?? "";
  const minute = parties.find((p) => p.type === "minute")?.value ?? "";
  // `Number` retire le zéro de tête : on écrit « 1 h 30 », pas « 01 h 30 ». Les
  // minutes, elles, le gardent — « 14 h 5 » ne se lit pas.
  return `le ${jourEtMois(jourIso(instant))} à ${Number(heure)} h ${minute}`;
}
