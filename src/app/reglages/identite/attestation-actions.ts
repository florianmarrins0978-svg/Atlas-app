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
import { lireAttestation } from "@/server/ai/services/lire-attestation";
import { remarquesSurLAttestation, type AttestationLue } from "@/lib/attestation-lue";
import { jourIso } from "@/lib/jour";
import { getEntreprise } from "@/server/repositories/entreprises";

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
): Promise<{ ok: true; remarques: string[] } | { ok: false; raison: string }> {
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
    let lus: Buffer;
    if (mime === "application/pdf") {
      const octets = new Uint8Array(await fichier.arrayBuffer());
      const refusPdf = await refusDuPdfDepose(octets);
      if (refusPdf) return { ok: false, raison: refusPdf };
      lus = Buffer.from(octets);
      const objet = await enregistrerObjet(dossier, lus, ".pdf", mime);
      rangee = { cle: objet.storageKey, mime };
    } else {
      const prete = await preparerPhotoEntrante(fichier, "attestation décennale");
      if (!prete.ok) return { ok: false, raison: prete.raison };
      if (refusDeLAttestation(prete.photo.mimeType, prete.photo.octets.length)) {
        return { ok: false, raison: "Cette photo ne se joint pas à un devis. Prenez-la en JPEG ou en PNG." };
      }
      const objet = await enregistrerObjet(dossier, prete.photo.octets, prete.photo.extension, prete.photo.mimeType);
      lus = Buffer.from(prete.photo.octets);
      rangee = { cle: objet.storageKey, mime: prete.photo.mimeType };
    }
    // **La lecture ne fait jamais échouer le dépôt** (sa règle du 7 octobre
    // 2026, « jamais de blocage ») : sans elle, l'attestation est rangée comme
    // avant, simplement sans remarque.
    let lue: AttestationLue | null = null;
    try {
      lue = await lireAttestation(lus.toString("base64"), rangee.mime);
    } catch (err) {
      logger.error("Lecture de l'attestation décennale impossible", {
        erreur: err instanceof Error ? err.message : String(err),
      });
    }
    await mettreAJourEntreprise(ctx, { attestationDecennale: { ...rangee, lue } });
    const entreprise = await getEntreprise(ctx);
    const remarques = remarquesSurLAttestation(lue, entreprise?.assureurDecennale, jourIso(new Date()));
    return { ok: true, remarques: remarques.map((r) => r.libelle) };
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
