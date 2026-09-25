import assert from "node:assert";
import Decimal from "decimal.js";
import { Pool } from "pg";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import {
  emettreFacture,
  releveTvaCollectee,
  releveTvaCollecteeParTaux,
  terminerChantier,
} from "../src/server/repositories/factures";
import { noterPaiement, reglerExigibilite } from "../src/server/repositories/paiements-facture";
import { faireUnAvoir } from "../src/server/repositories/avoirs";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **LA PAGE « TVA COLLECTÉE » À LA CALCULETTE, EN BASE** — sa planche du
// 25 septembre 2026 (`appli/tva-collectee-a-la-calculette.html`).
//
// La répartition est éprouvée sans base (`test-tva-par-taux.ts`). Cette suite
// tient ce qu'aucune règle pure ne peut tenir, sous `atlas_app`, RLS comprise :
//
//   1. les taux se lisent sur les LIGNES de la facture, pas sur sa moyenne ;
//   2. le total de la page est, au centime, celui de Ma TVA ;
//   3. un avoir sur la ligne à 10 % se lit à 10 %, aux deux régimes ;
//   4. rien ne se voit d'une entreprise à l'autre.

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
const MAINTENANT = new Date("2026-09-10T09:00:00Z");
const DEBUT = "2026-09-01";
const FIN = "2026-09-30";
const somme = (xs: readonly string[]) => xs.reduce((a, x) => a.plus(new Decimal(x)), new Decimal(0)).toFixed(2);

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier Calculette" },
    { email: `calculette-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Une facture de jardin : 400 € de main d'œuvre à 20 %, 100 € de plantes à 10 %. */
async function factureMixte(ctx: Ctx) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Julien" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Massif", clientId: client.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Main d'œuvre", "400.00", { tauxTva: "20.00" });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Plantes", "100.00", { tauxTva: "10.00" });
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, devis.id);
  const brouillon = await terminerChantier(ctx, chantier.id, MAINTENANT);
  return emettreFacture(ctx, brouillon.id, MAINTENANT);
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");
  const facture = await factureMixte(ctx);

  await test("la facture émise porte bien 90 € de TVA sur 590 € : la suite part d'un vrai mélange", async () => {
    assert.equal(facture.totalTva, "90.00");
    assert.equal(facture.totalTtc, "590.00");
  });

  await test("un acompte de 296 € se découpe à 20 % et à 10 %, jamais à la moyenne", async () => {
    const r = await noterPaiement(ctx, facture.id, { date: "2026-09-12", montant: "296" });
    assert.ok(r.ok, r.ok ? "" : r.raison);
    const { lignes } = await releveTvaCollecteeParTaux(ctx, DEBUT, FIN);
    assert.equal(lignes.length, 1);
    const [l] = lignes;
    // L'ancien taux de la ligne : TVA ÷ HT de la facture entière, 18 %.
    assert.equal(l!.tauxTva, "18.00", "la moyenne a changé : relire ce que ce contrôle défend");
    assert.deepEqual(
      l!.parts.map((p) => p.taux),
      ["20.00", "10.00"]
    );
    assert.equal(somme(l!.parts.map((p) => p.ttc)), "296.00");
    assert.equal(somme(l!.parts.map((p) => p.tva)), l!.totalTva);
  });

  await test("le total de la page est celui de Ma TVA, au centime", async () => {
    const ma = await releveTvaCollectee(ctx, DEBUT, FIN);
    const { releve, lignes } = await releveTvaCollecteeParTaux(ctx, DEBUT, FIN);
    assert.equal(releve.totalTva, ma.totalTva);
    assert.equal(somme(lignes.flatMap((l) => l.parts.map((p) => p.tva))), ma.totalTva);
  });

  await test("un avoir sur la ligne à 10 % : le règlement qui suit ne se lit plus qu'à 20 %", async () => {
    const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
    let ligneAuDix: string;
    try {
      const c = await admin.connect();
      try {
        await c.query("BEGIN");
        await c.query("SELECT set_config('app.entreprise_id', $1, true)", [ctx.entrepriseId]);
        const { rows } = await c.query(
          "SELECT id FROM lignes_facture WHERE facture_id = $1 AND taux_tva = 10",
          [facture.id]
        );
        assert.equal(rows.length, 1, "la ligne à 10 % n'est pas sur la facture");
        ligneAuDix = rows[0].id;
        await c.query("COMMIT");
      } finally {
        c.release();
      }
    } finally {
      await admin.end();
    }
    const a = await faireUnAvoir(ctx, facture.id, { portee: ligneAuDix, montantTtc: "110", motif: "Plantes reprises" }, MAINTENANT);
    assert.ok(a.ok, a.ok ? "" : a.refus);
    const r = await noterPaiement(ctx, facture.id, { date: "2026-09-20", montant: "184" });
    assert.ok(r.ok, r.ok ? "" : r.raison);
    const { lignes } = await releveTvaCollecteeParTaux(ctx, DEBUT, FIN);
    const solde = lignes.find((l) => l.dateEmission === "2026-09-20")!;
    assert.deepEqual(solde.parts.map((p) => p.taux), ["20.00"]);
  });

  await test("aux débits, la ligne de l'avoir se lit à 10 %, en négatif", async () => {
    await reglerExigibilite(ctx, "debits");
    const { lignes } = await releveTvaCollecteeParTaux(ctx, DEBUT, FIN);
    const avoir = lignes.find((l) => l.motif === "avoir")!;
    assert.ok(avoir, "la ligne de l'avoir manque au relevé des débits");
    assert.deepEqual(avoir.parts, [{ taux: "10.00", tva: "-10.00", ttc: "-110.00" }]);
    const emission = lignes.find((l) => l.motif === "emission")!;
    assert.deepEqual(emission.parts, [
      { taux: "20.00", tva: "80.00", ttc: "480.00" },
      { taux: "10.00", tva: "10.00", ttc: "110.00" },
    ]);
  });

  await test("rien ne se voit d'une entreprise à l'autre", async () => {
    const autre = await contexte("b");
    const { lignes } = await releveTvaCollecteeParTaux(autre, DEBUT, FIN);
    assert.equal(lignes.length, 0);
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  await fermerLimiteur();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
