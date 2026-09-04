"use server";

import { exigerFacturation } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import {
  emettreFacture,
  majEcheanceFacture,
  reprendreLeDevisSurLaFacture,
  terminerChantier,
  FactureDejaEmiseError,
  FinChantierImpossibleError,
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
 * Reprend le dernier devis envoyé sur une facture encore en brouillon.
 *
 * **Le geste que le refus de l'écran désigne.** Une facture bâtie avant qu'un
 * devis soit corrigé garde les montants d'avant, et rien ne le disait : le
 * second arrêt se franchissait sur l'ancien prix. L'écran nomme désormais le
 * devis manquant ET porte ce bouton — un refus qui ne nomme pas son geste est
 * un cul-de-sac (`CLAUDE.md`, ce que « impeccable » veut dire, point 5).
 *
 * **Le refus se rend en valeur** (`AGENTS.md`) : le message d'une exception
 * d'action serveur n'atteint jamais le patron.
 */
export type ResultatReprise =
  | { succes: true; numeroDevis: string }
  | { succes: false; erreur: string };

export async function reprendreLeDevisAction(factureId: string): Promise<ResultatReprise> {
  const ctx = await getCurrentCtx();
  await exigerFacturation(ctx, "reprendre le devis sur la facture");
  try {
    const r = await reprendreLeDevisSurLaFacture(ctx, factureId);
    return r.ok ? { succes: true, numeroDevis: r.numeroDevis } : { succes: false, erreur: r.raison };
  } catch (err) {
    logger.error("Devis non repris sur la facture", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { succes: false, erreur: "Le devis n'a pas pu être repris. Réessayez dans un instant." };
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
