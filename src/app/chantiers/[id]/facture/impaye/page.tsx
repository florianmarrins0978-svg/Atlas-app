import Link from "next/link";
import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { avecCivilite } from "@/lib/civilite";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { jourLisible } from "@/lib/jour";
import { getCurrentCtx } from "@/server/session-ctx";
import { facturesAvecPaiements } from "@/server/repositories/paiements-facture";
import { garderLaPage } from "@/server/garde-page";

/**
 * « Que voulez-vous faire ? » — la question du lien doré de la facture. Ses
 * mots du 24 septembre 2026 : « Je fais un avoir », « Il ne me paiera pas ».
 *
 * **Chaque issue dit ce qu'elle fait** — planche du 2 novembre 2026
 * (`appli/soignee/facture.html`), validée : deux cartes au lieu de deux boutons
 * muets, et sous le titre, à qui et combien, avant quelle date.
 */
export const dynamic = "force-dynamic";

export default async function PageImpaye({ params }: { params: Promise<{ id: string }> }) {
  await garderLaPage();
  const { id } = await params;
  const ctx = await getCurrentCtx();
  // Le lien qui mène ici ne vit que sous une facture partie : sans elle, il
  // n'y a ni impayé à traiter, ni personne à nommer.
  const f = (await facturesAvecPaiements(ctx)).find((x) => x.chantierId === id);
  if (!f) redirect(`/chantiers/${id}/facture`);

  // « Mme Vasseur, 2 126,40 € à régler avant le mercredi 2 décembre ». Réglée
  // depuis, il ne reste que le client : « 0,00 € à régler » ne dirait rien.
  const client = avecCivilite(f.clientNom, f.clientCivilite);
  const du =
    f.etat === "soldee"
      ? null
      : `${enEuros(f.reste)} à régler${f.dateEcheance ? ` avant le ${jourLisible(f.dateEcheance)}` : ""}`;
  const situation = [client, du].filter(Boolean).join(", ");

  const issue = (href: string, cle: string, titre: string, phrase: string) => (
    <Link
      href={href}
      data-atlas={`impaye-${cle}`}
      className="flex min-h-[92px] w-full flex-col items-start justify-center gap-1 rounded-[12px] px-3.5 pb-[13px] pt-3.5 no-underline transition-transform active:scale-[0.985] motion-reduce:transition-none"
      style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` }}
    >
      <span className="text-[17.5px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
        {titre}
      </span>
      <span className="text-[13.5px] leading-[1.35]" style={{ color: colors.inkSoft }}>
        {phrase}
      </span>
    </Link>
  );
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        allure="soignee"
        // L'espace insécable garde « ? » avec son mot quand le titre passe à la ligne.
        titre={"Que voulez-vous faire\u00a0?"}
        precision={situation || undefined}
        retour={{ href: `/chantiers/${id}/facture`, libelle: "Retour à la facture" }}
      />
      <div className="grid gap-2.5 px-[22px] pb-10 pt-5">
        {issue(`/chantiers/${id}/facture/avoir`, "avoir", "Je fais un avoir", "Vous retirez une partie de la facture.")}
        {issue(
          `/chantiers/${id}/facture/non-payee`,
          "non-payee",
          "Il ne me paiera pas",
          "La facture reste due. Atlas arrête de vous la rappeler."
        )}
      </div>
    </div>
  );
}
