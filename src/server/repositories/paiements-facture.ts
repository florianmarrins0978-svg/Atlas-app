import { and, asc, desc, eq, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { entreprises, factures, lignesFacture, paiementsFacture } from "../db/schema";
import type { Ctx } from "./context";
import {
  etatPaiement,
  refusDuPaiement,
  resteDu,
  type EtatPaiement,
  type Exigibilite,
  type FacturePourTva,
  type AvoirPourTva,
  type Paiement,
} from "../../lib/exigibilite-tva";
import { netAPayer, refusDuReglementRecu, type MoyenDePaiement, type ReglementRecu } from "../../lib/acomptes-facture";
import { totauxAvecReduction } from "../../lib/reduction-devis";
import type { DbOrTx } from "../db/client";
import { avoirsDesFactures } from "./avoirs";

/**
 * Les règlements reçus, et le régime de TVA de l'entreprise.
 *
 * **Sa demande du 14 août 2026 :** la facture émise attend dans un endroit à
 * part, et n'entre au relevé qu'une fois le paiement noté.
 *
 * **Ce fichier ne décide rien.** Le prorata d'un acompte, le refus d'un montant
 * trop grand, l'état d'une facture : tout vit dans `src/lib/exigibilite-tva.ts`,
 * en fonctions pures éprouvables sans base. Ici on lit et on écrit.
 *
 * **Tout passe par `withEntreprise`** — ce sont ses encaissements
 * (`CLAUDE.md` §3).
 */

export type PaiementEnregistre = Paiement & {
  id: string;
  moyen: "virement" | "cheque" | "especes" | "carte" | "autre" | null;
  note: string | null;
  /** `reprise` : supposé par la migration 0045, et l'écran doit le dire. */
  origine: "saisi" | "reprise" | "banque";
};

/** Une facture qui attend son règlement, telle que l'écran la montre. */
export type FactureEnAttente = {
  id: string;
  numeroCommercial: string;
  dateEmission: string;
  clientNom: string | null;
  chantierId: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  /** Les avoirs qui la corrigent : le reste dû et la TVA se comptent après eux. */
  avoirs: readonly AvoirPourTva[];
  /**
   * **De quoi prévenir son client quand l'IBAN change** (8 septembre 2026).
   *
   * Ces six-là voyagent avec la facture plutôt que dans une seconde requête :
   * l'en-tête de ce fichier le dit déjà — « une seule lecture, une seule
   * vérité ». Deux lectures qui compteraient chacune de leur côté finiraient
   * par désigner deux listes de factures différentes sur le même écran.
   */
  entrepriseIban: string | null;
  entrepriseTitulaireCompte: string | null;
  /** L'IBAN dont ce client a déjà été prévenu, nu (migration 0078). */
  ibanSignale: string | null;
  entrepriseNom: string;
  clientTelephone: string | null;
  clientEmail: string | null;
  clientCivilite: string | null;
  /** Ce qui reste à recevoir. */
  reste: string;
  etat: EtatPaiement;
  paiements: PaiementEnregistre[];
};

/** Le régime de l'entreprise. Aucun défaut deviné : la colonne le porte. */
export async function exigibiliteDe(ctx: Ctx): Promise<Exigibilite> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ regime: entreprises.tvaExigibilite })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId));
    return (ligne?.regime ?? "encaissements") as Exigibilite;
  });
}

export async function reglerExigibilite(ctx: Ctx, regime: Exigibilite): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(entreprises)
      .set({ tvaExigibilite: regime, updatedAt: new Date() })
      .where(eq(entreprises.id, ctx.entrepriseId));
  });
}

/**
 * Toutes les factures émises, avec leurs règlements.
 *
 * Sert au relevé comme à l'écran d'attente : une seule lecture, une seule
 * vérité. Deux requêtes qui compteraient chacune de leur côté finiraient par
 * afficher deux totaux différents sur le même écran.
 */
