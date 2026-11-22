import assert from "node:assert";
import { calculerPlan } from "../src/lib/arrosage/calcul.js";
import { dessinerPlan, EPAISSEURS, LOSANGE, REGARD, type ZoneDessinee } from "../src/lib/arrosage/plan-dessine";
import { calculerEtDessiner } from "../src/lib/arrosage/le-plan";
import { contourDesZones } from "../src/lib/arrosage/terrain";
import { surLeBord } from "../src/lib/arrosage/trace";

/**
 * LE PLAN DESSINÉ — ce que l'écran montre, éprouvé sans navigateur.
 *
 * **Ce que cette suite tient, et qu'aucune autre ne pouvait tenir.** Le calcul
 * était éprouvé, le tracé aussi ; ce qui ne l'était pas, c'est leur RACCORD —
 * et c'est là qu'un plan devient faux sans que rien ne rougisse : des zones
 * empilées à l'origine, une tête au mauvais réseau, un compte de pièces qui ne
 * se recompose plus.
 *
 * **Toutes les règles vérifiées ici viennent de lui**, et chacune a été payée :
 *
 *  1. *« Sans ça il ne doit rien proposer »* — pas de nourrice, pas de plan.
 *  2. *« C'est l'utilisateur qui placera la nourrice où il veut »* — elle n'est
 *     jamais déduite.
 *  3. *« Il faut que tu l'appliques pour CHAQUE réseau »* — le compte des tés
 *     et des coudes se vérifie réseau par réseau, jamais au total : c'est au
 *     total que deux erreurs se compensent, et c'est ce qu'il a vu le 21 août.
 *  4. *« On essaye de traverser le moins possible le jardin »* — la tranchée ne
 *     coupe pas d'un bord à l'autre.
 */

let echecs = 0;
function dire(vrai: boolean, quoi: string) {
  console.log(`  ${vrai ? "✓" : "✗"} ${quoi}`);
  if (!vrai) echecs++;
}

type Plan = { dessin: ZoneDessinee[]; couleurs: string[]; secteurs: unknown[] };

/** Son jardin du 21 août : une pelouse de 12 × 12 et une bande de 8 × 4. */
function sonJardin(): Plan {
  return calculerPlan({
    seau: 10,
    temps: 19,
    pression: 2.5,
    compteur: "oui",
    zones: [
      { id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 12, l: 12 },
      { id: 2, type: "gazon", nom: "Bande du haut", x: 12, y: 0, L: 8, l: 4 },
    ],
  } as never) as never as Plan;
}

console.log("\n=== Le plan dessiné ===\n");

// ── 1. Sans nourrice, aucun plan ────────────────────────────────────────────
const sansNourrice = dessinerPlan(sonJardin().dessin, null, sonJardin().couleurs);
dire(!sansNourrice.ok, "sans l’endroit de la nourrice, le plan est REFUSÉ — pas grisé");
dire(
  !sansNourrice.ok && /nourrice/.test(sansNourrice.raison),
  "et le refus nomme ce qui manque, au lieu d’un message générique",
);

// ── 2. Sans positions, aucun plan non plus ──────────────────────────────────
//
// **Le piège que ce cas attrape.** Le calcul rend `x = 0, y = 0` quand le
// croquis ne situe pas la zone. Deux pelouses se superposeraient alors
// exactement, et le plan sortirait — juste au sens du compte, faux au sens du
// terrain, et rien à l'écran ne le dirait.
const empilees = calculerPlan({
  seau: 10, temps: 19, pression: 2.5, compteur: "oui",
  zones: [
    { id: 1, type: "gazon", nom: "Devant", L: 12, l: 12 },
    { id: 2, type: "gazon", nom: "Derrière", L: 8, l: 4 },
  ],
} as never) as never as Plan;
const sansPlace = dessinerPlan(empilees.dessin, { x: 0, y: 4 }, empilees.couleurs);
dire(!sansPlace.ok, "deux zones que le croquis ne situe pas sont refusées, pas empilées à l’origine");

