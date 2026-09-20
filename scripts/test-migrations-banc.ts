import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { lireIssueMigrations } from "../src/lib/issue-mise-a-jour";
import { exigerLesOutils } from "./_outil-requis";

// **Sans ces outils, cette suite ne mesure RIEN** — elle le dit et sort du
// compte, au lieu de rougir sur une machine qui n'y est pour rien
// (`_outil-requis.ts`, sa colère du 20 septembre 2026).
exigerLesOutils("bash");

// **Le défaut du 9 août 2026 : une base restée en arrière, en silence.**
//
// Le patron met à jour son banc d'essai, lit « Mise à jour récupérée », ouvre
// le Planning — et l'écran tombe. Rien ne relie les deux.
//
// La cause tenait en une variable. Les deux chemins qui appliquent les
// migrations — le démarrage de l'espace et le bouton « Chercher les dernières
// corrections » — lançaient `npm run db:migrate` avec la variable ambiante
// `DATABASE_URL`, qui vaut `atlas_app` sur le banc : **le rôle applicatif, qui
// n'a délibérément aucun droit de créer une table**. La commande échouait sur
// « permission denied for schema public », et les deux appels avalaient
// l'échec — `|| true` d'un côté, `.catch(() => undefined)` de l'autre.
//
// Ce que cette suite tient, et qu'aucune autre ne pouvait voir :
//
//   1. **le bon rôle est choisi.** `DATABASE_ADMIN_URL` d'abord ;
//   2. **l'échec se DIT.** Une commande qui échoue en silence est pire qu'une
//      commande qui échoue : elle affirme ;
//   3. **les deux appelants passent par le même script.** Deux copies auraient
//      divergé, et l'une des deux serait restée sur le mauvais rôle.

const RACINE = path.join(__dirname, "..");
const SCRIPT = path.join(RACINE, ".devcontainer", "appliquer-migrations.sh");

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Joue le script avec l'environnement demandé, et rend sa dernière ligne. */
function jouer(env: Record<string, string | undefined>): string {
  const sortie = execFileSync("bash", [SCRIPT, RACINE], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 120_000,
  });
  return sortie.trim().split("\n").pop() ?? "";
}

console.log("=== Une base qui ne suit pas le code doit le DIRE ===");

cas("une adresse de base injoignable produit « échec », jamais le silence", () => {
  // **Le cœur du défaut.** Avant, ce cas rendait un code de sortie non nul que
  // l'appelant jetait. Le script rend maintenant une phrase, et c'est elle qui
  // remonte jusqu'à l'écran du patron.
  const ligne = jouer({
    DATABASE_ADMIN_URL: "postgresql://personne:rien@127.0.0.1:1/base_qui_nexiste_pas",
    DATABASE_URL: "postgresql://personne:rien@127.0.0.1:1/base_qui_nexiste_pas",
  });
  assert.match(ligne, /^échec/, `le script s'est tu au lieu d'annoncer la panne : « ${ligne} »`);
});

cas("le message nomme le coupable, il ne se contente pas de « échec »", () => {
  // Une erreur qui envoie chercher au mauvais endroit coûte plus cher que pas
  // d'erreur du tout (`AGENTS.md`). Le message doit porter ce que la base a
  // répondu, pas notre idée de ce qu'elle a répondu.
  const ligne = jouer({
    DATABASE_ADMIN_URL: "postgresql://personne:rien@127.0.0.1:1/base_qui_nexiste_pas",
    DATABASE_URL: "postgresql://personne:rien@127.0.0.1:1/base_qui_nexiste_pas",
  });
  assert.ok(
    ligne.length > "échec : ".length + 8,
    `le message ne dit rien d'exploitable : « ${ligne} »`
  );
});

cas("sans aucune adresse, le script le dit plutôt que de deviner", () => {
  const ligne = jouer({ DATABASE_ADMIN_URL: undefined, DATABASE_URL: undefined });
  assert.match(ligne, /^échec : aucune adresse/, `reçu : « ${ligne} »`);
});

