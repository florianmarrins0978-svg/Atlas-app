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

  // **Le bouton se désigne par son RÔLE, pas par sa classe.** Il s'est appelé
  // « pastille », puis « geste » ; la prochaine maquette l'appellera encore
  // autrement, et le contrôle serait alors vert en ne pressant rien du tout.
  // Ce qui ne change pas, c'est ce qu'il annonce à qui ne voit pas l'écran.
  // On ne garde que ceux qui ont une feuille derrière eux : la planche du haut
  // de chaque page joue le geste, et rien d'autre — elle n'a rien promis.
  const pastilles = page.locator(
    '.ecran:has(.feuille) [href][aria-label="Nouveau chantier"]',
  );
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
    // `force` : le clic est dispatché tout de suite, sans attendre que le nœud
    // soit « stable ». C'est nécessaire dès qu'un geste déplace son propre
    // bouton — l'écran qui recule, les lettres qui s'écartent — car Playwright
    // rejoue alors son clic en boucle jusqu'au délai, et chaque rejeu relance
    // le geste. On perd la vérification d'accessibilité de l'outil ; on la
    // remplace par la nôtre, juste au-dessus : le bouton a été trouvé par son
    // rôle, et compté.
    try {
      await premiere.click({ force: true, timeout: 5000 });
    } catch (erreur) {
      /* la feuille a pu monter par-dessus : la mesure du délai le dira */
      if (process.env.ATLAS_BAVARD) console.error("  … clic :", String(erreur).slice(0, 300));
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

    // **La fenêtre de mesure part d'ICI, pas de l'appui.** Quand le clic met
    // cinq secondes à rendre la main — ce qui arrive si le bouton bouge pendant
    // son propre geste — une fenêtre comptée depuis l'appui était déjà close, et
    // le contrôle annonçait « la feuille n'est jamais montée » alors qu'elle
    // était montée depuis longtemps. Le message accusait la maquette ; le fautif
    // était le contrôle.
    const debutMesure = Date.now();
    let delai = null;
    while (Date.now() - debutMesure < 3000) {
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
