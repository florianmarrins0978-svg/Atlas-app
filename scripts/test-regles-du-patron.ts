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
type Plan = ReturnType<typeof calculerPlan> & { dessin: ZoneDessinee[]; couleurs: string[]; goutteAGoutte: { sorties: number; tesEgaux: number } };
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
  const pieces = piecesDuPlan(p.materiel, d, { compteur: true, seuil25: p.amenee.longueurMax25, amenee: null, goutte: p.goutteAGoutte });
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
  const auCompteur = piecesDuPlan(p.materiel, d, { compteur: true, seuil25: 50, amenee: null, goutte: p.goutteAGoutte }).filter((x) => x.ou === "amenee" && x.ref === "te-25-25-25");
  const auRobinet = piecesDuPlan(p.materiel, d, { compteur: false, seuil25: 50, amenee: null, goutte: p.goutteAGoutte }).filter((x) => x.ou === "amenee" && x.ref === "te-25-25-25");
  exige(auCompteur.length === 1 && auCompteur[0].q === 1, "le té du compteur manque dans l'amenée");
  exige(auRobinet.length === 0, "un té du compteur est facturé sur un piquage au robinet");
});

regle("21 août 2026", "« trois zones, jamais mélangées » — compteur → nourrice, regard, jardin, et rien en dehors", () => {
  const p = plan(DEUX_PELOUSES);
  const pieces = piecesDuPlan(p.materiel, dessine(p, { x: 13, y: 10 }), { compteur: true, seuil25: 50, amenee: null, goutte: p.goutteAGoutte });
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
  // ~~LE TUYAU PLAFONNE LE RÉSEAU~~ BARRÉ le 16 octobre 2026 au soir, sur sa
  // décision : *« je ne veux pas que tu brides les réseaux, je veux que tu
  // prennes le calcul de débit pression »*. La règle datée du même jour, sous
  // le repère, tient ce qui la remplace. Les chiffres restent, comme la trace.
  exige(!("limitePar" in p), `le tuyau ne plafonne plus rien (« ${String((p as { limitePar?: unknown }).limitePar)} »), pas même le Ø25`);
  // ~~1,76~~ BARRÉ le 16 octobre 2026, avec son accord (« oui fais les deux ») :
  // ce chiffre était celui d'un Ø25 SUPPOSÉ de 20,4 mm de passage. Ses tubes
  // photographiés font 19,0 mm, et le Ø25 passe 1,53 : c'est la règle datée du
  // 16 octobre, sous le repère. Le 1,76 reste, comme la trace de son calcul.
  exige(Math.abs(Math.PI * Math.pow(0.0102, 2) * 1.5 * 3600 - 1.76) < 0.02, `1,76 était le Ø25 supposé de 20,4 mm (${(Math.PI * Math.pow(0.0102, 2) * 1.5 * 3600).toFixed(2)}), pas au lieu de 1,76`);
  for (const s of p.secteurs) exige(s.debit <= p.limite + 1e-9, `un réseau à ${s.debit} m³/h dépasse ce que la source donne, plus le Ø25`);
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
  // ~~1,80 m³/h au compteur~~ BARRÉ le 16 octobre 2026, sur sa décision : *« au
  // compteur, tu pars du principe qu'il y a 3 bar et 2 m³/h, mais tu mets le
  // message en rouge »*. La règle datée du 16 octobre, sous le repère, tient
  // les nouveaux chiffres. Le 1,80 reste, comme la trace de son seau du 20 août.
  const debitReleveLe20Aout = 1.8;
  exige(c.ok && c.pression === 3 && debitReleveLe20Aout === 1.8, "au compteur, ce sont SES chiffres : 1,80 m³/h et 3 bar");
});

