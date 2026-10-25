import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { mesurerOccupation } from "../src/server/db/occupation-de-la-base";

// **« Ça va pas supprimer toutes mes données ? » — sa question du 13 septembre
// 2026**, devant le « Rebuild Container » que je venais de lui conseiller pour
// réparer son port. La réponse était OUI, et c'est lui qui l'a vue.
//
// **La question vit dans le SEED depuis le 25 octobre 2026.** Elle vivait dans
// `preparer.sh` seul : le seed, lui, acceptait `atlas_dev` sur son nom, et un
// `npm run db:seed` tapé à la main sur son espace effaçait ses chantiers. Le
// seul endroit qui détruit est désormais celui qui demande.
//
// Jouée POUR DE BON, contre une vraie base `atlas_dev` dans ses deux états : un
// contrôle qui n'a jamais vu l'état qu'il prétend détecter ne prouve rien.

const SEED = path.join(__dirname, "..", "src", "server", "db", "seed.ts");
const TSX = path.join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs");
const ESSAI = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!ESSAI) {
  console.error("DATABASE_ADMIN_URL est requis (source scripts/monter-base-locale.sh).");
  process.exit(1);
}

function surLaBase(url: string, base: string): string {
  const u = new URL(url);
  u.pathname = `/${base}`;
  return u.toString();
}

const BASE_D_ESSAI = new URL(ESSAI).pathname.slice(1);
const SUPER_SERVEUR = surLaBase(
  process.env.ATLAS_BASE_SUPER ?? "postgresql://postgres:postgres_ci_pw@localhost:5432/postgres",
  "postgres",
);
const SUPER_DEV = surLaBase(SUPER_SERVEUR, "atlas_dev");
const OWNER_DEV = surLaBase(ESSAI, "atlas_dev");

async function requete<T extends pg.QueryResultRow>(url: string, sql: string, valeurs: unknown[] = []) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return (await c.query<T>(sql, valeurs)).rows;
  } finally {
    await c.end();
  }
}

async function refaireAtlasDev() {
  await requete(SUPER_SERVEUR, "DROP DATABASE IF EXISTS atlas_dev");
  await requete(SUPER_SERVEUR, `CREATE DATABASE atlas_dev TEMPLATE ${BASE_D_ESSAI}`);
  // La copie emporte les lignes de la base d'essai : on part d'une base vierge.
  await requete(SUPER_DEV, "TRUNCATE entreprises, users RESTART IDENTITY CASCADE");
}

const nombreDEntreprises = async (url: string) =>
  (await requete<{ n: number }>(url, "SELECT count(*)::int AS n FROM entreprises"))[0].n;

/** Le seed, comme il le tape : `npm run db:seed` sur son espace. */
function seedSurSonEspace(env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [TSX, SEED], {
    env: { ...process.env, ...env, DATABASE_URL: SUPER_DEV, NODE_ENV: "development" },
    encoding: "utf8",
  });
}

let echecs = 0;
const epreuves: [string, () => void | Promise<void>][] = [];
const cas = (nom: string, fn: () => void | Promise<void>) => epreuves.push([nom, fn]);

// ─── La mesure ────────────────────────────────────────────────────────────────

cas("une base INJOIGNABLE est indéterminée, jamais vierge", async () => {
  // **Le cas qui coûterait ses données.** Une base momentanément absente prise
  // pour une base neuve ferait vider la vraie dès qu'elle revient.
  assert.equal(await mesurerOccupation("postgresql://x:y@127.0.0.1:1/z"), "indeterminee");
});

// **LE ZÉRO QUI COÛTERAIT SES CHANTIERS.** Un rôle qui ne traverse pas la RLS
// compte ZÉRO sur une base pleine.
cas("sous un rôle qui ne traverse PAS la RLS, la mesure s'abstient", async () => {
  await refaireAtlasDev();
  await requete(SUPER_DEV, "INSERT INTO entreprises (nom) VALUES ('Son entreprise')");
  assert.equal(await mesurerOccupation(OWNER_DEV), "indeterminee");
});

