/**
 * LE DÉLAI DE RÉTRACTATION DU CLIENT ET LE DÉBUT DES TRAVAUX — ses choix du
 * 3 octobre 2026 (2A et 3A, `appli/documents-en-regle-a-choisir.html`).
 *
 * Un devis accepté par le lien qu'Atlas envoie, ou signé chez le client, est un
 * contrat à distance ou hors établissement. Pour un particulier, la loi impose
 * trois choses :
 *
 * | | |
 * |---|---|
 * | le début des travaux, date ou délai | Code de la consommation, L111-1 |
 * | le formulaire type de rétractation, joint au contrat | L221-5, L221-9, annexe de R221-1 |
 * | une demande EXPRESSE du client pour commencer dans ses 14 jours | L221-25 |
 *
 * La demande expresse existait déjà (la case `demarrageAnticipe`, page du
 * client), mais elle ne bloquait rien : un client pouvait accepter une date
 * dans ses 14 jours sans la cocher. Le début des travaux et le formulaire,
 * eux, n'existaient pas.
 *
 * Sans le formulaire, le délai de rétractation peut être prolongé de douze mois
 * (L221-20). Atlas ne distingue pas un particulier d'une entreprise : le
 * formulaire part sur tous les devis, une page de plus et aucun risque.
 */

/**
 * Le délai de début des travaux imprimé sur le devis — 2A : un délai plutôt
 * qu'une date, parce qu'il reste vrai quelle que soit la date que le client
 * retient. Trente jours est aussi le délai que la loi applique d'office quand
 * rien n'est dit (L216-1) : le devis n'engage donc pas l'artisan plus loin que
 * la loi. Le délai de 14 jours lui-même se compte dans `jour.ts`
 * (`dansDelaiRetractation`), et nulle part ailleurs.
 */
export const DEBUT_DES_TRAVAUX = "sous 30 jours après l'accord";

/** La phrase qui lui dit son droit, sur la page où il accepte. */
export const DROIT_DE_RETRACTATION =
  "Vous pouvez vous rétracter pendant 14 jours après votre accord. Le formulaire est à la fin de votre devis.";

export const TITRE_FORMULAIRE = "FORMULAIRE DE RÉTRACTATION";

/**
 * Le formulaire type, recopié de l'annexe de l'article R221-1 du Code de la
 * consommation, adresse de l'artisan remplie. Rien n'y est reformulé : c'est un
 * modèle réglementaire, et un mot changé en ferait un autre document.
 */
export function paragraphesFormulaire(emetteur: {
  nom: string;
  adresse?: string | null;
  email?: string | null;
  numeroDevis: string;
  dateDevis: string;
}): string[] {
  const coordonnees = [emetteur.nom, emetteur.adresse, emetteur.email]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(", ");
  return [
    "(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)",
    `À l'attention de ${coordonnees} :`,
    "Je/Nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la prestation de services ci-dessous :",
    `Devis n° ${emetteur.numeroDevis} du ${emetteur.dateDevis}.`,
    "Commandé le (*) / reçu le (*) : ............................................................",
    "Nom du (des) consommateur(s) : ............................................................",
    "Adresse du (des) consommateur(s) : ............................................................",
    "Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) : ............................................................",
    "Date : ............................................................",
    "(*) Rayez la mention inutile.",
    "Vous disposez de 14 jours à compter de votre accord pour vous rétracter, sans avoir à vous justifier. Si les travaux ont commencé à votre demande avant la fin de ce délai, le montant correspondant au service déjà fourni reste dû.",
  ];
}
