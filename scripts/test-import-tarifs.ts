import assert from "node:assert/strict";
import { lireCsv } from "../src/lib/lire-csv";
import { lireTableau, montantLu, rapprocher } from "../src/lib/import-tarifs";
import { lireClasseur } from "../src/server/import/lire-classeur";
import { lireFichierTarifs } from "../src/server/import/lire-fichier-tarifs";

// **« Si l'utilisateur a déjà un fichier Excel, il doit pouvoir le rentrer via
// une touche, et que les prix s'ajoutent automatiquement. »** — le patron, le
// 8 août 2026.
//
// Ce que cette suite tient, et qui n'est pas la commodité : **rien ne s'invente
// et rien ne s'écrase en silence.** Un tarif importé de travers ne se voit pas
// dans les réglages — il se voit sur le devis d'un client, une semaine plus
// tard. Chaque cas ci-dessous correspond à une feuille que les artisans
// écrivent réellement.

let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Un montant, tel qu'un tableur français l'écrit ===\n");

cas("les formes réelles sont comprises", () => {
  assert.equal(montantLu("400"), "400.00");
  assert.equal(montantLu("400,00"), "400.00");
  assert.equal(montantLu("400.00"), "400.00");
  assert.equal(montantLu("1 200,50"), "1200.50");
  assert.equal(montantLu("1 200,50"), "1200.50"); // espace insécable d'Excel
  assert.equal(montantLu("400 €"), "400.00");
  assert.equal(montantLu("400,00 € HT"), "400.00");
});

cas("ce qui n'est pas un prix ne devient pas un prix", () => {
  // **Le contrôle central.** Prendre « le premier nombre » ferait entrer 12 €
  // pour « 12/03 » et 400 € pour « 400-500 » — des montants que personne n'a
  // écrits, sur des devis de clients.
  for (const brut of ["sur devis", "à voir", "", "-", "12/03", "400-500", "0", "-50", "N/A"]) {
    assert.equal(montantLu(brut), null, `« ${brut} » est devenu un prix`);
  }
});

console.log("\n=== Un CSV français, avec ses trois pièges ===");

cas("le point-virgule sépare, la virgule décime", () => {
  const lignes = lireCsv("Intitulé;Prix;Unité\nMain d'œuvre;400,00;jour/homme\n");
  assert.deepEqual(lignes[1], ["Main d'œuvre", "400,00", "jour/homme"]);
});

cas("le BOM d'Excel ne colle pas à la première cellule", () => {
  // Invisible, il faisait rater l'en-tête « Intitulé » — et donc la détection
  // des colonnes, sans qu'on puisse voir pourquoi.
  const lignes = lireCsv("﻿Intitulé;Prix\nÉlagage;600\n");
  assert.equal(lignes[0][0], "Intitulé");
});

cas("une cellule entre guillemets garde son séparateur", () => {
  const lignes = lireCsv('Intitulé;Prix\n"Abattage; démontage compris";1200\n');
  assert.deepEqual(lignes[1], ["Abattage; démontage compris", "1200"]);
});

cas("un guillemet doublé en vaut un seul", () => {
  assert.deepEqual(lireCsv('A;B\n"Chêne ""mort""";600\n')[1], ['Chêne "mort"', "600"]);
});

cas("la virgule sépare aussi, quand c'est elle qui sépare", () => {
  assert.deepEqual(lireCsv("Intitulé,Prix\nÉlagage,600\n")[1], ["Élagage", "600"]);
});

console.log("\n=== Ce qu'on retient d'une feuille, et ce qu'on écarte ===");

const FEUILLE = [
  ["Intitulé", "Prix (€)", "Unité"],
  ["Main d'œuvre", "400,00", "jour/homme"],
  ["Broyeur", "200,00", "Jour"],
  ["ABATTAGE", "", ""],
  ["Fendeuse", "150", "Jour"],
  ["Taille de haie", "sur devis", "ml"],
  ["", "999", ""],
  ["Broyeur", "300", "Jour"],
];

