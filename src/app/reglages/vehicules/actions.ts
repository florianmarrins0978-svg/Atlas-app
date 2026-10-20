"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { refusDuPdfDepose } from "@/server/pdf/attestation-deposee";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { logger } from "@/server/logger";
import { lireDocumentVehicule } from "@/server/ai/services/lire-document-vehicule";
import {
  COLONNES_DU_DOCUMENT,
  creerVehicule,
  getVehicule,
  mettreAJourVehicule,
  retirerVehicule,
  type VehiculeEnBase,
} from "@/server/repositories/vehicules";
import {
  CHAMPS_VEHICULE,
  NATURES_DOCUMENT_VEHICULE,
  NOM_DOCUMENT_VEHICULE,
  phraseDeLecture,
  rangerLecture,
  refusDuDocumentVehicule,
  typeDuDocument,
  valeurDuChamp,
  type ChampVehicule,
  type LectureDocumentVehicule,
  type NatureDocumentVehicule,
  type SourcesVehicule,
} from "@/lib/vehicules";

/**
 * LES GESTES DE LA RUBRIQUE VÉHICULES — sa planche du 14 octobre 2026, la
 * troisième. **Le patron seul écrit** ; les autres rôles lisent
 * (`REGLAGES_A_TOUS`, `acces-roles.ts`).
 *
 * Un refus attendu se rend en VALEUR, jamais en exception : le message d'une
 * exception levée ici n'arriverait pas jusqu'à son écran (`AGENTS.md`).
 */

const NOM_PROVISOIRE = "Nouveau véhicule";

type Refus = { ok: false; raison: string };

function rafraichir(id: string) {
  revalidatePath("/reglages/vehicules");
  revalidatePath(`/reglages/vehicules/${id}`);
  // L'accueil porte les rappels des contrôles.
  revalidatePath("/");
}

async function patron(action: string): Promise<{ ok: true; ctx: Awaited<ReturnType<typeof getCurrentCtx>> } | Refus> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, action);
  } catch {
    return { ok: false, raison: "Seul le patron peut modifier les véhicules." };
  }
  return { ok: true, ctx };
}

/** Les colonnes d'un papier rangé, prêtes pour la mise à jour. */
function papierRange(nature: NatureDocumentVehicule, cle: string) {
  const c = COLONNES_DU_DOCUMENT[nature];
  return { [c.cle]: cle, [c.le]: new Date() } as Partial<VehiculeEnBase>;
}

/**
 * AJOUTER UN PAPIER — une photo ou un PDF, sur un véhicule existant ou pour en
 * créer un (`vehiculeId` absent : « Ajouter un véhicule »).
 *
 * Dans cet ordre, et l'ordre compte :
 * 1. le fichier se vérifie (format, poids, vrai PDF, vraie photo) ;
 * 2. Atlas le LIT avant de le ranger : un papier d'une autre plaque se refuse
 *    sans rien écrire, ni fichier ni case ;
 * 3. s'il ne sait pas ce que c'est, il le range et DEMANDE (« a-classer »),
 *    plutôt que de le supposer ;
 * 4. sinon il remplit les cases, marquées « d'après … ».
 */
export async function ajouterDocumentVehiculeAction(
  formData: FormData
): Promise<
  | { ok: true; vehiculeId: string; message: string; remplis: ChampVehicule[] }
  | { ok: "a-classer"; vehiculeId: string; cle: string }
  | Refus
