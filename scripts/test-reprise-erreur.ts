import assert from "node:assert";
import {
  estMorceauIntrouvable,
  peutRechargerSeul,
  repriseApresErreur,
  FENETRE_RECHARGEMENT_MS,
} from "../src/lib/reprise-erreur";

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

/** L'erreur exacte de la capture du patron, 11 août 2026, 18 h 02. */
function erreurDuPatron() {
  const e = new Error(
    "Failed to load chunk /_next/static/chunks/src_06hhplf._.js from module " +
      "[project]/node_modules/next/dist/compiled/react-server-dom-turbopack/cjs/" +
      "react-server-dom-turbopack-client.browser.development.js [app-client] (ecmascript)"
  );
  e.name = "ChunkLoadError";
  return e;
}

const ECRAN = "Impossible de charger le planning pour l'instant.";

function main() {
  // ── Reconnaître la panne ───────────────────────────────────────────────────

  test("L'erreur exacte du 11 août est reconnue", () => {
    assert.equal(estMorceauIntrouvable(erreurDuPatron()), true);
  });

  test("Le seul NOM suffit, même sans message", () => {
    const e = new Error("");
    e.name = "ChunkLoadError";
    assert.equal(estMorceauIntrouvable(e), true);
  });

  // Le patron est sur un iPhone : si ce cas tombe, c'est LUI qui reste devant
  // un bouton sans issue, et personne d'autre.
  test("Safari, Chrome, Firefox et webpack disent tous autre chose — et tous sont reconnus", () => {
    for (const message of [
      "Importing a module script failed.", // Safari — son téléphone
      "Failed to fetch dynamically imported module: https://x/_next/static/chunks/a.js", // Chrome
      "error loading dynamically imported module", // Firefox
      "Loading chunk 428 failed.", // webpack, version bâtie
      "Loading CSS chunk 12 failed.", // webpack, feuilles de style
    ]) {
      assert.equal(estMorceauIntrouvable(new Error(message)), true, message);
    }
  });

  test("Une cause enveloppée est retrouvée", () => {
    const dessous = erreurDuPatron();
    const dessus = new Error("An error occurred in the Server Components render.", { cause: dessous });
    assert.equal(estMorceauIntrouvable(dessus), true);
  });

  // ── Et savoir DIRE NON : c'est ce cas qui rend les autres crédibles ────────

  test("Une panne ordinaire n'est PAS prise pour un morceau manquant", () => {
    for (const e of [
      new Error("Invalid Server Actions request."),
      new Error("relation « chantiers » does not exist"),
      new Error("Impossible de charger le planning pour l'instant."),
      new Error("Failed to fetch"), // une requête réseau quelconque
      new Error(""),
      null,
      undefined,
      "ChunkLoadError", // une chaîne, pas une erreur
    ]) {
      assert.equal(estMorceauIntrouvable(e), false, String(e));
    }
  });

  test("Une chaîne de causes qui boucle ne fait pas tourner la reconnaissance en rond", () => {
    const a = new Error("a") as Error & { cause?: unknown };
    const b = new Error("b") as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    assert.equal(estMorceauIntrouvable(a), false);
  });

  // ── La garde contre la page qui tourne en rond ─────────────────────────────

  test("Sans rechargement antérieur, on a le droit de recharger", () => {
    assert.equal(peutRechargerSeul(null, 1_000_000), true);
  });

  test("Un rechargement à l'instant interdit le suivant", () => {
    const maintenant = 1_000_000;
    assert.equal(peutRechargerSeul(maintenant, maintenant), false);
    assert.equal(peutRechargerSeul(maintenant, maintenant + FENETRE_RECHARGEMENT_MS), false);
  });

  test("Passé la fenêtre, une NOUVELLE panne se relève encore toute seule", () => {
    const maintenant = 1_000_000;
    assert.equal(peutRechargerSeul(maintenant, maintenant + FENETRE_RECHARGEMENT_MS + 1), true);
  });

  // ── Ce que l'écran montre, et ce que le bouton fait ────────────────────────

  test("Sur une panne ordinaire, l'écran garde SA phrase et son « Réessayer »", () => {
    const r = repriseApresErreur(new Error("base indisponible"), {
      phraseDeLEcran: ECRAN,
      rechargementPossible: true,
    });
    assert.equal(r.phrase, ECRAN);
    assert.equal(r.bouton, "Réessayer");
    assert.equal(r.rechargement, false);
    assert.equal(r.automatique, false);
  });

  // C'est LE défaut du 11 août : le bouton refaisait le même rendu avec les
  // mêmes adresses mortes. S'il redevient « Réessayer » ici, le patron se
  // retrouve exactement devant sa capture.
  test("Sur un morceau manquant, le remède est un RECHARGEMENT, pas un « Réessayer »", () => {
    const r = repriseApresErreur(erreurDuPatron(), {
      phraseDeLEcran: ECRAN,
      rechargementPossible: true,
    });
    assert.equal(r.rechargement, true);
    assert.equal(r.automatique, true);
    assert.equal(r.bouton, "Recharger");
    assert.notEqual(r.bouton, "Réessayer");
  });

  // Le planning n'y est pour rien : c'est la page entière qui a vieilli.
  // Désigner le mauvais coupable est l'erreur que ce dépôt paie le plus cher.
  test("Sur un morceau manquant, la phrase de l'écran s'efface — elle accuserait à tort", () => {
    const r = repriseApresErreur(erreurDuPatron(), {
      phraseDeLEcran: ECRAN,
      rechargementPossible: true,
    });
    assert.notEqual(r.phrase, ECRAN);
    assert.doesNotMatch(r.phrase, /planning/i);
    assert.match(r.phrase, /recharge/i);
  });

  test("Quand le rechargement a déjà eu lieu, on cesse et on explique", () => {
    const r = repriseApresErreur(erreurDuPatron(), {
      phraseDeLEcran: ECRAN,
      rechargementPossible: false,
    });
    assert.equal(r.automatique, false, "une seconde page qui recharge toute seule est une boucle");
    assert.equal(r.rechargement, true, "le bouton doit rester un rechargement, jamais un reset()");
    assert.match(r.phrase, /mise à jour|connexion/i);
  });

  // Un message qui ne propose qu'une cause enverrait chercher au mauvais
  // endroit une fois sur deux.
  test("Après l'échec, aucune des deux causes possibles n'est passée sous silence", () => {
    const r = repriseApresErreur(erreurDuPatron(), {
      phraseDeLEcran: ECRAN,
      rechargementPossible: false,
    });
    assert.match(r.phrase, /mise à jour/i);
    assert.match(r.phrase, /connexion/i);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main();
