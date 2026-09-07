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
 *   3. ~~un seul message pour ses trois documents~~ — **RENVERSÉ LE 7 SEPTEMBRE
 *      2026, par lui**, et ce fichier a été refait pour ça.
 *
 * ═══ TROIS MESSAGES, ET LA PHRASE DU MILIEU LUI APPARTIENT ═══════════════
 *
 * *« En fait il faut faire deux messages par défaut, un pour devis et un pour
 * facture »*, puis — le compte rendu de passage retrouvé — *« dans ce cas faut
 * faire 3 messages par défaut et garder le système un seul mot change »*.
 *
 * **Ce que la version d'avant coûtait, et qui l'a fait tomber :** la phrase qui
 * distingue les trois envois était écrite par Atlas et posée à l'endroit du
 * `[document]`. C'était le seul morceau de son message qu'il ne pouvait pas
 * toucher — et précisément celui qu'il voulait écrire.
 *
 * **Ce qui reste d'Atlas dans son texte** tient en cinq mots qui se remplissent
 * seuls : le prénom, le mot du document, le numéro, l'échéance, le lien, son
 * nom. **Deux ne se retirent pas** — le lien et le mot du document
 * (`refusDuMessage`) : sans le premier le client n'ouvre rien, sans le second il
 * ne sait pas s'il reçoit un devis à signer ou une facture à payer.
 */

/**
 * Ce qu'Atlas remplace. Une pastille inconnue reste telle quelle, en clair.
 *
 * **`[document]` A CHANGÉ DE SENS LE 7 SEPTEMBRE 2026, et c'est le cœur du
 * lot.** Il portait LA PHRASE ENTIÈRE du document — « Voici votre devis. Vous
 * pouvez le consulter et choisir votre date… » —, écrite par Atlas et
 * verrouillée. Le patron l'a fait sauter : *« il faut faire 3 messages par
 * défaut et garder le système un seul mot change »*. La phrase est donc
 * désormais DANS son modèle, en texte qu'il modifie, et `[document]` ne pose
 * plus que le mot — « devis », « facture », « compte rendu ».
 *
 * **Conséquence pour les messages déjà enregistrés**, et la migration 0075 s'en
 * charge : un modèle d'avant porte `[document]` au sens ancien, et le rendre
 * avec le nouveau enverrait au client un message qui dit « Voici votre devis »
 * réduit au seul mot « devis ». La migration y réécrit la phrase en clair.
 *
 * **`[numero]` et `[echeance]` sont nouveaux**, et l'échéance EMPORTE SES MOTS :
 * elle rend « , à régler avant le 21 septembre » ou rien du tout. Une facture
 * sans échéance — le délai de paiement est un interrupteur, il s'éteint —
 * laisserait sinon « Voici votre facture F2026-0008, à régler avant le . »
 * chez le client.
 */
export const PASTILLES = [
  "[client]",
  "[document]",
  "[numero]",
  "[echeance]",
  "[lien]",
  "[entreprise]",
] as const;

/** Les trois documents qui partent chez le client, et rien d'autre. */
export const GENRES = ["devis", "facture", "passage"] as const;
export type GenreDocument = (typeof GENRES)[number];

/**
 * Ce qui entoure la phrase, et qui ne change pas d'un document à l'autre.
 *
 * **Écrite une fois pour les trois.** Le bonjour, la place du lien et la
 * signature sont les mêmes partout : les recopier trois fois ferait qu'un jour
 * l'un d'eux dirait « Bien à vous » et l'autre « Cordialement », sans que
 * personne ne l'ait décidé.
 */
