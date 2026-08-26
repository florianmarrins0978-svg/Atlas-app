"use client";

import { useState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import type { PeriodiciteTva } from "@/server/periode-tva";
import { mettreAJourPeriodiciteTvaAction } from "./actions";

/**
 * « Votre TVA » — au mois, ou au trimestre.
 *
 * *Posé le 12 août 2026, à sa demande : « pour moi la TVA on doit la donner
 * tous les mois et pas tous les trimestres. Et si jamais c'est à nous de
 * choisir, dans ce cas-là il faut que l'utilisateur ait le choix. »*
 *
 * **Le mois est coché d'avance parce que c'est le défaut LÉGAL**, pas une
 * préférence : la déclaration CA3 est mensuelle, et le trimestre est une option
 * ouverte seulement quand la TVA due de l'année précédente est sous 4 000 €.
 *
 * **Et l'application ne dira JAMAIS lequel s'applique.** Le seuil porte sur la
 * TVA *due* — collectée moins déductible — et Atlas ne connaît que la
 * collectée. La phrase sous les deux boutons le dit au patron plutôt que de le
 * lui laisser supposer : c'est son comptable qui tranche. Faire mine de
 * conseiller ici serait inventer une donnée (`CLAUDE.md` §4).
 */
export default function PeriodiciteTvaReglage({ initiale }: { initiale: PeriodiciteTva }) {
  const [choix, setChoix] = useState<PeriodiciteTva>(initiale);
  const [enCours, setEnCours] = useState(false);

  async function choisir(valeur: PeriodiciteTva) {
    if (valeur === choix || enCours) return;
    const avant = choix;
    setChoix(valeur); // optimiste : le doigt doit voir tout de suite
    setEnCours(true);
    try {
      const r = await mettreAJourPeriodiciteTvaAction(valeur);
      // **On affiche ce que la base porte, jamais ce qu'on a demandé.** Un
      // refus silencieux laisserait sinon un réglage coché qui n'existe pas.
      setChoix(r.periodiciteTva);
    } catch {
      setChoix(avant);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="mt-7 px-[26px]">
      <p className={`mb-1.5 ${libelleCaps}`} style={{ color: colors.muted }}>
        Votre TVA
      </p>

      <p className="pb-3 pt-1 text-[13px] leading-[1.6]" style={{ color: colors.muted }}>
        À quel rythme vous la déclarez.
      </p>

      <div className="flex gap-2.5">
        {(["mensuelle", "trimestrielle"] as const).map((v) => {
          const actif = choix === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => choisir(v)}
              aria-pressed={actif}
              className="flex-1 rounded-full px-3 py-3 text-[15px]"
              style={{
                backgroundColor: actif ? colors.rust : colors.card,
                border: `1px solid ${actif ? colors.rust : colors.line}`,
                color: actif ? colors.cream : colors.ink,
                fontFamily: font.display,
              }}
            >
              {v === "mensuelle" ? "Tous les mois" : "Tous les trimestres"}
            </button>
          );
        })}
      </div>

    </section>
  );
}
