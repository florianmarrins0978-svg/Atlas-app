/**
 * IMPORTER DEVIS ET FACTURES : les règles, sans base ni réseau.
 *
 * Sa demande du 22 octobre 2026 : déposer ses devis et factures, « d'un coup ou
 * un par un », jusqu'à dix ans de pièces, et que chaque client se crée ou se
 * retrouve tout seul. Maquette `appli/importer-ancienne-appli.html`, mesures et
 * décisions `docs/importer-devis-factures.md`.
 *
 * Une seule source pour l'écran (qui refuse avant d'envoyer) et pour le serveur
 * (qui refuse ce que l'écran aurait laissé passer) : deux copies des limites
 * finiraient par se contredire (`CLAUDE.md` §3).
 */

import { CIVILITES, aDejaUneCivilite, categorieDuClient, pastilleDuMot, type CategorieClient, type Civilite } from "./civilite";
import { normaliserAdresse, type LigneLue } from "./import-tableau";

/**
 * **2 000 documents ou 1 Go par envoi.** Ce qui borne vraiment, c'est l'envoi :
 * il demande l'appli ouverte, et 1 Go en 4G prend 15 à 30 minutes. Dix ans
 * tiennent en deux ou trois envois, « une année par envoi ».
 *
 * **15 Mo par document** : la limite de tout ce qui se dépose dans Atlas
 * (`src/server/upload-limits.ts`). Le zip s'ouvre sur le téléphone, et chaque
 * pièce part seule : le serveur ne reçoit jamais le zip entier.
 */
export const LIMITES_IMPORT = {
  documentsParEnvoi: 2000,
  octetsParEnvoi: 1_000_000_000,
  octetsParDocument: 15 * 1024 * 1024,
} as const;

/** La phrase qui refuse un envoi trop gros, ou `null`. */
export function refusDeLEnvoi(nombre: number, octets: number): string | null {
  if (nombre === 0) return "Aucun devis ni facture dans ce que vous avez choisi.";
  if (nombre > LIMITES_IMPORT.documentsParEnvoi) {
    return `Ce dossier en contient ${nombre.toLocaleString("fr-FR")}. Envoyez-en ${LIMITES_IMPORT.documentsParEnvoi.toLocaleString("fr-FR")} au plus à la fois, par exemple une année par envoi.`;
  }
  if (octets > LIMITES_IMPORT.octetsParEnvoi) {
    return "Ce dossier pèse plus de 1 Go. Envoyez-le en plusieurs fois, par exemple une année par envoi.";
  }
  return null;
}

export type FormatImport = "pdf" | "photo" | "zip";

/**
 * JPEG et PNG seulement : une photo importée est rangée DANS un PDF (une pièce
 * reste un PDF, sur la fiche comme dans « Tout télécharger »), et `pdf-lib`
 * n'intègre que ces deux-là. Le HEIC brut est déjà refusé par la porte commune
 * des photos (`photo-entrante.ts`) ; l'iPhone le convertit en JPEG à l'envoi.
 */
const PHOTOS = ["jpg", "jpeg", "png"];

/**
 * Ce qu'on sait importer, d'après le NOM du fichier : un zip ne porte pas
 * toujours son type, et une entrée de zip n'en porte aucun. Le serveur revérifie
 * la signature des octets avant de rien garder.
 */
export function formatDuFichier(nom: string): FormatImport | null {
  const ext = nom.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "zip") return "zip";
  if (PHOTOS.includes(ext)) return "photo";
  return null;
}

/**
 * Une entrée de zip qui n'est pas une pièce : un dossier, ou ce que macOS et
 * Windows glissent d'eux-mêmes (`__MACOSX/`, `._x.pdf`, `Thumbs.db`).
 */
export function entreeAIgnorer(chemin: string): boolean {
  const nom = chemin.split("/").pop() ?? "";
  return chemin.endsWith("/") || chemin.startsWith("__MACOSX/") || nom.startsWith("._") || nom.startsWith(".");
}

// ─── Lire les champs dans le texte d'un PDF ────────────────────────────────

export type ChampsLus = {
  genre: "devis" | "facture" | null;
  numero: string | null;
  /** AAAA-MM-JJ */
  jour: string | null;
  /** « 1250.00 » */
  montantTtc: string | null;
  nomLu: string | null;
  /**
   * Ce qu'un tableau donne en colonnes, pour que le PDF passe par le même écran
   * « Par client » et la même règle d'adresse (sa demande du 31 octobre 2026) :
   * « 8 rue du Port, 44120 Vertou », « 07 11 22 33 44 », et le lieu des travaux
   * quand il est écrit à part.
   */
  adresseLue: string | null;
  telephoneLu: string | null;
  chantierLu: string | null;
  /**
   * Le titre de la pièce, la ligne « Objet » (« Elagage ») : ce qu'un tableau
   * donne dans sa colonne Objet. Sa remarque du 3 novembre 2026 : *« objet et
   * titre, c'est la même chose »*, et la fiche ne montrait que le numéro.
   */
  objetLu: string | null;
};

export const RIEN_LU: ChampsLus = {
  genre: null,
  numero: null,
  jour: null,
  montantTtc: null,
  nomLu: null,
  adresseLue: null,
  telephoneLu: null,
  chantierLu: null,
  objetLu: null,
};

/**
 * Les titres en capitales espacées (« F A C T U R E ») redeviennent des mots :
 * c'est ainsi que beaucoup de logiciels, Atlas compris, impriment leurs titres.
 */
