import assert from "node:assert";
import { CHARTES, contraste, estSombre, type Charte } from "../src/lib/chartes";

/**
 * TOUTES LES CHARTES SE LISENT — chacune, et sur chaque couple que l'écran pose.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le défaut qu'elle empêche de revenir, et il a été payé le 22 août 2026.**
 *
 * Sa capture du planning en « Nuit », et six mots : ***« le mode nuit est
 * illisible »***. Trois familles de fautes, toutes invisibles sur les cinq
 * chartes claires :
 *
 *   1. **Un crème écrit en clair sur l'accent.** La pastille d'équipe portait
 *      « Julien ＋ » en `#faf9f5` sur `colors.rust`. Sur Origine l'accent est un
 *      vert pin sombre : parfait. Sur Nuit, **l'accent EST l'encre** — un crème
 *      sur un crème, 1,05 de contraste. Huit endroits dans le dépôt faisaient
 *      la même chose, `fill="white"` compris.
 *   2. **Un voile d'encre écrit en clair.** Le calendrier éteignait ses
 *      week-ends avec `rgba(28,28,26,0.42)` — l'encre d'Origine. Sur un fond
 *      noir, du noir à 42 % est du noir : les chiffres « 29 » et « 30 » de sa
 *      capture n'existaient pas (1,04).
 *   3. **Trois couleurs de signal tenues pour immuables.** `design-tokens.ts`
 *      affirmait qu'alerte, bordeaux et vert pâle n'avaient pas à suivre la
 *      charte. Leur rôle est pourtant que quatre états se distinguent d'un coup
 *      d'œil — et sur les sombres, « incomplet » et « complet » devenaient deux
 *      blancs (1,5), le dépassement disparaissait dans le fond (1,76), et un
 *      refus se lisait à 2,5.
 *
 * **Pourquoi une suite SANS navigateur en plus de celle qui regarde l'écran.**
 * Celle-ci ne dépend d'aucun serveur, d'aucune base, d'aucun écran : elle tombe
 * dans les dix secondes de `npm test`, en nommant la charte, le couple et le
 * chiffre. La suite navigateur, elle, attrape ce que celle-ci ne peut pas voir
 * — une couleur écrite en clair DANS un écran, hors de toute charte. Il faut
 * les deux, et aucune ne remplace l'autre.
 *
 * **Elle sait échouer**, et cela a été vérifié en la confrontant à l'état
 * qu'elle prétend détecter : en rendant `alerte`, `bordeaux` et `vertPale` à
 * leur valeur d'Origine sur toutes les chartes — c'est-à-dire au dépôt d'avant
 * ce lot —, elle rougit sur six couples de Nuit et de Sylve.
 * ─────────────────────────────────────────────────────────────────────────────
 */

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

/** Du texte : le seuil de la norme pour un corps courant. */
const TEXTE = 4.5;
/** Un aplat de quelques pixels — une barre, un carré de légende. */
const APLAT = 3;

/**
 * Les couples que l'interface pose RÉELLEMENT, et rien d'autre.
 *
 * **Le piège évité, et c'est la §5 bis de `CLAUDE.md` :** une suite qui
 * exigerait 4,5 entre toutes les paires possibles réclamerait ce que le patron
 * n'a jamais demandé. Deux exemples pris sur SES chartes, et tous deux
 * volontaires :
 *
 *   · sur Origine, le bordeaux du dépassement et le vert pin plein tiennent
 *     **1,10** l'un contre l'autre — ils ne se distinguent pas par la clarté
 *     mais par la TEINTE, rouge contre vert, et cela lui va ;
 *   · le vert pâle sur le creux d'une barre tient **1,69** : c'est le liseré de
 *     la barre qui la dessine, pas le remplissage.
 *
 * Une suite qui ferait rougir ces deux-là accuserait le dessin qu'il a choisi.
 * On ne garde donc que les couples dont la lisibilité est vraiment en jeu, et
 * chacun porte le nom de l'endroit où il se voit.
 */
