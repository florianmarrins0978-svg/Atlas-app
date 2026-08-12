#!/usr/bin/env node
/*
  Presse les cinq boutons de la facture, comme le patron les pressera.

  **Pourquoi ce script existe.** La maquette 30 est immobile : la regarder
  suffit. La 31 ne vaut que par ce qui se passe quand un doigt se pose — et
  « la page s'ouvre sans erreur » ne dit rien de cela. Un geste mort y serait
  invisible à l'œil : le bouton s'enfonce, et rien ne monte. Trois fois déjà,
  c'est le patron qui a trouvé le défaut d'un outillage livré « prêt »
  (`AGENTS.md`).

  Ce qu'il éprouve, et qui correspond exactement à ce que la page promet :

    1. les cinq boutons existent et sont armés ;
    2. l'appui se VOIT tout de suite — à 140 ms, l'enfoncement est là ;
    3. la messagerie n'est PAS montée à 200 ms — la demi-seconde existe ;
    4. elle EST montée à 900 ms ;
    5. un second appui pendant le geste n'ouvre pas deux fois ;
    6. « Refermer » rend le bouton au repos — sinon on n'essaie qu'une fois,
       et une maquette qu'on n'essaie qu'une fois ne se compare pas ;
    7. sous « mouvement réduit », la messagerie monte TOUT DE SUITE — sinon un
       réglage d'accessibilité passerait pour une lenteur ;
    8. chaque geste bouge quelque chose QUI LUI EST PROPRE. C'est le contrôle
       qui coûte le plus cher à écrire, et le seul qui distingue cinq
       propositions de cinq copies : une faute de frappe dans un sélecteur
       rendrait deux versions identiques, et la planche mentirait au patron
       sans qu'aucun des sept autres contrôles ne bronche.

  Il sait échouer : retirer `.pressee` d'une règle, ou le `setTimeout`, rend
  rouge la version concernée en la nommant.

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
        const corps = el.querySelector(".corps");
        return {
          bon: el.querySelectorAll(".lueur,.sceau,.encre,.rail").length === 0,
          detail: `${el.querySelectorAll(".lueur,.sceau,.encre,.rail").length} ornement(s)`,
          rayon: getComputedStyle(corps).borderTopLeftRadius,
        };
      }),
  },
  B: {
    quoi: "à mi-geste, la lumière est DANS le bouton",
    // **Ce contrôle a d'abord menti, et c'est instructif.** Il exigeait
    // « opacité > 0 et transform ≠ identité » — deux conditions vraies pendant
    // toute l'animation, y compris quand la bande est à cent pour cent hors du
    // bouton. Il est passé au vert sur un geste que l'œil ne voyait jamais :
    // la courbe d'accélération faisait traverser la lumière en soixante
    // millisecondes au milieu, et une capture à 330 ms ne montrait rien.
    // On exige donc que le CŒUR de la bande soit à l'intérieur — c'est-à-dire
    // la seule chose que le patron verra.
    mesurer: (b) =>
      b.evaluate((el) => {
        const lueur = el.querySelector(".lueur");
        if (!lueur) return { bon: false, detail: "aucune lueur dans le bouton" };
        const s = getComputedStyle(lueur);
        const largeur = lueur.getBoundingClientRect().width;
        const m = new DOMMatrixReadOnly(s.transform === "none" ? "" : s.transform);
        const dedans = Math.abs(m.m41) < largeur / 2;
        return {
          bon: Number(s.opacity) > 0 && dedans,
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
        const grains = el.querySelectorAll(".grain").length;
        return { bon: tourne && grains > 0, detail: `${grains} grain(s), ${t}` };
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
        // À mi-geste, elle a commencé sans avoir fini : c'est ce qui distingue
        // un remplissage d'un simple fond posé d'un coup.
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

/** La messagerie de cet écran est-elle montée ? */
const montee = (ecran) =>
  ecran.evaluate((e) => e.querySelector(".feuille").classList.contains("ouverte"));

async function ouvrirPage(calme) {
  const page = await navigateur.newPage({
    viewport: { width: 1400, height: 1000 },
    reducedMotion: calme ? "reduce" : "no-preference",
  });
  await page.goto(`file://${CIBLE}`, { waitUntil: "load" });
  // Les écrans sont engendrés par le script de la page : les attendre, plutôt
  // que de supposer qu'ils sont là. Sans cela le contrôle mesure une page vide
  // et se plaint du mauvais coupable.
  await page.waitForSelector("[data-essai]", { timeout: 10_000 });
  return page;
}

