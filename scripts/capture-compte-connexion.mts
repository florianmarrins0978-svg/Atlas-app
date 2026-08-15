// Prend les captures des deux dernières rubriques des réglages.
//   npx tsx scripts/capture-compte-connexion.mts <dossier>
//
// SERT À REGARDER L'ÉCRAN, et c'est une obligation du dépôt : trois défauts
// réels d'Atlas n'ont été trouvés que là, jamais par un test vert
// (`CLAUDE.md` §5) — une barre de navigation en trop, l'ordre des totaux d'une
// facture, une pile de notifications qui poussait tout hors de l'écran.
//
// Quatre états, et le dernier n'est pas un ornement : l'œil ouvert et la
// demande de confirmation sont les deux gestes que le patron a demandés le
// 14 août 2026. Un pictogramme mort et un bouton qui part au premier doigt se
// ressemblent, sur une capture au repos.
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-compte";
mkdirSync(dossier, { recursive: true });

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

const navigateur = await lancerNavigateur();
// 390 × 844 : son iPhone. Une capture prise sur un grand écran ne montre pas
// ce qu'il voit, et c'est précisément ce qu'on cherche à regarder.
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();

try {
  await connecter(page);

  const prendre = async (nom: string) => {
    await page.waitForTimeout(400);
    const chemin = path.join(dossier, `${nom}.png`);
    await page.screenshot({ path: chemin });
    console.log(`  · ${chemin}`);
  };

  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  await prendre("1-sommaire");

  await page.goto(`${BASE}/reglages/compte`, { waitUntil: "networkidle" });
  await prendre("2-mon-compte");

  await page.goto(`${BASE}/reglages/connexion`, { waitUntil: "networkidle" });
  await prendre("3-connexion");

  // L'œil ouvert, sur une saisie en cours : l'état que personne ne voit sur
  // une capture au repos, et celui qu'il a demandé.
  await page.locator('input[aria-label="Nouveau mot de passe"]').fill("bruyere-42-nord");
  await page.locator('input[aria-label="Confirmer le nouveau mot de passe"]').fill("bruyere-42-nord");
  await page.getByRole("button", { name: /Afficher nouveau mot de passe/i }).click();
  await prendre("4-oeil-ouvert");

  // La demande de confirmation — le second appui, celui qui évite qu'on se
  // déconnecte par mégarde au milieu d'un écran de réglages.
  await page.getByRole("button", { name: /Me déconnecter partout/ }).first().click();
  await prendre("5-deconnexion-demandee");
} finally {
  await navigateur.close();
}
