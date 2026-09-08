import { Client } from "pg";
import { spawnSync } from "node:child_process";

/**
 * Monte la base de l'atelier de cette session, si elle n'existe pas encore.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette étape existe (8 septembre 2026).** Le patron : *« l'idée
 * c'est qu'après ça chaque session puisse tourner en même temps sans se
 * gêner »*. Une batterie **vide la base entre ses suites**
 * (`nettoyerBase()`, `TRUNCATE … CASCADE`) : deux batteries sur la même base
 * s'effacent mutuellement leurs données, et rendent des rouges qui n'accusent
 * personne. C'est le défaut payé le 26 août 2026 — cinq suites rouges d'un
 * coup, une demi-heure à soupçonner du code juste.
 *
 * Chaque atelier a donc SA base. Celle du rang 0 est `atlas_test`, qui existe
 * déjà : cette étape ne fait alors que vérifier qu'on l'atteint, et la batterie
 * se comporte exactement comme avant.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * **La base est créée POUR LE RÔLE PROPRIÉTAIRE, jamais pour `postgres`.**
 * Migrer sous `postgres` réussit sans se plaindre — puis, plusieurs suites plus
 * loin, rend « permission denied for table … » sur une table qu'on n'a pas
 * touchée. Cinquante suites rouges d'un coup, et l'erreur désigne la table
 * plutôt que la migration qui l'a mal créée (`CLAUDE.md` §5, payé le 13 août
 * 2026). Le propriétaire est donc lu sur l'adresse du propriétaire, et la
 * migration tourne sous elle.
 */

const SUPER = process.env.ATLAS_BASE_SUPER;
const OWNER = process.env.ATLAS_BASE_OWNER;
const APP = process.env.ATLAS_BASE_APP;

if (!SUPER || !OWNER || !APP) {
  console.error(
    "❌ ATLAS_BASE_SUPER, ATLAS_BASE_OWNER et ATLAS_BASE_APP sont attendues ici :\n" +
      "   c'est la batterie qui les pose, déjà ajustées au rang de l'atelier (scripts/_atelier.ts)."
  );
  process.exit(1);
}

/** Le nom de la base, tel qu'il est écrit dans l'adresse. */
function nomDeLaBase(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

/** La même adresse, mais vers la base d'administration `postgres`. */
function versPostgres(url: string): string {
  const u = new URL(url);
  u.pathname = "/postgres";
  return u.toString();
}

async function main() {
  const base = nomDeLaBase(SUPER!);
  const proprietaire = decodeURIComponent(new URL(OWNER!).username);

  // Déjà là ? On ne touche à rien — et surtout on ne la recrée pas : ce serait
  // effacer le travail d'une batterie voisine sur le même rang.
  const dejaLa = new Client({ connectionString: SUPER });
  let echec: unknown;
  try {
    await dejaLa.connect();
    await dejaLa.end();
    console.log(`✅ Base « ${base} » en place.`);
    return;
  } catch (e) {
    echec = e;
    await dejaLa.end().catch(() => undefined);
  }

  // **« Absente » et « injoignable » ne sont pas la même panne — 8 septembre
  // 2026.** Docker s'est arrêté au milieu d'une batterie ; cette étape a
  // annoncé « base absente : création… », puis a échoué sur un ECONNREFUSED
  // incompréhensible. Le message envoyait chercher du côté de l'atelier alors
  // que c'est le serveur qui était éteint — et « une erreur qui accuse à tort
  // coûte plus cher que pas d'erreur du tout » (`AGENTS.md`).
  //
  // Une base absente rend `3D000` ; tout le reste est un problème de serveur.
  const code = (echec as { code?: string } | undefined)?.code;
  if (code !== "3D000") {
    // **`AggregateError` n'a PAS de texte**, et c'est précisément celle que
    // rend un serveur éteint : afficher `.message` donnait une ligne vide, donc
    // un refus sans raison — l'exact défaut qu'on répare ici. On descend donc
    // chercher la première cause qui parle.
    const parle = (e: unknown): string => {
      const err = e as { message?: string; code?: string; errors?: unknown[] };
      if (err?.message) return err.message;
      if (Array.isArray(err?.errors) && err.errors.length > 0) return parle(err.errors[0]);
      return err?.code ?? String(e);
    };
    console.error(
      `❌ La base d'essai est INJOIGNABLE — ce n'est pas l'atelier, c'est le serveur.\n` +
        `   ${parle(echec)}\n\n` +
        "   Sur son poste, c'est presque toujours Docker qui s'est arrêté :\n" +
        "     docker start atlas-postgres atlas-redis"
    );
    process.exit(1);
  }

  console.log(`Base « ${base} » absente : création pour le rôle « ${proprietaire} »…`);
  const admin = new Client({ connectionString: versPostgres(SUPER!) });
  await admin.connect();
  try {
    // Le nom vient de notre propre dérivation, jamais d'une saisie — mais un
    // identifiant ne se paramètre pas en SQL, alors on le cite proprement.
    const cite = (nom: string) => `"${nom.replace(/"/g, '""')}"`;
    await admin.query(`CREATE DATABASE ${cite(base)} OWNER ${cite(proprietaire)}`);
  } finally {
    await admin.end().catch(() => undefined);
  }

  // **Les droits, AVANT les migrations — et ils ne viennent pas des migrations.**
  //
  // Payé à la première batterie d'atelier, le 8 septembre 2026 :
  // `test-toute-table-est-cloisonnee` a rougi sur « les privilèges par défaut
  // donnent bien l'écriture à atlas_app ». La base d'essai habituelle les tient
  // de son amorçage (`docker/init/01-bootstrap-atlas.sql`,
  // `scripts/bootstrap-postgres-ci.sql`) — une base créée à la volée, elle, n'a
  // rien. Sans eux, chaque table créée plus tard appartient au propriétaire et
  // reste hors de portée du rôle applicatif : les suites d'isolation
  // rendraient « permission denied » sur du code juste.
  //
  // On rejoue donc ici, sur la base neuve, exactement ce que l'amorçage pose.
  const appli = decodeURIComponent(new URL(APP!).username);
  const neuve = new Client({ connectionString: SUPER });
  await neuve.connect();
  try {
    const cite = (nom: string) => `"${nom.replace(/"/g, '""')}"`;
    await neuve.query(`GRANT CONNECT ON DATABASE ${cite(base)} TO ${cite(proprietaire)}`);
    await neuve.query(`GRANT CONNECT ON DATABASE ${cite(base)} TO ${cite(appli)}`);
    await neuve.query(`GRANT USAGE ON SCHEMA public TO ${cite(proprietaire)}`);
    await neuve.query(`GRANT USAGE ON SCHEMA public TO ${cite(appli)}`);
    await neuve.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${cite(proprietaire)} IN SCHEMA public ` +
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${cite(appli)}`
    );
    await neuve.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${cite(proprietaire)} IN SCHEMA public ` +
        `GRANT USAGE, SELECT ON SEQUENCES TO ${cite(appli)}`
    );
  } finally {
    await neuve.end().catch(() => undefined);
  }

  console.log("Migrations…");
  const r = spawnSync("npm", ["run", "db:migrate"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: OWNER },
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(
      `❌ Les migrations ont échoué sur « ${base} » (code ${r.status}).\n` +
        "   La base est créée mais vide : la batterie mesurerait dans le vide."
    );
    process.exit(1);
  }
  console.log(`✅ Base « ${base} » prête.`);
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
