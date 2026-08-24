// Le jeu de démonstration a-t-il le droit d'effacer cette base-là ?
//
// **CE QUE CETTE SUITE PROTÈGE.** `src/server/db/seed.ts` commence par un
// `TRUNCATE … CASCADE` sur `entreprises` et `users`. Jusqu'au 23 août 2026,
// rien ne l'empêchait de le faire sur une vraie base : le seul garde-fou était
// un commentaire affirmant que « ce seed n'est de toute façon jamais exécuté
// contre une base de production ». L'audit (constat E1) l'a relevé comme le
// risque latent de plus fort impact du dépôt.
//
// **Tous les cas ci-dessous rougiraient sur l'ancien code** : il n'y avait
// aucune fonction à interroger, et chacune de ces cibles aurait été acceptée.
//
// Éprouvée SANS base — et c'est le but : ce sont exactement les cas qu'on ne
// veut surtout pas jouer en vrai.

import assert from "node:assert/strict";
import {
  BASES_AUTORISEES,
  FORCAGE_ATTENDU,
  garderSeed,
  phraseDeRefus,
  type ContexteSeed,
} from "../src/lib/garde-seed";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

const base = (p: Partial<ContexteSeed> = {}): ContexteSeed => ({
  databaseUrl: "postgresql://atlas_app:pw@localhost:5432/atlas_test",
  nodeEnv: "test",
  forcage: undefined,
  motDePasseDemo: undefined,
  ...p,
});

function refuse(contexte: ContexteSeed, attendu: string) {
  const v = garderSeed(contexte);
  assert.equal(v.ok, false, `accepté alors qu'on attendait un refus « ${attendu} »`);
  if (!v.ok) assert.equal(v.refus, attendu);
}

console.log("=== Le jeu de démonstration : sur quelle base a-t-il le droit ? ===\n");

// ─── Ce qui ressemble à une production est refusé ───────────────────────────

essai("une base nommée comme une production est refusée", () => {
  refuse(base({ databaseUrl: "postgresql://u:p@localhost:5432/atlas_production" }), "base-inconnue");
  refuse(base({ databaseUrl: "postgresql://u:p@localhost:5432/atlas" }), "base-inconnue");
  refuse(base({ databaseUrl: "postgresql://u:p@localhost:5432/postgres" }), "base-inconnue");
});

essai("une base au BON nom mais AILLEURS est refusée", () => {
  // Le piège que le nom seul laisserait passer : `atlas_test` chez un
  // hébergeur reste la base de quelqu'un.
  refuse(base({ databaseUrl: "postgresql://u:p@db.hebergeur.example:5432/atlas_test" }), "hote-distant");
  refuse(base({ databaseUrl: "postgresql://u:p@10.0.0.12:5432/atlas_dev" }), "hote-distant");
});

essai("NODE_ENV=production refuse, même sur une base au bon nom et locale", () => {
  refuse(base({ nodeEnv: "production" }), "production");
});

// ─── Une configuration ambiguë refuse ───────────────────────────────────────

essai("sans DATABASE_URL, on refuse — on ne devine pas ce qu'on efface", () => {
  refuse(base({ databaseUrl: undefined }), "cible-illisible");
  refuse(base({ databaseUrl: "   " }), "cible-illisible");
});

essai("une adresse illisible refuse", () => {
  refuse(base({ databaseUrl: "ce-n-est-pas-une-adresse" }), "cible-illisible");
});

essai("une adresse sans nom de base refuse", () => {
  refuse(base({ databaseUrl: "postgresql://u:p@localhost:5432" }), "base-sans-nom");
  refuse(base({ databaseUrl: "postgresql://u:p@localhost:5432/" }), "base-sans-nom");
});

// ─── Une base d'essai explicitement autorisée fonctionne ────────────────────

essai("les bases d'essai connues passent, sur cette machine", () => {
  for (const nom of BASES_AUTORISEES) {
    for (const hote of ["localhost", "127.0.0.1", "postgres"]) {
      const v = garderSeed(base({ databaseUrl: `postgresql://u:p@${hote}:5432/${nom}` }));
      assert.equal(v.ok, true, `« ${nom} » sur « ${hote} » a été refusée`);
      if (v.ok) assert.equal(v.force, false);
    }
  }
});

// **Le banc d'essai doit continuer de refaire son jeu de démonstration.**
// Sans ce cas, le remède créerait la panne : `.devcontainer/docker-compose.yml`
// pointe sur `atlas_dev` via le service `postgres`, et `NODE_ENV` y vaut
// `production` parce que `next start` l'impose. Le patron ne pourrait plus
// rafraîchir ses données d'essai — et personne ne saurait pourquoi.
essai("le banc d'essai reste servi : atlas_dev, hôte « postgres »", () => {
  const v = garderSeed({
    databaseUrl: "postgresql://atlas_app:atlas_app_dev_pw@postgres:5432/atlas_dev",
    nodeEnv: "development",
    forcage: undefined,
    motDePasseDemo: undefined,
  });
  assert.equal(v.ok, true);
});

// ─── Le forçage : explicite, et jamais par distraction ──────────────────────

essai("un forçage approximatif ne force RIEN", () => {
  for (const tentative of ["1", "oui", "true", "yes", "OUI-J-EFFACE-TOUT", "oui-j-efface-tou"]) {
    refuse(
      base({ databaseUrl: "postgresql://u:p@ailleurs.example:5432/atlas_production", forcage: tentative }),
      "base-inconnue"
    );
  }
});

essai("le forçage exact passe outre — mais EXIGE un mot de passe de démonstration", () => {
  // Le dépôt est public : `demo1234` n'a rien à faire sur une base qu'on a dû
  // forcer pour atteindre.
  refuse(
    base({ databaseUrl: "postgresql://u:p@ailleurs.example:5432/atlas_production", forcage: FORCAGE_ATTENDU }),
    "forcage-sans-mot-de-passe"
  );
  const v = garderSeed(
    base({
      databaseUrl: "postgresql://u:p@ailleurs.example:5432/atlas_production",
      nodeEnv: "production",
      forcage: FORCAGE_ATTENDU,
      motDePasseDemo: "un-mot-de-passe-a-moi",
    })
  );
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.force, true, "le forçage doit se DIRE, pour que l'écran puisse alerter");
    assert.equal(v.base, "atlas_production");
  }
});

// ─── Le refus doit se lire ──────────────────────────────────────────────────

essai("le refus dit ce qui allait se passer, et comment forcer si on le veut", () => {
  const v = garderSeed(base({ databaseUrl: "postgresql://u:p@localhost:5432/atlas_production" }));
  assert.equal(v.ok, false);
  if (!v.ok) {
    const phrase = phraseDeRefus(v);
    assert.match(phrase, /VIDE/, "le refus ne dit pas que tout serait effacé");
    assert.match(phrase, new RegExp(FORCAGE_ATTENDU), "le refus ne dit pas comment forcer");
    assert.match(phrase, /atlas_production/, "le refus ne nomme pas la base visée");
  }
});

console.log("");
console.log(`La garde du jeu de démonstration — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
