import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire, getRole } from "@/server/autorisation";
import { peutFacturer } from "@/lib/acces-roles";
import { garderLaPage } from "@/server/garde-page";
import { charteDeLaPersonne } from "@/server/repositories/charte-personne";
import { lireReglageZones, moisDesSalaries } from "@/server/repositories/jours-travailles";
import { situerQuelquesChantiers } from "@/server/planning/appariement";
import { charte, estSombre } from "@/lib/chartes";
import { jourIso } from "@/lib/jour";
import { moisDuJour, moisValide, moisVoisin, nomDuMois, resumeDuMois } from "@/lib/jours-travailles";
import { resumeDesZones } from "@/lib/zones-deplacement";
import JoursTravailles from "./JoursTravailles";
import { vueDuMois } from "./vue";

export const dynamic = "force-dynamic";

/**
 * JOURS TRAVAILLÉS — un compteur par salarié, pour la paie.
 *
 * Sa demande du 5 novembre 2026, et sa planche A
 * (`appli/soignee/jours-travailles.html`) : le compte se fait tout seul, se
 * corrige toujours, et dit pourquoi quand le chiffre bouge. Ses zones de
 * déplacement, réglées dans Équipe, paraissent d'office sous chaque salarié
 * (`appli/soignee/zones-deplacement.html`).
 *
 * **Cet écran ne compte rien** : `moisDesSalaries` rassemble, les règles pures
 * comptent, et le PDF du comptable lit le même chargement.
 */
export default async function PageJoursTravailles({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const ceMois = moisDuJour(jourIso(new Date()));
  const demande = (await searchParams).mois;
  // Le mois d'après n'existe pas encore : rien à payer, rien à compter.
  const mois = moisValide(demande) && demande <= ceMois ? demande : ceMois;

  // **Les chantiers pas encore situés le sont d'abord**, quelques-uns à la
  // fois : sans position, un jour de chantier n'a pas de zone et le total
  // passe au rouge. Seul l'appariement du planning les situait jusqu'ici.
  const { reglage } = await lireReglageZones(ctx);
  if (reglage && reglage.convention !== "aucune") await situerQuelquesChantiers(ctx);

  const [lu, role, proprietaire, nomCharte] = await Promise.all([
    moisDesSalaries(ctx, mois),
    getRole(ctx),
    estProprietaire(ctx),
    charteDeLaPersonne(ctx.utilisateurId),
  ]);

  const nom = nomDuMois(mois);
  const avecZones = lu.reglage !== null && lu.reglage.convention !== "aucune";

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran retour={{ href: "/termines/comptable", libelle: "Pour mon comptable" }} titre="Jours travaillés" />
        <JoursTravailles
          mois={mois}
          nomDuMois={nom.charAt(0).toUpperCase() + nom.slice(1)}
          court={nom.split(" ")[0]}
          precedent={moisVoisin(mois, -1)}
          suivant={mois < ceMois ? moisVoisin(mois, 1) : null}
          resume={resumeDuMois(mois, lu.ouvres, lu.feries, mois === ceMois)}
          peutCorriger={!!role && peutFacturer(role)}
          // Les zones se règlent dans Équipe, qui est au patron seul.
          peutRegler={proprietaire}
          sombre={estSombre(charte(nomCharte).jetons)}
          jamaisRegle={lu.reglage === null}
          zones={
            avecZones && lu.reglage
              ? {
                  resume: resumeDesZones(lu.reglage),
                  zones: lu.reglage.zones,
                  teinte: lu.reglage.teinte,
                  departSitue: lu.reglage.depart !== null,
                }
              : null
          }
          salaries={lu.salaries.map(vueDuMois)}
        />
      </div>
    </div>
  );
}
