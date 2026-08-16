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

const DIST = ".next-batie";
const TEMOIN_BATI = `${DIST}/atlas-version-batie.txt`;
// Posé par `banc.mjs` quand `next build` tombe. Voir son en-tête : « aucune
// version bâtie » recouvrait trois états très différents, dont un seul est
// passager.
const TEMOIN_ECHEC =
  // Détournable uniquement pour l'éprouver : une suite ne peut pas écrire
  // dans /tmp sans marcher sur le banc réel de la machine qui la joue.
  process.env.ATLAS_TEMOIN_ECHEC || "/tmp/atlas-construction-echouee.txt";
const FICHIER_ISSUE = "/tmp/atlas-mise-a-jour.txt";
const VERROU_VEILLEUR = "/tmp/atlas-veilleur.pid";
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
    const quand = (echecBati.match(/^quand: (.+)$/m) ?? [])[1] ?? "?";
    return `AUCUNE — la construction a ÉCHOUÉ (${quand}). Le banc compile chaque écran à l'ouverture : il est LENT, et le restera.`;
  }
  return "aucune version bâtie — construction en cours, ou pas encore lancée (le banc est lent en attendant)";
}
const derniereIssue = existsSync(FICHIER_ISSUE) ? readFileSync(FICHIER_ISSUE, "utf8").trim() : null;
const vivant = await serveurRepond();

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
console.log(`  Serveur          : ${vivant ? `répond sur le port ${PORT}` : `NE RÉPOND PAS sur le port ${PORT}`}`);
console.log(`  Veilleur         : ${veilleurVivant() ? "en place" : "absent"}`);
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
      "     d'une application « très lente », et elle ne se corrige pas toute seule.\n" +
      "     Les relevés de disque et de mémoire ci-dessus sont pris à l'instant de\n" +
      "     l'échec : c'est là qu'il faut regarder en premier."
  );
}

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
  soucis.push(
    "LE CODE SERVI N'EST PAS LE CODE RÉCUPÉRÉ. La version rapide a été construite\n" +
      "     avant, et elle ne se recompile jamais : recharger la page ne changera rien.\n" +
      "     Arrêtez puis rouvrez l'espace de travail — il se reconstruit au démarrage."
  );
}

if (!vivant) {
  soucis.push(
    `Rien ne répond sur le port ${PORT}. ${veilleurVivant() ? "Le veilleur devrait le relever dans quinze secondes." : "Aucun veilleur : relancez l'espace de travail."}`
  );
}

if (soucis.length === 0) {
  console.log("  ✅ Tout concorde : le code récupéré est le code servi, et il est à jour.");
  console.log("     Si un écran ne ressemble toujours pas à ce qui a été annoncé,");
  console.log("     ce n'est pas votre espace — c'est le produit. Envoyez une capture.\n");
  process.exit(0);
}

for (const s of soucis) console.log(`  ⚠ ${s}\n`);
process.exit(1);
