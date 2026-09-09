/**
 * ─── LA FLÈCHE DE RETOUR EST UN VRAI BOUTON RETOUR ──────────────────────────
 *
 * **Sa demande du 9 septembre 2026, capture à l'appui :** *« j'ai cliqué sur
 * “ouvrir le devis”, une fois sur le devis je clique sur retour, j'arrive sur
 * la page de la fiche client — or le bouton retour doit marcher comme un vrai
 * bouton marche arrière : il doit toujours renvoyer à la page d'où l'on vient
 * juste avant. »*
 *
 * Il partait de l'accueil, par la carte « Devis accepté ». La flèche du devis,
 * elle, menait à la fiche client — écrite d'avance, et juste le jour où elle a
 * été écrite.
 *
 * ─── POURQUOI C'EST LA CINQUIÈME FOIS, ET CE QUI EST CORRIGÉ ICI ────────────
 *
 * | quand | ce qu'il a signalé |
 * |---|---|
 * | 20 août | la fiche client sautait deux écrans d'un coup |
 * | 31 août | le devis le déposait sur la fiche du chantier |
 * | 7 sept. | venu du planning, il atterrissait sur l'accueil |
 * | 8 sept. | venu du planning, le devis le déposait sur la fiche client |
 * | 9 sept. | venu de l'accueil, le devis le déposait sur la fiche client |
 *
 * Cinq signalements, **une seule racine** : chaque écran DÉCLARAIT sa sortie,
 * et chaque nouvelle porte d'entrée la démentait. Les quatre correctifs
 * précédents ont ajouté une porte reconnue à la fois — `?de=` pour le devis,
 * puis pour la fiche client, puis pour le planning. C'est la superposition de
 * couches que `CLAUDE.md` §4 quater refuse : chaque couche était juste, et la
 * suivante était déjà nécessaire en la posant.
 *
 * **Ce qui est corrigé, c'est la question posée.** On ne cherche plus à DEVINER
 * d'où il vient : on s'en souvient. Le navigateur tient un journal des écrans
 * traversés, et la flèche lit la dernière page qui n'est pas celle-ci.
 *
 * ─── POURQUOI PAS `history.back()` ─────────────────────────────────────────
 *
 * `retour-au-planning.ts` l'avait écarté en juillet, avec trois raisons qui
 * tiennent toujours — et ce journal les tient toutes les trois là où un
 * `history.back()` échouait :
 *
 * | l'objection | ce que le journal en fait |
 * |---|---|
 * | la flèche est un `<Link>` : on l'ouvre dans un onglet, elle s'annonce | elle garde une VRAIE adresse, lue dans le journal |
 * | `history.back()` ment après un rechargement ou un signet | le journal vit dans l'onglet (`sessionStorage`) : il survit au rechargement, et il est vide sur un signet — la sortie déclarée reprend alors la main |
 * | après un enregistrement, il redéposerait sur le formulaire quitté | enregistrer ramène à la page d'où l'on venait, et le journal la RETIRE au lieu de l'empiler (voir `journalApresVisite`) |
 *
 * ─── CE QUE CE FICHIER NE FAIT PAS ─────────────────────────────────────────
 *
 * Aucune ligne de navigateur ici : `sessionStorage`, `usePathname` et le dessin
 * de la flèche vivent dans `src/components/atlas/` (`CLAUDE.md` §4 sexies — une
 * règle pure ne connaît pas d'écran). Ce qui est ici s'éprouve sans navigateur,
 * et c'est ce que fait `scripts/test-journal-de-navigation.ts`.
 */

/**
 * Combien d'écrans le journal retient.
 *
 * Il n'existe pas pour rejouer une soirée mais pour répondre « d'où viens-tu
 * juste avant » : trente pas suffisent, et le plafond évite qu'un onglet ouvert
 * toute la journée n'entasse indéfiniment.
 */