> {
  const garde = await patron("ajouter un papier de véhicule");
  if (!garde.ok) return garde;
  const { ctx } = garde;
  try {
    const fichier = formData.get("fichier");
    if (!(fichier instanceof File)) return { ok: false, raison: "Aucun fichier reçu." };
    const idDemande = formData.get("vehiculeId");
    const vehicule = typeof idDemande === "string" && idDemande !== "" ? await getVehicule(ctx, idDemande) : undefined;
    if (typeof idDemande === "string" && idDemande !== "" && !vehicule) {
      return { ok: false, raison: "Ce véhicule n’existe plus." };
    }

    const mime = fichier.type.split(";")[0].trim().toLowerCase();
    const refus = refusDuDocumentVehicule(mime, fichier.size);
    if (refus) return { ok: false, raison: refus };
    const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
    if (!limite.autorise) return { ok: false, raison: limite.message };

    let octets: Buffer;
    let extension: string;
    let mimeRange: string;
    if (mime === "application/pdf") {
      const brut = new Uint8Array(await fichier.arrayBuffer());
      const refusPdf = await refusDuPdfDepose(brut);
      if (refusPdf) return { ok: false, raison: refusPdf };
      octets = Buffer.from(brut);
      extension = ".pdf";
      mimeRange = mime;
    } else {
      // La porte commune des photos : signature vérifiée, et la position GPS
      // de la photo retirée avant qu'elle soit rangée.
      const prete = await preparerPhotoEntrante(fichier, "papier de véhicule");
      if (!prete.ok) return { ok: false, raison: prete.raison };
      octets = Buffer.from(prete.photo.octets);
      extension = prete.photo.extension;
      mimeRange = prete.photo.mimeType;
    }

    if (!typeDuDocument(`papier${extension}`)) return { ok: false, raison: "Ce format ne se lit pas. Choisissez un PDF, ou une photo." };

    // **La lecture ne fait jamais échouer le dépôt** : sans elle, le papier est
    // rangé quand même, et l'écran demande ce que c'est.
    let lue: LectureDocumentVehicule | null = null;
    try {
      lue = await lireDocumentVehicule(octets.toString("base64"), mimeRange);
    } catch (err) {
      logger.error("Lecture d'un papier de véhicule impossible", {
        erreur: err instanceof Error ? err.message : String(err),
      });
    }
    const rangement = rangerLecture(vehicule ?? null, lue);
    if (rangement.statut === "autre-vehicule") {
      return {
        ok: false,
        raison: `Ce document est pour le véhicule ${rangement.plaqueLue}, pas pour ${vehicule?.plaque}. Rien n’a été rangé.`,
      };
    }

    const objet = await enregistrerObjet(`entreprises/${ctx.entrepriseId}/vehicules`, octets, extension, mimeRange);
    const cible = vehicule ?? (await creerVehicule(ctx, NOM_PROVISOIRE));

    if (rangement.statut === "inconnu") {
      rafraichir(cible.id);
      return { ok: "a-classer", vehiculeId: cible.id, cle: objet.storageKey };
    }

    const sources: SourcesVehicule = { ...cible.sources };
    for (const champ of Object.keys(rangement.champs) as ChampVehicule[]) {
      if (rangement.champs[champ] === null) delete sources[champ];
      else sources[champ] = rangement.nature;
    }
    const modele = rangement.champs.modele;
    await mettreAJourVehicule(ctx, cible.id, {
      ...(rangement.champs as Partial<VehiculeEnBase>),
      ...papierRange(rangement.nature, objet.storageKey),
      sources,
      // Un véhicule né de sa carte grise prend le nom de son modèle ; un nom
      // qu'il a déjà donné ne se remplace jamais.
      ...(cible.nom === NOM_PROVISOIRE && typeof modele === "string" ? { nom: modele } : {}),
    });
    rafraichir(cible.id);
    const remplis = (Object.keys(rangement.champs) as ChampVehicule[]).filter((c) => rangement.champs[c] !== null);
    return { ok: true, vehiculeId: cible.id, message: phraseDeLecture(rangement.nature, remplis.length), remplis };
  } catch (err) {
    logger.error("Dépôt d'un papier de véhicule impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "Le document n’a pas pu être enregistré. Réessayez." };
  }
}

/**
 * Ranger un papier qu'Atlas n'a pas su lire, sous la nature que le patron a
 * choisie. **La clé doit venir de SON dossier de véhicules** : sans cette
 * vérification, une clé forgée rattacherait le fichier d'une autre entreprise.
 */
export async function classerDocumentVehiculeAction(
  vehiculeId: string,
  cle: string,
  nature: NatureDocumentVehicule
): Promise<{ ok: true; message: string } | Refus> {
  const garde = await patron("ranger un papier de véhicule");
  if (!garde.ok) return garde;
  const { ctx } = garde;
  if (!NATURES_DOCUMENT_VEHICULE.includes(nature)) return { ok: false, raison: "Choisissez le papier." };
  const dossier = `entreprises/${ctx.entrepriseId}/vehicules/`;
  if (!cle.startsWith(dossier) || cle.includes("..") || !typeDuDocument(cle)) return { ok: false, raison: "Ce document est introuvable." };
  try {
    const v = await mettreAJourVehicule(ctx, vehiculeId, papierRange(nature, cle));
    if (!v) return { ok: false, raison: "Ce véhicule n’existe plus." };
    rafraichir(vehiculeId);
    return { ok: true, message: `Rangé comme ${NOM_DOCUMENT_VEHICULE[nature].toLowerCase()}. Remplissez les cases à la main.` };
  } catch (err) {
    logger.error("Classement d'un papier de véhicule impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "Le document n’a pas pu être rangé. Réessayez." };
  }
}

/**
 * Corriger une case à la main — sa demande : *« pouvoir modifier les infos à
 * la main si elle s'est trompée ou si ça a changé »*. La case perd sa mention
 * « d'après … » : c'est désormais SA valeur.
 */
export async function modifierChampVehiculeAction(
  vehiculeId: string,
  champ: ChampVehicule,
  brut: string
): Promise<{ ok: true; valeur: string | number | null } | Refus> {
  const garde = await patron("modifier un véhicule");
  if (!garde.ok) return garde;
  const { ctx } = garde;
  if (!CHAMPS_VEHICULE.includes(champ)) return { ok: false, raison: "Cette case n’existe pas." };
  const lu = valeurDuChamp(champ, brut);
  if (!lu.ok) return lu;
  try {
    const avant = await getVehicule(ctx, vehiculeId);
    if (!avant) return { ok: false, raison: "Ce véhicule n’existe plus." };
    const sources: SourcesVehicule = { ...avant.sources };
    delete sources[champ];
    await mettreAJourVehicule(ctx, vehiculeId, { [champ]: lu.valeur, sources } as Partial<VehiculeEnBase>);
    rafraichir(vehiculeId);
    return { ok: true, valeur: lu.valeur };
  } catch (err) {
    logger.error("Modification d'un véhicule impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "La case n’a pas pu être enregistrée. Réessayez." };
  }
}

/** Un véhicule vendu sort de la liste et de l'accueil. */
export async function retirerVehiculeAction(vehiculeId: string): Promise<{ ok: true } | Refus> {
  const garde = await patron("retirer un véhicule");
  if (!garde.ok) return garde;
  try {
    const retire = await retirerVehicule(garde.ctx, vehiculeId);
    if (!retire) return { ok: false, raison: "Ce véhicule n’existe plus." };
    rafraichir(vehiculeId);
    return { ok: true };
  } catch (err) {
    logger.error("Retrait d'un véhicule impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "Le véhicule n’a pas pu être retiré. Réessayez." };
  }
}
