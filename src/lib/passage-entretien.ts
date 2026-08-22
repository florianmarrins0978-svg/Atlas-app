// Le passage d'entretien : ce qui a été coché, un jour, chez quelqu'un.
//
// **Où il vit — sa décision du 17 août 2026** : dans l'onglet « Paysage », à
// côté de l'arrosage. Donc la fiche s'ouvre SANS client, parce qu'un outil qui
// exige un client ne sert pas en visite. Le client est nommé quand il veut —
// **arrangement C** de `docs/maquettes/77-la-fiche-dans-paysage.html`.
//
// ─── LE CŒUR DE L'ARRANGEMENT C ──────────────────────────────────────────────
// Deux de ses décisions se rencontraient sur un même point, et paraissaient se
// contredire :
//
//   · 16 août — « chaque client aura sa fiche » : le passage suivant chez le
//     même client doit RETROUVER son ajustement, sinon il retrie vingt lignes
//     douze fois par an ;
//   · 17 août — l'outil s'ouvre SANS client.
//
// Elles ne se contredisent pas : elles se rencontrent sur le MOMENT où le
// client est nommé. D'où `recomposerPourClient` : la fiche part du modèle
// complet, et se replie sur les prestations du client dès qu'on le connaît —
// **sans perdre ce qui vient d'être coché**. C'est cette dernière clause qui
// fait tout le travail, et c'est elle qu'un contrôle doit tenir : perdre trois
// coches parce qu'on a nommé le client au milieu serait pire que ne rien
// pré-remplir du tout.
// ─────────────────────────────────────────────────────────────────────────────

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
 * Recompose la fiche quand le client est enfin nommé — **sans rien perdre**.
 *
 * @param actuelles ce qui est à l'écran, coches comprises
 * @param dejaPris ce que ce client a **déjà pris** : les prestations cochées
 *   sur ses rapports envoyés, tous passages confondus. Vide au premier passage.
 *
 * **Trois règles, et chacune répare un défaut prévisible :**
 *
 * 1. **Ce qui est coché reste, quoi qu'il arrive.** Même si ce client n'a
 *    jamais pris cette prestation : il vient de la faire, et une fiche qui
 *    efface un geste déjà fait est pire qu'une fiche qui en montre trop.
 * 2. **Ce que ce client prend revient**, décoché : c'est ce qui lui évite de
 *    retrier vingt lignes douze fois par an.
 * 3. **Le reste tombe.** Les lignes que ce client ne paie pas n'ont rien à
 *    faire sous son pouce — c'est tout l'intérêt de nommer le client.
 *
 * ─── POURQUOI « TOUT SON HISTORIQUE » ET NON « SON DERNIER PASSAGE » ─────────
 * La première version regardait le seul passage précédent, et elle a été
 * refusée par son propre contrôle avant d'atteindre le patron. Deux défauts,
 * dans les deux sens :
 *
 *   · **les lignes PRÉSENTES du dernier passage** ne convergent jamais : au
 *     premier passage la fiche porte le modèle entier, donc le second le
 *     reprend entier, et ainsi de suite. Le repli ne replie rien ;
 *   · **les lignes COCHÉES du seul dernier passage** replient trop fort : une
 *     taille de haie d'automne se fait une fois l'an. Au passage de mars elle
 *     n'aurait pas été cochée en février, donc elle disparaîtrait — et il ne
 *     pourrait plus la cocher en octobre, faute de ligne.
 *
 * D'où l'historique complet : **ce que ce client a déjà pris au moins une
 * fois**. Il se construit tout seul, garde les gestes saisonniers, et ne rend
 * jamais une fiche plus longue que le modèle du jour.
 *
 * **Ce que cela coûte, et c'est assumé** : une prestation cochée par erreur
 * chez un client y reste proposée. Une ligne de trop se saute des yeux ; une
 * ligne manquante bloque le geste sur un chantier.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **L'ordre vient de ce qui est à l'écran**, jamais de l'historique : la fiche
 * ne doit pas se réorganiser sous ses doigts pendant qu'il coche.
 */
export function recomposerPourClient(
  actuelles: readonly LignePassage[],
  dejaPris: readonly { libelle: string }[]
): LignePassage[] {
  // Client neuf — ou client dont aucun rapport n'a encore rien porté : il n'y a
  // rien à replier, et deviner à sa place serait pire que de tout montrer.
  if (dejaPris.length === 0) return [...actuelles];

  const sien = new Set(dejaPris.map((l) => plie(l.libelle)));

  // Une prestation que ce client prend et que le modèle ne porte plus — retirée
  // des Réglages depuis — n'est pas dans `actuelles`, et on ne la ramène PAS :
  // le modèle est ce qu'il propose aujourd'hui, et ressusciter une ligne qu'il
  // a retirée irait contre son geste. Le rapport du passé, lui, garde la
  // sienne : il porte sa propre copie (migration 0055).
  return actuelles.filter((l) => l.faite || sien.has(plie(l.libelle)));
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
  | "client_inconnu";

export const PHRASE_REFUS_PASSAGE: Record<RefusPassage, string> = {
  introuvable: "Cette fiche n'existe plus. Revenez à la liste.",
  modele_vide:
    "Votre fiche n'a aucune prestation. Composez-la d'abord dans les réglages.",
  deja_envoye: "Ce rapport est déjà parti chez votre client. Il ne se modifie plus.",
  duree_invalide: "Ce temps ne tient pas dans une journée. Reprenez la molette.",
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
