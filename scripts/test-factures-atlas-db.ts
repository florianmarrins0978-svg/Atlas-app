import assert from "node:assert";
import { sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { facturesAtlas } from "../src/server/db/schema";
import { _reinitialiserEnvPourTests } from "../src/server/env";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { enregistrerLAbonnement } from "../src/server/repositories/abonnements";
import { emettreLaFactureDAbonnement } from "../src/server/repositories/factures-atlas";
import type { FacturePayeeLue } from "../src/server/paiement/stripe";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// LA FACTURE D'ABONNEMENT D'ATLAS, EN BASE — sous `atlas_app`, donc sous RLS
// ═══════════════════════════════════════════════════════════════════════════
//
// Ses réponses du 5 novembre 2026 : TVA, et Factur-X, Atlas émet lui-même.
// Ce qui compte et qui ne se voit qu'en base : une suite de numéros SANS
// TROU, un paiement que Stripe répète qui ne fait qu'une facture, un refus qui
// ne consomme aucun numéro, et l'artisan qui ne lit que les siennes.

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

function vendeur(complet: boolean) {
  process.env.ATLAS_VENDEUR_NOM = "Atlas SAS";
  process.env.ATLAS_VENDEUR_ADRESSE = "1 rue de la Paix 33000 Bordeaux";
  process.env.ATLAS_VENDEUR_SIRET = complet ? "12345678900012" : "";
  process.env.ATLAS_VENDEUR_TVA = "FR32123456789";
  _reinitialiserEnvPourTests();
}

async function abonne(suffixe: string, abonnementPrestataire: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Jardins ${suffixe}`, adresse: "12 rue des Lilas 33700 Mérignac", siret: "98765432100015" },
    { email: `fa-${suffixe}-${Date.now()}@t.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  await enregistrerLAbonnement(ctx, {
    formule: "artisan",
    periodicite: "mensuelle",
    statut: "actif",
    periodeFin: new Date(Date.now() + 30 * 86_400_000),
    annulationDemandee: false,
    clientPrestataire: `cus_${suffixe}`,
    abonnementPrestataire,
  });
  return ctx;
}

const paiement = (facture: string, abonnement: string): FacturePayeeLue => ({
  facturePrestataire: facture,
  abonnementPrestataire: abonnement,
  htCentimes: 3900,
  tvaCentimes: 780,
  ttcCentimes: 4680,
  payeeLe: "2026-11-06",
  periodeDebut: "2026-11-06",
  periodeFin: "2026-12-05",
});

async function lesSiennes(ctx: { utilisateurId: string; entrepriseId: string }) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx.select({ numero: facturesAtlas.numero, rang: facturesAtlas.rang, ttc: facturesAtlas.totalTtc }).from(facturesAtlas)
  );
}

async function main() {
  await nettoyerBase();
  await pool.query("UPDATE compteur_factures_atlas SET dernier = 0 WHERE id = 1").catch(() => undefined);

  const a = await abonne("a", "sub_a");
  const b = await abonne("b", "sub_b");

  await test("sans SIRET d'Atlas : refusée, et AUCUN numéro consommé", async () => {
    vendeur(false);
    assert.equal(await emettreLaFactureDAbonnement(paiement("in_0", "sub_a")), "refusee");
    assert.equal((await lesSiennes(a)).length, 0);
  });

  await test("le premier paiement fait la facture n° 1, 46,80 € TTC", async () => {
    vendeur(true);
    assert.equal(await emettreLaFactureDAbonnement(paiement("in_1", "sub_a")), "emise");
    const lues = await lesSiennes(a);
    assert.equal(lues.length, 1);
    assert.equal(lues[0].rang, 1, "le refus d'avant a consommé un numéro : la suite a un trou");
    assert.equal(lues[0].numero, "AT2026-000001");
    assert.equal(lues[0].ttc, "46.80");
  });

  await test("Stripe répète le même paiement : une seule facture", async () => {
    assert.equal(await emettreLaFactureDAbonnement(paiement("in_1", "sub_a")), "deja-emise");
    assert.equal((await lesSiennes(a)).length, 1);
  });

  await test("le paiement d'un autre artisan prend le numéro suivant", async () => {
    assert.equal(await emettreLaFactureDAbonnement(paiement("in_2", "sub_b")), "emise");
    assert.equal((await lesSiennes(b))[0]?.rang, 2);
  });

  await test("chacun ne lit que les siennes", async () => {
    assert.deepEqual((await lesSiennes(a)).map((f) => f.numero), ["AT2026-000001"]);
    assert.deepEqual((await lesSiennes(b)).map((f) => f.numero), ["AT2026-000002"]);
  });

  await test("un abonnement inconnu ne fabrique rien", async () => {
    assert.equal(await emettreLaFactureDAbonnement(paiement("in_3", "sub_inconnu")), "abonnement-inconnu");
  });

  await test("une facture d'Atlas ne se modifie ni ne s'efface", async () => {
    const tente = (requete: string) =>
      withEntreprise(a.utilisateurId, a.entrepriseId, async (tx) => tx.execute(sql.raw(requete))).then(
        () => "passée",
        () => "refusée"
      );
    assert.equal(await tente("UPDATE factures_atlas SET total_ttc = 0"), "refusée");
    assert.equal(await tente("DELETE FROM factures_atlas"), "refusée");
    assert.equal((await lesSiennes(a)).length, 1);
  });

  console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
