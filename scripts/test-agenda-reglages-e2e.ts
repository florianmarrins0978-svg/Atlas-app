import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

// **« Que l'utilisateur puisse, s'il le souhaite ou non, connecter son planning
// à son agenda Google. »** — le patron, le 9 août 2026.
//
// Le « ou non » est la moitié qu'un contrôle peut réellement tenir ici. Le
// raccordement lui-même demande des identifiants Google que cet environnement
// n'a pas (`docs/A-FAIRE.md` §7) — et c'est précisément **l'état que le patron
// verra en ouvrant l'écran aujourd'hui**. Il vaut donc d'être éprouvé pour
// lui-même, plutôt que traité comme un cas dégradé sans intérêt.
//
// Ce que cette suite tient :
//
//   1. **l'écran existe et se trouve depuis les réglages.** Une page qu'on ne
//      peut atteindre qu'en tapant son adresse n'existe pas pour lui ;
//   2. **sans identifiants, l'écran le dit et ne propose RIEN à cliquer.** Un
//      bouton « Relier » qui mène à une erreur Google est pire qu'un bouton
//      absent : il donne à croire que le raccordement a été tenté ;
//   3. **le risque est nommé, pas caché.** Atlas ne voit pas les rendez-vous
//      notés ailleurs, et peut proposer ce jour-là. L'artisan doit l'apprendre
//      de l'écran, pas de son client mécontent.

const BASE = "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 852 } });
  const page = await contexte.newPage();

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

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  console.log("--- L'agenda, au choix de l'artisan ---");

  await cas("les réglages mènent à l'écran de l'agenda", async () => {
    await page.goto(`${BASE}/reglages`, { waitUntil: "domcontentloaded" });
    const lien = page.getByRole("link", { name: /Mon agenda/i });
    await lien.waitFor({ state: "visible", timeout: 15000 });
    await lien.click();
    // `waitForURL` ne se résout pas sur une navigation côté client : on attend
    // un élément réel de la page d'arrivée.
    await page.getByRole("heading", { name: "Mon agenda" }).waitFor({ timeout: 15000 });
  });

  await cas("l'écran dit le risque : un rendez-vous noté ailleurs est invisible", async () => {
    const texte = await page.locator("body").innerText();
    assert.match(
      texte,
      /rendez-vous noté ailleurs/i,
      "l'écran ne dit pas pourquoi il existe — l'artisan ne saura pas ce qu'il risque"
    );
  });

  await cas("sans identifiants, l'écran l'annonce clairement", async () => {
    const texte = await page.locator("body").innerText();
    assert.match(
      texte,
      /pas encore disponible/i,
      `l'écran laisse croire que le raccordement est possible. Vu : ${texte.slice(0, 400)}`
    );
  });

  await cas("et il ne propose AUCUN bouton qui mènerait à une erreur", async () => {
    // Le point qui compte. Un bouton « Relier » sans identifiants envoie
    // l'artisan chez Google avec un client vide : il lit un message d'erreur en
    // anglais et croit qu'Atlas est cassé.
    const boutons = await page.getByRole("button", { name: /Relier|Rebrancher|Débrancher|pause/i }).count();
    assert.equal(boutons, 0, `${boutons} bouton(s) de raccordement proposés alors que rien n'est configuré`);
  });

  await cas("l'écran ne s'effondre pas et reste lisible sur un téléphone", async () => {
    // `truncate` et les débordements sont du CSS : une vérification de texte
    // reste verte sur un écran illisible. On mesure donc la page rendue.
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(largeur <= 400, `la page déborde horizontalement (${largeur}px pour 393)`);
    const hauteur = await page.evaluate(() => document.body.getBoundingClientRect().height);
    assert.ok(hauteur > 300, `la page semble vide (${Math.round(hauteur)}px de haut)`);
  });

  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Écran de l'agenda — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
