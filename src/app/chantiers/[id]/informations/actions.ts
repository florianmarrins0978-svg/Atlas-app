"use server";

import { revalidatePath } from "next/cache";
import { chantierDuGeste } from "@/server/ai/tools/chantier-vise";
import { jourIso } from "@/lib/jour";
import { montantEcrivable } from "@/lib/montant-ecrivable";
import { exigerEcran } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { preparerDevisDepuisDictee, enregistrerPrecisionsEtReprendre } from "@/server/services/devis-depuis-dictee";
import {
  ajouterPrestation,
  modifierPrestation,
  corrigerMesurePrestation,
  supprimerPrestation,
} from "@/server/repositories/prestations";
import { ajouterMateriel, modifierMateriel, supprimerMateriel } from "@/server/repositories/materiel";
import { mettreAJourDureeEquipe, marquerInformationsVerifiees } from "@/server/repositories/chantiers";
import { listerPrestations } from "@/server/repositories/prestations";
import { listerMateriel } from "@/server/repositories/materiel";
import { getTarif } from "@/server/repositories/tarifs";
import { getLigneDevisPourCopie } from "@/server/repositories/devis";
import {
  creerChantier,
  planifierChantier,
  deplacerChantier,
  deplanifierChantier,
  ecrireNoteChantier,
  mettreAJourAdresseChantier,
  getChantier,
} from "@/server/repositories/chantiers";
import { getClient, mettreAJourClient, trouverOuCreerClient } from "@/server/repositories/clients";
import { listerChantiersPourAffichage } from "@/server/repositories/chantiers";
import { nomDuChantier } from "@/lib/nom-chantier";
import { filtrerClientsParNom } from "@/lib/recherche-client";
import { creerTarif, modifierTarif, supprimerTarif } from "@/server/repositories/tarifs";
import { supprimerChantier, SuppressionChantierRefusee } from "@/server/repositories/chantiers";
import { noterAbsenceEquipe } from "@/server/repositories/absences-equipe";
import { mettreAJourEntreprise, getEntreprise } from "@/server/repositories/entreprises";
import { conditionsDepuisEntreprise } from "@/lib/conditions-documents";
import {
  ajouterPrestation as ajouterPrestationEntretien,
  retirerPrestation as retirerPrestationEntretien,
} from "@/server/repositories/prestations-entretien";
import { terminerChantier } from "@/server/repositories/factures";
import { estUnJourValide, estUnMomentValide, type QuandChantier } from "@/lib/planning-jour";
import { ajouterLignePrixDirectAction } from "@/app/chantiers/[id]/prix/actions";
import { chargerDevisAction } from "@/app/chantiers/[id]/export/actions";
import { extraire } from "@/server/ai/services/extraction-service";
import { genererBrouillon, confirmerBrouillon } from "@/server/ai/services/brouillon-service";
import { getBrouillon, enregistrerCorrectionHumaine } from "@/server/repositories/brouillons-informations";
import { PropositionExtractionSchema, type PropositionExtraction } from "@/server/ai/schemas/extraction";
import type { ResultatApplicationProposition, ResultatConfirmation, CategorieConflit } from "@/server/ai/propositions";
import { reclamerProposition } from "@/server/repositories/propositions-ia";
import { AccesRefuseError } from "@/server/db/with-entreprise";
import { getRole } from "@/server/autorisation";
import { peutUtiliserLAssistant } from "@/lib/acces-roles";
import { logger } from "@/server/logger";
import { verifierLimite, LIMITES } from "@/server/rate-limit";

export async function ajouterPrestationAction(chantierId: string, libelle: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "ajouter une prestation");
  return ajouterPrestation(ctx, chantierId, libelle);
}

export async function modifierPrestationAction(id: string, libelle: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "modifier une prestation");
  return modifierPrestation(ctx, id, libelle);
}

/**
 * Corriger la quantité d'une prestation, sans passer par son texte.
 *
 * **Le chemin explicite du §8 du brief du 27 août 2026.** Ce qu'il pose ici
 * fait foi : aucune extraction future ne l'écrase, et sa valeur tranche quand
 * le libellé dit autre chose.
 *
 * **Aucun écran ne l'appelle encore**, et c'est délibéré : une demande
 * d'apparence se dessine avant de toucher `src/` (`CLAUDE.md` §3 bis). La
 * planche est publiée, l'action l'attend, et le comportement est éprouvé
 * (`scripts/test-correction-humaine-db.ts`).
 */
export async function corrigerMesurePrestationAction(
  id: string,
  mesure: { quantite: string | null; unite: string | null }
) {
  const ctx = await getCurrentCtx();
  // Ses dix-sept voisines de ce fichier la portent ; celle-ci est née sans, et
  // c'est `test-actions-gardees-db.ts` qui l'a relevée à la fusion du 30 août
  // — la première prise du contrôle élargi, sur du code écrit ailleurs.
  await exigerEcran(ctx, "/chantiers", "corriger la mesure d'une prestation");
  return corrigerMesurePrestation(ctx, id, mesure);
}

export async function supprimerPrestationAction(id: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "supprimer une prestation");
  return supprimerPrestation(ctx, id);
}

export async function ajouterMaterielAction(chantierId: string, libelle: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "ajouter du matériel");
  return ajouterMateriel(ctx, chantierId, libelle);
}

export async function modifierMaterielAction(id: string, libelle: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "modifier du matériel");
  return modifierMateriel(ctx, id, libelle);
}

