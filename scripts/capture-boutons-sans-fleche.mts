/* =======================================================================
   Regarder les boutons dont la flèche est partie.

   **Pourquoi une capture en plus du contrôle.** `test-aucune-fleche.ts`
   prouve qu'aucune flèche ne reste dans le code ; il ne dit rien de ce
   que ça donne à l'œil. Or c'est une capture d'écran, prise sur son
   téléphone entre deux chantiers, qui a signalé le défaut — et c'est la
   cinquième fois dans ce dépôt qu'un défaut sort d'une image et d'aucun
   test (`CLAUDE.md` §5).

   Ce qu'on vérifie en la regardant : un bouton privé de sa flèche reste
   centré, et le texte ne se décale pas vers la gauche en laissant un
   trou à droite.

   Le serveur doit tourner (`npm run dev`), et la base porter le jeu de
   démo (`npm run db:seed`).

   Usage :
     npx tsx scripts/capture-boutons-sans-fleche.mts /tmp/captures
   ======================================================================= */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-boutons-sans-fleche.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
const page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

/* L'accueil, pour mémoire — aucun libellé attendu : c'est justement les
   libellés qui bougent, et une capture qui meurt sur un délai dépassé ne
   montre rien du tout. */
await page.waitForLoadState("networkidle");
await page.screenshot({ path: path.join(dossier, "accueil.png") });

await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.getByLabel(/Nom du client/i).fill(`Sans flèche ${Date.now()}`);
await page.fill('input[placeholder="06 12 34 56 78"]', "07 11 22 33 44");
const chantierId = await creerPuisFiche(page, BASE);

/* L'écran qu'il a photographié : « Créer la facture », sans flèche. */
await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Le chantier est réalisé", { timeout: 60_000 });
await page.screenshot({ path: path.join(dossier, "facture.png") });

/* **La mesure, pas seulement l'image** : un bouton dont on retire un
   morceau peut garder sa largeur et laisser le texte de travers. */
const bouton = page.getByRole("button", { name: /Créer la facture/i }).first();
const dit = (await bouton.innerText()).trim();
const boite = await bouton.boundingBox();
if (!boite || boite.width < 40) {
  console.error(`❌ le bouton mesure ${boite?.width ?? 0} px : rien à regarder, la capture ne prouve rien`);
  process.exit(1);
}
if (/[→›]/.test(dit)) {
  console.error(`❌ le bouton porte encore une flèche : « ${dit} »`);
  process.exit(1);
}
console.log(`✅ « ${dit} » — ${Math.round(boite.width)} × ${Math.round(boite.height)} px`);
console.log(`   Captures dans ${dossier}`);

await navigateur.close();
