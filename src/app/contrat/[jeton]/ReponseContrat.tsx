"use client";

import { useActionState, useState } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, couleursDocument, font, voile } from "@/lib/design-tokens";
import { repondreContratAction, type EtatReponseContrat } from "./actions";

/**
 * Les deux réponses du client. Une réponse donnée se montre à la place des
 * boutons : on ne répond qu'une fois (le dépôt le tient).
 *
 * **Les boutons du devis, refus compris — sa demande du 3 octobre 2026** :
 * *« mets les mêmes boutons que pour le devis, même pour refuser »*. Accepter
 * en plein ; ne pas donner suite en capsule, et **jamais d'un seul appui** : le
 * bouton ouvre la feuille de confirmation, comme sur le devis (sa sécurité du
 * 20 septembre, `src/app/devis/[jeton]/formulaire.tsx`). Le « Je refuse »
 * souligné partait au premier doigt posé dessus, et ne se reprenait plus.
 */
export default function ReponseContrat({ jeton, dejaRepondu }: { jeton: string; dejaRepondu: string | null }) {
  const [etat, repondre, enCours] = useActionState<EtatReponseContrat, FormData>(repondreContratAction, undefined);
  const [confirmationRefus, setConfirmationRefus] = useState(false);

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
      <div className="flex flex-col gap-1.5">
        <button
          type="submit"
          name="decision"
          value="accepte"
          disabled={enCours}
          className="atlas-plein rounded-full py-3 text-[17px] disabled:opacity-50"
          style={{ backgroundColor: colors.plein, color: colors.card, fontFamily: font.display }}
          data-atlas="accepter-contrat"
        >
          {enCours ? "Envoi…" : "J'accepte le contrat"}
        </button>
        <button
          type="button"
          data-atlas="ne-pas-donner-suite"
          disabled={enCours}
          onClick={() => setConfirmationRefus(true)}
          className="rounded-full py-2.5 text-[14px] disabled:opacity-50"
          style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        >
          Je ne donne pas suite
        </button>
      </div>
      {etat && "erreur" in etat && (
        <p role="alert" className="mt-3 text-center text-[14px]" style={{ color: colors.alert }}>
          {etat.erreur}
        </p>
      )}

      {/* Dans le formulaire, pour que son bouton soit un vrai `submit` :
          `BottomSheet` se pose en `fixed` là où il est écrit. */}
      <BottomSheet open={confirmationRefus} onBackdropClick={() => setConfirmationRefus(false)}>
        <h2 className="text-center text-[17px]" style={{ fontFamily: font.display, color: colors.ink }}>
          Vous ne donnez pas suite&nbsp;?
        </h2>
        <p className="mt-1.5 text-center text-[14px]" style={{ color: colors.muted }}>
          Votre artisan en sera prévenu.
        </p>
        <div className="mt-4 flex flex-col gap-1.5">
          <button
            type="submit"
            name="decision"
            value="refuse"
            disabled={enCours}
            className="rounded-full py-2.5 text-[14px] disabled:opacity-50"
            style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            data-atlas="refuser-contrat"
          >
            {enCours ? "Envoi…" : "Oui, je ne donne pas suite"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmationRefus(false)}
            className="rounded-full py-2.5 text-[15px] font-semibold"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1px ${voile(colors.ink, 0.45)}` }}
          >
            Revenir au contrat
          </button>
        </div>
      </BottomSheet>
    </form>
  );
}
