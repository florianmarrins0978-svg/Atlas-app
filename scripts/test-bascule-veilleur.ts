import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { prendreVerrouBanc, libererVerrouBanc } from "./verrou-banc.mjs";

// **« listen EADDRINUSE … 0.0.0.0:3000 », errno -98 — la panne du 10 août 2026.**
//
// Vue chez le patron APRÈS une construction pourtant réussie, au moment précis
// de la bascule vers la version bâtie. Le mécanisme tient à quinze secondes :
//
//   1. `banc.mjs` tue son `next dev` pour libérer le port ;
//   2. pendant ce battement, la santé ne répond plus ET aucun `next` ne tourne
//      — c'est-à-dire, mot pour mot, les deux conditions que `veiller.sh` exige
//      pour conclure « le serveur est mort » ;
//   3. le veilleur lance un SECOND banc, qui prend le port ;
//   4. le `next start` du premier meurt sur EADDRINUSE.
//
// Les deux scripts étaient justes séparément. C'est leur rencontre qui tuait
// l'application — et aucun contrôle ne les regardait ensemble.
//
// Ce que cette suite tient :
//
//   1. le drapeau se pose, se lit et se retire ;
//   2. **il EXPIRE.** C'est le point qui compte le plus : un banc tué au mauvais
//      moment laisserait sinon un drapeau éternel, et le veilleur — dont
//      l'existence répare le 404 du 9 août — ne relèverait plus jamais rien,
//      sans un mot. Une bascule bousculée vaut mieux qu'un veilleur muet ;
//   3. un drapeau illisible ne vaut PAS « ne fais rien » — on retombe toujours
//      du côté du veilleur actif ;
//   4. `veiller.sh` le consulte vraiment, et `banc.mjs` le pose avant de tuer
//      son serveur, jamais après.

const BASCULE = path.join(__dirname, "..", ".devcontainer", "bascule-en-cours.sh");
const VEILLEUR = path.join(__dirname, "..", ".devcontainer", "veiller.sh");
const BANC = path.join(__dirname, "banc.mjs");

let echecs = 0;
const dossier = mkdtempSync(path.join(tmpdir(), "atlas-bascule-"));
const DRAPEAU = path.join(dossier, "atlas-bascule");

/** Rend `true` si le script dit qu'une bascule est en cours. */
function basculeEnCours(delai = "180"): boolean {
  const r = execFileSync("bash", ["-c", `bash "${BASCULE}"; echo $?`], {
    env: {
      ...process.env,
      ATLAS_DRAPEAU_BASCULE: DRAPEAU,
      ATLAS_DELAI_BASCULE: delai,
    },
    encoding: "utf8",
  });
  return r.trim().endsWith("0");
}

function marquer(etape: string) {
  execFileSync("bash", [BASCULE, etape], {
    env: { ...process.env, ATLAS_DRAPEAU_BASCULE: DRAPEAU },
  });
}

function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== La bascule et le veilleur ne se tuent plus l'un l'autre ===\n");

cas("sans drapeau, le veilleur travaille normalement", () => {
  rmSync(DRAPEAU, { force: true });
  assert.equal(basculeEnCours(), false, "aucune bascule n'est en cours, le veilleur doit agir");
});

cas("drapeau posé : le veilleur s'abstient", () => {
  marquer("--debut");
  assert.ok(existsSync(DRAPEAU), "le drapeau n'a pas été écrit");
  assert.equal(basculeEnCours(), true, "une bascule est en cours, le veilleur ne doit rien relancer");
});

cas("drapeau retiré : le veilleur reprend aussitôt", () => {
  marquer("--fin");
  assert.equal(existsSync(DRAPEAU), false, "le drapeau n'a pas été retiré");
  assert.equal(basculeEnCours(), false);
});

