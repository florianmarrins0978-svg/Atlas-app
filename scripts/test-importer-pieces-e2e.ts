import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { ecrireArchiveZip } from "../src/lib/archive-zip";
import { fichierDemandeALaVisionneuse } from "../src/lib/visionneuse-pdf";
import { ANNULER_PENDANT_MS } from "../src/lib/delai-annuler";
import { CIVILITES } from "../src/lib/civilite";

// IMPORTER DEVIS ET FACTURES, par SON geste — 22 octobre 2026.
//
// La règle est éprouvée à part, sous la RLS vraie (`test-pieces-importees-db.ts`)
// et sans base (`test-import-pieces.ts`). Ce qui ne s'y voit pas, et que cette
// suite tient :
//
//   1. **la porte existe** sur l'écran Clients, et mène à l'import ;
//   2. **un zip choisi part, se lit et arrive « Par client »**, le même écran
//      qu'un tableau (sa demande du 31 octobre 2026) : le zip s'ouvre dans le
//      navigateur, les pièces partent une à une, la lecture tourne après la
//      réponse (`after`), et l'écran la suit ;
//   3. **ce qui n'est pas un document se nomme** et ne part pas ;
//   4. **ranger crée la fiche**, et la pièce s'y ouvre DANS la visionneuse :
//      une adresse qui ne finit pas par `/pdf` y serait refusée, et « Ouvrir »
//      ne peindrait rien (`visionneuse-pdf.ts`) ;
//   5. **« Annuler » défait le rangement**, la fiche créée s'en va, et l'import
//      reprend « Par client » pour ranger à nouveau ;
//   6. **« N documents rangés » part seul après six secondes**, sans recharger
//      (sa capture du 3 novembre 2026 : le bandeau ne partait jamais), et ce
//      qu'un rangement a laissé (un nom illisible) reprend sa place dans la
//      bande, puis à l'import ; « Annuler » n'y défait que ce second rangement ;
//   7. **supprimer ce client** pose la question de la sauvegarde, puis
//      emporte ses pièces importées ;
//   8. **un tableau CSV** (28 octobre 2026) se lit par client, attend sa
//      réponse sur deux adresses, range ses pièces sans PDF, et s'annule en
//      entier (`test-import-tableau.ts` et `test-import-tableau-db.ts` tiennent
//      la règle).
//
// **« Annuler » se touche dans ses six secondes** (`ANNULER_PENDANT_MS`) : la
// suite l'appuie dès le bandeau paru, et regarde la fiche APRÈS, jamais avant.

