// Sous quel domaine Atlas enregistre une clé d'appareil — la règle, sans réseau.
//
// **CE QUE CETTE SUITE PROTÈGE.** Une clé WebAuthn est attachée à un domaine et
// ne s'ouvre que là. Se tromper de domaine ne produit ni erreur ni message :
// le navigateur refuse **en silence**, et l'artisan voit un bouton qui ne fait
// rien. C'est exactement le genre de panne qui coûte une soirée et qu'aucun
// journal ne raconte — d'où un refus explicite, ici, plutôt qu'une devinette.

import assert from "node:assert/strict";
import { origineWebAuthn } from "../src/lib/origine-webauthn";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Origine WebAuthn : où Atlas se nomme ===\n");

// ─── En production : rien ne se devine ──────────────────────────────────────

essai("EN PRODUCTION, sans ATLAS_RP_ID, on REFUSE — jamais on ne devine", () => {
  const v = origineWebAuthn({ hote: "atlas.fr", protocole: "https", horsProduction: false });
  assert.equal(v.ok, false);
  if (!v.ok) {
    assert.equal(v.code, "domaine-non-declare");
    // Le message doit désigner la CONFIGURATION, pas le téléphone de l'artisan.
    assert.match(v.raison, /ATLAS_RP_ID/);
  }
});

essai("EN PRODUCTION, l'hôte annoncé ne prend JAMAIS la place du domaine épinglé", () => {
  // C'est l'attaque que ce refus ferme : un en-tête `Host` composé par celui
  // qui frappe ne doit pas décider sous quel domaine une clé est posée.
  const v = origineWebAuthn({
    hote: "pirate.example",
    protocole: "https",
    domaineEpingle: "atlas.fr",
    horsProduction: false,
  });
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.code, "domaine-discordant");
});

essai("le refus de discordance NOMME les deux valeurs qui ne s'accordent pas", () => {
  const v = origineWebAuthn({
    hote: "ancien.fr",
    protocole: "https",
    domaineEpingle: "atlas.fr",
    horsProduction: false,
  });
  assert.equal(v.ok, false);
  if (!v.ok) {
    assert.match(v.raison, /atlas\.fr/);
    assert.match(v.raison, /ancien\.fr/);
  }
});

essai("un SOUS-DOMAINE est couvert par le domaine épinglé — une clé doit suivre", () => {
  const v = origineWebAuthn({
    hote: "app.atlas.fr",
    protocole: "https",
    domaineEpingle: "atlas.fr",
    horsProduction: false,
  });
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.origine.rpId, "atlas.fr");
    // L'ORIGINE, elle, garde l'hôte réel : le navigateur la compare caractère
    // pour caractère.
    assert.equal(v.origine.origine, "https://app.atlas.fr");
  }
});

essai("un domaine qui RESSEMBLE au domaine épinglé ne passe pas", () => {
  // `mechantatlas.fr` se termine par « atlas.fr » sans en être un sous-domaine :
  // comparer par simple suffixe de texte laisserait passer exactement ça.
  const v = origineWebAuthn({
    hote: "mechantatlas.fr",
    protocole: "https",
    domaineEpingle: "atlas.fr",
    horsProduction: false,
  });
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.code, "domaine-discordant");
});

// ─── Le port fait partie de l'origine, jamais du domaine ────────────────────

essai("le PORT reste dans l'origine et sort du domaine", () => {
  const v = origineWebAuthn({ hote: "localhost:3000", protocole: "http", horsProduction: true });
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.origine.rpId, "localhost");
    assert.equal(v.origine.origine, "http://localhost:3000");
  }
});

essai("une adresse IPv6 garde ses crochets", () => {
  const v = origineWebAuthn({ hote: "[::1]:3000", protocole: "http", horsProduction: true });
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.origine.rpId, "[::1]");
});

// ─── HTTPS ──────────────────────────────────────────────────────────────────

essai("hors localhost, http est REFUSÉ — le navigateur refuserait sans un mot", () => {
  const v = origineWebAuthn({ hote: "192.168.1.20:3000", protocole: "http", horsProduction: true });
  assert.equal(v.ok, false);
  if (!v.ok) {
    assert.equal(v.code, "sans-https");
    assert.match(v.raison, /https/i);
  }
});

essai("localhost en clair est la seule exception, et elle passe", () => {
  for (const hote of ["localhost", "127.0.0.1:3000", "[::1]"]) {
    const v = origineWebAuthn({ hote, protocole: "http", horsProduction: true });
    assert.equal(v.ok, true, `${hote} devrait passer`);
  }
});

essai("sans protocole annoncé, on suppose https — jamais l'inverse", () => {
  const v = origineWebAuthn({ hote: "banc.exemple.fr", protocole: null, horsProduction: true });
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.origine.origine, "https://banc.exemple.fr");
});

// ─── Hors production : l'hôte suffit ────────────────────────────────────────

essai("HORS PRODUCTION, l'hôte de la requête suffit — le banc change d'adresse", () => {
  const v = origineWebAuthn({
    hote: "atlas-3000.app.github.dev",
    protocole: "https",
    horsProduction: true,
  });
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.origine.rpId, "atlas-3000.app.github.dev");
});

// ─── Ce qui n'est pas un domaine ────────────────────────────────────────────

essai("un hôte absent est refusé, et le dit", () => {
  for (const hote of [null, undefined, "", "   "]) {
    const v = origineWebAuthn({ hote, protocole: "https", horsProduction: true });
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.code, "hote-absent");
  }
});

essai("un hôte qui porte un chemin ou une espace n'est pas un domaine", () => {
  for (const hote of ["atlas.fr/chemin", "atlas .fr", "https://atlas.fr"]) {
    const v = origineWebAuthn({ hote, protocole: "https", horsProduction: true });
    assert.equal(v.ok, false, `« ${hote} » ne devrait pas passer`);
  }
});

essai("la casse ne fabrique pas un domaine neuf", () => {
  const a = origineWebAuthn({ hote: "Atlas.FR", protocole: "HTTPS", horsProduction: true });
  const b = origineWebAuthn({ hote: "atlas.fr", protocole: "https", horsProduction: true });
  assert.equal(a.ok && b.ok && a.origine.rpId === b.origine.rpId, true);
  assert.equal(a.ok && b.ok && a.origine.origine === b.origine.origine, true);
});

console.log("");
console.log(`Origine WebAuthn — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
