#!/usr/bin/env node
/*
  Fabrique les planches en IMAGE de la maquette 15.

      node scripts/capture-maquette-bascule.mjs <dossier>

  **Pourquoi des images en plus du fichier HTML.** Le patron travaille au
  téléphone. Un fichier s'ouvre, mais il faut le vouloir ; une planche s'affiche
  dans la conversation sans rien demander à personne. La règle du dépôt le dit
  déjà (`HANDOVER.md`) : lui envoyer les FICHIERS, et des images avec.

  Deux planches, parce qu'elles ne répondent pas à la même question :

    · `planche-ecrans.png`  — les six écrans entiers, pour juger de l'ensemble ;
    · `planche-zones.png`   — la seule zone qui change, dans SES DEUX ÉTATS,
      côte à côte. C'est celle qui décide : tout le reste de l'écran est
      identique d'une déclinaison à l'autre, et le montrer six fois ne fait que
      diluer ce qu'on compare.

  **JavaScript coupé, comme son lecteur.** Ce que la planche montre est donc
  exactement ce que lui verra — et non ce qu'un navigateur complaisant aurait pu
  rattraper.
*/

import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAQUETTE = join(RACINE, "docs", "maquettes", "15-la-bascule-affinee.html");
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const dossier = resolve(process.argv[2] ?? join(RACINE, "captures-bascule"));
mkdirSync(dossier, { recursive: true });

const NOMS = [
  "Le trait qui glisse",
  "Le point d'or",
  "La plage qui glisse",
  "Le rail et la perle",
  "Le cartouche",
  "La bascule en pied",
];

const executable =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (existsSync(CHEMIN_SANDBOX) ? CHEMIN_SANDBOX : undefined);
const navigateur = await chromium.launch(executable ? { executablePath: executable } : {});
const contexte = await navigateur.newContext({
  javaScriptEnabled: false,
  viewport: { width: 1400, height: 1200 },
  deviceScaleFactor: 2,
});
const page = await contexte.newPage();
await page.goto(`file://${MAQUETTE}`);

// Le fondu du libellé dure 260 ms, le glissement du repère 320 : on laisse
// finir. Capturer trop tôt donnerait une image à mi-course — un repère entre
// deux mots, deux libellés à demi transparents — qui ne correspond à rien de ce
// qu'on voit vraiment.
const FONDU_MS = 600;

const props = await page.locator(".prop").all();
const ecrans = [];
const zones = [];

for (let i = 0; i < props.length; i++) {
  const prop = props[i];
  const ecran = prop.locator(".ecran");
  const actions = prop.locator(".actions");
  const etiquettes = prop.locator("label");

  const fichierEcran = join(dossier, `ecran-${i + 1}.png`);
  await ecran.screenshot({ path: fichierEcran });
  ecrans.push(fichierEcran);

  const zoneA = join(dossier, `zone-${i + 1}-a.png`);
  await actions.screenshot({ path: zoneA });

  await etiquettes.nth(1).click();
  await page.waitForTimeout(FONDU_MS);
  const zoneB = join(dossier, `zone-${i + 1}-b.png`);
  await actions.screenshot({ path: zoneB });

  await etiquettes.nth(0).click();
  await page.waitForTimeout(FONDU_MS);

  zones.push([zoneA, zoneB]);
}

/** Une planche est une page HTML qu'on photographie : pas de bibliothèque à ajouter. */
function planche({ corps, largeur }) {
  return `<!doctype html><meta charset="utf-8"><style>
    :root{--fond:#efece6;--encre:#1c1c1a;--gris:#8a8578;--or:#B98B47;--trait:rgba(28,28,26,.13)}
    *{box-sizing:border-box}
    body{margin:0;background:var(--fond);color:var(--encre);width:${largeur}px;
         font:16px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;padding:40px 36px 46px}
    .sur{margin:0 0 12px;font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--or)}
    h1{margin:0 0 10px;font:400 30px/1.2 ui-serif,Georgia,"Iowan Old Style",serif;letter-spacing:-.012em}
    .sous{margin:0 0 34px;color:var(--gris);font-size:14.5px;max-width:70ch}
    .no{font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--or);margin:0 0 5px}
    .nom{margin:0 0 12px;font:400 18px/1.2 ui-serif,Georgia,serif}
    img{display:block;max-width:100%;border-radius:6px}
    .etat{font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:var(--gris);margin:0 0 6px}
  </style>${corps}`;
}

async function photographier(html, largeur, sortie) {
  const fichier = join(dossier, "_planche.html");
  writeFileSync(fichier, html);
  const p = await contexte.newPage();
  await p.setViewportSize({ width: largeur, height: 900 });
  await p.goto(`file://${fichier}`);
  await p.screenshot({ path: sortie, fullPage: true });
  await p.close();
  console.log("→", sortie);
}

// ── Planche 1 : les six écrans ─────────────────────────────────────────────
const LARGEUR_ECRANS = 1380;
await photographier(
  planche({
    largeur: LARGEUR_ECRANS,
    corps: `
      <p class="sur">Atlas · la bascule affinée</p>
      <h1>Les six déclinaisons</h1>
      <p class="sous">Le même écran, six façons de dessiner le choix. Ce qui ne change
        jamais : les deux chemins se voient, et il n'y a qu'un bouton à toucher.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:34px 30px">
        ${ecrans
          .map(
            (f, i) => `<div>
              <p class="no">Déclinaison ${i + 1}</p>
              <p class="nom">${NOMS[i]}</p>
              <img src="file://${f}">
            </div>`
          )
          .join("")}
      </div>`,
  }),
  LARGEUR_ECRANS,
  join(dossier, "planche-ecrans.png")
);

// ── Planche 2 : la seule zone qui change, dans ses deux états ──────────────
const LARGEUR_ZONES = 1120;
await photographier(
  planche({
    largeur: LARGEUR_ZONES,
    corps: `
      <p class="sur">Atlas · la bascule affinée</p>
      <h1>Ce qui change, et rien d'autre</h1>
      <p class="sous">Le reste de l'écran est identique d'une déclinaison à l'autre :
        seule cette zone diffère. À gauche « je dicterai », à droite « je l'écris » —
        le repère a glissé, et le mot du bouton s'est fondu.</p>
      ${zones
        .map(
          ([a, b], i) => `<div style="margin-bottom:34px">
            <p class="no">Déclinaison ${i + 1}</p>
            <p class="nom">${NOMS[i]}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:26px">
              <div><p class="etat">Je dicterai</p><img src="file://${a}"></div>
              <div><p class="etat">Je l'écris</p><img src="file://${b}"></div>
            </div>
          </div>`
        )
        .join("")}`,
  }),
  LARGEUR_ZONES,
  join(dossier, "planche-zones.png")
);

await navigateur.close();
