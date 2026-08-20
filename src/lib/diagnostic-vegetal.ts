/**
 * Le moteur du diagnostic végétal — et il est ENTIÈREMENT déterministe.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE MODÈLE OBSERVE, LA BASE DÉCIDE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Pourquoi ce fichier ne contient aucun appel réseau, et n'en contiendra
 * jamais.** Un modèle à qui l'on demande de nommer une maladie en nommera
 * toujours une : c'est ce qu'il sait faire, et c'est exactement ce qu'il ne
 * faut pas. Le pipeline ne lui demande donc jamais de nommer quoi que ce soit.
 * Il lui demande **ce qu'il voit**, dans le vocabulaire fermé défini plus bas,
 * et c'est le code de ce fichier qui confronte cette observation aux fiches.
 *
 * Conséquence : tout ce qui s'affiche au patron sort d'une colonne de
 * `fiches_phyto`. Une maladie inventée, une gravité inventée, un traitement
 * inventé sont impossibles **par construction** — pas par bonne volonté ni par
 * une consigne écrite dans une phrase adressée au modèle.
 *
 * **Le vocabulaire fermé est la pièce maîtresse.** Les mêmes mots servent à
 * décrire ce que le modèle voit ET ce que la fiche annonce. Deux vocabulaires
 * auraient exigé une traduction entre les deux — donc une interprétation, donc
 * un endroit où se tromper, et le pire endroit possible.
 *
 * **Tout est éprouvable sans base et sans clé** (`scripts/test-diagnostic-
 * vegetal.ts`) : c'est là que vivent les vrais pièges, et c'est là qu'un
 * diagnostic fautif se répare.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. LE VOCABULAIRE FERMÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// Ajouter un mot ici est un geste qui engage : il faut le proposer au modèle
// (`src/server/diagnostic/observation.ts`) ET pouvoir l'écrire dans une fiche.
// Un mot présent d'un seul côté ne sert à rien et fait croire à une couverture
// qui n'existe pas — `verifierVocabulaire()` plus bas refuse ce cas.

/** Ce qui a été photographié. */
export const PARTIES = [
  "feuille",
  "aiguille",
  "rameau",
  "branche",
  "tronc",
  "ecorce",
  "collet",
  "racine",
  "fruit",
  "fleur",
  "bourgeon",
  "champignon_sur_bois",
  "houppier",
  "ensemble",
] as const;
export type Partie = (typeof PARTIES)[number];

/**
 * Ce qu'on voit — la FORME, jamais la cause.
 *
 * « feutrage_blanc » et non « oïdium » : le premier se constate, le second se
 * conclut. Laisser entrer un nom de maladie dans cette liste rendrait au modèle
 * le pouvoir qu'on lui retire, et par la porte de service.
 */
export const MOTIFS = [
  "tache",
  "pustule",
  "feutrage_blanc",
  "poudre_blanche",
  "chancre",
  "necrose",
  "ecoulement",
  "gomme",
  "carpophore",
  "pourriture_bois",
  "cavite",
  "fente",
  "exfoliation_ecorce",
  "galerie",
  "perforation",
  "sciure",
  "amas_insectes",
  "toile",
  "deformation",
  "gale",
  "dessechement",
  "decoloration",
  "defoliation",
  "momification",
  "mousse_lichen",
] as const;
export type Motif = (typeof MOTIFS)[number];

export const COULEURS = [
  "blanc",
  "jaune",
  "orange",
  "brun",
  "rouge",
  "noir",
  "gris",
  "vert_anormal",
  "violet",
  "rose",
] as const;
export type Couleur = (typeof COULEURS)[number];

export const LOCALISATIONS = [
  "face_superieure",
  "face_inferieure",
  "bord",
  "nervure",
  "base",
  "sommet",
  "toute_la_surface",
  "eparse",
  "en_plages",
  "le_long_du_tronc",
  "au_collet",
  "insertion_branche",
] as const;
export type Localisation = (typeof LOCALISATIONS)[number];

export const PORTS = ["feuillu", "conifere", "arbuste", "palmier", "autre"] as const;
export type Port = (typeof PORTS)[number];

export type QualitePhoto = "bonne" | "moyenne" | "mauvaise";
export type Confiance = "elevee" | "probable" | "incertaine";
export type Gravite = "faible" | "vigilance" | "importante";
export type DiagnosticPhoto = "possible" | "indicatif" | "impossible";
export type PoidsSymptome = "cardinal" | "frequent" | "possible";
export type NatureSymptome = "symptome" | "signe";
export type Specificite = "strict" | "frequent" | "occasionnel";

