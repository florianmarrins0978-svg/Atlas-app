/* =======================================================================
   Hiverner l'arrosage : les règles (`src/lib/hivernage.ts`), sans base.

   **Sa demande du 5 novembre 2026** : une goutte à côté des clients qui ont
   un arrosage, dès le 1er novembre, « pour ne pas les oublier ». Puis, le 6 :
   « Atlas demande s'il y a un arrosage automatique et si on fait
   l'hivernage. » Ce que ce contrôle tient, c'est ce qui fait porter la goutte
   ou poser la question : une goutte sur le mauvais client, ou une question
   qui revient après un « non », s'apprennent à être ignorées.
   ======================================================================= */
import assert from "node:assert/strict";
import {
  aHiverner,
  ceQueLaFicheDit,
  ceQuiEstPose,
  cePlanningPorte,
  compteDesArrosages,
  debutDeLaSaison,
  finDeLaSaison,
  hivernagePrevu,
  jourChoisissable,
  moisDuPrevoir,
  momentDuChantierPose,
  parleDArrosage,
  phraseDuFait,
  phraseDuPrevu,
  type FaitsDArrosage,
  type HivernagePose,
} from "../src/lib/hivernage";

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

const OUI_OUI: FaitsDArrosage = { arrosageAutomatique: true, hivernageParNous: true, hiverneLe: null };
const JAMAIS: FaitsDArrosage = { arrosageAutomatique: null, hivernageParNous: null, hiverneLe: null };

console.log("La saison");
essai("du 1er novembre à la fin février, à cheval sur deux années", () => {
  assert.equal(debutDeLaSaison("2026-11-01"), "2026-11-01");
  assert.equal(debutDeLaSaison("2026-12-31"), "2026-11-01");
  assert.equal(debutDeLaSaison("2027-01-15"), "2026-11-01");
  assert.equal(debutDeLaSaison("2027-02-28"), "2026-11-01");
  assert.equal(debutDeLaSaison("2026-10-31"), null);
  assert.equal(debutDeLaSaison("2027-03-01"), null);
  assert.equal(debutDeLaSaison("2026-07-16"), null);
});
essai("la fin février suit les années bissextiles", () => {
  assert.equal(finDeLaSaison("2026-11-05"), "2027-02-28");
  assert.equal(finDeLaSaison("2027-11-05"), "2028-02-29");
  assert.equal(finDeLaSaison("2026-06-01"), null);
});

console.log("La goutte");
essai("deux « oui », en saison, rien de fait : à hiverner", () => {
  assert.equal(aHiverner(OUI_OUI, "2026-11-03"), true);
  assert.equal(aHiverner(OUI_OUI, "2027-02-20"), true);
});
essai("hors saison, jamais, même sans hivernage fait", () => {
  assert.equal(aHiverner(OUI_OUI, "2026-10-20"), false);
  assert.equal(aHiverner(OUI_OUI, "2026-07-16"), false);
});
essai("arrosage oui, hivernage non : pas de goutte", () => {
  assert.equal(aHiverner({ ...OUI_OUI, hivernageParNous: false }, "2026-11-03"), false);
});
essai("arrosage oui, hivernage jamais demandé : pas de goutte", () => {
  assert.equal(aHiverner({ ...OUI_OUI, hivernageParNous: null }, "2026-11-03"), false);
});
essai("jamais demandé, ou « non » : pas de goutte", () => {
  assert.equal(aHiverner(JAMAIS, "2026-11-03"), false);
  assert.equal(aHiverner({ ...OUI_OUI, arrosageAutomatique: false }, "2026-11-03"), false);
});
essai("fait cette saison : la goutte part, et ne revient pas en janvier", () => {
  const fait = { ...OUI_OUI, hiverneLe: "2026-11-12" };
  assert.equal(aHiverner(fait, "2026-11-12"), false);
  assert.equal(aHiverner(fait, "2027-01-10"), false);
});
essai("fait la saison d'avant : la goutte revient au 1er novembre", () => {
  const fait = { ...OUI_OUI, hiverneLe: "2025-11-20" };
  assert.equal(aHiverner(fait, "2026-11-01"), true);
});
essai("le compte de la ligne qui les rassemble", () => {
  assert.equal(compteDesArrosages(1), "1 arrosage à hiverner");
  assert.equal(compteDesArrosages(2), "2 arrosages à hiverner");
});

console.log("Ce qui fait poser la question");
essai("un mot suffit, casse et accents ignorés", () => {
  assert.equal(parleDArrosage("Arrosage automatique, 2 réseaux"), true);
  assert.equal(parleDArrosage("Réparation de l'ARROSAGE"), true);
  assert.equal(parleDArrosage("Mise en route de l’arrôsage"), true);
  assert.equal(parleDArrosage("Taille de haie"), false);
});

