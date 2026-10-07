// La double vérification, jouée comme lui la jouera : dans un navigateur.
//
// **Par où il arrive** (`CLAUDE.md` §5 quater) : Réglages, l'interrupteur, les
// trois étapes ; puis la porte, le mot de passe, l'écran du code. Et par où un
// intrus arriverait : la route d'Auth.js appelée directement, avec le bon mot
// de passe et sans code. C'est elle qui dit si la porte est vraiment fermée.
//
// Un compte d'essai au rôle commercial, créé ici : la double vérification y est
// facultative partout, et le compte de démonstration, qui sert à toutes les
// autres suites, n'est pas touché.
import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import type { Browser, Page } from "playwright";
import { donnerUnAcces, listerAcces } from "../src/server/repositories/membres-entreprise";
import { documentsAAccepter, enregistrerAcceptations } from "../src/server/repositories/documents-legaux";
import type { Ctx } from "../src/server/repositories/context";
import { base32Decode, codeTotp, pasDeTemps } from "../src/lib/double-verification";
import { ADRESSE } from "./_adresse";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;
const CAPTURES = "artifacts/screenshots/double-verification";
const MOT_DE_PASSE = "trois-mots-courts";

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

/**
 * Le code que son appli afficherait, dans `tranches` tranches de trente
 * secondes : un code ne sert qu'une fois, donc chaque étape prend la suivante,
 * comme le ferait un artisan qui attend que le chiffre change.
 */
function codeDuTelephone(cle: string, tranches: number): string {
  return codeTotp(base32Decode(cle.replace(/\s/g, ""))!, pasDeTemps(Date.now()) + tranches);
}

async function connecter(navigateur: Browser, email: string, options: Parameters<Browser["newContext"]>[0] = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, ...options });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', MOT_DE_PASSE);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname !== "/login", { timeout: 30_000 });
  return page;
}

/**
 * La porte de service : un fournisseur d'Auth.js appelé par sa route, sans
 * l'écran. Rend le statut HTTP. Les retours de connexion sont murés (404) sauf
 * Google et Apple : sans cela, `second-facteur` accepterait des codes hors de
 * l'écran, donc hors du compteur d'échecs.
 */
async function statutDeLaRouteDirecte(navigateur: Browser, fournisseur: string, champs: Record<string, string>): Promise<number> {
  const contexte = await navigateur.newContext();
  const { csrfToken } = (await (await contexte.request.get(`${BASE}/api/auth/csrf`)).json()) as { csrfToken: string };
  const reponse = await contexte.request.post(`${BASE}/api/auth/callback/${fournisseur}`, {
    form: { ...champs, csrfToken, callbackUrl: `${BASE}/` },
    maxRedirects: 0,
  });
  await contexte.close();
  return reponse.status();
}

async function ouvrirActivation(page: Page) {
  await page.goto(`${BASE}/reglages/connexion/double-verification`, { waitUntil: "networkidle" });
  await page.click('[data-atlas="double-verification"]');
  await page.waitForSelector('[data-atlas="cle-double-verification"]', { timeout: 15_000 });
}

