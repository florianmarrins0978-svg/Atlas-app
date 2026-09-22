"use client";

import { useState, useTransition } from "react";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { TitreAvecRoue } from "@/components/atlas/FiltreDeDate";
import { colors } from "@/lib/design-tokens";
import { jourEnTitre } from "@/lib/jour";
import { ouvrirFicheAction } from "./actions";

/**
 * Le geste qui ouvre une fiche — **et le jour qu'elle porte**.
 *
 * **Le jour est modifiable, et ce n'est pas un détail de confort** : il remplit
 * parfois le soir, dans son camion, ou le lendemain matin. Une fiche datée
 * d'office du jour de la saisie enverrait au client un rapport daté du mauvais
 * jour — et c'est la date que le client regarde en premier.
 */
export default function OuvrirFiche() {
  const [jour, setJour] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [phrase, setPhrase] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <div>
      <p className="text-[12.5px]" style={{ color: colors.muted }}>
        Jour du passage
      </p>
      {/* **Le jour écrit en titre**, comme « Septembre 2026 », avec le nom du
          jour — sa demande du 22 septembre 2026. La roue du téléphone s'ouvre
          toujours au toucher : seule l'écriture a changé. */}
      <div className="flex">
        <TitreAvecRoue titre={jourEnTitre(jour)} jour={jour} choisir={setJour} dataAtlas="jour-du-passage" />
      </div>

      <div className="mt-[16px]">
        <PrimaryButton
          repere="ouvrir-fiche-chantier"
          disabled={enCours || jour === ""}
          onClick={() =>
            demarrer(async () => {
              // `ouvrirFicheAction` redirige quand elle réussit : ce qui
              // revient ici est toujours un refus, jamais un succès muet.
              const r = await ouvrirFicheAction(jour);
              if (r && !r.ok) setPhrase(r.phrase);
            })
          }
        >
          {enCours ? "Ouverture…" : "Ouvrir une fiche"}
        </PrimaryButton>
      </div>

      {phrase && (
        <p className="mt-[12px] text-center text-[12.5px]" style={{ color: colors.alert }}>
          {phrase}
        </p>
      )}
    </div>
  );
}
