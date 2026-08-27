// **« Quinze chantiers comparables » — et ils ne l'étaient pas.**
//
// ─── Ce que la V1 comparait, et ce qu'elle ignorait ─────────────────────────
//
// `signatureLecon` construit une clé de trois jetons — nature, technique,
// tranche de diamètre — comparée par **égalité de chaîne exacte** en SQL. Ni
// espèce, ni quantité, ni unité, ni ordre de grandeur.
//
// Conséquence, mesurée sur ses propres libellés : **50 ml et 800 ml de haie ont
// la même clé.** Seize fois la longueur, et le rappel présente le prix de l'une
// comme l'expérience de l'autre. Un buis et un laurier aussi, alors qu'ils ne
// se taillent ni au même rythme ni avec le même matériel.
//
// ─── Pourquoi une V2 À CÔTÉ, et jamais à la place ───────────────────────────
//
// Les clés V1 sont **stockées** dans `lecons_prix.signature`. Les réécrire
// orphelinerait toute la mémoire de prix du patron, sans un mot et sans erreur.
// La V2 prend donc une colonne à elle (`signature_v2`, migration 0070), et les
// leçons d'avant restent lisibles telles quelles.
//
// ─── Le seuil de quantité N'EST PAS inventé ─────────────────────────────────
//
// Rien dans le dépôt ne justifie un facteur ×2 ou ×5, et le choisir « pour
// terminer » fabriquerait exactement le genre de chiffre qui revient ensuite
// avec l'autorité de l'expérience. Ce qui est retenu ici est **un critère
// éliminatoire certain** : deux chantiers qui ne sont pas du même ORDRE DE
// GRANDEUR ne sont pas le même chantier. 50 et 55 mètres, oui ; 50 et 800, non.
//
// Un facteur 10 n'est pas un seuil ajusté : c'est le constat qu'il s'agit d'un
// autre travail. Le vrai seuil, lui, se calibrera plus tard sur ses vrais
// devis — c'est pour cela que `lecons_prix` enregistre désormais la quantité,
// l'unité et l'espèce de chaque leçon.
//
// **La frontière est assumée**, et elle penche du bon côté : 95 et 105 mètres
// tombent dans deux ordres différents et ne se rapprocheront pas. Une frontière
// fait MANQUER un rappel, elle n'en fabrique jamais un faux — c'est déjà le
// raisonnement de `trancheDiametre`.

import { techniqueDuLibelle, trancheDiametre } from "./lecons-prix";
import { nature, natureDuLibelle, normaliserUnite } from "./natures-prestation";
import { lireCaracteristiques, type Caracteristiques } from "./prestation-structuree";
import { diametreLu } from "./mesures-arbre";

/** Ce qui distingue deux chantiers du même genre, tel qu'on le sait vraiment. */
export type ProfilComparaison = {
  /** La nature métier. Sans elle, aucun rapprochement n'est possible. */
  nature: string | null;
  /** La technique — « démontage avec rétention », « au pied ». */
  methode?: string | null;
  /**
   * L'espèce, **uniquement quand elle a été explicitement dite**.
   *
   * Jamais déduite : `null` veut dire « on ne sait pas », pas « peu importe ».
   */
  espece?: string | null;
  caracteristiques?: unknown;
  quantite?: string | null;
  unite?: string | null;
};

export type SignatureV2 = {
  /** Clé stockée et indexée : `v2|haie|-|ml|o2`. */
  cle: string;
  /** De quoi il s'agit, en clair, pour l'écrire dans le rappel. */
  description: string;
};

/**
 * L'ordre de grandeur d'une quantité — la puissance de 10 qui la contient.
 *
 * 5 → `o0`, 50 et 55 → `o1`, 800 → `o2`. Ce n'est pas un seuil réglé : c'est le
 * constat que deux chantiers séparés par un facteur dix ne sont pas le même
 * travail.
 */
export function ordreDeGrandeur(valeur: number): string | null {
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  return `o${Math.floor(Math.log10(valeur))}`;
}

