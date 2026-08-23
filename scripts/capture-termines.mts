// Capture de « Terminés » — le mois qu'on feuillette, et les deux onglets.
//
// **Refait le 22 août 2026 avec l'écran** (planche 90, proposition B). La
// version d'avant mesurait le volet replié, la pastille dorée et l'absence de
// tout coin arrondi : trois choses que le patron a fait retirer. Une sonde qui
// réclame ce qui n'existe plus rend l'écran impossible à changer, et rougit sur
// du code juste (`CLAUDE.md` §5 bis).
//
// **Sur ce lot, tous les défauts réels se sont vus à l'œil** — « Facture n° -5 »
// n'a été trouvé par aucun contrôle. Ce script mesure ce que l'œil a fini par
// voir, et prend les captures qu'on regarde ensuite.
//
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de développement
// à une origine étrangère, et la page arrive alors JAMAIS hydratée.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium, devices } from "playwright";

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
  ...devices["iPhone 13"], isMobile: true, hasTouch: true,
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
 * **On mesure la mise en page, jamais la classe posée.** Une classe `font-bold`
 * ne prouve pas une graisse : c'est le style calculé qui décide, et c'est lui
 * que l'œil voit.
 */
const SONDE = `(() => {
  const corps = document.querySelector("[data-atlas='ecran-termines']");
  const lignes = [...document.querySelectorAll("[data-atlas='ligne-terminee']")];

  // Les montants d'une même colonne doivent finir au MÊME pixel. Les lignes en
  // attente portent une capsule à la place : elles ne sont pas de cette colonne.
  const montants = lignes.map((l) => {
    const m = l.querySelector(":scope > span:last-child");
    if (!m || /facturer/i.test(m.textContent)) return null;
    return { droite: Math.round(m.getBoundingClientRect().right),
             tabulaire: getComputedStyle(m).fontVariantNumeric.includes("tabular-nums") };
  }).filter(Boolean);

  const compte = corps ? corps.querySelector("[data-atlas='compte-du-mois']") : null;
  const styleCompte = compte ? getComputedStyle(compte) : null;

  const boite = (sel) => {
    const e = corps ? corps.querySelector(sel) : null;
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { h: Math.round(r.height), l: Math.round(r.width) };
  };

  return {
    lignes: lignes.length,
    // **Rien ne doit être replié** : ce qui reste à faire ne se cache plus.
    // Une ligne de zéro pixel de haut serait un pli qui n'ose pas dire son nom.
    lignesEcrasees: lignes.filter((l) => l.getBoundingClientRect().height < 20).length,
    mois: corps?.querySelector("[data-atlas='navigation-mois']")?.innerText.replace(/\\s+/g, " ").trim() ?? null,
    compte: compte ? compte.innerText.replace(/\\s+/g, " ").trim() : null,
    compteGras: styleCompte ? Number(styleCompte.fontWeight) : null,
    compteCouleur: styleCompte ? styleCompte.color : null,
    fleches: [...(corps ? corps.querySelectorAll("[data-atlas^='mois-']") : [])]
      .map((b) => ({ quoi: b.dataset.atlas, h: Math.round(b.getBoundingClientRect().height),
                     ferme: b.disabled })),
    // La capsule « Facturer », visée par son texte : le dernier \`span\` d'une
    // ligne facturée est le MONTANT, et le mesurer ne prouvait rien.
    capsuleFacturer: (() => {
      const c = [...(corps ? corps.querySelectorAll("[data-atlas='ligne-terminee'] span") : [])]
        .find((e) => e.children.length === 0 && e.textContent.trim() === "Facturer");
      return c ? Math.round(c.getBoundingClientRect().height) : null;
    })(),
    montantsDroite: [...new Set(montants.map((m) => m.droite))],
    montantsTabulaires: montants.every((m) => m.tabulaire),
    // **Aucun code graphique de l'ancien écran ne doit survivre.**
    restesAnciens: ["pastille", "encart-a-facturer", "volet-a-facturer", "nom-du-mois"]
      .filter((n) => document.querySelector("[data-atlas='" + n + "']")),
    debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
})()`;

async function sonder(quoi: string) {
  const e = (await page.evaluate(SONDE)) as Record<string, unknown>;
  console.log(`  ${quoi} — ${JSON.stringify(e)}`);
  return e;
}

// ─── 1. Au repos : le mois le plus récent, tout déplié ──────────────────────
let etat = await sonder("au repos");
await page.screenshot({ path: `${dossier}/termines-1-mois.png`, fullPage: true });

if (etat.debordement) echecs.push("la page déborde latéralement.");
if ((etat.restesAnciens as string[]).length > 0)
  echecs.push(`l'ancien écran survit quelque part : ${JSON.stringify(etat.restesAnciens)}`);
if ((etat.lignes as number) === 0)
  echecs.push("aucune ligne à l'écran : la sonde ne mesure rien, elle ne prouve donc rien.");
if ((etat.lignesEcrasees as number) > 0)
  echecs.push(`${etat.lignesEcrasees} ligne(s) de moins de 20 px : quelque chose est encore replié.`);

// **Le compte, en noir gras** — sa demande du 22 août 2026.
if (etat.compte === null) echecs.push("le compte des factures a disparu de l'écran.");
else {
  if ((etat.compteGras as number) < 700)
    echecs.push(`le compte est en graisse ${etat.compteGras} : il le veut GRAS.`);
  if (etat.compteCouleur !== "rgb(28, 28, 26)")
    echecs.push(`le compte est en ${etat.compteCouleur} : il le veut NOIR.`);
}

