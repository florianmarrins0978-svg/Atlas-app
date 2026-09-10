"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { atterrirIci, marquerLaProvenance, noterLaVisite } from "./journal-navigateur";

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
    const ici = question ? `${chemin}?${question}` : chemin;
    // **La provenance se marque AVANT la visite.** Elle dit d'où cette entrée
    // d'historique a été ouverte — c'est ce qui autorise la flèche à RECULER
    // plutôt qu'à poser une page neuve, et donc à rendre au patron sa place
    // dans la liste (`journal-navigateur.ts`). Deux questions distinctes, deux
    // mécanismes : le journal dit OÙ l'on va, la marque dit si l'on peut y
    // reculer.
    marquerLaProvenance(ici);
    noterLaVisite(ici);
  }, [chemin, parametres]);

  // ─── ON VIENT D'ATTERRIR EN RECULANT ──────────────────────────────────────
  //
  // Le journal garderait sinon les écrans POSTÉRIEURS à celui où l'on se
  // trouve, et la flèche d'Atlas repartirait EN AVANT.
  //
  // **`atterrirIci` et non `oublierCetEcran`, et c'est toute sa panne du
  // 10 septembre 2026 :** *« quand je fais deux fois le geste client → retour
  // puis client → retour, je reviens à la page d'accueil »*. Le second retirait
  // du journal l'écran d'ARRIVÉE — la destination que la flèche venait de
  // choisir —, et l'on perdait un pas à chaque retour.
  //
  // **`popstate` n'est plus seulement le geste du navigateur** : la flèche
  // d'Atlas recule elle aussi par `router.back()` depuis le 9 septembre, pour
  // rendre au patron sa place dans la liste. Les deux passent donc ici, et les
  // deux veulent la même chose — garder le sol sous les pieds.
  //
  // Le geste « suivant » du navigateur y passe aussi, sans danger : l'écran
  // d'arrivée n'est pas dans le journal, et rien n'est alors tronqué. Posé une
  // seule fois, sans dépendance : `window.location` est déjà à jour quand
  // l'événement arrive, et la visite est notée par l'effet du dessus.
  useEffect(() => {
    const surUnRetour = () => atterrirIci(window.location.pathname + window.location.search);
    window.addEventListener("popstate", surUnRetour);
    return () => window.removeEventListener("popstate", surUnRetour);
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
