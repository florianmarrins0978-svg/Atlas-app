import assert from "node:assert/strict";
import {
  documentsManquants,
  echeance,
  memePlaque,
  normaliserPlaque,
  phraseDeLEcheance,
  phraseDeLecture,
  phraseDuRappel,
  rangerLecture,
  rappelsDesVehicules,
  refusDuDocumentVehicule,
  typeDuDocument,
  valeurAffichee,
  valeurDuChamp,
  type LectureDocumentVehicule,
} from "../src/lib/vehicules";
import { lireReponseDocumentVehicule } from "../src/lib/document-vehicule-lu";

/**
 * Les règles des véhicules de l'entreprise — sa planche du 14 octobre 2026
 * (`appli/vehicules-plus-simple.html`). Sans base, sans clé d'IA.
 *
 * Les chiffres sont ceux de la planche qu'il a validée : un contrôle technique
 * au 30 novembre, regardé le 14 octobre, le 18 novembre et le 2 décembre.
 */

let ok = 0;
function cas(nom: string, fn: () => void) {
  fn();
  ok++;
  console.log(`  ✓ ${nom}`);
}

const vide: LectureDocumentVehicule = {
  nature: null,
  plaque: null,
  modele: null,
  ptacKg: null,
  genre: null,
  assureur: null,
  numeroContrat: null,
  assistance: null,
  controleTechniqueAvant: null,
  pollutionAvant: null,
  contreVisiteAvant: null,
};

console.log("— Les rappels, au bon moment —");

cas("rien plus de deux mois avant", () => {
  assert.equal(echeance("2026-12-20", "2026-10-14"), null);
});
cas("deux mois avant : à passer dès maintenant, sans perdre un jour", () => {
  const e = echeance("2026-11-30", "2026-10-14");
  assert.equal(e?.ton, "calme");
  assert.equal(e?.texte, "À passer dès maintenant");
});
cas("quinze jours avant : doré", () => {
  const e = echeance("2026-11-30", "2026-11-18");
  assert.equal(e?.ton, "proche");
  assert.equal(e?.texte, "Plus que 12 jours");
});
cas("le dernier jour se dit", () => {
  assert.equal(echeance("2026-11-30", "2026-11-30")?.texte, "Dernier jour aujourd’hui");
});
cas("dépassé : rouge, et le compte des jours", () => {
  const e = echeance("2026-11-30", "2026-12-02");
  assert.equal(e?.ton, "depasse");
  assert.equal(e?.texte, "Dépassé depuis 2 jours");
});
cas("une contre-visite se montre tout de suite, même à plus de deux mois", () => {
  const r = rappelsDesVehicules(
    [{ id: "v", nom: "Camion benne", controleTechniqueAvant: null, pollutionAvant: null, contreVisiteAvant: "2026-12-20" }],
    "2026-10-14"
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].controle, "contre_visite");
});
cas("le plus pressé en haut, tous véhicules confondus", () => {
  const r = rappelsDesVehicules(
    [
      { id: "a", nom: "Camion benne", controleTechniqueAvant: "2026-11-30", pollutionAvant: "2027-11-30", contreVisiteAvant: null },
      { id: "b", nom: "Camion plateau", controleTechniqueAvant: "2027-12-20", pollutionAvant: "2026-12-20", contreVisiteAvant: null },
    ],
    "2026-11-18"
  );
  assert.deepEqual(
    r.map((x) => [x.vehiculeId, x.controle]),
    [
      ["a", "controle_technique"],
      ["b", "pollution"],
    ]
  );
  assert.equal(phraseDuRappel(r[0]), "Contrôle technique avant le 30 novembre. Plus que 12 jours.");
  // Sous le titre de la carte, qui nomme déjà le contrôle, il n'est pas répété.
  assert.equal(phraseDeLEcheance(r[0]), "Avant le 30 novembre. Plus que 12 jours.");
});
cas("une date qui n'existe pas ne pose aucun rappel", () => {
  assert.equal(echeance("2026-02-31", "2026-02-01"), null);
});

console.log("— La plaque —");

cas("« gh 412pk » s'écrit GH-412-PK", () => {
  assert.equal(normaliserPlaque("gh 412pk"), "GH-412-PK");
});
cas("une plaque d'avant 2009 garde sa forme", () => {
  assert.equal(normaliserPlaque("123 abc 75"), "123 ABC 75");
});
cas("tirets et espaces ne font pas deux plaques", () => {
  assert.ok(memePlaque("GH-412-PK", "gh 412 pk"));
  assert.ok(!memePlaque("GH-412-PK", "BR-551-XA"));
  assert.ok(!memePlaque("", ""));
});

console.log("— Ce qu'un papier lu remplit —");

const camion = (plaque: string) => ({ plaque, controleTechniqueAvant: null, pollutionAvant: null });

