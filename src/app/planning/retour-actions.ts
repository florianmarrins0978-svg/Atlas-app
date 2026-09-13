"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { getRole } from "@/server/autorisation";
import { exigerEcran, exigerChantierDansSaPortee } from "@/server/garde-action";
import { peutPoserUnRetour } from "@/lib/acces-roles";
import { getEntreprise } from "@/server/repositories/entreprises";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import { fonctionOuverte } from "@/lib/abonnements";
import { listerPhotos, ajouterPhoto } from "@/server/repositories/photos";
import { poserLeRetour, retourDuChantier } from "@/server/repositories/retours-intervention";
import { tachesDuChantier } from "@/server/repositories/devis";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { peutPoserLeRetour, phraseDeCeQuiManque, type TacheDuRetour } from "@/lib/retour-intervention";

/**
 * LE RETOUR D'INTERVENTION — les gestes du salarié, depuis le planning.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **LA PREMIÈRE ÉCRITURE RENDUE AU SALARIÉ**, sa décision du 8 septembre 2026 :
 * *« le salarié dépose photos et "c'est fini" sur les chantiers de sa journée,
 * et rien d'autre […]. Que le contrôle le prouve. »*
 *
 * **Trois gardes, et aucune n'est décorative :**
 *
 * | `exigerEcran(ctx, "/planning")` | le planning est sa SEULE porte |
 * | `peutPoserUnRetour(role)` | la permission nommée, celle qui bougera un jour |
 * | `exigerChantierDansSaPortee` | « de SA journée » — sinon un identifiant deviné suffirait |
 *
 * La troisième est celle qui a manqué ailleurs : le 29 août 2026, sept actions
 * du planning laissaient un salarié resserré agir sur des chantiers qu'il ne
 * voyait même pas. Le patron croyait avoir restreint ; il n'avait restreint que
 * ce qui s'affiche.
 *
 * **Aucun montant ne traverse ce fichier**, et c'est structurel : un retour n'en
 * porte pas, et `tachesDuChantier` rend le devis SANS ses prix — c'est le même
 * chargement que la feuille de chantier, qui est déjà ouverte au salarié.
 */

/** Ce qu'un refus rend — jamais une exception : son message n'arriverait pas. */
type Refus = { ok: false; raison: string };

async function garder(chantierId: string, action: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/planning", action);
  const role = await getRole(ctx);
  if (!role || !peutPoserUnRetour(role)) {
    // **Un refus attendu se REND**, il ne se lève pas : le message d'une
    // exception d'action serveur n'arrive jamais jusqu'à l'écran (`AGENTS.md`,
    // piège 0 ter). Ici on lève quand même, parce que ce cas-là n'est pas
    // attendu — il n'arrive qu'à un appel direct, et personne n'attend de mot.
    await exigerEcran(ctx, "/interdit", action);
  }
  await exigerChantierDansSaPortee(ctx, chantierId, action);
  return ctx;
}

/**
 * CE QUE LE PATRON EXIGE EN FIN DE CHANTIER — lu à UN endroit pour les deux
 * gestes, et tenu par la formule.
 *
 * Les retours sont un plus d'« Entreprise » (sa décision du 10 septembre 2026).
 * Un « Artisan » qui avait coché « retour demandé » avant de choisir sa formule
 * ne doit pas continuer à le faire réclamer à ses gars : ce qu'il ne peut plus
 * lire, on ne le leur demande pas. La règle vit dans `fonctionOuverte` ; ici on
 * la lit, on ne la réécrit pas.
 */
async function reglesDuRetour(ctx: Awaited<ReturnType<typeof garder>>) {
  const [entreprise, abonnement] = await Promise.all([getEntreprise(ctx), abonnementDeLEntreprise(ctx)]);
  const ouvert = fonctionOuverte(abonnement?.formule, "retours");
  return {
    demande: ouvert && (entreprise?.retourDemande ?? false),
    photoExigee: ouvert && (entreprise?.retourPhotoExigee ?? false),
  };
}

/**
 * Ce que l'écran a besoin de savoir en ouvrant la fiche : ce qu'il y a à faire,
 * ce que le patron exige, et le retour s'il existe déjà.
 *
 * **Une seule requête pour les quatre**, parce que la feuille s'ouvre au doigt
 * sur un chantier, dehors, souvent sur un réseau lent : quatre allers-retours
 * feraient un écran qui se remplit par morceaux sous les yeux.
 */
