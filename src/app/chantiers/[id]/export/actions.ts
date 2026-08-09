"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { getOuCreerDevisBrouillon, envoyerDevis } from "@/server/repositories/devis";
import { listerPrestations } from "@/server/repositories/prestations";
import { ingererDevis } from "@/server/documents/ingestion";
import { preparerEnvoi, verifierJourPropose } from "@/server/repositories/preparation-envoi";
import { creerEnvoi, DatesProposeesInvalidesError } from "@/server/repositories/envois-devis";
import { mettreAJourClient } from "@/server/repositories/clients";

export async function chargerDevisAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  const devis = await getOuCreerDevisBrouillon(ctx, chantierId);
  const prestations = await listerPrestations(ctx, chantierId);
  return { devis, prestations: prestations.map((p) => p.libelle) };
}

export async function envoyerDevisAction(devisId: string) {
  const ctx = await getCurrentCtx();
  const resultat = await envoyerDevis(ctx, devisId);
  try {
    // Base documentaire (lot IA-07) : rend le devis envoyé recherchable par
    // l'assistant. Un échec d'ingestion ne doit jamais faire échouer l'envoi.
    if (resultat.chantierId) await ingererDevis(ctx, resultat.chantierId);
  } catch {
    // Volontairement silencieux : voir commentaire ci-dessus.
  }
  return resultat;
}

/**
 * Rouvre un devis pour le corriger et le renvoyer.
 *
 * Un refus n'est pas une fin : c'est souvent une négociation qui commence
 * (docs/AGENT.md §2.2). Sans ce chemin, un devis retourné restait retourné pour
 * toujours, et le chantier avec lui.
 *
 * La nouvelle version reprend le numéro commercial et les lignes de prix
 * courantes — corriger un prix se fait donc à l'écran Prix, comme d'habitude,
 * et non ici.
 */
export async function reprendreDevisAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  const devis = await getOuCreerDevisBrouillon(ctx, chantierId);
  return { devisId: devis.id, numeroVersion: devis.numeroVersion };
}

// --- Envoi au client : la seule question posée au patron (docs/AGENT.md §2.2) ---

/**
 * `dureeDemiJournees` : la durée que le patron a éventuellement corrigée à
 * l'écran. Elle commande les jours proposables — une demi-journée tient là où
 * une journée entière ne tient plus — donc l'écran rappelle cette action à
 * chaque changement.
 */
export async function preparerEnvoiAction(chantierId: string, dureeDemiJournees?: number) {
  const ctx = await getCurrentCtx();
  return preparerEnvoi(ctx, chantierId, new Date(), dureeDemiJournees);
}

/**
 * Ce jour-là peut-il accueillir ce chantier ?
 *
 * Sert la case « Une autre date… » : le patron choisit un jour au calendrier,
 * et l'écran lui répond aussitôt — oui, ou pourquoi non, avec le jour libre le
 * plus proche. Sans cette réponse immédiate, il découvrirait le refus après
 * avoir composé son message, ce qui coûte un aller-retour avec son client.
 *
 * La règle est celle du dépôt, pas une seconde version : proposer une date que
 * l'envoi refuserait ensuite serait pire que ne rien proposer.
 */
export async function verifierJourProposeAction(
  chantierId: string,
  jour: string,
  dureeDemiJournees?: number
) {
  const ctx = await getCurrentCtx();
  return verifierJourPropose(ctx, chantierId, jour, dureeDemiJournees);
}

export type ResultatEnvoiClient =
  | { succes: true; lien: string; canal: "sms" | "email"; destinataire: string | null }
  | { succes: false; erreur: string };

/**
 * Marque le devis comme envoyé, crée le lien destiné au client et place le
 * chantier en attente de réponse.
 *
 * Le lien est RENVOYÉ à l'appelant plutôt qu'expédié : aucun fournisseur de SMS
 * ni d'e-mail n'est encore branché (voir docs/AGENT.md §5). En attendant, le
 * patron peut le transmettre lui-même — ce qui est préférable à un envoi qui
 * échouerait en silence.
 */
