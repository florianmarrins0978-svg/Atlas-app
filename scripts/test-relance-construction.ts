import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **« Je crois que j'ai encore la version lente » — le 18 août 2026.**
//
// Sa fiche disait : « Code SERVI : AUCUNE — la construction a ÉCHOUÉ ». Tout
// avait pourtant été réparé la veille : l'orpheline est délogée, le verrou de
// banc est exclusif, une seconde tentative part sur ce refus-là
// (`ARCHITECTURE.md` §126). Et il était encore lent.
//
// **LE TROU, ET IL EST BÉANT :** `veiller.sh` ne relançait `npm run banc` que
// lorsque RIEN ne répondait sur le port. Or une construction qui échoue laisse
// le banc en mode développement — et ce mode-là répond très bien. Le veilleur
// se déclarait donc content, et plus rien, nulle part, ne retentait la
// construction. Le patron passait la soirée sur la version lente.
//
// Ce que cette suite tient, et qu'aucune autre ne regarde :
//
//   1. serveur qui répond + témoin d'échec ⇒ la construction est RETENTÉE ;
//   2. serveur qui répond + AUCUN témoin ⇒ on ne relance rien. C'est le TÉMOIN
//      de ce contrôle : sans lui, un veilleur qui relancerait en boucle
//      passerait pour correct, alors qu'il rebâtirait toute la soirée sur une
//      machine qui n'a pas de mémoire à donner ;
//   3. le nombre de tentatives est BORNÉ. Une erreur de types ne se répare pas
//      en insistant, et insister sans fin maintient l'espace à genoux ;
//   4. une construction déjà en cours n'en déclenche pas une seconde — la panne
//      d'origine, précisément.

const VEILLEUR = path.join(__dirname, "..", ".devcontainer", "veiller.sh");

