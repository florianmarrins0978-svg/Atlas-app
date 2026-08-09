import assert from "node:assert/strict";
import {
  CELLULE_GRUMES,
  DIAMETRES,
  HAUTEURS,
  celluleAbattage,
  celluleDepuisCle,
  celluleDeNature,
  celluleDessouchage,
  celluleFendage,
  cellulesDe,
  prixDuFendage,
  toutesLesCellules,
  trancheDe,
  type NatureGrille,
} from "../src/lib/grille-prix";
import { diametreLu, hauteurLue, mesuresArbre, tonnageLu } from "../src/lib/mesures-arbre";

// **La grille de fendage — hauteur de l'arbre × diamètre du tronc.**
//
// Le patron, le 8 août 2026 : *« pour la fente, ils devraient demander la
// hauteur de l'arbre et son diamètre, et on crée une liste de prix en fonction
// de la hauteur et du diamètre, comme ça il n'invente rien. »* Puis, sur une
// première grille à 3 × 3 : *« par contre il faut faire plus de tranche. »*
//
// Ce que cette suite tient :
//
//   1. **rien n'est inventé.** Une case vide reste vide : pas d'interpolation
//      depuis les voisines, pas de prix « approché ». C'est la promesse entière
//      de la grille, et elle se perdrait en une ligne de code ;
//   2. **les bornes ne bougent pas en silence.** Les clés (`h10|d40`) sont
//      écrites en base : les changer sans y penser rendrait introuvables tous
//      les prix déjà rangés ;
//   3. **les valeurs rondes tombent du bon côté.** 40, 50, 60 sont précisément
//      les diamètres qu'un artisan annonce. Se tromper de côté sur ces trois-là
//      déplacerait la majorité des cas.

let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Assez de tranches, et des bornes qui ne bougent pas ===\n");

cas("la grille compte 48 cases — « il faut faire plus de tranche »", () => {
  assert.equal(DIAMETRES.length, 8, "moins de huit diamètres : on retombe sur la grille qu'il a refusée");
  assert.equal(HAUTEURS.length, 6);
  assert.equal(toutesLesCellules().length, 48);
});

cas("les clés sont uniques et stables", () => {
  const cles = toutesLesCellules().map((c) => c.cle);
  assert.equal(new Set(cles).size, cles.length, "deux cases portent la même clé : leurs prix s'écraseraient");
  // Un échantillon écrit en dur : si ces trois-là changent, tous les prix déjà
  // rangés en base deviennent introuvables — sans erreur, sans message.
  assert.ok(cles.includes("h10|d40"));
  assert.ok(cles.includes("h0|d0"));
  assert.ok(cles.includes("h25|d90"));
});

cas("les tranches se touchent sans trou ni recouvrement", () => {
  for (const liste of [DIAMETRES, HAUTEURS]) {
    for (let i = 1; i < liste.length; i++) {
      assert.equal(liste[i].de, liste[i - 1].a, `trou ou recouvrement entre « ${liste[i - 1].libelle} » et « ${liste[i].libelle} »`);
    }
    assert.equal(liste[0].de, 0, "la première tranche ne part pas de zéro : les petits arbres n'ont pas de case");
    assert.equal(liste[liste.length - 1].a, null, "la dernière tranche est fermée : un arbre plus gros n'aurait pas de case");
  }
});

console.log("\n=== Les valeurs rondes tombent du bon côté ===");

cas("un tronc de 50 cm est « 40 à 50 », pas « 50 à 60 »", () => {
  assert.equal(trancheDe(50, DIAMETRES)!.libelle, "40 à 50 cm");
  assert.equal(trancheDe(40, DIAMETRES)!.libelle, "30 à 40 cm");
  assert.equal(trancheDe(70, DIAMETRES)!.libelle, "60 à 70 cm");
  assert.equal(trancheDe(50.5, DIAMETRES)!.libelle, "50 à 60 cm");
});

