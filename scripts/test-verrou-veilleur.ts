import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
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
async function veillerAvecUnVerrou(
  numero: number,
  opts: { banc?: number; santeRepond?: boolean } = {}
): Promise<{ verrou: string; veilleur: number; bancVivant: boolean }> {
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-verrou-veilleur-"));
  const verrou = path.join(dossier, "veilleur.pid");
  const bin = path.join(dossier, "bin");
  mkdirSync(bin);
  // Un faux `npm` : le veilleur neuf voit un port muet et relance un banc.
  writeFileSync(path.join(bin, "npm"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(bin, "npm"), 0o755);
  writeFileSync(verrou, `${numero}\n`);
  if (opts.banc) writeFileSync(path.join(dossier, "banc.pid"), `${opts.banc}\n`);
  // Un serveur qui répond à la santé, pour le témoin : c'est un banc qui SERT.
  const port = 39500 + (process.pid % 400);
  const sante = opts.santeRepond ? createServer((_q, r) => r.end("ok")) : null;
  if (sante) await new Promise<void>((r) => sante.listen(port, "127.0.0.1", () => r()));

  const veilleur = spawn("bash", [VEILLEUR, dossier], {
    env: {
      ...process.env,
      PORT: opts.santeRepond ? String(port) : "39999",
      JOURNAL: path.join(dossier, "journal.log"),
      ATLAS_VERROU_VEILLEUR: verrou,
      ATLAS_INTERVALLE_VEILLE: "1",
      // Un verrou de banc À NOUS : le veilleur arrête le banc qu'il y lit, et le vrai
      // banc de cette machine ne doit jamais l'être par une suite.
      ATLAS_VERROU_BANC: path.join(dossier, "banc.pid"),
      ATLAS_INTERVALLE_RAPPORT: "9999",
      ATLAS_TEMOIN_ECHEC: path.join(dossier, "echec.txt"),
      PATH: `${bin}:${process.env.PATH}`,
    },
    detached: true,
    stdio: "ignore",
  });
  await attendre(2000);
  const apres = readFileSync(verrou, "utf8").trim();
  let bancVivant = false;
  if (opts.banc) {
    try {
      process.kill(opts.banc, 0);
      bancVivant = true;
    } catch {
      bancVivant = false;
    }
  }
  sante?.close();
  try {
    process.kill(-veilleur.pid!, "SIGKILL");
  } catch {
    /* déjà sorti */
  }
  rmSync(dossier, { recursive: true, force: true });
  return { verrou: apres, veilleur: veilleur.pid!, bancVivant };
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

  // **Le banc de l'ancien veilleur.** `demarrer.sh` remplace le veilleur après
  // une mise à jour ; le banc qu'il avait lancé lui survivait, bloqué, avec le
  // verrou du banc. Le banc neuf sortait sur « déjà en train de se
  // construire », sans fin.
  const fauxBanc = () => spawn("bash", ["-c", "exec -a 'node scripts/banc.mjs (faux)' sleep 60"], { detached: true, stdio: "ignore" });
  const tuer = (pid: number) => {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      /* déjà mort */
    }
  };

  await cas("un banc précédent qui ne sert rien est arrêté par le veilleur neuf", async () => {
    const banc = fauxBanc();
    try {
      await attendre(200);
      const { bancVivant } = await veillerAvecUnVerrou(999999, { banc: banc.pid! });
      assert.equal(bancVivant, false, "le banc bloqué garde sa place : le serveur ne reviendrait jamais");
    } finally {
      tuer(banc.pid!);
    }
  });

  await cas("TÉMOIN — un banc qui SERT n'est jamais arrêté", async () => {
    const banc = fauxBanc();
    try {
      await attendre(200);
      const { bancVivant } = await veillerAvecUnVerrou(999999, { banc: banc.pid!, santeRepond: true });
      assert.equal(bancVivant, true, "un banc qui servait a été arrêté : coupure pour rien");
    } finally {
      tuer(banc.pid!);
    }
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Verrou du veilleur — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

void principal();
