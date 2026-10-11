import Link from "next/link";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { jourLisible, jourIso } from "@/lib/jour";
import type { Ctx } from "@/server/repositories/context";
import { facturesAvecPaiements } from "@/server/repositories/paiements-facture";
import { listerFacturesNonPayees } from "@/server/repositories/factures-non-payees";

/**
 * Sous une facture partie, ce qu'il en fait quand le client ne paie pas (planches du 24 septembre
 * 2026, `appli/avoir.html` et `appli/il-ne-paiera-pas.html`) :
 *   - rangée « Non payée » : l'encadré, « J'ai reçu le paiement », et la mise
 *     en demeure (`appli/mise-en-demeure.html`) ;
 *   - encore due : le lien doré « Mon client ne me paie pas ».
 *
 * Composant serveur : il lit, il ne décide de rien (`src/lib/avoir.ts` et
 * `src/lib/exigibilite-tva.ts` ont déjà décidé).
 */
export default async function SuiteDeLaFacture({ ctx, chantierId, factureId }: { ctx: Ctx; chantierId: string; factureId: string }) {
  const [avecPaiements, nonPayees] = await Promise.all([
    facturesAvecPaiements(ctx),
    listerFacturesNonPayees(ctx),
  ]);
  const f = avecPaiements.find((x) => x.id === factureId);
  if (!f) return null;
  const nonPayee = nonPayees.find((n) => n.factureId === factureId);
  const due = f.etat !== "soldee";

  const carte = "mx-3 mt-4 rounded-[10px] px-5 py-5";
  return (
    <div data-atlas="suite-de-la-facture">
      {nonPayee && (
        <section className={carte} style={{ backgroundColor: colors.card }} data-atlas="facture-non-payee">
          <div className="rounded-[4px] px-3.5 py-3 text-center" style={{ boxShadow: `inset 0 0 0 1px ${colors.or}` }}>
            <p className="text-[11.5px] font-semibold uppercase" style={{ letterSpacing: "0.18em", color: colors.or }}>
              Non payée
            </p>
            <p className="mt-1.5 text-[13px]" style={{ color: colors.inkSoft }}>
              Depuis le {jourLisible(jourIso(nonPayee.declareeLe))}.
            </p>
          </div>
          <Link
            href={`/chantiers/${chantierId}/facture/paiement`}
            className="atlas-plein mt-5 flex min-h-[54px] w-full items-center justify-center rounded-full no-underline"
            style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display, fontSize: 20 }}
            data-atlas="recu-le-paiement"
          >
            J&apos;ai reçu le paiement
          </Link>
          <Link
            href={`/chantiers/${chantierId}/facture/mise-en-demeure`}
            className="mt-3 flex min-h-[50px] w-full items-center justify-center rounded-full no-underline"
            style={{ boxShadow: `inset 0 0 0 1.5px ${colors.or}`, color: colors.ink, fontFamily: font.display, fontSize: 18 }}
            data-atlas="mise-en-demeure"
          >
            Mise en demeure
          </Link>
        </section>
      )}

      {due && !nonPayee && (
        <Link
          href={`/chantiers/${chantierId}/facture/impaye`}
          className="mx-auto mt-5 block w-fit px-2.5 py-1.5 text-[14.5px] underline underline-offset-4"
          style={{ color: colors.or }}
          data-atlas="mon-client-ne-paie-pas"
        >
          Mon client ne me paie pas
        </Link>
      )}
    </div>
  );
}
