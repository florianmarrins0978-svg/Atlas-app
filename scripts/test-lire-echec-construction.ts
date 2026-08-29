import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// **Sa soirée du 29 août 2026, et le contrôle qui l'empêche de revenir.**
//
// Son écran disait, en rouge : « La dernière construction a échoué ; elle est
// retentée toute seule, mais cela peut prendre une demi-heure. » Vrai, et
// inutile : rien ne disait POURQUOI. La cause était un manque de mémoire, et le
// relevé était déjà écrit dans le témoin, deux lignes sous la date qu'on lisait.
//
// Deux heures ont été passées à chercher un défaut de construction inexistant —
// vérifié depuis sur son commit exact avec ses variables : elle compile en
// 30,6 s.
//
// **Et le témoin mentait à moitié**, ce que cette suite tient d'abord : Node
// passe `code = null` quand un enfant est abattu par un signal, et `banc.mjs`
// repliait ce `null` sur `1`. Une construction tuée faute de mémoire portait
// donc `code: 1`, exactement comme une erreur de compilation.

import { lireEchecConstruction, phraseEchec } from "./lire-echec-construction.mjs";

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

/** Le témoin tel que `banc.mjs` l'écrit depuis le 29 août 2026. */
const TEMOIN_ABATTU = [
  "quand: 2026-08-29T20:41:02.113Z",
  "code: 1",
  "signal: SIGKILL",
  "disque: Avail | 21G",
  "memoire: total used free | Mem: 8.3G 7.9G 96M",
  "dit:",
  "Creating an optimized production build ...",
].join("\n");

/** Une vraie erreur de compilation : même `code`, pas de signal. */
const TEMOIN_COMPILATION = [
  "quand: 2026-08-29T20:41:02.113Z",
  "code: 1",
  "signal: aucun",
  "disque: Avail | 21G",
  "memoire: total used free | Mem: 8.3G 2.1G 5.9G",
  "dit:",
  "Type error: Property 'libelle' does not exist.",
].join("\n");

// --- 1. Les deux cas opposés ne se confondent plus -----------------------

verifier("une construction ABATTUE est reconnue comme telle", () => {
  const e = lireEchecConstruction(TEMOIN_ABATTU);
  assert.equal(e.echoue, true);
  assert.match(e.cause ?? "", /mémoire/, "le manque de mémoire doit être nommé");
});

verifier("une ERREUR DE COMPILATION n'est pas accusée d'être un manque de mémoire", () => {
  const e = lireEchecConstruction(TEMOIN_COMPILATION);
  assert.equal(e.echoue, true);
  assert.equal(
    e.cause,
    null,
    "sans signal, on ne sait pas — et une cause inventée envoie chercher au mauvais endroit"
  );
});

verifier("les deux témoins portent le MÊME code : c'est le signal qui les sépare", () => {
  // Le cœur du défaut, tenu explicitement : si un jour quelqu'un décidait de
  // trancher sur le code de sortie, ce cas rougirait.
  assert.match(TEMOIN_ABATTU, /^code: 1$/m);
  assert.match(TEMOIN_COMPILATION, /^code: 1$/m);
  assert.notEqual(
    lireEchecConstruction(TEMOIN_ABATTU).cause,
    lireEchecConstruction(TEMOIN_COMPILATION).cause,
    "deux causes opposées rendues identiques : c'est exactement le défaut du 29 août"
  );
});

// --- 2. Les témoins d'AVANT restent lisibles -----------------------------

verifier("un témoin d'avant le correctif (sans ligne signal) ne casse pas", () => {
  const ancien = "quand: 2026-08-20T10:00:00.000Z\ncode: 1\ndit:\nquelque chose";
  const e = lireEchecConstruction(ancien);
  assert.equal(e.echoue, true);
  assert.equal(e.quand, "2026-08-20T10:00:00.000Z");
  assert.equal(e.cause, null, "sans signal ni 137, on ne conclut pas");
});

