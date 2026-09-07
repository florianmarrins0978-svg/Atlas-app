import {
  LIBELLE_RETOUR_PLANNING,
  PARAM_PROVENANCE,
  provenanceDuPlanning,
} from "./retour-au-planning";

/**
 * Où mène la flèche de retour du devis — la fiche client, toujours — et comment
 * on revient ensuite au devis.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le patron, le 31 août 2026, deux captures à l'appui :** *« j'ai oublié de
 * renseigner la fiche client du chantier. Lorsque je fais retour, je dois
 * arriver sur la page de la fiche client ! Pas sur la page que je te mets en
 * deuxième photo. »*
 *
 * Sa première capture est un devis qui porte, à la place du client, la phrase
 * « Aucun client rattaché à ce chantier » — un document qui ne peut partir chez
 * personne. Sa seconde est la fiche du chantier : l'écran où le retour le
 * déposait, et où **rien** ne lui dit ce qui manque ni où le réparer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **DEUX ÉCRANS S'APPELLENT « FICHE CLIENT », ET IL FAUT LES DISTINGUER.**
 *
 * | L'écran | Ce qu'il fait | Sa règle de retour |
 * |---|---|---|
 * | `/clients/[id]` | ce que l'application SAIT du client — ses chantiers, ce qu'il doit | `retour-fiche-client.ts` |
 * | `/chantiers/[id]/coordonnees` | le formulaire qu'on REMPLIT, titré « Fiche client » | **ici** |
 *
 * C'est le second qu'il désigne : il parle de *renseigner*, et il avait employé
 * les mêmes mots le 17 août 2026 (*« j'ai oublié de rentrer les infos du
 * client »*) devant l'écran de création, qui est exactement celui-là. Les deux
 * règles restent séparées parce que les écrans le sont — les mêler ferait sortir
 * d'un chantier celui qui y était.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **C'EST TOUJOURS LA FICHE CLIENT, ET IL A TRANCHÉ LUI-MÊME.** Le 31 août au
 * soir, capture à l'appui : *« je veux tout le temps revenir à cette page et
 * seulement celle-là ! La page fiche client »*.
 *
 * La première version ne détournait le retour que **lorsque le client
 * manquait** — supposant qu'un formulaire déjà rempli n'aurait rien à lui dire.
 * C'était supposer à sa place : il y relit le nom, le téléphone et le canal
 * d'envoi juste avant d'expédier le devis, et cette vérification-là ne dépend
 * pas d'un champ vide. L'autre moitié le déposait sur la fiche du chantier,
 * où il n'avait rien à faire (`ARCHITECTURE.md` §229).
 *
 * **Le chantier ne devient pas injoignable pour autant** : la fiche client
 * porte sa propre flèche, et neuf autres chemins y mènent — le planning, une
 * notification, la reprise de la liste, la flèche de cinq autres écrans.
 *
 * **ET LE CHEMIN SE REFERME.** Arriver sur la fiche client par cette porte puis
 * être renvoyé sur la fiche du chantier après avoir enregistré laisserait son
 * devis à retrouver seul — le devis étant justement ce qu'il lisait. La
 * provenance voyage donc dans l'adresse, sous le même nom que l'autre fiche
 * (`?de=`), et le retour comme l'enregistrement la respectent.
 *
 * **ELLE NE SE VALIDE PAS PAR MOTIF, MAIS PAR ÉGALITÉ.** Cette valeur vient de
 * l'adresse, donc de n'importe qui : `?de=https://ailleurs.example` ferait de la
 * flèche une porte de sortie hors d'Atlas. On ne la compare donc pas à une
 * forme, mais **au seul chemin qu'elle a le droit de valoir** — le devis de CE
 * chantier. Tout le reste retombe sur le comportement d'avant : jamais une
 * erreur, jamais un vide.
 */

/** Le devis d'un chantier — la provenance que la fiche client accepte depuis le 31 août. */
function devisDuChantier(chantierId: string): string {
  return `/chantiers/${chantierId}/devis-complet`;
}

/** D'où l'on vient, une fois vérifié. `null` : d'ailleurs, ou de nulle part. */
export type Provenance = string | null;

