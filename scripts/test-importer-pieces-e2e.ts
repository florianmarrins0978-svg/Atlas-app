import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { ecrireArchiveZip } from "../src/lib/archive-zip";
import { fichierDemandeALaVisionneuse } from "../src/lib/visionneuse-pdf";

// IMPORTER DEVIS ET FACTURES, par SON geste — 22 octobre 2026.
//
// La règle est éprouvée à part, sous la RLS vraie (`test-pieces-importees-db.ts`)
// et sans base (`test-import-pieces.ts`). Ce qui ne s'y voit pas, et que cette
// suite tient :
//
//   1. **la porte existe** sur l'écran Clients, et mène à l'import ;
//   2. **un zip choisi part, se lit et revient en relecture** : le zip s'ouvre
//      dans le navigateur, les pièces partent une à une, la lecture tourne
//      après la réponse (`after`), et l'écran la suit ;
//   3. **ce qui n'est pas un document se nomme** et ne part pas ;
//   4. **ranger crée la fiche**, et la pièce s'y ouvre DANS la visionneuse :
//      une adresse qui ne finit pas par `/pdf` y serait refusée, et « Ouvrir »
//      ne peindrait rien (`visionneuse-pdf.ts`) ;
//   5. **« Annuler » défait le rangement**, la fiche créée s'en va, et l'import
//      reprend la relecture pour ranger à nouveau ;
//   6. **supprimer ce client** pose la question de la sauvegarde, puis
//      emporte ses pièces importées ;
//   7. **un tableau CSV** (28 octobre 2026) se lit par client, attend sa
//      réponse sur deux adresses, range ses pièces sans PDF, et s'annule en
//      entier (`test-import-tableau.ts` et `test-import-tableau-db.ts` tiennent
//      la règle).

const BASE = ADRESSE;
// Des lettres seules : le lecteur arrête un nom au premier chiffre (un
// téléphone collé au nom), et « M. Importé4y2 » se lirait « M. Importé ».
const marque = Date.now().toString(26).replace(/[0-9]/g, (c) => "klmnopqrst"[Number(c)]);
const NOM = `M. Importé${marque}`;

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function pdfAvecTexte(lignes: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const police = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  lignes.forEach((l, i) => page.drawText(l, { x: 50, y: 780 - i * 20, size: 12, font: police }));
  return doc.save();
}

