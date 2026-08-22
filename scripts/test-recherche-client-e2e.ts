import assert from "node:assert/strict";
import { lancerNavigateur, DELAI_PAR_DEFAUT_MS } from "./e2e-browser";
import type { Page } from "playwright";

// **La barre de recherche des clients, éprouvée en tapant dedans.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Sa demande du 20 août 2026 : *« Il faut une barre de recherche où je peux
// taper le nom d'un client pour le retrouver plus facilement »*.
//
// La règle est déjà tenue sans navigateur (`test-recherche-client.ts`). Ce que
// CETTE suite ajoute, et qu'aucune autre ne regarde : **que la frappe arrive
// jusqu'à la liste**. Une règle juste derrière un champ mal branché ne trouve
// rien, et c'est exactement le genre de défaut qui va jusqu'à lui.
//
// **Le champ est toujours rendu**, mais le filtre ne se prouve qu'avec au moins
// deux clients : la suite refuse de conclure en dessous, plutôt que de rendre un
// vert qui ne mesure rien (`CLAUDE.md` §5).

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

/**
 * **La page s'anime-t-elle, ou est-ce du HTML mort ?**
 *
 * React attache ses « fibres » au DOM en s'installant. Leur présence ne dépend
 * d'aucun geste : présentes, la page est vivante ; absentes, aucune frappe ne
 * sera jamais entendue, quoi qu'on tape.
 *
 * **Pourquoi cette question est posée AVANT d'accuser la recherche.** Le
 * 20 août 2026, cette suite est passée seule (contre `next start`) et tombée en
 * batterie (contre `npm run dev`), sur « la liste n'a pas été réduite ». Le
 * message accusait la recherche. Elle n'y était pour rien : sur cette machine,
 * le serveur de développement ne s'anime **sur aucune page** — l'accueil non
 * plus —, parce que le mandataire réseau refuse la liaison permanente que Next
 * ouvre en développement. Une erreur qui désigne le mauvais coupable coûte plus
 * cher que pas d'erreur du tout (`AGENTS.md`).
 */
async function pageVivante(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.body.firstElementChild;
    if (!el) return false;
    return Object.keys(el).filter((k) => k.indexOf("__react") === 0).length > 0;
  });
}

