import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerLesFichesSignees } from "@/server/repositories/fiches-securite";
import { moisEnCours, periodeValide } from "@/lib/periode";
import ListeDesFiches from "./ListeDesFiches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiches de sécurité, Atlas" };

/**
 * LES FICHES DE SÉCURITÉ — dans Paysage, une ligne de plus parmi les outils du
 * métier (sa décision du 21 septembre 2026). Le mois en tête, la roue du
 * téléphone pour en changer : `?periode=2026-09`, un jour (`2026-09-22`) ou une
 * année (`2026`). Par défaut, le mois en cours. `?mois=` et `?jour=` restent
 * lus : ce sont les adresses d'avant le 23 septembre, et elles vivent dans des
 * onglets laissés ouverts.
 * Un nom tapé passe par-dessus le mois (`fichesAMontrer`).
 */
export default async function FichesDeSecuritePage({ searchParams }: { searchParams: Promise<{ periode?: string; mois?: string; jour?: string }> }) {
  const { periode, mois, jour } = await searchParams;
  const choisi = periodeValide(periode) ?? periodeValide(jour) ?? periodeValide(mois) ?? moisEnCours();
  const ctx = await getCurrentCtx();
  const fiches = await listerLesFichesSignees(ctx);
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran surtitre="Paysage" titre="Fiches de sécurité" retour={{ href: "/paysage", libelle: "Retour à Paysage" }} />
      <ListeDesFiches fiches={fiches} periode={choisi} />
    </div>
  );
}
