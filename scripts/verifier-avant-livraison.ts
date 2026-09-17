import { rmSync } from "node:fs";
import path from "node:path";
import { empreinteDesSources, fichiersRemues } from "./_empreinte-des-sources.mjs";
import {
  phraseDuRefus,
  phraseDuVerdictCaduc,
  processusDeLaMachine,
  restesDeBatterie,
  saPropreLignee,
} from "./_batterie-solitaire";
import {
  prendreUnAtelierSync,
  baseDeLAtelier,
  redisDeLAtelier,
  suffixeDeLAtelier,
} from "./_atelier";
import { prendreLeVerrou } from "./verrou-batterie.mjs";
import { porteeDuLot, phraseDuRefusDePortee } from "./_portee-batterie";
import { lireDernierVerdict, ecrireDernierVerdict, ilYA } from "./_dernier-verdict";
import { jouerEnGardantLaSortie } from "./_jouer-etape";
import { bilanDuJournal } from "./_bilan-suites.mjs";
import { commitCourant } from "./_temoin-de-main.mjs";

// La batterie complète, à jouer AVANT de demander au patron d'essayer quoi que
// ce soit.
//
// Pourquoi elle existe : vingt échanges ont été consommés à lui faire essayer
// une application qui refusait sa connexion. Chaque fois, les voyants étaient
// verts — parce qu'aucun contrôle ne parcourait ce que lui parcourait. Le défaut
// n'était visible que derrière un autre nom de domaine, c'est-à-dire uniquement
// chez lui.
//
// Ce script rassemble donc tout ce qui existe, et surtout ce qui manquait : une
// connexion RÉELLE, dans un vrai navigateur, derrière une origine étrangère.
//
// L'ordre compte : les contrôles rapides d'abord, pour ne pas attendre dix
// minutes avant d'apprendre qu'une virgule manque.
//
// Il ne s'arrête PAS à la première erreur : savoir que trois choses cassent, et
// lesquelles, vaut mieux que de les découvrir une par une.


// **Les adresses et les rôles vivent dans `_bases-essai.ts`** depuis le
// 16 septembre 2026 : le niveau 2 en a besoin des mêmes, et deux copies de la
// même vérité finissent par diverger (`CLAUDE.md` §3).
import { basesDeLAtelier } from "./_bases-essai";
import { type Etape, etapesDeLaBatterie } from "./_etapes-batterie";




/**
 * **L'ATELIER DE CETTE BATTERIE — sa demande du 8 septembre 2026.**
 *
 * *« L'idée c'est qu'après ça chaque session puisse tourner en même temps sans
 * se gêner. »* Il fait tourner trois ou quatre sessions dans le même dossier,
 * et une seule pouvait mesurer : la batterie s'approprie le port 3000, la base
 * d'essai — qu'elle VIDE entre les suites — et le limiteur de connexion. Les
 * autres attendaient cinquante minutes, ou mesuraient des chiffres qui
 * n'accusent personne.
 *
 * Le rang se prend au premier port libre, sans que personne se coordonne, et il
 * dérive à lui seul le port, la base, le coin de Redis et les dossiers bâtis
 * (`scripts/_atelier.ts`). **Le rang 0 rend exactement la batterie d'avant** :
 * une session seule ne voit aucune différence, et aucun chiffre ne bouge.
 *
 * Aucune manip pour lui — sa condition du 5 septembre : la commande ne prend ni
 * variable ni option nouvelle.
 */
const ATELIER = prendreUnAtelierSync();
const SUFFIXE = suffixeDeLAtelier(ATELIER);
process.env.ATLAS_ADRESSE = ATELIER.adresse;
if (ATELIER.rang !== 0) {
  console.log(
    `Atelier n° ${ATELIER.rang} : port ${ATELIER.port}, base et Redis à part.`
  );
}

const { APP, OWNER, SUPER, REDIS } = basesDeLAtelier(ATELIER);

