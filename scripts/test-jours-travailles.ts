// Les jours travaillés et les zones : sans base de données.
//
// Novembre 2026 sert de mois d'épreuve parce qu'il porte les deux pièges : un
// férié un dimanche (la Toussaint, qui ne doit rien retirer) et un férié un
// mercredi (l'Armistice, qui retire un jour). Vingt et un jours du lundi au
// vendredi, vingt jours ouvrés.

import assert from "node:assert/strict";
import {
  bornesDuMois,
  compteDuMois,
  enJours,
  joursOuvresDuMois,
  joursSaisisLus,
  moisValide,
  moisVoisin,
  motifCorrectionLu,
  phraseDeLAbsence,
  phraseDeLaCorrection,
  phraseDuFerieTravaille,
  resumeDuMois,
} from "../src/lib/jours-travailles";
import {
  caseDeLaDistance,
  compteParZone,
  correctionsDeZonesLues,
  joursDuSalarie,
  partsAuPlanning,
  couleurDeLaCase,
  MODELES,
  manqueAuxZones,
  phraseDuJourSansZone,
  phraseDuManque,
  placerLeJour,
  villeDeLAdresse,
  reglageLu,
  zonesLues,
} from "../src/lib/zones-deplacement";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

const absence = (premierJour: string, dernierJour: string, extra: Record<string, unknown> = {}) => ({
  equipeId: "x",
  premierJour,
  dernierJour,
  ...extra,
});

console.log("=== Les jours travaillés ===");

essai("novembre 2026 : vingt jours ouvrés, l'Armistice retiré, la Toussaint (un dimanche) non", () => {
  const { ouvres, feries } = joursOuvresDuMois("2026-11");
  assert.equal(ouvres.length, 20);
  assert.deepEqual(feries.map((f) => f.jour), ["2026-11-11"]);
});

essai("sans absence, le compte est le nombre de jours ouvrés", () => {
  assert.equal(compteDuMois("2026-11", []).calcul, 20);
});

essai("un congé du lundi 23 au mardi 24 retire deux jours : 18", () => {
  const c = compteDuMois("2026-11", [absence("2026-11-23", "2026-11-24", { nature: "conge" })]);
  assert.equal(c.calcul, 18);
  assert.equal(c.absences.length, 1);
  assert.equal(c.absences[0].jours, 2);
  assert.equal(c.sansNature, 0);
});

essai("un matin d'absence retire une demie : 19,5", () => {
  const c = compteDuMois("2026-11", [absence("2026-11-12", "2026-11-12", { dernierDemi: "matin" })]);
  assert.equal(c.calcul, 19.5);
  assert.match(c.absences[0].dit, /au matin$/);
  // Sans motif : le compte le dit, pour que l'écran demande pourquoi.
  assert.equal(c.sansNature, 0.5);
});

essai("une absence « week-ends compris » ne retire que ses jours ouvrés", () => {
  // Du vendredi 6 au lundi 9 : deux jours ouvrés, pas quatre.
  assert.equal(compteDuMois("2026-11", [absence("2026-11-06", "2026-11-09")]).calcul, 18);
});

essai("un déplacement et une formation ne retirent rien", () => {
  const c = compteDuMois("2026-11", [
    absence("2026-11-02", "2026-11-06", { nature: "deplacement" }),
    absence("2026-11-09", "2026-11-09", { nature: "formation" }),
  ]);
  assert.equal(c.calcul, 20);
  assert.ok(c.absences.every((a) => a.travaillee));
});

essai("deux absences qui se chevauchent ne retirent pas deux fois le même jour", () => {
  const c = compteDuMois("2026-11", [absence("2026-11-02", "2026-11-03"), absence("2026-11-03", "2026-11-04")]);
  assert.equal(c.calcul, 17);
});

essai("une absence à cheval sur deux mois ne compte que ses jours du mois", () => {
  assert.equal(compteDuMois("2026-11", [absence("2026-10-26", "2026-11-03")]).calcul, 18);
});

