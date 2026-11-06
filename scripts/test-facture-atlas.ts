import assert from "node:assert/strict";
import { donneesFactureAtlas, numeroFactureAtlas, type VendeurAtlas } from "../src/lib/facture-atlas";
import { xmlFactureX } from "../src/lib/facture-x";
import { mentionLegaleFacture } from "../src/server/pdf/facture-pdf";

// ═══════════════════════════════════════════════════════════════════════════
// LA FACTURE D'ABONNEMENT D'ATLAS : la règle, et ce que la Factur-X en dit
// ═══════════════════════════════════════════════════════════════════════════
//
// Ses réponses du 5 novembre 2026 : TVA, et Factur-X. Ce contrôle passe la
// donnée par `xmlFactureX`, la règle du lot Factur-X, pour prouver que la
// pièce d'Atlas est une Factur-X que ce code accepte, et pas une facture à
// part qui lui ressemblerait.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const VENDEUR: VendeurAtlas = {
  nom: "Atlas SAS",
  adresse: "1 rue de la Paix 33000 Bordeaux",
  siret: "12345678900012",
  numeroTva: "FR32123456789",
  email: "factures@atlas.example",
};
const ACHETEUR = { nom: "Jardins Démo", adresse: "12 rue des Lilas 33700 Mérignac", siret: "98765432100015", numeroTva: "FR83987654321" };
const ENCAISSEMENT = {
  htCentimes: 3900,
  tvaCentimes: 780,
  ttcCentimes: 4680,
  tauxPourcent: 20,
  formuleNom: "Artisan",
  periodeDebut: "2026-11-06",
  periodeFin: "2026-12-05",
};
const fabriquer = (surcharge: Partial<Parameters<typeof donneesFactureAtlas>[0]> = {}) =>
  donneesFactureAtlas({ vendeur: VENDEUR, acheteur: ACHETEUR, numero: "AT2026-000001", dateEmission: "2026-11-06", encaissement: ENCAISSEMENT, ...surcharge });

console.log("=== Le numéro ===\n");

cas("AT, l'année, le rang sur six chiffres", () => {
  assert.equal(numeroFactureAtlas(1, 2026), "AT2026-000001");
  assert.equal(numeroFactureAtlas(1234, 2027), "AT2027-001234");
});

console.log("\n=== La pièce ===\n");

cas("39 € HT, 7,80 € de TVA, 46,80 € TTC, Atlas vendeur, l'artisan acheteur", () => {
  const r = fabriquer();
  assert.ok(r.ok, r.ok ? "" : r.raison);
  if (!r.ok) return;
  assert.equal(r.donnees.totalHt, "39.00");
  assert.equal(r.donnees.totalTva, "7.80");
  assert.equal(r.donnees.totalTtc, "46.80");
  assert.equal(r.donnees.entrepriseNom, "Atlas SAS");
  assert.equal(r.donnees.clientNom, "Jardins Démo");
  assert.equal(r.donnees.clientCivilite, "entreprise", "sans cela, « Jardins Démo » partirait en facture de particulier");
  assert.match(r.donnees.lignes[0].libelle, /Abonnement Atlas Artisan, du 06\/11\/2026 au 05\/12\/2026/);
});

cas("c'est une Factur-X que le code du lot Factur-X accepte", () => {
  const r = fabriquer();
  assert.ok(r.ok);
  if (!r.ok) return;
  const x = xmlFactureX(r.donnees, mentionLegaleFacture(r.donnees));
  assert.ok(x.ok, x.ok ? "" : `refusée : ${x.raison}`);
  if (!x.ok) return;
  assert.match(x.xml, /<ram:GrandTotalAmount>46\.80<\/ram:GrandTotalAmount>/);
  assert.match(x.xml, /AT2026-000001/);
});

console.log("\n=== Ce qui se refuse, et se dit ===\n");

cas("identité d'Atlas incomplète : rien ne part, et la phrase dit quoi", () => {
  const r = fabriquer({ vendeur: { ...VENDEUR, siret: null, numeroTva: "  " } });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.raison, /le SIRET/);
  assert.match(r.raison, /le numéro de TVA/);
});

cas("une TVA qui ne vient pas du taux : refusée", () => {
  const r = fabriquer({ encaissement: { ...ENCAISSEMENT, tvaCentimes: 0, ttcCentimes: 3900 } });
  assert.equal(r.ok, false);
});

cas("un total qui n'est pas HT plus TVA : refusé", () => {
  const r = fabriquer({ encaissement: { ...ENCAISSEMENT, ttcCentimes: 4681 } });
  assert.equal(r.ok, false);
});

cas("un prorata (changement de formule) qui se recoupe : accepté", () => {
  const r = fabriquer({ encaissement: { ...ENCAISSEMENT, htCentimes: 1333, tvaCentimes: 267, ttcCentimes: 1600 } });
  assert.ok(r.ok, r.ok ? "" : r.raison);
});

console.log(`\n${echecs === 0 ? "✅ 0 échec" : `❌ ${echecs} échec(s)`}`);
process.exit(echecs === 0 ? 0 : 1);
