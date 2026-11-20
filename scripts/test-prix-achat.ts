import assert from "node:assert/strict";
import {
  ceQuiLaTrouve,
  dateesAMontrer,
  initialesDeLaSociete,
  ligneDeMarge,
  lireAdresseMail,
  lireMarge,
  lireTelephone,
  lireMorceauDeMessage,
  achatRetenuEnMots,
  margeEnPourcent,
  prixDAchatEnMots,
  phraseDeLaMargePropre,
  prixAchatCorrespondant,
  prixAchatsProposes,
  prixDepuisAchat,
  quantiteDictee,
  resumeDeLaSociete,
  societesAMontrer,
  prixDUneLigneDictee,
  type PrixAchatCandidat,
} from "../src/lib/prix-achat";

// Ses règles du 18 et du 19 octobre 2026 (`src/lib/prix-achat.ts`), avec ses
// chiffres à lui : le sac de ciment acheté 8 €, sa marge de 30 % (le
// coefficient 1,30 en base). La marge se tape en pour cent depuis sa planche B
// du 20 novembre 2026 (`appli/sans-marge-sur-les-pieces.html`).

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

test("la marge se tape en pour cent : 30 fait 30 %, 0 fait sans marge, vide reste à donner", () => {
  assert.deepEqual(lireMarge("30"), { ok: true, marge: "1.30" });
  assert.deepEqual(lireMarge("30 %"), { ok: true, marge: "1.30" });
  assert.deepEqual(lireMarge(" 5 "), { ok: true, marge: "1.05" });
  // Sa demande du 20 novembre 2026 : un artisan qui ne prend pas de marge doit
  // pouvoir le dire. 0 % vend au prix du fournisseur.
  assert.deepEqual(lireMarge("0"), { ok: true, marge: "1.00" });
  assert.deepEqual(lireMarge("200"), { ok: true, marge: "3.00" });
  // Vide n'est PAS « sans marge » : un oubli vendrait au prix d'achat sans rien dire.
  assert.deepEqual(lireMarge(""), { ok: true, marge: null });
});

test("une marge qui ne se lit pas en pour cent est refusée, avec ce qu'il faut taper", () => {
  const conseil = { ok: false, raison: "Tapez la marge en pour cent : 30 pour 30 %." };
  // L'ancien coefficient, tapé par habitude : refusé, pas lu 1 %.
  assert.deepEqual(lireMarge("1,30"), conseil);
  assert.deepEqual(lireMarge("12,5"), conseil);
  assert.deepEqual(lireMarge("abc"), conseil);
  assert.deepEqual(lireMarge("-10"), conseil);
  assert.deepEqual(lireMarge("250"), { ok: false, raison: "Au-delà de 200 %, vérifiez le chiffre." });
});

test("le coefficient en base s'écrit en pour cent dans la case", () => {
  assert.equal(margeEnPourcent("1.30"), "30");
  assert.equal(margeEnPourcent("1.00"), "0");
  assert.equal(margeEnPourcent("3.00"), "200");
  assert.equal(margeEnPourcent(null), "");
});

test("la marge propre d'une société passe avant la générale, et se dit en pour cent", () => {
  assert.equal(ligneDeMarge(null, null), "Marge à donner");
  assert.equal(ligneDeMarge(null, "1.30"), "Marge 30 %");
  assert.equal(ligneDeMarge("1.50", "1.30"), "Marge 50 %, la sienne");
  assert.equal(ligneDeMarge(null, "1.00"), "Sans marge");
  assert.equal(ligneDeMarge("1.00", "1.30"), "Sans marge, la sienne");
  assert.equal(phraseDeLaMargePropre(null, "1.30"), "Votre marge générale, 30 %. Tapez-en une autre pour lui seul.");
  assert.equal(phraseDeLaMargePropre(null, "1.00"), "Votre marge générale, sans marge. Tapez-en une autre pour lui seul.");
  assert.equal(phraseDeLaMargePropre("1.50", "1.30"), "La sienne. Videz la case pour reprendre la marge générale (30 %).");
  assert.equal(phraseDeLaMargePropre(null, null), "Pas encore donnée.");
});

test("3 sacs de ciment : 8 € × 3 × 1,30 = 31,20 €, et la source le dit", () => {
  const c = prixAchatCorrespondant("Il me faut 3 sacs de ciment", [ciment]);
  assert.equal(c?.id, "1");
  const p = prixDepuisAchat(c!, quantiteDictee("3 sacs de ciment"), { materiel: "1.30", mainOeuvre: null });
  assert.equal(p.venteHt, "31.20");
  assert.equal(p.source, "Acheté 24,00 € chez Point P le 12/10/2026, plus 30 %, votre marge sur le matériel.");
  const sans = prixDepuisAchat(c!, 3, { materiel: "1.00", mainOeuvre: null });
  assert.equal(sans.venteHt, "24.00");
  assert.equal(sans.source, "Acheté 24,00 € chez Point P le 12/10/2026, sans marge.");
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
  assert.equal(sienne.source, "Main d’œuvre de Pilou : 20,00 € le 12/10/2026, plus 50 %, sa marge à part.");
});

