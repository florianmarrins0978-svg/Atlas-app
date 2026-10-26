import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * **LA MIGRATION 0148 S'APPLIQUE-T-ELLE SUR UNE BASE QUI A DÉJÀ VÉCU ?**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * 0148 n'écrit aucune ligne, mais elle REMPLACE trois contraintes de
 * `mouvements_bancaires` (la justification, le motif, la cohérence). Une
 * contrainte ajoutée se vérifie sur TOUTES les lignes, RLS ou pas
 * (`.claude/rules/migrations.md`) : une ligne qui ne la tiendrait pas bloquerait
 * la migration, et toutes celles qui la suivent, sur sa base et nulle part
 * ailleurs. C'est la panne de 0087 (13 septembre 2026), et l'on ne la rejoue pas.
 *
 * Elle joue le VRAI fichier `drizzle/0148_*.sql`, sur la table reconstituée dans
 * l'état où 0147 la laisse (les colonnes et contraintes de 0142 et 0143), sous
 * FORCE ROW LEVEL SECURITY comme en vrai, et peuplée d'une ligne de chaque
 * justification que l'ancien code sait écrire. Le modèle est
 * `test-migration-0087-base-habitee.ts`.
 * ───────────────────────────────────────────────────────────────────────────
 */

const RACINE = path.join(__dirname, "..");
const FICHIER_0148 = path.join(RACINE, "drizzle", "0148_virement_recu_regle_au_dossier.sql");
const SCHEMA = `epreuve_0148_${process.pid}`;
const ENTREPRISE = "22222222-2222-2222-2222-222222222222";

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

/**
 * `mouvements_bancaires` telle que 0147 la laisse : recopiée de 0142 et 0143,
 * et non du schéma TypeScript, qui décrit l'état d'APRÈS. Les clés étrangères
 * sont laissées de côté : 0148 ne les touche pas.
 */
const TABLE_EN_0147 = `
  CREATE TABLE "mouvements_bancaires" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "entreprise_id" uuid NOT NULL,
    "cle" text NOT NULL,
    "jour" date NOT NULL,
    "montant" numeric(12, 2) NOT NULL,
    "sens" text NOT NULL,
    "libelle" text NOT NULL DEFAULT '',
    "justification" text
      CONSTRAINT "mouvements_bancaires_justification_check"
      CHECK ("justification" IS NULL OR "justification" IN ('ticket', 'facture', 'ticket_perdu', 'motif')),
    "achat_id" uuid,
    "facture_recue_id" uuid,
    "motif" text
      CONSTRAINT "mouvements_bancaires_motif_check"
      CHECK ("motif" IS NULL OR "motif" IN ('fournisseur', 'salaire', 'loyer', 'impots', 'pret', 'perso')),
    "relie_par" text,
    "justifie_le" timestamptz
  );
  ALTER TABLE "mouvements_bancaires"
    ADD CONSTRAINT "mouvements_bancaires_justification_coherente" CHECK (
      ("justification" IS NULL AND "achat_id" IS NULL AND "facture_recue_id" IS NULL AND "motif" IS NULL)
      OR ("justification" = 'motif' AND "motif" IS NOT NULL)
      OR ("justification" IN ('ticket', 'facture', 'ticket_perdu'))
    );
  ALTER TABLE "mouvements_bancaires" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "mouvements_bancaires" FORCE ROW LEVEL SECURITY;
  CREATE POLICY "mouvements_bancaires_isolation" ON "mouvements_bancaires"
    USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
    WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
`;

