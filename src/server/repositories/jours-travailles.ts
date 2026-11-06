// Les jours travaillés de chaque salarié sur un mois, et ses jours par zone.
//
// **Ce dépôt ne compte rien.** Il rassemble ce que la base sait (les salariés,
// leurs absences, le planning, ce qui a été corrigé à la main, le réglage des
// zones) et confie le compte aux règles pures : `src/lib/jours-travailles.ts`
// et `src/lib/zones-deplacement.ts`. L'écran et le PDF lisent ce même
// chargement : deux comptes divergeraient (`CLAUDE.md` §3).
//
// **Tout passe par `withEntreprise`** : une requête hors de ce cadre ne rend
// rien, silencieusement.

import { and, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, creneauxChantier, entreprises, equipes, equipesDuChantier, joursTravaillesCorriges } from "../db/schema";
import type { Ctx } from "./context";
import { getEntreprise } from "./entreprises";
import { listerEquipes } from "./equipes";
import { absencesSurLaFenetre } from "./absences-equipe";
import { encoreEnCoursDepuis } from "./occupation-chantiers";
import { libelleSalarie, salariesAffiches, MAX_SALARIES } from "@/lib/equipes";
import { creneauxPoses, type Creneau, type JourIso } from "@/lib/disponibilites";
import { estEnAlsaceMoselle } from "@/lib/jours-feries";
import { avecCivilite } from "@/lib/civilite";
import {
  bornesDuMois,
  compteDuMois,
  joursOuvresDuMois,
  joursSaisisLus,
  motifCorrectionLu,
  type CompteDuMois,
  type MoisIso,
  type MotifCorrection,
} from "@/lib/jours-travailles";
import {
  compteParZone,
  correctionsDeZonesLues,
  joursDuSalarie,
  partsAuPlanning,
  positionSiSituee,
  reglageLu,
  type ChantierPose,
  type CompteParZone,
  type ReglageZones,
  type TeinteZones,
  TEINTES_ZONES,
} from "@/lib/zones-deplacement";

export type SalarieDuMois = {
  rang: number;
  nom: string;
  compte: CompteDuMois;
  /** Le chiffre saisi à la main, ou `null` : le calcul fait foi. */
  saisi: number | null;
  motif: MotifCorrection | null;
  /** Ses jours par zone, quand l'entreprise a des zones. */
  zones: CompteParZone | null;
  /** Les cases corrigées à la main : `{ z0: 3, hors: 1 }`. */
  zonesCorrigees: Record<string, number>;
};

export type MoisDesSalaries = {
  mois: MoisIso;
  entreprise: { nom: string; adresse: string | null; siret: string | null };
  alsaceMoselle: boolean;
  ouvres: number;
  feries: { jour: JourIso; nom: string }[];
  /** `null` : jamais réglé (l'écran invite alors à le faire, une fois). */
  reglage: ReglageZones | null;
  salaries: SalarieDuMois[];
};

/**
 * Tout ce que demandent l'écran Jours travaillés et le PDF du comptable, pour
 * un mois.
 */
