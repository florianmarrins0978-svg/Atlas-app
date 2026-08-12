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

/**
 * Le titre EXACT de la fiche : c'est lui qui évite d'en créer une par allumage.
 *
 * Détournable **uniquement pour l'éprouver** (`ATLAS_TITRE_FICHE`) : la
 * publication ne peut pas être jouée sur la machine de l'agent — son jeton est
 * un substitut du mandataire, pas un vrai jeton GitHub — et doit donc l'être en
 * CI, sur une fiche jetable qu'on referme aussitôt. Sans cette porte, la seule
 * façon d'éprouver serait d'écrire dans la vraie fiche du patron.
 */
export const TITRE_FICHE =
  process.env.ATLAS_TITRE_FICHE || "État du banc d'essai — publié par l'espace lui-même";

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

/**
 * De quel dépôt parle-t-on ? — déduit de l'adresse du dépôt distant.
 *
 * Les deux formes existent côte à côte sur la même machine : `git clone` par
 * HTTPS écrit `https://github.com/o/r.git`, un accès par clé écrit
 * `git@github.com:o/r.git`. N'en reconnaître qu'une, c'est marcher chez soi et
 * se taire chez le patron.
 */
export function extraireDepot(adresse) {
  const m = String(adresse ?? "")
    .trim()
    .match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?\/?$/);
  return m ? { proprietaire: m[1], depot: m[2] } : null;
}

/** Retrouve la fiche par son titre EXACT — une recherche approchante en créerait une seconde. */
export function choisirFiche(fiches, titre) {
  return (Array.isArray(fiches) ? fiches : []).find((f) => f?.title === titre)?.number;
}

/**
 * Publier SANS `gh`, avec le jeton que Codespaces pose déjà dans le terminal.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Écrit le 12 août 2026, après deux redémarrages pour rien.** Le patron
 * rallume son espace deux fois, et la fiche reste introuvable — parce que `gh`
 * n'est pas dans son conteneur. Il arrive par une fonctionnalité déclarée dans
 * `devcontainer.json`, or **une déclaration ne répare pas un espace déjà né**
 * (`ARCHITECTURE.md` §55). Le sien est plus ancien que la ligne : redémarrer
 * récupère le code, jamais les outils. C'est la quatrième fois que ce piège
 * coûte une soirée à ce dépôt.
 *
 * D'où ce chemin, qui ne dépend de rien : `GITHUB_TOKEN` est posé par
 * Codespaces dans chaque terminal, et l'API suffit. `gh` reste en second
 * recours — il porte son propre jeton là où la variable manque (une machine de
 * développement où l'on s'est authentifié à la main).
 * ───────────────────────────────────────────────────────────────────────────
 */
async function publierParHttp(corps, jeton) {
  let origine;
  try {
    origine = commande("git", ["remote", "get-url", "origin"]);
  } catch {
    return "sans-depot";
  }
  const cible = extraireDepot(origine);
  if (!cible) return "sans-depot";

  const racine = `https://api.github.com/repos/${cible.proprietaire}/${cible.depot}/issues`;
  const entetes = {
    Authorization: `Bearer ${jeton}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  const liste = await fetch(`${racine}?state=open&per_page=100`, { headers: entetes });
  if (!liste.ok) throw new Error(`liste des fiches refusée (${liste.status})`);
  const existante = choisirFiche(await liste.json(), TITRE_FICHE);

  const reponse = existante
    ? await fetch(`${racine}/${existante}`, {
        method: "PATCH",
        headers: entetes,
        body: JSON.stringify({ body: corps }),
      })
    : await fetch(racine, {
        method: "POST",
        headers: entetes,
        body: JSON.stringify({ title: TITRE_FICHE, body: corps }),
      });

  if (!reponse.ok) {
    throw new Error(`publication refusée (${reponse.status} ${reponse.statusText})`);
  }
  const fiche = await reponse.json();
  return existante ? `mise à jour #${existante}` : `créée : ${fiche.html_url}`;
}

/** Le second recours : `gh`, quand il est là et qu'aucun jeton n'est posé. */
function publierParGh(corps) {
  const trouvees = commande("gh", [
    "issue", "list", "--state", "open", "--limit", "50",
    "--search", TITRE_FICHE, "--json", "number,title",
  ]);
  const existante = choisirFiche(JSON.parse(trouvees), TITRE_FICHE);
  if (existante) {
    commande("gh", ["issue", "edit", String(existante), "--body-file", "-"], { input: corps });
    return `mise à jour #${existante}`;
  }
  const url = commande("gh", ["issue", "create", "--title", TITRE_FICHE, "--body-file", "-"], {
    input: corps,
  }).trim();
  return `créée : ${url}`;
}

async function main() {
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

  // Le jeton d'abord, `gh` ensuite. L'ordre compte : dans l'espace du patron,
  // le jeton est là et `gh` ne l'est pas — commencer par `gh` reviendrait à ne
  // rien publier chez la seule personne pour qui cette fiche existe.
  const jeton = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

  try {
    if (jeton) {
      const issue = await publierParHttp(corps, jeton);
      if (issue !== "sans-depot") {
        console.log(`✅ État publié — fiche ${issue}.`);
        return 0;
      }
    }
  } catch (e) {
    // On ne s'arrête pas là : `gh` peut réussir là où le jeton a été refusé
    // (un jeton d'espace aux droits restreints, par exemple).
    console.error(`⚠ Publication directe impossible : ${String(e.message).split("\n")[0]}`);
  }

  try {
    console.log(`✅ État publié — fiche ${publierParGh(corps)}.`);
  } catch (e) {
    console.error(`⚠ Rapport non publié : ${String(e.message).split("\n")[0]}`);
    console.error("  L'espace fonctionne normalement — seule la remontée vers l'agent manque.");
    console.error("  Sans GITHUB_TOKEN ni `gh`, il n'existe aucun chemin : voir CLAUDE.md §1 bis.");
  }
  return 0;
}

// Importé par les tests, il ne doit rien publier de lui-même.
if (process.argv[1] && process.argv[1].endsWith("rapporter-espace.mjs")) {
  main().then(
    (code) => process.exit(code),
    () => process.exit(0) // Jamais bloquant : voir l'en-tête.
  );
}
