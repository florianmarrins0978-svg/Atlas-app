/**
 * Reprendre les lignes d'un chantier passé, À SES PRIX, le tarif du jour
 * PROPOSÉ.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **D'OÙ ÇA VIENT, ET CE QUI A CHANGÉ.** Le 8 septembre 2026, devant
 * `appli/repartir-de-son-chantier.html`, il avait choisi « la 1 » : reprendre
 * aux prix d'aujourd'hui. Le 26 septembre, il l'a retirée : *« il faut
 * reprendre les prix de l'ancien devis ; à la limite demande s'il veut qu'on
 * mette les prix à jour, il dit oui ou non, mais pas comme ça sans qu'il le
 * sache »*. Rien ne le lui disait : le prix changeait, et l'écran se taisait.
 *
 * La ligne garde donc son ancien prix, et porte le tarif du jour quand il
 * diffère ; la page du devis pose la question (`src/lib/hausse-du-devis.ts`).
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
import Decimal from "decimal.js";
import { memeMot } from "./mots-catalogue";
import { auJourParHomme, tarifJourHomme } from "./tarif-main-oeuvre";

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
  /**
   * Une ligne de main d'œuvre (migration 0130). Rien ici ne s'en sert : elle
   * traverse, et c'est tout son rôle. **Exigée, pas facultative** : oubliée
   * à la lecture, la main d'œuvre reprise devenait un travail à cocher, et
   * sortait de « dont main d'œuvre HT » (6 novembre 2026).
   */
  mainDoeuvre: boolean;
  /**
   * La main d'œuvre RÉPARTIE dans le prix de ce travail (migration 0155), en
   * euros, et les jours d'homme qu'elle représente (migration 0169). Les jours
   * sont nuls quand ils ne sont pas connus : une part posée avant 0169, ou
   * celle d'un partenaire. Exigés eux aussi : c'est en les oubliant ici que
   * « dont main d'œuvre HT » se perdait.
   */
  partMainDoeuvre: string | null;
  joursMainDoeuvre: string | null;
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
  /** Le tarif existe et a bougé : l'ancien prix reste, le neuf est proposé. */
  | { sort: "grille-proposee"; prixGrille: string }
  /** Aucun tarif ne porte ce libellé : on garde son prix, et on le dit. */
  | { sort: "prix-garde" }
  /** Elle attendait déjà son prix : elle l'attend toujours. */
  | { sort: "attend-son-prix" };

