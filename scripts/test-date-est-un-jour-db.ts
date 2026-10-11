import assert from "node:assert/strict";
import { pool, fermerPool } from "../src/server/db/client";

/**
 * UNE COLONNE `date` ARRIVE EN JOUR, JAMAIS EN INSTANT — quel que soit le
 * fuseau du PC qui lit.
 *
 * **Ce que cette suite tient.** Le 13 septembre 2026, quatre suites navigateur
 * rougissaient d'un jour sur un PC à l'heure de Paris, et restaient vertes en
 * UTC — la CI et son espace. Le pilote rendait une `date` en objet `Date` à
 * minuit LOCAL ; relu par `toISOString()`, minuit à Paris devient 22 h la
 * veille. La règle vit désormais dans `src/server/db/client.ts`, au pilote.
 *
 * **Elle sait rougir sans dépendre du fuseau** : sur l'ancien pilote, la
 * colonne arrive en `Date`, et l'égalité avec « 2026-09-14 » échoue partout,
 * pas seulement à Paris. Les horodatages, eux, restent des instants — une
 * suite qui les lirait en texte se tromperait dans l'autre sens.
 */

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  const { rows } = await pool.query<{ jour: unknown; jours: unknown; instant: unknown }>(
    `SELECT '2026-09-14'::date AS jour,
            ARRAY['2026-09-14', '2026-09-15']::date[] AS jours,
            '2026-09-14T00:00:00+02:00'::timestamptz AS instant`
  );
  const r = rows[0];

  await essai("une `date` arrive en « AAAA-MM-JJ », le jour même — pas en Date à minuit local", async () => {
    assert.equal(r.jour, "2026-09-14");
  });

  await essai("une `date[]` arrive en jours, un par case", async () => {
    assert.deepEqual(r.jours, ["2026-09-14", "2026-09-15"]);
  });

  await essai("un `timestamptz` reste un instant : lui a une heure, et elle compte", async () => {
    assert.ok(r.instant instanceof Date, "l'horodatage n'est plus un instant");
    assert.equal((r.instant as Date).toISOString(), "2026-09-13T22:00:00.000Z");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s)\n`);
  await fermerPool();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await fermerPool();
  process.exit(1);
});
