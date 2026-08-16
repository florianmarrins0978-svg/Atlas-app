// Fait tourner le banc d'essai sur une version BÂTIE, et non sur un serveur de
// développement.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Le 9 août 2026, dix-sept heures y sont passées.** « HTTP ERROR 504 »,
// « 404 », « 502 », deux serveurs qui se disputaient le port 3000, un écran qui
// mettait 38,7 secondes à s'ouvrir. Chaque correctif visait un symptôme.
//
// Ils avaient tous la même cause : `next dev` **ne compile rien d'avance**. Il
// attend qu'on ouvre un écran et le compile à cet instant — trente à cent
// secondes la première fois, moins d'une demi-seconde ensuite. Le mandataire de
// GitHub, lui, abandonne au bout d'une minute. Un serveur de développement
// n'est pas fait pour être utilisé ; c'est un atelier, pas un produit.
//
// La version bâtie compile TOUT une fois, puis sert chaque écran en 50 à 100 ms.
// Plus de compilation à l'ouverture, donc plus de 504, plus de préchauffage,
// plus de course entre le patron et le compilateur.
//
// Ce que cela coûte, dit franchement : deux à cinq minutes de construction au
// démarrage, et il faut rebâtir après chaque mise à jour. L'attente se déplace
// donc du moment où il clique vers le moment où il met à jour — c'est-à-dire
// au bon endroit, et sans lui.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Le repli n'est pas une décoration.** Si la construction échoue, on repart
// sur `next dev` plutôt que de le laisser devant rien. Un banc lent reste un
// banc ; un banc mort lui coûte sa soirée.

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { annoncePrete } from "./annonce-adresse.mjs";
import { prendreVerrouBanc, libererVerrouBanc } from "./verrou-banc.mjs";

const PORT = process.env.PORT ?? "3000";
const SANTE = `http://127.0.0.1:${PORT}/api/health/live`;
// **Deux dossiers, et c'est le cœur du correctif du 10 août 2026.** Le serveur
// de développement garde `.next` ; la version bâtie vit à côté. C'est ce qui
// permet de SERVIR PENDANT QU'ON BÂTIT — sans quoi le patron regarde une page
// blanche pendant toute la construction, qui dure des dizaines de minutes sur
// un disque lent. Voir `next.config.ts` (`ATLAS_DIST_DIR`).
const DIST = ".next-batie";
const TEMOIN_BATI = `${DIST}/atlas-version-batie.txt`;
// **Le témoin d'ÉCHEC, et il vaut le témoin de réussite.**
//
// Le 16 août 2026 : « l'appli est vraiment très lente, vraiment ». Sa fiche
// disait « aucune version bâtie — le banc sert le mode développement », ce qui
// est vrai mais ne distingue pas trois états très différents : la construction
// tourne encore, elle a échoué, elle n'a jamais démarré. Le premier se traverse
// en deux minutes, le deuxième condamne le banc à la lenteur pour toujours — et
// rien ne permettait de les séparer sans lire un journal auquel l'agent n'a pas
// accès. Le message d'échec existait pourtant : il partait dans `/tmp/essai.log`,
// que personne ne lit.
//
// Hors de `DIST` délibérément : ce dossier est effacé par une construction
// suivante, et l'échec doit survivre à la tentative qui le remplace.
const TEMOIN_ECHEC =
  // Détournable uniquement pour l'éprouver : une suite ne peut pas écrire
  // dans /tmp sans marcher sur le banc réel de la machine qui la joue.
  process.env.ATLAS_TEMOIN_ECHEC || "/tmp/atlas-construction-echouee.txt";

/**
 * Une mesure du système, sur une ligne, ou « inconnu ».
 *
 * Ne lève jamais : ce relevé sert à expliquer un échec, il ne doit pas en
 * fabriquer un second. Une machine sans `df` ni `free` reste une machine.
 */