type Couple = { quoi: string; devant: (c: Charte) => string; derriere: (c: Charte) => string };

/** Ce qui doit passer sur TOUTES les chartes, sans exception. */
const ABSOLUS: (Couple & { seuil: number })[] = [
  { quoi: "l'encre sur le fond de page", devant: (c) => c.jetons.ink, derriere: (c) => c.jetons.cream, seuil: TEXTE },
  { quoi: "l'encre sur une plage", devant: (c) => c.jetons.ink, derriere: (c) => c.jetons.card, seuil: TEXTE },
  { quoi: "le texte de second plan sur une plage", devant: (c) => c.jetons.inkSoft, derriere: (c) => c.jetons.card, seuil: TEXTE },
  // ─── Ce qu'on écrit SUR un aplat plein ────────────────────────────────────
  // C'est la faute de la pastille d'équipe, et ce couple-ci est ce qui autorise
  // `design-tokens.ts` à poser `surPlein = card` plutôt qu'un crème en clair.
  { quoi: "ce qu'on écrit sur l'accent plein (surPlein)", devant: (c) => c.jetons.card, derriere: (c) => c.jetons.rust, seuil: TEXTE },
  { quoi: "ce qu'on écrit sur le rouge d'alerte (surPlein)", devant: (c) => c.jetons.card, derriere: (c) => c.jetons.alerte, seuil: TEXTE },
  // Le fond de page sert lui aussi d'encre sur l'accent — `ActionPrincipale`,
  // `CalendrierPeriodes`.
  { quoi: "le fond de page écrit sur l'accent", devant: (c) => c.jetons.cream, derriere: (c) => c.jetons.rust, seuil: TEXTE },
  // ─── Un refus doit pouvoir se lire ────────────────────────────────────────
  { quoi: "le rouge d'alerte sur une plage", devant: (c) => c.jetons.alerte, derriere: (c) => c.jetons.card, seuil: TEXTE },
  { quoi: "le rouge d'alerte sur le fond de page", devant: (c) => c.jetons.alerte, derriere: (c) => c.jetons.cream, seuil: TEXTE },
  // ─── L'OR QUAND IL PORTE UN MOT — ajouté le 5 septembre 2026 ─────────────
  //
  // **Ce que ce couple ferme, et pourquoi il manquait.** `or` figure plus bas,
  // dans les couples RELATIFS : on lui demande seulement de ne pas faire pire
  // sur les sombres que sur les claires, parce que le patron a fixé son niveau
  // lui-même. C'est juste tant qu'il dessine — un filet, un sceau, un marqueur
  // d'onglet. Ça ne l'est plus dès qu'il écrit un mot : « à chiffrer » sur la
  // plage d'Origine donnait **2,91**, et l'écran des prix se lit en plein
  // soleil, d'une main.
  //
  // Ce contrôle-ci porte donc sur `orTexte`, qui est le même or assombri
  // jusqu'au seuil (`chartes.ts`), et il sait échouer : en rendant `orTexte`
  // égal à `or`, les six chartes claires rougissent d'un coup.
  { quoi: "l'or d'un mot sur une plage", devant: (c) => c.jetons.orTexte, derriere: (c) => c.jetons.card, seuil: TEXTE },
  { quoi: "l'or d'un mot sur le fond de page", devant: (c) => c.jetons.orTexte, derriere: (c) => c.jetons.cream, seuil: TEXTE },
  // ─── L'OR SUR L'ENCRE PRISE POUR FOND — ajouté le 5 septembre 2026 ───────
  //
  // **Le couple que ni celui du dessus ni aucun autre ne couvrait.** La
  // visionneuse de photos prend `ink` pour FOND, pour qu'on ne voie que la
  // photo — et là les pôles s'inversent : sur Nuit et Sylve l'encre est un
  // crème. L'or du mot « Retirer » y tenait **2,49**, et la croix pour sortir,
  // écrite `#F6F1E6` en clair, **1,09**.
  //
  // C'est la leçon du §257 appliquée une seconde fois : un jeton mesuré dans
  // un rôle n'est pas mesuré dans tous. Il sait échouer — en rendant
  // `orSurEncre` égal à `or`, les deux sombres rougissent (2,49 et 2,55).
  //
  // **`surPlein` sur l'encre n'a pas son couple ici, et c'est voulu :** le
  // contraste est symétrique, et « l'encre sur une plage » le mesure déjà
  // plus haut. Un couple de plus n'aurait rien prouvé de neuf.
  { quoi: "l'or d'un mot sur l'encre prise pour fond", devant: (c) => c.jetons.orSurEncre, derriere: (c) => c.jetons.ink, seuil: TEXTE },
  // ─── Deux des quatre états du calendrier, et seulement ces deux-là ────────
  // « incomplet » contre « complet » : sur les cinq claires, de 6,6 à 9,5.
  // Avant ce lot, 1,5 sur les deux sombres — deux blancs.
  { quoi: "« incomplet » contre « complet »", devant: (c) => c.jetons.vertPale, derriere: (c) => c.jetons.rust, seuil: APLAT },
  // « au-delà » sur le creux de sa barre : de 9,1 à 10,2 sur les claires, 1,76
  // sur Nuit — le dépassement disparaissait dans le fond.
  { quoi: "« au-delà » sur le creux de la barre", devant: (c) => c.jetons.bordeaux, derriere: (c) => c.jetons.card, seuil: APLAT },
];

