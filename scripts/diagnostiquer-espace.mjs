#!/usr/bin/env node
/**
 * « J'ai relancé le banc, j'ai essayé, ça ne marche pas. »
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce script existe.** Le patron, le 11 août 2026 au soir. Deux
 * hypothèses ont été avancées pour l'expliquer — un service de transcription
 * absent, puis une branche différente de celle où l'on pousse — et **les deux
 * étaient fausses**. Chacune lui a coûté un aller-retour pour rien.
 *
 * Le défaut n'était pas de s'être trompé : c'est d'avoir raisonné à distance
 * sur une machine qu'on ne voit pas, alors que cette machine sait tout. Ce
 * script arrête cette classe d'échanges. Il ne devine rien, il regarde.
 *
 * **Ce qu'il montre, et que rien d'autre ne montre :** le commit RÉELLEMENT
 * SERVI. La ligne « Version » de l'écran Réglages lit le dépôt — donc le code
 * *récupéré*. La version rapide, elle, est un dossier bâti et figé : entre les
 * deux, il peut y avoir un monde, et c'est exactement là que se logeait le
 * malentendu.
 *
 *   node scripts/diagnostiquer-espace.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { verdictPort, regarderDuDehors } from "./_verdict-port.mjs";
import { portLibre } from "./port-libre.mjs";
import { lireEchecConstruction, phraseEchec } from "./lire-echec-construction.mjs";

const DIST = ".next-batie";
// **Détournable pour l'éprouver, comme le témoin d'échec plus bas — et ce
// n'est pas une commodité.** Le 17 août 2026, la suite `test-banc-lent-se-dit`
// a rougi sur QUATRE cas sans le moindre défaut de produit : la batterie
// elle-même lance un banc à sa dernière étape, ce banc bâtit, et laisse dans le
// dépôt un témoin portant le commit courant. Le diagnostic répondait alors
// « Code SERVI : <commit> » là où la suite attendait « en cours » ou
// « ÉCHOUÉ ». Un contrôle qui dépend d'un reste laissé par un autre contrôle
// rougit au hasard — et un rouge au hasard s'apprend à être ignoré.
const TEMOIN_BATI = process.env.ATLAS_TEMOIN_BATI || `${DIST}/atlas-version-batie.txt`;
// Posé par `banc.mjs` quand `next build` tombe. Voir son en-tête : « aucune
// version bâtie » recouvrait trois états très différents, dont un seul est
// passager.
const TEMOIN_ECHEC =
  // Détournable uniquement pour l'éprouver : une suite ne peut pas écrire
  // dans /tmp sans marcher sur le banc réel de la machine qui la joue.
  process.env.ATLAS_TEMOIN_ECHEC || "/tmp/atlas-construction-echouee.txt";
const FICHIER_ISSUE = "/tmp/atlas-mise-a-jour.txt";
/**
 * Le témoin qu'une construction tourne à cet instant (`scripts/banc.mjs`).
 *
 * **Il change le CONSEIL, pas le constat.** Depuis le 31 août 2026 au soir, le
 * banc garde la version rapide précédente en service pendant qu'il bâtit la
 * neuve : « le code servi n'est pas le code récupéré » devient alors l'état
 * NORMAL de deux à cinq minutes, et non plus une version figée qu'il faut aller
 * relever à la main. Envoyer rallumer un espace qui est en train de faire
 * exactement ce qu'on lui demande coûte un redémarrage pour rien — et jette la
 * construction en cours.
 */
const TEMOIN_CONSTRUCTION =
  process.env.ATLAS_TEMOIN_CONSTRUCTION || "/tmp/atlas-construction-en-cours.json";
