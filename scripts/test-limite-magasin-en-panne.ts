// Un limiteur en panne enferme-t-il le patron dehors ?
//
// **Le 12 août 2026 :** *« ça ne marche pas, je n'arrive pas à me connecter.
// Occupe-toi-en, moi je ne peux pas le faire. »* Redis était tombé sur son
// espace. `verifierLimite` levait alors `MaxRetriesPerRequestError`, l'action de
// connexion mourait avec — et l'écran restait sur la page de connexion, **sans
// un mot**. Rien ne pouvait lui dire que ce n'était ni son mot de passe ni son
// compte, mais un service annexe couché.
//
// La limitation protège d'un ABUS. Refuser tout le monde quand son magasin
// tombe, ce n'est pas protéger : c'est infliger soi-même la panne dont on se
// protégeait, et la première victime est celui qui a le droit d'entrer.
//
// Ce contrôle tient les deux moitiés de la décision : **on laisse passer**, et
// **on le dit fort** dans le journal — car pendant ce temps la protection
// contre les rafales n'existe plus, et cela ne doit surtout pas être silencieux.

import assert from "node:assert/strict";
import {
  verifierLimite,
  _forcerMagasinPourTests,
  _reinitialiserMagasinPourTests,
} from "../src/server/rate-limit";
import type { MagasinLimite } from "../src/server/rate-limit/types";

let echecs = 0;
function cas(nom: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${nom}`))
    .catch((e: Error) => {
      echecs++;
      console.log(`  ✗ ${nom}`);
      console.log(`    ${e.message}`);
    });
}

/** Un magasin qui tombe exactement comme ioredis quand le service est mort. */
class MagasinEnPanne implements MagasinLimite {
  async verifierEtIncrementer(): Promise<never> {
    const erreur = new Error("Reached the max retries per request limit (which is 1).");
    erreur.name = "MaxRetriesPerRequestError";
    throw erreur;
  }
}

/** Un magasin qui refuse tout : la limite est bel et bien atteinte. */
class MagasinQuiRefuse implements MagasinLimite {
  async verifierEtIncrementer() {
    return { autorise: false as const, retryAfterMs: 42_000 };
  }
}

async function main() {
  console.log("=== Le limiteur en panne ne met personne dehors ===");

  await cas("magasin injoignable : la demande PASSE au lieu d'échouer", async () => {
    _forcerMagasinPourTests(new MagasinEnPanne());
    const resultat = await verifierLimite("connexion:demo@atlas.local", { max: 5, fenetreMs: 900_000 });
    assert.equal(
      resultat.autorise,
      true,
      "le magasin est tombé et la demande a été refusée : c'est la panne du 12 août, " +
        "où le patron s'est retrouvé enfermé dehors de sa propre application"
    );
  });

  await cas("magasin injoignable : rien n'est levé vers l'appelant", async () => {
    // Le point exact où ça cassait : l'exception traversait l'action serveur,
    // que Next remplace en production par un identifiant opaque. Le patron ne
    // voyait donc RIEN — ni la cause, ni même qu'il y avait une cause.
    _forcerMagasinPourTests(new MagasinEnPanne());
    await verifierLimite("televersement:entreprise", { max: 3, fenetreMs: 60_000 });
  });

  await cas("magasin injoignable : le journal le DIT, il ne se tait pas", async () => {
    // Laisser passer en silence serait échanger une panne visible contre une
    // faille invisible. La trace est tout ce qui reste pour nommer la cause.
    _forcerMagasinPourTests(new MagasinEnPanne());
    const dit: string[] = [];
    const avant = console.error;
    console.error = (...args: unknown[]) => {
      dit.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
    try {
      await verifierLimite("connexion:demo@atlas.local", { max: 5, fenetreMs: 900_000 });
    } finally {
      console.error = avant;
    }
    assert.ok(dit.length > 0, "la panne du magasin n'a laissé aucune trace dans le journal");
    assert.match(
      dit.join(" "),
      /limite/i,
      "la trace ne nomme pas la limitation : elle enverra chercher ailleurs"
    );
  });

  await cas("magasin en bonne santé : une limite atteinte REFUSE toujours", async () => {
    // Le garde-fou du garde-fou : en laissant passer les pannes, on ne doit pas
    // avoir laissé passer les refus légitimes.
    _forcerMagasinPourTests(new MagasinQuiRefuse());
    const resultat = await verifierLimite("connexion:demo@atlas.local", { max: 5, fenetreMs: 900_000 });
    assert.equal(resultat.autorise, false, "la limitation ne refuse plus rien : elle ne sert plus à rien");
    if (!resultat.autorise) {
      assert.equal(resultat.retryAfterSecondes, 42);
    }
  });

  _reinitialiserMagasinPourTests();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Limiteur en panne — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

void main();
