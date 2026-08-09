import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { adressePublique } from "../src/server/agenda/adresse-publique";

// **Le défaut du 9 août 2026, trouvé pendant que le patron autorisait Atlas chez
// Google.** Le retour de Google construisait son adresse à partir de
// `NEXTAUTH_URL`, puis `ATLAS_URL_PUBLIQUE`, puis `http://localhost:3000`.
//
// Aucune de ces deux variables n'est posée sur le banc d'essai. Le navigateur
// de son téléphone était donc renvoyé vers `localhost:3000` — c'est-à-dire vers
// le téléphone lui-même. Le raccordement aboutissait, les jetons étaient
// enregistrés, et il tombait sur une page morte. **Rien ne lui disait que
// c'était fait**, et rien ne pouvait le lui dire.
//
// Ce que cette suite tient : l'adresse vient de ce que le NAVIGATEUR a demandé,
// pas d'une variable que personne ne pose.

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

/** Un porteur d'en-têtes minimal, comme celui d'une vraie requête. */
function entetes(valeurs: Record<string, string>) {
  return { get: (nom: string) => valeurs[nom.toLowerCase()] ?? null };
}

console.log("=== L'adresse vient du navigateur, pas d'une variable absente ===");

cas("derrière le mandataire d'un espace de travail : l'hôte public l'emporte", () => {
  // Le cas exact du banc. Sans cela, retour vers localhost et page morte.
  assert.equal(
    adressePublique(
      entetes({
        "x-forwarded-host": "reimagined-space-yodel-abc-3000.app.github.dev",
        "x-forwarded-proto": "https",
        host: "localhost:3000",
      }),
      {}
    ),
    "https://reimagined-space-yodel-abc-3000.app.github.dev"
  );
});

cas("aucune variable posée ne fait plus retomber sur localhost", () => {
  // **Le cœur du défaut.** L'environnement est vide, comme sur le banc.
  const adresse = adressePublique(
    entetes({ "x-forwarded-host": "mon-espace-3000.app.github.dev" }),
    {}
  );
  assert.ok(
    !adresse.includes("localhost"),
    `on renvoie encore le navigateur vers lui-même : ${adresse}`
  );
});

cas("sans protocole annoncé, on suppose https et non http", () => {
  // Un mandataire public sert en HTTPS. Supposer `http` ferait tomber le
  // navigateur sur un refus de connexion, ou pire, sur un avertissement.
  assert.equal(
    adressePublique(entetes({ "x-forwarded-host": "mon-espace-3000.app.github.dev" }), {}),
    "https://mon-espace-3000.app.github.dev"
  );
});

cas("plusieurs mandataires en cascade : le premier hôte est le bon", () => {
  assert.equal(
    adressePublique(
      entetes({ "x-forwarded-host": "public.example, interne.local", "x-forwarded-proto": "https, http" }),
      {}
    ),
    "https://public.example"
  );
});

cas("sans mandataire, l'en-tête `host` suffit", () => {
  assert.equal(
    adressePublique(entetes({ host: "atlas.exemple.fr", "x-forwarded-proto": "https" }), {}),
    "https://atlas.exemple.fr"
  );
});

console.log("\n=== Les variables restent un secours, jamais le premier choix ===");

cas("aucun en-tête : on se rabat sur NEXTAUTH_URL", () => {
  assert.equal(
    adressePublique(entetes({}), { NEXTAUTH_URL: "https://atlas.exemple.fr" }),
    "https://atlas.exemple.fr"
  );
});

cas("un hôte annoncé l'emporte sur la variable, jamais l'inverse", () => {
  // Sinon un déploiement mal configuré renverrait tout le monde ailleurs, en
  // silence — et le défaut réapparaîtrait sous une autre forme.
  assert.equal(
    adressePublique(entetes({ host: "vrai-hote.fr" }), { NEXTAUTH_URL: "https://ancienne-adresse.fr" }),
    "https://vrai-hote.fr"
  );
});

cas("rien du tout : localhost, faute de mieux, et seulement là", () => {
  assert.equal(adressePublique(entetes({}), {}), "http://localhost:3000");
});

console.log("\n=== Et la route de retour s'en sert vraiment ===");

cas("le retour de Google ne fabrique plus son adresse tout seul", () => {
  const source = readFileSync(
    path.join(__dirname, "..", "src", "app", "api", "agenda", "google", "retour", "route.ts"),
    "utf8"
  );
  assert.match(source, /adressePublique\(requete\.headers\)/, "la route n'utilise pas la règle commune");
  const enDur = source
    .split("\n")
    .filter((l) => /localhost:3000/.test(l))
    .filter((l) => !/^\s*(\/\/|\*)/.test(l.trim()));
  assert.deepEqual(enDur, [], `l'adresse de repli est revenue dans la route : ${enDur.join(" | ")}`);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Adresse publique — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
