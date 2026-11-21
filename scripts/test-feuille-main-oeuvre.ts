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
  equipeDeSaLigne,
  equipeDeSesParts,
  estLaLigneDeSonEquipe,
  ligneDeSonEquipe,
  ligneDeSonPartenaire,
  mainOeuvreDUnPartenaire,
  montantDeLaMainOeuvre,
  partDeSonEquipe,
  partsAppliquees,
  prixDesPartenaires,
  prixEnMots,
  quantiteDuPartenaire,
  quantiteTapee,
  rangDeLaDuree,
  sansLaPartDeSonEquipe,
} from "../src/lib/feuille-main-oeuvre";
import { ecrireChoix, lireChoix, questionDeLaMainOeuvre } from "../src/lib/main-oeuvre-dictee";
import type { PrixAchatCandidat } from "../src/lib/prix-achat";
import { uniteAdmise } from "../src/lib/unite-de-ligne";
import { mainDoeuvreApresUnAjout, mainDoeuvreDesLignes } from "../src/lib/main-doeuvre-devis";

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
  assert.deepEqual(l, { libelle: "Main d’œuvre", quantite: "4", unite: "jour/homme", prixUnitaire: "280.00", hommes: 2 });
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
  // **Le nom du partenaire ne part pas chez le client** (sa réponse du
  // 19 novembre 2026 : « le retirer »). La ligne s'imprime sur le PDF et la
  // page du client ; le partenaire reste dans le calcul, pour lui seul.
  assert.deepEqual(l, { libelle: "Main d’œuvre", quantite: "3", unite: "journée", prixUnitaire: "456.00" });
  assert.ok(!l.libelle.includes("Carrelage Morin"), `le nom du partenaire est sur la ligne : « ${l.libelle} »`);
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

// ── SUR LA FACTURE — la même feuille, le 4 novembre 2026 ──────────────────
// « dont main d'œuvre HT » y reste un montant gardé (lecture B, §459) : la
// feuille qui ajoute une main d'œuvre l'y AJOUTE, bornée comme une saisie.

cas("sur la facture, la main d'œuvre ajoutée s'ajoute à « dont »", () => {
  assert.equal(mainDoeuvreApresUnAjout(null, "1120.00", "1520.00"), "1120.00");
  assert.equal(mainDoeuvreApresUnAjout("380.00", "560.00", "2500.00"), "940.00");
});

cas("« dont » ne dépasse jamais le total HT, même après un ajout", () => {
  assert.equal(mainDoeuvreApresUnAjout("900.00", "560.00", "1200.00"), "1200.00");
});

cas("une main d'œuvre à chiffrer ne change pas « dont » : rien ne s'invente", () => {
  assert.equal(mainDoeuvreApresUnAjout(null, null, "800.00"), null);
  assert.equal(mainDoeuvreApresUnAjout("380.00", null, "800.00"), "380.00");
});

// ── LE PARTENAIRE PRIS SUR LA QUESTION DE LA DICTÉE (son « B » du 4 novembre 2026) ──
// Planche `appli/soignee/main-oeuvre-dictee-partenaires.html` : la carte
// « Avant de chiffrer » et la feuille du devis lisent les MÊMES règles.

const [durand] = prixDesPartenaires(
  [candidat({ id: "d1", nom: "Démontage sur corde", unite: "journée", prixHt: "450", societeNom: "Élagage Durand", margePropre: "1.35" })],
  { materiel: null, mainOeuvre: "1.20" }
);
const [aLHeure] = prixDesPartenaires(
  [candidat({ id: "d2", nom: "Élagage", unite: "heure", prixHt: "60", societeNom: "Élagage Durand", margePropre: null })],
  { materiel: null, mainOeuvre: "1.20" }
);

cas("à la journée, le partenaire prend les jours dictés, quoi que l'écran envoie", () => {
  assert.equal(quantiteDuPartenaire(durand, 2, 99), 2);
  assert.equal(quantiteDuPartenaire(durand, 0.5, null), 0.5);
});

cas("à l'heure ou au forfait, la quantité est celle qu'il tape, au-dessus de zéro", () => {
  assert.equal(quantiteDuPartenaire(aLHeure, 2, 10), 10);
  assert.equal(quantiteDuPartenaire(aLHeure, 2, 0), null);
  assert.equal(quantiteDuPartenaire(aLHeure, 2, null), null);
  assert.equal(quantiteDuPartenaire(aLHeure, 2, 100000), null);
});

cas("2 jours × 450 €, plus 35 %, font 1 215 €, sur une ligne qui ne le nomme pas", () => {
  const m = mainOeuvreDUnPartenaire(durand, 2);
  assert.equal(m.montant, "1215.00");
  assert.equal(m.ligne.libelle, "Main d’œuvre");
  // La marge se dit en pour cent depuis sa planche B du 20 novembre 2026.
  assert.equal(m.calcul.replace(/\s/g, " "), "2 jours × 450 €, plus 35 %");
});

