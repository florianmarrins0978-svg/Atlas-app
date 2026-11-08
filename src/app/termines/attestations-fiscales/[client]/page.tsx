import Link from "next/link";
import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { anneeDesAttestations, LIBELLES_ETAT } from "@/lib/attestation-fiscale";
import { avecCivilite } from "@/lib/civilite";
import { jourEtMois, jourIso } from "@/lib/jour";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";
import { papierDeLAttestation } from "@/server/repositories/attestations-fiscales";
import { garderLaPage } from "@/server/garde-page";
import { getCurrentCtx } from "@/server/session-ctx";
import { TON_DE_L_ETAT } from "../ton-de-l-etat";
import EnvoyerLAttestation from "./EnvoyerLAttestation";

export const dynamic = "force-dynamic";

/**
 * L'ATTESTATION D'UN CLIENT : la feuille « papier » de sa planche du
 * 8 novembre 2026. Elle se relit ici, telle qu'elle part (le même texte que le
 * PDF, `contenuDeLAttestationFiscale`), et s'envoie seule.
 *
 * **À compléter, elle ne part pas** : ce qui manque se dit sous le papier,
 * jamais sur lui, et le bouton n'existe pas. **Le logo** des services à la
 * personne ne se montre que sur le PDF, comme pour le devis : l'ouvrir à
 * l'écran demanderait d'ouvrir sa clé à la route des fichiers (lot 1).
 */
export default async function PageAttestationDUnClient({ params }: { params: Promise<{ client: string }> }) {
  await garderLaPage();
  const { client } = await params;
  const ctx = await getCurrentCtx();
  const annee = anneeDesAttestations(jourIso(new Date()));
  if (annee === null) redirect("/termines");
  const lu = await papierDeLAttestation(ctx, annee, client, { avecLogo: false });
  if (!lu) redirect("/termines/attestations-fiscales");
  const { contenu, attestation: a } = lu;
  const qui = avecCivilite(a.client.nom, a.client.civilite);
  const adresseDuPdf = `/termines/attestations-fiscales/${a.clientId}/pdf`;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre={qui} retour={{ href: "/termines/attestations-fiscales", libelle: `Retour aux attestations ${annee}` }} allure="commune" />
      <div className="mx-[22px] mt-6 pb-10">
        {/* Le papier, comme il part : l'en-tête, le titre, la phrase, le
            tableau, le montant, le lieu et la date. */}
        <article
          className="rounded-md px-[18px] py-5 text-[14px] leading-[1.5]"
          style={{ backgroundColor: colors.card, color: colors.ink }}
          data-atlas="papier-de-l-attestation"
        >
          <p className="m-0 text-[17px]" style={{ fontFamily: font.display }}>
            {contenu.entete.nom}
          </p>
          {contenu.entete.lignes.map((l) => (
            <p key={l} className="m-0 text-[13px]" style={{ color: colors.inkSoft }}>
              {l}
            </p>
          ))}
          <h2 className="mb-2.5 mt-5 text-[20px] font-normal leading-[1.2]" style={{ fontFamily: font.display }}>
            {contenu.titre}
          </h2>
          <p className="m-0">{contenu.phrase}</p>
          <table className="my-3 w-full border-collapse tabular-nums">
            <thead>
              <tr>
                {["Date", "Durée", "Intervenant"].map((t) => (
                  <th
                    key={t}
                    className="px-1 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: colors.or, borderBottom: `1px solid ${colors.line}` }}
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contenu.lignes.map((l, i) => (
                <tr key={`${l.date}-${l.numero}-${i}`}>
                  <td className="px-1 py-1.5 align-top" style={{ borderBottom: `1px solid ${colors.lineSoft}` }}>
                    {l.date}
                  </td>
                  <td className="px-1 py-1.5 align-top" style={{ borderBottom: `1px solid ${colors.lineSoft}` }}>
                    {l.duree}
                  </td>
                  <td className="px-1 py-1.5 align-top" style={{ borderBottom: `1px solid ${colors.lineSoft}` }}>
                    {l.nom}
                    <small className="block text-[12px]" style={{ color: colors.inkSoft }}>
                      {l.numero}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1.5 flex items-baseline justify-between gap-3">
            <span>{contenu.total.libelle}</span>
            <b className="whitespace-nowrap text-[17px] font-normal" style={{ fontFamily: font.display }}>
              {contenu.total.montant}
            </b>
          </div>
          <p className="mb-0 mt-4">{contenu.lieuEtDate}</p>
        </article>

        {a.etat === "a_completer" ? (
          <div className="mt-5" data-atlas="ce-qui-manque-a-l-attestation">
            <span
              className="inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold"
              style={{ backgroundColor: TON_DE_L_ETAT.a_completer.fond, color: TON_DE_L_ETAT.a_completer.texte }}
            >
              {LIBELLES_ETAT.a_completer}
            </span>
            {a.manques.map((m) => (
              <p key={m} className="mb-0 mt-2 text-[14.5px] leading-[1.45]">
                {m}
              </p>
            ))}
          </div>
        ) : a.etat === "envoyee" && a.envoyeeLe ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3" data-atlas="attestation-envoyee">
            <span
              className="rounded-full px-2.5 py-1 text-[13px] font-semibold"
              style={{ backgroundColor: TON_DE_L_ETAT.envoyee.fond, color: TON_DE_L_ETAT.envoyee.texte }}
            >
              Envoyée le {jourEtMois(jourIso(a.envoyeeLe))}
            </span>
            <Link
              href="/termines/attestations-fiscales"
              className="flex min-h-11 items-center rounded-full px-4 text-[15px] no-underline"
              style={{ color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              Revenir à la liste
            </Link>
          </div>
        ) : (
          <EnvoyerLAttestation
            annee={annee}
            clientId={a.clientId}
            qui={qui}
            adresseDuPdf={adresseDuPdf}
            nomDuFichier={`Attestation fiscale ${annee}, ${a.client.nom}.pdf`}
            canal={a.canal}
            renvoi={a.etat === "a_renvoyer"}
          />
        )}

        {/* Le PDF exact, dans la visionneuse : ce que le client recevra, logo
            compris. Absent tant qu'elle est à compléter : la route le refuse. */}
        {a.etat !== "a_completer" && (
          <Link
            href={adresseDeLaVisionneuse(adresseDuPdf, { surtitre: contenu.titre, titre: qui })}
            className="mx-auto mt-1 block w-max px-3 py-2 text-[14px] font-bold"
            style={{ color: colors.ink }}
            data-atlas="pdf-de-l-attestation"
          >
            Ouvrir le PDF
          </Link>
        )}
      </div>
    </div>
  );
}
