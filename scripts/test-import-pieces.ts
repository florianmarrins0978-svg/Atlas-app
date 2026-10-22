import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import {
  entreeAIgnorer,
  formatDuFichier,
  fusionnerLectures,
  lireChampsDuTexte,
  montantLu,
  refusDeLEnvoi,
  relireReponseIA,
  RIEN_LU,
  statutApresLecture,
} from "../src/lib/import-pieces";
import { entreesDuZip, lireEntree, ZipIllisible } from "../src/lib/lire-zip";
import { ecrireArchiveZip } from "../src/lib/archive-zip";
import { crc32 } from "../src/lib/archive-zip";
import { PDFDocument } from "pdf-lib";
import { protegerContreModification } from "../src/server/pdf/proteger-pdf";
import { refusDuPdfImporte } from "../src/server/import/lire-piece";

// IMPORTER DEVIS ET FACTURES : les règles pures — 22 octobre 2026.
//
// Les textes ci-dessous sont ceux que `pdfjs` tire de vrais PDF (Atlas écrit
// ses titres en capitales espacées) et de PDF d'autres logiciels tels qu'on
// les rencontre. Ce qui compte surtout : **ne jamais inventer un client**, et
// ne jamais coller la ligne suivante au nom (« M. Martins Total »).

const echecs: string[] = [];
async function cas(nom: string, f: () => void | Promise<void>) {
  try {
    await f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    console.log(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
    echecs.push(nom);
  }
}

/** Un zip à une entrée compressée en deflate, comme l'écrivent Windows et macOS. */
function zipDeflate(nom: string, contenu: Uint8Array): Uint8Array {
  const n = Buffer.from(nom);
  const comp = deflateRawSync(contenu);
  const crc = crc32(contenu);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(contenu.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(contenu.length, 24);
  central.writeUInt16LE(n.length, 28);
  central.writeUInt32LE(0, 42);
  const debutCentral = 30 + n.length + comp.length;
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(1, 8);
  fin.writeUInt16LE(1, 10);
  fin.writeUInt32LE(46 + n.length, 12);
  fin.writeUInt32LE(debutCentral, 16);
  return Buffer.concat([local, n, comp, central, n, fin]);
}

async function main() {
  console.log("Les limites d'un envoi");

  await cas("2 000 documents passent, 2 001 sont refusés en disant quoi faire", () => {
    assert.equal(refusDeLEnvoi(2000, 900_000_000), null);
    assert.match(refusDeLEnvoi(4800, 100) ?? "", /4\s800.*2\s000 au plus.*une année par envoi/);
    assert.match(refusDeLEnvoi(10, 1_300_000_000) ?? "", /1 Go/);
    assert.match(refusDeLEnvoi(0, 0) ?? "", /Aucun/);
  });

  await cas("PDF, JPEG, PNG et zip ; le reste se nomme et ne part pas", () => {
    assert.equal(formatDuFichier("Facture 12.PDF"), "pdf");
    assert.equal(formatDuFichier("scan.jpeg"), "photo");
    assert.equal(formatDuFichier("2024.zip"), "zip");
    assert.equal(formatDuFichier("IMG_0001.HEIC"), null);
    assert.equal(formatDuFichier("compta.xlsx"), null);
  });

  await cas("ce que macOS et Windows glissent dans un zip est ignoré", () => {
    assert.ok(entreeAIgnorer("__MACOSX/2024/._f.pdf"));
    assert.ok(entreeAIgnorer("2024/"));
    assert.ok(entreeAIgnorer("2024/.DS_Store"));
    assert.ok(!entreeAIgnorer("2024/facture 12.pdf"));
  });

  console.log("\nLire le texte d'un PDF, sans IA");

  await cas("une facture d'Atlas : titre en capitales espacées, et le devis cité ne trompe pas", () => {
    const t = "Atelier Date 01/04/2026 Échéance 01/05/2026 Devis 2026-000001 F A C T U R E n° F2026-000001 C L I E N T L I E U D E S T R A V A U X M. Vasseur 0622000022 Total TTC 1 080,00 €";
    assert.deepEqual(lireChampsDuTexte(t), { genre: "facture", numero: "F2026-000001", jour: "2026-04-01", montantTtc: "1080.00", nomLu: "M. Vasseur" });
  });

  await cas("la ligne suivante ne se colle pas au nom (« M. Martins Total »)", () => {
    assert.equal(lireChampsDuTexte("FACTURE n° F1 12/03/2025 Client : M. Martins Total TTC 480,00").nomLu, "M. Martins");
    assert.equal(lireChampsDuTexte("DEVIS N° D-12 Madame Lenoir Adresse 3 rue X").nomLu, "Mme Lenoir");
  });

  await cas("le titre du tableau ne se colle pas au nom (« M. Bernard DÉSIGNATION »)", () => {
    const t = "D E V I S n° 2026-000001 C L I E N T L I E U D E S T R A V A U X M. Bernard D É S I G N A T I O N Q T É";
    assert.equal(lireChampsDuTexte(t).nomLu, "M. Bernard");
  });

  await cas("un prénom se garde, la civilité se normalise", () => {
    assert.equal(lireChampsDuTexte("Devis n° 7 Monsieur Jean Dupont 12 rue").nomLu, "M. Jean Dupont");
    assert.equal(lireChampsDuTexte("Facture n° 8 Mme DUPONT Marie").nomLu, "Mme DUPONT Marie");
  });

  await cas("un client sans civilité n'est PAS deviné", () => {
    assert.equal(lireChampsDuTexte("FACTURE n° F2024-0097 09/10/2024 SARL Les Tilleuls Total TTC 310,00").nomLu, null);
  });

  await cas("une date impossible ne se lit pas", () => {
    assert.equal(lireChampsDuTexte("Facture n° 9 le 31/02/2025").jour, null);
  });

  await cas("les montants à la française", () => {
    assert.equal(montantLu("1 250,00"), "1250.00");
    assert.equal(montantLu("1.250,00"), "1250.00");
    assert.equal(montantLu("12,5"), null);
  });

  console.log("\nCe que l'IA rend, relu");

  await cas("une réponse bavarde ou cassée ne donne rien", () => {
    assert.equal(relireReponseIA("Je ne sais pas."), null);
    assert.equal(relireReponseIA("{ pas du json"), null);
  });

  await cas("une date ou un montant hors forme sont écartés, le reste gardé", () => {
    const r = relireReponseIA('Voici : {"genre":"facture","numero":"F-1","date":"2025-13-40","montant_ttc":"abc","client":"SARL Les Tilleuls"}');
    assert.deepEqual(r, { genre: "facture", numero: "F-1", jour: null, montantTtc: null, nomLu: "SARL Les Tilleuls" });
  });

  await cas("l'IA complète le texte sans l'écraser par du vide", () => {
    const texte = { ...RIEN_LU, genre: "facture" as const, numero: "F1", montantTtc: "10.00" };
    const ia = { ...RIEN_LU, nomLu: "SARL X" };
    assert.deepEqual(fusionnerLectures(ia, texte), { ...texte, nomLu: "SARL X" });
    assert.equal(statutApresLecture(fusionnerLectures(ia, texte)), "lue");
    assert.equal(statutApresLecture(texte), "a_verifier");
  });

  console.log("\nOuvrir un zip par morceaux");

  const pdf = new TextEncoder().encode("%PDF-1.7\n" + "contenu ".repeat(500));

  await cas("un zip écrit par Atlas (stockage) se lit entrée par entrée", async () => {
    const morceaux: Uint8Array[] = [];
    for await (const m of ecrireArchiveZip([{ nom: "2024/facture 1.pdf", contenu: pdf }, { nom: "2024/devis 2.pdf", contenu: pdf }], new Date())) morceaux.push(m);
    const zip = new Blob(morceaux.map((m) => new Uint8Array(m)));
    const entrees = await entreesDuZip(zip);
    assert.deepEqual(entrees.map((e) => e.chemin), ["2024/facture 1.pdf", "2024/devis 2.pdf"]);
    assert.deepEqual(await lireEntree(zip, entrees[1], 1_000_000), pdf);
  });

  await cas("un zip compressé (deflate) se lit aussi", async () => {
    const zip = new Blob([new Uint8Array(zipDeflate("f.pdf", pdf))]);
    const [e] = await entreesDuZip(zip);
    assert.equal(e.methode, 8);
    assert.deepEqual(await lireEntree(zip, e, 1_000_000), pdf);
  });

  await cas("une entrée qui gonfle au-delà du plafond est refusée (bombe)", async () => {
    const enorme = new Uint8Array(5_000_000);
    const zip = new Blob([new Uint8Array(zipDeflate("bombe.pdf", enorme))]);
    const [e] = await entreesDuZip(zip);
    await assert.rejects(lireEntree(zip, { ...e, taille: 10 }, 1_000_000), ZipIllisible);
  });

  await cas("un fichier qui n'est pas un zip est refusé en le disant", async () => {
    await assert.rejects(entreesDuZip(new Blob([pdf])), /pas un zip/);
  });

  console.log("\nUn PDF se garde s'il s'ouvre");

  await cas("une facture protégée contre la modification (comme celles d'Atlas) s'importe", async () => {
    // Payé le 22 octobre 2026 : pdf-lib les prenait pour des PDF verrouillés,
    // et six factures d'Atlas sur six étaient refusées au premier essai.
    const doc = await PDFDocument.create();
    doc.addPage();
    const protege = await protegerContreModification(await doc.save());
    assert.equal(await refusDuPdfImporte(protege), null);
  });

  await cas("ce qui n'est pas un PDF, ou ne s'ouvre pas, est refusé en le disant", async () => {
    assert.match((await refusDuPdfImporte(new TextEncoder().encode("bonjour"))) ?? "", /pas un PDF/);
    assert.match((await refusDuPdfImporte(new TextEncoder().encode("%PDF-1.7 abîmé"))) ?? "", /ne s'ouvre pas/);
  });

  if (echecs.length > 0) {
    console.log(`\n✗ ${echecs.length} échec(s)`);
    process.exit(1);
  }
  console.log("\n✅ L'import lit ce qui est écrit, et n'invente aucun client.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
