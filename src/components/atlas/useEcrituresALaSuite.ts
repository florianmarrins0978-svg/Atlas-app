"use client";

import { useState } from "react";
import { fileDEcritures } from "@/lib/file-d-ecritures";

/**
 * La file d'écritures d'un composant — une seule pour toute sa vie.
 *
 * Le pourquoi est dans `src/lib/file-d-ecritures.ts` : deux écritures de la
 * même donnée parties ensemble arrivent dans un ordre que le réseau choisit, et
 * c'est ainsi qu'une remise reposée disparaissait.
 *
 * **La règle est pure et vit dans `lib`** ; ce hook ne fait que la retenir d'un
 * rendu à l'autre.
 *
 * **`useState` avec sa fonction d'initialisation, et ni `useRef` ni `useMemo`.**
 * Les trois « marchent » à l'essai, et deux sont des pièges :
 *
 * | | |
 * |---|---|
 * | `useRef` posé pendant le rendu | React l'interdit — *« Cannot access refs during render »*, et le lint du dépôt le refuse. Un rendu peut être joué deux fois puis jeté : la file changerait sous les écritures en vol |
 * | `useMemo` | React a le droit de le rejouer quand il veut. Une file recréée en cours de route laisserait repartir deux écritures ensemble, c'est-à-dire exactement le défaut visé |
 * | `useState(() => …)` | l'initialisation n'est jouée qu'une fois, et la valeur ne bouge plus |
 */
export function useEcrituresALaSuite(): <T>(ecrire: () => Promise<T>) => Promise<T> {
  const [aLaSuite] = useState(fileDEcritures);
  return aLaSuite;
}
