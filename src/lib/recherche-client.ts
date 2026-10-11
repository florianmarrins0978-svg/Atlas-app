/**
 * Retrouver un client en tapant son nom.
 *
 * **Sa demande du 20 août 2026 :** *« Il faut une barre de recherche où je peux
 * taper le nom d'un client pour le retrouver plus facilement »* — capture à
 * l'appui, sur une liste de vingt et un noms dont quatre s'appellent Martins.
 * Elle reprend celle du 17 août, dessinée dans `appli/clients-recherche.html` :
 * *« une recherche en haut, on cherche Monsieur Martins, le nom sort, on clique
 * dessus »*.
 *
 * **Règle pure, hors de tout écran** (`CLAUDE.md` §3) : la même fonction sert à
 * filtrer la liste et à l'éprouver. Deux implémentations — une dans l'écran,
 * une dans la suite — finiraient par diverger, et c'est l'écran qui aurait
 * tort sans que rien ne le dise.
 */

/**
 * Le texte tel qu'on le COMPARE : sans accents, sans casse, sans ponctuation.
 *
 * **Trois pièges, tous tirés de sa propre liste de clients :**
 *
 *   · il tape « martins » et sa fiche porte « Martins » — la casse ne doit rien
 *     décider ;
 *   · il tape « renard » et sa fiche porte « Mme Renard » — le nom cherché est
 *     rarement au début, donc on cherche N'IMPORTE OÙ dans la ligne ;
 *   · il tape « moreau » sur un clavier de téléphone, sans accent, et la fiche
 *     porte « Moréau ». Un artisan entre deux chantiers ne va pas maintenir la
 *     touche « e » pour trouver son client.
 *
 * `normalize("NFD")` sépare la lettre de son accent, et l'on retire ensuite les
 * accents seuls. C'est la seule façon qui traite « é », « è », « ê » et « ë »
 * du même geste, sans table à tenir à jour.
 */
