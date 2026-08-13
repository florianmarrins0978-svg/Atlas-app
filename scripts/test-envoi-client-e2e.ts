import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

// L'envoi du devis au client, vu depuis l'écran du patron (docs/AGENT.md §2.2).
//
// C'est le maillon qui rend tout le reste atteignable : sans lui, la page
// publique de réponse — pourtant complète et testée — n'est joignable par
// aucun chemin réel. Cette suite parcourt donc la chaîne entière, du
// formulaire de création jusqu'au lien que le client ouvrira.

const BASE = "http://localhost:3000";

/**
 * Combien de temps attendre qu'un écran paraisse.
 *
 * **Vingt secondes, et le chiffre a une histoire (12 août 2026).** Cette suite
 * attendait dix secondes là où ses voisines — `test-transmission-e2e`,
 * `test-devis-parti-signet-e2e` — en attendent quinze à vingt pour LE MÊME
 * écran. Elle passait seule et tombait en batterie : le serveur y compile à la
 * demande, avec soixante-deux autres suites qui se disputent quatre cœurs.
 *
 * Le rouge n'accusait pas le bon coupable — il nommait « le canal se déduit de
 * la seule coordonnée renseignée », une règle métier qui n'y était pour rien.
 * Et un rouge qui tombe au hasard coûte plus cher qu'il ne rapporte : il
 * apprend à ignorer le rouge.
 */
const DELAI_ECRAN_MS = 20_000;

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  return page;
}

