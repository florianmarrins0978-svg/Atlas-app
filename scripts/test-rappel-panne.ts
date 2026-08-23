// « Ça ne marche pas » : le rappel part-il, et se tait-il quand il le doit ?
//
// **Ce contrôle garde un garde-fou.** Le 12 août 2026, le patron demande que
// ses sessions aillent d'elles-mêmes lire la fiche d'état de son espace au lieu
// de supposer. La règle existe en prose (`CLAUDE.md` §1 bis) ; le déclencheur
// la remet sous les yeux au moment exact où elle sert.
//
// Deux façons de le perdre, et ce sont les deux bouts que ces cas tiennent :
//
//  - **Il se tait quand il faut parler.** Une tournure qu'il emploie vraiment
//    n'est plus reconnue, et on retombe à formuler des hypothèses sur une
//    machine qu'on ne voit pas — quatre allers-retours perdus dans la nuit du
//    11 au 12 août, toutes fausses.
//  - **Il parle quand il faut se taire.** Un rappel qui se déclenche sur des
//    demandes ordinaires s'apprend à être ignoré, et le garde-fou est perdu
//    pour de bon — silencieusement, celui-là.
//
// Le câblage est vérifié aussi : un script juste que rien n'appelle ne protège
// personne, et son absence ne se voit nulle part.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { signaleUnePanne, RAPPEL } from "./rappel-panne.mjs";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Le rappel « ça ne marche pas » ===");

cas("les phrases QU'IL A RÉELLEMENT ÉCRITES déclenchent le rappel", () => {
  // Toutes relevées dans les conversations des 11 et 12 août 2026. Elles sont
  // la seule source qui vaille : une tournure inventée prouve que le contrôle
  // passe, pas que le patron sera entendu.
  const siennes = [
    "Ça marche pas j'arrive pas à me connecter corrige ça vite",
    "Ça ne marche pas, je vais me coucher, corrige tout seul et répare moi ça",
    "Ça ne marche pas. Occupe-toi-en, moi je ne peux pas le faire.",
    "ca marche pas",
    "et les photos ça marche toujours pas",
  ];
  for (const phrase of siennes) {
    assert.ok(
      signaleUnePanne(phrase),
      `« ${phrase} » ne déclenche plus rien : la session recommencera à deviner`
    );
  }
});

cas("les hasards de la dictée ne font pas rater le rappel", () => {
  // Il dicte depuis un téléphone : accents, majuscules et espaces tombent au
  // hasard. Une comparaison littérale raterait une phrase sur deux.
  assert.ok(signaleUnePanne("CA NE MARCHE PAS"), "les majuscules font rater le rappel");
  assert.ok(signaleUnePanne("Ça ne marche pas"), "un accent fait rater le rappel");
  assert.ok(signaleUnePanne("ça  ne marche pas"), "un espace doublé fait rater le rappel");
  assert.ok(signaleUnePanne("ça ne marche\npas"), "un retour à la ligne fait rater le rappel");
  assert.ok(
    signaleUnePanne("bonjour, ça ne fonctionne pas depuis ce matin"),
    "la tournure noyée dans une phrase n'est plus vue"
  );
});

cas("une demande de travail ORDINAIRE ne déclenche rien", () => {
  // C'est l'autre bout, et le plus insidieux : un rappel qui parle à tort
  // finit ignoré, et personne ne s'aperçoit qu'on a perdu le garde-fou.
  const ordinaires = [
    "Ajoute une colonne au planning",
    "Explique-moi le problème avec la perle dorée",
    "Corrige l'erreur de type dans ListeChantiers",
    "Lorsque tout est au vert, fusionne.",
    "Est-ce que la CI est passée ?",
    "Ça fonctionne ?",
  ];
  for (const phrase of ordinaires) {
    assert.ok(
      !signaleUnePanne(phrase),
      `« ${phrase} » déclenche le rappel à tort : à ce rythme il sera ignoré`
    );
  }
});

cas("le rappel DIT où regarder, pas seulement de regarder", () => {
  // Un rappel qui dirait « va voir l'état de son espace » sans nommer la fiche
  // laisse la session la chercher — et une session qui cherche finit par
  // supposer. C'est exactement ce qu'on répare.
  assert.match(RAPPEL, /rapporter-espace\.mjs/, "le rappel ne dit plus où se trouve la fiche");
  assert.match(RAPPEL, /date/i, "le rappel ne dit plus de regarder la date de la fiche en premier");
  assert.match(RAPPEL, /claude/, "le rappel ne dit plus de lui faire lancer `claude` chez lui");
});

cas("le déclencheur est bel et bien CÂBLÉ dans les réglages", () => {
  // Un script juste que rien n'appelle ne protège personne, et son absence ne
  // se voit nulle part : la session se contente de ne rien recevoir.
  const reglages = JSON.parse(readFileSync(".claude/settings.json", "utf8")) as {
    hooks?: { UserPromptSubmit?: { hooks?: { type?: string; command?: string }[] }[] };
  };
  const commandes = (reglages.hooks?.UserPromptSubmit ?? []).flatMap((e) => e.hooks ?? []);
  assert.ok(
    commandes.some((c) => c.type === "command" && (c.command ?? "").includes("rappel-panne.mjs")),
    "`.claude/settings.json` n'appelle plus `rappel-panne.mjs` sur UserPromptSubmit : " +
      "le rappel existe mais ne partira jamais"
  );
});

cas("appelé pour de vrai, il rend le contexte attendu", () => {
  // Le contrat est celui de Claude Code : du JSON sur l'entrée standard, du
  // JSON sur la sortie. Éprouver la fonction sans éprouver le processus,
  // c'est éprouver la moitié qui ne casse pas.
  const r = spawnSync(process.execPath, ["scripts/rappel-panne.mjs"], {
    input: JSON.stringify({ prompt: "ça ne marche pas" }),
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `le déclencheur sort en erreur : ${r.stderr}`);
  const sortie = JSON.parse(r.stdout) as {
    hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
  };
  assert.equal(
    sortie.hookSpecificOutput?.hookEventName,
    "UserPromptSubmit",
    "le nom d'événement ne correspond pas : Claude Code ignorera la sortie"
  );
  assert.match(
    sortie.hookSpecificOutput?.additionalContext ?? "",
    /rapporter-espace\.mjs/,
    "le contexte ajouté ne porte pas le rappel"
  );
});

cas("une demande ordinaire ne fait rien SORTIR du déclencheur", () => {
  const r = spawnSync(process.execPath, ["scripts/rappel-panne.mjs"], {
    input: JSON.stringify({ prompt: "Ajoute une colonne au planning" }),
    encoding: "utf8",
  });
  assert.equal(r.status, 0, "le déclencheur sort en erreur sur une demande ordinaire");
  assert.equal(r.stdout.trim(), "", "le déclencheur parle sur une demande ordinaire");
});

cas("une entrée illisible le laisse MUET, jamais en erreur", () => {
  // Un déclencheur qui échoue gêne chaque message du patron. Devant une entrée
  // qu'il ne comprend pas, se taire est le seul comportement acceptable.
  for (const entree of ["", "pas du json", "{}", '{"prompt":null}']) {
    const r = spawnSync(process.execPath, ["scripts/rappel-panne.mjs"], {
      input: entree,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `entrée « ${entree} » : le déclencheur sort en erreur`);
    assert.equal(r.stdout.trim(), "", `entrée « ${entree} » : le déclencheur parle pour rien`);
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Rappel « ça ne marche pas » — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