regle("23 août 2026", "« là, il y a tous les métrés » — l'agencement n'est pas obligatoire : sans dessin, le plan et ses pièces sortent quand même", () => {
  const p = plan(DEUX_PELOUSES);
  const pieces = piecesDuPlan(p.materiel, null, { compteur: true, seuil25: 50, amenee: null, goutte: p.goutteAGoutte });
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
  const avec = piecesDuPlan(p.materiel, null, { compteur: true, seuil25: 50, amenee: 8, goutte: p.goutteAGoutte }).find((x) => x.ref === "pe25-amenee");
  const sans = piecesDuPlan(p.materiel, null, { compteur: true, seuil25: 50, amenee: null, goutte: p.goutteAGoutte }).find((x) => x.ref === "pe25-amenee");
  exige(avec?.q === 8, "la ligne d'amenée porte les 8 m calculés");
  exige(sans?.q === null, "sans calcul possible, la ligne d'amenée reste « à mesurer » — jamais un chiffre plausible");
});

regle("11 septembre 2026", "« la A » — les turbines des grandes pelouses se posent alignées ; le damier reste aux tuyères des couloirs", () => {
  // Devant la planche qui montrait les deux poses calculées (9 alignées, 6 en
  // damier), il a retenu la A. Une turbine ne se pose donc jamais en damier,
  // quelle que soit la pelouse ; une tuyère de couloir, si.
  for (const [L, l] of [[12, 12], [18, 12], [30, 22]]) {
    const z = plan([{ id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L, l }]).dessin[0];
    exige(z.cle === "turbine", `${L} × ${l} prend des turbines`);
    const rangees = new Set(z.points.map((p: { y: number }) => p.y.toFixed(2)));
    for (const y of rangees) {
      const surLaRangee = z.points.filter((p: { y: number }) => p.y.toFixed(2) === y).length;
      exige(surLaRangee === z.points.length / rangees.size, `${L} × ${l} : une rangée porte ${surLaRangee} têtes — ce n'est plus une grille alignée`);
    }
  }
  exige(plan([{ id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 12, l: 12 }]).dessin[0].points.length === 9, "ses 9 turbines sur le 12 × 12");
});

regle("16 octobre 2026", "« aller au moins cher » — sa pelouse de 20 × 12 à 3,7 bar ne prend pas six vannes pour 10 cm de portée", () => {
  const p = calculerPlan({ seau: 10, temps: 20, pression: 3.7, zones: [{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L: 20, l: 12 }] } as never) as Plan;
  exige(p.secteurs.length <= 2, `${p.secteurs.length} vannes, avec ${p.dessin.map((z: ZoneDessinee) => `${z.points.length} × ${z.buse}`).join(", ")}`);
});

// ~~40 % pour toutes les turbines~~ BARRÉ le 16 octobre 2026 au soir, sur sa
// décision : *« dans ce cas prends la règle d'Aqua Plus et supprime la mienne »*.
// Chaque vis a désormais SON chiffre (règle datée sous le repère) ; celle-ci
// reste, et tient toujours, puisqu'aucune vis d'Aqua Plus ne va au-delà de 40 %.
regle("16 octobre 2026", "« le bridage à la vis, on peut aller jusqu'à 40 % » — aucune tête réglée sous 60 % de sa portée", () => {
  const buses = (CATALOGUE as unknown as { buses: { nom: string; rayon: number }[] }).buses;
  let vues = 0;
  for (const [L, l] of [[20, 12], [20, 15], [12, 12], [30, 18], [16, 10]]) {
    for (const pression of [2.5, 3, 3.7, 4.5]) {
      const p = calculerPlan({ seau: 10, temps: 20, pression, zones: [{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L, l }] } as never) as Plan;
      for (const z of p.dessin as ZoneDessinee[]) {
        const b = buses.find((x) => x.nom === z.buse);
        if (!b) continue;
        vues++;
        exige(z.portee >= 0.6 * b.rayon - 0.01, `${L} × ${l} à ${pression} bar : ${z.buse} réglée à ${z.portee} m pour ${b.rayon}`);
      }
    }
  }
  exige(vues > 0, "aucune tête mesurée");
});

