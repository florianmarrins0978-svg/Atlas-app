import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

// **« Ça va pas supprimer toutes mes données ? » — sa question du 13 septembre
// 2026**, devant le « Rebuild Container » que je venais de lui conseiller pour
// réparer son port. La réponse était OUI, et c'est lui qui l'a vue.
//
// `preparer.sh` est le `postCreateCommand` : il tourne à chaque CRÉATION de
// conteneur, donc à chaque reconstruction. Il appelait le seed sans rien
// demander, et le seed vide la base — qui, elle, survit sur le volume nommé
// `atlas-pgdata`.
//
// **C'était la deuxième fois qu'il devait me le dire** : le 10 août, devant
// « supprime ton espace », il répondait déjà « ça va effacer tout ce qu'il y a
// en mémoire ».
//
// Cette suite joue la sonde POUR DE BON, contre une vraie base, dans les trois
// états — un contrôle qui n'a jamais vu l'état qu'il prétend détecter ne prouve
// rien (`AGENTS.md`).

const SONDE = path.join(__dirname, "base-habitee.mjs");
const URL = process.env.DATABASE_SUPER_URL ?? process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;

let echecs = 0;
const epreuves: [string, () => void | Promise<void>][] = [];
const cas = (nom: string, fn: () => void | Promise<void>) => epreuves.push([nom, fn]);

const interroger = (env: NodeJS.ProcessEnv) =>
  spawnSync(process.execPath, [SONDE], { env, encoding: "utf8" }).status;

cas("sans adresse de base, la sonde s'ABSTIENT (2) au lieu d'inventer", () => {
  const sans = { ...process.env };
  delete sans.DATABASE_URL;
  delete sans.DATABASE_ADMIN_URL;
  delete sans.DATABASE_SUPER_URL;
  assert.equal(interroger(sans), 2, "elle conclut là où elle n'a rien pu demander");
});

cas("une base INJOIGNABLE s'abstient aussi — elle n'est pas déclarée vierge", () => {
  // **Le cas qui coûterait ses données.** Une base momentanément absente prise
  // pour une base neuve ferait vider la vraie dès qu'elle revient.
  const faux = { ...process.env, DATABASE_SUPER_URL: "postgresql://x:y@127.0.0.1:1/z", DATABASE_ADMIN_URL: "", DATABASE_URL: "" };
  assert.equal(interroger(faux), 2, "une base injoignable passe pour vierge : le seed la viderait");
});

// **LE ZÉRO QUI COÛTERAIT SES CHANTIERS.** `atlas_app` ne traverse pas la RLS :
// sur une base pleine, il compte ZÉRO. Une sonde qui conclurait « vierge » de ce
// zéro-là ferait vider la base au prochain rebuild. C'est la leçon de
// `sauvegarder-banc.mjs`, mais le prix n'est plus une copie ratée : c'est
// l'original.
cas("sous un rôle qui ne traverse PAS la RLS, la sonde s'abstient", () => {
  const applicatif = process.env.ATLAS_URL_APPLICATIVE;
  if (!applicatif) {
    console.log("  ⏭ pas de rôle applicatif fourni (ATLAS_URL_APPLICATIVE)");
    return;
  }
  assert.equal(
    interroger({ ...process.env, DATABASE_SUPER_URL: applicatif, DATABASE_ADMIN_URL: "", DATABASE_URL: "" }),
    2,
    "un rôle aveuglé par la RLS compte zéro et fait passer une base pleine pour vierge"
  );
});

cas("SA BASE, telle qu'elle est : habitée se dit habitée", async () => {
  if (!URL) {
    console.log("  ⏭ pas de base ici — ce cas exige une vraie base");
    return;
  }
  const client = new pg.Client({ connectionString: URL });
  await client.connect();
  // **On demande d'ABORD ce que ce rôle a le droit de voir — 13 septembre 2026.**
  //
  // Ce cas comptait les entreprises et exigeait un verdict. Sous un rôle qui ne
  // traverse pas la RLS — `atlas_owner`, celui de la CI et des ateliers —, la
  // sonde s'ABSTIENT, et elle a raison : c'est sa garantie principale, celle du
  // cas juste au-dessus. Le contrôle réclamait donc à la sonde le contraire de
  // ce qu'on lui demande, et rougissait sur du code juste.
  const { rows: qui } = await client.query(
    "SELECT current_setting('is_superuser') = 'on' AS super, " +
      "COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user), false) AS passe"
  );
  const voitTout = qui[0].super || qui[0].passe;
  const { rows } = await client.query("SELECT count(*)::int AS n FROM entreprises");
  await client.end();
  const attendu = voitTout ? (rows[0].n > 0 ? 0 : 1) : 2;
  assert.equal(
    interroger({ ...process.env, DATABASE_SUPER_URL: URL }),
    attendu,
    voitTout
      ? rows[0].n > 0
        ? "une base qui porte des entreprises est annoncée vierge : le seed l'effacerait"
        : "une base vide est annoncée habitée : un espace neuf n'aurait pas de quoi se connecter"
      : "un rôle aveuglé par la RLS doit faire ABSTENIR la sonde, jamais conclure"
  );
});

// **La moitié qui compte vraiment : que `preparer.sh` s'en serve.** Une sonde
// juste qu'on n'appelle pas ne protège de rien.
cas("preparer.sh DEMANDE avant de vider, et s'abstient dans le doute", () => {
  const script = readFileSync(path.join(__dirname, "..", ".devcontainer", "preparer.sh"), "utf8");
  const sansCommentaires = script.split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n");

  assert.match(sansCommentaires, /base-habitee\.mjs/, "preparer.sh appelle le seed sans demander si la base est habitée");

  // Le seed ne doit vivre que sous la branche « vierge ».
  const apresCase = sansCommentaires.slice(sansCommentaires.indexOf("base-habitee.mjs"));
  const brancheVierge = apresCase.slice(apresCase.indexOf("  1)"), apresCase.indexOf("  *)"));
  assert.match(brancheVierge, /seed\.ts/, "le seed n'est pas rangé sous le seul cas qui l'autorise");
  const brancheDoute = apresCase.slice(apresCase.indexOf("  *)"), apresCase.indexOf("esac"));
  assert.ok(!/seed\.ts/.test(brancheDoute), "le doute amorce quand même : c'est exactement ce qui coûte ses données");

  // **`set -e` ne doit pas tuer le script sur un verdict.** 1 et 2 sont des
  // réponses, pas des pannes — sans cette garde, un espace neuf s'arrêterait
  // avant même d'avoir ses données de démonstration.
  assert.match(sansCommentaires, /\|\| HABITEE=\$\?/, "le code de sortie de la sonde ferait échouer la préparation");
});

async function jouer() {
  console.log("=== On ne vide pas une base habitée ===\n");
  for (const [nom, verifier] of epreuves) {
    try {
      await verifier();
      console.log(`  ✓ ${nom}`);
    } catch (e) {
      echecs++;
      console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
    }
  }
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Base habitée — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}
void jouer();
