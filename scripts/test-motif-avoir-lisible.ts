import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { chromium, type Page } from "playwright";
import { cheminDuNavigateur } from "./_navigateur.mjs";

/**
 * **LE MOTIF D'UN AVOIR SE RELIT EN ENTIER** — les notes de sa planche de la
 * facture, 2 novembre 2026 (`appli/soignee/facture.html`, « L'avoir ») :
 * *« Défaut corrigé : un motif long était coupé à gauche dans sa case. »*
 *
 * La case était un `<input>` : une seule ligne, et le début du texte glissait
 * sous le bord gauche à mesure qu'il écrivait. Il validait donc un motif dont
 * il ne voyait plus que la fin, sur un document que la loi fige une fois émis.
 *
 * Ce contrôle monte le seul choix du motif (`ChoixDuMotif`), avec la vraie
 * feuille de style compilée depuis `globals.css`, dans un vrai navigateur à la
 * largeur de son téléphone, et le doigt y fait ce que le patron fait : il
 * touche « Un autre motif », écrit une phrase longue, puis revient au geste
 * commercial. Ce qu'il mesure : aucun caractère caché, ni à gauche ni en bas.
 * **Il a été vu rouge** contre la case d'avant, rendue de la même façon : la
 * largeur du texte y dépassait celle de la case.
 *
 *   npx tsx scripts/test-motif-avoir-lisible.ts
 */

const RACINE = path.join(__dirname, "..");

// Le motif de sa planche, rallongé comme il l'écrirait sur un chantier.
const MOTIF_LONG =
  "Bordures posées sur 20 ml au lieu de 24, la dernière portion le long du portail reste à faire au printemps";

const entree = `
import { useState } from "react";
import { createRoot } from "react-dom/client";
import ChoixDuMotif from "@/app/chantiers/[id]/facture/avoir/ChoixDuMotif";
import { motifDeLAvoir } from "@/lib/avoir";
function Banc() {
  const [choix, setChoix] = useState("geste");
  const [ecrit, setEcrit] = useState("");
  return (
    <div style={{ padding: "0 22px" }}>
      <ChoixDuMotif choix={choix} ecrit={ecrit} onChoix={setChoix} onEcrit={setEcrit} />
      <output data-motif-qui-part>{motifDeLAvoir(choix, ecrit)}</output>
    </div>
  );
}
createRoot(document.getElementById("racine")).render(<Banc />);
`;

/** Tailwind compilé depuis la feuille de l'application, sur les classes posées à l'écran : la vraie mise en page. */
async function feuilleDeStyle(page: Page): Promise<string> {
  const source = readFileSync(path.join(RACINE, "src/app/globals.css"), "utf8");
  const compilateur = await compile(source, { base: path.join(RACINE, "src/app"), onDependency: () => undefined });
  const classes = await page.evaluate(() =>
    [...document.querySelectorAll("[class]")].flatMap((e) => (e.getAttribute("class") ?? "").split(/\s+/).filter(Boolean))
  );
  return compilateur.build([...new Set(classes)]);
}

/** Ce que la case cache de ce qu'il a écrit, en pixels : à droite ou à gauche, puis en bas. */
function cache(page: Page) {
  return page.locator('[data-atlas="avoir-motif"]').evaluate((e) => ({
    largeur: e.scrollWidth - e.clientWidth,
    hauteur: e.scrollHeight - e.clientHeight,
    boite: e.clientWidth,
    haut: e.clientHeight,
  }));
}

async function eprouver() {
  const paquet = await build({
    stdin: { contents: entree, loader: "tsx", resolveDir: RACINE },
    bundle: true,
    write: false,
    format: "esm",
    jsx: "automatic",
    tsconfig: path.join(RACINE, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"development"' },
    logLevel: "silent",
  });

  const navigateur = await chromium.launch({ executablePath: cheminDuNavigateur() });
  try {
    const page = await navigateur.newPage({ viewport: { width: 390, height: 664 } });
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    await page.setContent(`<!doctype html><html lang="fr"><body style="margin:0"><div id="racine"></div></body></html>`);
    await page.addScriptTag({ content: paquet.outputFiles[0].text, type: "module" });
    const quiPart = page.locator("[data-motif-qui-part]");
    await quiPart.waitFor({ state: "attached" });
    assert.deepEqual(erreurs, [], "le choix du motif ne se monte pas");

    // Au départ, le geste commercial est pris et rien n'est à écrire.
    assert.equal(await page.locator('[data-atlas="avoir-motif-geste"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('[data-atlas="avoir-motif"]').count(), 0, "la case est ouverte alors que le geste commercial est pris");
    assert.equal(await quiPart.textContent(), "Geste commercial");

    // « Un autre motif » ouvre la case, prête à écrire.
    await page.click('[data-atlas="avoir-motif-autre"]');
    const caseMotif = page.locator('[data-atlas="avoir-motif"]');
    await caseMotif.waitFor();
    assert.equal(await caseMotif.evaluate((e) => e === document.activeElement), true, "la case ne prend pas la main : il faudrait la toucher une seconde fois");
    await page.addStyleTag({ content: await feuilleDeStyle(page) });

    const vide = await cache(page);
    assert.ok(vide.boite > 200, `la case mesure ${vide.boite} px de large : la feuille de style n'est pas appliquée, la mesure ne prouverait rien`);

    await caseMotif.fill(MOTIF_LONG);
    const plein = await cache(page);
    assert.equal(await quiPart.textContent(), MOTIF_LONG, "le motif écrit n'est pas celui qui part");
    assert.ok(plein.largeur <= 0, `le motif déborde de ${plein.largeur} px sur le côté : son début se cache sous le bord`);
    assert.ok(plein.hauteur <= 1, `le motif déborde de ${plein.hauteur} px en bas : sa fin se cache`);
    assert.ok(plein.haut > vide.haut, `la case n'a pas grandi (${vide.haut} px vide, ${plein.haut} px pleine) : un motif de trois lignes s'y lirait par morceaux`);
    console.log(`✓ un motif de ${MOTIF_LONG.length} caractères se lit en entier : ${plein.haut} px de haut, rien de caché`);

    // Il efface : la case redescend, elle ne garde pas la hauteur d'avant.
    await caseMotif.fill("Bordures");
    const court = await cache(page);
    assert.ok(court.haut < plein.haut, `la case reste haute de ${court.haut} px pour un seul mot`);
    console.log("✓ la case redescend quand il efface");

    // Revenir au geste commercial envoie le mot d'avant la planche, et la
    // phrase écrite attend s'il change encore d'avis.
    await page.click('[data-atlas="avoir-motif-geste"]');
    assert.equal(await quiPart.textContent(), "Geste commercial");
    assert.equal(await page.locator('[data-atlas="avoir-motif"]').count(), 0);
    await page.click('[data-atlas="avoir-motif-autre"]');
    assert.equal(await page.locator('[data-atlas="avoir-motif"]').inputValue(), "Bordures");
    console.log("✓ « Geste commercial » envoie « Geste commercial », et ce qu'il avait écrit l'attend");
    assert.deepEqual(erreurs, []);
  } finally {
    await navigateur.close();
  }
}

eprouver().then(
  () => {
    console.log("\n✅ Le motif de l'avoir se relit en entier.");
    process.exit(0);
  },
  (e) => {
    console.error(`\n❌ ${(e as Error).message}`);
    process.exit(1);
  }
);