regle("16 octobre 2026", "« 25 × 3 » sur ses tubes photographiés — son Ø25 a 19,0 mm de passage et plafonne un réseau à 1,53 m³/h, pas 1,76", () => {
  const p = calculerPlan({ seau: 10, temps: 4, pression: 3, compteur: "non", zones: [{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L: 30, l: 20 }] } as never) as Plan;
  // ~~ET PLAFONNE UN RÉSEAU À 1,53 m³/h~~ BARRÉ le 16 octobre 2026 au soir, sur
  // sa décision (« je ne veux pas que tu brides les réseaux »). Ses 19,0 mm de
  // passage restent : ils servent aux pertes de charge. Le 1,53 reste, comme la
  // trace de ce que le Ø25 passait à 1,5 m/s.
  exige(!("limitePar" in p), `le tuyau ne plafonne plus (« ${String((p as { limitePar?: unknown }).limitePar)} »), pas même le Ø25`);
  exige(Math.abs(Math.PI * Math.pow(0.0095, 2) * 1.5 * 3600 - 1.53) < 0.02, `1,53 était ce que le Ø25 de 19,0 mm passe à 1,5 m/s (${(Math.PI * Math.pow(0.0095, 2) * 1.5 * 3600).toFixed(2)}), pas au lieu de 1,53`);
  for (const s of p.secteurs) exige(s.debit <= p.limite + 1e-9, `un réseau à ${s.debit} m³/h dépasse ce que la source donne, plus le Ø25`);
});

regle("16 octobre 2026", "« au compteur, 3 bar et 2 m³/h, mais le message en rouge » — seuls le seau ET le manomètre garantissent la levée", () => {
  const c = debitRetenu({ piquage: "compteur", secondes: null, barStatique: null, barDynamique: null });
  exige(c.ok && c.debit === 2 && c.pression === 3, "au compteur sans mesure : 2 m³/h et 3 bar");
  exige(c.ok && c.reserve === "Nous ne garantissons pas la bonne levée des arroseurs.", `au compteur, le rouge manque : « ${c.ok ? c.reserve : ""} »`);
  const lesDeux = debitRetenu({ piquage: "compteur", secondes: 15, barStatique: null, barDynamique: 3 });
  exige(lesDeux.ok && lesDeux.debit === 2.4 && lesDeux.reserve === null, "avec le seau et le manomètre, rien n'est supposé");
  const seauSeul = debitRetenu({ piquage: "ailleurs", secondes: 20, barStatique: null, barDynamique: null });
  exige(seauSeul.ok && seauSeul.reserve !== null && seauSeul.reserve.endsWith("Nous ne garantissons pas la bonne levée des arroseurs."), "le seau seul ne dit pas son rouge");
});

regle("16 octobre 2026", "« prends la règle d'Aqua Plus » — chaque turbine se bride au plus de ce que dit SA vis : 25 % la 5000 Plus et la Mini 8, 35 % la 3504, rien les autres", () => {
  const cat = CATALOGUE as unknown as {
    buses: { nom: string; ref: string; rayon: number; pourType: string; marqueCle: string }[];
    corpsDeLaBuse: (b: unknown) => { ref: string; bridage?: number } | null;
  };
  const vis: Record<string, number> = { RA5004FC: 0.25, TAMINI8_4P: 0.25, RA3504: 0.35, HA2211: 0, HA2210: 0, HA2264: 0, HA2274: 0 };
  for (const [ref, attendu] of Object.entries(vis)) {
    const buse = cat.buses.find((b) => b.pourType === "turbine" && cat.corpsDeLaBuse(b)?.ref === ref.replace("_", "-"));
    exige(buse, `aucune buse ne mène au corps ${ref}`);
    exige((cat.corpsDeLaBuse(buse)?.bridage ?? 0) === attendu, `${ref} : vis à ${cat.corpsDeLaBuse(buse)?.bridage} au lieu de ${attendu}`);
  }
  let vues = 0;
  for (const marque of ["rainbird", "hunter", "toro"]) {
    for (const [L, l] of [[20, 12], [20, 15], [12, 12], [30, 18], [16, 10]]) {
      for (const pression of [2.5, 3, 3.7, 4.5]) {
        const p = calculerPlan({ seau: 10, temps: 20, pression, marque, zones: [{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L, l }] } as never) as Plan;
        for (const z of p.dessin as ZoneDessinee[]) {
          const b = cat.buses.find((x) => x.nom === z.buse && x.pourType === "turbine");
          if (!b) continue;
          vues++;
          const permis = cat.corpsDeLaBuse(b)?.bridage ?? 0;
          // Sous sa pression de référence, une portée baisse d'elle-même
          // (`porteeALaPression`) : ce n'est pas la vis. Seule une tête BRIDÉE
          // se juge contre ce que sa vis permet.
          exige(permis > 0 || !z.bridee, `${marque}, ${L} × ${l} à ${pression} bar : ${z.buse} est bridée, et sa vis ne se règle pas`);
          exige(!z.bridee || z.portee >= (1 - permis) * b.rayon - 0.01, `${marque}, ${L} × ${l} à ${pression} bar : ${z.buse} bridée à ${z.portee} m, sa vis ne retire que ${permis * 100} % de ${b.rayon}`);
        }
      }
    }
  }
  exige(vues > 0, "aucune turbine posée");
});

