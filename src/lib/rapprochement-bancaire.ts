/**
 * QUELLE FACTURE UN VIREMENT REÇU PAIE-T-IL ? — une PROPOSITION, jamais un fait.
 *
 * Sa demande du 21 octobre 2026 (`appli/banque-qui-previent.html`), et son
 * choix de la banque du 14 août (`docs/QUESTIONS.md` §20).
 *
 * **Un relevé bancaire ne porte pas de numéro de facture.** Il porte une date,
 * un montant et un libellé écrit par la banque de l'autre : « VIR M LALA »,
 * parfois rien d'utile. Ce qui suit DEVINE, et c'est pourquoi rien ici n'écrit
 * nulle part : un virement collé à la mauvaise facture met la TVA dans le
 * mauvais mois. Atlas propose, le patron dit oui.
 *
 * **Quand ça ne tombe pas juste, on le dit au lieu de choisir** :
 *
 * | ce que la banque montre | ce qui est rendu |
 * |---|---|
 * | une seule facture a ce reste dû | `juste` |
 * | plusieurs, et le nom n'en désigne qu'une | `juste` |
 * | plusieurs, et le nom ne tranche pas | `plusieurs` : il choisira |
 * | aucune à ce montant, une seule moins chère au nom du payeur | `partie` : un acompte probable |
 * | rien de tout ça | `aucune` |
 *
 * Les montants se comparent en CENTIMES entiers : `0.1 + 0.2` ne vaut pas
 * `0.3`, et un virement de 120,00 € doit rencontrer un reste de « 120.00 ».
 */

export type VirementRecu = {
  /** « 2026-10-21 » : le jour où la banque l'a inscrit. */
  date: string;
  /** « 120.00 », positif : seuls les crédits arrivent ici. */
  montant: string;
  /** Le nom du payeur quand la banque le donne, sinon rien. */
  payeur: string | null;
  /** Le libellé tel que la banque l'écrit. */
  libelle: string;
};

export type FactureARapprocher = {
  id: string;
  numero: string;
  clientNom: string | null;
  /** Ce qui reste à recevoir, « 120.00 ». */
  reste: string;
  /** « 2026-10-20 ». */
  dateEmission: string;
};

export type Proposition =
  | { genre: "juste"; facture: FactureARapprocher; nomConcorde: boolean }
  | { genre: "plusieurs"; factures: FactureARapprocher[] }
  | { genre: "partie"; facture: FactureARapprocher }
  | { genre: "aucune" };

/** « 120.00 », « 120,5 », « 120 » en centimes ; `null` pour ce qui n'est pas un montant. */
export function enCentimes(montant: string): number | null {
  const net = montant.trim().replace(",", ".");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(net);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Majuscules sans accents, tout ce qui n'est pas une lettre devient un blanc. */
function aplatir(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .trim();
}

/**
 * Le nom du client se lit-il dans ce que la banque écrit ?
 *
 * Mot par mot, et seulement les mots de trois lettres ou plus : « M », « DE »
 * ou « LA » se trouvent dans n'importe quel libellé, et feraient concorder
 * tout le monde avec tout le monde.
 */
export function nomConcorde(clientNom: string | null, virement: VirementRecu): boolean {
  if (!clientNom) return false;
  const mots = aplatir(clientNom)
    .split(" ")
    .filter((m) => m.length >= 3);
  if (mots.length === 0) return false;
  const lu = ` ${aplatir(`${virement.payeur ?? ""} ${virement.libelle}`)} `;
  return mots.some((m) => lu.includes(` ${m} `));
}

export function proposerFacture(virement: VirementRecu, factures: readonly FactureARapprocher[]): Proposition {
  const montant = enCentimes(virement.montant);
  if (montant === null || montant <= 0) return { genre: "aucune" };

  // Une facture émise APRÈS le virement ne peut pas être celle qu'il paie.
  const possibles = factures.filter((f) => f.dateEmission <= virement.date);

  const auMontant = possibles.filter((f) => enCentimes(f.reste) === montant);
  if (auMontant.length === 1) {
    const [facture] = auMontant;
    return { genre: "juste", facture, nomConcorde: nomConcorde(facture.clientNom, virement) };
  }
  if (auMontant.length > 1) {
    const auNom = auMontant.filter((f) => nomConcorde(f.clientNom, virement));
    if (auNom.length === 1) return { genre: "juste", facture: auNom[0], nomConcorde: true };
    return { genre: "plusieurs", factures: auMontant };
  }

  // Aucune au montant exact : un acompte, peut-être. Seulement si le NOM
  // désigne une seule facture plus grande — sans le nom, un montant plus petit
  // irait à toutes, et ce ne serait plus une proposition.
  const enPartie = possibles.filter((f) => {
    const reste = enCentimes(f.reste);
    return reste !== null && reste > montant && nomConcorde(f.clientNom, virement);
  });
  if (enPartie.length === 1) return { genre: "partie", facture: enPartie[0] };

  return { genre: "aucune" };
}
