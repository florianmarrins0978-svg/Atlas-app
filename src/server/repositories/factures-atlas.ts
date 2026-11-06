import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { abonnements, compteurFacturesAtlas, entreprises, facturesAtlas } from "../db/schema";
import { donneesFactureAtlas, numeroFactureAtlas } from "@/lib/facture-atlas";
import { formule, TVA_ABONNEMENT_POURCENT } from "@/lib/abonnements";
import type { FacturePayeeLue } from "../paiement/stripe";
import { pieceDeLaFacture } from "../pdf/facture-x-pdf";
import { enregistrerObjet } from "../storage";
import { envoyerCourriel } from "../courriel";
import { adressesDesPatronsDans } from "./membres-entreprise";
import { getEnv } from "../env";
import { logger } from "../logger";

export type EmissionFactureAtlas = "emise" | "deja-emise" | "abonnement-inconnu" | "refusee";

/**
 * ÉMETTRE LA FACTURE D'ABONNEMENT D'ATLAS, au crochet `invoice.paid` (ses
 * réponses du 5 novembre 2026 : TVA, et Factur-X).
 *
 * Sans session, comme le reste du crochet : l'entreprise se DÉDUIT de
 * l'abonnement reconnu (la politique `abonnements_par_identifiant_prestataire`
 * n'ouvre que cette ligne), jamais d'une valeur envoyée par Stripe.
 *
 * **Une seule transaction pour le numéro et la ligne** : le compteur se
 * verrouille, la pièce se compose, le PDF se range, la ligne s'écrit. Un échec
 * n'importe où annule tout, compteur compris : la suite reste sans trou, et
 * Stripe répétera le crochet. Un paiement déjà facturé ne refait rien
 * (`facture_prestataire` unique).
 *
 * **Factur-X, ou le PDF ordinaire** par la règle du lot Factur-X
 * (`pieceDeLaFacture`) : une adresse d'artisan sans code postal fait partir un
 * PDF, ce qui reste une facture valable avant septembre 2027, et le refus se
 * journalise. Ce qui ne part JAMAIS : une facture sans l'identité d'Atlas.
 *
 * L'e-mail au patron part après, hors de la transaction : un service d'e-mail
 * coupé ne doit pas défaire une facture émise. Elle reste dans la base.
 */
export async function emettreLaFactureDAbonnement(
  lue: FacturePayeeLue,
  maintenant: Date = new Date()
): Promise<EmissionFactureAtlas> {
  const vendeur = getEnv().vendeurAtlas;
  const resultat = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.abonnement_prestataire', ${lue.abonnementPrestataire}, true)`);
    const [abonnement] = await tx
      .select({ entrepriseId: abonnements.entrepriseId, formule: abonnements.formule })
      .from(abonnements)
      .where(eq(abonnements.abonnementPrestataire, lue.abonnementPrestataire))
      .limit(1);
    if (!abonnement) return { statut: "abonnement-inconnu" as const };
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${abonnement.entrepriseId}, true)`);

    const [deja] = await tx
      .select({ id: facturesAtlas.id })
      .from(facturesAtlas)
      .where(eq(facturesAtlas.facturePrestataire, lue.facturePrestataire))
      .limit(1);
    if (deja) return { statut: "deja-emise" as const };

    const [acheteur] = await tx
      .select({ nom: entreprises.nom, adresse: entreprises.adresse, siret: entreprises.siret, numeroTva: entreprises.numeroTva })
      .from(entreprises)
      .where(eq(entreprises.id, abonnement.entrepriseId))
      .limit(1);
    if (!acheteur) return { statut: "abonnement-inconnu" as const };

    const encaissement = {
      htCentimes: lue.htCentimes,
      tvaCentimes: lue.tvaCentimes,
      ttcCentimes: lue.ttcCentimes,
      tauxPourcent: TVA_ABONNEMENT_POURCENT,
      formuleNom: formule(abonnement.formule)?.nom ?? abonnement.formule,
      periodeDebut: lue.periodeDebut,
      periodeFin: lue.periodeFin,
    };
    // **La pièce se vérifie AVANT de tirer son numéro** : un refus (identité
    // d'Atlas incomplète, montants qui ne se recoupent pas) ne doit pas
    // consommer un rang, sinon la suite aurait un trou. Rien n'est écrit, et
    // la raison se lit au journal ; Stripe ne rejoue pas un 200, la facture
    // devra donc être émise à la main, et le journal dit laquelle.
    const essai = donneesFactureAtlas({ vendeur, acheteur, numero: "", dateEmission: lue.payeeLe, encaissement });
    if (!essai.ok) {
      logger.error("Facture d'abonnement non émise", { facture: lue.facturePrestataire, raison: essai.raison });
      return { statut: "refusee" as const };
    }

    // Le compteur se verrouille ICI : deux paiements simultanés se suivent.
    const [compteur] = await tx
      .update(compteurFacturesAtlas)
      .set({ dernier: sql`${compteurFacturesAtlas.dernier} + 1` })
      .where(eq(compteurFacturesAtlas.id, 1))
      .returning({ rang: compteurFacturesAtlas.dernier });
    if (!compteur) throw new Error("Le compteur des factures d'Atlas est absent (migration 0172).");

    const numero = numeroFactureAtlas(compteur.rang, Number(lue.payeeLe.slice(0, 4)));
    const piece = donneesFactureAtlas({ vendeur, acheteur, numero, dateEmission: lue.payeeLe, encaissement });
    // Les mêmes entrées qu'à l'essai, seul le numéro change : ne peut pas refuser.
    if (!piece.ok) throw new Error(`Facture d'abonnement refusée après l'essai : ${piece.raison}`);

    const pdf = await pieceDeLaFacture(piece.donnees, {}, maintenant);
    const objet = await enregistrerObjet(`atlas/factures/${abonnement.entrepriseId}`, Buffer.from(pdf), ".pdf");
    await tx.insert(facturesAtlas).values({
      entrepriseId: abonnement.entrepriseId,
      rang: compteur.rang,
      numero,
      facturePrestataire: lue.facturePrestataire,
      emiseLe: lue.payeeLe,
      periodeDebut: lue.periodeDebut,
      periodeFin: lue.periodeFin,
      formule: abonnement.formule,
      totalHt: piece.donnees.totalHt,
      totalTva: piece.donnees.totalTva,
      totalTtc: piece.donnees.totalTtc,
      acheteurNom: acheteur.nom,
      acheteurAdresse: acheteur.adresse,
      acheteurSiret: acheteur.siret,
      acheteurNumeroTva: acheteur.numeroTva,
      pdfStorageKey: objet.storageKey,
    });
    const patrons = await adressesDesPatronsDans(tx, abonnement.entrepriseId);
    return { statut: "emise" as const, numero, pdf, patrons, total: piece.donnees.totalTtc };
  });

  if (resultat.statut !== "emise") return resultat.statut;
  for (const a of resultat.patrons) {
    const r = await envoyerCourriel({
      a,
      objet: `Votre facture Atlas ${resultat.numero}`,
      texte: `Votre facture d'abonnement Atlas ${resultat.numero}, ${resultat.total.replace(".", ",")} € TTC, est jointe.`,
      pieceJointe: { nom: `${resultat.numero}.pdf`, contenu: resultat.pdf },
    });
    if (!r.ok) logger.warn("Facture d'abonnement émise, e-mail non parti", { numero: resultat.numero, raison: r.raison });
  }
  return "emise";
}
