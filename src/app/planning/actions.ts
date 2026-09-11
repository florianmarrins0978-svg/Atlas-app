"use server";

import { exigerChantierDansSaPortee, exigerEcritureSurLePlanning } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import {
  creerChantier,
  listerChantiersPourPlanning,
  planifierChantier,
  deplanifierChantier,
  ecrireNoteChantier,
  supprimerChantier,
  SuppressionChantierRefusee,
  basculerEquipeDuChantier,
  libererDemiJournee,
  reposerDemiJournee,
  creneauxDunChantier,
} from "@/server/repositories/chantiers";
import type { JourIso, Moment } from "@/lib/disponibilites";
// (le départ se dit avec le vocabulaire de la base : `Moment`)
import { porterChantierDansAgenda } from "@/server/repositories/agenda-apple";
import { tachesDuChantier, type FeuilleDuChantier } from "@/server/repositories/devis";
import { retourDuChantier } from "@/server/repositories/retours-intervention";
import { listerPhotos } from "@/server/repositories/photos";
import { listerClients, trouverOuCreerClient } from "@/server/repositories/clients";
import { filtrerClientsParNom } from "@/lib/recherche-client";
import { nomDuChantier } from "@/lib/nom-chantier";

/**
 * LES ACTIONS DU PLANNING.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **UN SALARIÉ CONSULTE, IL N'ÉCRIT PAS** — décision du patron, 30 août 2026 :
 * *« Un salarié peut uniquement CONSULTER son planning. Il ne doit pouvoir
 * effectuer AUCUNE modification depuis le planning. »*
 *
 * Chaque action qui écrit ouvre donc sur `exigerEcritureSurLePlanning`, et
 * **avant** la portée : le refus doit tomber sans qu'aucune requête n'aille
 * chercher l'équipe de la personne (`src/server/garde-action.ts`).
 *
 * `tachesDuChantierAction` en est la seule dispensée : elle LIT la feuille sans
 * montants, qui est le document du salarié.
 *
 * **La garde ne remplace pas la portée, elle s'y ajoute.** Le périmètre de
 * lecture — tous les chantiers, ou ceux de son équipe — n'a pas bougé, et le
 * patron a demandé qu'il ne bouge pas.
 */

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
  choix?: { demi: Moment }
): Promise<ResultatPose> {
  const ctx = await getCurrentCtx();
  await exigerEcritureSurLePlanning(ctx, "poser ce chantier au planning");
  await exigerChantierDansSaPortee(ctx, chantierId, "poser ce chantier au planning");
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
  await exigerEcritureSurLePlanning(ctx, "cocher une équipe sur ce chantier");
  await exigerChantierDansSaPortee(ctx, chantierId, "cocher une équipe sur ce chantier");
  const etat = await basculerEquipeDuChantier(ctx, chantierId, demi, rangEquipe);
  // L'agenda extérieur porte le nom de l'équipe dans l'intitulé : sans ce
  // report, son téléphone garderait l'ancienne.
  if (etat) await porterChantierDansAgenda(ctx, chantierId);
  return etat;
}

/** Ce qu'un chantier occupe après le geste — l'écran repeint avec ça. */
export type ResultatCreneaux =
  | { succes: true; creneaux: { jour: string; moment: Moment }[] }
  | { succes: false; erreur: string };

async function creneauxApres(ctx: Awaited<ReturnType<typeof getCurrentCtx>>, chantierId: string) {
  const poses = await creneauxDunChantier(ctx, chantierId);
  return poses.map((c) => ({ jour: c.jour, moment: c.moment }));
}

/**
 * LIBÉRER UNE DEMI-JOURNÉE — sa demande du 10 septembre 2026.
 *
 * *« Je clique sur le matin, il devient vert et le matin du vendredi devient
 * libre, et une demi-journée de Mr Julien sort. »* Le chantier garde sa durée :
 * il annonce aussitôt qu'il lui manque une demi-journée, et elle se repose où
 * il veut.
 */
export async function libererDemiJourneeAction(
  chantierId: string,
  jour: string,
  demi: Moment
): Promise<ResultatCreneaux> {
  const ctx = await getCurrentCtx();
  await exigerEcritureSurLePlanning(ctx, "libérer une demi-journée");
  await exigerChantierDansSaPortee(ctx, chantierId, "libérer une demi-journée");
  const r = await libererDemiJournee(ctx, chantierId, jour as JourIso, demi);
  if (!r) return { succes: false, erreur: "Cette demi-journée n'est pas celle de ce chantier." };
  await porterChantierDansAgenda(ctx, chantierId);
  return { succes: true, creneaux: await creneauxApres(ctx, chantierId) };
}