export async function envoyerAuClientAction(
  chantierId: string,
  devisId: string,
  datesProposees: string[],
  dureeDemiJournees?: number
): Promise<ResultatEnvoiClient> {
  const ctx = await getCurrentCtx();

  const preparation = await preparerEnvoi(ctx, chantierId, new Date(), dureeDemiJournees);
  if (preparation.blocage === "canal_absent") {
    return {
      succes: false,
      erreur: "Indiquez d'abord comment joindre ce client — par SMS ou par e-mail.",
    };
  }
  if (preparation.blocage === "coordonnee_absente") {
    return {
      succes: false,
      erreur:
        preparation.canal === "sms"
          ? "Ce client n'a pas de numéro de téléphone enregistré."
          : "Ce client n'a pas d'adresse e-mail enregistrée.",
    };
  }
  if (!preparation.canal) {
    return { succes: false, erreur: "Impossible de préparer l'envoi pour ce chantier." };
  }

  if (datesProposees.length < 1 || datesProposees.length > 2) {
    return { succes: false, erreur: "Proposez une date, ou deux au choix du client." };
  }

  // L'envoi du devis (PDF figé) précède la création du lien : c'est ce PDF dont
  // on prend l'empreinte, et c'est lui que le client acceptera.
  //
  // **Sa raison d'échouer ne doit pas se perdre.** Le 7 août 2026, le patron :
  // « je ne peux pas envoyer au client ». Son écran affichait « L'envoi n'a pas
  // pu être préparé. » — la phrase de secours du navigateur, celle qui s'affiche
  // quand l'action a LANCÉ une erreur au lieu d'en rendre une. Le serveur savait
  // pourquoi (« ce devis a déjà été envoyé », « devis introuvable », un PDF
  // impossible à composer) ; rien ne le lui a dit, et rien ne me l'a dit non
  // plus. Une erreur qui n'accuse personne coûte deux échanges à chaque fois.
  let devisEnvoye: Awaited<ReturnType<typeof envoyerDevisAction>>;
  try {
    devisEnvoye = await envoyerDevisAction(devisId);
  } catch (err) {
    return { succes: false, erreur: raisonLisible(err) };
  }

  try {
    const envoi = await creerEnvoi(ctx, {
      chantierId,
      devisId,
      canal: preparation.canal,
      datesProposees,
      contenuDevis: `${devisEnvoye.numeroCommercial}|${devisEnvoye.numeroVersion}|${devisEnvoye.totalTtc}`,
      // La durée réellement retenue, telle que l'écran l'a affichée : c'est sur
      // elle que les dates proposables ont été calculées, et c'est elle qui sera
      // réservée quand le client aura choisi.
      dureeDemiJournees: preparation.dureeDemiJournees,
    });
    return {
      succes: true,
      lien: `/devis/${envoi.jeton}`,
      canal: preparation.canal,
      destinataire: preparation.destinataire,
    };
  } catch (err) {
    if (err instanceof DatesProposeesInvalidesError) {
      return {
        succes: false,
        erreur: "Une des dates proposées n'est plus libre. Choisissez-en une autre.",
      };
    }
    // Plus rien ne sort d'ici sans sa raison : voir le commentaire ci-dessus.
    return { succes: false, erreur: raisonLisible(err) };
  }
}

/**
 * La phrase que le patron lira, tirée de ce qui s'est réellement passé.
 *
 * Les erreurs du dépôt sont déjà écrites pour lui — « Ce devis a déjà été
 * envoyé. », « Devis introuvable » — et valent mille fois mieux qu'un « l'envoi
 * n'a pas pu être préparé » qui n'apprend rien. Celles qui ne le sont pas
 * (panne de stockage, base injoignable) reçoivent une phrase de secours qui dit
 * au moins où regarder.
 */
function raisonLisible(err: unknown): string {
  const message = err instanceof Error ? err.message.trim() : "";
  if (!message) return "L'envoi n'a pas abouti. Réessayez, et dites-le si cela recommence.";
  // Tronqué : une pile d'appels dans un bandeau n'aide personne, et une erreur
  // technique complète peut porter des détails d'infrastructure.
  return message.length > 200 ? `${message.slice(0, 199)}…` : message;
}

/**
 * Enregistre la coordonnée manquante d'un client, depuis l'écran Devis.
 *
 * **Pourquoi ici.** Il n'existe aucun écran de fiche client : le téléphone et
 * l'e-mail ne se saisissent qu'à la création du chantier. Un patron qui veut
 * envoyer par e-mail un devis dont le client n'a qu'un numéro était donc
 * bloqué, sans issue nulle part. La coordonnée est conservée sur la fiche —
 * pas seulement pour cet envoi — pour ne pas la redemander au chantier suivant.
 *
 * Le canal convenu est mis à jour du même geste : c'est bien par là que le
 * patron a choisi de le joindre.
 */
export async function enregistrerCoordonneeClientAction(
  clientId: string,
  canal: "sms" | "email",
  valeur: string
) {
  const ctx = await getCurrentCtx();
  const propre = valeur.trim().slice(0, 200);
  if (!propre) return { succes: false as const };
  await mettreAJourClient(ctx, clientId, {
    canalCommunication: canal,
    ...(canal === "sms" ? { telephone: propre } : { email: propre }),
  });
  return { succes: true as const };
}