cas("le VRAI défaut du banc est nommé : « permission denied for schema public »", () => {
  // **Le cas qui compte, joué pour de bon quand une base est là.**
  //
  // C'est exactement ce qui se passait sur le banc du patron : les migrations
  // lancées sous `atlas_app`, qui n'a aucun droit de DDL. Le premier jet du
  // script rendait « échec :   routine: 'aclcheck_error' » — le nom d'une
  // fonction interne de PostgreSQL, qui envoie chercher n'importe où. La vraie
  // phrase se trouvait douze lignes plus haut.
  const appliquee = process.env.DATABASE_URL;
  if (!appliquee || !/atlas_app/.test(appliquee)) {
    // **Jamais en silence.** Un contrôle sauté sans le dire se lit comme un
    // contrôle passé (`CLAUDE.md` §5).
    console.log("      (sauté : aucune base sous le rôle atlas_app dans DATABASE_URL)");
    return;
  }
  const ligne = jouer({ DATABASE_ADMIN_URL: appliquee });
  assert.match(ligne, /^échec/, `le rôle applicatif a été accepté : « ${ligne} »`);
  assert.match(
    ligne,
    /permission denied/i,
    `le message n'accuse pas le bon coupable, il enverra chercher ailleurs : « ${ligne} »`
  );
});

console.log("\n=== Le rôle propriétaire, et pas l'applicatif ===");

