/**
 * LES QUESTIONS DE LA PORTE — une à la fois, dans l'ordre.
 *
 * **Son choix du 8 septembre 2026**, entre deux propositions de la planche
 * `appli/la-porte-en-plein-air.html` : *« une question à la fois »*, et non un
 * formulaire de sept cases. Sa contrainte du 5 septembre le commandait déjà —
 * *« imagine que la plupart des patrons qui vont utiliser l'app sont des vieux
 * qui ont du mal à se servir de leur téléphone »* : un formulaire vide est
 * exactement l'écran devant lequel on abandonne.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LA PORTE SOIGNÉE, SON « CODE TOUTE LA PLANCHE » DU 26 OCTOBRE 2026**
 * (`appli/soignee/creer-un-compte.html`, `docs/creer-un-compte-soigne.md`).
 *
 * Les seize questions de septembre ont été confrontées aux réglages du jour :
 * cinq réglages nés depuis ne se demandaient pas, et l'appli les posait sans
 * le dire (le rythme et le reversement de la TVA, les chantiers par jour), ou
 * les laissait vides alors que la loi les veut sur le papier (la décennale, le
 * médiateur). Et la fin disait « Vos réglages sont remplis » quand Mon
 * entreprise disait juste après le médiateur manquant et obligatoire.
 *
 * Elles se demandent donc, et trois paires passent sur un seul écran, comme
 * les paquets de Mon entreprise : le téléphone et l'e-mail des devis, le
 * capital et la ville du RCS, l'IBAN et son titulaire. Quatorze questions pour
 * une micro-entreprise sans décennale, vingt pour une société qui facture la
 * TVA et a une décennale. Son « non c'est pas trop » du 9 septembre portait sur
 * seize ; le chiffre neuf était écrit sur la planche qu'il a fait coder.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI TOUT CECI EST ICI, ET PAS DANS L'ÉCRAN.** L'ordre, ce qui est
 * obligatoire, ce qui ne se pose que dans certains cas, ce qui se propose
 * d'office, le nombre annoncé et ce qu'on dit à la fin ne sont pas de
 * l'affichage : `scripts/test-creation-compte.ts` les joue sans rien monter
 * (`CLAUDE.md` §3).
 *
 * **Le vrai critère de l'ordre** (sa correction du 8 septembre au soir) :
 * chaque question se comprend depuis celle qui la précède. On finit de parler
 * de lui avant de parler de sa société, et une question conditionnelle se pose
 * contre celle qui la commande. **Rien n'est enregistré avant la dernière
 * question** : tout part en une seule transaction (`creerSonCompte`).
 */
import { numeroTvaFrancais } from "@/lib/autoliquidation";
import { MAX_EQUIPES } from "@/lib/equipes";
import { FORMES_JURIDIQUES, formeADuCapital } from "@/lib/formes-juridiques";
import { capitalEnBase } from "@/lib/mentions-legales";
import { MOYENS_ACCEPTES, MOYENS_PROPOSES } from "@/lib/modalites-paiement";
import { messageRefus, verifierNouveauMotDePasse } from "@/lib/mot-de-passe";

/** Le chapitre est ce qui s'affiche en haut ; un segment de jauge chacun. */
export type Chapitre =
  | "Vous"
  | "Vous joindre"
  | "Votre entreprise"
  | "La TVA"
  | "Être payé"
  | "Assurance et médiateur"
  | "Votre équipe";

/** Une case à remplir. Une question en porte une ou plusieurs. */
export type Champ = {
  cle: string;
  /**
   * Son nom AU-DESSUS de la case, dès qu'un écran en porte plusieurs : une
   * case remplie ne montre plus son exemple, et l'on ne sait plus ce qu'elle
   * est. Seul, il est inutile : la question le dit.
   */
  libelle?: string;
  placeholder: string;
  type: "text" | "email" | "password" | "tel";
  autocomplete: string;
  inputMode?: "numeric" | "decimal" | "tel" | "email" | "text";
  /** Un œil qui montre ce qu'on tape : réservé aux mots de passe. */
  oeil?: boolean;
  /** Ce qui suit la saisie dans la case : « € » au bout du capital. */
  unite?: string;
  /** « FR +33 » devant le téléphone, comme dans Réglages. */
  indicatif?: boolean;
  /** Propose la réponse d'une autre case, à corriger d'un doigt. */
  repriseDe?: string;
  /** Le numéro de TVA se tire du SIRET (`numeroTvaFrancais`). */
  tireDuSiret?: true;
  /** Ce qu'on écrit à la fin quand la case est restée vide : « il manque … ». */
  reste?: string;
};

