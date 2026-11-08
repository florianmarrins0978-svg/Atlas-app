import assert from "node:assert/strict";
import {
  additionDeLAvanceImmediate,
  adressePostaleDeLaBan,
  aRelire,
  ceQueLaFicheDit,
  codesSaisisLus,
  communeDeNaissance,
  communesDeLaReponse,
  complementDesHeures,
  departementSaisi,
  envoiOrdinaireApres,
  ETAPES_FINALES,
  etatDuParticulier,
  factureVersLUrssaf,
  feuillePreremplie,
  jourDuVersement,
  lignesPourLUrssaf,
  manquesDeLaFeuille,
  naissanceDuCodeInsee,
  particulierDeLaSaisie,
  pastilleDeLaDemande,
  periodeDeLaFacture,
  phraseDesCasesQuiManquent,
  phraseDuRefus,
  refusDeLaDateDeNaissance,
  rubriqueDuClient,
  saisieInscriptionLue,
  sansAcompteAuDevis,
  suiviDeLaDemande,
  type LigneDeFacture,
  type SaisieInscription,
} from "../src/lib/urssaf/branchement";
import { demandePaiementPourUrssaf, particulierPourUrssaf, type FactureAtlas } from "../src/lib/urssaf/avance-immediate";
import { totauxAvecReduction } from "../src/lib/reduction-devis";
import { enEuros } from "../src/lib/euros";

// Le BRANCHEMENT de l'avance immédiate (lot 3), sans réseau ni base : ce que
// les écrans et le serveur décident ensemble. Chaque règle sert l'écran ET le
// serveur ; elle s'éprouve donc une fois, ici, dans les deux sens : ce qui doit
// passer passe, ce qui doit être refusé l'est, et rien n'est deviné.

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

// ─── Les codes de la liaison ────────────────────────────────────────────────

cas("les quatre codes se gardent, les blancs du bout partent", () => {
  const r = codesSaisisLus({ clientId: "  abc ", clientSecret: "s3cr3t\n", idTiersFacturation: "T123", codeNature: "ENF" });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.codes, { clientId: "abc", clientSecret: "s3cr3t", idTiersFacturation: "T123", codeNature: "ENF" });
});

cas("une case vide ou qui n'est pas un texte se refuse, aucun défaut n'est posé", () => {
  assert.deepEqual(codesSaisisLus({ clientId: "a", clientSecret: "b", idTiersFacturation: "c" }), { ok: false, raison: "Remplissez les quatre cases." });
  assert.equal(codesSaisisLus({ clientId: "a", clientSecret: "b", idTiersFacturation: "c", codeNature: "   " }).ok, false);
  assert.equal(codesSaisisLus({ clientId: 42, clientSecret: "b", idTiersFacturation: "c", codeNature: "d" }).ok, false);
  assert.equal(codesSaisisLus({ clientId: "x".repeat(501), clientSecret: "b", idTiersFacturation: "c", codeNature: "d" }).ok, false);
});

cas("les refus de l'Urssaf se disent en clair, celui de Relier comme la planche", () => {
  assert.equal(phraseDuRefus({ raison: "codes-refuses" }), "Ces codes ne sont pas acceptés par l'Urssaf.");
  assert.match(phraseDuRefus({ raison: "injoignable" }), /ne répond pas/);
  assert.equal(
    phraseDuRefus({ raison: "refuse", erreurs: [{ code: "ERR", message: "Lieu incohérent", description: "Le code commune ne correspond pas au département." }] }),
    "L'Urssaf refuse : Le code commune ne correspond pas au département."
  );
  assert.equal(phraseDuRefus({ raison: "refuse", erreurs: [] }), "L'Urssaf refuse, sans dire pourquoi.");
});

// ─── Quand les gestes paraissent ────────────────────────────────────────────

const lambert = { declaree: true, clientNom: "Lambert", clientCivilite: "mr" as const };

cas("la rubrique du client : déclarée, reliée, et un particulier, par la règle du lot 1", () => {
  assert.equal(rubriqueDuClient({ ...lambert, reliee: true }), true);
  assert.equal(rubriqueDuClient({ ...lambert, reliee: false }), false, "pas reliée");
  assert.equal(rubriqueDuClient({ ...lambert, declaree: false, reliee: true }), false, "pas déclarée");
  assert.equal(rubriqueDuClient({ declaree: true, clientNom: "Jardins Ribault", clientCivilite: "entreprise", reliee: true }), false, "une entreprise");
});

