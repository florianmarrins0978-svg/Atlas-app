import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { clientUrssaf } from "../src/server/urssaf/tiers-de-prestation";
import { demandePaiementPourUrssaf, particulierPourUrssaf } from "../src/lib/urssaf/avance-immediate";

// La liaison avec l'Urssaf, contre un FAUX serveur qui suit la description
// officielle de l'API Tiers de prestation (version 1.29.1) : jeton OAuth2
// « client credentials » en authentification Basic, portée
// `homeplus.tiersprestations`, puis `POST /particulier`,
// `POST /demandePaiement` (une liste) et `POST /demandePaiement/rechercher`.
//
// **Pourquoi un faux serveur, et ce qu'il ne prouve pas.** Le vrai ne répond
// qu'avec les codes que l'Urssaf donnera après l'habilitation : rien ne peut
// s'essayer sur lui avant. Ce contrôle prouve qu'Atlas parle la langue de la
// description officielle et qu'il survit à ses refus ; il ne prouve PAS que
// l'Urssaf accepte nos envois. Cela se jouera sur son bac à sable, avec les
// vrais codes.
//
// Aucun port fixe, aucune base : le serveur prend un port libre, et rien
// n'est vidé nulle part.

const ID = "id-de-demonstration";
const SECRET = "secret-de-demonstration-a-ne-jamais-journaliser";

type Etat = {
  jetons: number;
  jetonsRefuses: boolean;
  premierAppelRefuse: boolean;
  refuserInscription: boolean;
  corpsIllisible: boolean;
  dernierCorps: unknown;
  derniereAutorisation: string;
};
const etat: Etat = { jetons: 0, jetonsRefuses: false, premierAppelRefuse: false, refuserInscription: false, corpsIllisible: false, dernierCorps: null, derniereAutorisation: "" };

function lireCorps(req: http.IncomingMessage): Promise<string> {
  return new Promise((ok) => {
    let t = "";
    req.on("data", (c) => (t += c));
    req.on("end", () => ok(t));
  });
}

const serveur = http.createServer(async (req, res) => {
  const corps = await lireCorps(req);
  const json = (statut: number, valeur: unknown) => {
    res.writeHead(statut, { "Content-Type": "application/json" });
    res.end(JSON.stringify(valeur));
  };
  if (req.url === "/api/oauth/v1/token" && req.method === "POST") {
    const attendu = `Basic ${Buffer.from(`${ID}:${SECRET}`).toString("base64")}`;
    const form = new URLSearchParams(corps);
    if (etat.jetonsRefuses || req.headers.authorization !== attendu) return json(401, { error: "invalid_client" });
    if (form.get("grant_type") !== "client_credentials" || form.get("scope") !== "homeplus.tiersprestations") return json(400, { error: "invalid_request" });
    etat.jetons++;
    return json(200, { access_token: `jeton-${etat.jetons}`, token_type: "Bearer", expires_in: 3600 });
  }
  etat.derniereAutorisation = String(req.headers.authorization ?? "");
  if (!etat.derniereAutorisation.startsWith("Bearer jeton-")) return json(401, [{ code: "401", message: "Jeton absent" }]);
  if (etat.premierAppelRefuse) {
    etat.premierAppelRefuse = false;
    return json(401, [{ code: "401", message: "Jeton expiré" }]);
  }
  if (etat.corpsIllisible) {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end("<html>maintenance</html>");
  }
  etat.dernierCorps = corps ? JSON.parse(corps) : null;
  if (req.url === "/atp/particulier" && req.method === "POST") {
    if (etat.refuserInscription) return json(400, [{ code: "ERR_LIEU_NAISSANCE", message: "Lieu de naissance incohérent", description: "Le code commune ne correspond pas au département." }]);
    return json(200, { idClient: "11000000000104" });
  }
  if (req.url === "/atp/demandePaiement" && req.method === "POST") {
    const liste = etat.dernierCorps as { idClient: string; numFactureTiers: string }[];
    return json(200, liste.map((d, i) => ({ idDemandePaiement: `DP${i + 1}`, idClient: d.idClient, numFactureTiers: d.numFactureTiers, statut: "10", errors: [] })));
  }
  if (req.url === "/atp/demandePaiement/rechercher" && req.method === "POST") {
    return json(200, { infoDemandePaiements: [{ idDemandePaiement: "DP1", statut: { code: "20", libelle: "Validée" } }], errors: [] });
  }
  return json(404, [{ code: "404", message: "Inconnu" }]);
});

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