// ─── 1. Le geste, version par version ───────────────────────────────────────
{
  const page = await ouvrirPage(false);
  const boutons = page.locator("[data-essai]");
  const nombre = await boutons.count();
  dire(nombre === 5, `${nombre} bouton(s) pressable(s) — cinq attendus`);

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
      await bouton.evaluate((el) => el.classList.contains("pressee")),
      `${lettre} — l'enfoncement est là à 140 ms`,
    );

    // 3. La demi-seconde existe.
    await attendre(60);
    dire(!(await montee(ecran)), `${lettre} — la messagerie n'est pas encore montée à 200 ms`);

    // 8. Et ce que cette version-là promet, elle le fait — mesuré À MI-GESTE,
    // pas au premier instant. C'est là que l'œil regarde, et c'est là qu'un
    // geste creux se voit : à 140 ms, toutes les animations viennent de
    // commencer et n'importe quoi passerait pour vivant.
    await attendre(MI_GESTE - 200);
    if (!attendu) {
      dire(false, `${lettre} — version inconnue du contrôle : il faut l'y décrire`);
    } else {
      const m = await attendu.mesurer(bouton);
      dire(m.bon, `${lettre} — ${attendu.quoi} (${m.detail})`);
    }

    // 5. Un second appui pendant le geste ne compte pas double.
    await bouton.click({ force: true });

    // 4. Puis elle monte.
    await attendre(900 - MI_GESTE);
    dire(await montee(ecran), `${lettre} — la messagerie est montée à 900 ms`);
    dire(
      (await page.locator(".feuille.ouverte").count()) === 1,
      `${lettre} — une seule messagerie ouverte, malgré le second appui`,
    );
    dire((await bouton.innerText()).trim() === motAvant, `${lettre} — le libellé n'a pas changé`);

    // 6. Et l'on peut réessayer.
    await ecran.locator("[data-refermer]").click();
    await attendre(120);
    dire(
      !(await montee(ecran)) && !(await bouton.evaluate((el) => el.classList.contains("pressee"))),
      `${lettre} — « Refermer » rend le bouton au repos`,
    );
  }
  await page.close();
}

// ─── 1 bis. La lumière de B est-elle visible ASSEZ LONGTEMPS ? ──────────────
//
// **Le contrôle d'à côté a menti deux fois, et il faut comprendre pourquoi.**
// Première version : « opacité > 0 et transform ≠ identité » — vrai pendant
// toute l'animation, y compris la bande entièrement hors du bouton. Deuxième
// version : « le cœur de la bande est dedans à mi-geste » — vrai aussi de la
// version fautive, qui se trouvait passer par là au bon instant.
//
// Ce qu'aucune des deux ne mesurait, c'est la seule chose qui compte : COMBIEN
// DE TEMPS l'œil peut voir la lumière. Avec une courbe d'accélération, elle
// franchissait le bouton en quatre-vingts millisecondes au milieu du geste —
// mécaniquement irréprochable, et invisible. Une capture à 200 ms la montrait,
// une à 330 ms ne montrait plus rien : c'est ainsi qu'on l'a découvert, en
// REGARDANT, pas en mesurant.
//
// On échantillonne donc la position tout au long du geste et on compte le temps
// passé à l'intérieur. Un balayage se lit à vitesse constante, comme la lumière
// sur une laque qu'on incline.
{
  const VISIBLE_MINIMUM_MS = 180;
  const PAS_MS = 40;
  const page = await ouvrirPage(false);
  const bouton = page.locator("[data-essai]").nth(1); // B
  await bouton.click();
  let dedans = 0;
  for (let t = 0; t < 620; t += PAS_MS) {
    const y = await bouton.evaluate((el) => {
      const lueur = el.querySelector(".lueur");
      if (!lueur) return null;
      const s = getComputedStyle(lueur);
      if (Number(s.opacity) === 0) return null;
      const m = new DOMMatrixReadOnly(s.transform === "none" ? "" : s.transform);
      return Math.abs(m.m41) < lueur.getBoundingClientRect().width / 2;
    });
    if (y) dedans += PAS_MS;
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
  dire(
    await montee(ecran),
    "sous « mouvement réduit », la messagerie monte tout de suite",
  );
  await page.close();
}

// ─── 3. « Presser les cinq » les presse vraiment tous ───────────────────────
{
  const page = await ouvrirPage(false);
  await page.locator("[data-rejouer]").click();
  await attendre(800);
  const ouvertes = await page.locator(".feuille.ouverte").count();
  dire(ouvertes === 5, `« Presser les cinq » en ouvre ${ouvertes} sur 5`);
  await page.locator("[data-tout-refermer]").click();
  await attendre(150);
  dire(
    (await page.locator(".feuille.ouverte").count()) === 0,
    "« Tout refermer » referme les cinq",
  );
  await page.close();
}

await navigateur.close();

if (plaintes.length) {
  console.log(`\n✗ ${plaintes.length} défaut(s) :`);
  for (const p of plaintes) console.log(`   — ${p}`);
  process.exit(1);
}
console.log("\n✅ Les cinq boutons se pressent, chacun avec son geste, et se rejouent.");
