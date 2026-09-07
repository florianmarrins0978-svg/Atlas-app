import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFDict, PDFName, PDFNumber, PDFHexString, PDFRawStream, StandardFonts } from "pdf-lib";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";
import { genererPdfFacture, type FacturePdfData } from "../src/server/pdf/facture-pdf";
import { AUTORISATIONS_CLIENT, protegerContreModification } from "../src/server/pdf/proteger-pdf";

/**
 * LE DEVIS QUE LE CLIENT REÇOIT NE SE RETOUCHE PAS.
 *
 * **Sa capture du 31 août 2026 :** son client ouvre le devis sur son téléphone,
 * Acrobat lui propose « Ajouter du texte » et « Ajouter une image ». Le
 * document qui engage les deux parties était modifiable d'un doigt.
 *
 * Ce que cette suite tient, et ce qu'elle ne tient pas :
 *
 * | | |
 * |---|---|
 * | ici | les autorisations posées, le texte illisible en clair, le fichier reproductible |
 * | `test-devis-lisible-e2e.ts` | qu'un VRAI lecteur l'ouvre quand même, sans rien taper |
 *
 * La séparation n'est pas cosmétique : un contrôle qui vérifierait le
 * chiffrement avec le code qui l'a produit ne prouverait que sa cohérence avec
 * lui-même. C'est le moteur PDF de Chromium qui dit qu'un lecteur y arrive.
 */

const DEVIS: DevisPdfData = {
  numeroCommercial: "2026-000008",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-08-31",
  validiteJours: 30,
  entrepriseNom: "Atlas",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  clientNom: "Huguette Groupiron",
  clientCivilite: "mme",
  adresseChantier: "Rue du Tourigou 29950 Bénodet",
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "550.00",
  totalTva: "110.00",
  totalTtc: "660.00",
  lignes: [
    { libelle: "Taille de haies 40 ml", quantite: "1", prixUnitaire: "200.00", montant: "200.00" },
    { libelle: "Taille des graminées", quantite: "1", prixUnitaire: "200.00", montant: "200.00" },
    { libelle: "Menus travaux", quantite: "1", prixUnitaire: "150.00", montant: "150.00" },
  ],
};

const FACTURE: FacturePdfData = {
  numeroCommercial: "F-2026-0001",
  statut: "emise",
  dateEmission: "2026-08-31",
  entrepriseNom: "Atlas",
  clientNom: "Huguette Groupiron",
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "550.00",
  totalTva: "110.00",
  totalTtc: "660.00",
  lignes: [{ libelle: "Taille de haies 40 ml", quantite: "1", prixUnitaire: "550.00", montant: "550.00" }],
};

let reussis = 0;
let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

/** Le dictionnaire des autorisations, tel qu'un lecteur le trouve. */
async function protectionDe(octets: Uint8Array): Promise<PDFDict> {
  const doc = await PDFDocument.load(octets, { ignoreEncryption: true, updateMetadata: false });
  const reference = doc.context.trailerInfo.Encrypt;
  assert.ok(reference, "le document ne porte aucun dictionnaire /Encrypt");
  const dict = doc.context.lookup(reference);
  assert.ok(dict instanceof PDFDict, "/Encrypt n'est pas un dictionnaire");
  return dict;
}

const nombre = (dict: PDFDict, clef: string): number => {
  const v = dict.get(PDFName.of(clef));
  assert.ok(v instanceof PDFNumber, `/${clef} absent du dictionnaire de protection`);
  return v.asNumber();
};

