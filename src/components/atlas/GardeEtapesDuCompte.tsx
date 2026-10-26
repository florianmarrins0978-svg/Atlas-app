import { headers } from "next/headers";
import { garderLAdresseVerifiee, garderLesDocumentsLegaux } from "@/server/garde-etapes-du-compte";

/**
 * Les deux étapes du compte, au CHARGEMENT COMPLET d'un écran.
 *
 * **Pourquoi elles restent aussi dans le gabarit**, alors que chaque écran les
 * joue (`garderLaPage`) : posé dans le gabarit, le renvoi précède le premier
 * octet et part en vrai 307. Joué depuis une page, il passe sous la frontière
 * de `loading.tsx` et devient un renvoi en JavaScript, que le compte supprimé
 * d'un navigateur sans JavaScript ne suivrait pas (`test-session-perimee-e2e`,
 * la panne du 10 août 2026). Le gabarit tient le chargement complet, l'écran
 * tient la navigation interne : ce sont les MÊMES fonctions, appelées aux deux
 * portes.
 */
export default async function GardeEtapesDuCompte() {
  const chemin = (await headers()).get("x-atlas-pathname");
  // En-tête absent : rendu hors requête HTTP normale. Rien à protéger.
  if (!chemin) return null;
  await garderLAdresseVerifiee(chemin);
  await garderLesDocumentsLegaux(chemin);
  return null;
}
