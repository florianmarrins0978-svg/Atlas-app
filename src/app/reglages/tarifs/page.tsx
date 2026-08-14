import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { listerTarifs } from "@/server/repositories/tarifs";
import RubriqueReservee from "../RubriqueReservee";
import ReglagesClient from "../ReglagesClient";

export const dynamic = "force-dynamic";

/**
 * « Tarifs & catalogue » — tout ce qui décide d'un prix, au même endroit.
 *
 * **Le patron, le 14 août 2026 :** *« s'il y a des catégories qu'on a déjà
 * créées dans la partie réglage — exemple, les prix de main-d'œuvre et de
 * machine —, eh bien ça, tu l'intègres directement dans la partie tarif. Et
 * pareil si tu vois d'autres trucs. »*
 *
 * **Ce qui était éparpillé, et l'est encore aujourd'hui :** ses tarifs se
 * saisissaient sur l'écran des réglages, ses grilles de prix vivaient derrière
 * un lien deux blocs plus bas, et le catalogue partagé derrière un troisième —
 * trois adresses pour une seule question, « combien je facture ça ». Elles sont
 * désormais sous le même titre.
 *
 * **Elles ne sont PAS fusionnées, et c'est délibéré.** Les trois ne portent pas
 * la même chose : un tarif est une ligne libre qu'il écrit ; une grille de prix
 * s'apprend de ses devis, case par case, et ne se saisit pas d'avance ; le
 * catalogue est du VOCABULAIRE partagé entre tous les artisans et ne porte
 * aucun prix (`ARCHITECTURE.md` §89). Les mêler ferait croire qu'un prix du
 * catalogue est le sien.
 *
 * **La rubrique refuse un non-propriétaire avant de lire quoi que ce soit** :
 * ce sont ses prix de vente (`docs/QUESTIONS.md` §10).
 */
export default async function TarifsPage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Tarifs & catalogue"
        quoi="Les prix de vente ne se consultent pas depuis un compte salarié."
      />
    );
  }

  const tarifs = await listerTarifs(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          surtitre="Réglages"
          titre="Tarifs & catalogue"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />

        <section className="mx-[26px] mt-[26px]">
          <p className={`mb-[10px] ${libelleCaps}`} style={{ color: colors.muted }}>
            Mes tarifs
          </p>
          <ReglagesClient
            initialTarifs={tarifs.map((t) => ({ id: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite }))}
          />
        </section>

        {/* **Les grilles et le catalogue restent des écrans à part**, et ce
            n'est pas un renvoi paresseux : l'un est un tableau de vingt-quatre
            cases qu'on parcourt, l'autre une liste partagée qui n'appartient
            pas à l'artisan. Les déplier ici donnerait un écran de six mètres,
            exactement celui qu'on vient de défaire. */}
        <section className="mx-[26px] mt-[30px] border-t pt-[18px]" style={{ borderColor: colors.line }}>
          <p className={`mb-[10px] ${libelleCaps}`} style={{ color: colors.muted }}>
            Main-d&apos;œuvre, machine et matière
          </p>

          <Renvoi
            href="/reglages/prix"
            nom="Mes prix"
            dit="Abattre, enlever les grumes, fendre, dessoucher, tailler une haie — le montant par diamètre, par hauteur et par technique."
          />
          <Renvoi
            href="/catalogue"
            nom="Le catalogue"
            dit="Le vocabulaire du métier, partagé : prestations et matériels qu'Atlas sait reconnaître. Il ne porte aucun prix."
            derniere
          />
        </section>
      </div>
    </div>
  );
}

/** Un renvoi vers un écran voisin, dans la grammaire du sommaire. */
function Renvoi({
  href,
  nom,
  dit,
  derniere = false,
}: {
  href: string;
  nom: string;
  dit: string;
  derniere?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[56px] w-full items-center gap-[15px] py-[13px] ${derniere ? "" : "border-b"}`}
      style={derniere ? undefined : { borderColor: colors.line }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
          {nom}
        </span>
        <span className="mt-[3px] block text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
          {dit}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="h-2 w-2 rotate-45"
        style={{
          flex: "none",
          borderRight: `1.5px solid ${colors.chevron}`,
          borderTop: `1.5px solid ${colors.chevron}`,
        }}
      />
    </Link>
  );
}
