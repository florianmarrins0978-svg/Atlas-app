import assert from "node:assert/strict";
import {
  demandePaiementPourUrssaf,
  etapeDeLaDemande,
  ibanBienForme,
  particulierPourUrssaf,
  type FactureAtlas,
  type ParticulierAtlas,
} from "../src/lib/urssaf/avance-immediate";

// Les règles de l'avance immédiate, sans réseau ni base.
//
// **Sa demande du 8 novembre 2026 :** *« faut surtout que tu codes déjà la
// liaison »*, et *« il faut être sûr que ça soit ça que l'URSSAF demande »*.
// La source est la description officielle de l'API Tiers de prestation
// (version 1.29.1). Chaque cas ci-dessous éprouve un motif qu'elle impose :
// un champ que l'Urssaf refuserait doit l'être ICI, en français, avant
// l'envoi. Et la réciproque : un client bien rempli doit passer, sinon le
// contrôle refuserait tout et ne prouverait rien.

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

/** Un client complet, aux formes de l'exemple officiel. */
function lambert(): ParticulierAtlas {
  return {
    civilite: "M",
    nomNaissance: "Lambert",
    prenoms: "Pierre",
    dateNaissance: "1961-04-12",
    naissance: { enFrance: true, departement: "044", codeCommune: "109", libelleCommune: "Nantes" },
    portable: "06 12 34 56 78",
    email: "p.lambert@exemple.fr",
    adresse: { numeroVoie: "12", libelleVoie: "rue des Lilas", codePostal: "44400", codeCommune: "44143", libelleCommune: "REZE" },
    banque: { iban: "FR76 3000 6000 0112 3456 7890 189", bic: "BNAPFRPP", titulaire: "M. Pierre Lambert" },
  };
}

console.log("L'inscription d'un client");

cas("un client complet passe, aux formes de l'Urssaf", () => {
  const v = particulierPourUrssaf(lambert());
  assert.ok(v.ok, JSON.stringify(!v.ok && v.manques));
  if (!v.ok) return;
  assert.equal(v.valeur.civilite, "1");
  assert.equal(v.valeur.dateNaissance, "1961-04-12T00:00:00.000Z");
  assert.equal(v.valeur.numeroTelephonePortable, "0612345678", "le portable part sans espaces");
  assert.equal(v.valeur.coordonneeBancaire.iban, "FR7630006000011234567890189", "l'IBAN part nu");
  assert.equal(v.valeur.lieuNaissance.codePaysNaissance, "99100");
  assert.equal(v.valeur.lieuNaissance.departementNaissance, "044");
  assert.equal(v.valeur.adressePostale.codePays, "99100");
  assert.equal("nomUsage" in v.valeur, false, "pas de nom d'usage s'il n'en a pas");
});

cas("Madame part en « 2 »", () => {
  const v = particulierPourUrssaf({ ...lambert(), civilite: "Mme" });
  assert.ok(v.ok && v.valeur.civilite === "2");
});

cas("tout ce qui manque est rendu D'UN COUP, pas case par case", () => {
  const v = particulierPourUrssaf({ ...lambert(), dateNaissance: null, banque: { iban: "", bic: null, titulaire: null }, naissance: { enFrance: true, departement: null, codeCommune: null } });
  assert.equal(v.ok, false);
  if (v.ok) return;
  const champs = v.manques.map((m) => m.champ).sort();
  assert.deepEqual(champs, ["bic", "communeNaissance", "dateNaissance", "departementNaissance", "iban", "titulaire"].sort());
  assert.ok(v.manques.every((m) => m.raison === "absent"));
});

cas("un nom avec un chiffre est refusé, comme l'Urssaf le refuserait", () => {
  const v = particulierPourUrssaf({ ...lambert(), nomNaissance: "Lambert2" });
  assert.ok(!v.ok && v.manques.some((m) => m.champ === "nomNaissance" && m.raison === "format"));
});

cas("un nom composé, une apostrophe, un tiret passent", () => {
  for (const nom of ["Le Goff", "D'Artagnan", "Martin-Roux", "Ø"]) {
    const v = particulierPourUrssaf({ ...lambert(), nomNaissance: nom });
    assert.ok(v.ok, `« ${nom} » refusé`);
  }
});

