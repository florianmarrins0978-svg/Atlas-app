"use client";

import { colors } from "@/lib/design-tokens";

/**
 * LE GESTE PRINCIPAL, TOUJOURS SOUS LE POUCE — sa planche soignée du
 * 26 octobre 2026 (« code ça ») : Faire le plan pendant qu'il vérifie le
 * dessin, Envoyer la liste au fournisseur une fois le plan fait. Collé
 * au-dessus de la barre du bas, comme `BarreEnregistrer`, pour ne plus avoir
 * à descendre au bout d'une page de plusieurs écrans.
 */
export default function ActionDuBas({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-atlas="action-du-bas"
      className="atlas-colonne-fixe z-10 px-[22px] pb-3 pt-3"
      style={{ bottom: "var(--atlas-barre)", backgroundColor: colors.cream, boxShadow: `0 -1px 0 ${colors.line}` }}
    >
      {children}
    </div>
  );
}
