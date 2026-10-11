import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DUREE_APPUI_MS, vibrer } from "../src/lib/vibration";

/**
 * Le retour vibrant du 31 août 2026, éprouvé sans navigateur.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE PEUT DIRE, ET CE QU'ELLE NE PEUT PAS.**
 *
 * Elle prouve que l'appel PART, avec la bonne durée, et qu'il ne casse jamais
 * le geste qu'il accompagne. Elle ne prouve **pas** que le téléphone bouge :
 * aucun code, ici ou ailleurs, n'a d'accusé de réception sur un vibreur — et
 * c'est précisément cette confusion qui a coûté trois allers-retours au patron
 * le 31 août (`ARCHITECTURE.md` §222). Une planche comptait des « vibrations »
 * là où elle comptait des appels, et rendait un vert rassurant sur une
 * fonction morte.
 *
 * **Le cas qui compte le plus est le troisième**, et c'est le seul qui puisse
 * lui coûter quelque chose : sur un navigateur qui refuse, le devis doit se
 * créer quand même. Un agrément qui empêche un geste est pire que pas
 * d'agrément.
 */

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs += 1;
    console.error(`  ✗ ${nom}`);
    console.error(`     ${(e as Error).message}`);
  }
}

/** Pose un `navigator` d'emprunt le temps d'un cas, et le retire ensuite. */
function avecNavigateur(vibrate: unknown, fn: () => void) {
  const global = globalThis as { navigator?: unknown };
  const avant = Object.getOwnPropertyDescriptor(global, "navigator");
  Object.defineProperty(global, "navigator", { value: { vibrate }, configurable: true });
  try {
    fn();
  } finally {
    if (avant) Object.defineProperty(global, "navigator", avant);
    else delete global.navigator;
  }
}

console.log("\nLe retour vibrant");

cas("il part, avec la durée du milieu de sa planche", () => {
  const recu: number[] = [];
  avecNavigateur((ms: number) => (recu.push(ms), true), () => vibrer());
  assert.deepEqual(recu, [DUREE_APPUI_MS]);
  assert.equal(DUREE_APPUI_MS, 14, "la durée annoncée dans le module a changé sans être redite ici");
});

cas("une durée demandée est celle qui part", () => {
  const recu: number[] = [];
  avecNavigateur((ms: number) => (recu.push(ms), true), () => vibrer(22));
  assert.deepEqual(recu, [22]);
});

cas("un navigateur sans vibreur ne fait rien, et ne lève pas", () => {
  avecNavigateur(undefined, () => vibrer());
  // Aucune assertion à faire : ne pas lever EST le contrat. C'est le cas
  // d'iPhone dans Safari, donc celui du patron aujourd'hui.
});

cas("un vibreur qui lève ne casse pas le geste", () => {
  avecNavigateur(() => {
    throw new Error("refusé par le navigateur");
  }, () => vibrer());
});

cas("sans navigateur du tout — le rendu côté serveur — il ne se passe rien", () => {
  const global = globalThis as { navigator?: unknown };
  const avant = Object.getOwnPropertyDescriptor(global, "navigator");
  delete global.navigator;
  try {
    vibrer();
  } finally {
    if (avant) Object.defineProperty(global, "navigator", avant);
  }
});

// ── Le geste du patron, pas la fonction qu'on vient d'écrire ───────────────
// `CLAUDE.md` §5 quater : un contrôle qui entre par une porte de service ne dit
// rien de la porte d'entrée. Ici, la porte d'entrée est le bouton « Créer un
// devis » de l'écran d'accueil — c'est LUI qu'il a demandé, et c'est le seul.
cas("l'écran d'accueil appelle bien le retour sur « Créer un devis »", () => {
  const source = readFileSync(
    path.join(__dirname, "..", "src", "app", "EcranChantiers.tsx"),
    "utf8"
  );
  assert.ok(
    source.includes('import { vibrer } from "@/lib/vibration";'),
    "l'écran n'importe plus la règle : le retour ne peut plus partir"
  );
  const clic = source.slice(source.indexOf('data-atlas="nouveau-chantier"'));
  const finDuClic = clic.indexOf("}}");
  assert.ok(
    clic.slice(0, finDuClic).includes("vibrer()"),
    "le retour n'est plus appelé dans le clic du bouton « Créer un devis »"
  );
});

console.log("");
if (echecs) {
  console.error(`✗ ${echecs} cas en échec`);
  process.exit(1);
}
console.log(
  "✓ Le retour part avec la bonne durée, et ne casse jamais le geste — même quand le navigateur n'en veut pas. Qu'il se SENTE ne se vérifie que sur un téléphone."
);
