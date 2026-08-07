import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// **« La mise à jour n'a pas abouti. Redémarrez l'espace de travail. »**
//
// Le patron a lu cette phrase le 7 août 2026, et elle accusait le mauvais
// coupable. Tirer le code neuf remplace des centaines de fichiers SOUS le
// serveur en train de tourner : il se recompile aussitôt, et la réponse en
// cours de route est coupée. Le navigateur ne reçoit donc rien — y compris
// quand la mise à jour a parfaitement réussi. Il est reparti redémarrer un
// espace qui n'en avait aucun besoin.
//
// Deux choses tenues ici, et aucune ne se voyait avant :
//
//   1. **l'issue survit à la réponse.** Elle est déposée dans un fichier avant
//      que quoi que ce soit puisse couper la connexion, et l'écran la relit au
//      rendu suivant ;
//   2. **elle n'est jamais déposée dans le dépôt.** Un fichier à la racine
//      rendrait l'arbre git sale, et `mettre-a-jour.sh` refuserait alors TOUTES
//      les mises à jour suivantes : le remède aurait créé la panne, pour de
//      bon.
//
// Le point 2 se démontre sur un vrai dépôt git, pas en lisant le code.

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

const SOURCE = readFileSync(new URL("../src/app/reglages/actions.ts", import.meta.url), "utf8");

console.log("=== L'issue de la mise à jour survit à la réponse coupée ===");

cas("l'issue est écrite dans un fichier, pas seulement rendue à l'appelant", () => {
  assert.match(
    SOURCE,
    /noterIssue\(/,
    "Rien n'est déposé hors de la réponse : une réponse coupée efface l'issue, et l'écran ment."
  );
  assert.match(
    SOURCE,
    /derniereIssueMiseAJour/,
    "L'issue est écrite mais jamais relue : elle ne sert alors à personne."
  );
});

cas("l'issue est notée AVANT que la migration puisse couper la réponse", () => {
  const iNote = SOURCE.indexOf("await noterIssue(etat)");
  const iMigration = SOURCE.indexOf('"db:migrate"');
  assert.ok(iNote > 0, "L'issue n'est pas notée du tout.");
  assert.ok(
    iNote < iMigration,
    "L'issue est notée après la migration : si la réponse est coupée pendant celle-ci, elle est perdue — exactement le cas du 7 août."
  );
});

cas("l'échec inattendu laisse lui aussi une trace, avec sa raison", () => {
  assert.match(
    SOURCE,
    /catch[\s\S]{0,200}noterIssue\(`impossible/,
    "Un échec ne note rien : l'écran affichera l'issue de l'essai PRÉCÉDENT, ce qui est pire qu'aucune."
  );
});

console.log("\n=== Le journal ne doit jamais salir le dépôt ===");

cas("un fichier déposé à la racine bloquerait toutes les mises à jour suivantes", () => {
  // Ce cas ne relit pas le code : il DÉMONTRE la panne évitée, sur un vrai
  // dépôt git, avec le vrai script. Sans cette démonstration, « on a mis le
  // fichier dans /tmp » reste une intention, pas une garantie.
  const racine = mkdtempSync(join(tmpdir(), "atlas-issue-"));
  try {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: racine, encoding: "utf8" });
    git("init", "--quiet", "-b", "main");
    git("config", "user.email", "essai@atlas.local");
    git("config", "user.name", "Essai");
    writeFileSync(join(racine, "fichier.txt"), "contenu\n");
    git("add", "-A");
    git("commit", "--quiet", "-m", "premier");

    const propre = git("status", "--porcelain").trim();
    assert.equal(propre, "", "Le dépôt d'essai n'est pas propre au départ : le cas ne prouverait rien.");

    // Ce que le remède aurait fait s'il avait écrit à la racine.
    writeFileSync(join(racine, "atlas-mise-a-jour.txt"), "07:46 — faite\n");
    assert.notEqual(
      git("status", "--porcelain").trim(),
      "",
      "Un fichier neuf à la racine devrait salir l'arbre : sans cela ce cas ne démontre rien."
    );

    // …et `mettre-a-jour.sh` refuse alors, définitivement.
    const scriptRacine = new URL("../.devcontainer/mettre-a-jour.sh", import.meta.url).pathname;
    const issue = execFileSync("bash", [scriptRacine, racine], { encoding: "utf8" }).trim();
    assert.match(
      issue,
      /modifications non enregistrées/,
      `Le script répond « ${issue} » : le cas n'éprouve plus ce qu'il croit éprouver.`
    );
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

cas("le journal vit donc dans /tmp, et le code le dit", () => {
  assert.match(
    SOURCE,
    /"\/tmp\/atlas-mise-a-jour\.txt"/,
    "Le journal n'est pas dans /tmp : voir le cas précédent pour ce que cela coûte."
  );
  assert.ok(
    !existsSync(new URL("../atlas-mise-a-jour.txt", import.meta.url).pathname),
    "Un journal traîne à la racine du dépôt : il bloquera la prochaine mise à jour."
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Issue de mise à jour — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
