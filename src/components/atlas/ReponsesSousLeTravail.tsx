"use client";

import { useState } from "react";
import { colors } from "@/lib/design-tokens";

/**
 * Ses réponses à la grille, sous le travail du devis : sa planche du
 * 20 novembre 2026 (`appli/soignee/devis-reponses-sous-le-travail.html`).
 *
 * Discrètes, et pour lui seul : le PDF et la page du client lisent la
 * désignation, jamais ceci. Le toucher le dit, plutôt qu'une phrase posée en
 * permanence sous chaque travail (sa règle du moins de mots possible).
 */
export default function ReponsesSousLeTravail({ reponses }: { reponses: readonly string[] }) {
  const [dit, setDit] = useState(false);
  if (reponses.length === 0) return null;
  return (
    <button
      type="button"
      data-atlas="reponses-grille"
      onClick={() => setDit((d) => !d)}
      className="mt-1 block text-left text-[13.5px] leading-[1.35]"
      style={{ color: colors.muted }}
    >
      {reponses.map((r) => (
        <span key={r} className="block">
          {r}
        </span>
      ))}
      {dit && (
        <span className="mt-0.5 block" data-atlas="reponses-pour-vous-seul">
          Pour vous seul : ni le PDF, ni le client ne le voient.
        </span>
      )}
    </button>
  );
}
