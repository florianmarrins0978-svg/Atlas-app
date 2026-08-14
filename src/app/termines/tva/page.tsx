import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
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
import RythmeTva from "./RythmeTva";
import MontantCopiable from "./MontantCopiable";
import AchatsTva from "./AchatsTva";
import { listerAchatsTva, totalTvaDeductible } from "@/server/repositories/achats-tva";
import { tvaDue } from "@/lib/achat-tva";
import { jourIso } from "@/lib/jour";

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

  const [releve, deductible, achats] = await Promise.all([
    releveTvaCollectee(ctx, periode.debut, periode.fin),
    totalTvaDeductible(ctx, periode.debut, periode.fin),
    listerAchatsTva(ctx, periode.debut, periode.fin),
  ]);
  const collectee = Number(releve.totalTva);
  const reste = tvaDue(collectee, deductible);

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

        {/* **Le rythme en haut, à sa demande du 13 août 2026.** Il vit aussi
            dans Réglages ; c'est ici qu'on se pose la question. */}
        <RythmeTva actuelle={periodicite} />

        <EnTeteEcran surtitre="Ma TVA" titre={libellePeriode(periode)} />

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

        <div className="mt-5 px-6">
          {/* **Les deux colonnes, retenues par le patron le 12 août 2026** parmi
              trois présentations (`docs/maquettes/37`). Les trois chiffres
              portent le même poids et la même encre : la déductible était en
              gris, elle avait l'air d'un chiffre de second rang alors que c'est
              celui qu'il va chercher. */}
          <div
            className="flex gap-px overflow-hidden rounded-t-[10px]"
            style={{ backgroundColor: colors.lineSoft }}
          >
            <MontantCopiable libelle="Collectée" montant={formatEuros.format(collectee)} />
            <MontantCopiable libelle="Déductible" montant={formatEuros.format(deductible)} />
          </div>
          {/* **Le reste peut être NÉGATIF, et c'est un état normal** : le mois
              où l'on achète une machine sans facturer grand-chose donne un
              crédit de TVA. Le borner à zéro cacherait le mois où le patron a
              le plus besoin de savoir. */}
          <div
            className="mt-px rounded-b-[10px] px-4 py-4"
            style={{ backgroundColor: colors.card }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px]">Reste à payer</span>
              <span
                className="text-[26px] font-semibold"
                style={{ fontFamily: font.display, color: colors.rust, fontVariantNumeric: "tabular-nums" }}
              >
                {/* **Un vrai signe moins (−), pas le trait d'union du clavier.**
                    Sa demande du 13 août 2026 : « si le reste à payer est
                    négatif, il faut qu'il le marque négativement ». Le trait
                    d'union rendu par le formatage est deux fois plus court et
                    posé plus bas : à 26 px, sur un écran au soleil, il se lit
                    comme une poussière. Le signe moins est à la hauteur des
                    chiffres, et de leur épaisseur. */}
                {reste < 0
                  ? `\u2212 ${formatEuros.format(Math.abs(reste))}`
                  : formatEuros.format(reste)}
              </span>
            </div>
            {/* **Et le signe seul ne suffit pas à dire ce que ça VEUT dire.**
                « Reste à payer − 20 € » se lit mal : on ne paie rien, c'est
                l'inverse. La phrase le dit en clair — et elle n'apparaît que
                dans ce cas, pour ne pas encombrer les onze mois où le montant
                est positif. */}
            {reste < 0 && (
              /* **À GAUCHE, sous le libellé.** Alignée à droite, sa fin
                 passait sous la bulle de l'assistant, qui flotte dans ce coin
                 sur tous les écrans — « c'est l'État qui vous… ». Vu sur
                 capture, jamais autrement. */
              <p className="mt-1.5 text-[12px]" style={{ color: colors.or }}>
                Crédit de TVA — c’est l’État qui vous doit.
              </p>
            )}
          </div>
        </div>

        <AchatsTva
          achats={achats.map((a) => ({
            id: a.id,
            dateAchat: a.dateAchat,
            fournisseur: a.fournisseur,
            totalTtc: a.totalTtc,
            tvaDeductible: a.tvaDeductible,
            saisie: a.saisie,
          }))}
          aujourdHui={jourIso(new Date())}
          periodicite={periodicite}
          annee={periode.annee}
          numero={periode.numero}
        />

        <div className="mt-6 flex flex-col gap-4 px-6">
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
                        <NumeroDeDocument valeur={l.numeroCommercial} /> —{" "}
                        {l.clientNom ?? "Client non renseigné"}
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
