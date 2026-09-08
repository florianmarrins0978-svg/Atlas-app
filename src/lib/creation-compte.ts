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
 * **POURQUOI TOUT CECI EST ICI, ET PAS DANS L'ÉCRAN.** Ce fichier décide de six
 * choses qui ne sont pas de l'affichage : l'ordre, ce qui est obligatoire, ce
 * qui ne se pose que dans certains cas, ce qui se propose d'office, le nombre
 * annoncé, et ce qu'on dit à la fin. Un écran qui les porterait obligerait à
 * monter un navigateur pour les éprouver (`CLAUDE.md` §3) —
 * `scripts/test-creation-compte.ts` les joue sans rien monter.
 *
 * **LE COMPTE DE QUESTIONS N'EST DONC PAS FIXE**, et c'est voulu : quatorze pour
 * une micro-entreprise en franchise, seize pour une société assujettie. On ne
 * demande jamais le capital d'une entreprise qui n'en a pas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI RESTE À TRANCHER, ET QUI EST DANS `TODO.md`** : seize questions,
 * est-ce trop ? L'IBAN et les moyens de paiement ne servent qu'à la première
 * facture et pourraient retourner dans les réglages. Tant qu'il n'a pas
 * répondu, la liste est celle de la planche qu'il a choisie.
 */
import { FORMES_JURIDIQUES, formeADuCapital } from "@/lib/formes-juridiques";
import { capitalEnBase } from "@/lib/mentions-legales";
import { messageRefus, verifierNouveauMotDePasse } from "@/lib/mot-de-passe";

/** Le chapitre est ce qui s'affiche en haut : « Vous », « Votre entreprise »… */
export type Chapitre = "Vous" | "Votre entreprise" | "Vous joindre" | "La TVA" | "Être payé";

export type Champ = {
  cle: string;
  placeholder: string;
  type: "text" | "email" | "password" | "tel";
  autocomplete: string;
  /** Un œil qui montre ce qu'on tape : réservé aux mots de passe. */
  oeil?: boolean;
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
  /** Ce qu'on écrit dans le récapitulatif de fin : « il manque … ». */
  reste?: string;
  /** Un seul champ — le cas ordinaire. */
  placeholder?: string;
  type?: "text" | "email" | "password" | "tel";
  autocomplete?: string;
  /** Plusieurs cases sur le même écran : l'identité, le mot de passe. */
  champs?: Champ[];
  /** Deux cases qu'on touche, côte à côte, DANS un groupe : la civilité. */
  choix?: { valeur: string; titre: string }[];
  /**
   * Deux grands choix qui remplissent la question à eux seuls : la TVA.
   *
   * **Une liste avance toute seule** — voir `avanceToutSeul`.
   */
  liste?: { valeur: string; titre: string; note: string }[];
  /** Le bandeau déroulant dessiné par l'application : la forme juridique. */
  deroulant?: { valeur: string; titre: string; note: string }[];
  /** Ne se pose que si l'entreprise a un capital (donc un RCS). */
  siFormeACapital?: true;
  /** Ne se pose qu'à une entreprise qui facture la TVA. */
  siAssujettie?: true;
  /** Propose la réponse d'une question précédente, à corriger d'un doigt. */
  repriseDe?: string;
};

