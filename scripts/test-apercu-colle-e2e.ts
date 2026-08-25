// L'APERÇU DU DEVIS RESTE SOUS LES YEUX PENDANT QU'ON RÈGLE — sa réponse B.
//
// **Sa demande du 24 août 2026 :** *« lorsque je modifie mon devis, je suis
// obligé de descendre pour voir les modifications ; il faut mieux organiser la
// page pour pouvoir voir ce qu'on modifie. Propose, ne code rien. »* Trois
// rangements lui ont été montrés (`appli/allure-mieux-rangee.html`) ; le 25 août
// il a répondu **B** — l'aperçu reste collé en haut.
//
// **POURQUOI CE CONTRÔLE EXISTE, ET CE QU'IL ATTRAPE.**
//
// A et B ne diffèrent que PENDANT LE DÉFILEMENT : en haut de page, les deux
// montrent l'aperçu au même endroit. Un contrôle qui n'aurait pas fait défiler
// resterait donc vert sur A — c'est-à-dire sur la moitié de réponse qu'il a
// explicitement écartée. Il faut descendre, et descendre jusqu'aux polices :
// c'est là que la feuille disparaissait.
//
// **UNE BOÎTE DE ZÉRO PIXEL N'EST PAS UN SUCCÈS.** Le 15 août 2026, une suite a
// comparé deux largeurs valant toutes les deux zéro — mise en page pas encore
// appliquée — et a rendu « rien n'est coupé » en vert sur un écran où trois noms
// l'étaient (`CLAUDE.md` §5). Ici, un aperçu de hauteur nulle fait ROUGIR au
// lieu de passer.
//
// Usage : npm run test:e2e -- --seulement apercu-colle
import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

const BASE = "http://localhost:3000";

let echecs = 0;
const cas = async (nom: string, verifier: () => Promise<void>) => {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
};

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();

  console.log("=== L'aperçu reste sous les yeux pendant qu'on règle ===\n");

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // `networkidle` et non `domcontentloaded` : sans la mise en page appliquée,
  // toutes les mesures qui suivent vaudraient zéro.
  await page.goto(`${BASE}/reglages/documents`, { waitUntil: "networkidle" });

  const apercu = page.locator('[data-atlas="apercu-colle"]');
  const feuille = page.locator('[data-atlas="allure-feuille"]');

  await cas("l'aperçu existe, et il a une hauteur mesurable", async () => {
    assert.equal(await apercu.count(), 1, "aucun aperçu collé sur l'écran des réglages");
    const b = await apercu.boundingBox();
    assert.ok(b, "l'aperçu n'a pas de boîte : mesure impossible, pas un succès");
    assert.ok(
      b.height > 80,
      `l'aperçu mesure ${Math.round(b.height)} px de haut : la mise en page n'est pas appliquée, ` +
        `et tout ce qui suit ne prouverait rien`
    );
  });

  await cas("il est DANS la rubrique de l'allure, pas ailleurs", async () => {
    const titre = await apercu.evaluate(
      (e) => e.closest("section")?.querySelector("p")?.textContent ?? ""
    );
    assert.match(
      titre,
      /allure de mes devis/i,
      `l'aperçu est collé dans « ${titre} » : ailleurs, il recouvrirait des réglages ` +
        `qui n'ont rien à voir avec l'apparence`
    );
  });

  // ─── LE CŒUR : ON DESCEND POUR DE BON ────────────────────────────────────
  await cas("il suit quand on descend jusqu'aux typographies", async () => {
    await page.locator('[data-atlas="allure-feuille"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const avant = await feuille.boundingBox();
    assert.ok(avant, "l'aperçu a disparu avant même d'avoir défilé");

    await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.7)));
    await page.waitForTimeout(400);

    const apres = await feuille.boundingBox();
    assert.ok(apres, "l'aperçu est sorti de la page en défilant");
    const hauteurEcran = page.viewportSize()!.height;
    assert.ok(
      apres.y >= -1 && apres.y < hauteurEcran / 2,
      `après avoir descendu de sept dixièmes d'écran, l'aperçu est à ${Math.round(apres.y)} px : ` +
        `il n'est plus collé en haut. C'est la proposition A, que le patron a écartée le 25 août —\n` +
        `      « dès qu'on descend jusqu'aux polices, elle est de nouveau hors de l'écran ».`
    );
    assert.ok(apres.height > 80, `l'aperçu s'est aplati à ${Math.round(apres.height)} px en défilant`);
  });

  // **Le fond doit être OPAQUE.** Translucide, les réglages défilent au travers :
  // on ne juge plus une couleur de fond sur un fond qui bouge. `transparent` et
  // les couleurs à canal alpha sont refusées.
  await cas("son fond est opaque : rien ne défile au travers", async () => {
    const fond = await apercu.evaluate((e) => getComputedStyle(e).backgroundColor);
    assert.ok(
      fond !== "transparent" && !/rgba\([^)]*,\s*0?\.\d+\)/.test(fond),
      `le fond de l'aperçu est « ${fond} » : les réglages se verraient au travers`
    );
  });

  await navigateur.close();

  console.log(
    echecs === 0
      ? "\n✅ L'aperçu reste collé pendant qu'il règle — sa réponse B du 25 août."
      : `\n❌ L'aperçu collé — ${echecs} échec(s).`
  );
  if (echecs > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
