import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";

// Regarder l'écran, et pas seulement les tests.
//
// Trois défauts réels de ce projet — une barre de navigation sur la page du
// client, l'ordre des totaux d'une facture, une pile de notifications qui
// poussait le contenu dehors — ont été trouvés en regardant une capture, jamais
// par un test vert (`CLAUDE.md` §5).
//
// Suppose un serveur déjà démarré sur le port 3000.

const BASE = "http://localhost:3000";
const OUT = "artifacts/screenshots/grille-fendage";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 852 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-reglages.png`, fullPage: true });

  await page.goto(`${BASE}/reglages/prix`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/02-grille-fermee.png`, fullPage: true });

  await page.getByRole("button", { name: /Arbre 15 à 20 m/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/03-grille-ouverte.png`, fullPage: true });

  await navigateur.close();
  console.log(`Captures dans ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
