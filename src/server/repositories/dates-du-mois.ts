import { randomBytes } from "node:crypto";
import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, contratsEntretien, entreprises, envoisDatesContrat } from "../db/schema";
import type { Ctx } from "./context";
import { contrainteDuPlanning } from "./envois-devis";
import { periodesOccupeesPourEntreprise } from "./agendas-externes";
import { configurationGoogle } from "../agenda/google";
import { ecrireLesCreneaux } from "./creneaux-poses";
import {
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  creneauxDuChantier,
  departPossible,
  dureeEnDemiJournees,
  jourRetenable,
  type JourIso,
} from "@/lib/disponibilites";
import { datesDuMois, fenetreDuMois, finDuMois, lendemain, moisDuPassage, prestationDuPassage, type EnvoiDesDates } from "@/lib/dates-du-mois";
import type { CiviliteChoisie } from "@/lib/civilite";

// LES DATES DU MOIS D'UN CONTRAT : l'envoi au client, sa page, sa réponse.
// Sa demande du 27 septembre 2026, planche 130.
//
// **Les dates ne sont écrites qu'à un endroit : le planning.** L'envoi ne porte
// que le lien et le réglage « autre date » ; la page du client LIT les passages
// posés, et une date qu'il change se réécrit par `ecrireLesCreneaux`, le seul
// écrivain de « où le chantier est posé » (`ARCHITECTURE.md` §322).

export type ContactDuContrat = {
  contratEntretienId: string;
  clientNom: string;
  clientCivilite: CiviliteChoisie | null;
  telephone: string | null;
  email: string | null;
  canal: "sms" | "email" | null;
};

/**
 * Ce que le planning doit savoir pour son tiroir : les envois des mois en cours
 * et à venir, et de quoi joindre chaque client sous contrat accepté.
 */
export async function datesDuMoisPourLePlanning(
  ctx: Ctx,
  aujourdhui: string
): Promise<{ envois: EnvoiDesDates[]; contacts: ContactDuContrat[]; entrepriseNom: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [entreprise] = await tx
      .select({ nom: entreprises.nom })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    const envois = await tx
      .select({
        contratEntretienId: envoisDatesContrat.contratEntretienId,
        mois: envoisDatesContrat.mois,
        envoyeLe: envoisDatesContrat.envoyeLe,
        reponduLe: envoisDatesContrat.reponduLe,
      })
      .from(envoisDatesContrat)
      .where(and(eq(envoisDatesContrat.entrepriseId, ctx.entrepriseId), gte(envoisDatesContrat.mois, `${aujourdhui.slice(0, 7)}-01`)));
    const contacts = await tx
      .select({
        contratEntretienId: contratsEntretien.id,
        clientNom: clients.nom,
        clientCivilite: clients.civilite,
        telephone: clients.telephone,
        email: clients.email,
        canal: clients.canalCommunication,
      })
      .from(contratsEntretien)
      .innerJoin(clients, eq(clients.id, contratsEntretien.clientId))
      .where(and(eq(contratsEntretien.entrepriseId, ctx.entrepriseId), eq(contratsEntretien.statut, "accepte")));
    return {
      entrepriseNom: entreprise?.nom ?? "",
      envois: envois.map((e) => ({
        contratEntretienId: e.contratEntretienId,
        mois: e.mois,
        envoyeLe: e.envoyeLe.toISOString(),
        reponduLe: e.reponduLe ? e.reponduLe.toISOString() : null,
      })),
      contacts: contacts.map((c) => ({
        ...c,
        clientCivilite: (c.clientCivilite ?? null) as CiviliteChoisie | null,
        canal: c.canal === "sms" || c.canal === "email" ? c.canal : null,
      })),
    };
  });
}

type PassageLu = { id: string; nom: string; contratPassage: string; datePlanifiee: string | null };

