import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import {
  codeDuTiers,
  montantsDeLaLigne,
  numerosDesPieces,
  ordreDesCategories,
  registreDesVentes,
  tauxDuRegistre,
  type FactureDuDossier,
  type LigneComptable,
} from "../src/lib/dossier-du-comptable";
import { COLONNES_FEC, ecrituresDuDossier, ecrituresEquilibrees, enIso885915, montantFec, nomDuFec, texteDuFec, type EntreeDuFec } from "../src/lib/fec-import";
import { feuillesDuDossier, nomDeLExcel, sortiesDansLOrdre } from "../src/lib/excel-du-dossier";
import { ecrireClasseur } from "../src/lib/xlsx";
import { lireClasseur } from "../src/server/import/lire-classeur";

// LE DOSSIER DU COMPTABLE EN TROIS FICHIERS — ce que le PDF, l'Excel et le FEC
// se partagent (sa planche du 24 novembre 2026,
// `appli/soignee/comptable-trois-fichiers.html`). Ce que la suite défend :
//   · le numéro d'une pièce suit l'année et ne se répète pas ;
//   · la TVA d'une ligne vient de sa pièce, au prorata du payé, et rien ne se
//     devine : une TVA non lue se dit ;
//   · le registre des ventes compte avoirs et règlements au dernier jour ;
//   · chaque écriture du FEC est équilibrée, à dix-huit colonnes, au format
//     de l'administration, et la TVA d'une vente suit son régime ;
//   · le fichier ne prend jamais le nom du FEC légal ;
//   · l'Excel s'ouvre, avec ses quatre onglets et ses totaux.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => void | Promise<void>) {
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

const COMPTES = { clients: "411", fournisseurs: "401", banque: "512", ventes: "706", tvaCollectee: "44571", tvaEnAttente: "44574" };

const factures: FactureDuDossier[] = [
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
    paiements: [
      { date: "2026-10-25", montant: 100000 },
      { date: "2026-11-03", montant: 50000 },
    ],
  },
];

const ligne = (l: Partial<LigneComptable> & Pick<LigneComptable, "ref" | "jour" | "libelle" | "sens" | "ttc" | "cle" | "compte">): LigneComptable => ({
  ht: l.ttc,
  tva: 0,
  tvaNonLue: false,
  compteTva: null,
  tiers: null,
  pieceDate: null,
  achat: false,
  facture: null,
  justificatif: "motif",
  pieceEnMots: "Par sa nature",
  ...l,
});

const lignes: LigneComptable[] = [
  ligne({ ref: "A 181", jour: "2026-10-02", libelle: "PRLV AXA FRANCE IARD", sens: "sortie", ttc: 10320, cle: "assurances", compte: "616" }),
  ligne({ ref: "F-2026-038", jour: "2026-10-08", libelle: "VIR M LEFEVRE", sens: "entree", ttc: 257400, cle: "clients", compte: "411", facture: { numero: "F-2026-038", client: "M. Lefèvre", tva: 23400, ttc: 257400 }, justificatif: "facture-emise" }),
  ligne({ ref: "A 182", jour: "2026-10-13", libelle: "CB TOTALENERGIES", sens: "sortie", ttc: 8115, ht: 6762, tva: 1353, cle: "carburant", compte: "6061", compteTva: "44566", tiers: "TotalEnergies", justificatif: "ticket", pieceEnMots: "Ticket" }),
  ligne({ ref: "A 183", jour: "2026-10-15", libelle: "VIR SEPA PEPINIERES DURAND", sens: "sortie", ttc: 174000, ht: 145000, tva: 29000, cle: "materiaux", compte: "601", compteTva: "44566", tiers: "Pépinières Durand", pieceDate: "2026-09-29", achat: true, justificatif: "facture", pieceEnMots: "Facture 2026-418" }),
  ligne({ ref: "F-2026-041", jour: "2026-10-20", libelle: "VIR MAIRIE DE CHOLET", sens: "entree", ttc: 378000, cle: "clients", compte: "411", facture: { numero: "F-2026-041", client: "Mairie de Cholet", tva: 63000, ttc: 378000 }, justificatif: "facture-emise" }),
  ligne({ ref: "F-2026-042", jour: "2026-10-25", libelle: "VIR ROUX", sens: "entree", ttc: 100000, cle: "clients", compte: "411", facture: { numero: "F-2026-042", client: "M. Roux", tva: 35000, ttc: 355000 }, justificatif: "facture-emise" }),
  ligne({ ref: "A 184", jour: "2026-10-28", libelle: "VIR SALAIRE OCTOBRE", sens: "sortie", ttc: 185000, cle: "salaires", compte: "421" }),
  ligne({ ref: "A 185", jour: "2026-10-30", libelle: "VIR LIVRET", sens: "entree", ttc: 50000, cle: "entreComptes", compte: "580" }),
];

