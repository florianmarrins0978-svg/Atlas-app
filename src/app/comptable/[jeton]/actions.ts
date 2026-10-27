"use server";

import { poserVerdictParJeton } from "@/server/repositories/verification-comptable";
import { signerLAttestation } from "@/server/attestation-comptable";
import { envoyerCourriel } from "@/server/courriel";
import { lireLaSaisie, type Conclusion } from "@/lib/attestation-comptable";
import { logger } from "@/server/logger";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { SOURCE_NON_ETABLIE } from "@/lib/source-visiteur";
import type { VerdictDuComptable } from "@/lib/pour-mon-comptable";

/**
 * LE VERDICT DU COMPTABLE — la seule écriture de sa page, ouverte SANS
 * session. Bornée en cadence par le mécanisme central, comme la réponse au
 * devis et l'accusé de la facture (`factures/[jeton]/actions.ts`).
 */
export async function poserVerdictAction(
  jeton: string,
  mouvementId: string,
  verdict: VerdictDuComptable | null,
  note: string | null
): Promise<{ ok: true } | { ok: false; raison: string }> {
  if (verdict !== null && verdict !== "valide" && verdict !== "rejete") return { ok: false, raison: "Ce choix n'est pas lisible." };
  if (!/^[0-9a-f-]{36}$/i.test(mouvementId)) return { ok: false, raison: "Cette ligne n'est pas dans le dossier." };

  const source = await sourceDuVisiteur(horsProductionReelle());
  const seuils: Array<readonly [string, { max: number; fenetreMs: number }]> = [[`verdict-comptable:${jeton}`, LIMITES.verdictComptable]];
  // Seulement si la source est établie : sans `ATLAS_PROXY_SAUTS`, tous les
  // visiteurs partagent un seul seau (la leçon de F9, `factures/[jeton]`).
  if (source !== SOURCE_NON_ETABLIE) seuils.push([`verdict-comptable:source:${source}`, LIMITES.verdictComptableParSource]);
  for (const [cle, limite] of seuils) {
    if (!(await verifierLimite(cle, limite)).autorise) return { ok: false, raison: "Trop d'appuis d'un coup. Réessayez dans une minute." };
  }

  try {
    return await poserVerdictParJeton(jeton, mouvementId, verdict, typeof note === "string" ? note : null);
  } catch (err) {
    // Une panne imprévue se journalise avant de répondre : le message d'une
    // exception n'arriverait jamais jusqu'au comptable (`HANDOVER.md`).
    logger.error("Le verdict du comptable n'a pas pu s'enregistrer", { erreur: err instanceof Error ? err.message : String(err) });
    return { ok: false, raison: "Ce choix n'a pas pu s'enregistrer. Réessayez." };
  }
}

/** Une signature dessinée tient en quelques dizaines de kilo-octets ; le texte qui la porte, un tiers de plus. */
const SIGNATURE_MAX_CARACTERES = 560_000;

/**
 * L'ATTESTATION SIGNÉE — sa planche du 27 octobre 2026. Ouverte sans session,
 * comme le verdict : le jeton est la garde, la cadence est bornée, et tout ce
 * que le navigateur envoie se relit (`lireLaSaisie`, `signerLAttestation`).
 *
 * L'avis au patron part après le rangement, et son échec ne défait rien :
 * l'attestation est déjà dans Mes dossiers et sur son accueil.
 */
export async function signerAttestationAction(
  jeton: string,
  saisie: { conclusion: unknown; observations: unknown; signataire: Record<string, unknown> },
  signature: string
): Promise<{ ok: true; conclusion: Conclusion; signeLe: string } | { ok: false; raison: string }> {
  const lue = lireLaSaisie({ conclusion: saisie?.conclusion, observations: saisie?.observations, signataire: saisie?.signataire ?? {} });
  if (!lue.ok) return lue;
  const prefixe = "data:image/png;base64,";
  if (typeof signature !== "string" || !signature.startsWith(prefixe) || signature.length > SIGNATURE_MAX_CARACTERES) {
    return { ok: false, raison: "La signature n'est pas lisible. Signez à nouveau." };
  }

  const source = await sourceDuVisiteur(horsProductionReelle());
  const seuils: Array<readonly [string, { max: number; fenetreMs: number }]> = [[`attestation-comptable:${jeton}`, LIMITES.attestationComptable]];
  if (source !== SOURCE_NON_ETABLIE) seuils.push([`attestation-comptable:source:${source}`, LIMITES.attestationComptableParSource]);
  for (const [cle, limite] of seuils) {
    if (!(await verifierLimite(cle, limite)).autorise) return { ok: false, raison: "Trop de signatures d'un coup. Réessayez dans quelques minutes." };
  }

  try {
    const r = await signerLAttestation(jeton, lue.valeur, new Uint8Array(Buffer.from(signature.slice(prefixe.length), "base64")), new Date());
    if (!r.ok) return r;
    if (r.courriel) {
      const envoi = await envoyerCourriel(r.courriel);
      if (!envoi.ok) logger.warn("L'avis de l'attestation n'est pas parti chez le patron", { raison: envoi.raison });
    }
    return { ok: true, conclusion: r.attestation.conclusion, signeLe: r.attestation.signeLe.toISOString() };
  } catch (err) {
    logger.error("L'attestation du comptable n'a pas pu se signer", { erreur: err instanceof Error ? err.message : String(err) });
    return { ok: false, raison: "L'attestation n'a pas pu s'enregistrer. Réessayez." };
  }
}
