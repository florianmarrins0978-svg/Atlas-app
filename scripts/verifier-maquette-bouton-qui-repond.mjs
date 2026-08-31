#!/usr/bin/env node
/*
  Éprouve `appli/le-bouton-qui-repond.html` — sa demande du 31 août 2026 :

    *« Quand je clique sur les boutons j'aimerais avoir une mini vibration, que
    l'utilisateur soit sûr d'avoir appuyé. Et si possible avoir un visuel du
    bouton qui s'enfonce tout en s'éclaircissant légèrement. »*

  ───────────────────────────────────────────────────────────────────────────
  CE QUE CE CONTRÔLE TIENT, ET POURQUOI CHAQUE POINT EXISTE.

  1. **LE GESTE EXISTE SUR TOUT CE QUI SE TOUCHE.** Une planche où seule la
     capsule principale répond laisserait croire que le geste est acquis ; il
     serait absent des cartes de chantier et de la barre du bas, qu'il touche
     cent fois par jour. Chaque surface est donc mesurée séparément, et sous
     les TROIS réglages : c'est ce qu'il compare.

  2. **IL S'ÉCLAIRCIT, il ne s'assombrit pas.** C'est sa demande au mot près, et
     le sens compte : un aplat qui fonce sous un doigt disparaît dans l'ombre de
     la main. La clarté est donc mesurée (luminance relative), pas seulement le
     changement de couleur — « la couleur a bougé » passerait au vert sur
     l'exact inverse de ce qu'il a demandé.

  3. **IL REVIENT À SA COULEUR quand on lâche.** Sa phrase le dit : *« lorsqu'on
     lâche elle reprend sa couleur d'origine »*. Un bouton qui reste éclairci
     se lit comme un bouton resté enfoncé, donc comme un geste parti deux fois.

  4. **LES TROIS RÉGLAGES SONT VRAIMENT DIFFÉRENTS, ET DANS L'ORDRE.** Trois
     onglets qui rendent le même geste lui feraient choisir entre trois fois la
     même chose — et il répondrait au hasard, ce qui est pire que pas de choix.
     L'échelle et la durée de vibration sont donc strictement décroissante et
     croissante.

  5. **L'INTERRUPTEUR COUPE POUR DE BON.** Un réglage qui ne fait rien est un
     mensonge d'écran.

  6. **AUCUNE FLÈCHE DÉCORATIVE** dans les libellés (`CLAUDE.md` §3, redit deux
     fois le 25 août).

  7. **LES DIX VERTS SE LISENT AU SOLEIL, ET SOUS LE DOIGT.** Sa demande du
     31 août. Le contraste est mesuré sur les DEUX extrémités de chaque dégradé
     — une capsule dont seul le haut passerait aurait un bas illisible — et
     **une seconde fois avec le voile de l'appui**, qui éclaircit le fond donc
     rapproche le texte : c'est l'état le plus défavorable, et c'est celui que
     personne ne regarde. Quarante relevés par teinte, aucun sous 4,5:1.

     Les couleurs sont lues sur les variables que le CSS emploie vraiment
     (`--haut`, `--bas`), jamais recopiées dans le contrôle : deux listes
     finissent toujours par diverger.

  ───────────────────────────────────────────────────────────────────────────
  CE QUE CE CONTRÔLE NE PEUT PAS TENIR, ET QUI DOIT SE LIRE ICI.

  **CE QUI A CASSÉ LE 31 AOÛT, ET CE QUI LE TIENT MAINTENANT.** La première
  version posait `input.checked = !input.checked` : l'interrupteur basculait, le
  compteur montait, et **rien ne vibrait** — c'est lui qui l'a trouvé, sur son
  iPhone. Le retour haptique d'iOS suit l'ACTIVATION par le navigateur, pas la
  valeur de la case ; seul un vrai clic sur l'étiquette l'obtient.

  Le contrôle éprouve donc **le mécanisme**, à défaut du ressenti : un clic sur
  l'étiquette fait bien basculer l'interrupteur qu'elle porte. C'est ce qui
  attrape les deux façons de le casser sans s'en apercevoir — une étiquette
  `display:none`, ou un `pointer-events:none` qui la rend inerte.

  **La vibration elle-même ne se mesure pas.** Chromium fournit
  `navigator.vibrate()` et rend `true` sans qu'aucun moteur ne tourne : le
  compteur de la planche prouve que l'appel PART, jamais que le téléphone
  bouge. Et le chemin d'iPhone — l'interrupteur natif d'iOS 17.4+ — n'existe
  pas du tout ici. C'est donc **sur son téléphone** que cela se vérifie, et la
  planche le lui dit à l'écran plutôt que de le laisser croire.

  **Ce contrôle sait échouer** (`AGENTS.md`) : il a rougi trois fois pendant son
  écriture, dont deux fois à tort — une cible hors de la fenêtre, puis une cible
  recouverte par la barre collante, toutes deux mesurées « ne bouge pas » sur un
  bouton parfaitement sain. D'où le refus explicite de conclure sur une cible
  qu'on ne peut pas atteindre, plutôt qu'un rouge qui accuse le mauvais coupable.
*/
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(RACINE, "appli", "le-bouton-qui-repond.html");
if (!existsSync(PAGE)) {
  console.error(`✗ Introuvable : ${PAGE}`);
  process.exit(1);
}

