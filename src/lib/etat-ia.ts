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
  role: "Transcription" | "Rédaction" | "Lecture d’image";
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

/**
 * Les deux rôles que `decrire` sait traiter.
 *
 * **Volontairement plus étroit que `EtatFournisseur["role"]`**, qui porte aussi
 * « Lecture d'image » : celle-ci a ses propres phrases (un croquis n'est ni un
 * audio ni une dictée) et sa propre règle, `etatVision`. Élargir les tables
 * ci-dessus pour l'y faire entrer aurait produit une carte qui parle de
 * « transcriptions simulées » à propos d'une photo — le genre de phrase qu'on
 * ne voit qu'à la capture.
 */
type RoleDecrit = "Transcription" | "Rédaction";

function decrire(
  role: RoleDecrit,
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

// ─────────────────────────────────────────────────────────────────────────────
// QUI REGARDE LES PHOTOS — et l'écran doit le dire JUSTE.
//
// **Pourquoi cette fonction est née, le 21 août 2026.** L'écran d'arrosage
// annonçait « aucune clé d'IA n'est posée sur ce serveur » dès qu'il ne
// trouvait ni clé Anthropic ni clé OpenAI — une question qui n'est pas celle
// qu'il faut poser. Ce qui compte n'est pas qu'une clé existe quelque part,
// mais que **le fournisseur qui va lire l'image** ait la sienne. Les deux se
// séparent depuis que `VISION_PROVIDER` existe : on peut rédiger chez l'un et
// regarder chez l'autre.
//
// Sans cette distinction, l'écran se trompe DANS LES DEUX SENS — et le second
// est le plus coûteux :
//
//   1. clé posée, mais chez un fournisseur qui ne lit pas les images : l'écran
//      annonce que tout va bien, il photographie… et rien ne revient. C'est le
//      « troisième bouton qui ne répond pas », déjà payé trois fois ici ;
//   2. vision réglée sur un fournisseur dont la clé est là, mais l'autre clé
//      absente : l'écran crie au manque alors que la lecture fonctionne.
//
// **Et le message doit désigner le bon coupable** (`CLAUDE.md` §5) : « aucune
// clé » quand c'est le fournisseur qui ne sait pas lire envoie coller une clé
// qui ne changera rien.
//
// Fonction pure : aucune variable d'environnement lue ici, aucun réseau.

export type EtatVision =
  /** Le fournisseur choisi sait lire une image, et sa clé est là. */
  | { prete: true; fournisseur: string }
  /** La lecture ne rendra rien — et on dit pourquoi, en français. */
  | { prete: false; raison: string };

/** Ceux qui savent VRAIMENT regarder une image, et la clé que chacun réclame. */
const VISION: Record<string, { libelle: string; variable: string }> = {
  anthropic: { libelle: "Anthropic (Claude)", variable: "ANTHROPIC_API_KEY" },
  openai: { libelle: "OpenAI (GPT)", variable: "OPENAI_API_KEY" },
};

export function etatVision(entree: {
  /** `VISION_PROVIDER`, ou à défaut le fournisseur de rédaction. */
  visionProvider: string;
  anthropicApiKey?: string | null;
  openaiApiKey?: string | null;
}): EtatVision {
  const nom = (entree.visionProvider ?? "").toLowerCase();
  const fiche = VISION[nom];

  // Gemini est un raccordement annoncé et non écrit : il répond « fournisseur
  // non implémenté » à chaque appel. Poser sa clé n'y changerait rien, et le
  // dire évite d'aller la chercher.
  if (!fiche) {
    if (nom === "gemini") {
      return { prete: false, raison: "Google Gemini ne sait pas encore lire une image ici." };
    }
    return { prete: false, raison: "Aucun fournisseur de lecture d’image n’est configuré." };
  }

  const cles: Record<string, string | null | undefined> = {
    anthropic: entree.anthropicApiKey,
    openai: entree.openaiApiKey,
  };
  if (!cles[nom]) {
    return { prete: false, raison: `${fiche.libelle} lit les croquis, mais ${fiche.variable} n’est pas posée.` };
  }
  return { prete: true, fournisseur: fiche.libelle };
}

/**
 * La carte « Lecture d'image » de l'écran Atlas IA.
 *
 * **Pourquoi elle est née le 21 août 2026.** Le patron a demandé : *« va voir ce
 * qu'il y a de posé dans l'application et dis-moi si c'est bon ou s'il faut
 * qu'on rajoute une clé »*. La bonne réponse n'est pas que je regarde à sa
 * place une fois : c'est que l'application le dise, à lui, le jour où il se
 * pose la question. L'écran nommait déjà qui écoute et qui rédige ; il ne
 * disait rien de qui REGARDE, alors que c'est un réglage à part depuis
 * `VISION_PROVIDER`.
 *
 * **La décision n'est pas reprise ici** : elle appartient à `etatVision`, et
 * l'écran d'arrosage s'appuie sur la même. Deux implémentations finiraient par
 * ne plus dire la même chose, et c'est le patron qui verrait l'écart entre un
 * réglage qui se dit vert et un croquis qui ne se lit pas (`CLAUDE.md` §3).
 *
 * On lui passe les NOMS des variables renseignées, jamais leurs valeurs — une
 * clé n'a rien à faire dans du HTML rendu.
 */
export function decrireVision(
  visionProvider: string,
  clesPresentes: readonly string[]
): EtatFournisseur {
  const etat = etatVision({
    visionProvider,
    anthropicApiKey: clesPresentes.includes("ANTHROPIC_API_KEY") ? "posée" : null,
    openaiApiKey: clesPresentes.includes("OPENAI_API_KEY") ? "posée" : null,
  });
  const role = "Lecture d’image" as const;

  if (etat.prete) {
    return {
      role,
      nature: "reel",
      libelle: etat.fournisseur,
      explication:
        "Les croquis d’arrosage et les tickets photographiés partent chez ce prestataire. Il devient un sous-traitant à faire figurer dans vos documents (voir docs/RGPD.md §3).",
    };
  }

  // **Deux échecs qui ne se réparent pas de la même façon**, et le dire épargne
  // d'aller coller une clé qui ne changerait rien : l'un se corrige en collant
  // une clé, l'autre en écrivant du code.
  const variable = etat.raison.match(/[A-Z_]+_API_KEY/)?.[0];
  return {
    role,
    nature: variable ? "cle_absente" : "non_raccorde",
    libelle: etat.raison,
    explication: "Aucun croquis ne sera lu : l’écran d’arrosage le dit avant de faire photographier.",
    ...(variable ? { variableManquante: variable } : {}),
  };
}
