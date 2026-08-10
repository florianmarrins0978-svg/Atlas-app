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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
 * Le port est-il vraiment rendu ? On interroge la santé : tant qu'elle répond,
 * quelqu'un écoute encore. Rien d'autre ne le prouve — un processus disparu de
 * la liste peut avoir laissé un enfant derrière lui.
 */
async function portRendu(limiteMs) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    if (!(await repond())) return true;
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
  console.log(
    "\n  ─────────────────────────────────────────────────────────────\n" +
      "   Atlas est DÉJÀ en train de démarrer — rien à relancer.\n\n" +
      "   L'espace de travail s'en charge tout seul à chaque allumage.\n" +
      "   Suivez-le : tail -f /tmp/essai.log\n\n" +
      "   (En lancer un second ferait échouer les deux sur le port 3000 :\n" +
      "    c'est le « EADDRINUSE » du 10 août 2026.)\n" +
      "  ─────────────────────────────────────────────────────────────\n"
  );
  process.exit(0);
}
process.on("exit", () => libererVerrouBanc());

const version = versionDuCode();
const raison = doitRebatir(version);

const lancerBati = () =>
  spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", PORT],
    { stdio: SANS_TERMINAL, env: { ...process.env, ATLAS_DIST_DIR: DIST } });
const lancerDev = () =>
  spawn("npx", ["next", "dev", "-H", "0.0.0.0", "-p", PORT],
    { stdio: SANS_TERMINAL, env: process.env });

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
    const { cookieDeSession, ecransDeChantier, ECRANS_A_PRECHAUFFER, expliquerObstacle, prechauffer } =
      await import("./prechauffer.mjs");
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
    const bilan = await prechauffer({ base, cookie, ecrans, ecrire: (l) => console.log(`  · ${l}`) });
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

if (raison) {
  console.log(`\n  Atlas répond déjà, en mode développement.`);
  // Pas d'`await` : le préchauffage, l'annonce et la construction avancent
  // ensemble. L'adresse doit partir la première — c'est elle qu'il attend.
  void annoncerDesQueCaRepond(false);
  prechaufferEcransPublics();
  console.log(`  Sa version rapide se construit en même temps (${raison}) — ne fermez rien.\n`);

  // La construction écrit dans SON dossier : le serveur de développement garde
  // le sien, et les deux ne se marchent jamais dessus.
  const code = await jouer("npx", ["next", "build"], { ...process.env, ATLAS_DIST_DIR: DIST });

  if (code === 0) {
    try {
      mkdirSync(DIST, { recursive: true });
      writeFileSync(TEMOIN_BATI, version ?? "inconnue");
    } catch {
      // Sans témoin on rebâtira au prochain démarrage : coûteux, jamais faux.
    }
    console.log("\n  Construction terminée — passage à la version rapide.\n");
    enBascule = true;
    // AVANT de tuer quoi que ce soit : le battement qui suit ressemble trait
    // pour trait à un serveur mort, et le veilleur en lancerait un second.
    marquerBascule("--debut");
    serveur.kill("SIGTERM");

    // **ATTENDRE QUE LE PORT SOIT VRAIMENT RENDU, et le vérifier.**
    //
    // Trouvé à l'essai, et c'était grave : trois secondes ne suffisent pas.
    // `next dev` n'est qu'une enveloppe ; le processus qui ÉCOUTE se renomme
    // `next-server` et survit à la mort de son père. La bascule tombait donc
    // sur « EADDRINUSE », `next start` refusait de démarrer, le script mourait
    // — et le patron se retrouvait sans application, à cause du remède. C'est
    // le même piège que le 404 du 9 août (`veiller.sh`), déplacé d'un cran.
    if (!(await portRendu(20_000))) {
      try {
        // Les crochets autour du « n » : sans eux, le motif se trouverait
        // lui-même dans la ligne de commande de ce script.
        execFileSync("pkill", ["-f", "[n]ext-server"]);
      } catch {
        // Personne à tuer : tant mieux.
      }
    }

    if (await portRendu(20_000)) {
      serveur = lancerBati();
      serveur.on("exit", surSortie);
      enBascule = false;
      sertBati = true;
      // **Le drapeau ne tombe qu'une fois le NOUVEAU serveur en écoute.** Le
      // relever dès le lancement rouvrirait la fenêtre exacte qu'il ferme :
      // `next start` met plusieurs secondes à écouter, et le veilleur passe
      // toutes les quinze.
      for (let reste = 90_000; reste > 0 && !(await repond()); reste -= 1000) {
        await attendre(1000);
      }
      marquerBascule("--fin");
    } else {
      // **On ne bascule pas dans le vide.** Mieux vaut un banc lent qu'un banc
      // mort : le serveur de développement tient encore le port, il sert.
      enBascule = false;
      marquerBascule("--fin");
      console.error(
        "\n  ⚠️  Le port n'a pas été rendu : on RESTE en mode développement.\n" +
          "     L'application fonctionne — elle sera simplement moins rapide.\n" +
          "     La version rapide prendra le relais au prochain démarrage.\n"
      );
    }
  } else {
    // **Jamais en silence, et jamais rien du tout.** Voir l'en-tête : un banc
    // lent reste un banc, un banc mort coûte une soirée.
    console.error(
      "\n  ⚠️  LA CONSTRUCTION A ÉCHOUÉ — les lignes ci-dessus disent pourquoi.\n" +
        "     Atlas continue en mode développement : il fonctionne, mais chaque\n" +
        "     écran mettra jusqu'à une minute à s'ouvrir la première fois.\n"
    );
  }
}

// Arrêter ce script doit arrêter le serveur : sans cela il reste en écoute, et
// la tentative suivante échoue sur un port déjà pris — message qui n'a plus
// aucun rapport avec la cause.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    enBascule = false;
    serveur.kill(signal);
    process.exit(0);
  });
}

const LIMITE = Date.now() + 180_000;
let pret = false;
while (Date.now() < LIMITE) {
  if (await repond()) {
    pret = true;
    break;
  }
  await attendre(1000);
}

if (!pret) {
  console.error(
    "\n  ⚠️  L'application n'a pas répondu après trois minutes.\n" +
      "     Les lignes ci-dessus, émises par le serveur, disent pourquoi.\n" +
      "     Cause la plus fréquente : la base de données n'est pas montée.\n"
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
