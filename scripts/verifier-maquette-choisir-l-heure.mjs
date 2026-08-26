#!/usr/bin/env node
/*
  Garde la molette du temps passé.

  **Ce que ce contrôle doit attraper, et qu'aucun œil ne verra sur une capture :**

  1. **Aucun JavaScript.** Le lecteur du patron n'en exécute pas ; une planche
     bâtie en JS lui arrive vide en passant tous les contrôles ordinaires.
  2. **La molette s'accroche VRAIMENT.** Une bande qui défile librement paraît
     identique sur une image et se révèle imprécise au doigt : le cran choisi
     n'est jamais tout à fait sous le repère.
  3. **Le repère est au centre de la fenêtre.** C'est le piège consigné le
     10 août 2026 : un rembourrage posé sur le CONTENEUR au lieu du CONTENU
     décale le repère de la moitié, et rien ne le montre sur une capture.

  ─── ET IL REFUSE DE CONCLURE SUR DU VIDE ────────────────────────────────────
  **Payé le 15 août 2026** : une suite comparait deux largeurs valant toutes
  deux ZÉRO — la feuille de style n'était pas appliquée — et rendait « rien
  n'est coupé », en vert, sur un écran où trois noms l'étaient. Ici, une boîte
  de zéro pixel fait ÉCHOUER le contrôle au lieu de le faire passer.
  ─────────────────────────────────────────────────────────────────────────────
*/

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLANCHE = join(RACINE, "appli", "choisir-l-heure.html");
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
async function cas(nom, verifier) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("=== La molette du temps passé ===");

const source = readFileSync(PLANCHE, "utf8");

