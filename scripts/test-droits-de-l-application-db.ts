// Ce que le rôle de l'application n'a PAS le droit de faire en base.
//
// **Audit du 25 octobre 2026, E9.** `atlas_app`, le rôle que tous les artisans
// partagent, pouvait réécrire le registre des migrations, les conditions
// générales de tous, et supprimer une entreprise entière (en cascade sur
// soixante-dix tables, que la RLS ne retient pas). Le code ne fait aucun de
// ces gestes. Une injection SQL, ou un geste futur mal filtré, les aurait faits
// à sa place : un droit que personne n'emploie est une porte que personne ne
// surveille.
//
// Lu dans le catalogue de la base, sous le rôle propriétaire.

import assert from "node:assert/strict";
import pg from "pg";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Les droits de l'application en base ===\n");
  const client = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL });
  await client.connect();
  const peut = async (table: string, geste: string) =>
    (await client.query(`SELECT has_table_privilege('atlas_app', $1, $2) AS oui`, [table, geste])).rows[0].oui as boolean;

  try {
    await essai("le registre des migrations : l'application le LIT, sans jamais l'écrire", async () => {
      assert.equal(await peut("_migrations", "SELECT"), true, "l'écran Réglages ne pourrait plus dire si la base est en retard");
      for (const geste of ["INSERT", "UPDATE", "DELETE"]) {
        assert.equal(await peut("_migrations", geste), false, `${geste} sur _migrations : une migration de sécurité pourrait être sautée`);
      }
    });

    await essai("les documents légaux : lus par tous, réécrits par personne depuis l'application", async () => {
      assert.equal(await peut("documents_legaux", "SELECT"), true);
      for (const geste of ["INSERT", "UPDATE", "DELETE"]) {
        assert.equal(await peut("documents_legaux", geste), false, `${geste} sur documents_legaux : les conditions de tous réécrites`);
      }
    });

    await essai("une entreprise ne se SUPPRIME pas depuis l'application", async () => {
      assert.equal(await peut("entreprises", "DELETE"), false, "DELETE sur entreprises : soixante-dix tables emportées en cascade");
      // Ce que le produit fait vraiment, et qui doit rester possible.
      for (const geste of ["SELECT", "INSERT", "UPDATE"]) assert.equal(await peut("entreprises", geste), true, `${geste} retiré à tort`);
    });
  } finally {
    await client.end();
  }

  console.log(`\nDroits de l'application — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
