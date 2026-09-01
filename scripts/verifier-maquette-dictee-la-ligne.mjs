#!/usr/bin/env node
/*
  Éprouve `appli/dictee-la-ligne.html` — la ligne telle qu'il l'a corrigée.

  **D'où elle vient.** Sa réponse du 31 août 2026 au soir, devant la planche des
  quatre allures : *« garde-moi la ligne, mais supprime le rond avec le carré
  dedans pour me mettre pause. Et la touche envoyer : garde l'encadré vert et
  l'intérieur, mais la couleur du fond de la page (beige) […] et fais-la
  légèrement plus à plat. »*

  **Puis sa correction, une heure plus tard :** *« autour de la flèche envoyer
  je veux un rond, pas un ovale. Et fais-moi un visuel sans le rond aussi. »*
  Mes trois aplatissements (44 × 44, 48 × 40, 52 × 36) donnaient deux ovales :
  « plus à plat » parlait du POIDS de la touche, pas de sa forme. Le contrôle
  interdit désormais l'ovale — c'est ce qui empêche de le refaire.

  ───────────────────────────────────────────────────────────────────────────
  CE QUE CE CONTRÔLE TIENT — ses trois corrections, une par une.

  1. **PLUS AUCUNE PAUSE.** Ni bouton d'arrêt pendant la dictée, ni chrono qui
     se fige : le contrôle appuie partout où l'on peut appuyer et vérifie que
     le compteur continue. Un bouton retiré de l'œil mais laissé sous le doigt
     serait pire que rien.

  2. **L'ENVOI N'EST PLUS UN APLAT.** Son fond est celui de la PAGE — mesuré au
     pixel près sur `getComputedStyle`, pas déduit d'une classe —, son trait et
     son avion sont verts. Et le contrôle additionne la surface peinte de toute
     la zone : pendant la dictée, elle doit tomber à la seule pastille du
     chrono (64 px²), contre 7 956 px² sur l'écran d'aujourd'hui.

  3. **UN ROND, JAMAIS UN OVALE**, et **les deux visuels qu'il demande** : avec
     le rond, et sans. Le contrôle mesure la touche au pixel près dans les deux
     onglets et refuse le moindre écart entre largeur et hauteur ; il vérifie
     que « sans le rond » n'a plus ni contour ni fond, que l'avion reste vert,
     et que **la cible du doigt garde ses 44 px** — un geste qu'on rate n'est
     pas un geste plus discret, c'est un geste perdu.

  4. **Le geste du patron, entier** : appuyer sur le micro, parler deux
     secondes, jeter — et repartir de zéro ; puis envoyer, et voir la
     transcription. On entre par où il entre.

  5. **Aucune boîte de zéro pixel** (`CLAUDE.md` §5) : une mesure prise sur du
     vide rend zéro, et `0 − 0 = 0` passerait pour un succès.

  6. **Rien ne déborde en largeur**, dans les deux teintes.

  Usage : node scripts/verifier-maquette-dictee-la-ligne.mjs [dossier-captures]
*/
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "appli", "dictee-la-ligne.html");
const CAPTURES = process.argv[2] ?? null;
if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });

