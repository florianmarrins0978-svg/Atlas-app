/**
 * LES DOSSIERS DU PLAN D'ARROSAGE — ce que la base garde d'un plan
 * (migration 0193, `ARCHITECTURE.md` §599, planche `appli/arrosage-dossiers.html`).
 *
 * Ce fichier lit et écrit ; il ne calcule rien. Le plan figé, son empreinte et
 * son résumé viennent de `src/lib/arrosage/plan-enregistre.ts`, que l'écran
 * emploie aussi.
 *
 * **Trois règles qui ne bougent pas** (sa demande du 21 novembre 2026) :
 *   1. un enregistrement ne s'écrase pas : chaque fois, une version de plus ;
 *   2. le même plan enregistré deux fois de suite ne fait pas de version ;
 *   3. supprimer un dossier, c'est l'OUBLIER : son nom, son lien au client, la
 *      photo du croquis, ce que l'IA y a lu et le PDF (qui porte le nom)
 *      partent aussitôt ; le calcul seul reste cinq ans, puis s'efface
 *      (sa réponse 2, `docs/arrosage-dossiers.md`).
 */
import { and, asc, desc, eq, inArray, isNull, lte, max, sql } from "drizzle-orm";
import { avecCivilite } from "@/lib/civilite";
import type { PlanFige, SaisieDuPlan } from "@/lib/arrosage/plan-enregistre";
import { versionSuivante } from "@/lib/arrosage/plan-enregistre";
import { db } from "../db/client";
import type { DbOrTx } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { clients, dossiersArrosage, dossiersArrosageAPurger, fichiersAPurger, plansArrosage } from "../db/schema";
import type { Ctx } from "./context";

/** Cinq ans : la prescription des actions entre commerçants (Code de commerce L110-4). */
export const ANNEES_DE_TRACE = 5;

export const NOM_MAX = 120;

export type DossierListe = {
  id: string;
  nom: string;
  client: { id: string; nom: string } | null;
  plans: number;
  dernier: Date | null;
};

export type VersionDuDossier = { id: string; version: number; resume: string; avecPhoto: boolean; createdAt: Date };

export type DossierOuvert = DossierListe & { versions: VersionDuDossier[] };

export type PlanEnregistre = {
  id: string;
  dossierId: string;
  dossierNom: string;
  version: number;
  saisie: SaisieDuPlan;
  resultat: PlanFige;
  resume: string;
  photoCle: string | null;
  pdfCle: string | null;
  createdAt: Date;
};

type Refus = { ok: false; raison: string };

/** Un nom de dossier se relit : vide, trop long, ou déjà pris par un autre dossier vivant. */
export function nomDuDossier(brut: unknown): { ok: true; nom: string } | Refus {
  const nom = typeof brut === "string" ? brut.trim().replace(/\s+/g, " ") : "";
  if (nom === "") return { ok: false, raison: "Donnez un nom au dossier." };
  if (nom.length > NOM_MAX) return { ok: false, raison: `Ce nom dépasse ${NOM_MAX} caractères.` };
  return { ok: true, nom };
}

const nomDuClient = (c: { nom: string; civilite: "mr" | "mme" | "entreprise" | "public" | null }) => avecCivilite(c.nom, c.civilite ?? undefined);

async function nomDejaPris(tx: DbOrTx, nom: string, sauf: string | null): Promise<boolean> {
  const lignes = await tx
    .select({ id: dossiersArrosage.id })
    .from(dossiersArrosage)
    .where(and(isNull(dossiersArrosage.oublieLe), sql`lower(${dossiersArrosage.nom}) = lower(${nom})`));
  return lignes.some((l) => l.id !== sauf);
}

/** Le client d'un dossier, s'il est de CETTE entreprise et pas effacé ; sinon, le dire. */
async function clientValide(tx: DbOrTx, clientId: string | null): Promise<{ ok: true } | Refus> {
  if (clientId === null) return { ok: true };
  const [c] = await tx
    .select({ id: clients.id, effaceLe: clients.effaceLe, deletedAt: clients.deletedAt })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!c || c.effaceLe || c.deletedAt) return { ok: false, raison: "Cette fiche client n’existe plus." };
  return { ok: true };
}

