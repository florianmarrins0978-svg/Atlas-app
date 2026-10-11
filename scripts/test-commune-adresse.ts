import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { communeDeLAdresse } from "../src/lib/commune-adresse";

// **LA COMMUNE SOUS LE NOM DU CHANTIER.**
//
// ─────────────────────────────────────────────────────────────────────────────
// La maquette du planning retenue le 3 septembre 2026 écrit le lieu sous la
// durée : c'est ce qui distingue quatre clients qui s'appellent Martins.
// L'adresse existe en base et ne servait qu'aux boutons de la feuille.
//
// **CE QUE CETTE SUITE DÉFEND, C'EST LE REFUS.** Découper une adresse est
// facile ; ce qui est difficile, c'est de ne rien écrire quand on ne sait pas.
// Une commune devinée est pire qu'une ligne vide — le patron lirait un nom de
// rue en croyant lire un lieu, et partirait avec (`CLAUDE.md` §4).
//
// Les adresses ci-dessous sont des formes réelles de saisie au téléphone, pas
// un corpus de laboratoire : avec virgule et sans, code postal devant et
// derrière, « France » à la fin, et l'adresse qu'on n'a jamais finie d'écrire.

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

cas("La forme normale : le code postal désigne la commune", () => {
  assert.equal(communeDeLAdresse("12 rue des Lilas, 44210 Pornic"), "Pornic");
  assert.equal(communeDeLAdresse("3 chemin du Pré 44760 La Bernerie-en-Retz"), "La Bernerie-en-Retz");
  // La casse est celle qu'il a tapée : la corriger inventerait une écriture
  // qu'il ne reconnaîtrait pas sur son propre écran.
  assert.equal(communeDeLAdresse("44210 SAINTE-MARIE-SUR-MER"), "SAINTE-MARIE-SUR-MER");
});

cas("Ce qui suit la commune ne la rejoint pas", () => {
  assert.equal(communeDeLAdresse("12 rue des Lilas, 44210 Pornic, France"), "Pornic");
  // Le pays seul ne nomme aucun chantier — et c'est le dernier segment, donc
  // exactement celui qu'un découpage naïf retiendrait.
  assert.equal(communeDeLAdresse("12 rue des Lilas, France"), null);
});

cas("Sans code postal, la virgule fait foi", () => {
  assert.equal(communeDeLAdresse("12 rue des Lilas, Pornic"), "Pornic");
  assert.equal(communeDeLAdresse("Lotissement des Ormes, allée 3, Les Moutiers-en-Retz"), "Les Moutiers-en-Retz");
});

// ─── LE CŒUR : CE QU'ELLE REFUSE ─────────────────────────────────────────────
cas("Sans code postal ET sans virgule, elle ne devine pas", () => {
  // « Chemin du Moulin » et « Pornic » sont deux suites de mots sans chiffre :
  // rien ne les distingue. Rendre le premier écrirait une rue à la place d'une
  // commune, sous le nom du client.
  assert.equal(communeDeLAdresse("Chemin du Moulin"), null);
  assert.equal(communeDeLAdresse("Pornic"), null);
});

cas("Elle ne rend jamais un nombre seul", () => {
  assert.equal(communeDeLAdresse("12 rue des Lilas 44210"), null);
  assert.equal(communeDeLAdresse("44210"), null);
  assert.equal(communeDeLAdresse("12 rue des Lilas, 14"), null);
});

cas("Rien à lire, rien à écrire", () => {
  assert.equal(communeDeLAdresse(null), null);
  assert.equal(communeDeLAdresse(undefined), null);
  assert.equal(communeDeLAdresse("   "), null);
  assert.equal(communeDeLAdresse(",,"), null);
});

cas("Un numéro de rue à cinq chiffres n'est pas un code postal", () => {
  // Sans bornes de mot, « 12345 » du numéro de voirie passerait pour un code
  // postal, et « chemin des Vignes » deviendrait la commune.
  assert.equal(communeDeLAdresse("12345 chemin des Vignes, Pornic"), "Pornic");
});

cas("La saisie sale se ramasse : espaces, retours, points-virgules", () => {
  assert.equal(communeDeLAdresse("12 rue des Lilas\n44210   Pornic"), "Pornic");
  assert.equal(communeDeLAdresse("12 rue des Lilas ; Pornic -"), "Pornic");
});

// **L'écran n'a pas le droit de refaire la règle** (`CLAUDE.md` §3). Deux
// découpages écrits séparément nommeraient un jour deux communes différentes
// sur deux lignes qui se lisent ensemble — la ligne des planifiés et la fiche
// de la journée, à deux centimètres d'écart.
cas("Le planning emploie la règle partagée, et n'en réécrit pas une seconde", () => {
  const ecran = readFileSync(
    path.join(__dirname, "..", "src", "app", "planning", "PlanningClient.tsx"),
    "utf8"
  );
  assert.match(
    ecran,
    /communeDeLAdresse/,
    "le planning n'appelle plus la règle partagée : il en a donc une à lui, qui divergera"
  );
  assert.doesNotMatch(
    ecran,
    /adresseChantier[^\n]*\.split\(/,
    "le planning redécoupe l'adresse à la main : deux règles pour une seule commune"
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La commune d'une adresse — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
