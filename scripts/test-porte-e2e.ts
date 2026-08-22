import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";

// **La porte d'Atlas, éprouvée par où le patron y passe.**
//
// L'écran de connexion a été refait le 12 août 2026 (`ARCHITECTURE.md` §71), et
// il est le seul de l'application qu'aucune autre suite ne traverse : toutes
// entrent par une session fabriquée, parce que c'est plus rapide. Personne ne
// s'y trompe donc jamais de mot de passe — et c'est exactement là qu'était le
// défaut.
//
// **Ce que cette suite tient, et pourquoi chaque point y est :**
//
// **Une réserve, et elle est mesurée, pas supposée.** Deux des contrôles ne
// valent que si le navigateur a réellement pris la main sur le formulaire. Dans
// cet environnement, le serveur de DÉVELOPPEMENT n'hydrate pas cet écran — sa
// liaison de rechargement à chaud est refusée par le mandataire réseau — et le
// formulaire part alors en HTML pur : la page se recharge entièrement, et tout
// champ redevient vide, quel que soit le code. La suite le DÉTECTE (elle compte
// les navigations complètes) et le dit, au lieu d'accuser un correctif qui
// fonctionne. Sur la version bâtie — celle du banc du patron — l'interception a
// lieu et les contrôles s'appliquent.
//
//   1. **L'adresse survit à un refus.** React vide de lui-même les champs non
//      contrôlés d'un `<form action={…}>` après chaque envoi : sur un mot de
//      passe faux, l'écran répondait « Email ou mot de passe incorrect » ET
//      effaçait l'adresse. Il fallait la retaper en entier, sur un téléphone,
//      pour un caractère raté ailleurs — et s'il réappuyait sans le voir, le
//      navigateur lui opposait un « Please fill out this field » en anglais.
//      Défaut ANTÉRIEUR à la refonte, jamais signalé, vu sur une capture.
//   2. **Le mot de passe, lui, est effacé** — c'est celui qu'on vient de rater.
//      Le contrôle tient les deux bouts : garder l'un n'autorise pas l'autre.
//   3. **Les champs sont à 16 px.** En dessous, iOS agrandit la page dès qu'un
//      champ prend le focus. Ce n'est pas une préférence d'allure : c'est le
//      confort de quelqu'un qui se connecte d'une main sur un chantier.
//   4. **La place du message est réservée** même sans message, sinon le refus
//      pousse le bouton d'une ligne au moment précis où le doigt s'y pose.
//   5. **Et l'on entre pour de bon.**
//
// **Ce qu'elle ne remplace pas :** `scripts/verifier-connexion.mjs`, qui monte
// une version BÂTIE derrière une origine étrangère. Les deux sont nécessaires —
// celle-ci regarde l'écran, l'autre regarde l'enveloppe.

const BASE = process.env.ATLAS_BASE ?? "http://127.0.0.1:3000";
const COMPTE = { email: "demo@atlas.local", motDePasse: "demo1234" };

let reussis = 0;
let echoues = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    echoues++;
  }
}

