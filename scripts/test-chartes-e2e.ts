import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

// Les sept chartes de couleurs, à l'écran — rubrique « Apparence ».
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE RÈGLE PURE NE PEUT DIRE :**
//
//   · **choisir une charte REPEINT l'application**, pas seulement l'écran des
//     réglages. C'est tout l'enjeu : un choix qui s'écrirait en base sans rien
//     changer serait l'interrupteur mort que le patron a interdit — « on le
//     touche, rien ne bouge, et on croit à une panne » ;
//   · **la barre du bas suit, elle aussi.** Elle porte une classe Tailwind et
//     non un style en ligne : le premier jet l'avait laissée blanche sous un
//     écran passé au noir, et cela ne s'est vu que sur une capture ;
//   · **par défaut, RIEN NE BOUGE.** Sans choix, l'accueil garde exactement les
//     couleurs d'avant ce lot. C'est la promesse du lot entier.
//
// La suite repart de la charte d'origine quoi qu'il arrive : le compte de
// démonstration sert aux quatre-vingts suites de la batterie, et le laisser en
// « Nuit » ferait juger toutes les suivantes sur des couleurs qu'elles
// n'attendent pas.

const BASE = "http://localhost:3000";

let echecs = 0;
function verifie(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ✓ ${nom}`);
  } else {
    echecs++;
    console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Les couleurs réellement calculées par le navigateur, pas celles du code. */
async function couleurs(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Navigation principale"]');
    return {
      corps: getComputedStyle(document.body).backgroundColor,
      barre: nav ? getComputedStyle(nav).backgroundColor : "",
      // La bande qui porte `bg-paper` — une classe Tailwind, pas un style en
      // ligne. C'est elle qui était restée blanche.
      cadre: (() => {
        const d = document.querySelector("div.bg-paper");
        return d ? getComputedStyle(d).backgroundColor : "";
      })(),
    };
  });
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`);

    console.log("=== Les sept chartes de couleurs ===\n");

    // ── 1. Par défaut, l'application est celle d'avant ────────────────────
    const auDepart = await couleurs(page);
    verifie("sans choix, l'accueil garde la crème d'origine",
      auDepart.corps === "rgb(245, 243, 238)", auDepart.corps);

    // ── 2. L'écran propose les sept, et dit laquelle est prise ────────────
    await page.goto(`${BASE}/reglages/apparence`, { waitUntil: "networkidle" });
    const lignes = await page.locator("button[data-charte]").count();
    verifie("les sept chartes sont proposées", lignes === 7, `${lignes}`);

    const prise = await page.locator('button[data-charte][aria-pressed="true"]').getAttribute("data-charte");
    verifie("« Origine » est prise au départ", prise === "origine", String(prise));

    const texte = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    verifie("les deux chartes sombres sont annoncées comme telles",
      /Nuit/.test(texte) && /Sylve/.test(texte) && /Sombre/i.test(texte));

    // ── 3. LE CONTRÔLE QUI PORTE LE LOT : choisir repeint tout ────────────
    await page.locator('button[data-charte="nuit"]').click();
    await page.waitForTimeout(1_500);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const enNuit = await couleurs(page);

    verifie("choisie, « Nuit » assombrit l'accueil pour de bon",
      enNuit.corps === "rgb(16, 18, 16)", enNuit.corps);
    verifie("la barre du bas suit — elle ne reste pas claire",
      enNuit.barre === "rgb(16, 18, 16)", enNuit.barre);
    // Le défaut vu sur la capture : cette bande-là portait encore le crème.
    verifie("et le cadre en classe Tailwind suit lui aussi",
      enNuit.cadre === "rgb(16, 18, 16)", enNuit.cadre);

    // ── 4. Le choix TIENT d'une page à l'autre ────────────────────────────
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    const auPlanning = await couleurs(page);
    verifie("et il vaut sur les autres écrans, pas seulement l'accueil",
      auPlanning.corps === "rgb(16, 18, 16)", auPlanning.corps);

    // ── 5. On peut revenir, et l'application redevient celle d'avant ──────
    await page.goto(`${BASE}/reglages/apparence`, { waitUntil: "networkidle" });
    await page.locator('button[data-charte="origine"]').click();
    await page.waitForTimeout(1_500);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const revenu = await couleurs(page);
    verifie("revenu à « Origine », l'accueil est exactement celui du départ",
      revenu.corps === auDepart.corps && revenu.barre === auDepart.barre,
      `${revenu.corps} / ${revenu.barre}`);
  } finally {
    // **Rendu à l'origine quoi qu'il arrive.** Le compte de démonstration sert
    // aux quatre-vingts suites de la batterie : le laisser en « Nuit » les
    // ferait juger sur des couleurs qu'elles n'attendent pas, et l'échec
    // accuserait leur écran plutôt que cette suite-ci.
    try {
      await page.goto(`${BASE}/reglages/apparence`, { waitUntil: "networkidle" });
      await page.locator('button[data-charte="origine"]').click();
      await page.waitForTimeout(1_200);
    } catch {
      // Le navigateur est peut-être déjà tombé : on ne masque pas l'échec réel.
    }
    await navigateur.close();
  }

  console.log("");
  if (echecs) {
    console.log(`${echecs} ÉCHEC(S).`);
    process.exit(1);
  }
  console.log("Les chartes à l'écran — 0 échec(s).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
