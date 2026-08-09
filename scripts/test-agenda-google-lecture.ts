import assert from "node:assert/strict";
import { lirePeriodes, PORTEE_GOOGLE, configurationGoogle } from "../src/server/agenda/google";

// **Ce que cette suite couvre, et ce qu'elle ne couvre PAS. À lire avant de
// croire l'agenda Google éprouvé.**
//
// Elle éprouve la LECTURE d'une réponse `events.list` : la seule partie du
// module Google qui interprète quelque chose. Elle est séparée de l'appel
// réseau exprès, pour pouvoir exister.
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
 * La forme documentée de la réponse `events.list`, recopiée à la main.
 *
 * Ce n'est pas une capture d'un vrai appel — je n'ai pas pu en faire un. C'est
 * la structure telle que Google la décrit, et c'est la limite de ce contrôle :
 * il tient si la forme est bien celle-là. Il tombera bruyamment sinon, ce qui
 * est encore le meilleur des cas.
 */
const REPONSE = {
  kind: "calendar#events",
  items: [
    {
      status: "confirmed",
      summary: "Élagage chez Mme Roux",
      start: { dateTime: "2026-09-03T07:00:00Z" },
      end: { dateTime: "2026-09-03T09:00:00Z" },
    },
    {
      status: "confirmed",
      summary: "Dentiste",
      start: { dateTime: "2026-09-10T12:00:00Z" },
      end: { dateTime: "2026-09-10T15:00:00Z" },
    },
  ],
};

console.log("=== Lire ce que Google renvoie ===");

cas("les périodes occupées sont extraites, dans l'ordre", () => {
  const p = lirePeriodes(REPONSE);
  assert.equal(p.length, 2);
  assert.equal(p[0].debut.toISOString(), "2026-09-03T07:00:00.000Z");
  assert.equal(p[0].fin.toISOString(), "2026-09-03T09:00:00.000Z");
  assert.equal(p[1].fin.toISOString(), "2026-09-10T15:00:00.000Z");
});

cas("l'intitulé est rendu — sa demande du 9 août 2026", () => {
  // *« Si, il doit lire les intitulés aussi ! »* Un artisan qui note « élagage
  // chez Mme Roux » veut le retrouver sur son planning, pas une case grise.
  const p = lirePeriodes(REPONSE);
  assert.equal(p[0].intitule, "Élagage chez Mme Roux");
  assert.equal(p[1].intitule, "Dentiste");
});

cas("un événement sans titre rend null, jamais une chaîne vide", () => {
  // Une chaîne vide s'afficherait comme un blanc dans la liste ; `null` laisse
  // l'écran écrire « rendez-vous sans titre », qui se comprend.
  const p = lirePeriodes({
    items: [{ start: { dateTime: "2026-09-03T07:00:00Z" }, end: { dateTime: "2026-09-03T09:00:00Z" } }],
  });
  assert.equal(p[0].intitule, null);
});

cas("un événement « toute la journée » se lit sans déborder d'un jour", () => {
  // **Google rend une fin EXCLUSIVE sur ces événements-là** : un congé du 14 au
  // 14 s'écrit start 14, end 15. Le recopier tel quel barrerait le 15, une
  // journée que l'artisan aurait acceptée.
  const p = lirePeriodes({
    items: [{ summary: "Congé", start: { date: "2026-09-14" }, end: { date: "2026-09-15" } }],
  });
  assert.equal(p.length, 1);
  assert.equal(p[0].journeeEntiere, true);
  assert.equal(p[0].debut.toISOString().slice(0, 10), "2026-09-14");
  assert.equal(p[0].fin.toISOString().slice(0, 10), "2026-09-14", "la journée suivante est barrée à tort");
});

cas("un événement annulé n'occupe rien", () => {
  const p = lirePeriodes({
    items: [
      {
        status: "cancelled",
        summary: "Rendez-vous annulé",
        start: { dateTime: "2026-09-03T07:00:00Z" },
        end: { dateTime: "2026-09-03T09:00:00Z" },
      },
    ],
  });
  assert.deepEqual(p, [], "un rendez-vous annulé barre encore la journée qu'il vient de libérer");
});

cas("un événement marqué « disponible » n'occupe rien non plus", () => {
  // Un pense-bête, un anniversaire. L'artisan a dit lui-même dans son agenda
  // que ça ne l'occupe pas : on ne le contredit pas.
  const p = lirePeriodes({
    items: [
      {
        transparency: "transparent",
        summary: "Anniversaire de Léa",
        start: { dateTime: "2026-09-03T07:00:00Z" },
        end: { dateTime: "2026-09-03T09:00:00Z" },
      },
    ],
  });
  assert.deepEqual(p, []);
});

cas("un agenda sans rien d'occupé ne rend rien", () => {
  assert.deepEqual(lirePeriodes({ items: [] }), []);
});

console.log("\n=== Une réponse abîmée fait MOINS d'occupation, jamais une occupation inventée ===");

cas("une entrée sans dates est ignorée, les autres passent", () => {
  // Le sens de la dégradation compte. Inventer une occupation ferait perdre
  // des journées à l'artisan sans qu'il comprenne pourquoi ; en perdre une le
  // ramène au comportement d'avant, qu'il connaît.
  const p = lirePeriodes({
    items: [
      { start: { dateTime: "2026-09-03T07:00:00Z" } },
      { end: { dateTime: "2026-09-04T09:00:00Z" } },
      { start: { dateTime: "pas une date" }, end: { dateTime: "non plus" } },
      { start: {}, end: {} },
      { start: { dateTime: "2026-09-05T07:00:00Z" }, end: { dateTime: "2026-09-05T09:00:00Z" } },
    ],
  });
  assert.equal(p.length, 1, "une entrée illisible a été devinée au lieu d'être ignorée");
  assert.equal(p[0].debut.toISOString(), "2026-09-05T07:00:00.000Z");
});

cas("une réponse vide, nulle ou d'une autre forme ne fait pas tomber la lecture", () => {
  assert.deepEqual(lirePeriodes(null), []);
  assert.deepEqual(lirePeriodes(undefined), []);
  assert.deepEqual(lirePeriodes({}), []);
  assert.deepEqual(lirePeriodes({ items: null }), []);
  assert.deepEqual(lirePeriodes({ items: "pas un tableau" }), []);
  assert.deepEqual(lirePeriodes("une chaîne"), []);
  assert.deepEqual(lirePeriodes({ items: [null, undefined, 42] }), []);
});

console.log("\n=== La permission demandée reste la plus étroite possible ===");

cas("la portée reste la lecture des événements, en lecture seule", () => {
  // **Élargie le 9 août 2026 sur sa décision** — *« si, il doit lire les
  // intitulés aussi ! »*. Elle était `freebusy`, qui ne rend que des
  // intervalles.
  //
  // Ce contrôle garde ce que l'élargissement ne doit PAS emporter :
  // `events.readonly` et rien de plus. `calendar.readonly` donnerait en plus la
  // liste des agendas, leurs partages et leurs réglages ; une portée en
  // écriture permettrait à Atlas de modifier son agenda, ce que personne n'a
  // demandé. On demande ce qu'il faut pour ce qu'il a demandé.
  assert.equal(PORTEE_GOOGLE, "https://www.googleapis.com/auth/calendar.events.readonly");
  assert.ok(/readonly$/.test(PORTEE_GOOGLE), "la portée n'est plus en lecture seule");
  assert.ok(!/calendar\.readonly|auth\/calendar$/.test(PORTEE_GOOGLE), "la portée est plus large que nécessaire");
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