export type LigneReprise = LigneAReprendre & {
  /** Le prix de la dernière fois, toujours. */
  prixUnitaire: string;
  montant: string;
  /**
   * Le prix du TRAVAIL seul, main d'œuvre répartie retirée : c'est lui que le
   * tarif du jour remplace (sa décision du 6 novembre 2026, *« ça doit juste
   * se mettre à jour par rapport à la taille de la haie »*). Le prix unitaire
   * de la ligne quand rien n'y est réparti.
   */
  prixTravail: string;
  /**
   * La main d'œuvre au prix du jour par homme d'AUJOURD'HUI, quand il a bougé
   * (*« si on est passé de 400 à 420, ça se réfère au nouveau prix »*). Nulle
   * quand rien n'a bougé, ou quand les jours ne sont pas connus : elle ne se
   * devine pas.
   */
  partGrille: string | null;
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
 *   4. **le tarif a bougé** → l'ancien prix reste, le neuf est proposé.
 */
export function reprendreLaLigne(
  ligne: LigneAReprendre,
  tarifs: readonly TarifDuJour[]
): LigneReprise {
  const montant = montantDeLaLigne(ligne.quantite, ligne.prixUnitaire);
  const part = partRepartie(ligne);
  const prixTravail = part === null ? ligne.prixUnitaire : prixSansLaPart(ligne.quantite, montant, part);
  const jourHomme = tarifJourHomme(tarifs);
  const garde = (sort: SortReprise): LigneReprise => ({
    ...ligne,
    partMainDoeuvre: part,
    montant,
    prixTravail,
    partGrille: part === null ? null : partAuPrixDuJour(part, ligne.joursMainDoeuvre, jourHomme?.prix ?? null),
    ...sort,
  });

  if (ligne.aChiffrer) return garde({ sort: "attend-son-prix" });

  // **La ligne « Main d'œuvre » de son équipe** : sa quantité est en jours
  // d'homme, son prix est le prix du jour par homme. Elle se reconnaît à son
  // unité (`auJourParHomme`), comme la dictée la chiffre ; son libellé, il le
  // change au doigt.
  if (ligne.mainDoeuvre && auJourParHomme(ligne.unite)) {
    if (!jourHomme) return garde({ sort: "prix-garde" });
    return memeMontant(jourHomme.prix, ligne.prixUnitaire)
      ? garde({ sort: "inchange" })
      : garde({ sort: "grille-proposee", prixGrille: jourHomme.prix });
  }

  // **Un travail payé tout entier en main d'œuvre** (une dictée « répartie »)
  // n'a pas de prix de taille à mettre à jour : en proposer un ajouterait au
  // devis un montant qu'aucun devis n'a porté.
  if (part !== null && !new Decimal(prixTravail).greaterThan(0)) return garde({ sort: "prix-garde" });

  // Un libellé vide ne correspond à rien — et `memeMot` rendrait vrai contre un
  // tarif dont l'intitulé serait vide lui aussi.
  const libelle = ligne.libelle.trim();
  const tarif = libelle
    ? tarifs.find((t) => t.intitule.trim() !== "" && memeMot(t.intitule, libelle))
    : undefined;
  if (!tarif) return garde({ sort: "prix-garde" });

  // Comparé au TRAVAIL seul : à 28 € part comprise, la haie aurait toujours
  // paru « changée » face à 12 €, et un oui aurait effacé la main d'œuvre.
  if (memeMontant(tarif.prix, prixTravail)) return garde({ sort: "inchange" });

  return garde({ sort: "grille-proposee", prixGrille: tarif.prix });
}

/** La part répartie sur ce travail, ou `null` : une ligne de main d'œuvre n'en porte pas, elle EST la main d'œuvre. */
function partRepartie(ligne: LigneAReprendre): string | null {
  if (ligne.mainDoeuvre || ligne.partMainDoeuvre === null) return null;
  try {
    const p = new Decimal(ligne.partMainDoeuvre);
    return p.greaterThan(0) ? p.toFixed(2) : null;
  } catch {
    return null;
  }
}

/** Le prix unitaire du travail une fois la part retirée, au centime, jamais sous zéro. */
function prixSansLaPart(quantite: string, montant: string, part: string): string {
  try {
    const q = new Decimal(quantite);
    if (!q.greaterThan(0)) return "0.00";
    return Decimal.max(0, new Decimal(montant).minus(part)).div(q).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  } catch {
    return "0.00";
  }
}

/**
 * Les mêmes jours d'homme au prix du jour d'aujourd'hui, quand il diffère de
 * ce que la part valait. `null` sans jours connus ou sans prix du jour : la
 * part garde alors son montant.
 */
function partAuPrixDuJour(part: string, jours: string | null, prixDuJour: string | null): string | null {
  if (jours === null || prixDuJour === null) return null;
  try {
    const j = new Decimal(jours);
    if (!j.greaterThan(0)) return null;
    const neuve = j.times(prixDuJour).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
    return memeMontant(neuve, part) ? null : neuve;
  } catch {
    return null;
  }
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
  grillesProposees: number;
  prixGardes: number;
  attendentLeurPrix: number;
  aQuelqueChoseADire: boolean;
} {
  // Une main d'œuvre au nouveau prix du jour est une proposition comme une
  // autre : sans elle, la question ne se posait pas quand seul son jour par
  // homme avait bougé.
  const grillesProposees = lignes.filter((l) => l.sort === "grille-proposee" || l.partGrille !== null).length;
  const prixGardes = lignes.filter((l) => l.sort === "prix-garde").length;
  const attendentLeurPrix = lignes.filter((l) => l.sort === "attend-son-prix").length;
  return {
    grillesProposees,
    prixGardes,
    attendentLeurPrix,
    aQuelqueChoseADire: grillesProposees + attendentLeurPrix > 0,
  };
}