/** Crée un chantier chiffré, prêt à être envoyé. Renvoie l'URL de sa fiche. */
async function creerChantierFacturable(
  page: Page,
  suffixe: string,
  client: { nom?: string; telephone?: string; email?: string } = {
    nom: "M. Bernard",
    telephone: "06 12 34 56 78",
  }
) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  if (client.nom) await page.fill('input[placeholder="Bernard"]', client.nom);
  if (client.telephone) await page.fill('input[placeholder="06 12 34 56 78"]', client.telephone);
  if (client.email) await page.fill('input[placeholder="bernard@exemple.fr"]', client.email);
  await page.click('button:has-text("Créer le chantier")');
  // Sans délai explicite : celui du contexte s'applique (`e2e-browser.ts`).
  // Dix secondes suffisaient seule et pas en batterie — l'échec accusait alors
  // l'envoi au client, qui n'y était pour rien.
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const url = page.url();

  // Un devis à zéro euro n'a pas de sens : on lui donne une ligne de prix.
  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Main d'œuvre");
  await champs.nth(1).fill("800.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(500);

  return url;
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await seConnecter(context);

  // **L'intention de ce cas n'a pas bougé, sa marche à suivre si** (11 août
  // 2026). Il exigeait la phrase « Indiquez d'abord comment joindre ce client —
  // sur sa fiche ». Or l'écran « Informations » a quitté le tiroir du chantier
  // ce jour-là : cette phrase désignait une porte qui n'existe plus, et un
  // chantier dicté ne pouvait alors plus jamais partir (`ARCHITECTURE.md` §62).
  //
  // La marche à suivre est désormais offerte SUR PLACE — les deux canaux et le
  // champ. Ce qui reste inchangé, et que ce cas continue de tenir : tant que
  // rien n'est renseigné, **l'envoi n'est pas proposé**. Un bouton actif qui ne
  // mènerait qu'à un échec vaut moins qu'un bouton gris.
  await test("sans canal convenu, l'envoi est refusé et la marche à suivre est offerte ici", async () => {
    // Client nommé mais sans aucune coordonnée : le patron n'a rien convenu.
    const url = await creerChantierFacturable(page, "sanscanal", { nom: "M. Sans-Contact" });
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.click("text=Envoyer au client");

    await page.waitForSelector("text=Comment joindre ce client", { timeout: DELAI_ECRAN_MS });
    for (const canal of ["Par SMS", "Par e-mail"]) {
      assert.ok(
        await page.getByRole("button", { name: canal }).isVisible(),
        `« ${canal} » manque : le patron ne peut pas lever le blocage sans quitter l'écran`
      );
    }
    // Le bouton ne doit pas rester cliquable : il ne mènerait qu'à un échec.
    assert.strictEqual(
      await page.getByRole("button", { name: "Envoyer le devis" }).isDisabled(),
      true,
      "l'envoi reste proposé alors qu'il est impossible"
    );
    await page.click('button:has-text("Annuler")');
  });

  await test("le canal se déduit de la seule coordonnée renseignée", async () => {
    const url = await creerChantierFacturable(page, "canalmail", {
      nom: "Mme Dupuis",
      email: "dupuis@exemple.fr",
    });
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.click("text=Envoyer au client");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: DELAI_ECRAN_MS });

    assert.ok(
      await page.locator("text=Par e-mail au dupuis@exemple.fr").isVisible(),
      "le canal déduit n'est pas celui de la coordonnée saisie"
    );
    await page.click('button:has-text("Annuler")');
  });

  await test("le patron ne propose jamais plus de deux dates", async () => {
    const url = await creerChantierFacturable(page, "deuxmax");
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.click("text=Envoyer au client");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: DELAI_ECRAN_MS });

    const jours = page.locator('button[aria-pressed]');
    const total = await jours.count();
    assert.ok(total >= 3, `pas assez de jours libres proposés (${total})`);

    // Le premier est pré-sélectionné : on en ajoute deux de plus.
    await jours.nth(1).click();
    await jours.nth(2).click();

    // **On compte des JOURS, pas des boutons pressés.** Depuis le 12 août 2026,
    // le calendrier marque toute la sélection et non plus la dernière date
    // touchée (`ARCHITECTURE.md` §74) : un même jour est donc légitimement
    // pressé à deux endroits — sa ligne dans la liste, et sa case au
    // calendrier. Ce contrôle annonçait « 4 dates retenues au lieu de 2 » sur
    // une sélection parfaitement juste, c'est-à-dire qu'il accusait à tort.
    //
    // « proposée » n'est écrit que sur les lignes de la sélection : une case du
    // calendrier ne porte que son numéro.
    const selectionnes = await page
      .locator('button[aria-pressed="true"]')
      .filter({ hasText: /proposée/ })
      .count();
    assert.strictEqual(selectionnes, 2, `${selectionnes} dates retenues au lieu de 2`);
    await page.click('button:has-text("Annuler")');
  });

  await test("l'envoi produit un lien que le client peut ouvrir seul", async () => {
    const url = await creerChantierFacturable(page, "cycle");
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.click("text=Envoyer au client");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: DELAI_ECRAN_MS });

    // Deux dates : c'est le cas qui laisse le client choisir.
    await page.locator('button[aria-pressed]').nth(1).click();
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForSelector("text=Devis prêt pour", { timeout: 15000 });

    // Le dernier mètre : sans ce bouton, le lien reste à recopier à la main
    // dans un SMS. C'est le geste que l'application doit épargner, et il a
    // manqué jusqu'ici (docs/A-FAIRE.md §5).
    //
    // C'est un LIEN, et non un bouton, depuis le 4 août 2026 : l'adresse
    // `sms:` doit être portée par un attribut `href` pour être lisible dans la
    // page. Le défaut d'avant — un message ouvert sans destinataire — ne se
    // voyait que dans la messagerie du patron, c'est-à-dire trop tard.
    assert.ok(
      await page.getByRole("link", { name: /Ouvrir le (message|SMS|e-mail) tout prêt/ }).isVisible(),
      "le lien qui ouvre le message tout prêt doit apparaître dès que le lien existe"
    );
    // Dire qui envoie, pour que le patron n'attende pas un départ automatique
    // qui n'aura pas lieu tant qu'aucun prestataire n'est raccordé.
    //
    // `isVisible()` ne suffit PAS : Playwright considère visible un élément
    // recouvert par un autre. Or la barre de navigation est fixée en bas de
    // l'écran, et tout ce qui finit dessous disparaît pour le patron sans que
    // rien ne le signale. C'est ce qu'on vérifie ici, pour de bon.
    // La barre de navigation est fixée en bas de l'écran. Un élément placé si
    // près du bas du document qu'aucun défilement ne peut le dégager reste
    // invisible pour le patron, quoi qu'il fasse — et `isVisible()` ne le voit
    // pas : Playwright considère visible un élément recouvert.
    //
    // La mesure porte donc sur la GÉOMÉTRIE DU DOCUMENT, pas sur la position
    // du défilement au moment du test : « reste-t-il, sous cet élément, au
    // moins la hauteur de la barre ? » Une première version amenait l'élément
    // au bord de la fenêtre — c'est-à-dire exactement sous la barre — et
    // accusait donc toujours, y compris à tort.
    for (const texte of ["Ouvrir le SMS tout prêt", "c'est vous qui l'envoyez"]) {
      const cible = page.locator(`text=${texte}`).first();
      assert.ok(await cible.isVisible(), `« ${texte} » doit être présent à l'écran`);

      const marge = await cible.evaluate((el) => {
        const barre = document.querySelector(".atlas-nav-basse");
        const hauteurBarre = barre ? barre.getBoundingClientRect().height : 0;
        const bas = el.getBoundingClientRect().bottom + window.scrollY;
        const hauteurDocument = document.documentElement.scrollHeight;
        return Math.round(hauteurDocument - bas - hauteurBarre);
      });

      assert.ok(
        marge >= 0,
        `« ${texte} » finit sous la barre de navigation : il manque ${-marge}px que ` +
          `le patron ne pourra jamais faire défiler`
      );
    }
    await page.screenshot({ path: "/tmp/atlas-devis-pret.png", fullPage: true });

    // **Le chemin se lit dans le GESTE, plus dans l'adresse affichée.**
    //
    // Il se lisait dans l'adresse complète, écrite en toutes lettres sous le
    // total. Le patron l'a fait retirer le 12 août — trois lignes de caractères
    // illisibles qu'il ne relisait jamais, et que « Copier le lien » met de
    // toute façon dans le presse-papier.
    //
    // On le prend maintenant là où il compte vraiment : dans le message que le
    // patron va envoyer. C'est un meilleur contrôle que l'ancien — il éprouve
    // le lien que le CLIENT recevra, et non celui qui était affiché à côté.
    const adresse = decodeURIComponent(
      (await page.locator("a[data-transmission]").getAttribute("href")) ?? ""
    );
    const debut = adresse.indexOf("/devis/");
    assert.ok(debut >= 0, `le message à envoyer ne porte aucun lien de devis : « ${adresse.slice(0, 90)} »`);
    const chemin = adresse.slice(debut).split(/\s/)[0];
    assert.ok(chemin.startsWith("/devis/"), `lien inattendu : ${chemin}`);

    // Ouvert dans un contexte vierge : c'est bien la situation du client, qui
    // n'a ni session ni cookie de l'application.
    const contexteClient = await browser.newContext();
    const pageClient = await contexteClient.newPage();
    await pageClient.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });

    assert.ok(
      await pageClient.locator("text=Quelle date vous arrange").isVisible(),
      "la page du client ne présente pas le choix de date"
    );
    assert.strictEqual(
      await pageClient.locator('input[name="choixDate"]').count(),
      3,
      "deux dates proposées et l'option « autre date » devaient être offertes"
    );
    await contexteClient.close();
  });

  await test("le devis envoyé ne peut plus repartir deux fois", async () => {
    const url = await creerChantierFacturable(page, "rejoue");
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.click("text=Envoyer au client");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: DELAI_ECRAN_MS });
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForSelector("text=Devis prêt pour", { timeout: 15000 });

    await page.reload({ waitUntil: "networkidle" });
    assert.strictEqual(
      await page.locator("text=Envoyer au client").count(),
      0,
      "l'envoi est reproposé après rechargement"
    );
  });

  await context.close();
  await browser.close();
  console.log(`\n${passed} réussis, ${failed} échoués`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
