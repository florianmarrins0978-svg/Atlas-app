#!/usr/bin/env node
/*
  Vérifie que les bascules des maquettes tiennent leurs deux promesses — dans un
  vrai navigateur, et JavaScript coupé.

  **Pourquoi ce contrôle existe.** Le patron a dit trois fois « Je ne peux pas
  ouvrir ça » : les maquettes qui engendraient leurs écrans en JavaScript lui
  rendaient une page blanche, son lecteur n'exécutant pas les scripts. Les
  maquettes 14 et 15 promettent donc deux choses qui paraissent se contredire :

    1. **Aucun script**, nulle part — ni dans le fichier, ni dans la page unique
       où il est fondu ;
    2. **ça bouge quand même** : le choix change le libellé du bouton, par des
       cases radio natives et du CSS.

  Une promesse de ce genre ne se relit pas, elle se joue. Et elle doit être
  rejouée après CHAQUE régénération de `toutes-les-maquettes.html` : la fusion
  réécrit les sélecteurs pour confiner les feuilles de style, et c'est
  exactement le geste qui peut casser un `:checked ~ …` sans que rien ne le dise.

      node scripts/verifier-maquette-bascule.mjs

  **Le contrôle est générique, à dessein.** Il ne connaît aucune déclinaison :
  il cherche les blocs marqués `data-bascule`, y trouve deux étiquettes et les
  mots du bouton marqués `data-mot`. Une septième déclinaison ajoutée demain
  est donc éprouvée sans qu'on touche à ce fichier — et une déclinaison qui
  oublierait ses marques serait simplement absente du compte, d'où le contrôle
  du NOMBRE attendu plus bas.
*/

import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAQUETTES = join(RACINE, "docs", "maquettes");
const PAGE_UNIQUE = join(MAQUETTES, "toutes-les-maquettes.html");

// Le nombre de bascules attendu par fichier. Sans lui, retirer une déclinaison
// — ou oublier de la marquer — rendrait un contrôle vert sur un fichier amputé.
const ATTENDU = [
  { fichier: "14-les-deux-portes.html", bascules: 2 },
  { fichier: "15-la-bascule-affinee.html", bascules: 6 },
  { fichier: "17-le-bouton.html", bascules: 8 },
];

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

/**
 * Le mot effectivement LU sur le bouton.
 *
 * Deux mécaniques coexistent — la 14 masque (`display:none`), la 15 fond en
 * opacité — et un `:visible` de Playwright ne distingue pas la seconde : un
 * élément à `opacity:0` lui reste « visible ». On regarde donc le style calculé,
 * qui est la seule source qui dise ce que l'œil voit.
 */
async function lireMot(bloc) {
  return bloc.evaluate((e) => {
    const mots = [...e.querySelectorAll("[data-mot]")].filter((m) => {
      const s = getComputedStyle(m);
      return s.display !== "none" && Number(s.opacity) > 0.5;
    });
    return mots.map((m) => m.textContent.trim()).join(" | ");
  });
}

/**
 * **Le mot lu UNE FOIS LE FONDU FINI — et c'est ce détail qui a d'abord fait
 * accuser six maquettes justes.**
 *
 * La maquette 14 masque son libellé (`display:none`) : le changement est
 * instantané, et lire aussitôt après le clic donnait le bon résultat. La 15
 * fait se croiser deux libellés en opacité sur un quart de seconde — lire
 * aussitôt, c'est lire l'état d'AVANT, encore à `opacity:1`. Le contrôle
 * rendait donc six rouges sur un comportement parfaitement correct : la faute
 * était dans la mesure, pas dans le produit.
 *
 * On attend donc que la valeur se stabilise, plutôt que de compter sur une
 * durée écrite en dur — une transition rallongée un jour dans la maquette ne
 * doit pas rendre ce contrôle capricieux.
 */
const PAS_MS = 60;
const STABLE_MS = 420; // au-delà de la plus longue transition des maquettes (320 ms)

async function motLu(bloc) {
  let valeur = null;
  let depuis = 0;
  for (let i = 0; i < 30; i++) {
    const actuel = await lireMot(bloc);
    if (actuel === valeur && actuel !== "") {
      depuis += PAS_MS;
      // **Deux lectures d'affilée ne suffisent PAS, et c'est le piège exact.**
      // Pendant la première moitié du fondu, l'ancien libellé est encore
      // au-dessus de 0,5 : deux lectures identiques y sont la NORME, pas le
      // signe que c'est fini. Une première version de ce contrôle rendait donc
      // six rouges sur six maquettes justes — elle concluait à 120 ms d'une
      // transition qui en dure 260. On exige une valeur tenue plus longtemps
      // que la plus longue transition.
      if (depuis >= STABLE_MS) return actuel;
    } else {
      valeur = actuel;
      depuis = 0;
    }
    await bloc.page().waitForTimeout(PAS_MS);
  }
  return valeur ?? "";
}

/**
 * Joue la bascule sans rien supposer de son état de départ : on force le
 * premier mot, on passe au second, on revient. Une déclinaison qui s'ouvre déjà
 * sur le second état (la « 4 bis » de la maquette 14) est donc éprouvée par le
 * même code que les autres.
 */
