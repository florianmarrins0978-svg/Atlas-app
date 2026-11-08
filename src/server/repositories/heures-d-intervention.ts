/**
 * LES HEURES DU RETOUR DU JOUR, côté base (migration 0179).
 *
 * Ce dépôt rassemble ce que la base sait (la déclaration, la case de la pièce
 * du chantier, ses demi-journées, qui y est coché, les absences, les numéros
 * d'intervenant) et confie la décision aux règles pures
 * (`src/lib/heures-d-intervention.ts`). L'écran et l'action lisent la même
 * situation : la liste qui s'affiche est celle que l'action accepte.
 *
 * **La table neuve n'est lue que pour une entreprise déclarée, sur un chantier
 * dont la case est retenue.** Partout ailleurs, la fiche d'intervention ne
 * fait qu'une requête de plus sur `entreprises`, et une base où la migration
 * 0179 manquerait encore ne ferait tomber aucun retour du jour.
 *
 * **Tout passe par `withEntreprise`** (`CLAUDE.md` §3), ou par la transaction
 * du retour, qui écrit les heures avec lui (`poserLeRetour`).
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import {
  chantiers,
  clients,
  creneauxChantier,
  devis,
  entreprises,
  equipes,
  equipesDuChantier,
  factures,
  heuresDIntervention,
} from "../db/schema";
import type { Ctx } from "./context";
import { absencesSurLaFenetre } from "./absences-equipe";
import { patronDans } from "./membres-entreprise";
import { numerosDesIntervenants } from "./services-a-la-personne";
import { creneauxPoses, type Creneau, type JourIso } from "@/lib/disponibilites";
import { jourIso } from "@/lib/jour";
import type { Coche } from "@/lib/zones-deplacement";
import {
  caseDuChantier,
  intervenantsDuJour,
  phrasePourLAttestation,
  type HeureAEcrire,
  type IntervenantDuJour,
  type SalarieDeLEquipe,
} from "@/lib/heures-d-intervention";

/** Ce que la fiche montre sous « Combien d'heures ? ». */
export type HeuresDuRetour = {
  /** « Pour l'attestation de Mr. Lambert. » */
  pour: string;
  intervenants: { numero: number; libelle: string; minutes: number }[];
};

/** Ce que la base dit du chantier ce jour-là, avant la règle. */
type SituationDuJour = {
  pour: string;
  nombreSalaries: number;
  chantier: { id: string; nom: string; creneaux: Creneau[] };
  coches: Coche[];
  salaries: SalarieDeLEquipe[];
  patron: string | null;
};

/**
 * La situation du chantier ce jour-là, ou `null` quand les heures n'ont rien à
 * faire ici : entreprise non déclarée, chantier introuvable, case non retenue.
 */
async function situationDuJour(tx: DbOrTx, entrepriseId: string, chantierId: string): Promise<SituationDuJour | null> {
  const [e] = await tx
    .select({
      declaree: entreprises.sapDeclaree,
      activiteACote: entreprises.sapActiviteACote,
      nombreSalaries: entreprises.nombreSalaries,
    })
    .from(entreprises)
    .where(eq(entreprises.id, entrepriseId))
    .limit(1);
  if (!e?.declaree) return null;

  const [c] = await tx
    .select({
      id: chantiers.id,
      nom: chantiers.nom,
      datePlanifiee: chantiers.datePlanifiee,
      creneauDebut: chantiers.creneauDebut,
      dureeDemiJournees: chantiers.dureeDemiJournees,
      clientNom: clients.nom,
      clientCivilite: clients.civilite,
    })
    .from(chantiers)
    .leftJoin(clients, and(eq(clients.id, chantiers.clientId), eq(clients.entrepriseId, chantiers.entrepriseId)))
    .where(and(eq(chantiers.id, chantierId), eq(chantiers.entrepriseId, entrepriseId)))
    .limit(1);
  if (!c) return null;

  const [facture] = await tx
    .select({ coche: factures.servicesALaPersonne })
    .from(factures)
    .where(eq(factures.chantierId, chantierId))
    .limit(1);
  const [dernier] = await tx
    .select({ coche: devis.servicesALaPersonne })
    .from(devis)
    .where(eq(devis.chantierId, chantierId))
    .orderBy(desc(devis.numeroVersion))
    .limit(1);
  const retenue = caseDuChantier({
    facture: facture ? facture.coche : null,
    devis: dernier ? dernier.coche : null,
    declaree: e.declaree,
    activiteACote: e.activiteACote,
    clientNom: c.clientNom,
    clientCivilite: c.clientCivilite,
  });
  if (!retenue) return null;

  const morceaux = await tx
    .select({ jour: creneauxChantier.jour, demi: creneauxChantier.demi })
    .from(creneauxChantier)
    .where(eq(creneauxChantier.chantierId, chantierId));
  const morceauxLus: Creneau[] = morceaux.flatMap((m) =>
    m.demi === "matin" || m.demi === "apres_midi" ? [{ jour: m.jour, moment: m.demi }] : []
  );
  // Ni date ni morceau : le chantier attend dans « Sans date », il n'est posé nulle part.
  const creneaux =
    c.datePlanifiee === null && morceauxLus.length === 0
      ? []
      : creneauxPoses({
          jour: c.datePlanifiee ?? morceauxLus[0]!.jour,
          moment: c.creneauDebut === "apres_midi" ? "apres_midi" : c.creneauDebut === "matin" ? "matin" : null,
          dureeDemiJournees: c.dureeDemiJournees,
          creneaux: morceauxLus,
        });

  const coches = await tx
    .select({ jour: equipesDuChantier.jour, demi: equipesDuChantier.demi, rang: equipes.rang })
    .from(equipesDuChantier)
    .innerJoin(equipes, eq(equipes.id, equipesDuChantier.equipeId))
    .where(eq(equipesDuChantier.chantierId, chantierId));
  const salaries = await tx
    .select({ rang: equipes.rang, nom: equipes.nom, numero: equipes.numeroIntervenant })
    .from(equipes)
    .where(eq(equipes.entrepriseId, entrepriseId))
    .orderBy(asc(equipes.rang));
  const patron = await patronDans(tx, entrepriseId);

  return {
    pour: phrasePourLAttestation(c.clientNom, c.clientCivilite),
    nombreSalaries: e.nombreSalaries,
    chantier: { id: c.id, nom: c.nom, creneaux },
    coches: coches.map((x) => ({ chantierId, jour: x.jour, demi: x.demi, rang: x.rang })),
    salaries,
    patron: patron?.nom ?? null,
  };
}