await cas("aucun JavaScript", () => {
  assert(!/<script/i.test(source), "la planche porte une balise <script>");
  assert(!/javascript:/i.test(source), "la planche porte un lien javascript:");
  assert(!/\son[a-z]+\s*=\s*["']/i.test(source), "la planche porte un gestionnaire en ligne");
});

await cas("le pas est de cinq minutes, et rien d'autre", () => {
  const crans = [...source.matchAll(/<div class="v">(\d) h (\d\d)<\/div>/g)].map((m) => m[2]);
  assert(crans.length > 20, `seulement ${crans.length} crans : la molette est-elle encore là ?`);
  const mauvais = crans.filter((m) => Number(m) % 5 !== 0);
  assert(mauvais.length === 0, `des crans hors du pas de cinq minutes : ${mauvais.join(", ")}`);
});

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
// Sans JavaScript, comme chez lui.
const contexte = await navigateur.newContext({ javaScriptEnabled: false });
const page = await contexte.newPage();
// **`networkidle`, pas `domcontentloaded`.** Mesurer avant que la feuille de
// style ne soit appliquée rend des boîtes de zéro pixel — et un contrôle qui
// mesure zéro ne mesure rien (CLAUDE.md §5).
await page.goto(`file://${PLANCHE}`, { waitUntil: "networkidle" });
await page.locator('label[for="h-c"]').click();
await page.waitForTimeout(300);

await cas("les quatre gestes existent, et le RETENU s'ouvre le premier", async () => {
  for (const v of ["h-a", "h-b", "h-c", "h-d"]) {
    assert((await page.locator(`label[for="${v}"]`).count()) === 1, `le geste ${v} a disparu`);
  }
  // **Sa décision du 25 août 2026 : la molette, MAIS EN DEUX COLONNES** — *« la
  // molette, mais avec d'un côté les heures qu'on peut bouger et de l'autre les
  // minutes qu'on peut bouger séparément »*. Elle remplace « la A » du 16 août,
  // et c'est elle qui doit s'ouvrir : une planche qui rouvrirait sur un autre
  // geste lui montrerait, dans six mois, autre chose que ce qu'il a choisi.
  assert(
    /id="h-d" class="etat" checked/.test(source),
    "la planche ne s'ouvre plus sur les deux colonnes, retenues le 25 août 2026"
  );
});

await cas("la molette a bien une matière à mesurer", async () => {
  const boite = await page.locator(".hc .bande").boundingBox();
  assert(boite, "la bande n'existe pas");
  // **Le refus de conclure sur du vide.** Sans cette borne, tout ce qui suit
  // rendrait « juste » sur une page dont la mise en forme n'a pas pris.
  assert(
    boite.height > 100 && boite.width > 100,
    `la bande mesure ${Math.round(boite.width)}×${Math.round(boite.height)} px : ` +
      "la mise en forme n'est pas appliquée, aucune mesure ne prouve rien"
  );
});

await cas("le repère est au CENTRE de la fenêtre, pas ailleurs", async () => {
  const bande = await page.locator(".hc .bande").boundingBox();
  const repere = await page.locator(".hc .repere").boundingBox();
  assert(repere, "le repère a disparu");
  // Le repère a une hauteur nulle et dessine sa bande en `::before` : on vise
  // donc son sommet, qui doit tomber à un demi-cran au-dessus du milieu.
  const milieuBande = bande.y + bande.height / 2;
  const hautRepere = repere.y;
  const ecart = Math.abs(hautRepere + 24 - milieuBande);
  assert(
    ecart < 6,
    `le repère est à ${Math.round(ecart)} px du centre : le rembourrage a dû glisser ` +
      "du contenu vers le conteneur (piège du 10 août 2026)"
  );
});

await cas("la molette s'accroche : le cran choisi tombe SOUS le repère", async () => {
  // Le défilement programmé subit bien l'accroche, contrairement à une molette
  // synthétique — c'est le procédé retenu le 10 août 2026.
  await page.locator(".hc .bande").evaluate((n) => {
    n.scrollTop = 20 * 48 + 11; // volontairement DÉCALÉ de 11 px
  });
  await page.waitForTimeout(500);
  const bande = await page.locator(".hc .bande").boundingBox();
  const milieu = bande.y + bande.height / 2;
  const crans = await page.locator(".hc .v").all();
  let meilleur = null;
  for (const cran of crans) {
    const b = await cran.boundingBox();
    if (!b || b.height === 0) continue;
    const centre = b.y + b.height / 2;
    const d = Math.abs(centre - milieu);
    if (!meilleur || d < meilleur.d) meilleur = { d, texte: (await cran.innerText()).trim() };
  }
  assert(meilleur, "aucun cran mesurable : la molette est vide");
  assert(
    meilleur.d < 8,
    `le cran le plus proche (« ${meilleur.texte} ») est à ${Math.round(meilleur.d)} px du repère : ` +
      "l'accroche ne rattrape plus le décalage, et le choix sera imprécis au doigt"
  );
});

// ─── D · LES DEUX COLONNES, SA DEMANDE DU 25 AOÛT 2026 ──────────────────────
//
// *« La molette, mais avec d'un côté les heures qu'on peut bouger et de l'autre
// les minutes qu'on peut bouger séparément. »* Tout est là : **séparément**. Une
// planche où les deux colonnes défileraient ensemble n'aurait rien changé à la C,
// et il ne le verrait qu'en la manipulant sur son téléphone.
await page.locator('label[for="h-d"]').click();
await page.waitForTimeout(300);

await cas("D : deux colonnes, et elles ont une matière à mesurer", async () => {
  // **`> .bande`, et non `.bande` : le chemin direct, pas n'importe où dessous.**
  // La première version comptait `.hd .bande` — un simple enveloppement des deux
  // colonnes dans une SEULE zone de défilement (c'est-à-dire la C redessinée)
  // laissait le compte à deux et le contrôle au vert. Trouvé en fabriquant
  // exactement cette dégradation.
  const bandes = page.locator(".hd .colonnes > .bande");
  assert((await bandes.count()) === 2, `${await bandes.count()} colonne(s) au lieu de deux`);
  // **Et chacune doit VRAIMENT défiler.** Une colonne dont le contenu tient
  // entier n'a rien à faire tourner : elle se lirait comme un choix figé.
  const defilent = await bandes.evaluateAll((ns) =>
    ns.map((n) => n.scrollHeight - n.clientHeight)
  );
  for (const [i, marge] of defilent.entries()) {
    assert(
      marge > 48,
      `la colonne ${i + 1} n'a que ${Math.round(marge)} px à faire défiler : rien à tourner au doigt`
    );
  }
  for (let i = 0; i < 2; i++) {
    const b = await bandes.nth(i).boundingBox();
    assert(b, `la colonne ${i + 1} n'existe pas`);
    assert(
      b.height > 100 && b.width > 40,
      `la colonne ${i + 1} mesure ${Math.round(b.width)}×${Math.round(b.height)} px : ` +
        "la mise en forme n'est pas appliquée, aucune mesure ne prouve rien"
    );
  }
});

await cas("D : les colonnes bougent SÉPARÉMENT — le cœur de sa demande", async () => {
  const bandes = page.locator(".hd .colonnes > .bande");
  await bandes.nth(0).evaluate((n) => { n.scrollTop = 0; });
  await bandes.nth(1).evaluate((n) => { n.scrollTop = 0; });
  await page.waitForTimeout(400);
  // On ne bouge QUE les heures : si les minutes suivent, les deux bandes n'en
  // font qu'une, et la D ne serait qu'une C redessinée.
  await bandes.nth(0).evaluate((n) => { n.scrollTop = 48 * 3; });
  await page.waitForTimeout(500);
  const [h, m] = await bandes.evaluateAll((ns) => ns.map((n) => n.scrollTop));
  assert(h > 100, `la colonne des heures n'a pas bougé (${Math.round(h)} px)`);
  assert(
    m < 8,
    `les minutes ont suivi les heures (${Math.round(m)} px) : les deux colonnes n'en font ` +
      "qu'une, et « séparément » — le mot de sa demande — n'est pas tenu"
  );
});

await cas("D : un SEUL repère, et il traverse les deux colonnes", async () => {
  const rep = await page.locator(".hd .repere-2").boundingBox();
  assert(rep, "le repère a disparu");
  const gauche = await page.locator(".hd .colonnes > .bande").nth(0).boundingBox();
  const droite = await page.locator(".hd .colonnes > .bande").nth(1).boundingBox();
  // **Un repère par colonne se lirait comme deux réglages sans rapport** : c'est
  // UNE durée qu'on choisit.
  assert(
    rep.x <= gauche.x + 2 && rep.x + rep.width >= droite.x + droite.width - 2,
    "le repère ne couvre pas les deux colonnes : on lirait deux réglages séparés"
  );
  const milieu = gauche.y + gauche.height / 2;
  const ecart = Math.abs(rep.y + rep.height / 2 - milieu);
  assert(ecart < 6, `le repère est à ${Math.round(ecart)} px du centre des colonnes`);
});

await cas("D : chaque colonne s'accroche sous le repère", async () => {
  const bandes = page.locator(".hd .colonnes > .bande");
  // Décalés EXPRÈS de 11 px : sans accroche, le cran resterait entre deux.
  await bandes.nth(0).evaluate((n) => { n.scrollTop = 48 * 2 + 11; });
  await bandes.nth(1).evaluate((n) => { n.scrollTop = 48 * 7 - 11; });
  await page.waitForTimeout(600);
  const lu = await page.evaluate(() => {
    const rep = document.querySelector(".hd .repere-2").getBoundingClientRect();
    const cible = rep.top + rep.height / 2;
    return [...document.querySelectorAll(".hd .colonnes > .bande")].map((b) => {
      let meilleur = null;
      for (const v of b.querySelectorAll(".v")) {
        const r = v.getBoundingClientRect();
        if (r.height === 0) continue;
        const d = Math.abs(r.top + r.height / 2 - cible);
        if (!meilleur || d < meilleur.d) meilleur = { d, texte: v.innerText.trim() };
      }
      return meilleur;
    });
  });
  for (const [i, m] of lu.entries()) {
    assert(m, `aucun cran mesurable dans la colonne ${i + 1} : elle est vide`);
    assert(
      m.d < 8,
      `colonne ${i + 1} : le cran « ${m.texte} » est à ${Math.round(m.d)} px du repère — ` +
        "l'accroche ne rattrape plus le décalage, et le choix sera imprécis au doigt"
    );
  }
  // `assert` est la fonction locale de ce fichier, pas celle de Node : elle ne
  // sait comparer que des booléens, et l'appeler `deepEqual` échouait sur son
  // propre outillage plutôt que sur la molette — un rouge qui accuse le mauvais
  // coupable (CLAUDE.md §5).
  const lus = lu.map((m) => m.texte).join(" h ");
  assert(lus === "2 h 35", `les deux colonnes lisent « ${lus} » au lieu de « 2 h 35 »`);
});

// **AUCUN CHIFFRE FAUX SOUS LA MOLETTE.** Elle portait « − 50 min » écrit en dur,
// qui ne suivait pas : 2 h 35 sur 2 h 30 prévues s'affichait « − 50 min ». Deux
// chiffres qui se contredisent dans le même écran, et c'est toute la liste qu'on
// cesse de croire (CLAUDE.md §4 bis).
await cas("l'écart ne porte aucun chiffre que la page ne peut pas tenir", async () => {
  const texte = (await page.locator(".ecart .pastille").innerText()).trim();
  assert(
    !/\d/.test(texte),
    `l'écart annonce « ${texte} » : un chiffre écrit en dur qui ne suit pas la molette, ` +
      "donc faux dès qu'on la fait tourner"
  );
});

await contexte.close();
await navigateur.close();

console.log(`\n${echecs === 0 ? "✅" : "❌"} La molette — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
