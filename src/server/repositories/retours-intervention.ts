import { and, asc, count, desc, eq, inArray, isNotNull, notExists, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import {
  chantiers,
  clients,
  fichesSecuritePhotos,
  fichiersAPurger,
  photos,
  retoursIntervention,
  retoursInterventionPhotos,
  retoursInterventionTaches,
  retoursInterventionVus,
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
 * Poser le retour du jour.
 *
 * **UN RETOUR PAR ENVOI, PLUSIEURS PAR CHANTIER — sa règle du 19 septembre
 * 2026 :** *« un chantier de 8 jours, il faut pouvoir faire plusieurs retours
 * d'intervention jour après jour »*. Jusqu'à la migration 0096, un second
 * envoi mettait le premier à jour (`ON CONFLICT`) — juste pour un chantier
 * d'un jour, faux pour un chantier de huit : le retour du soir 3 effaçait
 * celui du soir 2. Chaque envoi est désormais une ligne, horodatée, signée.
 *
 * **Ce que ça change pour le double appui.** L'index unique tenait aussi le
 * double « c'est fini » d'un réseau lent ; c'est l'écran qui le tient
 * maintenant (le bouton se ferme le temps de l'envoi, `TravauxAFaire.tsx`).
 *
 * **Chaque retour porte SES tâches et SES photos** : ce qu'il a coché ce
 * soir-là, avec les photos de ce soir-là — un retour est une preuve datée, et
 * une preuve ne se réécrit pas (sa décision du 8 septembre). Seul le DERNIER
 * se corrige, sur sa demande du 25 septembre (`modifierLeDernierRetour`).
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
      .returning();

    await poserLeContenu(tx, ctx, retour.id, chantierId, quoi);

    return retour;
  });
}

/**
 * Les tâches et les photos d'un retour — une seule écriture pour l'envoi et
 * pour la modification : deux façons de poser le même contenu finiraient par
 * ne plus poser le même (`CLAUDE.md` §3).
 */
async function poserLeContenu(
  tx: DbOrTx,
  ctx: Ctx,
  retourId: string,
  chantierId: string,
  quoi: RetourAPoser
) {
  if (quoi.taches.length > 0) {
    await tx.insert(retoursInterventionTaches).values(
      quoi.taches.map((t, ordre) => ({
        entrepriseId: ctx.entrepriseId,
        retourId,
        libelle: t.libelle,
        faite: t.faite,
        ordre,
      }))
    );
  }

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
          retourId,
          photoId: p.id,
          ordre,
        }))
      );
    }
  }
}

/**
 * Modifier le retour déjà envoyé, au lieu d'en poser un second.
 *
 * **Sa demande du 25 septembre 2026 :** *« j'ai envoyé un retour sans faire
 * exprès, il faut que je puisse le modifier […] et ça modifie le retour
 * envoyé, ça n'en envoie pas un deuxième ! »*
 *
 * **Seul le DERNIER retour du chantier se modifie.** C'est celui que la fiche
 * rouvre ; ceux des soirs d'avant restent la preuve de ce qui a été fait ce
 * jour-là (sa décision du 8 septembre). Rend `false` sinon — ou quand le
 * retour n'est pas de cette entreprise, ce que la RLS rend indiscernable.
 *
 * **Modifié, il redevient non lu** : le patron qui l'avait ouvert doit voir
 * qu'il a changé, sinon il se fie à ce qu'il a lu avant.
 */
