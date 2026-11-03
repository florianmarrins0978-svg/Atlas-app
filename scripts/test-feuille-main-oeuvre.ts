/**
 * La feuille « Main d'œuvre » du devis — ses règles, sans base ni écran.
 * Planche : `appli/soignee/chantier.html?ecran=devis`, choisie le 1er novembre
 * 2026. Ce que la suite tient : son équipe s'écrit comme la préparation du
 * devis l'écrit (des jours d'homme au prix du jour), un partenaire prend son
 * prix multiplié par la marge que l'appli applique déjà, et rien ne s'invente :
 * sans tarif ou sans marge, la ligne arrive à chiffrer.
 */
import assert from "node:assert/strict";
import {
  DUREES_MAIN_OEUVRE,
  ligneDeSonEquipe,
  ligneDeSonPartenaire,
  montantDeLaMainOeuvre,
  partsAppliquees,
  prixDesPartenaires,
  quantiteTapee,
  rangDeLaDuree,
} from "../src/lib/feuille-main-oeuvre";
import type { PrixAchatCandidat } from "../src/lib/prix-achat";
import { uniteAdmise } from "../src/lib/unite-de-ligne";
import { mainDoeuvreDesLignes } from "../src/lib/main-doeuvre-devis";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const candidat = (c: Partial<PrixAchatCandidat>): PrixAchatCandidat => ({
  id: "p1",
  nom: "Pose de faïence",
  unite: "journée",
  prixHt: "380",
  releveLe: "12/10/2026",
  societeNom: "Carrelage Morin",
  rubrique: "partenaire",
  margePropre: null,
  ...c,
});

console.log("La feuille de la main d'œuvre");

cas("le compteur commence à la demi-journée, puis va jour par jour", () => {
  assert.equal(DUREES_MAIN_OEUVRE[0].jours, 0.5);
  assert.equal(DUREES_MAIN_OEUVRE[1].libelle, "1 journée");
  assert.equal(DUREES_MAIN_OEUVRE[2].libelle, "2 jours");
});

cas("la durée dictée trouve son cran, et sans dictée c'est une journée", () => {
  assert.equal(DUREES_MAIN_OEUVRE[rangDeLaDuree(2)].jours, 2);
  assert.equal(DUREES_MAIN_OEUVRE[rangDeLaDuree(0.5)].jours, 0.5);
  assert.equal(DUREES_MAIN_OEUVRE[rangDeLaDuree(null)].jours, 1);
  assert.equal(DUREES_MAIN_OEUVRE[rangDeLaDuree(-3)].jours, 1);
});

cas("son équipe : des jours d'homme au prix du jour, comme la préparation l'écrit", () => {
  const l = ligneDeSonEquipe(2, 2, "280");
  assert.deepEqual(l, { libelle: "Main d’œuvre", quantite: "4", unite: "jour/homme", prixUnitaire: "280.00" });
  assert.equal(montantDeLaMainOeuvre(l), "1120.00");
});

cas("une demi-journée à trois : 1,5 jour d'homme", () => {
  assert.equal(ligneDeSonEquipe(3, 0.5, "300").quantite, "1.5");
});

cas("sans tarif au jour/homme, la ligne arrive À CHIFFRER, jamais à zéro", () => {
  for (const t of [null, "", "0", "abc"]) {
    const l = ligneDeSonEquipe(2, 2, t);
    assert.equal(l.prixUnitaire, null, `tarif « ${t} »`);
    assert.equal(montantDeLaMainOeuvre(l), null);
  }
});

cas("un partenaire : son prix multiplié par la marge de la main d'œuvre", () => {
  const [p] = prixDesPartenaires([candidat({})], { materiel: null, mainOeuvre: "1.20" });
  assert.equal(p.venteHt, "456.00");
  assert.equal(p.marge, "1.20");
  assert.equal(p.margePropre, false);
  const l = ligneDeSonPartenaire(p, 3);
  assert.deepEqual(l, { libelle: "Main d’œuvre : Carrelage Morin", quantite: "3", unite: "journée", prixUnitaire: "456.00" });
  assert.equal(montantDeLaMainOeuvre(l), "1368.00");
});

cas("sa marge à lui passe avant celle de la main d'œuvre", () => {
  const [p] = prixDesPartenaires([candidat({ prixHt: "60", unite: "heure", margePropre: "1.35" })], { materiel: null, mainOeuvre: "1.20" });
  assert.equal(p.venteHt, "81.00");
  assert.equal(p.margePropre, true);
  assert.equal(montantDeLaMainOeuvre(ligneDeSonPartenaire(p, 6.5)), "526.50");
});

