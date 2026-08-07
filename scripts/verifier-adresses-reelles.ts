import assert from "node:assert/strict";
import { chercherAdresses } from "../src/server/adresses/base-adresse-nationale";

// **Le vrai service, à sa vraie adresse.**
//
// Joué par `.github/workflows/adresses.yml`, jamais par la batterie locale : le
// mandataire réseau de l'environnement de développement refuse
// `api-adresse.data.gouv.fr`. Prétendre le vérifier là-bas serait mentir ; ne
// rien vérifier du tout laisserait l'aide à la saisie s'éteindre en silence le
// jour où le service change de forme — la liste resterait simplement vide, ce
// qui ressemble à « aucune adresse ne correspond ».
//
// Ce contrôle ne juge PAS notre code : il est déjà éprouvé face à un service de
// remplacement (`scripts/test-recherche-adresse.ts`). Il juge **l'accord entre
// ce que le service rend et ce que nous croyons qu'il rend**.
//
// Il échoue donc volontiers, et c'est voulu : un service public peut être en
// maintenance. Une exécution rouge dit « allez voir », pas « le produit est
// cassé ». Le message le dit.

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== La Base Adresse Nationale, interrogée pour de vrai ===\n");

  await cas("une adresse connue de tous revient, entière", async () => {
    const r = await chercherAdresses("20 rue de la paix 75002");
    assert.ok(
      r.ok,
      `Le service n'a pas répondu (${r.ok === false ? r.raison : ""}). Maintenance, coupure, ou point d'entrée déplacé : à vérifier sur adresse.data.gouv.fr avant de toucher au code.`
    );
    assert.ok(r.suggestions.length > 0, "Le service répond, mais ne propose rien pour une adresse parisienne connue.");

    const premiere = r.suggestions[0].libelle;
    assert.match(
      premiere,
      /75002/,
      `L'adresse rendue ne porte plus son code postal : « ${premiere} ». Le champ « label » a changé de contenu, et le patron devrait retaper la fin de chaque adresse.`
    );
    assert.match(premiere, /Paris/i, `L'adresse rendue ne porte plus sa commune : « ${premiere} ».`);
  });

  await cas("le mode « frappe en cours » complète un mot inachevé", async () => {
    // C'est LE mode dont dépend le geste décrit par le patron : proposer avant
    // que le mot soit fini. S'il disparaissait, la liste n'apparaîtrait qu'une
    // fois l'adresse presque entièrement tapée — donc trop tard pour servir.
    const r = await chercherAdresses("20 rue de la pai");
    assert.ok(r.ok, "Le service n'a pas répondu à une recherche en cours de frappe.");
    assert.ok(
      r.suggestions.length > 0,
      "Plus aucune proposition sur un mot inachevé : le mode « autocomplete » ne fait plus son office, et la liste arriverait trop tard."
    );
  });

  await cas("le département accompagne l'adresse", async () => {
    // Sans lui, deux rues du même nom sont indiscernables — le cas exact que le
    // patron a décrit : Paris et Mantes-la-Jolie.
    const r = await chercherAdresses("rue de la paix");
    assert.ok(r.ok, "Le service n'a pas répondu.");
    assert.ok(
      r.suggestions.some((s) => s.contexte),
      "Aucune proposition ne porte son département : deux rues homonymes deviendraient impossibles à départager."
    );
  });

  console.log(
    `\n${echecs === 0 ? "✅" : "❌"} Base Adresse Nationale — ${echecs} écart(s) entre ce que le service rend et ce qu'Atlas attend.`
  );
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
