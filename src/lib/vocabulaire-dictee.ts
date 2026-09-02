/**
 * LES MOTS QU'ON SOUFFLE À LA TRANSCRIPTION AVANT QU'ELLE ÉCOUTE.
 *
 * **Sa colère du 28 août 2026 :** *« je lui ai dit désherbage mais il comprend
 * mal, il m'énerve »*. La dictée avait écrit « herbages ». Ce n'est pas une
 * panne : c'est une transcription qui ne sait pas de quel métier on parle, et
 * qui choisit le mot le plus courant de la langue.
 *
 * **Atlas connaissait pourtant son vocabulaire** — `termes_metier`, ses mots à
 * lui (`mots_catalogue`), ses corrections — mais il ne servait qu'APRÈS, à la
 * lecture du texte. La transcription, elle, écoutait sans rien savoir. Une
 * connaissance qui arrive après le mot mal entendu n'a jamais servi à rien.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE FICHIER N'EST PAS.** Ce n'est pas une donnée de l'application :
 * aucun de ces mots n'entre dans un devis, un prix, ni une prestation. C'est un
 * INDICE donné au transcripteur — « attends-toi à entendre ces mots-là » —, et
 * il ne peut rien produire tout seul. La règle du §4 (« ne jamais inventer une
 * prestation ») n'est pas touchée : elle interdit d'écrire ce qu'on n'a pas
 * relevé, pas d'écouter mieux.
 */

/**
 * Le fond de langue d'un paysagiste, pour que la première dictée marche.
 *
 * **Pourquoi une liste posée ici plutôt qu'un écran à remplir.** Sans elle, il
 * faudrait qu'il tape quarante mots dans les Réglages avant que sa première
 * phrase soit comprise — et il n'a pas ouvert Atlas pour saisir du vocabulaire.
 * Ses mots à lui s'y ajoutent (`termes_metier`, `mots_catalogue`) et passent
 * DEVANT : ce sont eux qu'il faut sauver quand la place manque.
 */
export const MOTS_DU_METIER = [
  "désherbage",
  "désherbant",
  "débroussaillage",
  "tonte",
  "taille",
  "taille de haie",
  "élagage",
  "abattage",
  "dessouchage",
  "rognage",
  "paillage",
  "scarification",
  "regarnissage",
  "engazonnement",
  "massif",
  "vivaces",
  "arbustes",
  "haie",
  "charmille",
  "thuya",
  "laurier",
  "gazon",
  "pelouse",
  "allée",
  "bordure",
  "clôture",
  "terrasse",
  "arrosage automatique",
  "arroseur",
  "turbine",
  "tuyère",
  "électrovanne",
  "nourrice",
  "programmateur",
  "goutte-à-goutte",
  "chalumeau",
  "thermique",
  "évacuation des déchets verts",
  "déchetterie",
  "broyage",
  "mètre linéaire",
  "mètre carré",
] as const;

/**
 * Ce qu'on souffle au transcripteur, borné.
 *
 * **Deux cents mots au plus, et c'est une contrainte du dehors** : les services
 * de transcription plafonnent leur indice (autour de 224 jetons chez Whisper).
 * Au-delà, il est tronqué — sans prévenir, et par la fin. On coupe donc
 * nous-mêmes, en gardant SES mots devant.
 */
export const MAX_MOTS_INDICE = 200;

export function construireIndiceDictee(sesMots: readonly string[] = []): string {
  const vus = new Set<string>();
  const retenus: string[] = [];
  // **Ses mots d'abord.** Si la place manque, c'est le fond de langue qu'on
  // sacrifie — jamais ce qu'il a pris la peine d'apprendre à Atlas.
  for (const mot of [...sesMots, ...MOTS_DU_METIER]) {
    const propre = mot.trim();
    if (!propre) continue;
    const cle = propre.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    retenus.push(propre);
    if (retenus.length >= MAX_MOTS_INDICE) break;
  }
  if (retenus.length === 0) return "";
  // Une phrase, pas une liste : les transcripteurs attendent un texte
  // d'exemple, et une énumération sèche les guide moins bien.
  return `Vocabulaire attendu (travaux paysagers) : ${retenus.join(", ")}.`;
}
