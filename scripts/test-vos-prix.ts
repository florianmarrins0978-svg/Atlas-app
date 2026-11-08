/* =======================================================================
   Vos prix : rangés par SES tarifs, ce que rapporte une journée d'équipe,
   la part des devis signés, et deux conseils au plus.

   Sa planche du 8 novembre 2026, et sa question : « si c'est un électricien
   qui a marqué tableau électrique, la nomenclature va changer ? ». Les
   règles pures (`src/lib/vos-prix.ts`) s'éprouvent ici, sans base.
   ======================================================================= */
import assert from "node:assert/strict";
import {
  conseilsDePrix,
  dixPourCentDePlus,
  parJourneeNecessaire,
  presqueToutSigne,
  prixParTarif,
  tarifDeLaLigne,
  tarifDuChantier,
  type ChantierPourPrix,
  type TarifPourPrix,
} from "../src/lib/vos-prix";

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

const euros = (n: number) => n * 100;
const tarif = (id: string, intitule: string, unite: string | null = null): TarifPourPrix => ({ id, intitule, prix: "100.00", unite });
const ligne = (libelle: string, eurosHt: number, mainDoeuvre = false) => ({ libelle, centimes: euros(eurosHt), mainDoeuvre });

const TARIFS = [tarif("tonte", "Tonte"), tarif("haie", "Taille de haie"), tarif("abattage", "Abattage"), tarif("mo", "Main d'œuvre", "jour/homme")];

console.log("Le tarif d'une ligne");

essai("un électricien voit SES mots : « Tableau électrique » range sa ligne", () => {
  const sesTarifs = [tarif("tab", "Tableau électrique"), tarif("prise", "Prise")];
  assert.equal(tarifDeLaLigne("Pose d'un tableau électrique 13 modules", sesTarifs), "tab");
});

essai("une ligne qui répond à deux tarifs n'est à personne : rien ne se devine", () => {
  assert.equal(tarifDeLaLigne("Tonte et taille de haie", TARIFS), null);
  assert.equal(tarifDeLaLigne("Plantation d'un olivier", TARIFS), null);
});

essai("le tarif de main d'œuvre au jour ne range rien : il va avec tous les travaux", () => {
  assert.equal(tarifDeLaLigne("Main d'œuvre", TARIFS), null);
});

console.log("Le tarif d'un chantier");

essai("plus de la moitié du montant, main d'œuvre comprise dans le total", () => {
  assert.equal(tarifDuChantier([ligne("Tonte 1 200 m²", 300), ligne("Main d'œuvre", 200, true)], TARIFS), "tonte");
  assert.equal(tarifDuChantier([ligne("Tonte 1 200 m²", 200), ligne("Main d'œuvre", 200, true)], TARIFS), null);
});

essai("un chantier partagé entre plusieurs travaux n'en range aucun", () => {
  assert.equal(tarifDuChantier([ligne("Tonte", 100), ligne("Taille de haie", 100), ligne("Abattage", 100)], TARIFS), null);
  assert.equal(tarifDuChantier([], TARIFS), null);
});

console.log("Ce que rapporte une journée, et les devis signés");

const chantier = (libelle: string, factureEuros: number | null, demi: number | null, reponse?: ChantierPourPrix["reponse"]): ChantierPourPrix => ({
  lignes: [ligne(libelle, factureEuros ?? 500)],
  factureHt: factureEuros === null ? null : euros(factureEuros),
  demiJournees: demi,
  ...(reponse !== undefined ? { reponse } : {}),
});

essai("le facturé divisé par les journées réservées au planning", () => {
  const prix = prixParTarif([chantier("Tonte", 340, 2, "acceptee"), chantier("Tonte", 340, 2, "acceptee"), chantier("Abattage", 1960, 4, "refusee")], TARIFS);
  const tonte = prix.find((p) => p.tarifId === "tonte")!;
  assert.equal(tonte.parJournee, euros(340));
  assert.equal(tonte.chantiers, 2);
  assert.deepEqual([tonte.signes, tonte.envoyes], [2, 2]);
  assert.equal(prix.find((p) => p.tarifId === "abattage")!.parJournee, euros(980));
});

essai("un chantier sans durée compte au facturé, pas à la journée", () => {
  const prix = prixParTarif([chantier("Tonte", 340, null), chantier("Tonte", 340, 2)], TARIFS);
  assert.equal(prix[0].facture, euros(680));
  assert.equal(prix[0].parJournee, euros(340));
  assert.equal(prixParTarif([chantier("Tonte", 340, null)], TARIFS)[0].parJournee, null);
});

essai("un devis envoyé mais pas encore facturé compte aux signés, pas au facturé", () => {
  const prix = prixParTarif([chantier("Tonte", null, 2, null)], TARIFS);
  assert.deepEqual([prix[0].chantiers, prix[0].envoyes, prix[0].signes], [0, 1, 0]);
});

essai("pour 300 000 € avec deux équipes, une journée doit rapporter 595 €", () => {
  assert.equal(Math.round(parJourneeNecessaire(euros(300000), 252, 2)! / 100), 595);
  assert.equal(parJourneeNecessaire(null, 252, 2), null);
});

console.log("Les conseils");

const signes = (libelle: string, n: number, sur: number): ChantierPourPrix[] =>
  Array.from({ length: sur }, (_, i) => chantier(libelle, null, null, i < n ? "acceptee" : "refusee"));

essai("le travail le moins rentable sous ce qu'il faut, et un AUTRE presque toujours signé", () => {
  const prix = prixParTarif(
    [chantier("Tonte", 340, 2), chantier("Taille de haie", 540, 2), chantier("Abattage", 980, 2), ...signes("Abattage", 13, 14)],
    TARIFS
  );
  const c = conseilsDePrix(prix, euros(600));
  assert.equal(c.bas?.tarifId, "tonte");
  assert.equal(c.signe?.tarifId, "abattage");
  assert.equal(dixPourCentDePlus(c.bas!), euros(34));
});

essai("les deux signaux sur le même travail : il reste le seul conseil, et dit les deux", () => {
  const prix = prixParTarif([chantier("Tonte", 340, 2), ...signes("Tonte", 40, 41)], TARIFS);
  const c = conseilsDePrix(prix, euros(600));
  assert.equal(c.bas?.tarifId, "tonte");
  assert.equal(c.signe, null);
  assert.equal(presqueToutSigne(c.bas!), true);
});

essai("moins de huit envois ne concluent rien ; sans objectif, pas de « il en faut »", () => {
  const prix = prixParTarif(signes("Abattage", 5, 5), TARIFS);
  assert.equal(conseilsDePrix(prix, euros(600)).signe, null);
  assert.equal(conseilsDePrix(prixParTarif([chantier("Tonte", 340, 2)], TARIFS), null).bas, null);
});

if (echecs > 0) {
  console.log(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log("\nVos prix : tout est juste.");
