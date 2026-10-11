/*
  ÉPROUVER « npm run sessions:preparer » — sur un vrai dépôt, jamais sur celui-ci.

  ───────────────────────────────────────────────────────────────────────────
  **Payé le 9 septembre 2026.** Le script existait depuis le 8, il portait sa
  demande — *« crée un dossier de travail par session »* — et **aucun contrôle
  ne le jouait**. Le patron l'a lancé, et il a répondu : *« je viens de le
  faire, il m'a dit erreur »*.

  C'est exactement la faute que le dépôt s'est déjà interdite (`AGENTS.md`,
  « rien n'est acté valide sans avoir été éprouvé ») : un outillage livré comme
  prêt, et c'est lui qui trouve le défaut.

  **Il se joue sur un dépôt jetable**, monté dans un dossier temporaire. Le
  jouer sur celui-ci créerait de vrais dossiers de travail à côté du sien, avec
  de vraies branches — un contrôle ne déménage pas la maison qu'il mesure.
  ───────────────────────────────────────────────────────────────────────────
*/
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(RACINE, "scripts", "preparer-sessions.mjs");

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

/** Un dépôt jetable, avec un commit — `git worktree` en exige un. */
function deposJetable(): { racine: string; parent: string } {
  const parent = mkdtempSync(path.join(tmpdir(), "atlas-sessions-"));
  const racine = path.join(parent, "projet");
  mkdirSync(racine);
  const git = (...a: string[]) => {
    const r = spawnSync("git", a, { cwd: racine, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${a.join(" ")} : ${r.stderr}`);
  };
  git("init", "-b", "principale");
  git("config", "user.email", "essai@atlas.local");
  git("config", "user.name", "Essai");
  // Sans dépendances : « npm install » doit rendre la main tout de suite.
  writeFileSync(path.join(racine, "package.json"), JSON.stringify({ name: "essai", version: "1.0.0" }));
  git("add", ".");
  git("commit", "-m", "premier");
  return { racine, parent };
}

function jouer(racine: string, ...args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: racine, encoding: "utf8" });
}

console.log("=== Un dossier de travail par session ===\n");

// ─── LE GESTE LUI-MÊME ────────────────────────────────────────────────────
{
  const { racine, parent } = deposJetable();
  try {
    const r = jouer(racine, "3");
    cas("trois sessions : deux dossiers naissent à côté du premier", () => {
      assert.equal(r.status, 0, `sortie ${r.status} :\n${r.stdout}\n${r.stderr}`);
      assert.ok(existsSync(path.join(parent, "projet-s2")), "projet-s2 n'existe pas");
      assert.ok(existsSync(path.join(parent, "projet-s3")), "projet-s3 n'existe pas");
    });

    cas("chacun est un VRAI dossier de travail, sur sa propre branche", () => {
      // **Ligne à ligne, pas en un seul motif multiligne** : le drapeau `s`
      // demande une cible ES2018, que ce dépôt ne vise pas — et un motif qui
      // traverse les lignes ferait passer « projet-s2 » avec la branche du
      // voisin.
      const liste = spawnSync("git", ["worktree", "list"], { cwd: racine, encoding: "utf8" }).stdout;
      const lignes = liste.split("\n");
      for (const n of [2, 3]) {
        const ligne = lignes.find((l) => l.includes(`projet-s${n}`));
        assert.ok(ligne, `aucun dossier projet-s${n} :\n${liste}`);
        assert.match(ligne, new RegExp(`\\[session-${n}\\]`), `lu : ${ligne}`);
      }
    });

    cas("le rejouer ne recrée rien et ne se plaint pas", () => {
      const encore = jouer(racine, "3");
      assert.equal(encore.status, 0, `sortie ${encore.status} :\n${encore.stdout}\n${encore.stderr}`);
      assert.match(encore.stdout, /déjà là/, `lu :\n${encore.stdout}`);
    });

    // ─── CE QUI L'A FAIT ÉCHOUER CHEZ LUI ───────────────────────────────
    //
    // **Un dossier supprimé depuis l'explorateur reste inscrit dans git.**
    // `git worktree add` refuse alors le même chemin — « is already used by
    // worktree » — sur un dossier qui n'existe plus, et le script s'arrêtait
    // là. C'est le cas que `git worktree prune` règle, et ce contrôle est
    // rouge sans lui.
    cas("un dossier effacé à la main ne bloque plus la commande suivante", () => {
      rmSync(path.join(parent, "projet-s2"), { recursive: true, force: true });
      const apres = jouer(racine, "3");
      assert.equal(
        apres.status,
        0,
        `un dossier effacé à la main fait échouer la préparation :\n${apres.stdout}\n${apres.stderr}`
      );
      assert.ok(existsSync(path.join(parent, "projet-s2")), "projet-s2 n'a pas été recréé");
    });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

// ─── IL SAIT REFUSER ──────────────────────────────────────────────────────
{
  const { racine, parent } = deposJetable();
  try {
    cas("au-delà de huit, il refuse au lieu d'empiler des serveurs", () => {
      const r = jouer(racine, "9");
      assert.notEqual(r.status, 0, "neuf sessions ont été acceptées");
      assert.match(r.stderr + r.stdout, /1 à 8/, `lu :\n${r.stderr}${r.stdout}`);
    });
    cas("une seule session : rien à préparer, et il le dit", () => {
      const r = jouer(racine, "1");
      assert.equal(r.status, 0);
      assert.match(r.stdout, /Rien à préparer/, `lu :\n${r.stdout}`);
    });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

// ─── LES DEUX NOMS MÈNENT AU MÊME SCRIPT ──────────────────────────────────
//
// **Payé le 9 septembre 2026, capture de son terminal à l'appui.** Il a tapé
// `npm run session:preparer 5` — singulier — et npm a répondu « npm error / To
// see a list of scripts, run: npm run », c'est-à-dire rien. Une lettre d'écart
// entre ce qu'on écrit et ce qui existe, et le seul geste qu'on lui demande
// échoue sans dire pourquoi.
//
// Le remède n'est pas de lui apprendre l'orthographe : c'est que les deux
// noms marchent. Ils pointent le MÊME script — il n'y a pas deux commandes,
// il y a deux portes (`CLAUDE.md` §3, jamais de règle dupliquée).
cas("« session:preparer » et « sessions:preparer » mènent au même script", () => {
  const paquet = JSON.parse(
    readFileSync(path.join(RACINE, "package.json"), "utf8")
  ) as { scripts: Record<string, string> };
  const singulier = paquet.scripts["session:preparer"];
  const pluriel = paquet.scripts["sessions:preparer"];
  assert.ok(pluriel, "« sessions:preparer » a disparu de package.json");
  assert.ok(singulier, "« session:preparer » manque : il a tapé le singulier et n'a rien eu");
  assert.equal(singulier, pluriel, "les deux noms ne lancent pas la même chose");
});

console.log(
  `\n${echecs === 0 ? "✅" : "❌"} Un dossier de travail par session — ${reussis} réussi(s), ${echecs} échec(s).`
);
process.exit(echecs === 0 ? 0 : 1);
