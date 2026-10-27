import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import Paquet from "@/components/atlas/reglages/Paquet";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { listerTarifs } from "@/server/repositories/tarifs";
import RubriqueReservee from "../RubriqueReservee";
import ReglagesClient from "../ReglagesClient";
import { garderLaPage } from "@/server/garde-page";
import Picto, { type NomPicto } from "@/components/atlas/reglages/Picto";

export const dynamic = "force-dynamic";

/**
 * « Mes tarifs » — tout ce qui décide d'un prix, au même endroit.
 *
 * **Le titre était « Tarifs & catalogue » jusqu'au 11 octobre 2026**, et la
 * planche validée ce jour-là (`appli/mes-tarifs-corrige.html`, version
 * Corrigé) l'a ramené à ce qu'il vient y faire. Les deux paragraphes qui
 * expliquaient l'écran sont partis avec lui. Le sommaire, lui, garde son nom.
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
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Mes tarifs"
        quoi="Les prix de vente ne se consultent pas depuis un compte salarié."
      />
    );
  }

  const tarifs = await listerTarifs(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        {/* La grammaire des Réglages soignés (planche du 26 octobre 2026,
            `appli/soignee/reglages-tarifs.html`) : le retour et l'assistant sur
            une ligne, le titre seul. Le surtitre doré « RÉGLAGES » est parti,
            comme sur le sommaire. */}
        <EnTeteEcran allure="soignee" titre="Mes tarifs" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />

        <ReglagesClient
          initialTarifs={tarifs.map((t) => ({ id: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite }))}
        >
          {/* **Les grilles et le catalogue restent des écrans à part**, et ce
              n'est pas un renvoi paresseux : l'un est un tableau de vingt-quatre
              cases qu'on parcourt, l'autre une liste partagée qui n'appartient
              pas à l'artisan. Les déplier ici donnerait un écran de six mètres,
              exactement celui qu'on vient de défaire. */}
          <Paquet titre="Mes autres prix">
            <Renvoi href="/reglages/prix" nom="Mes prix" dit="Abattage, dessouchage, taille de haie." picto="etiquette" />
            <Renvoi href="/catalogue" nom="Le catalogue" dit="Prestations et matériels reconnus. Sans prix." picto="liste" />
          </Paquet>
        </ReglagesClient>
      </div>
    </div>
  );
}

/**
 * Un renvoi vers un écran voisin, dans la grammaire du sommaire : l'icône dorée
 * dans sa pastille, le nom en serif, ce qu'on y trouve dessous, le chevron doré.
 */
function Renvoi({ href, nom, dit, picto }: { href: string; nom: string; dit: string; picto: NomPicto }) {
  return (
    <Link href={href} className="relative flex min-h-[72px] w-full items-center gap-[14px] py-3">
      {/* Le filet se pose au-dessus de chaque ligne ; le paquet rogne le premier. */}
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      <PastilleIcone>
        <Picto nom={picto} taille={22} />
      </PastilleIcone>
      <span className="min-w-0 flex-1">
        <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
          {nom}
        </span>
        <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
          {dit}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="h-2 w-2 rotate-45"
        style={{ flex: "none", borderRight: `1.5px solid ${colors.or}`, borderTop: `1.5px solid ${colors.or}` }}
      />
    </Link>
  );
}
