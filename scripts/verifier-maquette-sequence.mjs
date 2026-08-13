#!/usr/bin/env node
/*
  Parcourt la séquence entière de la maquette 43, téléphone par téléphone, et
  JAVASCRIPT COUPÉ : appuyer sur le micro, arrêter, regarder bouger, recommencer.

  **Pourquoi parcourir plutôt que constater.** La 40 montrait l'attente ; la 41
  la fait JOUER, et c'est le patron qui appuie. Éprouver l'état d'arrivée sans
  jouer les deux appuis, ce serait éprouver une planche qu'il n'atteindra
  peut-être jamais — un parcours à moitié joué ne prouve que la moitié qu'on
  joue (`HANDOVER.md`, le calendrier à deux dates).

  Ce qu'il éprouve :

    1. les six téléphones existent SANS SCRIPT, au repos, micro visible ;
    2. premier appui : le bouton devient rouge, bat, et l'écran dit « j'écoute » ;
    3. second appui : les points prennent la place, et la phrase avec ;
    4. ils BOUGENT, chacun de sa façon — l'avant, lui, reste immobile ;
    5. « Recommencer » ramène vraiment au départ, sinon on n'essaie qu'une fois ;
    6. sans le réglage, aucun résultat n'arrive : la boucle est bien la boucle ;
    7. avec, les champs se remplissent APRÈS 4 s et pas avant, et le micro revient ;
    8. sous « mouvement réduit » : plus de trajet, mais ça respire encore.

  Il sait échouer : retirer une règle `:nth-of-type`, aligner les délais des
  points ou reculer le retard du résultat rend rouge le téléphone concerné, en
  le nommant.

  Usage : node scripts/verifier-maquette-sequence.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "43-l-attente-a-lessai.html"),
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

/**
 * **Le bouton d'arrêt BAT, et Playwright refuse d'appuyer sur ce qui bouge.**
 *
 * Son contrôle d'« actionnabilité » attend qu'un élément soit stable — ce qui
 * n'arrive jamais avec une animation infinie : trente secondes d'attente, puis
 * un échec qui accuse le sélecteur alors que le bouton est là, visible, sous le
 * curseur. Même famille de piège que `locator.screenshot()`, qui photographie
 * toujours l'après d'un geste (leçon du 12 août).
 *
 * On force donc l'appui. Ce qu'on perd — la vérification que l'élément est
 * visible et atteignable — est justement ce que `etat()` affirme à la ligne
 * d'avant : rien n'est abandonné, c'est seulement mesuré ailleurs.
 */
const APPUI = { force: true };

const LETTRES = ["0", "A", "B", "C", "D", "E"];
const DUREE_MESURE_MS = 1560;
const PAS_MS = 40;

/** Ce que l'écran montre, à cet instant : trois états, une seule vérité. */
const etat = (ecran) =>
  ecran.evaluate((e) => {
    const vu = (sel) => {
      const el = e.querySelector(sel);
      return el ? getComputedStyle(el).display !== "none" : false;
    };
    const phrase = [...e.querySelectorAll(".mot span")]
      .filter((s) => getComputedStyle(s).display !== "none" && Number(getComputedStyle(s).opacity) > 0.1)
      .map((s) => s.textContent.trim())
      .join(" ");
    return { repos: vu(".micro.repos"), ecoute: vu(".micro.ecoute"), traite: vu(".micro.traite"), phrase };
  });

/** Suit ce que deviennent les points, image par image. */
async function echantillonner(ecran) {
  const releves = [];
  for (let t = 0; t < DUREE_MESURE_MS; t += PAS_MS) {
    releves.push(
      await ecran.evaluate((e) => {
        const lire = (el) => {
          const s = getComputedStyle(el);
          const m = new DOMMatrixReadOnly(s.transform === "none" ? "" : s.transform);
          return { y: m.m42, x: m.m41, echelle: Math.hypot(m.m11, m.m12), opacite: Number(s.opacity) };
        };
        const curseur = e.querySelector(".curseur");
        return {
          points: [...e.querySelectorAll(".pt, .glyphe")].map(lire),
          curseur: curseur && getComputedStyle(curseur).display !== "none" ? lire(curseur) : null,
        };
      }),
    );
    await attendre(PAS_MS);
  }
  return releves;
}

const etendue = (v) => Math.max(...v) - Math.min(...v);
const amplitude = (r, champ, i = 0) => etendue(r.map((x) => x.points[i]?.[champ] ?? 0));
const dephasage = (r) => Math.max(...r.map((x) => Math.abs((x.points[0]?.y ?? 0) - (x.points[2]?.y ?? 0))));

