import assert from "node:assert/strict";
import { messageDePanne, type EtapeNote } from "../src/lib/panne-note-vocale";
import { diagnostiquerLiaison, phraseDeLiaison } from "../src/lib/diagnostic-liaison";

// **Une panne d'enregistrement nomme le maillon qui a cassé.**
//
// Le patron, le 12 août 2026, capture à l'appui : *« L'enregistrement n'a pas pu
// être transmis — la connexion a été interrompue. »* C'était la phrase de
// secours de l'écran, et elle **accusait le mauvais coupable** : l'aller-retour
// avait très bien eu lieu, c'est le serveur qui avait échoué. Il cherchait du
// côté de son réseau pendant que la panne était ailleurs.
//
// La veille, les refus ATTENDUS avaient été rendus bavards — format, taille,
// cadence, enregistrement vide. Les pannes IMPRÉVUES, elles, continuaient de
// lever : le correctif était à moitié fait, et la moitié manquante était
// précisément celle qui se produisait.
//
// Ce contrôle tient les deux choses qui comptent :
//
//   1. **chaque étape rend une phrase qui la nomme** — sans quoi le patron ne
//      peut rien rapporter, et il faut lui demander d'aller lire un journal ;
//   2. **les pannes qui appellent un geste précis ont leur propre phrase.** Le
//      disque plein en est le cas d'école : « le serveur n'a pas pu écrire »
//      envoie chercher un défaut d'application, alors que la réponse tient en
//      un mot et qu'aucun correctif de code n'y changera rien.
//
// Fonction pure, éprouvée sans base ni navigateur (`CLAUDE.md` §3) : la règle
// qui choisit la phrase ne doit pas dépendre d'un serveur pour être vérifiable.

let passed = 0;
let failed = 0;

