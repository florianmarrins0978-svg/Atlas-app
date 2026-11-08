import assert from "node:assert/strict";
import {
  NATURE_DES_SERVICES,
  acquitteDansLAnnee,
  anneeDesAttestations,
  calculerLAttestation,
  ceQuiManqueALAttestation,
  contenuDeLAttestationFiscale,
  empreinteDeLAttestation,
  etatDeLAttestation,
  phraseDeLaLigne,
  resumeDuClient,
  type ClientAttestation,
  type FactureAttestable,
  type HeureEnregistree,
  type Organisme,
} from "../src/lib/attestation-fiscale";

/**
 * L'ATTESTATION FISCALE DE SES CLIENTS : la règle pure (le crédit d'impôt, lot 2).
 *
 * Planche `appli/soignee/credit-d-impot.html`, « L'attestation », et la page
 * officielle « Les obligations réglementaires » (servicesalapersonne.gouv.fr,
 * lue le 8 novembre 2026). Ce que cette suite défend : **rien ne s'atteste
 * qui ne soit vrai.** Un euro de trop, une durée devinée, un intervenant sans
 * nom, un « Mr. » posé devant le nom d'une cliente : sur ce papier-là, ils
 * partent aux impôts.
 */

let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** L'espace insécable d'`enEuros`, pour comparer sans se tromper d'espace. */
const nbsp = (t: string) => t.replace(/[  ]/g, " ");

function facture(p: Partial<FactureAttestable> & { id: string; reglements: FactureAttestable["reglements"] }): FactureAttestable {
  return {
    numero: `F2026-${p.id}`,
    chantierId: `ch-${p.id}`,
    dateEmission: "2026-03-12",
    totalHt: "420.00",
    totalTva: "84.00",
    totalTtc: "504.00",
    avoirs: [],
    ...p,
  };
}

const ORGANISME: Organisme = {
  nom: "Jardins Démo",
  adresse: "4 rue des Tilleuls, 49000 Angers",
  numero: "SAP123456789",
  declareeLe: "2024-03-12",
  signataire: { nom: "Thomas Leroy", civilite: "mr" },
};
const VASSEUR: ClientAttestation = { nom: "Vasseur", civilite: "mme", adresse: "8 allée des Chênes, 49100 Angers" };

const F1 = facture({ id: "1", reglements: [{ date: "2026-03-20", montant: "504.00", moyen: "virement" }] });
const F2 = facture({ id: "2", reglements: [{ date: "2026-05-20", montant: "504.00", moyen: "cheque" }] });
const HEURES: HeureEnregistree[] = [
  { chantierId: "ch-2", jour: "2026-05-14", minutes: 180, numero: 2, nom: "Roux Léa" },
  { chantierId: "ch-1", jour: "2026-03-12", minutes: 150, numero: 1, nom: "Martin Julien" },
  { chantierId: "ch-2", jour: "2026-05-14", minutes: 180, numero: 1, nom: "Martin Julien" },
  // Un chantier qui n'est sur aucune facture comptée : il ne paraît pas.
  { chantierId: "ch-9", jour: "2026-06-01", minutes: 60, numero: 1, nom: "Martin Julien" },
];
const NOMS = new Map<number, string>([
  [1, "Martin Julien"],
  [2, "Roux Léa"],
]);

console.log("=== L'attestation fiscale ===");

cas("la saison : du 1er janvier au 31 mars, les attestations de l'année d'avant", () => {
  assert.equal(anneeDesAttestations("2027-01-01"), 2026);
  assert.equal(anneeDesAttestations("2027-03-31"), 2026);
  assert.equal(anneeDesAttestations("2027-04-01"), null);
  assert.equal(anneeDesAttestations("2026-12-31"), null);
  assert.equal(anneeDesAttestations("pas une date"), null);
});

