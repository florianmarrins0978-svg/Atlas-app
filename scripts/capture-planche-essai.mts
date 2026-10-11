// La planche de l'essai, regardée état par état AVANT de lui donner l'adresse.
//
//   npx tsx scripts/capture-planche-essai.mts <dossier>
//
// **Pourquoi une capture d'une MAQUETTE, alors qu'on ne lui en envoie jamais**
// (`CLAUDE.md` §3 bis, 2 ter) : ce qu'on lui donne reste l'adresse. L'image,
// elle, sert à MOI — c'est ce qui attrape un libellé collé, un débordement à
// 390 px, un cadenas illisible en nuit. Six défauts réels de ce dépôt sont
// sortis d'une image et d'aucun test.
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dossier = process.argv[2];
mkdirSync(dossier, { recursive: true });

// `import.meta.dirname`, jamais `__dirname` : ce fichier est un module ES (le
// `await` de haut niveau l'impose), et mélanger les deux rend le format
// indécidable — Node refuse alors de démarrer, sans rapport avec la capture.
const FICHIER =
  "file://" + path.join(import.meta.dirname, "..", "appli", "l-essai-et-ce-qui-est-ferme.html").replace(/\\/g, "/");

const ETATS = ["j1", "j13", "j16", "geste", "absences", "retours", "nuit"];

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page: Page = await contexte.newPage();
await page.goto(FICHIER, { waitUntil: "networkidle" });

for (const vue of ETATS) {
  await page.click(`#onglets button[data-vue="${vue}"]`);
  await page.waitForTimeout(250);

  const mesure = await page.evaluate(() => {
    const corps = document.body;
    // **Refuser de conclure sur une page de zéro pixel** (`CLAUDE.md` §5) :
    // sans mise en page, tout paraîtrait tenir.
    if (corps.scrollHeight === 0) return { debordement: "MESURE IMPOSSIBLE", mots: 0 };
    const tel = document.getElementById("tel");
    const trop = tel ? tel.scrollWidth > tel.clientWidth : false;
    return {
      debordement: trop ? "DÉBORDE" : corps.scrollWidth > corps.clientWidth ? "PAGE DÉBORDE" : "aucun",
      mots: (tel?.innerText ?? "").split(/\s+/).filter(Boolean).length,
    };
  });

  console.log(`${vue.padEnd(10)} ${String(mesure.mots).padStart(3)} mots à l'écran · débordement : ${mesure.debordement}`);
  await page.screenshot({ path: `${dossier}/essai-${vue}.png`, fullPage: true });
}

await navigateur.close();
