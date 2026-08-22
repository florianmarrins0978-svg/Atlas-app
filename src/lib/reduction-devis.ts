import Decimal from "decimal.js";

/**
 * Le prix accordé au client — la règle, en un seul endroit.
 *
 * Le patron, le 16 août 2026 : *« si jamais un client me demande une réduction,
 * [pouvoir] lui demander "fais cinq pour cent sur le montant du devis" et il
 * ajoute une petite ligne réduction ou prix accordé au client — cinq pour cent,
 * ou dix, ou quinze. C'est moi qui choisis le nombre de pourcentage. »*
 *
 * Puis, sur `docs/maquettes/61-la-reduction-au-client.html` : **« Sous le total
 * et prix accordé au client »** — l'arrangement B, et son libellé.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE B COÛTE, ET POURQUOI CE FICHIER EXISTE.
 *
 * Il lui a été dit avant qu'il choisisse : B n'est pas une ligne du tableau,
 * donc la réduction ne voyage pas toute seule. Il faut la porter dans le devis,
 * dans la facture, dans le PDF des deux, à l'écran, et dans tout ce qui recopie
 * un total. **Chaque endroit oublié est un montant faux.** Il a choisi en
 * connaissance de cause.
 *
 * La parade est ce fichier : **un seul calcul, que tout le monde appelle.**
 * Le jour où quelqu'un recalcule un total à la main quelque part, il se
 * trompera — pas parce qu'il est distrait, mais parce que l'ordre des
 * opérations est piégeux.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ORDRE DES OPÉRATIONS N'EST PAS NÉGOCIABLE.
 *
 * La réduction s'applique sur le **HT**, et la TVA se calcule **après**.
 * L'appliquer sur le TTC rendrait une TVA fausse sur un document qui finit dans
 * une déclaration : ce n'est pas une préférence de présentation, c'est la seule
 * façon juste, et elle lui a été annoncée comme non soumise à son choix.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `Decimal` PARTOUT, ET JAMAIS `number`. C'est de l'argent : 870 × 0,15 vaut
 * 130.49999999999997 en virgule flottante, et un devis à 739,50 € deviendrait
 * un devis à 739,51 €. Le reste du dépôt suit déjà cette règle
 * (`factures.ts`, `devis.ts`) ; ce fichier ne fait pas exception.
 */

/** Les bornes du pourcentage. **Elles servent à l'écran ET au serveur** : une seule règle. */
export const BORNES_REDUCTION = { min: 0, max: 100 } as const;

export type TotauxDevis = {
  /** Ce que valent les lignes, avant tout geste commercial. */
  brutHt: string;
  /** `null` : aucun prix accordé — le document n'écrit alors rien du tout. */
  reductionPourcent: string | null;
  /** Ce qui est retiré, en euros. `null` quand il n'y a pas de réduction. */
  reductionMontant: string | null;
  /** Ce sur quoi la TVA se calcule, et ce que la comptabilité doit voir. */
  totalHt: string;
  totalTva: string;
  totalTtc: string;
};

/**
 * Un pourcentage tel qu'il a pu être dicté ou saisi, ramené à une valeur sûre.
 *
 * **Hors bornes, on borne au lieu de refuser** — même choix que les conditions
 * de document (`conditions-documents.ts`) : une saisie à 150 % vient d'un doigt
 * qui a glissé, et un écran qui refuse sans rien dire fait recommencer.
 *
 * **Zéro vaut « aucune réduction »**, pas « une réduction de zéro » : une ligne
 * « Prix accordé au client 0 % — 0,00 € » sur un devis n'apprend rien à
 * personne et fait douter du reste.
 */
export function pourcentValide(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const brut = typeof valeur === "number" ? String(valeur) : String(valeur).replace(",", ".").trim();
  if (!/^-?\d+(\.\d+)?$/.test(brut)) return null;
  const n = new Decimal(brut);
  if (n.lessThanOrEqualTo(BORNES_REDUCTION.min)) return null;
  if (n.greaterThan(BORNES_REDUCTION.max)) return String(BORNES_REDUCTION.max);
  // Deux décimales : la colonne en base est `numeric(5,2)`, et laisser passer
  // « 7,333 » ferait diverger l'écran de ce qui est enregistré.
  return n.toDecimalPlaces(2).toString();
}

/**
 * Les totaux d'un devis ou d'une facture, réduction comprise.
 *
 * **`totalHt` est le montant APRÈS réduction**, et c'est le choix qui fait tenir
 * le reste. Tout ce qui existe déjà — le relevé de TVA, l'export comptable, le
 * suivi des paiements — lit `totalHt` en croyant lire ce qui est dû. Y laisser
 * le prix plein aurait fait déclarer une TVA sur de l'argent que le client ne
 * paie pas, et il aurait fallu corriger chacun de ces endroits sans en oublier.
 * Le prix plein reste lisible dans `brutHt`, pour le document.
 */
export function totauxAvecReduction(
  lignes: readonly { montant: string }[],
  tauxTva: string,
  reductionPourcent?: string | number | null,
): TotauxDevis {
  const brut = lignes.reduce((acc, l) => acc.plus(new Decimal(l.montant)), new Decimal(0));
  const pourcent = pourcentValide(reductionPourcent);

  // **Arrondi ici, une fois pour toutes.** Un montant retiré qu'on garderait à
  // pleine précision donnerait un net dont les deux décimales ne correspondent
  // plus à la soustraction écrite sur le papier — et le client refait le calcul.
  const montant = pourcent === null
    ? null
    : brut.times(new Decimal(pourcent)).dividedBy(100).toDecimalPlaces(2);

  const net = montant === null ? brut : brut.minus(montant);
  const tva = net.times(new Decimal(tauxTva)).dividedBy(100);

  return {
    brutHt: brut.toFixed(2),
    reductionPourcent: pourcent,
    reductionMontant: montant === null ? null : montant.toFixed(2),
    totalHt: net.toFixed(2),
    totalTva: tva.toFixed(2),
    totalTtc: net.plus(tva).toFixed(2),
  };
}

/**
 * Ce que le document écrit sous le total — l'arrangement B, tel qu'il l'a choisi.
 *
 * Écrit ici et pas dans l'écran : la même phrase doit sortir à l'identique sur
 * l'écran du devis, sur son PDF, sur la facture et sur le PDF de la facture.
 * Quatre rédactions du même prix accordé finiraient par se contredire, et c'est
 * le client qui verrait la différence.
 *
 * **« Prix accordé au client », et pas « Réduction ».** C'est le mot qu'il a
 * désigné le 16 août, contre l'autre qu'il proposait lui-même.
 */
export const LIBELLE_REDUCTION = "Prix accordé au client";

/** « Prix accordé au client 15 % », ou `null` s'il n'y en a pas. */
export function libelleReduction(pourcent: string | null): string | null {
  if (pourcent === null) return null;
  // « 15 » plutôt que « 15.00 » : personne n'écrit deux décimales sur un
  // pourcentage rond, et le document est celui que son client lit.
  const lisible = new Decimal(pourcent).toDecimalPlaces(2).toString().replace(".", ",");
  return `${LIBELLE_REDUCTION} ${lisible} %`;
}
