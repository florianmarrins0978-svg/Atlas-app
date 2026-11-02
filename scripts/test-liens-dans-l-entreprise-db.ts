// UN LIEN ENTRE DEUX TABLES NE TRAVERSE JAMAIS DEUX ENTREPRISES.
//
// **Audit du 25 octobre 2026, E10.** Une clé étrangère se vérifie hors de la
// RLS : sans entreprise dans le lien, un retour d'intervention écrit chez A
// pouvait viser un chantier de B, et la base l'acceptait. La migration 0149
// double chaque lien d'une clé composite (l'identifiant ET l'entreprise).
//
// Deux contrôles : le geste lui-même, sous `atlas_app`, refusé ; et le
// catalogue de la base, pour que la PROCHAINE table qui oublierait la paire soit
// refusée ici avant d'arriver chez lui.

import assert from "node:assert/strict";
import { Pool } from "pg";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { effacerClient } from "../src/server/repositories/donnees-client";

const SUPER = new Pool({
  connectionString: (() => {
    const u = new URL(process.env.ATLAS_BASE_SUPER ?? "postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test");
    u.pathname = new URL(process.env.DATABASE_URL ?? "postgresql://x@localhost/atlas_test").pathname;
    return u.toString();
  })(),
});

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const LIENS_SANS_ENTREPRISE = `
        SELECT c.conrelid::regclass AS enfant, c.conname AS lien
          FROM pg_constraint c
         WHERE c.contype = 'f'
           AND c.confrelid <> 'entreprises'::regclass
           AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'entreprise_id' AND NOT attisdropped)
           AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = c.confrelid AND attname = 'entreprise_id' AND NOT attisdropped)
           AND NOT EXISTS (SELECT 1 FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k WHERE a.attname = 'entreprise_id')
           AND NOT EXISTS (
             SELECT 1 FROM pg_constraint s
              WHERE s.contype = 'f' AND s.conrelid = c.conrelid AND s.confrelid = c.confrelid
                AND c.conkey <@ s.conkey
                AND EXISTS (SELECT 1 FROM unnest(s.conkey) k JOIN pg_attribute a ON a.attrelid = s.conrelid AND a.attnum = k WHERE a.attname = 'entreprise_id'))
         ORDER BY 1, 2`;

/**
 * Chaque paire « ancien lien, clé composite qui le double », avec leurs deux
 * façons de réagir à l'effacement de la ligne visée.
 *
 * `confdelsetcols` vide veut dire « toutes les colonnes du lien » : pour la
 * clé composite, ce serait aussi `entreprise_id`, et l'on comparerait deux
 * choses différentes. D'où le `coalesce` sur les colonnes du lien lui-même.
 */
const PAIRES = `
        SELECT c.conrelid::regclass::text AS enfant,
               c.conname AS composite, s.conname AS ancien,
               pg_get_constraintdef(s.oid) AS definition_ancien,
               c.confdeltype::text AS action_composite, s.confdeltype::text AS action_ancien,
               coalesce(c.confdelsetcols, c.conkey) = coalesce(s.confdelsetcols, s.conkey) AS memes_colonnes
          FROM pg_constraint c
          JOIN pg_constraint s
            ON s.contype = 'f' AND s.conrelid = c.conrelid AND s.confrelid = c.confrelid
           AND s.oid <> c.oid AND s.conkey <@ c.conkey
         WHERE c.contype = 'f'
           AND EXISTS (SELECT 1 FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k WHERE a.attname = 'entreprise_id')
           AND NOT EXISTS (SELECT 1 FROM unnest(s.conkey) k JOIN pg_attribute a ON a.attrelid = s.conrelid AND a.attnum = k WHERE a.attname = 'entreprise_id')
         ORDER BY 1, 2`;

type Paire = {
  enfant: string;
  composite: string;
  ancien: string;
  definition_ancien: string;
  action_composite: string;
  action_ancien: string;
  memes_colonnes: boolean;
};

function desaccords(paires: Paire[]): string[] {
  return paires
    .filter((p) => p.action_composite !== p.action_ancien || (p.action_ancien === "n" && !p.memes_colonnes))
    .map((p) => `${p.enfant}.${p.composite} (${p.action_composite}) contre ${p.ancien} (${p.action_ancien})`);
}

/**
 * Le nom du déclencheur que PostgreSQL tire à l'effacement de la ligne visée.
 * Ils partent dans l'ordre ALPHABÉTIQUE de ces noms, qui portent un numéro
 * interne : c'est de là que vient la panne, et c'est ce qu'on vérifie.
 */
const DECLENCHEUR_D_EFFACEMENT = `
        SELECT t.tgname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
         WHERE t.tgconstraint = (SELECT oid FROM pg_constraint WHERE conname = $1 AND conrelid = $2::regclass)
           AND p.proname LIKE 'RI_FKey_%_del'`;

async function sousA<T>(entrepriseId: string, fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    return await fn(c);
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
}

