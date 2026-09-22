"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { getRole } from "@/server/autorisation";
import { exigerEcran, exigerChantierDansSaPortee } from "@/server/garde-action";
import { cheminAutorise, peutPoserUnRetour } from "@/lib/acces-roles";
import {
  attacherPhotoALaFiche,
  contexteDuChantier,
  detacherPhotoDeLaFiche,
  enregistrerLaFiche,
  ficheDuChantier,
  marquerTransmise,
  ouvrirLaFiche,
  rouvrirLaFiche,
  signerLaFiche,
  type ContexteDuChantier,
  type FicheEnregistree,
} from "@/server/repositories/fiches-securite";
import { listerPhotos, recevoirPhotoDeChantier, supprimerPhoto } from "@/server/repositories/photos";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { POINTS_MINIMUM_D_UNE_SIGNATURE, type ContenuFiche } from "@/lib/fiche-securite";

// LES GESTES DE LA FICHE DE SÉCURITÉ, depuis le planning.
//
// **Pourquoi sous /planning et pas sous /paysage.** Paysage est fermé aux
// salariés (`acces-roles.ts`) ; or la loi veut que la fiche soit *« communiquée
// et présentée aux travailleurs avant le début des travaux »*. Elle vit donc là
// où ils sont : sur la fiche du jour, et tout rôle qui pose un retour peut la
// lire, la remplir et la signer (le « représentant » du chef d'entreprise, c'est
// le responsable sur le chantier). La liste des fiches signées, elle, est dans
// Paysage, comme il l'a décidé.

type Refus = { ok: false; raison: string };

async function garder(chantierId: string, action: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/planning", action);
  const role = await getRole(ctx);
  if (!role || !peutPoserUnRetour(role)) {
    await exigerEcran(ctx, "/interdit", action);
  }
  await exigerChantierDansSaPortee(ctx, chantierId, action);
  return ctx;
}

function rafraichir(chantierId: string) {
  revalidatePath("/planning");
  revalidatePath(`/planning/fiche-de-securite/${chantierId}`);
  revalidatePath("/paysage/fiches-securite");
}

/**
 * Le bandeau du planning : où en est la fiche, sans rien créer — et si la liste
 * de Paysage s'ouvre à cette personne. La MÊME fonction que celle qui refuse
 * (`cheminAutorise`) : un lien vers une page interdite se lirait comme une panne.
 */
export async function etatDeLaFicheAction(
  chantierId: string
): Promise<{ fiche: FicheEnregistree | null; paysageOuvert: boolean }> {
  const ctx = await garder(chantierId, "lire la fiche de sécurité");
  const role = await getRole(ctx);
  return { fiche: await ficheDuChantier(ctx, chantierId), paysageOuvert: role !== null && cheminAutorise(role, "/paysage") };
}

export type FicheOuverte = {
  fiche: FicheEnregistree;
  contexte: ContexteDuChantier;
  photos: { id: string; storageKey: string }[];
};

/** Le formulaire : la fiche (créée si besoin, à partir de ce qui est gardé), et ce qu'Atlas sait du chantier. */
export async function ouvrirLaFicheAction(chantierId: string): Promise<FicheOuverte | Refus> {
  const ctx = await garder(chantierId, "ouvrir la fiche de sécurité");
  const contexte = await contexteDuChantier(ctx, chantierId);
  if (!contexte) return { ok: false, raison: "Chantier introuvable." };
  const [fiche, photos] = await Promise.all([ouvrirLaFiche(ctx, chantierId), listerPhotos(ctx, chantierId)]);
  return { fiche, contexte, photos: photos.map((p) => ({ id: p.id, storageKey: p.storageKey })) };
}

/**
 * POSER UNE PHOTO SUR LA FICHE — et elle y reste.
 *
 * **Sa règle du 22 septembre 2026 :** *« les photos dans la fiche de sécurité
 * restent à l'intérieur de la fiche, et les photos de la fiche client restent à
 * l'intérieur de la feuille travaux à faire »*. D'où ce geste propre à la
 * fiche, là où elle empruntait celui du retour du jour : la liaison s'écrit
 * dans le même souffle que l'inscription (`attacherPhotoALaFiche`), et la
 * photo ne passe jamais par « Travaux à faire », pas même une minute.
 *
 * L'image, elle, entre par le chemin commun — nettoyée de ses métadonnées,
 * rangée, comptée sous le plafond du chantier.
 */
export async function ajouterPhotoDeLaFicheAction(
  formData: FormData
): Promise<{ ok: true; id: string; storageKey: string } | Refus> {
  const chantierId = String(formData.get("chantierId") ?? "");
  if (!chantierId) return { ok: false, raison: "Chantier inconnu." };
  const ctx = await garder(chantierId, "ajouter une photo à la fiche de sécurité");

  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) return { ok: false, raison: limite.message };

  const ajout = await recevoirPhotoDeChantier(ctx, chantierId, formData.get("fichier"));
  if (!ajout.ok) return ajout;

  // **La fiche doit exister**, et elle existe : on n'atteint l'écran 3 qu'après
  // deux « Suivant », qui l'ont créée. Si elle n'existait pas, la photo serait
  // une photo de chantier ordinaire — donc visible dans « Travaux à faire » :
  // on le dit plutôt que de la laisser filer là-bas.
  if (!(await attacherPhotoALaFiche(ctx, chantierId, ajout.photo.id))) {
    return { ok: false, raison: "La fiche n’est pas encore ouverte : la photo n’a pas pu y être rangée." };
  }
  rafraichir(chantierId);
  return { ok: true, id: ajout.photo.id, storageKey: ajout.photo.storageKey };
}