test("aucun mot en commun : aucun prix ; à égalité, le moins cher", () => {
  assert.equal(prixAchatCorrespondant("Tonte de pelouse", [ciment]), null);
  const autre = { ...ciment, id: "3", prixHt: "7.50", societeNom: "Gedimat" };
  assert.equal(prixAchatCorrespondant("2 sacs de ciment", [ciment, autre])?.id, "3");
});

test("sur un devis tapé à la main, tous les prix qui répondent, le moins cher d'abord", () => {
  // Sa demande du 20 novembre 2026 (`appli/le-prix-d-une-piece.html`) : sous
  // « Sac de terreau », ses prix chez chaque fournisseur, et il choisit. La
  // même règle que le devis dicté, qui ne garde que le premier.
  const val = { ...ciment, id: "t1", nom: "Terreau horticole 50 L", prixHt: "9.80", societeNom: "Pépinières du Val" };
  const garnier = { ...ciment, id: "t2", nom: "Terreau universel 40 L", prixHt: "8.90", societeNom: "Matériaux Garnier" };
  const tous = [ciment, val, garnier];
  assert.deepEqual(prixAchatsProposes("Sac de terreau", tous).map((c) => c.id), ["t2", "t1"]);
  assert.equal(prixAchatCorrespondant("Sac de terreau", tous)?.id, "t2");
  // « sac » dit l'emballage, pas ce qu'on achète : il ne rapproche pas le
  // terreau du ciment. Le devis dicté prenait le ciment, le moins cher des trois.
  assert.equal(prixAchatCorrespondant("Il me faut 2 sacs de terreau", tous)?.id, "t2");
  assert.equal(prixAchatCorrespondant("3 sacs de ciment", tous)?.id, "1");
  assert.deepEqual(prixAchatsProposes("Tonte de pelouse", tous), []);
  assert.deepEqual(prixAchatsProposes("", tous), []);
});

test("un prix d'achat se dit comme il le paie, et le fournisseur reste écrit sous la ligne", () => {
  const sp = (t: string) => t.replace(/[\u00a0\u202f]/g, " ");
  assert.equal(sp(prixDAchatEnMots({ prixHt: "8.90", unite: "sac" })), "8,90 € HT le sac");
  assert.equal(sp(prixDAchatEnMots({ prixHt: "12", unite: "pièce" })), "12,00 € HT la pièce");
  assert.equal(sp(prixDAchatEnMots({ prixHt: "52", unite: "palette" })), "52,00 € HT la palette");
  assert.equal(sp(prixDAchatEnMots({ prixHt: "1250", unite: "m³" })), "1 250,00 € HT le m³");
  assert.equal(
    sp(achatRetenuEnMots({ societeNom: "Matériaux Garnier", prixHt: "8.90", unite: "sac" })),
    "Matériaux Garnier, 8,90 € HT le sac"
  );
});

test("un téléphone de fournisseur : des chiffres, jamais une phrase", () => {
  assert.deepEqual(lireTelephone("04 75 12 34 56"), { ok: true, telephone: "04 75 12 34 56" });
  assert.deepEqual(lireTelephone(" +33 (0)4.75.12.34.56 "), { ok: true, telephone: "+33 (0)4.75.12.34.56" });
  assert.deepEqual(lireTelephone(""), { ok: true, telephone: null });
  assert.equal(lireTelephone("appelez-nous").ok, false);
  assert.equal(lireTelephone("12").ok, false);
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

test("une ligne dictée chiffrée par un achat garde son fournisseur, pour lui seul (sa planche 2 du 19 novembre 2026)", () => {
  const marges = { materiel: "1.30", mainOeuvre: null };
  const a = prixDUneLigneDictee("3 sacs de ciment", 3, { tarifs: [], achats: [ciment], marges });
  assert.equal(a.achatRetenu?.replace(/\s/g, " "), "Point P, 8,00 € HT le sac");
  // Son prix de vente ne vient d'aucun fournisseur ; une ligne à chiffrer non plus.
  const vente = prixDUneLigneDictee("3 sacs de ciment", 3, { tarifs: [{ tarifId: "t", intitule: "Sac de ciment", prix: "12.00", unite: "sac" }], achats: [ciment], marges });
  assert.equal(vente.achatRetenu, undefined);
  const sansMarge = prixDUneLigneDictee("3 sacs de ciment", 3, { tarifs: [], achats: [ciment], marges: { materiel: null, mainOeuvre: null } });
  assert.equal(sansMarge.origine, "a_chiffrer");
  assert.equal(sansMarge.achatRetenu, undefined);
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

test("le rond d'une société porte les lettres de ses mots à majuscule, jamais rien", () => {
  assert.equal(initialesDeLaSociete("Jardinerie du Centre"), "JC");
  assert.equal(initialesDeLaSociete("Matériaux Martin"), "MM");
  assert.equal(initialesDeLaSociete("Pilou"), "P");
  assert.equal(initialesDeLaSociete("Écorces et Bois"), "ÉB");
  assert.equal(initialesDeLaSociete("pépinière rivière"), "PR");
  assert.equal(initialesDeLaSociete("   "), "?");
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
