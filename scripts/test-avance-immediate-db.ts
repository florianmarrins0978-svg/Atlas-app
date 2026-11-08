import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { eq, sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { chantiers, demandesUrssaf, factures, inscriptionsUrssaf, liaisonsUrssaf, paiementsFacture } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { emettreFacture, FacturePasPriseParLUrssafError, terminerChantier } from "../src/server/repositories/factures";
import { reglerServicesALaPersonne } from "../src/server/repositories/services-a-la-personne";
import {
  devisSansAcompte,
  inscriptionDuClient,
  inscrireLeClient,
  liaisonUrssaf,
  relierLUrssaf,
  releverLesDemandes,
  relireLInscription,
  situationUrssafDeLaFacture,
} from "../src/server/repositories/avance-immediate";
import { exporterEntreprise } from "../src/server/repositories/export-entreprise";
import { effacerClient } from "../src/server/repositories/donnees-client";
import { chiffrer, dechiffrer } from "../src/server/agenda/secret-au-repos";
import { saisieServicesALaPersonneLue } from "../src/lib/services-a-la-personne";
import { feuillePreremplie } from "../src/lib/urssaf/branchement";
import { jourIso } from "../src/lib/jour";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

/**
 * L'AVANCE IMMÉDIATE EN BASE, sous `atlas_app` (migration 0180, le crédit
 * d'impôt de ses clients, lot 3), contre un FAUX serveur de l'Urssaf, de
 * l'État et de la Base Adresse Nationale, sur un port libre.
 *
 * Les suites pures tiennent les règles (`test-urssaf-branchement.ts`) et les
 * échanges (`test-avance-immediate-faux-serveur.ts`) ; celle-ci tient le
 * CHEMIN du patron (`CLAUDE.md` §5 quater) : relier l'Urssaf, inscrire un
 * client, envoyer sa facture, la voir versée et acquittée. Et ce qui ne doit
 * jamais arriver :
 *   - un code de l'Urssaf lisible en clair en base, ou dans la sauvegarde ;
 *   - l'IBAN du client gardé par Atlas ;
 *   - une entreprise qui lit la liaison, les inscriptions ou les demandes
 *     d'une autre ;
 *   - une facture refusée par l'Urssaf qui resterait arrêtée ;
 *   - un versement noté deux fois.
 *
 * **Écrite le 8 novembre 2026, PAS jouée** : sa consigne, *« ne lance pas de
 * batterie »*. Elle se joue avec la batterie, sur son accord.
 */

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

const CLIENT_ID = "identifiant-urssaf-de-demonstration";
const CLIENT_SECRET = "cle-secrete-de-demonstration-jamais-en-clair";
const IBAN = "FR7630006000011234567890189";
const AUJOURDHUI = jourIso(new Date());

/** Ce que le faux serveur a vu, et ce qu'il doit répondre. */
const faux = {
  refuserLaDemande: false,
  statutClient: "En attente d'activation",
  etapeDemande: "Intégrée",
  derniereInscription: null as unknown,
  demandesRecues: 0,
};

function lireCorps(req: http.IncomingMessage): Promise<string> {
  return new Promise((ok) => {
    let t = "";
    req.on("data", (c) => (t += c));
    req.on("end", () => ok(t));
  });
}

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://local");
  const corps = await lireCorps(req);
  const json = (statut: number, valeur: unknown) => {
    res.writeHead(statut, { "Content-Type": "application/json" });
    res.end(JSON.stringify(valeur));
  };
  if (url.pathname === "/api/oauth/v1/token") {
    const attendu = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
    if (req.headers.authorization !== attendu) return json(401, { error: "invalid_client" });
    return json(200, { access_token: "jeton-1", expires_in: 3600 });
  }
  if (url.pathname === "/communes") return json(200, [{ nom: "Nantes", code: "44109", codeDepartement: "44" }]);
  if (url.pathname === "/search/") {
    return json(200, { features: [{ properties: { type: "housenumber", housenumber: "12", street: "Rue des Lilas", postcode: "44400", citycode: "44143", city: "Rezé", score: 0.95 } }] });
  }
  if (url.pathname === "/atp/particulier" && req.method === "POST") {
    faux.derniereInscription = JSON.parse(corps);
    return json(200, { idClient: "11000000000104" });
  }
  if (url.pathname === "/atp/particulier" && req.method === "GET") return json(200, { idClient: "11000000000104", statut: { libelle: faux.statutClient } });
  if (url.pathname === "/atp/demandePaiement" && req.method === "POST") {
    faux.demandesRecues++;
    if (faux.refuserLaDemande) return json(200, [{ errors: [{ code: "ERR", message: "Refus", description: "Le client n'a pas activé son compte." }] }]);
    const [d] = JSON.parse(corps) as { numFactureTiers: string }[];
    return json(200, [{ idDemandePaiement: "DP-1", numFactureTiers: d.numFactureTiers, statut: "10", errors: [] }]);
  }
  if (url.pathname === "/atp/demandePaiement/rechercher") {
    return json(200, {
      infoDemandePaiements: [{ idDemandePaiement: "DP-1", statut: { code: "50", libelle: faux.etapeDemande }, infoVirement: { mntVirement: 504, dateVirement: `${AUJOURDHUI}T00:00:00.000Z` } }],
      errors: [],
    });
  }
  return json(404, [{ code: "404", message: "Inconnu" }]);
});

