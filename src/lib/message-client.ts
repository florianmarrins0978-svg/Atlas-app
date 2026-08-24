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

import { avecCivilite, type CiviliteChoisie } from "./civilite";

export type CanalClient = "sms" | "email";

export type MessageClient = {
  objet: string;
  corps: string;
};

/* ═══ SON MESSAGE, ÉCRIT PAR LUI — sa décision du 23 août 2026 ═══════════
 *
 * *« Y a-t-il un endroit dans les réglages où l'utilisateur peut rédiger ce
 * message automatique ? S'il n'y en a pas, il faut en créer un. »* Il n'y en
 * avait pas : ce texte vivait ici, en dur, identique pour tout le monde.
 *
 * **Trois choses qu'il a tranchées, et qui commandent tout ce qui suit :**
 *
 *   1. le réglage vit dans « Devis & factures » (sa réponse : A) ;
 *   2. **le lien est OBLIGATOIRE** — Atlas REFUSE d'enregistrer un message qui
 *      ne le porte pas, il ne se contente pas de prévenir. Sans lui, le message
 *      part et le client ne peut rien ouvrir : ce serait un envoi perdu, et le
 *      patron ne l'apprendrait qu'au téléphone ;
 *   3. **UN SEUL message pour ses trois documents** — devis, facture, compte
 *      rendu de passage.
 *
 * **Et c'est la troisième qui demande `[document]`.** Un texte unique et
 * littéral ferait dire à sa facture *« Voici votre devis, choisissez votre date
 * d'intervention »*, et l'échéance disparaîtrait. Il l'a vu en images, sur les
 * six bulles de `appli/mon-message-au-client.html`, et a répondu : **« façon
 * 1 »** — il écrit le cadre, Atlas pose la phrase du milieu.
 */

/** Ce qu'Atlas remplace. Une pastille inconnue reste telle quelle, en clair. */
export const PASTILLES = ["[client]", "[document]", "[lien]", "[entreprise]"] as const;

/**
 * Le message tant qu'il n'a rien écrit — et c'est SON message d'aujourd'hui.
 *
 * `null` en base veut dire « celui-ci » : recopier ce texte dans la colonne à
 * la création d'une entreprise l'y figerait, et le jour où l'on corrige une
 * virgule, les anciennes garderaient l'ancienne version sans que personne ne
 * s'en aperçoive.
 */
export const MESSAGE_PAR_DEFAUT = [
  "Bonjour [client],",
  "",
  "[document]",
  // **Une ligne vide de chaque côté, et le lien SEUL sur la sienne.** Le patron,
  // le 10 août 2026 : *« le lien n'est pas cliquable, je suis obligé de le
  // copier »*. Collé sous une phrase, un lien est lu par beaucoup de messageries
  // comme la suite du paragraphe ; isolé, il redevient une adresse à leurs yeux.
  "",
  "[lien]",
  "",
  "Bien à vous,",
  "[entreprise]",
].join("\n");

/**
 * La borne. Un message est un message, pas une lettre.
 *
 * Tronquer serait pire que refuser ici — à l'inverse de la note de chantier :
 * un message coupé part QUAND MÊME, et c'est le client qui lit la moitié d'une
 * phrase. On refuse donc, et l'écran le dit avant l'enregistrement.
 */
export const MESSAGE_MAX = 2000;

/**
 * Pourquoi ce message ne peut pas être enregistré — ou `null` s'il le peut.
 *
 * **Rend une phrase, jamais une exception** : le message d'une exception levée
 * par une action serveur n'arrive jamais jusqu'au patron (`HANDOVER.md`,
 * piège 0 ter). Et c'est la MÊME fonction qui sert l'écran et le serveur : deux
 * règles pour un seul refus finiraient par diverger, et il verrait un bouton
 * allumé sur un message que le serveur rejette.
 */
export function refusDuMessage(modele: string): string | null {
  const texte = modele.trim();
  if (!texte) return "Écrivez votre message : il ne peut pas être vide.";
  if (modele.length > MESSAGE_MAX) {
    return `Votre message dépasse ${MESSAGE_MAX} caractères. Raccourcissez-le pour l'enregistrer.`;
  }
  if (!modele.includes("[lien]")) {
    return (
      "Le lien est obligatoire : sans lui, votre client ne peut ni ouvrir son " +
      "document ni choisir sa date. Reposez-le pour enregistrer."
    );
  }
  return null;
}