export async function facturesAvecPaiements(ctx: Ctx): Promise<FactureEnAttente[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [lignes, regles] = await Promise.all([
      tx
        .select({
          id: factures.id,
          numeroCommercial: factures.numeroCommercial,
          dateEmission: factures.dateEmission,
          clientNom: factures.clientNom,
          chantierId: factures.chantierId,
          totalHt: factures.totalHt,
          totalTva: factures.totalTva,
          totalTtc: factures.totalTtc,
          // Ce qui permet de prévenir quand l'IBAN change — voir le type.
          entrepriseIban: factures.entrepriseIban,
          entrepriseTitulaireCompte: factures.entrepriseTitulaireCompte,
          ibanSignale: factures.ibanSignale,
          entrepriseNom: factures.entrepriseNom,
          clientTelephone: factures.clientTelephone,
          clientEmail: factures.clientEmail,
          clientCivilite: factures.clientCivilite,
        })
        .from(factures)
        .where(eq(factures.statut, "emise"))
        .orderBy(desc(factures.dateEmission), desc(factures.numeroCommercial)),
      tx.select().from(paiementsFacture).orderBy(asc(paiementsFacture.datePaiement)),
    ]);

    const parFacture = new Map<string, PaiementEnregistre[]>();
    for (const p of regles) {
      const liste = parFacture.get(p.factureId) ?? [];
      liste.push({
        id: p.id,
        date: p.datePaiement,
        montant: p.montant,
        moyen: p.moyen,
        note: p.note,
        origine: p.origine,
      });
      parFacture.set(p.factureId, liste);
    }

    const avoirsParFacture = await avoirsDesFactures(tx, lignes.map((f) => f.id));

    return lignes.map((f) => {
      const paiements = parFacture.get(f.id) ?? [];
      const pourTva: FacturePourTva = { ...f, avoirs: avoirsParFacture.get(f.id) ?? [] };
      return {
        ...f,
        avoirs: pourTva.avoirs,
        paiements,
        reste: resteDu(pourTva, paiements),
        etat: etatPaiement(pourTva, paiements),
      };
    });
  });
}

/** Celles qui attendent encore quelque chose — l'écran « En attente ». */
export async function facturesEnAttente(ctx: Ctx): Promise<FactureEnAttente[]> {
  return (await facturesAvecPaiements(ctx)).filter((f) => f.etat !== "soldee");
}

export type ResultatPaiement = { ok: true; reste: string; etat: EtatPaiement } | { ok: false; raison: string };

/**
 * Note un règlement — ou dit pourquoi c'est impossible.
 *
 * **Le refus remonte jusqu'à l'écran**, avec sa phrase. Un montant plus grand
 * que ce qui reste dû ferait entrer au relevé plus de TVA que la facture n'en
 * porte, et c'est l'administration qui poserait la question des mois plus tard.
 */
export async function noterPaiement(
  ctx: Ctx,
  factureId: string,
  demande: {
    date: string;
    montant: string;
    moyen?: PaiementEnregistre["moyen"];
    /** Le numéro du chèque (planche `appli/il-ne-paiera-pas.html`) ; ignoré pour un autre moyen. */
    numero?: string | null;
    note?: string;
  }
): Promise<ResultatPaiement> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [facture] = await tx
      .select({
        id: factures.id,
        dateEmission: factures.dateEmission,
        totalHt: factures.totalHt,
        totalTva: factures.totalTva,
        totalTtc: factures.totalTtc,
        statut: factures.statut,
      })
      .from(factures)
      .where(eq(factures.id, factureId));

    // Une facture qu'on ne voit pas — celle d'une autre entreprise, ou un
    // identifiant inventé — ne rend rien : la RLS a déjà fait son travail.
    if (!facture) return { ok: false as const, raison: "Cette facture est introuvable." };
    if (facture.statut !== "emise") {
      return { ok: false as const, raison: "Cette facture n'est pas encore émise." };
    }

    const dejaRegles = (
      await tx.select().from(paiementsFacture).where(eq(paiementsFacture.factureId, factureId))
    ).map((p) => ({ date: p.datePaiement, montant: p.montant }));

    const montant = String(demande.montant ?? "")
      .replace(/[\s  ]/g, "")
      .replace("€", "")
      .replace(",", ".");
    const pourTva: FacturePourTva = {
      ...facture,
      avoirs: (await avoirsDesFactures(tx, [factureId])).get(factureId) ?? [],
    };
    const refus = refusDuPaiement(pourTva, dejaRegles, { date: demande.date, montant });
    if (refus) return { ok: false as const, raison: refus };

    await tx.insert(paiementsFacture).values({
      entrepriseId: ctx.entrepriseId,
      factureId,
      datePaiement: demande.date,
      montant: Number(montant).toFixed(2),
      moyen: demande.moyen ?? null,
      // Comme sur la facture en cours (`poserReglementRecu`) : seul un chèque a
      // un numéro, et un numéro vide n'en est pas un.
      numero: demande.moyen === "cheque" ? demande.numero?.trim() || null : null,
      note: demande.note?.trim() || null,
      origine: "saisi",
    });

    const tous = [...dejaRegles, { date: demande.date, montant }];
    return {
      ok: true as const,
      reste: resteDu(pourTva, tous),
      etat: etatPaiement(pourTva, tous),
    };
  });
}

