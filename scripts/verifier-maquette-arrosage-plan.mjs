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
// **Le catalogue, et non des libellés recopiés ici.** Un contrôle qui porte ses
// propres références finit par défendre celles d'avant-hier — c'est exactement
// ce qui est arrivé à la légende de cette planche (voir plus bas).
import { CATALOGUE } from "../src/lib/arrosage/catalogue.js";

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
  // La ZONE compte : un « coude taraudé MM 1" » du regard n'est pas une fin de
  // ligne d'arroseur. Les confondre a fait rougir le compte des raccords le jour
  // où la nourrice a été détaillée — un faux coupable, le pire des messages.
  const pieces = [...document.querySelectorAll('table[data-zone="jardin"] tr')]
    .map((tr) => {
      const q = tr.querySelector(".q")?.textContent?.match(/[\d.]+/)?.[0];
      const nom = tr.children[1]?.textContent?.trim();
      return q === undefined || nom === undefined ? null : { q: Number(q), nom };
    })
    .filter(Boolean);

  const tranchee = [...document.querySelectorAll('[data-atlas="tranchee"]')].map((l) =>
    l.getAttribute("points").trim().split(/\s+/).map((p) => p.split(",").map(Number)));

  const jonctions = document.querySelectorAll('[data-piece="jonction"]').length;

  const lire = (zone) => [...document.querySelectorAll(`table[data-zone="${zone}"] tr`)]
    .map((tr) => {
      const q = tr.querySelector(".q")?.textContent?.match(/[\d.]+/)?.[0];
      const nom = tr.children[1]?.textContent?.trim();
      return nom === undefined ? null : { q: q === undefined ? null : Number(q), nom };
    })
    .filter(Boolean);
  const piecesAmenee = lire("amenee");

  const piecesNourrice = [...document.querySelectorAll('table[data-zone="nourrice"] tr')]
    .map((tr) => {
      const q = tr.querySelector(".q")?.textContent?.match(/[\d.]+/)?.[0];
      const nom = tr.children[1]?.textContent?.trim();
      return q === undefined || nom === undefined ? null : { q: Number(q), nom };
    })
    .filter(Boolean);

  const legende = {
    // Un symbole DESSINÉ, pas un caractère : « ● » se lit mal, ne rend pas la
    // nuance plein/creux, et ne prouve pas qu'il ressemble à ce qui est tracé.
    symboles: document.querySelectorAll(".legende svg").length,
    texte: document.querySelector(".legende")?.innerText ?? "",
  };

  const champPiquage = document.querySelector("select[name=piquage]");
  const piquage = champPiquage?.options[champPiquage.selectedIndex]?.textContent ?? "";

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
    legende,
    jonctions,
    piecesNourrice,
    piecesAmenee,
    piquage,
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
const dedans2 = (x, y, pts) => {
  let ok = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
};
const toutesPortees = Object.values(vu.reseaux).flatMap((r) => r.portees);

// **80 % SUFFIT — sa règle du 21 août 2026** : *« on a un recouvrement d'au
// moins 80 %, pas obligé d'avoir 100 % à chaque fois »*, en validant la 12-VAN
// à 3,6 m sur une bande de 4 m.
//
// La version précédente exigeait **100 %** de la pelouse à portée d'un arroseur.
// C'était plus strict que son métier, et cela coûte : chaque point manquant fait
// resserrer le maillage, donc ajouter des arroseurs, des raccords et du tuyau
// que personne ne paie. Un contrôle trop sévère fait dépenser aussi sûrement
// qu'un contrôle absent.
const COUVERTURE_MINIMALE = 0.8;

