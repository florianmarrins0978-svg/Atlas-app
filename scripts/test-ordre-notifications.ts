// La place garantie sur l'accueil : la règle, sans écran ni base.
//
// **Ses deux décisions du 16 août 2026, prises sur photographies :** *« fait la
// B »* — les rappels devant —, puis *« fait le »* — la place garantie, après
// qu'une image lui a montré trois chantiers sans devis masquant TOUTES les
// réponses de clients.
//
// **Ce que cette suite protège, et qu'un contrôle de navigateur ne peut pas
// voir.** L'écran ne produit que les situations qu'on sait fabriquer ; ici on
// éprouve les cas limites — zéro d'une sorte, une seule place visible, plus de
// réponses que de places — qui n'arrivent qu'un jour sur cent chez le patron,
// et qui arriveront.

import assert from "node:assert/strict";
import { ordonnerLesCartes } from "../src/lib/ordre-notifications";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Des étiquettes lisibles : « r » pour un rappel, « c » pour une réponse. */
const r = (n: number) => `r${n}`;
const c = (n: number) => `c${n}`;

console.log("=== La place garantie sur l'accueil ===\n");

// ── Le cas qu'il a vu en photo ────────────────────────────────────────────
essai("trois rappels et deux réponses : on voit un de chaque", () => {
  const ordre = ordonnerLesCartes([r(1), r(2), r(3)], [c(1), c(2)], 2);
  assert.deepEqual(ordre.slice(0, 2), ["r1", "c1"], "les deux places visibles");
  // Rien n'est perdu : ce qui ne tient pas est derrière le repli, pas effacé.
  assert.equal(ordre.length, 5);
  assert.deepEqual(ordre, ["r1", "c1", "r2", "r3", "c2"]);
});

// **LE CONTRÔLE INVERSE, et il vaut le premier.** Sans lui, une règle qui
// mettrait TOUJOURS une réponse en seconde place passerait au vert — y compris
// quand il n'y a aucune réponse, où elle laisserait un trou.
essai("son choix B tient : le rappel garde la PREMIÈRE place", () => {
  assert.equal(ordonnerLesCartes([r(1)], [c(1), c(2), c(3)], 2)[0], "r1");
  assert.equal(ordonnerLesCartes([r(1), r(2)], [c(1)], 2)[0], "r1");
});

// ── Une seule sorte : rien à garantir ─────────────────────────────────────
essai("sans réponse de client, les rappels prennent toutes les places", () => {
  assert.deepEqual(ordonnerLesCartes([r(1), r(2), r(3)], [], 2), ["r1", "r2", "r3"]);
});

essai("sans rappel, les réponses prennent toutes les places", () => {
  assert.deepEqual(ordonnerLesCartes([], [c(1), c(2)], 2), ["c1", "c2"]);
});

essai("rien du tout ne rend rien du tout", () => {
  assert.deepEqual(ordonnerLesCartes([], [], 2), []);
});

// ── Les cas limites, ceux qui n'arrivent qu'un jour sur cent ──────────────
essai("un seul rappel et une seule réponse : les deux se voient", () => {
  assert.deepEqual(ordonnerLesCartes([r(1)], [c(1)], 2), ["r1", "c1"]);
});

// **La place garantie ne peut pas retirer au rappel sa seule place.** À une
// carte visible, réserver aux réponses ferait disparaître le rappel de l'écran
// — exactement ce que sa décision B voulait empêcher.
essai("à UNE seule place visible, elle revient au rappel", () => {
  assert.equal(ordonnerLesCartes([r(1), r(2)], [c(1)], 1)[0], "r1");
});

essai("à TROIS places, deux rappels et une réponse", () => {
  const ordre = ordonnerLesCartes([r(1), r(2), r(3)], [c(1), c(2)], 3);
  assert.deepEqual(ordre.slice(0, 3), ["r1", "r2", "c1"]);
});

// **Aucune carte perdue, jamais.** Une règle d'ordre qui en égarerait une
// ferait disparaître un refus de client sans que rien ne le signale — le pire
// défaut possible sur cet écran.
essai("aucune carte n'est perdue ni dupliquée, quels que soient les nombres", () => {
  for (let nr = 0; nr <= 5; nr++) {
    for (let nc = 0; nc <= 5; nc++) {
      for (const v of [1, 2, 3]) {
        const rappels = Array.from({ length: nr }, (_, i) => r(i + 1));
        const reponses = Array.from({ length: nc }, (_, i) => c(i + 1));
        const ordre = ordonnerLesCartes(rappels, reponses, v);
        assert.equal(ordre.length, nr + nc, `${nr} rappels + ${nc} réponses, ${v} places`);
        assert.equal(
          new Set(ordre).size,
          nr + nc,
          `doublon avec ${nr} rappels + ${nc} réponses, ${v} places`
        );
      }
    }
  }
});

// **La garantie, énoncée telle qu'il l'a demandée**, et vérifiée partout :
// « je vois toujours au moins un de chaque, quand il y a les deux ».
essai("dès qu'il y a les deux sortes, chacune se voit — sur tous les cas", () => {
  for (let nr = 1; nr <= 5; nr++) {
    for (let nc = 1; nc <= 5; nc++) {
      const rappels = Array.from({ length: nr }, (_, i) => r(i + 1));
      const reponses = Array.from({ length: nc }, (_, i) => c(i + 1));
      const vus = ordonnerLesCartes(rappels, reponses, 2).slice(0, 2);
      assert.ok(vus.some((x) => x.startsWith("r")), `aucun rappel visible (${nr}/${nc})`);
      assert.ok(vus.some((x) => x.startsWith("c")), `aucune réponse visible (${nr}/${nc})`);
    }
  }
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("L'ordre des notifications — 0 échec(s).");
