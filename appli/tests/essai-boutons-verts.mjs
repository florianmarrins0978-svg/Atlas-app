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
 *   1. que sa matière est celle de la note vocale du 3 septembre, RECOPIÉE et
 *      non approchée — les trois verts et l'or sont ceux de la tasse d'alors.
 *      **La tasse n'existe plus dans l'application — 16 septembre 2026.** Il a
 *      choisi la note vocale à plat, sur le vert de ses boutons, avec un seul
 *      cercle d'or clair (`appli/note-vocale-cercle-dore.html`). La planche
 *      est TRANCHÉE (la D, codée le 3 septembre) : elle raconte le chemin, et
 *      ce qu'elle doit encore dire vrai, c'est que la D est le vert que
 *      l'application paie AUJOURD'HUI — lu dans `src/app/globals.css`, sur
 *      `.atlas-micro`. Les trois verts du dégradé et l'or vif sont relus dans
 *      la planche elle-même : un bord unique, jamais la porcelaine ;
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

// ─── Ce que l'APPLICATION paie aujourd'hui, et ce que la planche a recopié ──
//
// Lu dans les fichiers, pas récité. `.atlas-micro` — la note vocale — est à
// plat depuis le 16 septembre 2026 : UN vert dans son `background`. C'est
// celui que la D doit porter, sinon la planche ment sur ce qu'il a retenu.
const hexes = (t) => t.match(/#[0-9a-fA-F]{6}/g) || [];
const GLOBALS = readFileSync(join(ICI, "..", "..", "src", "app", "globals.css"), "utf8");
const bloc = GLOBALS.slice(GLOBALS.indexOf(".atlas-micro {"));
const micro = bloc.slice(0, bloc.indexOf("\n}"));
const [PLEIN] = hexes(micro.slice(micro.indexOf("background:")));
// Les trois verts du dégradé et l'or vif viennent de la planche : c'est la
// tasse du 3 septembre, recopiée le jour même, et l'application n'en a plus.
const PLANCHE = readFileSync(join(ICI, "..", "boutons-verts.html"), "utf8");
const banc = PLANCHE.slice(PLANCHE.indexOf(".banc{"));
const jeton = (nom) => (banc.match(new RegExp(`--${nom}:(#[0-9a-fA-F]{6})`)) || [])[1];
const VERTS = [jeton("sage-clair"), jeton("sage"), jeton("pin-clair")].filter(Boolean);
const OR = jeton("or-vif");
const PORCELAINE = jeton("creme-anneau");

const nav = await chromium.launch();
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("requestfailed", (r) => erreurs.push("requête perdue : " + r.url()));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) erreurs.push(r.status() + " sur " + r.url());
});

await page.goto(`${BASE}/boutons-verts.html`, { waitUntil: "networkidle" });

// 0. La matière est relevée pour de bon : sans cela, les comparaisons plus
//    bas ne diraient rien — ni de l'application, ni de la planche.
dire(!!PLEIN, `\`.atlas-micro\` donne le vert de l'application : ${PLEIN || "aucun"}`);
dire(VERTS.length === 3, `la planche donne ses trois verts : ${VERTS.join(", ") || "aucun"}`);
dire(!!OR && !!PORCELAINE, `la planche donne son or et sa porcelaine : ${OR}, ${PORCELAINE}`);

