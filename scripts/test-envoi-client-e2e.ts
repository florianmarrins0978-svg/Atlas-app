import assert from "node:assert";
import { mkdirSync } from "node:fs";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

// L'envoi du devis au client, vu depuis l'écran du patron (docs/AGENT.md §2.2).
//
// C'est le maillon qui rend tout le reste atteignable : sans lui, la page
// publique de réponse — pourtant complète et testée — n'est joignable par
// aucun chemin réel. Cette suite parcourt donc la chaîne entière, du
// formulaire de création jusqu'au lien que le client ouvrira.

const BASE = "http://localhost:3000";
const CAPTURES = process.env.CAPTURES_E2E ?? "/tmp/captures-atlas";

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
  client: { nom?: string; telephone?: string; email?: string; canal?: "sms" | "email" } = {
    nom: "M. Bernard",
    telephone: "06 12 34 56 78",
  }
) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  if (client.nom) await page.fill('input[placeholder="Bernard"]', client.nom);
  if (client.telephone) await page.fill('input[placeholder="06 12 34 56 78"]', client.telephone);
  if (client.email) await page.fill('input[placeholder="bernard@exemple.fr"]', client.email);
  // Le canal convenu avec le client, quand les deux coordonnées existent : sans
  // lui, rien ne se devine, et c'est exactement le cas de son défaut du 20 août.
  if (client.canal) {
    await page
      .getByRole("button", { name: client.canal === "sms" ? "Par SMS" : "Par e-mail" })
      .click();
  }
  await page.click('[data-atlas="action-dicter"]');
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
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");

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
    await page.getByRole("button", { name: "Annuler l’envoi" }).click();
  });

  await test("le canal se déduit de la seule coordonnée renseignée", async () => {
    const url = await creerChantierFacturable(page, "canalmail", {
      nom: "Mme Dupuis",
      email: "dupuis@exemple.fr",
    });
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: DELAI_ECRAN_MS });

    assert.ok(
      await page.locator("text=Par e-mail au dupuis@exemple.fr").isVisible(),
      "le canal déduit n'est pas celui de la coordonnée saisie"
    );
    await page.getByRole("button", { name: "Annuler l’envoi" }).click();
  });

  await test("LE CANAL DE LA FICHE COMMANDE L'OUVERTURE — e-mail, pas SMS", async () => {
    // **Son défaut du 20 août 2026, reproduit ici** : *« sur la fiche client,
    // j'ai choisi d'envoyer le devis par email. Et lorsque j'ai validé mon
    // devis […] c'est l'application SMS qui s'est ouverte. »*
    //
    // Le client porte les DEUX coordonnées : c'est le cas où rien ne se devine,
    // et où seul l'accord tranche. Deux sources décidaient alors du canal —
    // celle du serveur, relue à l'envoi, et un `?? "sms"` chargé avec la page.
    const url = await creerChantierFacturable(page, "canalchoisi", {
      nom: "Mr. Julien",
      telephone: "0679984514",
      email: "julien@exemple.fr",
      canal: "email",
    });
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", {
      timeout: DELAI_ECRAN_MS,
    });
    await page.locator('button[aria-pressed]').nth(1).click();
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    // L'envoi ramène à L'ACCUEIL depuis le 21 août 2026 (`ARCHITECTURE.md` §140) :
    // c'est lui, le signal. Le lien touché pour lui, LUI, vit sur `document.body`
    // — hors de l'arbre React — et survit donc au changement d'écran ; c'est ce
    // qui permet de le relire ici.
    await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 });

    const porte = page.locator("a[data-transmission-directe]");
    assert.equal(await porte.count(), 1, "l'appui n'a ouvert aucune messagerie");
    const adresse = (await porte.getAttribute("href")) ?? "";
    assert.ok(
      adresse.startsWith("mailto:"),
      `le canal de la fiche est « e-mail » et c'est ${adresse.slice(0, 12)} qui s'ouvre`
    );
    assert.ok(
      decodeURIComponent(adresse).includes("julien@exemple.fr"),
      `le destinataire n'est pas celui de la fiche : ${adresse.slice(0, 80)}`
    );
  });

  await test("le patron ne propose jamais plus de deux dates", async () => {
    const url = await creerChantierFacturable(page, "deuxmax");
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
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
    await page.getByRole("button", { name: "Annuler l’envoi" }).click();
  });

  await test("l'envoi produit un lien que le client peut ouvrir seul", async () => {
    const url = await creerChantierFacturable(page, "cycle");
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: DELAI_ECRAN_MS });

    // Deux dates : c'est le cas qui laisse le client choisir.
    await page.locator('button[aria-pressed]').nth(1).click();
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 }); // L'envoi ramène à L'ACCUEIL depuis le 21 août 2026 : c'est lui, le signal.

    // **L'appui doit ouvrir SA messagerie tout de suite** — sa demande du
    // 18 août 2026 : *« quand je clique sur le bouton envoyer le devis, tout de
    // suite ça m'ouvre l'application, soit SMS soit email […] supprime les
    // étapes qu'il y a entre »*.
    //
    // L'écran touche pour lui un vrai lien, qu'il laisse dans le document :
    // c'est ce qui rend l'adresse LISIBLE ici (`ExportClient.ouvrirLaMessagerie`).
    // Le défaut d'hier — un message ouvert sans destinataire — ne se voyait
    // nulle part ailleurs que dans sa messagerie, c'est-à-dire trop tard.
    //
    // **Ce que ce contrôle ne prouve PAS, et il faut le dire :** qu'iOS honore
    // cette ouverture quand elle suit une réponse du serveur plutôt que le
    // doigt. Aucun navigateur d'ici ne répond pour Safari. C'est pourquoi le
    // bouton de l'écran « Devis prêt » reste en place derrière : si l'ouverture
    // est refusée, le patron retrouve exactement l'écran d'avant.
    const porteDirecte = page.locator("a[data-transmission-directe]");
    assert.equal(
      await porteDirecte.count(),
      1,
      "l'appui sur « Envoyer le devis » n'a ouvert aucune messagerie"
    );
    const adresseDirecte = (await porteDirecte.getAttribute("href")) ?? "";
    // Le numéro sans ses espaces, sinon l'application ouvre un message SANS
    // destinataire et le patron ne le découvre que dans Messages.
    assert.match(
      adresseDirecte,
      /^sms:\d+\?/,
      `destinataire mal formé : ${adresseDirecte.slice(0, 60)}`
    );
    assert.ok(
      decodeURIComponent(adresseDirecte).includes("/devis/"),
      "le message ouvert par l'appui ne porte pas le lien du devis"
    );

    // **On rouvre l'écran du devis parti pour la suite de ce cas.** L'envoi
    // ramène à l'accueil depuis le 21 août 2026 ; le message tout prêt, lui,
    // vit toujours là-bas, et c'est par la carte du chantier qu'il y revient.
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });

    // Le dernier mètre : sans ce bouton, le lien reste à recopier à la main
    // dans un SMS. C'est le geste que l'application doit épargner, et il a
    // manqué jusqu'ici (docs/A-FAIRE.md §5).
    //
    // C'est un LIEN, et non un bouton, depuis le 4 août 2026 : l'adresse
    // `sms:` doit être portée par un attribut `href` pour être lisible dans la
    // page. Le défaut d'avant — un message ouvert sans destinataire — ne se
    // voyait que dans la messagerie du patron, c'est-à-dire trop tard.
    //
    // **« Relancer », et non « Ouvrir le SMS tout prêt » — et c'est juste.** Le
    // libellé dit ce que le geste FAIT (sa règle du 13 août) : on revient ici
    // sur un devis DÉJÀ parti, donc le geste est une relance. Depuis que l'envoi
    // ramène à l'accueil (21 août), c'est même le seul cas où cet écran se voit.
    assert.ok(
      await page.getByRole("link", { name: /Relancer par (SMS|e-mail)/ }).isVisible(),
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
    for (const texte of ["Relancer par SMS", "c'est vous qui l'envoyez"]) {
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
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: DELAI_ECRAN_MS });
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 }); // L'envoi ramène à L'ACCUEIL depuis le 21 août 2026 : c'est lui, le signal.

    // On rouvre le DEVIS : c'est là que se poserait de nouveau « Choisir la
    // date », et c'est donc là qu'il faut vérifier qu'il ne s'y pose plus.
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    assert.strictEqual(
      await page.locator("text=Choisir la date").count(),
      0,
      "l'envoi est reproposé après rechargement"
    );
  });

  // ── Autoriser (ou non) une autre date — sa demande du 17 août 2026 ────────
  //
  // *« Il faut que l'utilisateur puisse choisir AVANT D'ENVOYER s'il autorise
  // ou non le client à choisir une date si celles proposées ne lui conviennent
  // pas. »* Le contrôle va jusqu'au bout du chemin : l'interrupteur, l'envoi,
  // puis **la page telle que le client la reçoit** — c'est elle qui prouve que
  // le choix a servi à quelque chose.

  await test("l'interrupteur est ouvert par défaut, et le dit", async () => {
    const url = await creerChantierFacturable(page, "porte-ouverte");
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: DELAI_ECRAN_MS });

    const bascule = page.getByRole("switch", { name: /autre date/i });
    assert.ok(await bascule.isVisible(), "l'interrupteur « une autre date » manque avant l'envoi");

    // **Une capture, parce que trois défauts de ce dépôt sont sortis d'une
    // image et d'aucun test** (`CLAUDE.md` §5). Elle ne juge rien ici : elle
    // existe pour être REGARDÉE avant de livrer.
    mkdirSync(CAPTURES, { recursive: true });
    await bascule.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURES}/envoi-autre-date.png` });
    assert.strictEqual(
      await bascule.getAttribute("aria-checked"),
      "true",
      "il doit être ouvert par défaut : c'est ce que l'application faisait jusqu'ici"
    );

    // La phrase sous les dates suit l'interrupteur — sans quoi il enverrait
    // sans savoir ce que son client va voir.
    await bascule.click();
    assert.strictEqual(await bascule.getAttribute("aria-checked"), "false");
    const texte = await page.locator("body").innerText();
    assert.match(
      texte,
      /ne pourra pas en proposer une autre|et rien d'autre/,
      `la phrase ne suit pas l'interrupteur. L'écran dit : ${JSON.stringify(texte.slice(0, 220))}`
    );
    await page.getByRole("button", { name: "Annuler l’envoi" }).click();
  });

  await test("refusé, le client ne voit AUCUN calendrier sur son lien", async () => {
    const url = await creerChantierFacturable(page, "sans-calendrier");
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: DELAI_ECRAN_MS });

    await page.getByRole("switch", { name: /autre date/i }).click();
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 }); // L'envoi ramène à L'ACCUEIL depuis le 21 août 2026 : c'est lui, le signal.

    // On revient sur l'écran du devis parti, comme par la carte du chantier :
    // c'est lui qui porte le message tout prêt, et il ne s'affiche plus seul.
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });

    // **Décodé d'abord** : le lien voyage dans le corps d'un `sms:`, donc
    // encodé (`%2Fdevis%2F`). Cherché tel quel, on ne le trouve jamais — et le
    // contrôle accuse l'envoi de ne pas produire de lien.
    const adresseMessage = decodeURIComponent(
      (await page.locator("a[data-transmission]").getAttribute("href")) ?? ""
    );
    const debut = adresseMessage.indexOf("/devis/");
    assert.ok(debut >= 0, `aucun lien de devis dans le message : ${adresseMessage.slice(0, 90)}`);
    const chemin = adresseMessage.slice(debut).split(/\s/)[0];

    // La page du client, ouverte sans session — comme lui l'ouvrira.
    const sansCompte = await browser.newContext();
    const pageClient = await sansCompte.newPage();
    await pageClient.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
    const vu = await pageClient.locator("body").innerText();
    assert.match(vu, /Quelle date vous arrange/, `la page du client ne s'est pas ouverte : ${vu.slice(0, 200)}`);
    assert.doesNotMatch(
      vu,
      /une autre date|autre date/i,
      "le client peut encore demander une autre date alors que l'artisan l'a refusé"
    );
    assert.strictEqual(
      await pageClient.locator('input[name="choixDate"][value="autre"]').count(),
      0,
      "le choix « autre » existe encore dans le formulaire : il se rejouerait à la main"
    );
    await sansCompte.close();
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