function recoller(texte: string): string {
  // La dernière capitale ne doit pas être suivie d'un point : « … X M. Vasseur »
  // garde son « M. », sans quoi le nom du client disparaît dans le titre.
  return texte.replace(/\b(?:\p{Lu} ){2,}\p{Lu}\b(?!\.)/gu, (m) => m.replace(/ /g, ""));
}

function jourIsoDe(j: string, m: string, a: string): string | null {
  const annee = a.length === 2 ? 2000 + Number(a) : Number(a);
  const mois = Number(m);
  const jour = Number(j);
  if (annee < 1990 || annee > 2100 || mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  if (d.getUTCDate() !== jour) return null;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** « 1 250,00 » → « 1250.00 » ; tout ce qui n'est pas un montant rend `null`. */
export function montantLu(brut: string): string | null {
  const net = brut.replace(/[\s  ]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  if (!/^\d{1,9}\.\d{2}$/.test(net)) return null;
  return net;
}

// ─── L'adresse et le téléphone du client, sans IA ──────────────────────────

const VOIES = [
  "rue", "avenue", "av.", "av", "boulevard", "bd", "bld", "chemin", "ch.", "allée", "allee", "impasse", "imp.", "place", "pl.",
  "route", "rte", "quai", "cours", "square", "faubourg", "fbg", "lieu-dit", "lotissement", "résidence", "residence", "hameau",
  "sentier", "passage", "mail", "esplanade", "promenade", "rond-point", "voie", "parc", "domaine", "clos", "cité", "cite",
];

/**
 * **Sans le drapeau `i`, et c'est le piège évité** : avec `iu`, `\p{Lu}` prend
 * aussi les minuscules, et la ville avalait toute la phrase qui la suit. Les
 * voies s'écrivent donc sous leurs trois formes (« rue », « Rue », « RUE »).
 */
const VOIES_ECRITES = VOIES.flatMap((v) => [v, v[0].toUpperCase() + v.slice(1), v.toUpperCase()])
  .map((v) => v.replace(/\./g, "\\."))
  .join("|");

/** « 8 rue du Port 44120 Vertou » : un numéro, une voie, un code postal, une ville. */
const ADRESSE = new RegExp(
  `(\\d{1,4}(?:\\s?(?:bis|ter|b|t))?,?\\s+(?:${VOIES_ECRITES})\\s+[\\p{L}'’.\\- ]{2,70}?),?\\s+(\\d{5})\\s+(\\p{Lu}[\\p{L}'’]*(?:[\\s-]+(?:\\p{Lu}[\\p{L}'’]*|sur|sous|en|le|la|les|de|du|des|lès|lez|et))*)`,
  "gu"
);

/**
 * La ville s'arrête au premier mot qui n'en est pas un : « Nantes Total TTC »,
 * « Nantes D É S I G N A T I O N » (une lettre seule), « Vertou Objet ».
 */
function villeSeule(brut: string): string | null {
  const mots = brut.split(/(\s+|-)/);
  const garde: string[] = [];
  for (const m of mots) {
    if (/^(\s+|-)$/.test(m)) {
      garde.push(m);
      continue;
    }
    const bas = m.toLowerCase();
    if (MOTS_DE_FACTURE.has(bas) || MOTS_APRES_LA_VILLE.has(bas) || (m.length === 1 && /\p{Lu}/u.test(m))) break;
    garde.push(m);
  }
  const ville = garde.join("").replace(/[\s-]+$/, "").trim();
  // Un mot de liaison ne finit pas une ville (« Saint-Julien de », coupé).
  return ville.replace(/(?:[\s-]+(?:sur|sous|en|le|la|les|de|du|des|lès|lez|et))+$/i, "").trim() || null;
}

/** Ce qu'un devis imprime après la ville, et que la ville ne doit pas avaler. */
const MOTS_APRES_LA_VILLE = new Set(["france", "portable", "mobile", "fixe", "intervention", "travaux", "chantier", "qté", "qte", "quantité", "prix", "unité", "unite"]);

/** Toutes les adresses d'un morceau de texte, écrites comme sur une fiche. */
function adressesDe(texte: string): string[] {
  const vues: string[] = [];
  for (const m of texte.matchAll(ADRESSE)) {
    const ville = villeSeule(m[3]);
    if (!ville) continue;
    vues.push(`${m[1].replace(/\s+/g, " ").replace(/,\s*$/, "").trim()}, ${m[2]} ${ville}`);
  }
  return vues;
}

const TELEPHONE = /(?<!\d)(?:\+33\s?|0)([1-9])(?:[\s.\-]?(\d{2})){4}(?!\d)/g;

/** « 0711223344 », « +33 7 11 22 33 44 » : « 07 11 22 33 44 ». */
function telephoneEcrit(brut: string): string {
  const chiffres = brut.replace(/\D/g, "").replace(/^33/, "0");
  return chiffres.replace(/(\d{2})(?=\d)/g, "$1 ");
}

/**
 * Jusqu'où, après le nom, on cherche le téléphone : le bloc du client. Au-delà
 * vient le corps du document, puis le pied, qui porte celui de l'artisan.
 */
const BLOC_DU_TELEPHONE = 160;

/**
 * L'adresse et le téléphone du client, lus APRÈS son nom, jamais devinés.
 *
 * **Zéro erreur sur une adresse** (sa règle du 28 octobre) : un devis imprime
 * côte à côte le client et le lieu des travaux, et le texte d'un PDF les
 * entremêle. Une seule adresse après le nom (ou deux fois la même) est la
 * sienne ; deux différentes, le texte ne choisit pas, et l'IA ou le patron le
 * diront. Ce qui précède le nom est l'en-tête de l'artisan : ni son adresse ni
 * son téléphone ne sont jamais ceux du client.
 */
function coordonneesApresLeNom(
  texte: string,
  place: { debut: number; fin: number } | null
): { adresseLue: string | null; telephoneLu: string | null } {
  if (!place) return { adresseLue: null, telephoneLu: null };
  const avant = texte.slice(0, place.debut);
  const apres = texte.slice(place.fin);

  const deLArtisan = new Set(adressesDe(avant).map(normaliserAdresse));
  const distinctes = new Map<string, string>();
  for (const a of adressesDe(apres)) {
    const n = normaliserAdresse(a);
    if (!deLArtisan.has(n) && !distinctes.has(n)) distinctes.set(n, a);
  }
  const adresseLue = distinctes.size === 1 ? [...distinctes.values()][0] : null;

  const telsDeLArtisan = new Set([...avant.matchAll(TELEPHONE)].map((m) => telephoneEcrit(m[0])));
  const proche = [...apres.slice(0, BLOC_DU_TELEPHONE).matchAll(TELEPHONE)].map((m) => telephoneEcrit(m[0])).find((t) => !telsDeLArtisan.has(t));
  return { adresseLue, telephoneLu: proche ?? null };
}

/** Ce qu'un devis imprime juste après son objet : l'en-tête du tableau des lignes. */
const APRES_L_OBJET = new Set([
  "désignation", "designation", "description", "qté", "qte", "quantité", "quantite", "prix", "pu", "unité", "unite",
  "total", "tva", "montant", "réf", "ref", "référence", "reference", "date", "client", "lieu", "n°", "article", "libellé", "libelle",
]);

/**
 * L'objet, lu sur sa ligne « Objet : … ». Il s'arrête au premier mot qui
 * n'en est plus (l'en-tête du tableau, « Désignation Qté ») ou à une lettre
 * seule en capitale (un titre espacé, « D É S I G N A T I O N »).
 * Huit mots au plus : au-delà, ce n'est plus un titre, c'est le devis.
 */
function objetDuTexte(plat: string): string | null {
  const m = /\bobjet\s*:\s*(.+)/i.exec(plat);
  if (!m) return null;
  const garde: string[] = [];
  for (const mot of m[1].split(/\s+/)) {
    const bas = mot.toLowerCase().replace(/[:.,;]+$/, "");
    if (APRES_L_OBJET.has(bas) || (mot.length === 1 && /\p{Lu}/u.test(mot)) || garde.length === 8) break;
    garde.push(mot);
  }
  const objet = garde.join(" ").replace(/[\s,;:.-]+$/, "").trim();
  return objet.length >= 2 ? objet.slice(0, 200) : null;
}

/**
 * Le texte suffit quand il dit ce qu'est la pièce, à qui elle va, et où ce
 * client habite. Sans l'adresse, l'IA lit le TEXTE (jamais l'image d'un PDF
 * qui a du texte) : c'est elle qui sait séparer le client du lieu des travaux.
 */
export function texteSuffit(c: ChampsLus): boolean {
  return !!(c.genre && c.numero && c.nomLu && c.adresseLue);
}

/** Les mots qu'un devis ou une facture imprime juste après le nom du client. */
const MOTS_DE_FACTURE = new Set([
  "total", "date", "adresse", "tél", "tel", "téléphone", "telephone", "email", "mail", "e-mail", "lieu", "désignation",
  "designation", "montant", "facture", "devis", "client", "objet", "réf", "ref", "référence", "reference", "rue", "avenue",
  "chemin", "allée", "allee", "boulevard", "bd", "place", "impasse", "route", "quai", "le", "la", "les", "du", "de", "des",
  "échéance", "echeance", "validité", "validite", "siret", "tva", "ht", "ttc", "page", "net", "acompte", "code", "n°",
]);

// ─── Le nom du client, sans IA (3 novembre 2026) ───────────────────────────
//
// Sa demande : *« Il faut que M tout court fonctionne. Il faut que MR
// fonctionne. Il faut que monsieur fonctionne. Pareil pour madame. […] Et pour
// les collectivités, et puis pour les entreprises et les services publics,
// c'est pareil. […] il faut juste reconnaître le nom à chaque fois. »* Puis
// *« dans la partie désignation, il n'y aura jamais le nom. Le nom se situe
// souvent en haut, à côté du nom de l'entreprise. »*
//
// **ZÉRO NOM FAUX, ET C'EST CE QUI DÉCIDE DE TOUT CE QUI SUIT.** Un nom inventé
// range une facture chez le mauvais client ; un nom qui manque passe par l'IA,
// puis par lui. Devant un doute, on rend donc `null`, jamais le plus probable.
//
// **La civilité et la catégorie se lisent par `civilite.ts`**, la règle de
// toute l'appli : une seconde liste ici aurait appris « Melle » sans que la
// fiche le sache, ou l'inverse (`CLAUDE.md` §3). Le nom rangé prend l'écriture
// de l'appli (« Mr. », migration 0037 ; « Mme »).

/** Sans accents ni casse : « RUE », « Rue » et « rue » sont le même mot. */
function aplatiMot(mot: string): string {
  return mot.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Un mot, un nombre ou un signe du texte, et sa place dans le texte. */
type Jeton = {
  /** Tel qu'écrit, sans son point final (« M. » donne « M »). */
  ecrit: string;
  bas: string;
  point: boolean;
  genre: "mot" | "nombre" | "signe";
  debut: number;
  fin: number;
};

/**
 * Un mot garde ses apostrophes et ses traits d'union (« D'Arc »,
 * « Dupont-Moreau », « L'R ») : coupé là, « Mme Dupont-Moreau » devenait
 * « Mme Dupont- ». Un nombre garde sa virgule : « 1,00 » est une quantité.
 */
const JETON = /(\p{L}+(?:['’]\p{L}+)*(?:-\p{L}+(?:['’]\p{L}+)*)*)(\.)?|(\d+(?:[.,]\d+)*)|(\S)/gu;

function jetonsDe(texte: string): Jeton[] {
  const jetons: Jeton[] = [];
  for (const m of texte.matchAll(JETON)) {
    const debut = m.index;
    if (m[1]) jetons.push({ ecrit: m[1], bas: aplatiMot(m[1]), point: !!m[2], genre: "mot", debut, fin: debut + m[1].length });
    else if (m[3]) jetons.push({ ecrit: m[3], bas: m[3], point: false, genre: "nombre", debut, fin: debut + m[3].length });
    else jetons.push({ ecrit: m[4], bas: m[4], point: false, genre: "signe", debut, fin: debut + m[4].length });
  }
  return jetons;
}

/**
 * **Le haut de la pièce, et lui seul** : sa règle, *« dans la partie
 * désignation, il n'y aura jamais le nom »*. Le tableau commence au premier
 * de ses titres, écrits aussi en capitales espacées (« D É S I G N A T I O N »,
 * comme Atlas les imprime). « Réf. » n'en est pas un : il se lit aussi en
 * haut (« Votre réf. »), et il précède toujours l'un de ceux-là.
 */
const TITRES_DU_TABLEAU = ["désignation", "quantité", "qté", "prix unitaire", "p.u. ht", "pu ht"];

/** « qté » lu aussi « QTE », « Q T É » : chaque lettre peut être suivie d'un espace. */
function lettresEspacables(titre: string): string {
  return [...titre].map((c) => (c === " " ? "\\s*" : c === "." ? "\\.?" : c === "é" ? "[eé]" : c)).join(" ?");
}

const DEBUT_DU_TABLEAU = new RegExp(`(?<!\\p{L})(?:${TITRES_DU_TABLEAU.map(lettresEspacables).join("|")})(?!\\p{L})`, "iu");

/**
 * Ce qui suit un nom quand c'est le cadre d'un client : une rue (son numéro
 * s'il en a un, puis des mots), un code postal, une ville. « Rue Saint Roch
 * 78490 Méré », « Hameau du Saut du Loup le Breuil 78890 Garancières ».
 *
 * **Au moins un mot avant le code postal** : un nom suivi du seul « 78490
 * Méré » a pu avaler son lieu-dit (« Mairie de Méré Le Bourg »), et c'est ce
 * qui le départage. Aucun chiffre entre le nom et le code postal, hors le
 * numéro de la rue : une ligne du tableau porte des prix.
 */
const ADRESSE_QUI_SUIT = /^[\s,;:\-]*(?:\d{1,4}(?:\s?(?:bis|ter|[A-Za-z]))?\b[\s,]+)?(?:[\p{L}'’.\-]+[\s,]+){1,10}?\d{5}\s+\p{Lu}/u;

function suiviDUneAdresse(texte: string, fin: number): boolean {
  return ADRESSE_QUI_SUIT.test(texte.slice(fin, fin + 160));
}

/** Un code postal et sa ville AVANT ce point : l'en-tête de l'artisan est passé. */
function adresseAvant(texte: string, debut: number): boolean {
  return /\b\d{5}\s+\p{Lu}/u.test(texte.slice(0, debut));
}

/** Ses mentions légales, qui suivent son en-tête et jamais le cadre du client. */
function mentionsDeLArtisanApres(texte: string, fin: number, finDuHaut: number): boolean {
  return /\b(?:SIRET|SIREN|RCS|APE|NAF|capital)\b/i.test(texte.slice(fin, Math.min(fin + 200, finDuHaut)));
}

/** Ce qui lie les mots d'un nom sans en être un : « Le Gall », « de La Fontaine ». */
const PARTICULES = new Set(["de", "du", "des", "la", "le", "les", "van", "von", "der", "den", "di", "da", "del", "dos"]);

/**
 * Une particule en capitale APRÈS le premier mot ouvre peut-être autre chose
 * que le nom : « Mme Dupont Le Bourg » est Mme Dupont, au lieu-dit Le Bourg ;
 * « Mme Marie-Claire Le Gall » est Mme Le Gall. Seule l'adresse qui suit
 * départage les deux lectures.
 */
const PARTICULES_QUI_COUPENT = new Set(["le", "la", "les", "de", "du", "des"]);

/** Ce qui lie les mots d'une raison sociale : « Dupont et Fils », « Sud Estuaire ». */
const LIAISONS = new Set([...PARTICULES, "et", "en", "sur", "sous", "aux", "au", "a", "&"]);

/**
 * Les mots qui ne sont jamais un nom : ce que le cadre d'un client imprime
 * autour de lui (les libellés, les voies, le pays), et les titres du document.
 */
const NOMS_INTERDITS = new Set(
  [
    ...MOTS_DE_FACTURE,
    ...MOTS_APRES_LA_VILLE,
    ...VOIES.map((v) => v.replace(/\.$/, "")),
    "destinataire", "contact", "attention", "pour", "chez", "bon", "accord", "signature", "fax", "courriel", "siren",
    "ape", "naf", "rcs", "capital", "iban", "bic", "commande", "nom", "prenom", "cp", "bp", "cedex", "postal", "numero",
    "votre", "notre", "vos", "nos", "affaire", "suivie", "dossier", "conditions", "reglement", "paiement", "remise",
    "description", "libelle", "unitaire",
  ].map(aplatiMot)
);

function lettresDe(j: Jeton): number {
  return j.bas.replace(/[^a-z]/g, "").length;
}

function commenceParUneCapitale(j: Jeton): boolean {
  return /^\p{Lu}/u.test(j.ecrit) || /^[dl]['’]\p{Lu}/u.test(j.ecrit);
}

function estParticule(j: Jeton | undefined): boolean {
  return !!j && j.genre === "mot" && PARTICULES.has(j.bas);
}

/** Un mot qui peut être un nom, de personne ou de raison sociale. */
function estMotEnCapitale(j: Jeton | undefined): boolean {
  if (!j || j.genre !== "mot" || !commenceParUneCapitale(j)) return false;
  if (PARTICULES.has(j.bas)) return true;
  return lettresDe(j) >= 2 && !NOMS_INTERDITS.has(j.bas) && !aDejaUneCivilite(j.ecrit);
}

/**
 * Les mots de « SA » et « EI » ne comptent qu'en capitales : en minuscules,
 * « sa » est un mot de la langue, pas une forme juridique.
 */
function categorieDesJetons(jetons: readonly Jeton[]): CategorieClient {
  return categorieDuClient(
    jetons
      .filter((j) => j.genre === "mot" && (lettresDe(j) > 2 || j.ecrit === j.ecrit.toUpperCase()))
      .map((j) => j.ecrit)
      .join(" ")
  );
}

/** Un mot de nom de PERSONNE : ni une particule seule, ni une forme juridique. */
function estMotDeNom(j: Jeton | undefined): boolean {
  return !!j && estMotEnCapitale(j) && !PARTICULES.has(j.bas) && categorieDesJetons([j]) === "particulier";
}

/** Les mots d'un nom tels qu'on les compare, sans civilité ni forme juridique. */
function motsDuNom(nom: string): string[] {
  return aplatiMot(nom)
    .split(/[^0-9a-z]+/)
    .filter((m) => m && !aDejaUneCivilite(m) && categorieDuClient(m) === "particulier");
}

/**
 * **Jamais le nom de l'artisan**, qui émet la pièce. Son en-tête imprime le nom
 * de son entreprise, souvent avec sa forme juridique (« EURL L'R DE L'ARBRE ») :
 * un nom qui CONTIENT le sien est le sien.
 */
function estDeLArtisan(mots: readonly string[], artisan: readonly string[]): boolean {
  return artisan.length > 0 && ` ${mots.join(" ")} `.includes(` ${artisan.join(" ")} `);
}

/**
 * Où le nom peut finir : après tous ses mots, ou juste avant une particule en
 * capitale qui ouvre peut-être autre chose (`PARTICULES_QUI_COUPENT`).
 */
function finDuNomParLAdresse(texte: string, jetons: readonly Jeton[], fins: readonly number[]): { fin: number; doute: boolean } {
  if (fins.length === 1) return { fin: fins[0], doute: false };
  const valables = fins.filter((f) => suiviDUneAdresse(texte, jetons[f - 1].fin));
  return valables.length === 1 ? { fin: valables[0], doute: false } : { fin: fins[fins.length - 1], doute: true };
}

/**
 * Le nom d'une personne, à partir de son premier mot : un ou deux groupes (le
 * nom et le prénom, dans un ordre ou l'autre), chacun avec ses particules.
 * Un troisième mot fait douter : « M. Jean Pierre Dupont » coupé à deux mots
 * serait un nom faux.
 */
function nomDePersonne(jetons: readonly Jeton[], debut: number): { fins: number[]; doute: boolean } | null {
  const fins: number[] = [];
  let k = debut;
  for (let groupe = 0; groupe < 2; groupe++) {
    let p = k;
    while (estParticule(jetons[p]) && p < k + 3) p++;
    if (!estMotDeNom(jetons[p])) break;
    if (groupe === 1 && p > k && PARTICULES_QUI_COUPENT.has(jetons[k].bas) && commenceParUneCapitale(jetons[k])) fins.push(k);
    k = p + 1;
  }
  if (k === debut) return null;
  fins.push(k);
  let p = k;
  while (estParticule(jetons[p]) && !commenceParUneCapitale(jetons[p]) && p < k + 3) p++;
  return { fins, doute: estMotDeNom(jetons[p]) };
}

/** Une raison sociale ou une collectivité : une suite de mots qui commence en capitale. */
type Suite = { debut: number; fin: number; coupures: number[] };

function suitesDeMots(jetons: readonly Jeton[]): Suite[] {
  const suites: Suite[] = [];
  let i = 0;
  while (i < jetons.length) {
    if (!estMotEnCapitale(jetons[i])) {
      i++;
      continue;
    }
    const debut = i;
    const coupures: number[] = [];
    let fin = i + 1;
    let k = i + 1;
    while (k < jetons.length && k - debut < 12) {
      const j = jetons[k];
      if (estMotEnCapitale(j)) {
        const suivant = jetons[k + 1];
        if (PARTICULES_QUI_COUPENT.has(j.bas) && suivant && estMotEnCapitale(suivant) && !PARTICULES.has(suivant.bas)) coupures.push(k);
        fin = ++k;
      } else if ((j.genre === "mot" && LIAISONS.has(j.bas)) || j.ecrit === "&") {
        k++;
      } else if (j.genre === "mot" && lettresDe(j) >= 2 && !NOMS_INTERDITS.has(j.bas) && !aDejaUneCivilite(j.ecrit)) {
        // « Communauté de communes », « Syndicat intercommunal des eaux ».
        fin = ++k;
      } else break;
    }
    suites.push({ debut, fin, coupures });
    i = Math.max(k, i + 1);
  }
  return suites;
}

/** Un mot d'une suite qui n'est ni une particule ni une forme juridique : le nom lui-même. */
function aUnNomPropre(jetons: readonly Jeton[], debut: number, fin: number): boolean {
  return jetons.slice(debut, fin).some((j) => estMotDeNom(j));
}

type Candidat = { nom: string; debut: number; fin: number; mots: string[]; personne: Civilite[] | null };

/**
 * LE CLIENT DE LA PIÈCE, ou `null`.
 *
 * **Une personne** se reconnaît à sa civilité, sous toutes ses écritures
 * (`pastilleDuMot`). « M », « MR » et « MM » sans point sont aussi des unités
 * (« 1,00 M Grillage », « 12 MM Gravier ») : écrits ainsi, ils ne comptent que
 * suivis d'une adresse, et jamais après une quantité. C'est la règle la plus
 * sûre, et elle vaut avec ou sans tableau trouvé : le cadre d'un client porte
 * toujours son adresse, une ligne du tableau jamais.
 *
 * **Une entreprise ou une collectivité** se reconnaît à ses mots
 * (`categorieDuClient`), et seulement dans le cadre d'un client : suivie
 * d'une adresse, APRÈS l'en-tête de l'artisan (une adresse plus haut), sans ses
 * mentions légales derrière. L'en-tête de l'artisan porte souvent sa propre
 * forme juridique : c'est le piège principal, et ces trois conditions le
 * tiennent même quand son nom est inconnu.
 *
 * **Deux noms qui ne s'accordent pas, ou un doute : `null`.** « Sanchez » puis
 * « Mme Sanchez Emmanuelle » ne font qu'une personne, et elle l'emporte : le
 * nom seul n'a pas de civilité, il n'est pas lu.
 */
function clientDuTexte(texte: string, artisan: string | null): Candidat | null {
  const tableau = DEBUT_DU_TABLEAU.exec(texte);
  const finDuHaut = tableau ? tableau.index : texte.length;
  const jetons = jetonsDe(texte.slice(0, finDuHaut));
  const sesMots = artisan ? motsDuNom(artisan) : [];
  const candidats: Candidat[] = [];
  let doute = false;

  const suites = suitesDeMots(jetons).filter((s) => categorieDesJetons(jetons.slice(s.debut, s.fin)) !== "particulier");

  for (const s of suites) {
    let debut = s.debut;
    let incertain = false;
    // Juste après un code postal, les premiers mots sont peut-être la ville :
    // la raison sociale commence alors à sa forme juridique, ou on ne sait pas.
    const avant = jetons[debut - 1];
    if (avant?.genre === "nombre" && /^\d{5}$/.test(avant.ecrit)) {
      const forme = jetons.slice(debut, s.fin).findIndex((j) => categorieDesJetons([j]) !== "particulier");
      if (forme > 0 && aUnNomPropre(jetons, debut + forme + 1, s.fin)) debut += forme;
      else if (forme > 0) incertain = true;
    }
    const fins = [...s.coupures.filter((c) => c > debut), s.fin].filter(
      (f) => aUnNomPropre(jetons, debut, f) && categorieDesJetons(jetons.slice(debut, f)) !== "particulier"
    );
    const avecAdresse = fins.filter((f) => suiviDUneAdresse(texte, jetons[f - 1].fin));
    if (avecAdresse.length === 0) continue;
    const fin = avecAdresse[0];
    const nom = texte.slice(jetons[debut].debut, jetons[fin - 1].fin);
    const mots = motsDuNom(nom);
    if (!adresseAvant(texte, jetons[debut].debut)) continue;
    if (estDeLArtisan(mots, sesMots)) continue;
    if (mentionsDeLArtisanApres(texte, jetons[fin - 1].fin, finDuHaut)) continue;
    if (incertain || avecAdresse.length > 1) doute = true;
    else candidats.push({ nom, debut: jetons[debut].debut, fin: jetons[fin - 1].fin, mots, personne: null });
  }

  for (let i = 0; i < jetons.length; i++) {
    const j = jetons[i];
    if (j.genre !== "mot" || !/^\p{Lu}/u.test(j.ecrit)) continue;
    const premiere = pastilleDuMot(j.ecrit);
    if (!premiere) continue;
    const civilites: Civilite[] = [premiere];
    let ambigu = !j.point && ["m", "mr", "mm"].includes(j.bas);
    let debutDuNom = i + 1;
    const lien = jetons[i + 1];
    const seconde = jetons[i + 2] && /^\p{Lu}/u.test(jetons[i + 2].ecrit) ? pastilleDuMot(jetons[i + 2].ecrit) : null;
    if (lien && (lien.bas === "et" || lien.ecrit === "&") && seconde) {
      civilites.push(seconde);
      ambigu &&= !jetons[i + 2].point && ["m", "mr", "mm"].includes(jetons[i + 2].bas);
      debutDuNom = i + 3;
    }
    const lu = nomDePersonne(jetons, debutDuNom);
    if (!lu) continue;
    const { fin, doute: coupe } = finDuNomParLAdresse(texte, jetons, lu.fins);
    const finDuNom = jetons[fin - 1].fin;
    if (ambigu) {
      const precedent = jetons[i - 1];
      if (precedent?.genre === "nombre" && /[.,]/.test(precedent.ecrit)) continue;
      if (!suiviDUneAdresse(texte, finDuNom)) continue;
    }
    const nom = texte.slice(jetons[debutDuNom].debut, finDuNom);
    const mots = motsDuNom(nom);
    if (estDeLArtisan(mots, sesMots)) continue;
    // Une raison sociale juste au-dessus, dans le même cadre : la personne est
    // peut-être son contact, et le client l'entreprise. Le texte ne tranche pas.
    let dernierNombre = -1;
    for (let k = i - 1; k >= 0 && dernierNombre < 0; k--) if (jetons[k].genre === "nombre") dernierNombre = k;
    const voisine = suites.some(
      (s) => s.debut > dernierNombre && s.fin <= i && !estDeLArtisan(motsDuNom(texte.slice(jetons[s.debut].debut, jetons[s.fin - 1].fin)), sesMots)
    );
    if (lu.doute || coupe || voisine) {
      doute = true;
      continue;
    }
    const ecrite = civilites.map((c) => CIVILITES[c]).join(" et ");
    candidats.push({ nom: `${ecrite} ${nom}`, debut: j.debut, fin: finDuNom, mots, personne: civilites });
    i = fin - 1;
  }

  if (doute || candidats.length === 0) return null;
  const [premier, ...autres] = candidats.sort((a, b) => a.debut - b.debut);
  const inclus = (a: readonly string[], b: readonly string[]) => a.every((m) => b.includes(m));
  const memeNom = (a: Candidat, b: Candidat) => inclus(a.mots, b.mots) || inclus(b.mots, a.mots);
  const memeCivilite = (a: Candidat, b: Candidat) =>
    !a.personne || !b.personne ? !a.personne && !b.personne : inclus(a.personne, b.personne) || inclus(b.personne, a.personne);
  return autres.every((c) => memeNom(premier, c) && memeCivilite(premier, c)) ? premier : null;
}

/**
 * Ce que le texte d'un PDF dit de lui-même, SANS IA : gratuit, et 77 ms par
 * document (mesuré le 22 octobre 2026 sur les pièces d'Atlas).
 *
 * **Rien ne se devine.** Un champ qui ne se lit pas reste `null` : la pièce
 * passe alors par l'IA, puis, à défaut, par « à vérifier ».
 *
 * `artisan` : le nom de son entreprise dans Atlas, que l'en-tête de ses
 * pièces imprime et qui n'est jamais celui du client (`clientDuTexte`).
 */
export function lireChampsDuTexte(brut: string, artisan: string | null = null): ChampsLus {
  const plat = brut.replace(/\s+/g, " ");
  const texte = recoller(plat);

  // Le genre et le numéro se lisent ENSEMBLE : une facture d'Atlas cite aussi
  // « Devis 2026-0001 », et c'est le mot suivi de « n° » qui dit ce qu'elle est.
  const titre = /\b(FACTURE|DEVIS)\s*(?:n°|nº|no\.?|num(?:éro)?\.?|N°)\s*:?\s*([A-Z0-9][A-Z0-9\-\/_.]{1,30})/i.exec(texte);
  const genre = titre ? (titre[1].toLowerCase() === "facture" ? "facture" : "devis") : null;
  const numero = titre ? titre[2].replace(/[.\-_/]+$/, "") : null;

  const date = /\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b/.exec(texte);
  const jour = date ? jourIsoDe(date[1], date[2], date[3]) : null;

  // Le DERNIER « Total TTC » ou « Net à payer » : les lignes en portent parfois un.
  let montantTtc: string | null = null;
  for (const m of texte.matchAll(/(?:total\s*TTC|net\s*à\s*payer|montant\s*TTC)\s*:?\s*(?:€\s*)?(\d[\d\s  .]*,\d{2}|\d+\.\d{2})/gi)) {
    montantTtc = montantLu(m[1]) ?? montantTtc;
  }

  // Le nom se cherche AVANT le recollage : recollées, les capitales espacées
  // d'un titre de tableau (« D É S I G N A T I O N ») deviennent un mot qui se
  // colle au nom (« M. Bernard DÉSIGNATION », 22 octobre 2026). Espacées, ce
  // ne sont que des lettres seules, qu'aucun nom ne prend.
  const client = clientDuTexte(plat, artisan);
  return {
    genre,
    numero,
    jour,
    montantTtc,
    nomLu: client?.nom ?? null,
    ...coordonneesApresLeNom(plat, client),
    chantierLu: null,
    objetLu: objetDuTexte(plat),
  };
}

/**
 * Deux lectures, une pièce : celle de l'IA d'abord, le texte pour ce qu'elle
 * n'a pas dit. Aucune des deux n'écrase une valeur par du vide.
 */
export function fusionnerLectures(ia: ChampsLus | null, texte: ChampsLus): ChampsLus {
  if (!ia) return texte;
  return {
    genre: ia.genre ?? texte.genre,
    numero: ia.numero ?? texte.numero,
    jour: ia.jour ?? texte.jour,
    montantTtc: ia.montantTtc ?? texte.montantTtc,
    nomLu: ia.nomLu ?? texte.nomLu,
    adresseLue: ia.adresseLue ?? texte.adresseLue,
    telephoneLu: ia.telephoneLu ?? texte.telephoneLu,
    chantierLu: ia.chantierLu ?? texte.chantierLu,
    objetLu: ia.objetLu ?? texte.objetLu,
  };
}

/** Une pièce se range seule quand on sait ce qu'elle est et à qui elle va. */
export function statutApresLecture(c: ChampsLus): "lue" | "a_verifier" {
  return c.genre && c.nomLu ? "lue" : "a_verifier";
}

/**
 * Relire la réponse JSON de l'IA. Tout ce qui ne passe pas la forme attendue
 * vaut `null` : un nom inventé rangerait une facture chez le mauvais client.
 */
export function relireReponseIA(texte: string): ChampsLus | null {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return null;
  let brut: unknown;
  try {
    brut = JSON.parse(texte.slice(debut, fin + 1));
  } catch {
    return null;
  }
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const chaine = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() && v.trim().length <= max ? v.replace(/\s+/g, " ").trim() : null;
  const genre = o.genre === "facture" || o.genre === "devis" ? o.genre : null;
  const jourBrut = chaine(o.date, 10);
  const jour = jourBrut && /^\d{4}-\d{2}-\d{2}$/.test(jourBrut) ? jourIsoDe(jourBrut.slice(8), jourBrut.slice(5, 7), jourBrut.slice(0, 4)) : null;
  const montant = chaine(o.montant_ttc, 20);
  const telephone = chaine(o.telephone, 30);
  const adresse = chaine(o.adresse, 300);
  const chantier = chaine(o.chantier, 300);
  return {
    genre,
    numero: chaine(o.numero, 40),
    jour,
    montantTtc: montant ? montantLu(montant) : null,
    nomLu: chaine(o.client, 120),
    adresseLue: adresse,
    // Un numéro qui n'en est pas un ne rapproche personne : il en séparerait deux.
    telephoneLu: telephone && /^(?:\+33\s?|0)[1-9](?:[\s.\-]?\d{2}){4}$/.test(telephone) ? telephoneEcrit(telephone) : null,
    // Le lieu des travaux qui redit l'adresse du client n'en est pas un autre.
    chantierLu: chantier && (!adresse || normaliserAdresse(chantier) !== normaliserAdresse(adresse)) ? chantier : null,
    objetLu: chaine(o.objet, 200),
  };
}

// ─── Les PDF au même écran que les tableaux (31 octobre 2026) ──────────────

/** Ce que la lecture a gardé d'un PDF : ce que l'écran « Par client » reçoit. */
export type PieceLueDuPdf = {
  id: string;
  genre: "devis" | "facture" | null;
  numero: string | null;
  jour: string | null;
  montantTtc: string | null;
  nomLu: string | null;
  adresseLue: string | null;
  telephoneLu: string | null;
  chantierLu: string | null;
  objetLu: string | null;
};

/**
 * Des PDF lus deviennent des lignes de tableau, pour passer par LA MÊME règle
 * (`grouperParClient`, `planDeRangement`) : sa demande du 31 octobre 2026,
 * *« que ça soit un CSV, Excel ou un PDF, il faut que ça soit la même chose »*.
 * Deux règles de rangement finiraient par ne plus ranger pareil (`CLAUDE.md` §3).
 *
 * **Le rang est la place dans la liste reçue** : l'écran et le serveur
 * appellent cette fonction sur les mêmes pièces dans le même ordre, et
 * `idDuRang` ramène chaque pièce du plan à son PDF.
 *
 * Un PDF dont le genre ne s'est pas lu attend sa réponse (`genres`) : une ligne
 * de tableau est toujours un devis ou une facture, et ne se range pas sans.
 */
export function lignesDesPdf(
  pieces: readonly PieceLueDuPdf[],
  genres: Readonly<Record<string, "devis" | "facture">>
): { lignes: LigneLue[]; sansGenre: PieceLueDuPdf[]; idDuRang: Map<number, string> } {
  const lignes: LigneLue[] = [];
  const sansGenre: PieceLueDuPdf[] = [];
  const idDuRang = new Map<number, string>();
  pieces.forEach((p, i) => {
    const rang = i + 1;
    idDuRang.set(rang, p.id);
    const genre = p.genre ?? genres[p.id] ?? null;
    if (!genre) {
      sansGenre.push(p);
      return;
    }
    lignes.push({
      rang,
      genre,
      numero: p.numero,
      objet: p.objetLu,
      jour: p.jour,
      montant: p.montantTtc,
      nom: p.nomLu,
      adresse: p.adresseLue,
      telephone: p.telephoneLu,
      chantier: p.chantierLu,
    });
  });
  return { lignes, sansGenre, idDuRang };
}

// ─── Ce que l'écran d'import reprend (3 novembre 2026) ────────────────────

/**
 * L'envoi que l'écran d'import reprend en s'ouvrant, ou `null`.
 *
 * Un envoi arrivé en entier et pas encore rangé ; **ou ce qu'un rangement a
 * laissé**, un nom illisible par exemple, une fois ses six secondes
 * d'« Annuler » passées. Son import du 3 novembre 2026 avait rangé 48 pièces
 * sur 51 : les trois devis restés n'avaient plus d'autre trace qu'un bandeau
 * bloqué, parce que cet écran ne reprenait qu'un envoi jamais rangé.
 *
 * Les comptes sont ceux de ce qui RESTE (`envoiEnCours`) : les pièces déjà
 * rangées n'y entrent plus. Pendant « Annuler », rien ne se reprend : le
 * rangement n'est pas encore acquis.
 */
export function envoiAReprendre(
  etat: { id: string; annulableMs: number | null; recues: number; attendues: number } | null
): string | null {
  if (!etat || etat.annulableMs !== null) return null;
  return etat.recues > 0 && etat.recues >= etat.attendues ? etat.id : null;
}
