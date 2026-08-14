import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// **« Remplace tous les boutons rectangulaires par les boutons arrondis. »**
// Le patron, le 12 août 2026 — après avoir vu, sur la feuille d'envoi de son
// devis, un bouton carré à côté d'une capsule.
//
// **Pourquoi un contrôle plutôt qu'un simple balayage.** Le balayage a été fait
// une fois ; il ne tiendra pas tout seul. Un écran neuf écrit dans six mois
// reprendra le `rounded-[4px]` du voisin — c'est exactement ce qui s'est passé :
// la capsule avait été posée sur `PrimaryButton` le 11 août, et trois écrans qui
// dessinaient leur bouton à la main ne l'ont jamais su. Le patron l'a vu avant
// nous.
//
// **Ce que ce contrôle NE dit pas.** Il ne demande pas d'employer
// `PrimaryButton` : deux boutons sont des `type="submit"` (connexion, documents
// légaux) et le composant partagé impose `type="button"`, ce qui casserait leur
// formulaire. Il ne juge que la FORME, qui est ce que le patron a demandé.
//
// **Et il ne touche pas aux plages.** Cartes, champs et tuiles gardent leurs
// 4 px : la charte les veut presque droits — « au-delà de 6 px, une plage
// devient un galet et l'écran perd sa tenue » (`ARCHITECTURE.md`). Seules les
// balises interactives sont regardées.

const RACINE = "src";

/** Un rayon rectangulaire posé sur un `<button>` ou un `<a>`. */
// Pas de drapeau `s` : la cible TypeScript du projet ne l'accepte pas, et il
// serait de toute façon inutile — une classe niée comme `[^>]` franchit déjà
// les retours à la ligne. Le typecheck l'a dit avant que quiconque ne le lise.
//
// **`(?:[^>]|=>)` et non `[^>]` — sans quoi ce contrôle ne voit presque rien.**
//
// Découvert le 12 août 2026 au soir, en lui livrant un bouton carré de plus :
// une classe niée `[^>]` s'arrête au premier chevron, **et la flèche d'une
// fonction en porte un**. Tout bouton écrit `onClick={() => …}` — c'est-à-dire
// l'immense majorité — passait donc sous le radar. Trois l'ont fait, sur la
// feuille d'envoi elle-même : exactement l'écran où le patron avait vu « un
// bouton carré à côté d'une capsule ».
//
// Le contrôle avait donc rougi une fois, sur le seul bouton qui n'avait pas de
// `onClick` — et il en laissait passer trois à côté. Un contrôle qui attrape le
// cas rare et manque le cas courant est pire qu'aucun : il fait croire que
// c'est propre.
//
// **Deux angles morts de plus, trouvés le 13 août 2026 — et c'est ENCORE le
// patron qui les a vus, sur « Créer la facture » de la feuille « Y aller ».**
// Ce bouton s'écrit `<Link className="rounded-md">` :
//
//   1. `Link` n'était pas dans la liste des balises. Or c'est la façon normale
//      d'écrire un bouton qui MÈNE quelque part, dans tout ce dépôt ;
//   2. `rounded-md` est un rayon NOMMÉ de Tailwind, pas une valeur entre
//      crochets. Le motif ne cherchait que `rounded-[Npx]`.
//
// Il passait donc deux fois entre les mailles. C'est la troisième fois que ce
// contrôle rate un cas courant en attrapant le cas rare, et la leçon est
// toujours la même : **un motif qui décrit une FAÇON D'ÉCRIRE vieillit** — il
// faut le confronter à ce que le dépôt écrit vraiment, pas à ce qu'on croit
// qu'il écrit.
const RECTANGULAIRE =
  /<(?:button|a|Link)\b(?:[^>]|=>)*?rounded-(?:\[(\d+)px\]|(sm|md|lg|xl|2xl|3xl)\b)(?:[^>]|=>)*>/g;

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      // Les maquettes `/design/*` sont découplées du produit depuis le 1er août :
      // elles racontent un chemin, elles ne sont pas des écrans du patron.
      if (entree === "design") continue;
      sortie.push(...fichiers(chemin));
    } else if (chemin.endsWith(".tsx")) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