/**
 * Ce dont le patron a fixé le niveau LUI-MÊME, en choisissant ses cinq chartes
 * claires. On n'y met pas de chiffre : on exige que les deux sombres ne fassent
 * pas moins bien que la plus faible des cinq.
 *
 * **Pourquoi pas un seuil écrit.** `muted` tient 3,49 sur Origine et 3,24 sur
 * Moka — c'est SA planche, relevée au navigateur. Écrire « 3,4 » ici ferait
 * rougir Moka, c'est-à-dire accuser un choix qu'il a fait ; écrire « 3,2 »
 * serait un chiffre inventé qui ne défendrait plus rien le jour où une charte
 * claire descendrait. Le clair est la référence, et il se mesure.
 */
const PAS_PIRE_QUE_LE_CLAIR: Couple[] = [
  { quoi: "le texte secondaire sur une plage", devant: (c) => c.jetons.muted, derriere: (c) => c.jetons.card },
  { quoi: "l'or sur une plage", devant: (c) => c.jetons.or, derriere: (c) => c.jetons.card },
  { quoi: "l'or sur le fond de page", devant: (c) => c.jetons.or, derriere: (c) => c.jetons.cream },
];

console.log(`=== Les ${CHARTES.length} chartes se lisent ===\n`);

for (const c of CHARTES) {
  test(`${c.libelle} — chaque couple de l'écran se lit`, () => {
    const manques = ABSOLUS.map((p) => ({
      quoi: p.quoi,
      devant: p.devant(c),
      derriere: p.derriere(c),
      seuil: p.seuil,
      mesure: contraste(p.devant(c), p.derriere(c)),
    })).filter((p) => p.mesure < p.seuil);
    assert.equal(
      manques.length,
      0,
      `${c.libelle} :\n` +
        manques
          .map(
            (m) =>
              `      ${m.quoi} — ${m.devant} sur ${m.derriere} : ${m.mesure.toFixed(2)} ` +
              `(il en faut ${m.seuil})`
          )
          .join("\n")
    );
  });
}

const CLAIRES = CHARTES.filter((c) => !estSombre(c.jetons));
const SOMBRES = CHARTES.filter((c) => estSombre(c.jetons));