async function main() {
  const url = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ Ni DATABASE_ADMIN_URL ni DATABASE_URL : impossible de mesurer quoi que ce soit.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query(`CREATE SCHEMA "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);
    await client.query(TABLE_EN_0147);

    // ─── LA BASE HABITÉE : une ligne de chaque sorte, posées comme l'appli les
    // pose, sous le contexte de leur entreprise. Le contexte est rendu ensuite :
    // un script de migration n'en pose aucun.
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [ENTREPRISE]);
    await client.query(
      `INSERT INTO "mouvements_bancaires" ("entreprise_id", "cle", "jour", "montant", "sens", "justification", "achat_id", "motif", "relie_par") VALUES
        ($1, 'a', '2026-10-01', 12.00, 'sortie', NULL, NULL, NULL, NULL),
        ($1, 'b', '2026-10-02', 62.40, 'sortie', 'ticket', gen_random_uuid(), NULL, 'atlas'),
        -- Un ticket effacé délie sa ligne sans réécrire la justification (0143).
        ($1, 'c', '2026-10-03', 23.80, 'sortie', 'ticket', NULL, NULL, 'patron'),
        ($1, 'd', '2026-10-04', 1450.00, 'sortie', 'facture', NULL, NULL, 'patron'),
        ($1, 'e', '2026-10-05', 18.50, 'sortie', 'ticket_perdu', NULL, NULL, 'patron'),
        ($1, 'f', '2026-10-06', 650.00, 'sortie', 'motif', NULL, 'loyer', 'patron'),
        ($1, 'g', '2026-10-07', 200.00, 'sortie', 'motif', NULL, 'perso', 'patron'),
        ($1, 'h', '2026-10-08', 864.00, 'entree', NULL, NULL, NULL, NULL),
        -- Une ligne d'hier que 0143 laissait passer : à justifier, et un ticket
        -- quand même. Elle ne doit PAS bloquer la migration.
        ($1, 'i', '2026-10-09', 9.99, 'sortie', NULL, gen_random_uuid(), NULL, NULL)`,
      [ENTREPRISE]
    );
    await client.query(`SELECT set_config('app.entreprise_id', '', false)`);

    const sql0148 = readFileSync(FICHIER_0148, "utf8");
    console.log("=== 0148 sur une base qui a déjà vécu ===");

    await cas("elle s'applique : aucune ligne existante ne viole les contraintes élargies", async () => {
      await client.query("BEGIN");
      try {
        await client.query(sql0148);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`la migration refuse de s'appliquer, et celles qui la suivent resteront derrière elle : ${(e as Error).message}`);
      }
    });

    const relire = () => client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [ENTREPRISE]);

    await cas("les neuf lignes sont TOUJOURS là, et aucune n'a changé de justification", async () => {
      await relire();
      const { rows } = await client.query<{ cle: string; justification: string | null; motif: string | null }>(
        `SELECT "cle", "justification", "motif" FROM "mouvements_bancaires" ORDER BY "cle"`
      );
      assert.equal(rows.length, 9, "des lignes ont disparu pendant la migration");
      assert.deepEqual(
        rows.map((r) => `${r.cle}:${r.justification ?? "∅"}:${r.motif ?? "∅"}`),
        ["a:∅:∅", "b:ticket:∅", "c:ticket:∅", "d:facture:∅", "e:ticket_perdu:∅", "f:motif:loyer", "g:motif:perso", "h:∅:∅", "i:∅:∅"]
      );
    });

    await cas("un virement reçu prend une réponse à lui", async () => {
      await relire();
      await client.query(`UPDATE "mouvements_bancaires" SET "justification" = 'motif', "motif" = 'remboursement', "relie_par" = 'patron' WHERE "cle" = 'h'`);
    });

    await cas("une facture faite hors d'Atlas entre avec son fichier", async () => {
      await relire();
      await client.query(`UPDATE "mouvements_bancaires" SET "justification" = 'facture_hors_atlas', "motif" = NULL, "piece_cle" = 'entreprises/x/factures-hors-atlas/a.jpg', "piece_nature" = 'photo', "piece_total" = 1728.00 WHERE "cle" = 'h'`);
    });

    await cas("et elle refuse toujours ce qu'elle doit refuser", async () => {
      await relire();
      await assert.rejects(
        client.query(`UPDATE "mouvements_bancaires" SET "justification" = 'facture_hors_atlas', "piece_cle" = NULL, "piece_nature" = NULL WHERE "cle" = 'a'`),
        /mouvements_bancaires_justification_coherente/,
        "une facture hors d'Atlas sans fichier entre : la ligne se croirait justifiée sans rien montrer"
      );
      await assert.rejects(
        client.query(`UPDATE "mouvements_bancaires" SET "justification" = 'motif', "motif" = 'cadeau' WHERE "cle" = 'a'`),
        /mouvements_bancaires_motif_check/,
        "un motif inconnu entre"
      );
      await assert.rejects(
        client.query(`UPDATE "mouvements_bancaires" SET "piece_nature" = 'tableur' WHERE "cle" = 'h'`),
        /mouvements_bancaires_piece_nature_check/,
        "un tableur passe pour une pièce qui se pose dans un PDF"
      );
      await assert.rejects(
        client.query(`UPDATE "mouvements_bancaires" SET "piece_cle" = 'entreprises/x/y.jpg' WHERE "cle" = 'a'`),
        /mouvements_bancaires_justification_coherente/,
        "une ligne à justifier garde un fichier : il ne serait montré nulle part"
      );
      await assert.rejects(
        client.query(`UPDATE "mouvements_bancaires" SET "motif" = 'loyer' WHERE "cle" = 'a'`),
        /mouvements_bancaires_justification_coherente/,
        "une ligne à justifier porte un motif : la contrainte de 0143 la laissait passer"
      );
    });

    await cas("LA GARDE RLS EST INTACTE", async () => {
      const { rows } = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'mouvements_bancaires' AND relnamespace = $1::regnamespace`,
        [SCHEMA]
      );
      assert.equal(rows[0].relrowsecurity, true);
      assert.equal(rows[0].relforcerowsecurity, true);
    });
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {
      console.error(`  (le schéma d'épreuve ${SCHEMA} n'a pas pu être retiré)`);
    });
    client.release();
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} 0148 sur une base habitée — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