essai("les jours de travail pour les zones : une demi-journée de travail en est un", () => {
  const c = compteDuMois("2026-11", [absence("2026-11-12", "2026-11-12", { dernierDemi: "matin" }), absence("2026-11-23", "2026-11-23")]);
  assert.ok(c.joursDeTravail.includes("2026-11-12"));
  assert.ok(!c.joursDeTravail.includes("2026-11-23"));
  assert.equal(c.joursDeTravail.length, 19);
});

essai("un chiffre saisi se relit par demi-journée, et rien d'autre", () => {
  assert.equal(joursSaisisLus("15"), 15);
  assert.equal(joursSaisisLus("19,5"), 19.5);
  assert.equal(joursSaisisLus(19.5), 19.5);
  assert.equal(joursSaisisLus("19,3"), null);
  assert.equal(joursSaisisLus("32"), null);
  assert.equal(joursSaisisLus("-1"), null);
  assert.equal(joursSaisisLus(""), null);
});

essai("le motif d'une correction suit le sens de l'écart", () => {
  assert.equal(motifCorrectionLu("maladie", -3), "maladie");
  assert.equal(motifCorrectionLu("samedi", -3), null);
  assert.equal(motifCorrectionLu("samedi", 1), "samedi");
  assert.equal(motifCorrectionLu("maladie", 0), null);
});

essai("les mois se suivent, et se valident", () => {
  assert.equal(moisVoisin("2026-12", 1), "2027-01");
  assert.equal(moisVoisin("2026-01", -1), "2025-12");
  assert.equal(bornesDuMois("2028-02").fin, "2028-02-29");
  assert.equal(moisValide("2026-11"), true);
  assert.equal(moisValide("2026-13"), false);
  assert.equal(moisValide("../x"), false);
  assert.equal(enJours(1.5), "1,5 jour");
  assert.equal(enJours(2), "2 jours");
});

essai("ce qui se lit : l'absence avec sa nature, la correction avec son motif, ou sans", () => {
  const c = compteDuMois("2026-11", [absence("2026-11-23", "2026-11-24", { nature: "conge" }), absence("2026-11-02", "2026-11-02", { nature: "deplacement" })]);
  assert.deepEqual(c.absences.map(phraseDeLAbsence), ["Déplacement le 2 novembre, compté travaillé", "Congé du 23 au 24 novembre"]);
  assert.equal(phraseDeLaCorrection(c, 15, "maladie")?.texte, "Maladie, 3 jours");
  assert.equal(phraseDeLaCorrection(c, 19, "samedi")?.texte, "Samedi travaillé, 1 jour de plus");
  assert.deepEqual(phraseDeLaCorrection(c, 15, null), { texte: "3 jours de moins que le calcul, sans motif", sansMotif: true });
  assert.equal(phraseDeLaCorrection(c, null, null), null);
  assert.equal(resumeDuMois("2026-11", 20, [{ jour: "2026-11-11" }], true), "Mois en cours, 20 jours ouvrés, le 11 est férié.");
  assert.equal(resumeDuMois("2026-10", 22, [], false), "22 jours ouvrés.");
});

console.log("=== Les zones de déplacement ===");

const NANTES = { latitude: 47.2184, longitude: -1.5536 };
const CLISSON = { latitude: 47.0869, longitude: -1.2817 };
const SAINT_NAZAIRE = { latitude: 47.2735, longitude: -2.2138 };
const zones = MODELES.paysage.zones;

essai("une borne appartient à sa zone, au-delà de la dernière c'est hors zone", () => {
  assert.equal(caseDeLaDistance(5, zones), 0);
  assert.equal(caseDeLaDistance(5.1, zones), 1);
  assert.equal(caseDeLaDistance(50, zones), 3);
  assert.equal(caseDeLaDistance(51, zones), "hors");
});

essai("un jour au dépôt compte en zone 1", () => {
  assert.equal(placerLeJour({ jour: "2026-11-02", chantiers: [] }, NANTES, zones).case, 0);
});

essai("un jour sur deux chantiers compte le plus loin", () => {
  const p = placerLeJour(
    {
      jour: "2026-11-03",
      chantiers: [
        { nom: "Près", adresse: "Nantes", position: NANTES },
        { nom: "Loin", adresse: "Clisson", position: CLISSON },
      ],
    },
    NANTES,
    zones
  );
  assert.equal(p.chantier?.nom, "Loin");
  assert.equal(p.case, 2);
});

