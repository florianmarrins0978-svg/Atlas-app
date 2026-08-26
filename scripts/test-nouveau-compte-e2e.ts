import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";

// « NOUVEAU COMPTE » — l'écran qu'il a retenu le 26 août 2026, dans un vrai
// navigateur.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE DÉFEND, ET CE N'EST PAS DU CONFORT.**
//
// Ses trois reproches sur l'écran de la veille, capture à l'appui :
//
//   1. *« Mettre le petit œil à côté du mdp pour pouvoir voir ce qu'on écrit,
//      et il faut confirmer son mdp donc l'écrire deux fois. »*
//   2. *« Pour valider un compte c'est pas clair, la case est déjà noire comme
//      la catégorie salarié, on comprend pas bien. »*
//   3. *« La démarcation entre vous patron et le compte qu'on est en train
//      d'attribuer n'est pas bien séparée. »*
//
// **Le point 2 se MESURE**, et c'est le cœur de cette suite : on compare le
// fond de la pastille cochée à celui du bouton qui crée le compte, et l'on
// exige qu'ils DIFFÈRENT. Une assertion sur un mot (« teinté », « noir »)
// n'aurait rien défendu — le patron peut faire renommer un libellé demain, et
// les couleurs changent d'une charte à l'autre. Deux aplats identiques, en
// revanche, sont exactement ce qu'il a photographié (`CLAUDE.md` §5 bis).
//
// **Le point 1 se mesure aussi** : on lit le `type` des deux champs avant et
// après l'appui sur l'œil. Un œil qui ne bascule rien serait un dessin.
//
// **Et le point 3 se mesure par l'ADRESSE** : la liste ne doit plus porter de
// formulaire du tout. C'est ce qui distingue sa proposition B — retenue — de la
// proposition A, où le formulaire restait sur la même page.
//
// ═══════════════════════════════════════════════════════════════════════════
// **UN REFUS DU SERVEUR SE LIT À L'ÉCRAN.** L'adresse déjà prise est le seul
// refus qui n'a aucun écho local : si le message n'arrivait pas, le patron
// appuierait sur « Créer le compte » et il ne se passerait rien. C'est
// précisément le défaut muet que `AGENTS.md` interdit de laisser vivre.

const BASE = "http://localhost:3000";
const MOT_DE_PASSE = "chene-tilleul-08";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Nouveau compte, dans un vrai navigateur ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 720 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await cas("la liste ne porte plus de formulaire — « Donner un accès » MÈNE ailleurs", async () => {
    await page.goto(`${BASE}/reglages/equipe`, { waitUntil: "networkidle" });
    await page.waitForSelector('a[href="/reglages/equipe/nouveau"]', { timeout: 15_000 });
    // Sa proposition B contre la A : le formulaire n'est plus sur cette page.
    assert.equal(await page.locator("form input").count(), 0, "un formulaire est resté dans la liste");
  });

  await cas("l'écran de création s'ouvre à son ADRESSE, et porte deux mots de passe", async () => {
    await page.click('a[href="/reglages/equipe/nouveau"]');
    await page.waitForURL(`${BASE}/reglages/equipe/nouveau`, { timeout: 15_000 });
    await page.waitForSelector('input[type="password"]', { timeout: 15_000 });
    assert.equal(await page.locator('input[type="password"]').count(), 2, "il n'y a pas deux saisies");
  });

  await cas("chaque saisie porte SON œil, et l'œil bascule vraiment", async () => {
    const yeux = page.locator('button[aria-label^="Afficher"], button[aria-label^="Masquer"]');
    assert.equal(await yeux.count(), 2, "les deux champs n'ont pas chacun leur œil");

    await yeux.first().click();
    await page.waitForTimeout(200);
    const types = await page
      .locator("form input[type='text'], form input[type='password']")
      .evaluateAll((n) => n.map((i) => (i as HTMLInputElement).type));
    // **Un contrôle qui mesure zéro ne mesure rien** : sans champ lu, on ne
    // conclut pas.
    assert.ok(types.length >= 2, "les champs n'ont pas été lus");
    assert.ok(types.includes("text"), "l'œil n'a rien affiché");
    assert.ok(types.includes("password"), "le second champ s'est ouvert tout seul");
    await yeux.first().click();
  });

  await cas("LE BOUTON NE RESSEMBLE PLUS À LA PASTILLE — sa remarque du 26 août", async () => {
    const pastille = page.locator('form button[aria-pressed="true"]').first();
    const bouton = page.locator('form button[type="submit"]');
    await pastille.waitFor({ timeout: 10_000 });

    const fondPastille = await pastille.evaluate((b) => getComputedStyle(b as HTMLElement).backgroundColor);
    const fondBouton = await bouton.evaluate((b) => getComputedStyle(b as HTMLElement).backgroundColor);

    // Refuser de conclure sur une couleur illisible plutôt que de rendre un vert
    // qui ne prouve rien.
    for (const [quoi, valeur] of [["la pastille", fondPastille], ["le bouton", fondBouton]] as const) {
      assert.ok(
        valeur && valeur !== "rgba(0, 0, 0, 0)" && valeur !== "transparent",
        `${quoi} n'a pas de fond mesurable (${valeur}) : rien n'a été mesuré`
      );
    }
    assert.notEqual(
      fondPastille,
      fondBouton,
      `le rôle choisi et le bouton ont le même aplat (${fondBouton}) — c'est exactement ce qu'il a photographié`
    );
  });

  const email = `julien-${Date.now()}@essai.local`;

  await cas("une confirmation qui diffère ne crée RIEN", async () => {
    await page.locator("form input").first().fill("Julien Roux");
    await page.fill('input[type="email"]', email);
    await page.locator('input[type="password"]').first().fill(MOT_DE_PASSE);
    await page.locator('input[type="password"]').last().fill(`${MOT_DE_PASSE}x`);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    assert.equal(page.url(), `${BASE}/reglages/equipe/nouveau`, "le compte a été créé malgré la confirmation fausse");
  });

  await cas("une adresse déjà prise est refusée, ET LE DIT", async () => {
    // Le seul refus sans écho local : sans message, l'appui ne ferait rien du
    // tout et le patron ne saurait pas pourquoi.
    await page.fill('input[type="email"]', "demo@atlas.local");
    await page.locator('input[type="password"]').last().fill(MOT_DE_PASSE);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const texte = await page.locator("form").innerText();
    assert.ok(texte.includes("utilise déjà cette adresse"), `aucun refus lisible à l'écran :\n${texte.slice(-200)}`);
  });

  await cas("corrigée, la création aboutit et la liste porte le compte", async () => {
    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/reglages/equipe`, { timeout: 20_000 });
    await page.waitForSelector(`text=${email}`, { timeout: 15_000 });
    assert.equal(await page.locator(`text=${email}`).count(), 1);
  });

  await cas("dans la liste aussi, le rôle choisi est teinté et non plein", async () => {
    await page.locator("button", { hasText: "Julien Roux" }).first().click();
    await page.waitForTimeout(500);
    const pastille = page.locator('button[aria-pressed="true"]').first();
    const fond = await pastille.evaluate((b) => getComputedStyle(b as HTMLElement).backgroundColor);
    assert.ok(fond && fond !== "rgba(0, 0, 0, 0)", "la pastille n'a pas de fond mesurable");
    // Le vert pin plein est réservé aux actions. La pastille ne doit pas le
    // porter — ici comme sur l'écran de création.
    assert.notEqual(fond, "rgb(47, 59, 47)", "le rôle est redevenu un aplat plein dans la liste");
  });

  await navigateur.close();

  console.log(`\nNouveau compte dans un vrai navigateur — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
