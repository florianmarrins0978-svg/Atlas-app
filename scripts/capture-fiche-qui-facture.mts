// LA FICHE QUI FACTURE, PHOTOGRAPHIÉE — sa demande du 11 septembre 2026.
//
// *« Il faut rajouter la petite note vocale comme sur la fiche client si on
// veut dicter les infos de la facture ! »*
//
// **Pourquoi une image en plus des suites.** La suite dit que le micro EXISTE ;
// elle ne dit pas qu'il est à sa place, ni que le titre tient sur sa ligne à
// côté de lui. Trois défauts réels de ce dépôt sont sortis d'une capture et
// d'aucun test vert (`CLAUDE.md` §5). Ici le risque est précis : « Fiche
// client » et le micro se partagent la ligne d'en-tête, et le micro vient d'y
// rentrer.
//
// Usage : BASE_URL=… npx tsx scripts/capture-fiche-qui-facture.mts <dossier>
import { mkdirSync, existsSync } from "node:fs";
import { chromium, devices } from "playwright";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-fiche-qui-facture.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";

const navigateur = await chromium.launch({
  headless: true,
  ...(existsSync(CHROME) ? { executablePath: CHROME } : {}),
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const contexte = await navigateur.newContext({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 664 },
  permissions: ["microphone"],
});
const page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.locator('input[name="email"]').fill("demo@atlas.local");
await page.locator('input[name="password"]').fill("demo1234");
await page.locator('button[type="submit"]').click();
await page.getByRole("heading", { name: "Vos chantiers" }).waitFor({ timeout: 60_000 });

// **Par SA porte** : le bouton doré de Terminés, jamais l'adresse composée à la
// main. Une adresse tapée prouve que l'écran marche, pas qu'on y arrive.
await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
await page.locator('[data-atlas="creer-une-facture"]').click();
await page.waitForURL(/\/chantiers\/nouveau/, { timeout: 30_000 });
await page.waitForLoadState("networkidle");

await page.screenshot({ path: `${dossier}/fiche-qui-facture-vide.png` });

// Et rempli comme sur sa capture, pour voir la ligne d'en-tête cohabiter avec
// un écran qui porte du texte.
await page.fill('input[placeholder="Bernard"]', "Frederic");
await page.fill('input[placeholder="06 12 34 56 78"]', "06 79 98 45 14");
await page.fill('input[placeholder="bernard@exemple.fr"]', "flo-speed@hotmail.fr");
await page.fill(
  'input[placeholder="12 rue des Lilas, Nantes"]',
  "Rue Denfert Rochereau 78200 Mantes-la-Jolie"
);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${dossier}/fiche-qui-facture-remplie.png` });

// **Le titre ne se brise JAMAIS en deux**, et le micro vient de rentrer sur sa
// ligne : on le MESURE plutôt que de s'en remettre à l'œil. Une boîte de zéro
// pixel ne se compare à rien — c'est une mesure impossible, pas un succès.
const mesure = await page.evaluate(() => {
  const titre = document.querySelector("h1");
  const micro = document.querySelector<HTMLElement>(
    'button[aria-label="Dicter les informations du client"]'
  );
  if (!titre || !micro) return null;
  const t = titre.getBoundingClientRect();
  const m = micro.getBoundingClientRect();
  return {
    titreUneLigne: t.height > 0 && t.height < 44,
    titre: Math.round(t.height),
    micro: { l: Math.round(m.width), h: Math.round(m.height) },
    seChevauchent: t.right > m.left && t.left < m.right,
    debordement: document.documentElement.scrollWidth > window.innerWidth,
  };
});
console.log(JSON.stringify(mesure, null, 2));

await navigateur.close();
if (!mesure) throw new Error("titre ou micro introuvable : rien n'est mesuré");
if (mesure.micro.h < 44) throw new Error(`le micro fait ${mesure.micro.h} px : sous le pouce`);
if (!mesure.titreUneLigne) throw new Error(`le titre fait ${mesure.titre} px : il s'est brisé`);
if (mesure.seChevauchent) throw new Error("le micro recouvre le titre");
if (mesure.debordement) throw new Error("l'écran déborde sur la largeur");
console.log("✅ la ligne d'en-tête tient : titre entier, micro à 44 px, rien ne déborde.");