essai("un chantier non situé : aucune zone, et la raison dite", () => {
  const p = placerLeJour({ jour: "2026-11-04", chantiers: [{ nom: "Lieu-dit", adresse: "Les Landes", position: null }] }, NANTES, zones);
  assert.equal(p.case, null);
  assert.equal(p.raison, "adresse non située");
});

essai("un déplacement est hors zone, une formation n'a pas de zone", () => {
  assert.equal(placerLeJour({ jour: "2026-11-05", chantiers: [], enDeplacement: true }, NANTES, zones).case, "hors");
  assert.equal(placerLeJour({ jour: "2026-11-05", chantiers: [], enFormation: true }, NANTES, zones).case, null);
});

essai("le compte par zone, et ce qui manque se dit avec ses mots", () => {
  const c = compteParZone(
    [
      { jour: "2026-11-02", chantiers: [] },
      { jour: "2026-11-03", chantiers: [{ nom: "Loin", adresse: "Saint-Nazaire", position: SAINT_NAZAIRE }] },
      { jour: "2026-11-04", chantiers: [{ nom: "Lieu-dit", adresse: null, position: null }] },
    ],
    NANTES,
    zones
  );
  assert.deepEqual(c.parZone, [1, 0, 0, 0]);
  assert.equal(c.hors, 1);
  assert.equal(c.sansZone.length, 1);
  assert.equal(manqueAuxZones(3, [...c.parZone, c.hors]), 1);
  assert.equal(phraseDuManque(1), "Il manque une zone, ajoutez-la.");
  assert.equal(phraseDuManque(-1), "Une zone de trop, retirez-la.");
  assert.equal(phraseDuManque(0), null);
  // Une demi-journée de travail occupe un jour dans sa zone.
  assert.equal(manqueAuxZones(19.5, [19]), 1);
});

essai("des zones abîmées ne se lisent pas, un réglage abîmé se replie sur Pas de zones", () => {
  assert.equal(zonesLues([{ nom: "Zone 1", km: 5 }, { nom: "Zone 2", km: 4 }]), null);
  assert.equal(zonesLues([{ nom: "", km: 5 }]), null);
  assert.deepEqual(zonesLues([{ nom: "Zone 3C", km: 5 }]), [{ nom: "Zone 3C", km: 5 }]);
  assert.equal(reglageLu(null), null);
  assert.equal(reglageLu({ convention: "nimporte" })?.convention, "aucune");
  assert.deepEqual(reglageLu({ convention: "batiment" })?.zones.length, 6);
});

essai("les corrections de zones ne gardent que des cases connues", () => {
  assert.deepEqual(correctionsDeZonesLues({ z0: 3, z9: 1, hors: 2, z1: -1 }, zones), { z0: 3, hors: 2 });
});

