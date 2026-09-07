import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { gesteQuiJette, phraseDuRefus } from "./garde-travail-non-enregistre.mjs";

// LE GARDE-FOU DOIT SAVOIR REFUSER, ET SURTOUT SAVOIR SE TAIRE.
//
// **Un garde-fou qui parle à tort s'apprend à être ignoré** (`CLAUDE.md`
// §1 bis) : c'est la moitié la plus importante de cette suite. Elle lui montre
// donc autant de gestes qu'il doit LAISSER PASSER que de gestes qu'il doit
// refuser — et parmi les premiers, ceux qui lui ressemblent le plus.
//
// Elle le joue aussi POUR DE BON, avec son entrée standard et sa sortie JSON :
// éprouver la fonction sans le déclencheur laisserait passer un contrat mal
// écrit, et c'est le contrat que Claude Code lit (`CLAUDE.md` §5 quater).

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

console.log("=== Le travail non enregistré ne se jette pas sans le dire ===\n");

// ─── Ce qu'il doit REFUSER ────────────────────────────────────────────────
for (const commande of [
  "git reset --hard",
  "git reset --hard HEAD~1",
  "git -C . reset --hard origin/main",
  "git checkout -- CHANGELOG.md",
  "git checkout .",
  "git restore src/app/globals.css",
  "git restore .",
  "git clean -fd",
  "git clean -f -d scripts/",
]) {
  cas(`refusé : ${commande}`, () => {
    assert.ok(gesteQuiJette(commande), `« ${commande} » n'est pas reconnu comme un geste qui jette`);
  });
}

// ─── Ce qu'il doit LAISSER PASSER ─────────────────────────────────────────
//
// Les quatre premiers sont ceux qui lui ressemblent, et c'est là qu'un motif
// trop large ferait du bruit tous les jours.
for (const commande of [
  // Il EMPORTE les modifications, il ne les perd pas — c'était la première
  // idée du garde-fou, et elle visait à côté.
  "git switch -c claude/mon-lot",
  "git checkout main",
  "git checkout -b essai",
  // Ne fait que désindexer.
  "git restore --staged CHANGELOG.md",
  // Met de côté au lieu de jeter : c'est justement ce qu'on propose.
  "git stash push --include-untracked -m 'mon lot'",
  "git status --porcelain",
  "git add -A && git commit -m 'faire le reset --hard du planning'",
  "npm run verifier:avant-livraison",
  // Un message qui PARLE du geste n'est pas le geste.
  "git commit -m 'Expliquer pourquoi on ne fait jamais git reset --hard ici'",
]) {
  cas(`laissé passer : ${commande}`, () => {
    assert.equal(
      gesteQuiJette(commande),
      null,
      `« ${commande} » est refusé à tort — un garde-fou qui parle à tort finit par être ignoré`
    );
  });
}

// ─── La phrase NOMME ce qu'elle protège ───────────────────────────────────
cas("le refus nomme les fichiers en jeu, et le geste qui le débloque", () => {
  const phrase = phraseDuRefus("git reset --hard", [" M CHANGELOG.md", "?? scripts/neuf.ts"]);
  assert.match(phrase, /CHANGELOG\.md/, "le refus ne dit pas ce qui serait perdu");
  assert.match(phrase, /git stash push/, "le refus ne dit pas comment faire autrement");
  assert.match(phrase, /2 fichier/, "le refus ne compte pas ce qu'il protège");
});

// ─── Le déclencheur LUI-MÊME, avec son vrai contrat ───────────────────────
//
// C'est le chemin que Claude Code emprunte ; l'éprouver en appelant la fonction
// n'en dirait rien (`CLAUDE.md` §5 quater).
function jouerLeDeclencheur(entree: unknown): { sortie: string } {
  const sortie = execFileSync("node", ["scripts/garde-travail-non-enregistre.mjs"], {
    input: JSON.stringify(entree),
    encoding: "utf8",
  });
  return { sortie };
}

cas("sur un geste anodin, le déclencheur ne dit RIEN", () => {
  const { sortie } = jouerLeDeclencheur({
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "git status --porcelain" },
  });
  assert.equal(sortie.trim(), "", `le déclencheur parle sans raison : ${JSON.stringify(sortie)}`);
});

cas("sur une entrée illisible, le déclencheur se tait plutôt que de bloquer", () => {
  const sortie = execFileSync("node", ["scripts/garde-travail-non-enregistre.mjs"], {
    input: "ceci n'est pas du JSON",
    encoding: "utf8",
  });
  assert.equal(sortie.trim(), "", "le déclencheur bloque sur ce qu'il n'a pas compris");
});

cas("arbre sale : le déclencheur REFUSE, et sa réponse porte le bon contrat", () => {
  const sale = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  if (!sale) {
    // **Refuser de conclure sur une mesure impossible** (`CLAUDE.md` §5) : sans
    // travail en cours, ce cas ne prouverait rien — un vert ici serait faux.
    throw new Error(
      "l'arbre est propre : ce cas ne peut rien mesurer. Le rejouer avec une " +
        "modification en cours, sinon il rend un vert qui ne prouve rien."
    );
  }
  const { sortie } = jouerLeDeclencheur({
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "git reset --hard" },
  });
  const rendu = JSON.parse(sortie);
  assert.equal(rendu.hookSpecificOutput?.permissionDecision, "deny", "le geste n'est pas refusé");
  assert.equal(rendu.hookSpecificOutput?.hookEventName, "PreToolUse");
  assert.match(String(rendu.hookSpecificOutput?.permissionDecisionReason), /git stash push/);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Garde du travail non enregistré — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
