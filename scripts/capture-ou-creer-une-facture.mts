// Les quatre places, regardées une par une AVANT de lui donner l'adresse.
//
//   npx tsx scripts/capture-ou-creer-une-facture.mts <dossier>
//
// **Pourquoi une capture d'une MAQUETTE, alors qu'on ne lui en envoie jamais**
// (`CLAUDE.md` §3 bis, 2 ter) : ce qu'on lui donne reste l'adresse. L'image,
// elle, sert à MOI — c'est ce qui attrape un libellé collé, un débordement à
// 390 px, un mot illisible en nuit. Six défauts réels de ce dépôt sont sortis
// d'une image et d'aucun test.
//
// **Et la place 4 doit VRAIMENT déborder.** Elle n'est dessinée que pour lui
// montrer l'impossible : si la rangée se repliait sagement, la planche
// démontrerait le contraire de ce qu'elle affirme. La mesure ci-dessous le
// vérifie plutôt que de l'espérer.
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dossier = process.argv[2] ?? ".";
mkdirSync(dossier, { recursive: true });

const FICHIER =
  "file://" +
  path.join(import.meta.dirname, "..", "appli", "ou-creer-une-facture.html").replace(/\\/g, "/");

const PLACES = ["accueil", "sous-titre", "a-facturer", "pastille"] as const;

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page: Page = await contexte.newPage();
await page.goto(FICHIER, { waitUntil: "networkidle" });

async function poser(place: string) {
  await page.click(`[data-place="${place}"]`);
  // On attend la mise en page, jamais le seul rendu : une mesure prise avant
  // que la feuille de style s'applique rend des zéros, et « 0 − 0 = 0 » passe
  // pour un succès (`CLAUDE.md` §5).
  await page.waitForLoadState("networkidle");
  await page.locator("#tel").scrollIntoViewIfNeeded();
}

for (const place of PLACES) {
  await poser(place);
  await page.locator("#tel").screenshot({ path: path.join(dossier, `place-${place}.png`) });
}

// ── La rangée d'onglets, mesurée aux deux largeurs qui comptent ────────────
//
// 360 est le plancher que ce dépôt tient (`ARCHITECTURE.md` §125) ; 390 est son
// téléphone. La planche affirme un débordement : on le mesure.
for (const large of [360, 390]) {
  await page.setViewportSize({ width: large, height: 844 });

  await poser("sous-titre");
  const trois = await page.evaluate(() => {
    const r = document.querySelector<HTMLElement>(".onglets");
    if (!r) return null;
    return { largeur: r.scrollWidth, visible: r.clientWidth };
  });

  await poser("pastille");
  const quatre = await page.evaluate(() => {
    const r = document.querySelector<HTMLElement>(".onglets");
    if (!r) return null;
    return { largeur: r.scrollWidth, visible: r.clientWidth };
  });

  if (!trois || !quatre || trois.largeur === 0) {
    throw new Error(`Rien à mesurer à ${large} px : la rangée fait zéro, la mesure est impossible.`);
  }

  const verdict = quatre.largeur > quatre.visible ? "DÉBORDE (c'est ce qu'on veut montrer)" : "tient — la planche ment";
  console.log(
    `${large} px · trois pastilles : ${trois.largeur} px pour ${trois.visible} dispo` +
      ` · quatre : ${quatre.largeur} px → ${verdict}`
  );
}

// Le pôle sombre : deux chartes sur sept inversent l'accent et le fond, et
// c'est là qu'un mot devient illisible sans qu'aucun test ne le voie.
await page.setViewportSize({ width: 390, height: 844 });
await page.click("#pole");
await poser("sous-titre");
await page.locator("#tel").screenshot({ path: path.join(dossier, "place-sous-titre-nuit.png") });

await contexte.close();
await navigateur.close();
console.log(`\nQuatre places + la nuit : ${dossier}`);
