import { readdirSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import Redis from "ioredis";
import { SUITES_SERVEUR } from "./_suites-serveur";

const DOSSIER = path.join(__dirname);
const NODE = process.execPath;
const TSX = path.join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function attendre(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Chaque suite ouvre sa propre session avec le compte de démonstration, alors
// que la connexion est limitée à 5 tentatives par email et par fenêtre de 15
// minutes (LIMITES.connexion) : passé la cinquième suite, toutes les
// connexions échouaient, et l'échec se présentait comme un banal dépassement de
// délai sur la redirection post-login.
//
// Le compteur est donc remis à zéro entre deux suites — qui sont indépendantes
// et représentent chacune une session distincte. Le contrôle reste entier à
// l'intérieur d'une suite, et sa logique propre est couverte par
// test-rate-limit.ts et test-rate-limit-redis-real.ts.
//
// Suppose REDIS_URL : avec l'adaptateur mémoire, le compteur vit dans le
// processus serveur et reste hors d'atteinte.
async function reinitialiserLimiteConnexion() {
  const url = process.env.REDIS_URL;
  if (!url) return;
  const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    const cles = await redis.keys("ratelimit:connexion:*");
    if (cles.length > 0) await redis.del(...cles);
  } catch (err) {
    console.warn(`⚠ Réinitialisation de la limite de connexion impossible : ${err instanceof Error ? err.message : err}`);
  } finally {
    await redis.quit();
  }
}

/**
 * Le serveur est-il encore vivant ?
 *
 * Généreux à dessein. En mode développement, le serveur compile les routes à la
 * demande et peut rester sourd plusieurs dizaines de secondes sur une machine
 * chargée — sans être mort pour autant. Un contrôle impatient ferait pire que
 * l'absence de contrôle : il arrêterait une exécution parfaitement valable.
 *
 * On ne conclut donc à la mort qu'après plusieurs tentatives infructueuses
 * réparties sur une minute.
 */
async function serveurVivant(url: string, tentatives = 6, delaiMs = 10_000): Promise<boolean> {
  for (let i = 0; i < tentatives; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(delaiMs) });
      if (r.status === 200) return true;
    } catch {
      // Occupé, ou parti — la suite des tentatives tranchera.
    }
    if (i < tentatives - 1) await attendre(1000);
  }
  return false;
}

/**
 * Fait compiler les écrans les plus traversés avant que la première suite ne
 * les touche.
 *
 * **La première suite payait pour toutes les autres.** En mode développement,
 * chaque route se compile au premier appel. `test-adresse-suggestions-e2e` passe
 * la première dans l'ordre alphabétique : elle attendait donc la compilation de
 * `/login`, de l'accueil ET de la fiche de chantier, et tombait sur un
 * dépassement de délai en accusant l'adresse — qui n'y était pour rien.
 * Constaté le 8 août 2026 : elle échouait en batterie et passait seule.
 *
 * Une répondre-sur-`/api/health/live` ne suffit pas : cette route-là est
 * minuscule et se compile en quelques centaines de millisecondes, pendant que
 * les écrans réels en demandent des dizaines de secondes.
 *
 * Ne fait jamais échouer la batterie : si un écran ne répond pas ici, la suite
 * qui en dépend le dira mieux, avec son propre message.
 */
/**
 * Préchauffer les écrans — **avec une session, sinon on ne préchauffe rien.**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Trois faux rouges en une journée, le 12 août 2026**, sur trois suites sans
 * rapport : « clôturé AVANT sa date » (deux fois), « Créer la facture », puis
 * « un appui dicte, un second enregistre ». Chacune diagnostiquait la même
 * chose et avait raison — le serveur de développement n'avait pas suivi — et
 * chacune passait au vert jouée seule. Coût : une batterie complète rejouée à
 * chaque fois, vingt-cinq minutes, quatre fois dans la journée.
 *
 * **La cause n'était pas la machine** — 13 Go libres, charge à 1,2 — mais deux
 * défauts de ce préchauffage :
 *
 *   1. **il tournait SANS session.** Un appel anonyme sur `/termines` est
 *      renvoyé vers `/login` par le middleware : la route visée n'est jamais
 *      rendue, donc jamais compilée. Il ne préchauffait en vérité que `/login`,
 *      et faisait croire au contraire ;
 *   2. **sa liste était incomplète** — `/termines`, justement, n'y figurait pas,
 *      alors que c'est l'écran qui a dépassé son délai deux fois.
 *
 * **Et les deux défauts avaient la même origine : une deuxième implémentation.**
 * `scripts/prechauffer.mjs` sait ouvrir une session et parcourir la liste
 * complète, écrans de chantier compris — c'est ce que fait le banc d'essai
 * depuis toujours. La batterie, elle, avait sa propre version naïve. Deux
 * copies de la même idée finissent toujours par diverger, et c'est la plus
 * faible qui servait ici (`CLAUDE.md` §3).
 *
 * Enveloppé en entier : un préchauffage qui échoue ne doit pas empêcher la
 * batterie de tourner. Au pire, le premier appel repaie son coût — c'est-à-dire
 * la situation d'avant.
 */
