import Decimal from "decimal.js";
import type { FacturePdfData } from "@/server/pdf/facture-pdf";

/**
 * LA FACTURE QU'ATLAS ADRESSE À L'ARTISAN POUR SON ABONNEMENT — ses réponses
 * du 5 novembre 2026 : Atlas est soumis à la TVA, et sa facture est en
 * Factur-X. Décision prise le même jour (`TODO.md`) : **Atlas la fait
 * lui-même**, Stripe ne fait qu'encaisser, avec le code Factur-X des artisans
 * (`src/lib/facture-x.ts`, `src/server/pdf/facture-x-pdf.ts`). Une seule façon
 * de fabriquer une facture dans le dépôt.
 *
 * Règle pure : elle prend ce que Stripe a encaissé, l'identité d'Atlas et celle
 * de l'artisan, et rend la donnée du papier. **Rien ne s'invente**
 * (`docs/AGENT.md` §3) : une identité d'Atlas incomplète, ou des montants qui
 * ne se recoupent pas, et elle refuse en le disant.
 */

/** Qui vend : Atlas. Lu dans la configuration (`ATLAS_VENDEUR_*`), jamais deviné. */
export type VendeurAtlas = {
  nom: string | null;
  adresse: string | null;
  siret: string | null;
  numeroTva: string | null;
  email: string | null;
};

/** Qui achète : l'artisan, tel que ses réglages d'identité le disent au jour du paiement. */
export type AcheteurAtlas = {
  nom: string;
  adresse: string | null;
  siret: string | null;
  numeroTva: string | null;
};

/** Ce que Stripe a encaissé, en centimes : le prix, sa TVA, le total. */
export type EncaissementAtlas = {
  htCentimes: number;
  tvaCentimes: number;
  ttcCentimes: number;
  /** Le taux en pour cent, celui de `TVA_ABONNEMENT_POURCENT` au jour du paiement. */
  tauxPourcent: number;
  /** « Artisan », « Entreprise »… */
  formuleNom: string;
  /** `AAAA-MM-JJ`, la période payée. */
  periodeDebut: string;
  periodeFin: string;
};

/**
 * Le numéro : `AT`, l'année, et le rang sur six chiffres. **Le rang est
 * continu sur toutes les années** (un seul compteur, `compteur_factures_atlas`) :
 * une suite sans trou est ce qu'un contrôle regarde, et repartir à 1 chaque
 * année obligerait à prouver qu'aucune n'a été sautée entre deux.
 */
export function numeroFactureAtlas(rang: number, annee: number): string {
  return `AT${annee}-${String(rang).padStart(6, "0")}`;
}

export type ResultatFactureAtlas = { ok: true; donnees: FacturePdfData } | { ok: false; raison: string };

const jourFr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function donneesFactureAtlas(p: {
  vendeur: VendeurAtlas;
  acheteur: AcheteurAtlas;
  numero: string;
  /** `AAAA-MM-JJ`, le jour du paiement. */
  dateEmission: string;
  encaissement: EncaissementAtlas;
}): ResultatFactureAtlas {
  const { vendeur, acheteur, encaissement: e } = p;
  const manque = (
    [
      ["la raison sociale", vendeur.nom],
      ["l'adresse", vendeur.adresse],
      ["le SIRET", vendeur.siret],
      ["le numéro de TVA", vendeur.numeroTva],
    ] as const
  )
    .filter(([, v]) => !v?.trim())
    .map(([nom]) => nom);
  if (manque.length > 0) {
    return { ok: false, raison: `L'identité d'Atlas est incomplète (${manque.join(", ")}) : aucune facture ne part.` };
  }

  // **Les montants se recoupent, ou rien ne part.** Le XML recalcule le total
  // depuis la ligne et le taux ; un écart d'un centime ferait refuser la pièce
  // par la plateforme, et une facture dont la TVA ne vient pas du taux dirait
  // autre chose que ce qui a été prélevé.
  const ht = new Decimal(e.htCentimes).div(100);
  const tvaAttendue = ht.mul(e.tauxPourcent).div(100).toDecimalPlaces(2);
  const tva = new Decimal(e.tvaCentimes).div(100);
  const ttc = new Decimal(e.ttcCentimes).div(100);
  if (!tva.eq(tvaAttendue) || !ht.plus(tva).eq(ttc)) {
    return {
      ok: false,
      raison: `Les montants encaissés ne se recoupent pas (${ht.toFixed(2)} HT, ${tva.toFixed(2)} de TVA, ${ttc.toFixed(2)} TTC).`,
    };
  }

  const montant = ht.toFixed(2);
  return {
    ok: true,
    donnees: {
      numeroCommercial: p.numero,
      statut: "emise",
      dateEmission: p.dateEmission,
      // Payée à l'émission : Stripe a encaissé avant que la facture naisse.
      dateEcheance: p.dateEmission,
      regimeTva: "assujettie",
      entrepriseNom: vendeur.nom!.trim(),
      entrepriseAdresse: vendeur.adresse,
      entrepriseSiret: vendeur.siret,
      entrepriseNumeroTva: vendeur.numeroTva,
      entrepriseEmail: vendeur.email,
      clientNom: acheteur.nom,
      // **L'acheteur d'Atlas est toujours une entreprise** : l'artisan. Le
      // dire, plutôt que laisser `estUneEntreprise` le deviner sur son nom,
      // c'est ce qui fait partir la Factur-X et la mention des 40 € (L441-10).
      clientCivilite: "entreprise",
      clientAdresse: acheteur.adresse,
      clientSiret: acheteur.siret,
      clientNumeroTva: acheteur.numeroTva,
      conditionsPaiement: "Payée par carte à l'émission.",
      devise: "EUR",
      tauxTva: new Decimal(e.tauxPourcent).toFixed(2),
      totalHt: montant,
      totalTva: tva.toFixed(2),
      totalTtc: ttc.toFixed(2),
      lignes: [
        {
          libelle: `Abonnement Atlas ${e.formuleNom}, du ${jourFr(e.periodeDebut)} au ${jourFr(e.periodeFin)}`,
          quantite: "1",
          prixUnitaire: montant,
          montant,
          unite: "forfait",
        },
      ],
    },
  };
}