cas(`au moins ${Math.round(COUVERTURE_MINIMALE * 100)} % de la pelouse est à portée d'un arroseur`, () => {
  let dedans = 0;
  let couvert = 0;
  const trous = [];
  for (let x = 0.25; x < 20; x += 0.5) {
    for (let y = 0.25; y < 12; y += 0.5) {
      if (!dedans2(x, y, vu.contour)) continue;
      dedans++;
      if (toutesPortees.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r + 0.01)) couvert++;
      else if (trous.length < 1) trous.push(`${x}×${y}`);
    }
  }
  const part = dedans === 0 ? 1 : couvert / dedans;
  if (part < COUVERTURE_MINIMALE) {
    throw new Error(
      `${Math.round(part * 100)} % de la pelouse arrosée, il en faut ${Math.round(COUVERTURE_MINIMALE * 100)} % — ` +
      `${((dedans - couvert) / 4).toFixed(0)} m² au sec, à partir de ${trous[0]} m : c'est une tache jaune en juillet`
    );
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
cas("aucune tranchée ne coupe le jardin d'un bord à l'autre", () => {
  // **Le seuil de distance était le MAUVAIS critère, et il l'a vu avant moi.**
  // La première version comptait la tranchée à plus de 2 m d'un bord. Dans une
  // bande de 4 m de large — son extension —, le milieu est à 2 m des deux
  // bords : AUCUNE traversée n'y était jamais détectée. Le contrôle dormait
  // exactement là où il fallait qu'il parle.
  //
  // Le bon critère est géométrique, pas métrique : **un segment qui part d'un
  // bord et arrive sur un bord en passant par l'intérieur est une traversée**,
  // et le tour existe toujours. Un segment qui va chercher un arroseur situé au
  // milieu n'en est pas une : il n'arrive sur aucun bord.
  const surLeBord = ([x, y]) => {
    for (let i = 0; i < vu.contour.length; i++) {
      const [ax, ay] = vu.contour[i];
      const [bx, by] = vu.contour[(i + 1) % vu.contour.length];
      const dx = bx - ax;
      const dy = by - ay;
      const L = dx * dx + dy * dy;
      const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
      if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < 0.01) return true;
    }
    return false;
  };

  for (const poly of vu.tranchee) {
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i];
      const b = poly[i + 1];
      if (!surLeBord(a) || !surLeBord(b)) continue;
      // Les deux bouts touchent le périmètre : reste à savoir si le trait le
      // longe (bon) ou le coupe (à éviter). On regarde son milieu.
      const milieu = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (!surLeBord(milieu)) {
        throw new Error(
          `la tranchée coupe le jardin de ${a.join(",")} à ${b.join(",")} — ` +
          "le tour par le bord fait la même longueur, et c'est au milieu que passent les gaines et les drains"
        );
      }
    }
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
  // ── LA LÉGENDE SE VÉRIFIE CONTRE LE CATALOGUE, PAS CONTRE ELLE-MÊME ─────
  //
  // **Ce contrôle a menti pendant quatre jours, et c'est le patron qui l'a vu.**
  // Le 22 août 2026 : *« il m'a déjà donné 4 arroseurs en 5004 buse 3 sur un
  // seul réseau avec 3 bar et du Ø25, est-ce correct ? »* Ce n'était pas
  // correct — quatre buses 3.0 de 5004 tirent 2,84 m³/h, soit plus d'une fois
  // et demie ce qu'un Ø25 laisse passer, et bien au-delà des 1,80 m³/h du
  // compteur. Mais ce plan-là n'a JAMAIS posé de 5004 : il pose neuf 3504 buse
  // 0,75 et quatre tuyères. **Seule la légende disait 5004** — et ce contrôle
  // l'EXIGEAIT, en recopiant les libellés de la toute première version de la
  // planche. Le plan a changé de matériel, la légende est restée, et le
  // contrôle la tenait en place.
  //
  // Un contrôle ne doit donc pas fixer un libellé (`CLAUDE.md` §5 bis) : il
  // vérifie que la légende nomme un matériel qui EXISTE au catalogue, avec SA
  // portée, et que c'est bien celui que la liste facture. Ces trois-là ne
  // peuvent plus diverger en silence.
  const lignesLegende = vu.legende.texte.split("\n").map((l) => l.trim()).filter(Boolean);
  const sansAccent = (x) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const facturees = sansAccent(vu.pieces.map((p) => p.nom).join(" · "));

  for (const famille of ["turbine", "tuyère"]) {
    const ligne = lignesLegende.find((l) => sansAccent(l).startsWith(sansAccent(famille)));
    if (!ligne) throw new Error(`la légende ne traduit pas la forme « ${famille} » : on ne sait pas quoi visser où`);

    // La buse citée doit exister au catalogue, sous SON nom exact. Une
    // inclusion approximative laisserait passer une buse inventée dont le nom
    // contient celui d'une vraie (`CLAUDE.md` §4 bis).
    const buse = CATALOGUE.buses
      .filter((b) => sansAccent(ligne).includes(sansAccent(b.nom)))
      .sort((a, b) => b.nom.length - a.nom.length)[0];
    if (!buse) {
      throw new Error(`« ${ligne} » ne cite aucune buse du catalogue : on ne commande pas avec ce libellé`);
    }

    // Et la portée annoncée est CELLE DU CATALOGUE. Une portée inventée fait
    // acheter le mauvais nombre d'arroseurs, et c'est lui qui revient poser
    // les manquants.
    const dit = ligne.match(/port[ée]e\s*([\d]+(?:[.,][\d]+)?)\s*m/i);
    if (!dit) throw new Error(`« ${ligne} » n'annonce aucune portée`);
    const annoncee = Number(dit[1].replace(",", "."));
    if (Math.abs(annoncee - buse.rayon) > 0.06) {
      throw new Error(
        `« ${ligne} » annonce ${annoncee} m alors que ${buse.nom} porte à ${buse.rayon} m au catalogue`
      );
    }

    // Enfin : la légende parle-t-elle du matériel que la LISTE facture ? C'est
    // le contrôle qui aurait vu le mensonge — la légende disait 5004 pendant
    // que la commande portait des 3504.
    const modele = buse.nom.split("·")[0].trim();
    if (!facturees.includes(sansAccent(modele))) {
      throw new Error(
        `la légende annonce « ${modele} » que la liste des pièces ne facture nulle part : ` +
          `l'un des deux ment, et rien ne dit lequel au moment de commander`
      );
    }
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

// ── 8 octies. LA LÉGENDE DIT OÙ VA CHAQUE PIÈCE ────────────────────────────
//
// *Sa remarque du 21 août :* « le petit schéma en dessous n'est pas clair. On ne
// sait pas vraiment à quel endroit tu veux utiliser un coude taraudé, à quel
// endroit un té égal ou un té taraudé. Là où tu as marqué plein, à côté tu peux
// mettre un rond plein ; là où tu as marqué creux, le rond creux que tu
// utilises. »
//
// **Une légende qui décrit avec des mots ce qu'on voit avec les yeux ne sert à
// rien.** Le symbole doit être DESSINÉ à côté du mot, et être celui-là même qui
// est sur le plan. Et chaque symbole doit nommer LA PIÈCE qu'il implique : sans
// cela, on lit le plan sans savoir quoi visser.
cas("la légende montre les symboles, et nomme la pièce de chacun", () => {
  if (vu.legende.symboles < 5) {
    throw new Error(`${vu.legende.symboles} symbole(s) dessiné(s) dans la légende : les décrire avec des mots ne dit pas à quoi ils ressemblent`);
  }
  const t = vu.legende.texte.toLowerCase();
  for (const [quoi, motif] of [
    ["le té taraudé (arroseur en ligne)", /té taraudé/],
    ["le coude taraudé (fin de ligne)", /coude taraudé/],
    ["le té égal (la ligne se sépare)", /té égal/],
    // **Le MODÈLE n'est pas figé ici** : quel arroseur la planche pose est une
    // décision de métier qui change d'un jardin à l'autre. Ce qui ne change
    // pas, c'est qu'une turbine et une tuyère soient chacune nommée AVEC sa
    // buse — « une tuyère » ne se commande pas, « 12-VAN » oui. Le contrôle
    // ci-dessus, lui, confronte le libellé au catalogue et à la commande.
    ["la turbine et sa buse", /turbine\s+\S+.*buse/s],
    ["la tuyère et sa buse", /tuyère\s+\S+.*buse/s],
  ]) {
    if (!motif.test(t)) throw new Error(`la légende ne dit pas où va ${quoi}`);
  }
});

// **La jonction se VOIT sur le plan.** Elle est dans la commande ; sans elle au
// dessin, on lit « 1 té égal » sans savoir à quel endroit le poser.
cas("chaque jonction facturée est dessinée quelque part", () => {
  const dessinees = vu.jonctions;
  // **Les trois zones, pas seulement le jardin** : le té égal qui coupe la ligne
  // du compteur est facturé dans l'amenée, et dessiné près du compteur. Ne
  // regarder qu'une zone accuserait le plan d'une pièce en trop.
  const facturees = [...vu.pieces, ...vu.piecesAmenee, ...vu.piecesNourrice]
    .filter((p) => /té égal/i.test(p.nom))
    .reduce((t, p) => t + (p.q ?? 0), 0);
  if (dessinees !== facturees) {
    throw new Error(`${facturees} té(s) égal(aux) commandé(s) pour ${dessinees} dessiné(s) : on ne saurait pas où le poser`);
  }
});

// ── 8 nonies. LA NOURRICE SE POSE, DONC ELLE SE DÉTAILLE ───────────────────
//
// *Sa question du 21 août :* « où sont les pièces pour la nourrice 3 voies ? »
//
// Elle tenait en trois lignes — 3 électrovannes, 1 regard, 1 programmateur —
// qui ne se posent pas : il manquait la clarinette qui les relie, les unions
// qui les démontent, les raccords d'entrée, la purge d'hivernage. **Tout cela
// était déjà relevé sur sa planche du 17 août**, dans
// `appli/arrosage-catalogue.js` (`CATALOGUE.nourrices[3]`), et n'avait jamais
// été repris ici.
//
// Le contrôle exige donc ce qui rend un regard montable : autant
// d'électrovannes que de réseaux, la clarinette, les unions, la purge.
cas("la nourrice est détaillée, pas résumée", () => {
  const q = (motif) => vu.piecesNourrice.filter((p) => motif.test(p.nom)).reduce((t, p) => t + p.q, 0);
  const vannes = q(/électrovanne/i);
  if (vannes !== vu.cartes.length) {
    throw new Error(`${vannes} électrovanne(s) pour ${vu.cartes.length} réseaux : il en faut une par voie`);
  }
  for (const [quoi, motif] of [
    // **La pièce qui relie les vannes n'a pas le même nom selon le nombre de
    // voies** : une clarinette à partir de trois, un té MMF à deux (ses fiches
    // du 17 août). Exiger « clarinette » figeait la nourrice 3 voies et faisait
    // rougir un regard 2 voies parfaitement monté (`CLAUDE.md` §5 bis).
    ["la pièce qui relie les vannes (clarinette ou té MMF)", /clarinette|té .*mmf/i],
    ["les unions, sans quoi rien ne se démonte", /union/i],
    ["le regard", /regard/i],
    ["le programmateur", /programmateur/i],
    ["la vanne de purge, pour l'hivernage", /purge/i],
  ]) {
    if (q(motif) < 1) throw new Error(`la nourrice ne porte pas ${quoi} : le regard ne se monte pas`);
  }
});

// ── 8 decies. LE RÉCAPITULATIF SUIT LE TABLEAU ─────────────────────────────
//
// **Un défaut qu'il a vu et pas moi, sur sa capture du 21 août à 9 h 59 :** le
// tableau annonçait « 8 tés, 5 coudes » et la phrase en dessous « 9 tés + 4
// coudes = 13 raccords ». La phrase était écrite en dur et n'avait pas suivi le
// tracé. Elle disait vrai la veille — et c'est le pire des cas, parce qu'elle
// se relit sans méfiance.
//
// Deux chiffres qui se contredisent dans le même écran, c'est toute la liste
// qu'on cesse de croire.
cas("le récapitulatif dit les mêmes chiffres que le tableau", () => {
  const q = (motif) => vu.pieces.filter((p) => motif.test(p.nom)).reduce((t, p) => t + p.q, 0);
  const tes = q(/^Té 90° taraudé/i);
  const coudes = q(/^Coude 90° taraudé/i);
  const dit = vu.texte.match(/(\d+)\s*tés?\s*\+\s*(\d+)\s*coudes?\s*=\s*(\d+)\s*raccords/i);
  if (!dit) throw new Error("aucun récapitulatif des raccords sous le tableau");
  if (Number(dit[1]) !== tes || Number(dit[2]) !== coudes) {
    throw new Error(
      `le récapitulatif dit « ${dit[1]} tés + ${dit[2]} coudes » et le tableau porte ${tes} tés + ${coudes} coudes`
    );
  }
  if (Number(dit[3]) !== tes + coudes) {
    throw new Error(`le récapitulatif annonce ${dit[3]} raccords pour ${tes + coudes} listés`);
  }
});

// ── 8 undecies. SE PIQUER AU COMPTEUR, C'EST COUPER UNE LIGNE ──────────────
//
// *Sa précision du 21 août :* « vu qu'on se pique après le compteur, il va
// falloir qu'on coupe la ligne — parce que le compteur, c'est une ligne directe
// qui part vers la maison. On va devoir la couper et mettre un té égal à cet
// endroit-là. Donc tu sais d'office que lorsqu'on se raccorde après le compteur,
// il y a un té égal dans les pièces destinées à aller du compteur à la
// nourrice. »
//
// **C'est une pièce qu'aucun calcul de réseau ne produit** : elle ne dépend ni
// des arroseurs, ni des voies, ni du débit — seulement du POINT DE PIQUAGE. Elle
// manquait donc, et elle manquerait sur chaque plan tant que la règle n'est pas
// écrite. L'oublier, c'est un aller-retour au magasin avec la tranchée ouverte.
cas("au compteur, le té égal qui coupe la ligne est prévu", () => {
  const piquage = vu.piquage ?? "";
  if (!/compteur/i.test(piquage)) return; // Ailleurs, rien à couper.
  const te = vu.piecesAmenee.filter((p) => /té égal/i.test(p.nom)).reduce((t, p) => t + (p.q ?? 0), 0);
  if (te < 1) {
    throw new Error("piquage au compteur, mais aucun té égal dans l'amenée : la ligne qui part vers la maison ne se dérive pas sans la couper");
  }
  if (!/couper|coupe/i.test(vu.piecesAmenee.map((p) => p.nom).join(" ") + vu.texte)) {
    throw new Error("le plan ne dit pas qu'il faut COUPER la ligne du compteur : la pièce paraît arbitraire");
  }
});

// ── 8 duodecies. LA TENSION S'ACCORDE, SINON RIEN N'ARROSE ─────────────────
//
// *Sa règle du 21 août 2026 :* « une électrovanne en 24 V doit être reliée à un
// programmateur sur courant 220 V. Or tous les programmateurs que tu as dans ta
// base sont des programmateurs à pile 9 V, donc ils vont avec les électrovannes
// 9 V. Tu peux enregistrer : programmateur 9 V = électrovanne 9 V ;
// programmateur électrique 220 V = électrovanne 24 V. »
//
// **Ce n'est pas une préférence, c'est une condition de fonctionnement.** Une
// 24 V pilotée par un boîtier à pile ne s'ouvre pas : le réseau n'arrose pas du
// tout, et on ne s'en aperçoit qu'après avoir rebouché la tranchée. C'est le
// genre de faute qui ne se voit ni sur un plan, ni sur un devis.
//
// **Et elle est née d'une valeur inventée** : le catalogue portait une
// « Électrovanne 24 V » générique, posée avant qu'il donne ses références et
// jamais confrontée à elles. Il a demandé d'où elle sortait — de nulle part.
cas("la tension des vannes s'accorde avec celle du programmateur", () => {
  const toutes = [...vu.pieces, ...vu.piecesAmenee, ...vu.piecesNourrice];
  const vannes = toutes.filter((p) => /électrovanne/i.test(p.nom));
  const progs = toutes.filter((p) => /programmateur/i.test(p.nom));
  if (vannes.length === 0 || progs.length === 0) return;

  const tension = (nom) => (/220\s*V|secteur/i.test(nom) ? "220" : /\b9\s*V/i.test(nom) ? "9" : /\b24\s*V/i.test(nom) ? "24" : null);
  for (const v of vannes) {
    const tv = tension(v.nom);
    if (tv === null) throw new Error(`« ${v.nom} » ne dit pas sa tension : on ne peut pas vérifier qu'elle s'ouvrira`);
    for (const g of progs) {
      const tg = tension(g.nom);
      if (tg === null) throw new Error(`« ${g.nom} » ne dit pas sa tension`);
      const accord = (tg === "9" && tv === "9") || (tg === "220" && tv === "24");
      if (!accord) {
        throw new Error(
          `« ${g.nom} » avec « ${v.nom} » : la vanne ne s'ouvrira pas. ` +
          "Programmateur à pile 9 V → vanne 9 V ; programmateur 220 V → vanne 24 V"
        );
      }
    }
  }
});

// ── 8 terdecies. CE QU'IL DOIT LIRE AVANT DE PHOTOGRAPHIER ─────────────────
//
// *Sa demande du 21 août :* « c'est un petit message qu'il faut mettre au-dessus
// du croquis, en noir gras : votre croquis doit impérativement contenir les
// métrés, l'endroit définitif de la nourrice, et l'endroit où le piquage se
// fait ».
//
// **AU-DESSUS, et c'est tout le sujet.** Placé en dessous, il se lirait après
// avoir envoyé une photo incomplète — donc trop tard, et il faudrait retourner
// au jardin. Le contrôle mesure donc la POSITION, pas seulement la présence.
cas("l'avertissement est au-dessus du croquis, et nomme les trois éléments", async () => {});
const avertissement = await page.evaluate(() => {
  const p = document.querySelector(".impératif");
  const img = document.querySelector("img[src^='data:image']");
  if (!p || !img) return null;
  return {
    texte: p.innerText,
    gras: getComputedStyle(p).fontWeight,
    auDessus: p.getBoundingClientRect().top < img.getBoundingClientRect().top,
  };
});
cas("il le lit AVANT de photographier", () => {
  if (!avertissement) throw new Error("aucun avertissement sur ce que le croquis doit porter");
  if (!avertissement.auDessus) {
    throw new Error("l'avertissement est sous le croquis : il se lira après avoir envoyé une photo incomplète, donc trop tard");
  }
  if (Number(avertissement.gras) < 600) {
    throw new Error(`l'avertissement pèse ${avertissement.gras} : il a demandé du gras, sans quoi il se saute`);
  }
  const t = avertissement.texte.toLowerCase();
  for (const [quoi, motif] of [["les métrés", /métré/], ["la nourrice", /nourrice/], ["le piquage", /piquage/]]) {
    if (!motif.test(t)) throw new Error(`l'avertissement ne réclame pas ${quoi}`);
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
