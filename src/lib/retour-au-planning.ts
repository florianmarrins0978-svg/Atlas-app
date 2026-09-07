import { lienVersLeChantierAuPlanning } from "./lien-planning";

/**
 * ─── REVENIR AU PLANNING QUAND ON EN VIENT ──────────────────────────────────
 *
 * **Son signalement du 7 septembre 2026, capture à l'appui :** *« quand je
 * clique sur un client dans le planning et que je vais sur un des modules,
 * lorsque je fais retour j'arrive sur la page d'accueil, or je devrais arriver
 * d'où je suis parti. »*
 *
 * La feuille du planning ouvre trois portes (`portes-du-planning.ts`), et
 * chacune menait à un écran dont la flèche pointait **une destination écrite en
 * dur** : `/` pour le devis parti, `/` pour la fiche client, `/termines` pour
 * la facture. Ces destinations n'étaient pas fausses le jour où elles ont été
 * écrites — ces écrans ne s'atteignaient alors que depuis les listes. La feuille
 * du planning est arrivée le 4 septembre et leur a ouvert une seconde porte
 * d'entrée, sans que la sortie l'apprenne.
 *
 * **LA PROVENANCE VOYAGE DANS L'ADRESSE, ET C'EST LE MOTIF DÉJÀ EN PLACE.**
 * `retour-du-devis.ts` le fait depuis le 31 août pour la fiche client : le même
 * paramètre, le même nom, la même façon de le valider. Un second mécanisme —
 * un état de navigation, un `history.back()` — aurait donné deux réponses à la
 * même question, et `history.back()` ment dès qu'on arrive par un signet ou
 * qu'on recharge la page.
 *
 * **ELLE SE VALIDE PAR ÉGALITÉ, JAMAIS PAR MOTIF.** Cette valeur vient de
 * l'adresse, donc de n'importe qui : `?de=https://ailleurs.example` ferait de
 * la flèche une porte de sortie hors d'Atlas. On ne la compare donc pas à une
 * forme, mais **au seul chemin qu'elle a le droit de valoir** — le planning
 * ouvert sur CE chantier. Tout le reste retombe sur le repli de l'écran :
 * jamais une erreur, jamais un vide.
 *
 * **POURQUOI `history.back()` N'AURAIT PAS SUFFI**, alors qu'il paraît plus
 * simple : la flèche d'Atlas n'est pas le bouton du navigateur. Elle mène à un
 * endroit NOMMÉ, elle est un `<Link>` qu'on peut ouvrir dans un onglet, et elle
 * doit dire à voix haute où elle va (`aria-label`). Un retour d'historique ne
 * sait rien annoncer, et après un enregistrement il redéposerait sur le
 * formulaire qu'on vient de quitter.
 */

/**
 * Le nom du paramètre, écrit une seule fois — et c'est celui que la fiche
 * client emploie déjà (`retour-du-devis.ts`). Deux noms pour « d'où je viens »
 * auraient fini par se contredire sur un écran qui accepte les deux.
 */
export const PARAM_PROVENANCE = "de";

/** Ce que la flèche annonce quand elle ramène au planning. */
export const LIBELLE_RETOUR_PLANNING = "Retour au planning";

/** Une adresse d'écran, marquée « on y entre depuis le planning ». */
export function depuisLePlanning(href: string, chantierId: string): string {
  const separateur = href.includes("?") ? "&" : "?";
  return `${href}${separateur}${PARAM_PROVENANCE}=${encodeURIComponent(
    lienVersLeChantierAuPlanning(chantierId)
  )}`;
}

/**
 * Ce qu'un écran relit dans son adresse : le planning sur CE chantier, ou rien.
 *
 * Le chantier est passé exprès — sans lui, un `?de=/planning?chantier=<un
 * autre>` renverrait sur la journée d'un chantier qui n'a rien à voir.
 */
export function provenanceDuPlanning(
  chantierId: string,
  de: string | string[] | undefined | null
): string | null {
  const lu = Array.isArray(de) ? de[0] : de;
  return lu === lienVersLeChantierAuPlanning(chantierId) ? lu : null;
}

/**
 * La flèche d'un écran qui peut s'atteindre depuis le planning.
 *
 * Le repli reste celui que l'écran portait avant — venu d'une liste, on y
 * retourne. C'est ce qui rend cette règle sans risque : elle n'enlève aucun
 * chemin, elle en reconnaît un de plus.
 */
export function retourDepuisLePlanning(
  chantierId: string,
  de: string | string[] | undefined | null,
  repli: { href: string; libelle: string }
): { href: string; libelle: string } {
  const provenance = provenanceDuPlanning(chantierId, de);
  return provenance ? { href: provenance, libelle: LIBELLE_RETOUR_PLANNING } : repli;
}
