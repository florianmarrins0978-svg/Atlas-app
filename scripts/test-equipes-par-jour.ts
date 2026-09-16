import assert from "node:assert/strict";
import {
  basculerCeJour,
  equipesDuJour,
  rangerEquipes,
  reporterEquipes,
  type LigneEquipe,
} from "../src/lib/equipes-par-jour";
import { creneauxDuChantier, type Creneau } from "../src/lib/disponibilites";

/**
 * LES ÉQUIPES JOUR PAR JOUR — la règle, sans base ni écran.
 *
 * **Sa plainte du 15 septembre 2026 :** *« si je mets Antoine et Julien le
 * premier jour, ça les met sur les 8 jours, ça c'est bien. Mais si le 4e jour
 * je décide de ne pas mettre Julien, ça l'enlève partout et ça faut pas ! »*
 *
 * Et sa règle, confirmée le même jour : ajouter → ce jour et les suivants ;
 * retirer → ce jour seulement.
 */

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

// Un chantier de huit jours, du lundi 21 septembre au mercredi 30.
const HUIT_JOURS: Creneau[] = creneauxDuChantier({ jour: "2026-09-21", moment: "matin" }, 16);
const JOURS = [...new Set(HUIT_JOURS.map((c) => c.jour))];
assert.equal(JOURS.length, 8, "le décor n'est pas celui qu'on croit");
const J4 = JOURS[3];
const ANTOINE = 1;
const JULIEN = 2;

const chaqueJour = (equipe: number, demi: "matin" | "apres_midi" = "matin"): LigneEquipe => ({
  jour: null,
  demi,
  equipe,
});

function appliquer(lignes: LigneEquipe[], b: ReturnType<typeof basculerCeJour<number>>) {
  const restantes = lignes.filter(
    (l) => !b.retirer.some((r) => r.jour === l.jour && r.demi === l.demi && r.equipe === l.equipe)
  );
  return [...restantes, ...b.ajouter];
}

console.log("\nLes lignes d'avant valent chaque jour");

essai("une ligne sans jour met la personne sur les huit jours", () => {
  const lignes = [chaqueJour(ANTOINE), chaqueJour(JULIEN)];
  for (const j of JOURS) {
    assert.deepEqual(equipesDuJour({ lignes }, j).matin, [ANTOINE, JULIEN], `jour ${j}`);
  }
});

essai("une ligne datée ne vaut que pour son jour", () => {
  const lignes: LigneEquipe[] = [{ jour: J4, demi: "matin", equipe: JULIEN }];
  assert.deepEqual(equipesDuJour({ lignes }, J4).matin, [JULIEN]);
  assert.deepEqual(equipesDuJour({ lignes }, JOURS[0]).matin, []);
  assert.deepEqual(equipesDuJour({ lignes }, J4).apres_midi, []);
});

console.log("\nRetirer → ce jour seulement — sa plainte");

essai("retirer Julien le 4e jour le laisse sur les sept autres", () => {
  let lignes = [chaqueJour(ANTOINE), chaqueJour(JULIEN)];
  const b = basculerCeJour(lignes, HUIT_JOURS, J4, "matin", JULIEN);
  assert.equal(b.cochee, true, "Julien était coché ce jour-là");
  lignes = appliquer(lignes, b);
  assert.deepEqual(equipesDuJour({ lignes }, J4).matin, [ANTOINE], "Julien est encore là le 4e jour");
  for (const j of JOURS.filter((x) => x !== J4)) {
    assert.deepEqual(equipesDuJour({ lignes }, j).matin, [ANTOINE, JULIEN], `Julien a disparu le ${j}`);
  }
  // Antoine, lui, n'a pas bougé : sa ligne sans jour est intacte.
  assert.ok(lignes.some((l) => l.jour === null && l.equipe === ANTOINE), "Antoine a été déplié pour rien");
});

essai("retirer ne touche pas l'autre demi-journée", () => {
  let lignes = [chaqueJour(JULIEN, "matin"), chaqueJour(JULIEN, "apres_midi")];
  lignes = appliquer(lignes, basculerCeJour(lignes, HUIT_JOURS, J4, "matin", JULIEN));
  assert.deepEqual(equipesDuJour({ lignes }, J4).apres_midi, [JULIEN], "l'après-midi a suivi le matin");
});

essai("retirer une ligne déjà datée ne retire que celle-là", () => {
  let lignes: LigneEquipe[] = JOURS.map((j) => ({ jour: j, demi: "matin", equipe: JULIEN }));
  lignes = appliquer(lignes, basculerCeJour(lignes, HUIT_JOURS, J4, "matin", JULIEN));
  assert.equal(lignes.length, 7);
  assert.deepEqual(equipesDuJour({ lignes }, J4).matin, []);
});

console.log("\nAjouter → ce jour et les suivants");

essai("ajouter Julien le 4e jour le met du 4e au 8e, pas avant", () => {
  let lignes = [chaqueJour(ANTOINE)];
  const b = basculerCeJour(lignes, HUIT_JOURS, J4, "matin", JULIEN);
  assert.equal(b.cochee, false);
  lignes = appliquer(lignes, b);
  for (const [i, j] of JOURS.entries()) {
    const attendu = i >= 3 ? [ANTOINE, JULIEN] : [ANTOINE];
    assert.deepEqual(equipesDuJour({ lignes }, j).matin, attendu, `jour ${i + 1}`);
  }
});

