import Link from "next/link";
import { colors, font, voile } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerFacturesNonPayees } from "@/server/repositories/factures-non-payees";
import { enEuros, sommeDesMontants } from "@/lib/euros";
import IconeTrait from "@/components/atlas/IconeTrait";
import { jourIso, jourLisible } from "@/lib/jour";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { garderLaPage } from "@/server/garde-page";

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
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const factures = await listerFacturesNonPayees(ctx);
  const reste = sommeDesMontants(factures.map((f) => f.reste));
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre="Non payées" retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }} allure="commune" />
      <div className="mx-[22px] mt-6 pb-10">
        {factures.length === 0 ? (
          <div className="px-2 pt-11 pb-6 text-center">
            <span className="mx-auto mb-3.5 grid w-fit" style={{ color: colors.or }}>
              <IconeTrait nom="coche" taille={40} epaisseur={1.4} />
            </span>
            <p className="text-[22px] leading-tight" style={{ fontFamily: font.display }}>
              Aucune facture non payée.
            </p>
          </div>
        ) : (
          <>
            {/* **Ce qui reste à recevoir, en tête — sa planche du 31 octobre
                2026** (`appli/soignee/termines-non-payees.html`) : la somme
                des restes, sur une bande dorée comme Ma TVA, et rien d'autre.
                Additionnée en décimal (`sommeDesMontants`). */}
            <div
              className="flex items-baseline justify-between gap-3 rounded-md px-[18px] py-4"
              style={{ backgroundColor: voile(colors.or, 0.13) }}
              data-atlas="reste-a-recevoir"
            >
              <span className="text-[15px] font-semibold">
                Reste à recevoir
                <small className="mt-0.5 block text-[14px] font-normal" style={{ color: colors.inkSoft }}>
                  {factures.length} facture{factures.length > 1 ? "s" : ""}
                </small>
              </span>
              <span className="whitespace-nowrap text-[34px] leading-none tabular-nums" style={{ fontFamily: font.display }}>
                {enEuros(reste)}
              </span>
            </div>

            {/* La plus récemment déclarée en haut (`listerFacturesNonPayees`).
                Toucher la ligne ouvre la facture, où il note le paiement s'il
                arrive (elle sort alors d'ici d'elle-même) ou envoie la mise en
                demeure. */}
            <ul className="mt-4 rounded-md px-[18px] py-1" style={{ backgroundColor: colors.card }} data-atlas="liste-non-payees">
              {factures.map((f, rang) => (
                <li key={f.factureId} className={rang > 0 ? "border-t" : ""} style={{ borderColor: colors.line }}>
                  <Link
                    href={`/chantiers/${f.chantierId}/facture`}
                    className="flex min-h-[68px] items-center gap-3.5 py-3 no-underline"
                    style={{ color: colors.ink }}
                    data-atlas="non-payee"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 text-[18px] leading-tight [overflow-wrap:anywhere]" style={{ fontFamily: font.display }}>
                          {f.chantierNom}
                        </span>
                        <span className="flex-none whitespace-nowrap text-[19px] leading-tight tabular-nums" style={{ fontFamily: font.display }}>
                          {enEuros(f.reste)}
                        </span>
                      </span>
                      <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                        {f.clientNom ? `${f.clientNom}, ` : ""}facture {f.numero}
                      </span>
                      <span className="block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                        Depuis le {jourLisible(jourIso(f.declareeLe))}
                      </span>
                    </span>
                    <span style={{ color: colors.chevron }}>
                      <IconeTrait nom="suivant" taille={20} epaisseur={2} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