// ── 3. Le cas nominal ───────────────────────────────────────────────────────
const p = sonJardin();
const r = dessinerPlan(p.dessin, { x: 0, y: 4 }, p.couleurs);
dire(r.ok, "son jardin du 21 août se dessine");
if (!r.ok) {
  console.log(`\n❌ ${echecs} échec(s) — la suite ne peut pas aller plus loin.`);
  process.exit(1);
}
const d = r.dessin;

// Le contour SORT des zones : c'est le L de son croquis, pas un rectangle.
dire(d.contours.length === 1, `le terrain est d’un seul tenant (${d.contours.length} contour)`);
dire(d.contours[0].length === 6, `le L a bien six sommets (${d.contours[0].length})`);

// ── 4. TÉS + COUDES = ARROSEURS, PAR RÉSEAU ────────────────────────────────
//
// Sa règle du 21 août, et sa correction : *« il faut que tu l'appliques pour
// chaque réseau que tu crées »*. Au total, un té de trop d'un côté et un coude
// de trop de l'autre s'annulent — c'est exactement ce qui était passé.
const parReseau = d.reseaux.every((x) => x.tes + x.coudes === x.tetes.length);
dire(
  parReseau,
  parReseau
    ? `tés + coudes = arroseurs sur chacun des ${d.reseaux.length} réseaux`
    : "un réseau au moins ne recompose pas ses raccords : " +
      d.reseaux.map((x) => `n°${x.numero + 1} ${x.tes}+${x.coudes}≠${x.tetes.length}`).join(", "),
);

// Et chaque réseau a au moins un coude : une ligne finit toujours quelque part.
dire(
  d.reseaux.every((x) => x.coudes >= 1),
  "chaque réseau a au moins une fin de ligne — un coude taraudé",
);

// ── 5. Tout part de la nourrice ─────────────────────────────────────────────
dire(
  d.reseaux.every((x) => x.lignes.some((l) => l[0].x === d.nourrice.x && l[0].y === d.nourrice.y)),
  "chaque réseau a une ligne qui démarre à la nourrice — sa règle indiscutable",
);

// ── 6. On ne coupe pas le jardin ────────────────────────────────────────────
const coupes = d.tranchee.filter((s) => {
  const milieu = { x: (s.de.x + s.a.x) / 2, y: (s.de.y + s.a.y) / 2 };
  return surLeBord(s.de, d.contours[0]) && surLeBord(s.a, d.contours[0]) && !surLeBord(milieu, d.contours[0]);
});
dire(coupes.length === 0, "aucune tranchée ne traverse le jardin d’un bord à l’autre");

// ── 7. Les cotes se mesurent sur le trait ───────────────────────────────────
//
// **Elles ne se recopient pas de la saisie.** Un croquis qui annonce 12 m et un
// contour qui en fait 11 se démentiraient sur le même dessin — et c'est le
// dessin qu'il photographie pour commander.
const textes = d.cotes.map((c) => c.texte);
dire(textes.includes("20 m"), `le grand côté est coté 20 m (${textes.join(" ")})`);
dire(textes.filter((t) => t === "12 m").length === 2, "les deux côtés de 12 m sont cotés");

// ── 8. Le cadre englobe tout ────────────────────────────────────────────────
const [vx, vy, vL, vl] = d.viewBox.split(" ").map(Number);
const tout = [...d.contours.flat(), d.nourrice, ...d.reseaux.flatMap((x) => x.tetes)];
dire(
  tout.every((q) => q.x >= vx && q.x <= vx + vL && q.y >= vy && q.y <= vy + vl),
  "le cadre du dessin contient le terrain, la nourrice et tous les arroseurs",
);

