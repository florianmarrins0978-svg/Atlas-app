// **Ce que le CLIENT lit sur le devis, une fois les mesures rangées ailleurs.**
//
// ─── Ce qu'il a vu sur son vrai devis, le 30 août 2026 ──────────────────────
//
//   Haie de laurier (800 ml) (800 ml)          Qté 800
//   Érable (40 cm de diamètre, 12 m de haut)   Qté 1
//   Dessouchage — deux souches de 60 cm (2 souche)   Qté 2
//   Tonte de la pelouse (1 200 m²) (1200 m²)   Qté 1200
//
// Sa règle : *« les caractéristiques techniques servent au moteur d'Atlas et au
// calcul du prix ; elles ne doivent PAS être répétées dans la description
// visible du devis client. »* La quantité et l'unité ont désormais leurs
// colonnes — elles n'ont plus rien à faire dans le texte.
//
// ─── D'OÙ VIENT LE DOUBLE, et c'est deux causes, pas une ────────────────────
//
// La parenthèse apparaît **deux fois** parce que deux mains l'écrivent :
//
// | | |
// |---|---|
// | le MODÈLE | il rend « Haie de laurier (800 ml) » — c'est ce que la dictée dit |
// | `libelleAvecQuantite` | il recolle « (800 ml) » depuis les colonnes |
//
// La preuve est dans l'espace insécable : « (1 200 m²) » est écrit comme un
// humain l'écrit — c'est le modèle ; « (1200 m²) » sort d'une colonne.
//
// Corriger la seconde ne suffit donc pas : la première resterait. Et l'on ne
// touche pas à l'invite du modèle — sa consigne du 30 août.
//
// ─── CE QUE CE MODULE NE FAIT PAS, et c'est le plus important ───────────────
//
// **Il ne touche pas au libellé stocké.** `mesures-prestation.ts` l'explique :
// *« quatre moteurs relisent encore le texte, et le leur retirer avant qu'ils
// sachent lire les colonnes ferait perdre à une haie son prix au mètre
// linéaire. »* Nettoyer `prestations.libelle` casserait donc le chiffrage.
//
// La séparation existait déjà dans `LigneVendable`, sans être exploitée :
//
// | | |
// |---|---|
// | `libelle` | « ce que le client lit » — nettoyé ici |
// | `membres` | les libellés bruts — ce que les moteurs relisent, INTACT |
//
// **Et rien n'est réécrit en base.** Les devis déjà enregistrés gardent le
// texte qu'ils portaient : leur ligne a été figée le jour de son envoi, et la
// réinterpréter changerait un document que le client a reçu.
//
// ─── LA RÈGLE DU NETTOYAGE, et pourquoi elle n'est pas un regex de plus ─────
//
// On ne retire pas « ce qui ressemble à une mesure ». On retire **un fragment
// dont TOUT ce qu'il dit est déjà dans les colonnes**. Un fragment qui apporte
// autre chose est gardé en entier.
//
//   « (40 cm de diamètre, 12 m de haut) »  → colonnes ⌀ 40, h 12   → retiré
//   « — deux souches de 60 cm »            → colonnes 2 souche, ⌀ 60 → retiré
//   « — démontage en rétention »           → la MÉTHODE, nulle part ailleurs → gardé
//
// Sans cette règle, « Érable — démontage en rétention » deviendrait « Érable »,
// et le client ne saurait plus ce qu'on lui facture.

import { enChiffres } from "./mesures-arbre";
import { lireCaracteristiques } from "./prestation-structuree";

export type PrestationLisible = {
  libelle: string;
  quantite?: string | null;
  unite?: string | null;
  caracteristiques?: unknown;
};

/** Les mots qui accompagnent une mesure sans rien dire de plus qu'elle. */
const LIANTS = [
  "de", "du", "des", "d", "en", "et", "a", "au", "aux", "la", "le", "les", "l",
  "diametre", "diam", "hauteur", "haut", "hauteurs", "long", "longueur", "large", "largeur",
  "environ", "soit", "par", "sur",
];

/** Les unités de mesure, en plus de celle que la prestation porte en colonne. */
const UNITES_DE_MESURE = [
  "cm", "centimetre", "mm", "millimetre", "m", "metre", "metrelineaire", "ml",
  "m2", "m3", "km", "t", "tonne", "kg", "stere", "l", "litre", "u",
];

/**
 * Le texte réduit à ses mots signifiants : minuscules, sans accents, sans
 * ponctuation, les nombres écrits en lettres passés en chiffres, et les
 * espaces internes des nombres retirés — « 1 200 » et « 1200 » sont le même.
 */