// **Le contrôle qui compte le plus.** Sans expiration, un banc tué pendant sa
// bascule endormirait le veilleur pour toujours — et le 404 du 9 août
// reviendrait, sans que rien ne le relie à ce drapeau.
cas("un drapeau périmé ne vaut plus rien : le veilleur repart", () => {
  const vieux = Math.floor(Date.now() / 1000) - 500;
  writeFileSync(DRAPEAU, `${vieux}\n`);
  assert.equal(
    basculeEnCours("180"),
    false,
    "un drapeau de 500 s endort encore le veilleur : un banc tué le rendrait muet pour toujours"
  );
  // Et le même drapeau, dans un délai plus large, compte encore : c'est bien
  // l'âge qui décide, pas un hasard d'écriture.
  assert.equal(basculeEnCours("900"), true, "l'expiration ne dépend pas de l'âge du drapeau");
});

cas("un drapeau illisible ne vaut pas « ne fais rien »", () => {
  for (const contenu of ["", "bientôt", "-42\n"]) {
    writeFileSync(DRAPEAU, contenu);
    assert.equal(
      basculeEnCours(),
      false,
      `« ${contenu.trim() || "(vide)"} » endort le veilleur : on doit toujours retomber du côté actif`
    );
  }
  rmSync(DRAPEAU, { force: true });
});

