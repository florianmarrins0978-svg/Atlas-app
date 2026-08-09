import { Pool } from "pg";
import { compare } from "bcryptjs";

/**
 * « Email ou mot de passe incorrect » alors que les identifiants sont bons :
 * qui ment ?
 *
 * **Pourquoi ce script existe.** Le 9 août 2026, le patron ne peut plus se
 * connecter à son banc d'essai. `verifier-banc-essai.ts` répond « base
 * conforme » — mais il interroge la base sous `DATABASE_SUPER_URL`, le
 * superutilisateur. L'application, elle, lit sous `atlas_app`. Un contrôle vert
 * et une connexion refusée peuvent donc coexister sans se contredire, et c'est
 * exactement ce qui s'est produit.
 *
 * Ce script refait **le geste exact de `authorize()`** : même requête, même
 * rôle, même comparaison bcrypt. Ce qu'il affiche, c'est ce que l'application
 * voit — pas ce que la base contient.
 *
 * **Il ne modifie rien.** On peut le lancer sur un banc en panne sans risquer
 * d'effacer un chantier ni ce que l'agent a appris — ce qui n'est pas le cas de
 * `preparer.sh`, dont le seed emporte en cascade les corrections, les leçons de
 * prix et les grilles.
 */

const MOT_DE_PASSE_ESSAI = process.argv[2] ?? "demo1234";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL manquant — c'est l'adresse que l'application elle-même emploie.");
    process.exit(1);
  }

  // **Le rôle compte plus que la requête.** Le dire à l'écran évite de refaire
  // le diagnostic sous un rôle privilégié et d'en tirer une fausse conclusion.
  const role = url.replace(/^[a-z]+:\/\//i, "").split(":")[0];
  console.log(`Rôle employé : ${role} — le même que l'application.\n`);

  const pool = new Pool({ connectionString: url });
  try {
    const { rows, rowCount } = await pool.query(
      "select email, password_hash from users order by email"
    );
    console.log(`Comptes visibles par l'application : ${rowCount}`);
    if (rowCount === 0) {
      console.error(
        "\n❌ L'application ne voit AUCUN compte, alors que la base en contient peut-être.\n" +
          "   C'est une question de droits ou d'isolation, jamais de mot de passe.\n" +
          "   Comparer avec : npx tsx scripts/verifier-banc-essai.ts (qui lit en superutilisateur)."
      );
      process.exit(1);
    }

    let unAccepte = false;
    for (const u of rows) {
      if (!u.password_hash) {
        console.log(`  ${u.email} — pas de mot de passe (compte client, normal)`);
        continue;
      }
      const ok = await compare(MOT_DE_PASSE_ESSAI, u.password_hash);
      if (ok) unAccepte = true;
      console.log(`  ${u.email} — « ${MOT_DE_PASSE_ESSAI} » ${ok ? "ACCEPTÉ ✅" : "refusé"}`);
    }

    if (!unAccepte) {
      console.error(
        `\n❌ Aucun compte n'accepte « ${MOT_DE_PASSE_ESSAI} ».\n` +
          "   Le refus vient bien du mot de passe, pas de l'application.\n" +
          "   Essayer un autre : npx tsx scripts/diagnostiquer-connexion.ts <mot-de-passe>"
      );
      process.exit(1);
    }

    console.log(
      "\n✅ L'application voit le compte ET accepte ce mot de passe.\n" +
        "   Si la connexion échoue quand même à l'écran, la cause est en aval :\n" +
        "   compteur de tentatives, origine refusée (npm run verifier:connexion), ou session."
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