console.log("Ce que dit la fiche");
const base = { faits: JAMAIS, factureQuiParle: null, aUnContrat: false, poses: [] as HivernagePose[] };
essai("une facture seule : la question, et d'où elle vient", () => {
  assert.deepEqual(ceQueLaFicheDit({ ...base, factureQuiParle: "2026-10-10" }, "2026-11-03"), {
    genre: "question-arrosage",
    pourquoi: "Sa facture du 10 octobre parle d’arrosage.",
  });
});
essai("une facture d'une autre année porte son année", () => {
  const dit = ceQueLaFicheDit({ ...base, factureQuiParle: "2025-05-12" }, "2026-11-03");
  assert.equal(dit?.genre === "question-arrosage" && dit.pourquoi, "Sa facture du 12 mai 2025 parle d’arrosage.");
});
essai("un contrat d'entretien seul : la question aussi", () => {
  assert.deepEqual(ceQueLaFicheDit({ ...base, aUnContrat: true }, "2026-11-03"), {
    genre: "question-arrosage",
    pourquoi: "Il a un contrat d’entretien.",
  });
});
essai("les deux : la facture passe d'abord", () => {
  const dit = ceQueLaFicheDit({ ...base, factureQuiParle: "2026-10-10", aUnContrat: true }, "2026-11-03");
  assert.equal(dit?.genre === "question-arrosage" && dit.pourquoi, "Sa facture du 10 octobre parle d’arrosage.");
});
essai("ni facture ni contrat : aucune question", () => {
  assert.equal(ceQueLaFicheDit(base, "2026-11-03"), null);
});
essai("la question vit aussi hors saison : elle pose un fait pour l'hiver", () => {
  assert.equal(ceQueLaFicheDit({ ...base, aUnContrat: true }, "2026-06-10")?.genre, "question-arrosage");
});
essai("« non » à l'arrosage : plus rien, même avec une facture", () => {
  assert.equal(
    ceQueLaFicheDit({ ...base, faits: { ...JAMAIS, arrosageAutomatique: false }, factureQuiParle: "2026-10-10" }, "2026-11-03"),
    null
  );
});
essai("arrosage oui, hivernage jamais demandé : la seconde question", () => {
  assert.deepEqual(
    ceQueLaFicheDit({ ...base, faits: { ...OUI_OUI, hivernageParNous: null } }, "2026-11-03"),
    { genre: "question-hivernage" }
  );
});
essai("arrosage oui, hivernage non : plus rien", () => {
  assert.equal(ceQueLaFicheDit({ ...base, faits: { ...OUI_OUI, hivernageParNous: false } }, "2026-11-03"), null);
});
essai("deux « oui » en saison : à hiverner, sans rien de prévu", () => {
  assert.deepEqual(ceQueLaFicheDit({ ...base, faits: OUI_OUI }, "2026-11-03"), { genre: "a-hiverner", prevu: null });
});
essai("deux « oui » hors saison : rien", () => {
  assert.equal(ceQueLaFicheDit({ ...base, faits: OUI_OUI }, "2026-10-20"), null);
});
essai("fait cette saison : « Hiverné le 12 novembre »", () => {
  assert.deepEqual(ceQueLaFicheDit({ ...base, faits: { ...OUI_OUI, hiverneLe: "2026-11-12" } }, "2026-11-20"), {
    genre: "hiverne",
    le: "2026-11-12",
  });
  assert.equal(phraseDuFait("2026-11-12"), "Hiverné le 12 novembre");
  assert.equal(phraseDuFait("2026-12-01"), "Hiverné le 1er décembre");
});

console.log("Le prévu");
const poses: HivernagePose[] = [
  { chantierId: "a", jour: "2025-11-14", moment: "matin" },
  { chantierId: "b", jour: "2026-11-12", moment: "matin" },
  { chantierId: "c", jour: "2026-12-03", moment: "journee" },
];
essai("le plus proche à venir dans la saison, jamais celui d'une autre saison", () => {
  assert.equal(hivernagePrevu(poses, "2026-11-05")?.chantierId, "b");
  assert.equal(hivernagePrevu(poses, "2026-11-20")?.chantierId, "c");
});
essai("tous passés : le dernier, encore à noter fait", () => {
  assert.equal(hivernagePrevu(poses, "2027-01-04")?.chantierId, "c");
});
essai("rien dans la saison : rien de prévu", () => {
  assert.equal(hivernagePrevu([poses[0]], "2026-11-05"), null);
});
essai("le moment se lit du départ et de la durée", () => {
  assert.equal(momentDuChantierPose("matin", 1), "matin");
  assert.equal(momentDuChantierPose("apres_midi", 1), "apres_midi");
  assert.equal(momentDuChantierPose("matin", 2), "journee");
  assert.equal(momentDuChantierPose(null, null), "matin");
});
essai("« Prévu le jeudi 12 novembre, le matin »", () => {
  assert.equal(phraseDuPrevu({ jour: "2026-11-12", moment: "matin" }), "Prévu le jeudi 12 novembre, le matin");
  assert.equal(phraseDuPrevu({ jour: "2026-11-12", moment: "apres_midi" }), "Prévu le jeudi 12 novembre, l’après-midi");
  assert.equal(phraseDuPrevu({ jour: "2026-12-03", moment: "journee" }), "Prévu le jeudi 3 décembre, toute la journée");
});

