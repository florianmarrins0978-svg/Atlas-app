// La photo de chaque personne, et le lien entre un compte et son nom.
//
// *Sa demande du 27 septembre 2026 : « chaque personne doit pouvoir mettre et
// changer sa photo de profil ».* Ses deux réponses, et elles décident de tout
// ce fichier :
//
//   · le patron relie UNE FOIS chaque compte à son nom de salarié ; la photo
//     d'un compte relié EST celle de sa ligne (`equipes.photo_storage_key`) ;
//   · un compte relié à aucun nom garde la sienne sur son adhésion
//     (`membres_entreprise.photo_storage_key`).
//
// **Une seule vérité par personne.** Relié, la photo vit sur la ligne et nulle
// part ailleurs : le patron qui la change dans Équipe et le gars qui la change
// dans Mon compte écrivent au même endroit.
//
// Tout passe par `withEntreprise` (`CLAUDE.md` §3), et chaque écriture porte
// son propre filtre sur l'entreprise : `membres_entreprise` a une politique de
// lecture par utilisateur (0012), et une protection qui ne tient qu'à une
// politique se perd sans bruit (le logo, `api/fichiers`).

import { and, eq, ne } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { equipes, membresEntreprise } from "../db/schema";
import type { Ctx } from "./context";
import { MAX_EQUIPES } from "@/lib/equipes";

export type MaPhoto = {
  /** La clef de stockage, ou `null`. */
  photo: string | null;
  /** Le rang du nom relié, ou `null` pour un compte relié à personne. */
  rang: number | null;
};

async function monAdhesion(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({
        id: membresEntreprise.id,
        salarieId: membresEntreprise.salarieId,
        photo: membresEntreprise.photoStorageKey,
        rang: equipes.rang,
        photoDuNom: equipes.photoStorageKey,
      })
      .from(membresEntreprise)
      .leftJoin(
        equipes,
        and(eq(equipes.id, membresEntreprise.salarieId), eq(equipes.entrepriseId, ctx.entrepriseId))
      )
      .where(
        and(
          eq(membresEntreprise.utilisateurId, ctx.utilisateurId),
          eq(membresEntreprise.entrepriseId, ctx.entrepriseId)
        )
      )
      .limit(1);
    return ligne ?? null;
  });
}

/** La photo de la personne connectée, là où elle vit. */
export async function lireMaPhoto(ctx: Ctx): Promise<MaPhoto> {
  const a = await monAdhesion(ctx);
  if (!a) return { photo: null, rang: null };
  return a.salarieId ? { photo: a.photoDuNom ?? null, rang: a.rang ?? null } : { photo: a.photo, rang: null };
}

/**
 * Pose, ou retire, SA photo. **La cible se lit dans la session, jamais dans
 * la demande** : un salarié ne peut atteindre que sa propre ligne, quoi que
 * son navigateur envoie.
 *
 * Rend la clef d'avant, pour que l'appelant supprime l'ancien fichier une fois
 * la nouvelle écrite.
 */
export async function poserMaPhoto(ctx: Ctx, cle: string | null): Promise<{ avant: string | null }> {
  const a = await monAdhesion(ctx);
  if (!a) throw new Error("Aucune adhésion pour ce compte dans cette entreprise.");

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    if (a.salarieId) {
      await tx
        .update(equipes)
        .set({ photoStorageKey: cle, updatedAt: new Date() })
        .where(and(eq(equipes.id, a.salarieId), eq(equipes.entrepriseId, ctx.entrepriseId)));
      return { avant: a.photoDuNom ?? null };
    }
    await tx
      .update(membresEntreprise)
      .set({ photoStorageKey: cle })
      .where(and(eq(membresEntreprise.id, a.id), eq(membresEntreprise.entrepriseId, ctx.entrepriseId)));
    return { avant: a.photo };
  });
}

export type ResultatLien =
  | { ok: true; /** Un fichier devenu orphelin, à supprimer. */ aSupprimer: string | null }
  | { ok: false; raison: string };

/**
 * Relie un compte à un nom de la liste des salariés, par son RANG, ou le
 * délie (`rang` null). Le patron seul : l'action le garde.
 *
 * **La ligne se crée si elle n'existe pas** : on relie « Salarié 3 » sans
 * l'avoir nommé, comme on le coche sur un chantier.
 *
 * **Un nom déjà relié à un AUTRE compte est refusé**, pas déplacé : un
 * déplacement silencieux ferait perdre sa photo à quelqu'un sans que personne
 * le voie.
 *
 * **La photo que le compte portait seul rejoint sa ligne** si la ligne n'en a
 * pas : il ne la reperd pas en étant relié. Si la ligne en a déjà une, c'est
 * elle qui reste, et l'autre fichier est rendu pour être supprimé : une photo
 * de personne ne reste pas stockée pour rien.
 */
export async function relierAuSalarie(ctx: Ctx, accesId: string, rang: number | null): Promise<ResultatLien> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [membre] = await tx
      .select({ id: membresEntreprise.id, photo: membresEntreprise.photoStorageKey })
      .from(membresEntreprise)
      .where(and(eq(membresEntreprise.id, accesId), eq(membresEntreprise.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!membre) return { ok: false, raison: "Ce compte est introuvable." };

    if (rang === null) {
      await tx
        .update(membresEntreprise)
        .set({ salarieId: null })
        .where(and(eq(membresEntreprise.id, accesId), eq(membresEntreprise.entrepriseId, ctx.entrepriseId)));
      return { ok: true, aSupprimer: null };
    }

    const rangBorne = Math.min(MAX_EQUIPES, Math.max(1, Math.trunc(rang)));
    let [ligne] = await tx
      .select({ id: equipes.id, photo: equipes.photoStorageKey })
      .from(equipes)
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.rang, rangBorne)))
      .limit(1);
    if (!ligne) {
      [ligne] = await tx
        .insert(equipes)
        .values({ entrepriseId: ctx.entrepriseId, rang: rangBorne })
        .returning({ id: equipes.id, photo: equipes.photoStorageKey });
    }

    const [deja] = await tx
      .select({ id: membresEntreprise.id })
      .from(membresEntreprise)
      .where(
        and(
          eq(membresEntreprise.entrepriseId, ctx.entrepriseId),
          eq(membresEntreprise.salarieId, ligne.id),
          ne(membresEntreprise.id, accesId)
        )
      )
      .limit(1);
    if (deja) return { ok: false, raison: "Ce nom est déjà relié à un autre compte." };

    let aSupprimer: string | null = null;
    if (membre.photo) {
      if (ligne.photo) aSupprimer = membre.photo;
      else
        await tx
          .update(equipes)
          .set({ photoStorageKey: membre.photo, updatedAt: new Date() })
          .where(and(eq(equipes.id, ligne.id), eq(equipes.entrepriseId, ctx.entrepriseId)));
    }

    await tx
      .update(membresEntreprise)
      .set({ salarieId: ligne.id, photoStorageKey: null })
      .where(and(eq(membresEntreprise.id, accesId), eq(membresEntreprise.entrepriseId, ctx.entrepriseId)));
    return { ok: true, aSupprimer };
  });
}
