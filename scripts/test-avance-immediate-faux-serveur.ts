import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { chercherCommuneDeNaissance } from "../src/server/adresses/communes";
import { adresseDecoupee } from "../src/server/adresses/base-adresse-nationale";
import { clientUrssaf } from "../src/server/urssaf/tiers-de-prestation";
import { etatDuParticulier, phraseDuRefus } from "../src/lib/urssaf/branchement";

// LE BRANCHEMENT DE L'AVANCE IMMÉDIATE (lot 3), contre de FAUX serveurs : le
// découpage administratif de l'État (geo.api.gouv.fr), la Base Adresse
// Nationale, et l'Urssaf. Rien ne part vers un vrai service : chaque appel
// prend l'adresse d'un serveur local, sur un port libre.
//
// **Ce que ce contrôle prouve, et ce qu'il ne prouve pas.** Que l'inscription
// d'un client trouve la commune de naissance par son nom ET son département,
// découpe l'adresse de la fiche, et survit à un service qui refuse ou se tait ;
// que l'état relu chez l'Urssaf et ses refus se disent en clair. Il ne prouve
// PAS que l'Urssaf accepte la forme de ces réponses : la route de l'état du
// client n'est pas dans la description 1.29.1, et cela se jouera sur son bac à
// sable, avec les vrais codes.

type Etat = { derniereRecherche: URLSearchParams | null; communesEnPanne: boolean; banEnPanne: boolean; statut: unknown };
const etat: Etat = { derniereRecherche: null, communesEnPanne: false, banEnPanne: false, statut: null };

