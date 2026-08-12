#!/usr/bin/env node
/*
  Éprouve la maquette « Le logo qui s'anime » comme le patron l'éprouvera :
  JAVASCRIPT COUPÉ, en appuyant vraiment sur « Entrer », sur les six écrans.

  **Pourquoi ce contrôle existe.** Une maquette animée peut être entièrement
  fausse et paraître juste sur une capture : il suffit que la case soit cochée
  et que rien ne se passe. Les trois choses qui font la promesse sont vérifiées
  séparément, parce qu'elles cassent séparément :

    1. la marque S'ANIME vraiment pendant la demi-seconde (une animation posée
       sur le mauvais sélecteur ne rend rien, et ça ne se voit pas) ;
    2. on ENTRE ensuite — l'application prend la place de la connexion ;
    3. « ↺ Recommencer » REMET l'écran, sinon la maquette ne s'essaie qu'une
       fois et le patron croit qu'elle est cassée.

  **Et il sait échouer** : sabotez une règle `.pN .go:checked ~ …` et l'écran
  concerné est nommé. Éprouvé en retirant l'animation de la proposition 3.

  Le patron lit ces pages depuis son téléphone, et rien ne garantit qu'un script
  y tournera : d'où le contexte sans JavaScript, qui est la condition réelle.
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
// `file://` exige un chemin absolu : un argument relatif donnait un
// « ERR_INVALID_URL » qui accusait la page au lieu de l'appel.
const PAGES = process.argv.length > 2
  ? process.argv.slice(2).map((p) => resolve(p))
  : [
      join(RACINE, "docs", "maquettes", "33-le-logo-qui-sanime.html"),
      join(RACINE, "docs", "maquettes", "toutes-les-maquettes.html"),
    ];

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});

const plaintes = [];
let eprouves = 0;

/** L'élément qui porte l'animation n'est pas le même selon la proposition. */
async function animationEnCours(prop) {
  return prop.evaluate((racine) => {
    const cibles = racine.querySelectorAll(".sceau, .sceau *, .anneau circle, .feuille path");
    for (const el of cibles) {
      const n = getComputedStyle(el).animationName;
      if (n && n !== "none") return n;
      const apres = getComputedStyle(el, "::after").animationName;
      if (apres && apres !== "none") return apres;
    }
    return "none";
  });
}

for (const cible of PAGES) {
  if (!existsSync(cible)) {
    plaintes.push(`page absente : ${cible}`);
    continue;
  }
  // Le format du patron : c'est là qu'un débordement se voit, et c'est la
  // largeur où il appuiera pour de vrai.
  const contexte = await navigateur.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 664 },
  });
  const page = await contexte.newPage();
  page.on("pageerror", (e) => plaintes.push(`${cible} — script en défaut : ${e.message}`));
  await page.goto("file://" + cible);

  const props = await page.locator(".prop[class*=' p']").all();
  const aRegarder = props.length ? props : await page.locator(".prop").all();
  if (aRegarder.length === 0) plaintes.push(`${cible} — aucune proposition trouvée`);

  for (const [i, prop] of aRegarder.entries()) {
    const nom = (await prop.locator(".legende .titre").first().textContent())?.trim() ?? `n°${i + 1}`;
    const conn = prop.locator(".conn").first();
    const appli = prop.locator(".appli").first();
    const opacite = (l) => l.evaluate((el) => Number(getComputedStyle(el).opacity));

    if ((await opacite(appli)) !== 0) {
      plaintes.push(`${nom} — l'application est visible AVANT qu'on entre`);
    }
    if ((await animationEnCours(prop)) !== "none") {
      plaintes.push(`${nom} — la marque s'anime déjà au repos, avant tout appui`);
    }

    await prop.locator("label.capsule").first().click();

    // Pendant la demi-seconde : quelque chose doit bouger. On regarde tôt, la
    // fenêtre est courte.
    await page.waitForTimeout(150);
    const animation = await animationEnCours(prop);
    if (animation === "none") {
      plaintes.push(`${nom} — RIEN ne s'anime après l'appui : le logo est mort`);
    }

    // Puis on entre. 0,52 s de sortie + 0,34 s d'entrée : une seconde suffit.
    await page.waitForTimeout(1000);
    if ((await opacite(appli)) < 0.95) {
      plaintes.push(`${nom} — on n'entre pas : l'application ne vient pas`);
    }
    if ((await opacite(conn)) > 0.05) {
      plaintes.push(`${nom} — la connexion reste par-dessus l'application`);
    }

    await prop.locator("label.rejouer").first().click();
    await page.waitForTimeout(450);
    if ((await opacite(conn)) < 0.95) {
      plaintes.push(`${nom} — « Recommencer » ne remet pas l'écran : la maquette ne s'essaie qu'une fois`);
    }
    eprouves += 1;
  }

  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  if (deborde) plaintes.push(`${cible} — débordement horizontal sur 390 px`);

  await contexte.close();
}

await navigateur.close();

if (plaintes.length) {
  console.error("❌ La maquette du logo ne tient pas ses promesses :\n  " + plaintes.join("\n  "));
  process.exit(1);
}
console.log(`${eprouves} écrans essayés JavaScript coupé : la marque s'anime, on entre, et « Recommencer » remet l'écran.`);
