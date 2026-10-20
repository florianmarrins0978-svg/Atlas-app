import assert from "node:assert/strict";
import {
  ceQuiLaTrouve,
  conseilDeMarge,
  dateesAMontrer,
  ligneDeMarge,
  lireAdresseMail,
  lireMarge,
  lireMorceauDeMessage,
  phraseDeLaMargePropre,
  prixAchatCorrespondant,
  prixDepuisAchat,
  quantiteDictee,
  resumeDeLaSociete,
  societesAMontrer,
  prixDUneLigneDictee,
  type PrixAchatCandidat,
} from "../src/lib/prix-achat";

// Ses règles du 18 et du 19 octobre 2026 (`src/lib/prix-achat.ts`), avec ses
// chiffres à lui : le sac de ciment acheté 8 €, sa marge × 1,30.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}\n   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const ciment: PrixAchatCandidat = {
  id: "1",
  nom: "Sac de ciment",
  unite: "sac",
  prixHt: "8.00",
  releveLe: "12/10/2026",
  societeNom: "Point P",
  rubrique: "fournisseur",
  margePropre: null,
};

test("une marge au-dessus de × 3 est refusée, avec ce qu'il fallait taper", () => {
  assert.deepEqual(lireMarge("20"), { ok: false, raison: "« 20 » ferait × 20. Pour 20 % de marge, tapez 1,20." });
  assert.equal(conseilDeMarge(30), "« 30 » ferait × 30. Pour 30 % de marge, tapez 1,30.");
  assert.deepEqual(lireMarge("3"), { ok: true, marge: "3.00" });
  assert.deepEqual(lireMarge("1,30"), { ok: true, marge: "1.30" });
  assert.deepEqual(lireMarge(""), { ok: true, marge: null });
  assert.equal(lireMarge("abc").ok, false);
  assert.equal(lireMarge("0").ok, false);
});

test("la marge propre d'une société passe avant la générale, et se dit", () => {
  assert.equal(ligneDeMarge(null, null), "Marge à donner");
  assert.equal(ligneDeMarge(null, "1.30"), "Marge × 1,30");
  assert.equal(ligneDeMarge("1.50", "1.30"), "Marge × 1,50, la sienne");
  assert.equal(phraseDeLaMargePropre(null, "1.30"), "Votre marge générale, × 1,30. Tapez-en une autre pour lui seul.");
  assert.equal(phraseDeLaMargePropre("1.50", "1.30"), "La sienne. Videz la case pour reprendre la marge générale (× 1,30).");
  assert.equal(phraseDeLaMargePropre(null, null), "Pas encore donnée.");
});

test("3 sacs de ciment : 8 € × 3 × 1,30 = 31,20 €, et la source le dit", () => {
  const c = prixAchatCorrespondant("Il me faut 3 sacs de ciment", [ciment]);
  assert.equal(c?.id, "1");
  const p = prixDepuisAchat(c!, quantiteDictee("3 sacs de ciment"), { materiel: "1.30", mainOeuvre: null });
  assert.equal(p.venteHt, "31.20");
  assert.equal(p.source, "Acheté 24,00 € chez Point P le 12/10/2026, × 1,30, votre marge sur le matériel.");
});

test("sans marge, aucun prix : la ligne reste à chiffrer, jamais zéro", () => {
  const p = prixDepuisAchat(ciment, 1, { materiel: null, mainOeuvre: null });
  assert.equal(p.venteHt, null);
  assert.match(p.source, /Donnez votre marge sur le matériel\.$/);
});

test("la main d'œuvre d'un partenaire prend la marge main d'œuvre, ou la sienne", () => {
  const pose = { ...ciment, id: "2", nom: "Pose de clôture", unite: "m", prixHt: "10.00", societeNom: "Pilou", rubrique: "partenaire" as const };
  assert.equal(prixDepuisAchat(pose, 2, { materiel: "2.00", mainOeuvre: "1.20" }).venteHt, "24.00");
  const sienne = prixDepuisAchat({ ...pose, margePropre: "1.50" }, 2, { materiel: null, mainOeuvre: "1.20" });
  assert.equal(sienne.venteHt, "30.00");
  assert.equal(sienne.source, "Main d’œuvre de Pilou : 20,00 € le 12/10/2026, × 1,50, sa marge à part.");
});

test("aucun mot en commun : aucun prix ; à égalité, le moins cher", () => {
  assert.equal(prixAchatCorrespondant("Tonte de pelouse", [ciment]), null);
  const autre = { ...ciment, id: "3", prixHt: "7.50", societeNom: "Gedimat" };
  assert.equal(prixAchatCorrespondant("2 sacs de ciment", [ciment, autre])?.id, "3");
});

test("la quantité dictée : un chiffre, « deux », « trois », sinon une", () => {
  assert.equal(quantiteDictee("3 sacs"), 3);
  assert.equal(quantiteDictee("deux sacs"), 2);
  assert.equal(quantiteDictee("du ciment"), 1);
  assert.equal(quantiteDictee("2,5 m³ de terre"), 2.5);
});