cas("un arbre de 10 m est « 5 à 10 », pas « 10 à 15 »", () => {
  assert.equal(trancheDe(10, HAUTEURS)!.libelle, "5 à 10 m");
  assert.equal(trancheDe(12.5, HAUTEURS)!.libelle, "10 à 15 m");
  assert.equal(trancheDe(30, HAUTEURS)!.libelle, "plus de 25 m");
});

cas("une mesure qui n'en est pas une ne se range nulle part", () => {
  // Ranger au hasard ce qu'on n'a pas mesuré ferait sortir un prix décidé pour
  // un autre arbre.
  for (const valeur of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(trancheDe(valeur, DIAMETRES), null, `${valeur} a trouvé une tranche`);
  }
});

console.log("\n=== Sans les DEUX mesures, il n'y a pas de case ===");

cas("une seule mesure ne désigne rien", () => {
  assert.equal(celluleFendage(12, null), null, "un prix sortirait sans connaître le diamètre");
  assert.equal(celluleFendage(null, 45), null, "un prix sortirait sans connaître la hauteur");
  assert.equal(celluleFendage(null, null), null);
});

cas("les deux mesures désignent une case, et son libellé se lit", () => {
  const c = celluleFendage(12, 45)!;
  assert.equal(c.cle, "h10|d40");
  assert.equal(c.libelle, "10 à 15 m de haut · tronc de 40 à 50 cm");
});

cas("une case se retrouve depuis sa clé, et une clé inventée ne rend rien", () => {
  assert.equal(celluleDepuisCle("h10|d40")!.libelle, "10 à 15 m de haut · tronc de 40 à 50 cm");
  for (const fausse of ["", "h99|d40", "h10", "d40|h10", "; DROP TABLE"]) {
    assert.equal(celluleDepuisCle(fausse), null, `« ${fausse} » a désigné une case`);
  }
});

console.log("\n=== Une case vide reste vide : AUCUNE interpolation ===");

cas("un prix ne sort que de la case exacte", () => {
  const grille = new Map([["h10|d40", "250.00"]]);
  assert.equal(prixDuFendage(celluleFendage(12, 45), grille)!.prix, "250.00");
});

cas("une case vide entourée de cases pleines ne se devine pas", () => {
  // **Le contrôle qui protège la promesse entière.** Un prix deviné se
  // présenterait avec l'autorité des voisins, et le patron n'aurait aucun moyen
  // de voir qu'il n'a jamais été décidé. Mieux vaut poser la question.
  const grille = new Map([
    ["h10|d30", "200.00"],
    ["h10|d50", "300.00"],
    ["h5|d40", "180.00"],
    ["h15|d40", "320.00"],
  ]);
  assert.equal(
    prixDuFendage(celluleFendage(12, 45), grille),
    null,
    "un prix a été fabriqué à partir des cases voisines"
  );
});

cas("sans case, pas de prix", () => {
  assert.equal(prixDuFendage(null, new Map([["h10|d40", "250.00"]])), null);
});

console.log("\n=== Lire la hauteur et le diamètre dans ce qui a été dit ===");

cas("les formes que produit une vraie dictée", () => {
  assert.equal(diametreLu("Abattage d'un chêne mort — ⌀ 70 cm"), 70);
  assert.equal(diametreLu("Abattage, diamètre 45"), 45);
  assert.equal(diametreLu("un tronc de 60 cm de diamètre"), 60);
  assert.equal(hauteurLue("Abattage d'un chêne mort, 20 mètres de haut"), 20);
  assert.equal(hauteurLue("12 m de haut"), 12);
  assert.equal(hauteurLue("hauteur 12,5"), 12.5);
});

cas("« 50 cm de haut » n'est pas une hauteur d'arbre en mètres", () => {
  // Le piège : un centimètre lu comme un mètre rangerait la fente d'un buisson
  // dans la case d'un arbre de cinquante mètres.
  assert.equal(hauteurLue("bille de 50 cm de haut"), null);
});

