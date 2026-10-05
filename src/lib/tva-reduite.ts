/**
 * LA CERTIFICATION DU CLIENT POUR LA TVA RÉDUITE — sur le devis, dès qu'une
 * ligne est à 10 % ou à 5,5 %.
 *
 * Depuis la loi de finances 2025 (art. 41), l'attestation à part (Cerfa
 * 1300-SD, 1301-SD) n'existe plus : le client certifie sur le devis ou la
 * facture que les conditions du taux réduit sont remplies (CGI 279-0 bis,
 * 278-0 bis A). Sans cette certification, le taux réduit peut être remis en
 * cause, et la différence de TVA réclamée à l'artisan.
 *
 * **Les deux textes sont ceux du BOFiP, MOT POUR MOT** (BOI-LETTRE-000280,
 * §1 et §10), recopiés par le patron le 5 octobre 2026 depuis le site des
 * impôts, inaccessible depuis l'environnement de l'assistant. Rien ne s'y
 * reformule : un mot changé, et ce n'est plus le modèle de l'administration.
 * `scripts/test-documents-en-regle.ts` porte le §1 en entier.
 *
 * **Sur le devis, parce qu'il se signe** : la formule commence par « Je
 * soussigné(e) », et le devis porte déjà le cadre « Bon pour accord,
 * signature du client ».
 */

/** §1 : travaux de rénovation, taux de 10 % (CGI 279-0 bis). */
export const CERTIFICATION_TVA_10 =
  "Je soussigné(e)............................ (Nom, prénom) certifie, en qualité de preneur de la prestation, que les travaux réalisés concernent des locaux à usage d’habitation achevés depuis plus de deux ans et qu’ils n’ont pas eu pour effet, sur une période de deux ans au plus, de concourir à la production d’un immeuble neuf au sens du 2° du 2 du I de l’article 257 du CGI, ni d’entraîner une augmentation de la surface de plancher des locaux existants supérieure à 10 %.";

/** §10 : travaux de rénovation énergétique, taux de 5,5 % (CGI 278-0 bis A). */
export const CERTIFICATION_TVA_5_5 =
  "Je soussigné(e)............................ (Nom, prénom) certifie, en qualité de preneur de la prestation, que les travaux réalisés concernent des locaux à usage d’habitation achevés depuis plus de deux ans, qu’ils n’ont pas eu pour effet, sur une période de deux ans au plus, de concourir à la production d’un immeuble neuf au sens du 2° du 2 du I de l’article 257 du CGI, ni d’entraîner une augmentation de la surface de plancher des locaux existants supérieure à 10 % et qu’ils ont la nature de travaux de rénovation énergétique.";

/**
 * Les mentions qu'appellent les taux de la pièce, chacune une fois.
 *
 * **Elle s'imprime dès qu'une ligne est au taux réduit**, sans seuil de
 * montant : le BOFiP dispense certains petits travaux, mais ce seuil n'a pas
 * pu être relu ici, et une mention de trop ne coûte rien quand une mention
 * manquante coûte la différence de TVA.
 */
export function mentionsDeCertification(taux: readonly (string | null | undefined)[]): string[] {
  const lus = new Set(taux.map((t) => Number(t)));
  const m: string[] = [];
  if (lus.has(10)) m.push(CERTIFICATION_TVA_10);
  if (lus.has(5.5)) m.push(CERTIFICATION_TVA_5_5);
  return m;
}