cas("le devis d'un client inscrit ou en attente n'a pas d'acompte, la case retenue", () => {
  const base = { ...lambert, coche: true, reliee: true };
  assert.equal(sansAcompteAuDevis({ ...base, inscription: "inscrit" }), true);
  assert.equal(sansAcompteAuDevis({ ...base, inscription: "en-attente" }), true);
  assert.equal(sansAcompteAuDevis({ ...base, inscription: null }), false, "pas inscrit : l'acompte reste");
  assert.equal(sansAcompteAuDevis({ ...base, coche: false, inscription: "inscrit" }), false, "case décochée : un devis ordinaire");
  assert.equal(sansAcompteAuDevis({ ...base, reliee: false, inscription: "inscrit" }), false, "déliée : rien ne part à l'Urssaf");
});

cas("la facture part à l'Urssaf pour un client INSCRIT seulement, case cochée", () => {
  const base = { ...lambert, coche: true, reliee: true };
  assert.equal(factureVersLUrssaf({ ...base, inscription: "inscrit" }), true);
  assert.equal(factureVersLUrssaf({ ...base, inscription: "en-attente" }), false, "en attente : l'Urssaf refuserait");
  assert.equal(factureVersLUrssaf({ ...base, coche: false, inscription: "inscrit" }), false);
});

// ─── La fiche du client ─────────────────────────────────────────────────────

cas("en attente : écrit le 8 novembre, 7 jours pour accepter, puis le délai passe", () => {
  const i = { etat: "en-attente" as const, demandeeLe: "2026-11-08", etatLe: "2026-11-08" };
  assert.deepEqual(ceQueLaFicheDit(i, "2026-11-10"), { etat: "en-attente", ecritLe: "2026-11-08", jusquAu: "2026-11-15", delaiPasse: false });
  assert.equal((ceQueLaFicheDit(i, "2026-11-16") as { delaiPasse: boolean }).delaiPasse, true);
  assert.deepEqual(ceQueLaFicheDit(null, "2026-11-10"), { etat: "pas-inscrit" });
  assert.deepEqual(ceQueLaFicheDit({ etat: "inscrit", demandeeLe: "2026-11-08", etatLe: "2026-11-09" }, "2026-11-10"), { etat: "inscrit", depuis: "2026-11-09" });
});

cas("l'état relu chez l'Urssaf ne conclut que sur des mots sans ambiguïté", () => {
  assert.equal(etatDuParticulier({ statut: { code: "10", libelle: "Compte actif" } }), "inscrit");
  assert.equal(etatDuParticulier({ statut: "VALIDÉE" }), "inscrit");
  assert.equal(etatDuParticulier({ etat: "Inactif" }), "en-attente", "« inactif » contient « actif »");
  assert.equal(etatDuParticulier({ statut: { libelle: "En attente d'activation" } }), "en-attente");
  assert.equal(etatDuParticulier({ statut: { code: "30" } }), "inconnu", "un code seul ne dit rien");
  assert.equal(etatDuParticulier(null), "inconnu");
  assert.equal(etatDuParticulier([{ statut: "Inscrit" }]), "inscrit");
});

// ─── Le lieu de naissance ───────────────────────────────────────────────────

cas("le département se lit sur trois caractères, et seulement un département", () => {
  assert.equal(departementSaisi("44"), "044");
  assert.equal(departementSaisi("044"), "044");
  assert.equal(departementSaisi("2a"), "02A");
  assert.equal(departementSaisi("971"), "971");
  assert.equal(departementSaisi("00"), null);
  assert.equal(departementSaisi("Loire"), null);
  assert.equal(departementSaisi("977"), null);
});

cas("le code INSEE se découpe en département et commune", () => {
  assert.deepEqual(naissanceDuCodeInsee("44109"), { departement: "044", codeCommune: "109" });
  assert.deepEqual(naissanceDuCodeInsee("2A004"), { departement: "02A", codeCommune: "004" });
  assert.deepEqual(naissanceDuCodeInsee("97105"), { departement: "971", codeCommune: "105" });
  assert.equal(naissanceDuCodeInsee("4410"), null);
});

