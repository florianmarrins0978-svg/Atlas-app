// Ce que l'application utilise réellement pour écouter et pour rédiger — dit
// à l'écran, en français, à celui qui s'en sert.
//
// **Pourquoi ce fichier existe.** Le patron a ouvert deux comptes, payé, posé
// quatre clés, puis dicté — et l'application a continué à répondre par des
// textes fabriqués sans broncher. Rien, nulle part, ne lui disait qu'elle
// n'appelait personne. Il a fallu qu'il pose la question pour l'apprendre.
//
// Le garde-fou de `src/server/env.ts` refuse ce mode en production, mais reste
// muet sur le banc d'essai — où c'est justement le mode normal, et où il faut
// donc pouvoir distinguer « déterministe parce que c'est voulu » de
// « déterministe parce que ma configuration est ratée ». Un refus muet vaut
// moins qu'un refus qui s'explique.
//
// Fonction pure, sans base ni réseau : l'écran affiche ce qu'elle renvoie, et
// rien n'est décidé deux fois.

export type NatureFournisseur =
  /** Aucun appel réseau : l'application fabrique ses réponses. */
  | "simule"
  /** Un vrai prestataire, écrit et complet. */
  | "reel"
  /**
   * Un nom reconnu par la configuration, mais dont le raccordement n'est pas
   * écrit : chaque appel échouera. Le dire ici évite de le découvrir en
   * dictant — voir `docs/TRANSCRIPTION.md`, « Les candidats ».
   */
  | "non_raccorde"
  /**
   * Un prestataire réel est choisi, mais sa clé n'est pas là : chaque appel
   * échouera. Distinct de `non_raccorde`, et la distinction se paie en temps —
   * l'un se corrige en écrivant du code, l'autre en collant une clé.
   */
  | "cle_absente";

export type EtatFournisseur = {
  role: "Transcription" | "Rédaction";
  nature: NatureFournisseur;
  /** Ce qui s'affiche en gros : le prestataire, ou l'absence de prestataire. */
  libelle: string;
  /** Une phrase qui dit ce que ça implique pour les données du client. */
  explication: string;
  /** La variable exacte à renseigner, quand c'est elle qui manque. */
  variableManquante?: string;
};

type Fiche = { libelle: string; nature: NatureFournisseur; variable?: string };

// Les noms acceptés par `src/server/env.ts`, et ce qu'ils valent réellement.
// `non_raccorde` reflète l'état du code, pas une opinion : ces adaptateurs
// répondent « fournisseur non implémenté » à chaque appel.
const TRANSCRIPTION: Record<string, Fiche> = {
  openai: { libelle: "OpenAI (Whisper)", nature: "reel", variable: "OPENAI_API_KEY" },
  deepgram: { libelle: "Deepgram", nature: "non_raccorde", variable: "DEEPGRAM_API_KEY" },
  google: { libelle: "Google Speech-to-Text", nature: "non_raccorde", variable: "GOOGLE_API_KEY" },
};

const REDACTION: Record<string, Fiche> = {
  anthropic: { libelle: "Anthropic (Claude)", nature: "reel", variable: "ANTHROPIC_API_KEY" },
  // Écrit pour de bon le 6 août 2026 : le patron avait posé une clé OpenAI, et
  // l'adaptateur répondait « non implémenté » — phrase que personne ne voyait,
  // puisqu'elle ressortait sous la forme d'un devis recopié mot à mot.
  openai: { libelle: "OpenAI (GPT)", nature: "reel", variable: "OPENAI_API_KEY" },
  gemini: { libelle: "Google Gemini", nature: "non_raccorde", variable: "GEMINI_API_KEY" },
};

const CE_QUI_PART = {
  Transcription: "l'audio de vos notes vocales",
  Rédaction: "le texte de vos dictées",
} as const;

// Ce que « rien ne part » veut dire concrètement, et ce n'est pas la même chose
// pour les deux rôles. Une première version servait la même phrase aux deux, et
// la carte « Rédaction » annonçait donc des transcriptions simulées — visible
// sur une capture, invisible pour les tests.
const CE_QUI_REMPLACE = {
  Transcription:
    "Les textes rendus sont fabriqués et portent la mention « Transcription simulée », pour qu'on ne les prenne jamais pour vos mots.",
  Rédaction:
    "Les informations du chantier sont déduites par de simples règles d'écriture, sans aucun modèle de langage derrière.",
} as const;

