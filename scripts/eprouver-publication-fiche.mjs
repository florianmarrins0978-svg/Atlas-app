#!/usr/bin/env node
/**
 * La fiche d'état part-elle VRAIMENT ? — à jouer là où un jeton GitHub existe.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce script existe, et ce qu'il a coûté de ne pas l'avoir.**
 *
 * Le 12 août 2026, le patron redémarre son espace deux fois et la fiche reste
 * introuvable. Le code était juste ; c'est le CHEMIN qui ne l'était pas —
 * `rapporter-espace.mjs` s'en remettait à `gh`, absent de son conteneur parce
 * qu'il n'arrive qu'à la naissance d'un espace, et le sien est plus ancien.
 * Rien, nulle part, n'avait jamais joué la publication pour de bon : les
 * contrôles éprouvaient la censure des secrets et la forme du corps, jamais
 * l'envoi. Un contrôle qui ne parcourt pas ce que parcourt le patron ne prouve
 * rien (`AGENTS.md`).
 *
 * **Il ne peut pas tourner sur la machine de l'agent** : le jeton qu'elle
 * expose est un substitut de son mandataire réseau, et GitHub le refuse
 * (401 « Bad credentials »). Il tourne donc en CI, où `GITHUB_TOKEN` est réel —
 * c'est le déplacement que `CLAUDE.md` §5 prescrit pour ce qui n'est pas
 * joignable d'ici.
 *
 * **Il n'écrit jamais dans la vraie fiche.** Un titre jetable, porté par
 * `ATLAS_TITRE_FICHE`, et refermé à la fin quoi qu'il arrive — y compris en cas
 * d'échec, sans quoi une épreuve ratée laisserait des fiches ouvertes derrière
 * elle à chaque exécution.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { execFileSync } from "node:child_process";
import { extraireDepot, choisirFiche } from "./rapporter-espace.mjs";

// Un titre par exécution : deux épreuves lancées en même temps — deux branches,
// deux PR — ne doivent pas se disputer la même fiche et se déclarer en échec
// l'une à cause de l'autre.
const marque = process.env.GITHUB_RUN_ID || String(process.pid);
const TITRE = `« épreuve » publication de la fiche — ${marque}`;

// **Rien ne s'exécute à l'import.** `scripts/test-rapport-espace.ts` importe
// `numeroDepuisSortie` pour l'éprouver sans réseau ; un `process.exit(1)` posé
// au premier niveau tuerait la suite entière au lieu de rendre un verdict.
// C'est la même précaution qu'en bas de `rapporter-espace.mjs`, et elle est
// née de la même erreur.
let jeton = "";
let racine = "";
let entetes = {};

async function fichesOuvertes() {
  const r = await fetch(`${racine}?state=open&per_page=100`, { headers: entetes });
  if (!r.ok) throw new Error(`liste refusée (${r.status})`);
  return r.json();
}

function publier() {
  return execFileSync(process.execPath, ["scripts/rapporter-espace.mjs"], {
    encoding: "utf8",
    env: { ...process.env, ATLAS_TITRE_FICHE: TITRE },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

let echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${nom}`);
  } else {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${detail}`);
  }
}

/**
 * Le numéro de la fiche, lu dans ce que le script vient d'écrire.
 *
 * **Pris ICI plutôt que dans la liste, et c'est une leçon payée.** À la
 * première exécution en CI, la fiche a bien été créée — le script l'a dit — et
 * la liste demandée une seconde plus tard ne la contenait pas encore : GitHub
 * la sert depuis une réplique qui retarde. L'épreuve a donc conclu à un échec
 * ET laissé la fiche ouverte derrière elle, faute de savoir laquelle refermer.
 * La sortie du script, elle, ne retarde pas.
 */