cas("la commune tapée se trouve par son nom exact, jamais devinée parmi deux", () => {
  const trouvees = communesDeLaReponse([
    { nom: "Saint-Herblain", code: "44162", codeDepartement: "44" },
    { nom: "Nantes", code: "44109", codeDepartement: "44" },
    { nom: "Nantes", code: "99999", codeDepartement: "35" },
    { nom: 3, code: "x" },
  ]);
  assert.equal(trouvees.length, 3, "une réponse mal formée est écartée");
  assert.equal(communeDeNaissance(trouvees, "nantes", "044")?.code, "44109");
  assert.equal(communeDeNaissance(trouvees, "St Herblain", "44")?.code, "44162", "« St » vaut « Saint »");
  assert.equal(communeDeNaissance(trouvees, "Nant", "44"), null, "un début de nom ne suffit pas");
  assert.equal(communeDeNaissance([...trouvees, { nom: "Nantes", code: "44110", departement: "44" }], "Nantes", "44"), null, "deux candidates : rien");
  assert.deepEqual(communesDeLaReponse({ erreur: true }), []);
});

// ─── L'adresse, lue dans la Base Adresse Nationale ──────────────────────────

cas("l'adresse de la fiche se découpe comme l'Urssaf l'attend", () => {
  const a = adressePostaleDeLaBan({
    features: [{ properties: { type: "housenumber", housenumber: "12bis", street: "Rue des Lilas", postcode: "44400", citycode: "44143", city: "Rezé", score: 0.93 } }],
  });
  assert.deepEqual(a, { codeCommune: "44143", codePostal: "44400", libelleCommune: "Rezé", libelleVoie: "Rue des Lilas", numeroVoie: "12", lettreVoie: "B" });
});

cas("une voie trop longue se coupe au dernier mot entier, la commune ne bouge pas", () => {
  const a = adressePostaleDeLaBan({
    features: [{ properties: { type: "street", name: "Avenue du Maréchal de Lattre de Tassigny", postcode: "75016", citycode: "75116", city: "Paris", score: 0.8 } }],
  });
  assert.equal(a?.libelleVoie, "Avenue du Maréchal de Lattre");
  assert.ok((a?.libelleVoie ?? "").length <= 28);
  assert.equal(a?.codeCommune, "75116");
});

cas("une adresse mal reconnue, ou sans commune, ne se devine pas", () => {
  assert.equal(adressePostaleDeLaBan({ features: [{ properties: { citycode: "44143", postcode: "44400", city: "Rezé", score: 0.3 } }] }), null);
  assert.equal(adressePostaleDeLaBan({ features: [{ properties: { postcode: "44400", city: "Rezé", score: 0.9 } }] }), null);
  assert.equal(adressePostaleDeLaBan({ features: [] }), null);
  assert.equal(adressePostaleDeLaBan("illisible"), null);
});

// ─── La feuille « L'inscrire à l'Urssaf » ───────────────────────────────────

const preremplie = feuillePreremplie({ nom: "Lambert", civilite: "mr", telephone: "06 12 34 56 78", email: "p.lambert@exemple.fr" });

function complete(): SaisieInscription {
  return {
    ...preremplie,
    prenoms: "Pierre",
    dateNaissance: "1961-04-12",
    departementNaissance: "44",
    communeNaissance: "Nantes",
    iban: "FR7630006000011234567890189",
    bic: "AGRIFRPP",
  };
}

cas("la feuille reprend ce qu'Atlas sait : civilité, nom, portable, e-mail, titulaire", () => {
  assert.equal(preremplie.civilite, "M");
  assert.equal(preremplie.nomNaissance, "Lambert");
  assert.equal(preremplie.portable, "06 12 34 56 78");
  assert.equal(preremplie.titulaire, "Mr. Lambert");
  assert.equal(feuillePreremplie({ nom: "Roux", civilite: "mme", telephone: "02 40 00 00 00", email: null }).portable, "", "un fixe ne se reprend pas");
});