function remettre() {
  Object.assign(etat, { jetons: 0, jetonsRefuses: false, premierAppelRefuse: false, refuserInscription: false, corpsIllisible: false, dernierCorps: null, derniereAutorisation: "" });
}

/** Ce qui s'écrit pendant un geste, pour vérifier qu'aucun secret n'y passe. */
async function journalDe(geste: () => Promise<unknown>): Promise<string> {
  let ecrit = "";
  const origines = [process.stdout.write.bind(process.stdout), process.stderr.write.bind(process.stderr)];
  const capter = (chunk: unknown) => { ecrit += String(chunk); return true; };
  process.stdout.write = capter as typeof process.stdout.write;
  process.stderr.write = capter as typeof process.stderr.write;
  try {
    await geste();
  } finally {
    process.stdout.write = origines[0];
    process.stderr.write = origines[1];
  }
  return ecrit;
}

(async () => {
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", () => ok()));
  const port = (serveur.address() as AddressInfo).port;
  const racine = `http://127.0.0.1:${port}`;
  const options = { base: `${racine}/atp`, jetonUrl: `${racine}/api/oauth/v1/token` };

  const particulier = particulierPourUrssaf({
    civilite: "M", nomNaissance: "Lambert", prenoms: "Pierre", dateNaissance: "1961-04-12",
    naissance: { enFrance: true, departement: "044", codeCommune: "109" },
    portable: "0612345678", email: "p.lambert@exemple.fr",
    adresse: { codePostal: "44400", codeCommune: "44143", libelleCommune: "REZE" },
    banque: { iban: "FR7630006000011234567890189", bic: "BNAPFRPP", titulaire: "M. Pierre Lambert" },
  });
  assert.ok(particulier.ok);
  if (!particulier.ok) return;

  console.log("Les deux codes");

  await cas("les bons codes passent : le geste « Relier » le vérifie", async () => {
    remettre();
    const r = await clientUrssaf({ clientId: ID, clientSecret: SECRET }, options).verifierCodes();
    assert.deepEqual(r, { ok: true });
  });

  await cas("de mauvais codes se disent comme tels, sans fuite du secret", async () => {
    remettre();
    let r: unknown;
    const journal = await journalDe(async () => { r = await clientUrssaf({ clientId: ID, clientSecret: "faux" }, options).verifierCodes(); });
    assert.deepEqual(r, { ok: false, raison: "codes-refuses" });
    assert.ok(!journal.includes("faux") && !journal.includes(SECRET), "le secret ne s'écrit jamais");
  });

  await cas("un jeton sert jusqu'à sa fin, puis se renouvelle seul", async () => {
    remettre();
    let horloge = 1_000_000;
    const c = clientUrssaf({ clientId: ID, clientSecret: SECRET }, { ...options, maintenant: () => horloge });
    await c.inscrireParticulier(particulier.valeur);
    await c.inscrireParticulier(particulier.valeur);
    assert.equal(etat.jetons, 1, "un seul jeton pour deux appels");
    horloge += 3600 * 1000;
    await c.inscrireParticulier(particulier.valeur);
    assert.equal(etat.jetons, 2, "un jeton neuf passé l'heure");
  });

  await cas("un jeton révoqué en cours de route : un seul nouvel essai, et ça passe", async () => {
    remettre();
    const c = clientUrssaf({ clientId: ID, clientSecret: SECRET }, options);
    await c.verifierCodes();
    etat.premierAppelRefuse = true;
    const r = await c.inscrireParticulier(particulier.valeur);
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(etat.jetons, 2);
  });

  console.log("\nInscrire un client");

  await cas("l'Urssaf rend l'identifiant du client", async () => {
    remettre();
    const r = await clientUrssaf({ clientId: ID, clientSecret: SECRET }, options).inscrireParticulier(particulier.valeur);
    assert.deepEqual(r, { ok: true, idClient: "11000000000104" });
    assert.equal((etat.dernierCorps as { adresseMail: string }).adresseMail, "p.lambert@exemple.fr");
  });

  await cas("un refus de l'Urssaf revient avec SES mots, en valeur et non en exception", async () => {
    remettre();
    etat.refuserInscription = true;
    const r = await clientUrssaf({ clientId: ID, clientSecret: SECRET }, options).inscrireParticulier(particulier.valeur);
    assert.equal(r.ok, false);
    if (r.ok || r.raison !== "refuse") throw new Error(`attendu « refuse », reçu ${JSON.stringify(r)}`);
    assert.equal(r.statutHttp, 400);
    assert.equal(r.erreurs[0].message, "Lieu de naissance incohérent");
  });

  console.log("\nTransmettre et suivre une facture");

  await cas("la facture part en LISTE d'une demande, et revient avec son identifiant", async () => {
    remettre();
    const d = demandePaiementPourUrssaf({
      idTiersFacturation: "jardins.demo", numeroOrganisme: "SAP123456789", idClient: "11000000000104",
      dateNaissanceClient: "1961-04-12", numero: "F2026-000041", dateFacture: "2026-11-05",
      debutEmploi: "2026-11-05", finEmploi: "2026-11-05", dejaRegleCentimes: 0,
      lignes: [{ codeNature: "NATURE-A-CONFIRMER", quantite: 1, unite: "FORFAIT", unitaireTTCCentimes: 50400, htCentimes: 42000, tvaCentimes: 8400, ttcCentimes: 50400 }],
    });
    assert.ok(d.ok);
    if (!d.ok) return;
    const r = await clientUrssaf({ clientId: ID, clientSecret: SECRET }, options).transmettreDemande(d.valeur);
    assert.ok(r.ok, JSON.stringify(r));
    if (!r.ok) return;
    assert.equal(r.demande.idDemandePaiement, "DP1");
    assert.ok(Array.isArray(etat.dernierCorps) && (etat.dernierCorps as unknown[]).length === 1, "une liste d'une seule demande");
  });

  await cas("relire les demandes rend leur statut", async () => {
    remettre();
    const r = await clientUrssaf({ clientId: ID, clientSecret: SECRET }, options).rechercherDemandes({ idDemandePaiements: ["DP1"] });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.demandes[0].statut?.libelle, "Validée");
    assert.deepEqual(etat.dernierCorps, { idDemandePaiements: ["DP1"] });
  });

  console.log("\nQuand ça tourne mal");

  await cas("l'Urssaf injoignable : « injoignable », pas une exception", async () => {
    remettre();
    const r = await clientUrssaf({ clientId: ID, clientSecret: SECRET }, { base: "http://127.0.0.1:1/atp", jetonUrl: "http://127.0.0.1:1/token", delaiMs: 2000 }).verifierCodes();
    assert.deepEqual(r, { ok: false, raison: "injoignable" });
  });

  await cas("une page de maintenance à la place du JSON : « illisible »", async () => {
    remettre();
    const c = clientUrssaf({ clientId: ID, clientSecret: SECRET }, options);
    await c.verifierCodes();
    etat.corpsIllisible = true;
    const r = await c.inscrireParticulier(particulier.valeur);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.raison, "illisible");
  });

  await cas("des codes retirés par l'Urssaf entre deux appels : « codes-refuses »", async () => {
    remettre();
    const c = clientUrssaf({ clientId: ID, clientSecret: SECRET }, options);
    await c.verifierCodes();
    etat.premierAppelRefuse = true;
    etat.jetonsRefuses = true;
    const r = await c.inscrireParticulier(particulier.valeur);
    assert.deepEqual(r, { ok: false, raison: "codes-refuses" });
  });

  serveur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Liaison avec l'Urssaf : ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
})();
