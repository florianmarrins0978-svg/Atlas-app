import { tracerReseaux, surLeBord, type Point } from "../src/lib/arrosage/trace";

/**
 * LE TRACÉ DES LIGNES — éprouvé sur SON jardin, celui du croquis du 21 août.
 *
 * **Ce que cette suite tient, et qu'aucune autre ne voyait :** le chemin du
 * tuyau. Le découpage en voies et la pose des arroseurs étaient calculés ; par
 * où passe la tranchée ne l'était pas, et c'est pourtant elle qui coûte des
 * heures d'homme.
 *
 * Les quatre règles du 21 août sont vérifiées ici, pas relues : tout part de la
 * nourrice, on minimise la TRANCHÉE et non le tuyau, on ne coupe pas le jardin,
 * et l'on va au plus court une fois les trois tenues.
 */

let echecs = 0;
function dire(vrai: boolean, quoi: string) {
  console.log(`  ${vrai ? "✓" : "✗"} ${quoi}`);
  if (!vrai) echecs++;
}

// Son jardin : la pelouse en L, 12 × 12 et 8 × 4.
const CONTOUR: Point[] = [
  { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 4 },
  { x: 12, y: 4 }, { x: 12, y: 12 }, { x: 0, y: 12 },
];
const N: Point = { x: 0, y: 4 };
const p = (x: number, y: number) => ({ x, y });

// Les 13 arroseurs, 9 turbines sur le carré et 4 tuyères sur la bande.
const ARROSEURS = [
  { point: p(0, 0), reseau: 1 }, { point: p(6, 0), reseau: 1 }, { point: p(12, 0), reseau: 1 },
  { point: p(0, 6), reseau: 1 }, { point: p(6, 6), reseau: 1 }, { point: p(12, 6), reseau: 1 },
  { point: p(0, 12), reseau: 1 }, { point: p(6, 12), reseau: 1 }, { point: p(12, 12), reseau: 1 },
  { point: p(16, 0), reseau: 2 }, { point: p(20, 0), reseau: 2 },
  { point: p(20, 4), reseau: 2 }, { point: p(16, 4), reseau: 2 },
];

console.log("\n=== Le tracé des lignes, sur son jardin du 21 août ===\n");
const t = tracerReseaux(N, ARROSEURS, CONTOUR);

// ── 1. Tout part de la nourrice ─────────────────────────────────────────────
dire(
  Object.values(t.lignes).every((chemins) => chemins.some((c) => c[0].x === N.x && c[0].y === N.y)),
  "chaque réseau a une ligne qui démarre à la nourrice",
);

// Et rien ne pend dans le vide : chaque ligne part d'un point déjà desservi.
dire(
  Object.values(t.lignes).every((chemins) => {
    const atteints = new Set([`${N.x},${N.y}`]);
    return chemins.every((c) => {
      const ok = atteints.has(`${c[0].x},${c[0].y}`);
      c.forEach((q) => atteints.add(`${q.x},${q.y}`));
      return ok;
    });
  }),
  "aucune ligne ne commence sur un point que son réseau n'atteint pas",
);

// ── 2. La tranchée est l'UNION, pas la somme ────────────────────────────────
const tuyau = Object.values(t.metresTuyau).reduce((a, b) => a + b, 0);
console.log(`\n  tuyau : ${tuyau} ml — tranchée : ${t.metresTranchee} ml\n`);
dire(
  t.metresTranchee < tuyau,
  `la tranchée (${t.metresTranchee} ml) est plus courte que le tuyau (${tuyau} ml) : les réseaux la partagent`,
);

// ── 3. On ne coupe pas le jardin d'un bord à l'autre ────────────────────────
const coupes = t.tranchee.filter((s) => {
  const milieu = { x: (s.de.x + s.a.x) / 2, y: (s.de.y + s.a.y) / 2 };
  return surLeBord(s.de, CONTOUR) && surLeBord(s.a, CONTOUR) && !surLeBord(milieu, CONTOUR);
});
dire(
  coupes.length === 0,
  coupes.length === 0
    ? "aucune tranchée ne coupe le jardin d'un bord à l'autre"
    : `${coupes.length} tranchée(s) coupent le jardin, à partir de ${JSON.stringify(coupes[0])}`,
);

// ── 4. Tous les arroseurs sont desservis ────────────────────────────────────
const desservis = new Set<string>();
for (const chemins of Object.values(t.lignes)) {
  for (const c of chemins) for (const q of c) desservis.add(`${q.x},${q.y}`);
}
const orphelins = ARROSEURS.filter((a) => !desservis.has(`${a.point.x},${a.point.y}`));
dire(
  orphelins.length === 0,
  orphelins.length === 0
    ? "les 13 arroseurs sont sur une ligne"
    : `${orphelins.length} arroseur(s) ne sont raccordés à rien, à partir de ${JSON.stringify(orphelins[0].point)}`,
);

// ── 5. Le second réseau profite de la tranchée du premier ───────────────────
//
// **C'est LA règle qui distingue ce tracé d'un plus-court-chemin.** Le réseau
// des tuyères doit traverser tout le jardin pour atteindre la bande : s'il
// creusait sa propre saignée, la tranchée vaudrait la somme des deux.
const seul = tracerReseaux(N, ARROSEURS.filter((a) => a.reseau === 2), CONTOUR);
dire(
  t.metresTranchee < t.metresTuyau[1] + seul.metresTranchee,
  `le second réseau emprunte la tranchée du premier (${t.metresTranchee} ml au lieu de ${(t.metresTuyau[1] + seul.metresTranchee).toFixed(1)})`,
);

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le tracé des lignes — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
