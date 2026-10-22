/**
 * Le plan lu, à vérifier — sa planche du 21 octobre 2026
 * (`appli/arrosage-plan-lu-a-verifier.html`), « code ça » le 22.
 *
 * Ce que cette suite tient :
 *
 *   1. **Le croquis lu se pose à l'échelle**, par la règle qui pose déjà le
 *      plan de la photo (`poserSurLeTerrain`) : les zones à leur place, la
 *      nourrice et le compteur aussi, tout dans le terrain.
 *   2. **Une cote absente reste absente** : la zone se dessine à sa taille
 *      dessinée, marquée manquante, et la phrase qui bloque le plan la nomme.
 *   3. **Une cote déduite se montre comme déduite**, avec ce dont elle vient.
 *   4. **Ce que le dessin montre ne se redit pas** sous lui ; le reste, si.
 *   5. **Une zone sans place se pose en bas**, et le dessin le dit.
 */
import assert from "node:assert/strict";
import type { CroquisLu, ZoneLue } from "../src/server/ai/services/lire-croquis";
import { lireReponseCroquis } from "../src/server/ai/services/lire-croquis";
import { phraseDuManque, planLuDuCroquis } from "../src/lib/arrosage/plan-lu";
import { zonesQuiDebordent } from "../src/lib/arrosage/dessin-du-plan";

let echecs = 0;
function dire(ok: boolean, quoi: string) {
  console.log(`${ok ? "✓" : "✗"} ${quoi}`);
  if (!ok) echecs++;
}

const zone = (z: Partial<ZoneLue> & Pick<ZoneLue, "type">): ZoneLue => ({
  nom: null, L: null, l: null, ml: null, x: null, y: null, largeurFraction: null, hauteurFraction: null, ...z,
});

// Son croquis du 21 octobre : une pelouse de 12 × 10, un massif de 3 × 6, une
// bande GAG le long du haut dont la longueur est déduite et la largeur absente.
const croquis: CroquisLu = {
  zones: [
    zone({ type: "gazon", nom: "Arroseur", L: 12, l: 10, x: 0.5, y: 0.55, largeurFraction: 0.8, hauteurFraction: 0.66 }),
    zone({ type: "massif", nom: "Goutte à goutte", L: 3, l: 6, x: 0.2, y: 0.45, largeurFraction: 0.2, hauteurFraction: 0.4 }),
    zone({ type: "haie", nom: "GAG", ml: 12, x: 0.5, y: 0.17, largeurFraction: 0.8, hauteurFraction: 0.04, deduites: [{ champ: "ml", depuis: "7,50 et 4,50 additionnés" }] }),
  ],
  pointDEau: "compteur",
  nourrice: { x: 0.85, y: 0.3 },
  piquage: { x: 0.95, y: 0.15 },
  reserves: [
    "la cote de 12 m de « GAG » n’est pas écrite, elle est déduite de 7,50 et 4,50 additionnés : vérifiez-la",
    "1 zone de goutte-à-goutte est écrite sur le croquis, elle n’a pas été lue : le plan ne l’arrose pas",
  ],
};

{
  const { dessin, reserves, pointDEau } = planLuDuCroquis(croquis);
  const [gazon, massif, haie] = dessin.zones;
  dire(gazon.L === 12 && gazon.l === 10 && !gazon.aVerifier, "la pelouse garde ses cotes, rien à vérifier");
  dire(massif.L === 3 && massif.l === 6, "le massif aussi");
  dire(haie.L === 12, "la haie prend ses mètres linéaires pour longueur");
  dire(haie.aVerifier?.manque.join() === "l", "sa largeur manque, et c'est dit");
  dire(haie.l > 0 && haie.l < 2, `elle se dessine quand même, à sa taille dessinée (${haie.l} m)`);
  dire(haie.aVerifier?.deduites[0]?.champ === "L" && haie.aVerifier.deduites[0].depuis === "7,50 et 4,50 additionnés", "sa longueur est marquée déduite, avec sa source");
  dire(zonesQuiDebordent(dessin).length === 0, "tout tient dans le terrain");
  dire(dessin.nourrice !== null && dessin.piquage !== null, "la nourrice et le compteur sont posés");
  dire(dessin.nourrice!.x <= dessin.terrain.L && dessin.piquage!.y <= dessin.terrain.l, "dans le terrain eux aussi");
  dire(haie.y < massif.y && massif.x < gazon.x + gazon.L / 2, "les places suivent le croquis : la bande en haut, le massif à gauche");
  dire(reserves.length === 1 && /n’a pas été lue/.test(reserves[0]) && reserves[0].endsWith("."), `seule la zone non lue se redit sous le dessin : ${JSON.stringify(reserves)}`);
  dire(pointDEau === "compteur", "le point d'eau suit le croquis");
  dire(phraseDuManque(haie, "l") === "Pas de plan : la largeur de « GAG » n’est pas sur le croquis.", "la phrase de la planche");
}

// Une zone que le croquis cite sans la dessiner : en bas, et c'est dit.
{
  const sans = { ...croquis, zones: [...croquis.zones, zone({ type: "gazon", nom: "Fond", L: 4, l: 3 })] };
  const { dessin, reserves } = planLuDuCroquis(sans);
  const fond = dessin.zones[3];
  const bas = Math.max(...dessin.zones.slice(0, 3).map((z) => z.y + z.l));
  dire(fond.y >= bas && fond.x === 0, "une zone sans place se pose sous les autres");
  dire(reserves.some((r) => /posée en bas/.test(r)), "et le dessin le dit");
  dire(zonesQuiDebordent(dessin).length === 0, "le terrain la contient");
}

// Aucune place lisible : tout en pile, rien d'inventé pour la nourrice.
{
  const nu: CroquisLu = { ...croquis, zones: croquis.zones.map((z) => ({ ...z, x: null, y: null, largeurFraction: null, hauteurFraction: null })) };
  const { dessin, reserves } = planLuDuCroquis(nu);
  dire(dessin.nourrice === null && dessin.piquage === null, "sans échelle, la nourrice n'est pas posée au jugé");
  dire(dessin.zones.every((z, i) => i === 0 || z.y > dessin.zones[i - 1].y), "les zones se posent l'une sous l'autre");
  dire(reserves.some((r) => /glissez-les/.test(r)), "et le dessin le dit");
}

// La lecture garde la source de la cote déduite, et la tourne avec la feuille.
{
  const reponse = (rotation: number) =>
    JSON.stringify({
      rotation_lecture: rotation,
      zones: [{ type: "massif", nom: "Massif", longueur_m: 6, largeur_m: 3, x: 0.5, y: 0.5, largeur_fraction: 0.4, hauteur_fraction: 0.2, cotes_deduites: [{ champ: "longueur_m", depuis: "le bord de la pelouse" }] }],
      point_d_eau: "compteur",
      nourrice: { x: 0.1, y: 0.1 },
      piquage: { x: 0.2, y: 0.1 },
      mots_d_arrosage: [],
    });
  const droit = lireReponseCroquis(reponse(0));
  const couche = lireReponseCroquis(reponse(90));
  dire(droit.ok && droit.croquis.zones[0].deduites?.[0]?.champ === "L", "la longueur déduite est relevée");
  dire(couche.ok && couche.croquis.zones[0].deduites?.[0]?.champ === "l" && couche.croquis.zones[0].l === 6, "au quart de tour, elle devient la largeur");
}

assert.ok(true);
console.log(echecs === 0 ? "\n✅ Le plan lu à vérifier — 0 échec." : `\n❌ ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