function decrire(
  role: EtatFournisseur["role"],
  valeur: string,
  connus: Record<string, Fiche>,
  clesPresentes: ReadonlySet<string>
): EtatFournisseur {
  const nom = valeur.trim().toLowerCase();

  if (nom === "" || nom === "dev") {
    return {
      role,
      nature: "simule",
      libelle: "Mode déterministe — aucun prestataire branché",
      explication: `Rien ne part chez personne. ${CE_QUI_REMPLACE[role]}`,
    };
  }

  const fiche = connus[nom];

  // Le cas qui coûtait le plus cher, parce qu'il ne se voyait nulle part : les
  // fabriques retombent sur le mode simulé par leur `default:`, donc une faute
  // de frappe donnait exactement le même écran qu'une configuration absente.
  if (!fiche) {
    return {
      role,
      nature: "simule",
      libelle: `Mode déterministe — le nom « ${valeur} » n'est pas reconnu`,
      explication: `Rien ne part chez personne. Vérifiez l'orthographe : ${Object.keys(connus).join(", ")}.`,
    };
  }

  if (fiche.nature === "non_raccorde") {
    return {
      role,
      nature: "non_raccorde",
      libelle: `${fiche.libelle} — raccordement non écrit`,
      explication: `Ce prestataire est choisi mais son raccordement reste à écrire : chaque tentative échouera. Rien ne part chez personne pour autant.`,
    };
  }

  // Choisi, écrit, mais sans sa clé : chaque appel échouera. Le dire ICI, à la
  // configuration, plutôt que de le laisser découvrir au premier appui sur un
  // bouton — et nommer la variable, faute de quoi on cherche au mauvais
  // endroit.
  if (fiche.variable && !clesPresentes.has(fiche.variable)) {
    return {
      role,
      nature: "cle_absente",
      libelle: `${fiche.libelle} — clé absente`,
      explication: `Ce prestataire est choisi, mais ${fiche.variable} n'est pas renseignée : chaque tentative échouera. Rien ne part chez personne pour autant.`,
      variableManquante: fiche.variable,
    };
  }

  return {
    role,
    nature: "reel",
    libelle: fiche.libelle,
    explication: `${CE_QUI_PART[role].charAt(0).toUpperCase()}${CE_QUI_PART[role].slice(1)} part chez ce prestataire. Il devient un sous-traitant à faire figurer dans vos documents (voir docs/RGPD.md §3).`,
  };
}

/**
 * Décrit les deux fournisseurs.
 *
 * `clesPresentes` porte les NOMS des variables renseignées — jamais leurs
 * valeurs. Cette fonction alimente un écran et une commande de diagnostic :
 * une clé qui entrerait ici finirait dans du HTML rendu et dans des captures.
 * L'omettre revient à dire « aucune clé », ce qui est le comportement sûr.
 */
export function decrireEtatIA(
  transcriptionProvider: string,
  llmProvider: string,
  clesPresentes: Iterable<string> = []
): EtatFournisseur[] {
  const cles = new Set(clesPresentes);
  return [
    decrire("Transcription", transcriptionProvider, TRANSCRIPTION, cles),
    decrire("Rédaction", llmProvider, REDACTION, cles),
  ];
}

/**
 * Le geste qui débloquerait la situation, quand tout est déterministe.
 *
 * Sans lui, l'écran répétait deux constats identiques — « rien ne part chez
 * personne », deux fois — sans jamais dire quoi faire. Un constat qui ne dit
 * pas quoi faire renvoie chercher ailleurs.
 */
export function aFaireIA(etats: EtatFournisseur[]): string | undefined {
  const toutSimule = etats.every((e) => e.nature === "simule" && !e.libelle.includes("n'est pas reconnu"));
  if (!toutSimule) return undefined;
  return "Posez OPENAI_API_KEY (pour écouter la dictée) et ANTHROPIC_API_KEY (pour en écrire le devis) — voir docs/ESSAYER.md.";
}

/** Vrai si au moins un des deux ne fait pas ce qu'on croit — sert à colorer l'écran. */
export function auMoinsUnEnDefaut(etats: EtatFournisseur[]): boolean {
  return etats.some((e) => e.nature !== "reel");
}