const DANS = <T extends string>(liste: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (liste as readonly string[]).includes(v);

export const estPartie = (v: unknown): v is Partie => DANS(PARTIES, v);
export const estMotif = (v: unknown): v is Motif => DANS(MOTIFS, v);
export const estCouleur = (v: unknown): v is Couleur => DANS(COULEURS, v);
export const estLocalisation = (v: unknown): v is Localisation => DANS(LOCALISATIONS, v);
export const estPort = (v: unknown): v is Port => DANS(PORTS, v);

// ═══════════════════════════════════════════════════════════════════════════
// 2. CE QUI ENTRE DANS LE MOTEUR
// ═══════════════════════════════════════════════════════════════════════════

export type SymptomeFiche = {
  nature: NatureSymptome;
  partie: Partie;
  motif: Motif;
  couleurs: Couleur[];
  localisations: Localisation[];
  poids: PoidsSymptome;
};

export type HoteFiche = {
  taxonId: string;
  port: Port | null;
  specificite: Specificite;
};

/** La fiche telle que le moteur en a besoin — jamais toute la fiche. */
export type FichePourMoteur = {
  id: string;
  code: string;
  nomCommun: string;
  gravite: Gravite;
  diagnosticPhoto: DiagnosticPhoto;
  partiesAtteintes: Partie[];
  /** Mois 1–12. Une période qui repart en janvier (11 → 3) est normale. */
  periodeDebutMois: number | null;
  periodeFinMois: number | null;
  symptomes: SymptomeFiche[];
  hotes: HoteFiche[];
};

export type SigneObserve = {
  partie: Partie;
  motif: Motif;
  couleurs: Couleur[];
  localisation: Localisation | null;
};

/**
 * Ce que le modèle a rendu — et rien de plus.
 *
 * Aucun champ ne porte de nom de maladie, de gravité ni de conduite : le
 * schéma lui-même interdit au modèle de conclure. C'est délibéré et ce n'est
 * pas négociable ; ajouter un champ « hypothèse » ici reviendrait à défaire
 * tout ce module.
 */
export type Observation = {
  partie: Partie | null;
  signes: SigneObserve[];
  essence: { taxonId: string | null; port: Port | null; certitude: "sure" | "probable" | "incertaine" } | null;
  qualitePhoto: QualitePhoto;
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. LES SEUILS — exportés pour que les suites les épinglent
// ═══════════════════════════════════════════════════════════════════════════
//
// **Ils sont ici, en un seul endroit, et jamais recopiés.** Un seuil écrit deux
// fois est un seuil qui divergera (`CLAUDE.md` §3), et la divergence se
// manifesterait par un diagnostic rendu à l'écran mais refusé dans le journal —
// donc impossible à comprendre.
//
// Les valeurs elles-mêmes sont un point de départ assumé : elles se règleront
// sur de vraies photos et de vraies fiches, pas ici. Ce qui compte est qu'elles
// soient nommées, exportées et éprouvées.

/** En dessous, on ne conclut pas : la piste est trop faible pour être dite. */
export const SEUIL_PLANCHER = 0.35;
/** Au-dessus de cet écart, la première hypothèse est nettement devant. */
export const ECART_NET = 0.15;
export const SEUIL_CONFIANCE_ELEVEE = 0.75;
export const ECART_CONFIANCE_ELEVEE = 0.25;
export const SEUIL_CONFIANCE_PROBABLE = 0.5;

const POINTS_POIDS: Record<PoidsSymptome, number> = { cardinal: 100, frequent: 60, possible: 30 };

// ═══════════════════════════════════════════════════════════════════════════
// 4. LE RAPPROCHEMENT
// ═══════════════════════════════════════════════════════════════════════════

export type MotifScore =
  | { quoi: "symptome_reconnu"; motif: Motif; partie: Partie; poids: PoidsSymptome; exact: boolean }
  | { quoi: "signe_reconnu"; motif: Motif }
  | { quoi: "essence_hote"; specificite: Specificite }
  | { quoi: "essence_hors_hotes" }
  | { quoi: "port_compatible" }
  | { quoi: "saison_favorable" }
  | { quoi: "saison_defavorable" };

export type Candidat = {
  fiche: FichePourMoteur;
  /** Entre 0 et 1. **Ce n'est PAS une probabilité** et il ne sort jamais à
   *  l'écran — sa seule sortie est `hypotheses_diagnostic`, en millièmes. */
  score: number;
  /** Ce qui a compté, pour relire un diagnostic fautif six mois plus tard. */
  motifs: MotifScore[];
};

/** Un mois est-il dans la période, sachant qu'elle peut passer par janvier ? */
export function moisDansPeriode(mois: number, debut: number | null, fin: number | null): boolean | null {
  if (debut === null || fin === null) return null;
  if (debut <= fin) return mois >= debut && mois <= fin;
  // Novembre → mars : deux intervalles, et c'est le cas le plus fréquent pour
  // les champignons lignivores, dont les carpophores sortent l'hiver.
  return mois >= debut || mois <= fin;
}

/**
 * Ce qu'un symptôme de fiche rapporte face à ce qui a été observé.
 *
 * **La partie compte, mais elle n'exclut pas.** Un même motif vu sur la branche
 * plutôt que sur le rameau reste un indice — à moitié. L'exclure ferait rater
 * un diagnostic juste sur une nuance de vocabulaire que personne ne tranche de
 * la même façon sur le terrain.
 */
function apparier(symptome: SymptomeFiche, signes: SigneObserve[]): { points: number; exact: boolean; indice: number } | null {
  const base = POINTS_POIDS[symptome.poids];
  let meilleur: { points: number; exact: boolean; indice: number } | null = null;

  signes.forEach((signe, indice) => {
    if (signe.motif !== symptome.motif) return;
    const exact = signe.partie === symptome.partie;
    let points = exact ? base : base / 2;

    // Couleur et localisation affinent sans jamais décider seules : une source
    // qui ne précise pas la couleur ne doit pas pénaliser sa fiche.
    if (symptome.couleurs.length > 0 && signe.couleurs.some((c) => symptome.couleurs.includes(c))) {
      points += base * 0.2;
    }
    if (symptome.localisations.length > 0 && signe.localisation !== null && symptome.localisations.includes(signe.localisation)) {
      points += base * 0.2;
    }

    if (!meilleur || points > meilleur.points) meilleur = { points, exact, indice };
  });

  return meilleur;
}

/**
 * Confronter une observation aux fiches, et rendre les candidates avec un score
 * explicable.
 *
 * **Le score croise DEUX couvertures, et il le faut :**
 *
 *  - *la couverture de la fiche* — ce qu'elle annonce est-il visible ? Seule,
 *    elle favorise les fiches maigres : une fiche à un seul symptôme banal
 *    sortirait toujours première.
 *  - *la couverture de l'observation* — ce qu'on voit, la fiche l'explique-t-il ?
 *    Seule, elle favorise les fiches fourre-tout, qui couvrent tout parce
 *    qu'elles annoncent tout.
 *
 * Chacune prise isolément produit un classement faux d'une manière différente ;
 * ensemble, elles se corrigent.
 */
export function rapprocher(
  observation: Observation,
  fiches: FichePourMoteur[],
  mois: number
): Candidat[] {
  const candidats: Candidat[] = [];

  for (const fiche of fiches) {
    const motifs: MotifScore[] = [];

    // ── Exclusions ─────────────────────────────────────────────────────────
    // Une exclusion n'est pas un score bas : c'est une impossibilité, et la
    // confondre avec un malus laisserait remonter une fiche exclue le jour où
    // tout le reste est faible.

    // La partie photographiée n'est pas une partie que cette fiche atteint.
    if (observation.partie !== null && fiche.partiesAtteintes.length > 0 && !fiche.partiesAtteintes.includes(observation.partie)) {
      continue;
    }

    // Hôte strict : la fiche NE PEUT PAS concerner un autre végétal. C'est ce
    // qui évite de proposer une maladie du platane sur un chêne.
    const hotesStricts = fiche.hotes.filter((h) => h.specificite === "strict");
    const taxonObserve = observation.essence?.taxonId ?? null;
    if (hotesStricts.length > 0 && taxonObserve !== null && !hotesStricts.some((h) => h.taxonId === taxonObserve)) {
      continue;
    }

    // ── Les deux couvertures ───────────────────────────────────────────────
    let obtenu = 0;
    let maximum = 0;
    const signesExpliques = new Set<number>();
    let unSigneReconnu = false;

    for (const symptome of fiche.symptomes) {
      maximum += POINTS_POIDS[symptome.poids];
      const apparie = apparier(symptome, observation.signes);
      if (!apparie) continue;
      obtenu += apparie.points;
      signesExpliques.add(apparie.indice);
      motifs.push({
        quoi: "symptome_reconnu",
        motif: symptome.motif,
        partie: symptome.partie,
        poids: symptome.poids,
        exact: apparie.exact,
      });
      // **Un SIGNE vaut plus qu'un symptôme, et c'est du métier, pas du
      // réglage.** Un symptôme (dessèchement, décoloration) se partage entre
      // dix causes ; un signe est l'agent lui-même rendu visible — un
      // carpophore, une galerie — et il en désigne une.
      if (symptome.nature === "signe") {
        unSigneReconnu = true;
        motifs.push({ quoi: "signe_reconnu", motif: symptome.motif });
      }
    }

    const couvertureFiche = maximum === 0 ? 0 : Math.min(1, obtenu / maximum);
    const couvertureObservation =
      observation.signes.length === 0 ? 0 : signesExpliques.size / observation.signes.length;

    // **Les trois parts font exactement 1**, et c'est ce qui rend le signe
    // décisif plutôt que décoratif. Une version antérieure l'ajoutait APRÈS
    // coup (`min(1, score + 0.15)`) : sur deux fiches également bien couvertes,
    // le bonus était avalé par le plafond et le signe ne départageait plus
    // rien — c'est-à-dire précisément dans le cas où il sert.
    //
    // Conséquence à connaître : une fiche sans aucun signe plafonne à 0,90, et
    // c'est voulu. Elle ne repose que sur des symptômes, qui se partagent entre
    // dix causes ; elle ne mérite pas la note d'une fiche dont l'agent lui-même
    // a été vu.
    let score =
      0.55 * couvertureFiche + 0.35 * couvertureObservation + (unSigneReconnu ? 0.1 : 0);

    // ── Modulations ────────────────────────────────────────────────────────

    if (taxonObserve !== null && fiche.hotes.length > 0) {
      const hote = fiche.hotes.find((h) => h.taxonId === taxonObserve);
      if (hote) {
        score *= 1.15;
        motifs.push({ quoi: "essence_hote", specificite: hote.specificite });
      } else {
        // Hôte non listé, mais pas strict : c'est un doute, pas une exclusion.
        // Les listes d'hôtes sont rarement exhaustives dans les sources.
        score *= 0.6;
        motifs.push({ quoi: "essence_hors_hotes" });
      }
    } else if (observation.essence?.port && fiche.hotes.some((h) => h.port === observation.essence!.port)) {
      // L'essence exacte n'est pas reconnaissable, mais « c'est un conifère »
      // l'est presque toujours. Un petit indice vaut mieux qu'aucun.
      score *= 1.05;
      motifs.push({ quoi: "port_compatible" });
    }

    const dansLaSaison = moisDansPeriode(mois, fiche.periodeDebutMois, fiche.periodeFinMois);
    if (dansLaSaison === true) {
      score *= 1.1;
      motifs.push({ quoi: "saison_favorable" });
    } else if (dansLaSaison === false) {
      // Jamais une exclusion : un hiver doux, une photo prise en retard, une
      // source qui borne large. Un malus se rattrape, une exclusion non.
      score *= 0.7;
      motifs.push({ quoi: "saison_defavorable" });
    }

    score = Math.max(0, Math.min(1, score));
    if (score > 0) candidats.push({ fiche, score, motifs });
  }

  // Tri stable : à score égal, l'ordre du code évite qu'un même diagnostic
  // change de réponse d'une exécution à l'autre.
  return candidats.sort((a, b) => b.score - a.score || a.fiche.code.localeCompare(b.fiche.code));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. LE CLASSEMENT — la porte laissée ouverte, et son verrou
// ═══════════════════════════════════════════════════════════════════════════
//
// **Sa demande du 20 août 2026 :** *« ne construis pas l'architecture de manière
// à empêcher ultérieurement l'ajout d'une étape de classement sémantique ou
// visuel des fiches candidates »* — à terme, avec des milliers de fiches :
// photo + observation structurée + filtrage déterministe + classement
// sémantique/visuel + règles de sécurité.
//
// **La porte est ici. Le verrou aussi, et il est la moitié importante :** *« le
// modèle ne devra jamais pouvoir créer une maladie ou une recommandation
// absente de la base. »*
//
// Un classeur ne peut donc que RÉORDONNER et RENOTER des candidates qu'il a
// reçues. `appliquerClassement` le vérifie plutôt que de le demander : ce qui
// sort et qui n'était pas entré est écarté, et signalé. Une consigne écrite
// dans un prompt aurait été une prière ; ceci est une garantie.

export interface ClasseurCandidats {
  nom: string;
  classer(observation: Observation, candidats: Candidat[]): Promise<Candidat[]>;
}

/** Le classeur par défaut : celui qui ne fait rien, et qui suffit aujourd'hui. */
export const classeurDeterministe: ClasseurCandidats = {
  nom: "deterministe",
  async classer(_observation, candidats) {
    return candidats;
  },
};

export type ResultatClassement = {
  candidats: Candidat[];
  /** Les codes de fiches qu'un classeur a tenté d'ajouter ou de dupliquer. */
  intrus: string[];
};

/**
 * Ne garder d'un classement que ce qui était déjà là.
 *
 * Le score, lui, est repris du classeur — c'est tout l'intérêt d'en brancher
 * un — mais borné à [0, 1] : un classeur qui rendrait 42 ferait passer une
 * hypothèse faible devant tout le reste sans qu'aucun seuil ne s'en aperçoive.
 */
export function appliquerClassement(entrants: Candidat[], sortants: Candidat[]): ResultatClassement {
  const parId = new Map(entrants.map((c) => [c.fiche.id, c]));
  const vus = new Set<string>();
  const candidats: Candidat[] = [];
  const intrus: string[] = [];

  for (const sortant of sortants) {
    const origine = parId.get(sortant.fiche.id);
    if (!origine || vus.has(sortant.fiche.id)) {
      intrus.push(sortant.fiche.code);
      continue;
    }
    vus.add(sortant.fiche.id);
    candidats.push({
      // **La fiche reprise est celle d'ORIGINE**, jamais celle rendue par le
      // classeur : sans quoi il suffirait de renvoyer un objet au bon
      // identifiant mais au mauvais contenu pour afficher n'importe quel texte.
      fiche: origine.fiche,
      score: Math.max(0, Math.min(1, sortant.score)),
      motifs: sortant.motifs,
    });
  }

  // Une candidate oubliée par le classeur n'est pas perdue : elle reprend sa
  // place à la fin, avec son score déterministe. Un classeur qui tronque ne
  // doit pas pouvoir faire disparaître une piste en silence.
  for (const entrant of entrants) {
    if (!vus.has(entrant.fiche.id)) candidats.push(entrant);
  }

  return {
    candidats: candidats.sort((a, b) => b.score - a.score || a.fiche.code.localeCompare(b.fiche.code)),
    intrus,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. L'ARBITRAGE — conclure, relancer une fois, ou refuser
// ═══════════════════════════════════════════════════════════════════════════

export const MOTIFS_REFUS = {
  base_vide: "La base phytosanitaire d’Atlas ne contient encore aucune fiche validée. Aucun diagnostic n’est possible pour l’instant.",
  aucune_piste: "Aucune fiche ne correspond à ce qui est visible sur cette photo.",
  trop_faible: "Je ne peux pas confirmer l’identification à partir de cette photo.",
  trop_proches:
    "Deux problèmes différents expliquent aussi bien cette photo, et aucune autre photo ne permettrait de les départager.",
  photo_illisible: "La photo ne montre pas assez de détails pour identifier quoi que ce soit.",
  diagnostic_photo_impossible:
    "Ce type de problème ne se confirme pas sur photo. Une observation sur place est nécessaire.",
} as const;
export type MotifRefus = keyof typeof MOTIFS_REFUS;

export type Confusion = {
  ficheId: string;
  ficheConfondueId: string;
  critereDifferenciant: string;
  photoQuiTranche: string | null;
  partieQuiTranche: Partie | null;
};

export type Arbitrage =
  | { issue: "conclusion"; candidat: Candidat; confiance: Confiance }
  | {
      issue: "complement";
      candidat: Candidat;
      concurrent: Candidat;
      consigne: string;
      partie: Partie | null;
    }
  | { issue: "refus"; motif: MotifRefus };

/**
 * La confiance, en TROIS MOTS.
 *
 * **Jamais un pourcentage.** Sa règle du 20 août : *« ne pas afficher de faux
 * pourcentages de précision du type 93 % si le modèle utilisé ne fournit pas
 * une probabilité réellement calibrée »*. Aucun modèle employé ici n'en fournit
 * une, et le score interne du rapprochement n'en est pas une non plus — c'est
 * une somme pondérée d'indices, ce qui n'a rien à voir.
 *
 * **Les plafonds sont le cœur de cette fonction.** Une photo floue et une fiche
 * qui prévient elle-même qu'une photo ne suffit pas ne peuvent JAMAIS donner
 * une confiance élevée, quel que soit le score. Sans ces plafonds, la confiance
 * affichée serait un mensonge exactement dans les cas où elle compte le plus.
 */
export function confiancePour(
  candidat: Candidat,
  ecart: number,
  qualitePhoto: QualitePhoto,
  essenceConnue: boolean
): Confiance {
  let niveau: Confiance =
    candidat.score >= SEUIL_CONFIANCE_ELEVEE && ecart >= ECART_CONFIANCE_ELEVEE
      ? "elevee"
      : candidat.score >= SEUIL_CONFIANCE_PROBABLE && ecart >= ECART_NET
        ? "probable"
        : "incertaine";

  const abaisser = (plafond: Confiance) => {
    const rang = { elevee: 3, probable: 2, incertaine: 1 } as const;
    if (rang[niveau] > rang[plafond]) niveau = plafond;
  };

  if (qualitePhoto === "mauvaise") abaisser("incertaine");
  else if (qualitePhoto === "moyenne") abaisser("probable");

  // La fiche annonce elle-même qu'une photo ne fait qu'orienter : on ne peut
  // pas être plus sûr que la source ne l'est.
  if (candidat.fiche.diagnosticPhoto === "indicatif") abaisser("probable");

  // Sans essence, une bonne part de ce qui départage deux fiches manque.
  if (!essenceConnue) abaisser("probable");

  return niveau;
}

/** La confusion qui relie deux fiches, cherchée dans les deux sens. */
export function confusionEntre(a: string, b: string, confusions: Confusion[]): Confusion | null {
  return (
    confusions.find(
      (c) =>
        (c.ficheId === a && c.ficheConfondueId === b) || (c.ficheId === b && c.ficheConfondueId === a)
    ) ?? null
  );
}

/**
 * Conclure, relancer UNE fois, ou refuser. Il n'y a pas de quatrième issue.
 *
 * **`complementDejaDemande` n'est pas un détail de mise en œuvre** : c'est sa
 * règle — une seule photo complémentaire, jamais deux. Un outil qui redemande
 * une photo après en avoir déjà demandé une devient un questionnaire, ce qu'il
 * a explicitement refusé. La base porte la même limite en contrainte CHECK,
 * pour qu'elle ne dépende pas du seul code.
 */
export function arbitrer(
  candidats: Candidat[],
  observation: Observation,
  confusions: Confusion[],
  options: { complementDejaDemande: boolean; baseVide: boolean }
): Arbitrage {
  if (options.baseVide) return { issue: "refus", motif: "base_vide" };

  // Une photo illisible se dit AVANT de parler des fiches : accuser la base de
  // ne pas contenir la réponse quand c'est la photo qui ne montre rien
  // enverrait chercher au mauvais endroit (`AGENTS.md`).
  if (observation.signes.length === 0) {
    return {
      issue: "refus",
      motif: observation.qualitePhoto === "mauvaise" ? "photo_illisible" : "aucune_piste",
    };
  }

  if (candidats.length === 0) return { issue: "refus", motif: "aucune_piste" };

  const premier = candidats[0];
  const second = candidats[1] ?? null;
  const ecart = second ? premier.score - second.score : 1;

  if (premier.score < SEUIL_PLANCHER) return { issue: "refus", motif: "trop_faible" };

  // **Le verrou de sécurité, et il passe AVANT l'écart.** Une fiche qui déclare
  // elle-même qu'une photo ne peut pas trancher ne devient pas concluante parce
  // qu'elle est loin devant : elle est loin devant sur des indices qui ne
  // prouvent rien.
  if (premier.fiche.diagnosticPhoto === "impossible") {
    return { issue: "refus", motif: "diagnostic_photo_impossible" };
  }

  if (ecart >= ECART_NET) {
    return {
      issue: "conclusion",
      candidat: premier,
      confiance: confiancePour(premier, ecart, observation.qualitePhoto, observation.essence?.taxonId != null),
    };
  }

  // Coude à coude. Une seconde photo peut-elle départager ?
  if (!options.complementDejaDemande && second) {
    const confusion = confusionEntre(premier.fiche.id, second.fiche.id, confusions);
    if (confusion?.photoQuiTranche) {
      return {
        issue: "complement",
        candidat: premier,
        concurrent: second,
        // Recopiée mot pour mot de la base. Jamais composée ici, et surtout
        // jamais par un modèle : une consigne inventée enverrait photographier
        // ce qui ne tranche rien.
        consigne: confusion.photoQuiTranche,
        partie: confusion.partieQuiTranche,
      };
    }
    return { issue: "refus", motif: "trop_proches" };
  }

  // La relance a déjà eu lieu et l'écart n'a pas bougé. On tranche quand même
  // si la première est solide en elle-même — sinon on refuse.
  if (premier.score >= SEUIL_CONFIANCE_PROBABLE) {
    return {
      issue: "conclusion",
      candidat: premier,
      confiance: "incertaine",
    };
  }
  return { issue: "refus", motif: "trop_proches" };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. LES MENTIONS DE SÉCURITÉ — quatre risques, jamais confondus
// ═══════════════════════════════════════════════════════════════════════════
//
// **Ces phrases viennent du CODE, pas des fiches.** Une règle générale de
// sécurité ne doit pas pouvoir manquer parce qu'une fiche a été mal remplie :
// c'est précisément la fiche bâclée qui en a le plus besoin.

/**
 * La phrase sur la stabilité mécanique, et sa raison d'être.
 *
 * Sa consigne : *« lorsqu'un diagnostic photographique ne permet pas de conclure
 * sur la stabilité mécanique d'un arbre, Atlas doit le signaler plutôt que
 * prétendre effectuer un diagnostic mécanique complet »*. Une « gravité faible »
 * lue sur un arbre qui tombe ensuite est le seul défaut de ce module qui ne se
 * rattrape pas.
 */
export const MENTION_MECANIQUE =
  "Une photo ne permet pas de juger la solidité de l’arbre. Si sa stabilité est en question, faites-le examiner sur place.";

export type Mention =
  | { type: "mecanique"; texte: string; note: string | null }
  | { type: "risque_humain"; texte: string; note: string | null }
  | { type: "reglementaire"; texte: string; reference: string | null };

const TEXTE_RISQUE: Record<string, string> = {
  irritant: "Ce problème peut provoquer des irritations. Protégez-vous lors de l’intervention.",
  toxique: "Toxique pour l’humain ou les animaux. Prenez les précautions d’usage.",
  allergisant: "Allergisant. Protégez-vous lors de l’intervention.",
};

const TEXTE_REGLEMENTAIRE: Record<string, string> = {
  quarantaine: "Organisme réglementé : sa découverte doit être déclarée.",
  lutte_obligatoire: "Ce problème fait l’objet d’une lutte obligatoire.",
  liste_alerte: "Organisme sous surveillance : signalez-le à votre FREDON.",
};

export type ChampsSecurite = {
  /** La gravité de la fiche : elle pèse sur la mention mécanique quand
   *  l'impact est « inconnu ». Voir `mentionsDeSecurite`. */
  gravite: Gravite;
  impactMecanique: "aucun" | "possible" | "avere" | "inconnu";
  impactMecaniqueNote: string | null;
  risqueHumainAnimal: "aucun" | "irritant" | "toxique" | "allergisant" | "inconnu";
  risqueHumainAnimalNote: string | null;
  statutReglementaire: "aucun" | "quarantaine" | "lutte_obligatoire" | "liste_alerte";
  referenceReglementaire: string | null;
};

/**
 * Quand la phrase sur la stabilité s'affiche — et quand elle se tait.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **La règle a été corrigée le 20 août 2026, en REGARDANT le résultat.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La première version affichait la mention dès que `impactMecanique` n'était pas
 * « aucun » — donc aussi sur `inconnu`. L'intention était bonne : une fiche qui
 * ne sait pas dire si l'arbre risque de casser ne doit pas laisser croire que la
 * question a été tranchée.
 *
 * **Puis la deuxième fiche réelle est arrivée, et le défaut a sauté aux yeux.**
 * L'anthracnose du platane : une maladie du feuillage, que sa source qualifie de
 * « spectaculaire mais rarement grave », donc `gravite: faible`. Sa page ne parle
 * pas de stabilité — `inconnu` — et Atlas affichait, sous « Surveiller
 * l'évolution » : *« Une photo ne permet pas de juger la solidité de l'arbre. »*
 *
 * C'est exactement le travers que `CLAUDE.md` nomme à propos du rappel de panne :
 * **un avertissement qui parle à tort s'apprend à être ignoré, et l'on perd
 * alors le garde-fou sans s'en apercevoir.** Le jour où la mention compte
 * vraiment — un lignivore au collet —, elle serait devenue du décor.
 *
 * **La règle retenue, et son raisonnement :**
 *
 *  - `avere` ou `possible` → la mention, **toujours**. La source a vu quelque
 *    chose ; on ne la relativise pas.
 *  - `inconnu` **et** gravité `vigilance` ou `importante` → la mention. On ne
 *    sait pas, et ça compte.
 *  - `inconnu` **et** gravité `faible` → **silence**. Ce n'est pas un oubli de
 *    la source : c'est un jugement. Elle a regardé le problème, l'a trouvé
 *    mineur, et n'a pas soulevé la question de la structure. Ajouter la phrase
 *    ici, c'est contredire la fiche qu'on vient d'afficher.
 *
 * Ce qui n'est PAS relâché : `avere` et `possible` restent inconditionnels, et
 * une fiche `importante` dont la stabilité est inconnue continue de le dire.
 */
export function mentionsDeSecurite(champs: ChampsSecurite): Mention[] {
  const mentions: Mention[] = [];

  const stabiliteEnJeu =
    champs.impactMecanique === "avere" ||
    champs.impactMecanique === "possible" ||
    (champs.impactMecanique === "inconnu" && champs.gravite !== "faible");

  if (stabiliteEnJeu) {
    mentions.push({ type: "mecanique", texte: MENTION_MECANIQUE, note: champs.impactMecaniqueNote });
  }
  const texteRisque = TEXTE_RISQUE[champs.risqueHumainAnimal];
  if (texteRisque) {
    mentions.push({ type: "risque_humain", texte: texteRisque, note: champs.risqueHumainAnimalNote });
  }
  const texteReglementaire = TEXTE_REGLEMENTAIRE[champs.statutReglementaire];
  if (texteReglementaire) {
    mentions.push({
      type: "reglementaire",
      texte: texteReglementaire,
      reference: champs.referenceReglementaire,
    });
  }
  return mentions;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. LE RÉSULTAT FIGÉ
// ═══════════════════════════════════════════════════════════════════════════

export const LIBELLE_CONFIANCE: Record<Confiance, string> = {
  elevee: "Confiance élevée",
  probable: "Confiance probable",
  incertaine: "Confiance incertaine",
};

export const LIBELLE_GRAVITE: Record<Gravite, string> = {
  faible: "Faible",
  vigilance: "Vigilance",
  importante: "Importante",
};

/**
 * Ce que l'écran affiche — et **tout vient d'une fiche ou d'une constante de ce
 * fichier**. Aucune chaîne rendue par un modèle n'y entre, jamais.
 *
 * Il est figé en base au moment du rendu : une fiche corrigée demain ne réécrit
 * pas ce qu'il a lu hier. Sans ce gel, un diagnostic contesté six mois plus tard
 * deviendrait impossible à relire, au moment précis où on en a besoin.
 */
export type ResultatFige = {
  ficheCode: string;
  nom: string;
  nomScientifique: string | null;
  confiance: Confiance;
  confianceLibelle: string;
  explication: string;
  gravite: Gravite;
  graviteLibelle: string;
  conduite: string;
  mentions: Mention[];
  /** Ce que « Voir les détails » déplie. Rien ici n'est nécessaire pour agir. */
  details: {
    categorie: string;
    agentCausal: string | null;
    agentType: string;
    partiesAtteintes: string[];
    prevention: string | null;
    gestion: string | null;
    traitement: string | null;
    sources: { organisme: string; titre: string; url: string | null; consulteeLe: string; champs: string[] }[];
    versionFiche: number;
    sourcesAJourLe: string | null;
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// 9. LE CONTRÔLE DU VOCABULAIRE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Une fiche n'emploie que des mots que le modèle sait rendre — et réciproquement.
 *
 * **Sans ce contrôle, l'écart serait silencieux et coûterait un diagnostic.**
 * Une fiche écrivant « moisissure » là où le modèle rend « feutrage_blanc » ne
 * remonterait jamais : aucune erreur, aucun message, simplement une fiche qui
 * ne sort plus jamais. C'est le défaut le plus cher de cette architecture, et
 * le seul que le partage du vocabulaire rend détectable.
 *
 * Appelé par l'import, qui refuse la fiche — jamais au moment du diagnostic, où
 * il serait trop tard pour faire autre chose que se taire.
 */
export function verifierVocabulaire(symptomes: { partie: string; motif: string; couleurs: string[]; localisations: string[] }[]): string[] {
  const problemes: string[] = [];
  for (const [i, s] of symptomes.entries()) {
    if (!estPartie(s.partie)) problemes.push(`symptôme ${i + 1} : partie « ${s.partie} » hors vocabulaire`);
    if (!estMotif(s.motif)) problemes.push(`symptôme ${i + 1} : motif « ${s.motif} » hors vocabulaire`);
    for (const c of s.couleurs) {
      if (!estCouleur(c)) problemes.push(`symptôme ${i + 1} : couleur « ${c} » hors vocabulaire`);
    }
    for (const l of s.localisations) {
      if (!estLocalisation(l)) problemes.push(`symptôme ${i + 1} : localisation « ${l} » hors vocabulaire`);
    }
  }
  return problemes;
}
