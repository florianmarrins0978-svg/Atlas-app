import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument, PDFName, rgb } from "pdf-lib";
import { composerDossierComptable, type DonneesDossier, type LignePourLeDossier, type PieceDeLaLigne } from "../src/server/pdf/dossier-comptable-pdf";
import type { CleCompta } from "../src/lib/categories-comptables";
import { registreDesVentes, type FactureDuDossier } from "../src/lib/dossier-du-comptable";
import { textesGris } from "./_couleurs-du-texte-pdf";

// POUR MON COMPTABLE — le PDF du dossier, ouvert et relu.
//
// Ce que la suite défend, sans base ni navigateur :
//   · le PDF s'ouvre, et dit ce qu'il doit dire (période, totaux, mentions) ;
//   · ses choix du 24 novembre 2026 (`appli/soignee/comptable-trois-fichiers.html`) :
//     la première page dit que tout est justifié, puis les quatre chiffres,
//     puis ce que range le dossier, compte par compte, avec sa page ; le
//     registre des ventes ; une page par catégorie sous son compte, chaque
//     ligne avec le numéro de sa pièce, son hors taxe et sa TVA ;
//   · le ticket réécrit de la planche B (`appli/soignee/ticket-lisible.html`) :
//     lisible, sa photo nettoyée dessous ;
//   · chaque « Voir la photo » mène à la page de SA photo, et chaque « Retour
//     à la ligne » ramène à la page de SA ligne : les liens visent une page,
//     jamais un nom (sa remarque du 23 octobre, « ça marche pas ») ;
//   · une photo illisible n'empêche pas le dossier de sortir ;
//   · une facture tient une page entière, six tickets tiennent une page ;
//   · aucun texte n'est gris.
// Ce sont des RÈGLES et des LIENS qui se contrôlent ici, jamais une position
// au point près.

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

const COMPTES = { ventes: "706", clients: "411", tvaCollectee: "44571", tvaEnAttente: "44574", tvaDeductible: "44566", tvaImmobilisations: "44562" };
const COMPTE: Partial<Record<CleCompta, string>> = { carburant: "6061", materiaux: "601", aClasser: "471", impots: "635", prelevement: "108", loyer: "6132", clients: "411", apport: "108", repas: "6256", remboursement: "471" };

/** Une ligne du dossier ; ce qui n'est pas dit est ce qu'une ligne sans pièce porte. */
function ligne(l: { jour: string; libelle: string; sens: "entree" | "sortie"; montant: string } & Partial<LignePourLeDossier>): LignePourLeDossier {
  const { montant, ...reste } = l;
  const ttc = Math.round(Number(montant) * 100);
  const cle = l.cle ?? (l.sens === "entree" ? "remboursement" : "aClasser");
  return {
    ref: "A 001",
    ttc,
    ht: ttc,
    tva: 0,
    tvaNonLue: false,
    cle,
    compte: COMPTE[cle] ?? "471",
    compteTva: null,
    tiers: null,
    pieceDate: null,
    achat: false,
    facture: null,
    justificatif: "motif",
    pieceEnMots: "",
    piece: null,
    ticketPerdu: false,
    motif: null,
    ecart: { genre: "inconnu" },
    ...reste,
  };
}
const ticket = (t: Partial<Extract<PieceDeLaLigne, { genre: "ticket" }>> & { fournisseur: string; date: string; totalTtc: string | null }): PieceDeLaLigne => ({
  genre: "ticket",
  tva: null,
  photo: null,
  photoNette: null,
  lignes: null,
  ...t,
});

const SANS_VENTES = { periode: [], avant: [] };
const composer = (lignes: LignePourLeDossier[], autour: Partial<DonneesDossier> = {}) =>
  composerDossierComptable({
    entreprise: { nom: "Jardins Exemple", siret: null, adresse: null },
    banque: null,
    du: "2026-01-01",
    au: "2026-10-31",
    rangeLe: "2026-11-02",
    gardeJusquAu: "2036-10-31",
    lignes,
    ventes: SANS_VENTES,
    comptes: COMPTES,
    exigibilite: "encaissements",
    franchise: false,
    ...autour,
  });
