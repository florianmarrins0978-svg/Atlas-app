import assert from "node:assert";
import { liensItineraire, lienAppel } from "../src/lib/itineraire";

/**
 * Les liens d'itinéraire — la règle pure, éprouvée sans base ni navigateur.
 *
 * **Ce que cette suite garde, et qu'on ne voit pas à l'œil.** Un lien de GPS
 * paraît juste tant qu'on l'essaie avec « Bordeaux ». Il se casse sur la
 * première vraie adresse de chantier, qui porte une virgule, des accents et un
 * numéro de rue — et il se casse en SILENCE : le GPS ouvre, mais sur la mauvaise
 * destination. Personne ne s'en aperçoit avant d'être garé au mauvais endroit.
 */

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const ADRESSE = "12 chemin des Chênes, 33600 Pessac";

test("Une adresse produit les trois destinations", () => {
  const liens = liensItineraire(ADRESSE);
  assert.ok(liens, "une adresse renseignée doit produire des liens");
  assert.ok(liens.plans.startsWith("https://maps.apple.com/"));
  assert.ok(liens.google.startsWith("https://www.google.com/maps/"));
  assert.ok(liens.waze.startsWith("https://waze.com/ul"));
});

// **Le cœur de la règle** : on n'invente pas d'adresse (`CLAUDE.md` §4). Un
// chantier dicté à la va-vite n'en a pas toujours, et l'écran doit pouvoir
// éteindre les destinations plutôt que proposer un départ vers nulle part.
test("Sans adresse, rien n'est proposé — ni null, ni vide, ni « ? »", () => {
  assert.equal(liensItineraire(null), null);
  assert.equal(liensItineraire(undefined), null);
  assert.equal(liensItineraire(""), null);
  assert.equal(liensItineraire("   "), null, "des espaces ne sont pas une adresse");
  assert.equal(liensItineraire("\n\t "), null);
});

// La virgule est le piège de ce fichier. `encodeURI` la laisse passer, et elle
// sépare alors deux paramètres chez Waze : l'adresse est tronquée au numéro de
// rue, et le GPS emmène le patron dans une autre commune.
test("La virgule et les espaces sont encodés, jamais laissés bruts", () => {
  const liens = liensItineraire(ADRESSE);
  assert.ok(liens);
  for (const lien of [liens.plans, liens.google, liens.waze]) {
    const apresLeParametre = lien.slice(lien.indexOf("="));
    assert.ok(!apresLeParametre.includes(","), `une virgule brute subsiste : ${lien}`);
    assert.ok(!apresLeParametre.includes(" "), `un espace brut subsiste : ${lien}`);
  }
});

test("Les accents traversent, et l'adresse se relit entière", () => {
  const liens = liensItineraire(ADRESSE);
  assert.ok(liens);
  for (const lien of [liens.plans, liens.google, liens.waze]) {
    const url = new URL(lien);
    const valeurs = [...url.searchParams.values()];
    assert.ok(
      valeurs.includes(ADRESSE),
      `l'adresse doit se relire telle quelle depuis ${lien} (reçu : ${valeurs.join(" | ")})`
    );
  }
});

// Sans `dirflg=d`, Plans rouvre le DERNIER mode utilisé — à pied, s'il a
// cherché une rue en ville la veille. Trente kilomètres à pied : l'estimation
// devient absurde, et il ne pense pas à regarder le petit bouton en haut.
test("Plans demande un itinéraire en voiture", () => {
  const liens = liensItineraire(ADRESSE);
  assert.equal(new URL(liens!.plans).searchParams.get("dirflg"), "d");
});

test("Waze démarre la navigation au lieu de poser un point sur la carte", () => {
  const liens = liensItineraire(ADRESSE);
  assert.equal(new URL(liens!.waze).searchParams.get("navigate"), "yes");
});

// **Jamais de schéma propre à une application** (`waze://`, `comgooglemaps://`).
// Ils sont plus courts, et ils échouent EN SILENCE quand l'application n'est pas
// installée : le doigt appuie, rien ne bouge, rien ne dit pourquoi. Sur un
// chantier, ce n'est pas un désagrément — c'est une adresse qu'on n'a plus.
test("Les trois liens sont universels, et retombent donc sur un site", () => {
  const liens = liensItineraire(ADRESSE);
  assert.ok(liens);
  for (const lien of [liens.plans, liens.google, liens.waze]) {
    assert.ok(lien.startsWith("https://"), `un schéma propre échoue en silence : ${lien}`);
  }
});

test("L'adresse est nettoyée de ses espaces de bord avant d'être posée", () => {
  const liens = liensItineraire(`  ${ADRESSE}  `);
  assert.ok(liens);
  assert.ok(new URL(liens.waze).searchParams.get("q") === ADRESSE);
});

test("Un numéro écrit à la main devient un lien d'appel composable", () => {
  assert.equal(lienAppel("05 56 00 00 12"), "tel:0556000012");
  assert.equal(lienAppel("+33 5.56.00.00.12"), "tel:+33556000012");
});

test("Sans numéro, pas de lien d'appel", () => {
  assert.equal(lienAppel(null), null);
  assert.equal(lienAppel(undefined), null);
  assert.equal(lienAppel(""), null);
  // Un champ rempli de tirets n'est pas un numéro : composer « tel: » ouvrirait
  // le clavier téléphone sur rien.
  assert.equal(lienAppel(" - . "), null);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
