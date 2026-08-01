"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { getOuCreerDevisBrouillon, envoyerDevis } from "@/server/repositories/devis";
import { listerPrestations } from "@/server/repositories/prestations";
import { ingererDevis } from "@/server/documents/ingestion";
import { preparerEnvoi } from "@/server/repositories/preparation-envoi";
import { creerEnvoi, DatesProposeesInvalidesError } from "@/server/repositories/envois-devis";

export async function chargerDevisAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  const devis = await getOuCreerDevisBrouillon(ctx, chantierId);
  const prestations = await listerPrestations(ctx, chantierId);
  return { devis, prestations: prestations.map((p) => p.libelle) };
}

export async function envoyerDevisAction(devisId: string) {
  const ctx = await getCurrentCtx();
  const resultat = await envoyerDevis(ctx, devisId);
  try {
    // Base documentaire (lot IA-07) : rend le devis envoyé recherchable par
    // l'assistant. Un échec d'ingestion ne doit jamais faire échouer l'envoi.
    if (resultat.chantierId) await ingererDevis(ctx, resultat.chantierId);
  } catch {
    // Volontairement silencieux : voir commentaire ci-dessus.
  }
  return resultat;
}

// --- Envoi au client : la seule question posée au patron (docs/AGENT.md §2.2) ---

export async function preparerEnvoiAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  return preparerEnvoi(ctx, chantierId);
}

export type ResultatEnvoiClient =
  | { succes: true; lien: string; canal: "sms" | "email"; destinataire: string | null }
  | { succes: false; erreur: string };

/**
 * Marque le devis comme envoyé, crée le lien destiné au client et place le
 * chantier en attente de réponse.
 *
 * Le lien est RENVOYÉ à l'appelant plutôt qu'expédié : aucun fournisseur de SMS
 * ni d'e-mail n'est encore branché (voir docs/AGENT.md §5). En attendant, le
 * patron peut le transmettre lui-même — ce qui est préférable à un envoi qui
 * échouerait en silence.
 */
export async function envoyerAuClientAction(
  chantierId: string,
  devisId: string,
  datesProposees: string[]
): Promise<ResultatEnvoiClient> {
  const ctx = await getCurrentCtx();

  const preparation = await preparerEnvoi(ctx, chantierId);
  if (preparation.blocage === "canal_absent") {
    return {
      succes: false,
      erreur: "Indiquez d'abord comment joindre ce client — par SMS ou par e-mail.",
    };
  }
  if (preparation.blocage === "coordonnee_absente") {
    return {
      succes: false,
      erreur:
        preparation.canal === "sms"
          ? "Ce client n'a pas de numéro de téléphone enregistré."
          : "Ce client n'a pas d'adresse e-mail enregistrée.",
    };
  }
  if (!preparation.canal) {
    return { succes: false, erreur: "Impossible de préparer l'envoi pour ce chantier." };
  }

  if (datesProposees.length < 1 || datesProposees.length > 2) {
    return { succes: false, erreur: "Proposez une date, ou deux au choix du client." };
  }

  // L'envoi du devis (PDF figé) précède la création du lien : c'est ce PDF dont
  // on prend l'empreinte, et c'est lui que le client acceptera.
  const devisEnvoye = await envoyerDevisAction(devisId);

  try {
    const envoi = await creerEnvoi(ctx, {
      chantierId,
      devisId,
      canal: preparation.canal,
      datesProposees,
      contenuDevis: `${devisEnvoye.numeroCommercial}|${devisEnvoye.numeroVersion}|${devisEnvoye.totalTtc}`,
    });
    return {
      succes: true,
      lien: `/devis/${envoi.jeton}`,
      canal: preparation.canal,
      destinataire: preparation.destinataire,
    };
  } catch (err) {
    if (err instanceof DatesProposeesInvalidesError) {
      return {
        succes: false,
        erreur: "Une des dates proposées n'est plus libre. Choisissez-en une autre.",
      };
    }
    throw err;
  }
}
