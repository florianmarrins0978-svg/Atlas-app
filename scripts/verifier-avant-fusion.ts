import { spawnSync } from "node:child_process";
import path from "node:path";
import { empreinteDesSources } from "./_batterie-solitaire";
import { ecrireDernierVerdict } from "./_dernier-verdict";
import { cheminsDuLot, evaluerLeLot } from "./_niveau-de-risque.mjs";
import { suitesDesRoutes } from "./_suites-ciblees.mjs";
import { prendreUnAtelierSync } from "./_atelier";
import { AUTH, CRON, IA_COUPEE, SANS_CLES_IA, basesDeLAtelier } from "./_bases-essai";

/**
 * NIVEAU 2 — ce qu'on joue avant de fusionner un lot à impact BORNÉ.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Sa décision du 14 septembre 2026.** Jusque-là, le moindre mot changé dans
 * `src/` valait la batterie entière — cinquante minutes. Le niveau se calcule
 * désormais sur le diff : MAX(plancher, rayon d'impact, gravité). Quand il
 * rend 2, c'est CE contrôle-ci qui ouvre la fusion.
 *
 * **Ce qu'il porte, et pourquoi chaque morceau est là :**
 *
 *   · types, style, mémoire du dépôt, suites du dépôt — ce qui parle de l'état
 *     du dépôt lui-même ;
 *   · **les suites navigateur des écrans que le lot atteint, et elles seules.**
 *     C'est ce qui rend un niveau 2 acceptable sur du produit : types et lint
 *     ne parcourent rien, et c'est exactement ce qui a laissé passer « Invalid
 *     Server Actions request. » — vingt allers-retours, tous les voyants au
 *     vert. Un écran touché s'ouvre dans un vrai navigateur.
 *
 * **Il REFUSE de rendre un vert sur un lot de niveau 3** : mieux vaut le dire
 * ici que laisser le garde-fou de la fusion le découvrir dix minutes plus tard.
 *
 * Au vert, il dépose le témoin que le garde-fou relit.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const RACINE = path.join(__dirname, "..");

const lot = evaluerLeLot(cheminsDuLot(RACINE), { racine: RACINE });

console.log(`\x1b[1mRisque : ${lot.risque}\x1b[0m`);
console.log(`Niveau requis : ${lot.niveau}`);
console.log(`Raison : ${lot.raison}`);

if (lot.niveau >= 3) {
  console.log("\n❌ Ce lot exige la batterie entière — ce contrôle ne peut pas l'ouvrir.\n");
  for (const m of lot.motifs.filter((x) => x.niveau === 3).slice(0, 3)) {
    console.log(`   • ${m.chemin}\n     ${m.pourquoi}`);
  }
  console.log("\n    npm run verifier:avant-livraison\n");
  process.exit(1);
}

const suitesCiblees = suitesDesRoutes(RACINE, lot.routes);

// **Son atelier à elle**, comme la batterie : port, base et coin de Redis
// propres, pour que deux sessions puissent vérifier en même temps.
const ATELIER = prendreUnAtelierSync();
process.env.ATLAS_ADRESSE = ATELIER.adresse;
const { APP, OWNER, SUPER, REDIS } = basesDeLAtelier(ATELIER);
if (ATELIER.rang !== 0) console.log(`Atelier n° ${ATELIER.rang} : port ${ATELIER.port}, base et Redis à part.`);

type Etape = {
  titre: string;
  quoi: string;
  commande: string[];
  /** Variables propres à l'étape ; le reste de l'environnement est repris. */
  env?: Record<string, string>;
  /** Variables à RETIRER — une clé présente par accident change le comportement. */
  envSupprime?: string[];
};

