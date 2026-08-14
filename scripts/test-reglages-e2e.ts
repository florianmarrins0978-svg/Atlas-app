import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import assert from "node:assert";

// Le cycle complet d'un tarif : ajout, persistance, modification, suppression.
//
// **Pourquoi ce fichier n'attend plus de délais fixes.** Il a rougi deux fois
// pendant une batterie chargée — une fois « '0.00' == '42.50' », une fois un
// dépassement de délai — puis il repassait au vert joué seul. Le produit
// n'était pas en cause : le prix part dans une action serveur au moment où l'on
// quitte le champ, sans le moindre signal à l'écran, et le test rechargeait la
// page après 400 ms en dur. Quand la machine est occupée, l'enregistrement
// n'est pas encore arrivé.
//
// On attend donc **le résultat, pas le chrono** : la valeur est relue jusqu'à ce
// qu'elle soit celle qu'on a saisie, dans une limite de temps généreuse. Ce qui
// est affirmé devient « le tarif finit par être enregistré », qui est la vraie
// promesse faite au patron — et non « il est enregistré en moins de 400 ms »,
// qui n'en est pas une.
//
// Le contrôle sait toujours échouer : si rien n'est enregistré, la boucle
// s'épuise et dit ce qu'elle attendait, ce qu'elle a vu, et pendant combien de
// temps.

const LIMITE_MS = 20000;
const PAUSE_MS = 500;

/**
 * Joue un geste qui déclenche un enregistrement, et attend que le serveur ait
 * répondu avant de rendre la main.
 *
 * **Ce sans quoi le contrôle se ment à lui-même.** Recharger la page juste
 * après avoir quitté le champ *annule* l'action serveur encore en vol : la
 * valeur n'est jamais enregistrée, et le contrôle accuse ensuite le produit
 * pour un tort qu'il a lui-même commis. C'est ce qui s'est passé à la première
 * réécriture de ce fichier — trois relectures montrant « 0,00 » sur un
 * enregistrement que le test venait d'interrompre.
 */
async function enregistrer(
  page: Page,
  geste: () => Promise<void>,
  options: { timeout?: number } = {}
): Promise<void> {
  const reponse = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/reglages"),
    { timeout: options.timeout ?? 15000 }
  );
  await geste();
  await reponse;
}

/** Recharge la page jusqu'à ce que le champ porte la valeur attendue. */
async function attendreValeurPersistee(
  page: Page,
  libelleUnique: string,
  indexChamp: number,
  attendu: string
): Promise<void> {
  const debut = Date.now();
  let derniereVue = "(ligne absente)";
  while (Date.now() - debut < LIMITE_MS) {
    await page.reload({ waitUntil: "networkidle" });
    const ligne = page.locator("li", { has: page.locator(`input[value="${libelleUnique}"]`) });
    if ((await ligne.count()) > 0) {
      derniereVue = await ligne.locator("input").nth(indexChamp).inputValue();
      if (derniereVue === attendu) return;
    }
    await page.waitForTimeout(PAUSE_MS);
  }
  throw new Error(
    `Le tarif « ${libelleUnique} » n'a jamais porté « ${attendu} » : vu « ${derniereVue} » ` +
      `après ${LIMITE_MS} ms de relectures. L'enregistrement n'arrive pas.`
  );
}

