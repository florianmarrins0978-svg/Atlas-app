// La clé de session PROPRE À SON ESPACE, créée une fois, et ses secrets
// re-chiffrés sous elle avant qu'elle serve (audit du 25 octobre 2026, E1).
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CE SCRIPT RÉPARE.** Son espace servait l'application sur un port
// public avec un `AUTH_SECRET` écrit en clair dans le dépôt public
// (`.devcontainer/docker-compose.yml`). Cette clé signe les cookies de session :
// la connaître, c'est pouvoir en fabriquer un. Elle dérive aussi la clé qui
// chiffre ses jetons Google, son mot de passe d'agenda Apple et le secret de sa
// double vérification (`src/lib/chiffre-au-repos.ts`).
//
// **L'ORDRE EST LA SÉCURITÉ DE SES DONNÉES.** Changer la clé sans re-chiffrer
// rendrait ses secrets illisibles : agenda débranché, et surtout double
// vérification qui ne reconnaît plus ses codes. Donc :
//
//   1. la clé neuve est écrite À CÔTÉ (`.en-cours`), avant toute écriture en base ;
//   2. tout est re-chiffré dans UNE transaction, sous la clé d'avant et la neuve ;
//   3. la transaction validée, le fichier est mis à sa place.
//
// Une panne entre 2 et 3 laisse un `.en-cours` : au passage suivant, il est
// promu s'il ouvre les secrets en base, effacé sinon. Une panne avant la
// transaction ne change rien : l'ancienne clé continue de servir, et l'on
// retente à l'allumage suivant. **Jamais un état où rien ne s'ouvre.**
//
// Ne sort JAMAIS la clé : ni à l'écran, ni dans un journal. Rend 0 quand une
// clé propre à l'espace existe (créée ou déjà là), 1 sinon.
//
//   npx tsx scripts/secret-de-l-espace.ts
//
// Appelé par `scripts/banc.mjs` avant de lancer le serveur.

import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { chiffrerSous, dechiffrerSous, type DomaineSecret } from "../src/lib/chiffre-au-repos";

/**
 * **Hors du dépôt, et commun à tous ses dossiers de session** : le dossier
 * parent du dépôt principal (`/workspaces` dans son espace), qui survit au
 * redémarrage. Un fichier dans le dépôt suivrait chaque `git worktree` et se
 * multiplierait en autant de clés.
 */
export function dossierDesSecrets(): string {
  if (process.env.ATLAS_SECRETS_DIR) return process.env.ATLAS_SECRETS_DIR;
  const commun = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
  return path.join(path.dirname(path.dirname(commun)), ".atlas-secrets");
}

/** Les colonnes chiffrées au repos, et sous quelle clé d'usage chacune. */
const COLONNES: Array<{ table: string; cle: string; colonnes: string[]; domaine: DomaineSecret }> = [
  { table: "agendas_externes", cle: "id", colonnes: ["client_secret", "jeton_acces", "jeton_rafraichissement", "mot_de_passe"], domaine: "agenda" },
  { table: "double_verification", cle: "utilisateur_id", colonnes: ["secret_chiffre"], domaine: "double-verification" },
];

type Bilan = { rechiffres: number; illisibles: number };

/**
 * Cette clé ouvre-t-elle des secrets en base ? Sert à trancher un `.en-cours`.
 *
 * **TOUS les secrets sont essayés, pas le premier venu** : un secret déjà
 * illisible avant (laissé tel quel par `rechiffrer`) ferait conclure « cette
 * clé n'ouvre rien » sur la bonne clé, et la jeter rendrait tous les autres
 * illisibles pour toujours. Il suffit qu'UN secret s'ouvre. `null` : rien de
 * chiffré en base, on ne peut pas trancher.
 */
async function ouvreLesSecrets(client: pg.Client, secret: string): Promise<boolean | null> {
  let unSecretAuMoins = false;
  for (const { table, colonnes, domaine } of COLONNES) {
    for (const col of colonnes) {
      const { rows } = await client.query(`SELECT ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL`);
      for (const { v } of rows) {
        unSecretAuMoins = true;
        if (dechiffrerSous(secret, v, domaine) !== null) return true;
      }
    }
  }
  return unSecretAuMoins ? false : null;
}

async function rechiffrer(client: pg.Client, ancien: string, nouveau: string): Promise<Bilan> {
  const bilan: Bilan = { rechiffres: 0, illisibles: 0 };
  for (const { table, cle, colonnes, domaine } of COLONNES) {
    const { rows } = await client.query(`SELECT ${cle} AS id, ${colonnes.join(", ")} FROM ${table} FOR UPDATE`);
    for (const ligne of rows) {
      for (const col of colonnes) {
        const valeur = ligne[col] as string | null;
        if (valeur == null) continue;
        const clair = dechiffrerSous(ancien, valeur, domaine);
        // **Illisible sous l'ancienne clé : on n'y touche pas.** Il l'était déjà
        // avant ce geste ; le réécrire inventerait un secret.
        if (clair === null) {
          bilan.illisibles++;
          continue;
        }
        await client.query(`UPDATE ${table} SET ${col} = $1 WHERE ${cle} = $2`, [chiffrerSous(nouveau, clair, domaine), ligne.id]);
        bilan.rechiffres++;
      }
    }
  }
  return bilan;
}

