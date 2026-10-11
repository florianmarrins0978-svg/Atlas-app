import { getFournisseurLLM } from "../providers/llm/fabrique";
import { lireReponseAttestation, type AttestationLue } from "@/lib/attestation-lue";

/**
 * Lire l'attestation décennale déposée — sa demande du 7 octobre 2026, après
 * qu'une photo quelconque a été acceptée comme attestation.
 *
 * **Une lecture, jamais un verdict qui bloque** (*« jamais de blocage »*) : ce
 * qu'elle rend se rappelle à l'écran (`remarquesSurLAttestation`). Et quand
 * elle ne peut rien dire (pas de fournisseur, réponse illisible), elle rend
 * `null` : se taire vaut mieux qu'accuser un vrai papier.
 *
 * **L'appel au fournisseur n'est pas éprouvé dans cet environnement** : il n'y
 * a aucune clé ici. La lecture du texte rendu l'est (`test-attestation-lue.ts`).
 */

const SYSTEME = `Tu lis un document déposé par un artisan paysagiste comme attestation d'assurance décennale.
Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code.
Champs attendus : est_attestation_decennale (boolean), assureur (string|null), fin_validite (string|null au format AAAA-MM-JJ).
Règles :
- est_attestation_decennale vaut true seulement si le document est une attestation d'assurance de responsabilité civile décennale.
- Tu ne DEVINES jamais. Un champ illisible ou absent vaut null.
- assureur est le nom de la compagnie qui délivre l'attestation, tel qu'il est écrit.
- fin_validite est la date de fin de la période de validité écrite sur l'attestation.`;

const CONSIGNE = "Lis ce document et rends l'objet JSON demandé.";

export async function lireAttestation(base64: string, mimeType: string): Promise<AttestationLue | null> {
  const fournisseur = getFournisseurLLM();
  if (!fournisseur.lireImages) return null;
  const r = await fournisseur.lireImages(SYSTEME, CONSIGNE, [{ base64, mimeType }], { maxTokens: 256 });
  if (!r.succes) return null;
  return lireReponseAttestation(r.texte);
}
