// **Aucun caractère ne doit plus jamais empêcher un devis de partir.**
//
// ─── Ce qu'il a vu, le 7 septembre 2026 ─────────────────────────────────────
//
// Sous le bouton « Envoyer le devis », en rouge :
//
//     WinAnsi cannot encode "⌀" (0x2300)
//
// Le devis était juste, la date choisie, le client renseigné. Il ne partait
// pas — à cause du signe de diamètre que le produit écrit lui-même, et qu'il
// venait justement de valider : *« j'ai bien aimé le petit rond barré pour
// indiquer le diamètre ; quand on parle de diamètre, s'il peut à chaque fois
// mettre ce signe-là, c'est parfait. »*
//
// ─── POURQUOI CE MODULE EXISTE, plutôt qu'un troisième correctif ────────────
//
// C'est la **troisième** fois que ce mur est frappé, et les deux premières ont
// été réparées à l'endroit exact où elles sont apparues :
//
// | le caractère | d'où il venait | la rustine |
// |---|---|---|
// | U+202F, espace fine | `toLocaleString('fr-FR')` | `euros.ts` écrit U+00A0 |
// | U+2212, moins typographique | la ligne de remise | `document-commun.ts` écrit `-` |
// | **U+2300, le signe ⌀** | `questions-chiffrage.ts` | *celle-ci* |
//
// Trois rustines, un seul défaut : les polices standard d'un PDF sont encodées
// en **WinAnsi**, qui ne connaît que 224 caractères, et `pdf-lib` refuse la
// page entière dès qu'un seul lui échappe. Réparer au cas par cas, c'est
// attendre le quatrième — et le quatrième arrivera d'une DICTÉE, pas du code :
// un nom de client, une note, un mot recopié d'un site. Le devis serait alors
// bloqué par une chaîne que personne n'a écrite.
//
// D'où la règle : **on assainit à l'entrée du papier, une fois pour toutes.**
//
// ─── CE QUE CE MODULE NE FAIT PAS ───────────────────────────────────────────
//
// Il ne touche ni à l'écran, ni à la base, ni aux libellés. Le ⌀ reste le ⌀
// partout dans le produit — c'est SA demande. Seul le papier, qui ne sait pas
// l'écrire, reçoit le Ø. Les deux dessinent un rond barré ; le client ne verra
// pas la différence, et `mesures-arbre.ts` sait déjà relire les deux formes.

/**
 * Ce que WinAnsi sait écrire : l'ASCII imprimable, tout Latin-1, et les
 * vingt-sept caractères que Windows a rangés entre 0x80 et 0x9F.
 *
 * Construit par points de code, jamais par une chaîne littérale : un fichier
 * relu dans le mauvais encodage aurait silencieusement changé ce répertoire,
 * et le contrôle serait devenu faux sans que rien ne le dise.
 */
const REPERTOIRE = new Set<string>();
for (let c = 0x20; c <= 0x7e; c++) REPERTOIRE.add(String.fromCodePoint(c));
for (let c = 0xa0; c <= 0xff; c++) REPERTOIRE.add(String.fromCodePoint(c));
for (const c of [
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]) {
  REPERTOIRE.add(String.fromCodePoint(c));
}
// Le saut de ligne traverse : `enLignes` découpe dessus, et `drawText` le sait.
REPERTOIRE.add("\n");

/**
 * Ce qui se REMPLACE, parce qu'un équivalent dit la même chose.
 *
 * Rien n'est ici par précaution : chaque entrée a été rencontrée, ou sort du
 * même clavier que celles qui l'ont été. Un caractère absent de cette table
 * n'est pas perdu pour autant — il passe par le retrait des accents, puis par
 * la trace ci-dessous.
 */
const REMPLACEMENTS: Readonly<Record<string, string>> = {
  "\u2300": "\u00d8", // ⌀ le signe de diamètre → Ø, le même rond barré
  "\u2205": "\u00d8", // ∅ l'ensemble vide, que certains claviers rendent
  "\u2212": "-", // − le moins typographique
  "\u202f": "\u00a0", // l'espace fine insécable
  "\u2007": "\u00a0", // l'espace tabulaire
  "\u2009": "\u00a0", // l'espace fine
  "\u2032": "'", // ′ le prime
  "\u2033": '"', // ″ le double prime
  "\u2044": "/", // ⁄ la barre de fraction
  "\u2264": "<=",
  "\u2265": ">=",
  "\u2260": "<>",
  "\u00d7": "x", // × la multiplication : WinAnsi la porte, mais pas toutes les
  //                 polices qu'il peut choisir dans ses réglages
  "\u2192": "-",
  "\u2190": "-",
  "\u2022": "-", // • la puce, quand une police embarquée ne l'a pas
  "\t": " ",
};

/**
 * Ce qui a été retiré d'un document, pour que le défaut soit BAVARD.
 *
 * Un caractère effacé en silence, c'est un mot amputé sur le devis d'un client
 * sans que personne ne l'apprenne. On ne bloque plus l'envoi — mais on garde de
 * quoi savoir qu'il a fallu couper, et quoi.
 */
export type RetraitPourPapier = { caractere: string; pointDeCode: string };

export type TextePourPapier = { texte: string; retraits: RetraitPourPapier[] };

/**
 * Le texte tel que le papier sait l'écrire, et ce qu'il a fallu abandonner.
 *
 * Trois passes, dans cet ordre — chacune rattrape ce que la précédente laisse :
 *
 * 1. **la table ci-dessus**, quand un équivalent exact existe ;
 * 2. **le retrait des accents** (`NFD`), qui sauve « ā » en « a » sans rien
 *    inventer — les accents français, eux, sont dans WinAnsi et ne bougent pas ;
 * 3. **le retrait pur et simple**, consigné.
 *
 * Idempotente : la rejouer sur son propre résultat ne change rien. Les
 * fonctions du moteur PDF s'appellent entre elles, et une transformation qui
 * s'appliquerait deux fois finirait par abîmer un texte déjà propre.
 */
export function pourLePapier(brut: string): TextePourPapier {
  const retraits: RetraitPourPapier[] = [];
  let sortie = "";

  for (const caractere of brut) {
    if (REPERTOIRE.has(caractere)) {
      sortie += caractere;
      continue;
    }

    const remplacant = REMPLACEMENTS[caractere];
    if (remplacant !== undefined) {
      sortie += remplacant;
      continue;
    }

    // Le même mot sans ses accents : « ā » devient « a », « ș » devient « s ».
    // On ne traduit rien, on retire un signe que la police ne sait pas poser.
    const deplie = [...caractere.normalize("NFD")]
      .filter((c) => !/\p{Mn}/u.test(c))
      .join("");
    if (deplie !== "" && [...deplie].every((c) => REPERTOIRE.has(c))) {
      sortie += deplie;
      continue;
    }

    retraits.push({
      caractere,
      pointDeCode: `U+${caractere.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`,
    });
  }

  return { texte: sortie, retraits };
}

/** Le texte seul, quand l'appelant n'a rien à faire de ce qui a été retiré. */
export function texteDuPapier(brut: string): string {
  return pourLePapier(brut).texte;
}