async function passagesDuMois(
  tx: DbOrTx,
  entrepriseId: string,
  contratId: string,
  mois: string
): Promise<PassageLu[]> {
  const lignes = await tx
    .select({
      id: chantiers.id,
      nom: chantiers.nom,
      contratPassage: chantiers.contratPassage,
      datePlanifiee: chantiers.datePlanifiee,
    })
    .from(chantiers)
    .where(
      and(
        eq(chantiers.entrepriseId, entrepriseId),
        eq(chantiers.contratEntretienId, contratId),
        isNull(chantiers.deletedAt)
      )
    )
    .orderBy(asc(chantiers.datePlanifiee));
  return lignes
    .filter((l): l is PassageLu => l.contratPassage !== null && moisDuPassage(l.contratPassage) === mois);
}

/**
 * L'ENVOI DES DATES D'UN MOIS. Refusé tant qu'une date manque : c'est la même
 * règle que le tiroir (`datesDuMois`), rejouée ici parce qu'un écran ne décide
 * de rien. **Idempotent** : déjà parti sans réponse, il rend le MÊME lien, avec
 * le canal et le réglage du dernier appui ; déjà répondu, il refuse.
 */
export async function envoyerDatesDuMois(
  ctx: Ctx,
  demande: { contratEntretienId: string; mois: string; canal: "sms" | "email"; autreDateAutorisee: boolean },
  aujourdhui: string,
  maintenant: Date = new Date()
): Promise<{ ok: true; jeton: string } | { ok: false; refus: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [contrat] = await tx
      .select({ statut: contratsEntretien.statut })
      .from(contratsEntretien)
      .where(and(eq(contratsEntretien.id, demande.contratEntretienId), eq(contratsEntretien.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!contrat || contrat.statut !== "accepte") return { ok: false as const, refus: "Ce contrat n'est pas accepté." };

    const passages = await passagesDuMois(tx, ctx.entrepriseId, demande.contratEntretienId, demande.mois);
    const [existant] = await tx
      .select()
      .from(envoisDatesContrat)
      .where(and(eq(envoisDatesContrat.contratEntretienId, demande.contratEntretienId), eq(envoisDatesContrat.mois, demande.mois)))
      .limit(1);
    if (existant?.reponduLe) return { ok: false as const, refus: "Le client a déjà validé ses dates de ce mois." };

    const pret = datesDuMois(
      passages.map((p) => ({ ...p, contratEntretienId: demande.contratEntretienId })),
      [],
      aujourdhui
    ).aEnvoyer.some((g) => g.mois === demande.mois);
    if (!pret) return { ok: false as const, refus: "Posez toutes les dates du mois avant de les envoyer." };

    if (existant) {
      await tx
        .update(envoisDatesContrat)
        .set({ canal: demande.canal, autreDateAutorisee: demande.autreDateAutorisee, envoyeLe: maintenant })
        .where(eq(envoisDatesContrat.id, existant.id));
      return { ok: true as const, jeton: existant.jeton };
    }
    const jeton = randomBytes(32).toString("base64url");
    // Deux appuis simultanés : l'unicité (contrat, mois) garde un seul envoi,
    // et le second relit le lien du premier.
    const [pose] = await tx
      .insert(envoisDatesContrat)
      .values({
        entrepriseId: ctx.entrepriseId,
        contratEntretienId: demande.contratEntretienId,
        mois: demande.mois,
        jeton,
        canal: demande.canal,
        autreDateAutorisee: demande.autreDateAutorisee,
        envoyeLe: maintenant,
      })
      .onConflictDoNothing()
      .returning({ jeton: envoisDatesContrat.jeton });
    if (pose) return { ok: true as const, jeton: pose.jeton };
    const [deja] = await tx
      .select({ jeton: envoisDatesContrat.jeton })
      .from(envoisDatesContrat)
      .where(and(eq(envoisDatesContrat.contratEntretienId, demande.contratEntretienId), eq(envoisDatesContrat.mois, demande.mois)))
      .limit(1);
    return deja ? { ok: true as const, jeton: deja.jeton } : { ok: false as const, refus: "L'envoi n'a pas pu être enregistré. Réessayez." };
  });
}

export type DatesPourLeClient = {
  entrepriseNom: string;
  clientNom: string;
  clientCivilite: CiviliteChoisie | null;
  mois: string;
  autreDateAutorisee: boolean;
  repondu: boolean;
  passages: { id: string; libelle: string; jour: string | null; joursPossibles: string[] }[];
};

