// La mention qui ouvre l'écran du chantier, PHOTOGRAPHIÉE sur l'application.
//
// **Pourquoi une photo, et pas seulement des suites vertes.** Cinq défauts de ce
// dépôt sont sortis d'une image et d'aucun test — le dernier, « 1 jours après
// l'échéance », le 16 août. Les trois suites de ce lot disent que la règle est
// juste, que la base tient et que le doigt trouve la cible ; aucune ne dit à
// quoi la ligne ressemble une fois qu'elle porte un trait pointillé rouge, ni
// si les 34 px qu'on lui a donnés déforment la liste.
//
// Trois images : la ligne avant, l'écran d'arrivée, la ligne après.
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-coordonnees-depuis-accueil.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";
const echecs: string[] = [];

const navigateur = await lancerNavigateur();
const page = await (await navigateur.newContext({ ...devices["iPhone 13"] })).newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

// Le chantier de sa capture : créé sans rien: ni client, ni adresse.
await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
const idChantier = await creerPuisFiche(page);
await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
const chantierId = idChantier;

// La mention n'est pas une ancre : une ligne de l'accueil est UN SEUL `<a>`, et
// la mention vit dedans en détournant le geste. Son `data-href` dit où elle mène.
const mention = page.locator(
  `[data-atlas="lieu-manquant"][data-href="/chantiers/${chantierId}/coordonnees"]`
);

/**
 * Amène la ligne dans le cadre qui défile, puis photographie l'écran.
 *
 * **Les cartes et la liste vivent dans un cadre qui défile tout seul**
 * (`.atlas-fil-defile`). Une capture `fullPage` en photographierait le milieu,
 * sans la ligne — c'est ce qui est arrivé le 16 août, et le contrôle était vert
 * parce qu'il lisait le DOM au lieu de regarder l'image.
 */
async function photographier(cible: string, fichier: string) {
  const place = await page.evaluate((sel) => {
    const cadre = document.querySelector<HTMLElement>(".atlas-fil-defile");
    // **On vise l'ÉLÉMENT, jamais le cadre.** La première version passait
    // `.atlas-fil-defile` en cible pour l'image d'après : le cadre étant son
    // propre point de repère, le calcul valait zéro et la photo montrait le
    // HAUT du fil — les cartes, pas la ligne corrigée. Une capture qui cadre
    // autre chose que ce qu'elle annonce ne prouve rien.
    const el = document.querySelector<HTMLElement>(sel);
    if (!cadre || !el || el === cadre) return false;
    cadre.scrollTop += el.getBoundingClientRect().top - cadre.getBoundingClientRect().top - 90;
    return true;
  }, cible);
  if (!place) {
    echecs.push(`« ${cible} » introuvable : ${fichier} ne montrerait rien`);
    return;
  }
  await page.waitForTimeout(450);
  const vue = await page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { haut: Math.round(r.top), bas: Math.round(r.bottom), hauteur: Math.round(r.height), ecran: window.innerHeight };
  }, cible);
  // Une boîte de zéro pixel n'est pas « visible » : c'est une mesure
  // impossible, et la compter pour vraie rendrait ce contrôle inutile.
  if (!vue || vue.hauteur < 10) {
    echecs.push(`« ${cible} » mesure ${vue?.hauteur ?? 0} px : rien à photographier`);
  } else if (vue.haut < 0 || vue.bas > vue.ecran) {
    echecs.push(`« ${cible} » déborde du cadre (${vue.haut} → ${vue.bas} pour ${vue.ecran} px)`);
  }
  await page.screenshot({ path: `${dossier}/${fichier}` });
}

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
if ((await mention.count()) === 0) echecs.push("aucune mention cliquable à l'accueil : l'image ne montrerait rien");
await photographier('[data-atlas="lieu-manquant"]', "1-la-mention.png");

// L'écran d'arrivée — le sien, rouvert.
await page.goto(`${BASE}/chantiers/${chantierId}/coordonnees`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const arrivee = await page.locator("body").innerText();
if (!/Nom du client/i.test(arrivee)) echecs.push("l'écran d'arrivée n'est pas celui de la création");
if (/\bNOUVEAU\b/.test(arrivee)) echecs.push("l'écran dit encore « Nouveau » : l'image montrerait le défaut");
await page.screenshot({ path: `${dossier}/2-ecran-du-chantier.png` });

// Rempli, puis enregistré : c'est ce qu'il verra en revenant.
await page.locator('input[placeholder="Bernard"]').fill("Martins");
await page.locator('input[placeholder="06 12 34 56 78"]').fill("0679984514");
await page.locator('input[placeholder="12 rue des Lilas, Nantes"]').fill("10 rue des Lilas, Nantes");
await page.waitForTimeout(300);
await page.screenshot({ path: `${dossier}/3-rempli.png` });

await page.getByRole("button", { name: /Enregistrer/ }).click();
await page.waitForURL(new RegExp(`/chantiers/${chantierId}$`), { timeout: 30_000 });

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if ((await mention.count()) !== 0) echecs.push("la mention est restée : l'image d'après montrerait le défaut");
const apres = await page.locator("body").innerText();
if (!/10 rue des Lilas/.test(apres)) echecs.push("l'adresse saisie n'est pas sous le nom du chantier");
if (!/Mr\. Martins|Martins/.test(apres)) echecs.push("le nom du chantier n'a pas suivi");
// La ligne corrigée porte désormais le nom du client : c'est elle qu'on cadre,
// et le repère la désigne sans ambiguïté parmi les cinq autres.
await page.evaluate((id) => {
  const lien = document.querySelector(`a.atlas-brin[href="/chantiers/${id}"]`);
  lien?.setAttribute("data-photo", "ligne-corrigee");
}, chantierId);
await photographier('[data-photo="ligne-corrigee"]', "4-la-ligne-apres.png");

await navigateur.close();
await pool.end();

if (echecs.length > 0) {
  console.error("❌ Les images ne montrent pas la scène annoncée :");
  for (const e of echecs) console.error(`   · ${e}`);
  process.exit(1);
}
console.log(`✅ Quatre images dans ${dossier}`);
