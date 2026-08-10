"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps, couleursDocument } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { jourLisible } from "@/lib/jour";
import { composerMessageFacture, lienTransmission, type CanalClient } from "@/lib/message-client";
import { marquerDepartMessagerie, useRetourDeMessagerie } from "@/lib/depart-messagerie";
import { terminerChantierAction, emettreFactureAction, preparerLienFactureAction } from "./actions";

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
  origine,
  entrepriseNom,
  clientTelephone,
  clientEmail,
  canalClient,
}: {
  chantierId: string;
  initialFacture: FacturePourEcran | null;
  /** Adresse complète du site, bâtie côté serveur : un chemin seul ne s'ouvre nulle part. */
  origine: string;
  entrepriseNom: string;
  clientTelephone: string | null;
  clientEmail: string | null;
  canalClient: CanalClient | null;
}) {
  const router = useRouter();
  useRetourDeMessagerie();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [emise, setEmise] = useState(initialFacture?.statut === "emise");
  const [jetonFacture, setJetonFacture] = useState<string | null>(null);

  // Le canal convenu avec le client ; à défaut, celui dont on a la coordonnée.
  // Jamais deviné au hasard : sans coordonnée, le bouton s'ouvrirait sur un
  // destinataire vide et le patron enverrait dans le vide sans le voir.
  const canal: CanalClient = canalClient ?? (clientTelephone ? "sms" : "email");
  const destinataire = canal === "sms" ? clientTelephone : clientEmail;

  const lienFacture = jetonFacture ? `${origine}/factures/${jetonFacture}` : null;
  const adresseMessagerie = lienFacture
    ? lienTransmission({
        canal,
        destinataire,
        message: composerMessageFacture({
          clientNom: initialFacture?.clientNom ?? "",
          entrepriseNom,
          numeroFacture: initialFacture?.numeroCommercial ?? "",
          echeanceLisible: initialFacture?.dateEcheance ? jourLisible(initialFacture.dateEcheance) : null,
          lien: lienFacture,
        }),
      })
    : "";

  async function preparerLien() {
    if (!initialFacture) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await preparerLienFactureAction(initialFacture.id, canal);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      setJetonFacture(r.jeton);
    } catch {
      setErreur("Le lien de la facture n'a pas pu être préparé.");
    } finally {
      setEnCours(false);
    }
  }

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
        <div className="rounded-[4px] px-5 py-6" style={{ backgroundColor: colors.card }}>
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
          {enCours ? "Préparation…" : "Créer la facture →"}
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4 px-6">
      <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
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
        <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
            Reprise du devis
          </p>
          <ul className="flex flex-col gap-2">
            {initialFacture.lignes.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-4 text-[15px]">
                {/* **Les travaux réunis s'empilent, un par ligne.** Depuis que
                    le devis sépare ses prestations par un retour à la ligne
                    (7 août, `src/lib/lignes-vendables.ts`), un `truncate`
                    affichait « Abattage d'un chêne mort Br… » : les lignes
                    fondues en une seule, puis coupées. Et c'est à cet écran-là
                    que le patron est censé vérifier avant que la facture parte
                    (arrêt 3) — lui cacher la moitié de ce qu'il facture est
                    exactement ce qu'il ne faut pas faire. Le PDF du client,
                    lui, a toujours respecté les retours à la ligne. */}
                <span className="min-w-0 whitespace-pre-line break-words" style={{ color: colors.ink }}>
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

      <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
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
        <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
          <p className="text-center text-[15px]" style={{ color: colors.ink }}>
            Facture {initialFacture.numeroCommercial} arrêtée.
          </p>
          <p className="mt-2 text-center text-[13px]" style={{ color: colors.muted }}>
            Elle figure au relevé de TVA collectée et ne peut plus être modifiée
            — une correction passerait par un avoir.
          </p>

          {/* **« Arrêtée » n'est pas « partie ».**
              Le patron a lu « facture arrêtée » et compris que son client
              l'avait reçue. Rien ne la portait jusqu'à lui. Ce qui suit est le
              seul départ réel : Atlas prépare le message, le patron l'expédie
              depuis sa propre messagerie (`docs/A-FAIRE.md` §5). */}
          <div className="mt-5" style={{ borderTop: `1px solid ${colors.lineSoft}`, paddingTop: 16 }}>
            {lienFacture ? (
              <>
                {/* Même geste que pour le devis : on retient le départ vers la
                    messagerie, et le retour ramène à l'accueil avec un mot
                    (`src/lib/annonce-transmission.ts`). La phrase diffère —
                    une facture n'attend pas de réponse. */}
                <a
                  href={adresseMessagerie}
                  onClick={() => marquerDepartMessagerie("facture", initialFacture.clientNom ?? "")}
                  className="block rounded-[4px] py-3 text-center text-[15px] font-medium"
                  style={{ backgroundColor: colors.rust, color: colors.cream }}
                >
                  Ouvrir le {canal === "sms" ? "SMS" : "e-mail"} tout prêt →
                </a>
                <p className="mt-3 break-all text-center text-[12px]" style={{ color: colors.muted }}>
                  {lienFacture}
                </p>
                <p className="mt-2 text-center text-[12px]" style={{ color: colors.muted }}>
                  Le message s&apos;ouvre dans votre messagerie. Rien ne part tant que vous ne l&apos;envoyez pas.
                </p>
              </>
            ) : (
              <>
                <p className="mb-3 text-center text-[13px]" style={{ color: colors.muted }}>
                  Votre client ne l&apos;a pas encore reçue.
                </p>
                <PrimaryButton disabled={enCours} onClick={preparerLien}>
                  {enCours ? "Préparation…" : "Envoyer la facture au client →"}
                </PrimaryButton>
              </>
            )}
          </div>
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
