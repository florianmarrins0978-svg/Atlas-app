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
 * où il n'avait rien à faire (`ARCHITECTURE.md` §227).
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

/** Le devis d'un chantier — l'unique provenance que la fiche client accepte. */
function devisDuChantier(chantierId: string): string {
  return `/chantiers/${chantierId}/devis-complet`;
}

/** D'où l'on vient, une fois vérifié. `null` : d'ailleurs, ou de nulle part. */
export type Provenance = string | null;

/** L'adresse de la fiche client d'un chantier, telle qu'on y entre depuis le devis. */
export function coordonneesDepuisLeDevis(chantierId: string): string {
  return `/chantiers/${chantierId}/coordonnees?de=${encodeURIComponent(devisDuChantier(chantierId))}`;
}

/**
 * Ce que la fiche client relit dans son adresse.
 *
 * Le chantier est passé exprès : la provenance ne vaut que pour LUI. Sans cela,
 * un `?de=/chantiers/<un-autre>/devis-complet` renverrait sur le devis d'un
 * client qui n'a rien à voir.
 */
export function provenanceDesCoordonnees(
  chantierId: string,
  de: string | string[] | undefined
): Provenance {
  const lu = Array.isArray(de) ? de[0] : de;
  return lu === devisDuChantier(chantierId) ? lu : null;
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
 * Où mène la flèche de retour DE LA FICHE CLIENT.
 *
 * Sans provenance, c'est la liste des chantiers — inchangé depuis le 17 août
 * 2026 : la mention « Adresse non renseignée » de l'accueil entre par la même
 * porte, et elle vient de là.
 */
export function retourDesCoordonnees(provenance: Provenance): string {
  return provenance ?? "/";
}

/**
 * Où l'on va une fois la fiche client enregistrée.
 *
 * Sans provenance, c'est la fiche du chantier — inchangé depuis le 17 août
 * 2026. Venu du devis, on y retourne : c'est le document qu'il était en train
 * de lire, et il porte désormais le client qui lui manquait.
 */
export function apresLesCoordonnees(chantierId: string, provenance: Provenance): string {
  return provenance ?? `/chantiers/${chantierId}`;
}