/**
 * REPOSER LA DEMI-JOURNÉE qui attendait une place.
 *
 * *« La demi-journée de Mr Julien qui a été retirée peut être replacée. »* Elle
 * se pose où il veut — un autre jour, un autre moment.
 */
export async function reposerDemiJourneeAction(
  chantierId: string,
  jour: string,
  demi: Moment
): Promise<ResultatCreneaux> {
  const ctx = await getCurrentCtx();
  await exigerEcritureSurLePlanning(ctx, "reposer une demi-journée");
  await exigerChantierDansSaPortee(ctx, chantierId, "reposer une demi-journée");
  const r = await reposerDemiJournee(ctx, chantierId, jour as JourIso, demi);
  if (!r) return { succes: false, erreur: "Ce chantier n'attend plus de demi-journée." };
  await porterChantierDansAgenda(ctx, chantierId);
  return { succes: true, creneaux: await creneauxApres(ctx, chantierId) };
}

/**
 * Écrit le pense-bête d'un chantier — sa demande du 23 août 2026.
 *
 * **Rend un résultat, ne lève jamais.** Le message d'une exception d'action
 * serveur n'arrive pas jusqu'à lui (`AGENTS.md`) : un refus se rend en valeur,
 * sinon l'écran affiche « Enregistré » sur une note perdue.
 */
export async function ecrireNoteChantierAction(
  chantierId: string,
  note: string
): Promise<{ succes: true; note: string | null } | { succes: false; erreur: string }> {
  const ctx = await getCurrentCtx();
  await exigerEcritureSurLePlanning(ctx, "écrire le pense-bête de ce chantier");
  await exigerChantierDansSaPortee(ctx, chantierId, "écrire le pense-bête de ce chantier");
  const row = await ecrireNoteChantier(ctx, chantierId, note);
  if (!row) return { succes: false, erreur: "Ce chantier n'existe plus." };
  return { succes: true, note: row.note };
}

export async function deplanifierChantierAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  await exigerEcritureSurLePlanning(ctx, "retirer ce chantier du planning");
  await exigerChantierDansSaPortee(ctx, chantierId, "retirer ce chantier du planning");
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
  await exigerEcritureSurLePlanning(ctx, "supprimer ce chantier");
  await exigerChantierDansSaPortee(ctx, chantierId, "supprimer ce chantier");
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
export async function tachesDuChantierAction(
  chantierId: string
): Promise<
  FeuilleDuChantier & { retourPose: boolean; photos: { id: string; storageKey: string }[] }