export async function assurerLeSecretDeLEspace(): Promise<{ etat: "deja-la" | "cree" | "promu" | "echec"; bilan?: Bilan; raison?: string }> {
  const dossier = dossierDesSecrets();
  const fichier = path.join(dossier, "auth-secret");
  const enCours = `${fichier}.en-cours`;
  if (existsSync(fichier) && !existsSync(enCours)) return { etat: "deja-la" };

  const adresse = process.env.DATABASE_SUPER_URL;
  if (!adresse) return { etat: "echec", raison: "DATABASE_SUPER_URL absent : impossible de re-chiffrer, l'ancienne clé reste" };
  const client = new pg.Client({ connectionString: adresse, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();

    if (existsSync(enCours)) {
      const candidat = readFileSync(enCours, "utf8").trim();
      const ouvre = await ouvreLesSecrets(client, candidat);
      if (ouvre === true || (ouvre === null && !existsSync(fichier))) {
        renameSync(enCours, fichier);
        return { etat: "promu" };
      }
      // **Écartée, jamais effacée** : une clé détruite par erreur rendrait
      // illisible pour toujours ce qu'elle a chiffré. Mise de côté, elle se
      // retrouve.
      renameSync(enCours, `${fichier}.ecartee-${Date.now()}`);
      if (existsSync(fichier)) return { etat: "deja-la" };
    }

    // La clé que le serveur employait jusqu'ici : c'est sous elle que tout est chiffré.
    const ancien = process.env.AUTH_SECRET ?? "dev-secret-non-utilise-en-production";
    const nouveau = randomBytes(48).toString("base64url");
    mkdirSync(dossier, { recursive: true, mode: 0o700 });
    writeFileSync(enCours, nouveau, { mode: 0o600 });

    await client.query("BEGIN");
    let bilan: Bilan;
    try {
      bilan = await rechiffrer(client, ancien, nouveau);
      await client.query("COMMIT");
    } catch (erreur) {
      await client.query("ROLLBACK");
      rmSync(enCours, { force: true });
      throw erreur;
    }
    renameSync(enCours, fichier);
    return { etat: "cree", bilan };
  } catch (erreur) {
    return { etat: "echec", raison: erreur instanceof Error ? erreur.message : String(erreur) };
  } finally {
    await client.end().catch((fin: unknown) => {
      console.warn(`Fermeture de la connexion impossible : ${fin instanceof Error ? fin.message : fin}`);
    });
  }
}

/** La clé propre à l'espace, si elle existe. Lue par `banc.mjs` pour lancer le serveur. */
export function lireLeSecretDeLEspace(): string | null {
  const fichier = path.join(dossierDesSecrets(), "auth-secret");
  return existsSync(fichier) ? readFileSync(fichier, "utf8").trim() || null : null;
}

/**
 * Le jeton du planificateur externe (`CRON_SECRET`), lui aussi écrit en clair
 * dans `.devcontainer/docker-compose.yml` — audit du 25 octobre 2026, même
 * faille que l'`AUTH_SECRET` ci-dessus (E1) : public dans un dépôt public, sur
 * un port public, il ouvre la purge planifiée
 * (`src/app/api/cron/purge-fichiers/route.ts`) à qui lit GitHub.
 *
 * **Le remède est plus simple, et c'est délibéré.** Rien n'est chiffré SOUS ce
 * jeton — la route le compare seulement en temps constant — donc aucune
 * rotation à orchestrer et aucune base à joindre : un fichier absent se crée,
 * un fichier présent ne se touche pas. La re-création de `AUTH_SECRET`
 * ci-dessus a besoin de la base pour re-chiffrer ; celle-ci n'en a jamais
 * besoin, et ne doit donc jamais attendre qu'elle soit debout.
 */
export function assurerLeCronSecretDeLEspace(): string {
  const fichier = path.join(dossierDesSecrets(), "cron-secret");
  const existant = existsSync(fichier) ? readFileSync(fichier, "utf8").trim() : "";
  if (existant) return existant;
  const valeur = randomBytes(32).toString("base64url");
  mkdirSync(dossierDesSecrets(), { recursive: true, mode: 0o700 });
  writeFileSync(fichier, valeur, { mode: 0o600 });
  return valeur;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  if (process.argv.includes("--cron")) {
    // Ni base ni rotation : rien ne peut échouer ici que l'écriture du
    // fichier lui-même, et une panne de disque arrête `banc.mjs` de toute
    // façon. Seul le CHEMIN sort en sortie standard, jamais le jeton.
    assurerLeCronSecretDeLEspace();
    console.log(path.join(dossierDesSecrets(), "cron-secret"));
    process.exit(0);
  } else {
    assurerLeSecretDeLEspace().then((r) => {
      // `--chemin` : `banc.mjs` lit la sortie standard, qui ne porte alors QUE le
      // chemin du fichier (jamais la clé) ; les phrases vont sur la sortie d'erreur.
      const dire = process.argv.includes("--chemin") ? console.error : console.log;
      if (process.argv.includes("--chemin") && r.etat !== "echec") console.log(path.join(dossierDesSecrets(), "auth-secret"));
      if (r.etat === "cree") {
        dire(`Clé de l'espace créée ; ${r.bilan?.rechiffres ?? 0} secret(s) re-chiffré(s), ${r.bilan?.illisibles ?? 0} illisible(s) laissé(s) tel(s) quel(s).`);
      } else if (r.etat === "echec") {
        console.error(`Clé de l'espace NON créée : ${r.raison}. L'ancienne clé continue de servir ; nouvel essai au prochain allumage.`);
      }
      process.exit(r.etat === "echec" ? 1 : 0);
    });
  }
}
