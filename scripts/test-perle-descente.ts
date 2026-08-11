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
    }),
    DESCENTE_ENTIERE - restant
  );
});

cas("elle ne descend jamais plus bas que le dernier jour", () => {
  // Le cas du dépassement élastique d'iOS : `scrollTop` peut passer au-delà du
  // bout, et `restantADefiler` devenir négatif. Sans garde, la perle
  // continuerait de plonger sous le dernier chantier, hors de l'écran.
  const descente = descenteDeLaPerle({
    milieuDuDernier: MILIEU + DESCENTE_ENTIERE,
    milieuDuCadre: MILIEU,
    restantADefiler: -40,
  });
  assert.equal(descente, DESCENTE_ENTIERE);
});

cas("une liste qui ne défile pas : la perle rejoint le dernier tout de suite", () => {
  // Un artisan qui n'a qu'un ou deux chantiers. La liste tient dans l'écran,
  // il n'y a pas de « bout » à atteindre — et la perle laissée au milieu
  // désignerait le vide sous le dernier.
  assert.equal(
    descenteDeLaPerle({ milieuDuDernier: 420, milieuDuCadre: MILIEU, restantADefiler: 0 }),
    420 - MILIEU
  );
});

cas("une liste courte : la perle REMONTE sur le dernier, elle ne reste pas au milieu", () => {
  // Corollaire du cas précédent, et le seul endroit où la descente est
  // négative. Écrit à part parce qu'un `Math.max(0, …)` posé par réflexe le
  // casserait sans que rien d'autre ne rougisse.
  const descente = descenteDeLaPerle({
    milieuDuDernier: 420,
    milieuDuCadre: MILIEU,
    restantADefiler: 0,
  });
  assert.ok(descente < 0, `la perle devrait remonter, elle descend de ${descente} px`);
});

cas("un dernier chantier qui atteint le milieu seul : aucune descente", () => {
  // Si la marge de fin du fil est assez large pour amener le dernier chantier
  // au milieu, il n'y a rien à faire — et forcer une descente le ferait
  // dépasser vers le bas.
  assert.equal(
    descenteDeLaPerle({ milieuDuDernier: MILIEU + 300, milieuDuCadre: MILIEU, restantADefiler: 300 }),
    0
  );
  assert.equal(
    descenteDeLaPerle({ milieuDuDernier: MILIEU + 300, milieuDuCadre: MILIEU, restantADefiler: 340 }),
    0
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La descente de la perle — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
