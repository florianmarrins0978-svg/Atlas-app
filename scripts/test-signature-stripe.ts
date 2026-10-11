import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signerPourEssai, verifierSignature, TOLERANCE_SECONDES } from "../src/lib/signature-stripe";

// LA SIGNATURE DU CROCHET DE PAIEMENT — la seule chose qui sépare une
// notification du prestataire d'une requête écrite par n'importe qui.
//
// **Ce contrôle est le plus important de ce lot**, et c'est le seul du domaine
// qui puisse être joué ICI, sans compte, sans clé et sans réseau. Sans lui,
// l'adresse publique du crochet laisserait poster « abonnement payé » à qui le
// voudrait, et s'offrir la formule Illimité.
//
// **Un contrôle doit savoir échouer** (`CLAUDE.md` §5) : chaque contrefaçon
// ci-dessous a été construite pour passer si la vérification était naïve.

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

const SECRET = "whsec_un_secret_d_essai_qui_ne_sert_nulle_part";
const AUTRE_SECRET = "whsec_celui_de_quelqu_un_d_autre_0000000000";
const MAINTENANT = new Date("2026-09-10T12:00:00Z");
const CORPS = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } });

console.log("=== Ce qui doit passer ===\n");

cas("une signature fraîche et juste est acceptée", () => {
  const entete = signerPourEssai(CORPS, SECRET, MAINTENANT);
  const v = verifierSignature(CORPS, entete, SECRET, MAINTENANT);
  assert.equal(v.valide, true);
});

cas("plusieurs v1 dans l'en-tête : il suffit qu'UNE corresponde", () => {
  // Le prestataire en envoie deux pendant une rotation de secret. N'en lire
  // qu'une ferait tomber le crochet le jour où le secret change.
  const bonne = signerPourEssai(CORPS, SECRET, MAINTENANT).split("v1=")[1];
  const t = Math.floor(MAINTENANT.getTime() / 1000);
  const entete = `t=${t},v1=${"0".repeat(64)},v1=${bonne}`;
  assert.equal(verifierSignature(CORPS, entete, SECRET, MAINTENANT).valide, true);
});

cas("une clé inconnue dans l'en-tête ne fait pas échouer", () => {
  const bonne = signerPourEssai(CORPS, SECRET, MAINTENANT).split("v1=")[1];
  const t = Math.floor(MAINTENANT.getTime() / 1000);
  assert.equal(verifierSignature(CORPS, `t=${t},v0=abcdef,v1=${bonne}`, SECRET, MAINTENANT).valide, true);
});

cas("quelques secondes de décalage d'horloge restent acceptées", () => {
  const entete = signerPourEssai(CORPS, SECRET, MAINTENANT);
  const tard = new Date(MAINTENANT.getTime() + (TOLERANCE_SECONDES - 5) * 1000);
  assert.equal(verifierSignature(CORPS, entete, SECRET, tard).valide, true);
});

console.log("\n=== Les contrefaçons — chacune passerait si l'on vérifiait mal ===\n");

cas("LE CORPS MODIFIÉ est refusé, même d'un seul caractère", () => {
  const entete = signerPourEssai(CORPS, SECRET, MAINTENANT);
  const trafique = CORPS.replace("sub_1", "sub_2");
  const v = verifierSignature(trafique, entete, SECRET, MAINTENANT);
  assert.equal(v.valide, false);
  if (!v.valide) assert.equal(v.raison, "signature_fausse");
});

cas("UN AUTRE SECRET ne produit pas une signature valable", () => {
  const entete = signerPourEssai(CORPS, AUTRE_SECRET, MAINTENANT);
  assert.equal(verifierSignature(CORPS, entete, SECRET, MAINTENANT).valide, false);
});

cas("LE REJEU d'un événement authentique mais vieux est refusé", () => {
  // Sa signature est parfaite : c'est l'horodatage, et lui seul, qui l'arrête.
  const entete = signerPourEssai(CORPS, SECRET, MAINTENANT);
  const troisJoursApres = new Date(MAINTENANT.getTime() + 3 * 24 * 3600 * 1000);
  const v = verifierSignature(CORPS, entete, SECRET, troisJoursApres);
  assert.equal(v.valide, false);
  if (!v.valide) assert.equal(v.raison, "trop_vieille");
});

cas("un horodatage dans le FUTUR lointain est refusé aussi", () => {
  const loin = new Date(MAINTENANT.getTime() + 3 * 24 * 3600 * 1000);
  const entete = signerPourEssai(CORPS, SECRET, loin);
  const v = verifierSignature(CORPS, entete, SECRET, MAINTENANT);
  assert.equal(v.valide, false);
  if (!v.valide) assert.equal(v.raison, "trop_vieille");
});