/**
 * À quel moment cette fiche est écrite — la MÊME variable que l'en-tête.
 *
 * **Le trou du 2 septembre 2026, et il envoyait faire exactement le geste
 * qu'il ne fallait pas.** `rapporter-espace.mjs` distingue ses passages depuis
 * le 12 août — « à l'allumage », « après démarrage », « par le veilleur » —
 * parce que les mêmes mots ne veulent pas dire la même chose selon l'heure. Il
 * l'écrivait en tête de fiche… et ce diagnostic-ci n'en savait rien : il
 * raisonnait toujours comme devant une machine posée.
 *
 * Ce que cela donnait à l'allumage, sur la fiche du patron : l'en-tête
 * annonçait « le serveur n'a pas encore eu le temps de démarrer », et quatre
 * lignes plus bas le verdict lui ordonnait « arrêtez puis rouvrez l'espace de
 * travail ». Or à cet instant le banc n'a pas encore démarré — le veilleur le
 * lance dans les quinze secondes — et rallumer JETTE la construction qui
 * allait partir. Il rallume, retombe sur la même fiche, rallume encore.
 *
 * Lue ici plutôt que passée en argument : il n'y a qu'un chemin d'appel, et
 * deux façons de dire le même moment finiraient par diverger (`CLAUDE.md` §3).
 */
const auDemarrage = process.env.ATLAS_MOMENT === "allumage";
/** Ce que `ouvrir-port.sh` a rendu au dernier démarrage : un seul mot. */
const FICHIER_PORT = "/tmp/atlas-port.txt";
// **Le MÊME nom de variable que `veiller.sh`, et détournable pour la même
// raison.** Une suite qui poserait ce fichier dans `/tmp` écraserait l'état du
// veilleur RÉEL de la machine qui la joue — la fiche du patron annoncerait
// alors un veilleur qui n'est pas le sien. Le veilleur s'isole déjà ainsi
// (`ATLAS_VERROU_VEILLEUR`) ; en inventer un second ici aurait fait deux noms
// pour un seul fichier.
const VERROU_VEILLEUR = process.env.ATLAS_VERROU_VEILLEUR || "/tmp/atlas-veilleur.pid";
const PORT = process.env.PORT ?? "3000";

/**
 * Une mesure du système, sur une ligne, ou « inconnu ».
 *
 * Ne lève jamais : ce diagnostic doit rester lisible sur une machine qui n'a ni
 * `df` ni `free`. Un relevé manquant vaut mieux qu'un diagnostic qui tombe.
 */
