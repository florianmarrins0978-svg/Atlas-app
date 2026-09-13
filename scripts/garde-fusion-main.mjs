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
 *      `main` (`_niveau-de-risque.mjs`) ;
 *   2. il lit le témoin laissé par la dernière vérification verte ;
 *   3. il refuse si ce témoin manque, s'il est d'un niveau trop bas, ou s'il
 *      décrit un arbre qui n'est plus celui-ci.
 *
 * **Ce qu'il ne fait PAS**, et c'est délibéré : il ne dit rien des poussées sur
 * une branche de session — on y pousse pour mettre à l'abri, et gêner ce
 * geste-là ferait perdre du travail. Il ne dit rien non plus d'un lot qui ne
 * touche que des documents. Un garde-fou qui parle à tort s'apprend à être
 * ignoré, et l'on perd alors la protection sans s'en apercevoir.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { empreinteDeLArbre } from "./_empreinte-de-l-arbre.mjs";
import {
  FICHIER_VERDICT,
  commandeDuNiveau,
  niveauExige,
  poussseVersMain,
  verdictSuffit,
} from "./_niveau-de-risque.mjs";

const RACINE = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function git(...args) {
  try {
    return execFileSync("git", ["-C", RACINE, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/** Les chemins que ce lot ajoute à `main` — commités ET pas encore commités. */
export function cheminsDuLot() {
  const base = git("merge-base", "origin/main", "HEAD") ?? "origin/main";
  const commites = git("diff", "--name-only", `${base}...HEAD`) ?? "";
  const enCours = git("status", "--porcelain") ?? "";
  return [
    ...commites.split("\n"),
    ...enCours.split("\n").map((l) => l.slice(3)),
  ].filter(Boolean);
}

function lireVerdict() {
  if (!existsSync(FICHIER_VERDICT)) return null;
  try {
    return JSON.parse(readFileSync(FICHIER_VERDICT, "utf8"));
  } catch {
    // Un témoin illisible vaut un témoin absent : on ne parie pas dessus.
    return null;
  }
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

  const branche = git("rev-parse", "--abbrev-ref", "HEAD");
  if (!poussseVersMain(commande, branche)) process.exit(0);

  const chemins = cheminsDuLot();
  const niveau = niveauExige(chemins);
  if (niveau === 1) process.exit(0); // documents seuls : rien à éprouver.

  const { suffit, raison } = verdictSuffit(lireVerdict(), {
    niveau,
    empreinte: empreinteDeLArbre(RACINE),
  });
  if (suffit) process.exit(0);

  const touches = chemins.filter((c) => /^(src|drizzle)\//.test(c)).slice(0, 3);
  console.error(
    [
      `Poussée sur « main » refusée : ${raison}.`,
      "",
      `Ce lot est de NIVEAU ${niveau}${touches.length ? ` — il touche ${touches.join(", ")}${chemins.length > 3 ? "…" : ""}` : ""}.`,
      `Ce qu'il faut jouer, et qui doit être VERT :`,
      "",
      `    ${commandeDuNiveau(niveau)}`,
      "",
      "Le niveau se calcule sur ce que le lot touche, jamais sur ce qu'on en pense",
      "(.claude/rules/testing.md). Pousser sur la branche de session reste libre :",
      "c'est la fusion vers « main » qui attend d'être éprouvée.",
    ].join("\n")
  );
  process.exit(2);
});