export async function moisDesSalaries(ctx: Ctx, mois: MoisIso): Promise<MoisDesSalaries> {
  const { debut, fin } = bornesDuMois(mois);
  const [entreprise, equipesNommees, absences, lu] = await Promise.all([
    getEntreprise(ctx),
    listerEquipes(ctx),
    absencesSurLaFenetre(ctx, debut, fin),
    withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const corrections = await tx
        .select({
          rang: joursTravaillesCorriges.rang,
          jours: joursTravaillesCorriges.jours,
          motif: joursTravaillesCorriges.motif,
          zones: joursTravaillesCorriges.zones,
        })
        .from(joursTravaillesCorriges)
        .where(and(eq(joursTravaillesCorriges.entrepriseId, ctx.entrepriseId), eq(joursTravaillesCorriges.mois, mois)));

      // Les chantiers qui peuvent occuper une demi-journée du mois : ceux posés
      // en un bloc qui court encore au premier du mois, et ceux morcelés dont
      // un morceau tombe dedans.
      const poses = await tx
        .select({
          id: chantiers.id,
          nom: chantiers.nom,
          adresse: chantiers.adresseChantier,
          adresseSituee: chantiers.adresseSituee,
          latitude: chantiers.latitude,
          longitude: chantiers.longitude,
          datePlanifiee: chantiers.datePlanifiee,
          creneauDebut: chantiers.creneauDebut,
          dureeDemiJournees: chantiers.dureeDemiJournees,
          clientNom: clients.nom,
          clientCivilite: clients.civilite,
        })
        .from(chantiers)
        .leftJoin(clients, and(eq(clients.id, chantiers.clientId), eq(clients.entrepriseId, chantiers.entrepriseId)))
        .where(
          and(
            eq(chantiers.entrepriseId, ctx.entrepriseId),
            isNull(chantiers.deletedAt),
            isNotNull(chantiers.datePlanifiee),
            lte(chantiers.datePlanifiee, fin),
            or(
              encoreEnCoursDepuis(debut),
              sql`EXISTS (SELECT 1 FROM ${creneauxChantier} WHERE ${creneauxChantier.chantierId} = ${chantiers.id} AND ${creneauxChantier.jour} BETWEEN ${debut}::date AND ${fin}::date)`
            )
          )
        );
      const ids = poses.map((c) => c.id);
      const [morceaux, coches] = ids.length
        ? await Promise.all([
            tx
              .select({ chantierId: creneauxChantier.chantierId, jour: creneauxChantier.jour, demi: creneauxChantier.demi })
              .from(creneauxChantier)
              .where(inArray(creneauxChantier.chantierId, ids)),
            tx
              .select({
                chantierId: equipesDuChantier.chantierId,
                jour: equipesDuChantier.jour,
                demi: equipesDuChantier.demi,
                rang: equipes.rang,
              })
              .from(equipesDuChantier)
              .innerJoin(equipes, eq(equipes.id, equipesDuChantier.equipeId))
              .where(inArray(equipesDuChantier.chantierId, ids)),
          ])
        : [[], []];
      return { corrections, poses, morceaux, coches };
    }),
  ]);

  const alsaceMoselle = estEnAlsaceMoselle(entreprise?.adresse);
  const reglage = reglageLu(entreprise?.zonesDeplacement);
  const avecZones = reglage !== null && reglage.convention !== "aucune";
  const { ouvres, feries } = joursOuvresDuMois(mois, alsaceMoselle);

  const morceauxPar = new Map<string, Creneau[]>();
  for (const m of lu.morceaux) {
    if (m.demi !== "matin" && m.demi !== "apres_midi") continue;
    morceauxPar.set(m.chantierId, [...(morceauxPar.get(m.chantierId) ?? []), { jour: m.jour, moment: m.demi }]);
  }
  const chantiersPoses: ChantierPose[] = lu.poses.map((c) => ({
    id: c.id,
    // « chez M. Henry » : la liste des jours d'une zone nomme le client.
    nom: c.clientNom ? avecCivilite(c.clientNom, c.clientCivilite) : c.nom,
    adresse: c.adresse,
    position: positionSiSituee(c),
    creneaux: creneauxPoses({
      jour: c.datePlanifiee as JourIso,
      moment: c.creneauDebut === "apres_midi" ? "apres_midi" : c.creneauDebut === "matin" ? "matin" : null,
      dureeDemiJournees: c.dureeDemiJournees,
      creneaux: morceauxPar.get(c.id),
    }),
  }));

  const nombreSalaries = Math.min(MAX_SALARIES, entreprise?.nombreSalaries ?? 0);
  const salaries = salariesAffiches(equipesNommees, nombreSalaries).map((s) => {
    const siennes = absences.filter((a) => a.rang === s.rang);
    // Un férié où le planning le met sur un chantier compte travaillé.
    const auPlanning = partsAuPlanning(s.rang, feries.map((f) => f.jour), chantiersPoses, lu.coches, siennes);
    const compte = compteDuMois(mois, siennes, alsaceMoselle, auPlanning);
    const c = lu.corrections.find((x) => x.rang === s.rang);
    const saisi = c?.jours != null ? joursSaisisLus(Number(c.jours)) : null;
    const valeur = saisi ?? compte.calcul;
    return {
      rang: s.rang,
      nom: libelleSalarie(s, nombreSalaries) ?? `Salarié ${s.rang}`,
      compte,
      saisi,
      motif: motifCorrectionLu(c?.motif, valeur - compte.calcul),
      zones: avecZones
        ? compteParZone(
            joursDuSalarie(s.rang, compte.joursDeTravail, chantiersPoses, lu.coches, siennes),
            reglage.depart,
            reglage.zones
          )
        : null,
      zonesCorrigees: avecZones ? correctionsDeZonesLues(c?.zones, reglage.zones) : {},
    };
  });

  return {
    mois,
    entreprise: { nom: entreprise?.nom ?? "", adresse: entreprise?.adresse ?? null, siret: entreprise?.siret ?? null },
    alsaceMoselle,
    ouvres: ouvres.length,
    feries,
    reglage,
    salaries,
  };
}