cas("un papier qu'Atlas ne reconnaît pas se DEMANDE, il ne se range pas", () => {
  assert.deepEqual(rangerLecture(camion("GH-412-PK"), null), { statut: "inconnu" });
  assert.deepEqual(rangerLecture(camion("GH-412-PK"), vide), { statut: "inconnu" });
});
cas("l'assurance d'un AUTRE camion ne range rien", () => {
  const r = rangerLecture(camion("GH-412-PK"), { ...vide, nature: "assurance", plaque: "BR551XA", assureur: "Mutuelle" });
  assert.deepEqual(r, { statut: "autre-vehicule", plaqueLue: "BR-551-XA" });
});
cas("la carte grise d'un véhicule neuf donne sa plaque", () => {
  const r = rangerLecture(null, {
    ...vide,
    nature: "carte_grise",
    plaque: "ek238rv",
    modele: "Renault Master",
    ptacKg: 3500,
    genre: "CTTE",
  });
  assert.equal(r.statut, "range");
  if (r.statut !== "range") return;
  assert.deepEqual(r.champs, { plaque: "EK-238-RV", modele: "Renault Master", ptacKg: 3500, genre: "CTTE" });
});
cas("seul ce qui est lu s'écrit : l'assurance ne touche pas aux dates", () => {
  const r = rangerLecture(camion("GH-412-PK"), { ...vide, nature: "assurance", assureur: "Mutuelle de l’Ouest", controleTechniqueAvant: "2027-01-01" });
  assert.equal(r.statut, "range");
  if (r.statut !== "range") return;
  assert.deepEqual(r.champs, { assureur: "Mutuelle de l’Ouest" });
});
cas("un procès-verbal sans contre-visite EFFACE celle d'avant", () => {
  const r = rangerLecture(camion("GH-412-PK"), { ...vide, nature: "controle_technique", controleTechniqueAvant: "2028-10-14", pollutionAvant: "2027-10-14" });
  assert.equal(r.statut, "range");
  if (r.statut !== "range") return;
  assert.equal(r.champs.contreVisiteAvant, null);
  assert.equal(r.champs.controleTechniqueAvant, "2028-10-14");
});
cas("un procès-verbal de contre-visite la pose", () => {
  const r = rangerLecture(camion("GH-412-PK"), { ...vide, nature: "controle_technique", contreVisiteAvant: "2026-12-14" });
  assert.equal(r.statut, "range");
  if (r.statut !== "range") return;
  assert.deepEqual(r.champs, { contreVisiteAvant: "2026-12-14" });
});
// Sa carte grise du 20 octobre 2026 (Amarok EH-467-GL) : le VERSO se
// refusait comme « autre véhicule », et aucune date de contrôle n'était prise.
cas("le verso d'une carte grise porte les dates des vignettes de contrôle", () => {
  const r = rangerLecture(camion("EH-467-GL"), {
    ...vide,
    nature: "carte_grise",
    plaque: "EH-467-GL",
    controleTechniqueAvant: "2028-09-20",
    pollutionAvant: "2027-09-20",
  });
  assert.equal(r.statut, "range");
  if (r.statut !== "range") return;
  assert.deepEqual(r.champs, { plaque: "EH-467-GL", controleTechniqueAvant: "2028-09-20", pollutionAvant: "2027-09-20" });
});
cas("une carte grise ne recule jamais une date de contrôle déjà plus tardive", () => {
  // Le recto imprime « VISITE AVANT LE 18/09/2027 » à son édition ; la vignette
  // collée depuis, au verso, dit 2028. L'ordre des photos ne doit rien changer.
  const r = rangerLecture(
    { plaque: "EH-467-GL", controleTechniqueAvant: "2028-09-20", pollutionAvant: "2027-09-20" },
    { ...vide, nature: "carte_grise", plaque: "EH-467-GL", modele: "Volkswagen Amarok", controleTechniqueAvant: "2027-09-18" }
  );
  assert.equal(r.statut, "range");
  if (r.statut !== "range") return;
  assert.deepEqual(r.champs, { plaque: "EH-467-GL", modele: "Volkswagen Amarok" });
});
cas("une carte grise ne pose jamais de contre-visite : une vignette barrée ne se lit pas sûrement", () => {
  const r = rangerLecture(camion("EH-467-GL"), { ...vide, nature: "carte_grise", contreVisiteAvant: "2026-11-20" });
  assert.equal(r.statut, "range");
  if (r.statut !== "range") return;
  assert.deepEqual(r.champs, {});
});
cas("la phrase dit combien de cases ont été remplies", () => {
  assert.equal(phraseDeLecture("carte_grise", 4), "Carte grise lue. 4 informations remplies, en doré. Une erreur ? Touchez la case.");
  assert.match(phraseDeLecture("assurance", 0), /aucune information/);
});

console.log("— La réponse du modèle —");

