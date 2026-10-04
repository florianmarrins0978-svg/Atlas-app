import assert from "node:assert/strict";
import { manquesDeLaFacture, manquesDuDevis, phraseDesManques, type EmetteurAVerifier } from "../src/lib/mentions-manquantes";
import { CROCHET_DECENNALE } from "../src/lib/conditions-generales";
import {
  MENTION_AUTOLIQUIDATION,
  numeroTvaLu,
  tauxRendus,
  tauxSousAutoliquidation,
} from "../src/lib/autoliquidation";
import { dateDesTravauxProposee } from "../src/lib/creneaux-chantier";
import { totauxAvecReduction } from "../src/lib/reduction-devis";
import { avecCivilite, estUneEntreprise } from "../src/lib/civilite";
import { siretLu } from "../src/lib/siren";
import { TEXTE_ORIGINE_CONDITIONS_GENERALES } from "../src/lib/conditions-generales";
import { lignesConditionsDevis, lireConditions } from "../src/lib/conditions-documents";

// ═══════════════════════════════════════════════════════════════════════════
// LE DEVIS ET LA FACTURE EN RÈGLE — ses choix du 3 octobre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// 1A : une mention obligatoire absente arrête la pièce. 5B : la sous-traitance
// sans TVA, le numéro du donneur d'ordre retenu et modifiable. 6A : la date des
// travaux proposée d'après le planning. Les règles vivent dans `src/lib/`, et
// se lisent ici sans base ni écran.

let ok = 0;
function cas(nom: string, fn: () => void) {
  fn();
  ok++;
  console.log(`  ✓ ${nom}`);
}

const EN_REGLE: EmetteurAVerifier = {
  nom: "Atelier Démo",
  adresse: "10 rue des Artisans, Nantes",
  siret: "123 456 789 00012",
  formeJuridique: "EI",
  capitalSocial: null,
  villeRcs: null,
  mediateurNom: "Médiateur",
  assureurDecennale: null,
  regimeTva: "assujettie",
  numeroTva: "FR12123456789",
  telephone: "02 40 00 00 00",
  email: "contact@atelier-demo.fr",
};
const CLIENT = { nom: "Bernard", adresse: "4 rue de la Garenne, Rezé", adresseChantier: null };
const SANS = { active: false, numeroTvaClient: null };

console.log("— Ce qui manque au devis —");

cas("une entreprise en règle et un client nommé : rien ne manque", () => {
  assert.deepEqual(manquesDuDevis(EN_REGLE, CLIENT, ""), []);
});

cas("le SIRET et la forme oubliés se nomment, avec leur porte", () => {
  const m = manquesDuDevis({ ...EN_REGLE, siret: " ", formeJuridique: null }, CLIENT, "");
  assert.deepEqual(m.map((x) => [x.cle, x.ou]), [["siret", "entreprise"], ["forme", "entreprise"]]);
});

cas("une société sans capital ni ville du RCS ne part pas", () => {
  const m = manquesDuDevis({ ...EN_REGLE, formeJuridique: "SARL" }, CLIENT, "");
  assert.deepEqual(m.map((x) => x.cle), ["capital", "rcs"]);
});

cas("le médiateur manque au devis, jamais à la facture", () => {
  const sansMediateur = { ...EN_REGLE, mediateurNom: "" };
  assert.deepEqual(manquesDuDevis(sansMediateur, CLIENT, "").map((x) => x.cle), ["mediateur"]);
  assert.deepEqual(manquesDeLaFacture(sansMediateur, CLIENT, SANS), []);
});

cas("la décennale ne bloque que si ses conditions la citent encore entre crochets", () => {
  assert.deepEqual(manquesDuDevis(EN_REGLE, CLIENT, "9. Assurances.").map((x) => x.cle), []);
  assert.deepEqual(manquesDuDevis(EN_REGLE, CLIENT, `9. ${CROCHET_DECENNALE}.`).map((x) => x.cle), ["decennale"]);
});

cas("un devis dicté sans adresse de client part quand même", () => {
  assert.deepEqual(manquesDuDevis(EN_REGLE, { nom: "Bernard", adresse: null, adresseChantier: null }, ""), []);
});

console.log("— Ce qui manque à la facture —");

