"use client";

import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";

/**
 * Un total de la page de vérification, et le mot qui le copie juste dessous.
 *
 * Planche `appli/tva-collectee-a-la-calculette.html` : il recopie ce total
 * ailleurs (son outil comptable, un message). Le mot DIT qu'il a copié, comme
 * `LigneMontant` : un bouton muet se fait appuyer trois fois.
 */
export default function CopierLeChiffre({ montant, tva = false }: { montant: string; tva?: boolean }) {
  const [dit, setDit] = useState<string | null>(null);

  async function copier() {
    if (dit) return;
    try {
      await navigator.clipboard.writeText(montant);
      setDit("Copié");
    } catch {
      // Le presse-papier refuse hors page sécurisée : le dire vaut mieux qu'un
      // bouton qui ne répond pas.
      setDit("Impossible");
    }
    setTimeout(() => setDit(null), 1600);
  }

  return (
    <>
      <span
        className="block whitespace-nowrap text-[17px] font-bold"
        style={{ color: tva ? colors.or : colors.ink, fontFamily: font.display, fontVariantNumeric: "tabular-nums" }}
      >
        {montant}
      </span>
      <button
        type="button"
        onClick={copier}
        className="mx-auto mt-1 block text-[11px]"
        style={{ color: dit ? colors.or : colors.muted, minHeight: 32 }}
      >
        {dit ?? "Copier"}
      </button>
    </>
  );
}
