// AUCUNE POLITIQUE D'ISOLATION NE DOIT LEVER SUR UN CONTEXTE VIDE — constat F5.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CE DÉFAUT EST, ET CE QU'IL N'EST PAS.**
//
// Ce n'est PAS une fuite, et le dire compte : une alerte qui exagère s'apprend
// à être ignorée, et l'on perd le garde-fou sans s'en apercevoir. Sans contexte
// posé, `current_setting('app.entreprise_id', true)` rend NULL, la politique
// est fausse, et la table est vide. Le refus tient dans les deux formes.
//
// **Ce qui casse, c'est le contexte VIDE.** PostgreSQL remet un réglage de
// session à la chaîne vide — et non à NULL — après certaines transactions sur
// une connexion mutualisée. `''::uuid` ne rend alors pas « rien » : il LÈVE,
// `invalid input syntax for type uuid: ""`. L'écran tombe en erreur au lieu de
// se montrer vide, et le message accuse un type de données là où le vrai
// coupable est un contexte perdu — il envoie chercher au mauvais endroit.
//
// La migration 0002 avait corrigé cela pour les douze tables de janvier.
// 0025 a créé `corrections_dictee` quatre mois plus tard sans reprendre la
// leçon, et personne ne l'a vu : aucun contrôle ne regardait la FORME des
// politiques. 0067 la répare ; cette suite empêche la prochaine.
// ═══════════════════════════════════════════════════════════════════════════
//
// CE QU'ELLE TIENT :
//
//   1. **la mesure**, table par table, sous `atlas_app`, contexte forcé à '' :
//      chacune doit rendre 0 ligne, jamais une erreur. C'est la vérité ; le
//      reste n'en est que la forme ;
//   2. **la forme**, pour nommer le coupable : aucune politique du schéma ne
//      doit convertir un réglage en uuid sans passer par `NULLIF`. Sans elle,
//      la mesure dirait « ça lève » sans dire pourquoi ;
//   3. **et le contrôle sait échouer** : il est confronté à une politique
//      fabriquée exprès avec l'ancienne forme, puis retirée. Un contrôle qui
//      n'a jamais rougi ne prouve rien.

import assert from "node:assert/strict";
import { Client } from "pg";

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

/** La forme fragile : une conversion en uuid qui ne se protège pas du vide. */
const FRAGILE = /current_setting\([^)]*\)\)?::uuid/;

type Politique = { tablename: string; policyname: string; qual: string | null; with_check: string | null };

async function politiques(client: Client): Promise<Politique[]> {
  const { rows } = await client.query<Politique>(
    `SELECT tablename, policyname, qual, with_check
       FROM pg_policies
      WHERE schemaname = 'public'
        AND coalesce(qual, '') || coalesce(with_check, '') LIKE '%current_setting%'
      ORDER BY tablename, policyname`
  );
  return rows;
}

/** Celles dont l'expression convertit un réglage en uuid sans `NULLIF`. */
function fragiles(liste: Politique[]) {
  return liste.filter((p) =>
    [p.qual, p.with_check].some((e) => {
      if (!e) return false;
      // On retire d'abord tout ce qui est déjà protégé : ce qui reste et se
      // convertit encore en uuid est, par construction, la forme fragile.
      const sansNullif = e.replace(/NULLIF\(current_setting\([^)]*\)[^)]*\)/g, "PROTEGE");
      return FRAGILE.test(sansNullif);
    })
  );
}

