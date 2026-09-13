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
import {
  adresseDeTelechargement,
  enTetesDeRemise,
  messageDeTelechargementRate,
  nomAnnonceParLeServeur,
  veutTelecharger,
} from "../src/lib/remise-de-fichier";

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

// ─── LA RÈGLE QUI PRIME : on ne ment jamais sur le type d'un fichier ────────

essai("télécharger sert le VRAI type — un fichier rangé garde son identité", () => {
  // **Ce contrôle exigeait l'inverse jusqu'au 10 septembre 2026**, et c'est ce
  // qui a laissé passer le défaut : il réclamait `application/octet-stream`
  // pour empêcher iPhone d'afficher au lieu d'enregistrer. Le type annoncé
  // colle au fichier ENREGISTRÉ : rouvert depuis les téléchargements, le PDF
  // n'avait plus de lecteur, et le patron n'a eu qu'une page blanche — sur un
  // fichier intact. Ce qui range un fichier, c'est `attachment`, et rien
  // d'autre.
  for (const type of ["application/pdf", "image/jpeg", "image/png", "image/heic", "audio/mpeg"]) {
    const en = enTetesDeRemise({ telecharger: true, nom: "F2026-000001.pdf", type });
    assert.equal(
      en["Content-Type"],
      type,
      `servi en « ${en["Content-Type"]} » au lieu de « ${type} » : le fichier enregistré perd son identité`
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

// ─── L'ADRESSE, COMPOSÉE UNE SEULE FOIS ────────────────────────────────────

essai("le paramètre se colle à une adresse nue comme à une adresse qui a déjà une requête", () => {
  assert.equal(adresseDeTelechargement("/api/factures/1/pdf"), "/api/factures/1/pdf?telecharger=1");
  // Écrit à la main, `?telecharger=1` sur une adresse qui portait déjà `?` en
  // faisait deux requêtes — et le serveur n'en lisait qu'une.
  assert.equal(adresseDeTelechargement("/api/factures/1/pdf?v=2"), "/api/factures/1/pdf?v=2&telecharger=1");
  // Et ce qui est composé ici doit se relire là-bas : les deux bouts de la
  // même règle, dans le même fichier.
  assert.equal(veutTelecharger(`https://x${adresseDeTelechargement("/api/factures/1/pdf")}`), true);
});

// ─── LE NOM ANNONCÉ PAR LE SERVEUR ─────────────────────────────────────────

essai("le nom du serveur se relit, accents compris", () => {
  const entete = enTetesDeRemise({
    telecharger: true,
    nom: "Devis André & Fils.pdf",
    type: "application/pdf",
  })["Content-Disposition"];
  assert.equal(nomAnnonceParLeServeur(entete), "Devis André & Fils.pdf");
});

essai("sans `filename*`, la version ASCII fait foi ; sans en-tête, personne ne décide", () => {
  assert.equal(nomAnnonceParLeServeur('attachment; filename="F2026-0001.pdf"'), "F2026-0001.pdf");
  assert.equal(nomAnnonceParLeServeur(null), null);
  assert.equal(nomAnnonceParLeServeur("attachment"), null);
});

essai("un `filename*` abîmé ne coûte pas le nom : `filename` prend le relais", () => {
  // `%E9` seul n'est pas de l'UTF-8 valide : `decodeURIComponent` lève. Sans
  // repli, le fichier descendait sous un nom inventé par l'écran.
  assert.equal(
    nomAnnonceParLeServeur(`attachment; filename="devis.pdf"; filename*=UTF-8''%E9`),
    "devis.pdf"
  );
});

// ─── CE QUE L'ÉCRAN DIT QUAND LE DOCUMENT N'ARRIVE PAS ─────────────────────

essai("chaque refus dit ce qu'il faut faire, et jamais la même chose", () => {
  // C'est tout l'objet du lot du 12 septembre : un lien ne rapporte rien, et
  // « rien ne se passe » se lit comme un bouton cassé.
  assert.match(messageDeTelechargementRate(401), /[Rr]econnect/);
  assert.match(messageDeTelechargementRate(403), /[Rr]econnect/);
  assert.match(messageDeTelechargementRate(404), /plus disponible/);
  // Le statut se lit dans le message : sans lui, on ne sait pas quoi chercher.
  assert.match(messageDeTelechargementRate(500), /500/);
  const tous = [401, 404, 500].map(messageDeTelechargementRate);
  assert.equal(new Set(tous).size, 3, "deux refus disent la même chose");
});

console.log(echecs === 0 ? "\n✅ Tout est vert." : `\n❌ ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
