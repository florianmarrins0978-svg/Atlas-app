#!/usr/bin/env node
/*
  Vérifie que la maquette 14 tient ses deux promesses — dans un vrai navigateur.

  **Pourquoi ce contrôle existe.** Le patron a dit trois fois « Je ne peux pas
  ouvrir ça » : les maquettes qui engendraient leurs écrans en JavaScript lui
  rendaient une page blanche, son lecteur n'exécutant pas les scripts. La 14
  promet donc deux choses à la fois, et elles se contredisent en apparence :

    1. **Aucun script**, nulle part — ni dans le fichier, ni dans la page unique
       où il est fondu ;
    2. **ça bouge quand même** : les deux onglets de la proposition 4 changent
       le libellé du bouton, par des cases radio natives et du CSS.

  Une promesse de ce genre ne se relit pas, elle se joue. Et elle doit être
  rejouée après CHAQUE régénération de `toutes-les-maquettes.html` : la fusion
  réécrit les sélecteurs pour confiner les feuilles de style, et c'est
  exactement le geste qui peut casser un `:checked ~ …` sans que rien ne le
  dise.

      node scripts/verifier-maquette-bascule.mjs
*/

import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAQUETTE = join(RACINE, "docs", "maquettes", "14-les-deux-portes.html");
const PAGE_UNIQUE = join(RACINE, "docs", "maquettes", "toutes-les-maquettes.html");

// Chemin propre à cet environnement, utilisé seulement s'il existe : ailleurs,
// Playwright trouve son propre navigateur.
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const problemes = [];
function verifier(quoi, condition) {
  if (condition) console.log(`  ✓ ${quoi}`);
  else {
    console.error(`  ✗ ${quoi}`);
    problemes.push(quoi);
  }
}

/** Le libellé effectivement VISIBLE du bouton, celui que l'œil lit. */
async function libelleVisible(page, selecteurBouton) {
  return page.locator(`${selecteurBouton} span:visible`).first().innerText();
}

async function eprouverLaBascule(page, prefixe, quandOuvert) {
  const bouton = `${prefixe} .bascule:has(#b-dictee) .bouton`;
  verifier(
    `${quandOuvert} — au repos, le bouton dit « Créer le chantier »`,
    (await libelleVisible(page, bouton)).includes("Créer le chantier")
  );

  await page.locator(`${prefixe} label[for="b-main"]`).click();
  verifier(
    `${quandOuvert} — l'onglet « Je l'écris » change le libellé`,
    (await libelleVisible(page, bouton)).includes("Ouvrir le devis")
  );

  const filet = await page.locator(`${prefixe} label[for="b-main"]`).evaluate(
    (e) => getComputedStyle(e).borderBottomColor
  );
  verifier(
    `${quandOuvert} — le filet d'or a glissé sous l'onglet retenu`,
    filet !== "rgba(0, 0, 0, 0)" && filet !== "transparent"
  );

  await page.locator(`${prefixe} label[for="b-dictee"]`).click();
  verifier(
    `${quandOuvert} — on revient en arrière`,
    (await libelleVisible(page, bouton)).includes("Créer le chantier")
  );
}

console.log("\n=== La maquette 14 : aucun script, et ça bouge quand même ===\n");

// ── 1. Aucun script : la promesse qui décide s'il peut l'ouvrir ─────────────
const source = readFileSync(MAQUETTE, "utf8");
verifier("le fichier ne contient AUCUNE balise <script>", !/<script[\s>]/i.test(source));
verifier(
  "il ne contient pas non plus de gestionnaire en attribut (onclick, onload…)",
  !/\son[a-z]+\s*=\s*["']/i.test(source)
);

const executable = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (existsSync(CHEMIN_SANDBOX) ? CHEMIN_SANDBOX : undefined);
const navigateur = await chromium.launch(executable ? { executablePath: executable } : {});

// ── 2. Elle bouge — et elle doit bouger MÊME SANS JAVASCRIPT ────────────────
//
// C'est le cœur : un contrôle joué avec JavaScript actif ne prouverait rien du
// cas qui a coûté trois échanges au patron. On coupe donc les scripts pour de
// bon, comme son lecteur le fait.
const contexte = await navigateur.newContext({ javaScriptEnabled: false, viewport: { width: 1300, height: 1000 } });
const page = await contexte.newPage();

await page.goto(`file://${MAQUETTE}`);
await eprouverLaBascule(page, "body", "fichier seul, JavaScript coupé");

// ── 3. Et encore dans la page unique, où la fusion réécrit les sélecteurs ───
if (existsSync(PAGE_UNIQUE)) {
  await page.goto(`file://${PAGE_UNIQUE}`);
  const section = await page.locator("section:has(.bascule)").count();
  verifier("la maquette 14 est bien présente dans la page unique", section > 0);
  if (section > 0) await eprouverLaBascule(page, "section:has(.bascule)", "page unique");
} else {
  problemes.push("toutes-les-maquettes.html est absente — régénérez-la");
  console.error("  ✗ toutes-les-maquettes.html est absente");
}

await navigateur.close();

if (problemes.length > 0) {
  console.error(`\n❌ ${problemes.length} problème(s).\n`);
  process.exit(1);
}
console.log("\n✅ Maquette 14 : sans script, et la bascule répond — fichier seul et page unique.\n");
