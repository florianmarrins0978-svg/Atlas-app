import assert from "node:assert/strict";
import {
  moisDeLaPeriode,
  finDeLaPeriode,
  periodeEnLettres,
  passagesDeLaPrestation,
  totauxDuContrat,
  mensualites,
  jourDArrivee,
  passagesArrives,
  clePassage,
  lirePassage,
  ligneDuPassage,
  ttcDuPassage,
  relireContrat,
  ceQuiManque,
  designationSurLePapier,
  type PrestationContrat,
  type PeriodeContrat,
} from "../src/lib/contrats-entretien";
import { getPlanificationEtat } from "../src/lib/chantier-etat";
import { ongletDuChantier } from "../src/lib/onglet-chantier";

// Les règles du contrat d'entretien, sans base ni réseau.
//
// **Les chiffres viennent de SA planche** (129, 26 septembre 2026) et sont
// recomptés à la main dans chaque cas : 14 tontes à 45 €, deux tailles à 180 €,
// un ramassage à 60 €, soit 17 passages et 1 050 € HT sur mars 2027 à février
// 2028. Un calcul qui dériverait se verrait ici avant de se voir sur un contrat.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

const PLANCHE: PrestationContrat[] = [
  { libelle: "Tonte et ébarbage", famille: "Pelouse", mois: [4, 5, 6, 7, 8, 9, 10], foisParMois: 2, prixPassageHt: "45.00" },
  { libelle: "Taille de haie printemps", famille: "Tailles", mois: [5], foisParMois: 1, prixPassageHt: "180.00" },
  { libelle: "Taille de haie automne", famille: "Tailles", mois: [10], foisParMois: 1, prixPassageHt: "180.00" },
  { libelle: "Ramassage des feuilles", famille: "Propreté", mois: [11], foisParMois: 1, prixPassageHt: "60.00" },
];
const UN_AN: PeriodeContrat = { debut: "2027-03-01", dureeMois: 12 };

console.log("=== Le contrat d'entretien, ses règles ===");

cas("la période de sa planche : mars 2027 à février 2028, année bissextile comprise", () => {
  const mois = moisDeLaPeriode(UN_AN);
  assert.equal(mois.length, 12);
  assert.deepEqual(mois[0], { annee: 2027, mois: 3 });
  assert.deepEqual(mois[11], { annee: 2028, mois: 2 });
  assert.equal(finDeLaPeriode(UN_AN), "2028-02-29");
  assert.equal(periodeEnLettres(UN_AN), "Du 1er mars 2027 au 29 février 2028");
});

cas("les totaux de sa planche : 17 passages, 1 050 € HT, 1 260 € TTC", () => {
  const t = totauxDuContrat(PLANCHE, UN_AN, "20");
  assert.deepEqual(t, { passages: 17, totalHt: "1050.00", totalTva: "210.00", totalTtc: "1260.00" });
});

cas("six mois, de mars à août : la taille d'automne et les feuilles ne comptent plus", () => {
  const six = { debut: "2027-03-01", dureeMois: 6 };
  assert.equal(passagesDeLaPrestation(PLANCHE[0], six), 10);
  assert.equal(passagesDeLaPrestation(PLANCHE[2], six), 0);
  assert.equal(totauxDuContrat(PLANCHE, six, "20").totalHt, "630.00");
  assert.equal(ceQuiManque(PLANCHE, six), "À compléter : Taille de haie automne, Ramassage des feuilles.");
});

cas("dix-huit mois depuis avril : mai compte deux fois, 30 passages, 1 770 € HT", () => {
  const dixHuit = { debut: "2027-04-01", dureeMois: 18 };
  assert.equal(passagesDeLaPrestation(PLANCHE[1], dixHuit), 2);
  const t = totauxDuContrat(PLANCHE, dixHuit, "20");
  assert.equal(t.passages, 30);
  assert.equal(t.totalHt, "1770.00");
});