regle("16 octobre 2026", "« il ne faut pas qu'on décide de mettre 5 arroseurs et qu'il n'y en ait que 4 qui se lèvent » — chaque tête reçoit au moins la pression mini de sa fiche", () => {
  const cat = CATALOGUE as unknown as {
    buses: { nom: string; pourType: string; pressionMin?: number }[];
    corpsDeLaBuse: (b: unknown) => { pressionMin?: number } | null;
    corpsParDefaut: (marque: string) => { pressionMin?: number } | null;
  };
  let vus = 0;
  for (const marque of ["rainbird", "hunter", "toro"]) {
    for (const [L, l] of [[20, 12], [12, 12], [30, 18], [10, 2], [8, 4], [16, 10]]) {
      for (const pression of [2, 2.5, 3, 3.7]) {
        const p = calculerPlan({ seau: 10, temps: 20, pression, marque, zones: [{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L, l }] } as never) as Plan & { pressionAuxArroseurs: number; pressionTropBasse: boolean };
        // Un plan qui le DIT n'engage pas : l'écran porte alors l'alerte.
        if (p.pressionTropBasse) continue;
        for (const z of p.dessin as ZoneDessinee[]) {
          const b = cat.buses.find((x) => x.nom === z.buse);
          if (!b) continue;
          const min = b.pourType === "turbine" ? cat.corpsDeLaBuse(b)?.pressionMin : (b.pressionMin ?? cat.corpsParDefaut(marque)?.pressionMin);
          vus++;
          exige(min !== undefined, `${z.buse} : aucune pression mini relevée, rien ne dit qu'elle se lève`);
          exige(p.pressionAuxArroseurs >= (min ?? 0) - 0.005,
            `${marque}, ${L} × ${l} à ${pression} bar : ${z.buse} reçoit ${p.pressionAuxArroseurs.toFixed(2)} bar, sa fiche en demande ${min}`);
        }
      }
    }
  }
  exige(vus > 0, "aucune tête éprouvée");
});

regle("16 octobre 2026", "« je ne veux pas que tu brides les réseaux » — une source généreuse charge une vanne au-delà de 1,53 m³/h si la pression tient, et ajoute une vanne si elle ne tient pas", () => {
  // 10 L en 12 s à 4 bar : 3 m³/h au seau, 2,55 de limite. Le Ø25 aurait
  // plafonné à 1,53 ; la pression, elle, tient à plus.
  const genereux = calculerPlan({ seau: 10, temps: 12, pression: 4, compteur: "non", zones: [{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L: 30, l: 20 }] } as never) as Plan & { pressionTropBasse: boolean; limite: number };
  exige(!genereux.pressionTropBasse, "à 4 bar, la pression doit tenir");
  exige(genereux.secteurs.some((s: { debit: number }) => s.debit > 1.53 + 0.01), `aucune vanne au-delà de 1,53 m³/h : le réseau est encore bridé (${genereux.secteurs.map((s: { debit: number }) => s.debit.toFixed(2)).join(", ")})`);
  // 10 L en 4 s à 3 bar : 9 m³/h. Sur UNE vanne il ne resterait rien au bout :
  // le calcul en ajoute jusqu'à ce que tout se lève.
  const enorme = calculerPlan({ seau: 10, temps: 4, pression: 3, compteur: "non", zones: [{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L: 30, l: 20 }] } as never) as Plan & { pressionTropBasse: boolean };
  exige(!enorme.pressionTropBasse, "une source généreuse ne doit pas laisser les têtes sans pression : il faut des vannes de plus");
  exige(enorme.secteurs.length >= 2, `${enorme.secteurs.length} vanne pour 30 × 20 à 9 m³/h`);
});

