// Le rapport que l'espace publie peut-il laisser fuir une clé ?
//
// **Ce contrôle existe avant tout pour dire non.** Le 12 août 2026, le patron
// demande que l'agent voie son espace. La réponse retenue est une fiche GitHub
// que sa machine écrit toute seule — sens unique : il pousse, l'agent lit. Mais
// une machine qui publie son journal de démarrage publie tout ce qui s'y trouve,
// y compris ce qui n'aurait jamais dû sortir.
//
// La censure est volontairement GROSSIÈRE : une ligne innocente retirée ne coûte
// qu'une gêne de lecture, une clé publiée coûte une clé. Ces cas tiennent les
// deux bouts — ce qui doit disparaître, et ce qui doit rester lisible.

import assert from "node:assert/strict";
import { expurger, corpsDuRapport, TITRE_FICHE } from "./rapporter-espace.mjs";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Le rapport de l'espace ne publie pas de secret ===");

cas("une clé d'IA dans le journal ne sort pas", () => {
  const journal = [
    "→ Démarrage",
    "ANTHROPIC_API_KEY=sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "L'application répond",
  ].join("\n");
  const sorti = expurger(journal);
  assert.ok(!sorti.includes("sk-ant-api03"), "la clé est passée dans le rapport publié");
  assert.ok(sorti.includes("L'application répond"), "la censure a emporté une ligne utile");
});

cas("une adresse de base de données ne sort pas", () => {
  const sorti = expurger("DATABASE_URL=postgresql://atlas:motdepasse@10.0.0.4:5432/atlas");
  assert.ok(!sorti.includes("motdepasse"), "le mot de passe de la base est publié");
  assert.ok(!sorti.includes("10.0.0.4"), "l'adresse interne de la base est publiée");
});

cas("un jeton GitHub ne sort pas", () => {
  for (const jeton of ["ghp_abcdefghijklmnopqrstuvwxyz0123456789", "github_pat_11ABCDEF_xyz"]) {
    assert.ok(!expurger(`token: ${jeton}`).includes(jeton), `le jeton ${jeton.slice(0, 8)}… est publié`);
  }
});

cas("le compte de démonstration RESTE lisible : il est public", () => {
  // Le censurer ne protégerait rien — il est écrit dans le dépôt et affiché à
  // chaque démarrage — et rendrait le rapport inutilisable pour diagnostiquer.
  const sorti = expurger("     demo@atlas.local  /  demo1234");
  assert.ok(sorti.includes("demo@atlas.local"), "le compte de démonstration a été censuré pour rien");
});

cas("le rapport dit QUAND il a été écrit, et de ne pas y répondre", () => {
  // Une fiche sans date ne dit pas si l'on regarde l'état d'aujourd'hui ou
  // celui d'avant-hier — c'est précisément la question qu'elle doit trancher.
  const corps = corpsDuRapport({
    diagnostic: "Serveur : répond",
    journal: "L'application répond",
    quand: "2026-08-12T06:00:00.000Z",
  });
  assert.match(corps, /2026-08-12T06:00:00/, "le rapport ne porte pas sa date");
  assert.match(corps, /réécrite entièrement/, "rien ne prévient qu'une réponse serait effacée");
});

cas("le titre de la fiche est fixe : une seule fiche, pas une par allumage", () => {
  // C'est ce titre qui sert à la retrouver. S'il devenait variable, chaque
  // démarrage ouvrirait une fiche de plus, et le dépôt se remplirait de bruit.
  assert.ok(TITRE_FICHE.length > 10, "le titre de la fiche est vide ou trop court pour être cherché");
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(TITRE_FICHE), "le titre porte une date : il créera une fiche par jour");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Rapport de l'espace — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
