"use client";

import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";

/**
 * Un montant de TVA, et le petit carré qui le copie.
 *
 * *Sa demande du 12 août 2026 : « on doit pouvoir copier le montant de la TVA
 * collectée, la TVA déductible. Donc à côté de chaque montant, rajoute soit le
 * petit carré où on clique dessus, on copie ».* Il a retenu le petit carré
 * parmi les trois proposés (`docs/maquettes/37`).
 *
 * **À quoi ça sert, concrètement** : il recopie ces deux chiffres dans sa
 * déclaration, ou les envoie à son comptable. Les retaper à la main, c'est une
 * virgule déplacée un jour sur dix.
 *
 * **Le chiffre est en gras et en pleine encre** — sa correction du même jour :
 * la déductible était en gris, elle avait l'air d'un chiffre de second rang
 * alors que c'est celui qu'il va chercher.
 *
 * **Et le carré DIT qu'il a copié.** Un bouton muet se fait appuyer trois fois,
 * et l'on finit par croire que rien n'est parti — puis on colle du vide.
 */
export default function MontantCopiable({
  libelle,
  montant,
}: {
  libelle: string;
  /** Déjà mis en forme — « 164,00 € ». C'est ce texte-là qui est copié. */
  montant: string;
}) {
  const [dit, setDit] = useState<string | null>(null);

  async function copier() {
    try {
      await navigator.clipboard.writeText(montant);
      setDit("copié");
    } catch {
      // Le presse-papier refuse hors page sécurisée, ou quand la permission a
      // été retirée. Le dire vaut mieux qu'un bouton qui ne répond pas.
      setDit("impossible");
    }
    setTimeout(() => setDit(null), 1600);
  }

  return (
    <div className="relative flex-1 px-2.5 pb-3.5 pt-[17px] text-center" style={{ backgroundColor: colors.card }}>
      <span
        className="mb-2 block text-[10px] uppercase tracking-[0.22em]"
        style={{ color: colors.muted }}
      >
        {libelle}
      </span>
      <span
        className="block text-[19.5px] font-semibold"
        style={{ fontFamily: font.display, color: colors.ink, fontVariantNumeric: "tabular-nums" }}
      >
        {montant}
      </span>
      <button
        type="button"
        onClick={copier}
        aria-label={`Copier la TVA ${libelle.toLowerCase()}`}
        className="mx-auto mt-[7px] flex h-[30px] w-[30px] items-center justify-center rounded-full"
        style={{ border: `1px solid ${colors.line}` }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="1.7" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2.4" />
          <path d="M15 5.6A2.6 2.6 0 0 0 12.4 3H6.6A2.6 2.6 0 0 0 4 5.6v5.8A2.6 2.6 0 0 0 6.6 14" strokeLinecap="round" />
        </svg>
      </button>
      {/* En surimpression et non dans le flux : une ligne qui apparaît
          pousserait la colonne voisine vers le bas à chaque copie. */}
      <span
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 bottom-1.5 text-[10px] uppercase tracking-[0.14em] transition-opacity"
        style={{ color: colors.rust, opacity: dit ? 1 : 0 }}
      >
        {dit ?? ""}
      </span>
    </div>
  );
}
