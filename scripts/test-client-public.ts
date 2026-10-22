import assert from "node:assert/strict";
import {
  avecCivilite,
  estUneEntreprise,
  estUnClientProfessionnel,
  estUnClientPublic,
  PASTILLES_CIVILITE,
} from "../src/lib/civilite";
import {
  DELAI_MAX_PUBLIC_JOURS,
  MENTION_RETARD_PUBLIC,
  delaiDePaiement,
  echeanceMaxJours,
  lignesChorus,
  referenceChorusLue,
} from "../src/lib/facture-publique";
import { ECHEANCE_MAX_JOURS, validerEcheance } from "../src/lib/echeance-facture";

// **FACTURER UNE MAIRIE** — ses choix du 22 octobre 2026
// (`appli/facture-mairie-chorus.html`).
//
// Une mairie ne paie qu'une facture déposée sur Chorus Pro, et le dépôt se
// refuse sans le bon numéro d'engagement ou le bon code service. Ce contrôle
// tient les règles pures : qui est un client public, ce que sa facture
// imprime, et jusqu'où va son échéance (Code de la commande publique,
// art. D2192-2, et le délai de 30 jours des acheteurs publics).

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("Qui est un client public");

cas("« Public » est une pastille, à côté de Mr, Mme et Entreprise", () => {
  assert.equal(PASTILLES_CIVILITE.public, "Public");
  assert.deepEqual(Object.keys(PASTILLES_CIVILITE), ["mr", "mme", "entreprise", "public"]);
});

cas("son choix décide, quel que soit le nom", () => {
  assert.equal(estUnClientPublic("Jardins du Bourg", "public"), true);
  assert.equal(estUnClientPublic("Mairie de Rezé", "entreprise"), false, "il a choisi Entreprise");
  assert.equal(estUnClientPublic("Mairie de Rezé", "mr"), false, "il a choisi Mr");
});

cas("sans choix, le nom d'une collectivité suffit", () => {
  for (const nom of [
    "Mairie de Rezé",
    "Commune de Bouguenais",
    "Ville de Nantes",
    "Communauté de communes Sud Estuaire",
    "Département de Loire-Atlantique",
    "SIVOM de la Loire",
    "CCAS de Rezé",
  ]) {
    assert.equal(estUnClientPublic(nom, null), true, nom);
  }
});

cas("sans choix, un particulier ou une société n'est pas public", () => {
  for (const nom of ["Martins", "SARL Untel", "Villeneuve Paysage", "Jardins Ribault", ""]) {
    assert.equal(estUnClientPublic(nom, null), false, nom);
  }
});

cas("un client public n'est pas une entreprise : pas de sous-traitance, pas de « Vos entreprises »", () => {
  assert.equal(estUneEntreprise("Mairie de Rezé", null), false);
  assert.equal(estUneEntreprise("Jardins du Bourg", "public"), false);
  assert.equal(estUneEntreprise("SARL Untel", null), true, "une société reste une entreprise");
  assert.equal(estUneEntreprise("Jardins Ribault", "entreprise"), true);
});

cas("un client public reste un client professionnel : les 40 € de son devis ne disparaissent pas", () => {
  assert.equal(estUnClientProfessionnel("Mairie de Rezé", null), true);
  assert.equal(estUnClientProfessionnel("Jardins du Bourg", "public"), true);
  assert.equal(estUnClientProfessionnel("SARL Untel", null), true);
  assert.equal(estUnClientProfessionnel("Martins", null), false);
  assert.equal(estUnClientProfessionnel("Mairie de Rezé", "mme"), false, "son choix « Mme » prime");
});

cas("son nom s'écrit seul, sans Mr ni Mme", () => {
  assert.equal(avecCivilite("Mairie de Rezé", "public"), "Mairie de Rezé");
  assert.equal(avecCivilite("Bouguenais", "public"), "Bouguenais");
});

console.log("\nCe que sa facture porte");

cas("le numéro d'engagement et le code service s'impriment tels qu'écrits, sans les espaces autour", () => {
  assert.deepEqual(lignesChorus({ numeroEngagement: " BC2026/0318 ", codeService: "SERV-TECH" }), [
    "N° d'engagement BC2026/0318",
    "Code service SERV-TECH",
  ]);
});

cas("une ligne vide ne s'imprime pas", () => {
  assert.deepEqual(lignesChorus({ numeroEngagement: null, codeService: "  " }), []);
  assert.deepEqual(lignesChorus({ numeroEngagement: "BC1", codeService: null }), ["N° d'engagement BC1"]);
});

cas("la casse se garde : Chorus Pro compare le code service à la lettre près", () => {
  assert.equal(referenceChorusLue("  serv-Tech  "), "serv-Tech");
  assert.equal(referenceChorusLue("BC  2026"), "BC 2026");
  assert.equal(referenceChorusLue("   "), "");
});

cas("la phrase des retards est celle de la commande publique", () => {
  assert.match(MENTION_RETARD_PUBLIC, /BCE majoré de 8 points/);
  assert.match(MENTION_RETARD_PUBLIC, /40 €/);
  assert.doesNotMatch(MENTION_RETARD_PUBLIC, /trois fois le taux/);
});

console.log("\nSon échéance");

cas("30 jours au plus pour un client public, son délai pour les autres", () => {
  assert.equal(DELAI_MAX_PUBLIC_JOURS, 30);
  assert.equal(delaiDePaiement(45, true), 30);
  assert.equal(delaiDePaiement(15, true), 15);
  assert.equal(delaiDePaiement(0, true), 0, "le comptant reste le comptant");
  assert.equal(delaiDePaiement(45, false), 45);
  assert.equal(echeanceMaxJours(true), 30);
  assert.equal(echeanceMaxJours(false), ECHEANCE_MAX_JOURS);
});

cas("une échéance à 31 jours se refuse pour une mairie, se garde pour un particulier", () => {
  assert.equal(validerEcheance("2026-10-22", "2026-11-22", echeanceMaxJours(true)).ok, false);
  assert.equal(validerEcheance("2026-10-22", "2026-11-21", echeanceMaxJours(true)).ok, true);
  assert.equal(validerEcheance("2026-10-22", "2026-11-22", echeanceMaxJours(false)).ok, true);
});

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("\nTous les contrôles du client public sont passés.");