essai("le dégradé va du clair au foncé, et sa couleur papier est un vrai hex", () => {
  const proche = couleurDeLaCase(0, 5, "violet");
  const loin = couleurDeLaCase(4, 5, "violet");
  assert.equal(proche.encreClaire, false);
  assert.equal(loin.encreClaire, true);
  assert.match(loin.papier, /^#[0-9a-f]{6}$/);
});

essai("le planning place un salarié là où il est coché, et nulle part pendant son absence", () => {
  const chantiers = [
    { id: "c1", nom: "Clisson", adresse: "Clisson", position: CLISSON, creneaux: [{ jour: "2026-11-02", moment: "matin" as const }, { jour: "2026-11-02", moment: "apres_midi" as const }, { jour: "2026-11-03", moment: "matin" as const }] },
    { id: "c2", nom: "Nantes", adresse: "Nantes", position: NANTES, creneaux: [{ jour: "2026-11-03", moment: "apres_midi" as const }] },
  ];
  const coches = [
    { chantierId: "c1", jour: null, demi: "matin", rang: 1 },
    { chantierId: "c1", jour: null, demi: "apres_midi", rang: 1 },
    { chantierId: "c2", jour: "2026-11-03", demi: "apres_midi", rang: 1 },
    // Un autre salarié, coché sur le même chantier : il ne compte pas pour le 1.
    { chantierId: "c2", jour: null, demi: "apres_midi", rang: 2 },
  ];
  const absences = [
    // Absent le matin du 3 : Clisson ce matin-là ne compte pas.
    { equipeId: "x", rang: 1, premierJour: "2026-11-03", dernierJour: "2026-11-03", dernierDemi: "matin", nature: "maladie" as const },
    { equipeId: "x", rang: 1, premierJour: "2026-11-04", dernierJour: "2026-11-04", nature: "deplacement" as const },
    { equipeId: "x", rang: 1, premierJour: "2026-11-05", dernierJour: "2026-11-05", nature: "formation" as const },
  ];
  const j = joursDuSalarie(1, ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"], chantiers, coches, absences);
  assert.deepEqual(j[0].chantiers.map((c) => c.nom), ["Clisson"]);
  assert.deepEqual(j[1].chantiers.map((c) => c.nom), ["Nantes"]);
  assert.equal(j[2].enDeplacement, true);
  assert.equal(j[3].enFormation, true);
  assert.deepEqual(j[4].chantiers, []);
});

essai("la ville d'une adresse, et la phrase d'un jour sans zone", () => {
  assert.deepEqual(villeDeLAdresse("14 rue Crébillon, 44000 Nantes"), { ville: "44000 Nantes", rue: "14 rue Crébillon" });
  assert.deepEqual(villeDeLAdresse("14 rue Crébillon 44000 Nantes, France"), { ville: "44000 Nantes", rue: "14 rue Crébillon" });
  assert.deepEqual(villeDeLAdresse("Les Landes"), { ville: "Les Landes", rue: null });
  const p = placerLeJour({ jour: "2026-11-04", chantiers: [{ nom: "Mme Roux", adresse: "Les Landes", position: null }] }, NANTES, zones);
  assert.equal(phraseDuJourSansZone(p), "Mercredi 4 novembre, Les Landes, adresse non située");
});

essai("UN FÉRIÉ AU PLANNING SE COMPTE TRAVAILLÉ : sa règle du 6 novembre 2026", () => {
  // Le 11 novembre sur un chantier : vingt et un jours, et le comptable le lit.
  const c = compteDuMois("2026-11", [], false, new Map([["2026-11-11", 1], ["2026-11-12", 1]]));
  assert.equal(c.calcul, 21, "seul le férié s'ajoute : un jour ouvré au planning compte déjà");
  assert.deepEqual(c.feriesTravailles.map((f) => f.jour), ["2026-11-11"]);
  assert.ok(c.joursDeTravail.includes("2026-11-11"), "le férié travaillé doit avoir sa zone");
  assert.equal(phraseDuFerieTravaille(c.feriesTravailles[0]), "Férié travaillé le 11 novembre");
  // Une demi-journée de chantier le jour férié : une demie.
  assert.equal(compteDuMois("2026-11", [], false, new Map([["2026-11-11", 0.5]])).calcul, 20.5);
  assert.equal(phraseDuFerieTravaille({ jour: "2026-11-11", part: 0.5 }), "Férié travaillé le 11 novembre, une demi-journée");
});

essai("le planning donne la part d'un jour : une demie par demi-journée de chantier, rien pendant une absence", () => {
  const chantiers = [{ id: "c", nom: "X", adresse: "Nantes", position: NANTES, creneaux: [{ jour: "2026-11-11", moment: "matin" as const }, { jour: "2026-11-11", moment: "apres_midi" as const }] }];
  const coches = [{ chantierId: "c", jour: null, demi: "matin", rang: 1 }, { chantierId: "c", jour: null, demi: "apres_midi", rang: 1 }];
  assert.equal(partsAuPlanning(1, ["2026-11-11"], chantiers, coches, []).get("2026-11-11"), 1);
  assert.equal(partsAuPlanning(2, ["2026-11-11"], chantiers, coches, []).size, 0, "un salarié non coché travaille");
  const absent = [{ equipeId: "x", premierJour: "2026-11-11", dernierJour: "2026-11-11", premierDemi: "apres_midi", nature: "conge" as const }];
  assert.equal(partsAuPlanning(1, ["2026-11-11"], chantiers, coches, absent).get("2026-11-11"), 0.5);
});

if (echecs) {
  console.log(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ Les jours travaillés et les zones comptent juste.");
