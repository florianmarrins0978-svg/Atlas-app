"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { noterLaVisite } from "./journal-navigateur";

/**
 * Ce qui tient le journal des écrans traversés, pour que la flèche de retour
 * sache d'où l'on vient (`src/lib/journal-de-navigation.ts`).
 *
 * **Il ne dessine rien**, et il est posé une seule fois, à la racine : un
 * enregistrement par écran aurait été une liste à tenir à la main, donc une
 * liste qui aurait pris du retard au premier écran neuf — exactement le défaut
 * que ce lot corrige.
 *
 * **`useSearchParams` ET `usePathname`, les deux.** L'adresse complète compte :
 * `/planning?chantier=…` ouvre la journée d'un chantier, et y revenir sans le
 * paramètre déposerait sur le mois courant — c'est la panne du 7 septembre
 * 2026 (`retour-au-planning.ts`), qu'il ne faut pas refabriquer par l'autre
 * bout. D'où la barrière `Suspense` : `useSearchParams` la réclame dès qu'une
 * page se pré-rend, et cette pièce vit dans la mise en page de TOUS les écrans.
 */
function Enregistreur() {
  const chemin = usePathname();
  const parametres = useSearchParams();
  useEffect(() => {
    const question = parametres.toString();
    noterLaVisite(question ? `${chemin}?${question}` : chemin);
  }, [chemin, parametres]);
  return null;
}

export default function JournalDeNavigation() {
  return (
    <Suspense fallback={null}>
      <Enregistreur />
    </Suspense>
  );
}