export async function supprimerMaterielAction(id: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "supprimer du matériel");
  return supprimerMateriel(ctx, id);
}

export async function mettreAJourDureeEquipeAction(
  chantierId: string,
  data: { dureePrevue?: string; tailleEquipe?: string }
) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "changer la durée ou l'équipe");
  return mettreAJourDureeEquipe(ctx, chantierId, data);
}

export async function validerInformationsAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "valider les informations");
  return marquerInformationsVerifiees(ctx, chantierId);
}

// Analyse un texte libre (ou une transcription) et retourne une PROPOSITION —
// n'écrit jamais dans les données métier. L'utilisateur doit revoir et
// confirmer avant toute application (voir appliquerExtractionAction).
export async function extraireInformationsAction(texte: string): Promise<
  { succes: true; proposition: PropositionExtraction } | { succes: false; erreur: string }
> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "analyser un texte");
  const resultat = await extraire(texte);
  if (!resultat.succes) return { succes: false, erreur: resultat.erreur.message };
  return { succes: true, proposition: resultat.proposition };
}

// Applique uniquement les éléments explicitement confirmés par l'utilisateur,
// via les repositories existants — jamais d'écriture directe, jamais d'ajout
// silencieux d'un élément non confirmé.
export async function appliquerExtractionAction(
  chantierId: string,
  confirmee: { prestations: string[]; materiel: string[]; dureePrevue?: string; tailleEquipe?: string }
) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "appliquer une extraction");
  const prestationsCreees = [];
  for (const libelle of confirmee.prestations) {
    if (libelle.trim()) prestationsCreees.push(await ajouterPrestation(ctx, chantierId, libelle.trim()));
  }
  const materielCree = [];
  for (const libelle of confirmee.materiel) {
    if (libelle.trim()) materielCree.push(await ajouterMateriel(ctx, chantierId, libelle.trim()));
  }
  if (confirmee.dureePrevue || confirmee.tailleEquipe) {
    await mettreAJourDureeEquipe(ctx, chantierId, {
      dureePrevue: confirmee.dureePrevue,
      tailleEquipe: confirmee.tailleEquipe,
    });
  }
  return { prestationsCreees, materielCree };
}

// --- Brouillon structuré issu de la dictée -------------------------------
// Le brouillon vit côté serveur : il survit au rechargement, et son contenu
// n'est jamais repris depuis le navigateur au moment de l'appliquer.

export async function chargerBrouillonAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "ouvrir le brouillon de devis");
  return getBrouillon(ctx, chantierId);
}

// Génère (ou régénère) le brouillon depuis la transcription enregistrée.
// `remplacer` n'est transmis que lorsque le patron a explicitement accepté
// d'écraser ses propres corrections, après avoir vu le conflit.
export async function genererBrouillonAction(chantierId: string, remplacer = false) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "engendrer le brouillon de devis");
  const resultat = await genererBrouillon(ctx, chantierId, { remplacer });

  // Le conflit ne traverse pas la frontière client tel quel : seul ce qui est
  // nécessaire à l'affichage du choix est transmis.
  if (resultat.statut === "conflit") {
    return { statut: "conflit" as const, propositionNouvelle: resultat.propositionNouvelle };
  }
  return resultat;
}

// Correction humaine du brouillon. Valide la forme reçue avant écriture : le
// client ne peut pas déposer une structure arbitraire dans la base.
export async function enregistrerBrouillonAction(chantierId: string, contenu: unknown) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "enregistrer le brouillon de devis");
  const analyse = PropositionExtractionSchema.safeParse(contenu);
  if (!analyse.success) {
    return { succes: false as const, erreur: "Brouillon invalide." };
  }
  const brouillon = await enregistrerCorrectionHumaine(ctx, chantierId, analyse.data);
  if (!brouillon) return { succes: false as const, erreur: "Aucun brouillon à modifier." };
  return { succes: true as const, brouillon };
}

// Confirmation explicite : reprend le contenu DEPUIS LA BASE (jamais depuis le
// client) et le déverse dans les données métier via les repositories existants.
// Idempotent au sens utile : un brouillon déjà confirmé n'est pas réappliqué.
export async function confirmerBrouillonAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "confirmer le brouillon de devis");
  const resultat = await confirmerBrouillon(ctx, chantierId);
  if (!resultat.succes) return { succes: false as const, erreur: resultat.erreur };
  return { succes: true as const, prestationsCreees: resultat.prestationsCreees, materielCree: resultat.materielCree };
}

