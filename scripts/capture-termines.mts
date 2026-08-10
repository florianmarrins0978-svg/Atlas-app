// Capture de « Terminés » — le fil, l'encart replié, l'encart ouvert.
//
// **Sur ce lot de maquettes, tous les défauts réels se sont vus à l'œil.** Ce
// script mesure ce que l'œil a fini par voir.
//
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page arrive alors JAMAIS hydratée.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium } from "playwright";

const dossier = process.argv[2];
if (!dossier) { console.error("usage: capture-termines.mts <dossier>"); process.exit(1); }
mkdirSync(dossier, { recursive: true });

function pre(): string | undefined {
  const r = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!r || !existsSync(r)) return undefined;
  if (existsSync(`${r}/chromium`)) return `${r}/chromium`;
  const s = readdirSync(r).find((d) => /^chromium-\d+$/.test(d));
  return s && existsSync(`${r}/${s}/chrome-linux/chrome`) ? `${r}/${s}/chrome-linux/chrome` : undefined;
}

const navigateur = await chromium.launch({ executablePath: pre() });
const contexte = await navigateur.newContext({
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
});
const page = await contexte.newPage();
const echecs: string[] = [];

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL("http://localhost:3000/", { timeout: 60000 });

await page.goto("http://localhost:3000/termines", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

/**
 * **`checkVisibility` IGNORE LE ROGNAGE** : les lignes d'un tiroir fermé lui
 * paraissent visibles. On mesure donc l'INTERSECTION RÉELLE avec la boîte du
 * volet — c'est la seule chose que l'œil, lui, voit.
 */
const SONDE = `(() => {
  const volet = document.querySelector("[data-atlas='volet-a-facturer']");
  const boiteVolet = volet ? volet.getBoundingClientRect() : null;
  const lignes = [...document.querySelectorAll("[data-atlas='ligne-terminee']")];
  const dansLeVolet = (e) => {
    if (!boiteVolet) return false;
    const r = e.getBoundingClientRect();
    return r.bottom > boiteVolet.top && r.top < boiteVolet.bottom && r.height > 1;
  };
  // Les montants : la colonne doit finir au MÊME pixel.
  const montants = lignes.map((l) => {
    const m = l.querySelector("a > span:last-child");
    return m ? { droite: Math.round(m.getBoundingClientRect().right), texte: m.textContent.trim(),
                 tabulaire: getComputedStyle(m).fontVariantNumeric.includes("tabular-nums") } : null;
  }).filter(Boolean);
  // Aucun fond plein ni coin arrondi dans le CORPS de l'écran.
  // Le corps de l'écran, et lui seul. Interroger le document entier ramenait
  // le bandeau du bas et la bulle de l'assistant : le contrôle accusait
  // « Terminés » de pavés qui ne lui appartiennent pas.
  const corps = document.querySelector("[data-atlas='ecran-termines']");
  const fautifs = [...(corps ? corps.querySelectorAll("div,section,a,p,span,button") : [])].filter((e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) return false;          // perles, pastilles, chevrons
    const s = getComputedStyle(e);
    const fond = s.backgroundColor;
    const plein = fond !== "rgba(0, 0, 0, 0)" && fond !== "transparent";
    const rond = parseFloat(s.borderTopLeftRadius) > 8;
    return plein || rond;
  }).map((e) => (e.tagName + "." + (e.className || "").toString().slice(0, 40)).trim());
  return {
    lignes: lignes.length,
    lignesDansLeVolet: lignes.filter(dansLeVolet).length,
    encart: document.querySelector("[data-atlas='encart-a-facturer']")?.innerText.replace(/\\s+/g, " ").trim() ?? null,
    hauteurEncart: document.querySelector("[data-atlas='encart-a-facturer']")
      ? Math.round(document.querySelector("[data-atlas='encart-a-facturer']").getBoundingClientRect().height) : null,
    hauteurVolet: boiteVolet ? Math.round(boiteVolet.height) : null,
    montantsDroite: [...new Set(montants.map((m) => m.droite))],
    montantsTabulaires: montants.every((m) => m.tabulaire),
    aFacturerEcrit: /à facturer/i.test(document.body.innerText),
    // La pastille ne doit mordre sur AUCUN nom de mois : son fond est opaque,
    // et elle mangeait la dernière lettre de « juillet ».
    pastilleMord: (() => {
      const mois = [...(corps ? corps.querySelectorAll("[data-atlas='nom-du-mois']") : [])];
      return mois.some((m) => {
        const pastille = m.parentElement.querySelector("[data-atlas='pastille']");
        if (!pastille) return false;
        const p = document.createRange(); p.selectNodeContents(m);
        const t = p.getBoundingClientRect(), b = pastille.getBoundingClientRect();
        return t.right > b.left + 1 && t.left < b.right;
      });
    })(),
    // Un montant nul ne doit pas s'écrire quand il est seulement INCONNU.
    encartAZero: [...document.querySelectorAll("[data-atlas='encart-a-facturer']")]
      .map((e) => e.innerText.replace(/\s+/g, " ").trim())
      .filter((t) => /0,00/.test(t)),
    fautifs: [...new Set(fautifs)].slice(0, 6),
    debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
})()`;

async function sonder(quoi: string) {
  const e = (await page.evaluate(SONDE)) as Record<string, unknown>;
  console.log(`  ${quoi} — ${JSON.stringify(e)}`);
  return e;
}

// ─── 1. Au repos : l'encart appelle, il n'occupe pas ────────────────────────
let etat = await sonder("au repos");
await page.screenshot({ path: `${dossier}/termines-1-repos.png`, fullPage: true });
if (etat.debordement) echecs.push("la page déborde latéralement.");
if ((etat.fautifs as string[]).length > 0)
  echecs.push(`le corps porte un fond plein ou un coin arrondi : ${JSON.stringify(etat.fautifs)}`);
if (etat.pastilleMord === true)
  echecs.push("la pastille passe par-dessus le nom du mois et lui mange une lettre.");
if ((etat.encartAZero as string[]).length > 0)
  echecs.push(`un encart annonce un montant nul là où il est inconnu : ${JSON.stringify(etat.encartAZero)}`);
if (etat.hauteurEncart !== null && (etat.hauteurEncart as number) < 40)
  echecs.push(`l'encart fait ${etat.hauteurEncart} px : sous 44, on le rate deux fois sur trois.`);
if (etat.lignesDansLeVolet !== 0 && etat.hauteurVolet === 0)
  echecs.push("le volet est fermé mais ses lignes comptent comme visibles : le contrôle ment.");

/** Le trait du bandeau tombe-t-il sous l'onglet ACTIF ? On mesure le TEXTE. */
const trait = (await page.evaluate(`(() => {
  const nav = document.querySelector(".atlas-nav-basse");
  const actif = [...nav.querySelectorAll("a")].find((a) => a.getAttribute("aria-current") === "page");
  const barre = nav.querySelector("span[aria-hidden] > span") ?? nav.querySelector("span[aria-hidden]");
  if (!actif || !barre) return null;
  const p = document.createRange(); p.selectNodeContents(actif);
  const t = p.getBoundingClientRect(), b = barre.getBoundingClientRect();
  return { onglet: actif.textContent.trim(), ecart: Math.round(Math.abs((t.x + t.width/2) - (b.x + b.width/2))) };
})()`)) as { onglet: string; ecart: number } | null;
console.log(`  le trait du bandeau — ${JSON.stringify(trait)}`);
if (!trait || trait.onglet !== "Terminés") echecs.push(`l'onglet allumé est « ${trait?.onglet} » et non « Terminés ».`);
else if (trait.ecart > 24) echecs.push(`le trait tombe à ${trait.ecart} px du centre de « Terminés ».`);

// ─── 2. L'encart ouvert ─────────────────────────────────────────────────────
const aEncart = (await page.locator("[data-atlas='encart-a-facturer']").count()) > 0;
if (aEncart) {
  const libelle = String(etat.encart ?? "");
  if (/\b0\b/.test(libelle.split("·")[0] ?? "")) echecs.push(`l'encart écrit un chiffre : « ${libelle} »`);
  await page.locator("[data-atlas='encart-a-facturer']").first().click();
  await page.waitForTimeout(800);
  etat = await sonder("encart ouvert");
  await page.screenshot({ path: `${dossier}/termines-2-ouvert.png`, fullPage: true });

  // **Le compte annoncé égale le nombre de lignes montrées.**
  const annonce = libelle.match(/^(\S+)/)?.[1] ?? "";
  const MOTS: Record<string, number> = { Un: 1, Deux: 2, Trois: 3, Quatre: 4, Cinq: 5, Six: 6, Sept: 7, Huit: 8, Neuf: 9, Dix: 10 };
  const attendu = MOTS[annonce];
  if (attendu && etat.lignesDansLeVolet !== attendu)
    echecs.push(`l'encart annonce « ${annonce} » et montre ${etat.lignesDansLeVolet} ligne(s).`);

  // **Les montants d'une même colonne finissent au même pixel.**
  const droites = etat.montantsDroite as number[];
  if (droites.length > 1) echecs.push(`les montants finissent à ${droites.length} abscisses différentes : ${JSON.stringify(droites)}`);
  if (etat.montantsTabulaires !== true) echecs.push("les montants ne sont pas en chiffres tabulaires : l'œil recompte à chaque ligne.");
  if ((etat.fautifs as string[]).length > 0)
    echecs.push(`l'encart ouvert révèle un fond plein ou un coin arrondi : ${JSON.stringify(etat.fautifs)}`);
} else {
  // **À zéro, la chaîne « à facturer » n'apparaît nulle part.**
  if (etat.aFacturerEcrit === true) echecs.push("aucun chantier n'attend, et pourtant l'écran écrit « à facturer ».");
  console.log("  (aucun chantier en attente : l'encart n'existe pas, et c'est la règle)");
}

await navigateur.close();
if (echecs.length) {
  console.log(`\n✗ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.log(`   — ${e}`);
  process.exit(1);
}
console.log(`\n✅ « Terminés » tient son fil. Captures dans ${dossier}`);
