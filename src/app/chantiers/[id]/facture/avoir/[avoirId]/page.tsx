import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
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

/**
 * « C'est fait » — l'avoir est né, numéroté, son papier composé. Planche
 * `appli/avoir.html`, écran 5 : ce qu'il doit encore, le document, et l'envoi.
 *
 * **L'envoi est celui de la facture**, par SMS ou e-mail, et avec son lien : sa
 * question du 24 septembre 2026, *« ça fait comme pour envoyer un devis ? »*.
 * Le client retrouve l'avoir sous sa facture (`factureParJeton`).
 */
export const dynamic = "force-dynamic";

export default async function PageAvoirFait({ params }: { params: Promise<{ id: string; avoirId: string }> }) {
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
  const qui = a.clientNom ?? "Votre client";
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre="C'est fait" surtitre={`Avoir ${a.numero}`} retour={{ href: `/chantiers/${id}/facture`, libelle: "Retour à la facture" }} allure="commune" />
      <div className="px-[26px] pb-10" data-atlas="avoir-fait">
        <p className="mt-6 text-[16px]" style={{ color: colors.inkSoft }}>
          {doitEncore ? `${qui} ne doit plus que ${enEuros(a.nouveauTtc)}.` : `${qui} ne doit plus rien.`}
        </p>
        <p className="mt-2 text-[14px]" style={{ color: colors.muted }}>
          Avoir de {enEuros(a.totalTtc)} sur la facture {a.factureNumero}. Motif : {a.motif}.
        </p>

        <div className="mt-8" data-atlas="envoyer-avoir">
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

        <Link
          href={adresseDeLaVisionneuse(`/api/avoirs/${a.id}/pdf`, { surtitre: "Avoir", titre: a.numero })}
          className="mt-6 block text-center text-[15px] font-bold no-underline"
          style={{ color: colors.or }}
          data-atlas="avoir-voir-pdf"
        >
          Voir l&apos;avoir
        </Link>
      </div>
    </div>
  );
}