function mesure(commande, args) {
  try {
    return execFileSync(commande, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join(" | ");
  } catch {
    return "inconnu";
  }
}

// **Prévenir le veilleur pendant la bascule, sinon il tue ce qu'on remplace.**
//
// Le 10 août 2026 chez le patron : construction réussie, puis
// « listen EADDRINUSE … 0.0.0.0:3000 », errno -98. Pendant le battement où l'on
// tue `next dev` avant de lancer `next start`, `.devcontainer/veiller.sh` voit
// exactement ses deux conditions de relance — santé muette, aucun `next` — et
// démarre un SECOND banc, qui prend le port. Le raisonnement complet — et
// pourquoi le drapeau doit EXPIRER — vit dans `bascule-en-cours.sh`, seul à
// connaître le chemin du drapeau.
const DRAPEAU_BASCULE = new URL("../.devcontainer/bascule-en-cours.sh", import.meta.url).pathname;

function marquerBascule(etape) {
  try {
    execFileSync("bash", [DRAPEAU_BASCULE, etape], { stdio: "ignore" });
  } catch {
    // Le drapeau est un confort : son absence ramène l'ancien désordre, jamais
    // pire. On ne fait surtout pas échouer un démarrage pour ça.
  }
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function repond() {
  try {
    const r = await fetch(SANTE, { signal: AbortSignal.timeout(5000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

/** Le commit exécuté, ou `null` hors dépôt git. */
function versionDuCode() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/**
 * Faut-il rebâtir ?
 *
 * **La question n'est pas « le dossier .next existe-t-il ».** Une version bâtie
 * d'un code d'hier est exactement le piège que ce dépôt combat depuis le début :
 * le patron essaie une correction livrée la veille, et rien n'a changé. On
 * compare donc le commit bâti au commit présent.
 */
function doitRebatir(version) {
  if (!existsSync(`${DIST}/BUILD_ID`)) return "aucune version bâtie";
  if (!version) return null; // Hors git : on ne peut pas comparer, on garde.
  try {
    const bati = readFileSync(TEMOIN_BATI, "utf8").trim();
    if (bati !== version) return "le code a changé depuis la dernière construction";
    return null;
  } catch {
    return "on ignore quel code a été bâti";
  }
}

// **AUCUN ENFANT NE REÇOIT LE TERMINAL, et c'est un correctif, pas un détail.**
//
// Le 10 août 2026, la construction du patron est morte ainsi, APRÈS avoir
// pourtant réussi :
//
//     ✓ Compiled successfully in 62s
//     > Build error occurred
//     Error: setRawMode EIO   (errno -5, syscall 'setRawMode')
//     Segmentation fault (core dumped)
//
// `next build` ne lit rien au clavier, mais quand son entrée est un vrai
// terminal il tente d'en prendre le contrôle (`setRawMode`) pour écouter les
// touches. Dans un espace distant, ce terminal peut disparaître sous lui — une
// session rechargée, un onglet fermé, un processus détaché — et l'appel échoue
// en `EIO`, ce que la couche native ne rattrape pas : segmentation fault, et
// une construction perdue après une minute de travail réussi.
//
// On ne donne donc plus d'entrée aux enfants : `ignore` la remplace par rien du
// tout, `isTTY` devient faux, et Next.js ne tente même plus l'opération. La
// SORTIE, elle, reste héritée — le patron doit voir ce qui se passe.
//
// Ce que cela ne change pas : Ctrl+C. L'interruption passe par le groupe de
// processus du terminal, jamais par l'entrée de l'enfant.
const SANS_TERMINAL = ["ignore", "inherit", "inherit"];

/** Joue une commande en laissant sa sortie visible. Rend le code de sortie. */
function jouer(commande, args, env = process.env) {
  return new Promise((resoudre) => {
    const p = spawn(commande, args, { stdio: SANS_TERMINAL, env });
    p.on("exit", (code) => resoudre(code ?? 1));
    p.on("error", () => resoudre(1));
  });
}

/**
 * Les dernières lignes qu'une commande a écrites, en plus de son code.
 *
 * **Écrit le 16 août 2026, après une soirée entière perdue faute de ces
 * lignes.** Le témoin d'échec portait l'heure, le code de sortie, le disque et
 * la mémoire — tout sauf ce que la construction avait DIT. On a donc cherché
 * une saturation pendant des heures, alors que le message tenait en une ligne :
 * « Another next build process is already running ». C'est le reproche que ce
 * dépôt se fait à lui-même depuis le 11 août : *aller chercher la ligne exacte
 * que le programme écrit, jamais l'idée qu'on s'en fait*.
 *
 * La sortie reste héritée — le patron doit voir la construction avancer — et
 * elle est en plus RETENUE, pour que l'échec puisse se raconter.
 */
function jouerEnRetenant(commande, args, env = process.env, lignes = 30) {
  return new Promise((resoudre) => {
    const gardees = [];
    const retenir = (morceau) => {
      for (const ligne of morceau.toString().split("\n")) {
        if (ligne.trim() === "") continue;
        gardees.push(ligne);
        if (gardees.length > lignes) gardees.shift();
      }
    };
    const p = spawn(commande, args, { stdio: ["ignore", "pipe", "pipe"], env });
    p.stdout?.on("data", (m) => {
      process.stdout.write(m);
      retenir(m);
    });
    p.stderr?.on("data", (m) => {
      process.stderr.write(m);
      retenir(m);
    });
    p.on("exit", (code) => resoudre({ code: code ?? 1, sortie: gardees.join("\n") }));
    p.on("error", (e) => resoudre({ code: 1, sortie: String(e?.message ?? e) }));
  });
}

/**
 * **Le PORT est-il libre — pas « la santé se tait-elle ».**
 *
 * La version précédente interrogeait `/api/health/live` et concluait « port
 * rendu » dès qu'il ne répondait plus. C'est faux, et c'est ce qui a fait
 * revenir « EADDRINUSE » chez le patron le 10 août 2026 au soir, APRÈS une
 * construction réussie : un serveur qu'on vient de tuer cesse de répondre bien
 * avant de rendre sa socket, et un processus qui tient le port sans servir
 * Atlas ne répond à cette route dans aucun cas. Le banc lançait donc
 * `next start` sur un port encore occupé.
 *
 * On demande maintenant au système, en essayant d'ÉCOUTER dessus : c'est la
 * seule question dont la réponse engage `next start`. La socket d'essai est
 * refermée aussitôt.
 */
function portLibre() {
  return new Promise((resoudre) => {
    const essai = createServer();
    essai.once("error", () => resoudre(false));
    essai.once("listening", () => essai.close(() => resoudre(true)));
    essai.listen(Number(PORT), "0.0.0.0");
  });
}

/**
 * Déloge ce qui écoute encore, sans condition.
 *
 * `serveur.kill()` ne tue que l'enveloppe `npx` : le processus qui écoute
 * vraiment se renomme `next-server` et lui survit. Les crochets autour du « n »
 * sont indispensables — sans eux, le motif se trouverait dans la ligne de
 * commande de ce script, et le banc se tuerait lui-même.
 */
function delogerCeQuiEcoute() {
  try {
    execFileSync("pkill", ["-f", "[n]ext-server"]);
  } catch {
    // Personne à tuer : tant mieux.
  }
}

async function portRendu(limiteMs) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    if (await portLibre()) return true;
    await attendre(1000);
  }
  return false;
}

// **UN SEUL BANC, et c'est la garde qui manquait le 10 août 2026.**
//
// Le patron a lu « listen EADDRINUSE … 0.0.0.0:3000 » (errno -98) suivi d'une
// SECONDE construction : deux bancs tournaient. L'espace en démarre un tout
// seul à chaque allumage ; ne voyant rien venir, il en a lancé un autre à la
// main. Les deux ont bâti, et le premier à vouloir servir a trouvé le port pris.
//
// Regarder le port n'aurait rien donné : pendant sa construction, un banc n'y
// répond pas encore. C'est l'existence d'un autre banc qu'il faut voir. Le
// raisonnement complet est dans `verrou-banc.mjs`.
const verrou = prendreVerrouBanc();
if (!verrou.pris) {
  // **Refuser ne suffit pas : il faut dire OÙ ÇA EN EST.**
  //
  // Première version, ce message disait « Atlas est déjà en train de démarrer »
  // et rien d'autre. Le patron s'est retrouvé devant un refus sans savoir s'il
  // devait attendre trente secondes ou cinq minutes, ni si l'application était
  // déjà ouvrable. Un refus qui n'informe pas ne vaut guère mieux qu'une panne.
  //
  // On interroge donc l'application avant de répondre : si elle sert déjà, on
  // lui donne l'adresse ; sinon, on lui dit ce qu'il reste à attendre.
  if (await repond()) {
    console.log(
      "\n  Atlas tourne déjà — rien à relancer.\n" +
        annoncePrete({ port: PORT, precision: "déjà en service." })
    );
  } else {
    console.log(
      "\n  ─────────────────────────────────────────────────────────────\n" +
        "   Atlas est DÉJÀ en train de se construire — rien à relancer.\n\n" +
        "   L'espace de travail s'en charge tout seul à chaque allumage.\n" +
        "   Comptez deux à cinq minutes la première fois.\n\n" +
        "   Pour le suivre :   tail -f /tmp/essai.log\n" +
        "   Vous attendez la ligne « Version rapide en place ».\n\n" +
        "   (En lancer un second ferait échouer les deux sur le port " + PORT + " :\n" +
        "    c'est le « EADDRINUSE » du 10 août 2026.)\n" +
        "  ─────────────────────────────────────────────────────────────\n"
    );
  }
  process.exit(0);
}
process.on("exit", () => libererVerrouBanc());

// **Un orphelin d'hier soir ne doit pas condamner ce démarrage.**
//
// Un `next-server` laissé par une exécution précédente — un Ctrl+C d'avant le
// correctif du groupe, un conteneur mis en veille au mauvais moment — tient
// encore le port et rend `EADDRINUSE` avant même qu'on ait rien tenté. Le
// patron a dû taper `pkill` à la main plusieurs fois cette nuit-là ; ce n'est
// pas son travail.
//
// **La distinction qui compte** : si quelque chose répond à la santé, c'est
// Atlas qui sert — on n'y touche pas, et le verrou ci-dessus a déjà tranché. Si
// le port est pris SANS que rien ne réponde, c'est un orphelin, et lui seul.
if (!(await portLibre())) {
  if (await repond()) {
    console.log(
      "\n  ─────────────────────────────────────────────────────────────\n" +
        "   Atlas répond déjà sur le port " + PORT + " — rien à relancer.\n" +
        "  ─────────────────────────────────────────────────────────────\n"
    );
    process.exit(0);
  }
  console.log(`  (Un serveur d'une exécution précédente tenait le port ${PORT} : délogé.)`);
  delogerCeQuiEcoute();
  await attendre(2000);
}

const version = versionDuCode();
const raison = doitRebatir(version);

// **`detached: true` — c'est ce qui rend la bascule sûre, et rien d'autre.**
//
// `npx next dev` est une pile d'enveloppes ; le processus qui ÉCOUTE se renomme
// `next-server` et **survit à la mort de son père**. Tuer l'enfant qu'on connaît
// ne libère donc pas le port : le patron l'a vu quatre fois, `EADDRINUSE`
// immédiat après « Construction terminée », avec le serveur de développement qui
// continuait tranquillement de servir juste en dessous.
//
// `pkill -f "[n]ext-server"` marchait ici et pas chez lui — on ne visait pas des
// processus, on visait un MOTIF. Détaché, l'enfant devient chef de son propre
// groupe : `process.kill(-pid)` emporte alors l'enveloppe ET le serveur, sans
// dépendre d'un nom de processus ni de la présence de `pkill`.
//
// Ce que cela impose, et qui est fait plus bas : le groupe ne meurt plus avec ce
// script, il faut donc le tuer explicitement — à la sortie ET sur Ctrl+C.
const lancerBati = () =>
  spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", PORT],
    { stdio: SANS_TERMINAL, detached: true, env: { ...process.env, ATLAS_DIST_DIR: DIST } });
const lancerDev = () =>
  spawn("npx", ["next", "dev", "-H", "0.0.0.0", "-p", PORT],
    { stdio: SANS_TERMINAL, detached: true, env: process.env });

/**
 * Tue un serveur ET tout ce qu'il a engendré.
 *
 * Le signe moins désigne le GROUPE de processus, pas le seul enfant : c'est là
 * toute la différence, et c'est ce qui manquait. On garde `pkill` en second
 * rideau — s'il existe — pour un orphelin d'une exécution précédente, que
 * personne ne connaît plus.
 */
function tuerLeServeur(p) {
  if (p?.pid) {
    try {
      process.kill(-p.pid, "SIGTERM");
    } catch {
      try {
        p.kill("SIGTERM");
      } catch {
        // Déjà parti.
      }
    }
  }
}

// **SERVIR D'ABORD, BÂTIR ENSUITE — le correctif du 10 août 2026, au soir.**
//
// Ce que le patron a vécu : une page blanche, encore. Le diagnostic disait
// « Application, vue de l'intérieur : injoignable ». Rien n'était cassé : le
// banc se rebâtissait, et l'ancienne version de ce script bâtissait AVANT de
// servir. Sur un disque que Next.js mesure deux cents fois trop lent, cela veut
// dire des dizaines de minutes sans rien. Il a passé sa soirée devant ce vide.
//
// Désormais le serveur de développement part TOUT DE SUITE — une minute, et il
// répond. La construction se fait à côté, dans son propre dossier, et on ne
// bascule qu'une fois qu'elle a abouti. À aucun moment il n'y a rien.
/**
 * **Ouvrir l'écran de connexion AVANT que le patron ne le demande.**
 *
 * Le 10 août 2026, au soir : le serveur répondait, et sa page restait blanche.
 * Mesuré plutôt que supposé — `next dev` ne compile un écran qu'au premier
 * appel : la santé répond en 0,5 s, mais `/login` coûte 6,8 s ici… et
 * TROIS MINUTES sur son disque (son propre journal : `GET / 307 in 3.0min`).
 * Or le relais de GitHub abandonne au bout d'une minute. Il n'a donc jamais pu
 * voir cette page, quoi qu'il fasse : elle n'était pas encore compilée quand le
 * relais coupait.
 *
 * On paie donc ce coût ICI, depuis l'intérieur, où rien n'abandonne. Deuxième
 * appel mesuré : 0,04 s. Le premier écran qu'il ouvre est alors instantané.
 *
 * Jamais bloquant, et un échec n'empêche rien : ce n'est qu'une avance prise.
 */
async function prechaufferEcransPublics() {
  while (!(await repond())) await attendre(2000);
  const base = `http://127.0.0.1:${PORT}`;
  for (const chemin of ["/login", "/"]) {
    const depart = Date.now();
    try {
      // Quinze minutes : sur un disque très lent, abandonner ici rendrait au
      // patron exactement la page blanche qu'on cherche à lui épargner.
      await fetch(base + chemin, { redirect: "follow", signal: AbortSignal.timeout(900_000) });
      console.log(`  ${chemin} compilé en ${Math.round((Date.now() - depart) / 1000)} s.`);
    } catch {
      // Un préchauffage qui échoue laisse simplement le premier appel payer.
    }
  }
  console.log("\n  L'écran de connexion s'ouvre maintenant du premier coup.\n");

  // **Et TOUS les autres écrans derrière, dans la foulée.**
  //
  // Ouvrir la connexion ne suffit pas : chaque écran suivant coûte le même
  // premier appel, et le relais coupe pareil. Le patron se connecterait pour
  // retomber sur une page blanche à l'écran d'après — le même défaut, déplacé
  // d'un cran. `prechauffer.mjs` sait ouvrir une session et parcourir la liste,
  // y compris les écrans d'un chantier, qui sont les plus lourds.
  //
  // Enveloppé en entier : rien de ceci ne doit pouvoir empêcher le banc de
  // servir. Au pire, le premier appel repaiera son coût.
  try {
    const {
      cookieDeSession,
      ecransDeChantier,
      ECRANS_A_PRECHAUFFER,
      ETAT_PRECHAUFFAGE,
      expliquerObstacle,
      prechauffer,
    } = await import("./prechauffer.mjs");
    let motif = null;
    const cookie = await cookieDeSession({
      databaseUrl: process.env.DATABASE_URL,
      authSecret: process.env.AUTH_SECRET,
      nodeEnv: process.env.NODE_ENV,
      ecrire: (raison) => { motif = raison; },
    });
    if (!cookie) {
      // Dire la VRAIE raison : ce message a déjà accusé le mauvais coupable
      // pendant que PostgreSQL était arrêté (voir `prechauffer.mjs`).
      console.log(`  ⚠ ${motif ?? "préchauffage complet impossible, sans raison connue"}\n`);
      return;
    }
    const ecrans = [...ECRANS_A_PRECHAUFFER, ...(await ecransDeChantier({ base, cookie }))];
    console.log(`  Préchauffage de ${ecrans.length} écrans — ils s'ouvriront ensuite du premier coup.`);
    // **Déposer l'avancement, pour que l'application puisse le DIRE.**
    //
    // `prechauffer` porte un rappel `avancer` depuis le 9 août 2026, et
    // `/api/health/banc` sait déjà lire le fichier qu'il devait produire —
    // mais **personne ne le lui passait**. La page de diagnostic répondait donc
    // « le préchauffage n'a pas encore commencé » du début à la fin, et le
    // bandeau du patron n'avait aucun chiffre à montrer. Une fonction prévue,
    // documentée, éprouvée, et jamais branchée : elle ne coûtait rien à écrire
    // et ne servait à rien tant que cette ligne n'existait pas.
    //
    // L'écriture est enveloppée : un `/tmp` plein ne doit pas arrêter un
    // préchauffage qui, lui, rend l'application ouvrable.
    const deposer = (etat) => {
      try {
        writeFileSync(ETAT_PRECHAUFFAGE, JSON.stringify({ ...etat, majAt: new Date().toISOString() }));
      } catch {
        // Le confort tombe, le banc continue.
      }
    };
    const bilan = await prechauffer({
      base,
      cookie,
      ecrans,
      ecrire: (l) => console.log(`  · ${l}`),
      avancer: deposer,
    });
    deposer({
      faits: ecrans.length,
      total: ecrans.length,
      reussis: bilan.reussis,
      echoues: bilan.echoues,
      encours: null,
      termine: true,
      secondes: bilan.secondes,
      obstacle: expliquerObstacle(bilan.renvoiDominant),
    });
    console.log(`  Préchauffage terminé : ${bilan.reussis} écran(s) prêts` +
      (bilan.echoues ? `, ${bilan.echoues} en échec` : "") + ` — ${bilan.secondes} s.\n`);
    const obstacle = expliquerObstacle(bilan.renvoiDominant);
    if (obstacle) console.log(`  ${obstacle}\n`);
  } catch (e) {
    console.log(`  (Préchauffage complet abandonné : ${e instanceof Error ? e.message : e})\n`);
  }
}

/**
 * **L'adresse s'annonce DÈS QUE l'application répond, pas à la fin.**
 *
 * Corrigé le 10 août 2026, au soir. Depuis « servir d'abord, bâtir ensuite »,
 * l'annonce venait après `next build` — des minutes plus tard. Le patron avait
 * donc une application qui répondait sans savoir où l'ouvrir, ce qui annule
 * précisément ce que ce correctif lui apportait. Et le contrôle du conteneur,
 * lui, cherchait l'adresse bien avant : le banc rougissait sur un serveur
 * parfaitement vivant.
 *
 * Elle ne se dit qu'une fois : la bascule vers la version bâtie n'ajoute
 * qu'une ligne, l'adresse ne change pas.
 */
let annonceFaite = false;
function annoncer(bati) {
  if (annonceFaite) return;
  annonceFaite = true;
  console.log(
    annoncePrete({
      port: PORT,
      precision: bati ? "version bâtie, chaque écran est immédiat." : "mode développement, premier accès lent.",
    })
  );
}

async function annoncerDesQueCaRepond(bati) {
  const limite = Date.now() + 180_000;
  while (Date.now() < limite) {
    if (await repond()) {
      annoncer(bati);
      return;
    }
    await attendre(1000);
  }
}

let serveur = raison ? lancerDev() : lancerBati();
let enBascule = false;
// Ce qui SERT réellement, à cet instant — pas ce qu'on espérait servir. La
// bascule peut échouer (le port n'est pas rendu) : l'annonce doit alors dire
// « mode développement », sinon elle promet une vitesse qui n'existe pas.
let sertBati = !raison;

// Le serveur tient ce script en vie ; sa mort l'arrête — SAUF pendant la
// bascule, où on le tue nous-mêmes pour le remplacer.
const surSortie = (code) => {
  if (!enBascule) process.exit(code ?? 0);
};
serveur.on("exit", surSortie);

// Arrêter ce script doit arrêter le serveur : sans cela il reste en écoute, et
// la tentative suivante échoue sur un port déjà pris — message qui n'a plus
// aucun rapport avec la cause.
//
// **Le GROUPE, pas le seul enfant.** Depuis que le serveur est détaché (voir
// `lancerDev`), Ctrl+C ne lui parvient plus tout seul : il faut le lui
// transmettre, sinon fermer le banc laisserait derrière soi exactement
// l'orphelin qui a coûté la soirée du 10 août.
//
// **POSÉS ICI, LIGNE SUIVANTE — et c'est tout le correctif du 11 août 2026.**
//
// Ils vivaient en fin de fichier, c'est-à-dire APRÈS la construction. Or ce
// script sert d'abord et bâtit ensuite : entre le lancement du serveur et
// l'installation de ces gardiens, il s'écoule **plusieurs minutes**. Un
// `SIGTERM` reçu dans cette fenêtre ne rencontre aucun gestionnaire, tue ce
// script net — et le serveur, DÉTACHÉ, survit et garde le port.
//
// Ce n'est pas une hypothèse : c'est ce que fait
// `scripts/verifier-connexion-avec-serveur.mts`, qui lance `npm run banc` puis
// tue son groupe dès la connexion éprouvée — sans attendre la construction. Le
// serveur orphelin restait alors sur le port 3000, et la batterie suivante
// accusait le calcul du prix (`TODO.md`, « serveur fantôme »).
//
// Un gardien installé trop tard ne protège de rien, et ne se voit pas : le code
// est juste, il arrive en retard.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    enBascule = false;
    tuerLeServeur(serveur);
    process.exit(0);
  });
}

// Même chose pour une sortie ordinaire, ou une exception : un serveur détaché ne
// meurt plus avec son père, et un orphelin accroché au port est précisément la
// panne qu'on répare ici.
process.on("exit", () => tuerLeServeur(serveur));

if (raison) {
  console.log(`\n  Atlas répond déjà, en mode développement.`);
  // Pas d'`await` : le préchauffage, l'annonce et la construction avancent
  // ensemble. L'adresse doit partir la première — c'est elle qu'il attend.
  void annoncerDesQueCaRepond(false);
  prechaufferEcransPublics();
  console.log(`  Sa version rapide se construit en même temps (${raison}) — ne fermez rien.\n`);

  // **Écarter les types laissés par une AUTRE construction, avant de bâtir.**
  //
  // Le patron, le 11 août 2026 au soir : « Failed to type check », sur une route
  // qui existait. Puis une seconde fois, sur une route qui venait d'être
  // supprimée. Deux formes du même piège.
  //
  // Next se protège pourtant : son contrôle de types écarte `<distDir>/dev/types`
  // — « pour empêcher des types de développement périmés de faire échouer la
  // construction ». Mais ici `distDir` vaut `.next-batie`, si bien qu'il écarte
  // `.next-batie/dev` pendant que les restes vivent dans `.next`. Le garde-fou
  // vise à côté dès qu'on bâtit ailleurs que dans `.next`.
  //
  // `tsconfig.json` exclut déjà `.next/dev` — celui-là est réécrit en
  // permanence par le serveur de développement, on ne peut que l'ignorer.
  // `.next/types`, lui, ne se régénère pas : personne ne bâtit dans `.next`
  // ici. Il ne peut donc qu'être **périmé**, et il décrit alors des routes
  // d'avant — celle des photos, supprimée ce soir-là, en est l'exemple exact.
  // On l'efface : ce qui n'existe plus ne peut plus accuser à tort.
  //
  // Reproduit dans les deux sens avant d'écrire ces lignes : avec ce reste, la
  // construction du banc échoue au mot près comme chez lui ; sans lui, elle
  // passe.
  try {
    rmSync(".next/types", { recursive: true, force: true });
  } catch {
    // Rien à réparer : au pire le dossier n'existait pas, et c'est le cas normal.
  }

  // **NE PAS RETIRER `<DIST>/lock`. La tentation est forte, et elle est fausse.**
  //
  // Le 16 août 2026, la construction du patron rendait :
  //
  //     ✕ Another next build process is already running.
  //       - A previous build that didn't exit cleanly
  //
  // La deuxième ligne fait croire à un verrou périmé qu'il suffirait d'effacer.
  // **Éprouvé, et c'est faux** : un fichier `lock` posé à la main n'empêche
  // aucune construction — Next prend un verrou du système (`lockfileTryAcquire`),
  // que le noyau relâche tout seul à la mort du processus. Le fichier qui reste
  // n'est qu'une trace.
  //
  // Donc, quand ce message apparaît, **une construction tourne pour de bon**.
  // L'effacer lancerait une SECONDE construction à côté de la première, sur une
  // machine qui n'arrive déjà pas à en finir une — le remède qui tue, que ce
  // dépôt a déjà payé deux fois (le second serveur du 9 août, le second banc du
  // 10). Next a raison de refuser ; c'est nous qui devons cesser de le
  // provoquer.

  // La construction écrit dans SON dossier : le serveur de développement garde
  // le sien, et les deux ne se marchent jamais dessus.
  const { code, sortie } = await jouerEnRetenant("npx", ["next", "build"], { ...process.env, ATLAS_DIST_DIR: DIST });

  if (code === 0) {
    try {
      mkdirSync(DIST, { recursive: true });
      writeFileSync(TEMOIN_BATI, version ?? "inconnue");
      // Un échec d'hier ne doit pas accuser la construction d'aujourd'hui : le
      // témoin d'échec ne survit pas à une réussite.
      rmSync(TEMOIN_ECHEC, { force: true });
    } catch {
      // Sans témoin on rebâtira au prochain démarrage : coûteux, jamais faux.
    }
    console.log("\n  Construction terminée — passage à la version rapide.\n");
    enBascule = true;
    // AVANT de tuer quoi que ce soit : le battement qui suit ressemble trait
    // pour trait à un serveur mort, et le veilleur en lancerait un second.
    marquerBascule("--debut");

    // **DÉLOGER D'ABORD, VÉRIFIER ENSUITE — et sans condition.**
    //
    // Le 10 août 2026, le journal du patron a montré ce qu'aucun raisonnement
    // n'avait vu : après « Construction terminée », `EADDRINUSE` **immédiat**,
    // puis le serveur de développement qui CONTINUE de servir
    // (`GET / 307 in 95s`). Il n'était donc pas mort du tout, et le port n'a
    // jamais été rendu — mais le banc, lui, avait conclu le contraire et
    // relancé aussitôt dessus.
    //
    // Deux enseignements, tous deux payés cher :
    //
    //   1. `serveur.kill()` ne tue que l'enveloppe `npx`. Le processus qui
    //      ÉCOUTE se renomme `next-server` et lui survit. On ne l'appelait
    //      qu'en dernier recours, après vingt secondes d'attente ; il est
    //      désormais le premier geste, sans condition — il n'y a rien à
    //      épargner, ce serveur est de toute façon condamné.
    //   2. On ne demande plus « la santé répond-elle ? » mais « puis-je écouter
    //      sur ce port ? » (`portLibre`). C'est la seule question dont la
    //      réponse engage `next start`.
    tuerLeServeur(serveur);
    delogerCeQuiEcoute();

    // **Et si `next start` tombe quand même, on RÉESSAIE une fois.** Un banc
    // qui meurt sur son propre remède coûte une soirée ; une seconde tentative
    // coûte dix secondes.
    let bascule = false;
    for (let tentative = 1; tentative <= 2 && !bascule; tentative++) {
      if (!(await portRendu(30_000))) {
        delogerCeQuiEcoute();
        await attendre(2000);
      }
      if (!(await portRendu(15_000))) continue;

      const candidat = lancerBati();
      // Une naissance ratée se voit tout de suite : `EADDRINUSE` sort dans la
      // seconde. On ne déclare la bascule faite qu'après ce délai de grâce.
      const mortNee = await new Promise((resoudre) => {
        const t = setTimeout(() => resoudre(false), 8000);
        candidat.once("exit", () => {
          clearTimeout(t);
          resoudre(true);
        });
      });
      if (mortNee) {
        console.error(`  (Tentative ${tentative} de bascule : le port était encore pris.)`);
        delogerCeQuiEcoute();
        await attendre(2000);
        continue;
      }

      serveur = candidat;
      serveur.on("exit", surSortie);
      sertBati = true;
      bascule = true;
    }

    enBascule = false;

    if (bascule) {
      // **Le drapeau ne tombe qu'une fois le NOUVEAU serveur en écoute.** Le
      // relever dès le lancement rouvrirait la fenêtre exacte qu'il ferme :
      // `next start` met plusieurs secondes à écouter, et le veilleur passe
      // toutes les quinze.
      for (let reste = 90_000; reste > 0 && !(await repond()); reste -= 1000) {
        await attendre(1000);
      }
      marquerBascule("--fin");
    } else {
      // **On ne bascule pas dans le vide, et on ne meurt pas non plus.** Mieux
      // vaut un banc lent qu'un banc mort. Le serveur de développement a été
      // délogé : il faut donc en relancer un, sinon l'application disparaît —
      // ce serait le remède qui tue, encore.
      marquerBascule("--fin");
      serveur = lancerDev();
      serveur.on("exit", surSortie);
      console.error(
        "\n  ⚠️  Le port n'a pas pu être repris : on RESTE en mode développement.\n" +
          "     L'application fonctionne — elle sera simplement moins rapide.\n" +
          "     La version rapide prendra le relais au prochain démarrage.\n"
      );
    }
  } else {
    // L'échec se dépose là où la fiche saura le lire. Sans cela il ne vit que
    // dans un journal local, et l'agent voit un banc « sans version bâtie »
    // sans pouvoir dire si c'est passager ou définitif.
    try {
      writeFileSync(
        TEMOIN_ECHEC,
        [
          `quand: ${new Date().toISOString()}`,
          `code: ${code}`,
          // Les deux suspects d'une construction qui tombe sur une machine
          // modeste, relevés À L'INSTANT de l'échec : plus tard, la mémoire est
          // rendue et le coupable a disparu.
          `disque: ${mesure("df", ["-h", "--output=avail", "."])}`,
          `memoire: ${mesure("free", ["-h"])}`,
          // **CE QUE LA CONSTRUCTION A DIT.** Sans ces lignes, le 16 août a été
          // passé à chercher une saturation qui n'existait pas, alors que le
          // message tenait en une phrase.
          "dit:",
          sortie || "(la construction n'a rien écrit)",
        ].join("\n")
      );
    } catch {
      // Un témoin qu'on ne peut pas écrire ne doit pas empêcher le repli.
    }
    // **Jamais en silence, et jamais rien du tout.** Voir l'en-tête : un banc
    // lent reste un banc, un banc mort coûte une soirée.
    console.error(
      "\n  ⚠️  LA CONSTRUCTION A ÉCHOUÉ — les lignes ci-dessus disent pourquoi.\n" +
        "     Atlas continue en mode développement : il fonctionne, mais chaque\n" +
        "     écran mettra jusqu'à une minute à s'ouvrir la première fois.\n"
    );
  }
}

// **ON ATTEND TANT QUE LE SERVEUR VIT — pas trois minutes au chronomètre.**
//
// Le 11 août 2026, le journal du patron a montré ceci, dans cet ordre :
//
//     ⚠ L'application n'a pas répondu après trois minutes.
//       Cause la plus fréquente : la base de données n'est pas montée.
//     ✓ Finished filesystem cache database compaction in 15.4s
//      GET /api/health/live 200 in 1415ms
//
// Elle répondait **la seconde d'après**. Le délai était trop court pour son
// disque — une compaction de cache l'avait accaparé quinze secondes — et
// l'avertissement accusait la base, qui n'y était pour rien. Deux fautes que ce
// dépôt s'interdit : conclure trop tôt, et **désigner le mauvais coupable**.
//
// Le bon critère n'est pas la montre, c'est la vie du serveur : tant qu'il
// tourne, il travaille. On l'attend donc, avec un signe de vie régulier pour que
// l'écran ne paraisse pas figé — et on ne renonce que s'il meurt, ou après un
// délai franchement long.
const DEBUT_ATTENTE = Date.now();
const ATTENTE_MAX = 15 * 60_000;
let pret = false;
let prochainSigne = DEBUT_ATTENTE + 30_000;
let serveurMort = false;
serveur.once("exit", () => {
  serveurMort = true;
});

while (Date.now() - DEBUT_ATTENTE < ATTENTE_MAX && !serveurMort) {
  if (await repond()) {
    pret = true;
    break;
  }
  if (Date.now() >= prochainSigne) {
    const secondes = Math.round((Date.now() - DEBUT_ATTENTE) / 1000);
    console.log(`  … l'application finit de démarrer (${secondes} s). Le disque de cet espace est lent.`);
    prochainSigne = Date.now() + 30_000;
  }
  await attendre(1000);
}

if (!pret) {
  const minutes = Math.round((Date.now() - DEBUT_ATTENTE) / 60_000);
  console.error(
    serveurMort
      ? "\n  ⚠️  LE SERVEUR S'EST ARRÊTÉ. Les lignes ci-dessus, émises par lui,\n" +
          "     disent pourquoi — c'est là qu'il faut regarder, et nulle part ailleurs.\n"
      : `\n  ⚠️  L'application n'a toujours pas répondu après ${minutes} minutes,\n` +
          "     alors que son serveur tourne encore. Ce n'est donc pas un démarrage\n" +
          "     manqué : quelque chose la retient. Une commande le dira :\n\n" +
          "         npm run diagnostiquer:banc\n"
  );
} else if (annonceFaite) {
  // Déjà annoncée pendant la construction : l'adresse n'a pas changé, et la
  // répéter en entier ferait croire à un second démarrage.
  console.log("\n  Version rapide en place — chaque écran s'ouvre maintenant du premier coup.\n");
} else {
  // `sertBati` et non `bati` : ce dernier n'existe pas à cet endroit — il est le
  // paramètre de `annoncer`, et une variable locale à `doitRebatir`. Le banc
  // mourait ici sur un `ReferenceError`, APRÈS la construction, une fois
  // annoncé prêt. `no-undef` l'attrape désormais (voir `eslint.config.mjs`).
  annoncer(sertBati);
}
