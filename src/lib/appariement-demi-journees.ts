/**
 * Quel chantier caler sur la demi-journée restée libre ?
 *
 * **Sa demande du 13 août 2026 :** *« lorsqu'on a fini des chantiers en
 * demi-journée, que le planning soit en mesure de proposer deux demi-journées
 * pour faire une journée, mais de deux chantiers qui sont les plus proches.
 * […] Je vais lui demander s'il veut que je mette ce chantier-là plutôt qu'un
 * autre l'après-midi ou le matin. »*
 *
 * Et sa décision du 16 août, une fois la vérification revenue : **par la
 * route**, pas à vol d'oiseau.
 *
 * ————————————————————————————————————————————————————————————————
 * **POURQUOI DEUX MESURES, ET NON UNE SEULE.**
 *
 * Le vol d'oiseau ne coûte rien : c'est un calcul, chez nous, sur des
 * coordonnées qu'on possède déjà. La route, elle, demande un appel au service de
 * l'IGN par candidat. Mesuré le 16 août sur les monts du Lyonnais : le service
 * répond en 186 ms, mais il n'annonce **aucune limite d'usage** dans ses
 * en-têtes — dix appels ne prouvent pas qu'il en supporte mille.
 *
 * D'où l'ordre imposé ici, et il n'est pas négociable :
 *
 *   1. **le vol d'oiseau classe et écarte** — instantané, aucun appel ;
 *   2. **la route ne départage que les trois premiers.**
 *
 * Trois appels par proposition, pas quinze. Un écran qui arroserait un service
 * public à chaque ouverture finirait par s'en voir fermer la porte, et c'est
 * l'artisan qui perdrait la fonction.
 *
 * ————————————————————————————————————————————————————————————————
 * **CE QUE CE FICHIER NE FAIT PAS**, parce qu'un écran ne décide de rien
 * (`CLAUDE.md` §3) : il ne lit aucune base, n'appelle aucun service, et ne
 * planifie rien. Il ordonne des candidats. La décision reste au patron — c'est
 * la règle du dépôt, et elle vaut ici comme pour l'envoi d'un devis.
 */

/** Un point sur la carte. `null` partout ailleurs qu'ici serait ambigu. */
export type Position = { latitude: number; longitude: number };

export type CandidatDemiJournee = {
  chantierId: string;
  nom: string;
  /** Ce qui s'affiche sous le nom : la commune, ou l'adresse à défaut. */
  ou: string | null;
  /** `null` quand on n'a pas su situer son adresse — cas normal, jamais tu. */
  position: Position | null;
};

export type CandidatClasse = CandidatDemiJournee & {
  /** À vol d'oiseau, en kilomètres. Toujours connu si la position l'est. */
  kmOiseau: number;
  /** Par la route, quand le service a répondu. `null` sinon : on ne devine pas. */
  kmRoute: number | null;
  minutesRoute: number | null;
};

/**
 * Au-delà, ce n'est plus la même journée de travail.
 *
 * **Quarante kilomètres à vol d'oiseau, pas par la route** : c'est le filtre qui
 * précède les appels, il doit donc se calculer sans appel. Les écarts mesurés le
 * 16 août vont de ×1,33 à ×1,56 — quarante à vol d'oiseau valent donc soixante
 * de route environ, ce qui est déjà une heure de camion. Un seuil plus large
 * ferait proposer des chantiers que personne n'accepterait ; plus étroit, il
 * cacherait des paires valables en rase campagne.
 *
 * Ce n'est pas un interdit : l'écran laisse voir au-delà (« Voir quand même »).
 */
export const SEUIL_OISEAU_KM = 40;

/**
 * Combien de candidats méritent un appel à l'IGN.
 *
 * Trois : c'est ce que l'écran montre, et c'est ce qui tient sur la dalle d'un
 * téléphone sans faire défiler. En demander plus coûterait des appels pour des
 * lignes que personne ne lit.
 */
export const CANDIDATS_MONTRES = 3;

/** Rayon moyen de la Terre, en kilomètres. */
const RAYON_TERRE_KM = 6371;

/**
 * La distance à vol d'oiseau, en kilomètres.
 *
 * Formule de haversine. Elle suppose la Terre sphérique, ce qui coûte quelques
 * mètres sur cent kilomètres : sans commune mesure avec l'écart entre le vol
 * d'oiseau et la route, qui est de trente à cinquante pour cent.
 */
export function distanceOiseauKm(a: Position, b: Position): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.sqrt(h));
}

export type Presélection = {
  /** Ceux qui méritent un appel à l'IGN, du plus proche au plus lointain. */
  aInterroger: (CandidatDemiJournee & { kmOiseau: number })[];
  /** Ceux qu'on écarte, avec de quoi le DIRE : combien, et le plus proche. */
  ecartes: { combien: number; plusProcheKm: number | null };
  /** Ceux dont l'adresse n'a pas pu être située — on les nomme, on ne les tait pas. */
  sansPosition: CandidatDemiJournee[];
};

