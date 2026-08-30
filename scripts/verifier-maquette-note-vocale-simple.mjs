#!/usr/bin/env node
/*
  Éprouve `appli/note-vocale-simple.html` — la note vocale à la manière d'une
  messagerie, et la largeur du bouton « Je rédige mon devis ».

  **D'où elle vient.** Sa demande du 30 août 2026, deux captures à l'appui :
  *« il faut modifier la note vocale pour qu'elle soit plus simple à utiliser,
  à la manière de celle de WhatsApp : on appuie dessus et, comme sur la deuxième
  photo, il faut la même chose — possibilité de supprimer, ou appuyer sur la
  flèche pour envoyer de suite la transcription et arriver sur la page du devis
  comme c'est déjà le cas. […] Et réduis un peu la largeur du bouton "Je rédige
  mon devis". »*

  ───────────────────────────────────────────────────────────────────────────
  CE QUE CE CONTRÔLE TIENT, ET POURQUOI CHAQUE POINT EST LÀ.

  1. **Au repos, l'anneau et rien d'autre** — et à l'appui, **l'anneau
     DISPARAÎT**. Sa règle du 30 août : *« lorsque je clique sur le bouton note
     vocale, il doit ensuite disparaître pour laisser place à la modification »*.
     C'est ce qui a fait retirer une troisième proposition, où l'anneau restait
     au centre. Le contrôle le tient pour que personne ne la remette.

  2. **Les DEUX gestes qu'il a nommés existent dans les deux propositions** :
     jeter, et envoyer. C'est le cœur de sa demande, et une proposition qui
     n'en porterait qu'un ne serait pas une proposition.

  3. **Jeter ne mène nulle part et remet le compteur à zéro.** C'est tout
     l'intérêt : aujourd'hui, arrêter c'est envoyer. Si la poubelle emmenait
     quand même au devis, le garde-fou serait un décor.

  4. **La pause arrête vraiment le chrono** — mesuré sur deux secondes réelles,
     pas déduit d'une classe CSS.

  5. **L'envoi mène au devis, avec ce qui a été saisi.** « comme c'est déjà le
     cas » : le nom tapé sur la fiche doit se retrouver sur le devis, sinon on
     dessine un devis d'exemple et l'on ne prouve rien.

  6. **Aucun prix n'est inventé.** Il n'a annoncé aucun montant en dictant
     (`CLAUDE.md` §4).

  7. **Le bouton du bas est SECONDAIRE, et il le dit « Je rédige à la main ».**
     Sa demande du 30 août : *« ça doit être un bouton secondaire, car l'idée
     c'est qu'il utilise en priorité la note vocale »*. Le contrôle mesure la
     couleur : le bouton n'a **aucun aplat** (fond transparent), et pendant
     l'enregistrement **le seul plein de l'écran est le rond d'envoi**. Sans
     cette seconde moitié, on pourrait pâlir le bouton et laisser deux aplats
     en concurrence — ce serait la demande manquée.

     Il reste plus étroit qu'avant (« réduis UN PEU » : entre 60 % et 95 % de la
     largeur des cases), jamais moins de 44 px de haut, et les quatre largeurs
     de l'onglet « Largeur » s'appliquent RÉELLEMENT à l'écran de la fiche —
     sinon il choisirait un chiffre qui ne change rien.

  8. **Rien ne se mesure sur une boîte de zéro pixel** (`CLAUDE.md` §5 : le
     contrôle qui rendait « 0 − 0 = 0 » en vert sur un écran fautif).

  9. **Les zones touchées font au moins 44 px**, poubelle comprise : c'est un
     écran qu'on manipule sur un chantier, parfois avec des gants.

  **Il sait échouer.** Éprouvé en rendant la poubelle inerte (elle laissait
  alors le chrono courir), en la faisant mener au devis, en neutralisant la
  pause, en posant le bouton à 100 %, en le repeignant en aplat plein, en
  laissant l'anneau visible pendant l'enregistrement, et en coupant le report
  du nom vers le devis : chacun rougit, en nommant le point exact.

  Usage : node scripts/verifier-maquette-note-vocale-simple.mjs [chemin.html]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIBLE = resolve(process.argv[2] ?? join(RACINE, "appli", "note-vocale-simple.html"));

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

const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();
page.on("pageerror", (e) => plaintes.push(`script en défaut : ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") plaintes.push(`erreur de console : ${m.text()}`);
});

// `networkidle` et non `load` : sans la mise en page appliquée, toutes les
// largeurs valent zéro et le contrôle rendrait un vert qui ne prouve rien.
await page.goto(`file://${CIBLE}`, { waitUntil: "networkidle" });

console.log("=== La note vocale, à la manière d'une messagerie ===\n");

/** Ramène la maquette à son point de départ, sur la proposition demandée. */
async function ouvrirLa(variante) {
  await page.click(`.onglets button[data-variante="${variante}"]`);
  await page.waitForTimeout(60);
}