/**
 * Ce que CHAQUE version doit faire, et qu'aucune autre ne fait pareil.
 *
 * Pour A et B, le DÉPHASAGE est exigé en plus de la hauteur : trois points qui
 * montent ensemble bougent autant et ne font aucune vague — or « des petites
 * vagues » est le mot exact du patron.
 */
const PROPRE_A_CHACUNE = {
  "0": {
    quoi: "l'avant reste IMMOBILE — c'est le témoin, s'il bouge la mesure ment",
    mesurer: (r) => {
      const h = amplitude(r, "y");
      const o = amplitude(r, "opacite");
      return { bon: h < 0.5 && o < 0.05, detail: `${h.toFixed(1)} px, opacité ${o.toFixed(2)}` };
    },
  },
  A: {
    quoi: "les points montent d'au moins 3 px, en vague",
    mesurer: (r) => ({
      bon: amplitude(r, "y") >= 3 && dephasage(r) >= 1.5,
      detail: `${amplitude(r, "y").toFixed(1)} px, déphasage ${dephasage(r).toFixed(1)} px`,
    }),
  },
  B: {
    quoi: "la houle monte plus haut que la vague — au moins 6 px",
    mesurer: (r) => ({
      bon: amplitude(r, "y") >= 6 && dephasage(r) >= 2,
      detail: `${amplitude(r, "y").toFixed(1)} px, déphasage ${dephasage(r).toFixed(1)} px`,
    }),
  },
  C: {
    quoi: "les points enflent sans se déplacer",
    mesurer: (r) => ({
      bon: amplitude(r, "echelle") >= 0.5 && amplitude(r, "y") < 1,
      detail: `échelle ${amplitude(r, "echelle").toFixed(2)}, déplacement ${amplitude(r, "y").toFixed(1)} px`,
    }),
  },
  D: {
    quoi: "un point fait la navette d'au moins 12 px",
    mesurer: (r) => {
      const course = etendue(r.map((x) => x.curseur?.x ?? 0));
      return { bon: r.every((x) => x.curseur) && course >= 12, detail: `${course.toFixed(1)} px de course` };
    },
  },
  E: {
    quoi: "les points respirent sur place, sous l'anneau",
    mesurer: (r) => ({
      bon: amplitude(r, "opacite") >= 0.4 && amplitude(r, "y") < 1,
      detail: `opacité ${amplitude(r, "opacite").toFixed(2)}, déplacement ${amplitude(r, "y").toFixed(1)} px`,
    }),
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

// ─── 1 à 5. La séquence, téléphone par téléphone ────────────────────────────
{
  const page = await ouvrirPage();
  const ecrans = page.locator(".ecran");
  dire((await ecrans.count()) === 6, `${await ecrans.count()} téléphone(s) SANS SCRIPT — six attendus`);

  for (const lettre of LETTRES) {
    const ecran = page.locator(`.ecran[data-variante="${lettre}"]`);
    await ecran.scrollIntoViewIfNeeded();

    // 1. Au repos : le micro, et rien d'autre.
    const repos = await etat(ecran);
    dire(
      repos.repos && !repos.ecoute && !repos.traite && repos.phrase.includes("dicter"),
      `${lettre} — au repos : le micro seul (« ${repos.phrase} »)`,
    );

    // 2. Premier appui : il écoute, et ça se voit.
    await ecran.locator(".micro.repos").click();
    const ecoute = await etat(ecran);
    dire(
      ecoute.ecoute && !ecoute.repos && ecoute.phrase.includes("J'écoute"),
      `${lettre} — premier appui : le bouton d'arrêt et « ${ecoute.phrase} »`,
    );
    // Le rouge seul pourrait passer pour un état figé : on mesure le battement.
    {
      const releves = [];
      for (let t = 0; t < 800; t += PAS_MS) {
        releves.push(
          await ecran.locator(".micro.ecoute").evaluate((el) => {
            const s = getComputedStyle(el);
            return Math.hypot(
              new DOMMatrixReadOnly(s.transform === "none" ? "" : s.transform).m11,
              new DOMMatrixReadOnly(s.transform === "none" ? "" : s.transform).m12,
            );
          }),
        );
        await attendre(PAS_MS);
      }
      dire(etendue(releves) > 0.02, `${lettre} — le bouton d'arrêt BAT (${etendue(releves).toFixed(3)})`);
    }

    // 3. Second appui : les points prennent la place.
    await ecran.locator(".micro.ecoute").click(APPUI);
    const traite = await etat(ecran);
    const phraseAttendue = lettre === "0" ? traite.phrase === "" : traite.phrase.includes("rédige");
    dire(
      traite.traite && !traite.ecoute && phraseAttendue,
      `${lettre} — second appui : les points${lettre === "0" ? " (et toujours aucune phrase — c'est l'avant)" : ` et « ${traite.phrase} »`}`,
    );

    // 3 bis. À demi effacé pour l'avant, à pleine encre pour les cinq.
    //
    // C'est la moitié du défaut, et elle ne se voit sur aucune mesure de
    // mouvement : un bouton immobile ET à pleine encre paraîtrait moins mauvais
    // qu'il ne l'est, et la comparaison serait faussée en faveur de l'avant.
    {
      const encre = await ecran
        .locator(".micro.traite")
        .evaluate((el) => Number(getComputedStyle(el).opacity));
      dire(
        lettre === "0" ? encre <= 0.6 : encre >= 0.9,
        lettre === "0"
          ? `${lettre} — l'avant garde son demi-effacement (${encre}) — sinon on le montre meilleur qu'il n'est`
          : `${lettre} — le bouton reste à pleine encre pendant l'attente (${encre})`,
      );
    }

    // 4. Et ils bougent — chacun de sa façon.
    const attendu = PROPRE_A_CHACUNE[lettre];
    const m = attendu.mesurer(await echantillonner(ecran));
    dire(m.bon, `${lettre} — ${attendu.quoi} (${m.detail})`);

    // 5. « Recommencer » ramène au départ.
    await ecran.locator(".recommencer").click();
    const retour = await etat(ecran);
    dire(retour.repos && !retour.traite, `${lettre} — « Recommencer » ramène au micro`);
  }
  await page.close();
}

// ─── 6. Sans le réglage, aucun résultat n'arrive ────────────────────────────
//
// Sinon la boucle ne serait pas une boucle, et l'on jugerait cinq gestes sur
// quatre secondes chacun.
{
  const page = await ouvrirPage();
  const ecran = page.locator('.ecran[data-variante="A"]');
  await ecran.scrollIntoViewIfNeeded();
  await ecran.locator(".micro.repos").click();
  await ecran.locator(".micro.ecoute").click(APPUI);
  await attendre(5000);
  const rempli = await ecran.evaluate((e) =>
    [...e.querySelectorAll(".valeur")].some((v) => Number(getComputedStyle(v).opacity) > 0.1),
  );
  dire(!rempli, "sans le réglage, rien ne se remplit au bout de 5 s — la boucle tourne bien en boucle");
  await page.close();
}

// ─── 7. Avec le réglage : après 4 s, et pas avant ───────────────────────────
{
  const page = await ouvrirPage();
  await page.locator("label[for='resultat']").click();
  const ecran = page.locator('.ecran[data-variante="A"]');
  await ecran.scrollIntoViewIfNeeded();
  await ecran.locator(".micro.repos").click();
  await ecran.locator(".micro.ecoute").click(APPUI);

  const lire = () =>
    ecran.evaluate((e) => ({
      valeurs: [...e.querySelectorAll(".valeur")].map((v) => Number(getComputedStyle(v).opacity)),
      micro: Number(getComputedStyle(e.querySelector(".signe-fini")).opacity),
      fini: (() => {
        const s = e.querySelector(".mot .m-fini");
        return getComputedStyle(s).display !== "none" ? Number(getComputedStyle(s).opacity) : 0;
      })(),
    }));

  await attendre(2000);
  const tot = await lire();
  dire(
    tot.valeurs.every((o) => o < 0.1) && tot.micro < 0.1,
    `à 2 s, rien n'est encore rempli (${tot.valeurs.map((o) => o.toFixed(2)).join(", ")}) — l'attente existe`,
  );

  await attendre(3200);
  const tard = await lire();
  dire(
    tard.valeurs.every((o) => o > 0.9),
    `à 5,2 s, les trois champs sont remplis (${tard.valeurs.map((o) => o.toFixed(2)).join(", ")})`,
  );
  dire(tard.micro > 0.9, `le micro est revenu (${tard.micro.toFixed(2)})`);
  dire(tard.fini > 0.9, `la phrase annonce le résultat (${tard.fini.toFixed(2)})`);
  await page.close();
}

// ─── 8. Mouvement réduit : plus de trajet, mais ça respire ──────────────────
{
  const page = await ouvrirPage(true);
  for (const lettre of ["A", "B", "C", "D", "E"]) {
    const ecran = page.locator(`.ecran[data-variante="${lettre}"]`);
    await ecran.scrollIntoViewIfNeeded();
    await ecran.locator(".micro.repos").click();
    await ecran.locator(".micro.ecoute").click(APPUI);
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
console.log("\n✅ La séquence se joue en entier sur les six téléphones, sans une ligne de script.");
