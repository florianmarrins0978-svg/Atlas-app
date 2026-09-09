import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import {
  chantiers,
  clients,
  photos,
  retoursIntervention,
  retoursInterventionPhotos,
  retoursInterventionTaches,
  users,
} from "../db/schema";
import type { Ctx } from "./context";
import type { RetourEnListe, TacheDuRetour } from "../../lib/retour-intervention";

/**
 * LE RETOUR D'INTERVENTION, côté base.
 *
 * Ce fichier LIT et ÉCRIT ; il ne décide de rien. Ce qui est exigé avant de
 * poser un retour, ce qui se compte, ce qui se range par client — tout cela vit
 * dans `src/lib/retour-intervention.ts`, et s'éprouve sans monter la base.
 *
 * **Rien ne sort de `withEntreprise`** : un retour porte le nom d'un client et
 * des photos de sa propriété.
 */

/** Ce que le salarié a coché et écrit, tel que l'action serveur le transmet. */
export type RetourAPoser = {
  taches: readonly TacheDuRetour[];
  /** Les photos du chantier qu'il montre. Relues ici, jamais crues sur parole. */
  photoIds: readonly string[];
  aSignaler: string | null;
};

/**
 * Poser — ou reposer — le retour d'un chantier.
 *
 * **Un seul retour par chantier** (`retours_intervention_chantier_uk`) : un
 * second appui met à jour le premier plutôt que d'en créer un deuxième. Deux
 * versions du même travail laisseraient le patron sans savoir laquelle fait foi.
 *
 * **Les tâches et les photos sont REMPLACÉES, pas ajoutées.** Il décoche une
 * case, il repose : ce qu'il vient de dire doit être ce qui reste. Les ajouter
 * ferait grossir la liste à chaque correction, et « 5 sur 3 faites » n'aurait
 * plus de sens.
 */
export async function poserLeRetour(
  ctx: Ctx,
  chantierId: string,
  quoi: RetourAPoser
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [retour] = await tx
      .insert(retoursIntervention)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId,
        posePar: ctx.utilisateurId,
        aSignaler: quoi.aSignaler?.trim() || null,
      })
      .onConflictDoUpdate({
        target: retoursIntervention.chantierId,
        set: {
          posePar: ctx.utilisateurId,
          poseLe: new Date(),
          aSignaler: quoi.aSignaler?.trim() || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await tx
      .delete(retoursInterventionTaches)
      .where(eq(retoursInterventionTaches.retourId, retour.id));
    if (quoi.taches.length > 0) {
      await tx.insert(retoursInterventionTaches).values(
        quoi.taches.map((t, ordre) => ({
          entrepriseId: ctx.entrepriseId,
          retourId: retour.id,
          libelle: t.libelle,
          faite: t.faite,
          ordre,
        }))
      );
    }

    await tx
      .delete(retoursInterventionPhotos)
      .where(eq(retoursInterventionPhotos.retourId, retour.id));
    if (quoi.photoIds.length > 0) {
      // **Les photos sont relues, jamais crues sur parole** : une liste
      // d'identifiants qui voyage est une liste qu'on peut changer en chemin, et
      // la RLS ne dirait rien d'une photo d'une autre entreprise — elle la
      // rendrait simplement introuvable, ce qui est exactement ce qu'on veut.
      const siennes = await tx
        .select({ id: photos.id })
        .from(photos)
        .where(and(eq(photos.chantierId, chantierId), inArray(photos.id, [...quoi.photoIds])));
      if (siennes.length > 0) {
        await tx.insert(retoursInterventionPhotos).values(
          siennes.map((p, ordre) => ({
            entrepriseId: ctx.entrepriseId,
            retourId: retour.id,
            photoId: p.id,
            ordre,
          }))
        );
      }
    }

    return retour;
  });
}

/** Le retour d'UN chantier — ce que la fiche affiche une fois qu'il est posé. */
export async function retourDuChantier(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [retour] = await tx
      .select({
        id: retoursIntervention.id,
        poseLe: retoursIntervention.poseLe,
        aSignaler: retoursIntervention.aSignaler,
        posePar: users.nom,
        posePrenom: users.prenom,
      })
      .from(retoursIntervention)
      .leftJoin(users, eq(retoursIntervention.posePar, users.id))
      .where(eq(retoursIntervention.chantierId, chantierId))
      .limit(1);
    if (!retour) return null;

    const [taches, sesPhotos] = await Promise.all([
      tx
        .select({ libelle: retoursInterventionTaches.libelle, faite: retoursInterventionTaches.faite })
        .from(retoursInterventionTaches)
        .where(eq(retoursInterventionTaches.retourId, retour.id))
        .orderBy(asc(retoursInterventionTaches.ordre)),
      tx
        .select({ id: photos.id, storageKey: photos.storageKey })
        .from(retoursInterventionPhotos)
        .innerJoin(photos, eq(retoursInterventionPhotos.photoId, photos.id))
        .where(eq(retoursInterventionPhotos.retourId, retour.id))
        .orderBy(asc(retoursInterventionPhotos.ordre)),
    ]);

    return {
      id: retour.id,
      poseLe: new Date(retour.poseLe).toISOString(),
      // Le prénom seul suffit sur un chantier — c'est ainsi qu'on s'appelle
      // dans une équipe, et « Julien » tient là où « Julien Marchand » coupe.
      posePar: retour.posePrenom?.trim() || retour.posePar?.trim() || null,
      aSignaler: retour.aSignaler,
      taches,
      photos: sesPhotos,
    };
  });
}