async function leZip(): Promise<Buffer> {
  // La marque rend chaque pièce neuve : une empreinte déjà connue serait
  // écartée comme doublon, et la suite ne mesurerait rien la seconde fois.
  const facture = await pdfAvecTexte(["Jardins Eden", `FACTURE n° FI-${marque}`, "Date 12/03/2025", `Client : ${NOM}`, "Total TTC 480,00"]);
  const devis = await pdfAvecTexte(["Jardins Eden", `DEVIS n° DI-${marque}`, "03/04/2025", `Pour ${NOM}`, "Total TTC 1 250,00"]);
  const morceaux: Uint8Array[] = [];
  for await (const m of ecrireArchiveZip(
    [
      { nom: "2025/facture.pdf", contenu: facture },
      { nom: "2025/devis.pdf", contenu: devis },
      { nom: "2025/notes.txt", contenu: new TextEncoder().encode("rien") },
    ],
    new Date()
  )) {
    morceaux.push(m);
  }
  return Buffer.concat(morceaux);
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  await cas("la porte « Importer devis / facture » mène à l'import", async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    const porte = page.locator('[data-atlas="porte-import"]');
    await porte.waitFor({ state: "visible", timeout: 20_000 });
    assert.match((await porte.textContent()) ?? "", /Importer devis \/ facture/);
    await porte.click();
    await page.waitForURL(/\/clients\/importer/, { timeout: 20_000 });
  });

  await cas("un zip choisi se lit, et ce qui n'est pas un document se nomme", async () => {
    await page.setInputFiles('[data-atlas="choisir-pieces"]', {
      name: "ancien-logiciel.zip",
      mimeType: "application/zip",
      buffer: await leZip(),
    });
    const relecture = page.locator('[data-atlas="relecture-import"]');
    await relecture.waitFor({ state: "visible", timeout: 120_000 });
    const texte = ((await relecture.textContent()) ?? "").replace(/\s+/g, " ");
    assert.match(texte, /notes\.txt/, `le fichier écarté n'est pas nommé : ${texte.slice(0, 300)}`);
  });

  await cas("ranger crée la fiche, et la pièce s'ouvre dans la visionneuse", async () => {
    await page.click('[data-atlas="ranger-pieces"]');
    await page.waitForURL(`${BASE}/clients`, { timeout: 60_000 });
    await page.locator('[data-atlas="bandeau-rangement"]').waitFor({ state: "visible", timeout: 20_000 });

    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    await page.getByText(NOM, { exact: true }).first().click();
    await page.locator('[data-atlas="registre"]').first().waitFor({ state: "visible", timeout: 20_000 });

    for (const [registre, genre] of [["Devis", "devis"], ["Factures", "facture"]] as const) {
      await page.locator(`[data-atlas="registre"]:text-is("${registre}")`).click();
      await page.locator('[role="tabpanel"]:not([hidden]) [data-atlas="piece"]').first().click();
      const ouvrir = page.locator('[data-atlas="piece-ouvrir"]');
      await ouvrir.waitFor({ state: "visible", timeout: 20_000 });
      const href = (await ouvrir.getAttribute("href")) ?? "";
      const fichier = fichierDemandeALaVisionneuse(href);
      assert.ok(fichier, `« Ouvrir » ne passe pas par la visionneuse : ${href}`);
      assert.match(fichier, new RegExp(`^/api/pieces-importees/${genre}/[^/]+/pdf$`));
      const r = await page.request.get(`${BASE}${fichier}`);
      assert.equal(r.status(), 200, `le fichier répond ${r.status()}`);
      assert.equal((await r.body()).subarray(0, 5).toString(), "%PDF-");
      await page.getByRole("button", { name: "Annuler" }).click();
      await ouvrir.waitFor({ state: "hidden", timeout: 15_000 });
    }
  });

  await cas("« Annuler » défait le rangement, et la fiche créée s'en va", async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    const bandeau = page.locator('[data-atlas="bandeau-rangement"]');
    await bandeau.waitFor({ state: "visible", timeout: 20_000 });
    await bandeau.getByRole("button", { name: "Annuler" }).click();
    await bandeau.waitFor({ state: "hidden", timeout: 20_000 });
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    assert.equal(await page.getByText(NOM, { exact: true }).count(), 0, "la fiche créée par le rangement est restée");
  });

  await cas("après « Annuler », l'import reprend la relecture, et se range à nouveau", async () => {
    // Annuler revient AVANT le rangement, pas avant l'envoi : les pièces sont
    // là, lues. Les laisser sans chemin de retour les rendrait invisibles, et
    // bloquerait l'envoi suivant, qui reprend le dernier envoi non rangé.
    await page.goto(`${BASE}/clients/importer`, { waitUntil: "networkidle" });
    await page.locator('[data-atlas="relecture-import"]').waitFor({ state: "visible", timeout: 60_000 });
    await page.click('[data-atlas="ranger-pieces"]');
    await page.waitForURL(`${BASE}/clients`, { timeout: 60_000 });
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    assert.equal(await page.getByText(NOM, { exact: true }).count(), 1, "la fiche n'est pas revenue");
  });

  await cas("supprimer le client demande la sauvegarde, et emporte ses pièces", async () => {
    // Sa décision du 22 octobre 2026 : les pièces importées partent avec le
    // client, *« avec le même message »* : la case « J'ai sauvegardé ces
    // documents ailleurs » doit donc se poser pour un client qui n'a QUE des
    // pièces importées.
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    await page.getByText(NOM, { exact: true }).first().click();
    await page.locator('[data-atlas="registre"]').first().waitFor({ state: "visible", timeout: 20_000 });
    await page.click('[data-atlas="supprimer-client"]');
    const sauvegarde = page.locator('[data-atlas="sauvegarde-ailleurs"]');
    await sauvegarde.waitFor({ state: "visible", timeout: 15_000 });
    assert.ok(await page.locator('[data-atlas="confirmer-suppression"]').isDisabled(), "la suppression passe sans la question de la sauvegarde");
    await sauvegarde.click();
    await page.click('[data-atlas="confirmer-suppression"]');
    await page.waitForURL(`${BASE}/clients`, { timeout: 30_000 });
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    assert.equal(await page.getByText(NOM, { exact: true }).count(), 0, "le client est resté");
  });

  // ── Un tableau CSV — ses demandes du 28 octobre 2026 ────────────────────
  const CLIENT = `Mme Tableau${marque}`;
  const csv = [
    "Type;N°;Objet;Date;Client;Adresse;CP;Ville;Total TTC",
    `Devis;D-${marque}-1;Entretien des espaces verts;20/05/2025;${CLIENT};40 bd Victor Hugo;44200;Nantes;4 180,00`,
    `Facture;F-${marque}-2;Création de massifs;03/09/2025;${CLIENT};12 rue de la Paix;44000;Nantes;960,00`,
    `Facture;F-${marque}-3;Débroussaillage;09/10/2024;;9 rue de la Gare;44230;Saint-Sébastien-sur-Loire;310,00`,
  ].join("\n");

  await cas("un tableau se lit par client, et rien ne se range avant sa réponse sur deux adresses", async () => {
    await page.goto(`${BASE}/clients/importer`, { waitUntil: "networkidle" });
    await page.setInputFiles('[data-atlas="choisir-pieces"]', { name: "devis-factures.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
    await page.locator('[data-atlas="import-tableau"]').waitFor({ state: "visible", timeout: 60_000 });
    const ranger = page.locator('[data-atlas="ranger-tableau"]');
    assert.equal((await ranger.textContent())?.trim(), "Vérifiez 1 adresse");
    assert.ok(await ranger.isDisabled(), "« Ranger » s'ouvre alors qu'une adresse attend sa réponse");
    // La sienne est la première ; l'autre restera sur sa pièce, comme chantier.
    await page.locator('[data-atlas="choix-adresse"]').getByRole("radio").first().click();
    await page.locator('[data-atlas="nom-ligne"]').fill(CLIENT);
    assert.equal((await ranger.textContent())?.trim(), "Ranger 3 documents");
    await ranger.click();
    await page.waitForURL(`${BASE}/clients`, { timeout: 60_000 });
    await page.locator('[data-atlas="bandeau-rangement"]').waitFor({ state: "visible", timeout: 20_000 });
  });

  await cas("la pièce d'un tableau s'ouvre sur ses chiffres et son chantier, sans PDF à télécharger", async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    await page.getByText(CLIENT, { exact: true }).first().click();
    await page.locator('[data-atlas="registre"]').first().waitFor({ state: "visible", timeout: 20_000 });
    await page.locator('[data-atlas="registre"]:text-is("Factures")').click();
    const piece = page.locator('[role="tabpanel"]:not([hidden]) [data-atlas="piece"]', { hasText: "Création de massifs" });
    assert.match((await piece.innerText()).replace(/\s+/g, " "), /960,00.*Chantier au 12 rue de la Paix/);
    await piece.click();
    const feuille = page.locator('[data-atlas="piece-du-tableau"]');
    await feuille.waitFor({ state: "visible", timeout: 15_000 });
    assert.match((await feuille.innerText()).replace(/\s+/g, " "), /960,00 € TTC.*Pas de PDF/);
    assert.equal(await page.locator('[data-atlas="piece-enregistrer"]').count(), 0, "« Télécharger » propose un PDF qui n'existe pas");
    await feuille.getByRole("button", { name: "Fermer" }).click();
  });

  await cas("« Annuler » défait le tableau en entier : la fiche part, rien ne reste à relire", async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    const bandeau = page.locator('[data-atlas="bandeau-rangement"]');
    await bandeau.waitFor({ state: "visible", timeout: 20_000 });
    await bandeau.getByRole("button", { name: "Annuler" }).click();
    await bandeau.waitFor({ state: "hidden", timeout: 20_000 });
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    assert.equal(await page.getByText(CLIENT, { exact: true }).count(), 0, "la fiche créée par le tableau est restée");
    await page.goto(`${BASE}/clients/importer`, { waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="relecture-import"]').count(), 0, "un tableau annulé se propose à la relecture");
  });

  await navigateur.close();
  if (echecs > 0) {
    console.log(`\n✗ ${echecs} échec(s)`);
    process.exit(1);
  }
  console.log("\n✅ Un zip choisi se range sur la fiche de son client, et s'annule.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
