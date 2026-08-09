#!/usr/bin/env node
/*
  Parcourt la page unique des maquettes comme le patron la parcourra : clique
  chaque titre du sommaire et vérifie qu'on arrive bien sur l'écran annoncé.

  Pourquoi ce contrôle existe. Les huit maquettes ont d'abord été partagées
  comme huit adresses séparées, avec un sommaire qui pointait dessus — et le
  sommaire ne s'ouvrait pas : une page publiée ne peut pas naviguer ailleurs.
  C'est le patron qui l'a découvert, en cliquant. La page unique répond à ce
  défaut ; ce script est là pour qu'on ne le lui refasse pas découvrir.

  « La page se génère sans erreur » ne prouve rien : il faut cliquer.
*/

import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = process.argv[2] ?? join(RACINE, "docs", "maquettes", "toutes-les-maquettes.html");
const CAPTURES = process.argv[3];

if (!existsSync(CIBLE)) {
  console.error(`La page n'existe pas : ${CIBLE}\nJouez d'abord : node scripts/fusionner-maquettes.mjs`);
  process.exit(1);
}
if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });

// Playwright ne trouve pas toujours son navigateur ici ; le conteneur en
// fournit un, et le désigner évite un « Executable doesn't exist » qui
// enverrait chercher du côté de l'installation plutôt que de la page.
const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });

const plaintes = [];
page.on("console", (m) => {
  if (m.type() === "error") plaintes.push(`erreur de console : ${m.text()}`);
});
page.on("pageerror", (e) => plaintes.push(`script en défaut : ${e.message}`));

await page.goto("file://" + CIBLE);
await page.waitForLoadState("networkidle");

const liens = await page.$$eval("nav.sommaire a.item", (as) =>
  as.map((a) => ({
    href: a.getAttribute("href"),
    titre: a.querySelector(".titre").textContent,
  })),
);
if (liens.length === 0) plaintes.push("le sommaire est vide");

for (const l of liens) {
  if (!l.href?.startsWith("#")) {
    // Le défaut d'origine, précisément : un lien vers l'extérieur ne s'ouvre pas.
    plaintes.push(`« ${l.titre} » pointe vers ${l.href}, pas vers une ancre de la page`);
    continue;
  }
  const ancre = l.href.slice(1);
  if (!(await page.$(`#${ancre}`))) {
    plaintes.push(`« ${l.titre} » vise #${ancre}, qui n'existe nulle part dans la page`);
    continue;
  }
  await page.click(`a.item[href="${l.href}"]`);
  await page.waitForTimeout(700);
  const arrivee = await page.evaluate((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return { haut: Math.round(r.top), hauteur: Math.round(r.height) };
  }, ancre);
  if (Math.abs(arrivee.haut) > 40) {
    plaintes.push(`« ${l.titre} » : après le clic, la section commence à ${arrivee.haut}px du haut`);
  }
  if (arrivee.hauteur < 400) {
    plaintes.push(`« ${l.titre} » : section haute de ${arrivee.hauteur}px — un écran manque`);
  }
  if (CAPTURES) {
    const section = await page.$(`#${ancre}`);
    await section.screenshot({ path: join(CAPTURES, `${ancre}.png`) });
  }
}

// Les chartes ne se sont pas mélangées : deux sections voisines qui partagent
// des noms de classes doivent garder chacune son fond.
const fonds = await page.$$eval("section.etape > .cadre", (cs) =>
  cs.map((c) => ({ id: c.id, fond: getComputedStyle(c).backgroundColor })),
);
for (const f of fonds) {
  if (f.fond === "rgba(0, 0, 0, 0)") {
    plaintes.push(`${f.id} n'a pas de fond : sa feuille de style ne s'est pas appliquée`);
  }
}

const deborde = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
if (deborde > 0) plaintes.push(`la page déborde de ${deborde}px sur la droite`);

await navigateur.close();

if (plaintes.length) {
  console.error("La page des maquettes est en défaut :\n  " + plaintes.join("\n  "));
  process.exit(1);
}
console.log(`${liens.length} titres cliqués, ${fonds.length} sections peintes, aucun débordement.`);
