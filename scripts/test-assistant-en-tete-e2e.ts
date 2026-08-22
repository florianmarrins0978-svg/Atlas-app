import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";

const BASE = "http://localhost:3000";

/*
  L'assistant a quitté le coin flottant pour l'en-tête.

  **Sa demande du 13 août 2026 :** *« l'onglet de l'assistant est hyper mal
  placé, propose des choses pour plus qu'il gêne »*, puis, devant les cinq
  propositions de `docs/maquettes/47-ou-mettre-l-assistant.html` : *« la B mais
  de la même couleur qu'elle est déjà »*.

  **Ce que cette suite tient, et pourquoi chaque point a coûté quelque chose :**

    1. **il ne recouvre RIEN.** C'est toute la demande, et c'est mesurable :
       aucune boîte cliquable ne croise la sienne. Le voile plein écran de la
       feuille est écarté — il croise tout par construction, y compris
       lui-même ;
    2. **il ne flotte plus.** Mesuré par sa position calculée : un `fixed`
       revenu en douce recouvrirait de nouveau, et rien d'autre ne le dirait ;
    3. **aucun titre ne se casse en deux.** C'est le risque connu de cette
       place : sur la fiche chantier, une pastille posée à côté du titre lui
       prenait la moitié de la largeur (11 août 2026) ;
    4. **il ne prend pas une ligne à lui.** Ce contrôle-là existe parce que la
       première version a échoué ici : le bouton avait été posé au-dessus du
       titre, ce qui ajoutait 72 px en tête de CHAQUE écran et poussait la
       dernière semaine du mois sous la barre du bas. On aurait échangé deux
       jours recouverts contre une semaine hors de l'écran.

       **Il mesurait ces pixels-là jusqu'au 21 août 2026** — « la dernière case
       du mois finit au-dessus de 626 px » —, et le planning refait l'a fait
       rougir sur une demande exaucée. Relever le nombre l'aurait fait suivre
       l'écran au lieu de le tenir : il mesure donc que le bouton PARTAGE la
       ligne du titre, ce qui est le défaut d'origine et ne dépend de rien
       d'autre ;
    5. **il ouvre et referme**, sinon la place ne vaut rien.

  Elle sait échouer : rendre le bouton `fixed` en bas à droite rougit les points
  1 et 2 ; le poser sur une ligne à lui rougit le point 4, en donnant les deux
  bandes qui ne se croisent plus.
*/

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Les écrans de la barre du bas : ceux qu'il traverse toute la journée. */
const ECRANS = [
  { nom: "l'accueil", url: "/" },
  { nom: "le planning", url: "/planning" },
  { nom: "les terminés", url: "/termines" },
  { nom: "les réglages", url: "/reglages" },
];

