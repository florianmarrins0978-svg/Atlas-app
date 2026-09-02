import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **Le port privé — la troisième fois que la même méprise coûte une soirée.**
//
// Le 10 août 2026, le diagnostic du patron a rapporté ceci : l'application
// saine de l'intérieur (200, `text/html`), et à l'adresse publique une page
// `/pf-signin?...` — **GitHub qui répond à la place d'Atlas**. Le port était
// privé ; depuis son téléphone, non connecté à GitHub, il n'y avait rien.
//
// Or `devcontainer.json` déclare `visibility: "public"` depuis le 6 août. La
// déclaration n'était pas fausse : elle était **inerte**, parce que ce fichier
// n'est appliqué qu'à la CRÉATION de l'espace de travail, et que le sien est
// plus ancien. C'est exactement le piège d'`ATLAS_BANC_ESSAI` dans
// `docker-compose.yml` (voir `src/profil-banc.ts`), pour la troisième fois.
//
// D'où `ouvrir-port.sh`, rejoué à chaque allumage. Cette suite l'éprouve avec un
// FAUX `gh` posé devant le vrai dans le PATH : l'agent n'a pas d'espace GitHub,
// et un contrôle qu'on ne peut pas jouer ne prouve rien. Ce que le faux `gh`
// permet de tenir, et qui compte :
//
//   1. la commande envoyée est bien celle qui publie le port, avec le nom de
//      l'espace — une commande approchante ne ferait rien, en silence ;
//   2. `gh` absent ou en échec ne fait JAMAIS tomber le démarrage, et se dit —
//      un banc pénible vaut mieux qu'un banc mort, mais un banc pénible qui se
//      tait renvoie chercher ailleurs pendant une soirée ;
//   3. hors d'un espace GitHub, on n'invente rien.

const SCRIPT = path.join(__dirname, "..", ".devcontainer", "ouvrir-port.sh");
const DEMARRER = path.join(__dirname, "..", ".devcontainer", "demarrer.sh");

let echecs = 0;
const dossier = mkdtempSync(path.join(tmpdir(), "atlas-port-"));
const TRACE = path.join(dossier, "appel.txt");

