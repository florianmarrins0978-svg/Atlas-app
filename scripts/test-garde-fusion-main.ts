import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FICHIER_VERDICT, commandeDuNiveau, niveauExige, poussseVersMain, verdictSuffit } from "./_niveau-de-risque.mjs";

/**
 * **LE GARDE-FOU QUI NE DÉPEND PAS DE LA MÉMOIRE DE LA SESSION.**
 *
 * Sa demande du 13 septembre 2026 : une session ne doit pas pouvoir fusionner
 * un lot dont les contrôles de son niveau de risque ont échoué. Une consigne en
 * prose s'oublie au bout de trois heures — or c'est à ce moment-là qu'on livre.
 *
 * Cette suite montre au garde-fou **autant de gestes à laisser passer qu'à
 * refuser** : un garde-fou qui parle à tort s'apprend à être ignoré, et l'on
 * perd alors la protection sans s'en apercevoir (`CLAUDE.md` §1 bis).
 */

const RACINE = path.join(__dirname, "..");
const HOOK = path.join(__dirname, "garde-fusion-main.mjs");

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

/** Joue le hook avec une commande, et rend ce qu'il a décidé. */
function jouer(commande: string): { refuse: boolean; message: string } {
  try {
    execFileSync("node", [HOOK], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command: commande } }),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: RACINE },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { refuse: false, message: "" };
  } catch (e) {
    const erreur = e as { status?: number; stderr?: string };
    return { refuse: erreur.status === 2, message: erreur.stderr ?? "" };
  }
}

console.log("=== Le niveau se calcule sur ce que le lot touche ===");

cas("un écran ou une règle → niveau 3", () => {
  assert.equal(niveauExige(["src/app/planning/page.tsx"]), 3);
  assert.equal(niveauExige(["drizzle/0091_quelque_chose.sql"]), 3);
  assert.equal(niveauExige(["docs/a.md", "src/lib/euros.ts"]), 3, "un seul fichier du produit suffit");
});

cas("l'outillage → niveau 2", () => {
  assert.equal(niveauExige(["scripts/test-x.ts"]), 2);
  assert.equal(niveauExige([".claude/rules/testing.md"]), 2);
  assert.equal(niveauExige([".devcontainer/demarrer.sh"]), 2);
});

cas("ce qui ne s'exécute pas → niveau 1", () => {
  assert.equal(niveauExige(["docs/rapport.md", "appli/essais.html", "CHANGELOG.md"]), 1);
});

cas("et chaque niveau nomme SA commande", () => {
  assert.equal(commandeDuNiveau(3), "npm run verifier:avant-livraison");
  assert.equal(commandeDuNiveau(2), "npm run verifier:avant-fusion");
  assert.equal(commandeDuNiveau(1), null);
});

console.log("\n=== Ce qui est visé, et ce qui ne l'est pas ===");

cas("les trois façons de pousser sur main sont vues", () => {
  assert.ok(poussseVersMain("git push origin ma-branche:main", "ma-branche"));
  assert.ok(poussseVersMain("git push origin main", "autre"));
  assert.ok(poussseVersMain("git push", "main"));
});

cas("une poussée sur SA branche passe — on y met son travail à l'abri", () => {
  assert.ok(!poussseVersMain("git push -u origin claude/mon-lot", "claude/mon-lot"));
  assert.ok(!poussseVersMain("git push", "claude/mon-lot"));
});

cas("et tout le reste passe : lire, commiter, fusionner en local", () => {
  for (const commande of [
    "git status",
    "git commit -m 'un message qui parle de git push origin main'",
    "git merge origin/main",
    "npm test",
    "git fetch origin main",
  ]) {
    assert.ok(!poussseVersMain(commande, "claude/mon-lot"), `refusé à tort : ${commande}`);
  }
});

console.log("\n=== Le verdict doit être VERT, au bon niveau, sur CET arbre ===");

const VERT_3 = { quand: 2_000, vert: true, niveau: 3 };

cas("aucune vérification jouée : refus", () => {
  const { suffit, raison } = verdictSuffit(null, { niveau: 3, derniereEcriture: 1_000 });
  assert.equal(suffit, false);
  assert.match(raison, /aucune vérification/);
});

