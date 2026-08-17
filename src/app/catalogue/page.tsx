import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerCartes } from "@/server/repositories/mots-catalogue";
import MesMots from "./MesMots";

export const dynamic = "force-dynamic";

/**
 * Le catalogue — le vocabulaire du métier, et ses mots à lui par-dessus.
 *
 * **Il a posé la même question deux fois**, capture à l'appui (14 puis 17 août
 * 2026) : *« À quoi sert cette page ?? On peut rien modifier rajouter »*. Un
 * écran qu'il faut expliquer deux fois n'est pas mal compris : il ne dit pas ce
 * qu'il fait. Arrangement **B** de `docs/maquettes/68-mes-mots-au-catalogue.html`.
 *
 * **Trois choses ont changé, et chacune répare un défaut qu'il a vu :**
 *
 *   - **la flèche de retour** existe enfin. On arrive ici depuis « Tarifs &
 *     catalogue » et on n'en repartait que par la barre du bas ;
 *   - **« Aucun prix encore constaté par votre entreprise » a disparu.** Cette
 *     phrase interrogeait `historique_prix`, une mémoire que l'application
 *     n'écrit nulle part : elle ne se serait JAMAIS éteinte. Aucun montant ne
 *     la remplace — la mémoire vivante (`lecons_prix`) range par nature de
 *     chantier, pas par mot de catalogue, et afficher un prix d'abattage sous
 *     « Élagage » serait pire que la phrase d'hier, qui au moins n'inventait
 *     rien (question laissée ouverte au bas de la planche) ;
 *   - **« Synonymes » et « Variantes » disaient la même chose.** Un seul mot
 *     désormais : « Aussi appelé ».
 */
export default async function CataloguePage() {
  const ctx = await getCurrentCtx();
  const [prestations, materiels] = await Promise.all([
    listerCartes(ctx, "prestation"),
    listerCartes(ctx, "materiel"),
  ]);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          surtitre="Réglages"
          titre="Catalogue"
          retour={{ href: "/reglages/tarifs", libelle: "Retour aux tarifs" }}
        />

        <p className="mx-[26px] mt-[18px] text-[13px] leading-[1.55]" style={{ color: colors.muted }}>
          Les mots qu&apos;Atlas reconnaît quand vous dictez.{" "}
          <span style={{ color: colors.or }}>En doré, les vôtres</span> — visibles de vous seul.
        </p>

        <MesMots
          famille="prestation"
          titre="Prestations"
          cartesInitiales={prestations}
          libelleNouvelle="+ Nouvelle prestation"
        />
        <MesMots
          famille="materiel"
          titre="Matériels"
          cartesInitiales={materiels}
          libelleNouvelle="+ Nouveau matériel"
        />
      </div>
    </div>
  );
}