const dossier = async (lignes: LignePourLeDossier[], autour: Partial<DonneesDossier> = {}) => (await composer(lignes, autour)).pdf;

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
const COLONNES = /PIÈCE DATE LIGNE DE BANQUE TTC JUSTIFICATIF/;
/** La page où commence une catégorie : son titre, et les titres des colonnes. */
const pageDe = (pages: PageLue[], titre: string) => pages.find((p) => p.texte.startsWith(titre) && !p.texte.startsWith(`${titre}, suite`) && COLONNES.test(p.texte));

/** Les ventes d'octobre de la planche : une facture soldée, une payée en partie et corrigée d'un avoir, une d'avant. */
const FACTURES: FactureDuDossier[] = [
  { numero: "F-2026-038", date: "2026-09-17", client: "M. Lefèvre", chantier: "Création de massif", parTaux: [{ taux: "10.00", ht: 234000, tva: 23400 }], ht: 234000, tva: 23400, ttc: 257400, avoirs: [], paiements: [{ date: "2026-10-08", montant: 257400 }] },
  { numero: "F-2026-041", date: "2026-10-05", client: "Mairie de Cholet", chantier: "Élagage des platanes", parTaux: [{ taux: "20.00", ht: 315000, tva: 63000 }], ht: 315000, tva: 63000, ttc: 378000, avoirs: [], paiements: [{ date: "2026-10-20", montant: 378000 }] },
  {
    numero: "F-2026-042",
    date: "2026-10-12",
    client: "M. Roux",
    chantier: "Arrosage automatique",
    parTaux: [
      { taux: "10.00", ht: 290000, tva: 29000 },
      { taux: "20.00", ht: 40000, tva: 8000 },
    ],
    ht: 330000,
    tva: 37000,
    ttc: 367000,
    avoirs: [{ numero: "AV-2026-001", date: "2026-10-28", parTaux: [{ taux: "20.00", ht: 10000, tva: 2000 }], ht: 10000, tva: 2000, ttc: 12000 }],
    paiements: [{ date: "2026-10-25", montant: 100000 }],
  },
];

