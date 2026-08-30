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

import { TECHNIQUES_PAR_DEFAUT } from "./grille-prix";
import { enChiffres } from "./mesures-arbre";
import { nature, natureDuLibelle } from "./natures-prestation";
import { lireCaracteristiques } from "./prestation-structuree";

export type PrestationLisible = {
  libelle: string;
  quantite?: string | null;
  unite?: string | null;
  /** La nature en colonne — sert à savoir QUI, du sujet ou du geste, nomme le travail. */
  nature?: string | null;
  /** L'espèce dictée. Sert à l'accord, jamais à inventer un mot absent du libellé. */
  espece?: string | null;
  /** La technique en colonne (`demontage_retention`…), quand le texte ne la dit pas. */
  methode?: string | null;
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


// =========================================================================
// RÉDIGER, plutôt qu'assembler avec un tiret
// =========================================================================
//
// **Sa consigne du 30 août 2026 :** *« les tirets ne doivent pas servir à
// assembler artificiellement plusieurs morceaux d'un libellé client. Quand
// plusieurs informations doivent apparaître dans une même description,
// construis une vraie formulation française naturelle. »*
//
//   « Érable — démontage en rétention »  →  « Démontage en rétention d'un érable »
//   « Dessouchage — deux souches de 60 cm » → « Dessouchage de souches de 60 cm »
//
// ─── Ce qui décide de l'ordre des mots ──────────────────────────────────────
//
// Le tiret réunit un SUJET et un GESTE, et rien ne disait lequel était lequel.
// Le référentiel des natures le dit : « dessouchage » est un geste,
// « érable » n'en est pas un. D'où deux tournures, et pas une de plus :
//
// | ce qui porte le geste | la phrase |
// |---|---|
// | la tête | `Dessouchage de souches de 60 cm` |
// | le complément | `Démontage en rétention d'un érable` |
//
// **Quand aucun des deux n'est un geste connu, le texte reste tel quel.**
// Inventer une tournure sur un travail que le produit ne sait pas nommer
// produirait du français faux sur un devis ; garder le tiret est laid, mais
// honnête, et cela se voit — donc cela se corrige.


// ─── L'ARTICLE NE SE DEVINE PAS ─────────────────────────────────────────────
//
// **Sa consigne du 30 août 2026 :** *« évite une règle grammaticale basée sur
// "d'un par défaut" avec une petite liste de mots féminins. Atlas ne doit pas
// produire une formulation grammaticalement fausse parce qu'une espèce manque
// dans une liste. »*
//
// Il a raison, et la première version avait le défaut exact qu'il décrit : elle
// écrivait « d'un » partout sauf sur une douzaine de mots. « d'un aubépine »
// n'attendait qu'une espèce oubliée.
//
// **Ce qui remplace la liste par défaut, c'est le RETRAIT de l'article.** Le
// français en offre une tournure qui ne demande aucun genre :
//
//   genre connu    →  « Démontage en rétention d'un érable »
//   genre inconnu  →  « Démontage en rétention d'aubépine »
//
// La seconde est correcte quel que soit le genre — c'est exactement la
// construction que porte déjà « Taille de haie **de laurier** », qu'il a
// validée. Une espèce absente de la liste perd son article, jamais sa
// justesse ; et elle reste écrite, ce qui vaut mieux que de la taire.
//
// La liste ci-dessous ne sert donc qu'à ENRICHIR, jamais à décider par défaut.
// L'oubli d'un mot coûte un article, pas une faute.

/** Le genre des mots que ce métier écrit tous les jours. Incomplète PAR NATURE. */
const GENRE_CONNU: Readonly<Record<string, "m" | "f">> = {
  erable: "m", chene: "m", tilleul: "m", marronnier: "m", frene: "m", hetre: "m",
  platane: "m", peuplier: "m", saule: "m", bouleau: "m", pin: "m", sapin: "m",
  cedre: "m", cypres: "m", if: "m", charme: "m", noyer: "m", chataignier: "m",
  merisier: "m", pommier: "m", prunier: "m", cerisier: "m", laurier: "m",
  thuya: "m", robinier: "m", acacia: "m", orme: "m", arbre: "m", conifere: "m",
  haie: "f", souche: "f", pelouse: "f", cloture: "f", palissade: "f",
  aubepine: "f", charmille: "f", glycine: "f", vigne: "f", bordure: "f",
};

/** Le mot nu, sans accent ni déterminant — la forme sous laquelle on l'interroge. */
function motNu(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(le|la|les|l|un|une|des|du|de|d)[\s']+/, "")
    .split(/[\s',]/)[0];
}

/**
 * « d'un érable », « d'une haie », « d'aubépine » — et jamais une faute.
 *
 * Rend le groupe complet, article compris quand le genre est connu, et la
 * simple préposition sinon. C'est l'appelant qui recolle : il n'a pas à savoir
 * lequel des deux cas s'est produit.
 */
function complementDe(mot: string): string {
  const nu = motNu(mot);
  const genre = GENRE_CONNU[nu];
  const minuscule = mot.trim().toLocaleLowerCase("fr");
  if (genre === "m") return `d'un ${minuscule}`;
  if (genre === "f") return `d'une ${minuscule}`;
  // Genre inconnu : la tournure sans article, correcte dans les deux genres.
  return /^[aeiouyâàäéèêëîïôöûü]/i.test(minuscule) ? `d'${minuscule}` : `de ${minuscule}`;
}

/** Le mot désigne-t-il un travail que le référentiel sait nommer ? */
function estUnGeste(texte: string): boolean {
  return natureDuLibelle(texte) !== null;
}

/**
 * La quantité retirée d'un fragment, quand la colonne la porte déjà.
 *
 * « deux souches de 60 cm » → « souches de 60 cm ». Le pluriel reste : c'est du
 * français, pas une donnée. Le 60 cm reste aussi — il dit QUELLES souches, et
 * sa consigne le garde explicitement.
 */
function sansLaQuantite(fragment: string, valeurs: ReadonlySet<string>): string {
  const enClair = enChiffres(fragment).trim();
  const tete = enClair.match(/^(\d+(?:[.,]\d+)?)\s+/);
  if (!tete) return fragment.trim();
  const valeur = String(Number(tete[1].replace(",", ".")));
  return valeurs.has(valeur) ? enClair.slice(tete[0].length).trim() : fragment.trim();
}

/**
 * Le nom du travail, quand le libellé s'ouvre sur son OBJET plutôt que sur lui.
 *
 * **La nature vient de la COLONNE, pas d'une ressemblance de chaînes.** Sa
 * consigne du 30 août : *« la formulation "Taille de haie" doit venir
 * explicitement de la nature structurée de la prestation, pas d'une simple
 * ressemblance entre deux chaînes de texte. »*
 *
 * La version d'avant comparait le dernier mot du libellé de la nature au
 * premier mot du texte. Cela marchait sur les douze natures d'aujourd'hui, et
 * rien n'empêchait la treizième de produire une phrase fausse. Chaque nature
 * déclare maintenant son `objet` ; sans nature en colonne, on ne substitue rien.
 */
function nommerLeTravail(texte: string, cleNature: string | null | undefined): string {
  const n = nature(cleNature);
  if (!n?.objet) return texte;
  const premier = texte.trim().split(/\s+/)[0];
  if (!premier) return texte;
  if (motNu(premier) !== motNu(n.objet)) return texte;
  return `${n.libelle}${texte.trim().slice(premier.length)}`;
}

/**
 * La technique, écrite comme le CLIENT doit la lire.
 *
 * **Deux écritures, dans un seul fichier.** Sa demande du 30 août :
 * *« pour la rétention, harmonise la formulation visible en "Démontage en
 * rétention d'un érable" »*. Le catalogue de sa grille dit « démontage avec
 * rétention » — c'est le libellé de ses écrans de réglage, et il ne bouge pas.
 * La formulation du devis vit à côté, dans le même tableau, pour que les deux
 * ne puissent pas dériver l'une de l'autre (`CLAUDE.md` §3).
 */
const TECHNIQUE_POUR_LE_CLIENT: Readonly<Record<string, string>> = {
  au_pied: "abattage au pied",
  demontage: "démontage",
  demontage_retention: "démontage en rétention",
};

function techniqueEcrite(cle: string | null | undefined): string | null {
  if (!cle) return null;
  const pourLeClient = TECHNIQUE_POUR_LE_CLIENT[cle];
  if (pourLeClient) return pourLeClient;
  // Une technique que le devis ne sait pas encore dire : on retombe sur le mot
  // du catalogue plutôt que de la taire.
  return TECHNIQUES_PAR_DEFAUT.find((t) => t.cle === cle)?.libelle ?? null;
}

/** La première lettre en capitale, le reste intact. */
function capitale(texte: string): string {
  return texte.length === 0 ? texte : texte[0].toLocaleUpperCase("fr") + texte.slice(1);
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
  if (valeurs.size === 0 && !p.methode) return base;

  // ── 1. Les parenthèses techniques s'en vont ─────────────────────────────
  //
  // Par la fin, et l'on s'arrête à la première qui apprend quelque chose.
  let reste = base;
  for (;;) {
    // `[\s\S]` plutôt que le drapeau `s` : le projet vise ES2017, où ce drapeau
    // n'existe pas. Un libellé sur plusieurs lignes — une ligne de devis en
    // réunit — resterait sinon intouché sans que rien ne le dise.
    const parenthese = reste.match(/^([\s\S]*?)\s*\(([^()]*)\)\s*$/);
    if (parenthese && seulementDesMesuresConnues(parenthese[2], valeurs, unites)) {
      reste = parenthese[1].trimEnd();
      continue;
    }
    break;
  }

  // ── 2. Le tiret devient une phrase ──────────────────────────────────────
  const tiret = reste.match(/^([\s\S]*\S)\s*[—–]\s*(\S[^—–]*)$/);
  if (tiret) {
    const tete = tiret[1].trim();
    const complement = sansLaQuantite(tiret[2], valeurs);
    if (complement.length === 0) {
      reste = tete;
    } else if (estUnGeste(tete)) {
      // « Dessouchage » + « souches de 60 cm »
      reste = `${tete} de ${complement.toLocaleLowerCase("fr")}`;
    } else if (estUnGeste(complement)) {
      // « démontage en rétention » + « Érable »
      reste = `${capitale(complement)} ${complementDe(tete)}`;
    }
    // Sinon : ni l'un ni l'autre n'est un geste connu — on ne rédige pas à
    // l'aveugle, et le texte reste ce qu'il était.
  }

  // ── 3. Le libellé s'ouvre-t-il sur son objet plutôt que sur le travail ? ─
  reste = nommerLeTravail(reste, p.nature);

  // ── 4. La technique, quand la colonne la porte et que le texte se tait ──
  //
  // On n'écrit jamais deux fois la même chose : un texte qui parle déjà de
  // démontage, de rétention ou d'abattage au pied n'est pas complété.
  const technique = techniqueEcrite(p.methode);
  if (technique && !estUnGeste(reste) && !/d[ée]mont|r[ée]tention|au\s+pied/i.test(reste)) {
    reste = `${capitale(technique)} ${complementDe(reste)}`;
  }

  // **Jamais un libellé vide.** Si tout ce que la prestation dit tenait dans
  // ses mesures — « 800 ml » et rien d'autre —, le client doit quand même lire
  // quelque chose : on rend alors le texte d'origine.
  const nettoye = reste.replace(/[\s,;:·]+$/u, "").trim();
  return nettoye.length > 0 ? capitale(nettoye) : base;
}