let echecs = 0;
function cas(nom: string, f: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(f)
    .then(() => console.log(`  ✓ ${nom}`))
    .catch((e) => {
      echecs++;
      console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
    });
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fait tourner le veilleur devant un serveur qui RÉPOND, et rend ce que le faux
 * `npm` a reçu.
 *
 * Le faux `npm` est un script posé en tête de `PATH` : il écrit ce qu'on lui
 * demande et rend la main aussitôt. Sans lui, `npm run banc` bâtirait pour de
 * vrai — plusieurs minutes, et une seconde construction sur cette machine.
 */
async function veillerDevantUnServeurVivant(opts: {
  avecTemoinDEchec: boolean;
  constructionEnCours?: boolean;
  duree?: number;
  relancesMax?: string;
  relanceLente?: string;
}): Promise<{ appels: string[]; journal: string }> {
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-relance-"));
  const traces = path.join(dossier, "appels.txt");
  const journal = path.join(dossier, "journal.log");
  const temoin = path.join(dossier, "echec.txt");
  const faussesCommandes = path.join(dossier, "bin");
  mkdirSync(faussesCommandes);

  writeFileSync(
    path.join(faussesCommandes, "npm"),
    `#!/usr/bin/env bash\necho "$@" >> "${traces}"\nexit 0\n`
  );
  chmodSync(path.join(faussesCommandes, "npm"), 0o755);

  if (opts.avecTemoinDEchec) writeFileSync(temoin, "quand: hier\ncode: 1\n");

  // Un serveur qui répond à la santé : c'est tout ce que le veilleur regarde,
  // et c'est exactement ce que fait un banc resté en mode développement.
  const port = 39000 + Math.floor(Number(process.pid) % 900);
  const serveur = createServer((_req, res) => res.end("ok"));
  await new Promise<void>((r) => serveur.listen(port, "127.0.0.1", () => r()));

  // Une construction qui tourne déjà, pour le quatrième contrôle. `sleep` porte
  // « next build » dans sa ligne de commande, ce que `pgrep -f` cherche.
  const orpheline = opts.constructionEnCours
    ? spawn("bash", ["-c", "exec -a 'next build (faux)' sleep 30"], { detached: true })
    : null;

  const veilleur = spawn("bash", [VEILLEUR, dossier], {
    env: {
      ...process.env,
      PORT: String(port),
      JOURNAL: journal,
      ATLAS_TEMOIN_ECHEC: temoin,
      ATLAS_INTERVALLE_VEILLE: "1",
      ATLAS_INTERVALLE_RAPPORT: "9999",
      ATLAS_RELANCE_CONSTRUCTION_S: "0",
      ATLAS_RELANCES_CONSTRUCTION_MAX: opts.relancesMax ?? "3",
      // Le pas lent, une fois la salve épuisée. Très grand par défaut : la
      // plupart des cas veulent mesurer la SALVE, pas ce qui vient après.
      ATLAS_RELANCE_LENTE_S: opts.relanceLente ?? "9999",
      // Un verrou À NOUS : le vrai vit dans /tmp et un veilleur réel qui
      // tournerait à côté ferait sortir celui-ci sans rien mesurer.
      PATH: `${faussesCommandes}:${process.env.PATH}`,
    },
    detached: true,
    stdio: "ignore",
  });

  await attendre(opts.duree ?? 3500);

  try {
    process.kill(-veilleur.pid!, "SIGKILL");
  } catch {
    /* déjà mort */
  }
  if (orpheline?.pid) {
    try {
      process.kill(-orpheline.pid, "SIGKILL");
    } catch {
      /* déjà mort */
    }
  }
  serveur.close();

  const appels = existsSync(traces)
    ? readFileSync(traces, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
    : [];
  const texteJournal = existsSync(journal) ? readFileSync(journal, "utf8") : "";
  rmSync(dossier, { recursive: true, force: true });
  return { appels, journal: texteJournal };
}

async function principal() {
  console.log("=== La construction échouée se retente, sans jamais renoncer ni s'emballer ===\n");

  // Le verrou du veilleur est un fichier unique : on le retire entre deux cas,
  // sans quoi le second veilleur sortirait en disant « déjà en place » et le
  // contrôle mesurerait zéro — le piège du 15 août.
  const libererLeVerrou = () => rmSync("/tmp/atlas-veilleur.pid", { force: true });

  libererLeVerrou();
  await cas("un serveur qui répond MAIS un témoin d'échec : on retente", async () => {
    const { appels, journal } = await veillerDevantUnServeurVivant({ avecTemoinDEchec: true });
    assert.ok(
      appels.some((a) => a.includes("run banc")),
      `le veilleur n'a rien retenté — il a appelé : ${appels.join(" | ") || "rien du tout"}`
    );
    assert.match(journal, /retente la construction/);
  });

  libererLeVerrou();
  await cas("TÉMOIN — sans témoin d'échec, on ne relance RIEN", async () => {
    const { appels } = await veillerDevantUnServeurVivant({ avecTemoinDEchec: false });
    assert.equal(
      appels.length,
      0,
      `le veilleur a relancé alors que la version rapide était en place : ${appels.join(" | ")}`
    );
  });

  libererLeVerrou();
  await cas("la salve rapide est bornée, et le passage au ralenti se dit", async () => {
    // Le pas lent est hors de portée du cas : ce qu'on mesure ici, c'est que la
    // salve RAPIDE s'arrête bien à deux et ne dégénère pas en boucle serrée.
    const { appels, journal } = await veillerDevantUnServeurVivant({
      avecTemoinDEchec: true,
      relancesMax: "2",
      relanceLente: "9999",
      duree: 6000,
    });
    assert.ok(appels.length > 0, "aucune tentative : le contrôle ne mesure rien");
    assert.ok(
      appels.length <= 2,
      `${appels.length} tentatives rapprochées alors que deux étaient permises — l'espace serait maintenu à genoux`
    );
    assert.match(journal, /on continue, une toutes les/);
  });

  libererLeVerrou();
  await cas("APRÈS la salve, on retente encore — le banc ne reste pas lent pour la journée", async () => {
    // **Le défaut du 20 août 2026, et c'est celui-ci qui compte.** Le compteur
    // s'arrêtait à trois : passé la salve, plus rien ne retentait jamais, et la
    // fiche disait « il est LENT, et le restera ». Le patron a écrit
    // « l'application est lente corrige ça » une demi-heure après l'échec,
    // alors que sa machine avait renoncé.
    //
    // Ici, le pas lent vaut zéro : le veilleur doit donc dépasser la salve.
    const { appels } = await veillerDevantUnServeurVivant({
      avecTemoinDEchec: true,
      relancesMax: "1",
      relanceLente: "0",
      duree: 6000,
    });
    assert.ok(
      appels.length > 1,
      `${appels.length} tentative(s) : le veilleur s'est arrêté après la salve — le banc resterait lent toute la journée`
    );
  });

  libererLeVerrou();
  await cas("une construction déjà en cours n'en déclenche pas une seconde", async () => {
    const { appels } = await veillerDevantUnServeurVivant({
      avecTemoinDEchec: true,
      constructionEnCours: true,
    });
    assert.equal(
      appels.length,
      0,
      `une seconde construction a été lancée à côté de la première : ${appels.join(" | ")}`
    );
  });

  libererLeVerrou();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} La relance de construction — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

principal();
