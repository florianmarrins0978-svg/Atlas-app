"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { colors } from "@/lib/design-tokens";
import CalendrierPeriodes from "./CalendrierPeriodes";
import { libelleCourt, nombreDePeriodes, type PeriodiciteTva } from "@/server/periode-tva";

/**
 * Les périodes de l'année, en une frise, et le calendrier au bout.
 *
 * ─── CE QU'ELLE REMPLACE ────────────────────────────────────────────────────
 *
 * Une rangée de trois pièces : « ← Juillet 2026 », l'icône du calendrier,
 * « Septembre 2026 → ». Deux libellés longs qui redisent ce que le titre dit
 * déjà, autour d'une cible de dix-neuf pixels — et **un chargement d'écran par
 * flèche**, chacune étant un lien.
 *
 * La frise montre où l'on est DANS L'ANNÉE, ce qu'aucune flèche ne pouvait
 * dire, et met tout mois de l'année à un doigt au lieu de deux à six. Le
 * calendrier garde son rôle : les autres années.
 *
 * **Le soulignement d'or dit ce qu'on REGARDE**, comme les deux mots de
 * `RythmeTva` et comme le trait de la barre du bas : la charte réserve le plein
 * à ce qu'on FAIT, et changer de mois n'est pas une action, c'est une façon de
 * regarder.
 *
 * **Aucune animation sur ce trait**, contrairement à la barre du bas : chaque
 * période est un LIEN, l'écran est refait par le serveur, et il n'existe aucun
 * instant où un trait pourrait glisser d'un mois à l'autre. Un glissement écrit
 * ici ne se verrait jamais.
 *
 * **L'année reste sous le pouce quand la frise défile** (`sticky`) : c'est la
 * seule porte vers les autres années, et elle sortait de l'écran dès le mois de
 * juin.
 */
export default function FrisePeriodes({
  periodicite,
  annee,
  numero,
  anneeCourante,
  numeroCourant,
}: {
  periodicite: PeriodiciteTva;
  annee: number;
  numero: number;
  anneeCourante: number;
  numeroCourant: number;
}) {
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sans défilement, septembre s'ouvre sur une frise arrêtée en janvier : le
    // mois regardé est hors de l'écran, et rien ne dit qu'elle défile.
    // Instantané — une frise qui glisse à l'ouverture se lit comme un écran qui
    // bouge tout seul.
    //
    // **Deux passages, et le second n'est pas une précaution en l'air.** Relevé
    // image par image dans le navigateur : à 250 ms le rail affiche encore un
    // `scrollWidth` de **0** — il ne passe à 934 qu'à 280 ms, quand la police
    // d'affichage arrive. Une écriture de `scrollLeft` avant cet instant ne fait
    // rien du tout : le navigateur la ramène à zéro, faute de quoi défiler, et
    // plus rien ne recalcule ensuite. D'où le rappel une fois les polices prêtes.
    //
    // **Le mois actif se cherche DANS le rail**, plutôt que par un `ref` posé
    // sur le `<Link>` : le repère `aria-current` est déjà là, il est rendu par
    // le serveur, et il ne dépend d'aucune promesse de transmission de `ref`.
    const centrer = () => {
      const r = rail.current;
      const a = r?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!r || !a || r.scrollWidth <= r.clientWidth) return;
      r.scrollLeft = Math.max(0, a.offsetLeft - r.clientWidth / 2 + a.offsetWidth / 2);
    };

    centrer();
    let vivant = true;
    document.fonts?.ready.then(() => vivant && centrer()).catch(() => {});
    return () => {
      vivant = false;
    };
  }, [annee, numero, periodicite]);

  const numeros = Array.from({ length: nombreDePeriodes(periodicite) }, (_, i) => i + 1);

  return (
    <div className="relative mt-5">
      <div
        ref={rail}
        data-atlas="frise-periodes"
        className="flex items-stretch gap-0.5 overflow-x-auto pr-6"
      >
        <span
          className="sticky left-0 z-[2] flex items-center pl-6 pr-3"
          style={{
            backgroundColor: colors.cream,
            boxShadow: `1px 0 0 ${colors.lineSoft}, 14px 0 14px -10px ${colors.cream}`,
          }}
        >
          <CalendrierPeriodes
            periodicite={periodicite}
            annee={annee}
            numero={numero}
            anneeCourante={anneeCourante}
            numeroCourant={numeroCourant}
          />
        </span>

        {numeros.map((n) => {
          const regarde = n === numero;
          return (
            <Link
              key={n}
              href={`/termines/tva?annee=${annee}&t=${n}`}
              aria-current={regarde ? "page" : undefined}
              className="flex flex-none items-start px-[9px] pt-3 text-[11px] font-medium uppercase tracking-[0.13em] whitespace-nowrap"
              style={{ color: regarde ? colors.ink : colors.muted, minHeight: 44 }}
            >
              <span
                className="pb-[7px]"
                style={{
                  borderBottom: regarde ? `1.5px solid ${colors.or}` : "1.5px solid transparent",
                }}
              >
                {libelleCourt(periodicite, n)}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Le fondu dit qu'il reste des mois à droite. Sans lui, « nov. » coupé au
          ras du bord se lit comme un défaut d'affichage, pas comme un rouleau. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8"
        style={{ background: `linear-gradient(to right, transparent, ${colors.cream})` }}
      />
    </div>
  );
}
