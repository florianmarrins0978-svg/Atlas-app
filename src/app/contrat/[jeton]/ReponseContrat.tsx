"use client";

import { useActionState } from "react";
import { couleursDocument } from "@/lib/design-tokens";
import { repondreContratAction, type EtatReponseContrat } from "./actions";

/**
 * Les deux réponses du client. **Accepter est le geste principal**, en plein ;
 * refuser reste à portée, sans le mettre au même rang. Une réponse donnée se
 * montre à la place des boutons : on ne répond qu'une fois (le dépôt le tient).
 */
export default function ReponseContrat({ jeton, dejaRepondu }: { jeton: string; dejaRepondu: string | null }) {
  const [etat, repondre, enCours] = useActionState<EtatReponseContrat, FormData>(repondreContratAction, undefined);

  const fait = dejaRepondu ?? (etat && "succes" in etat ? etat.succes : null);
  if (fait) {
    return (
      <p className="mt-6 rounded-xl bg-[#F4EFE8] p-4 text-center text-[15px]" style={{ color: couleursDocument.encre }} data-atlas="reponse-contrat-faite">
        {fait}
      </p>
    );
  }

  return (
    <form action={repondre} className="mt-6">
      <input type="hidden" name="jeton" value={jeton} />
      <button
        type="submit"
        name="decision"
        value="accepte"
        disabled={enCours}
        className="block min-h-[52px] w-full rounded-full text-[17px] text-white disabled:opacity-60"
        style={{ backgroundColor: "#7d9a6d", fontFamily: "ui-serif, Georgia, serif" }}
        data-atlas="accepter-contrat"
      >
        J&apos;accepte le contrat
      </button>
      <button
        type="submit"
        name="decision"
        value="refuse"
        disabled={enCours}
        className="mt-3 block w-full py-2 text-[14px] underline disabled:opacity-60"
        style={{ color: couleursDocument.etiquette }}
      >
        Je refuse
      </button>
      {etat && "erreur" in etat && (
        <p className="mt-3 text-center text-[13px]" style={{ color: "#9C3B2E" }}>
          {etat.erreur}
        </p>
      )}
    </form>
  );
}
