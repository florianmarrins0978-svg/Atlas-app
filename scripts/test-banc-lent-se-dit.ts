import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **« L'appli est vraiment très lente, mais vraiment. »** — le patron, le
// 16 août 2026 au soir.
//
// Sa fiche disait, comme toujours : « aucune version bâtie — le banc sert le
// mode développement ». C'était vrai. C'était aussi inutile, parce que cette
// phrase recouvrait TROIS états qui n'appellent pas du tout la même chose :
//
//   1. la construction tourne encore    → il suffit d'attendre deux minutes ;
//   2. elle a ÉCHOUÉ                    → le banc compilera chaque écran à
//      l'ouverture, POUR TOUJOURS, et rien ne se réparera tout seul ;
//   3. elle n'a jamais été lancée       → il manque un démarrage.
//
// Seul le deuxième explique « très lente ». Le message d'échec existait
// pourtant — il partait dans `/tmp/essai.log`, que personne ne lit et auquel
// l'agent n'a pas accès. Une soirée est passée à chercher un défaut de produit
// devant une machine qui connaissait la réponse.
//
// Ce que cette suite tient :
//
//   1. les trois états rendent trois phrases DIFFÉRENTES ;
//   2. l'échec nomme la lenteur et dit qu'elle ne se corrige pas seule — un
//      diagnostic qui décrit sans conclure se relit sans agir ;
//   3. le relevé du disque et de la mémoire est publié, parce que ce sont les
//      deux suspects d'une construction qui tombe sur une petite machine ;
//   4. **un échec ne survit pas à une réussite** — sans quoi la fiche
//      accuserait éternellement une construction déjà réparée.

const DIAGNOSTIC = path.join(__dirname, "diagnostiquer-espace.mjs");

