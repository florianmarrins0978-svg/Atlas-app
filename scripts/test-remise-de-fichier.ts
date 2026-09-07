// Ce qui fait qu'un fichier DESCEND au lieu de s'afficher.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE PROTÈGE.** Le 7 septembre 2026, le patron, capture à
// l'appui, sous sa facture : *« quand je clique sur télécharger ça ne la
// télécharge pas — un clic, une action, ça doit la télécharger direct »*.
//
// La route répondait pourtant `Content-Disposition: attachment`, et les
// contrôles le vérifiaient. Ce qu'aucun ne regardait, c'est le TYPE servi :
// `application/pdf`, c'est-à-dire un document que Safari sait peindre. Sur son
// iPhone, il l'ouvrait dans son lecteur, et rien n'était enregistré.
//
// Ni base, ni réseau, ni navigateur.

import assert from "node:assert/strict";
import { enTetesDeRemise, veutTelecharger } from "../src/lib/remise-de-fichier";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Télécharger, c'est ranger le fichier — pas le montrer ===\n");

// ─── LA RÈGLE QUI PRIME : rien d'affichable quand on télécharge ─────────────

essai("télécharger ne sert JAMAIS un type que le navigateur sait peindre", () => {
  // Tous les types que ce dépôt sert : chacun a un lecteur intégré sur iPhone.
  for (const type of ["application/pdf", "image/jpeg", "image/png", "image/heic", "audio/mpeg"]) {
    const en = enTetesDeRemise({ telecharger: true, nom: "F2026-000001.pdf", type });
    assert.equal(
      en["Content-Type"],
      "application/octet-stream",
      `servi en « ${en["Content-Type"]} » : le navigateur a un lecteur pour ce type, et il l'affichera`
    );
  }
});

essai("télécharger dit aussi `attachment`", () => {
  const en = enTetesDeRemise({ telecharger: true, nom: "F2026-000001.pdf", type: "application/pdf" });
  assert.ok(
    en["Content-Disposition"].startsWith("attachment;"),
    `« ${en["Content-Disposition"]} » : le type seul ne suffit pas, les deux se disent`
  );
});

// ─── L'APERÇU, LUI, NE BOUGE PAS ───────────────────────────────────────────

essai("ouvrir sert le vrai type, et `inline`", () => {
  const en = enTetesDeRemise({ telecharger: false, nom: "F2026-000001.pdf", type: "application/pdf" });
  assert.equal(en["Content-Type"], "application/pdf");
  assert.ok(en["Content-Disposition"].startsWith("inline;"), en["Content-Disposition"]);
});

// ─── LE NOM : celui qu'il retrouvera dans son dossier ──────────────────────

essai("le nom est écrit deux fois — ASCII pour les vieux, UTF-8 pour le vrai", () => {
  const en = enTetesDeRemise({
    telecharger: true,
    nom: "fiche-chantier-2026-09-07-Jardin-de-l'Été.pdf",
    type: "application/pdf",
  });
  const cd = en["Content-Disposition"];
  assert.ok(cd.includes(`filename="fiche-chantier-2026-09-07-Jardin-de-l'Ete.pdf"`), cd);
  assert.ok(cd.includes("filename*=UTF-8''"), cd);
  assert.ok(cd.includes(encodeURIComponent("Été")), `le vrai nom accentué manque : ${cd}`);
});

essai("un accent ne part JAMAIS brut dans l'en-tête", () => {
  // Un en-tête HTTP n'accepte que l'ASCII : un octet au-delà fait tomber la
  // réponse entière chez certains serveurs — le fichier n'arrive pas du tout.
  const cd = enTetesDeRemise({ telecharger: true, nom: "devis-Été.pdf", type: "application/pdf" })[
    "Content-Disposition"
  ];
  const ascii = cd.slice(0, cd.indexOf("filename*="));
  assert.ok(
    // eslint-disable-next-line no-control-regex
    /^[\x20-\x7e]*$/.test(ascii),
    `la partie ASCII porte un caractère interdit : ${JSON.stringify(ascii)}`
  );
});

essai("un nom ne peut pas refermer l'en-tête et en écrire un autre", () => {
  // Le nom d'un chantier vient de ce que le patron a tapé (la fiche de
  // chantier). Un guillemet, un retour à la ligne, et la valeur se referme.
  const cd = enTetesDeRemise({
    telecharger: true,
    nom: 'fiche".pdf\r\nX-Injecte: 1',
    type: "application/pdf",
  })["Content-Disposition"];
  assert.ok(!cd.includes("\r") && !cd.includes("\n"), `l'en-tête porte un retour à la ligne : ${JSON.stringify(cd)}`);
  assert.equal((cd.match(/"/g) ?? []).length, 2, `guillemets en trop : ${cd}`);
});

essai("un nom vide ne rend pas un fichier sans nom", () => {
  const cd = enTetesDeRemise({ telecharger: true, nom: "   ", type: "application/pdf" })["Content-Disposition"];
  assert.ok(cd.includes('filename="fichier"'), cd);
});

// ─── LE PARAMÈTRE, LU DE LA MÊME FAÇON PARTOUT ─────────────────────────────

essai("`?telecharger=1` range, et rien d'autre ne range", () => {
  assert.equal(veutTelecharger("https://x/api/factures/1/pdf?telecharger=1"), true);
  assert.equal(veutTelecharger("https://x/api/factures/1/pdf"), false);
  assert.equal(veutTelecharger("https://x/api/factures/1/pdf?telecharger=0"), false);
  // La forme nue n'était acceptée que par la route du devis du client, et par
  // elle seule : aucun écran ne l'écrit.
  assert.equal(veutTelecharger("https://x/devis/abc/pdf?telecharger"), false);
});

console.log(echecs === 0 ? "\n✅ Tout est vert." : `\n❌ ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
