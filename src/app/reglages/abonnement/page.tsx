import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";

export const dynamic = "force-dynamic";

/**
 * « Abonnement » — d'après `maquettes/atlas-reglages-reste.html`, écran 5.
 *
 * **RIEN N'EST DÉCIDÉ ICI, et l'écran le dit en premier.** Ni le prix, ni ce
 * que comprend l'offre, ni le prestataire de paiement : ce sont des décisions
 * du patron, pas des lots de code (`docs/A-FAIRE.md`). Un écran qui montrerait
 * une formule inventée serait exactement ce que `docs/AGENT.md` §3 interdit —
 * un chiffre sans source, sur une page qui parle d'argent.
 *
 * **L'AVERTISSEMENT SUR LE MOT « FACTURES » N'EST PAS UN DÉTAIL.** Ici, il
 * désigne celles qu'Atlas enverrait au patron ; celles de ses clients sont dans
 * « Terminés ». Les confondre serait le premier appel au secours — c'était déjà
 * écrit sur la planche du 13 août.
 *
 * **Réservé au propriétaire** : ce qui touche au paiement de l'entreprise ne
 * sort pas du serveur pour un salarié (`docs/QUESTIONS.md` §10).
 */
export default async function AbonnementPage() {
  const ctx = await getCurrentCtx();

  if (!(await estProprietaire(ctx))) {
    return (
      <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
        <EnTeteEcran
          surtitre="Mon entreprise"
          titre="Abonnement"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />
        <p className="mx-[26px] mt-8 text-[13px] leading-[1.7]" style={{ color: colors.muted }}>
          L&apos;abonnement appartient au patron de l&apos;entreprise.
        </p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Mon entreprise"
        titre="Abonnement"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />

      <div className="pb-24">
        <p className={`mx-[26px] mt-[26px] ${texteSituation}`} style={{ color: colors.muted }}>
          <b style={{ color: colors.ink, fontWeight: 500 }}>Atlas ne vous facture rien aujourd&apos;hui.</b> Ni
          le prix ni le contenu de l&apos;offre ne sont arrêtés — et tant qu&apos;ils ne le sont pas, cet écran
          n&apos;affichera aucun montant : un chiffre inventé sur une page qui parle d&apos;argent finirait par
          être cru.
        </p>

        <section className="mx-[26px] mt-[30px] border-t pt-[18px]" style={{ borderColor: colors.line }}>
          <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
            Ce qu&apos;il y aura ici
          </p>
          <Ligne nom="Formule" dit="Ce qu'elle comprend, et jusqu'où" />
          <Ligne nom="Moyen de paiement" dit="La carte qui sera débitée" />
          <Ligne nom="Vos factures Atlas" dit="Celles que vous recevez, pas celles que vous émettez" derniere />
        </section>

        {/* **Le mot « factures » désigne deux choses opposées**, et la confusion
            se paierait par un appel affolé un soir de trimestre. */}
        <p
          className={`mx-[26px] mt-[30px] border-t pt-[18px] ${texteSituation}`}
          style={{ borderColor: colors.line, color: colors.muted }}
        >
          <b style={{ color: colors.ink, fontWeight: 500 }}>Attention au mot.</b> Ici, « factures » désigne
          celles qu&apos;Atlas vous enverrait. Celles de vos clients sont dans « Terminés », et elles ne
          bougeront jamais d&apos;ici.
        </p>

        <p className={`mx-[26px] mt-5 ${texteSituation}`} style={{ color: colors.muted }}>
          Ce qui bloque n&apos;est pas du code : il faut choisir une offre et un prestataire de paiement. Ces
          points sont dans votre document « à faire ».
        </p>
      </div>
    </div>
  );
}

function Ligne({ nom, dit, derniere }: { nom: string; dit: string; derniere?: boolean }) {
  return (
    <div className={derniere ? "py-[13px]" : "border-b py-[13px]"} style={{ borderColor: colors.line }}>
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1" style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25 }}>
          {nom}
        </span>
        <span className={libelleCaps} style={{ color: colors.or }}>
          Bientôt
        </span>
      </div>
      <p className={`mt-1 ${texteSituation}`} style={{ color: colors.muted }}>
        {dit}
      </p>
    </div>
  );
}
