#!/usr/bin/env node
/**
 * L'espace du patron raconte son état là où l'agent sait lire.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande, le 12 août 2026 :** *« Faut trouver un moyen pour que tu aies
 * accès à mon espace, trouve. »*
 *
 * Il n'y en a pas, et il ne faut pas en fabriquer un. Aucun chemin réseau ne
 * relie la machine de l'agent à son Codespace, et la solution qui « marcherait »
 * — une boucle qui lit des ordres dans le dépôt et les exécute chez lui — serait
 * une porte dérobée sur une machine qui porte ses identifiants GitHub et ses
 * clés d'IA. Quiconque obtiendrait le dépôt commanderait son ordinateur.
 *
 * **Le sens inverse, lui, est sans danger : il pousse, l'agent lit.** Ce script
 * récolte l'état de l'espace et le publie sur une fiche GitHub dédiée, toujours
 * la même, mise à jour au lieu d'être multipliée. L'agent lit les fiches du
 * dépôt : il voit donc la machine du patron sans y toucher, et sans lui demander
 * de recopier quoi que ce soit depuis un téléphone — ce qui a coûté quatre
 * allers-retours dans la seule nuit du 11 au 12 août.
 *
 * **Ce qu'il ne publie JAMAIS.** Aucune variable d'environnement, aucune clé.
 * Le journal de démarrage est recopié, mais toute ligne qui ressemble à un
 * secret est remplacée par une mention — voir `expurger`, et
 * `scripts/test-rapport-espace.ts`, qui refuse qu'une clé passe.
 *
 * **Best-effort, et jamais bloquant.** Il traverse le réseau et dépend d'un
 * jeton. S'il échoue, le banc doit rester parfaitement utilisable : le patron
 * n'a pas à perdre sa journée parce qu'une fiche n'a pas pu s'écrire.
 *
 *   node scripts/rapporter-espace.mjs
 * ───────────────────────────────────────────────────────────────────────────
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

/** Le titre EXACT de la fiche : c'est lui qui évite d'en créer une par allumage. */
export const TITRE_FICHE = "État du banc d'essai — publié par l'espace lui-même";

const JOURNAL = process.env.ATLAS_JOURNAL ?? "/tmp/essai.log";
const LIGNES_DE_JOURNAL = 40;

/**
 * Retire d'un texte tout ce qui ressemble à un secret.
 *
 * **Volontairement grossier, et c'est un choix.** Une ligne innocente censurée
 * ne coûte qu'une gêne de lecture ; une clé publiée coûte une clé. On coupe donc
 * large, on ne cherche pas à être fin.
 *
 * Le mot de passe de démonstration (`demo1234`) est public — il est écrit dans
 * le dépôt et affiché à chaque démarrage. Le censurer rendrait le rapport
 * illisible sans rien protéger.
 */
export function expurger(texte) {
  const suspect =
    /(KEY|SECRET|TOKEN|PASSWORD|MOT_DE_PASSE|AUTH|DATABASE_URL|REDIS_URL|Bearer|ghp_|github_pat_)/i;
  return texte
    .split("\n")
    .map((ligne) => {
      if (!suspect.test(ligne)) return ligne;
      // La ligne du compte de démonstration n'a rien de secret et sert à lire.
      if (/demo@atlas\.local/.test(ligne) && !/=|:\s*\S{16,}/.test(ligne)) return ligne;
      return "    […] ligne retirée : elle pourrait contenir un secret";
    })
    .join("\n");
}

/** Le corps de la fiche. Rendu séparément pour être éprouvable sans réseau. */
export function corpsDuRapport({ diagnostic, journal, quand }) {
  return [
    "> Fiche écrite automatiquement par l'espace de travail du patron, à chaque",
    "> allumage. Elle existe pour que l'agent voie sa machine sans avoir à lui",
    "> faire recopier un terminal depuis un téléphone. **Ne pas y répondre : elle",
    "> est réécrite entièrement à chaque publication.**",
    "",
    `**Dernière publication :** ${quand}`,
    "",
    "## Ce que l'espace dit de lui-même",
    "",
    "```",
    diagnostic.trim() || "(le diagnostic n'a rien rendu)",
    "```",
    "",
    `## Les ${LIGNES_DE_JOURNAL} dernières lignes du démarrage`,
    "",
    "```",
    journal.trim() || "(aucun journal de démarrage)",
    "```",
  ].join("\n");
}

function commande(programme, args, options = {}) {
  return execFileSync(programme, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function main() {
  // Le diagnostic sort en code 1 quand il a trouvé quelque chose à signaler :
  // c'est justement le cas intéressant. On récupère sa sortie dans les deux cas.
  let diagnostic;
  try {
    diagnostic = commande("node", ["scripts/diagnostiquer-espace.mjs"]);
  } catch (e) {
    diagnostic = `${e.stdout ?? ""}${e.stderr ?? ""}` || `(diagnostic impossible : ${e.message})`;
  }

  const journal = existsSync(JOURNAL)
    ? readFileSync(JOURNAL, "utf8").split("\n").slice(-LIGNES_DE_JOURNAL).join("\n")
    : "";

  const corps = expurger(
    corpsDuRapport({
      diagnostic,
      journal,
      // L'heure vient du système : une fiche sans date ne dit pas si l'on
      // regarde l'état d'aujourd'hui ou celui d'avant-hier.
      quand: new Date().toISOString(),
    })
  );

  // `gh` est installé dans l'espace (voir `.devcontainer/devcontainer.json`) et
  // y trouve son jeton tout seul. Ailleurs — la machine de l'agent, la CI — il
  // peut manquer : on le dit et on s'arrête sans bruit.
  let existante;
  try {
    const trouvees = commande("gh", [
      "issue", "list", "--state", "open", "--limit", "50",
      "--search", TITRE_FICHE, "--json", "number,title",
    ]);
    existante = JSON.parse(trouvees).find((f) => f.title === TITRE_FICHE)?.number;
  } catch (e) {
    console.error(`⚠ Rapport non publié : ${String(e.message).split("\n")[0]}`);
    console.error("  L'espace fonctionne normalement — seule la remontée vers l'agent manque.");
    return 0;
  }

  try {
    if (existante) {
      commande("gh", ["issue", "edit", String(existante), "--body-file", "-"], { input: corps });
      console.log(`✅ État publié sur la fiche #${existante}.`);
    } else {
      const url = commande("gh", [
        "issue", "create", "--title", TITRE_FICHE, "--body-file", "-",
      ], { input: corps }).trim();
      console.log(`✅ Fiche créée : ${url}`);
    }
  } catch (e) {
    console.error(`⚠ Rapport non publié : ${String(e.message).split("\n")[0]}`);
    console.error("  L'espace fonctionne normalement — seule la remontée vers l'agent manque.");
  }
  return 0;
}

// Importé par les tests, il ne doit rien publier de lui-même.
if (process.argv[1] && process.argv[1].endsWith("rapporter-espace.mjs")) {
  process.exit(main());
}
