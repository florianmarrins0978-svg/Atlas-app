import assert from "node:assert";
import { MagasinLimiteMemoire } from "../src/server/rate-limit/memoire";

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function main() {
  await test("Sous la limite : toutes les tentatives sont autorisées", async () => {
    const magasin = new MagasinLimiteMemoire();
    for (let i = 0; i < 5; i++) {
      const r = await magasin.verifierEtIncrementer("cle-a", 5, 60_000);
      assert.equal(r.autorise, true);
    }
  });

  await test("Dépassement de la limite : la tentative suivante est refusée avec un délai positif", async () => {
    const magasin = new MagasinLimiteMemoire();
    for (let i = 0; i < 5; i++) {
      await magasin.verifierEtIncrementer("cle-b", 5, 60_000);
    }
    const r = await magasin.verifierEtIncrementer("cle-b", 5, 60_000);
    assert.equal(r.autorise, false);
    if (!r.autorise) assert.ok(r.retryAfterMs > 0);
  });

  await test("Expiration de fenêtre : après expiration, le compteur repart de zéro", async () => {
    const magasin = new MagasinLimiteMemoire();
    for (let i = 0; i < 3; i++) {
      await magasin.verifierEtIncrementer("cle-c", 3, 50);
    }
    const refuse = await magasin.verifierEtIncrementer("cle-c", 3, 50);
    assert.equal(refuse.autorise, false);

    await new Promise((r) => setTimeout(r, 80));
    const apresExpiration = await magasin.verifierEtIncrementer("cle-c", 3, 50);
    assert.equal(apresExpiration.autorise, true, "Une nouvelle fenêtre doit autoriser à nouveau");
  });

  await test("Isolation : deux clés différentes (deux entreprises/utilisateurs) ne partagent jamais leur compteur", async () => {
    const magasin = new MagasinLimiteMemoire();
    for (let i = 0; i < 5; i++) {
      await magasin.verifierEtIncrementer("entreprise-A", 5, 60_000);
    }
    const refuseA = await magasin.verifierEtIncrementer("entreprise-A", 5, 60_000);
    const autoriseB = await magasin.verifierEtIncrementer("entreprise-B", 5, 60_000);
    assert.equal(refuseA.autorise, false);
    assert.equal(autoriseB.autorise, true, "Une autre clé ne doit jamais être affectée par le compteur de A");
  });

  await test("Accès concurrent : la somme des tentatives autorisées ne dépasse jamais le maximum", async () => {
    const magasin = new MagasinLimiteMemoire();
    const resultats = await Promise.all(
      Array.from({ length: 10 }, () => magasin.verifierEtIncrementer("cle-concurrente", 4, 60_000))
    );
    const nbAutorisees = resultats.filter((r) => r.autorise).length;
    assert.equal(nbAutorisees, 4, "Exactement 4 tentatives sur 10 doivent être autorisées, jamais plus");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main();
