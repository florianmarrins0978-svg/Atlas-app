import { CATALOGUE } from "../src/lib/arrosage/catalogue.js";

// Le catalogue d'arrosage, confronté à Aqua Plus 2026 entrée par entrée.
//
// **Chaque ligne ci-dessous a été lue dans le PDF ET validée par le patron**
// (`docs/arrosage-catalogue-aquaplus.md`). Ce n'est pas une copie de plus du
// catalogue : c'est la trace de ce qu'il a tranché. Une valeur qui change
// dans `catalogue.js` sans changer ici fait rougir, et c'est voulu : un débit
// de buse faux met trop de têtes sur une vanne, et le réseau ne se lève pas.
//
// **Un rouge ici ne se réécrit pas.** Il veut dire que le catalogue a dérivé
// de la page où le chiffre a été lu. On rouvre le PDF, pas ce fichier.

type Angle = 90 | 120 | 180 | 270 | 330 | 360;
type Releve = {
  ref: string;
  rayon: number;
  pression: number;
  debit: Partial<Record<Angle, number>>;
  // Un angle que la buse ne sait pas tenir : il ne doit pas exister du tout,
  // sans quoi le calcul la poserait là où elle laisse un trou d'arrosage.
  sansAngle?: Angle[];
  page: string;
  tranche: string;
};

const RELEVES: Releve[] = [
  {
    ref: "RA5004-B6p",
    rayon: 13.7,
    pression: 2.5,
    debit: { 360: 1.36 },
    page: "Aqua Plus 2026, p. 13",
    // Le catalogue portait 0,92, recopié de la buse 3,0 Portée+.
    tranche: "16 octobre 2026, réponse 1",
  },
  // **Les 4, 6 et 8-VAN tournent au plus à 330°** (fiche Rain Bird des VAN,
  // pages 27 et 28). Aqua Plus imprime leur dernier chiffre sous « 360° » :
  // c'est celui du 330°. Elles n'ont donc pas de 360° : le calcul les réserve
  // aux coins et aux bords (sa réponse du 16 octobre 2026, « oui pour les VAN »).
  { ref: "RBT640", rayon: 1.2, pression: 2, debit: { 90: 0.06, 180: 0.1, 270: 0.16, 330: 0.2 }, sansAngle: [360],
    page: "Aqua Plus 2026, p. 8, et Rain Bird, VAN, p. 27", tranche: "16 octobre 2026, « oui pour les VAN »" },
  { ref: "RBT639", rayon: 1.8, pression: 2, debit: { 90: 0.08, 180: 0.13, 270: 0.24, 330: 0.27 }, sansAngle: [360],
    page: "Aqua Plus 2026, p. 8, et Rain Bird, VAN, p. 28", tranche: "16 octobre 2026, « oui pour les VAN »" },
  // 0,16 à 90°, plus que la 10-VAN : Rain Bird donne le même chiffre (trajectoire
  // de 5°, quand la 10-VAN est à 10°). Le doute est levé.
  { ref: "RBT638", rayon: 2.3, pression: 2, debit: { 90: 0.16, 180: 0.26, 270: 0.34, 330: 0.38 }, sansAngle: [360],
    page: "Aqua Plus 2026, p. 8, et Rain Bird, VAN, p. 28", tranche: "16 octobre 2026, « oui pour les VAN »" },
];

// Les pages où une entrée a été lue. Une page fausse envoie le relire ailleurs.
const PAGES: Record<string, string> = {
  RBT1418: "Aqua Plus 2026, p. 8", RBT1419: "Aqua Plus 2026, p. 8",
  RBT1428: "Aqua Plus 2026, p. 8", RBT1429: "Aqua Plus 2026, p. 8",
  RBT1438: "Aqua Plus 2026, p. 8", RBT1439: "Aqua Plus 2026, p. 8",
  RT1802: "Aqua Plus 2026, p. 7", RT1804: "Aqua Plus 2026, p. 7", RT1806: "Aqua Plus 2026, p. 7",
  RT1812: "Aqua Plus 2026, p. 7", RT1824: "Aqua Plus 2026, p. 7", RT1826: "Aqua Plus 2026, p. 7",
  RT1822: "Aqua Plus 2026, p. 7", RT1834: "Aqua Plus 2026, p. 7", RT1836: "Aqua Plus 2026, p. 7",
  RT1832: "Aqua Plus 2026, p. 7",
  OD501: "Aqua Plus 2026, p. 14", OD502: "Aqua Plus 2026, p. 14",
};

// Les buses de turbine qu'Aqua Plus vend SEULES, sous leur propre référence.
// Toutes les autres sont livrées avec l'arroseur (« livré avec grappe de 12
// buses », p. 13) : leur référence a été fabriquée dans le dépôt, et sa
// réponse du 16 octobre est « corrige-les simplement, rien ne doit être
// inventé ».
const BUSES_DE_TURBINE_VENDUES_SEULES = ["RBA2195", "RBA2196", "RBA2197"];

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

console.log("=== Le catalogue d'arrosage confronté à Aqua Plus 2026 ===\n");

type Entree = {
  ref: string;
  nom?: string;
  releve?: string;
};
type Buse = Entree & {
  rayon: number;
  pression: number | null;
  pourType: string;
  debit: Record<number, number>;
  colisage?: number;
  aVerifier?: string;
  livreeAvecLArroseur?: boolean;
};
const buses = CATALOGUE.buses as unknown as Buse[];
// `referenceDe` est posée sur l'objet après sa déclaration : TypeScript ne la voit pas.
const { referenceDe } = CATALOGUE as unknown as { referenceDe: (cle: string) => string | null };

