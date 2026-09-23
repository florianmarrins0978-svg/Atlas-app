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
    mois: corps?.querySelector("[data-atlas='periode-choisie']")?.innerText.replace(/\\s+/g, " ").trim() ?? null,
    compte: compte ? compte.innerText.replace(/\\s+/g, " ").trim() : null,
    compteGras: styleCompte ? Number(styleCompte.fontWeight) : null,
    compteCouleur: styleCompte ? styleCompte.color : null,
    // Les trois mots de la date — le filtre du 23 septembre 2026 (§409). Les
    // flèches « ‹ › » sont parties avec : un contrôle qui réclame ce qu'il a
    // fait retirer rend l'écran impossible à changer (CLAUDE.md §5 bis).
    mots: [...(corps ? corps.querySelectorAll("[data-atlas^='portee-']") : [])]
      .map((b) => ({ quoi: b.dataset.atlas, h: Math.round(b.getBoundingClientRect().height),
                     ferme: b.disabled, actif: b.getAttribute("aria-pressed") === "true" })),
    // La capsule à facturer, visée par son REPÈRE et non par son texte : elle
    // s'appelait « Facturer » jusqu'au 31 août 2026, et ce contrôle-là rougissait
    // alors sur du code juste, pour un mot que le patron a fait changer
    // (\`CLAUDE.md\` §5 bis). Le dernier \`span\` d'une ligne facturée, lui, est le
    // MONTANT : le mesurer ne prouvait rien.
    capsuleFacturer: (() => {
      const c = corps ? corps.querySelector("[data-atlas='capsule-a-facturer']") : null;
      return c ? Math.round(c.getBoundingClientRect().height) : null;
    })(),
    // Chaque rangée en attente porte SA capsule. Compter les deux permet de dire
    // « une rangée attend sans rien qui le dise », ce que la présence d'une
    // phrase quelque part dans l'écran ne prouvait pas.
    capsules: corps ? corps.querySelectorAll("[data-atlas='capsule-a-facturer']").length : 0,
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

// **Les trois mots se touchent avec un pouce, et UN SEUL commande.**
const mots = etat.mots as { quoi: string; h: number; ferme: boolean; actif: boolean }[];
if (mots.length !== 3) echecs.push(`${mots.length} mot(s) de date au lieu de trois.`);
for (const m of mots) {
  if (m.h < 44) echecs.push(`le mot « ${m.quoi} » fait ${m.h} px : sous 44, on le rate.`);
}
{
  const actifs = mots.filter((m) => m.actif).length;
  if (actifs !== 1) echecs.push(`${actifs} mot(s) soulignés : on ne sait plus ce que la liste montre.`);
}
// **ÉLARGIR MONTRE PLUS, JAMAIS MOINS.** Le mois est contenu dans son année :
// toucher « 2026 » ne peut pas retirer des lignes. C'est la seule chose qu'on
// puisse affirmer sans connaître le jeu de données de la machine qui mesure.
{
  const avant = etat.lignes as number;
  const titreAvant = String(etat.mois ?? "");
  await page.locator("[data-atlas='portee-annee']").first().click();
  await page.waitForTimeout(350);
  const apres = await sonder("l'année entière");
  await page.screenshot({ path: `${dossier}/termines-1b-annee.png`, fullPage: true });
  if ((apres.lignes as number) < avant)
    echecs.push(`l'année montre ${apres.lignes} ligne(s) là où son mois en montrait ${avant}.`);
  // **Ce qui change, c'est le mot SOULIGNÉ, pas le texte du titre** : il porte
  // toujours la date entière, c'est tout le principe de la proposition B
  // retenue le 23 septembre 2026. Un contrôle qui attendait un autre libellé
  // visait le dessin d'avant.
  const souligne = (e: Record<string, unknown>) =>
    (e.mots as { quoi: string; actif: boolean }[]).find((m) => m.actif)?.quoi ?? "aucun";
  if (souligne(apres) !== "portee-annee")
    echecs.push(`l'année est touchée et c'est « ${souligne(apres)} » qui reste souligné.`);
  if (String(apres.mois ?? "") !== titreAvant)
    echecs.push("le titre a changé de texte en élargissant : il doit garder la date entière.");
  await page.locator("[data-atlas='portee-mois']").first().click();
  await page.waitForTimeout(350);
  etat = await sonder("retour au mois");
}

// **Les montants d'une même colonne finissent au même pixel.**
if (etat.capsuleFacturer !== null && (etat.capsuleFacturer as number) < 44)
  echecs.push(`la capsule « À facturer » fait ${etat.capsuleFacturer} px : sous 44, on la rate.`);