cas("une vérification ROUGE ne vaut pas une vérification", () => {
  // Un rouge qu'on laisse derrière soi ne doit pas ouvrir la fusion : c'est
  // exactement ce que le patron a demandé le 13 septembre.
  const { suffit, raison } = verdictSuffit({ ...VERT_3, vert: false }, { niveau: 3, derniereEcriture: 1_000 });
  assert.equal(suffit, false);
  assert.match(raison, /ROUGE/);
});

cas("un fichier touché APRÈS le verdict : refus", () => {
  const { suffit, raison } = verdictSuffit(VERT_3, { niveau: 3, derniereEcriture: 9_000 });
  assert.equal(suffit, false);
  assert.match(raison, /l'arbre a changé/);
});

cas("un niveau 2 ne suffit pas pour un lot de niveau 3", () => {
  const { suffit, raison } = verdictSuffit({ ...VERT_3, niveau: 2 }, { niveau: 3, derniereEcriture: 1_000 });
  assert.equal(suffit, false);
  assert.match(raison, /niveau 2/);
});

cas("une trace d'AVANT le champ « niveau » ne suffit pas non plus", () => {
  const { suffit } = verdictSuffit({ quand: 2_000, vert: true }, { niveau: 2, derniereEcriture: 1_000 });
  assert.equal(suffit, false, "un verdict sans niveau a été pris pour suffisant");
});

cas("le bon niveau sur un arbre inchangé passe", () => {
  assert.equal(verdictSuffit(VERT_3, { niveau: 3, derniereEcriture: 1_000 }).suffit, true);
  assert.equal(verdictSuffit(VERT_3, { niveau: 2, derniereEcriture: 1_000 }).suffit, true);
});

console.log("\n=== Le hook, joué pour de vrai ===");

const TEMOIN = path.join(RACINE, FICHIER_VERDICT);
const SAUVEGARDE = `${TEMOIN}.epreuve`;
const avaitUnVerdict = existsSync(TEMOIN);
if (avaitUnVerdict) renameSync(TEMOIN, SAUVEGARDE);

try {
  cas("sans verdict, une poussée sur main est REFUSÉE, et le refus dit quoi faire", () => {
    rmSync(TEMOIN, { force: true });
    const { refuse, message } = jouer("git push origin claude/mon-lot:main");
    assert.ok(refuse, "le hook a laissé passer une fusion non éprouvée");
    assert.match(message, /verifier:avant-(fusion|livraison)/, "le refus ne dit pas la commande à jouer");
    assert.match(message, /NIVEAU [23]/, "le refus ne dit pas le niveau exigé");
  });

  cas("une poussée sur la branche de session passe, même sans verdict", () => {
    rmSync(TEMOIN, { force: true });
    assert.equal(jouer("git push -u origin claude/mon-lot").refuse, false);
  });

  cas("avec le verdict de CET arbre au bon niveau, la fusion passe", () => {
    // Un verdict vert de niveau 3, postérieur à tout ce que l'arbre porte.
    writeFileSync(TEMOIN, JSON.stringify({ quand: Date.now() + 60_000, vert: true, niveau: 3, empreinte: [] }));
    assert.equal(jouer("git push origin claude/mon-lot:main").refuse, false);
  });

  cas("un verdict d'un autre arbre ne suffit plus", () => {
    // Le même, mais rendu AVANT le dernier fichier écrit : l'arbre a bougé.
    writeFileSync(TEMOIN, JSON.stringify({ quand: 1_000, vert: true, niveau: 3, empreinte: [] }));
    const { refuse, message } = jouer("git push origin claude/mon-lot:main");
    assert.ok(refuse, "un verdict périmé a été accepté");
    assert.match(message, /l'arbre a changé/);
  });

  cas("les deux commandes de vérification déposent bien ce témoin", () => {
    // Ce qui n'est pas MONTÉ ne sert à rien (la leçon du 28 août).
    for (const fichier of ["verifier-avant-livraison.ts", "verifier-avant-fusion.ts"]) {
      const source = readFileSync(path.join(__dirname, fichier), "utf8");
      assert.match(
        source,
        /ecrireDernierVerdict\(/,
        `${fichier} ne dépose aucun témoin : le garde-fou refusera toujours`
      );
      assert.match(source, /niveau: [23]/, `${fichier} ne dit pas à quel niveau il a mesuré`);
    }
  });
} finally {
  rmSync(TEMOIN, { force: true });
  if (avaitUnVerdict) renameSync(SAUVEGARDE, TEMOIN);
}

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le garde-fou de la fusion — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
