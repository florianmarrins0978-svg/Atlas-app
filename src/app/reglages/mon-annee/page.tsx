import { after } from "next/server";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { conseilsDePrix, parJourneeNecessaire, prixParTarif } from "@/lib/vos-prix";
import {
  aUnAnDernier,
  joursOuvres,
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
import { estProprietaire } from "@/server/autorisation";
import { donneesMonAnnee } from "@/server/repositories/mon-annee";
import { chercherLesHt } from "@/server/import/traiter-pieces";
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
 * « Vos prix » se range par SES tarifs, lus sur le libellé de chaque ligne
 * (`src/lib/vos-prix.ts`).
 */
export default async function MonAnneePage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  // La facturation lit ; le patron seul pose l'objectif et l'interrupteur. Demandé
  // avant toute lecture, comme toute rubrique de l'entreprise (F8).
  const modifiable = await estProprietaire(ctx);
  const d = await donneesMonAnnee(ctx);
  // Le HT des factures importées avant la migration 0181, cherché après la
  // réponse : l'écran ne l'attend pas, la visite suivante le compte.
  after(() => chercherLesHt(ctx));

  const anDernier = aUnAnDernier(d.pieces, d.annee);
  const etat = d.objectif ? etatDeLAnnee(d.objectif.chiffreAffaires, d.pieces, d.aujourdHui, d.alsaceMoselle) : null;
  const saison = saisonDe(totalParMois(d.pieces, d.annee - 1));
  const reste = etat ? resteMoisParMois(etat.reste, d.aujourdHui, saison, d.alsaceMoselle) : [];
  const prix = prixParTarif(d.vosPrix.chantiers, d.vosPrix.tarifs);
  const parJournee = parJourneeNecessaire(
    d.objectif?.chiffreAffaires ?? null,
    joursOuvres(`${d.annee}-01-01`, `${d.annee}-12-31`, d.alsaceMoselle),
    d.vosPrix.equipes
  );

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24" data-atlas="ecran-mon-annee">
        <EnTeteEcran allure="soignee" titre="Mon année" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        <MonAnnee
          modifiable={modifiable}
          annee={d.annee}
          aujourdHui={d.aujourdHui}
          objectif={d.objectif}
          facture={totalEntre(d.pieces, `${d.annee}-01-01`, d.aujourdHui)}
          totalAnDernier={anDernier ? totalEntre(d.pieces, `${d.annee - 1}-01-01`, `${d.annee - 1}-12-31`) : null}
          etat={etat}
          surTermines={d.surTermines}
          regimeTva={d.regimeTva}
          face={anDernier ? faceAnDernier(d.pieces, d.aujourdHui) : null}
          reste={reste}
          peutRentrer={d.peutRentrer}
          banqueReliee={d.banqueReliee}
          benefice={d.banqueReliee ? beneficeEstime(d.mouvements, d.annee) : null}
          prix={prix}
          parJournee={parJournee}
          conseils={conseilsDePrix(prix, parJournee)}
        />
      </div>
    </div>
  );
}