cas("« Il manque N cases » se compte par la règle de l'envoi, l'adresse mise à part", () => {
  const manques = manquesDeLaFeuille(preremplie).map((m) => m.champ).sort();
  assert.deepEqual(manques, ["bic", "communeNaissance", "dateNaissance", "departementNaissance", "iban", "prenoms"]);
  assert.equal(phraseDesCasesQuiManquent(manques.length), "Il manque 6 cases");
  assert.equal(phraseDesCasesQuiManquent(1), "Il manque 1 case");
  assert.equal(phraseDesCasesQuiManquent(0), null);
  assert.deepEqual(manquesDeLaFeuille(complete()), [], "une feuille complète ne manque de rien");
});

cas("un IBAN dont la clé est fausse manque aussi, avant tout envoi", () => {
  const m = manquesDeLaFeuille({ ...complete(), iban: "FR7630006000011234567890188" });
  assert.deepEqual(m.map((x) => [x.champ, x.raison]), [["iban", "format"]]);
});

cas("né ailleurs : le code du pays remplace le département et la commune", () => {
  const ailleurs = { ...complete(), neEnFrance: false, departementNaissance: "", communeNaissance: "", paysNaissance: "" };
  assert.deepEqual(manquesDeLaFeuille(ailleurs).map((m) => m.champ), ["paysNaissance"]);
  assert.deepEqual(manquesDeLaFeuille({ ...ailleurs, paysNaissance: "99134" }), []);
});

cas("résolue par le serveur, la feuille donne un particulier que la règle de l'envoi accepte", () => {
  const p = particulierDeLaSaisie(complete(), {
    communeNaissance: { departement: "044", codeCommune: "109", libelle: "Nantes" },
    adresse: { codeCommune: "44143", codePostal: "44400", libelleCommune: "Rezé", libelleVoie: "Rue des Lilas", numeroVoie: "12" },
  });
  const v = particulierPourUrssaf(p);
  assert.ok(v.ok, JSON.stringify(!v.ok && v.manques));
  if (v.ok) {
    assert.equal(v.valeur.lieuNaissance.departementNaissance, "044");
    assert.equal(v.valeur.lieuNaissance.communeNaissance?.codeCommune, "109");
    assert.equal(v.valeur.coordonneeBancaire.iban, "FR7630006000011234567890189");
  }
});

cas("ce que l'action reçoit se relit : une feuille trafiquée se refuse", () => {
  assert.deepEqual(saisieInscriptionLue(complete()), complete());
  assert.equal(saisieInscriptionLue({ ...complete(), civilite: "Docteur" }), null);
  assert.equal(saisieInscriptionLue({ ...complete(), neEnFrance: "oui" }), null);
  assert.equal(saisieInscriptionLue({ ...complete(), iban: 7 }), null);
  assert.equal(saisieInscriptionLue(null), null);
});

cas("une date de naissance dans l'avenir se refuse", () => {
  assert.equal(refusDeLaDateDeNaissance("2030-01-01", "2026-11-08"), "Une date de naissance est dans le passé.");
  assert.equal(refusDeLaDateDeNaissance("1961-04-12", "2026-11-08"), null);
});

// ─── La facture, devenue une demande ────────────────────────────────────────

const tonte: LigneDeFacture = { montant: "180.00", quantite: "1", prixUnitaire: "180.00", unite: "passage", tauxTva: null, supplement: false };
const haie: LigneDeFacture = { montant: "240.00", quantite: "40", prixUnitaire: "6.00", unite: "ml", tauxTva: null, supplement: false };

function demande(lignes: ReturnType<typeof lignesPourLUrssaf>, extra: Partial<FactureAtlas> = {}) {
  return demandePaiementPourUrssaf({
    idTiersFacturation: "T1",
    numeroOrganisme: "SAP123456789",
    idClient: "11000000000104",
    dateNaissanceClient: "1961-04-12",
    numero: "F2026-000041",
    dateFacture: "2026-11-08",
    debutEmploi: "2026-11-05",
    finEmploi: "2026-11-05",
    lignes,
    dejaRegleCentimes: 0,
    ...extra,
  });
}

