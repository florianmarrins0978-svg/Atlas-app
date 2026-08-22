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
      tetes: [...g.querySelectorAll("[data-famille]")].map((e) =>
        e.tagName === "circle"
          ? [nb(e.getAttribute("cx")), nb(e.getAttribute("cy"))]
          : [nb(e.getAttribute("x")) + nb(e.getAttribute("width")) / 2,
             nb(e.getAttribute("y")) + nb(e.getAttribute("height")) / 2]),
      // Une fin de ligne se dessine CREUSE : c'est un coude, pas un té. Le
      // contrôle lit donc le plan, pas seulement la liste des pièces.
      familles: [...g.querySelectorAll("[data-famille]")].map((e) => e.getAttribute("data-famille")),
      fins: [...g.querySelectorAll("[data-famille]")].filter(
        (e) => /FBFAF7/i.test(e.getAttribute("fill") ?? "")
      ).length,
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

  const nourrice = document.querySelector("#nourrice");
  const boite = nourrice && {
    x1: Number(nourrice.getAttribute("x")), y1: Number(nourrice.getAttribute("y")),
    x2: Number(nourrice.getAttribute("x")) + Number(nourrice.getAttribute("width")),
    y2: Number(nourrice.getAttribute("y")) + Number(nourrice.getAttribute("height")),
  };

  // **Une ligne mal formée ne doit pas faire PLANTER le contrôle** — éprouvé le
  // 21 août : en retirant une ligne du tableau, la sonde tombait sur une trace
  // JavaScript au lieu d'accuser le défaut. Une erreur qui n'accuse personne
  // coûte plus cher que pas d'erreur du tout (`CLAUDE.md` §5).
  const pieces = [...document.querySelectorAll("table tr")]
    .map((tr) => {
      const q = tr.querySelector(".q")?.textContent?.match(/[\d.]+/)?.[0];
      const nom = tr.children[1]?.textContent?.trim();
      return q === undefined || nom === undefined ? null : { q: Number(q), nom };
    })
    .filter(Boolean);

  const tranchee = [...document.querySelectorAll('[data-atlas="tranchee"]')].map((l) =>
    l.getAttribute("points").trim().split(/\s+/).map((p) => p.split(",").map(Number)));

  const marque = document.querySelector("select[name=marque]");
  const marques = marque && {
    defaut: marque.options[marque.selectedIndex].textContent.trim(),
    tous: [...marque.options].map((o) => o.textContent.trim()),
    hauteur: marque.getBoundingClientRect().height,
  };

  return {
    contour,
    reseaux,
    cartes,
    boite,
    pieces,
    tranchee,
    marques,
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

// **La carte annonce désormais les FAMILLES, pas un total** — sa demande du
// 21 août : savoir où sont les tuyères et où sont les 5004. Le contrôle a suivi
// le libellé plutôt que de le figer (`CLAUDE.md` §5 bis) : il additionne ce qui
// est annoncé et le confronte à ce qui est dessiné, famille par famille.
cas("chaque réseau annonce les arroseurs qu'il DESSINE, par famille", () => {
  vu.cartes.forEach((c, i) => {
    const r = vu.reseaux[i + 1];
    const dits = {
      turbine: Number(c.sous.match(/(\d+)\s*turbines?/)?.[1] ?? 0),
      tuyere: Number(c.sous.match(/(\d+)\s*tuyères?/)?.[1] ?? 0),
    };
    for (const famille of ["turbine", "tuyere"]) {
      const dessines = r.familles.filter((f) => f === famille).length;
      if (dits[famille] !== dessines) {
        throw new Error(`« ${c.nom} » annonce ${dits[famille]} ${famille}(s) et le plan en dessine ${dessines}`);
      }
    }
    if (dits.turbine + dits.tuyere !== r.tetes.length) {
      throw new Error(`« ${c.nom} » : ${dits.turbine + dits.tuyere} arroseurs annoncés pour ${r.tetes.length} dessinés`);
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

// ── 7. TOUT PART DE LA NOURRICE — sa règle indiscutable du 21 août 2026 ────
//
// *« Tous les réseaux doivent partir de la nourrice, règle indiscutable ! Or
// sur ton plan on voit le compteur d'eau mais pas de nourrice. Je suppose que
// le réseau jaune partirait du compteur d'eau, mais le bleu et le vert, on ne
// sait pas d'où. »*
//
// Deux exigences, et la seconde est celle qui compte : la nourrice se VOIT, et
// aucune ligne ne commence ailleurs. Un tracé qui démarre dans le vide n'est
// pas un plan — c'est un dessin qu'on ne peut pas poser sur le terrain.
cas("la nourrice est dessinée", () => {
  if (!vu.boite) throw new Error("aucune nourrice sur le plan : on ne sait pas d'où partent les réseaux");
});

// **Une ANTENNE part du réseau, pas de la nourrice** — corrigé le 21 août 2026.
// Ce contrôle exigeait que CHAQUE ligne démarre au regard, et rougissait donc
// sur la petite antenne d'un mètre qu'il décrit lui-même : *« si on peut
// réutiliser une tranchée déjà faite et juste faire une petite antenne pour
// aller chercher l'arroseur »*. Il interdisait le raccourci qu'il demande.
//
// La règle juste : **un réseau part de la nourrice**, et tout le reste de ses
// lignes se raccorde à un point qu'il dessert déjà. Rien ne pend dans le vide,
// et les antennes restent possibles.
cas("chaque réseau part de la nourrice, ses antennes partent de lui", () => {
  const b = vu.boite;
  if (!b) return;
  const auRegard = ([x, y]) => x >= b.x1 - 0.5 && x <= b.x2 + 0.5 && y >= b.y1 - 0.5 && y <= b.y2 + 0.5;

  for (const [n, r] of Object.entries(vu.reseaux)) {
    if (!r.tuyaux.some((poly) => auRegard(poly[0]))) {
      throw new Error(`aucune ligne du réseau ${n} ne part de la nourrice : on ne saurait pas où le brancher`);
    }
    // Tous les points déjà atteints par ce réseau : une antenne doit s'y greffer.
    const atteints = r.tuyaux.flatMap((poly) => poly).map((p) => p.join());
    for (const poly of r.tuyaux) {
      const depart = poly[0];
      if (auRegard(depart)) continue;
      const greffe = atteints.filter((p) => p === depart.join()).length >= 2;
      if (!greffe) {
        throw new Error(`une antenne du réseau ${n} commence en ${depart.join(",")} — ni à la nourrice, ni sur son réseau : elle pend dans le vide`);
      }
    }
  }
});

// ── 8. LES RACCORDS : SA PLANCHE DU 17 AOÛT, APPLIQUÉE AU CHIFFRE PRÈS ──────
//
// *« Les tés taraudés, qui correspondent à tous les milieux, il n'y en a pas
// douze, il y en a quatre. Ensuite il manque les fins de ligne, c'est les
// coudes taraudés. […] Il y a quatre arroseurs qui ne sont pas alimentés. »*
//
// Sa règle, déjà écrite dans `appli/arrosage-catalogue.js` :
//   · départ et milieu de ligne → té 90° taraudé 25×3/4"×25
//   · fin de ligne              → coude 90° taraudé 25×3/4"
//
// D'où le contrôle qu'aucune version ne tenait, et qui aurait attrapé le
// défaut : **tés + coudes = arroseurs**. En dessous, des arroseurs ne sont
// raccordés à rien — et cela ne se voit qu'au moment de poser.
cas("la commande porte le total de tous les réseaux", () => {
  const q = (motif) => vu.pieces.filter((p) => motif.test(p.nom)).reduce((t, p) => t + p.q, 0);
  const tes = q(/Té .*taraudé/i);
  const coudes = q(/Coude .*taraudé/i);
  const arroseurs = Object.values(vu.reseaux).reduce((t, r) => t + r.tetes.length, 0);
  if (tes + coudes !== arroseurs) {
    const manque = arroseurs - tes - coudes;
    throw new Error(
      `${tes} tés + ${coudes} coudes = ${tes + coudes} raccords pour ${arroseurs} arroseurs — ` +
      (manque > 0 ? `${manque} arroseur(s) ne sont alimentés par rien` : `${-manque} raccord(s) de trop, achetés pour rien`)
    );
  }
});

// **Une fin de ligne par ligne, pas une de plus.** Un coude en trop veut dire
// qu'une ligne a été coupée quelque part, donc qu'un arroseur pend au bout de
// rien ; un coude en moins, qu'une ligne se termine par un té ouvert.
cas("une fin de ligne — donc un coude — par ligne dessinée", () => {
  const q = (motif) => vu.pieces.filter((p) => motif.test(p.nom)).reduce((t, p) => t + p.q, 0);
  const coudes = q(/Coude .*taraudé/i);
  const lignes = Object.values(vu.reseaux).reduce((t, r) => t + r.tuyaux.length, 0);
  if (coudes !== lignes) {
    throw new Error(`${coudes} coudes taraudés pour ${lignes} lignes tracées : chaque ligne finit une fois, et une seule`);
  }
});

// ── 8 quater. LE COMPTAGE SE FAIT PAR RÉSEAU, JAMAIS EN GROS ───────────────
//
// *Sa règle du 21 août :* « faut surtout que tu en fasses une règle — il faut
// que tu l'appliques pour CHAQUE réseau que tu crées ».
//
// **Et il a raison contre la version précédente de ce contrôle**, qui vérifiait
// `tés + coudes = arroseurs` sur le TOTAL. Un total juste peut cacher un réseau
// en excès et un autre en manque : ils se compensent, la somme tombe juste, et
// c'est sur le terrain qu'on découvre qu'une voie n'a pas de quoi raccorder son
// dernier arroseur. Un contrôle qui ne regarde que la somme laisse passer
// exactement le défaut qu'il prétend attraper.
//
// Le décompte se lit donc SUR LE PLAN, réseau par réseau — têtes pleines (tés),
// têtes creuses (coudes de fin) — puis se compare à ce que la carte annonce.
for (const [n, r] of Object.entries(vu.reseaux)) {
  cas(`réseau ${n} : son compte tombe juste, à lui seul`, () => {
    const arroseurs = r.tetes.length;
    const coudes = r.fins;
    const tes = arroseurs - coudes;

    if (coudes !== r.tuyaux.length) {
      throw new Error(`${coudes} fin(s) de ligne dessinée(s) pour ${r.tuyaux.length} ligne(s) : chaque ligne finit une fois, et une seule`);
    }

    // Ce que la carte annonce doit être ce que le plan dessine — sinon l'un des
    // deux ment, et on ne sait pas lequel au moment de commander.
    const carte = vu.cartes[Number(n) - 1];
    const dits = carte.sous.match(/(\d+)\s*tés?\s*\+\s*(\d+)\s*coude/);
    if (!dits) throw new Error(`la carte du réseau ${n} n'annonce pas son compte : « ${carte.sous} »`);
    if (Number(dits[1]) !== tes || Number(dits[2]) !== coudes) {
      throw new Error(
        `la carte annonce ${dits[1]} tés + ${dits[2]} coudes, le plan en dessine ${tes} + ${coudes}`
      );
    }
    if (tes + coudes !== arroseurs) {
      throw new Error(`${tes} tés + ${coudes} coudes pour ${arroseurs} arroseurs sur ce seul réseau`);
    }
  });
}

// ── 8 bis. AU PLUS COURT — sa règle du 21 août 2026 ─────────────────────────
//
// *« Il faut que tu te dises que tu essayes d'aller au plus court à chaque
// fois. Pour ton réseau 1 tu t'es trompé : tu aurais dû retirer la dernière
// ligne entre l'arroseur du haut et l'arroseur du milieu, mais par contre,
// devant le regard, mettre un té — et du coup tu aurais pu joindre le premier
// arroseur qui est collé au regard et celui qui est en haut. »*
//
// Il avait raison, et le détour se CHIFFRE : 22 ml tracés là où 18 suffisent.
// Le tuyau en trop se paie deux fois — au mètre, et en tranchée.
//
// **Ce contrôle compare le tracé à l'arbre couvrant minimal** des points qu'il
// dessert (nourrice comprise), en distance de Manhattan : un tuyau suit les
// axes, il ne coupe pas en diagonale au milieu du gazon. C'est une borne
// basse honnête — le tracé ne peut pas faire mieux, et s'il en est loin, c'est
// qu'il revient sur lui-même.
//
// **Une marge de 5 % est laissée** : la contourner d'un obstacle est légitime,
// revenir chercher un arroseur déjà dépassé ne l'est pas.
const manhattan = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const arbreMinimal = (pts) => {
  const dans = new Set([0]);
  let total = 0;
  while (dans.size < pts.length) {
    let court = Infinity;
    let suivant = -1;
    for (const i of dans) {
      for (let j = 0; j < pts.length; j++) {
        if (dans.has(j)) continue;
        const d = manhattan(pts[i], pts[j]);
        if (d < court) { court = d; suivant = j; }
      }
    }
    total += court;
    dans.add(suivant);
  }
  return total;
};

for (const [n, r] of Object.entries(vu.reseaux)) {
  cas(`le réseau ${n} va au plus court`, () => {
    const trace = r.tuyaux.reduce(
      (t, poly) => t + poly.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - poly[k][0], p[1] - poly[k][1]), 0),
      0
    );
    // Les points à desservir : les arroseurs, plus le départ commun (la nourrice).
    const points = [r.tuyaux[0][0], ...r.tetes];
    const mini = arbreMinimal(points);
    // **Une marge large, et c'est voulu depuis sa règle de la tranchée.** Un
    // réseau qui rallonge SON tuyau pour rester dans une saignée déjà ouverte
    // fait le bon choix : le tuyau se paie au mètre, la tranchée en heures de
    // terrassement. Ce contrôle-ci n'attrape donc plus que les détours francs —
    // une ligne qui revient sur elle-même. C'est le contrôle de la TRANCHÉE,
    // plus bas, qui juge l'ensemble.
    if (trace > mini * 1.5 + 0.01) {
      throw new Error(
        `${trace.toFixed(0)} ml tracés pour ${mini.toFixed(0)} ml nécessaires — ` +
        `la ligne revient sur elle-même au lieu de suivre une tranchée`
      );
    }
  });
}

// ── 8 ter. DEUX SBE PAR ARROSEUR, ET LE CHIFFRE DOIT SE RECOMPOSER ─────────
//
// *Sa question du 21 août :* « je ne comprends pas d'où sort ton calcul des
// vingt-deux coudes SBE 3/4" et les 4 SBE 1/2" — ça correspond à quoi ? »
//
// Le chiffre était juste (sa règle du 17 août : **deux SBE par arroseur**, celui
// du bas toujours en 3/4" sur la tuyauterie, celui du haut au diamètre du
// corps). **Le défaut était ailleurs : l'écran l'annonçait sans dire à quoi il
// sert.** Un total qu'on ne peut pas recomposer ne se commande pas de
// confiance — on le recompte, on n'y arrive pas, et on doute de toute la liste.
//
// Le contrôle tient donc les deux : le COMPTE (2 × arroseurs) et le fait que
// chaque ligne dise sa position.
cas("deux SBE par arroseur, et chaque ligne dit où il va", () => {
  const sbe = vu.pieces.filter((p) => /SBE/i.test(p.nom));
  const total = sbe.reduce((t, p) => t + p.q, 0);
  const arroseurs = Object.values(vu.reseaux).reduce((t, r) => t + r.tetes.length, 0);
  if (total !== arroseurs * 2) {
    throw new Error(`${total} SBE pour ${arroseurs} arroseurs : il en faut deux par arroseur, soit ${arroseurs * 2}`);
  }
  for (const p of sbe) {
    if (!/en bas|en haut/i.test(p.nom)) {
      throw new Error(`« ${p.nom} » ne dit pas s'il va en bas ou en haut : le total ne se recompose pas`);
    }
  }
});

// ── 8 quinquies. LA TRANCHÉE, PAS LE TUYAU — sa règle du 21 août 2026 ──────
//
// *« Il faut que tu te dises que le trait jaune, c'est une tranchée. C'est une
// équipe qui va devoir creuser la terre pour faire passer le tuyau. Donc l'idée,
// c'est de faire le moins de tranchée possible. Si on peut réutiliser une
// tranchée déjà faite et juste faire une petite antenne — un mètre par exemple —
// pour aller chercher l'arroseur, c'est moins éprouvant que de faire tout le
// tour. »*
//
// **CELA CHANGE CE QU'ON MINIMISE.** Jusqu'ici ce contrôle comparait la somme
// des TUYAUX au plus court. Mais deux tuyaux qui suivent le même chemin
// n'occupent qu'UNE tranchée : le mètre de tuyau se paie une fois, le mètre de
// tranchée se paie en heures de terrassement. Le plan retenu le montre : à
// longueur de tuyau égale — 76 ml — faire remonter le troisième réseau par le
// bord haut, déjà creusé pour le premier, économise **10 m de tranchée**.
//
// Le contrôle mesure donc l'UNION des tracés, en pas de 50 cm : ce qui se
// superpose ne compte qu'une fois. Puis il la compare à l'arbre couvrant
// minimal de la nourrice et des arroseurs — la tranchée la plus courte qui les
// relie tous.
cas("on creuse le moins de tranchée possible", () => {
  const pas = (poly) => {
    const out = new Set();
    for (let i = 0; i < poly.length - 1; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[i + 1];
      const n = Math.round(Math.hypot(x2 - x1, y2 - y1) * 2);
      for (let k = 0; k < n; k++) {
        const a = [x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n].map((v) => v.toFixed(2));
        const b = [x1 + ((x2 - x1) * (k + 1)) / n, y1 + ((y2 - y1) * (k + 1)) / n].map((v) => v.toFixed(2));
        out.add([a.join(), b.join()].sort().join("|"));
      }
    }
    return out;
  };

  // Ce que les TUYAUX occupent réellement, superpositions fondues.
  const union = new Set();
  for (const r of Object.values(vu.reseaux)) for (const poly of r.tuyaux) for (const seg of pas(poly)) union.add(seg);
  const creuse = union.size / 2;

  const points = [vu.reseaux[1].tuyaux[0][0], ...Object.values(vu.reseaux).flatMap((r) => r.tetes)];
  const uniques = [...new Map(points.map((p) => [p.join(), p])).values()];
  const mini = arbreMinimal(uniques);
  if (creuse > mini * 1.05 + 0.01) {
    throw new Error(
      `${creuse.toFixed(0)} ml de tranchée pour ${mini.toFixed(0)} ml nécessaires — ` +
      `${(creuse - mini).toFixed(0)} m à creuser pour rien, et la terre se paie en heures`
    );
  }
});

cas("la tranchée dessinée couvre tous les tuyaux", () => {
  const pas = (poly) => {
    const out = new Set();
    for (let i = 0; i < poly.length - 1; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[i + 1];
      const n = Math.round(Math.hypot(x2 - x1, y2 - y1) * 2);
      for (let k = 0; k < n; k++) {
        const a = [x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n].map((v) => v.toFixed(2));
        const b = [x1 + ((x2 - x1) * (k + 1)) / n, y1 + ((y2 - y1) * (k + 1)) / n].map((v) => v.toFixed(2));
        out.add([a.join(), b.join()].sort().join("|"));
      }
    }
    return out;
  };
  const dessinee = new Set();
  for (const poly of vu.tranchee) for (const seg of pas(poly)) dessinee.add(seg);
  for (const r of Object.values(vu.reseaux)) {
    for (const poly of r.tuyaux) {
      for (const seg of pas(poly)) {
        if (!dessinee.has(seg)) {
          throw new Error("un tuyau passe hors de toute tranchée dessinée : le chantier serait chiffré trop court");
        }
      }
    }
  }
});

// ── 8 sexies. ON TRAVERSE LE MOINS POSSIBLE LE JARDIN ──────────────────────
//
// *Sa règle du 21 août :* « on essaye de traverser le moins possible le jardin
// sur sa largeur, car beaucoup de choses enterrées — pour le réseau jaune
// j'aurais fait le tour et non traverser dans sa largeur ».
//
// **Ce n'est pas une question de mètres, c'est une question de risque.** Au
// milieu d'un terrain passent des gaines, des drains, une fosse, des racines de
// sujets qu'on ne verra qu'à la pelle. Longer un bord coûte parfois plus de
// tuyau et coûte toujours moins d'ennuis — et le tour se rebouche, la traversée
// se retrouve.
//
// **On ne rentre donc dans le jardin QUE pour aller chercher un arroseur qui
// s'y trouve, et par le plus court.** Le contrôle mesure le linéaire de
// tranchée situé à plus de 2 m d'un bord, et le compare à ce qu'exigent les
// arroseurs intérieurs. Sur ce plan : 4 m, pour 4 m nécessaires — le seul
// arroseur du milieu est celui du centre.
cas("on ne traverse le jardin que pour desservir ce qui s'y trouve", () => {
  const bord = ([x, y]) => {
    let m = Infinity;
    for (let i = 0; i < vu.contour.length; i++) {
      const [ax, ay] = vu.contour[i];
      const [bx, by] = vu.contour[(i + 1) % vu.contour.length];
      const dx = bx - ax;
      const dy = by - ay;
      const L = dx * dx + dy * dy;
      const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
      m = Math.min(m, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
    return m;
  };
  const SEUIL = 2;

  let dedans = 0;
  for (const poly of vu.tranchee) {
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i];
      const b = poly[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 8));
      for (let k = 0; k < n; k++) {
        const p = [a[0] + ((b[0] - a[0]) * (k + 0.5)) / n, a[1] + ((b[1] - a[1]) * (k + 0.5)) / n];
        if (bord(p) > SEUIL) dedans += Math.hypot(b[0] - a[0], b[1] - a[1]) / n;
      }
    }
  }

  const necessaire = Object.values(vu.reseaux)
    .flatMap((r) => r.tetes)
    .reduce((t, a) => t + Math.max(0, bord(a) - SEUIL), 0);

  if (dedans > necessaire + 1) {
    throw new Error(
      `${dedans.toFixed(0)} m de tranchée en plein jardin pour ${necessaire.toFixed(0)} m nécessaires — ` +
      `on traverse là où on pouvait longer, et c'est au milieu que se trouvent les gaines et les drains`
    );
  }
});

// ── 8 septies. LE PLAN DIT QUEL ARROSEUR, ET POURQUOI ──────────────────────
//
// *Sa demande du 21 août :* « sur le plan avec les arroseurs, tu dois savoir me
// dire où sont les tuyères et pourquoi, et quelle buse tu utilises — pareil
// pour les 5004. Il faut que l'utilisateur, en regardant son plan, sache tout
// de suite où les réseaux passent, quels arroseurs tu vas utiliser à quel
// endroit, et pourquoi. »
//
// Un plan qui ne dit que « treize points » ne se pose pas : sur le terrain, on
// ne sait pas lequel visser où. La FORME porte la famille (rond : turbine,
// carré : tuyère), le remplissage porte la position sur la ligne.
cas("chaque arroseur dit sa famille, et la légende la traduit", () => {
  for (const [n, r] of Object.entries(vu.reseaux)) {
    if (r.familles.length !== r.tetes.length) {
      throw new Error(`réseau ${n} : ${r.familles.length} arroseurs nommés pour ${r.tetes.length} dessinés`);
    }
    for (const f of r.familles) {
      if (f !== "turbine" && f !== "tuyere") throw new Error(`famille inconnue sur le réseau ${n} : « ${f} »`);
    }
  }
  const texte = vu.texte.toLowerCase();
  // La légende doit traduire les deux formes, ET nommer la buse de chacune :
  // « une tuyère » ne suffit pas à commander, « 12-VAN » oui.
  for (const attendu of [/turbine\s*5004/, /buse\s*3\.0/, /tuyère\s*1800/, /12-van/, /portée\s*6\s*m/, /portée\s*4\s*m/]) {
    if (!attendu.test(texte)) throw new Error(`le plan ne dit pas « ${attendu.source} » : on ne sait pas quoi visser où`);
  }
});

// **Le POURQUOI, pas seulement le QUOI.** Un choix qu'on ne comprend pas se
// refait au hasard le chantier suivant.
cas("le choix des arroseurs s'explique", () => {
  const texte = vu.texte.toLowerCase();
  if (!/pourquoi/.test(texte)) throw new Error("le plan ne dit nulle part POURQUOI ces arroseurs-là");
  // La raison des tuyères est celle qui compte : la bande est trop étroite.
  if (!/(4 m de large|étroit|au-delà|limite|voisin)/.test(texte)) {
    throw new Error("le plan ne dit pas pourquoi une tuyère plutôt qu'une turbine sur la bande étroite");
  }
});

// ── 9. LE CHOIX DE LA MARQUE — sa demande, deux fois ────────────────────────
//
// Le 17 août : *« de base on met du Rain Bird, mais s'il veut, un petit bandeau
// déroulant avec le choix de la marque »*. Le 21 : *« il faut aussi que tu
// rajoutes le bandeau déroulant avec les trois marques »*. Il était écrit dans
// le catalogue depuis quatre jours et n'était jamais monté à l'écran.
cas("les trois marques se choisissent, Rain Bird par défaut", () => {
  if (!vu.marques) throw new Error("aucun choix de marque à l'écran");
  if (!/rain\s?bird/i.test(vu.marques.defaut)) {
    throw new Error(`la marque par défaut est « ${vu.marques.defaut} » et non Rain Bird`);
  }
  for (const attendue of [/rain\s?bird/i, /toro/i, /hunter/i]) {
    if (!vu.marques.tous.some((n) => attendue.test(n))) {
      throw new Error(`une marque manque dans le menu : ${vu.marques.tous.join(" | ")}`);
    }
  }
  // Un menu qu'on rate du doigt ne se choisit pas : 44 px est le minimum tenu
  // partout dans ce dépôt.
  if (vu.marques.hauteur < 44) {
    throw new Error(`le menu des marques fait ${Math.round(vu.marques.hauteur)} px de haut : trop petit pour le doigt`);
  }
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