const plaintes = [];
const dire = (ok, quoi) => {
  console.log(`${ok ? "✓" : "✗"} ${quoi}`);
  if (!ok) plaintes.push(quoi);
};

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});

const HAUTEUR = 900;
/** La barre du bas est collante : elle recouvre les 80 derniers pixels, et une
 *  cible qui s'y cache reçoit le clic de la barre. Elle seule a droit d'y être. */
const PLAFOND = HAUTEUR - 100;

/** Luminance relative (WCAG) — la seule façon de dire « plus clair » sans se
 *  fier à l'œil, et la seule qui marche aussi sur les deux chartes sombres. */
const clarte = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number);
  const c = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};

const CIBLES = [
  [".principal", "la capsule pleine"],
  [".touche", "la touche de sa capture"],
  [".tuile", "une carte de chantier"],
  [".barre button", "la barre du bas"],
];

for (const teinte of ["light", "dark"]) {
  const vue = await navigateur.newPage({
    viewport: { width: 430, height: HAUTEUR },
    colorScheme: teinte,
    hasTouch: true,
    isMobile: true,
  });
  const bavures = [];
  vue.on("pageerror", (e) => bavures.push(e.message));
  await vue.goto(`file://${PAGE}`);
  await vue.waitForLoadState("networkidle");

  const echelles = [];
  const durees = [];

  for (const reglage of ["1", "2", "3"]) {
    await vue.click(`.choix[data-r="${reglage}"]`);

    for (const [selecteur, nom] of CIBLES) {
      const el = vue.locator(selecteur).first();
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await vue.waitForTimeout(60);
      const boite = await el.boundingBox();

      // **Refuser de conclure plutôt que rendre un vert qui ne prouve rien**
      // (`CLAUDE.md` §5) : une boîte nulle ou hors de la fenêtre ne se mesure
      // pas, et un « il ne bouge pas » y accuserait le mauvais coupable.
      const atteignable =
        boite &&
        boite.width > 10 &&
        boite.height > 10 &&
        boite.y >= 0 &&
        boite.y + boite.height <= (selecteur === ".barre button" ? HAUTEUR : PLAFOND);
      if (!atteignable) {
        dire(false, `${teinte} · réglage ${reglage} · ${nom} : hors d'atteinte, mesure impossible`);
        continue;
      }

      const lire = () =>
        el.evaluate((e) => {
          const s = getComputedStyle(e);
          return { fond: s.backgroundColor, echelle: new DOMMatrix(s.transform).a };
        });

      const repos = await lire();
      await vue.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
      await vue.mouse.down();
      await vue.waitForTimeout(160);
      const appui = await lire();
      await vue.mouse.up();
      await vue.waitForTimeout(340);
      const retour = await lire();

      dire(appui.echelle < repos.echelle, `${teinte} · réglage ${reglage} · ${nom} s'enfonce (${repos.echelle.toFixed(3)} → ${appui.echelle.toFixed(3)})`);

      // Les capsules creuses et la barre partent d'un fond transparent : là,
      // « s'éclaircir » n'a pas de sens — c'est le fond qui apparaît. Seules
      // les surfaces qui portent un APLAT sont jugées sur la clarté.
      const aplat = !/rgba\(0, 0, 0, 0\)|transparent/.test(repos.fond);
      if (aplat) {
        // **« S'éclaircir » suppose qu'il reste de la place au-dessus.** Sa
        // demande vise un aplat qui a de la marge — sa touche noire, le vert
        // d'Atlas, et jusqu'au crème des chartes sombres, qui monte vers le
        // blanc. Sa raison est physique : sous un doigt, un aplat qui fonce
        // disparaît dans l'ombre de la main.
        //
        // **La seule exception, et elle se nomme :** une carte de chantier est
        // déjà à un cheveu du blanc (clarté 0,95). Lui demander de s'éclaircir,
        // c'est lui demander l'impossible — un appui qu'on ne verrait pas. Elle
        // se teinte donc vers le papier, faute de place au-dessus.
        //
        // **Ce que le contrôle exige dans TOUS les cas :** que la clarté bouge
        // assez pour se voir. Un changement d'un millième passerait au vert en
        // ne prouvant rien (`CLAUDE.md` §5).
        const AU_PLAFOND = 0.9;
        const repere = clarte(repos.fond);
        const apres = clarte(appui.fond);
        const aDeLaPlace = repere < AU_PLAFOND;
        const sens = aDeLaPlace ? apres > repere : apres < repere;
        const seVoit = Math.abs(apres - repere) >= 0.01;
        dire(
          sens && seVoit,
          `${teinte} · réglage ${reglage} · ${nom} ${aDeLaPlace ? "s'éclaircit" : "se teinte, faute de place au-dessus"} de ${(Math.abs(apres - repere) * 100).toFixed(1)} points (${repos.fond} → ${appui.fond})`
        );
      }
      dire(retour.fond === repos.fond && Math.abs(retour.echelle - 1) < 0.001, `${teinte} · réglage ${reglage} · ${nom} reprend sa couleur quand on lâche`);

      if (selecteur === ".principal") echelles.push(appui.echelle);
    }

    durees.push(
      Number(await vue.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ms")))
    );
  }

  dire(
    echelles.length === 3 && echelles[0] > echelles[1] && echelles[1] > echelles[2],
    `${teinte} · les trois réglages s'enfoncent de plus en plus (${echelles.map((e) => e.toFixed(3)).join(" > ")})`
  );
  dire(
    durees.length === 3 && durees[0] < durees[1] && durees[1] < durees[2] && durees[0] > 0,
    `${teinte} · les trois vibrations s'allongent (${durees.join(" < ")} ms)`
  );

  // ── L'interrupteur coupe pour de bon ────────────────────────────────────
  const capsule = vue.locator(".principal");
  await capsule.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await vue.waitForTimeout(60);
  const presser = async () => {
    const b = await capsule.boundingBox();
    await vue.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await vue.mouse.down();
    await vue.waitForTimeout(60);
    await vue.mouse.up();
    await vue.waitForTimeout(60);
  };
  const compte = () => vue.locator("#compte").innerText();
  const avantCoupure = await compte();
  await presser();
  dire((await compte()) !== avantCoupure, `${teinte} · l'appui appelle bien la vibration (compteur ${avantCoupure} → ${await compte()})`);
  await vue.click("#interrupteur");
  const coupe = await compte();
  await presser();
  dire((await compte()) === coupe, `${teinte} · l'interrupteur coupe vraiment la vibration`);
  await vue.click("#interrupteur");

  dire(bavures.length === 0, `${teinte} · aucune erreur JavaScript${bavures.length ? ` (${bavures.join(" | ")})` : ""}`);
  await vue.close();
}

// ── Le chemin d'iPhone : le mécanisme, à défaut du ressenti ────────────────
// Safari n'existe pas ici, donc le retour haptique non plus. Ce qui se tient,
// c'est que l'étiquette soit VRAIMENT reliée à son interrupteur et qu'un clic
// l'active — la seule chose qui manquait quand ça ne vibrait pas chez lui.
{
  const vue = await navigateur.newPage({ viewport: { width: 430, height: HAUTEUR } });
  await vue.goto(`file://${PAGE}`);
  await vue.waitForLoadState("networkidle");

  const etiquette = vue.locator("#etiquette-ios");
  const interrupteur = vue.locator("#switch-ios");
  dire((await etiquette.count()) === 1 && (await interrupteur.count()) === 1, "le chemin d'iPhone existe : une étiquette et son interrupteur");

  // Ni cachée ni inerte : les deux façons de le rendre muet sans que rien ne
  // se voie à l'écran.
  const dessin = await etiquette.evaluate((e) => {
    const s = getComputedStyle(e);
    return { affichage: s.display, evenements: s.pointerEvents };
  });
  dire(dessin.affichage !== "none", `l'étiquette n'est pas masquée (display: ${dessin.affichage})`);
  dire(dessin.evenements !== "none", `l'étiquette reste activable (pointer-events: ${dessin.evenements})`);

  const avant = await interrupteur.evaluate((e) => e.checked);
  await etiquette.evaluate((e) => e.click());
  const apres = await interrupteur.evaluate((e) => e.checked);
  dire(apres !== avant, `un clic sur l'étiquette active bien l'interrupteur (${avant} → ${apres})`);

  // Et le code appelle ce chemin-là, pas l'ancien.
  const source = await vue.evaluate(() => document.documentElement.outerHTML);
  dire(!/#switch-ios"\)\s*;?\s*\n?\s*\w+\.checked\s*=/.test(source) && source.includes('$("#etiquette-ios").click()'),
       "la vibration d'iPhone passe par le clic sur l'étiquette, pas par `checked`");

  await vue.close();
}

// ── Les dix verts ──────────────────────────────────────────────────────────
// Ils portent un dégradé (`background-image`), pas un aplat : `backgroundColor`
// y vaut « transparent » et les contrôles ci-dessus les auraient laissés
// passer en silence. Ils ont donc leur propre mesure.
{
  const NOIR_SUR_CLAIR = "#14180f";
  const CREME = "#faf9f5";
  const VOILE = 0.14; // le calque blanc de `.vert.appui::after`

  const melange = (hex, a) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgb(${[r, g, b].map((v) => Math.round(v * (1 - a) + 255 * a)).join(", ")})`;
  };
  const contraste = (a, b) => {
    const [x, y] = [clarte(a), clarte(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const enRgb = (hex) => melange(hex, 0);

  for (const teinte of ["light", "dark"]) {
    const vue = await navigateur.newPage({
      viewport: { width: 430, height: HAUTEUR },
      colorScheme: teinte,
      hasTouch: true,
      isMobile: true,
    });
    await vue.goto(`file://${PAGE}`);
    await vue.waitForLoadState("networkidle");

    const verts = await vue.$$eval(".vert", (els) =>
      els.map((e) => ({
        haut: e.style.getPropertyValue("--haut").trim(),
        bas: e.style.getPropertyValue("--bas").trim(),
        hautNuit: e.style.getPropertyValue("--haut-nuit").trim(),
        basNuit: e.style.getPropertyValue("--bas-nuit").trim(),
        libelle: e.innerText.trim(),
      }))
    );

    dire(verts.length === 10, `${teinte} · dix verts proposés (${verts.length})`);

    // **Le même libellé partout, sinon ce ne sont plus des verts qu'il compare.**
    const libelles = new Set(verts.map((v) => v.libelle));
    dire(libelles.size === 1, `${teinte} · les dix portent le même libellé (${[...libelles].join(" / ")})`);

    const texte = teinte === "dark" ? NOIR_SUR_CLAIR : CREME;
    let pire = { r: 99, ou: "" };
    verts.forEach((v, i) => {
      const stops = teinte === "dark" ? [v.hautNuit, v.basNuit] : [v.haut, v.bas];
      if (stops.some((c) => !/^#[0-9a-f]{6}$/i.test(c))) {
        dire(false, `${teinte} · vert ${i + 1} : couleurs illisibles (${stops.join(" ")}), mesure impossible`);
        return;
      }
      for (const c of stops) {
        for (const a of [0, VOILE]) {
          const r = contraste(enRgb(texte), melange(c, a));
          if (r < pire.r) pire = { r, ou: `vert ${i + 1}, ${c}${a ? " appuyé" : ""}` };
        }
      }
    });
    dire(pire.r >= 4.5, `${teinte} · le pire des quarante contrastes tient (${pire.r.toFixed(2)}:1 — ${pire.ou})`);

    // Et ils se pressent comme le reste : le voile monte, puis retombe.
    const premier = vue.locator(".vert").first();
    await premier.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await vue.waitForTimeout(60);
    const boite = await premier.boundingBox();
    const voileDe = () => premier.evaluate((e) => Number(getComputedStyle(e, "::after").opacity));
    const repos = await voileDe();
    await vue.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
    await vue.mouse.down();
    await vue.waitForTimeout(160);
    const appuye = await voileDe();
    await vue.mouse.up();
    await vue.waitForTimeout(340);
    const rendu = await voileDe();
    dire(repos === 0 && appuye > 0.1 && rendu === 0, `${teinte} · un vert s'éclaircit sous le doigt et redevient net (${repos} → ${appuye} → ${rendu})`);

    await vue.close();
  }
}

// ── Aucune flèche décorative dans ce qui s'affiche ─────────────────────────
{
  const vue = await navigateur.newPage({ viewport: { width: 430, height: HAUTEUR } });
  await vue.goto(`file://${PAGE}`);
  const texte = await vue.evaluate(() => document.body.innerText);
  const fleches = texte.match(/[→←↑↓⇒⇐➔⟶‹›▸▶◂◀]/gu) ?? [];
  dire(fleches.length === 0, `aucune flèche décorative à l'écran${fleches.length ? ` (${fleches.join(" ")})` : ""}`);
  await vue.close();
}

await navigateur.close();
console.log("");
if (plaintes.length) {
  console.error(`✗ ${plaintes.length} défaut(s) :`);
  plaintes.forEach((p) => console.error(`   · ${p}`));
  process.exit(1);
}
console.log(
  "✓ Le geste tient sur les quatre surfaces, dans les deux teintes et sous les trois réglages : la capsule rentre, s'éclaircit, et reprend sa couleur quand on lâche. La vibration, elle, ne se mesure que sur son téléphone."
);
