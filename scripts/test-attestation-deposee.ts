import assert from "node:assert/strict";
import { PDFDocument, PDFName, PDFArray } from "pdf-lib";
import { deflateSync } from "node:zlib";
import { refusDuPdfDepose, sansAnnotations } from "../src/server/pdf/attestation-deposee";
import { protegerContreModification } from "../src/server/pdf/proteger-pdf";
import { composerFacturePdf, type FacturePdfData } from "../src/server/pdf/facture-pdf";

/**
 * L'ATTESTATION DÉCENNALE DÉPOSÉE — son choix A du 5 octobre 2026.
 *
 * Elle part chez chaque client, dans chaque devis et chaque facture. Ce qui
 * se vérifie ici, sans base : les refus au dépôt (pas un PDF, protégé, trop de
 * pages), les annotations qui ne la suivent pas, et la photo posée sur sa page.
 * Le chemin complet, du dépôt au papier, est dans `test-documents-en-regle-db.ts`.
 */

let ok = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  await fn();
  ok++;
  console.log(`  ✓ ${nom}`);
}

async function pdfDe(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595.28, 841.89]);
  return doc.save();
}

/** Un PNG d'un pixel, écrit à la main : aucune dépendance d'image dans les suites. */
function pngUnPixel(): Uint8Array {
  const crc = (b: Buffer) => {
    let c = ~0;
    for (const x of b) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const bloc = (type: string, donnees: Buffer) => {
    const t = Buffer.concat([Buffer.from(type), donnees]);
    const l = Buffer.alloc(4);
    l.writeUInt32BE(donnees.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(t));
    return Buffer.concat([l, t, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", deflateSync(Buffer.from([0, 255, 255, 255]))),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

const FACTURE = {
  numeroCommercial: "F-2026-001",
  statut: "emise",
  dateEmission: "2026-10-05",
  entrepriseNom: "Arborea",
  clientNom: "Bernard",
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "1000.00",
  totalTva: "200.00",
  totalTtc: "1200.00",
  lignes: [{ libelle: "Abattage", quantite: "1", prixUnitaire: "1000.00", montant: "1000.00", unite: null }],
} as unknown as FacturePdfData;

async function main() {
  console.log("— Le dépôt —");

  await cas("une page, ou quatre : acceptée", async () => {
    assert.equal(await refusDuPdfDepose(await pdfDe(1)), null);
    assert.equal(await refusDuPdfDepose(await pdfDe(4)), null);
  });

  await cas("cinq pages : ce n'est plus une attestation", async () => {
    assert.match((await refusDuPdfDepose(await pdfDe(5))) ?? "", /5 pages/);
  });

  await cas("ce qui n'est pas un PDF se refuse, quel que soit le type annoncé", async () => {
    assert.match((await refusDuPdfDepose(new TextEncoder().encode("<html>bonjour</html>"))) ?? "", /pas un PDF/);
  });

  await cas("un PDF protégé par un mot de passe se refuse, et le refus dit quoi faire", async () => {
    const protege = await protegerContreModification(await pdfDe(1));
    assert.match((await refusDuPdfDepose(protege)) ?? "", /protégé par un mot de passe/);
  });

  console.log("— Le papier —");

  await cas("les annotations d'une page déposée ne la suivent pas", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.node.set(PDFName.of("Annots"), doc.context.obj([]));
    assert.ok(page.node.lookup(PDFName.of("Annots"), PDFArray));
    sansAnnotations(page);
    assert.equal(page.node.get(PDFName.of("Annots")), undefined);
  });

  await cas("un PDF joint ajoute ses pages, une photo en ajoute une", async () => {
    const seule = await PDFDocument.load((await composerFacturePdf(FACTURE)).pdf, { ignoreEncryption: true });
    const avecPdf = await PDFDocument.load(
      (await composerFacturePdf(FACTURE, { attestation: { octets: await pdfDe(2), mime: "application/pdf" } })).pdf,
      { ignoreEncryption: true }
    );
    const avecPhoto = await PDFDocument.load(
      (await composerFacturePdf(FACTURE, { attestation: { octets: pngUnPixel(), mime: "image/png" } })).pdf,
      { ignoreEncryption: true }
    );
    assert.equal(avecPdf.getPageCount(), seule.getPageCount() + 2);
    assert.equal(avecPhoto.getPageCount(), seule.getPageCount() + 1);
  });

  console.log(`\n✅ ${ok} vérifications vertes.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
