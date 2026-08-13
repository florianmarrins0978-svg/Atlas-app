"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import {
  libelleCourt,
  moisDuNumero,
  nombreDePeriodes,
  type PeriodiciteTva,
} from "@/server/periode-tva";

/**
 * Le calendrier du relevé de TVA — douze mois, ou quatre trimestres.
 *
 * *Sa demande du 12 août 2026 : « entre le 2e trimestre 2026 et le 4e trimestre
 * 2026, j'aimerais qu'il y ait un petit calendrier, et si on clique dessus on a
 * accès au calendrier pour se déplacer plus rapidement. Peut-être un calendrier
 * sans les jours, parce qu'on n'a pas besoin de jours étant donné que ce n'est
 * que des mois. »* Retenu sur maquette (`docs/maquettes/35`).
 *
 * **Ce que ça remplace :** remonter au 1er trimestre 2025 depuis le 3e
 * trimestre 2026 demandait sept appuis sur « ← » — et sept chargements
 * d'écran, puisque chaque flèche est un lien. Deux appuis suffisent.
 *
 * **La forme suit la périodicité, elle ne se choisit pas** (son arbitrage du
 * même jour). En mensuel, douze pavés ; en trimestriel, quatre. Un troisième
 * réglage n'apporterait rien : personne ne veut chercher un mois dans une
 * grille de trimestres.
 */
export default function CalendrierPeriodes({
  periodicite,
  annee,
  numero,
  anneeCourante,
  numeroCourant,
}: {
  periodicite: PeriodiciteTva;
  /** L'année regardée. */
  annee: number;
  /** La période regardée. */
  numero: number;
  /** Celle d'aujourd'hui, pour le point doré. */
  anneeCourante: number;
  numeroCourant: number;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [anneeVue, setAnneeVue] = useState(annee);

  const combien = nombreDePeriodes(periodicite);
  const numeros = Array.from({ length: combien }, (_, i) => i + 1);

  function aller(n: number) {
    setOuvert(false);
    router.push(`/termines/tva?annee=${anneeVue}&t=${n}`);
  }

  return (
    <>
      {/* Le carré de 44 px est invisible, mais il est là : une icône de 19 px
          ferait une cible qu'on rate deux fois sur trois avec des gants. Les
          marges négatives le reprennent en hauteur pour ne pas gonfler la
          rangée où il se glisse, entre les deux flèches. */}
      <button
        type="button"
        aria-label="Choisir une période"
        aria-expanded={ouvert}
        onClick={() => {
          setAnneeVue(annee);
          setOuvert(true);
        }}
        className="-my-3 flex h-11 w-11 flex-shrink-0 items-center justify-center"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="1.6" aria-hidden="true">
          <rect x="3.2" y="5" width="17.6" height="15.4" rx="2.4" />
          <path d="M3.2 9.6h17.6" />
          <path d="M8 3.4v3.2M16 3.4v3.2" strokeLinecap="round" />
        </svg>
      </button>

      <BottomSheet open={ouvert} onBackdropClick={() => setOuvert(false)}>
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            aria-label="Année précédente"
            onClick={() => setAnneeVue((a) => a - 1)}
            className="h-11 w-11 text-[20px]"
            style={{ color: colors.rust }}
          >
            ‹
          </button>
          <span className="text-[24px] tabular-nums" style={{ fontFamily: font.display }}>
            {anneeVue}
          </span>
          <button
            type="button"
            aria-label="Année suivante"
            onClick={() => setAnneeVue((a) => a + 1)}
            className="h-11 w-11 text-[20px]"
            style={{ color: colors.rust }}
          >
            ›
          </button>
        </div>

        <div className={`grid gap-2 ${periodicite === "mensuelle" ? "grid-cols-3" : "grid-cols-2"}`}>
          {numeros.map((n) => {
            const regarde = anneeVue === annee && n === numero;
            const aujourdHui = anneeVue === anneeCourante && n === numeroCourant;
            const mois = moisDuNumero(periodicite, n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => aller(n)}
                aria-current={regarde ? "true" : undefined}
                className="relative rounded-lg px-2 py-3.5 text-center"
                style={{
                  // Le pavé plein dit ce qu'on REGARDE ; le point doré, ce qui
                  // est aujourd'hui. Deux repères qui ne se confondent pas —
                  // et la charte réserve le plein à ce qu'on fait.
                  backgroundColor: regarde ? colors.rust : colors.card,
                  border: `1px solid ${regarde ? colors.rust : colors.line}`,
                  color: regarde ? colors.cream : colors.ink,
                }}
              >
                <span className="block text-[16px]" style={{ fontFamily: font.display }}>
                  {libelleCourt(periodicite, n)}
                </span>
                {mois && (
                  <span
                    className="mt-0.5 block text-[11px]"
                    style={{ color: regarde ? "rgba(245,243,238,0.66)" : colors.muted }}
                  >
                    {mois}
                  </span>
                )}
                {aujourdHui && (
                  <span
                    aria-hidden="true"
                    className="absolute right-1.5 top-1.5 h-[5px] w-[5px] rounded-full"
                    style={{ backgroundColor: colors.or }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            router.push("/termines/tva");
          }}
          className="mt-3 w-full py-3 text-[14px]"
          style={{ color: colors.rust }}
        >
          Revenir à la période en cours
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="w-full py-3 text-[15px]"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </BottomSheet>
    </>
  );
}
