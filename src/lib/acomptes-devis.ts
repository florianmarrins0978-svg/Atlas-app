import Decimal from "decimal.js";
import { enEuros } from "./euros";
import { tauxLisible } from "./reduction-devis";

/**
 * ─── LES ACOMPTES D'UN DEVIS — sa demande du 12 septembre 2026 ─────────────
 *
 * *« Rajouter la possibilité de rajouter un acompte automatisé sur le devis,
 * un peu comme on fait pour rajouter une TVA. »* Puis, planche
 * `appli/l-acompte-sur-le-devis.html` essayée, la B choisie et quatre
 * précisions de sa main dans la soirée :
 *
 *   · *« il doit être marqué d'office »* — le taux des Réglages est déjà sur la
 *     ligne des totaux de chaque nouveau devis ;
 *   · *« si on clique sur le moins il disparaît mais reste visible dans les
 *     notes et conditions quoi qu'il arrive »* ;
 *   · *« sur les gros devis, un deuxième acompte à mi-parcours »* — et *« le
 *     3ᵉ n'est pas en fin de chantier, c'est le solde »* ;
 *   · *« oui je veux des taux cumulés ; d'office 50 % pour le 2ᵉ et 75 pour
 *     le 3ᵉ »*.
 *
 * ─── CUMULÉS, ET C'EST TOUT LE CALCUL ────────────────────────────────────────
 *
 * « 50 % » à mi-parcours ne veut pas dire « la moitié ce jour-là » : cela veut
 * dire qu'À CE MOMENT-LÀ, la moitié du devis est réglée. Ce qui tombe ce
 * jour-là est la différence avec l'acompte d'avant. Sur 2 844 € TTC, 30 → 50
 * → 75 font 853,20 €, puis 568,80 €, puis 711,00 € — et il reste 711,00 €.
 *
 * Son premier essai (30, 50, 75 lus comme des parts) rendait un reste à régler
 * de −1 564,20 € sur un devis qui partait chez un client. D'où la borne : un
 * taux cumulé ne descend JAMAIS sous celui d'avant, ni au-dessus de 100, et
 * le reste n'est jamais négatif.
 *
 * ─── UNE SEULE RÈGLE, TROIS LECTEURS ─────────────────────────────────────────
 *
 * L'écran du devis, le dépôt qui revalide ce que l'écran renvoie, et le PDF que
 * le client garde lisent tous ce fichier. Recalculer sur le papier aurait fait
 * une seconde implémentation, donc un jour deux résultats (`CLAUDE.md` §3).
 */

/** Ce que porte un acompte en base : son rang, et son taux CUMULÉ. */
export type AcompteDevis = { rang: number; tauxCumule: string };

/**
 * Le moment de chaque acompte, dans l'ordre où ils tombent.
 *
 * **La fin du chantier n'y est pas, et c'est sa correction :** *« le 3ᵉ acompte
 * n'est pas en fin de chantier, c'est le solde »*. Ce qui reste après le
 * dernier acompte est le reste à régler, jamais un acompte de plus.
 */
export const MOMENTS_ACOMPTE = ["à la signature", "à mi-parcours", "à l'avancement"] as const;

/** Au plus autant d'acomptes qu'il y a de moments : on n'invente pas de mot. */
export const ACOMPTES_MAX = MOMENTS_ACOMPTE.length;

/**
 * Ses valeurs d'office, cumulées. Le premier vient des Réglages (`null` ici) ;
 * *« d'office 50 % pour le 2ᵉ et 75 pour le 3ᵉ »*.
 */
export const TAUX_CUMULES_D_OFFICE: readonly (string | null)[] = [null, "50", "75"];

export function momentAcompte(rang: number): string {
  return MOMENTS_ACOMPTE[Math.min(Math.max(rang, 1), ACOMPTES_MAX) - 1];
}

/**
 * Un taux tel qu'il est tapé : nombre entre 0 et 100, deux décimales — la
 * colonne est `numeric(5,2)`. `null` : ce n'est pas un taux.
 */
export function tauxCumuleValide(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const brut = typeof valeur === "number" ? String(valeur) : String(valeur).replace(",", ".").trim();
  if (!/^\d+(\.\d+)?$/.test(brut)) return null;
  const n = new Decimal(brut);
  if (n.greaterThan(100)) return "100";
  return n.toDecimalPlaces(2).toString();
}

/**
 * Les taux cumulés BORNÉS, dans l'ordre des rangs : chacun au moins celui
 * d'avant, au plus 100. C'est ce que l'écran affiche, ce que le dépôt écrit et
 * ce que le PDF imprime — le taux brut d'un champ n'atteint jamais le papier.
 */
export function tauxCumulesBornes(acomptes: readonly AcompteDevis[]): string[] {
  const tries = [...acomptes].sort((a, b) => a.rang - b.rang);
  let plancher = new Decimal(0);
  return tries.map((a) => {
    const brut = new Decimal(tauxCumuleValide(a.tauxCumule) ?? "0");
    const borne = Decimal.min(100, Decimal.max(plancher, brut));
    plancher = borne;
    return borne.toDecimalPlaces(2).toString();
  });
}

