import { getFournisseurLLM } from "../providers/llm/fabrique";
import { lireReponseDocumentVehicule } from "@/lib/document-vehicule-lu";
import type { LectureDocumentVehicule } from "@/lib/vehicules";

/**
 * Lire un papier de véhicule déposé par photo ou en PDF — sa demande du
 * 14 octobre 2026. Même patron que `lire-attestation.ts`.
 *
 * Rend `null` quand elle ne peut rien dire (pas de fournisseur, réponse
 * illisible) : l'écran demande alors au patron ce qu'est le papier, plutôt
 * que de le ranger au hasard.
 *
 * **L'appel au fournisseur n'est pas éprouvé dans cet environnement** : il n'y
 * a aucune clé ici. La relecture du texte rendu l'est (`test-vehicules.ts`).
 */

const SYSTEME = `Tu lis un document déposé par un artisan paysagiste pour un véhicule de son entreprise.
Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code.
Champs attendus :
- nature : "carte_grise" (certificat d'immatriculation), "assurance" (mémo véhicule assuré, attestation ou contrat d'assurance auto), "controle_technique" (procès-verbal de contrôle technique ou de contre-visite), ou null si ce n'est aucun des trois.
- plaque (string|null) : le numéro d'immatriculation, case A sur une carte grise. Une plaque s'écrit "AB-123-CD", ou "123 ABC 75" avant 2009. Au verso d'une carte grise, le grand numéro comme "2025EJ72653" est le numéro de formule, PAS la plaque : la plaque s'y lit seulement sur les vignettes de contrôle technique ; sinon null.
- marque_modele (string|null) : la marque (case D.1) suivie de la dénomination commerciale (case D.3), par exemple "Renault Master".
- ptac_kg (number|null) : le poids total autorisé en charge en kilos, case F.2.
- genre (string|null) : le genre national, case J.1, tel qu'il est écrit (par exemple "CTTE").
- assureur (string|null) : le nom de la compagnie d'assurance.
- numero_contrat (string|null) : le numéro de contrat ou de police.
- telephone_assistance (string|null) : le numéro d'assistance ou de dépannage écrit sur le document.
- controle_technique_avant (string|null au format AAAA-MM-JJ) : la date limite du prochain contrôle technique. Sur un procès-verbal : celle qu'il imprime. Sur une carte grise : la date de la vignette de contrôle la plus récente qui n'est pas barrée, celle marquée "A :" (case X.1 au verso) ; à défaut de vignette, la date "VISITE AVANT LE" de la case X.1 au recto.
- controle_pollution_avant (string|null au format AAAA-MM-JJ) : la date limite du prochain contrôle complémentaire pollution, si elle est imprimée. Sur une carte grise : la date "POLLU :" de la vignette la plus récente qui n'est pas barrée.
- contre_visite_avant (string|null au format AAAA-MM-JJ) : la date limite de contre-visite, seulement si un procès-verbal en exige une. Toujours null sur une carte grise.
Règles :
- Tu ne DEVINES jamais. Un champ illisible ou absent vaut null.
- Tu ne CALCULES jamais une date : tu recopies seulement celle qui est imprimée.
- Les champs qui n'appartiennent pas à la nature du document valent null.`;

const CONSIGNE = "Lis ce document et rends l'objet JSON demandé.";

export async function lireDocumentVehicule(base64: string, mimeType: string): Promise<LectureDocumentVehicule | null> {
  const fournisseur = getFournisseurLLM();
  if (!fournisseur.lireImages) return null;
  const r = await fournisseur.lireImages(SYSTEME, CONSIGNE, [{ base64, mimeType }], { maxTokens: 512 });
  if (!r.succes) return null;
  return lireReponseDocumentVehicule(r.texte);
}
