"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import type { ChoixDeFacture } from "@/lib/virement-en-mots";
import {
  confirmerVirementAction,
  defaireVirementAction,
  ecarterVirementAction,
} from "./reponses-virements";

/**
 * LA RÉPONSE À UN VIREMENT REÇU — la même sur l'accueil et dans Ma TVA.
 *
 * Ses choix du 23 octobre 2026 (`appli/banque-numero-et-termines.html`,
 * variante A) : « Oui » ou « Non », et quand deux factures font le montant,
 * la liste des deux. Après la réponse, ce qui s'est passé s'écrit, avec
 * « Annuler » : une erreur de doigt se rattrape (sa règle du 5 septembre).
 *
 * **`relire`** : Ma TVA se relit après la réponse, pour que la facture quitte
 * l'attente et que le relevé bouge. L'accueil, lui, garde la phrase sous les
 * yeux ; sa relecture habituelle (`VeilleDesNouvelles`) range la carte ensuite.
 */
export default function ReponseVirement({
  virementId,
  question,
  oui,
  choix,
  relire = false,
}: {
  virementId: string;
  question: string;
  oui: string;
  /** Une facture : « Oui » / « Non ». Plusieurs : la liste, puis « Aucune ». */
  choix: ChoixDeFacture[];
  relire?: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [fait, setFait] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  function jouer(geste: () => Promise<{ ok: true; fait: string } | { ok: false; raison: string }>) {
    setRefus(null);
    demarrer(async () => {
      const r = await geste();
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      setFait(r.fait || null);
      if (relire) router.refresh();
    });
  }

  if (fait) {
    return (
      <div data-atlas="virement-repondu">
        <p className="mt-2.5 text-[13.5px] leading-[1.5]" style={{ color: colors.carteVertTexte }}>
          {fait}
        </p>
        <div className="-mx-2 mt-1 flex items-center">
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              jouer(async () => {
                const r = await defaireVirementAction(virementId);
                if (r.ok) setFait(null);
                return r.ok ? { ok: true, fait: "" } : r;
              })
            }
            className="min-h-[44px] px-2 text-[14px] font-medium disabled:opacity-60"
            style={{ color: colors.inkSoft }}
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  const plusieurs = choix.length > 1;
  return (
    <div data-atlas="question-virement">
      <p className="mt-2.5 text-[14.5px] leading-[1.45]" style={{ color: colors.ink }}>
        {question}
      </p>
      {plusieurs && (
        <div className="mt-2.5 flex flex-col overflow-hidden rounded-[12px]" style={{ gap: 1, backgroundColor: colors.lineSoft }}>
          {choix.map((c) => (
            <button
              key={c.factureId}
              type="button"
              disabled={enCours}
              onClick={() => jouer(() => confirmerVirementAction(virementId, c.factureId))}
              className="flex min-h-[50px] items-baseline justify-between gap-3 px-3.5 py-3 text-left disabled:opacity-60"
              style={{ backgroundColor: colors.cream, color: colors.ink }}
            >
              <span className="min-w-0">
                <span className="block text-[14.5px]">{c.client ?? c.numero}</span>
                <span className="block text-[11.5px]" style={{ color: colors.muted }}>
                  {c.numero}
                </span>
              </span>
              <span className="flex-none text-[15.5px] tabular-nums" style={{ fontFamily: font.display }}>
                {c.reste}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!plusieurs && (
          <button
            type="button"
            data-atlas="oui-virement"
            disabled={enCours}
            onClick={() => jouer(() => confirmerVirementAction(virementId, choix[0].factureId))}
            className="atlas-plein min-h-[44px] rounded-full px-5 py-2.5 text-[14px] font-medium disabled:opacity-60"
            style={{ backgroundColor: colors.plein, color: colors.card }}
          >
            {oui}
          </button>
        )}
        <button
          type="button"
          data-atlas="non-virement"
          disabled={enCours}
          onClick={() => jouer(() => ecarterVirementAction(virementId))}
          className={`min-h-[44px] text-[14px] font-medium disabled:opacity-60 ${plusieurs ? "-mx-2 px-2" : "px-2"}`}
          style={{ color: colors.inkSoft }}
        >
          {plusieurs ? (choix.length === 2 ? "Aucune des deux" : "Aucune") : "Non"}
        </button>
      </div>
      {refus && (
        <p role="alert" className="mt-2 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
          {refus}
        </p>
      )}
    </div>
  );
}