// Deux scripts justes séparément peuvent se tuer l'un l'autre : ce sont leurs
// branchements qu'il faut tenir, pas seulement leur logique.
cas("veiller.sh consulte le drapeau AVANT de conclure à une mort", () => {
  const lignes = readFileSync(VEILLEUR, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"));
  // **L'APPEL, pas la déclaration.** Première version, ce contrôle cherchait
  // « $BASCULE » n'importe où : la ligne `BASCULE="…/bascule-en-cours.sh"` le
  // satisfaisait, et il restait vert alors que la consultation avait été
  // remplacée par `if false`. Vu en le dégradant, pas en le relisant.
  const consulte = lignes.findIndex((l) => /\bif\s+bash\s+"\$BASCULE"/.test(l));
  const conclut = lignes.findIndex((l) => l.includes("api/health/live"));
  assert.notEqual(consulte, -1, "veiller.sh ne consulte pas le drapeau : il relancera un banc pendant la bascule");
  assert.notEqual(conclut, -1, "veiller.sh n'interroge plus la santé : ce contrôle n'éprouve plus rien");
  assert.ok(
    consulte < conclut,
    "veiller.sh consulte le drapeau APRÈS avoir conclu : il aura déjà lancé un second banc"
  );
});

cas("banc.mjs pose le drapeau AVANT de tuer son serveur", () => {
  const code = readFileSync(BANC, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");
  const pose = code.indexOf('marquerBascule("--debut")');
  const tue = code.indexOf('serveur.kill("SIGTERM")');
  const retire = code.indexOf('marquerBascule("--fin")');
  assert.notEqual(pose, -1, "banc.mjs ne pose pas le drapeau");
  assert.notEqual(tue, -1, "banc.mjs ne tue plus son serveur : ce contrôle n'éprouve plus rien");
  assert.ok(pose < tue, "le drapeau est posé APRÈS la mise à mort : la fenêtre reste grande ouverte");
  assert.notEqual(retire, -1, "banc.mjs ne retire jamais le drapeau");
  assert.ok(retire > tue, "le drapeau est retiré avant même la bascule");
});

// ─────────────────────────────────────────────────────────────────────────────
// **L'autre moitié de la panne : DEUX bancs.**
//
// Le drapeau ci-dessus empêche le veilleur de lancer un banc pendant une
// bascule. Il n'empêche pas le patron d'en lancer un à la main pendant que
// l'espace en fait déjà tourner un — ce qu'il a fait le 10 août, faute de voir
// quoi que ce soit arriver. Les deux ont bâti, et le premier à vouloir servir a
// trouvé le port pris.

const VERROU = path.join(dossier, "atlas-banc.pid");

cas("un second banc ne peut pas démarrer pendant qu'un premier vit", () => {
  const premier = prendreVerrouBanc({ chemin: VERROU, pid: process.pid });
  assert.equal(premier.pris, true, "le premier banc n'a pas pris le verrou");

  // Un autre processus, bien vivant : le père de celui-ci fait l'affaire.
  const second = prendreVerrouBanc({ chemin: VERROU, pid: process.ppid });
  assert.equal(second.pris, false, "un second banc a pu démarrer : c'est le EADDRINUSE du 10 août");
});

// **Un verrou qui survit à son porteur enfermerait le patron dehors.** Un banc
// tué — ou un conteneur redémarré — laisse son fichier derrière lui ; s'il
// valait encore, plus aucun banc ne démarrerait jamais, et rien ne le dirait.
cas("un verrou laissé par un processus mort ne bloque personne", () => {
  // Un identifiant hors de portée : personne ne le porte.
  writeFileSync(VERROU, "999999\n");
  const r = prendreVerrouBanc({ chemin: VERROU, pid: process.pid });
  assert.equal(r.pris, true, "un verrou mort bloque le démarrage : le banc ne reviendrait jamais");
});

cas("un verrou illisible ne bloque pas non plus", () => {
  for (const contenu of ["", "bientôt", "-1"]) {
    writeFileSync(VERROU, contenu);
    assert.equal(
      prendreVerrouBanc({ chemin: VERROU, pid: process.pid }).pris,
      true,
      `« ${contenu || "(vide)"} » empêche tout démarrage`
    );
  }
});

cas("le verrou se rend, et seulement à son porteur", () => {
  prendreVerrouBanc({ chemin: VERROU, pid: process.pid });
  libererVerrouBanc({ chemin: VERROU, pid: process.ppid });
  assert.ok(existsSync(VERROU), "un autre processus a pu retirer un verrou qui n'était pas le sien");
  libererVerrouBanc({ chemin: VERROU, pid: process.pid });
  assert.equal(existsSync(VERROU), false, "le porteur n'arrive pas à rendre son verrou");
});

cas("banc.mjs prend le verrou avant de lancer quoi que ce soit", () => {
  const code = readFileSync(BANC, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");
  const prend = code.indexOf("prendreVerrouBanc(");
  const lance = code.search(/let serveur = /);
  assert.notEqual(prend, -1, "banc.mjs ne prend aucun verrou : deux bancs peuvent encore se battre");
  assert.notEqual(lance, -1, "banc.mjs ne lance plus de serveur : ce contrôle n'éprouve plus rien");
  assert.ok(prend < lance, "le verrou est pris APRÈS le lancement : les deux bancs auront déjà démarré");
  assert.match(code, /libererVerrouBanc\(\)/, "banc.mjs ne rend jamais son verrou");
});

// ─────────────────────────────────────────────────────────────────────────────
// **« setRawMode EIO », puis « Segmentation fault (core dumped) ».**
//
// Lu chez le patron le 10 août 2026, APRÈS un « Compiled successfully in 62s » :
// la construction avait réussi, et elle est morte en rendant la main. Quand son
// entrée est un vrai terminal, Next.js tente d'en prendre le contrôle pour
// écouter les touches ; dans un espace distant ce terminal peut disparaître
// sous lui — session rechargée, onglet fermé — et l'appel échoue en `EIO`, que
// la couche native ne rattrape pas.
//
// `next build` ne lit rien au clavier. On ne lui donne donc plus d'entrée du
// tout : `isTTY` devient faux et l'opération n'est même plus tentée. La SORTIE
// reste héritée — le patron doit voir ce qui se passe — et Ctrl+C continue de
// fonctionner, puisqu'il passe par le groupe de processus.
//
// Éprouvé en lançant le banc DANS un vrai terminal (`script -qec`) : la
// construction va au bout, aucun `setRawMode`, aucune segmentation fault, et
// l'application sert en 7 ms.
cas("aucun enfant du banc ne reçoit le terminal", () => {
  for (const fichier of [BANC, path.join(__dirname, "essai.mjs")]) {
    const code = readFileSync(fichier, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    assert.ok(
      !/stdio:\s*"inherit"/.test(code),
      `${path.basename(fichier)} donne encore le terminal à un enfant : c'est le « setRawMode EIO » du 10 août`
    );
    assert.match(
      code,
      /\["ignore",\s*"inherit",\s*"inherit"\]|SANS_TERMINAL/,
      `${path.basename(fichier)} ne laisse plus passer la sortie : le patron ne verrait plus rien`
    );
  }
});

rmSync(dossier, { recursive: true, force: true });

console.log(`\n${echecs === 0 ? "✅" : "❌"} Bascule et veilleur — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