/** Ce qui est réellement visible sous une proposition donnée. */
const visible = (sel) => page.locator(sel).isVisible();

// ── 1. Au repos : l'anneau, et rien d'autre ────────────────────────────────
dire(await visible("#anneau"), "à l'arrivée, l'anneau d'aujourd'hui est là");
dire(
  !(await visible("#v1")) && !(await visible("#v2")) && !(await visible("#v3")),
  "et aucune barre d'enregistrement avant d'avoir parlé"
);
dire(
  (await page.locator("#indice").innerText()).trim() === "Appuyez et décrivez le chantier",
  "la consigne est celle de son écran, mot pour mot"
);

// L'anneau est bien celui de l'application, pas un rond redessiné.
dire(
  (await page.locator("#anneau span[data-cercle]").count()) === 2,
  "l'anneau porte ses deux cercles (74 px vert pin, 56 px or)"
);
dire(
  (await page.locator("#anneau .atlas-aile-g i").count()) === 8,
  "huit barreaux par aile, comme dans `globals.css`"
);

// ── 2. Les deux propositions portent les MÊMES gestes ──────────────────────
dire(
  (await page.locator(".onglets button[data-variante]").count()) === 2,
  "deux propositions, pas trois — celle où l'anneau restait au centre contredit sa règle"
);
for (const variante of ["1", "2"]) {
  console.log(`\n  ── Proposition ${variante} ──`);
  await ouvrirLa(variante);

  dire(await visible("#anneau"), `${variante} · on repart de l'anneau au repos`);
  await page.click("#dicter");
  await page.waitForTimeout(120);

  const vue = `#v${variante}`;
  dire(await visible(vue), `${variante} · l'appui ouvre l'enregistrement`);
  dire(!(await visible("#anneau")), `${variante} · l'anneau au repos a laissé la place`);

  const poubelle = page.locator(`${vue} [data-jeter]`);
  const avion = page.locator(`${vue} [data-envoyer]`);
  dire(await poubelle.isVisible(), `${variante} · la poubelle est là — « possibilité de supprimer »`);
  dire(await avion.isVisible(), `${variante} · l'avion est là — « appuyer pour envoyer de suite »`);

  // Un bouton qu'on rate ne sert à rien : 44 px, la mesure d'Apple, et il
  // travaille avec des gants.
  for (const [quoi, bouton] of [["la poubelle", poubelle], ["l'avion", avion]]) {
    const boite = await bouton.boundingBox();
    dire(
      boite !== null && boite.width >= 44 && boite.height >= 44,
      `${variante} · ${quoi} fait au moins 44 px (mesuré : ${boite ? `${Math.round(boite.width)}×${Math.round(boite.height)}` : "rien à mesurer"})`
    );
  }

  // Le chrono tourne pour de bon — deux secondes réelles, pas une classe CSS.
  await page.waitForTimeout(2200);
  const apresDeux = (await page.locator(`${vue} [data-chrono]`).innerText()).trim();
  dire(apresDeux !== "0:00", `${variante} · le chrono avance (lu : ${apresDeux})`);

  // **L'onde se déroule VRAIMENT, et se compter ne suffit pas.** Elle part
  // pleine, à plat : compter les barreaux rendrait vrai même si rien ne
  // bougeait. Ce qui prouve le mouvement, ce sont les barreaux HAUTS — ceux
  // que la voix a fait naître.
  const hauts = await page.locator(`${vue} [data-onde] i`).evaluateAll(
    (tous) => tous.filter((i) => i.getBoundingClientRect().height > 3).length
  );
  dire(hauts > 4, `${variante} · l'onde se déroule (${hauts} barreaux nés de la voix)`);
  const large = await page.locator(`${vue} [data-onde]`).evaluate((o) => o.getBoundingClientRect().width);
  dire(large > 40, `${variante} · et elle occupe sa place dès la première seconde (${Math.round(large)} px)`);

  // ── La pause : présente en 1 et 2, absente en 3 (il ne l'a pas demandée) ──
  const pause = page.locator(`${vue} [data-pause]`);
  if (variante === "2") {
    dire((await pause.count()) === 0, "2 · pas de pause — un bouton de moins sous le pouce");
  } else {
    dire(await pause.isVisible(), `${variante} · la pause est là, comme sur sa capture`);
    await pause.click();
    const fige = (await page.locator(`${vue} [data-chrono]`).innerText()).trim();
    await page.waitForTimeout(1600);
    dire(
      (await page.locator(`${vue} [data-chrono]`).innerText()).trim() === fige,
      `${variante} · en pause, le chrono s'arrête VRAIMENT (resté à ${fige})`
    );
    await pause.click();
    await page.waitForTimeout(1300);
    dire(
      (await page.locator(`${vue} [data-chrono]`).innerText()).trim() !== fige,
      `${variante} · et il repart au second appui`
    );
  }

  // ── La poubelle : elle jette, et elle ne mène nulle part ─────────────────
  await poubelle.click();
  await page.waitForTimeout(120);
  dire(await visible("#anneau"), `${variante} · jeter ramène l'anneau au repos`);
  dire(!(await visible(vue)), `${variante} · l'enregistrement a disparu`);
  dire(
    await page.locator("#fiche").evaluate((e) => e.classList.contains("actif")),
    `${variante} · jeter ne mène nulle part — on reste sur la fiche`
  );
  // Le compteur repart de zéro : une note jetée dont le chrono garderait sa
  // valeur laisserait croire qu'elle est encore là.
  await page.click("#dicter");
  await page.waitForTimeout(80);
  dire(
    (await page.locator(`${vue} [data-chrono]`).innerText()).trim() === "0:00",
    `${variante} · la note suivante repart de 0:00`
  );

  // ── L'avion : il envoie, et l'on arrive sur le devis ─────────────────────
  await page.fill("#nom", "M. Chevallier");
  await avion.click();
  dire(await visible("#attente"), `${variante} · l'attente de la transcription se voit`);
  await page.waitForTimeout(1800);
  dire(
    await page.locator("#devis").evaluate((e) => e.classList.contains("actif")),
    `${variante} · on arrive sur la page du devis, « comme c'est déjà le cas »`
  );
  dire(
    (await page.locator("#devis-nom").innerText()).trim() === "M. Chevallier",
    `${variante} · et le devis porte le nom SAISI, pas un nom d'exemple`
  );
  // Le nom reste tel quel : l'écran de la fiche est masqué derrière le devis,
  // et y écrire depuis ici échouerait sur une case qu'on ne voit pas.
}

