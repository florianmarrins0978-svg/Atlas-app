import assert from "node:assert";
import { mkdirSync } from "node:fs";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { joursAProposer } from "./_calendrier-e2e";

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
  await creerPuisFiche(page);
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
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: DELAI_ECRAN_MS });

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
    await page.waitForSelector('[data-atlas="invite-dates"]', {
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

  /**
   * Retenir un jour au calendrier — un seul geste depuis le 25 août 2026.
   *
   * *« Je dois pouvoir sélectionner les jours juste en les touchant, pas besoin
   * de cliquer sur proposer. »* Toucher la case OUVRE la fiche — il voit qui
   * est déjà là — et engage la date du même doigt. Écrit une fois ici : deux
   * copies de ce geste finiraient par diverger (`CLAUDE.md` §3).
   *
   * **On n'appuie plus une seconde fois pour refermer** : ce second appui
   * retirerait la date qu'on vient de poser.
   */
  async function retenirAuCalendrier(page: Page, jour: string) {
    await page.locator(`[data-jour="${jour}"]`).click();
    await page
      .locator("text=Vérification de votre planning…")
      .waitFor({ state: "hidden", timeout: 20_000 })
      .catch(() => undefined);
    // La case se peint quand le serveur a dit oui : l'attendre vaut mieux qu'un
    // délai, et rougir ici désigne le bon coupable — le jour a été refusé.
    await page
      .locator(`[data-jour="${jour}"][data-etat="retenu"]`)
      .waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForTimeout(150);
  }

  /**
   * Les jours qu'on peut RETENIR — au besoin en tournant la page du mois.
   *
   * **Une bombe à retardement, désamorcée le 26 août 2026.** Les deux contrôles
   * ci-dessous lisaient le seul mois affiché, qui commence toujours au 1er :
   * passé le 28, les jours restants au-delà du délai minimal (J+3) ne sont plus
   * assez nombreux, et la suite rougissait sur un produit parfaitement sain —
   * chaque fin de mois, et sur `main` comme ailleurs. Elle a été vue rouge ici
   * le 26 août, à deux jours de la fin du mois.
   *
   * Le calendrier sait tourner la page ; la suite doit savoir le faire aussi.
   * Une seule fois suffit : un mois entier porte toujours assez de jours.
   */
  /**
   * **DEUX SESSIONS ONT RÉSOLU LE MÊME DÉFAUT LE MÊME JOUR**, et la fusion du
   * 26 août 2026 a dû choisir.
   *
   * Ce fichier portait `joursRetenables`, écrite ici ; la branche du lot 3
   * portait `joursAProposer`, dans `scripts/_calendrier-e2e.ts`. Les deux
   * tournent la page du mois quand celui-ci est trop entamé. **Les garder
   * toutes les deux aurait été la duplication elle-même** — celle que
   * `CLAUDE.md` §3 interdit, et qui finit toujours par diverger.
   *
   * Ce qui a été retenu, et pourquoi :
   *
   * | | ici | pièce commune |
   * |---|---|---|
   * | portée | une seule suite | **deux suites** |
   * | plancher | `+3` écrit en dur | **`DELAI_MINIMAL_JOURS`**, qui suivra le jour où il changera |
   * | mois consultés | un de plus | jusqu'à trois |
   *
   * **Le nom d'ici SURVIT en délégation** : trois appels le nomment dans ce
   * fichier, et les renommer aurait mêlé une réécriture à une fusion. Ce qui
   * disparaît, c'est la seconde implémentation — jamais un point d'appel.
   */
  async function joursRetenables(page: Page, combien: number): Promise<string[]> {
    return joursAProposer(page, combien);
  }


  await test("le patron ne propose jamais plus de deux dates", async () => {
    const url = await creerChantierFacturable(page, "deuxmax");
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: DELAI_ECRAN_MS });

    // **Le geste passe par le CALENDRIER depuis le 23 août 2026.** La liste des
    // six jours suggérés a été retirée à sa demande — *« les quelques jours
    // qu'on peut sélectionner au tout début ne servent plus à rien, maintenant
    // qu'on a le mois complet »* —, donc `button[aria-pressed]` ne rend plus
    // que les dates DÉJÀ retenues. La règle éprouvée ici, elle, n'a pas
    // changé : jamais plus de deux.
    // Une date est déjà retenue à l'ouverture : on en retient deux de plus, et
    // la troisième doit chasser la première — jamais trois.
    //
    // **La recherche des jours TOURNE LA PAGE DU MOIS si besoin**
    // (`scripts/_calendrier-e2e.ts`). Elle ne relâche rien : la règle éprouvée
    // plus bas — jamais plus de deux dates — est intacte. Ce qui a changé est en
    // amont, et c'est de la matière à mesurer : le mois affiché s'ouvre au 1er,
    // et en fin de mois il ne restait parfois qu'un seul jour ouvrable au-delà
    // du délai minimal. La suite s'arrêtait là, sur un écran parfaitement juste
    // — 57 jours de l'année, mesurés.
    const aRetenir = await joursAProposer(page, 2);
    for (const jour of aRetenir.slice(0, 2)) await retenirAuCalendrier(page, jour);

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
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: DELAI_ECRAN_MS });

    // Deux dates : c'est le cas qui laisse le client choisir. Prise au
    // calendrier, la liste des six ayant disparu le 23 août 2026.
    const offerts = await joursRetenables(page, 1);
    await retenirAuCalendrier(page, offerts[0]);
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
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: DELAI_ECRAN_MS });
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
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: DELAI_ECRAN_MS });

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

  await test("LES PRIX TAPÉS SUR L'ÉCRAN DU DEVIS PARTENT BIEN — son défaut du 23 août", async () => {
    // **Son signalement, et sa correction de ma première explication :** *« le
    // devis part à zéro euro chez la cliente, alors qu'il y a un arbre à tailler
    // et un à démonter »*, puis — quand on lui a répondu que rien n'était
    // chiffré — *« j'avais mis des prix, cinq cent cinquante et je ne sais plus
    // combien, un devis à mille trois cents euros »*.
    //
    // Il avait raison. Ses prix étaient bien en base, dans `lignes_prix`. Ce
    // sont les lignes du DOCUMENT qui manquaient : le devis ne se recomposait
    // qu'au CHARGEMENT de l'écran, et tout prix tapé ensuite restait dehors.
    // Mesuré avant correction : écran à 660 €, document à 0,00 € et zéro ligne.
    //
    // **Rien ne se perdait ; rien n'arrivait.** C'est pourquoi ce cas chiffre
    // SUR l'écran du devis, après son ouverture — la seule façon de le prendre.
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `Prix tardifs ${Date.now()}`);
    await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
    await creerPuisFiche(page);
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
    const url = page.url();

    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Total TTC", { timeout: DELAI_ECRAN_MS });
    await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
    await page.waitForTimeout(900);
    await page.getByLabel("Description 1").fill("Taille d'un chêne");
    await page.getByLabel("Prix unitaire 1").fill("550");
    await page.getByLabel("Description 1").click();
    await page.waitForTimeout(1500);

    await page.click("text=Choisir la date");
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: DELAI_ECRAN_MS });

    // **Le garde-fou du devis vide ne doit PAS se déclencher ici.** Il comptait
    // les lignes du document périmé et refusait un envoi parfaitement légitime :
    // un contrôle qui accuse à tort coûte plus cher que pas de contrôle du tout.
    const avantEnvoi = await page.locator("body").innerText();
    assert.doesNotMatch(
      avantEnvoi,
      /recevrait un document vide/,
      "l'envoi est refusé alors que l'écran affiche 660 € : le garde-fou compte un document périmé"
    );

    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 });

    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    const message = decodeURIComponent(
      (await page.locator("a[data-transmission]").getAttribute("href")) ?? ""
    );
    const debut = message.indexOf("/devis/");
    assert.ok(debut >= 0, `aucun lien de devis dans le message : ${message.slice(0, 90)}`);
    const chemin = message.slice(debut).split(/\s/)[0];

    const sansCompte = await browser.newContext();
    const pageClient = await sansCompte.newPage();
    await pageClient.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
    const vu = await pageClient.locator("body").innerText();
    assert.match(
      vu,
      /660,00\s*€/,
      "La cliente ne voit pas le montant chiffré : le devis lui parvient vide, " +
        `c'est son défaut du 23 août. Elle a sous les yeux : ${JSON.stringify(vu.slice(0, 240))}`
    );
    assert.doesNotMatch(
      vu,
      /Total TTC\s*\n?\s*0,00\s*€/,
      "la cliente reçoit un total à zéro euro"
    );
    await sansCompte.close();
  });

  await test("UN DEVIS VIDE NE PART PAS — son défaut du 23 août", async () => {
    // **Son signalement, mot pour mot :** *« le devis part à zéro euro chez la
    // cliente, alors qu'il y a un arbre à tailler et un à démonter. Rien
    // n'apparaît chez elle. »*
    //
    // Sa cliente avait sous les yeux un document qui n'énonçait RIEN — ni
    // prestation ni prix — et un bouton « J'accepte ce devis » sous ce vide.
    //
    // **La cause n'était pas une perte de données** : les lignes du devis
    // viennent des lignes de PRIX, jamais des prestations. Deux arbres décrits
    // mais jamais chiffrés donnent un devis authentiquement vide. C'est de
    // l'avoir laissé PARTIR qui était le défaut — l'envoi savait refuser un
    // devis absent, un canal non choisi, une coordonnée manquante, jamais un
    // devis sans une seule ligne.
    //
    // On crée donc le chantier SANS passer par les prix : c'est son cas.
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `Devis vide ${Date.now()}`);
    await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
    await creerPuisFiche(page);
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
    const url = page.url();

    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");

    // **Visé sur une phrase qui n'appartient QU'AU REFUS.** Le premier jet
    // attendait « aucune ligne » — or l'écran du devis vide porte déjà « Aucune
    // ligne pour l'instant ». Le contrôle passait donc au vert le garde-fou
    // retiré : il regardait le mauvais texte, et n'aurait jamais pu échouer
    // (`CLAUDE.md` §5).
    await page.waitForSelector("text=recevrait un document vide", { timeout: DELAI_ECRAN_MS });
    const vu = await page.locator("body").innerText();
    assert.match(
      vu,
      /Posez d'abord vos prix/i,
      `le refus ne dit pas où aller poser ses prix : ${JSON.stringify(vu.slice(0, 240))}`
    );

    // **Et le bouton ne doit pas rester actif** : il ne mènerait qu'à envoyer
    // un document vide, ce qui est sans retour une fois chez la cliente.
    const envoyer = page.getByRole("button", { name: "Envoyer le devis" });
    if (await envoyer.count()) {
      assert.strictEqual(
        await envoyer.isEnabled(),
        false,
        "« Envoyer le devis » reste cliquable sur un devis vide : la cliente recevrait zéro euro"
      );
    }
  });

  await test("SANS RIEN TOUCHER, la cliente peut proposer un jour — son défaut du 23 août", async () => {
    // **Son signalement, mot pour mot :** *« je n'ai pas coché la case pour que
    // la cliente ne puisse pas proposer de jour ; néanmoins elle ne peut quand
    // même pas proposer de jour »*.
    //
    // **Ce cas manquait, et c'est tout le sujet.** Le refus était éprouvé depuis
    // cet écran-ci (le cas juste en dessous), et l'autorisation depuis l'ANCIEN
    // écran d'envoi seulement. Or c'est par « Choisir la date » que le patron
    // envoie désormais : le chemin qu'il emprunte tous les jours n'avait aucun
    // contrôle sur la moitié qui l'intéresse — celle où il ne touche à rien.
    //
    // **On ne touche donc à RIEN**, délibérément : pas un appui sur
    // l'interrupteur. C'est la seule façon d'éprouver ce que voit un client
    // quand le patron n'a rien décidé, qui est le cas courant.
    const url = await creerChantierFacturable(page, "porte-restee-ouverte");
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: DELAI_ECRAN_MS });

    // Deux dates, comme sur sa capture — un seul jour proposé change le libellé
    // du choix, et un contrôle qui n'éprouve qu'une forme laisse passer l'autre.
    // Même remède qu'au-dessus, et pour la même raison : trouver deux jours,
    // en tournant la page du mois si celui-ci est trop entamé. Ce qui est
    // éprouvé ensuite — la cliente peut proposer un jour sans que le patron ait
    // rien touché — n'a pas bougé d'un caractère.
    const libres = await joursAProposer(page, 2);
    for (const jour of libres.slice(0, 2)) await retenirAuCalendrier(page, jour);

    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 });

    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    const message = decodeURIComponent(
      (await page.locator("a[data-transmission]").getAttribute("href")) ?? ""
    );
    const debut = message.indexOf("/devis/");
    assert.ok(debut >= 0, `aucun lien de devis dans le message : ${message.slice(0, 90)}`);
    const chemin = message.slice(debut).split(/\s/)[0];

    const sansCompte = await browser.newContext();
    const pageClient = await sansCompte.newPage();
    await pageClient.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
    const vu = await pageClient.locator("body").innerText();

    assert.strictEqual(
      await pageClient.locator('input[name="choixDate"][value="autre"]').count(),
      1,
      "La cliente ne peut PAS proposer de jour alors que le patron n'a rien refusé. " +
        `C'est son défaut du 23 août, et voici ce qu'elle voit : ${JSON.stringify(vu.slice(0, 260))}`
    );
    assert.strictEqual(
      await pageClient.locator('input[name="choixDate"]').count(),
      3,
      "il manque une option : deux dates proposées, plus « j'en propose une autre »"
    );
    await sansCompte.close();
  });

  await test("refusé, le client ne voit AUCUN calendrier sur son lien", async () => {
    const url = await creerChantierFacturable(page, "sans-calendrier");
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: DELAI_ECRAN_MS });

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