// ─── 1. Les six déclinaisons s'affichent, et l'écran a de la matière ────────
for (const [cle, nom] of [
  ["zero", "Aujourd’hui"], ["a", "A"], ["b", "B"], ["c", "C"], ["d", "D"], ["e", "E"],
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

// ─── 2. La matière est celle qu'elle annonce, au caractère près ──────────────
// **400 ms, et ce n'est pas une marge de confort.** `.bouton` porte
// `transition: box-shadow 220ms` : lu à 200 ms, le filet d'or est encore une
// couleur INTERMÉDIAIRE, et le contrôle rougit sur un bouton juste. Attrapé en
// écrivant cette suite — c'est exactement le genre de rouge qui accuse le
// produit à la place de la mesure (`CLAUDE.md` §5).
const peindre = async (cle) => {
  await page.click(`.choix button[data-v="${cle}"]`);
  await page.waitForTimeout(400);
  return page.locator(".bouton").first().evaluate((e) => {
    const s = getComputedStyle(e);
    const avant = getComputedStyle(e, "::before"), apres = getComputedStyle(e, "::after");
    return {
      fond: s.backgroundImage,
      aplat: s.backgroundColor,
      ombre: s.boxShadow,
      tourne: [avant.animationName, apres.animationName].filter((n) => n && n !== "none"),
    };
  });
};
const compter = (texte, motif) => texte.split(motif).length - 1;

const peintureA = await peindre("a");
for (const vert of VERTS) {
  dire(peintureA.fond.includes(enRgb(vert)),
    `A — le dégradé porte ${vert} (${enRgb(vert)}), comme la tasse du 3 septembre`);
}

// **LA COULEUR SEULE — sa demande du 3 septembre au soir :** *« mets juste la
// couleur de la note vocale sur les boutons sans le liseré doré, seulement la
// couleur pour voir »*. Rien autour, donc : ni filet, ni ombre.
dire(compter(peintureA.ombre, enRgb(OR)) === 0 && peintureA.ombre === "none",
  `A — aucun liseré ni ombre : la couleur seule (${peintureA.ombre})`);

// **UN SEUL BORD DORÉ SUR LA B, et pas trois anneaux** — son choix d'une heure
// plus tôt. On COMPTE, on ne se contente pas de trouver : la porcelaine de la
// note vocale reviendrait sans que la couleur de l'or change, et un simple
// « l'or est là » ne le verrait pas.
const peintureB = await peindre("b");
dire(compter(peintureB.ombre, enRgb(OR)) === 1,
  `B — un seul bord doré ${OR}, et c'est celui de la note vocale`);
dire(compter(peintureB.ombre, enRgb(PORCELAINE)) === 0,
  `B — pas d'anneau de porcelaine ${PORCELAINE} : il a demandé un seul bord`);
dire(peintureB.fond === peintureA.fond,
  "B — exactement le même dégradé que A : seul le bord les sépare");

// **LES APLATS SONT PRIS DANS L'ÉCHELLE DE LA TASSE, pas approchés à l'œil.**
// « Sans l'effet brillant » ne veut pas dire « un vert qui ressemble » : D et E
// sont deux des trois verts de la tasse. **Et la D est ce qu'il a retenu** —
// c'est elle qui est devenue `colors.plein`, puis la note vocale elle-même :
// si `.atlas-micro` change de vert, la planche cesse de dire vrai, et c'est
// ici qu'elle doit rougir.
const platD = await peindre("d");
dire(platD.fond === "none" && platD.aplat === enRgb(VERTS[1]),
  `D — un aplat, et c'est ${VERTS[1]}, le vert du milieu de la tasse (${platD.aplat})`);
dire(platD.aplat === enRgb(PLEIN),
  `D — et c'est le vert que l'application paie aujourd'hui, ${PLEIN} (\`.atlas-micro\`)`);
const platE = await peindre("e");
dire(platE.fond === "none" && platE.aplat === enRgb(VERTS[2]),
  `E — un aplat, et c'est ${VERTS[2]}, le vert du bord de la tasse (${platE.aplat})`);

// **Le halo qu'il a fait retirer ne revient pas** — sa demande du 3 septembre.
// Un retrait sans garde se refait tout seul au lot suivant.
for (const [cle, p] of [["A", peintureA], ["B", peintureB]]) {
  dire(p.tourne.length === 0,
    `${cle} — aucun halo qui tourne sur le bouton${p.tourne.length ? " — " + p.tourne.join(", ") : ""}`);
}

// ─── 3. Ce que la planche AFFIRME, relu à l'écran ────────────────────────────
//
// A : la lumière placée en pour cent tombe au milieu du mot. Le contrôle
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

await page.click('.choix button[data-v="a"]');
await page.waitForTimeout(200);
const mesuresA = await lire();
const plusLarge = mesuresA.reduce((a, b) => (b.largeur > a.largeur ? b : a));
dire(plusLarge.largeur > 300, `A — le plus large des boutons fait ${plusLarge.largeur} px`);
dire(mesuresA.every((m) => m.tenu < 4.5 && m.rouge),
  `A — le mot ne tient nulle part (${mesuresA.map((m) => m.tenu).join(" · ")}), tout est signalé en rouge`);

// C : la lumière gardée à sa taille ne dépend plus de la largeur. Deux choses à
// prouver, et la seconde est sa raison d'être : le mot tient partout, ET il
// tient la MÊME chose partout.
await page.click('.choix button[data-v="c"]');
await page.waitForTimeout(200);
const mesuresC = await lire();
dire(mesuresC.every((m) => m.tenu >= 4.5 && !m.rouge),
  `C — le mot tient partout (${mesuresC.map((m) => m.tenu).join(" · ")})`);
dire(new Set(mesuresC.map((m) => m.tenu)).size === 1,
  `C — et le même chiffre de ${Math.min(...mesuresC.map((m) => m.largeur))} à ${Math.max(...mesuresC.map((m) => m.largeur))} px`);

// **Les deux aplats se départagent, sinon ils ne servent à rien.** D et E
// portent le même dessin et deux verts voisins : ce qui les sépare est le
// chiffre, et c'est ce que la planche lui donne à trancher.
await page.click('.choix button[data-v="d"]');
await page.waitForTimeout(200);
const platClair = (await lire())[0];
await page.click('.choix button[data-v="e"]');
await page.waitForTimeout(200);
const platFonce = (await lire())[0];
dire(platClair.tenu < 4.5 && platClair.rouge,
  `D — l'aplat clair laisse le mot à ${platClair.tenu}, signalé en rouge`);
dire(platFonce.tenu >= 4.5 && !platFonce.rouge,
  `E — l'aplat du bord le tient à ${platFonce.tenu}`);

// ─── 4. Ce qu'il a fait retirer ne revient pas ───────────────────────────────
//
// Sa règle du 31 août : « surtout pas ceux qui sont creux ». Le bouton
// secondaire doit rester sans aplat dans les cinq déclinaisons.
for (const cle of ["zero", "a", "b", "c", "d", "e"]) {
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