export async function modifierLeDernierRetour(
  ctx: Ctx,
  chantierId: string,
  retourId: string,
  quoi: RetourAPoser
): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [dernier] = await tx
      .select({ id: retoursIntervention.id })
      .from(retoursIntervention)
      .where(eq(retoursIntervention.chantierId, chantierId))
      .orderBy(desc(retoursIntervention.poseLe))
      .limit(1);
    if (!dernier || dernier.id !== retourId) return false;

    const anciennes = await tx
      .select({ photoId: retoursInterventionPhotos.photoId })
      .from(retoursInterventionPhotos)
      .where(eq(retoursInterventionPhotos.retourId, retourId));

    await tx
      .update(retoursIntervention)
      .set({ aSignaler: quoi.aSignaler?.trim() || null })
      .where(eq(retoursIntervention.id, retourId));
    await tx.delete(retoursInterventionTaches).where(eq(retoursInterventionTaches.retourId, retourId));
    await tx.delete(retoursInterventionPhotos).where(eq(retoursInterventionPhotos.retourId, retourId));
    await tx.delete(retoursInterventionVus).where(eq(retoursInterventionVus.retourId, retourId));
    await poserLeContenu(tx, ctx, retourId, chantierId, quoi);

    // **Une photo supprimée du chantier restait gardée PARCE QUE ce retour la
    // montrait** (`supprimerPhoto`). Décochée ici, plus rien ne la tient : son
    // fichier part à la purge, sinon il resterait dans le rangement pour
    // toujours, sans personne pour le voir.
    const retirees = anciennes.map((a) => a.photoId).filter((id) => !quoi.photoIds.includes(id));
    if (retirees.length > 0) {
      const orphelines = await tx
        .select({ storageKey: photos.storageKey })
        .from(photos)
        .where(
          and(
            inArray(photos.id, retirees),
            isNotNull(photos.deletedAt),
            notExists(
              tx
                .select({ un: sql`1` })
                .from(retoursInterventionPhotos)
                .where(eq(retoursInterventionPhotos.photoId, photos.id))
            ),
            notExists(
              tx
                .select({ un: sql`1` })
                .from(fichesSecuritePhotos)
                .where(eq(fichesSecuritePhotos.photoId, photos.id))
            )
          )
        );
      if (orphelines.length > 0) {
        await tx.insert(fichiersAPurger).values(orphelines.map((o) => ({ storageKey: o.storageKey })));
      }
    }
    return true;
  });
}

/**
 * Le DERNIER retour d'un chantier — celui qui pré-coche la fiche le lendemain.
 *
 * Le plus récent par `pose_le`, jamais « le » retour : depuis la migration
 * 0096, un chantier en porte autant que de soirs.
 */
export async function dernierRetourDuChantier(ctx: Ctx, chantierId: string) {
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
      .orderBy(desc(retoursIntervention.poseLe))
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

    const [taches, comptes, lus] = await Promise.all([
      tx
        .select({
          retourId: retoursInterventionTaches.retourId,
          libelle: retoursInterventionTaches.libelle,
          faite: retoursInterventionTaches.faite,
        })
        .from(retoursInterventionTaches)
        .where(inArray(retoursInterventionTaches.retourId, ids))
        .orderBy(asc(retoursInterventionTaches.ordre)),
      // **La CLÉ des photos, pas leur nombre — 9 septembre 2026.** La liste
      // annonçait « 2 photos » et ne les montrait nulle part : un chiffre qu’il
      // ne pouvait pas ouvrir, sur les seules images qui prouvent le chantier.
      tx
        .select({
          retourId: retoursInterventionPhotos.retourId,
          id: photos.id,
          storageKey: photos.storageKey,
        })
        .from(retoursInterventionPhotos)
        .innerJoin(photos, eq(retoursInterventionPhotos.photoId, photos.id))
        .where(inArray(retoursInterventionPhotos.retourId, ids)),
      // **Ce que LUI a déjà ouvert**, et pas ce que quelqu’un a ouvert : la
      // pastille est la sienne (`retours_intervention_vus`).
      tx
        .select({ retourId: retoursInterventionVus.retourId })
        .from(retoursInterventionVus)
        .where(
          and(
            inArray(retoursInterventionVus.retourId, ids),
            eq(retoursInterventionVus.utilisateurId, ctx.utilisateurId)
          )
        ),
    ]);

    // **Deux requêtes, pas une par retour.** Cent retours en donneraient deux
    // cents, et la page du soir mettrait dix secondes à s'ouvrir.
    const parRetour = new Map<string, TacheDuRetour[]>();
    for (const t of taches) {
      const siennes = parRetour.get(t.retourId);
      if (siennes) siennes.push({ libelle: t.libelle, faite: t.faite });
      else parRetour.set(t.retourId, [{ libelle: t.libelle, faite: t.faite }]);
    }
    const dejaLus = new Set(lus.map((l) => l.retourId));
    const photosParRetour = new Map<string, { id: string; storageKey: string }[]>();
    for (const p of comptes) {
      const siennes = photosParRetour.get(p.retourId);
      const photo = { id: p.id, storageKey: p.storageKey };
      if (siennes) siennes.push(photo);
      else photosParRetour.set(p.retourId, [photo]);
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
      photos: photosParRetour.get(l.id) ?? [],
      aSignaler: l.aSignaler,
      vu: dejaLus.has(l.id),
    }));
  });
}

