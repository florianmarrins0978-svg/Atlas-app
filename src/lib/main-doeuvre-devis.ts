import Decimal from "decimal.js";

/**
 * LA MAIN D'ŒUVRE SUR LE DEVIS — la A, sa réponse du 13 octobre 2026.
 *
 * *« Dire main d'œuvre 500 € et que ça s'additionne comme une tâche normale,
 * pour les lignes TVA à 10 et TVA à 20. »* Planche
 * `appli/devis-main-d-oeuvre-par-tva.html`. La main d'œuvre est une LIGNE du
 * devis, posée par « + Main d'œuvre » dans sa catégorie de TVA : elle compte au
 * sous-total, à la TVA de son taux et au TTC, comme toute ligne.
 *
 * **« dont main d'œuvre HT », sous le total, n'est plus tapé : il se CALCULE**
 * (`mainDoeuvreDesLignes`), la somme de ces lignes. C'est ce qu'un client
 * demande pour son crédit d'impôt. La lecture B du 12 septembre (un montant
 * tapé à part, déjà compris dans les lignes) reste sur la FACTURE, dont la page
 * « Remplir la facture » le saisit encore (`montantMainDoeuvreValide`).
 */
export const LIBELLE_MAIN_DOEUVRE = "dont main d’œuvre HT";

/**
 * Le libellé d'une ligne de main d'œuvre à sa naissance. Il le change au doigt
 * (« Main d'œuvre plantation ») : c'est le drapeau de la ligne qui la
 * reconnaît, jamais ce texte.
 */
export const LIBELLE_LIGNE_MAIN_DOEUVRE = "Main d’œuvre";

/**
 * « dont main d'œuvre HT » : la somme des lignes de main d'œuvre, ou `null`
 * quand il n'y en a pas (ou qu'elles ne valent rien encore). Une ligne
 * « dont main d'œuvre 0,00 € » n'apprendrait rien au client.
 *
 * **La même fonction sert à l'écran et au dépôt** (`CLAUDE.md` §3) : l'écran
 * l'appelle sur les lignes qu'il affiche, le dépôt sur celles qu'il fige.
 */
export function mainDoeuvreDesLignes(
  lignes: readonly { mainDoeuvre?: boolean | null; montant: string | number }[]
): string | null {
  const somme = lignes
    .filter((l) => l.mainDoeuvre === true)
    .reduce((s, l) => s.plus(new Decimal(String(l.montant || "0"))), new Decimal(0));
  return somme.greaterThan(0) ? somme.toDecimalPlaces(2).toFixed(2) : null;
}

/**
 * Le montant tel qu'il a été tapé, ramené à une valeur sûre — ou `null`, qui
 * veut dire « pas de ligne ».
 *
 * **Borné au total HT des lignes** : « dont » ne peut pas dépasser le tout. Un
 * doigt qui tape 4 500 pour 450 se voit ramené au brut plutôt que refusé sans
 * un mot — le même choix que la remise (`pourcentValide`). Zéro ou négatif
 * vaut « aucune » : une ligne « dont main d'œuvre 0,00 € » n'apprend rien.
 *
 * **SANS LIGNE CHIFFRÉE, LE MONTANT SE GARDE TEL QUEL — 14 septembre 2026.**
 * La première version rendait `null` dès que le brut était nul : *« je mets le
 * prix, elle s'efface toute seule »* — il avait ouvert la ligne sur un devis
 * encore vide, et son chiffre partait sans un mot. Un total de zéro n'est pas
 * un plafond, c'est l'absence de plafond : rien à borner encore. La borne se
 * pose dès que des lignes existent, ici comme à la régénération du brouillon.
 */
export function montantMainDoeuvreValide(valeur: unknown, brutHt: string | number): string | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const brut = typeof valeur === "number" ? String(valeur) : String(valeur).replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(brut)) return null;
  const n = new Decimal(brut);
  if (n.lessThanOrEqualTo(0)) return null;
  const plafond = new Decimal(String(brutHt));
  if (plafond.lessThanOrEqualTo(0)) return n.toDecimalPlaces(2).toFixed(2);
  return (n.greaterThan(plafond) ? plafond : n).toDecimalPlaces(2).toFixed(2);
}
