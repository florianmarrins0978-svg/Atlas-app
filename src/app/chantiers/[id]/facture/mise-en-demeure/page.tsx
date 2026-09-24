import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonTelechargerDocument from "@/components/atlas/BoutonTelechargerDocument";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { jourIso } from "@/lib/jour";
import { getCurrentCtx } from "@/server/session-ctx";
import { facturesAvecPaiements } from "@/server/repositories/paiements-facture";
import { miseEnDemeure } from "@/server/repositories/factures-non-payees";

/**
 * « Mise en demeure » — planche `appli/mise-en-demeure.html`, dernier écran :
 * la lettre sur son papier, « Télécharger la lettre », et ce qu'il en fait.
 *
 * L'aperçu et le PDF lisent la MÊME lettre (`lettreDeMiseEnDemeure`) : ce qu'il
 * relit ici est ce qui part en recommandé.
 */
export const dynamic = "force-dynamic";

export default async function PageMiseEnDemeure({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const f = (await facturesAvecPaiements(ctx)).find((x) => x.chantierId === id);
  if (!f || f.etat === "soldee") redirect(`/chantiers/${id}/facture`);
  const r = await miseEnDemeure(ctx, f.id, jourIso(new Date()));
  if (!r.ok) redirect(`/chantiers/${id}/facture`);
  const { lettre, entete } = r;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        titre="Mise en demeure"
        surtitre={`${f.numeroCommercial}${f.clientNom ? `, ${f.clientNom}` : ""}`}
        retour={{ href: `/chantiers/${id}/facture`, libelle: "Retour à la facture" }}
        allure="commune"
      />
      <div className="px-3 pb-10">
        {/* Le papier, pas une carte d'écran : il se lit comme la lettre qu'il
            glissera dans l'enveloppe. */}
        <article
          className="mt-5 rounded-[4px] px-5 py-6 text-[13px] leading-[1.55]"
          style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: "0 6px 18px rgba(20,18,14,0.08)" }}
          data-atlas="lettre-mise-en-demeure"
        >
          <div className="flex justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold">{entete.entrepriseNom}</p>
              {entete.coordonnees.map((l) => (
                <p key={l} className="text-[11.5px]">
                  {l}
                </p>
              ))}
            </div>
            <div className="text-right text-[12.5px]">
              {lettre.destinataire.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          </div>
          <div className="my-4" style={{ borderTop: `1px solid ${colors.line}` }} />
          <p className="text-right">{lettre.lieuEtDate}</p>
          <p className="text-right text-[11.5px] font-semibold">Lettre recommandée avec accusé de réception</p>
          <div className="mt-5 flex items-baseline justify-between gap-3">
            <span className="font-semibold" style={{ color: colors.or, letterSpacing: "0.08em" }}>
              {lettre.titre}
            </span>
            <span className="text-[12px]">{lettre.reference}</span>
          </div>
          <p className="mt-4">{lettre.appellation}</p>
          {lettre.paragraphes.map((segments, i) => (
            <p key={i} className="mt-3">
              {segments.map((s, j) => (s.gras ? <b key={j}>{s.texte}</b> : <span key={j}>{s.texte}</span>))}
            </p>
          ))}
          <p className="mt-3">{lettre.formule}</p>
          <p className="mt-6 text-right font-semibold">{lettre.signature}</p>
        </article>

        <BoutonTelechargerDocument
          fichier={`/api/factures/${f.id}/mise-en-demeure`}
          nom={`mise-en-demeure-${f.numeroCommercial}.pdf`}
          className="atlas-plein mx-auto mt-7 flex min-h-[56px] w-[78%] items-center justify-center rounded-full"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display, fontSize: 20 }}
          dataAtlas="telecharger-mise-en-demeure"
        >
          Télécharger la lettre
        </BoutonTelechargerDocument>
        <p className="mt-3 text-center text-[13.5px]" style={{ color: colors.muted }}>
          À envoyer en recommandé avec accusé de réception.
        </p>
      </div>
    </div>
  );
}
