import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { garderLaPage } from "@/server/garde-page";
import { charteDeLaPersonne } from "@/server/repositories/charte-personne";
import { lireReglageZones } from "@/server/repositories/jours-travailles";
import { charte, estSombre } from "@/lib/chartes";
import RubriqueReservee from "../../RubriqueReservee";
import ZonesDeDeplacement from "./ZonesDeDeplacement";

export const dynamic = "force-dynamic";

/**
 * ZONES DE DÉPLACEMENT — sa planche du 5 novembre 2026
 * (`appli/soignee/zones-deplacement.html`, « Le réglage ») : Paysage (barème
 * MSA), Bâtiment, ou Pas de zones ; chaque nom et chaque borne se changent.
 *
 * **Le même écran, d'où qu'on l'ouvre** : depuis Équipe, ou depuis Jours
 * travaillés (Modifier, l'invitation). Seul le retour change.
 */
export default async function PageZones({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return <RubriqueReservee titre="Zones de déplacement" quoi="Les zones décident de ce que vos salariés touchent pour leurs trajets." />;
  }
  const depuisJours = (await searchParams).depuis === "jours";
  const [{ reglage, adresse }, nomCharte] = await Promise.all([lireReglageZones(ctx), charteDeLaPersonne(ctx.utilisateurId)]);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          allure="soignee"
          titre="Zones de déplacement"
          retour={
            depuisJours
              ? { href: "/termines/comptable/jours-travailles", libelle: "Retour aux jours travaillés" }
              : { href: "/reglages/equipe", libelle: "Retour à l’équipe" }
          }
        />
        <ZonesDeDeplacement
          initial={reglage ?? { convention: "aucune", zones: [], teinte: "turquoise", depart: null }}
          adresse={adresse}
          sombre={estSombre(charte(nomCharte).jetons)}
        />
      </div>
    </div>
  );
}