export const PLAFOND_JOURNAL = 30;

/**
 * Une adresse d'écran d'Atlas, et rien d'autre.
 *
 * **Le filtre n'est pas une précaution de principe.** Ce journal vit dans le
 * navigateur, et sa valeur finit dans le `href` d'un lien : sans lui,
 * `//ailleurs.example` — que tout navigateur lit comme une adresse ABSOLUE —
 * ferait de la flèche « retour » une porte de sortie hors d'Atlas. C'est la
 * même règle que `retour-fiche-client.ts` applique au paramètre `?de=`, pour la
 * même raison.
 */
export function cheminInterne(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const chemin = valeur.trim();
  if (chemin.length === 0 || chemin.length > 512) return null;
  if (!chemin.startsWith("/")) return null;
  // `//hote` et `/\hote` désignent tous deux un autre site — le second parce
  // que les navigateurs traitent la barre inverse comme une barre normale.
  if (chemin.startsWith("//") || chemin.startsWith("/\\")) return null;
  return chemin;
}

/**
 * L'ÉCRAN d'une adresse : ce qui précède le `?` et le `#`.
 *
 * **C'est l'écran qui compte, pas l'adresse entière**, et la nuance porte tout.
 * L'écran de TVA se feuillette par trimestre (`/termines/tva?annee=2026&t=2`) :
 * si chaque trimestre comptait pour une page, la flèche rembobinerait les
 * trimestres un à un avant de sortir. Personne n'a demandé ça — reculer, c'est
 * quitter l'écran où l'on est.
 */
