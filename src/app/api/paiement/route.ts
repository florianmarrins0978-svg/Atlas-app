import { NextResponse } from "next/server";
import { verifierSignature } from "@/lib/signature-stripe";
import { lireUnAbonnement } from "@/server/paiement/stripe";
import { appliquerDepuisLeCrochet } from "@/server/repositories/abonnements";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { idRequeteValideOuGenere, executerAvecContexte } from "@/server/request-context";

export const dynamic = "force-dynamic";

/**
 * LE CROCHET DU PRESTATAIRE — ce qui tient l'abonnement à jour ensuite.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS.**
 *
 * Le premier paiement n'a PAS besoin de lui : le patron revient sur son écran
 * et son abonnement s'y enregistre (`/reglages/abonnement`). Ce crochet porte
 * tout ce qui arrive quand personne ne regarde — le renouvellement du mois
 * suivant, une carte expirée, une résiliation faite depuis le guichet.
 *
 * Sans lui, Atlas afficherait indéfiniment l'état du jour du premier paiement.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **LA SEULE CHOSE QUI PROTÈGE CETTE ADRESSE EST LA SIGNATURE.**
 *
 * Elle est publique — elle doit l'être, puisque le prestataire la frappe de
 * l'extérieur. Sans vérification, n'importe qui y posterait « abonnement
 * payé » et s'offrirait la formule Illimité. La signature est donc lue AVANT
 * toute chose, sur le corps EXACT reçu : `JSON.parse` puis `JSON.stringify`
 * réordonne les clés et la signature ne retomberait plus jamais juste.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI ON RÉPOND 200 À CE QU'ON N'A PAS TRAITÉ.**
 *
 * Le prestataire RÉPÈTE tant qu'il n'a pas reçu un 200. Répondre en erreur
 * pour un événement qui ne nous concerne pas — et il en envoie beaucoup — le
 * ferait revenir toutes les heures, jusqu'à ce qu'il coupe le crochet de
 * lui-même. Un 200 dit « reçu », jamais « appliqué ».
 *
 * Ce qui rend un 400 utile, en revanche : une signature fausse. Là, il faut
 * que ce soit dit — c'est le seul cas où le silence coûterait cher.
 */
export async function POST(request: Request) {
  const requestId = idRequeteValideOuGenere(request.headers.get("x-request-id"));
  return executerAvecContexte({ requestId }, async () => {
    const secret = getEnv().paiementSecretCrochet;
    if (!secret) {
      logger.error("Crochet de paiement appelé sans ATLAS_PAIEMENT_SECRET_CROCHET configuré");
      return NextResponse.json({ erreur: "Non configuré." }, { status: 503 });
    }

    const corps = await request.text();
    const verdict = verifierSignature(corps, request.headers.get("stripe-signature"), secret, new Date());
    if (!verdict.valide) {
      // **Le motif va au journal, pas à la réponse.** Dire « trop vieille »
      // plutôt que « signature fausse » apprendrait à qui frappe ce qu'il doit
      // corriger — la règle des routes de ce dépôt : jamais un refus bavard.
      logger.warn("Crochet de paiement refusé", { raison: verdict.raison });
      return NextResponse.json({ erreur: "Refusé." }, { status: 400 });
    }

    let evenement: Record<string, unknown>;
    try {
      evenement = JSON.parse(corps) as Record<string, unknown>;
    } catch {
      logger.error("Crochet de paiement : corps signé mais illisible");
      return NextResponse.json({ erreur: "Refusé." }, { status: 400 });
    }

    const id = typeof evenement.id === "string" ? evenement.id : null;
    const type = typeof evenement.type === "string" ? evenement.type : null;
    if (!id || !type) {
      logger.error("Crochet de paiement : événement sans identifiant ni type");
      return NextResponse.json({ recu: true });
    }

    /**
     * **On ne lit QUE des abonnements**, et on les relit en entier plutôt que
     * de déduire un état du NOM de l'événement. Un « paiement échoué » suivi
     * d'un « paiement réussi » arrivés dans le désordre laisserait sinon
     * l'abonnement marqué impayé alors qu'il est payé. L'objet, lui, porte son
     * état vrai au moment où le prestataire l'a envoyé.
     */
    const objet = evenement.data && typeof evenement.data === "object" ? (evenement.data as Record<string, unknown>).object : null;
    if (!objet || typeof objet !== "object" || (objet as Record<string, unknown>).object !== "subscription") {
      return NextResponse.json({ recu: true });
    }

    const etat = lireUnAbonnement(objet as Record<string, unknown>);
    if (!etat) return NextResponse.json({ recu: true });

    const applique = await appliquerDepuisLeCrochet(id, type, etat);
    // `false` = abonnement inconnu, ou événement déjà vu. Les deux valent un
    // 200 : il n'y a rien à refaire, et le redemander ne changerait rien.
    if (!applique) logger.info("Crochet de paiement sans effet", { type });

    return NextResponse.json({ recu: true });
  });
}
