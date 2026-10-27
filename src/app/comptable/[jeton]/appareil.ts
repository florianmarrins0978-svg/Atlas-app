import { FONCTIONS, type Fonction } from "@/lib/attestation-comptable";

/**
 * CE QUE L'APPAREIL DU COMPTABLE GARDE : qui il est, pour ne rien lui
 * redemander. La signature (`Attestation.tsx`) et le renvoi à corriger
 * (`Renvoi.tsx`) lisent la même fiche : son adresse tapée pour un renvoi
 * l'attend à la signature, et l'inverse.
 *
 * Un stockage refusé (navigation privée) n'empêche rien : il retape, c'est tout.
 */

export type Saisie = { nom: string; fonction: Fonction; societe: string; ordre: string; siren: string; adresse: string; email: string; telephone: string };

export const VIDE: Saisie = { nom: "", fonction: "expert_comptable", societe: "", ordre: "", siren: "", adresse: "", email: "", telephone: "" };

const CLE_DU_SIGNATAIRE = "atlas-comptable-signataire";

/** Ce que l'appareil a gardé, ou rien. */
export function signataireGarde(): Saisie | null {
  try {
    const brut = window.localStorage.getItem(CLE_DU_SIGNATAIRE);
    if (!brut) return null;
    const s = { ...VIDE, ...(JSON.parse(brut) as Partial<Saisie>) };
    return FONCTIONS.includes(s.fonction) ? s : null;
  } catch {
    return null;
  }
}

export function garderLeSignataire(s: Saisie) {
  try {
    window.localStorage.setItem(CLE_DU_SIGNATAIRE, JSON.stringify(s));
  } catch {
    // Le stockage refusé : il retapera ses coordonnées la prochaine fois, rien de plus.
    return;
  }
}

/** Son adresse seule, tapée au renvoi : elle rejoint la fiche, sans rien écraser d'autre. */
export function garderLEmail(email: string) {
  if (!email) return;
  garderLeSignataire({ ...(signataireGarde() ?? VIDE), email });
}
