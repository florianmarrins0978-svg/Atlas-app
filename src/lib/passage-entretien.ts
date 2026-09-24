// Le passage d'entretien : ce qui a été coché, un jour, chez quelqu'un.
//
// **Où il vit — sa décision du 17 août 2026** : dans l'onglet « Paysage », à
// côté de l'arrosage. Donc la fiche s'ouvre SANS client, parce qu'un outil qui
// exige un client ne sert pas en visite. Le client est nommé quand il veut —
// **arrangement C** de `docs/maquettes/77-la-fiche-dans-paysage.html`.
//
// ─── QUAND LE CLIENT EST NOMMÉ ───────────────────────────────────────────────
// **Sa règle du 22 septembre 2026, qui remplace le repli du 17 août :**
// *« ce qui a déjà été coché par le passé se recoche automatiquement, mais les
// 20 points qui composent ma fiche doivent être présents ! Car si j'ai fait
// quelque chose en plus ce jour, je le coche, or là je ne peux pas, les cases
// ne sont pas visibles »*.
//
// Le repli retirait les lignes que ce client ne prenait pas d'habitude : il
// voulait lui épargner de retrier vingt lignes, et il l'empêchait de cocher le
// travail en plus. Désormais la fiche garde TOUT le modèle, et c'est la coche
// qui porte l'habitude (`cocherCommeLaDerniereFois`).
// ─────────────────────────────────────────────────────────────────────────────

import { filtrerClientsParNom, normaliserPourRecherche } from "./recherche-client";

/** Une ligne de la fiche en cours — copiée du modèle, jamais lue dedans. */
export type LignePassage = {
  famille: string;
  libelle: string;
  ordre: number;
  faite: boolean;
};

/**
 * Combien de minutes tient une fiche, au plus.
 *
 * Vingt-quatre heures : au-delà c'est une faute de frappe, pas une journée de
 * travail. Le refus vaut mieux qu'un rapport annonçant « 380 h » au client.
 */
export const MINUTES_MAX = 24 * 60;

/**
 * Le pas de la molette, en minutes — sa décision du 16 août.
 *
 * Cinq minutes : à la minute près, la molette ferait deux cent quarante crans
 * pour quatre heures, et personne ne facture un entretien à la minute.
 */
export const PAS_MINUTES = 5;

/** « 1 h 40 », « 45 min », « — ». Ce que l'écran et le rapport écrivent. */
export function libelleMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  const n = Math.max(0, Math.trunc(minutes));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Arrondit au cran de la molette, et refuse ce qui n'a pas de sens.
 *
 * Rend `null` plutôt que de corriger en silence : une durée aberrante vient
 * d'une saisie, et l'appelant doit pouvoir le DIRE au lieu d'enregistrer un
 * chiffre que personne n'a voulu.
 */
export function minutesValides(brut: number | null | undefined): number | null {
  if (brut === null || brut === undefined || !Number.isFinite(brut)) return null;
  const n = Math.trunc(brut);
  if (n < 0 || n > MINUTES_MAX) return null;
  return Math.round(n / PAS_MINUTES) * PAS_MINUTES;
}

/**
 * Recoche ce que ce client a eu à son DERNIER passage envoyé — **sans retirer
 * une ligne ni décocher ce qui est déjà coché**.
 *
 * @param actuelles ce qui est à l'écran, coches comprises
 * @param derniere les prestations cochées sur son dernier rapport envoyé. Vide
 *   au premier passage : rien ne se coche tout seul.
 *
 * **Le dernier passage, et non tout son historique** : une taille de haie
 * d'automne cochée une fois en octobre se recocherait sinon à chaque passage
 * de l'année, et partirait sur des rapports où elle n'a pas été faite. Le
 * dernier passage est ce qui ressemble le plus à celui du jour ; ce qui change
 * se décoche ou se coche d'un geste, puisque toutes les lignes sont là.
 *
 * **L'ordre et les lignes viennent de l'écran** : rien ne bouge sous ses doigts.
 */
export function cocherCommeLaDerniereFois<L extends LignePassage>(
  actuelles: readonly L[],
  derniere: readonly { libelle: string }[]
): L[] {
  const cochees = new Set(derniere.map((l) => plie(l.libelle)));
  return actuelles.map((l) => (l.faite || !cochees.has(plie(l.libelle)) ? l : { ...l, faite: true }));
}

/**
 * La phrase sous le nom du client : combien de cases sont cochées, et si ce
 * sont celles du dernier chantier.
 *
 * **Calculée sur les cases, à chaque coche — 24 septembre 2026.** Sa capture :
 * *« y'a marqué 5 prestations cochées, celles du dernier chantier, alors qu'il
 * y en a 8 de cochées »*. Le chiffre était compté une fois par le serveur, au
 * moment de nommer le client, puis gardé tel quel : il ignorait ce qui était
 * coché avant, et tout ce qu'il cochait après.
 *
 * « Celles du dernier chantier » ne se dit que tant que c'est vrai : les cases
 * cochées sont exactement celles reprises. `reprises` vaut `null` tant
 * qu'aucun client n'a été nommé sur cet écran ; vide, rien n'a été repris
 * (premier passage chez lui) et la phrase ne se pose pas, comme avant.
 */