cas("un arbre « assez gros » n'a pas de diamètre", () => {
  // Sans nombre, aucune mesure : la question sera posée, et c'est ce qu'on veut.
  assert.equal(diametreLu("un gros chêne, diamètre à préciser sur place"), null);
  assert.equal(hauteurLue("un arbre très haut"), null);
});

cas("les nombres DICTÉS, en toutes lettres", () => {
  // **Le cas ordinaire, pas l'exception.** Le patron parle, il ne tape pas : sa
  // dictée de référence dit « un chêne mort de vingt mètres de haut », jamais
  // « 20 m ». Une lecture qui n'accepte que les chiffres reposerait la question
  // à chaque fois, et la case de la grille resterait introuvable.
  assert.equal(hauteurLue("un chêne mort à abattre, de vingt mètres de haut"), 20);
  assert.equal(hauteurLue("douze mètres de haut"), 12);
  assert.equal(diametreLu("diamètre soixante-dix"), 70);
  assert.equal(diametreLu("quatre-vingt-dix centimètres de diamètre"), 90);
  assert.equal(diametreLu("cent vingt cm de diamètre"), 120);
});

cas("ce qui n'est pas un nombre le reste", () => {
  // La récriture ne doit toucher QUE des nombres. « cent » dans « pour cent »
  // en est un ; « chêne » n'en est pas un, et « on coupe en cinquante » n'est
  // pas un diamètre — c'est du billonnage.
  assert.equal(diametreLu("on coupe le bois en cinquante centimètres"), null);
  assert.equal(hauteurLue("un chêne mort à abattre"), null);
  assert.equal(hauteurLue("taille de haie de laurier, vingt mètres de long"), null);
});

cas("ses réponses l'emportent sur ce que la transcription a entendu", () => {
  // « soixante-dix » entendu « 17 » est un accident courant. Ce qu'il a répondu
  // à l'arrêt est ce qu'il a voulu dire.
  const m = mesuresArbre(["⌀ 70 cm"], ["Abattage d'un chêne, diamètre 17 cm, 20 mètres de haut"]);
  assert.equal(m.diametreCm, 70);
  assert.equal(m.hauteurM, 20, "la hauteur, elle, vient bien de la dictée quand il n'a pas répondu");
});

console.log("\n=== Cinq natures, cinq formes, et aucune case qui s'invente ===");

// **Sa réponse du 8 août 2026 :** *« le dessouchage oui, et les grumes aussi. »*
// Deux natures de plus, et deux formes qui n'existaient pas — un seul axe pour
// la souche, une case unique au forfait pour les grumes.

cas("chaque nature a le nombre de cases annoncé", () => {
  const attendu: Record<NatureGrille, number> = {
    fendage: DIAMETRES.length * HAUTEURS.length,
    abattage: 3 * DIAMETRES.length,
    haie: 1,
    dessouchage: DIAMETRES.length,
    grumes: 1,
  };
  for (const [nature, n] of Object.entries(attendu)) {
    assert.equal(cellulesDe(nature as NatureGrille).length, n, `${nature} : mauvais nombre de cases`);
  }
});

cas("le dessouchage se chiffre au diamètre, jamais à la hauteur", () => {
  // La hauteur de l'arbre qui n'est plus là ne décide de rien. La souche, elle,
  // a un diamètre — et c'est le même tronc, donc les mêmes tranches.
  const c = celluleDessouchage(65);
  assert.ok(c);
  assert.equal(c.cle, "d60", `case « ${c.cle} » au lieu de « d60 »`);
  assert.match(c.libelle, /souche/i);

  // **Les mêmes tranches que l'abattage, bornes comprises.** 70 cm tombe dans
  // « 60 à 70 » parce que la borne haute est incluse — deux jeux de tranches
  // pour le même tronc finiraient par ranger le même chêne dans deux cases.
  assert.equal(celluleDessouchage(70)!.cle, "d60");
  assert.equal(celluleDessouchage(70)!.diametre.cle, celluleAbattage("au_pied", 70)!.diametre.cle);
  // Aucune trace de hauteur dans la clé : la case d'un chêne de 5 m et celle
  // d'un chêne de 25 m sont la même dès que le tronc fait 70 cm.
  assert.doesNotMatch(c.cle, /\|/, "la clé porte deux axes alors qu'il n'y en a qu'un");
});

