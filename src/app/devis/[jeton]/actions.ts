"use server";

import { headers } from "next/headers";
import { enregistrerReponse } from "@/server/repositories/envois-devis";
import { logger } from "@/server/logger";

export type EtatReponse = { erreur: string } | { succes: string } | undefined;

// Première adresse de X-Forwarded-For : celle du client vue par le proxy de
// tête. Élément de preuve d'appoint — elle documente l'acceptation, elle ne la
// fonde pas.
function adresseClient(entetes: Headers): string | null {
  const transmis = entetes.get("x-forwarded-for");
  if (transmis) {
    const premiere = transmis.split(",")[0]?.trim();
    if (premiere) return premiere;
  }
  return entetes.get("x-real-ip");
}

const MESSAGES: Record<string, string> = {
  introuvable: "Ce lien n'est plus valable. Contactez votre artisan pour en recevoir un nouveau.",
  expire: "Ce lien a expiré. Contactez votre artisan pour en recevoir un nouveau.",
  deja_repondu: "Vous avez déjà répondu à ce devis.",
  // Message volontairement actionnable : le client doit comprendre qu'il peut
  // recommencer, et que son intérêt pour le devis n'est pas perdu.
  date_indisponible:
    "Cette date vient d'être retenue par ailleurs. Choisissez-en une autre — votre accord sur le devis reste valable.",
  date_manquante: "Choisissez une date d'intervention avant de valider.",
  message_manquant: "Dites en un mot ce qui doit être corrigé : sans cela, votre artisan ne saura pas quoi reprendre.",
};

export async function repondreAction(
  _etatPrecedent: EtatReponse,
  formData: FormData
): Promise<EtatReponse> {
  const jeton = String(formData.get("jeton") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (decision !== "accepte" && decision !== "refuse" && decision !== "correction") {
    return { erreur: "Indiquez si vous acceptez ce devis." };
  }

  const entetes = await headers();
  const preuve = {
    adresseIp: adresseClient(entetes),
    agentUtilisateur: entetes.get("user-agent"),
  };

  // Le message du client, borné pour ne pas transformer une précision en
  // réceptacle. Lu avant la décision : une demande de correction sans message
  // ne dit rien au patron, et c'est le dépôt qui la refusera.
  const precisionBrute = String(formData.get("precision") ?? "").trim();
  const precision = precisionBrute ? precisionBrute.slice(0, 500) : null;

  if (decision === "correction") {
    const r = await enregistrerReponse(jeton, { decision: "correction" as const, precision, ...preuve });
    if (!r.succes) return { erreur: MESSAGES[r.motif] ?? "Impossible d'enregistrer votre demande." };
    logger.info("Correction demandée par le client");
    return {
      succes: "Votre demande est transmise. Votre artisan corrigera le devis et vous le renverra.",
    };
  }

  if (decision === "refuse") {
    const r = await enregistrerReponse(jeton, { decision: "refuse" as const, precision, ...preuve });
    if (!r.succes) return { erreur: MESSAGES[r.motif] ?? "Impossible d'enregistrer votre réponse." };
    logger.info("Devis refusé par le client");
    // Pas de revalidatePath ici : re-rendre la page la ferait basculer sur
    // l'écran « déjà répondu » et remplacerait le formulaire AVANT que le
    // client ait vu sa confirmation. Il la verra au prochain chargement, s'il
    // revient — c'est le rôle de cet écran, pas celui de cet instant.
    return { succes: "Votre réponse a bien été transmise." };
  }

  // « proposee » désigne l'une des dates offertes ; « autre » bascule sur le
  // calendrier. On ne devine jamais l'intention : sans choix explicite, on
  // redemande.
  const choix = String(formData.get("choixDate") ?? "");
  const dateRetenue = choix === "autre" ? String(formData.get("dateAutre") ?? "") : choix;
  if (!dateRetenue) return { erreur: MESSAGES.date_manquante };

  const r = await enregistrerReponse(jeton, {
    decision: "accepte" as const,
    dateRetenue,
    precision,
    demarrageAnticipe: formData.get("demarrageAnticipe") === "oui",
    ...preuve,
  });

  if (!r.succes) return { erreur: MESSAGES[r.motif] ?? "Impossible d'enregistrer votre réponse." };

  logger.info("Devis accepté par le client", { contreProposee: r.contreProposee });
  return { succes: "C'est noté. Votre artisan est prévenu." };
}
