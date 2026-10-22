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
};

export const RIEN_LU: ChampsLus = { genre: null, numero: null, jour: null, montantTtc: null, nomLu: null };

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
  return `${civilite} ${garde}`;
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
  return { genre, numero, jour, montantTtc, nomLu: nomAvecCivilite(plat) };
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
  return {
    genre,
    numero: chaine(o.numero, 40),
    jour,
    montantTtc: montant ? montantLu(montant) : null,
    nomLu: chaine(o.client, 120),
  };
}
