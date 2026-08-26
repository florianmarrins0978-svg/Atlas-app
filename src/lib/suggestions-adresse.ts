/**
 * Ce que l'application retient d'une réponse de la Base Adresse Nationale.
 *
 * **Pourquoi une fonction pure, séparée de l'appel réseau.** La réponse vient
 * d'un service extérieur : elle peut changer de forme, arriver tronquée, ou ne
 * ressembler à rien le jour d'une panne. Une extraction enfouie dans le code
 * qui fait l'appel ne serait jamais vue échouer sur autre chose que le cas
 * heureux (`AGENTS.md`). Ici, on peut lui donner n'importe quoi.
 *
 * **La règle qui prime : ne jamais inventer une adresse.** Une suggestion mal
 * formée est écartée, pas rafistolée. Un client se déplace à l'adresse qui
 * figure sur le devis — une rue devinée enverrait le patron ailleurs
 * (`docs/AGENT.md` §3).
 */
export type SuggestionAdresse = {
  /** L'adresse entière, telle qu'elle ira dans le champ : « 20 Rue de la Paix 75002 Paris ». */
  libelle: string;
  /** Département et région, pour départager deux rues de même nom. */
  contexte: string | null;
  /**
   * Où c'est, quand la base le dit.
   *
   * **Elles arrivaient déjà et l'on s'en débarrassait.** La réponse est du
   * GeoJSON : chaque adresse y porte sa géométrie, et seul le libellé était
   * retenu. Les garder ne coûte pas un appel de plus — c'est ce qui permet à
   * Atlas de dire « ce chantier est à huit kilomètres de l'autre » (demande du
   * patron du 13 août 2026).
   *
   * `null` quand la base ne les rend pas : une aide qui devine ferait pire que
   * de se taire.
   */
  latitude: number | null;
  longitude: number | null;
};

/** Au-delà, la liste dépasse l'écran d'un téléphone et ne se lit plus. */
export const MAX_SUGGESTIONS = 6;

/**
 * En dessous, la base renvoie la France entière et la liste n'aide personne :
 * on n'appelle donc pas. Comptés APRÈS les espaces : « 20 » suivi d'un espace
 * n'est pas une recherche, c'est quelqu'un qui n'a pas fini de taper.
 */
export const MIN_CARACTERES = 3;

/** Faut-il seulement interroger la base pour ce qui est tapé ? */
export function meriteUneRecherche(saisie: string): boolean {
  return saisie.trim().length >= MIN_CARACTERES;
}

type Brut = {
  features?: unknown;
};

/**
 * Extrait les suggestions d'une réponse GeoJSON de la Base Adresse Nationale.
 *
 * Ne jette jamais : une réponse illisible donne une liste vide, et l'écran
 * laisse alors le patron taper son adresse à la main — ce qu'il pouvait déjà
 * faire avant. Une aide qui tombe en panne doit redevenir un champ ordinaire,
 * pas un écran d'erreur.
 */
export function lireSuggestions(reponse: unknown): SuggestionAdresse[] {
  const features = (reponse as Brut | null)?.features;
  if (!Array.isArray(features)) return [];

  const vues = new Set<string>();
  const suggestions: SuggestionAdresse[] = [];

  for (const feature of features) {
    const props = (feature as { properties?: Record<string, unknown> } | null)?.properties;
    if (!props) continue;

    const libelle = typeof props.label === "string" ? props.label.trim() : "";
    if (!libelle) continue;

    // La base renvoie parfois deux fois la même adresse (une voie et son
    // numéro), et une liste où la même ligne apparaît deux fois donne
    // l'impression d'un défaut.
    const cle = libelle.toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);

    const contexte = typeof props.context === "string" && props.context.trim() ? props.context.trim() : null;

    // La géométrie GeoJSON est `[longitude, latitude]` — dans CET ordre, et
    // c'est le piège classique : inversées, deux chantiers du Rhône se
    // retrouvent au large de la Somalie sans qu'aucun contrôle ne s'en émeuve,
    // puisque les nombres restent des nombres.
    const coords = (feature as { geometry?: { coordinates?: unknown } } | null)?.geometry?.coordinates;
    const paire = Array.isArray(coords) && coords.length >= 2 ? coords : null;
    const lon = paire && typeof paire[0] === "number" && Number.isFinite(paire[0]) ? paire[0] : null;
    const lat = paire && typeof paire[1] === "number" && Number.isFinite(paire[1]) ? paire[1] : null;
    suggestions.push({ libelle, contexte, latitude: lat, longitude: lon });

    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }

  return suggestions;
}

/**
 * Deux écritures désignent-elles la même adresse ?
 *
 * ─── POURQUOI, ET CE QU'IL A VU ────────────────────────────────────────────
 *
 * **Sa question du 24 août 2026, capture à l'appui :** *« pourquoi l'adresse
 * est marquée 2 fois de suite ? »* Sur l'écran « Mon entreprise », son siège
 * s'écrivait dans le champ — « 10 rue denfert rochereau 78200 Mantes la
 * jolie » — et la proposition juste en dessous répétait la même adresse dans
 * son écriture officielle : « 10 Rue Denfert Rochereau 78200
 * Mantes-la-Jolie ». Deux lignes, une seule adresse.
 *
 * Ce n'était pas un défaut de recherche : les deux textes DIFFÈRENT pour une
 * machine — majuscules, traits d'union — et se ressemblaient assez pour qu'un
 * œil y voie un doublon. Une liste de suggestions qui répète ce qui est déjà
 * écrit ne propose rien : elle occupe la place et fait douter de la saisie.
 *
 * **Ce qu'on NE fait pas, et c'est délibéré :** réécrire silencieusement sa
 * saisie dans la forme officielle. Corriger sous ses doigts un champ qui
 * finira en tête de ses devis, sans qu'il l'ait demandé, est exactement le
 * genre de geste qu'on ne s'autorise pas (`CLAUDE.md` §4). On cache la
 * répétition ; on ne touche pas à ce qu'il a écrit.
 *
 * La comparaison ignore ce qui ne change pas l'adresse : la casse, les
 * accents, les traits d'union et apostrophes, les espaces en trop et la
 * ponctuation. Elle garde les chiffres, qui distinguent le 10 du 100.
 */
export function memeAdresse(a: string, b: string): boolean {
  const nu = (t: string) =>
    t
      .normalize("NFD")
      // Les diacritiques : « Mantes-la-Jolie » et « Mantes-la-jolie ».
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      // Traits d'union, apostrophes et ponctuation deviennent des espaces —
      // « Mantes-la-Jolie » et « Mantes la jolie » sont la même ville.
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const na = nu(a);
  // Deux chaînes vides ne sont pas « la même adresse » : elles ne sont rien.
  return na !== "" && na === nu(b);
}