export async function listerDossiers(ctx: Ctx): Promise<DossierListe[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const dossiers = await tx
      .select({ id: dossiersArrosage.id, nom: dossiersArrosage.nom, clientId: clients.id, clientNom: clients.nom, civilite: clients.civilite })
      .from(dossiersArrosage)
      .leftJoin(clients, eq(clients.id, dossiersArrosage.clientId))
      .where(isNull(dossiersArrosage.oublieLe))
      .orderBy(desc(dossiersArrosage.updatedAt));
    const comptes = dossiers.length
      ? await tx
          .select({ dossierId: plansArrosage.dossierId, n: sql<number>`count(*)::int`, dernier: max(plansArrosage.createdAt) })
          .from(plansArrosage)
          .where(inArray(plansArrosage.dossierId, dossiers.map((d) => d.id)))
          .groupBy(plansArrosage.dossierId)
      : [];
    const parDossier = new Map(comptes.map((c) => [c.dossierId, c]));
    return dossiers.map((d) => ({
      id: d.id,
      // Un dossier vivant a toujours un nom : la base le refuse autrement (0193).
      nom: d.nom as string,
      client: d.clientId && d.clientNom ? { id: d.clientId, nom: nomDuClient({ nom: d.clientNom, civilite: d.civilite }) } : null,
      plans: parDossier.get(d.id)?.n ?? 0,
      dernier: parDossier.get(d.id)?.dernier ?? null,
    }));
  });
}

export async function creerDossier(ctx: Ctx, entree: { nom: unknown; clientId: string | null }): Promise<{ ok: true; id: string } | Refus> {
  const lu = nomDuDossier(entree.nom);
  if (!lu.ok) return lu;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    if (await nomDejaPris(tx, lu.nom, null)) return { ok: false as const, raison: "Un dossier porte déjà ce nom." };
    const client = await clientValide(tx, entree.clientId);
    if (!client.ok) return client;
    const [d] = await tx
      .insert(dossiersArrosage)
      .values({ entrepriseId: ctx.entrepriseId, nom: lu.nom, clientId: entree.clientId })
      .returning({ id: dossiersArrosage.id });
    return { ok: true as const, id: d.id };
  });
}

export async function renommerDossier(ctx: Ctx, id: string, entree: { nom: unknown; clientId: string | null }): Promise<{ ok: true } | Refus> {
  const lu = nomDuDossier(entree.nom);
  if (!lu.ok) return lu;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    if (await nomDejaPris(tx, lu.nom, id)) return { ok: false as const, raison: "Un dossier porte déjà ce nom." };
    const client = await clientValide(tx, entree.clientId);
    if (!client.ok) return client;
    const [d] = await tx
      .update(dossiersArrosage)
      .set({ nom: lu.nom, clientId: entree.clientId, updatedAt: new Date() })
      .where(and(eq(dossiersArrosage.id, id), isNull(dossiersArrosage.oublieLe)))
      .returning({ id: dossiersArrosage.id });
    return d ? { ok: true as const } : { ok: false as const, raison: "Ce dossier n’existe plus." };
  });
}

export async function ouvrirDossier(ctx: Ctx, id: string): Promise<DossierOuvert | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx
      .select({ id: dossiersArrosage.id, nom: dossiersArrosage.nom, clientId: clients.id, clientNom: clients.nom, civilite: clients.civilite })
      .from(dossiersArrosage)
      .leftJoin(clients, eq(clients.id, dossiersArrosage.clientId))
      .where(and(eq(dossiersArrosage.id, id), isNull(dossiersArrosage.oublieLe)))
      .limit(1);
    if (!d) return null;
    const versions = await tx
      .select({ id: plansArrosage.id, version: plansArrosage.version, resume: plansArrosage.resume, avecPhoto: sql<boolean>`${plansArrosage.photoCle} is not null`, createdAt: plansArrosage.createdAt })
      .from(plansArrosage)
      .where(eq(plansArrosage.dossierId, id))
      .orderBy(desc(plansArrosage.version));
    return {
      id: d.id,
      nom: d.nom as string,
      client: d.clientId && d.clientNom ? { id: d.clientId, nom: nomDuClient({ nom: d.clientNom, civilite: d.civilite }) } : null,
      plans: versions.length,
      dernier: versions[0]?.createdAt ?? null,
      versions,
    };
  });
}

