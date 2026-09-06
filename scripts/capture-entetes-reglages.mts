// Les quatre écrans des Réglages qui se dessinaient leur propre en-tête.
//   npx tsx --env-file=.env scripts/capture-entetes-reglages.mts <dossier>
//
// **Pourquoi ce contrôle-là est une CAPTURE et pas une suite.** Ce que le lot
// répare ne se lit pas dans une assertion : c'est un titre de 32 px au milieu
// de treize titres de 36, un surtitre doré du mauvais côté du titre, et un
// bouton d'assistant absent. Une suite peut compter les pixels ; elle ne dit
// pas si l'écran a la même allure que celui d'à côté.
//
// Il mesure quand même les trois choses qui se chiffrent — la taille du titre,
// le nombre de lignes qu'il prend, la présence de l'assistant — parce qu'un
// oeil qui compare quatre écrans se trompe, et parce qu'un TITRE QUI SE CASSE
// EN DEUX est le risque connu de cette place (`test-assistant-en-tete-e2e.ts`).
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-entetes";
mkdirSync(dossier, { recursive: true });

/**
 * Chaque écran porte le TITRE qu'on doit y lire, et ce n'est pas décoratif.
 *
 * **Payé le 6 septembre 2026, au premier tour de ce script.** Le serveur qui
 * répondait n'avait pas la variable de l'éditeur : `/reglages/vocabulaire`
 * rendait donc la page « introuvable » de Next, dont le titre fait 24 px. Le
 * script a mesuré cette page-là et rapporté « titre 24 px · assistant NON »,
 * c'est-à-dire un verdict sur un écran qu'il n'avait jamais vu.
 *
 * Le contrôle de `status() >= 400` n'a rien vu : la navigation était déjà
 * faite côté client. Le titre attendu, lui, ne se trompe pas de page.
 */
const ECRANS = [
  ["agenda", "/reglages/agenda", "Mon agenda"],
  ["prix", "/reglages/prix", "Mes prix"],
  ["mesures", "/reglages/prix/mesures", "Mes mesures"],
  ["vocabulaire", "/reglages/vocabulaire", "Mon vocabulaire"],
  // Deux témoins : ils employaient déjà l'en-tête commune. Sans eux, on ne
  // saurait pas si les quatre autres ont rejoint la grammaire ou l'ont inventée.
  ["temoin-identite", "/reglages/identite", "Mon entreprise"],
  ["temoin-donnees", "/reglages/donnees", "Mes données"],
] as const;

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

/**
 * L'écran du vocabulaire n'existe que pour l'éditeur, et la serrure est une
 * VARIABLE D'ENVIRONNEMENT lue par le serveur — `ATLAS_EDITEUR_EMAIL` —, et
 * non une colonne en base. S'en remettre à la base l'aurait laissé introuvable
 * sans qu'on sache pourquoi. Il faut donc lancer le serveur ainsi :
 *
 *     ATLAS_EDITEUR_EMAIL=demo@atlas.local npm run dev
 */
const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 2,
});
const page = await contexte.newPage();
await connecter(page);

const lignes: string[] = [];

let manques = 0;

for (const [nom, adresse, titreAttendu] of ECRANS) {
  const reponse = await page.goto(`${BASE}${adresse}`, { waitUntil: "networkidle" });
  // La mise en page doit être posée avant de mesurer : une boîte de zéro pixel
  // n'est pas un succès, c'est une mesure impossible (`CLAUDE.md` §5).
  await page.waitForTimeout(500);

  const titreVu = (await page.locator("h1").first().textContent().catch(() => null))?.trim() ?? null;
  if (titreVu !== titreAttendu) {
    manques++;
    lignes.push(
      `${nom.padEnd(17)} ÉCRAN NON ATTEINT — lu « ${titreVu ?? "rien"} » au lieu de ` +
        `« ${titreAttendu} »${reponse ? ` (HTTP ${reponse.status()})` : ""}. Rien n'est mesuré.`
    );
    await page.screenshot({ path: path.join(dossier, `entete-${nom}-NON-ATTEINT.png`) });
    continue;
  }

  const m = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    if (!h1) return null;
    const style = getComputedStyle(h1);
    const boite = h1.getBoundingClientRect();
    const hauteurLigne = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    return {
      corps: Math.round(parseFloat(style.fontSize)),
      lignes: Math.max(1, Math.round(boite.height / hauteurLigne)),
      assistant: !!document.querySelector('[data-atlas="bouton-assistant"], header button[aria-label*="ssistant"]'),
      // Le surtitre doré doit être SOUS le titre (sa demande du 26 août 2026).
      dore: (() => {
        const p = [...document.querySelectorAll("header p")].find((e) =>
          getComputedStyle(e).textTransform === "uppercase"
        );
        return p ? Math.round(p.getBoundingClientRect().top - boite.top) : null;
      })(),
    };
  });

  if (!m) {
    lignes.push(`${nom.padEnd(17)} aucun titre trouvé — mesure impossible`);
  } else {
    lignes.push(
      `${nom.padEnd(17)} titre ${m.corps} px · ${m.lignes} ligne(s) · ` +
        `assistant ${m.assistant ? "oui" : "NON"} · ` +
        `doré ${m.dore === null ? "absent" : m.dore > 0 ? "sous le titre" : "AU-DESSUS"}`
    );
  }

  await page.screenshot({ path: path.join(dossier, `entete-${nom}.png`) });
}

await navigateur.close();

const rapport = lignes.join("\n");
writeFileSync(path.join(dossier, "mesures.txt"), rapport + "\n");
console.log(rapport);
console.log(`\nCaptures dans ${dossier}`);

// **Un écran non atteint n'est pas un écran vert.** Rendre 0 ici laisserait
// croire que les six ont été regardés, alors qu'on n'en aurait vu que cinq —
// c'est exactement la faute que ce script vient de payer.
if (manques > 0) {
  console.error(`\n❌ ${manques} écran(s) non atteint(s) : la mesure ne vaut pas pour eux.`);
  process.exit(1);
}
