import Decimal from "decimal.js";

/**
 * Quand la TVA d'une facture devient exigible — et ce qu'un paiement partiel
 * fait entrer au relevé.
 *
 * **Sa demande, le 14 août 2026 :** *« si demain un client décide de ne pas me
 * payer une facture… est-ce qu'il y a une possibilité pour que la facture rentre
 * au relevé de TVA seulement une fois que le client m'a payé ? »* Puis, plus
 * précisément : *« lorsque la facture part, au lieu qu'elle rentre directement
 * dans le relevé, elle arrive dans un endroit en attente, et lorsque j'ai reçu
 * le paiement, je clique sur valider et boum, elle va dans le relevé. »*
 *
 * **Il avait raison, et la loi va dans son sens.** Pour une prestation de
 * services, la TVA est exigible **à l'encaissement** (CGI art. 269-2-c). Le
 * régime des **débits** — celui qu'Atlas appliquait jusqu'ici — est une OPTION
 * qui se demande à l'administration. Les deux existent, d'où le réglage : voir
 * `docs/QUESTIONS.md` §19 et `docs/A-FAIRE.md` §11.
 *
 * **Ce fichier ne touche pas à la base et ne connaît aucune entreprise.** Ce
 * sont des règles pures, éprouvables sans serveur — et c'est voulu : elles
 * décident de ce qui part à l'administration, et une règle qu'on ne peut
 * éprouver qu'en montant une base ne se relit pas.
 */

/** Les deux régimes. Le mot est écrit en base : il ne change pas. */
export type Exigibilite = "encaissements" | "debits";

/** Un règlement reçu : une date, un montant. Rien d'autre n'entre au calcul. */
export type Paiement = {
  /** Date civile `AAAA-MM-JJ` — c'est elle qui décide du trimestre. */
  date: string;
  /** Montant reçu, en euros TTC. */
  montant: string;
};

/** Ce qu'une facture apporte au relevé : ses trois totaux et sa date. */
export type FacturePourTva = {
  dateEmission: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
};

/**
 * Ce qui entre au relevé, ligne par ligne.
 *
 * Une facture produit **une** entrée aux débits (elle-même, à l'émission) et
 * **autant d'entrées que de règlements** aux encaissements.
 */
export type EntreeReleve = {
  /** La date qui décide de la période. */
  date: string;
  ht: string;
  tva: string;
  ttc: string;
  /** D'où vient cette entrée — pour que l'écran puisse le dire. */
  motif: "emission" | "paiement";
};

/**
 * Un montant, lu sans jamais lever.
 *
 * **`new Decimal("zéro")` lève une exception**, il ne rend pas `NaN`. Toutes
 * ces fonctions sont appelées depuis des actions serveur : une exception y
 * devient un identifiant opaque chez le patron, jamais une phrase
 * (`AGENTS.md`). Ce qui n'est pas un nombre vaut donc zéro, et c'est
 * `refusDuPaiement` — lui seul — qui a le droit d'en faire un refus lisible.
 */
