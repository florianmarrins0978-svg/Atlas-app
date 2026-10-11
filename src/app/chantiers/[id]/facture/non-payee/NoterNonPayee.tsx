"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { declarerNonPayeeAction } from "../actions";

/**
 * « C'est noté » : range la facture dans les non payées, dit le refus s'il y en
 * a un (déjà réglée), et ramène à Terminés, où la catégorie vient d'apparaître.
 */
export default function NoterNonPayee({ factureId }: { factureId: string }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  async function agir() {
    setEnCours(true);
    setErreur(null);
    const r = await declarerNonPayeeAction(factureId);
    if (!r.succes) {
      setErreur(r.erreur);
      setEnCours(false);
      return;
    }
    router.push("/termines");
  }
  return (
    <>
      {erreur && (
        <p className="mt-3 text-center text-[13.5px]" style={{ color: colors.alert }} role="alert">
          {erreur}
        </p>
      )}
      <button
        type="button"
        onClick={agir}
        disabled={enCours}
        className="atlas-plein mx-auto mt-6 flex min-h-[56px] w-[78%] items-center justify-center rounded-full disabled:opacity-40"
        style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display, fontSize: 22 }}
        data-atlas="noter-non-payee"
      >
        C&apos;est noté
      </button>
    </>
  );
}
