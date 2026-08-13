#!/usr/bin/env node
/*
  Fabrique l'image ANIMÉE des cinq attentes, pour la conversation.

  **Pourquoi ce script existe.** `HANDOVER.md` le dit depuis le 10 août : une
  maquette se double toujours d'une image, parce qu'une planche s'affiche dans
  la conversation sans rien à ouvrir. Mais ici la demande du patron porte
  exactement sur le MOUVEMENT — « qu'il se mette en mouvement, qu'il fasse des
  petites vagues ». Une image fixe montrerait cinq boutons identiques et ne
  répondrait à rien.

  Il photographie donc chaque bouton image par image, sur un cycle complet, et
  assemble un GIF qui tourne en boucle.

  **Deux pièges, payés ailleurs dans ce dépôt :**

    1. `locator.screenshot()` ATTEND que l'élément soit stable, c'est-à-dire que
       l'animation soit finie : il photographie toujours l'après, jamais le
       pendant. On passe donc par `page.screenshot({ clip })` (leçon du 12 août,
       `verifier-maquette-bouton-facture.mjs`) ;
    2. la page est ouverte SANS SCRIPT, comme le contrôle — photographier une
       version que le patron ne verrait pas serait pire que ne rien montrer.

  Usage : node scripts/animer-maquette-points.mjs [dossier de sortie]
*/

import { chromium } from "playwright";
import sharp from "sharp";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = join(RACINE, "docs", "maquettes", "40-les-trois-points-qui-attendent.html");
const SORTIE = resolve(process.argv[2] ?? join(RACINE, "docs", "maquettes", "images"));
mkdirSync(SORTIE, { recursive: true });

/** 1,5 s : le cycle le plus long de la planche (B) tient dedans. */
const CYCLE_MS = 1500;
const IMAGES = 30;
const PAS_MS = CYCLE_MS / IMAGES;

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const contexte = await navigateur.newContext({
  viewport: { width: 1400, height: 1200 },
  javaScriptEnabled: false,
  deviceScaleFactor: 2,
});
const page = await contexte.newPage();
await page.goto(`file://${CIBLE}`, { waitUntil: "load" });

// Tout presser : c'est l'état d'attente qu'on vient filmer.
const boutons = page.locator("[data-essai]");
for (let i = 0; i < (await boutons.count()); i++) await boutons.nth(i).click();

for (const lettre of ["0", "A", "B", "C", "D", "E"]) {
  const cible = page.locator(`.ecran[data-variante="${lettre}"] .micro`);
  await cible.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const b = await cible.boundingBox();
  // De la marge autour du rond : la vague ample sort du bouton, et la couper
  // ferait juger un geste sur sa moitié.
  const clip = { x: b.x - 30, y: b.y - 20, width: b.width + 60, height: b.height + 52 };

  const images = [];
  for (let i = 0; i < IMAGES; i++) {
    images.push(await page.screenshot({ clip }));
    await page.waitForTimeout(PAS_MS);
  }

  const { width, height } = await sharp(images[0]).metadata();

  // Les images sont empilées en une bande, puis relues en PIXELS BRUTS avec
  // `pageHeight` : c'est la seule façon de fabriquer un animé sans ffmpeg, qui
  // n'existe pas dans cet environnement (`AGENTS.md`). Passer la bande en PNG
  // ne suffit pas — vips cherche alors un champ « n-pages » que le format ne
  // porte pas, et l'erreur accuse le fichier au lieu de la lecture.
  const bande = await sharp({
    create: { width, height: height * IMAGES, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(images.map((input, i) => ({ input, top: height * i, left: 0 })))
    .raw()
    .toBuffer();

  // `pageHeight` va DANS `raw`, et non à côté. Écrit à côté, il est ignoré
  // sans un mot : le fichier sort alors en une seule image de 5 760 px de haut,
  // et le script annonce « ✓ » sur une image FIXE — c'est-à-dire sur le défaut
  // même qu'on est en train de corriger. C'est ce qui s'est passé au premier
  // jet, et c'est la raison du contrôle juste en dessous.
  const fichier = join(SORTIE, `40-attente-${lettre}.gif`);
  await sharp(bande, {
    raw: { width, height: height * IMAGES, channels: 4, pageHeight: height },
  })
    .gif({ loop: 0, delay: Math.round(PAS_MS) })
    .toFile(fichier);

  // Un fichier écrit ne prouve rien : on relit ce qu'on vient de produire.
  //
  // **Le compte n'est pas exactement celui demandé, et c'est normal :**
  // l'encodeur fusionne les images identiques. Ce n'est pas une perte, c'est
  // une mesure — l'avant, immobile, se réduit à UNE SEULE image, et c'est
  // précisément ce qu'il faut lui montrer. On attend donc l'immobilité de
  // l'avant et le mouvement des cinq autres, chacun nommé.
  const relu = await sharp(fichier, { animated: true }).metadata();
  const immobile = relu.pages === 1;
  const attenduImmobile = lettre === "0";
  if (immobile !== attenduImmobile) {
    console.error(
      attenduImmobile
        ? `  ✗ ${lettre} — l'AVANT bouge (${relu.pages} images) : il doit rester fixe, c'est le témoin`
        : `  ✗ ${lettre} — une seule image : le geste n'a pas été filmé, le GIF est FIXE`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `  ✓ 40-attente-${lettre}.gif — ${relu.pages} image(s)${attenduImmobile ? " (l'avant, immobile — c'est voulu)" : ""}, ${width}×${height}`,
    );
  }
}

await navigateur.close();

if (process.exitCode) {
  console.log("\n✗ Au moins une image ne montre pas ce qu'elle prétend montrer.");
} else {
  console.log(`\n✅ Images animées dans ${SORTIE}`);
}