async function main() {
  const urlApp = process.env.DATABASE_URL;
  const urlAdmin = process.env.DATABASE_ADMIN_URL;
  assert.ok(urlApp && urlAdmin, "DATABASE_URL et DATABASE_ADMIN_URL sont nécessaires");

  const admin = new Client({ connectionString: urlAdmin });
  await admin.connect();
  const app = new Client({ connectionString: urlApp });
  await app.connect();

  console.log("Isolation : le contexte vide ne doit jamais lever");

  const liste = await politiques(admin);

  await essai("des politiques d'isolation existent — sinon ce contrôle ne mesure rien", async () => {
    // Une liste vide rendrait TOUS les contrôles suivants verts sans rien
    // éprouver. L'absence de matière à mesurer n'est pas un succès.
    assert.ok(liste.length >= 30, `seulement ${liste.length} politiques trouvées : le schéma est-il monté ?`);
  });

  await essai("aucune politique ne convertit un réglage en uuid sans NULLIF", async () => {
    const mauvaises = fragiles(liste);
    assert.deepEqual(
      mauvaises.map((p) => `${p.tablename}.${p.policyname}`),
      [],
      "ces politiques lèveront sur un contexte vide au lieu de rendre 0 ligne"
    );
  });

  // La mesure : chaque table protégée par `app.entreprise_id`, contexte forcé
  // à la chaîne vide, doit se montrer VIDE — pas en erreur.
  const tables = [
    ...new Set(
      liste
        .filter((p) => `${p.qual ?? ""}${p.with_check ?? ""}`.includes("app.entreprise_id"))
        .map((p) => p.tablename)
    ),
  ].sort();

  await essai(`les ${tables.length} tables d'entreprise rendent 0 ligne sur un contexte vide`, async () => {
    assert.ok(tables.length >= 30, `seulement ${tables.length} tables : la liste est-elle bien construite ?`);
    const levees: string[] = [];
    for (const table of tables) {
      try {
        await app.query("BEGIN");
        await app.query("SET LOCAL app.entreprise_id = ''");
        const { rows } = await app.query(`SELECT count(*)::int AS n FROM "${table}"`);
        assert.equal(rows[0].n, 0, `${table} laisse voir ${rows[0].n} ligne(s) sans contexte`);
        await app.query("COMMIT");
      } catch (e) {
        await app.query("ROLLBACK");
        levees.push(`${table} : ${(e as Error).message}`);
      }
    }
    assert.deepEqual(levees, [], "ces tables lèvent au lieu de se montrer vides");
  });

  // **Le contrôle confronté à ce qu'il prétend attraper.** On fabrique
  // délibérément l'ancienne forme sur une table d'essai, on vérifie que la
  // détection la nomme ET que la lecture lève, puis on efface tout.
  await essai("le contrôle sait rougir : l'ancienne forme est détectée et lève bien", async () => {
    await admin.query(`
      CREATE TABLE IF NOT EXISTS _essai_contexte_vide (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        entreprise_id uuid NOT NULL
      )`);
    await admin.query("ALTER TABLE _essai_contexte_vide ENABLE ROW LEVEL SECURITY");
    await admin.query("ALTER TABLE _essai_contexte_vide FORCE ROW LEVEL SECURITY");
    await admin.query(`DROP POLICY IF EXISTS _essai_isolation ON _essai_contexte_vide`);
    await admin.query(`
      CREATE POLICY _essai_isolation ON _essai_contexte_vide
        USING (entreprise_id = current_setting('app.entreprise_id', true)::uuid)`);
    await admin.query("GRANT SELECT ON _essai_contexte_vide TO atlas_app");

    try {
      const avec = fragiles(await politiques(admin)).map((p) => p.tablename);
      assert.ok(
        avec.includes("_essai_contexte_vide"),
        "la détection laisse passer l'ancienne forme : elle ne prouverait rien sur les vraies tables"
      );

      let aLeve = false;
      try {
        await app.query("BEGIN");
        await app.query("SET LOCAL app.entreprise_id = ''");
        await app.query("SELECT count(*) FROM _essai_contexte_vide");
        await app.query("COMMIT");
      } catch {
        await app.query("ROLLBACK");
        aLeve = true;
      }
      assert.ok(aLeve, "l'ancienne forme ne lève plus : le défaut décrit ici n'existerait pas");
    } finally {
      await admin.query("DROP TABLE IF EXISTS _essai_contexte_vide");
    }
  });

  await app.end();
  await admin.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Contexte vide — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
