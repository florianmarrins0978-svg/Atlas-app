import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerAchatsTva, totalTvaDeductible } from "@/server/repositories/achats-tva";
import { lirePeriode, periodeCourante, libellePeriode, PERIODICITE_TVA_PAR_DEFAUT } from "@/server/periode-tva";
import { jourCourt, jourIso } from "@/lib/jour";
import TableauCalculette from "../TableauCalculette";

export const dynamic = "force-dynamic";

// La TVA déductible, à vérifier à la calculette : *« et pareil pour la TVA
// déductible »*, sa demande du 25 septembre 2026, même planche que la
// collectée (`appli/tva-collectee-a-la-calculette.html`).
//
// **Un achat écrit à la main peut n'avoir que sa TVA** : ni total, ni taux
// (`achats-tva.ts`). Les deux cases disent alors « non noté », et le total
// payé ne compte que ce qui est noté. Le compter pour zéro en silence rendrait
// un total juste à la calculette et faux sur les tickets.
export default async function TvaDeductiblePage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; t?: string }>;
}) {
  const { annee, t } = await searchParams;
  const ctx = await getCurrentCtx();
  const entreprise = await getEntreprise(ctx);
  const periodicite = entreprise?.periodiciteTva ?? PERIODICITE_TVA_PAR_DEFAUT;
  const periode = lirePeriode(periodicite, annee, t) ?? periodeCourante(periodicite);

  // Le total vient de la même lecture que Ma TVA, pas d'une addition refaite ici.
  const [achats, deductible] = await Promise.all([
    listerAchatsTva(ctx, periode.debut, periode.fin),
    totalTvaDeductible(ctx, periode.debut, periode.fin),
  ]);
  const aujourdHui = jourIso(new Date());

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran
          retour={{ href: `/termines/tva?annee=${periode.annee}&t=${periode.numero}`, libelle: "Retour à Ma TVA" }}
          action={<BoutonAssistant />}
          actionPlacee="retour"
          assistant={false}
          surtitre="TVA déductible"
          titre={libellePeriode(periode)}
        />

        <section className="px-6">
          {achats.length === 0 ? (
            <p className="mt-6 text-center text-[13px]" style={{ color: colors.inkSoft }}>
              Aucun achat sur cette période.
            </p>
          ) : (
            <TableauCalculette
              qui="Fournisseur"
              montant="Payé"
              totalTva={String(deductible)}
              pieces={achats.map((a) => ({
                cle: a.id,
                nom: a.fournisseur,
                sous: [`le ${jourCourt(a.dateAchat, aujourdHui)}`],
                parts: [{ taux: a.tauxTva, montant: a.totalTtc, tva: a.tvaDeductible }],
              }))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
