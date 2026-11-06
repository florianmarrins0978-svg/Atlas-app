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
} from "../src/lib/jours-travailles";
import {
  caseDeLaDistance,
  compteParZone,
  correctionsDeZonesLues,
  couleurDeLaCase,
  MODELES,
  manqueAuxZones,
  phraseDuManque,
  placerLeJour,
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

if (echecs) {
  console.log(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ Les jours travaillés et les zones comptent juste.");