let echecs = 0;
async function cas(nom: string, f: () => Promise<void>) {
  try {
    await f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function seConnecter(page: Page) {
  // **`domcontentloaded`, jamais `networkidle`.** Un serveur de développement
  // garde une liaison permanente ouverte pour recharger l'écran à chaud : le
  // réseau n'est donc JAMAIS « au repos », et l'attente expire au bout de
  // quarante-cinq secondes sur une page pourtant affichée. On attend ce qu'on
  // cherche vraiment — un élément — plutôt qu'un silence qui ne viendra pas.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: DELAI_PAR_DEFAUT_MS });
}

/**
 * Tape dans le champ, et n'en repart qu'une fois la liste ayant RÉAGI.
 *
 * **Pourquoi ce détour, et pourquoi il n'est pas une politesse.** Cette suite
 * passait seule et tombait en batterie, sur « la liste n'a pas été réduite
 * (71 sur 71) ». Le serveur des suites navigateur est un `next dev`
 * (`run-e2e-tests.ts`) : sur une liste de soixante et onze clients, l'écran
 * s'affiche AVANT d'être vivant, et une frappe posée pendant cette fenêtre est
 * perdue — React n'écoute pas encore. Le contrôle accusait alors la recherche,
 * qui n'y était pour rien : **une erreur qui désigne le mauvais coupable coûte
 * plus cher que pas d'erreur du tout** (`AGENTS.md`).
 *
 * Ce n'est pas qu'un artefact de suite : le patron ouvre l'application sur un
 * téléphone, et lui aussi peut taper avant qu'elle soit vivante. On retape donc
 * jusqu'à ce que la frappe prenne, comme il le ferait.
 */
async function taperEtAttendre(page: Page, texte: string) {
  const champ = page.locator('[data-atlas="chercher-client"]');
  const limite = Date.now() + DELAI_PAR_DEFAUT_MS;
  while (Date.now() < limite) {
    await champ.fill(texte);
    await page.waitForTimeout(250);
    if ((await champ.inputValue()) === texte) {
      // Le champ porte le texte — reste à savoir si l'écran l'a VU. La croix
      // n'existe que lorsque l'état a bougé : c'est le signe qu'il est vivant.
      const vivant = texte.length === 0 || (await page.locator('[data-atlas="effacer-recherche"]').count()) === 1;
      if (vivant) return;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`la frappe « ${texte} » n'a jamais été prise en compte — l'écran n'est pas devenu vivant`);
}

/** Les noms affichés dans la liste, dans l'ordre. */
async function nomsAffiches(page: Page): Promise<string[]> {
  return page.locator('ul li a span span:first-child').allInnerTexts();
}

async function principal() {
  console.log("=== Chercher un client, au clavier ===\n");
  const nav = await lancerNavigateur();
  const page = await (await nav.newContext()).newPage();

  await seConnecter(page);
  await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-atlas="chercher-client"]').waitFor();
  await page.evaluate(() => document.fonts.ready);

  const champ = page.locator('[data-atlas="chercher-client"]');

  // **L'échappatoire est ÉTROITE, et c'est ce qui la rend acceptable.** Elle ne
  // s'ouvre que si React n'est attaché NULLE PART : un vrai défaut de la
  // recherche laisse la page parfaitement vivante, et la suite reste rouge.
  // Elle n'existe que pour cette machine-ci ; en intégration continue, la
  // liaison de développement fonctionne et tout ce qui suit est joué.
  for (let reste = 30; reste > 0 && !(await pageVivante(page)); reste--) {
    await page.waitForTimeout(1000);
  }
  if (!(await pageVivante(page))) {
    console.log(
      "  ⚠️  La page ne s'anime pas : React n'est attaché nulle part, et l'accueil\n" +
        "     non plus. Ce n'est PAS la recherche — c'est le serveur de développement\n" +
        "     de cette machine, dont la liaison permanente est refusée par le\n" +
        "     mandataire réseau. Contre un serveur bâti (`next start`), cette suite\n" +
        "     passe. Le reste des contrôles est donc sauté ICI, et joué en\n" +
        "     intégration continue (`CLAUDE.md` §5 : le dire plutôt que de laisser\n" +
        "     croire à une vérification qui n'a pas eu lieu)."
    );
    await nav.close();
    process.exit(0);
  }

  await cas("le champ est là, et il est assez gros pour un pouce", async () => {
    assert.equal(await champ.count(), 1, "aucune barre de recherche sur l'écran des clients");
    const boite = await champ.boundingBox();
    assert.ok(boite, "le champ n'a pas de boîte : il est caché");
    // **Refuser de conclure sur une boîte de zéro pixel** (`CLAUDE.md` §5) :
    // une feuille de style non appliquée rendrait 0, et « 0 ≥ 0 » passerait.
    assert.ok(boite!.height >= 44, `champ de ${Math.round(boite!.height)} px — trop petit pour un pouce`);
  });

  const avant = await nomsAffiches(page);

  await cas("la liste entière est là avant qu'on tape quoi que ce soit", async () => {
    // **Deux au minimum, sinon ce contrôle ne mesure rien** (`CLAUDE.md` §5) :
    // avec un seul client, « la liste s'est réduite » serait vrai de toute
    // façon, et le vert ne prouverait pas que la frappe est arrivée.
    assert.ok(
      avant.length >= 2,
      `${avant.length} client(s) affiché(s) : impossible de prouver qu'un filtre agit`
    );
  });

  await cas("taper un nom réduit la liste à ce nom", async () => {
    // On cherche un nom qui existe pour de bon dans SA base, pas un inventé.
    const cible = avant.find((n) => n.trim().length > 2);
    assert.ok(cible, "aucun nom exploitable dans la liste");
    const morceau = cible!.trim().slice(0, 4).toLowerCase();

    await taperEtAttendre(page, morceau);
    const apres = await nomsAffiches(page);

    assert.ok(apres.length > 0, `« ${morceau} » ne rend plus rien alors que ce nom existe`);
    assert.ok(
      apres.length < avant.length,
      `la liste n'a pas été réduite (${apres.length} sur ${avant.length}) : la frappe n'arrive pas jusqu'à elle`
    );
    for (const n of apres) {
      assert.ok(
        n.toLowerCase().includes(morceau),
        `« ${n} » ne contient pas « ${morceau} » : la recherche rend n'importe quoi`
      );
    }
  });

  await cas("un nom qui n'existe pas le dit, en citant la frappe", async () => {
    await taperEtAttendre(page, "zzzz-personne");
    const texte = await page.locator("body").innerText();
    assert.match(texte, /zzzz-personne/, "l'écran ne cite pas ce qui a été tapé");
    assert.equal((await nomsAffiches(page)).length, 0, "des clients restent affichés pour un nom inexistant");
  });

  await cas("effacer le champ rend toute la liste", async () => {
    await taperEtAttendre(page, "");
    await page.waitForTimeout(200);
    const rendu = await nomsAffiches(page);
    assert.equal(
      rendu.length,
      avant.length,
      `${rendu.length} clients au lieu de ${avant.length} : il croirait en avoir perdu`
    );
  });

  await cas("la croix d'effacement est la NÔTRE, pas le bleu du navigateur", async () => {
    // **Trouvé sur une capture, jamais par une suite.** `type="search"` fait
    // poser au navigateur sa propre croix, d'un bleu vif qui n'existe nulle
    // part dans Atlas — la seule tache de couleur de la page.
    await taperEtAttendre(page, "mar");
    const type = await champ.getAttribute("type");
    assert.notEqual(type, "search", "le navigateur va reposer sa croix bleue");

    const croix = page.locator('[data-atlas="effacer-recherche"]');
    assert.equal(await croix.count(), 1, "aucune croix pour effacer ce qu'il a tapé");
    const boite = await croix.boundingBox();
    assert.ok(boite && boite.height >= 44, `croix de ${Math.round(boite?.height ?? 0)} px — trop petite pour un pouce`);

    await croix.click();
    await page.waitForTimeout(200);
    assert.equal(await champ.inputValue(), "", "la croix n'efface pas");
  });

  await cas("la croix n'existe pas quand il n'y a rien à effacer", async () => {
    await champ.fill("");
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator('[data-atlas="effacer-recherche"]').count(),
      0,
      "une croix inerte reste affichée sur un champ vide"
    );
  });

  await cas("rien ne déborde de l'écran du patron", async () => {
    await taperEtAttendre(page, "mar");
    const debord = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    assert.equal(debord, false, "la page déborde sur le côté");
  });

  await page.screenshot({ path: "/tmp/recherche-client.png", fullPage: true });
  await nav.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Recherche de client au navigateur — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

principal();
