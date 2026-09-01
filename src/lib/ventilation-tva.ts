import Decimal from "decimal.js";
import { pourcentValide } from "./reduction-devis";

/**
 * La TVA d'une facture qui porte PLUSIEURS taux — sa question du 1ᵉʳ septembre
 * 2026 : *« est-il possible que les TS n'aient pas la même TVA ? Je pense que
 * oui, donc il faut rajouter la possibilité de modifier la TVA juste pour les
 * TS. »*
 *
 * Il a raison, et l'enjeu dépasse le confort. Un paysagiste facture à trois
 * taux : **5,5 %** l'entretien rendu comme service à la personne, **10 %** les
 * travaux sur un logement achevé depuis plus de deux ans, **20 %** la création,
 * la terrasse, la clôture et tout client professionnel. Un devis à 10 % suivi
 * d'une terrasse posée en plus, c'est deux taux sur la même facture.
 *
 * **ARTICLE 268 bis DU CGI — et c'est lui qui rend ce fichier obligatoire :**
 * une facture qui ne ventile pas ses opérations par taux est taxée **en entier
 * au taux le plus élevé**. Un supplément à 20 % noyé dans une facture à 10 % ne
 * coûte donc pas dix points sur le supplément : il fait passer TOUTE la facture
 * à 20 %, à la charge de l'artisan. Le taux vit donc sur la LIGNE, et le
 * document porte une ligne de TVA par taux employé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX CHOIX QUI SE DISCUTENT, ET LEUR RAISON.
 *
 * **1. La réduction ne porte QUE sur les lignes du devis.** Le prix accordé au
 * client a été consenti sur le devis, avant que le supplément existe ; l'étendre
 * à ce qui s'ajoute offrirait une remise que personne n'a accordée, et ferait
 * diverger le « Prix accordé au client 10 % » de la facture de celui que le
 * client a sous les yeux sur son devis.
 *
 * **2. Le dernier centime tombe sur le plus gros socle.** Répartir une remise
 * entre deux socles produit des arrondis dont la somme peut manquer un centime
 * au total. Le poser sur le socle le plus lourd est le choix le moins visible ;
 * ce qui compte, et qui est garanti par construction, c'est que la somme des
 * socles vaille EXACTEMENT le total HT — sans quoi le client additionne et
 * n'arrive pas au même chiffre que sa facture.
 *
 * Ce fichier ne touche ni la base ni une entreprise : ce sont des règles pures,
 * éprouvables sans serveur, comme `reduction-devis.ts` dont il prolonge la
 * logique.
 */

/** Une ligne, telle qu'elle entre au calcul. Rien d'autre n'y sert. */
export type LigneAVentiler = {
  montant: string;
  /** Le taux de CETTE ligne. Absent : le taux de la facture, passé à part. */
  tauxTva?: string | null;
  /** Ce qui vient du devis porte la remise ; ce qui s'ajoute ne la porte pas. */
  origine?: "devis" | "supplement" | null;
};

/** Ce qu'un taux pèse sur la facture : son socle, et la TVA qu'il produit. */
export type SocleTva = {
  /** « 20.00 », « 5.50 » — deux décimales, comme en base. */
  tauxTva: string;
  /** Le HT soumis à ce taux, remise déduite. */
  ht: string;
  tva: string;
};

export type TotauxVentiles = {
  /** Un socle par taux réellement employé, du plus élevé au plus bas. */
  socles: SocleTva[];
  /** Les lignes avant tout geste commercial. */
  brutHt: string;
  reductionPourcent: string | null;
  reductionMontant: string | null;
  /** **Après remise** — c'est ce que lit le relevé de TVA (`reduction-devis.ts`). */
  totalHt: string;
  totalTva: string;
  totalTtc: string;
};

