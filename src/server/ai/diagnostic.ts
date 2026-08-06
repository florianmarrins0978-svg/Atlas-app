import { getConfigIA } from "./config";

/**
 * **Dire, en une phrase, si l'IA est branchée — et sinon, pourquoi.**
 *
 * Ce module existe à cause d'une journée perdue. Le patron avait posé ses clés
 * d'API et voyait une application inchangée : la dictée recopiée mot à mot,
 * jamais comprise. Rien, nulle part, ne disait quel fournisseur tournait
 * réellement. La question « est-ce que l'IA est branchée ? » n'avait aucune
 * réponse consultable — ni à l'écran, ni en ligne de commande — et il a fallu
 * lire quatre fichiers pour la reconstituer.
 *
 * Deux règles gouvernent ce qui suit :
 *
 * 1. **On ne dit jamais « branché » sans la clé qui va avec.** Un fournisseur
 *    choisi mais sans clé n'est pas un fournisseur : c'est une panne annoncée
 *    au premier appui.
 * 2. **Aucune valeur de clé ne sort d'ici.** On rapporte une présence, jamais
 *    un contenu — ces états s'affichent à l'écran et se recopient dans des
 *    captures.
 */

export type RoleIA = "redaction" | "transcription";

export type EtatRoleIA = {
  role: RoleIA;
  /** Nom technique du fournisseur retenu (`anthropic`, `openai`, `dev`…). */
  fournisseur: string;
  /** Nom montrable au patron. */
  nomLisible: string;
  /** Vrai seulement si un fournisseur réel est retenu ET utilisable. */
  branche: boolean;
  /** Ce qui manque, dit en français, quand `branche` est faux. */
  motif?: string;
  /** La variable exacte à renseigner, quand c'est elle qui manque. */
  variableManquante?: string;
};

export type EtatIA = {
  redaction: EtatRoleIA;
  transcription: EtatRoleIA;
  /** Vrai quand les deux rôles sont tenus par un fournisseur réel. */
  toutBranche: boolean;
  /** Une ligne, faite pour être lue sur une capture d'écran. */
  resume: string;
  /**
   * Le geste qui débloquerait la situation, quand il y en a un.
   *
   * Vit ici et non dans l'écran : sans lui, l'écran affichait deux fois
   * « aucune clé n'est configurée » — vrai, redondant, et sans indication de
   * ce qu'il fallait faire. Un constat qui ne dit pas quoi faire renvoie
   * chercher ailleurs.
   */
  aFaire?: string;
};

type Fournisseur = {
  nomLisible: string;
  /** Absente pour `dev` : il ne demande rien et n'envoie rien. */
  variableCle?: "ANTHROPIC_API_KEY" | "OPENAI_API_KEY" | "GEMINI_API_KEY" | "DEEPGRAM_API_KEY" | "GOOGLE_API_KEY";
  /** Faux pour les ébauches : elles répondent « non implémenté » au premier appel. */
  implemente: boolean;
};

const REDACTION: Record<string, Fournisseur> = {
  dev: { nomLisible: "mode déterministe", implemente: true },
  anthropic: { nomLisible: "Anthropic (Claude)", variableCle: "ANTHROPIC_API_KEY", implemente: true },
  openai: { nomLisible: "OpenAI (GPT)", variableCle: "OPENAI_API_KEY", implemente: true },
  gemini: { nomLisible: "Google (Gemini)", variableCle: "GEMINI_API_KEY", implemente: false },
};

const TRANSCRIPTION: Record<string, Fournisseur> = {
  dev: { nomLisible: "mode déterministe", implemente: true },
  openai: { nomLisible: "OpenAI (Whisper)", variableCle: "OPENAI_API_KEY", implemente: true },
  deepgram: { nomLisible: "Deepgram", variableCle: "DEEPGRAM_API_KEY", implemente: false },
  google: { nomLisible: "Google", variableCle: "GOOGLE_API_KEY", implemente: false },
};

function etatDuRole(role: RoleIA, choisi: string, catalogue: Record<string, Fournisseur>, variableChoix: string): EtatRoleIA {
  const connu = catalogue[choisi];

  // Un nom que la fabrique ne reconnaît pas retombe en mode déterministe — et
  // se taisait. Une faute de frappe dans une variable ne doit jamais se
  // traduire par « tout va bien » : c'est exactement le genre de silence qui
  // fait chercher le défaut ailleurs pendant des heures.
  if (!connu) {
    return {
      role,
      fournisseur: "dev",
      nomLisible: "mode déterministe",
      branche: false,
      motif: `${variableChoix} vaut « ${choisi} », que l'application ne connaît pas — elle retombe en mode déterministe.`,
    };
  }

  if (choisi === "dev") {
    return {
      role,
      fournisseur: "dev",
      nomLisible: connu.nomLisible,
      branche: false,
      motif: "Aucune clé d'API n'est configurée : rien ne sort de l'application.",
    };
  }

  if (!connu.implemente) {
    return {
      role,
      fournisseur: choisi,
      nomLisible: connu.nomLisible,
      branche: false,
      motif: `${connu.nomLisible} n'est pas implémenté pour ce rôle : il refusera au premier appel.`,
    };
  }

  const config = getConfigIA();
  const cles: Record<string, string | undefined> = {
    ANTHROPIC_API_KEY: config.anthropicApiKey,
    OPENAI_API_KEY: config.openaiApiKey,
    GEMINI_API_KEY: config.geminiApiKey,
    DEEPGRAM_API_KEY: config.deepgramApiKey,
    GOOGLE_API_KEY: config.googleApiKey,
  };
  const variable = connu.variableCle!;
  if (!cles[variable]) {
    return {
      role,
      fournisseur: choisi,
      nomLisible: connu.nomLisible,
      branche: false,
      motif: `${connu.nomLisible} est choisi, mais ${variable} n'est pas renseignée.`,
      variableManquante: variable,
    };
  }

  return { role, fournisseur: choisi, nomLisible: connu.nomLisible, branche: true };
}

export function etatIA(): EtatIA {
  const config = getConfigIA();
  const redaction = etatDuRole("redaction", config.llmProvider, REDACTION, "LLM_PROVIDER");
  const transcription = etatDuRole("transcription", config.transcriptionProvider, TRANSCRIPTION, "TRANSCRIPTION_PROVIDER");

  const resume = redaction.branche && transcription.branche
    ? `Dictée transcrite par ${transcription.nomLisible}, devis rédigé par ${redaction.nomLisible}.`
    : !redaction.branche && !transcription.branche
      ? "Mode déterministe : la dictée est recopiée mot à mot, jamais comprise."
      : `Transcription : ${transcription.branche ? transcription.nomLisible : "mode déterministe"} · Rédaction : ${redaction.branche ? redaction.nomLisible : "mode déterministe"}.`;

  // Le cas courant — aucune clé nulle part — se dit en une phrase utile, pas en
  // deux constats identiques. Les autres cas portent déjà leur motif, qui
  // nomme la variable ou la valeur fautive.
  const rienDeConfigure =
    redaction.fournisseur === "dev" && transcription.fournisseur === "dev" && !redaction.motif?.includes("connaît pas");
  const aFaire = rienDeConfigure
    ? "Posez OPENAI_API_KEY (pour écouter la dictée) et ANTHROPIC_API_KEY (pour en écrire le devis)."
    : undefined;

  return { redaction, transcription, toutBranche: redaction.branche && transcription.branche, resume, aFaire };
}
