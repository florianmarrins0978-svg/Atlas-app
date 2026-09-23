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
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FICHIER_VERDICT,
  cheminsDuLot,
  commandeDuNiveau,
  dossierDeLaCommande,
  evaluerLeLot,
  poussseVersMain,
  verdictSuffit,
} from "./_niveau-de-risque.mjs";
import { empreinteDesSources, fichiersRemues } from "./_empreinte-des-sources.mjs";
import { suitesDesRoutes } from "./_suites-ciblees.mjs";
import { baseDuLot, cheminDuTemoin } from "./_temoin-de-main.mjs";
import { fautesDuFichier, fichierQuiSAffiche, CE_QUI_REMPLACE } from "./_tirets.mjs";

/**
 * Les tirets qu'un lot emmènerait sur « main », quel que soit son niveau.
 *
 * **Sa question du 23 septembre 2026 :** *« mais si dans la maquette il met
 * des tirets n'importe où, quand il va pousser sur main il va pousser avec
 * les tirets ? Donc c'est pas bon. »* Il avait raison, et c'était un trou
 * entier : une maquette est INERTE (`_niveau-de-risque.mjs`), donc un lot qui
 * n'en touche que est de niveau 1 et ne joue RIEN. Le contrôle de la batterie
 * ne le voyait donc jamais.
 *
 * Il lit les fichiers du lot, et eux seuls : moins d'une seconde, et il refuse
 * avant que la phrase parte chez lui (`ARCHITECTURE.md` §410).
 */
export function tiretsDuLot(racine, fichiers) {
  const trouves = [];
  for (const chemin of fichiers) {
    if (!fichierQuiSAffiche(chemin)) continue;
    const entier = path.join(racine, chemin);
    if (!existsSync(entier)) continue; // un fichier supprimé n'affiche plus rien.
    for (const f of fautesDuFichier(chemin, readFileSync(entier, "utf8"))) {
      trouves.push(`${chemin}:${f.ligne}  ${f.texte.slice(0, 90)}`);
    }
  }
  return trouves;
}

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
 * CE QUI A BOUGÉ DANS L'ARBRE DEPUIS LE VERDICT — par le CONTENU, jamais par la date.
 *
 * **C'est la correction du 17 septembre 2026** (`_niveau-de-risque.mjs`,
 * `verdictSuffit`). Ce qui vivait ici relevait la date d'écriture la plus
 * récente : une fusion réécrit ce qu'elle apporte, donc toute avancée de `main`
 * périmait le verdict d'un lot vert et réclamait cinquante minutes de batterie.
 *
 * Le relevé est celui de la batterie, et il n'y en a qu'un — 1 406 fichiers en
 * 65 ms, mesuré : un hook peut se le permettre, et deux façons de dire « ce
 * fichier a changé » finiraient par se contredire (`CLAUDE.md` §3).
 *
 * **Un verdict sans empreinte ne se compare pas** : on rend `null`, et
 * `verdictSuffit` remesure. Ne pas savoir n'est jamais « rien n'a bougé ».
 */
function cequiABouge(verdict) {
  if (!Array.isArray(verdict?.empreinte)) return null;
  try {
    return fichiersRemues(new Map(verdict.empreinte), empreinteDesSources(RACINE));
  } catch {
    return null;
  }
}

// **Il ne lit l'entrée standard que quand il EST le geste** — même contrat que
// les autres déclencheurs du dépôt. Sans cette porte, une suite qui importe sa
// décision (`tiretsDuLot`) attendait une entrée qui ne venait jamais, et
// restait pendue : un contrôle qui ne rend pas la main ne prouve rien.
const APPELE_DIRECTEMENT =
  Boolean(process.argv[1]) && process.argv[1].replace(/\\/g, "/").endsWith("garde-fusion-main.mjs");

