import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { raisonDeLaMigration } from "./_raison-migration.mjs";

/**
 * **CE QUI EST PUBLIÉ SUR UNE FICHE D'UN DÉPÔT PUBLIC.**
 *
 * Sa condition, le 13 septembre 2026, en autorisant cette ligne sur la fiche :
 * *« à condition de ne jamais exposer de donnée sensible, de secret, de valeur
 * métier confidentielle ou de contenu utilisateur »*.
 *
 * Cette suite éprouve exactement cela — et d'abord dans le mauvais sens : on lui
 * donne des messages qui PORTENT une adresse, un mot de passe, le nom d'un
 * client, et l'on vérifie que rien n'en ressort.
 */

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const journal = (ligne: string) =>
  ["13/09 19:02:11 — code neuf", `migrations : ${ligne}`, "dépendances : faites"].join("\n");

console.log("=== La raison se lit, et elle est juste ===");

cas("SA PANNE : la contrainte que des lignes existantes refusent", () => {
  const r = raisonDeLaMigration(
    journal(
      'échec : error: check constraint "diagnostics_refus_complet_ck" of relation "diagnostics" is violated by some row'
    )
  );
  assert.equal(
    r,
    "des lignes déjà en base refusent la contrainte « diagnostics_refus_complet_ck » de la table « diagnostics »"
  );
});

cas("le mauvais rôle se nomme, c'est le défaut du 9 août", () => {
  const r = raisonDeLaMigration(journal("échec : permission denied for schema public"));
  assert.match(r ?? "", /droits insuffisants sur le schéma « public »/);
});

cas("une base injoignable se dit", () => {
  assert.match(raisonDeLaMigration(journal("échec : connect ECONNREFUSED 127.0.0.1:5432")) ?? "", /connexion refusée/);
});

cas("la DERNIÈRE tentative fait foi, pas la première", () => {
  // Un espace rallumé trois fois porte trois lignes : publier la première
  // annoncerait une panne réparée depuis.
  const trois = [
    "migrations : échec : error: permission denied for schema public",
    "migrations : échec : error: connect ETIMEDOUT",
    "migrations : faites",
  ].join("\n");
  assert.equal(raisonDeLaMigration(trois), null, "une migration réussie ne doit RIEN publier");
});

cas("rien à publier quand tout va bien", () => {
  assert.equal(raisonDeLaMigration(journal("faites")), null);
  assert.equal(raisonDeLaMigration(journal("faites : 4 migration(s) rattrapée(s)")), null);
  assert.equal(raisonDeLaMigration(""), null);
  assert.equal(raisonDeLaMigration(null), null);
});

console.log("\n=== …et RIEN d'autre ne sort ===");

const SECRETS = [
  'échec : error: duplicate key value violates unique constraint "users_email_unique" DETAIL: Key (email)=(jean.dupont@exemple.fr) already exists.',
  "échec : error: password authentication failed for user \"atlas_app\" (mot de passe : sup3r-s3cret)",
  'échec : error: invalid input syntax for type uuid: "ANTHROPIC_API_KEY=sk-ant-0123456789"',
  "échec : error: new row for relation \"clients\" violates check DETAIL: Failing row contains (Madame Lucie Bernard, 06 12 34 56 78, 12 rue des Lilas).",
];

cas("aucune donnée du message d'origine ne traverse", () => {
  for (const brut of SECRETS) {
    const r = raisonDeLaMigration(journal(brut)) ?? "";
    for (const interdit of [
      "jean.dupont@exemple.fr",
      "sup3r-s3cret",
      "sk-ant-0123456789",
      "Madame Lucie Bernard",
      "06 12 34 56 78",
      "rue des Lilas",
    ]) {
      assert.ok(!r.includes(interdit), `« ${interdit} » a été publié sur une page publique : ${r}`);
    }
  }
});

cas("une clé dupliquée nomme la contrainte, jamais la valeur", () => {
  const r = raisonDeLaMigration(journal(SECRETS[0])) ?? "";
  assert.match(r, /« users_email_unique »/);
  assert.ok(!/exemple\.fr|Key \(/.test(r), `la valeur a suivi le nom : ${r}`);
});

cas("une forme inconnue ne publie RIEN du message", () => {
  const r = raisonDeLaMigration(journal("échec : error: quelque chose de tout à fait imprévu chez Madame Lucie")) ?? "";
  assert.equal(r, "échec d'une forme non reconnue — la raison est dans le journal de l'espace");
  assert.ok(!r.includes("Lucie"));
});

cas("la fiche emploie bien cette lecture, elle n'en écrit pas une seconde", () => {
  // La leçon du 28 août : ce qui n'est pas MONTÉ ne sert à rien.
  const source = readFileSync(path.join(__dirname, "diagnostiquer-espace.mjs"), "utf8");
  assert.match(source, /raisonDeLaMigration/, "la fiche ne publie pas la raison : ce module ne sert à personne");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La raison de l'échec, assainie — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
