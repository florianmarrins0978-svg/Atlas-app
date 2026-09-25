import Decimal from "decimal.js";
import { tauxDeLaLigne, totauxAvecReduction } from "@/lib/reduction-devis";

/**
 * La TVA d'un relevé, découpée par taux, pour qu'elle se vérifie à la calculette.
 *
 * **Sa demande du 25 septembre 2026**, planche
 * `appli/tva-collectee-a-la-calculette.html` : *« il faudrait savoir c'est une
 * TVA à combien »*. Chaque ligne de la page dit son taux ; à 20 %, le montant
 * ÷ 6 redonne la TVA, à 10 %, ÷ 11.
 *
 * **Le piège, et il était dans le dépôt.** Le relevé portait un seul taux par
 * facture, `tauxDeLaFacture` : TVA ÷ HT de la facture entière. Sur une facture
 * qui mêle 10 % et 20 % (migration 0073), il rend une moyenne, 17,18 % par
 * exemple, qui n'est pas un taux et ne se vérifie pas. Le taux vrai vit sur
 * chaque ligne de la pièce : une facture mixte donne donc une part par taux.
 *
 * **Rien ici ne décide de la TVA due.** Les montants d'une entrée du relevé
 * sortent d'`entreesDuReleve`, et ce fichier ne fait que les RÉPARTIR : la
 * somme des parts retombe au centime sur l'entrée, toujours. Une répartition
 * qui changerait un total ferait deux relevés pour une seule période.
 */

/** Ce qu'une pièce porte à un taux : sa base et sa TVA. */
export type CategoriePiece = { taux: string; ht: string; tva: string };

/** Une part d'une ligne du relevé. `taux` nul : la pièce ne le dit pas. */
export type PartDuTaux = { taux: string | null; tva: string; ttc: string };

/**
 * Les catégories d'une facture, telles que son papier les imprime.
 *
 * **Le même calcul que l'émission** (`totauxAvecReduction`), remise comprise :
 * une seconde façon de ventiler finirait par donner une autre TVA que celle
 * écrite sur la facture (`CLAUDE.md` §3).
 */
export function categoriesDeLaFacture(
  lignes: readonly { montant: string; tauxTva?: string | null }[],
  tauxDuDocument: string,
  reductionPourcent: string | null
): CategoriePiece[] {
  return totauxAvecReduction(lignes, tauxDuDocument, reductionPourcent).parTaux.map((c) => ({
    taux: c.taux,
    ht: c.baseHt,
    tva: c.tva,
  }));
}

/**
 * Les catégories d'un avoir, lues sur ses lignes enregistrées.
 *
 * Un avoir partiel ne porte qu'un taux (`calculerAvoir` refuse de partager une
 * somme entre deux) ; un avoir total reprend toutes les lignes de la facture.
 * Sa TVA se répartit alors au prorata de la TVA de chaque base, et le centime
 * d'arrondi va à la plus grosse : la somme retombe sur ce que l'avoir retire.
 */
export function categoriesDeLAvoir(avoir: {
  totalTva: string;
  lignes: readonly { totalHt: string; tauxTva: string }[];
}): CategoriePiece[] {
  const ht = new Map<string, Decimal>();
  for (const l of avoir.lignes) {
    const taux = tauxDeLaLigne(l, l.tauxTva);
    ht.set(taux, (ht.get(taux) ?? new Decimal(0)).plus(new Decimal(l.totalHt)));
  }
  const taux = [...ht.keys()];
  const poids = taux.map((t) => ht.get(t)!.times(new Decimal(t)));
  const tva = repartir(new Decimal(avoir.totalTva), poids);
  return taux.map((t, i) => ({ taux: t, ht: ht.get(t)!.toFixed(2), tva: tva[i]!.toFixed(2) }));
}

/**
 * Ce qui reste à chaque taux une fois les avoirs retirés.
 *
 * Aux encaissements, un règlement se compte au prorata de la facture APRÈS ses
 * avoirs (`apresAvoirs`) : ses parts doivent l'être aussi, sinon un avoir sur
 * la ligne à 10 % laisserait croire que le client paie encore du 10 %.
 */
export function retirerLesAvoirs(
  facture: readonly CategoriePiece[],
  avoirs: readonly (readonly CategoriePiece[])[]
): CategoriePiece[] {
  const net = new Map(facture.map((c) => [c.taux, { ht: new Decimal(c.ht), tva: new Decimal(c.tva) }]));
  for (const avoir of avoirs) {
    for (const c of avoir) {
      const n = net.get(c.taux) ?? { ht: new Decimal(0), tva: new Decimal(0) };
      net.set(c.taux, { ht: n.ht.minus(new Decimal(c.ht)), tva: n.tva.minus(new Decimal(c.tva)) });
    }
  }
  return [...net.entries()]
    .filter(([, n]) => n.ht.plus(n.tva).greaterThan(0))
    .map(([taux, n]) => ({ taux, ht: n.ht.toFixed(2), tva: n.tva.toFixed(2) }));
}