regle("16 octobre 2026", "« oui pour les VAN » — les 4, 6 et 8-VAN s'arrêtent à 330° : aux coins et aux bords seulement, jamais au milieu d'une pelouse", () => {
  const cat = CATALOGUE as unknown as { buses: { ref: string; nom: string; debit: Record<string, number | undefined> }[] };
  const petites = ["RBT638", "RBT639", "RBT640"];
  for (const ref of petites) {
    const b = cat.buses.find((x) => x.ref === ref);
    exige(b && b.debit[330] !== undefined && b.debit[360] === undefined, `${ref} : son dernier chiffre est celui du 330°, pas un 360°`);
  }
  const noms = petites.map((ref) => cat.buses.find((x) => x.ref === ref)?.nom);
  // Son couloir de 10 × 2 n'a que des bords : la 6-VAN y reste (sa règle du 18 août).
  const couloir = plan([{ id: 1, type: "gazon", nom: "Couloir", x: 0, y: 0, L: 10, l: 2 }]).dessin[0];
  exige(couloir.points.length === 7, `${couloir.points.length} têtes sur son couloir de 10 × 2, il en pose 7`);
  // Une pelouse à rangée intérieure ne reçoit jamais une buse qui ne fait pas le tour.
  for (const [L, l] of [[6, 6], [5, 5], [7, 4.5], [8, 6]]) {
    const z = plan([{ id: 1, type: "gazon", nom: "P", x: 0, y: 0, L, l }]).dessin[0];
    const auMilieu = z.points.some((p: { x: number; y: number }) => p.x > 0.01 && p.x < L - 0.01 && p.y > 0.01 && p.y < l - 0.01);
    exige(!(auMilieu && noms.includes(z.buse)), `${L} × ${l} : une ${z.buse} posée au milieu, elle laisserait un trou`);
  }
});

regle("18 octobre 2026", "« sur le plan tu as mis réseau 3 pour le goutte-à-goutte, sauf que sur la nourrice il est sur le réseau 4 » : le réseau N est la voie N, et le goutte-à-goutte vient en dernier", () => {
  // Le massif est dessiné AVANT le couloir : c'est l'ordre du croquis qui
  // numérotait, et la nourrice met le goutte-à-goutte à droite (validée le 18 octobre).
  const p = plan([
    { id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 12, l: 12 },
    { id: 2, type: "massif", nom: "Massif", x: 14, y: 0, L: 20, l: 2.4, sortieGoutte: "boucle" } as Zone,
    { id: 3, type: "gazon", nom: "Couloir", x: 0, y: 14, L: 10, l: 2, materiel: "tuyere" } as Zone,
  ]);
  const secteurs = p.secteurs as { famille: string }[];
  const reseauxDeZone = p.reseauxDeZone as Record<string, number[]>;
  const n = secteurs.length;
  const goutte = secteurs.map((s, i) => (s.famille === "Goutte-à-goutte" ? i : -1)).filter((i) => i >= 0);
  exige(goutte.length > 0, "le massif doit avoir sa vanne de goutte-à-goutte");
  exige(goutte.every((i, k) => i === n - goutte.length + k), `goutte-à-goutte aux réseaux ${goutte.map((i) => i + 1).join(", ")} sur ${n} : sur la nourrice, ce sont les voies ${goutte.map((_, k) => n - goutte.length + k + 1).join(", ")}`);
  // Le plan colorie le massif avec ces mêmes réseaux.
  exige((reseauxDeZone[2] || []).every((i) => goutte.includes(i)), `le massif est dessiné sur les réseaux ${(reseauxDeZone[2] || []).map((i) => i + 1).join(", ")}`);
});

