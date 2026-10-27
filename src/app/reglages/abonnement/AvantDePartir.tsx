"use client";

import { useState, useTransition } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import { colors, font, voile } from "@/lib/design-tokens";
import { formule, montantDu, type FormuleCode, type Periodicite } from "@/lib/abonnements";
import { RAISONS_DEPART, TEXTE_DEPART_MAX, formuleMoinsChere, type RaisonDepart } from "@/lib/resiliation";
import { changerDeFormuleAction, resilierAction } from "./actions";

/**
 * « AVANT DE PARTIR » — planche du 18 octobre 2026
 * (`appli/documents-legaux-un-geste.html`, téléphone 4).
 *
 * Sa crainte : *« une résiliation trop facile fait partir les gens »*. La
 * réponse retenue n'est pas un barrage (opposition bancaire, réputation) : une
 * formule moins chère proposée d'abord, et une question facultative dont la
 * réponse lui revient, chez le prestataire. Un seul écran, puis c'est fait.
 *
 * **La formule moins chère change tout de suite, au prorata** : c'est le seul
 * changement de formule qu'Atlas sache faire (`changerLaFormule`, article
 * 14.6). La planche la montrait « à partir de l'échéance » ; cela demanderait
 * un calendrier chez le prestataire que le dépôt n'a pas.
 */
export default function AvantDePartir({
  formuleActuelle,
  periodicite,
  fermer,
}: {
  formuleActuelle: FormuleCode;
  periodicite: Periodicite;
  fermer: () => void;
}) {
  const [raison, setRaison] = useState<RaisonDepart | null>(null);
  const [texte, setTexte] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const moinsChere = formuleMoinsChere(formuleActuelle);
  const actuelle = formule(formuleActuelle);
  const rythme = periodicite === "annuelle" ? "par an" : "par mois";

  function agir(geste: () => Promise<{ ok: true; url?: string } | { ok: false; message: string }>) {
    setMessage(null);
    demarrer(async () => {
      const r = await geste();
      if (!r.ok) setMessage(r.message);
      else window.location.reload();
    });
  }

  return (
    // **Une feuille qui monte du bas** (planche des Réglages soignés, 26 octobre
    // 2026), et non plus un écran entier : on voit encore d'où l'on vient, et
    // la poignée la referme comme « Annuler ».
    <BottomSheet open onBackdropClick={enCours ? undefined : fermer}>
      <div role="dialog" aria-modal="true" aria-label="Avant de partir" data-atlas="avant-de-partir">
        <h2 className="mb-4 mt-1.5 text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>
          Avant de partir
        </h2>

        {moinsChere && actuelle && (
          <button
            type="button"
            onClick={() => agir(() => changerDeFormuleAction(moinsChere.code, periodicite))}
            disabled={enCours}
            data-atlas="passer-a-moins-chere"
            className="mb-1 block w-full rounded-[6px] px-[18px] py-4 text-left disabled:opacity-60"
            style={{ backgroundColor: colors.carteVertFond }}
          >
            <span className="flex items-center gap-2 text-[15px] font-bold" style={{ color: colors.carteVertTexte }}>
              <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: "currentColor" }} />
              Passer à {moinsChere.nom}
            </span>
            <span className="mt-1.5 block text-[17px] leading-[1.3]" style={{ fontFamily: font.display, color: colors.ink }}>
              {montantDu(moinsChere, periodicite)} € HT {rythme}, au lieu de {montantDu(actuelle, periodicite)}
            </span>
          </button>
        )}

        <p className="mb-2.5 mt-[22px] text-[16px]" style={{ color: colors.ink }}>
          Pourquoi partez-vous&nbsp;?
          <span className="ml-1.5 text-[14px]" style={{ color: colors.inkSoft }}>
            Facultatif
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {RAISONS_DEPART.map((r) => {
            const choisie = raison === r.code;
            return (
              <button
                key={r.code}
                type="button"
                aria-pressed={choisie}
                // Retoucher la même la retire : on peut partir sans répondre.
                onClick={() => setRaison(choisie ? null : r.code)}
                className="min-h-[44px] rounded-full px-4 text-[15px]"
                style={{
                  backgroundColor: choisie ? colors.ink : "transparent",
                  color: choisie ? colors.cream : colors.ink,
                  boxShadow: choisie ? "none" : `inset 0 0 0 1px ${colors.line}`,
                }}
              >
                {r.libelle}
              </button>
            );
          })}
        </div>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={TEXTE_DEPART_MAX}
          rows={3}
          placeholder="Dites-nous en plus"
          aria-label="Dites-nous en plus"
          className="mt-4 min-h-[96px] w-full resize-none rounded-[6px] px-[15px] py-3.5 text-[16px] leading-[1.4]"
          style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` }}
        />

        {message && (
          <div className="mt-4" role="alert">
            <PlageTon ton="rouge">{message}</PlageTon>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {/* **Cerné de rouge** : partir reste possible en un geste, mais il se
              lit pour ce qu'il est, une perte. */}
          <button
            type="button"
            disabled={enCours}
            data-atlas="resilier-quand-meme"
            onClick={() => agir(() => resilierAction(raison, texte))}
            className="min-h-[56px] w-full rounded-full px-[22px] text-[17px] font-semibold disabled:opacity-60"
            style={{ color: colors.alert, boxShadow: `inset 0 0 0 1.5px ${voile(colors.alert, 0.6)}` }}
          >
            {enCours ? "Un instant…" : "Résilier quand même"}
          </button>
          <button
            type="button"
            onClick={fermer}
            disabled={enCours}
            className="min-h-[48px] w-full text-[16px] font-semibold disabled:opacity-60"
            style={{ color: colors.inkSoft }}
          >
            Annuler
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
