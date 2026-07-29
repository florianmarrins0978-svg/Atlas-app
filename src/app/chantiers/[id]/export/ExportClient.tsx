"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import BottomSheet from "@/components/atlas/BottomSheet";
import { envoyerDevisAction } from "./actions";

const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ExportClient({
  devisId,
  chantierNom,
  adresseChantier,
  clientNom,
  clientTelephone,
  prestations,
  totalTtc,
  initialEnvoye,
}: {
  devisId: string;
  chantierNom: string;
  adresseChantier: string;
  clientNom: string;
  clientTelephone: string;
  prestations: string[];
  totalTtc: string;
  initialEnvoye: boolean;
}) {
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [envoye, setEnvoye] = useState(initialEnvoye);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function confirmerEnvoi() {
    setEnvoiEnCours(true);
    try {
      await envoyerDevisAction(devisId);
      setConfirmationVisible(false);
      setEnvoye(true);
    } catch {
      setConfirmationVisible(false);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 px-6">
        {/* Synthèse — lecture seule, aucune édition sur cet écran */}
        <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
          <Row label="Chantier" value={`${chantierNom} — ${adresseChantier}`} />
          <Row label="Client" value={`${clientNom} — ${clientTelephone}`} last />
        </div>

        {prestations.length > 0 && (
          <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
            <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
              Prestations
            </p>
            <ul className="flex flex-col gap-1.5">
              {prestations.map((p, i) => (
                <li key={i} className="text-[15px]" style={{ color: colors.ink }}>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl px-5 py-5 text-center" style={{ backgroundColor: colors.card }}>
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 6 }}>
            Total
          </p>
          <p className="text-[32px] font-semibold leading-none" style={{ fontFamily: font.display, color: colors.rust }}>
            {formatEuros.format(Number(totalTtc))}
          </p>
        </div>

        <a
          href={`/api/devis/${devisId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[14px] font-medium"
          style={{ color: colors.rust }}
        >
          {envoye ? "Télécharger le PDF" : "Aperçu du PDF"}
        </a>

        {envoye ? (
          <div className="rounded-2xl px-5 py-4 text-center" style={{ backgroundColor: colors.card }}>
            <p className="text-[14px]" style={{ color: colors.muted }}>
              Devis envoyé à {clientNom}.
            </p>
          </div>
        ) : (
          <PrimaryButton onClick={() => setConfirmationVisible(true)}>
            Envoyer vers le système de devis →
          </PrimaryButton>
        )}
      </div>

      {/* Confirmation d'action positive (patron n°2) : action principale = bouton fort, Annuler discret */}
      <BottomSheet open={confirmationVisible} onBackdropClick={() => setConfirmationVisible(false)}>
        <p className="mb-1 text-center text-[16px]" style={{ color: colors.ink, fontFamily: font.display }}>
          Envoyer ce devis ?
        </p>
        <p className="mb-5 text-center text-[13px]" style={{ color: colors.muted }}>
          {clientNom} recevra ce devis pour {formatEuros.format(Number(totalTtc))}.
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={confirmerEnvoi}
            disabled={envoiEnCours}
            className="rounded-2xl py-3.5 text-[16px] font-medium text-white"
            style={{ backgroundColor: colors.rust }}
          >
            {envoiEnCours ? "Envoi…" : "Envoyer"}
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
    </>
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
