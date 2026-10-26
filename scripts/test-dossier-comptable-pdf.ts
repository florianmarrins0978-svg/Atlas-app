import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument, rgb } from "pdf-lib";
import { composerDossierComptable, type DonneesDossier, type LignePourLeDossier } from "../src/server/pdf/dossier-comptable-pdf";

// POUR MON COMPTABLE, LOT 3 — le PDF du dossier, ouvert et relu.
//
// Ce que la suite défend, sans base ni navigateur :
//   · le PDF s'ouvre, et dit ce qu'il doit dire (période, totaux, mentions) ;
//   · chaque « Voir la photo » mène à la page de SA photo, et chaque « Retour
//     à la ligne » ramène à la page de SA ligne : les liens visent une page,
//     jamais un nom (sa remarque du 23 octobre, « ça marche pas ») ;
//   · une photo illisible n'empêche pas le dossier de sortir ;
//   · une facture tient une page entière, six tickets tiennent une page.
//
// Et ce que sa planche du 26 octobre 2026 a changé (`appli/soignee/
// comptable-dossier.html`) : la première page dit d'abord que tout est
// justifié ; chaque mois commence sa page, sous des colonnes titrées ; sous une
// facture « Voir la facture » ; les tickets perdus suivent le dernier mois,
// avec leur total. Plus ce que le lot du 26 octobre a ajouté : la facture
// faite hors d'Atlas, l'écart d'une pièce jointe quand même, les motifs d'une
// entrée. Ce sont des RÈGLES et des LIENS qui se contrôlent ici, jamais une
// position au point près.

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

/** Un PNG d'un pixel, écrit en clair : pdf-lib ne sait pas en produire. */
const PNG = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64")
);

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

/** Une ligne du dossier ; ce qui n'est pas dit est ce qu'une ligne sans pièce porte. */
function ligne(l: Pick<LignePourLeDossier, "jour" | "libelle" | "sens" | "montant"> & Partial<LignePourLeDossier>): LignePourLeDossier {
  return { categorie: l.sens === "entree" ? "recu" : "autre", piece: null, ticketPerdu: false, motif: null, ecart: { genre: "inconnu" }, ...l };
}

const dossier = (lignes: LignePourLeDossier[], autour: Partial<DonneesDossier> = {}) =>
  composerDossierComptable({
    entreprise: { nom: "Jardins Exemple", siret: null, adresse: null },
    banque: null,
    du: "2026-01-01",
    au: "2026-10-31",
    rangeLe: "2026-11-02",
    gardeJusquAu: "2036-10-31",
    lignes,
    ...autour,
  });

type PageLue = { numero: number; texte: string; liens: { vers: number; texte: string }[] };

/**
 * Chaque page : son texte, et ses liens avec la page qu'ils visent et le texte
 * qu'ils couvrent (« Voir la facture », « Retour à la ligne du… »). C'est ce
 * texte qui dit QUEL lien on suit.
 */
async function lirePages(octets: Uint8Array): Promise<PageLue[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Les polices standard (Courier, celle des tickets réécrits) se lisent avec
  // leurs fichiers ; sans eux, pdfjs rend une page muette et le contrôle ment.
  const standardFontDataUrl = `${pathToFileURL(path.resolve("node_modules/pdfjs-dist/standard_fonts")).href}/`;
  const doc = await pdfjs.getDocument({ data: octets.slice(), standardFontDataUrl }).promise;
  // Le Courier se relit avec des blancs entre les mots (« TOTAL   TTC ») :
  // un seul blanc partout, pour comparer ce qui est écrit, pas sa chasse.
  const propre = (t: string) => t.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
  type Item = { str: string; width: number; transform: number[] };
  // Une phrase écrite en deux polices (« Facture F-012 » en gras, puis
  // « , payée en partie ») sort en deux morceaux collés : ils se relisent
  // collés, et un blanc ne sépare que ce qui est séparé sur la page.
  const relire = (items: Item[]) =>
    propre(
      items
        .map((x, k) => {
          const avant = items[k - 1];
          const colle = avant && Math.abs(avant.transform[5] - x.transform[5]) < 1 && Math.abs(avant.transform[4] + avant.width - x.transform[4]) < 1.5;
          return `${k === 0 || colle ? "" : " "}${x.str}`;
        })
        .join("")
    );
  const pages: PageLue[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const items = (await page.getTextContent()).items.flatMap((x) => ("str" in x ? [x] : []));
    const liens: PageLue["liens"] = [];
    for (const a of await page.getAnnotations()) {
      if (a.subtype !== "Link") continue;
      assert.ok(Array.isArray(a.dest), `page ${i} : un lien vise un nom au lieu d'une page`);
      const [x1, y1, x2, y2] = a.rect as number[];
      const dedans = items.filter((x) => x.transform[4] >= x1 - 1 && x.transform[4] <= x2 + 1 && x.transform[5] >= y1 - 2 && x.transform[5] <= y2 + 2);
      liens.push({ vers: (await doc.getPageIndex(a.dest[0])) + 1, texte: relire(dedans) });
    }
    pages.push({ numero: i, texte: relire(items), liens });
  }
  return pages;
}

