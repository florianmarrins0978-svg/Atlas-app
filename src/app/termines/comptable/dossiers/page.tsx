import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import { colors, font } from "@/lib/design-tokens";
import { echeanceProche, jourComplet, tailleLisible } from "@/lib/pour-mon-comptable";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerDossiers } from "@/server/repositories/dossiers-comptables";
import MesDossiers, { type DossierAffiche } from "./MesDossiers";

export const dynamic = "force-dynamic";

/**
 * MES DOSSIERS JUSTIFIÉS — écran 5 de `appli/pour-mon-comptable.html`.
 *
 * Ses demandes du 24 octobre 2026 : un menu Année pour retrouver un dossier,
 * le bilan du comptable rangé avec lui, la garde de dix ans DITE en tête, et
 * prévenir trois mois avant qu'un dossier ne soit effacé.
 */
export default async function PageMesDossiers() {
  const ctx = await getCurrentCtx();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const dossiers = await listerDossiers(ctx);

  const affiches: DossierAffiche[] = dossiers.map((d) => ({
    id: d.id,
    nom: `Du ${jourComplet(d.du)} au ${jourComplet(d.au)}`,
    annee: Number(d.au.slice(0, 4)),
    detail: `Rangé le ${jourComplet(d.arreteLe.toISOString().slice(0, 10))}, gardé jusqu’au ${jourComplet(d.gardeJusquAu)}, ${tailleLisible(d.tailleOctets)}`,
    echeance: echeanceProche(d.gardeJusquAu, aujourdhui) ? jourComplet(d.gardeJusquAu) : null,
    bilans: d.bilans.map((b) => ({ id: b.id, nom: b.fichierNom ?? (b.nature === "pdf" ? "Bilan, PDF" : "Bilan, photo"), ajoute: jourComplet(b.ajouteLe.toISOString().slice(0, 10)) })),
  }));

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran
          retour={{ href: "/termines/comptable", libelle: "Retour au dossier en cours" }}
          action={<BoutonAssistant />}
          actionPlacee="retour"
          assistant={false}
          surtitre="Gardés dix ans"
          titre="Mes dossiers justifiés"
        />
        <p className="mx-6 mt-3 text-[13.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
          Atlas garde chaque dossier et son bilan dix ans, puis les efface. Téléchargez-les pour les garder plus longtemps.
        </p>
        <MesDossiers dossiers={affiches} />
      </div>
    </div>
  );
}