/**
 * Écrire ce que le patron a changé pour un salarié et un mois.
 *
 * **Le chiffre égal au calcul ne s'écrit pas** : il redeviendrait figé, et une
 * absence notée ensuite ne le changerait plus. La ligne vide (ni chiffre, ni
 * zones) s'efface.
 *
 * **Rend `false` plutôt que de lever** : le message d'une exception d'action
 * serveur n'arrive jamais jusqu'à lui (`AGENTS.md`).
 */
export async function corrigerLeMois(
  ctx: Ctx,
  entree: {
    rang: number;
    mois: MoisIso;
    /** `undefined` : on n'y touche pas ; `null` : le calcul reprend. */
    jours?: number | null;
    motif?: string | null;
    zones?: Record<string, number> | null;
  }
): Promise<boolean> {
  const rang = Math.trunc(entree.rang);
  if (!Number.isInteger(rang) || rang < 1 || rang > MAX_SALARIES) return false;

  const lu = await moisDesSalaries(ctx, entree.mois);
  const s = lu.salaries.find((x) => x.rang === rang);
  if (!s) return false;

  const jours = entree.jours === undefined ? s.saisi : entree.jours === null ? null : joursSaisisLus(entree.jours);
  if (entree.jours !== undefined && entree.jours !== null && jours === null) return false;
  const saisi = jours !== null && jours !== s.compte.calcul ? jours : null;
  const ecart = (saisi ?? s.compte.calcul) - s.compte.calcul;
  const motif = entree.motif === undefined ? s.motif : motifCorrectionLu(entree.motif, ecart);
  const zones =
    entree.zones === undefined
      ? s.zonesCorrigees
      : lu.reglage
        ? correctionsDeZonesLues(entree.zones, lu.reglage.zones)
        : {};
  // Une case égale au calcul n'est pas une correction.
  const zonesUtiles = Object.fromEntries(
    Object.entries(zones).filter(([cle, n]) => n !== calculDeLaCase(s.zones, cle))
  );
  const vide = saisi === null && Object.keys(zonesUtiles).length === 0;

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const ou = and(
      eq(joursTravaillesCorriges.entrepriseId, ctx.entrepriseId),
      eq(joursTravaillesCorriges.rang, rang),
      eq(joursTravaillesCorriges.mois, entree.mois)
    );
    if (vide) {
      await tx.delete(joursTravaillesCorriges).where(ou);
      return true;
    }
    const valeurs = {
      jours: saisi === null ? null : String(saisi),
      motif: saisi === null ? null : motif,
      zones: Object.keys(zonesUtiles).length ? zonesUtiles : null,
      updatedAt: new Date(),
    };
    await tx
      .insert(joursTravaillesCorriges)
      .values({ entrepriseId: ctx.entrepriseId, rang, mois: entree.mois, ...valeurs })
      .onConflictDoUpdate({
        target: [joursTravaillesCorriges.entrepriseId, joursTravaillesCorriges.rang, joursTravaillesCorriges.mois],
        set: valeurs,
      });
    return true;
  });
}

function calculDeLaCase(zones: CompteParZone | null, cle: string): number {
  if (!zones) return 0;
  if (cle === "hors") return zones.hors;
  return zones.parZone[Number(cle.slice(1))] ?? 0;
}

/** Le réglage des zones de l'entreprise, tel qu'il est écrit. */
export async function lireReglageZones(ctx: Ctx): Promise<{ reglage: ReglageZones | null; adresse: string | null }> {
  const e = await getEntreprise(ctx);
  return { reglage: reglageLu(e?.zonesDeplacement), adresse: e?.adresse ?? null };
}

/**
 * Écrire le réglage des zones. Il a déjà été relu par `reglageLu` : rien
 * d'abîmé ne s'écrit.
 *
 * **Les cases déjà corrigées ne s'effacent pas**, même quand une borne bouge :
 * un mois passé a pu partir chez le comptable avec elles. Une case corrigée
 * garde son trait d'or et son « Remettre le calcul » ; si elle ne tombe plus
 * juste, le total passe au rouge et le dit.
 */
export async function ecrireReglageZones(ctx: Ctx, reglage: ReglageZones): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.update(entreprises).set({ zonesDeplacement: reglage }).where(eq(entreprises.id, ctx.entrepriseId));
  });
}

/**
 * Changer la seule teinte du dégradé, sans toucher aux zones. Rend `false`
 * quand l'entreprise n'a pas de zones ou que la teinte n'existe pas.
 */
export async function changerLaTeinte(ctx: Ctx, teinte: string): Promise<boolean> {
  if (!(TEINTES_ZONES as readonly string[]).includes(teinte)) return false;
  const { reglage } = await lireReglageZones(ctx);
  if (!reglage || reglage.convention === "aucune") return false;
  await ecrireReglageZones(ctx, { ...reglage, teinte: teinte as TeinteZones });
  return true;
}
