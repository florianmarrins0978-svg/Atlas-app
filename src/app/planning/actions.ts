"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import {
  planifierChantier,
  deplanifierChantier,
  deplacerChantier,
  supprimerChantier,
  SuppressionChantierRefusee,
  basculerEquipeDuChantier,
} from "@/server/repositories/chantiers";
import type { Moment } from "@/server/disponibilites";
import type { QuandChantier } from "@/lib/planning-jour";
import { porterChantierDansAgenda } from "@/server/repositories/agenda-apple";
import { tachesDuChantier, type FeuilleDuChantier } from "@/server/repositories/devis";

// **AUCUN `export type { … }` ICI, ni nulle part dans un fichier « use server ».**
// Le chargeur d'actions de Next réécrit ce module en une liste d'exports de
// VALEURS : un export de type y survit sous forme de référence à un nom que
// TypeScript a effacé, et le module entier meurt à l'évaluation sur un
// « ReferenceError: FeuilleDuChantier is not defined ». Toutes les actions de
// l'écran répondent alors 500 — pendant que `tsc` et le lint restent verts,
// puisque le code source, lui, est juste. Payé le 21 août 2026.
// L'écran prend ce type là où il est défini (`import type` s'efface à la
// compilation, et c'est déjà la convention du dépôt).

/**
 * Ce que le chantier PORTE après le geste — jamais ce que l'écran a supposé.
 *
 * **La durée ne se devine pas côté écran** : elle vient de la dictée
 * (« 3 jours » → six demi-journées), et le serveur la relit à chaque pose. Un
 * écran qui écrirait « une demi-journée » parce qu'on a touché « Matin »
 * mentirait jusqu'au prochain rechargement — sur un chantier de trois jours,
 * c'est deux jours de travail qui disparaîtraient de l'affichage.
 */
export type EtatPose = {
  datePlanifiee: string | null;
  creneauDebut: string | null;
  dureeDemiJournees: number | null;
};

export type ResultatPose =
  | { succes: true; etat: EtatPose }
  | { succes: false; erreur: string };

/**
 * Poser un chantier : la date et la demi-journée.
 *
 * **L'équipe ne se choisit plus ICI, et c'est sa demande du 21 août 2026 :**
 * *« le "+ Ajouter un chantier" [...] d'abord QUI, ensuite QUAND »* — puis
 * l'équipe, sur la ligne de la demi-journée, où le matin et l'après-midi sont
 * indépendants (`basculerEquipeAction`). Tout demander d'un coup obligeait à
 * revenir en arrière dès qu'on se trompait de client.
 *
 * **Et le créneau n'est plus refusé.** Sa décision du même jour : *« il ne doit
 * pas y avoir de limite d'ajout de chantier par jour »*. Le dépassement se voit
 * — bordeaux sur le calendrier, « 150 % de vos équipes » sur la fiche du jour —
 * il ne s'interdit pas.
 *
 * Rend `{ succes: false, erreur }` plutôt que de laisser remonter une
 * exception : le message d'une exception levée par une action serveur n'arrive
 * jamais jusqu'au patron (`AGENTS.md`).
 */
export async function planifierChantierAction(
  chantierId: string,
  datePlanifiee: string,
  choix?: { quand: QuandChantier }
): Promise<ResultatPose> {
  const ctx = await getCurrentCtx();
  const row = await planifierChantier(ctx, chantierId, datePlanifiee, choix);
  // **APRÈS la transaction, jamais dedans.** Tenir une transaction PostgreSQL
  // ouverte le temps d'un appel à Apple immobiliserait une connexion du pool
  // pour la durée d'un service qu'on ne maîtrise pas. Et cette fonction ne
  // jette pas : une panne d'Apple ne doit pas faire perdre au patron le geste
  // qu'il vient de faire — elle s'inscrit dans l'écran des réglages.
  await porterChantierDansAgenda(ctx, chantierId);
  return {
    succes: true,
    etat: {
      datePlanifiee: row?.datePlanifiee ?? null,
      creneauDebut: row?.creneauDebut ?? null,
      dureeDemiJournees: row?.dureeDemiJournees ?? null,
    },
  };
}

