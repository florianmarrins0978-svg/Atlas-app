import type { ComponentProps } from "react";
import type { Ctx } from "@/server/repositories/context";
import { estProprietaire, getRole } from "@/server/autorisation";
import { peutFacturer } from "@/lib/acces-roles";
import { charteDeLaPersonne } from "@/server/repositories/charte-personne";
import { lireReglageZones, moisDesSalaries } from "@/server/repositories/jours-travailles";
import { situerQuelquesChantiers } from "@/server/planning/appariement";
import { charte, estSombre } from "@/lib/chartes";
import { jourIso } from "@/lib/jour";
import { moisDuJour, moisValide, moisVoisin, nomDuMois, resumeDuMois } from "@/lib/jours-travailles";
import { resumeDesZones } from "@/lib/zones-deplacement";
import type JoursTravailles from "./JoursTravailles";
import { vueDuMois } from "./vue";

/**
 * Ce que l'écran Jours travaillés reçoit, pour le mois demandé.
 *
 * **Une seule préparation pour ses deux portes** (Pour mon comptable et
 * Équipe, sa demande du 8 novembre 2026) : deux pages qui la recopieraient
 * finiraient par compter deux mois différents (`CLAUDE.md` §3). Rien n'est
 * compté ici : `moisDesSalaries` rassemble, les règles pures comptent.
 */
export async function chargerJoursTravailles(
  ctx: Ctx,
  demande: unknown
): Promise<Omit<ComponentProps<typeof JoursTravailles>, "ou">> {
  const ceMois = moisDuJour(jourIso(new Date()));
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

  return {
    mois,
    nomDuMois: nom.charAt(0).toUpperCase() + nom.slice(1),
    court: nom.split(" ")[0],
    precedent: moisVoisin(mois, -1),
    suivant: mois < ceMois ? moisVoisin(mois, 1) : null,
    resume: resumeDuMois(mois, lu.ouvres, lu.feries, mois === ceMois),
    peutCorriger: !!role && peutFacturer(role),
    // Les zones se règlent dans Équipe, qui est au patron seul.
    peutRegler: proprietaire,
    sombre: estSombre(charte(nomCharte).jetons),
    jamaisRegle: lu.reglage === null,
    zones:
      avecZones && lu.reglage
        ? {
            resume: resumeDesZones(lu.reglage),
            zones: lu.reglage.zones,
            teinte: lu.reglage.teinte,
            departSitue: lu.reglage.depart !== null,
          }
        : null,
    salaries: lu.salaries.map(vueDuMois),
  };
}
