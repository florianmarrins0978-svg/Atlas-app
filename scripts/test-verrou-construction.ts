import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  constructionsEnCours,
  delogerConstructionsOrphelines,
} from "./verrou-construction.mjs";

// **« L'appli est vraiment très lente, mais vraiment. »** — 16 août 2026.
//
// Son banc servait le mode développement, où chaque écran se compile à
// l'ouverture. La construction qui aurait dû le rendre rapide rendait :
//
//     ✕ Another next build process is already running.
//       - A previous build that didn't exit cleanly
//
// **Le piège, et il a coûté la soirée.** Cette seconde ligne fait croire à un
// fichier périmé qu'il suffirait d'effacer. C'est faux, et ç'a été ÉPROUVÉ : un
// fichier `lock` posé à la main n'empêche aucune construction — Next prend un
// verrou auprès du système, que le noyau relâche tout seul à la mort du
// processus. Le fichier qui reste n'est qu'une trace.
//
// Donc, quand ce message apparaît, **une construction tourne pour de bon**. Le
// remède « évident » — effacer le verrou — en lancerait une SECONDE à côté de
// la première, sur une machine qui n'arrive déjà pas à en finir une. C'est le
// remède qui tue, que ce dépôt a déjà payé deux fois (le second serveur du
// 9 août, le second banc du 10).
//
// **Et ce qui a vraiment manqué**, ce sont deux choses, toutes deux tenues ici :
//
//   1. le témoin d'échec ne portait pas CE QUE LA CONSTRUCTION AVAIT DIT — il
//      donnait l'heure, le code, le disque et la mémoire, si bien qu'on a
//      cherché une saturation pendant des heures alors que le message tenait en
//      une phrase ;
//   2. la batterie **ne bâtissait pas** : une panne qui n'existe qu'à la
//      construction traversait les cinquante-huit contrôles au vert, et c'est
//      le patron qui la découvrait, un soir, en cliquant.

const BANC = path.join(__dirname, "banc.mjs");
const BATTERIE = path.join(__dirname, "verifier-avant-livraison.ts");

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

const source = readFileSync(BANC, "utf8");

verifier("banc.mjs NE retire PAS le verrou de construction", () => {
  assert.doesNotMatch(
    source,
    /rmSync\([^)]*\/lock/,
    "banc.mjs efface un verrou de construction : cela autoriserait DEUX constructions en même temps, " +
      "sur une machine qui n'arrive déjà pas à en finir une"
  );
});

verifier("le raisonnement est écrit là où la tentation se présente", () => {
  // Sans ces lignes, la prochaine session relira le message de Next, conclura
  // « verrou périmé » et rétablira le défaut — le contre-sens est trop naturel
  // pour être écarté par le silence.
  assert.match(
    source,
    /Another next build process is already running/,
    "le message qui a coûté la soirée n'est plus cité : personne ne saura pourquoi on ne l'efface pas"
  );
});

verifier("le témoin d'échec porte CE QUE LA CONSTRUCTION A DIT", () => {
  assert.match(
    source,
    /jouerEnRetenant/,
    "la sortie de la construction n'est plus retenue : un échec redeviendra muet"
  );
  assert.match(
    source,
    /"dit:"/,
    "le témoin n'écrit pas ce que la construction a dit — c'est exactement ce qui manquait"
  );
});

verifier("la sortie reste VISIBLE en plus d'être retenue", () => {
  // Le patron doit voir sa construction avancer. Retenir sans afficher
  // transformerait deux à cinq minutes de progression en écran figé.
  const bloc = source.slice(source.indexOf("function jouerEnRetenant"));
  assert.match(bloc.slice(0, 1200), /process\.stdout\.write/, "la sortie n'est plus affichée");
});

verifier("la batterie BÂTIT — c'est ce qui manquait le 16 août", () => {
  const batterie = readFileSync(BATTERIE, "utf8");
  assert.match(
    batterie,
    /nom: "Construction"/,
    "la batterie ne bâtit pas : une erreur qui n'existe qu'à la construction passera au vert"
  );
  assert.match(
    batterie,
    /ATLAS_DIST_DIR/,
    "la construction de la batterie doit viser SON dossier, sinon elle écrase le .next d'un serveur qui tourne"
  );
});