cas("UNE SIGNATURE DÉPLACÉE d'un événement à l'autre est refusée", () => {
  // La faute classique : signer une fois, recopier l'en-tête ailleurs.
  const entete = signerPourEssai(CORPS, SECRET, MAINTENANT);
  const autre = JSON.stringify({ id: "evt_2", type: "customer.subscription.deleted" });
  assert.equal(verifierSignature(autre, entete, SECRET, MAINTENANT).valide, false);
});

cas("LE CORPS RÉANALYSÉ PUIS RÉÉCRIT ne retombe pas juste — le piège du crochet", () => {
  // C'est LE défaut qu'on rencontre en écrivant une route : lire `await
  // request.json()` puis re-sérialiser réordonne les clés et change les
  // espaces. Ce contrôle fixe la règle : on signe le corps EXACT reçu.
  const espace = `{ "id": "evt_1",  "type": "customer.subscription.updated" }`;
  const entete = signerPourEssai(espace, SECRET, MAINTENANT);
  const reecrit = JSON.stringify(JSON.parse(espace));
  assert.notEqual(reecrit, espace, "l'essai ne prouverait rien si la réécriture ne changeait rien");
  assert.equal(verifierSignature(reecrit, entete, SECRET, MAINTENANT).valide, false);
  assert.equal(verifierSignature(espace, entete, SECRET, MAINTENANT).valide, true);
});

console.log("\n=== Les en-têtes malformées ===\n");

cas("aucune en-tête : refusé, et le motif le dit", () => {
  const v = verifierSignature(CORPS, null, SECRET, MAINTENANT);
  assert.equal(v.valide, false);
  if (!v.valide) assert.equal(v.raison, "entete_absente");
});

cas("une en-tête vide vaut une en-tête absente", () => {
  const v = verifierSignature(CORPS, "   ", SECRET, MAINTENANT);
  assert.equal(v.valide, false);
  if (!v.valide) assert.equal(v.raison, "entete_absente");
});

cas("un horodatage non numérique rend l'en-tête illisible", () => {
  // Le laisser passer signerait « NaN.corps » : ça ressemble à une
  // vérification, et ça n'en est pas une.
  const v = verifierSignature(CORPS, "t=demain,v1=abcdef", SECRET, MAINTENANT);
  assert.equal(v.valide, false);
  if (!v.valide) assert.equal(v.raison, "entete_illisible");
});

cas("une en-tête sans v1 est illisible", () => {
  const t = Math.floor(MAINTENANT.getTime() / 1000);
  const v = verifierSignature(CORPS, `t=${t}`, SECRET, MAINTENANT);
  assert.equal(v.valide, false);
  if (!v.valide) assert.equal(v.raison, "entete_illisible");
});

cas("une signature de longueur inattendue est refusée, sans lever", () => {
  // `timingSafeEqual` lève sur deux tampons de tailles différentes : une
  // exception remonterait comme une panne du serveur au lieu d'un refus.
  const t = Math.floor(MAINTENANT.getTime() / 1000);
  const v = verifierSignature(CORPS, `t=${t},v1=abc`, SECRET, MAINTENANT);
  assert.equal(v.valide, false);
  if (!v.valide) assert.equal(v.raison, "signature_fausse");
});

console.log("\n=== La forme est bien celle que le prestataire documente ===\n");

cas("on signe « horodatage.corps », en SHA-256 hexadécimal", () => {
  // Écrit à la main, sans passer par `signerPourEssai` : sinon ce contrôle ne
  // ferait que comparer la fonction à elle-même.
  const t = Math.floor(MAINTENANT.getTime() / 1000);
  const attendue = createHmac("sha256", SECRET).update(`${t}.${CORPS}`, "utf8").digest("hex");
  assert.equal(attendue.length, 64);
  assert.equal(verifierSignature(CORPS, `t=${t},v1=${attendue}`, SECRET, MAINTENANT).valide, true);
});

cas("la casse de la signature reçue n'a pas d'importance", () => {
  const t = Math.floor(MAINTENANT.getTime() / 1000);
  const attendue = createHmac("sha256", SECRET).update(`${t}.${CORPS}`, "utf8").digest("hex");
  assert.equal(verifierSignature(CORPS, `t=${t},v1=${attendue.toUpperCase()}`, SECRET, MAINTENANT).valide, true);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