// ── 9. Deux pelouses séparées : deux contours, et la liaison se DIT ─────────
//
// Une pelouse devant et une derrière, séparées par la maison : les recoller
// ferait passer le tuyau dessous. Le cheminement entre les deux n'est pas
// mesurable sur le croquis — il se signale au lieu d'être inventé.
const separees = calculerPlan({
  seau: 10, temps: 19, pression: 2.5, compteur: "oui",
  zones: [
    { id: 1, type: "gazon", nom: "Devant", x: 0, y: 0, L: 10, l: 6 },
    { id: 2, type: "gazon", nom: "Derrière", x: 0, y: 14, L: 10, l: 6 },
  ],
} as never) as never as Plan;
const deux = dessinerPlan(separees.dessin, { x: 0, y: 3 }, separees.couleurs);
dire(deux.ok, "deux pelouses séparées donnent quand même un plan");
if (deux.ok) {
  dire(deux.dessin.contours.length === 2, `deux morceaux de terrain, pas un seul (${deux.dessin.contours.length})`);
  dire(deux.dessin.liaisons.length === 1, "le cheminement hors pelouse est tracé à part, en pointillé");
  dire(
    deux.reserves.some((x) => /à mesurer sur place/.test(x)),
    "et il se DIT : ce mètre-là n’est pas mesuré, il ne doit pas être compté",
  );
  dire(
    deux.dessin.reseaux.every((x) => x.tes + x.coudes === x.tetes.length),
    "la règle des raccords tient aussi quand le terrain est en deux morceaux",
  );
}

// ── 10. Deux têtes au même endroit se signalent ─────────────────────────────
//
// Deux zones qui se touchent posent chacune son arroseur sur l'arête commune.
// Le cas est réel et n'est pas soluble ici — elles sont sur des vannes
// différentes. C'est un coup de bêche à décaler, et il faut le savoir avant.
dire(
  r.reserves.some((x) => /même endroit/.test(x)),
  "deux arroseurs qui tombent au même point sont signalés, pas silencieusement fondus",
);

// ── 10 bis. Deux réseaux dans la même tranchée ne dessinent pas le même trait ─
//
// **Vu à la capture du 23 août, jamais par un test.** La règle du patron pousse
// les réseaux à partager la tranchée ; ils empruntaient donc exactement le même
// segment, et le second recouvrait le premier au pixel près. Le plan montrait
// un réseau bleu réduit à un point — sans qu'aucun chiffre soit faux.
const surLeMemeSegment = (() => {
  const vus = new Map<string, string[]>();
  for (const x of d.reseaux) {
    for (const t of x.traits) {
      const axe = `${Math.round(t.de.x * 10)},${Math.round(t.de.y * 10)}|${Math.round(t.a.x * 10)},${Math.round(t.a.y * 10)}`;
      vus.set(axe, [...(vus.get(axe) ?? []), String(x.numero)]);
    }
  }
  return [...vus.values()].some((v) => v.length > 1);
})();
dire(!surLeMemeSegment, "deux réseaux qui partagent une tranchée sont écartés l’un de l’autre");

// Et le décalage ne déplace personne : un réseau seul garde son tracé exact.
const seulSurSonAxe = d.reseaux.every((x) =>
  x.traits.every((t) => t.de.x === t.a.x || t.de.y === t.a.y),
);
dire(seulSurSonAxe, "les traits restent droits — le décalage ne les fait pas biaiser");

// ── 11. Le contour est bien une UNION, pas une juxtaposition ────────────────
//
// **Ce que ce contrôle attrape.** Si les deux rectangles restaient distincts,
// leur arête commune ferait partie du bord — et tout le tracé longerait une
// frontière qui n'existe pas sur place, en croyant respecter la règle « on ne
// traverse pas le jardin ».
const uni = contourDesZones([
  { x: 0, y: 0, L: 12, l: 12 },
  { x: 12, y: 0, L: 8, l: 4 },
]);
dire(
  !surLeBord({ x: 12, y: 2 }, uni.contours[0]),
  "l’arête entre deux zones qui se touchent n’est PAS un bord du terrain",
);

