#!/usr/bin/env node
/*
  Presse les cinq boutons de la facture, JAVASCRIPT COUPÉ.

  **Pourquoi « coupé », et pourquoi c'est le premier contrôle.** La première
  version de cette maquette engendrait ses cinq téléphones en JavaScript. Elle
  passait ici, dans un navigateur complet ; chez le patron, page vide — « rien
  apparaît sur ta maquette ». Le contrôle d'alors pressait cinq boutons qui,
  pour lui, n'existaient pas.

  Le dépôt avait pourtant déjà payé cette leçon sur les maquettes 25 et 26
  (`verifier-maquette-bascule.mjs`). Une maquette s'ouvre n'importe où — dans
  une visionneuse, un aperçu, une page qui bloque l'exécution : c'est même tout
  son intérêt. **Ce contrôle tourne donc sans script, et un retour au script
  rend la première ligne rouge.**

  Ce qu'il éprouve, et qui correspond exactement à ce que la page promet :

    1. les cinq écrans sont là SANS SCRIPT — c'est le défaut qu'on ne repaiera
       pas ;
    2. l'appui se VOIT tout de suite : à 140 ms, l'enfoncement est là ;
    3. la messagerie n'est PAS montée à 200 ms — la demi-seconde existe ;
    4. elle EST montée à 900 ms ;
    5. un second appui referme, sinon on n'essaie qu'une fois, et une maquette
       qu'on n'essaie qu'une fois ne se compare pas ;
    6. sous « mouvement réduit », la messagerie monte TOUT DE SUITE — sinon un
       réglage d'accessibilité passerait pour une lenteur ;
    7. chaque geste bouge quelque chose QUI LUI EST PROPRE. C'est le contrôle
       qui coûte le plus cher à écrire, et le seul qui distingue cinq
       propositions de cinq copies ;
    8. la lumière de B reste visible ASSEZ LONGTEMPS pour être vue — voir plus
       bas, ce contrôle-là a menti deux fois avant d'être juste.

  Il sait échouer : couper une règle `:checked ~`, ou remettre la course de la
  lueur à ±120 %, rend rouge la version concernée en la nommant.

  Usage : node scripts/verifier-maquette-bouton-facture.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
// `resolve` : un chemin relatif donné en argument produisait « file://docs/… »
// et Playwright répondait « ERR_INVALID_URL » — une erreur qui accuse l'adresse
// là où le fautif est le chemin.
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "31-le-bouton-de-la-facture-a-lessai.html"),
);

if (!existsSync(CIBLE)) {
  console.error(`La maquette n'existe pas : ${CIBLE}`);
  process.exit(1);
}

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});

const plaintes = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) plaintes.push(quoi);
};

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mi-geste : là où l'œil regarde, et là où un geste creux se démasque. */
const MI_GESTE = 260;

/**
 * Ce que CHAQUE version doit faire bouger, en plus de l'enfoncement commun.
 *
 * Sans cela, cinq versions vides passeraient au vert : elles s'enfoncent
 * toutes, et toutes ouvrent la messagerie. Ce qui les sépare — la lumière, le
 * sceau, l'encre, le trait — n'est éprouvé que ci-dessous.
 *
 * On mesure une PROPRIÉTÉ CALCULÉE ou une géométrie, jamais la présence d'une
 * classe : une classe posée sur un élément dont plus aucune règle ne parle est
 * exactement le genre de mort silencieuse qu'on cherche ici.
 */