cas("les tarifs lisibles sont retenus, avec leur unité", () => {
  const { retenues } = lireTableau(FEUILLE);
  assert.deepEqual(retenues, [
    { intitule: "Main d'œuvre", prix: "400.00", unite: "jour/homme" },
    { intitule: "Broyeur", prix: "200.00", unite: "Jour" },
    { intitule: "Fendeuse", prix: "150.00", unite: "Jour" },
  ]);
});

cas("une ligne de titre n'entre pas à 0 €", () => {
  // « ABATTAGE » est une rubrique, pas une prestation. La compléter par zéro
  // ferait proposer « gratuit » sur un devis.
  const { ecartees } = lireTableau(FEUILLE);
  assert.ok(ecartees.some((e) => e.contenu.includes("ABATTAGE") && /montant/i.test(e.raison)));
});

cas("« sur devis » est écarté, pas deviné", () => {
  const { retenues, ecartees } = lireTableau(FEUILLE);
  assert.ok(!retenues.some((r) => r.intitule === "Taille de haie"));
  assert.ok(ecartees.some((e) => e.contenu.includes("Taille de haie")));
});

cas("un prix sans désignation ne crée pas un tarif sans nom", () => {
  const { ecartees } = lireTableau(FEUILLE);
  assert.ok(ecartees.some((e) => e.contenu === "999" && /désignation/i.test(e.raison)));
});

cas("un intitulé en double ne crée pas deux tarifs concurrents", () => {
  // **Le pire résultat possible.** Deux « Broyeur » et le chiffrage s'arrête à
  // chaque chantier en demandant lequel appliquer.
  const { retenues, ecartees } = lireTableau(FEUILLE);
  assert.equal(retenues.filter((r) => r.intitule === "Broyeur").length, 1);
  assert.ok(ecartees.some((e) => /figure déjà/.test(e.raison)));
});

cas("TOUT ce qui n'est pas retenu est signalé", () => {
  // Une ligne qui disparaît sans un mot ferait croire à un import complet — et
  // le patron ne s'en apercevrait que devant un devis incomplet.
  const { retenues, ecartees } = lireTableau(FEUILLE);
  const utiles = FEUILLE.slice(1).filter((l) => l.some((c) => c.trim() !== ""));
  assert.equal(retenues.length + ecartees.length, utiles.length);
});

console.log("\n=== Une feuille sans en-tête : les colonnes se déduisent ===");

cas("une liste qui commence directement par ses lignes", () => {
  const { retenues } = lireTableau([
    ["Élagage", "600", "u"],
    ["Dessouchage", "250", "u"],
  ]);
  assert.equal(retenues.length, 2);
  assert.equal(retenues[0].prix, "600.00");
});

cas("une colonne de numéros en tête ne passe pas pour la désignation", () => {
  // Le piège de « la première colonne est l'intitulé » : ici c'est un numéro
  // d'article, et l'import aurait créé des tarifs nommés « 1 » et « 2 ».
  const { retenues } = lireTableau([
    ["1", "Élagage", "600"],
    ["2", "Dessouchage", "250"],
  ]);
  assert.equal(retenues[0].intitule, "Élagage", `intitulé lu : « ${retenues[0]?.intitule} »`);
  assert.equal(retenues[0].prix, "600.00");
});

cas("un fichier sans aucun montant est refusé, en disant quoi faire", () => {
  const { retenues, ecartees } = lireTableau([["Bonjour"], ["Ceci n'est pas un tableau"]]);
  assert.deepEqual(retenues, []);
  assert.ok(ecartees.length > 0 && /colonne de prix/i.test(ecartees[0].raison));
});

console.log("\n=== Le rapprochement : rien ne s'écrase sans être montré ===");

const EXISTANTS = [
  { id: "a", intitule: "Main d'œuvre", prix: "400.00", unite: "jour/homme" },
  { id: "b", intitule: "Broyeur", prix: "200.00", unite: "Jour" },
];

cas("un tarif nouveau se crée, un tarif connu se met à jour", () => {
  const r = rapprocher(EXISTANTS, [
    { intitule: "Fendeuse", prix: "150.00", unite: "Jour" },
    { intitule: "Broyeur", prix: "220.00", unite: "Jour" },
  ]);
  assert.deepEqual(r.aCreer.map((l) => l.intitule), ["Fendeuse"]);
  assert.equal(r.aMettreAJour.length, 1);
  assert.equal(r.aMettreAJour[0].avant.prix, "200.00");
  assert.equal(r.aMettreAJour[0].apres.prix, "220.00");
});

