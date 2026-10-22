/**
 * Dessiner le plan au lieu de le photographier — sa planche B, choisie le
 * 18 octobre 2026 (« la B, parce qu'il faut que ça soit à l'échelle »), puis
 * « tu peux coder ».
 *
 * Ce que cette suite tient, et pourquoi chaque point a été vu rouge d'abord :
 *
 *   1. **Le dessin rend ce que la photo rend** (`croquisDuDessin`) : un
 *      `CroquisLu`, fractions prises sur un CARRÉ du côté du plus grand côté du
 *      terrain. Sinon un terrain de 34 × 16 donnerait deux échelles.
 *   2. **Ce qui vient du navigateur se relit** (`lireLeDessin`) : une cote
 *      absurde, une zone plus grande que le terrain (« je peux poser un carré
 *      de 12 par 12 alors que mon cadre fait 10 par 10 »), un type inconnu.
 *   3. **Le massif est une surface** : le calcul le mesure en longueur et
 *      largeur (`calcul.js`, forme « nappe »), mais la lecture de la photo et le
 *      filtre du serveur le prenaient en mètres linéaires. Un massif lu n'avait
 *      donc ni longueur ni largeur, et le calcul n'y posait aucune ligne, sans
 *      rien dire.
 *   4. **Une haie reçoit autant de lignes qu'il en faut** : « si le carré il
 *      est plus grand, peut-être qu'il en faudra 4, 5 ». Le calcul plafonnait à
 *      deux.
 *   5. **La maison et les dalles qu'on n'arrose pas coupent la zone** (ses oui
 *      du 19 octobre), l'aimant de 50 cm aux bouts, la rangée droite ou refusée.
 *   6. **Les courbes s'expliquent, elles ne se refusent pas** : une zone courbe
 *      part comme le rectangle qui l'entoure ; une rangée courbe ne coupe pas.
 *   7. **Ce qui arrive du téléphone se relit** : maisons, dalles, courbes,
 *      coins, bornes comprises.
 *   8. **Le pas du doigt et les cotes jusqu'aux bords.**
 */
