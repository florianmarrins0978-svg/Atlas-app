import { lireDatesParJeton } from "@/server/repositories/dates-du-mois";
import { couleursDocument } from "@/lib/design-tokens";
import { avecCivilite } from "@/lib/civilite";
import { duMois, fenetreDuMois } from "@/lib/dates-du-mois";
import { versJourIso } from "@/lib/disponibilites";
import ValiderLesDates from "./ValiderLesDates";

// LA PAGE DES DATES DU MOIS, telle que le CLIENT la reçoit par son lien
// (planche 130, sa demande du 27 septembre 2026).
//
// **Les couleurs d'origine**, comme le contrat et le devis : ce qui part chez
// le client ne suit pas la charte de l'artisan. `force-dynamic` est impératif :
// une mise en cache montrerait les dates d'un client à un autre.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const ENCRE = couleursDocument.encre;
const ETIQUETTE = couleursDocument.etiquette;
const OR = couleursDocument.accent;

export default async function PageDatesDuMois({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const aujourdhui = versJourIso(new Date());
  const lu = await lireDatesParJeton(jeton, aujourdhui);

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

  return (
    <div className="min-h-dvh bg-[#F4EFE8] px-5 py-8" data-atlas="page-dates-du-mois">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm" style={{ color: ENCRE }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: OR }}>
          {lu.entrepriseNom}
        </p>
        <h1 className="mt-2 text-[25px] leading-tight" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          Vos passages {duMois(lu.mois)}
        </h1>
        <p className="mt-1 text-[15px]" style={{ color: ETIQUETTE }}>
          {avecCivilite(lu.clientNom, lu.clientCivilite ?? undefined)}, voici les dates prévues.
        </p>
        <ValiderLesDates
          jeton={jeton}
          passages={lu.passages}
          fenetre={fenetreDuMois(lu.mois, aujourdhui)}
          autreDateAutorisee={lu.autreDateAutorisee}
          dejaRepondu={lu.repondu}
          aujourdhui={aujourdhui}
        />
      </div>
    </div>
  );
}
