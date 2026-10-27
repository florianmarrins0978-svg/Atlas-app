// La clé de son espace change, et rien de ce qu'elle chiffrait ne se perd.
//
// **Audit du 25 octobre 2026, E1.** `AUTH_SECRET` était écrit dans le dépôt
// public. Le remplacer est simple ; le remplacer SANS lui faire perdre son
// agenda ni sa double vérification ne l'est pas. Cette suite joue le
// changement contre une vraie base, avec de vrais secrets chiffrés sous
// l'ancienne clé, et regarde ce qui s'ouvre après.
//
// Ne touche ni sa base ni sa clé : tout se passe dans la base d'essai et dans
// un dossier jetable (`ATLAS_SECRETS_DIR`).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { chiffrerSous, dechiffrerSous } from "../src/lib/chiffre-au-repos";
import { assurerLeCronSecretDeLEspace, assurerLeSecretDeLEspace } from "./secret-de-l-espace";

const ANCIEN = "essai-local-non-utilise-en-production-0000";
const SUPER = (() => {
  const u = new URL(process.env.ATLAS_BASE_SUPER ?? "postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test");
  u.pathname = new URL(process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL ?? "postgresql://x@localhost/atlas_test").pathname;
  return u.toString();
})();

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== La clé de l'espace change, et ses secrets suivent ===\n");
  const base = new pg.Client({ connectionString: SUPER });
  await base.connect();

  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-secrets-"));
  process.env.ATLAS_SECRETS_DIR = dossier;
  process.env.DATABASE_SUPER_URL = SUPER;
  process.env.AUTH_SECRET = ANCIEN;
  const fichier = path.join(dossier, "auth-secret");

  const { rows: ent } = await base.query(`INSERT INTO entreprises (nom) VALUES ('Clé de l''espace') RETURNING id`);
  const { rows: usr } = await base.query(`INSERT INTO users (email, nom) VALUES ($1, 'Patron') RETURNING id`, [`cle-espace-${Date.now()}@essai.local`]);
  const { rows: ag } = await base.query(
    `INSERT INTO agendas_externes (entreprise_id, fournisseur, jeton_rafraichissement, mot_de_passe)
     VALUES ($1, 'google', $2, $3) RETURNING id`,
    [ent[0].id, chiffrerSous(ANCIEN, "jeton-google-du-patron"), "v1.illisible.deja.avant"]
  );
  await base.query(`INSERT INTO double_verification (utilisateur_id, secret_chiffre) VALUES ($1, $2)`, [
    usr[0].id,
    chiffrerSous(ANCIEN, "JBSWY3DPEHPK3PXP", "double-verification"),
  ]);
  const lireAgenda = async () =>
    (await base.query(`SELECT jeton_rafraichissement, mot_de_passe FROM agendas_externes WHERE id = $1`, [ag[0].id])).rows[0];
  const lireDouble = async () =>
    (await base.query(`SELECT secret_chiffre FROM double_verification WHERE utilisateur_id = $1`, [usr[0].id])).rows[0].secret_chiffre as string;

  try {
    await essai("base injoignable : AUCUNE clé créée, l'ancienne continue de servir", async () => {
      process.env.DATABASE_SUPER_URL = "postgresql://x:y@127.0.0.1:1/z";
      const r = await assurerLeSecretDeLEspace();
      process.env.DATABASE_SUPER_URL = SUPER;
      assert.equal(r.etat, "echec");
      assert.equal(existsSync(fichier), false, "une clé a été posée sans que ses secrets aient suivi");
      assert.equal(existsSync(`${fichier}.en-cours`), false);
    });

    await essai("la clé neuve naît, à l'abri (600), et ses secrets s'ouvrent SOUS ELLE", async () => {
      const r = await assurerLeSecretDeLEspace();
      assert.equal(r.etat, "cree", JSON.stringify(r));
      const nouveau = readFileSync(fichier, "utf8").trim();
      assert.ok(nouveau.length >= 60, "clé trop courte");
      assert.notEqual(nouveau, ANCIEN);
      assert.equal(statSync(fichier).mode & 0o777, 0o600, "le fichier de la clé est lisible par d'autres");
      const a = await lireAgenda();
      assert.equal(dechiffrerSous(nouveau, a.jeton_rafraichissement), "jeton-google-du-patron", "SON AGENDA NE S'OUVRE PLUS");
      assert.equal(dechiffrerSous(nouveau, await lireDouble(), "double-verification"), "JBSWY3DPEHPK3PXP", "SA DOUBLE VÉRIFICATION NE S'OUVRE PLUS");
    });

    await essai("et plus sous l'ANCIENNE, celle du dépôt public", async () => {
      assert.equal(dechiffrerSous(ANCIEN, (await lireAgenda()).jeton_rafraichissement), null);
      assert.equal(dechiffrerSous(ANCIEN, await lireDouble(), "double-verification"), null);
    });

    await essai("un secret déjà illisible avant n'est pas réécrit (rien d'inventé)", async () => {
      assert.equal((await lireAgenda()).mot_de_passe, "v1.illisible.deja.avant");
    });

    await essai("au passage suivant, rien ne bouge : la clé n'est créée qu'UNE fois", async () => {
      const avant = readFileSync(fichier, "utf8");
      const chiffreAvant = (await lireAgenda()).jeton_rafraichissement;
      const r = await assurerLeSecretDeLEspace();
      assert.equal(r.etat, "deja-la");
      assert.equal(readFileSync(fichier, "utf8"), avant);
      assert.equal((await lireAgenda()).jeton_rafraichissement, chiffreAvant);
    });

    await essai("une panne entre la base et le fichier : la clé en cours qui ouvre les secrets est promue", async () => {
      const valide = readFileSync(fichier, "utf8").trim();
      rmSync(fichier);
      writeFileSync(`${fichier}.en-cours`, valide, { mode: 0o600 });
      const r = await assurerLeSecretDeLEspace();
      assert.equal(r.etat, "promu");
      assert.equal(readFileSync(fichier, "utf8").trim(), valide);
    });

    await essai("une clé en cours qui n'ouvre rien est ÉCARTÉE, jamais effacée", async () => {
      // Le défaut trouvé en écrivant ce lot : une clé jetée à tort rendrait
      // illisible pour toujours ce qu'elle a chiffré. Mise de côté, elle se
      // retrouve.
      writeFileSync(`${fichier}.en-cours`, "une-cle-qui-n-ouvre-rien", { mode: 0o600 });
      const r = await assurerLeSecretDeLEspace();
      assert.equal(r.etat, "deja-la");
      const ecartees = readdirSync(dossier).filter((f) => f.startsWith("auth-secret.ecartee-"));
      assert.equal(ecartees.length, 1, "la clé en cours a disparu au lieu d'être mise de côté");
      assert.equal(readFileSync(path.join(dossier, ecartees[0]), "utf8"), "une-cle-qui-n-ouvre-rien");
    });

    await essai("la clé ne s'affiche JAMAIS, ni à l'écran ni au journal", async () => {
      const valide = readFileSync(fichier, "utf8").trim();
      const r = spawnSync(process.execPath, [path.join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs"), path.join(__dirname, "secret-de-l-espace.ts")], {
        env: process.env,
        encoding: "utf8",
      });
      assert.equal(r.status, 0, r.stderr);
      assert.ok(!r.stdout.includes(valide) && !r.stderr.includes(valide), "LA CLÉ EST SORTIE À L'ÉCRAN");
    });

    await essai("le banc lance son serveur avec la clé de l'espace, pas celle du dépôt", () => {
      const banc = readFileSync(path.join(__dirname, "banc.mjs"), "utf8");
      const iSecret = banc.indexOf("secret-de-l-espace");
      const iLancement = banc.indexOf("let serveur = ");
      assert.ok(iSecret >= 0, "banc.mjs ne demande plus la clé de l'espace");
      assert.ok(iSecret < iLancement, "banc.mjs lance le serveur AVANT d'avoir la clé de l'espace");
      assert.match(banc, /process\.env\.AUTH_SECRET\s*=/, "banc.mjs ne pose pas AUTH_SECRET pour le serveur");
    });

    // **Le jeton du planificateur, même faille, remède plus simple** (pas de
    // base à joindre : rien n'est chiffré sous lui).
    await essai("le jeton cron naît à l'abri (600), et ne bouge plus une fois créé", () => {
      const fichierCron = path.join(dossier, "cron-secret");
      const premier = assurerLeCronSecretDeLEspace();
      assert.ok(premier.length >= 40, "jeton cron trop court");
      assert.equal(statSync(fichierCron).mode & 0o777, 0o600, "le fichier du jeton cron est lisible par d'autres");
      assert.equal(assurerLeCronSecretDeLEspace(), premier, "le jeton cron change alors qu'un fichier existait déjà");
    });

    await essai("le jeton cron ne s'affiche JAMAIS, ni à l'écran ni au journal", async () => {
      const valide = readFileSync(path.join(dossier, "cron-secret"), "utf8").trim();
      const r = spawnSync(process.execPath, [path.join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs"), path.join(__dirname, "secret-de-l-espace.ts"), "--cron"], {
        env: process.env,
        encoding: "utf8",
      });
      assert.equal(r.status, 0, r.stderr);
      assert.ok(!r.stdout.includes(valide) && !r.stderr.includes(valide), "LE JETON CRON EST SORTI À L'ÉCRAN");
    });

    await essai("le banc lance son serveur avec le jeton cron de l'espace, pas celui du dépôt", () => {
      const banc = readFileSync(path.join(__dirname, "banc.mjs"), "utf8");
      const iSecretCron = banc.indexOf("secret-de-l-espace.ts\", \"--cron\"");
      const iLancement = banc.indexOf("let serveur = ");
      assert.ok(iSecretCron >= 0, "banc.mjs ne demande plus le jeton cron de l'espace");
      assert.ok(iSecretCron < iLancement, "banc.mjs lance le serveur AVANT d'avoir le jeton cron de l'espace");
      assert.match(banc, /process\.env\.CRON_SECRET\s*=/, "banc.mjs ne pose pas CRON_SECRET pour le serveur");
    });
  } finally {
    await base.query(`DELETE FROM agendas_externes WHERE id = $1`, [ag[0].id]);
    await base.query(`DELETE FROM double_verification WHERE utilisateur_id = $1`, [usr[0].id]);
    await base.query(`DELETE FROM users WHERE id = $1`, [usr[0].id]);
    await base.query(`DELETE FROM entreprises WHERE id = $1`, [ent[0].id]);
    await base.end();
    rmSync(dossier, { recursive: true, force: true });
  }

  console.log(`\nClé de l'espace — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
