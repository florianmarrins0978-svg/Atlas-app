import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";

/**
 * **UNE ZONE LUE SUR LA PHOTO SE GLISSE AU DOIGT** — sa capture du 23 octobre
 * 2026 : *« j'arrive pas à les déplacer lorsque je reste appuyé dessus, il
 * faut que je puisse la déplacer ! »*
 *
 * Le dessin rangeait un objet tenu d'après la PREMIÈRE LETTRE de son
 * identifiant : « z » une zone, « a » un arbre, le reste des dalles. Les zones
 * lues sur la photo s'appellent « lu1 », « lu2 » : elles tombaient chez les
 * dalles, où rien ne porte ce nom, et ne bougeaient pas. Les zones posées à
 * la main (« z1 ») bougeaient, et c'est tout ce que la suite navigateur
 * éprouvait, faute de clé de vision pour lire une photo ici.
 *
 * Ce contrôle monte donc le seul composant, avec un plan lu, dans un vrai
 * navigateur, et le doigt y fait ce que le patron fait. Il éprouve aussi la
 * poignée de la feuille, qui la referme même quand une cote manque : c'est
 * précisément le cas où « Valider » refuse, et où il restait coincé.
 *
 *   npx tsx scripts/test-dessin-glisser-zone-lue.ts
 */

function navigateurPreInstalle(): string | undefined {
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  if (existsSync(`${racine}/chromium`)) return `${racine}/chromium`;
  const sous = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  return sous && existsSync(`${racine}/${sous}/chrome-linux/chrome`) ? `${racine}/${sous}/chrome-linux/chrome` : undefined;
}

// Le plan de sa capture : un terrain de 17,5 × 12,5, des tamariniers cotés,
// et un goutte-à-goutte dont la photo ne donne aucune cote.
const entree = `
import { createRoot } from "react-dom/client";
import DessinerLePlan from "@/app/paysage/arrosage/DessinerLePlan";
const depart = {
  dessin: {
    terrain: { L: 17.5, l: 12.5 },
    zones: [
      { type: "massif", nom: "Tammiers", L: 7.5, l: 2, x: 5, y: 2.25 },
      { type: "massif", nom: "GAG", L: 2, l: 2, x: 2, y: 8, aVerifier: { manque: ["L", "l"], deduites: [] } },
    ],
    maisons: [], dalles: [], nourrice: { x: 3, y: 12.5 }, piquage: null,
  },
  reserves: [],
  pointDEau: null,
};
createRoot(document.getElementById("racine")).render(
  <DessinerLePlan piquage="compteur" onPiquage={() => {}} onFaire={() => {}} enCours={false} depart={depart} />
);
`;

async function eprouver() {
  const paquet = await build({
    stdin: { contents: entree, loader: "tsx", resolveDir: process.cwd() },
    bundle: true,
    write: false,
    format: "esm",
    jsx: "automatic",
    tsconfig: "tsconfig.json",
    define: { "process.env.NODE_ENV": '"development"' },
    logLevel: "silent",
  });

  const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
  try {
    const page = await navigateur.newPage({ viewport: { width: 430, height: 900 } });
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    await page.setContent(`<!doctype html><html><body style="margin:0"><div id="racine"></div></body></html>`);
    await page.addScriptTag({ content: paquet.outputFiles[0].text, type: "module" });
    const toile = page.locator('[data-atlas="toile"]');
    await toile.waitFor();
    assert.deepEqual(erreurs, [], "le dessin ne se monte pas");

    /** Où la zone est posée sur le plan, en mètres : le rectangle qui porte son nom. */
    const placeDe = (id: string) =>
      page.locator(`[data-objet="${id}"] rect`).first().evaluate((r) => ({ x: Number(r.getAttribute("x")), y: Number(r.getAttribute("y")) }));
    /** Le centre de l'écran d'un point du plan, en mètres. */
    const aLEcran = (x: number, y: number) =>
      toile.evaluate((s, p) => {
        const c = (s as SVGSVGElement).getScreenCTM()!;
        return { x: c.a * p.x + c.c * p.y + c.e, y: c.b * p.x + c.d * p.y + c.f };
      }, { x, y });

    const avant = await placeDe("lu1");
    assert.ok(Number.isFinite(avant.x) && Number.isFinite(avant.y), "la zone lue « Tammiers » n'est pas dessinée");

    // Il appuie au milieu de la zone, attend, puis glisse de 3 m vers la droite et 4 m vers le bas.
    const prise = await aLEcran(avant.x + 1, avant.y + 1);
    const lacher = await aLEcran(avant.x + 4, avant.y + 5);
    await page.mouse.move(prise.x, prise.y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.move(lacher.x, lacher.y, { steps: 12 });
    await page.mouse.up();

    const apres = await placeDe("lu1");
    assert.ok(
      Math.abs(apres.x - avant.x - 3) < 0.6 && Math.abs(apres.y - avant.y - 4) < 0.6,
      `la zone lue n'a pas suivi le doigt : de (${avant.x} ; ${avant.y}) à (${apres.x} ; ${apres.y}), attendu environ (${avant.x + 3} ; ${avant.y + 4})`,
    );
    assert.equal(await page.locator('[data-atlas="feuille-dessin"]').count(), 0, "un glissement ne doit pas ouvrir la feuille");
    console.log(`✓ une zone lue sur la photo suit le doigt : de (${avant.x} ; ${avant.y}) à (${apres.x} ; ${apres.y})`);

    // Un simple toucher sur « GAG », dont la photo ne donne aucune cote, ouvre sa feuille.
    const gag = await placeDe("lu2");
    const touche = await aLEcran(gag.x + 0.5, gag.y + 0.5);
    await page.mouse.click(touche.x, touche.y);
    const feuille = page.locator('[data-atlas="feuille-dessin"]');
    await feuille.waitFor();

    // Toucher le fond tente de valider, et les cotes manquent : la feuille reste.
    await page.mouse.click(215, 10);
    assert.equal(await feuille.count(), 1, "sans cotes, toucher le fond ne doit rien valider");

    // La poignée, elle, la referme sans rien changer.
    const poignee = page.getByRole("button", { name: "Refermer" });
    assert.equal(await poignee.count(), 1, "la feuille n'a pas de poignée « Refermer » en haut");
    await poignee.click();
    assert.equal(await feuille.count(), 0, "la poignée ne referme pas la feuille");
    assert.deepEqual(await placeDe("lu2"), gag, "refermer par la poignée ne doit pas changer la zone");

    // Et la poignée se tire vers le bas, comme toute feuille de téléphone.
    await page.mouse.click(touche.x, touche.y);
    await feuille.waitFor();
    const b = (await poignee.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 120, { steps: 8 });
    await page.mouse.up();
    assert.equal(await feuille.count(), 0, "tirer la poignée vers le bas ne referme pas la feuille");
    console.log("✓ la poignée referme la feuille, touchée ou tirée, même quand une cote manque");

    assert.deepEqual(erreurs, [], `erreurs dans la page : ${erreurs.join(" | ")}`);
  } finally {
    await navigateur.close();
  }
}

eprouver().catch((e) => {
  console.error(e);
  process.exit(1);
});
