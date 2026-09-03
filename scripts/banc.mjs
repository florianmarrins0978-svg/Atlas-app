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
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { annoncePrete } from "./annonce-adresse.mjs";
import { prendreVerrouBanc, libererVerrouBanc } from "./verrou-banc.mjs";
import { peutPrechauffer, memoireDisponibleMo } from "./memoire-prechauffage.mjs";
import {
  versionEpinglee,
  dependancesIncoherentes,
  constructionMuette,
} from "./coherence-dependances.mjs";
import {
  delogerConstructionsOrphelines,
  attendreLaConstructionEnCours,
  detenteursDuVerrou,
} from "./verrou-construction.mjs";
import { quoiServir, echangerLesDossiers } from "./relais-version-batie.mjs";
import { portLibre } from "./port-libre.mjs";

const PORT = process.env.PORT ?? "3000";
const SANTE = `http://127.0.0.1:${PORT}/api/health/live`;
// **Deux dossiers, et c'est le cœur du correctif du 10 août 2026.** Le serveur
// de développement garde `.next` ; la version bâtie vit à côté. C'est ce qui
// permet de SERVIR PENDANT QU'ON BÂTIT — sans quoi le patron regarde une page
// blanche pendant toute la construction, qui dure des dizaines de minutes sur
// un disque lent. Voir `next.config.ts` (`ATLAS_DIST_DIR`).
// **LE NEXT DU PROJET, JAMAIS CELUI QUE `npx` IRAIT CHERCHER — 31 août 2026.**
//
// Sa plainte de midi : *« version rapide en construction, elle est super
// lente »*. Sa fiche donnait le message au mot près :
//
//     ▲ Next.js 16.3.3 (Turbopack)          ← le projet épingle 16.3.2
//     Error: Could not find the Next.js package (next/package.json)
//     Resolved from: /workspaces/Atlas-app/src/app
//
// **`npx next build` ne se contente pas d'échouer quand `node_modules/next`
// manque : il TÉLÉCHARGE la dernière version depuis le registre et la lance.**
// Reproduit ici en écartant le paquet — « npm warn exec The following package
// was not found and will be installed: next@16.3.3 », puis exactement son
// erreur. Ce Next-là ne trouve évidemment pas le paquet du projet, la
// construction tombe, le banc reste en mode développement, et le veilleur
// retente la même construction condamnée indéfiniment.
//
// **C'est aussi l'explication du « 16.3.3 » du 29 août**, que `TODO.md` portait
// comme inexpliqué : ses `node_modules` n'avaient pas dérivé — c'est `npx` qui
// allait chercher ailleurs ce qui manquait chez lui.
//
// On appelle donc le binaire du projet, par son chemin. Absent, l'échec est
// franc et porte « Cannot find module » — ce que la réinstallation plus bas
// sait déjà traiter.
const NEXT = "node_modules/next/dist/bin/next";

const DIST = ".next-batie";

// **LA VERSION D'AVANT RESTE EN SERVICE PENDANT QU'ON BÂTIT LA NEUVE.**
// **Correctif du 31 août 2026, au soir — sa huitième plainte de lenteur.**
//
// Jusqu'ici, dès que le code changeait, ce script repartait sur `next dev` le
// temps de bâtir : le patron perdait sa version rapide À CHAQUE mise à jour,
// et se retrouvait sur un mode où un écran neuf met trente à cent secondes à
// s'ouvrir — au-delà de la minute que le relais de GitHub accepte d'attendre.
// Autrement dit : **pendant toute la construction, il ne pouvait rien ouvrir.**
//
// Ce n'était pas un accident, c'était le dessin : « une gêne qui s'arrête »
// (`memoire-prechauffage.mjs`). Sauf qu'elle ne s'arrêtait pas. Six sessions
// poussent sur `main` dans la même soirée ; chacun de ses redémarrages tire du
// code neuf, donc rebâtit, donc le renvoie en mode développement. La gêne était
// devenue son état ordinaire — le 14, le 16, le 17, le 20, le 25, le 29 août,
// puis deux fois le 31.
//
// **Et quand la construction ÉCHOUE, ce qui lui arrive souvent (mémoire trop
// juste, paquet absent), il restait en mode développement POUR TOUJOURS.**
// Désormais il reste sur la dernière version rapide : une application entière
// et immédiate, en retard de quelques commits — ce que la fiche de son espace
// sait déjà dire (« LE CODE SERVI N'EST PAS LE CODE RÉCUPÉRÉ »).
//
// **Le prix, dit franchement, parce qu'il est réel :** pendant la construction
// il voit le code d'AVANT. C'est le malentendu qui a coûté deux heures le
// 12 août — « commit récupéré » contre « commit servi ». Trois choses le
// tiennent : le bandeau de l'écran le dit (`BandeauBanc.tsx`), la fiche le dit,
// et la fenêtre dure le temps d'une construction, pas une soirée. À comparer
// avec ce qu'on remplace : un mode développement où il voyait le code neuf sans
// pouvoir ouvrir un seul écran.
//
// **Deux dossiers ne suffisent pas, il en faut trois.** `next build` efface son
// dossier de destination : bâtir dans celui qu'on sert retirerait le sol au
// serveur en marche. La neuve se bâtit donc à côté, et la bascule est un
// ÉCHANGE DE NOMS — deux renommages, instantanés, et réversibles si le second
// tombe. Coût mesuré : 351 Mo par dossier, dont 255 de cache (31 août 2026).
const DIST_NEUVE = ".next-batie-neuve";
const DIST_VIEILLE = ".next-batie-vieille";

