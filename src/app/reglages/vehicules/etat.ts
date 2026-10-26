import { colors } from "@/lib/design-tokens";
import type { Echeance } from "@/lib/vehicules";
import { teintesDuTon, type Ton } from "@/components/atlas/reglages/PlageTon";

/**
 * LA COULEUR D'UN CAMION — la liste et la fiche la lisent toutes les deux.
 *
 * **Elle ne calcule rien** : l'échéance vient de `rappelsDesVehicules`
 * (`src/lib/vehicules.ts`), qui garde seule les seuils de deux mois et de
 * quinze jours. Ici, seulement le ton qui la dit à l'écran, écrit une fois
 * pour que la ligne et la fiche ne prennent jamais deux couleurs différentes
 * pour le même camion (`CLAUDE.md` §3).
 *
 * Sa planche du 26 octobre 2026 (`appli/soignee/reglages-vehicules.html`) :
 * vert à jour, or quinze jours avant (son doré du 14 octobre), rouge dépassé.
 * Entre deux mois et quinze jours (« À passer dès maintenant »), le bleu de
 * l'information : rien ne presse encore, mais c'est bon à savoir.
 *
 * **« À jour » demande une plaque**, comme la liste le disait déjà : un camion
 * dont aucune carte grise n'a été lue n'est à jour de rien, on ne sait rien de
 * lui. Il reste alors sans couleur d'état, et c'est l'ambre de ce qui manque
 * qui parle.
 */
export function tonDuVehicule(echeance: Echeance["ton"] | null, plaque: string | null): Ton | null {
  if (echeance === "depasse") return "rouge";
  if (echeance === "proche") return "or";
  if (echeance === "calme") return "bleu";
  return plaque ? "vert" : null;
}

/** L'encre d'un état : l'or s'écrit en or, les autres tons dans leur texte de carte. */
export function encreDuTon(ton: Ton): string {
  return ton === "or" ? colors.or : teintesDuTon(ton).texte;
}
