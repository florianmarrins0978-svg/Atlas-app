"use client";

import { useActionState, useState } from "react";
import Calendrier from "@/components/atlas/Calendrier";
import { couleursDocument } from "@/lib/design-tokens";
import { jourLisible } from "@/lib/jour";
import type { JourIso } from "@/lib/disponibilites";
import { lendemain } from "@/lib/dates-du-mois";
import { validerDatesAction, type EtatDates } from "./actions";

type Passage = { id: string; libelle: string; jour: string | null; joursPossibles: string[] };

/**
 * Les passages du mois et le geste unique du client : « Ces dates me vont ».
 *
 * **Une autre date, si l'artisan l'a permis** (sa demande du 27 septembre
 * 2026) : le calendrier du devis, sur le mois ENTIER, où seuls les jours libres
 * répondent. Un jour déjà choisi pour un autre passage se barre aussi : deux
 * passages le même jour se refuseraient au serveur.
 */
export default function ValiderLesDates({
  jeton,
  passages,
  fenetre,
  autreDateAutorisee,
  dejaRepondu,
  aujourdhui,
}: {
  jeton: string;
  passages: Passage[];
  fenetre: { debut: string; fin: string } | null;
  autreDateAutorisee: boolean;
  dejaRepondu: boolean;
  aujourdhui: string;
}) {
  const [etat, valider, enCours] = useActionState<EtatDates, FormData>(validerDatesAction, undefined);
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [enChoix, setEnChoix] = useState<string | null>(null);
  const fait = dejaRepondu || (etat !== undefined && "succes" in etat);
  const reference = new Date(`${aujourdhui}T12:00:00Z`);

  function occupesPour(p: Passage): JourIso[] {
    if (!fenetre) return [];
    const autres = new Set(Object.entries(choix).filter(([id]) => id !== p.id).map(([, j]) => j));
    const libres = new Set(p.joursPossibles.filter((j) => !autres.has(j)));
    const pris: JourIso[] = [];
    for (let j = fenetre.debut; j <= fenetre.fin; j = lendemain(j)) {
      if (!libres.has(j)) pris.push(j as JourIso);
    }
    return pris;
  }

  return (
    <form action={valider} className="mt-5">
      <input type="hidden" name="jeton" value={jeton} />
      <input type="hidden" name="changements" value={JSON.stringify(choix)} />
      {passages.map((p) => {
        const jour = choix[p.id] ?? p.jour;
        const change = choix[p.id] !== undefined && choix[p.id] !== p.jour;
        const peutChanger = autreDateAutorisee && !fait && fenetre !== null && p.joursPossibles.length > 0;
        return (
          <div key={p.id} className="border-b py-3.5 last:border-b-0" style={{ borderColor: "#ece9e1" }} data-atlas="passage-du-mois">
            <p className="m-0 text-[15px]">{p.libelle}</p>
            <p
              className="m-0 mt-0.5 text-[19px] leading-snug"
              style={{ fontFamily: "ui-serif, Georgia, serif", color: change ? "#8b6835" : couleursDocument.encre }}
            >
              {jour ? jourLisible(jour, reference) : "date à venir"}
            </p>
            {peutChanger && (
              <button
                type="button"
                onClick={() => setEnChoix((e) => (e === p.id ? null : p.id))}
                className="mt-1.5 py-1 text-[14px] underline"
                style={{ color: couleursDocument.etiquette }}
                data-atlas="une-autre-date"
              >
                Une autre date ?
              </button>
            )}
            {peutChanger && enChoix === p.id && fenetre && (
              <div className="mt-2">
                <Calendrier
                  debut={fenetre.debut as JourIso}
                  fin={fenetre.fin as JourIso}
                  occupes={occupesPour(p)}
                  retenus={jour ? [jour as JourIso] : []}
                  aujourdHui={aujourdhui as JourIso}
                  dureeDemiJournees={null}
                  onBasculer={(j) => {
                    setChoix((c) => {
                      const suite = { ...c };
                      if (j === p.jour) delete suite[p.id];
                      else suite[p.id] = j;
                      return suite;
                    });
                    setEnChoix(null);
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {fait ? (
        <p className="mt-5 rounded-xl bg-[#F4EFE8] p-4 text-center text-[15px]" style={{ color: couleursDocument.encre }} data-atlas="dates-validees">
          {etat && "succes" in etat ? etat.succes : "Vos dates sont retenues."}
        </p>
      ) : (
        <button
          type="submit"
          disabled={enCours}
          className="mt-5 block min-h-[52px] w-full rounded-full text-[17px] text-white disabled:opacity-60"
          style={{ backgroundColor: "#7d9a6d", fontFamily: "ui-serif, Georgia, serif" }}
          data-atlas="valider-les-dates"
        >
          Ces dates me vont
        </button>
      )}
      {etat && "erreur" in etat && (
        <p className="mt-3 text-center text-[13px]" style={{ color: "#9C3B2E" }}>
          {etat.erreur}
        </p>
      )}
    </form>
  );
}