// ── Le comportement réel de Next, pas l'idée qu'on s'en fait ────────────────
verifier("Next prend son verrou auprès du SYSTÈME, pas par un fichier témoin", () => {
  const lockfile = path.join(__dirname, "..", "node_modules", "next", "dist", "build", "lockfile.js");
  if (!existsSync(lockfile)) throw new Error("next introuvable — vérification impossible");
  const t = readFileSync(lockfile, "utf8");
  assert.match(
    t,
    /lockfileTryAcquireSync/,
    "Next ne prend plus un verrou système : le raisonnement ci-dessus est peut-être caduc, relire avant de conclure"
  );
  // C'est CETTE ligne qui prouve que le fichier restant n'est qu'une trace.
  assert.match(
    t,
    /unlocked lockfile \(which is not otherwise deleted on POSIX\)/,
    "la note de Next sur le fichier laissé derrière a disparu : revérifier qu'un lock résiduel ne bloque rien"
  );
});

// ── Le mécanisme réel de la panne, et le seul contrôle qui l'aurait vue ──────
//
// `demarrer.sh` pose un veilleur AVANT la mise à jour — délibérément, pour que
// le patron ait une application qui répond quoi qu'il arrive ensuite. Ce
// premier veilleur lance un banc, qui lance une construction. La mise à jour
// aboutit, on tue veilleur et serveur pour les remplacer par leurs versions
// neuves — et la CONSTRUCTION survivait au motif, qui ne connaissait que
// `next-server`, `next dev` et `next start`.
//
// Orpheline, elle gardait le verrou du système. Le banc suivant tombait dessus,
// rendait 1, et le repli laissait le banc en mode développement. À CHAQUE
// allumage qui récupère du code — d'où trois redémarrages sans effet.
verifier("le motif de démarrage attrape « next build », pas seulement les serveurs", () => {
  const demarrer = readFileSync(path.join(__dirname, "..", ".devcontainer", "demarrer.sh"), "utf8");
  const motifs = [...demarrer.matchAll(/pkill -f "(\[n\]ext\([^"]*\))"/g)].map((m) => m[1]);
  assert.ok(motifs.length >= 2, `attendu au moins deux pkill de processus next, trouvé ${motifs.length}`);
  for (const motif of motifs) {
    // Le vrai motif, joué sur les vraies lignes de commande — pas relu.
    const regle = new RegExp(motif.replace("[n]", "n"));
    assert.ok(
      regle.test("next build"),
      `le motif « ${motif} » laisse survivre « next build » : la construction suivante tombera sur « already running »`
    );
    // Et il doit continuer d'attraper ce pour quoi il existait.
    for (const vivant of ["next-server (v16.2.12)", "next dev -H 0.0.0.0 -p 3000", "next start"]) {
      assert.ok(regle.test(vivant), `le motif « ${motif} » n'attrape plus « ${vivant} »`);
    }
  }
});