/**
 * La phrase du milieu — celle qu'Atlas pose à la place de `[document]`.
 *
 * **Elle porte tout ce qui distingue les trois envois**, et c'est pour cela
 * qu'elle n'est pas dans son texte : le numéro de la facture, son échéance, et
 * le fait qu'un devis se répond quand une facture se règle.
 *
 * **La phrase du devis a changé le 23 août 2026, et il faut le savoir.** Elle
 * tenait en deux morceaux — l'un avant le lien, l'autre après (« si aucune des
 * dates proposées ne vous convient… »). Un seul emplacement ne peut pas porter
 * les deux : les deux idées sont donc réunies en une phrase, avant le lien.
 * Rien n'est perdu, et le « vous POUVEZ » qu'il avait corrigé le 13 août reste.
 */
export function phraseDuDocument(
  doc:
    | { genre: "devis" }
    | { genre: "facture"; numero: string; echeanceLisible?: string | null }
    | { genre: "entretien" }
): string {
  if (doc.genre === "devis") {
    // **SES DEUX PHRASES SURVIVENT MOT POUR MOT, et un contrôle l'exige.**
    // Un premier jet les avait fondues en une seule — « ou en proposer une autre
    // si aucune ne vous convient » — et `test-message-client` a rougi : il
    // défend le « vous POUVEZ » qu'il a corrigé lui-même le 13 août 2026, le
    // futur repoussant le geste à plus tard. On réordonne, on ne réécrit pas.
    return (
      "Voici votre devis. Vous pouvez le consulter et choisir votre date " +
      "d'intervention — et si aucune des dates proposées ne vous convient, " +
      "vous pouvez en proposer une autre. Tout se fait sur cette page :"
    );
  }
  if (doc.genre === "facture") {
    const echeance = doc.echeanceLisible ? `, à régler avant le ${doc.echeanceLisible}` : "";
    return (
      `Voici votre facture ${doc.numero}${echeance}. ` +
      "Vous pouvez la consulter et la télécharger ici :"
    );
  }
  return "Voici le compte rendu de mon passage chez vous :";
}

/**
 * Le message final, pastilles remplacées.
 *
 * **Une seule fonction pour l'aperçu et pour l'envoi.** L'écran des réglages
 * montre ce que le client recevra en appelant celle-ci ; s'il en avait une
 * copie, l'aperçu et le vrai message finiraient par ne plus dire la même chose
 * — et c'est le second que le client lit (`CLAUDE.md` §3).
 */
export function rendreMessage(
  modele: string,
  valeurs: { client: string; document: string; lien: string; entreprise: string }
): string {
  const rendu = modele
    .replace(/\[client\]/g, valeurs.client)
    .replace(/\[document\]/g, valeurs.document)
    .replace(/\[lien\]/g, valeurs.lien)
    .replace(/\[entreprise\]/g, valeurs.entreprise);

  // **UN CLIENT SANS NOM NE DOIT PAS DONNER « Bonjour , ».**
  //
  // Il arrive : un chantier créé au vol, un client nommé plus tard. Le message
  // par défaut écrit « Bonjour [client], » — la virgule est à lui, pas à nous.
  // Une pastille vide laisse donc une espace orpheline devant elle, et c'est le
  // client qui la lit.
  //
  // **Le nettoyage ne s'applique QUE dans ce cas**, et c'est important : le
  // français met une espace insécable devant « ; », « : », « ! » et « ? », et
  // rogner à tout coup abîmerait ce qu'il a tapé lui-même.
  if (valeurs.client === "") return rendu.replace(/[ \t]+,/g, ",").replace(/[ \t]{2,}/g, " ");
  return rendu;
}

