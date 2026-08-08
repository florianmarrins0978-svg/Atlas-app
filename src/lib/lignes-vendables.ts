import Decimal from "decimal.js";
import { arrondirALaDizaine } from "./arrondi-prix";

// **Comment une dictée devient des LIGNES de devis — au pluriel.**
//
// Le patron, le 7 août 2026, pour la troisième fois : *« l'agent ne comprend
// toujours pas qu'il faut séparer les tâches. Tout ce que je dicte arrive sur la
// même ligne du devis. »* Puis, très précisément : *« l'abattage, le broyage et
// l'évacuation, c'est sur une ligne, et la fente, ça doit être séparé. »* Et le
// lendemain : *« à chaque fois qu'il sépare les tâches, il met un point-virgule.
// Il faut le retirer. »*
//
// Le défaut tenait en une ligne de code — `prestations.join(" ; ")` — et il a
// survécu à un diagnostic : il avait été **expliqué** la veille au lieu d'être
// **corrigé**. C'est pourquoi la règle vit désormais ici, dans une fonction pure
// éprouvée sur ses propres dictées, et non enfouie dans un service.
//
// **Le POURQUOI, dans ses mots, et il ne se devine pas :** *« si le client ne
// veut pas la fente, il va trouver le reste cher ; et s'il fait faire le reste
// par un autre artisan et qu'il nous prend juste pour la fente, 100 € ce n'est
// pas assez cher. »* Une ligne de devis n'est pas une rubrique comptable : c'est
// une chose que le client peut accepter ou refuser **seule**. Ce qu'il ne peut
// pas détacher n'a aucune raison d'occuper sa propre ligne ; ce qu'il peut
// détacher doit porter son propre déplacement.
//
// Cette règle est aussi la première inscrite dans `termes_metier`
// (migration 0025) : les deux disent la même chose, l'une au modèle, l'autre au
// code. Elles se corrigent ensemble.

// **Ce que ce module ne fait PAS encore, et qu'il faut savoir en le lisant.**
//
// Il connaît DEUX groupes : le chantier, et la fente. C'est exactement ce que le
// patron a demandé, mot pour mot, le 7 août 2026 — mais son propre devis de
// référence (`docs/EXEMPLE-DICTEE.md`, 5 août) en compte trois : la taille de
// haie à 350 €, l'abattage à 600 €, le fendage à 300 €. Une haie est bien un
// travail qu'un client peut commander seul.
//
// Elle n'a pourtant pas sa ligne ici, et le refus est délibéré : le montant
// vient d'un tarif au jour/homme, global. Séparer la haie du chêne exigerait de
// répartir ce global entre eux — c'est-à-dire d'inventer deux prix
// (`docs/AGENT.md` §3). La fente, elle, a une grille : c'est ce qui lui donne le
// droit d'avoir sa ligne.
//
// La suite est donc une question à poser au patron, pas une correction à faire
// seul : voir `TODO.md` §0 quinquies (c). En attendant, la haie est empilée avec
// le reste — visible, nommée, et à séparer d'un geste sur l'écran du devis.

/** Ce qui se détache : le client peut le refuser, ou le confier à un autre. */
const FENDAGE = /\b(fend|fente)/i;

/**
 * Le billonnage — « on le coupe en 50 », « débité en bûches ».
 *
 * **Il ne fait JAMAIS sa propre ligne quand un abattage l'accompagne**, et
 * c'est le patron qui l'a tranché (`docs/EXEMPLE-DICTEE.md`, 5 août 2026) :
 * *« le devis compte trois lignes, pas quatre : le billonnage est compris dans
 * l'abattage »*. Un client ne fait pas venir un élagueur pour tronçonner un
 * arbre qu'un autre aurait abattu — ce n'est pas détachable, c'est la fin du
 * geste d'abattre.
 *
 * Sans abattage dans la dictée, en revanche, il reste : billonner du bois déjà
 * à terre est un vrai chantier, et le faire disparaître effacerait le seul
 * travail dicté.
 */
const BILLONNAGE = /\b(billonn|coup[eé]\w*\s+en\s+\d|d[ée]bit\w*\s+en\s+\d|tron[çc]onn\w*\s+en\s+\d)/i;

const ABATTAGE = /\b(abattage|abattre|abatt|d[ée]mont)/i;

export type LigneVendable = {
  /** `principal` ou `fendage` — sert au chiffrage, jamais affiché au client. */
  cle: "principal" | "fendage";
  /** Ce que le client lit. Plusieurs travaux réunis : un par ligne. */
  libelle: string;
  /** Les prestations réunies, dans l'ordre de la dictée. */
  membres: string[];
  /** Le client peut-il refuser cette ligne sans annuler le chantier ? */
  detachable: boolean;
};

export type Decoupage = {
  lignes: LigneVendable[];
  /**
   * Ce qui a été fondu dans une autre ligne plutôt que d'en faire une.
   * Signalé au patron : une prestation qui disparaît sans un mot est
   * exactement ce qui lui a fait perdre « on le coupe en 50, on le fend ».
   */
  absorbes: string[];
};

