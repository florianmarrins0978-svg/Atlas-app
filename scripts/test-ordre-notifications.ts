// L'ordre des cartes de l'accueil : le plus récent en haut, sans écran ni base.
//
// **Sa demande du 26 août 2026, capture à l'appui :** *« je viens de recevoir un
// devis retourné, il devrait apparaître en premier. L'ordre doit être dernier
// arrivé en tête de liste. Le plus récent en haut. »*
//
// **CE QU'ELLE REMPLACE, ET POURQUOI CETTE SUITE A ÉTÉ RÉÉCRITE.** Elle tenait
// jusqu'ici un tressage par SORTE — les rappels devant, une place garantie aux
// réponses de clients (ses décisions du 16 août). C'est cet arrangement qu'il
// vient d'écarter, et **une suite qui réclamerait ce qu'il a fait retirer
// rendrait son écran impossible à changer** (`CLAUDE.md` §5 bis).
//
// **Ce que cette suite protège, et qu'un contrôle de navigateur ne peut pas
// voir.** L'écran ne produit que les situations qu'on sait fabriquer ; ici on
// éprouve les cas limites — une sorte absente, des dates égales, une réponse
// sans date — qui n'arrivent qu'un jour sur cent chez le patron, et qui
// arriveront.

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

/** Une carte réduite à ce qui range : son nom, et quand elle est arrivée. */
type C = { nom: string; quand: number };
const carte = (nom: string, jours: number): C => ({ nom, quand: JOUR0 - jours * 86_400_000 });
/** Un instant fixe : une suite qui dépend de l'heure rougit un jour sur deux. */
const JOUR0 = Date.UTC(2026, 7, 26, 21, 17);
const noms = (cartes: C[]) => cartes.map((c) => c.nom).join(" ");

console.log("=== L'ordre des cartes de l'accueil ===\n");

// ─── LE CAS DE SA CAPTURE, celui qui a motivé la règle ──────────────────────
//
// Un rappel « devis sans réponse » vieux de treize jours, et un devis retourné
// reçu à l'instant. Sur son écran, le retourné était DEUXIÈME.
essai("le devis retourné à l'instant passe devant un rappel de treize jours", () => {
  const rappels = [carte("rappel-13-jours", 13)];
  const reponses = [carte("devis-retourne", 0)];
  assert.equal(
    noms(ordonnerLesCartes(rappels, reponses)),
    "devis-retourne rappel-13-jours",
    "c'est exactement l'écran qu'il a photographié le 26 août : la nouvelle du jour en second"
  );
});

// **L'ORDRE NE REGARDE PAS LA SORTE.** C'est tout le changement : ni les
// rappels ni les réponses n'ont de préséance, seule la date décide.
essai("aucune sorte ne passe devant l'autre — la date seule décide", () => {
  const rappels = [carte("rappel-frais", 1), carte("rappel-vieux", 30)];
  const reponses = [carte("reponse-tres-fraiche", 0), carte("reponse-ancienne", 10)];
  assert.equal(
    noms(ordonnerLesCartes(rappels, reponses)),
    "reponse-tres-fraiche rappel-frais reponse-ancienne rappel-vieux",
    "les deux sortes s'entremêlent par date, sans qu'aucune ne soit privilégiée"
  );
});

// **CE QUE SA NOUVELLE RÈGLE COÛTE, éprouvé plutôt que supposé.** L'ancien
// tressage gardait une place à une réponse ancienne ; celui-ci non. Ce cas
// existe pour que personne ne « répare » ce comportement en croyant à un
// défaut : il est voulu, et il est le prix d'un ordre qui s'explique.
essai("une réponse ancienne passe DERRIÈRE des rappels frais — voulu", () => {
  const rappels = [carte("r1", 0), carte("r2", 1), carte("r3", 2)];
  const reponses = [carte("reponse-vieille", 9)];
  assert.equal(
    noms(ordonnerLesCartes(rappels, reponses)),
    "r1 r2 r3 reponse-vieille",
    "l'ancien tressage lui réservait une place ; la règle du 26 août ne réserve rien"
  );
});

essai("une seule sorte : elle occupe tout, rangée par date", () => {
  assert.equal(noms(ordonnerLesCartes([carte("a", 5), carte("b", 1)], [])), "b a");
  assert.equal(noms(ordonnerLesCartes([], [carte("x", 8), carte("y", 2)])), "y x");
});

essai("rien à ranger ne casse rien", () => {
  assert.deepEqual(ordonnerLesCartes([], []), []);
});

// **À DATE ÉGALE, L'ORDRE D'ARRIVÉE TIENT.** Un écran qui se réordonne tout
// seul entre deux rendus fait rater le bouton qu'on visait : deux cartes de la
// même seconde ne doivent jamais échanger leur place.
essai("à date égale, l'ordre ne bouge pas d'un rendu à l'autre", () => {
  const memeInstant = [carte("a", 3), carte("b", 3), carte("c", 3)];
  const premier = noms(ordonnerLesCartes(memeInstant, []));
  assert.equal(premier, "a b c");
  assert.equal(noms(ordonnerLesCartes(memeInstant, [])), premier, "l'ordre a changé sans raison");
});

// **LE TRI NE MODIFIE PAS CE QU'ON LUI DONNE.** Les tableaux viennent de l'état
// d'un écran React : les trier sur place ferait muter une valeur que le rendu
// suivant relit, et l'ordre changerait sans qu'aucune donnée ait bougé.
essai("les listes données ne sont pas retournées à l'envers au passage", () => {
  const rappels = [carte("vieux", 9), carte("frais", 0)];
  const avant = noms(rappels);
  ordonnerLesCartes(rappels, []);
  assert.equal(noms(rappels), avant, "la liste d'origine a été triée SUR PLACE");
});

// **UNE RÉPONSE SANS DATE PASSE EN TÊTE, jamais à la fin.** `responduAt` est
// posé en même temps que la réponse : il ne manque jamais en pratique. S'il
// manquait, la ranger comme très ancienne l'enverrait derrière « N autres devis
// à regarder », c'est-à-dire nulle part — et une réponse de client ne se perd
// pas pour une date absente (`src/app/Notifications.tsx`).
essai("une carte sans date connue reste VISIBLE, en tête", () => {
  const sansDate = { nom: "reponse-sans-date", quand: Number.MAX_SAFE_INTEGER };
  assert.equal(
    noms(ordonnerLesCartes([carte("r", 0)], [sansDate])),
    "reponse-sans-date r",
    "elle est partie au fond : le patron ne la verra jamais"
  );
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("Ordre des cartes — 0 échec(s).");
