"use client";

import { useSyncExternalStore } from "react";
import { adressePourLeClient } from "./adresse-du-client";

/**
 * L'adresse à mettre dans un lien, corrigée dès que le navigateur a la main.
 *
 * **Le problème que ce crochet résout, et pourquoi il n'est pas un `useEffect`.**
 * Il faut deux choses à la fois, et elles se contredisent :
 *
 *   1. **le premier rendu doit être IDENTIQUE à celui du serveur**, sinon React
 *      régénère tout l'arbre en annonçant « Hydration failed » — l'erreur que le
 *      patron a signalée le 13 août (`ARCHITECTURE.md` §68, §81) ;
 *   2. **ensuite, c'est l'adresse du navigateur qui fait foi** : derrière le
 *      tunnel de son espace de travail, le serveur ne voit que `localhost`
 *      (`ARCHITECTURE.md` §175).
 *
 * La façon évidente — un `useState` corrigé par un `useEffect` — est refusée par
 * le lint de Next, et il a raison : poser un état dans un effet relance un rendu
 * en cascade. `useSyncExternalStore` dit la même chose sans effet : un
 * instantané pour le serveur, un autre pour le navigateur, et React choisit.
 *
 * L'abonnement ne fait rien : l'adresse d'une page ne change pas sous les pieds
 * de celui qui la lit — elle est fixée au chargement.
 */
export function useAdressePourLeClient(depuisLeServeur: string): string {
  const surLeClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  return surLeClient ? adressePourLeClient(depuisLeServeur) : depuisLeServeur;
}

/** Le même geste sur un lien tout fait : seule son origine est remplacée. */
export function useLienPourLeClient(lien: string): string {
  const surLeClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  if (!surLeClient) return lien;
  try {
    const u = new URL(lien);
    return adressePourLeClient(u.origin) + u.pathname + u.search + u.hash;
  } catch {
    return lien;
  }
}
