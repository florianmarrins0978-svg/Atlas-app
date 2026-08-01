"use client";

import { useActionState, useState } from "react";
import { repondreAction } from "./actions";
import type { EnvoiPourClient } from "@/server/repositories/envois-devis";
import { jourLisible, dansDelaiRetractation } from "@/lib/jour";

export default function FormulaireReponse({
  envoi,
  aujourdHui,
}: {
  envoi: EnvoiPourClient;
  aujourdHui: string;
}) {
  const [etat, action, enCours] = useActionState(repondreAction, undefined);
  const [choixDate, setChoixDate] = useState<string>("");
  const [dateAutre, setDateAutre] = useState<string>("");

  const dateEffective = choixDate === "autre" ? dateAutre : choixDate;
  const montrerRetractation = dateEffective !== "" && dansDelaiRetractation(dateEffective, aujourdHui);

  if (etat && "succes" in etat) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-[16px] font-medium text-ink">{etat.succes}</p>
        <p className="mt-2 text-[14px] text-ink/60">Vous pouvez fermer cette page.</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="jeton" value={envoi.jeton} />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-semibold text-ink">Quelle date vous arrange&nbsp;?</h2>

        <div className="mt-3 flex flex-col gap-2">
          {envoi.datesProposees.map((d) => (
            <label key={d} className="flex items-center gap-3 text-[15px] text-ink">
              <input
                type="radio"
                name="choixDate"
                value={d}
                checked={choixDate === d}
                onChange={(e) => setChoixDate(e.target.value)}
                className="h-5 w-5"
              />
              <span>{jourLisible(d)}</span>
            </label>
          ))}

          <label className="flex items-center gap-3 text-[15px] text-ink">
            <input
              type="radio"
              name="choixDate"
              value="autre"
              checked={choixDate === "autre"}
              onChange={(e) => setChoixDate(e.target.value)}
              className="h-5 w-5"
            />
            <span>Aucune des deux — je propose&nbsp;:</span>
          </label>

          {choixDate === "autre" && (
            <div className="ml-8 flex flex-col gap-1">
              {/* Sélecteur natif : il ouvre le calendrier du téléphone et rend
                  une date sans ambiguïté. Un champ libre produirait « le 23 »
                  ou « fin mars », qu'il faudrait interpréter — donc deviner. */}
              <input
                type="date"
                name="dateAutre"
                value={dateAutre}
                min={envoi.fenetre.debut}
                max={envoi.fenetre.fin}
                onChange={(e) => setDateAutre(e.target.value)}
                className="rounded-xl border border-black/10 px-3 py-2 text-[15px]"
              />
              <p className="text-[12px] text-ink/50">
                Les jours déjà pris ne peuvent pas être retenus.
              </p>
              {dateAutre && envoi.joursOccupes.includes(dateAutre) && (
                <p role="alert" className="text-[13px] text-[#B5502F]">
                  Ce jour n&apos;est pas disponible. Choisissez-en un autre.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {montrerRetractation && (
        <section className="rounded-2xl border border-[#B5502F]/25 bg-[#B5502F]/5 p-5">
          <label className="flex items-start gap-3 text-[14px] leading-relaxed text-ink">
            {/* Jamais pré-cochée : c'est cette demande, et elle seule, qui
                autorise l'artisan à intervenir avant la fin du délai légal. */}
            <input
              type="checkbox"
              name="demarrageAnticipe"
              value="oui"
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>
              Cette date se situe dans mon délai de rétractation de 14 jours.
              <strong> Je demande expressément que les travaux commencent avant sa fin.</strong>
            </span>
          </label>
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <label className="block text-[13px] font-medium text-ink/60" htmlFor="precision">
          Une précision&nbsp;? (facultatif)
        </label>
        <input
          id="precision"
          name="precision"
          maxLength={500}
          placeholder="« plutôt le matin »"
          className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-[15px]"
        />
      </section>

      {etat && "erreur" in etat && (
        <p role="alert" className="text-[14px] text-[#B5502F]">
          {etat.erreur}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          name="decision"
          value="accepte"
          disabled={enCours}
          className="rounded-xl bg-[#2F3B2F] py-3.5 text-[16px] font-medium text-white disabled:opacity-50"
        >
          {enCours ? "Envoi…" : "J'accepte ce devis"}
        </button>
        <button
          type="submit"
          name="decision"
          value="refuse"
          disabled={enCours}
          className="rounded-xl border border-black/15 py-3 text-[15px] text-ink/70 disabled:opacity-50"
        >
          Je ne donne pas suite
        </button>
      </div>
    </form>
  );
}