essai("ajouter le premier jour, c'est tout le chantier — ce qu'il faisait déjà", () => {
  let lignes: LigneEquipe[] = [];
  lignes = appliquer(lignes, basculerCeJour(lignes, HUIT_JOURS, JOURS[0], "matin", JULIEN));
  for (const j of JOURS) assert.deepEqual(equipesDuJour({ lignes }, j).matin, [JULIEN], j);
});

essai("recocher le jour retiré ne doublonne pas les jours suivants", () => {
  let lignes = [chaqueJour(JULIEN)];
  lignes = appliquer(lignes, basculerCeJour(lignes, HUIT_JOURS, J4, "matin", JULIEN));
  lignes = appliquer(lignes, basculerCeJour(lignes, HUIT_JOURS, J4, "matin", JULIEN));
  assert.equal(lignes.length, 8, "des lignes en double");
  for (const j of JOURS) assert.deepEqual(equipesDuJour({ lignes }, j).matin, [JULIEN], j);
});

essai("ajouter sur un chantier d'une demi-journée ne pose qu'une ligne", () => {
  const unMatin = creneauxDuChantier({ jour: "2026-09-21", moment: "matin" }, 1);
  const b = basculerCeJour([], unMatin, "2026-09-21", "matin", JULIEN);
  assert.deepEqual(b.ajouter, [{ jour: "2026-09-21", demi: "matin", equipe: JULIEN }]);
  // Et l'après-midi n'existe pas sur ce chantier : rien à poser.
  assert.deepEqual(basculerCeJour([], unMatin, "2026-09-21", "apres_midi", JULIEN).ajouter, []);
});

console.log("\nCe que le planning lit");

essai("matin / apres_midi disent qui vient au moins un jour", () => {
  const lignes: LigneEquipe[] = [chaqueJour(ANTOINE), { jour: J4, demi: "apres_midi", equipe: JULIEN }];
  const r = rangerEquipes(lignes);
  assert.deepEqual(r.matin, [ANTOINE]);
  assert.deepEqual(r.apres_midi, [JULIEN]);
  assert.equal(r.lignes.length, 2);
});

essai("les rangs sont triés, sans doublon", () => {
  const lignes: LigneEquipe[] = [
    { jour: J4, demi: "matin", equipe: 3 },
    chaqueJour(1),
    { jour: JOURS[5], demi: "matin", equipe: 3 },
  ];
  assert.deepEqual(rangerEquipes(lignes).matin, [1, 3]);
});

console.log("\nQuand le chantier bouge");

essai("les mêmes jours : rien à réécrire", () => {
  const lignes: LigneEquipe[] = [{ jour: J4, demi: "matin", equipe: JULIEN }];
  assert.equal(reporterEquipes(lignes, HUIT_JOURS, HUIT_JOURS.slice(1)), null);
});

essai("sans ligne datée : rien à réécrire", () => {
  assert.equal(reporterEquipes([chaqueJour(JULIEN)], HUIT_JOURS, []), null);
});

essai("reposé une autre semaine : le 4e jour reste le 4e jour", () => {
  const lignes: LigneEquipe[] = JOURS.slice(3).map((j) => ({ jour: j, demi: "matin", equipe: JULIEN }));
  const apres = creneauxDuChantier({ jour: "2026-10-05", moment: "matin" }, 16);
  const joursApres = [...new Set(apres.map((c) => c.jour))];
  const r = reporterEquipes(lignes, HUIT_JOURS, apres);
  assert.ok(r);
  assert.deepEqual(
    r.map((l) => l.jour).sort(),
    joursApres.slice(3),
    "Julien n'est pas du 4e au 8e jour de la nouvelle semaine"
  );
});

essai("raccourci : ce qui dépasse tombe", () => {
  const lignes: LigneEquipe[] = JOURS.slice(3).map((j) => ({ jour: j, demi: "matin", equipe: JULIEN }));
  const apres = creneauxDuChantier({ jour: "2026-10-05", moment: "matin" }, 8); // quatre jours
  const r = reporterEquipes(lignes, HUIT_JOURS, apres);
  assert.ok(r);
  assert.equal(r.length, 1, "seul le 4e jour tient dans quatre jours");
});

essai("rendu à « Sans date » : les lignes datées se replient en une seule", () => {
  const lignes: LigneEquipe[] = [
    chaqueJour(ANTOINE),
    ...JOURS.slice(3).map((j): LigneEquipe => ({ jour: j, demi: "matin", equipe: JULIEN })),
  ];
  const r = reporterEquipes(lignes, HUIT_JOURS, []);
  assert.deepEqual(r, [{ jour: null, demi: "matin", equipe: JULIEN }]);
});

essai("repli : pas de doublon avec une ligne sans jour déjà là", () => {
  const lignes: LigneEquipe[] = [chaqueJour(JULIEN), { jour: J4, demi: "matin", equipe: JULIEN }];
  assert.deepEqual(reporterEquipes(lignes, HUIT_JOURS, []), []);
});

if (echecs > 0) {
  console.log(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est vert.");