cas("habitée se dit habitée, vierge se dit vierge, jamais migrée se dit vierge", async () => {
  await refaireAtlasDev();
  assert.equal(await mesurerOccupation(SUPER_DEV), "vierge");
  await requete(SUPER_DEV, "INSERT INTO entreprises (nom) VALUES ('Son entreprise')");
  assert.equal(await mesurerOccupation(SUPER_DEV), "habitee");
  await requete(SUPER_SERVEUR, "DROP DATABASE atlas_dev");
  await requete(SUPER_SERVEUR, "CREATE DATABASE atlas_dev");
  assert.equal(await mesurerOccupation(SUPER_DEV), "vierge");
});

// ─── Le geste : `npm run db:seed` sur son espace ─────────────────────────────

cas("sur sa base habitée, le seed REFUSE, et son entreprise survit", async () => {
  await refaireAtlasDev();
  await requete(SUPER_DEV, "INSERT INTO entreprises (nom) VALUES ('Son entreprise')");
  const r = seedSurSonEspace();
  const restantes = await requete<{ nom: string }>(SUPER_DEV, "SELECT nom FROM entreprises");
  assert.deepEqual(restantes.map((e) => e.nom), ["Son entreprise"], "le seed a VIDÉ sa base");
  assert.equal(r.status, 3, `le refus doit se dire par le code 3 (reçu ${r.status})`);
  assert.match(r.stderr, /porte déjà du travail/);
  assert.doesNotMatch(r.stderr, /npm run db:seed/, "le refus ne doit pas reproposer le geste");
});

cas("sur une base atlas_dev VIERGE, le seed amorce (premier allumage)", async () => {
  await refaireAtlasDev();
  const r = seedSurSonEspace();
  assert.equal(r.status, 0, `le seed a refusé une base vierge :\n${r.stderr}`);
  assert.ok((await nombreDEntreprises(SUPER_DEV)) > 0, "aucune entreprise de démonstration posée");
});

cas("le forçage en toutes lettres reste le seul passage, mot de passe exigé", async () => {
  await refaireAtlasDev();
  await requete(SUPER_DEV, "INSERT INTO entreprises (nom) VALUES ('Son entreprise')");
  const r = seedSurSonEspace({ ATLAS_SEED_FORCER: "oui-j-efface-tout", ATLAS_MDP_DEMO: "un-mot-de-passe-long" });
  assert.equal(r.status, 0, r.stderr);
  const noms = (await requete<{ nom: string }>(SUPER_DEV, "SELECT nom FROM entreprises")).map((e) => e.nom);
  assert.ok(!noms.includes("Son entreprise"), "le forçage n'a pas amorcé");
});

// ─── L'appelant : `preparer.sh` ──────────────────────────────────────────────

cas("preparer.sh laisse le seed décider, et ne repropose jamais de vider", () => {
  const script = readFileSync(path.join(__dirname, "..", ".devcontainer", "preparer.sh"), "utf8");
  const code = script.split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n");
  assert.match(code, /seed\.ts/, "preparer.sh n'amorce plus un espace neuf");
  assert.doesNotMatch(code, /base-habitee/, "la question vit dans le seed : une seconde copie divergerait");
  assert.doesNotMatch(code, /npm run db:seed/, "preparer.sh propose un geste qui vide sa base (§4 septies)");
  // `set -e` ne doit pas tuer la préparation sur un refus du seed, qui est une réponse.
  assert.match(code, /\|\| AMORCE=\$\?/, "le refus du seed ferait échouer la préparation");
});

async function jouer() {
  console.log("=== On ne vide pas une base habitée ===\n");
  try {
    for (const [nom, verifier] of epreuves) {
      try {
        await verifier();
        console.log(`  ✓ ${nom}`);
      } catch (e) {
        echecs++;
        console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
      }
    }
  } finally {
    await requete(SUPER_SERVEUR, "DROP DATABASE IF EXISTS atlas_dev");
  }
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Base habitée — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}
void jouer();