function test(nom: string, verifier: () => void) {
  try {
    verifier();
    passed++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Une panne d'enregistrement désigne le bon coupable ===\n");

const ETAPES: EtapeNote[] = ["session", "cadence", "lecture", "stockage", "base"];

test("chaque étape est nommée dans la phrase rendue", () => {
  for (const etape of ETAPES) {
    const phrase = messageDePanne(etape, new Error("panne quelconque"));
    assert.ok(
      phrase.includes(`étape : ${etape}`),
      `l'étape « ${etape} » n'apparaît pas : le patron ne pourrait pas la rapporter. Reçu : ${phrase}`
    );
  }
});

test("aucune phrase n'est vide ni bâclée", () => {
  for (const etape of ETAPES) {
    const phrase = messageDePanne(etape, new Error("x"));
    assert.ok(phrase.length > 40, `la phrase de « ${etape} » est trop courte pour dire quoi faire : ${phrase}`);
  }
});

test("le disque plein le dit, au lieu d'accuser l'application", () => {
  // C'est le cas qui coûtait le plus cher : sans lui, le patron aurait cherché
  // un défaut dans le code, alors qu'il n'y en a aucun à trouver.
  for (const brut of [
    "ENOSPC: no space left on device, write",
    "Error: no space left on device",
  ]) {
    const phrase = messageDePanne("stockage", new Error(brut));
    assert.ok(/disque/i.test(phrase) && /plein/i.test(phrase), `« ${brut} » n'est pas traduit : ${phrase}`);
    assert.ok(phrase.includes("étape : stockage"), "l'étape reste nommée même sur une panne reconnue");
  }
});

test("un service absent invite à réessayer, pas à recommencer la note", () => {
  const phrase = messageDePanne("cadence", new Error("connect ECONNREFUSED 127.0.0.1:6379"));
  assert.ok(/répond pas|réessayez/i.test(phrase), `phrase inattendue : ${phrase}`);
});

test("un droit d'écriture manquant ne se confond pas avec un disque plein", () => {
  const phrase = messageDePanne("stockage", new Error("EACCES: permission denied, open '/data/x'"));
  assert.ok(/droit/i.test(phrase), `phrase inattendue : ${phrase}`);
  assert.ok(!/plein/i.test(phrase), "un droit refusé n'est pas un disque plein");
});

test("la session expirée dit de recharger ET rassure sur la note", () => {
  const phrase = messageDePanne("session", new Error("no session"));
  assert.ok(/rechargez/i.test(phrase), `phrase inattendue : ${phrase}`);
});

test("rien de la tuyauterie ne fuit à l'écran", () => {
  // Le 11 août, une erreur de base non traduite a affiché la requête SQL
  // entière — noms de tables et identifiant d'entreprise compris.
  const sql =
    'Failed query: insert into "notes_vocales" ("id", "entreprise_id") values ($1, $2) ' +
    "params: 5b88c787-42d6-4bc8-a3ed-86e4c7942339";
  const phrase = messageDePanne("base", new Error(sql));
  for (const interdit of ["insert into", "notes_vocales", "entreprise_id", "5b88c787"]) {
    assert.ok(
      !phrase.includes(interdit),
      `« ${interdit} » se retrouve à l'écran : la tuyauterie fuit. Reçu : ${phrase}`
    );
  }
});

test("une erreur sans message ne casse pas la traduction", () => {
  // Une valeur lancée qui n'est pas une Error — cela arrive, et un contrôle qui
  // ne l'éprouve pas laisse passer un plantage dans le gestionnaire de plantage.
  for (const bizarre of [undefined, null, "", 42, {}]) {
    const phrase = messageDePanne("stockage", bizarre);
    assert.ok(phrase.includes("étape : stockage"), `cassé sur ${JSON.stringify(bizarre)} : ${phrase}`);
  }
});

// ─── Le diagnostic de liaison ────────────────────────────────────────────────
//
// La phrase « la connexion a été interrompue » était une SUPPOSITION déguisée en
// constat : l'écran ne savait rien de la connexion, il savait seulement que
// l'appel avait échoué. Trois pannes très différentes échouent de la même
// façon, et une seule requête les sépare.

const reponse = (ok: boolean) => ({ ok }) as Response;

async function testAsync(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    passed++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("\n=== Quand l'envoi n'aboutit pas : qui est en cause ? ===\n");

  await testAsync("serveur qui répond → la page a vieilli, pas le réseau", async () => {
    const etat = await diagnostiquerLiaison(async () => reponse(true));
    assert.equal(etat, "page-vieillie");
    // C'est le cas du banc : l'espace se reconstruit, les actions changent
    // d'identifiant, et la page ouverte avant appelle une action disparue.
    assert.ok(/Rechargez/i.test(phraseDeLiaison(etat)), "la phrase doit dire de recharger");
    assert.ok(
      !/connexion|réseau/i.test(phraseDeLiaison(etat)),
      "elle ne doit surtout PAS accuser le réseau : le serveur vient de répondre"
    );
  });

  await testAsync("serveur qui répond mal → il redémarre", async () => {
    const etat = await diagnostiquerLiaison(async () => reponse(false));
    assert.equal(etat, "serveur-en-peine");
    assert.ok(/redémarr/i.test(phraseDeLiaison(etat)), "la phrase doit parler du redémarrage");
  });

  await testAsync("serveur injoignable → là, et seulement là, on parle de connexion", async () => {
    const etat = await diagnostiquerLiaison(async () => {
      throw new Error("Failed to fetch");
    });
    assert.equal(etat, "hors-ligne");
    assert.ok(/connexion/i.test(phraseDeLiaison(etat)), "la phrase doit parler de la connexion");
  });

  await testAsync("le diagnostic ne lève JAMAIS, il est appelé depuis un catch", async () => {
    // Une panne du diagnostic remplacerait le message par une page blanche : le
    // patron perdrait à la fois sa note et l'explication.
    for (const sonde of [
      async () => { throw new Error("boum"); },
      async () => { throw "pas une Error"; },
      async () => null as unknown as Response,
    ]) {
      const etat = await diagnostiquerLiaison(sonde as (url: string) => Promise<Response>);
      assert.ok(phraseDeLiaison(etat).length > 40, `phrase absente pour un diagnostic en panne : ${etat}`);
    }
  });

  console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} test(s) réussi(s), ${failed} échoué(s).`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
