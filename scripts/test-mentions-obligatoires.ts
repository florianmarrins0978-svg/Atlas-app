import assert from "node:assert/strict";
import {
  contenuDecennale,
  contenuMediateur,
  lignesMentionsObligatoires,
} from "../src/lib/mentions-obligatoires";
import {
  CROCHET_DECENNALE,
  CROCHET_MEDIATEUR,
  TEXTE_ORIGINE_CONDITIONS_GENERALES,
  conditionsGeneralesRemplies,
  crochetsRestants,
} from "../src/lib/conditions-generales";

/**
 * LA DÉCENNALE ET LE MÉDIATEUR — son accord du 14 septembre 2026, codé le 16.
 *
 * Ce que cette suite défend, et pourquoi chaque cas y est : **rien ne
 * s'invente**. Une mention d'assurance incomplète part chez un client et y
 * reste ; un crochet vide vaut mieux qu'une phrase qui s'achève sur un
 * deux-points. C'est la règle de `docs/AGENT.md` §3, appliquée à deux mentions
 * que la loi attend d'un devis à un particulier.
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

const COMPLET = {
  assureurDecennale: "AXA",
  contratDecennale: "0000020872696404",
  couvertureDecennale: "France métropolitaine",
  mediateurNom: "CM2C",
  mediateurCoordonnees: "49 rue de Ponthieu, 75008 Paris",
};

console.log("\n— Ce qui s'imprime, et ce qui ne s'imprime pas —");

cas("les deux mentions, complètes", () => {
  assert.deepEqual(lignesMentionsObligatoires(COMPLET), [
    "Assurance décennale : AXA, contrat n° 0000020872696404, France métropolitaine.",
    "Médiateur de la consommation : CM2C, 49 rue de Ponthieu, 75008 Paris.",
  ]);
});

cas("RIEN n'est saisi : rien ne s'imprime, pas une phrase à trou", () => {
  assert.deepEqual(lignesMentionsObligatoires({}), []);
  assert.deepEqual(lignesMentionsObligatoires({ assureurDecennale: "   " }), []);
});

cas("un numéro de contrat SANS assureur ne s'imprime pas", () => {
  // Il ne désigne aucune compagnie : imprimé seul, il ne prouve rien et ne se
  // vérifie pas. C'est le nom qui commande.
  assert.equal(contenuDecennale({ contratDecennale: "123", couvertureDecennale: "France" }), null);
  assert.deepEqual(lignesMentionsObligatoires({ contratDecennale: "123" }), []);
});

cas("une adresse de médiateur SANS nom ne s'imprime pas", () => {
  assert.equal(contenuMediateur({ mediateurCoordonnees: "49 rue de Ponthieu" }), null);
});

cas("l'assureur seul suffit, et s'imprime seul", () => {
  assert.deepEqual(lignesMentionsObligatoires({ assureurDecennale: "MMA" }), [
    "Assurance décennale : MMA.",
  ]);
});

cas("une seule des deux peut manquer sans emporter l'autre", () => {
  assert.deepEqual(lignesMentionsObligatoires({ mediateurNom: "CM2C" }), [
    "Médiateur de la consommation : CM2C.",
  ]);
});

console.log("\n— Les articles 9 et 11 se remplissent tout seuls —");

cas("les deux crochets disparaissent quand les champs sont là", () => {
  const rempli = conditionsGeneralesRemplies(TEXTE_ORIGINE_CONDITIONS_GENERALES, COMPLET);
  assert.equal(crochetsRestants(rempli), 0, "il reste un crochet dans un texte pourtant renseigné");
  assert.ok(rempli.includes("d’une assurance décennale : AXA, contrat n° 0000020872696404, France métropolitaine."));
  assert.ok(rempli.includes("le médiateur de la consommation : CM2C, 49 rue de Ponthieu, 75008 Paris."));
});

cas("un crochet dont la valeur MANQUE reste un crochet", () => {
  // C'est ce qui le rend visible dans les réglages. Le faire disparaître à vide
  // laisserait partir « d'une assurance décennale : . » chez un client.
  const vide = conditionsGeneralesRemplies(TEXTE_ORIGINE_CONDITIONS_GENERALES, {});
  assert.equal(crochetsRestants(vide), 2);
  assert.ok(vide.includes(CROCHET_DECENNALE));
  assert.ok(vide.includes(CROCHET_MEDIATEUR));
});

cas("l'un rempli, l'autre non : un seul crochet reste", () => {
  const moitie = conditionsGeneralesRemplies(TEXTE_ORIGINE_CONDITIONS_GENERALES, {
    assureurDecennale: "AXA",
  });
  assert.equal(crochetsRestants(moitie), 1);
  assert.ok(!moitie.includes(CROCHET_DECENNALE));
  assert.ok(moitie.includes(CROCHET_MEDIATEUR));
});

cas("un texte qu'il a réécrit sans crochets sort intact", () => {
  const sien = "Mes conditions à moi. Paiement à 30 jours.";
  assert.equal(conditionsGeneralesRemplies(sien, COMPLET), sien);
});

cas("un texte vide reste vide — on n'imprime pas même le titre", () => {
  assert.equal(conditionsGeneralesRemplies("", COMPLET), "");
  assert.equal(conditionsGeneralesRemplies(null, COMPLET), "");
});

cas("les crochets ne sont écrits qu'UNE fois dans le dépôt", () => {
  // Le texte d'origine les compose à partir des constantes : deux écritures de
  // la même chaîne auraient vieilli séparément, et la substitution aurait cessé
  // de trouver ce qu'elle remplace — sans que rien ne rougisse.
  assert.ok(TEXTE_ORIGINE_CONDITIONS_GENERALES.includes(CROCHET_DECENNALE));
  assert.ok(TEXTE_ORIGINE_CONDITIONS_GENERALES.includes(CROCHET_MEDIATEUR));
  assert.equal(crochetsRestants(TEXTE_ORIGINE_CONDITIONS_GENERALES), 2, "le texte d'origine doit porter exactement ses deux crochets");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La décennale et le médiateur — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