/** Un plan enregistré, tel qu'il a été rendu : jamais recalculé. `null` s'il n'est plus là (oublié, ou d'une autre entreprise). */
export async function lirePlan(ctx: Ctx, dossierId: string, planId: string): Promise<PlanEnregistre | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx
      .select({
        id: plansArrosage.id,
        dossierId: plansArrosage.dossierId,
        dossierNom: dossiersArrosage.nom,
        version: plansArrosage.version,
        saisie: plansArrosage.saisie,
        resultat: plansArrosage.resultat,
        resume: plansArrosage.resume,
        photoCle: plansArrosage.photoCle,
        pdfCle: plansArrosage.pdfCle,
        createdAt: plansArrosage.createdAt,
      })
      .from(plansArrosage)
      .innerJoin(dossiersArrosage, eq(dossiersArrosage.id, plansArrosage.dossierId))
      .where(and(eq(plansArrosage.id, planId), eq(plansArrosage.dossierId, dossierId), isNull(dossiersArrosage.oublieLe)))
      .limit(1);
    return p ? { ...p, dossierNom: p.dossierNom as string } : null;
  });
}

/** Ce qu'un enregistrement porte, une fois le plan refait au serveur et ses fichiers rangés. */
export type NouveauPlan = {
  saisie: SaisieDuPlan;
  resultat: PlanFige;
  empreinte: string;
  resume: string;
  photoCle: string | null;
  pdfCle: string | null;
  versionCalcul: string;
  modele: string | null;
};

export type ResultatEnregistrement =
  | { ok: true; deja: false; dossierId: string; planId: string; version: number }
  | { ok: true; deja: true; dossierId: string }
  | Refus;

/**
 * Enregistre une version. Le dossier est VERROUILLÉ le temps de choisir son
 * numéro : deux enregistrements simultanés ne prennent jamais le même, et la
 * contrainte `plans_arrosage_version_uk` le garantit en base quoi qu'il arrive.
 *
 * Le même plan que la dernière version (même empreinte) ne fait pas de
 * version : ses fichiers, rangés pour rien, partent à la purge.
 */
export async function enregistrerPlan(
  ctx: Ctx,
  ou: { dossierId: string } | { nouveau: { nom: unknown; clientId: string | null } },
  plan: NouveauPlan
): Promise<ResultatEnregistrement> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    let dossierId: string;
    if ("nouveau" in ou) {
      const lu = nomDuDossier(ou.nouveau.nom);
      if (!lu.ok) return lu;
      if (await nomDejaPris(tx, lu.nom, null)) return { ok: false as const, raison: "Un dossier porte déjà ce nom." };
      const client = await clientValide(tx, ou.nouveau.clientId);
      if (!client.ok) return client;
      const [d] = await tx
        .insert(dossiersArrosage)
        .values({ entrepriseId: ctx.entrepriseId, nom: lu.nom, clientId: ou.nouveau.clientId })
        .returning({ id: dossiersArrosage.id });
      dossierId = d.id;
    } else {
      const [d] = await tx
        .select({ id: dossiersArrosage.id })
        .from(dossiersArrosage)
        .where(and(eq(dossiersArrosage.id, ou.dossierId), isNull(dossiersArrosage.oublieLe)))
        .for("update")
        .limit(1);
      if (!d) return { ok: false as const, raison: "Ce dossier n’existe plus." };
      dossierId = d.id;
    }

    const avant = await tx
      .select({ version: plansArrosage.version, empreinte: plansArrosage.empreinte })
      .from(plansArrosage)
      .where(eq(plansArrosage.dossierId, dossierId))
      .orderBy(desc(plansArrosage.version));
    if (avant[0]?.empreinte === plan.empreinte) {
      for (const cle of [plan.photoCle, plan.pdfCle]) if (cle) await tx.insert(fichiersAPurger).values({ storageKey: cle });
      return { ok: true as const, deja: true as const, dossierId };
    }
    const version = versionSuivante(avant.map((a) => a.version));
    const [p] = await tx
      .insert(plansArrosage)
      .values({ entrepriseId: ctx.entrepriseId, dossierId, version, enregistrePar: ctx.utilisateurId, ...plan })
      .returning({ id: plansArrosage.id });
    await tx.update(dossiersArrosage).set({ updatedAt: new Date() }).where(eq(dossiersArrosage.id, dossierId));
    return { ok: true as const, deja: false as const, dossierId, planId: p.id, version };
  });
}

/**
 * OUBLIER des dossiers, dans une transaction déjà sous le contexte de
 * l'entreprise : ce que le dossier dit de son client part aussitôt, le calcul
 * reste, et la file l'effacera cinq ans après.
 *
 * Servi par trois chemins, une seule règle : supprimer un dossier, effacer un
 * client (`effacerClientDans`), fermer le compte (`fermeture-compte.ts`).
 */
