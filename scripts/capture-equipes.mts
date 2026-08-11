// Capture de Réglages · « Vos équipes » — à une équipe, puis à trois.
//
// **Regarder l'écran fait partie du travail.** Sur ce lot de maquettes, tous
// les défauts réels se sont vus à l'œil et aucun aux contrôles.
//
// `localhost` et jamais `127.0.0.1` : Next refuse de servir ses ressources de
// développement à une origine qu'il juge étrangère, et la page arrive alors
// rendue par le serveur, JAMAIS hydratée — les boutons existent sans écouteur.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const dossier = process.argv[2];
if (!dossier) { console.error("usage: capture-equipes.mts <dossier>"); process.exit(1); }
mkdirSync(dossier, { recursive: true });

function navigateurPreInstalle(): string | undefined {
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  if (existsSync(`${racine}/chromium`)) return `${racine}/chromium`;
  const sous = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  return sous && existsSync(`${racine}/${sous}/chrome-linux/chrome`)
    ? `${racine}/${sous}/chrome-linux/chrome` : undefined;
}

const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
const contexte = await navigateur.newContext({
  ...devices["iPhone 13"], isMobile: true, hasTouch: true,
});
const page = await contexte.newPage();
const echecs: string[] = [];

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL("http://localhost:3000/", { timeout: 60000 });

await page.goto("http://localhost:3000/reglages", { waitUntil: "networkidle" });
await page.waitForSelector('button[aria-label="Une équipe de plus"]', { timeout: 60000 });

/** Ce que le navigateur seul peut dire. `checkVisibility` et non `display` :
 *  vingt lignes gardaient `display:flex` sous un parent caché, et le contrôle
 *  lisait vingt lettres sur un écran vide. */
const SONDE = `(() => {
  const vis = (e) => !!e && e.checkVisibility({opacityProperty:true, visibilityProperty:true});
  const champs = [...document.querySelectorAll('input[aria-label^="Nom de l\\'équipe"]')].filter(vis);
  const moins = document.querySelector('button[aria-label="Une équipe de moins"]');
  const plus = document.querySelector('button[aria-label="Une équipe de plus"]');
  const bloc = [...document.querySelectorAll('p')].find((p) => p.textContent.trim().startsWith('Leurs noms'));
  return {
    compteur: document.body.innerText.match(/\\n(\\d+)\\n/)?.[1] ?? null,
    champsVisibles: champs.length,
    lettres: champs.map((c) => c.placeholder),
    tailleChamp: champs[0] ? getComputedStyle(champs[0]).fontSize : null,
    blocNomsVisible: vis(bloc),
    moinsInerte: moins?.disabled ?? null,
    plusInerte: plus?.disabled ?? null,
    phraseSeul: document.body.innerText.includes("le planning n'écrira aucune équipe"),
    quipeQuelquePart: /quipe/.test(document.body.innerText),
  };
})()`;

async function sonder(quoi: string) {
  const e = (await page.evaluate(SONDE)) as Record<string, unknown>;
  console.log(`  ${quoi} — ${JSON.stringify(e)}`);
  return e;
}

// ─── 1. Seul : rien à nommer ────────────────────────────────────────────────
let etat = await sonder("à une équipe");
await page.screenshot({ path: `${dossier}/equipes-1-seul.png` });
if (etat.champsVisibles !== 0) echecs.push(`à une équipe, ${etat.champsVisibles} champ(s) de nom sont proposés : le patron y écrirait un prénom qui n'apparaîtrait nulle part.`);
if (etat.blocNomsVisible !== false) echecs.push("le bloc « Leurs noms » reste visible à une seule équipe.");
if (etat.phraseSeul !== true) echecs.push("rien ne dit que le planning n'écrira aucune équipe.");
if (etat.moinsInerte !== true) echecs.push("le − reste actif à une équipe : la borne ne se voit pas avant d'être rencontrée.");

// ─── 2. Trois équipes ───────────────────────────────────────────────────────
for (let i = 0; i < 2; i++) {
  await page.click('button[aria-label="Une équipe de plus"]');
  await page.waitForTimeout(400);
}
await page.waitForTimeout(700);
etat = await sonder("à trois équipes");
if (etat.champsVisibles !== 3) echecs.push(`à trois équipes, ${etat.champsVisibles} champ(s) visibles au lieu de trois.`);
if (JSON.stringify(etat.lettres) !== JSON.stringify(["Équipe A", "Équipe B", "Équipe C"]))
  echecs.push(`les replis affichés sont ${JSON.stringify(etat.lettres)}.`);
if (etat.tailleChamp !== "17px") echecs.push(`le champ fait ${etat.tailleChamp} : sous 16 px, Safari zoome et l'écran saute sous le doigt.`);

// Nommer la deuxième seulement — l'une n'oblige pas l'autre.
const champB = page.locator('input[aria-label="Nom de l\'équipe B"]');
await champB.fill("Théo");
await champB.blur();
await page.waitForTimeout(900);
await page.screenshot({ path: `${dossier}/equipes-2-trois.png` });

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('input[aria-label="Nom de l\'équipe B"]', { timeout: 30000 });
const apres = (await page.evaluate(`(() => {
  const v = (l) => document.querySelector('input[aria-label="Nom de l\\'équipe ' + l + '"]')?.value ?? null;
  return { a: v('A'), b: v('B'), c: v('C') };
})()`)) as Record<string, string | null>;
console.log(`  après rechargement — ${JSON.stringify(apres)}`);
if (apres.b !== "Théo") echecs.push(`le nom écrit ne survit pas au rechargement (B = ${JSON.stringify(apres.b)}).`);
if (apres.a || apres.c) echecs.push("nommer une équipe en a rempli d'autres.");
await page.screenshot({ path: `${dossier}/equipes-3-nomme.png` });

// ─── 3. Retour à une seule : le bloc s'efface, le nom survit en base ────────
for (let i = 0; i < 2; i++) {
  await page.click('button[aria-label="Une équipe de moins"]');
  await page.waitForTimeout(400);
}
await page.waitForTimeout(700);
etat = await sonder("retour à une équipe");
await page.screenshot({ path: `${dossier}/equipes-4-retour.png` });
if (etat.champsVisibles !== 0) echecs.push("revenu à une équipe, les champs de nom sont encore proposés.");

await navigateur.close();
if (echecs.length) {
  console.log(`\n✗ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.log(`   — ${e}`);
  process.exit(1);
}
console.log(`\n✅ « Vos équipes » se tait quand il n'y a personne. Captures dans ${dossier}`);
