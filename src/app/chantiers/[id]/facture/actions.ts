"use server";

import { exigerFacturation } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import {
  ajouterTravailSupplementaire,
  emettreFacture,
  majEcheanceFacture,
  retirerTravailSupplementaire,
  terminerChantier,
  FactureDejaEmiseError,
  FinChantierImpossibleError,
  type TotauxFacture,
} from "@/server/repositories/factures";
import { logger } from "@/server/logger";
import {
  creerEnvoiFacture,
  dernierEnvoiFacture,
  corrigerCanalEnvoiFacture,
} from "@/server/repositories/envois-factures";

// Arrêt 3 du parcours (docs/AGENT.md §2.3) : le patron confirme le départ de
// la facture. Décidé, pas optionnel — un chantier finit rarement exactement
// comme il a été devisé, et une facture fausse se corrige par un avoir.

const MOTIFS: Record<FinChantierImpossibleError["motif"], string> = {
  devis_absent: "Ce chantier n'a pas de devis : il n'y a rien à facturer.",
  devis_non_envoye:
    "Le devis de ce chantier n'a jamais été envoyé. Facturer un prix que le client n'a pas vu n'a pas de sens.",
  deja_facture: "La facture de ce chantier est déjà émise.",
};

export type ResultatFinChantier =
  | { succes: true; factureId: string }
  | { succes: false; erreur: string };

export async function terminerChantierAction(chantierId: string): Promise<ResultatFinChantier> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "terminer le chantier et préparer la facture");
  try {
    const facture = await terminerChantier(ctx, chantierId);
    return { succes: true, factureId: facture.id };
  } catch (err) {
    if (err instanceof FinChantierImpossibleError) {
      return { succes: false, erreur: MOTIFS[err.motif] };
    }
    throw err;
  }
}

export type ResultatEmission = { succes: true; numero: string } | { succes: false; erreur: string };

/**
 * Fige la facture et la porte au relevé de TVA.
 *
 * Le relevé n'est pas écrit ici : il se calcule à partir des factures émises
 * (voir `releveTvaCollectee`). Émettre, c'est donc l'y inscrire — sans qu'une
 * seconde écriture puisse un jour diverger de la première.
 */
export async function emettreFactureAction(factureId: string): Promise<ResultatEmission> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "émettre la facture");
  try {
    const facture = await emettreFacture(ctx, factureId);
    return { succes: true, numero: facture.numeroCommercial };
  } catch (err) {
    if (err instanceof FactureDejaEmiseError) {
      return { succes: false, erreur: err.message };
    }
    throw err;
  }
}

/**
 * Corrige l'échéance de la facture avant qu'elle parte — sa demande du 25 août.
 *
 * **Le refus se rend en valeur** (`AGENTS.md`) : le message d'une exception
 * d'action serveur n'atteint jamais le patron. Le contrôle vit dans le dépôt
 * (`majEcheanceFacture`, `validerEcheance`), pas ici.
 */
export type ResultatEcheanceFacture =
  | { succes: true; dateEcheance: string }
  | { succes: false; erreur: string };

export async function majEcheanceFactureAction(
  factureId: string,
  dateEcheance: string
): Promise<ResultatEcheanceFacture> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "changer l'échéance de la facture");
  try {
    const r = await majEcheanceFacture(ctx, factureId, dateEcheance);
    return r.ok ? { succes: true, dateEcheance: r.dateEcheance } : { succes: false, erreur: r.raison };
  } catch (err) {
    logger.error("Échéance de facture non modifiée", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { succes: false, erreur: "L'échéance n'a pas pu être modifiée. Réessayez dans un instant." };
  }
}

/**
 * Prépare le lien de la facture, que le patron collera lui-même dans son SMS
 * ou son e-mail.
 *
 * Aucun prestataire n'envoie à sa place (`docs/A-FAIRE.md` §5) : Atlas prépare,
 * le patron expédie. Cette action est donc le seul « départ » réel de la
 * facture — c'est elle, et non l'arrêt comptable, qui pose le jalon
 * `facture_envoyee_at`.
 */
export type ResultatLienFacture = { succes: true; jeton: string } | { succes: false; erreur: string };

export async function preparerLienFactureAction(
  factureId: string,
  canal: "sms" | "email"
): Promise<ResultatLienFacture> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "préparer le lien de la facture");
  try {
    const existant = await dernierEnvoiFacture(ctx, factureId);
    // Un second appui ne fabrique pas un second lien : le client aurait alors
    // deux adresses pour la même facture, et l'artisan ne saurait plus laquelle
    // il a envoyée.
    if (existant && existant.expireAt.getTime() > Date.now()) {
      // En revanche, le CANAL peut avoir changé depuis : le patron bascule de
      // SMS vers e-mail après avoir préparé le lien. Le jeton reste le même,
      // seul le registre se met d'accord avec ce qui va réellement partir.
      if (existant.canal !== canal) await corrigerCanalEnvoiFacture(ctx, existant.id, canal);
      return { succes: true, jeton: existant.jeton };
    }
    const envoi = await creerEnvoiFacture(ctx, factureId, canal);
    return { succes: true, jeton: envoi.jeton };
  } catch (e) {
    return { succes: false, erreur: e instanceof Error ? e.message : "Le lien n'a pas pu être préparé." };
  }
}

/**
 * LES TRAVAUX EN PLUS, AJOUTÉS AVANT L'ENVOI — son idée du 31 août 2026.
 *
 * *« Depuis cette page, avant d'envoyer la facture, il faut pouvoir la modifier
 * en stipulant que c'est du TS, et comme ça on a déjà toute la chaîne de
 * production de créée pour l'envoyer au client. »*
 *
 * **Le refus se rend en valeur, jamais en exception** (`AGENTS.md`) : le message
 * d'une exception d'action serveur n'atteint jamais le patron — Next.js le
 * remplace par un identifiant opaque. Toutes les décisions vivent dans le dépôt,
 * qui les rend en `{ ok, raison }` ; cette couche ne fait que porter la réponse.
 */
export type ResultatTravailSupplementaire =
  | { succes: true; totaux: TotauxFacture }
  | { succes: false; erreur: string };

export async function ajouterTravailSupplementaireAction(
  factureId: string,
  saisie: { libelle: string; quantite: string; unite: string | null; prixUnitaire: string; tauxTva: string }
): Promise<ResultatTravailSupplementaire> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "ajouter des travaux supplémentaires à la facture");
  try {
    const r = await ajouterTravailSupplementaire(ctx, factureId, saisie);
    return r.ok ? { succes: true, totaux: r.totaux } : { succes: false, erreur: r.raison };
  } catch (err) {
    // Journalisé AVANT de rendre une phrase générique : sans cette ligne, le
    // défaut serait muet des deux côtés (`AGENTS.md`, piège 0 ter).
    logger.error("Travail supplémentaire non ajouté", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { succes: false, erreur: "La ligne n'a pas pu être ajoutée. Réessayez dans un instant." };
  }
}

export async function retirerTravailSupplementaireAction(
  ligneId: string
): Promise<ResultatTravailSupplementaire> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "retirer des travaux supplémentaires de la facture");
  try {
    const r = await retirerTravailSupplementaire(ctx, ligneId);
    return r.ok ? { succes: true, totaux: r.totaux } : { succes: false, erreur: r.raison };
  } catch (err) {
    logger.error("Travail supplémentaire non retiré", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { succes: false, erreur: "La ligne n'a pas pu être retirée. Réessayez dans un instant." };
  }
}
