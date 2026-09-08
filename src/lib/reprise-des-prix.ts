/**
 * Reprendre les lignes d'un chantier passé, AUX TARIFS D'AUJOURD'HUI.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **D'OÙ ÇA VIENT.** Le patron, le 8 septembre 2026, devant les deux façons
 * de faire posées côte à côte sur `appli/repartir-de-son-chantier.html` :
 * *« si on clique sur refaire il faut que ça se mette au prix d'aujourd'hui,
 * la 1 »*.
 *
 * Recharger l'ancien devis tel quel, c'est facturer aux prix de l'an dernier —
 * et une hausse de tarif qu'on ne voit pas est de l'argent perdu à chaque
 * chantier repris, sans que rien ne le signale.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **CE QUI A ÉTÉ DIT ET QUI ÉTAIT FAUX, corrigé ici (`CLAUDE.md` §2 bis).**
 *
 * Il lui avait été annoncé qu'une ligne sans tarif correspondant reviendrait
 * **« à chiffrer »**. C'est faux, et le schéma le dit : `lignes_prix` ne garde
 * **aucun lien vers le tarif d'origine** (pas de `tarif_id`). On ne peut donc
 * pas distinguer :
 *
 *   · une ligne dont le tarif a été SUPPRIMÉ ;
 *   · une ligne qui n'est JAMAIS venue d'un tarif — chiffrée à la main, ce qui
 *     est le cas courant.
 *
 * Les traiter pareil forcerait à ressaisir presque tout le devis : soit
 * exactement le retapage dont il se plaint. **Une ligne sans tarif garde donc
 * son prix, et le dit.** Le doute ne fabrique pas un travail en plus ; il
 * fabrique un mot à l'écran.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **LA QUANTITÉ NE SE RECALCULE JAMAIS.** Quarante mètres de haie la dernière
 * fois n'en font pas quarante cette fois-ci : c'est un relevé de chantier, pas
 * un tarif. Elle est reprise telle quelle, et c'est à lui de la corriger — sur
 * la vraie page du devis, qu'il a exigée le 8 septembre pour cette raison même.
 *
 * Fonction pure : ni base, ni réseau, ni date.
 */

// **On ne réécrit pas la comparaison des libellés.** `memeMot` la porte déjà —
// indulgente sur la casse et les accents, exactement la tolérance qu'il faut ici
// (« Taille de haie » et « taille de haie » sont le même tarif). Deux rédactions
// de la même règle finissent toujours par diverger (`CLAUDE.md` §3), et la
// divergence porterait ici un nom : un devis repris au mauvais prix.
import { memeMot } from "./mots-catalogue";

/** Une ligne du chantier qu'on reprend, telle qu'elle est en base. */
export type LigneAReprendre = {
  libelle: string;
  quantite: string;
  prixUnitaire: string;
  unite: string | null;
  /** Elle attendait déjà son prix la dernière fois. */
  aChiffrer: boolean;
  tauxTva: string | null;
  ordre: number;
};

/** Un tarif de sa grille, tel qu'il est AUJOURD'HUI. */
export type TarifDuJour = {
  intitule: string;
  prix: string;
  unite: string | null;
};

/**
 * Ce qui est arrivé à cette ligne, et qui se dit à l'écran.
 *
 * **Chaque valeur correspond à une phrase**, et il n'y en a pas d'autre : un
 * état qui ne se montre nulle part est un état qui ment par omission.
 */
export type SortReprise =
  /** Le tarif existe et n'a pas bougé : rien à signaler. */
  | { sort: "inchange" }
  /** Le tarif existe et a bougé : on prend le neuf, on montre l'ancien. */
  | { sort: "retarife"; ancienPrixUnitaire: string }
  /** Aucun tarif ne porte ce libellé : on garde son prix, et on le dit. */
  | { sort: "prix-garde" }
  /** Elle attendait déjà son prix : elle l'attend toujours. */
  | { sort: "attend-son-prix" };

export type LigneReprise = LigneAReprendre & {
  /** Le prix retenu — celui du tarif du jour, ou celui de la dernière fois. */
  prixUnitaire: string;
  montant: string;
} & SortReprise;

