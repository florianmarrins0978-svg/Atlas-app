/* =======================================================================
   LE GARDE-FOU DES TIRETS SAIT CE QU'IL REFUSE, ET CE QU'IL LAISSE PASSER.

   **Un garde-fou qui parle à tort s'apprend à être ignoré**, et l'on perd
   la protection sans s'en apercevoir (`CLAUDE.md` §1 bis). Cette suite
   lui montre donc autant de gestes à laisser passer qu'à refuser : les
   commentaires qui citent ses phrases, le trait d'union, la case vide,
   les fichiers qui ne s'affichent pas.

   Elle joue le déclencheur avec son VRAI contrat — le JSON qu'il reçoit
   sur l'entrée standard —, pas seulement ses fonctions : c'est par là
   que le patron arrive (`CLAUDE.md` §5 quater).
   ======================================================================= */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { decider, phraseFautive, fichierQuiSAffiche } from "./garde-tirets.mjs";

const DECLENCHEUR = path.join(__dirname, "garde-tirets.mjs");

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n      ${e instanceof Error ? e.message : e}`);
  }
}

console.log("=== Le garde-fou des tirets ===\n");

// ── CE QU'IL REFUSE ────────────────────────────────────────────────────────

cas("une chaîne d'écran avec un tiret au milieu", () => {
  const refus = decider("Edit", {
    file_path: "/x/src/app/planning/PlanningClient.tsx",
    new_string: 'const mot = "Inconnu — sa fiche sera créée";',
  });
  assert.ok(refus, "le tiret aurait dû être refusé");
  assert.match(refus!, /des phrases normales/);
});

cas("un point médian entre deux mots", () => {
  assert.ok(decider("Write", {
    file_path: "src/lib/chantier-etat.ts",
    content: 'export const ETAT = "Devis envoyé · sans réponse";',
  }));
});

cas("le texte d'un écran, entre deux balises", () => {
  assert.ok(decider("Edit", {
    file_path: "src/app/reglages/page.tsx",
    new_string: "        <p>Version inconnue — cette installation ne la dit pas.</p>",
  }));
});

cas("une maquette publiée", () => {
  assert.ok(decider("Write", {
    file_path: "appli/une-planche.html",
    content: '  <p class="quoi">La fiche de sécurité — celle du décret</p>',
  }));
});

cas("une modification parmi plusieurs (MultiEdit)", () => {
  assert.ok(decider("MultiEdit", {
    file_path: "src/components/atlas/Truc.tsx",
    edits: [
      { new_string: 'const a = "rien à signaler";' },
      { new_string: 'const b = "Photo lue — elle part avec votre question.";' },
    ],
  }));
});

cas("le refus DIT quoi écrire à la place", () => {
  const refus = decider("Write", {
    file_path: "src/app/x/page.tsx",
    content: 'const t = "Facultatif — vous pourrez le dire à la fin.";',
  })!;
  for (const mot of ["VIRGULE", "DEUX-POINTS", "POINT", "PARENTHÈSES"]) {
    assert.ok(refus.includes(mot), `le refus ne propose pas ${mot}`);
  }
});

// ── CE QU'IL LAISSE PASSER, et c'est ce qui le rend tenable ────────────────

cas("un COMMENTAIRE qui cite ses phrases, tirets compris", () => {
  assert.equal(
    decider("Edit", {
      file_path: "src/app/planning/PlanningClient.tsx",
      new_string: "  // **Sa règle du 11 septembre 2026** — il lit sur un téléphone.",
    }),
    null
  );
});

cas("un bloc de commentaire, ligne après ligne", () => {
  assert.equal(
    decider("Write", {
      file_path: "src/lib/truc.ts",
      content: ["/**", " * Le piège évité — et pourquoi.", " */", 'export const A = "Total HT";'].join("\n"),
    }),
    null
  );
});

cas("le trait d'union : « sous-traitant », une date, un calc()", () => {
  assert.equal(
    decider("Write", {
      file_path: "src/app/x/page.tsx",
      content: 'const t = "sous-traitant du 2026-09-22";\nconst h = "calc(100svh - var(--barre))";',
    }),
    null
  );
});

cas("un tiret SEUL dans une case : c'est un montant absent", () => {
  assert.equal(
    decider("Edit", {
      file_path: "appli/une-planche.html",
      new_string: "      <p>la page fait <b id=\"large\">—</b> pour 664 px d'écran</p>",
    }),
    null
  );
});

cas("un fichier qui ne s'affiche pas : un script, un test, la mémoire", () => {
  for (const chemin of ["scripts/test-x.ts", "docs/QUESTIONS.md", "CHANGELOG.md", "drizzle/0100_x.sql"]) {
    assert.equal(
      decider("Write", { file_path: chemin, content: 'const t = "un titre — une suite";' }),
      null,
      `${chemin} n'aurait pas dû être refusé`
    );
  }
});

cas("un outil qui n'écrit rien", () => {
  assert.equal(decider("Read", { file_path: "src/app/x/page.tsx" }), null);
});

cas("une phrase déjà juste ne réveille personne", () => {
  assert.equal(
    decider("Write", {
      file_path: "src/app/x/page.tsx",
      content: 'const t = "Bon pour accord, signature du client";',
    }),
    null
  );
});

// ── Les fonctions pures, sur leurs bords ───────────────────────────────────

cas("un chemin absolu est reconnu comme un chemin vu", () => {
  assert.ok(fichierQuiSAffiche("/home/user/Atlas-app/src/app/x/page.tsx"));
  assert.ok(fichierQuiSAffiche("appli/essais.html"));
  assert.ok(!fichierQuiSAffiche("scripts/x.ts"));
  assert.ok(!fichierQuiSAffiche("src/app/x/page.md"));
});

cas("phraseFautive rend la phrase, pour qu'on la voie dans le refus", () => {
  assert.equal(phraseFautive('const t = "Essai terminé — lecture seule";'), "Essai terminé — lecture seule");
  assert.equal(phraseFautive('const t = "Essai terminé, lecture seule";'), null);
});

// ── Le vrai chemin : le JSON sur l'entrée standard ─────────────────────────

function jouer(charge: unknown): { code: number; sortie: string } {
  const r = spawnSync(process.execPath, [DECLENCHEUR], { input: JSON.stringify(charge), encoding: "utf8" });
  return { code: r.status ?? 1, sortie: r.stdout ?? "" };
}

cas("par son vrai contrat : il refuse, et dit pourquoi", () => {
  const { sortie } = jouer({
    tool_name: "Write",
    tool_input: { file_path: "src/app/x/page.tsx", content: 'const t = "Inconnu — sa fiche sera créée";' },
  });
  const rendu = JSON.parse(sortie);
  assert.equal(rendu.hookSpecificOutput.permissionDecision, "deny");
  assert.match(rendu.hookSpecificOutput.permissionDecisionReason, /tiret en\nplein milieu/);
});

cas("par son vrai contrat : il se tait sur une phrase juste", () => {
  const { sortie } = jouer({
    tool_name: "Write",
    tool_input: { file_path: "src/app/x/page.tsx", content: 'const t = "Inconnu, sa fiche sera créée";' },
  });
  assert.deepEqual(JSON.parse(sortie), {});
});

cas("une entrée illisible ne bloque personne", () => {
  const r = spawnSync(process.execPath, [DECLENCHEUR], { input: "{pas du json", encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout || "{}"), {});
});

console.log(
  echecs === 0
    ? "\n✅ Le garde-fou refuse le tiret, et laisse passer le reste."
    : `\n❌ ${echecs} échec(s).`
);
process.exit(echecs === 0 ? 0 : 1);
