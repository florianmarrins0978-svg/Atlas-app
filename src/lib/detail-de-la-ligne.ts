/**
 * LE DÉTAIL SOUS LA LIGNE DU DEVIS — sa planche du 4 novembre 2026
 * (`appli/soignee/devis-detail-ligne.html`).
 *
 * Sa question, devant son devis du frêne : *« j'ai parlé de rétention, de
 * suppression de bois mort, d'allègement, de rétention de grosses charpentières
 * allant vers le voisin. Pourquoi tout ça n'a pas été écrit dans la ligne
 * élagage d'un frêne ? »* La ligne porte le nom du tarif ; ce qu'il précise en
 * dictant n'y descendait jamais.
 *
 * **Le nom et le détail sont UN texte**, son choix du même jour : le détail
 * s'écrit sous le nom, après un retour à la ligne, dans le libellé lui-même.
 * Une seconde colonne aurait demandé deux champs à l'écran, et il en voulait un
 * seul, où effacer devant le détail le remonte sur la ligne du nom. Le PDF
 * imprime déjà un libellé sur plusieurs lignes (`enLignes`).
 */

const propre = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

/**
 * Le libellé d'une ligne née d'une dictée : le nom (celui du tarif, ou du
 * découpage), puis, sous lui, les détails des travaux que la ligne vend.
 *
 * Un détail déjà écrit dans le libellé ne se recolle pas : il rejoue souvent la
 * dictée, et une ligne qui s'allongerait à chaque essai finirait chez le client.
 */
export function libelleAvecDetail(nom: string, details: readonly (string | null | undefined)[]): string {
  const base = nom.trim();
  const dejaLa = base.toLowerCase();
  const vus = new Set<string>();
  const ajouts: string[] = [];
  for (const d of details) {
    const texte = propre(d);
    const cle = texte.toLowerCase();
    if (!texte || vus.has(cle) || dejaLa.includes(cle)) continue;
    vus.add(cle);
    ajouts.push(texte);
  }
  return ajouts.length > 0 ? `${base}\n${ajouts.join(" ")}` : base;
}

/**
 * Effacer devant le détail le remonte sur la ligne du nom, avec UN espace
 * (« frêne Suppression », jamais « frêneSuppression »). Sa demande : *« si je
 * me mets devant le mot suppression et que j'appuie sur la flèche supprimer,
 * que ça me mette suppression sur la même ligne que frêne »*, au téléphone
 * comme à l'ordinateur.
 *
 * Lu sur le RÉSULTAT : le texte d'avant, celui d'après.
 *
 * **Pourquoi le résultat et pas la touche** : sur Android, la touche effacer
 * d'un clavier tactile arrive souvent sans nom (« Unidentified »), et l'on ne
 * peut pas la reconnaître avant qu'elle agisse. Ce que tous les claviers font
 * pareil, c'est le texte qu'ils laissent. Si seul un retour à la ligne est
 * parti, et que deux mots se touchent là où il était, l'espace s'y remet.
 *
 * `null` : autre chose s'est passé (une lettre, un collage, un retour ajouté),
 * et le texte reste tel quel.
 */
export function apresEffacement(avant: string, apres: string): { valeur: string; curseur: number } | null {
  if (apres.length !== avant.length - 1) return null;
  let i = 0;
  while (i < apres.length && avant[i] === apres[i]) i++;
  if (avant[i] !== "\n" || avant.slice(i + 1) !== apres.slice(i)) return null;
  const gauche = apres[i - 1];
  const droite = apres[i];
  if (!gauche || !droite || /\s/.test(gauche) || /\s/.test(droite)) return null;
  return { valeur: `${apres.slice(0, i)} ${apres.slice(i)}`, curseur: i + 1 };
}
