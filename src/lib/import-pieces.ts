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

const CIVILITES: Record<string, string> = { m: "M.", monsieur: "M.", mme: "Mme", madame: "Mme", mlle: "Mme", mademoiselle: "Mme" };

/**
 * Le nom du client, quand il est précédé d'une civilité : « Mme Aubry »,
 * « Monsieur Jean Vasseur ». Un nom d'entreprise (« SARL Les Jardins ») ne se
 * devine pas ici : il reste vide, et l'IA ou le patron le donnera.
 */
function nomAvecCivilite(texte: string): string | null {
  return nomEtPlace(texte)?.nom ?? null;
}

/** Le nom du client, et où il finit dans le texte : son adresse se cherche APRÈS. */
function nomEtPlace(texte: string): { nom: string; debut: number; fin: number } | null {
  const m = /(?:^|[\s,;:(])(M\.|Mme|Mlle|Monsieur|Madame|Mademoiselle)\s+((?:\p{Lu}[\p{Ll}'’-]+|\p{Lu}{2,})(?:\s+(?:\p{Lu}[\p{Ll}'’-]+|\p{Lu}{2,}))?)/u.exec(texte);
  if (!m) return null;
  const civilite = CIVILITES[m[1].replace(".", "").toLowerCase()] ?? m[1];
  // Le second mot n'est un prénom que s'il n'est pas le premier mot de la
  // ligne suivante : le texte d'un PDF met « M. Martins » et « Total TTC » bout
  // à bout, et « M. Martins Total » fabriquait un client en double
  // (`test-pieces-importees-db.ts`, 22 octobre 2026).
  const [nom, second] = m[2].trim().split(/\s+/);
  if (MOTS_DE_FACTURE.has(nom.toLowerCase())) return null;
  const garde = second && !MOTS_DE_FACTURE.has(second.toLowerCase()) ? `${nom} ${second}` : nom;
  const debut = m.index + m[0].indexOf(m[1]);
  // La fin du nom GARDÉ : un « Total » écarté reste à lire après lui.
  const fin = texte.indexOf(garde, debut) + garde.length;
  return { nom: `${civilite} ${garde}`, debut, fin };
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
function coordonneesApresLeNom(texte: string): { adresseLue: string | null; telephoneLu: string | null } {
  const place = nomEtPlace(texte);
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

/**
 * Ce que le texte d'un PDF dit de lui-même, SANS IA : gratuit, et 77 ms par
 * document (mesuré le 22 octobre 2026 sur les pièces d'Atlas).
 *
 * **Rien ne se devine.** Un champ qui ne se lit pas reste `null` : la pièce
 * passe alors par l'IA, puis, à défaut, par « à vérifier ».
 */
export function lireChampsDuTexte(brut: string): ChampsLus {
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
  return { genre, numero, jour, montantTtc, nomLu: nomAvecCivilite(plat), ...coordonneesApresLeNom(plat), chantierLu: null };
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
      objet: null,
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
