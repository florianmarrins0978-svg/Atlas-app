// ═══════════════════════════════════════════════════════════════════════════
// REGARDER UN ÉCRAN — une commande, n'importe quel écran
// ═══════════════════════════════════════════════════════════════════════════
//
// **Sa colère du 14 septembre 2026 :** *« ça arrive trop souvent que tu me
// donnes une info fausse parce que t'es pas vraiment allé regarder les écrans
// de l'appli ! »*
//
// Il avait raison, et le même jour : j'avais affirmé que la porte du devis
// avait disparu du planning. Elle était là. Mon `grep` cherchait
// `data-atlas="porte-devis"` en toutes lettres, alors que le repère se compose
// — `porte-${porte.cle}`. J'ai conclu d'une recherche vide, pas d'un écran.
//
// ─── LA RACINE, ET ELLE N'EST PAS LA PARESSE ───────────────────────────────
//
// Ce dépôt porte QUATRE-VINGTS scripts `capture-*.mts`, un par écran, écrits
// au coup par coup. Regarder un écran demandait donc d'en écrire un
// quatre-vingt-unième : soixante lignes, un navigateur, une connexion, une
// attente. Grep coûte cinq secondes. **C'est l'écart entre les deux qui
// fabrique les affirmations fausses**, pas la bonne volonté de la session.
//
// D'où cette commande. Elle rend une IMAGE et le TEXTE de n'importe quel écran,
// derrière la connexion, sans rien écrire :
//
//     npm run voir -- /planning
//     npm run voir -- /chantiers/<id>/devis-complet --large
//     npm run voir -- /reglages --dossier /tmp/mes-captures
//
// **Elle ne remplace pas les captures existantes** : celles-là mesurent (une
// largeur, un débordement, un ordre) et restent dans la batterie. Celle-ci sert
// à VOIR avant d'affirmer — c'est un autre métier.
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const args = process.argv.slice(2);
const chemin = args.find((a) => a.startsWith("/"));
if (!chemin) {
  console.error(`usage: npm run voir -- <chemin de l'écran> [--large] [--dossier <où>]

  npm run voir -- /planning
  npm run voir -- /reglages --large

Le serveur doit tourner (npm run dev). L'image et le texte sortent dans
/tmp/atlas-vu par défaut.`);
  process.exit(1);
}

const large = args.includes("--large");
// **`indexOf` rend -1 quand l'option est absente, et `args[0]` est alors pris
// pour un dossier.** La première capture a atterri dans « /planning/ » — un
// dossier créé à la racine du disque. Trouvé en jouant la commande.
const rangDossier = args.indexOf("--dossier");
const dossier = rangDossier >= 0 && args[rangDossier + 1] ? args[rangDossier + 1] : "/tmp/atlas-vu";
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page n'arrive alors jamais hydratée.
//
// **Et l'attente est `domcontentloaded`, jamais `networkidle`.** Sur le banc,
// l'écran interroge `/api/health/banc/etat` sans fin : le réseau n'est donc
// JAMAIS au repos, et `networkidle` finit en délai dépassé — la commande
// annonçait alors « le serveur ne répond pas » sur un serveur qui répondait.
// Trouvé en jouant cette commande, pas en la relisant.
const BASE = process.env.ATLAS_ADRESSE ?? "http://localhost:3000";
mkdirSync(dossier, { recursive: true });

function navigateurPreInstalle(): string | undefined {
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  if (existsSync(`${racine}/chromium`)) return `${racine}/chromium`;
  const sous = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  return sous && existsSync(`${racine}/${sous}/chrome-linux/chrome`)
    ? `${racine}/${sous}/chrome-linux/chrome`
    : undefined;
}

const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
const contexte = await navigateur.newContext({ ...devices["iPhone 13"], isMobile: true, hasTouch: true });
const page = await contexte.newPage();

// **Ce que le serveur écrit est rendu, lui aussi.** Un écran qui tombe le dit
// dans son journal, pas à l'image : sans cette ligne on regarde une page
// d'erreur sans savoir ce qu'elle cache.
const pannes: string[] = [];
page.on("pageerror", (e) => pannes.push(`page : ${e.message.split("\n")[0]}`));
page.on("response", (r) => {
  if (r.status() >= 500) pannes.push(`${r.status()} sur ${new URL(r.url()).pathname}`);
});

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
} catch {
  console.error(`Le serveur ne répond pas sur ${BASE}. Lancez « npm run dev » d'abord.`);
  await navigateur.close();
  process.exit(1);
}

// La connexion, puis les deux murs qui interceptent tout écran : l'acceptation
// des documents et l'écran de bienvenue. Les franchir fait partie du geste du
// patron — s'arrêter là revient à photographier une porte.
if (page.url().includes("/login")) {
  await page.fill('input[name="email"], input[type="email"]', process.env.ATLAS_EMAIL ?? "demo@atlas.local");
  await page.fill('input[name="password"], input[type="password"]', process.env.ATLAS_MDP_DEMO ?? "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
}
for (let essai = 0; essai < 3 && /documents-legaux|bienvenue/.test(page.url()); essai++) {
  const cases = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await cases.count()); i++) await cases.nth(i).check().catch(() => {});
  await page.getByRole("button", { name: /continuer|j'accepte|commencer/i }).click().catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
}

await page.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
// **On attend que l'écran soit POSÉ.** Mesurer ou lire trop tôt rend des zéros
// et des « CHARGEMENT… » — et un zéro n'est pas une mesure (`CLAUDE.md` §5).
await page
  .waitForFunction(() => !document.body.innerText.includes("CHARGEMENT"), null, { timeout: 20_000 })
  .catch(() => {});
await page.waitForTimeout(700);

const nom = chemin.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "accueil";
const image = path.join(dossier, `${nom}.png`);
await page.screenshot({ path: image, fullPage: large });

const texte = (await page.locator("body").innerText()).replace(/\n{3,}/g, "\n\n");
console.log(`── ${chemin} ── ${page.url()}\n`);
console.log(texte.slice(0, 1800));
if (pannes.length > 0) console.log(`\n⚠ le serveur a signalé : ${[...new Set(pannes)].join(" · ")}`);
console.log(`\nImage : ${image}${large ? " (écran entier)" : ""}`);

await navigateur.close();