export type Question = {
  id: string;
  chapitre: Chapitre;
  /** La question, telle qu'elle s'écrit en grand. */
  question: string;
  /** Une ligne sous la question, quand elle évite de se demander pourquoi. */
  aide?: string;
  /** Sans réponse, on ne passe pas. */
  requis?: boolean;
  champs?: Champ[];
  /** Madame ou Monsieur : deux pilules, DANS le même écran que le nom. */
  civilite?: readonly { valeur: string; titre: string }[];
  /** La forme juridique, en liste visible (`FORMES_JURIDIQUES`). */
  formes?: true;
  /** Oui ou Non : deux cartes côte à côte, qui avancent au premier appui. */
  cartes?: readonly { valeur: string; titre: string; note: string }[];
  /** Une liste de choix ; avec `propose`, l'un d'eux est déjà entouré. */
  liste?: readonly { valeur: string; titre: string; note?: string }[];
  /**
   * La réponse proposée toute faite, déjà entourée. Il regarde, et c'est le
   * bouton qui confirme (sa décision du 18 septembre 2026 pour les moyens de
   * paiement, étendue aux réglages qui ont une valeur d'office).
   */
  propose?: string;
  /** Un nombre au − et au +. */
  compteur?: { min: number; max: number };
  /** La photo de l'attestation décennale. */
  attestation?: true;
  /** Ne se pose que dans ce cas. */
  si?: "capital" | "assujettie" | "decennale";
  /** Ce qu'on dit à la fin quand la question entière est restée sans réponse. */
  reste?: string;
};

/**
 * Les questions, dans l'ordre.
 *
 * **Les mots du rythme et du reversement sont ceux de Mon entreprise**
 * (`PeriodiciteTva.tsx`, `ExigibiliteTva.tsx`) : la même question, posée deux
 * fois avec deux rédactions, finirait par se lire comme deux réglages.
 */
