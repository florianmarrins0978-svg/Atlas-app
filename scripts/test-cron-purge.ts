import assert from "node:assert";

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
  await test("Sans secret : rejeté (401)", async () => {
    const r = await fetch("http://localhost:3000/api/cron/purge-fichiers", { method: "POST" });
    assert.equal(r.status, 401);
  });

  await test("Secret invalide : rejeté (401)", async () => {
    const r = await fetch("http://localhost:3000/api/cron/purge-fichiers", {
      method: "POST",
      headers: { "x-cron-secret": "mauvais-secret-totalement-invalide" },
    });
    assert.equal(r.status, 401);
  });

  await test("Route accessible sans authentification de session (le middleware ne redirige jamais vers /login)", async () => {
    const r = await fetch("http://localhost:3000/api/cron/purge-fichiers", { method: "POST", redirect: "manual" });
    assert.notEqual(r.status, 307, "Ne doit jamais rediriger vers /login — c'est la vérification de secret qui doit répondre");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
