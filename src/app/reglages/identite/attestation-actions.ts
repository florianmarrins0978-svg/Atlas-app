"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { mettreAJourEntreprise } from "@/server/repositories/entreprises";
import { refusDeLAttestation } from "@/lib/attestation-decennale";
import { refusDuPdfDepose } from "@/server/pdf/attestation-deposee";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { logger } from "@/server/logger";

/**
 * DÉPOSER L'ATTESTATION DÉCENNALE — son choix A du 5 octobre 2026
 * (`appli/assurance-et-sous-traitance.html`) : jointe à tous les devis et
 * factures dès qu'elle est déposée (C. ass. L243-2).
 *
 * **Le fichier d'avant n'est PAS supprimé**, à l'inverse du logo : chaque devis
 * et chaque facture partis citent le leur, et une pièce relue plus tard doit
 * retrouver l'attestation du jour où elle est partie.
 *
 * Un PDF se vérifie (`refusDuPdfDepose`) ; une photo passe par la porte commune,
 * qui retire ses métadonnées : elle partira chez chaque client.
 */
export async function deposerAttestationAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "déposer l'attestation d'assurance");
  } catch {
    return { ok: false, raison: "Seul le patron peut déposer l'attestation." };
  }
  try {
    const fichier = formData.get("fichier");
    if (!(fichier instanceof File)) return { ok: false, raison: "Aucun fichier reçu." };
    const mime = fichier.type.split(";")[0].trim().toLowerCase();
    const refus = refusDeLAttestation(mime, fichier.size);
    if (refus) return { ok: false, raison: refus };

    const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
    if (!limite.autorise) return { ok: false, raison: limite.message };

    const dossier = `entreprises/${ctx.entrepriseId}/attestation-decennale`;
    let rangee: { cle: string; mime: string };
    if (mime === "application/pdf") {
      const octets = new Uint8Array(await fichier.arrayBuffer());
      const refusPdf = await refusDuPdfDepose(octets);
      if (refusPdf) return { ok: false, raison: refusPdf };
      const objet = await enregistrerObjet(dossier, Buffer.from(octets), ".pdf", mime);
      rangee = { cle: objet.storageKey, mime };
    } else {
      const prete = await preparerPhotoEntrante(fichier, "attestation décennale");
      if (!prete.ok) return { ok: false, raison: prete.raison };
      if (refusDeLAttestation(prete.photo.mimeType, prete.photo.octets.length)) {
        return { ok: false, raison: "Cette photo ne se joint pas à un devis. Prenez-la en JPEG ou en PNG." };
      }
      const objet = await enregistrerObjet(dossier, prete.photo.octets, prete.photo.extension, prete.photo.mimeType);
      rangee = { cle: objet.storageKey, mime: prete.photo.mimeType };
    }
    await mettreAJourEntreprise(ctx, { attestationDecennale: rangee });
    return { ok: true };
  } catch (err) {
    logger.error("Dépôt de l'attestation décennale impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "L'attestation n'a pas pu être enregistrée. Réessayez." };
  }
}

/** La retire des pièces SUIVANTES ; celles déjà parties gardent la leur. */
export async function retirerAttestationAction(): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "retirer l'attestation d'assurance");
  } catch {
    return { ok: false, raison: "Seul le patron peut retirer l'attestation." };
  }
  try {
    await mettreAJourEntreprise(ctx, { attestationDecennale: null });
    return { ok: true };
  } catch (err) {
    logger.error("Retrait de l'attestation décennale impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "L'attestation n'a pas pu être retirée. Réessayez." };
  }
}
