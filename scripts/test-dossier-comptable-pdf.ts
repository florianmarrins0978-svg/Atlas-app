import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFArray, PDFDict, PDFDocument, PDFName, rgb } from "pdf-lib";
import { composerDossierComptable, type LignePourLeDossier } from "../src/server/pdf/dossier-comptable-pdf";

// POUR MON COMPTABLE, LOT 3 — le PDF du dossier, ouvert et relu.
//
// Ce que la suite défend, sans base ni navigateur :
//   · le PDF s'ouvre, et dit ce qu'il doit dire (période, totaux, mentions) ;
//   · chaque « Voir la photo » mène à la page de SA photo, et chaque « Retour
//     à la ligne » ramène à la page de SA ligne : les liens visent une page,
//     jamais un nom (sa remarque du 23 octobre, « ça marche pas ») ;
//   · une photo illisible n'empêche pas le dossier de sortir ;
//   · une facture tient une page entière, six tickets tiennent une page.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function photo(): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const p = d.addPage([60, 100]);
  p.drawRectangle({ x: 5, y: 5, width: 50, height: 90, color: rgb(0.9, 0.9, 0.9) });
  // Un PNG n'est pas productible par pdf-lib : on prend une vraie image d'un
  // pixel, écrite en clair.
  return Uint8Array.from(
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64")
  );
}

async function facturePdf(): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const p = d.addPage([595, 842]);
  p.drawRectangle({ x: 40, y: 700, width: 300, height: 60, color: rgb(0.2, 0.2, 0.2) });
  return d.save();
}

/** Une page sans contenu : pdf-lib l'accepte au chargement et la refuse à l'écriture. */
async function pdfVide(): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  d.addPage([595, 842]);
  return d.save();
}

async function texteDe(octets: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Les polices standard (Courier, celle des tickets réécrits) se lisent avec
  // leurs fichiers ; sans eux, pdfjs rend une page muette et le contrôle ment.
  const standardFontDataUrl = `${pathToFileURL(path.resolve("node_modules/pdfjs-dist/standard_fonts")).href}/`;
  const doc = await pdfjs.getDocument({ data: octets.slice(), standardFontDataUrl }).promise;
  let tout = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    tout += c.items.map((x) => ("str" in x ? x.str : "")).join(" ") + "\n";
  }
  // Le Courier se relit avec des blancs entre les mots (« TOTAL   TTC ») :
  // un seul blanc partout, pour comparer ce qui est écrit, pas sa chasse.
  return tout.replace(/ /g, " ").replace(/[ 	]+/g, " ");
}

/** Les liens de chaque page : la page (1, 2…) qu'ils visent. */
async function liensDe(octets: Uint8Array): Promise<Map<number, number[]>> {
  const d = await PDFDocument.load(octets);
  const refs = d.getPages().map((p) => p.ref.toString());
  const sortie = new Map<number, number[]>();
  d.getPages().forEach((p, i) => {
    const annots = p.node.lookup(PDFName.of("Annots"));
    if (!(annots instanceof PDFArray)) return;
    const cibles: number[] = [];
    for (let k = 0; k < annots.size(); k++) {
      const annot = annots.lookup(k, PDFDict);
      const dest = annot.get(PDFName.of("Dest"));
      assert.ok(dest instanceof PDFArray, "un lien vise un nom au lieu d'une page");
      cibles.push(refs.indexOf(dest.get(0).toString()) + 1);
    }
    sortie.set(i + 1, cibles);
  });
  return sortie;
}