/**
 * Le geste d'un doigt : « payée », pour le solde, aujourd'hui.
 *
 * **C'est la porte qu'il a décrite** : *« je retourne sur l'endroit en attente,
 * je clique sur valider, et boum. »* Elle ne remplace pas la saisie détaillée —
 * un acompte demande une date et un montant — mais elle couvre le cas courant
 * en un appui, et c'est celui-là qui se fait cinquante fois par an.
 */
export async function soldera(ctx: Ctx, factureId: string, aujourdHui: string): Promise<ResultatPaiement> {
  const facture = (await facturesAvecPaiements(ctx)).find((f) => f.id === factureId);
  if (!facture) return { ok: false, raison: "Cette facture est introuvable." };
  if (facture.etat === "soldee") return { ok: false, raison: "Cette facture est déjà réglée." };

  // **La date d'émission plutôt qu'aujourd'hui si la facture est postérieure.**
  // Une facture datée de demain — cela arrive quand il la prépare d'avance — ne
  // peut pas avoir été encaissée hier : le règlement serait refusé, et le refus
  // parlerait d'une date qu'il n'a jamais saisie.
  const date = aujourdHui < facture.dateEmission ? facture.dateEmission : aujourdHui;
  return noterPaiement(ctx, factureId, { date, montant: facture.reste });
}

/**
 * Défait un règlement.
 *
 * **Sans lui, une erreur de doigt serait définitive** : une facture marquée
 * payée par mégarde déclarerait une TVA non encaissée, et rien ne permettrait
 * de revenir dessus. La ligne est supprimée pour de bon — contrairement aux
 * tranches de grille, il n'y a rien à préserver : c'est une saisie, pas une
 * donnée reçue.
 */
export async function retirerPaiement(ctx: Ctx, paiementId: string): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.delete(paiementsFacture).where(eq(paiementsFacture.id, paiementId));
  });
}

/** Combien de factures attendent, et depuis combien de temps la plus ancienne. */
export async function compterEnAttente(ctx: Ctx): Promise<{ nombre: number; plusAncienne: string | null }> {
  const enAttente = await facturesEnAttente(ctx);
  return {
    nombre: enAttente.length,
    plusAncienne: enAttente.reduce<string | null>(
      (min, f) => (min === null || f.dateEmission < min ? f.dateEmission : min),
      null
    ),
  };
}

/** Réservé aux suites : compter sans passer par l'écran. */
export async function compterPaiements(ctx: Ctx, factureId: string): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [r] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(paiementsFacture)
      .where(and(eq(paiementsFacture.factureId, factureId)));
    return r?.n ?? 0;
  });
}

// ─── LES ACOMPTES REÇUS, SUR LA FACTURE EN BROUILLON — sa planche du
// 14 septembre 2026 ─────────────────────────────────────────────────────────
//
// *« Chaque montant perçu avant la fin du chantier est un acompte. »* Ils se
// saisissent sur la facture avant qu'elle parte, et le papier les déduit :
// « Acompte 30 % − 522,23 € », puis « Net à payer ». Ce sont les mêmes lignes
// que « Noter un règlement » sur une facture émise — la même table, donc le
// même relevé de TVA à la date où l'argent est tombé —, avec deux choses de
// plus : le numéro du chèque, et la marque du solde posé par l'interrupteur
// « Facture acquittée ».
//
// **Un acompte reçu AVANT la date de la facture est normal ici.** C'est
// l'acompte à la signature. La règle « un règlement ne précède pas sa
// facture » (`refusDuPaiement`) vaut pour une facture ÉMISE, dont la date
// fait foi ; un brouillon n'en a pas encore. La règle des brouillons vit dans
// `refusDuReglementRecu` (`src/lib/acomptes-facture.ts`).