cas("le rapprochement ignore la casse et les espaces", () => {
  // Sans cela, «  main d'œuvre  » créerait un SECOND tarif à côté du premier,
  // et le chiffrage trouverait deux candidats à chaque chantier.
  const r = rapprocher(EXISTANTS, [{ intitule: "  MAIN D'ŒUVRE ", prix: "450", unite: "jour/homme" }]);
  assert.deepEqual(r.aCreer, []);
  assert.equal(r.aMettreAJour.length, 1);
});

cas("un tarif identique n'est pas réécrit pour rien", () => {
  const r = rapprocher(EXISTANTS, [{ intitule: "Broyeur", prix: "200.00", unite: "Jour" }]);
  assert.deepEqual(r.aMettreAJour, []);
  assert.equal(r.inchangees.length, 1);
});

cas("un changement d'unité seule compte comme une correction", () => {
  const r = rapprocher(EXISTANTS, [{ intitule: "Broyeur", prix: "200.00", unite: "1/2 journée" }]);
  assert.equal(r.aMettreAJour.length, 1, "l'unité a changé sans que rien ne le signale");
});

console.log("\n=== Le fichier lui-même : Excel, CSV, PDF ===");

cas("un classeur Excel est reconnu à son contenu, pas à son nom", () => {
  const classeur = classeurDEssai();
  const r = lireFichierTarifs("liste.txt", classeur);
  assert.equal(r.statut, "lu");
  if (r.statut === "lu") assert.equal(r.format, "excel");
});

cas("les formules donnent leur RÉSULTAT, pas leur texte", () => {
  // Une colonne « prix » calculée est le cas normal dans une feuille de prix.
  const cellules = lireClasseur(classeurDEssai());
  assert.deepEqual(cellules[3], ["Fendeuse", "150", "Jour"]);
});

cas("une cellule vide au milieu ne décale pas les colonnes", () => {
  // Sans les places conservées, l'unité manquante de « Mini pelle » aurait fait
  // remonter le prix dans la colonne des désignations.
  const cellules = lireClasseur(classeurDEssai());
  assert.deepEqual(cellules[4], ["Mini pelle", "450"]);
});

cas("un texte coupé en deux par Excel est recollé", () => {
  // Excel découpe un `<si>` en plusieurs `<t>` quand une mise en forme traîne
  // au milieu du mot : « Main d'œuvre » revenait en « Main d' » + « œuvre ».
  const cellules = lireClasseur(classeurCoupe());
  assert.equal(cellules[0][0], "Main d'œuvre");
});

cas("un fichier qui n'est pas un classeur ne fait pas tomber la lecture", () => {
  assert.deepEqual(lireClasseur(new Uint8Array([1, 2, 3])), []);
  assert.deepEqual(lireClasseur(new Uint8Array(0)), []);
});

cas("un PDF est refusé, et le refus dit quoi faire", () => {
  // **On ne devine pas un prix dans une image de tableau.** Le refus doit donc
  // porter la sortie : « Enregistrer sous → CSV ». Un refus sans issue renvoie
  // le patron à sa saisie manuelle sans qu'il sache pourquoi.
  const pdf = new TextEncoder().encode("%PDF-1.7\n%…\n");
  const r = lireFichierTarifs("tarifs.pdf", pdf);
  assert.equal(r.statut, "refuse");
  if (r.statut === "refuse") assert.match(r.raison, /CSV/, `raison : « ${r.raison} »`);
});

cas("un fichier vide est refusé sans détour", () => {
  const r = lireFichierTarifs("vide.csv", new Uint8Array(0));
  assert.equal(r.statut, "refuse");
});

