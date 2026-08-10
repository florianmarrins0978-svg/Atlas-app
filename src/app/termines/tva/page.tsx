import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { releveTvaCollectee } from "@/server/repositories/factures";
import {
  libelleTrimestre,
  trimestre,
  trimestreCourant,
  trimestrePrecedent,
  trimestreSuivant,
} from "@/server/trimestre";
import { jourLisible } from "@/lib/jour";

export const dynamic = "force-dynamic";

// Relevé de TVA collectée (docs/AGENT.md §2.3 et §6).
//
// Calculé à partir des factures émises, jamais stocké. Atlas PRÉPARE ce
// relevé ; il ne le déclare pas. La mention en bas d'écran le dit au patron
// plutôt que de le lui laisser supposer.

const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function ReleveTvaPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; t?: string }>;
}) {
  const { annee, t } = await searchParams;

  // Une année ou un trimestre illisible ramène au trimestre courant : un
  // paramètre bricolé dans la barre d'adresse ne doit pas produire d'écran vide
  // et inexplicable.
  const anneeNum = Number(annee);
  const numeroNum = Number(t);
  const periode =
    Number.isInteger(anneeNum) && anneeNum > 2000 && Number.isInteger(numeroNum) && numeroNum >= 1 && numeroNum <= 4
      ? trimestre(anneeNum, numeroNum)
      : trimestreCourant();

  const ctx = await getCurrentCtx();
  const releve = await releveTvaCollectee(ctx, periode.debut, periode.fin);

  const precedent = trimestrePrecedent(periode);
  const suivant = trimestreSuivant(periode);
  const lien = (p: { annee: number; numero: number }) => `/termines/tva?annee=${p.annee}&t=${p.numero}`;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <div className="px-6 pt-8">
          <Link
            href="/termines"
            aria-label="Retour aux chantiers terminés"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <EnTeteEcran surtitre="TVA collectée" titre={libelleTrimestre(periode)} />

        <div className="mt-5 flex items-center justify-between px-6 text-[14px] font-medium">
          <Link href={lien(precedent)} style={{ color: colors.rust }}>
            ← {libelleTrimestre(precedent)}
          </Link>
          <Link href={lien(suivant)} style={{ color: colors.rust }}>
            {libelleTrimestre(suivant)} →
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-4 px-6">
          <div className="rounded-[4px] px-5 py-6 text-center" style={{ backgroundColor: colors.card }}>
            <p className={smallCaps} style={{ color: colors.muted, marginBottom: 6 }}>
              TVA collectée
            </p>
            <p
              className="text-[36px] font-semibold leading-none"
              style={{ fontFamily: font.display, color: colors.rust }}
            >
              {formatEuros.format(Number(releve.totalTva))}
            </p>
            <p className="mt-3 text-[13px]" style={{ color: colors.muted }}>
              sur {formatEuros.format(Number(releve.totalHt))} hors taxes
            </p>
          </div>

          {releve.lignes.length === 0 ? (
            <div className="rounded-[4px] px-5 py-8 text-center" style={{ backgroundColor: colors.card }}>
              <p className="text-[14px]" style={{ color: colors.muted }}>
                Aucune facture émise sur ce trimestre.
              </p>
            </div>
          ) : (
            <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
              <p className={smallCaps} style={{ color: colors.muted, marginBottom: 12 }}>
                {releve.lignes.length} facture{releve.lignes.length > 1 ? "s" : ""}
              </p>
              <ul className="flex flex-col gap-3">
                {releve.lignes.map((l) => (
                  <li key={l.numeroCommercial} className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-[15px]" style={{ color: colors.ink }}>
                        {l.numeroCommercial} — {l.clientNom ?? "Client non renseigné"}
                      </p>
                      <p className="mt-0.5 text-[12px]" style={{ color: colors.muted }}>
                        {jourLisible(l.dateEmission)}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-[15px]" style={{ color: colors.rust }}>
                      {formatEuros.format(Number(l.totalTva))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="px-1 text-center text-[12px]" style={{ color: colors.muted }}>
            Ce relevé est préparé par Atlas à partir de vos factures émises. Il ne
            vaut pas déclaration : celle-ci reste à faire par votre outil
            comptable.
          </p>
        </div>
      </div>
    </div>
  );
}
