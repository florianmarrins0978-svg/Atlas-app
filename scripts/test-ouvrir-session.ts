/*
  ÉPROUVER « npm run session » — le lanceur qui choisit son dossier tout seul.

  **Sa demande du 10 septembre 2026 :** *« je veux qu'elle se débrouille,
  qu'elle aille dans un dossier à chaque fois, seule »*. Ce qui doit être tenu
  n'est donc pas « le script ne plante pas », c'est : **deux sessions lancées
  l'une après l'autre n'atterrissent jamais dans le même dossier.**

  **Il se joue sur un dépôt jetable, avec un FAUX `claude`.** Le vrai
  ouvrirait une session interactive que rien ne fermerait ; le faux écrit son
  dossier de travail et rend la main — c'est exactement ce qu'on mesure.
*/
import assert from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cheminDuJeton, JETONS } from "./ouvrir-session.mjs";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANCEUR = path.join(RACINE, "scripts", "ouvrir-session.mjs");

let reussis = 0;
let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (e) {
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
    echecs++;
  }
}

/** Un dépôt jetable, ses deux dossiers de travail, et un faux `claude`. */
function decor() {
  const parent = mkdtempSync(path.join(tmpdir(), "atlas-ouvrir-"));
  const racine = path.join(parent, "projet");
  mkdirSync(racine);
  const git = (...a: string[]) => {
    const r = spawnSync("git", a, { cwd: racine, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${a.join(" ")} : ${r.stderr}`);
  };
  git("init", "-b", "principale");
  git("config", "user.email", "essai@atlas.local");
  git("config", "user.name", "Essai");
  writeFileSync(path.join(racine, "rien.txt"), "");
  git("add", ".");
  git("commit", "-m", "premier");
  git("worktree", "add", "-b", "session-2", path.join(parent, "projet-s2"));

  // Le faux `claude` : il écrit son dossier de travail, puis s'en va.
  const binaire = path.join(parent, "bin");
  mkdirSync(binaire);
  const trace = path.join(parent, "ou.txt");
  const faux = path.join(binaire, "claude");
  writeFileSync(faux, `#!/bin/sh\npwd >> "${trace}"\n`);
  chmodSync(faux, 0o755);

  return { parent, racine, binaire, trace };
}

function lancer(racine: string, binaire: string, ...args: string[]): Promise<number> {
  return new Promise((resoudre) => {
    const e = spawn(process.execPath, [LANCEUR, ...args], {
      cwd: racine,
      env: { ...process.env, PATH: `${binaire}:${process.env.PATH}` },
      stdio: "ignore",
    });
    e.on("exit", (code) => resoudre(code ?? 0));
  });
}

// **Tout dans une fonction, et ce n'est pas un style.** `tsx` compile les
// suites de ce dépôt en CommonJS, qui refuse un `await` de premier niveau.
async function main() {
console.log("=== La session choisit son dossier ===\n");

const d = decor();
try {
  // ─── UNE SESSION SEULE PREND LE DOSSIER PRINCIPAL ───────────────────────
  {
    const code = await lancer(d.racine, d.binaire);
    cas("une session seule s'ouvre dans le dossier principal", () => {
      assert.equal(code, 0, `le lanceur a rendu ${code}`);
      const ou = readFileSync(d.trace, "utf8").trim().split("\n");
      assert.equal(ou.length, 1, `lu : ${JSON.stringify(ou)}`);
      assert.equal(path.resolve(ou[0]), path.resolve(d.racine));
    });

    cas("et le jeton est rendu en partant", () => {
      assert.ok(
        !existsSync(cheminDuJeton(d.racine)),
        "le dossier resterait pris pour toujours après une session fermée"
      );
    });
  }

  // ─── LE DOSSIER PRIS EST ÉVITÉ ──────────────────────────────────────────
  //
  // **C'est le contrôle qui porte sa demande.** Sans lui, le lanceur rendrait
  // toujours le premier dossier — et cinq sessions se retrouveraient dans le
  // même, c'est-à-dire la panne que les dossiers venaient supprimer.
  {
    mkdirSync(JETONS, { recursive: true });
    // Un jeton vivant : le PID de CE processus, qui tourne évidemment.
    writeFileSync(cheminDuJeton(d.racine), `${process.pid}\n`, "utf8");
    rmSync(d.trace, { force: true });

    const code = await lancer(d.racine, d.binaire);
    cas("le dossier déjà pris est sauté — la session va dans le suivant", () => {
      assert.equal(code, 0, `le lanceur a rendu ${code}`);
      const ou = readFileSync(d.trace, "utf8").trim();
      assert.equal(
        path.resolve(ou),
        path.resolve(path.join(d.parent, "projet-s2")),
        `la session s'est ouverte dans ${ou}, où une autre travaille déjà`
      );
    });
  }

  // ─── TOUT EST PRIS : ON LE DIT, ON N'INVENTE PAS ────────────────────────
  {
    writeFileSync(cheminDuJeton(path.join(d.parent, "projet-s2")), `${process.pid}\n`, "utf8");
    rmSync(d.trace, { force: true });

    const sortie = spawnSync(process.execPath, [LANCEUR], {
      cwd: d.racine,
      env: { ...process.env, PATH: `${d.binaire}:${process.env.PATH}` },
      encoding: "utf8",
    });
    cas("tous les dossiers pris : il refuse, et donne la commande", () => {
      assert.notEqual(sortie.status, 0, "il a ouvert une session dans un dossier occupé");
      assert.match(sortie.stderr, /sessions:preparer/, `lu :\n${sortie.stderr}`);
      assert.ok(!existsSync(d.trace), "« claude » a quand même été lancé");
    });
  }

  // ─── « PREND LE DOSSIER NUMÉRO 2 » ──────────────────────────────────────
  //
  // **Sa demande du 10 septembre 2026 :** *« je peux leur dire prend le dossier
  // numéro 2 ? »*. Les rangs sont ceux qu'affiche `sessions:preparer --liste`.
  {
    for (const dossier of [d.racine, path.join(d.parent, "projet-s2")]) {
      rmSync(cheminDuJeton(dossier), { force: true });
    }
    rmSync(d.trace, { force: true });

    const code = await lancer(d.racine, d.binaire, "2");
    cas("un numéro donne CE dossier-là, même si le premier est libre", () => {
      assert.equal(code, 0, `le lanceur a rendu ${code}`);
      const ou = readFileSync(d.trace, "utf8").trim();
      assert.equal(
        path.resolve(ou),
        path.resolve(path.join(d.parent, "projet-s2")),
        `la session s'est ouverte dans ${ou}`
      );
    });
  }

  // **Un dossier demandé et occupé se REFUSE.** Sans numéro, prendre le suivant
  // est le service rendu ; avec un numéro, ce serait ouvrir la session ailleurs
  // qu'où il l'a dit, sans qu'il le voie.
  {
    mkdirSync(JETONS, { recursive: true });
    writeFileSync(cheminDuJeton(path.join(d.parent, "projet-s2")), `${process.pid}\n`, "utf8");
    rmSync(d.trace, { force: true });

    const sortie = spawnSync(process.execPath, [LANCEUR, "2"], {
      cwd: d.racine,
      env: { ...process.env, PATH: `${d.binaire}:${process.env.PATH}` },
      encoding: "utf8",
    });
    cas("le dossier demandé est occupé : il refuse, il ne va pas ailleurs", () => {
      assert.notEqual(sortie.status, 0, "il a ouvert la session dans un autre dossier");
      assert.match(sortie.stderr, /occupé/, `lu :\n${sortie.stderr}`);
      assert.ok(!existsSync(d.trace), "« claude » a quand même été lancé");
    });
    rmSync(cheminDuJeton(path.join(d.parent, "projet-s2")), { force: true });
  }

  {
    const sortie = spawnSync(process.execPath, [LANCEUR, "9"], {
      cwd: d.racine,
      env: { ...process.env, PATH: `${d.binaire}:${process.env.PATH}` },
      encoding: "utf8",
    });
    cas("un numéro qui n'existe pas : il le dit et montre la liste", () => {
      assert.notEqual(sortie.status, 0);
      assert.match(sortie.stderr, /pas de dossier n° 9/, `lu :\n${sortie.stderr}`);
      assert.match(sortie.stderr, /projet-s2/, `la liste des dossiers manque :\n${sortie.stderr}`);
    });
  }

  // ─── UN JETON MORT NE CONDAMNE PAS UN DOSSIER ───────────────────────────
  //
  // Machine éteinte, terminal fermé d'un coup : le jeton reste sur le disque.
  // S'y fier interdirait le dossier pour toujours — c'est le défaut du verrou
  // de la batterie, dans l'autre sens (`CLAUDE.md` §5).
  {
    // Un PID libre : on en cherche un que le système ne connaît pas.
    let mort = 999_999;
    while (mort > 2) {
      try {
        process.kill(mort, 0);
        mort -= 1;
      } catch {
        break;
      }
    }
    writeFileSync(cheminDuJeton(d.racine), `${mort}\n`, "utf8");
    rmSync(cheminDuJeton(path.join(d.parent, "projet-s2")), { force: true });
    rmSync(d.trace, { force: true });

    const code = await lancer(d.racine, d.binaire);
    cas("un jeton dont le processus est mort ne bloque rien", () => {
      assert.equal(code, 0, `le lanceur a rendu ${code}`);
      const ou = readFileSync(d.trace, "utf8").trim();
      assert.equal(path.resolve(ou), path.resolve(d.racine), `lu : ${ou}`);
    });
  }
} finally {
  for (const dossier of [d.racine, path.join(d.parent, "projet-s2")]) {
    rmSync(cheminDuJeton(dossier), { force: true });
  }
  rmSync(d.parent, { recursive: true, force: true });
}

console.log(
  `\n${echecs === 0 ? "✅" : "❌"} La session choisit son dossier — ${reussis} réussi(s), ${echecs} échec(s).`
);
process.exit(echecs === 0 ? 0 : 1);
}

main();
