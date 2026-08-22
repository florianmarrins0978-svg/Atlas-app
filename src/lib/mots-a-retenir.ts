// Ce qu'Atlas a entendu et ne connaît pas — les mots qu'il PROPOSE de retenir.
//
// **Sa demande du 17 août 2026, et sa condition est dans sa phrase** :
// *« ça veut dire que le document s'autoalimente à chaque fois qu'on rajoute un
// nouveau mot dans un devis ET QU'IL COMPREND CE QUE C'EST ? »*.
//
// **Cette condition commande tout ce module.** Un mot inconnu n'est proposé que
// si l'on sait à quoi il se rapporte : la dictée doit avoir donné lieu à une
// ligne dont le libellé, lui, est reconnu par le catalogue. Sans cela, on
// proposerait de retenir un mot sans savoir ce qu'il désigne — c'est-à-dire
// d'inventer une donnée (`CLAUDE.md` §4).
//
// **Et jamais dans le vocabulaire commun.** Ce qu'il retient entre dans SES
// mots, isolés par RLS (`ARCHITECTURE.md` §123). Le catalogue partagé
// appartient à toutes les entreprises ; un mot appris chez lui changerait les
// devis d'un autre artisan.
//
// **Atlas propose, il n'écrit pas.** C'est la règle du dépôt depuis toujours :
// aucune écriture au catalogue sans un geste explicite.

import { carteCorrespond, memeMot, type CarteCatalogue } from "./mots-catalogue";

/** Un mot entendu, et l'entrée à laquelle Atlas pense le rattacher. */
export type MotPropose = {
  mot: string;
  entreeId: string;
  entreeNom: string;
  /** La phrase d'où il sort — c'est elle qui lui permet de trancher. */
  extrait: string;
};

/**
 * Les mots trop courants pour apprendre quoi que ce soit.
 *
 * **Sans cette liste, la première proposition serait « faut ».** Elle ne cherche
 * pas l'exhaustivité — un mot ordinaire qui passerait au travers coûte un
 * « non », et le « non » est retenu pour toujours (migration 0053).
 */
const MOTS_ORDINAIRES = new Set([
  "alors", "après", "attention", "aussi", "autre", "autres", "avant", "avec", "beaucoup",
  "bien", "bonjour", "celui", "cette", "chez", "comme", "dans", "demain", "depuis", "deux",
  "doit", "donc", "elle", "encore", "ensuite", "entre", "être", "faire", "fait", "faut",
  "juste", "leur", "mais", "matin", "même", "mettre", "moins", "monsieur", "madame", "nous",
  "part", "pareil", "parce", "pendant", "petit", "petite", "peut", "plus", "pour", "pouvoir",
  "près", "prendre", "puis", "quand", "quelque", "quelques", "sans", "sera", "seulement",
  "soir", "sont", "sous", "suis", "surtout", "tous", "tout", "toute", "toutes", "très",
  "vers", "veut", "voilà", "voir", "vous", "aujourd", "hui", "jour", "jours", "semaine",
  "heures", "heure", "euros", "euro", "client", "chantier", "devis", "facture",
  // Relevés sur ses vraies dictées le 17 août : ils décrivent la scène, jamais
  // le travail. « il FAUDRA écimer le GRAND tilleul du FOND » — trois mots
  // proposés pour un seul qui apprend quelque chose.
  "faudra", "faudrait", "grand", "grande", "grands", "gros", "grosse", "petits", "petites",
  "vieux", "vieille", "fond", "côté", "cote", "derrière", "devant", "gauche", "droite",
  "haut", "haute", "milieu", "autour", "terrain", "jardin", "maison", "place",
]);

/** La longueur en deçà de laquelle un mot n'apprend rien. */
const LONGUEUR_MINIMALE = 4;

/** Ce qu'on montre d'un coup : au-delà, l'écran devient une corvée. */
export const MAX_PROPOSITIONS = 6;

/** Découpe une dictée en mots comparables. */
function motsDe(texte: string): string[] {
  return texte
    .toLowerCase()
    .replace(/[^a-zà-öø-ÿ'’\s-]/gi, " ")
    .split(/[\s'’-]+/)
    .map((m) => m.trim())
    .filter(Boolean);
}

/**
 * Ce qu'Atlas propose de retenir, le plus récent d'abord.
 *
 * **Rien n'est proposé quand rien n'est compris.** Une dictée dont aucune ligne
 * ne se rattache au catalogue ne produit aucune proposition : le mot inconnu
 * resterait un mot sans sens, et le retenir n'apprendrait rien à personne.
 */
export function motsARetenir(args: {
  /** Les dictées récentes, avec les libellés que le patron a finalement retenus. */
  dictees: { dictee: string; libelles: string[] }[];
  /** Tout le vocabulaire visible : celui d'Atlas et le sien. */
  cartes: CarteCatalogue[];
  /** Les mots déjà posés OU déjà refusés — on ne repropose jamais. */
  deja: string[];
}): MotPropose[] {
  const proposes: MotPropose[] = [];
  const vus = new Set<string>();

  for (const { dictee, libelles } of args.dictees) {
    // 1. De quoi parlait cette dictée ? C'est SA condition : « et qu'il
    //    comprend ce que c'est ». Le libellé retenu est ce qu'il a validé
    //    lui-même — pas ce qu'Atlas avait cru lire.
    const entree = args.cartes.find((c) => libelles.some((l) => l && carteCorrespond(c, l)));
    if (!entree) continue;

    // 2. Les mots de la dictée que RIEN ne reconnaît aujourd'hui.
    for (const mot of motsDe(dictee)) {
      if (mot.length < LONGUEUR_MINIMALE) continue;
      if (MOTS_ORDINAIRES.has(mot)) continue;
      if (vus.has(mot)) continue;
      if (args.deja.some((d) => memeMot(d, mot))) continue;
      // Déjà compris par un mot du catalogue — le proposer ne servirait à rien,
      // et laisserait croire à un enrichissement là où il n'y en a aucun.
      if (args.cartes.some((c) => carteCorrespond(c, mot))) continue;

      vus.add(mot);
      proposes.push({ mot, entreeId: entree.id, entreeNom: entree.nom, extrait: dictee.trim() });
      if (proposes.length >= MAX_PROPOSITIONS) return proposes;
    }
  }

  return proposes;
}
