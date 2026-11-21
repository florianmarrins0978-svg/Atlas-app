"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { enregistreLe } from "@/lib/arrosage/mots-des-dossiers";
import { saisieEcrite } from "@/lib/arrosage/saisie-ecrite";
import type { PlanFige, SaisieDuPlan } from "@/lib/arrosage/plan-enregistre";
import LePlanDuJardin from "../arrosage/LePlanDuJardin";
import { Feuille } from "../arrosage/FeuillePiece";
import Icone from "../arrosage/Icones";

/**
 * Le plan revu — sa planche du 21 novembre 2026. `LePlanDuJardin` en lecture
 * seule, sur le plan FIGÉ (`fige`) : le sommaire, les réseaux, la liste et les
 * réserves de ce jour-là, sans rien qui les change. Pour le changer :
 * « Reprendre dans l'outil », qui le refait avec le calcul d'aujourd'hui.
 */
export default function PlanRevu({
  dossier,
  plan,
  saisie,
  resultat,
}: {
  dossier: { id: string; nom: string };
  plan: { id: string; le: string; avecPhoto: boolean; avecPdf: boolean };
  saisie: SaisieDuPlan;
  resultat: PlanFige;
}) {
  const [saisieOuverte, setSaisieOuverte] = useState(false);
  const base = `/paysage/dossiers-arrosage/${dossier.id}/${plan.id}`;
  const photo = `${base}/croquis`;
  return (
    <div className="pb-[170px]" data-atlas="plan-revu">
      <div data-atlas="plan-enregistre-le" className="mx-[22px] mb-[10px] mt-2 rounded-[6px] px-4 py-3" style={{ backgroundColor: voile(colors.or, 0.13) }}>
        <b className="block text-[15.5px]" style={{ color: colors.ink }}>
          {enregistreLe(new Date(plan.le), new Date())}
        </b>
        <span className="mt-[2px] block text-[14px]" style={{ color: colors.inkSoft }}>
          {dossier.nom}. Tel que rendu ce jour-là.
        </span>
      </div>
      <div data-atlas="croquis-replie" className="mx-[22px] mt-2 flex items-center gap-[14px] rounded-[6px] py-3 pl-3 pr-[14px]" style={{ backgroundColor: colors.card }}>
        {plan.avecPhoto && (
          <span aria-hidden="true" className="h-[44px] w-[64px] flex-none rounded-[4px] bg-cover bg-center" style={{ backgroundImage: `url(${photo})`, boxShadow: `inset 0 0 0 1px ${colors.line}` }} />
        )}
        <span className="min-w-0 flex-1">
          <b className="block" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 18, lineHeight: 1.25 }}>
            {plan.avecPhoto ? "Croquis lu" : "Plan dessiné"}
          </b>
          <span className="mt-[2px] block text-[14px]" style={{ color: colors.inkSoft }}>
            {`${saisie.parametres.zones.length} zone${saisie.parametres.zones.length > 1 ? "s" : ""}, ${saisie.parametres.compteur === "oui" ? "au compteur" : "au robinet"}`}
          </span>
        </span>
        <button type="button" onClick={() => setSaisieOuverte(true)} data-atlas="voir-la-saisie" className="min-h-[44px] bg-transparent text-[16px] font-semibold" style={{ color: colors.or }}>
          Voir la saisie
        </button>
      </div>

      <LePlanDuJardin
        etat={{ reserves: saisie.reservesDuCroquis, sansDessin: saisie.sansDessin }}
        parametres={saisie.parametres}
        onParametres={() => undefined}
        fige={{ resultat, retouches: saisie.retouches }}
        apresLesReserves={() => (
          <div className="mt-5">
            <Link
              href={`/paysage/arrosage?reprendre=${dossier.id}/${plan.id}`}
              data-atlas="reprendre-dans-l-outil"
              className="flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold"
              style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
            >
              Reprendre dans l’outil
            </Link>
          </div>
        )}
        bas={
          plan.avecPdf ? (
            <a
              href={`${base}/pdf?telecharger=1`}
              data-atlas="telecharger-pdf"
              className="atlas-plein flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full text-[17px] font-semibold"
              style={{ backgroundColor: colors.plein, color: surPlein }}
            >
              <Icone nom="telecharger" />
              Télécharger le PDF
            </a>
          ) : undefined
        }
      />

      {saisieOuverte && (
        <Feuille titre="Ce que vous avez saisi" repere="feuille-saisie" onFermer={() => setSaisieOuverte(false)}>
          {plan.avecPhoto ? (
            // `unoptimized` : la photo est servie par sa route, derrière la session ; `/_next/image` la redemanderait sans elle.
            <Image alt="Le croquis photographié" src={photo} width={1200} height={900} unoptimized className="block h-auto w-full rounded-[6px]" style={{ boxShadow: `inset 0 0 0 1px ${colors.line}` }} />
          ) : (
            <p className="text-[14.5px]" style={{ color: colors.muted }}>
              La photo du croquis n’est pas gardée.
            </p>
          )}
          <div className="mt-[14px]">
            {saisieEcrite(saisie).map((r) => (
              <div key={r.cle} className="flex gap-3 py-3 text-[15px] leading-[1.4]" style={{ borderTop: `1px solid ${colors.line}` }}>
                <span className="w-[92px] flex-none" style={{ color: colors.inkSoft }}>
                  {r.cle}
                </span>
                <span className="min-w-0 flex-1" style={{ color: colors.ink }}>
                  {r.valeurs.map((v) => (
                    <span key={v} className="block">
                      {v}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </Feuille>
      )}
    </div>
  );
}