let echecs = 0;
function verifier(intitule: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${intitule}`);
  } catch (err) {
    echecs++;
    console.error(`❌ ${intitule}`);
    console.error(`   ${(err as Error).message}`);
  }
}

const dossier = mkdtempSync(path.join(tmpdir(), "atlas-lent-"));
const TEMOIN_ECHEC = path.join(dossier, "echec.txt");
// **Le témoin de version bâtie est détourné lui aussi, et il a fallu quatre
// rouges pour le comprendre.** La dernière étape de la batterie lance un vrai
// banc, qui bâtit et écrit `.next-batie/atlas-version-batie.txt` avec le commit
// courant. La suite lisait ce reste et voyait « Code SERVI : <commit> » là où
// elle attendait « en cours » — quatre cas rouges, aucun défaut de produit.
const TEMOIN_BATI = path.join(dossier, "version-batie.txt");
// Le veilleur de ces cas : un pid bien vivant — le nôtre.
const VERROU_VEILLEUR = path.join(dossier, "veilleur.pid");
writeFileSync(VERROU_VEILLEUR, `${process.pid}\n`);

/**
 * Joue le diagnostic et rend sa sortie.
 *
 * **Il sort en erreur dès qu'il a trouvé un souci — et c'est voulu.** Sur cette
 * machine il en trouve toujours (pas de serveur sur le port 3000). On lit donc
 * ce qu'il ÉCRIT, jamais son code de sortie : c'est son texte qui est le
 * produit, et c'est ce texte que l'agent lira sur la fiche.
 */
function diagnostiquer(enPlus: Record<string, string> = {}): string {
  try {
    return execFileSync("node", [DIAGNOSTIC], {
      encoding: "utf8",
      env: {
        ...process.env,
        ATLAS_TEMOIN_ECHEC: TEMOIN_ECHEC,
        ATLAS_TEMOIN_BATI: TEMOIN_BATI,
        // **Détourné vers un fichier qui n'existe pas, et c'est indispensable.**
        // Sans cela, une construction du banc RÉEL de cette machine ferait
        // basculer le diagnostic sur la branche « en cours » — et ces cas
        // passeraient au vert sans rien avoir éprouvé. Le même piège que le
        // témoin bâti, payé en quatre rouges le 17 août 2026.
        ATLAS_TEMOIN_CONSTRUCTION: path.join(dossier, "aucune-construction.json"),
        // Un veilleur en place, comme sur l'espace du patron — sinon tous les
        // verdicts retombent sur « aucun veilleur », et l'on n'éprouve plus
        // rien de ce qui les distingue. Détourné, jamais posé dans /tmp : il
        // écraserait l'état du veilleur réel de la machine qui joue la suite.
        ATLAS_VERROU_VEILLEUR: VERROU_VEILLEUR,
        // Le moment est celui d'un appel à la main, sauf quand un cas le dit.
        ATLAS_MOMENT: "main",
        ...enPlus,
      },
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    const sortie = (err as { stdout?: string }).stdout;
    assert.ok(sortie, "le diagnostic est mort sans rien écrire — il n'a plus aucune valeur");
    return sortie;
  }
}

function ligneCodeServi(sortie: string): string {
  const l = sortie.split("\n").find((x) => x.includes("Code SERVI"));
  assert.ok(l, "le diagnostic ne montre plus de ligne « Code SERVI »");
  return l;
}

// ── 1. Rien : ni version bâtie, ni échec ────────────────────────────────────
const sansRien = diagnostiquer();

verifier("sans version bâtie ni échec : on dit que c'est peut-être en cours", () => {
  const l = ligneCodeServi(sansRien);
  assert.match(l, /en cours, ou pas encore lanc/i);
  assert.doesNotMatch(l, /ÉCHOU/, "rien ne permet d'affirmer un échec à ce stade");
});

verifier("sans version bâtie : le VERDICT le dit, il ne conclut pas « tout concorde »", () => {
  // **Le trou du 31 août 2026, au soir.** La ligne « Code SERVI » disait bien
  // « aucune version bâtie » — mais aucun souci n'était poussé pour cet état,
  // si bien que la fiche du patron concluait « ✅ Tout concorde : le code
  // récupéré est le code servi », puis « ce n'est pas votre espace — c'est le
  // produit ». Elle envoyait donc chercher le défaut dans l'application au
  // moment précis où la cause était la construction en cours.
  //
  // On éprouve le VERDICT, pas la ligne d'état : c'est le verdict qui décide
  // d'où l'on va chercher.
  assert.match(
    sansRien,
    /AUCUNE VERSION RAPIDE N'EST ENCORE EN PLACE/,
    "l'état « en construction » doit devenir un souci nommé, sinon la fiche se tait dessus"
  );
  assert.doesNotMatch(
    sansRien,
    /Tout concorde/,
    "conclure « tout concorde » sans version bâtie accuse le produit à la place du banc"
  );
});

verifier("le disque et la mémoire sont publiés à chaque fois", () => {
  // Publiés TOUJOURS, et pas seulement en cas d'échec : quand la fiche est
  // enfin lue, la tentative est finie depuis longtemps et la mémoire est rendue.
  assert.match(sansRien, /Disque libre\s+:/);
  assert.match(sansRien, /Mémoire\s+:/);
});

// ── 2. La construction a échoué ─────────────────────────────────────────────
writeFileSync(
  TEMOIN_ECHEC,
  "quand: 2026-08-16T18:20:00.000Z\ncode: 1\ndisque: Avail | 0\nmemoire: Mem: 8G 7,9G 40M\n"
);
const apresEchec = diagnostiquer();

verifier("après un échec : la ligne le DIT, et dit que ça ne se répare pas seul", () => {
  const l = ligneCodeServi(apresEchec);
  assert.match(l, /ÉCHOU/);
  assert.match(l, /LENT/);
  assert.match(l, /2026-08-16T18:20/, "sans la date, on ne sait pas si l'échec est celui d'aujourd'hui");
});

verifier("l'échec devient un souci NOMMÉ, pas une ligne d'état de plus", () => {
  assert.match(apresEchec, /LA CONSTRUCTION A ÉCHOUÉ/);
  assert.match(apresEchec, /très lente/, "le diagnostic doit employer SES mots, sinon il ne se reconnaît pas dedans");
});

verifier("le relevé pris À L'INSTANT de l'échec est republié", () => {
  // Le disque au moment de la panne n'est pas celui d'une heure plus tard :
  // c'est précisément l'écart qui désigne le coupable.
  assert.match(apresEchec, /Au moment de l'échec de construction/);
  assert.match(apresEchec, /disque: Avail \| 0/);
});

verifier("les trois états rendent trois phrases différentes", () => {
  assert.notEqual(ligneCodeServi(sansRien), ligneCodeServi(apresEchec));
});

// ── 3. Une réussite efface l'échec ──────────────────────────────────────────
//
// Éprouvé sur `banc.mjs` lui-même plutôt que réécrit ici : deux implémentations
// de la même règle finissent toujours par diverger.
verifier("banc.mjs efface le témoin d'échec quand la construction réussit", () => {
  const source = execFileSync("node", ["-e", `process.stdout.write(require("fs").readFileSync(${JSON.stringify(path.join(__dirname, "banc.mjs"))}, "utf8"))`], { encoding: "utf8" });
  // **Bornée par un repère du code, pas par un nombre de caractères.** La
  // première version coupait à 600 caractères après `if (code === 0)` : un
  // commentaire ajouté au-dessus du `rmSync` l'a fait sortir du cadre, et la
  // suite a rougi sur du code parfaitement juste. Un contrôle qui dépend de la
  // longueur d'un commentaire ne défend rien (`CLAUDE.md` §5 bis).
  const debut = source.indexOf("if (code === 0)");
  const bloc = source.slice(debut, source.indexOf("Construction terminée", debut));
  assert.ok(bloc.length > 0 && bloc.length < 4000, "le repère de fin de bloc a bougé : ce contrôle ne vise plus rien");
  assert.match(
    bloc,
    /rmSync\(TEMOIN_ECHEC/,
    "une construction réussie doit retirer le témoin d'échec, sinon la fiche accuse à tort pour toujours"
  );
});

// ── 4. Le diagnostic ne tombe jamais ────────────────────────────────────────
verifier("un témoin illisible ne fait pas tomber le diagnostic", () => {
  // Un fichier tronqué, sans la ligne « quand » : le cas d'une machine tuée en
  // pleine écriture. Le diagnostic doit rester lisible — c'est sa seule raison
  // d'être.
  writeFileSync(TEMOIN_ECHEC, "code: 137");
  const sortie = diagnostiquer();
  assert.match(ligneCodeServi(sortie), /ÉCHOU/);
  assert.match(ligneCodeServi(sortie), /\(\?\)/, "une date absente se dit « ? », elle ne s'invente pas");
});

// ── 5. Le code bâti n'est pas le code récupéré ──────────────────────────────
//
// **Sa plainte du 2 septembre 2026 : « l'appli ne démarre pas, page blanche ».**
// Sa fiche, écrite à l'allumage, portait ces deux lignes à quatre lignes
// d'écart : en tête, « le serveur n'a pas encore eu le temps de démarrer » ;
// dans les verdicts, « la version rapide ne se recompile jamais — arrêtez puis
// rouvrez l'espace de travail ».
//
// Les deux sont incompatibles, et c'est la seconde qui commande un geste :
// rallumer à cet instant JETTE la construction que le veilleur allait lancer
// quinze secondes plus tard. Il rallume, retombe sur la même fiche, rallume.
//
// Et « jamais » était faux depuis le 31 août : `banc.mjs` rebâtit dès que le
// commit bâti diffère du commit récupéré, et le veilleur retente indéfiniment
// — ce que le verdict d'échec, dans la MÊME fiche, disait déjà.
rmSync(TEMOIN_ECHEC, { force: true });
writeFileSync(TEMOIN_BATI, "0000000000000000000000000000000000000000\n");

const aLAllumage = diagnostiquer({ ATLAS_MOMENT: "allumage" });

verifier("à l'allumage : la fiche n'envoie pas rallumer l'espace", () => {
  assert.match(
    aLAllumage,
    /Ne rallumez pas/,
    "à l'allumage, le banc n'a pas encore démarré : rallumer jette la construction qui allait partir"
  );
  assert.doesNotMatch(
    aLAllumage,
    /Arrêtez puis rouvrez l'espace/,
    "l'en-tête dit « le serveur n'a pas encore eu le temps de démarrer » : le verdict ne peut pas dire le contraire"
  );
});

const posee = diagnostiquer();

verifier("hors allumage : on ne dit plus que la version rapide ne se recompile jamais", () => {
  // Le veilleur relance une construction toutes les demi-heures. Écrire
  // « jamais » contredit le verdict d'échec de la même fiche, et fait rallumer
  // une machine qui se répare toute seule.
  assert.doesNotMatch(
    posee,
    /ne se recompile jamais/,
    "« jamais » est faux depuis le 31 août 2026 : le veilleur retente indéfiniment"
  );
  assert.match(posee, /LE CODE SERVI N'EST PAS LE CODE RÉCUPÉRÉ/);
  assert.match(posee, /demi-heures/, "sans dire ce qui va se passer tout seul, le verdict n'aide pas à décider d'attendre");
});

// ── 6. « NE RÉPOND PAS » recouvrait deux états opposés ──────────────────────
//
// **Le 2 septembre 2026, sa fiche disait, à trois lignes d'écart :**
//
//     Serveur : NE RÉPOND PAS sur le port 3000
//     ⚠ … l'application est donc entière et rapide …
//
// Les deux ne peuvent pas être vraies ensemble, et c'est la seconde qu'on lit —
// si bien qu'on cherche le défaut dans le produit alors que le banc ne sert
// rien du tout. Le verdict promettait en plus un relèvement « dans quinze
// secondes » que le verrou du banc empêche pendant une construction.
//
// Ce qui est tenu ici : la ligne dit LEQUEL des deux états, et le verdict ne
// promet pas un secours qui ne viendra pas.
const TEMOIN_CONSTRUCTION = path.join(dossier, "construction.json");
// Deux ports à personne, hors du 3000 du banc : ces cas ne doivent jamais
// mesurer le serveur réel de la machine qui les joue.
const PORT_DESERT = 59991;
const PORT_MUET = 59992;

verifier("plus rien n'écoute : la ligne le dit, et ne se contente pas de « ne répond pas »", () => {
  // Rien ne tient le port de cet essai : le diagnostic doit conclure « ABSENT »,
  // ce qui envoie chercher un banc qui n'a pas démarré — pas un serveur enlisé.
  const sortie = diagnostiquer({ PORT: String(PORT_DESERT) });
  const l = sortie.split("\n").find((x) => x.includes("Serveur")) ?? "";
  assert.match(l, /ABSENT/, "sans distinguer les deux états, on ne sait pas s'il faut attendre ou chercher");
});

verifier("un serveur qui tient le port sans répondre se dit AUTREMENT", () => {
  // Rien ne répond ici non plus — mais quelqu'un occupe le port, et le geste
  // n'est pas le même : le veilleur va le déloger, il n'y a rien à relancer.
  //
  // **Le port est tenu POUR DE VRAI**, par un processus à côté : une constante
  // recopiée ne prouverait rien de ce que le diagnostic mesure, et c'est
  // exactement le genre de contrôle qui reste vert sur un code cassé
  // (`CLAUDE.md` §5, « un contrôle qui mesure zéro ne mesure rien »).
  const muet = spawn(
    process.execPath,
    ["-e", `require("net").createServer().listen(${PORT_MUET}, "0.0.0.0"); setTimeout(() => {}, 60000);`],
    { stdio: "ignore" }
  );
  try {
    // Le temps que le port soit réellement pris : sonder trop tôt rendrait
    // « ABSENT » et ce cas passerait au vert sans rien avoir éprouvé.
    execFileSync(process.execPath, ["-e", `
      const net = require("net");
      const fin = Date.now() + 5000;
      (function essayer() {
        const c = net.connect(${PORT_MUET}, "127.0.0.1");
        c.on("connect", () => { c.destroy(); process.exit(0); });
        c.on("error", () => { c.destroy(); if (Date.now() > fin) process.exit(1); setTimeout(essayer, 50); });
      })();
    `]);
    const sortie = diagnostiquer({ PORT: String(PORT_MUET) });
    const l = sortie.split("\n").find((x) => x.includes("Serveur")) ?? "";
    assert.match(l, /TIENT LE PORT/, "un port occupé par un serveur muet n'est pas un serveur absent");
    assert.doesNotMatch(l, /ABSENT/);
    assert.match(sortie, /le déloge/, "le verdict doit dire ce que le veilleur va faire, pas seulement constater");
  } finally {
    muet.kill("SIGKILL");
  }
});

verifier("construction en cours et personne sur le port : on ne promet pas un secours impossible", () => {
  // Le veilleur relance bien un banc toutes les quinze secondes, mais un banc
  // qui bâtit tient le verrou et le suivant refuse de démarrer. Promettre
  // quinze secondes fait attendre au lieu de faire chercher.
  writeFileSync(TEMOIN_CONSTRUCTION, JSON.stringify({ pid: process.pid, depuis: new Date().toISOString() }));
  const sortie = diagnostiquer({ PORT: String(PORT_DESERT), ATLAS_TEMOIN_CONSTRUCTION: TEMOIN_CONSTRUCTION });
  assert.match(sortie, /PENDANT UNE CONSTRUCTION/, "l'état le plus bloquant du banc doit être nommé");
  // Le verdict est replié sur plusieurs lignes : on vise le membre de phrase,
  // pas la mise en page, qui bougera au premier reformatage.
  assert.match(sortie, /veilleur n'y peut rien/, "sans cela, on attend un relèvement qui ne viendra jamais");
  assert.doesNotMatch(
    sortie,
    /entière et rapide/,
    "affirmer que l'application tourne alors que rien n'écoute fait chercher le défaut dans le produit"
  );
});

rmSync(dossier, { recursive: true, force: true });
assert.ok(!existsSync(dossier));

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le banc lent se dit — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