export const QUESTIONS: readonly Question[] = [
  {
    id: "identite",
    chapitre: "Vous",
    question: "Quelle est votre identité ?",
    requis: true,
    // **MADAME et MONSIEUR EN TOUTES LETTRES**, alors que les documents
    // écrivent « Mme » et « Mr. » : une abréviation sur une question posée en
    // grand se lit mal, et c'est le seul écran où l'on a la place.
    civilite: [
      { valeur: "mme", titre: "Madame" },
      { valeur: "mr", titre: "Monsieur" },
    ],
    champs: [
      { cle: "prenom", libelle: "Prénom", placeholder: "Prénom", type: "text", autocomplete: "given-name" },
      { cle: "nom", libelle: "Nom", placeholder: "Nom", type: "text", autocomplete: "family-name" },
    ],
  },
  {
    id: "email",
    chapitre: "Vous",
    question: "Votre adresse e-mail ?",
    aide: "C’est elle qui vous ouvrira Atlas.",
    requis: true,
    champs: [{ cle: "email", placeholder: "Votre e-mail", type: "email", autocomplete: "username", inputMode: "email" }],
  },
  {
    id: "mdp",
    chapitre: "Vous",
    question: "Choisissez un mot de passe",
    requis: true,
    champs: [
      { cle: "mdp", libelle: "Mot de passe", placeholder: "Un mot de passe", type: "password", autocomplete: "new-password", oeil: true },
      {
        cle: "confirm",
        libelle: "Confirmez le mot de passe",
        placeholder: "Le même",
        type: "password",
        autocomplete: "new-password",
        oeil: true,
      },
    ],
  },

  {
    id: "joindre",
    chapitre: "Vous joindre",
    question: "Comment vos clients vous joignent ?",
    champs: [
      {
        cle: "tel",
        libelle: "Téléphone",
        placeholder: "6 12 34 56 78",
        type: "tel",
        autocomplete: "tel-national",
        inputMode: "tel",
        indicatif: true,
        reste: "le téléphone",
      },
      {
        cle: "emailPro",
        libelle: "E-mail sur vos devis",
        placeholder: "Adresse e-mail",
        type: "email",
        autocomplete: "email",
        inputMode: "email",
        repriseDe: "email",
        reste: "l’e-mail de l’entreprise",
      },
    ],
  },

  {
    id: "entreprise",
    chapitre: "Votre entreprise",
    question: "Le nom de votre entreprise ?",
    requis: true,
    champs: [{ cle: "entreprise", placeholder: "Nom de l’entreprise", type: "text", autocomplete: "organization" }],
  },
  {
    // **En liste, et non plus en déroulant** (planche du 26 octobre) : ouvert,
    // le déroulant cachait la question, vu à la capture. Le sigle voyage avec
    // son nom complet : « EURL » et « SASU » seuls ne disent rien.
    id: "forme",
    chapitre: "Votre entreprise",
    question: "Sa forme juridique ?",
    requis: true,
    formes: true,
  },
  {
    // Le capital et la ville du RCS dépendent de la forme : ils la suivent
    // immédiatement, sur un seul écran, comme dans Mon entreprise.
    id: "capitalRcs",
    chapitre: "Votre entreprise",
    question: "Son capital et la ville du RCS ?",
    si: "capital",
    champs: [
      {
        cle: "capital",
        libelle: "Capital social",
        placeholder: "1 000",
        type: "text",
        autocomplete: "off",
        inputMode: "decimal",
        unite: "€",
        reste: "le capital",
      },
      { cle: "rcs", libelle: "Ville du RCS", placeholder: "Versailles", type: "text", autocomplete: "off", reste: "la ville du RCS" },
    ],
  },
  {
    id: "siret",
    chapitre: "Votre entreprise",
    question: "Votre SIRET ?",
    champs: [{ cle: "siret", placeholder: "14 chiffres", type: "text", autocomplete: "off", inputMode: "numeric", reste: "le SIRET" }],
  },
  {
    // **Sa question du 8 septembre** — « on ne met pas où est domiciliée
    // l'entreprise ? ». La QUESTION emploie ses mots ; la case garde ceux des
    // réglages.
    //
    // **Sans suggestions d'adresse, et c'est délibéré** : la route qui les
    // donne (`/api/adresses`) est fermée à qui n'a pas de compte, pour que
    // notre serveur ne devienne pas un relais ouvert vers la Base Adresse
    // Nationale. La planche les montrait ; elles ne valent pas cette porte.
    id: "adresse",
    chapitre: "Votre entreprise",
    question: "Où est domiciliée votre entreprise ?",
    champs: [{ cle: "adresse", placeholder: "Adresse du siège", type: "text", autocomplete: "street-address", reste: "l’adresse" }],
  },

  {
    id: "tva",
    chapitre: "La TVA",
    question: "Facturez-vous la TVA ?",
    requis: true,
    cartes: [
      { valeur: "assujettie", titre: "Oui", note: "je facture la TVA à mes clients" },
      { valeur: "franchise", titre: "Non", note: "je suis en franchise de TVA" },
    ],
  },
  {
    id: "numTva",
    chapitre: "La TVA",
    question: "Votre numéro de TVA intracommunautaire ?",
    si: "assujettie",
    champs: [
      { cle: "numTva", placeholder: "FR…", type: "text", autocomplete: "off", tireDuSiret: true, reste: "le numéro de TVA" },
    ],
  },
  {
    // **Une déclaration, pas une préférence** : Atlas ne devine pas un régime
    // fiscal (`PeriodiciteTva.tsx`). Le mois est proposé parce que c'est le
    // défaut LÉGAL, et il le voit avant de confirmer, au lieu de le subir.
    id: "rythme",
    chapitre: "La TVA",
    question: "À quel rythme la déclarez-vous ?",
    aide: "Le mois est le défaut. Le trimestre s’obtient sous condition.",
    si: "assujettie",
    requis: true,
    liste: [
      { valeur: "mensuelle", titre: "Tous les mois" },
      { valeur: "trimestrielle", titre: "Tous les trimestres" },
    ],
    propose: "mensuelle",
  },
  {
    // Les encaissements sont le régime d'une prestation de services (CGI
    // art. 269-2-c), les débits une option (`ExigibiliteTva.tsx`).
    id: "reversement",
    chapitre: "La TVA",
    question: "Quand la reversez-vous aux impôts ?",
    aide: "Dans le doute, votre comptable le dit en une phrase.",
    si: "assujettie",
    requis: true,
    liste: [
      { valeur: "encaissements", titre: "Le mois où mon client me paie", note: "Elle entre au relevé quand vous la marquez payée." },
      { valeur: "debits", titre: "Le mois où j’envoie la facture", note: "Même si le client n’a pas encore payé." },
    ],
    propose: "encaissements",
  },

  {
    id: "paye",
    chapitre: "Être payé",
    question: "Votre IBAN ?",
    champs: [
      { cle: "iban", libelle: "IBAN", placeholder: "FR76 …", type: "text", autocomplete: "off", reste: "l’IBAN" },
      {
        cle: "titulaire",
        libelle: "Titulaire du compte",
        placeholder: "Le nom qui figure sur le compte",
        type: "text",
        autocomplete: "off",
        repriseDe: "entreprise",
        reste: "le titulaire du compte",
      },
    ],
  },
  {
    id: "moyens",
    chapitre: "Être payé",
    question: "Les moyens de paiement que vous acceptez ?",
    // **Plus de champ libre — sa décision du 18 septembre 2026.** Proposée
    // d'office, la réponse existe toujours : rien à passer, rien à réclamer.
    requis: true,
    liste: MOYENS_ACCEPTES,
    propose: MOYENS_PROPOSES,
  },

  {
    // Obligatoire sur les devis et factures de qui en a une (loi 96-603,
    // art. 22-2) ; un élagueur n'en a pas forcément. Oui ou Non, sans juger.
    id: "decennale",
    chapitre: "Assurance et médiateur",
    question: "Avez-vous une assurance décennale ?",
    requis: true,
    cartes: [
      { valeur: "oui", titre: "Oui", note: "elle va sur mes devis et mes factures" },
      { valeur: "non", titre: "Non", note: "je n’en ai pas" },
    ],
  },
  {
    // **La photo reste dans le téléphone jusqu'à « Créer mon compte »** : rien
    // n'est écrit avant, et l'IA ne lit rien pour quelqu'un qui n'a pas de
    // compte (une lecture d'image ouverte à tous serait payée par nous). Elle
    // part juste après, par le dépôt de Mon entreprise, qui la fait lire.
    id: "attestation",
    chapitre: "Assurance et médiateur",
    question: "Prenez votre attestation en photo",
    si: "decennale",
    attestation: true,
    reste: "l’attestation",
  },
  {
    // La loi veut les coordonnées de l'assureur et la couverture sur chaque
    // devis et chaque facture ; le numéro de contrat, non : il reste dans
    // Mon entreprise.
    id: "assureur",
    chapitre: "Assurance et médiateur",
    question: "Votre assureur ?",
    si: "decennale",
    champs: [
      { cle: "assureur", libelle: "Assureur", placeholder: "AXA, Groupama, MMA…", type: "text", autocomplete: "off", reste: "l’assureur" },
      {
        cle: "adresseAssureur",
        libelle: "Adresse de l’assureur",
        placeholder: "Sur votre attestation",
        type: "text",
        autocomplete: "off",
        reste: "l’adresse de l’assureur",
      },
      {
        cle: "couverture",
        libelle: "Couverture géographique",
        placeholder: "France métropolitaine",
        type: "text",
        autocomplete: "off",
        reste: "la couverture de la décennale",
      },
    ],
  },
  {
    // **Celui que la fin d'avant oubliait** : elle disait « Vos réglages sont
    // remplis », et Mon entreprise le disait manquant et obligatoire juste
    // après (vu à la capture du 26 octobre 2026).
    id: "mediateur",
    chapitre: "Assurance et médiateur",
    question: "Votre médiateur de la consommation ?",
    aide: "Obligatoire dès que vous travaillez pour des particuliers.",
    champs: [
      { cle: "mediateur", libelle: "Nom", placeholder: "Celui auquel vous adhérez", type: "text", autocomplete: "off", reste: "le médiateur" },
      { cle: "mediateurOu", libelle: "Adresse ou site", placeholder: "Son adresse ou son site", type: "text", autocomplete: "off" },
    ],
  },

  {
    // **Sa remarque du 26 octobre** : « on ne sait pas trop pourquoi on
    // choisit deux équipes ou moins ». L'aide le dit, l'écran le montre sur
    // trois jours d'exemple (`semaineDExemple`), et dit que rien ne se bloque.
    id: "equipes",
    chapitre: "Votre équipe",
    question: "Combien de chantiers par jour ?",
    aide: "Une équipe, un chantier. Ce chiffre règle le remplissage de votre planning.",
    requis: true,
    compteur: { min: 1, max: MAX_EQUIPES },
    propose: "1",
  },
] as const;

