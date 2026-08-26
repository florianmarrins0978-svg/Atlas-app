// Capture de Réglages → Équipe → « Qui a accès » : la liste, le rôle déplié,
// et le formulaire qui donne un accès.
//
// **Regarder l'écran fait partie du travail** (`CLAUDE.md` §5). Quatre défauts
// réels de ce dépôt ont été trouvés sur une image et par aucun test vert — dont
// une barre du bas dont les colonnes restaient figées à cinq. Cet écran-ci en
// change deux : le nombre d'onglets pour un salarié, et une liste dépliable.
//
// **Elle SONDE autant qu'elle photographie**, et refuse de conclure sur une
// boîte de zéro pixel : une mesure impossible n'est pas un succès
// (`CLAUDE.md` §5, « un contrôle qui mesure ZÉRO ne mesure rien »).
//
// `localhost` et jamais `127.0.0.1` : Next refuse de servir ses ressources à une
// origine qu'il juge étrangère, et la page arrive alors rendue mais JAMAIS
// hydratée — les boutons existent sans écouteur.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-qui-a-acces.mts <dossier>");
  process.exit(1);
}
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
const echecs: string[] = [];

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL("http://localhost:3000/", { timeout: 60000 });

// `networkidle` et non `domcontentloaded` : sans la mise en page appliquée, les
// largeurs mesurées plus bas valent toutes zéro, et « rien n'est coupé » serait
// un vert qui ne prouve rien (le défaut du 15 août 2026).
await page.goto("http://localhost:3000/reglages/equipe", { waitUntil: "networkidle" });
await page.waitForSelector("text=Qui a accès", { timeout: 60000 });

async function photographier(nom: string) {
  await page.screenshot({ path: `${dossier}/${nom}.png`, fullPage: true });
  console.log(`  → ${dossier}/${nom}.png`);
}

await photographier("1-qui-a-acces");

// ─── Ce que le navigateur seul peut dire ────────────────────────────────────
const etat = (await page.evaluate(`(() => {
  const vis = (e) => !!e && e.checkVisibility({opacityProperty:true, visibilityProperty:true});
  const nav = document.querySelector('nav[aria-label="Navigation principale"]');
  const grille = nav ? nav.querySelector('.grid') : null;
  const onglets = nav ? [...nav.querySelectorAll('a')].map((a) => a.textContent.trim()) : [];
  const lignes = [...document.querySelectorAll('button[aria-expanded]')];
  const donner = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Donner un accès'));
  return {
    onglets,
    colonnes: grille ? getComputedStyle(grille).gridTemplateColumns.split(' ').length : null,
    personnes: lignes.length,
    largeurDeLaPremiere: lignes[0] ? Math.round(lignes[0].getBoundingClientRect().width) : 0,
    donnerVisible: vis(donner),
    deuxListes:
      document.body.innerText.includes('Qui a accès') && document.body.innerText.includes('Vos équipes'),
  };
})()`)) as Record<string, unknown>;

console.log(`  état — ${JSON.stringify(etat)}`);

if (!etat.largeurDeLaPremiere) {
  echecs.push("la première ligne mesure 0 px — la mise en page n'était pas appliquée, rien n'a été mesuré");
}
if (etat.personnes === 0) echecs.push("aucune personne dans la liste : l'écran ne montre rien à regarder");
if (!etat.donnerVisible) echecs.push("« Donner un accès » n'est pas visible");
if (!etat.deuxListes) echecs.push("les deux listes ne cohabitent pas : « Qui a accès » et « Vos équipes »");
if (etat.colonnes !== 5) echecs.push(`le patron devrait voir 5 onglets, la grille en a ${etat.colonnes}`);

// ─── Le rôle déplié ─────────────────────────────────────────────────────────
await page.click('button[aria-expanded]');
await page.waitForSelector('button[aria-pressed="true"]', { timeout: 15000 });
await photographier("2-le-role-deplie");

const deplie = (await page.evaluate(`(() => {
  const boutons = [...document.querySelectorAll('button[aria-pressed]')].map((b) => b.textContent.trim());
  return { boutons, texte: document.body.innerText.includes('Patron') };
})()`)) as { boutons: string[]; texte: boolean };
console.log(`  déplié — ${JSON.stringify(deplie)}`);
for (const attendu of ["Patron", "Commercial", "Salarié"]) {
  if (!deplie.boutons.includes(attendu)) echecs.push(`le rôle « ${attendu} » n'est pas proposé`);
}

// ─── Donner un accès ────────────────────────────────────────────────────────
await page.click('button[aria-expanded]');
await page.click("text=Donner un accès");
await page.waitForSelector('input[placeholder="Nom"]', { timeout: 15000 });
await photographier("3-donner-un-acces");

const champs = (await page.evaluate(`
  [...document.querySelectorAll('form input')].map((i) => ({
    place: i.placeholder, type: i.type, large: Math.round(i.getBoundingClientRect().width),
  }))
`)) as { place: string; type: string; large: number }[];
console.log(`  champs — ${JSON.stringify(champs)}`);
if (champs.length !== 3) echecs.push(`le formulaire devrait avoir 3 champs, il en a ${champs.length}`);
if (champs.some((c) => c.large === 0)) echecs.push("un champ mesure 0 px de large");
if (!champs.some((c) => c.type === "password")) echecs.push("le mot de passe n'est pas masqué à la saisie");

await navigateur.close();

console.log("");
if (echecs.length) {
  for (const e of echecs) console.error(`  ✗ ${e}`);
  console.error(`« Qui a accès » — ${echecs.length} défaut(s) vu(s) à l'écran.`);
  process.exit(1);
}
console.log("« Qui a accès » — rien à signaler à l'écran.");