cas("sans adresse de client NI de chantier, la facture ne part pas", () => {
  const m = manquesDeLaFacture(EN_REGLE, { nom: "Bernard", adresse: "", adresseChantier: null }, SANS);
  assert.deepEqual(m.map((x) => [x.cle, x.ou]), [["client-adresse", "client"]]);
});

cas("l'adresse du chantier tient lieu de celle du client", () => {
  assert.deepEqual(manquesDeLaFacture(EN_REGLE, { nom: "Bernard", adresse: null, adresseChantier: "Rezé" }, SANS), []);
});

cas("un assujetti sans numéro de TVA ne facture pas ; en franchise, il n'en a pas besoin", () => {
  assert.deepEqual(manquesDeLaFacture({ ...EN_REGLE, numeroTva: null }, CLIENT, SANS).map((x) => x.cle), ["tva"]);
  assert.deepEqual(manquesDeLaFacture({ ...EN_REGLE, numeroTva: null, regimeTva: "franchise" }, CLIENT, SANS), []);
});

cas("en sous-traitance, le numéro du donneur d'ordre se saisit sur la pièce", () => {
  const m = manquesDeLaFacture(EN_REGLE, CLIENT, { active: true, numeroTvaClient: "" });
  assert.deepEqual(m.map((x) => [x.cle, x.ou]), [["tva-client", "piece"]]);
  assert.match(m[0]!.libelle, /Bernard/);
  assert.deepEqual(manquesDeLaFacture(EN_REGLE, CLIENT, { active: true, numeroTvaClient: "FR00123456789" }), []);
});

cas("la phrase du refus garde « SIRET » en capitales", () => {
  const m = manquesDuDevis({ ...EN_REGLE, siret: null }, CLIENT, "");
  assert.equal(phraseDesManques(m), "Il manque une mention obligatoire : votre SIRET.");
});

console.log("— La sous-traitance, sans TVA —");

const PIECE = {
  tauxTva: "20.00",
  lignes: [
    { id: "a", tauxTva: null },
    { id: "b", tauxTva: "10.00" },
  ],
};

cas("l'activer met tous les taux à zéro, et la facture n'a plus de TVA", () => {
  const sans = tauxSousAutoliquidation(PIECE);
  assert.equal(sans.tauxTva, "0.00");
  assert.deepEqual(sans.lignes.map((l) => l.tauxTva), ["0.00", "0.00"]);
  const t = totauxAvecReduction(
    [
      { montant: "1000.00", tauxTva: sans.lignes[0]!.tauxTva },
      { montant: "200.00", tauxTva: sans.lignes[1]!.tauxTva },
    ],
    sans.tauxTva,
    null
  );
  assert.equal(t.totalTva, "0.00");
  assert.equal(t.totalTtc, "1200.00");
});

cas("l'enlever rend chaque taux d'avant : la ligne à 10 % redevient à 10 %", () => {
  const sans = tauxSousAutoliquidation(PIECE);
  const pendant = { tauxTva: sans.tauxTva, lignes: [...sans.lignes, { id: "c", tauxTva: "0.00" }] };
  const rendus = tauxRendus(pendant, sans.avant, "20.00");
  assert.equal(rendus.tauxTva, "20.00");
  // « c », ajoutée pendant, retombe sur le taux de la facture.
  assert.deepEqual(rendus.lignes.map((l) => l.tauxTva), [null, "10.00", null]);
});

cas("sans taux gardés, rien ne se devine : le taux réglé revient", () => {
  assert.equal(tauxRendus(PIECE, null, "10.00").tauxTva, "10.00");
});

cas("la mention est celle de la maquette, mot pour mot", () => {
  assert.equal(MENTION_AUTOLIQUIDATION, "Autoliquidation : TVA due par le preneur, article 283-2 nonies du CGI.");
});

cas("un numéro de TVA se lit sans espaces ni points, et se refuse s'il n'en est pas un", () => {
  assert.equal(numeroTvaLu(" fr 12 345.678.901 "), "FR12345678901");
  assert.equal(numeroTvaLu("12345678901"), null);
  assert.equal(numeroTvaLu(""), null);
});

console.log("— La date des travaux, d'après le planning —");