/** Les chapitres, dans l'ordre où on les traverse. Un segment de jauge chacun. */
export const CHAPITRES: readonly Chapitre[] = [...new Set(QUESTIONS.map((q) => q.chapitre))];

/** La forme juridique a-t-elle un capital ? Commande deux cases. */
function siApplicable(q: Question, reponses: Record<string, string>): boolean {
  if (q.si === "capital") return formeADuCapital(reponses.forme);
  if (q.si === "assujettie") return reponses.tva === "assujettie";
  if (q.si === "decennale") return reponses.decennale === "oui";
  return true;
}

/**
 * Les questions qui s'appliquent VRAIMENT, d'après ce qui a déjà été répondu.
 * On ne demande jamais le capital d'une micro-entreprise, ni la TVA d'une
 * franchise, ni l'assureur de qui n'a pas de décennale.
 */
export function questionsApplicables(reponses: Record<string, string>): Question[] {
  return QUESTIONS.filter((q) => siApplicable(q, reponses));
}

/**
 * Le total ANNONCÉ — « 5 sur 20 » —, et **il ne monte jamais**.
 *
 * Une question conditionnelle est comptée TANT QU'ON NE SAIT PAS : un total
 * qui grossit en cours de route se lit comme une mauvaise surprise.
 */
export function totalAnnonce(reponses: Record<string, string>): number {
  const possibles = QUESTIONS.filter((q) => {
    if (q.si === "capital") return reponses.forme === undefined || formeADuCapital(reponses.forme);
    if (q.si === "assujettie") return reponses.tva === undefined || reponses.tva === "assujettie";
    if (q.si === "decennale") return reponses.decennale === undefined || reponses.decennale === "oui";
    return true;
  }).length;
  // Il ne descend jamais sous ce qu'on va réellement poser.
  return Math.max(possibles, questionsApplicables(reponses).length);
}