cas("la planche : 420 € HT, 84 € de TVA, 504 € que la demande porte au centime", () => {
  const lignes = lignesPourLUrssaf({ lignes: [tonte, haie], tauxTva: "20.00", reductionPourcent: null, codeNature: "ENF", complement1: "Le 5 novembre 2026, 5 h 30" });
  assert.deepEqual(lignes.map((l) => [l.unite, l.quantite, l.htCentimes, l.tvaCentimes, l.ttcCentimes]), [
    ["FORFAIT", 1, 18000, 3600, 21600],
    ["FORFAIT", 1, 24000, 4800, 28800],
  ]);
  assert.equal(lignes[0].complement1, "Le 5 novembre 2026, 5 h 30");
  assert.equal(lignes[1].complement1, undefined, "le complément dit l'intervention, une fois");
  const v = demande(lignes);
  assert.ok(v.ok, JSON.stringify(!v.ok && v.manques));
  if (v.ok) {
    assert.equal(v.valeur.mntFactureTTC, 504);
    assert.equal(v.valeur.mntFactureHT, 420);
  }
});

cas("une ligne d'heures garde sa quantité et l'unité HEURE quand le compte tombe juste", () => {
  const heures: LigneDeFacture = { montant: "140.00", quantite: "3.5", prixUnitaire: "40.00", unite: "h", tauxTva: null, supplement: false };
  const [l] = lignesPourLUrssaf({ lignes: [heures], tauxTva: "20.00", reductionPourcent: null, codeNature: "ENF", complement1: null });
  assert.deepEqual([l.unite, l.quantite, l.unitaireTTCCentimes, l.ttcCentimes], ["HEURE", 3.5, 4800, 16800]);
  assert.ok(demande([l]).ok);
});

cas("des heures dont le compte ne tombe pas juste partent en un forfait", () => {
  // 3 × 33,33 € HT : 99,99 € HT, 20,00 € de TVA, 119,99 € ; mais 3 × 40,00 € TTC font 120,00 €.
  const heures: LigneDeFacture = { montant: "99.99", quantite: "3", prixUnitaire: "33.33", unite: "heures", tauxTva: null, supplement: false };
  const [l] = lignesPourLUrssaf({ lignes: [heures], tauxTva: "20.00", reductionPourcent: null, codeNature: "ENF", complement1: null });
  assert.deepEqual([l.unite, l.quantite, l.ttcCentimes], ["FORFAIT", 1, 11999]);
  assert.ok(demande([l]).ok);
});

cas("la TVA d'un taux se répartit sur ses lignes, le centime résiduel sur la plus grosse", () => {
  const a: LigneDeFacture = { montant: "10.01", quantite: "1", prixUnitaire: "10.01", unite: null, tauxTva: null, supplement: false };
  const b: LigneDeFacture = { montant: "10.01", quantite: "1", prixUnitaire: "10.01", unite: null, tauxTva: null, supplement: false };
  const c: LigneDeFacture = { montant: "20.03", quantite: "1", prixUnitaire: "20.03", unite: null, tauxTva: null, supplement: false };
  const lignes = lignesPourLUrssaf({ lignes: [a, b, c], tauxTva: "10.00", reductionPourcent: null, codeNature: "ENF", complement1: null });
  const t = totauxAvecReduction([a, b, c], "10.00", null);
  assert.equal(lignes.reduce((s, l) => s + l.tvaCentimes, 0), Math.round(Number(t.totalTva) * 100), "la TVA de la facture, au centime");
  assert.equal(lignes.reduce((s, l) => s + l.ttcCentimes, 0), Math.round(Number(t.totalTtc) * 100));
  assert.ok(demande(lignes).ok);
});

cas("avec une remise sur la facture, une ligne par taux, aux totaux de la facture", () => {
  const lignes = lignesPourLUrssaf({ lignes: [tonte, { ...haie, tauxTva: "10.00" }], tauxTva: "20.00", reductionPourcent: "10", codeNature: "ENF", complement1: null });
  const t = totauxAvecReduction([tonte, { ...haie, tauxTva: "10.00" }], "20.00", "10");
  assert.equal(lignes.length, 2);
  assert.ok(lignes.every((l) => l.unite === "FORFAIT" && l.quantite === 1));
  assert.equal(lignes.reduce((s, l) => s + l.ttcCentimes, 0), Math.round(Number(t.totalTtc) * 100), "le TTC remisé, au centime");
  assert.ok(demande(lignes).ok);
});

