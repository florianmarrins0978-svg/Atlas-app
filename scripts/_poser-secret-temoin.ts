// Outil d'ESSAI seulement : pose un secret d'agenda chiffré, pour éprouver que
// `eprouver-restauration.ts` sait rougir quand AUTH_SECRET a changé.
import { Pool } from "pg";
import { chiffrer } from "../src/server/agenda/secret-au-repos";
const pool = new Pool({ connectionString: process.env.DATABASE_SUPER_URL ?? process.env.DATABASE_URL });
(async () => {
  await pool.query("DELETE FROM agendas_externes");
  const { rows } = await pool.query("SELECT id FROM entreprises LIMIT 1");
  const chiffre = chiffrer("mot-de-passe-icloud-du-patron");
  await pool.query(
    "INSERT INTO agendas_externes (entreprise_id, fournisseur, mot_de_passe) VALUES ($1,'apple',$2)",
    [rows[0].id, chiffre]
  );
  console.log(`  secret posé, chiffré : ${chiffre.slice(0, 34)}…`);
  await pool.end();
})();
