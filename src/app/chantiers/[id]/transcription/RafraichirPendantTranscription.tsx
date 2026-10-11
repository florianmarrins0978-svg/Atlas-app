"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * L'écran se met à jour tout seul pendant que le prestataire travaille.
 *
 * **Pourquoi.** L'état « en cours » était un cul-de-sac : aucun geste proposé,
 * aucun rafraîchissement. Le patron devait savoir qu'il fallait revenir — ou
 * recharger une page qui ne disait pas qu'elle était figée. C'est exactement la
 * panne qu'il a signalée d'un autre bord le 12 août 2026, une page ouverte
 * depuis des heures : ici, elle se produisait en trois minutes.
 *
 * **Il ne tourne QUE pendant la transcription** : monté par la branche
 * « en cours » de l'écran, il disparaît avec elle. Rien ne bat en fond sur les
 * autres états — une page qui interroge le serveur toutes les quatre secondes
 * pour rien vide la batterie d'un téléphone sur un chantier.
 */
export default function RafraichirPendantTranscription({ secondes = 4 }: { secondes?: number }) {
  const router = useRouter();
  useEffect(() => {
    const minuteur = setInterval(() => router.refresh(), secondes * 1000);
    return () => clearInterval(minuteur);
  }, [router, secondes]);
  return null;
}
