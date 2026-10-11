import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import assert from "node:assert";
import { ADRESSE } from "./_adresse";

const BASE = ADRESSE;

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

/**
 * La ligne REPLIÉE du tarif : depuis le 11 octobre 2026 (`appli/mes-tarifs-corrige.html`),
 * un tarif est une ligne qu'on touche pour l'ouvrir, et non plus une carte de champs.
 */
function ligneDuTarif(page: Page, libelleUnique: string) {
  return page.locator('[data-atlas="tarif"]', { hasText: libelleUnique });
}

/** Recharge la page jusqu'à ce que la ligne repliée écrive le prix attendu (« 42,50 € »). */
async function attendreValeurPersistee(page: Page, libelleUnique: string, attendu: string): Promise<void> {
  const debut = Date.now();
  let derniereVue = "(ligne absente)";
  while (Date.now() - debut < LIMITE_MS) {
    await page.reload({ waitUntil: "networkidle" });
    const ligne = ligneDuTarif(page, libelleUnique);
    if ((await ligne.count()) > 0) {
      // L'espace insécable du montant sort en espace ordinaire d'`innerText`,
      // ou non, selon le navigateur : on compare sans elle.
      derniereVue = (await ligne.innerText()).replace(/s+/g, " ");
      if (derniereVue.includes(attendu)) return;
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
    if ((await ligneDuTarif(page, libelleUnique).count()) === 0) return;
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
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });

  // **Les tarifs ont leur propre rubrique depuis le 14 août 2026.** L'écran des
  // réglages est devenu un sommaire, et tout ce qui s'y empilait est parti dans
  // la rubrique correspondante (`ARCHITECTURE.md` §96). Le chemin du patron est
  // donc éprouvé DEPUIS LE SOMMAIRE, en touchant la ligne : viser directement
  // l'adresse aurait laissé passer un sommaire dont le lien ne mène nulle part.
  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Réglages").first().isVisible());
  await page.getByRole("link", { name: /Tarifs & catalogue/ }).click();
  // Le sommaire garde « Tarifs & catalogue » ; l'écran s'appelle « Mes tarifs »
  // depuis le 11 octobre 2026.
  await page.getByRole("heading", { name: "Mes tarifs" }).waitFor({ timeout: 15000 });

  const libelleUnique = `Tarif e2e ${Date.now()}`;

  // --- Ajout ---
  // Le compte se prend **avant** le clic : le prendre après reviendrait à
  // attendre un seuil déjà franchi, c'est-à-dire à n'attendre rien du tout.
  const lignes = page.locator('[data-atlas="tarif"]');
  await page.click("text=Ajouter un tarif");
  // La ligne naît d'une action serveur, et s'ouvre d'elle-même : on attend
  // son champ, pas une durée.
  const nom = page.getByLabel("Nom du tarif");
  await nom.waitFor({ state: "visible", timeout: 15000 });
  await nom.fill(libelleUnique);
  await page.getByLabel("Prix du tarif").fill("42.50");
  await enregistrer(page, () => page.getByLabel("Prix du tarif").blur());

  // --- Persistance après rechargement ---
  await attendreValeurPersistee(page, libelleUnique, "42,50 €");

  // --- Modification : on touche la ligne, elle s'ouvre sur place ---
  await ligneDuTarif(page, libelleUnique).getByRole("button").first().click();
  await page.getByLabel("Prix du tarif").fill("50.00");
  await enregistrer(page, () => page.getByLabel("Prix du tarif").blur());
  await attendreValeurPersistee(page, libelleUnique, "50,00 €");

  // --- Suppression ---
  const nbAvant = await lignes.count();
  await ligneDuTarif(page, libelleUnique).getByRole("button").first().click();
  // « Retirer le tarif « … » » depuis le 10 août 2026, en bas de la ligne
  // ouverte depuis le 11 octobre ; l'écriture n'a lieu qu'à la fermeture du
  // tiroir : `enregistrer` attend donc la vraie requête, qui arrive après le
  // délai d'annulation.
  await enregistrer(
    page,
    () => page.getByRole("button", { name: /^Retirer le tarif/ }).click(),
    { timeout: 20000 }
  );
  await attendreDisparition(page, libelleUnique);

  const nbApres = await lignes.count();
  assert.equal(nbApres, nbAvant - 1, "Le tarif supprimé ne doit plus apparaître après rechargement");

  // --- L'IA est-elle branchée ? La réponse doit être À L'ÉCRAN --------------
  //
  // Le 6 août 2026, le patron avait posé ses clés et voyait une application
  // inchangée. La question « quel fournisseur tourne réellement ? » n'avait
  // aucune réponse consultable : il a fallu lire quatre fichiers du dépôt pour
  // la reconstituer. Elle se lit maintenant sur un écran, donc sur une
  // capture — et cette suite tient qu'elle y reste.
  //
  // **Elle a sa rubrique depuis le 14 août 2026** (`ARCHITECTURE.md` §96), et on
  // y va PAR LE SOMMAIRE : viser l'adresse directement laisserait passer une
  // ligne « Atlas IA » qui ne mène nulle part.
  await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Atlas IA/ }).click();
  await page.getByRole("heading", { name: "Atlas IA" }).waitFor({ timeout: 15000 });
  const ecran = await page.locator("body").innerText();
  assert.match(
    ecran,
    /Atlas IA/i,
    "L'écran ne dit plus quels fournisseurs d'IA tournent."
  );
  /**
   * **CE CONTRÔLE RÉCLAMAIT UN MOT QUE LE PATRON A FAIT RETIRER — corrigé le
   * 9 septembre 2026.**
   *
   * Il exigeait « déterministe ». C'est un mot d'informaticien, et l'écran a
   * été réécrit le jour même (`cab142f2`, *« cesser de parler en développeur à
   * un artisan »*) : il énumère désormais ce qu'Atlas sait faire — écouter,
   * écrire, lire un croquis — et marque chaque ligne « Pas encore » tant que
   * rien n'est branché.
   *
   * **On adapte le contrôle, on ne remet pas le libellé** (`CLAUDE.md` §5 bis) :
   * écrire une suite qui réclame ce qu'il a fait enlever rend son écran
   * impossible à changer.
   *
   * Ce qu'on défend ici n'est donc plus un mot mais la RÈGLE : la batterie
   * coupe délibérément les clés d'IA, et l'écran doit le DIRE — jamais laisser
   * croire qu'une dictée sera transcrite alors que personne n'écoute.
   */
  assert.match(
    ecran,
    /pas encore/i,
    `Sans clé, l'écran doit dire que rien n'est branché. Écran : ${ecran.slice(-400)}`
  );
  console.log("  ✓ sans clé, l'écran dit que rien n'est encore branché");

  await browser.close();
  console.log("✅ Test bout-en-bout Tarifs réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
