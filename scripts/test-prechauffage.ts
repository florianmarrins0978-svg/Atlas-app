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

  await cas("base injoignable : aucun cookie, et le message accuse LA BASE", async () => {
    // **Ce message a menti le 9 août 2026.** PostgreSQL s'était arrêté sur la
    // machine ; le démarrage annonçait « Préchauffage impossible : pas de
    // session », ce qui envoyait chercher du côté des comptes et des jetons. La
    // vraie phrase était `ECONNREFUSED 127.0.0.1:5432` — la base ne répondait
    // pas, donc AUCUN écran ne pouvait fonctionner. Une erreur qui accuse à
    // tort coûte plus cher que pas d'erreur du tout.
    //
    // Le préchauffage reste par ailleurs un confort : il ne doit jamais
    // empêcher un serveur de démarrer.
    const dits: string[] = [];
    const cookie = await cookieDeSession({
      databaseUrl: "postgresql://personne:rien@127.0.0.1:1/nexiste_pas",
      authSecret: "un-secret-de-banc",
      nodeEnv: "development",
      ecrire: (r: string) => {
        dits.push(r);
      },
    });
    assert.equal(cookie, null);
    assert.equal(dits.length, 1, `attendu une raison, reçu : ${JSON.stringify(dits)}`);
    assert.match(
      dits[0],
      /BASE DE DONNÉES NE RÉPOND PAS/,
      `le message enverrait chercher au mauvais endroit : « ${dits[0]} »`
    );
  });

  await cas("l'état du préchauffage vit dans /tmp, jamais dans le dépôt", async () => {
    // Un fichier neuf à la racine salirait l'arbre git, et `mettre-a-jour.sh`
    // refuserait alors TOUTES les mises à jour suivantes : le remède créerait
    // la panne. Même piège, même règle que le journal de mise à jour.
    const { ETAT_PRECHAUFFAGE } = await import("./prechauffer.mjs");
    assert.match(ETAT_PRECHAUFFAGE, /^\/tmp\//, `l'état est déposé dans ${ETAT_PRECHAUFFAGE}`);
  });

  console.log("\n=== L'écran d'état, lisible depuis un téléphone ===");

  await cas("il ne touche ni la base ni les dépôts : il doit répondre quand tout est mort", () => {
    // Cette page sert quand plus rien ne marche. Une seule requête en base, et
    // elle tomberait exactement au moment où on en a besoin.
    const source = readFileSync(
      path.join(RACINE, "src", "app", "api", "health", "banc", "route.ts"),
      "utf8"
    );
    const imports = source
      .split("\n")
      .filter((l) => /^import /.test(l))
      .filter((l) => /@\/server\/(db|repositories)|drizzle|withEntreprise/.test(l));
    assert.deepEqual(imports, [], `la page d'état interroge la base : ${imports.join(" | ")}`);
  });

  await cas("aucune astérisque de mise en forme ne peut atterrir à l'écran", () => {
    // **Vu sur l'écran, jamais dans le code.** Le premier jet écrivait `**…**`
    // au milieu d'une phrase : le patron lisait les astérisques en clair.
    const source = readFileSync(
      path.join(RACINE, "src", "app", "api", "health", "banc", "route.ts"),
      "utf8"
    );
    const fautives = source
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l.trim()))
      .filter((l) => /"[^"]*\*\*/.test(l));
    assert.deepEqual(fautives, [], `du gras en astérisques part vers l'écran : ${fautives.join(" | ")}`);
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

  console.log("\n=== Quand rien ne se compile, dire POURQUOI ===");

  await cas("neuf renvois vers /documents-legaux : la cause est nommée", async () => {
    // **Trouvé en jouant le démarrage pour de bon, pas en le relisant.** Le
    // compte choisi n'avait pas accepté les documents légaux : neuf écrans sur
    // onze partaient en redirection, et le bilan disait « 9 en échec » sans
    // dire de quoi. Une ligne d'échec qui laisse chercher la cause coûte plus
    // cher que pas de ligne du tout (`AGENTS.md`).
    const { expliquerObstacle } = await import("./prechauffer.mjs");
    const bilan = await prechauffer({
      base: "http://127.0.0.1:1",
      cookie: "x=y",
      ecrans: ["/", "/planning", "/termines", "/reglages"],
      fetchImpl: (async () => ({
        status: 307,
        headers: { get: () => "/documents-legaux" },
      })) as unknown as typeof fetch,
    });
    assert.equal(bilan.renvoiDominant?.vers, "/documents-legaux");
    assert.match(expliquerObstacle(bilan.renvoiDominant)!, /accepter les documents légaux/);
  });

  await cas("une session refusée est nommée autrement qu'un document non accepté", async () => {
    const { expliquerObstacle } = await import("./prechauffer.mjs");
    assert.match(
      expliquerObstacle({ vers: "/login", combien: 9 })!,
      /AUTH_SECRET/,
      "le message enverrait chercher au mauvais endroit"
    );
  });

  await cas("un seul renvoi isolé n'accuse personne", async () => {
    // Un écran qui redirige légitimement ne doit pas faire afficher un
    // diagnostic général qui serait faux.
    const { expliquerObstacle } = await import("./prechauffer.mjs");
    assert.equal(expliquerObstacle(null), null);
  });

  await cas("le compte du banc est choisi nommément, pas « le plus ancien »", () => {
    const source = readFileSync(path.join(RACINE, "scripts", "prechauffer.mjs"), "utf8");
    assert.match(
      source,
      /demo@atlas\.local/,
      "le préchauffage prend le compte le plus ancien : sur une base ayant servi " +
        "aux suites de tests, ce n'est pas celui du banc, et rien ne se compile"
    );
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
    assert.match(VEILLEUR, /\[n\]ext/, "le motif se trouverait lui-même");
  });

  await cas("le motif attrape `next-server`, pas seulement `next dev`", () => {
    // **La cause première du 404 du patron, trouvée en regardant les processus
    // de cette machine :**
    //
    //     27577 npm exec next dev -H 0.0.0.0 -p 3000   ← enveloppe
    //     29803 next-server (v16.2.12)                 ← CELUI QUI ÉCOUTE
    //
    // Un motif limité à « next dev » tue les enveloppes et laisse le vrai
    // serveur orphelin, accroché au port. Le suivant ne peut plus s'y attacher,
    // et l'orphelin sert un cache périmé : toutes les pages en 404.
    for (const [nom, source] of [
      ["veiller.sh", VEILLEUR],
      ["demarrer.sh", readFileSync(path.join(RACINE, ".devcontainer", "demarrer.sh"), "utf8")],
    ] as const) {
      assert.match(
        source,
        /\[n\]ext\(-server\| dev\)/,
        `${nom} ne vise que les enveloppes : le vrai serveur survivra, accroché au port`
      );
    }
  });

  await cas("un serveur muet qui tient le port finit par être délogé", () => {
    // Sans cela, le cas le plus vicieux n'est pas couvert : un serveur présent
    // (donc `pgrep` le trouve, donc on ne relance pas) mais qui ne répond plus.
    // La boucle tournerait pour toujours sans rien faire.
    assert.match(VEILLEUR, /pkill -f "\$MOTIF"/, "le veilleur ne déloge jamais un serveur muet");
    assert.match(VEILLEUR, /MUET/, "aucune patience avant de déloger : une compilation lourde suffirait");
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

  await cas("ce que le premier passage a constaté survit à l'`exec`", () => {
    // **Le défaut le plus grave trouvé ce jour-là, et il annulait le correctif
    // du matin.** `demarrer.sh` se relance dans sa version neuve après une mise
    // à jour. Le second passage recalcule tout : la mise à jour répond alors
    // « à jour », et `MIGRATIONS` n'existe plus du tout. Or l'avertissement
    // « LA BASE N'A PAS SUIVI LE CODE » ne se déclenche QU'APRÈS une mise à
    // jour — c'est-à-dire exactement dans le cas où l'`exec` effaçait la
    // variable. Il ne pouvait donc plus jamais s'afficher.
    // **Ce cas a d'abord été un faux vert, et c'est instructif.** Écrit avec
    // `indexOf`, il trouvait la ligne même mise en commentaire : j'ai retiré la
    // transmission pour l'éprouver, et il est resté au vert. Un contrôle qui ne
    // sait pas échouer ne prouve rien (`AGENTS.md`) — on ne cherche donc que
    // dans les lignes qui s'exécutent, et on raisonne en numéros de ligne.
    const lignes = readFileSync(path.join(RACINE, ".devcontainer", "demarrer.sh"), "utf8")
      .split("\n")
      .map((texte, numero) => ({ numero, texte: texte.trim() }))
      .filter((l) => !l.texte.startsWith("#"));
    const ou = (motif: RegExp) => lignes.find((l) => motif.test(l.texte))?.numero ?? -1;

    const iExport = ou(/^export ATLAS_MIGRATIONS=/);
    const iExec = ou(/^exec bash/);
    const iRepriseMigrations = ou(/^MIGRATIONS="\$\{ATLAS_MIGRATIONS:-/);
    const iRepriseMiseAJour = ou(/^MISE_A_JOUR="\$\{ATLAS_MISE_A_JOUR:-/);

    assert.ok(iExec >= 0, "le script ne se relance plus : ce cas n'éprouve plus rien.");
    assert.ok(iExport >= 0, "le constat des migrations ne traverse pas la relance.");
    assert.ok(iExport < iExec, "il est transmis après la relance : trop tard.");
    assert.ok(
      iRepriseMigrations > iExec,
      "il n'est jamais repris après la relance : l'avertissement « LA BASE N'A PAS SUIVI » ne s'affichera plus jamais."
    );
    assert.ok(
      iRepriseMiseAJour > iExec,
      "le démarrage annoncera « Déjà à jour » juste après avoir mis à jour."
    );
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
