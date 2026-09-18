"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Combien de temps l'accueil peut rester en retard sur ce que sait le serveur.
 *
 * **Trente secondes, et c'est un arbitrage.** Plus court, on interroge la base
 * pour rien pendant qu'il travaille ; plus long, la réponse de son client dort
 * sous ses yeux et il croit que rien n'est arrivé. Trente secondes se lisent
 * comme « tout de suite » sur un écran qu'on regarde, et font deux lectures par
 * minute — le prix d'une page d'accueil ouverte.
 *
 * **Exportée pour que la suite ne la recopie pas** : un délai écrit deux fois
 * se contredit au premier changement (`CLAUDE.md` §3).
 */
export const RYTHME_MS = 30_000;

/** Deux événements pour un seul retour : on ne relit pas deux fois de suite. */
const REPOS_MS = 2_000;

/**
 * L'ACCUEIL SE MET À JOUR TOUT SEUL — sa remarque du 17 septembre 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * *« Mon client vient d'accepter mon devis, sauf que j'ai l'impression qu'il
 * n'apparaîtra dans mes notifications que si je réactualise la page. »*
 *
 * Il avait raison. L'accueil est une page rendue au serveur : elle lit les
 * réponses, les rappels et les réceptions **une fois**, au moment où elle est
 * demandée. La réponse du client, elle, arrive plus tard et ailleurs — sur le
 * téléphone du client, par la page publique du devis. Rien, dans son navigateur
 * à lui, ne pouvait l'apprendre : il n'y avait aucun mécanisme, pas un
 * mécanisme en panne.
 *
 * **Ce composant EST ce mécanisme**, et il n'en cache aucun autre :
 *
 *   · quand il revient à Atlas — de sa messagerie, d'un appel, de l'écran
 *     verrouillé —, l'accueil se relit **immédiatement**. C'est le moment exact
 *     où une réponse a pu arriver, et c'est le geste qu'il fait le plus ;
 *   · pendant qu'il le regarde, l'accueil se relit toutes les trente secondes.
 *
 * **Jamais quand la page est cachée.** Un onglet oublié au fond d'un téléphone
 * interrogerait la base deux fois par minute pour personne — et les navigateurs
 * endorment de toute façon les minuteurs des pages cachées, si bien qu'un
 * battement qui ne regarde pas la visibilité rend un rythme qu'on croit tenir
 * et qu'on ne tient pas.
 *
 * **Ce que cela ne remplace pas** : une vraie notification poussée, qui
 * sonnerait alors même qu'Atlas est fermé. Elle n'existe pas encore
 * (`TODO.md`), et ce n'est pas une raison pour laisser une réponse de client
 * dormir sous ses yeux.
 */
export default function VeilleDesNouvelles() {
  const router = useRouter();

  useEffect(() => {
    let derniere = 0;
    const relire = () => {
      // Deux événements arrivent ensemble au retour sur un onglet — `focus` et
      // `visibilitychange`. Le repos évite la seconde lecture, qui ne dirait
      // rien de plus que la première.
      const maintenant = Date.now();
      if (maintenant - derniere < REPOS_MS) return;
      derniere = maintenant;
      router.refresh();
    };

    const auRetour = () => {
      if (document.visibilityState === "visible") relire();
    };
    const battement = setInterval(auRetour, RYTHME_MS);
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("focus", auRetour);

    return () => {
      clearInterval(battement);
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("focus", auRetour);
    };
  }, [router]);

  return null;
}
