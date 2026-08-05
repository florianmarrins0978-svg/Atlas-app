"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import TransmettreAuClient from "./TransmettreAuClient";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { etatEnvoiExplication, etatEnvoiLabel, type EtatEnvoi } from "@/lib/etat-envoi";
import { reprendreDevisAction } from "./actions";
import EnvoiAuClient from "./EnvoiAuClient";
import { enEuros } from "@/lib/euros";


export default function ExportClient({
  chantierId,
  devisId,
  clientId,
  chantierNom,
  adresseChantier,
  clientNom,
  clientTelephone,
  clientEmail,
  entrepriseNom,
  canalClient,
  prestations,
  lignes,
  totalTtc,
  initialEnvoye,
  etatEnvoi,
  messageClient,
  lienEnvoi,
  origine,
}: {
  chantierId: string;
  devisId: string;
  /** Nécessaire pour compléter une coordonnée manquante depuis cet écran. */
  clientId: string | null;
  chantierNom: string;
  adresseChantier: string;
  clientNom: string;
  clientTelephone: string;
  clientEmail: string;
  entrepriseNom: string;
  canalClient: "sms" | "email";
  prestations: string[];
  /** Les lignes du devis lui-même : libellé et montant, telles qu'imprimées. */
  lignes: { libelle: string; montant: string }[];
  totalTtc: string;
  initialEnvoye: boolean;
  etatEnvoi: EtatEnvoi;
  /** Ce que le client a écrit, mot pour mot. Vide s'il n'a rien dit. */
  messageClient: string | null;
  /** Le lien encore actif, tant que le client n'a pas répondu. */
  lienEnvoi: string | null;
  /** Origine du site, calculée côté serveur — voir le commentaire dans page.tsx. */
  origine: string;
}) {
  const router = useRouter();
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [reprise, setReprise] = useState(false);
  // Aucun fournisseur de SMS ni d'e-mail n'étant branché (docs/AGENT.md §5), le
  // lien est rendu au patron pour qu'il le transmette lui-même — ce qui vaut
  // mieux qu'un envoi qui échouerait en silence.
  const [lienClient, setLienClient] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  function lienComplet(chemin: string) {
    return `${origine}${chemin}`;
  }

  // Déduit des props, jamais gardé en état : une reprise de devis rafraîchit
  // l'écran, et un état figé à l'ouverture continuerait d'annoncer un devis
  // parti alors qu'une nouvelle version attend d'être envoyée.
  const envoye = initialEnvoye || lienClient !== null;

  // Un refus, ou un lien périmé : le devis peut repartir, dans une nouvelle
  // version. Sans ce chemin, un chantier retourné l'était définitivement.
  // Une correction demandée se reprend comme un refus : c'est la même mécanique
  // — une nouvelle version, corrigée, renvoyée — mais avec bien plus de chances
  // d'aboutir, puisque le client a déjà dit ce qu'il voulait.
  const peutReprendre = etatEnvoi === "retourne" || etatEnvoi === "a_corriger" || etatEnvoi === "caduc";
  const lienAMontrer = lienClient ?? lienEnvoi;

  async function reprendre() {
    setReprise(true);
    try {
      await reprendreDevisAction(chantierId);
      // L'écran est relu : la nouvelle version, ses lignes et ses totaux
      // viennent du serveur, jamais d'une copie reconstituée ici.
      router.refresh();
    } finally {
      setReprise(false);
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

        {/* Le devis lui-même : ce qui sera imprimé, avec les montants.
            L'écran ne montrait que les *prestations* du chantier — un devis
            écrit entièrement à la main n'en a aucune, et le patron n'y voyait
            qu'un total, sans savoir ce qui partirait chez son client. */}
        {lignes.length > 0 && (
          <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
            <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
              Lignes du devis
            </p>
            <ul className="flex flex-col gap-2">
              {lignes.map((l, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-[15px]" style={{ color: colors.ink }}>
                  <span className="min-w-0 flex-1">{l.libelle || "Ligne sans libellé"}</span>
                  <span style={{ color: colors.muted }}>{enEuros(l.montant)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Les prestations restent en complément : elles disent le travail, là
            où les lignes disent le prix. Elles ne sont plus la seule chose
            affichée. */}
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
            {enEuros(totalTtc)}
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
            {/* L'état d'abord, l'explication ensuite. « Devis envoyé » ne disait
                pas si le client réfléchissait ou s'il avait dit non. */}
            <p className={smallCaps} style={{ color: colors.rust, marginBottom: 6, textAlign: "center" }}>
              {lienClient ? "Devis prêt" : etatEnvoiLabel[etatEnvoi]}
            </p>
            <p className="text-center text-[14px]" style={{ color: colors.muted }}>
              {lienClient ? `Devis prêt pour ${clientNom}.` : etatEnvoiExplication[etatEnvoi]}
            </p>

            {/* Le message du client, tel qu'il l'a écrit. C'est ici que le
                patron vient corriger : le lui faire chercher ailleurs, ou le
                résumer, reviendrait à lui demander de deviner ce qu'il doit
                changer. */}
            {messageClient && (
              <blockquote
                className="mt-3 whitespace-pre-wrap pl-3 text-[14px] leading-relaxed"
                style={{ borderLeft: `2px solid ${colors.rust}`, color: colors.ink }}
              >
                « {messageClient} »
              </blockquote>
            )}

            {lienAMontrer && (
              <>
                <p className="mt-3 text-center text-[13px]" style={{ color: colors.ink }}>
                  {lienClient
                    ? "Transmettez-lui ce lien : il y verra le devis et choisira sa date."
                    : "Le lien est toujours actif — renvoyez-le tel quel pour relancer."}
                </p>
                <p
                  className="mt-2 break-all rounded-xl px-3 py-2 text-center text-[12px]"
                  style={{ backgroundColor: colors.cream, color: colors.muted }}
                >
                  {lienComplet(lienAMontrer)}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(lienComplet(lienAMontrer));
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

                {/* Le dernier mètre : Atlas prépare le message, le patron
                    l'expédie depuis sa propre boîte. Voir TransmettreAuClient
                    pour ce que ce chemin donne et ce qu'il ne donne pas. */}
                <TransmettreAuClient
                  clientId={clientId}
                  clientNom={clientNom}
                  entrepriseNom={entrepriseNom}
                  canal={canalClient}
                  telephone={clientTelephone}
                  email={clientEmail}
                  lien={lienComplet(lienAMontrer)}
                />
              </>
            )}

            {peutReprendre && (
              <button
                type="button"
                onClick={reprendre}
                disabled={reprise}
                className="mt-4 block w-full rounded-2xl py-3 text-[15px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: colors.rust }}
              >
                {reprise
                  ? "Reprise…"
                  : etatEnvoi === "a_corriger"
                    ? "Corriger et renvoyer"
                    : "Reprendre le devis"}
              </button>
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