export function numeroDepuisSortie(sortie) {
  const m = String(sortie ?? "").match(/issues\/(\d+)|mise à jour #(\d+)/);
  return m ? Number(m[1] ?? m[2]) : undefined;
}

/** Attendre que la réplique rattrape son retard, plutôt que de conclure trop tôt. */
async function attendreDansLaListe(titre, essais = 10) {
  for (let i = 0; i < essais; i++) {
    const fiches = await fichesOuvertes();
    const trouvee = choisirFiche(fiches, titre);
    if (trouvee) return { trouvee, fiches };
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { trouvee: undefined, fiches: await fichesOuvertes() };
}

async function main() {
  jeton = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  if (!jeton) {
    console.error("❌ Aucun GITHUB_TOKEN : cette épreuve exige un vrai jeton (CI, ou l'espace du patron).");
    return 1;
  }
  const cible = extraireDepot(execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }));
  if (!cible) {
    console.error("❌ Impossible de déduire le dépôt de l'adresse de `origin`.");
    return 1;
  }
  racine = `https://api.github.com/repos/${cible.proprietaire}/${cible.depot}/issues`;
  entetes = {
    Authorization: `Bearer ${jeton}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  let numero;
  try {
  console.log("=== La fiche d'état part-elle vraiment ? ===");

  const premier = publier();
  // Le numéro d'abord, l'assertion ensuite : ainsi le ménage est garanti même
  // si tout ce qui suit échoue.
  numero = numeroDepuisSortie(premier);
  verifier(
    "le premier passage CRÉE la fiche",
    Boolean(numero),
    `le script n'annonce aucune fiche.\n    Sortie du script :\n${premier}`
  );

  if (numero) {
    const { trouvee } = await attendreDansLaListe(TITRE);
    verifier(
      "la fiche créée finit par apparaître dans la liste",
      trouvee === numero,
      `la fiche #${numero} n'est pas listée après quinze secondes d'attente — ` +
        "le prochain passage en ouvrirait une seconde"
    );
  }

  if (numero) {
    const second = publier();
    const apres = await fichesOuvertes();
    const memes = apres.filter((f) => f.title === TITRE);

    verifier(
      "le second passage MET À JOUR au lieu d'en ouvrir une seconde",
      numeroDepuisSortie(second) === numero && memes.length <= 1,
      `le second passage annonce #${numeroDepuisSortie(second)} au lieu de #${numero}, ou ` +
        `${memes.length} fiches portent ce titre — le dépôt se remplirait d'une fiche par ` +
        `quart d'heure.\n    Sortie du script :\n${second}`
    );

    verifier(
      "la fiche porte bien l'état de la machine, pas une coquille vide",
      /Ce que l'espace dit de lui-même/.test(memes[0]?.body ?? ""),
      "le corps publié ne contient pas le diagnostic : la fiche serait illisible"
    );
  }
} catch (e) {
  echecs++;
  console.log(`  ✗ l'épreuve s'est interrompue : ${e.message}`);
} finally {
  // **Toujours refermer.** Une épreuve ratée qui laisse sa fiche ouverte en
  // ajoute une à chaque exécution, et noie la vraie fiche du patron dans le
  // bruit — l'inverse exact de ce qu'on protège ici.
  if (numero) {
    await fetch(`${racine}/${numero}`, {
      method: "PATCH",
      headers: entetes,
      body: JSON.stringify({ state: "closed" }),
    }).catch(() => {});
    console.log(`  · fiche d'épreuve #${numero} refermée.`);
  }
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Publication de la fiche — ${echecs} échec(s).`);
  return echecs === 0 ? 0 : 1;
}

// Importé par les tests, il ne doit rien publier de lui-même.
//
// Pas d'`await` au premier niveau : `tsx` transpile ce module en CommonJS
// quand une suite en TypeScript l'importe, et le refuse alors — la suite
// entière tombait sur une erreur de transformation, pas sur un verdict.
if (process.argv[1] && process.argv[1].endsWith("eprouver-publication-fiche.mjs")) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`❌ L'épreuve s'est interrompue : ${e?.message ?? e}`);
      process.exit(1);
    }
  );
}
