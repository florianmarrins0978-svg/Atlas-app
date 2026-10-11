import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { releveTvaCollecteeParTaux } from "@/server/repositories/factures";
import { reglementsRetiresDeLaPeriode } from "@/server/repositories/paiements-facture";
import { enEuros } from "@/lib/euros";
import { getEntreprise } from "@/server/repositories/entreprises";
import { lirePeriode, periodeCourante, libellePeriode, PERIODICITE_TVA_PAR_DEFAUT } from "@/server/periode-tva";
import { jourCourt, jourIso } from "@/lib/jour";
import { visionneuseDeLaFacture } from "@/lib/visionneuse-pdf";
import TableauCalculette from "../TableauCalculette";

export const dynamic = "force-dynamic";

// La TVA collectée, à vérifier à la calculette.
//
// **Sa demande du 25 septembre 2026** : *« quand je clique sur TVA collectée
// j'aimerais qu'une page s'ouvre avec les montants des factures d'un côté qui
// s'additionnent et de l'autre les montants de la TVA qui s'additionnent. […]
// que l'utilisateur puisse rapidement vérifier si l'appli n'a pas fait
// d'erreur »*. Planche `appli/tva-collectee-a-la-calculette.html`, la A, avec
// le taux de chaque ligne.
//
// **Le relevé est celui de Ma TVA, lu par la même fonction** : cette page le
// découpe par taux, elle ne le recalcule pas. Le total de TVA est donc, au
// centime, le chiffre sur lequel il a appuyé.
export default async function TvaCollecteePage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; t?: string }>;
}) {
  const { annee, t } = await searchParams;
  const ctx = await getCurrentCtx();
  const entreprise = await getEntreprise(ctx);
  const periodicite = entreprise?.periodiciteTva ?? PERIODICITE_TVA_PAR_DEFAUT;
  const periode = lirePeriode(periodicite, annee, t) ?? periodeCourante(periodicite);

  const [{ releve, lignes }, retires] = await Promise.all([
    releveTvaCollecteeParTaux(ctx, periode.debut, periode.fin),
    reglementsRetiresDeLaPeriode(ctx, periode.debut, periode.fin),
  ]);
  const aujourdHui = jourIso(new Date());
  const reglements = releve.regime === "encaissements";

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran
          retour={{ href: `/termines/tva?annee=${periode.annee}&t=${periode.numero}`, libelle: "Retour à Ma TVA" }}
          action={<BoutonAssistant />}
          actionPlacee="retour"
          assistant={false}
          surtitre="TVA collectée"
          titre={libellePeriode(periode)}
        />

        <section className="px-6">
          {lignes.length === 0 ? (
            <p className="mt-6 text-center text-[13px]" style={{ color: colors.inkSoft }}>
              {reglements ? "Aucun règlement reçu sur cette période." : "Aucune facture émise sur cette période."}
            </p>
          ) : (
            <TableauCalculette
              qui="Client"
              // Aux encaissements, une ligne est un RÈGLEMENT : un acompte n'est
              // qu'une part de sa facture, et « Facture » mentirait sur le montant.
              montant={reglements ? "Encaissé" : "Facturé"}
              totalTva={releve.totalTva}
              pieces={lignes.map((l, i) => ({
                cle: `${l.factureId}|${l.dateEmission}|${l.totalTtc}|${i}`,
                nom: l.clientNom ?? "Client non renseigné",
                sous: [
                  // Le numéro seul, comme sur la planche : « Facture » devant le coupait
                  // en deux lignes. Un avoir, lui, se nomme : ce n'est pas la facture.
                  l.motif === "avoir" ? `Avoir ${l.numeroCommercial}` : l.numeroCommercial,
                  `le ${jourCourt(l.dateEmission, aujourdHui)}`,
                ],
                // Une ligne d'avoir ne s'ouvre pas sur la facture : la
                // visionneuse titrerait la facture du numéro de l'avoir.
                href:
                  l.motif === "avoir"
                    ? undefined
                    : visionneuseDeLaFacture({ id: l.factureId, numeroCommercial: l.numeroCommercial }),
                parts: l.parts.map((p) => ({ taux: p.taux, montant: p.ttc, tva: p.tva })),
              }))}
            />
          )}

          {/* **Un règlement retiré reste LISIBLE au mois où il était entré**
              (sa planche du 26 septembre 2026). Il ne compte plus au total ;
              barré ici, il dit pourquoi un mois déjà déclaré a baissé. Aux
              débits, un règlement ne fait pas le relevé : rien à montrer. */}
          {reglements && retires.length > 0 && (
            <ul data-atlas="retires-du-releve" className="mt-5 flex flex-col gap-1.5">
              {retires.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline justify-between gap-3 text-[12px]"
                  style={{ color: colors.muted }}
                >
                  <span className="line-through">
                    {r.clientNom ?? "Client non renseigné"}, {r.numeroCommercial}, acompte du{" "}
                    {jourCourt(r.date, aujourdHui)}, retiré le {jourCourt(jourIso(r.retireLe), aujourdHui)}
                  </span>
                  <span className="flex-none tabular-nums line-through">{enEuros(r.montant)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