async function agendaDuMois(entrepriseId: string, mois: string) {
  // Sans agenda relié (le cas général), aucun aller-retour : la leçon du
  // lien du devis (`agendaDuJeton`).
  if (!configurationGoogle()) return [];
  return periodesOccupeesPourEntreprise(entrepriseId, new Date(`${mois}T00:00:00Z`), new Date(`${finDuMois(mois)}T23:59:59Z`));
}

async function entrepriseDuJeton(jeton: string): Promise<{ entrepriseId: string; mois: string } | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_dates', ${jeton}, true)`);
    const [e] = await tx
      .select({ entrepriseId: envoisDatesContrat.entrepriseId, mois: envoisDatesContrat.mois })
      .from(envoisDatesContrat)
      .where(eq(envoisDatesContrat.jeton, jeton))
      .limit(1);
    return e ?? null;
  });
}

/**
 * LA PAGE DU CLIENT, par son jeton : ses passages du mois et, si l'artisan l'a
 * permis, les jours LIBRES du mois entier pour chacun. **Des dates, rien
 * d'autre** : il ne saura jamais pourquoi un jour est pris (la règle du devis).
 */
export async function lireDatesParJeton(jeton: string, aujourdhui: string): Promise<DatesPourLeClient | null> {
  if (!jeton) return null;
  const repere = await entrepriseDuJeton(jeton);
  if (!repere) return null;
  const exterieures = await agendaDuMois(repere.entrepriseId, repere.mois);

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_dates', ${jeton}, true)`);
    const [envoi] = await tx.select().from(envoisDatesContrat).where(eq(envoisDatesContrat.jeton, jeton)).limit(1);
    if (!envoi) return null;
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);

    const [c] = await tx
      .select({ clientNom: clients.nom, clientCivilite: clients.civilite, entrepriseNom: entreprises.nom })
      .from(contratsEntretien)
      .innerJoin(clients, eq(clients.id, contratsEntretien.clientId))
      .innerJoin(entreprises, eq(entreprises.id, contratsEntretien.entrepriseId))
      .where(eq(contratsEntretien.id, envoi.contratEntretienId))
      .limit(1);
    if (!c) return null;

    const passages = await passagesDuMois(tx, envoi.entrepriseId, envoi.contratEntretienId, envoi.mois);
    const fenetre = fenetreDuMois(envoi.mois, aujourdhui);
    const ouvert = envoi.autreDateAutorisee && !envoi.reponduLe && fenetre !== null;

    const lus = [];
    for (const p of passages) {
      const joursPossibles: string[] = [];
      if (ouvert && fenetre) {
        // **Chaque passage se juge sans lui-même** : sa propre place n'est pas
        // un obstacle, celle de ses frères du mois, si.
        const { occupation, nombreEquipes } = await contrainteDuPlanning(tx, envoi.entrepriseId, fenetre, p.id, exterieures);
        const duree = await dureeDuPassage(tx, p.id);
        for (let j = fenetre.debut; j <= fenetre.fin; j = lendemain(j)) {
          if (jourRetenable(j as JourIso, duree, occupation, nombreEquipes, fenetre)) joursPossibles.push(j);
        }
      }
      lus.push({ id: p.id, libelle: prestationDuPassage(p.nom), jour: p.datePlanifiee, joursPossibles });
    }

    return {
      entrepriseNom: c.entrepriseNom,
      clientNom: c.clientNom,
      clientCivilite: (c.clientCivilite ?? null) as CiviliteChoisie | null,
      mois: envoi.mois,
      autreDateAutorisee: envoi.autreDateAutorisee,
      repondu: envoi.reponduLe !== null,
      passages: lus,
    };
  });
}

async function dureeDuPassage(tx: DbOrTx, chantierId: string): Promise<number> {
  const [l] = await tx
    .select({ duree: chantiers.dureeDemiJournees, dureePrevue: chantiers.dureePrevue })
    .from(chantiers)
    .where(eq(chantiers.id, chantierId))
    .limit(1);
  return l?.duree ?? dureeEnDemiJournees(l?.dureePrevue ?? null) ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES;
}