for (const r of RELEVES) {
  const b = buses.find((x) => x.ref === r.ref);
  if (!b) {
    dire(false, `${r.ref} est absente du catalogue (${r.page})`);
    continue;
  }
  dire(b.rayon === r.rayon, `${r.ref} : portée ${b.rayon} m, ${r.page} dit ${r.rayon} m`);
  dire(b.pression === r.pression, `${r.ref} : ${b.pression} bar, ${r.page} dit ${r.pression} bar`);
  for (const [angle, attendu] of Object.entries(r.debit)) {
    const lu = b.debit[Number(angle)];
    dire(lu === attendu, `${r.ref} : ${lu} m³/h à ${angle}°, ${r.page} dit ${attendu}`);
  }
  for (const angle of r.sansAngle ?? []) {
    dire(b.debit[angle] == null, `${r.ref} : aucun débit à ${angle}°, elle ne tourne pas jusque-là`);
  }
  // Une valeur tranchée n'est plus douteuse : laisser sa réserve, c'est
  // garder à l'écran un doute que le patron a levé.
  dire(!b.aVerifier, `${r.ref} : plus aucune réserve, tranché le ${r.tranche}`);
}

const toutes = [
  ...(CATALOGUE.buses as Entree[]),
  ...(CATALOGUE.corps as Entree[]),
  ...(CATALOGUE.coudes as Entree[]),
];
for (const [ref, page] of Object.entries(PAGES)) {
  const e = toutes.find((x) => x.ref === ref);
  dire(e?.releve === page, `${ref} : lue « ${e?.releve} », la page est « ${page} »`);
}

for (const b of buses.filter((x) => x.pourType === "turbine")) {
  if (BUSES_DE_TURBINE_VENDUES_SEULES.includes(b.ref)) {
    dire(referenceDe(b.ref) === b.ref, `${b.ref} : vendue seule, sa référence se montre`);
    continue;
  }
  dire(
    b.livreeAvecLArroseur === true && referenceDe(b.ref) === null && b.colisage == null,
    `${b.nom ?? b.ref} : livrée avec l'arroseur, ni référence ni colisage à elle`,
  );
}

// Son tube de goutte-à-goutte, dit le 16 octobre 2026 : *« et c'est bien 2 l/h »*.
type Gaine = Entree & { marque: string; debitGoutteur: number; ecartGoutteurs: number; debitMetre: number; source: string };
const gaines = CATALOGUE.gaines as unknown as Gaine[];
dire(gaines.length === 1 && gaines[0].ref === "UGGCBL23050", `un seul tube, le sien : ${gaines.map((g) => g.ref).join(", ")}`);
const g = gaines[0];
dire(g.marque === "Toro" && g.debitGoutteur === 2 && g.ecartGoutteurs === 0.33 && g.source === "patron",
  `UGGCBL23050 : Toro, 2 l/h tous les 33 cm (lu : ${g.marque}, ${g.debitGoutteur} l/h, ${g.ecartGoutteurs} m)`);

// ── Les pièces qu'on ajoute à la main (relevé du 16 octobre 2026) ───────────
// Désignation mot pour mot, page imprimée, et JAMAIS un prix : sa consigne du
// 17 août, « ne les enregistre pas, ce sont des prix pour les clients ».
type Piece = { ref: string; nom: string; categorie: string; releve: string; colisage?: string };
const ajoutables = (CATALOGUE as unknown as { piecesAjoutables: Piece[] }).piecesAjoutables;
// 709 relevées, 164 retirées le 18 octobre 2026 à sa demande : « tout ce que je
// n'ai pas validé dans la liste, ce sont les pièces que je ne veux pas garder »
// (liste dans docs/arrosage-releve-photos/autres-pieces/retirees.json). Puis 6 le
// même soir : le té égal Millenium 75 et 110 et l'adaptateur à bride Millenium.
dire(ajoutables.length === 539, `${ajoutables.length} pièces gardées, il en a gardé 539`);
// Un prix se lit « 49,28 » : deux décimales après la virgule, et aucune unité
// derrière (« 0,06 à 9,06 m3/h » est une plage de débit, « ép.0,15mm » une
// épaisseur).
const avecPrix = ajoutables.filter((p) =>
  [p.nom, p.colisage ?? ""].some((s) => /\b\d{1,4},\d\d\b(?!\s*(?:m|mm|bar|l|L|V|°|x|"|à\s*\d))/.test(s)));
dire(avecPrix.length === 0, `aucun prix dans les pièces (${avecPrix.map((p) => p.ref + " " + p.nom).join(" | ") || "aucun"})`);
dire(ajoutables.every((p) => /^Aqua Plus 2026, p\. \d+$/.test(p.releve)), "chaque pièce dit sa page");
for (const [ref, nom] of [
  ["OPL73403225", "té 90° réduit 32 x 25 x 32"],
  ["OPL71503220", "coude taraudé 32 x 3/4\""],
  ["OPL704032", "té 90° 32 x 32 x 32"],
  ["MID6321", "té Palaplast Ø16"],
  ["UPE232", "tube P.E.H.D. irrigation Ø 32mm 10 bars (26,2 x 32)"],
]) {
  const p = ajoutables.find((x) => x.ref === ref);
  dire(p?.nom === nom, `${ref} : « ${p?.nom} », le PDF dit « ${nom} »`);
}

if (echecs > 0) {
  console.log(`\n✗ ${echecs} écart(s) avec Aqua Plus 2026`);
  process.exit(1);
}
console.log("\n✓ Le catalogue suit Aqua Plus 2026 sur tout ce qui a été tranché");