cas("une ligne à zéro ne part pas, une ligne négative fait refuser la demande", () => {
  const vide: LigneDeFacture = { ...tonte, montant: "0.00" };
  assert.equal(lignesPourLUrssaf({ lignes: [tonte, vide], tauxTva: "20.00", reductionPourcent: null, codeNature: "ENF", complement1: null }).length, 1);
  const tout: LigneDeFacture = { ...tonte, montant: "-200.00", prixUnitaire: "-200.00" };
  const lignes = lignesPourLUrssaf({ lignes: [tonte, tout], tauxTva: "20.00", reductionPourcent: null, codeNature: "ENF", complement1: null });
  const v = demande(lignes);
  assert.equal(v.ok, false);
  if (!v.ok) assert.ok(v.manques.some((m) => m.libelle.includes("nul ou négatif")));
});

cas("sans code nature, la demande ne part pas : aucun défaut n'est posé", () => {
  const lignes = lignesPourLUrssaf({ lignes: [tonte], tauxTva: "20.00", reductionPourcent: null, codeNature: null, complement1: null });
  const v = demande(lignes);
  assert.equal(v.ok, false);
});

cas("la période : les jours du retour du jour, sinon la date des travaux, un mois du calendrier", () => {
  assert.deepEqual(periodeDeLaFacture(["2026-11-12", "2026-11-05"], "2026-11-30"), { debut: "2026-11-05", fin: "2026-11-12" });
  assert.deepEqual(periodeDeLaFacture([], "2026-11-05"), { debut: "2026-11-05", fin: "2026-11-05" });
  assert.deepEqual(periodeDeLaFacture([], null), { debut: null, fin: null });
  const p = periodeDeLaFacture(["2026-10-30", "2026-11-05"], null);
  const v = demande(lignesPourLUrssaf({ lignes: [tonte], tauxTva: "20.00", reductionPourcent: null, codeNature: "ENF", complement1: null }), { debutEmploi: p.debut, finEmploi: p.fin });
  assert.equal(v.ok, false);
  if (!v.ok) assert.ok(v.manques.some((m) => m.libelle === "Une facture par mois du calendrier"));
});

cas("une facture déjà en partie réglée ne part pas à l'Urssaf", () => {
  const v = demande(lignesPourLUrssaf({ lignes: [tonte], tauxTva: "20.00", reductionPourcent: null, codeNature: "ENF", complement1: null }), { dejaRegleCentimes: 5000 });
  assert.equal(v.ok, false);
  if (!v.ok) assert.ok(v.manques.some((m) => m.libelle === "Facture déjà en partie réglée"));
});

cas("le complément dit la date et la durée, tous intervenants comptés", () => {
  assert.equal(complementDesHeures([{ jour: "2026-11-05", minutes: 210 }, { jour: "2026-11-05", minutes: 120 }]), "Le 5 novembre 2026, 5 h 30");
  assert.equal(
    complementDesHeures([{ jour: "2026-11-05", minutes: 120 }, { jour: "2026-11-26", minutes: 90 }, { jour: "2026-11-12", minutes: 60 }]),
    "3 passages du 5 novembre au 26 novembre 2026, 4 h 30 en tout"
  );
  assert.equal(complementDesHeures([]), null);
  assert.equal(complementDesHeures([{ jour: "2026-11-05", minutes: 0 }]), null);
});

// ─── L'addition et le suivi ─────────────────────────────────────────────────

cas("l'addition de la planche : 252 + 252, l'Urssaf verse les 504", () => {
  assert.deepEqual(additionDeLAvanceImmediate("504.00"), { payeParLeClient: "252.00", creditDImpot: "252.00", verse: "504.00" });
  // Le crédit s'arrondit au centime inférieur (lot 1) : le centime va au client.
  assert.deepEqual(additionDeLAvanceImmediate("504.01"), { payeParLeClient: "252.01", creditDImpot: "252.00", verse: "504.01" });
});