async function contexte(nom: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom, adresse: "4 rue des Tilleuls, 49000 Angers" },
    { email: `ai-${nom.replace(/\W/g, "").toLowerCase()}-${Date.now()}@t.test`, nom: "Thomas Leroy" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function declarer(ctx: Ctx) {
  const lue = saisieServicesALaPersonneLue({ declaree: true, numero: "SAP123456789", declareeLe: "2024-03-12" }, AUJOURDHUI);
  assert.ok(lue.ok, "la saisie de référence est refusée");
  if (lue.ok) await reglerServicesALaPersonne(ctx, lue.valeurs);
}

async function main() {
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  // L'échange lit ces deux adresses à chaque appel : la transaction de
  // l'émission, qui n'a pas d'options, parle donc au faux serveur.
  process.env.URSSAF_ATP_BASE = `${base}/atp`;
  process.env.URSSAF_JETON_URL = `${base}/api/oauth/v1/token`;
  const adresses = { ban: base, geo: base };

  await nettoyerBase();
  const a = await contexte("Jardins Atlas");
  const b = await contexte("Paysages Voisins");
  await declarer(a);
  await declarer(b);

  // ─── 1. Relier l'Urssaf ─────────────────────────────────────────────────

  await test("de mauvais codes ne s'enregistrent pas, et l'écran le dit", async () => {
    const r = await relierLUrssaf(a, { clientId: CLIENT_ID, clientSecret: "faux", idTiersFacturation: "T-A", codeNature: "ENF" });
    assert.deepEqual(r, { ok: false, raison: "Ces codes ne sont pas acceptés par l'Urssaf." });
    assert.equal(await liaisonUrssaf(a), null, "une liaison est restée");
  });

  await test("les bons codes se gardent, CHIFFRÉS : rien ne se lit en clair en base", async () => {
    const r = await relierLUrssaf(a, { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, idTiersFacturation: "T-A", codeNature: "ENF" });
    assert.deepEqual(r, { ok: true });
    const brut = await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
      tx.select().from(liaisonsUrssaf).where(eq(liaisonsUrssaf.entrepriseId, a.entrepriseId))
    );
    assert.equal(brut.length, 1);
    const ligne = JSON.stringify(brut[0]);
    assert.ok(!ligne.includes(CLIENT_SECRET) && !ligne.includes(CLIENT_ID), "un code se lit en clair dans la ligne");
    assert.match(brut[0].clientSecretChiffre, /^v1\./);
    assert.equal(dechiffrer(brut[0].clientSecretChiffre, "urssaf"), CLIENT_SECRET, "le code ne se rouvre pas sous sa clé");
    assert.equal(dechiffrer(brut[0].clientSecretChiffre, "plateforme-facture"), null, "il s'ouvre sous la clé d'un autre usage");
    const lue = await liaisonUrssaf(a);
    assert.ok(lue && !lue.aRefaire);
    assert.deepEqual(Object.keys(lue!).sort(), ["aRefaire", "relieeLe"], "l'écran reçoit plus que la date");
  });

  await test("la base refuse un code écrit en clair, même par une erreur de code", async () => {
    await assert.rejects(
      withEntreprise(b.utilisateurId, b.entrepriseId, (tx) =>
        tx.insert(liaisonsUrssaf).values({
          entrepriseId: b.entrepriseId,
          clientIdChiffre: CLIENT_ID,
          clientSecretChiffre: CLIENT_SECRET,
          idTiersFacturation: "T-B",
          codeNature: "ENF",
        })
      ),
      // Drizzle enveloppe le refus de PostgreSQL dans « Failed query » : le nom
      // de la contrainte vit dans `cause`, et c'est lui qui prouve que c'est
      // CETTE garde qui a refusé, et non une autre.
      (e: unknown) => (e as { cause?: { constraint?: string } }).cause?.constraint === "liaisons_urssaf_chiffres_ck"
    );
  });

  await test("ISOLATION : B ne voit pas la liaison de A, et ne peut pas l'écrire chez A", async () => {
    assert.equal(await liaisonUrssaf(b), null);
    const vues = await withEntreprise(b.utilisateurId, b.entrepriseId, (tx) => tx.select().from(liaisonsUrssaf));
    assert.equal(vues.length, 0);
    await assert.rejects(
      withEntreprise(b.utilisateurId, b.entrepriseId, (tx) =>
        tx.insert(liaisonsUrssaf).values({
          entrepriseId: a.entrepriseId,
          clientIdChiffre: chiffrer("x", "urssaf"),
          clientSecretChiffre: chiffrer("y", "urssaf"),
          idTiersFacturation: "T-X",
          codeNature: "ENF",
        })
      ),
      "la RLS a laissé B écrire une liaison chez A"
    );
  });

  // ─── 2. Inscrire un client ──────────────────────────────────────────────

  const client = await clientsRepo.creerClient(a, {
    nom: "Lambert",
    civilite: "mr",
    telephone: "0612345678",
    email: "p.lambert@exemple.fr",
    adresse: "12 rue des Lilas, 44400 Rezé",
  });
  const feuille = {
    ...feuillePreremplie({ nom: "Lambert", civilite: "mr", telephone: "0612345678", email: "p.lambert@exemple.fr" }),
    prenoms: "Pierre",
    dateNaissance: "1961-04-12",
    departementNaissance: "44",
    communeNaissance: "Nantes",
    iban: IBAN,
    bic: "AGRIFRPP",
  };

  await test("une feuille incomplète ne part pas chez l'Urssaf", async () => {
    const r = await inscrireLeClient(a, client.id, { ...feuille, iban: "" }, { adresses });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.manques?.some((m) => m.champ === "iban"));
    assert.equal(faux.derniereInscription, null, "l'Urssaf a reçu une feuille incomplète");
  });

  await test("l'inscription part, l'IBAN avec elle, et Atlas ne le garde pas", async () => {
    const r = await inscrireLeClient(a, client.id, feuille, { adresses });
    assert.deepEqual(r, { ok: true });
    const recue = faux.derniereInscription as { coordonneeBancaire: { iban: string }; lieuNaissance: { departementNaissance: string; communeNaissance: { codeCommune: string } }; adressePostale: { codeCommune: string } };
    assert.equal(recue.coordonneeBancaire.iban, IBAN, "l'Urssaf n'a pas reçu l'IBAN");
    assert.equal(recue.lieuNaissance.departementNaissance, "044");
    assert.equal(recue.lieuNaissance.communeNaissance.codeCommune, "109");
    assert.equal(recue.adressePostale.codeCommune, "44143");
    const lignes = await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) => tx.select().from(inscriptionsUrssaf));
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].idClientUrssaf, "11000000000104");
    assert.equal(lignes[0].dateNaissance, "1961-04-12");
    assert.ok(!JSON.stringify(lignes[0]).includes(IBAN.slice(4)), "l'IBAN est gardé dans la ligne");
    const colonnes = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'inscriptions_urssaf'`
    );
    assert.ok(
      !colonnes.rows.some((c) => /iban|bic|bancaire/i.test(c.column_name)),
      "la table des inscriptions a une colonne pour la banque du client"
    );
  });

  await test("en attente, puis inscrit quand l'Urssaf le dit, relu au plus toutes les cinq minutes", async () => {
    assert.equal((await inscriptionDuClient(a, client.id))?.etat, "en-attente");
    faux.statutClient = "Actif";
    // Relue à l'instant de l'inscription : trop tôt, rien ne bouge.
    await relireLInscription(a, client.id, new Date());
    assert.equal((await inscriptionDuClient(a, client.id))?.etat, "en-attente", "relue avant cinq minutes");
    await relireLInscription(a, client.id, new Date(Date.now() + 6 * 60_000));
    assert.equal((await inscriptionDuClient(a, client.id))?.etat, "inscrit");
  });

  await test("ISOLATION : B ne lit pas l'inscription du client de A", async () => {
    assert.equal(await inscriptionDuClient(b, client.id), null);
    const vues = await withEntreprise(b.utilisateurId, b.entrepriseId, (tx) => tx.select().from(inscriptionsUrssaf));
    assert.equal(vues.length, 0);
  });

  // ─── 3. Le devis, puis la facture ───────────────────────────────────────

  const chantier = await chantiersRepo.creerChantier(a, { nom: "Entretien du jardin", adresseChantier: "12 rue des Lilas, 44400 Rezé", clientId: client.id });
  await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
    tx.update(chantiers).set({ datePlanifiee: AUJOURDHUI, creneauDebut: "matin", dureeDemiJournees: 1 }).where(eq(chantiers.id, chantier.id))
  );
  await prixRepo.ajouterLignePrix(a, chantier.id, "Tonte et ramassage", "420.00");
  const d = await devisRepo.getOuCreerDevisBrouillon(a, chantier.id);

  await test("le devis d'un client inscrit n'a pas d'acompte", async () => {
    assert.equal(await devisSansAcompte(a, d.id), true);
    assert.equal(await devisSansAcompte(b, d.id), false, "B lit le devis de A");
  });

  await devisRepo.envoyerDevis(a, d.id);
  const f = await terminerChantier(a, chantier.id);

  await test("la facture d'un client inscrit part à l'Urssaf, et rien ne manque", async () => {
    const s = await situationUrssafDeLaFacture(a, f.id);
    assert.ok(s?.versLUrssaf, "la facture ne propose pas l'Urssaf");
    assert.deepEqual(s?.manques, []);
    assert.equal(await situationUrssafDeLaFacture(b, f.id), null, "B lit la facture de A");
  });

  await test("REFUSÉE PAR L'URSSAF, LA FACTURE RESTE UN BROUILLON, numéro compris", async () => {
    faux.refuserLaDemande = true;
    try {
      await assert.rejects(emettreFacture(a, f.id, new Date(), { versLUrssaf: true }), (e: unknown) => {
        assert.ok(e instanceof FacturePasPriseParLUrssafError);
        assert.match((e as Error).message, /n'a pas activé son compte/);
        return true;
      });
    } finally {
      faux.refuserLaDemande = false;
    }
    const [lue] = await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) => tx.select().from(factures).where(eq(factures.id, f.id)));
    assert.equal(lue.statut, "brouillon", "la facture refusée est restée arrêtée");
    const demandes = await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) => tx.select().from(demandesUrssaf));
    assert.equal(demandes.length, 0);
  });

  await test("acceptée, la facture est arrêtée ET sa demande gardée, dans la même transaction", async () => {
    await emettreFacture(a, f.id, new Date(), { versLUrssaf: true });
    const [lue] = await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) => tx.select().from(factures).where(eq(factures.id, f.id)));
    assert.equal(lue.statut, "emise");
    const s = await situationUrssafDeLaFacture(a, f.id);
    assert.equal(s?.demande?.etape, "integree");
  });

  await test("versée, la facture s'acquitte UNE fois, moyen avance immédiate, montant de la facture", async () => {
    faux.etapeDemande = "Payée";
    await releverLesDemandes(a, new Date(Date.now() + 6 * 60_000));
    await releverLesDemandes(a, new Date(Date.now() + 12 * 60_000));
    const reglements = await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
      tx.select().from(paiementsFacture).where(eq(paiementsFacture.factureId, f.id))
    );
    assert.equal(reglements.length, 1, "le versement est noté deux fois, ou pas du tout");
    assert.equal(reglements[0].moyen, "avance_immediate");
    assert.equal(reglements[0].montant, "504.00");
    const s = await situationUrssafDeLaFacture(a, f.id);
    assert.equal(s?.demande?.etape, "versee");
  });

  await test("ISOLATION : B ne relève ni ne lit les demandes de A", async () => {
    await releverLesDemandes(b, new Date(Date.now() + 20 * 60_000));
    const vues = await withEntreprise(b.utilisateurId, b.entrepriseId, (tx) => tx.select().from(demandesUrssaf));
    assert.equal(vues.length, 0);
  });

  // ─── 4. Ce qui sort d'Atlas, et ce qui part avec le client ──────────────

  await test("la sauvegarde emporte la liaison SANS ses codes, ni chiffrés ni en clair", async () => {
    const e = await exporterEntreprise(a);
    const [liaison] = (e.tables.liaisons_urssaf ?? []) as Record<string, unknown>[];
    assert.equal(liaison?.idTiersFacturation, "T-A");
    assert.ok(!("clientSecretChiffre" in liaison) && !("clientIdChiffre" in liaison));
    const tout = JSON.stringify(e);
    assert.ok(!tout.includes(CLIENT_SECRET) && !tout.includes("v1."), "un code voyage dans l'archive");
    assert.equal((e.tables.inscriptions_urssaf ?? []).length, 1);
    assert.equal((e.tables.demandes_urssaf ?? []).length, 1);
  });

  await test("le client effacé emporte son inscription, même quand sa facture le retient", async () => {
    await effacerClient(a, client.id);
    const restantes = await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
      tx.execute(sql`SELECT count(*)::int AS n FROM inscriptions_urssaf`)
    );
    assert.equal((restantes as unknown as { rows: { n: number }[] }).rows[0].n, 0);
  });

  console.log(`\n${failed} échec(s), ${passed} réussi(s).`);
  await new Promise<void>((ok) => serveur.close(() => ok()));
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

void main();
