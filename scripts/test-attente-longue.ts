import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  etapeAttente,
  phraseAttente,
  SEUIL_LONGUE_MS,
  SEUIL_ABANDON_MS,
} from "../src/lib/attente-longue";

/*
  Ce que l'écran dit quand l'attente s'éternise.

  **La question, posée au patron le 13 août 2026 :** une vague qui souffle
  depuis trente secondes redevient une vague qui ne dit rien. Sa réponse : « oui
  fait ça ».

  Elle tient trois choses que l'affichage seul ne verrait pas :

    1. **les seuils**, y compris les cas tordus — un réveil retardé par un
       téléphone endormi, une horloge qui recule ;
    2. **la LONGUEUR des phrases.** Elles vivent dans une colonne de 190 px, à
       côté du titre. La première version de celle des douze secondes en faisait
       cent caractères : elle cassait « Un chantier » en deux lignes, en plein
       milieu de l'attente. Ce contrôle-là rougit à l'écriture de la phrase, pas
       vingt-cinq minutes plus tard ;
    3. **la garantie qui rend l'abandon sûr** : la dictée ne remplit que les
       champs restés vides. Sans elle, saisir pendant l'attente serait un piège,
       et rendre la main au bout de quarante-cinq secondes n'aurait plus de sens.
*/

const __dirname = dirname(fileURLToPath(import.meta.url));
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

console.log("=== L'attente qui s'éternise ===");

cas("les deux à dix secondes ordinaires ne signalent rien", () => {
  for (const ms of [0, 1_000, 5_000, 9_999, SEUIL_LONGUE_MS - 1]) {
    assert.strictEqual(etapeAttente(ms), "normale", `${ms} ms devrait rester ordinaire`);
  }
  assert.strictEqual(phraseAttente("normale"), "Atlas rédige…");
});

cas("AUCUNE phrase ne dépasse la colonne où elle vit", () => {
  // **Le défaut qui a valu ce contrôle.** La première version de la phrase des
  // douze secondes faisait cent caractères. Dans la colonne de 190 px, à côté
  // du titre, elle occupait 184 px et cassait « Un chantier » en deux lignes —
  // en plein milieu de l'attente, sous les yeux du patron. Vu à la capture, et
  // seulement là.
  //
  // **Le plafond vient d'une mesure, pas d'un goût.** Dans la vraie page, sur
  // son écran : 31 caractères font 163 px et tiennent sur une ligne, 33 en font
  // 181 et passent à deux — et deux lignes suffisent à casser le titre.
  //
  // Il a fallu deux essais pour le poser juste. À 60, il laissait passer la
  // phrase de l'abandon, qui cassait le titre malgré lui : **un plafond trop
  // généreux est un contrôle qui dort**, et il a fallu le voir rougir au
  // navigateur pour s'en apercevoir. C'est la largeur qui décide, pas le
  // compte ; celui-ci n'est que la sentinelle rapide de l'autre.
  const LIMITE = 31;
  for (const e of ["normale", "longue", "abandonnee"] as const) {
    const p = phraseAttente(e);
    assert.ok(
      p.length <= LIMITE,
      `« ${p} » fait ${p.length} caractères : au-delà de ${LIMITE}, elle passe à deux ` +
        "lignes, prend toute la colonne et casse « Un chantier » en deux (écran de 390 px)",
    );
  }
});

cas("passé douze secondes, l'écran dit que c'est plus long que d'habitude", () => {
  assert.strictEqual(etapeAttente(SEUIL_LONGUE_MS), "longue");
  assert.strictEqual(etapeAttente(30_000), "longue");
  assert.strictEqual(etapeAttente(SEUIL_ABANDON_MS - 1), "longue");
});

cas("passé quarante-cinq secondes, il renonce", () => {
  assert.strictEqual(etapeAttente(SEUIL_ABANDON_MS), "abandonnee");
  assert.strictEqual(etapeAttente(10 * 60_000), "abandonnee");
});

cas("un réveil très en retard dit l'abandon, pas « c'est un peu long »", () => {
  // Un téléphone qui s'endort étire ses minuteries : le réveil des douze
  // secondes peut tomber à la cinquantième. C'est la durée RÉELLE qui tranche.
  assert.strictEqual(etapeAttente(52_000), "abandonnee");
});

cas("une horloge qui recule ne déclenche pas un abandon immédiat", () => {
  // Un changement d'heure entre deux relevés suffit à produire une durée
  // négative. La traiter comme « on vient de commencer » vaut mieux que
  // d'annoncer un abandon à la première milliseconde.
  assert.strictEqual(etapeAttente(-4_000), "normale");
  assert.strictEqual(etapeAttente(Number.NaN), "normale");
});

cas("chaque étape a sa phrase, et aucune n'est vide", () => {
  for (const e of ["normale", "longue", "abandonnee"] as const) {
    assert.ok(phraseAttente(e).trim().length > 10, `l'étape « ${e} » n'a rien à dire`);
  }
});

cas("la phrase de l'abandon rend le geste au lieu de constater une panne", () => {
  const p = phraseAttente("abandonnee");
  // On ne sait PAS que la dictée a échoué : l'appel court peut-être encore.
  // Dire « échec » serait affirmer plus que ce qu'on observe.
  assert.ok(!/échou|erreur|panne/i.test(p), `« ${p} » affirme une panne qu'on n'a pas constatée`);
  assert.ok(
    /réessay|micro|recommencer/i.test(p),
    `« ${p} » ne dit pas comment repartir`,
  );
});

cas("LA GARANTIE TIENT : la dictée ne remplit que les champs vides", () => {
  // **Pourquoi ce contrôle vit ici.** Rendre la main au bout de quarante-cinq
  // secondes n'a de sens que si le patron peut saisir pendant ce temps sans
  // rien risquer. Une dictée qui reviendrait ÉCRASER ce qu'il vient de taper
  // ferait de l'abandon un piège plutôt qu'une sortie.
  //
  // La garantie vit dans un AUTRE fichier, et c'est le genre d'accord qui se
  // défait en silence : personne, en modifiant `appliquerDictee`, ne pensera à
  // l'attente longue.
  const formulaire = readFileSync(
    join(__dirname, "..", "src", "app", "chantiers", "nouveau", "FormulaireNouveauChantier.tsx"),
    "utf8",
  );
  const fusion = formulaire.slice(
    formulaire.indexOf("function appliquerDictee"),
    formulaire.indexOf("function appliquerDictee") + 600,
  );
  for (const champ of ["nomClient", "telephone", "email", "adresseChantier"]) {
    assert.ok(
      new RegExp(`!${champ}\\.trim\\(\\)`).test(fusion),
      `« ${champ} » peut être écrasé par une dictée en retard : saisir pendant l'attente ` +
        "devient alors un piège, et rendre la main au bout de 45 s n'est plus une sortie",
    );
  }
});

if (echecs > 0) {
  console.error(`\n${echecs} défaut(s) sur l'attente longue.`);
  process.exit(1);
}
console.log("\n✅ L'attente qui s'éternise se raconte, et sa promesse tient.");
