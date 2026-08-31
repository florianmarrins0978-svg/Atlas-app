import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **« L'appli ne se lance plus » — sa nuit du 30 au 31 août 2026, 1 h 07.**
//
// Son espace tournait. Atlas répondait sur 127.0.0.1:3000. La version rapide
// était bâtie sur le dernier commit. Et son adresse publique rendait un 404 du
// relais : depuis son téléphone, il n'y avait rien.
//
// **Ce qui l'a laissé passer :** `veiller.sh` posait `PORT_OUVERT=oui` dès que
// `gh` avait répondu « ouvert », et n'y revenait plus de la session. Ce mot ne
// dit pas que le port est joignable — il dit qu'une commande a réussi, à un
// instant. Le relais peut perdre le port ensuite ; le verrou tenait quand même,
// toute la nuit.
//
// `test-ouvrir-port.ts` lit le texte de `veiller.sh` ; cette suite-ci le FAIT
// TOURNER, parce qu'une condition de bash ne se prouve pas en la lisant. Elle
// sait échouer : contre la version d'avant, aucun « n'est plus joignable »
// n'apparaît au journal, le verrou n'étant jamais défait.

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

const dossier = mkdtempSync(path.join(tmpdir(), "atlas-port-"));
const JOURNAL = path.join(dossier, "journal.log");
// **Un port LIBRE, choisi à l'instant — jamais un numéro écrit en dur.** Une
// première version prenait 59431 : deux exécutions simultanées (une batterie qui
// tourne, un essai à la main) se le disputaient, le second serveur ne démarrait
// pas, et la suite rougissait sur un correctif juste. Un rouge au hasard
// s'apprend à être ignoré.
const PORT = Number(
  execFileSync(process.execPath, [
    "-e",
    "const s=require('net').createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})",
  ])
    .toString()
    .trim()
);

// **Un serveur qui RÉPOND, et c'est la condition du cas.** Le veilleur ne
// mesure le dehors que lorsque le dedans va bien : une adresse publique muette
// pendant que rien n'écoute n'apprendrait rien sur le port.
//
// **Dans un AUTRE processus, et ce n'est pas un détail de confort.** Une
// première version l'ouvrait ici même : la suite attend ensuite en dormant, ce
// qui bloque la boucle d'événements — le serveur ne répondait donc à rien, le
// veilleur le croyait mort et partait le relancer. Le montage rendait deux
// rouges sur un correctif juste.
const sante = spawn(
  process.execPath,
  ["-e", `require("http").createServer((q, r) => r.writeHead(200).end("ok")).listen(${PORT})`],
  { stdio: "ignore" }
);

mkdirSync(path.join(dossier, "scripts"), { recursive: true });
mkdirSync(path.join(dossier, ".devcontainer"), { recursive: true });
// La sonde du dehors, remplacée par un refus MESURÉ : c'est l'état de sa nuit —
// le serveur répond, le relais ne le sert pas.
writeFileSync(path.join(dossier, "scripts", "port-joignable.mjs"), "process.exit(1);\n");
writeFileSync(path.join(dossier, ".devcontainer", "bascule-en-cours.sh"), "exit 1\n");
writeFileSync(path.join(dossier, "package.json"), JSON.stringify({ name: "faux-banc", scripts: { banc: "sleep 3600" } }));

// **Le veilleur est joué depuis une COPIE**, pour que `dirname "$0"` désigne le
// faux `ouvrir-port.sh` plutôt que le vrai : sans cela, la suite appellerait
// `gh` sur la machine qui la joue.
const veilleurCopie = path.join(dossier, ".devcontainer", "veiller.sh");
copyFileSync(VEILLEUR, veilleurCopie);
// **`ouvert`, et c'est tout le sujet.** C'est le mot que son espace a reçu la
// nuit du 31 août : `gh` a bien réglé le port, et le relais ne servait pourtant
// rien. Un `hors-codespace` ne conviendrait pas — il ne se retente jamais, à
// dessein.
writeFileSync(path.join(dossier, ".devcontainer", "ouvrir-port.sh"), "echo ouvert\n");

// **On attend que la santé réponde AVANT de lancer le veilleur.** Sans cette
// attente, son premier tour tombe sur un port encore muet : il conclut « serveur
// mort », part dans `npm run banc` — un faux `sleep 3600` — et ne revient jamais
// mesurer quoi que ce soit. La suite rougissait alors sur un correctif juste.
const debut = Date.now();
let debout = false;
while (!debout && Date.now() - debut < 10_000) {
  try {
    execFileSync("curl", ["-fsS", "-o", "/dev/null", "--max-time", "1", `http://127.0.0.1:${PORT}/api/health/live`], {
      stdio: "ignore",
    });
    debout = true;
  } catch {
    execFileSync("sleep", ["0.2"]);
  }
}

const veilleur = spawn("bash", [veilleurCopie, dossier], {
  env: {
    ...process.env,
    PORT: String(PORT),
    JOURNAL,
    ATLAS_INTERVALLE_VEILLE: "1",
    ATLAS_INTERVALLE_CONTROLE_PORT: "1",
    // La fiche ne doit pas partir d'ici : ce dépôt factice n'a pas de quoi la
    // publier, et une suite n'écrit jamais dans la fiche du patron.
    ATLAS_INTERVALLE_RAPPORT: "3600",
    // **Le verrou et l'état du port vivent DANS le dossier d'essai.** Sans ces
    // deux portes, cette suite écraserait ceux du banc réel de la machine qui la
    // joue : sa fiche annoncerait un veilleur absent, ou un port qu'elle n'a pas
    // mesuré. Et deux exécutions d'affilée se bloqueraient l'une l'autre sur le
    // verrou partagé — c'est ce qui a rendu cette suite intermittente avant
    // qu'elles existent.
    ATLAS_VERROU_VEILLEUR: path.join(dossier, "veilleur.pid"),
    ATLAS_FICHIER_PORT: path.join(dossier, "port.txt"),
  },
  detached: true,
  stdio: "ignore",
});

const dormir = (ms: number) => execFileSync("sleep", [String(ms / 1000)]);
const journal = () => (existsSync(JOURNAL) ? readFileSync(JOURNAL, "utf8") : "");

// On sort dès que c'est vu : l'échéance n'est là que pour ne pas attendre sans
// fin (`test-fiche-pendant-relance.ts`, même raison).
const ECHEANCE = Date.now() + 30_000;
while (!/n'est plus joignable/.test(journal()) && Date.now() < ECHEANCE) dormir(500);

verifier("un port perdu en cours de session est REMARQUÉ, et redemandé", () => {
  assert.match(
    journal(),
    /n'est plus joignable de l'extérieur/,
    "le veilleur n'a jamais défait son verrou : c'est la nuit du 31 août, où son espace " +
      "tournait, Atlas répondait, et le relais ne servait rien"
  );
});

verifier("il redemande vraiment l'ouverture, il ne se contente pas de le dire", () => {
  assert.match(
    journal(),
    /ouvert au public|pas encore public/,
    "aucune nouvelle demande d'ouverture après la mesure : le port resterait perdu"
  );
});

try {
  process.kill(-veilleur.pid!, "SIGTERM");
} catch {
  /* déjà mort : rien à faire */
}
sante.kill();
rmSync(dossier, { recursive: true, force: true });

console.log(`\n${echecs === 0 ? "✅" : "❌"} La remesure du port — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
