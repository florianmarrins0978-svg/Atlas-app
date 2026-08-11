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
    // **On MESURE le moment où la feuille monte, au lieu de regarder à un
    // instant choisi.** Le contrôle guettait d'abord « à 200 ms, est-elle
    // fermée ? » : sur une machine chargée, ce regard arrivait parfois à 520 ms
    // et accusait une demi-seconde qui n'avait pas bougé d'un pouce. Un
    // contrôle qui échoue une fois sur dix ne prouve rien et use la confiance
    // de celui qui le lit.
    const depart = Date.now();
    // Le premier appui est un VRAI clic — c'est tout l'objet du contrôle. Mais
    // il est enveloppé : le jour où la demi-seconde disparaît, la feuille monte
    // pendant que Playwright vérifie que son clic a porté, et l'outil finit par
    // rendre un « click intercepted » de trente secondes. Le clic, lui, a bien
    // eu lieu. On avale donc l'erreur ici pour que la mesure ci-dessous parle à
    // sa place — et qu'elle accuse le délai, pas l'outil.
    try {
      await premiere.click({ timeout: 5000 });
    } catch {
      /* la feuille a pu monter par-dessus : la mesure du délai le dira */
    }

    // Le tour est-il vraiment joué ? On interroge TOUT ce qui n'est ni l'onde,
    // ni les éclats, ni le cercle d'ouverture — c'est-à-dire la marque ou la
    // matière, quelle qu'elle soit. Le contrôle a d'abord cherché un `<svg>` :
    // il refusait alors « le noyau », dont la matière vivante est une nappe de
    // dégradés sans aucun dessin. Chercher une forme précise, c'est refuser la
    // proposition suivante.
    const anime = await premiere.evaluate((p) =>
      Array.from(p.querySelectorAll("*"))
        .filter((n) => !n.closest(".onde, .eclats, .revelation"))
        .some((n) => n.getAnimations().length > 0),
    );
    dire(anime, `${rang} · la marque ou la matière bouge pour de bon`);

    // Un deuxième appui pendant le geste : envoyé au nœud lui-même, sinon la
    // feuille montée intercepterait le doigt et l'erreur accuserait Playwright
    // là où le fautif serait le délai.
    await premiere.evaluate((p) => p.click());

    let delai = null;
    while (Date.now() - depart < 3000) {
      if (await feuilleOuverte(premiere)) {
        delai = Date.now() - depart;
        break;
      }
      await page.waitForTimeout(20);
    }
    dire(delai !== null, `${rang} · la feuille finit par monter`);
    dire(
      delai !== null && delai >= 380,
      `${rang} · la demi-seconde du geste existe (feuille montée après ${delai} ms)`,
    );

    await page.waitForTimeout(400);
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
