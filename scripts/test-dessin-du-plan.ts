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
 */
import assert from "node:assert/strict";
import { calculerPlan } from "../src/lib/arrosage/calcul.js";
import { lireReponseCroquis } from "../src/server/ai/services/lire-croquis";
import { zoneMesuree } from "../src/lib/arrosage/croquis-complet";
import {
  croquisDuDessin,
  lireLeDessin,
  lignesProposees,
  zonesQuiDebordent,
} from "../src/lib/arrosage/dessin-du-plan";

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "✓" : "✗"} ${quoi}`);
  if (!bon) echecs++;
};

// ── 4. Une haie de 10 m : autant d'eau par ligne, quel que soit leur nombre ──
const debitHaie = (lignes: number) => {
  const p = calculerPlan({
    seau: 10, temps: 20, pression: 3, compteur: "oui",
    zones: [{ id: 1, type: "haie", nom: "Haie", ml: 10, lignesHaie: lignes, sortieGoutte: "ligne" }],
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
    { type: "haie", nom: "Haie du fond", L: 15, l: 2.5, x: 14, y: 13, lignesHaie: 3 },
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
  dire(h.lignesHaie === 3, "avec le nombre de lignes qu'il a choisi");
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
refuse("un nombre de lignes absurde est refusé", { ...brut, zones: [{ ...brut.zones[1], lignesHaie: 1e6 }] });

dire(
  zonesQuiDebordent({ terrain: { L: 10, l: 10 }, zones: [{ type: "gazon", nom: null, L: 12, l: 12, x: 0, y: 0 }] }).length === 1,
  "la même règle que l'écran dit quelle zone ne tient pas",
);

// ── La proposition de lignes, sa règle : une ligne arrose une bande de 1 m ──
dire(lignesProposees(1) === 1 && lignesProposees(2) === 2 && lignesProposees(2.5) === 3 && lignesProposees(4.5) === 5, "1 m, 2 m, 2,5 m, 4,5 m : 1, 2, 3, 5 lignes");
dire(lignesProposees(null) === null, "sans largeur, aucune proposition");

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