/** L'adresse de la fiche client d'un chantier, telle qu'on y entre depuis le devis. */
export function coordonneesDepuisLeDevis(chantierId: string): string {
  return `/chantiers/${chantierId}/coordonnees?${PARAM_PROVENANCE}=${encodeURIComponent(
    devisDuChantier(chantierId)
  )}`;
}

/**
 * ─── LA FICHE CLIENT ACCEPTE DEUX PROVENANCES DEPUIS LE 7 SEPTEMBRE 2026 ────
 *
 * Le devis, comme depuis le 31 août — et le planning, depuis qu'une de ses
 * portes y mène (`retour-au-planning.ts`). Son signalement du 7 septembre :
 * *« lorsque je fais retour j'arrive sur la page d'accueil, or je devrais
 * arriver d'où je suis parti »*.
 *
 * **Ce sont bien deux provenances, pas une liste ouverte.** Chacune se compare
 * au seul chemin qu'elle a le droit de valoir, pour CE chantier : la validation
 * par égalité (voir plus haut) ne se relâche pas parce qu'on en admet une
 * seconde.
 *
 * Le chantier est passé exprès : une provenance ne vaut que pour LUI. Sans
 * cela, un `?de=/chantiers/<un-autre>/devis-complet` renverrait sur le devis
 * d'un client qui n'a rien à voir.
 */
export function provenanceDesCoordonnees(
  chantierId: string,
  de: string | string[] | undefined
): Provenance {
  const lu = Array.isArray(de) ? de[0] : de;
  if (lu === devisDuChantier(chantierId)) return lu;
  // Le planning ouvert sur ce chantier : sa feuille est la seconde porte
  // d'entrée de cet écran, et la flèche doit y ramener. La reconnaissance vit
  // dans `retour-au-planning.ts` — la recopier ici ferait deux vérités sur la
  // même adresse (`CLAUDE.md` §3).
  return provenanceDuPlanning(chantierId, lu);
}

/**
 * Où mène le retour de l'écran du devis : la fiche client, dans tous les cas.
 *
 * **L'argument reste un objet**, et ce n'est pas une coquetterie : cette
 * fonction a déjà changé de règle une fois en un jour. Un objet nommé laisse
 * ajouter demain ce dont elle aurait besoin sans retoucher chaque appel — et
 * surtout sans risquer d'y glisser un identifiant à la place d'un autre.
 */
export function retourDuDevis(arg: { chantierId: string }): string {
  return coordonneesDepuisLeDevis(arg.chantierId);
}

/**
 * Ce que la flèche annonce à voix haute.
 *
 * Elle mène au même écran dans les deux cas, mais n'y va pas pour la même
 * raison : remplir ce qui manque, ou relire avant d'envoyer. Une flèche qui
 * dirait « remplir » devant un formulaire complet ferait chercher un champ vide
 * qui n'existe pas.
 */
export function libelleRetourDuDevis(clientId: string | null): string {
  return clientId === null ? "Remplir la fiche client" : "Revenir à la fiche client";
}

/**
 * Où mène la flèche de retour DE LA FICHE CLIENT : la liste, toujours.
 *
 * ─── SA CORRECTION DU 7 SEPTEMBRE 2026 ────────────────────────────────────
 *
 * *« Lorsqu'on clique sur “faire le devis” d'un devis en attente, si je me
 * suis trompé et que je veux faire retour arrière, j'appuie une fois sur le
 * retour du devis, j'arrive donc sur la page de la fiche client avec la note
 * vocale, et si je refais retour arrière je retourne sur le devis et non sur
 * la page chantier. Il faut rectifier ça !! »*
 *
 * **C'était une boucle, et elle venait de deux de ses propres règles.** Le
 * 31 août il avait demandé deux choses justes séparément :
 *
 * | sa règle | ce qu'elle donnait |
 * |---|---|
 * | la flèche du devis mène à la fiche client, toujours | devis → fiche |
 * | « le chemin se referme » : venu du devis, on y retourne | fiche → devis |
 *
 * Mises bout à bout, les deux flèches se pointaient l'une l'autre : **aucune
 * ne sortait**. Il fallait fermer l'onglet ou passer par la barre du bas.
 *
 * ─── CE QUI EST GARDÉ, ET C'EST LA MOITIÉ QUI COMPTE ──────────────────────
 *
 * « Le chemin se referme » n'est pas abandonné : il vaut pour
 * l'ENREGISTREMENT (`apresLesCoordonnees`), et c'est là qu'il a du sens. Il
 * remplit ce qui manquait, il enregistre, il revient à son devis complété.
 *
 * Ce qui change n'est que la FLÈCHE : elle sert à renoncer, pas à revenir
 * avec quelque chose. Renoncer, c'est sortir — et sortir, c'est la liste.
 *
 * **La provenance reste dans la signature** : l'enregistrement s'en sert
 * toujours, et l'ôter d'ici obligerait à la reconstruire le jour où une
 * troisième porte s'ouvrira sur cet écran.
 * **Et la provenance reste dans la signature alors qu'elle ne décide plus de
 * rien.** Ce n'est pas un oubli : c'est elle qui permet à
 * `test-retour-du-devis.ts` d'écrire la règle telle qu'elle se dit —
 * *« même venu du devis, on sort vers la liste »*. L'ôter rendrait le cas
 * inexprimable, et la boucle du 7 septembre pourrait revenir sans qu'aucune
 * suite ne rougisse.
 */