cas("sans aucune marge, le prix du partenaire n'est pas recopié : à chiffrer", () => {
  const [p] = prixDesPartenaires([candidat({})], { materiel: null, mainOeuvre: null });
  assert.equal(p.venteHt, null);
  assert.equal(ligneDeSonPartenaire(p, 2).prixUnitaire, null);
});

cas("un fournisseur de matériel n'est pas un partenaire de main d'œuvre", () => {
  assert.equal(prixDesPartenaires([candidat({ rubrique: "fournisseur" })], { materiel: "1.3", mainOeuvre: "1.2" }).length, 0);
});

cas("une quantité se tape avec une virgule, et zéro n'en est pas une", () => {
  assert.equal(quantiteTapee("6,5"), 6.5);
  assert.equal(quantiteTapee("40 m"), 40);
  assert.equal(quantiteTapee("0"), null);
  assert.equal(quantiteTapee("abc"), null);
  assert.equal(quantiteTapee(""), null);
});

cas("les unités de la main d'œuvre tiennent en base, au lieu de retomber en « u »", () => {
  assert.equal(uniteAdmise("jour/homme"), "jour/homme");
  assert.equal(uniteAdmise("jours homme"), "jour/homme");
  assert.equal(uniteAdmise("j/h"), "jour/homme");
  assert.equal(uniteAdmise("journée"), "jour");
  assert.equal(uniteAdmise("jours"), "jour");
  assert.equal(uniteAdmise("m"), "ml");
  // Les unités d'avant ne bougent pas.
  assert.equal(uniteAdmise("heure"), "h");
  assert.equal(uniteAdmise("m²"), "m²");
  assert.equal(uniteAdmise("tonne"), null);
});

cas("répartie : la part entre dans le prix unitaire, la quantité ne bouge pas", () => {
  const [r] = partsAppliquees([{ id: "a", quantite: "12", prixUnitaire: "18", partMainDoeuvre: null }], { a: "150.00" });
  assert.deepEqual(r, { id: "a", prixUnitaire: "30.50", montant: "366.00", partMainDoeuvre: "150.00", partPosee: "150.00" });
});

cas("une part qui ne tombe pas juste se garde AU CENTIME que le prix rend", () => {
  const [r] = partsAppliquees([{ id: "a", quantite: "7", prixUnitaire: "10", partMainDoeuvre: null }], { a: "150" });
  // 70 + 150 = 220 sur 7 m² : 31,43 € le m², donc 220,01 €, donc 150,01 € posés.
  assert.equal(r.prixUnitaire, "31.43");
  assert.equal(r.montant, "220.01");
  assert.equal(r.partPosee, "150.01");
});

cas("une seconde répartition s'ajoute à la première", () => {
  const [r] = partsAppliquees([{ id: "a", quantite: "1", prixUnitaire: "300", partMainDoeuvre: "100.00" }], { a: "50" });
  assert.equal(r.partMainDoeuvre, "150.00");
  assert.equal(r.montant, "350.00");
});

cas("une ligne sans quantité, ou une part nulle, ne reçoit rien", () => {
  assert.deepEqual(partsAppliquees([{ id: "a", quantite: "0", prixUnitaire: "10", partMainDoeuvre: null }], { a: "50" }), []);
  assert.deepEqual(partsAppliquees([{ id: "a", quantite: "2", prixUnitaire: "10", partMainDoeuvre: null }], { a: "0" }), []);
  assert.deepEqual(partsAppliquees([{ id: "a", quantite: "2", prixUnitaire: "10", partMainDoeuvre: null }], {}), []);
});

cas("« dont main d'œuvre HT » compte les parts réparties, comme les lignes de main d'œuvre", () => {
  assert.equal(
    mainDoeuvreDesLignes([
      { mainDoeuvre: true, montant: "500" },
      { mainDoeuvre: false, montant: "366", partMainDoeuvre: "150" },
      { mainDoeuvre: false, montant: "96" },
    ]),
    "650.00"
  );
});

cas("une part ne compte jamais plus que la ligne, si le prix a baissé depuis", () => {
  assert.equal(mainDoeuvreDesLignes([{ mainDoeuvre: false, montant: "80", partMainDoeuvre: "150" }]), "80.00");
  assert.equal(mainDoeuvreDesLignes([{ mainDoeuvre: false, montant: "80", partMainDoeuvre: "-5" }]), null);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La feuille de la main d'œuvre — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