async function eprouver(bloc, ou, indice) {
  const etiquettes = bloc.locator("label");
  const combien = await etiquettes.count();
  if (combien < 2) {
    verifier(`${ou} · bascule ${indice} — deux étiquettes attendues`, false);
    return;
  }

  await etiquettes.nth(0).click();
  const premier = await motLu(bloc);

  await etiquettes.nth(1).click();
  const second = await motLu(bloc);
  verifier(`${ou} · bascule ${indice} — le second choix change le mot du bouton`, second !== premier && second !== "");

  await etiquettes.nth(0).click();
  verifier(`${ou} · bascule ${indice} — et l'on revient en arrière`, (await motLu(bloc)) === premier);

  // Un seul mot lisible à la fois : deux libellés superposés tous les deux
  // opaques donneraient une bouillie, et le contrôle ci-dessus ne le verrait pas.
  verifier(`${ou} · bascule ${indice} — un seul libellé se lit à la fois`, !premier.includes(" | "));
}

console.log("\n=== Les bascules des maquettes : aucun script, et ça bouge quand même ===\n");

// ── 1. Aucun script : la promesse qui décide s'il peut l'ouvrir ─────────────
for (const { fichier } of ATTENDU) {
  const source = readFileSync(join(MAQUETTES, fichier), "utf8");
  verifier(`${fichier} — aucune balise <script>`, !/<script[\s>]/i.test(source));
  verifier(
    `${fichier} — aucun gestionnaire en attribut (onclick, onload…)`,
    !/\son[a-z]+\s*=\s*["']/i.test(source)
  );
}

const executable =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (existsSync(CHEMIN_SANDBOX) ? CHEMIN_SANDBOX : undefined);
const navigateur = await chromium.launch(executable ? { executablePath: executable } : {});

// **JavaScript coupé, pour de bon.** Un contrôle joué avec les scripts actifs
// ne prouverait rien du cas qui a coûté trois échanges au patron.
const contexte = await navigateur.newContext({
  javaScriptEnabled: false,
  viewport: { width: 1300, height: 1000 },
});
const page = await contexte.newPage();

// ── 2. Chaque fichier, seul ────────────────────────────────────────────────
let total = 0;
for (const { fichier, bascules } of ATTENDU) {
  await page.goto(`file://${join(MAQUETTES, fichier)}`);
  const blocs = page.locator("[data-bascule]");
  const combien = await blocs.count();
  verifier(`${fichier} — ${bascules} bascule(s) marquée(s)`, combien === bascules);
  for (let i = 0; i < combien; i++) await eprouver(blocs.nth(i), fichier, i + 1);
  total += bascules;
}

// ── 3. Et dans la page unique, où la fusion réécrit les sélecteurs ─────────
if (existsSync(PAGE_UNIQUE)) {
  await page.goto(`file://${PAGE_UNIQUE}`);
  const blocs = page.locator("[data-bascule]");
  const combien = await blocs.count();
  verifier(`page unique — les ${total} bascules ont survécu à la fusion`, combien === total);
  for (let i = 0; i < combien; i++) await eprouver(blocs.nth(i), "page unique", i + 1);
} else {
  verifier("toutes-les-maquettes.html existe — régénérez-la sinon", false);
}

// ── 4. Le banc d'essai : le bouton mène-t-il VRAIMENT au bon endroit ? ─────
//
// **C'est ici que ça peut mentir en silence, et nulle part ailleurs.** Dans la
// maquette 16, le bouton est DEUX liens superposés : celui qu'on lit est le seul
// qui doive recevoir le doigt. Si le lien invisible gardait ses
// `pointer-events`, il continuerait d'intercepter l'appui et le bouton mènerait
// TOUJOURS au même écran — pendant que son libellé, lui, aurait bel et bien
// changé. Un contrôle qui se contenterait de lire le libellé passerait au vert
// sur exactement ce défaut. On appuie donc pour de bon, et on regarde où l'on
// arrive.
const BANC = join(MAQUETTES, "16-banc-dessai-bascule.html");
if (existsSync(BANC)) {
  const source = readFileSync(BANC, "utf8");
  verifier("16-banc-dessai-bascule.html — aucune balise <script>", !/<script[\s>]/i.test(source));
  verifier(
    "16-banc-dessai-bascule.html — aucun gestionnaire en attribut",
    !/\son[a-z]+\s*=\s*["']/i.test(source)
  );

  await page.goto(`file://${BANC}`);
  const choix = page.locator("[data-choix]");
  const combien = await choix.count();
  verifier("banc d'essai — six déclinaisons proposées", combien === 6);

  for (let i = 0; i < combien; i++) {
    const nom = (await choix.nth(i).innerText()).trim();
    await choix.nth(i).click();

    // La zone visible est celle de la déclinaison choisie : une seule à la fois.
    const zone = page.locator("[data-bascule]:visible");
    verifier(`banc · ${nom} — une seule bascule affichée`, (await zone.count()) === 1);

    for (const [rang, attendu] of [
      [0, "#fiche"],
      [1, "#devis"],
    ]) {
      await zone.locator("label").nth(rang).click();
      await motLu(zone); // laisse le fondu finir : le lien du dessus doit avoir pris la main
      await zone.locator(".bouton").click();
      const arrivee = new URL(page.url()).hash;
      verifier(`banc · ${nom} — le bouton mène à ${attendu}`, arrivee === attendu);
      await page.locator(".cible:target .retour").click();
    }
  }
} else {
  verifier("16-banc-dessai-bascule.html existe", false);
}

await navigateur.close();

if (problemes.length > 0) {
  console.error(`\n❌ ${problemes.length} problème(s).\n`);
  process.exit(1);
}
console.log("\n✅ Bascules : sans script, elles répondent — fichiers seuls et page unique.\n");