cas("une prestation à chiffrer ne pèse rien et bloque l'envoi", () => {
  const sansPrix = [{ ...PLANCHE[0], prixPassageHt: null }];
  assert.equal(totauxDuContrat(sansPrix, UN_AN, "20").totalHt, "0.00");
  assert.equal(ceQuiManque(sansPrix, UN_AN), "À compléter : Tonte et ébarbage.");
  assert.equal(ceQuiManque([], UN_AN), "Ajoutez une prestation.");
  assert.equal(ceQuiManque(PLANCHE, UN_AN), null);
});

cas("les mensualités retombent au centime sur le total, l'arrondi sur la dernière", () => {
  assert.deepEqual(mensualites("1050.00", 12), { nombre: 12, montant: "87.50", derniere: "87.50" });
  const m = mensualites("1170.00", 12);
  assert.equal(m.montant, "97.50");
  const bizarre = mensualites("1770.00", 18);
  assert.equal(bizarre.montant, "98.33");
  assert.equal(bizarre.derniere, "98.39");
  // La somme, recomptée : 17 × 98,33 + 98,39 = 1 770,00.
  assert.equal((17 * 9833 + 9839) / 100, 1770);
});

cas("les passages d'avril arrivent le 20 mars, ceux de janvier le 20 décembre d'avant", () => {
  assert.equal(jourDArrivee({ annee: 2027, mois: 4 }), "2027-03-20");
  assert.equal(jourDArrivee({ annee: 2028, mois: 1 }), "2027-12-20");
});

cas("l'arrivée : rien le 19 mars, les deux tontes d'avril le 20", () => {
  assert.deepEqual(passagesArrives(PLANCHE, UN_AN, "2027-03-19", "2027-01-10"), []);
  const le20 = passagesArrives(PLANCHE, UN_AN, "2027-03-20", "2027-01-10");
  assert.deepEqual(le20, [
    { prestation: 0, annee: 2027, mois: 4, rang: 1 },
    { prestation: 0, annee: 2027, mois: 4, rang: 2 },
  ]);
  // Fin avril : ceux de mai sont arrivés aussi, et rien au-delà.
  assert.equal(passagesArrives(PLANCHE, UN_AN, "2027-04-20", "2027-01-10").length, 5);
  assert.equal(clePassage(le20[1]), "0-2027-04-2");
});

cas("un contrat accepté en juin ne déverse pas avril et mai, mais garde juin et juillet", () => {
  const dus = passagesArrives(PLANCHE, UN_AN, "2027-06-25", "2027-06-10");
  assert.deepEqual([...new Set(dus.map((d) => d.mois))], [6, 7]);
  // Accepté avant, puis planning jamais ouvert : avril reste dû.
  assert.ok(passagesArrives(PLANCHE, UN_AN, "2027-06-25", "2027-03-01").some((d) => d.mois === 4));
});

cas("relire : un nom vide, un mois hors calendrier, 32 passages, un prix négatif se refusent en le disant", () => {
  const base = {
    prestations: [{ libelle: "Tonte", mois: [4], foisParMois: 2, prixPassageHt: "45" }],
    debut: "2027-03-01",
    dureeMois: 12,
    reconduit: true,
    facturation: "passage" as const,
    avecCompteRendu: true,
  };
  const r = relireContrat(base);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.contrat.prestations[0].prixPassageHt, "45.00");
  const refus = (m: Partial<typeof base>) => {
    const x = relireContrat({ ...base, ...m });
    assert.equal(x.ok, false);
    return x.ok ? "" : x.refus;
  };
  assert.match(refus({ prestations: [{ ...base.prestations[0], libelle: "   " }] }), /pas de nom/);
  assert.match(refus({ prestations: [{ ...base.prestations[0], mois: [13] }] }), /mois/);
  assert.match(refus({ prestations: [{ ...base.prestations[0], foisParMois: 32 }] }), /31 passages/);
  assert.match(refus({ prestations: [{ ...base.prestations[0], prixPassageHt: "-5" }] }), /prix/);
  assert.match(refus({ dureeMois: 37 }), /36 mois/);
  assert.match(refus({ debut: "2027-03-15" }), /mois/);
});