async function main() {
  const png = await photo();
  const pdf = await facturePdf();
  const lignes: LignePourLeDossier[] = [
    { jour: "2026-10-14", libelle: "CB TOTALENERGIES ST JEAN", sens: "sortie", montant: "62.40", categorie: "autre", piece: null, ticketPerdu: true, motif: null },
    { jour: "2026-10-14", libelle: "CB TOTALENERGIES ST JEAN", sens: "sortie", montant: "81.15", categorie: "carburant", piece: { genre: "ticket", fournisseur: "TotalEnergies", date: "2026-10-13", totalTtc: "81.15", tva: "13.53", photo: { octets: png, nature: "image" }, lignes: null }, ticketPerdu: false, motif: null },
    { jour: "2026-10-24", libelle: "VIR SEPA PEPINIERES DURAND", sens: "sortie", montant: "1740.00", categorie: "virement", piece: { genre: "facture", societe: "Pépinières Durand", nom: "Facture 2026-418", totalTtc: "1740.00", fichier: { octets: pdf, nature: "pdf" } }, ticketPerdu: false, motif: null },
    { jour: "2026-10-21", libelle: "VIR LALA FACTURE F2026-28", sens: "entree", montant: "1200.00", categorie: "recu", piece: { genre: "facture-emise", numero: "F2026-000028" }, ticketPerdu: false, motif: null },
    { jour: "2026-10-02", libelle: "VIR SEPA FACTURE ABIMEE", sens: "sortie", montant: "10.00", categorie: "virement", piece: { genre: "facture", societe: "Fournisseur X", nom: "Facture abîmée", totalTtc: "10.00", fichier: { octets: await pdfVide(), nature: "pdf" } }, ticketPerdu: false, motif: null },
    { jour: "2026-09-03", libelle: "PRLV URSSAF", sens: "sortie", montant: "230.00", categorie: "virement", piece: null, ticketPerdu: false, motif: "impots" },
    { jour: "2026-09-10", libelle: "CB ESSO", sens: "sortie", montant: "54.10", categorie: "carburant", piece: { genre: "ticket", fournisseur: "Esso", date: "2026-09-09", totalTtc: "54.10", tva: "9.02", photo: { octets: Uint8Array.from([1, 2, 3, 4]), nature: "image" }, lignes: null }, ticketPerdu: false, motif: null },
  ];
  const octets = await composerDossierComptable({
    entreprise: { nom: "Jardins Exemple", siret: "000 000 000 00000", adresse: "12 chemin des Oliviers, 13400 Aubagne" },
    banque: "Crédit Mutuel",
    du: "2026-01-01",
    au: "2026-10-31",
    rangeLe: "2026-11-02",
    gardeJusquAu: "2036-10-31",
    lignes,
  });

  await test("le PDF s'ouvre, et dit la période, l'entreprise et la garde", async () => {
    const t = await texteDe(octets);
    assert.match(t, /Dossier justifié/);
    assert.match(t, /1er janvier 2026 au 31 octobre 2026|1ᵉʳ janvier 2026/);
    assert.match(t, /Jardins Exemple/);
    assert.match(t, /Gardé jusqu'au 31 octobre 2036/);
  });

  await test("les totaux, les mentions et les pièces réécrites y sont", async () => {
    const t = await texteDe(octets).then((x) => x.replace(/ /g, " "));
    assert.match(t, /-2 177,65 €/, "le total des sorties manque");
    assert.match(t, /\+1 200,00 €/);
    assert.match(t, /Ticket perdu, mention validée/);
    assert.match(t, /Impôts, cotisations/);
    assert.match(t, /Facture F2026-000028/);
    assert.match(t, /TOTAL TTC/);
    assert.match(t, /Pépinières Durand/);
  });

  await test("une photo illisible n'empêche pas le dossier de sortir, et sa place le dit", async () => {
    assert.match(await texteDe(octets), /Photo non lisible ici/);
  });

  await test("chaque lien vise une page, et les allers ont leurs retours", async () => {
    const liens = await liensDe(octets);
    const toutes = [...liens.entries()];
    assert.ok(toutes.length > 0, "aucun lien : le contrôle ne mesure rien");
    for (const [depuis, cibles] of toutes) for (const c of cibles) assert.ok(c > 0, `page ${depuis} : un lien vise une page inconnue`);
    // Chaque lien d'une page de mois ou de photos a son retour.
    for (const [page, cibles] of toutes) {
      for (const c of cibles) {
        if (page <= 2) continue; // le sommaire mène aux mois, sans retour
        const retour = liens.get(c) ?? [];
        assert.ok(retour.includes(page), `page ${page} mène à ${c}, qui ne ramène pas à ${page}`);
      }
    }
  });

  await test("la facture prend une page entière, les tickets se partagent la leur", async () => {
    const d = await PDFDocument.load(octets);
    // couverture, coup d'œil, septembre, octobre, tickets perdus, page des
    // tickets, une page par facture (la bonne et l'abîmée)
    assert.equal(d.getPageCount(), 8);
  });

  // ─── Lot 5 : le ticket recopié ligne par ligne ─────────────────────────────
  const recopie = (lignesDuTicket: { gauche: string; droite: string | null }[], totalTtc: string): LignePourLeDossier => ({
    jour: "2026-10-22",
    libelle: "CB INTERMARCHE MANTES",
    sens: "sortie",
    montant: totalTtc,
    categorie: "repas",
    piece: { genre: "ticket", fournisseur: "INTERMARCHE", date: "2026-10-22", totalTtc, tva: "1.57", photo: null, lignes: lignesDuTicket },
    ticketPerdu: false,
    motif: null,
  });
  const dossier = (l: LignePourLeDossier) =>
    composerDossierComptable({ entreprise: { nom: "Jardins Exemple", siret: null, adresse: null }, banque: null, du: "2026-10-01", au: "2026-10-31", rangeLe: "2026-11-02", gardeJusquAu: "2036-10-31", lignes: [l] });

  await test("le ticket recopié garde chaque ligne, doublons compris, et surligne SA ligne du total", async () => {
    const t = await texteDe(
      await dossier(
        recopie(
          [
            { gauche: "SAS MAFICAL", droite: null },
            { gauche: "REAL THAI LAIT COCO", droite: "1,66 EUR A" },
            { gauche: "REAL THAI LAIT COCO", droite: "1,66 EUR A" },
            { gauche: "REAL THAI LAIT COCO", droite: "1,66 EUR A" },
            { gauche: "MONTANT DU", droite: "30,12 EUR" },
          ],
          "30.12"
        )
      )
    );
    assert.equal(t.match(/REAL THAI LAIT COCO/g)?.length, 3, "un doublon a été regroupé ou perdu");
    assert.match(t, /SAS MAFICAL/);
    assert.match(t, /MONTANT DU 30,12 EUR/);
    // La ligne du ticket porte le total : aucun « TOTAL TTC » ajouté par Atlas.
    assert.doesNotMatch(t, /TOTAL TTC/);
  });

  await test("un très long ticket continue sur la page suivante, sans perdre une ligne", async () => {
    const longues = Array.from({ length: 150 }, (_, i) => ({ gauche: `ARTICLE ${i}`, droite: "1,00 EUR" }));
    const octetsLongs = await dossier(recopie(longues, "150.00"));
    const t = await texteDe(octetsLongs);
    for (const i of [0, 74, 75, 149]) assert.match(t, new RegExp(`ARTICLE ${i} `), `la ligne ${i} manque`);
    assert.match(t, /Suite du ticket du 22 octobre 2026/);
    // Sans ligne du total, il s'ajoute à part, surligné.
    assert.match(t, /TOTAL TTC 150,00 €/);
    assert.ok((await PDFDocument.load(octetsLongs)).getPageCount() >= 4, "le ticket aurait dû déborder sur une seconde page");
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
