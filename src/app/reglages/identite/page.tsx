import { positionEffective } from "@/lib/mentions-legales";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getEntreprise } from "@/server/repositories/entreprises";
import { facturesAvecAncienIban } from "@/server/repositories/factures";
import { estProprietaire } from "@/server/autorisation";
import IdentiteClient from "./IdentiteClient";
import PeriodiciteTvaReglage from "../PeriodiciteTva";
import ExigibiliteTva from "../ExigibiliteTva";
import { libellePeriode, periodeCourante, PERIODICITE_TVA_PAR_DEFAUT } from "@/server/periode-tva";
import { relevesSousLesDeuxRegimes } from "@/server/repositories/factures";
import { enEuros } from "@/lib/euros";
import { remarquesSurLAttestation } from "@/lib/attestation-lue";
import { jourIso } from "@/lib/jour";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

/**
 * « Identité » — ce qui remplit ses devis et ses factures.
 *
 * **Pourquoi cet écran existe, et pourquoi il était bloquant.** L'identité de
 * l'entreprise ne se saisissait QUE depuis « le devis écrit à la main » : un
 * artisan qui suivait le parcours normal — dicter, chiffrer, envoyer — n'avait
 * jamais l'occasion de saisir son SIRET, et son premier devis partait sans
 * SIRET, sans adresse et sans IBAN (`ARCHITECTURE.md` §87).
 *
 * **L'écran refuse un non-propriétaire plutôt que de masquer.** Une rubrique
 * cachée ne protège rien : ce qu'un rôle n'a pas le droit de voir ne doit pas
 * sortir du serveur (`docs/QUESTIONS.md` §10). Les valeurs ne sont donc pas
 * lues du tout.
 */
export default async function IdentitePage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
        <EnTeteEcran allure="soignee" titre="Mon entreprise" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        <p className="mx-[22px] mt-6 text-[14.5px] leading-[1.5]" style={{ color: colors.inkSoft }}>
          Ces informations appartiennent au patron de l&apos;entreprise. Elles
          portent son identité et ses coordonnées bancaires.
        </p>
      </div>
    );
  }

  const e = await getEntreprise(ctx);
  // **La liste des factures parties avec l'ancien IBAN**, montée ici : la page
  // seule lit la base, l'écran n'affiche que ce qu'elle lui donne. Vide dans
  // l'immense majorité des cas — et rien ne s'affiche alors.
  const aPrevenir = await facturesAvecAncienIban(ctx);
  // **Ce que le régime change sur la période COURANTE**, pour que le choix ne se
  // fasse pas à l'aveugle — sa plainte du 26 août 2026, « rien ne se passe ».
  // Lu ici, sur le serveur, en une seule lecture des factures : la phrase
  // d'écart d'`ExigibiliteTva` compare les deux chiffres.
  const periodicite = e?.periodiciteTva ?? PERIODICITE_TVA_PAR_DEFAUT;
  const courante = periodeCourante(periodicite);
  const releves = await relevesSousLesDeuxRegimes(ctx, courante.debut, courante.fin);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran allure="soignee" titre="Mon entreprise" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
      <IdentiteClient
        initial={{
          nom: e?.nom ?? "",
          formeJuridique: e?.formeJuridique ?? "",
          adresse: e?.adresse ?? "",
          siret: e?.siret ?? "",
          numeroRm: e?.numeroRm ?? "",
          telephone: e?.telephone ?? "",
          email: e?.email ?? "",
          iban: e?.iban ?? "",
          titulaireCompte: e?.titulaireCompte ?? "",
          numeroTva: e?.numeroTva ?? "",
          regimeTva: e?.regimeTva ?? "assujettie",
          // Le champ se retape en entier : « 1000.00 » y serait relu tel quel
          // et réécrit sans qu'on l'ait touché — « 1000 » se retrouve.
          capitalSocial: e?.capitalSocial ? String(Number(e.capitalSocial)) : "",
          villeRcs: e?.villeRcs ?? "",
          assureurDecennale: e?.assureurDecennale ?? "",
          adresseAssureurDecennale: e?.adresseAssureurDecennale ?? "",
          contratDecennale: e?.contratDecennale ?? "",
          couvertureDecennale: e?.couvertureDecennale ?? "",
          mediateurNom: e?.mediateurNom ?? "",
          mediateurCoordonnees: e?.mediateurCoordonnees ?? "",
          // « aucune » ne se propose plus : une société imprime ses mentions (4A).
          mentionsLegalesPosition: positionEffective(e?.mentionsLegalesPosition),
        }}
        aPrevenir={aPrevenir}
        attestationDeposee={!!e?.attestationDecennaleCle}
        remarquesAttestation={
          e?.attestationDecennaleCle
            ? remarquesSurLAttestation(e.attestationDecennaleLue, e.assureurDecennale, jourIso(new Date())).map((r) => r.libelle)
            : []
        }
        declarations={
          <>
            <PeriodiciteTvaReglage initiale={periodicite} />
            <ExigibiliteTva
              actuelle={releves.retenu.regime}
              periode={libellePeriode(courante)}
              tvaRetenue={enEuros(Number(releves.retenu.totalTva))}
              tvaAutre={enEuros(Number(releves.autre.totalTva))}
            />
          </>
        }
      />

      {/* **La périodicité de TVA rejoint le régime de TVA, le 14 août 2026.**
          Elle vivait sur l'écran d'ensemble des réglages, entre le nombre
          d'équipes et les tarifs — à quatre écrans de défilement du régime, qui
          est pourtant la moitié de la même question. Deux réglages fiscaux à
          deux endroits, et le patron devait savoir lequel se trouvait où.

          **Elle se pose DANS le paquet « Votre TVA »** depuis le 6 septembre
          2026 : elle passe en enfant (`declarations`), et l'écran la place sous
          le régime. **Elle reste montée par la PAGE**, et c'est voulu : elle
          seule lit la base. Le recopier dans l'écran en aurait fait deux.

          **Voir un exemple vit dans l'écran** depuis le 26 octobre 2026, collé
          au-dessus de la barre (`ActionBas`) : posé ici, après lui, il aurait
          recouvert la barre d'enregistrement au lieu de lui céder la place. */}
    </div>
  );
}
