#!/usr/bin/env node
/*
  Éprouve les cinq attentes de la maquette 42, JAVASCRIPT COUPÉ.

  **Pourquoi « coupé ».** Une maquette s'ouvre n'importe où — un aperçu, une
  visionneuse, une page qui bloque l'exécution. La 31 avait engendré ses écrans
  en JavaScript : chez le patron, page vide, « rien apparaît sur ta maquette ».
  Tout contrôle de maquette tourne donc sans script depuis (`CLAUDE.md`, et
  `verifier-maquette-bouton-facture.mjs` pour le précédent).

  **Ce qu'il mesure, et pourquoi ce n'est pas « y a-t-il une animation ».**
  Le 12 août, un contrôle est passé au vert deux fois sur une lumière que l'œil
  ne voyait jamais : elle traversait le bouton en quatre-vingts millisecondes.
  Une propriété qui bouge ne prouve rien ; ce qui compte est **de combien** et
  **combien de temps**. Ici, chaque version est donc ÉCHANTILLONNÉE sur une
  seconde et demie, et l'on mesure l'amplitude réelle du déplacement.

  Les huit contrôles :

    1. les six écrans existent et se pressent SANS SCRIPT ;
    2. l'appui remplace le micro par les points — sinon la planche ne montre
       pas ce qu'elle promet ;
    3. TÉMOIN : l'avant ne bouge pas. C'est le contrôle qui garde les autres
       honnêtes — un motif de mesure devenu aveugle passerait au vert sur une
       page entièrement immobile, c'est-à-dire sur le défaut lui-même ;
    4. chaque version bouge d'une amplitude qui se VOIT ;
    5. chacune bouge à sa façon — sans quoi cinq copies passeraient pour cinq
       propositions ;
    6. A et B font une VAGUE, pas trois points qui sautent ensemble : les points
       sont mesurés DÉPHASÉS, ce qui est le mot exact du patron ;
    7. le bouton n'est plus à demi effacé pendant l'attente (et l'avant, lui,
       l'est encore — sans quoi la comparaison ne montrerait rien) ;
    8. sous « mouvement réduit » : plus aucun déplacement, mais la lumière
       respire toujours. Tout couper rendrait le défaut d'origine à qui a activé
       ce réglage.

  Il sait échouer, et c'est vérifié : retirer une règle `@keyframes`, remettre
  `opacity:.5` sur le bouton, ou aligner les délais des trois points rend rouge
  la version concernée EN LA NOMMANT.

  Usage : node scripts/verifier-maquette-points.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "42-les-trois-points-qui-attendent.html"),
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

/** Une seconde et demie : plus long que le plus lent des cycles (1,5 s pour B). */
const DUREE_MESURE_MS = 1500;
const PAS_MS = 40;

/**
 * Suit, image par image, ce que devient chaque point d'un écran.
 *
 * On lit la MATRICE CALCULÉE, jamais une classe : une classe posée sur un
 * élément dont plus aucune règle ne parle est exactement la mort silencieuse
 * qu'on cherche ici (leçon de `verifier-maquette-bouton-facture.mjs`).
 */
async function echantillonner(ecran) {
  const releves = [];
  for (let t = 0; t < DUREE_MESURE_MS; t += PAS_MS) {
    releves.push(
      await ecran.evaluate((e) => {
        const lire = (el) => {
          const s = getComputedStyle(el);
          const m = new DOMMatrixReadOnly(s.transform === "none" ? "" : s.transform);
          return {
            y: m.m42,
            x: m.m41,
            echelle: Math.hypot(m.m11, m.m12),
            angle: (Math.atan2(m.m12, m.m11) * 180) / Math.PI,
            opacite: Number(s.opacity),
          };
        };
        const curseur = e.querySelector(".curseur");
        const anneau = e.querySelector(".anneau");
        return {
          points: [...e.querySelectorAll(".pt, .glyphe")].map(lire),
          curseur: curseur && getComputedStyle(curseur).display !== "none" ? lire(curseur) : null,
          anneau: anneau && getComputedStyle(anneau).display !== "none" ? lire(anneau) : null,
        };
      }),
    );
    await attendre(PAS_MS);
  }
  return releves;
}