function mesureSysteme(commande, args) {
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

/** Une commande git, ou `null` si elle échoue — jamais une exception. */
function git(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

const court = (sha) => (sha ? sha.slice(0, 7) : "?");

function veilleurVivant() {
  try {
    const pid = Number(readFileSync(VERROU_VEILLEUR, "utf8").trim());
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function serveurRepond() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/health/live`, {
      signal: AbortSignal.timeout(4000),
    });
    return r.status === 200;
  } catch {
    return false;
  }
}

const branche = git("rev-parse", "--abbrev-ref", "HEAD");
const tete = git("rev-parse", "HEAD");
const sale = git("status", "--porcelain");
// `git fetch` peut échouer (réseau, jeton) : on le dit plutôt que de comparer
// avec une référence périmée, ce qui annoncerait « à jour » à tort.
const fetchOk = git("fetch", "--quiet", "origin", branche ?? "main") !== null;
const amont = git("rev-parse", `origin/${branche}`);
const retard = amont && tete ? git("rev-list", "--count", `${tete}..${amont}`) : null;
const avance = amont && tete ? git("rev-list", "--count", `${amont}..${tete}`) : null;
const bati = existsSync(TEMOIN_BATI) ? readFileSync(TEMOIN_BATI, "utf8").trim() : null;
const echecBati = existsSync(TEMOIN_ECHEC) ? readFileSync(TEMOIN_ECHEC, "utf8").trim() : null;
/** Une construction est-elle en cours, et par un banc encore vivant ? */
const constructionEnCours = (() => {
  try {
    const pid = Number(JSON.parse(readFileSync(TEMOIN_CONSTRUCTION, "utf8")).pid);
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0); // Ne tue rien : demande seulement s'il existe.
    return true;
  } catch {
    // Absent, illisible, ou banc mort : rien ne bâtit. Le pid est là pour ça —
    // un témoin resté d'un banc abattu ferait attendre l'impossible.
    return false;
  }
})();

/**
 * Ce que la ligne « Code SERVI » doit dire, et il y a TROIS cas.
 *
 * Le 16 août 2026, elle n'en disait qu'un : « aucune version bâtie — le banc
 * sert le mode développement ». Vrai dans les trois, et donc inutile dans les
 * trois : une construction en cours se traverse en deux minutes, une
 * construction échouée condamne le banc à compiler chaque écran à l'ouverture,
 * pour toujours. C'est la seconde qu'il a vécue en écrivant « l'appli est
 * vraiment très lente », et rien ne permettait de les distinguer.
 */
function ligneCodeServi() {
  if (bati) return court(bati);
  if (echecBati) {
    // **« et le restera » était vrai, et ne l'est plus — 20 août 2026.** Le
    // veilleur s'arrêtait après trois tentatives ; il continue désormais au
    // ralenti, une par demi-heure. Laisser la phrase d'avant ferait conclure
    // qu'il n'y a rien à attendre, et enverrait rallumer un espace qui est en
    // train de se réparer tout seul — une consigne qui accuse à tort coûte
    // plus cher que pas de consigne du tout (`CLAUDE.md` §5).
    //
    // **Et depuis le 29 août 2026, elle dit POURQUOI quand elle le sait.**
    // Cette ligne n'extrayait que la date, et jetait le code de sortie comme le
    // relevé mémoire — les deux seuls chiffres qui nomment le coupable. Son
    // écran affichait donc « la construction a échoué » sans jamais dire qu'il
    // s'agissait d'un manque de mémoire, alors que le renseignement était écrit
    // deux lignes plus bas dans le même fichier. Deux heures y sont passées.
    return phraseEchec(lireEchecConstruction(echecBati));
  }
  return "aucune version bâtie — construction en cours, ou pas encore lancée (le banc est lent en attendant)";
}
const derniereIssue = existsSync(FICHIER_ISSUE) ? readFileSync(FICHIER_ISSUE, "utf8").trim() : null;
const vivant = await serveurRepond();
/**
 * Quelqu'un tient-il le port sans répondre ?
 *
 * **« NE RÉPOND PAS » recouvrait deux états opposés — 2 septembre 2026.** Sa
 * fiche disait « Serveur : NE RÉPOND PAS », et cette phrase valait aussi bien
 * pour « plus rien n'écoute, le banc n'a jamais démarré » que pour « un
 * serveur tient le port et s'est enlisé ». Les deux n'appellent pas le même
 * geste, et le veilleur, lui, fait déjà cette distinction pour décider s'il
 * relance ou s'il déloge (`.devcontainer/veiller.sh`). La fiche ne la publiait
 * pas : on lisait donc « rien ne répond » sans pouvoir dire lequel des deux.
 *
 * C'est le même défaut que la ligne « Code SERVI » du 16 août, et il se répare
 * pareil : une phrase par état.
 *
 * Sondé seulement quand la santé ne répond pas — sur un serveur qui répond, la
 * réponse est connue d'avance et l'essai d'écoute ne servirait à rien.
 */
const portTenu = vivant ? true : !(await portLibre(PORT));

console.log("\n── Votre espace de travail ────────────────────────\n");
// **« HEAD » n'est pas un nom de branche, c'est l'aveu qu'il n'y en a pas.**
// Git le rend sur une tête détachée, et l'afficher tel quel demanderait au
// patron de connaître une notion qui ne le regarde pas. La mise à jour, elle,
// ne peut rien faire dans cet état : autant le dire dans ses mots.
const brancheLisible =
  branche === "HEAD" ? "AUCUNE (tête détachée — la mise à jour ne peut pas fonctionner)" : (branche ?? "inconnue (hors dépôt git ?)");
console.log(`  Branche suivie   : ${brancheLisible}`);
console.log(`  Code récupéré    : ${court(tete)}`);
console.log(`  Code SERVI       : ${ligneCodeServi()}`);
console.log(
  `  Serveur          : ${
    vivant
      ? `répond sur le port ${PORT}`
      : portTenu
        ? `TIENT LE PORT ${PORT} MAIS NE RÉPOND PAS`
        : `ABSENT — plus rien n'écoute sur le port ${PORT}`
  }`
);
console.log(`  Veilleur         : ${veilleurVivant() ? "en place" : "absent"}`);
// **Le port, et ce n'est pas un détail d'installation.** Un port privé fait
// répondre GitHub à la place d'Atlas : depuis un téléphone non connecté, on ne
// voit qu'une page de connexion, et rien ne dit pourquoi. Le patron l'a vécu le
// 10 août, puis le 21 — « elle ne se lance plus », sur un serveur pourtant
// debout.
const etatPort = existsSync(FICHIER_PORT) ? readFileSync(FICHIER_PORT, "utf8").trim() : null;
// **On MESURE, on ne suppose plus.** Jusqu'au 22 août 2026 cette ligne
// recopiait le mot rendu par `ouvrir-port.sh` et en concluait « PRIVÉ » dès
// qu'il n'avait pas pu régler le port. Elle a envoyé le patron faire trois
// clics sur un port DÉJÀ public — *« il est en public déjà »* — pendant que la
// vraie panne restait invisible. L'espace s'appelle désormais par son adresse
// publique, celle de son téléphone, et rapporte ce qui revient
// (`scripts/_verdict-port.mjs`).
const dehors = await regarderDuDehors();
// **Et la mesure locale entre dans le verdict — 31 août 2026.** Sans elle, un
// refus du relais était toujours mis sur le dos du port, y compris quand la
// ligne « Serveur » juste au-dessus disait que personne n'écoutait. La fiche se
// contredisait alors sur deux lignes voisines, et envoyait faire des clics qui
// ne pouvaient rien : un relais qui ne trouve personne derrière un port répond
// 502, qu'il soit public ou non.
const port = verdictPort({ etatPort, dehors, serveurLocal: vivant });
console.log(`  Port 3000        : ${port.ligne}`);
// **Les deux suspects d'une construction qui tombe sur une machine modeste.**
// Publiés à chaque fois, et pas seulement en cas d'échec : quand la fiche est
// enfin lue, la tentative est finie depuis longtemps et la mémoire est rendue.
console.log(`  Disque libre     : ${mesureSysteme("df", ["-h", "--output=avail,pcent", "."])}`);
console.log(`  Mémoire          : ${mesureSysteme("free", ["-h", "--si"])}`);
if (echecBati) {
  console.log("\n  Au moment de l'échec de construction :");
  for (const ligne of echecBati.split("\n")) console.log(`    ${ligne}`);
}
if (derniereIssue) console.log(`  Dernière m.à.j.  : ${derniereIssue}`);

console.log("\n── Ce qu'il faut en conclure ──────────────────────\n");

const soucis = [];

// **La lenteur passe AVANT le retard de version.** Un banc qui compile chaque
// écran à l'ouverture est inutilisable ; savoir qu'il a deux commits de retard
// ne sert alors à rien. Le 16 août 2026, la fiche annonçait le retard et taisait
// la lenteur — c'est l'inverse qu'il fallait lire.
if (echecBati) {
  soucis.push(
    "LA CONSTRUCTION A ÉCHOUÉ : le banc reste en mode développement, où chaque\n" +
      "     écran met jusqu'à une minute à s'ouvrir la PREMIÈRE fois. C'est la cause\n" +
      "     d'une application « très lente ». Le veilleur retente — trois fois de\n" +
      "     suite à dix minutes, puis une fois par demi-heure, indéfiniment : le\n" +
      "     banc peut donc redevenir rapide sans que personne y touche.\n" +
      "     Les relevés de disque et de mémoire ci-dessus sont pris à l'instant de\n" +
      "     l'échec : c'est là qu'il faut regarder pour savoir POURQUOI elle tombe.\n" +
      "     Rallumer l'espace reste le geste qui répare le plus vite."
  );
}

// **« AUCUNE VERSION BÂTIE » N'ENTRAIT DANS AUCUN VERDICT — 31 août 2026, au soir.**
//
// Sa plainte, une capture à l'appui : *« l'appli est lente »*. Sa fiche, fraîche
// de deux minutes, portait pourtant ces deux lignes ensemble :
//
//     Code SERVI : aucune version bâtie — construction en cours, ou pas encore lancée
//     ✅ Tout concorde : le code récupéré est le code servi, et il est à jour.
//
// La seconde est fausse, et elle est **pire que muette** : elle conclut « ce
// n'est pas votre espace — c'est le produit », c'est-à-dire qu'elle envoie
// chercher le défaut dans l'application alors que la cause est écrite trois
// lignes au-dessus. C'est la faute que ce dépôt paie le plus cher : un message
// qui désigne le mauvais coupable coûte davantage qu'un message absent.
//
// Des trois états de la ligne « Code SERVI » (voir `ligneCodeServi`), l'échec
// avait son verdict et la réussite aussi. **Celui du milieu — le seul qui
// explique une lenteur PASSAGÈRE — n'en avait aucun**, parce qu'il ne s'écrit
// pas comme une anomalie : c'est l'état normal des deux premières minutes.
// Normal ne veut pas dire silencieux, justement quand c'est la question posée.
if (!bati && !echecBati) {
  soucis.push(
    "AUCUNE VERSION RAPIDE N'EST ENCORE EN PLACE : le banc sert le mode\n" +
      "     développement, où chaque écran met jusqu'à une minute à s'ouvrir la\n" +
      "     PREMIÈRE fois. C'est la cause d'une application « lente » juste après un\n" +
      "     démarrage, et elle se dissipe seule : comptez deux à cinq minutes.\n" +
      "     Si cette ligne dit encore la même chose un quart d'heure plus tard, la\n" +
      "     construction n'aboutira pas — rallumez l'espace de travail."
  );
}

// Placé AVANT le retard de version, comme la lenteur : un port fermé rend
// l'application injoignable, et savoir qu'elle a deux commits de retard ne sert
// alors à rien.
if (port.souci) soucis.push(port.souci);

if (!fetchOk) {
  soucis.push(
    "Le dépôt distant n'a pas pu être joint : la comparaison ci-dessus peut être\n" +
      "     périmée. Vérifiez la connexion, puis relancez ce diagnostic."
  );
} else if (retard && Number(retard) > 0) {
  soucis.push(
    `Votre espace a ${retard} version(s) de retard sur « origin/${branche} ».\n` +
      `     ${sale ? "CAUSE PROBABLE : des fichiers modifiés empêchent la mise à jour (voir ci-dessous)." : "Relancez l'espace, ou touchez « Chercher les dernières corrections » dans Réglages."}`
  );
}

if (sale) {
  const lignes = sale.split("\n").slice(0, 6).join("\n       ");
  soucis.push(
    "Des modifications non enregistrées sont présentes. **La mise à jour les\n" +
      "     respecte et s'abstient** — elle refusera tant qu'elles sont là :\n" +
      `       ${lignes}`
  );
}

if (avance && Number(avance) > 0) {
  soucis.push(
    `Votre espace a ${avance} version(s) que le dépôt distant n'a pas. La mise à\n` +
      "     jour n'avance qu'en ligne droite et refusera : l'historique a divergé."
  );
}

// **Le cas qui a coûté la soirée du 11 août.** Le code est à jour, et pourtant
// l'écran ne change pas : la version bâtie est plus ancienne que le code
// récupéré. `next start` sert un dossier figé — recharger la page n'y peut rien.
if (bati && tete && bati !== tete) {
  // **Deux corrections du 2 septembre 2026, et chacune corrige une phrase FAUSSE.**
  //
  // 1. « Elle ne se recompile jamais » ne l'est plus depuis le 31 août :
  //    `banc.mjs` rebâtit dès que le commit bâti diffère du commit récupéré
  //    (`doitRebatir`), et le veilleur retente indéfiniment. C'est la même
  //    correction que `ligneCodeServi` a reçue le 20 août pour l'échec de
  //    construction, jamais reportée ici — si bien que la fiche se contredisait
  //    d'un point à l'autre, « le veilleur retente » plus haut et « jamais »
  //    ici. Elle envoyait rallumer un espace qui se réparait tout seul.
  //
  // 2. Ce verdict dit QUEL CODE, jamais si l'application tourne. Il affirmait
  //    « l'application est donc entière et rapide » — une promesse qu'il ne
  //    mesure pas, et qui a contredit la ligne « Serveur : NE RÉPOND PAS » de
  //    la même fiche, à trois lignes d'écart. Deux affirmations opposées dans
  //    un même écran, et c'est tout l'écran qu'on cesse de croire. Qui répond
  //    ou non est dit par la ligne « Serveur » et par son propre verdict, une
  //    seule fois.
  soucis.push(
    constructionEnCours || auDemarrage
      ? "Le code servi n'est pas encore le code récupéré : la version rapide NEUVE\n" +
        "     se construit, et c'est l'ANCIENNE qui doit servir pendant ce temps. La\n" +
        "     bascule se fait toute seule, comptez deux à cinq minutes.\n" +
        "     Ne rallumez pas : cela jetterait la construction."
      : "LE CODE SERVI N'EST PAS LE CODE RÉCUPÉRÉ, et aucune construction ne tourne\n" +
        "     en ce moment : recharger la page ne changera rien. Le veilleur en relance\n" +
        "     une toutes les demi-heures. Si cette ligne dit encore la même chose un\n" +
        "     quart d'heure plus tard, rallumez l'espace de travail."
  );
}

if (!vivant) {
  // **« Le veilleur devrait le relever dans quinze secondes » était une
  // promesse, et elle ne tient pas toujours — 2 septembre 2026.** Le veilleur
  // relance bien `npm run banc` toutes les quinze secondes ; mais un banc qui
  // BÂTIT tient le verrou, et celui qu'on relance refuse alors de démarrer
  // (`scripts/verrou-banc.mjs`, `scripts/banc.mjs`). Tant que la construction
  // dure, personne ne prendra le port — et la fiche annonçait le contraire.
  //
  // Un verdict qui promet un secours qui ne viendra pas fait attendre au lieu
  // de faire chercher : c'est la faute que ce dépôt paie le plus cher.
  if (!veilleurVivant()) {
    soucis.push(
      `Rien ne répond sur le port ${PORT}, et AUCUN VEILLEUR n'est en place :\n` +
        "     personne ne relèvera le serveur. Rallumez l'espace de travail."
    );
  } else if (portTenu) {
    soucis.push(
      `Un serveur TIENT le port ${PORT} sans répondre. Le veilleur lui laisse deux\n` +
        "     tours — une compilation lourde peut faire taire la santé un instant — puis\n" +
        "     le déloge et en relance un. Comptez une minute."
    );
  } else if (constructionEnCours) {
    soucis.push(
      `PLUS RIEN N'ÉCOUTE sur le port ${PORT} PENDANT UNE CONSTRUCTION, et le\n` +
        "     veilleur n'y peut rien : le banc qui bâtit tient le verrou, et tout banc\n" +
        "     relancé refuse de démarrer tant qu'il le tient. Personne ne servira avant\n" +
        "     la fin de la construction.\n" +
        "     C'est une PANNE, pas une attente : le banc doit servir la version rapide\n" +
        "     PRÉCÉDENTE pendant qu'il bâtit la neuve. Ce qui l'en a empêché est écrit\n" +
        "     dans /tmp/essai.log, et nulle part ailleurs."
    );
  } else {
    soucis.push(
      `Plus rien n'écoute sur le port ${PORT}. Le veilleur devrait relancer un banc\n` +
        "     dans quinze secondes."
    );
  }
}

if (soucis.length === 0) {
  console.log("  ✅ Tout concorde : le code récupéré est le code servi, et il est à jour.");
  console.log("     Si un écran ne ressemble toujours pas à ce qui a été annoncé,");
  console.log("     ce n'est pas votre espace — c'est le produit. Envoyez une capture.\n");
  process.exit(0);
}

for (const s of soucis) console.log(`  ⚠ ${s}\n`);
process.exit(1);