cas("l'automatisme n'existe qu'en B : en A, il s'éteint à la relecture", () => {
  const r = relireContrat({
    prestations: [], debut: "2027-03-01", dureeMois: 12, reconduit: false, facturation: "mois", avecCompteRendu: true,
  });
  assert.ok(r.ok && r.contrat.avecCompteRendu === false);
});

cas("la désignation sur le papier : une suite de mois, un mois seul, des mois épars", () => {
  assert.equal(designationSurLePapier(PLANCHE[0]), "Tonte et ébarbage, 2 passages par mois, d'avril à octobre");
  assert.equal(designationSurLePapier(PLANCHE[1]), "Taille de haie printemps, en mai");
  assert.equal(
    designationSurLePapier({ ...PLANCHE[3], mois: [3, 11] }),
    "Ramassage des feuilles, en mars et novembre"
  );
});

cas("un passage de contrat attend son jour sans devis : « Sans date », puis planifié", () => {
  assert.equal(getPlanificationEtat({ devisEnvoyeAt: null, datePlanifiee: null, contratEntretienId: "c1" }), "a_planifier");
  assert.equal(getPlanificationEtat({ devisEnvoyeAt: null, datePlanifiee: "2027-04-06", contratEntretienId: "c1" }), "planifie");
  assert.equal(getPlanificationEtat({ devisEnvoyeAt: null, datePlanifiee: null }), "non_concerne");
});

cas("un passage sans jour se range au planning, pas dans les chantiers à préparer", () => {
  assert.equal(ongletDuChantier({ statut: "brouillon", datePlanifiee: null, contratEntretienId: "c1" }, "2027-04-01"), "planning");
  assert.equal(ongletDuChantier({ statut: "brouillon", datePlanifiee: null }, "2027-04-01"), "chantiers");
  // Posé puis passé : Terminés, comme tout chantier.
  assert.equal(ongletDuChantier({ statut: "planifie", datePlanifiee: "2027-03-30", contratEntretienId: "c1" }, "2027-04-01"), "termines");
});

cas("la ligne de facture d'un passage : sa prestation, au prix du contrat, et son jour", () => {
  assert.deepEqual(lirePassage("0-2027-04-2"), { prestation: 0, annee: 2027, mois: 4, rang: 2 });
  assert.equal(lirePassage("n'importe quoi"), null);
  assert.deepEqual(ligneDuPassage(PLANCHE, "0-2027-04-2", "2027-04-06"), {
    libelle: "Tonte et ébarbage, passage du 6 avril 2027",
    prixUnitaireHt: "45.00",
  });
  assert.equal(ligneDuPassage(PLANCHE, "0-2027-04-2", null)?.libelle, "Tonte et ébarbage, passage d'avril 2027");
  assert.equal(ligneDuPassage(PLANCHE, "1-2027-05-1", null)?.libelle, "Taille de haie printemps, passage de mai 2027");
  // Une prestation disparue ou sans prix ne se facture pas au hasard.
  assert.equal(ligneDuPassage(PLANCHE, "9-2027-04-1", null), null);
  assert.equal(ligneDuPassage([{ ...PLANCHE[0], prixPassageHt: null }], "0-2027-04-1", null), null);
});

cas("le montant prévu d'un passage, TTC : 45 € HT à 20 % font 54 €", () => {
  assert.equal(ttcDuPassage(PLANCHE, "0-2027-04-1", "20.00"), "54.00");
  assert.equal(ttcDuPassage(PLANCHE, "0-2027-04-1", "10.00"), "49.50");
  assert.equal(ttcDuPassage(PLANCHE, "9-2027-04-1", "20.00"), null);
});

if (echecs > 0) {
  console.error(`\n${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\n✅ Le contrat d'entretien compte juste.");
