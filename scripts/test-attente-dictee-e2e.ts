import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
const BASE = "http://localhost:3000";

// **« On ne sait pas ce qui se passe. »**
//
// Le patron, le 13 août 2026, capture de l'écran « Un chantier » à l'appui :
// *« une fois qu'on a appuyé sur le dictaphone, on ne sait pas ce qui se passe.
// Les trois petits points sont fixes et on attend […] mais on ne sait pas si ça
// bug ou non. »*
//
// Ce n'était pas une animation arrêtée : c'était le caractère « … », un seul
// glyphe posé dans l'écran. Il n'y avait rien qui pût bouger.
//
// ─── Pourquoi cette suite RALENTIT le serveur ────────────────────────────────
//
// L'attente ne dure normalement qu'un instant, et un contrôle qui court plus
// vite qu'elle ne verrait jamais l'état qu'il prétend éprouver — il passerait au
// vert sans avoir rien regardé. La réponse est donc retenue trois secondes, ce
// qui est exactement la situation du patron : une chaîne qui prend son temps.
//
// Ce qu'elle tient, et chacun des trois est une moitié du correctif :
//
//   1. les points **SOUFFLENT** — mesuré sur leur taille réelle, dans le temps,
//      pas sur la présence d'une classe. Une classe posée sur un élément dont
//      plus aucune règle ne parle est la mort silencieuse qu'on cherche ici ;
//   2. ils ne se DÉPLACENT pas : c'est la proposition C, désignée par lui, et
//      ce qui la distingue de la vague. Rien ne doit sortir du rond de 44 px ;
//   3. **la phrase est là.** L'écran parlait quand il écoutait et quand il avait
//      fini, et se taisait pendant le seul moment où l'on se demande s'il est en
//      panne. C'est la seule des trois qui parvienne à qui n'a pas les yeux sur
//      l'écran ;
//   4. le bouton reste à PLEINE ENCRE. Le demi-effacement d'avant était le
//      vocabulaire d'un bouton éteint — la moitié du défaut, invisible à toute
//      mesure de mouvement.
//
// Elle sait échouer : remettre le caractère « … », rétablir `opacity: 0.5` ou
// retirer la phrase rend rouge le point correspondant, en le nommant.

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
const etendue = (v: number[]) => Math.max(...v) - Math.min(...v);

