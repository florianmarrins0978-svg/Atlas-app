"use server";

import { headers } from "next/headers";
import {
  accuserReceptionDeLaFacture,
  noterOuvertureDeLaFacture,
} from "@/server/repositories/envois-factures";
import { logger } from "@/server/logger";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { SOURCE_NON_ETABLIE } from "@/lib/source-visiteur";
import { adresseClient } from "@/lib/adresse-client";

/**
 * « Ah ouais mais j'ai pas vu votre facture » — les deux écritures du client.
 *
 * Sa demande du 9 septembre 2026. Ce sont, avec la réponse au devis, les seules
 * écritures d'Atlas ouvertes SANS session : elles sont donc bornées en cadence
 * exactement comme elle, et par le mécanisme CENTRAL — un compteur écrit ici
 * serait invisible le jour où l'on cherche pourquoi une cadence bloque.
 */

/** La borne, avant toute lecture en base : sinon elle ne bornerait que ce qui a déjà coûté. */
async function cadenceDepassee(jeton: string): Promise<boolean> {
  const source = await sourceDuVisiteur(horsProductionReelle());
  const seuils: Array<readonly [string, { max: number; fenetreMs: number }]> = [
    [`reception-facture:${jeton}`, LIMITES.receptionFacture],
  ];
  // **Seulement si la source est établie.** Sans `ATLAS_PROXY_SAUTS`, tous les
  // visiteurs partagent un seul seau (`src/lib/source-visiteur.ts`) : appliqué
  // tel quel, ce seuil empêcherait tous les clients de tous les artisans de
  // confirmer leur facture. C'est la leçon de la revue hostile de F9.
  if (source !== SOURCE_NON_ETABLIE) {
    seuils.push([`reception-facture:source:${source}`, LIMITES.receptionFactureParSource]);
  }

  for (const [cle, limite] of seuils) {
    const cadence = await verifierLimite(cle, limite);
    if (!cadence.autorise) return true;
  }
  return false;
}

async function empreinte() {
  const entetes = await headers();
  return {
    adresseIp: adresseClient(entetes),
    agentUtilisateur: entetes.get("user-agent"),
  };
}

/**
 * Le client a OUVERT sa facture — appelé par le navigateur, jamais au rendu.
 *
 * **C'est tout l'intérêt de passer par une action.** Une messagerie qui déplie
 * l'aperçu d'un lien, un antivirus qui le vérifie, un robot d'indexation :
 * tous demandent l'adresse, aucun n'exécute de JavaScript. Noter l'ouverture
 * pendant le rendu du serveur poserait une date que personne n'a vécue — et
 * elle serait fausse le jour précis où elle sert de preuve.
 *
 * **Ne rend rien, et ne refuse rien à l'écran.** Le client n'a rien demandé :
 * un message d'échec ici l'inquiéterait sur une facture qui va très bien.
 */
export async function noterOuvertureAction(jeton: string): Promise<void> {
  if (!jeton) return;
  if (await cadenceDepassee(jeton)) return;

  try {
    await noterOuvertureDeLaFacture(jeton, await empreinte());
  } catch (e) {
    // Journalisé, jamais levé : une exception d'action serveur n'arrive de
    // toute façon jamais jusqu'à lui (`AGENTS.md`, piège 0 ter), et cette
    // écriture-ci n'est pas ce que le client est venu faire.
    logger.warn("L'ouverture d'une facture n'a pas pu être notée", { erreur: String(e) });
  }
}

export type EtatReception =
  | { confirmeLe: string }
  | { erreur: string }
  | undefined;

/**
 * Le client coche « J'ai bien reçu cette facture ».
 *
 * **Ne conditionne RIEN**, et surtout pas le téléchargement : le patron l'a
 * tranché le jour où il l'a proposé — *« ça ne l'empêche pas de télécharger la
 * facture s'il ne coche pas ! »*. Une facture se donne ; la retenir se
 * retournerait contre lui, puisqu'un client qui ne coche pas ne télécharge pas
 * non plus, et là il ne l'aurait vraiment pas reçue.
 */
export async function accuserReceptionAction(jeton: string): Promise<EtatReception> {
  if (!jeton) return { erreur: "Ce lien n'est plus valable." };

  if (await cadenceDepassee(jeton)) {
    logger.warn("Cadence atteinte sur la réception d'une facture");
    return {
      erreur: "Trop de tentatives en peu de temps. Patientez une minute, puis recommencez.",
    };
  }

  try {
    const r = await accuserReceptionDeLaFacture(jeton, await empreinte());
    if (!r.ok) return { erreur: r.raison };
    // La date part en ISO : c'est l'écran qui la met en mots, avec le reste de
    // ses libellés. Deux façons de dire un jour finiraient par diverger.
    return { confirmeLe: r.accuseLe.toISOString() };
  } catch (e) {
    logger.error("La réception d'une facture n'a pas pu être enregistrée", { erreur: String(e) });
    return { erreur: "Ça n'a pas pu être enregistré. Réessayez." };
  }
}