function enveloppe(phrase: string): string {
  return [
    "Bonjour [client],",
    "",
    phrase,
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
}

/**
 * TROIS MESSAGES, UN PAR DOCUMENT — sa décision du 7 septembre 2026.
 *
 * *« En fait il faut faire deux messages par défaut, un pour devis et un pour
 * facture »*, puis, une fois le troisième document retrouvé : *« dans ce cas
 * faut faire 3 messages par défaut et garder le système un seul mot change »*.
 *
 * **Le texte est celui d'avant, mot pour mot** : les phrases sortent de
 * `phraseDuDocument`, qui les portait en dur. Rien n'est réécrit — ce qui
 * change, c'est qu'elles vivent maintenant dans SON modèle, donc qu'il peut
 * les modifier.
 *
 * **Le troisième document existe, et il a failli être oublié.** Le compte rendu
 * de passage part avec ce même modèle (`composerMessageEntretien`) : à deux
 * messages, il serait resté sur le texte d'Atlas pendant que les deux autres
 * portaient la voix du patron. *(Il l'appelle « fiche client » ; le dépôt dit
 * « compte rendu de passage », et le renommer se décide — `TODO.md`.)*
 */
export const MESSAGES_PAR_DEFAUT: Record<GenreDocument, string> = {
  devis: enveloppe(
    "Voici votre [document]. Vous pouvez le consulter et choisir votre date " +
      "d'intervention. Et si aucune des dates proposées ne vous convient, vous " +
      "pouvez en proposer une autre. Tout se fait sur cette page :"
  ),
  facture: enveloppe(
    "Voici votre [document] [numero][echeance]. Vous pouvez la consulter et la " +
      "télécharger ici :"
  ),
  passage: enveloppe("Voici le [document] de mon passage chez vous :"),
};

/**
 * Le message d'un document tant qu'il n'a rien écrit.
 *
 * `null` en base veut dire « celui-ci » : recopier ce texte dans la colonne à
 * la création d'une entreprise l'y figerait, et le jour où l'on corrige une
 * virgule, les anciennes garderaient l'ancienne version sans que personne ne
 * s'en aperçoive.
 */
export function messageParDefaut(genre: GenreDocument): string {
  return MESSAGES_PAR_DEFAUT[genre];
}

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
  /**
   * **LE MOT DU DOCUMENT NE SE RETIRE PAS — sa consigne du 7 septembre 2026 :**
   * *« le lien, les mots devis, facture et fiche client ne peuvent être
   * enlevés »*.
   *
   * Ce n'est pas de la mise en forme : les trois messages se ressemblent, et
   * celui qui perd son mot laisse le client deviner ce qu'il vient de recevoir
   * — un devis à signer, ou une facture à payer. On refuse, et on le dit.
   *
   * **Le refus est rendu AVANT celui du lien**, parce que c'est celui qu'il
   * verra en premier en effaçant le début de sa phrase.
   */
  if (!modele.includes("[document]")) {
    return (
      "Le mot du document est obligatoire : sans lui, votre client ne sait pas " +
      "s'il reçoit un devis, une facture ou un compte rendu. Reposez-le pour enregistrer."
    );
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
 * LE MOT QUI NOMME LE DOCUMENT — ce qu'Atlas pose à la place de `[document]`.
 *
 * **Un mot, plus une phrase, depuis le 7 septembre 2026.** La phrase entière
 * vivait ici et s'imposait à son message ; elle est passée dans les modèles
 * (`MESSAGES_PAR_DEFAUT`), où elle se modifie. Ne reste que ce qui ne peut pas
 * être écrit d'avance parce qu'il change d'un envoi à l'autre.
 *
 * **« compte rendu », et pas « fiche client ».** C'est le nom que le dépôt
 * emploie partout (`composerMessageEntretien`, l'écran de la fiche). Le patron
 * l'appelle « fiche client » ; renommer se décide et se fait d'un bloc, ça ne
 * se glisse pas dans un mot rendu au client.
 */
export function motDuDocument(genre: GenreDocument): string {
  if (genre === "devis") return "devis";
  if (genre === "facture") return "facture";
  return "compte rendu";
}

/**
 * L'échéance AVEC SES MOTS — « , à régler avant le 21 septembre », ou rien.
 *
 * **Elle emporte sa ponctuation, et c'est la seule façon sûre.** Le délai de
 * paiement est un interrupteur : éteint, il n'y a pas d'échéance. Une pastille
 * qui ne rendrait que la date laisserait alors « Voici votre facture F2026-0008,
 * à régler avant le . » dans la boîte du client — une phrase cassée, sur le seul
 * document qu'il faut lire sans hésiter.
 */
export function clauseEcheance(echeanceLisible?: string | null): string {
  return echeanceLisible ? `, à régler avant le ${echeanceLisible}` : "";
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
  valeurs: {
    client: string;
    /** Le mot du document : « devis », « facture », « compte rendu ». */
    document: string;
    /** Le numéro du document. Vide quand il n'y en a pas encore. */
    numero?: string;
    /** L'échéance AVEC ses mots, ou vide (voir `clauseEcheance`). */
    echeance?: string;
    lien: string;
    entreprise: string;
  }
): string {
  const rendu = modele
    .replace(/\[client\]/g, valeurs.client)
    .replace(/\[document\]/g, valeurs.document)
    .replace(/\[numero\]/g, valeurs.numero ?? "")
    .replace(/\[echeance\]/g, valeurs.echeance ?? "")
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
  /** Le numéro du devis, quand il en porte un. */
  numeroDevis?: string | null;
  /** SON message de devis, s'il en a écrit un. Absent : celui d'Atlas. */
  modele?: string | null;
}): MessageClient {
  const { clientNom, clientCivilite, entrepriseNom, numeroDevis, lien, modele } = params;
  return {
    // **L'objet ne se règle pas, et c'est délibéré.** Il ne se lit que par
    // courriel — jamais par SMS —, il doit rester reconnaissable dans une boîte
    // de réception, et un objet vide ou trompeur envoie le message aux
    // indésirables. Ce qu'il écrit, c'est le corps.
    objet: `Votre devis — ${entrepriseNom}`,
    corps: rendreMessage(modele?.trim() || MESSAGES_PAR_DEFAUT.devis, {
      client: nommer(clientNom, clientCivilite),
      document: motDuDocument("devis"),
      numero: numeroDevis ?? "",
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
    corps: rendreMessage(modele?.trim() || MESSAGES_PAR_DEFAUT.facture, {
      client: nommer(clientNom, clientCivilite),
      document: motDuDocument("facture"),
      numero: numeroFacture,
      // **L'échéance entre dans la phrase, avant le lien**, et elle emporte ses
      // mots : sans échéance, la clause disparaît en entier plutôt que de
      // laisser « à régler avant le . » chez le client.
      echeance: clauseEcheance(echeanceLisible),
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
    corps: rendreMessage(modele?.trim() || MESSAGES_PAR_DEFAUT.passage, {
      client: nommer(clientNom, clientCivilite),
      document: motDuDocument("passage"),
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