verifier("un abattage traduit en code 137 est rattrapé", () => {
  // Tué à travers un shell, ou par un banc antérieur : 128 + 9.
  const e = lireEchecConstruction("quand: 2026-08-20T10:00:00.000Z\ncode: 137\ndit:\n");
  assert.match(e.cause ?? "", /mémoire/, "137 est la signature d'un SIGKILL");
});

verifier("pas de témoin : pas d'échec", () => {
  for (const rien of [null, "", "   ", undefined]) {
    assert.equal(lireEchecConstruction(rien as string).echoue, false);
  }
});

// --- 3. Ce qu'il LIT à l'écran -------------------------------------------

verifier("la phrase d'un abattage lui dit quoi FAIRE", () => {
  const p = phraseEchec(lireEchecConstruction(TEMOIN_ABATTU));
  assert.match(p, /mémoire/, "la cause doit être nommée");
  assert.match(p, /RALLUMEZ|[Rr]allum/, "sans geste à faire, il relit sans agir — le défaut du 29 août");
  // **Aucun gras Markdown** : cette phrase est publiée dans un bloc de code sur
  // la fiche GitHub, où les astérisques s'afficheraient telles quelles.
  assert.doesNotMatch(p, /\*\*/, "le gras Markdown se lit littéralement dans un bloc de code");
});

verifier("la phrase d'un abattage montre la mémoire relevée à l'instant", () => {
  const p = phraseEchec(lireEchecConstruction(TEMOIN_ABATTU));
  assert.match(p, /96M|8\.3G/, "le chiffre qui prouve le manque doit se voir");
});

verifier("la phrase sans cause reconnue reste celle d'avant, et reste vraie", () => {
  const p = phraseEchec(lireEchecConstruction(TEMOIN_COMPILATION));
  assert.match(p, /ÉCHOUÉ/);
  assert.match(p, /veilleur retente/, "il ne faut pas envoyer rallumer un espace qui se répare seul");
  assert.doesNotMatch(p, /mémoire/, "ne pas accuser la mémoire quand rien ne le dit");
});

verifier("la phrase ne parle pas de mécanisme au patron", () => {
  const p = phraseEchec(lireEchecConstruction(TEMOIN_ABATTU));
  for (const jargon of ["SIGKILL", "exit code", "OOM", "Turbopack", "next build"]) {
    assert.ok(!p.includes(jargon), `« ${jargon} » n'a rien à faire sous ses yeux`);
  }
});

// --- 4. Le signal est-il VRAIMENT consigné par le banc ? -----------------
//
// La règle pure ne sert à rien si `banc.mjs` continue de jeter le signal. Ces
// deux contrôles lisent le banc : ils n'égalent pas un banc démarré, mais ils
// attrapent le retour en arrière — et c'est précisément ce retour en arrière
// qui a coûté la soirée.
const BANC = readFileSync(path.join(__dirname, "banc.mjs"), "utf8");

verifier("le banc RETIENT le signal de sortie", () => {
  assert.match(
    BANC,
    /p\.on\("exit",\s*\(code,\s*signal\)/,
    "sans le second argument, un abattage est indiscernable d'une erreur de compilation"
  );
});

verifier("le banc ÉCRIT le signal dans le témoin", () => {
  assert.match(
    BANC,
    /`signal: \$\{signal \?\? "aucun"\}`/,
    "retenu mais pas écrit, le signal ne sert à personne : la fiche ne peut pas le lire"
  );
});

verifier("la fiche LIT le témoin par cette règle, et pas à la main", () => {
  const fiche = readFileSync(path.join(__dirname, "diagnostiquer-espace.mjs"), "utf8");
  assert.match(fiche, /phraseEchec\(lireEchecConstruction\(echecBati\)\)/);
  assert.doesNotMatch(
    fiche,
    /const quand = \(echecBati\.match/,
    "l'ancienne extraction manuelle est revenue : elle jette le signal et la mémoire"
  );
});

console.log(
  echecs === 0
    ? "\n✅ Lecture de l'échec de construction : toutes les vérifications passent.\n"
    : `\n❌ ${echecs} vérification(s) en échec.\n`
);
process.exit(echecs === 0 ? 0 : 1);
