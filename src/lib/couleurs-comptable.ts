import { colors } from "./design-tokens";
import type { Categorie } from "./pour-mon-comptable";

/**
 * Les couleurs et les mots des catégories du dossier — ses choix du 23 et du
 * 24 octobre 2026 (`appli/pour-mon-comptable.html`, « on les garde »).
 *
 * Les couleurs sont des JETONS de charte (`chartes.ts`, `couleursDuComptable`) :
 * sur Nuit et Sylve elles remontent pour se lire. Aucune n'est écrite en clair
 * dans un écran (`CLAUDE.md` §3).
 */
export const COULEUR_CATEGORIE: Record<Categorie, string> = {
  carburant: colors.catCarburant,
  repas: colors.catRepas,
  materiel: colors.catMateriel,
  hotel: colors.catHotel,
  transport: colors.catTransport,
  autre: colors.catAutre,
  virement: colors.catVirement,
  recu: colors.catRecu,
};

export const NOM_CATEGORIE: Record<Categorie, string> = {
  carburant: "Carburant",
  repas: "Repas",
  materiel: "Matériel",
  hotel: "Hôtel",
  transport: "Train, taxi",
  autre: "Autre",
  virement: "Virement envoyé",
  recu: "Virement reçu",
};

/** L'ordre de la légende et de la barre de couleurs, celui de la planche. */
export const ORDRE_CATEGORIES: Categorie[] = ["carburant", "repas", "materiel", "hotel", "transport", "virement", "autre"];