const tout = (pages: PageLue[]) => pages.map((p) => p.texte).join("\n");
const liensVers = (pages: PageLue[], texte: RegExp) => pages.flatMap((p) => p.liens.filter((k) => texte.test(k.texte)).map((k) => ({ depuis: p.numero, ...k })));
const COLONNES = /DATE LIGNE DE BANQUE MONTANT JUSTIFICATIF/;
/** La page où commence un mois : son titre, et les titres des colonnes. */
const pageDuMois = (pages: PageLue[], titre: string) => pages.find((p) => p.texte.startsWith(titre) && !p.texte.startsWith(`${titre}, suite`) && COLONNES.test(p.texte));

async function main() {
  const pdf = await facturePdf();
  const lignes: LignePourLeDossier[] = [
    ligne({ jour: "2026-10-14", libelle: "CB LA MIE CALINE", sens: "sortie", montant: "62.40", ticketPerdu: true }),
    ligne({ jour: "2026-10-14", libelle: "CB TOTALENERGIES ST JEAN", sens: "sortie", montant: "81.15", categorie: "carburant", piece: { genre: "ticket", fournisseur: "TotalEnergies", date: "2026-10-13", totalTtc: "81.15", tva: "13.53", photo: { octets: PNG, nature: "image" }, lignes: null }, ecart: { genre: "juste" } }),
    ligne({ jour: "2026-10-24", libelle: "VIR SEPA PEPINIERES DURAND", sens: "sortie", montant: "1740.00", categorie: "virement", piece: { genre: "facture", societe: "Pépinières Durand", nom: "Facture 2026-418", totalTtc: "1740.00", fichier: { octets: pdf, nature: "pdf" } }, ecart: { genre: "juste" } }),
    ligne({ jour: "2026-10-21", libelle: "VIR LALA FACTURE F2026-28", sens: "entree", montant: "1200.00", piece: { genre: "facture-emise", numero: "F2026-000028" }, ecart: { genre: "juste" } }),
    ligne({ jour: "2026-10-02", libelle: "VIR SEPA FACTURE ABIMEE", sens: "sortie", montant: "10.00", categorie: "virement", piece: { genre: "facture", societe: "Fournisseur X", nom: "Facture abîmée", totalTtc: "10.00", fichier: { octets: await pdfVide(), nature: "pdf" } }, ecart: { genre: "juste" } }),
    ligne({ jour: "2026-10-20", libelle: "VIR SCI DU PARC", sens: "entree", montant: "640.00", piece: { genre: "facture-hors-atlas", totalTtc: "640.00", fichier: { octets: pdf, nature: "pdf" } }, ecart: { genre: "juste" } }),
    ligne({ jour: "2026-10-18", libelle: "VIR SARL MOTOCULTURE OUEST", sens: "sortie", montant: "1450.00", categorie: "virement", piece: { genre: "facture", societe: "Motoculture Ouest", nom: "Facture débroussailleuse", totalTtc: "1386.40", fichier: null }, ecart: { genre: "ecart", ligne: 145000, piece: 138640 } }),
    ligne({ jour: "2026-10-16", libelle: "VIR M DUPONT ACOMPTE", sens: "entree", montant: "864.00", piece: { genre: "facture-emise", numero: "F-2026-012" }, ecart: { genre: "ecart", ligne: 86400, piece: 172800 } }),
    ligne({ jour: "2026-10-09", libelle: "VIR MARTIN REMBOURSEMENT", sens: "entree", montant: "300.00", motif: "perso" }),
    ligne({ jour: "2026-10-05", libelle: "VIR VERS LIVRET", sens: "sortie", montant: "200.00", categorie: "virement", motif: "perso" }),
    ligne({ jour: "2026-09-03", libelle: "PRLV URSSAF", sens: "sortie", montant: "230.00", categorie: "virement", motif: "impots" }),
    ligne({ jour: "2026-09-08", libelle: "CB LA POSTE", sens: "sortie", montant: "18.50", ticketPerdu: true }),
    ligne({ jour: "2026-09-10", libelle: "CB ESSO", sens: "sortie", montant: "54.10", categorie: "carburant", piece: { genre: "ticket", fournisseur: "Esso", date: "2026-09-09", totalTtc: "52.00", tva: "8.67", photo: { octets: Uint8Array.from([1, 2, 3, 4]), nature: "image" }, lignes: null }, ecart: { genre: "ecart", ligne: 5410, piece: 5200 } }),
  ];
  const octets = await dossier(lignes, {
    entreprise: { nom: "Jardins Exemple", siret: "000 000 000 00000", adresse: "12 chemin des Oliviers, 13400 Aubagne" },
    banque: "Crédit Mutuel",
  });
  const pages = await lirePages(octets);
  const texte = tout(pages);
  const septembre = pageDuMois(pages, "Septembre 2026");
  const octobre = pageDuMois(pages, "Octobre 2026");

  await test("le PDF s'ouvre, et dit la période, l'entreprise et la garde", async () => {
    assert.match(texte, /Dossier justifié/);
    assert.match(texte, /1er janvier 2026 au 31 octobre 2026/);
    assert.match(texte, /Jardins Exemple/);
    assert.match(texte, /gardé jusqu'au 31 octobre 2036/);
  });

  await test("les totaux, les mentions et les pièces réécrites y sont", async () => {
    assert.match(texte, /-3 846,15 €/, "le total des sorties manque");
    assert.match(texte, /\+3 004,00 €/, "le total des entrées manque");
    assert.match(texte, /Ticket perdu, mention validée/);
    assert.match(texte, /Justifié par sa nature : impôts, cotisations/);
    assert.match(texte, /Facture F2026-000028, émise par Atlas/);
    assert.match(texte, /TOTAL TTC/);
    assert.match(texte, /Pépinières Durand/);
  });

  await test("une photo illisible n'empêche pas le dossier de sortir, et sa place le dit", async () => {
    assert.match(texte, /Photo non lisible ici/);
  });

  await test("la première page dit d'abord que tout est justifié, puis les chiffres, les mois et les catégories", async () => {
    const t = pages[0].texte;
    const ordre = ["Chaque ligne de la banque a son justificatif", "SORTIES", "Mois par mois", "Les dépenses du 1er janvier au 31 octobre, par catégorie"].map((m) => t.indexOf(m));
    assert.ok(ordre.every((k) => k >= 0), `il manque un morceau de la première page : ${ordre}`);
    assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, "la première page ne suit pas l'ordre de la planche");
    // Les catégories en noir, avec leur part : un montant, pas une sortie signée.
    assert.match(t, /Carburant 135,25 € \d+ %/);
    assert.match(t, /CATÉGORIE MONTANT PART/);
    assert.doesNotMatch(texte, /En un coup d'œil/, "la page du coup d'œil a rejoint la première");
  });

  await test("chaque mois commence sa page, et le sommaire y mène", async () => {
    assert.ok(septembre, "septembre n'a pas sa page");
    assert.ok(octobre, "octobre n'a pas sa page");
    assert.notEqual(septembre.numero, octobre.numero);
    assert.doesNotMatch(septembre.texte, /Octobre 2026|CB TOTALENERGIES/, "octobre a commencé sur la page de septembre");
    const versSeptembre = pages[0].liens.find((k) => k.texte.startsWith("Septembre 2026"));
    assert.equal(versSeptembre?.vers, septembre.numero, "la ligne de septembre du sommaire ne mène pas à sa page");
  });

  await test("chaque page d'un mois porte les titres de ses colonnes", async () => {
    const long = await lirePages(
      await dossier(
        Array.from({ length: 24 }, (_, i) =>
          ligne({ jour: `2026-08-${String(i + 1).padStart(2, "0")}`, libelle: `PRLV LOYER ${i}`, sens: "sortie", montant: "650.00", categorie: "virement", motif: "loyer" })
        )
      )
    );
    const suite = long.filter((p) => p.texte.startsWith("Août 2026, suite"));
    assert.ok(suite.length > 0, "vingt-quatre lignes auraient dû passer sur une seconde page");
    for (const p of [pageDuMois(long, "Août 2026"), ...suite]) assert.match(p?.texte ?? "", COLONNES, `la page ${p?.numero} n'a pas ses colonnes`);
    assert.match(pageDuMois(long, "Août 2026")?.texte ?? "", new RegExp(`Suite d'août page ${suite[0].numero}`));
  });

  await test("huit lignes d'un mois court tiennent sur sa page : la case prend la hauteur de sa pièce", async () => {
    const ticket = (j: string, f: string, m: string) =>
      ligne({ jour: `2026-01-${j}`, libelle: `CB ${f}`, sens: "sortie", montant: m, categorie: "materiel", piece: { genre: "ticket", fournisseur: f, date: `2026-01-${j}`, totalTtc: m, tva: "1.00", photo: null, lignes: null }, ecart: { genre: "juste" } });
    const facture = (j: string, s: string, m: string) =>
      ligne({ jour: `2026-01-${j}`, libelle: `VIR ${s}`, sens: "sortie", montant: m, categorie: "virement", piece: { genre: "facture", societe: s, nom: "Facture", totalTtc: m, fichier: null }, ecart: { genre: "juste" } });
    const janvier = await lirePages(
      await dossier([
        ticket("03", "LEROY MERLIN", "48.90"),
        ticket("07", "POINT P", "412.30"),
        ticket("12", "TOTAL ENERGIES", "67.89"),
        ticket("19", "LE RELAIS", "56.00"),
        facture("21", "PEPINIERES RIVIERE", "1284.00"),
        facture("26", "MOTOCULTURE OUEST", "1450.00"),
        ligne({ jour: "2026-01-05", libelle: "PRLV SCI LES HAUTS", sens: "sortie", montant: "650.00", categorie: "virement", motif: "loyer" }),
        ligne({ jour: "2026-01-16", libelle: "PRLV URSSAF", sens: "sortie", montant: "1120.00", categorie: "virement", motif: "impots" }),
      ])
    );
    assert.equal(janvier.length, 2, `la couverture et janvier, rien d'autre : ${janvier.length} pages`);
  });

  await test("le motif d'une ligne se dit avec les mots de son sens", async () => {
    assert.match(texte, /Justifié par sa nature : mon argent perso/, "l'argent reçu de soi porte le mot d'une sortie");
    assert.match(texte, /Justifié par sa nature : pour moi/);
  });

  await test("l'écart d'une pièce jointe quand même s'écrit sous elle", async () => {
    assert.match(texte, /Facture Motoculture Ouest de 1 386,40 €, pas le montant/);
    assert.match(texte, /Ticket Esso de 52,00 €, pas le montant/);
    assert.match(texte, /Facture F-2026-012, payée en partie/);
    assert.equal(texte.match(/pas le montant|payée en partie/g)?.length, 3, "une pièce juste a reçu une mention d'écart");
  });

  await test("la facture faite hors d'Atlas justifie son virement, et son fichier est posé au bout, aller et retour", async () => {
    assert.ok(octobre);
    assert.match(octobre.texte, /Facture faite hors d'Atlas Total TTC 640,00 €/);
    const voir = octobre.liens.filter((k) => k.texte === "Voir la facture");
    const cibles = voir.map((k) => pages[k.vers - 1]).filter((p) => p.texte.includes("VIR SCI DU PARC"));
    assert.equal(cibles.length, 1, "aucun « Voir la facture » ne mène au fichier de la facture faite hors d'Atlas");
    const [bout] = cibles;
    assert.equal(bout.texte.match(/Retour à la ligne/g)?.length, 1, "une facture tient sa page à elle seule");
    assert.ok(bout.liens.some((k) => k.texte === "Retour à la ligne du 20 octobre" && k.vers === octobre.numero), "le retour ne ramène pas à la ligne");
  });

  await test("sous une facture « Voir la facture », sous un ticket « Voir la photo »", async () => {
    assert.equal(liensVers(pages, /^Voir la photo$/).length, 2, "deux tickets ont leur photo");
    assert.equal(liensVers(pages, /^Voir la facture$/).length, 3, "deux factures reçues et une faite hors d'Atlas ont leur fichier");
  });

  await test("chaque photo du bout porte sa ligne de banque", async () => {
    for (const { vers, texte: voir } of liensVers(pages, /^Voir la (photo|facture)$/)) {
      const bout = pages[vers - 1];
      assert.match(bout.texte, /^Les photos des justificatifs/, `« ${voir} » ne mène pas aux photos`);
    }
    const photos = pages.filter((p) => p.texte.startsWith("Les photos des justificatifs")).map((p) => p.texte).join("\n");
    for (const l of ["CB TOTALENERGIES ST JEAN", "CB ESSO", "VIR SEPA PEPINIERES DURAND", "VIR SEPA FACTURE ABIMEE", "VIR SCI DU PARC"]) assert.match(photos, new RegExp(l), `la photo de ${l} n'a pas sa ligne de banque`);
  });

  await test("chaque lien vise une page, et les allers ont leurs retours", async () => {
    const toutes = pages.filter((p) => p.liens.length > 0);
    assert.ok(toutes.length > 0, "aucun lien : le contrôle ne mesure rien");
    for (const p of toutes) for (const k of p.liens) assert.ok(k.vers > 0, `page ${p.numero} : un lien vise une page inconnue`);
    // Chaque lien d'une page de mois ou de photos a son retour ; la première
    // page mène aux mois, sans retour.
    for (const p of toutes.filter((x) => x.numero > 1)) {
      for (const k of p.liens) assert.ok(pages[k.vers - 1].liens.some((r) => r.vers === p.numero), `page ${p.numero} mène à ${k.vers}, qui ne ramène pas à ${p.numero}`);
    }
  });

  await test("les tickets perdus suivent le dernier mois, avec leur total, et la première page dit où", async () => {
    const perdus = pages.find((p) => /Les tickets perdus/.test(p.texte));
    assert.ok(perdus && octobre, "les tickets perdus n'ont pas leur place");
    const premierePhoto = pages.findIndex((p) => p.texte.startsWith("Les photos des justificatifs")) + 1;
    assert.ok(perdus.numero >= octobre.numero && perdus.numero < premierePhoto, `les tickets perdus sont page ${perdus.numero}`);
    const section = perdus.texte.slice(perdus.texte.indexOf("Les tickets perdus"));
    assert.match(section, /CB LA POSTE/);
    assert.match(section, /CB LA MIE CALINE/);
    assert.match(section, /Total -80,90 €/);
    assert.match(pages[0].texte, new RegExp(`2 tickets perdus déclarés \\(page ${perdus.numero}\\)`));
  });

  await test("six tickets se partagent une page, une facture prend la sienne", async () => {
    const tickets = Array.from({ length: 7 }, (_, i) =>
      ligne({ jour: `2026-03-${String(i + 2).padStart(2, "0")}`, libelle: `CB CASTORAMA ${i}`, sens: "sortie", montant: "12.00", categorie: "materiel", piece: { genre: "ticket", fournisseur: "Castorama", date: `2026-03-0${i + 1}`, totalTtc: "12.00", tva: "2.00", photo: { octets: PNG, nature: "image" }, lignes: null }, ecart: { genre: "juste" } })
    );
    const facture = ligne({ jour: "2026-03-20", libelle: "VIR POINT P", sens: "sortie", montant: "300.00", categorie: "virement", piece: { genre: "facture", societe: "Point P", nom: "Facture", totalTtc: "300.00", fichier: { octets: pdf, nature: "pdf" } }, ecart: { genre: "juste" } });
    const photos = (await lirePages(await dossier([...tickets, facture]))).filter((p) => p.texte.startsWith("Les photos des justificatifs"));
    assert.deepEqual(photos.map((p) => p.texte.match(/Retour à la ligne/g)?.length), [6, 1, 1]);
    assert.match(photos[2].texte, /VIR POINT P/);
  });

  // ─── Lot 5 : le ticket recopié ligne par ligne ─────────────────────────────
  const recopie = (lignesDuTicket: { gauche: string; droite: string | null }[], totalTtc: string): LignePourLeDossier =>
    ligne({
      jour: "2026-10-22",
      libelle: "CB INTERMARCHE MANTES",
      sens: "sortie",
      montant: totalTtc,
      categorie: "repas",
      piece: { genre: "ticket", fournisseur: "INTERMARCHE", date: "2026-10-22", totalTtc, tva: "1.57", photo: null, lignes: lignesDuTicket },
      ecart: { genre: "juste" },
    });
  const seul = (l: LignePourLeDossier) => dossier([l], { du: "2026-10-01" });

  await test("le ticket recopié garde chaque ligne, doublons compris, et surligne SA ligne du total", async () => {
    const t = tout(
      await lirePages(
        await seul(
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
    const lues = await lirePages(await seul(recopie(longues, "150.00")));
    const t = tout(lues);
    for (const i of [0, 74, 75, 149]) assert.match(t, new RegExp(`ARTICLE ${i} `), `la ligne ${i} manque`);
    assert.match(t, /Suite du ticket du 22 octobre 2026/);
    // Sans ligne du total, il s'ajoute à part, surligné.
    assert.match(t, /TOTAL TTC 150,00 €/);
    assert.ok(lues.length >= 3, "le ticket aurait dû déborder sur une seconde page");
    for (const p of lues.slice(1)) assert.match(p.texte, COLONNES, `la page ${p.numero} n'a pas ses colonnes`);
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