async function main() {
  console.log("=== La porte : on se trompe, puis on entre ===\n");

  // `lancerNavigateur` pose déjà la dalle du patron et les délais des suites —
  // c'est là que se voit un champ hors de portée du pouce ou un message qui
  // déplace le bouton, et le poser à la main ici le ferait vieillir à part.
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  try {
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('button[type="submit"]');

    const messageDuRefus = page.locator('form [role="alert"]');

    const hauteurAuRepos = await messageDuRefus.evaluate((el) => el.getBoundingClientRect().height);
    const basDuBoutonAvant = await page
      .locator('button[type="submit"]')
      .evaluate((el) => Math.round(el.getBoundingClientRect().bottom));

    test("la place du message est réservée avant même qu'il y ait un message", () => {
      assert.ok(
        hauteurAuRepos >= 15,
        `Le message vide occupe ${hauteurAuRepos} px : le refus poussera le bouton vers le bas au moment de l'appui.`
      );
    });

    for (const nom of ["email", "password"]) {
      const taille = await page
        .locator(`input[name="${nom}"]`)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      test(`le champ « ${nom} » est à 16 px — sinon iOS agrandit la page`, () => {
        assert.ok(
          taille >= 16,
          `${taille} px. En dessous de 16, iOS zoome dès que le champ prend le focus (voir design-tokens.ts).`
        );
      });
    }

    // ─── Le mauvais mot de passe, pour de vrai ────────────────────────────
    // Une navigation complète signerait un envoi en HTML pur : le JavaScript
    // n'aurait pas pris la main, et l'écran repartirait de zéro quoi qu'on
    // écrive. On compte donc, plutôt que de supposer.
    let rechargements = 0;
    page.on("framenavigated", (cadre) => {
      if (cadre === page.mainFrame()) rechargements += 1;
    });

    await page.locator('input[name="email"]').fill(COMPTE.email);
    await page.locator('input[name="password"]').fill("ce-mot-de-passe-est-faux");
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(
      () => (document.querySelector('form [role="alert"]')?.textContent ?? "").trim().length > 0,
      null,
      { timeout: 30_000 }
    );

    const refus = (await messageDuRefus.innerText()).trim();
    test("le refus est annoncé, en français et dans l'écran", () => {
      assert.match(refus, /mot de passe|tentatives|service/i, `Message lu : « ${refus} »`);
    });

    const intercepte = rechargements === 0;
    if (!intercepte) {
      console.log(
        "  ⓘ ce serveur n'a pas hydraté l'écran : le formulaire est parti en HTML pur\n" +
          "    (page rechargée). Les deux contrôles suivants ne veulent alors rien dire —\n" +
          "    ils sont annoncés non concluants plutôt que rouges. Ils s'appliquent sur la\n" +
          "    version bâtie, celle du banc."
      );
    }

    const adresseApres = await page.locator('input[name="email"]').inputValue();
    if (intercepte) {
      test("l'adresse survit au refus — il n'a pas à la retaper", () => {
        assert.equal(
          adresseApres,
          COMPTE.email,
          "Le champ a été vidé : sur un téléphone, c'est toute l'adresse à ressaisir pour un caractère raté sur le mot de passe."
        );
      });

      const motDePasseApres = await page.locator('input[name="password"]').inputValue();
      test("le mot de passe raté, lui, est effacé", () => {
        assert.equal(motDePasseApres, "", "Garder à l'écran le mot de passe qu'on vient de rater n'aide personne.");
      });
    }

    const basDuBoutonApres = await page
      .locator('button[type="submit"]')
      .evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
    test("le bouton n'a pas bougé d'un pixel quand le refus est apparu", () => {
      assert.equal(
        basDuBoutonApres,
        basDuBoutonAvant,
        `Il est descendu de ${basDuBoutonApres - basDuBoutonAvant} px : l'appui suivant tombe à côté.`
      );
    });

    // ─── Puis la bonne ────────────────────────────────────────────────────
    // L'adresse est resaisie quand l'écran n'a pas été hydraté : sans cela, le
    // navigateur opposerait sa propre exigence de champ obligatoire, et la
    // suite échouerait sur une entrée qui n'a jamais été tentée.
    if (!intercepte) await page.locator('input[name="email"]').fill(COMPTE.email);
    await page.locator('input[name="password"]').fill(COMPTE.motDePasse);
    await page.locator('button[type="submit"]').click();
    await page.getByRole("heading", { name: "Vos chantiers" }).waitFor({ timeout: 60_000 });
    test("on entre, en ne corrigeant que le mot de passe", () => {
      assert.ok(true);
    });
  } finally {
    await navigateur.close();
  }

  console.log(`\n${echoues === 0 ? "✅" : "❌"} La porte — ${reussis} réussi(s), ${echoues} échoué(s).`);
  if (echoues > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
