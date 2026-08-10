import Link from "next/link";
import { colors, font, smallCaps, cardShadow } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersTermines } from "@/server/repositories/factures";
import { jourLisible } from "@/lib/jour";
import { nombreEnLettres } from "@/lib/nombre-en-lettres";

export const dynamic = "force-dynamic";

// Onglet « Chantiers terminés » (docs/AGENT.md §2.3). Les chantiers dont la
// date d'intervention est passée, rangés par date, le plus récent en tête —
// c'est celui que le patron vient clôturer en rentrant.

const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function TerminesPage() {
  const ctx = await getCurrentCtx();
  const chantiers = await listerChantiersTermines(ctx);

  const aCloturer = chantiers.filter((c) => c.factureStatut !== "emise");
  const factures = chantiers.filter((c) => c.factureStatut === "emise");

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-10">
        <EnTeteEcran
          surtitre="Chantiers réalisés"
          titre="Terminés"
          precision={
            aCloturer.length === 0
              ? "Rien à facturer"
              : `${nombreEnLettres(aCloturer.length)} à facturer`
          }
        />

        <div className="px-6 pt-6">
          <Link
            href="/termines/tva"
            className="flex items-center justify-between rounded-[4px] px-5 py-4"
            style={{ backgroundColor: colors.rustTint }}
          >
            <span className="text-[15px] font-medium" style={{ color: colors.rust }}>
              Relevé de TVA collectée
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {chantiers.length === 0 ? (
          <div className="mt-8 px-6">
            <div className="rounded-[4px] px-5 py-8 text-center" style={{ backgroundColor: colors.card }}>
              <p className="text-[14px]" style={{ color: colors.muted }}>
                Vos chantiers apparaîtront ici une fois leur date d&apos;intervention passée.
              </p>
            </div>
          </div>
        ) : (
          <>
            {aCloturer.length > 0 && (
              <div className="mt-8 flex flex-col gap-4 px-6">
                {aCloturer.map((c) => (
                  <Link
                    key={c.id}
                    href={`/chantiers/${c.id}/facture`}
                    className="block rounded-[22px] px-5 py-5"
                    style={{ backgroundColor: colors.card, boxShadow: cardShadow }}
                  >
                    <span className={smallCaps} style={{ color: colors.rust }}>
                      {c.datePlanifiee ? jourLisible(c.datePlanifiee) : "Date inconnue"}
                    </span>
                    <h2 className="mt-1 truncate text-[22px] leading-tight" style={{ fontFamily: font.display }}>
                      {c.nom}
                    </h2>
                    <p className="mt-1 truncate text-[14px]" style={{ color: colors.muted }}>
                      {c.clientNom ?? "Client non renseigné"}
                    </p>
                    <p
                      className="mt-4 rounded-[4px] py-3 text-center text-[15px] font-medium text-white"
                      style={{ backgroundColor: colors.rust }}
                    >
                      {c.factureId ? "Reprendre la facture" : "Fin de chantier"}
                    </p>
                  </Link>
                ))}
              </div>
            )}

            {factures.length > 0 && (
              <div className="mt-9 px-6">
                <p className={smallCaps} style={{ color: colors.muted, marginBottom: 12 }}>
                  Facturés
                </p>
                <div className="flex flex-col gap-3">
                  {factures.map((c) => (
                    <Link
                      key={c.id}
                      href={`/chantiers/${c.id}/facture`}
                      className="flex items-center justify-between rounded-[18px] px-5 py-4"
                      style={{ backgroundColor: colors.card }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[16px]" style={{ color: colors.ink }}>
                          {c.nom}
                        </p>
                        <p className="mt-0.5 text-[13px]" style={{ color: colors.muted }}>
                          {c.factureNumero}
                        </p>
                      </div>
                      <span className="ml-4 flex-shrink-0 text-[15px] font-medium" style={{ color: colors.rust }}>
                        {c.totalTtc ? formatEuros.format(Number(c.totalTtc)) : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