async function main() {
  console.log("=== Les liens ne traversent pas les entreprises ===\n");
  const marque = Date.now();
  const A = await entreprisesRepo.creerEntreprise({ nom: `Liens A ${marque}` }, { email: `liens-a-${marque}@test.local`, nom: "A" });
  const B = await entreprisesRepo.creerEntreprise({ nom: `Liens B ${marque}` }, { email: `liens-b-${marque}@test.local`, nom: "B" });
  const chantier = async (e: string) =>
    (await SUPER.query(`INSERT INTO chantiers (entreprise_id, nom) VALUES ($1, 'Chantier') RETURNING id`, [e])).rows[0].id as string;
  const chezA = await chantier(A.entreprise.id);
  const chezB = await chantier(B.entreprise.id);

  try {
    await essai("un retour écrit chez A vers un chantier de A passe", async () => {
      await sousA(A.entreprise.id, (c) =>
        c.query(`INSERT INTO retours_intervention (entreprise_id, chantier_id) VALUES ($1, $2)`, [A.entreprise.id, chezA])
      );
    });

    await essai("le même retour vers un chantier de B est REFUSÉ par la base", async () => {
      await assert.rejects(
        sousA(A.entreprise.id, (c) =>
          c.query(`INSERT INTO retours_intervention (entreprise_id, chantier_id) VALUES ($1, $2)`, [A.entreprise.id, chezB])
        ),
        /violates foreign key constraint "retours_intervention_chantier_id_meme_entreprise"/,
        "UN RETOUR DE A A PU VISER UN CHANTIER DE B"
      );
    });

    await essai("aucun lien entre deux tables d'entreprise n'oublie l'entreprise", async () => {
      // Chaque clé étrangère qui relie deux tables portant `entreprise_id` doit
      // avoir une sœur composite qui l'inclut, sur les mêmes colonnes.
      const { rows } = await SUPER.query(LIENS_SANS_ENTREPRISE);
      assert.deepEqual(
        rows.map((r) => `${r.enfant}.${r.lien}`),
        [],
        "Ces liens n'ont pas leur clé composite : ajouter, dans une migration, FOREIGN KEY (colonne, entreprise_id) REFERENCES parent (id, entreprise_id) NOT VALID (modèle : drizzle/0149)"
      );
    });

    await essai("chaque clé composite réagit à l'effacement comme le lien qu'elle double", async () => {
      // **La panne du 1er novembre 2026** : la clé composite de 0149 était en
      // NO ACTION à côté d'un lien en CASCADE. Elle refuse alors l'effacement
      // d'un chantier qui porte un créneau, si son déclencheur part AVANT celui
      // de la cascade, et cet ordre dépend d'un numéro interne propre à chaque
      // base. Une seule règle tient sur toutes les bases : les deux font pareil.
      const { rows } = await SUPER.query<Paire>(PAIRES);
      assert.ok(rows.length >= 26, `seulement ${rows.length} paire(s) lue(s) : le catalogue n'a pas été lu, rien n'est prouvé`);
      assert.deepEqual(
        desaccords(rows),
        [],
        "Ces clés composites n'effacent pas comme le lien qu'elles doublent : leur ON DELETE doit être le même (modèle : drizzle/0155)"
      );
    });

    await essai("le contrôle des actions sait échouer : une clé composite remise en NO ACTION est dénoncée", async () => {
      const c = await SUPER.connect();
      try {
        await c.query("BEGIN");
        await c.query(`ALTER TABLE creneaux_chantier DROP CONSTRAINT creneaux_chantier_chantier_id_meme_entreprise`);
        await c.query(
          `ALTER TABLE creneaux_chantier ADD CONSTRAINT creneaux_chantier_chantier_id_meme_entreprise
             FOREIGN KEY (chantier_id, entreprise_id) REFERENCES chantiers (id, entreprise_id) NOT VALID`
        );
        const { rows } = await c.query<Paire>(PAIRES);
        assert.deepEqual(desaccords(rows), [
          "creneaux_chantier.creneaux_chantier_chantier_id_meme_entreprise (a) contre creneaux_chantier_chantier_id_fkey (c)",
        ]);
      } finally {
        await c.query("ROLLBACK");
        c.release();
      }
    });

    await essai("supprimer un client se fait même quand la clé composite parle AVANT la cascade", async () => {
      // **Le geste du patron, dans l'ordre de SA base.** On recrée chaque paire
      // à l'identique, la clé composite d'abord, l'ancien lien ensuite : les
      // deux reçoivent des numéros du même nombre de chiffres, l'ancien le plus
      // grand, donc son déclencheur part APRÈS celui de la clé composite. C'est
      // l'ordre qu'une base vieille de plusieurs mois peut avoir, et que la
      // base neuve des essais n'a jamais : sans cette étape, l'essai serait vert
      // par hasard.
      //
      // **Recréer l'ancien seul ne suffisait pas**, vu le 2 novembre 2026 : la
      // base d'essai avait passé 100 000 dans la journée, l'ancien a reçu
      // `a_159050`, qui passe AVANT `a_20217`. L'essai l'a refusé plutôt que de
      // conclure, et c'est la panne même qu'il éprouve.
      const { rows: paires } = await SUPER.query<Paire>(PAIRES);
      const definitions = new Map(
        (
          await SUPER.query<{ conname: string; definition: string }>(
            `SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = ANY($1)`,
            [paires.map((p) => p.composite)]
          )
        ).rows.map((r) => [r.conname, r.definition])
      );
      const c = await SUPER.connect();
      try {
        await c.query("BEGIN");
        for (const p of paires) {
          await c.query(`ALTER TABLE ${p.enfant} DROP CONSTRAINT ${p.composite}`);
          await c.query(`ALTER TABLE ${p.enfant} ADD CONSTRAINT ${p.composite} ${definitions.get(p.composite)}`);
        }
        for (const p of paires) {
          await c.query(`ALTER TABLE ${p.enfant} DROP CONSTRAINT ${p.ancien}`);
          await c.query(`ALTER TABLE ${p.enfant} ADD CONSTRAINT ${p.ancien} ${p.definition_ancien}`);
        }
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
      for (const lien of ["creneaux_chantier_chantier_id", "rappels_vus_chantier_id", "passages_entretien_client_id"]) {
        const table = lien.replace(/_(chantier|client)_id$/, "");
        const [composite] = (await SUPER.query(DECLENCHEUR_D_EFFACEMENT, [`${lien}_meme_entreprise`, table])).rows;
        const [ancien] = (await SUPER.query(DECLENCHEUR_D_EFFACEMENT, [`${lien}_fkey`, table])).rows;
        assert.ok(
          composite && ancien && String(composite.tgname) < String(ancien.tgname),
          `l'ordre voulu n'a pas pu être posé pour ${lien} : l'essai ne prouverait rien`
        );
      }

      const e = A.entreprise.id;
      const ctx = { utilisateurId: A.utilisateurId, entrepriseId: e };
      const client = (await SUPER.query(`INSERT INTO clients (entreprise_id, nom) VALUES ($1, 'Balba') RETURNING id`, [e]))
        .rows[0].id as string;
      const ch = (
        await SUPER.query(`INSERT INTO chantiers (entreprise_id, nom, client_id) VALUES ($1, 'Chez Balba', $2) RETURNING id`, [
          e,
          client,
        ])
      ).rows[0].id as string;
      await SUPER.query(`INSERT INTO creneaux_chantier (entreprise_id, chantier_id, jour, demi) VALUES ($1, $2, '2026-11-02', 'matin')`, [e, ch]);
      await SUPER.query(`INSERT INTO rappels_vus (entreprise_id, chantier_id, genre) VALUES ($1, $2, 'chantier-sans-devis')`, [e, ch]);
      await SUPER.query(`INSERT INTO retours_intervention (entreprise_id, chantier_id) VALUES ($1, $2)`, [e, ch]);
      await SUPER.query(`INSERT INTO passages_entretien (entreprise_id, jour, client_id) VALUES ($1, '2026-11-02', $2)`, [e, client]);

      const rapport = await effacerClient(ctx, client);
      assert.equal(rapport?.disparu, true, "le client aurait dû disparaître");
      const restes = await SUPER.query(
        `SELECT (SELECT count(*) FROM clients WHERE id = $1)::int AS clients,
                (SELECT count(*) FROM chantiers WHERE id = $2)::int AS chantiers,
                (SELECT count(*) FROM creneaux_chantier WHERE chantier_id = $2)::int AS creneaux`,
        [client, ch]
      );
      assert.deepEqual(restes.rows[0], { clients: 0, chantiers: 0, creneaux: 0 });
    });

    await essai("le contrôle du catalogue sait échouer : la clé composite retirée, le lien est dénoncé", async () => {
      const c = await SUPER.connect();
      try {
        await c.query("BEGIN");
        await c.query(`ALTER TABLE retours_intervention DROP CONSTRAINT retours_intervention_chantier_id_meme_entreprise`);
        const { rows } = await c.query(LIENS_SANS_ENTREPRISE);
        assert.deepEqual(rows.map((r) => String(r.lien)), ["retours_intervention_chantier_id_fkey"]);
      } finally {
        await c.query("ROLLBACK");
        c.release();
      }
    });
  } finally {
    // Les enfants d'abord : si l'essai de l'effacement a rougi, effacer le
    // chantier ici rougirait de la même façon, et masquerait sa raison.
    for (const e of [A.entreprise.id, B.entreprise.id]) {
      for (const table of ["creneaux_chantier", "rappels_vus", "retours_intervention", "passages_entretien", "chantiers", "clients"]) {
        await SUPER.query(`DELETE FROM ${table} WHERE entreprise_id = $1`, [e]);
      }
    }
    await SUPER.end();
    await pool.end();
  }

  console.log(`\nLes liens dans l'entreprise — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
