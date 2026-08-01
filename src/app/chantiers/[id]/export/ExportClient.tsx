"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import EnvoiAuClient from "./EnvoiAuClient";

const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ExportClient({
  chantierId,
  devisId,
  chantierNom,
  adresseChantier,
  clientNom,
  clientTelephone,
  prestations,
  totalTtc,
  initialEnvoye,
}: {
  chantierId: string;
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
  // Aucun fournisseur de SMS ni d'e-mail n'étant branché (docs/AGENT.md §5), le
  // lien est rendu au patron pour qu'il le transmette lui-même — ce qui vaut
  // mieux qu'un envoi qui échouerait en silence.
  const [lienClient, setLienClient] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  function lienComplet(chemin: string) {
    return typeof window === "undefined" ? chemin : `${window.location.origin}${chemin}`;
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

        {envoye || lienClient ? (
          <div className="rounded-2xl px-5 py-4" style={{ backgroundColor: colors.card }}>
            <p className="text-center text-[14px]" style={{ color: colors.muted }}>
              Devis prêt pour {clientNom}.
            </p>
            {lienClient && (
              <>
                <p className="mt-3 text-center text-[13px]" style={{ color: colors.ink }}>
                  Transmettez-lui ce lien : il y verra le devis et choisira sa date.
                </p>
                <p
                  className="mt-2 break-all rounded-xl px-3 py-2 text-center text-[12px]"
                  style={{ backgroundColor: colors.cream, color: colors.muted }}
                >
                  {lienComplet(lienClient)}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(lienComplet(lienClient));
                      setCopie(true);
                    } catch {
                      // Presse-papier refusé : le lien reste lisible et
                      // sélectionnable au-dessus, rien n'est perdu.
                    }
                  }}
                  className="mt-3 block w-full text-center text-[14px] font-medium"
                  style={{ color: colors.rust }}
                >
                  {copie ? "Lien copié" : "Copier le lien"}
                </button>
              </>
            )}
          </div>
        ) : (
          <PrimaryButton onClick={() => setConfirmationVisible(true)}>
            Envoyer au client →
          </PrimaryButton>
        )}
      </div>

      <EnvoiAuClient
        chantierId={chantierId}
        devisId={devisId}
        clientNom={clientNom}
        ouvert={confirmationVisible}
        onFermer={() => setConfirmationVisible(false)}
        onEnvoye={(lien) => {
          setConfirmationVisible(false);
          setEnvoye(true);
          setLienClient(lien);
        }}
      />
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
