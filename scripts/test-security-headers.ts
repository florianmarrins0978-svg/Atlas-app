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
  const r = await fetch("http://localhost:3000/login");

  await test("Content-Security-Policy est présent et restrictif (default-src 'self')", async () => {
    const csp = r.headers.get("content-security-policy");
    assert.ok(csp, "CSP absent");
    assert.ok(csp!.includes("default-src 'self'"));
    assert.ok(csp!.includes("object-src 'none'"));
    assert.ok(csp!.includes("frame-ancestors 'none'"));
  });

  await test("Strict-Transport-Security est présent avec une durée d'au moins un an", async () => {
    const hsts = r.headers.get("strict-transport-security");
    assert.ok(hsts, "HSTS absent");
    assert.ok(hsts!.includes("max-age=63072000"));
    assert.ok(hsts!.includes("includeSubDomains"));
  });

  await test("X-Frame-Options: DENY est présent", async () => {
    assert.equal(r.headers.get("x-frame-options"), "DENY");
  });

  await test("X-Content-Type-Options: nosniff est présent", async () => {
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });

  await test("Referrer-Policy est présent et restrictif", async () => {
    assert.equal(r.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  });

  await test("Permissions-Policy est présent (caméra/micro restreints à l'origine elle-même)", async () => {
    const pp = r.headers.get("permissions-policy");
    assert.ok(pp, "Permissions-Policy absent");
    assert.ok(pp!.includes("camera=(self)"));
    assert.ok(pp!.includes("microphone=(self)"));
    assert.ok(pp!.includes("geolocation=()"));
  });

  await test("Les en-têtes de sécurité sont appliqués à une seconde route distincte (pas seulement /login)", async () => {
    const r2 = await fetch("http://localhost:3000/api/health/live");
    assert.ok(r2.headers.get("x-frame-options"));
    assert.ok(r2.headers.get("content-security-policy"));
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
