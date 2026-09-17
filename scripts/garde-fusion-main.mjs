#!/usr/bin/env node
/**
 * ON NE POUSSE PAS SUR `main` UN LOT QUI N'A PAS ÉTÉ ÉPROUVÉ.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Sa demande du 13 septembre 2026, au soir :** *« je veux notamment qu'une
 * session ne puisse pas considérer/fusionner une modification importante comme
 * terminée si les contrôles obligatoires correspondant à son niveau de risque
 * ont échoué »*.
 *
 * C'est une règle qui ne doit pas dépendre de l'obéissance du modèle : une
 * consigne en prose se lit au début d'une conversation et s'oublie au bout de
 * trois heures — or c'est au bout de trois heures qu'on livre (`CLAUDE.md`
 * §1 bis).
 *
 * **Ce qu'il fait, et rien de plus.** Devant une poussée vers `main` :
 *
 *   1. il calcule le niveau EXIGÉ par le lot, sur les chemins qui diffèrent de
 *      `main` — MAX(plancher, rayon, gravité), `_niveau-de-risque.mjs` ;
 *   2. il lit le témoin laissé par la dernière vérification ;
 *   3. il refuse si ce témoin manque, s'il est d'un niveau trop bas, ou s'il
 *      décrit un arbre qui n'est plus celui-ci ;
 *   4. **un témoin ROUGE n'ouvre la porte que si AUCUN de ses rouges n'est une
 *      régression nouvelle** — sa règle du 17 septembre 2026. La question est
 *      une seule : *ce lot introduit-il une nouvelle régression ?* Chaque suite
 *      rouge est rejouée sur une copie propre du commit de `main` d'où le lot
 *      part — celle-là seule, jamais la batterie entière
 *      (`verifier-rouge-prealable.ts`, `_rouge-prealable.mjs`). Déjà rouge
 *      là-bas : elle ne vient pas de ce lot, elle ne le bloque pas. Verte
 *      là-bas : c'est la régression, et la porte reste fermée.
 *
 *      **Ce qui a été retiré avec, et qui bloquait tout le monde :** l'état
 *      global de `main`, mesuré par une batterie entière sur un arbre propre.
 *      Tant qu'il manquait, le moindre rouge d'une autre session fermait la
 *      porte, et le seul remède coûtait trente à cinquante minutes — à
 *      repayer à chaque `main` qui avance. Une session n'attend plus qu'une
 *      autre répare son lot pour fusionner un changement sans rapport.
 *
 * **Ce qu'il ne fait PAS**, et c'est délibéré : il ne dit rien des poussées sur
 * une branche de session — on y pousse pour mettre à l'abri, et gêner ce
 * geste-là ferait perdre du travail. Il ne dit rien non plus d'un lot qui ne
 * touche que des documents. Un garde-fou qui parle à tort s'apprend à être
 * ignoré, et l'on perd alors la protection sans s'en apercevoir.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  FICHIER_VERDICT,
  cheminsDuLot,
  commandeDuNiveau,
  dossierDeLaCommande,
  evaluerLeLot,
  poussseVersMain,
  verdictSuffit,
} from "./_niveau-de-risque.mjs";
import { suitesDesRoutes } from "./_suites-ciblees.mjs";
import { baseDuLot, cheminDuTemoin } from "./_temoin-de-main.mjs";

// **Le dossier se décide par la commande, pas par la session** (sa règle du
// 17 septembre 2026, `dossierDeLaCommande`) : `git -C <dossier> push …` fait
// mesurer CE dossier-là — son diff, son verdict, son niveau. Posé quand la
// commande est lue, plus bas.
let RACINE = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function git(...args) {
  try {
    return execFileSync("git", ["-C", RACINE, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/**
 * CE QUE LA COMPARAISON CIBLÉE A DIT — suite par suite, pour CETTE base.
 *
 * Elle est écrite par `verifier-rouge-prealable.ts`, dans le `.git` commun :
 * elle décrit une machine, pas le dépôt. Absente, elle ne tolère rien.
 */
function lireLesReponses() {
  const temoin = cheminDuTemoin(RACINE);
  if (!temoin) return null;
  const chemin = path.join(path.dirname(temoin), "atlas-rouges-prealables.json");
  if (!existsSync(chemin)) return null;
  try {
    const brut = JSON.parse(readFileSync(chemin, "utf8"));
    if (typeof brut.base !== "string" || typeof brut.suites !== "object") return null;
    return { base: brut.base, suites: brut.suites };
  } catch {
    return null;
  }
}

function lireVerdict() {
  const chemin = path.join(RACINE, FICHIER_VERDICT);
  if (!existsSync(chemin)) return null;
  try {
    return JSON.parse(readFileSync(chemin, "utf8"));
  } catch {
    // Un témoin illisible vaut un témoin absent : on ne parie pas dessus.
    return null;
  }
}

