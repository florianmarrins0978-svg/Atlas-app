/**
 * QUI PEUT OUVRIR LA PORTE — la règle, éprouvée sans base, sans réseau, sans clé.
 *
 * **Ce qu'elle défend, et ce n'est pas une coquetterie d'affichage :**
 *
 *   1. un bouton ne s'affiche QUE si son fournisseur peut aboutir — la moitié
 *      d'une paire de clés ne compte pas ;
 *   2. une adresse rendue par Google ou Apple n'est acceptée que si elle est
 *      **prouvée**. Sans adaptateur de base, l'adresse est le seul lien entre
 *      une identité extérieure et un compte d'ici : une adresse non vérifiée
 *      laisserait entrer chez l'artisan qui la porte ;
 *   3. le nom qui remonte d'un bouton est confronté à la liste fermée avant
 *      d'atteindre Auth.js.
 */
import assert from "node:assert/strict";
import {
  emailProuve,
  estNomFournisseur,
  fournisseursDisponibles,
  ouAllerSansCompte,
} from "../src/lib/fournisseurs-connexion";

let reussis = 0;
let echoues = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    echoues++;
  }
}

console.log("=== Qui peut ouvrir la porte ===\n");

// ─── 1 · Un bouton qui ne peut pas aboutir ne s'affiche pas ─────────────────

test("sans aucune clé, aucun fournisseur — l'écran d'aujourd'hui", () => {
  assert.deepEqual(fournisseursDisponibles({}), []);
});

test("Google seul, quand ses deux valeurs sont posées", () => {
  const ouverts = fournisseursDisponibles({ googleId: "abc.apps", googleSecret: "s3cr3t" });
  assert.deepEqual(
    ouverts.map((f) => f.nom),
    ["google"]
  );
});

test("l'identifiant SANS le secret n'ouvre rien — sinon le bouton mène à une erreur", () => {
  assert.deepEqual(fournisseursDisponibles({ googleId: "abc.apps" }), []);
});

test("le secret SANS l'identifiant n'ouvre rien non plus", () => {
  assert.deepEqual(fournisseursDisponibles({ googleSecret: "s3cr3t" }), []);
});

test("une ligne vide restée dans le .env ne compte pas comme une clé", () => {
  assert.deepEqual(fournisseursDisponibles({ googleId: "   ", googleSecret: "s3cr3t" }), []);
});

test("les deux ensemble, dans l'ordre de la planche : Google puis Apple", () => {
  const ouverts = fournisseursDisponibles({
    googleId: "a",
    googleSecret: "b",
    appleId: "c",
    appleSecret: "d",
  });
  assert.deepEqual(
    ouverts.map((f) => f.nom),
    ["google", "apple"]
  );
  assert.deepEqual(
    ouverts.map((f) => f.libelle),
    ["Google", "Apple"]
  );
});

test("Apple seul se montre seul — il n'attend pas Google", () => {
  const ouverts = fournisseursDisponibles({ appleId: "c", appleSecret: "d" });
  assert.deepEqual(
    ouverts.map((f) => f.nom),
    ["apple"]
  );
});

// ─── 2 · L'adresse doit être PROUVÉE ────────────────────────────────────────

test("Google rend un booléen vrai : l'adresse est prouvée", () => {
  assert.equal(emailProuve({ email: "Jean@Exemple.FR", email_verified: true }), "jean@exemple.fr");
});

test("Apple rend la chaîne « true » : elle compte aussi", () => {
  assert.equal(emailProuve({ email: "a@b.fr", email_verified: "true" }), "a@b.fr");
});

test("UNE ADRESSE NON VÉRIFIÉE N'OUVRE RIEN — c'est la ligne de sécurité du lot", () => {
  assert.equal(emailProuve({ email: "patron@atlas.fr", email_verified: false }), null);
});

test("un drapeau ABSENT n'est pas un drapeau vrai — pas de repli silencieux", () => {
  assert.equal(emailProuve({ email: "patron@atlas.fr" }), null);
});

test("une chaîne « false » ne se lit pas comme vraie", () => {
  assert.equal(emailProuve({ email: "a@b.fr", email_verified: "false" }), null);
});

test("sans adresse, rien", () => {
  assert.equal(emailProuve({ email_verified: true }), null);
});

test("ce qui n'est pas une adresse est refusé", () => {
  assert.equal(emailProuve({ email: "jean", email_verified: true }), null);
});

test("un profil absent ou d'un autre type ne fait pas tomber la porte", () => {
  assert.equal(emailProuve(null), null);
  assert.equal(emailProuve(undefined), null);
  assert.equal(emailProuve("jean@exemple.fr"), null);
});

// ─── 3 · Le nom qui remonte d'un bouton ─────────────────────────────────────

test("les deux noms connus passent", () => {
  assert.equal(estNomFournisseur("google"), true);
  assert.equal(estNomFournisseur("apple"), true);
});

test("tout le reste est refusé avant d'atteindre Auth.js", () => {
  for (const faux of ["credentials", "cle-appareil", "", null, undefined, 3, "GOOGLE"]) {
    assert.equal(estNomFournisseur(faux), false, `« ${String(faux)} » ne doit pas passer`);
  }
});

// ─── 4 · Sans compte Atlas, on va le créer ──────────────────────────────────

test("l'adresse prouvée est proposée d'office à la création", () => {
  assert.equal(
    ouAllerSansCompte("Jean@Exemple.fr "),
    "/creer-un-compte?email=jean%40exemple.fr"
  );
});

test("sans adresse, la création s'ouvre quand même — jamais un cul-de-sac", () => {
  assert.equal(ouAllerSansCompte(null), "/creer-un-compte");
  assert.equal(ouAllerSansCompte(""), "/creer-un-compte");
});

console.log(`\n${reussis} réussis, ${echoues} échoués`);
process.exit(echoues > 0 ? 1 : 0);