// **Les flèches se touchent avec un pouce, et celle du futur est fermée.**
const fleches = etat.fleches as { quoi: string; h: number; ferme: boolean }[];
if (fleches.length !== 2) echecs.push(`${fleches.length} flèche(s) de mois au lieu de deux.`);
for (const f of fleches) {
  if (f.h < 44) echecs.push(`la flèche « ${f.quoi} » fait ${f.h} px : sous 44, on la rate.`);
}
// **Une flèche ouverte doit MENER quelque part, et se fermer au bout.** On ne
// peut pas exiger qu'elle soit fermée au repos : un chantier clôturé en avance
// porte une date à venir, l'écran s'ouvre alors sur le mois courant et il y a
// bien un mois plus loin à aller voir.
{
  let tours = 0;
  while (tours < 6 && !(await page.locator("[data-atlas='mois-suivant']").first().isDisabled())) {
    const avant = await page.locator("[data-atlas='navigation-mois']").first().innerText();
    await page.locator("[data-atlas='mois-suivant']").first().click();
    await page.waitForTimeout(300);
    const apres = await page.locator("[data-atlas='navigation-mois']").first().innerText();
    if (avant === apres) { echecs.push("la flèche › est ouverte et ne change pas de mois."); break; }
    tours++;
  }
  if (tours >= 6) echecs.push("la flèche › ne se ferme jamais : le feuilletage part vers l'infini.");
  // Et on revient d'où l'on venait, pour que la suite mesure ce qu'elle croit.
  for (let i = 0; i < tours; i++) {
    await page.locator("[data-atlas='mois-precedent']").first().click();
    await page.waitForTimeout(200);
  }
}

// **Les montants d'une même colonne finissent au même pixel.**
if (etat.capsuleFacturer !== null && (etat.capsuleFacturer as number) < 44)
  echecs.push(`la capsule « Facturer » fait ${etat.capsuleFacturer} px : sous 44, on la rate.`);

const droites = etat.montantsDroite as number[];
if (droites.length > 1)
  echecs.push(`les montants finissent à ${droites.length} abscisses : ${JSON.stringify(droites)}`);
if ((etat.montantsTabulaires as boolean) !== true)
  echecs.push("les montants ne sont pas en chiffres tabulaires : l'œil recompte à chaque ligne.");

// ─── 2. Revenir dans le passé ───────────────────────────────────────────────
const moisAvant = String(etat.mois ?? "");
await page.locator("[data-atlas='mois-precedent']").first().click();
await page.waitForTimeout(400);
etat = await sonder("un mois en arrière");
await page.screenshot({ path: `${dossier}/termines-2-mois-precedent.png`, fullPage: true });

if (String(etat.mois ?? "") === moisAvant)
  echecs.push(`la flèche ‹ n'a rien changé : toujours « ${moisAvant} ».`);
if (fleches.length === 2 &&
    (etat.fleches as { quoi: string; ferme: boolean }[]).find((f) => f.quoi === "mois-suivant")?.ferme === true)
  echecs.push("la flèche du futur reste fermée après avoir reculé : on ne peut plus revenir.");
// Un mois sans rien DIT qu'il n'a rien — il ne se saute pas, et il ne se tait pas.
if ((etat.lignes as number) === 0 && !/Rien en /i.test(await page.locator("[data-atlas='ecran-termines']").innerText()))
  echecs.push("un mois vide ne dit pas qu'il est vide.");

// ─── 3. L'onglet « À facturer » ─────────────────────────────────────────────
const ongletAttente = page.getByRole("button", { name: "À facturer" });
if ((await ongletAttente.count()) === 0) {
  echecs.push("l'onglet « À facturer » n'existe pas.");
} else {
  const hauteurOnglet = Math.round((await ongletAttente.boundingBox())?.height ?? 0);
  if (hauteurOnglet < 40) echecs.push(`l'onglet fait ${hauteurOnglet} px de haut : trop petit pour un pouce.`);
  await ongletAttente.click();
  await page.waitForTimeout(400);
  etat = await sonder("onglet « À facturer »");
  await page.screenshot({ path: `${dossier}/termines-3-a-facturer.png`, fullPage: true });

  // **Il ne se feuillette PAS** : il montre tout ce qui attend, tous mois
  // confondus. C'est ce que le patron a demandé pour le retard de facturation.
  if ((etat.fleches as unknown[]).length !== 0)
    echecs.push("l'onglet « À facturer » porte des flèches de mois : il ne doit pas se feuilleter.");
  const texte = await page.locator("[data-atlas='ecran-termines']").innerText();
  if ((etat.lignes as number) === 0 && !/Rien n['’]attend/i.test(texte))
    echecs.push("rien n'attend, et l'écran ne le dit pas — il a l'air amputé plutôt que calme.");
  if ((etat.lignes as number) > 0 && !/Pas encore facturé/i.test(texte))
    echecs.push("une ligne en attente ne dit pas son état en toutes lettres.");
}

await navigateur.close();
if (echecs.length) {
  console.log(`\n✗ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.log(`   — ${e}`);
  process.exit(1);
}
console.log(`\n✅ « Terminés » se feuillette et se lit. Captures dans ${dossier}`);