async function main() {
  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext()).newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  for (const ecran of ECRANS) {
    await page.goto(`${BASE}${ecran.url}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('button[aria-label="Ouvrir l\'assistant"]', { timeout: 20_000 });

    const releve = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((e) =>
        /assistant/i.test(e.getAttribute("aria-label") ?? ""),
      )!;
      const r = b.getBoundingClientRect();

      // Ce qu'il croise. **Le voile de la feuille est écarté** : `inset-0`
      // couvre l'écran entier, il croise donc tout, y compris le bouton — le
      // compter ferait rougir ce contrôle sur un élément qui ne gêne personne.
      const gene = [...document.querySelectorAll("a,button")]
        .filter((e) => e !== b)
        .filter((e) => {
          const j = e.getBoundingClientRect();
          const pleinEcran = j.width >= innerWidth - 1 && j.height >= innerHeight - 1;
          if (pleinEcran || j.width === 0) return false;
          return !(j.right <= r.left || j.left >= r.right || j.bottom <= r.top || j.top >= r.bottom);
        })
        .map((e) => (e.textContent ?? "").trim().slice(0, 30) || e.getAttribute("aria-label") || "?");

      const titre = document.querySelector("h1")!;
      const lignes = Math.round(
        titre.getBoundingClientRect().height / parseFloat(getComputedStyle(titre).lineHeight),
      );

      return {
        boite: { l: Math.round(r.width), h: Math.round(r.height) },
        flottant: getComputedStyle(b).position === "fixed",
        gene,
        titre: (titre.textContent ?? "").trim(),
        lignes,
      };
    });

    await cas(`${ecran.nom} — l'assistant ne recouvre rien`, async () => {
      assert.deepStrictEqual(
        releve.gene,
        [],
        `il croise ${releve.gene.length} élément(s) touchable(s) : ${releve.gene.join(", ")}`,
      );
    });

    await cas(`${ecran.nom} — il ne flotte plus au-dessus du contenu`, async () => {
      assert.ok(
        !releve.flottant,
        "le bouton est redevenu `fixed` : il recouvrira de nouveau, sur cet écran et sur les autres",
      );
      assert.ok(
        releve.boite.l >= 44 && releve.boite.h >= 44,
        `il ne fait que ${releve.boite.l} × ${releve.boite.h} px, sous les 44 px d'un doigt`,
      );
    });

    await cas(`${ecran.nom} — « ${releve.titre} » tient sur une ligne`, async () => {
      assert.strictEqual(
        releve.lignes,
        1,
        `le titre s'est cassé en ${releve.lignes} lignes : le bouton lui prend sa largeur`,
      );
    });
  }

  // ─── L'assistant n'a pas pris une ligne à lui ─────────────────────────────
  //
  // **Ce contrôle défend une RÈGLE, plus un nombre de pixels — et il a changé
  // pour cela le 21 août 2026.** Il mesurait « la dernière case du mois finit
  // au-dessus de 626 px », relevé sur l'écran d'alors. Le patron a fait refaire
  // le planning (planche 84) : le calendrier a des cases de 44 px, un bandeau
  // de navigation et une légende — il finit forcément plus bas, sur un écran
  // qu'il a lui-même choisi. Le contrôle rougissait donc sur une demande
  // exaucée (`CLAUDE.md` §5 bis), et il n'aurait plus rien défendu une fois le
  // nombre relevé à 660 : il aurait suivi l'écran au lieu de le tenir.
  //
  // **Ce qui était vraiment en jeu**, et qui ne dépend d'aucun calendrier : le
  // bouton posé sur une ligne à LUI ajoutait 72 px en tête de CHAQUE écran. On
  // vérifie donc qu'il partage sa ligne avec le titre — c'est exactement le
  // défaut d'origine, et cela reste vrai quel que soit ce qu'il y a dessous.
  for (const ecran of ECRANS) {
    await page.goto(`${BASE}${ecran.url}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('button[aria-label="Ouvrir l\'assistant"]', { timeout: 20_000 });
    await cas(`${ecran.nom} — l'assistant partage la ligne du titre`, async () => {
      const m = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((e) =>
          /assistant/i.test(e.getAttribute("aria-label") ?? ""),
        )!;
        const titre = document.querySelector("h1");
        if (!titre) return null;
        const rb = b.getBoundingClientRect();
        const rt = titre.getBoundingClientRect();
        return {
          bouton: [Math.round(rb.top), Math.round(rb.bottom)],
          titre: [Math.round(rt.top), Math.round(rt.bottom)],
          // Se croisent-ils verticalement ? Deux bandes se croisent dès que
          // l'une commence avant que l'autre ne finisse.
          memeLigne: rb.top < rt.bottom && rt.top < rb.bottom,
        };
      });
      assert.ok(m, "aucun titre h1 sur cet écran : le repère du contrôle a disparu");
      assert.ok(
        m.memeLigne,
        `le bouton (${m.bouton.join("–")} px) ne croise pas le titre (${m.titre.join("–")} px) : ` +
          "il a repris une ligne à lui, et ajoute sa hauteur en tête de chaque écran",
      );
    });
  }

  // ─── Il ouvre, et il referme ──────────────────────────────────────────────
  await cas("l'assistant s'ouvre et se referme", async () => {
    await page.click('button[aria-label="Ouvrir l\'assistant"]');
    await page.waitForSelector('button[aria-label="Fermer"]', { timeout: 10_000 });
    await page.click('button[aria-label="Fermer"]');
    await page.waitForSelector('button[aria-label="Ouvrir l\'assistant"]', { timeout: 10_000 });
  });

  await navigateur.close();

  if (echecs > 0) {
    console.error(`\n${echecs} défaut(s) sur la place de l'assistant.`);
    process.exit(1);
  }
  console.log("\n✅ L'assistant est dans l'en-tête, et ne recouvre plus rien.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
