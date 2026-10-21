"use client";

import { useState, useTransition } from "react";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, font, texteSituation } from "@/lib/design-tokens";
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Avant de partir"
      data-atlas="avant-de-partir"
      className="atlas-colonne-fixe inset-y-0 z-50 flex flex-col overflow-y-auto"
      style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}
    >
      <div className="flex-1 px-[26px] pt-[34px]">
        <h2 style={{ fontFamily: font.display, fontSize: 28, lineHeight: 1.15 }}>Avant de partir</h2>

        {moinsChere && actuelle && (
          <button
            type="button"
            onClick={() => agir(() => changerDeFormuleAction(moinsChere.code, periodicite))}
            disabled={enCours}
            data-atlas="passer-a-moins-chere"
            className="mt-6 flex w-full flex-col items-start rounded-[16px] px-[18px] py-4 text-left disabled:opacity-60"
            style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}` }}
          >
            <span className="text-[16px]">Passer à {moinsChere.nom}</span>
            <span className={`mt-0.5 ${texteSituation}`} style={{ color: colors.inkSoft }}>
              {montantDu(moinsChere, periodicite)} € HT {rythme}, au lieu de {montantDu(actuelle, periodicite)}
            </span>
          </button>
        )}

        <p className="mt-7 text-[15px]">
          Pourquoi partez-vous&nbsp;?{" "}
          <span className="text-[13px]" style={{ color: colors.inkSoft }}>
            Facultatif
          </span>
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {RAISONS_DEPART.map((r) => {
            const choisie = raison === r.code;
            return (
              <button
                key={r.code}
                type="button"
                aria-pressed={choisie}
                // Retoucher la même la retire : on peut partir sans répondre.
                onClick={() => setRaison(choisie ? null : r.code)}
                className="min-h-[44px] rounded-full px-[14px] text-[14px]"
                style={{
                  backgroundColor: choisie ? colors.ink : "transparent",
                  color: choisie ? colors.cream : colors.ink,
                  border: `1px solid ${choisie ? colors.ink : colors.line}`,
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
          className="mt-3 w-full resize-none rounded-[14px] px-4 py-3 text-[15px] leading-[1.45]"
          style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}`, color: colors.ink }}
        />

        {message && (
          <p className={`mt-4 ${texteSituation}`} style={{ color: colors.alert }} role="alert">
            {message}
          </p>
        )}
      </div>

      <div className="atlas-bas-sans-barre flex flex-col gap-1 px-[26px] pb-6 pt-3">
        <PrimaryButton
          secondaire
          pleineLargeur
          disabled={enCours}
          repere="resilier-quand-meme"
          onClick={() => agir(() => resilierAction(raison, texte))}
        >
          {enCours ? "Un instant…" : "Résilier quand même"}
        </PrimaryButton>
        <button
          type="button"
          onClick={fermer}
          disabled={enCours}
          className="min-h-[44px] w-full text-[14px] disabled:opacity-60"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
