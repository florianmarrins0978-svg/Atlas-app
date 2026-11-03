"use client";

import { useActionState, useState } from "react";
import Calendrier from "@/components/atlas/Calendrier";
import BottomSheet from "@/components/atlas/BottomSheet";
import IconeTrait from "@/components/atlas/IconeTrait";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { jourLisible, moisAbrege } from "@/lib/jour";
import type { JourIso } from "@/lib/disponibilites";
import { lendemain } from "@/lib/dates-du-mois";
import { validerDatesAction, type EtatDates } from "./actions";

type Passage = { id: string; libelle: string; jour: string | null; joursPossibles: string[] };

/**
 * Les passages du mois et le geste unique du client : « Ces dates me vont ».
 *
 * **Une autre date, si l'artisan l'a permis** (sa demande du 27 septembre
 * 2026) : le calendrier du devis, sur le mois ENTIER, où seuls les jours libres
 * répondent, dans une feuille qui monte. Un jour déjà choisi pour un autre passage se barre aussi : deux
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

  const passageEnChoix = passages.find((p) => p.id === enChoix) ?? null;

  return (
    <form action={valider} className="mt-4">
      <input type="hidden" name="jeton" value={jeton} />
      <input type="hidden" name="changements" value={JSON.stringify(choix)} />
      {/* **Une rangée par passage, le jour en grand à gauche** — sa planche du
          31 octobre 2026 : le client lit d'abord QUAND, puis quoi. Une date
          qu'il a changée prend l'or, et le dit en toutes lettres. */}
      <section className="rounded-md px-[18px] py-1" style={{ backgroundColor: colors.card }}>
        {passages.map((p, rang) => {
          const jour = choix[p.id] ?? p.jour;
          const change = choix[p.id] !== undefined && choix[p.id] !== p.jour;
          const peutChanger = autreDateAutorisee && !fait && fenetre !== null && p.joursPossibles.length > 0;
          return (
            <div
              key={p.id}
              className={`flex items-start gap-3.5 py-3.5 ${rang > 0 ? "border-t" : ""}`}
              style={{ borderColor: colors.line }}
              data-atlas="passage-du-mois"
            >
              <span className="mt-0.5 w-12 flex-none text-center leading-none" aria-hidden="true">
                <b
                  className="block text-[26px] font-normal transition-colors duration-200"
                  style={{ fontFamily: font.display, fontVariantNumeric: "lining-nums", color: change ? colors.or : colors.ink }}
                >
                  {jour ? Number(jour.slice(8, 10)) : "?"}
                </b>
                {jour && (
                  <span className="mt-1 block text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: colors.inkSoft }}>
                    {moisAbrege(jour)}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display }}>
                  {p.libelle}
                </span>
                <span className="mt-[3px] flex flex-wrap items-center gap-2 text-[15px]" style={{ color: change ? colors.ink : colors.inkSoft }}>
                  <span className={change ? "font-semibold" : ""}>{jour ? jourLisible(jour, reference) : "date à venir"}</span>
                  {change && <EtatEcrit ton="or">Votre date</EtatEcrit>}
                </span>
                {peutChanger && (
                  <button
                    type="button"
                    onClick={() => setEnChoix(p.id)}
                    className="mt-0.5 min-h-10 text-[15px] font-semibold"
                    style={{ color: colors.rust }}
                    data-atlas="une-autre-date"
                  >
                    Une autre date&nbsp;?
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </section>

      {/* **Le calendrier monte dans une feuille**, comme sur le devis (sa
          décision du 4 septembre 2026) : déplié sous la rangée, il poussait le
          bouton hors de l'écran. Le nom du passage se relit en tête : la
          feuille recouvre la rangée qu'on change. */}
      <BottomSheet open={passageEnChoix !== null && fenetre !== null} onBackdropClick={() => setEnChoix(null)}>
        {passageEnChoix && fenetre && (
          <>
            <p className="mb-1 text-center text-[15px] font-semibold" style={{ color: colors.inkSoft }}>
              {passageEnChoix.libelle}
            </p>
            <Calendrier
              debut={fenetre.debut as JourIso}
              fin={fenetre.fin as JourIso}
              occupes={occupesPour(passageEnChoix)}
              retenus={(choix[passageEnChoix.id] ?? passageEnChoix.jour) ? [(choix[passageEnChoix.id] ?? passageEnChoix.jour) as JourIso] : []}
              aujourdHui={aujourdhui as JourIso}
              dureeDemiJournees={null}
              onBasculer={(j) => {
                const p = passageEnChoix;
                setChoix((c) => {
                  const suite = { ...c };
                  if (j === p.jour) delete suite[p.id];
                  else suite[p.id] = j;
                  return suite;
                });
                setEnChoix(null);
              }}
            />
          </>
        )}
      </BottomSheet>

      {fait ? (
        <p
          className="mt-6 flex items-center gap-2.5 rounded-md px-4 py-[13px] text-[14.5px] font-semibold leading-[1.45]"
          style={{ backgroundColor: colors.carteVertFond, color: colors.carteVertTexte }}
          data-atlas="dates-validees"
        >
          <IconeTrait nom="coche" taille={20} epaisseur={2} />
          {etat && "succes" in etat ? etat.succes : "Vos dates sont retenues."}
        </p>
      ) : (
        <button
          type="submit"
          disabled={enCours}
          className="atlas-plein mt-6 block min-h-14 w-full rounded-full text-[19px] disabled:opacity-60"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
          data-atlas="valider-les-dates"
        >
          Ces dates me vont
        </button>
      )}
      {etat && "erreur" in etat && (
        <p role="alert" className="mt-3 text-center text-[14px] font-semibold" style={{ color: colors.alert }}>
          {etat.erreur}
        </p>
      )}
    </form>
  );
}
