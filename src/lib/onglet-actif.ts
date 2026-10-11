/**
 * L'onglet que la barre du bas allume, pour une adresse donnée.
 *
 * **Le défaut relevé sur `appli/catalogue-les-mots.html`, validée par le
 * patron le 11 octobre 2026.** Sur le catalogue, c'était « Chantiers » qui était
 * souligné, alors qu'on y arrive depuis les Réglages. La règle ne regardait que
 * le début de l'adresse : /catalogue n'est pas sous /reglages, aucun onglet ne
 * la revendiquait, et la barre retombait sur le premier.
 *
 * **On déclare, on ne déplace pas.** Ranger l'écran sous /reglages/catalogue
 * aurait demandé une redirection, la reprise des liens et celle des règles
 * d'accès, pour un défaut de dessin. Un onglet dit donc, en plus de sa propre
 * adresse, celles qu'il possède (`possede`) ; un écran atteint depuis les
 * Réglages mais rangé ailleurs s'y ajoute en une ligne.
 *
 * **Le filtre par rôle n'est pas touché** : il ne lit que `href`
 * (`cheminAutorise`), et l'index se calcule sur la liste déjà filtrée, où la
 * possession voyage avec son onglet.
 */
export type OngletDeLaBarre = { href: string; possede?: readonly string[] };

export function ongletActif(chemin: string, onglets: readonly OngletDeLaBarre[]): number {
  return onglets.reduce(
    (trouve, o, i) => ([o.href, ...(o.possede ?? [])].some((a) => couvre(chemin, a)) ? i : trouve),
    // Aucun onglet ne correspond (une fiche chantier, par exemple) : le trait
    // reste sous « Chantiers », d'où l'on vient forcément.
    0,
  );
}

function couvre(chemin: string, adresse: string): boolean {
  return adresse === "/" ? chemin === "/" : chemin.startsWith(adresse);
}
