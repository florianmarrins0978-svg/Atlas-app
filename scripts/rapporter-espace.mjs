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
import { createHash } from "node:crypto";
import { hostname } from "node:os";

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

/**
 * **Le journal de démarrage NE PART PAS. Décidé par le patron le 12 août 2026.**
 *
 * La première version recopiait les quarante dernières lignes du démarrage, en
 * censurant au jugé ce qui ressemblait à un secret. Puis un détail est apparu
 * qui change tout : **son dépôt est public.** Une fiche y est lisible par
 * n'importe qui, et indexée. Une censure faite au jugé laisse forcément passer
 * l'imprévu — le prix d'un oubli n'est plus une gêne, c'est une clé publiée sur
 * la place.
 *
 * Mis devant le choix, il a tranché : retirer le journal.
 *
 * **Ce qu'on y perd, et il faut le savoir avant de le regretter :** devant un
 * serveur qui refuse de démarrer, la fiche dira qu'il ne répond pas, pas
 * POURQUOI. Ce qui reste — branche suivie, commit récupéré, commit réellement
 * servi, services debout ou non — répond à la question qui a coûté le plus
 * cher : *sur quelle version est-il, et son serveur tourne-t-il ?*
 *
 * Si un jour il faut la cause exacte, la reprendre ainsi serait une erreur :
 * c'est une extraction STRUCTURÉE qu'il faudra écrire (le nom de l'erreur, pas
 * les lignes autour), pas un retour du journal brut.
 */

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

/**
 * À quel moment cette fiche a-t-elle été écrite ?
 *
 * **Sans cela, la fiche se lit de travers — vécu le 12 août 2026 au soir.** Le
 * patron signale « l'appli ne s'ouvre plus » ; sa fiche, fraîche de trois
 * minutes, dit « Serveur : NE RÉPOND PAS ». Alarmant — et pourtant normal :
 * c'était la publication de l'ALLUMAGE, écrite volontairement avant que le
 * serveur ait eu le temps de démarrer. Les mêmes mots, vingt minutes plus tard,
 * sont une panne. Rien ne permettait de distinguer les deux, et il a fallu
 * recouper des horodatages pour le comprendre.
 */
const MOMENTS = {
  allumage: "à l'allumage — **le serveur n'a pas encore eu le temps de démarrer**",
  demarre: "après démarrage — le serveur a répondu, ou a cessé d'être attendu",
  veille: "par le veilleur, au quart d'heure",
  main: "à la main",
};

/**
 * **Quel espace a écrit la fiche ?** — 8 novembre 2026. Son PC et son
 * téléphone ouvraient deux espaces, chacun avec sa base, et les deux
 * réécrivaient cette fiche tour à tour : une session a lu celle du PC en
 * croyant lire celle du téléphone, et cherché pourquoi Atlas était vide.
 *
 * **Une empreinte, jamais le nom.** Le port 3000 de l'espace est public
 * (`devcontainer.json`) et son adresse est « <nom>-3000.app.github.dev » ;
 * écrire le nom sur une fiche d'un dépôt public afficherait l'adresse de son
 * appli sur la place. Six caractères suffisent à distinguer ses espaces, et
 * ne ramènent pas au nom.
 */
export function empreinteEspace(nom) {
  const n = String(nom ?? "").trim();
  return n ? createHash("sha256").update(n).digest("hex").slice(0, 6) : null;
}

const UNE_HEURE_MS = 60 * 60 * 1000;
const COMMENTAIRE_ECRIVAINS = /<!-- ecrivains: (.*?) -->/;

/**
 * Les espaces qui ont écrit la fiche dans l'heure, le plus récent d'abord,
 * relus dans la fiche d'avant (un commentaire que la page ne montre pas).
 * Ce qui ne se lit pas comme une empreinte et une date ne compte pas : la
 * fiche est publique, et n'importe qui peut la modifier.
 */
export function ecrivainsRecents(corpsPrecedent, actuel) {
  const maintenant = Date.parse(actuel.quand);
  let anciens = [];
  try {
    const lu = JSON.parse(String(corpsPrecedent ?? "").match(COMMENTAIRE_ECRIVAINS)?.[1] ?? "[]");
    anciens = Array.isArray(lu) ? lu : [];
  } catch {
    anciens = [];
  }
  const valables = anciens.filter((e) => {
    const t = Date.parse(e?.quand);
    return typeof e?.espace === "string" && /^[0-9a-f]{6}$/.test(e.espace) && e.espace !== actuel.espace
      && Number.isFinite(t) && t <= maintenant && maintenant - t <= UNE_HEURE_MS;
  });
  const parEspace = new Map();
  for (const e of [actuel, ...valables.sort((a, b) => Date.parse(b.quand) - Date.parse(a.quand))]) {
    if (e.espace && !parEspace.has(e.espace)) parEspace.set(e.espace, { espace: e.espace, quand: e.quand });
  }
  return [...parEspace.values()];
}

/** « 14:00 UTC » : l'heure de chaque espace, sans la date, qui est celle d'au-dessus. */
const heure = (iso) => `${String(iso).slice(11, 16)} UTC`;

