// Les suites ont-elles le droit de vider la base de son espace ?
//
// **CE QUE CETTE SUITE PROTÈGE.** Chaque suite base commence par
// `nettoyerBase()` (`scripts/_test-db.ts`), un `TRUNCATE … CASCADE` sur toutes
// les tables. Jusqu'au 25 octobre 2026, il visait la base que l'environnement
// désignait, sans la regarder. Or sur son espace, l'environnement désigne
// `atlas_dev` (`.devcontainer/docker-compose.yml`), et c'est là que vivent ses
// chantiers : un `npm test` tapé chez lui, par lui ou par une session, les
// effaçait. La batterie, elle, posait déjà `atlas_test` (`_bases-essai.ts`) ;
// c'est le geste à la main que rien ne tenait.
//
// Jouée contre une VRAIE base nommée `atlas_dev`, copie de la base d'essai, avec
// une ligne dedans : c'est la ligne survivante qui prouve, pas un refus annoncé.

import assert from "node:assert/strict";
import { Client } from "pg";
import { nettoyerBase } from "./_test-db";
import { garderNettoyage } from "../src/lib/garde-seed";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

const ADMIN_ESSAI = process.env.DATABASE_ADMIN_URL;
const APP_ESSAI = process.env.DATABASE_URL;
if (!ADMIN_ESSAI || !APP_ESSAI) {
  console.error("DATABASE_URL et DATABASE_ADMIN_URL sont requis (source scripts/monter-base-locale.sh).");
  process.exit(1);
}

/** La même adresse, sur une autre base : mêmes rôles, mêmes droits. */
function surLaBase(url: string, base: string): string {
  const u = new URL(url);
  u.pathname = `/${base}`;
  return u.toString();
}

const BASE_D_ESSAI = new URL(ADMIN_ESSAI).pathname.slice(1);
const SUPER = surLaBase(
  process.env.ATLAS_BASE_SUPER ?? "postgresql://postgres:postgres_ci_pw@localhost:5432/postgres",
  "postgres",
);
const SENTINELLE = "un-chantier-du-patron";

async function surLeServeur(sql: string) {
  const c = new Client({ connectionString: SUPER });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
}

async function sentinellePresente(url: string): Promise<boolean> {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const r = await c.query("SELECT 1 FROM tentatives_connexion WHERE empreinte = $1", [SENTINELLE]);
    return r.rowCount === 1;
  } finally {
    await c.end();
  }
}

async function main() {
  console.log("=== Le nettoyage des suites épargne-t-il sa base ? ===\n");

  // ─── La règle, sans base ────────────────────────────────────────────────────

  await essai("les bases d'essai et d'atelier se vident", () => {
    for (const nom of ["atlas_test", "atlas_test_a1", "atlas_test_a12"]) {
      assert.equal(garderNettoyage(`postgresql://u:p@localhost:5432/${nom}`).ok, true, nom);
    }
    assert.equal(garderNettoyage("postgresql://u:p@postgres:5432/atlas_test").ok, true, "hôte docker");
  });

  await essai("sa base de travail, atlas_dev, ne se vide JAMAIS par une suite", () => {
    assert.equal(garderNettoyage("postgresql://u:p@localhost:5432/atlas_dev").ok, false);
    assert.equal(garderNettoyage("postgresql://atlas_owner:x@postgres:5432/atlas_dev").ok, false);
  });

  await essai("ce qui ressemble à une production, ou n'est pas lisible, se refuse", () => {
    for (const url of [
      "postgresql://u:p@localhost:5432/atlas_production",
      "postgresql://u:p@localhost:5432/atlas",
      "postgresql://u:p@localhost:5432/atlas_test_a1_prod",
      "postgresql://u:p@10.0.0.12:5432/atlas_test",
      "postgresql://u:p@localhost:5432/",
      "pas une adresse",
      undefined,
    ]) {
      assert.equal(garderNettoyage(url).ok, false, String(url));
    }
  });

  await essai("le refus nomme la base qu'on allait vider", () => {
    const v = garderNettoyage("postgresql://u:p@localhost:5432/atlas_dev");
    assert.equal(v.ok, false);
    if (!v.ok) assert.match(v.phrase, /atlas_dev/);
  });

  // ─── Le geste, sur une vraie base ───────────────────────────────────────────

  await surLeServeur("DROP DATABASE IF EXISTS atlas_dev");
  await surLeServeur(`CREATE DATABASE atlas_dev TEMPLATE ${BASE_D_ESSAI}`);
  const ADMIN_DEV = surLaBase(ADMIN_ESSAI!, "atlas_dev");
  try {
    const c = new Client({ connectionString: ADMIN_DEV });
    await c.connect();
    await c.query("INSERT INTO tentatives_connexion (empreinte, echecs) VALUES ($1, 1)", [SENTINELLE]);
    await c.end();

    await essai("sur son espace, nettoyerBase refuse, et sa ligne survit", async () => {
      // Exactement son environnement : les deux adresses désignent atlas_dev.
      process.env.DATABASE_ADMIN_URL = ADMIN_DEV;
      process.env.DATABASE_URL = surLaBase(APP_ESSAI!, "atlas_dev");
      let refus: Error | null = null;
      try {
        await nettoyerBase();
      } catch (e) {
        refus = e as Error;
      }
      assert.equal(await sentinellePresente(ADMIN_DEV), true, "la base atlas_dev a été VIDÉE");
      assert.ok(refus, "aucun refus : le nettoyage a dit oui à atlas_dev");
      assert.match(refus!.message, /atlas_dev/);
    });

    await essai("l'adresse du produit compte aussi : une suite n'écrit pas dans sa base", async () => {
      process.env.DATABASE_ADMIN_URL = ADMIN_ESSAI;
      process.env.DATABASE_URL = surLaBase(APP_ESSAI!, "atlas_dev");
      await assert.rejects(nettoyerBase(), /atlas_dev/);
    });
  } finally {
    process.env.DATABASE_ADMIN_URL = ADMIN_ESSAI;
    process.env.DATABASE_URL = APP_ESSAI;
    await surLeServeur("DROP DATABASE IF EXISTS atlas_dev");
  }

  await essai("sur la base d'essai, le nettoyage travaille toujours", async () => {
    const c = new Client({ connectionString: ADMIN_ESSAI });
    await c.connect();
    await c.query("INSERT INTO tentatives_connexion (empreinte, echecs) VALUES ($1, 1) ON CONFLICT DO NOTHING", [SENTINELLE]);
    await c.end();
    await nettoyerBase();
    assert.equal(await sentinellePresente(ADMIN_ESSAI!), false, "la base d'essai n'a pas été vidée");
  });

  console.log(echecs === 0 ? "\n✅ Le nettoyage n'atteint que les bases d'essai." : `\n❌ ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
