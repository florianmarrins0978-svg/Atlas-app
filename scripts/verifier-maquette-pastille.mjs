#!/usr/bin/env node
/*
  Presse la pastille, comme le patron la pressera.

  Pourquoi ce script existe. Les quinze maquettes précédentes sont immobiles :
  les regarder suffit. Celle-ci ne vaut que par ce qu'elle fait quand un doigt
  se pose — et « la page s'ouvre sans erreur » ne dit rien de cela. Trois fois
  déjà, c'est le patron qui a trouvé le défaut d'un outillage livré « prêt »
  (`AGENTS.md`). Ici, le défaut serait invisible à l'œil : une feuille qui ne
  monte jamais, ou qui monte deux fois.

  Ce qu'il vérifie, et qui correspond à ce que la page promet :

    1. les pastilles sont armées, toutes ;
    2. la feuille N'EST PAS ouverte à 200 ms — la demi-seconde existe ;
    3. elle EST ouverte à 800 ms ;
    4. un deuxième appui pendant le geste ne crée pas un deuxième chantier ;
    5. « Refermer » referme, sinon on ne peut essayer qu'une fois ;
    6. sous « mouvement réduit », la feuille monte TOUT DE SUITE — sinon un
       réglage d'accessibilité passerait pour une lenteur.
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
// Le contrôle sert deux cibles, et il faut les deux : la maquette seule, et la
// page qui fusionne les seize — c'est là que le script reçoit un `document`
// restreint à sa section, et donc là qu'il peut mourir sans qu'on le voie.
// `resolve` : un chemin relatif donné en argument produisait « file://docs/… »
// et Playwright répondait « ERR_INVALID_URL » — une erreur qui accuse l'adresse
// là où le fautif est le chemin.
const CIBLE = resolve(
  process.argv[2] ?? join(RACINE, "docs", "maquettes", "16-la-pastille-qui-tourne.html"),
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

/** La feuille de l'écran qui porte cette pastille est-elle montée ? */
async function feuilleOuverte(pastille) {
  return pastille.evaluate((p) =>
    p.closest(".ecran").querySelector(".feuille").classList.contains("ouverte"),
  );
}

// Le contrôle joue le geste sur la PREMIÈRE et la DERNIÈRE pastille armée.
// Sur la page qui fusionne les seize, ce sont deux maquettes différentes, et
// chacune a son propre script : n'en éprouver qu'une laisserait l'autre
// silencieusement morte.
async function essayer({ calme, rang }) {
  const page = await navigateur.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: calme ? "reduce" : "no-preference",
  });
  await page.goto(`file://${CIBLE}`, { waitUntil: "load" });

  // Les pastilles ARMÉES, et pas toutes celles qui portent ce nom de classe :
  // la maquette 14 en pose une aussi, sans feuille derrière. Sur la page qui
  // fusionne les seize, l'ignorer ferait échouer le contrôle sur une maquette
  // qui n'a jamais rien promis.
  const pastilles = page.locator(".ecran:has(.feuille) .pastille[href]");
  const nombre = await pastilles.count();
  if (!calme && rang === "premiere") {
    dire(nombre >= 3, `${nombre} pastilles pressables (au moins 3 attendues)`);
  }

  const premiere = rang === "derniere" ? pastilles.last() : pastilles.first();
  await premiere.click();

  if (calme) {
    // Sous mouvement réduit, l'attente n'a plus de raison d'être.
    await page.waitForTimeout(120);
    dire(await feuilleOuverte(premiere), `${rang} · mouvement réduit : la feuille monte tout de suite`);
  } else {
    await page.waitForTimeout(200);
    dire(!(await feuilleOuverte(premiere)), `${rang} · à 200 ms, la feuille n'est pas encore montée`);

    // Le tour est-il vraiment joué ? Une classe posée ne prouve rien : on lit
    // l'animation que le navigateur exécute réellement.
    // On interroge la GRAVURE, quelle qu'elle soit : la maquette 16 fait
    // tourner tout le dessin, la 17 parfois une seule pièce (la lunette du
    // cadran tourne, son signe reste). Chercher une classe précise, c'était
    // faire échouer le contrôle à chaque nouvelle marque.
    const anime = await premiere.evaluate((p) =>
      Array.from(p.querySelectorAll("svg, svg *")).some((n) => n.getAnimations().length > 0),
    );
    dire(anime, `${rang} · la gravure tourne pour de bon (animation en cours)`);

    // Deuxième appui pendant le geste : il doit être ignoré. Le clic est
    // envoyé au nœud lui-même plutôt qu'à sa position — sinon, le jour où la
    // demi-seconde disparaît, la feuille déjà montée intercepte le doigt et le
    // script meurt sur « click intercepted ». Le contrôle accuserait alors
    // Playwright là où le fautif est le délai, et enverrait chercher au
    // mauvais endroit.
    await premiere.evaluate((p) => p.click());
    await page.waitForTimeout(600);
    dire(await feuilleOuverte(premiere), `${rang} · à 800 ms, la feuille est montée`);

    await page.waitForTimeout(500);
    const feuilles = await page.locator(".feuille.ouverte").count();
    dire(feuilles === 1, `${rang} · un seul appui utile malgré deux clics (${feuilles} feuille(s) ouverte(s))`);

    await premiere.evaluate((p) => p.closest(".ecran").querySelector(".fermer").click());
    await page.waitForTimeout(120);
    dire(!(await feuilleOuverte(premiere)), `${rang} · « Refermer » referme, on peut recommencer`);
  }

  await page.close();
}

console.log("=== La pastille répond-elle au doigt ? ===\n");
await essayer({ calme: false, rang: "premiere" });
await essayer({ calme: false, rang: "derniere" });
await essayer({ calme: true, rang: "premiere" });
await navigateur.close();

if (plaintes.length) {
  console.error(`\n✗ ${plaintes.length} contrôle(s) en échec :\n  ` + plaintes.join("\n  "));
  process.exit(1);
}
console.log("\n✅ La pastille tourne, éclate, attend une demi-seconde, puis ouvre.");