const ETAPES: Etape[] = [
  { titre: "Types", quoi: "un appel qui ne correspond plus à sa signature", commande: ["npm", "run", "typecheck"] },
  { titre: "Lint", quoi: "les pièges connus de React et de Next", commande: ["npm", "run", "lint"] },
  { titre: "Mémoire du dépôt", quoi: "une documentation qui décrit une version disparue", commande: ["npm", "run", "verifier:memoire"] },
  {
    titre: "Suites du dépôt",
    quoi: "les règles métier, l'isolation, et les garde-fous",
    commande: ["npm", "test"],
    // **Exactement l'environnement de la batterie**, et `REDIS_URL` retirée
    // avec : la laisser fait qu'une suite garde une connexion ouverte, que le
    // processus ne se termine plus, et qu'un mot de passe changé par une suite
    // voisine fait rougir une autre sur du code juste. La batterie le savait
    // depuis longtemps ; ce contrôle-ci l'ignorait, et c'est ce qui l'a fait
    // mentir le 16 septembre 2026.
    env: { DATABASE_URL: APP, DATABASE_ADMIN_URL: OWNER, ...AUTH, ...IA_COUPEE },
    envSupprime: ["REDIS_URL", ...SANS_CLES_IA],
  },
];

// **Les écrans atteints, regardés pour de bon.** Sans cette étape, un niveau 2
// sur du produit ne prouverait rien de ce que le patron parcourt.
if (suitesCiblees.length) {
  ETAPES.push({
    titre: `Écrans atteints (${lot.routes.join(", ")})`,
    quoi: "un écran qui ne s'ouvre plus, une action serveur refusée",
    commande: ["npm", "run", "test:e2e", "--", "--seulement", suitesCiblees.join(",")],
    // **Le rôle qui TRAVERSE la RLS**, comme dans la batterie : ces suites
    // amorcent la base et l'inspectent pour vérifier ce qu'elles affirment.
    // Hériter du rôle du produit les fait tomber sur « permission denied », et
    // c'est le produit qu'on accuse — payé le 16 septembre 2026, en direct.
    env: { DATABASE_URL: SUPER, ...AUTH, ...CRON, ...REDIS, ...IA_COUPEE },
    envSupprime: SANS_CLES_IA,
  });
}

console.log(
  `Contrôles exécutés : ${ETAPES.map((e) => e.titre.replace(/ \(.*/, "")).join(", ")}` +
    (suitesCiblees.length ? ` — ${suitesCiblees.length} suite(s) navigateur : ${suitesCiblees.join(", ")}` : "")
);

const echecs: string[] = [];

for (const etape of ETAPES) {
  console.log(`\n\x1b[1m→ ${etape.titre}\x1b[0m`);
  const [programme, ...args] = etape.commande;
  const env = { ...process.env, ...(etape.env ?? {}) };
  for (const clef of etape.envSupprime ?? []) delete env[clef];
  const issue = spawnSync(programme, args, { cwd: RACINE, stdio: "inherit", env });
  if (issue.status === 0) {
    console.log(`   ✅ ${etape.titre}`);
  } else {
    echecs.push(etape.titre);
    console.log(`   ❌ ${etape.titre}`);
  }
}

console.log("\n─────────────────────────────────────────────────────────────");

if (echecs.length > 0) {
  // **Aucun témoin n'est déposé.** Le garde-fou refusera donc la fusion, et
  // c'est exactement ce qu'on veut : un rouge ne se contourne pas en oubliant.
  console.log(`❌ ${echecs.length} étape(s) en échec :\n`);
  for (const titre of echecs) {
    const etape = ETAPES.find((e) => e.titre === titre);
    console.log(`   • ${titre}\n     ce qu'elle attrape : ${etape?.quoi}`);
  }
  console.log("\n   Rien ne part sur « main » tant que ce n'est pas vert.");
  process.exit(1);
}

// **Le MÊME témoin que la batterie**, avec son niveau — jamais un second
// fichier à côté. Deux façons de dire « voilà ce qui a été mesuré, et sur quel
// arbre » finiraient par se contredire (`CLAUDE.md` §3).
ecrireDernierVerdict(RACINE, {
  quand: Date.now(),
  vert: true,
  verdict: `✅ Niveau 2 au vert (types, lint, mémoire, suites du dépôt${suitesCiblees.length ? `, ${suitesCiblees.length} suite(s) navigateur` : ""}).`,
  empreinte: empreinteDesSources(RACINE),
  niveau: 2,
});
console.log("✅ Niveau 2 au vert — la fusion de ce lot est ouverte.");
console.log("   (Le niveau se recalcule à chaque poussée : un fichier de plus peut le changer.)");
