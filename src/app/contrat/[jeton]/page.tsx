import { lireContratParJeton } from "@/server/repositories/contrats-entretien";
import { couleursDocument } from "@/lib/design-tokens";
import { avecCivilite } from "@/lib/civilite";
import { enEuros } from "@/lib/euros";
import {
  designationSurLePapier,
  mensualites,
  montantDeLaPrestation,
  passagesDeLaPrestation,
  periodeEnLettres,
  totauxDuContrat,
} from "@/lib/contrats-entretien";
import ReponseContrat from "./ReponseContrat";

// LA PAGE DU CONTRAT, telle que le CLIENT la reçoit par son lien.
//
// **Les couleurs d'origine, comme le devis et le compte rendu** (`ARCHITECTURE.md`
// §248, sa décision du 4 septembre 2026) : ce qui part chez le client ne suit
// pas la charte de l'artisan.
//
// `force-dynamic` est impératif : une mise en cache exposerait le contrat d'un
// client à un autre visiteur.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const ENCRE = couleursDocument.encre;
const ETIQUETTE = couleursDocument.etiquette;
const OR = couleursDocument.accent;

export default async function PageContratClient({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const lu = await lireContratParJeton(jeton);

  // Lien inconnu et contrat effacé donnent le même message : distinguer les
  // deux apprendrait à un visiteur au hasard qu'un jeton a existé.
  if (!lu) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F4EFE8] p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-[18px] font-semibold" style={{ fontFamily: "ui-serif, Georgia, serif", color: ENCRE }}>
            Ce lien n&apos;est plus valable
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: ETIQUETTE }}>
            Contactez votre artisan pour en recevoir un nouveau.
          </p>
        </div>
      </div>
    );
  }

  const { contrat } = lu;
  const totaux = totauxDuContrat(contrat.prestations, contrat.periode, contrat.tauxTva);
  const mensuel = mensualites(totaux.totalTtc, contrat.periode.dureeMois);

  return (
    <div className="min-h-dvh bg-[#F4EFE8] px-5 py-8" data-atlas="page-contrat-client">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm" style={{ color: ENCRE }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: OR }}>
          {lu.entrepriseNom}
        </p>
        <h1 className="mt-2 text-[26px] leading-tight" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          Contrat d&apos;entretien
        </h1>
        <p className="mt-1 text-[15px]" style={{ color: ETIQUETTE }}>
          {avecCivilite(lu.clientNom, lu.clientCivilite ?? undefined)}. {periodeEnLettres(contrat.periode)}
          {contrat.reconduit ? ", reconduit à son terme." : "."}
        </p>

        <div className="mt-6">
          {contrat.prestations.map((p) => {
            const n = passagesDeLaPrestation(p, contrat.periode);
            const montant = montantDeLaPrestation(p, contrat.periode);
            return (
              <div key={p.libelle} className="flex items-baseline justify-between gap-3 border-b py-3" style={{ borderColor: "#ece9e1" }}>
                <span className="min-w-0 text-[15px] leading-snug">{designationSurLePapier(p)}</span>
                <span className="flex-none text-right text-[14px]" style={{ color: ETIQUETTE, fontVariantNumeric: "tabular-nums" }}>
                  {n} × {enEuros(p.prixPassageHt ?? "0")}
                  <br />
                  {montant ? enEuros(montant) : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-1 text-[15px]" style={{ fontVariantNumeric: "tabular-nums" }}>
          <div className="flex justify-between">
            <span>Total HT</span>
            <span>{enEuros(totaux.totalHt)}</span>
          </div>
          <div className="flex justify-between" style={{ color: ETIQUETTE }}>
            <span>TVA {Number(contrat.tauxTva).toLocaleString("fr-FR")} %</span>
            <span>{enEuros(totaux.totalTva)}</span>
          </div>
          <div className="flex justify-between border-t-2 pt-2 text-[18px] font-semibold" style={{ borderColor: ENCRE }}>
            <span>Total TTC</span>
            <span>{enEuros(totaux.totalTtc)}</span>
          </div>
        </div>

        <p className="mt-4 text-[14px] leading-relaxed" style={{ color: ETIQUETTE }}>
          {contrat.facturation === "mois"
            ? `Vous réglez ${enEuros(mensuel.montant)} TTC par mois, le 1er de chaque mois.`
            : "Chaque passage est facturé une fois fait. Un passage qui n'a pas lieu n'est pas facturé."}{" "}
          Les passages sont fixés d&apos;un mois à l&apos;autre selon la météo.
        </p>

        <a
          href={`/contrat/${encodeURIComponent(jeton)}/pdf?telecharger`}
          className="mt-5 inline-block text-[14px] font-medium underline"
          style={{ color: ENCRE }}
        >
          Télécharger le contrat en PDF
        </a>

        <ReponseContrat
          jeton={jeton}
          dejaRepondu={
            contrat.statut === "accepte"
              ? "Vous avez accepté ce contrat."
              : contrat.statut === "refuse"
                ? "Vous avez refusé ce contrat."
                : null
          }
        />
      </div>
    </div>
  );
}
