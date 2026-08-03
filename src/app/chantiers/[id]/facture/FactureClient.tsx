"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps, couleursDocument } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { jourLisible } from "@/lib/jour";
import { terminerChantierAction, emettreFactureAction } from "./actions";

// Arrêt 3 (docs/AGENT.md §2.3). Cet écran EST le contrôle : les montants du
// devis sont déjà là, il n'y a rien à saisir. Franchissable en un geste quand
// rien n'a bougé — mais franchi par le patron, jamais par l'application.

const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type FacturePourEcran = {
  id: string;
  numeroCommercial: string;
  statut: "brouillon" | "emise";
  clientNom: string | null;
  dateEcheance: string | null;
  tauxTva: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  lignes: { id: string; libelle: string; montant: string }[];
};

export default function FactureClient({
  chantierId,
  initialFacture,
}: {
  chantierId: string;
  initialFacture: FacturePourEcran | null;
}) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [emise, setEmise] = useState(initialFacture?.statut === "emise");

  async function terminer() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await terminerChantierAction(chantierId);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      // La facture vient d'être bâtie côté serveur : on relit l'écran plutôt
      // que d'en reconstruire une copie ici, qui pourrait s'en écarter.
      router.refresh();
    } catch {
      setErreur("La facture n'a pas pu être préparée.");
    } finally {
      setEnCours(false);
    }
  }

  async function confirmer() {
    if (!initialFacture) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await emettreFactureAction(initialFacture.id);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      setEmise(true);
    } catch {
      setErreur("La facture n'a pas pu être émise.");
    } finally {
      setEnCours(false);
    }
  }

  if (!initialFacture) {
    return (
      <div className="mt-6 flex flex-col gap-4 px-6">
        <div className="rounded-2xl px-5 py-6" style={{ backgroundColor: colors.card }}>
          <p className="text-center text-[15px]" style={{ color: colors.ink }}>
            Le chantier est réalisé ?
          </p>
          <p className="mt-2 text-center text-[13px]" style={{ color: colors.muted }}>
            La facture sera préparée à partir du devis. Rien ne part avant votre
            confirmation.
          </p>
        </div>
        {erreur && (
          <p role="alert" className="text-center text-[13px]" style={{ color: colors.alert }}>
            {erreur}
          </p>
        )}
        <PrimaryButton disabled={enCours} onClick={terminer}>
          {enCours ? "Préparation…" : "Fin de chantier →"}
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4 px-6">
      <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
        <p className={smallCaps} style={{ color: colors.muted, marginBottom: 4 }}>
          Facture
        </p>
        <p className="text-[15px]" style={{ color: colors.ink }}>
          {initialFacture.numeroCommercial} — {initialFacture.clientNom ?? "Client non renseigné"}
        </p>
        {initialFacture.dateEcheance && (
          <p className="mt-1 text-[13px]" style={{ color: colors.muted }}>
            À régler avant le {jourLisible(initialFacture.dateEcheance)}
          </p>
        )}
      </div>

      {initialFacture.lignes.length > 0 && (
        <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
            Reprise du devis
          </p>
          <ul className="flex flex-col gap-2">
            {initialFacture.lignes.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-4 text-[15px]">
                <span className="min-w-0 truncate" style={{ color: colors.ink }}>
                  {l.libelle}
                </span>
                <span className="flex-shrink-0" style={{ color: colors.muted }}>
                  {formatEuros.format(Number(l.montant))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
        <Ligne label="Total HT" valeur={initialFacture.totalHt} />
        <Ligne label={`TVA ${Number(initialFacture.tauxTva)} %`} valeur={initialFacture.totalTva} />
        <div className="mt-3 border-t pt-3 text-center" style={{ borderColor: colors.line }}>
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 6 }}>
            Total TTC
          </p>
          <p
            className="text-[32px] font-semibold leading-none"
            // Le montant que le client verra sur sa facture porte la teinte
            // des documents, pas l'accent de l'application : le patron a
            // demandé « terre cuite pour le devis, idem pour la facture ».
            style={{ fontFamily: font.display, color: couleursDocument.accent }}
          >
            {formatEuros.format(Number(initialFacture.totalTtc))}
          </p>
        </div>

        {/* Sans ce lien, la facture existe sans que personne puisse la
            regarder : le patron valide un montant sans avoir vu la pièce que
            son client recevra. C'est justement ce que l'arrêt 3 lui demande de
            vérifier (docs/AGENT.md §2.3). */}
        <a
          href={`/api/factures/${initialFacture.id}/pdf`}
          target="_blank"
          rel="noopener"
          className="mt-4 block text-center text-[14px] font-medium"
          style={{ color: colors.rust }}
        >
          Voir la facture en PDF →
        </a>
      </div>

      {erreur && (
        <p role="alert" className="text-center text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {emise ? (
        <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
          <p className="text-center text-[15px]" style={{ color: colors.ink }}>
            Facture {initialFacture.numeroCommercial} arrêtée.
          </p>
          <p className="mt-2 text-center text-[13px]" style={{ color: colors.muted }}>
            Elle figure au relevé de TVA collectée et ne peut plus être modifiée
            — une correction passerait par un avoir.
          </p>
        </div>
      ) : (
        <>
          <p className="text-center text-[14px]" style={{ color: colors.muted }}>
            Rien n&apos;a changé depuis le devis ?
          </p>
          <PrimaryButton disabled={enCours} onClick={confirmer}>
            {enCours ? "Émission…" : "Confirmer le départ de la facture →"}
          </PrimaryButton>
        </>
      )}
    </div>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between text-[15px]">
      <span style={{ color: colors.muted }}>{label}</span>
      <span style={{ color: colors.ink }}>{formatEuros.format(Number(valeur))}</span>
    </div>
  );
}