export function normaliserPourRecherche(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    // Un point, une apostrophe ou un tiret ne doivent pas séparer deux
    // orthographes du même nom : « M. Dupont », « M Dupont » et « Mr. Dupont »
    // se cherchent tous les trois en tapant « dupont ».
    .replace(/[.'’\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * La même normalisation, **caractère par caractère**.
 *
 * **Pourquoi elle existe, et pourquoi ce n'est pas une seconde règle.** Pour
 * surligner ce qui a été trouvé, il faut savoir QUELLES LETTRES du nom
 * correspondent. Or `normaliserPourRecherche` change la longueur du texte —
 * « Moréau » y perd son accent, une apostrophe y devient une espace, deux
 * espaces n'en font plus qu'une : l'indice d'une lettre dans le texte comparé
 * ne désigne plus la même lettre dans le nom affiché, et le surlignage tombe à
 * côté d'un caractère.
 *
 * Les deux fonctions font le même travail sur les mêmes caractères ; seul le
 * regroupement des espaces diffère, et il est sans effet sur la recherche
 * puisqu'un mot cherché n'en contient jamais. `test-recherche-client.ts` le
 * VÉRIFIE plutôt que de le promettre : deux règles qui se ressemblent finissent
 * toujours par diverger (`CLAUDE.md` §3).
 */
export function normaliserCaractere(caractere: string): string {
  const nu = caractere
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  // Un accent seul ne laisse rien : il ne se compare pas, et il ne se surligne
  // pas non plus — c'est la lettre qu'il porte qui compte.
  if (nu === "") return "";
  return /^[.'’\-_\s]$/.test(nu) ? " " : nu;
}

/** Un morceau de nom, tel que l'écran doit le rendre : surligné, ou non. */
export type MorceauDeNom = { texte: string; trouve: boolean };

/**
 * Le nom d'un client découpé en morceaux, ceux qui répondent à la frappe étant
 * marqués.
 *
 * **Sa remarque du 3 septembre 2026 :** sur quatre clients qui s'appellent
 * Martins, il faut voir POURQUOI la ligne sort. Sans marque, une recherche qui
 * rend quatre noms identiques ressemble à une recherche qui n'a pas filtré.
 *
 * **Une saisie vide ne marque rien** — et rend le nom d'un seul tenant : c'est
 * l'état de la liste au repos, celui qu'on voit le plus souvent.
 */
export function morceauxSurlignes(nom: string, saisie: string): MorceauDeNom[] {
  const mots = normaliserPourRecherche(saisie).split(" ").filter(Boolean);
  const caracteres = Array.from(nom);
  if (mots.length === 0) return caracteres.length ? [{ texte: nom, trouve: false }] : [];

  // Le texte comparé, et pour chacune de ses positions la lettre du nom d'où
  // elle vient : c'est ce lien qui permet de reposer la marque au bon endroit.
  let compare = "";
  const venuDe: number[] = [];
  caracteres.forEach((c, index) => {
    for (const lettre of normaliserCaractere(c)) {
      compare += lettre;
      venuDe.push(index);
    }
  });

  // **Un seul mot manquant, et RIEN ne s'éclaire.** Trouvé par le garde-fou de
  // `test-recherche-client.ts`, jamais à la lecture : le filtre exige que
  // CHAQUE mot tapé soit présent, alors que le surlignage les cherchait un par
  // un. « martins freres » écartait donc « Martins » de la liste — mais aurait
  // éclairé son nom si l'écran l'avait affiché. Deux lectures du même texte qui
  // ne répondent pas pareil : c'est exactement la divergence que ce contrôle
  // existe pour empêcher (`CLAUDE.md` §3).
  if (!mots.every((mot) => compare.includes(mot))) {
    return [{ texte: nom, trouve: false }];
  }

  const marque = new Array(caracteres.length).fill(false);
  for (const mot of mots) {
    // **Toutes les occurrences, pas seulement la première** : « Martins
    // Martins-Fils » doit s'éclairer des deux côtés, sans quoi la seconde
    // paraît n'avoir rien à voir avec ce qui a été tapé.
    for (let i = compare.indexOf(mot); i !== -1; i = compare.indexOf(mot, i + 1)) {
      for (let k = i; k < i + mot.length; k++) marque[venuDe[k]] = true;
    }
  }

  const morceaux: MorceauDeNom[] = [];
  caracteres.forEach((c, index) => {
    const dernier = morceaux[morceaux.length - 1];
    if (dernier && dernier.trouve === marque[index]) dernier.texte += c;
    else morceaux.push({ texte: c, trouve: marque[index] });
  });
  return morceaux;
}

/** Ce dont la recherche a besoin d'un client : son nom, et rien d'autre. */
export type ClientCherchable = { nom: string };

/**
 * Les clients dont le nom contient ce qui a été tapé.
 *
 * **Une saisie vide rend TOUT, et ce n'est pas un détail.** L'écran ouvert
 * montre la liste entière ; si le vide ne rendait rien, il s'ouvrirait sur une
 * page blanche et il croirait avoir perdu ses clients.
 *
 * **Chaque mot tapé doit être trouvé, dans n'importe quel ordre.** Il tape
 * « martins jean » ou « jean martins » selon l'humeur : exiger l'ordre, c'est
 * lui faire deviner celui qu'on a choisi pour lui.
 */
export function filtrerClientsParNom<T extends ClientCherchable>(clients: readonly T[], saisie: string): T[] {
  const mots = normaliserPourRecherche(saisie).split(" ").filter(Boolean);
  if (mots.length === 0) return [...clients];
  return clients.filter((c) => {
    const nom = normaliserPourRecherche(c.nom);
    return mots.every((mot) => nom.includes(mot));
  });
}

/**
 * Ce que l'écran dit quand la recherche ne rend rien.
 *
 * **Le message porte CE QU'IL A TAPÉ.** « Aucun résultat » tout seul laisse
 * croire à une panne ; voir sa propre frappe citée lui montre en un coup d'œil
 * la faute de frappe, et c'est presque toujours ça.
 */
export function aucunClientTrouve(saisie: string): string {
  return `Aucun client ne s'appelle « ${saisie.trim()} ».`;
}