/**
 * LA RÉPONSE DU CLIENT : il valide, et peut avoir choisi un autre jour pour
 * certains passages. **Une seule réponse.** Chaque jour changé se REVÉRIFIE
 * ici contre le planning du moment (un jour libre à l'ouverture peut s'être
 * rempli depuis), puis s'écrit par le seul écrivain des créneaux. Un jour qui
 * ne tient plus refuse toute la réponse : rien n'est écrit à moitié.
 */
export async function validerDatesDuMois(
  jeton: string,
  reponse: { changements: Record<string, string>; adresseIp?: string | null; agent?: string | null },
  aujourdhui: string,
  maintenant: Date = new Date()
): Promise<{ ok: true; changes: number } | { ok: false; motif: "introuvable" | "deja_repondu" | "date_prise" | "autre_date_refusee" }> {
  if (!jeton) return { ok: false, motif: "introuvable" };
  const repere = await entrepriseDuJeton(jeton);
  if (!repere) return { ok: false, motif: "introuvable" };
  const exterieures = await agendaDuMois(repere.entrepriseId, repere.mois);

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_dates', ${jeton}, true)`);
    const [envoi] = await tx.select().from(envoisDatesContrat).where(eq(envoisDatesContrat.jeton, jeton)).limit(1);
    if (!envoi) return { ok: false as const, motif: "introuvable" as const };
    if (envoi.reponduLe) return { ok: false as const, motif: "deja_repondu" as const };
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);

    const passages = await passagesDuMois(tx, envoi.entrepriseId, envoi.contratEntretienId, envoi.mois);
    const changements = Object.entries(reponse.changements).filter(([id, jour]) => {
      const p = passages.find((x) => x.id === id);
      return p !== undefined && p.datePlanifiee !== jour;
    });
    // Un identifiant qui n'est pas un passage de CE mois ne se déplace pas :
    // la réponse d'un client ne touche jamais un autre chantier.
    if (Object.keys(reponse.changements).some((id) => !passages.some((p) => p.id === id))) {
      return { ok: false as const, motif: "date_prise" as const };
    }
    if (changements.length > 0 && !envoi.autreDateAutorisee) return { ok: false as const, motif: "autre_date_refusee" as const };

    const fenetre = fenetreDuMois(envoi.mois, aujourdhui);
    // Les jours se posent un à un : le deuxième passage déplacé doit voir la
    // place que le premier vient de prendre.
    for (const [id, jour] of changements) {
      if (!fenetre || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new DatePrise();
      const { occupation, nombreEquipes } = await contrainteDuPlanning(tx, envoi.entrepriseId, fenetre, id, exterieures);
      const duree = await dureeDuPassage(tx, id);
      if (!jourRetenable(jour as JourIso, duree, occupation, nombreEquipes, fenetre)) {
        throw new DatePrise();
      }
      const moment = departPossible(jour as JourIso, duree, occupation, nombreEquipes);
      if (!moment) throw new DatePrise();
      await ecrireLesCreneaux(tx, { entrepriseId: envoi.entrepriseId }, id, creneauxDuChantier({ jour: jour as JourIso, moment }, duree));
    }

    await tx
      .update(envoisDatesContrat)
      .set({
        reponduLe: maintenant,
        reponseAdresseIp: reponse.adresseIp ?? null,
        reponseAgent: reponse.agent?.slice(0, 500) ?? null,
      })
      .where(and(eq(envoisDatesContrat.id, envoi.id), isNull(envoisDatesContrat.reponduLe)));
    return { ok: true as const, changes: changements.length };
  }).catch((e: unknown) => {
    // **Le rejet annule la transaction ENTIÈRE** : un premier passage déplacé
    // ne reste pas écrit quand le second ne tient plus.
    if (e instanceof DatePrise) return { ok: false as const, motif: "date_prise" as const };
    throw e;
  });
}

class DatePrise extends Error {
  constructor() {
    super("Un jour choisi par le client n'est plus libre.");
    this.name = "DatePrise";
  }
}