export type ReglementEnregistre = ReglementRecu & { id: string };

/**
 * ─── LE TOTAL D'UN BROUILLON SE CALCULE, IL NE SE LIT PAS ──────────────────
 *
 * **Sa panne du 22 septembre 2026 :** *« je peux pas mettre de règlement reçu
 * non plus »*, capture à l'appui — « Il ne reste que 0,00 € à recevoir sur
 * cette facture » écrit sous un Total TTC de 552,52 €.
 *
 * Une facture née SANS devis pose ses trois colonnes de totaux à « 0.00 », et
 * c'est délibéré : elles ne font pas foi, tout se recalcule depuis les lignes
 * à chaque affichage comme à l'émission (`creerFactureSansDevis`). L'écran
 * montrait donc le vrai total pendant que ce garde-ci lisait la COLONNE :
 * zéro euro à recevoir, le moindre acompte refusé, et « Facture acquittée »
 * qui ne posait aucun solde — le doigt sur l'interrupteur ne faisait rien.
 *
 * **C'est `totauxAvecReduction` qui décide**, celle de l'écran et du PDF : une
 * seconde addition ici aurait divergé au premier ajustement (`CLAUDE.md` §3).
 * Une facture ÉMISE, elle, garde la colonne — figée au moment de l'émission,
 * c'est le chiffre que le client a reçu, et ses lignes ne bougent plus.
 */
async function factureEnBrouillon(tx: DbOrTx, factureId: string) {
  const [f] = await tx
    .select({
      id: factures.id,
      statut: factures.statut,
      tauxTva: factures.tauxTva,
      reductionPourcent: factures.reductionPourcent,
    })
    .from(factures)
    .where(eq(factures.id, factureId))
    .limit(1);
  if (!f) return { ok: false as const, raison: "Cette facture est introuvable." };
  if (f.statut !== "brouillon") {
    return { ok: false as const, raison: "La facture est déjà arrêtée : ses règlements se notent depuis Terminés." };
  }
  const lignes = await tx
    .select({ montant: lignesFacture.montant, tauxTva: lignesFacture.tauxTva })
    .from(lignesFacture)
    .where(eq(lignesFacture.factureId, factureId));
  const totaux = totauxAvecReduction(lignes, f.tauxTva, f.reductionPourcent);
  return { ok: true as const, facture: { id: f.id, statut: f.statut, totalTtc: totaux.totalTtc } };
}

async function lireReglements(tx: DbOrTx, factureId: string): Promise<ReglementEnregistre[]> {
  const rows = await tx
    .select()
    .from(paiementsFacture)
    .where(eq(paiementsFacture.factureId, factureId))
    .orderBy(asc(paiementsFacture.datePaiement), asc(paiementsFacture.createdAt));
  return rows.map((p) => ({
    id: p.id,
    date: p.datePaiement,
    montant: p.montant,
    moyen: p.moyen,
    numero: p.numero,
    solde: p.solde,
    libelle: p.libelle,
  }));
}

/** Les règlements reçus d'une facture, dans l'ordre où ils sont tombés. */
export async function reglementsRecus(ctx: Ctx, factureId: string): Promise<ReglementEnregistre[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => lireReglements(tx, factureId));
}

export type SaisieReglement = {
  date: string;
  montant: string;
  moyen: MoyenDePaiement | null;
  numero: string | null;
  /**
   * Ce qu'il écrit à la place du nom proposé (migration 0098). Vide ou absent :
   * la colonne repasse à `null`, donc au nom déduit — effacer le mot rend la
   * proposition, jamais une case vide sur la facture.
   */
  libelle?: string | null;
};

/** Vide vaut `null` : une case effacée rend le nom déduit, pas un blanc. */
function libellePropre(libelle: string | null | undefined): string | null {
  return libelle?.trim() || null;
}

function montantPropre(montant: string): string {
  return String(montant ?? "").replace(/[\s  ]/g, "").replace("€", "").replace(",", ".");
}