/** Le corps de la fiche. Rendu séparément pour être éprouvable sans réseau. */
export function corpsDuRapport({ diagnostic, quand, moment = "main", espace = null, ecrivains = [] }) {
  const plusieurs = ecrivains.length > 1;
  return [
    "> Fiche écrite automatiquement par l'espace de travail du patron, à chaque",
    "> allumage. Elle existe pour que l'agent voie sa machine sans avoir à lui",
    "> faire recopier un terminal depuis un téléphone. **Ne pas y répondre : elle",
    "> est réécrite entièrement à chaque publication.**",
    "",
    `**Dernière publication :** ${quand}`,
    `**Écrite :** ${MOMENTS[moment] ?? MOMENTS.main}`,
    `**Écrite par l'espace :** ${espace ?? "inconnu"}`,
    "",
    // Deux espaces dans l'heure : la fiche ne décrit que le dernier, et une
    // session qui l'ignore croit lire l'autre (le 8 novembre 2026).
    ...(plusieurs
      ? [
          `> **${ecrivains.length === 2 ? "Deux" : ecrivains.length} espaces écrivent cette fiche dans la dernière heure** :`,
          `> ${ecrivains.map((e) => `${e.espace} à ${heure(e.quand)}`).join(", ")}.`,
          `> **Elle ne décrit que le dernier :** ${ecrivains[0].espace}. Les autres ont chacun leur base.`,
          "",
        ]
      : []),
    // **La date EST un diagnostic, et c'est le plus rapide de tous.** Le
    // veilleur republie tous les quarts d'heure tant que l'espace tourne : une
    // fiche qui a vieilli ne dit pas « le serveur va mal », elle dit « la
    // machine entière est arrêtée ». Sans cette phrase, on cherche la panne
    // dans le produit alors qu'il n'y a plus personne pour la produire.
    "> **Regardez cette date AVANT tout le reste.** Le veilleur réécrit cette",
    "> fiche tous les quarts d'heure tant que l'espace tourne. Passé vingt",
    "> minutes sans réécriture, ce n'est pas le serveur qui est en panne : c'est",
    "> l'espace qui est **arrêté**, et il faut le rallumer depuis",
    "> github.com/codespaces.",
    "",
    "## Ce que l'espace dit de lui-même",
    "",
    "```",
    diagnostic.trim() || "(le diagnostic n'a rien rendu)",
    "```",
    "",
    "> Le journal de démarrage n'est **pas** publié ici : ce dépôt est public, et",
    "> une censure faite au jugé finirait par laisser passer l'imprévu. Voir",
    "> l'en-tête de `scripts/rapporter-espace.mjs`.",
    "",
    `<!-- ecrivains: ${JSON.stringify(ecrivains)} -->`,
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
async function publierParHttp(fabriquer, jeton) {
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

  const lister = async () => {
    const r = await fetch(`${racine}?state=open&per_page=100`, { headers: entetes });
    if (!r.ok) throw new Error(`liste des fiches refusée (${r.status})`);
    return choisirFiche(await r.json(), TITRE_FICHE);
  };

  // **On regarde DEUX fois avant de créer, et c'est un vrai défaut évité.**
  // Constaté en CI le 12 août 2026 : la fiche venait d'être créée, et la liste
  // renvoyée une seconde plus tard ne la contenait pas encore — GitHub sert
  // cette liste depuis une réplique, qui retarde. Créer sur ce silence
  // ouvrirait une SECONDE fiche, et le titre fixe ne servirait plus à rien.
  // Le démarrage publie justement deux fois à quelques secondes d'écart.
  let existante = await lister();
  if (!existante) {
    await new Promise((r) => setTimeout(r, 3000));
    existante = await lister();
  }

  // La fiche d'avant dit qui l'a écrite dans l'heure (`ecrivainsRecents`).
  let precedent = "";
  if (existante) {
    const r = await fetch(`${racine}/${existante}`, { headers: entetes });
    if (r.ok) precedent = (await r.json())?.body ?? "";
  }
  const corps = fabriquer(precedent);

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
function publierParGh(fabriquer) {
  const trouvees = commande("gh", [
    "issue", "list", "--state", "open", "--limit", "50",
    "--search", TITRE_FICHE, "--json", "number,title",
  ]);
  const existante = choisirFiche(JSON.parse(trouvees), TITRE_FICHE);
  const precedent = existante ? JSON.parse(commande("gh", ["issue", "view", String(existante), "--json", "body"])).body ?? "" : "";
  const corps = fabriquer(precedent);
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

  // La censure reste, alors même que le journal ne part plus : le diagnostic
  // recopie des noms de fichiers modifiés, et rien n'interdit qu'un jour l'un
  // d'eux porte un secret. Une ceinture ne se retire pas parce qu'on a mis des
  // bretelles — surtout sur un dépôt public.
  // L'heure vient du système : une fiche sans date ne dit pas si l'on
  // regarde l'état d'aujourd'hui ou celui d'avant-hier.
  const quand = new Date().toISOString();
  // Hors d'un espace GitHub (une machine de développement), le nom de la
  // machine ; dans les deux cas, son empreinte seule part (`empreinteEspace`).
  const espace = empreinteEspace(process.env.CODESPACE_NAME || hostname());
  const fabriquer = (precedent) =>
    expurger(
      corpsDuRapport({
        diagnostic,
        quand,
        // Posé par qui appelle : `demarrer.sh` distingue ses deux passages, le
        // veilleur se nomme, et un appel à la main ne prétend être ni l'un ni
        // l'autre.
        moment: process.env.ATLAS_MOMENT,
        espace,
        ecrivains: ecrivainsRecents(precedent, { espace, quand }),
      })
    );

  // Le jeton d'abord, `gh` ensuite. L'ordre compte : dans l'espace du patron,
  // le jeton est là et `gh` ne l'est pas — commencer par `gh` reviendrait à ne
  // rien publier chez la seule personne pour qui cette fiche existe.
  const jeton = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

  try {
    if (jeton) {
      const issue = await publierParHttp(fabriquer, jeton);
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
    console.log(`✅ État publié — fiche ${publierParGh(fabriquer)}.`);
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