cas("deux prénoms séparés d'un espace passent, deux espaces non", () => {
  assert.ok(particulierPourUrssaf({ ...lambert(), prenoms: "Jean-Pierre Marie" }).ok);
  assert.equal(particulierPourUrssaf({ ...lambert(), prenoms: "Jean  Marie" }).ok, false);
});

cas("un fixe n'est pas un portable : l'Urssaf veut un 06 ou un 07", () => {
  const v = particulierPourUrssaf({ ...lambert(), portable: "02 40 00 00 00" });
  assert.ok(!v.ok && v.manques.some((m) => m.champ === "portable" && m.raison === "format"));
  assert.ok(particulierPourUrssaf({ ...lambert(), portable: "+33712345678" }).ok);
});

cas("un IBAN à la clé fausse est refusé avant l'envoi", () => {
  assert.equal(ibanBienForme("FR7630006000011234567890189"), true);
  assert.equal(ibanBienForme("FR7630006000011234567890188"), false, "un chiffre changé doit se voir");
  const v = particulierPourUrssaf({ ...lambert(), banque: { iban: "FR76 3000 6000 0112 3456 7890 188", bic: "BNAPFRPP", titulaire: "M. Lambert" } });
  assert.ok(!v.ok && v.manques.some((m) => m.champ === "iban" && m.raison === "format"));
});

cas("né à l'étranger : seul le pays est demandé", () => {
  const v = particulierPourUrssaf({ ...lambert(), naissance: { enFrance: false, codePays: "99134" } });
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.deepEqual(v.valeur.lieuNaissance, { codePaysNaissance: "99134" });
});

cas("la Haute-Corse s'écrit 02B, et passe", () => {
  const v = particulierPourUrssaf({ ...lambert(), naissance: { enFrance: true, departement: "02b", codeCommune: "033" } });
  assert.ok(v.ok && v.valeur.lieuNaissance.departementNaissance === "02B");
});

cas("une voie trop longue pour l'Urssaf (28 caractères) est refusée", () => {
  const v = particulierPourUrssaf({ ...lambert(), adresse: { ...lambert().adresse!, libelleVoie: "avenue du Maréchal de Lattre de Tassigny" } });
  assert.ok(!v.ok && v.manques.some((m) => m.champ === "libelleVoie"));
});

console.log("\nLa demande de paiement d'une facture");

/** La facture de la planche : tonte 180 € HT et taille 240 € HT, TVA 20 %. */
function facture(): FactureAtlas {
  return {
    idTiersFacturation: "jardins.demo",
    numeroOrganisme: "SAP123456789",
    idClient: "11000000000104",
    dateNaissanceClient: "1961-04-12",
    numero: "F2026-000041",
    dateFacture: "2026-11-05",
    debutEmploi: "2026-11-05",
    finEmploi: "2026-11-05",
    lignes: [
      { codeNature: "NATURE-A-CONFIRMER", quantite: 1, unite: "FORFAIT", unitaireTTCCentimes: 21600, htCentimes: 18000, tvaCentimes: 3600, ttcCentimes: 21600, complement1: "5 novembre, 3 h 30" },
      { codeNature: "NATURE-A-CONFIRMER", quantite: 1, unite: "FORFAIT", unitaireTTCCentimes: 28800, htCentimes: 24000, tvaCentimes: 4800, ttcCentimes: 28800 },
    ],
    dejaRegleCentimes: 0,
  };
}

cas("la facture de la planche part : 420 € HT, 504 € TTC", () => {
  const v = demandePaiementPourUrssaf(facture());
  assert.ok(v.ok, JSON.stringify(!v.ok && v.manques));
  if (!v.ok) return;
  assert.equal(v.valeur.mntFactureHT, 420);
  assert.equal(v.valeur.mntFactureTTC, 504);
  assert.equal(v.valeur.dateFacture, "2026-11-05T00:00:00.000Z");
  assert.equal(v.valeur.inputPrestations.length, 2);
  assert.ok(v.valeur.inputPrestations.every((p) => p.complement2 === "SAP123456789"), "le numéro de l'organisme sur CHAQUE prestation");
  assert.equal(v.valeur.inputPrestations[0].complement1, "5 novembre, 3 h 30");
  assert.equal("complement1" in v.valeur.inputPrestations[1], false);
});