// ── UNE TÊTE BRIDÉE SE DIT « BRIDÉE » DANS LA LÉGENDE ──────────────────────
//
// **Sa réponse du 16 octobre 2026, « la B »**, devant la planche qui montrait
// sa pelouse de 20 × 12 à 3,7 bar : 3504 buse 1,0 (6,4 m au catalogue)
// réglées à 6 m. Sans le mot, la légende disait « portée 6 m » et le poseur
// laissait la buse à fond, 40 cm au-delà de ce que le plan suppose.
{
  const bride = calculerPlan({ seau: 10, temps: 20, pression: 3.7, zones: [{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L: 20, l: 12 }] });
  const avecBride = dessinerPlan(bride.dessin, { x: 0, y: 6 }, bride.couleurs);
  const legende = avecBride.ok ? avecBride.dessin.reseaux.flatMap((x) => x.materiels) : [];
  dire(
    legende.length > 0 && legende.every((m) => m.bridee === true),
    `20 × 12 à 3,7 bar : la légende dit bridée (${legende.map((m) => `${m.libelle} ${m.bridee ? "bridée à" : "portée"} ${m.portee}`).join(", ")})`,
  );
  // Et une tête à sa portée ne se dit jamais bridée : un mot qui parle à tort
  // s'apprend à être ignoré.
  const libre = calculerPlan({ seau: 10, temps: 20, pression: 3, zones: [{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L: 12, l: 12 }] });
  const sansDessin = dessinerPlan(libre.dessin, { x: 0, y: 6 }, libre.couleurs);
  const sansBride = sansDessin.ok ? sansDessin.dessin.reseaux.flatMap((x) => x.materiels) : [];
  dire(
    sansBride.length > 0 && sansBride.every((m) => m.bridee === false),
    `12 × 12 à 3 bar : aucune tête dite bridée (${sansBride.map((m) => `${m.libelle} portée ${m.portee}`).join(", ")})`,
  );
}

