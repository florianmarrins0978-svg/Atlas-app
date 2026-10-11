import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { composerMessageClient, MESSAGES_PAR_DEFAUT, refusDuMessage } from "../src/lib/message-client";

/**
 * **LA MIGRATION 0115, SUR UNE BASE OÙ DES MESSAGES ONT DÉJÀ ÉTÉ RÉÉCRITS.**
 *
 * Sur une base vide, aucune entreprise n'a écrit son message : la migration ne
 * toucherait rien et serait verte par construction (`.claude/rules/migrations.md`).
 * Ici, `entreprises` est reconstituée telle que 0114 la laisse, avec les
 * messages qui existent pour de bon : celui d'Atlas recopié à l'identique, un
 * message à lui qui garde la phrase « autre date », un qui l'a reformulée, un
 * qui porte déjà la durée, un collé à la borne des 2 000 caractères.
 *
 * Et l'on vérifie ce qui compte au bout : le message migré, composé pour un
 * envoi case décochée, ne dit plus au client qu'il peut proposer une date.
 */

const RACINE = path.join(__dirname, "..");
const FICHIER = path.join(RACINE, "drizzle", "0115_message_du_devis_suit_l_envoi.sql");
const SCHEMA = `epreuve_0115_${process.pid}`;

/** Le message d'Atlas tel qu'il était AVANT ce lot, recopié : c'est lui que des bases portent encore. */
const ANCIEN_DEFAUT = [
  "Bonjour [client],",
  "",
  "Voici votre [document]. Vous pouvez le consulter et choisir votre date d'intervention. Et si aucune des dates proposées ne vous convient, vous pouvez en proposer une autre. Tout se fait sur cette page :",
  "",
  "[lien]",
  "",
  "Bien à vous,",
  "[entreprise]",
].join("\n");

const LIGNES: Record<string, string | null> = {
  rien: null,
  ancien: ANCIEN_DEFAUT,
  garde: "Salut [client] ! Votre [document] est là. Et si aucune des dates proposées ne vous convient, vous pouvez en proposer une autre.\n[lien]\nÀ bientôt, [entreprise]",
  reformule: "Salut [client] ! Votre [document]. Une autre date vous irait mieux ? Dites-le.\n[lien]\n[entreprise]",
  dejaLa: "Bonjour [client], votre [document] :\n[lien]\n[validite]\n[entreprise]",
  borne: "[document] [lien] " + "x".repeat(2000 - "[document] [lien] ".length),
};

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

async function main() {
  console.log("=== La migration 0115, sur une base habitée ===");
  const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL });
  const client = await pool.connect();
  const lu: Record<string, string | null> = {};
  const notices: string[] = [];
  client.on("notice", (n) => notices.push(n.message ?? ""));
  try {
    await client.query(`CREATE SCHEMA "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);
    await client.query(`
      CREATE TABLE entreprises (
        id text PRIMARY KEY,
        message_client text,
        CONSTRAINT entreprises_message_client_borne CHECK (message_client IS NULL OR length(message_client) <= 2000)
      )`);
    for (const [id, message] of Object.entries(LIGNES)) {
      await client.query(`INSERT INTO entreprises (id, message_client) VALUES ($1, $2)`, [id, message]);
    }
    await client.query("BEGIN");
    await client.query(readFileSync(FICHIER, "utf8"));
    await client.query("COMMIT");
    const { rows } = await client.query(`SELECT id, message_client FROM entreprises`);
    for (const r of rows) lu[r.id] = r.message_client;
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    client.release();
    await pool.end();
  }

  const decoche = (modele: string | null) =>
    composerMessageClient({
      clientNom: "Larousse",
      entrepriseNom: "Eden Nature",
      lien: "https://exemple.test/devis/j",
      modele,
      envoi: { expireLe: "2026-11-13", autreDateAutorisee: false },
    }).corps;

  await cas("la migration COMPTE ce qu'elle a touché, et le dit", async () => {
    const n = notices.find((m) => m.startsWith("0115"));
    assert.ok(n, "aucun compte rendu");
    assert.match(n, /2 message\(s\) avec la phrase/);
    assert.match(n, /3 reçu\(s\) la durée/);
    assert.match(n, /1 laissé\(s\) sans durée/);
  });

  await cas("un message nul reste nul : il suit le message d'Atlas, qui a changé", async () => {
    assert.equal(lu.rien, null);
  });

  await cas("l'ancien message d'Atlas devient EXACTEMENT le nouveau", async () => {
    assert.equal(lu.ancien, MESSAGES_PAR_DEFAUT.devis);
  });

  await cas("son message garde ses mots ; case décochée, la phrase « autre date » ne part plus", async () => {
    assert.ok(lu.garde?.startsWith("Salut [client] ! Votre [document] est là.[autre-date]"), lu.garde ?? "");
    const corps = decoche(lu.garde);
    assert.ok(!corps.includes("aucune des dates"), corps);
    assert.ok(corps.includes("jusqu'au vendredi 13 novembre"), corps);
    assert.equal(refusDuMessage(lu.garde ?? "", "devis"), null);
  });

  await cas("une phrase qu'il a reformulée n'est pas touchée, la durée s'ajoute sous le lien", async () => {
    assert.ok(lu.reformule?.includes("Une autre date vous irait mieux ? Dites-le."));
    assert.ok(lu.reformule?.includes("[lien]\n\n[validite]"));
  });

  await cas("une durée déjà posée ne se double pas", async () => {
    assert.equal(lu.dejaLa, LIGNES.dejaLa);
  });

  await cas("un message à la borne n'est pas cassé : il reste tel quel, et sera refusé en le disant", async () => {
    assert.equal(lu.borne, LIGNES.borne);
    assert.match(refusDuMessage(lu.borne ?? "", "devis") ?? "", /durée du lien/);
  });

  if (echecs > 0) {
    console.error(`\n${echecs} cas en échec.`);
    process.exit(1);
  }
  console.log("\n✅ 0115 tient sur une base où des messages ont été réécrits.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