/** Le dossier bâti par l'étape « Construction », propre à cet atelier. */
const DIST_VERIFICATION = `.next-verification${SUFFIXE}`;


const ETAPES = etapesDeLaBatterie({ APP, OWNER, SUPER, REDIS, DIST_VERIFICATION });

const echecs: Etape[] = [];
/** Ce que chaque moteur de suites tombé a écrit — pour nommer ses rouges. */
const bilans = new Map<string, ReturnType<typeof bilanDuJournal>>();

/**
 * Le dossier de la construction, effacé AVANT de commencer.
 *
 * **Payé le 5 septembre 2026, et c'est la deuxième fois que ce piège se
 * referme.** L'étape « Types » passe la PREMIÈRE ; « Construction » écrit dans
 * `.next-verification`. À la batterie suivante, `tsc` relit donc le validateur
 * de routes laissé par la précédente — `tsconfig.json` l'inclut exprès — et
 * rend quatre erreurs (`Type 'Route' does not satisfy the constraint 'never'`)
 * sur du code que personne n'a touché.
 *
 * Le rouge accuse alors les types, c'est-à-dire le lot en cours, et il est
 * INSOLUBLE : rien dans `src/` ne le fait bouger. Une batterie qui ne peut pas
 * être verte s'apprend à être ignorée — la même phrase qu'au 4 septembre, pour
 * la même raison.
 *
 * On l'efface plutôt que de l'exclure de `tsconfig.json` : Next réécrit cette
 * liste tout seul (`test-tsconfig-sans-restes-dev.ts` le raconte), et une
 * exclusion qui se remet d'elle-même n'en est pas une. La construction le
 * recrée trois lignes plus bas.
 */
// ─── ELLE NE DÉMARRE PAS SI UNE AUTRE TOURNE — 8 septembre 2026 ─────────────
//
// **Une heure perdue devant le patron.** Une batterie arrêtée laisse ses
// enfants : `pkill` tue le père, jamais les suites qu'il avait lancées. Elles
// ont continué à VIDER LA BASE sous la batterie suivante, qui a rougi sur du
// code juste — la panne du 26 août, réécrite à l'identique.
//
// On refuse, on nomme, et on ne tue rien : ce qui tourne peut être la batterie
// d'une autre session, en train de mesurer pour de bon.
// **Sa lignée ENTIÈRE est écartée, pas seulement son père** : entre le terminal
// et le `node` qui exécute ceci, cinq processus portent le nom de ce script dans
// leur ligne de commande. S'en tenir au père faisait refuser toutes les
// batteries — trouvé en confrontant le garde-fou à une vraie, dans la minute.
const processus = processusDeLaMachine();
const restes = restesDeBatterie(processus, saPropreLignee(processus));
if (restes.length > 0) {
  console.error(phraseDuRefus(restes));
  process.exit(1);
}

// **Et elle emporte ses enfants quand on l'arrête** — c'est la racine du reste
// ci-dessus, pas seulement sa détection. Sans ces deux lignes, un `Ctrl-C` ou un
// `pkill` laisse le moteur des suites en vie, et la panne recommence.
const RACINE = path.join(__dirname, "..");
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.error(`\n\x1b[1m→ Arrêt demandé — on emporte les suites en cours.\x1b[0m`);
    // Le groupe entier, et non le seul processus courant : c'est ce qui manquait.
    try {
      process.kill(-process.pid, "SIGTERM");
    } catch {
      // Pas de groupe à soi (lancée sans `setsid`) : on part quand même, mais on
      // le DIT — sinon on croirait les enfants emportés alors qu'ils survivent.
      console.error("   ⚠️  Impossible d'emporter les suites : vérifiez avec `ps` avant d'en relancer une.");
    }
    process.exit(130);
  });
}

