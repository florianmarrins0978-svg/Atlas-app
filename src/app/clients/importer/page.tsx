import { notFound } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { patronQuiImporte } from "@/server/import/garde";
import { envoiEnCours } from "@/server/repositories/pieces-importees";
import { envoiAReprendre } from "@/lib/import-pieces";
import ImporterPieces from "./ImporterPieces";
import { garderLaPage } from "@/server/garde-page";

// « Importer devis / facture » — sa demande du 22 octobre 2026, maquette
// `appli/importer-ancienne-appli.html`, mesures et décisions
// `docs/importer-devis-factures.md`.
//
// **Un geste du patron** : importer crée des fiches clients et range des
// factures (`import/garde.ts`). Pour les autres rôles, l'adresse n'existe pas.

export const dynamic = "force-dynamic";

export default async function ImporterPage() {
  await garderLaPage();
  const ctx = await patronQuiImporte();
  if (!ctx) notFound();
  // Un envoi déjà arrivé et pas rangé, ou ce qu'un rangement a laissé une
  // fois ses six secondes passées : l'écran reprend à la lecture, puis à la
  // relecture. C'est par ici qu'il revient après avoir fermé l'appli.
  const reprise = envoiAReprendre(await envoiEnCours(ctx));

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran surtitre="Vos clients" titre="Importer" retour={{ href: "/clients", libelle: "Retour à vos clients" }} />
        <ImporterPieces repriseEnvoiId={reprise} />
      </div>
    </div>
  );
}
