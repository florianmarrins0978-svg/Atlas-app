import { and, eq, isNull, isNotNull, sql, desc } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, entreprises } from "../db/schema";
import {
  compterOccupation,
  departPossible,
  dureeEnDemiJournees,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
} from "../disponibilites";
import type { Ctx } from "./context";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Le dernier envoi d'un chantier, en sous-requêtes corrélées plutôt qu'en
// jointure : un chantier refusé puis renvoyé porte plusieurs envois, et une
// jointure les remonterait tous, dupliquant la ligne du chantier. Seul le
// dernier décrit où en est le devis aujourd'hui — les précédents sont de
// l'histoire.
const DERNIER_ENVOI = {
  envoiEnvoyeAt: sql<Date | null>`(
    SELECT e.envoye_at FROM envois_devis e
    WHERE e.chantier_id = ${chantiers.id}
    ORDER BY e.envoye_at DESC LIMIT 1
  )`,
  envoiExpireAt: sql<Date | null>`(
    SELECT e.expire_at FROM envois_devis e
    WHERE e.chantier_id = ${chantiers.id}
    ORDER BY e.envoye_at DESC LIMIT 1
  )`,
  envoiReponse: sql<"acceptee" | "refusee" | null>`(
    SELECT e.reponse FROM envois_devis e
    WHERE e.chantier_id = ${chantiers.id}
    ORDER BY e.envoye_at DESC LIMIT 1
  )`,
} as const;

export async function listerChantiers(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(chantiers).where(isNull(chantiers.deletedAt))
  );
}

// Pour l'écran Liste des chantiers : chantier + nom du client + compteur de
// photos + présence d'une note vocale, en une seule requête (sous-requêtes
// corrélées plutôt que N+1). Tri : plus récent en premier — aucun tri métier
// n'existait auparavant pour cet écran (les données simulées n'étaient pas
// triées) ; choix par défaut raisonnable, documenté dans le compte rendu.
export async function listerChantiersPourAffichage(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        adresseChantier: chantiers.adresseChantier,
        clientNom: clients.nom,
        informationsVerifieesAt: chantiers.informationsVerifieesAt,
        devisEnvoyeAt: chantiers.devisEnvoyeAt,
        datePlanifiee: chantiers.datePlanifiee,
        termineAt: chantiers.termineAt,
        factureEnvoyeeAt: chantiers.factureEnvoyeeAt,
        photosCount: sql<number>`(
          SELECT COUNT(*)::int FROM photos p
          WHERE p.chantier_id = ${chantiers.id} AND p.deleted_at IS NULL
        )`,
        aUneNoteVocale: sql<boolean>`EXISTS (
          SELECT 1 FROM notes_vocales n WHERE n.chantier_id = ${chantiers.id}
        )`,
        ...DERNIER_ENVOI,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(isNull(chantiers.deletedAt))
      .orderBy(desc(chantiers.createdAt))
  );
}

