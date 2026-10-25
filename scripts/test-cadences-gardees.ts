// Les cadences que l'audit d'août a posées, tenues par un contrôle.
//
// **Ce que cette suite comble** (audit du 25 octobre 2026) : trois protections
// étaient dans le code, et aucun test ne rougissait si on les retirait. La
// cadence de l'import de tarifs (un `.xlsx` est une archive qu'on décompresse),
// celle du croquis (chaque appel part chez un fournisseur de vision, et se
// paie), et la règle du seuil par source sur la réponse au devis.
//
// Ni base, ni réseau.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { seuilsDeLaReponseAuDevis } from "../src/lib/seuils-reponse-devis";
import { SOURCE_NON_ETABLIE } from "../src/lib/source-visiteur";

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

/** Le code sans ses commentaires, qui citent les gestes pour dire pourquoi. */
function code(fichier: string): string {
  return readFileSync(path.join(__dirname, "..", fichier), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/** La cadence est-elle posée AVANT le geste coûteux, dans le même fichier ? */
function cadenceAvant(fichier: string, cle: string, geste: string) {
  const c = code(fichier);
  const iCadence = c.indexOf(`verifierLimite(\`${cle}`);
  const iGeste = c.indexOf(geste);
  assert.ok(iCadence >= 0, `${fichier} : la cadence « ${cle} » a disparu`);
  assert.ok(iGeste >= 0, `${fichier} : « ${geste} » introuvable, le contrôle ne mesure plus rien`);
  assert.ok(iCadence < iGeste, `${fichier} : la cadence « ${cle} » arrive APRÈS « ${geste} », elle ne borne plus rien`);
}

console.log("=== Les cadences gardées ===\n");

essai("l'import de tarifs : la cadence passe AVANT la décompression", () => {
  cadenceAvant("src/app/reglages/actions.ts", "import-tarifs:", "lireFichierTarifs(");
});

essai("le croquis : la cadence passe AVANT la porte des images et l'appel de vision", () => {
  cadenceAvant("src/app/paysage/arrosage/actions.ts", "croquis:", "preparerPhotoEntrante(");
});

essai("réponse au devis, source ÉTABLIE : le seuil du lien ET celui de la source", () => {
  const seuils = seuilsDeLaReponseAuDevis("jeton-a", "ip:203.0.113.7");
  assert.deepEqual(seuils.map((s) => s.quel), ["jeton", "source"]);
  assert.equal(seuils[1].cle, "reponse-devis:source:ip:203.0.113.7");
});

essai("réponse au devis, source NON établie : le seuil du lien SEUL, jamais un seau commun", () => {
  // Sinon soixante appels d'où que ce soit bloqueraient tous les clients de
  // tous les artisans (la leçon de F9).
  const seuils = seuilsDeLaReponseAuDevis("jeton-a", SOURCE_NON_ETABLIE);
  assert.deepEqual(seuils.map((s) => s.quel), ["jeton"]);
});

essai("le seuil du lien ne dépend jamais de la source", () => {
  assert.equal(seuilsDeLaReponseAuDevis("jeton-a", SOURCE_NON_ETABLIE)[0].cle, "reponse-devis:jeton-a");
  assert.equal(seuilsDeLaReponseAuDevis("jeton-a", "ip:1.2.3.4")[0].cle, "reponse-devis:jeton-a");
});

essai("l'action de réponse au devis emploie bien la règle", () => {
  assert.match(code("src/app/devis/[jeton]/actions.ts"), /seuilsDeLaReponseAuDevis\(/);
});

console.log(`\nCadences gardées — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