cas("0 % sur un partenaire : son prix tel quel, et la phrase dit « sans marge »", () => {
  const [tel] = prixDesPartenaires(
    [candidat({ id: "d4", nom: "Démontage sur corde", unite: "journée", prixHt: "450", societeNom: "Élagage Durand", margePropre: "1.00" })],
    { materiel: null, mainOeuvre: "1.20" }
  );
  const m = mainOeuvreDUnPartenaire(tel, 2);
  assert.equal(m.montant, "900.00");
  assert.equal(m.calcul.replace(/\s/g, " "), "2 jours × 450 €, sans marge");
});

cas("une marge à donner sur la main d'œuvre : la main d'œuvre arrive à chiffrer, et la phrase le dit", () => {
  const [sansMarge] = prixDesPartenaires(
    [candidat({ id: "d3", nom: "Élagage", unite: "heure", prixHt: "60", societeNom: "Élagage Durand", margePropre: null })],
    { materiel: null, mainOeuvre: null }
  );
  const m = mainOeuvreDUnPartenaire(sansMarge, 4);
  assert.equal(m.montant, null);
  assert.match(m.calcul, /arrivera à chiffrer/);
});

cas("le prix se dit comme sur sa fiche", () => {
  assert.equal(prixEnMots(durand).replace(/\s/g, " "), "450 € la journée");
  assert.equal(prixEnMots(aLHeure).replace(/\s/g, " "), "60 € l’heure");
});

cas("son choix garde le partenaire, et ce qui ne se lit pas n'y entre pas", () => {
  const lu = lireChoix(ecrireChoix({ mode: "ligne", parts: {}, retires: [], partenaire: { prixId: "d1", quantite: 2 } }));
  assert.deepEqual(lu?.partenaire, { prixId: "d1", quantite: 2 });
  for (const abime of [{ prixId: 4, quantite: 2 }, { prixId: "", quantite: 2 }, { prixId: "d1", quantite: -1 }, { prixId: "d1", quantite: "2" }, "d1"]) {
    const l = lireChoix(JSON.stringify({ mode: "reparti", parts: {}, retires: [], partenaire: abime }));
    assert.equal(l?.mode, "reparti", "le reste du choix se lit toujours");
    assert.equal(l?.partenaire, undefined, `un partenaire abîmé est écarté : ${JSON.stringify(abime)}`);
  }
  assert.equal(lireChoix(ecrireChoix({ mode: "reparti", parts: {}, retires: [] }))?.partenaire, undefined);
});

