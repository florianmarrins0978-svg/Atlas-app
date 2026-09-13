import Decimal from "decimal.js";

/**
 * LA MAIN D'ŒUVRE SUR LE DEVIS — la lecture B, sa réponse du 12 septembre 2026.
 *
 * *« Un bouton + Main d'œuvre, comme + Ajouter une TVA, sa ligne sous le total
 * HT »*, puis, devant les deux lectures de la planche
 * (`appli/devis-remise-main-d-oeuvre-conditions.html`) : **B — « dont main
 * d'œuvre HT »**. Elle est DÉJÀ dans les lignes ; le papier la nomme, et rien
 * ne bouge aux totaux. C'est ce qu'un client demande pour son crédit d'impôt.
 *
 * **Facultative, et le « − » la retire** — comme la remise. Aucune valeur
 * d'office : un montant de main d'œuvre n'a pas de valeur plausible, et un
 * chiffre inventé s'imprimerait chez un client (`docs/AGENT.md` §3). Le bouton
 * ouvre un champ vide, le doigt écrit.
 */
export const LIBELLE_MAIN_DOEUVRE = "dont main d’œuvre HT";

/**
 * Le montant tel qu'il a été tapé, ramené à une valeur sûre — ou `null`, qui
 * veut dire « pas de ligne ».
 *
 * **Borné au total HT des lignes** : « dont » ne peut pas dépasser le tout. Un
 * doigt qui tape 4 500 pour 450 se voit ramené au brut plutôt que refusé sans
 * un mot — le même choix que la remise (`pourcentValide`). Zéro ou négatif
 * vaut « aucune » : une ligne « dont main d'œuvre 0,00 € » n'apprend rien.
 */
export function montantMainDoeuvreValide(valeur: unknown, brutHt: string | number): string | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const brut = typeof valeur === "number" ? String(valeur) : String(valeur).replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(brut)) return null;
  const n = new Decimal(brut);
  if (n.lessThanOrEqualTo(0)) return null;
  const plafond = new Decimal(String(brutHt));
  if (plafond.lessThanOrEqualTo(0)) return null;
  return (n.greaterThan(plafond) ? plafond : n).toDecimalPlaces(2).toFixed(2);
}