cas("le montant de l'année : les règlements DATÉS de l'année, pas la facture", () => {
  const f = facture({
    id: "x",
    reglements: [
      { date: "2025-12-20", montant: "100.00", moyen: "virement" },
      { date: "2026-01-10", montant: "300.00", moyen: "virement" },
      { date: "2027-01-05", montant: "104.00", moyen: "virement" },
    ],
  });
  assert.equal(acquitteDansLAnnee(f, 2026), "300.00");
  assert.equal(acquitteDansLAnnee(f, 2025), "100.00");
});

cas("jamais plus que la facture, avoirs retirés et ce qui était réglé avant déduit", () => {
  const avecAvoir = facture({
    id: "a",
    avoirs: [{ numero: "A1", date: "2026-04-01", ht: "83.33", tva: "16.67", ttc: "100.00" }],
    reglements: [{ date: "2026-03-20", montant: "504.00", moyen: "virement" }],
  });
  assert.equal(acquitteDansLAnnee(avecAvoir, 2026), "404.00");
  const aCheval = facture({
    id: "b",
    reglements: [
      { date: "2025-12-20", montant: "300.00", moyen: "virement" },
      { date: "2026-01-10", montant: "300.00", moyen: "virement" },
    ],
  });
  assert.equal(acquitteDansLAnnee(aCheval, 2026), "204.00");
});

const CALCUL = calculerLAttestation({ annee: 2026, factures: [F1, F2], heures: HEURES, nomsActuels: NOMS });

cas("le montant d'un client additionne ses factures, et ses moyens se disent dans l'ordre", () => {
  assert.equal(CALCUL.montant, "1008.00");
  assert.deepEqual(CALCUL.moyens, ["virement", "cheque"]);
});

cas("une intervention par ligne, par date puis par numéro, seulement sur les chantiers payés", () => {
  assert.deepEqual(
    CALCUL.interventions.map((i) => `${i.jour} ${i.numero}`),
    ["2026-03-12 1", "2026-05-14 1", "2026-05-14 2"]
  );
  assert.deepEqual(CALCUL.facturesSansHeures, []);
});

cas("un moyen « autre » ne se devine pas : la phrase n'en dit aucun", () => {
  const f = facture({ id: "z", reglements: [{ date: "2026-02-01", montant: "504.00", moyen: "autre" }] });
  const c = calculerLAttestation({ annee: 2026, factures: [F1, f], heures: HEURES, nomsActuels: NOMS });
  assert.equal(c.moyens, null);
  assert.equal(nbsp(contenuDeLAttestationFiscale(ORGANISME, VASSEUR, c, "2027-01-12").total.libelle), "Payé en 2026");
});

cas("L'AVANCE IMMÉDIATE NE S'ATTESTE PAS : l'Urssaf a déjà avancé la moitié (lot 3)", () => {
  // Versée par l'Urssaf, la facture est réglée en entier ; la compter ici
  // ferait déclarer au client un crédit qu'il a déjà touché.
  const parLUrssaf = facture({ id: "ai", reglements: [{ date: "2026-04-14", montant: "504.00", moyen: "avance_immediate" }] });
  assert.equal(acquitteDansLAnnee(parLUrssaf, 2026), "0.00");
  const c = calculerLAttestation({ annee: 2026, factures: [F1, parLUrssaf], heures: HEURES, nomsActuels: NOMS });
  assert.equal(c.montant, "504.00", "seule la facture payée par virement compte");
  assert.deepEqual(c.moyens, ["virement"], "la phrase ne dit pas l'avance immédiate");
});

cas("UNE FACTURE SANS HEURES N'INVENTE PAS DE DURÉE : elle est nommée, l'attestation reste à compléter", () => {
  const c = calculerLAttestation({ annee: 2026, factures: [F1, F2], heures: HEURES.filter((h) => h.chantierId !== "ch-2"), nomsActuels: NOMS });
  assert.deepEqual(c.facturesSansHeures, ["F2026-2"]);
  assert.equal(c.interventions.length, 1, "une durée a été inventée");
  const manques = ceQuiManqueALAttestation(ORGANISME, VASSEUR, c);
  assert.ok(manques.includes("Aucune heure enregistrée pour la facture F2026-2."), manques.join(" | "));
});