const temoinBatiDans = (dossier) => `${dossier}/atlas-version-batie.txt`;
const TEMOIN_BATI = temoinBatiDans(DIST);

// **Le témoin d'une construction EN COURS, et il porte son pid.**
//
// Sans lui, le bandeau « version rapide en construction » s'éteint dès qu'on
// sert une version bâtie : `next start` impose `NODE_ENV=production`, et c'est
// à cela que l'écran reconnaissait le mode développement. Le patron verrait
// donc le code d'avant sans qu'aucun écran ne le lui dise — précisément le
// malentendu qu'on refuse de rouvrir.
//
// Le pid, parce qu'un fichier resté d'un banc tué mentirait indéfiniment : le
// lecteur demande au système si le processus vit (`src/server/etat-banc.ts`),
// exactement comme le verrou du veilleur.
const TEMOIN_CONSTRUCTION =
  process.env.ATLAS_TEMOIN_CONSTRUCTION || "/tmp/atlas-construction-en-cours.json";
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

/**
 * Dépose l'échec là où la fiche de l'espace saura le lire.
 *
 * **Sorti de la branche « construction échouée » le 2 septembre 2026, parce
 * qu'un second endroit en a besoin.** Sa panne de ce soir-là : `node_modules`
 * amputé, `next` absent, le serveur mort à la seconde — et **rien n'était
 * enregistré nulle part**, parce que seul un `next build` non nul écrivait ce
 * témoin. Sa fiche a donc répété « NE RÉPOND PAS » pendant une heure sans
 * jamais pouvoir dire pourquoi, et il a fallu lui faire lire son journal à la
 * main. Une copie de ce bloc aurait divergé au premier changement de format ;
 * la fiche, elle, n'en lit qu'un (`lire-echec-construction.mjs`).
 *
 * Ne lève jamais : un témoin qu'on ne peut pas écrire ne doit rien empêcher.
 */
