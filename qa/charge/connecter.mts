/**
 * Ouvre une VRAIE session pour chaque compte de charge, dans un vrai navigateur :
 * formulaire de connexion, acceptation des documents légaux si elle est
 * demandée, puis vérification que l'accueil s'ouvre bien.
 *
 * k6 ne sait pas jouer une action serveur Next.js (la connexion en est une) :
 * il reçoit donc les cookies de session ainsi obtenus, comme un navigateur qui
 * garde sa session ouverte.
 *
 * Usage : npx tsx qa/charge/connecter.mts <dossier> [adresse]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lancerNavigateur } from "../../scripts/e2e-browser";

const dossier = process.argv[2];
const BASE = process.argv[3] ?? "http://localhost:3000";
type Compte = { email: string; motDePasse: string; entrepriseId: string; nom: string; chantierIds: string[] };
const comptes: Compte[] = JSON.parse(readFileSync(join(dossier, "comptes.json"), "utf8"));

const navigateur = await lancerNavigateur();
const sessions: Array<Compte & { cookie: string }> = [];

for (const compte of comptes) {
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.fill('input[name="email"]', compte.email);
  await page.fill('input[name="password"]', compte.motDePasse);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });

  for (let essai = 0; essai < 3 && /documents-legaux|bienvenue/.test(page.url()); essai++) {
    const cases = page.locator('input[type="checkbox"]');
    for (let i = 0; i < (await cases.count()); i++) await cases.nth(i).check();
    await page.getByRole("button", { name: /^(continuer|commencer)$/i }).first().click();
    await page.waitForURL((u) => !/documents-legaux/.test(u.pathname), { timeout: 30_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle");
  }

  const reponse = await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  const url = new URL(page.url());
  if (!reponse?.ok() || url.pathname !== "/planning") {
    throw new Error(`${compte.email} : session non ouverte (arrivé sur ${url.pathname}, statut ${reponse?.status()})`);
  }
  const cookies = await contexte.cookies();
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  if (!cookies.some((c) => c.name.includes("session-token"))) throw new Error(`${compte.email} : pas de jeton de session`);
  sessions.push({ ...compte, cookie });
  console.log(`${compte.email} connecté (${cookies.length} cookies)`);
  await contexte.close();
}

await navigateur.close();
writeFileSync(join(dossier, "sessions.json"), JSON.stringify(sessions, null, 2));
console.log(`${sessions.length} sessions écrites`);