/**
 * Coche ou décoche une équipe sur UNE demi-journée d'un chantier.
 *
 * *Sa demande du 21 août 2026 : « je dois pouvoir mettre toutes les équipes si
 * je le souhaite, sur la même demi-journée », et « Paul le matin, Julien et
 * Paul l'après-midi : il faut que tout soit indépendant ».*
 *
 * **Rien n'est refusé** — voir `basculerEquipeDuChantier`. Rend l'état COMPLET
 * des deux demi-journées, et non un simple succès : l'écran repeint sa pastille
 * avec ce que la base dit, jamais avec ce qu'il a supposé. Deux appuis rapides
 * sur la même pastille se croiseraient sinon, et le dernier arrivé gagnerait.
 */
export async function basculerEquipeAction(
  chantierId: string,
  demi: Moment,
  rangEquipe: number
): Promise<{ matin: number[]; apres_midi: number[] } | null> {
  const ctx = await getCurrentCtx();
  const etat = await basculerEquipeDuChantier(ctx, chantierId, demi, rangEquipe);
  // L'agenda extérieur porte le nom de l'équipe dans l'intitulé : sans ce
  // report, son téléphone garderait l'ancienne.
  if (etat) await porterChantierDansAgenda(ctx, chantierId);
  return etat;
}

/**
 * Déplace un chantier posé : matin, après-midi, ou la journée.
 *
 * Le jour ne bouge pas — « Déplacer » vit dans la fiche d'UN jour, et c'est ce
 * que l'écran promet.
 */
export async function deplacerChantierAction(
  chantierId: string,
  quand: QuandChantier
): Promise<ResultatPose> {
  const ctx = await getCurrentCtx();
  const row = await deplacerChantier(ctx, chantierId, quand);
  if (!row) return { succes: false, erreur: "Ce chantier n'est pas posé sur un jour." };
  await porterChantierDansAgenda(ctx, chantierId);
  return {
    succes: true,
    etat: {
      datePlanifiee: row.datePlanifiee ?? null,
      creneauDebut: row.creneauDebut ?? null,
      dureeDemiJournees: row.dureeDemiJournees ?? null,
    },
  };
}

export async function deplanifierChantierAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  const resultat = await deplanifierChantier(ctx, chantierId);
  // Le pendant obligatoire de l'écriture : sans ce retrait, un chantier
  // déplanifié resterait dans son téléphone pour toujours — et il se fierait à
  // un agenda qui ment.
  await porterChantierDansAgenda(ctx, chantierId);
  return resultat;
}

/**
 * Retire un chantier du planning et de toutes les listes.
 *
 * Demandé le 6 août 2026 : « je veux pouvoir supprimer un chantier mis au
 * planning ». Suppression douce et refusée dès qu'une facture est émise — la
 * règle et son pourquoi vivent dans le dépôt (`supprimerChantier`), pas ici.
 */
export type ResultatSuppression = { succes: true } | { succes: false; erreur: string };

export async function supprimerChantierAction(chantierId: string): Promise<ResultatSuppression> {
  const ctx = await getCurrentCtx();
  try {
    await supprimerChantier(ctx, chantierId);
    // Supprimé ici, donc supprimé là-bas. `porterChantierDansAgenda` ne trouve
    // plus le chantier et retire ce qu'Atlas avait posé.
    await porterChantierDansAgenda(ctx, chantierId);
    return { succes: true };
  } catch (e) {
    if (e instanceof SuppressionChantierRefusee) {
      return {
        succes: false,
        erreur:
          e.motif === "facture_emise"
            ? "Ce chantier est facturé : sa facture figure au relevé de TVA et ne peut pas disparaître. Une correction passe par un avoir."
            : "Ce chantier n'existe plus.",
      };
    }
    return { succes: false, erreur: "Le chantier n'a pas pu être supprimé." };
  }
}

/**
 * Ce qu'il y a à faire sur ce chantier — la feuille, sans un prix.
 *
 * **Une action et non un chargement de page** : la plupart des journées ne
 * s'ouvrent sur aucune feuille, et charger les lignes de tous les chantiers
 * planifiés ferait payer à chaque ouverture du planning ce qui ne sert qu'à un
 * appui.
 *
 * Rend une liste vide plutôt que de lever : un chantier sans devis n'est pas
 * une panne, et la feuille le dit en toutes lettres — **et n'offre alors pas le
 * bouton du PDF**, qui répondrait 404.
 */
export async function tachesDuChantierAction(chantierId: string): Promise<FeuilleDuChantier> {
  const ctx = await getCurrentCtx();
  return tachesDuChantier(ctx, chantierId);
}
