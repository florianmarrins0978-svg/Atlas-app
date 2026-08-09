import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// **Deux défauts du 9 août 2026, tenus ici — et ils n'étaient pas des lenteurs.**
//
//   1. « HTTP ERROR 404 » sur l'adresse du banc. Le serveur était MORT, et rien
//      ne le relevait. Un 404 sur cette adresse ne veut pas dire « page
//      absente » : il veut dire « plus rien n'écoute ».
//   2. « HTTP ERROR 504 » sur `/reglages/agenda`. `next dev` compilait l'écran
//      à la demande — trente à cent secondes — et le mandataire de GitHub
//      abandonnait avant. Chaque écran neuf était une page d'erreur.
//
// Ce que cette suite refuse de laisser repartir :
//
//   - le préchauffage **ne fabrique jamais de session en production** ;
//   - il **ne passe pas par le formulaire de connexion**, qui verrouillerait le
//     patron hors de son application au bout de cinq redémarrages ;
//   - il **ne plante jamais le démarrage**, quoi qu'il rencontre ;
//   - il ouvre les écrans **à la file**, jamais en parallèle ;
//   - le veilleur **exige deux conditions** avant de relancer, et un seul
//     veilleur tourne à la fois.

const RACINE = path.join(__dirname, "..");

let echecs = 0;
async function cas(nom: string, verifier: () => void | Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const { cookieDeSession, prechauffer, ECRANS_A_PRECHAUFFER } = await import("./prechauffer.mjs");

  console.log("=== Fabriquer une session : jamais en production ===");

  await cas("production : aucun cookie, quelles que soient les autres valeurs", async () => {
    // **Le refus qui compte.** Ce module sait fabriquer une session sans mot de
    // passe. C'est légitime sur un banc dont le mot de passe est public dans le
    // dépôt ; ce ne l'est nulle part ailleurs.
    const cookie = await cookieDeSession({
      databaseUrl: "postgresql://x",
      authSecret: "un-secret",
      nodeEnv: "production",
    });
    assert.equal(cookie, null, "une session a été fabriquée en production");
  });

  await cas("sans clé de signature : aucun cookie, et rien qui explose", async () => {
    assert.equal(
      await cookieDeSession({ databaseUrl: "postgresql://x", authSecret: "", nodeEnv: "development" }),
      null
    );
  });

  await cas("base injoignable : aucun cookie, et rien qui explose", async () => {
    // Le préchauffage est un confort. Un confort qui empêche un serveur de
    // démarrer coûte infiniment plus cher que le confort qu'il apporte.
    const cookie = await cookieDeSession({
      databaseUrl: "postgresql://personne:rien@127.0.0.1:1/nexiste_pas",
      authSecret: "un-secret-de-banc",
      nodeEnv: "development",
    });
    assert.equal(cookie, null);
  });

  await cas("hors production avec une vraie base : un cookie de session utilisable", async () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      // **Jamais en silence** : un contrôle sauté sans le dire se lit comme un
      // contrôle passé (`CLAUDE.md` §5).
      console.log("      (sauté : DATABASE_URL absente)");
      return;
    }
    const cookie = await cookieDeSession({
      databaseUrl: url,
      authSecret: process.env.AUTH_SECRET ?? "secret-de-banc-pour-les-essais",
      nodeEnv: "development",
    });
    assert.ok(cookie, "aucun cookie fabriqué alors que la base répond");
    assert.match(cookie!, /^authjs\.session-token=/, `nom de cookie inattendu : ${cookie}`);
  });

  console.log("\n=== Le préchauffage ne passe JAMAIS par la connexion ===");

  await cas("aucun appel au formulaire ni au point d'entrée de connexion", () => {
    // Le limiteur autorise cinq tentatives par quart d'heure et par adresse IP.
    // Sur un banc, tout arrive par la même adresse : quelques redémarrages
    // suffiraient à verrouiller le patron hors de sa propre application.
    const source = readFileSync(path.join(RACINE, "scripts", "prechauffer.mjs"), "utf8");
    const appels = source
      .split("\n")
      .filter((l) => /callback\/credentials|connexionAction|signIn\(/.test(l))
      .filter((l) => !/^\s*(\/\/|\*)/.test(l.trim()));
    assert.deepEqual(appels, [], `le préchauffage se connecte pour de bon : ${appels.join(" | ")}`);
  });

  await cas("l'écran de connexion est préchauffé, lui aussi", () => {
    // C'est le premier que le patron ouvre, et le seul qu'il voie avant d'avoir
    // une session : l'oublier, c'est lui laisser la plus longue attente de toutes.
    assert.ok(ECRANS_A_PRECHAUFFER.includes("/login"));
  });

  console.log("\n=== Ouvrir les écrans à la file, et survivre à tout ===");

  await cas("les écrans sont ouverts l'un après l'autre, jamais en parallèle", async () => {
    // Deux cœurs sur le banc. Dix compilations concurrentes le rendraient
    // injoignable pendant tout le préchauffage — le symptôme qu'on répare.
    let simultanees = 0;
    let maximum = 0;
    const fetchImpl = async () => {
      simultanees++;
      maximum = Math.max(maximum, simultanees);
      await new Promise((r) => setTimeout(r, 5));
      simultanees--;
      return { status: 200 } as Response;
    };
    await prechauffer({
      base: "http://127.0.0.1:1",
      cookie: "x=y",
      ecrans: ["/a", "/b", "/c", "/d"],
      fetchImpl,
    });
    assert.equal(maximum, 1, `${maximum} écrans compilés en même temps`);
  });

  await cas("un écran qui échoue n'arrête pas les suivants", async () => {
    const vus: string[] = [];
    const fetchImpl = async (url: string) => {
      vus.push(new URL(url).pathname);
      if (url.endsWith("/b")) throw new Error("panne simulée");
      return { status: 200 } as Response;
    };
    const bilan = await prechauffer({
      base: "http://127.0.0.1:1",
      cookie: "x=y",
      ecrans: ["/a", "/b", "/c"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.deepEqual(vus, ["/a", "/b", "/c"], "le préchauffage s'est arrêté au premier échec");
    assert.equal(bilan.reussis, 2);
    assert.equal(bilan.echoues, 1);
  });

  await cas("une redirection vers /login compte comme un échec, pas comme un succès", async () => {
    // **Le piège qui rendrait cette suite inutile.** Sans session valable, le
    // middleware renvoie un 307 vers `/login` sans rien compiler. Compter ce 307
    // comme une réussite ferait afficher « 15 écrans prêts » alors qu'aucun ne
    // l'est — un contrôle qui affirme au lieu de vérifier.
    const bilan = await prechauffer({
      base: "http://127.0.0.1:1",
      cookie: undefined,
      ecrans: ["/planning"],
      fetchImpl: (async () => ({ status: 307 })) as unknown as typeof fetch,
    });
    assert.equal(bilan.reussis, 0, "une redirection a été comptée comme un écran prêt");
  });

  console.log("\n=== Les écrans de chantier : lus sur l'écran, jamais en base ===");

  await cas("l'identifiant vient de l'accueil, et les cinq écrans en découlent", async () => {
    const { ecransDeChantier } = await import("./prechauffer.mjs");
    const html = '<a href="/chantiers/5be0e3fe-0449-4bdc-ad8e-91d9658cd77b">Chez M. Martins</a>';
    const ecrans = await ecransDeChantier({
      base: "http://127.0.0.1:1",
      cookie: "x=y",
      fetchImpl: (async () => ({ status: 200, text: async () => html })) as unknown as typeof fetch,
    });
    assert.deepEqual(ecrans, [
      "/chantiers/5be0e3fe-0449-4bdc-ad8e-91d9658cd77b",
      "/chantiers/5be0e3fe-0449-4bdc-ad8e-91d9658cd77b/informations",
      "/chantiers/5be0e3fe-0449-4bdc-ad8e-91d9658cd77b/note-vocale",
      "/chantiers/5be0e3fe-0449-4bdc-ad8e-91d9658cd77b/prix",
      "/chantiers/5be0e3fe-0449-4bdc-ad8e-91d9658cd77b/devis-complet",
    ]);
  });

  await cas("aucun chantier sur l'accueil : liste vide, pas d'exception", async () => {
    const { ecransDeChantier } = await import("./prechauffer.mjs");
    assert.deepEqual(
      await ecransDeChantier({
        base: "http://127.0.0.1:1",
        cookie: "x=y",
        fetchImpl: (async () => ({ status: 200, text: async () => "<p>Aucun chantier</p>" })) as unknown as typeof fetch,
      }),
      []
    );
  });

  await cas("le préchauffage n'interroge JAMAIS la table chantiers en direct", () => {
    // **Le piège de la RLS, tombé dedans le 9 août 2026.** Le premier jet
    // faisait `select id from chantiers` sous le rôle applicatif : zéro ligne,
    // aucune erreur, et le préchauffage annonçait « 11 écrans prêts » en sautant
    // en silence les cinq plus lourds. Hors de `withEntreprise`, une requête ne
    // renvoie rien — *silencieusement* (`CLAUDE.md` §3).
    const source = readFileSync(path.join(RACINE, "scripts", "prechauffer.mjs"), "utf8");
    const requetes = source
      .split("\n")
      .filter((l) => /from chantiers/i.test(l))
      .filter((l) => !/^\s*(\/\/|\*)/.test(l.trim()));
    assert.deepEqual(requetes, [], `requête directe sur les chantiers : ${requetes.join(" | ")}`);
  });

  console.log("\n=== Le veilleur : deux conditions, et un seul veilleur ===");

  const VEILLEUR = readFileSync(path.join(RACINE, ".devcontainer", "veiller.sh"), "utf8");

  await cas("il exige que la santé ET le processus soient absents avant de relancer", () => {
    // Sur le seul critère de la santé, une grosse compilation ferait lancer un
    // second serveur, qui se battrait avec le premier pour le port 3000.
    assert.match(VEILLEUR, /health\/live/, "le veilleur n'interroge pas la santé");
    assert.match(VEILLEUR, /pgrep -f/, "le veilleur ne regarde pas si un serveur tourne déjà");
  });

  await cas("le motif de recherche ne peut pas se trouver lui-même", () => {
    // `pgrep -f 'next dev'` trouverait la ligne de commande de ce script et
    // conclurait toujours que le serveur tourne. Les crochets l'évitent.
    assert.match(VEILLEUR, /\[n\]ext dev/, "le motif se trouverait lui-même");
  });

  await cas("un seul veilleur à la fois, et un verrou périmé ne bloque rien", () => {
    assert.match(VEILLEUR, /atlas-veilleur\.pid/, "aucun verrou : deux veilleurs relanceraient deux serveurs");
    assert.match(VEILLEUR, /kill -0/, "le verrou n'est pas vérifié : un fichier oublié bloquerait tout démarrage");
  });

  await cas("le démarrage de l'espace lance le veilleur, plus le serveur seul", () => {
    const demarrage = readFileSync(path.join(RACINE, ".devcontainer", "demarrer.sh"), "utf8");
    assert.match(demarrage, /veiller\.sh/, "le démarrage ne pose aucun veilleur : un serveur mort le reste");
    const lancements = demarrage
      .split("\n")
      .filter((l) => /setsid.*npm run essai/.test(l))
      .filter((l) => !/^\s*#/.test(l.trim()));
    assert.deepEqual(lancements, [], `le serveur est encore lancé sans veilleur : ${lancements.join(" | ")}`);
  });

  console.log("\n=== Et deux serveurs ne se battent plus pour le port ===");

  await cas("`npm run essai` s'arrête quand quelque chose répond déjà", () => {
    const source = readFileSync(path.join(RACINE, "scripts", "essai.mjs"), "utf8");
    const iGarde = source.indexOf("if (await repond())");
    const iSpawn = source.indexOf('spawn("npx"');
    assert.ok(iGarde > 0, "aucune garde : une commande tapée par erreur relance un second serveur");
    assert.ok(iGarde < iSpawn, "la garde arrive après le lancement : elle ne sert plus à rien");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Préchauffage et veilleur — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

void main();