/** La retirer de la fiche — tant qu'elle n'est pas signée. */
export async function retirerPhotoDeLaFicheAction(
  chantierId: string,
  photoId: string
): Promise<{ ok: true } | Refus> {
  const ctx = await garder(chantierId, "retirer une photo de la fiche de sécurité");
  const detachee = await detacherPhotoDeLaFiche(ctx, chantierId, photoId);
  if (!detachee.ok) return detachee;
  // **Détachée d'abord, effacée ensuite** : `supprimerPhoto` regarde qui tient
  // encore la photo pour décider de la purge du fichier. Tant que la liaison
  // existe, il la croirait gardée par la fiche et laisserait le fichier.
  await supprimerPhoto(ctx, photoId);
  rafraichir(chantierId);
  return { ok: true };
}

/**
 * **`rafraichirLesEcrans` : pourquoi un enregistrement peut se taire.**
 *
 * L’écran enregistre désormais pendant qu’il écrit, pas seulement au
 * « Suivant » — sinon sortir vers le décret ou le formulaire MSA en plein
 * remplissage rend l’étape en cours au vide (22 septembre 2026). Mais
 * `revalidatePath` fait refaire au routeur les trois écrans qui montrent la
 * fiche, et le faire toutes les deux secondes pendant qu’il tape, c’est
 * recharger sous ses doigts pour rien : seul son écran a changé, et il l’a
 * déjà devant lui. Le bandeau du planning, lui, se rafraîchit au « Suivant »
 * et au « Retour », quand il quitte pour de bon.
 *
 * Une seule fonction écrit la fiche : deux en divergeraient (`CLAUDE.md` §3).
 */
export async function enregistrerLaFicheAction(
  chantierId: string,
  quoi: { contenu: ContenuFiche; etapeVue: number; loiLue: boolean; rafraichirLesEcrans?: boolean }
): Promise<{ ok: true } | Refus> {
  const ctx = await garder(chantierId, "enregistrer la fiche de sécurité");
  const fiche = await enregistrerLaFiche(ctx, chantierId, quoi);
  if (!fiche) return { ok: false, raison: "La fiche n’existe pas encore : ouvrez-la d’abord." };
  if (quoi.rafraichirLesEcrans !== false) rafraichir(chantierId);
  return { ok: true };
}

export async function signerLaFicheAction(
  chantierId: string,
  quoi: { contenu: ContenuFiche; signaturePng: string; points: number; signataire: string }
): Promise<{ ok: true; signeeLe: string } | Refus> {
  const ctx = await garder(chantierId, "signer la fiche de sécurité");
  if (quoi.points < POINTS_MINIMUM_D_UNE_SIGNATURE || !quoi.signaturePng.startsWith("data:image/png;base64,")) {
    return { ok: false, raison: "Signez au doigt avant de signer la fiche." };
  }
  if (!quoi.signataire.trim()) return { ok: false, raison: "Le nom du signataire manque." };
  const enregistree = await enregistrerLaFiche(ctx, chantierId, { contenu: quoi.contenu, etapeVue: 6, loiLue: true });
  if (!enregistree) return { ok: false, raison: "La fiche n’existe pas encore : ouvrez-la d’abord." };
  const signee = await signerLaFiche(ctx, chantierId, { signaturePng: quoi.signaturePng, signataire: quoi.signataire });
  if (!signee?.signeeLe) return { ok: false, raison: "La signature n’a pas pu être enregistrée." };
  rafraichir(chantierId);
  return { ok: true, signeeLe: signee.signeeLe.toISOString() };
}

/** « Modifier » une fiche signée : la signature part, tout se relit, on re-signe. */
export async function rouvrirLaFicheAction(chantierId: string): Promise<{ ok: true } | Refus> {
  const ctx = await garder(chantierId, "modifier la fiche de sécurité");
  const fiche = await rouvrirLaFiche(ctx, chantierId);
  if (!fiche) return { ok: false, raison: "Aucune fiche à modifier." };
  rafraichir(chantierId);
  return { ok: true };
}

/** La feuille de partage s'est ouverte : la fiche est marquée transmise. */
export async function marquerTransmiseAction(chantierId: string): Promise<{ ok: true } | Refus> {
  const ctx = await garder(chantierId, "transmettre la fiche de sécurité");
  const fiche = await ficheDuChantier(ctx, chantierId);
  if (!fiche?.signeeLe) return { ok: false, raison: "Signez la fiche avant de la transmettre." };
  await marquerTransmise(ctx, chantierId);
  rafraichir(chantierId);
  return { ok: true };
}
