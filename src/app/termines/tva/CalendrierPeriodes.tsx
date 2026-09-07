"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, voile } from "@/lib/design-tokens";
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
      {/* **L'année EST le bouton**, depuis la refonte du 3 septembre 2026 : elle
          ouvre le calendrier, et le calendrier est le seul chemin vers les
          autres années. Une icône seule de dix-neuf pixels se ratait deux fois
          sur trois avec des gants ; l'année lui donne sa largeur et dit ce
          qu'on va y choisir. L'intitulé pour les lecteurs d'écran ne bouge pas :
          c'est le geste qui compte, pas le millésime. */}
      <button
        type="button"
        aria-label="Choisir une période"
        aria-expanded={ouvert}
        onClick={() => {
          setAnneeVue(annee);
          setOuvert(true);
        }}
        className="flex h-11 flex-shrink-0 items-center gap-1.5"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={colors.or} strokeWidth="1.6" aria-hidden="true">
          <rect x="3.2" y="5" width="17.6" height="15.4" rx="2.4" />
          <path d="M3.2 9.6h17.6" />
          <path d="M8 3.4v3.2M16 3.4v3.2" strokeLinecap="round" />
        </svg>
        <span className="text-[14px] tabular-nums" style={{ fontFamily: font.display, color: colors.inkSoft }}>
          {annee}
        </span>
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
                // **La capsule, y compris ici.** Le patron, le 12 août 2026 :
                // « il faut qu'il soit arrondi comme tous les autres ». Sa
                // maquette (35) montrait des pavés à coins arrondis, mais sa
                // règle est postérieure et vaut pour tout ce qui se touche —
                // `scripts/test-boutons-arrondis.ts` l'a rappelé avant lui.
                className="relative rounded-full px-2 py-3.5 text-center"
                style={{
                  // Le pavé plein dit ce qu'on REGARDE ; le point doré, ce qui
                  // est aujourd'hui. Deux repères qui ne se confondent pas —
                  // et la charte réserve le plein à ce qu'on fait.
                  //
                  // **Le vert des boutons depuis le 4 septembre 2026**, quand il
                  // a relevé que « la page terminé » n'avait pas suivi. Ce pavé
                  // est le seul aplat qu'on appuie de cet écran.
                  backgroundColor: regarde ? colors.plein : colors.card,
                  border: `1px solid ${regarde ? colors.plein : colors.line}`,
                  color: regarde ? colors.cream : colors.ink,
                }}
              >
                <span className="block text-[16px]" style={{ fontFamily: font.display }}>
                  {libelleCourt(periodicite, n)}
                </span>
                {mois && (
                  <span
                    className="mt-0.5 block text-[11px]"
                    style={{ color: regarde ? voile(colors.cream, 0.66) : colors.muted }}
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
