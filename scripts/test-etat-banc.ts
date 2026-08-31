import assert from "node:assert/strict";
import { lireEtatConstruction, laVersionRapideSeConstruit, lireChantier } from "../src/server/etat-banc";

/**
 * Le bandeau « version rapide en construction » : ce qu'il dit, et quand il se tait.
 *
 * *Le patron, le 14 août 2026 : « La connexion est au ralenti sur l'appli. Les
 * nouvelles pages ne chargent mal ou pas du tout. » Puis : « Surtout la page
 * équipe. »*
 *
 * **Ce que ces cas gardent, et qu'aucun contrôle d'écran ne verrait :** que le
 * bandeau ne s'affiche QUE sur son banc, qu'il se TAIT dès que tout est prêt, et
 * qu'il n'invente jamais un chiffre. Un bandeau resté après la fin apprend à ne
 * plus être lu ; un bandeau apparu en production ferait douter un vrai client.
 */

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== L'état de construction du banc ===\n");

// ─── Quand le bandeau existe, et quand il n'existe pas ──────────────────────

cas("hors banc d'essai, il n'y a rien à montrer", () => {
  assert.equal(laVersionRapideSeConstruit({ NODE_ENV: "development" } as NodeJS.ProcessEnv), false);
  assert.equal(
    laVersionRapideSeConstruit({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    false,
    "une application déployée n'a rien à bâtir"
  );
});

cas("sur le banc, en mode développement : la version rapide se construit encore", () => {
  assert.equal(
    laVersionRapideSeConstruit({ ATLAS_PROFIL: "banc", NODE_ENV: "development" } as NodeJS.ProcessEnv),
    true
  );
});

// **`next start` impose `NODE_ENV=production`.** Servir en production SUR un
// banc EST la preuve que la bascule a eu lieu : tout est compilé, le bandeau
// n'a plus rien à dire.
cas("sur le banc, une fois la version rapide en place : plus de bandeau", () => {
  assert.equal(
    laVersionRapideSeConstruit({ ATLAS_PROFIL: "banc", NODE_ENV: "production" } as NodeJS.ProcessEnv),
    false
  );
});

cas("l'ancien nom du profil est reconnu aussi", () => {
  // Un espace créé avant `ATLAS_PROFIL` ne connaît que celui-ci — deux
  // correctifs de suite sont restés inertes pour l'avoir oublié.
  assert.equal(
    laVersionRapideSeConstruit({ ATLAS_BANC_ESSAI: "1", NODE_ENV: "development" } as NodeJS.ProcessEnv),
    true
  );
});

// ─── Ce que le fichier d'avancement raconte ─────────────────────────────────

cas("préchauffage en cours : le compte est rendu tel quel", () => {
  const e = lireEtatConstruction(JSON.stringify({ faits: 12, total: 19, encours: "/reglages" }));
  assert.deepEqual(e, { faits: 12, total: 19, encours: "/reglages", versionDavant: false });
});

cas("préchauffage terminé : le bandeau se tait", () => {
  assert.equal(lireEtatConstruction(JSON.stringify({ faits: 19, total: 19, termine: true })), null);
});

cas("fichier absent : on dit que ça travaille, sans inventer de total", () => {
  const e = lireEtatConstruction(null);
  assert.deepEqual(e, { faits: 0, total: 0, encours: null, versionDavant: false }, "un total inventé serait une donnée fabriquée");
});

// **Lu pendant son écriture.** Le préchauffage réécrit ce fichier à chaque
// écran ; une lecture qui tombe au milieu rend du JSON tronqué. Ce n'est pas
// une panne, et cela ne doit ni lever ni afficher d'erreur.
cas("fichier tronqué : on retombe sur « ça travaille », jamais sur une erreur", () => {
  assert.deepEqual(lireEtatConstruction('{"faits":3,"tot'), { faits: 0, total: 0, encours: null, versionDavant: false });
  assert.deepEqual(lireEtatConstruction(""), { faits: 0, total: 0, encours: null, versionDavant: false });
  assert.deepEqual(lireEtatConstruction("null"), { faits: 0, total: 0, encours: null, versionDavant: false });
  assert.deepEqual(lireEtatConstruction("[1,2]"), { faits: 0, total: 0, encours: null, versionDavant: false });
});

cas("un compte supérieur au total est ramené au total", () => {
  // « 21 écrans sur 19 » se lit comme un défaut de l'application et détourne du
  // message.
  const e = lireEtatConstruction(JSON.stringify({ faits: 21, total: 19 }));
  assert.equal(e?.faits, 19);
});

cas("des valeurs absurdes ne traversent pas", () => {
  const e = lireEtatConstruction(JSON.stringify({ faits: -3, total: "dix-neuf", encours: "" }));
  assert.deepEqual(e, { faits: 0, total: 0, encours: null, versionDavant: false });
});

cas("l'écran en cours n'est rendu que s'il en est vraiment un", () => {
  assert.equal(lireEtatConstruction(JSON.stringify({ faits: 1, total: 5, encours: 42 }))?.encours, null);
  assert.equal(
    lireEtatConstruction(JSON.stringify({ faits: 1, total: 5, encours: "/planning" }))?.encours,
    "/planning"
  );
});

// ── Le témoin de construction : « on sert la version d'avant » ──────────────
//
// **Il porte un pid, et c'est tout l'objet de ces cas.** Le banc du patron se
// fait abattre par le noyau quand la mémoire manque — il laisse alors son
// témoin derrière lui. Un bandeau qui annoncerait une construction en cours
// pour toujours enverrait attendre ce que plus personne ne fait : c'est la
// faute du 20 août (`src/lib/version-lente.ts`), et elle ne se refait pas.

const VIVANT = () => true;
const MORT = () => false;

cas("un chantier ouvert par un banc vivant se lit", () => {
  assert.deepEqual(lireChantier(JSON.stringify({ pid: 42, versionDavant: true }), VIVANT), {
    versionDavant: true,
  });
});

cas("un chantier laissé par un banc MORT ne dit rien", () => {
  assert.equal(
    lireChantier(JSON.stringify({ pid: 42, versionDavant: true }), MORT),
    null,
    "un témoin d'un banc abattu ferait attendre une construction que personne ne fait"
  );
});

cas("une construction sans version d'avant ne prétend pas en servir une", () => {
  // Le tout premier démarrage d'un espace : il n'y a rien à servir, on est bel
  // et bien en mode développement, et le bandeau garde son compte d'écrans.
  assert.deepEqual(lireChantier(JSON.stringify({ pid: 42 }), VIVANT), { versionDavant: false });
});

cas("un témoin illisible ou sans pid ne fait rien croire", () => {
  for (const brut of ["", "   ", "{pas du json", "null", "[1,2]", "{}", '{"pid":0}', '{"pid":"42"}']) {
    assert.equal(lireChantier(brut, VIVANT), null, `« ${brut} » aurait dû être écarté`);
  }
  assert.equal(lireChantier(null, VIVANT), null);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} État du banc — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
