// L'onglet allumé dans la barre du bas — le défaut relevé sur la planche
// `appli/catalogue-les-mots.html`, validée par le patron le 11 octobre 2026.
//
// Sur le catalogue, c'est « Chantiers » qui était souligné alors qu'on y arrive
// depuis les Réglages : son adresse est /catalogue, pas /reglages/…, aucun
// onglet ne la revendiquait, et la barre retombait sur le premier. La barre
// déclare désormais, onglet par onglet, les adresses qu'il possède en plus de
// la sienne ; ce contrôle le tient.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ongletActif } from "../src/lib/onglet-actif";

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

// La forme de la barre réelle, possessions comprises. Le dernier essai vérifie
// que le composant déclare bien la même chose.
const ONGLETS = [
  { href: "/" },
  { href: "/planning" },
  { href: "/termines" },
  { href: "/paysage" },
  { href: "/reglages", possede: ["/catalogue"] },
];
const REGLAGES = 4;

essai("le catalogue allume « Réglages », pas « Chantiers »", () => {
  assert.equal(ongletActif("/catalogue", ONGLETS), REGLAGES);
});

essai("l'accueil reste « Chantiers »", () => {
  assert.equal(ongletActif("/", ONGLETS), 0);
});

essai("une fiche chantier, que personne ne revendique, retombe sur « Chantiers »", () => {
  assert.equal(ongletActif("/chantiers/abc", ONGLETS), 0);
});

essai("les écrans sous /reglages restent à « Réglages »", () => {
  assert.equal(ongletActif("/reglages/tarifs", ONGLETS), REGLAGES);
});

essai("les autres onglets ne bougent pas", () => {
  assert.equal(ongletActif("/planning", ONGLETS), 1);
  assert.equal(ongletActif("/termines", ONGLETS), 2);
  assert.equal(ongletActif("/paysage/arrosage", ONGLETS), 3);
});

essai("le filtre par rôle garde la possession avec son onglet", () => {
  // Un salarié ne voit que Planning et Réglages : l'index se calcule sur la
  // liste filtrée, la possession doit donc voyager avec l'onglet.
  const salarie = ONGLETS.filter((o) => o.href === "/planning" || o.href === "/reglages");
  assert.equal(ongletActif("/catalogue", salarie), 1);
});

essai("la barre du bas déclare /catalogue sur « Réglages » et lit cette déclaration", () => {
  const nav = readFileSync(new URL("../src/components/atlas/AtlasBottomNav.tsx", import.meta.url), "utf8");
  assert.ok(
    /href: "\/reglages", label: "Réglages", possede: \["\/catalogue"\]/.test(nav),
    "l'onglet Réglages de AtlasBottomNav ne possède plus /catalogue : le trait retombera sous Chantiers"
  );
  assert.ok(/ongletActif\(pathname, onglets\)/.test(nav), "AtlasBottomNav ne choisit plus l'onglet par ongletActif");
});

if (echecs > 0) {
  console.log(`\n${echecs} essai(s) en échec`);
  process.exit(1);
}
console.log("\nOnglet actif : tout est vert");