async function main() {
  console.log("=== La double vérification, dans un navigateur ===\n");

  const { rows } = await pool.query(
    `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
       FROM membres_entreprise me JOIN users usr ON usr.id = me.utilisateur_id
      WHERE usr.email = 'demo@atlas.local' AND me.role = 'proprietaire' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration n'est pas patron : la base n'est pas amorcée");
  const ctxPatron: Ctx = { utilisateurId: rows[0].u, entrepriseId: rows[0].e };

  const email = `double-verification-${Date.now().toString(36)}@essai.local`;
  const donne = await donnerUnAcces(ctxPatron, {
    nom: "Essai double vérification",
    email,
    motDePasse: MOT_DE_PASSE,
    confirmation: MOT_DE_PASSE,
    role: "commercial",
  });
  assert.deepEqual(donne, { ok: true }, "le compte d'essai n'a pas pu être créé");
  const lui = (await listerAcces(ctxPatron)).find((l) => l.email === email)!;
  const aAccepter = await documentsAAccepter(lui.utilisateurId);
  if (aAccepter.length > 0) {
    await enregistrerAcceptations(lui.utilisateurId, aAccepter.map((d) => d.id), {
      adresseIp: "127.0.0.1",
      agentUtilisateur: "suite d'essai",
    });
  }

  mkdirSync(CAPTURES, { recursive: true });
  const navigateur = await lancerNavigateur();
  let cle = "";
  let codesSecours: string[] = [];

  await cas("tant qu'elle n'est pas active, le mot de passe suffit", async () => {
    const page = await connecter(navigateur, email);
    assert.ok(!page.url().includes("/login/code"), `envoyé sur ${page.url()}`);
    await page.context().close();
  });

  // **Le témoin du cas des routes murées.** Sans lui, un 404 pourrait venir
  // d'une adresse mal écrite dans la suite, pas d'une porte fermée. Vu le
  // 7 octobre 2026 : un premier cas « aucune session par la route directe »
  // restait vert la protection retirée, parce que la route rendait 404 pour
  // tout le monde. Google, lui, doit répondre autre chose qu'un 404.
  await cas("témoin : la route de Google existe toujours", async () => {
    const statut = await statutDeLaRouteDirecte(navigateur, "google", {});
    assert.notEqual(statut, 404, "la route de Google rend 404 : le cas des routes murées ne prouverait rien");
  });

  // Sa question du 30 septembre : depuis le téléphone, on ne scanne pas
  // l'écran qu'on tient. Un écran tactile reçoit le bouton, pas le carré.
  await cas("sur un téléphone, un bouton ouvre l'appli ; pas de code carré", async () => {
    const page = await connecter(navigateur, email, { hasTouch: true, isMobile: true });
    await ouvrirActivation(page);
    const lien = page.locator('a[href^="otpauth://totp/"]');
    assert.ok(await lien.isVisible(), "le bouton vers l'appli n'est pas visible");
    assert.ok(!(await page.locator('[data-atlas="code-carre"]').isVisible()), "le code carré s'affiche sur un téléphone");
    await page.screenshot({ path: `${CAPTURES}/telephone-etape-1.png`, fullPage: true });
    await page.context().close();
  });

  await cas("sur un ordinateur, le code carré ; puis trois étapes, et elle est active", async () => {
    const page = await connecter(navigateur, email);
    await ouvrirActivation(page);
    assert.ok(await page.locator('[data-atlas="code-carre"]').isVisible(), "pas de code carré sur un ordinateur");
    await page.screenshot({ path: `${CAPTURES}/ordinateur-etape-1.png`, fullPage: true });
    cle = (await page.textContent('[data-atlas="cle-double-verification"]'))!.trim();
    await page.click("text=Continuer");

    await page.fill('[data-atlas="code-activation"]', "000000");
    await page.click("text=Vérifier");
    await page.waitForSelector("text=Ce code n'est pas le bon.");

    await page.fill('[data-atlas="code-activation"]', codeDuTelephone(cle, 0));
    await page.click("text=Vérifier");
    await page.waitForSelector('[data-atlas="codes-secours"]');
    codesSecours = (await page.locator('[data-atlas="codes-secours"] li').allTextContents()).map((c) => c.trim());
    assert.equal(codesSecours.length, 10);
    await page.screenshot({ path: `${CAPTURES}/etape-3.png`, fullPage: true });
    assert.ok(await page.locator("text=Terminer").isDisabled(), "Terminer est permis sans avoir noté les codes");
    await page.check("text=Je les ai notés");
    await page.click("text=Terminer");
    await page.waitForSelector('[data-atlas="double-verification-active"]');
    await page.context().close();
  });

  await cas("le mot de passe seul ne suffit plus : l'écran du code, et un faux code refusé", async () => {
    const page = await connecter(navigateur, email);
    assert.equal(new URL(page.url()).pathname, "/login/code");
    await page.screenshot({ path: `${CAPTURES}/porte-code.png`, fullPage: true });
    // Aucune session tant que le code n'est pas donné : un écran privé renvoie
    // à la porte.
    await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
    assert.ok(!new URL(page.url()).pathname.startsWith("/reglages"), "une session existe avant le code");
    await page.goto(`${BASE}/login/code`, { waitUntil: "networkidle" });
    await page.fill('[data-atlas="code-double-verification"]', "000000");
    await page.click('button[type="submit"]');
    await page.waitForSelector("text=Ce code n'est pas le bon.");
    await page.context().close();
  });

  await cas("le bon code ouvre ; sans « ne plus demander », il revient à la connexion suivante", async () => {
    const page = await connecter(navigateur, email);
    await page.uncheck('input[name="retenir"]');
    await page.fill('[data-atlas="code-double-verification"]', codeDuTelephone(cle, 1));
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
    const cookies = await page.context().cookies();
    assert.ok(!cookies.some((c) => c.name === "atlas-appareil-retenu"), "l'appareil est retenu sans l'avoir demandé");
    await page.context().close();
  });

  await cas("un code de secours ouvre une fois, et l'appareil retenu n'en redemande plus", async () => {
    const page = await connecter(navigateur, email);
    await page.click("text=Utiliser un code de secours");
    await page.fill('[data-atlas="code-double-verification"]', codesSecours[0].toLowerCase());
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
    const cookies = await page.context().cookies();
    assert.ok(cookies.some((c) => c.name === "atlas-appareil-retenu" && c.httpOnly), "l'appareil n'est pas retenu");

    // Même navigateur, nouvelle connexion : plus de code.
    await page.context().clearCookies({ name: /authjs/ });
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', MOT_DE_PASSE);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => u.pathname !== "/login", { timeout: 30_000 });
    assert.ok(!page.url().includes("/login/code"), "l'appareil retenu redemande le code");
    await page.context().close();
  });

  await cas("un code de secours déjà servi ne rouvre pas", async () => {
    const page = await connecter(navigateur, email);
    await page.click("text=Utiliser un code de secours");
    await page.fill('[data-atlas="code-double-verification"]', codesSecours[0]);
    await page.click('button[type="submit"]');
    await page.waitForSelector("text=Ce code n'est pas le bon.");
    await page.context().close();
  });

  // La porte de service : la route d'Auth.js, appelée sans passer par l'écran.
  await cas("les routes du mot de passe et du code sont murées", async () => {
    assert.equal(await statutDeLaRouteDirecte(navigateur, "credentials", { email, password: MOT_DE_PASSE }), 404);
    assert.equal(await statutDeLaRouteDirecte(navigateur, "second-facteur", { code: "000000" }), 404);
  });

  await navigateur.close();
  await pool.end();
  console.log("");
  if (echecs) {
    console.log(`${echecs} ÉCHEC(S).`);
    process.exit(1);
  }
  console.log("La double vérification, dans un navigateur — 0 échec(s).");
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
