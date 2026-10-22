import { ECHEANCE_MAX_JOURS } from "./echeance-facture";

// LA FACTURE D'UN CLIENT PUBLIC — ses choix du 22 octobre 2026
// (`appli/facture-mairie-chorus.html`).
//
// Une mairie ne paie qu'une facture déposée sur Chorus Pro, et le dépôt se
// refuse sans le bon numéro d'engagement ou le bon code service. Le PDF
// d'Atlas se dépose tel quel sur chorus-pro.gouv.fr : aucune connexion à
// Chorus Pro n'est faite (lot à part, avec la facture électronique de 2027).
//
// **Ce qui vient de la loi**, lu sur Légifrance le 22 octobre 2026 (Code de la
// commande publique, art. D2192-2) : le numéro du bon de commande ou
// d'engagement, et le code du service qui paie. **Ce qui ne l'a pas été** : le
// texte même de l'article R2192-31 sur les intérêts de retard (BCE + 8 points,
// 40 €), tiré de sources qui concordent. À faire confirmer par son comptable.
//
// Ces règles sont pures : l'écran, le dépôt et le PDF les appellent, aucun ne
// les réécrit (`CLAUDE.md` §3).

/** Un acheteur public paie à 30 jours au plus. */
export const DELAI_MAX_PUBLIC_JOURS = 30;

/** Le délai de paiement de CETTE facture : le sien, plafonné pour un client public. */
export function delaiDePaiement(delaiJours: number, clientPublic: boolean): number {
  return clientPublic ? Math.min(delaiJours, DELAI_MAX_PUBLIC_JOURS) : delaiJours;
}

/** Jusqu'où l'échéance peut aller, au jour près, après la date de la facture. */
export function echeanceMaxJours(clientPublic: boolean): number {
  return clientPublic ? DELAI_MAX_PUBLIC_JOURS : ECHEANCE_MAX_JOURS;
}

/**
 * Les retards, pour un acheteur public. La phrase des entreprises (« trois fois
 * le taux d'intérêt légal ») ne vaut pas pour lui : la commande publique a son
 * propre taux, dû de plein droit.
 */
export const MENTION_RETARD_PUBLIC =
  "En cas de retard de paiement, intérêts moratoires au taux de la BCE majoré de 8 points, " +
  "et indemnité forfaitaire pour frais de recouvrement de 40 €. Pas d'escompte pour paiement anticipé.";

/**
 * Un numéro d'engagement ou un code service, tel qu'il se garde.
 *
 * **La casse ne se touche pas** : Chorus Pro compare le code service à la
 * lettre près, majuscules comprises. Seuls les espaces autour, et les espaces
 * doublés au milieu, s'en vont : ceux-là viennent du clavier, pas de la mairie.
 */
export function referenceChorusLue(saisie: string): string {
  return saisie.trim().replace(/\s+/g, " ");
}

/**
 * Ce qui s'imprime sous le nom du client, après son SIRET. Une ligne vide ne
 * s'imprime pas : certaines mairies ne donnent ni l'un ni l'autre.
 */
export function lignesChorus(f: { numeroEngagement: string | null; codeService: string | null }): string[] {
  const engagement = referenceChorusLue(f.numeroEngagement ?? "");
  const service = referenceChorusLue(f.codeService ?? "");
  return [
    ...(engagement ? [`N° d'engagement ${engagement}`] : []),
    ...(service ? [`Code service ${service}`] : []),
  ];
}
