/**
 * La ligne ouverte d'avance, sur un devis qui n'en porte aucune.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 20 septembre 2026, capture à l'appui :** *« quand j'ouvre la
 * page du devis il doit avoir une ligne d'ouverte déjà, je dois pas avoir
 * besoin de cliquer sur ajouter une ligne »*.
 *
 * Il arrive sur sa feuille pour écrire ; le premier geste qu'on lui demandait
 * ne servait qu'à ouvrir une case. Une feuille de devis s'ouvre avec sa
 * première ligne, comme un carnet.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **ET ELLE N'EXISTE PAS EN BASE TANT QU'IL N'A RIEN ÉCRIT — c'est tout
 * l'enjeu de ce fichier.**
 *
 * Écrire une ligne vide à l'ouverture de l'écran aurait été plus simple d'une
 * ligne de code, et cela ressuscitait **la panne du 7 août 2026** — *« le devis
 * ne comporte aucune ligne, gros bug »*. Trois endroits du produit lisent
 * « aucune ligne » comme « la chaîne n'a pas encore tourné » :
 *
 * | | |
 * |---|---|
 * | `devis-depuis-dictee.ts` | n'écrit les prestations dictées que sur un devis vide |
 * | `devis-a-preparer.ts` | décide si la dictée doit être reprise à l'arrivée |
 * | `api/…/devis-pret` | dit à l'écran qui attend que le devis est prêt |
 *
 * Une ligne vide posée en base aurait menti aux trois, et la dictée du patron
 * aurait de nouveau disparu. La ligne ouverte vit donc dans l'ÉCRAN seul : elle
 * s'écrit en base au premier mot, et pas avant.
 * ───────────────────────────────────────────────────────────────────────────
 */

/**
 * L'identifiant de la ligne ouverte d'avance.
 *
 * **Il ne peut croiser aucune ligne réelle** : celles-là portent un UUID. C'est
 * la même précaution que `CLE_REDUCTION` sur l'écran du devis, et elle permet
 * au tiroir des retirés de traiter cette ligne comme les autres.
 *
 * **Constant, jamais tiré au hasard** : cet écran est rendu une première fois
 * sur le serveur. Un identifiant différent de part et d'autre mettrait deux
 * valeurs dans le même attribut, et React refait alors la page à l'arrivée.
 */
export const LIGNE_OUVERTE = "ligne-ouverte";

export function estLigneOuverte(id: string): boolean {
  return id === LIGNE_OUVERTE;
}

/**
 * Faut-il ouvrir une ligne d'avance sur ce devis ?
 *
 * Trois conditions, et chacune a sa raison :
 *
 * - **le devis est un brouillon** — un devis parti est immuable, et il doit
 *   montrer exactement ce que le client a reçu, pas une case de plus ;
 * - **il ne porte aucune ligne** — sinon la case vide s'ajouterait à un devis
 *   déjà rempli, où c'est « + Ajouter une ligne » qui dit ce qu'on veut ;
 * - **aucune dictée n'attend d'être reprise** — la chaîne va écrire les
 *   prestations dictées, et elle ne le fait que sur un devis vide. Une ligne
 *   remplie pendant qu'elle tourne lui ferait tout abandonner.
 */
export function ligneOuverteAPoser(devis: {
  statut: string;
  nombreDeLignes: number;
  dicteeAPreparer: boolean;
}): boolean {
  return devis.statut === "brouillon" && devis.nombreDeLignes === 0 && !devis.dicteeAPreparer;
}

/**
 * Y a-t-il quelque chose à écrire ? — la question qui fait naître la ligne.
 *
 * **Un champ qu'on traverse ne vaut pas une ligne.** Le devis enregistre à la
 * sortie de chaque case, qu'elle ait changé ou non : sans cette question, poser
 * le doigt sur la description puis le retirer écrirait une ligne vide en base —
 * exactement celle que ce fichier existe pour ne pas écrire.
 *
 * La quantité par défaut vaut « 1 » et ne compte donc pas : c'est ce que la
 * ligne porte sans qu'il y ait touché.
 */
export function ligneOuverteAEcrire(ligne: {
  libelle: string;
  quantite: string;
  prixUnitaire: string;
  unite?: string | null;
}): boolean {
  if (ligne.libelle.trim() !== "") return true;
  if ((ligne.unite ?? "").trim() !== "") return true;
  const prix = Number(String(ligne.prixUnitaire ?? "").replace(",", ".").trim());
  if (Number.isFinite(prix) && prix !== 0) return true;
  const quantite = Number(String(ligne.quantite ?? "").replace(",", ".").trim());
  return Number.isFinite(quantite) && quantite !== 1;
}