async function prechaufferLesEcrans(): Promise<void> {
  try {
    const { cookieDeSession, ecransDeChantier, ECRANS_A_PRECHAUFFER, prechauffer } = await import(
      "./prechauffer.mjs"
    );
    let motif: string | null = null;
    const cookie = await cookieDeSession({
      databaseUrl: process.env.DATABASE_URL,
      authSecret: process.env.AUTH_SECRET,
      nodeEnv: process.env.NODE_ENV,
      ecrire: (raison: string) => {
        motif = raison;
      },
    });
    if (!cookie) {
      // **Dire la VRAIE raison.** Un préchauffage muet laisserait croire qu'il a
      // eu lieu, et les faux rouges reviendraient sans qu'on sache pourquoi.
      console.log(`⚠ Préchauffage sans session : ${motif ?? "raison inconnue"}`);
      return;
    }
    const base = "http://localhost:3000";
    const ecrans = [...ECRANS_A_PRECHAUFFER, ...(await ecransDeChantier({ base, cookie }))];
    console.log(`Préchauffage de ${ecrans.length} écrans (compilation à la demande)...`);
    const bilan = await prechauffer({ base, cookie, ecrans });
    console.log(
      `Préchauffage terminé : ${bilan.reussis} écran(s) prêts` +
        (bilan.echoues ? `, ${bilan.echoues} en échec` : "") +
        ` — ${bilan.secondes} s.`
    );
  } catch (err) {
    console.log(
      `⚠ Préchauffage impossible : ${err instanceof Error ? err.message : String(err)}. ` +
        "La batterie continue — le premier appel de chaque écran paiera sa compilation."
    );
  }
}

async function attendreServeurPret(url: string, tentativesMax = 30): Promise<boolean> {
  for (let i = 0; i < tentativesMax; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 200) return true;
    } catch {
      // pas encore prêt
    }
    await attendre(1000);
  }
  return false;
}

/**
 * `--seulement <motif>` : ne jouer que les suites dont le nom le contient.
 *
 * **Écrit le 12 août 2026, après avoir rejoué vingt-cinq minutes de batterie
 * pour observer UNE suite.** Diagnostiquer un rouge ne doit pas coûter le prix
 * de la batterie entière — c'est ce coût-là qui pousse à supposer la cause au
 * lieu d'aller la lire, et le dépôt a déjà payé cher les pannes imaginées
 * (`AGENTS.md`).
 *
 * Ce filtre ne remplace jamais la batterie : elle reste ce qui autorise une
 * livraison, et le script le dit à voix haute dès qu'il en écarte une.
 */
const motifDemande = (() => {
  const i = process.argv.indexOf("--seulement");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
})();

if (process.argv.includes("--list")) {
  const fichiers = readdirSync(DOSSIER)
    .filter((f) => f.endsWith("-e2e.ts") || SUITES_SERVEUR.includes(f))
    .filter((f) => (motifDemande === null ? true : f.includes(motifDemande)))
    .sort();
  console.log("Suites e2e découvertes :");
  for (const fichier of fichiers) {
    console.log(fichier);
  }
  process.exit(0);
}

/**
 * Quelque chose écoute-t-il déjà sur le port qu'on s'apprête à prendre ?
 *
 * **Ce que ça évite, et qui est arrivé quatre fois le 11 août 2026.** Ce script
 * lançait son serveur, puis attendait qu'une santé réponde sur le port 3000. Il
 * ne vérifiait jamais que la réponse venait de SON serveur. Un orphelin d'une
 * exécution précédente suffisait : le `next dev` lancé ici mourait aussitôt sur
 * `EADDRINUSE`, sans que personne ne lise sa sortie, et **cinquante suites
 * travaillaient sur un serveur que la batterie n'avait pas démarré**.
 *
 * Le prix payé : un rouge dans `test-prix-e2e` (« '0.00' == '34.50' »), qui
 * n'avait rien à voir avec le prix — l'occupant compilait, l'enregistrement
 * n'avait pas le temps de partir. Une batterie qui interroge un serveur
 * inconnu ne prouve rien, verte OU rouge : c'est le pire des deux états.
 */
