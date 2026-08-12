import assert from "node:assert/strict";
import { composerMessageClient, composerMessageFacture } from "../src/lib/message-client";

// Le lien que le CLIENT reçoit doit être cliquable dans sa messagerie.
//
// **Le défaut, signalé par le patron le 10 août 2026 :** *« le lien n'est pas
// cliquable, je suis obligé de le copier et de le coller dans une page
// internet »*. Collé juste sous la phrase qui l'annonce, un lien est lu par
// beaucoup de messageries comme la suite du paragraphe : elles n'y
// reconnaissent plus une adresse.
//
// La règle, en texte brut : le lien SEUL sur sa ligne, une ligne vide de
// chaque côté. Ce contrôle la tient — et il tient aussi ce qui casserait :
// une espace collée, une ponctuation en fin de ligne, une phrase qui reprend
// juste après.

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

const LIEN = "https://exemple.app.github.dev/devis/rgp1DZ4Lg_2nxG1SrpkC9Wo";

function verifierIsolement(corps: string, quoi: string) {
  const lignes = corps.split("\n");
  const i = lignes.findIndex((l) => l.includes(LIEN));
  assert.ok(i >= 0, `${quoi} : le lien n'est pas dans le message`);
  assert.equal(lignes[i], LIEN, `${quoi} : la ligne du lien porte autre chose — « ${lignes[i]} »`);
  assert.equal(lignes[i - 1], "", `${quoi} : pas de ligne vide AVANT le lien`);
  assert.equal(lignes[i + 1], "", `${quoi} : pas de ligne vide APRÈS le lien`);
}

console.log("=== Le lien doit être cliquable chez le client ===");

cas("devis : le lien est seul sur sa ligne, isolé", () => {
  verifierIsolement(
    composerMessageClient({ clientNom: "Monsieur Martin", entrepriseNom: "Atelier Démo", lien: LIEN }).corps,
    "devis",
  );
});

cas("facture : même règle, avec et sans échéance", () => {
  for (const echeanceLisible of [null, "12 septembre 2026"]) {
    verifierIsolement(
      composerMessageFacture({
        clientNom: "M. Martin",
        entrepriseNom: "Atelier Démo",
        numeroFacture: "F-2026-001",
        echeanceLisible,
        lien: LIEN,
      }).corps,
      `facture (échéance : ${echeanceLisible ?? "aucune"})`,
    );
  }
});

cas("aucun message ne se termine ni ne s'ouvre sur une ligne vide", () => {
  // Une messagerie ajoute sa signature à la suite : trois lignes vides de
  // rang donnent un message qui a l'air abandonné en cours d'écriture.
  for (const corps of [
    composerMessageClient({ clientNom: "", entrepriseNom: "Atelier Démo", lien: LIEN }).corps,
    composerMessageFacture({
      clientNom: "",
      entrepriseNom: "Atelier Démo",
      numeroFacture: "F-1",
      echeanceLisible: "12 septembre 2026",
      lien: LIEN,
    }).corps,
  ]) {
    assert.ok(!corps.startsWith("\n"), "le message s'ouvre sur une ligne vide");
    assert.ok(!corps.endsWith("\n"), "le message se termine sur une ligne vide");
    assert.ok(!corps.includes("\n\n\n"), `deux lignes vides de rang :\n${JSON.stringify(corps)}`);
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Lien cliquable — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