export async function etatDuRetourAction(chantierId: string) {
  const ctx = await garder(chantierId, "lire le retour d'intervention");

  const [regles, feuille, retour, sesPhotos] = await Promise.all([
    reglesDuRetour(ctx),
    tachesDuChantier(ctx, chantierId),
    retourDuChantier(ctx, chantierId),
    listerPhotos(ctx, chantierId),
  ]);

  return {
    regles,
    // Ce qu'il y a à faire vient du DEVIS, sans un prix — c'est déjà ce que la
    // feuille de chantier affiche, et une seconde source divergerait.
    aFaire: feuille?.taches ?? [],
    retour,
    photos: sesPhotos.map((p) => ({ id: p.id, storageKey: p.storageKey })),
  };
}

/**
 * Poser « C'est fini ».
 *
 * **Le refus est REJOUÉ ici**, alors que l'écran l'a déjà empêché : un appel
 * direct ne passe pas par l'écran, et la règle qui décide est la même des deux
 * côtés (`peutPoserLeRetour`, fonction pure). Deux rédactions du même refus
 * finiraient par se contredire, et c'est celle qu'il lit sur son téléphone qui
 * paraîtrait fausse.
 */
export async function poserLeRetourAction(
  chantierId: string,
  quoi: { taches: TacheDuRetour[]; photoIds: string[]; aSignaler: string | null }
): Promise<{ ok: true } | Refus> {
  const ctx = await garder(chantierId, "poser un retour d'intervention");

  const regles = await reglesDuRetour(ctx);
  const pose = { taches: quoi.taches, photos: quoi.photoIds.length };
  if (!peutPoserLeRetour(pose, regles)) {
    return { ok: false, raison: phraseDeCeQuiManque(pose, regles) };
  }

  await poserLeRetour(ctx, chantierId, {
    taches: quoi.taches,
    photoIds: quoi.photoIds,
    aSignaler: quoi.aSignaler,
  });

  revalidatePath("/planning");
  // Le patron le lit dans Terminés : sans cela il verrait la liste d'hier.
  revalidatePath("/termines");
  revalidatePath("/termines/retours");
  return { ok: true };
}

/**
 * Ajouter une photo depuis la fiche d'intervention.
 *
 * **Pourquoi une action à part, et pas `ajouterPhotoAction`.** Celle du dossier
 * `chantiers/` exige l'écran `/chantiers`, qui est fermé au salarié — et il doit
 * le rester : c'est là que vivent le devis, les prix et la facture. Ouvrir cet
 * écran pour une photo aurait ouvert tout le reste avec.
 *
 * **Tout le reste est repris, jamais refait** : `preparerPhotoEntrante` vérifie
 * la taille, le format, retire les métadonnées — et REFUSE si elle n'a pas pu
 * les retirer. C'est elle qui empêche les coordonnées GPS du domicile d'un
 * client de descendre jusqu'au rangement.
 */
export async function ajouterPhotoDuRetourAction(
  formData: FormData
): Promise<{ ok: true; id: string; storageKey: string } | Refus> {
  const chantierId = String(formData.get("chantierId") ?? "");
  if (!chantierId) return { ok: false, raison: "Chantier inconnu." };

  const ctx = await garder(chantierId, "ajouter une photo au retour");

  const limite = await verifierLimite(
    `televersement:${ctx.entrepriseId}`,
    LIMITES.televersementFichier
  );
  if (!limite.autorise) return { ok: false, raison: limite.message };

  const prete = await preparerPhotoEntrante(formData.get("fichier"), "photo de chantier");
  if (!prete.ok) return { ok: false, raison: prete.raison };

  const objet = await enregistrerObjet(
    `chantiers/${chantierId}/photos`,
    prete.photo.octets,
    prete.photo.extension
  );
  const photo = await ajouterPhoto(ctx, chantierId, {
    storageKey: objet.storageKey,
    mimeType: prete.photo.mimeType,
    tailleOctets: objet.tailleOctets,
    nomOriginal: prete.photo.nomOriginal,
    checksum: objet.checksum,
  });

  return { ok: true, id: photo.id, storageKey: photo.storageKey };
}
