import assert from "node:assert/strict";
import { lirePeriodes, PORTEE_GOOGLE, configurationGoogle } from "../src/server/agenda/google";

// **Ce que cette suite couvre, et ce qu'elle ne couvre PAS. À lire avant de
// croire l'agenda Google éprouvé.**
//
// Elle éprouve la LECTURE d'une réponse `freeBusy` : la seule partie du module
// Google qui interprète quelque chose. Elle est séparée de l'appel réseau
// exprès, pour pouvoir exister.
//
// Elle n'éprouve PAS l'aller-retour avec Google : ni l'autorisation, ni
// l'échange du code, ni le renouvellement du jeton. Cet environnement n'a pas
// de compte Google et son mandataire réseau refuse Google (`AGENTS.md`). Ce
// qui ne peut pas être éprouvé ici doit l'être ailleurs — ici, ce sera sur la
// machine du patron, le jour où il aura créé les identifiants
// (`docs/A-FAIRE.md` §7). **Le dire vaut mieux que de laisser croire à une
// vérification qui n'a pas eu lieu.**

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/**
 * La forme documentée de la réponse `freeBusy`, recopiée à la main.
 *
 * Ce n'est pas une capture d'un vrai appel — je n'ai pas pu en faire un. C'est
 * la structure telle que Google la décrit, et c'est la limite de ce contrôle :
 * il tient si la forme est bien celle-là. Il tombera bruyamment sinon, ce qui
 * est encore le meilleur des cas.
 */
const REPONSE = {
  kind: "calendar#freeBusy",
  timeMin: "2026-09-01T00:00:00.000Z",
  timeMax: "2026-09-30T00:00:00.000Z",
  calendars: {
    primary: {
      busy: [
        { start: "2026-09-03T07:00:00Z", end: "2026-09-03T09:00:00Z" },
        { start: "2026-09-10T12:00:00Z", end: "2026-09-10T15:00:00Z" },
      ],
    },
  },
};

console.log("=== Lire ce que Google renvoie ===");

cas("les périodes occupées sont extraites, dans l'ordre", () => {
  const p = lirePeriodes(REPONSE);
  assert.equal(p.length, 2);
  assert.equal(p[0].debut.toISOString(), "2026-09-03T07:00:00.000Z");
  assert.equal(p[0].fin.toISOString(), "2026-09-03T09:00:00.000Z");
  assert.equal(p[1].fin.toISOString(), "2026-09-10T15:00:00.000Z");
});

cas("un agenda sans rien d'occupé ne rend rien", () => {
  assert.deepEqual(lirePeriodes({ calendars: { primary: { busy: [] } } }), []);
});

console.log("\n=== Une réponse abîmée fait MOINS d'occupation, jamais une occupation inventée ===");

cas("une entrée sans dates est ignorée, les autres passent", () => {
  // Le sens de la dégradation compte. Inventer une occupation ferait perdre
  // des journées à l'artisan sans qu'il comprenne pourquoi ; en perdre une le
  // ramène au comportement d'avant, qu'il connaît.
  const p = lirePeriodes({
    calendars: {
      primary: {
        busy: [
          { start: "2026-09-03T07:00:00Z" },
          { end: "2026-09-04T09:00:00Z" },
          { start: "pas une date", end: "non plus" },
          { start: "2026-09-05T07:00:00Z", end: "2026-09-05T09:00:00Z" },
        ],
      },
    },
  });
  assert.equal(p.length, 1, "une entrée illisible a été devinée au lieu d'être ignorée");
  assert.equal(p[0].debut.toISOString(), "2026-09-05T07:00:00.000Z");
});

cas("une réponse vide, nulle ou d'une autre forme ne fait pas tomber la lecture", () => {
  assert.deepEqual(lirePeriodes(null), []);
  assert.deepEqual(lirePeriodes(undefined), []);
  assert.deepEqual(lirePeriodes({}), []);
  assert.deepEqual(lirePeriodes({ calendars: null }), []);
  assert.deepEqual(lirePeriodes({ calendars: { primary: {} } }), []);
  assert.deepEqual(lirePeriodes("une chaîne"), []);
  assert.deepEqual(lirePeriodes({ calendars: { primary: { busy: "pas un tableau" } } }), []);
});

cas("une erreur renvoyée par Google au lieu des créneaux ne devient pas une occupation", () => {
  // Google répond parfois 200 avec un bloc `errors` par calendrier — quota
  // dépassé, calendrier introuvable. Le lire comme « rien d'occupé » est le bon
  // comportement ; l'appelant, lui, saura que la lecture a eu lieu.
  const p = lirePeriodes({
    calendars: { primary: { errors: [{ domain: "global", reason: "notFound" }] } },
  });
  assert.deepEqual(p, []);
});

console.log("\n=== La permission demandée reste la plus étroite possible ===");

cas("la portée est freebusy, jamais la lecture des rendez-vous", () => {
  // **Ce contrôle n'est pas décoratif.** Passer à `calendar.readonly` serait
  // plus simple le jour où l'on voudra afficher un intitulé, et donnerait à
  // Atlas le contenu de tous les rendez-vous de l'artisan — médecin, famille,
  // vacances. Une permission qu'on ne demande pas est une fuite qui ne peut
  // pas arriver ; ce cas rendra le changement délibéré.
  assert.equal(PORTEE_GOOGLE, "https://www.googleapis.com/auth/calendar.freebusy");
  assert.ok(!/readonly|calendar\.events/.test(PORTEE_GOOGLE));
});

cas("sans identifiants, l'installation n'est PAS configurée", () => {
  // Le défaut de configuration refuse, il n'accorde pas — même règle que pour
  // l'éditeur. Un `configurationGoogle()` qui rendrait un objet à moitié rempli
  // enverrait l'artisan chez Google avec un client vide.
  const avant = {
    id: process.env.ATLAS_GOOGLE_CLIENT_ID,
    secret: process.env.ATLAS_GOOGLE_CLIENT_SECRET,
    redirection: process.env.ATLAS_GOOGLE_REDIRECTION,
  };
  try {
    delete process.env.ATLAS_GOOGLE_CLIENT_ID;
    delete process.env.ATLAS_GOOGLE_CLIENT_SECRET;
    delete process.env.ATLAS_GOOGLE_REDIRECTION;
    assert.equal(configurationGoogle(), null);

    // Configuration à moitié posée : refuse aussi.
    process.env.ATLAS_GOOGLE_CLIENT_ID = "un-client";
    assert.equal(configurationGoogle(), null, "une configuration incomplète a été acceptée");

    process.env.ATLAS_GOOGLE_CLIENT_SECRET = "un-secret";
    process.env.ATLAS_GOOGLE_REDIRECTION = "https://exemple.test/api/agenda/google/retour";
    assert.ok(configurationGoogle(), "une configuration complète a été refusée");
  } finally {
    for (const [cle, valeur] of [
      ["ATLAS_GOOGLE_CLIENT_ID", avant.id],
      ["ATLAS_GOOGLE_CLIENT_SECRET", avant.secret],
      ["ATLAS_GOOGLE_REDIRECTION", avant.redirection],
    ] as const) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Lecture de l'agenda Google — ${echecs} échec(s).`);
console.log("   ⚠ L'aller-retour réel avec Google n'est PAS couvert ici (docs/A-FAIRE.md §7).");
if (echecs > 0) process.exit(1);
