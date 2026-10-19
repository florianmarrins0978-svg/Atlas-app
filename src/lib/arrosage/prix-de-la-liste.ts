import type { Groupe, Ligne } from "./postes";

/**
 * LE PRIX À DROITE DE CHAQUE PIÈCE, ET LE TOTAL — sa demande du 19 octobre 2026 :
 * *« lorsque l'outil me donne la liste des pièces, à droite, il y ait le prix qui
 * s'affiche et qu'en dessous il y a un total »*, puis *« même avec 0 »*.
 *
 * **Ce sont des PRIX D'ACHAT, ceux de ses devis fournisseurs**, lus et validés
 * par lui (planche `appli/arrosage-prix-fournisseurs.html`), jamais ses prix de
 * vente. **Aucun n'est inventé** (`CLAUDE.md` §4) : une pièce sans prix relevé
 * le dit, et le total ne la compte pas. Tant que l'application ne garde pas
 * encore ses devis fournisseurs, la table est vide et l'écran le dit.
 *
 * Les pièces barrées ne sont pas dans `lignes` : elles ne comptent pas.
 */

/** Prix d'achat hors taxes, par référence de pièce, à l'unité ou au mètre. */
export type TableDePrix = Record<string, number>;

/** Le prix d'une ligne : quantité × prix, ou `null` sans prix relevé, ou sans longueur. */
export function prixDeLigne(ref: string, e: Ligne, prix: TableDePrix): number | null {
  const p = prix[ref];
  if (p === undefined || !Number.isFinite(p) || !e.q) return null;
  return Math.round(p * e.q * 100) / 100;
}

export type TotalDeLaListe = { total: number; sansPrix: number; pieces: number };

/** Le total indicatif : chaque ligne qui part au fournisseur, les barrées n'y sont pas. */
export function totalDeLaListe(groupes: Groupe[], prix: TableDePrix): TotalDeLaListe {
  let total = 0, sansPrix = 0, pieces = 0;
  for (const g of groupes) {
    for (const [ref, e] of Object.entries(g.lignes)) {
      pieces++;
      const p = prixDeLigne(ref, e, prix);
      if (p === null) sansPrix++;
      else total += p;
    }
  }
  return { total: Math.round(total * 100) / 100, sansPrix, pieces };
}

/** « 1 234,50 € » : l'écriture française, deux décimales. */
export function euros(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
