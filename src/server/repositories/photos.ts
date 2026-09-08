import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { photos, fichiersAPurger, chantiers } from "../db/schema";
import { enregistrerObjet, lireObjet } from "../storage";
import type { Ctx } from "./context";

type FichierPhoto = {
  storageKey: string;
  mimeType: string;
  tailleOctets: number;
  nomOriginal?: string;
  checksum: string;
};

export async function listerPhotos(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select()
      .from(photos)
      .where(and(eq(photos.chantierId, chantierId), isNull(photos.deletedAt)))
  );
}

export async function ajouterPhoto(ctx: Ctx, chantierId: string, fichier: FichierPhoto) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const existantes = await tx
      .select()
      .from(photos)
      .where(and(eq(photos.chantierId, chantierId), isNull(photos.deletedAt)));

    const [row] = await tx
      .insert(photos)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId,
        ...fichier,
        ordre: existantes.length,
        createdBy: ctx.utilisateurId,
      })
      .returning();
    return row;
  });
}

export type PhotoDAvant = {
  id: string;
  storageKey: string;
  chantierId: string;
  chantierNom: string;
  faiteLe: string;
};

/**
 * Ce qu'on avait photographié chez ce client, sur ses AUTRES chantiers.
 *
 * **Sa demande du 8 septembre 2026 :** *« si ce n'est pas le premier devis les
 * anciennes photos peuvent apparaître à l'écran mais sans s'inscrire de nouveau,
 * juste pour voir ce qu'on avait fait la dernière fois. »*
 *
 * Elles ne sont donc PAS les photos de ce chantier-ci : elles servent à se
 * rappeler, et elles ne rejoignent le dossier que si le patron les coche
 * (`recopierPhotos`, juste en dessous).
 *
 * Le chantier en cours est exclu — ses photos à lui sont déjà dans la
 * pellicule, et les montrer deux fois lui ferait croire à des doublons.
 */
export async function photosDesAutresChantiers(
  ctx: Ctx,
  clientId: string,
  saufChantierId: string | null,
  maximum = 12
): Promise<PhotoDAvant[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const conditions = [
      eq(chantiers.clientId, clientId),
      isNull(photos.deletedAt),
      isNull(chantiers.deletedAt),
    ];
    if (saufChantierId) conditions.push(ne(photos.chantierId, saufChantierId));

    const lignes = await tx
      .select({
        id: photos.id,
        storageKey: photos.storageKey,
        chantierId: photos.chantierId,
        chantierNom: chantiers.nom,
        faiteLe: photos.createdAt,
      })
      .from(photos)
      .innerJoin(chantiers, eq(photos.chantierId, chantiers.id))
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt))
      .limit(maximum);

    return lignes.map((l) => ({ ...l, faiteLe: new Date(l.faiteLe).toISOString() }));
  });
}

/**
 * Reprendre des photos d'un chantier passé sur celui d'aujourd'hui.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **LE FICHIER EST RECOPIÉ, JAMAIS PARTAGÉ — et c'est tout l'enjeu.**
 *
 * Réutiliser la `storage_key` d'origine aurait paru élégant : une ligne de
 * plus, aucun octet déplacé. Ce serait un défaut différé, et grave.
 * `supprimerPhoto` met **la clé** en file de purge (`fichiersAPurger`, juste en
 * dessous) : le jour où le patron efface l'ancienne photo, le fichier disparaît
 * — et avec lui la photo du chantier neuf, qui pointait dessus. Le salarié
 * ouvrirait alors une fiche d'intervention aux images mortes, sans que rien
 * n'ait été supprimé de son côté.
 *
 * On paie donc une copie d'octets, une fois, pour que les deux dossiers soient
 * réellement indépendants.
 *
 * **Ce qui est délibérément conservé :** le type et le nom d'origine. Ce qui ne
 * l'est pas : l'ordre, qui repart de la pellicule du nouveau chantier.
 *
 * Rend les photos créées. Une photo qu'on ne retrouve pas — effacée entre
 * l'affichage et la validation, ou appartenant à une autre entreprise, ce que
 * la RLS rend indiscernable — est simplement ignorée : elle ne doit pas faire
 * échouer l'enregistrement d'un chantier.
 */
export async function recopierPhotos(
  ctx: Ctx,
  photoIds: readonly string[],
  versChantierId: string
) {
  if (photoIds.length === 0) return [];

  // Les sources sont relues ICI, jamais transmises par l'écran : une clé de
  // rangement qui voyage est une clé qu'on peut changer en chemin.
  const sources = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select()
      .from(photos)
      .where(and(inArray(photos.id, [...photoIds]), isNull(photos.deletedAt)))
  );

  const creees = [];
  for (const source of sources) {
    let octets: Buffer;
    try {
      octets = await lireObjet(source.storageKey);
    } catch {
      // Le fichier a disparu du rangement. On saute : un chantier ne se refuse
      // pas pour une photo perdue, et la pellicule dira ce qu'elle a repris.
      continue;
    }
    const extension = extensionDe(source.storageKey);
    const objet = await enregistrerObjet(
      `chantiers/${versChantierId}/photos`,
      octets,
      extension
    );
    creees.push(
      await ajouterPhoto(ctx, versChantierId, {
        storageKey: objet.storageKey,
        mimeType: source.mimeType,
        tailleOctets: objet.tailleOctets,
        nomOriginal: source.nomOriginal ?? undefined,
        checksum: objet.checksum,
      })
    );
  }
  return creees;
}

/** L'extension d'une clé de rangement, point compris — « .jpg », ou rien. */
function extensionDe(storageKey: string): string {
  const dernier = storageKey.slice(storageKey.lastIndexOf("/") + 1);
  const point = dernier.lastIndexOf(".");
  return point === -1 ? "" : dernier.slice(point);
}

// Suppression douce : marquée deleted_at, le fichier physique n'est jamais
// détruit immédiatement — mis en file pour purge différée (voir fichiers.ts).
export async function supprimerPhoto(ctx: Ctx, photoId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [photo] = await tx.select().from(photos).where(eq(photos.id, photoId)).limit(1);
    if (!photo) return null;
    await tx.update(photos).set({ deletedAt: new Date() }).where(eq(photos.id, photoId));
    await tx.insert(fichiersAPurger).values({ storageKey: photo.storageKey });
    return photo;
  });
}
