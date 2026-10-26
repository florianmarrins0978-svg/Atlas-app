import { colors } from "@/lib/design-tokens";

/**
 * UN PAQUET DE RÉGLAGES : un titre doré, et ce qu'il range sur une plage.
 *
 * **Ce que la planche des Réglages soignés a tranché avec lui** (25 et
 * 26 octobre 2026, `appli/soignee/reglages-*.html`) : les réglages voisins se
 * rangent ensemble sous un titre, le titre prend le doré de l'appli, et le
 * paquet se pose sur une plage SANS encadré (*« les paquets restent comme
 * avant, sans cadre »*). Une longue suite de cases sous des libellés en
 * petites capitales se lisait mal ; sept paquets se lisent d'un coup d'œil.
 *
 * `sansPlage` laisse le contenu poser son propre fond : deux cartes de choix
 * côte à côte, une plage teintée, un aperçu de devis.
 */
export default function Paquet({
  titre,
  children,
  sansPlage = false,
  dataAtlas,
}: {
  titre?: string;
  children: React.ReactNode;
  sansPlage?: boolean;
  dataAtlas?: string;
}) {
  return (
    <section className="mx-[22px] mt-7" data-atlas={dataAtlas}>
      {titre && (
        <h2 className="mb-2.5 text-[13px] font-semibold uppercase" style={{ color: colors.or, letterSpacing: "0.12em" }}>
          {titre}
        </h2>
      )}
      {sansPlage ? (
        children
      ) : (
        // `overflow-hidden` rogne le filet posé AU-DESSUS de la première ligne :
        // un voisin caché par un état ne laisse ainsi jamais de trait orphelin.
        <div className="overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
          {children}
        </div>
      )}
    </section>
  );
}