/** Le numéro de TVA que porte ce SIRET, ou rien s'il n'a pas ses 14 chiffres. */
export function numeroTvaDuSiret(siret: string | undefined): string | null {
  const chiffres = String(siret ?? "").replace(/\D/g, "");
  return chiffres.length === 14 ? numeroTvaFrancais(chiffres.slice(0, 9)) : null;
}

/**
 * Les réponses, complétées par celles qu'on PROPOSE d'office.
 *
 * Deux se devinent de ce qu'il vient de dire (l'e-mail des devis, le
 * titulaire), une se calcule (le numéro de TVA, tiré du SIRET), les autres
 * sont proposées toutes faites (les moyens de paiement, le rythme, le
 * reversement, les chantiers par jour). Toutes se corrigent d'un doigt.
 *
 * **UNE SEULE FONCTION POUR L'ÉCRAN ET POUR L'ENVOI** : la proposition affichée
 * est exactement celle qui part en base. **Une case VIDÉE À LA MAIN reste
 * vide** : elle vaut `""`, qui est une réponse, et non l'absence de réponse.
 */
export function reponsesProposees(reponses: Record<string, string>): Record<string, string> {
  const complet = { ...reponses };
  for (const q of questionsApplicables(reponses)) {
    if (q.propose !== undefined && complet[q.id] === undefined) complet[q.id] = q.propose;
    for (const champ of q.champs ?? []) {
      if (complet[champ.cle] !== undefined) continue;
      if (champ.repriseDe) {
        const source = (reponses[champ.repriseDe] ?? "").trim();
        if (source) complet[champ.cle] = source;
      }
      if (champ.tireDuSiret) {
        const tire = numeroTvaDuSiret(reponses.siret);
        if (tire) complet[champ.cle] = tire;
      }
    }
  }
  return complet;
}

/**
 * Ce qui manque pour passer à la suivante — `null` quand tout va bien.
 *
 * **Le mot de passe se vérifie ICI, pas trois écrans plus loin**, par la règle
 * du produit (`mot-de-passe.ts`) : une seconde règle à la porte aurait donné
 * au PATRON le mot de passe le plus faible de l'appli.
 */
