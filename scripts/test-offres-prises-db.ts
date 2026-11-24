import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { offreDeLOutil, offresDejaPrises, prendreLOffre, rendreLOffre } from "../src/server/repositories/offres";

// L'OFFRE PRISE, EN BASE — un plan d'arrosage et un diagnostic offerts, une
// fois par entreprise, essai compris (ses réponses du 19 novembre 2026,
// migration 0187). La règle est pure (`test-abonnements.ts`) ; ici, ce que la
// base doit tenir : une seule prise, même à deux envois simultanés, une offre
// rendue par son seul jeton, et rien qui traverse d'une entreprise à l'autre.

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

let rang = 0;
async function contexte(nom: string) {
  rang++;
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom },
    { email: `offre-${rang}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function main() {
  console.log("=== L'offre prise, en base ===");

  await cas("la RLS est armée et forcée, et atlas_app ne peut que lire, prendre et rendre", async () => {
    const { rows } = await pool.query(
      `select c.relrowsecurity, c.relforcerowsecurity,
              (select string_agg(policyname, ',' order by policyname) from pg_policies p
                where p.tablename = 'offres_prises') as politiques,
              (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants g
                where g.table_name = 'offres_prises' and g.grantee = 'atlas_app') as droits
         from pg_class c where c.relname = 'offres_prises'`
    );
    assert.equal(rows[0]?.relrowsecurity, true);
    assert.equal(rows[0]?.relforcerowsecurity, true);
    assert.equal(rows[0]?.politiques, "offres_prises_isolation");
    assert.equal(rows[0]?.droits, "DELETE,INSERT,SELECT");
  });

  const a = await contexte("Offre A");
  const b = await contexte("Offre B");

  await cas("une entreprise neuve n'a rien pris : l'arrosage et le diagnostic sont offerts", async () => {
    assert.equal(await offreDeLOutil(a, "arrosage"), null);
    assert.deepEqual([...(await offresDejaPrises(a))], []);
  });

  await cas("prendre l'offre rend un jeton ; la reprendre est refusé", async () => {
    const prise = await prendreLOffre(a, "arrosage");
    assert.ok(prise, "la première prise a été refusée");
    assert.match(prise.jeton, /^[0-9a-f-]{36}$/);
    assert.equal(await prendreLOffre(a, "arrosage"), null, "l'offre a été prise deux fois");
    assert.equal((await offreDeLOutil(a, "arrosage"))?.jeton, prise.jeton);
    assert.deepEqual([...(await offresDejaPrises(a))], ["arrosage"]);
  });

  await cas("DEUX ENVOIS SIMULTANÉS : un seul prend l'offre", async () => {
    const prises = await Promise.all([prendreLOffre(a, "diagnostic"), prendreLOffre(a, "diagnostic")]);
    assert.equal(prises.filter(Boolean).length, 1, `${prises.filter(Boolean).length} prises pour une offre`);
  });

  await cas("l'offre d'une entreprise ne touche pas celle d'une autre", async () => {
    assert.equal(await offreDeLOutil(b, "arrosage"), null, "B voit l'offre prise par A");
    assert.ok(await prendreLOffre(b, "arrosage"), "B ne peut plus prendre son offre parce que A a pris la sienne");
  });

  await cas("rendre l'offre, par son jeton, la rend de nouveau disponible ; un autre jeton ne rend rien", async () => {
    const prise = await offreDeLOutil(a, "diagnostic");
    assert.ok(prise);
    await rendreLOffre(a, "diagnostic", "00000000-0000-0000-0000-000000000000");
    assert.ok(await offreDeLOutil(a, "diagnostic"), "un jeton étranger a rendu l'offre");
    await rendreLOffre(a, "diagnostic", prise.jeton);
    assert.equal(await offreDeLOutil(a, "diagnostic"), null);
  });

  await cas("B ne rend pas l'offre de A, même avec son jeton", async () => {
    const prise = await offreDeLOutil(a, "arrosage");
    assert.ok(prise);
    await rendreLOffre(b, "arrosage", prise.jeton);
    assert.ok(await offreDeLOutil(a, "arrosage"), "B a rendu l'offre de A");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s)\n`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
