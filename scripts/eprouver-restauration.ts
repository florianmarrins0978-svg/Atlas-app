// UNE SAUVEGARDE NON RESTAURÉE N'EST PAS UNE SAUVEGARDE.
//
// ═════════════════════════════════════════════════════════════════════════════
// **CE QUE FAIT CE SCRIPT.**
//
// Il prend un fichier de sauvegarde, le restaure dans une base **neuve et
// isolée**, et vérifie qu'ATLAS y fonctionnerait encore. Pas seulement que les
// lignes sont revenues : que ses **protections** sont revenues avec elles.
//
//     npx tsx scripts/eprouver-restauration.ts sauvegarde-atlas-2026….sql
//
// ═════════════════════════════════════════════════════════════════════════════
// **POURQUOI CE N'EST PAS SCALEWAY QUI PEUT LE FAIRE.**
//
// Scaleway sait restaurer une sauvegarde vers une nouvelle base — c'est même sa
// procédure documentée. Ce qu'il ne peut pas savoir, c'est si **Atlas** tient
// encore dessus. Or Atlas repose sur des choses qui ne survivent pas
// automatiquement à une restauration :
//
// | Ce qui peut disparaître | Ce que ça coûterait |
// |---|---|
// | les rôles `atlas_app` / `atlas_owner` | les `GRANT` échouent, l'application ne se connecte plus |
// | `FORCE ROW LEVEL SECURITY` | **un artisan verrait les clients d'un autre** |
// | les fonctions `SECURITY DEFINER` de M9 | le condensat du mot de passe redevient lisible par l'application |
// | le même `AUTH_SECRET` | les mots de passe iCloud des artisans deviennent illisibles, **en silence** |
//
// Une restauration bâclée n'a pas l'air ratée : elle a l'air réussie. C'est
// exactement pour ça qu'elle se contrôle.
//
// ═════════════════════════════════════════════════════════════════════════════
// **CE QU'IL NE FERA JAMAIS.**
//
// Il refuse de travailler sur une base dont le nom ne dit pas qu'elle est un
// essai. La production ne se restaure pas « par-dessus », même en urgence,
// même quand ça paraît plus rapide : une restauration ratée par-dessus la
// production détruit la seule chose qui restait.
//
// **Et il ne conclut jamais sur zéro.** Une base restaurée vide, ce n'est pas
// « aucune anomalie » : c'est une restauration ratée qui se tait.

import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
// **Import DYNAMIQUE, et ce n'est pas une coquetterie.** `secret-au-repos`
// passe par `getEnv()`, qui exige `DATABASE_URL`. Importé en tête, il fait
// tomber le script AVANT qu'il ait pu dire ce qui manque — et le message
// « Variable d'environnement obligatoire manquante » accuserait la sauvegarde
// alors que c'est l'outil qui n'est pas prêt.
type ModuleSecret = typeof import("../src/server/agenda/secret-au-repos");

const FICHIER = process.argv.find((a) => a.endsWith(".sql") || a.endsWith(".dump"));
const SUFFIXE_ESSAI = "_restauration_essai";