import assert from "node:assert/strict";
import { calculerPlan } from "../src/lib/arrosage/calcul.js";
import { lireReponseCroquis } from "../src/server/ai/services/lire-croquis";
import { zoneMesuree } from "../src/lib/arrosage/croquis-complet";
import {
  AIMANT_M,
  croquisDuDessin,
  lireLeDessin,
  lignesDeLaZone,
  morceauxDe,
  phrasesDuDessin,
  redressee,
  zonesQuiDebordent,
  type DessinDuPlan,
  type PointMetres,
  type ZoneDessinee,
} from "../src/lib/arrosage/dessin-du-plan";
import { auPas, cadreDe, cotesAuxBords, formeLibre, longueurDeLaRangee, pasDuDoigt } from "../src/lib/arrosage/formes-du-dessin";

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "✓" : "✗"} ${quoi}`);
  if (!bon) echecs++;
};

// ── 4. Une haie de 10 m : autant d'eau par ligne, quel que soit leur nombre ──
const debitHaie = (lignes: number) => {
  const p = calculerPlan({
    seau: 10, temps: 20, pression: 3, compteur: "oui",
    zones: [{ id: 1, type: "haie", nom: "Haie", ml: 10, lignes, sortieGoutte: "ligne" }],
  } as never) as { secteurs: { debit: number }[] };
  return p.secteurs.reduce((s, x) => s + x.debit, 0);
};
const une = debitHaie(1);
dire(une > 0, `une ligne de 10 m consomme (${une})`);
dire(Math.abs(debitHaie(2) - 2 * une) < 1e-9, "deux lignes, deux fois l'eau");
dire(Math.abs(debitHaie(4) - 4 * une) < 1e-9, "quatre lignes, quatre fois l'eau (le calcul plafonnait à deux)");
dire(Math.abs(debitHaie(0) - une) < 1e-9, "sans nombre lisible, une ligne, comme avant");

// ── 3. Le massif est une surface, sur la photo comme partout ────────────────
const lu = lireReponseCroquis(
  JSON.stringify({
    zones: [{ type: "massif", nom: "Massif", longueur_m: 10, largeur_m: 2.4 }],
    point_d_eau: "compteur",
  })
);
dire(lu.ok && lu.croquis.zones[0].L === 10 && lu.croquis.zones[0].l === 2.4, "un massif lu garde sa longueur et sa largeur");
dire(lu.ok && !lu.croquis.reserves.some((r) => /Massif/.test(r)), "et ses cotes ne sont pas dites manquantes");
dire(zoneMesuree({ type: "massif", L: 10, l: 2.4, ml: null }), "un massif à deux cotes est mesuré");
dire(!zoneMesuree({ type: "massif", L: null, l: null, ml: 12 }), "un massif en mètres linéaires ne l'est pas : le calcul n'en ferait rien");
dire(zoneMesuree({ type: "haie", L: null, l: null, ml: 12 }), "une haie l'est par ses mètres linéaires");

// ── 1. Le dessin rend un croquis lu ─────────────────────────────────────────
const brut = {
  terrain: { L: 34, l: 16 },
  zones: [
    { type: "gazon", nom: "Pelouse arrière", L: 12, l: 12, x: 0, y: 0 },
    { type: "haie", nom: "Haie du fond", L: 15, l: 2.5, x: 14, y: 13, lignes: 3 },
  ],
  nourrice: { x: 13, y: 6 },
  piquage: { x: 1, y: 1 },
};
const dessin = lireLeDessin(brut);
dire(dessin.ok, `un dessin juste se lit${dessin.ok ? "" : ` (${dessin.raison})`}`);
if (dessin.ok) {
  const c = croquisDuDessin(dessin.dessin, "compteur");
  const p = c.zones[0];
  dire(p.L === 12 && p.l === 12 && p.ml === null, "la pelouse garde ses cotes");
  // Le carré fait 34 m : la pelouse de 12 m posée en 0,0 a son centre à 6 m.
  dire(Math.abs((p.x ?? 0) - 6 / 34) < 1e-4 && Math.abs((p.y ?? 0) - 6 / 34) < 1e-4, "son centre est en fraction du CARRÉ, pas du rectangle");
  dire(Math.abs((p.largeurFraction ?? 0) - 12 / 34) < 1e-4 && Math.abs((p.hauteurFraction ?? 0) - 12 / 34) < 1e-4, "son emprise aussi");
  const h = c.zones[1];
  dire(h.ml === 15 && h.L === null && h.l === null, "la haie part en mètres linéaires");
  dire(h.lignes === 3, "avec le nombre de lignes qu'il a choisi");
  dire(c.pointDEau === "compteur", "le point d'eau suit son choix du piquage");
  dire(c.nourrice !== null && Math.abs(c.nourrice.x - 13 / 34) < 1e-4, "la nourrice est où il l'a posée");
  dire(c.reserves.length === 0, "rien n'est dit manquant quand rien ne manque");
}

const sansNourrice = lireLeDessin({ ...brut, nourrice: null });
dire(
  sansNourrice.ok && croquisDuDessin(sansNourrice.dessin, "compteur").nourrice === null,
  "la nourrice absente reste absente : l'outil ne la pose jamais",
);

// ── 2. Ce qui vient du navigateur se relit ──────────────────────────────────
const refuse = (quoi: string, d: unknown) => {
  const r = lireLeDessin(d);
  dire(!r.ok, quoi + (r.ok ? "" : ` (« ${r.raison} »)`));
};
refuse("un dessin qui n'en est pas un est refusé", "rien");
refuse("un terrain sans cote est refusé", { ...brut, terrain: { L: null, l: 16 } });
refuse("une cote au-delà de 100 m est refusée", { ...brut, terrain: { L: 1e6, l: 16 } });
refuse("une cote qui n'est pas un nombre est refusée", { ...brut, zones: [{ ...brut.zones[0], L: "douze" }] });
refuse("un type inconnu n'est pas traduit au jugé", { ...brut, zones: [{ ...brut.zones[0], type: "verger" }] });
refuse("12 × 12 dans un terrain de 10 × 10 est refusé", { ...brut, terrain: { L: 10, l: 10 } });
refuse("une zone posée hors du terrain est refusée", { ...brut, zones: [{ ...brut.zones[0], x: 30 }] });
refuse("une nourrice hors du terrain est refusée", { ...brut, nourrice: { x: 50, y: 2 } });
refuse("cent zones, ce n'est plus un jardin", { ...brut, zones: Array.from({ length: 100 }, () => brut.zones[0]) });
refuse("un nombre de lignes absurde est refusé", { ...brut, zones: [{ ...brut.zones[1], lignes: 1e6 }] });
refuse("un écart de 1 cm est refusé", { ...brut, zones: [{ ...brut.zones[1], ecartLignes: 0.01 }] });

dire(
  zonesQuiDebordent({ terrain: { L: 10, l: 10 }, zones: [{ type: "gazon", nom: null, L: 12, l: 12, x: 0, y: 0 }] }).length === 1,
  "la même règle que l'écran dit quelle zone ne tient pas",
);

// ── La proposition de lignes : un écart du bord, puis un écart entre chaque ──
// Ses règles du 21 et du 22 octobre 2026 : haie 50 cm, massif 60 cm d'office,
// la première à un écart du bord, jamais à 0 ; 2 m de haie font 4 lignes.
{
  const haie = (l: number, donne = {}) => lignesDeLaZone("haie", 12, l, donne);
  dire(haie(2)?.lignes === 4 && haie(2)?.ecart === 0.5, "une haie de 2 m : 4 lignes tous les 50 cm");
  dire(haie(2.5)?.lignes === 5, "une haie de 2,5 m : 5 lignes");
  dire(haie(0.3)?.lignes === 1, "une haie plus étroite que l'écart garde une ligne");
  const choisi = haie(2, { lignes: 3 });
  dire(choisi?.lignes === 3 && Math.abs((choisi?.ecart ?? 0) - 2 / 3) < 1e-9 && choisi?.propose === 4, "3 lignes choisies sur 2 m : l'écart se recalcule, la proposition reste dite");
  const tape = haie(2, { ecartLignes: 0.4 });
  dire(tape?.lignes === 5 && tape?.ecart === 0.4, "un écart tapé de 40 cm sur 2 m : 5 lignes");
  dire(lignesDeLaZone("massif", 6, 3, {})?.lignes === 5 && lignesDeLaZone("massif", 3, 6, {})?.lignes === 5, "un massif se compte sur son petit côté, tous les 60 cm");
  dire(lignesDeLaZone("gazon", 6, 3, {}) === null, "une pelouse n'a pas de lignes");
  dire(lignesDeLaZone("haie", 12, null, {}) === null, "sans largeur, aucune proposition");
}

// ── 5. La maison et les dalles qu'on n'arrose pas COUPENT la zone ───────────
// Ses réponses du 19 octobre : « si on ne les arrose pas, il faudra les
// utiliser comme si c'était la fin de la délimitation », et « la maison, oui ».
// Son cas : une pelouse de 20 × 20, une maison de 10 × 10 collée au fond.
const terrain20 = { L: 20, l: 20 };
const pelouse20: ZoneDessinee = { type: "gazon", nom: null, L: 20, l: 20, x: 0, y: 0 };
const avecMaison: DessinDuPlan = {
  terrain: terrain20,
  zones: [pelouse20],
  maisons: [{ nom: null, L: 10, l: 10, x: 5.6, y: 0 }],
  dalles: [],
  nourrice: { x: 1, y: 19 },
  piquage: { x: 0, y: 19 },
};
const parts = morceauxDe(pelouse20, avecMaison);
const tailles = parts.parts.map((p) => `${Math.round(p.L * 100) / 100}x${Math.round(p.l * 100) / 100}`).sort();
dire(tailles.join(" ") === ["20x10", "4.4x10", "5.6x10"].sort().join(" "), `la maison coupe la pelouse en 20 × 10, 5,6 × 10 et 4,4 × 10 (${tailles.join(" ")})`);
dire(phrasesDuDessin(avecMaison).includes("Maison coupe Pelouse en 3 parts."), `l'écran dit « Maison coupe Pelouse en 3 parts. » (${phrasesDuDessin(avecMaison).join(" | ")})`);
const croquisMaison = croquisDuDessin(avecMaison, "compteur");
dire(croquisMaison.zones.length === 3, "chaque morceau part au calcul comme une zone, la maison n'y part pas");
dire(croquisMaison.zones.map((z) => z.nom).sort().join(",") === "Pelouse 1,Pelouse 2,Pelouse 3", "les morceaux portent le nom de la zone, numérotés");
const couverte: DessinDuPlan = { ...avecMaison, maisons: [{ nom: null, L: 20, l: 20, x: 0, y: 0 }] };
dire(croquisDuDessin(couverte, "compteur").zones.length === 0, "une zone couverte par la maison n'entre pas dans le plan");
dire(phrasesDuDessin(couverte).includes("Maison couvre Pelouse entièrement, cette zone n’entre pas dans le plan."), "et l'écran le dit");