// ── 3. Aucun prix inventé sur le devis ─────────────────────────────────────
console.log("\n  ── Le devis ──");
const lignes = page.locator("#devis .ligne-devis .prix");
const nbLignes = await lignes.count();
dire(nbLignes > 0, `le devis porte ses lignes (${nbLignes})`);
for (let i = 0; i < nbLignes; i++) {
  dire(
    (await lignes.nth(i).innerText()).trim() === "à chiffrer",
    `ligne ${i + 1} : « à chiffrer » — aucun montant n'a été dicté, aucun n'est inventé`
  );
}
dire(
  !(await page.locator("#devis").innerText()).includes("€"),
  "aucun euro nulle part sur le devis"
);

// ── 4. La largeur du bouton « Je rédige mon devis » ────────────────────────
console.log("\n  ── Le bouton du bas : secondaire ──");
await ouvrirLa("1");
const bouton = page.locator("#ecrire");
dire(
  (await bouton.innerText()).trim() === "Je rédige à la main",
  `le libellé est le sien, à la lettre (lu : « ${(await bouton.innerText()).trim()} »)`
);

/** Une couleur est-elle un aplat, ou du vide ? `transparent` rend alpha 0. */
async function fond(cible) {
  return cible.evaluate((el) => getComputedStyle(el).backgroundColor);
}
const estVide = (c) => /rgba\(.*,\s*0\)$/.test(c) || c === "transparent";

const fondBouton = await fond(bouton);
dire(estVide(fondBouton), `le bouton n'a AUCUN aplat (mesuré : ${fondBouton})`);
dire(
  await bouton.evaluate((el) => getComputedStyle(el).boxShadow !== "none"),
  "il porte un liseré — secondaire, pas effacé"
);

// **La seconde moitié, celle qui compte.** Un bouton pâle ne suffit pas : ce
// qui doit attirer l'œil, c'est la dictée. On vérifie donc qu'à l'écran, PENDANT
// l'enregistrement, il n'y a qu'un seul aplat plein — le rond d'envoi.
await page.click("#dicter");
await page.waitForTimeout(150);
//
// **« Plein » se mesure en CONTRASTE, pas en « a-t-il un fond ».** Première
// version : tout bouton dont le fond n'était pas transparent. Elle accusait le
// micro du coin, les deux pastilles Mr/Mme et la capsule « Par SMS » — des
// SURFACES, à un cheveu du fond de page (1,03 de contraste), que personne ne
// lit comme un appel à l'action. Le contrôle désignait donc le mauvais
// coupable, ce qui coûte plus cher que pas de contrôle du tout.
const pleins = await page.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/[\d.]+/g).map(Number);
    const v = [r, g, b].map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const contraste = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const page = getComputedStyle(document.body).backgroundColor;
  return Array.from(document.querySelectorAll("#fiche button"))
    .filter((b) => b.offsetParent !== null)
    .filter((b) => {
      const c = getComputedStyle(b).backgroundColor;
      if (/rgba\(.*,\s*0\)$/.test(c) || c === "transparent") return false;
      // 3:1 — le seuil qui sépare un aplat d'action d'une simple surface.
      return contraste(c, page) >= 3;
    })
    .map((b) => b.className || b.getAttribute("aria-label") || "?");
});
dire(
  pleins.length === 1 && pleins[0].includes("envoyer"),
  `le seul aplat plein de l'écran est le rond d'envoi (trouvé : ${pleins.join(" · ") || "aucun"})`
);
await page.locator("#v1 [data-jeter]").click();
await page.waitForTimeout(120);