// Aucune flèche décorative (`CLAUDE.md` §3), avant même d'ouvrir un navigateur.
const source = readFileSync(FICHIER, "utf8");
assert.ok(!/[→←↑↓⇒⇐➔⟶▸▶◂◀]/u.test(source), "Une flèche décorative s'est glissée dans la planche.");

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const page = await navigateur.newPage({ viewport: { width: 390, height: 860 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => {
  console.error("La planche a levé une erreur :", e.message);
  process.exitCode = 1;
});
await page.goto("file://" + FICHIER);
await page.waitForLoadState("networkidle");

/** La surface peinte en aplat, en px² — ce qui tranche avec le fond. */
async function surfacePleine() {
  return page.evaluate(() => {
    const fond = getComputedStyle(document.body).backgroundColor;
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    const fondClair = lum(fond) > 0.5;
    let total = 0;
    for (const el of document.querySelectorAll(".zone *")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.opacity === "0") continue;
      const bg = s.backgroundColor;
      if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent" || bg === fond) continue;
      const clarte = lum(bg);
      if (!(fondClair ? clarte < 0.45 : clarte > 0.55)) continue;
      total += r.width * r.height;
    }
    return Math.round(total);
  });
}

async function pasDeDebordement(quand) {
  const trop = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  assert.ok(trop <= 0, `L'écran se balade de droite à gauche (${trop} px de trop) — ${quand}.`);
}

const etat = () => page.evaluate(() => document.body.dataset.etat);
const chrono = () => page.locator("#chrono").textContent().then((t) => t.trim());

// ─── Au repos : le micro, et rien d'autre ─────────────────────────────────
assert.equal(await etat(), "repos");
assert.ok(await page.locator(".micro-plein").isVisible(), "Le micro du repos ne s'affiche pas.");
assert.ok(!(await page.locator("#ligne").isVisible()), "La ligne s'affiche avant qu'on ait parlé.");
{
  const b = await page.locator(".micro-plein").boundingBox();
  assert.ok(b && b.width > 40 && b.height > 40, "Le micro mesure une boîte vide : rien n'est mesurable.");
}
await pasDeDebordement("au repos");

// ─── 1. PLUS AUCUNE PAUSE ─────────────────────────────────────────────────
await page.locator(".micro-plein").click();
assert.equal(await etat(), "dicte", "Appuyer sur le micro ne lance pas la dictée.");

const boutons = await page.locator("#ligne button").count();
assert.equal(boutons, 2, `La ligne porte ${boutons} boutons : il n'en veut que deux, jeter et envoyer.`);
const gestes = await page.locator("#ligne button").evaluateAll((els) => els.map((e) => e.dataset.geste));
assert.deepEqual(gestes, ["jeter", "envoyer"], `Les gestes de la ligne sont ${gestes.join(", ")}.`);
// Le carré d'arrêt ne doit exister nulle part — ni visible, ni sous le doigt.
assert.equal(await page.locator(".carre, .stop, [aria-label*='pause' i]").count(), 0,
  "Un bouton d'arrêt subsiste dans la page.");

// Et le chrono ne se fige sur AUCUN appui : c'est ce qu'un bouton retiré de
// l'œil mais laissé sous le doigt ferait quand même.
await page.waitForTimeout(2200);
const apres = await chrono();
assert.ok(/^0:0[23]$/.test(apres), `Le chrono n'a pas avancé en deux secondes : ${apres}`);
await page.locator("#ligne .chrono").click();
await page.locator("#ligne .onde").click({ force: true });
await page.waitForTimeout(1600);
const encore = await chrono();
assert.ok(encore !== apres, `Le chrono s'est figé après un appui sur la ligne (${encore}).`);

// ─── 2. L'ENVOI N'EST PLUS UN APLAT ───────────────────────────────────────
const envoi = await page.evaluate(() => {
  const b = document.querySelector(".envoyer");
  const s = getComputedStyle(b);
  return {
    fond: s.backgroundColor,
    trait: s.boxShadow,
    encre: s.color,
    fondDeLaPage: getComputedStyle(document.body).backgroundColor,
    vertDeLApp: getComputedStyle(document.documentElement).getPropertyValue("--pine").trim(),
  };
});
assert.equal(envoi.fond, envoi.fondDeLaPage,
  `Le fond de la touche (${envoi.fond}) n'est pas celui de la page (${envoi.fondDeLaPage}).`);
assert.equal(envoi.encre, "rgb(47, 59, 47)", `L'avion n'est pas vert pin : ${envoi.encre}`);
assert.ok(/inset/.test(envoi.trait) && /47, 59, 47/.test(envoi.trait),
  `La touche n'a pas d'encadré vert : ${envoi.trait}`);

const plein = await surfacePleine();
// Il ne doit plus rester que la pastille du chrono — 8 × 8 px.
assert.ok(plein <= 100,
  `La dictée porte encore ${plein} px² d'aplat : sa plainte du matin portait exactement là-dessus.`);
console.log(`Aplat pendant la dictée : ${plein} px² (7 956 sur l'écran d'aujourd'hui).`);

// ─── 3. UN ROND, JAMAIS UN OVALE — et les deux visuels ───────────────────
const FORMES2 = [
  { f: "rond", nom: "Avec le rond", encadre: true },
  { f: "nu", nom: "Sans le rond", encadre: false },
];
for (const { f, nom, encadre } of FORMES2) {
  await page.locator(`.onglets [data-f="${f}"]`).click();
  assert.equal(await page.evaluate(() => document.body.dataset.forme), f);

  const t = await page.locator(".envoyer").boundingBox();
  assert.ok(t && t.width > 20 && t.height > 20, `La touche « ${nom} » mesure une boîte vide.`);
  assert.equal(Math.round(t.width), Math.round(t.height),
    `« ${nom} » : la touche fait ${Math.round(t.width)} × ${Math.round(t.height)} — c'est un ovale, il veut un rond.`);
  assert.ok(t.width >= 44,
    `« ${nom} » : la cible du doigt tombe à ${Math.round(t.width)} px. Un geste qu'on rate n'est pas un geste plus discret.`);

  const dessin = await page.evaluate(() => {
    const b = document.querySelector(".envoyer");
    const s = getComputedStyle(b);
    return {
      trait: s.boxShadow,
      fond: s.backgroundColor,
      encre: s.color,
      avion: !!b.querySelector("svg"),
      fondDeLaPage: getComputedStyle(document.body).backgroundColor,
    };
  });
  assert.ok(dessin.avion, `L'avion a disparu de « ${nom} » : il ne reste plus de geste.`);
  assert.equal(dessin.encre, "rgb(47, 59, 47)", `L'avion de « ${nom} » n'est pas vert : ${dessin.encre}`);
  if (encadre) {
    assert.ok(/inset/.test(dessin.trait) && /47, 59, 47/.test(dessin.trait),
      `« ${nom} » n'a pas son encadré vert : ${dessin.trait}`);
    assert.equal(dessin.fond, dessin.fondDeLaPage,
      `« ${nom} » : le fond de la touche n'est pas celui de la page.`);
  } else {
    assert.equal(dessin.trait, "none", `« ${nom} » garde un contour : ${dessin.trait}`);
    assert.equal(dessin.fond, "rgba(0, 0, 0, 0)",
      `« ${nom} » garde un fond peint (${dessin.fond}) : sur une charte sombre, il se verrait.`);
  }

  // Rien d'autre ne bouge d'un onglet à l'autre.
  const poubelle = await page.locator("#ligne .jeter").boundingBox();
  assert.equal(Math.round(poubelle.height), 32,
    `La poubelle change de taille dans « ${nom} » : il choisirait un écran, pas une touche.`);

  await pasDeDebordement(`forme ${nom}`);
  if (CAPTURES) {
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(CAPTURES, `ligne-${f}-clair.png`) });
  }
}