const PROPRE_A_CHACUNE = {
  A: {
    quoi: "rien d'autre que l'enfoncement — et c'est la proposition",
    // La capsule ne promet rien de plus : on vérifie qu'elle ne s'est pas mise
    // à bouger en douce, ce qui voudrait dire qu'une règle d'une autre version
    // a débordé sur elle.
    mesurer: (b) =>
      b.evaluate((el) => {
        const n = el.querySelectorAll(".lueur,.sceau,.encre,.rail").length;
        return { bon: n === 0, detail: `${n} ornement(s)` };
      }),
  },
  B: {
    quoi: "à mi-geste, la lumière est DANS le bouton",
    mesurer: (b) =>
      b.evaluate((el) => {
        const lueur = el.querySelector(".lueur");
        if (!lueur) return { bon: false, detail: "aucune lueur dans le bouton" };
        const s = getComputedStyle(lueur);
        const largeur = lueur.getBoundingClientRect().width;
        const m = new DOMMatrixReadOnly(s.transform === "none" ? "" : s.transform);
        return {
          bon: Number(s.opacity) > 0 && Math.abs(m.m41) < largeur / 2,
          detail: `décalée de ${Math.round(m.m41)} px sur ${Math.round(largeur)}`,
        };
      }),
  },
  C: {
    quoi: "le sceau tourne, et les grains sont semés",
    mesurer: (b) =>
      b.evaluate((el) => {
        const sceau = el.querySelector(".sceau");
        if (!sceau) return { bon: false, detail: "aucun sceau" };
        const t = getComputedStyle(sceau).transform;
        const tourne = t !== "none" && t !== "matrix(1, 0, 0, 1, 0, 0)";
        // Les grains sont écrits dans la page : leur PRÉSENCE ne prouve rien,
        // seule leur opacité dit qu'ils ont été jetés.
        const vivants = [...el.querySelectorAll(".gerbe i")].filter(
          (g) => Number(getComputedStyle(g).opacity) > 0,
        ).length;
        return { bon: tourne && vivants > 0, detail: `${vivants} grain(s) visible(s)` };
      }),
  },
  D: {
    quoi: "l'encre remplit le fond sous le mot",
    mesurer: (b) =>
      b.evaluate((el) => {
        const encre = el.querySelector(".encre");
        if (!encre) return { bon: false, detail: "aucune encre" };
        const largeur = encre.getBoundingClientRect().width;
        const plein = el.querySelector(".corps").getBoundingClientRect().width;
        return { bon: largeur > 2, detail: `${Math.round(largeur)} / ${Math.round(plein)} px` };
      }),
  },
  E: {
    quoi: "le cheveu d'or s'ouvre depuis le centre",
    mesurer: (b) =>
      b.evaluate((el) => {
        const trait = el.querySelector(".rail i");
        if (!trait) return { bon: false, detail: "aucun trait" };
        return {
          bon: trait.getBoundingClientRect().width > 2,
          detail: `${Math.round(trait.getBoundingClientRect().width)} px`,
        };
      }),
  },
};

/**
 * La messagerie de cet écran est-elle montée ?
 *
 * On mesure sa POSITION, pas une classe : l'état vit désormais dans une case à
 * cocher et le mouvement dans une transition. Une classe n'existe plus, et
 * lire `:checked` dirait seulement que la case est cochée — pas que la feuille
 * est arrivée, ce qui est la seule chose que le patron verra.
 */
const montee = (ecran) =>
  ecran.evaluate((e) => {
    const f = e.querySelector(".feuille").getBoundingClientRect();
    return f.top < e.getBoundingClientRect().bottom - 20;
  });

/** Toutes les pages s'ouvrent SANS SCRIPT : c'est la condition du patron. */
async function ouvrirPage(calme = false) {
  const contexte = await navigateur.newContext({
    viewport: { width: 1400, height: 1000 },
    reducedMotion: calme ? "reduce" : "no-preference",
    javaScriptEnabled: false,
  });
  const page = await contexte.newPage();
  await page.goto(`file://${CIBLE}`, { waitUntil: "load" });
  return page;
}

// ─── 1. Le geste, version par version ───────────────────────────────────────
{
  const page = await ouvrirPage();
  const boutons = page.locator("[data-essai]");
  const nombre = await boutons.count();
  dire(
    nombre === 5,
    `${nombre} bouton(s) pressable(s) SANS SCRIPT — cinq attendus (le défaut du 12 août)`,
  );

  for (let i = 0; i < nombre; i++) {
    const bouton = boutons.nth(i);
    const ecran = page.locator(".ecran").nth(i);
    const lettre = await ecran.getAttribute("data-variante");
    const attendu = PROPRE_A_CHACUNE[lettre];

    // **Le libellé est lu AVANT l'appui, et doit être le même après.** Un
    // bouton dont le mot change en cours de geste raconte deux choses à la fois.
    const motAvant = (await bouton.innerText()).trim();

    await bouton.click();

    // 2. L'appui se voit tout de suite.
    await attendre(140);
    dire(
      await bouton.evaluate((el) => {
        const t = getComputedStyle(el.querySelector(".corps")).transform;
        return t !== "none" && !t.startsWith("matrix(1, 0, 0, 1");
      }),
      `${lettre} — l'enfoncement est là à 140 ms`,
    );

    // 3. La demi-seconde existe.
    await attendre(60);
    dire(!(await montee(ecran)), `${lettre} — la messagerie n'est pas encore montée à 200 ms`);

    // 7. Et ce que cette version-là promet, elle le fait — mesuré À MI-GESTE,
    // pas au premier instant : à 140 ms toutes les animations viennent de
    // commencer et n'importe quoi passerait pour vivant.
    await attendre(MI_GESTE - 200);
    if (!attendu) {
      dire(false, `${lettre} — version inconnue du contrôle : il faut l'y décrire`);
    } else {
      const m = await attendu.mesurer(bouton);
      dire(m.bon, `${lettre} — ${attendu.quoi} (${m.detail})`);
    }

    // 4. Puis elle monte.
    await attendre(900 - MI_GESTE);
    dire(await montee(ecran), `${lettre} — la messagerie est montée à 900 ms`);
    dire((await bouton.innerText()).trim() === motAvant, `${lettre} — le libellé n'a pas changé`);

    // 5. Et l'on peut réessayer — par « Refermer », ou en repressant le bouton.
    await ecran.locator(".refermer").click();
    await attendre(500);
    dire(!(await montee(ecran)), `${lettre} — « Refermer » referme`);
  }
  await page.close();
}

