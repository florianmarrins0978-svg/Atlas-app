/*
  LE PLAN D'ARROSAGE DESSINÉ — ce que cette maquette doit tenir.

  Sa demande du 21 août 2026, capture à l'appui : *« il manque la photo, le
  schéma avec les réseaux, et l'implantation des arroseurs — les différents
  réseaux de couleurs »*. L'application rendait trois listes et aucun dessin,
  et deux de ses réseaux portaient LE MÊME nom, tronqué :
  « Pelouse pas de gazon à gauche … ».

  CE CONTRÔLE NE REGARDE PAS UNE MISE EN PAGE, IL RECALCULE LE PLAN.

    1. **La forme est la SIENNE.** La surface se recalcule depuis le polygone
       dessiné et doit valoir ce que la page annonce. Un plan joli sur une
       forme fausse ferait commander les pièces d'un autre jardin.
    2. **Aucun coin de pelouse n'est oublié.** C'est LE contrôle du métier : on
       maille la pelouse et l'on vérifie que chaque point est à portée d'au
       moins un arroseur. Un trou dans la couverture est une tache jaune en
       juillet, et personne ne le voit sur un dessin.
    3. **Aucun réseau ne dépasse le débit disponible.** Une voie trop chargée
       fait tomber la pression : les arroseurs sortent à moitié et arrosent
       court — le défaut le plus cher, parce qu'il ne se voit qu'en août.
    4. **Les métrés sont MESURÉS sur le tracé**, jamais saisis : on relit les
       polylignes et l'on compare aux mètres annoncés.
    5. **Aucun nom de réseau tronqué ni répété** — le défaut exact de sa
       capture. Deux réseaux qui portent le même nom ne se distinguent plus sur
       le terrain, et c'est la mauvaise vanne qu'on ferme.
    6. **Rien ne déborde à 390 px**, la largeur de son téléphone.

  Il sait échouer : éprouvé en déplaçant un arroseur (trou de couverture), en
  gonflant un débit au-dessus de 1,80, en rallongeant un métré affiché, et en
  donnant deux fois le même nom à deux réseaux. Chacun rougit en nommant le
  point exact.

  Usage : node scripts/verifier-maquette-arrosage-plan.mjs [chemin.html]
*/
import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHEMIN = resolve(process.argv[2] ?? join(RACINE, "appli/arrosage-plan.html"));
if (!existsSync(CHEMIN)) {
  console.error(`❌ Maquette introuvable : ${CHEMIN}`);
  process.exit(1);
}

/** Le débit disponible au compteur, annoncé par la page elle-même. */
const DEBIT_DISPONIBLE = 1.8;

let echecs = 0;
const cas = (nom, fn) => {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e.message}`);
  }
};

const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
const page = await (await navigateur.newContext({ viewport: { width: 390, height: 900 } })).newPage();
await page.goto(`file://${CHEMIN}`, { waitUntil: "load" });

// ── Ce que la page DESSINE, relu depuis le SVG ──────────────────────────────
const vu = await page.evaluate(() => {
  const nb = (v) => Number.parseFloat(v);
  const contour = document.querySelector("#pelouse polygon").getAttribute("points")
    .trim().split(/\s+/).map((p) => p.split(",").map(Number));

  const reseaux = {};
  for (const g of document.querySelectorAll("svg g.r")) {
    const n = Number(g.className.baseVal.match(/r(\d)\b/)[1]);
    reseaux[n] = {
      // Les têtes portent un rayon d'affichage ; la PORTÉE est le cercle pâle.
      tetes: [...g.querySelectorAll("circle")].filter((c) => nb(c.getAttribute("r")) < 1)
        .map((c) => [nb(c.getAttribute("cx")), nb(c.getAttribute("cy"))]),
      portees: [...g.querySelectorAll("circle")].filter((c) => nb(c.getAttribute("r")) >= 1)
        .map((c) => [nb(c.getAttribute("cx")), nb(c.getAttribute("cy")), nb(c.getAttribute("r"))]),
      tuyaux: [...g.querySelectorAll("polyline")].map((l) =>
        l.getAttribute("points").trim().split(/\s+/).map((p) => p.split(",").map(Number))),
    };
  }

  const cartes = [...document.querySelectorAll(".carte")].map((li) => ({
    nom: li.querySelector(".nom").textContent.trim(),
    // Ce qui est VU : un libellé coupé par CSS ne se lit pas en entier.
    coupe: li.querySelector(".nom").scrollWidth > li.querySelector(".nom").clientWidth + 1,
    debit: Number(li.querySelector(".debit").textContent.replace(",", ".").match(/[\d.]+/)[0]),
    sous: li.querySelector(".sous").textContent,
  }));

  return {
    contour,
    reseaux,
    cartes,
    texte: document.body.innerText,
    deborde: document.documentElement.scrollWidth > 390,
    photo: Boolean(document.querySelector("img[src^='data:image']")),
  };
});

console.log("\n=== Le plan d'arrosage, dessiné à ses cotes ===\n");

// ── 1. La forme est la sienne ───────────────────────────────────────────────
const aire = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};
const surface = aire(vu.contour);

