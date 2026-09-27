"use server";

import { headers } from "next/headers";
import { repondreAuContrat } from "@/server/repositories/contrats-entretien";
import { logger } from "@/server/logger";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { SOURCE_NON_ETABLIE } from "@/lib/source-visiteur";
import { adresseClient } from "@/lib/adresse-client";

export type EtatReponseContrat = { erreur: string } | { succes: string } | undefined;

/**
 * LA RÉPONSE DU CLIENT À SON CONTRAT, sans compte ni session.
 *
 * **Les bornes de la réponse à un devis, et pour les mêmes raisons**
 * (`devis/[jeton]/actions.ts`) : le jeton ne se devine pas, ce qu'on borne est
 * le coût. Le seuil par jeton s'applique toujours ; celui par source seulement
 * quand la source est établie, sinon tous les clients partageraient un seau et
 * un inconnu bloquerait les signatures de tout le monde.
 */
export async function repondreContratAction(
  _etat: EtatReponseContrat,
  formData: FormData
): Promise<EtatReponseContrat> {
  const jeton = String(formData.get("jeton") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "accepte" && decision !== "refuse") {
    return { erreur: "Indiquez si vous acceptez ce contrat." };
  }

  const source = await sourceDuVisiteur(horsProductionReelle());
  const seuils: Array<readonly [string, { max: number; fenetreMs: number }]> = [
    [`reponse-contrat:${jeton}`, LIMITES.reponseDevis],
  ];
  if (source !== SOURCE_NON_ETABLIE) seuils.push([`reponse-contrat:source:${source}`, LIMITES.reponseDevisParSource]);
  for (const [cle, limite] of seuils) {
    const cadence = await verifierLimite(cle, limite);
    if (!cadence.autorise) {
      const minutes = Math.max(1, Math.ceil(cadence.retryAfterSecondes / 60));
      logger.warn("Cadence atteinte sur la réponse à un contrat");
      return {
        erreur: `Trop de tentatives en peu de temps. Patientez ${minutes} minute${minutes > 1 ? "s" : ""}, puis recommencez : votre contrat reste valable.`,
      };
    }
  }

  const entetes = await headers();
  const r = await repondreAuContrat(jeton, {
    decision,
    adresseIp: adresseClient(entetes),
    agent: entetes.get("user-agent"),
  });
  if (!r.ok) {
    return {
      erreur:
        r.motif === "deja_repondu"
          ? "Vous avez déjà répondu à ce contrat."
          : "Ce lien n'est plus valable. Contactez votre artisan pour en recevoir un nouveau.",
    };
  }
  logger.info(decision === "accepte" ? "Contrat d'entretien accepté par le client" : "Contrat d'entretien refusé par le client");
  return {
    succes:
      decision === "accepte"
        ? "Merci, votre contrat est accepté."
        : "Votre réponse est transmise à votre artisan.",
  };
}