cas("une coopérative s'identifie par SIR et son SIRET", () => {
  assert.ok(demandePaiementPourUrssaf({ ...facture(), numeroOrganisme: "SIR85048465000021" }).ok);
  assert.equal(demandePaiementPourUrssaf({ ...facture(), numeroOrganisme: "850484650" }).ok, false, "un numéro sans SAP devant ne part pas");
});

cas("une facture déjà en partie réglée ne part pas (garantie financière)", () => {
  const v = demandePaiementPourUrssaf({ ...facture(), dejaRegleCentimes: 15000 });
  assert.ok(!v.ok && v.manques.some((m) => m.champ === "reglements"));
});

cas("une période à cheval sur deux mois est refusée", () => {
  const v = demandePaiementPourUrssaf({ ...facture(), debutEmploi: "2026-10-28", finEmploi: "2026-11-03" });
  assert.ok(!v.ok && v.manques.some((m) => m.champ === "periode"));
  assert.ok(demandePaiementPourUrssaf({ ...facture(), debutEmploi: "2026-11-01", finEmploi: "2026-11-30" }).ok, "un mois entier passe");
});

cas("une période qui finit avant de commencer est refusée", () => {
  const v = demandePaiementPourUrssaf({ ...facture(), debutEmploi: "2026-11-10", finEmploi: "2026-11-05" });
  assert.ok(!v.ok && v.manques.some((m) => m.champ === "periode"));
});

cas("aucune nature par défaut : une ligne sans nature ne part pas", () => {
  const f = facture();
  f.lignes[1] = { ...f.lignes[1], codeNature: null };
  const v = demandePaiementPourUrssaf(f);
  assert.ok(!v.ok && v.manques.some((m) => m.champ === "lignes.1.codeNature"));
});

cas("un centime d'écart entre HT, TVA et TTC est refusé", () => {
  const f = facture();
  f.lignes[0] = { ...f.lignes[0], tvaCentimes: 3599 };
  assert.ok(!demandePaiementPourUrssaf(f).ok);
});

cas("3 h 30 à 40 € l'heure font 140 € : la quantité fois le prix doit tomber juste", () => {
  const f = facture();
  f.lignes = [{ codeNature: "NATURE-A-CONFIRMER", quantite: 3.5, unite: "HEURE", unitaireTTCCentimes: 4000, htCentimes: 11667, tvaCentimes: 2333, ttcCentimes: 14000 }];
  const v = demandePaiementPourUrssaf(f);
  assert.ok(v.ok, JSON.stringify(!v.ok && v.manques));
  f.lignes[0] = { ...f.lignes[0], ttcCentimes: 14100, htCentimes: 11750, tvaCentimes: 2350 };
  assert.equal(demandePaiementPourUrssaf(f).ok, false);
});

cas("un client pas encore inscrit ne peut pas recevoir de demande", () => {
  const v = demandePaiementPourUrssaf({ ...facture(), idClient: null });
  assert.ok(!v.ok && v.manques.some((m) => m.champ === "idClient"));
});

console.log("\nCe que l'Urssaf répond");

cas("les neuf étapes de l'Urssaf se reconnaissent, accents ou pas", () => {
  const attendu: [string, string][] = [
    ["Intégrée", "integree"],
    ["En attente de validation", "en-attente-du-client"],
    ["Validée", "validee"],
    ["Refusée", "refusee"],
    ["Prélevée", "prelevee"],
    ["En refus de prélèvement", "impayee"],
    ["Payée", "versee"],
    ["Annulée", "annulee"],
    ["Recouvrée", "recouvree"],
    ["VALIDEE", "validee"],
  ];
  for (const [libelle, etape] of attendu) assert.equal(etapeDeLaDemande({ libelle }), etape, libelle);
});

cas("une étape inconnue reste inconnue : jamais devinée", () => {
  assert.equal(etapeDeLaDemande({ code: "99", libelle: "Suspendue pour contrôle" }), "inconnue");
  assert.equal(etapeDeLaDemande(null), "inconnue");
  assert.equal(etapeDeLaDemande({ code: "10" }), "inconnue", "un code sans libellé ne suffit pas");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Avance immédiate, les règles : ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
