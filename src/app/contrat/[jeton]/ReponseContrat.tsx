"use client";

import { useActionState, useState } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import type React from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { repondreContratAction, type EtatReponseContrat } from "./actions";

/**
 * Les deux réponses du client. Une réponse donnée remplace la page : on ne
 * répond qu'une fois (le dépôt le tient).
 *
 * **Les boutons du devis, refus compris — sa demande du 3 octobre 2026** :
 * *« mets les mêmes boutons que pour le devis, même pour refuser »*. Accepter
 * en plein ; ne pas donner suite en capsule, et **jamais d'un seul appui** : le
 * bouton ouvre la feuille de confirmation, comme sur le devis (sa sécurité du
 * 20 septembre, `src/app/devis/[jeton]/formulaire.tsx`). Le « Je refuse »
 * souligné partait au premier doigt posé dessus, et ne se reprenait plus.
 */
export default function ReponseContrat({
  jeton,
  retourAccepte,
  retourRefuse,
  children,
}: {
  jeton: string;
  /** L'écran qui remplace la page une fois le contrat accepté. */
  retourAccepte: React.ReactNode;
  retourRefuse: React.ReactNode;
  /** Ce que le client lit avant de répondre. */
  children: React.ReactNode;
}) {
  const [etat, repondre, enCours] = useActionState<EtatReponseContrat, FormData>(repondreContratAction, undefined);
  const [confirmationRefus, setConfirmationRefus] = useState(false);

  /* **La réponse donnée REMPLACE la page** — sa planche du 31 octobre 2026 :
     le même écran que le client retrouvera en rouvrant son lien (`page.tsx`),
     et non plus une ligne posée sous des boutons qui ne servent plus. */
  if (etat && "succes" in etat) return etat.succes === "accepte" ? retourAccepte : retourRefuse;

  return (
    <div className="min-h-dvh px-[18px] pt-4 pb-8" style={{ backgroundColor: colors.cream, color: colors.ink }} data-atlas="page-contrat-client">
      <div className="mx-auto w-full max-w-md">
        {children}
        <form action={repondre} className="mt-4">
          <input type="hidden" name="jeton" value={jeton} />
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              name="decision"
              value="accepte"
              disabled={enCours}
              className="atlas-plein min-h-14 rounded-full text-[19px] disabled:opacity-50"
              style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
              data-atlas="accepter-contrat"
            >
              {enCours ? "Envoi…" : "J'accepte le contrat"}
            </button>
            <button
              type="button"
              data-atlas="ne-pas-donner-suite"
              disabled={enCours}
              onClick={() => setConfirmationRefus(true)}
              className="min-h-14 rounded-full text-[16px] font-medium disabled:opacity-50"
              style={{ color: colors.inkSoft, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
            >
              Je ne donne pas suite
            </button>
          </div>
          {etat && "erreur" in etat && (
            <p role="alert" className="mt-3 text-center text-[14px] font-semibold" style={{ color: colors.alert }}>
              {etat.erreur}
            </p>
          )}

          {/* Dans le formulaire, pour que son bouton soit un vrai `submit` :
              `BottomSheet` se pose en `fixed` là où il est écrit. */}
          <BottomSheet open={confirmationRefus} onBackdropClick={() => setConfirmationRefus(false)}>
            <div className="text-center">
              <h2 className="text-[26px] leading-tight" style={{ fontFamily: font.display, color: colors.ink }}>
                Vous ne donnez pas suite&nbsp;?
              </h2>
              <p className="mt-1.5 text-[15px]" style={{ color: colors.inkSoft }}>
                Votre artisan en sera prévenu.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="submit"
                name="decision"
                value="refuse"
                disabled={enCours}
                className="min-h-[52px] rounded-full text-[15px] font-medium disabled:opacity-50"
                style={{ color: colors.inkSoft, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
                data-atlas="refuser-contrat"
              >
                {enCours ? "Envoi…" : "Oui, je ne donne pas suite"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmationRefus(false)}
                className="min-h-[52px] rounded-full text-[16px] font-semibold"
                style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${voile(colors.ink, 0.45)}` }}
              >
                Revenir au contrat
              </button>
            </div>
          </BottomSheet>
        </form>
      </div>
    </div>
  );
}