/**
 * L'instant du fichier surveillé le plus récemment écrit.
 *
 * C'est ce qui dit « l'arbre a bougé depuis le verdict », sans recalculer une
 * empreinte : un hook doit rendre la main tout de suite, et une seconde façon
 * de comparer des fichiers finirait par diverger de `empreinteDesSources`.
 */
function derniereEcriture() {
  let plusRecent = 0;
  const parcourir = (dossier) => {
    let entrees;
    try {
      entrees = readdirSync(dossier, { withFileTypes: true });
    } catch {
      return; // un dépôt peut vivre sans `.devcontainer`
    }
    for (const entree of entrees) {
      if (["node_modules", ".git", ".next", "dist", "coverage"].includes(entree.name)) continue;
      const chemin = path.join(dossier, entree.name);
      if (entree.isDirectory()) {
        parcourir(chemin);
      } else if (/\.(ts|tsx|js|mjs|mts|sql|css|json|md)$/.test(entree.name)) {
        plusRecent = Math.max(plusRecent, statSync(chemin).mtimeMs);
      }
    }
  };
  for (const d of ["src", "scripts", "drizzle", ".claude", ".devcontainer"]) parcourir(path.join(RACINE, d));
  return plusRecent;
}

let entree = "";
process.stdin.on("data", (bloc) => (entree += bloc));
process.stdin.on("end", () => {
  let commande = "";
  try {
    commande = JSON.parse(entree)?.tool_input?.command ?? "";
  } catch {
    process.exit(0); // Rien de lisible : on ne gêne personne.
  }

  RACINE = dossierDeLaCommande(commande, RACINE);
  const branche = git("rev-parse", "--abbrev-ref", "HEAD");
  if (!poussseVersMain(commande, branche)) process.exit(0);

  const lot = evaluerLeLot(cheminsDuLot(RACINE), { racine: RACINE });
  if (lot.niveau === 1) process.exit(0); // documents seuls : rien à éprouver.

  const base = baseDuLot(RACINE);
  const { suffit, raison, toleres } = verdictSuffit(lireVerdict(), {
    niveau: lot.niveau,
    derniereEcriture: derniereEcriture(),
    reponses: lireLesReponses(),
    base,
  });
  if (suffit) {
    // Ce qu'on tolère se DIT : un rouge qui passe en silence redeviendrait
    // invisible, et c'est exactement la faute qu'on reproche à une liste.
    if (toleres.length > 0) {
      console.log(
        `Fusion ouverte avec ${toleres.length} rouge(s) déjà rouge(s) sur la base main ` +
          `${String(base).slice(0, 8)}, aucune régression nouvelle : ${toleres.join(", ")}`
      );
    }
    process.exit(0);
  }

  // **LA LIGNE QU'IL DEMANDE AVANT CHAQUE FUSION — 14 septembre 2026.** Elle
  // est ÉCRITE ICI, à partir du diff, et non recopiée par la session : une
  // annonce rédigée à la main redeviendrait un niveau déclaré.
  const annonce = [
    `Risque : ${lot.risque}`,
    `Niveau requis : ${lot.niveau}`,
    `Raison : ${lot.raison}`,
  ];
  if (lot.niveau === 2) {
    const suites = suitesDesRoutes(RACINE, lot.routes);
    annonce.push(
      `Contrôles exigés : ${commandeDuNiveau(2)}` +
        (suites.length ? `, dont les suites ${suites.join(", ")}` : "") +
        (lot.routes.length ? ` et les écrans ${lot.routes.join(", ")}` : "")
    );
  } else {
    annonce.push(`Contrôles exigés : ${commandeDuNiveau(lot.niveau)} (la batterie entière)`);
  }

  const décisifs = lot.motifs.filter((m) => m.niveau === lot.niveau).slice(0, 3);
  console.error(
    [
      `Poussée sur « main » refusée : ${raison}.`,
      "",
      ...annonce,
      "",
      "Ce qui a décidé du niveau :",
      ...décisifs.map((m) => `    • ${m.chemin} — ${m.pourquoi}`),
      "",
      `Ce qu'il faut jouer, et qui doit être VERT :`,
      "",
      `    ${commandeDuNiveau(lot.niveau)}`,
      "",
      // **Un rouge qui vient d'ailleurs ne se corrige pas en rejouant tout.**
      // Sa règle du 17 septembre : on rejoue les SEULS rouges sur la base de
      // `main`, et un rouge déjà là n'est pas de ce lot.
      ...(/ROUGE/.test(raison)
        ? [
            "Et si ce rouge vient d'ailleurs — d'une autre session, d'un autre lot —,",
            "il se compare sans rejouer la batterie de main :",
            "",
            "    npx tsx scripts/verifier-rouge-prealable.ts",
            "",
          ]
        : []),
      "Le niveau se CALCULE sur le diff — plancher, rayon d'impact, gravité —,",
      "jamais sur ce qu'on en pense (.claude/rules/testing.md). Pousser sur la",
      "branche de session reste libre : c'est la fusion vers « main » qui attend.",
    ].join("\n")
  );
  process.exit(2);
});
