"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { noterLaVisite, oublierCetEcran } from "./journal-navigateur";

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

  // **LE BOUTON DU NAVIGATEUR EST LE SEUL RETOUR QU'ATLAS NE FAIT PAS.**
  //
  // Nos flèches déclarent qu'elles reculent (`FlecheRetour`), et
  // l'enregistrement d'une fiche client aussi. Le geste du navigateur — la
  // flèche du haut, le balayage vers la droite sur un téléphone — ne passe par
  // aucun des deux : sans cette ligne, le journal garderait les écrans
  // POSTÉRIEURS à celui où l'on vient d'atterrir, et la flèche d'Atlas
  // repartirait EN AVANT.
  //
  // `popstate` sert aussi le geste « suivant » du navigateur, et c'est sans
  // danger : l'écran d'arrivée n'est alors plus dans le journal, et rien n'est
  // retiré. Il est posé une seule fois, sans dépendance : `window.location` est
  // déjà à jour quand l'événement arrive, et la visite elle-même est notée par
  // l'effet du dessus, juste après.
  useEffect(() => {
    const surLeRetourDuNavigateur = () =>
      oublierCetEcran(window.location.pathname + window.location.search);
    window.addEventListener("popstate", surLeRetourDuNavigateur);
    return () => window.removeEventListener("popstate", surLeRetourDuNavigateur);
  }, []);

  return null;
}

export default function JournalDeNavigation() {
  return (
    <Suspense fallback={null}>
      <Enregistreur />
    </Suspense>
  );
}
