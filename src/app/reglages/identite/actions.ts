"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { exigerPreuveRecente, PreuveRecenteExigeeError } from "@/server/preuve-recente";
import { GESTES_SENSIBLES } from "@/lib/preuve-recente";
import { coordonneesBancairesChangent } from "@/server/repositories/entreprises";
import { mettreAJourEntreprise } from "@/server/repositories/entreprises";
import { refusDeLAttestation } from "@/lib/attestation-decennale";
import { refusDuPdfDepose } from "@/server/pdf/attestation-deposee";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { logger } from "@/server/logger";

/**
 * L'identité de l'entreprise, écrite depuis les réglages.
 *
 * **Le manque que ça comble, et il était bloquant.** Jusqu'au 13 août 2026,
 * l'identité ne se saisissait QUE depuis « le devis écrit à la main »
 * (`chantiers/[id]/devis-complet/`) — donc au milieu de la rédaction d'un devis.
 * Un artisan qui suivait le parcours normal — dicter, chiffrer, envoyer — n'avait
 * jamais l'occasion de saisir son SIRET, et **son premier devis partait sans
 * SIRET, sans adresse et sans IBAN, sans un mot** (`ARCHITECTURE.md` §87).
 *
 * **Réservé au propriétaire.** Ces champs identifient l'entreprise et portent
 * ses coordonnées bancaires : un salarié ou un commercial n'a rien à y faire
 * (`docs/QUESTIONS.md` §10).
 *
 * **Le retour est une valeur, jamais une exception.** Le message d'une erreur
 * levée par une action serveur n'arrive jamais jusqu'au patron — Next.js le
 * remplace en production par un identifiant opaque, et son banc sert une version
 * bâtie (`HANDOVER.md`, piège 0 ter). Un refus attendu se rend donc en valeur.
 */
export type ResultatIdentite =
  | { ok: true }
  /**
   * `preuveExigee` dit à l'écran d'OUVRIR la demande de mot de passe, au lieu
   * d'afficher un refus sec devant lequel le patron n'a rien à faire. Ce n'est
   * pas une autorisation : le serveur a déjà refusé, et il refusera encore tant
   * qu'aucune preuve ne sera posée.
   */
  | { ok: false; raison: string; preuveExigee?: boolean };

export async function majIdentiteAction(data: {
  nom?: string;
  formeJuridique?: string;
  adresse?: string;
  siret?: string;
  telephone?: string;
  email?: string;
  iban?: string;
  titulaireCompte?: string;
  numeroTva?: string;
  regimeTva?: "assujettie" | "franchise";
  /** Migration 0071 — voir `src/lib/mentions-legales.ts`. */
  capitalSocial?: string;
  villeRcs?: string;
  mentionsLegalesPosition?: "sous_nom" | "bas";
  /** Migration 0094 — voir `src/lib/mentions-obligatoires.ts`. */
  assureurDecennale?: string;
  /** Migration 0121 : ses coordonnées (loi 96-603, art. 22-2). */
  adresseAssureurDecennale?: string;
  contratDecennale?: string;
  couvertureDecennale?: string;
  mediateurNom?: string;
  mediateurCoordonnees?: string;
}): Promise<ResultatIdentite> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "modifier l'identité de l'entreprise");
  } catch {
    return { ok: false, raison: "Seul le patron peut modifier ces informations." };
  }

  // Le nom est le seul champ qui ne peut pas être vidé : il porte l'en-tête de
  // chaque document, et une pièce sans émetteur n'est pas une pièce.
  if (data.nom !== undefined && data.nom.trim() === "") {
    return { ok: false, raison: "Le nom de l'entreprise ne peut pas être vide." };
  }

  /**
   * **UNE PREUVE RÉCENTE — mais SEULEMENT pour les coordonnées bancaires.**
   *
   * C'est là que l'argent des clients arrive : changer l'IBAN sans bruit détourne
   * un virement, et le patron ne s'en aperçoit qu'à la fin du mois. Ce champ-là
   * mérite qu'on redemande qui vous êtes.
   *
   * **Le reste de cet écran ne le mérite pas**, et l'exiger partout serait une
   * mauvaise protection : corriger un numéro de téléphone n'engage rien, et
   * réclamer un mot de passe pour cela apprend à le taper sans lire — ce qui
   * affaiblit la garde le jour où elle compte vraiment.
   *
   * Comparé à ce qui est EN BASE, jamais à ce que l'écran renvoie : réenvoyer le
   * même IBAN ne demande rien, le changer demande la preuve.
   */
  const toucheAuBancaire =
    (data.iban !== undefined || data.titulaireCompte !== undefined) &&
    (await coordonneesBancairesChangent(ctx, data));
  if (toucheAuBancaire) {
    try {
      await exigerPreuveRecente(ctx, GESTES_SENSIBLES.coordonneesBancaires);
    } catch (erreur) {
      if (erreur instanceof PreuveRecenteExigeeError) {
        return { ok: false, raison: erreur.message, preuveExigee: true };
      }
      throw erreur;
    }
  }

  try {
    await mettreAJourEntreprise(ctx, data);
    return { ok: true };
  } catch (erreur) {
    // Journalisé AVANT de rendre : sans cela le défaut serait muet, et c'est le
    // piège que `AGENTS.md` nomme — « devant un défaut muet, la première
    // livraison n'est pas un correctif, c'est de rendre le défaut bavard ».
    console.error("[reglages/identite] écriture refusée", erreur);
    return { ok: false, raison: "L'enregistrement n'a pas abouti. Réessayez." };
  }
}

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
