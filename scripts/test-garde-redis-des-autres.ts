import assert from "node:assert";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { gesteQuiVideRedis, phraseDuRefus } from "./garde-redis-des-autres.mjs";

/**
 * LE GARDE-FOU QUI PROTÈGE LE REDIS DES AUTRES SESSIONS.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Autant de commandes à LAISSER PASSER qu'à refuser**, et c'est délibéré : un
 * garde-fou qui parle à tort s'apprend à être ignoré, et l'on perd la
 * protection sans s'en apercevoir (`CLAUDE.md` §1 bis). La moitié de cette
 * suite ne défend donc pas la règle — elle défend le travail ordinaire contre
 * elle.
 *
 * **Et le déclencheur est joué avec son VRAI contrat** — le JSON de
 * `PreToolUse` sur l'entrée standard —, pas seulement sa fonction interne.
 * C'est la faute du 28 août 2026 : six gestes éprouvés par la porte de service,
 * et aucun atteignable par la porte d'entrée.
 * ───────────────────────────────────────────────────────────────────────────
 */

const GARDE = path.join(import.meta.dirname, "garde-redis-des-autres.mjs");

let passed = 0;
let failed = 0;

function test(nom: string, corps: () => void) {
  try {
    corps();
    passed++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Ce que le déclencheur répond vraiment, lancé comme le fait Claude Code. */
function reponseDuDeclencheur(commande: string): { refuse: boolean; raison: string } {
  const sortie = execFileSync("node", [GARDE], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: commande } }),
    encoding: "utf8",
  });
  if (sortie.trim() === "") return { refuse: false, raison: "" };
  const lu = JSON.parse(sortie) as {
    hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
  };
  return {
    refuse: lu.hookSpecificOutput?.permissionDecision === "deny",
    raison: lu.hookSpecificOutput?.permissionDecisionReason ?? "",
  };
}

// ─── Ce qui doit être REFUSÉ ───────────────────────────────────────────────

const A_REFUSER: [string, string][] = [
  ["redis-cli FLUSHALL", "le geste nu, celui qui a été joué trois fois le 9 septembre"],
  ["redis-cli flushall", "en minuscules — redis-cli ne fait pas la différence"],
  ["redis-cli -u redis://localhost:6379 FLUSHALL", "avec une adresse devant le verbe"],
  ["redis-cli FLUSHALL > /dev/null", "muselé : il détruit exactement autant"],
  ["npm test && redis-cli FLUSHALL", "caché derrière un `&&`"],
  ["echo bonjour; redis-cli FLUSHALL", "caché derrière un `;`"],
  ["redis-cli FLUSHDB", "sans `-n` : il vide la base 0, l'atelier d'un autre"],
];

for (const [commande, pourquoi] of A_REFUSER) {
  test(`REFUSE — ${pourquoi}`, () => {
    const vu = gesteQuiVideRedis(commande);
    assert.ok(vu, `« ${commande} » aurait dû être vu comme destructeur`);
    const reponse = reponseDuDeclencheur(commande);
    assert.equal(reponse.refuse, true, `le déclencheur a laissé passer « ${commande} »`);
    assert.match(
      reponse.raison,
      /-n <rang> FLUSHDB/,
      "le refus doit dire ce qu'on fait à la place, sinon il se contourne au hasard"
    );
  });
}

// ─── Ce qui doit PASSER — et c'est la moitié qui compte ────────────────────

const A_LAISSER: [string, string][] = [
  ["redis-cli -n 2 FLUSHDB", "le rang est nommé : la responsabilité est prise"],
  ["redis-cli -n 0 FLUSHDB", "le rang 0 aussi, dès lors qu'il est écrit"],
  ["redis-cli KEYS '*'", "lire ne détruit rien"],
  ["redis-cli GET ratelimit:connexion:demo", "lire une clé non plus"],
  ["redis-cli DEL ratelimit:connexion:demo@atlas.local", "retirer UNE clé nommée"],
  ["redis-server --version", "ce n'est même pas redis-cli"],
  ["npm run verifier:avant-livraison", "la batterie, qui gère elle-même son atelier"],
  ["git commit -m 'ne jamais faire redis-cli FLUSHALL'", "le geste n'est PAS dans un message"],
  ["psql -c 'FLUSHALL'", "aucun redis-cli : ce n'est pas ce verbe-là"],
  // **Le cas qui manquait, et qui s'est vu en situation** : à la minute où ce
  // garde-fou a été branché, il a refusé le message de commit qui le décrivait.
  // Un message multiligne passe par un heredoc, et les apostrophes du français
  // y déséquilibrent le retrait des citations — le verbe cité se retrouve alors
  // à découvert. Une suite qui n'éprouve que des commandes d'une seule ligne ne
  // pouvait pas le voir.
  [
    "git commit -F - <<'FIN'\nOn a joué redis-cli FLUSHALL, c'est-à-dire qu'écrire\nla règle devenait impossible.\nFIN",
    "un message de commit en heredoc, apostrophes françaises comprises",
  ],
  [
    'cat > /tmp/note.md <<"EOF"\nNe jamais faire redis-cli FLUSHALL.\nEOF',
    "un document écrit en heredoc, qui NOMME le geste sans le jouer",
  ],
  ["redis-cli GET x && psql -c 'TRUNCATE t'", "deux commandes, dont aucune ne vide Redis"],
];

for (const [commande, pourquoi] of A_LAISSER) {
  test(`LAISSE PASSER — ${pourquoi}`, () => {
    assert.equal(
      gesteQuiVideRedis(commande),
      null,
      `« ${commande} » a été pris pour un vidage : un garde-fou qui parle à tort s'apprend à être ignoré`
    );
    assert.equal(
      reponseDuDeclencheur(commande).refuse,
      false,
      `le déclencheur a refusé « ${commande} » à tort`
    );
  });
}

// ─── Le refus doit se lire, et désigner le bon coupable ────────────────────

test("Le refus NOMME la commande fautive, pas seulement la règle", () => {
  const vu = gesteQuiVideRedis("redis-cli FLUSHALL");
  assert.ok(vu);
  const phrase = phraseDuRefus(vu);
  assert.match(phrase, /redis-cli FLUSHALL/, "le refus doit citer ce qui a été tapé");
  assert.match(phrase, /seize bases/, "le refus doit dire POURQUOI, sinon on le contourne");
});

// **Une entrée illisible ne bloque personne.** Un déclencheur qui refuse ce
// qu'il n'a pas compris arrête le travail sans rien protéger.
test("Une entrée illisible laisse passer, plutôt que de bloquer à l'aveugle", () => {
  const sortie = execFileSync("node", [GARDE], { input: "ceci n'est pas du JSON", encoding: "utf8" });
  assert.equal(sortie.trim(), "", "le garde-fou doit se taire devant une entrée qu'il ne comprend pas");
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