const etendue = (valeurs) => Math.max(...valeurs) - Math.min(...valeurs);
/** L'amplitude du premier point, sur toute la mesure. */
const amplitude = (releves, champ, indice = 0) =>
  etendue(releves.map((r) => r.points[indice]?.[champ] ?? 0));

/**
 * Le déphasage : à un instant donné, le premier point et le troisième sont-ils
 * à des hauteurs différentes ?
 *
 * **C'est le contrôle qui dit « vague ».** Trois points qui montent et
 * descendent ENSEMBLE bougent beaucoup, passeraient tous les contrôles
 * d'amplitude, et ne feraient aucune vague — ce serait un clignotement. Le mot
 * du patron était « qu'il fasse des petites vagues » ; c'est ici qu'il est tenu.
 */
const dephasage = (releves) =>
  Math.max(...releves.map((r) => Math.abs((r.points[0]?.y ?? 0) - (r.points[2]?.y ?? 0))));

/** Ce que CHAQUE version doit faire, et qu'aucune autre ne fait pareil. */
const PROPRE_A_CHACUNE = {
  A: {
    quoi: "les points montent d'au moins 3 px, en vague",
    mesurer: (r) => {
      const h = amplitude(r, "y");
      return { bon: h >= 3 && dephasage(r) >= 1.5, detail: `${h.toFixed(1)} px, déphasage ${dephasage(r).toFixed(1)} px` };
    },
  },
  B: {
    quoi: "la houle est plus haute que la vague — au moins 6 px",
    mesurer: (r) => {
      const h = amplitude(r, "y");
      return { bon: h >= 6 && dephasage(r) >= 2, detail: `${h.toFixed(1)} px, déphasage ${dephasage(r).toFixed(1)} px` };
    },
  },
  C: {
    quoi: "les points enflent sans se déplacer",
    mesurer: (r) => {
      const e = amplitude(r, "echelle");
      const h = amplitude(r, "y");
      return { bon: e >= 0.5 && h < 1, detail: `échelle ${e.toFixed(2)}, déplacement ${h.toFixed(1)} px` };
    },
  },
  D: {
    quoi: "un point fait la navette d'au moins 12 px",
    mesurer: (r) => {
      const course = etendue(r.map((x) => x.curseur?.x ?? 0));
      const present = r.every((x) => x.curseur !== null);
      return { bon: present && course >= 12, detail: `${course.toFixed(1)} px de course` };
    },
  },
  E: {
    quoi: "l'anneau tourne, et les points respirent sur place",
    mesurer: (r) => {
      // Un tour complet repasse par le même angle : on mesure le CHEMIN
      // parcouru, pas l'écart entre deux instants.
      let chemin = 0;
      for (let i = 1; i < r.length; i++) {
        const d = Math.abs((r[i].anneau?.angle ?? 0) - (r[i - 1].anneau?.angle ?? 0));
        chemin += d > 180 ? 360 - d : d;
      }
      const souffle = amplitude(r, "opacite");
      const h = amplitude(r, "y");
      return {
        bon: chemin >= 180 && souffle >= 0.4 && h < 1,
        detail: `${Math.round(chemin)}° parcourus, opacité ${souffle.toFixed(2)}`,
      };
    },
  },
};

async function ouvrirPage(calme = false) {
  const contexte = await navigateur.newContext({
    viewport: { width: 1400, height: 1200 },
    reducedMotion: calme ? "reduce" : "no-preference",
    javaScriptEnabled: false,
  });
  const page = await contexte.newPage();
  await page.goto(`file://${CIBLE}`, { waitUntil: "load" });
  return page;
}

