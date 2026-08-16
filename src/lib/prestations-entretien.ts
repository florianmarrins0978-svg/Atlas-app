// La fiche d'entretien : le modèle de départ, et les règles qui l'ordonnent.
//
// **Sa décision du 16 août 2026, dans ses mots** : *« ça sera un modèle à chaque
// fois qu'on pré-remplira et qu'on enverra aux clients. Donc au final, chaque
// client aura sa fiche parce que ça ne sera jamais la même — d'un client à un
// autre on ne fait pas la même prestation — mais il n'y aura qu'une seule
// fiche. »*
//
// **Un seul modèle, donc.** Rien n'est rangé par client : à chaque passage, la
// fiche part du modèle, s'ajuste, et devient celle de ce client-là. Ce module ne
// connaît que le modèle ; le passage viendra après (`TODO.md`).
//
// Les planches : `docs/maquettes/62-la-fiche-dentretien.html` (ce qu'il coche),
// `63-le-rapport-au-client.html` (ce que le client reçoit),
// `64-composer-sa-fiche.html` (cet écran-ci, dans les Réglages).

/** Une prestation du modèle, telle qu'elle s'écrit et se range. */
export type PrestationModele = {
  /** Le nom de la famille — « Pelouse ». Écrit par le patron, renommable. */
  famille: string;
  /** Le libellé de la prestation — « Tonte et ébarbage ». */
  libelle: string;
};

/**
 * Le modèle fourni à la première ouverture.
 *
 * **Relevé de SA capture, mot pour mot** — c'est la fiche d'une autre
 * application, qu'il a envoyée le 16 août 2026. Ne rien inventer ici : une
 * prestation qui n'existe pas chez lui ferait juger l'écran sur un contenu
 * qu'il ne reconnaît pas.
 *
 * **Ce n'est qu'un point de départ.** Tout se retire, s'ajoute et se renomme —
 * y compris les familles. Une entreprise qui n'entretient que des pelouses n'a
 * aucune raison de garder quinze lignes de tailles et de massifs.
 *
 * **La même liste sert les maquettes**, et un contrôle vérifie qu'elles ne
 * divergent pas (`scripts/test-prestations-entretien.ts`) : l'écart se verrait
 * précisément là où le patron compare ce qu'on lui a montré et ce qu'il obtient.
 */
export const MODELE_FOURNI: readonly PrestationModele[] = [
  { famille: "Pelouse", libelle: "Tonte et ébarbage" },
  { famille: "Pelouse", libelle: "Traitement pelouse" },
  { famille: "Pelouse", libelle: "Scarification" },
  { famille: "Pelouse", libelle: "Engrais" },
  { famille: "Tailles", libelle: "Taille arbuste automne" },
  { famille: "Tailles", libelle: "Taille arbuste printemps" },
  { famille: "Tailles", libelle: "Taille de haie automne" },
  { famille: "Tailles", libelle: "Taille de haie printemps" },
  { famille: "Tailles", libelle: "Taille des rosiers" },
  { famille: "Massifs", libelle: "Bêchage" },
  { famille: "Massifs", libelle: "Bordures massifs" },
  { famille: "Massifs", libelle: "Griffage massifs" },
  { famille: "Massifs", libelle: "Désherbage massifs" },
  { famille: "Massifs", libelle: "Coupe des fleurs fanées" },
  { famille: "Propreté", libelle: "Nettoyage pied de haies" },
  { famille: "Propreté", libelle: "Désherbant allée" },
  { famille: "Propreté", libelle: "Lierre, liseron, liane" },
  { famille: "Propreté", libelle: "Démoussage voirie" },
  { famille: "Propreté", libelle: "Ramassage des feuilles" },
  { famille: "Propreté", libelle: "Évacuation des déchets" },
];

/**
 * Au-delà, l'écran cesse d'être utilisable au pouce sur un chantier.
 *
 * **Ce n'est pas une limite technique, c'est une limite d'usage** : cent lignes
 * à faire défiler avec des gants, c'est une fiche que personne ne remplit. Le
 * refus doit donc le DIRE — pas se contenter d'échouer.
 */
export const MAX_PRESTATIONS = 60;

/** Ce qu'une entreprise a le droit d'écrire dans un libellé ou une famille. */
export const MAX_LONGUEUR_LIBELLE = 60;

/**
 * Nettoie un libellé saisi, ou dit qu'il ne vaut rien.
 *
 * Renvoie `null` quand il ne reste rien d'exploitable — l'appelant décide alors
 * du refus plutôt que d'enregistrer une ligne vide qui n'aurait aucun sens sur
 * la fiche, et que le patron ne pourrait ni lire ni viser au doigt.
 */
export function libelleNettoye(brut: string | null | undefined): string | null {
  if (!brut) return null;
  // Les espaces insécables viennent des claviers de téléphone ; laissées
  // telles quelles, deux libellés identiques à l'œil se rangeraient à deux
  // endroits différents.
  const propre = brut.replace(/ /g, " ").replace(/\s+/g, " ").trim();
  if (propre === "") return null;
  return propre.slice(0, MAX_LONGUEUR_LIBELLE);
}

/**
 * Deux libellés désignent-ils la même chose ?
 *
 * **Indulgent à dessein.** Ce sont deux textes tapés à la main, à deux moments
 * différents : « Tonte et ébarbage » et « tonte et ébarbage » sont la même
 * prestation, et l'écran ne doit pas laisser créer la seconde. La comparaison
 * ignore la casse et les accents — « Propreté » et « proprete » aussi.
 */
export function memeLibelle(a: string, b: string): boolean {
  const pliee = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  return pliee(a) === pliee(b);
}

/**
 * Range des prestations en familles, dans l'ordre où elles arrivent.
 *
 * **L'ordre des familles vient des lignes, jamais d'un classement alphabétique**
 * : le patron range ses gestes dans l'ordre où il les fait sur un chantier —
 * la pelouse d'abord, les déchets à la fin. Trier par nom mettrait « Propreté »
 * avant « Tailles » et lui ferait remonter la fiche à chaque passage.
 */
export function parFamilles<T extends { famille: string }>(
  prestations: readonly T[]
): { famille: string; lignes: T[] }[] {
  const groupes: { famille: string; lignes: T[] }[] = [];
  for (const p of prestations) {
    const dernier = groupes.find((g) => memeLibelle(g.famille, p.famille));
    if (dernier) dernier.lignes.push(p);
    else groupes.push({ famille: p.famille, lignes: [p] });
  }
  return groupes;
}