cas("la surface dessinée est celle qu'on annonce", () => {
  const annonce = Number(vu.texte.match(/(\d+)\s*m²/)?.[1]);
  if (!annonce) throw new Error("la page n'annonce aucune surface");
  if (Math.abs(annonce - surface) > 1) {
    throw new Error(`le plan dessine ${surface} m² et la page annonce ${annonce} m² — un plan juste sur une forme fausse fait commander les pièces d'un autre jardin`);
  }
});

cas("la photo du croquis est là", () => {
  if (!vu.photo) throw new Error("aucune photo : il ne retrouve pas le croquis qu'il a envoyé");
});

// ── 2. Aucun coin de pelouse n'est oublié ───────────────────────────────────
const dedans = (x, y, pts) => {
  let ok = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
};
const toutesPortees = Object.values(vu.reseaux).flatMap((r) => r.portees);

cas("aucun coin de pelouse n'est laissé sans eau", () => {
  const trous = [];
  for (let x = 0.25; x < 20; x += 0.5) {
    for (let y = 0.25; y < 12; y += 0.5) {
      if (!dedans(x, y, vu.contour)) continue;
      const couvert = toutesPortees.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r + 0.01);
      if (!couvert) trous.push(`${x}×${y}`);
    }
  }
  if (trous.length > 0) {
    throw new Error(`${trous.length} m² sans arrosage, à partir de ${trous[0]} m — c'est une tache jaune en juillet, et elle ne se voit pas sur le dessin`);
  }
});

// ── 3. Aucun réseau ne dépasse le débit disponible ──────────────────────────
cas(`aucun réseau ne dépasse les ${DEBIT_DISPONIBLE} m³/h du compteur`, () => {
  for (const c of vu.cartes) {
    if (c.debit > DEBIT_DISPONIBLE + 0.001) {
      throw new Error(`« ${c.nom} » demande ${c.debit} m³/h : la pression tombera et les arroseurs sortiront à moitié`);
    }
  }
});

cas("chaque réseau annonce le nombre d'arroseurs qu'il DESSINE", () => {
  vu.cartes.forEach((c, i) => {
    const n = Number(c.sous.match(/(\d+)\s*arroseurs/)?.[1]);
    const dessines = vu.reseaux[i + 1].tetes.length;
    if (n !== dessines) {
      throw new Error(`« ${c.nom} » annonce ${n} arroseurs et le plan en dessine ${dessines}`);
    }
  });
});

// ── 4. Les métrés sont MESURÉS sur le tracé ─────────────────────────────────
cas("les métrés de tuyau se retrouvent sur le tracé", () => {
  vu.cartes.forEach((c, i) => {
    const annonce = Number(c.sous.match(/(\d+)\s*ml/)?.[1]);
    const mesure = vu.reseaux[i + 1].tuyaux.reduce(
      (t, poly) => t + poly.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - poly[k][0], p[1] - poly[k][1]), 0),
      0
    );
    // Un tronçon peut être partagé et n'être compté qu'une fois : on n'exige
    // donc pas l'égalité, mais qu'aucun métré ne DÉPASSE ce qui est dessiné —
    // c'est le sens qui fait acheter du tuyau pour rien.
    if (annonce > mesure + 0.6) {
      throw new Error(`« ${c.nom} » annonce ${annonce} ml pour ${mesure.toFixed(1)} ml dessinés : il en achèterait trop`);
    }
  });
});

// ── 5. Le défaut exact de sa capture ────────────────────────────────────────
cas("aucun nom de réseau répété ni coupé", () => {
  const noms = vu.cartes.map((c) => c.nom);
  const doubles = noms.filter((n, i) => noms.indexOf(n) !== i);
  if (doubles.length > 0) {
    throw new Error(`deux réseaux portent le même nom (« ${doubles[0]} ») : sur le terrain, c'est la mauvaise vanne qu'on ferme`);
  }
  const coupe = vu.cartes.find((c) => c.coupe || /…|\.\.\./.test(c.nom));
  if (coupe) throw new Error(`« ${coupe.nom} » ne se lit pas en entier`);
});

// ── 6. Son téléphone ────────────────────────────────────────────────────────
cas("rien ne déborde sur 390 px", () => {
  if (vu.deborde) throw new Error("la page déborde en largeur : il devra la faire glisser pour lire");
});

// ── La sélection d'un réseau marche, et sans une ligne de script ────────────
for (const n of [1, 2, 3]) {
  await page.click(`label[for=v${n}]`);
  await page.waitForTimeout(120);
  const opacites = await page.evaluate(() =>
    [...document.querySelectorAll("svg g.r")].map((g) => Number(getComputedStyle(g).opacity))
  );
  cas(`choisir le réseau ${n} met les autres en retrait`, () => {
    if (opacites[n - 1] < 0.9) throw new Error(`le réseau ${n} s'efface au lieu de ressortir`);
    const autres = opacites.filter((_, i) => i !== n - 1);
    if (autres.some((o) => o > 0.5)) {
      throw new Error(`les autres réseaux restent au premier plan (${autres.join(", ")}) : on ne voit pas lequel est choisi`);
    }
    // **Ils s'effacent SANS disparaître** : il doit voir ce qui reste à couvrir.
    if (autres.some((o) => o === 0)) throw new Error("les autres réseaux disparaissent : le jardin paraît s'arrêter là");
  });
}

await navigateur.close();
console.log(`\n${echecs === 0 ? "✅" : "❌"} La maquette du plan d'arrosage — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