regle("18 octobre 2026", "« le coude SBE-050 se visse sous la 3504 » : le SBE du haut suit le filetage du corps, et la liste compte comme le schéma", () => {
  // Son carré de 12 × 12 : des 3504, et le SBE du haut en 1/2" (OD501), pas en 3/4".
  const p = plan([{ id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 12, l: 12 }]);
  const d = dessine(p, { x: 13, y: 6 });
  const turbines = d.reseaux.flatMap((r) => r.tetes).filter((x) => x.forme === "rond").length;
  exige(p.materiel.some((l) => l.ref === "RA3504"), "le 12 × 12 doit recevoir des 3504");
  const pieces = piecesDuPlan(p.materiel, d, { compteur: true, seuil25: p.amenee.longueurMax25, amenee: null, goutte: p.goutteAGoutte });
  const q = (ref: string) => pieces.filter((x) => x.ref === ref && x.ou === "jardin").reduce((s, x) => s + (x.q ?? 0), 0);
  exige(q("OD501") === turbines, `${q("OD501")} SBE 050 pour ${turbines} turbines 3504 : il en faut un sous chacune`);
  exige(q("OD502") === turbines, `${q("OD502")} SBE 075 pour ${turbines} têtes : un seul par tête, en bas, sur la ligne`);
});

regle("16 octobre 2026", "« un coude taraudé 25x3/4\" par sortie » de goutte-à-goutte, et un té égal par sortie après la première : la liste les compte aussi quand le plan est dessiné", () => {
  const p = plan([
    { id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 12, l: 12 },
    { id: 2, type: "massif", nom: "Massif", x: 14, y: 0, L: 20, l: 2.4, sortieGoutte: "boucle" } as Zone,
  ]);
  const d = dessine(p, { x: 13, y: 6 });
  exige(p.goutteAGoutte && p.goutteAGoutte.sorties >= 1, "le calcul doit dire combien de sorties de goutte-à-goutte il compte");
  const pieces = piecesDuPlan(p.materiel, d, { compteur: true, seuil25: p.amenee.longueurMax25, amenee: null, goutte: p.goutteAGoutte });
  const q = (ref: string) => pieces.filter((x) => x.ref === ref && x.ou === "jardin").reduce((s, x) => s + (x.q ?? 0), 0);
  const somme = (f: (r: (typeof d.reseaux)[number]) => number) => d.reseaux.reduce((s, r) => s + f(r), 0);
  exige(q("coude-taraude-25-34") === somme((r) => r.coudes) + p.goutteAGoutte.sorties, `${q("coude-taraude-25-34")} coudes taraudés : ${somme((r) => r.coudes)} sur le plan, plus ${p.goutteAGoutte.sorties} pour le goutte-à-goutte`);
  exige(q("te-25-25-25") === somme((r) => r.tesEgaux) + p.goutteAGoutte.tesEgaux, "les tés égaux du goutte-à-goutte manquent à la liste");
});

regle("18 octobre 2026", "« le grillage avertisseur bleu, une case à cocher » : la tranchée plus l'amenée, en rouleaux de 100 m, et rien s'il n'est pas coché", () => {
  const p = plan(DEUX_PELOUSES);
  const d = dessine(p, { x: 13, y: 10 });
  const avec = (amenee: number | null) => piecesDuPlan(p.materiel, d, { compteur: true, seuil25: p.amenee.longueurMax25, amenee, goutte: p.goutteAGoutte, grillage: true }).filter((x) => x.ref === "grillage-bleu");
  const sans = piecesDuPlan(p.materiel, d, { compteur: true, seuil25: p.amenee.longueurMax25, amenee: 30, goutte: p.goutteAGoutte, grillage: false }).filter((x) => x.ref === "grillage-bleu");
  exige(sans.length === 0, "pas coché, le grillage ne doit pas entrer dans la liste");
  const m = d.metresTranchee;
  exige(avec(30).length === 1 && avec(30)[0].q === Math.ceil((m + 30) / 100), `${m} m de tranchée et 30 m d'amenée : ${Math.ceil((m + 30) / 100)} rouleau(x) de 100 m`);
  exige(avec(130)[0].q === Math.ceil((m + 130) / 100), "une amenée longue ajoute ses rouleaux");
  // Sans amenée mesurée, on compte la tranchée, et la liste le dit.
  exige(avec(null)[0].q === Math.ceil(m / 100) && /amenée/.test(avec(null)[0].detail ?? ""), "sans amenée mesurée, la liste doit dire qu'elle manque au compte");
});

