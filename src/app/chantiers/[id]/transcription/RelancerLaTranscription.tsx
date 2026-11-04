"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, libelleCaps } from "@/lib/design-tokens";
import { lancerTranscriptionAction } from "./actions";

/**
 * Relancer la transcription SUR PLACE — 3 novembre 2026.
 *
 * **Ce lien menait à l'écran Note vocale**, retiré ce jour-là (son accord sur
 * la planche « Le chantier »). Y renvoyer vers la fiche client n'aurait pas
 * suffi : revenue plus tard, elle ne montre ni l'échec ni « Réessayer », qui ne
 * vivent que le temps de la dictée qu'il vient d'envoyer. Le geste se fait donc
 * ici, à la place du lien, dans la même voix.
 *
 * **Le rafraîchissement fait le reste** : l'écran sait déjà dire ses mots, un
 * nouvel échec, ou « Transcription en cours » s'il est rouvert entre-temps.
 */
export default function RelancerLaTranscription({
  chantierId,
  libelle,
}: {
  chantierId: string;
  libelle: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [refus, setRefus] = useState<string | null>(null);

  function relancer() {
    setRefus(null);
    demarrer(async () => {
      try {
        await lancerTranscriptionAction(chantierId);
      } catch (panne) {
        // **Le message d'une action serveur n'arrive jamais jusqu'à lui**
        // (`AGENTS.md`) : la cause s'écrit ici, l'écran dit ce qu'il peut
        // faire. Une page restée ouverte pendant une mise à jour du banc est
        // le cas le plus probable, et seul un rechargement le répare.
        console.error("[transcription] la relance n'a pas pu partir", panne);
        setRefus("La transcription n'a pas pu être relancée. Rechargez la page.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={relancer}
        disabled={enCours}
        data-atlas="relancer-la-transcription"
        className={`mt-5 block disabled:opacity-40 ${libelleCaps}`}
        style={{ color: colors.rust }}
      >
        {enCours ? "Transcription en cours" : libelle}
      </button>
      {refus && (
        <p role="alert" className="mt-2 text-[13px]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}
    </>
  );
}
