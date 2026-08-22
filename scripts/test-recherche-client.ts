import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  normaliserPourRecherche,
  filtrerClientsParNom,
  aucunClientTrouve,
} from "../src/lib/recherche-client";

// **Retrouver un client en tapant son nom.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 20 août 2026, capture à l'appui : *« Il faut une barre de
// recherche où je peux taper le nom d'un client pour le retrouver plus
// facilement »*. Sa liste porte **vingt et un noms**, dont **quatre Martins**,
// et le nom qu'il cherche est quelque part au milieu.
//
// Les cas ci-dessous ne sont pas inventés : ils sont recopiés de sa capture —
// « M. Moreau (test) », « Mme Renard (test) », « Monsieur Martins », « Martins »,
// « Bernard ». C'est sur ceux-là que la recherche doit tomber juste, pas sur un
// corpus de laboratoire.
//
// **Et le dernier cas est celui qui compte le plus.** La règle vit dans
// `src/lib/recherche-client.ts` et l'écran s'en sert sans la réécrire
// (`CLAUDE.md` §3). Un contrôle le vérifie : le jour où quelqu'un remettra un
// `.toLowerCase().includes(...)` dans `ListeClients.tsx`, la recherche cessera
// silencieusement de trouver « Moréau » quand on tape « moreau », et aucune
// autre suite ne le verrait.

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

/** Sa liste, telle qu'elle est sur sa capture du 20 août 2026. */
const SES_CLIENTS = [
  { nom: "M. Moreau (test)" },
  { nom: "Martins" },
  { nom: "Martins" },
  { nom: "Bernard" },
  { nom: "Martins" },
  { nom: "Mme Renard (test)" },
  { nom: "Monsieur Martins" },
];

console.log("=== Chercher un client par son nom ===\n");

cas("une saisie vide rend TOUT — sinon l'écran s'ouvre sur une page blanche", () => {
  assert.equal(filtrerClientsParNom(SES_CLIENTS, "").length, SES_CLIENTS.length);
  assert.equal(filtrerClientsParNom(SES_CLIENTS, "   ").length, SES_CLIENTS.length);
});

cas("« martins » trouve les quatre Martins de sa liste", () => {
  const trouves = filtrerClientsParNom(SES_CLIENTS, "martins");
  assert.equal(trouves.length, 4, `${trouves.length} trouvés au lieu de quatre`);
});

cas("la casse ne décide de rien : « MARTINS », « martins », « Martins »", () => {
  for (const frappe of ["MARTINS", "martins", "Martins", "mArTiNs"]) {
    assert.equal(filtrerClientsParNom(SES_CLIENTS, frappe).length, 4, `« ${frappe} » n'a pas trouvé les quatre`);
  }
});

cas("le nom cherché n'est pas au début : « renard » trouve « Mme Renard »", () => {
  const trouves = filtrerClientsParNom(SES_CLIENTS, "renard");
  assert.deepEqual(
    trouves.map((c) => c.nom),
    ["Mme Renard (test)"]
  );
});

cas("il tape sans accent : « moreau » trouve « Moréau »", () => {
  // Un artisan entre deux chantiers ne maintient pas la touche « e » de son
  // téléphone pour trouver son client.
  const trouves = filtrerClientsParNom([{ nom: "Moréau" }, { nom: "Bernard" }], "moreau");
  assert.deepEqual(
    trouves.map((c) => c.nom),
    ["Moréau"]
  );
});

cas("« M. Dupont », « M Dupont » et « Mr. Dupont » se trouvent tous en tapant « dupont »", () => {
  const liste = [{ nom: "M. Dupont" }, { nom: "M Dupont" }, { nom: "Mr. Dupont" }, { nom: "Bernard" }];
  assert.equal(filtrerClientsParNom(liste, "dupont").length, 3);
});

cas("l'ordre des mots ne compte pas : « martins monsieur » comme « monsieur martins »", () => {
  for (const frappe of ["monsieur martins", "martins monsieur"]) {
    const trouves = filtrerClientsParNom(SES_CLIENTS, frappe);
    assert.deepEqual(
      trouves.map((c) => c.nom),
      ["Monsieur Martins"],
      `« ${frappe} » n'a pas trouvé le bon`
    );
  }
});

cas("un nom qui n'existe pas ne rend RIEN — le contrôle qui empêche de tout rendre", () => {
  // Sans ce cas, une recherche qui rendrait toujours la liste entière passerait
  // pour correcte : elle « trouve » toujours le client cherché.
  assert.equal(filtrerClientsParNom(SES_CLIENTS, "lefebvre").length, 0);
});

cas("le message d'échec CITE ce qu'il a tapé — la faute de frappe se voit", () => {
  const dit = aucunClientTrouve("  martns ");
  assert.match(dit, /martns/, "le message ne cite pas la frappe : « aucun résultat » laisse croire à une panne");
});

cas("la ponctuation ne sépare pas : « (test) » n'empêche pas de trouver Moreau", () => {
  assert.equal(normaliserPourRecherche("M. Moreau (test)").includes("moreau"), true);
  assert.equal(filtrerClientsParNom(SES_CLIENTS, "moreau").length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// **L'écran n'a pas le droit de refaire la règle.**
cas("ListeClients.tsx emploie la règle partagée, et n'en réécrit pas une seconde", () => {
  const ecran = readFileSync(
    path.join(__dirname, "..", "src", "app", "clients", "ListeClients.tsx"),
    "utf8"
  );
  assert.match(
    ecran,
    /filtrerClientsParNom/,
    "l'écran n'appelle plus la règle partagée : il en a donc une à lui, qui divergera"
  );
  assert.doesNotMatch(
    ecran,
    /\.toLowerCase\(\)\s*\.includes\(/,
    "l'écran refait un filtre à la main : « moreau » cessera de trouver « Moréau » sans que rien ne le dise"
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Recherche de client — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