/**
 * Deux montants en euros sont-ils le même ? Comparés en CENTIMES.
 *
 * `numeric(10,2)` revient de PostgreSQL en chaîne, et « 17.50 » ne vaut pas
 * « 17.5 » pour `===`. Comparer les chaînes annoncerait un changement de prix
 * là où il n'y en a aucun — un « ancien prix barré » qui montre deux fois le
 * même nombre, et c'est toute la liste dont on cesse de croire les marques.
 */
function memeMontant(a: string, b: string): boolean {
  return centimes(a) === centimes(b);
}

/** Un montant en centimes, arrondi — jamais de flottant qui traîne. */
function centimes(montant: string): number {
  const n = Number(montant);
  return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
}

/** `quantité × prix`, en centimes, rendu comme la base l'écrit. */
export function montantDeLaLigne(quantite: string, prixUnitaire: string): string {
  const q = Number(quantite);
  const p = centimes(prixUnitaire);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return "0.00";
  return (Math.round(q * p) / 100).toFixed(2);
}

/**
 * Reprendre une ligne. L'ordre des règles est le raisonnement lui-même :
 *
 *   1. **elle attendait déjà son prix** → elle l'attend encore. Un tarif trouvé
 *      maintenant ne rattrape pas ce qu'on ignorait : si le libellé avait
 *      correspondu à un tarif, elle aurait été chiffrée la première fois ;
 *   2. **aucun tarif ne porte ce libellé** → son prix est gardé, et signalé ;
 *   3. **le tarif porte le même prix** → rien à dire ;
 *   4. **le tarif a bougé** → on prend le neuf, on montre l'ancien.
 */
export function reprendreLaLigne(
  ligne: LigneAReprendre,
  tarifs: readonly TarifDuJour[]
): LigneReprise {
  const garde = (sort: SortReprise): LigneReprise => ({
    ...ligne,
    montant: montantDeLaLigne(ligne.quantite, ligne.prixUnitaire),
    ...sort,
  });

  if (ligne.aChiffrer) return garde({ sort: "attend-son-prix" });

  // Un libellé vide ne correspond à rien — et `memeMot` rendrait vrai contre un
  // tarif dont l'intitulé serait vide lui aussi.
  const libelle = ligne.libelle.trim();
  const tarif = libelle
    ? tarifs.find((t) => t.intitule.trim() !== "" && memeMot(t.intitule, libelle))
    : undefined;
  if (!tarif) return garde({ sort: "prix-garde" });

  if (memeMontant(tarif.prix, ligne.prixUnitaire)) return garde({ sort: "inchange" });

  return {
    ...ligne,
    prixUnitaire: tarif.prix,
    montant: montantDeLaLigne(ligne.quantite, tarif.prix),
    sort: "retarife",
    ancienPrixUnitaire: ligne.prixUnitaire,
  };
}

/** Le devis entier, repris ligne à ligne, dans son ordre d'origine. */
export function reprendreLesLignes(
  lignes: readonly LigneAReprendre[],
  tarifs: readonly TarifDuJour[]
): LigneReprise[] {
  return [...lignes]
    .sort((a, b) => a.ordre - b.ordre)
    .map((l) => reprendreLaLigne(l, tarifs));
}

/**
 * Ce qu'il faut lui dire en haut du devis repris — et **rien quand il n'y a
 * rien à dire**.
 *
 * Une bannière « 0 prix mis à jour » sur un devis que rien n'a changé est du
 * bruit, et le bruit s'apprend à être ignoré (`CLAUDE.md` §4 ter).
 */
export function resumeDeLaReprise(lignes: readonly LigneReprise[]): {
  retarifees: number;
  prixGardes: number;
  attendentLeurPrix: number;
  aQuelqueChoseADire: boolean;
} {
  const retarifees = lignes.filter((l) => l.sort === "retarife").length;
  const prixGardes = lignes.filter((l) => l.sort === "prix-garde").length;
  const attendentLeurPrix = lignes.filter((l) => l.sort === "attend-son-prix").length;
  return {
    retarifees,
    prixGardes,
    attendentLeurPrix,
    aQuelqueChoseADire: retarifees + attendentLeurPrix > 0,
  };
}
