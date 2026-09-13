import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * **LA MIGRATION 0087 S'APPLIQUE-T-ELLE SUR UNE BASE QUI A DÉJÀ VÉCU ?**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa panne du 13 septembre 2026 :** *« Plus rien ne fonctionne ! »* — Planning,
 * Terminés et Réglages par terre, le reste debout. Sa base était restée QUATRE
 * migrations en arrière (0087, 0088, 0089, 0090), et le code servi lisait une
 * colonne de la 0090.
 *
 * **Pourquoi elle était restée là.** Le script de migration s'arrête au premier
 * échec, en annulant le fichier entier. Or 0087 ajoute cette contrainte :
 *
 *     CHECK (statut <> 'inconclusif' OR refus IS NOT NULL OR panne IS NOT NULL)
 *
 * après avoir converti les phrases de refus en clés. Une ligne `inconclusif`
 * dont la phrase n'a jamais été rangée n'obtient ni clé ni trace : elle viole la
 * contrainte, l'ajout échoue, et 0088 à 0090 ne sont jamais tentées.
 *
 * Le commentaire de la migration l'écrivait noir sur blanc — *« il n'en existe
 * pas »*. C'était une supposition, et elle était fausse sur une vraie base.
 *
 * **LE TROU QU'ELLE A RÉVÉLÉ, et que cette suite comble :** aucune migration de
 * ce dépôt n'était éprouvée sur une base HABITÉE. Elles tournent toutes sur une
 * base vide, où une contrainte ne peut par construction être violée par aucune
 * ligne. 0087 était donc verte partout, et infranchissable chez lui.
 *
 * **Ce que cette suite fait, et ce qu'elle ne fait pas.** Elle joue le VRAI
 * fichier `drizzle/0087_*.sql`, sur la table `diagnostics` reconstituée dans
 * l'état où 0086 la laisse, et peuplée des lignes qui existent pour de bon. Elle
 * ne rejoue pas les 86 migrations qui précèdent : `atlas_owner` n'a pas le droit
 * de créer une base (c'est voulu), et 0087 ne touche que cette table.
 * ───────────────────────────────────────────────────────────────────────────
 */

const RACINE = path.join(__dirname, "..");
const FICHIER_0087 = path.join(RACINE, "drizzle", "0087_diagnostic_refus_par_cle.sql");
const SCHEMA = `epreuve_0087_${process.pid}`;

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

/** Les phrases d'origine, recopiées du fichier de migration lui-même. */
const PHRASE_CONNUE =
  "Aucune fiche ne correspond à ce qui est visible sur cette photo.";

/**
 * `diagnostics` telle que 0086 la laisse — les seules colonnes que 0087 touche,
 * plus ce qui est obligatoire. Reconstituée ici, et non copiée du schéma
 * TypeScript : celui-ci décrit l'état d'APRÈS, et s'en servir reviendrait à
 * éprouver la migration contre son propre résultat.
 */
const TABLE_EN_0086 = `
  CREATE TABLE "diagnostics" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "entreprise_id" uuid NOT NULL,
    "statut" text NOT NULL,
    "motif_refus" text,
    "created_at" timestamptz NOT NULL DEFAULT now()
  );

  -- **LA RLS EST LÀ, ET SANS ELLE CETTE SUITE MENT.**
  --
  -- Premier jet : une table nue. La migration passait, la suite virait au vert,
  -- et la base du patron refusait toujours — parce que « diagnostics » vit sous
  -- FORCE ROW LEVEL SECURITY, et que le rôle qui migre (« atlas_owner ») n'a pas
  -- BYPASSRLS : c'est délibéré, la CI le vérifie. Sans contexte d'entreprise, il
  -- ne voit AUCUNE ligne — donc les UPDATE de conversion ne touchent rien, quand
  -- la contrainte, elle, est vérifiée par Postgres sur TOUTES les lignes.
  --
  -- Une suite qui n'éprouve pas la RLS n'éprouve pas ce dépôt (CLAUDE.md §5).
  ALTER TABLE "diagnostics" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "diagnostics" FORCE ROW LEVEL SECURITY;
  CREATE POLICY "diagnostics_isolation" ON "diagnostics"
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
    await client.query(TABLE_EN_0086);

    // ─── LA BASE HABITÉE : trois lignes telles qu'elles existent en vrai ────
    // Les lignes se posent comme l'application les pose : sous le contexte de
    // leur entreprise. Elles deviennent alors invisibles au rôle qui migre —
    // et c'est exactement la situation de sa base.
    const ENTREPRISE = "11111111-1111-1111-1111-111111111111";
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [ENTREPRISE]);
    await client.query(`
      INSERT INTO "diagnostics" ("entreprise_id", "statut", "motif_refus") VALUES
        ($2, 'inconclusif', $1),      -- une phrase rangée, que la migration sait convertir
        ($2, 'inconclusif', NULL),    -- CELLE QUI BLOQUE TOUT : aucune phrase rangée
        ($2, 'echoue', 'ANTHROPIC_API_KEY est refusée (HTTP 401).'),
        ($2, 'rendu', NULL)           -- un diagnostic abouti : la contrainte ne le regarde pas
    `, [PHRASE_CONNUE, ENTREPRISE]);
    // Le contexte est RENDU avant la migration : un script de migration n'en
    // pose aucun, et c'est toute la question.
    await client.query(`SELECT set_config('app.entreprise_id', '', false)`);

    const sql0087 = readFileSync(FICHIER_0087, "utf8");

    console.log("=== 0087 sur une base qui a déjà vécu ===");

    await cas("elle s'applique — une ligne « inconclusif » sans phrase ne la bloque plus", async () => {
      // **C'est ICI que la suite doit rougir tant que 0087 n'est pas corrigée.**
      // Le message attendu, relevé sur sa base reconstituée : « check constraint
      // "diagnostics_refus_complet_ck" ... is violated by some row ».
      await client.query("BEGIN");
      try {
        await client.query(sql0087);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(
          `la migration refuse de s'appliquer, et 0088 à 0090 resteront derrière elle : ${
            (e as Error).message
          }`
        );
      }
    });

    // Pour RELIRE, on se remet dans la peau de l'application : sans contexte,
    // on ne verrait rien et l'on conclurait à tort que tout a été effacé.
    const relire = async () =>
      client.query(`SELECT set_config('app.entreprise_id', '11111111-1111-1111-1111-111111111111', false)`);

    await cas("les quatre lignes sont TOUJOURS là — rien n'a été effacé", async () => {
      await relire();
      const { rows } = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM "diagnostics"`);
      assert.equal(rows[0].n, "4", "des lignes ont disparu pendant la migration");
    });

    await cas("la phrase rangée retrouve sa clé", async () => {
      await relire();
      const { rows } = await client.query<{ refus: string | null; panne: string | null }>(
        `SELECT "refus", "panne" FROM "diagnostics" WHERE "statut" = 'inconclusif' AND "refus" = 'aucune_piste'`
      );
      assert.equal(rows.length, 1, "la conversion des phrases connues ne se fait plus");
    });

    await cas("la ligne SANS phrase reste lisible : elle dit ce qu'elle sait", async () => {
      await relire();
      // Le point de la correction : cette ligne doit passer la contrainte, donc
      // porter quelque chose. Elle ne doit ni disparaître, ni recevoir une clé
      // inventée — on ne sait pas laquelle, et un refus faux est pire qu'un
      // refus muet (`docs/AGENT.md` §3 : rien ne s'invente).
      const { rows } = await client.query<{ refus: string | null; panne: string | null }>(
        `SELECT "refus", "panne" FROM "diagnostics"
          WHERE "statut" = 'inconclusif' AND "refus" IS DISTINCT FROM 'aucune_piste'`
      );
      assert.equal(rows.length, 1, "la ligne sans phrase a disparu, ou a été confondue avec une autre");
      assert.equal(rows[0].refus, null, "une clé de refus a été INVENTÉE : on ne sait pas laquelle c'était");
      assert.ok(rows[0].panne, "la ligne ne porte plus rien : l'écran n'aura rien à montrer");
    });

    await cas("le message du fournisseur est passé dans sa colonne", async () => {
      await relire();
      const { rows } = await client.query<{ panne: string }>(
        `SELECT "panne" FROM "diagnostics" WHERE "statut" = 'echoue'`
      );
      assert.match(rows[0].panne, /HTTP 401/, "la trace du fournisseur a été perdue");
    });

    await cas("la contrainte est bien EN PLACE — elle n'a pas été affaiblie pour passer", async () => {
      // La tentation serait de retirer la contrainte plutôt que de traiter les
      // lignes. Ce contrôle refuse cette sortie-là.
      const { rows } = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM pg_constraint
          WHERE conname IN ('diagnostics_refus_ck', 'diagnostics_refus_complet_ck')
            AND connamespace = $1::regnamespace`,
        [SCHEMA]
      );
      assert.equal(rows[0].n, "2", "une des deux contraintes de 0087 manque");
    });

    await cas("LA GARDE RLS EST REMISE — la migration ne laisse pas la table ouverte", async () => {
      // La conversion demande que le propriétaire voie ses lignes : la migration
      // lève donc FORCE le temps de son travail. Si elle oubliait de le rendre,
      // elle aurait affaibli l'isolation pour toujours, en silence — ce que
      // `CLAUDE.md` §4 interdit en premier.
      const { rows } = await client.query<{ relforcerowsecurity: boolean; relrowsecurity: boolean }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
          WHERE relname = 'diagnostics' AND relnamespace = $1::regnamespace`,
        [SCHEMA]
      );
      assert.equal(rows[0].relrowsecurity, true, "la RLS a été désactivée et jamais remise");
      assert.equal(rows[0].relforcerowsecurity, true, "FORCE a été levé et jamais remis : le propriétaire échappe à la politique");
    });

    await cas("et elle refuse toujours ce qu'elle doit refuser", async () => {
      await relire();
      await assert.rejects(
        client.query(
          `INSERT INTO "diagnostics" ("entreprise_id", "statut")
           VALUES ('11111111-1111-1111-1111-111111111111', 'inconclusif')`
        ),
        /diagnostics_refus_complet_ck/,
        "un refus sans rien à montrer entre encore : la contrainte ne protège plus rien"
      );
    });
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {
      console.error(`  (le schéma d'épreuve ${SCHEMA} n'a pas pu être retiré)`);
    });
    client.release();
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} 0087 sur une base habitée — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
