import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { exigerLesOutils, exigerUnSystemePosix } from "./_outil-requis";

exigerLesOutils("bash");
exigerUnSystemePosix("groupes de processus", "PATH séparé par « : »");

// **27 octobre 2026 : le numéro d'un veilleur d'hier, repris par un autre.**
//
// Le verrou du veilleur vit dans `/tmp`, qui survit à l'arrêt de l'espace.
// Au redémarrage les numéros repartent de zéro, et celui du veilleur d'hier
// désigne un programme quelconque, bien vivant. `kill -0` répondait « il
// tourne » : le veilleur neuf sortait sur « déjà en place », personne ne
// relançait le serveur, et le patron voyait une page blanche pendant que la
// fiche annonçait « Veilleur : en place ».

const VEILLEUR = path.join(__dirname, "..", ".devcontainer", "veiller.sh");

let echecs = 0;
async function cas(nom: string, f: () => Promise<void>) {
  try {
    await f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lance un veilleur sur un verrou qui porte déjà `numero`, et rend ce que le verrou dit ensuite. */
async function veillerAvecUnVerrou(numero: number): Promise<{ verrou: string; veilleur: number }> {
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-verrou-veilleur-"));
  const verrou = path.join(dossier, "veilleur.pid");
  const bin = path.join(dossier, "bin");
  mkdirSync(bin);
  // Un faux `npm` : le veilleur neuf voit un port muet et relance un banc.
  writeFileSync(path.join(bin, "npm"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(bin, "npm"), 0o755);
  writeFileSync(verrou, `${numero}\n`);

  const veilleur = spawn("bash", [VEILLEUR, dossier], {
    env: {
      ...process.env,
      PORT: "39999",
      JOURNAL: path.join(dossier, "journal.log"),
      ATLAS_VERROU_VEILLEUR: verrou,
      ATLAS_INTERVALLE_VEILLE: "1",
      ATLAS_INTERVALLE_RAPPORT: "9999",
      ATLAS_TEMOIN_ECHEC: path.join(dossier, "echec.txt"),
      PATH: `${bin}:${process.env.PATH}`,
    },
    detached: true,
    stdio: "ignore",
  });
  await attendre(2000);
  const apres = readFileSync(verrou, "utf8").trim();
  try {
    process.kill(-veilleur.pid!, "SIGKILL");
  } catch {
    /* déjà sorti */
  }
  rmSync(dossier, { recursive: true, force: true });
  return { verrou: apres, veilleur: veilleur.pid! };
}

async function principal() {
  console.log("=== Un numéro vivant n'est pas un veilleur ===\n");

  await cas("un numéro repris par un autre programme ne bloque pas le veilleur", async () => {
    // Le père de ce test est bien vivant, et ce n'est pas un veilleur.
    const { verrou, veilleur } = await veillerAvecUnVerrou(process.ppid);
    assert.equal(
      verrou,
      String(veilleur),
      "le veilleur est sorti sur « déjà en place » : personne ne relancerait le serveur, page blanche"
    );
  });

  await cas("TÉMOIN — un vrai veilleur vivant garde son verrou", async () => {
    // `exec -a` donne à `sleep` la ligne de commande d'un veilleur.
    const vrai = spawn("bash", ["-c", "exec -a 'bash veiller.sh (faux)' sleep 30"], { detached: true, stdio: "ignore" });
    try {
      const { verrou } = await veillerAvecUnVerrou(vrai.pid!);
      assert.equal(verrou, String(vrai.pid), "un second veilleur a pris la place d'un veilleur vivant : deux serveurs relancés");
    } finally {
      try {
        process.kill(-vrai.pid!, "SIGKILL");
      } catch {
        /* déjà mort */
      }
    }
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Verrou du veilleur — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

void principal();