const BASE = ADRESSE;
// Des lettres seules : le lecteur arrête un nom au premier chiffre (un
// téléphone collé au nom), et « M. Importé4y2 » se lirait « M. Importé ».
const marque = Date.now().toString(26).replace(/[0-9]/g, (c) => "klmnopqrst"[Number(c)]);
// Écrit « M. » sur le PDF, rangé « Mr. » : l'écriture de l'appli (migration
// 0037), que l'écran montre et que la fiche porte.
const ECRIT = `M. Importé${marque}`;
const NOM = `${CIVILITES.mr} Importé${marque}`;

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
  const facture = await pdfAvecTexte(["Jardins Eden", `FACTURE n° FI-${marque}`, "Date 12/03/2025", `Client : ${ECRIT}`, "8 rue du Port 44120 Vertou", "Total TTC 480,00"]);
  const devis = await pdfAvecTexte(["Jardins Eden", `DEVIS n° DI-${marque}`, "03/04/2025", `Pour ${ECRIT}`, "8 rue du Port 44120 Vertou", "Total TTC 1 250,00"]);
  // Un client sans civilité, que le texte ne sait pas nommer (les trois devis
  // de son import du 3 novembre 2026) : il reste à ranger quand les autres se
  // rangent.
  const sansNom = await pdfAvecTexte(["Jardins Eden", `FACTURE n° FS-${marque}`, "09/10/2024", "SARL Les Tilleuls", "Total TTC 310,00"]);
  const morceaux: Uint8Array[] = [];
  for await (const m of ecrireArchiveZip(
    [
      { nom: "2025/facture.pdf", contenu: facture },
      { nom: "2025/devis.pdf", contenu: devis },
      { nom: "2025/sans-nom.pdf", contenu: sansNom },
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

  await cas("un zip choisi se lit et arrive par client, comme un tableau, et ce qui n'est pas un document se nomme", async () => {
    await page.setInputFiles('[data-atlas="choisir-pieces"]', {
      name: "ancien-logiciel.zip",
      mimeType: "application/zip",
      buffer: await leZip(),
    });
    const ecran = page.locator('[data-atlas="import-tableau"]');
    await ecran.waitFor({ state: "visible", timeout: 120_000 });
    const texte = ((await ecran.textContent()) ?? "").replace(/\s+/g, " ");
    assert.match(texte, /3 documents lus/, `le compte des PDF lus manque : ${texte.slice(0, 300)}`);
    assert.match(texte, /notes\.txt/, `le fichier écarté n'est pas nommé : ${texte.slice(0, 300)}`);
    const client = page.locator('[data-atlas="client-lu"]', { hasText: NOM });
    assert.match((await client.innerText()).replace(/\s+/g, " "), /8 rue du Port, 44120 Vertou/, "l'adresse lue sur le PDF n'est pas montrée");
    assert.equal(await client.locator('[data-atlas="piece-lue"]').count(), 2, "les deux PDF ne sont pas sous leur client");
    assert.equal(await page.locator('[data-atlas="nom-ligne"]').count(), 1, "la pièce sans nom n'attend pas le sien");
    assert.equal((await page.locator('[data-atlas="ranger-tableau"]').textContent())?.trim(), "Ranger 2 documents");
  });

  await cas("« Annuler », dans ses six secondes, défait le rangement, et la fiche créée s'en va", async () => {
    await page.click('[data-atlas="ranger-tableau"]');
    await page.waitForURL(`${BASE}/clients`, { timeout: 60_000 });
    const bandeau = page.locator('[data-atlas="bandeau-rangement"]');
    await bandeau.waitFor({ state: "visible", timeout: 20_000 });
    assert.match(await bandeau.innerText(), /2 documents rangés/);
    await bandeau.getByRole("button", { name: "Annuler" }).click();
    await bandeau.waitFor({ state: "hidden", timeout: 20_000 });
    // Tout est revenu à ranger : la bande le dit aussitôt, sans recharger.
    await page.locator('[data-atlas="bande-import"]', { hasText: "3 documents lus" }).waitFor({ state: "visible", timeout: 20_000 });
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    assert.equal(await page.getByText(NOM, { exact: true }).count(), 0, "la fiche créée par le rangement est restée");
  });

  await cas("après « Annuler », l'import reprend « Par client », et se range à nouveau", async () => {
    // Annuler revient AVANT le rangement, pas avant l'envoi : les pièces sont
    // là, lues. Les laisser sans chemin de retour les rendrait invisibles, et
    // bloquerait l'envoi suivant, qui reprend le dernier envoi non rangé.
    await page.goto(`${BASE}/clients/importer`, { waitUntil: "networkidle" });
    await page.locator('[data-atlas="import-tableau"]').waitFor({ state: "visible", timeout: 60_000 });
    await page.click('[data-atlas="ranger-tableau"]');
    await page.waitForURL(`${BASE}/clients`, { timeout: 60_000 });
    await page.locator('[data-atlas="bandeau-rangement"]').waitFor({ state: "visible", timeout: 20_000 });
    assert.equal(await page.getByText(NOM, { exact: true }).count(), 1, "la fiche n'est pas revenue");
  });

  await cas("« 2 documents rangés » part seul après six secondes, et la pièce sans nom reprend sa place", async () => {
    // Sa capture du 3 novembre 2026 : « 48 documents rangés, Annuler » ne
    // partait jamais. Aucun rechargement ici : c'est la bande qui doit bouger.
    const bandeau = page.locator('[data-atlas="bandeau-rangement"]');
    await bandeau.waitFor({ state: "hidden", timeout: ANNULER_PENDANT_MS + 9_000 });
    const reste = page.locator('[data-atlas="bande-import"]');
    await reste.waitFor({ state: "visible", timeout: 10_000 });
    const texte = (await reste.innerText()).replace(/\s+/g, " ");
    assert.match(texte, /^1 document lu\b/, `la bande ne dit pas ce qui reste : ${texte}`);
    assert.match(texte, /1 à vérifier/, `la pièce sans nom n'est pas « à vérifier » : ${texte}`);
    assert.equal(await reste.getAttribute("href"), "/clients/importer");
  });

  await cas("ce qui reste se range à l'import, et « Annuler » ne défait que ce second rangement", async () => {
    await page.click('[data-atlas="bande-import"]');
    await page.waitForURL(/\/clients\/importer/, { timeout: 20_000 });
    const ecran = page.locator('[data-atlas="import-tableau"]');
    await ecran.waitFor({ state: "visible", timeout: 60_000 });
    // `innerText` et non `textContent` : celui-ci colle « lu » au mot suivant.
    assert.match((await ecran.innerText()).replace(/\s+/g, " "), /\b1 document lu\b/, "l'import ne reprend pas la seule pièce restée");
    // Le nom d'un client déjà là : la pièce va sur sa fiche, et c'est cette
    // fiche, née du PREMIER rangement, qu'un « Annuler » trop large viderait.
    await page.locator('[data-atlas="nom-ligne"]').fill(NOM);
    assert.equal((await page.locator('[data-atlas="ranger-tableau"]').textContent())?.trim(), "Ranger 1 document");
    await page.click('[data-atlas="ranger-tableau"]');
    await page.waitForURL(`${BASE}/clients`, { timeout: 60_000 });
    const bandeau = page.locator('[data-atlas="bandeau-rangement"]');
    await bandeau.waitFor({ state: "visible", timeout: 20_000 });
    // Une ligne entière : `\b` ne voit pas de bord après « é ».
    assert.match(await bandeau.innerText(), /^1 document rangé$/m);
    await bandeau.getByRole("button", { name: "Annuler" }).click();
    await bandeau.waitFor({ state: "hidden", timeout: 20_000 });
    const reste = page.locator('[data-atlas="bande-import"]');
    await reste.waitFor({ state: "visible", timeout: 20_000 });
    assert.match((await reste.innerText()).replace(/\s+/g, " "), /^1 document lu\b/, "« Annuler » a défait le premier rangement avec le second");

    // Rangée à nouveau : tout est rangé, et la bande part pour de bon.
    await page.goto(`${BASE}/clients/importer`, { waitUntil: "networkidle" });
    await page.locator('[data-atlas="import-tableau"]').waitFor({ state: "visible", timeout: 60_000 });
    await page.click('[data-atlas="ranger-tableau"]');
    await page.waitForURL(`${BASE}/clients`, { timeout: 60_000 });
    await bandeau.waitFor({ state: "visible", timeout: 20_000 });
    await bandeau.waitFor({ state: "hidden", timeout: ANNULER_PENDANT_MS + 9_000 });
    assert.equal(await page.locator('[data-atlas="bande-import"]').count(), 0, "une bande reste alors que tout est rangé");
  });

  await cas("ranger crée la fiche, et la pièce s'ouvre dans la visionneuse", async () => {
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

  /** Le tableau choisi, sa réponse sur deux adresses, le nom tapé, puis « Ranger » : le bandeau paraît. */
  async function rangerLeTableau() {
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
  }

  await cas("un tableau se lit par client, et rien ne se range avant sa réponse sur deux adresses", rangerLeTableau);

  await cas("« Annuler » défait le tableau en entier : la fiche part, rien ne reste à relire", async () => {
    const bandeau = page.locator('[data-atlas="bandeau-rangement"]');
    await bandeau.getByRole("button", { name: "Annuler" }).click();
    await bandeau.waitFor({ state: "hidden", timeout: 20_000 });
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    assert.equal(await page.getByText(CLIENT, { exact: true }).count(), 0, "la fiche créée par le tableau est restée");
    await page.goto(`${BASE}/clients/importer`, { waitUntil: "networkidle" });
    await page.locator('[data-atlas="choisir-pieces"]').waitFor({ state: "attached", timeout: 20_000 });
    assert.equal(await page.locator('[data-atlas="import-tableau"]').count(), 0, "un tableau annulé se propose à ranger");
  });

  await cas("la pièce d'un tableau s'ouvre sur ses chiffres et son chantier, sans PDF à télécharger", async () => {
    // Le tableau se range à nouveau, et cette fois reste : la fiche se regarde
    // une fois « Annuler » passé, puis part par sa suppression.
    await rangerLeTableau();
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

    await page.click('[data-atlas="supprimer-client"]');
    await page.locator('[data-atlas="sauvegarde-ailleurs"]').click();
    await page.click('[data-atlas="confirmer-suppression"]');
    await page.waitForURL(`${BASE}/clients`, { timeout: 30_000 });
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    assert.equal(await page.getByText(CLIENT, { exact: true }).count(), 0, "le client du tableau est resté");
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
