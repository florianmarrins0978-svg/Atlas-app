import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **La fiche se figeait à l'instant précis où elle devenait utile.**
//
// Le 16 août 2026 le patron écrit « je n'arrive plus à ouvrir l'application ».
// Sa fiche datait de vingt-sept minutes et annonçait un serveur muet. Or la
// fiche porte sa propre règle de lecture — « passé vingt minutes sans
// réécriture, l'espace est arrêté » — - qui envoyait donc rallumer une machine
// dont rien ne prouvait qu'elle dormait.
//
// La cause était dans `veiller.sh` : la publication vivait au bas de la boucle
// de surveillance, et cette boucle s'arrête d'avancer dès qu'elle appelle
// `npm run banc` — un appel qui ne rend la main qu'à la mort du serveur
// suivant. Autrement dit : **le veilleur cessait de publier au moment même où
// il se mettait au travail.**
//
// Ce que cette suite tient, et qui manquait :
//
//   1. la fiche continue d'être publiée PENDANT que le veilleur est bloqué à
//      relancer un serveur — le cas réel, jamais éprouvé ;
//   2. le publieur ne survit pas au veilleur, sans quoi un veilleur relancé en
//      laisserait deux et la fiche serait réécrite deux fois par quart d'heure.
//
// Elle sait échouer : jouée contre la version d'avant (publication dans la
// boucle), le contrôle 1 ne voit aucune publication et rougit.

const VEILLEUR = path.join(__dirname, "..", ".devcontainer", "veiller.sh");

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

const dossier = mkdtempSync(path.join(tmpdir(), "atlas-fiche-"));

// Un faux dépôt : le veilleur n'y trouvera ni serveur ni vraie publication.
// `scripts/rapporter-espace.mjs` est remplacé par un mouchard qui compte ses
// passages — on éprouve le CADENCEMENT, pas le contenu de la fiche, que
// `test-rapport-espace.ts` tient déjà.
const TEMOIN = path.join(dossier, "publications.txt");
mkdirSync(path.join(dossier, "scripts"), { recursive: true });
mkdirSync(path.join(dossier, ".devcontainer"), { recursive: true });
writeFileSync(
  path.join(dossier, "scripts", "rapporter-espace.mjs"),
  `import { appendFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(TEMOIN)}, "une\\n");\n`
);

// **`npm run banc` qui ne rend jamais la main — c'est tout le sujet.** Sans
// cette fausse commande, la boucle continuerait de tourner et le défaut
// resterait invisible, exactement comme il l'est resté quatre jours.
writeFileSync(
  path.join(dossier, "package.json"),
  JSON.stringify({ name: "faux-banc", scripts: { banc: "sleep 3600" } })
);

// Le drapeau de bascule doit répondre « non » pour que la boucle avance.
writeFileSync(path.join(dossier, ".devcontainer", "bascule-en-cours.sh"), "exit 1\n");

const veilleur = spawn("bash", [VEILLEUR, dossier], {
  env: {
    ...process.env,
    // Un port où personne n'écoute : le veilleur conclut « serveur mort » et
    // part se bloquer dans `npm run banc`.
    PORT: "59999",
    JOURNAL: path.join(dossier, "journal.log"),
    ATLAS_INTERVALLE_RAPPORT: "2",
    // ═══════════════════════════════════════════════════════════════════════
    // **UN MOTIF QUI NE PEUT DÉSIGNER QUE CE MONTAGE — 31 août 2026.**
    //
    // Le veilleur cherche « un serveur Next » avec `pgrep -f`, qui regarde
    // TOUTE la machine. Le serveur de la batterie répond au motif par défaut,
    // à quelques centimètres d'ici : le veilleur d'essai concluait alors « un
    // serveur tient le port sans répondre » au lieu de « plus rien n'écoute »,
    // cette suite rougissait sur un montage sain — et deux tours plus tard il
    // faisait `pkill` sur ce motif, **tuant le serveur de la batterie**. Des
    // suites navigateur tombaient ailleurs, sur des « waitForURL » qui
    // n'accusaient personne.
    //
    // Un contrôle ne doit ni accuser à tort, ni abîmer la course dont il fait
    // partie. Le motif est donc unique à ce processus.
    // ═══════════════════════════════════════════════════════════════════════
    ATLAS_MOTIF_SERVEUR: `[a]ucun-serveur-de-cet-essai-${process.pid}`,
  },
  detached: true,
  stdio: "ignore",
});

function dormir(ms: number) {
  execFileSync("sleep", [String(ms / 1000)]);
}

function publications(): number {
  if (!existsSync(TEMOIN)) return 0;
  return readFileSync(TEMOIN, "utf8").trim().split("\n").filter(Boolean).length;
}

// **Attendre la condition, pas une durée.** Une suite qui dort sept secondes
// passe au calme et tombe en fin de batterie, quand la machine sature — c'est
// le défaut relevé le même jour sur deux suites navigateur (`TODO.md`
// 0 quatervicies). On sort dès que c'est vu, et l'échéance n'est là que pour
// ne pas attendre indéfiniment.
const ECHEANCE = Date.now() + 40_000;
while (publications() < 2 && Date.now() < ECHEANCE) dormir(500);

verifier("la fiche est publiée PENDANT que le veilleur relance le serveur", () => {
  assert.ok(
    publications() > 0,
    "aucune publication : le veilleur, bloqué dans « npm run banc », a cessé de publier — c'est le défaut du 16 août"
  );
  assert.ok(
    publications() >= 2,
    `une seule publication au plus (${publications()}) : la cadence ne survit pas à la relance`
  );
});

verifier("le veilleur est bien bloqué à relancer — sans quoi la suite ne prouve rien", () => {
  const journal = path.join(dossier, "journal.log");
  const texte = existsSync(journal) ? readFileSync(journal, "utf8") : "";
  assert.match(
    texte,
    /plus rien n'écoute sur le port/,
    "le veilleur n'a jamais tenté de relance : le montage ne reproduit pas le cas réel"
  );
});

// **Le publieur ne doit pas survivre au veilleur.** Deux publieurs réécriraient
// la fiche deux fois par quart d'heure, et personne ne comprendrait pourquoi.
try {
  process.kill(-veilleur.pid!, "SIGKILL");
} catch {
  /* déjà mort */
}
dormir(5000);
const avant = existsSync(TEMOIN) ? readFileSync(TEMOIN, "utf8").length : 0;
dormir(5000);

verifier("le publieur s'arrête avec le veilleur", () => {
  const apres = existsSync(TEMOIN) ? readFileSync(TEMOIN, "utf8").length : 0;
  assert.equal(
    apres,
    avant,
    "la fiche continue d'être publiée alors que le veilleur est mort : un veilleur relancé en laisserait deux"
  );
});

rmSync(dossier, { recursive: true, force: true });

console.log(`\n${echecs === 0 ? "✅" : "❌"} La fiche pendant une relance — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