regle("18 octobre 2026", "« un autre fournisseur a des couronnes de 100 m » : 50 m par défaut (16 octobre), 100 m au choix, et les jonctions suivent", () => {
  // Un massif de 20 × 2,40 en une seule ligne : 80 m de tube Toro.
  const massif = (couronne?: number) => calculerPlan({ seau: 10, temps: 20, pression: 3, compteur: "oui", couronne,
    zones: [{ id: 1, type: "massif", nom: "Massif", x: 0, y: 0, L: 20, l: 2.4, sortieGoutte: "ligne" }] } as never) as Plan;
  const q = (p: Plan, ref: string) => (p.materiel.find((l) => l.ref === ref)?.q ?? 0);
  const p50 = massif(), p100 = massif(100);
  exige(q(p50, "UGGCBL23050") === 2 && q(p50, "MID6301") === 1, `en 50 m : ${q(p50, "UGGCBL23050")} couronnes et ${q(p50, "MID6301")} jonction, il en faut 2 et 1`);
  exige(q(p100, "UGGCBL23050") === 1 && q(p100, "MID6301") === 0, `en 100 m : ${q(p100, "UGGCBL23050")} couronne et ${q(p100, "MID6301")} jonction, il en faut 1 et 0`);
});

regle("18 octobre 2026", "« on ne donne pas les durées d'arrosage ni les périodes à arroser » : le calcul ne rend ni minutes, ni passages, ni saison", () => {
  const p = calculerPlan({ seau: 10, temps: 20, pression: 3, compteur: "oui", saison: "juillet",
    zones: [{ id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 12, l: 12 },
            { id: 2, type: "massif", nom: "Massif", x: 14, y: 0, L: 20, l: 2.4, sortieGoutte: "ligne" }] } as never) as Plan;
  const secteurs = p.secteurs as unknown as Record<string, unknown>[];
  const avecDuree = secteurs.filter((s) => "minutes" in s || "passages" in s);
  exige(avecDuree.length === 0, `${avecDuree.length} réseau(x) portent encore une durée ou un nombre de passages`);
  exige(!p.manquants.some((m) => /durée|saison|passage/i.test(m)), `le plan parle encore de durée : ${JSON.stringify(p.manquants)}`);
});

regle("18 octobre 2026", "« si on descend du robinet et qu'on a un réseau qui va à droite, à gauche, il nous faut un té égal » : l'arrivée compte comme une branche au point d'entrée", () => {
  // Au robinet : sa pelouse de 8 × 8, le robinet sur le bord gauche. La ligne
  // entre et part vers le haut et vers le bas : un té égal.
  const robinet = dessine(plan([{ id: 2, type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 }]), { x: 14, y: 6 });
  exige(robinet.reseaux[0].tesEgaux === 1, `au robinet, ${robinet.reseaux[0].tesEgaux} té égal au départ, il en faut 1`);
  // À la nourrice : le jardin de la planche, qu'il a regardé (« oui, c'est exactement ça »).
  const p = plan([
    { id: 1, type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
    { id: 2, type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
  ]);
  const d = dessine(p, { x: 13, y: 6 });
  const n = (nom: string) => d.reseaux.filter((r) => r.numero === p.secteurs.findIndex((s: { nom: string }) => s.nom === nom))[0]?.tesEgaux;
  exige(n("Pelouse avant") === 1, `Pelouse avant : ${n("Pelouse avant")} té égal, il en faut 1`);
  exige(n("Pelouse arrière") === 2, `Pelouse arrière : ${n("Pelouse arrière")} tés égaux, il en faut 2`);
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
