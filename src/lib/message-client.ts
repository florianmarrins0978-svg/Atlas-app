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

import { avecCivilite } from "./civilite";

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

  // **« Bonjour Mr. Martins », et non « Bonjour Martins ».** Le patron, le
  // 13 août 2026, capture du SMS à l'appui : *« pareil pour le message tout
  // prêt, c'est Bonjour Mr Martins »*. La civilité vient de
  // `src/lib/civilite.ts` — la même qui nomme le client sur l'écran du devis.
  // La recopier ici ferait dire « Mr. Martins » à l'écran et « Martins » dans
  // le message que le client reçoit, c'est-à-dire au seul endroit qui compte.
  const bonjour = clientNom.trim() ? `Bonjour ${avecCivilite(clientNom)},` : "Bonjour,";

  return {
    objet: `Votre devis — ${entrepriseNom}`,
    corps: [
      bonjour,
      "",
      "Voici votre devis. Vous pouvez le consulter et choisir votre date d'intervention en suivant ce lien :",
      // **Une ligne vide de chaque côté, et le lien SEUL sur la sienne.**
      // Le patron, le 10 août 2026 : *« le lien n'est pas cliquable, je suis
      // obligé de le copier »*. Collé juste sous sa phrase, un lien est lu par
      // beaucoup de messageries comme la suite du paragraphe : elles n'y
      // reconnaissent plus une adresse et ne le rendent pas cliquable. Isolé
      // entre deux lignes vides, il redevient une adresse à leurs yeux.
      //
      // Rien de mieux n'est possible tant que le message part en texte brut :
      // `mailto:` ne transporte pas de HTML, donc pas de vrai lien habillé.
      // Le jour où Atlas enverra lui-même (docs/A-FAIRE.md §5), ce sera un
      // bouton.
      "",
      lien,
      "",
            // **« vous POUVEZ », et non « vous pourrez ».** Sa correction du 13 août
      // 2026. Le futur repoussait le geste à plus tard, comme s'il fallait
      // d'abord faire autre chose ; le présent dit que c'est possible tout de
      // suite, sur la page qu'il vient d'ouvrir.
      "Si aucune des dates proposées ne vous convient, vous pouvez en proposer une autre.",
      "",
      "Bien à vous,",
      entrepriseNom,
    ].join("\n"),
  };
}

/**
 * Compose le message remettant la FACTURE au client.
 *
 * Même sobriété que pour le devis, et pour la même raison : ce texte part au
 * nom du patron. Le montant n'y est pas répété — il est sur la facture, et deux
 * endroits finiraient par se contredire. L'échéance, si — c'est la seule chose
 * que le client doit savoir sans ouvrir la pièce jointe.
 */
export function composerMessageFacture(params: {
  clientNom: string;
  entrepriseNom: string;
  numeroFacture: string;
  echeanceLisible?: string | null;
  lien: string;
}): MessageClient {
  const { clientNom, entrepriseNom, numeroFacture, echeanceLisible, lien } = params;
  // Même civilité que le devis (`src/lib/civilite.ts`) : un client abordé
  // « Mr. Martins » sur son devis et « Martins » sur sa facture douterait
  // qu'elles viennent du même artisan.
  const bonjour = clientNom.trim() ? `Bonjour ${avecCivilite(clientNom)},` : "Bonjour,";

  return {
    objet: `Votre facture ${numeroFacture} — ${entrepriseNom}`,
    corps: [
      bonjour,
      "",
      `Voici votre facture ${numeroFacture}. Vous pouvez la consulter et la télécharger ici :`,
      // Isolé entre deux lignes vides, comme pour le devis, et pour la même
      // raison : sans cela les messageries ne le rendent pas cliquable.
      "",
      lien,
      "",
      ...(echeanceLisible ? [`Elle est à régler avant le ${echeanceLisible}.`, ""] : []),
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