export async function getChantier(ctx: Ctx, id: string) {
  if (!UUID_RE.test(id)) return null; // format invalide : traité comme introuvable, aucune requête inutile
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.id, id), isNull(chantiers.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

// Pour la fiche chantier (hub) : chantier + client + agrégats photos/note vocale
// en une seule requête (même motif que listerChantiersPourAffichage — pas de
// requêtes en cascade). Retourne null si le chantier n'existe pas, est supprimé,
// ou n'appartient pas à l'entreprise du contexte (jamais distingué de "inexistant"
// pour l'appelant — notFound() dans les deux cas, voir la route).
export async function getChantierPourHub(ctx: Ctx, id: string) {
  if (!UUID_RE.test(id)) return null; // format invalide : traité comme introuvable, aucune requête inutile
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        adresseChantier: chantiers.adresseChantier,
        clientNom: clients.nom,
        informationsVerifieesAt: chantiers.informationsVerifieesAt,
        prixValideAt: chantiers.prixValideAt,
        devisGenereAt: chantiers.devisGenereAt,
        devisEnvoyeAt: chantiers.devisEnvoyeAt,
        datePlanifiee: chantiers.datePlanifiee,
        photosCount: sql<number>`(
          SELECT COUNT(*)::int FROM photos p
          WHERE p.chantier_id = ${chantiers.id} AND p.deleted_at IS NULL
        )`,
        aUneNoteVocale: sql<boolean>`EXISTS (
          SELECT 1 FROM notes_vocales n WHERE n.chantier_id = ${chantiers.id}
        )`,
        ...DERNIER_ENVOI,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(and(eq(chantiers.id, id), isNull(chantiers.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function creerChantier(
  ctx: Ctx,
  data: { nom: string; adresseChantier?: string; clientId?: string | null }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(chantiers)
      .values({
        entrepriseId: ctx.entrepriseId,
        nom: data.nom,
        adresseChantier: data.adresseChantier,
        clientId: data.clientId ?? null,
        createdBy: ctx.utilisateurId,
        updatedBy: ctx.utilisateurId,
      })
      .returning();
    return row;
  });
}

async function marquerJalon(ctx: Ctx, chantierId: string, colonne: "informationsVerifieesAt" | "prixValideAt") {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ [colonne]: new Date(), updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

export const marquerInformationsVerifiees = (ctx: Ctx, chantierId: string) =>
  marquerJalon(ctx, chantierId, "informationsVerifieesAt");

export const marquerPrixValide = (ctx: Ctx, chantierId: string) => marquerJalon(ctx, chantierId, "prixValideAt");

/**
 * Pose une date à la main, depuis l'écran Planning.
 *
 * **Le créneau est choisi ici, comme il l'est quand un client répond.** Sans
 * cela, un chantier planifié à la main n'aurait ni moment ni durée, donc
 * occuperait la journée entière — et le patron, qui vient justement de gagner
 * la demi-journée, la reperdrait dès qu'il cale un chantier lui-même.
 *
 * Aucun refus ici, délibérément : le patron peut surcharger sa journée s'il le
 * décide. Ce sont ses clients qu'on protège d'une date impossible, pas lui de
 * lui-même. Le créneau retombe alors sur le matin, faute de place.
 */
export async function planifierChantier(ctx: Ctx, chantierId: string, datePlanifiee: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const autres = await tx
      .select({
        id: chantiers.id,
        jour: chantiers.datePlanifiee,
        moment: chantiers.creneauDebut,
        duree: chantiers.dureeDemiJournees,
      })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt),
          isNotNull(chantiers.datePlanifiee)
        )
      );

    const [entreprise] = await tx
      .select({ nombreEquipes: entreprises.nombreEquipes })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);

    const [courant] = await tx
      .select({ duree: chantiers.dureeDemiJournees, dureePrevue: chantiers.dureePrevue })
      .from(chantiers)
      .where(eq(chantiers.id, chantierId))
      .limit(1);
    const duree =
      courant?.duree ??
      dureeEnDemiJournees(courant?.dureePrevue ?? null) ??
      DUREE_PAR_DEFAUT_DEMI_JOURNEES;

    const occupation = compterOccupation(
      autres
        .filter((a) => a.id !== chantierId && a.jour !== null)
        .map((a) => ({
          jour: a.jour as string,
          moment: a.moment === "matin" || a.moment === "apres_midi" ? a.moment : null,
          dureeDemiJournees: a.duree,
        }))
    );
    const creneauDebut =
      departPossible(datePlanifiee, duree, occupation, entreprise?.nombreEquipes ?? 1) ?? "matin";

    const [row] = await tx
      .update(chantiers)
      .set({
        datePlanifiee,
        creneauDebut,
        dureeDemiJournees: duree,
        updatedBy: ctx.utilisateurId,
        updatedAt: new Date(),
      })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

// Retire la date de planification (« suppression » d'une intervention) — le
// chantier redevient "à planifier" si un devis a déjà été envoyé.
export async function deplanifierChantier(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ datePlanifiee: null, updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

// Pour l'écran Planning : chantiers concernés par la planification (devis déjà
// envoyé), avec le nom du client — même motif que listerChantiersPourAffichage.
export async function listerChantiersPourPlanning(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        clientNom: clients.nom,
        devisEnvoyeAt: chantiers.devisEnvoyeAt,
        datePlanifiee: chantiers.datePlanifiee,
        // Le créneau et la durée réservée : lisibles par le patron seul. Deux
        // chantiers peuvent désormais tomber le même jour, et sans cette
        // précision son planning ne lui dirait plus lequel passe en premier.
        creneauDebut: chantiers.creneauDebut,
        dureeDemiJournees: chantiers.dureeDemiJournees,
        ...DERNIER_ENVOI,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(and(isNull(chantiers.deletedAt), isNotNull(chantiers.devisEnvoyeAt)))
  );
}

export async function mettreAJourDureeEquipe(
  ctx: Ctx,
  chantierId: string,
  data: { dureePrevue?: string; tailleEquipe?: string }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ ...data, updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}