function ecranDe(chemin: string): string {
  const coupe = chemin.search(/[?#]/);
  return coupe === -1 ? chemin : chemin.slice(0, coupe);
}

/**
 * Le journal tel qu'il a été rangé, relu sans jamais lever d'exception.
 *
 * Un journal illisible — vidé, tronqué, écrit par une version d'avant — n'est
 * pas une panne : c'est un onglet neuf. La flèche retombe alors sur la sortie
 * déclarée par l'écran, qui est exactement le comportement d'avant ce lot.
 */
export function lireLeJournal(brut: string | null | undefined): string[] {
  if (!brut) return [];
  let lu: unknown;
  try {
    lu = JSON.parse(brut);
  } catch {
    return [];
  }
  if (!Array.isArray(lu)) return [];
  return lu
    .map(cheminInterne)
    .filter((c): c is string => c !== null)
    .slice(-PLAFOND_JOURNAL);
}

/**
 * Le journal après avoir posé le pied sur `chemin`.
 *
 * **On empile, et on n'essaie JAMAIS de deviner qu'il a reculé.**
 *
 * La première version dépilait quand l'adresse d'arrivée était celle
 * d'avant-dernière : cela ressemblait à un retour. **C'était faux, et la suite
 * navigateur l'a attrapé avant lui** — ouvrir un devis, passer à l'accueil, puis
 * rouvrir CE MÊME devis depuis l'accueil produit exactement la même trace qu'un
 * retour. Le journal dépilait donc l'accueil, et la flèche renvoyait deux écrans
 * en arrière : la panne qu'on venait corriger, par l'autre bout.
 *
 * **Reculer n'est pas une chose qu'on devine : c'est une chose qu'on FAIT.**
 * Quand la flèche est appuyée, elle le dit elle-même — voir
 * `journalSansCetEcran`. Ici, on ne fait que noter les pas.
 *
 * Reste un seul cas particulier : **la même adresse que la dernière** — un
 * rechargement, ou une adresse réécrite sur place. Rien ne s'est passé, et le
 * journal ne bouge pas. Sans cela, recharger vingt fois un écran obligerait à
 * reculer vingt fois pour en sortir.
 */
export function journalApresVisite(journal: readonly string[], chemin: string): string[] {
  const propre = journal.map(cheminInterne).filter((c): c is string => c !== null);
  const courant = cheminInterne(chemin);
  if (courant === null) return propre;
  if (propre[propre.length - 1] === courant) return propre;
  return [...propre, courant].slice(-PLAFOND_JOURNAL);
}

/**
 * La page qui précède l'écran où l'on se trouve — ou `null`.
 *
 * `null` veut dire « on ne sait pas », jamais « il n'y a pas de retour » :
 * l'écran garde alors la sortie qu'il déclare. C'est le cas d'un onglet neuf,
 * d'un signet, d'une notification ouverte à froid.
 *
 * ─── ON NOTE D'ABORD SA PROPRE VISITE, PUIS ON REMONTE ──────────────────────
 *
 * **Et c'est cette ligne-là qui a coûté deux tours de batterie.**
 *
 * La flèche et le journal se posent tous deux à l'arrivée sur un écran, chacun
 * dans son coin : la flèche pendant le rendu, le journal juste après. La flèche
 * lit donc un journal qui ne porte pas encore le pas qu'on vient de faire.
 *
 * Une première version cherchait « notre dernière place » dans ce journal-là.
 * Elle trouvait alors **la visite PRÉCÉDENTE du même écran** — un devis ouvert
 * une première fois, puis rouvert depuis l'accueil — et rendait ce qui
 * précédait celle-ci : deux écrans trop tôt. C'est la panne même qu'on
 * corrigeait, et aucune relecture ne l'a vue ; c'est la suite navigateur qui
 * l'a dite, avec le journal sous les yeux.
 *
 * On applique donc la visite courante avant de lire. Si le journal la porte
 * déjà, c'est sans effet (`journalApresVisite`) ; sinon elle s'ajoute au bout.
 * Dans les deux cas notre place est la DERNIÈRE ligne, et plus rien ne dépend
 * de l'ordre des effets de React.
 *
 * On saute ensuite les lignes du même écran : un écran qu'on feuillette
 * (`/termines/tva?t=…`) ne se rembobine pas page par page — voir `ecranDe`.
 */
export function pagePrecedente(
  journal: readonly string[],
  cheminCourant: string
): string | null {
  const ici = ecranDe(cheminCourant);
  const propre = journalApresVisite(journal, cheminCourant);
  for (let i = propre.length - 2; i >= 0; i--) {
    if (ecranDe(propre[i]) === ici) continue;
    return propre[i];
  }
  return null;
}

/**
 * Le journal amputé de l'écran où l'on se trouve, et de tout ce qui le suit.
 *
 * **C'est ce qui fait RECULER, et c'est appelé par deux gestes seulement :**
 *
 * | le geste | pourquoi |
 * |---|---|
 * | **la flèche de retour est appuyée** | on quitte cet écran en arrière : il ne doit plus servir de destination, sinon deux appuis se renverraient l'un l'autre |
 * | **la fiche d'un client est supprimée** | son adresse ne mène plus à rien ; laissée dans le journal, elle serait la « page d'avant » de l'écran suivant |
 *
 * **Reculer se DÉCLARE, il ne se devine pas.** C'est toute la leçon du
 * 9 septembre 2026 : une version qui reconnaissait un retour à la forme de la
 * trace confondait « il recule » avec « il rouvre un écran déjà vu ». Le seul
 * qui sache la différence, c'est celui qui appuie.
 *
 * **Et ce qui SUIT notre place part aussi.** Si le bouton du navigateur a été
 * employé, le journal porte encore des écrans postérieurs au nôtre : les garder
 * ferait repartir la flèche en avant.
 */
export function journalSansCetEcran(journal: readonly string[], chemin: string): string[] {
  const ici = ecranDe(chemin);
  const propre = journal.map(cheminInterne).filter((c): c is string => c !== null);
  for (let i = propre.length - 1; i >= 0; i--) {
    if (ecranDe(propre[i]) === ici) return propre.slice(0, i);
  }
  return propre;
}