// ─── 1. Les six écrans, sans script ─────────────────────────────────────────
{
  const page = await ouvrirPage();
  const boutons = page.locator("[data-essai]");
  const nombre = await boutons.count();
  dire(nombre === 6, `${nombre} bouton(s) pressable(s) SANS SCRIPT — six attendus (l'avant, puis A à E)`);

  // ─── 2. L'appui remplace le micro par les points ──────────────────────────
  for (let i = 0; i < nombre; i++) {
    const ecran = page.locator(".ecran").nth(i);
    const lettre = await ecran.getAttribute("data-variante");
    await boutons.nth(i).click();
    const bascule = await ecran.evaluate((e) => ({
      micro: getComputedStyle(e.querySelector(".signe-micro")).display,
      points: getComputedStyle(e.querySelector(".points")).display,
      mot: e.querySelector(".mot .attente").textContent.trim(),
    }));
    dire(
      bascule.micro === "none" && bascule.points !== "none",
      `${lettre} — l'appui remplace le micro par les points`,
    );
    if (lettre !== "0") {
      dire(bascule.mot.length > 0, `${lettre} — une phrase paraît sous le bouton (« ${bascule.mot} »)`);
    }
  }

  // ─── 3. TÉMOIN : l'avant ne bouge pas ─────────────────────────────────────
  //
  // Sans lui, un motif de mesure devenu aveugle passerait au vert sur une page
  // entièrement immobile — c'est-à-dire sur le défaut qu'on répare.
  {
    const r = await echantillonner(page.locator(".ecran").first());
    const h = amplitude(r, "y");
    const o = amplitude(r, "opacite");
    dire(
      h < 0.5 && o < 0.05,
      `témoin — l'avant est bien IMMOBILE (${h.toFixed(1)} px, opacité ${o.toFixed(2)}) ; s'il bouge, la mesure ment`,
    );
  }

  // ─── 4, 5 et 6. Chacune bouge, à sa façon ─────────────────────────────────
  for (const lettre of ["A", "B", "C", "D", "E"]) {
    const ecran = page.locator(`.ecran[data-variante="${lettre}"]`);
    const releves = await echantillonner(ecran);
    const attendu = PROPRE_A_CHACUNE[lettre];
    const m = attendu.mesurer(releves);
    dire(m.bon, `${lettre} — ${attendu.quoi} (${m.detail})`);
  }

  // ─── 7. Le bouton n'est plus à demi effacé ────────────────────────────────
  {
    const opacites = await page.locator(".ecran").evaluateAll((ecrans) =>
      ecrans.map((e) => ({
        v: e.dataset.variante,
        o: Number(getComputedStyle(e.querySelector(".micro")).opacity),
      })),
    );
    const avant = opacites.find((x) => x.v === "0");
    dire(avant.o <= 0.6, `l'avant garde son demi-effacement (${avant.o}) — sinon la comparaison ne montre rien`);
    for (const { v, o } of opacites.filter((x) => x.v !== "0")) {
      dire(o >= 0.9, `${v} — le bouton reste à pleine encre pendant l'attente (${o})`);
    }
  }

  await page.close();
}

// ─── 8. Mouvement réduit : plus de trajet, mais ça respire encore ───────────
{
  const page = await ouvrirPage(true);
  for (const lettre of ["A", "B", "C", "D", "E"]) {
    const ecran = page.locator(`.ecran[data-variante="${lettre}"]`);
    await ecran.locator("[data-essai]").click();
    const r = await echantillonner(ecran);
    const h = amplitude(r, "y");
    const x = amplitude(r, "x");
    const o = amplitude(r, "opacite");
    dire(
      h < 1 && x < 1 && o >= 0.4,
      `${lettre} — mouvement réduit : aucun trajet (${h.toFixed(1)} / ${x.toFixed(1)} px) mais ça respire (${o.toFixed(2)})`,
    );
  }
  await page.close();
}

await navigateur.close();

if (plaintes.length) {
  console.log(`\n✗ ${plaintes.length} défaut(s) :`);
  for (const p of plaintes) console.log(`   — ${p}`);
  process.exit(1);
}
console.log("\n✅ Les cinq attentes bougent, chacune à sa façon, et l'avant reste immobile.");
