import { calculerPlan } from "../src/lib/arrosage/calcul.js";
import { CATALOGUE } from "../src/lib/arrosage/catalogue.js";
import { dessinerPlan, type ZoneDessinee } from "../src/lib/arrosage/plan-dessine";
import { ANTENNE_MAX, distance } from "../src/lib/arrosage/trace";
import { piecesDuPlan } from "../src/lib/arrosage/pieces";
import { etatDuCroquis } from "../src/lib/arrosage/croquis-complet";
import { longueurDeLAmenee } from "../src/lib/arrosage/geometrie-croquis";
import { debitRetenu } from "../src/lib/arrosage/mesure-debit";

/**
 * LES RÈGLES DU PATRON, AVEC SES CHIFFRES — et un rouge ici ne se réécrit JAMAIS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa colère du 11 septembre 2026 :** *« À quoi ça sert que je donne des
 * règles si elles deviennent obsolètes au bout d'une semaine sans raison ? »*
 *
 * Elle était fondée. Sa règle du 18 août — sept tuyères en quinconce sur son
 * couloir de 10 × 2 — est morte le 24 août : une correction sur les pelouses a
 * fait rougir le contrôle qui la tenait, et la session l'a **réécrit pour qu'il
 * repasse** au lieu de chercher pourquoi (`appli/tests/essai-arrosage-detaille.cjs`,
 * « ce contrôle a changé de règle »). Une seconde règle — l'antenne Ø16 de 2 m
 * au plus — avait été donnée et jamais écrite. Personne ne l'a vu, parce
 * qu'aucune suite ne portait SON exemple avec SES chiffres.
 *
 * **Ce que cette suite est, et ce qu'elle n'est pas.** Une entrée par règle
 * qu'il a donnée, éprouvée sur l'exemple qu'il a donné avec elle — le couloir,
 * le carré de 12, la bande de 8 × 4, ses deux pelouses. Elle ne teste pas du
 * code : elle tient une parole. Un rouge ici a exactement deux lectures, et
 * aucune n'est « adapter le contrôle » :
 *
 *   · le code a tort, et c'est lui qu'on corrige ;
 *   · la règle a changé — et alors c'est LUI qui l'a dit, sa phrase et sa
 *     date s'écrivent ici, et l'ancienne entrée reste barrée, jamais effacée.
 *
 * `scripts/garde-regles-du-patron.mjs` tient cette promesse mécaniquement : ce
 * fichier ne s'écrase pas, et une entrée existante ne se modifie pas depuis une
 * session. On ne peut qu'AJOUTER, sous le repère de fin.
 * ─────────────────────────────────────────────────────────────────────────────
 */

