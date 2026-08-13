"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, libelleCaps } from "@/lib/design-tokens";
import type { PeriodiciteTva } from "@/server/periode-tva";
import { mettreAJourPeriodiciteTvaAction } from "@/app/reglages/actions";

/**
 * « Votre rythme » — deux mots soulignés, en haut de l'écran de TVA.
 *
 * *Sa demande du 13 août 2026 : « en haut, votre rythme avec tous les mois et
 * tous les trois mois, mais écrit, souligné, en cliquable ».* Retenu sur
 * maquette (`docs/maquettes/37`).
 *
 * **Pourquoi ici, alors qu'il existe déjà dans Réglages.** Parce que c'est ICI
 * qu'on se pose la question — devant le relevé, pas deux écrans plus loin. Le
 * réglage est le même ; seuls deux endroits y mènent.
 *
 * **Deux mots soulignés et non deux pastilles.** La charte ne pose du plein que
 * sur ce qu'on FAIT (`design-tokens.ts`), et changer de lunette n'est pas une
 * action : c'est une façon de regarder.
 *
 * **Celui qu'on ne suit pas reste lisible et touchable.** Grisé, il se
 * prendrait pour un réglage indisponible — et le patron chercherait pourquoi il
 * ne peut pas passer au trimestre.
 */
export default function RythmeTva({ actuelle }: { actuelle: PeriodiciteTva }) {
  const router = useRouter();
  const [choix, setChoix] = useState<PeriodiciteTva>(actuelle);
  const [enCours, setEnCours] = useState(false);

  async function choisir(valeur: PeriodiciteTva) {
    if (valeur === choix) return;
    const avant = choix;
    setChoix(valeur); // le doigt doit voir tout de suite
    setEnCours(true);
    try {
      const r = await mettreAJourPeriodiciteTvaAction(valeur);
      setChoix(r.periodiciteTva);
      // **Sans paramètre d'adresse.** Le numéro courant n'a pas le même sens
      // d'un rythme à l'autre — le 8e mois n'est pas le 8e trimestre — et
      // l'écran retombe alors sur la période d'aujourd'hui, qui est la bonne.
      router.push("/termines/tva");
      router.refresh();
    } catch {
      setChoix(avant);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="px-6 pt-[22px]">
      <p className={libelleCaps} style={{ color: colors.muted }}>
        Votre rythme
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2.5">
        {(["mensuelle", "trimestrielle"] as const).map((v, i) => (
          <span key={v} className="flex items-center gap-2.5">
            {i > 0 && (
              <span aria-hidden="true" style={{ color: colors.line }}>
                ·
              </span>
            )}
            <button
              type="button"
              onClick={() => choisir(v)}
              disabled={enCours}
              aria-current={choix === v ? "true" : "false"}
              className="py-1.5 text-[14px] underline underline-offset-4"
              style={{
                color: choix === v ? colors.ink : colors.muted,
                textDecorationColor: choix === v ? colors.or : colors.line,
                textDecorationThickness: choix === v ? 1.5 : 1,
              }}
            >
              {v === "mensuelle" ? "Tous les mois" : "Tous les trois mois"}
            </button>
          </span>
        ))}
      </p>
    </div>
  );
}
