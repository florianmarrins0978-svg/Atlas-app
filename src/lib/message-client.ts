// Ce que le patron transmet au client pour lui remettre son devis.
//
// Fonction pure, hors de tout écran : le même message sert à construire le
// bouton, à l'éprouver, et servira demain à l'envoi automatique. Deux
// implémentations finiraient par diverger, et c'est le client qui lirait la
// mauvaise.
//
// Pourquoi ce chemin existe alors qu'Atlas doit envoyer lui-même : aucun
// prestataire d'e-mail ni de SMS n'est raccordé (docs/A-FAIRE.md §5), et cela
// suppose un abonnement ET un nom de domaine — deux achats. En attendant, le
// message part de la boîte du patron, comme il le faisait sur Arborea. Atlas
// prépare, le patron expédie.
//
// Ce que ce chemin ne donne pas, et qu'il faut assumer : Atlas ne sait pas que
// le message est parti, ni quand. Donc pas de relance automatique à sept jours.
// La réponse du client, elle, revient normalement : il répond sur la page web,
// pas par retour de courrier.

export type CanalClient = "sms" | "email";

export type MessageClient = {
  objet: string;
  corps: string;
};

/**
 * Compose le message remettant le devis au client.
 *
 * Volontairement sobre et sans engagement commercial : ce texte part au nom du
 * patron, et rien de ce qu'il n'aurait pas écrit lui-même n'y figure. Aucun
 * prix n'y est répété — il est dans le devis, et deux endroits finiraient par
 * se contredire.
 */
export function composerMessageClient(params: {
  clientNom: string;
  entrepriseNom: string;
  lien: string;
}): MessageClient {
  const { clientNom, entrepriseNom, lien } = params;

  const bonjour = clientNom.trim() ? `Bonjour ${clientNom.trim()},` : "Bonjour,";

  return {
    objet: `Votre devis — ${entrepriseNom}`,
    corps: [
      bonjour,
      "",
      "Voici votre devis. Vous pouvez le consulter et choisir votre date d'intervention en suivant ce lien :",
      lien,
      "",
      "Si aucune des dates proposées ne vous convient, vous pourrez en proposer une autre.",
      "",
      "Bien à vous,",
      entrepriseNom,
    ].join("\n"),
  };
}

/**
 * Adresse `mailto:` ou `sms:` ouvrant l'application du patron, message prêt.
 *
 * Le destinataire peut manquer : le message s'ouvre alors sans lui plutôt que
 * de ne pas s'ouvrir du tout — le patron le complète, il connaît son client.
 *
 * `sms:` porte le corps dans `body`, avec un point-virgule avant le `?` sur
 * iOS. La forme `?&body=` est celle qui fonctionne des deux côtés : sans elle,
 * iOS ouvre bien Messages mais laisse le texte de côté, et le patron envoie un
 * SMS vide sans s'en apercevoir.
 */
export function lienTransmission(params: {
  canal: CanalClient;
  destinataire: string | null;
  message: MessageClient;
}): string {
  const { canal, destinataire, message } = params;
  const cible = destinataire?.trim() ?? "";

  if (canal === "sms") {
    // Le numéro est saisi à la main sur la fiche du client, donc espacé :
    // « 06 12 34 56 78 » — c'est même la forme que propose le champ. Laissé
    // tel quel, chaque espace part en %20 dans l'adresse et l'application de
    // messagerie n'y reconnaît plus un numéro : elle ouvre un message SANS
    // destinataire, sans rien signaler. Le patron le découvre dans Messages,
    // c'est-à-dire trop tard.
    //
    // L'objet, lui, n'existe pas en SMS : tout tient dans le corps.
    const numero = cible.replace(/[\s.()-]/g, "");
    return `sms:${numero}?&body=${encodeURIComponent(message.corps)}`;
  }

  return (
    `mailto:${encodeURIComponent(cible)}` +
    `?subject=${encodeURIComponent(message.objet)}` +
    `&body=${encodeURIComponent(message.corps)}`
  );
}