/**
 * Les seize questions, dans l'ordre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **SA CORRECTION DU 8 SEPTEMBRE 2026 AU SOIR**, en regardant le parcours codé :
 * *« l'ordre des questions me semble bizarre ! Avant le nom de l'entreprise je
 * pense qu'il faut mettre le numéro de tél. Vérifie l'ordre et corrige que ça
 * ait un sens ! »* Il a raison, et deux choses ont bougé :
 *
 * 1. **« Vous joindre » passe AVANT « Votre entreprise ».** On finit de parler
 *    de la personne avant de parler de sa société. Le téléphone est ce que le
 *    client compose ; le demander après la ville du RCS le range parmi les
 *    formalités, alors que c'est le renseignement le plus ordinaire des cinq
 *    chapitres.
 * 2. **Le capital et le RCS suivent immédiatement la forme juridique**, dont ils
 *    dépendent (`siFormeACapital`). Ils étaient séparés d'elle par le SIRET et
 *    l'adresse : choisir « SASU » puis se voir demander deux questions plus loin
 *    son capital rompt le fil, et surtout **on ne voit plus POURQUOI** on le
 *    demande. Une question conditionnelle se pose contre celle qui la commande.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI EST ÉCRIT ICI ÉTAIT FAUX, ET C'EST CORRIGÉ NOIR SUR BLANC.** La
 * version d'avant justifiait l'ordre ainsi : *« on commence par ce qui ouvre le
 * compte, pour qu'un abandon au milieu laisse quand même un compte
 * utilisable »*. **Rien n'est enregistré avant la dernière question** — tout
 * part en une seule transaction (`creerSonCompte`). Un abandon au milieu ne
 * laisse donc RIEN, et cette raison ne défendait aucun ordre. Elle aurait servi
 * à refuser la correction qu'il vient de demander, ce qui est exactement le
 * danger d'un « pourquoi » inventé après coup.
 *
 * **Le vrai critère est celui-là** : chaque question doit se comprendre depuis
 * celle qui la précède.
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
    choix: [
      { valeur: "mme", titre: "Madame" },
      { valeur: "mr", titre: "Monsieur" },
    ],
    champs: [
      { cle: "prenom", placeholder: "Prénom", type: "text", autocomplete: "given-name" },
      { cle: "nom", placeholder: "Nom", type: "text", autocomplete: "family-name" },
    ],
  },
  {
    id: "email",
    chapitre: "Vous",
    question: "Votre adresse e-mail ?",
    aide: "C’est elle qui vous ouvrira Atlas.",
    placeholder: "Votre e-mail",
    type: "email",
    autocomplete: "username",
    requis: true,
  },
  {
    id: "mdp",
    chapitre: "Vous",
    question: "Choisissez un mot de passe",
    requis: true,
    champs: [
      { cle: "mdp", placeholder: "Un mot de passe", type: "password", autocomplete: "new-password", oeil: true },
      { cle: "confirm", placeholder: "Confirmez le mot de passe", type: "password", autocomplete: "new-password", oeil: true },
    ],
  },

  {
    id: "tel",
    chapitre: "Vous joindre",
    question: "Votre numéro de téléphone ?",
    placeholder: "Numéro de téléphone",
    type: "tel",
    autocomplete: "tel",
    reste: "le téléphone",
  },
  {
    id: "emailPro",
    chapitre: "Vous joindre",
    question: "L’e-mail à mettre sur vos devis ?",
    placeholder: "Adresse e-mail",
    type: "email",
    autocomplete: "email",
    reste: "l’e-mail de l’entreprise",
    repriseDe: "email",
  },

  {
    id: "entreprise",
    chapitre: "Votre entreprise",
    question: "Le nom de votre entreprise ?",
    placeholder: "Nom de l’entreprise",
    type: "text",
    autocomplete: "organization",
    requis: true,
  },
  {
    id: "forme",
    chapitre: "Votre entreprise",
    question: "Sa forme juridique ?",
    reste: "la forme juridique",
    requis: true,
    // **Le sigle SEUL ne se retient pas** — « EURL » et « SASU » ne disent rien.
    // Son nom complet voyage avec lui, sinon il faut chercher ailleurs pour
    // choisir, c'est-à-dire quitter l'application.
    deroulant: FORMES_JURIDIQUES.map((f) => ({ valeur: f.sigle, titre: f.sigle, note: f.nom })),
  },
  {
    id: "capital",
    chapitre: "Votre entreprise",
    question: "Le capital social ?",
    placeholder: "1 000",
    type: "text",
    autocomplete: "off",
    reste: "le capital",
    siFormeACapital: true,
  },
  {
    id: "rcs",
    chapitre: "Votre entreprise",
    question: "La ville du RCS ?",
    placeholder: "Versailles",
    type: "text",
    autocomplete: "off",
    reste: "la ville du RCS",
    siFormeACapital: true,
  },
  {
    id: "siret",
    chapitre: "Votre entreprise",
    question: "Votre SIRET ?",
    placeholder: "14 chiffres",
    type: "text",
    autocomplete: "off",
    reste: "le SIRET",
  },
  {
    // **Sa question du 8 septembre** — « on ne met pas où est domiciliée
    // l'entreprise ? ». Si : c'est cette case-là. Elle portait le libellé des
    // réglages, « Adresse du siège », qui ne le disait pas assez. La QUESTION
    // emploie donc ses mots ; la case garde ceux des réglages.
    id: "adresse",
    chapitre: "Votre entreprise",
    question: "Où est domiciliée votre entreprise ?",
    placeholder: "Adresse du siège",
    type: "text",
    autocomplete: "street-address",
    reste: "l’adresse",
  },

  {
    id: "tva",
    chapitre: "La TVA",
    question: "Facturez-vous la TVA ?",
    requis: true,
    reste: "le régime de TVA",
    liste: [
      { valeur: "assujettie", titre: "Oui", note: "je facture la TVA à mes clients" },
      { valeur: "franchise", titre: "Non", note: "je suis en franchise de TVA" },
    ],
  },
  {
    id: "numTva",
    chapitre: "La TVA",
    question: "Votre numéro de TVA intracommunautaire ?",
    placeholder: "FR…",
    type: "text",
    autocomplete: "off",
    reste: "le numéro de TVA",
    siAssujettie: true,
  },

  {
    id: "iban",
    chapitre: "Être payé",
    question: "Votre IBAN ?",
    placeholder: "IBAN",
    type: "text",
    autocomplete: "off",
    reste: "l’IBAN",
  },
  {
    id: "titulaire",
    chapitre: "Être payé",
    question: "Le titulaire du compte ?",
    placeholder: "Titulaire du compte",
    type: "text",
    autocomplete: "off",
    reste: "le titulaire du compte",
    repriseDe: "entreprise",
  },
  {
    id: "moyens",
    chapitre: "Être payé",
    question: "Les moyens de paiement que vous acceptez ?",
    placeholder: "Virement, chèque…",
    type: "text",
    autocomplete: "off",
    reste: "les moyens de paiement",
  },
] as const;

/** Les chapitres, dans l'ordre où on les traverse. Un segment de jauge chacun. */
export const CHAPITRES: readonly Chapitre[] = [...new Set(QUESTIONS.map((q) => q.chapitre))];

