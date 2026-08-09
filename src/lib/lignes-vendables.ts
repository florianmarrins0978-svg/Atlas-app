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

// **TROIS groupes, depuis le 8 août 2026 : le chantier, la fente, la haie.**
//
// Les deux premiers viennent de sa consigne du 7 août, mot pour mot. Le
// troisième a été ajouté après une question posée puis tranchée : son devis de
// référence (`docs/EXEMPLE-DICTEE.md`, 5 août) compte bien trois lignes — haie
// 350 €, abattage 600 €, fendage 300 € — et l'application n'en produisait que
// deux.
//
// **Ce qui a débloqué la haie, c'est un prix, pas une envie.** Tant qu'elle
// n'avait pas de grille, la séparer aurait exigé de répartir un tarif global
// entre elle et le chêne — c'est-à-dire d'inventer deux prix
// (`docs/AGENT.md` §3). Depuis qu'il a posé un prix au mètre linéaire, elle
// porte le sien : c'est ce qui lui donne le droit d'avoir sa ligne.

/** Ce qui se détache : le client peut le refuser, ou le confier à un autre. */
const FENDAGE = /\b(fend|fente)/i;

/**
 * Une haie : un travail qu'un client commande seul, sans toucher aux arbres.
 *
 * Elle se chiffre au mètre linéaire, et son prix vient de sa grille — voir
 * `grille-prix.ts`, nature `haie`.
 */
const HAIE = /\bhaie/i;

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

/**
 * Le dessouchage — arracher, rogner ou dessoucher ce qui reste au sol.
 *
 * **Sa réponse du 8 août 2026**, à la question « autre chose se détache-t-il ? » :
 * *« le dessouchage oui »*. Et c'est logique : une souche se laisse très bien en
 * place, ou se confie à un autre le mois suivant. Un client qui la refuse ne
 * renonce pas pour autant à faire abattre son arbre.
 */
const DESSOUCHAGE = /\b(dessouch|d[ée]souch|souche|rognage)/i;

/**
 * L'enlèvement des grumes — le bois d'œuvre, la bille, le tronc à emporter.
 *
 * *« Et les grumes aussi »*, même échange. À ne pas confondre avec l'évacuation
 * du menu bois : **l'évacuation seule ne se détache PAS**, et c'est le troisième
 * cas de la question, celui qu'il n'a pas retenu. Elle reste sur la ligne
 * principale avec l'abattage et le broyage, comme sur son devis du 5 août.
 *
 * La différence n'est pas de mots : une grume a de la valeur, le client peut
 * vouloir la garder ou la vendre, et cela se décide à part. Les branches
 * broyées, elles, ne se gardent pas.
 */
const GRUMES = /\bgrume/i;

