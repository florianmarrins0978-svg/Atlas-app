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

const jeton = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
if (!jeton) {
  console.error("❌ Aucun GITHUB_TOKEN : cette épreuve exige un vrai jeton (CI, ou l'espace du patron).");
  process.exit(1);
}

const cible = extraireDepot(execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }));
if (!cible) {
  console.error("❌ Impossible de déduire le dépôt de l'adresse de `origin`.");
  process.exit(1);
}

// Un titre par exécution : deux épreuves lancées en même temps — deux branches,
// deux PR — ne doivent pas se disputer la même fiche et se déclarer en échec
// l'une à cause de l'autre.
const marque = process.env.GITHUB_RUN_ID || String(process.pid);
const TITRE = `« épreuve » publication de la fiche — ${marque}`;

const racine = `https://api.github.com/repos/${cible.proprietaire}/${cible.depot}/issues`;
const entetes = {
  Authorization: `Bearer ${jeton}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};

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

let numero;
try {
  console.log("=== La fiche d'état part-elle vraiment ? ===");

  const premier = publier();
  const fiches = await fichesOuvertes();
  numero = choisirFiche(fiches, TITRE);
  verifier(
    "le premier passage CRÉE la fiche",
    Boolean(numero),
    `aucune fiche « ${TITRE} » après publication.\n    Sortie du script :\n${premier}`
  );

  if (numero) {
    const second = publier();
    const apres = await fichesOuvertes();
    const memes = apres.filter((f) => f.title === TITRE);

    verifier(
      "le second passage MET À JOUR au lieu d'en ouvrir une seconde",
      memes.length === 1 && memes[0].number === numero,
      `${memes.length} fiche(s) portent ce titre — le dépôt se remplirait d'une fiche par ` +
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
process.exit(echecs === 0 ? 0 : 1);
