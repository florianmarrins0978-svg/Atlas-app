"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { getRole } from "@/server/autorisation";
import { exigerEcran, exigerChantierDansSaPortee } from "@/server/garde-action";
import { cheminAutorise, peutPoserUnRetour, peutRouvrirUneFicheTransmise } from "@/lib/acces-roles";
import {
  attacherPhotoALaFiche,
  completerLaFicheSignee,
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
import type { Ctx } from "@/server/repositories/context";
import {
  NOMBRE_D_ETAPES,
  contenuRecu,
  ecritureRecue,
  lecturesManquantes,
  minimumLegal,
  refusDeFinaliser,
  refusDeLaSignature,
  refusDuMinimumLegal,
  type ContenuFiche,
} from "@/lib/fiche-securite";

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

const FICHE_SIGNEE = "La fiche est signée : touchez « Modifier » pour la changer.";

/** Une écriture refusée : la fiche n'existe pas, ou elle est signée. Les deux ne se corrigent pas pareil. */
async function raisonDuRefusDEcriture(ctx: Ctx, chantierId: string): Promise<string> {
  const fiche = await ficheDuChantier(ctx, chantierId);
  return fiche?.signeeLe ? FICHE_SIGNEE : "La fiche n’existe pas encore : ouvrez-la d’abord.";
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
): Promise<{ fiche: FicheEnregistree | null; paysageOuvert: boolean; modifiable: boolean }> {
  const ctx = await garder(chantierId, "lire la fiche de sécurité");
  const role = await getRole(ctx);
  const fiche = await ficheDuChantier(ctx, chantierId);
  return {
    fiche,
    paysageOuvert: role !== null && cheminAutorise(role, "/paysage"),
    // La même règle que celle qui refuse : un « Modifier » qu'on toucherait pour
    // se voir refuser se lirait comme une panne.
    modifiable: role !== null && (!fiche?.transmiseLe || peutRouvrirUneFicheTransmise(role)),
  };
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
  // Avant de recevoir l'image : refusée après coup, elle resterait une photo
  // de chantier ordinaire, visible dans « Travaux à faire ».
  if ((await ficheDuChantier(ctx, chantierId))?.signeeLe) return { ok: false, raison: FICHE_SIGNEE };

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
  const effacee = await supprimerPhoto(ctx, photoId);
  if (!effacee.ok) return effacee;
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
  const recue = ecritureRecue(quoi);
  if (!recue.ok) return recue;
  const fiche = await enregistrerLaFiche(ctx, chantierId, recue.ecriture);
  if (!fiche) return { ok: false, raison: await raisonDuRefusDEcriture(ctx, chantierId) };
  if (quoi.rafraichirLesEcrans !== false) rafraichir(chantierId);
  return { ok: true };
}

export async function signerLaFicheAction(
  chantierId: string,
  quoi: { contenu: ContenuFiche; signaturePng: string; points: number }
): Promise<{ ok: true; signeeLe: string } | Refus> {
  const ctx = await garder(chantierId, "signer la fiche de sécurité");
  const refusDuTrait = refusDeLaSignature(quoi.signaturePng, quoi.points);
  if (refusDuTrait) return { ok: false, raison: refusDuTrait };
  const recu = contenuRecu(quoi.contenu);
  if (!recu.ok) return recu;
  if (!recu.contenu.signataire.trim()) return { ok: false, raison: "Le nom du signataire manque." };
  // **Le minimum légal se vérifie ICI, pas seulement à l'écran** — sa règle du
  // 14 octobre 2026. Un bouton grisé n'empêche rien : c'est le serveur qui refuse.
  const contexte = await contexteDuChantier(ctx, chantierId);
  if (!contexte) return { ok: false, raison: "Chantier introuvable." };
  const legal = minimumLegal(recu.contenu, contexte);
  if (legal.length > 0) return { ok: false, raison: refusDuMinimumLegal(legal) };
  const enregistree = await enregistrerLaFiche(ctx, chantierId, { contenu: recu.contenu, etapeVue: NOMBRE_D_ETAPES, loiLue: true });
  if (!enregistree) return { ok: false, raison: await raisonDuRefusDEcriture(ctx, chantierId) };
  const signee = await signerLaFiche(ctx, chantierId, { signaturePng: quoi.signaturePng, signataire: recu.contenu.signataire });
  if (!signee?.signeeLe) return { ok: false, raison: "La signature n’a pas pu être enregistrée." };
  rafraichir(chantierId);
  return { ok: true, signeeLe: signee.signeeLe.toISOString() };
}

/** « Modifier » une fiche signée : la signature part, tout se relit, on re-signe. */
export async function rouvrirLaFicheAction(chantierId: string): Promise<{ ok: true } | Refus> {
  const ctx = await garder(chantierId, "modifier la fiche de sécurité");
  const role = await getRole(ctx);
  const memeTransmise = role !== null && peutRouvrirUneFicheTransmise(role);
  const fiche = await rouvrirLaFiche(ctx, chantierId, { memeTransmise });
  if (!fiche) {
    const actuelle = await ficheDuChantier(ctx, chantierId);
    if (actuelle?.transmiseLe && !memeTransmise) {
      return { ok: false, raison: "La fiche est transmise : seul le chef d’entreprise peut la modifier." };
    }
    return { ok: false, raison: "Aucune fiche à modifier." };
  }
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

/**
 * UN SALARIÉ SIGNE QU'IL A LU LA FICHE — après le chef d'entreprise, sur le
 * même téléphone, avant de commencer. La notice MSA : *« chaque intervenant sur
 * le chantier doit avoir pris connaissance de cette fiche »*.
 *
 * Seul un nom ATTENDU signe (`lecturesManquantes`) : on ne déclare pas lue une
 * fiche par quelqu'un qui n'est pas de l'équipe du chantier, ni deux fois.
 */
export async function signerUneLectureAction(
  chantierId: string,
  quoi: { nom: string; signaturePng: string; points: number }
): Promise<{ ok: true; le: string } | Refus> {
  const ctx = await garder(chantierId, "signer la lecture de la fiche de sécurité");
  const refusDuTrait = refusDeLaSignature(quoi.signaturePng, quoi.points);
  if (refusDuTrait) return { ok: false, raison: refusDuTrait };
  const le = new Date().toISOString();
  const fiche = await completerLaFicheSignee(ctx, chantierId, (c) => {
    const attendu = lecturesManquantes(c).find((n) => n === quoi.nom);
    if (!attendu) return null;
    return { ...c, lectures: [...c.lectures, { nom: attendu, png: quoi.signaturePng, le }] };
  });
  if (!fiche) return { ok: false, raison: "Cette personne ne peut pas signer : elle a déjà signé, n’est pas de l’équipe, ou la fiche est enregistrée." };
  rafraichir(chantierId);
  return { ok: true, le };
}

/** La réponse à « ce client vous a-t-il fait remplir un plan de prévention ? ». Elle décide s'il faut lui envoyer la fiche. */
export async function noterLaPreventionAction(chantierId: string, reponse: "oui" | "non"): Promise<{ ok: true } | Refus> {
  const ctx = await garder(chantierId, "noter le plan de prévention");
  if (reponse !== "oui" && reponse !== "non") return { ok: false, raison: "Réponse inconnue." };
  const fiche = await completerLaFicheSignee(ctx, chantierId, (c) => ({ ...c, prevention: reponse }));
  if (!fiche) return { ok: false, raison: "Signez la fiche d’abord." };
  return { ok: true };
}

/**
 * La feuille de partage s'est ouverte pour l'équipe, une entreprise ou le
 * client : c'est noté. Atlas n'envoie rien lui-même. Le CLIENT seul marque la
 * fiche transmise, comme avant : c'est ce qui réserve sa modification au chef.
 */
export async function noterUnEnvoiAction(chantierId: string, a: string): Promise<{ ok: true } | Refus> {
  const ctx = await garder(chantierId, "noter l’envoi de la fiche de sécurité");
  if (typeof a !== "string" || a.length > 200) return { ok: false, raison: "Destinataire inconnu." };
  const fiche = await completerLaFicheSignee(ctx, chantierId, (c) => (c.envois.includes(a) ? c : { ...c, envois: [...c.envois, a] }));
  if (!fiche) return { ok: false, raison: "Signez la fiche d’abord." };
  if (a === "client") await marquerTransmise(ctx, chantierId);
  rafraichir(chantierId);
  return { ok: true };
}

/**
 * ENREGISTRER LA FICHE POUR DE BON — sa règle du 14 octobre 2026 : *« si un des
 * gars n'a pas signé, le document ne doit pas pouvoir être enregistré »*, et
 * pas davantage sans le minimum légal. Enregistrée, elle rejoint Paysage et ne
 * bouge plus sans « Modifier ».
 */
export async function finaliserLaFicheAction(chantierId: string): Promise<{ ok: true } | Refus> {
  const ctx = await garder(chantierId, "enregistrer la fiche de sécurité");
  const contexte = await contexteDuChantier(ctx, chantierId);
  if (!contexte) return { ok: false, raison: "Chantier introuvable." };
  let refus: string | null = null;
  const fiche = await completerLaFicheSignee(ctx, chantierId, (c) => {
    refus = refusDeFinaliser(c, true, contexte);
    return refus ? null : { ...c, finaliseeLe: new Date().toISOString() };
  });
  if (!fiche) return { ok: false, raison: refus ?? "Signez la fiche d’abord." };
  rafraichir(chantierId);
  return { ok: true };
}

/**
 * UN ABSENT SE DÉCOCHE, MÊME APRÈS LA SIGNATURE — sinon il bloquerait
 * l'enregistrement (sa règle du 14 octobre 2026 : la fiche ne s'enregistre pas
 * tant qu'un des gars n'a pas signé). Seulement quelqu'un qui n'a pas encore
 * signé : une lecture signée ne se défait pas.
 */
export async function marquerAbsentAction(chantierId: string, nom: string): Promise<{ ok: true } | Refus> {
  const ctx = await garder(chantierId, "marquer un absent sur la fiche de sécurité");
  const fiche = await completerLaFicheSignee(ctx, chantierId, (c) => {
    if (!lecturesManquantes(c).includes(nom)) return null;
    return { ...c, equipe: c.equipe.map((p) => (p.nom.trim() === nom ? { ...p, present: false } : p)) };
  });
  if (!fiche) return { ok: false, raison: "Cette personne a déjà signé, ou n’est pas de l’équipe." };
  rafraichir(chantierId);
  return { ok: true };
}
