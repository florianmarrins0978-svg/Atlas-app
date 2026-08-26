"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import BottomSheet from "@/components/atlas/BottomSheet";

// Maquette isolée — n'affecte aucune route existante.
// Données entièrement simulées : aucun système de devis réel branché.

const DEMO = {
  chantier: "Rénovation salle de bain",
  adresse: "12 rue des Lilas, Nantes",
  client: "M. Bernard",
  telephone: "06 12 34 56 78",
  prestations: ["Dépose ancien carrelage", "Pose faïence murale", "Remplacement robinetterie"],
  total: "1 659,00 €",
};

export default function ExportMockup() {
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100dvh" }}>
      <div className="mx-auto max-w-md pb-16">
        <div className="px-6 pt-8">
          <a
            href="/design/hub"
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            {DEMO.chantier}
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Devis
          </h1>
        </div>

        <div className="mt-6 flex flex-col gap-4 px-6">
          <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
            <Row label="Chantier" value={`${DEMO.chantier} — ${DEMO.adresse}`} />
            <Row label="Client" value={`${DEMO.client} — ${DEMO.telephone}`} last />
          </div>

          <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
            <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
              Prestations
            </p>
            <ul className="flex flex-col gap-1.5">
              {DEMO.prestations.map((p) => (
                <li key={p} className="text-[15px]" style={{ color: colors.ink }}>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl px-5 py-5 text-center" style={{ backgroundColor: colors.card }}>
            <p className={smallCaps} style={{ color: colors.muted, marginBottom: 6 }}>
              Total
            </p>
            <p
              className="text-[32px] font-semibold leading-none"
              style={{ fontFamily: font.display, color: colors.rust }}
            >
              {DEMO.total}
            </p>
          </div>

          {envoye ? (
            <div className="rounded-2xl px-5 py-4 text-center" style={{ backgroundColor: colors.card }}>
              <p className="text-[14px]" style={{ color: colors.muted }}>
                Devis envoyé à {DEMO.client}.
              </p>
            </div>
          ) : (
            <PrimaryButton onClick={() => setConfirmationVisible(true)}>
              Envoyer vers le système de devis
            </PrimaryButton>
          )}
        </div>
      </div>

      <BottomSheet open={confirmationVisible} onBackdropClick={() => setConfirmationVisible(false)}>
        <p className="mb-1 text-center text-[16px]" style={{ color: colors.ink, fontFamily: font.display }}>
          Envoyer ce devis ?
        </p>
        <p className="mb-5 text-center text-[13px]" style={{ color: colors.muted }}>
          {DEMO.client} recevra ce devis pour {DEMO.total}.
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              setConfirmationVisible(false);
              setEnvoye(true);
            }}
            className="rounded-2xl py-3.5 text-[16px] font-medium text-white"
            style={{ backgroundColor: colors.rust }}
          >
            Envoyer
          </button>
          <button
            onClick={() => setConfirmationVisible(false)}
            className="rounded-2xl py-3.5 text-[15px] font-medium"
            style={{ color: colors.muted }}
          >
            Annuler
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={last ? "" : "mb-3 border-b pb-3"} style={{ borderColor: colors.line }}>
      <p className={smallCaps} style={{ color: colors.muted, marginBottom: 4 }}>
        {label}
      </p>
      <p className="text-[15px]" style={{ color: colors.ink }}>
        {value}
      </p>
    </div>
  );
}
