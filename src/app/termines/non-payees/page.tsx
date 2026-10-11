import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerFacturesNonPayees } from "@/server/repositories/factures-non-payees";
import { formatEuros } from "@/lib/termines-par-mois";
import { jourIso, jourLisible } from "@/lib/jour";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";

/**
 * LES FACTURES NON PAYÉES — la catégorie que Terminés ouvre.
 *
 * Sa demande du 24 septembre 2026, planche `appli/il-ne-paiera-pas.html` : la
 * facture qu'il a déclarée « Il ne me paiera pas » s'y range, entière, et il
 * peut toujours la réclamer. Toucher la ligne ouvre la facture, où il note le
 * paiement s'il arrive (elle sort alors d'ici d'elle-même) ou envoie la mise en
 * demeure.
 */
export const dynamic = "force-dynamic";

export default async function PageNonPayees() {
  const ctx = await getCurrentCtx();
  const factures = await listerFacturesNonPayees(ctx);
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre="Non payées" retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }} allure="commune" />
      <ul className="mx-[26px] mt-6" data-atlas="liste-non-payees">
        {factures.length === 0 && (
          <li className="py-6 text-[14px]" style={{ color: colors.muted }}>
            Aucune facture non payée.
          </li>
        )}
        {factures.map((f) => (
          <li key={f.factureId} style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
            <Link href={`/chantiers/${f.chantierId}/facture`} className="flex items-baseline gap-3 py-5 no-underline" data-atlas="non-payee">
              <span className="min-w-0 flex-1">
                <b className="block truncate font-normal" style={{ fontFamily: font.display, fontSize: 17, color: colors.ink }}>
                  {f.chantierNom}
                </b>
                <span className="mt-1 block text-[13px]" style={{ color: colors.inkSoft }}>
                  {f.clientNom ? `${f.clientNom}, ` : ""}facture {f.numero}, depuis le {jourLisible(jourIso(f.declareeLe))}
                </span>
              </span>
              <span className="flex-none" style={{ fontFamily: font.display, fontSize: 16, color: colors.ink }}>
                {formatEuros(Number(f.reste))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