console.log("\n  ── La largeur du bouton ──");
const caseAdresse = page.locator('input[placeholder="12 rue des Lilas, Nantes"]');
const bBouton = await bouton.boundingBox();
const bCase = await caseAdresse.boundingBox();
dire(
  bBouton !== null && bCase !== null && bBouton.width > 0 && bCase.width > 0,
  "les deux sont dessinés (une boîte de zéro pixel ne se mesure pas)"
);
if (bBouton && bCase) {
  const part = bBouton.width / bCase.width;
  dire(part < 0.95, `le bouton est plus étroit que les cases (${Math.round(part * 100)} % de leur largeur)`);
  dire(part > 0.6, "mais il reste un bouton, pas une pastille — « réduis UN PEU »");
  dire(bBouton.height >= 44, `et il garde sa hauteur de doigt (${Math.round(bBouton.height)} px)`);
  dire(
    Math.abs(bBouton.x + bBouton.width / 2 - (bCase.x + bCase.width / 2)) < 2,
    "il est centré sous le formulaire"
  );
}

// Les quatre propositions changent VRAIMENT l'écran : sans cela, il choisirait
// un chiffre qui ne fait rien.
const largeurs = [];
const nbEssais = await page.locator(".essai-largeur").count();
dire(nbEssais === 4, `quatre largeurs sont proposées (${nbEssais})`);
for (let i = 0; i < nbEssais; i++) {
  await page.click(".onglets button[data-va='largeur']");
  await page.locator(".essai-largeur").nth(i).click();
  await ouvrirLa("1");
  await page.waitForTimeout(280);
  const b = await page.locator("#ecrire").boundingBox();
  largeurs.push(b ? Math.round(b.width) : 0);
}
dire(
  largeurs.every((l) => l > 0),
  `chaque largeur se mesure (${largeurs.join(" · ")} px)`
);
dire(
  new Set(largeurs).size === largeurs.length,
  "les quatre donnent quatre largeurs différentes sur l'écran de la fiche"
);
// Les quatre propositions montrent le bouton TEL QU'IL SERA : un faux-bouton
// resté plein ferait choisir une largeur sur un dessin qui n'existe plus.
await page.click(".onglets button[data-va='largeur']");
const fauxPleins = await page.evaluate(() => {
  const vide = (c) => /rgba\(.*,\s*0\)$/.test(c) || c === "transparent";
  return Array.from(document.querySelectorAll(".essai-largeur .faux-bouton"))
    .filter((b) => !vide(getComputedStyle(b).backgroundColor)).length;
});
dire(fauxPleins === 0, `les quatre exemples sont secondaires eux aussi (${fauxPleins} en aplat)`);
dire(
  largeurs[0] > largeurs[1] && largeurs[1] > largeurs[2] && largeurs[2] > largeurs[3],
  "et elles vont bien de la plus large à la plus étroite"
);

// ── 5. Ce que la maquette reprend de l'application, sans le redessiner ─────
console.log("\n  ── Repris de l'application ──");
const fichier = page.locator('input[type="file"]');
dire((await fichier.count()) === 1, "un seul champ de fichier, comme dans `Pellicule.tsx`");
dire((await fichier.getAttribute("accept")) === "image/*", "il accepte les images");
dire((await fichier.getAttribute("multiple")) !== null, "il en prend plusieurs d'un coup");
dire(
  (await fichier.getAttribute("capture")) === null,
  "il n'IMPOSE pas l'appareil photo — sur iPhone, `capture` retire l'accès à la pellicule"
);

// ── Verdict ───────────────────────────────────────────────────────────────
await navigateur.close();
console.log("");
if (plaintes.length) {
  console.error(`✗ ${plaintes.length} défaut(s) :`);
  plaintes.forEach((p) => console.error(`   · ${p}`));
  process.exit(1);
}
console.log("✓ La planche tient : l'anneau disparaît, les deux propositions ont les mêmes gestes, jeter ne mène nulle part, l'avion mène au devis, et le seul plein de l'écran est le rond d'envoi.");