function quantiteLisible(profil: ProfilComparaison): number | null {
  if (!profil.quantite || !profil.unite) return null;
  const v = Number(String(profil.quantite).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * La clé de rapprochement V2 — celle qui est stockée et qui présélectionne.
 *
 * **L'espèce n'y est PAS, et c'est délibéré.** Une leçon d'avant ne porte aucune
 * espèce ; la mettre dans la clé rendrait introuvable, du jour au lendemain,
 * toute la mémoire de prix du patron dès que l'extraction commencerait à
 * remplir le champ. Une absence d'information n'est pas une différence.
 * L'espèce sert d'éliminatoire dans `sontComparables`, où l'on sait ce que
 * chacun des deux côtés porte.
 *
 * Rend `null` quand la nature est inconnue : mieux vaut aucun rappel qu'un
 * rappel tiré d'un rapprochement fantaisiste.
 */
export function signatureV2(profil: ProfilComparaison): SignatureV2 | null {
  const n = nature(profil.nature);
  if (!n) return null;

  const morceaux = ["v2", n.cle];
  const enClair = [n.libelle.toLowerCase()];

  const methode = profil.methode?.trim() || null;
  morceaux.push(methode ?? "-");
  if (methode) enClair.push(methode);

  // Le diamètre gouverne le prix d'un abattage, d'un dessouchage et d'une
  // fente : il entre dans la clé, dans la même tranche que la V1.
  const mesures: Caracteristiques = lireCaracteristiques(profil.caracteristiques);
  if (mesures.diametreCm !== undefined) {
    morceaux.push(trancheDiametre(mesures.diametreCm));
    enClair.push(`⌀ ${mesures.diametreCm} cm`);
  } else {
    morceaux.push("-");
  }

  // **L'unité fait partie de l'identité du travail** : 800 ml et 800 m² ne sont
  // pas le même chantier, et leur prix n'a rien à voir.
  const quantite = quantiteLisible(profil);
  const unite = quantite !== null ? normaliserUnite(profil.unite!) : null;
  morceaux.push(unite ?? "-");
  morceaux.push(quantite !== null ? (ordreDeGrandeur(quantite) ?? "-") : "-");
  if (quantite !== null) enClair.push(`${quantite} ${profil.unite!.trim()}`);

  return { cle: morceaux.join("|"), description: enClair.join(", ") };
}

/**
 * Deux chantiers sont-ils réellement comparables ?
 *
 * La clé ci-dessus fait le gros du tri ; cette fonction pose les critères
 * éliminatoires qui demandent de voir les deux côtés.
 *
 * **Une seule règle, et elle ne coupe que sur du certain :** deux espèces
 * connues et différentes ne se rapprochent pas. Une espèce inconnue d'un côté
 * n'élimine rien — c'est une absence d'information, pas une différence, et la
 * traiter comme telle effacerait la mémoire de prix qu'il a construite avant
 * que le champ existe.
 */
export function sontComparables(a: ProfilComparaison, b: ProfilComparaison): boolean {
  const cleA = signatureV2(a);
  const cleB = signatureV2(b);
  if (!cleA || !cleB || cleA.cle !== cleB.cle) return false;

  const especeA = a.espece?.trim().toLowerCase() || null;
  const especeB = b.espece?.trim().toLowerCase() || null;
  if (especeA && especeB && especeA !== especeB) return false;

  return true;
}

// =========================================================================
// Relire une leçon d'AVANT — mécanisme historique, clairement identifié
// =========================================================================
//
// Une leçon enregistrée avant le 27 août 2026 ne porte ni nature, ni méthode,
// ni quantité en colonne : elle porte un libellé, et c'est tout. Pour savoir si
// elle est comparable à un chantier d'aujourd'hui, on relit CE libellé — le
// sien, celui qu'elle a toujours eu.
//
// **Ce n'est pas réécrire l'historique.** Rien n'est enregistré, rien n'est
// corrigé, et surtout **aucune espèce n'est devinée** : un libellé ne dit pas
// de façon fiable si « haie de 50 ml » parle d'un laurier ou d'un buis, et
// prétendre le savoir serait exactement ce que le patron interdit.

/** Le format qu'écrivait `libelleAvecQuantite` : « Haie (tout genre) (800 ml) ». */
const QUANTITE_EN_FIN = /\((\d+(?:[.,]\d+)?)\s*([^)\d]{1,12})\)\s*$/;

/**
 * Le profil de comparaison d'une leçon dont on n'a que le libellé.
 *
 * Rend `null` quand le libellé ne désigne aucun métier reconnaissable : cette
 * leçon-là ne se rapprochera de rien, ce qui est le comportement voulu.
 */
export function profilDepuisLibelle(libelle: string): ProfilComparaison | null {
  const texte = libelle.trim();
  if (!texte) return null;
  const cleNature = natureDuLibelle(texte);
  if (!cleNature) return null;

  const diametre = diametreLu(texte);
  const quantite = QUANTITE_EN_FIN.exec(texte);

  return {
    nature: cleNature,
    methode: techniqueDuLibelle(texte),
    // Jamais devinée depuis un texte : voir l'en-tête de cette section.
    espece: null,
    caracteristiques: diametre !== null ? { diametreCm: diametre } : null,
    quantite: quantite ? quantite[1] : null,
    unite: quantite ? quantite[2].trim() : null,
  };
}
