import Link from "next/link";
import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import IconeTrait from "@/components/atlas/IconeTrait";
import { colors, font } from "@/lib/design-tokens";
import { anneeDesAttestations, LIBELLES_ETAT, resumeDuClient } from "@/lib/attestation-fiscale";
import { avecCivilite } from "@/lib/civilite";
import { jourIso } from "@/lib/jour";
import { attestationsDeLAnnee } from "@/server/repositories/attestations-fiscales";
import { garderLaPage } from "@/server/garde-page";
import { getCurrentCtx } from "@/server/session-ctx";
import { TON_DE_L_ETAT } from "./ton-de-l-etat";

export const dynamic = "force-dynamic";

/**
 * LES ATTESTATIONS DE L'ANNÉE, client par client — la feuille « Attestations
 * 2026 » de sa planche du 8 novembre 2026. Chaque client ouvre la sienne, qui
 * se relit et part seule (*« le mieux, c'est une par une »*).
 *
 * **Hors de la saison** (après le 31 mars), elle renvoie à Terminés, comme la
 * ligne qui l'ouvre a disparu.
 */

export default async function PageAttestationsFiscales() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const annee = anneeDesAttestations(jourIso(new Date()));
  if (annee === null) redirect("/termines");
  const lu = await attestationsDeLAnnee(ctx, annee);
  if (!lu) redirect("/termines");

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre={`Attestations ${annee}`} retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }} allure="commune" />
      <div className="mx-[22px] mt-6 pb-10">
        {lu.attestations.length === 0 ? (
          <p className="pt-8 text-center text-[17px]" style={{ fontFamily: font.display, color: colors.inkSoft }}>
            Aucune attestation à faire.
          </p>
        ) : (
          <ul className="rounded-md px-[18px] py-1" style={{ backgroundColor: colors.card }} data-atlas="liste-des-attestations">
            {lu.attestations.map((a, rang) => (
              <li key={a.clientId} className={rang > 0 ? "border-t" : ""} style={{ borderColor: colors.line }}>
                <Link
                  href={`/termines/attestations-fiscales/${a.clientId}`}
                  className="flex min-h-[64px] items-center gap-3 py-2.5 no-underline"
                  style={{ color: colors.ink }}
                  data-atlas="attestation-d-un-client"
                  data-etat={a.etat}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[19px] leading-[1.25] [overflow-wrap:anywhere]" style={{ fontFamily: font.display }}>
                      {avecCivilite(a.client.nom, a.client.civilite)}
                    </span>
                    <span className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft }}>
                      {resumeDuClient(a.calcul)}
                    </span>
                  </span>
                  <span
                    className="flex-none whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold"
                    style={{ backgroundColor: TON_DE_L_ETAT[a.etat].fond, color: TON_DE_L_ETAT[a.etat].texte }}
                  >
                    {LIBELLES_ETAT[a.etat]}
                  </span>
                  <span style={{ color: colors.chevron }}>
                    <IconeTrait nom="suivant" taille={20} epaisseur={2} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
