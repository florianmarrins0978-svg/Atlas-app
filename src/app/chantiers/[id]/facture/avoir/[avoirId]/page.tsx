import { headers } from "next/headers";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import IconeTrait from "@/components/atlas/IconeTrait";
import { avecCivilite } from "@/lib/civilite";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { canalPourJoindre } from "@/lib/message-client";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";
import { getCurrentCtx } from "@/server/session-ctx";
import { originePublique } from "@/server/origine-publique";
import { avoirPourEcran } from "@/server/repositories/avoirs";
import { getChantier } from "@/server/repositories/chantiers";
import { getClient } from "@/server/repositories/clients";
import { getEntreprise } from "@/server/repositories/entreprises";
import { jetonVivantDeLaFacture } from "@/server/repositories/envois-factures";
import TransmettreLaFacture from "../../TransmettreLaFacture";
import VoirLAvoir from "./VoirLAvoir";
import { garderLaPage } from "@/server/garde-page";

/**
 * « C'est fait » : l'avoir est né, numéroté, son papier composé. Planche du
 * 2 novembre 2026 (`appli/soignee/facture.html`, « Détail d'un avoir ») : une
 * coche, ce qu'il doit encore avec sa civilité, l'avoir en une ligne, le
 * document en pastille, et l'envoi en bas.
 *
 * **L'envoi est celui de la facture**, par SMS ou e-mail, et avec son lien : sa
 * question du 24 septembre 2026, *« ça fait comme pour envoyer un devis ? »*.
 * Le client retrouve l'avoir sous sa facture (`factureParJeton`).
 */
export const dynamic = "force-dynamic";

export default async function PageAvoirFait({ params }: { params: Promise<{ id: string; avoirId: string }> }) {
  await garderLaPage();
  const { id, avoirId } = await params;
  const ctx = await getCurrentCtx();
  const a = await avoirPourEcran(ctx, avoirId);
  if (!a || a.chantierId !== id) notFound();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();
  const [entreprise, client, jeton] = await Promise.all([
    getEntreprise(ctx),
    chantier.clientId ? getClient(ctx, chantier.clientId) : Promise.resolve(null),
    jetonVivantDeLaFacture(ctx, a.factureId),
  ]);
  const origine = originePublique(await headers());

  const doitEncore = Number(a.nouveauTtc) > 0;
  // « Mme Vasseur ne doit plus que… », jamais « Vasseur ne doit plus… » : la
  // remarque de la planche, et la civilité figée sur la facture.
  const qui = avecCivilite(a.clientNom, a.clientCivilite) || "Votre client";
  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        // La hauteur de `.atlas-ecran` (`globals.css`) en plancher, et non en
        // hauteur figée : l'envoi se pose en bas comme sur la planche quand la
        // place le permet, et suit le texte sans rien recouvrir quand elle
        // manque. Sa hauteur change (une coordonnée à saisir l'allonge) ; une
        // barre fixe l'aurait posé sur « Voir l'avoir ».
        minHeight: "calc(100dvh - var(--atlas-bandeau) - var(--atlas-barre) - env(safe-area-inset-top))",
      }}
    >
      <EnTeteEcran allure="soignee" titre="C'est fait" retour={{ href: `/chantiers/${id}/facture`, libelle: "Retour à la facture" }} />
      <div className="flex flex-1 flex-col px-[22px] pb-6" data-atlas="avoir-fait">
        <span
          aria-hidden="true"
          className="mx-auto mb-3.5 mt-7 grid h-16 w-16 place-items-center rounded-full"
          style={{ color: colors.carteVertTexte, backgroundColor: colors.carteVertFond }}
        >
          <IconeTrait nom="coche" taille={30} />
        </span>
        <p className="text-center text-[22px] leading-[1.3]" style={{ fontFamily: font.display, color: colors.ink }}>
          {doitEncore ? `${qui} ne doit plus que ${enEuros(a.nouveauTtc)}.` : `${qui} ne doit plus rien.`}
        </p>
        <p className="mt-2 text-center text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
          Avoir <span className="whitespace-nowrap">{a.numero}</span> de <span className="whitespace-nowrap">{enEuros(a.totalTtc)}</span> sur la
          facture <span className="whitespace-nowrap">{a.factureNumero}</span>, pour {`« ${a.motif} »`}
        </p>
        <div className="mt-4 flex justify-center">
          <VoirLAvoir adresse={adresseDeLaVisionneuse(`/api/avoirs/${a.id}/pdf`, { surtitre: "Avoir", titre: a.numero })} />
        </div>

        <div className="mt-auto pt-8" data-atlas="envoyer-avoir">
          <TransmettreLaFacture
            factureId={a.factureId}
            clientId={chantier.clientId ?? null}
            clientNom={a.clientNom ?? ""}
            clientCivilite={a.clientCivilite}
            entrepriseNom={entreprise?.nom ?? ""}
            modeleMessage={null}
            numeroFacture={a.factureNumero}
            echeanceLisible={null}
            canal={
              canalPourJoindre({
                canal: (client?.canalCommunication as "sms" | "email" | null) ?? null,
                telephone: client?.telephone,
                email: client?.email,
              }) ?? "sms"
            }
            jetonInitial={jeton}
            telephone={client?.telephone ?? ""}
            email={client?.email ?? ""}
            origine={origine}
            avoir={{ numero: a.numero }}
          />
        </div>
      </div>
    </div>
  );
}