export function retourDesCoordonnees(chantierId: string, provenance: Provenance): string {
  // **Le devis est la SEULE provenance qui pointe en retour vers cet écran.**
  // C'est ce qui en fait un cycle, et rien d'autre : le planning, lui, ne
  // ramène pas ici — on peut y repartir sans risque de tourner en rond.
  //
  // La comparaison se fait par ÉGALITÉ au devis DE CE chantier, jamais par
  // motif : c'est la règle posée en tête de ce fichier, et un `endsWith` la
  // contournerait au premier chemin qui lui ressemblerait.
  if (provenance === null || provenance === devisDuChantier(chantierId)) return "/";
  return provenance;
}

/**
 * Ce que la flèche de la fiche client annonce à voix haute.
 *
 * **Elle vit ici depuis le 7 septembre 2026, et plus dans l'écran.** Le
 * libellé y était un ternaire — « Retour au devis » dès qu'une provenance
 * existait. Il disait vrai tant qu'il n'y en avait qu'une ; la porte du
 * planning en a ajouté une seconde, et la flèche se serait mise à annoncer un
 * devis en menant au planning. Un écran ne décide de rien (`CLAUDE.md` §3), et
 * c'est exactement le genre de règle qui diverge quand on la laisse dedans.
 */
export function libelleRetourDesCoordonnees(
  chantierId: string,
  provenance: Provenance
): string {
  // **Venu du devis, la flèche ne dit plus « au devis »**, parce qu'elle n'y
  // va plus : voir `retourDesCoordonnees` — c'était la boucle du 7 septembre
  // 2026. Une flèche qui annonce une destination et en prend une autre est
  // pire qu'une flèche muette.
  if (provenance === null) return "Retour à la liste des chantiers";
  if (provenance === devisDuChantier(chantierId)) return "Retour à la liste des chantiers";
  return LIBELLE_RETOUR_PLANNING;
}

/**
 * Où l'on va une fois la fiche client enregistrée.
 *
 * Venu du devis, on y retourne : c'est le document qu'il était en train de
 * lire, et il porte désormais le client qui lui manquait.
 *
 * **SANS PROVENANCE, C'EST LA LISTE — et ce n'est pas un choix de goût.** Cette
 * fonction rendait la fiche du chantier, comme depuis le 17 août 2026. Cette
 * fiche est retirée le 4 septembre (`ARCHITECTURE.md` §254) et son adresse
 * redirige désormais vers l'écran où le travail s'est arrêté — c'est-à-dire,
 * pour un chantier sans dictée, **la fiche client elle-même**. L'y renvoyer
 * après l'avoir enregistrée l'aurait fait tourner en rond sur le formulaire
 * qu'il venait de quitter.
 *
 * La liste est la bonne réponse, et elle en accorde deux qui se contredisaient
 * déjà : la flèche de cet écran y va (`retourDesCoordonnees`), l'enregistrement
 * partait ailleurs. Il est entré depuis la liste ; il y retourne.
 *
 * Le paramètre reste dans la signature : il nomme le chantier concerné, et
 * l'ôter obligerait à retoucher chaque appel le jour où la destination
 * redevient propre au chantier.
 */
export function apresLesCoordonnees(_chantierId: string, provenance: Provenance): string {
  return provenance ?? "/";
}