let passed = 0;
let failed = 0;
function regle(date: string, mots: string, corps: () => void) {
  try {
    corps();
    passed++;
    console.log(`  ✓ ${date} — ${mots}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${date} — ${mots}\n    ${(e as Error).message}`);
  }
}
function exige(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

type Zone = { id: number; type: string; nom: string; x: number; y: number; L: number; l: number };
type Plan = ReturnType<typeof calculerPlan> & { dessin: ZoneDessinee[]; couleurs: string[] };
const plan = (zones: Zone[], pression = 3, compteur = "oui") =>
  calculerPlan({ seau: 10, temps: 20, pression, compteur, zones } as never) as Plan;
const dessine = (p: Plan, nourrice: { x: number; y: number }) => {
  const d = dessinerPlan(p.dessin, nourrice, p.couleurs);
  if (!d.ok) throw new Error(`le plan a été refusé : ${d.raison}`);
  return d.dessin;
};

console.log("\n=== Les règles du patron, avec ses chiffres ===\n");

// ── Le quinconce dans les couloirs ─────────────────────────────────────────
regle("18 août 2026", "« dans les couloirs, les tuyères en quinconce » — son couloir de 10 × 2 : 7 tuyères, pas 12", () => {
  const z = plan([{ id: 1, type: "gazon", nom: "Couloir", x: 0, y: 0, L: 10, l: 2 }]).dessin[0];
  exige(z.cle === "tuyere", `un couloir de 2 m prend des tuyères, pas « ${z.cle} »`);
  exige(z.points.length === 7, `${z.points.length} tuyères posées — son croquis en porte 7`);
  const enHaut = z.points.filter((p: { y: number }) => p.y === 0).length;
  const enBas = z.points.filter((p: { y: number }) => p.y === 2).length;
  exige(enHaut === 4 && enBas === 3, `${enHaut} en haut, ${enBas} en bas : ce n'est pas une tête sur deux en alternant les bords`);
});

regle("17 août 2026", "« jamais moins que la portée » — entre deux têtes, pas sur le pas des colonnes", () => {
  for (const [L, l] of [[10, 2], [10, 3], [8, 4], [12, 12]]) {
    const z = plan([{ id: 1, type: "gazon", nom: "Z", x: 0, y: 0, L, l }]).dessin[0];
    for (let i = 0; i < z.points.length; i++)
      for (let j = i + 1; j < z.points.length; j++) {
        const d = Math.hypot(z.points[i].x - z.points[j].x, z.points[i].y - z.points[j].y);
        exige(d >= z.portee - 0.01, `${L} × ${l} : deux têtes à ${d.toFixed(2)} m pour une portée de ${z.portee} m`);
      }
  }
});

// ── Les turbines des grandes pelouses ──────────────────────────────────────
regle("23 août 2026", "« cinq réseaux pour ça ??????? » — son carré de 12 × 12 : 9 turbines, 1 vanne", () => {
  const p = plan([{ id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 12, l: 12 }]);
  exige(p.dessin[0].cle === "turbine", "un 12 × 12 prend des turbines");
  exige(p.dessin[0].points.length === 9, `${p.dessin[0].points.length} turbines — il en a dessiné 9`);
  exige(p.secteurs.length === 1, `${p.secteurs.length} réseaux — il en veut 1`);
});

// ── L'antenne Ø16 : 2 m au plus, et le Ø25 en un seul passage ──────────────
regle("11 septembre 2026", "« le max c'est 2 m de 16 rigide » — aucune antenne plus longue, sur aucun jardin", () => {
  const jardins: Zone[][] = [
    [{ id: 1, type: "gazon", nom: "Couloir 3", x: 0, y: 0, L: 10, l: 3 }],
    [{ id: 1, type: "gazon", nom: "Couloir 5", x: 0, y: 0, L: 10, l: 5 }],
    [{ id: 1, type: "gazon", nom: "Bande", x: 0, y: 0, L: 8, l: 4 }],
    [
      { id: 1, type: "gazon", nom: "Arrière", x: 0, y: 0, L: 18, l: 12 },
      { id: 2, type: "gazon", nom: "Avant", x: 0, y: 14, L: 12, l: 8 },
      { id: 3, type: "gazon", nom: "Couloir", x: 18, y: 0, L: 10, l: 2 },
    ],
  ];
  for (const zones of jardins) {
    const d = dessine(plan(zones), { x: 0, y: zones[0].l / 2 });
    for (const r of d.reseaux)
      for (const a of r.antennes)
        exige(distance(a.de, a.a) <= ANTENNE_MAX + 1e-9, `${zones[0].nom} : une antenne de ${distance(a.de, a.a).toFixed(2)} m`);
  }
});

regle("11 septembre 2026", "« si le couloir fait 3 m, une seule tranchée au milieu » — 10 × 3 : un passage, des antennes de 1,50 m", () => {
  const d = dessine(plan([{ id: 1, type: "gazon", nom: "Couloir", x: 0, y: 0, L: 10, l: 3 }]), { x: 0, y: 1.5 });
  exige(d.metresTranchee <= 10 + 1e-9, `${d.metresTranchee} ml de tranchée pour un couloir de 10 m : ce n'est pas un seul passage`);
  const antennes = d.reseaux.flatMap((r) => r.antennes);
  exige(antennes.length === d.reseaux.flatMap((r) => r.tetes).length, "chaque tuyère pend au bout d'une antenne");
  exige(antennes.every((a) => Math.abs(distance(a.de, a.a) - 1.5) < 1e-6), "les antennes font un demi-couloir : 1,50 m");
});

regle("11 septembre 2026", "« si le couloir fait 5 m, on ne peut plus faire une seule tranchée » — la ligne repasse au pied", () => {
  const d = dessine(plan([{ id: 1, type: "gazon", nom: "Couloir", x: 0, y: 0, L: 10, l: 5 }]), { x: 0, y: 2.5 });
  exige(d.reseaux.every((r) => r.antennes.length === 0), "à 5 m, aucune antenne de 2,50 m : la ligne va au pied de chaque tête");
  exige(d.metresTranchee > 10, `${d.metresTranchee} ml : une seule tranchée ne peut pas tenir les 2 m`);
});

// ── Ce que le réseau annonce est ce que le plan dessine ────────────────────
const DEUX_PELOUSES: Zone[] = [
  { id: 1, type: "gazon", nom: "Devant", x: 0, y: 0, L: 10, l: 6 },
  { id: 2, type: "gazon", nom: "Derrière", x: 0, y: 14, L: 12, l: 8 },
];
regle("21 août 2026", "« tés + coudes = arroseurs, pour chaque réseau » — et la liste des pièces dit la même chose que le dessin", () => {
  const p = plan(DEUX_PELOUSES);
  const d = dessine(p, { x: 13, y: 10 });
  for (const r of d.reseaux) exige(r.tes + r.coudes === r.tetes.length, `réseau ${r.numero + 1} : ${r.tes} + ${r.coudes} ≠ ${r.tetes.length}`);
  const pieces = piecesDuPlan(p.materiel, d, { compteur: true, seuil25: p.amenee.longueurMax25, amenee: null });
  const q = (ref: string, ou: string) => pieces.filter((x) => x.ref === ref && x.ou === ou).reduce((t, x) => t + (x.q ?? 0), 0);
  const somme = (f: (r: (typeof d.reseaux)[number]) => number) => d.reseaux.reduce((t, r) => t + f(r), 0);
  exige(q("te-taraude-25-34-25", "jardin") === somme((r) => r.tes), "les tés de la liste ne sont pas ceux du dessin");
  exige(q("coude-taraude-25-34", "jardin") === somme((r) => r.coudes), "les coudes de la liste ne sont pas ceux du dessin");
  exige(q("te-25-25-25", "jardin") === somme((r) => r.tesEgaux), "les tés égaux de la liste ne sont pas ceux du dessin");
  exige(q("pe25", "jardin") >= somme((r) => r.metresTuyau), "le tuyau Ø25 des réseaux manque, ou il est plus court que le tracé");
});

regle("11 septembre 2026", "« il faut un té égal à côté du premier arroseur pour faire la jonction » — une tête à trois branches en porte un", () => {
  const d = dessine(plan([{ id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 12, l: 12 }]), { x: 0, y: 4 });
  const bleu = d.reseaux[0];
  exige(bleu.tesEgaux >= 1, "aucun té égal compté sur un réseau dont la ligne se sépare");
  exige(bleu.jonctions.length === bleu.tesEgaux, "chaque té égal a son losange sur le plan");
});

regle("21 août 2026", "« on va devoir couper la ligne et mettre un té égal » — au compteur, un 25×25×25 dans l'amenée ; au robinet, aucun", () => {
  const p = plan(DEUX_PELOUSES);
  const d = dessine(p, { x: 13, y: 10 });
  const auCompteur = piecesDuPlan(p.materiel, d, { compteur: true, seuil25: 50, amenee: null }).filter((x) => x.ou === "amenee" && x.ref === "te-25-25-25");
  const auRobinet = piecesDuPlan(p.materiel, d, { compteur: false, seuil25: 50, amenee: null }).filter((x) => x.ou === "amenee" && x.ref === "te-25-25-25");
  exige(auCompteur.length === 1 && auCompteur[0].q === 1, "le té du compteur manque dans l'amenée");
  exige(auRobinet.length === 0, "un té du compteur est facturé sur un piquage au robinet");
});

regle("21 août 2026", "« trois zones, jamais mélangées » — compteur → nourrice, regard, jardin, et rien en dehors", () => {
  const p = plan(DEUX_PELOUSES);
  const pieces = piecesDuPlan(p.materiel, dessine(p, { x: 13, y: 10 }), { compteur: true, seuil25: 50, amenee: null });
  for (const ou of ["amenee", "regard", "jardin"]) exige(pieces.some((x) => x.ou === ou), `la zone « ${ou} » est vide`);
  exige(pieces.some((x) => x.ou === "regard" && /lectrovanne/i.test(x.nom)), "l'électrovanne n'est pas dans le regard");
  exige(pieces.some((x) => x.ou === "jardin" && /PEBD/.test(x.nom)), "le PEBD Ø16 n'est pas au jardin");
  exige(pieces.some((x) => x.ou === "amenee" && x.q === null), "la longueur d'amenée n'est pas « à mesurer » : elle a été devinée");
});

// ── Sans croquis complet, aucun plan ───────────────────────────────────────
regle("21 août 2026", "« sans ça il ne doit rien proposer » — pas de nourrice, pas de plan ; pas de métrés, pas de plan", () => {
  exige(!etatDuCroquis({ zonesMesurees: 3, nourrice: false, piquage: true, branchement: "compteur" }).complet, "un croquis sans nourrice passe");
  exige(!etatDuCroquis({ zonesMesurees: 0, nourrice: true, piquage: true, branchement: "compteur" }).complet, "un croquis sans métrés passe");
  exige(etatDuCroquis({ zonesMesurees: 1, nourrice: true, piquage: true, branchement: "ailleurs" }).complet, "un croquis complet est refusé");
  exige(etatDuCroquis({ zonesMesurees: 3, nourrice: false, piquage: true, branchement: "compteur" }).manque.includes("nourrice"), "le manque n'est pas nommé");
});

// ── Le débit et la pression ────────────────────────────────────────────────
regle("22 août 2026", "« en Ø25 c'est 1,76 m³/h, le calcul doit se faire là-dessus » — une source à 9 m³/h est plafonnée par le tuyau", () => {
  const p = calculerPlan({ seau: 10, temps: 4, pression: 3, compteur: "non", zones: [{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L: 30, l: 20 }] } as never) as Plan;
  exige(p.limitePar === "tuyau", `c'est « ${p.limitePar} » qui plafonne, pas le Ø25`);
  exige(Math.abs(p.limiteDuTuyau - 1.76) < 0.02, `le Ø25 passe ${p.limiteDuTuyau.toFixed(2)} m³/h au lieu de 1,76`);
  for (const s of p.secteurs) exige(s.debit <= p.limiteDuTuyau + 1e-9, `un réseau à ${s.debit} m³/h dépasse le Ø25`);
});

regle("21 août 2026", "« les débits à 360° sont les mêmes qu'à 180° et 90° » — pour les turbines, et pour elles seules", () => {
  const buses = (CATALOGUE as unknown as { buses: { nom: string; pourType: string; debit: Record<string, number | null> }[] }).buses;
  const turbines = buses.filter((b) => b.pourType === "turbine" && b.debit[360] != null);
  exige(turbines.length > 0, "aucune buse de turbine au catalogue");
  for (const b of turbines) exige(b.debit[90] === b.debit[360] && b.debit[180] === b.debit[360], `${b.nom} : le débit change avec l'arc`);
  const van = buses.find((b) => b.nom === "12-VAN");
  exige(van !== undefined && van.debit[90] !== van.debit[360], "la 12-VAN débite pareil à 90° et à 360° : c'est faux, ses relevés disent 0,15 et 0,59");
});

regle("21 août 2026", "« 9 V, tous mes programmateurs sont à pile » — aucune électrovanne 24 V dans la liste", () => {
  const p = plan(DEUX_PELOUSES);
  const electro = p.materiel.filter((m) => /lectrovanne/i.test(m.nom));
  exige(electro.length > 0, "aucune électrovanne dans la liste");
  for (const m of electro) exige(/9 ?V/.test(m.nom) && !/24 ?V/.test(m.nom), `« ${m.nom} » n'est pas en 9 V`);
});

regle("20 août 2026", "« la pression ne donne pas le débit » — hors compteur, sans seau ni manomètre, on refuse au lieu d'inventer", () => {
  const r = debitRetenu({ piquage: "ailleurs", secondes: null, barStatique: null, barDynamique: null });
  exige(!r.ok, "un débit a été rendu sans aucune mesure");
  const c = debitRetenu({ piquage: "compteur", secondes: null, barStatique: null, barDynamique: null });
  exige(c.ok && c.debit === 1.8 && c.pression === 3, "au compteur, ce sont SES chiffres : 1,80 m³/h et 3 bar");
});

regle("23 août 2026", "« là, il y a tous les métrés » — l'agencement n'est pas obligatoire : sans dessin, le plan et ses pièces sortent quand même", () => {
  const p = plan(DEUX_PELOUSES);
  const pieces = piecesDuPlan(p.materiel, null, { compteur: true, seuil25: 50, amenee: null });
  exige(pieces.some((x) => x.ou === "jardin" && /Turbine/.test(x.nom)), "sans dessin, plus d'arroseurs dans la liste");
  exige(pieces.some((x) => x.ref === "pe25" && x.q === null), "sans dessin, le tuyau Ø25 doit être « à mesurer », pas chiffré");
});

regle("11 septembre 2026", "« même au même endroit, ne superpose pas les ronds, carrés ou losanges : côte à côte » — deux têtes sur une arête commune se voient toutes les deux", () => {
  const d = dessine(plan([
    { id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 12, l: 12 },
    { id: 2, type: "gazon", nom: "Bande", x: 12, y: 0, L: 8, l: 4 },
  ]), { x: 0, y: 4 });
  const tetes = d.reseaux.flatMap((r) => r.tetes);
  const auMemePoint = tetes.filter((t) => t.x === 12 && t.y === 0);
  exige(auMemePoint.length === 2, `le cas n'est pas construit : ${auMemePoint.length} tête(s) au coin commun`);
  const dessinees = auMemePoint.map((t) => `${(t.x + t.decalage.x).toFixed(2)},${(t.y + t.decalage.y).toFixed(2)}`);
  exige(new Set(dessinees).size === 2, "les deux têtes du même point se dessinent l'une sur l'autre");
  exige(tetes.filter((t) => !(t.x === 12 && t.y === 0)).every((t) => t.decalage.x === 0 && t.decalage.y === 0), "une tête seule a été déplacée");
  const bleu = d.reseaux[0];
  for (const j of bleu.jonctions)
    for (const t of bleu.tetes) exige(Math.hypot(j.x - t.x - t.decalage.x, j.y - t.y - t.decalage.y) > 1, "un losange chevauche la tête qu'il accompagne");
});

regle("11 septembre 2026", "« l'amenée doit être calculée, ni lue ni supposée » — du piquage à la nourrice, à l'échelle des cotes", () => {
  // Une pelouse de 16 m qui occupe 0,40 du croquis : 40 m par unité. Le piquage
  // à 0,10 du bord, la nourrice à 0,30 : 0,20 × 40 = 8 m d'amenée. Rien n'est lu
  // en mètres, rien n'est supposé.
  const zones = [{ position: { x: 0.5, y: 0.5 }, largeurFraction: 0.4, hauteurFraction: 0.15, L: 16, l: 6, ml: null }];
  const a = longueurDeLAmenee({ x: 0.1, y: 0.5 }, { x: 0.3, y: 0.5 }, zones);
  exige(a.ok && Math.abs(a.metres - 8) < 0.01, `8 m attendus, ${a.ok ? a.metres : a.raison}`);
  exige(!longueurDeLAmenee(null, { x: 0.3, y: 0.5 }, zones).ok, "sans piquage sur le croquis, aucune amenée n'est comptée — et surtout pas 30 m");
  exige(!etatDuCroquis({ zonesMesurees: 3, nourrice: true, piquage: false, branchement: "compteur" }).complet, "sans piquage sur le croquis, pas de plan : c'est le troisième élément obligatoire");
  const p = plan(DEUX_PELOUSES);
  const avec = piecesDuPlan(p.materiel, null, { compteur: true, seuil25: 50, amenee: 8 }).find((x) => x.ref === "pe25-amenee");
  const sans = piecesDuPlan(p.materiel, null, { compteur: true, seuil25: 50, amenee: null }).find((x) => x.ref === "pe25-amenee");
  exige(avec?.q === 8, "la ligne d'amenée porte les 8 m calculés");
  exige(sans?.q === null, "sans calcul possible, la ligne d'amenée reste « à mesurer » — jamais un chiffre plausible");
});

// ── LA PROCHAINE RÈGLE S'AJOUTE ICI, sous ce repère — jamais au-dessus ──────

console.log(`\n${failed === 0 ? "✅" : "❌"} Les règles du patron — ${passed} tenue(s), ${failed} rompue(s).`);
if (failed > 0) {
  console.error(
    "\nUn rouge ici ne se réécrit pas. Soit le code a tort — et c'est lui qu'on corrige —, soit la règle a\n" +
      "changé : alors c'est le patron qui l'a dit, et sa phrase datée s'écrit sous le repère, l'ancienne barrée."
  );
  process.exit(1);
}