// Une allée de 1 m qu'on n'arrose pas, en travers d'une pelouse de 12 × 12.
const allee = (a: PointMetres, b: PointMetres): DessinDuPlan => ({
  terrain: { L: 12, l: 12 },
  zones: [{ type: "gazon", nom: "Pelouse arrière", L: 12, l: 12, x: 0, y: 0 }],
  maisons: [],
  dalles: [{ a, b, l: 1 }],
  nourrice: null,
  piquage: null,
});
const coupee = morceauxDe(allee({ x: 0, y: 6 }, { x: 12, y: 6 }).zones[0], allee({ x: 0, y: 6 }, { x: 12, y: 6 }));
dire(coupee.parts.length === 2 && coupee.parts.every((p) => p.L === 12 && Math.abs(p.l - 5.5) < 1e-9), "une allée couchée coupe la pelouse en deux bandes de 12 × 5,5");
dire(phrasesDuDessin(allee({ x: 0, y: 6 }, { x: 12, y: 6 })).includes("Les dalles coupent Pelouse arrière en 2 parts."), "les dalles coupent, au pluriel");

// **L'aimant, validé le 19 octobre** : le doigt ne touche jamais le bord exact.
const aimantee = morceauxDe(allee({ x: 0.3, y: 6 }, { x: 11.6, y: 6 }).zones[0], allee({ x: 0.3, y: 6 }, { x: 11.6, y: 6 }));
dire(aimantee.parts.length === 2, `un bout à 30 et 40 cm du bord va jusqu'au bord, aucune lanière ne devient une zone (${aimantee.parts.length} parts)`);
const loin = morceauxDe(allee({ x: 0.6, y: 6 }, { x: 12, y: 6 }).zones[0], allee({ x: 0.6, y: 6 }, { x: 12, y: 6 }));
dire(loin.parts.length === 3, `à 60 cm du bord, l'aimant ne prend pas (${loin.parts.length} parts)`);
dire(AIMANT_M === 0.5, "l'aimant fait 50 cm");

