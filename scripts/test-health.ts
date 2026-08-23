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

  await test("Liveness SIGNE sa réponse — c'est ce qui permet d'accuser le bon coupable", async () => {
    // **Le 23 août 2026, le patron reçoit un téléchargement au lieu d'Atlas.**
    // Sa fiche d'état annonce « 404 d'ATLAS lui-même » et l'envoie lire un
    // journal de serveur — alors que la requête n'avait jamais atteint Atlas.
    // Le verdict devinait, sur l'absence du mot « github » dans l'en-tête
    // `Server` : un refus arrivé NU tombait du mauvais côté. Deux hypothèses
    // fausses lui ont été livrées avant qu'on ne le voie.
    //
    // `_verdict-port.mjs` tranche désormais sur cette signature, que le relais
    // ne peut pas inventer. **Elle doit donc être sur LE FIL, pas seulement
    // dans le code** : écrite avec `NextResponse.json(..., { headers })`, elle
    // a d'abord été éprouvée sur un binaire pas reconstruit et paraissait
    // absente. Ce contrôle interroge le serveur pour de bon.
    //
    // La perdre ne casserait RIEN à l'écran — c'est bien le danger : le
    // diagnostic se remettrait à accuser le relais en toutes circonstances, et
    // personne ne le saurait.
    const r = await fetch("http://localhost:3000/api/health/live");
    assert.equal(
      r.headers.get("x-atlas-vivant"),
      "1",
      "la signature d'Atlas n'arrive pas jusqu'au client : le diagnostic du banc " +
        "ne saura plus dire si c'est l'application ou le relais qui refuse"
    );
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
