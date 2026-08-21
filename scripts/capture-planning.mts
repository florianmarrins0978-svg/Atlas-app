// Capture du planning refait — le mois, la fiche du jour, la feuille.
//
// **Sur ce lot, tous les défauts réels se sont vus à l'œil** : trois défauts de
// ce dépôt ont été trouvés en REGARDANT une capture, aucun par un test vert
// (`CLAUDE.md` §5). Ce script prend les images ET mesure ce que l'œil a fini par
// voir, pour que la prochaine fois il le voie avant.
//
// **Réécrit le 21 août 2026** avec le planning de la planche 84. La version
// d'avant visait `[data-atlas='creneau']` et `data-marque` — les lignes
// d'équipes et les cinq marques du calendrier, qui n'existent plus.
//
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page n'arrive alors jamais hydratée.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-planning.mts <dossier>");
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
const contexte = await navigateur.newContext({
  ...devices["iPhone 13"],
  isMobile: true,
  hasTouch: true,
});
const page = await contexte.newPage();
const echecs: string[] = [];

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL("http://localhost:3000/", { timeout: 60000 });

await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });
await page.waitForSelector("[data-atlas='grille-mois']", { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);

/**
 * Ce que l'écran montre vraiment.
 *
 * **`checkVisibility` et jamais `display` sur l'élément seul** : vingt lignes
 * gardaient `display:flex` sous un parent caché, et le contrôle restait vert
 * sur un écran vide.
 */
const SONDE = `(() => {
  const vis = (e) => !!e && e.checkVisibility({opacityProperty:true, visibilityProperty:true});
  const grille = document.querySelector("[data-atlas='grille-mois']");
  const cases = [...document.querySelectorAll("[data-atlas='grille-mois'] [data-jour]")];
  const carte = document.querySelector("[data-atlas='carte-jour']");
  const barres = [...document.querySelectorAll("[data-atlas='grille-mois'] [data-demi]")];
  return {
    grilleVisible: vis(grille),
    jours: cases.filter(vis).length,
    barres: barres.length,
    // **Une barre de zéro pixel ne montre rien** — un contrôle qui mesure zéro
    // ne mesure rien, et il est pire qu'absent : il rassure (CLAUDE.md §5).
    barresPlates: barres.filter((b) => b.getBoundingClientRect().height < 4).length,
    carteVisible: vis(carte),
    carteDit: carte ? carte.innerText.replace(/\\s+/g, " ").trim().slice(0, 160) : null,
    noms: [...document.querySelectorAll("[data-atlas='nom-du-jour']")].map((e) => e.innerText.trim()),
    comptesJour: document.querySelectorAll("[data-atlas='compte-jour']").length,
    equipeEcriteQuelquePart: [...document.querySelectorAll("p,span,button")]
      .some((e) => e.children.length === 0 && /quipe/i.test(e.textContent ?? "")),
    // Rien ne doit déborder sur la largeur de son téléphone.
    debordement: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  };
})()`;

type Etat = {
  grilleVisible: boolean;
  jours: number;
  barres: number;
  barresPlates: number;
  carteVisible: boolean;
  carteDit: string | null;
  noms: string[];
  comptesJour: number;
  equipeEcriteQuelquePart: boolean;
  debordement: number;
};

async function sonder(quoi: string): Promise<Etat> {
  const etat = (await page.evaluate(SONDE)) as Etat;
  console.log(`  ${quoi} — ${JSON.stringify(etat)}`);
  return etat;
}

// ─── 1. Le mois ─────────────────────────────────────────────────────────────
let etat = await sonder("le mois");
await page.screenshot({ path: `${dossier}/planning-1-mois.png` });
if (!etat.grilleVisible) echecs.push("le calendrier du mois ne s'affiche pas.");
if (etat.jours < 28) echecs.push(`le mois ne montre que ${etat.jours} jours.`);
if (etat.barres !== etat.jours * 2) {
  echecs.push(`${etat.barres} barres pour ${etat.jours} jours : il en faut deux par jour.`);
}
if (etat.barresPlates > 0) {
  echecs.push(`${etat.barresPlates} barre(s) écrasée(s) à moins de quatre pixels : elles ne montrent rien.`);
}
if (etat.debordement > 0) {
  echecs.push(`l'écran déborde de ${etat.debordement} px sur la largeur de son téléphone.`);
}

// **La règle du patron, et elle n'est pas cosmétique** : à une seule équipe, le
// planning n'écrit AUCUN nom d'équipe — pas même dans une phrase d'explication.
// *« S'il n'a pas d'équipe et qu'il ne met rien, il ne faut pas qu'il y ait
// quand même écrit équipe A équipe B. »* (10 août 2026)
const combienDEquipes = (await page.evaluate(`(() => {
  return document.querySelectorAll("[data-atlas='equipe']").length;
})()`)) as number;
console.log(`  pastilles d'équipe visibles — ${combienDEquipes}`);

// ─── 2. Une journée ouvrable ────────────────────────────────────────────────
const jourOuvrable = (await page.evaluate(`(() => {
  const cases = [...document.querySelectorAll("[data-atlas='grille-mois'] [data-jour]")];
  const ouvrable = cases.find((c) => {
    const j = c.getAttribute("data-jour");
    const d = new Date(j + "T12:00:00Z").getUTCDay();
    return d !== 0 && d !== 6;
  });
  return ouvrable?.getAttribute("data-jour") ?? null;
})()`)) as string | null;

if (!jourOuvrable) {
  echecs.push("aucun jour ouvrable dans le mois affiché.");
} else {
  await page.click(`[data-atlas='grille-mois'] [data-jour="${jourOuvrable}"]`);
  await page.waitForTimeout(900);
  etat = await sonder(`la fiche du ${jourOuvrable}`);
  await page.screenshot({ path: `${dossier}/planning-2-fiche-du-jour.png` });
  if (!etat.carteVisible) echecs.push("toucher un jour n'ouvre rien.");

  // **Le compte de la journée s'écrit UNE fois** — sa correction du 21 août :
  // *« "1 chantier" de l'aprem, supprime, c'est déjà écrit pour le matin »*.
  if (etat.comptesJour > 1) {
    echecs.push(`le compte de la journée est écrit ${etat.comptesJour} fois au lieu d'une.`);
  }

  // **Un chantier n'écrit son nom qu'une fois** — même message.
  const doublons = etat.noms.filter((n, i) => etat.noms.indexOf(n) !== i);
  if (doublons.length) {
    echecs.push(`un chantier écrit son nom deux fois : ${JSON.stringify(doublons)}`);
  }

  // **Aucun trait entre le matin et l'après-midi** — *« là on a l'impression
  // que c'est deux chantiers différents »*.
  const filets = (await page.evaluate(`(() => [...document.querySelectorAll(
    "[data-atlas='carte-jour'] [data-atlas='demi']"
  )].map((e) => parseFloat(getComputedStyle(e).borderTopWidth)))()`)) as number[];
  if (filets.some((f) => f > 0)) {
    echecs.push(`un trait sépare les demi-journées : ${JSON.stringify(filets)}`);
  }
}

// ─── 3. La feuille de chantier ──────────────────────────────────────────────
const unNom = await page.locator("[data-atlas='nom-du-jour']").first();
if (await unNom.count()) {
  await unNom.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dossier}/planning-3-feuille.png` });
  const feuille = await page.locator("[data-atlas='feuille']").count();
  if (feuille === 0) echecs.push("le nom du client n'ouvre pas la feuille de chantier.");
  // **L'adresse ne s'AFFICHE plus** — sa demande du 21 août — mais elle sert
  // toujours : Maps, Waze et « Copier » la lisent sans la montrer.
  const liens = (await page.evaluate(`(() => [...document.querySelectorAll(
    "[data-atlas='feuille'] a"
  )].map((a) => a.getAttribute("href")))()`)) as string[];
  if (!liens.some((h) => h?.startsWith("https://maps.apple.com/"))) {
    echecs.push(`la feuille ne porte pas Maps : ${JSON.stringify(liens)}`);
  }
  if (liens.some((h) => h?.includes("google.com/maps"))) {
    echecs.push("Google Maps est revenu dans la feuille : il en voulait deux, pas trois.");
  }
} else {
  console.log("  aucun chantier posé ce jour-là : la feuille n'est pas éprouvée.");
}

// ─── 4. Les planifiés, et la barre du bas ───────────────────────────────────
await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });
await page.waitForSelector("[data-atlas='grille-mois']", { timeout: 60000 });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await page.screenshot({ path: `${dossier}/planning-4-planifies.png` });

// **Rien ne doit être recouvert par la barre du bas.** Une pile de
// notifications qui poussait tout le contenu hors de l'écran est l'un des trois
// défauts de ce dépôt trouvés en regardant une capture.
const recouvert = (await page.evaluate(`(() => {
  const barre = document.querySelector(".atlas-nav-basse");
  if (!barre) return null;
  const b = barre.getBoundingClientRect();
  const gene = [...document.querySelectorAll("a,button")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.height > 0 && r.top < b.bottom && b.top < r.bottom && e !== barre && !barre.contains(e);
  });
  return gene.map((e) => (e.textContent ?? "").trim().slice(0, 30)).slice(0, 5);
})()`)) as string[] | null;
if (recouvert === null) echecs.push("aucune barre du bas sur le planning.");
else if (recouvert.length) {
  echecs.push(`la barre du bas recouvre : ${JSON.stringify(recouvert)}`);
}

await navigateur.close();
if (echecs.length) {
  console.log(`\n✗ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.log(`   — ${e}`);
  process.exit(1);
}
console.log(`\n✅ Le planning tient. Captures dans ${dossier}`);