function deposerEchec({ code, signal = null, sortie, verrou = null }) {
  try {
    writeFileSync(
      TEMOIN_ECHEC,
      [
        `quand: ${new Date().toISOString()}`,
        `code: ${code}`,
        // **Le signal, quand il y en a un.** C'est LUI qui distingue une
        // erreur de compilation d'un abattage par le noyau : sans cette ligne,
        // les deux s'écrivent `code: 1` et la fiche ne peut plus nommer le
        // coupable (29 août 2026).
        `signal: ${signal ?? "aucun"}`,
        // Les deux suspects d'une panne sur une machine modeste, relevés À
        // L'INSTANT de l'échec : plus tard, la mémoire est rendue et le
        // coupable a disparu.
        `disque: ${mesure("df", ["-h", "--output=avail", "."])}`,
        `memoire: ${mesure("free", ["-h"])}`,
        // **Qui tenait le verrou, s'il a parlé.** Relevé à l'instant du refus,
        // pas maintenant : le coupable a souvent disparu depuis.
        ...(verrou ? ["verrou tenu par :", verrou] : []),
        // **CE QUI A ÉTÉ DIT.** Sans ces lignes, le 16 août a été passé à
        // chercher une saturation qui n'existait pas, alors que le message
        // tenait en une phrase.
        "dit:",
        sortie || "(rien n'a été écrit)",
      ].join("\n")
    );
  } catch {
    // Un témoin qu'on ne peut pas écrire ne doit pas empêcher le repli.
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

/**
 * Les paquets dont un désaccord tue la construction sans rien dire.
 *
 * **Volontairement court, et pas au hasard :** ce sont ceux qui embarquent du
 * code natif, ou qui en dépendent. Un désaccord sur une bibliothèque en pur
 * JavaScript se signale par une erreur lisible ; un binaire natif désaccordé,
 * lui, meurt en silence — c'est précisément le cas qu'on ne sait pas voir
 * autrement.
 */
const PAQUETS_SENSIBLES = ["next", "eslint-config-next"];

/** La version installée d'un paquet, ou `null` s'il est illisible. */
function versionInstallee(nom) {
  try {
    return JSON.parse(readFileSync(`node_modules/${nom}/package.json`, "utf8")).version ?? null;
  } catch {
    // Absent ou illisible : ce n'est pas une incohérence, c'est une ignorance.
    // La réinstallation d'après, elle, sait traiter un paquet manquant.
    return null;
  }
}

/**
 * Réinstalle si `node_modules` a dérivé du projet — avant de bâtir.
 *
 * **`npm install` et non `npm ci`, pour la raison déjà écrite plus bas :** `ci`
 * efface `node_modules` avant de réinstaller, or le serveur de développement
 * TOURNE pendant ce temps et sert le patron. Lui retirer le sol coûterait sa
 * session pour réparer une lenteur.
 *
 * Jamais bloquant : si la réinstallation échoue, on bâtit quand même. Au pire
 * on retombe sur l'échec qu'on avait déjà, et le témoin le dira.
 */
async function reinstallerSiDesaccordees() {
  let paquet;
  try {
    paquet = JSON.parse(readFileSync("package.json", "utf8"));
  } catch {
    return; // Hors du dépôt : rien à comparer.
  }

  const { incoherent, motif } = dependancesIncoherentes(
    PAQUETS_SENSIBLES.map((nom) => ({
      nom,
      exigee: versionEpinglee(paquet, nom),
      installee: versionInstallee(nom),
    }))
  );
  if (!incoherent) return;

  console.log(`\n  ${motif}\n`);
  const { code, sortie } = await jouerEnRetenant("npm", ["install", "--no-audit", "--no-fund"]);
  if (code === 0 && !paquetsEpinglesAbsents().length) {
    console.log("\n  Dépendances remises d'aplomb.\n");
    return;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // **`npm install` NE RÉPARE PAS UN `node_modules` AMPUTÉ — 2 septembre 2026.**
  //
  // Sa panne du soir, et elle a duré une heure. Une installation interrompue
  // avait laissé l'arbre à moitié ; `next` manquait. Cette garde s'est bien
  // déclenchée — puis `npm install` a rendu, deux fois de suite :
  //
  //     npm error ENOTEMPTY: directory not empty, rmdir '.../scope-manager/dist'
  //     npm error ENOTEMPTY: directory not empty, rename '.../zod' -> '.../.zod-Nu9WQpaH'
  //
  // `npm install` répare un arbre COHÉRENT auquel il manque des paquets. Devant
  // des dossiers à demi effacés, il bute sur ses propres restes, et il y butera
  // encore au tour suivant : ce n'est pas une malchance passagère, c'est un
  // arbre qu'il ne sait plus démêler.
  //
  // `npm ci` efface `node_modules` avant de réinstaller — c'est exactement le
  // geste qui manquait, et c'est celui qui a rendu son application.
  //
  // **Et il est sans danger ICI, contrairement à ce que ce fichier a longtemps
  // dit.** L'ancienne consigne — « `npm install` et non `npm ci`, parce que le
  // serveur de développement TOURNE pendant ce temps » — datait d'avant le
  // 31 août, quand cette garde vivait APRÈS le lancement. Elle vient désormais
  // AVANT : rien ne sert, il n'y a aucun sol à retirer.
  console.log(
    "\n  npm install n'a pas suffi — l'arbre des dépendances est abîmé.\n" +
      "  Réinstallation complète (npm ci), deux à trois minutes.\n"
  );
  const propre = await jouerEnRetenant("npm", ["ci", "--no-audit", "--no-fund"]);

  const manquants = paquetsEpinglesAbsents();
  if (propre.code === 0 && !manquants.length) {
    console.log("\n  Dépendances remises d'aplomb.\n");
    return;
  }

  // **ET SI ÇA NE SUFFIT PAS, ON LE DIT — au lieu de foncer dans le mur.**
  //
  // L'ancienne version concluait « on tente la construction telle quelle ». Ce
  // n'est pas un repli quand le paquet ABSENT est `next` : le serveur meurt à
  // la seconde (« Cannot find module »), le banc s'arrête avec lui, le veilleur
  // le relance, et cela recommence toutes les quinze secondes SANS QUE RIEN NE
  // SOIT ENREGISTRÉ. C'est ce qui s'est passé pendant une heure : sa fiche
  // répétait « NE RÉPOND PAS » sans jamais pouvoir dire pourquoi.
  //
  // On dépose donc l'échec là où la fiche le lit. Le banc continue quand même —
  // un banc mort coûte plus cher qu'un banc qui se plaint —, mais il ne se tait
  // plus.
  deposerEchec({
    code: propre.code,
    sortie:
      (manquants.length ? `paquets épinglés toujours absents : ${manquants.join(", ")}\n` : "") +
      (propre.sortie || sortie || "(npm n'a rien écrit)"),
  });
  console.error(
    "\n  ⚠️  LES DÉPENDANCES N'ONT PAS PU ÊTRE RÉPARÉES" +
      (manquants.length ? ` — ${manquants.join(", ")} manque encore.` : ".") +
      "\n     Depuis un terminal de l'espace :  rm -rf node_modules && npm ci\n"
  );
}

/**
 * Les paquets que le projet ÉPINGLE et qui ne sont pas sur le disque.
 *
 * **La question qui manquait, et elle coûtait une heure de boucle.** La garde
 * se contentait du code de sortie de npm : une commande qui rend 0 en ayant
 * laissé `next` absent était comptée comme une réussite. On regarde ce qui
 * compte — le paquet est-il là ? —, pas ce que la commande a bien voulu dire.
 */
function paquetsEpinglesAbsents() {
  let paquet;
  try {
    paquet = JSON.parse(readFileSync("package.json", "utf8"));
  } catch {
    return [];
  }
  return PAQUETS_SENSIBLES.filter((nom) => versionEpinglee(paquet, nom) && !versionInstallee(nom));
}

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
    // **LE SIGNAL SE GARDE, et c'est un correctif — 29 août 2026.**
    //
    // Node passe `code = null` quand un enfant est ABATTU par un signal, et le
    // nom du signal arrive en second argument. L'ancienne version ne prenait que
    // le premier et le repliait sur `1` : une construction tuée par le noyau
    // faute de mémoire était donc consignée `code: 1` — **exactement comme une
    // erreur de compilation.** Les deux cas les plus opposés portaient le même
    // chiffre, et la fiche de son espace ne pouvait pas les distinguer.
    //
    // C'est ce qui a coûté la soirée du 29 août : son écran disait « la dernière
    // construction a échoué » sans pouvoir dire pourquoi, alors que la cause
    // était un manque de mémoire et que le relevé était déjà écrit à côté.
    p.on("exit", (code, signal) =>
      resoudre({ code: code ?? 1, signal: signal ?? null, sortie: gardees.join("\n") })
    );
    p.on("error", (e) => resoudre({ code: 1, signal: null, sortie: String(e?.message ?? e) }));
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
    if (await portLibre(PORT)) return true;
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
if (!(await portLibre(PORT))) {
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

// **La question n'est plus « faut-il rebâtir », mais « qu'est-ce qu'on sert
// PENDANT ».** Une version bâtie utilisable — même périmée — vaut mieux qu'un
// mode développement où rien ne s'ouvre. Le raisonnement, ce qu'il coûte et ce
// qu'il remplace vivent dans `relais-version-batie.mjs`.
const { servirDavant, modeDeveloppement, dossierDeConstruction: DIST_CONSTRUCTION } = quoiServir({
  raison,
  // `BUILD_ID` et non le dossier : `next build` crée sa destination dès la
  // première seconde, et un dossier à demi rempli ne se sert pas. Ce fichier-là
  // n'est écrit qu'à la fin d'une construction réussie.
  versionDavantUtilisable: existsSync(`${DIST}/BUILD_ID`),
  dist: DIST,
  neuve: DIST_NEUVE,
});

/** L'échange, avec les gestes de fichiers de CETTE machine. */
function echangerMaintenant() {
  const { echange, motif } = echangerLesDossiers({
    dist: DIST,
    neuve: DIST_NEUVE,
    vieille: DIST_VIEILLE,
    renommer: (de, vers) => renameSync(de, vers),
    effacer: (d) => rmSync(d, { recursive: true, force: true }),
    effacerEnFond: (d) => spawn("rm", ["-rf", d], { stdio: "ignore", detached: true }).unref(),
  });
  if (motif) console.error(`  (Échange des versions : ${motif}.)`);
  return echange;
}

/** Dit au bandeau de l'écran qu'une construction est en cours, et laquelle. */
function ouvrirLeChantier() {
  try {
    writeFileSync(
      TEMOIN_CONSTRUCTION,
      JSON.stringify({ pid: process.pid, depuis: new Date().toISOString(), versionDavant: servirDavant })
    );
  } catch {
    // Le bandeau est un confort ; son absence ne doit rien arrêter.
  }
}

/** La construction est finie — réussie ou non. Le bandeau n'a plus rien à dire. */
function fermerLeChantier() {
  try {
    rmSync(TEMOIN_CONSTRUCTION, { force: true });
  } catch {
    // Le pid inscrit dedans sert précisément à ce qu'un reste ne mente pas.
  }
}

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
  spawn(process.execPath, [NEXT, "start", "-H", "0.0.0.0", "-p", PORT],
    { stdio: SANS_TERMINAL, detached: true, env: { ...process.env, ATLAS_DIST_DIR: DIST } });
const lancerDev = () =>
  spawn(process.execPath, [NEXT, "dev", "-H", "0.0.0.0", "-p", PORT],
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

    // **PRÉCHAUFFER PEUT CONDAMNER LA CONSTRUCTION — sa panne du 29 août 2026.**
    //
    // *« L'appli est en mode lent, les fichiers n'arrivent pas à charger, elle
    // bug souvent. »* Sa capture montrait « 2 écrans sur 32 », sa fiche disait
    // « construction en cours » — depuis des jours, et jamais « échouée ».
    //
    // Ce n'était pas une lenteur, c'était un blocage, et le compte est sans
    // appel (mesures dans `memoire-prechauffage.mjs`) :
    //
    //   préchauffer les 32 écrans coûte 887 Mo au serveur de développement,
    //   `next build` en veut 2 500, son espace en a 2 900 de disponibles.
    //
    // Il manquait 500 Mo. Le noyau tuait la construction, le veilleur en
    // relançait une, et le banc restait lent **pour toujours**. Sans le
    // préchauffage, la construction a ses 2 900 Mo : elle passe.
    //
    // **L'arbitrage n'est pas symétrique**, et c'est ce qui le tranche : avec
    // préchauffage il paie une lenteur qui ne finit jamais ; sans lui, quelques
    // écrans neufs sont lents le temps d'une construction, puis plus rien. On
    // préfère une gêne qui s'arrête.
    //
    // **Rien ne change sur les machines qui ont la place** : la décision se
    // prend sur la mémoire réellement disponible, jamais sur une supposition.
    const place = peutPrechauffer(memoireDisponibleMo(readFileSync));
    if (!place.possible) {
      console.log(`\n  ${place.motif}\n`);
      // On n'écrit AUCUN état : le bandeau retombe alors sur « la version
      // rapide se construit », sans compte — ce qui est exactement vrai.
      // Y déposer un `termine: true` ferait disparaître le bandeau, et il
      // croirait l'application simplement cassée.
      return;
    }
    // Mémoire illisible : on préchauffe quand même, mais la trace existe — un
    // banc bloqué sans explication est la faute qu'on vient de payer.
    if (place.motif) console.log(`  ⚠ ${place.motif}\n`);

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
function annoncer(bati, davant = false) {
  if (annonceFaite) return;
  annonceFaite = true;
  console.log(
    annoncePrete({
      port: PORT,
      // **Trois états, trois phrases.** « Version bâtie » tout court serait un
      // demi-mensonge pendant qu'on sert la précédente : il faut qu'il sache
      // que ce qu'il essaie N'EST PAS le code qu'il vient de récupérer, sans
      // quoi c'est le malentendu du 12 août qui revient.
      precision: davant
        ? "version rapide PRÉCÉDENTE — la neuve se construit."
        : bati
          ? "version bâtie, chaque écran est immédiat."
          : "mode développement, premier accès lent.",
    })
  );
}

async function annoncerDesQueCaRepond(bati, davant = false) {
  const limite = Date.now() + 180_000;
  while (Date.now() < limite) {
    if (await repond()) {
      annoncer(bati, davant);
      return;
    }
    await attendre(1000);
  }
}

// **RÉPARER AVANT DE LANCER, ET NON PENDANT — 31 août 2026.**
//
// Ce contrôle vivait dans la voie de construction, c'est-à-dire APRÈS le
// lancement du serveur. Tant que le serveur partait par `npx`, cela ne se
// voyait pas : `npx` téléchargeait un Next du registre et servait quand même,
// mal. En appelant le binaire du projet, un `node_modules/next` absent tue le
// serveur à la seconde — et la mort du serveur **arrête ce script** (voir
// `surSortie` juste en dessous). La réparation était donc coupée en plein
// `npm install`, ce qui est le pire moment pour interrompre une installation.
//
// Trouvé en le JOUANT, pas en le relisant : paquet écarté à la main, banc
// lancé, sortie 1 sans un mot après « Réinstallation avant de bâtir ».
//
// Ne coûte rien quand tout va bien : deux `package.json` lus, aucune commande.
await reinstallerSiDesaccordees();

let serveur = modeDeveloppement ? lancerDev() : lancerBati();
let enBascule = false;
// Ce qui SERT réellement, à cet instant — pas ce qu'on espérait servir. La
// bascule peut échouer (le port n'est pas rendu) : l'annonce doit alors dire
// « mode développement », sinon elle promet une vitesse qui n'existe pas.
let sertBati = !modeDeveloppement;

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
process.on("exit", () => {
  tuerLeServeur(serveur);
  // Un banc arrêté ne construit plus : laisser le témoin ferait dire au
  // bandeau qu'une construction avance alors que plus personne ne bâtit.
  fermerLeChantier();
});

if (raison) {
  ouvrirLeChantier();
  if (servirDavant) {
    console.log(`\n  Atlas répond déjà, sur la version rapide PRÉCÉDENTE.`);
    void annoncerDesQueCaRepond(true, true);
    // **AUCUN PRÉCHAUFFAGE ICI, et ce n'est pas un oubli.** Une version bâtie
    // n'a rien à préchauffer : ses écrans sortent en 50 à 100 ms. Et les 887 Mo
    // que le préchauffage retiendrait sont exactement ceux qui manquaient à la
    // construction sur son espace (`memoire-prechauffage.mjs`) — servir la
    // version d'avant supprime donc l'arbitrage au lieu de le trancher.
  } else {
    console.log(`\n  Atlas répond déjà, en mode développement.`);
    // Pas d'`await` : le préchauffage, l'annonce et la construction avancent
    // ensemble. L'adresse doit partir la première — c'est elle qu'il attend.
    void annoncerDesQueCaRepond(false);
    prechaufferEcransPublics();
  }
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

  // **MAIS ON DÉLOGE L'ORPHELINE — et ce n'est pas le même geste.**
  //
  // Le 17 août 2026 au soir : *« même problème qu'hier, l'appli est super
  // lente »*, et sa fiche portait le même refus qu'la veille. Ce n'était
  // pourtant pas la même panne : le correctif du 16 tue les constructions **au
  // démarrage**, or son espace n'a que 8 Go et le noyau tue un processus quand
  // la mémoire manque. Un banc tué laisse SA construction vivante ; le veilleur
  // en relance un ; celui-là tombe sur le verrou de l'orpheline, et le banc
  // reste lent pour le reste de la soirée.
  //
  // On ne double donc pas une construction — on retire celle qui n'a plus de
  // destinataire. Le raisonnement complet est dans `verrou-construction.mjs`.
  await delogerConstructionsOrphelines({ dossierDist: DIST_CONSTRUCTION, dire: (m) => console.log(m) });

  // **DES DÉPENDANCES DÉSACCORDÉES SE VOIENT AVANT DE BÂTIR — 29 août 2026.**
  //
  // Sa fiche, ce soir-là : `code: 1`, 5,7 Go de mémoire libre, et pour toute
  // sortie « ▲ Next.js 16.3.3 (Turbopack) ». Or le projet épingle **16.3.2**,
  // dans `package.json` comme dans le verrou. Ses `node_modules` avaient
  // dérivé, et Next embarque des binaires natifs versionnés à l'identique : le
  // compilateur meurt à leur chargement, après l'en-tête, **sans un mot**.
  //
  // Et rien ne pouvait le rattraper : la réinstallation automatique, plus bas,
  // exige `Cannot find module` dans la sortie. Un paquet ABSENT la déclenche ;
  // un paquet PRÉSENT MAIS DÉSACCORDÉ, non — il ne dit rien. Le veilleur
  // retentait donc la même construction condamnée, indéfiniment.
  //
  // Deux nombres suffisent à le voir, et sans rien lancer — c'est fait plus
  // haut, AVANT de lancer quoi que ce soit (voir le bloc qui précède le
  // lancement du serveur).

  // La construction écrit dans SON dossier : le serveur de développement garde
  // le sien, et les deux ne se marchent jamais dessus.
  // Rempli seulement si le verrou parle : c'est la seule information qui
  // manquait pour comprendre pourquoi deux constructions se rencontrent.
  let quiTenaitLeVerrou = "";
  let { code, signal, sortie } = await jouerEnRetenant(process.execPath, [NEXT, "build"], { ...process.env, ATLAS_DIST_DIR: DIST_CONSTRUCTION });

  // **Une seconde tentative, et une seule, quand c'est LE verrou qui a parlé.**
  //
  // Une construction peut naître entre notre délogement et notre lancement — la
  // fenêtre est courte, elle n'est pas nulle. Repartir coûte quelques minutes ;
  // ne pas repartir coûte une soirée entière en mode développement, où chaque
  // écran se compile à l'ouverture. On ne réessaie QUE sur ce refus-là : une
  // erreur de types ne se répare pas en insistant.
  if (code !== 0 && /Another next build process is already running/i.test(sortie)) {
    // **On ATTEND d'abord, on déloge seulement après — corrigé le 21 août
    // 2026.** Déloger n'a de sens que contre une orpheline ; contre une
    // construction vivante, qui fait exactement le travail qu'on s'apprête à
    // faire, c'est jeter plusieurs minutes de calcul pour recommencer. Le
    // démarrage en lance deux par nature (`verrou-construction.mjs`), et c'est
    // précisément là que le patron le payait.
    // **QUI le tient : relevé MAINTENANT, et gardé pour le témoin d'échec.**
    // Trois matinées de suite ont été perdues faute de cette ligne : on savait
    // qu'un verrou était tenu, jamais par qui. Plus tard, le coupable a disparu
    // et il ne reste qu'à supposer — ce que ce dépôt s'interdit (`AGENTS.md`).
    quiTenaitLeVerrou = detenteursDuVerrou(DIST_CONSTRUCTION)
      .map(({ pid, ligne }) => `      pid ${pid} — ${ligne}`)
      .join("\n");
    console.log("\n  (Le verrou de construction est tenu.)\n");
    if (quiTenaitLeVerrou) console.log(`  Il est tenu par :\n${quiTenaitLeVerrou}\n`);
    await attendreLaConstructionEnCours({ dossierDist: DIST_CONSTRUCTION, dire: (m) => console.log(m) });
    // Ce qui reste après l'attente est bien une orpheline, ou rien du tout.
    await delogerConstructionsOrphelines({ dossierDist: DIST_CONSTRUCTION, dire: (m) => console.log(m) });
    ({ code, signal, sortie } = await jouerEnRetenant(process.execPath, [NEXT, "build"], { ...process.env, ATLAS_DIST_DIR: DIST_CONSTRUCTION }));
  }

  // ─── UNE DÉPENDANCE MANQUANTE SE RÉPARE, ELLE NE S'ATTEND PAS ─────────────
  //
  // **Sa plainte du 25 août 2026 : « l'application est en mode lent, et elle
  // crash ».** Sa fiche donnait la cause au mot près :
  //
  //     Error: Cannot find module
  //     '/workspaces/Atlas-app/node_modules/@swc/helpers/cjs/_interop_require_default.cjs'
  //
  // Un paquet absent de ses `node_modules`. La construction tombe, le banc
  // reste en développement — où chaque écran se compile à l'ouverture —, et le
  // même paquet manquant fait tomber les écrans à l'exécution. **Une seule
  // cause, ses deux symptômes.**
  //
  // **Le veilleur retentait indéfiniment la MÊME construction.** Trois fois à
  // dix minutes, puis toutes les demi-heures : contre un fichier absent,
  // insister ne répare rien. C'est le défaut réel — non pas que la
  // construction échoue, mais que rien ne tente jamais ce qui la relèverait.
  //
  // **C'est la DEUXIÈME fois.** Le 22 août, `Cannot find module
  // './detect-typo'` dans `node_modules/next` avait éteint son espace toute une
  // soirée, et il avait fallu qu'on lui fasse taper la commande. Un défaut qui
  // revient et qu'on répare deux fois à la main est un défaut qu'on n'a pas
  // réparé.
  //
  // **`npm install` et non `npm ci`, à dessein.** `ci` efface `node_modules`
  // avant de réinstaller — or le serveur de développement TOURNE pendant ce
  // temps et sert le patron. Lui retirer le sol coûterait sa session pour
  // réparer une lenteur. `install` complète en place, ce qui suffit à un paquet
  // absent — le cas que sa fiche montre.
  //
  // **Une seule fois.** Si la construction retombe après la réinstallation, on
  // s'arrête : le témoin d'échec garde les deux sorties, et la fiche de son
  // espace les publiera. Insister davantage rendrait la boucle infinie qu'on
  // vient de supprimer.
  //
  // **Et « Could not find the Next.js package » en fait partie — 31 août 2026.**
  // C'est ce que rend Turbopack quand `node_modules/next` manque. Le message ne
  // contient ni « Cannot find module » ni « node_modules » : il passait donc au
  // travers des deux conditions ci-dessous, et le veilleur retentait la même
  // construction condamnée toute la matinée.
  const dependanceManquante =
    code !== 0 &&
    ((/Cannot find module|MODULE_NOT_FOUND/i.test(sortie) && /node_modules/.test(sortie)) ||
      /Could not find the Next\.js package/i.test(sortie));

  // **Le second filet — 29 août 2026.** La condition ci-dessus exige un
  // message ; sa construction n'en produisait aucun. Une mort juste après
  // l'en-tête, sans une ligne d'explication, est la signature d'un
  // `node_modules` cassé — un binaire natif corrompu, un paquet à demi
  // installé — que la comparaison de versions ne peut pas voir.
  const morteSansRienDire = constructionMuette({ code, sortie });

  if (dependanceManquante || morteSansRienDire) {
    console.log(
      (morteSansRienDire && !dependanceManquante
        ? "\n  La construction s'est arrêtée sans rien dire — c'est la marque de\n" +
          "  dépendances abîmées.\n"
        : "\n  Un paquet manque dans node_modules — la construction ne peut pas aboutir.\n") +
        "  Réinstallation des dépendances, puis nouvelle tentative.\n"
    );
    const { code: codeInstall } = await jouerEnRetenant("npm", [
      "install",
      "--no-audit",
      "--no-fund",
    ]);
    if (codeInstall === 0) {
      await delogerConstructionsOrphelines({ dossierDist: DIST_CONSTRUCTION, dire: (m) => console.log(m) });
      ({ code, signal, sortie } = await jouerEnRetenant(process.execPath, [NEXT, "build"], {
        ...process.env,
        ATLAS_DIST_DIR: DIST_CONSTRUCTION,
      }));
    } else {
      console.log("\n  La réinstallation a échoué : le banc reste en mode développement.\n");
    }
  }

  fermerLeChantier();

  if (code === 0) {
    try {
      // **Dans le dossier qu'on vient de bâtir, pas dans celui qu'on sert.**
      // L'écrire dans `DIST` avant l'échange ferait dire à la fiche que le code
      // neuf est servi alors qu'il ne l'est pas encore — et si l'échange
      // échoue, elle le dirait pour toujours.
      mkdirSync(DIST_CONSTRUCTION, { recursive: true });
      writeFileSync(temoinBatiDans(DIST_CONSTRUCTION), version ?? "inconnue");
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

    // **L'échange n'a lieu qu'ICI, serveur mort.** Renommer sous un serveur
    // vivant lui retirerait les fichiers qu'il lit encore — un écran sur deux
    // rendrait une erreur, ce qui est pire que la lenteur qu'on répare.
    if (servirDavant && !echangerMaintenant()) {
      console.error(
        "\n  ⚠️  La version neuve n'a pas pu prendre la place de l'ancienne.\n" +
          "     Atlas repart sur la version PRÉCÉDENTE — entière et rapide, mais\n" +
          "     en retard. La fiche de l'espace le dira, et le prochain démarrage\n" +
          "     refera l'échange.\n"
      );
    }

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
    // L'échec se dépose là où la fiche saura le lire — un seul écrivain pour
    // ce format, partagé avec la réparation des dépendances (`deposerEchec`).
    deposerEchec({ code, signal, sortie, verrou: quiTenaitLeVerrou });
    // **Jamais en silence, et jamais rien du tout.** Voir l'en-tête : un banc
    // lent reste un banc, un banc mort coûte une soirée.
    // **Et le repli n'est plus le même selon qu'une version rapide existe.**
    // C'est tout l'apport du correctif du 31 août au soir : un échec de
    // construction ne le condamne plus au mode développement — il garde une
    // application entière et immédiate, simplement en retard.
    console.error(
      servirDavant
        ? "\n  ⚠️  LA CONSTRUCTION A ÉCHOUÉ — les lignes ci-dessus disent pourquoi.\n" +
            "     Atlas RESTE sur la version rapide précédente : chaque écran s'ouvre\n" +
            "     du premier coup, mais c'est le code d'AVANT. La fiche de l'espace\n" +
            "     le dit (« LE CODE SERVI N'EST PAS LE CODE RÉCUPÉRÉ »).\n"
        : "\n  ⚠️  LA CONSTRUCTION A ÉCHOUÉ — les lignes ci-dessus disent pourquoi.\n" +
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