test("les sociétés se rangent de A à Z et se trouvent aussi par ce qu'elles portent", () => {
  const liste = [
    { nom: "Point P", contenu: ["Sac de ciment"] },
    { nom: "Aqua Plus", contenu: ["Turbine 3504", "Plan d'arrosage Durand"] },
    { nom: "France Bonhomme", contenu: [] },
  ];
  assert.deepEqual(societesAMontrer(liste, "").map((s) => s.nom), ["Aqua Plus", "France Bonhomme", "Point P"]);
  assert.deepEqual(societesAMontrer(liste, "durand").map((s) => s.nom), ["Aqua Plus"]);
  assert.deepEqual(ceQuiLaTrouve(liste[1], "durand"), ["Plan d'arrosage Durand"]);
  assert.deepEqual(ceQuiLaTrouve(liste[1], "aqua"), []);
});

test("les devis reçus suivent le mois choisi, sauf pendant une recherche", () => {
  const devis = [
    { nom: "Haie Durand", jour: "2026-10-12" },
    { nom: "Clôture Martin", jour: "2026-09-03" },
  ];
  assert.deepEqual(dateesAMontrer(devis, { saisie: "", periode: "2026-10" }).map((d) => d.nom), ["Haie Durand"]);
  assert.deepEqual(dateesAMontrer(devis, { saisie: "", periode: "2026-09-03" }).map((d) => d.nom), ["Clôture Martin"]);
  assert.deepEqual(dateesAMontrer(devis, { saisie: "martin", periode: "2026-10" }).map((d) => d.nom), ["Clôture Martin"]);
});

test("le résumé d'une société s'accorde", () => {
  assert.equal(resumeDeLaSociete({ prix: 0, devis: 0, demandes: 0 }), "0 prix, 0 devis reçu, 0 demande");
  assert.equal(resumeDeLaSociete({ prix: 2, devis: 2, demandes: 3 }), "2 prix, 2 devis reçus, 3 demandes");
});

test("son prix de vente passe TOUJOURS avant l'achat × marge (« le A »)", () => {
  const vente = { tarifId: "t", intitule: "Sac de ciment", prix: "12.00", unite: "sac" };
  const marges = { materiel: "1.30", mainOeuvre: null };
  const p = prixDUneLigneDictee("3 sacs de ciment", 3, { tarifs: [vente], achats: [ciment], marges });
  assert.equal(p.origine, "vente");
  assert.equal(p.montant, "36.00");
  const a = prixDUneLigneDictee("3 sacs de ciment", 3, { tarifs: [], achats: [ciment], marges });
  assert.equal(a.origine, "achat");
  assert.equal(a.montant, "31.20");
  assert.equal(a.prixUnitaire, "10.40");
  const r = prixDUneLigneDictee("Tonte", 1, { tarifs: [], achats: [ciment], marges });
  assert.equal(r.origine, "a_chiffrer");
  assert.equal(r.montant, null);
});

test("« 3 sacs de ciment » retrouve son tarif « Sac de ciment » comme il retrouve l'achat", () => {
  const vente = { tarifId: "t", intitule: "Sac de ciment", prix: "12.00", unite: "sac" };
  const autre = { tarifId: "u", intitule: "Tonte de pelouse", prix: "40.00", unite: null };
  const p = prixDUneLigneDictee("3 sacs de ciment", 3, { tarifs: [autre, vente], achats: [ciment], marges: { materiel: "1.30", mainOeuvre: null } });
  assert.equal(p.origine, "vente");
  assert.equal(p.montant, "36.00");
});

test("deux de ses tarifs qui répondent ne laissent pas passer un prix d'achat devant eux", () => {
  const t = (intitule: string) => ({ tarifId: intitule, intitule, prix: "12.00", unite: "sac" });
  const p = prixDUneLigneDictee("ciment", 1, { tarifs: [t("Ciment"), t("Ciment colle")], achats: [ciment], marges: { materiel: "1.30", mainOeuvre: null } });
  assert.equal(p.origine, "a_chiffrer");
  assert.equal(p.montant, null);
});

test("l'adresse d'un fournisseur : vide ou juste, jamais une phrase", () => {
  assert.deepEqual(lireAdresseMail("  "), { ok: true, email: null });
  assert.deepEqual(lireAdresseMail(" commande@aquaplus.fr "), { ok: true, email: "commande@aquaplus.fr" });
  assert.equal(lireAdresseMail("aqua plus").ok, false);
  assert.equal(lireAdresseMail("commande@aqua plus.fr").ok, false);
  assert.equal(lireAdresseMail("a@b@c").ok, false);
});

test("le début et la fin de son message : vides, celui d'office reprend", () => {
  assert.equal(lireMorceauDeMessage("  \n "), null);
  assert.equal(lireMorceauDeMessage("Bonjour Julien,\r\n\r\nVoici ma commande :"), "Bonjour Julien,\n\nVoici ma commande :");
  assert.equal(lireMorceauDeMessage("x".repeat(3000))?.length, 2000);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