let echecs = 0;
async function controle(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message.split("\n").slice(0, 4).join("\n    ")}`);
  }
}

function psql(url: string, sql: string): { ok: boolean; sortie: string } {
  const r = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { encoding: "utf8" });
  return { ok: r.status === 0, sortie: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

async function main() {
  console.log("=== Restauration d'essai, dans une base isolée ===\n");

  // ─── 1. De quoi part-on ? ──────────────────────────────────────────────────
  if (!FICHIER || !existsSync(FICHIER)) {
    console.error(
      "❌ Aucun fichier de sauvegarde donné.\n\n" +
        "   npx tsx scripts/eprouver-restauration.ts <fichier.sql>\n\n" +
        "   Le fichier se produit avec `bash scripts/sauvegarder-banc.sh`."
    );
    process.exit(2);
  }
  const taille = statSync(FICHIER).size;
  console.log(`  Sauvegarde : ${FICHIER} (${(taille / 1024).toFixed(0)} Ko)\n`);

  const source =
    process.env.DATABASE_SUPER_URL ?? process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!source) {
    console.error("❌ Aucune adresse de base : impossible de créer la base d'essai.");
    process.exit(2);
  }

  // ─── 2. La base d'essai, et le refus de toucher la production ──────────────
  //
  // Le nom est FABRIQUÉ ici, jamais reçu. Il porte un suffixe qui dit ce qu'il
  // est. Une base d'essai qu'on pourrait nommer librement finirait un jour par
  // s'appeler comme la production.
  const base = new URL(source);
  const nomSource = base.pathname.replace(/^\//, "");
  const nomEssai = `${nomSource}${SUFFIXE_ESSAI}`;
  if (nomSource.endsWith(SUFFIXE_ESSAI)) {
    console.error(
      "❌ La base source EST déjà une base d'essai. On ne restaure pas un essai\n" +
        "   dans lui-même : il n'y aurait plus rien à comparer."
    );
    process.exit(2);
  }
  const urlEssai = new URL(source);
  urlEssai.pathname = `/${nomEssai}`;
  const urlAdmin = new URL(source);
  urlAdmin.pathname = "/postgres";

  console.log(`  Base d'essai : ${nomEssai}`);
  console.log(`  (la production, si elle existait, ne serait pas touchée)\n`);

  // ─── 3. On refait la base à neuf ───────────────────────────────────────────
  const drop = psql(urlAdmin.toString(), `DROP DATABASE IF EXISTS "${nomEssai}" WITH (FORCE)`);
  if (!drop.ok) {
    console.error(`❌ Impossible de retirer la base d'essai précédente :\n   ${drop.sortie}`);
    process.exit(2);
  }
  const create = psql(urlAdmin.toString(), `CREATE DATABASE "${nomEssai}"`);
  if (!create.ok) {
    console.error(`❌ Impossible de créer la base d'essai :\n   ${create.sortie}`);
    process.exit(2);
  }

  // ─── 4. La restauration proprement dite ────────────────────────────────────
  //
  // **On regarde le CODE DE SORTIE, et c'est tout le sujet.** Un `psql` qui
  // rencontre une erreur continue par défaut : il rendrait 0 en ayant sauté la
  // moitié des ordres. `ON_ERROR_STOP=1` le fait s'arrêter, et l'échec se voit.
  console.log("  → restauration en cours…");
  const restauration = spawnSync("psql", [urlEssai.toString(), "-v", "ON_ERROR_STOP=1", "-q", "-f", FICHIER], {
    encoding: "utf8",
  });
  const journal = `${restauration.stdout ?? ""}${restauration.stderr ?? ""}`;
  if (restauration.status !== 0) {
    console.error("❌ LA RESTAURATION A ÉCHOUÉ. Les dernières lignes de PostgreSQL :\n");
    console.error(
      journal
        .split("\n")
        .filter((l) => l.trim())
        .slice(-8)
        .map((l) => `   ${l}`)
        .join("\n")
    );
    console.error(
      "\n   Cause la plus fréquente : les rôles `atlas_app` et `atlas_owner`\n" +
        "   n'existent pas sur ce serveur. Une sauvegarde de base NE CONTIENT PAS\n" +
        "   les rôles — ils vivent au niveau du serveur. Il faut les créer AVANT."
    );
    process.exit(1);
  }
  console.log("  → restaurée.\n");

  const essai = new Pool({ connectionString: urlEssai.toString() });
  const prod = new Pool({ connectionString: source });

  // `getEnv()` la réclame, et on l'a : c'est celle qu'on vient d'employer.
  process.env.DATABASE_URL ??= source;
  let secret: ModuleSecret | null = null;
  try {
    secret = await import("../src/server/agenda/secret-au-repos");
  } catch (e) {
    console.log(`  ⚠ chiffrement des secrets illisible : ${(e as Error).message.split("\n")[0]}`);
  }

  // ═════ LES CONTRÔLES ═════════════════════════════════════════════════════

  // ─── A. Y a-t-il quelque chose ? ───────────────────────────────────────────
  let lignesRestaurees = 0;
  await controle("LA BASE RESTAURÉE N'EST PAS VIDE — refus de conclure sur zéro", async () => {
    const { rows } = await essai.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema='public'"
    );
    assert.ok(Number(rows[0].n) > 30, `seulement ${rows[0].n} table(s) : la restauration n'a pas abouti`);

    const { rows: c } = await essai.query<{ n: string }>("SELECT count(*)::text AS n FROM entreprises");
    lignesRestaurees = Number(c[0].n);
    assert.ok(
      lignesRestaurees > 0,
      "AUCUNE entreprise dans la base restaurée. Une sauvegarde qui ne rend " +
        "aucune donnée n'est pas une sauvegarde — et un contrôle qui appellerait " +
        "ça 'aucune anomalie' serait pire que pas de contrôle."
    );
  });

  // ─── B. Les volumes correspondent-ils ? ────────────────────────────────────
  await controle("LES VOLUMES CORRESPONDENT à la base d'origine, table par table", async () => {
    const tables = ["entreprises", "users", "clients", "chantiers", "devis", "factures", "photos"];
    const ecarts: string[] = [];
    for (const t of tables) {
      const [a, b] = await Promise.all([
        prod.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${t}`),
        essai.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${t}`),
      ]);
      if (a.rows[0].n !== b.rows[0].n) ecarts.push(`${t} : origine ${a.rows[0].n}, restaurée ${b.rows[0].n}`);
    }
    assert.deepEqual(ecarts, [], "des tables n'ont pas le même nombre de lignes qu'à l'origine");
  });

  // ─── C. Les migrations ─────────────────────────────────────────────────────
  await controle("LES MIGRATIONS SONT TOUTES LÀ — sinon le code parlerait à un schéma d'hier", async () => {
    const [a, b] = await Promise.all([
      prod.query<{ nom: string }>("SELECT nom FROM _migrations ORDER BY nom"),
      essai.query<{ nom: string }>("SELECT nom FROM _migrations ORDER BY nom"),
    ]);
    assert.ok(b.rows.length > 0, "la table des migrations est vide dans la base restaurée");
    const manquantes = a.rows.map((r) => r.nom).filter((n) => !b.rows.some((x) => x.nom === n));
    assert.deepEqual(manquantes, [], "des migrations manquent dans la base restaurée");
  });

  // ─── D. La RLS, et surtout FORCE ───────────────────────────────────────────
  await controle("LA RLS EST ACTIVE, ET FORCÉE — c'est ce qui sépare deux artisans", async () => {
    const { rows } = await essai.query<{ n: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname AS n, relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`
    );
    const forcees = rows.filter((r) => r.relforcerowsecurity);
    assert.ok(
      forcees.length >= 30,
      `seulement ${forcees.length} table(s) en FORCE ROW LEVEL SECURITY (attendu : au moins 30). ` +
        "Sans elle, le propriétaire des tables voit TOUT, et une restauration " +
        "aurait discrètement ouvert les données de chaque entreprise."
    );
    const activeesSansForce = rows.filter((r) => r.relrowsecurity && !r.relforcerowsecurity).map((r) => r.n);
    assert.ok(
      activeesSansForce.length === 0,
      `des tables ont la RLS sans FORCE : ${activeesSansForce.slice(0, 5).join(", ")}`
    );
  });

  // ─── E. L'isolation, pour de vrai ──────────────────────────────────────────
  await controle("DEUX ENTREPRISES NE SE VOIENT PAS — éprouvé sur la base restaurée", async () => {
    const { rows: ents } = await essai.query<{ id: string }>("SELECT id FROM entreprises LIMIT 1");
    assert.ok(ents.length >= 1, "aucune entreprise : rien à isoler");

    /**
     * **On FABRIQUE la voisine, au lieu de renoncer.**
     *
     * La première version exigeait deux entreprises dans la sauvegarde et
     * refusait de conclure sinon. Elle avait raison de refuser — mais elle
     * rendait le contrôle inutilisable sur une sauvegarde ordinaire, où il n'y
     * a souvent qu'une entreprise. Un contrôle qu'on ne peut jamais jouer ne
     * protège de rien.
     *
     * La base d'essai est JETABLE : c'est exactement ce qui autorise à y écrire.
     * On y pose une entreprise témoin et un client à elle, puis on regarde si
     * l'entreprise d'origine les voit. Si oui, l'isolation est morte.
     */
    const { rows: voisine } = await essai.query<{ id: string }>(
      `INSERT INTO entreprises (nom) VALUES ('Témoin de restauration') RETURNING id`
    );
    const idVoisine = voisine[0].id;
    await essai.query(
      `INSERT INTO clients (entreprise_id, nom) VALUES ($1, 'Client de la voisine')`,
      [idVoisine]
    );

    const p = new Pool({
      connectionString: urlEssai.toString().replace(/\/\/[^@]+@/, "//atlas_app:atlas_app_ci_pw@"),
    });
    try {
      const c = await p.connect();
      try {
        await c.query("SELECT set_config('app.entreprise_id', $1, false)", [ents[0].id]);
        const { rows: vus } = await c.query<{ entreprise_id: string }>(
          "SELECT DISTINCT entreprise_id FROM clients"
        );
        const etrangers = vus.map((v) => v.entreprise_id).filter((id) => id !== ents[0].id);
        assert.deepEqual(
          etrangers,
          [],
          "SOUS LE CONTEXTE D'UNE ENTREPRISE, DES CLIENTS D'UNE AUTRE SONT VISIBLES. " +
            "La restauration a perdu l'isolation : Atlas servirait les données " +
            "d'un artisan à un autre."
        );
        // Et le contrôle doit avoir eu QUELQUE CHOSE à ne pas voir, sinon il ne
        // prouve rien — c'est le piège du contrôle qui mesure zéro.
        const { rows: total } = await essai.query<{ n: string }>(
          "SELECT count(*)::text AS n FROM clients WHERE entreprise_id = $1",
          [idVoisine]
        );
        assert.equal(total[0].n, "1", "le client témoin n'a pas été créé : rien n'a été éprouvé");
      } finally {
        c.release();
      }
    } finally {
      await p.end();
    }
  });

  // ─── F. Les droits d'atlas_app ─────────────────────────────────────────────
  await controle("atlas_app EXISTE et ne traverse pas la RLS", async () => {
    const { rows } = await essai.query<{ rolbypassrls: boolean; rolsuper: boolean }>(
      "SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'atlas_app'"
    );
    assert.equal(rows.length, 1, "le rôle atlas_app n'existe pas sur ce serveur");
    assert.equal(rows[0].rolbypassrls, false, "atlas_app traverse la RLS : l'isolation ne vaut plus rien");
    assert.equal(rows[0].rolsuper, false, "atlas_app est superutilisateur : tout est ouvert");
  });

  // ─── G. M9 : le condensat du mot de passe ──────────────────────────────────
  await controle("M9 TIENT — atlas_app ne peut PAS lire le condensat du mot de passe", async () => {
    const p = new Pool({
      connectionString: urlEssai.toString().replace(/\/\/[^@]+@/, "//atlas_app:atlas_app_ci_pw@"),
    });
    try {
      let refuse = false;
      try {
        await p.query("SELECT password_hash FROM users LIMIT 1");
      } catch {
        refuse = true;
      }
      assert.ok(
        refuse,
        "LE CONDENSAT DU MOT DE PASSE EST LISIBLE PAR L'APPLICATION. La " +
          "restauration a perdu les REVOKE de M9 : une faille de lecture " +
          "quelconque rendrait désormais les mots de passe de tous les artisans."
      );
    } finally {
      await p.end();
    }
  });

  // ─── H. Les fonctions SECURITY DEFINER ─────────────────────────────────────
  await controle("LES FONCTIONS SECURITY DEFINER SONT LÀ, et appartiennent au bon rôle", async () => {
    const { rows } = await essai.query<{ nom: string; proprietaire: string; secdef: boolean }>(
      `SELECT p.proname AS nom, pg_get_userbyid(p.proowner) AS proprietaire, p.prosecdef AS secdef
         FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef`
    );
    assert.ok(
      rows.length > 0,
      "AUCUNE fonction SECURITY DEFINER dans la base restaurée. C'est par elles " +
        "que passe la connexion depuis M9 : sans elles, personne ne peut se connecter."
    );
    const malPossedees = rows.filter((r) => r.proprietaire === "atlas_app");
    assert.deepEqual(
      malPossedees.map((r) => r.nom),
      [],
      "des fonctions SECURITY DEFINER appartiennent à atlas_app : elles " +
        "s'exécuteraient avec les droits de l'application, ce qui annule leur raison d'être"
    );
  });

  // ─── I. Les secrets qui dépendent d'AUTH_SECRET ────────────────────────────
  await controle("LES SECRETS CHIFFRÉS SE DÉCHIFFRENT ENCORE — AUTH_SECRET est le bon", async () => {
    const { rows } = await essai.query<{ mot_de_passe: string | null; client_secret: string | null }>(
      "SELECT mot_de_passe, client_secret FROM agendas_externes WHERE mot_de_passe IS NOT NULL OR client_secret IS NOT NULL LIMIT 5"
    );
    if (rows.length === 0) {
      // Aucun agenda raccordé : il n'y a rien à déchiffrer. **On ne rend pas un
      // vert pour autant** — on éprouve la clé sur un témoin fabriqué, sinon ce
      // contrôle serait muet exactement le jour où la clé aurait changé.
      assert.ok(secret, "le module de chiffrement n'a pas pu être chargé : rien n'est éprouvé");
      const temoin = secret.chiffrer("temoin-de-restauration");
      const relu = secret.dechiffrer(temoin);
      assert.equal(
        relu,
        "temoin-de-restauration",
        "AUTH_SECRET ne permet pas de chiffrer puis relire : la clé de " +
          "restauration est absente ou différente."
      );
      return;
    }
    for (const r of rows) {
      for (const champ of [r.mot_de_passe, r.client_secret]) {
        if (!champ) continue;
        assert.ok(secret, "le module de chiffrement n'a pas pu être chargé : rien n'est éprouvé");
        const clair = secret.dechiffrer(champ);
        assert.ok(
          clair !== null,
          "UN SECRET D'ARTISAN NE SE DÉCHIFFRE PLUS. La base est là, la donnée " +
            "est là, et elle est devenue illisible : AUTH_SECRET n'est pas celui " +
            "qui a servi à l'écrire. Les raccordements d'agenda sont morts, et " +
            "AUCUNE erreur ne l'aurait dit à l'usage."
        );
      }
    }
  });

  await essai.end();
  await prod.end();

  console.log("");
  console.log(`  ${lignesRestaurees} entreprise(s) dans la base restaurée.`);
  console.log(`  Base d'essai conservée : ${nomEssai} — à retirer quand vous voulez.`);
  console.log("");
  if (echecs > 0) {
    console.error(`❌ ${echecs} contrôle(s) en échec. CETTE SAUVEGARDE NE VAUT PAS CE QU'ELLE PROMET.`);
    process.exit(1);
  }
  console.log("✅ Restauration éprouvée : les données ET les protections sont revenues.");
}

main().catch((e) => {
  console.error("❌ Essai interrompu :", e instanceof Error ? e.message : e);
  process.exit(2);
});
