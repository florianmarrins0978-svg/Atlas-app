// TOUTES LES IA D'ATLAS PARLENT DU MÊME MÉTIER.
//
// **Sa colère du 28 août 2026 :** *« ce que je veux, c'est que ce soit une
// intelligence artificielle qui rédige le devis. Si ici je te dis désherbage,
// tu vas comprendre qu'on parle d'espaces verts. Pourquoi dans une appli
// SPÉCIFIQUE pour l'espace vert elle comprend pas ? C'est pas logique ! »*
//
// **Il avait raison, et le défaut était structurel** : chaque service déclarait
// son propre métier — « artisans du bâtiment » pour l'assistant, « un artisan
// élagueur » pour le ticket, « un paysagiste » pour l'arrosage. Quatre métiers
// pour une application, dont un qui n'est pas le sien.
//
// Ce contrôle tient deux choses qu'aucun test de logique ne tient : que le
// métier soit dit PARTOUT, et qu'aucun service ne le redéclare à sa façon.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { METIER_ATLAS, METIER_ATLAS_COURT } from "../src/lib/metier-atlas";
import { construireIndiceDictee } from "../src/lib/vocabulaire-dictee";

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

const DOSSIER = "src/server/ai/services";

/**
 * Les services qui parlent au modèle DE SON TRAVAIL.
 *
 * Ceux qui n'y figurent pas ne s'adressent pas au métier — ils décrivent une
 * ALLURE de document, ou ils lisent un croquis dont la consigne dit déjà
 * « paysagiste » ligne à ligne. Les inscrire ici obligerait à répéter le métier
 * là où il n'apprend rien.
 */
const SERVICES_DU_METIER = [
  "assistant-service.ts",
  "extraction-service.ts",
  "coordonnees-service.ts",
  "lire-ticket.ts",
  "regarder-photo.ts",
];

test("LE MÉTIER EST DIT, et c'est bien l'espace vert", () => {
  assert.match(METIER_ATLAS, /ESPACES VERTS/);
  assert.match(METIER_ATLAS, /désherbage/i, "le mot de sa colère n'y est pas");
  assert.match(METIER_ATLAS_COURT, /ESPACES VERTS/);
});

test("AUCUNE IA D'ATLAS NE PARLE DU BÂTIMENT", () => {
  // C'est le mot exact qui a fait entendre « herbages » : on lui disait un
  // métier qui n'est pas le sien.
  const coupables: string[] = [];
  for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(`${DOSSIER}/${fichier}`, "utf8");
    // Uniquement dans ce qui PART au modèle : un commentaire qui raconte
    // l'histoire du défaut a le droit de nommer le bâtiment.
    const consignes = [...source.matchAll(/const (?:SYSTEME|CONSIGNE)[^=]*= `([\s\S]*?)`/g)].map((m) => m[1]);
    if (consignes.some((c) => /bâtiment/i.test(c))) coupables.push(fichier);
  }
  assert.deepEqual(coupables, [], `ces consignes annoncent le bâtiment : ${coupables.join(", ")}`);
});

test("CHAQUE SERVICE QUI PARLE MÉTIER PART DE LA MÊME PHRASE", () => {
  const sans: string[] = [];
  for (const fichier of SERVICES_DU_METIER) {
    const source = readFileSync(`${DOSSIER}/${fichier}`, "utf8");
    if (!/METIER_ATLAS/.test(source)) sans.push(fichier);
  }
  assert.deepEqual(sans, [], `ces services redéclarent le métier à leur façon : ${sans.join(", ")}`);
});

test("LA TRANSCRIPTION NE PEUT PLUS ÉCOUTER SANS SAVOIR", () => {
  /**
   * **Un indice posé chemin par chemin s'oublie sur le chemin suivant.** Deux
   * dictées ne l'avaient pas le 28 août au matin ; le fournisseur le pose
   * désormais lui-même quand personne ne lui en donne.
   */
  const source = readFileSync("src/server/ai/providers/transcription/openai.ts", "utf8");
  assert.match(
    source,
    /formData\.set\("prompt", indice\?\.trim\(\) \|\| construireIndiceDictee\(\)\)/,
    "le fournisseur peut encore transcrire sans le vocabulaire du métier"
  );
  assert.match(construireIndiceDictee(), /désherbage/i);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
if (failed > 0) process.exit(1);
