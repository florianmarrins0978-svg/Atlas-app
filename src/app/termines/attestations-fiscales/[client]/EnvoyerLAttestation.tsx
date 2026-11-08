"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { transmettreLePdf } from "@/components/atlas/transmettre-le-pdf";
import { colors, surPlein } from "@/lib/design-tokens";
import { noterLEnvoiAction } from "../actions";

/**
 * « ENVOYER À MME VASSEUR » — une attestation, seule (sa demande du
 * 8 novembre 2026). Le PDF part par la feuille de partage du téléphone, comme
 * la fiche de sécurité : Atlas n'envoie rien lui-même, et l'attestation vit
 * derrière la connexion, son adresse n'ouvrirait rien chez le client
 * (`transmettre-le-pdf.ts`). La trace ne s'écrit qu'une fois la feuille
 * passée ; annulée, rien ne change.
 *
 * Partie, on revient à la liste, qui compte ce qui reste : c'est le geste de
 * sa planche.
 */
export default function EnvoyerLAttestation({
  annee,
  clientId,
  qui,
  adresseDuPdf,
  nomDuFichier,
  canal,
  renvoi,
}: {
  annee: number;
  clientId: string;
  /** « Mme Vasseur ». */
  qui: string;
  adresseDuPdf: string;
  nomDuFichier: string;
  /** Le canal de sa dernière facture partie, ou `null`. */
  canal: "sms" | "email" | null;
  /** Déjà partie, mais elle a changé depuis. */
  renvoi: boolean;
}) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  async function envoyer() {
    setEnvoi(true);
    setRefus(null);
    try {
      const partie = await transmettreLePdf(adresseDuPdf, nomDuFichier);
      if (!partie) return;
      const r = await noterLEnvoiAction(annee, clientId);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      router.push("/termines/attestations-fiscales");
    } catch {
      // Le PDF refusé ou injoignable : le dire, au même endroit que le refus.
      setRefus("Le PDF n'a pas pu se préparer. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="mt-5" data-atlas="envoyer-l-attestation">
      <button
        type="button"
        onClick={() => void envoyer()}
        disabled={envoi}
        className="flex min-h-[56px] w-full items-center justify-center rounded-full px-5 text-[17px] font-semibold disabled:opacity-45"
        style={{ backgroundColor: colors.plein, color: surPlein }}
      >
        {envoi ? "Un instant…" : `${renvoi ? "Renvoyer" : "Envoyer"} à ${qui}`}
      </button>
      {(refus || canal) && (
        <p className="mb-0 mt-2.5 text-center text-[14px] leading-[1.45]" style={{ color: refus ? colors.alert : colors.inkSoft }}>
          {refus ?? `Par ${canal === "sms" ? "SMS" : "e-mail"}, comme ses factures.`}
        </p>
      )}
      <Link
        href="/termines/attestations-fiscales"
        className="mx-auto mt-2 flex min-h-11 w-max items-center rounded-full px-4 text-[15px] no-underline"
        style={{ color: colors.inkSoft }}
      >
        Pas encore
      </Link>
    </div>
  );
}