/** Pose un acompte reçu sur une facture en brouillon. Le refus revient en valeur, avec ses mots. */
export async function poserReglementRecu(
  ctx: Ctx,
  factureId: string,
  saisie: SaisieReglement
): Promise<{ ok: true; reglements: ReglementEnregistre[] } | { ok: false; raison: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const garde = await factureEnBrouillon(tx, factureId);
    if (!garde.ok) return garde;
    const deja = await lireReglements(tx, factureId);
    const montant = montantPropre(saisie.montant);
    const refus = refusDuReglementRecu(garde.facture.totalTtc, deja, { date: saisie.date, montant });
    if (refus) return { ok: false as const, raison: refus };
    await tx.insert(paiementsFacture).values({
      entrepriseId: ctx.entrepriseId,
      factureId,
      datePaiement: saisie.date,
      montant: Number(montant).toFixed(2),
      moyen: saisie.moyen,
      numero: saisie.moyen === "cheque" ? saisie.numero?.trim() || null : null,
      libelle: libellePropre(saisie.libelle),
      origine: "saisi",
    });
    return { ok: true as const, reglements: await lireReglements(tx, factureId) };
  });
}

/** Corrige un acompte reçu — sa date, son moyen, son numéro, son montant. */
export async function majReglementRecu(
  ctx: Ctx,
  reglementId: string,
  saisie: SaisieReglement
): Promise<{ ok: true; reglements: ReglementEnregistre[] } | { ok: false; raison: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx.select().from(paiementsFacture).where(eq(paiementsFacture.id, reglementId)).limit(1);
    if (!p) return { ok: false as const, raison: "Ce règlement est introuvable." };
    const garde = await factureEnBrouillon(tx, p.factureId);
    if (!garde.ok) return garde;
    const autres = (await lireReglements(tx, p.factureId)).filter((g) => g.id !== reglementId);
    const montant = montantPropre(saisie.montant);
    const refus = refusDuReglementRecu(garde.facture.totalTtc, autres, { date: saisie.date, montant });
    if (refus) return { ok: false as const, raison: refus };
    await tx
      .update(paiementsFacture)
      .set({
        datePaiement: saisie.date,
        montant: Number(montant).toFixed(2),
        moyen: saisie.moyen,
        numero: saisie.moyen === "cheque" ? saisie.numero?.trim() || null : null,
        libelle: libellePropre(saisie.libelle),
      })
      .where(eq(paiementsFacture.id, reglementId));
    return { ok: true as const, reglements: await lireReglements(tx, p.factureId) };
  });
}

/** Retire un acompte reçu d'une facture en brouillon. */
export async function retirerReglementRecu(
  ctx: Ctx,
  reglementId: string
): Promise<{ ok: true; reglements: ReglementEnregistre[] } | { ok: false; raison: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx.select().from(paiementsFacture).where(eq(paiementsFacture.id, reglementId)).limit(1);
    if (!p) return { ok: false as const, raison: "Ce règlement est introuvable." };
    const garde = await factureEnBrouillon(tx, p.factureId);
    if (!garde.ok) return garde;
    await tx.delete(paiementsFacture).where(eq(paiementsFacture.id, reglementId));
    return { ok: true as const, reglements: await lireReglements(tx, p.factureId) };
  });
}

/**
 * « Facture acquittée » : allumé, le solde est compté reçu à la date du jour ;
 * éteint, ce solde-là repart. Les acomptes saisis à la main ne bougent pas.
 * Un solde n'est posé que s'il reste quelque chose à recevoir.
 */
export async function basculerAcquittee(
  ctx: Ctx,
  factureId: string,
  allumee: boolean,
  aujourdHui: string
): Promise<{ ok: true; reglements: ReglementEnregistre[] } | { ok: false; raison: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const garde = await factureEnBrouillon(tx, factureId);
    if (!garde.ok) return garde;
    if (!allumee) {
      await tx
        .delete(paiementsFacture)
        .where(and(eq(paiementsFacture.factureId, factureId), eq(paiementsFacture.solde, true)));
      return { ok: true as const, reglements: await lireReglements(tx, factureId) };
    }
    const deja = await lireReglements(tx, factureId);
    const reste = netAPayer(garde.facture.totalTtc, deja);
    if (Number(reste) > 0 && !deja.some((g) => g.solde)) {
      await tx.insert(paiementsFacture).values({
        entrepriseId: ctx.entrepriseId,
        factureId,
        datePaiement: aujourdHui,
        montant: reste,
        moyen: "virement",
        solde: true,
        origine: "saisi",
      });
    }
    return { ok: true as const, reglements: await lireReglements(tx, factureId) };
  });
}
