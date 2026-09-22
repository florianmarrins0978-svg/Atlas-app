// L'ÉCHÉANCE D'UNE FACTURE — proposée par défaut, modifiable, jamais un vide.
//
// **Sa demande du 25 août 2026 :** *« il faut qu'il propose une date par défaut
// et ensuite si l'utilisateur veut la modifier qu'il puisse. Parce que si
// l'utilisateur envoie la facture avant de modifier, faut qu'elle parte avec une
// date et pas avec [échéance]. »*
//
// La facture porte DÉJÀ une échéance dès sa création — la date d'émission plus
// son délai de paiement (`echeanceFacture`, `src/lib/rappels.ts`). Ce qui
// manquait, c'est de pouvoir la CORRIGER avant l'envoi. Cette fonction est le
// garde-fou de cette correction : elle vit hors de la base pour être éprouvée
// sans elle, là où sont les pièges — une date écrite à l'envers, un an de
// travers, une échéance qui précède la facture.

/** Au-delà d'un an, c'est une faute de frappe (2027 tapé 2072), pas une échéance. */
export const ECHEANCE_MAX_JOURS = 365;

export type ResultatEcheance =
  | { ok: true; iso: string }
  | { ok: false; raison: string };

/**
 * La date saisie est-elle une échéance recevable pour CETTE facture ?
 *
 * **Deux bornes, et chacune évite un dégât réel :**
 *   · l'échéance ne PRÉCÈDE jamais l'émission — une facture due avant d'exister
 *     n'a pas de sens, et le rappel d'impayé partirait aussitôt ;
 *   · elle ne dépasse pas un an — au-delà, c'est l'année mal tapée, et le client
 *     croirait avoir douze mois pour payer.
 *
 * Le « comptant » (échéance = émission) est permis : c'est le délai zéro.
 */
export function validerEcheance(dateEmissionIso: string, saisieIso: string): ResultatEcheance {
  // Le format vient d'un `<input type="date">` (AAAA-MM-JJ). On ne fait pas
  // confiance au navigateur : la saisie repasse ici, côté serveur.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saisieIso)) {
    return { ok: false, raison: "Choisissez une date d'échéance valide." };
  }
  const saisie = Date.parse(`${saisieIso}T00:00:00Z`);
  const emission = Date.parse(`${dateEmissionIso}T00:00:00Z`);
  if (Number.isNaN(saisie) || Number.isNaN(emission)) {
    return { ok: false, raison: "Choisissez une date d'échéance valide." };
  }
  if (saisie < emission) {
    return { ok: false, raison: "L'échéance ne peut pas précéder la date de la facture." };
  }
  if (saisie > emission + ECHEANCE_MAX_JOURS * 86_400_000) {
    return { ok: false, raison: "L'échéance ne peut pas dépasser un an après la facture." };
  }
  return { ok: true, iso: saisieIso };
}

/**
 * LES DEUX DATES D'UNE FACTURE QUI PART — la sienne, et celle du règlement.
 *
 * **Son constat du 22 septembre 2026 :** *« pourquoi il me met facturé le
 * 21 septembre, on est le 22 ? Et je viens de l'envoyer ! »*
 *
 * `date_emission` était posée à la CRÉATION du brouillon — à la fin du
 * chantier, ou à l'ouverture de la facture depuis la fiche du client. Un
 * brouillon préparé le lundi et envoyé le jeudi partait donc daté du lundi :
 * sur l'écran Terminés, sur le papier que le client reçoit, et dans le relevé
 * de TVA, où un brouillon du 31 mars envoyé le 1er avril aurait porté sa TVA
 * sur le trimestre précédent. Une pièce comptable porte le jour où elle part.
 *
 * **L'ÉCHÉANCE SE DÉCALE, elle ne se recalcule pas.** La refaire depuis le
 * délai réglé effacerait celle qu'il a pu choisir à la main avant l'envoi
 * (`majEcheanceFacture`) ; la laisser où elle est contredirait la mention
 * imprimée juste à côté — « Paiement à 30 jours à compter de la facture »
 * (`conditions-documents.ts`) —, qui n'en compterait plus que vingt-neuf. Le
 * décalage tient les deux : ce qu'il accorde au client est un DÉLAI, et il
 * reste entier quel que soit le jour de l'envoi.
 *
 * Une date illisible ne s'invente pas : elle est rendue telle quelle plutôt que
 * de poser une échéance calculée sur un `NaN` (`docs/AGENT.md` §3).
 */
export function datesDeLaFactureQuiPart(
  jourDeLEnvoi: string,
  avant: { dateEmission: string; dateEcheance: string | null }
): { dateEmission: string; dateEcheance: string | null } {
  const brouillon = Date.parse(`${avant.dateEmission}T00:00:00Z`);
  const envoi = Date.parse(`${jourDeLEnvoi}T00:00:00Z`);
  if (Number.isNaN(brouillon) || Number.isNaN(envoi)) return { ...avant };
  if (avant.dateEcheance === null) return { dateEmission: jourDeLEnvoi, dateEcheance: null };
  const echeance = Date.parse(`${avant.dateEcheance}T00:00:00Z`);
  if (Number.isNaN(echeance)) {
    return { dateEmission: jourDeLEnvoi, dateEcheance: avant.dateEcheance };
  }
  return {
    dateEmission: jourDeLEnvoi,
    dateEcheance: new Date(echeance + (envoi - brouillon)).toISOString().slice(0, 10),
  };
}
