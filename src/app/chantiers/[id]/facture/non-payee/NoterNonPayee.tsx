"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors } from "@/lib/design-tokens";
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
      <div className="mt-6">
        <PrimaryButton pleineLargeur onClick={agir} disabled={enCours} repere="noter-non-payee">
          C&apos;est noté
        </PrimaryButton>
      </div>
    </>
  );
}
