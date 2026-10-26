import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { jourDuPatron } from "./_jour-e2e";
import { jpegDeTaille } from "./_images-temoins";

// LA FICHE DE SÉCURITÉ, PAR OÙ IL ARRIVE — la fiche du jour sur le planning.
//
// Le chemin du patron, du premier geste au dernier (`CLAUDE.md` §5 quater) :
// le bandeau sur la fiche du jour, « ce que demande la loi » une fois, les six
// écrans, une case cochée sans que l'écran remonte, un mot ajouté, le croquis
// dessiné, la signature REFUSÉE tant que le minimum légal manque (sa règle du
// 14 octobre 2026), la signature au doigt, la lecture signée par l'équipe,
// l'enregistrement final, le PDF qui répond, la liste dans Paysage, et le
// bandeau qui dit « signée » au retour. Puis la base : une fiche, signée, et la
// mémoire de l'entreprise qui porte ce qui a été coché.

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const LIGNE = "[data-atlas='ligne-planifiee']";
const FEUILLE = "[data-atlas='feuille']";
const BANDEAU = "[data-atlas='fiche-de-securite']";
const OUVRIR = "[data-atlas='ouvrir-fiche-de-securite']";
const COMPTE = "[data-atlas='compte-de-la-fiche']";
// **L'écran, cité en clair.** `_suites-ciblees.mjs` cherche l'adresse entre
// guillemets pour savoir quelle suite ouvre quel écran ; écrite seulement dans
// un gabarit (`` `…/${chantierId}` ``), elle ne s'y voyait pas, et le calcul du
// niveau annonçait « aucune suite navigateur n'ouvre /planning/fiche-de-securite »
// — alors que celle-ci l'ouvre du premier geste au dernier (22 septembre 2026).
const ECRAN = "/planning/fiche-de-securite";
const TEL_DE_L_ENTREPRISE = "Téléphone (en cas d’incident ou d’accident)";
const SIGNATAIRE = "Nom et prénom du chef d’entreprise (ou de son représentant)";
const NOM_SIGNE = "Martins Florian";

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
  // Un téléphone qui donne sa position, comme le sien sur le chantier.
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, geolocation: { latitude: 48.99387, longitude: 1.71077 }, permissions: ["geolocation"] });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  async function ouvrirLaFicheDuJour() {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    // Les sept jours se lisent d\'office sous le mois depuis sa planche du
    // 25 octobre 2026 : plus de mot « La semaine » à toucher.
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
    // **On attend « Travaux à faire » avant de juger sa place** (26 septembre
    // 2026) : le bloc dit d'abord « Lecture du devis… », le temps que le devis
    // se lise. Sous la charge de la batterie, l'ordre se mesurait pendant ce
    // temps-là, et le bloc manquait (169 suites sur 170, joué seul : vert). S'il
    // ne vient jamais, l'attente échoue : le contrôle n'est pas relâché.
    await page.locator(`${FEUILLE} [data-atlas='travaux-a-faire']`).first().waitFor({ state: "attached", timeout: 30_000 });
    const ordre = await page.locator(FEUILLE).evaluate((f) => {
      const enfants = Array.from(f.querySelectorAll("[data-atlas='fiche-de-securite'], [data-atlas='travaux-a-faire']"));
      return enfants.map((e) => e.getAttribute("data-atlas"));
    });
    assert.deepEqual(ordre, ["fiche-de-securite", "travaux-a-faire"], "la fiche de sécurité se remplit AVANT les travaux : elle est au-dessus");
  });

  // Ce que « Travaux à faire » montre AVANT que la fiche ne pose quoi que ce
  // soit : c'est la référence du contrôle de la fin.
  let photosDeLaFeuilleAvant = -1;
  await cas("« Travaux à faire » montre les photos du chantier — on les compte avant", async () => {
    await page.locator("[data-atlas='ouvrir-travaux']").click();
    await page.locator("[data-atlas='ajouter-photo-retour']").waitFor({ state: "visible", timeout: 20_000 });
    photosDeLaFeuilleAvant = await page.locator("[data-atlas='photo-du-retour']").count();
    await page.locator("[data-atlas='ouvrir-travaux']").click();
  });

  await cas("« Remplir la fiche » ouvre d'abord ce que demande la loi, une fois", async () => {
    await page.locator(OUVRIR).click();
    await page.locator("[data-atlas='remplir-la-fiche']").click();
    await page.waitForURL(new RegExp(`${ECRAN}/${chantierId}`), { timeout: 20_000 });
    await page.getByRole("heading", { name: "Décret 2021-1833, en vigueur depuis le 1er mars 2022" }).waitFor({ timeout: 20_000 });
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

  // Trouvé le 14 octobre 2026 en regardant l'écran : l'en-tête des pages interdisait la position, et
  // « Relever ici » répondait « refusé » sans rien demander. Sa remarque du 22 septembre.
  await cas("ÉCRAN 1 — « Relever ici » pose le point, et la carte s'ouvre dessus", async () => {
    await page.locator("[data-atlas='relever-gps']").click();
    await page.locator("[data-atlas='repere-du-point']").waitFor({ timeout: 30_000 });
    assert.equal(await page.getByPlaceholder("Exemple : 48.94123, 1.72004").inputValue(), "48.99387, 1.71077", "le point relevé n'est pas celui du téléphone");
    const tuile = await page.evaluate(async () => {
      const r = await fetch("/api/carte/tuile?fond=plan&z=99&x=0&y=0");
      return r.status;
    });
    assert.equal(tuile, 400, "la route des tuiles relaie une tuile qui n'existe pas");
  });

  // Sa demande du 15 octobre 2026 : *« il faut pouvoir écrire l'adresse »*. Le téléphone qui refuse
  // sa position ne doit pas laisser que des coordonnées à taper. La liste est servie ici : la
  // recherche elle-même est éprouvée par `test-adresse-suggestions-e2e`.
  await cas("ÉCRAN 1 — une adresse cherchée pose le point, et la carte y va", async () => {
    await page.route("**/api/adresses**", (route) =>
      route.fulfill({ json: { suggestions: [{ libelle: "12 Rue des Ecoles 78200 Mantes-la-Jolie", contexte: "78, Yvelines", latitude: 48.99296, longitude: 1.71384 }] } })
    );
    await page.getByLabel("Chercher une adresse").fill("12 rue des écoles mantes");
    await page.getByRole("option").filter({ hasText: "12 Rue des Ecoles" }).click();
    const gps = page.getByPlaceholder("Exemple : 48.94123, 1.72004");
    await page.waitForFunction(() => (document.querySelector('input[placeholder="Exemple : 48.94123, 1.72004"]') as HTMLInputElement | null)?.value === "48.99296, 1.71384", null, { timeout: 10_000 });
    assert.equal(await gps.inputValue(), "48.99296, 1.71384", "l'adresse choisie n'a pas posé le point");
    await page.locator("[data-atlas='repere-du-point']").waitFor({ timeout: 10_000 });
    await page.unroute("**/api/adresses**");
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

  // ─── LA PHOTO DU TERRAIN S'OUVRE EN GRAND — sa demande du 22 septembre 2026 ─
  //
  // *« Les photos de la fiche de sécurité, je ne peux pas cliquer dessus pour
  // les voir en grand et les faire défiler comme pour celle de la fiche
  // d'intervention. »* Ce qui se mesure ici, c'est SON geste : poser des
  // photos, appuyer sur l'une d'elles, feuilleter, ressortir.
  //
  // **Les photos sont POSÉES par l'écran, jamais empruntées au jeu de
  // démonstration** : le chantier retenu par cette suite est le dernier créé,
  // et il peut n'en porter aucune — un contrôle qui mesure zéro ne mesure rien
  // (`CLAUDE.md` §5).
  await cas("ÉCRAN 3 — une photo du terrain s'ouvre EN GRAND, se feuillette, et la croix ressort", async () => {
    await page.locator("[data-atlas='suivant']").click();
    await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: "3 sur 6" }).waitFor({ timeout: 15_000 });
    const vignettes = page.locator("[data-atlas='photo-de-la-fiche']");
    const avant = await vignettes.count();
    await page.locator("[data-atlas='prendre-une-photo'] input[type=file]").setInputFiles(
      [1, 2].map((n) => ({ name: `croquis-${n}.jpg`, mimeType: "image/jpeg", buffer: Buffer.from(jpegDeTaille(2048)) }))
    );
    await page.waitForFunction(
      ([s, n]) => document.querySelectorAll(s).length === n,
      ["[data-atlas='photo-de-la-fiche']", avant + 2] as [string, number],
      { timeout: 30_000 }
    );
    await vignettes.nth(avant).click();
    const enGrand = page.locator("[data-atlas='photo-en-grand']");
    await enGrand.waitFor({ state: "visible", timeout: 10_000 });
    const rang = page.locator("[data-atlas='rang-de-la-photo']");
    assert.equal((await rang.innerText()).trim(), `${avant + 1} / ${avant + 2}`, "la visionneuse n'ouvre pas la photo touchée");
    await page.getByRole("button", { name: "Photo suivante" }).click();
    await page.waitForFunction(
      ([s, t]) => document.querySelector(s)?.textContent?.trim() === t,
      ["[data-atlas='rang-de-la-photo']", `${avant + 2} / ${avant + 2}`] as [string, string],
      { timeout: 5_000 }
    );
    // **La croix, et pas le bouton du navigateur** : c'est exactement ce qui
    // manquait avant — la photo s'ouvrait dans un onglet, et il restait coincé.
    await page.getByRole("button", { name: "Fermer" }).click();
    await enGrand.waitFor({ state: "detached", timeout: 5_000 });
    assert.ok(await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: "3 sur 6" }).isVisible(), "on ne revient pas sur l'écran 3 en fermant la photo");
  });

  // ─── LE CROQUIS — sa règle du 14 octobre 2026 : *« il ne doit pas pouvoir
  // valider le croquis sans ces éléments »*. On éprouve SON geste : ouvrir,
  // vouloir finir trop tôt, poser l'accès, la voie et un arbre, finir.
  await cas("ÉCRAN 3 — le croquis refuse de finir sans l'accès, la voie et un arbre, puis les accepte", async () => {
    await page.locator("[data-atlas='croquis-page-blanche']").click();
    const dessin = page.locator("[data-atlas='dessin-du-croquis']");
    await dessin.waitFor({ state: "visible", timeout: 10_000 });
    await page.locator("[data-atlas='croquis-termine']").click({ force: true }); // montré refusé (aria-disabled) : Playwright n'y touche pas sans force, le patron si
    await page.locator("[data-atlas='consigne-du-croquis']").filter({ hasText: "Il manque encore" }).waitFor({ timeout: 5_000 });
    assert.ok(await dessin.isVisible(), "« Terminé » a fermé un croquis incomplet");
    // Un appui au point (x, y) de la feuille de 400 sur 300, quelle que soit la taille de l'écran.
    const toucher = async (x: number, y: number) => {
      const [px, py] = await dessin.evaluate((s, [a, b]) => {
        const q = new DOMPoint(a, b).matrixTransform((s as SVGSVGElement).getScreenCTM()!);
        return [q.x, q.y];
      }, [x, y] as [number, number]);
      await page.mouse.click(px, py);
    };
    await page.locator("[data-atlas='outil-acces']").click();
    await toucher(180, 290);
    await toucher(180, 200);
    await page.locator("[data-atlas='outil-voie']").click();
    await toucher(10, 270);
    await toucher(390, 270);
    await page.locator("[data-atlas='outil-abattre']").click();
    await toucher(260, 100);
    await page.locator("[data-atlas='croquis-termine']").click({ force: true });
    await dessin.waitFor({ state: "detached", timeout: 5_000 });
    assert.equal(await page.locator("[data-atlas='obligatoire-du-croquis'][data-pose='true']").count(), 3, "les trois éléments de la loi ne sont pas cochés");
    const enBase = async () => {
      const { rows } = await pool.query<{ contenu: { croquis?: { marques?: { t: string }[] } } }>(`SELECT contenu FROM fiches_securite WHERE chantier_id = $1`, [chantierId]);
      return (rows[0]?.contenu?.croquis?.marques ?? []).map((m) => m.t).join(",");
    };
    const jusqua = Date.now() + 15_000;
    while ((await enBase()) !== "acces,voie,abattre" && Date.now() < jusqua) await page.waitForTimeout(500);
    assert.equal(await enBase(), "acces,voie,abattre", "le croquis n'est pas enregistré");
  });

  await cas("sans le minimum légal, la signature est refusée, et chaque ligne emmène où remplir", async () => {
    for (const n of [4, 5, 6]) {
      await page.locator("[data-atlas='suivant']").click();
      await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: `${n} sur 6` }).waitFor({ timeout: 15_000 });
    }
    const texte = await page.locator("body").innerText();
    assert.match(texte, /Pour pouvoir signer/i, "ce que la loi exige se dit avant de signer");
    const signer = page.locator("[data-atlas='signer-la-fiche']");
    assert.equal(await signer.getAttribute("aria-disabled"), "true", "le bouton se montre refusé");
    await signer.click({ force: true });
    await page.getByText(/que la loi exige\. Touchez/).waitFor({ timeout: 5_000 });
    assert.equal(await page.locator("[data-atlas='fiche-signee']").count(), 0, "une fiche sans le minimum légal a été signée");
    // La ligne des risques emmène à l'écran 4.
    await page.locator("[data-atlas='manque-de-la-fiche']").filter({ hasText: "Les risques" }).click();
    await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: "4 sur 6" }).waitFor({ timeout: 10_000 });
  });

  await cas("le minimum légal se remplit : « Rien à signaler » compte comme une réponse", async () => {
    for (const famille of ["risquesArbres", "biologique", "reseaux", "environnement"]) {
      await page.locator(`[data-atlas='groupe-${famille}']`).getByRole("button", { name: "Rien à signaler", exact: true }).click();
    }
    await page.locator("[data-atlas='groupe-noyade']").getByRole("button", { name: "Pas de risque de noyade", exact: true }).click();
    await page.locator("[data-atlas='suivant']").click();
    await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: "5 sur 6" }).waitFor({ timeout: 15_000 });
    await page.locator("[data-atlas='groupe-meteo'] [data-atlas='case-de-la-fiche']").first().click();
    await page.locator("[data-atlas='groupe-secours'] [data-atlas='case-de-la-fiche']").first().click();
    await page.getByLabel("Préciser le lieu où se trouve la trousse de secours :").fill("Dans la cabine du camion");
    await page.getByLabel("Préciser le Point de Rencontre des Secours :").fill("Devant le portail");
    // La délimitation, sur l'écran 3.
    await page.locator("[data-atlas='retour-de-la-fiche']").click();
    await page.locator("[data-atlas='retour-de-la-fiche']").click();
    await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: "3 sur 6" }).waitFor({ timeout: 15_000 });
    await page.locator("[data-atlas='groupe-balisage'] [data-atlas='case-de-la-fiche']").first().click();
    for (const n of [4, 5, 6]) {
      await page.locator("[data-atlas='suivant']").click();
      await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: `${n} sur 6` }).waitFor({ timeout: 15_000 });
    }
    await page.getByText("Tout ce que la loi exige est rempli").waitFor({ timeout: 10_000 });
  });

  await cas("la signature au doigt ouvre la suite : l'équipe signe, puis on enregistre", async () => {
    const signer = page.locator("[data-atlas='signer-la-fiche']");
    await signer.click({ force: true });
    await page.getByText("Signez dans le cadre d’abord.").waitFor({ timeout: 5_000 });
    assert.equal(await page.locator("[data-atlas='fiche-signee']").count(), 0, "sans trait, on ne signe pas");
    await page.getByLabel(SIGNATAIRE).fill(NOM_SIGNE);
    const toile = page.locator("[data-atlas='signature'] canvas");
    await toile.scrollIntoViewIfNeeded();
    // **On descend jusqu'au BAS de la page avant de mesurer** — c'est le geste
    // de celui qui signe, et c'est ce qui manquait ici. `scrollIntoViewIfNeeded`
    // s'arrête dès que la toile touche le bas de la fenêtre : le bouton
    // « Signer la fiche », posé en flottant, recouvrait alors son tiers bas, et
    // le doigt d'essai tombait sur le bouton. Le défaut ne se voyait que sur
    // une fiche LONGUE — celle qui porte des photos (22 septembre 2026).
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await page.waitForFunction(
      () => Math.abs(window.scrollY + window.innerHeight - document.body.scrollHeight) < 4,
      undefined,
      { timeout: 5_000 }
    );
    const bb = await toile.boundingBox();
    assert.ok(bb, "la toile de signature ne se mesure pas");
    await page.mouse.move(bb.x + 30, bb.y + 90);
    await page.mouse.down();
    for (let i = 0; i < 30; i++) await page.mouse.move(bb.x + 30 + i * 8, bb.y + 90 + Math.sin(i / 3) * 25);
    await page.mouse.up();
    await signer.click({ force: true });
    await page.locator("[data-atlas='fiche-signee']").waitFor({ timeout: 20_000 });
    const { rows: r } = await pool.query<{ signee_le: Date | null; signataire: string | null; signature_png: string | null }>(
      `SELECT signee_le, signataire, signature_png FROM fiches_securite WHERE chantier_id = $1`,
      [chantierId]
    );
    assert.ok(r[0].signee_le, "la signature n'est pas en base");
    assert.ok(r[0].signature_png?.startsWith("data:image/png;base64,"), "le trait n'est pas en base");
    assert.equal(r[0].signataire, NOM_SIGNE, "le nom tapé n'est pas celui qui est signé");
  });

  // ─── LA LECTURE DE L'ÉQUIPE — sa règle du 14 octobre 2026 : *« si un des gars
  // n'a pas signé, le document ne doit pas pouvoir être enregistré »*. L'équipe
  // de la fiche neuve porte le compte du patron ; le nom signé est un autre :
  // le compte du patron doit donc signer l'avoir lue.
  await cas("tant qu'un de l'équipe n'a pas signé, la fiche ne s'enregistre pas ; signée, elle s'enregistre", async () => {
    const enregistrer = page.locator("[data-atlas='enregistrer-la-fiche']");
    await enregistrer.waitFor({ timeout: 10_000 });
    const enAttente = page.locator("[data-atlas='faire-signer']");
    assert.ok((await enAttente.count()) >= 1, "personne n'attend de signer : le contrôle ne mesure rien");
    await enregistrer.click({ force: true });
    await page.getByText(/doit signer avant d’enregistrer|doivent signer avant d’enregistrer/).first().waitFor({ timeout: 5_000 });
    const finalisee = async () => {
      const { rows } = await pool.query<{ contenu: { finaliseeLe?: string | null } }>(`SELECT contenu FROM fiches_securite WHERE chantier_id = $1`, [chantierId]);
      return rows[0]?.contenu?.finaliseeLe ?? null;
    };
    assert.equal(await finalisee(), null, "une fiche a été enregistrée sans la signature de l'équipe");
    while ((await enAttente.count()) > 0) {
      await enAttente.first().click();
      const feuillet = page.locator("[data-atlas='feuillet-de-lecture']");
      await feuillet.waitFor({ timeout: 5_000 });
      const toile = feuillet.locator("[data-atlas='signature'] canvas");
      const bb = await toile.boundingBox();
      assert.ok(bb, "la toile de lecture ne se mesure pas");
      await page.mouse.move(bb.x + 30, bb.y + 60);
      await page.mouse.down();
      for (let i = 0; i < 25; i++) await page.mouse.move(bb.x + 30 + i * 8, bb.y + 60 + Math.sin(i / 3) * 20);
      await page.mouse.up();
      await page.locator("[data-atlas='valider-la-lecture']").click();
      await feuillet.waitFor({ state: "detached", timeout: 10_000 });
    }
    await enregistrer.click({ force: true });
    await page.locator("[data-atlas='fiche-enregistree']").waitFor({ timeout: 10_000 });
    assert.ok(await finalisee(), "l'enregistrement n'est pas en base");
    const { rows } = await pool.query<{ contenu: { lectures?: { png: string }[] } }>(`SELECT contenu FROM fiches_securite WHERE chantier_id = $1`, [chantierId]);
    assert.ok((rows[0].contenu.lectures ?? []).every((l) => l.png.startsWith("data:image/png;base64,")), "une lecture sans son trait");
  });

  await cas("le PDF répond, en PDF, et se télécharge sous son nom", async () => {
    const r = await page.request.get(`${BASE}${ECRAN}/${chantierId}/pdf`);
    assert.equal(r.status(), 200);
    assert.match(r.headers()["content-type"] ?? "", /application\/pdf/);
    const octets = await r.body();
    assert.ok(octets.length > 5_000, `un PDF de ${octets.length} octets n'est pas une fiche`);
    assert.equal(octets.subarray(0, 4).toString(), "%PDF");
    const t = await page.request.get(`${BASE}${ECRAN}/${chantierId}/pdf?telecharger=1`);
    assert.match(t.headers()["content-disposition"] ?? "", /attachment.*fiche-de-securite\.pdf/);
  });

  await cas("la liste de Paysage porte la fiche signée, avec « gardée jusqu'au »", async () => {
    await page.goto(`${BASE}/paysage/fiches-securite`, { waitUntil: "networkidle" });
    await page.locator("[data-atlas='liste-des-fiches-de-securite']").waitFor({ timeout: 20_000 });
    const carte = page.locator("[data-atlas='carte-de-fiche']").filter({ hasText: chantierNom }).first();
    await carte.waitFor({ timeout: 15_000 });
    assert.match(await carte.innerText(), /gardée jusqu’au/);

    // LA RECHERCHE PAR NOM — sa demande du 22 septembre 2026 : *« une recherche
    // par nom, et il te sort toutes les fiches de ce client »*. Tapé, le nom
    // garde la fiche ; un nom inconnu la retire et le dit.
    const champ = page.locator("[data-atlas='chercher-une-fiche']");
    await champ.fill(chantierNom.slice(0, 6).toLowerCase());
    await carte.waitFor({ timeout: 5_000 });
    await champ.fill("zzqqxx");
    await page.getByText("Aucune fiche pour « zzqqxx ».").waitFor({ timeout: 5_000 });
    assert.equal(await page.locator("[data-atlas='carte-de-fiche']").count(), 0, "un nom inconnu laisse des fiches à l'écran");
    await champ.fill("");
    await carte.waitFor({ timeout: 5_000 });

    // LE JOUR — *« rajoute le jour aussi en filtre jour mois année »*. La fiche
    // vient d'être signée : elle est au jour d'aujourd'hui, pas à celui d'avant.
    const aujourdhui = jourDuPatron();
    const laVeille = jourDuPatron(1);
    await page.goto(`${BASE}/paysage/fiches-securite?jour=${aujourdhui}`, { waitUntil: "networkidle" });
    await carte.waitFor({ timeout: 15_000 });
    await page.goto(`${BASE}/paysage/fiches-securite?periode=${laVeille}`, { waitUntil: "networkidle" });
    // **Un jour choisi se lit à « Tout le mois »**, son unique sortie depuis
    // la proposition A du 11 octobre 2026 : les trois mots touchables de la B
    // sont partis, et un contrôle qui les réclamerait rendrait l'écran
    // impossible à changer (§5 bis).
    const toutLeMois = page.locator("[data-atlas='tout-le-mois']");
    await toutLeMois.waitFor({ timeout: 15_000 });
    assert.equal(await carte.count(), 0, "la fiche d'aujourd'hui sort sous la veille");

    // LE MOIS — « Tout le mois » rend le mois de la veille ; si la veille est
    // le mois d'avant (on est le 1er), le chevron d'après ramène au nôtre. La
    // fiche du jour doit alors revenir.
    await toutLeMois.click();
    await toutLeMois.waitFor({ state: "detached", timeout: 15_000 });
    if (laVeille.slice(0, 7) !== aujourdhui.slice(0, 7)) {
      await page.locator("[data-atlas='mois-suivant']").click();
    }
    await carte.waitFor({ timeout: 15_000 });
    assert.equal(
      await page.locator("[data-atlas='mois-suivant']").isDisabled(),
      true,
      "le chevron d'après reste ouvert sur le mois en cours"
    );
    await page.goto(`${BASE}/paysage/fiches-securite`, { waitUntil: "networkidle" });
    await carte.waitFor({ timeout: 15_000 });

    // « ENREGISTRER » EST UN BOUTON, PAS UN LIEN — sa capture du 22 septembre
    // 2026 : *« je clique sur enregistrer le pdf, ça me propose pas de le
    // télécharger »*. Un lien vers le PDF, même en `attachment`, se fait
    // PEINDRE par Safari sur son iPhone. Ce qui range le fichier, c'est la
    // feuille de partage, et elle demande que la page aille chercher le PDF
    // elle-même (`BoutonTelechargerDocument`). On éprouve donc le geste qu'il
    // fait, pas la route qu'il ne voit pas.
    await carte.click();
    const enregistrer = page.locator("[data-atlas='enregistrer-le-pdf']").first();
    await enregistrer.waitFor({ timeout: 15_000 });
    assert.equal(
      await enregistrer.evaluate((n) => n.tagName),
      "BUTTON",
      "« Enregistrer le PDF » est redevenu un lien : sur iPhone il ouvre le PDF au lieu de le ranger"
    );

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

  // ─── CHACUNE CHEZ SOI — sa règle du 22 septembre 2026 ─────────────────────
  //
  // *« Les photos dans la fiche de sécurité restent à l'intérieur de la fiche,
  // et les photos de la fiche client restent à l'intérieur de la feuille
  // travaux à faire. »* Les deux photos posées sur l'écran 3 sont des photos
  // de ce chantier : sans la liaison, elles s'afficheraient ici.
  await cas("LES PHOTOS DE LA FICHE NE PASSENT PAS DANS « TRAVAUX À FAIRE »", async () => {
    assert.ok(photosDeLaFeuilleAvant >= 0, "le compte d'avant n'a pas été pris : rien à comparer");
    await page.locator("[data-atlas='ouvrir-travaux']").click();
    await page.locator("[data-atlas='ajouter-photo-retour']").waitFor({ state: "visible", timeout: 20_000 });
    const apres = await page.locator("[data-atlas='photo-du-retour']").count();
    assert.equal(
      apres,
      photosDeLaFeuilleAvant,
      `« Travaux à faire » montre ${apres} photo(s) contre ${photosDeLaFeuilleAvant} avant la fiche : les photos de la fiche de sécurité ont débordé`
    );
    // Et elles existent bien, en base, sur ce chantier : sans cela le contrôle
    // passerait au vert le jour où l'ajout de photo serait cassé.
    const { rows: n } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM fiches_securite_photos f
        JOIN fiches_securite s ON s.id = f.fiche_id WHERE s.chantier_id = $1`,
      [chantierId]
    );
    assert.equal(Number(n[0].n), 2, "les deux photos de l'écran 3 ne sont pas liées à la fiche");
  });

  // *« La case nom et prénom ne s'enregistre pas d'une fiche à l'autre ! »*
  // (22 septembre 2026). Le nom ne vivait que dans l'écran : la fiche suivante
  // repartait du nom du compte. On éprouve SON chemin — une fiche neuve,
  // ouverte depuis l'écran —, pas la mémoire lue en base. En dernier : la fiche
  // signée plus haut est effacée pour en faire naître une neuve.
  await cas("le nom signé est repris sur la fiche suivante", async () => {
    await pool.query(`DELETE FROM fiches_securite WHERE chantier_id = $1`, [chantierId]);
    await page.goto(`${BASE}${ECRAN}/${chantierId}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Compris, je remplis" }).click();
    for (const n of [2, 3, 4, 5, 6]) {
      await page.locator("[data-atlas='suivant']").click();
      await page.locator("[data-atlas='etape-de-la-fiche']").filter({ hasText: `${n} sur 6` }).waitFor({ timeout: 15_000 });
    }
    assert.equal(await page.getByLabel(SIGNATAIRE).inputValue(), NOM_SIGNE, "la fiche neuve ne reprend pas le nom signé sur la précédente");
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