async function main() {
  const navigateur = await lancerNavigateur({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${MICRO_SIMULE}`,
    ],
  });
  const contexte = await navigateur.newContext({ permissions: ["microphone"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });

  // La dictée part par une action serveur, donc par un POST sur l'adresse
  // courante. On la retient trois secondes : c'est le seul moyen d'OBSERVER
  // l'attente, et c'est aussi la situation réelle du patron.
  const RETENUE_MS = 3_000;
  await page.route(
    (url) => url.pathname === "/chantiers/nouveau",
    async (route, requete) => {
      if (requete.method() !== "POST") return route.continue();
      await attendre(RETENUE_MS);
      return route.continue();
    },
  );

  const bouton = page.locator('button[aria-label="Dicter les informations du client"]');
  await bouton.waitFor({ state: "visible", timeout: 10_000 });
  await bouton.click();

  // On parle un instant, puis on arrête : c'est son geste, dans son ordre.
  await attendre(700);
  const arret = page.locator('button[aria-label="Arrêter la dictée"]');
  await arret.waitFor({ state: "visible", timeout: 10_000 });
  await arret.click();

  // ─── L'attente est là, et on la mesure pendant qu'elle dure ────────────────
  //
  // **L'absence des points est traitée comme un défaut NOMMÉ, pas comme une
  // panne de l'outil.** Laissée à Playwright, elle sortait en « Timeout
  // 10000ms exceeded » sur un sélecteur — une trace qui envoie lire le contrôle
  // au lieu de l'écran. Et surtout elle arrêtait tout : les deux autres moitiés
  // du correctif — la phrase, l'encre — n'étaient plus mesurées, alors que ce
  // sont elles qui diraient d'où vient le retour en arrière.
  // **L'encre se relève TOUT DE SUITE, avant la mesure du souffle.**
  // Relevée après, elle arrivait une fois la réponse revenue : le bouton était
  // redevenu le micro, et l'échec sortait en « Timeout » sur un libellé
  // introuvable — une erreur qui accuse le sélecteur là où le fautif est
  // l'instant du relevé.
  const encreALAttente = await page
    .locator("button[disabled]")
    .first()
    .evaluate((el) => Number(getComputedStyle(el).opacity), { timeout: 5_000 })
    .catch(() => null);

  const points = page.locator(".atlas-souffle i");
  const soufflePresent = await points
    .first()
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  const releves: { echelle: number; y: number }[] = [];
  if (soufflePresent) {
    for (let t = 0; t < 1_400; t += 40) {
      releves.push(
        await points.first().evaluate((el) => {
          const s = getComputedStyle(el);
          const m = new DOMMatrixReadOnly(s.transform === "none" ? "" : s.transform);
          return { echelle: Math.hypot(m.m11, m.m12), y: m.m42 };
        }),
      );
      await attendre(40);
    }
  }

  const souffle = releves.length ? etendue(releves.map((r) => r.echelle)) : 0;
  const deplacement = releves.length ? etendue(releves.map((r) => r.y)) : 0;

  await cas("les trois points soufflent — ils ne sont plus un caractère immobile", async () => {
    assert.ok(
      soufflePresent,
      "aucun point qui souffle sur l'écran : l'attente est-elle revenue au caractère « … » ? " +
        "(le geste vit dans PointsQuiSoufflent et .atlas-souffle)",
    );
    assert.strictEqual(await points.count(), 3, "il faut trois points, pas un glyphe");
    assert.ok(
      souffle >= 0.5,
      `les points n'enflent que de ${souffle.toFixed(2)} — sous 0,5, l'œil ne le voit pas`,
    );
  });

  await cas("ils soufflent SUR PLACE — c'est la proposition C, pas la vague", async () => {
    assert.ok(soufflePresent, "sans points à l'écran, rien à mesurer — voir le défaut ci-dessus");
    assert.ok(
      deplacement < 1,
      `ils se déplacent de ${deplacement.toFixed(1)} px : rien ne doit sortir du rond`,
    );
  });

  await cas("l'écran DIT qu'il travaille, en toutes lettres", async () => {
    const ligne = page.locator('p[role="status"]');
    // Le silence est le défaut le plus probable ici, et une attente d'outil le
    // raconterait mal : sans cette phrase, l'écran ne dit RIEN pendant qu'il
    // travaille — c'est le cœur de ce que le patron a signalé.
    assert.ok(
      (await ligne.count()) > 0,
      "aucune phrase sous le bouton pendant le traitement : l'écran se tait au seul moment " +
        "où l'on se demande s'il est en panne",
    );
    const phrase = await ligne.innerText();
    assert.ok(
      phrase.includes("rédige"),
      `l'écran affiche « ${phrase} » au lieu d'annoncer qu'il rédige`,
    );
  });

  await cas("le bouton reste à pleine encre — un bouton qui travaille n'est pas éteint", async () => {
    assert.ok(
      encreALAttente !== null,
      "le bouton n'était plus hors d'atteinte pendant l'attente : l'a-t-on rendu pressable ? " +
        "(un second appui pendant le traitement lancerait une seconde dictée)",
    );
    assert.ok(
      encreALAttente >= 0.9,
      `le bouton est à ${encreALAttente} pendant qu'il travaille : c'est le vocabulaire d'un ` +
        "bouton ÉTEINT, et c'était la moitié du défaut du 13 août",
    );
  });

  // ─── Et l'attente FINIT : elle ne remplace pas le résultat ─────────────────
  await cas("une fois la réponse arrivée, le micro revient et l'écran rend compte", async () => {
    await page
      .locator('button[aria-label="Dicter les informations du client"]')
      .waitFor({ state: "visible", timeout: 20_000 });
    const phrase = await page.locator('p[role="status"]').innerText();
    assert.ok(
      !phrase.includes("rédige"),
      `l'écran dit encore « ${phrase} » alors que la dictée est revenue`,
    );
  });

  await navigateur.close();

  if (echecs > 0) {
    console.error(`\n${echecs} défaut(s) sur l'attente de la dictée.`);
    process.exit(1);
  }
  console.log("\n✅ L'attente de la dictée souffle, se dit, et ne passe plus pour une panne.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