cas("un nom tapé plus tard sous le même numéro sert ; sans aucun nom, il manque", () => {
  const sansNom: HeureEnregistree[] = [{ chantierId: "ch-1", jour: "2026-03-12", minutes: 150, numero: 3, nom: null }];
  const avecNomActuel = calculerLAttestation({ annee: 2026, factures: [F1], heures: sansNom, nomsActuels: new Map([[3, "Petit Marc"]]) });
  assert.equal(avecNomActuel.interventions[0]?.nom, "Petit Marc");
  const rien = calculerLAttestation({ annee: 2026, factures: [F1], heures: sansNom, nomsActuels: NOMS });
  assert.equal(rien.interventions[0]?.nom, null);
  assert.ok(ceQuiManqueALAttestation(ORGANISME, VASSEUR, rien).includes("Le nom de l'intervenant n° 3 manque, dans Équipe."));
  const patron = calculerLAttestation({ annee: 2026, factures: [F1], heures: [{ ...sansNom[0]!, numero: 0 }], nomsActuels: NOMS });
  assert.ok(ceQuiManqueALAttestation(ORGANISME, VASSEUR, patron).includes("Votre nom manque, dans Mon compte."));
});

cas("ce que la loi demande manque : l'adresse, le numéro, la date, l'adresse du client", () => {
  const manques = ceQuiManqueALAttestation(
    { ...ORGANISME, adresse: null, numero: "SAP12", declareeLe: null },
    { ...VASSEUR, adresse: "  " },
    CALCUL
  );
  assert.deepEqual(manques, [
    "L'adresse de l'entreprise manque, dans Mon entreprise.",
    "Le numéro de déclaration manque, dans Mon entreprise.",
    "La date de la déclaration manque, dans Mon entreprise.",
    "L'adresse de Mme Vasseur manque, sur sa fiche.",
  ]);
  assert.deepEqual(ceQuiManqueALAttestation(ORGANISME, VASSEUR, CALCUL), []);
});

const EMPREINTE = empreinteDeLAttestation(ORGANISME, VASSEUR, CALCUL);

cas("l'état : envoyée tant qu'elle est pareille, à renvoyer dès qu'elle change", () => {
  assert.equal(etatDeLAttestation([], EMPREINTE, null), "a_envoyer");
  assert.equal(etatDeLAttestation([], EMPREINTE, EMPREINTE), "envoyee");
  assert.equal(etatDeLAttestation([], EMPREINTE, "00000000"), "a_renvoyer");
  assert.equal(etatDeLAttestation(["L'adresse manque."], EMPREINTE, null), "a_completer");
  assert.equal(etatDeLAttestation(["L'adresse manque."], EMPREINTE, "00000000"), "a_completer");
});

cas("l'empreinte suit ce que le papier affirme, et rien d'autre", () => {
  assert.match(EMPREINTE, /^[0-9a-f]{8}$/);
  assert.equal(empreinteDeLAttestation(ORGANISME, VASSEUR, CALCUL), EMPREINTE);
  const plus = calculerLAttestation({
    annee: 2026,
    factures: [F1, { ...F2, reglements: [{ date: "2026-05-20", montant: "500.00", moyen: "cheque" }] }],
    heures: HEURES,
    nomsActuels: NOMS,
  });
  assert.notEqual(empreinteDeLAttestation(ORGANISME, VASSEUR, plus), EMPREINTE, "un montant qui change ne change rien");
  assert.notEqual(empreinteDeLAttestation(ORGANISME, { ...VASSEUR, adresse: "1 rue Neuve, 49000 Angers" }, CALCUL), EMPREINTE);
});