/**
 * ─── LE DOSSIER SE FERME PENDANT QU'ON MESURE — 9 septembre 2026 ───────────
 *
 * **Sa colère, et elle était méritée :** *« JE NE VEUX PLUS DE PROBLÈME SUR LA
 * BATTERIE. Quand une batterie tourne, personne n'y touche. »* Trois verdicts
 * de dix minutes jetés dans la même journée, tous pour la même raison.
 *
 * L'empreinte ci-dessous DIT que l'arbre a bougé ; le verrou EMPÊCHE qu'il
 * bouge. Les deux se complètent, et aucun ne remplace l'autre : un geste fait
 * hors de Claude — un enregistrement dans l'éditeur — échappe au verrou, et
 * c'est alors l'empreinte qui parle.
 */
/**
 * ─── ET AVANT TOUT : Y A-T-IL SEULEMENT QUELQUE CHOSE À MESURER ? ──────────
 *
 * **Sa question du 10 septembre 2026, à la fin d'une heure perdue :** *« mais
 * là tu faisais tourner une batterie pour pousser quoi ? »* Trois batteries de
 * vingt minutes avaient été rejouées **en entier** alors que, d'un tour à
 * l'autre, seuls deux ou trois `scripts/test-*.ts` avaient bougé.
 *
 * La règle existait — `CLAUDE.md` §6, un tableau à dérouler à la main. C'est
 * précisément ce que ce dépôt sait ne pas tenir : une consigne en prose se lit
 * au début d'une conversation et s'oublie au bout de trois heures, or c'est au
 * bout de trois heures qu'on relance une batterie de trop.
 *
 * Elle vit donc ici, en fonction pure éprouvable (`_portee-batterie.ts`), et
 * **le doute tranche toujours vers la batterie complète** : seuls « rien n'a
 * bougé » et « seules des suites ont bougé » sont refusés.
 */
const empreinteAvant = empreinteDesSources(RACINE);
const forcer = process.argv.includes("--forcer") || process.argv.includes("--complet");
const precedent = lireDernierVerdict(RACINE);

// Un verdict ROUGE ne retient jamais : sur un arbre inchangé, il accuse
// souvent la machine, et le rejouer est le seul moyen de le savoir.
//
// **Et un verdict de NIVEAU 2 ne retient pas non plus** — trouvé le
// 16 septembre 2026, en voulant éprouver un lot d'outillage. Le niveau 2 ne
// joue ni la construction, ni les cent cinquante suites navigateur, ni la
// connexion derrière un proxy : dire « rien n'a bougé depuis » après lui, c'est
// refuser la seule mesure qui manquait. Ce raccourci n'a de sens qu'entre deux
// batteries complètes.
const precedentComplet = precedent?.niveau === 3 ? precedent : null;
if (!forcer && precedentComplet?.vert) {
  const portee = porteeDuLot(fichiersRemues(precedentComplet.empreinte, empreinteAvant));
  if (portee.quoi !== "complete") {
    console.error(phraseDuRefusDePortee(portee, precedentComplet.verdict, ilYA(precedentComplet.quand)));
    process.exit(2);
  }
}

const verrou = prendreLeVerrou("npm run verifier:avant-livraison");
process.on("exit", verrou.rendre);

rmSync(DIST_VERIFICATION, { recursive: true, force: true });

