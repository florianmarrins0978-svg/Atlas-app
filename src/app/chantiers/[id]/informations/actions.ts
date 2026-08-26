"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { preparerDevisDepuisDictee, enregistrerPrecisionsEtReprendre } from "@/server/services/devis-depuis-dictee";
import {
  ajouterPrestation,
  modifierPrestation,
  supprimerPrestation,
} from "@/server/repositories/prestations";
import { ajouterMateriel, modifierMateriel, supprimerMateriel } from "@/server/repositories/materiel";
import { mettreAJourDureeEquipe, marquerInformationsVerifiees } from "@/server/repositories/chantiers";
import { listerPrestations } from "@/server/repositories/prestations";
import { listerMateriel } from "@/server/repositories/materiel";
import { getTarif } from "@/server/repositories/tarifs";
import { getLigneDevisPourCopie } from "@/server/repositories/devis";
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
  return ajouterPrestation(ctx, chantierId, libelle);
}

export async function modifierPrestationAction(id: string, libelle: string) {
  const ctx = await getCurrentCtx();
  return modifierPrestation(ctx, id, libelle);
}

export async function supprimerPrestationAction(id: string) {
  const ctx = await getCurrentCtx();
  return supprimerPrestation(ctx, id);
}

export async function ajouterMaterielAction(chantierId: string, libelle: string) {
  const ctx = await getCurrentCtx();
  return ajouterMateriel(ctx, chantierId, libelle);
}

export async function modifierMaterielAction(id: string, libelle: string) {
  const ctx = await getCurrentCtx();
  return modifierMateriel(ctx, id, libelle);
}

export async function supprimerMaterielAction(id: string) {
  const ctx = await getCurrentCtx();
  return supprimerMateriel(ctx, id);
}

export async function mettreAJourDureeEquipeAction(
  chantierId: string,
  data: { dureePrevue?: string; tailleEquipe?: string }
) {
  const ctx = await getCurrentCtx();
  return mettreAJourDureeEquipe(ctx, chantierId, data);
}

export async function validerInformationsAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  return marquerInformationsVerifiees(ctx, chantierId);
}

// Analyse un texte libre (ou une transcription) et retourne une PROPOSITION —
// n'écrit jamais dans les données métier. L'utilisateur doit revoir et
// confirmer avant toute application (voir appliquerExtractionAction).
export async function extraireInformationsAction(texte: string): Promise<
  { succes: true; proposition: PropositionExtraction } | { succes: false; erreur: string }
> {
  await getCurrentCtx(); // exige une session valide, même si l'extraction elle-même n'est pas scopée entreprise
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
  return getBrouillon(ctx, chantierId);
}

// Génère (ou régénère) le brouillon depuis la transcription enregistrée.
// `remplacer` n'est transmis que lorsque le patron a explicitement accepté
// d'écraser ses propres corrections, après avoir vu le conflit.
export async function genererBrouillonAction(chantierId: string, remplacer = false) {
  const ctx = await getCurrentCtx();
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
export async function appliquerPropositionsAction(chantierId: string, propositionIds: string[]): Promise<ResultatConfirmation> {
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
  let uneLigneDePrixAjoutee = false;

  for (const propositionId of propositionIds) {
    const reclamation = await reclamerProposition(ctx, chantierId, propositionId);

    if (reclamation.statut === "introuvable") {
      resultats.push({
        propositionId,
        type: "inconnu",
        description: "",
        statut: "conflit",
        categorie: "introuvable",
        message: "Cette proposition est introuvable ou n'appartient pas à ce chantier.",
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

    try {
      switch (proposition.type) {
        case "ajouter_prestation": {
          const libelle = String(donnees.libelle ?? "").trim();
          if (!libelle) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Libellé manquant." });
            break;
          }
          await ajouterPrestationAction(chantierId, libelle);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "supprimer_prestation": {
          const id = String(donnees.id ?? "");
          const actuelles = await listerPrestations(ctx, chantierId);
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
          const actuelles = await listerPrestations(ctx, chantierId);
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
          await ajouterMaterielAction(chantierId, libelle);
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "supprimer_materiel": {
          const id = String(donnees.id ?? "");
          const actuels = await listerMateriel(ctx, chantierId);
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
          const actuels = await listerMateriel(ctx, chantierId);
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
          await mettreAJourDureeEquipeAction(chantierId, { dureePrevue: nouvelleDuree });
          resultats.push({ ...base, statut: "appliquee" });
          break;
        }
        case "modifier_equipe": {
          const nouvelleEquipe = String(donnees.nouvelleEquipe ?? "").trim();
          if (!nouvelleEquipe) {
            resultats.push({ ...base, statut: "conflit", categorie: "donnee_invalide", message: "Nouvelle équipe manquante." });
            break;
          }
          await mettreAJourDureeEquipeAction(chantierId, { tailleEquipe: nouvelleEquipe });
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
          // Remédiation (transaction) : un seul appel, une seule transaction —
          // jamais de ligne vide intermédiaire.
          await ajouterLignePrixDirectAction(chantierId, libelle, montant);
          uneLigneDePrixAjoutee = true;
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
          await ajouterLignePrixDirectAction(chantierId, origine.libelle, origine.montant);
          uneLigneDePrixAjoutee = true;
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
  if (uneLigneDePrixAjoutee) {
    try {
      await chargerDevisAction(chantierId);
    } catch (err) {
      logger.error("Régénération du devis échouée après application d'une proposition", { chantierId, erreur: err });
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
  const resultat = await preparerDevisDepuisDictee(ctx, chantierId, { remplacer });

  if (resultat.statut === "prepare") {
    // Les quatre écrans que l'enchaînement vient de modifier. Sans cela, le
    // patron revient sur « Informations » et y trouve la page d'avant : il
    // croirait que rien ne s'est passé.
    revalidatePath(`/chantiers/${chantierId}`);
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
  const resultat = await enregistrerPrecisionsEtReprendre(ctx, chantierId, reponses);

  if (resultat.statut === "prepare") {
    revalidatePath(`/chantiers/${chantierId}`);
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