export type LigneVendable = {
  /** Sert au chiffrage — jamais affiché au client. */
  cle: "principal" | "fendage" | "haie" | "dessouchage" | "grumes";
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
  const haie: string[] = [];
  const dessouchage: string[] = [];
  const grumes: string[] = [];
  const absorbes: string[] = [];

  for (const libelle of propres) {
    if (FENDAGE.test(libelle)) {
      fendage.push(libelle);
      continue;
    }
    if (HAIE.test(libelle)) {
      haie.push(libelle);
      continue;
    }
    // **Le dessouchage AVANT les grumes, et les deux avant le billonnage.**
    // L'ordre compte : « enlèvement des grumes et dessouchage » tomberait dans
    // la première règle qui le reconnaît. Le dessouchage passe en premier
    // parce que c'est le geste, quand les grumes sont la matière.
    if (DESSOUCHAGE.test(libelle)) {
      dessouchage.push(libelle);
      continue;
    }
    if (GRUMES.test(libelle)) {
      grumes.push(libelle);
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
  if (haie.length > 0) {
    lignes.push({ cle: "haie", libelle: haie.join("\n"), membres: haie, detachable: true });
  }
  // **L'ordre de lecture du devis suit celui du chantier**, pas celui du code :
  // on abat, on enlève les grumes, on fend ce qui reste, et la souche part en
  // dernier — souvent un autre jour, avec une autre machine.
  if (grumes.length > 0) {
    lignes.push({ cle: "grumes", libelle: grumes.join("\n"), membres: grumes, detachable: true });
  }
  if (fendage.length > 0) {
    lignes.push({ cle: "fendage", libelle: fendage.join("\n"), membres: fendage, detachable: true });
  }
  if (dessouchage.length > 0) {
    lignes.push({ cle: "dessouchage", libelle: dessouchage.join("\n"), membres: dessouchage, detachable: true });
  }

  // Une dictée qui ne contient QUE de la haie, ou QUE de la fente : elle est
  // alors le chantier, et non une option de celui-ci. La marquer détachable
  // ferait proposer d'alléger une ligne principale qui n'existe pas.
  if (lignes.length === 1) lignes[0].detachable = false;

  return { lignes, absorbes };
}

export type Repartition = {
  /** Le montant de chaque ligne, dans l'ordre reçu. */
  montants: string[];
  /** Ce qu'on explique au patron sur l'écran Prix. */
  detail: string;
};

/**
 * Répartit un montant global entre la ligne principale et les détachables.
 *
 * **Le total ne bouge pas — c'est la répartition qui protège les deux cas.**
 * Le patron, expliquant pourquoi il écrit 850 + 250 là où le calcul donnerait
 * 1 000 + 100 : la fente doit porter son propre déplacement, sinon le client
 * qui la refuse trouve le reste cher, et celui qui ne prend qu'elle la paie
 * moins qu'elle ne coûte.
 *
 * Le montant de chaque ligne détachable vient de SA grille
 * (`grille-prix.ts`), jamais d'un pourcentage : un pourcentage serait une
 * invention de plus, et c'est précisément ce qu'il a demandé d'éviter — *« comme
 * ça il n'invente rien »*.
 *
 * @param prixDetachables  Le prix de grille de chaque ligne, `null` quand la
 *   case est vide. Une ligne sans prix reste à zéro : on ne devine pas.
 * @param indexPrincipale  La ligne qui absorbe le reste.
 *
 * Rend `null` quand la répartition ne tient pas debout : des détachables qui
 * valent le chantier entier, ou davantage, laisseraient la ligne principale à
 * zéro ou négative — un devis que le patron enverrait sans le voir.
 */
export function repartir(
  totalHt: string,
  prixDetachables: readonly (string | null)[],
  indexPrincipale: number
): Repartition | null {
  let total: Decimal;
  try {
    total = new Decimal(totalHt);
  } catch {
    return null;
  }
  if (!total.isFinite() || total.lessThanOrEqualTo(0)) return null;
  if (indexPrincipale < 0 || indexPrincipale >= prixDetachables.length) return null;

  let reste = total;
  const montants: string[] = prixDetachables.map(() => "0");

  for (let i = 0; i < prixDetachables.length; i++) {
    if (i === indexPrincipale) continue;
    const brut = prixDetachables[i];
    if (brut === null) continue;
    let part: Decimal;
    try {
      part = new Decimal(brut);
    } catch {
      continue;
    }
    if (!part.isFinite() || part.lessThanOrEqualTo(0) || part.greaterThanOrEqualTo(reste)) return null;
    montants[i] = part.toFixed(2);
    reste = reste.minus(part);
  }

  // **L'arrondi peut décaler le total de quelques euros, et on le dit.** Le
  // taire serait reprendre le défaut qu'on répare : un montant qui bouge sans
  // que rien ne l'explique. La règle des prix ronds (« 350, 400, 420, 560 »)
  // l'emporte sur l'exactitude à l'euro — mais elle ne se cache pas.
  const principal = arrondirALaDizaine(reste.toFixed(2)) ?? reste.toFixed(2);
  montants[indexPrincipale] = principal;

  const nouveauTotal = montants.reduce((somme, m) => somme.plus(m), new Decimal(0));
  const ecart = !nouveauTotal.equals(total);
  const detaches = montants.filter((_, i) => i !== indexPrincipale && Number(montants[i]) > 0);

  return {
    montants,
    detail:
      (detaches.length > 0
        ? `${detaches.join(" € et ")} € pour ${detaches.length > 1 ? "les lignes détachables" : "la ligne détachable"} — ` +
          "ce sont les prix de VOTRE grille, pas une part du total. "
        : "") +
      `${principal} € pour le reste, de façon qu'aucune ligne ne se vende à perte.` +
      (ecart
        ? ` Total : ${nouveauTotal.toFixed(2)} € au lieu de ${total.toFixed(2)} €, l'écart vient de l'arrondi à la dizaine.`
        : ` Le total ne change pas : ${total.toFixed(2)} €.`),
  };
}
