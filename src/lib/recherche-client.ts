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
