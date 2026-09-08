"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { facturesAvecAncienIban, marquerIbanSignale, type FactureAPrevenir } from "@/server/repositories/factures";

/**
 * PRÉVENIR SES CLIENTS QUE L'IBAN A CHANGÉ — les deux gestes, à un seul endroit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI CE FICHIER N'EST PAS DANS UNE ROUTE.** Trois écrans portent la même
 * alerte — les réglages, « En attente de paiement », et l'écran du jour où
 * l'IBAN change. Trois `actions.ts` auraient donné trois copies du même geste :
 * la première divergerait au premier correctif, et l'artisan verrait alors
 * l'alerte s'éteindre sur un écran et pas sur l'autre (`CLAUDE.md` §3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **RÉSERVÉ AU PROPRIÉTAIRE**, comme l'écran d'où ça part : l'IBAN et la liste
 * des impayés ne regardent ni un salarié ni un commercial
 * (`docs/QUESTIONS.md` §10).
 *
 * **Le refus de rôle LÈVE, comme partout ailleurs**, et ce n'est pas une
 * exception à la règle du retour en valeur : celle-ci vise les refus que le
 * patron doit LIRE. Un salarié n'arrive jamais ici — `GardeAcces` lui ferme
 * déjà l'écran —, et s'il y arrivait par une autre porte, il n'y a rien à lui
 * expliquer.
 */

/** Ce qui reste à signaler, à cet instant. Vide = rien à afficher. */
export async function listerAPrevenirAction(): Promise<FactureAPrevenir[]> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "lister les factures à signaler");
  return facturesAvecAncienIban(ctx);
}

/**
 * Note qu'on a prévenu ce client, et rend ce qui reste.
 *
 * **Rendre la liste plutôt qu'un `ok`** : l'écran affiche ce que le serveur
 * vient de calculer, au lieu de retirer la ligne de son côté. Deux façons de
 * tenir la même liste — celle de l'écran et celle de la base — finiraient par
 * ne plus dire la même chose, et c'est l'écran qu'on croirait.
 */
export async function prevenirAction(factureId: string): Promise<FactureAPrevenir[]> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "signaler le nouvel IBAN à un client");
  await marquerIbanSignale(ctx, factureId);
  return facturesAvecAncienIban(ctx);
}
