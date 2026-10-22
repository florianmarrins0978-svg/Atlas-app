import { PDFDocument } from "pdf-lib";
import { getFournisseurLLM, getFournisseurVision } from "../ai/providers/llm/fabrique";
import { logger } from "../logger";
import {
  fusionnerLectures,
  lireChampsDuTexte,
  relireReponseIA,
  RIEN_LU,
  type ChampsLus,
} from "../../lib/import-pieces";

/**
 * LIRE UNE PIÈCE IMPORTÉE : le texte d'abord, l'IA ensuite.
 *
 * **Le texte, sans IA.** Un PDF sorti d'un logiciel porte son texte : on le lit
 * en 77 ms, gratuitement (`docs/importer-devis-factures.md`). Quand ce texte
 * dit déjà le genre, le numéro, la date, le montant et le client, aucun appel
 * ne part.
 *
 * **L'IA sur le TEXTE quand il manque un champ** (la mise en page d'un autre
 * logiciel cache le nom du client sans civilité), et **sur l'IMAGE seulement
 * pour un scan** sans texte. C'est la clé de l'artisan qui paie : on n'envoie
 * l'image que quand rien d'autre ne marche.
 *
 * **L'appel au fournisseur n'est pas éprouvé ici** : ce poste n'a aucune clé.
 * La relecture de sa réponse l'est (`scripts/test-import-pieces.ts`).
 */

const SYSTEME = `Tu lis un devis ou une facture qu'un artisan a envoyé à son client.
Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code :
{"genre": "devis"|"facture"|null, "numero": string|null, "date": "AAAA-MM-JJ"|null, "montant_ttc": string|null, "client": string|null}
Règles :
- client : le nom du client destinataire tel qu'il est écrit (« Mme Aubry », « SARL Les Jardins »), jamais celui de l'artisan qui émet le document.
- montant_ttc : le total TTC à payer, avec la virgule ou le point tel quel.
- date : la date du document, pas l'échéance.
- Tu ne DEVINES jamais : une valeur illisible ou absente vaut null.`;

const CONSIGNE = "Lis ce document et rends l'objet JSON demandé.";

/** Au-delà, le texte n'apprend plus rien : l'en-tête et le total sont en haut et en bas. */
const TEXTE_MAX = 6000;

/**
 * **pdfjs, un document à la fois.** Quatre pièces lues ensemble dans le même
 * serveur se marchent dessus : « Invalid page request », deux pièces sur sept
 * au premier essai du 22 octobre 2026, lues sans rien trouver. Le texte prend
 * 80 ms ; c'est l'IA, plus lente, qui reste en parallèle.
 */
let filePdfjs: Promise<unknown> = Promise.resolve();
function unAUn<T>(travail: () => Promise<T>): Promise<T> {
  const suite = filePdfjs.then(travail, travail);
  filePdfjs = suite.catch(() => undefined);
  return suite;
}

export function extraireTexte(octets: Uint8Array): Promise<string> {
  return unAUn(() => extraireTexteSeul(octets));
}

async function extraireTexteSeul(octets: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: octets.slice(), disableFontFace: true, isEvalSupported: false }).promise;
  try {
    let texte = "";
    // Trois pages suffisent : le client est en tête, le total en fin de première ou deuxième.
    for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
      const contenu = await (await doc.getPage(i)).getTextContent();
      texte += contenu.items.map((x) => ("str" in x ? x.str : "")).join(" ") + "\n";
    }
    return texte;
  } finally {
    await doc.destroy();
  }
}

async function demanderAuTexte(texte: string): Promise<ChampsLus | null> {
  const r = await getFournisseurLLM().genererTexte(SYSTEME, `${CONSIGNE}\n\n${texte.slice(0, TEXTE_MAX)}`);
  return r.succes ? relireReponseIA(r.texte) : null;
}

async function demanderAuScan(octets: Uint8Array): Promise<ChampsLus | null> {
  const vision = getFournisseurVision();
  if (!vision.lireImages) return null;
  const r = await vision.lireImages(SYSTEME, CONSIGNE, [{ base64: Buffer.from(octets).toString("base64"), mimeType: "application/pdf" }], {
    maxTokens: 400,
  });
  return r.succes ? relireReponseIA(r.texte) : null;
}

/**
 * Ce qu'on sait d'une pièce. Une panne de l'IA ne fait pas tomber la lecture :
 * elle se journalise, et la pièce passe en « à vérifier » avec ce que le texte
 * a dit.
 */
export async function lirePiece(octets: Uint8Array): Promise<ChampsLus> {
  let texte = "";
  try {
    texte = await extraireTexte(octets);
  } catch (err) {
    logger.warn("Texte d'une pièce importée illisible", { erreur: err instanceof Error ? err.message : String(err) });
  }
  const parLeTexte = texte.trim().length > 50 ? lireChampsDuTexte(texte) : RIEN_LU;
  const complet = parLeTexte.genre && parLeTexte.numero && parLeTexte.nomLu;
  if (complet) return parLeTexte;

  try {
    const ia = texte.trim().length > 50 ? await demanderAuTexte(texte) : await demanderAuScan(octets);
    return fusionnerLectures(ia, parLeTexte);
  } catch (err) {
    logger.error("Lecture d'une pièce importée par l'IA impossible", { erreur: err instanceof Error ? err.message : String(err) });
    return parLeTexte;
  }
}

/**
 * Une photo devient un PDF d'une page à sa taille : une pièce reste un PDF,
 * sur la fiche comme dans « Tout télécharger ». La photo arrive ici DÉJÀ
 * nettoyée de ses métadonnées (`preparerPhotoEntrante`).
 */
export async function photoEnPdf(octets: Uint8Array, mimeType: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const image = mimeType === "image/png" ? await doc.embedPng(octets) : await doc.embedJpg(octets);
  const page = doc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return doc.save();
}

/**
 * Un PDF se garde s'il s'ouvre. Pas de plafond de pages ici, à l'inverse de
 * l'attestation (`attestation-deposee.ts`) : une facture d'un autre logiciel
 * peut en compter plusieurs.
 *
 * **pdfjs et non pdf-lib, et c'est ce qui sépare les deux « protections ».**
 * Atlas, comme beaucoup de logiciels de facturation, protège ses PDF contre la
 * MODIFICATION, sans mot de passe pour les ouvrir (`proteger-pdf.ts`). pdf-lib
 * les prend pour des PDF verrouillés et les refusait tous : six factures d'Atlas
 * sur six, au premier essai du 22 octobre 2026. pdfjs les ouvre, et ne lève
 * `PasswordException` que pour un vrai mot de passe d'ouverture.
 */
export async function refusDuPdfImporte(octets: Uint8Array): Promise<string | null> {
  if (new TextDecoder().decode(octets.slice(0, 5)) !== "%PDF-") return "Ce fichier n'est pas un PDF lisible.";
  return unAUn(() => refusDuPdfSeul(octets));
}

async function refusDuPdfSeul(octets: Uint8Array): Promise<string | null> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const doc = await pdfjs.getDocument({ data: octets.slice(), disableFontFace: true, isEvalSupported: false }).promise;
    const pages = doc.numPages;
    await doc.destroy();
    if (pages === 0) return "Ce PDF n'a aucune page.";
  } catch (err) {
    return err instanceof Error && err.name === "PasswordException"
      ? "Ce PDF est protégé par un mot de passe."
      : "Ce PDF ne s'ouvre pas.";
  }
  return null;
}
