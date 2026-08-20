"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, libelleCaps } from "@/lib/design-tokens";
import { rattacherAction } from "../actions";

/**
 * Verser le diagnostic au dossier d'un chantier — **et rien ne l'y oblige**.
 *
 * **Pourquoi ce geste vit DANS les détails, et pas sur l'écran principal.** Sa
 * règle produit : *« 1 photo → 1 résultat principal → 3 informations
 * essentielles → 1 action recommandée »*. L'action recommandée est la conduite
 * à tenir sur l'arbre ; le rangement administratif n'en est pas une, et le
 * poser à côté ferait deux actions concurrentes sur un écran qui n'en veut
 * qu'une.
 *
 * **Ce que ce geste change vraiment**, et qui n'est pas visible : la photo
 * cesse de suivre la règle de conservation « libre » pour suivre celle du
 * dossier chantier. Le recalcul se fait côté serveur
 * (`rattacherAUnChantier`) ; l'écran ne fait que le demander.
 */
export default function RattacherAUnChantier({
  diagnosticId,
  chantierId,
  chantiers,
}: {
  diagnosticId: string;
  chantierId: string | null;
  chantiers: { id: string; nom: string }[];
}) {
  const [choisi, setChoisi] = useState(chantierId ?? "");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const router = useRouter();

  if (chantiers.length === 0) {
    return (
      <p className="text-[12.5px]" style={{ color: colors.muted }}>
        Aucun chantier ouvert : ce diagnostic reste indépendant.
      </p>
    );
  }

  const dejaRattache = chantierId !== null && choisi === chantierId;

  return (
    <div data-atlas="diagnostic-rattacher">
      <p className={libelleCaps} style={{ color: colors.muted }}>
        Rattacher à un chantier
      </p>

      <select
        value={choisi}
        onChange={(e) => {
          setChoisi(e.target.value);
          setPhrase(null);
        }}
        className="mt-[8px] block w-full rounded-[14px] px-[15px] py-3 text-[15px] outline-none"
        style={{ backgroundColor: colors.card, color: colors.ink, border: `1px solid ${colors.line}` }}
      >
        <option value="">Aucun</option>
        {chantiers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nom}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={enCours || choisi === "" || dejaRattache}
        onClick={() =>
          demarrer(async () => {
            const r = await rattacherAction(diagnosticId, choisi);
            if (!r.ok) {
              setPhrase(r.phrase);
              return;
            }
            setPhrase("Rattaché.");
            router.refresh();
          })
        }
        className="mt-[10px] text-[13px]"
        style={{ color: enCours || choisi === "" || dejaRattache ? colors.muted : colors.rust }}
      >
        {enCours ? "Rattachement…" : dejaRattache ? "Déjà rattaché" : "Rattacher"}
      </button>

      {phrase && (
        <p className="mt-[8px] text-[12.5px]" style={{ color: colors.muted }}>
          {phrase}
        </p>
      )}
    </div>
  );
}
