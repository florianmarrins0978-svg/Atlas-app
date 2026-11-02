"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { colors } from "@/lib/design-tokens";
import type { ChoixDuMotif as Choix } from "@/lib/avoir";
import CarteAChoisir from "./CarteAChoisir";

/**
 * « Pourquoi » : deux cartes du même dessin que « Sur » (planche du 2 novembre
 * 2026, `appli/soignee/facture.html`). « Geste commercial » d'un appui, ou
 * « Un autre motif », qui ouvre la case. Ce qui part est décidé par
 * `motifDeLAvoir`, pas ici.
 */
export default function ChoixDuMotif({
  choix,
  ecrit,
  onChoix,
  onEcrit,
}: {
  choix: Choix;
  ecrit: string;
  onChoix: (choix: Choix) => void;
  onEcrit: (texte: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Pourquoi">
        <CarteAChoisir pris={choix === "geste"} onChoix={() => onChoix("geste")} icone="etiquette" titre="Geste commercial" repere="avoir-motif-geste" />
        <CarteAChoisir pris={choix === "autre"} onChoix={() => onChoix("autre")} icone="crayon" titre="Un autre motif" repere="avoir-motif-autre" />
      </div>
      {choix === "autre" && <CaseDuMotif valeur={ecrit} onChange={onEcrit} />}
    </>
  );
}

/**
 * La case du motif écrit.
 *
 * **Un motif long était coupé à gauche** (les notes de la planche, « défaut
 * corrigé ») : la case était un `<input>`, qui tient le texte sur une seule
 * ligne et le fait glisser sous son bord gauche à mesure qu'on écrit. Il ne
 * relisait plus le début de ce qui partait sur l'avoir, document que la loi
 * fige une fois émis. La racine est la nature de la case : une zone de texte
 * revient à la ligne, et grandit avec ce qu'il écrit pour que rien ne se cache
 * non plus en bas (`scripts/test-motif-avoir-lisible.ts`).
 */
function CaseDuMotif({ valeur, onChange }: { valeur: string; onChange: (texte: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [active, setActive] = useState(false);
  // La hauteur se mesure après chaque frappe, avant d'être peinte : remise à
  // « auto » d'abord, sans quoi elle ne redescendrait jamais quand il efface.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valeur]);
  return (
    <textarea
      ref={ref}
      id="motif-avoir"
      data-atlas="avoir-motif"
      aria-label="Motif de l'avoir"
      rows={1}
      autoFocus
      autoComplete="off"
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      className="mt-2 block min-h-[52px] w-full resize-none rounded-[10px] border-0 px-[15px] py-[13px] leading-[1.4] outline-none"
      style={{
        fontSize: 16,
        color: colors.ink,
        backgroundColor: colors.card,
        boxShadow: active ? `inset 0 0 0 2px ${colors.rust}` : `inset 0 0 0 1.5px ${colors.line}`,
      }}
    />
  );
}
