// La descente de la perle sur le dernier jour.
//
// **Ce que ces cas éprouvent, et qu'aucune capture ne verrait.** Une capture
// montre trois positions de défilement sur une liste de quatre chantiers. Elle
// ne montre ni la liste d'un seul chantier, ni celle qui ne défile pas, ni le
// tout premier pixel de la descente — et c'est là que la règle se casse.
//
// La règle, dans les mots du patron : la perle reste au milieu tout le temps,
// et quand on arrive au dernier, elle descend se mettre en face de lui.

import assert from "node:assert/strict";
import { descenteDeLaPerle } from "../src/lib/perle-descente";

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

console.log("=== La descente de la perle sur le dernier jour ===");

// Les chiffres d'un iPhone 15, relevés le 11 août 2026 : cadre de 462 px dont
// le milieu tombe à 552, dernier chantier dont le milieu tombe à 617 une fois
// la liste au bout. La descente entière vaut donc 65 px.
const MILIEU = 552;
const DESCENTE_ENTIERE = 65;

cas("loin du bout, la perle ne bouge pas d'un pixel", () => {
  for (const restant of [400, 200, 66]) {
    assert.equal(
      descenteDeLaPerle({
        milieuDuDernier: MILIEU + DESCENTE_ENTIERE + restant,
        milieuDuCadre: MILIEU,
        restantADefiler: restant,
        hauteurADefiler: 900,
      }),
      0,
      `à ${restant} px du bout, la perle a quitté le milieu`
    );
  }
});

cas("au bout, la perle est exactement en face du dernier", () => {
  assert.equal(
    descenteDeLaPerle({
      milieuDuDernier: MILIEU + DESCENTE_ENTIERE,
      milieuDuCadre: MILIEU,
      restantADefiler: 0,
      hauteurADefiler: 900,
    }),
    DESCENTE_ENTIERE
  );
});

cas("la descente se fait sur les derniers pixels, et proportionnellement", () => {
  // À mi-chemin de la descente, la perle a fait la moitié du chemin. Sans quoi
  // elle sauterait — et un repère qui saute se lit comme un défaut d'affichage.
  const restant = Math.floor(DESCENTE_ENTIERE / 2);
  assert.equal(
    descenteDeLaPerle({
      milieuDuDernier: MILIEU + DESCENTE_ENTIERE + restant,
      milieuDuCadre: MILIEU,
      restantADefiler: restant,
      hauteurADefiler: 900,
    }),
    DESCENTE_ENTIERE - restant
  );
});

cas("une liste qui défile à PEINE ne fait pas plonger la perle dès le haut", () => {
  // **Le défaut que le patron a vu sur son téléphone**, et que cette suite ne
  // voyait pas : tous les autres cas donnent une liste au chemin confortable.
  // Ici elle n'a que 40 px à défiler pour 65 px de descente à faire. L'ancienne
  // règle retranchait bêtement l'un de l'autre : la perle arrivait déjà tombée
  // de 25 px, tout en haut de la liste.
  const CHEMIN = 40;
  assert.equal(
    descenteDeLaPerle({
      milieuDuDernier: MILIEU + DESCENTE_ENTIERE + CHEMIN,
      milieuDuCadre: MILIEU,
      restantADefiler: CHEMIN,
      hauteurADefiler: CHEMIN,
    }),
    0,
    "tout en haut d'une liste courte, la perle a déjà quitté le milieu"
  );
  // Et au bout de ce peu de chemin, elle est quand même arrivée sur le dernier.
  assert.equal(
    descenteDeLaPerle({
      milieuDuDernier: MILIEU + DESCENTE_ENTIERE,
      milieuDuCadre: MILIEU,
      restantADefiler: 0,
      hauteurADefiler: CHEMIN,
    }),
    DESCENTE_ENTIERE
  );
  // À mi-chemin, la moitié : la plongée s'étale au lieu de commencer trop tôt.
  assert.equal(
    descenteDeLaPerle({
      milieuDuDernier: MILIEU + DESCENTE_ENTIERE + CHEMIN / 2,
      milieuDuCadre: MILIEU,
      restantADefiler: CHEMIN / 2,
      hauteurADefiler: CHEMIN,
    }),
    DESCENTE_ENTIERE / 2
  );
});

cas("elle ne descend jamais plus bas que le dernier jour", () => {
  // Le cas du dépassement élastique d'iOS : `scrollTop` passe au-delà du bout,
  // et `restantADefiler` devient négatif. Sans borne, la perle continuerait de
  // plonger sous le dernier chantier, hors de l'écran.
  //
  // **Les entrées doivent rester physiquement cohérentes**, et la première
  // version de ce cas ne l'était pas : elle tirait le défilement 40 px au-delà
  // du bout tout en laissant le dernier chantier là où il est AU bout. Dans un
  // vrai navigateur, le contenu remonte de ces 40 px avec le doigt. Un cas
  // impossible ne prouve rien — au mieux il passe par accident, au pire il fait
  // « corriger » une règle juste.
  const DEBORD = 40;
  const descente = descenteDeLaPerle({
    milieuDuDernier: MILIEU + DESCENTE_ENTIERE - DEBORD,
    milieuDuCadre: MILIEU,
    restantADefiler: -DEBORD,
    hauteurADefiler: 900,
  });
  assert.equal(descente, DESCENTE_ENTIERE);
});

cas("une liste qui ne défile pas et remplit l'écran : la perle NE BOUGE PAS", () => {
  // **L'autre moitié du défaut du 11 août au soir.** La liste tient dans
  // l'écran ; il n'y a donc pas de bout à atteindre, et rien ne justifie de
  // quitter le milieu — où un chantier se trouve. La première version collait
  // la perle au dernier chantier, tout en bas : c'est ce que le patron a vu.
  assert.equal(
    descenteDeLaPerle({
      milieuDuDernier: MILIEU + 80,
      milieuDuCadre: MILIEU,
      restantADefiler: 0,
      hauteurADefiler: 0,
    }),
    0
  );
});

cas("une liste courte : la perle REMONTE sur le dernier, elle ne reste pas au milieu", () => {
  // Corollaire du cas précédent : quand le dernier chantier est lui-même
  // AU-DESSUS du milieu, le milieu ne montre plus rien. C'est le seul endroit
  // où la descente est négative — écrit à part parce qu'un `Math.max(0, …)`
  // posé par réflexe le casserait sans que rien d'autre ne rougisse.
  const descente = descenteDeLaPerle({
    milieuDuDernier: 420,
    milieuDuCadre: MILIEU,
    restantADefiler: 0,
    hauteurADefiler: 0,
  });
  assert.ok(descente < 0, `la perle devrait remonter, elle descend de ${descente} px`);
});

cas("un dernier chantier qui atteint le milieu seul : aucune descente", () => {
  // Si la marge de fin du fil est assez large pour amener le dernier chantier
  // au milieu, il n'y a rien à faire — et forcer une descente le ferait
  // dépasser vers le bas.
  assert.equal(
    descenteDeLaPerle({ milieuDuDernier: MILIEU + 300, milieuDuCadre: MILIEU, restantADefiler: 300, hauteurADefiler: 900 }),
    0
  );
  assert.equal(
    descenteDeLaPerle({ milieuDuDernier: MILIEU + 300, milieuDuCadre: MILIEU, restantADefiler: 340, hauteurADefiler: 900 }),
    0
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La descente de la perle — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