/**
 * Ce que ce contrôle ne juge PAS, et pourquoi — chaque ligne a sa raison.
 *
 * **Écrit le 13 août 2026, quand le motif réparé a dénoncé six boutons d'un
 * coup.** Un seul était celui que le patron signalait. Les cinq autres n'ont
 * jamais été arbitrés par lui : les restyler au passage aurait changé
 * l'apparence d'écrans qu'il n'a pas demandés — c'est exactement ce que
 * `CLAUDE.md` §3 bis interdit.
 *
 * **Une exception nommée n'affaiblit pas le contrôle** : un bouton NEUF écrit
 * carré ailleurs le fera toujours rougir. Ce qui l'affaiblirait, ce serait de
 * relâcher le motif — on ne verrait alors plus rien nulle part.
 *
 * Ces cinq points sont dans `TODO.md`, en attente de sa décision.
 */
const HORS_CHARTE: Array<{ motif: RegExp; pourquoi: string }> = [
  // **L'exception des écrans du CLIENT a été LEVÉE le 13 août 2026**, et c'est
  // lui qui a tranché : capture des deux écrans côte à côte, question posée,
  // réponse « oui ». Les quatre boutons que voit son client — accepter,
  // demander une correction, refuser, télécharger la facture — portent
  // désormais la capsule comme les siens. Ils gardent leurs couleurs propres :
  // ce qui devait rester distinct, c'est l'identité, pas la forme du geste.
  //
  // Le champ de saisie de la même page, lui, garde ses coins doux : la charte
  // ne donne la capsule qu'à ce qu'on APPUIE, jamais à ce qu'on remplit.
  {
    // Le chevron de retour : 32 × 32, une icône dans un cadre, pas un bouton
    // d'action. La charte réserve la capsule à ce qu'on FAIT ; l'arrondir
    // entièrement en ferait une pastille ronde, ce qui n'a été demandé nulle
    // part.
    motif: /^src[/\\]components[/\\]ScreenHeader\.tsx$/,
    pourquoi: "chevron de retour, icône encadrée et non bouton d'action",
  },
  {
    // **Une case qu'on REMPLIT, pas un geste qu'on appuie.** La charte est
    // citée juste au-dessus : « elle ne donne la capsule qu'à ce qu'on APPUIE,
    // jamais à ce qu'on remplit ». La case de l'unité est un champ — elle se
    // tient à côté du champ « Prix », dans la même grille, et porte ses 4 px
    // comme lui. En capsule, elle serait le seul galet d'une rangée de champs
    // droits. C'est aussi la forme que le patron a choisie le 14 août 2026
    // (`maquettes/atlas-unite-deroulante.html`, forme 1).
    //
    // Elle est écrite en `<button>` et non en `<input>` parce que sa valeur se
    // CHOISIT : c'est ce que la balise doit dire à qui n'emploie pas ses yeux.
    // La forme et la balise ne se commandent pas l'une l'autre.
    //
    // **Ce que cette exception laisse passer, et qu'il faut savoir :** elle
    // porte sur le fichier entier. Un vrai bouton d'action écrit un jour dans
    // `ChoixUnite.tsx` ne serait plus dénoncé — le fichier ne tient aujourd'hui
    // que cette case et les rangs de sa liste.
    motif: /^src[/\\]components[/\\]atlas[/\\]ChoixUnite\.tsx$/,
    pourquoi: "case d'un champ qu'on remplit, alignée sur le champ « Prix » voisin",
  },
];

/**
 * Le fichier, débarrassé de ses lignes de commentaire.
 *
 * **Sans cela, le contrôle accuse un COMMENTAIRE — vécu le 13 août 2026.** En
 * arrondissant « Créer la facture », la ligne d'explication écrite juste
 * au-dessus citait le rayon qu'on venait de retirer. Le motif l'a lue et a
 * dénoncé un bouton parfaitement rond. Une erreur qui accuse à tort coûte plus
 * cher que pas d'erreur du tout (`AGENTS.md`), et celle-là aurait fait perdre
 * du temps à chercher un défaut inexistant.
 *
 * On ne retire que les lignes qui COMMENCENT par `//` : un `https://` au milieu
 * d'une chaîne n'est pas un commentaire, et le couper casserait le texte
 * examiné juste après.
 */
