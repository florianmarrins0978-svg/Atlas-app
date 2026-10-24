"use server";

import { revalidatePath } from "next/cache";
import { estMotifVirement } from "@/lib/pour-mon-comptable";
import { ajouterBilan, dossierEnCours, retirerBilan } from "@/server/repositories/dossiers-comptables";
import { arreterLeDossier } from "@/server/dossier-comptable";
import { enregistrerObjet, supprimerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { refusDuPdfDepose } from "@/server/pdf/attestation-deposee";
import { refusDuDocumentVehicule } from "@/lib/vehicules";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerFacturation } from "@/server/garde-action";
import { lireLaBanque } from "@/server/banque/lecture";
import {
  appliquerCheckUp,
  delier,
  joindreFactureRecue,
  marquerTicketPerdu,
  poserMotif,
  relierTicket,
  type Fait,
} from "@/server/repositories/pour-mon-comptable";

/**
 * POUR MON COMPTABLE — les gestes du dossier (lot 2).
 *
 * **Chaque refus revient en valeur**, avec sa phrase : une exception d'action
 * serveur lui arriverait en identifiant opaque (`AGENTS.md`). Et le même
 * contrôle de rôle que Ma TVA : le dossier montre des montants, il est au
 * patron et à la facturation.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADRESSE_INVALIDE: Fait = { ok: false, raison: "Cette ligne n'existe pas." };

async function contexte(action: string) {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, action);
  return ctx;
}

function apres(r: Fait): Fait {
  if (r.ok) revalidatePath("/termines/comptable", "layout");
  return r;
}

export type BilanDuCheckUp = { ok: true; vues: number; relies: number; restent: number } | { ok: false; raison: string };

/**
 * Le Check up : relire la banque (au plus une fois par demi-heure, la règle
 * des banques ne change pas parce qu'il appuie), puis relier ce qui tombe
 * juste.
 */
export async function checkUpAction(): Promise<BilanDuCheckUp> {
  const ctx = await contexte("faire le Check up du dossier");
  const maintenant = new Date();
  const lecture = await lireLaBanque(ctx, { maintenant });
  if (!lecture.ok) return lecture;
  const { du, au } = await dossierEnCours(ctx, maintenant);
  const b = await appliquerCheckUp(ctx, du, au);
  revalidatePath("/termines/comptable", "layout");
  return { ok: true, vues: b.vues, relies: b.relies.length, restent: b.choix.size + b.aucun.length };
}

export async function relierTicketAction(mouvementId: string, achatId: string): Promise<Fait> {
  if (!UUID.test(mouvementId) || !UUID.test(achatId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("relier un ticket à une ligne du relevé");
  return apres(await relierTicket(ctx, mouvementId, achatId, "patron"));
}

export async function ticketPerduAction(mouvementId: string): Promise<Fait> {
  if (!UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("valider une ligne sans ticket");
  return apres(await marquerTicketPerdu(ctx, mouvementId));
}

export async function motifAction(mouvementId: string, motif: string): Promise<Fait> {
  if (!UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  if (!estMotifVirement(motif)) return { ok: false, raison: "Dites ce qu'est ce virement." };
  const ctx = await contexte("dire ce qu'est un virement");
  return apres(await poserMotif(ctx, mouvementId, motif));
}

export async function joindreFactureAction(mouvementId: string, factureRecueId: string): Promise<Fait> {
  if (!UUID.test(mouvementId) || !UUID.test(factureRecueId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("joindre une facture à un virement");
  return apres(await joindreFactureRecue(ctx, mouvementId, factureRecueId));
}

export async function delierAction(mouvementId: string): Promise<Fait> {
  if (!UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("défaire la justification d'une ligne");
  return apres(await delier(ctx, mouvementId));
}

// ─── Lot 3 : arrêter le dossier, ranger le bilan ─────────────────────────────

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * « Arrêter et ranger » : le dossier sort en PDF et se range, gardé dix ans.
 * Le début ne se choisit qu'au premier dossier (`arreterLeDossier`).
 */
export async function arreterDossierAction(du: string | null, au: string): Promise<{ ok: true } | { ok: false; raison: string }> {
  if (!JOUR.test(au) || (du !== null && !JOUR.test(du))) return { ok: false, raison: "La date n'est pas lisible." };
  const ctx = await contexte("arrêter le dossier du comptable");
  const r = await arreterLeDossier(ctx, { du, au, maintenant: new Date() });
  if (r.ok) revalidatePath("/termines", "layout");
  return r.ok ? { ok: true } : r;
}

/**
 * Le bilan rendu par le comptable : une photo de ses pages, ou le PDF reçu
 * par e-mail. Les mêmes portes que les factures reçues : la signature du
 * fichier vérifiée, la position GPS d'une photo retirée.
 */
export async function ajouterBilanAction(formData: FormData): Promise<Fait> {
  const dossierId = formData.get("dossierId");
  const fichier = formData.get("fichier");
  if (typeof dossierId !== "string" || !UUID.test(dossierId)) return { ok: false, raison: "Ce dossier n'existe pas." };
  if (!(fichier instanceof File)) return { ok: false, raison: "Aucun fichier reçu." };
  const ctx = await contexte("ranger le bilan du comptable");
  const mime = fichier.type.split(";")[0].trim().toLowerCase();
  const refus = refusDuDocumentVehicule(mime, fichier.size);
  if (refus) return { ok: false, raison: refus };
  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) return { ok: false, raison: limite.message };

  let octets: Buffer;
  let extension: string;
  let nature: "photo" | "pdf";
  if (mime === "application/pdf") {
    const brut = new Uint8Array(await fichier.arrayBuffer());
    const refusPdf = await refusDuPdfDepose(brut);
    if (refusPdf) return { ok: false, raison: refusPdf };
    octets = Buffer.from(brut);
    extension = ".pdf";
    nature = "pdf";
  } else {
    const prete = await preparerPhotoEntrante(fichier, "bilan du comptable");
    if (!prete.ok) return { ok: false, raison: prete.raison };
    octets = Buffer.from(prete.photo.octets);
    extension = prete.photo.extension;
    nature = "photo";
  }
  const objet = await enregistrerObjet(`entreprises/${ctx.entrepriseId}/bilans`, octets, extension);
  const r = await ajouterBilan(ctx, {
    dossierId,
    fichierCle: objet.storageKey,
    fichierNom: fichier.name ? fichier.name.slice(0, 120) : null,
    nature,
    tailleOctets: objet.tailleOctets,
    empreinte: objet.checksum,
  });
  if (!r.ok) {
    await supprimerObjet(objet.storageKey);
    return r;
  }
  revalidatePath("/termines/comptable", "layout");
  return { ok: true };
}

export async function retirerBilanAction(id: string): Promise<Fait> {
  if (!UUID.test(id)) return { ok: false, raison: "Ce bilan n'existe pas." };
  const ctx = await contexte("retirer un bilan du comptable");
  const cle = await retirerBilan(ctx, id);
  if (!cle) return { ok: false, raison: "Ce bilan n'existe plus." };
  await supprimerObjet(cle);
  revalidatePath("/termines/comptable", "layout");
  return { ok: true };
}