/**
 * Les questions qui s'appliquent VRAIMENT, d'après ce qui a déjà été répondu.
 *
 * C'est cette fonction qui fait qu'on ne demande jamais le capital d'une
 * micro-entreprise, ni le numéro de TVA d'une franchise.
 */
export function questionsApplicables(reponses: Record<string, string>): Question[] {
  return QUESTIONS.filter((q) => {
    if (q.siFormeACapital) return formeADuCapital(reponses.forme);
    if (q.siAssujettie) return reponses.tva === "assujettie";
    return true;
  });
}

/**
 * Le total ANNONCÉ — « 5 sur 16 » —, et **il ne monte jamais**.
 *
 * Une question conditionnelle est comptée TANT QU'ON NE SAIT PAS. Sans cela, le
 * compteur passerait de « 5 sur 14 » à « 6 sur 16 » au moment où l'on choisit
 * une SAS : un total qui grossit en cours de route se lit comme une mauvaise
 * surprise, et c'est ce qu'on veut éviter chez quelqu'un qui hésite.
 */
export function totalAnnonce(reponses: Record<string, string>): number {
  const possibles = QUESTIONS.filter((q) => {
    if (q.siFormeACapital) return reponses.forme === undefined || formeADuCapital(reponses.forme);
    if (q.siAssujettie) return reponses.tva === undefined || reponses.tva === "assujettie";
    return true;
  }).length;
  // Il ne descend jamais sous ce qu'on va réellement poser : sans ce plancher,
  // une réponse qui OUVRE des questions ferait afficher « 15 sur 14 ».
  return Math.max(possibles, questionsApplicables(reponses).length);
}

