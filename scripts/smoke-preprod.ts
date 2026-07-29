// Script de fumée pré-production. Ne s'exécute JAMAIS sans STAGING_URL
// explicitement fourni — aucune valeur par défaut, jamais une supposition
// sur l'environnement cible. N'a été exécuté contre AUCUN environnement de
// préproduction réel dans le cadre de ce lot (aucun environnement de ce
// type n'existe dans ce sandbox) — ce script est livré pour usage futur,
// non validé en conditions réelles.

const url = process.env.STAGING_URL;

if (!url) {
  console.error("STAGING_URL manquant. Ce script exige une URL explicite, jamais une valeur par défaut.");
  console.error("Exemple : STAGING_URL=https://staging.atlas.example.com npx tsx scripts/smoke-preprod.ts");
  process.exit(1);
}

const MOTS_PRODUCTION = ["prod", "production", "www.", "app.atlas"];
if (MOTS_PRODUCTION.some((m) => url.toLowerCase().includes(m)) && !process.env.JE_CONFIRME_PREPROD) {
  console.error(
    `L'URL fournie ("${url}") ressemble à un environnement de PRODUCTION. ` +
      "Ce script ne doit jamais être exécuté contre la production (il ne modifie rien, mais par précaution). " +
      "Si c'est réellement l'intention, relancez avec JE_CONFIRME_PREPROD=1."
  );
  process.exit(1);
}

async function verifier(nom: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    return true;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function main() {
  let echecs = 0;

  if (
    !(await verifier("Liveness répond 200", async () => {
      const r = await fetch(`${url}/api/health/live`);
      if (r.status !== 200) throw new Error(`statut ${r.status}`);
    }))
  )
    echecs++;

  if (
    !(await verifier("Readiness répond 200 (base de données joignable)", async () => {
      const r = await fetch(`${url}/api/health/ready`);
      if (r.status !== 200) throw new Error(`statut ${r.status}`);
      const corps = await r.json();
      if (corps.dependances?.base_de_donnees !== "ok") throw new Error("base_de_donnees non ok");
    }))
  )
    echecs++;

  if (
    !(await verifier("La page de connexion est accessible sans session", async () => {
      const r = await fetch(`${url}/login`);
      if (r.status !== 200) throw new Error(`statut ${r.status}`);
    }))
  )
    echecs++;

  if (
    !(await verifier("Une route protégée redirige vers /login sans session", async () => {
      const r = await fetch(`${url}/`, { redirect: "manual" });
      if (r.status !== 307 && r.status !== 302) throw new Error(`statut ${r.status}, attendu une redirection`);
    }))
  )
    echecs++;

  if (
    !(await verifier("La route cron refuse une requête sans secret (401)", async () => {
      const r = await fetch(`${url}/api/cron/purge-fichiers`, { method: "POST" });
      if (r.status !== 401 && r.status !== 503) throw new Error(`statut ${r.status}, attendu 401 ou 503`);
    }))
  )
    echecs++;

  console.log(`\n${echecs === 0 ? "Tous les contrôles sont passés." : `${echecs} contrôle(s) en échec.`}`);
  if (echecs > 0) process.exit(1);
}

main();
