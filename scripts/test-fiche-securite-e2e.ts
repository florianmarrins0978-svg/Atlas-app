import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { jourDuPatron } from "./_jour-e2e";

// LA FICHE DE SÉCURITÉ, PAR OÙ IL ARRIVE — la fiche du jour sur le planning.
//
// Le chemin du patron, du premier geste au dernier (`CLAUDE.md` §5 quater) :
// le bandeau sur la fiche du jour, « ce que demande la loi » une fois, les six
// écrans, une case cochée sans que l'écran remonte, un mot ajouté, la
// signature au doigt, le PDF qui répond, la liste dans Paysage, et le bandeau
// qui dit « signée » au retour. Puis la base : une fiche, signée, et la mémoire
// de l'entreprise qui porte ce qui a été coché.

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const LIGNE = "[data-atlas='ligne-planifiee']";
const FEUILLE = "[data-atlas='feuille']";
const BANDEAU = "[data-atlas='fiche-de-securite']";
const OUVRIR = "[data-atlas='ouvrir-fiche-de-securite']";
const COMPTE = "[data-atlas='compte-de-la-fiche']";
const TEL_DE_L_ENTREPRISE = "Téléphone (en cas d’incident ou d’accident)";

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

async function main() {
  console.log("=== La fiche de sécurité — depuis la fiche du jour ===\n");
  const { rows } = await pool.query<{ id: string; nom: string }>(
    `SELECT c.id, c.nom FROM chantiers c
      WHERE c.deleted_at IS NULL AND c.termine_at IS NULL
      ORDER BY c.created_at DESC LIMIT 1`
  );
  assert.ok(rows.length === 1, "aucun chantier en cours dans le jeu de démonstration");
  const chantierId = rows[0].id;
  const chantierNom = rows[0].nom;
  await pool.query(`UPDATE chantiers SET date_planifiee = $2 WHERE id = $1`, [chantierId, jourDuPatron()]);
  await pool.query(`DELETE FROM fiches_securite WHERE chantier_id = $1`, [chantierId]);
  await pool.query(`DELETE FROM fiches_securite_memoire WHERE entreprise_id = (SELECT entreprise_id FROM chantiers WHERE id = $1)`, [chantierId]);

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  async function ouvrirLaFicheDuJour() {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    const ligne = page.locator(`${LIGNE}:has-text("${chantierNom}")`).first();
    await ligne.waitFor({ state: "visible", timeout: 20_000 });
    await ligne.click();
    await page.locator(FEUILLE).first().waitFor({ state: "visible", timeout: 20_000 });
    await page.locator(BANDEAU).waitFor({ state: "visible", timeout: 20_000 });
  }

  await ouvrirLaFicheDuJour();

  await cas("le bandeau est sur la fiche du jour, fermé, et dit « à remplir »", async () => {
    await page.locator(COMPTE).filter({ hasText: "à remplir" }).waitFor({ timeout: 15_000 });
    const texte = await page.locator(FEUILLE).innerText();
    assert.match(texte, /Fiche de sécurité/);
    const ordre = await page.locator(FEUILLE).evaluate((f) => {
      const enfants = Array.from(f.querySelectorAll("[data-atlas='fiche-de-securite'], [data-atlas='travaux-a-faire']"));
      return enfants.map((e) => e.getAttribute("data-atlas"));
    });
    assert.deepEqual(ordre, ["fiche-de-securite", "travaux-a-faire"], "la fiche de sécurité se remplit AVANT les travaux : elle est au-dessus");
  });

  await cas("« Remplir la fiche » ouvre d'abord ce que demande la loi, une fois", async () => {
    await page.locator(OUVRIR).click();
    await page.locator("[data-atlas='remplir-la-fiche']").click();
    await page.waitForURL(new RegExp(`/planning/fiche-de-securite/${chantierId}`), { timeout: 20_000 });
    await page.getByText("Ce que demande la loi").waitFor({ timeout: 20_000 });
    assert.ok(await page.locator('a[href*="legifrance.gouv.fr"]').count(), "le lien vers le décret manque");
    await page.getByRole("button", { name: "Compris, je remplis" }).click();
    await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: "1 sur 6" }).waitFor({ timeout: 15_000 });
  });

  await cas("ce qu'il écrit est enregistré sans « Suivant », et il le retrouve en revenant", async () => {
    // Sa question du 22 septembre 2026 : une fois l'application sur son écran
    // d'accueil, un lien de la fiche l'emmène dehors en plein remplissage. Si
    // le téléphone décharge la page, l'étape en cours ne doit pas repartir vide.
    // On ne touche donc NI « Suivant » NI « Retour » : c'est tout le sujet.
    const ecrit = "06 12 34 56 78";
    await page.getByLabel(TEL_DE_L_ENTREPRISE).fill(ecrit);
    const enBase = async () => {
      const { rows } = await pool.query<{ contenu: { telephoneIncident?: string } }>(`SELECT contenu FROM fiches_securite WHERE chantier_id = $1`, [chantierId]);
      return rows[0]?.contenu?.telephoneIncident ?? null;
    };
    const jusqua = Date.now() + 15_000;
    while ((await enBase()) !== ecrit && Date.now() < jusqua) await page.waitForTimeout(500);
    assert.equal(await enBase(), ecrit, "ce qu'il tape part tout seul, sans « Suivant »");
    // Et il le retrouve : l'écran rouvert porte ce qu'il avait écrit.
    await page.goto(`${BASE}/planning/fiche-de-securite/${chantierId}`, { waitUntil: "networkidle" });
    await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: "1 sur 6" }).waitFor({ timeout: 15_000 });
    assert.equal(await page.getByLabel(TEL_DE_L_ENTREPRISE).inputValue(), ecrit, "au retour dans l'application, sa saisie est là");
  });

  await cas("l'écran 1 porte ce qu'Atlas sait, et « Suivant » enregistre l'étape", async () => {
    const texte = await page.locator("body").innerText();
    assert.match(texte, new RegExp(chantierNom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(texte, /Donneur d’ordre/i);
    await page.getByRole("button", { name: "Le client du devis" }).click();
    await page.locator("[data-atlas='suivant']").click();
    await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: "2 sur 6" }).waitFor({ timeout: 15_000 });
    const { rows: r } = await pool.query<{ etape_vue: number; loi_lue: boolean }>(`SELECT etape_vue, loi_lue FROM fiches_securite WHERE chantier_id = $1`, [chantierId]);
    assert.equal(r.length, 1, "une fiche, en base, dès le premier « Suivant »");
    assert.equal(r[0].etape_vue, 1);
    assert.equal(r[0].loi_lue, true);
  });

  await cas("une case se coche sans que l'écran remonte ; un mot s'ajoute au bout de la liste, coché", async () => {
    const groupe = page.locator("[data-atlas='groupe-coupe']");
    await groupe.scrollIntoViewIfNeeded();
    const defilement = () => page.evaluate(() => window.scrollY);
    const avant = await defilement();
    const secateur = groupe.getByRole("button", { name: "Sécateur", exact: true });
    await secateur.click();
    assert.equal(await secateur.getAttribute("aria-pressed"), "true");
    const apres = await defilement();
    assert.ok(Math.abs(apres - avant) < 4, `l'écran a bougé en cochant : ${avant} → ${apres}`);
    await page.locator("[data-atlas='ajouter-coupe']").click();
    await page.locator("[data-atlas='mot-ajoute-coupe']").fill("Perche élagueuse");
    await page.locator("[data-atlas='valider-ajout-coupe']").click();
    const ajoutee = groupe.getByRole("button", { name: "Perche élagueuse", exact: true });
    await ajoutee.waitFor({ timeout: 5_000 });
    assert.equal(await ajoutee.getAttribute("aria-pressed"), "true", "un mot ajouté arrive coché");
    await page.locator("[data-atlas='groupe-travaux']").getByRole("button", { name: "Haubanage", exact: true }).click();
  });

  await cas("les écrans 3, 4 et 5 se passent, puis la signature au doigt ouvre « Fiche signée »", async () => {
    for (const n of [3, 4, 5, 6]) {
      await page.locator("[data-atlas='suivant']").click();
      await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: `${n} sur 6` }).waitFor({ timeout: 15_000 });
    }
    const texte = await page.locator("body").innerText();
    assert.match(texte, /Encore vide/i, "ce qui manque se dit avant de signer");
    const signer = page.locator("[data-atlas='signer-la-fiche']");
    assert.equal(await signer.isDisabled(), true, "sans trait, on ne signe pas");
    const toile = page.locator("[data-atlas='signature'] canvas");
    await toile.scrollIntoViewIfNeeded();
    const bb = await toile.boundingBox();
    assert.ok(bb, "la toile de signature ne se mesure pas");
    await page.mouse.move(bb.x + 30, bb.y + 90);
    await page.mouse.down();
    for (let i = 0; i < 30; i++) await page.mouse.move(bb.x + 30 + i * 8, bb.y + 90 + Math.sin(i / 3) * 25);
    await page.mouse.up();
    await signer.click();
    await page.locator("[data-atlas='fiche-signee']").waitFor({ timeout: 20_000 });
    const { rows: r } = await pool.query<{ signee_le: Date | null; signataire: string | null; signature_png: string | null }>(
      `SELECT signee_le, signataire, signature_png FROM fiches_securite WHERE chantier_id = $1`,
      [chantierId]
    );
    assert.ok(r[0].signee_le, "la signature n'est pas en base");
    assert.ok(r[0].signature_png?.startsWith("data:image/png;base64,"), "le trait n'est pas en base");
    assert.ok(r[0].signataire, "le nom du signataire n'est pas en base");
  });

  await cas("le PDF répond, en PDF, et se télécharge sous son nom", async () => {
    const r = await page.request.get(`${BASE}/planning/fiche-de-securite/${chantierId}/pdf`);
    assert.equal(r.status(), 200);
    assert.match(r.headers()["content-type"] ?? "", /application\/pdf/);
    const octets = await r.body();
    assert.ok(octets.length > 5_000, `un PDF de ${octets.length} octets n'est pas une fiche`);
    assert.equal(octets.subarray(0, 4).toString(), "%PDF");
    const t = await page.request.get(`${BASE}/planning/fiche-de-securite/${chantierId}/pdf?telecharger=1`);
    assert.match(t.headers()["content-disposition"] ?? "", /attachment.*fiche-de-securite\.pdf/);
  });

  await cas("la liste de Paysage porte la fiche signée, avec « gardée jusqu'au »", async () => {
    await page.goto(`${BASE}/paysage/fiches-securite`, { waitUntil: "networkidle" });
    await page.locator("[data-atlas='liste-des-fiches-de-securite']").waitFor({ timeout: 20_000 });
    const carte = page.locator("[data-atlas='carte-de-fiche']").filter({ hasText: chantierNom }).first();
    await carte.waitFor({ timeout: 15_000 });
    assert.match(await carte.innerText(), /gardée jusqu’au/);
    await page.goto(`${BASE}/paysage`, { waitUntil: "networkidle" });
    assert.ok(await page.locator('a[href="/paysage/fiches-securite"]').count(), "la ligne « Fiches de sécurité » manque dans Paysage");
  });

  await cas("au retour sur le planning, le bandeau dit « signée » ; la mémoire de l'entreprise porte ce qui a été coché", async () => {
    await ouvrirLaFicheDuJour();
    await page.locator(COMPTE).filter({ hasText: "signée" }).waitFor({ timeout: 15_000 });
    const { rows: r } = await pool.query<{ contenu: { coches: Record<string, string[]>; ajouts: Record<string, string[]> } }>(
      `SELECT contenu FROM fiches_securite_memoire WHERE entreprise_id = (SELECT entreprise_id FROM chantiers WHERE id = $1)`,
      [chantierId]
    );
    assert.equal(r.length, 1, "la mémoire de l'entreprise n'a pas été écrite");
    assert.ok(r[0].contenu.coches.travaux?.includes("Haubanage"), "ce qui est coché n'est pas gardé pour la fiche suivante");
    assert.ok(r[0].contenu.ajouts.coupe?.includes("Perche élagueuse"), "le mot ajouté n'est pas gardé");
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();
  console.log(echecs === 0 ? "\n✅ La fiche de sécurité se remplit, se signe et se retrouve." : `\n❌ ${echecs} cas en échec.`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