const registre = registreDesVentes(factures, "2026-10-01", "2026-10-31");
const entree = (autour: Partial<EntreeDuFec> = {}): EntreeDuFec => ({
  du: "2026-10-01",
  au: "2026-10-31",
  exigibilite: "encaissements",
  franchise: false,
  comptes: COMPTES,
  ventes: registre.periode,
  lignes,
  ...autour,
});

async function main() {
  await test("le numéro d'une pièce suit l'année, et une ligne payée par une facture de Cause porte son numéro", () => {
    const n = numerosDesPieces(
      [
        { jour: "2026-12-29", factureEmise: null },
        { jour: "2026-12-30", factureEmise: "F-2026-090" },
        { jour: "2026-12-31", factureEmise: null },
        { jour: "2027-01-02", factureEmise: null },
      ],
      { "2026": 180 }
    );
    assert.deepEqual(n, ["A 181", "F-2026-090", "A 182", "A 001"]);
    assert.equal(numerosDesPieces([{ jour: "2026-03-01", factureEmise: null }], {})[0], "A 001");
    assert.equal(numerosDesPieces(Array.from({ length: 1000 }, () => ({ jour: "2026-05-01", factureEmise: null })), {}).at(-1), "A 1000");
  });

  await test("la TVA d'une ligne vient de sa pièce, ramenée au prorata de ce qui est sorti du compte", () => {
    const base = { cle: "carburant" as const, sens: "sortie" as const, franchise: false, perdu: false };
    assert.deepEqual(montantsDeLaLigne({ ...base, ttc: 8115, piece: { genre: "ticket", tva: 1353, ttc: 8115 } }), { ht: 6762, tva: 1353, tvaNonLue: false });
    // Le ticket dit 52,00 € dont 8,67 € de TVA, la banque 54,10 € : la TVA suit le payé.
    assert.equal(montantsDeLaLigne({ ...base, ttc: 5410, piece: { genre: "ticket", tva: 867, ttc: 5200 } }).tva, 902);
    // Une facture payée en partie déduit sa part de TVA, pas toute.
    assert.equal(montantsDeLaLigne({ ...base, cle: "materiaux", ttc: 60000, piece: { genre: "facture", ht: 100000, ttc: 120000 } }).tva, 10000);
  });

  await test("rien ne se devine : une TVA non lue se dit, et ce qui ne déduit pas rend zéro", () => {
    const base = { sens: "sortie" as const, ttc: 12000, franchise: false, perdu: false };
    assert.deepEqual(montantsDeLaLigne({ ...base, cle: "materiaux", piece: { genre: "non-lue" } }), { ht: 12000, tva: 0, tvaNonLue: true });
    assert.deepEqual(montantsDeLaLigne({ ...base, cle: "materiaux", piece: { genre: "facture", ht: null, ttc: 12000 } }), { ht: 12000, tva: 0, tvaNonLue: true });
    assert.equal(montantsDeLaLigne({ ...base, cle: "assurances", piece: { genre: "facture", ht: 10000, ttc: 12000 } }).tva, 0, "une assurance n'a pas de TVA à déduire");
    assert.equal(montantsDeLaLigne({ ...base, cle: "carburant", perdu: true, piece: { genre: "aucune" } }).tva, 0, "un ticket perdu ne déduit rien");
    assert.equal(montantsDeLaLigne({ ...base, cle: "carburant", franchise: true, piece: { genre: "ticket", tva: 2000, ttc: 12000 } }).tva, 0, "en franchise, rien ne se déduit");
    assert.equal(montantsDeLaLigne({ ...base, cle: "carburant", piece: { genre: "ticket", tva: 99999, ttc: 12000 } }).tva, 12000, "une TVA plus grande que le payé est bornée");
  });

  await test("le registre compte les avoirs et les règlements au dernier jour du dossier", () => {
    assert.deepEqual(
      registre.periode.map((r) => [r.numero, r.genre, r.ttc, r.reste]),
      [
        ["F-2026-041", "facture", 378000, 0],
        ["F-2026-042", "facture", 367000, 255000],
        ["AV-2026-001", "avoir", -12000, 0],
      ]
    );
    const roux = registre.periode[1]!;
    assert.equal(roux.payeeLe, "2026-10-25", "le règlement du 3 novembre n'est pas encore arrivé au 31 octobre");
    assert.equal(roux.enPartie, true);
    assert.deepEqual(registre.avant.map((r) => [r.numero, r.payeeLe, r.reste]), [["F-2026-038", "2026-10-08", 0]]);
    assert.deepEqual(tauxDuRegistre(registre.periode), ["10.00", "20.00"]);
  });

  const ecritures = ecrituresDuDossier(entree());
  const texte = texteDuFec(ecritures);
  const rangees = texte.replace(/\r\n$/, "").split("\r\n").map((l) => l.split("\t"));

  await test("chaque écriture du FEC est équilibrée, et le fichier entier aussi", () => {
    const { ok, desequilibrees } = ecrituresEquilibrees(ecritures);
    assert.ok(ecritures.length > 20, "trop peu d'écritures : le contrôle ne mesure rien");
    assert.ok(ok, `écritures déséquilibrées : ${desequilibrees.join(", ")}`);
  });

  await test("le FEC a ses dix-huit colonnes, au format de l'administration", () => {
    assert.deepEqual(rangees[0], [...COLONNES_FEC]);
    for (const r of rangees) assert.equal(r.length, 18, `une ligne a ${r.length} colonnes : ${r.join("|")}`);
    for (const r of rangees.slice(1)) {
      assert.match(r[3]!, /^\d{8}$/, "EcritureDate");
      assert.match(r[9]!, /^\d{8}$/, "PieceDate");
      assert.match(r[11]!, /^\d+,\d{2}$/, "Debit");
      assert.match(r[12]!, /^\d+,\d{2}$/, "Credit");
      assert.ok(r[11] === "0,00" || r[12] === "0,00", "un mouvement est au débit ET au crédit");
      assert.equal(r[15], "", "ValidDate : c'est le comptable qui valide, pas Cause");
    }
    assert.deepEqual([...new Set(rangees.slice(1).map((r) => r[0]))], ["VT", "HA", "BQ"], "les journaux ne se suivent pas");
    assert.equal(montantFec(123456), "1234,56");
    assert.equal(montantFec(5), "0,05");
  });

  await test("la TVA d'une vente aux encaissements attend le paiement, puis passe due au prorata", () => {
    const de = (piece: string, journal: string) => ecritures.filter((x) => x.piece === piece && x.journal === journal);
    assert.equal(de("F-2026-041", "VT").find((x) => x.compte === "44574")?.credit, 63000);
    const paiement = de("F-2026-041", "BQ");
    assert.equal(paiement.find((x) => x.compte === "44574")?.debit, 63000);
    assert.equal(paiement.find((x) => x.compte === "44571")?.credit, 63000);
    // M. Roux paie 1 000 € sur 3 550 € (avoir retiré) : 35 000 × 100 000 / 355 000.
    assert.equal(de("F-2026-042", "BQ").find((x) => x.compte === "44571")?.credit, 9859);
    // L'avoir retire de la TVA en attente.
    assert.equal(de("AV-2026-001", "VT").find((x) => x.compte === "44574")?.debit, 2000);
  });

  await test("aux débits la TVA est due dès la facture, et en franchise il n'y en a pas", () => {
    const debits = ecrituresDuDossier(entree({ exigibilite: "debits" }));
    assert.equal(debits.find((x) => x.piece === "F-2026-041" && x.journal === "VT" && x.compte === "44571")?.credit, 63000);
    assert.ok(!debits.some((x) => x.compte === "44574"), "aux débits, rien n'attend le paiement");
    // En franchise, les lignes ne déduisent rien (`montantsDeLaLigne`) : le FEC ne fait que les écrire.
    const franchise = ecrituresDuDossier(entree({ franchise: true, lignes: lignes.map((l) => ({ ...l, ht: l.ttc, tva: 0 })) }));
    assert.ok(!franchise.some((x) => x.compte.startsWith("445")), "une franchise a écrit de la TVA");
    assert.equal(franchise.find((x) => x.piece === "F-2026-041" && x.compte === "706")?.credit, 378000);
    assert.ok(ecrituresEquilibrees(debits).ok && ecrituresEquilibrees(franchise).ok);
  });

  await test("le lettrage relie ce qui se solde ICI, et seulement cela", () => {
    const client = (piece: string) => ecritures.filter((x) => x.piece === piece && x.compte === "411").map((x) => x.lettre);
    const [vente, paiement] = client("F-2026-041");
    assert.ok(vente && vente === paiement, "la facture soldée n'est pas lettrée avec son virement");
    assert.deepEqual([...new Set(client("F-2026-042"))], [""], "une facture en partie payée a été lettrée");
    assert.deepEqual(client("F-2026-038"), [""], "une facture d'avant a été lettrée sans sa vente");
    const durand = ecritures.filter((x) => x.piece === "A 183" && x.compte === "401");
    assert.equal(durand.length, 2);
    assert.ok(durand[0]!.lettre && durand[0]!.lettre === durand[1]!.lettre, "la facture du fournisseur n'est pas lettrée avec son paiement");
    assert.equal(ecritures.find((x) => x.piece === "A 183" && x.journal === "HA")?.date, "2026-09-29", "un achat se date de sa facture");
  });

  await test("le salaire va au 421, l'argent entre deux comptes au 580, sans TVA", () => {
    const salaire = ecritures.filter((x) => x.piece === "A 184");
    assert.deepEqual(salaire.map((x) => [x.compte, x.debit, x.credit]), [["421", 185000, 0], ["512", 0, 185000]]);
    const livret = ecritures.filter((x) => x.piece === "A 185");
    assert.deepEqual(livret.map((x) => [x.compte, x.debit, x.credit]), [["512", 50000, 0], ["580", 0, 50000]]);
  });

  await test("le fichier s'écrit en ISO 8859-15, l'euro et les accents compris", () => {
    const o = enIso885915("é€œ’— z");
    assert.deepEqual([...o], [0xe9, 0xa4, 0xbd, 0x27, 0x2d, 0x20, 0x7a]);
    assert.equal(enIso885915("Ʃ")[0], 0x3f, "un caractère inconnu se voit");
    const octets = enIso885915(texte);
    assert.ok(octets.every((b) => b < 0x100));
    assert.ok(Buffer.from(octets).includes(Buffer.from([0xe8])), "le « è » de Lefèvre a été perdu");
  });

  await test("le nom du fichier n'est jamais celui du FEC légal", () => {
    assert.equal(nomDuFec("123 456 789 00012", "2026-10-01", "2026-10-31"), "123456789_import_FEC_2026-10.txt");
    assert.equal(nomDuFec("12345678900012", "2026-10-01", "2026-10-15"), "123456789_import_FEC_2026-10-01_2026-10-15.txt");
    assert.equal(nomDuFec(null, "2026-02-01", "2026-02-28"), "sans-siren_import_FEC_2026-02.txt");
    assert.doesNotMatch(nomDuFec("12345678900012", "2026-01-01", "2026-12-31"), /^\d{9}FEC\d{8}/);
    assert.equal(nomDeLExcel("123456789_import_FEC_2026-10.txt"), "Dossier 2026-10.xlsx");
    assert.equal(nomDeLExcel("123456789_import_FEC_2026-10-01_2026-10-15.txt"), "Dossier 2026-10-01 au 2026-10-15.xlsx");
  });

  await test("un tiers garde le même code d'un dossier à l'autre", () => {
    assert.equal(codeDuTiers("Mairie de Cholet"), "MAIRIEDECHOLET");
    assert.equal(codeDuTiers("Pépinières Durand"), "PEPINIERESDURAND");
    assert.equal(codeDuTiers(null), "DIVERS");
  });

  await test("l'Excel s'ouvre, avec ses quatre onglets, ses nombres et ses totaux", async () => {
    const feuilles = feuillesDuDossier({
      ventes: registre.periode,
      lignes,
      ecritures,
      comptes: { ...COMPTES, tvaDeductible: "44566", tvaImmobilisations: "44562" },
      compteDesVentes: "706",
      pageDe: { materiaux: 4, carburant: 5 },
      compteDe: (c) => lignes.find((l) => l.cle === c)?.compte ?? "",
    });
    assert.deepEqual(feuilles.map((f) => f.nom), ["Ventes", "Achats", "Banque", "Comptes"]);
    const octets = await ecrireClasseur(feuilles, new Date("2026-11-02T10:00:00Z"));
    const ventes = lireClasseur(octets);
    assert.deepEqual(ventes[0], ["N° de facture", "Date", "Client", "Chantier", "Compte", "HT", "TVA 10 %", "TVA 20 %", "TTC", "Payée le", "Reste dû"]);
    assert.equal(ventes.length, 5, "trois rangées et leur total");
    assert.equal(ventes[4]![0], "Total");
    assert.equal(Number(ventes[4]![8]), 7330, "le total TTC des ventes, avoir retiré");
    // Les quatre feuilles sont bien là, et la balance retombe à zéro.
    const fichiers = entreesDuZip(octets);
    assert.ok(["xl/worksheets/sheet1.xml", "xl/worksheets/sheet4.xml", "xl/styles.xml"].every((f) => fichiers.has(f)));
    assert.match(fichiers.get("xl/workbook.xml")!, /<sheet name="Comptes"/);
    const balance = fichiers.get("xl/worksheets/sheet4.xml")!;
    const soldeTotal = [...balance.matchAll(/<c r="F(\d+)"[^>]*><f>[^<]*<\/f><v>([^<]*)<\/v>/g)].at(-1);
    assert.equal(Number(soldeTotal?.[2]), 0, "la balance du dossier ne retombe pas à zéro");
    assert.match(fichiers.get("xl/worksheets/sheet2.xml")!, /Facture 2026-418/);
    // Les sorties de l'onglet Achats suivent l'ordre du PDF : catégorie, puis date.
    assert.deepEqual(sortiesDansLOrdre(lignes).map((l) => l.cle), ["materiaux", "carburant", "assurances", "salaires"]);
    assert.ok(ordreDesCategories().indexOf("clients") === 0);
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  if (failed > 0) process.exit(1);
}

/** Les fichiers d'un ZIP, lus à la main : stockés ou gonflés. */
function entreesDuZip(octets: Uint8Array): Map<string, string> {
  const b = Buffer.from(octets);
  const sortie = new Map<string, string>();
  let i = 0;
  while (b.readUInt32LE(i) === 0x04034b50) {
    const methode = b.readUInt16LE(i + 8);
    const taille = b.readUInt32LE(i + 18);
    const lNom = b.readUInt16LE(i + 26);
    const lExtra = b.readUInt16LE(i + 28);
    const nom = b.subarray(i + 30, i + 30 + lNom).toString("utf8");
    const debut = i + 30 + lNom + lExtra;
    const brut = b.subarray(debut, debut + taille);
    sortie.set(nom, (methode === 8 ? inflateRawSync(brut) : brut).toString("utf8"));
    i = debut + taille;
  }
  return sortie;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
