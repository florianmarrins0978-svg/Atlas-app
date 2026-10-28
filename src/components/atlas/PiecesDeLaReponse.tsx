"use client";

import { colors } from "@/lib/design-tokens";
import type { PieceJointe } from "@/lib/pieces-de-l-assistant";
import { formatEuros } from "@/lib/termines-par-mois";

/**
 * Les documents que l'assistant a trouvés, à toucher pour les ouvrir.
 *
 * Planche `appli/assistant-ouvre-le-devis.html`, **B**, retenue le
 * 27 octobre 2026 : la ligne trouvée est elle-même le bouton. En gras ce qu'il
 * cherchait, son montant à droite ; en gris le document qui la porte.
 *
 * **Le panneau se ferme en ouvrant** : la visionneuse est un écran de
 * l'application, et sa flèche le ramène là d'où il vient. La discussion, elle,
 * reste dans le panneau, qui vit dans le gabarit racine.
 */
export default function PiecesDeLaReponse({
  pieces,
  onOuvrir,
}: {
  pieces: PieceJointe[];
  onOuvrir: (piece: PieceJointe) => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {pieces.map((p) => (
        <button
          key={p.adresse + p.titre}
          type="button"
          data-atlas="piece-assistant"
          onClick={() => onOuvrir(p)}
          className="block w-full rounded-[8px] px-3 py-2.5 text-left"
          style={{ backgroundColor: colors.cream, boxShadow: `inset 0 0 0 1px ${colors.line}`, color: colors.ink }}
        >
          <span className="flex justify-between gap-2.5 text-[15px] font-semibold">
            <span>{p.titre}</span>
            {p.montant && <span className="shrink-0">{formatEuros(Number(p.montant))}</span>}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[13px]" style={{ color: colors.muted }}>
            <b className="text-[11px] font-bold tracking-[.04em]" style={{ color: colors.rust }}>
              {p.format === "pdf" ? "PDF" : "PHOTO"}
            </b>
            {p.detail}
          </span>
        </button>
      ))}
    </div>
  );
}