const serveur = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://local");
  const json = (statut: number, valeur: unknown) => {
    res.writeHead(statut, { "Content-Type": "application/json" });
    res.end(JSON.stringify(valeur));
  };
  if (url.pathname === "/communes") {
    etat.derniereRecherche = url.searchParams;
    if (etat.communesEnPanne) return json(503, { message: "maintenance" });
    const nom = (url.searchParams.get("nom") ?? "").toLowerCase();
    const dep = url.searchParams.get("codeDepartement");
    const toutes = [
      { nom: "Nantes", code: "44109", codeDepartement: "44" },
      { nom: "Nanteuil", code: "44110", codeDepartement: "44" },
      { nom: "Saint-Herblain", code: "44162", codeDepartement: "44" },
    ];
    return json(200, toutes.filter((c) => c.codeDepartement === dep && c.nom.toLowerCase().startsWith(nom.slice(0, 4))));
  }
  if (url.pathname === "/search/") {
    if (etat.banEnPanne) return json(500, {});
    const q = url.searchParams.get("q") ?? "";
    if (q.includes("nulle part")) return json(200, { features: [{ properties: { label: "Ailleurs", score: 0.21, citycode: "75056", postcode: "75001", city: "Paris" } }] });
    return json(200, {
      features: [{ properties: { type: "housenumber", housenumber: "12", street: "Rue des Lilas", postcode: "44400", citycode: "44143", city: "Rezé", score: 0.96 } }],
    });
  }
  if (url.pathname === "/api/oauth/v1/token") return json(200, { access_token: "jeton-1", expires_in: 3600 });
  if (url.pathname === "/atp/particulier" && req.method === "GET") return json(200, etat.statut);
  if (url.pathname === "/atp/demandePaiement" && req.method === "POST") {
    return json(200, [{ numFactureTiers: "F2026-000041", errors: [{ code: "ERR_PERIODE", message: "Période", description: "La période d'emploi dépasse un mois calendaire." }] }]);
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

async function principal() {
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  const urssaf = clientUrssaf({ clientId: "id", clientSecret: "secret" }, { base: `${base}/atp`, jetonUrl: `${base}/api/oauth/v1/token` });

  await cas("la commune de naissance se trouve par son nom, dans le département tapé", async () => {
    const r = await chercherCommuneDeNaissance("Nantes", "044", base);
    assert.deepEqual(r, { ok: true, commune: { code: "44109", nom: "Nantes", departement: "44" } });
    assert.equal(etat.derniereRecherche?.get("codeDepartement"), "44", "le zéro de tête ne part pas chez l'État");
    assert.equal(etat.derniereRecherche?.get("nom"), "Nantes");
  });

  await cas("une commune qui ne se trouve pas, ou ailleurs, rend « rien », jamais une voisine", async () => {
    assert.deepEqual(await chercherCommuneDeNaissance("Nantes", "035", base), { ok: true, commune: null });
    assert.deepEqual(await chercherCommuneDeNaissance("Nant", "044", base), { ok: true, commune: null }, "Nantes et Nanteuil : aucune n'est « Nant »");
  });

  await cas("un découpage en panne se dit, il ne se devine pas", async () => {
    etat.communesEnPanne = true;
    try {
      assert.deepEqual(await chercherCommuneDeNaissance("Nantes", "044", base), { ok: false, raison: "injoignable" });
    } finally {
      etat.communesEnPanne = false;
    }
  });

  await cas("l'adresse de la fiche se découpe par la Base Adresse Nationale", async () => {
    assert.deepEqual(await adresseDecoupee("12 rue des Lilas, Rezé", base), {
      codeCommune: "44143",
      codePostal: "44400",
      libelleCommune: "Rezé",
      libelleVoie: "Rue des Lilas",
      numeroVoie: "12",
    });
  });

  await cas("une adresse que la base ne reconnaît pas, ou une base en panne : rien", async () => {
    assert.equal(await adresseDecoupee("quelque part nulle part", base), null);
    etat.banEnPanne = true;
    try {
      assert.equal(await adresseDecoupee("12 rue des Lilas, Rezé", base), null);
    } finally {
      etat.banEnPanne = false;
    }
  });

  await cas("l'état du client relu chez l'Urssaf : actif, en attente, ou inconnu", async () => {
    etat.statut = { idClient: "11000000000104", statut: { code: "10", libelle: "Actif" } };
    let r = await urssaf.statutParticulier("11000000000104");
    assert.ok(r.ok);
    if (r.ok) assert.equal(etatDuParticulier(r.statut), "inscrit");
    etat.statut = { idClient: "11000000000104", statut: "EN_ATTENTE_ACTIVATION" };
    r = await urssaf.statutParticulier("11000000000104");
    if (r.ok) assert.equal(etatDuParticulier(r.statut), "en-attente");
    etat.statut = { idClient: "11000000000104" };
    r = await urssaf.statutParticulier("11000000000104");
    if (r.ok) assert.equal(etatDuParticulier(r.statut), "inconnu", "une réponse sans état ne fait pas un client inscrit");
  });

  await cas("une demande rendue sans identifiant, avec ses erreurs, se lit comme un refus motivé", async () => {
    const r = await urssaf.transmettreDemande({
      idTiersFacturation: "T1",
      idClient: "11000000000104",
      dateNaissanceClient: "1961-04-12T00:00:00.000Z",
      numFactureTiers: "F2026-000041",
      dateFacture: "2026-11-08T00:00:00.000Z",
      dateDebutEmploi: "2026-10-30T00:00:00.000Z",
      dateFinEmploi: "2026-11-05T00:00:00.000Z",
      mntFactureTTC: 504,
      mntFactureHT: 420,
      inputPrestations: [],
    });
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.demande.idDemandePaiement, undefined);
      assert.equal(
        phraseDuRefus({ raison: "refuse", erreurs: r.demande.errors ?? [] }),
        "L'Urssaf refuse : La période d'emploi dépasse un mois calendaire."
      );
    }
  });

  await new Promise<void>((ok) => serveur.close(() => ok()));

  await cas("un service qui ne répond plus du tout : la feuille le dit, rien ne se devine", async () => {
    assert.deepEqual(await chercherCommuneDeNaissance("Nantes", "044", base), { ok: false, raison: "injoignable" });
    assert.equal(await adresseDecoupee("12 rue des Lilas, Rezé", base), null);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Avance immédiate, contre de faux serveurs : ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

void principal();