function d(x: string): Decimal {
  try {
    const v = new Decimal(String(x ?? "").replace(",", ".") || "0");
    return v.isFinite() ? v : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

/** La somme reçue sur une facture, tous règlements confondus. */
export function totalRegle(paiements: readonly Paiement[]): string {
  return paiements.reduce((acc, p) => acc.plus(d(p.montant)), new Decimal(0)).toFixed(2);
}

/**
 * Ce qui reste dû, jamais négatif.
 *
 * Un trop-perçu ne devient pas une dette d'Atlas envers le client : il se
 * signale au moment de la saisie (`refusDuPaiement`), et le reste dû s'arrête à
 * zéro. Rendre un nombre négatif ferait apparaître « −40,00 € à recevoir » sur
 * un écran, ce qui ne veut rien dire pour un artisan.
 */
export function resteDu(facture: FacturePourTva, paiements: readonly Paiement[]): string {
  const reste = d(facture.totalTtc).minus(d(totalRegle(paiements)));
  return reste.isNegative() ? "0.00" : reste.toFixed(2);
}

export type EtatPaiement = "en_attente" | "partielle" | "soldee";

/**
 * Où en est une facture.
 *
 * **Le seuil du solde est au centime**, et pas « à peu près » : une facture
 * réglée à 1 439,99 € sur 1 440,00 € n'est pas soldée, et la dernière TVA ne
 * doit pas entrer au relevé pour un centime manquant. C'est ce centime-là qui
 * fera l'objet d'un avoir ou d'une relance — pas une décision d'arrondi prise
 * par une application.
 */
export function etatPaiement(facture: FacturePourTva, paiements: readonly Paiement[]): EtatPaiement {
  const regle = d(totalRegle(paiements));
  if (regle.lessThanOrEqualTo(0)) return "en_attente";
  return regle.greaterThanOrEqualTo(d(facture.totalTtc)) ? "soldee" : "partielle";
}

/**
 * Ce qu'un règlement peut se voir refuser, et pourquoi. `null` = accepté.
 *
 * **Le refus est une réponse** (`docs/AGENT.md` §3). Accepter un montant qui
 * dépasse ce qui reste dû ferait entrer au relevé plus de TVA que la facture
 * n'en porte — et c'est l'administration qui poserait la question, des mois
 * plus tard.
 */
export function refusDuPaiement(
  facture: FacturePourTva,
  dejaRegles: readonly Paiement[],
  neuf: Paiement
): string | null {
  // **`new Decimal("zéro")` LÈVE, il ne rend pas NaN.** Un montant illisible
  // ferait donc sortir une exception d'une action serveur — et Next.js la
  // remplace en production par un identifiant opaque : le patron lirait « une
  // erreur est survenue » là où on voulait lui dire ce qui cloche
  // (`AGENTS.md`). Le refus doit rester une VALEUR DE RETOUR, toujours.
  let montant: Decimal;
  try {
    montant = new Decimal(String(neuf.montant ?? "").replace(",", ".") || "0");
  } catch {
    return "Le montant reçu doit être un nombre positif.";
  }
  if (!montant.isFinite() || montant.lessThanOrEqualTo(0)) {
    return "Le montant reçu doit être un nombre positif.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(neuf.date)) {
    return "La date du règlement manque, ou n'est pas une date.";
  }
  // **Un règlement antérieur à la facture n'existe pas.** Un acompte encaissé
  // avant l'émission est un acompte sur DEVIS : il porte sa propre TVA, et le
  // ranger ici le daterait du mauvais trimestre.
  if (neuf.date < facture.dateEmission) {
    return `Ce règlement est daté d'avant la facture (émise le ${facture.dateEmission}).`;
  }
  const reste = d(resteDu(facture, dejaRegles));
  if (montant.greaterThan(reste)) {
    return `Il ne reste que ${reste.toFixed(2)} € à recevoir sur cette facture.`;
  }
  return null;
}

/**
 * Ce qu'une facture apporte au relevé, selon le régime.
 *
 * **Aux encaissements, la TVA d'un acompte se compte AU PRORATA du TTC.** Un
 * acompte de 500 € sur une facture de 1 440 € TTC dont 240 € de TVA apporte
 * 500 × 240 / 1 440 = 83,33 € de TVA — et non 240 €, ni zéro. C'est la règle
 * comptable, et c'est aussi la seule qui ne fasse pas dépendre la déclaration
 * de l'ordre dans lequel le client paie.
 *
 * **Le règlement qui SOLDE reçoit le reliquat.** Trois acomptes arrondis
 * chacun de son côté perdraient un ou deux centimes en route ; ces centimes-là
 * ne se retrouvent nulle part, et la somme des lignes du relevé ne tomberait
 * plus sur le total de la facture. Le dernier règlement porte donc l'écart.
 */
export function entreesDuReleve(
  facture: FacturePourTva,
  paiements: readonly Paiement[],
  regime: Exigibilite
): EntreeReleve[] {
  if (regime === "debits") {
    return [
      {
        date: facture.dateEmission,
        ht: d(facture.totalHt).toFixed(2),
        tva: d(facture.totalTva).toFixed(2),
        ttc: d(facture.totalTtc).toFixed(2),
        motif: "emission",
      },
    ];
  }

  const ttc = d(facture.totalTtc);
  if (ttc.lessThanOrEqualTo(0)) return [];

  // Dans l'ordre où l'argent est rentré : c'est l'ordre des périodes.
  const ordonnes = [...paiements].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const solde = etatPaiement(facture, paiements) === "soldee";

  let htCumule = new Decimal(0);
  let tvaCumulee = new Decimal(0);

  return ordonnes.map((p, rang) => {
    const montant = d(p.montant);
    const dernier = rang === ordonnes.length - 1;

    // Le dernier règlement d'une facture SOLDÉE ramène exactement aux totaux.
    const ht = dernier && solde ? d(facture.totalHt).minus(htCumule) : montant.times(d(facture.totalHt)).dividedBy(ttc);
    const tva = dernier && solde ? d(facture.totalTva).minus(tvaCumulee) : montant.times(d(facture.totalTva)).dividedBy(ttc);

    const htArrondi = ht.toDecimalPlaces(2);
    const tvaArrondie = tva.toDecimalPlaces(2);
    htCumule = htCumule.plus(htArrondi);
    tvaCumulee = tvaCumulee.plus(tvaArrondie);

    return {
      date: p.date,
      ht: htArrondi.toFixed(2),
      tva: tvaArrondie.toFixed(2),
      ttc: montant.toFixed(2),
      motif: "paiement" as const,
    };
  });
}

/**
 * Ce qui attend son paiement, et la TVA qui attend avec.
 *
 * **C'est ce chiffre qui empêche l'oubli.** Une facture absente du relevé sans
 * un mot se lit comme un bogue de l'application ; annoncée, elle devient une
 * relance à faire. Aux débits, il vaut zéro : tout est déjà déclaré.
 */
export function enAttenteDeReglement(
  factures: readonly { facture: FacturePourTva; paiements: readonly Paiement[] }[],
  regime: Exigibilite
): { nombre: number; ttc: string; tva: string } {
  if (regime === "debits") return { nombre: 0, ttc: "0.00", tva: "0.00" };

  let nombre = 0;
  let ttc = new Decimal(0);
  let tva = new Decimal(0);

  for (const { facture, paiements } of factures) {
    if (etatPaiement(facture, paiements) === "soldee") continue;
    nombre++;
    const reste = d(resteDu(facture, paiements));
    ttc = ttc.plus(reste);
    const total = d(facture.totalTtc);
    if (total.greaterThan(0)) tva = tva.plus(reste.times(d(facture.totalTva)).dividedBy(total));
  }

  return { nombre, ttc: ttc.toFixed(2), tva: tva.toDecimalPlaces(2).toFixed(2) };
}

/** Une entrée tombe-t-elle dans la période déclarée ? Bornes incluses. */
export function dansLaPeriode(entree: EntreeReleve, debut: string, fin: string): boolean {
  return entree.date >= debut && entree.date <= fin;
}
