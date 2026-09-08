/**
 * L'adresse du serveur que les suites interrogent — et l'unique endroit où
 * elle est dite.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi elle a quitté les suites, le 5 septembre 2026.**
 *
 * Le patron fait tourner trois ou quatre sessions dans le même dossier, et une
 * seule d'entre elles peut mesurer : la batterie prend le port 3000, la base
 * d'essai et le limiteur de connexion. Les autres attendent cinquante minutes.
 * Sa demande, le 8 septembre : *« que chaque session ait son port pour qu'elles
 * puissent toutes jouer la batterie en même temps »*.
 *
 * Or cent vingt-quatre suites écrivaient `http://localhost:3000` en dur, et une
 * trentaine le répétaient au milieu de leur code, parfois sous forme
 * d'expression régulière. **Aucune ne pouvait viser un autre port.** C'est le
 * seul verrou qui tenait tout le reste fermé.
 *
 * **Une piste écartée, mesurée plutôt que supposée.** On a d'abord voulu
 * découper UNE batterie sur quatre ouvriers. Deux mesures l'ont enterrée :
 * servir une application déjà construite ne gagne que 10 % (128 s contre 140 s
 * sur huit suites), donc la compilation à la demande n'était pas le coût ; et
 * surtout **les suites ne sont pas indépendantes** — `run-e2e-tests.ts` le dit
 * lui-même, chacune travaille sur ce que les précédentes ont laissé. Les
 * répartir les fait rougir sur du code juste.
 *
 * Une batterie ENTIÈRE par session, elle, garde l'ordre et les restes : c'est
 * la version du patron, et c'est celle qui tient.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * **Ce module remplace celui reconstitué en secours le 5 septembre** par la
 * session voisine, qui l'avait trouvé importé sur `main` sans y être : son
 * commentaire disait « si la session voisine pousse le sien, garder LE SIEN ».
 * C'est celui-ci. Le défaut venait de moi — je l'avais laissé dans mon arbre,
 * et `tsc` était rouge pour tout le monde pendant trois jours.
 *
 * **Le repli est l'adresse d'aujourd'hui.** Une suite jouée à la main, sans
 * rien poser dans l'environnement, se comporte exactement comme avant — c'est
 * ce qui rend ce remaniement éprouvable : la batterie entière doit rendre les
 * mêmes chiffres sans `ATLAS_ADRESSE`.
 */
export const ADRESSE = process.env.ATLAS_ADRESSE ?? "http://localhost:3000";

/**
 * « On est revenu à l'accueil » — l'accueil de CE serveur, pas d'un port écrit
 * en dur.
 *
 * Une dizaine de suites attendaient `/localhost:3000\/$/` après un envoi :
 * c'est le signal que le devis est parti (21 août 2026). L'adresse est
 * échappée avant d'entrer dans l'expression — un point ou un `+` dans un nom
 * d'hôte y vaudrait autre chose que lui-même, et la suite attendrait alors une
 * page qui n'arrive jamais.
 */
export const ACCUEIL_EXACT = new RegExp(`^${echapper(ADRESSE)}/$`);

/**
 * L'adresse, rendue inoffensive dans une expression régulière.
 *
 * Un point ou un `+` dans un nom d'hôte y vaudrait autre chose que lui-même,
 * et la suite attendrait alors une page qui n'arrive jamais.
 */
export function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