export function refusDe(question: Question, reponses: Record<string, string>): string | null {
  if (question.id === "mdp") {
    const refus = verifierNouveauMotDePasse(reponses.mdp ?? "", reponses.confirm ?? "", [
      reponses.prenom,
      reponses.nom,
      reponses.email,
    ]);
    return refus ? messageRefus(refus) : null;
  }

  if (question.id === "identite") {
    if (!reponses.identite) return "Madame ou Monsieur ?";
    if (!(reponses.prenom ?? "").trim()) return "Votre prénom.";
    if (!(reponses.nom ?? "").trim()) return "Votre nom.";
    return null;
  }

  if (question.id === "email") {
    const email = (reponses.email ?? "").trim();
    // Volontairement large : une adresse se vérifie en lui écrivant.
    if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
      return "Cette adresse ne ressemble pas à une adresse e-mail.";
    }
    return null;
  }

  // **Un capital qu'on ne comprend pas se refuse ICI**, pas en silence au
  // moment d'écrire : une saisie illisible ferait échouer la création entière
  // pour une case facultative.
  if (question.id === "capitalRcs" && (reponses.capital ?? "").trim() && capitalEnBase(reponses.capital) === undefined) {
    return "Un montant, en chiffres.";
  }

  if (question.formes && !(reponses.forme ?? "").trim()) return "Choisissez une forme juridique.";

  if (question.requis && !question.champs && !question.civilite && !(reponses[question.id] ?? "").trim()) {
    return "Cette réponse est nécessaire.";
  }
  if (question.requis) {
    for (const champ of question.champs ?? []) {
      if (!(reponses[champ.cle] ?? "").trim()) return "Cette réponse est nécessaire.";
    }
  }
  return null;
}

/**
 * Une liste qui avance toute seule : demander « Continuer » après un appui sans
 * ambiguïté, c'est un geste pour rien. **Sauf quand une réponse est déjà
 * proposée** : il regarde ce qui est entouré, et c'est le bouton qui confirme.
 */
export function avanceToutSeul(question: Question): boolean {
  return Boolean(question.cartes || question.formes) && question.propose === undefined;
}

/**
 * Ce qui reste à remplir dans les réglages, écrit comme on le dit.
 *
 * `attestationJointe` dit si une photo attend d'être envoyée : elle n'est pas
 * une réponse écrite, et elle se compte quand même.
 */
export function resteAFaire(reponses: Record<string, string>): string[] {
  const completes = reponsesProposees(reponses);
  const restes: string[] = [];
  for (const q of questionsApplicables(reponses)) {
    if (q.attestation) {
      if (completes.attestation !== "jointe" && q.reste) restes.push(q.reste);
      continue;
    }
    for (const champ of q.champs ?? []) {
      if (champ.reste && !(completes[champ.cle] ?? "").trim()) restes.push(champ.reste);
    }
  }
  return restes;
}

/**
 * Ce qu'on dit à la fin, et **jamais « tout est prêt » quand un manque reste** :
 * un premier devis partirait sans SIRET ni médiateur, et il ne l'apprendrait
 * que chez son client. **Trois nommés, pas plus** : une énumération de huit
 * manques se lit comme un reproche. Le reste se compte.
 */
export function phraseDeCeQuiManque(restes: string[]): string | null {
  if (restes.length === 0) return null;
  const trois = restes.slice(0, 3);
  const enumere =
    trois.length === 1 ? trois[0] : `${trois.slice(0, -1).join(", ")} et ${trois[trois.length - 1]}`;
  const autres = restes.length - trois.length;
  const suite = autres > 0 ? `, et ${autres} autre${autres > 1 ? "s" : ""}` : "";
  return `Il manque ${enumere}${suite}.`;
}

/**
 * L'ESPACE INSÉCABLE AVANT LE « ? », et le trait d'union insécable de
 * « reversez-vous ». Sans le premier, le « ? » restait seul sur sa ligne ; sans
 * le second, la question se coupait entre « reversez- » et « vous » (vu sur la
 * planche du 26 octobre). Posé ici plutôt que dans chaque libellé : une règle
 * appliquée à un seul endroit ne s'oublie pas à la question suivante.
 */
export function typographie(texte: string): string {
  return texte.replace(/ ([?!:;])/g, "\u00a0$1").replace(/-vous\b/g, "\u2011vous");
}

/** Les formes de la liste visible d'emblée ; les autres sous « Une autre forme ». */
export const FORMES_COURANTES = ["EI", "Micro-entreprise", "EURL", "SARL", "SASU", "SAS"] as const;

export const FORMES_DE_LA_PORTE = FORMES_JURIDIQUES.map((f) => ({
  valeur: f.sigle,
  titre: f.sigle,
  note: f.nom,
  courante: (FORMES_COURANTES as readonly string[]).includes(f.sigle),
}));
