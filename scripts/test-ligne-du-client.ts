import assert from "node:assert/strict";
import {
  compteDeLaPorte,
  initialesDuClient,
  phraseDeLaDerniere,
  resteDuDeLaLigne,
} from "../src/lib/ligne-du-client";
import { MOTS_DE_LA_CATEGORIE } from "../src/lib/civilite";

// **Ce que dit la ligne d'un client sur Vos clients soignée** — sa planche
// `appli/soignee/clients.html`, retenue le 29 octobre 2026 (« oui », après sa
// condition du 27 : l'import d'un tableau, livré le 29).
//
// La planche change des MOTS, et chacun se tient ici, sans écran :
//
//   1. la dernière pièce se lit « Facture du 17 oct. » (avant : « Facture 17 oct. ») ;
//   2. le reste dû s'écrit « 312,00 € dus » d'un seul tenant ;
//   3. chaque client porte ses initiales, la règle de l'import (une seule) ;
//   4. chaque porte porte son nombre, « Aucun » quand il n'y a personne ;
//   5. « Vos entreprises » s'appelle « Vos partenaires ».

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

console.log("=== La ligne d'un client, Vos clients soignée ===\n");

cas("la dernière pièce : « Facture du 17 oct. », l'année tue quand c'est la sienne", () => {
  assert.equal(phraseDeLaDerniere({ quoi: "Facture", jour: "2026-10-17" }, "2026-10-29"), "Facture du 17 oct.");
  assert.equal(phraseDeLaDerniere({ quoi: "Devis", jour: "2026-10-02" }, "2026-10-29"), "Devis du 2 oct.");
  assert.equal(phraseDeLaDerniere({ quoi: "Fiche", jour: "2025-06-08" }, "2026-10-29"), "Fiche du 8 juin 2025");
});

cas("rien n'est parti : aucune phrase, jamais une date inventée", () => {
  assert.equal(phraseDeLaDerniere(null, "2026-10-29"), null);
});

cas("le reste dû d'un seul tenant : « 312,00 € dus »", () => {
  // `enEuros` sépare les milliers par une espace insécable : on la compare telle quelle.
  assert.equal(resteDuDeLaLigne("312"), "312,00 € dus");
  assert.equal(resteDuDeLaLigne(2016)?.replace(/\s/g, " "), "2 016,00 € dus");
});

cas("rien de dû : aucune pastille (un « 0 € » se lirait comme un mauvais payeur)", () => {
  assert.equal(resteDuDeLaLigne(null), null);
  assert.equal(resteDuDeLaLigne("0"), null);
  assert.equal(resteDuDeLaLigne("0.00"), null);
});

cas("les initiales : celles de l'import, une seule règle pour les deux écrans", () => {
  assert.equal(initialesDuClient("Mme Aubry"), "MA");
  assert.equal(initialesDuClient("M. Bernard"), "MB");
  assert.equal(initialesDuClient("Mairie de Saint-Sylvain"), "MS");
  assert.equal(initialesDuClient("Dupont"), "D");
  assert.equal(initialesDuClient("   "), "?");
});

cas("le nombre d'une porte : « Aucun », puis le chiffre", () => {
  assert.equal(compteDeLaPorte(0), "Aucun");
  assert.equal(compteDeLaPorte(1), "1");
  assert.equal(compteDeLaPorte(1250), "1 250".replace(" ", " "));
});

cas("« Vos entreprises » s'appelle « Vos partenaires »", () => {
  const m = MOTS_DE_LA_CATEGORIE.entreprise;
  assert.equal(m.titre, "Vos partenaires");
  assert.equal(m.un, "partenaire");
  assert.equal(m.des, "partenaires");
  assert.equal(m.aucun, "Aucun partenaire pour l'instant.");
});

console.log(`\n${echecs === 0 ? "✅ Tout est vert" : `❌ ${echecs} contrôle(s) rouge(s)`}`);
process.exit(echecs === 0 ? 0 : 1);
