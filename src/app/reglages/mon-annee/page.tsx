import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import {
  aUnAnDernier,
  beneficeEstime,
  etatDeLAnnee,
  faceAnDernier,
  resteMoisParMois,
  saisonDe,
  totalEntre,
  totalParMois,
} from "@/lib/mon-annee";
import { getCurrentCtx } from "@/server/session-ctx";
import { garderLaPage } from "@/server/garde-page";
import { donneesMonAnnee } from "@/server/repositories/mon-annee";
import MonAnnee from "./MonAnnee";

export const dynamic = "force-dynamic";

/**
 * MON ANNÉE — sa planche du 8 novembre 2026 (`appli/soignee/mon-annee.html`),
 * et son « tu peux coder ça » du même jour. La planche reste la référence :
 * toute correction de cet écran s'y porte D'ABORD.
 *
 * Tout se calcule ICI, sur le serveur, par les règles de `src/lib/mon-annee.ts` ;
 * l'écran ne fait que montrer, et poser les deux gestes (l'objectif,
 * l'interrupteur de Terminés).
 *
 * **Ce qui n'est PAS dans ce lot, et pourquoi** (`TODO.md`) : « Vos prix »,
 * rangés par ses tarifs. Une ligne de devis ne garde pas aujourd'hui le tarif
 * d'où elle vient ; il faut d'abord le lui faire garder, et seuls les devis
 * faits ensuite pourront être rangés.
 */
export default async function MonAnneePage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const d = await donneesMonAnnee(ctx);

  const anDernier = aUnAnDernier(d.pieces, d.annee);
  const etat = d.objectif ? etatDeLAnnee(d.objectif.chiffreAffaires, d.pieces, d.aujourdHui, d.alsaceMoselle) : null;
  const saison = saisonDe(totalParMois(d.pieces, d.annee - 1));
  const reste = etat ? resteMoisParMois(etat.reste, d.aujourdHui, saison, d.alsaceMoselle) : [];

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24" data-atlas="ecran-mon-annee">
        <EnTeteEcran allure="soignee" titre="Mon année" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        <MonAnnee
          annee={d.annee}
          aujourdHui={d.aujourdHui}
          objectif={d.objectif}
          facture={totalEntre(d.pieces, `${d.annee}-01-01`, d.aujourdHui)}
          totalAnDernier={anDernier ? totalEntre(d.pieces, `${d.annee - 1}-01-01`, `${d.annee - 1}-12-31`) : null}
          etat={etat}
          surTermines={d.surTermines}
          face={anDernier ? faceAnDernier(d.pieces, d.aujourdHui) : null}
          reste={reste}
          peutRentrer={d.peutRentrer}
          banqueReliee={d.banqueReliee}
          benefice={d.banqueReliee ? beneficeEstime(d.mouvements, d.annee) : null}
        />
      </div>
    </div>
  );
}
