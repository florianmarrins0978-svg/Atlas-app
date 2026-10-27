"use client";

import { useRef, useState } from "react";
import { colors, voile } from "@/lib/design-tokens";
import type { MomentDuJour } from "@/lib/absences-equipe";

/**
 * LA PISTE D'UN SALARIÉ — Présent, Matin, Après-midi, Journée.
 *
 * **Sa planche C du 27 octobre 2026** (`appli/soignee/salarie-absent.html`),
 * qu'il a fait coder le soir même. Elle remplace l'interrupteur de la planche
 * du planning et le second temps du choix du moment : un seul appui dit qui
 * manque ET quand.
 *
 * **Le curseur se glisse au doigt, ou la case se touche** — sa demande du même
 * soir, *« pouvoir déplacer le bouton en le slidant en restant appuyé ou en
 * cliquant »*. Le choix s'écrit au lâcher, pas au survol : un doigt qui
 * traverse Matin pour aller à Journée n'écrit pas un matin en passant.
 *
 * **La première case dit l'état** : *« à partir du moment où on passe sur le
 * premier, le message présent doit devenir absent »*. La ligne se lit alors
 * « Julien, absent, matin » ; y ramener le curseur le rend présent.
 *
 * `touch-action: pan-y` laisse la feuille défiler quand le doigt monte ou
 * descend ; un glissé de côté reste au curseur.
 */
const CHOIX: { cle: MomentDuJour | null; mot: string }[] = [
  { cle: null, mot: "Présent" },
  { cle: "matin", mot: "Matin" },
  { cle: "apres_midi", mot: "Après-midi" },
  { cle: "journee", mot: "Journée" },
];

/** Au-delà de ce déplacement, un appui devient un glissé. */
const SEUIL_GLISSE_PX = 6;
const MARGE_PX = 4;

export function PisteAbsence({
  nom,
  retenu,
  onChoisir,
}: {
  nom: string;
  retenu: MomentDuJour | null;
  onChoisir: (moment: MomentDuJour | null) => void;
}) {
  const indexRetenu = Math.max(0, CHOIX.findIndex((c) => c.cle === retenu));
  /** La case sous le doigt pendant un glissé, et la place du curseur en pixels. */
  const [survol, setSurvol] = useState<{ index: number; x: number } | null>(null);
  const glisse = useRef<{ id: number; x0: number; bouge: boolean; index: number } | null>(null);
  const piste = useRef<HTMLDivElement>(null);
  /** L'appui du doigt a déjà choisi : le clic qui suit n'en est que l'écho. */
  const lacheA = useRef(0);

  const index = survol?.index ?? indexRetenu;
  const absent = index > 0;

  function mesure() {
    const r = piste.current!.getBoundingClientRect();
    const large = (r.width - 2 * MARGE_PX) / CHOIX.length;
    return { gauche: r.left + MARGE_PX, large };
  }

  function choisir(i: number) {
    const cle = CHOIX[i].cle;
    if (cle !== retenu) onChoisir(cle);
  }

  return (
    <div
      ref={piste}
      role="radiogroup"
      aria-label={nom}
      data-atlas="piste-absent"
      data-absent={absent ? "true" : "false"}
      className="relative grid select-none grid-cols-4 rounded-[14px] p-1"
      style={{ backgroundColor: colors.rustTint, touchAction: "pan-y", WebkitTapHighlightColor: "transparent" }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        glisse.current = { id: e.pointerId, x0: e.clientX, bouge: false, index: indexRetenu };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const g = glisse.current;
        if (!g || g.id !== e.pointerId) return;
        if (!g.bouge && Math.abs(e.clientX - g.x0) < SEUIL_GLISSE_PX) return;
        g.bouge = true;
        const { gauche, large } = mesure();
        const x = Math.max(0, Math.min((CHOIX.length - 1) * large, e.clientX - gauche - large / 2));
        g.index = Math.round(x / large);
        setSurvol({ index: g.index, x });
      }}
      onPointerUp={(e) => {
        const g = glisse.current;
        if (!g || g.id !== e.pointerId) return;
        glisse.current = null;
        lacheA.current = Date.now();
        const { gauche, large } = mesure();
        const i = g.bouge
          ? g.index
          : Math.max(0, Math.min(CHOIX.length - 1, Math.floor((e.clientX - gauche) / large)));
        setSurvol(null);
        choisir(i);
      }}
      onPointerCancel={() => {
        glisse.current = null;
        setSurvol(null);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const i = Math.max(0, Math.min(CHOIX.length - 1, indexRetenu + (e.key === "ArrowRight" ? 1 : -1)));
        choisir(i);
        piste.current?.querySelectorAll<HTMLButtonElement>("button")[i]?.focus();
      }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 top-1 rounded-[10px]"
        style={{
          width: `calc((100% - ${2 * MARGE_PX}px) / ${CHOIX.length})`,
          backgroundColor: absent ? colors.carteAmbreFond : colors.card,
          boxShadow: absent
            ? `inset 0 0 0 1px ${voile(colors.carteAmbreTexte, 0.3)}, 0 2px 8px ${voile(colors.ink, 0.08)}`
            : `0 1px 2px ${voile(colors.ink, 0.1)}, 0 2px 8px ${voile(colors.ink, 0.08)}`,
          // Pendant le glissé, le curseur colle au doigt ; sa course ne s'anime qu'au lâcher.
          transform: survol ? `translateX(${survol.x}px)` : `translateX(${indexRetenu * 100}%)`,
          transition: survol
            ? "background-color 240ms ease-out"
            : "transform 260ms cubic-bezier(0.16, 1, 0.3, 1), background-color 240ms ease-out",
        }}
      />
      {CHOIX.map((c, i) => {
        const coche = i === index;
        const mot = i === 0 && absent ? "Absent" : c.mot;
        return (
          <button
            key={c.mot}
            type="button"
            role="radio"
            aria-checked={coche}
            data-atlas="piste-quand"
            data-quand={c.cle ?? "present"}
            tabIndex={coche ? 0 : -1}
            onClick={() => {
              // Le doigt a choisi au lâcher ; reste le clavier (Entrée, Espace).
              if (Date.now() - lacheA.current < 500) return;
              choisir(i);
            }}
            className="relative z-[1] min-h-[48px] whitespace-nowrap rounded-[10px] border-0 bg-transparent px-0.5 text-[14.5px] font-semibold tracking-[-0.005em] max-[370px]:text-[13.5px]"
            style={{
              color:
                coche && !absent
                  ? colors.ink
                  : absent && (coche || i === 0)
                    ? colors.carteAmbreTexte
                    : colors.inkSoft,
              transition: "color 200ms ease-out",
            }}
          >
            {mot}
          </button>
        );
      })}
    </div>
  );
}