> {
  const ctx = await getCurrentCtx();
  await exigerChantierDansSaPortee(ctx, chantierId, "ouvrir la feuille de ce chantier");
  // **Le retour se demande ICI, avec la feuille — pas à l’ouverture du bandeau.**
  //
  // Sa demande du 9 septembre : une fois posé, le bouton se fige. Or le bandeau
  // ne chargeait son état qu’à l’OUVERTURE : en rouvrant la fiche le lendemain,
  // il aurait retrouvé un bouton vert et pressable sur un chantier déjà rendu.
  // Le verrou qu’il demande n’aurait tenu que le temps d’une session.
  //
  // C’est une requête de plus sur une lecture qui se fait déjà, jamais une
  // requête de plus tout court.
  // **Et les PHOTOS du chantier, celles qu’il a jointes en créant la fiche.**
  //
  // Sa remarque du 9 septembre 2026 : *« j’ai joint des photos lorsque j’ai
  // créé la fiche client de Julien, mais elles n’apparaissent nulle part »*.
  // Elles n’étaient visibles QUE dans le bandeau « Fin de chantier », où le
  // salarié coche ses preuves — c’est-à-dire APRÈS le travail, dans un tiroir
  // qu’il n’ouvre qu’en partant. Or elles sont là pour être vues AVANT : c’est
  // ce qu’il montre du chantier à celui qui s’y rend.
  const [feuille, retour, sesPhotos] = await Promise.all([
    tachesDuChantier(ctx, chantierId),
    retourDuChantier(ctx, chantierId),
    listerPhotos(ctx, chantierId),
  ]);
  return {
    ...feuille,
    retourPose: retour !== null,
    photos: sesPhotos.map((p) => ({ id: p.id, storageKey: p.storageKey })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// POSER UN CLIENT SUR UN JOUR, SANS DEVIS — sa demande du 10 septembre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// *« Si j'ai un chantier à rajouter ou quelque chose, que je puisse le faire
// sans devoir passer par la fiche client et le devis — donc en appuyant sur
// ajouter, il faut pouvoir bloquer une demi-journée ou la journée juste en
// écrivant ce que c'est. »* Puis sa correction, planche
// `appli/bloquer-sans-devis.html` : *« change le nom en un client, et si le
// client n'est pas reconnu il faut qu'il ajoute aussi sa fiche client
// automatiquement, comme quand on ajoute un client par la voie normale. »*
//
// **La voie normale part du client et descend vers le planning** — fiche,
// devis, envoi, puis une date. Celle-ci part du JOUR et remonte : on pose
// d'abord, la fiche se crée au passage, le devis vient plus tard ou jamais.

/** Un client que la recherche a retrouvé — ce que l'écran propose au doigt. */
export type ClientProposé = {
  id: string;
  nom: string;
  telephone: string | null;
  adresse: string | null;
};

/**
 * LES CLIENTS DONT LE NOM CONTIENT CE QU'IL TAPE.
 *
 * **La recherche se fait au SERVEUR, et le carnet ne descend pas.** L'écran des
 * clients, lui, filtre dans le navigateur — il a déjà la liste, puisqu'il
 * l'affiche. Le planning ne l'a pas, et la lui envoyer ferait descendre les
 * noms, numéros et adresses de tout le carnet dans le téléphone à chaque
 * ouverture du planning, pour un geste qui sert deux fois par mois.
 *
 * **La règle, elle, ne bouge pas** : `filtrerClientsParNom` est celle de
 * l'écran des clients (`src/lib/recherche-client.ts`). Deux façons de chercher
 * un client finiraient par ne plus trouver le même (`CLAUDE.md` §3).
 */
export async function chercherDesClientsAction(saisie: string): Promise<ClientProposé[]> {
  const ctx = await getCurrentCtx();
  // Chercher, c'est lire — mais ce geste-ci n'existe que pour POSER, et poser
  // est refusé à un salarié. Lui rendre le carnet de son patron par la porte
  // de service serait le contournement que la garde existe pour fermer.
  await exigerEcritureSurLePlanning(ctx, "chercher un client");
  // **Deux lettres ne reconnaissent personne** — la même borne que
  // `reconnaitreLeClient`, et elle évite une requête par frappe.
  if (saisie.trim().length < 2) return [];
  const tous = await listerClients(ctx);
  return filtrerClientsParNom(tous, saisie)
    .slice(0, 6)
    .map((c) => ({ id: c.id, nom: c.nom, telephone: c.telephone, adresse: c.adresse }));
}

/** Ce que le jour reçoit : une moitié, ou la journée entière. */
export type QuandPoser = "matin" | "apres_midi" | "journee";

export type ResultatPoseClient =
  | { succes: true; chantier: ChantierDuPlanning; ficheCreee: boolean }
  | { succes: false; erreur: string };

/** La forme exacte que l'écran repeint — jamais recopiée à la main. */
type ChantierDuPlanning = Awaited<ReturnType<typeof listerChantiersPourPlanning>>[number];

/**
 * POSER UN CLIENT SUR UNE DEMI-JOURNÉE, OU SUR LA JOURNÉE.
 *
 * **La fiche du client se crée si elle n'existe pas**, et c'est sa demande mot
 * pour mot. La reconnaissance est celle de la voie normale
 * (`trouverOuCreerClient`, qui porte la règle du 17 août 2026) : un M. Martins
 * déjà connu ne se dédouble pas, et ce qu'on saisit complète ce qui manque
 * dans sa fiche sans jamais écraser ce qui y est.
 *
 * **LA DURÉE SE CHOISIT ICI, et c'est le seul endroit où cela reste vrai.**
 * Ailleurs, choisir un moment réécrivait ce que le devis avait vendu — le
 * défaut du 9 septembre 2026. Ici, il n'y a pas de devis : le chantier naît de
 * ce geste, et « Journée » ne recouvre rien.
 *
 * **Ni prix, ni devis, ni équipe.** Le temps est pris, c'est tout ce qui est
 * promis. Le chantier se chiffre ensuite comme les autres, ou jamais.
 */
export async function poserUnClientAction(
  jour: JourIso,
  quand: QuandPoser,
  saisie: { nom: string; telephone?: string; email?: string; adresse?: string }
): Promise<ResultatPoseClient> {
  const ctx = await getCurrentCtx();
  await exigerEcritureSurLePlanning(ctx, "poser un client sur ce jour");

  const nom = saisie.nom.trim();
  if (nom.length < 2) return { succes: false, erreur: "Écrivez le nom du client." };

  const { client, reutilise } = await trouverOuCreerClient(ctx, {
    nom,
    telephone: saisie.telephone?.trim() || undefined,
    email: saisie.email?.trim() || undefined,
    adresse: saisie.adresse?.trim() || undefined,
  });

  // **Le nom du chantier ne s'invente pas ici** : `nomDuChantier` le fabrique
  // pour toute l'application, et le recopier à la main donnerait un jour deux
  // façons de nommer la même chose (`CLAUDE.md` §3).
  // **La durée naît AVEC le chantier** : `planifierChantier` la lit pour savoir
  // combien de demi-journées poser, et un chantier sans durée vaudrait la
  // journée entière — donc « Matin » prendrait aussi l'après-midi.
  const chantier = await creerChantier(ctx, {
    nom: nomDuChantier({ nomClient: client.nom, adresseChantier: client.adresse, jour }),
    adresseChantier: client.adresse ?? undefined,
    clientId: client.id,
    dureeDemiJournees: quand === "journee" ? 2 : 1,
  });

  await planifierChantier(ctx, chantier.id, jour, {
    demi: quand === "apres_midi" ? "apres_midi" : "matin",
  });
  await porterChantierDansAgenda(ctx, chantier.id);

  // **On relit par la requête du planning**, plutôt que de fabriquer la ligne :
  // elle porte une quinzaine de champs — l'adresse, le dernier envoi, les
  // équipes, les créneaux — et une seconde rédaction en oublierait un, qui
  // manquerait à l'écran sans que rien ne le dise.
  const ligne = (await listerChantiersPourPlanning(ctx)).find((c) => c.id === chantier.id);
  if (!ligne) {
    return { succes: false, erreur: "Le chantier a été créé mais reste introuvable au planning." };
  }
  return { succes: true, chantier: ligne, ficheCreee: !reutilise };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DU TEMPS QUI N'EST PAS UN CLIENT — la banque, une livraison, une formation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Sa réponse du 10 septembre 2026**, à la question que sa propre correction
 * avait ouverte : *« ok fais ça »* — une troisième entrée, à côté de « Un
 * chantier en attente » et « Un client ».
 *
 * **Un rendez-vous à la banque prend une demi-journée comme un chantier.** Il
 * ne se distingue de celui d'un client que par ce qui lui manque : personne à
 * facturer, aucune adresse à rejoindre. C'est donc un chantier **sans client**,
 * portant pour nom ce qu'il a écrit — et non une nouvelle sorte d'objet.
 *
 * **Pourquoi pas une table à part.** Une « occupation » qui ne serait pas un
 * chantier obligerait à la compter une seconde fois dans la capacité, à la
 * dessiner une seconde fois au calendrier, à la retirer par un second geste, et
 * à la sortir des terminés par une seconde règle. Quatre endroits où deux
 * vérités finiraient par diverger, pour une ligne qui prend une demi-journée
 * exactement comme les autres.
 *
 * **CE QUE ÇA COÛTE, ET IL FAUT LE DIRE** : ce temps-là apparaît dans la liste
 * des chantiers, puisque c'en est un. Sans prix, sans devis, sans client.
 */
export async function poserDuTempsAction(
  jour: JourIso,
  quand: QuandPoser,
  quoi: string
): Promise<ResultatPoseClient> {
  const ctx = await getCurrentCtx();
  await exigerEcritureSurLePlanning(ctx, "bloquer du temps sur ce jour");

  const nom = quoi.trim();
  if (nom.length < 2) return { succes: false, erreur: "Écrivez ce que c'est." };

  // **Aucun client, et c'est tout ce qui le distingue.** `nomDuChantier` sait
  // déjà nommer un chantier sans client — mais ici le nom est écrit par lui, et
  // c'est le seul qui dise de quoi il s'agit : « Banque », « Livraison ».
  const chantier = await creerChantier(ctx, {
    nom: nom.slice(0, 120),
    dureeDemiJournees: quand === "journee" ? 2 : 1,
  });
  await planifierChantier(ctx, chantier.id, jour, {
    demi: quand === "apres_midi" ? "apres_midi" : "matin",
  });
  await porterChantierDansAgenda(ctx, chantier.id);

  const ligne = (await listerChantiersPourPlanning(ctx)).find((c) => c.id === chantier.id);
  if (!ligne) {
    return { succes: false, erreur: "Le temps a été bloqué mais reste introuvable au planning." };
  }
  return { succes: true, chantier: ligne, ficheCreee: false };
}
