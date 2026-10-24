/**
 * Le ticket recopié LIGNE PAR LIGNE, comme imprimé. Lot 5 de « Pour mon
 * comptable » : *« il faut toutes les infos, non ? »* (24 octobre 2026), et
 * rien de regroupé, sa remarque devant un essai qui fusionnait les trois
 * « REAL THAI LAIT COCO » de son ticket Intermarché.
 *
 * Règle pure : elle relit ce que la lecture a rendu (le modèle, ou le
 * formulaire qui le renvoie), et c'est la même qui sert aux deux
 * (`lire-ticket.ts`, `ajouterAchatAction`).
 */

export type LigneImprimee = {
  /** Le texte de la ligne, à gauche. */
  gauche: string;
  /** Ce qui est imprimé à droite (un montant, le plus souvent), ou rien. */
  droite: string | null;
};

/** Un ticket de caisse de supermarché dépasse rarement cent lignes ; au-delà, c'est une lecture qui boucle. */
export const LIGNES_MAX = 200;
const LONGUEUR_MAX = 80;

function propre(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // Les caractères de contrôle n'ont rien à faire sur un ticket, et un retour
  // à la ligne caché ferait deux lignes d'une seule dans le PDF.
  const t = v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, LONGUEUR_MAX);
  return t === "" || t.toLowerCase() === "null" ? null : t;
}

/**
 * Les lignes, relues et bornées ; `null` quand il n'y en a aucune de lisible.
 * Accepte une ligne écrite d'un seul tenant (une chaîne) ou en deux colonnes
 * (`{ g, d }`, ou `{ gauche, droite }` quand elles reviennent du formulaire).
 */
export function lignesImprimees(brut: unknown): LigneImprimee[] | null {
  if (!Array.isArray(brut)) return null;
  const lignes: LigneImprimee[] = [];
  for (const l of brut.slice(0, LIGNES_MAX)) {
    if (typeof l === "string") {
      const g = propre(l);
      if (g) lignes.push({ gauche: g, droite: null });
      continue;
    }
    if (l && typeof l === "object") {
      const o = l as Record<string, unknown>;
      const g = propre(o.g ?? o.gauche);
      const d = propre(o.d ?? o.droite);
      if (g || d) lignes.push({ gauche: g ?? "", droite: d });
    }
  }
  return lignes.length > 0 ? lignes : null;
}

/** Le montant écrit dans un texte (« 30,12 EUR », « 18,90 € »), en centimes ; `null` s'il n'y en a pas. */
export function montantEcrit(texte: string | null): number | null {
  if (!texte) return null;
  const m = texte.match(/(-?\d{1,6}(?:[ .  ]\d{3})*)[,.](\d{2})(?!\d)/);
  if (!m) return null;
  return Math.round(Number(m[1].replace(/[ .  ]/g, "")) * 100 + (m[1].startsWith("-") ? -1 : 1) * Number(m[2]));
}

/**
 * La ligne du total, celle qui se surligne en bleu gris : un montant égal au
 * total TTC, sur une ligne qui le dit (« TOTAL », « MONTANT DU », « À
 * PAYER »…), sinon le premier montant égal. `-1` quand aucune ne tombe juste :
 * la pièce affiche alors le total à part, et ne surligne pas une ligne au hasard.
 */
export function ligneDuTotal(lignes: LigneImprimee[], totalTtc: number | null): number {
  if (totalTtc === null) return -1;
  const cible = Math.round(totalTtc * 100);
  const egales = lignes.flatMap((l, i) => (montantEcrit(l.droite ?? l.gauche) === cible ? [i] : []));
  // « SOUS-TOTAL » tombe souvent juste aussi, mais ce n'est pas ce qu'on a payé.
  const dite = egales.find((i) => /total|montant|payer|pay[ée]|net|ttc/i.test(lignes[i].gauche) && !/sous/i.test(lignes[i].gauche));
  return dite ?? egales[0] ?? -1;
}