async function quelquUnEcouteDeja(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.status === 200;
  } catch {
    // Personne, ou quelque chose qui ne répond pas comme Atlas : dans les deux
    // cas, notre serveur dira lui-même s'il n'arrive pas à prendre le port.
    return false;
  }
}

async function main() {
  // **Avant tout le reste** : un port occupé rend la suite entière ininterprétable.
  if (await quelquUnEcouteDeja("http://localhost:3000/api/health/live")) {
    console.error(
      "❌ Quelque chose écoute DÉJÀ sur le port 3000, et ce n'est pas cette batterie.\n" +
        "   Refus de continuer : les suites travailleraient sur ce serveur-là — celui d'un autre\n" +
        "   code, peut-être d'une autre branche — et leur résultat ne voudrait rien dire.\n" +
        "   Le plus souvent, c'est un orphelin du banc d'essai :\n" +
        "     pgrep -af 'next-server|next dev'   puis   kill -9 <pid>"
    );
    process.exit(1);
  }

  // **Et sans REDIS_URL, la batterie se saborde à la sixième suite.**
  //
  // Payé le 14 août 2026 : lancée sans cette variable, elle a rendu vingt
  // rouges — et pas un seul ne désignait le coupable. Tous disaient la même
  // chose, « dépassement de délai en attendant la redirection après la
  // connexion », c'est-à-dire : le formulaire de connexion est cassé. Il ne
  // l'était pas. Le limiteur de débit n'accepte que cinq connexions par quart
  // d'heure pour un même couple (compte, adresse IP) ; toutes les suites se
  // connectent avec le même compte depuis 127.0.0.1, et le compteur ne se remet
  // à zéro entre deux suites QUE s'il vit dans Redis — celui de l'adaptateur
  // mémoire est enfermé dans le processus serveur, hors d'atteinte.
  //
  // `reinitialiserLimiteConnexion` se taisait alors et rendait la main : le
  // seul garde-fou de la batterie s'éteignait sans un mot. On refuse désormais
  // de partir, plutôt que de rendre pendant vingt minutes un verdict faux.
  //
  // (`monter-base-locale.sh` ne pose délibérément PAS REDIS_URL : les suites
  // BASE laisseraient une connexion ioredis ouverte et ne rendraient jamais la
  // main. C'est bien à l'appelant des suites navigateur de la poser.)
  if (!process.env.REDIS_URL) {
    console.error(
      "❌ REDIS_URL n'est pas posée, et sans elle cette batterie ne veut rien dire.\n" +
        "   Le limiteur de connexion bloque au bout de 5 connexions par quart d'heure ;\n" +
        "   il ne se remet à zéro entre deux suites que s'il vit dans Redis. Sans quoi,\n" +
        "   à partir de la sixième suite, TOUT échoue sur « dépassement de délai » à la\n" +
        "   connexion — un message qui accuse le formulaire alors qu'il va très bien.\n" +
        "   Relancer avec :\n" +
        "     REDIS_URL=redis://localhost:6379 npm run test:e2e"
    );
    process.exit(1);
  }

  console.log("Seed de la base de développement...");
  const seedResult = spawnSync(NODE, [TSX, "src/server/db/seed.ts"], {
    stdio: "inherit",
    env: process.env,
  });
  if (seedResult.error) {
    console.error(`❌ Impossible de lancer le seed de la base de développement (spawn error: ${seedResult.error.message}).`);
    process.exit(1);
  }
  if (seedResult.signal) {
    console.error(`❌ Impossible de lancer le seed de la base de développement (signal: ${seedResult.signal}).`);
    process.exit(1);
  }
  if (seedResult.status !== 0) {
    console.error(`❌ Impossible de lancer le seed de la base de développement (code: ${seedResult.status}).`);
    process.exit(1);
  }

  console.log("Démarrage du serveur (mode développement)...");
  const serveur = spawn(NPM, ["run", "dev", "--", "-p", "3000"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  // La sortie du serveur était jusqu'ici jetée. Quand il meurt en cours de
  // route, les suites suivantes échouent toutes sur un banal dépassement de
  // délai à /login, et rien n'indique la cause réelle. On garde donc ses
  // dernières lignes pour pouvoir les montrer au moment où ça compte.
  const journalServeur: string[] = [];
  const retenir = (donnees: Buffer) => {
    for (const ligne of donnees.toString().split("\n")) {
      if (ligne.trim()) journalServeur.push(ligne);
    }
    if (journalServeur.length > 200) journalServeur.splice(0, journalServeur.length - 200);
  };
  serveur.stdout?.on("data", retenir);
  serveur.stderr?.on("data", retenir);

  let serveurTermine: string | null = null;
  serveur.on("exit", (code, signal) => {
    serveurTermine = signal ? `signal ${signal}` : `code ${code}`;
  });

  function montrerJournalServeur() {
    console.error("\n--- Dernières lignes du serveur de développement ---");
    for (const ligne of journalServeur.slice(-60)) console.error(`  ${ligne}`);
    console.error("---------------------------------------------------\n");
  }

  const pret = await attendreServeurPret("http://localhost:3000/api/health/live");
  if (!pret) {
    console.error("❌ Le serveur n'a jamais répondu — abandon.");
    montrerJournalServeur();
    process.kill(-serveur.pid!);
    process.exit(1);
  }

  const fichiers = readdirSync(DOSSIER)
    .filter((f) => f.endsWith("-e2e.ts") || SUITES_SERVEUR.includes(f))
    .filter((f) => (motifDemande === null ? true : f.includes(motifDemande)))
    .sort();

  if (process.argv.includes("--list")) {
    console.log("Suites e2e découvertes :");
    for (const fichier of fichiers) {
      console.log(fichier);
    }
    process.exit(0);
  }

  // **Dire ce qui est écarté, toujours.** Un filtre silencieux ferait passer
  // « 1/1 suite réussie » pour une batterie verte — exactement le genre de
  // vert qui ne prouve rien.
  if (motifDemande !== null) {
    console.log(
      `⚠ Filtre « ${motifDemande} » : ${fichiers.length} suite(s) retenue(s). ` +
        `Ce n'est PAS la batterie — elle se rejoue en entier sans --seulement.`
    );
    if (fichiers.length === 0) {
      console.error(`❌ Aucune suite ne correspond à « ${motifDemande} ».`);
      process.kill(-serveur.pid!);
      process.exit(1);
    }
  }

  await prechaufferLesEcrans();

  console.log(`\nExécution de ${fichiers.length} suites dépendant du serveur...\n`);
  let echecs = 0;
  for (const fichier of fichiers) {
    console.log(`=== ${fichier} ===`);

    // Un serveur mort ne se répare pas en lui envoyant vingt suites de plus :
    // il produit vingt échecs qui accusent chacun un écran différent. On
    // s'arrête au premier, en disant ce qui s'est réellement passé.
    if (!(await serveurVivant("http://localhost:3000/api/health/live"))) {
      console.error(
        `❌ Le serveur ne répond plus avant ${fichier}` +
          (serveurTermine ? ` — il s'est arrêté (${serveurTermine}).` : " — il est resté sourd une minute.")
      );
      console.error("   Les suites restantes ne sont pas jouées : elles échoueraient toutes sur ce même point.");
      montrerJournalServeur();
      echecs += fichiers.length - fichiers.indexOf(fichier);
      break;
    }

    await reinitialiserLimiteConnexion();
    const resultat = spawnSync(NODE, [TSX, path.join(DOSSIER, fichier)], {
      stdio: "inherit",
      env: process.env,
    });
    if (resultat.error) {
      echecs++;
      console.error(`❌ ${fichier} a échoué (spawn error: ${resultat.error.message})`);
      continue;
    }
    if (resultat.signal) {
      echecs++;
      console.error(`❌ ${fichier} a échoué (signal: ${resultat.signal})`);
      continue;
    }
    if (resultat.status !== 0) {
      echecs++;
      console.error(`❌ ${fichier} a échoué (code: ${resultat.status})`);
    }
  }

  // Le serveur a pu mourir de lui-même : le tuer alors lève ESRCH et masque le
  // bilan, qui est la seule ligne que quiconque va lire.
  try {
    process.kill(-serveur.pid!);
  } catch {
    // Déjà parti — rien à faire, et surtout rien à cacher.
  }
  console.log(`\n${fichiers.length - echecs}/${fichiers.length} suites réussies.`);
  if (echecs > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