async function jouerLaBatterie(): Promise<never> {
for (const etape of ETAPES) {
  // **Le verrou se signe ICI, entre deux étapes** — jamais par une minuterie.
  // Ce fil est bloqué par `spawnSync` du début à la fin : un `setInterval` n'y
  // partirait pas une seule fois, et c'est exactement ce qui a laissé une
  // session voisine écrire pendant la mesure du 9 septembre 2026.
  verrou.signer();
  console.log(`\n\x1b[1m→ ${etape.nom}\x1b[0m`);
  const env = { ...process.env, ...(etape.env ?? {}) };
  for (const cle of etape.envSupprime ?? []) delete env[cle];

  // **`shell` sous Windows, et rien d'autre — 2 septembre 2026.**
  //
  // Sur Windows, `npm` et `npx` sont des fichiers `.cmd` : `spawnSync` ne sait
  // pas les lancer sans passer par l'interpréteur, et rend ENOENT. La batterie
  // affichait alors **les neuf étapes en échec d'un coup, en une seconde**, y
  // compris « Types » et « Lint » qui passent quand on les joue à la main —
  // c'est-à-dire le pire des verdicts : faux, complet, et instantané.
  //
  // Le drapeau reste FAUX partout ailleurs. Sous shell, les arguments sont
  // ré-interprétés (guillemets, `&`, espaces) : l'activer sur Linux et en CI
  // changerait le comportement d'étapes qui marchent depuis des mois, pour
  // corriger un défaut qui ne s'y produit pas. Les arguments passés ici sont de
  // simples jetons sans espace — la condition tient tant que cela reste vrai.
  const r = await jouerEnGardantLaSortie(etape.commande, etape.args, {
    env,
    cwd: RACINE,
    shell: process.platform === "win32",
  });
  if (r.status === 0) {
    console.log(`   ✅ ${etape.nom}`);
  } else {
    console.error(`   ❌ ${etape.nom}`);
    echecs.push(etape);
    if (etape.suites) bilans.set(etape.nom, bilanDuJournal(r.sortie));
  }
}

console.log("\n─────────────────────────────────────────────────────────────");

// **Un vert rendu sur un arbre qui a bougé est pire qu'un rouge** : on livre en
// croyant avoir mesuré. Le dire avant le verdict, jamais après.
const remues = fichiersRemues(empreinteAvant, empreinteDesSources(RACINE));
if (remues.length > 0) {
  console.error(phraseDuVerdictCaduc(remues));
  console.error("─────────────────────────────────────────────────────────────");
  process.exit(1);
}

// **Le verdict se NOTE, sinon le refus du prochain tour n'a rien à comparer.**
// Écrit ici, après le contrôle d'empreinte : un verdict caduc n'est pas un
// verdict, et le retenir ferait refuser la batterie qui devait le remplacer.
//
// **Et il NOMME ses rouges — 16 septembre 2026.** « Deux étapes en échec » ne
// se compare à rien ; « ces onze suites » se compare à ce que `main` donnait
// déjà sur cette machine. Une étape tombée sans bilan qui tombe juste — types,
// construction, ou un moteur dont le compte ne correspond pas aux noms — va
// dans `rougesHorsSuites`, et une seule y suffit à fermer la fusion.
const rouges: string[] = [];
const rougesHorsSuites: string[] = [];
for (const e of echecs) {
  const bilan = e.suites ? bilans.get(e.nom) : null;
  if (e.suites && bilan && bilan.complet) rouges.push(...bilan.rouges);
  else rougesHorsSuites.push(e.suites ? `${e.nom} (bilan incomplet)` : e.nom);
}
const commit = commitCourant(RACINE) ?? undefined;
ecrireDernierVerdict(RACINE, {
  quand: Date.now(),
  vert: echecs.length === 0,
  verdict:
    echecs.length === 0
      ? "✅ Batterie complète au vert."
      : `❌ ${echecs.length} étape(s) en échec : ${echecs.map((e) => e.nom).join(", ")}`,
  empreinte: empreinteAvant,
  niveau: 3,
  rouges,
  rougesHorsSuites,
  commit,
});


if (echecs.length === 0) {
  console.log("✅ Batterie complète au vert.");
  console.log("   La connexion a été faite pour de vrai, dans un navigateur,");
  console.log("   derrière une origine étrangère. On peut livrer.");
  process.exit(0);
}

console.error(`❌ ${echecs.length} étape(s) en échec :\n`);
for (const e of echecs) {
  console.error(`   • ${e.nom}`);
  console.error(`     ce qu'elle attrape : ${e.ceQueCaAttrape}`);
}
console.error("\n   Ne rien donner au patron avant que tout soit vert.");
process.exit(1);
}

jouerLaBatterie().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
