"use client";

import { useRef } from "react";
import { fileDEcritures } from "@/lib/file-d-ecritures";

/**
 * La file d'écritures d'un composant — une seule pour toute sa vie.
 *
 * Le pourquoi est dans `src/lib/file-d-ecritures.ts` : deux écritures de la
 * même donnée parties ensemble arrivent dans un ordre que le réseau choisit, et
 * c'est ainsi qu'une remise reposée disparaissait.
 *
 * **La règle est pure et vit dans `lib`** ; ce hook ne fait que la retenir d'un
 * rendu à l'autre. Un `useRef` plutôt qu'un `useMemo` : celui-ci peut être
 * rejoué par React, et une file recréée en cours de route laisserait repartir
 * deux écritures ensemble — exactement le défaut visé.
 */
export function useEcrituresALaSuite(): <T>(ecrire: () => Promise<T>) => Promise<T> {
  const file = useRef<ReturnType<typeof fileDEcritures> | null>(null);
  file.current ??= fileDEcritures();
  return file.current;
}