// Droite ou refusée : à moins de 10° d'un axe, elle se redresse.
const presque = redressee({ x: 0, y: 0 }, { x: 10, y: 10 * Math.tan((8 * Math.PI) / 180) });
dire(presque !== null && Math.abs(presque.y) < 1e-9 && Math.abs(presque.x - Math.hypot(10, 10 * Math.tan((8 * Math.PI) / 180))) < 1e-9, "à 8°, la rangée se couche en gardant sa distance");
const debout = redressee({ x: 3, y: 0 }, { x: 3.5, y: 6 });
dire(debout !== null && debout.x === 3 && debout.y > 6, "presque debout, elle se met debout");
dire(redressee({ x: 0, y: 0 }, { x: 10, y: 10 * Math.tan((12 * Math.PI) / 180) }) === null, "à 12°, elle ne se redresse pas");

// ── 6. Les courbes : expliquer, jamais refuser ─────────────────────────────
// Sa règle : « il faut juste qu'ils l'expliquent, mais qu'ils ne refusent pas ;
// ils disent que ça sera quand même arrosé ».
const bombee: ZoneDessinee = { type: "gazon", nom: null, L: 10, l: 8, x: 2, y: 2, courbes: { droite: { u: 0.5, v: 2 } } };
const cadre = cadreDe(bombee);
// Une Bézier du second degré passe à mi-chemin de son point de contrôle : 1 m.
dire(Math.abs(cadre.L - 11) < 1e-9 && Math.abs(cadre.l - 8) < 1e-9 && cadre.x === 2, `le côté bombé de 1 m donne un rectangle de 11 × 8 (${cadre.L} × ${cadre.l})`);
const dessinBombe: DessinDuPlan = { terrain: { L: 20, l: 20 }, zones: [bombee], maisons: [], dalles: [], nourrice: null, piquage: null };
const zoneBombee = croquisDuDessin(dessinBombe, "compteur").zones[0];
dire(zoneBombee.L === 11 && zoneBombee.l === 8, "la zone courbe part au calcul comme le rectangle qui l'entoure");
dire(phrasesDuDessin(dessinBombe).includes("La forme de Pelouse est arrosée comme le rectangle qui l’entoure, 11 × 8 m. Les arroseurs du bord peuvent mouiller un peu au-delà."), "et l'écran l'explique");
const massifCoin: ZoneDessinee = { type: "massif", nom: null, L: 8, l: 4, x: 0, y: 0, coins: { hd: { x: 1, y: 0 } } };
dire(cadreDe(massifCoin).L === 9 && formeLibre(massifCoin), "un coin tiré élargit le rectangle");
dire(
  phrasesDuDessin({ ...dessinBombe, zones: [massifCoin] }).includes("Le goutte-à-goutte de Massif est compté sur le rectangle qui l’entoure, 9 × 4 m, un peu plus de tube que la forme."),
  "le goutte-à-goutte d'un massif courbe se compte sur son rectangle, et l'écran le dit",
);
dire(!formeLibre({ ...bombee, courbes: undefined }), "sans courbe ni coin, la zone n'est pas libre");