// Applique les propositions confirmées par l'utilisateur (assistant, lot
// IA-03) — uniquement via les Server Actions déjà existantes dans ce fichier.
// Ne s'interrompt jamais globalement : chaque proposition est traitée
// indépendamment, un conflit sur l'une n'empêche jamais les autres.
// Applique les propositions CONFIRMÉES, référencées uniquement par leur id
// serveur (jamais par leur contenu — voir propositions-ia.ts). Chaque id est
// réclamé atomiquement (idempotence : un rejeu séquentiel ou concurrent du
// même id ne produit jamais une seconde écriture). Ne s'interrompt jamais
// globalement : chaque proposition est traitée indépendamment.
export async function appliquerPropositionsAction(
  // **`null` est un cas normal depuis le 26 août 2026** : créer un chantier,
  // régler un tarif ou corriger un client ne se rattache à aucun chantier, et
  // l'assistant s'ouvre sur tous les écrans (migration 0067).
  chantierId: string | null,
  propositionIds: string[]
): Promise<ResultatConfirmation> {
  const ctx = await getCurrentCtx();

  // **La même barrière que pour poser la question** (`src/app/assistant/actions.ts`).
  // Un salarié ne peut pas obtenir de propositions ; encore faut-il qu'il ne
  // puisse pas appliquer celles d'un autre en rejouant l'action avec leurs
  // identifiants. Un refus en valeur de retour, jamais une exception : le
  // message d'une exception levée par une action serveur n'arrive jamais
  // jusqu'à l'écran (`AGENTS.md`).
  const roleDemandeur = await getRole(ctx);
  if (!roleDemandeur || !peutUtiliserLAssistant(roleDemandeur)) {
    return {
      resultats: propositionIds.map((id) => ({
        propositionId: id,
        type: "inconnu",
        description: "",
        statut: "conflit" as const,
        categorie: "acces_refuse" as const,
        message: "L'assistant n'est pas disponible pour votre compte.",
      })),
    };
  }

  const limite = await verifierLimite(`confirmation:${ctx.entrepriseId}`, LIMITES.confirmationProposition);
  if (!limite.autorise) {
    return {
      resultats: propositionIds.map((id) => ({
        propositionId: id,
        type: "inconnu",
        description: "",
        statut: "conflit",
        categorie: "technique",
        message: limite.message,
      })),
    };
  }

  const resultats: ResultatApplicationProposition[] = [];
  let chantierARegenerer: string | null = null;

  for (const propositionId of propositionIds) {
    const reclamation = await reclamerProposition(ctx, chantierId, propositionId);

    if (reclamation.statut === "introuvable") {
      resultats.push({
        propositionId,
        type: "inconnu",
        description: "",
        statut: "conflit",
        categorie: "introuvable",
        message: "Cette proposition est introuvable ou n'appartient pas à cet écran.",
      });
      continue;
    }
    if (reclamation.statut === "deja_appliquee") {
      resultats.push({
        propositionId,
        type: "inconnu",
        description: "",
        statut: "conflit",
        categorie: "deja_appliquee",
        message: "Cette proposition a déjà été appliquée.",
      });
      continue;
    }

    // reclamation.statut === "reclamee" — donnees viennent EXCLUSIVEMENT de
    // l'enregistrement serveur (jamais du client) : id, montant et tout le
    // reste sont désormais hors d'atteinte de toute altération côté navigateur.
    const { proposition } = reclamation;
    const donnees = proposition.donnees;
    const base = { propositionId: proposition.id, type: proposition.type, description: proposition.description };

    /**
     * **Le chantier que vise CE geste** : celui qu'il nomme, sinon celui ouvert.
     *
     * Avant le 26 août 2026, tout visait le chantier de l'écran — l'assistant
     * n'en connaissait pas d'autre. Depuis qu'il sait les CHERCHER
     * (`RechercherChantier`), un geste peut en désigner un autre, et c'est ce
     * qu'il demandait : *« toutes les capacités possibles sur l'appli »*.
     *
     * **Cela n'ouvre rien.** L'identifiant traverse la RLS comme les autres :
     * un chantier d'une entreprise voisine est indiscernable d'un chantier
     * disparu, et rend le même conflit.
     */
    const chantierVise = chantierDuGeste(donnees, chantierId);

    // Les gestes qui n'ont de sens que SUR un chantier. Sans lui, on le DIT :
    // écrire dans le vide, ou planter, coûterait un aller-retour.
    const BESOIN_D_UN_CHANTIER = new Set([
      "ajouter_prestation", "supprimer_prestation", "modifier_prestation",
      "ajouter_materiel", "supprimer_materiel", "modifier_materiel",
      "modifier_duree", "modifier_equipe", "ajouter_ligne_prix", "copier_ligne_devis",
      "modifier_adresse_chantier", "noter_chantier", "planifier_chantier",
      "deplacer_chantier", "retirer_du_planning", "preparer_facture",
      // Supprimer sans savoir QUOI serait le pire des gestes : sans chantier
      // visé, il partirait sur celui de l'écran — ou sur rien.
      "supprimer_chantier",
    ]);
    if (!chantierVise && BESOIN_D_UN_CHANTIER.has(proposition.type)) {
      resultats.push({
        ...base,
        statut: "conflit",
        categorie: "donnee_invalide",
        // **On ne le renvoie PAS ouvrir une fiche.** C'est ce qu'il a reproché
        // deux fois le 25 août 2026, et `chantier-vise.ts` l'a corrigé côté
        // outils. Le même reproche valait ici : quand le geste ne désigne
        // aucun chantier, c'est à l'assistant de le chercher, pas au patron
        // d'aller le chercher pour lui.
        message: "Je n'ai pas su de quel chantier il s'agit. Dites-moi le nom du client.",
      });
      continue;
    }

    try {
      switch (proposition.type) {
        case "ajouter_prestation": {
          const libelle = String(donnees.libelle ?? "").trim();
          if (!libelle) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Libellé manquant." });
            break;
          }
          await ajouterPrestationAction(chantierVise, libelle);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "supprimer_prestation": {
          const id = String(donnees.id ?? "");
          const actuelles = await listerPrestations(ctx, chantierVise);
          if (!actuelles.some((p) => p.id === id)) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Cette prestation n'existe plus." });
            break;
          }
          await supprimerPrestationAction(id);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "modifier_prestation": {
          const id = String(donnees.id ?? "");
          const nouveauLibelle = String(donnees.libelle ?? "").trim();
          if (!nouveauLibelle) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Nouveau libellé manquant." });
            break;
          }
          // Remédiation (cross-chantier) : vérifie que l'id cible appartient
          // bien AU CHANTIER visé — pas seulement à la même société (RLS ne
          // suffit pas) — avant toute écriture, comme pour la suppression.
          const actuelles = await listerPrestations(ctx, chantierVise);
          if (!actuelles.some((p) => p.id === id)) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Cette prestation n'existe plus." });
            break;
          }
          const maj = await modifierPrestationAction(id, nouveauLibelle);
          if (!maj) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Cette prestation n'existe plus." });
            break;
          }
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "ajouter_materiel": {
          const libelle = String(donnees.libelle ?? "").trim();
          if (!libelle) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Libellé manquant." });
            break;
          }
          await ajouterMaterielAction(chantierVise, libelle);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "supprimer_materiel": {
          const id = String(donnees.id ?? "");
          const actuels = await listerMateriel(ctx, chantierVise);
          if (!actuels.some((m) => m.id === id)) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce matériel n'existe plus." });
            break;
          }
          await supprimerMaterielAction(id);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "modifier_materiel": {
          const id = String(donnees.id ?? "");
          const nouveauLibelle = String(donnees.libelle ?? "").trim();
          if (!nouveauLibelle) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Nouveau libellé manquant." });
            break;
          }
          // Remédiation (cross-chantier) : même vérification que ci-dessus.
          const actuels = await listerMateriel(ctx, chantierVise);
          if (!actuels.some((m) => m.id === id)) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce matériel n'existe plus." });
            break;
          }
          const maj = await modifierMaterielAction(id, nouveauLibelle);
          if (!maj) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce matériel n'existe plus." });
            break;
          }
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "modifier_duree": {
          const nouvelleDuree = String(donnees.nouvelleDuree ?? "").trim();
          if (!nouvelleDuree) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Nouvelle durée manquante." });
            break;
          }
          await mettreAJourDureeEquipeAction(chantierVise, { dureePrevue: nouvelleDuree });
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "modifier_equipe": {
          const nouvelleEquipe = String(donnees.nouvelleEquipe ?? "").trim();
          if (!nouvelleEquipe) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Nouvelle équipe manquante." });
            break;
          }
          await mettreAJourDureeEquipeAction(chantierVise, { tailleEquipe: nouvelleEquipe });
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "ajouter_ligne_prix": {
          const libelle = String(donnees.libelle ?? "").trim();
          const tarifId = donnees.tarifId ? String(donnees.tarifId) : null;
          let montant = String(donnees.montant ?? "").trim();

          // Remédiation (montant client) : pour une ligne issue d'un tarif,
          // ne fait jamais confiance au montant mémorisé — relit le prix
          // ACTUEL du tarif. Le montant côté proposition n'est utilisé QUE
          // pour les lignes calculées (chiffrage), déjà générées côté serveur
          // et jamais réémises/modifiables par le client.
          if (tarifId) {
            const tarifActuel = await getTarif(ctx, tarifId);
            if (!tarifActuel) {
              resultats.push({
                ...base,
                statut: "conflit",
                categorie: "conflit_metier",
                message: "Ce tarif n'existe plus ou a été supprimé.",
              });
              break;
            }
            montant = tarifActuel.prix;
          }

          if (!libelle || !montant) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Libellé ou montant manquant." });
            break;
          }

          /**
           * **UN MONTANT VENU DU MODÈLE SE VÉRIFIE AVANT D'ÊTRE ÉCRIT** — lot
           * de clôture, 29 août 2026.
           *
           * Le commentaire ci-dessus affirmait que « le montant côté
           * proposition n'est utilisé QUE pour les lignes calculées ». C'est
           * vrai du chiffrage ; **c'était faux de ce chemin-ci** : sans
           * `tarifId`, `donnees.montant` est ce que le modèle a composé, et il
           * partait tel quel en base.
           *
           * La base refusait le négatif et rien d'autre : ni `NaN`, ni une
           * chaîne ambiguë, ni 99 999 999,99 €. Et quand elle refusait, elle
           * rendait « cette modification n'a pas pu être appliquée » — un
           * message qui envoie chercher une panne là où il s'agit d'un chiffre.
           *
           * La borne n'invente aucun plafond métier : elle refuse ce qui n'est
           * pas un montant, et ce que la colonne ne peut pas contenir.
           */
          const verifie = montantEcrivable(montant);
          if (!verifie.ok) {
            resultats.push({
              ...base,
              statut: "conflit",
              categorie: "donnee_invalide",
              message: verifie.raison,
            });
            break;
          }
          montant = verifie.montant;

          // Remédiation (transaction) : un seul appel, une seule transaction —
          // jamais de ligne vide intermédiaire.
          await ajouterLignePrixDirectAction(chantierVise, libelle, montant);
          chantierARegenerer = chantierVise;
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "copier_ligne_devis": {
          // **Reprendre la ligne d'un AUTRE client sur le devis ouvert** (sa
          // demande du 25 août 2026). Seul l'identifiant de la ligne d'origine
          // a voyagé : le libellé et le montant sont relus ICI, en base, à
          // l'instant où l'on écrit. Un montant transmis par le navigateur ou
          // formulé par le modèle est un montant qu'on peut changer en chemin —
          // sur un document qui part chez un client. Même remède que pour un
          // tarif, ci-dessus.
          //
          // La RLS borne la lecture à l'entreprise : une ligne d'une société
          // voisine est indiscernable d'une ligne disparue, et rend le même
          // conflit.
          const ligneOrigineId = String(donnees.ligneOrigineId ?? "");
          if (!ligneOrigineId) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Ligne d'origine manquante." });
            break;
          }
          const origine = await getLigneDevisPourCopie(ctx, ligneOrigineId);
          if (!origine) {
            resultats.push({
              ...base,
              statut: "conflit",
              categorie: "conflit_metier",
              message: "Cette ligne de devis n'existe plus.",
            });
            break;
          }
          await ajouterLignePrixDirectAction(chantierVise, origine.libelle, origine.montant);
          chantierARegenerer = chantierVise;
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        // --- Sa demande du 26 août 2026 : « un vrai agent avec toutes les
        // capacités possibles sur l'appli ». Chacun reste une PROPOSITION —
        // *« très important que ça reste le doigt du patron »*.
        //
        // **Chaque geste relit sa cible en base avant d'écrire.** Le modèle a
        // pu désigner un chantier disparu entre sa proposition et le doigt du
        // patron ; l'écrire quand même serait une erreur silencieuse.
        case "creer_chantier": {
          /**
           * **Ouvrir une fiche pour un client** — sa demande du 25 août 2026
           * (*« ça aussi il doit pouvoir le faire »*), devenue une PROPOSITION
           * le 26 sur sa réponse : *« très important que ça reste le doigt du
           * patron »*. Il SAIT le faire ; c'est lui qui appuie.
           *
           * **Deux règles reprises de l'outil qu'elle remplace, jamais
           * réécrites** — les perdre en changeant de mécanique aurait été une
           * régression silencieuse :
           */
          const nomClient = String(donnees.client ?? donnees.nom ?? "").trim();
          if (!nomClient) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Aucun nom de client." });
            break;
          }
          const adresse = String(donnees.adresse ?? "").trim() || undefined;

          // 1. **Un jardin ne se dédouble pas en silence.** Un paysagiste
          //    repasse chez les mêmes gens : deux fiches pour un même jardin,
          //    c'est un désordre qu'on ne défait plus. Il faut une seconde
          //    intention explicite.
          if (!donnees.confirmerDoublon) {
            const dejaLa = filtrerClientsParNom(
              (await listerChantiersPourAffichage(ctx))
                .filter((c) => c.clientNom)
                .map((c) => ({ ...c, nom: c.clientNom! })),
              nomClient
            );
            if (dejaLa.length > 0) {
              resultats.push({
                ...base,
                statut: "conflit",
                categorie: "conflit_metier",
                message: `${nomClient} a déjà ${dejaLa.length} chantier${dejaLa.length > 1 ? "s" : ""} dans Atlas.`,
              });
              break;
            }
          }

          // 2. **Un chantier ne se BAPTISE pas** (sa demande du 5 août 2026) :
          //    son étiquette se déduit du client, sinon de l'adresse, sinon du
          //    jour — par la MÊME fonction que l'écran de création. La composer
          //    ici donnerait une seconde règle de nommage, et l'écart se verrait
          //    dans sa liste (`CLAUDE.md` §3).
          const { client: fiche } = await trouverOuCreerClient(ctx, { nom: nomClient });
          const nom = nomDuChantier({
            nomClient: fiche.nom,
            civilite: fiche.civilite,
            adresseChantier: adresse ?? null,
            // Le jour de l'atelier, pas celui de Greenwich (§182) : après
            // minuit, le chantier prenait le nom de la veille.
            jour: jourIso(new Date()),
          });
          await creerChantier(ctx, { nom, clientId: fiche.id, ...(adresse ? { adresseChantier: adresse } : {}) });
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "modifier_client": {
          const clientId = String(donnees.clientId ?? "");
          if (!(await getClient(ctx, clientId))) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce client n'existe plus." });
            break;
          }
          // **Seuls les champs PRÉSENTS sont touchés.** Un champ absent laisse
          // la valeur d'avant ; le passer à `null` l'effacerait — et un
          // téléphone effacé, c'est un devis qui ne part plus.
          const maj: Parameters<typeof mettreAJourClient>[2] = {};
          for (const champ of ["nom", "telephone", "email", "adresse"] as const) {
            if (typeof donnees[champ] === "string" && String(donnees[champ]).trim()) {
              maj[champ] = String(donnees[champ]).trim();
            }
          }
          const canal = donnees.canalCommunication;
          if (canal === "sms" || canal === "email") maj.canalCommunication = canal;
          if (Object.keys(maj).length === 0) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Rien à corriger." });
            break;
          }
          const modifie = await mettreAJourClient(ctx, clientId, maj);
          if (!modifie) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce client n'existe plus." });
            break;
          }
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "modifier_adresse_chantier": {
          const cible = chantierVise;
          const adresse = String(donnees.adresse ?? "").trim();
          if (!cible || !adresse) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Chantier ou adresse manquant." });
            break;
          }
          if (!(await getChantier(ctx, cible))) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce chantier n'existe plus." });
            break;
          }
          await mettreAJourAdresseChantier(ctx, cible, adresse);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "noter_chantier": {
          const cible = chantierVise;
          const note = String(donnees.note ?? "").trim();
          if (!cible || !note) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Chantier ou note manquant." });
            break;
          }
          const ecrite = await ecrireNoteChantier(ctx, cible, note);
          if (!ecrite) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce chantier n'existe plus." });
            break;
          }
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "planifier_chantier":
        case "deplacer_chantier": {
          const cible = chantierVise;
          const jour = String(donnees.jour ?? "").trim();
          const quand = String(donnees.quand ?? "journee");
          // **Le jour et le moment se valident ICI, avec la MÊME règle que
          // l'écran** (`planning-jour.ts`) : une seconde version de la règle
          // finirait par accepter ce que le planning refuse (`CLAUDE.md` §3).
          if (!cible || !estUnJourValide(jour)) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Chantier ou jour manquant." });
            break;
          }
          if (!estUnMomentValide(quand)) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Moment de la journée inconnu." });
            break;
          }
          if (!(await getChantier(ctx, cible))) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce chantier n'existe plus." });
            break;
          }
          const choix = { quand: quand as QuandChantier };
          const pose =
            proposition.type === "deplacer_chantier"
              ? await deplacerChantier(ctx, cible, choix.quand)
              : await planifierChantier(ctx, cible, jour, choix);
          if (!pose) {
            // `deplacerChantier` rend `null` quand le chantier n'est posé nulle
            // part : il n'y a pas de jour d'où le bouger, et l'inventer serait
            // pire que refuser.
            resultats.push({
              ...base,
              statut: "conflit",
              categorie: "conflit_metier",
              message: "Ce chantier n'est posé sur aucun jour : il se planifie, il ne se déplace pas.",
            });
            break;
          }
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "retirer_du_planning": {
          const cible = chantierVise;
          if (!cible || !(await getChantier(ctx, cible))) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce chantier n'existe plus." });
            break;
          }
          await deplanifierChantier(ctx, cible);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "creer_tarif": {
          const intitule = String(donnees.intitule ?? "").trim();
          const prix = String(donnees.prix ?? "").trim();
          // **Un prix ne s'invente pas** (`CLAUDE.md` §4) : sans chiffre donné
          // par le patron, on refuse plutôt que d'en poser un plausible.
          if (!intitule || !prix) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Intitulé ou prix manquant." });
            break;
          }
          await creerTarif(ctx, { intitule, prix, unite: String(donnees.unite ?? "").trim() || undefined });
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "modifier_tarif": {
          const tarifId = String(donnees.tarifId ?? "");
          if (!tarifId || !(await getTarif(ctx, tarifId))) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce tarif n'existe plus." });
            break;
          }
          const maj: { intitule?: string; prix?: string } = {};
          if (typeof donnees.intitule === "string" && donnees.intitule.trim()) maj.intitule = donnees.intitule.trim();
          if (typeof donnees.prix === "string" && donnees.prix.trim()) maj.prix = donnees.prix.trim();
          if (Object.keys(maj).length === 0) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Rien à corriger." });
            break;
          }
          await modifierTarif(ctx, tarifId, maj);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        /**
         * SUPPRIMER UN CHANTIER — et le refus métier reste au SERVEUR.
         *
         * Sa demande du 27 août 2026. Un geste qui efface est celui qu'on
         * hésite le plus à confier ; rien ne s'exécute sans qu'il coche, et
         * `supprimerChantier` refuse de lui-même un chantier dont la facture
         * est émise — une pièce comptable numérotée ne disparaît pas d'un
         * glissement du doigt, la correction passe par un avoir.
         *
         * **On ne redouble PAS ce refus ici.** Écrit deux fois, il finirait par
         * diverger, et c'est le serveur qui a raison (`CLAUDE.md` §3).
         */
        case "supprimer_chantier": {
          try {
            await supprimerChantier(ctx, chantierVise);
            resultats.push({ ...base, statut: "appliquee" });
          } catch (e) {
            if (e instanceof SuppressionChantierRefusee) {
              resultats.push({
                ...base,
                statut: "conflit",
                categorie: "conflit_metier",
                message:
                  e.motif === "facture_emise"
                    ? "Ce chantier est facturé : il ne se supprime pas. Il faut passer par un avoir."
                    : "Ce chantier n'existe plus.",
              });
              break;
            }
            throw e;
          }
          break;
        }
        case "supprimer_tarif": {
          const tarifId = String(donnees.tarifId ?? "");
          // **On relit la cible AVANT d'écrire.** Entre la proposition et son
          // appui, le tarif a pu disparaître — c'est la règle de tout ce
          // fichier, et elle vaut d'autant plus pour un effacement.
          if (!tarifId || !(await getTarif(ctx, tarifId))) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce tarif n'existe plus." });
            break;
          }
          await supprimerTarif(ctx, tarifId);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        /**
         * POSER UNE ABSENCE D'ÉQUIPE.
         *
         * **Une absence retire de la place au planning exactement comme un
         * chantier** (`useOccupation`) : mal posée, elle fait proposer au client
         * un jour où personne ne peut venir. D'où les trois refus ci-dessous,
         * et aucune date devinée.
         */
        case "poser_absence_equipe": {
          const rang = Number(donnees.rang);
          const premier = String(donnees.premierJour ?? "").trim();
          const dernier = String(donnees.dernierJour ?? "").trim() || premier;
          if (!Number.isInteger(rang) || rang < 1) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Quelle équipe ? Donnez son numéro." });
            break;
          }
          if (!estUnJourValide(premier) || !estUnJourValide(dernier)) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Ces dates ne sont pas valides." });
            break;
          }
          if (dernier < premier) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "La fin est avant le début." });
            break;
          }
          const motif = String(donnees.motif ?? "").trim() || null;
          const posee = await noterAbsenceEquipe(ctx, { rang, premierJour: premier, dernierJour: dernier, motif });
          if (!posee) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Cette absence n'a pas pu être posée." });
            break;
          }
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        /**
         * RÉGLER LES DOCUMENTS — validité, acompte, délai, moyens, pénalités.
         *
         * **Ce qui n'est pas donné n'est pas touché.** Un réglage absent de la
         * proposition doit rester tel quel : envoyer l'objet entier remettrait
         * à zéro ce qu'il a réglé à la main, et cela s'imprimerait sur des
         * documents que ses clients gardent.
         *
         * **Les bornes restent au serveur** (`normaliserConditions`) : un
         * acompte de 400 % ne s'imprime pas parce qu'un modèle l'a proposé.
         */
        case "regler_documents": {
          const conditions: Record<string, unknown> = {};
          if (donnees.validiteJours !== undefined) conditions.validiteJours = Number(donnees.validiteJours);
          if (donnees.acomptePourcent !== undefined) conditions.acomptePourcent = String(donnees.acomptePourcent);
          if (donnees.delaiPaiementJours !== undefined) conditions.delaiPaiementJours = Number(donnees.delaiPaiementJours);
          if (typeof donnees.moyensPaiement === "string") conditions.moyensPaiement = donnees.moyensPaiement;
          if (typeof donnees.rappelerPenalites === "boolean") conditions.rappelerPenalites = donnees.rappelerPenalites;
          if (typeof donnees.textePied === "string") conditions.textePied = donnees.textePied;
          if (Object.keys(conditions).length === 0) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Rien à régler." });
            break;
          }
          /**
           * **ON RELIT CE QUI EST DÉJÀ RÉGLÉ, ET ON FUSIONNE.**
           *
           * `mettreAJourEntreprise` REMPLACE le bloc des conditions : c'est
           * juste pour l'écran des réglages, qui renvoie le formulaire entier.
           * Ici, la proposition ne porte qu'un réglage — et écrire ce seul
           * réglage effaçait tous les autres. Vu rouge par
           * `test-agent-gestes.ts` : régler l'acompte perdait la validité.
           *
           * Ce n'est pas une régression de plus : **cela s'imprime sur des
           * documents que ses clients gardent**, et il ne le verrait qu'au
           * devis suivant.
           */
          const entrepriseActuelle = await getEntreprise(ctx);
          const dejaLa = conditionsDepuisEntreprise(entrepriseActuelle);
          await mettreAJourEntreprise(ctx, {
            conditions: {
              validiteJours: dejaLa.validiteJours,
              acomptePourcent: dejaLa.acomptePourcent,
              delaiPaiementJours: dejaLa.delaiPaiementJours,
              moyensPaiement: dejaLa.moyensPaiement,
              rappelerPenalites: dejaLa.rappelerPenalites,
              textePied: dejaLa.textePied,
              ...conditions,
            },
          });
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "ajouter_prestation_entretien": {
          const famille = String(donnees.famille ?? "").trim();
          const libelle = String(donnees.libelle ?? "").trim();
          if (!famille || !libelle) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Il manque la famille ou le libellé." });
            break;
          }
          const ajout = await ajouterPrestationEntretien(ctx, { famille, libelle });
          if (!ajout.ok) {
            resultats.push({
              ...base,
              statut: "conflit",
              categorie: "conflit_metier",
              // Le refus du dépôt est repris tel quel : « doublon » et « famille
              // vide » ne se réparent pas de la même façon.
              message: ajout.refus === "doublon" ? "Cette ligne existe déjà dans la fiche." : "Cette ligne n'a pas pu être ajoutée.",
            });
            break;
          }
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "retirer_prestation_entretien": {
          const id = String(donnees.prestationId ?? "");
          if (!id) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Quelle ligne ?" });
            break;
          }
          const retrait = await retirerPrestationEntretien(ctx, id);
          if (!retrait.ok) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Cette ligne n'est plus dans la fiche." });
            break;
          }
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "preparer_facture": {
          // **Il PRÉPARE, il n'émet pas.** `terminerChantier` crée la facture en
          // BROUILLON ; l'émettre et l'envoyer restent deux gestes de sa main
          // (`CLAUDE.md` §4, et sa réponse du 26 août : *« très important que ça
          // reste le doigt du patron »*).
          const cible = chantierVise;
          if (!cible || !(await getChantier(ctx, cible))) {
            resultats.push({ ...base, statut: "conflit", categorie: "conflit_metier", message: "Ce chantier n'existe plus." });
            break;
          }
          await terminerChantier(ctx, cible);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        default:
          resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Type d'action inconnu." });
      }
    } catch (err) {
      // Remédiation (erreurs avalées) : l'erreur est liée, journalisée avec un
      // contexte de diagnostic sûr, et catégorisée — jamais de détail
      // technique exposé à l'utilisateur, mais jamais perdu côté serveur.
      const categorie: CategorieConflit = err instanceof AccesRefuseError ? "acces_refuse" : "technique";
      logger.error("Échec de l'application d'une proposition", {
        chantierId,
        propositionId: proposition.id,
        type: proposition.type,
        categorie,
        erreur: err,
      });
      resultats.push({
        ...base,
        statut: "conflit",
        categorie,
        message: "Cette modification n'a pas pu être appliquée.",
      });
    }
  }

  // Si des lignes de prix ont été ajoutées, régénère le devis brouillon.
  // Remédiation (échec avalé) : l'erreur est désormais liée, journalisée, et
  // signalée à l'appelant via un avertissement explicite — les propositions
  // déjà appliquées ci-dessus restent acquises, mais l'interface ne doit
  // jamais présenter un succès complet sans réserve si cette étape échoue.
  let avertissement: string | undefined;
  if (chantierARegenerer) {
    try {
      await chargerDevisAction(chantierARegenerer);
    } catch (err) {
      logger.error("Régénération du devis échouée après application d'une proposition", { chantierId: chantierARegenerer, erreur: err });
      avertissement =
        "Vos modifications ont été enregistrées, mais le devis n'a pas pu être actualisé. Rechargez la page Devis pour vérifier son contenu.";
    }
  }

  return { resultats, avertissement };
}