export function constatDesCoches(
  lignes: readonly { id: string; faite: boolean }[],
  reprises: ReadonlySet<string> | null
): string | null {
  if (!reprises || reprises.size === 0) return null;
  const faites = lignes.filter((l) => l.faite);
  if (faites.length === 0) return null;
  const nombre = faites.length > 1 ? `${faites.length} prestations cochées` : "1 prestation cochée";
  const cesont = faites.length === reprises.size && faites.every((l) => reprises.has(l.id));
  if (!cesont) return `${nombre}.`;
  return `${nombre}, ${faites.length > 1 ? "celles" : "celle"} du dernier chantier.`;
}

/**
 * Ce qui empêche d'envoyer, dit en toutes lettres — ou `null` si tout va bien.
 *
 * **Rendu plutôt que levé** : une exception d'action serveur n'arrive jamais
 * jusqu'au patron (`HANDOVER.md`, piège 0 ter). Et le bouton éteint doit DIRE
 * pourquoi, sinon il passe pour cassé.
 */
export function empechementEnvoi(passage: {
  clientId: string | null;
  lignes: readonly LignePassage[];
  envoyeLe: Date | null;
  /** Par quoi il compte l'envoyer, et ce que la fiche du client porte. */
  canal?: "sms" | "email";
  telephone?: string | null;
  email?: string | null;
}): string | null {
  if (passage.envoyeLe !== null) {
    return "Ce rapport est déjà parti chez votre client. Il ne se renvoie pas.";
  }
  if (passage.clientId === null) {
    return "Nommez d'abord le client : c'est lui qui recevra le rapport.";
  }
  if (!passage.lignes.some((l) => l.faite)) {
    return "Cochez au moins une prestation avant d'envoyer.";
  }
  // **Le canal choisi doit avoir une coordonnée, sinon l'appui ouvre un message
  // SANS destinataire** — et il ne le découvre que dans Messages, c'est-à-dire
  // trop tard. Le dire ici plutôt que de laisser partir un envoi borgne.
  if (passage.canal === "sms" && !passage.telephone?.trim()) {
    return "Ce client n'a pas de téléphone dans sa fiche. Choisissez l'e-mail, ou ajoutez-le.";
  }
  if (passage.canal === "email" && !passage.email?.trim()) {
    return "Ce client n'a pas d'e-mail dans sa fiche. Choisissez le SMS, ou ajoutez-le.";
  }
  return null;
}

/**
 * Ce qu'un geste peut se voir refuser — et la phrase qui le dit.
 *
 * **Les deux vivent ICI, ensemble, et pas dans l'action serveur.** D'abord
 * parce qu'un fichier « use server » ne peut exporter que des fonctions —
 * l'écran des réglages l'a appris en devenant blanc. Ensuite parce qu'un code
 * de refus sans sa phrase finit par en recevoir deux, écrites à deux endroits,
 * qui divergent.
 *
 * **Une phrase, jamais un code.** Le patron ne doit jamais lire « deja_envoye »
 * sur un chantier.
 */
export type RefusPassage =
  | "introuvable"
  | "modele_vide"
  | "deja_envoye"
  | "duree_invalide"
  | "jour_invalide"
  | "client_inconnu";

export const PHRASE_REFUS_PASSAGE: Record<RefusPassage, string> = {
  introuvable: "Cette fiche n'existe plus. Revenez à la liste.",
  modele_vide:
    "Votre fiche n'a aucune prestation. Composez-la d'abord dans les réglages.",
  deja_envoye: "Ce rapport est déjà parti chez votre client. Il ne se modifie plus.",
  duree_invalide: "Ce temps ne tient pas dans une journée. Reprenez la molette.",
  jour_invalide: "Ce jour n'existe pas. Reprenez la roue.",
  client_inconnu: "Ce client n'existe plus. Choisissez-en un autre.",
};

/** Comparaison indulgente : deux textes saisis à deux moments différents. */
function plie(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * LES RAPPORTS ENVOYÉS QUE LA LISTE MONTRE — le mois ou le jour choisi, ou le
 * nom tapé.
 *
 * **Sa demande du 22 septembre 2026 :** *« faut pouvoir filtrer par nom de
 * client et que ça nous sorte toutes les fiches liées au client, et un filtre
 * par jour mois année »*. Le contrat des fiches de sécurité (`fichesAMontrer`) :
 * la période est `2026-09` ou `2026-09-22`, et un nom tapé passe PAR-DESSUS —
 * il sort tous les rapports du client, sans tourner la roue mois par mois.
 *
 * Le jour est celui du passage, déjà une date de calendrier : il se compare tel
 * quel, sans fuseau. Et le nom se cherche comme celui des clients
 * (`filtrerClientsParNom`) : une seule façon de chercher un nom (`CLAUDE.md` §3).
 */
export function rapportsAMontrer<T extends { clientNom: string | null; jour: string }>(
  rapports: readonly T[],
  choix: { periode: string; saisie: string }
): T[] {
  if (normaliserPourRecherche(choix.saisie)) {
    return filtrerClientsParNom(
      rapports.flatMap((r) => (r.clientNom ? [{ nom: r.clientNom, rapport: r }] : [])),
      choix.saisie
    ).map((x) => x.rapport);
  }
  return rapports.filter((r) => r.jour.startsWith(choix.periode));
}