cas("le script préfère DATABASE_ADMIN_URL à DATABASE_URL", () => {
  // Lu dans le script plutôt qu'éprouvé par une migration réelle : on ne peut
  // pas distinguer les deux rôles sans une base montée avec les deux, et ce
  // contrôle doit tourner partout. L'ordre de la substitution suffit à le dire.
  const source = readFileSync(SCRIPT, "utf8");
  assert.match(
    source,
    /DATABASE_ADMIN_URL:-\$\{DATABASE_URL/,
    "le script ne prend plus le rôle propriétaire en premier : les migrations " +
      "retomberont sous atlas_app, qui n'a aucun droit de créer une table"
  );
});

cas("les deux appelants passent par CE script, aucun ne lance db:migrate seul", () => {
  // **La régression la plus probable** : quelqu'un rajoute un `npm run
  // db:migrate` quelque part « pour aller plus vite », et le mauvais rôle
  // revient par la fenêtre.
  const appelants = [
    path.join(RACINE, ".devcontainer", "demarrer.sh"),
    path.join(RACINE, "src", "app", "reglages", "actions.ts"),
  ];
  for (const fichier of appelants) {
    const source = readFileSync(fichier, "utf8");
    assert.ok(
      source.includes("appliquer-migrations.sh"),
      `${path.basename(fichier)} n'appelle pas le script commun`
    );
    // Les mentions en commentaire sont permises ; c'est l'appel qui ne l'est pas.
    const lignesDAppel = source
      .split("\n")
      .filter((l) => /db:migrate/.test(l))
      .filter((l) => !/^\s*(#|\/\/|\*)/.test(l.trim()));
    assert.deepEqual(
      lignesDAppel,
      [],
      `${path.basename(fichier)} relance db:migrate directement : ${lignesDAppel.join(" | ")}`
    );
  }
});

console.log("\n=== Et l'échec remonte jusqu'à l'écran ===");

cas("le démarrage affiche l'avertissement, il ne le range pas dans le journal", () => {
  const source = readFileSync(path.join(RACINE, ".devcontainer", "demarrer.sh"), "utf8");
  assert.match(
    source,
    /LA BASE N'A PAS SUIVI LE CODE/,
    "le démarrage ne prévient pas quand la base est restée en arrière"
  );
});

cas("le bouton de mise à jour ne dit plus « récupérée » quand la base a échoué", () => {
  const source = readFileSync(path.join(RACINE, "src", "app", "reglages", "actions.ts"), "utf8");
  assert.match(
    source,
    /LA BASE N'A PAS SUIVI/,
    "l'écran annonce un succès alors que la base est restée en arrière"
  );
});

console.log("\n=== Une base en retard se rattrape, même quand le code n'a pas bougé ===");

// **SA PANNE DU 13 SEPTEMBRE 2026.** « Planning » et « Terminés » tombés
// ensemble, « Chantiers » debout — le partage exact de ce que produit UNE
// colonne manquante : les deux premiers lisent l'entreprise entière
// (`getEntreprise`), la troisième non. Sa base était restée en arrière du code
// qu'elle servait, et rien ne pouvait plus la rattraper.
//
// La cause n'était pas le rôle (corrigé le 9 août) mais la CONDITION : les deux
// appelants ne migraient que lorsque le code venait de bouger. Une migration
// échouée — base pas encore levée, `node_modules` amputé — n'était donc jamais
// retentée : l'allumage suivant répondait « déjà à jour », et ne migrait pas.
//
// Ces deux contrôles se lisent dans la source, et c'est délibéré : éprouver la
// condition « pour de vrai » demanderait un espace Codespaces, une base vieille
// et un redémarrage. C'est la structure qui a menti ; c'est elle qu'on tient.

cas("le démarrage migre à CHAQUE allumage, pas seulement quand le code a bougé", () => {
  const source = readFileSync(path.join(RACINE, ".devcontainer", "demarrer.sh"), "utf8");
  const depart = source.indexOf('if [ "$MISE_A_JOUR" = "faite" ]; then');
  assert.notEqual(depart, -1, "le bloc « code neuf » a disparu du démarrage : ce contrôle ne mesure plus rien");
  const finDuBloc = source.indexOf("\nfi\n", depart);
  assert.notEqual(finDuBloc, -1, "le bloc « code neuf » ne se referme pas : ce contrôle ne mesure plus rien");
  const bloc = source.slice(depart, finDuBloc);
  assert.ok(
    !bloc.includes("appliquer-migrations.sh"),
    "les migrations sont de nouveau enfermées dans « le code vient de bouger » : " +
      "une migration échouée ne sera jamais retentée, et la base restera en arrière pour toujours"
  );
  assert.ok(
    source.includes("appliquer-migrations.sh"),
    "le démarrage ne migre plus du tout"
  );
});

cas("le bouton migre avant de regarder si le code a bougé", () => {
  const source = readFileSync(path.join(RACINE, "src", "app", "reglages", "actions.ts"), "utf8");
  // **On mesure des lignes de CODE, jamais le texte entier.** Le premier jet
  // cherchait les deux motifs dans la source brute : le pavé qui RACONTE la
  // panne cite `if (etat === "faite")` en toutes lettres, et le contrôle a
  // rougi sur son propre commentaire. Un contrôle qui accuse à tort coûte plus
  // cher que pas de contrôle (`AGENTS.md`).
  const estCommentaire = (l: string) => /^\s*(\/\/|\*|\/\*)/.test(l);
  const lignes = source.split("\n");
  const rang = (motif: RegExp) => lignes.findIndex((l) => motif.test(l) && !estCommentaire(l));

  const appel = rang(/appliquer-migrations\.sh/);
  const branche = rang(/if \(etat === "faite"\)/);
  assert.notEqual(appel, -1, "le bouton n'applique plus les migrations");
  assert.notEqual(branche, -1, "la branche « code neuf » a disparu : ce contrôle ne mesure plus rien");
  assert.ok(
    appel < branche,
    "le bouton ne rattrape la base que lorsqu'il a ramené du code neuf : devant un " +
      "écran tombé sur une base en retard, plus aucun geste ne la répare"
  );
});

cas("le script dit COMBIEN il a rattrapé, pour que la réparation se voie", () => {
  const source = readFileSync(SCRIPT, "utf8");
  assert.match(
    source,
    /rattrapée\(s\)/,
    "le script ne distingue plus « rien à faire » de « la base vient d'être remise " +
      "d'aplomb » : le patron lira « vous étiez déjà à jour » devant sa panne réparée"
  );
});

console.log("\n=== La lecture de son verdict ===");

cas("« faites » nu = rien à rattraper", () => {
  const issue = lireIssueMigrations("faites");
  assert.deepEqual(issue, { faites: true, rattrapees: 0 });
});

cas("« faites : 3 migration(s) rattrapée(s) » rend son compte", () => {
  const issue = lireIssueMigrations("faites : 3 migration(s) rattrapée(s)");
  assert.deepEqual(issue, { faites: true, rattrapees: 3 });
});

cas("un échec reste un échec, et garde sa raison", () => {
  const issue = lireIssueMigrations("échec : permission denied for schema public");
  assert.deepEqual(issue, { faites: false, raison: "permission denied for schema public" });
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Migrations du banc — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
