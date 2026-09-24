import Decimal from "decimal.js";
import { tauxDeLaLigne, pourcentValide } from "./reduction-devis";
import { formatEuros } from "./termines-par-mois";

/**
 * L'avoir : ce qu'il retire d'une facture, et ce que la loi exige qu'il dise.
 *
 * **Ses décisions du 24 septembre 2026** (planche `appli/avoir.html`, et
 * TODO.md, entrée « L'AVOIR ») :
 *   - il ÉCRIT le montant qu'il retire, en TTC ;
 *   - il CHOISIT la ligne visée, ou toute la facture (« la B ») : Atlas ne
 *     répartit jamais une somme entre deux taux de TVA à sa place ;
 *   - le motif est obligatoire.
 *
 * **Ce que la loi exige** (BOFiP BOI-TVA-DECLA-30-20-20-20, lu à la source) :
 * §260, l'avoir indique le montant HT de la réduction et la TVA
 * correspondante. D'où le TTC saisi ventilé ici, au taux de la ligne visée.
 *
 * Règle pure : aucune base, aucun écran. Le dépôt l'appelle pour ENREGISTRER,
 * l'écran pour AFFICHER ; une seule fonction, sinon les deux divergent
 * (`CLAUDE.md` §3).
 */

/** Une ligne telle qu'elle s'imprime sur l'avoir : en positif, le signe est une écriture. */
export type LigneAvoirStockee = {
  libelle: string;
  quantite: string;
  unite: string | null;
  prixUnitaire: string;
  totalHt: string;
  tauxTva: string;
};

/** Ce qu'il faut savoir d'une ligne de la facture. */
export type LigneFacturePourAvoir = {
  id: string;
  libelle: string;
  quantite: string;
  unite: string | null;
  prixUnitaire: string;
  /** Le HT de la ligne, avant la remise du document. */
  montant: string;
  tauxTva: string | null;
};

export type FacturePourAvoir = {
  numero: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  /** Le taux du document, pour les lignes qui n'en portent pas. */
  tauxTva: string;
  reductionPourcent: string | null;
  lignes: readonly LigneFacturePourAvoir[];
};

/** Un avoir déjà fait sur la même facture. */
export type AvoirDejaFait = {
  ligneFactureId: string | null;
  totalTtc: string;
};

export type DemandeAvoir = {
  /** L'identifiant de la ligne visée, ou `null` pour toute la facture. */
  portee: string | null;
  /** Le TTC retiré, tel qu'il l'a écrit : « 300 », « 250,50 ». */
  montantTtc: string;
  motif: string;
};

export type AvoirCalcule = {
  ligneFactureId: string | null;
  motif: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  lignes: LigneAvoirStockee[];
  /** Vrai quand l'avoir reprend la facture entière, ligne par ligne. */
  total: boolean;
};

/** Un montant écrit par lui, en centimes exacts ; `null` s'il ne se lit pas. */
export function lireMontant(texte: string): Decimal | null {
  const t = String(texte ?? "").replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return new Decimal(t);
}

/**
 * Le TTC d'une ligne, remise du document comprise.
 *
 * La remise est un pourcentage du document (`totauxAvecReduction`) : elle
 * s'applique à chaque ligne dans la même proportion. C'est ce que le client a
 * réellement payé pour cette ligne, donc ce qu'un avoir peut en retirer au plus.
 */
function ttcDeLaLigne(ligne: LigneFacturePourAvoir, facture: FacturePourAvoir): Decimal {
  const pourcent = pourcentValide(facture.reductionPourcent);
  const ht = new Decimal(ligne.montant).times(pourcent === null ? 1 : new Decimal(100).minus(pourcent).dividedBy(100));
  const taux = new Decimal(tauxDeLaLigne(ligne, facture.tauxTva));
  return ht.times(taux.plus(100)).dividedBy(100).toDecimalPlaces(2);
}

/**
 * Le HT et la TVA d'un TTC, à un taux donné.
 *
 * **La TVA est la DIFFÉRENCE, jamais un second calcul.** Deux arrondis séparés
 * peuvent rendre un HT et une TVA dont la somme manque le TTC écrit d'un
 * centime ; la base le refuse d'ailleurs (`avoirs_ttc_somme_ck`).
 */
export function ventilerTtc(ttc: Decimal, taux: string): { ht: Decimal; tva: Decimal } {
  const ht = ttc.times(100).dividedBy(new Decimal(taux).plus(100)).toDecimalPlaces(2);
  return { ht, tva: ttc.minus(ht) };
}

function enMinuscule(libelle: string): string {
  return libelle.charAt(0).toLowerCase() + libelle.slice(1);
}

/**
 * L'avoir à enregistrer, ou le refus à lui dire.
 *
 * **Le refus est une réponse** (`docs/AGENT.md` §3) : une phrase qu'il peut lire,
 * jamais une exception, qui deviendrait un identifiant opaque chez lui.
 */