function sansCommentaires(texte: string): string {
  return texte
    .split("\n")
    .map((l) => (/^\s*\/\//.test(l) ? "" : l))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function main() {
  console.log("=== Tous les boutons sont arrondis ===\n");

  const coupables: string[] = [];
  for (const f of fichiers(RACINE)) {
    const exception = HORS_CHARTE.find((e) => e.motif.test(f));
    if (exception) continue;
    const t = sansCommentaires(readFileSync(f, "utf8"));
    for (const m of t.matchAll(RECTANGULAIRE)) {
      const ligne = t.slice(0, m.index).split("\n").length;
      const rayon = m[1] ? `rayon ${m[1]} px` : `rounded-${m[2]}`;
      coupables.push(`${f}:${ligne} — ${rayon}`);
    }
  }

  const nom = "aucun bouton du produit ne garde un rayon rectangulaire";
  try {
    assert.equal(
      coupables.length,
      0,
      `${coupables.length} bouton(s) rectangulaire(s) :\n    ${coupables.join("\n    ")}\n` +
        "  Le patron a demandé la même forme partout le 12 août 2026. Employez " +
        "`rounded-full`, ou `PrimaryButton` quand ce n'est pas un bouton de formulaire."
    );
    console.log(`  ✓ ${nom}`);
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    console.log("\n❌ Boutons arrondis — 1 échec.");
    process.exit(1);
  }

  // **Le contrôle doit savoir ce qu'il compte.** Un motif qui ne trouverait
  // plus rien — parce qu'on aurait changé la façon d'écrire les classes —
  // passerait au vert sur une application entièrement carrée. On vérifie donc
  // qu'il sait encore reconnaître un bouton rectangulaire quand on lui en
  // montre un.
  //
  // **Quatre témoins, un par angle mort déjà payé.** Un seul témoin ne prouve
  // que le cas qu'il montre : les trois défauts trouvés par le patron sont
  // passés à côté d'un motif qui reconnaissait pourtant « un bouton carré ».
  const temoins: Array<[string, string]> = [
    ["valeur entre crochets", '<button className="rounded-[4px] py-3">Essai</button>'],
    ["flèche de fonction avant la classe", '<button onClick={() => f()} className="rounded-[4px]">E</button>'],
    ["rayon NOMMÉ de Tailwind", '<button className="rounded-md py-3">Essai</button>'],
    ["balise Link, celle du 13 août", '<Link href="/x" className="mt-4 rounded-md py-3">Essai</Link>'],
  ];
  for (const [quoi, temoin] of temoins) {
    const nom2 = `le motif reconnaît encore : ${quoi}`;
    assert.equal(
      [...temoin.matchAll(RECTANGULAIRE)].length,
      1,
      `Le motif ne reconnaît plus « ${quoi} » : ce contrôle passerait au vert sur ce cas-là.`
    );
    console.log(`  ✓ ${nom2}`);
  }

  // **Et l'inverse : la capsule ne doit JAMAIS être dénoncée.** Sans ce cas, un
  // motif trop large rendrait le contrôle rouge en permanence, et l'on
  // apprendrait à l'ignorer — on perdrait alors la forme unique qu'il garde.
  // Le commentaire qui a piégé le contrôle le 13 août : il cite un rayon carré
  // et ne doit plus rien déclencher.
  const enCommentaire = sansCommentaires(
    '        // il était resté en rounded-md\n        <Link href="/x" className="rounded-full">E</Link>'
  );
  assert.equal(
    [...enCommentaire.matchAll(RECTANGULAIRE)].length,
    0,
    "Le motif lit encore les commentaires : il dénoncerait un bouton parfaitement rond."
  );
  console.log("  ✓ un rayon cité dans un COMMENTAIRE ne déclenche rien");

  const capsule = '<Link href="/x" className="rounded-full py-3">Essai</Link>';
  assert.equal(
    [...capsule.matchAll(RECTANGULAIRE)].length,
    0,
    "Le motif dénonce une capsule : le contrôle deviendrait rouge quoi qu'on fasse."
  );
  console.log("  ✓ une capsule `rounded-full` n'est jamais dénoncée");

  console.log("\n✅ Boutons arrondis — 0 échec.");
}

main();
