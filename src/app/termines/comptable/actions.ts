"use server";

import { revalidatePath } from "next/cache";
import { ecartDeMontant, estMotif } from "@/lib/pour-mon-comptable";
import { enEuros } from "@/lib/euros";
import { montantSaisi } from "@/lib/achat-tva";
import { enCentimes, montantANoter } from "@/lib/rapprochement-bancaire";
import { ajouterBilan, dossierEnCours, retirerBilan } from "@/server/repositories/dossiers-comptables";
import { arreterLeDossier } from "@/server/dossier-comptable";
import { creerLienComptable } from "@/server/repositories/verification-comptable";
import { enregistrerObjet, supprimerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { refusDuPdfDepose } from "@/server/pdf/attestation-deposee";
import { refusDuDocumentVehicule } from "@/lib/vehicules";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerFacturation } from "@/server/garde-action";
import { lireLaBanque } from "@/server/banque/lecture";
import { facturesARapprocher } from "@/server/banque/questions";
import { confirmerLaLigneRecue } from "@/server/repositories/banque";
import { lireFactureHorsAtlas } from "@/server/ai/services/lire-facture-hors-atlas";
import { logger } from "@/server/logger";
import {
  appliquerCheckUp,
  delier,
  joindreFactureHorsAtlas,
  joindreFactureRecue,
  ligneDeposable,
  ligneRecue,
  marquerTicketPerdu,
  pieceDejaJointe,
  poserMotif,
  relierTicket,
  type Fait,
  type Refus,
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
const ADRESSE_INVALIDE: Refus = { ok: false, raison: "Cette ligne n'existe pas." };

async function contexte(action: string) {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, action);
  return ctx;
}

/**
 * Après un geste réussi : l'écran se relit, et le fichier d'une facture faite
 * hors d'Atlas que la nouvelle justification remplace quitte le stockage. La
 * base d'abord, le fichier ensuite : un effacement qui échoue laisse au pire
 * un fichier orphelin, jamais une ligne qui montre une pièce disparue.
 */