/**
 * Le tri qui ne coûte aucun appel.
 *
 * **Les trois sorties comptent autant l'une que l'autre.** Un écran qui ne
 * proposerait rien sans dire pourquoi passe pour une panne — c'est le défaut que
 * ce dépôt a déjà payé trois fois. « Rien d'assez proche » et « je n'ai pas su
 * situer ce chantier » sont deux phrases différentes, et le patron ne fait pas
 * la même chose selon celle qu'il lit.
 */
export function preselectionner(
  depart: Position,
  candidats: CandidatDemiJournee[],
  seuilKm: number = SEUIL_OISEAU_KM,
  combien: number = CANDIDATS_MONTRES
): Presélection {
  const sansPosition = candidats.filter((c) => c.position === null);

  const situes = candidats
    .filter((c): c is CandidatDemiJournee & { position: Position } => c.position !== null)
    .map((c) => ({ ...c, kmOiseau: distanceOiseauKm(depart, c.position) }))
    .sort((a, b) => a.kmOiseau - b.kmOiseau);

  const dansLeSeuil = situes.filter((c) => c.kmOiseau <= seuilKm);
  const horsSeuil = situes.filter((c) => c.kmOiseau > seuilKm);

  return {
    aInterroger: dansLeSeuil.slice(0, combien),
    ecartes: {
      combien: horsSeuil.length,
      plusProcheKm: horsSeuil.length > 0 ? horsSeuil[0].kmOiseau : null,
    },
    sansPosition,
  };
}

/**
 * Le classement final, une fois la route connue.
 *
 * **Le classement change**, et c'est tout l'intérêt : à vol d'oiseau, un
 * chantier derrière une colline paraît proche. Les écarts mesurés le 16 août
 * (×1,33 à ×1,56) ne sont pas les mêmes d'un trajet à l'autre — c'est
 * précisément ce qui fait qu'un second candidat peut passer premier.
 *
 * **Un candidat dont la route est inconnue n'est pas écarté** : il retombe
 * derrière ceux qu'on sait joindre, classé sur son vol d'oiseau. Le perdre
 * parce qu'un service n'a pas répondu serait punir le patron d'une panne qui ne
 * le concerne pas.
 */
export function classer(candidats: CandidatClasse[]): CandidatClasse[] {
  return [...candidats].sort((a, b) => {
    const aRoute = a.minutesRoute ?? a.kmRoute;
    const bRoute = b.minutesRoute ?? b.kmRoute;
    if (aRoute !== null && bRoute !== null) return aRoute - bRoute;
    if (aRoute !== null) return -1;
    if (bRoute !== null) return 1;
    return a.kmOiseau - b.kmOiseau;
  });
}

/**
 * Le nom de la commune, tiré d'une adresse écrite à la main.
 *
 * **Pourquoi une approximation plutôt que la vraie donnée.** La Base Adresse
 * Nationale rend bien la commune, mais on ne la garde pas : ce serait une
 * colonne de plus, à tenir à jour à chaque correction d'adresse, pour un mot
 * qui ne sert qu'à l'affichage. Ici, se tromper coûte une ligne un peu longue —
 * pas une mauvaise décision.
 *
 * Deux règles, dans l'ordre : ce qui suit un code postal à cinq chiffres, sinon
 * le dernier morceau après une virgule. « 12 rue des Lilas, 69630 Chaponost »
 * et « 12 rue des Lilas, Chaponost » rendent tous deux « Chaponost ».
 */
export function communeApprochee(adresse: string | null): string | null {
  if (!adresse) return null;
  const propre = adresse.replace(/\s+/g, " ").trim();
  if (propre === "") return null;

  const apresCodePostal = propre.match(/\b\d{5}\b[\s,]*(.+)$/);
  if (apresCodePostal && apresCodePostal[1].trim() !== "") {
    return apresCodePostal[1].replace(/^[,\s]+/, "").trim();
  }

  const morceaux = propre.split(",").map((m) => m.trim()).filter(Boolean);
  if (morceaux.length > 1) return morceaux[morceaux.length - 1];
  return null;
}

/**
 * La phrase qui dit où c'est, telle qu'elle s'affiche.
 *
 * **Elle ne ment jamais sur ce qu'elle mesure.** « à 14 min de route » quand on
 * a la route ; « à 8 km à vol d'oiseau » sinon — et le patron sait alors qu'un
 * relief peut doubler le trajet. Écrire « à 8 km » tout court laisserait croire
 * à une distance routière.
 */
export function phraseDistance(c: Pick<CandidatClasse, "kmOiseau" | "kmRoute" | "minutesRoute">): string {
  if (c.minutesRoute !== null) {
    const km = c.kmRoute !== null ? `${Math.round(c.kmRoute)} km, ` : "";
    return `à ${km}${Math.round(c.minutesRoute)} min de route`;
  }
  if (c.kmRoute !== null) return `à ${Math.round(c.kmRoute)} km de route`;
  return `à ${Math.round(c.kmOiseau)} km à vol d’oiseau`;
}