export function calculerAvoir(
  facture: FacturePourAvoir,
  dejaFaits: readonly AvoirDejaFait[],
  demande: DemandeAvoir
): { ok: true; avoir: AvoirCalcule } | { ok: false; refus: string } {
  const motif = String(demande.motif ?? "").trim();
  if (motif === "") return { ok: false, refus: "Écrivez le motif : la loi le demande sur l'avoir." };

  if (String(demande.montantTtc ?? "").trim() === "") return { ok: false, refus: "Écrivez le montant de l'avoir." };
  const ttc = lireMontant(demande.montantTtc);
  if (ttc === null) return { ok: false, refus: "Ce montant ne se lit pas. Exemple : 300 ou 250,50." };
  if (ttc.lessThanOrEqualTo(0)) return { ok: false, refus: "Un avoir de 0 € ne change rien." };

  const dejaSurLaFacture = dejaFaits.reduce((acc, a) => acc.plus(new Decimal(a.totalTtc)), new Decimal(0));
  const resteSurLaFacture = new Decimal(facture.totalTtc).minus(dejaSurLaFacture);
  if (ttc.greaterThan(resteSurLaFacture)) {
    return { ok: false, refus: `C'est plus que la facture : ${formatEuros(resteSurLaFacture.toNumber())} au plus.` };
  }

  // ─── Une ligne choisie : l'avoir prend SON taux ────────────────────────────
  if (demande.portee !== null) {
    const ligne = facture.lignes.find((l) => l.id === demande.portee);
    if (!ligne) return { ok: false, refus: "Cette ligne n'est pas sur la facture." };
    const dejaSurLaLigne = dejaFaits
      .filter((a) => a.ligneFactureId === ligne.id)
      .reduce((acc, a) => acc.plus(new Decimal(a.totalTtc)), new Decimal(0));
    const resteSurLaLigne = ttcDeLaLigne(ligne, facture).minus(dejaSurLaLigne);
    if (ttc.greaterThan(resteSurLaLigne)) {
      return { ok: false, refus: `C'est plus que cette ligne : ${formatEuros(resteSurLaLigne.toNumber())} au plus.` };
    }
    const taux = tauxDeLaLigne(ligne, facture.tauxTva);
    const { ht, tva } = ventilerTtc(ttc, taux);
    return {
      ok: true,
      avoir: {
        ligneFactureId: ligne.id,
        motif,
        totalHt: ht.toFixed(2),
        totalTva: tva.toFixed(2),
        totalTtc: ttc.toFixed(2),
        total: false,
        lignes: [ligneUnique(`${motif}, sur ${enMinuscule(ligne.libelle)}`, ht, taux)],
      },
    };
  }

  // ─── Toute la facture, et rien n'a encore été retiré : chaque ligne revient ─
  if (dejaFaits.length === 0 && ttc.equals(new Decimal(facture.totalTtc))) {
    return {
      ok: true,
      avoir: {
        ligneFactureId: null,
        motif,
        totalHt: new Decimal(facture.totalHt).toFixed(2),
        totalTva: new Decimal(facture.totalTva).toFixed(2),
        totalTtc: ttc.toFixed(2),
        total: true,
        lignes: facture.lignes.map((l) => ({
          libelle: l.libelle,
          quantite: l.quantite,
          unite: l.unite,
          prixUnitaire: new Decimal(l.prixUnitaire).toFixed(2),
          totalHt: new Decimal(l.montant).toFixed(2),
          tauxTva: tauxDeLaLigne(l, facture.tauxTva),
        })),
      },
    };
  }

  // ─── Toute la facture, une partie : un seul taux, ou il choisit la ligne ───
  //
  // Sa réponse « la B » : une somme partagée entre deux taux se répartirait au
  // prorata, et ce serait Atlas qui déciderait de la TVA de l'avoir. On refuse,
  // et l'on dit quoi faire.
  const taux = [...new Set(facture.lignes.map((l) => tauxDeLaLigne(l, facture.tauxTva)))];
  if (taux.length !== 1) {
    return {
      ok: false,
      refus: "Cette facture a plusieurs taux de TVA : choisissez la ligne sur laquelle porte l'avoir.",
    };
  }
  const { ht, tva } = ventilerTtc(ttc, taux[0]!);
  return {
    ok: true,
    avoir: {
      ligneFactureId: null,
      motif,
      totalHt: ht.toFixed(2),
      totalTva: tva.toFixed(2),
      totalTtc: ttc.toFixed(2),
      total: false,
      lignes: [ligneUnique(`${motif}, sur la facture ${facture.numero}`, ht, taux[0]!)],
    },
  };
}

function ligneUnique(libelle: string, ht: Decimal, taux: string): LigneAvoirStockee {
  return { libelle, quantite: "1", unite: "u", prixUnitaire: ht.toFixed(2), totalHt: ht.toFixed(2), tauxTva: taux };
}