/**
 * Découpe des prestations dictées en lignes réellement vendables.
 *
 * Fonction pure : ni base, ni réseau, ni date. Elle se joue sur ses dictées
 * réelles dans `scripts/test-lignes-vendables.ts`.
 *
 * **Le séparateur est un retour à la ligne, pas un point-virgule.** Sa demande
 * du 8 août, et elle a une raison : un point-virgule fait une phrase, et une
 * phrase se lit comme une seule prestation. Empilés, les travaux se comptent
 * d'un coup d'œil sur le devis.
 */
export function lignesVendables(libelles: readonly string[]): Decoupage {
  const propres = libelles.map((l) => l.trim()).filter(Boolean);
  if (propres.length === 0) return { lignes: [], absorbes: [] };

  const ilYAUnAbattage = propres.some((l) => ABATTAGE.test(l));

  const principal: string[] = [];
  const fendage: string[] = [];
  const absorbes: string[] = [];

  for (const libelle of propres) {
    if (FENDAGE.test(libelle)) {
      fendage.push(libelle);
      continue;
    }
    // Le billonnage est compris dans l'abattage — mais seulement s'il y en a
    // un. (La fente est déjà partie plus haut : « on le coupe en 50 et on le
    // fend » reste donc une fente, jamais un billonnage absorbé.)
    if (BILLONNAGE.test(libelle) && ilYAUnAbattage) {
      absorbes.push(libelle);
      continue;
    }
    principal.push(libelle);
  }

  const lignes: LigneVendable[] = [];
  if (principal.length > 0) {
    lignes.push({ cle: "principal", libelle: principal.join("\n"), membres: principal, detachable: false });
  }
  if (fendage.length > 0) {
    lignes.push({ cle: "fendage", libelle: fendage.join("\n"), membres: fendage, detachable: true });
  }

  // Une dictée qui ne contient QUE de la fente : elle est alors le chantier, et
  // non une option de celui-ci. La marquer détachable ferait proposer d'alléger
  // une ligne principale qui n'existe pas.
  if (lignes.length === 1 && lignes[0].cle === "fendage") lignes[0].detachable = false;

  return { lignes, absorbes };
}

export type Repartition = {
  /** Montant de la ligne principale, arrondi à la dizaine. */
  principal: string;
  /** Montant de la ligne détachable, tel que le patron l'a décidé dans sa grille. */
  detachable: string;
  /** Ce qu'on explique au patron sur l'écran Prix. */
  detail: string;
};

/**
 * Répartit un montant global entre la ligne principale et la ligne détachable.
 *
 * **Le total ne bouge pas — c'est la répartition qui protège les deux cas.**
 * Le patron, expliquant pourquoi il écrit 850 + 250 là où le calcul donnerait
 * 1 000 + 100 : la fente doit porter son propre déplacement, sinon le client
 * qui la refuse trouve le reste cher, et celui qui ne prend qu'elle la paie
 * moins qu'elle ne coûte.
 *
 * Le montant de la ligne détachable vient de SA grille (`grille-fendage.ts`),
 * jamais d'un pourcentage : un pourcentage serait une invention de plus, et
 * c'est précisément ce qu'il a demandé d'éviter — *« comme ça il n'invente
 * rien »*.
 *
 * Rend `null` quand la répartition ne tient pas debout : un détachable qui vaut
 * le chantier entier, ou davantage, laisserait une ligne principale à zéro ou
 * négative. On préfère alors ne rien répartir et le dire.
 */
export function repartir(totalHt: string, montantDetachable: string): Repartition | null {
  let total: Decimal;
  let part: Decimal;
  try {
    total = new Decimal(totalHt);
    part = new Decimal(montantDetachable);
  } catch {
    return null;
  }
  if (!total.isFinite() || !part.isFinite()) return null;
  if (part.lessThanOrEqualTo(0) || part.greaterThanOrEqualTo(total)) return null;

  const reste = total.minus(part);
  const principal = arrondirALaDizaine(reste.toFixed(2)) ?? reste.toFixed(2);

  // **L'arrondi peut décaler le total de quelques euros, et on le dit.** Le
  // taire serait reprendre le défaut qu'on répare : un montant qui bouge sans
  // que rien ne l'explique. La règle des prix ronds (« 350, 400, 420, 560 »)
  // l'emporte sur l'exactitude à l'euro — mais elle ne se cache pas.
  const nouveauTotal = new Decimal(principal).plus(part);
  const ecart = !nouveauTotal.equals(total);

  return {
    principal,
    detachable: part.toFixed(2),
    detail:
      `${part.toFixed(2)} € pour la ligne détachable — c'est le prix de VOTRE grille, pas une part du total. ` +
      `${principal} € pour le reste, de façon qu'aucune des deux lignes ne se vende à perte.` +
      (ecart
        ? ` Total : ${nouveauTotal.toFixed(2)} € au lieu de ${total.toFixed(2)} €, l'écart vient de l'arrondi à la dizaine.`
        : ` Le total ne change pas : ${total.toFixed(2)} €.`),
  };
}