cas("sans diamètre, pas de case de dessouchage — la question se pose", () => {
  assert.equal(celluleDessouchage(null), null);
});

cas("les clés d'une nature ne désignent rien dans une autre", () => {
  // C'est ce qui protège la base : `d70` existe pour le dessouchage et pour le
  // fendage, mais pas avec le même sens. L'unicité en base porte sur le couple
  // (nature, cellule) depuis la migration 0027 — sans quoi poser un prix de
  // souche effacerait un prix de fente.
  assert.ok(celluleDeNature("dessouchage", "d70"), "d70 devrait exister en dessouchage");
  assert.equal(celluleDeNature("dessouchage", "au_pied|d70"), null, "une clé d'abattage passe en dessouchage");
  assert.equal(celluleDeNature("grumes", "d70"), null, "une clé de diamètre passe en grumes");
  assert.ok(celluleDeNature("grumes", CELLULE_GRUMES));
});

cas("les grumes n'ont qu'une case, et elle dit son unité : la tonne", () => {
  // **Sa réponse du 9 août 2026 :** *« à la tonne. »* La réserve de la veille
  // est levée. Le libellé doit le dire — un prix saisi ici sera MULTIPLIÉ par
  // le tonnage, et le taire ferait écrire un forfait dans une case qui n'en est
  // pas une.
  const [c] = cellulesDe("grumes");
  assert.equal(c.cle, CELLULE_GRUMES);
  assert.equal(CELLULE_GRUMES, "tonne", "la clé de la case ne dit plus son unité");
  assert.match(c.libelle, /tonne/i);
});

console.log("\n=== Le tonnage, lu dans ce qui a été dit ===");

cas("les formes qu'une dictée produit", () => {
  assert.equal(tonnageLu("Enlèvement des grumes, 3 tonnes"), 3);
  assert.equal(tonnageLu("8 T de grumes"), 8);
  assert.equal(tonnageLu("2,5 tonnes de bois d'œuvre"), 2.5);
  assert.equal(tonnageLu("tonnage 12"), 12);
  // Il parle, il ne tape pas — la dictée écrit les nombres en toutes lettres.
  assert.equal(tonnageLu("enlèvement de trois tonnes de grumes"), 3);
});

cas("ce qui n'est PAS un tonnage n'en devient pas un", () => {
  // Sans nombre, aucune mesure : la question sera posée, et c'est ce qu'on veut.
  assert.equal(tonnageLu("enlèvement des grumes"), null);
  assert.equal(tonnageLu("beaucoup de grumes"), null);
  // Le piège du « t » isolé : il ne doit pas s'accrocher au premier mot venu.
  assert.equal(tonnageLu("3 troncs à enlever"), null, "« 3 troncs » a été lu comme 3 tonnes");
  assert.equal(tonnageLu("abattage à 250 €"), null);
});

cas("un tonnage n'est ni une hauteur ni un diamètre", () => {
  // Le piège de la haie, transposé : une dictée porte plusieurs nombres, et
  // chacun désigne autre chose. Les confondre range le prix dans une case qui
  // n'a rien à voir.
  const dictee = "Abattage d'un chêne de vingt mètres de haut, diamètre 70, 8 tonnes de grumes";
  assert.equal(tonnageLu(dictee), 8);
  assert.equal(hauteurLue(dictee), 20);
  assert.equal(diametreLu(dictee), 70);
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