cas("une réponse complète se relit", () => {
  const lue = lireReponseDocumentVehicule(
    'Voici : {"nature":"carte_grise","plaque":"GH-412-PK","marque_modele":"Renault Master","ptac_kg":"3 500","genre":"CTTE"}'
  );
  assert.equal(lue?.nature, "carte_grise");
  assert.equal(lue?.ptacKg, 3500);
  assert.equal(lue?.modele, "Renault Master");
});
cas("une réponse qui n'est pas du JSON ne se lit pas", () => {
  assert.equal(lireReponseDocumentVehicule("je ne sais pas"), null);
  assert.equal(lireReponseDocumentVehicule("{pas du json}"), null);
});
cas("une nature inventée vaut « inconnu »", () => {
  assert.equal(lireReponseDocumentVehicule('{"nature":"permis"}')?.nature, null);
});
cas("une date qui n'existe pas ne passe pas", () => {
  const lue = lireReponseDocumentVehicule('{"nature":"controle_technique","controle_technique_avant":"2026-02-31"}');
  assert.equal(lue?.controleTechniqueAvant, null);
});
cas("le numéro de formule du verso n'est pas une plaque", () => {
  // « 2025EJ72653 » est imprimé juste au-dessus de « (A) Numéro
  // d'immatriculation » : lu comme plaque, il faisait refuser le verso.
  assert.equal(lireReponseDocumentVehicule('{"nature":"carte_grise","plaque":"2025EJ72653"}')?.plaque, null);
  assert.equal(lireReponseDocumentVehicule('{"nature":"carte_grise","plaque":"S078T183"}')?.plaque, null);
  assert.equal(lireReponseDocumentVehicule('{"nature":"carte_grise","plaque":"EH-467-GL"}')?.plaque, "EH-467-GL");
  assert.equal(lireReponseDocumentVehicule('{"nature":"carte_grise","plaque":"123 ABC 75"}')?.plaque, "123 ABC 75");
  assert.equal(lireReponseDocumentVehicule('{"nature":"carte_grise","plaque":"4521 AB 2A"}')?.plaque, "4521 AB 2A");
});
cas("« null » écrit en toutes lettres vaut null", () => {
  assert.equal(lireReponseDocumentVehicule('{"nature":"assurance","assureur":"null"}')?.assureur, null);
});

console.log("— Une case corrigée à la main —");

cas("le nom ne se vide pas", () => {
  assert.equal(valeurDuChamp("nom", "  ").ok, false);
});
cas("une case vidée vaut null", () => {
  assert.deepEqual(valeurDuChamp("assureur", " "), { ok: true, valeur: null });
});
cas("une date fausse se refuse, une vraie passe", () => {
  assert.equal(valeurDuChamp("controleTechniqueAvant", "2026-02-31").ok, false);
  assert.deepEqual(valeurDuChamp("controleTechniqueAvant", "2026-11-30"), { ok: true, valeur: "2026-11-30" });
});
cas("le poids se lit en kilos", () => {
  assert.deepEqual(valeurDuChamp("ptacKg", "3 500 kg"), { ok: true, valeur: 3500 });
  assert.equal(valeurDuChamp("ptacKg", "3,5").ok, false);
});
cas("le poids s'affiche en kilos, et se relit tel quel", () => {
  assert.equal(valeurAffichee("ptacKg", 3500), "3 500 kg");
  assert.deepEqual(valeurDuChamp("ptacKg", valeurAffichee("ptacKg", 3500)), { ok: true, valeur: 3500 });
  assert.equal(valeurAffichee("assureur", null), "");
});
cas("la plaque se remet en forme", () => {
  assert.deepEqual(valeurDuChamp("plaque", "gh412pk"), { ok: true, valeur: "GH-412-PK" });
});
cas("l'assistance doit être un numéro", () => {
  assert.equal(valeurDuChamp("assistance", "appeler Paul").ok, false);
  assert.deepEqual(valeurDuChamp("assistance", "01 23 45 67 89"), { ok: true, valeur: "01 23 45 67 89" });
});

console.log("— Le fichier —");

cas("PDF, JPEG, PNG ; rien d'autre", () => {
  assert.equal(refusDuDocumentVehicule("application/pdf", 1000), null);
  assert.ok(refusDuDocumentVehicule("image/svg+xml", 1000));
  assert.ok(refusDuDocumentVehicule("image/heic", 1000));
  assert.ok(refusDuDocumentVehicule("image/jpeg", 0));
  assert.ok(refusDuDocumentVehicule("image/jpeg", 9 * 1024 * 1024));
});
cas("le type servi vient de l'extension posée par le serveur, jamais d'ailleurs", () => {
  assert.equal(typeDuDocument("entreprises/x/vehicules/a.pdf"), "application/pdf");
  assert.equal(typeDuDocument("entreprises/x/vehicules/a.jpg"), "image/jpeg");
  assert.equal(typeDuDocument("entreprises/x/vehicules/a.svg"), null);
  assert.equal(typeDuDocument("entreprises/x/vehicules/a"), null);
});
cas("ce qui manque se dit avec son article", () => {
  assert.deepEqual(documentsManquants(["carte_grise"]), ["l’assurance", "le contrôle technique"]);
  assert.deepEqual(documentsManquants(["carte_grise", "assurance", "controle_technique"]), []);
});

console.log(`\n${ok} vérifications vertes.`);