async function main() {
  const pdf = await facturePdf();
  const lignes: LignePourLeDossier[] = [
    ligne({ ref: "A 181", jour: "2026-10-14", libelle: "CB LA MIE CALINE", sens: "sortie", montant: "62.40", cle: "repas", ticketPerdu: true, justificatif: "perdu" }),
    ligne({ ref: "A 182", jour: "2026-10-14", libelle: "CB TOTALENERGIES ST JEAN", sens: "sortie", montant: "81.15", cle: "carburant", ht: 6762, tva: 1353, compteTva: "44566", piece: ticket({ fournisseur: "TotalEnergies", date: "2026-10-13", totalTtc: "81.15", tva: "13.53", photo: { octets: PNG, nature: "image" } }), ecart: { genre: "juste" } }),
    ligne({ ref: "A 183", jour: "2026-10-24", libelle: "VIR SEPA PEPINIERES DURAND", sens: "sortie", montant: "1740.00", cle: "materiaux", ht: 145000, tva: 29000, compteTva: "44566", achat: true, piece: { genre: "facture", societe: "Pépinières Durand", nom: "Facture 2026-418", totalTtc: "1740.00", fichier: { octets: pdf, nature: "pdf" } }, ecart: { genre: "juste" } }),
    ligne({ ref: "F2026-000028", jour: "2026-10-21", libelle: "VIR LALA FACTURE F2026-28", sens: "entree", montant: "1200.00", cle: "clients", piece: { genre: "facture-emise", numero: "F2026-000028" }, ecart: { genre: "juste" } }),
    ligne({ ref: "A 184", jour: "2026-10-02", libelle: "VIR SEPA FACTURE ABIMEE", sens: "sortie", montant: "10.00", cle: "materiaux", tvaNonLue: true, piece: { genre: "facture", societe: "Fournisseur X", nom: "Facture abîmée", totalTtc: "10.00", fichier: { octets: await pdfVide(), nature: "pdf" } }, ecart: { genre: "juste" } }),
    ligne({ ref: "A 185", jour: "2026-10-20", libelle: "VIR SCI DU PARC", sens: "entree", montant: "640.00", cle: "clients", piece: { genre: "facture-hors-atlas", totalTtc: "640.00", fichier: { octets: pdf, nature: "pdf" } }, ecart: { genre: "juste" } }),
    ligne({ ref: "A 186", jour: "2026-10-18", libelle: "VIR SARL MOTOCULTURE OUEST", sens: "sortie", montant: "1450.00", cle: "materiaux", piece: { genre: "facture", societe: "Motoculture Ouest", nom: "Facture débroussailleuse", totalTtc: "1386.40", fichier: null }, ecart: { genre: "ecart", ligne: 145000, piece: 138640 } }),
    ligne({ ref: "F-2026-012", jour: "2026-10-16", libelle: "VIR M DUPONT ACOMPTE", sens: "entree", montant: "864.00", cle: "clients", piece: { genre: "facture-emise", numero: "F-2026-012" }, ecart: { genre: "ecart", ligne: 86400, piece: 172800 } }),
    ligne({ ref: "A 187", jour: "2026-10-09", libelle: "VIR MARTIN REMBOURSEMENT", sens: "entree", montant: "300.00", cle: "apport", motif: "perso" }),
    ligne({ ref: "A 188", jour: "2026-10-05", libelle: "VIR VERS LIVRET", sens: "sortie", montant: "200.00", cle: "prelevement", motif: "perso" }),
    ligne({ ref: "A 171", jour: "2026-09-03", libelle: "PRLV URSSAF", sens: "sortie", montant: "230.00", cle: "impots", motif: "impots" }),
    ligne({ ref: "A 172", jour: "2026-09-08", libelle: "CB LA POSTE", sens: "sortie", montant: "18.50", ticketPerdu: true, justificatif: "perdu" }),
    ligne({ ref: "A 173", jour: "2026-09-10", libelle: "CB ESSO", sens: "sortie", montant: "54.10", cle: "carburant", ht: 4508, tva: 902, compteTva: "44566", piece: ticket({ fournisseur: "Esso", date: "2026-09-09", totalTtc: "52.00", tva: "8.67", photo: { octets: Uint8Array.from([1, 2, 3, 4]), nature: "image" } }), ecart: { genre: "ecart", ligne: 5410, piece: 5200 } }),
  ];
  const ventes = registreDesVentes(FACTURES, "2026-10-01", "2026-10-31");
  const compose = await composer(lignes, {
    entreprise: { nom: "Jardins Exemple", siret: "000 000 000 00000", adresse: "12 chemin des Oliviers, 13400 Aubagne" },
    banque: "Crédit Mutuel",
    ventes,
  });
  const octets = compose.pdf;
  const pages = await lirePages(octets);
  const texte = tout(pages);
  const carburant = pageDe(pages, "Carburant 6061");
  const materiaux = pageDe(pages, "Matériaux et plants 601");
  const clients = pageDe(pages, "Les paiements des clients 411");

  await test("le PDF s'ouvre, et dit la période, l'entreprise et la garde", async () => {
    assert.match(texte, /Dossier justifié/);
    assert.match(texte, /1er janvier 2026 au 31 octobre 2026/);
    assert.match(texte, /Jardins Exemple/);
    assert.match(texte, /gardé jusqu'au 31 octobre 2036, avec son Excel et son FEC/);
  });

  await test("les mentions et les pièces réécrites y sont", async () => {
    assert.match(texte, /Ticket perdu, mention validée/);
    assert.match(texte, /Justifié par sa nature : impôts, cotisations/);
    assert.match(texte, /Facture F2026-000028, émise par Cause/);
    assert.match(texte, /Total TTC/);
    assert.match(texte, /Pépinières Durand/);
  });

  await test("une photo illisible n'empêche pas le dossier de sortir, et sa place le dit", async () => {
    assert.match(texte, /Photo non lisible ici/);
  });

  // Sa demande du 24 novembre 2026, devant la planche des trois fichiers :
  // « vu que c'est des documents comptables, il faut que ça soit lisible
  // facilement ; tout ce qui est gris clair, tu le mets en noir ; ce que tu
  // veux faire ressortir, soit tu modifies la police, soit tu mets en gras ».
  await test("aucun texte n'est écrit en gris : un document comptable se lit en noir", async () => {
    const { total, encre, grises } = await textesGris(octets);
    // Une relecture qui ne trouverait aucun texte ne prouverait rien.
    assert.ok(total > 50, "presque aucun texte relu : le contrôle ne mesure rien");
    assert.ok(encre, "l'encre du document n'a pas été relue");
    assert.deepEqual(grises, [], `des textes sont écrits en gris : ${grises.join(", ")}`);
  });

  await test("la première page dit d'abord que tout est justifié, puis les chiffres, puis ce que range le dossier", async () => {
    const t = pages[0].texte;
    const ordre = ["Chaque ligne de la banque a son justificatif", "FACTURÉ HORS TAXE", "Ce que range le dossier", "Le fichier au format FEC joint remplit votre logiciel"].map((m) => t.indexOf(m));
    assert.ok(ordre.every((k) => k >= 0), `il manque un morceau de la première page : ${ordre}`);
    assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, "la première page ne suit pas l'ordre de la planche");
    // Le hors taxe facturé (avoir retiré), l'encaissé des clients, le reste dû, les dépenses.
    assert.match(t, /FACTURÉ HORS TAXE 6 350,00 € ENCAISSÉ \+2 704,00 € RESTE DÛ 2 550,00 € DÉPENSES -3 846,15 €/);
    const ligneDuSommaire = (debut: string) => pages[0].liens.find((k) => k.texte.startsWith(debut))?.texte;
    assert.equal(ligneDuSommaire("706 Registre des ventes"), "706 Registre des ventes 2 factures +7 330,00 € 2");
    assert.match(ligneDuSommaire("6061 Carburant") ?? "", /^6061 Carburant 2 -135,25 € \d+$/);
    assert.match(t, /Le FEC de l'exercice reste celui que votre logiciel produit à la clôture/);
  });

  await test("chaque catégorie commence sa page, sous son compte, et le sommaire y mène avec le bon numéro", async () => {
    assert.ok(carburant && materiaux && clients, "une catégorie n'a pas sa page");
    assert.notEqual(carburant.numero, materiaux.numero);
    assert.doesNotMatch(carburant.texte, /PEPINIERES DURAND/, "une autre catégorie a commencé sur la page du carburant");
    const versCarburant = pages[0].liens.find((k) => k.texte.startsWith("6061 Carburant"));
    assert.equal(versCarburant?.vers, carburant.numero, "la ligne du carburant du sommaire ne mène pas à sa page");
    assert.match(versCarburant!.texte, new RegExp(` ${carburant.numero}$`), "le numéro de page du sommaire est faux");
    assert.equal(compose.pageDe.carburant, carburant.numero, "l'Excel citerait une autre page que le PDF");
    // L'ordre du réglage : les paiements des clients après le registre, puis les dépenses.
    assert.ok(clients.numero < materiaux.numero && materiaux.numero < carburant.numero);
  });

  await test("chaque ligne porte le numéro de sa pièce, et sous elle son hors taxe et sa TVA", async () => {
    assert.ok(carburant && materiaux);
    assert.match(carburant.texte, /A 173 10\/09 CB ESSO HT 45,08 €, TVA 9,02 € -54,10 €/);
    assert.match(carburant.texte, /^Carburant 6061 HT 112,70 €, TVA 22,55 €, TTC -135,25 €/, "le bilan de la catégorie manque");
    assert.match(carburant.texte, /TVA déduite au 44566\./);
    assert.match(materiaux.texte, /A 184 02\/10 VIR SEPA FACTURE ABIMEE TVA à lire sur la pièce/);
    // Les lignes d'une catégorie se suivent par date : septembre avant octobre.
    assert.ok(carburant.texte.indexOf("CB ESSO") < carburant.texte.indexOf("CB TOTALENERGIES"));
    assert.match(clients!.texte, /F2026-000028 21\/10 VIR LALA/, "un paiement de client ne porte pas le numéro de sa facture");
  });

  await test("le registre des ventes compte les avoirs, les règlements, et les factures d'avant payées pendant", async () => {
    const r = pages.find((p) => p.texte.startsWith("Registre des ventes 706"));
    assert.ok(r, "le registre n'a pas sa page");
    assert.match(r.texte, /N° DATE CLIENT, CHANTIER HT TVA 10 % TVA 20 % TTC PAYÉE LE RESTE DÛ/);
    assert.match(r.texte, /F-2026-042 12\/10 M\. Roux Arrosage automatique 3 300,00 € 290,00 € 80,00 € 3 670,00 € 25\/10 en partie 2 550,00 €/);
    assert.match(r.texte, /AV-2026-001 28\/10 M\. Roux Avoir sur F-2026-042 -100,00 € 0,00 € -20,00 € -120,00 €/);
    assert.match(r.texte, /Total 6 350,00 € 290,00 € 690,00 € 7 330,00 € 2 550,00 €/);
    assert.match(r.texte, /Payées du 1er janvier au 31 octobre, facturées avant/);
    assert.match(r.texte, /F-2026-038 17\/09\/2026 M\. Lefèvre, Création de massif 2 574,00 € 08\/10 0,00 €/);
    assert.match(r.texte, /TVA en attente du paiement au 44574, due au 44571 quand le client paie/);
    const franchise = (await lirePages(await dossier([], { ventes, franchise: true }))).find((p) => p.texte.startsWith("Registre des ventes"));
    assert.match(franchise?.texte ?? "", /TVA non applicable, article 293 B du CGI/);
    assert.doesNotMatch(franchise?.texte ?? "", /TVA 10 %/, "une franchise n'a pas de colonne de TVA");
  });

  await test("sans aucune facture de Cause, le dossier n'a pas de registre", async () => {
    const sans = await lirePages(await dossier([ligne({ jour: "2026-03-02", libelle: "PRLV LOYER", sens: "sortie", montant: "650.00", cle: "loyer", motif: "loyer" })]));
    assert.ok(!sans.some((p) => p.texte.startsWith("Registre des ventes")));
    assert.doesNotMatch(sans[0].texte, /Registre des ventes/);
  });

  await test("chaque page d'une catégorie porte les titres de ses colonnes, et dit où elle continue", async () => {
    const long = await lirePages(
      await dossier(
        Array.from({ length: 30 }, (_, i) =>
          ligne({ ref: `A ${String(i + 1).padStart(3, "0")}`, jour: `2026-08-${String((i % 28) + 1).padStart(2, "0")}`, libelle: `PRLV LOYER ${i}`, sens: "sortie", montant: "650.00", cle: "loyer", motif: "loyer" })
        )
      )
    );
    const suite = long.filter((p) => p.texte.startsWith("Loyer, suite"));
    assert.ok(suite.length > 0, "trente lignes auraient dû passer sur une seconde page");
    for (const p of [pageDe(long, "Loyer 6132"), ...suite]) assert.match(p?.texte ?? "", COLONNES, `la page ${p?.numero} n'a pas ses colonnes`);
    assert.match(pageDe(long, "Loyer 6132")?.texte ?? "", new RegExp(`Suite page ${suite[0].numero}`));
  });

  await test("huit lignes en trois catégories tiennent sur leurs pages : la case prend la hauteur de sa pièce", async () => {
    const t = (j: string, f: string, m: string) =>
      ligne({ jour: `2026-01-${j}`, libelle: `CB ${f}`, sens: "sortie", montant: m, cle: "materiaux", piece: ticket({ fournisseur: f, date: `2026-01-${j}`, totalTtc: m, tva: "1.00" }), ecart: { genre: "juste" } });
    const f = (j: string, s: string, m: string) =>
      ligne({ jour: `2026-01-${j}`, libelle: `VIR ${s}`, sens: "sortie", montant: m, cle: "materiaux", piece: { genre: "facture", societe: s, nom: "Facture", totalTtc: m, fichier: null }, ecart: { genre: "juste" } });
    const janvier = await lirePages(
      await dossier([
        t("03", "LEROY MERLIN", "48.90"),
        t("07", "POINT P", "412.30"),
        t("12", "TOTAL ENERGIES", "67.89"),
        t("19", "LE RELAIS", "56.00"),
        f("21", "PEPINIERES RIVIERE", "1284.00"),
        f("26", "MOTOCULTURE OUEST", "1450.00"),
        ligne({ jour: "2026-01-05", libelle: "PRLV SCI LES HAUTS", sens: "sortie", montant: "650.00", cle: "loyer", motif: "loyer" }),
        ligne({ jour: "2026-01-16", libelle: "PRLV URSSAF", sens: "sortie", montant: "1120.00", cle: "impots", motif: "impots" }),
      ])
    );
    assert.equal(janvier.length, 4, `la couverture et trois catégories, rien d'autre : ${janvier.length} pages`);
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

  await test("la facture faite hors de Cause justifie son virement, et son fichier est posé au bout, aller et retour", async () => {
    assert.ok(clients);
    assert.match(clients.texte, /Facture faite hors de Cause Total TTC 640,00 €/);
    const voir = clients.liens.filter((k) => /^Voir la facture, page \d+$/.test(k.texte));
    const cibles = voir.map((k) => pages[k.vers - 1]).filter((p) => p.texte.includes("VIR SCI DU PARC"));
    assert.equal(cibles.length, 1, "aucun « Voir la facture » ne mène au fichier de la facture faite hors de Cause");
    const [bout] = cibles;
    assert.equal(bout.texte.match(/Retour à la ligne/g)?.length, 1, "une facture tient sa page à elle seule");
    assert.ok(bout.liens.some((k) => k.texte === `Retour à la ligne, page ${clients.numero}` && k.vers === clients.numero), "le retour ne ramène pas à la ligne");
    assert.match(voir[0].texte, new RegExp(`page ${bout.numero}$`), "« Voir la facture » annonce une autre page que celle où il mène");
  });

  await test("sous une facture « Voir la facture », sous un ticket « Voir la photo »", async () => {
    assert.equal(liensVers(pages, /^Voir la photo, page \d+$/).length, 2, "deux tickets ont leur photo");
    assert.equal(liensVers(pages, /^Voir la facture, page \d+$/).length, 3, "deux factures reçues et une faite hors de Cause ont leur fichier");
  });

  await test("chaque photo du bout porte le numéro de sa pièce et sa ligne de banque", async () => {
    for (const { vers, texte: voir } of liensVers(pages, /^Voir la (photo|facture)/)) {
      const bout = pages[vers - 1];
      assert.match(bout.texte, /^Les photos des justificatifs/, `« ${voir} » ne mène pas aux photos`);
    }
    const photos = pages.filter((p) => p.texte.startsWith("Les photos des justificatifs")).map((p) => p.texte).join("\n");
    for (const l of ["A 182 CB TOTALENERGIES ST JEAN", "A 173 CB ESSO", "A 183 VIR SEPA PEPINIERES DURAND", "A 184 VIR SEPA FACTURE ABIMEE", "A 185 VIR SCI DU PARC"]) assert.match(photos, new RegExp(l), `la photo de ${l} n'a pas sa pièce et sa ligne`);
  });

  await test("chaque lien vise une page, et les allers ont leurs retours", async () => {
    const toutes = pages.filter((p) => p.liens.length > 0);
    assert.ok(toutes.length > 0, "aucun lien : le contrôle ne mesure rien");
    for (const p of toutes) for (const k of p.liens) assert.ok(k.vers > 0, `page ${p.numero} : un lien vise une page inconnue`);
    // Chaque lien d'une page de catégorie ou de photos a son retour ; la
    // première page mène aux catégories, sans retour.
    for (const p of toutes.filter((x) => x.numero > 1)) {
      for (const k of p.liens) assert.ok(pages[k.vers - 1].liens.some((r) => r.vers === p.numero), `page ${p.numero} mène à ${k.vers}, qui ne ramène pas à ${p.numero}`);
    }
  });

  await test("les tickets perdus suivent la dernière catégorie, avec leur total, et la première page dit où", async () => {
    const perdus = pages.find((p) => /Les tickets perdus 2 lignes/.test(p.texte));
    assert.ok(perdus && carburant, "les tickets perdus n'ont pas leur place");
    const premierePhoto = pages.findIndex((p) => p.texte.startsWith("Les photos des justificatifs")) + 1;
    assert.ok(perdus.numero >= carburant.numero && perdus.numero < premierePhoto, `les tickets perdus sont page ${perdus.numero}`);
    const section = perdus.texte.slice(perdus.texte.indexOf("Les tickets perdus"));
    assert.match(section, /A 172 8 septembre 2026 CB LA POSTE/);
    assert.match(section, /A 181 14 octobre 2026 CB LA MIE CALINE/);
    assert.match(section, /Total -80,90 €/);
    const versPerdus = pages[0].liens.find((k) => k.texte.startsWith("Les tickets perdus 2 -80,90 €"));
    assert.equal(versPerdus?.vers, perdus.numero, "la première page ne mène pas aux tickets perdus");
    assert.match(versPerdus!.texte, new RegExp(` ${perdus.numero}$`));
  });

  await test("six tickets se partagent une page, une facture prend la sienne", async () => {
    const tickets = Array.from({ length: 7 }, (_, i) =>
      ligne({ jour: `2026-03-${String(i + 2).padStart(2, "0")}`, libelle: `CB CASTORAMA ${i}`, sens: "sortie", montant: "12.00", cle: "materiaux", piece: ticket({ fournisseur: "Castorama", date: `2026-03-0${i + 1}`, totalTtc: "12.00", tva: "2.00", photo: { octets: PNG, nature: "image" } }), ecart: { genre: "juste" } })
    );
    const facture = ligne({ jour: "2026-03-20", libelle: "VIR POINT P", sens: "sortie", montant: "300.00", cle: "materiaux", piece: { genre: "facture", societe: "Point P", nom: "Facture", totalTtc: "300.00", fichier: { octets: pdf, nature: "pdf" } }, ecart: { genre: "juste" } });
    const photos = (await lirePages(await dossier([...tickets, facture]))).filter((p) => p.texte.startsWith("Les photos des justificatifs"));
    assert.deepEqual(photos.map((p) => p.texte.match(/Retour à la ligne/g)?.length), [6, 1, 1]);
    assert.match(photos[2].texte, /VIR POINT P/);
  });

  // ─── Le ticket réécrit, sa planche B du 24 novembre 2026 ───────────────────
  const recopie = (lignesDuTicket: { gauche: string; droite: string | null }[], totalTtc: string, autour: Partial<Extract<PieceDeLaLigne, { genre: "ticket" }>> = {}): LignePourLeDossier =>
    ligne({
      jour: "2026-10-22",
      libelle: "CB INTERMARCHE MANTES",
      sens: "sortie",
      montant: totalTtc,
      cle: "repas",
      piece: ticket({ fournisseur: "INTERMARCHE", date: "2026-10-22", totalTtc, tva: "1.57", lignes: lignesDuTicket, ...autour }),
      ecart: { genre: "juste" },
    });
  const seul = (l: LignePourLeDossier) => dossier([l], { du: "2026-10-01" });

  await test("le ticket réécrit garde chaque ligne, doublons compris, lisible, et surligne SA ligne du total", async () => {
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
    // Les capitales d'un ticket se lisent mal : la planche B les écrit en phrase.
    assert.equal(t.match(/Real thai lait coco/g)?.length, 3, "un doublon a été regroupé ou perdu");
    assert.match(t, /INTERMARCHE 22 octobre 2026 Sas mafical/);
    assert.match(t, /Montant du 30,12 EUR/);
    // La ligne du ticket porte le total : aucun « Total TTC » ajouté par Cause.
    assert.doesNotMatch(t, /Total TTC/);
  });

  await test("sous le ticket réécrit, sa photo nettoyée, et « Voir la photo en grand » mène au bout", async () => {
    const avec = await lirePages(await seul(recopie([{ gauche: "PAIN", droite: "2,10" }], "2.10", { photo: { octets: PNG, nature: "image" }, photoNette: { octets: PNG, nature: "image" } })));
    const lien = liensVers(avec, /^Voir la photo en grand, page \d+$/);
    assert.equal(lien.length, 1, "la photo nettoyée n'est pas sous le ticket");
    assert.match(avec[lien[0].vers - 1].texte, /^Les photos des justificatifs/);
    const sans = await lirePages(await seul(recopie([{ gauche: "PAIN", droite: "2,10" }], "2.10", { photo: { octets: PNG, nature: "image" } })));
    assert.equal(liensVers(sans, /^Voir la photo, page \d+$/).length, 1, "un ticket d'avant garde son lien");
    // La photo nettoyée ne s'embarque qu'une fois, même posée deux fois (sous
    // le ticket et au bout) : autant d'images qu'un ticket qui n'a que sa photo.
    const images = async (o: Uint8Array) =>
      (await PDFDocument.load(o)).context.enumerateIndirectObjects().filter(([, x]) => (x as { dict?: { get: (n: unknown) => unknown } }).dict?.get(PDFName.of("Subtype")) === PDFName.of("Image")).length;
    const deux = await images(await seul(recopie([{ gauche: "PAIN", droite: "2,10" }], "2.10", { photo: { octets: PNG, nature: "image" }, photoNette: { octets: PNG, nature: "image" } })));
    const une = await images(await seul(recopie([{ gauche: "PAIN", droite: "2,10" }], "2.10", { photo: { octets: PNG, nature: "image" } })));
    assert.ok(une > 0, "aucune image relue : le contrôle ne mesure rien");
    assert.equal(deux, une, "la photo nettoyée est embarquée deux fois");
  });

  await test("un très long ticket continue sur la page suivante, sans perdre une ligne", async () => {
    const longues = Array.from({ length: 150 }, (_, i) => ({ gauche: `ARTICLE ${i}`, droite: "1,00 EUR" }));
    const lues = await lirePages(await seul(recopie(longues, "150.00")));
    const t = tout(lues);
    for (const i of [0, 74, 75, 149]) assert.match(t, new RegExp(`Article ${i} `), `la ligne ${i} manque`);
    assert.match(t, /Suite du ticket du 22 octobre 2026/);
    // Sans ligne du total, il s'ajoute à part, surligné.
    assert.match(t, /Total TTC 150,00 €/);
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
