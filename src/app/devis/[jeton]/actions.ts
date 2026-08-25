"use server";

import { headers } from "next/headers";
import { enregistrerReponse } from "@/server/repositories/envois-devis";
import { logger } from "@/server/logger";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { SOURCE_NON_ETABLIE } from "@/lib/source-visiteur";

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
  // Le patron n'a pas ouvert le calendrier sur cet envoi : la phrase le dit
  // sans accuser le client, et le renvoie vers ce qu'il peut faire.
  autre_date_refusee:
    "Votre artisan propose des dates précises pour ce chantier. Choisissez-en une, ou demandez-lui une correction en un mot.",
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

  /**
   * **LA SEULE ÉCRITURE D'ATLAS OUVERTE SANS SESSION — constat F9.**
   *
   * Partout ailleurs, une cadence se compte par entreprise ou par utilisateur,
   * parce qu'il y a quelqu'un de nommé. Ici, personne ne s'est nommé : c'est
   * un client qui ouvre le lien reçu par courriel. Cette action était donc la
   * seule à n'avoir aucune borne — non par oubli de principe, mais parce
   * qu'elle ne rentrait dans aucun des deux moules existants.
   *
   * **Ce n'est PAS un secret qu'on défend ici.** Le jeton fait 256 bits tirés
   * au sort : il ne se devine pas, et compter les essais n'y ajouterait rien.
   * Ce qu'on borne, c'est le coût — une lecture, une écriture, et parfois une
   * date de chantier posée, à chaque appel, gratuitement.
   *
   * **Le mécanisme est le CENTRAL, jamais un second.** Les seuils vivent dans
   * `LIMITES` avec tous les autres (`src/server/rate-limit/types.ts`) : un
   * compteur écrit ici serait invisible le jour où l'on cherche pourquoi une
   * cadence bloque.
   *
   * **La borne vient AVANT toute lecture en base**, sinon elle ne bornerait
   * que ce qui a déjà coûté.
   */
  /**
   * **LE SEUIL PAR SOURCE NE S'APPLIQUE QUE SI LA SOURCE EST ÉTABLIE — et
   * c'est la revue hostile de ce lot qui l'a imposé.**
   *
   * Sans `ATLAS_PROXY_SAUTS` posé, `sourceDuVisiteur` rend délibérément une
   * valeur commune : rien ne permet de savoir qui a écrit `x-forwarded-for`, et
   * deviner reviendrait à faire confiance à l'attaquant
   * (`src/lib/source-visiteur.ts`). Tous les clients partagent alors **un seul
   * seau**.
   *
   * Appliqué tel quel, ce seuil devenait une arme retournée : soixante appels
   * en une minute, depuis n'importe où, et PLUS AUCUN client de PLUS AUCUN
   * artisan ne peut signer son devis pendant ce temps. On aurait échangé une
   * dépense de calcul contre un blocage commercial — exactement ce que la
   * consigne du patron interdit : *« ne fais rien qui peut endommager
   * l'appli »*.
   *
   * Le seuil par JETON, lui, n'a pas ce défaut : il ne borne qu'un lien, celui
   * qu'on martèle. Il s'applique donc toujours.
   */
  const source = await sourceDuVisiteur(horsProductionReelle());
  const seuils: Array<readonly [string, { max: number; fenetreMs: number }]> = [
    [`reponse-devis:${jeton}`, LIMITES.reponseDevis],
  ];
  if (source !== SOURCE_NON_ETABLIE) {
    seuils.push([`reponse-devis:source:${source}`, LIMITES.reponseDevisParSource]);
  }

  for (const [cle, limite] of seuils) {
    const cadence = await verifierLimite(cle, limite);
    if (!cadence.autorise) {
      // **Le message ne dit pas « vous êtes bloqué », il dit quoi faire.** Le
      // client n'a rien à se reprocher, et il n'a aucun recours sur cet écran
      // : la seule chose utile est de lui dire d'attendre, et que son devis
      // l'attend toujours. C'est la leçon du 6 août 2026 — un refus muet fait
      // conclure que l'application est cassée.
      const minutes = Math.max(1, Math.ceil(cadence.retryAfterSecondes / 60));
      logger.warn("Cadence atteinte sur la réponse à un devis");
      return {
        erreur:
          `Trop de tentatives en peu de temps. Patientez ${minutes} minute${minutes > 1 ? "s" : ""}, ` +
          `puis recommencez : votre devis reste valable.`,
      };
    }
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