function motsDe(texte: string): string[] {
  const sansEspaceDansLesNombres = enChiffres(texte).replace(
    /(\d)[\s  ](?=\d{3}\b)/g,
    "$1"
  );
  return sansEspaceDansLesNombres
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // « m² » et « m³ » perdraient leur exposant au filtre suivant : on les
    // écrit d'abord en clair, sinon un « m² » se réduirait à « m » et l'on
    // retirerait une mesure qu'on n'a pas reconnue.
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Un mot est-il couvert par ce que les colonnes portent déjà ? */
function couvert(mot: string, valeurs: Set<string>, unites: Set<string>): boolean {
  if (LIANTS.includes(mot)) return true;
  if (UNITES_DE_MESURE.includes(mot)) return true;
  if (valeurs.has(mot)) return true;
  if (unites.has(mot)) return true;
  // Le pluriel du mot d'unité : « souches » pour une unité « souche ».
  if (mot.endsWith("s") && (unites.has(mot.slice(0, -1)) || UNITES_DE_MESURE.includes(mot.slice(0, -1)))) {
    return true;
  }
  return false;
}

/**
 * Le fragment ne dit-il QUE ce que les colonnes disent déjà ?
 *
 * Un fragment vide de mesure ne compte pas : « — en rétention » ne porte aucun
 * chiffre, et le retirer effacerait la seule chose que ce fragment apprend.
 */
function seulementDesMesuresConnues(
  fragment: string,
  valeurs: Set<string>,
  unites: Set<string>
): boolean {
  const mots = motsDe(fragment);
  if (mots.length === 0) return false;
  if (!mots.some((m) => valeurs.has(m))) return false;
  return mots.every((m) => couvert(m, valeurs, unites));
}

/** Les valeurs que les colonnes portent, écrites comme un texte les écrirait. */
function valeursConnues(p: PrestationLisible): { valeurs: Set<string>; unites: Set<string> } {
  const valeurs = new Set<string>();
  const unites = new Set<string>();

  const ajouter = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) return;
    valeurs.add(String(n));
    // Une colonne numérique rend « 800.00 » là où le texte dit « 800 ».
    if (Number.isInteger(n)) valeurs.add(String(Math.trunc(n)));
    valeurs.add(String(n).replace(".", ""));
  };

  const q = Number(String(p.quantite ?? "").replace(",", "."));
  ajouter(q);
  for (const u of motsDe(p.unite ?? "")) unites.add(u);

  const c = lireCaracteristiques(p.caracteristiques);
  for (const v of [c.diametreCm, c.hauteurM, c.longueurMl, c.tonnageT]) {
    if (v !== undefined) ajouter(v);
  }
  return { valeurs, unites };
}

/**
 * Le libellé tel que le client doit le lire.
 *
 * **Sans donnée structurée, le libellé est rendu tel quel** — c'est la garantie
 * de compatibilité : une prestation d'avant le 27 août 2026 n'a ni quantité, ni
 * unité, ni caractéristiques en colonne, et son texte est alors la seule chose
 * qui dise ce qu'on facture. Le nettoyer serait effacer l'information.
 */
export function libelleClient(p: PrestationLisible): string {
  const base = (p.libelle ?? "").trim();
  if (!base) return "";

  const { valeurs, unites } = valeursConnues(p);
  if (valeurs.size === 0) return base;

  // Les fragments se retirent PAR LA FIN, et l'on s'arrête au premier qui
  // apprend quelque chose : « Érable — démontage en rétention (⌀ 40 cm) » perd
  // sa parenthèse et garde sa méthode.
  let reste = base;
  for (;;) {
    const parenthese = reste.match(/^(.*?)\s*\(([^()]*)\)\s*$/s);
    if (parenthese && seulementDesMesuresConnues(parenthese[2], valeurs, unites)) {
      reste = parenthese[1].trimEnd();
      continue;
    }
    const tiret = reste.match(/^(.*\S)\s*[—–-]\s*([^—–]*)$/s);
    if (tiret && seulementDesMesuresConnues(tiret[2], valeurs, unites)) {
      reste = tiret[1].trimEnd();
      continue;
    }
    break;
  }

  // **Jamais un libellé vide.** Si tout ce que la prestation dit tenait dans
  // ses mesures — « 800 ml » et rien d'autre —, le client doit quand même lire
  // quelque chose : on rend alors le texte d'origine.
  const nettoye = reste.replace(/[\s,;:·]+$/u, "").trim();
  return nettoye.length > 0 ? nettoye : base;
}
