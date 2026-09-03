/**
 * « Vos boutons verts, dans la matière de la note vocale » — la planche se
 * parcourt en entier avant de partir en ligne.
 *
 * **Pourquoi cette suite existe.** Trois fois, une adresse lui a été transmise
 * sans que personne ne l'ait ouverte, et c'est LUI qui a trouvé le défaut
 * (`AGENTS.md`). Une planche dont on ATTEND un choix se parcourt donc d'abord
 * ici, dans un vrai navigateur, sur un téléphone de 390 px.
 *
 * **CE QU'ELLE GARDE VRAIMENT, et c'est le cœur.** La planche affirme deux
 * choses, et une seule des deux se voit à l'œil :
 *
 *   1. que sa matière est celle de l'application, RECOPIÉE et non approchée —
 *      la suite relit donc `src/app/globals.css` et compare les verts et l'or
 *      du bouton à ceux de `.atlas-micro`, la tasse de la note vocale. Le jour
 *      où l'application change de matière, la planche rougit au lieu de mentir ;
 *   2. que la lumière en POUR CENT s'étale et efface le mot, et que la même
 *      lumière gardée à sa taille ne l'efface pas. Ce sont des chiffres, et la
 *      suite les relit à l'écran plutôt que de croire le texte à côté.
 *
 * **ET LE HALO NE REVIENT PAS.** Sa demande du 3 septembre : « c'est celle-là
 * la bonne couleur mais sans le petit halo lumineux qui tourne à l'intérieur ».
 * Un retrait qu'aucun contrôle ne garde se refait tout seul au lot suivant :
 * la suite refuse toute animation sur les pseudo-éléments du bouton.
 *
 * **Elle sait échouer sur autre chose que le vide.** Un bouton de zéro pixel,
 * un chiffre absent, un dégradé qui ne serait pas peint : chacun de ces cas
 * rougit ici plutôt que de passer au vert faute de matière (`CLAUDE.md` §5).
 *
 *   BASE_URL=http://127.0.0.1:8080 node tests/essai-boutons-verts.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080";
const ICI = dirname(fileURLToPath(import.meta.url));

let rouges = 0;
const dire = (ok, quoi) => {
  if (!ok) rouges++;
  console.log((ok ? "  ok    " : "  ROUGE ") + quoi);
};

/** « 6,5 » → 6.5. Le contrôle lit des chiffres écrits pour un artisan. */
const nombre = (t) => Number(String(t).replace(",", "."));
const enRgb = (hex) =>
  "rgb(" + [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ") + ")";

// ─── Ce que l'APPLICATION dit de sa matière ──────────────────────────────────
//
// Lu dans le fichier, pas récité. `.atlas-micro` — la tasse de la note vocale,
// celle qu'il a retenue — porte ses trois verts dans son `background`, et l'or
// puis la porcelaine dans son `box-shadow`.
const GLOBALS = readFileSync(join(ICI, "..", "..", "src", "app", "globals.css"), "utf8");
const bloc = GLOBALS.slice(GLOBALS.indexOf(".atlas-micro {"));
const micro = bloc.slice(0, bloc.indexOf("\n}"));
const hexes = (t) => t.match(/#[0-9a-fA-F]{6}/g) || [];
const VERTS = hexes(micro.slice(micro.indexOf("background:"), micro.indexOf("box-shadow:")));
const JOAILLERIE = [...new Set(hexes(micro.slice(micro.indexOf("box-shadow:"))))];

const nav = await chromium.launch();
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("requestfailed", (r) => erreurs.push("requête perdue : " + r.url()));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) erreurs.push(r.status() + " sur " + r.url());
});

await page.goto(`${BASE}/boutons-verts.html`, { waitUntil: "networkidle" });

// 0. La matière relevée dans le code est bien celle du dépôt : sans cela, les
//    comparaisons plus bas ne diraient rien de l'application.
dire(VERTS.length >= 3, `\`.atlas-micro\` donne ses verts : ${VERTS.join(", ") || "aucun"}`);
dire(JOAILLERIE.length >= 2, `\`.atlas-micro\` donne ses anneaux : ${JOAILLERIE.join(", ") || "aucun"}`);

// ─── 1. Les cinq déclinaisons s'affichent, et l'écran a de la matière ────────
for (const [cle, nom] of [
  ["zero", "Aujourd’hui"], ["a", "A"], ["b", "B"], ["c", "C"], ["d", "D"],
]) {
  await page.click(`.choix button[data-v="${cle}"]`);
  await page.waitForTimeout(200);

  dire(
    (await page.locator(`.choix button[data-v="${cle}"]`).getAttribute("aria-pressed")) === "true",
    `${nom} — le choix se marque appuyé`
  );

  const boite = await page.locator(".bouton").first().evaluate((e) => e.getBoundingClientRect());
  dire(boite.width > 100 && boite.height > 40,
    `${nom} — le bouton mesure ${Math.round(boite.width)} × ${Math.round(boite.height)} px`);

  const debord = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  dire(debord <= 0, `${nom} — aucun débordement horizontal (${debord} px)`);

  const chiffres = await page.$$eval("[data-mesure]", (n) => n.map((e) => e.textContent.trim()));
  dire(chiffres.length >= 5 && chiffres.every((t) => /\d,\d/.test(t)),
    `${nom} — les ${chiffres.length} chiffres sont calculés et écrits`);
}

