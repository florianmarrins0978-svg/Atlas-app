import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { releveTvaCollectee } from "@/server/repositories/factures";
import { getEntreprise } from "@/server/repositories/entreprises";
import {
  libellePeriode,
  lirePeriode,
  periodeCourante,
  periodePrecedente,
  periodeSuivante,
  PERIODICITE_TVA_PAR_DEFAUT,
} from "@/server/periode-tva";
import { jourLisible } from "@/lib/jour";
import CalendrierPeriodes from "./CalendrierPeriodes";

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

  const ctx = await getCurrentCtx();

  // **La périodicité vient de l'entreprise, jamais de l'adresse.** Elle
  // commande le découpage ET la lecture du numéro : « 12 » est un mois valide
  // et un trimestre absurde. La lire ici, avant tout le reste, évite qu'un
  // réglage changé laisse passer une adresse qui ne veut plus rien dire.
  const entreprise = await getEntreprise(ctx);
  const periodicite = entreprise?.periodiciteTva ?? PERIODICITE_TVA_PAR_DEFAUT;

  // Une adresse illisible ramène à la période courante : un paramètre bricolé
  // à la main ne doit pas produire d'écran vide et inexplicable.
  const periode = lirePeriode(periodicite, annee, t) ?? periodeCourante(periodicite);
  const courante = periodeCourante(periodicite);

  const releve = await releveTvaCollectee(ctx, periode.debut, periode.fin);

  const precedent = periodePrecedente(periode);
  const suivant = periodeSuivante(periode);
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

        <EnTeteEcran surtitre="TVA collectée" titre={libellePeriode(periode)} />

        {/* **Le calendrier se glisse ENTRE les deux flèches**, à sa demande du
            12 août 2026. Sans lui, remonter au 1er trimestre 2025 demandait
            sept appuis — et sept chargements, chaque flèche étant un lien. */}
        <div className="mt-5 flex items-center justify-between gap-2.5 px-6 text-[14px] font-medium">
          <Link href={lien(precedent)} className="whitespace-nowrap" style={{ color: colors.rust }}>
            ← {libellePeriode(precedent)}
          </Link>
          <CalendrierPeriodes
            periodicite={periodicite}
            annee={periode.annee}
            numero={periode.numero}
            anneeCourante={courante.annee}
            numeroCourant={courante.numero}
          />
          <Link href={lien(suivant)} className="whitespace-nowrap" style={{ color: colors.rust }}>
            {libellePeriode(suivant)} →
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
                Aucune facture émise sur cette période.
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
