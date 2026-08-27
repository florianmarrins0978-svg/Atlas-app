import assert from "node:assert/strict";
import { SYSTEME } from "../src/server/ai/services/extraction-service";
import { systeme as systemeRetouches } from "../src/server/ai/services/retouches-devis-service";
import { structureDeLaPrestation } from "../src/lib/prestation-structuree";

// **Les deux micros doivent demander la MÊME chose des unités.**
//
// Le produit a deux invites qui produisent des quantités : celle qui lit une
// dictée de chantier, et celle qui écoute quand il parle DANS son devis. Elles
// ne disaient pas la même chose — la seconde donnait des exemples d'unités
// métier (« stère », « arbre »), la première n'en donnait aucun.
//
// Ce n'est pas un détail de rédaction : l'unité décide de la multiplication par
// une quantité au moment du chiffrage. Deux consignes divergentes, c'est le même
// mot dicté qui devient une quantité par un micro et rien du tout par l'autre.
//
// ─── Ce que ces contrôles peuvent, et ce qu'ils NE peuvent pas ──────────────
//
// Ils tiennent le CONTRAT — ce que le produit demande au modèle, et ce que le
// code fait de sa réponse. **Ils ne prouvent rien de ce que le modèle répond
// vraiment** : cet environnement n'a aucune clé d'IA (`CLAUDE.md` §1 ter). Le
// contrôle réel est listé en fin de fichier et reste à jouer sur l'espace du
// patron, où les clés sont branchées.

let reussites = 0;
let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const RETOUCHES = systemeRetouches([], null);

console.log("\n=== Les deux invites disent la même chose des unités ===\n");

cas("les deux acceptent une unité de comptage prononcée", () => {
  for (const [nom, invite] of [
    ["l'extraction d'une dictée", SYSTEME],
    ["la dictée dans le devis", RETOUCHES],
  ] as const) {
    assert.match(invite, /souche/i, `${nom} ne donne aucun exemple d'objet compté`);
    assert.match(invite, /arbre/i, `${nom} ne donne aucun exemple d'objet compté`);
  }
});

cas("les deux exigent que l'objet compté soit PRONONCÉ", () => {
  // La borne qui empêche de transformer n'importe quel substantif en unité.
  for (const [nom, invite] of [
    ["l'extraction d'une dictée", SYSTEME],
    ["la dictée dans le devis", RETOUCHES],
  ] as const) {
    assert.match(invite, /explicitement prononcé/i, `${nom} n'exige pas que l'objet compté soit prononcé`);
  }
});

cas("les deux refusent une quantité sans son unité", () => {
  for (const [nom, invite] of [
    ["l'extraction d'une dictée", SYSTEME],
    ["la dictée dans le devis", RETOUCHES],
  ] as const) {
    assert.match(invite, /jamais l'une sans l'autre/i, `${nom} n'interdit pas la quantité orpheline`);
  }
});

console.log("\n=== La durée et l'équipe ne deviennent pas des quantités ===\n");

cas("l'extraction dit où vont « quatre journées » et « deux hommes »", () => {
  // Sans cette borne, « deux hommes » deviendrait une prestation de quantité 2,
  // et la taille d'équipe qui fait le prix au temps resterait vide.
  assert.match(SYSTEME, /dureePrevue/, "l'invite ne rappelle pas où va la durée");
  assert.match(SYSTEME, /tailleEquipe/, "l'invite ne rappelle pas où va l'équipe");
  assert.match(
    SYSTEME,
    /jamais dans la quantité d'une prestation/i,
    "rien n'interdit de faire de « deux hommes » une quantité de prestation"
  );
});

console.log("\n=== Ce que le code fait d'une unité de comptage ===\n");

cas("« deux souches » est gardé tel quel, unité comprise", () => {
  const s = structureDeLaPrestation({
    libelle: "Dessouchage",
    description: null,
    quantite: "2",
    unite: "souche",
    aConfirmer: false,
  });
  assert.equal(s.quantite, "2.00");
  assert.equal(s.unite, "souche", "l'unité de comptage a été normalisée ou perdue");
});

cas("un nombre dont on ne sait pas ce qu'il compte n'entre pas", () => {
  const s = structureDeLaPrestation({
    libelle: "Divers",
    description: null,
    quantite: "2",
    unite: null,
    aConfirmer: false,
  });
  assert.equal(s.quantite, null);
  assert.equal(s.unite, null);
});

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);

// ─── RESTE À ÉPROUVER AVEC UNE VRAIE CLÉ ───────────────────────────────────
//
// Ces six dictées doivent être jouées sur l'espace du patron, où les
// fournisseurs répondent — rien ici ne peut le faire :
//
//   « deux souches »                    -> quantite 2,    unite « souche »
//   « trois arbres »                    -> quantite 3,    unite « arbre »
//   « quatre journées »                 -> dureePrevue, PAS une quantité
//   « deux hommes »                     -> tailleEquipe, PAS une quantité
//   « huit cents mètres linéaires »     -> quantite 800,  unite « ml »
//   « mille deux cents mètres carrés »  -> quantite 1200, unite « m² »
console.log(
  "\n⚠ Le comportement réel du modèle sur ces six dictées reste à éprouver sur\n" +
    "  un espace avec les clés d'IA branchées — aucun contrôle d'ici ne le prouve."
);

if (echecs > 0) process.exitCode = 1;
