import { spawnSync } from "node:child_process";

// La batterie complète, à jouer AVANT de demander au patron d'essayer quoi que
// ce soit.
//
// Pourquoi elle existe : vingt échanges ont été consommés à lui faire essayer
// une application qui refusait sa connexion. Chaque fois, les voyants étaient
// verts — parce qu'aucun contrôle ne parcourait ce que lui parcourait. Le défaut
// n'était visible que derrière un autre nom de domaine, c'est-à-dire uniquement
// chez lui.
//
// Ce script rassemble donc tout ce qui existe, et surtout ce qui manquait : une
// connexion RÉELLE, dans un vrai navigateur, derrière une origine étrangère.
//
// L'ordre compte : les contrôles rapides d'abord, pour ne pas attendre dix
// minutes avant d'apprendre qu'une virgule manque.
//
// Il ne s'arrête PAS à la première erreur : savoir que trois choses cassent, et
// lesquelles, vaut mieux que de les découvrir une par une.

type Etape = {
  nom: string;
  commande: string;
  args: string[];
  /** Variables propres à l'étape ; le reste de l'environnement est repris. */
  env?: Record<string, string>;
  /**
   * Variables à RETIRER pour cette étape. Nécessaire parce que l'environnement
   * ambiant est repris : une variable présente par accident suffit à changer le
   * comportement d'une suite.
   */
  envSupprime?: string[];
  /** Pourquoi cette étape existe — affiché quand elle échoue. */
  ceQueCaAttrape: string;
};

const AUTH = { AUTH_SECRET: "ci-secret-not-a-real-production-value-000000000000" };
const CRON = { CRON_SECRET: "ci-placeholder-cron-secret-0000000000" };
const REDIS = { REDIS_URL: "redis://localhost:6379" };

const APP = "postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/atlas_test";
const OWNER = "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test";
const SUPER = "postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test";

const ETAPES: Etape[] = [
  {
    nom: "Types",
    commande: "npm",
    args: ["run", "typecheck"],
    ceQueCaAttrape: "un appel qui ne correspond plus à sa signature",
  },
  {
    nom: "Lint",
    commande: "npm",
    args: ["run", "lint"],
    ceQueCaAttrape: "les pièges connus de React et de Next",
  },
  {
    nom: "Mémoire du dépôt",
    commande: "npm",
    args: ["run", "verifier:memoire"],
    ceQueCaAttrape: "une documentation qui décrit une version qui n'existe plus",
  },
  {
    nom: "Suites base de données",
    commande: "npm",
    args: ["test"],
    env: { DATABASE_URL: APP, DATABASE_ADMIN_URL: OWNER, ...AUTH },
    // REDIS_URL retiré, et ce n'est pas un détail de configuration : avec
    // cette variable, la suite des propositions IA ouvre une connexion Redis
    // qui n'est jamais refermée, le processus ne se termine plus, et la
    // batterie entière reste bloquée sans le moindre message. Constaté deux
    // fois de suite, puis isolé : code 124 (délai dépassé) avec la variable,
    // code 0 sans. La CI ne la fournit pas non plus à cette étape.
    envSupprime: ["REDIS_URL"],
    ceQueCaAttrape: "l'isolation entre entreprises, les règles métier, la RLS",
  },
  {
    // `npm test` vide la base : sans réamorçage, l'étape suivante échouerait
    // sur un compte manquant et accuserait le navigateur.
    nom: "Données de démonstration",
    commande: "npx",
    args: ["tsx", "src/server/db/seed.ts"],
    env: { DATABASE_URL: SUPER, ...AUTH },
    envSupprime: ["REDIS_URL"],
    ceQueCaAttrape: "rien — c'est une remise en état, pas un contrôle",
  },
  {
    nom: "Suites navigateur",
    commande: "npm",
    args: ["run", "test:e2e"],
    // Redis ici, comme en CI : la limitation de débit doit être remise à zéro
    // entre deux suites, ce que la mémoire du serveur ne permet pas.
    env: { DATABASE_URL: SUPER, ...AUTH, ...CRON, ...REDIS },
    ceQueCaAttrape: "le parcours complet, du devis à la facture",
  },
  {
    nom: "Connexion derrière un proxy",
    commande: "npx",
    args: ["tsx", "scripts/verifier-connexion-avec-serveur.mts"],
    env: { DATABASE_URL: SUPER, ...AUTH, ...CRON, ...REDIS },
    ceQueCaAttrape:
      "« Invalid Server Actions request. » — le défaut qui a coûté une demi-journée au patron,\n" +
      "     invisible partout ailleurs parce que tout le reste interroge 127.0.0.1",
  },
];

const echecs: Etape[] = [];

for (const etape of ETAPES) {
  console.log(`\n\x1b[1m→ ${etape.nom}\x1b[0m`);
  const env = { ...process.env, ...(etape.env ?? {}) };
  for (const cle of etape.envSupprime ?? []) delete env[cle];

  const r = spawnSync(etape.commande, etape.args, { stdio: "inherit", env });
  if (r.status === 0) {
    console.log(`   ✅ ${etape.nom}`);
  } else {
    console.error(`   ❌ ${etape.nom}`);
    echecs.push(etape);
  }
}

console.log("\n─────────────────────────────────────────────────────────────");
if (echecs.length === 0) {
  console.log("✅ Batterie complète au vert.");
  console.log("   La connexion a été faite pour de vrai, dans un navigateur,");
  console.log("   derrière une origine étrangère. On peut livrer.");
  process.exit(0);
}

console.error(`❌ ${echecs.length} étape(s) en échec :\n`);
for (const e of echecs) {
  console.error(`   • ${e.nom}`);
  console.error(`     ce qu'elle attrape : ${e.ceQueCaAttrape}`);
}
console.error("\n   Ne rien donner au patron avant que tout soit vert.");
process.exit(1);