cas("la ligne de Terminés compte ce qui reste, puis « Toutes envoyées »", () => {
  assert.deepEqual(phraseDeLaLigne(["a_envoyer", "envoyee", "a_completer", "a_renvoyer"]), {
    texte: "3 à envoyer, avant le 31 mars",
    ton: "ambre",
  });
  assert.deepEqual(phraseDeLaLigne(["envoyee", "envoyee"]), { texte: "Toutes envoyées", ton: "vert" });
  assert.equal(nbsp(resumeDuClient(CALCUL)), "3 interventions, 1 008,00 €");
});

const PAPIER = contenuDeLAttestationFiscale(ORGANISME, VASSEUR, CALCUL, "2027-01-12");

cas("le papier : l'organisme, sa déclaration, le titre de l'année", () => {
  assert.equal(PAPIER.entete.nom, "Jardins Démo");
  assert.deepEqual(PAPIER.entete.lignes, ["4 rue des Tilleuls, 49000 Angers", "Déclaration SAP123456789 du 12 mars 2024"]);
  assert.equal(PAPIER.titre, "Attestation fiscale 2026");
});

cas("la phrase de la planche, sans titre inventé au signataire", () => {
  assert.equal(
    PAPIER.phrase,
    `Je soussigné Thomas Leroy, pour Jardins Démo, certifie que Mme Vasseur, 8 allée des Chênes, 49100 Angers, a bénéficié à son domicile de ${NATURE_DES_SERVICES}.`
  );
  const elle = contenuDeLAttestationFiscale({ ...ORGANISME, signataire: { nom: "Anne Leroy", civilite: "mme" } }, VASSEUR, CALCUL, "2027-01-12");
  assert.ok(elle.phrase.startsWith("Je soussignée Anne Leroy, pour Jardins Démo,"));
  const personne = contenuDeLAttestationFiscale({ ...ORGANISME, signataire: null }, VASSEUR, CALCUL, "2027-01-12");
  assert.ok(personne.phrase.startsWith("Jardins Démo certifie que Mme Vasseur,"));
});

cas("JAMAIS le « Mr. » par défaut devant un client dont la civilité n'est pas dite", () => {
  const p = contenuDeLAttestationFiscale(ORGANISME, { ...VASSEUR, civilite: null }, CALCUL, "2027-01-12");
  assert.ok(p.phrase.includes("certifie que Vasseur, 8 allée"), p.phrase);
  assert.ok(!p.phrase.includes("Mr."));
});

cas("le tableau : date, durée, le nom puis le numéro", () => {
  assert.deepEqual(PAPIER.lignes[0], { date: "12 mars", duree: "2 h 30", nom: "Martin Julien", numero: "n° 1" });
  assert.deepEqual(PAPIER.lignes[2], { date: "14 mai", duree: "3 h", nom: "Roux Léa", numero: "n° 2" });
  const decembre = calculerLAttestation({
    annee: 2026,
    factures: [F1],
    heures: [{ chantierId: "ch-1", jour: "2025-12-18", minutes: 120, numero: 1, nom: "Martin Julien" }],
    nomsActuels: NOMS,
  });
  assert.equal(contenuDeLAttestationFiscale(ORGANISME, VASSEUR, decembre, "2027-01-12").lignes[0]?.date, "18 décembre 2025");
});

cas("le montant acquitté, ses moyens, le lieu et la date", () => {
  assert.equal(nbsp(PAPIER.total.libelle), "Payé en 2026, par virement et par chèque");
  assert.equal(nbsp(PAPIER.total.montant), "1 008,00 €");
  assert.equal(PAPIER.lieuEtDate, "Angers, le 12 janvier 2027");
  const sansVille = contenuDeLAttestationFiscale({ ...ORGANISME, adresse: "Le Bourg" }, VASSEUR, CALCUL, "2027-01-12");
  assert.equal(sansVille.lieuEtDate, "Le 12 janvier 2027");
});

cas("aucun repli d'écran ne part sur le papier", () => {
  const texte = JSON.stringify(PAPIER);
  assert.ok(!/Salarié \d|"Vous"/.test(texte), texte);
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log("\nCe qui s'atteste a été payé, fait, et nommé.");