/** « Bonjour Mr. Martins, », ou « Bonjour, » quand on ne sait pas son nom. */
function nommer(clientNom: string, clientCivilite?: CiviliteChoisie): string {
  // **La civilité vient de `src/lib/civilite.ts`** — la même qui nomme le client
  // sur l'écran du devis. La recopier ici ferait dire « Mr. Martins » à l'écran
  // et « Martins » dans le message que le client reçoit, c'est-à-dire au seul
  // endroit qui compte (le patron, le 13 août 2026).
  return clientNom.trim() ? avecCivilite(clientNom, clientCivilite) : "";
}

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
  /** Ce qu'il a choisi. Absent : la règle d'avant le 13 août 2026 s'applique. */
  clientCivilite?: CiviliteChoisie;
  entrepriseNom: string;
  lien: string;
  /** Son message, s'il en a écrit un. Absent : `MESSAGE_PAR_DEFAUT`. */
  modele?: string | null;
}): MessageClient {
  const { clientNom, clientCivilite, entrepriseNom, lien, modele } = params;
  return {
    // **L'objet ne se règle pas, et c'est délibéré.** Il ne se lit que par
    // courriel — jamais par SMS —, il doit rester reconnaissable dans une boîte
    // de réception, et un objet vide ou trompeur envoie le message aux
    // indésirables. Ce qu'il écrit, c'est le corps.
    objet: `Votre devis — ${entrepriseNom}`,
    corps: rendreMessage(modele?.trim() || MESSAGE_PAR_DEFAUT, {
      client: nommer(clientNom, clientCivilite),
      document: phraseDuDocument({ genre: "devis" }),
      lien,
      entreprise: entrepriseNom,
    }),
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
  clientCivilite?: CiviliteChoisie;
  entrepriseNom: string;
  numeroFacture: string;
  echeanceLisible?: string | null;
  lien: string;
  modele?: string | null;
}): MessageClient {
  const { clientNom, clientCivilite, entrepriseNom, numeroFacture, echeanceLisible, lien, modele } =
    params;
  return {
    objet: `Votre facture ${numeroFacture} — ${entrepriseNom}`,
    corps: rendreMessage(modele?.trim() || MESSAGE_PAR_DEFAUT, {
      client: nommer(clientNom, clientCivilite),
      // **L'échéance entre dans la phrase du document, avant le lien.** Elle
      // vivait après lui, sur sa propre ligne ; un seul emplacement ne peut pas
      // porter les deux, et c'est la seule chose que le client doit savoir sans
      // ouvrir la pièce.
      document: phraseDuDocument({ genre: "facture", numero: numeroFacture, echeanceLisible }),
      lien,
      entreprise: entrepriseNom,
    }),
  };
}

/**
 * Compose le message remettant le compte rendu de passage au client.
 *
 * **Même forme que le devis et la facture, et c'est le sujet.** Un client
 * abordé « Bonjour Mr. Martins » sur son devis et « Bonjour Martins » sur son
 * compte rendu douterait que les deux viennent du même artisan. Le lien reste
 * seul sur sa ligne, entre deux lignes vides — sans quoi les messageries ne le
 * rendent pas cliquable (payé le 10 août 2026).
 *
 * **Aucun prix, aucune facture évoquée.** Un compte rendu de passage dit ce qui
 * a été fait, rien d'autre : mêler les deux ferait lire une relance là où il
 * n'y en a pas.
 */
export function composerMessageEntretien(params: {
  clientNom: string;
  clientCivilite?: CiviliteChoisie;
  entrepriseNom: string;
  lien: string;
  modele?: string | null;
}): MessageClient {
  const { clientNom, clientCivilite, entrepriseNom, lien, modele } = params;
  return {
    objet: `Compte rendu de passage — ${entrepriseNom}`,
    corps: rendreMessage(modele?.trim() || MESSAGE_PAR_DEFAUT, {
      client: nommer(clientNom, clientCivilite),
      document: phraseDuDocument({ genre: "entretien" }),
      lien,
      entreprise: entrepriseNom,
    }),
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

/**
 * Par quel canal joindre ce client — **sans jamais en inventer un**.
 *
 * **Écrit le 20 août 2026, après son défaut** : *« sur la fiche client j'ai
 * choisi d'envoyer le devis par email […] c'est l'application SMS qui s'est
 * ouverte »*. La cause principale était ailleurs (deux sources pour un même
 * canal, voir `DevisCompletClient`), mais les écrans portaient aussi un
 * `?? "sms"` écrit à la main : un client qui n'a QU'UNE adresse e-mail et
 * aucun canal convenu se voyait proposer un SMS, vers un numéro qui n'existe
 * pas.
 *
 * L'ordre, et il n'a rien d'arbitraire :
 *
 *   1. **le canal convenu**, si la coordonnée correspondante existe — c'est un
 *      accord avec la personne, il prime sur toute déduction ;
 *   2. **la seule coordonnée renseignée**, s'il n'y en a qu'une — deviner est
 *      ici sans risque, il n'existe pas d'autre chemin ;
 *   3. sinon **`null`** : on ne sait pas, et on le dit. L'envoi est de toute
 *      façon bloqué en amont tant qu'aucun canal n'est convenu
 *      (`preparerEnvoi`, blocage « canal_absent »).
 *
 * C'est la même règle que le formulaire de création de chantier applique déjà
 * pour proposer un canal ; l'écrire une fois évite qu'elles ne divergent.
 */
export function canalPourJoindre(client: {
  canal?: CanalClient | null;
  telephone?: string | null;
  email?: string | null;
}): CanalClient | null {
  const aTelephone = Boolean(client.telephone?.trim());
  const aEmail = Boolean(client.email?.trim());
  if (client.canal === "sms" && aTelephone) return "sms";
  if (client.canal === "email" && aEmail) return "email";
  if (aTelephone && !aEmail) return "sms";
  if (aEmail && !aTelephone) return "email";
  return null;
}
