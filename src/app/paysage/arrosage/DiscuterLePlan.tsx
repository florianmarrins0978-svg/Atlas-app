"use client";

import { useRef, useState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import { discuterDuPlan, type EtatDiscussion } from "./actions";
import type { ParametresPlan } from "@/lib/arrosage/consignes";
import type { Tour } from "@/server/ai/services/discuter-plan";

/**
 * DISCUTER LE PLAN — sa demande du 21 août 2026.
 *
 * *« J'ai besoin que si l'utilisateur a besoin de te demander de faire une
 * modification, qu'il puisse le faire. Donc il faut qu'il y ait une petite
 * interface pour qu'il puisse discuter avec toi. »*
 *
 * **PAS DE PHRASES PRÉ-ÉCRITES**, sa correction du 22 août : *« il ne faut pas
 * mettre les phrases pré-écrites, mais il faut un endroit où on puisse discuter
 * avec toi »*. La maquette en montrait trois — elle le disait elle-même, « trois
 * demandes déjà écrites, pour montrer ». Ici, un champ libre et rien d'autre :
 * des suggestions apprennent à ne demander que ce qui est proposé.
 *
 * **LA DISCUSSION NE CRÉE JAMAIS UN PLAN**, son autre borne. Ce composant ne
 * s'affiche qu'AVEC un plan à l'écran, donc à partir d'un croquis déjà complet.
 * Sans plan, il n'y a rien à discuter — et rien ne s'affiche.
 */
export default function DiscuterLePlan({
  parametres,
  surNouveauPlan,
}: {
  parametres: ParametresPlan;
  /** Appelé quand le plan a été refait : l'écran remplace ce qu'il montre. */
  surNouveauPlan: (etat: Extract<EtatDiscussion, { etat: "repondu" }>) => void;
}) {
  const [fil, setFil] = useState<Tour[]>([]);
  const [chiffresDe, setChiffresDe] = useState<Record<number, string>>({});
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const champ = useRef<HTMLTextAreaElement>(null);

  async function envoyer() {
    const demande = saisie.trim();
    if (!demande || enCours) return;
    setSaisie("");
    setRefus(null);
    // **Sa question s'affiche AVANT la réponse.** Un message qui disparaît de
    // la saisie sans réapparaître dans le fil donne l'impression qu'il s'est
    // perdu — et il le retape.
    const filAvant = [...fil, { role: "lui" as const, texte: demande }];
    setFil(filAvant);
    setEnCours(true);
    try {
      const r = await discuterDuPlan(parametres, fil, demande);
      if (r.etat === "repondu") {
        setFil([...filAvant, { role: "atlas", texte: r.texte }]);
        if (r.chiffres) setChiffresDe((c) => ({ ...c, [filAvant.length]: r.chiffres as string }));
        // **Le plan ne se remplace QUE s'il a bougé.** Une explication ne doit
        // pas faire clignoter le dessin : il y verrait un changement qui n'a
        // pas eu lieu.
        if (r.modifie) surNouveauPlan(r);
      } else if (r.etat === "refus") {
        setRefus(r.raison);
        setFil(fil);
        setSaisie(demande);
      }
    } catch {
      setRefus("La demande n’est pas passée. Réessayez.");
      setFil(fil);
      setSaisie(demande);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div data-atlas="discuter-plan" className="mt-8">
      <p className={`mx-[22px] ${libelleCaps}`} style={{ color: colors.muted }}>
        Demander une modification
      </p>

      {fil.map((t, i) => (
        <div key={i} className="mx-[22px] mt-2.5">
          <div
            data-atlas={t.role === "lui" ? "bulle-lui" : "bulle-atlas"}
            className="rounded-[14px] px-4 py-3 text-[14.5px] leading-relaxed"
            style={
              t.role === "lui"
                ? { backgroundColor: colors.rustTint, color: colors.ink, marginLeft: 38 }
                : { backgroundColor: colors.card, color: colors.ink, marginRight: 38 }
            }
          >
            {/* Les retours à la ligne du modèle comptent : ils séparent la
                réponse de sa réserve. */}
            {t.texte.split("\n").map((ligne, k) => (
              <p key={k} className={k > 0 ? "mt-2" : undefined}>
                {ligne}
              </p>
            ))}
            {/* **Les chiffres à l'appui, à part et en plus petit.** Ils viennent
                du calcul et du catalogue, jamais du modèle : c'est ce qui permet
                de les relire sans se demander lesquels croire. */}
            {chiffresDe[i] && (
              <p className="mt-2 text-[12.5px]" style={{ color: colors.muted }} data-atlas="chiffres">
                {chiffresDe[i]}
              </p>
            )}
          </div>
        </div>
      ))}

      {enCours && (
        <div className="mx-[22px] mt-2.5 flex" style={{ marginRight: 38 }}>
          <span
            className="rounded-[14px] px-4 py-3.5"
            style={{ backgroundColor: colors.card, color: colors.muted }}
          >
            <PointsQuiSoufflent />
          </span>
        </div>
      )}

      {refus && (
        <p data-atlas="alerte" className="mx-[22px] mt-3 text-[13px] leading-relaxed" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}

      {/* ─── Le champ libre ───────────────────────────────────────────────── */}
      <div
        className="mx-[22px] mt-3 flex items-end gap-2 rounded-[14px] p-2"
        style={{ backgroundColor: colors.card }}
      >
        {/* 16 px au moins : en dessous, iOS agrandit la page à la mise au point. */}
        <textarea
          ref={champ}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            // Entrée envoie, Maj+Entrée va à la ligne — ce qu'il attend d'une
            // messagerie, et ce qu'il fait sans y penser.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void envoyer();
            }
          }}
          rows={1}
          placeholder="Écrire à Atlas…"
          aria-label="Demander une modification du plan"
          data-atlas="champ-discussion"
          className="min-h-[44px] flex-1 resize-none border-0 bg-transparent px-2 py-[11px] text-[16px] outline-none"
          style={{ color: colors.ink }}
        />
        <button
          type="button"
          onClick={() => void envoyer()}
          disabled={enCours || saisie.trim() === ""}
          aria-label="Envoyer la demande"
          data-atlas="envoyer-discussion"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[19px]"
          style={{
            backgroundColor: saisie.trim() === "" ? colors.rustTint : colors.rust,
            color: saisie.trim() === "" ? colors.muted : "#FFFFFF",
            fontFamily: font.display,
          }}
        >
          ↑
        </button>
      </div>

      {/* **Ce qu'il ne peut PAS demander ici, dit une fois.** La nourrice et les
          métrés viennent du croquis ; les changer par la conversation
          fabriquerait un plan qui ne correspond plus au dessin qu'il a en main
          (`CLAUDE.md` §4 bis). Le dire évite qu'il l'essaie et croie à une
          panne. */}
      <p className="mx-[22px] mt-2 text-[12.5px] leading-relaxed" style={{ color: colors.muted }}>
        Pour changer un métré ou l’endroit de la nourrice, corrigez le croquis et
        reprenez la photo.
      </p>
    </div>
  );
}