cas("le dernier jour posé, quand il est passé", () => {
  const chantier = { jour: "2026-09-24", moment: "matin", dureeDemiJournees: 4 };
  // Deux journées, sautant le week-end s'il le faut : jeudi et vendredi.
  assert.equal(dateDesTravauxProposee(chantier, [], "2026-10-03"), "2026-09-25");
});

cas("les créneaux morcelés l'emportent sur le bloc", () => {
  const chantier = { jour: "2026-09-24", moment: "matin", dureeDemiJournees: 2 };
  const poses = [
    { jour: "2026-09-24", moment: "matin" as const },
    { jour: "2026-09-29", moment: "apres_midi" as const },
  ];
  assert.equal(dateDesTravauxProposee(chantier, poses, "2026-10-03"), "2026-09-29");
});

cas("jamais posé, ou posé plus tard qu'aujourd'hui : le jour où il facture", () => {
  assert.equal(dateDesTravauxProposee({ jour: null, moment: null, dureeDemiJournees: null }, [], "2026-10-03"), "2026-10-03");
  assert.equal(dateDesTravauxProposee({ jour: "2026-10-20", moment: "matin", dureeDemiJournees: 2 }, [], "2026-10-03"), "2026-10-03");
});

console.log("— Mr, Mme ou Entreprise (4 octobre 2026) —");

cas("Entreprise écrit le nom seul ; Mr et Mme restent ce qu'ils étaient", () => {
  assert.equal(avecCivilite("Jardins Ribault", "entreprise"), "Jardins Ribault");
  assert.equal(avecCivilite("Jardins Ribault", null), "Mr. Jardins Ribault");
  assert.equal(avecCivilite("Roux", "mme"), "Mme Roux");
});

cas("une entreprise : son choix d'abord, sinon un mot de société dans le nom", () => {
  assert.equal(estUneEntreprise("Jardins Ribault", "entreprise"), true);
  assert.equal(estUneEntreprise("Vert Bocage SARL", null), true);
  assert.equal(estUneEntreprise("Mairie de Rezé", undefined), true);
  assert.equal(estUneEntreprise("SARL Untel", "mr"), false, "son choix « Mr » doit primer");
  assert.equal(estUneEntreprise("Bernard", null), false);
  assert.equal(estUneEntreprise("Mme Roux", null), false, "une civilité n'est pas une société");
});

cas("un SIRET se lit en quatorze chiffres, ou se refuse", () => {
  assert.equal(siretLu("81234567800021"), "812 345 678 00021");
  assert.equal(siretLu(" 812 345 678 00021 "), "812 345 678 00021");
  assert.equal(siretLu(""), "");
  assert.equal(siretLu("812 345 678"), null, "un SIREN seul n'est pas un SIRET");
});

console.log("— Le check-up légal du 4 octobre 2026 —");

cas("le devis d'un particulier exige le téléphone et le courriel ; en sous-traitance, non", () => {
  const sans = { ...EN_REGLE, telephone: " ", email: null };
  assert.deepEqual(manquesDuDevis(sans, CLIENT, "").map((x) => x.cle), ["telephone", "email"]);
  assert.deepEqual(manquesDuDevis(sans, CLIENT, "", true), []);
  assert.deepEqual(manquesDeLaFacture(sans, CLIENT, SANS), [], "R111-1 vise l'information avant le contrat, pas la facture");
});

cas("les 40 € ne se réclament qu'à un client professionnel", () => {
  const c = lireConditions({ rappelerPenalites: true });
  assert.ok(!lignesConditionsDevis(c).some((l) => l.includes("40 €")), "réclamés à un particulier");
  assert.ok(lignesConditionsDevis(c, undefined, undefined, true).some((l) => l.includes("40 €")));
});

cas("les conditions d'origine ne portent plus les quatre clauses contraires au droit", () => {
  const t = TEXTE_ORIGINE_CONDITIONS_GENERALES;
  assert.ok(!t.includes("aucune réclamation"), "clause noire R212-1 6°");
  assert.ok(!t.includes("à titre indicatif"), "délai indicatif");
  assert.ok(!t.includes("annulation de la commande"), "report sans annulation");
  assert.match(t, /aucun paiement n’est reçu avant sept jours \(art\. L221-10/);
  assert.match(t, /pour un client professionnel, une indemnité forfaitaire de 40 €/);
  assert.match(t, /garantie légale de conformité/);
});

console.log(`\n${ok} vérifications vertes.`);