/**
 * TOUS les retours de l'entreprise — sans fenêtre glissante.
 *
 * *« Il faut pouvoir les garder longtemps »*, 8 septembre 2026. Il n'y a donc
 * ni borne d'années ni `LIMIT` par défaut : la page filtre en mémoire
 * (`rangerLesRetours`), et un chantier de 2024 se retrouve en 2026.
 *
 * **Le plafond existe quand même**, mais il est haut : au-delà, ce n'est plus
 * une liste qu'on lit, c'est une base qu'on exporte — et ce jour-là il faudra
 * une pagination, pas un `LIMIT` silencieux qui coupe l'histoire d'un client.
 */
export async function listerLesRetours(ctx: Ctx, maximum = 2000): Promise<RetourEnListe[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({
        id: retoursIntervention.id,
        chantierId: retoursIntervention.chantierId,
        chantierNom: chantiers.nom,
        clientNom: clients.nom,
        poseLe: retoursIntervention.poseLe,
        posePar: users.nom,
        posePrenom: users.prenom,
        aSignaler: retoursIntervention.aSignaler,
      })
      .from(retoursIntervention)
      .innerJoin(chantiers, eq(retoursIntervention.chantierId, chantiers.id))
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .leftJoin(users, eq(retoursIntervention.posePar, users.id))
      .orderBy(desc(retoursIntervention.poseLe))
      .limit(maximum);

    if (lignes.length === 0) return [];
    const ids = lignes.map((l) => l.id);

    const [taches, comptes] = await Promise.all([
      tx
        .select({
          retourId: retoursInterventionTaches.retourId,
          libelle: retoursInterventionTaches.libelle,
          faite: retoursInterventionTaches.faite,
        })
        .from(retoursInterventionTaches)
        .where(inArray(retoursInterventionTaches.retourId, ids))
        .orderBy(asc(retoursInterventionTaches.ordre)),
      tx
        .select({ retourId: retoursInterventionPhotos.retourId })
        .from(retoursInterventionPhotos)
        .where(inArray(retoursInterventionPhotos.retourId, ids)),
    ]);

    // **Deux requêtes, pas une par retour.** Cent retours en donneraient deux
    // cents, et la page du soir mettrait dix secondes à s'ouvrir.
    const parRetour = new Map<string, TacheDuRetour[]>();
    for (const t of taches) {
      const siennes = parRetour.get(t.retourId);
      if (siennes) siennes.push({ libelle: t.libelle, faite: t.faite });
      else parRetour.set(t.retourId, [{ libelle: t.libelle, faite: t.faite }]);
    }
    const photosParRetour = new Map<string, number>();
    for (const p of comptes) {
      photosParRetour.set(p.retourId, (photosParRetour.get(p.retourId) ?? 0) + 1);
    }

    return lignes.map((l) => ({
      id: l.id,
      // **Le nom du CHANTIER quand le client manque**, jamais « Sans client » :
      // un chantier dicté à la volée n'a pas toujours de fiche, et une liste
      // rangée sous un mot inventé se lit comme une donnée perdue.
      clientNom: l.clientNom?.trim() || l.chantierNom,
      chantierNom: l.chantierNom,
      poseLe: new Date(l.poseLe).toISOString(),
      posePar: l.posePrenom?.trim() || l.posePar?.trim() || null,
      taches: parRetour.get(l.id) ?? [],
      photos: photosParRetour.get(l.id) ?? 0,
      aSignaler: l.aSignaler,
    }));
  });
}

/** Combien de retours l'entreprise porte — pour la pastille de la barre du bas. */
export async function compterLesRetours(ctx: Ctx): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({ id: retoursIntervention.id })
      .from(retoursIntervention);
    return lignes.length;
  });
}

/**
 * Cette photo appartient-elle à un retour ?
 *
 * **La question qui protège les fichiers de la purge.** `supprimerPhoto` met la
 * clé de rangement en file (`fichiers_a_purger`) ; si la photo est montrée par
 * un retour, le fichier doit rester — sans quoi le retour perd ses images des
 * mois plus tard, et personne ne fait le lien.
 */
export async function photoTenueParUnRetour(ctx: Ctx, photoId: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({ id: retoursInterventionPhotos.id })
      .from(retoursInterventionPhotos)
      .where(eq(retoursInterventionPhotos.photoId, photoId))
      .limit(1);
    return lignes.length > 0;
  });
}