// --- De la dictée au devis, en un seul geste ------------------------------

/**
 * Enchaîne tout ce que le patron enchaînait à la main : brouillon,
 * prestations, matériel, durée, équipe, prix, devis.
 *
 * La règle vit dans `src/server/services/devis-depuis-dictee.ts` — cette action
 * ne fait que lui donner le contexte de session et rafraîchir les écrans
 * touchés. Elle n'envoie rien : l'arrêt avant l'envoi reste entier.
 */
export async function preparerDevisDepuisDicteeAction(chantierId: string, remplacer = false) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "préparer un devis depuis la dictée");

  // ═══════════════════════════════════════════════════════════════════════
  // **LA PANNE SE DIT, ELLE NE SE COMPTE PLUS — sa capture du 1ᵉʳ septembre
  // 2026 : « Atlas prépare toujours votre devis… (96 s) », et la note qui
  // n'atteint jamais le devis.**
  //
  // Le service journalisait déjà la cause (`devis-depuis-dictee.ts`), puis
  // relançait. Or **le message d'une exception d'action serveur n'arrive
  // JAMAIS jusqu'à lui** : Next.js le remplace en production par un
  // identifiant opaque (`AGENTS.md`). L'écran tombait donc dans son rattrapage
  // — celui du 12 août, écrit pour les réponses PERDUES — et se mettait à
  // compter des secondes devant un travail déjà mort. Quatre-vingt-seize
  // secondes à regarder un devis qui ne viendrait pas.
  //
  // On rend donc un refus EN VALEUR. Le rattrapage garde son rôle : il ne sert
  // plus qu'aux vraies coupures, celles où rien ne revient du tout.
  //
  // La raison est courte et sans détail de pile : elle doit tenir sur un
  // téléphone et pouvoir être recopiée telle quelle. Le détail complet reste
  // au journal du serveur.
  // ═══════════════════════════════════════════════════════════════════════
  let resultat: Awaited<ReturnType<typeof preparerDevisDepuisDictee>>;
  try {
    resultat = await preparerDevisDepuisDictee(ctx, chantierId, { remplacer });
  } catch (err) {
    const motif = (err instanceof Error ? err.message : String(err))
      .split("\n")[0]!
      .slice(0, 160);
    return {
      statut: "echec" as const,
      erreur: `La préparation s'est arrêtée : ${motif}`,
    };
  }

  if (resultat.statut === "prepare") {
    // Les trois écrans que l'enchaînement vient de modifier. Sans cela, le
    // patron revient sur « Informations » et y trouve la page d'avant : il
    // croirait que rien ne s'est passé.
    //
    // **La fiche du chantier a quitté cette liste le 4 septembre 2026**
    // (`ARCHITECTURE.md` §254) : son adresse ne rend plus qu'une
    // redirection, et revalider une redirection ne rafraîchit rien.
    revalidatePath(`/chantiers/${chantierId}/informations`);
    revalidatePath(`/chantiers/${chantierId}/prix`);
    revalidatePath(`/chantiers/${chantierId}/export`);
  }

  // Le conflit ne traverse pas la frontière client tel quel : seul ce qui sert
  // à afficher le choix est transmis.
  if (resultat.statut === "conflit") {
    return { statut: "conflit" as const, propositionNouvelle: resultat.propositionNouvelle };
  }
  return resultat;
}

/**
 * Il a répondu : on enregistre, on complète les prestations, et on reprend.
 *
 * **Les trois gestes sont indissociables**, et c'est pourquoi ils tiennent dans
 * une seule action plutôt qu'en trois appels depuis l'écran. Enregistrer sans
 * compléter les prestations laisserait sa réponse invisible sur le devis ;
 * compléter sans reprendre le laisserait devant des questions déjà répondues.
 */
export async function repondreQuestionsChiffrageAction(
  chantierId: string,
  reponses: { sujet: string; libellePrestation: string; valeur: string; lisible: string }[]
) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "répondre aux questions de chiffrage");
  const resultat = await enregistrerPrecisionsEtReprendre(ctx, chantierId, reponses);

  if (resultat.statut === "prepare") {
    revalidatePath(`/chantiers/${chantierId}/informations`);
    revalidatePath(`/chantiers/${chantierId}/prix`);
    revalidatePath(`/chantiers/${chantierId}/export`);
    revalidatePath(`/chantiers/${chantierId}/devis-complet`);
  }

  if (resultat.statut === "conflit") {
    return { statut: "conflit" as const, propositionNouvelle: resultat.propositionNouvelle };
  }
  return resultat;
}
