/**
 * LA COMMUNE D'UNE ADRESSE — « 12 rue des Lilas, 44210 Pornic » → « Pornic ».
 *
 * **Pourquoi elle existe.** La maquette du planning retenue le 3 septembre 2026
 * écrit le lieu sous la durée du chantier : sur une liste où quatre clients
 * s'appellent Martins, c'est la seule chose qui dit LEQUEL. L'adresse existait
 * déjà en base (`chantiers.adresse_chantier`) et ne servait qu'aux boutons de
 * la feuille — Maps, Waze, « copier l'adresse » : elle était lue sans jamais
 * être montrée.
 *
 * **L'adresse entière ne peut pas s'écrire là.** Elle fait deux lignes sur un
 * téléphone, et la ligne d'un chantier en compte déjà trois — le nom, la durée,
 * le lieu. Ce qui distingue deux clients, ce n'est pas le numéro de rue : c'est
 * la commune.
 *
 * **ELLE REND `null` PLUTÔT QUE DE DEVINER.** C'est la règle de la maison
 * (`CLAUDE.md` §4) : un champ sans source fiable reste vide. Écrire « rue des
 * Lilas » à la place d'une commune ferait pire que rien — le patron lirait un
 * lieu faux et croirait savoir où il va.
 *
 * **Fonction pure, hors de tout écran** (`CLAUDE.md` §3) : la liste des
 * planifiés et la fiche d'une journée l'appellent toutes les deux, et deux
 * découpages écrits séparément finiraient par ne plus nommer la même commune
 * sur deux lignes qui se lisent ensemble.
 */

/**
 * Le code postal français : cinq chiffres, et rien d'autre autour.
 *
 * **Les bornes de mot ne suffisent PAS à le distinguer d'un numéro de rue**, et
 * c'est le contrôle qui l'a montré, pas la relecture : « 12345 chemin des
 * Vignes, Pornic » donnait « chemin des Vignes » pour commune. Cinq chiffres
 * bornés sont cinq chiffres bornés, que ce soit une voirie ou un code postal.
 * Ce qui les sépare est écrit juste après — voir `EST_UNE_VOIE`.
 */
const CODE_POSTAL = /\b\d{5}\b/g;

/**
 * Les mots qui ouvrent une VOIE, et jamais une commune.
 *
 * Ils servent à une seule chose : dire que les cinq chiffres qui précèdent
 * étaient un numéro de rue. Aucune commune de France ne commence par « rue » ou
 * « chemin » ; toutes les adresses en portent un.
 */
const EST_UNE_VOIE =
  /^(rue|ruelle|chemin|avenue|av|boulevard|bd|all[ée]e|impasse|route|rte|place|voie|quai|sentier|square|cours|lotissement|r[ée]sidence|lieu-?dit|hameau|passage|villa|clos|traverse|mont[ée]e|descente|esplanade|parvis|rond-point|zone|za|zi|zac|b[âa]timent|appartement|appt)\b/i;

/**
 * Ce qui sépare deux morceaux d'adresse.
 *
 * **La virgule ne suffit pas** : qui dicte son adresse au téléphone la rend
 * avec des points-virgules et des retours à la ligne, et « 12 rue des Lilas ;
 * Pornic » n'aurait alors qu'un seul morceau — donc aucune commune. Trouvé par
 * le contrôle, pas en relisant.
 */
const SEPARATEURS = /[,;\n\r]+/;

/**
 * Ce qui ne peut PAS être une commune, et qu'on refuse plutôt que d'écrire.
 *
 * Le pays d'abord : beaucoup d'adresses saisies au téléphone finissent par
 * « France », et c'est le dernier segment — donc exactement celui qu'on
 * prendrait. Un chantier « à France » n'aide personne.
 */
const PAYS = /^(france|fr)$/i;

/**
 * La commune, ou `null`.
 *
 * **Deux chemins, dans cet ordre, et le second est le moins sûr :**
 *
 * 1. **après le code postal** — c'est la forme normale d'une adresse française,
 *    et la seule où la commune se désigne sans ambiguïté ;
 * 2. **le dernier segment séparé par une virgule** — quand l'adresse est écrite
 *    sans code postal. Une virgule est une intention de séparer : celui qui
 *    l'écrit range la commune en dernier.
 *
 * **Sans code postal ET sans virgule, on rend `null`**, même si le texte
 * ressemble à une commune. « Pornic » et « Chemin du Moulin » sont deux chaînes
 * de mots sans chiffre : rien ne les distingue, et se tromper écrirait un nom
 * de rue en face d'un client.
 */
export function communeDeLAdresse(adresse: string | null | undefined): string | null {
  const texte = (adresse ?? "").trim();
  if (texte === "") return null;

  // **Le DERNIER code postal, pas le premier.** « 12345 chemin des Vignes,
  // 44210 Pornic » en porte deux formes : le numéro de voirie ouvre l'adresse,
  // le vrai code postal la ferme. Prendre le premier nommerait la rue.
  for (const cp of [...texte.matchAll(CODE_POSTAL)].reverse()) {
    // Ce qui suit le code postal, jusqu'au séparateur suivant : au-delà
    // commence autre chose — le pays, un complément, un numéro de téléphone
    // recopié à la suite.
    const apres = texte.slice(cp.index + cp[0].length).split(SEPARATEURS)[0];
    const commune = nettoyer(apres);
    // Rien derrière : ces cinq chiffres fermaient la ligne (« 12 rue des Lilas
    // 44210 »). Ils ne nomment donc pas de commune, et l'on essaie le groupe
    // précédent, puis les séparateurs.
    if (!commune) continue;
    // Une voie derrière : ces cinq chiffres étaient un numéro de rue.
    if (EST_UNE_VOIE.test(commune)) continue;
    return commune;
  }

  const morceaux = texte.split(SEPARATEURS).map(nettoyer).filter((m): m is string => m !== null);
  // **Il en faut DEUX, et c'est tout le garde-fou.** Un seul segment qui
  // survive, c'est une adresse sans virgule utile : on ne sait pas si « Chemin
  // du Moulin » est une rue ou un lieu-dit, et l'écrire en face d'un client le
  // ferait passer pour une commune.
  if (morceaux.length < 2) return null;
  return morceaux[morceaux.length - 1];
}

/**
 * Un segment ramené à ce qu'il nomme — ou `null` s'il ne nomme rien.
 *
 * Le code postal se retire d'abord : « 44210 Pornic » et « Pornic 44210 »
 * désignent la même commune, et la garder ferait deux écritures pour un seul
 * lieu sur deux lignes voisines.
 */
function nettoyer(morceau: string): string | null {
  const mot = morceau
    .replace(CODE_POSTAL, " ")
    // Les points-virgules et les retours à la ligne servent de virgules à qui
    // dicte son adresse : les laisser collerait deux segments en un.
    .replace(/[\n\r;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Un séparateur resté seul en bout — « Pornic - » — n'appartient pas au nom.
    .replace(/^[-–—·.]+|[-–—·.]+$/g, "")
    .trim();
  if (mot === "") return null;
  // Rien qui ne soit que des chiffres : un numéro de rue oublié en fin
  // d'adresse n'est pas une commune.
  if (!/\p{L}/u.test(mot)) return null;
  if (PAYS.test(mot)) return null;
  return mot;
}
