import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

  // **Le défaut du 14 août 2026 : une liste écrite à la main qui a pris du
  // retard sur l'application, en silence.**
  //
  // Réglages avait été découpé en sept sous-écrans ; la liste nommait encore
  // l'ancienne organisation. `/reglages/equipe` n'y figurait pas — donc jamais
  // compilé d'avance, donc ouvert à froid pendant que la construction occupait
  // les deux cœurs du patron, donc abandonné par le relais de GitHub avant
  // d'arriver. Son signalement était d'une précision exemplaire : *« Surtout la
  // page équipe. »*
  //
  // **Rien ne pouvait rougir**, et c'est tout le problème d'une liste : un écran
  // ajouté ailleurs ne s'y ajoute pas tout seul. On la confronte donc aux
  // dossiers réellement présents, plutôt qu'à ce qu'on croit savoir.
  await cas("aucun écran de Réglages n'a été oublié depuis le découpage", () => {
    const dossier = path.join(RACINE, "src", "app", "reglages");
    const sousEcrans = readdirSync(dossier, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(path.join(dossier, e.name, "page.tsx")))
      .map((e) => `/reglages/${e.name}`);
    assert.ok(sousEcrans.length >= 5, `seulement ${sousEcrans.length} sous-écrans trouvés : le chemin a bougé`);
    const oublies = sousEcrans.filter((c) => !ECRANS_A_PRECHAUFFER.includes(c));
    assert.deepEqual(
      oublies,
      [],
      `jamais compilé(s) d'avance, donc hors d'atteinte sur son banc : ${oublies.join(", ")}`
    );
  });

  await cas("les écrans de premier rang y sont tous", () => {
    // Ceux que la barre du bas propose : les oublier revient à laisser une
    // attente d'une minute derrière un onglet.
    for (const chemin of ["/", "/planning", "/termines", "/reglages"]) {
      assert.ok(ECRANS_A_PRECHAUFFER.includes(chemin), `${chemin} manque à la liste`);
    }
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

  // **Cinq écrans ET la route du PDF, depuis le 30 août 2026.** La feuille de
  // chantier en PDF met 45 à 50 s à se compiler la première fois, et le serveur
  // ne répond plus à rien pendant ce temps : elle est donc préchauffée comme
  // les écrans (`API_DE_CHANTIER`). Ce contrôle fixe la LISTE, pas seulement le
  // nombre : une entrée qui s'ajouterait par mégarde ferait payer une
  // compilation à chaque démarrage du banc.
  await cas("l'identifiant vient de l'accueil, et les écrans en découlent", async () => {
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
      "/api/chantiers/5be0e3fe-0449-4bdc-ad8e-91d9658cd77b/feuille/pdf",
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
      // Trois formes à couvrir : les enveloppes de développement (`next dev`),
      // celles de la version bâtie (`next start`), et surtout le processus qui
      // écoute réellement, qui se renomme `next-server`.
      // Les deux styles de guillemets sont utilisés : simples dans `veiller.sh`
      // (motif figé), doubles dans `demarrer.sh` (appel direct à `pkill`).
      const motif = source.match(/\[n\]ext\(([^)]*)\)/)?.[1] ?? "";
      for (const forme of ["-server", " dev", " start"]) {
        assert.ok(
          motif.split("|").includes(forme),
          `${nom} ne vise pas « next${forme} » : ce serveur-là survivra, accroché au port`
        );
      }
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

  await cas("le constat des migrations arrive intact jusqu'au bandeau", () => {
    // **Ce cas éprouvait la survie d'un `exec` qui n'existe plus.** Le script se
    // relançait dans sa version neuve, et le second passage recalculait tout :
    // « Déjà à jour » juste après une mise à jour, et surtout l'avertissement
    // « LA BASE N'A PAS SUIVI LE CODE » qui ne pouvait PLUS JAMAIS s'afficher.
    //
    // L'`exec` a été retiré le soir même, pour une raison plus grave encore :
    // c'était l'endroit précis où le démarrage du patron mourait. Le constat
    // arrive donc désormais au bandeau sans traverser quoi que ce soit — et
    // c'est cela qu'on vérifie, plutôt que la mécanique qui le transportait.
    const lignes = readFileSync(path.join(RACINE, ".devcontainer", "demarrer.sh"), "utf8")
      .split("\n")
      .map((texte, numero) => ({ numero, texte: texte.trim() }))
      .filter((l) => !l.texte.startsWith("#"));
    const ou = (motif: RegExp) => lignes.find((l) => motif.test(l.texte))?.numero ?? -1;

    const iPose = ou(/^MIGRATIONS="\$\(bash/);
    const iAvertissement = ou(/LA BASE N'A PAS SUIVI LE CODE/);
    assert.ok(iPose >= 0, "les migrations ne sont plus jouées au démarrage");
    assert.ok(iAvertissement > iPose, "l'avertissement ne peut plus voir le constat des migrations");
    assert.deepEqual(
      lignes.filter((l) => /^exec bash "\$0"/.test(l.texte)),
      [],
      "la relance est revenue : c'est là que le démarrage mourait"
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

  // **Le gardien du banc doit être posé AVANT la construction, pas après.**
  //
  // `banc.mjs` sert d'abord et bâtit ensuite : entre le lancement du serveur et
  // la fin de la construction, il s'écoule plusieurs minutes. Ses gestionnaires
  // de `SIGTERM` vivaient à la fin du fichier, c'est-à-dire après cette
  // attente : un signal reçu dans la fenêtre tuait le script net, et le
  // serveur — détaché — survivait, accroché au port.
  //
  // Ce n'est pas théorique : `verifier-connexion-avec-serveur.mts` tue le
  // groupe dès la connexion éprouvée, sans attendre la construction. Quatre
  // batteries de suite ont fini sur « Le port 3000 est déjà pris », et l'une
  // d'elles a fait accuser le calcul du prix.
  await cas("`banc.mjs` installe son gardien de signal AVANT d'attendre quoi que ce soit", () => {
    const source = readFileSync(path.join(RACINE, "scripts", "banc.mjs"), "utf8");
    // **`let serveur = ` et non la condition qui suit.** Le 31 août 2026, la
    // condition est passée de `raison ?` à `modeDeveloppement ?` — le lancement
    // du serveur n'avait pas bougé d'une ligne, et ce contrôle a pourtant rougi
    // en annonçant qu'il « n'éprouve rien ». Un repère doit viser ce qu'on
    // défend, pas la façon dont c'était écrit le jour où on l'a posé.
    const iLancement = source.indexOf("let serveur = ");
    const iGardien = source.indexOf('process.on(signal, () => {');
    assert.ok(iLancement > 0, "le lancement du serveur est introuvable : ce contrôle n'éprouve rien");
    assert.ok(iGardien > 0, "aucun gestionnaire de signal : fermer le banc laisserait son serveur sur le port");
    assert.ok(
      iGardien > iLancement,
      "le gardien est posé avant que le serveur existe : il ne tuerait rien"
    );
    // L'attente longue du fil principal : la construction. Tout ce qui est
    // installé après elle ne protège pas pendant ces minutes-là — et c'est
    // exactement la fenêtre où le signal arrivait.
    const iConstruction = source.search(/process\.execPath, \[NEXT, "build"\]/);
    assert.ok(
      iConstruction > 0,
      "la construction est introuvable : ce contrôle ne sait plus où est la fenêtre qu'il surveille"
    );
    assert.ok(
      iGardien < iConstruction,
      "le gardien est installé APRÈS la construction : pendant ces minutes, un SIGTERM laisse un serveur orphelin sur le port"
    );
  });

  // **Et la batterie navigateur doit REFUSER un port déjà pris.** Sans cette
  // garde, elle se rabat en silence sur l'occupant : cinquante suites
  // travaillent alors sur un serveur qu'elle n'a pas lancé, et leur résultat ne
  // veut plus rien dire — ni vert, ni rouge.
  //
  // **On vérifie l'EFFET, pas la présence.** Une première version de ce
  // contrôle cherchait le nom de la fonction dans le fichier : neutraliser la
  // garde d'un `if (false && …)` la laissait verte. Un contrôle qui se contente
  // de trouver un mot ne protège que du mot.
  await cas("`run-e2e-tests` refuse de continuer si quelque chose écoute déjà", () => {
    const source = readFileSync(path.join(RACINE, "scripts", "run-e2e-tests.ts"), "utf8");
    const iGarde = source.indexOf('if (await quelquUnEcouteDeja("http://localhost:3000');
    // **Ce repère a vieilli, et le contrôle est resté vert d'un côté et muet de
    // l'autre — 2 septembre 2026.** `run-e2e-tests.ts` lançait `npm run dev` ;
    // le commit `3cd0d21` l'a remplacé par l'exécutable Node et le binaire du
    // projet, pour que le journal du serveur cesse d'être avalé. Personne n'a
    // reporté le changement ici : `iSpawn` valait -1, et l'assertion qui vient
    // ensuite — la garde arrive-t-elle AVANT le lancement ? — n'éprouvait plus
    // rien du tout. Elle rougissait sur du code juste.
    //
    // On vise donc le lancement du serveur par ce qu'il EST — un `spawn` qui
    // demande `dev` sur le port 3000 —, pas par la commande qui le porte, qui a
    // déjà changé deux fois.
    //
    // **Sans le drapeau `s`, et ce n'est pas un détail de style :** la cible de
    // `tsconfig.json` est antérieure à ES2018, et `tsc` refuse ce drapeau
    // (TS1501). Il ne servait à rien ici — `[^)]` accepte déjà les retours à la
    // ligne, seul un `.` aurait eu besoin de lui.
    const iSpawn = source.search(/spawn\([^)]*"dev"[^)]*"-p", "3000"/);
    assert.ok(
      iGarde > 0,
      "aucune garde en tête de batterie : un orphelin du banc rendrait les cinquante suites ininterprétables"
    );
    assert.ok(iSpawn > 0, "le démarrage du serveur est introuvable : ce contrôle n'éprouve rien");
    assert.ok(iGarde < iSpawn, "la garde arrive après le lancement : elle ne protège plus de rien");
    // Et elle doit ARRÊTER, pas seulement prévenir : un avertissement dans un
    // journal de deux mille lignes n'a jamais retenu personne.
    const corps = source.slice(iGarde, iGarde + 900);
    assert.match(
      corps,
      /process\.exit\(1\)/,
      "la garde constate le port occupé mais laisse la batterie continuer : elle ne sert à rien"
    );
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Préchauffage et veilleur — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

void main();