export async function oublierDesDossiersDans(
  tx: DbOrTx,
  entrepriseId: string,
  ids: readonly string[],
  maintenant: Date
): Promise<number> {
  if (!ids.length) return 0;
  const vivants = await tx
    .select({ id: dossiersArrosage.id })
    .from(dossiersArrosage)
    .where(and(inArray(dossiersArrosage.id, [...ids]), isNull(dossiersArrosage.oublieLe)));
  const aOublier = vivants.map((v) => v.id);
  if (!aOublier.length) return 0;
  const fichiers = await tx
    .select({ photo: plansArrosage.photoCle, pdf: plansArrosage.pdfCle })
    .from(plansArrosage)
    .where(inArray(plansArrosage.dossierId, aOublier));
  for (const f of fichiers) for (const cle of [f.photo, f.pdf]) if (cle) await tx.insert(fichiersAPurger).values({ storageKey: cle });
  // Ce que l'IA a lu sur la photo peut porter ce qui y était écrit (un nom, une
  // adresse) : il part avec elle. Les paramètres et le résultat restent.
  await tx
    .update(plansArrosage)
    .set({ photoCle: null, pdfCle: null, saisie: sql`jsonb_set(${plansArrosage.saisie}, '{lecture}', 'null'::jsonb)` })
    .where(inArray(plansArrosage.dossierId, aOublier));
  await tx
    .update(dossiersArrosage)
    .set({ nom: null, clientId: null, oublieLe: maintenant, updatedAt: maintenant })
    .where(inArray(dossiersArrosage.id, aOublier));
  const purgerLe = new Date(maintenant);
  purgerLe.setFullYear(purgerLe.getFullYear() + ANNEES_DE_TRACE);
  await tx
    .insert(dossiersArrosageAPurger)
    .values(aOublier.map((dossierId) => ({ dossierId, entrepriseId, purgerLe })))
    .onConflictDoNothing();
  return aOublier.length;
}

export async function supprimerDossier(ctx: Ctx, id: string, maintenant = new Date()): Promise<{ ok: true } | Refus> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const n = await oublierDesDossiersDans(tx, ctx.entrepriseId, [id], maintenant);
    return n ? { ok: true as const } : { ok: false as const, raison: "Ce dossier n’existe plus." };
  });
}

/** Les dossiers reliés à un client, pour l'effacement de ce client. */
export async function dossiersDuClientDans(tx: DbOrTx, clientId: string): Promise<string[]> {
  const lignes = await tx.select({ id: dossiersArrosage.id }).from(dossiersArrosage).where(eq(dossiersArrosage.clientId, clientId));
  return lignes.map((l) => l.id);
}

/** Tous les dossiers de l'entreprise, pour la fermeture du compte. */
export async function tousLesDossiersDans(tx: DbOrTx): Promise<string[]> {
  const lignes = await tx.select({ id: dossiersArrosage.id }).from(dossiersArrosage).orderBy(asc(dossiersArrosage.createdAt));
  return lignes.map((l) => l.id);
}

/**
 * Efface les dossiers oubliés depuis cinq ans. Le travail de fond n'a le
 * contexte d'aucune entreprise : il l'emprunte à la file, une entrée après
 * l'autre (même mécanique que `purgerPhotosDiagnostic`). La RLS n'est pas
 * contournée ; sans le contexte, la suppression ne toucherait rien, en silence.
 */
export async function purgerLesDossiersOublies(maintenant: Date = new Date()): Promise<{ dossiersEffaces: number }> {
  return db.transaction(async (tx) => {
    const echus = await tx.select().from(dossiersArrosageAPurger).where(lte(dossiersArrosageAPurger.purgerLe, maintenant));
    let effaces = 0;
    for (const e of echus) {
      await tx.execute(sql`SELECT set_config('app.entreprise_id', ${e.entrepriseId}, true)`);
      await tx.delete(plansArrosage).where(eq(plansArrosage.dossierId, e.dossierId));
      const fait = await tx
        .delete(dossiersArrosage)
        .where(and(eq(dossiersArrosage.id, e.dossierId), sql`${dossiersArrosage.oublieLe} IS NOT NULL`))
        .returning({ id: dossiersArrosage.id });
      effaces += fait.length;
      await tx.delete(dossiersArrosageAPurger).where(eq(dossiersArrosageAPurger.id, e.id));
    }
    return { dossiersEffaces: effaces };
  });
}
