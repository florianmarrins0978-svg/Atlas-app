import assert from "node:assert";
import { calculerPlan } from "../src/lib/arrosage/calcul.js";
import { dessinerPlan, type ZoneDessinee } from "../src/lib/arrosage/plan-dessine";
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

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le plan dessiné — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
