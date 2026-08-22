"use client";

import { useState, useTransition } from "react";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors } from "@/lib/design-tokens";
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
      <label className="block text-[12.5px]" style={{ color: colors.muted }}>
        Jour du passage
        <input
          type="date"
          value={jour}
          onChange={(e) => setJour(e.target.value)}
          className="mt-[6px] block w-full rounded-[14px] px-[15px] py-3 text-[16px] outline-none"
          style={{ backgroundColor: colors.card, color: colors.ink, border: `1px solid ${colors.line}` }}
        />
      </label>

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