const D = (x: string | null | undefined): Decimal => {
  try {
    const v = new Decimal(String(x ?? "0").replace(",", ".") || "0");
    return v.isFinite() ? v : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
};

/** « 20 » → « 20.00 » : le taux s'écrit comme la colonne le stocke. */
export function tauxNormalise(taux: string | number | null | undefined, defaut: string): string {
  const v = D(taux === null || taux === undefined ? defaut : String(taux));
  const borne = Decimal.min(Decimal.max(v, 0), 100);
  return borne.toDecimalPlaces(2).toFixed(2);
}

/** « 20.00 » → « 20 », « 5.50 » → « 5,5 ». Ce qui s'écrit sur un document. */
export function tauxLisible(taux: string): string {
  return new Decimal(D(taux)).toDecimalPlaces(2).toString().replace(".", ",");
}

/**
 * Les totaux d'une facture, ventilés par taux.
 *
 * `tauxParDefaut` sert aux lignes qui n'en portent pas : toutes les factures
 * établies avant que le taux descende sur la ligne sont dans ce cas, et elles
 * doivent sortir **identiques à elles-mêmes**.
 */
export function ventilerTva(
  lignes: readonly LigneAVentiler[],
  tauxParDefaut: string,
  reductionPourcent?: string | number | null
): TotauxVentiles {
  const defaut = tauxNormalise(tauxParDefaut, "20");

  // Socle brut par taux, et ce que le devis pèse dans chacun : la remise ne
  // mord que là-dessus (choix 1 du commentaire de tête).
  const bruts = new Map<string, Decimal>();
  const remisables = new Map<string, Decimal>();
  for (const l of lignes) {
    const taux = tauxNormalise(l.tauxTva ?? null, defaut);
    const montant = D(l.montant);
    bruts.set(taux, (bruts.get(taux) ?? new Decimal(0)).plus(montant));
    if (l.origine !== "supplement") {
      remisables.set(taux, (remisables.get(taux) ?? new Decimal(0)).plus(montant));
    }
  }

  const brut = [...bruts.values()].reduce((a, b) => a.plus(b), new Decimal(0));
  const socleRemisable = [...remisables.values()].reduce((a, b) => a.plus(b), new Decimal(0));
  const pourcent = pourcentValide(reductionPourcent);

  // Arrondie une fois, comme dans `totauxAvecReduction` : un montant retiré à
  // pleine précision donnerait un net dont la soustraction ne tombe pas juste
  // sur le papier, et c'est le client qui refait le calcul.
  const remise =
    pourcent === null
      ? new Decimal(0)
      : socleRemisable.times(new Decimal(pourcent)).dividedBy(100).toDecimalPlaces(2);

  // Répartition de la remise sur les socles remisables, au prorata.
  const taux = [...bruts.keys()].sort((a, b) => D(b).comparedTo(D(a)));
  const retire = new Map<string, Decimal>();
  let cumul = new Decimal(0);
  taux.forEach((t) => {
    const part = remisables.get(t) ?? new Decimal(0);
    const morceau = socleRemisable.isZero()
      ? new Decimal(0)
      : remise.times(part).dividedBy(socleRemisable).toDecimalPlaces(2);
    retire.set(t, morceau);
    cumul = cumul.plus(morceau);
  });
  // Le centime perdu par les arrondis tombe sur le plus gros socle remisable
  // (choix 2) : la somme des socles doit valoir le total HT, exactement.
  const reste = remise.minus(cumul);
  if (!reste.isZero() && taux.length > 0) {
    let plusGros = taux[0];
    for (const t of taux) {
      if ((remisables.get(t) ?? new Decimal(0)).greaterThan(remisables.get(plusGros) ?? new Decimal(0))) {
        plusGros = t;
      }
    }
    retire.set(plusGros, (retire.get(plusGros) ?? new Decimal(0)).plus(reste));
  }

  const socles: SocleTva[] = [];
  let totalHt = new Decimal(0);
  let totalTva = new Decimal(0);
  for (const t of taux) {
    const ht = (bruts.get(t) ?? new Decimal(0)).minus(retire.get(t) ?? new Decimal(0));
    // Un socle vidé par la remise ne s'écrit pas : « TVA 10 % sur 0,00 € »
    // n'apprend rien et allonge le bloc des totaux.
    const tva = ht.times(D(t)).dividedBy(100).toDecimalPlaces(2);
    totalHt = totalHt.plus(ht);
    totalTva = totalTva.plus(tva);
    if (!ht.isZero() || !tva.isZero()) {
      socles.push({ tauxTva: t, ht: ht.toFixed(2), tva: tva.toFixed(2) });
    }
  }

  return {
    socles,
    brutHt: brut.toFixed(2),
    reductionPourcent: pourcent,
    reductionMontant: pourcent === null ? null : remise.toFixed(2),
    totalHt: totalHt.toFixed(2),
    totalTva: totalTva.toFixed(2),
    totalTtc: totalHt.plus(totalTva).toFixed(2),
  };
}

/**
 * Le taux à écrire sur une facture qui n'en a qu'un — la colonne `taux_tva` de
 * `factures` existe encore, et l'historique s'y appuie.
 *
 * **Plusieurs taux : on garde le PLUS ÉLEVÉ.** Aucun taux unique n'est juste
 * dans ce cas ; le plus élevé est celui qui ne sous-déclare pas, et il n'est
 * jamais lu pour calculer quoi que ce soit — les totaux, eux, viennent des
 * socles.
 */
export function tauxRepresentatif(socles: readonly SocleTva[], defaut: string): string {
  if (socles.length === 0) return tauxNormalise(defaut, "20");
  return socles.reduce((haut, s) => (D(s.tauxTva).greaterThan(D(haut)) ? s.tauxTva : haut), socles[0].tauxTva);
}