cas("un CSV en Latin-1 garde ses accents", () => {
  // Les vieux Excel français exportent encore ainsi. Lu en UTF-8, « Élagage »
  // devient « �lagage » — et le tarif arrive avec un nom illisible.
  const latin1 = Uint8Array.from([
    ...Buffer.from("Intitul", "latin1"),
    0xe9, // é
    ...Buffer.from(";Prix\n", "latin1"),
    0xc9, // É
    ...Buffer.from("lagage;600\n", "latin1"),
  ]);
  const r = lireFichierTarifs("vieux.csv", latin1);
  assert.equal(r.statut, "lu");
  if (r.statut === "lu") assert.equal(r.lecture.retenues[0]?.intitule, "Élagage");
});

/** Un `.xlsx` minimal, tel qu'Excel en produit : textes partagés, formule, trou. */
function classeurDEssai(): Uint8Array {
  return zipDe([
    [
      "xl/sharedStrings.xml",
      sst(["Intitulé", "Prix (€)", "Unité", "Main d'œuvre", "jour/homme", "Broyeur", "Jour", "Fendeuse", "Mini pelle"]),
    ],
    [
      "xl/worksheets/sheet1.xml",
      feuille([
        `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>`,
        `<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>400</v></c><c r="C2" t="s"><v>4</v></c></row>`,
        `<row r="3"><c r="A3" t="s"><v>5</v></c><c r="B3"><v>200</v></c><c r="C3" t="s"><v>6</v></c></row>`,
        `<row r="4"><c r="A4" t="s"><v>7</v></c><c r="B4"><f>100+50</f><v>150</v></c><c r="C4" t="s"><v>6</v></c></row>`,
        `<row r="5"><c r="A5" t="s"><v>8</v></c><c r="B5"><v>450</v></c></row>`,
      ]),
    ],
  ]);
}

/** Un classeur dont un texte est coupé en plusieurs `<t>`. */
function classeurCoupe(): Uint8Array {
  return zipDe([
    [
      "xl/sharedStrings.xml",
      `<?xml version="1.0"?><sst><si><t>Main d&apos;</t><t>œuvre</t></si></sst>`,
    ],
    ["xl/worksheets/sheet1.xml", feuille([`<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>400</v></c></row>`])],
  ]);
}

function sst(textes: string[]): string {
  const echappe = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0"?><sst>${textes.map((t) => `<si><t>${echappe(t)}</t></si>`).join("")}</sst>`;
}

function feuille(rows: string[]): string {
  return `<?xml version="1.0"?><worksheet><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

/**
 * Un ZIP « stockage » (non compressé), qui suffit à éprouver la lecture.
 *
 * Volontairement écrit ici plutôt qu'emprunté à `archive-zip.ts` : ce contrôle
 * doit rester vrai même si l'écriture d'archives change. Un test qui partage sa
 * plomberie avec le code qu'il éprouve finit par ne plus rien éprouver.
 */
function zipDe(entrees: [string, string][]): Uint8Array {
  const morceaux: Buffer[] = [];
  const central: Buffer[] = [];
  let decalage = 0;

  for (const [nom, contenu] of entrees) {
    const nomBuf = Buffer.from(nom, "utf8");
    const donnees = Buffer.from(contenu, "utf8");
    const crc = crc32(donnees);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8); // méthode 0 : stockage
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(donnees.length, 18);
    local.writeUInt32LE(donnees.length, 22);
    local.writeUInt16LE(nomBuf.length, 26);
    morceaux.push(local, nomBuf, donnees);

    const entree = Buffer.alloc(46);
    entree.writeUInt32LE(0x02014b50, 0);
    entree.writeUInt16LE(20, 6);
    entree.writeUInt16LE(0, 10);
    entree.writeUInt32LE(crc, 16);
    entree.writeUInt32LE(donnees.length, 20);
    entree.writeUInt32LE(donnees.length, 24);
    entree.writeUInt16LE(nomBuf.length, 28);
    entree.writeUInt32LE(decalage, 42);
    central.push(entree, nomBuf);

    decalage += local.length + nomBuf.length + donnees.length;
  }

  const repertoire = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(repertoire.length, 12);
  fin.writeUInt32LE(decalage, 16);

  return new Uint8Array(Buffer.concat([...morceaux, repertoire, fin]));
}

function crc32(octets: Buffer): number {
  let c = 0xffffffff;
  for (const o of octets) {
    c ^= o;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