/**
 * Les réponses, complétées par celles qu'on PROPOSE d'office.
 *
 * **Deux réponses se devinent de ce qu'il vient de dire** — l'e-mail des devis,
 * le titulaire du compte —, et se corrigent d'un doigt : les retaper serait lui
 * faire écrire deux fois la même chose.
 *
 * **UNE SEULE FONCTION POUR L'ÉCRAN ET POUR L'ENVOI**, et c'est tout l'objet de
 * celle-ci : la proposition affichée est exactement celle qui part en base. La
 * première version la posait dans le champ sans l'écrire dans les réponses —
 * l'écran montrait donc une adresse que l'entreprise n'aurait jamais eue.
 *
 * **Une case VIDÉE À LA MAIN reste vide** : elle vaut `""`, qui est une réponse,
 * et non l'absence de réponse.
 */
export function reponsesProposees(reponses: Record<string, string>): Record<string, string> {
  const complet = { ...reponses };
  for (const q of questionsApplicables(reponses)) {
    if (!q.repriseDe || complet[q.id] !== undefined) continue;
    const source = (reponses[q.repriseDe] ?? "").trim();
    if (source) complet[q.id] = source;
  }
  return complet;
}

/**
 * Ce qui manque pour passer à la suivante — `null` quand tout va bien.
 *
 * **Le mot de passe se vérifie ICI, pas trois écrans plus loin** : deux saisies
 * qui diffèrent, c'est un mot de passe qu'on ne retrouvera plus jamais, et
 * personne pour le redonner.
 */
export function refusDe(question: Question, reponses: Record<string, string>): string | null {
  if (question.id === "mdp") {
    // **La règle du mot de passe n'est PAS écrite ici**, et c'est délibéré :
    // douze caractères, la confirmation, et les phrases qui les disent vivent
    // dans `mot-de-passe.ts` depuis l'audit du 23 août 2026. Une seconde règle
    // à la porte aurait donné au PATRON le mot de passe le plus faible du
    // produit — plus faible que celui qu'il impose à ses salariés.
    const refus = verifierNouveauMotDePasse(reponses.mdp ?? "", reponses.confirm ?? "");
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
    // Volontairement large : une adresse se vérifie en lui écrivant, pas avec
    // une expression régulière qui refuse les adresses valides d'aujourd'hui.
    if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
      return "Cette adresse ne ressemble pas à une adresse e-mail.";
    }
    return null;
  }

  // **Un capital qu'on ne comprend pas se refuse ICI**, pas en silence au
  // moment d'écrire : PostgreSQL attend un nombre, et une saisie illisible
  // ferait échouer la création entière pour une case facultative.
  if (question.id === "capital" && (reponses.capital ?? "").trim() && capitalEnBase(reponses.capital) === undefined) {
    return "Un montant, en chiffres.";
  }

  if (question.deroulant && question.requis && !(reponses[question.id] ?? "").trim()) {
    return "Choisissez une forme juridique.";
  }

  if (question.requis && !(reponses[question.id] ?? "").trim()) return "Cette réponse est nécessaire.";
  return null;
}

/**
 * Une liste de deux avance toute seule : demander « Continuer » après un appui
 * sans ambiguïté, c'est un geste pour rien.
 */
export function avanceToutSeul(question: Question): boolean {
  return Boolean(question.liste);
}

/** Ce qui reste à remplir dans les réglages, écrit comme on le dit. */
export function resteAFaire(reponses: Record<string, string>): string[] {
  const completes = reponsesProposees(reponses);
  return questionsApplicables(reponses)
    .filter((q) => q.reste && !q.requis && !(completes[q.id] ?? "").trim())
    .map((q) => q.reste!);
}

/**
 * Ce qu'on dit à la fin, et **jamais « votre compte est créé » tout court** :
 * un premier devis partirait sans SIRET ni adresse, et il ne l'apprendrait que
 * chez son client.
 *
 * **Trois nommés, pas plus.** Une énumération de huit manques se lit comme un
 * reproche à quelqu'un qui vient de répondre à seize questions — et elle ne se
 * retient pas davantage. Le reste se compte.
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
 * L'ESPACE INSÉCABLE AVANT LE « ? ».
 *
 * Sans elle, « Facturez-vous la TVA ? » laissait le point d'interrogation TOUT
 * SEUL sur la deuxième ligne. Posée ici plutôt que dans les seize libellés :
 * une règle de typographie appliquée à un seul endroit ne s'oublie pas à la
 * dix-septième question.
 */
export function typographie(texte: string): string {
  return texte.replace(/ ([?!:;])/g, " $1");
}