const droites = etat.montantsDroite as number[];
if (droites.length > 1)
  echecs.push(`les montants finissent à ${droites.length} abscisses : ${JSON.stringify(droites)}`);
if ((etat.montantsTabulaires as boolean) !== true)
  echecs.push("les montants ne sont pas en chiffres tabulaires : l'œil recompte à chaque ligne.");

// ─── 2. Revenir dans le passé ───────────────────────────────────────────────
const moisAvant = String(etat.mois ?? "");
// **On recule par la ROUE** — c'est le geste qui reste depuis que les flèches
// sont parties : on se pose sur un jour du mois d'avant, puis on touche le mois.
const moisPrecedent = (cle: string) => {
  const [a, m] = cle.split("-").map(Number);
  return m === 1 ? `${a - 1}-12-15` : `${a}-${String(m - 1).padStart(2, "0")}-15`;
};
const cleActuelle = await page.locator("[data-atlas='periode-choisie'] input[type=date]").first().inputValue();
await page.locator("[data-atlas='periode-choisie'] input[type=date]").first().fill(moisPrecedent(cleActuelle.slice(0, 7)));
await page.waitForTimeout(400);
await page.locator("[data-atlas='portee-mois']").first().click();
await page.waitForTimeout(400);
etat = await sonder("un mois en arrière");
await page.screenshot({ path: `${dossier}/termines-2-mois-precedent.png`, fullPage: true });

if (String(etat.mois ?? "") === moisAvant)
  echecs.push(`la roue n'a rien changé : toujours « ${moisAvant} ».`);
// Une période sans rien DIT qu'elle n'a rien — elle ne se saute pas, et elle ne
// se tait pas. « Rien en septembre 2026 », « Rien le 11 mars 2026 ».
if ((etat.lignes as number) === 0 && !/Rien (en|le) /i.test(await page.locator("[data-atlas='ecran-termines']").innerText()))
  echecs.push("une période vide ne dit pas qu'elle est vide.");

// ─── 3. L'œil — l'ancien onglet « À facturer », depuis le 13 septembre 2026 ──
// Il n'existe que s'il y a quelque chose à montrer : sans rien qui attend, la
// phrase ne porte ni le compte ni l'œil, et c'est voulu.
const oeil = page.locator("[data-atlas='oeil-a-facturer']");
if ((await oeil.count()) === 0) {
  console.log("  (rien n'attend : l'œil n'a rien à montrer, il n'est pas rendu)");
} else {
  const boite = await oeil.boundingBox();
  if (!boite || boite.height < 44 || boite.width < 44)
    echecs.push(`l'œil fait ${boite?.width} × ${boite?.height} px : trop petit pour un pouce.`);
  await oeil.click();
  await page.waitForTimeout(400);
  etat = await sonder("œil ouvert");
  await page.screenshot({ path: `${dossier}/termines-3-a-facturer.png`, fullPage: true });

  // **Le mois se met en veille** : l'œil ouvert montre tout ce qui attend, tous
  // mois confondus — ce que le patron a demandé pour le retard de facturation —,
  // et des mots qui règleraient une liste immobile feraient croire l'écran
  // cassé.
  const fermees = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>("[data-atlas^='portee-']")].every((b) => b.disabled)
  );
  if (!fermees) echecs.push("l'œil est ouvert et les mots de la date restent ouverts : la liste ignore la période.");
  if ((etat.lignes as number) === 0)
    echecs.push("l'œil est ouvert sur rien : il n'aurait pas dû être rendu.");
  // **Ce que porte une rangée en attente, c'est sa CAPSULE.** Ce contrôle
  // exigeait « Pas encore facturé » quelque part dans l'écran — un texte que le
  // patron a fait retirer le 31 août 2026, et qui prouvait de toute façon peu :
  // une seule occurrence suffisait pour dix rangées muettes.
  if ((etat.lignes as number) > 0 && (etat.capsules as number) !== (etat.lignes as number))
    echecs.push(
      `${etat.lignes} rangée(s) en attente pour ${etat.capsules} capsule(s) « À facturer » : ` +
        `une rangée attend sans que rien ne le dise.`
    );
}

await navigateur.close();
if (echecs.length) {
  console.log(`\n✗ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.log(`   — ${e}`);
  process.exit(1);
}
console.log(`\n✅ « Terminés » se feuillette et se lit. Captures dans ${dossier}`);