// ── Le piège des dossiers bâtis, tombé TROIS fois ───────────────────────────
//
// Chaque dossier de construction doit être écarté du lint. `.next-batie` l'a
// appris en 1 271 erreurs, `.next-banc-essai` en 1 116, et le dossier de la
// batterie en 1 478 — le jour même où il a été ajouté. Le lint ne les voit
// qu'APRÈS un premier passage, si bien que le contrôle passe au vert chez celui
// qui l'écrit et noie celui qui le rejoue.
verifier("le dossier bâti par la batterie est écarté du lint", () => {
  const batterie = readFileSync(BATTERIE, "utf8");
  const dossiers = [...batterie.matchAll(/ATLAS_DIST_DIR:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(dossiers.length > 0, "la batterie ne déclare plus de dossier de construction");
  const eslint = readFileSync(path.join(__dirname, "..", "eslint.config.mjs"), "utf8");
  for (const dossier of dossiers) {
    assert.ok(
      eslint.includes(`"${dossier}/**"`),
      `« ${dossier} » n'est pas écarté dans eslint.config.mjs : le lint de la batterie suivante ` +
        "sera noyé sous du code généré, et un contrôle noyé ne se lit plus"
    );
  }
});

// ── L'ORPHELINE, et c'est la panne du 17 août au soir ───────────────────────
//
// *« Même problème qu'hier, l'appli est super lente. »* Sa fiche portait le même
// refus que la veille — mais pas la même cause : le correctif du 16 tue les
// constructions **au démarrage**, et celle-là est née bien après. Son espace n'a
// que 8 Go ; le noyau tue un processus quand la mémoire manque, le banc part, et
// SA construction lui survit. Le veilleur en relance un, qui tombe sur le verrou
// de l'orpheline, et le banc reste lent pour la soirée.
//
// **Ces deux cas tuent un vrai processus, et échouent si on ne le tue pas.**
// Le motif d'essai est distinctif : rien ici ne peut toucher une construction
// réelle qui tournerait à côté.
const MOTIF_ESSAI = "next build --epreuve-du-verrou";

async function verifierAsync(intitule: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${intitule}`);
  } catch (err) {
    echecs++;
    console.error(`❌ ${intitule}`);
    console.error(`   ${(err as Error).message}`);
  }
}

/** Un faux « next build » qui ne fait rien d'autre que vivre. */
function fausseConstruction() {
  const p = spawn(
    process.execPath,
    ["-e", "setTimeout(() => {}, 60000)", "next", "build", "--epreuve-du-verrou"],
    { stdio: "ignore" }
  );
  return p;
}

const vivant = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Les suites de ce dépôt sont jouées en CommonJS : pas d'`await` au premier
// niveau. Les deux cas qui tuent un vrai processus vivent donc dans une
// fonction, appelée tout en bas.
async function casQuiTuentUnVraiProcessus() {
await verifierAsync("une construction orpheline est VUE, puis délogée", async () => {
  const faux = fausseConstruction();
  const pidFaux = faux.pid;
  assert.ok(pidFaux, "le faux processus n'a pas démarré : rien à éprouver");
  await new Promise((r) => setTimeout(r, 500));
  try {
    const vues = constructionsEnCours({ motif: MOTIF_ESSAI });
    assert.ok(
      vues.some((v) => v.pid === pidFaux),
      `la construction en cours (pid ${pidFaux}) n'est pas vue : le banc bâtirait par-dessus et Next refuserait`
    );

    const bilan = await delogerConstructionsOrphelines({ motif: MOTIF_ESSAI, patienceMs: 5000 });
    assert.ok(bilan.delogees >= 1, "aucune construction délogée");
    assert.equal(bilan.restantes, 0, "une construction survit au délogement : le verrou reste tenu");
    assert.equal(
      vivant(pidFaux),
      false,
      "la construction orpheline est toujours vivante — le banc retomberait sur son verrou, et resterait lent"
    );
  } finally {
    try {
      faux.kill("SIGKILL");
    } catch {
      // Déjà mort : c'est précisément ce que le cas vérifie.
    }
  }
});

await verifierAsync("sans orpheline, on ne déloge rien et on ne se tue pas soi-même", async () => {
  const bilan = await delogerConstructionsOrphelines({ motif: MOTIF_ESSAI, patienceMs: 1000 });
  assert.deepEqual(bilan, { delogees: 0, restantes: 0 });
  // Le contrôle qui court après lui-même : `constructionsEnCours` ne doit
  // jamais rendre notre propre processus, sans quoi le banc se tuerait en
  // voulant déloger.
  assert.equal(
    constructionsEnCours({ motif: "node" }).some((v) => v.pid === process.pid),
    false,
    "la recherche rend notre propre processus : le banc se tuerait lui-même avant de bâtir"
  );
});

}

verifier("banc.mjs déloge l'orpheline AVANT de bâtir", () => {
  const iDelogement = source.indexOf("delogerConstructionsOrphelines");
  const iConstruction = source.indexOf('jouerEnRetenant("npx", ["next", "build"]');
  assert.ok(iDelogement > 0, "banc.mjs ne déloge aucune construction orpheline");
  assert.ok(
    iDelogement < iConstruction,
    "le délogement arrive APRÈS le lancement de la construction : il ne protège alors de rien"
  );
});

verifier("banc.mjs réessaie UNE fois quand c'est le verrou qui a parlé", () => {
  assert.match(
    source,
    /Another next build process is already running/,
    "banc.mjs ne reconnaît pas le refus du verrou : une construction née dans l'intervalle laisserait le banc lent " +
      "jusqu'au prochain allumage"
  );
});

casQuiTuentUnVraiProcessus().then(() => {
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le verrou de construction — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
});