async function apres(r: Fait): Promise<Fait> {
  if (!r.ok) return r;
  if (r.pieceRetiree) await supprimerObjet(r.pieceRetiree).catch((err) => logger.warn("Une facture hors d'Atlas remplacée n'a pas pu être effacée", { erreur: err instanceof Error ? err.message : String(err) }));
  revalidatePath("/termines/comptable", "layout");
  return { ok: true };
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

/**
 * `malgreEcart` : il a vu les deux montants, et joint quand même (un acompte,
 * deux factures pour un virement). Sans lui, une pièce qui ne tombe pas juste
 * revient en refus, avec l'écart à montrer (sa remarque du 25 octobre 2026).
 */
export async function relierTicketAction(mouvementId: string, achatId: string, malgreEcart = false): Promise<Fait> {
  if (!UUID.test(mouvementId) || !UUID.test(achatId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("relier un ticket à une ligne du relevé");
  return apres(await relierTicket(ctx, mouvementId, achatId, "patron", malgreEcart === true));
}

export async function ticketPerduAction(mouvementId: string): Promise<Fait> {
  if (!UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("valider une ligne sans ticket");
  return apres(await marquerTicketPerdu(ctx, mouvementId));
}

/** La réponse se vérifie contre le sens de la ligne, dans le dépôt (`poserMotif`). */
export async function motifAction(mouvementId: string, motif: string): Promise<Fait> {
  if (!UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  if (!estMotif(motif, "sortie") && !estMotif(motif, "entree")) return { ok: false, raison: "Dites ce qu'est ce virement." };
  const ctx = await contexte("dire ce qu'est un virement");
  return apres(await poserMotif(ctx, mouvementId, motif));
}

export async function joindreFactureAction(mouvementId: string, factureRecueId: string, malgreEcart = false): Promise<Fait> {
  if (!UUID.test(mouvementId) || !UUID.test(factureRecueId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("joindre une facture à un virement");
  return apres(await joindreFactureRecue(ctx, mouvementId, factureRecueId, malgreEcart === true));
}

export async function delierAction(mouvementId: string): Promise<Fait> {
  if (!UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("défaire la justification d'une ligne");
  return apres(await delier(ctx, mouvementId));
}

// ─── Un virement reçu se règle dans sa carte (25 octobre 2026) ───────────────

export type ResultatEntree = { ok: true; fait: string } | Refus;

/**
 * « C'est cette facture » : un virement reçu paie une facture d'Atlas en
 * attente. Les droits sont ceux de « J'ai reçu le paiement » : c'est le même
 * règlement, noté dans la même transaction que la réponse
 * (`confirmerLaLigneRecue`).
 *
 * **Le montant noté se recalcule ici**, contre les factures du moment, avec la
 * règle de l'accueil (`montantANoter`) : jamais plus que ce qui reste dû.
 */
export async function confirmerEntreeAction(mouvementId: string, factureId: string, malgreEcart = false): Promise<ResultatEntree> {
  if (!UUID.test(mouvementId) || !UUID.test(factureId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("noter un paiement reçu par virement");
  const [ligne, factures] = await Promise.all([ligneRecue(ctx, mouvementId), facturesARapprocher(ctx)]);
  if (!ligne) return ADRESSE_INVALIDE;
  if (ligne.justifiee) return { ok: false, raison: "Cette ligne est déjà justifiée." };
  const facture = factures.find((f) => f.id === factureId);
  if (!facture) return { ok: false, raison: "Cette facture n'attend plus de paiement." };

  const e = ecartDeMontant(ligne.montant, facture.reste);
  if (e.genre === "ecart" && !malgreEcart) return { ok: false, raison: "Pas le même montant.", ecart: { ligne: e.ligne, piece: e.piece } };
  const centimes = montantANoter({ montant: ligne.montant }, facture);
  const reste = enCentimes(facture.reste);
  if (centimes === null || reste === null) return { ok: false, raison: "Ce montant est illisible." };

  const r = await confirmerLaLigneRecue(ctx, mouvementId, factureId, (centimes / 100).toFixed(2));
  if (!r.ok) return r;
  revalidatePath("/", "layout");
  return {
    ok: true,
    fait:
      centimes < reste
        ? `${enEuros(centimes / 100)} notés sur la facture ${facture.numero}. Il reste ${enEuros((reste - centimes) / 100)} à recevoir.`
        : `${enEuros(centimes / 100)} notés sur la facture ${facture.numero}, elle est payée.`,
  };
}

export type PieceDeposee = { cle: string; nature: "photo" | "pdf"; total: string | null };
export type ResultatDepot = { ok: true; fait: string } | (Refus & { piece?: PieceDeposee });

const PREFIXE_HORS_ATLAS = (entrepriseId: string) => `entreprises/${entrepriseId}/factures-hors-atlas/`;

/**
 * « Une facture faite hors d'Atlas » : la photo ou le PDF se range, son total
 * se LIT (comme un ticket), et se compare au virement. Juste, la facture est
 * jointe tout de suite ; sinon l'écran montre l'écart, ou demande le total
 * qu'il n'a pas su lire, et `joindreFactureHorsAtlasAction` finit le geste.
 *
 * **Le fichier est rangé AVANT la lecture**, et le reste quoi qu'elle donne :
 * une IA absente ou qui se trompe ne lui fait jamais perdre sa pièce.
 */
export async function deposerFactureHorsAtlasAction(formData: FormData): Promise<ResultatDepot> {
  const mouvementId = formData.get("mouvementId");
  const fichier = formData.get("fichier");
  if (typeof mouvementId !== "string" || !UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  if (!(fichier instanceof File)) return { ok: false, raison: "Aucun fichier reçu." };
  const ctx = await contexte("joindre une facture faite hors d'Atlas");
  const ligne = await ligneDeposable(ctx, mouvementId);
  if (!ligne) return ADRESSE_INVALIDE;
  if (ligne.justifiee) return { ok: false, raison: "Cette ligne est déjà justifiée." };

  const mime = fichier.type.split(";")[0].trim().toLowerCase();
  const refus = refusDuDocumentVehicule(mime, fichier.size);
  if (refus) return { ok: false, raison: refus };
  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) return { ok: false, raison: limite.message };

  let octets: Buffer;
  let extension: string;
  let mimeRange: string;
  let nature: "photo" | "pdf";
  if (mime === "application/pdf") {
    const brut = new Uint8Array(await fichier.arrayBuffer());
    const refusPdf = await refusDuPdfDepose(brut, null);
    if (refusPdf) return { ok: false, raison: refusPdf };
    octets = Buffer.from(brut);
    extension = ".pdf";
    mimeRange = mime;
    nature = "pdf";
  } else {
    // La porte commune des photos : signature vérifiée, position GPS retirée.
    const prete = await preparerPhotoEntrante(fichier, "facture faite hors d'Atlas");
    if (!prete.ok) return { ok: false, raison: prete.raison };
    octets = Buffer.from(prete.photo.octets);
    extension = prete.photo.extension;
    mimeRange = prete.photo.mimeType;
    nature = "photo";
  }
  const objet = await enregistrerObjet(PREFIXE_HORS_ATLAS(ctx.entrepriseId).slice(0, -1), octets, extension, mimeRange);

  let total: string | null = null;
  try {
    total = (await lireFactureHorsAtlas(octets.toString("base64"), mimeRange))?.totalTtc ?? null;
  } catch (err) {
    // On journalise avant de se taire : la lecture échouera chez lui, pas ici.
    logger.warn("Lecture d'une facture faite hors d'Atlas impossible", { erreur: err instanceof Error ? err.message : String(err) });
  }
  const piece: PieceDeposee = { cle: objet.storageKey, nature, total };
  if (total === null) return { ok: false, raison: "Le total ne se lit pas. Tapez-le.", piece };
  const r = await joindreFactureHorsAtlas(ctx, mouvementId, piece);
  if (!r.ok) return { ...r, piece };
  await apres(r);
  return { ok: true, fait: "Facture jointe, le montant tombe juste." };
}

/**
 * La fin du geste : le total tapé quand il ne se lisait pas, ou « elle paie une
 * partie » devant l'écart. **La clé rendue par le dépôt se revérifie** : elle
 * doit porter l'entreprise, comme celle d'un ticket (`ajouterAchatAction`).
 */
export async function joindreFactureHorsAtlasAction(
  mouvementId: string,
  piece: PieceDeposee,
  malgreEcart = false
): Promise<ResultatDepot> {
  if (!UUID.test(mouvementId)) return ADRESSE_INVALIDE;
  const ctx = await contexte("joindre une facture faite hors d'Atlas");
  if (typeof piece?.cle !== "string" || !piece.cle.startsWith(PREFIXE_HORS_ATLAS(ctx.entrepriseId)) || piece.cle.includes("..")) {
    return { ok: false, raison: "Cette facture n'est pas reconnue." };
  }
  if (piece.nature !== "photo" && piece.nature !== "pdf") return { ok: false, raison: "Cette facture n'est pas reconnue." };
  const total = piece.total === null ? null : montantSaisi(String(piece.total));
  if (total === null || total <= 0) return { ok: false, raison: "Tapez le total de la facture.", piece };
  const propre: PieceDeposee = { cle: piece.cle, nature: piece.nature, total: total.toFixed(2) };
  const r = await joindreFactureHorsAtlas(ctx, mouvementId, propre, malgreEcart === true);
  if (!r.ok) return { ...r, piece: propre };
  await apres(r);
  return { ok: true, fait: malgreEcart ? "Facture jointe, payée en partie." : "Facture jointe, le montant tombe juste." };
}

/** « Reprendre la photo », « Annuler » : la facture déposée et jamais jointe quitte le stockage. */
export async function abandonnerFactureHorsAtlasAction(cle: string): Promise<Fait> {
  const ctx = await contexte("joindre une facture faite hors d'Atlas");
  if (typeof cle !== "string" || !cle.startsWith(PREFIXE_HORS_ATLAS(ctx.entrepriseId)) || cle.includes("..")) return { ok: false, raison: "Cette facture n'est pas reconnue." };
  // Jointe à une ligne, elle se garde : seule la ligne la rend (`apres`).
  if (await pieceDejaJointe(ctx, cle)) return { ok: true };
  await supprimerObjet(cle).catch((err) => logger.warn("Une facture hors d'Atlas abandonnée n'a pas pu être effacée", { erreur: err instanceof Error ? err.message : String(err) }));
  return { ok: true };
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
    // Sans plafond de pages : un bilan en compte vingt à soixante.
    const refusPdf = await refusDuPdfDepose(brut, null);
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

/**
 * « Envoyer au comptable » (lot 4) : un lien privé vers sa page de
 * vérification. Le jeton n'est rendu qu'ici, la base n'en garde que
 * l'empreinte : chaque appui fait un lien neuf.
 */
export async function envoyerAuComptableAction(dossierId: string): Promise<{ ok: true; chemin: string } | { ok: false; raison: string }> {
  if (!UUID.test(dossierId)) return { ok: false, raison: "Ce dossier n'existe pas." };
  const ctx = await contexte("envoyer un dossier au comptable");
  const r = await creerLienComptable(ctx, dossierId, new Date());
  if (!r.ok) return r;
  revalidatePath("/termines/comptable/dossiers");
  return { ok: true, chemin: `/comptable/${r.jeton}` };
}