const suivi = (etape: Parameters<typeof suiviDeLaDemande>[0]["etape"], extra: Partial<Parameters<typeof suiviDeLaDemande>[0]> = {}) =>
  suiviDeLaDemande({
    etape,
    libelleUrssaf: null,
    envoyeeLe: "2026-11-08",
    valideeLe: null,
    etapeLe: "2026-11-09",
    versement: null,
    totalTtc: "504.00",
    clientNom: "Lambert",
    clientCivilite: "mr",
    ...extra,
  });

cas("le suivi, chez l'Urssaf : envoyée, il la valide avant le 10, l'Urssaf vous verse", () => {
  const pas = suivi("integree");
  assert.deepEqual(pas.map((p) => [p.ton, p.titre, p.sous]), [
    ["vert", "Envoyée à l'Urssaf", "Le 8 novembre"],
    ["ambre", "Mr. Lambert la valide", "Il a jusqu'au 10 novembre"],
    ["gris", `L'Urssaf vous verse ${enEuros("504.00")}`, null],
  ]);
});

cas("le suivi, versée : trois coches, le montant et le jour du virement", () => {
  const pas = suivi("versee", { valideeLe: "2026-11-09", versement: { montant: "504.00", le: "2026-11-14" } });
  assert.deepEqual(pas.map((p) => p.ton), ["vert", "vert", "vert"]);
  assert.equal(pas[1].titre, "Validée par Mr. Lambert");
  assert.equal(pas[2].titre, `Versée, ${enEuros("504.00")}`);
  assert.equal(pas[2].sous, "Le 14 novembre, sur votre compte");
});

cas("le suivi, refusée : deux pas, le second en rouge", () => {
  const pas = suivi("refusee");
  assert.deepEqual(pas.map((p) => [p.ton, p.titre]), [["vert", "Envoyée à l'Urssaf"], ["rouge", "Refusée par Mr. Lambert"]]);
});

cas("une étape inconnue se montre sous le libellé de l'Urssaf, sans rien en conclure", () => {
  const pas = suivi("inconnue", { libelleUrssaf: "Suspendue pour contrôle" });
  assert.equal(pas[1].titre, "Suspendue pour contrôle");
  assert.equal(pas[1].ton, "gris");
});

cas("la pastille : chez l'Urssaf, acquittée, refusée", () => {
  assert.deepEqual(pastilleDeLaDemande({ etape: "integree", etapeLe: "2026-11-08", versement: null }, "Lambert", "mr"), { ton: "ambre", texte: "Chez l'Urssaf" });
  assert.deepEqual(pastilleDeLaDemande({ etape: "versee", etapeLe: "2026-11-15", versement: { le: "2026-11-14" } }, "Lambert", "mr"), { ton: "vert", texte: "Acquittée le 14 novembre" });
  assert.deepEqual(pastilleDeLaDemande({ etape: "refusee", etapeLe: "2026-11-09", versement: null }, "Lambert", "mr"), { ton: "rouge", texte: "Refusée par Mr. Lambert" });
});

cas("refusée ou annulée, l'envoi ordinaire revient ; versée, rien ne se relit plus", () => {
  assert.equal(envoiOrdinaireApres("refusee"), true);
  assert.equal(envoiOrdinaireApres("annulee"), true);
  assert.equal(envoiOrdinaireApres("validee"), false);
  assert.ok((ETAPES_FINALES as readonly string[]).includes("versee"));
  assert.ok(!(ETAPES_FINALES as readonly string[]).includes("validee"));
});

cas("une demande se relit au plus une fois par cinq minutes", () => {
  const t = new Date("2026-11-08T10:00:00Z");
  assert.equal(aRelire(null, t), true);
  assert.equal(aRelire(new Date("2026-11-08T09:57:00Z"), t), false);
  assert.equal(aRelire(new Date("2026-11-08T09:55:00Z"), t), true);
});

cas("le versement se date du virement, jamais avant la facture", () => {
  assert.equal(jourDuVersement("2026-11-14T00:00:00.000Z", "2026-11-20", "2026-11-08"), "2026-11-14");
  assert.equal(jourDuVersement(undefined, "2026-11-20", "2026-11-08"), "2026-11-20");
  assert.equal(jourDuVersement("2026-11-01", "2026-11-20", "2026-11-08"), "2026-11-08");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Avance immédiate, le branchement : ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