// ─── 4. Le geste entier : jeter, puis envoyer ─────────────────────────────
await page.locator("#ligne .jeter").click();
assert.equal(await etat(), "repos", "Jeter ne ramène pas au repos.");
await page.locator(".micro-plein").click();
assert.ok(/^0:0[01]$/.test(await chrono()), "Le chrono ne repart pas de zéro après un jet.");
await page.locator("#ligne .envoyer").click();
assert.equal(await etat(), "envoi", "L'avion n'envoie pas.");
assert.ok(await page.locator("#attente").isVisible(), "Rien ne dit que la transcription est en cours.");
await page.waitForTimeout(2600);
assert.equal(await etat(), "repos", "La planche reste bloquée sur l'attente.");

// ─── 6. La teinte sombre ──────────────────────────────────────────────────
// Sur l'onglet AVEC le rond : c'est lui qui prend le fond de la page, et c'est
// là que l'inversion de la charte se joue. La boucle ci-dessus s'est arrêtée
// sur « sans le rond », où il n'y a plus rien à peindre.
await page.locator('.onglets [data-f="rond"]').click();
await page.locator("#teinte").click();
assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-theme")), "dark");
await page.locator(".micro-plein").click();
await page.waitForTimeout(1200);
const nuit = await page.evaluate(() => {
  const s = getComputedStyle(document.querySelector(".envoyer"));
  const lum = (c) => {
    const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((x) => {
      const u = x / 255;
      return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(s.backgroundColor), c = lum(s.color);
  return {
    contraste: (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05),
    fond: s.backgroundColor,
    fondDeLaPage: getComputedStyle(document.body).backgroundColor,
  };
});
assert.equal(nuit.fond, nuit.fondDeLaPage, "En nuit, la touche cesse de prendre le fond de la page.");
assert.ok(nuit.contraste >= 4.5,
  `En nuit, l'avion tient ${nuit.contraste.toFixed(2)} de contraste : un geste qu'on ne voit pas n'existe pas.`);
await pasDeDebordement("en nuit");
if (CAPTURES) await page.screenshot({ path: join(CAPTURES, "ligne-nuit.png") });

await navigateur.close();
if (process.exitCode) process.exit(process.exitCode);
console.log("\nLa ligne tient : deux gestes, aucun aplat, un rond qui n'est pas un ovale, deux teintes.");
