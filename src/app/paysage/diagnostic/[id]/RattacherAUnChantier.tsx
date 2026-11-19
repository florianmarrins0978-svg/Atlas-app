"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/design-tokens";
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
      <p className="text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        Aucun chantier ouvert : ce diagnostic reste indépendant.
      </p>
    );
  }

  const dejaRattache = chantierId !== null && choisi === chantierId;

  return (
    <div data-atlas="diagnostic-rattacher">
      {/* L'allure des pages soignées, sa planche du 19 novembre 2026 : rien
          sous 13 px, la case et le bouton à 56 px, pour le pouce. */}
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.inkSoft }}>
        Rattacher à un chantier
      </p>

      <select
        value={choisi}
        onChange={(e) => {
          setChoisi(e.target.value);
          setPhrase(null);
        }}
        aria-label="Chantier"
        className="mt-2.5 block min-h-[56px] w-full rounded-[14px] px-4 text-[16px] outline-none"
        style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
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
        className="mt-2.5 flex min-h-[56px] w-full items-center justify-center rounded-[14px] text-[17px] font-semibold disabled:opacity-60"
        style={{
          color: enCours || choisi === "" || dejaRattache ? colors.inkSoft : colors.ink,
          boxShadow: `inset 0 0 0 1.5px ${colors.line}`,
        }}
      >
        {enCours ? "Rattachement…" : dejaRattache ? "Déjà rattaché" : "Rattacher"}
      </button>

      {phrase && (
        <p className="mt-2 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
          {phrase}
        </p>
      )}
    </div>
  );
}