async function main() {
  console.log("=== Le devis du client ne se modifie pas ===\n");

  await essai("les autorisations disent oui à l'impression, non à la retouche", () => {
    // Un bit par autorisation, numérotés à partir de 1 (ISO 32000-1, tableau 22).
    const permis = (bit: number) => (AUTORISATIONS_CLIENT & (1 << (bit - 1))) !== 0;
    assert.equal(permis(3), true, "le client ne pourrait pas imprimer son devis");
    assert.equal(permis(12), true, "l'impression serait dégradée");
    assert.equal(permis(5), true, "une adresse ne se recopierait pas");
    assert.equal(permis(10), true, "une liseuse d'écran ne lirait pas ce devis");
    assert.equal(permis(4), false, "le contenu resterait modifiable — c'est le défaut signalé");
    assert.equal(permis(6), false, "une annotation pourrait recouvrir un montant");
    assert.equal(permis(9), false, "un champ de formulaire resterait remplissable");
    assert.equal(permis(11), false, "une page pourrait être retirée du devis");
  });

  await essai("le devis sort protégé, en AES-128, sans mot de passe à l'ouverture", async () => {
    const { pdf } = await composerDevisPdf(DEVIS);
    const protection = await protectionDe(pdf);
    assert.equal(nombre(protection, "V"), 4);
    assert.equal(nombre(protection, "R"), 4);
    assert.equal(nombre(protection, "P"), AUTORISATIONS_CLIENT);
    const filtres = protection.get(PDFName.of("CF"));
    assert.ok(filtres instanceof PDFDict);
    const std = filtres.get(PDFName.of("StdCF"));
    assert.ok(std instanceof PDFDict);
    assert.equal(std.get(PDFName.of("CFM"))?.toString(), "/AESV2");
    // /U tient sur 32 octets : c'est ce qu'un lecteur recalcule pour constater
    // que le mot de passe d'ouverture est vide. Plus court, il refuserait.
    const u = protection.get(PDFName.of("U"));
    assert.ok(u instanceof PDFHexString, "/U n'est pas écrit en hexadécimal");
    assert.equal(u.asBytes().length, 32);
  });

  await essai("la facture aussi — un seul endroit protège les deux", async () => {
    const protection = await protectionDe(await genererPdfFacture(FACTURE));
    assert.equal(nombre(protection, "P"), AUTORISATIONS_CLIENT);
  });

  await essai("pdf-lib lui-même refuse d'ouvrir le devis sans le dire", async () => {
    const { pdf } = await composerDevisPdf(DEVIS);
    // `ignoreEncryption` est le seul moyen d'entrer : la protection n'est donc
    // pas une simple étiquette posée sur un fichier resté en clair.
    await assert.rejects(() => PDFDocument.load(pdf, { updateMetadata: false }));
  });

  await essai("le contenu des pages est vraiment chiffré, pas seulement étiqueté", async () => {
    // **Ce que ce contrôle a d'abord mesuré : rien.** Il cherchait le nom du
    // client en toutes lettres dans le fichier — or pdf-lib comprime déjà les
    // pages : le nom ne s'y lit nulle part, protégé ou non, et le contrôle
    // rendait un vert imprenable (`CLAUDE.md` §5, « un contrôle qui mesure
    // zéro »). Il regarde donc ce qui distingue vraiment les deux : un flux
    // comprimé se décomprime, un flux chiffré ne se décomprime pas.
    const doc = await PDFDocument.create();
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));
    const police = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage([595, 842]).drawText("Huguette Groupiron", { x: 40, y: 700, size: 14, font: police });
    const clair = await doc.save();

    const nom = Buffer.from("Huguette Groupiron", "latin1").toString("hex");
    const contenuDeLaPage = async (octets: Uint8Array) => {
      const relu = await PDFDocument.load(octets, { ignoreEncryption: true, updateMetadata: false });
      const flux = relu.context
        .enumerateIndirectObjects()
        .map(([, objet]) => objet)
        .filter((objet): objet is PDFRawStream => objet instanceof PDFRawStream);
      for (const f of flux) {
        try {
          const texte = inflateSync(Buffer.from(f.contents)).toString("latin1").toLowerCase();
          if (texte.includes(nom)) return "lisible";
        } catch {
          // Un flux qui ne se décomprime pas : c'est ce qu'on attend du protégé.
        }
      }
      return "illisible";
    };

    assert.equal(await contenuDeLaPage(clair), "lisible", "le témoin ne se lit pas : ce contrôle ne mesure rien");
    assert.equal(
      await contenuDeLaPage(await protegerContreModification(clair)),
      "illisible",
      "le contenu de la page se lit encore : le fichier n'est pas chiffré"
    );
  });

  await essai("deux compositions du même devis rendent le même fichier", async () => {
    // Ce que `test-allure-pdf.ts` compare octet pour octet, et ce qui garde la
    // promesse qu'aucun devis ne change tout seul. Une protection tirée au sort
    // à chaque document l'aurait rendue impossible à tenir.
    const clair = Uint8Array.from([...Array(64).keys()]);
    const doc = await PDFDocument.create();
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));
    doc.addPage([200, 200]).drawText(String(clair.length));
    const source = await doc.save();
    const a = await protegerContreModification(source);
    const b = await protegerContreModification(source);
    assert.equal(Buffer.compare(Buffer.from(a), Buffer.from(b)), 0, "le fichier change d'une fois sur l'autre");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${reussis} contrôle(s) passé(s), ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