// ── Une cote ne sort jamais du cadre ────────────────────────────────────
// Vu par lui le 18 octobre 2026 : « c'est quoi 2,4 r tout à droite ? ». La
// cote « 2,4 m » d'un massif posé au bord droit était coupée par le cadre : le
// cadre se calculait sur le terrain seul, sans le texte écrit dehors.
{
  const p = calculerPlan({ seau: 10, temps: 18, pression: 3, compteur: "oui", zones: [
    { id: 1, type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
    { id: 2, type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
    { id: 3, type: "massif", nom: "Massif", x: 14, y: 10, L: 20, l: 2.4, sortieGoutte: "boucle" },
  ] } as never);
  const r = dessinerPlan(p.dessin, { x: 13, y: 6 }, p.couleurs);
  if (!r.ok) dire(false, "le plan du massif au bord droit doit se dessiner");
  else {
    const [vx, vy, vw, vh] = r.dessin.viewBox.split(" ").map(Number);
    // La largeur d'un texte de 0,95 m de haut : un peu plus d'un demi-corps par caractère.
    const sorties = r.dessin.cotes.filter((c) => {
      const w = c.texte.length * 0.95 * 0.6;
      const x0 = c.ancre === "start" ? c.x : c.ancre === "end" ? c.x - w : c.x - w / 2;
      return x0 < vx || x0 + w > vx + vw || c.y - 0.95 < vy || c.y > vy + vh;
    });
    dire(sorties.length === 0, `aucune cote hors du cadre (${sorties.map((c) => c.texte).join(", ") || "aucune"})`);
  }
}

// ── Le mot « nourrice » ne se barre pas, le losange ne passe pas sous le regard ──
// Sa lecture du PDF, le 21 novembre 2026 : le mot était barré par la tranchée,
// le tuyau ou les pointillés qui partent de la nourrice, et sur le réseau 2 le
// losange du té égal était à moitié sous le regard. Sa règle du 11 septembre :
// deux symboles côte à côte, jamais l'un sur l'autre.
//
// La géométrie est refaite ICI, à part de celle qui place le mot : chaque trait
// est échantillonné tous les 5 cm et l'on regarde si un point tombe dans la
// boîte du mot élargie de la demi-épaisseur du trait.
{
  const JARDIN_DU_PDF = {
    seau: 10, temps: 18, pression: 3, compteur: "oui", regardVersZone: 0, amenee: 0,
    zones: [
      { id: 1, type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
      { id: 2, type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
      { id: 3, type: "massif", nom: "Massif", x: 14, y: 10, L: 20, l: 2.4, sortieGoutte: "boucle" },
      { id: 4, type: "gazon", nom: "Couloir", x: 0, y: 14, L: 10, l: 2, materiel: "tuyere" },
    ],
    couronne: 50,
  };
  type Pt = { x: number; y: number };
  type Seg = { de: Pt; a: Pt };
  const HAUT = 0.95;
  const boiteDuMot = (e: Pt & { ancre: string }, texte: string) => {
    const w = texte.length * HAUT * 0.6;
    const x0 = e.ancre === "start" ? e.x : e.ancre === "end" ? e.x - w : e.x - w / 2;
    return { x0, y0: e.y - HAUT, x1: x0 + w, y1: e.y };
  };
  const dans = (p: Pt, b: { x0: number; y0: number; x1: number; y1: number }, marge: number) =>
    p.x > b.x0 - marge && p.x < b.x1 + marge && p.y > b.y0 - marge && p.y < b.y1 + marge;
  const touche = (s: Seg, b: { x0: number; y0: number; x1: number; y1: number }, demi: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(s.a.x - s.de.x, s.a.y - s.de.y) / 0.05));
    for (let k = 0; k <= n; k++) if (dans({ x: s.de.x + ((s.a.x - s.de.x) * k) / n, y: s.de.y + ((s.a.y - s.de.y) * k) / n }, b, demi)) return true;
    return false;
  };
  const aretes = (c: Pt[]): Seg[] => c.map((p, i) => ({ de: p, a: c[(i + 1) % c.length] }));
  const places: Pt[] = [{ x: 13, y: 6 }, { x: 12, y: 3 }, { x: 6, y: 13 }, { x: -1.5, y: 5 }, { x: 23.5, y: 4 }, { x: 18, y: 9 }];
  // Les jardins de `capture-plan-arrosage.ts`, où la capture a montré un
  // losange sorti du regard posé sur la cote « 14 m ».
  const jardins = [
    ...places.map((nourrice) => ({ ...JARDIN_DU_PDF, nourrice })),
    { ...JARDIN_DU_PDF, zones: [{ id: 1, type: "gazon", nom: "Grande", x: 0, y: 0, L: 14, l: 14 }, { id: 2, type: "gazon", nom: "Petite", x: 14, y: 0, L: 5, l: 5 }], nourrice: { x: 0, y: 7 } },
    { ...JARDIN_DU_PDF, zones: [{ id: 1, type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 18, l: 12 }, { id: 2, type: "gazon", nom: "Pelouse avant", x: 0, y: 14, L: 12, l: 8 }, { id: 3, type: "gazon", nom: "Couloir", x: 18, y: 0, L: 10, l: 2 }], nourrice: { x: 0, y: 13 } },
  ];
  for (const jardin of jardins) {
    const nourrice = jardin.nourrice;
    const { dessin } = calculerEtDessiner(jardin as never, null);
    if (!dessin) { dire(false, `nourrice en (${nourrice.x} ; ${nourrice.y}) : pas de dessin, le contrôle ne mesure rien`); continue; }
    const ici = `${jardin.zones.length} zones, nourrice en (${nourrice.x} ; ${nourrice.y})`;
    const mot = boiteDuMot(dessin.etiquetteNourrice, "nourrice");
    const traits: { s: Seg; demi: number; quoi: string }[] = [
      ...dessin.tranchee.map((s) => ({ s, demi: EPAISSEURS.tranchee / 2, quoi: "la tranchée" })),
      ...dessin.liaisons.map((s) => ({ s, demi: EPAISSEURS.liaison / 2, quoi: "un pointillé" })),
      ...[...dessin.contours, ...dessin.trous].flatMap(aretes).map((s) => ({ s, demi: EPAISSEURS.contour / 2, quoi: "le bord d'une zone" })),
      ...dessin.reseaux.flatMap((r) => [
        ...r.traits.map((s) => ({ s, demi: EPAISSEURS.ligne / 2, quoi: `le tuyau du réseau ${r.numero + 1}` })),
        ...r.antennes.map((s) => ({ s, demi: EPAISSEURS.antenne / 2, quoi: `une antenne du réseau ${r.numero + 1}` })),
      ]),
    ];
    const barre = traits.filter((t) => touche(t.s, mot, t.demi));
    dire(barre.length === 0, `${ici} : le mot « nourrice » n'est barré par rien${barre.length ? ` (barré par ${[...new Set(barre.map((t) => t.quoi))].join(", ")})` : ""}`);
    const symboles: { p: Pt; r: number; quoi: string }[] = dessin.reseaux.flatMap((r) => [
      ...r.tetes.map((t) => ({ p: { x: t.x + t.decalage.x, y: t.y + t.decalage.y }, r: 0.67, quoi: "une tête" })),
      ...r.jonctions.map((p) => ({ p, r: LOSANGE.demi * Math.SQRT2 + LOSANGE.trait / 2, quoi: "un losange" })),
    ]);
    const regard = { x0: nourrice.x - REGARD.demiLargeur, y0: nourrice.y - REGARD.demiHauteur, x1: nourrice.x + REGARD.demiLargeur, y1: nourrice.y + REGARD.demiHauteur };
    const couverts = symboles.filter((s) => dans(s.p, mot, s.r));
    const surLeRegard = mot.x1 > regard.x0 - REGARD.trait / 2 && mot.x0 < regard.x1 + REGARD.trait / 2 && mot.y1 > regard.y0 - REGARD.trait / 2 && mot.y0 < regard.y1 + REGARD.trait / 2;
    dire(couverts.length === 0 && !surLeRegard,
      `${ici} : le mot ne couvre ni un symbole ni le regard${couverts.length ? ` (couvre ${couverts.map((c) => c.quoi).join(", ")})` : ""}`);
    const cotes = dessin.cotes.filter((c) => { const b = boiteDuMot(c, c.texte); return b.x1 > mot.x0 && b.x0 < mot.x1 && b.y1 > mot.y0 && b.y0 < mot.y1; });
    dire(cotes.length === 0, `${ici} : le mot ne tombe sur aucune cote${cotes.length ? ` (« ${cotes.map((c) => c.texte).join(" », « ")} »)` : ""}`);
    const emprise = LOSANGE.demi * Math.SQRT2 + LOSANGE.trait / 2;
    const sous = dessin.reseaux.flatMap((r) => r.jonctions.filter((p) => dans(p, regard, emprise + REGARD.trait / 2)).map(() => r.numero + 1));
    dire(sous.length === 0, `${ici} : aucun losange sous le regard${sous.length ? ` (réseau ${sous.join(", ")})` : ""}`);
    const surUneCote = dessin.reseaux.flatMap((r) => r.jonctions.flatMap((p) => dessin.cotes.filter((c) => dans(p, boiteDuMot(c, c.texte), emprise)).map((c) => c.texte)));
    dire(surUneCote.length === 0, `${ici} : aucun losange sur une cote${surUneCote.length ? ` (« ${surUneCote.join(" », « ")} »)` : ""}`);
    const [vx, vy, vw, vh] = dessin.viewBox.split(" ").map(Number);
    dire(mot.x0 >= vx && mot.x1 <= vx + vw && mot.y0 >= vy && mot.y1 <= vy + vh, `${ici} : le mot tient dans le cadre du dessin`);
    const loin = Math.hypot(Math.max(regard.x0 - mot.x1, 0, mot.x0 - regard.x1), Math.max(regard.y0 - mot.y1, 0, mot.y0 - regard.y1));
    dire(loin <= 4, `${ici} : le mot reste près du regard (${loin.toFixed(2)} m)`);
  }
}

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le plan dessiné — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