/** Pose un faux `gh` devant le vrai, et rend le dossier à placer en tête du PATH. */
function fauxGh(codeSortie: number): string {
  const bac = path.join(dossier, `gh-${codeSortie}`);
  execFileSync("mkdir", ["-p", bac]);
  const faux = path.join(bac, "gh");
  writeFileSync(faux, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${TRACE}"\nexit ${codeSortie}\n`);
  chmodSync(faux, 0o755);
  return bac;
}

/**
 * Un faux `gh` qui distingue ses deux sous-commandes.
 *
 * `visibility` échoue avec la raison donnée ; `ports` rend la liste donnée.
 * C'est ce qu'il fallait pour éprouver la question posée depuis le 23 août
 * 2026 : *le relais connaît-il seulement ce port ?*
 */
function fauxGhDeuxTemps(raison: string, liste: string): string {
  const bac = path.join(dossier, `gh-deux-${Buffer.from(raison + liste).toString("hex").slice(0, 12)}`);
  execFileSync("mkdir", ["-p", bac]);
  const faux = path.join(bac, "gh");
  writeFileSync(
    faux,
    `#!/usr/bin/env bash\ncase "$*" in\n  *visibility*) printf '%s\\n' ${JSON.stringify(raison)} >&2; exit 1;;\n  *ports*) printf '%s\\n' ${JSON.stringify(liste)};;\nesac\n`
  );
  chmodSync(faux, 0o755);
  return bac;
}

function jouer(env: Record<string, string>, chemin?: string): string {
  return execFileSync("bash", [SCRIPT, "3000"], {
    env: {
      NODE_ENV: "test",
      PATH: chemin ? `${chemin}:${process.env.PATH ?? "/usr/bin:/bin"}` : "/usr/bin:/bin",
      ...env,
    },
    encoding: "utf8",
  }).trim();
}

function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Le port du banc, ouvert à chaque allumage ===\n");

cas("hors d'un espace GitHub, on n'invente rien", () => {
  assert.equal(jouer({}), "hors-codespace");
});

cas("dans un espace, le port est publié — et la commande est la bonne", () => {
  if (existsSync(TRACE)) rmSync(TRACE);
  const sortie = jouer({ CODESPACE_NAME: "reimagined-space-yodel" }, fauxGh(0));
  assert.equal(sortie, "ouvert", `attendu « ouvert », reçu « ${sortie} »`);
  const appel = readFileSync(TRACE, "utf8").trim();
  assert.equal(
    appel,
    "codespace ports visibility 3000:public -c reimagined-space-yodel",
    `la commande envoyée à gh n'est pas celle qui publie le port : « ${appel} »`
  );
});

cas("gh en échec : on le DIT, AVEC SA RAISON, et le démarrage continue", () => {
  // **« échec » tout seul ne désignait personne.** Jusqu'au 23 août 2026 la
  // raison du refus partait à `/dev/null` : jeton expiré, espace introuvable,
  // réseau — un seul mot pour trois pannes qui n'ont pas le même remède, et le
  // patron renvoyé au même geste inutile à chaque fois.
  const sortie = jouer({ CODESPACE_NAME: "reimagined-space-yodel" }, fauxGh(1));
  assert.match(sortie, /^échec:/, `attendu « échec:<raison> », reçu « ${sortie} »`);
});

cas("UN PORT QUE LE RELAIS NE CONNAÎT PAS se dit « non-declare »", () => {
  // **Le cas du 23 août 2026, payé de trois « ça ne marche pas ».** Régler la
  // visibilité d'un port jamais enregistré ne peut rien : il n'y a rien à
  // basculer. On pose donc la question, au lieu de renvoyer au même panneau.
  const sortie = jouer(
    { CODESPACE_NAME: "reimagined-space-yodel" },
    fauxGhDeuxTemps("HTTP 403", "LABEL PORT VISIBILITY\nweb 8080 private")
  );
  assert.equal(sortie, "non-declare", `attendu « non-declare », reçu « ${sortie} »`);
});

cas("un port DÉCLARÉ mais refusé reste un échec, avec sa raison", () => {
  const sortie = jouer(
    { CODESPACE_NAME: "reimagined-space-yodel" },
    fauxGhDeuxTemps("HTTP 401: Bad credentials", "LABEL PORT VISIBILITY\nAtlas 3000 private")
  );
  assert.match(sortie, /^échec:.*Bad credentials/, `la raison du refus est perdue : « ${sortie} »`);
});

cas("une LISTE MUETTE ne fait pas conclure « non déclaré »", () => {
  // Une supposition présentée comme une mesure coûte plus cher qu'un « je ne
  // sais pas » : si `gh ports` échoue lui aussi, on rend le refus initial.
  const bac = path.join(dossier, "gh-muet");
  execFileSync("mkdir", ["-p", bac]);
  const faux = path.join(bac, "gh");
  writeFileSync(faux, "#!/usr/bin/env bash\nprintf 'boum\\n' >&2\nexit 1\n");
  chmodSync(faux, 0o755);
  const sortie = jouer({ CODESPACE_NAME: "reimagined-space-yodel" }, bac);
  assert.match(sortie, /^échec:/, `attendu un échec, reçu « ${sortie} »`);
  assert.ok(!sortie.startsWith("non-declare"), "une liste muette a été prise pour une preuve d'absence");
});

cas("le script ne rend JAMAIS qu'un seul mot, quoi qu'il tente", () => {
  // L'installation de `gh` parle beaucoup ; `demarrer.sh`, lui, lit une ligne.
  // Une ligne d'`apt` échappée d'ici lui ferait dire n'importe quoi.
  for (const sortie of [
    jouer({ CODESPACE_NAME: "" }),
    jouer({ CODESPACE_NAME: "x" }),
    jouer({ CODESPACE_NAME: "x" }, fauxGh(0)),
  ]) {
    assert.equal(sortie.split("\n").length, 1, `plusieurs lignes rendues : « ${sortie} »`);
  }
});

cas("gh absent : on le dit aussi, sans tomber", () => {
  // PATH réduit à un dossier vide, pour que `gh` soit introuvable **quelle que
  // soit la machine** : se fier à son absence ici rendrait le contrôle vert
  // pour une mauvaise raison sur un poste où `gh` est installé.
  //
  // `bash` est donc appelé par son chemin absolu — le chercher dans un PATH
  // vide le rendrait introuvable lui aussi, et l'erreur accuserait le script.
  const vide = path.join(dossier, "vide");
  execFileSync("mkdir", ["-p", vide]);
  const bash = execFileSync("bash", ["-c", "command -v bash"], { encoding: "utf8" }).trim();
  const sortie = execFileSync(bash, [SCRIPT, "3000"], {
    env: { NODE_ENV: "test", PATH: vide, CODESPACE_NAME: "reimagined-space-yodel" },
    encoding: "utf8",
  }).trim();
  assert.equal(sortie, "sans-gh", `attendu « sans-gh », reçu « ${sortie} »`);
});

// **Le contrôle qui empêche ce correctif de redevenir inerte.** Un script juste
// que personne n'appelle ne répare rien — c'est précisément le défaut d'origine,
// une déclaration exacte et sans effet.
cas("le démarrage appelle réellement ce script, et dit ce qu'il en advient", () => {
  // **Les commentaires sont retirés avant de regarder.** Première version, ce
  // contrôle restait vert alors que l'appel avait été supprimé : le commentaire
  // qui le surplombe nomme `ouvrir-port.sh`, et cela suffisait. C'est le même
  // piège que le test de l'annonce d'adresse (`ARCHITECTURE.md` §50) — un
  // contrôle qui vise un texte au lieu d'un geste ne contrôle rien.
  const code = readFileSync(DEMARRER, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");

  assert.match(
    code,
    // Le chemin passe par `$(dirname "$0")` : la parenthèse fermante interne
    // interdit un `[^)]*`, qui rendait ce contrôle rouge sur du code juste.
    /PORT_PUBLIC="?\$\(\s*bash[^\n]{0,80}ouvrir-port\.sh/,
    "demarrer.sh n'APPELLE pas ouvrir-port.sh (un commentaire qui le nomme ne suffit pas)"
  );
  assert.match(
    code,
    /case\s+"\$PORT_PUBLIC"/,
    "demarrer.sh appelle ouvrir-port.sh sans rien dire de son verdict : un port privé resterait muet"
  );
  // **Le remède indiqué doit exister sur CETTE machine.** Première version, le
  // message donnait `gh codespace ports visibility …` en premier ; le patron a
  // reçu « bash: gh: command not found », l'image de ce conteneur n'embarquant
  // pas `gh`. Un remède introuvable coûte plus cher que pas de remède.
  assert.match(
    code,
    /onglet PORTS/,
    "demarrer.sh n'indique pas l'onglet PORTS — le seul remède qui ne demande " +
      "l'installation de rien, et le seul qui marche dans l'image de ce conteneur"
  );
});

// **Le diagnostic est ce que le patron LIT quand rien ne marche.** C'est lui
// qui l'a envoyé taper une commande absente : il donnait `gh …` quatre fois,
// recopiée. Le remède y est désormais écrit une seule fois, et commence par le
// geste qui ne demande d'installer rien.
cas("le diagnostic indique l'onglet PORTS, et n'écrit son remède qu'une fois", () => {
  const source = readFileSync(path.join(__dirname, "diagnostiquer-banc.mjs"), "utf8");
  assert.match(
    source,
    /onglet PORTS/,
    "le diagnostic n'indique pas l'onglet PORTS — c'est pourtant le seul remède qui marche ici"
  );
  const recopies = source.split("gh codespace ports visibility").length - 1;
  assert.equal(
    recopies,
    1,
    `le remède est recopié ${recopies} fois : deux copies finissent toujours par diverger`
  );
});

// L'outil `gh` n'est pas dans l'image du conteneur : sans cette fonctionnalité,
// `ouvrir-port.sh` restera `sans-gh` à chaque allumage, pour toujours.
cas("l'espace de travail réclame `gh`, que son image n'embarque pas", () => {
  const config = readFileSync(path.join(__dirname, "..", ".devcontainer", "devcontainer.json"), "utf8");
  assert.match(
    config,
    /features\/github-cli/,
    "devcontainer.json ne demande pas gh : le port ne pourra jamais s'ouvrir seul"
  );
});

// ─── LE VEILLEUR REDEMANDE LE PORT UNE FOIS LE SERVEUR DEBOUT ───────────────
//
// **Sa panne du 26 août 2026**, capture de l'onglet PORTS à l'appui : *« problème
// pas de port connecté »*. Sa fiche portait le mot exact — *« error updating
// port 3000 to public: error getting tunnel port: […] 404 Not Found »*.
//
// **Le relais ne connaissait pas encore le port.** `demarrer.sh` en demande
// l'ouverture aussitôt après avoir posé le veilleur, dont la construction dure
// des minutes : au moment de la demande, RIEN n'écoute sur 3000. GitHub n'a donc
// aucun port à rendre public, et répond 404. Le serveur démarre ensuite, le port
// se déclare tout seul — **et reste PRIVÉ**, parce que plus rien ne redemandait.
//
// C'est le symptôme du 10 août sous une autre cause : GitHub sert sa page de
// connexion à la place d'Atlas, et depuis son téléphone il n'y a rien à voir.
//
// **Une tentative unique au démarrage a lieu au seul moment où elle ne peut pas
// aboutir.** Ce cas exige qu'il y en ait une seconde, là où le serveur répond.
cas("le veilleur redemande l'ouverture du port quand le serveur répond", () => {
  const veilleur = readFileSync(path.join(__dirname, "..", ".devcontainer", "veiller.sh"), "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");

  assert.match(
    veilleur,
    /bash\s+"\$\(dirname "\$0"\)\/ouvrir-port\.sh"/,
    "veiller.sh n'appelle PAS ouvrir-port.sh : la demande du démarrage a lieu avant que " +
      "rien n'écoute, elle échoue en 404, et le port reste privé pour toute la session"
  );

  // **Une seule fois obtenue, jamais en boucle.** `gh` interroge le réseau : le
  // rappeler toutes les quinze secondes userait un quota sans rien apprendre.
  assert.match(
    veilleur,
    /PORT_OUVERT/,
    "rien ne retient que le port est ouvert : `gh` serait rappelé à chaque tour de veille"
  );

  // **La fiche lit `/tmp/atlas-port.txt`** (`diagnostiquer-espace.mjs`). Sans
  // cette mise à jour, elle continuerait d'annoncer le refus du démarrage alors
  // que le port est ouvert — et sa règle enverrait le patron réparer ce qui
  // marche, ce qui est le pire des messages (`CLAUDE.md` §1 bis).
  assert.match(
    veilleur,
    /\/tmp\/atlas-port\.txt/,
    "veiller.sh n'écrit pas le nouvel état du port : la fiche annoncerait encore le refus"
  );
});

// ─── LE PORT SE REVÉRIFIE, ET « OUVERT » N'EST PLUS UN ACQUIS ───────────────
//
// **Sa nuit du 30 au 31 août 2026 : « l'appli ne se lance plus ».** Son espace
// tournait, Atlas répondait sur 127.0.0.1:3000, la version rapide était bâtie
// sur le dernier commit — et son adresse publique rendait un 404 du relais.
//
// Le veilleur posait `PORT_OUVERT=oui` dès que `gh` avait répondu « ouvert », et
// n'y revenait plus de la session. Ce mot ne dit pourtant pas que le port est
// joignable : il dit qu'une commande a réussi, à un instant. Le relais peut
// perdre le port ensuite — et le verrou tenait quand même, toute la nuit.
cas("le veilleur REMESURE le port du dehors, au lieu de croire « ouvert » pour toujours", () => {
  const veilleur = readFileSync(path.join(__dirname, "..", ".devcontainer", "veiller.sh"), "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");

  assert.match(
    veilleur,
    /port-joignable\.mjs/,
    "veiller.sh ne mesure jamais si l'adresse publique atteint Atlas : un port perdu " +
      "en cours de session le reste jusqu'au prochain allumage"
  );
  assert.match(
    veilleur,
    /PORT_OUVERT=non/,
    "rien ne peut plus DÉFAIRE le verrou : c'est exactement ce qui a laissé passer sa nuit du 31 août"
  );
  // **Ne rien conclure d'une ignorance.** Hors Codespace, la mesure est
  // impossible : la traiter comme un refus rappellerait `gh` toutes les cinq
  // minutes sur une machine qui n'a aucun port à ouvrir.
  assert.match(
    veilleur,
    /\*\)\s*:\s*;;/,
    "le cas « pas mesurable » n'est pas distingué du refus"
  );
});

cas("hors Codespace, la mesure du port s'abstient (code 2) au lieu d'accuser", () => {
  // Joué pour de bon : un contrôle qui n'a jamais été exécuté ne prouve rien.
  const sans = { ...process.env };
  delete sans.CODESPACE_NAME;
  delete sans.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  const rendu = spawnSync(process.execPath, [path.join(__dirname, "port-joignable.mjs")], {
    env: sans,
    encoding: "utf8",
  });
  assert.equal(rendu.status, 2, "la sonde conclut là où elle n'a rien pu mesurer");
});

rmSync(dossier, { recursive: true, force: true });

console.log(`\n${echecs === 0 ? "✅" : "❌"} Port du banc — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