/** Recharge la page jusqu'à ce que le tarif ait disparu. */
async function attendreDisparition(page: Page, libelleUnique: string): Promise<void> {
  const debut = Date.now();
  while (Date.now() - debut < LIMITE_MS) {
    await page.reload({ waitUntil: "networkidle" });
    if ((await page.locator(`input[value="${libelleUnique}"]`).count()) === 0) return;
    await page.waitForTimeout(PAUSE_MS);
  }
  throw new Error(
    `Le tarif « ${libelleUnique} » est toujours là après ${LIMITE_MS} ms : la suppression n'a pas pris.`
  );
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();

  // Connexion réelle (Auth.js) — toutes les routes applicatives sont
  // désormais protégées par le middleware d'authentification.
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  // **Les tarifs ont leur propre rubrique depuis le 14 août 2026.** L'écran des
  // réglages est devenu un sommaire, et tout ce qui s'y empilait est parti dans
  // la rubrique correspondante (`ARCHITECTURE.md` §96). Le chemin du patron est
  // donc éprouvé DEPUIS LE SOMMAIRE, en touchant la ligne : viser directement
  // l'adresse aurait laissé passer un sommaire dont le lien ne mène nulle part.
  await page.goto("http://localhost:3000/reglages", { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Réglages").first().isVisible());
  await page.getByRole("link", { name: /Tarifs & catalogue/ }).click();
  await page.getByRole("heading", { name: "Tarifs & catalogue" }).waitFor({ timeout: 15000 });

  const libelleUnique = `Tarif e2e ${Date.now()}`;

  // --- Ajout ---
  // Le compte se prend **avant** le clic : le prendre après reviendrait à
  // attendre un seuil déjà franchi, c'est-à-dire à n'attendre rien du tout.
  const lignes = page.locator("li");
  const nbInitial = await lignes.count();
  await page.click("text=Ajouter un tarif");
  // La ligne naît d'une action serveur : on l'attend elle, pas une durée.
  await page.waitForFunction(
    (attendu) => document.querySelectorAll("li").length > attendu,
    nbInitial,
    { timeout: 15000 }
  );
  const derniereLigne = lignes.last();
  const inputs = derniereLigne.locator("input");
  await inputs.nth(0).fill(libelleUnique);
  await inputs.nth(1).fill("42.50");
  await enregistrer(page, () => inputs.nth(1).blur());

  // --- Persistance après rechargement ---
  await attendreValeurPersistee(page, libelleUnique, 1, "42.50");

  // --- Modification ---
  const ligneAModifier = page.locator("li", { has: page.locator(`input[value="${libelleUnique}"]`) });
  await ligneAModifier.locator("input").nth(1).fill("50.00");
  await enregistrer(page, () => ligneAModifier.locator("input").nth(1).blur());
  await attendreValeurPersistee(page, libelleUnique, 1, "50.00");

  // --- Suppression ---
  const nbAvant = await page.locator("li").count();
  const ligneASupprimer = page.locator("li", { has: page.locator(`input[value="${libelleUnique}"]`) });
  // « Retirer le tarif « … » » depuis le 10 août 2026, et l'écriture n'a lieu
  // qu'à la fermeture du tiroir : `enregistrer` attend donc la vraie requête,
  // qui arrive après le délai d'annulation.
  await enregistrer(
    page,
    () => ligneASupprimer.getByRole("button", { name: /^Retirer le tarif/ }).click(),
    { timeout: 20000 }
  );
  await attendreDisparition(page, libelleUnique);

  const nbApres = await page.locator("li").count();
  assert.equal(nbApres, nbAvant - 1, "Le tarif supprimé ne doit plus apparaître après rechargement");

  // --- L'IA est-elle branchée ? La réponse doit être À L'ÉCRAN --------------
  //
  // Le 6 août 2026, le patron avait posé ses clés et voyait une application
  // inchangée. La question « quel fournisseur tourne réellement ? » n'avait
  // aucune réponse consultable : il a fallu lire quatre fichiers du dépôt pour
  // la reconstituer. Elle se lit maintenant sur cet écran, donc sur une
  // capture — et cette suite tient qu'elle y reste.
  const ecran = await page.locator("body").innerText();
  assert.match(
    ecran,
    /Intelligence artificielle/i,
    "L'écran Réglages ne dit plus quels fournisseurs d'IA tournent."
  );
  // La batterie retire délibérément les clés d'IA de cette étape : l'état
  // attendu ici est donc le mode déterministe, annoncé sans détour.
  assert.match(
    ecran,
    /déterministe/i,
    `Sans clé, l'écran doit annoncer le mode déterministe. Écran : ${ecran.slice(-400)}`
  );
  console.log("  ✓ l'écran dit quels fournisseurs d'IA tournent réellement");

  await browser.close();
  console.log("✅ Test bout-en-bout Tarifs réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