/**
 * Combien de retours ce chantier a déjà envoyés — « 2 retours envoyés » sur la
 * fiche, et ce qui dit au salarié que le geste d'hier est bien parti.
 */
export async function nombreDeRetoursDuChantier(ctx: Ctx, chantierId: string): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ n: count() })
      .from(retoursIntervention)
      .where(eq(retoursIntervention.chantierId, chantierId));
    return Number(ligne?.n ?? 0);
  });
}

/**
 * Combien de retours il N’A PAS ENCORE OUVERTS — la pastille de l’onglet.
 *
 * ────────────────────────────────────────────────────────────────
 * **La pastille comptait le TOTAL jusqu’au 9 septembre 2026**, et il l’a
 * corrigé : *« il faut que le nombre qui s’affiche soit celui-là, et pas
 * combien il y en a à l’intérieur »*. Un total ne bouge pas quand il lit, et
 * grossit pour toujours — une pastille qui ne descend jamais à zéro s’apprend
 * à être ignorée.
 *
 * **UN SEUL COMPTE, depuis sa correction du 9 septembre 2026 :** *« l’onglet
 * retour d’intervention doit exister même s’il n’y a aucun retour »*. Le total
 * ne servait qu’à faire apparaître l’onglet ; l’onglet étant toujours là, il
 * ne sert plus à personne et il s’en va (`CLAUDE.md` §4 quinquies).
 *
 * **Non lu PAR LUI**, jamais « par quelqu’un » : `/termines` est ouvert au
 * propriétaire comme au rôle facturation (`retours_intervention_vus`).
 */
export async function compterLesRetours(ctx: Ctx): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({ vu: retoursInterventionVus.id })
      .from(retoursIntervention)
      .leftJoin(
        retoursInterventionVus,
        and(
          eq(retoursInterventionVus.retourId, retoursIntervention.id),
          eq(retoursInterventionVus.utilisateurId, ctx.utilisateurId)
        )
      );
    return lignes.filter((l) => l.vu === null).length;
  });
}

/**
 * Il vient d'ouvrir ce retour : on s'en souvient, une fois.
 *
 * **Rien ne se passe s'il l'avait déjà ouvert** — le second appui ne réécrit
 * pas la date. C'est une lecture, pas un journal de consultations ; et une date
 * qui se déplace ferait remonter un retour lu la semaine dernière.
 *
 * **Le retour est relu ici, jamais cru sur parole.** Un identifiant qui voyage
 * est un identifiant qu'on peut changer en chemin, et la RLS rend
 * indiscernables « d'une autre entreprise » et « inexistant » — ce qui est
 * exactement ce qu'on veut.
 */
export async function marquerLeRetourVu(ctx: Ctx, retourId: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [sien] = await tx
      .select({ id: retoursIntervention.id })
      .from(retoursIntervention)
      .where(eq(retoursIntervention.id, retourId))
      .limit(1);
    if (!sien) return false;

    await tx
      .insert(retoursInterventionVus)
      .values({
        entrepriseId: ctx.entrepriseId,
        retourId: sien.id,
        utilisateurId: ctx.utilisateurId,
      })
      .onConflictDoNothing();
    return true;
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
