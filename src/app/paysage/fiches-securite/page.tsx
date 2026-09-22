import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerLesFichesDuMois } from "@/server/repositories/fiches-securite";
import ListeDesFiches from "./ListeDesFiches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiches de sécurité, Atlas" };

/**
 * LES FICHES DE SÉCURITÉ — dans Paysage, une ligne de plus parmi les outils du
 * métier (sa décision du 21 septembre 2026). Le mois en tête, la roue du
 * téléphone pour en changer : `?mois=2026-09`. Par défaut, le mois en cours.
 */
function moisEnCours(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FichesDeSecuritePage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const { mois } = await searchParams;
  const choisi = mois && /^\d{4}-\d{2}$/.test(mois) ? mois : moisEnCours();
  const [annee, numero] = choisi.split("-").map(Number);
  const ctx = await getCurrentCtx();
  const fiches = await listerLesFichesDuMois(ctx, { annee, mois: numero });
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran surtitre="Paysage" titre="Fiches de sécurité" retour={{ href: "/paysage", libelle: "Retour à Paysage" }} />
      <ListeDesFiches fiches={fiches} mois={choisi} />
    </div>
  );
}
