import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getClient } from "@/server/repositories/clients";
import { getOuCreerDevisBrouillon, chargerDevisPourEcran } from "@/server/repositories/devis";
import { listerPrestations } from "@/server/repositories/prestations";
import { dernierEnvoi } from "@/server/repositories/envois-devis";
import { etatEnvoi } from "@/lib/etat-envoi";
import ExportClient from "./ExportClient";

export const dynamic = "force-dynamic";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  // Si le dernier devis a déjà été envoyé, il est chargé tel quel, en lecture
  // seule — consulter cet écran ne déclenche jamais de nouvelle révision.
  // Sinon, le brouillon est créé ou régénéré depuis les lignes de prix courantes.
  const devisRow = (await chargerDevisPourEcran(ctx, id)) ?? (await getOuCreerDevisBrouillon(ctx, id));

  // Le canal convenu vit sur la fiche du client, pas sur le devis : c'est un
  // accord avec la personne, pas une caractéristique du document. Un devis
  // repris six mois plus tard doit partir par le canal du client d'aujourd'hui.
  const client = chantier.clientId ? await getClient(ctx, chantier.clientId) : null;
  const canalClient = client?.canalCommunication ?? "sms";
  const prestations = await listerPrestations(ctx, id);

  // Où en est le devis parti, s'il est parti. C'est ce qui distingue « le
  // client réfléchit » de « le client a dit non » — deux situations que l'écran
  // présentait jusqu'ici de la même façon.
  const envoi = await dernierEnvoi(ctx, id);
  const etat = etatEnvoi(envoi);

  // L'adresse complète du lien est bâtie ICI, côté serveur, et non depuis
  // `window` : composée dans le navigateur, elle diffère de ce que le serveur a
  // rendu, et React régénère alors tout l'arbre. Le patron doit pouvoir copier
  // une adresse entière — un chemin seul ne s'ouvre nulle part.
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host") ?? "";
  const protocole = entetes.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  const origine = hote ? `${protocole}://${hote}` : "";

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <div className="px-6 pt-8">
          <a
            href={`/chantiers/${id}`}
            aria-label="Retour à la fiche du chantier"
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
            {chantier.nom}
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Devis
          </h1>
        </div>

        <ExportClient
          chantierId={id}
          devisId={devisRow.id}
          chantierNom={chantier.nom}
          adresseChantier={chantier.adresseChantier ?? "Adresse non renseignée"}
          clientNom={devisRow.clientNom ?? "Client non renseigné"}
          clientTelephone={devisRow.clientTelephone ?? ""}
          clientEmail={devisRow.clientEmail ?? ""}
          entrepriseNom={devisRow.entrepriseNom ?? "Votre entreprise"}
          canalClient={canalClient}
          prestations={prestations.map((p) => p.libelle)}
          totalTtc={devisRow.totalTtc}
          initialEnvoye={devisRow.statut === "envoye"}
          etatEnvoi={etat}
          messageClient={envoi?.precisionClient ?? null}
          lienEnvoi={envoi && !envoi.reponse ? `/devis/${envoi.jeton}` : null}
          origine={origine}
        />
      </div>
    </div>
  );
}