export type LigneAcompte = {
  rang: number;
  moment: string;
  /** Le taux cumulé, borné, tel qu'il s'écrit (« 50 »). */
  tauxCumule: string;
  /** Ce qui tombe CE jour-là : la différence avec l'acompte d'avant. */
  montant: string;
};

export type EcheancierDevis = {
  lignes: LigneAcompte[];
  /** Ce qui manque pour arriver à 100 % — jamais négatif. */
  reste: string;
  /** « Reste à régler après acompte », au pluriel dès le deuxième. */
  libelleReste: string;
};

/**
 * L'échéancier d'un devis : une ligne par acompte avec ce qui tombe ce jour-là,
 * et le reste à régler. Sans acompte, aucune ligne et tout le TTC en reste.
 */
export function echeancierDevis(
  acomptes: readonly AcompteDevis[],
  totalTtc: string | number
): EcheancierDevis {
  const ttc = new Decimal(totalTtc || 0);
  const cumules = tauxCumulesBornes(acomptes);
  const tries = [...acomptes].sort((a, b) => a.rang - b.rang);
  let dejaVerse = new Decimal(0);
  const lignes = cumules.map((taux, i) => {
    // Le montant se calcule sur le cumul, puis on retire ce qui a déjà été
    // versé : les centimes résiduels tombent ainsi sur le dernier acompte, et
    // la somme des acomptes plus le reste vaut EXACTEMENT le TTC.
    const cumuleEnEuros = ttc.times(taux).dividedBy(100).toDecimalPlaces(2);
    const montant = cumuleEnEuros.minus(dejaVerse);
    dejaVerse = cumuleEnEuros;
    return {
      rang: tries[i].rang,
      moment: momentAcompte(tries[i].rang),
      tauxCumule: tauxLisible(taux),
      montant: montant.toFixed(2),
    };
  });
  const reste = Decimal.max(0, ttc.minus(dejaVerse)).toFixed(2);
  return {
    lignes,
    reste,
    libelleReste: `Reste à régler après acompte${lignes.length > 1 ? "s" : ""}`,
  };
}

/**
 * Le libellé d'une ligne d'acompte dans les TOTAUX — écran et papier.
 *
 * Le premier dit son taux tout court : « Acompte 30 % à la signature » ; les
 * suivants « Acompte à mi-parcours 50 % ». Sa correction du 13 septembre 2026 :
 * *« enlève les parenthèses »* — le « (50 % réglés) » qui expliquait le cumul
 * est parti ; le chiffre est cumulé, et c'est tout.
 */
export function libelleLigneAcompte(ligne: LigneAcompte): string {
  return ligne.rang === 1
    ? `Acompte ${ligne.tauxCumule} % ${ligne.moment}`
    : `Acompte ${ligne.moment} ${ligne.tauxCumule} %`;
}

/**
 * Les phrases des notes et conditions, une par acompte.
 *
 * *« Dans notes et conditions, retire les — avant soit »* : une virgule. Et
 * pas de parenthèses (13 septembre 2026), comme sur la ligne des totaux.
 */
export function phrasesAcomptes(echeancier: EcheancierDevis): string[] {
  return echeancier.lignes.map((l) =>
    l.rang === 1
      ? `Acompte de ${l.tauxCumule} % ${l.moment}, soit ${enEuros(l.montant)}.`
      : `Acompte ${l.moment} ${l.tauxCumule} %, soit ${enEuros(l.montant)}.`
  );
}

/**
 * Le rang et le taux que « + Ajouter un acompte » pose.
 *
 * Le rang suivant, et sa valeur d'office — jamais sous le cumul d'avant : un
 * premier acompte monté à 60 fait proposer 60, pas 50. `null` quand il n'y a
 * plus de moment à donner, ou que le devis est déjà réglé à 100 %.
 */
export function acompteSuivantPropose(
  acomptes: readonly AcompteDevis[],
  tauxReglage: string | number | null | undefined
): AcompteDevis | null {
  if (acomptes.length >= ACOMPTES_MAX) return null;
  const cumules = tauxCumulesBornes(acomptes);
  const precedent = cumules.length ? cumules[cumules.length - 1] : "0";
  if (new Decimal(precedent).greaterThanOrEqualTo(100)) return null;
  const rang = acomptes.length + 1;
  const dOffice = TAUX_CUMULES_D_OFFICE[rang - 1] ?? tauxCumuleValide(tauxReglage) ?? "30";
  const taux = Decimal.min(100, Decimal.max(precedent, dOffice)).toDecimalPlaces(2).toString();
  return { rang, tauxCumule: taux };
}

/**
 * Ce que porte un devis neuf : le taux des Réglages, d'office — ou rien quand
 * l'artisan n'a pas réglé d'acompte. C'est le « marqué d'office » de sa
 * décision, et le seul endroit qui décide de ce qui naît avec le devis.
 */
export function acompteDOffice(tauxReglage: string | number | null | undefined): AcompteDevis | null {
  const taux = tauxCumuleValide(tauxReglage);
  return taux === null || new Decimal(taux).isZero() ? null : { rang: 1, tauxCumule: taux };
}
