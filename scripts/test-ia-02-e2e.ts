import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { creerPuisFiche } from "./_creer-chantier-e2e";

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

  const nomUnique = `Chantier copilote e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomUnique);
  const idChantier = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = `http://localhost:3000/chantiers/${idChantier}`;

  // Ajoute une prestation réelle pour que l'assistant ait quelque chose à lire.
  //
  // ─── CE DÉCOR A ACCUSÉ L'ASSISTANT PENDANT TROIS BATTERIES ────────────────
  //
  // **Le contrôle du bas — « la prestation est toujours là après l'échange » —
  // rougissait alors qu'elle n'avait JAMAIS été posée.** Deux corrections ont
  // échoué avant de regarder au bon endroit : un délai de 300 ms remplacé par
  // une attente de réseau, puis une relecture de l'écran quatre fois de suite.
  // Aucune ne pouvait marcher, parce que l'écriture n'avait pas eu lieu.
  //
  // La cause est ici : `page.click("+ Ajouter une prestation")`, puis 300 ms au
  // doigt mouillé, puis `form input` **premier du lot**. Sous la batterie, la
  // ligne neuve n'est pas encore rendue quand on écrit — le texte part dans le
  // champ d'à côté, et il n'y a pas de prestation à retrouver.
  //
  // **Un décor qui échoue doit s'accuser LUI-MÊME** (`AGENTS.md`) : le message
  // du bas nommait l'assistant, et l'on aurait fini par chercher un défaut de
  // mutation dans un code parfaitement sain.
  // ──────────────────────────────────────────────────────────────────────────
  const laPrestation = 'input[value="Poser la faïence murale"]';
  for (const essai of [0, 1, 2]) {
    await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
    if ((await page.locator(laPrestation).count()) === 1) break;
    if (essai > 0) await page.waitForTimeout(essai * 700);
    // **On attend que la ligne APPARAISSE, pas 300 ms.** Ce champ ne porte ni
    // étiquette ni marque (`InformationsClient.ListeTextes`) : le seul repère
    // est sa place, et elle n'existe qu'une fois la ligne rendue. On compte
    // donc les champs avant et après — c'est leur nombre qui dit que la ligne
    // est là, et rien d'autre ne le dirait.
    const champs = page.locator("form input");
    const avantAjout = await champs.count();
    await page.click("text=+ Ajouter une prestation");
    for (const attente of [0, 200, 400, 800, 1600, 3200]) {
      if (attente > 0) await page.waitForTimeout(attente);
      if ((await champs.count()) > avantAjout) break;
    }
    await champs.first().fill("Poser la faïence murale");
    await champs.first().blur();
    await page.waitForLoadState("networkidle");
  }
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  assert.equal(
    await page.locator(laPrestation).count(),
    1,
    "LE DÉCOR a échoué : la prestation n'a pas pu être posée AVANT l'échange. " +
      "Rien n'est reproché à l'assistant ici — c'est cette suite qui n'a pas su écrire."
  );

  // --- Ouverture de l'assistant ---
  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  assert.equal(await page.locator("text=Assistant").count(), 0, "L'assistant doit être fermé par défaut");
  await page.click('button[aria-label="Ouvrir l\'assistant"]');
  await page.waitForSelector("text=Assistant");

  // --- Question sur les prestations ---
  await page.fill('input[placeholder="Votre question…"]', "Quelles sont les prestations prévues sur ce chantier ?");
  await page.click('button[aria-label="Envoyer"]');
  await page.waitForSelector("text=Sources", { timeout: 10000 });
  assert.ok(await page.locator("li", { hasText: "Prestations" }).isVisible(), "La source 'Prestations' doit être affichée");

  // --- Aucune mutation : la prestation existante est toujours là après l'échange ---
  //
  // **`networkidle` ne suffisait pas, et il a fallu deux passages pour le
  // voir.** Une première correction, le 25 août 2026, a remplacé un délai de
  // trois cents millisecondes par une attente de réseau au calme (voir plus
  // haut) : la suite a rougi de nouveau à la batterie suivante. Le réseau se
  // tait dès que l'action serveur est PARTIE ; rien ne dit qu'elle a fini
  // d'écrire, ni que l'écran d'après la relira.
  //
  // On rouvre donc l'écran jusqu'à ce que la prestation s'y montre, avec une
  // attente qui monte. **Le contrôle ne s'affaiblit pas** : si elle n'y est
  // toujours pas au bout de sept secondes, il rougit comme avant — et une
  // prestation vraiment effacée par l'assistant ne reviendrait jamais.
  let combien = 0;
  for (const essai of [0, 1, 2, 3]) {
    if (essai > 0) await page.waitForTimeout(essai * 600);
    await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
    combien = await page.locator('input[value="Poser la faïence murale"]').count();
    if (combien === 1) break;
  }
  // **Le message nomme le coupable** : « 0 == 1 » envoyait chercher partout.
  assert.equal(
    combien,
    1,
    "la prestation a disparu après l'échange avec l'assistant — ou elle n'a jamais été enregistrée"
  );

  // --- Fermeture ---
  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  await page.click('button[aria-label="Ouvrir l\'assistant"]');
  await page.waitForSelector("text=Assistant");
  await page.click('button[aria-label="Fermer"]');
  await page.waitForTimeout(300);
  assert.equal(await page.locator("text=Assistant").count(), 0, "L'assistant doit se fermer correctement");

  await browser.close();
  console.log("✅ Test bout-en-bout Assistant (IA-02) réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