// Une rangée courbe qu'on n'arrose pas ne coupe pas.
const enS: DessinDuPlan = { ...allee({ x: 0, y: 6 }, { x: 12, y: 6 }), dalles: [{ a: { x: 0, y: 6 }, b: { x: 12, y: 6 }, l: 1, courbe: [{ u: 1 / 3, v: 0.1 }, { u: 2 / 3, v: -0.1 }] }] };
dire(morceauxDe(enS.zones[0], enS).parts.length === 1, "une rangée en S qu'on n'arrose pas ne coupe pas la zone");
dire(phrasesDuDessin(enS).includes("Les dalles en courbe ne coupent pas Pelouse arrière : elles sont arrosées avec cette zone."), "et l'écran le dit");
const longueurS = longueurDeLaRangee(enS.dalles[0]);
dire(longueurS > 12 && longueurS < 13, `la distance d'une rangée courbe se mesure le long de la courbe (${longueurS})`);

// ── 7. Ce qui arrive du téléphone se relit, bornes comprises ───────────────
const brut2 = { ...brut, maisons: [], dalles: [] };
refuse("une maison hors du terrain est refusée", { ...brut2, maisons: [{ nom: null, L: 10, l: 10, x: 30, y: 0 }] });
refuse("une maison sans cote est refusée", { ...brut2, maisons: [{ nom: null, L: 0, l: 10, x: 0, y: 0 }] });
refuse("des dalles non arrosées en biais sont refusées", { ...brut2, dalles: [{ a: { x: 0, y: 0 }, b: { x: 10, y: 5 }, l: 1 }] });
refuse("une courbe qui n'est pas un nombre est refusée", { ...brut2, zones: [{ ...brut.zones[0], courbes: { haut: { u: "x", v: 1 } } }] });
refuse("une zone dont la courbe sort du terrain est refusée", { ...brut2, zones: [{ ...brut.zones[0], courbes: { haut: { u: 0.5, v: 40 } } }] });
refuse("un coin tiré hors du terrain est refusé", { ...brut2, zones: [{ ...brut.zones[0], coins: { hg: { x: -3, y: 0 } } }] });
refuse("une rangée en S qui sort du terrain est refusée", { ...brut2, dalles: [{ a: { x: 1, y: 10 }, b: { x: 12, y: 10 }, l: 1, courbe: [{ u: 1 / 3, v: -2 }, { u: 2 / 3, v: 0 }] }] });
refuse("une courbe de rangée absurde est refusée", { ...brut2, dalles: [{ a: { x: 1, y: 10 }, b: { x: 12, y: 10 }, l: 1, courbe: [{ u: 1 / 3, v: 1e9 }, { u: 2 / 3, v: 0 }] }] });
refuse("cent maisons, ce n'est plus un jardin", { ...brut2, maisons: Array.from({ length: 100 }, () => ({ nom: null, L: 1, l: 1, x: 0, y: 0 })) });
const relu = lireLeDessin({
  ...brut2,
  maisons: [{ nom: "Garage", L: 4, l: 4, x: 2, y: 2 }],
  dalles: [{ a: { x: 0, y: 6 }, b: { x: 12, y: 6.5 }, l: 1 }],
  zones: [{ ...brut.zones[0], courbes: { bas: { u: 0.5, v: 1 } }, coins: { hd: { x: -1, y: 1 } } }, brut.zones[1]],
});
dire(relu.ok, `un dessin avec maison, dalles et courbes se lit${relu.ok ? "" : ` (${relu.raison})`}`);
if (relu.ok) {
  dire(relu.dessin.maisons[0].nom === "Garage" && relu.dessin.dalles.length === 1, "la maison et les dalles arrivent au calcul");
  dire(relu.dessin.dalles[0].b.y === 6, "le serveur redresse la rangée comme l'écran");
  dire(relu.dessin.zones[0].courbes?.bas?.v === 1 && relu.dessin.zones[0].coins?.hd?.x === -1, "la courbe et le coin arrivent tels quels");
  dire(phrasesDuDessin(relu.dessin).some((p) => /^Les dalles et Garage coupent Pelouse arrière en \d+ parts\.$/.test(p)), `les deux coupent ensemble (${phrasesDuDessin(relu.dessin).join(" | ")})`);
}
dire(lireLeDessin(brut).ok, "un dessin sans maison ni dalles se lit toujours");

// ── 8. Le doigt avance par pas, et les cotes vont jusqu'aux bords ───────────
dire(pasDuDoigt(null) === 0.1 && pasDuDoigt(200) === 0.05 && pasDuDoigt(100) === 0.01 && pasDuDoigt(20) === 0.01, "10 cm sur tout le terrain, 5 cm à 1/200, 1 cm à 1/100 et au-delà");
dire(Math.abs(auPas(5.63, 200) - 5.65) < 1e-9 && Math.abs(auPas(5.63, null) - 5.6) < 1e-9, "le doigt tombe sur le pas");
const bords = cotesAuxBords({ x: 5.6, y: 0, L: 10, l: 10 }, terrain20);
dire(Math.abs(bords.gauche - 5.6) < 1e-9 && Math.abs(bords.droite - 4.4) < 1e-9 && bords.haut === 0 && bords.bas === 10, "la maison collée au fond : 5,6 m à gauche, 4,4 m à droite, 10 m devant");

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
