import { lireDatesParJeton } from "@/server/repositories/dates-du-mois";
import { colors } from "@/lib/design-tokens";
import { EcranDeRetour, TeteDeLettre } from "@/components/atlas/LettreDuClient";
import { avecCivilite } from "@/lib/civilite";
import { duMois, fenetreDuMois } from "@/lib/dates-du-mois";
import { jourIso } from "@/lib/jour";
import ValiderLesDates from "./ValiderLesDates";
import { garderLaPage } from "@/server/garde-page";

// LA PAGE DES DATES DU MOIS, telle que le CLIENT la reçoit par son lien
// (planche 130, sa demande du 27 septembre 2026).
//
// **Les couleurs d'origine, par les jetons** (sa planche du 31 octobre 2026,
// `appli/soignee/client-recoit.html`), comme le contrat et le devis : ce qui part chez
// le client ne suit pas la charte de l'artisan. `force-dynamic` est impératif :
// une mise en cache montrerait les dates d'un client à un autre.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function PageDatesDuMois({ params }: { params: Promise<{ jeton: string }> }) {
  await garderLaPage();
  const { jeton } = await params;
  const aujourdhui = jourIso(new Date());
  const lu = await lireDatesParJeton(jeton, aujourdhui);

  // Lien inconnu et contrat effacé donnent le même message : distinguer les
  // deux apprendrait à un visiteur au hasard qu'un jeton a existé.
  if (!lu) {
    return (
      <EcranDeRetour
        signe="sablier"
        ton="or"
        titre="Ce lien n'est plus valable"
        texte="Contactez votre artisan pour en recevoir un nouveau."
      />
    );
  }

  return (
    <div className="min-h-dvh px-[18px] pt-4 pb-8" style={{ backgroundColor: colors.cream, color: colors.ink }} data-atlas="page-dates-du-mois">
      <div className="mx-auto w-full max-w-md">
        <TeteDeLettre titre={`Vos passages ${duMois(lu.mois)}`} nom={lu.entrepriseNom} />
        <p className="mt-1.5 text-[14.5px] font-semibold leading-[1.4]" style={{ color: colors.ink }}>
          {lu.entrepriseNom}
        </p>
        <p className="mt-px text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
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