/**
 * Une ligne du relevé, découpée entre les taux de sa pièce.
 *
 * Le montant se répartit au prorata du TTC de chaque taux, la TVA au prorata
 * de la TVA de chaque taux ; chacun des deux retombe au centime sur l'entrée.
 * Une pièce à un seul taux rend une seule part, identique à l'entrée.
 *
 * **Sans catégorie lisible, le taux reste nul** : il se dit « non noté » à
 * l'écran, il ne se devine pas (`docs/AGENT.md` §3).
 */
export function ventilerParTaux(
  entree: { tva: string; ttc: string },
  categories: readonly CategoriePiece[]
): PartDuTaux[] {
  const utiles = categories.filter((c) => new Decimal(c.ht).plus(new Decimal(c.tva)).greaterThan(0));
  if (utiles.length === 0) return [{ taux: null, tva: new Decimal(entree.tva).toFixed(2), ttc: new Decimal(entree.ttc).toFixed(2) }];
  if (utiles.length === 1) {
    return [{ taux: utiles[0]!.taux, tva: new Decimal(entree.tva).toFixed(2), ttc: new Decimal(entree.ttc).toFixed(2) }];
  }
  const ttc = repartir(
    new Decimal(entree.ttc),
    utiles.map((c) => new Decimal(c.ht).plus(new Decimal(c.tva)))
  );
  const tva = repartir(
    new Decimal(entree.tva),
    utiles.map((c) => new Decimal(c.tva))
  );
  // Le plus fort taux en tête : c'est l'ordre du récapitulatif en bas de page.
  return utiles
    .map((c, i) => ({ taux: c.taux, tva: tva[i]!.toFixed(2), ttc: ttc[i]!.toFixed(2) }))
    .sort((a, b) => new Decimal(b.taux).comparedTo(new Decimal(a.taux)));
}

/** Une ligne du récapitulatif : un taux, ce qu'il pèse, et s'il manque un montant. */
export type RecapDuTaux = { taux: string | null; tva: string; ttc: string; montantManquant: boolean };

/**
 * Le récapitulatif par taux, du plus fort au plus faible, « sans taux » en
 * dernier. C'est aussi ce que la déclaration demande.
 *
 * `ttc` nul sur une part (un achat écrit à la main sans son montant) ne compte
 * pas pour zéro en silence : `montantManquant` le dit, et l'écran l'écrit.
 */
export function recapParTaux(parts: readonly { taux: string | null; tva: string; ttc: string | null }[]): RecapDuTaux[] {
  const groupes = new Map<string | null, { tva: Decimal; ttc: Decimal; manque: boolean }>();
  for (const p of parts) {
    const cle = p.taux === null ? null : new Decimal(p.taux).toFixed(2);
    const g = groupes.get(cle) ?? { tva: new Decimal(0), ttc: new Decimal(0), manque: false };
    g.tva = g.tva.plus(new Decimal(p.tva));
    if (p.ttc === null) g.manque = true;
    else g.ttc = g.ttc.plus(new Decimal(p.ttc));
    groupes.set(cle, g);
  }
  return [...groupes.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : new Decimal(b).comparedTo(new Decimal(a))))
    .map(([taux, g]) => ({ taux, tva: g.tva.toFixed(2), ttc: g.ttc.toFixed(2), montantManquant: g.manque }));
}

/** « 20.00 » devient « 20 % », « 5.50 » devient « 5,5 % ». */
export function tauxLisible(taux: string): string {
  return `${new Decimal(taux).toString().replace(".", ",")} %`;
}

/**
 * Un montant partagé au prorata de poids, arrondi au centime, dont la somme
 * retombe exactement sur le montant : le centime restant va au plus gros poids,
 * là où il pèse le moins (même règle que la remise, `totauxAvecReduction`).
 */
function repartir(montant: Decimal, poids: readonly Decimal[]): Decimal[] {
  const total = poids.reduce((acc, p) => acc.plus(p), new Decimal(0));
  if (total.isZero()) return poids.map((_, i) => (i === 0 ? montant : new Decimal(0)));
  let plusGros = 0;
  poids.forEach((p, i) => {
    if (p.greaterThan(poids[plusGros]!)) plusGros = i;
  });
  const parts = poids.map((p) => montant.times(p).dividedBy(total).toDecimalPlaces(2));
  const ecart = montant.minus(parts.reduce((acc, p) => acc.plus(p), new Decimal(0)));
  parts[plusGros] = parts[plusGros]!.plus(ecart);
  return parts;
}
