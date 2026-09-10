// L'ÉCRAN « ABONNEMENT », dans ses états — photographié avant de le livrer.
//
//   ATLAS_BASE=http://localhost:3003 npx tsx scripts/capture-abonnement.mts <dossier>
//
// **Pourquoi une capture et pas seulement des suites** (`CLAUDE.md` §5). Ce
// qu'on cherche ne s'écrit pas en assertion : un prix collé à son unité, une
// carte qui déborde à 390 px, trois boutons qui se ressemblent, un mot de trop.
// Six défauts réels de ce dépôt sont sortis d'une image et d'aucun test.
//
// **Il compte aussi les MOTS et la HAUTEUR** : sur un écran qui parle d'argent,
// à un patron qui lit sur un téléphone entre deux chantiers, c'est ce qui dit
// si l'écran est encore lisible.
//
// **`localhost`, JAMAIS `127.0.0.1`** — en développement, Next refuse alors de
// servir le JavaScript de la page, et les boutons ne font rien (payé deux fois
// dans ce dépôt).
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2];
const etat = process.argv[3] ?? "etat";
mkdirSync(dossier, { recursive: true });

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page: Page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.locator('input[name="email"]').waitFor();
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

const reponse = await page.goto(`${BASE}/reglages/abonnement`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

const texte = await page.locator("body").innerText();
const mots = texte.split(/\s+/).filter(Boolean).length;
const hauteur = await page.evaluate(() => document.body.scrollHeight);

// **Refuser de conclure sur une boîte de zéro pixel** (`CLAUDE.md` §5) : une
// page non mise en page rendrait « rien ne déborde », en vert, sur un écran
// cassé.
const debordement = await page.evaluate(() => {
  const corps = document.body;
  if (corps.scrollHeight === 0) return "MESURE IMPOSSIBLE : la page fait zéro pixel";
  return corps.scrollWidth > corps.clientWidth ? `DÉBORDE : ${corps.scrollWidth} > ${corps.clientWidth}` : "aucun";
});

console.log(
  `${etat.padEnd(14)} ${reponse?.status()} · ${String(mots).padStart(4)} mots · ${hauteur} px · débordement : ${debordement}`
);

await page.screenshot({ path: `${dossier}/abonnement-${etat}.png`, fullPage: true });
await navigateur.close();