for (const p of PAS_PIRE_QUE_LE_CLAIR) {
  test(`Le sombre ne fait pas moins bien que le clair — ${p.quoi}`, () => {
    const plancher = Math.min(...CLAIRES.map((c) => contraste(p.devant(c), p.derriere(c))));
    const quiTientLePlancher = CLAIRES.find(
      (c) => contraste(p.devant(c), p.derriere(c)) === plancher
    );
    for (const c of SOMBRES) {
      const mesure = contraste(p.devant(c), p.derriere(c));
      assert.ok(
        mesure >= plancher,
        `${c.libelle} : ${p.quoi} — ${p.devant(c)} sur ${p.derriere(c)} tient ${mesure.toFixed(2)}, ` +
          `moins que ${quiTientLePlancher?.libelle} (${plancher.toFixed(2)}), la plus faible de ses chartes claires`
      );
    }
  });
}

// ─── Ce que ce lot promet au patron, et qu'il faut tenir ────────────────────
//
// **Les cinq chartes claires ne bougent pas d'un caractère.** C'est la
// condition qu'il n'a pas eu à poser : il regarde « Origine » tous les jours, et
// une correction du mode nuit qui repeindrait son écran de tous les jours ne
// serait pas une correction.
test("Les chartes CLAIRES gardent les valeurs du patron, au caractère près", () => {
  for (const c of CHARTES.filter((x) => !estSombre(x.jetons))) {
    assert.equal(c.jetons.alerte.toLowerCase(), "#9c3b2e", `${c.libelle} a bougé son rouge d'alerte`);
    assert.equal(c.jetons.bordeaux.toLowerCase(), "#6e2433", `${c.libelle} a bougé son bordeaux`);
    assert.equal(c.jetons.vertPale.toLowerCase(), "#b9c6b4", `${c.libelle} a bougé son vert pâle`);
  }
});

test("Origine reste Origine — les treize jetons d'avant, intacts", () => {
  const j = CHARTES[0].jetons;
  assert.equal(CHARTES[0].nom, "origine");
  const attendu: Partial<Record<keyof typeof j, string>> = {
    cream: "#f5f3ee",
    card: "#faf9f5",
    ink: "#1c1c1a",
    inkSoft: "#4a4a44",
    muted: "#8a8578",
    rust: "#2f3b2f",
    rustDeep: "#4f5f4c",
    rustTint: "#ece9e1",
    or: "#B98B47",
    orClair: "#C9A15E",
    line: "rgba(28,28,26,0.12)",
    lineSoft: "rgba(28,28,26,0.07)",
    chevron: "rgba(28,28,26,0.28)",
  };
  for (const [cle, valeur] of Object.entries(attendu) as [keyof typeof j, string][]) {
    assert.equal(j[cle], valeur, `origine.${cle} a bougé`);
  }
});

// **Deux chartes sombres, et il faut qu'elles le soient vraiment** : une
// comparaison sans écart possible n'est pas une mesure (`CLAUDE.md` §5).
test("Deux chartes sont bien sombres — sinon rien de ce qui précède ne mesure rien", () => {
  const sombres = CHARTES.filter((c) => estSombre(c.jetons)).map((c) => c.nom);
  assert.deepEqual(sombres, ["sylve", "nuit"], `chartes sombres trouvées : ${JSON.stringify(sombres)}`);
  // Et `sombre` déclaré à la main doit dire la même chose que la mesure : deux
  // sources qui divergent, c'est la §3 de `CLAUDE.md`.
  for (const c of CHARTES) {
    assert.equal(c.sombre, estSombre(c.jetons), `${c.libelle} se déclare sombre=${c.sombre} et ne l'est pas`);
  }
});

console.log(`\n${failed === 0 ? "✅" : "❌"} Chartes lisibles — ${passed} réussi(s), ${failed} échec(s).`);
process.exit(failed === 0 ? 0 : 1);