console.log("La feuille de « Le prévoir »");
essai("aujourd'hui ou après, en semaine, dans la saison", () => {
  assert.equal(jourChoisissable("2026-11-03", "2026-11-03"), true);
  assert.equal(jourChoisissable("2026-11-02", "2026-11-03"), false, "un jour passé");
  assert.equal(jourChoisissable("2026-11-07", "2026-11-03"), false, "un samedi");
  assert.equal(jourChoisissable("2026-11-08", "2026-11-03"), false, "un dimanche");
  assert.equal(jourChoisissable("2027-02-26", "2026-11-03"), true);
  assert.equal(jourChoisissable("2027-03-01", "2026-11-03"), false, "après la saison");
  assert.equal(jourChoisissable("2026-11-12", "2026-10-20"), false, "hors saison, rien ne se prévoit");
});
essai("les mois feuilletés : de ce mois-ci à février", () => {
  assert.deepEqual(moisDuPrevoir("2026-11-03"), [
    { annee: 2026, mois: 10 },
    { annee: 2026, mois: 11 },
    { annee: 2027, mois: 0 },
    { annee: 2027, mois: 1 },
  ]);
  assert.deepEqual(moisDuPrevoir("2027-02-10"), [{ annee: 2027, mois: 1 }]);
  assert.deepEqual(moisDuPrevoir("2026-07-16"), []);
});
essai("ce qui est déjà posé, à chaque moment", () => {
  assert.equal(ceQuiEstPose([], [], "matin"), null);
  assert.equal(ceQuiEstPose([], ["M. Lefèvre"], "apres_midi"), "M. Lefèvre");
  assert.equal(ceQuiEstPose([], ["M. Lefèvre"], "journee"), "M. Lefèvre l’après-midi");
  assert.equal(ceQuiEstPose(["M. Bernard"], ["M. Bernard"], "journee"), "M. Bernard toute la journée");
  assert.equal(ceQuiEstPose(["Mme Costa"], ["M. Lefèvre"], "journee"), "Mme Costa le matin, M. Lefèvre l’après-midi");
  assert.equal(ceQuiEstPose(["M. Bernard", "M. Bernard"], [], "matin"), "M. Bernard");
});

essai("ce que le planning porte : ses places, sa fenêtre, le nom du client d'abord", () => {
  const porte = cePlanningPorte(
    [
      { nom: "Chantier Lefèvre", clientNom: "M. Lefèvre", datePlanifiee: "2026-11-12", creneauDebut: "apres_midi", dureeDemiJournees: 1 },
      { nom: "Banque", clientNom: null, datePlanifiee: "2026-11-13", creneauDebut: "matin", dureeDemiJournees: 2 },
      // Une demi-journée rendue : les places posées font foi, pas le bloc d'origine.
      {
        nom: "Chantier Costa",
        clientNom: "Mme Costa",
        datePlanifiee: "2026-11-16",
        creneauDebut: "matin",
        dureeDemiJournees: 2,
        creneaux: [{ jour: "2026-11-16", moment: "apres_midi" }],
      },
      { nom: "Sans date", clientNom: "M. Faucher", datePlanifiee: null, creneauDebut: null, dureeDemiJournees: null },
      { nom: "Hors fenêtre", clientNom: "Mme Aubry", datePlanifiee: "2027-03-02", creneauDebut: "matin", dureeDemiJournees: 1 },
    ],
    "2026-11-03",
    "2027-02-28"
  );
  assert.deepEqual(porte, {
    "2026-11-12:apres_midi": ["M. Lefèvre"],
    "2026-11-13:matin": ["Banque"],
    "2026-11-13:apres_midi": ["Banque"],
    "2026-11-16:apres_midi": ["Mme Costa"],
  });
});

if (echecs > 0) {
  console.log(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ L'hivernage : la saison, la goutte et ses questions tiennent.");