// ─── 2. La matière est celle de l'application, au caractère près ─────────────
await page.click('.choix button[data-v="a"]');
await page.waitForTimeout(200);
const peinture = await page.locator(".bouton").first().evaluate((e) => {
  const s = getComputedStyle(e);
  const avant = getComputedStyle(e, "::before"), apres = getComputedStyle(e, "::after");
  return {
    fond: s.backgroundImage,
    ombre: s.boxShadow,
    tourne: [avant.animationName, apres.animationName].filter((n) => n && n !== "none"),
  };
});
for (const vert of VERTS) {
  dire(peinture.fond.includes(enRgb(vert)),
    `A — le dégradé porte ${vert} (${enRgb(vert)}), comme \`.atlas-micro\``);
}
// **On compte les anneaux, on ne se contente pas de les trouver.** La tasse en
// a TROIS — or, porcelaine, or —, et c'est ce qui la distingue du galet à un
// seul filet. Chercher la couleur sans la compter laisserait passer un bouton
// dont deux anneaux sur trois auraient changé.
const compter = (texte, motif) => texte.split(motif).length - 1;
for (const piece of JOAILLERIE) {
  const attendu = compter(micro.slice(micro.indexOf("box-shadow:")), piece);
  const trouve = compter(peinture.ombre, enRgb(piece));
  dire(trouve === attendu,
    `A — l'anneau ${piece} revient ${trouve} fois, comme sur la note vocale (${attendu})`);
}

// **Le halo qu'il a fait retirer ne revient pas** — sa demande du 3 septembre.
// Un retrait sans garde se refait tout seul au lot suivant.
dire(peinture.tourne.length === 0,
  `A — aucun halo qui tourne sur le bouton${peinture.tourne.length ? " — " + peinture.tourne.join(", ") : ""}`);

// ─── 3. Ce que la planche AFFIRME, relu à l'écran ────────────────────────────
//
// A : le galet en pour cent s'efface quand le bouton s'allonge. Le contrôle
// prend le PLUS LARGE des boutons et exige qu'il soit sous le seuil — c'est la
// démonstration entière de la planche ; si elle passait, il n'y aurait rien à
// lui demander.
const lire = async () =>
  page.$$eval("[data-mesure]", (n) =>
    n.map((e) => ({
      largeur: Number((e.textContent.match(/(\d+) px/) || [0, 0])[1]),
      tenu: Number((e.textContent.match(/tient\s+([\d,]+)/) || [0, "0"])[1].replace(",", ".")),
      rouge: !!e.querySelector(".faible"),
    }))
  );

const mesuresA = await lire();
const plusLarge = mesuresA.reduce((a, b) => (b.largeur > a.largeur ? b : a));
dire(plusLarge.largeur > 300, `A — le plus large des boutons fait ${plusLarge.largeur} px`);
dire(mesuresA.every((m) => m.tenu < 4.5 && m.rouge),
  `A — le mot ne tient nulle part (${mesuresA.map((m) => m.tenu).join(" · ")}), tout est signalé en rouge`);

// B : la lumière gardée à sa taille ne dépend plus de la largeur. Deux choses à
// prouver, et la seconde est sa raison d'être : le mot tient partout, ET il
// tient la MÊME chose partout.
await page.click('.choix button[data-v="b"]');
await page.waitForTimeout(200);
const mesuresB = await lire();
dire(mesuresB.every((m) => m.tenu >= 4.5 && !m.rouge),
  `B — le mot tient partout (${mesuresB.map((m) => m.tenu).join(" · ")})`);
dire(new Set(mesuresB.map((m) => m.tenu)).size === 1,
  `B — et le même chiffre de ${Math.min(...mesuresB.map((m) => m.largeur))} à ${Math.max(...mesuresB.map((m) => m.largeur))} px`);

// D : le filet seul ne touche pas au vert — le chiffre doit rester celui
// d'aujourd'hui, sinon la déclinaison ne dit pas ce qu'elle prétend.
await page.click('.choix button[data-v="zero"]');
await page.waitForTimeout(200);
const aujourdhui = (await lire())[0].tenu;
await page.click('.choix button[data-v="d"]');
await page.waitForTimeout(200);
dire((await lire())[0].tenu === aujourdhui,
  `D — le vert ne bouge pas : ${aujourdhui} avant comme après`);

// ─── 4. Ce qu'il a fait retirer ne revient pas ───────────────────────────────
//
// Sa règle du 31 août : « surtout pas ceux qui sont creux ». Le bouton
// secondaire doit rester sans aplat dans les cinq déclinaisons.
for (const cle of ["zero", "a", "b", "c", "d"]) {
  await page.click(`.choix button[data-v="${cle}"]`);
  await page.waitForTimeout(120);
  const creux = await page.locator(".creux").evaluate((e) => {
    const s = getComputedStyle(e);
    return { fond: s.backgroundColor, image: s.backgroundImage };
  });
  dire(creux.fond === "rgba(0, 0, 0, 0)" && creux.image === "none",
    `${cle} — le bouton creux reste creux`);
}

dire(erreurs.length === 0,
  `Aucune erreur ni requête perdue${erreurs.length ? " — " + erreurs.join(" | ") : ""}`);

await nav.close();
console.log(rouges === 0 ? "\nTout est vert." : `\n${rouges} contrôle(s) au rouge.`);
process.exit(rouges === 0 ? 0 : 1);