/** La règle, appliquée à la situation lue et aux absences du jour. */
async function intervenantsDeLaSituation(ctx: Ctx, s: SituationDuJour, jour: JourIso): Promise<IntervenantDuJour[]> {
  // Les absences ne se lisent que s'il y a des salariés : le patron seul n'en a pas.
  const absences = s.nombreSalaries > 0 ? await absencesSurLaFenetre(ctx, jour, jour) : [];
  return intervenantsDuJour({ ...s, jour, absences });
}

/**
 * Ce que la fiche montre sous « Combien d'heures ? », ou `null` : la section
 * n'existe pas.
 *
 * **C'est ici que les lignes d'équipe d'avant reçoivent leur numéro** : la
 * même porte que la lecture d'Équipe (`numerosDesIntervenants`), et seulement
 * quand une ligne en manque. Un salarié coché sans numéro ne taperait des
 * heures pour aucune attestation.
 */
export async function heuresDuRetour(ctx: Ctx, chantierId: string, maintenant: Date = new Date()): Promise<HeuresDuRetour | null> {
  const jour = jourIso(maintenant);
  const lire = () => withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => situationDuJour(tx, ctx.entrepriseId, chantierId));
  let situation = await lire();
  if (!situation) return null;
  // Seules les lignes que le compteur montre se numérotent (la règle du lot 1) :
  // une ligne gardée au-delà ne relancerait la numérotation à chaque ouverture.
  const nombre = situation.nombreSalaries;
  if (nombre > 0 && situation.salaries.some((s) => s.rang <= nombre && s.numero === null)) {
    await numerosDesIntervenants(ctx);
    situation = await lire();
    if (!situation) return null;
  }
  const intervenants = await intervenantsDeLaSituation(ctx, situation, jour);
  if (intervenants.length === 0) return null;

  // Ce qui est déjà tapé aujourd'hui revient dans les roulettes : un second
  // retour du jour, ou une modification, repart des heures du premier.
  const deja = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({ numero: heuresDIntervention.intervenantNumero, minutes: heuresDIntervention.minutes })
      .from(heuresDIntervention)
      .where(
        and(
          eq(heuresDIntervention.entrepriseId, ctx.entrepriseId),
          eq(heuresDIntervention.chantierId, chantierId),
          eq(heuresDIntervention.jour, jour)
        )
      )
  );
  const minutes = new Map(deja.map((h) => [h.numero, h.minutes]));
  return {
    pour: situation.pour,
    intervenants: intervenants.map((i) => ({ numero: i.numero, libelle: i.libelle, minutes: minutes.get(i.numero) ?? 0 })),
  };
}

/**
 * Les intervenants que l'action accepte aujourd'hui, et le jour, ou `null`
 * quand la section n'existe plus (la case décochée entre-temps) : les heures
 * reçues sont alors sans objet, et le retour part sans elles.
 *
 * **Rien ne se numérote ici** : l'écran l'a fait en s'ouvrant. Une ligne sans
 * numéro n'est pas acceptée, comme elle n'était pas montrée.
 */
export async function intervenantsPermis(
  ctx: Ctx,
  chantierId: string,
  maintenant: Date = new Date()
): Promise<{ jour: JourIso; intervenants: IntervenantDuJour[] } | null> {
  const jour = jourIso(maintenant);
  const situation = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    situationDuJour(tx, ctx.entrepriseId, chantierId)
  );
  if (!situation) return null;
  return { jour, intervenants: await intervenantsDeLaSituation(ctx, situation, jour) };
}

/** Ce que le retour emporte : le jour, et une ligne par intervenant. */
export type HeuresDuJour = { jour: JourIso; lignes: readonly HeureAEcrire[] };

/**
 * Les heures du jour, réécrites en entier : **ce qui part est ce qui compte.**
 * Un salarié décoché depuis le premier envoi perd la ligne qu'il avait ; zéro
 * n'écrit rien. Dans la transaction du retour : les heures et le retour
 * s'écrivent ensemble, ou pas du tout.
 */
export async function ecrireLesHeuresDans(tx: DbOrTx, ctx: Ctx, chantierId: string, heures: HeuresDuJour): Promise<void> {
  await tx
    .delete(heuresDIntervention)
    .where(
      and(
        eq(heuresDIntervention.entrepriseId, ctx.entrepriseId),
        eq(heuresDIntervention.chantierId, chantierId),
        eq(heuresDIntervention.jour, heures.jour)
      )
    );
  const aEcrire = heures.lignes.filter((l) => l.minutes > 0);
  if (aEcrire.length === 0) return;
  await tx.insert(heuresDIntervention).values(
    aEcrire.map((l) => ({
      entrepriseId: ctx.entrepriseId,
      chantierId,
      jour: heures.jour,
      intervenantNumero: l.numero,
      intervenantNom: l.nom,
      minutes: l.minutes,
      posePar: ctx.utilisateurId,
    }))
  );
}
