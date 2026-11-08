import { notFound } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { patronQuiImporte } from "@/server/import/garde";
import { envoiEnCours } from "@/server/repositories/pieces-importees";
import { envoiAReprendre } from "@/lib/import-pieces";
import ImporterPieces from "./ImporterPieces";
import { garderLaPage } from "@/server/garde-page";
import { getClient } from "@/server/repositories/clients";

// « Importer devis / facture » — sa demande du 22 octobre 2026, maquette
// `appli/importer-ancienne-appli.html`, mesures et décisions
// `docs/importer-devis-factures.md`.
//
// **Un geste du patron** : importer crée des fiches clients et range des
// factures (`import/garde.ts`). Pour les autres rôles, l'adresse n'existe pas.

export const dynamic = "force-dynamic";

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ImporterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await garderLaPage();
  const ctx = await patronQuiImporte();
  if (!ctx) notFound();
  // Un envoi déjà arrivé et pas rangé, ou ce qu'un rangement a laissé une
  // fois ses six secondes passées : l'écran reprend à la lecture, puis à la
  // relecture. C'est par ici qu'il revient après avoir fermé l'appli.
  const etat = await envoiEnCours(ctx);
  const reprise = envoiAReprendre(etat);
  // **Depuis la fiche d'un client** (8 novembre 2026) : ce qui se reprend
  // garde la destination de son envoi, quelle que soit la porte ; sinon,
  // celle de la porte. Son client effacé, l'envoi redevient celui de Vos
  // clients (migration 0177).
  const { client: demande } = await searchParams;
  const vise = reprise ? (etat?.clientId ?? null) : typeof demande === "string" ? demande : null;
  const fiche = vise && FORMAT_UUID.test(vise) ? await getClient(ctx, vise) : null;
  const client = fiche && !fiche.effaceLe ? { id: fiche.id, nom: fiche.nom } : null;
  // Une porte vers un client qui n'existe pas ne s'ouvre pas sur l'import de tous.
  if (!reprise && vise && !client) notFound();

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          surtitre={client ? client.nom : "Vos clients"}
          titre="Importer"
          retour={client ? { href: `/clients/${client.id}`, libelle: `Retour à la fiche de ${client.nom}` } : { href: "/clients", libelle: "Retour à vos clients" }}
        />
        <ImporterPieces repriseEnvoiId={reprise} pourLeClient={client} />
      </div>
    </div>
  );
}
