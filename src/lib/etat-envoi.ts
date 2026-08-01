// Où en est le devis d'un chantier, du point de vue du patron.
//
// Une seule fonction, pure, lue par la liste des chantiers, la fiche et le
// planning. Trois écrans qui déduiraient chacun cet état à leur façon finiraient
// par se contredire — et c'est précisément sur cet état que le patron décide
// s'il doit relancer, replanifier ou ne rien faire.
//
// Voir docs/AGENT.md §2.2 : tant que le client n'a pas répondu, le chantier est
// BLOQUÉ. Ni planifié, ni facturable, ni à planifier soi-même.

/** Au bout de combien de jours sans réponse le patron doit songer à relancer. */
export const RELANCE_APRES_JOURS = 7;

export type EtatEnvoi =
  /** Aucun devis n'est parti. */
  | "non_envoye"
  /** Parti, le client n'a pas répondu, le lien est encore valable. */
  | "en_attente"
  /** Parti depuis assez longtemps pour qu'un silence mérite un coup de fil. */
  | "a_relancer"
  /** Le lien a expiré sans réponse : le devis ne vaut plus rien tel quel. */
  | "caduc"
  /** Le client a dit non. Souvent le début d'une négociation, pas une fin. */
  | "retourne"
  /** Le client a dit oui : le chantier porte sa date. */
  | "accepte";

export const etatEnvoiLabel: Record<EtatEnvoi, string> = {
  non_envoye: "Devis non envoyé",
  en_attente: "En attente de réponse",
  a_relancer: "À relancer",
  caduc: "Devis caduc",
  retourne: "Devis retourné",
  accepte: "Devis accepté",
};

/**
 * Une phrase qui dit au patron ce qu'il peut faire, pas seulement où il en est.
 *
 * Un libellé d'état seul laisse la question ouverte : « en attente », et
 * alors ? Ces phrases répondent, y compris quand la réponse est « rien ».
 */
export const etatEnvoiExplication: Record<EtatEnvoi, string> = {
  non_envoye: "Le client n'a rien reçu.",
  en_attente: "Le client choisit sa date. Le chantier attend sa réponse.",
  a_relancer: "Sans nouvelles depuis une semaine. Un appel vaut mieux qu'un devis oublié.",
  caduc: "Le lien a expiré sans réponse. Il faut renvoyer le devis pour le remettre en jeu.",
  retourne: "Le client n'a pas donné suite. Le devis peut être repris et renvoyé.",
  accepte: "Le client a accepté. La date est retenue.",
};

export type EnvoiPourEtat = {
  /** `null` si aucun envoi n'existe pour ce chantier. */
  envoyeAt: Date | string | null;
  expireAt: Date | string | null;
  reponse: "acceptee" | "refusee" | null;
};

function versDate(v: Date | string | null): Date | null {
  if (v === null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * L'état du dernier envoi d'un chantier.
 *
 * L'ordre des tests n'est pas indifférent : une réponse tranche toujours, même
 * arrivée après l'expiration du lien. Un devis accepté la veille de sa
 * péremption reste accepté — le contraire ferait disparaître un engagement.
 */
export function etatEnvoi(envoi: EnvoiPourEtat | null, maintenant: Date = new Date()): EtatEnvoi {
  if (!envoi || !envoi.envoyeAt) return "non_envoye";

  if (envoi.reponse === "acceptee") return "accepte";
  if (envoi.reponse === "refusee") return "retourne";

  const expire = versDate(envoi.expireAt);
  if (expire && expire <= maintenant) return "caduc";

  const envoye = versDate(envoi.envoyeAt);
  if (envoye && maintenant.getTime() - envoye.getTime() >= RELANCE_APRES_JOURS * 86_400_000) {
    return "a_relancer";
  }

  return "en_attente";
}

/**
 * Le chantier attend-il quelque chose du client ?
 *
 * Sert à l'écran Planning : proposer de planifier soi-même un chantier dont le
 * client est en train de choisir sa date, c'est préparer un double engagement
 * sur le même jour.
 */
export function attendLeClient(etat: EtatEnvoi): boolean {
  return etat === "en_attente" || etat === "a_relancer";
}

/**
 * Le devis appelle-t-il un geste du patron ?
 *
 * Un refus, un silence trop long, un lien périmé : trois situations différentes
 * qui appellent la même chose — que quelqu'un s'en occupe. C'est ce que compte
 * la pastille de l'écran d'accueil.
 */
export function demandeUneAction(etat: EtatEnvoi): boolean {
  return etat === "retourne" || etat === "a_relancer" || etat === "caduc";
}
