import assert from "node:assert";
import { MagasinLimiteRedis } from "../src/server/rate-limit/redis";

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

let magasin: MagasinLimiteRedis;

async function main() {
  magasin = new MagasinLimiteRedis(process.env.REDIS_URL_TEST ?? "redis://127.0.0.1:6379");

  await test("Redis réel : sous la limite, toutes les tentatives sont autorisées", async () => {
    const cle = `test-redis-${Date.now()}-a`;
    for (let i = 0; i < 5; i++) {
      const r = await magasin.verifierEtIncrementer(cle, 5, 60_000);
      assert.equal(r.autorise, true);
    }
  });

  await test("Redis réel : dépassement de la limite refusé avec un délai positif", async () => {
    const cle = `test-redis-${Date.now()}-b`;
    for (let i = 0; i < 5; i++) {
      await magasin.verifierEtIncrementer(cle, 5, 60_000);
    }
    const r = await magasin.verifierEtIncrementer(cle, 5, 60_000);
    assert.equal(r.autorise, false);
    if (!r.autorise) assert.ok(r.retryAfterMs > 0);
  });

  await test("Redis réel : expiration de fenêtre — le compteur repart de zéro", async () => {
    const cle = `test-redis-${Date.now()}-c`;
    for (let i = 0; i < 3; i++) {
      await magasin.verifierEtIncrementer(cle, 3, 300);
    }
    const refuse = await magasin.verifierEtIncrementer(cle, 3, 300);
    assert.equal(refuse.autorise, false);
    await new Promise((r) => setTimeout(r, 400));
    const apres = await magasin.verifierEtIncrementer(cle, 3, 300);
    assert.equal(apres.autorise, true);
  });

  await test("Redis réel : isolation entre deux clés distinctes (deux entreprises)", async () => {
    const cleA = `test-redis-${Date.now()}-entA`;
    const cleB = `test-redis-${Date.now()}-entB`;
    for (let i = 0; i < 5; i++) await magasin.verifierEtIncrementer(cleA, 5, 60_000);
    const refuseA = await magasin.verifierEtIncrementer(cleA, 5, 60_000);
    const autoriseB = await magasin.verifierEtIncrementer(cleB, 5, 60_000);
    assert.equal(refuseA.autorise, false);
    assert.equal(autoriseB.autorise, true);
  });

  await test("Redis réel : accès concurrent — le compteur atomique (INCR) ne dépasse jamais la limite", async () => {
    const cle = `test-redis-${Date.now()}-concurrent`;
    const resultats = await Promise.all(
      Array.from({ length: 10 }, () => magasin.verifierEtIncrementer(cle, 4, 60_000))
    );
    const nbAutorisees = resultats.filter((r) => r.autorise).length;
    assert.equal(nbAutorisees, 4, "Exactement 4 sur 10, jamais plus — atomicité réelle de Redis INCR");
  });

  // ─── RENDRE — ce qu'un geste RÉUSSI ne doit pas consommer ────────────────
  //
  // Le défaut du 17 septembre 2026 : cinq connexions réussies depuis un même
  // wifi, et la sixième était mise dehors avec le bon mot de passe. Les trois
  // cas ci-dessous tiennent le remède ET ses deux pièges.

  await test("Redis réel : rendre libère une place, et la fenêtre repart intacte", async () => {
    const cle = `test-redis-${Date.now()}-rendre`;
    for (let i = 0; i < 5; i++) {
      assert.equal((await magasin.verifierEtIncrementer(cle, 5, 60_000)).autorise, true);
      await magasin.rendre(cle);
    }
    // Cinq entrées rendues : la sixième passe encore, et les cinq suivantes aussi.
    for (let i = 0; i < 5; i++) {
      assert.equal(
        (await magasin.verifierEtIncrementer(cle, 5, 60_000)).autorise,
        true,
        "un geste réussi consomme encore le quota"
      );
    }
  });

  await test("Redis réel : rendre une clé ABSENTE ne fabrique pas un compteur immortel", async () => {
    const cle = `test-redis-${Date.now()}-absente`;
    await magasin.rendre(cle);
    // `DECR` sur une clé absente la créerait à −1, SANS expiration : le seuil
    // ne se viderait alors plus jamais. On vérifie qu'elle n'existe pas.
    const client = new (await import("ioredis")).default(
      process.env.REDIS_URL_TEST ?? "redis://127.0.0.1:6379"
    );
    const existe = await client.exists(`ratelimit:${cle}`);
    await client.quit();
    assert.equal(existe, 0, "rendre a créé une clé là où il n'y en avait pas");
  });

  await test("Redis réel : rendre plus qu'on n'a pris ne descend jamais sous zéro", async () => {
    const cle = `test-redis-${Date.now()}-plancher`;
    await magasin.verifierEtIncrementer(cle, 3, 60_000);
    for (let i = 0; i < 5; i++) await magasin.rendre(cle);
    // Le seuil reste entier : trois essais, pas huit.
    for (let i = 0; i < 3; i++) {
      assert.equal((await magasin.verifierEtIncrementer(cle, 3, 60_000)).autorise, true);
    }
    assert.equal(
      (await magasin.verifierEtIncrementer(cle, 3, 60_000)).autorise,
      false,
      "rendre en trop a creusé un crédit : le seuil ne protège plus"
    );
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await magasin.fermer();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await magasin.fermer();
  process.exit(1);
});
