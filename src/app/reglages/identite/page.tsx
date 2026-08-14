import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getEntreprise } from "@/server/repositories/entreprises";
import { estProprietaire } from "@/server/autorisation";
import IdentiteClient from "./IdentiteClient";

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
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
        <EnTeteEcran surtitre="Mon entreprise" titre="Identité" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        <p className="mx-[26px] mt-8 text-[13px] leading-[1.7]" style={{ color: colors.muted }}>
          Ces informations appartiennent au patron de l&apos;entreprise. Elles
          portent son identité et ses coordonnées bancaires.
        </p>
      </div>
    );
  }

  const e = await getEntreprise(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Mon entreprise"
        titre="Identité"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <IdentiteClient
        initial={{
          nom: e?.nom ?? "",
          formeJuridique: e?.formeJuridique ?? "",
          adresse: e?.adresse ?? "",
          siret: e?.siret ?? "",
          telephone: e?.telephone ?? "",
          email: e?.email ?? "",
          iban: e?.iban ?? "",
          titulaireCompte: e?.titulaireCompte ?? "",
          numeroTva: e?.numeroTva ?? "",
          regimeTva: e?.regimeTva ?? "assujettie",
        }}
      />
    </div>
  );
}