// ─── 1 bis. La lumière de B est-elle visible ASSEZ LONGTEMPS ? ──────────────
//
// **Ce contrôle a menti deux fois, et il faut comprendre pourquoi.** Première
// version : « opacité > 0 et transform ≠ identité » — vrai pendant toute
// l'animation, y compris la bande entièrement hors du bouton. Deuxième :
// « le cœur de la bande est dedans à mi-geste » — vrai aussi de la version
// fautive, qui se trouvait passer par là au bon instant.
//
// Ce qu'aucune des deux ne mesurait, c'est la seule chose qui compte : COMBIEN
// DE TEMPS l'œil peut voir la lumière. Avec une courbe d'accélération, elle
// franchissait le bouton en quatre-vingts millisecondes — mécaniquement
// irréprochable, et invisible. On l'a découvert en REGARDANT une capture.
{
  const VISIBLE_MINIMUM_MS = 180;
  const PAS_MS = 40;
  const page = await ouvrirPage();
  const bouton = page.locator("[data-essai]").nth(1); // B
  await bouton.click();
  let dedans = 0;
  for (let t = 0; t < 620; t += PAS_MS) {
    const vue = await bouton.evaluate((el) => {
      const lueur = el.querySelector(".lueur");
      if (!lueur) return null;
      const s = getComputedStyle(lueur);
      if (Number(s.opacity) === 0) return null;
      const m = new DOMMatrixReadOnly(s.transform === "none" ? "" : s.transform);
      return Math.abs(m.m41) < lueur.getBoundingClientRect().width / 2;
    });
    if (vue) dedans += PAS_MS;
    await attendre(PAS_MS);
  }
  dire(
    dedans >= VISIBLE_MINIMUM_MS,
    `B — la lumière reste visible ${dedans} ms (${VISIBLE_MINIMUM_MS} au minimum, sinon l'œil la rate)`,
  );
  await page.close();
}

// ─── 2. Mouvement réduit : tout de suite, sans demi-seconde ─────────────────
{
  const page = await ouvrirPage(true);
  const bouton = page.locator("[data-essai]").first();
  const ecran = page.locator(".ecran").first();
  await bouton.click();
  await attendre(60);
  dire(await montee(ecran), "sous « mouvement réduit », la messagerie monte tout de suite");
  await page.close();
}

// ─── 3. « Presser les cinq » les presse vraiment tous ───────────────────────
{
  const page = await ouvrirPage();
  await page.locator("label[for='tous']").click();
  await attendre(1100);
  const ecrans = page.locator(".ecran");
  let ouvertes = 0;
  for (let i = 0; i < (await ecrans.count()); i++) {
    if (await montee(ecrans.nth(i))) ouvertes++;
  }
  dire(ouvertes === 5, `« Presser les cinq » en ouvre ${ouvertes} sur 5`);

  // Le même bouton rend la main — et son libellé le dit, sinon on ne saurait
  // pas qu'il est devenu autre chose.
  dire(
    (await page.locator("label[for='tous']").innerText()).trim().includes("refermer"),
    "le bouton commun annonce « Tout refermer » une fois pressé",
  );
  await page.locator("label[for='tous']").click();
  await attendre(600);
  let restantes = 0;
  for (let i = 0; i < (await ecrans.count()); i++) {
    if (await montee(ecrans.nth(i))) restantes++;
  }
  dire(restantes === 0, `« Tout refermer » en laisse ${restantes} ouverte(s)`);
  await page.close();
}

await navigateur.close();

if (plaintes.length) {
  console.log(`\n✗ ${plaintes.length} défaut(s) :`);
  for (const p of plaintes) console.log(`   — ${p}`);
  process.exit(1);
}
console.log("\n✅ Les cinq boutons se pressent sans script, chacun avec son geste.");