cas("la question dit le total qu'elle partage, et se tait quand il n'y en a pas", () => {
  assert.match(questionDeLaMainOeuvre("1215.00"), /^Où mettre les 1\s?215\s€ de main d'œuvre \?$/);
  assert.equal(questionDeLaMainOeuvre(null), "Où mettre la main d'œuvre ?");
});

// ── LA FEUILLE CHANGE LA LIGNE DE SON ÉQUIPE — sa planche du 18 novembre 2026 ──
// Sa capture : « Main d'œuvre » posait une seconde ligne (2 400 € à côté des
// 1 600 €). Sa réponse : la feuille CHANGE sa ligne, et se rouvre sur elle.

cas("la ligne de son équipe se reconnaît à ses jours d'homme, jamais celle d'un partenaire ni un travail", () => {
  assert.equal(estLaLigneDeSonEquipe({ mainDoeuvre: true, unite: "jour/homme" }), true);
  assert.equal(estLaLigneDeSonEquipe({ mainDoeuvre: true, unite: "jour" }), false, "un partenaire à la journée");
  assert.equal(estLaLigneDeSonEquipe({ mainDoeuvre: true, unite: "h" }), false, "un partenaire à l'heure");
  assert.equal(estLaLigneDeSonEquipe({ mainDoeuvre: false, unite: "jour/homme" }), false, "un travail");
  assert.equal(estLaLigneDeSonEquipe({ mainDoeuvre: null, unite: null }), false);
});

cas("sa capture : 4 jour/homme à 400 €, dictés 2 hommes, la feuille se rouvre sur 2 hommes × 2 jours", () => {
  assert.deepEqual(
    equipeDeSaLigne({ quantite: "4.00", prixUnitaire: "400.00", aChiffrer: false, hommesMainDoeuvre: null }, { hommes: 2 }),
    { hommes: 2, jours: 2, tarif: "400.00" }
  );
});

cas("après « 3 hommes », sa ligne garde ses hommes : la feuille se rouvre sur 3 × 2, pas sur 2 × 3", () => {
  assert.deepEqual(
    equipeDeSaLigne({ quantite: "6.00", prixUnitaire: "400.00", aChiffrer: false, hommesMainDoeuvre: 3 }, { hommes: 2 }),
    { hommes: 3, jours: 2, tarif: "400.00" }
  );
});

cas("5 jour/homme tapés à la main, dictés 2 hommes : 1 homme × 5 jours, le total ne bouge pas", () => {
  const e = equipeDeSaLigne({ quantite: "5", prixUnitaire: "400", aChiffrer: false, hommesMainDoeuvre: null }, { hommes: 2 });
  assert.deepEqual(e, { hommes: 1, jours: 5, tarif: "400.00" });
  assert.equal(ligneDeSonEquipe(e.hommes, e.jours, e.tarif).quantite, "5");
});

cas("une ligne à chiffrer ne prête pas son zéro : la feuille reprend ses tarifs", () => {
  assert.equal(equipeDeSaLigne({ quantite: "4", prixUnitaire: "0.00", aChiffrer: true, hommesMainDoeuvre: 2 }, { hommes: 2 }).tarif, null);
});

cas("sans dictée, une demi-journée d'un homme se relit telle quelle", () => {
  assert.deepEqual(
    equipeDeSaLigne({ quantite: "0.50", prixUnitaire: "400", aChiffrer: false, hommesMainDoeuvre: null }, { hommes: null }),
    { hommes: 1, jours: 0.5, tarif: "400.00" }
  );
});

cas("la ligne de son équipe dit ses hommes, celle d'un partenaire n'en a pas", () => {
  assert.equal(ligneDeSonEquipe(3, 2, "400").hommes, 3);
  assert.equal(ligneDeSonPartenaire(prixDesPartenaires([candidat({})], { materiel: null, mainOeuvre: "1.20" })[0], 2).hommes, undefined);
});

// **Une seule forme par TVA** (`ARCHITECTURE.md` §596) : la part de son équipe
// sort d'un travail quand elle change de forme, celle d'un partenaire reste.
cas("sa part, posée puis retirée, rend le travail à son prix d'avant, au centime", () => {
  // 150 € sur 7 m² à 18 € : 149,99 € posés (le prix n'a que deux décimales).
  const [posee] = partsAppliquees([{ id: "t", quantite: "7", prixUnitaire: "18.00", partMainDoeuvre: null }], { t: "150" });
  const sans = sansLaPartDeSonEquipe({ quantite: "7", montant: posee.montant, partMainDoeuvre: posee.partMainDoeuvre, joursMainDoeuvre: "0.375" });
  assert.deepEqual(sans, { prixUnitaire: "18.00", montant: "126.00" });
});

cas("une part sans jours d'homme (partenaire, mêlée, d'avant 0173) n'est pas la sienne : elle reste", () => {
  assert.equal(partDeSonEquipe({ partMainDoeuvre: "1080.00", joursMainDoeuvre: null }), null);
  assert.equal(sansLaPartDeSonEquipe({ quantite: "50", montant: "1830.00", partMainDoeuvre: "1080.00", joursMainDoeuvre: null }), null);
  assert.equal(partDeSonEquipe({ partMainDoeuvre: null, joursMainDoeuvre: "6" }), null, "sans part, il n'y a rien à retirer");
  assert.equal(partDeSonEquipe({ partMainDoeuvre: "2400.00", joursMainDoeuvre: "6.000000" })?.toFixed(2), "2400.00");
});

// **Répartie, la feuille se rouvre sur ses parts** (sa planche du 20 novembre 2026).
cas("ses parts redisent son équipe : 2 hommes × 2 jours à 280 €, chaque travail avec la sienne", () => {
  const travaux = [
    { id: "taille", partMainDoeuvre: "560.00", joursMainDoeuvre: "2.000000" },
    { id: "broyage", partMainDoeuvre: "560.00", joursMainDoeuvre: "2.000000" },
    { id: "sans", partMainDoeuvre: null, joursMainDoeuvre: null },
  ];
  assert.deepEqual(equipeDeSesParts(travaux, { hommes: 2 }), {
    hommes: 2,
    jours: 2,
    tarif: "280.00",
    parts: { taille: 560, broyage: 560 },
  });
});

cas("des parts arrondies au centime retombent sur le compteur", () => {
  // 1 120 € au prorata : 746,67 € et 373,33 €, soit 2,666679 et 1,333321 jours.
  const r = equipeDeSesParts(
    [
      { id: "a", partMainDoeuvre: "746.67", joursMainDoeuvre: "2.666679" },
      { id: "b", partMainDoeuvre: "373.33", joursMainDoeuvre: "1.333321" },
    ],
    { hommes: 2 }
  );
  assert.deepEqual({ hommes: r?.hommes, jours: r?.jours, tarif: r?.tarif }, { hommes: 2, jours: 2, tarif: "280.00" });
});

cas("sans part de son équipe (rien, ou un partenaire), la feuille repart de sa dictée", () => {
  assert.equal(equipeDeSesParts([], { hommes: 2 }), null);
  assert.equal(equipeDeSesParts([{ id: "p", partMainDoeuvre: "1080.00", joursMainDoeuvre: null }], { hommes: 2 }), null);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La feuille de la main d'œuvre — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
