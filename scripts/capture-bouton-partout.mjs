#!/usr/bin/env node
/*
  Photographie l'action principale de CHAQUE écran qui en porte une.

      node scripts/capture-bouton-partout.mjs <dossier>

  **Pourquoi ce script existe.** Le patron, le 11 août 2026 : *« montre-moi avant
  de faire, plutôt que de faire pour revenir en arrière »*. Il avait raison, et
  c'est la bonne règle : changer dix-sept écrans puis les défaire, c'est lui
  faire porter le risque d'un choix qu'il n'a pas encore fait.

  Le script ne connaît AUCUNE liste d'écrans par cœur : il parcourt les adresses
  données, cherche sur chacune les boutons **peints en vert pin** — la couleur de
  l'action principale, et d'elle seule (`design-tokens.ts` : le vert pin porte ce
  qu'on FAIT, l'or ce qu'on LIT) — et les photographie avec un peu d'air autour.

  Chercher par la couleur plutôt que par une classe ou un texte n'est pas une
  coquetterie : un bouton qui aurait perdu sa couleur d'action n'est plus
  l'action principale, et doit disparaître de la planche. Un sélecteur par classe
  l'aurait photographié quand même.

  Il ne modifie rien. Pour obtenir l'« après », on pose `forme = "capsule"` par
  défaut dans `PrimaryButton.tsx`, on rejoue, **et on remet la valeur d'avant**.
*/

import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PIN = "rgb(47, 59, 47)"; // colors.rust — l'action principale, et rien d'autre

const dossier = resolve(process.argv[2] ?? "captures-bouton");
mkdirSync(dossier, { recursive: true });

const executable =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (existsSync(CHEMIN_SANDBOX) ? CHEMIN_SANDBOX : undefined);
const navigateur = await chromium.launch(executable ? { executablePath: executable } : {});
// L'écran du patron : 390 × 664, la place réelle d'une page sur son téléphone.
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await contexte.newPage();
page.setDefaultTimeout(120_000);

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 120_000 });

// Un chantier neuf pour les écrans du parcours, et les chantiers de
// démonstration pour ceux qui demandent un devis déjà parti.
await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.fill('input[placeholder="M. Bernard"]', `Capture bouton ${Date.now()}`);
await page.locator('[data-atlas="action-creation"] button').click();
await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}$/, { timeout: 120_000 });
const neuf = page.url().split("/").pop();

const ECRANS = [
  ["creation", "Création d'un chantier", `${BASE}/chantiers/nouveau`],
  ["informations", "Informations", `${BASE}/chantiers/${neuf}/informations`],
  ["prix", "Prix", `${BASE}/chantiers/${neuf}/prix`],
  ["transcription", "Transcription", `${BASE}/chantiers/${neuf}/transcription`],
  ["photos", "Photos", `${BASE}/chantiers/${neuf}/photos`],
  ["note-vocale", "Note vocale", `${BASE}/chantiers/${neuf}/note-vocale`],
  ["devis", "Devis à envoyer", `${BASE}/chantiers/${neuf}/export`],
  ["facture", "Facture", `${BASE}/chantiers/${neuf}/facture`],
];

let pris = 0;
for (const [cle, nom, url] of ECRANS) {
  try {
    await page.goto(url, { waitUntil: "networkidle" });
  } catch {
    console.log(`  ⚠ ${nom} — écran injoignable, rien à montrer`);
    continue;
  }
  await page.waitForTimeout(400);

  // On MARQUE d'abord, on photographie ensuite. Les coordonnées d'un élément
  // sont relatives à la fenêtre : lues avant de faire défiler, elles désignent
  // un rectangle hors de l'image, et la capture échoue — ou pire, cadre à côté.
  const combien = await page.evaluate((pin) => {
    const cibles = [...document.querySelectorAll("button, a")].filter((e) => {
      const r = e.getBoundingClientRect();
      return getComputedStyle(e).backgroundColor === pin && r.width > 80 && r.height > 30;
    });
    cibles.forEach((e, i) => e.setAttribute("data-capture", String(i)));
    return cibles.length;
  }, PIN);

  const boites = [];
  for (let i = 0; i < combien; i++) {
    const cible = page.locator(`[data-capture="${i}"]`);
    await cible.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const b = await cible.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, texte: (e.textContent ?? "").trim() };
    });
    boites.push(b);
  }

  if (boites.length === 0) {
    console.log(`  · ${nom} — aucune action principale à cet état de l'écran`);
    continue;
  }

  for (const [i, b] of boites.entries()) {
    await page.locator(`[data-capture="${i}"]`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const r = await page.locator(`[data-capture="${i}"]`).evaluate((e) => {
      const q = e.getBoundingClientRect();
      return { x: q.x, y: q.y, w: q.width, h: q.height };
    });
    // **Le cadre prend TOUTE la largeur de l'écran, jamais celle du bouton.**
    //
    // Cadrer au plus près paraissait plus propre, et c'était un piège : deux
    // captures de largeurs différentes, posées côte à côte dans une planche, se
    // remettent à la même taille — et la capsule, plus étroite en réalité,
    // s'affichait PLUS GROSSE que le rectangle qu'elle remplace. La planche
    // disait exactement l'inverse de la vérité.
    //
    // À largeur d'écran constante, les deux images sont à la même échelle, et
    // la place que le bouton laisse autour de lui — qui est tout le sujet — se
    // voit enfin.
    const AIR = 26;
    const y = Math.max(0, Math.round(r.y - AIR));
    await page.screenshot({
      path: `${dossier}/${cle}${boites.length > 1 ? `-${i + 1}` : ""}.png`,
      clip: { x: 0, y, width: 390, height: Math.min(664 - y, Math.round(r.h + AIR * 2)) },
    });
    pris += 1;
    console.log(`  ✓ ${nom} — « ${b.texte.split("\n")[0]} » (${Math.round(b.w)} px)`);
  }
}

console.log(`\n${pris} bouton(s) photographié(s) → ${dossier}`);
await navigateur.close();
