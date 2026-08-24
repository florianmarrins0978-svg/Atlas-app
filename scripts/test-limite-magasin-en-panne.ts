// Quand le magasin de limitation ne répond plus — ce qui reste debout.
//
// **CE QUE CETTE SUITE PROTÈGE, ET LE DÉFAUT QU'ELLE FERME.**
//
// Le 12 août 2026, Redis est tombé sur l'espace du patron. `verifierLimite`
// levait, l'action de connexion mourait avec, et l'écran restait muet : il ne
// pouvait pas savoir que ce n'était ni son mot de passe ni son compte. La
// réparation d'alors laissait passer TOUT LE MONDE — juste dans son intention,
// trop loin dans sa conclusion.
//
// L'audit du 23 août 2026 (constat C1) l'a relevée : il suffisait d'attendre
// une panne de Redis pour n'avoir plus aucune limite du tout. Le troisième
// terme était pourtant déjà dans le dépôt — le magasin en mémoire.
//
// **Le premier cas ci-dessous rougirait sur l'ancien code**, où le magasin en
// panne rendait `autorise: true` indéfiniment.
//
// Éprouvée sans Redis et sans base : deux magasins et un compteur.

import assert from "node:assert/strict";
import { verifierLimite, _forcerMagasinPourTests, _reinitialiserMagasinPourTests } from "../src/server/rate-limit";
import type { MagasinLimite, ResultatLimite } from "../src/server/rate-limit/types";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Un magasin qui ne répond jamais — Redis couché, exactement. */
class MagasinEnPanne implements MagasinLimite {
  appels = 0;
  async verifierEtIncrementer(): Promise<ResultatLimite> {
    this.appels++;
    throw new Error("MaxRetriesPerRequestError: Reached the max retries per request limit");
  }
}

const LIMITE = { max: 3, fenetreMs: 60_000 };

async function main() {
  console.log("=== Le magasin de limitation en panne ===\n");

  await essai("magasin couché : la protection tient quand même, sur le compteur mémoire", async () => {
    _reinitialiserMagasinPourTests();
    const panne = new MagasinEnPanne();
    _forcerMagasinPourTests(panne);

    const verdicts = [];
    for (let i = 0; i < 6; i++) {
      verdicts.push((await verifierLimite("panne:essai", LIMITE)).autorise);
    }

    // Sur l'ancien code, les six valaient `true` : plus aucune limite.
    assert.deepEqual(verdicts, [true, true, true, false, false, false]);
    assert.equal(panne.appels, 6, "le magasin principal n'est plus interrogé");
  });

  await essai("…et personne n'est enfermé dehors : les premiers essais passent", async () => {
    _reinitialiserMagasinPourTests();
    _forcerMagasinPourTests(new MagasinEnPanne());
    // Le point qui a coûté la soirée du 12 août : celui qui a le droit d'entrer
    // doit entrer. Un `false` dès le premier appel serait la panne qu'on
    // s'inflige à soi-même.
    assert.equal((await verifierLimite("panne:premier", LIMITE)).autorise, true);
  });

  await essai("le secours compte SÉPARÉMENT pour chaque clé", async () => {
    _reinitialiserMagasinPourTests();
    _forcerMagasinPourTests(new MagasinEnPanne());
    for (let i = 0; i < 4; i++) await verifierLimite("panne:compte-a", LIMITE);
    // Le voisin ne doit pas payer pour lui — c'est la faute du 6 août 2026,
    // sous une autre forme.
    assert.equal((await verifierLimite("panne:compte-b", LIMITE)).autorise, true);
  });

  await essai("le refus reste lisible : un délai, jamais une exception", async () => {
    _reinitialiserMagasinPourTests();
    _forcerMagasinPourTests(new MagasinEnPanne());
    for (let i = 0; i < 3; i++) await verifierLimite("panne:message", LIMITE);
    const refus = await verifierLimite("panne:message", LIMITE);
    assert.equal(refus.autorise, false);
    if (!refus.autorise) {
      assert.ok(refus.retryAfterSecondes > 0, "aucun délai à annoncer à l'artisan");
      assert.ok(refus.message.length > 10, "aucune phrase à afficher");
    }
  });

  // ─── Ce que l'ancienne version de cette suite tenait, et qui vaut TOUJOURS ──
  //
  // Ce fichier éprouvait, depuis le 12 août 2026, la décision de laisser tout
  // passer. Ce lot-ci change cette décision — mais deux de ses contrôles ne
  // portaient pas sur elle, et les perdre aurait été une régression silencieuse.

  await essai("magasin injoignable : rien n'est levé vers l'appelant", async () => {
    // Le point exact où ça cassait le 12 août : l'exception traversait l'action
    // serveur, que Next remplace en production par un identifiant opaque. Le
    // patron ne voyait donc RIEN — ni la cause, ni même qu'il y avait une cause.
    _reinitialiserMagasinPourTests();
    _forcerMagasinPourTests(new MagasinEnPanne());
    await verifierLimite("panne:sans-exception", { max: 3, fenetreMs: 60_000 });
  });

  await essai("magasin injoignable : le journal le DIT, il ne se tait pas", async () => {
    // Basculer en silence serait échanger une panne visible contre un
    // comportement qu'on ne s'explique pas : les seuils ne comptent plus pareil
    // ce jour-là, et la trace est tout ce qui reste pour le savoir.
    _reinitialiserMagasinPourTests();
    _forcerMagasinPourTests(new MagasinEnPanne());
    const dit: string[] = [];
    const avant = console.error;
    console.error = (...args: unknown[]) => {
      dit.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
    try {
      await verifierLimite("panne:journal", { max: 5, fenetreMs: 900_000 });
    } finally {
      console.error = avant;
    }
    assert.ok(dit.length > 0, "la panne du magasin n'a laissé aucune trace dans le journal");
    assert.match(dit.join(" "), /limite/i, "la trace ne nomme pas la limitation : elle enverra chercher ailleurs");
    assert.match(dit.join(" "), /mémoire/i, "la trace ne dit pas sur quoi on a basculé");
  });

  await essai("le magasin revenu reprend la main", async () => {
    _reinitialiserMagasinPourTests();
    // Un magasin qui refuse tout : s'il est interrogé, on le verra.
    _forcerMagasinPourTests({
      async verifierEtIncrementer(): Promise<ResultatLimite> {
        return { autorise: false, retryAfterMs: 1_000 };
      },
    });
    assert.equal((await verifierLimite("panne:retour", LIMITE)).autorise, false);
  });

  _reinitialiserMagasinPourTests();
  console.log("");
  console.log(`Le magasin en panne — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main();
