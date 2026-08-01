import { Client } from "pg";

// Contrôles sur la base du banc d'essai : le schéma est-il appliqué, les rôles
// sont-ils bridés, le compte de démonstration est-il utilisable ?
//
// Passe par `pg` plutôt que par `psql` : l'image du conteneur n'embarque pas le
// client PostgreSQL, et ajouter une dépendance externe pour un contrôle
// reviendrait à faire reposer la vérification sur quelque chose d'invérifiable.
//
// Connexion en superutilisateur, délibérément : ces contrôles regardent la base
// elle-même — rôles, comptes, acceptations — pas des données d'entreprise, et
// le contexte d'isolation ne s'applique pas à ces questions.

const URL = process.env.DATABASE_SUPER_URL;
if (!URL) {
  console.error("❌ DATABASE_SUPER_URL manquant.");
  process.exit(1);
}

const client = new Client({ connectionString: URL });

/** Nombre attendu au minimum ; en dessous, quelque chose n'a pas tourné. */
const TABLES_MINIMUM = 20;

async function nombre(sql: string): Promise<number> {
  const r = await client.query<{ n: string }>(sql);
  return Number(r.rows[0].n);
}

const echecs: string[] = [];
function verifier(nom: string, condition: boolean, detail: string) {
  if (condition) {
    console.log(`   ✅ ${nom}`);
  } else {
    console.error(`   ❌ ${nom} — ${detail}`);
    echecs.push(nom);
  }
}

async function main() {
  await client.connect();

  const tables = await nombre(
    "SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public'"
  );
  verifier(
    "Le schéma est appliqué",
    tables >= TABLES_MINIMUM,
    `${tables} tables seulement : les migrations n'ont pas tourné`
  );

  // On s'arrête ici si le schéma manque. Poursuivre ferait échouer la requête
  // suivante sur « relation "users" does not exist » — un message qui envoie
  // chercher une table manquante alors que c'est la base entière qui n'est pas
  // montée. Une erreur qui désigne le mauvais coupable coûte plus cher que
  // pas d'erreur du tout.
  if (tables < TABLES_MINIMUM) {
    await client.end();
    console.error(
      "\n❌ La base n'est pas montée. Rejouer `bash .devcontainer/preparer.sh`."
    );
    process.exit(1);
  }

  // Un banc d'essai qui tournerait en superutilisateur contournerait la RLS
  // sans le dire, et l'isolation entre entreprises ne serait jamais réellement
  // éprouvée pendant les essais.
  const trop = await nombre(
    "SELECT count(*) AS n FROM pg_roles WHERE rolname IN ('atlas_owner','atlas_app') AND (rolsuper OR rolbypassrls)"
  );
  verifier(
    "Les rôles applicatifs restent bridés",
    trop === 0,
    "un rôle applicatif est superutilisateur ou traverse la RLS"
  );

  const compte = await nombre("SELECT count(*) AS n FROM users WHERE email='demo@atlas.local'");
  verifier("Le compte de démonstration existe", compte === 1, "le seed n'a pas tourné");

  // Sans acceptation, chaque écran renvoie vers la garde des documents légaux :
  // le patron tourne en rond dès l'ouverture, sans comprendre pourquoi.
  const acceptations = await nombre("SELECT count(*) AS n FROM acceptations_documents");
  verifier(
    "Les documents légaux sont acceptés",
    acceptations > 0,
    "le parcours sera bloqué dès l'ouverture"
  );

  // De quoi avoir quelque chose à regarder en ouvrant l'application.
  const chantiers = await nombre("SELECT count(*) AS n FROM chantiers WHERE deleted_at IS NULL");
  verifier("Des chantiers de démonstration sont présents", chantiers > 0, "la liste sera vide");

  await client.end();

  if (echecs.length > 0) {
    console.error(`\n❌ ${echecs.length} contrôle(s) en échec.`);
    process.exit(1);
  }
  console.log("\n✅ Base du banc d'essai conforme.");
}

main().catch(async (err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  await client.end().catch(() => {});
  process.exit(1);
});
