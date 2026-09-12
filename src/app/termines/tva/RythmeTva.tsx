"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import type { PeriodiciteTva } from "@/server/periode-tva";
import { mettreAJourPeriodiciteTvaAction } from "@/app/reglages/actions";

/** Le mot qui suit « Déclaration », pour chaque rythme. */
const MOT: Record<PeriodiciteTva, string> = {
  mensuelle: "mensuelle",
  trimestrielle: "trimestrielle",
};

/**
 * « Déclaration mensuelle » — le rythme du relevé, sous les mois, en un mot
 * qui s'appuie.
 *
 * *Sa demande du 13 août 2026 : « en haut, votre rythme, mais écrit, souligné,
 * en cliquable ».* Puis sa planche du 12 septembre 2026
 * (`appli/ma-tva-une-seule-logique.html`), retenue trait pour trait :
 * *« quand je clique sur mensuelle, ouvre un bandeau sans aucun contour, le
 * mot seul flottant dans la même écriture ; si on clique sur trimestrielle, le
 * mot à côté de Déclaration change, et le trait doré reste sous le mot »*.
 *
 * **Pourquoi ici, alors qu'il existe déjà dans Réglages.** Parce que c'est ICI
 * qu'on se pose la question — devant le relevé, pas deux écrans plus loin. Le
 * réglage est le même ; seuls deux endroits y mènent. Sa précision du même
 * jour : *« il faut avoir la possibilité de passer de mensuelle à
 * trimestrielle sur cette page »*.
 *
 * **Et rien d'autre ne vit plus ici.** La feuille du 3 septembre portait aussi
 * le régime d'exigibilité ; il est parti dans « Mon entreprise »
 * (`reglages/ExigibiliteTva.tsx`), parce que la planche ne veut qu'une logique
 * sur le relevé. Deux réglages dans une feuille, c'était deux questions pour un
 * seul mot souligné.
 *
 * **L'autre mot flotte SOUS le premier, au même bord gauche**, dans la même
 * écriture et sans contour : un cadre en ferait un menu, et ce n'en est pas un
 * — c'est le mot qu'on aurait pu écrire à la place. Une seule alternative,
 * donc un seul mot : il n'y a que deux rythmes.
 *
 * **Non modifiable pour qui n'est pas le patron** : le mot reste, sans trait ni
 * geste. Le rôle Facturation relit le relevé et doit savoir à quel rythme il
 * est fait (3 septembre 2026) ; il ne le change pas.
 */
export default function RythmeTva({
  actuelle,
  modifiable,
}: {
  actuelle: PeriodiciteTva;
  modifiable: boolean;
}) {
  const router = useRouter();
  const [choix, setChoix] = useState<PeriodiciteTva>(actuelle);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const autre: PeriodiciteTva = choix === "mensuelle" ? "trimestrielle" : "mensuelle";

  async function choisir(valeur: PeriodiciteTva) {
    setOuvert(false);
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
    <p data-atlas="rythme" className="mt-2.5 px-6 text-[12px] leading-[1.55]" style={{ color: colors.muted }}>
      Déclaration{" "}
      {modifiable ? (
        // `inline-block` + `relative` : le bandeau se pose sous CE mot, à son
        // bord gauche, quel que soit le mot qui précède.
        <span className="relative inline-block">
          <button
            type="button"
            data-atlas="rythme-actuel"
            aria-haspopup="listbox"
            aria-expanded={ouvert}
            disabled={enCours}
            onClick={() => setOuvert((o) => !o)}
            className="inline-flex min-h-[44px] items-center bg-transparent p-0"
            style={{ color: colors.inkSoft }}
          >
            {/* Le trait vit sous le MOT, pas sous le bouton de 44 px : posé sur
                le bouton, il flottait un centimètre plus bas. */}
            <span style={{ borderBottom: `1.5px solid ${colors.or}`, paddingBottom: 1 }}>
              {MOT[choix]}
            </span>
          </button>
          {ouvert && (
            <span role="listbox" className="absolute left-0 top-full whitespace-nowrap">
              <button
                type="button"
                role="option"
                aria-selected={false}
                data-atlas="rythme-autre"
                onClick={() => choisir(autre)}
                className="inline-flex min-h-[36px] items-center bg-transparent p-0 text-[12px]"
                style={{ color: colors.inkSoft }}
              >
                {MOT[autre]}
              </button>
            </span>
          )}
        </span>
      ) : (
        <span style={{ color: colors.inkSoft }}>{MOT[choix]}</span>
      )}
    </p>
  );
}
