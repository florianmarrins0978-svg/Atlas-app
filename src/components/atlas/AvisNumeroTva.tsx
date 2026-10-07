"use client";

import { avisSurLeNumeroTva } from "@/lib/autoliquidation";
import { colors } from "@/lib/design-tokens";

/**
 * La ligne rouge sous le n° TVA d'une entreprise cliente, et le bon numéro à
 * toucher : sa planche du 7 octobre 2026 (`appli/verifier-la-tva.html`, B).
 *
 * **Elle prévient, elle ne retient rien** — sa condition, « faut pas que ça
 * bloque ». Aucun enregistrement ne la relit : la fiche part telle qu'il l'a
 * tapée. Et le numéro proposé ne se pose que s'il le touche, parce qu'un
 * numéro calculé pour une entreprise qui n'est pas inscrite à la TVA serait
 * faux sur la facture.
 *
 * Une seule pièce pour la création et pour sa fiche : deux copies de la même
 * phrase finiraient par dire deux choses (`CLAUDE.md` §3).
 */
export default function AvisNumeroTva({
  siret,
  numeroTva,
  onMettre,
}: {
  siret: string;
  numeroTva: string;
  onMettre: (juste: string) => void;
}) {
  const avis = avisSurLeNumeroTva(siret, numeroTva);
  if (!avis) return null;
  const { message, juste } = avis;
  return (
    <div className="mt-1">
      <p className="text-[12px]" style={{ color: colors.alert }} data-atlas="avis-tva">
        {message}
      </p>
      {juste && (
        <button
          type="button"
          onClick={() => onMettre(juste)}
          data-atlas="mettre-la-tva"
          className="mt-2 rounded-full px-4 py-2 text-[14px] font-semibold"
          style={{ color: colors.ink, background: colors.card, border: `1px solid ${colors.rust}` }}
        >
          Mettre {juste}
        </button>
      )}
    </div>
  );
}
