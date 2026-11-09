"use client";

import { useState, useTransition } from "react";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors } from "@/lib/design-tokens";
import { ouvrirFicheAction } from "./actions";

/**
 * Le geste qui ouvre une fiche, datée du jour même.
 *
 * **Le jour reste modifiable, mais DANS la fiche** — sa demande du
 * 24 septembre 2026 : *« dans la création, pas en dehors »*. Posé ici, il se
 * lisait comme un second filtre au-dessus de celui des rapports envoyés. Il
 * remplit parfois le lendemain : la roue est en tête de la fiche
 * (`FicheChantierClient`), et le rapport part avec le jour qu'elle porte.
 */
export default function OuvrirFiche() {
  const [phrase, setPhrase] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <div>
      {/* **Sur toute la largeur, sa planche du 9 novembre 2026** (D) : sous la
          carte de Composer ma fiche, le geste de tous les jours prend la même
          largeur qu'elle. La capsule ne change pas de dessin (`PrimaryButton`). */}
      <PrimaryButton
        repere="ouvrir-fiche-chantier"
        pleineLargeur
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            // `ouvrirFicheAction` redirige quand elle réussit : ce qui
            // revient ici est toujours un refus, jamais un succès muet.
            // Le jour du TÉLÉPHONE, pas celui du serveur : à 23 h, un serveur
            // à l'heure universelle serait déjà au lendemain.
            const r = await ouvrirFicheAction(new Date().toLocaleDateString("en-CA"));
            if (r && !r.ok) setPhrase(r.phrase);
          })
        }
      >
        {enCours ? "Création…" : "Créer une fiche"}
      </PrimaryButton>

      {phrase && (
        <p className="mt-[12px] text-center text-[12.5px]" style={{ color: colors.alert }}>
          {phrase}
        </p>
      )}
    </div>
  );
}
