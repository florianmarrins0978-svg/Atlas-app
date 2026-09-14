import Decimal from "decimal.js";
import { tauxDeLaLigne, totauxAvecReduction, type CategorieTva } from "./reduction-devis";

/**
 * ─── LES LIGNES DU PAPIER — sa planche du 14 septembre 2026 ─────────────────
 *
 * Le devis et la facture sont le même papier (`appli/le-papier-devis-et-facture.html`),
 * et son tableau a les colonnes des pros : Désignation · Qté · Unité · P.U. HT ·
 * Rem. % · Total HT · TVA % · Total TTC. Le taux se lit SUR la ligne, et les
 * bases par taux se lisent dessous — plus de tableau coupé en « TVA 20 % /
 * TVA 10 % » avec un sous-total chacun.
 *
 * **Ce que ce fichier décide, et pourquoi il existe.** Une remise s'accorde
 * sur le tout ; le papier l'écrit sur chaque ligne (« Rem. % ») et le « Total
 * HT » de la ligne est donc NET de remise. Or un client additionne la colonne
 * et compare au total : les centimes doivent tomber juste. Chaque ligne prend
 * sa part arrondie, et le centime résiduel de chaque taux se pose sur la
 * dernière ligne de ce taux — de sorte que la colonne « Total HT » fait
 * exactement la base HT du taux, et la colonne « Total TTC » exactement
 * base + TVA, telles que `totauxAvecReduction` les rend. Une seule règle pour
 * les totaux, et les lignes se plient à elle (`CLAUDE.md` §3).
 */
export type LigneDuPapier<T> = {
  ligne: T;
  /** Le taux de la ligne, à deux décimales — « 20.00 ». */
  taux: string;
  /** Le montant de la ligne net de remise, à deux décimales. */
  net: string;
  /** Net + TVA du taux, à deux décimales. */
  ttc: string;
};

export function lignesDuPapier<T extends { montant: string; tauxTva?: string | null }>(
  lignes: readonly T[],
  tauxDuDocument: string,
  reductionPourcent?: string | number | null
): { lignes: LigneDuPapier<T>[]; parTaux: CategorieTva[] } {
  const totaux = totauxAvecReduction(lignes, tauxDuDocument, reductionPourcent);
  const nets = lignes.map((l) => {
    const taux = tauxDeLaLigne(l, tauxDuDocument);
    const categorie = totaux.parTaux.find((c) => c.taux === taux)!;
    const brutCat = new Decimal(categorie.brutHt);
    // La part de la ligne dans son taux, puis dans la base nette de ce taux.
    const net = brutCat.isZero()
      ? new Decimal(l.montant)
      : new Decimal(l.montant).times(new Decimal(categorie.baseHt)).dividedBy(brutCat).toDecimalPlaces(2);
    const ttc = net.times(new Decimal(taux).dividedBy(100).plus(1)).toDecimalPlaces(2);
    return { ligne: l, taux, net, ttc };
  });

  // Le centime résiduel de chaque taux va sur SA dernière ligne : la colonne
  // fait alors exactement la base, et le client qui additionne retombe juste.
  for (const categorie of totaux.parTaux) {
    const siennes = nets.filter((n) => n.taux === categorie.taux);
    if (!siennes.length) continue;
    const derniere = siennes[siennes.length - 1];
    const sommeNet = siennes.reduce((acc, n) => acc.plus(n.net), new Decimal(0));
    derniere.net = derniere.net.plus(new Decimal(categorie.baseHt).minus(sommeNet));
    const sommeTtc = siennes.reduce((acc, n) => acc.plus(n.ttc), new Decimal(0));
    const ttcCat = new Decimal(categorie.baseHt).plus(new Decimal(categorie.tva));
    derniere.ttc = derniere.ttc.plus(ttcCat.minus(sommeTtc));
  }

  return {
    lignes: nets.map((n) => ({ ligne: n.ligne, taux: n.taux, net: n.net.toFixed(2), ttc: n.ttc.toFixed(2) })),
    parTaux: totaux.parTaux,
  };
}

/**
 * « 3 », jamais « 3.00 » ; « 1,5 » quand il l'a tapé — sa remarque du
 * 14 septembre 2026 devant « 1.00 » et « 3.00 ml » sur son devis. La base
 * stocke deux décimales parce que c'est de l'argent ; une quantité se lit
 * comme il l'aurait écrite.
 */
export function quantiteLisible(quantite: string | number): string {
  const n = new Decimal(String(quantite).replace(",", "."));
  if (!n.isFinite()) return String(quantite);
  return n.toDecimalPlaces(2).toString().replace(".", ",");
}

/** « 20 », « 5,5 » — le taux d'une colonne, sans le « % » ni les zéros. */
export function tauxCourt(taux: string): string {
  return new Decimal(taux).toDecimalPlaces(2).toString().replace(".", ",");
}