let entree = "";
if (APPELE_DIRECTEMENT) {
process.stdin.on("data", (bloc) => (entree += bloc));
process.stdin.on("end", () => {
  let commande = "";
  try {
    commande = JSON.parse(entree)?.tool_input?.command ?? "";
  } catch {
    process.exit(0); // Rien de lisible : on ne gêne personne.
  }

  const dossierDeLaSession = RACINE;
  RACINE = dossierDeLaCommande(commande, RACINE);
  const branche = git("rev-parse", "--abbrev-ref", "HEAD");
  if (!poussseVersMain(commande, branche)) process.exit(0);

  // ─── LE GARDE-FOU DU DOSSIER VISÉ, PAS CELUI DE LA SESSION — 21 sept. 2026 ──
  //
  // `.claude/settings.json` lance CE fichier depuis le dossier où la session a
  // été ouverte. Or la commande vise un autre dossier — celui du lot —, et
  // c'est lui que le garde-fou mesure. Quand la session vit dans un dossier en
  // retard, c'est un garde-fou d'hier qui juge un verdict d'aujourd'hui : il a
  // refusé un lot vert, sans régression nouvelle, parce qu'il ne savait pas
  // encore lire l'empreinte que le lot écrit. Le garde-fou qui mesure un
  // dossier doit donc être le sien. On délègue, une fois, et l'on rend son
  // verdict tel quel ; là-bas, session et dossier coïncident, donc pas de
  // seconde délégation.
  const gardeDuDossierVise = path.join(RACINE, "scripts", "garde-fusion-main.mjs");
  const ceFichier = fileURLToPath(import.meta.url);
  if (
    path.resolve(RACINE) !== path.resolve(dossierDeLaSession) &&
    existsSync(gardeDuDossierVise) &&
    path.resolve(gardeDuDossierVise) !== path.resolve(ceFichier)
  ) {
    const delegue = spawnSync(process.execPath, [gardeDuDossierVise], {
      input: entree,
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: RACINE },
    });
    if (delegue.stdout) process.stdout.write(delegue.stdout);
    if (delegue.stderr) process.stderr.write(delegue.stderr);
    /* **UN DÉLÉGUÉ QUI PLANTE FERME LA PORTE — 23 septembre 2026.**
       `?? 2` ne couvrait que le cas où le processus n'a pas de code du tout.
       Or un garde-fou qui tombe rend **1**, et 1 se lit « rien à signaler » :
       la poussée passait. C'est arrivé le jour même, et pour une raison
       ordinaire — le dossier de session n'avait pas ses `node_modules`, donc
       l'import de `typescript` par la lecture des tirets échouait. Un dossier
       fraîchement préparé ouvrait ainsi `main` en grand.
       Seuls deux codes veulent dire quelque chose : 0 (rien à signaler) et
       2 (refus). Tout le reste, c'est « on ne sait pas » — et ne pas savoir
       n'est jamais vert (`CLAUDE.md` §5). */
    const rendu = delegue.status;
    if (rendu !== 0 && rendu !== 2) {
      console.error(
        [
          "❌ Poussée sur « main » refusée : le garde-fou du dossier visé n'a pas pu rendre de verdict.",
          "",
          `   ${gardeDuDossierVise}`,
          `   (code ${rendu === null || rendu === undefined ? "aucun" : rendu})`,
          "",
          "   La cause la plus fréquente : ce dossier n'a pas ses dépendances.",
          "   Depuis ce dossier :  npm ci",
          "",
          "   Ne pas savoir ce qu'on pousse n'est jamais une raison d'ouvrir.",
        ].join("\n")
      );
      process.exit(2);
    }
    process.exit(rendu);
  }

  // **UN DOSSIER QU'ON NE SAIT PAS LIRE FERME LA PORTE — 18 septembre 2026.**
  // Un lot de niveau 3 est passé parce que le dossier visé n'existait pas
  // (`/c/Users/…` lu comme `C:\c\Users\…`) : sans dépôt, rien à mesurer, et
  // « rien » se lisait « niveau 1 ». Ne pas savoir ce qu'on pousse n'est
  // jamais une raison d'ouvrir (`CLAUDE.md` §5 : un contrôle qui mesure zéro
  // ne mesure rien).
  if (git("rev-parse", "--show-toplevel") === null) {
    console.error(
      [
        `❌ Poussée vers « main » refusée : le dossier visé n'est pas un dépôt lisible.`,
        `   ${RACINE}`,
        "",
        "Le garde-fou mesure le dossier que la commande désigne (`git -C <dossier>`),",
        "et il ne peut rien mesurer là. Sous Windows, écrire le chemin en natif :",
        '    git -C "C:/Users/…/le-dossier" push origin HEAD:main',
      ].join("\n")
    );
    process.exit(2);
  }

  const fichiersDuLot = cheminsDuLot(RACINE);

  // Aucun tiret ne passe vers « main », quel que soit le niveau du lot.
  const tirets = tiretsDuLot(RACINE, fichiersDuLot);
  if (tirets.length > 0) {
    console.error(
      [
        `❌ Poussée sur « main » refusée : ${tirets.length} tiret(s) au milieu d'une phrase.`,
        "",
        ...tirets.slice(0, 12).map((t) => `   ${t}`),
        tirets.length > 12 ? `   … et ${tirets.length - 12} autre(s)` : "",
        "",
        "Sa règle du 22 septembre 2026 : des phrases normales, pas de tiret en",
        "plein milieu. Ce qui se met à la place, selon ce que la phrase fait :",
        CE_QUI_REMPLACE,
        "",
        "Pour les voir tous : npx tsx scripts/test-aucun-tiret.ts",
      ]
        .filter(Boolean)
        .join("\n")
    );
    process.exit(2);
  }

  const lot = evaluerLeLot(fichiersDuLot, { racine: RACINE });
  if (lot.niveau === 1) process.exit(0); // documents seuls : rien d'autre à éprouver.

  const base = baseDuLot(RACINE);
  const verdict = lireVerdict();
  // **`main` a-t-il vraiment avancé depuis la mesure ?** Sans cette question,
  // un fichier remué qui n'appartient pas au lot — un fichier ignoré de git,
  // par exemple — serait mis sur le dos de la fusion, et l'on renverrait vers
  // un complément qui refuserait à son tour. Un refus qui renvoie à un refus
  // est la boucle qu'on vient de retirer.
  const mainABouge = Boolean(
    verdict?.commit && base && git("merge-base", "origin/main", verdict.commit) !== base
  );
  const remues = cequiABouge(verdict);
  const { suffit, raison, toleres, remede } = verdictSuffit(verdict, {
    niveau: lot.niveau,
    // `null` — un verdict d'avant l'empreinte — vaut « on ne sait pas » : le
    // lot passe alors pour inconnu, et l'on remesure. Jamais l'inverse.
    remues: remues ?? ["l'empreinte de la vérification manque"],
    fichiersDuLot: remues ? fichiersDuLot : null,
    mainABouge,
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
  // ─── `main` A AVANCÉ SOUS UN LOT DÉJÀ VERT : CE N'EST PAS UNE BATTERIE ────
  //
  // **Sa colère du 17 septembre 2026 :** *« les sessions rejouent des batteries
  // en boucle juste parce qu'une a touché un fichier »*. Le lot n'a pas bougé
  // d'une ligne ; ce qui a bougé est arrivé de `main`, et chacun de ces commits
  // est passé par son propre garde-fou. Ce qui n'a jamais été mesuré, c'est la
  // RENCONTRE des deux — elle se joue en une minute, et le plus souvent elle
  // est vide. Annoncer la batterie ici, c'était cinquante minutes pour rien, à
  // repayer à chaque fois qu'une session voisine fusionne.
  if (remede === "complement") {
    console.error(
      [
        `Poussée sur « main » refusée : ${raison}.`,
        "",
        ...annonce,
        "",
        "Le lot garde son verdict : il n'y a PAS de batterie à rejouer.",
        "Ce qui n'a jamais été mesuré, c'est la rencontre entre ce lot et ce que",
        "« main » a apporté. Elle se joue en une minute, et se repose toute seule :",
        "",
        "    npx tsx scripts/verifier-ce-qui-a-bouge.ts",
        "",
        "Sans rencontre, il repose le verdict tel quel et la fusion s'ouvre.",
        "Avec rencontre, il rejoue CES fichiers-là, et rien d'autre.",
      ].join("\n")
    );
    process.exit(2);
  }
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
      // **UN ROUGE NE COÛTE PLUS LA MESURE ENTIÈRE — 17 septembre 2026, 23 h.**
      // Sa colère : *« ça recommence et c'est ça à chaque fois ! »*, devant une
      // session qui repartait pour cinquante minutes après avoir corrigé une
      // ligne de documentation. Une étape hors suites — Types, Lint, Mémoire du
      // dépôt — n'avait aucun moyen de redevenir verte autrement.
      ...(/ROUGE/.test(raison)
        ? [
            "Un rouge se rejoue SEUL, avec ce que la correction peut casser :",
            "",
            "    npx tsx scripts/verifier-ce-qui-a-bouge.ts",
            "",
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
}
