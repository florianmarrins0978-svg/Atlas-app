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
  await test("Liveness : renvoie 200 sans dépendre de PostgreSQL", async () => {
    const r = await fetch("http://localhost:3000/api/health/live");
    assert.equal(r.status, 200);
    const corps = await r.json();
    assert.equal(corps.statut, "vivant");
  });

  await test("Readiness : renvoie 200 quand PostgreSQL est disponible", async () => {
    const r = await fetch("http://localhost:3000/api/health/ready");
    assert.equal(r.status, 200);
    const corps = await r.json();
    assert.equal(corps.statut, "pret");
    assert.equal(corps.dependances.base_de_donnees, "ok");
  });

  await test("Readiness : ne fuit aucun secret ni URL de connexion dans la réponse", async () => {
    const r = await fetch("http://localhost:3000/api/health/ready");
    const texte = await r.text();
    assert.ok(!texte.includes("postgresql://"), "L'URL de connexion ne doit jamais apparaître dans la réponse");
    assert.ok(!/password|secret/i.test(texte), "Aucun secret ne doit apparaître dans la réponse");
  });

  await test("Les routes de santé sont accessibles sans authentification (non bloquées par le middleware)", async () => {
    const rLive = await fetch("http://localhost:3000/api/health/live", { redirect: "manual" });
    const rReady = await fetch("http://localhost:3000/api/health/ready", { redirect: "manual" });
    assert.notEqual(rLive.status, 307);
    assert.notEqual(rReady.status, 307);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
