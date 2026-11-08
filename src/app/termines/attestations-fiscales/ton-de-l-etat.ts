import { colors } from "@/lib/design-tokens";
import type { EtatAttestation } from "@/lib/attestation-fiscale";

/**
 * Le ton de chaque état d'une attestation, celui des pastilles de sa planche :
 * ambre ce qui attend, rouge ce qui manque, vert ce qui est parti. Les jetons
 * des cartes, jamais une couleur en clair : sept chartes, dont deux sombres.
 */
export const TON_DE_L_ETAT: Record<EtatAttestation, { fond: string; texte: string }> = {
  a_envoyer: { fond: colors.carteAmbreFond, texte: colors.carteAmbreTexte },
  a_renvoyer: { fond: colors.carteAmbreFond, texte: colors.carteAmbreTexte },
  a_completer: { fond: colors.carteRougeFond, texte: colors.carteRougeTexte },
  envoyee: { fond: colors.carteVertFond, texte: colors.carteVertTexte },
};
