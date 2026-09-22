/**
 * LA FICHE DE SÉCURITÉ — la fiche d'intervention du décret 2021-1833, en règles
 * pures.
 *
 * **D'où elle vient.** Sa question du 21 septembre 2026 : *« en élagage il y a
 * besoin de faire des fiches avant l'intervention, apparemment c'est devenu
 * obligatoire »*. C'est vrai : décret n° 2021-1833 du 24 décembre 2021, art.
 * R. 717-85-16 du code rural, lu à la source. Une fiche établie **avant** tout
 * chantier d'abattage ou d'élagage, signée par le chef d'entreprise, montrée aux
 * travailleurs, disponible sur le chantier — *« possiblement dématérialisée »* —
 * et conservée deux ans à compter de sa signature.
 *
 * **Son nom à l'écran est « Fiche de sécurité »** — sa décision du 21 septembre :
 * *« faut pas l'appeler fiche d'élagage, les utilisateurs ne font pas que ça »*,
 * et « fiche d'intervention », le mot du décret, est déjà celui de la fiche du
 * jour sur le planning.
 *
 * **CE QUI SE COCHE EST RECOPIÉ MOT POUR MOT DU FORMULAIRE MSA 12350_A_10/2023**
 * — sa règle du même jour : *« il faut reprendre exactement leurs termes mot
 * pour mot, seuls les titres et les explications peuvent être ajoutés ou
 * modifiés »*. La feuille a été rendue en image et relue case par case. Ce qui
 * porte la main rouge sur la feuille est un POINT DE VIGILANCE : il se lit sous
 * le titre, il ne se coche pas (`POINTS_DE_VIGILANCE`). Deux fautes de la
 * feuille ne sont pas recopiées : « essoussage », « sauvatage ».
 *
 * **Le décret n'impose aucune liste** — ni matériel, ni risques, ni mesures
 * (« les équipements de travail utilisés », « les risques spécifiques au
 * chantier », « les mesures de sécurité spécifiques »). Les listes sont celles de
 * la MSA, un exemple ; l'artisan y ajoute les siennes (`ajouts`), gardées d'une
 * fiche à l'autre.
 *
 * **L'APPLICATION NE PRÉ-COCHE RIEN.** Une fiche de sécurité qui affirme à tort
 * qu'un risque est couvert est pire qu'une fiche absente : c'est lui qui la
 * signe. Ce qu'une fiche neuve porte déjà, c'est SA fiche d'avant, reprise
 * (`MemoireDesFiches`) — jamais un choix de l'application. Ce qui est vide se
 * dit avant de signer (`manques`), et la signature reste possible — c'est sa
 * fiche, et c'est lui qui décide (*« au bon vouloir de l'utilisateur »*).
 */

/** Une famille de cases à cocher : les mots de la MSA, dans l'ordre de la feuille. */
export const LIBELLES = {
  travaux: [
    "Éhoupage",
    "Élagage de formation",
    "Élagage d’entretien",
    "Haubanage",
    "Démontage avec rétention",
    "Démontage sans rétention",
    "Abattage directionnel",
    "Abattage non directionnel",
    "Ébranchage",
    "Billonnage",
    "Broyage",
    "Évacuation des rémanents",
    "Rognage / essouchage",
  ],
  elevation: ["Nacelle (PEMP)", "PIRL", "EPI de grimper", "Échelle"],
  coupe: ["Tronçonneuse élagueuse", "Tronçonneuse abatteuse", "Lamier d’élagage", "Scie sur perche", "Sécateur"],
  autresMateriels: ["Broyeur", "Essoucheuse / Rogneuse", "Treuil / Câble", "Mini chargeur", "Souffleur"],
  matieres: [
    "Repérer la présence de bois morts ou dépérissants sur les sujets à traiter (ou à proximité)",
    "Identifier les affections dangereuses pour la santé et la sécurité des travailleurs (suie, chancre, capricorne, champignon lignivore…)",
    "Évaluer l’état d’ancrage des arbres (enracinement)",
  ],
  balisage: [
    "Balisage externe du chantier vis-à-vis des personnes extérieures avec panneaux d’interdiction d’accès et de signalisation du danger",
    "Balisage interne au chantier pour limiter les risques de chute d’objet/branche sur l’homme de pied (délimitation organisationnelle)",
    "Mode / moyen de communication entre travailleurs, à préciser (ex : casques communicants) :",
    "Surveillance de l’accès au chantier (intrusion du public)",
  ],
  biologique: [
    "Chenilles processionnaires",
    "Frelons sp et autres hyménoptères",
    "Berce du Caucase, Ambroisie sp…",
    "Tiques sp",
    "Suie de l’Érable",
    "Chancre du Platane",
  ],
  biologiqueMesures: [
    "EPI appropriés (masque, combinaison, gants…)",
    "Appel à un spécialiste pour circonscrire le danger",
    "Certi biocide (si utilisation de produits biocides)",
  ],
  reseaux: ["Électrique", "Eau, Vapeur", "Gaz", "Télécom"],
  tensions: ["HTB (U > 50 000 V)", "HTA (U ≤ 50 000 V)", "BT (U ≤ 1 000 V)"],
  reseauxMesures: [
    "DT DICT declaration-travaux-proximite-reseaux (chantier distant < 50 m conducteurs électriques nus ou lors d’arrachage d’arbre, de creusement de tranchées…)",
    "AIPR (Formulaire)",
    "Distance de sécurité à respecter vis-à-vis des conducteurs électriques nus :",
  ],
  distances: ["HTB (U > 50 000 V) : 5 m", "HTA (U ≤ 50 000 V) : 3 m", "BT (U ≤ 1 000 V) : 3 m"],
  environnement: [
    "Routier",
    "Facteurs météo ambiants",
    "Bruit",
    "État des sols",
    "Conditions de vie sur le chantier",
    "Éclairage",
    "Vapeurs",
    "Poussières",
    "Noyade",
  ],
  environnementMesures: [
    "Balisage du chantier sur voie publique (https://www.jebalise.fr/)",
    "Adaptation des heures de travail",
    "Mise à disposition d’eau en quantité suffisante",
    "Mise à disposition de cabinet d’aisance",
    "Mise à disposition d’équipements ou de vêtements de travail spécifiques, préciser :",
    "Signal d’alarme (sifflet)",
    "Équipement individuel de flottaison / barque / bouée de sauvetage",
    "Plan de prévention (entreprise utilisatrice)",
  ],
  coactivite: [
    "Entraînement par les éléments mobiles des équipements de travail (rogneuse, broyeur…)",
    "Projection (avec broyeur, rogneuse…)",
  ],
  organisation: [
    "Répartition des tâches dans le temps et l’espace (travailleur/matériel)",
    "Respect des consignes de sécurité des machines",
    "Mode de communication entre travailleurs :",
  ],
  meteo: [
    "Sécuriser les travaux en cours puis arrêter les travaux",
    "Protéger les zones dangereuses ou potentiellement dangereuses (matérialisation, interdiction d’accès…)",
    "Prévenir le responsable du chantier ou le chef d’entreprise",
  ],
  secours: [
    "Trousse de secours (contenu approprié à l’activité)",
    "Kit d’urgence portatif (élagueur)",
    "Tous les travailleurs sur le chantier sont Sauveteurs Secouristes du Travail (SST)",
    "Travailleurs, disposant des compétences (type Grimpeur Sauveteur dans l’Arbre) et des moyens pour porter secours à victime dans l’arbre, en nombre suffisant sur le chantier",
    "Moyen de communication fonctionnel",
  ],
} as const;

export type Famille = keyof typeof LIBELLES;

/**
 * Les familles auxquelles l'artisan ajoute ses propres mots, gardés d'une fiche
 * à l'autre. Les sous-cases (tensions, distances) restent celles de la feuille.
 */
export const FAMILLES_AVEC_AJOUTS: readonly Famille[] = [
  "travaux",
  "elevation",
  "coupe",
  "autresMateriels",
  "matieres",
  "balisage",
  "biologique",
  "biologiqueMesures",
  "reseaux",
  "reseauxMesures",
  "environnement",
  "environnementMesures",
  "coactivite",
  "organisation",
  "meteo",
  "secours",
];

/**
 * Les points de vigilance de la feuille — la main rouge. Ils se lisent sous le
 * titre ; ils ne se cochent jamais. C'est ce qui distinguait « Manuel
 * d'utilisation du matériel » ou « Bulletins d'alerte météorologiques » d'une
 * case, et il l'a vu avant moi (*« tu l'as mis en cliquable, sur le décret non »*).
 */
export const POINTS_DE_VIGILANCE = {
  horaires: "Horaires, délais de réalisation…",
  mainDOeuvre: "Niveau de formation, ancienneté, habilitation, autorisation de conduite…",
  activites: "Moyens de prévention mis en œuvre, EPI appropriés à l’activité et aux travailleurs…",
  materiels: "Approprié à l’activité, conforme, vérifié (VGP), état (maintenance…)",
  elevation: "Privilégier les équipements de protection collective",
  echelle: "Échelle = moyen d’accès",
  distanceMateriels: "Distance de sécurité à respecter vis-à-vis des matériels",
  matieres: "Fragilisation des points d’ancrage, de la structure des arbres (branches, tronc…)",
  manuel: "Manuel d’utilisation du matériel",
  bulletins: "Bulletins d’alerte météorologiques",
} as const;

/**
 * Les mots que la feuille SOULIGNE, et le site officiel que chacun désigne —
 * vérifiés le 21 septembre 2026. La feuille elle-même n'a aucun lien cliquable
 * (fouillée : zéro annotation) ; ici le mot souligné ouvre le site, et le reste
 * de la case coche. Le formulaire de découverte fortuite n'a pas de numéro de
 * cerfa sûr : il renvoie au guichet unique, pas à un cerfa deviné.
 */
export const SOULIGNES: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  [LIBELLES.reseauxMesures[0]]: [
    ["DT DICT declaration-travaux-proximite-reseaux", "https://www.reseaux-et-canalisations.ineris.fr/"],
  ],
  [LIBELLES.reseauxMesures[1]]: [["Formulaire", "https://entreprendre.service-public.gouv.fr/vosdroits/R42490"]],
  [LIBELLES.environnementMesures[0]]: [["https://www.jebalise.fr/", "https://www.jebalise.fr/"]],
};
export const DECOUVERTE_FORTUITE = {
  mot: "formulaire de découverte fortuite de réseau",
  url: "https://www.reseaux-et-canalisations.ineris.fr/",
} as const;
/**
 * CE QUE LE TÉLÉPHONE A REFUSÉ, EN CLAIR — trois causes, trois gestes.
 *
 * Le navigateur rend un code (`GeolocationPositionError`) ; l'écran n'en
 * gardait qu'une phrase pour les trois : *« Autorisez la localisation, ou
 * écrivez-la »*. Elle envoie chercher dans les réglages quand c'est le ciel
 * qui manque, et elle ne dit rien quand le relevé a simplement mis trop de
 * temps. Une erreur qui accuse à tort coûte plus cher que pas d'erreur du tout
 * (`AGENTS.md`).
 */
export function refusDuReleveGps(code: number | undefined): string {
  if (code === 1) return "La localisation est refusée à ce site. Autorisez-la dans les réglages du téléphone, ou écrivez les coordonnées.";
  if (code === 2) return "Le téléphone ne trouve pas sa position. Sortez à découvert, ou écrivez les coordonnées.";
  if (code === 3) return "Le téléphone a mis trop de temps. Réessayez dehors, ou écrivez les coordonnées.";
  return "La position n’a pas pu être relevée. Écrivez les coordonnées.";
}

export const LIENS_DE_LA_LOI = {
  decret: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000044572758",
  formulaire: "https://ssa.msa.fr/wp-content/uploads/2023/12/12350_A-_FICHE-DINTERVENTION_WEB.pdf",
} as const;

/** Le périmètre de sécurité du décret (art. R. 717-85-23), affiché sous le balisage. */
export const PERIMETRE_DU_DECRET: readonly (readonly [string, string])[] = [
  ["Abattage à la main", "2 fois la hauteur de l’arbre"],
  ["Élagage, éhoupage", "personne sous l’arbre"],
  ["Machines", "la distance marquée dessus"],
];

/** Les consignes de secours, telles que la feuille les imprime (page 4). */
export const CONSIGNES_DE_SECOURS = {
  proteger: [
    "Sécuriser les travaux en cours puis arrêter les travaux",
    "Protéger les zones dangereuses ou potentiellement dangereuses (matérialisation, interdiction d’accès…)",
    "Prévenir le responsable du chantier ou le chef d’entreprise",
  ],
  alerter: [
    "S’identifier (nom, prénom, entreprise)",
    "Donner sa localisation et préciser les moyens d’accès",
    "Décrire la nature de l’accident",
    "Préciser le nombre et l’état du (des) blessé(s)",
    "Décrire les gestes de premiers secours en cours (le cas échéant)",
    "Fixer un rendez-vous au point de rencontre des secours (PRS)",
    "Ne jamais raccrocher le premier : attendre les instructions des services de secours",
  ],
  secourir: [
    "Intervenir sans s’exposer (suivant référentiel SST et / ou GSA)",
    "Préparer l’arrivée et l’accès des secours (dégagement des rémanents et du matériel)",
    "Prévenir le siège des entreprises (du donneur d’ordre et de celle réalisant le chantier)",
  ],
  permanentes: [
    "Dès le début du chantier, stationner les véhicules dans le sens du départ et laisser la voie d’accès libre.",
    "Obtenir l’accord des services d’urgence avant de déplacer / véhiculer une victime vers un centre de secours.",
  ],
  urgences: [
    ["17", "Police"],
    ["18", "Pompiers"],
    ["15", "SAMU"],
    ["112", "Partout en Europe"],
    ["114", "Sourd, malentendant"],
  ],
} as const;

/** La note au bas de la feuille — imprimée telle quelle au bas du PDF. */
export const NOTE_DE_LA_FEUILLE = {
  titre: "La fiche d’intervention est :",
  lignes: [
    "communiquée et présentée aux travailleurs avant le début des travaux.",
    "disponible en permanence sur le chantier (possiblement dématérialisée).",
    "communiquée au chef de l’entreprise utilisatrice lorsque le chantier est réalisé dans le cadre des dispositions prises en application de l’article L. 4511-1 du code du travail (plan de prévention).",
    "conservée pendant deux ans à compter de sa date de signature.",
  ],
} as const;

export const ETAPES = ["Le chantier", "Les travaux", "Le terrain", "Réseaux, environnement, météo", "Les secours", "Signer"] as const;
export const ETAPES_COURTES = ["Chantier", "Travaux", "Terrain", "Réseaux", "Secours", "Signer"] as const;
export const NOMBRE_D_ETAPES = ETAPES.length;

/** Ce que la fiche porte. Tout est facultatif : rien ne se pré-coche, rien ne bloque. */
export type ContenuFiche = {
  /** Le client du devis, ou quelqu'un d'autre — *« pas toujours le client »*. */
  donneur: "client" | "autre" | null;
  donneurNom: string;
  donneurPrenom: string;
  donneurTel: string;
  gps: string;
  heureDebut: string;
  heureFin: string;
  responsableNom: string;
  responsablePrenom: string;
  responsableTel: string;
  nombreDeTravailleurs: number;
  telephoneIncident: string;
  mainDOeuvre: string;
  /** Ce qui est coché, famille par famille — le libellé exact, ajouts compris. */
  coches: Partial<Record<Famille, string[]>>;
  /** Ce que l'artisan a ajouté aux listes de la MSA. */
  ajouts: Partial<Record<Famille, string[]>>;
  matieresAutres: string;
  communication: string;
  environnementPreciser: string;
  risquesAutres: string;
  mesuresAutres: string;
  organisationCommunication: string;
  lieuTrousse: string;
  pointDeRencontre: string;
  observations: string;
  photoIds: string[];
};

export function contenuVide(): ContenuFiche {
  return {
    donneur: null,
    donneurNom: "",
    donneurPrenom: "",
    donneurTel: "",
    gps: "",
    heureDebut: "",
    heureFin: "",
    responsableNom: "",
    responsablePrenom: "",
    responsableTel: "",
    nombreDeTravailleurs: 1,
    telephoneIncident: "",
    mainDOeuvre: "",
    coches: {},
    ajouts: {},
    matieresAutres: "",
    communication: "",
    environnementPreciser: "",
    risquesAutres: "",
    mesuresAutres: "",
    organisationCommunication: "",
    lieuTrousse: "",
    pointDeRencontre: "",
    observations: "",
    photoIds: [],
  };
}

export function coches(contenu: ContenuFiche, famille: Famille): readonly string[] {
  return contenu.coches[famille] ?? [];
}
export function estCoche(contenu: ContenuFiche, famille: Famille, libelle: string): boolean {
  return coches(contenu, famille).includes(libelle);
}
/** Les mots de la MSA, puis les siens. */
export function libellesAvecLesSiens(contenu: ContenuFiche, famille: Famille): readonly string[] {
  return [...LIBELLES[famille], ...(contenu.ajouts[famille] ?? [])];
}
export function cocher(contenu: ContenuFiche, famille: Famille, libelle: string): ContenuFiche {
  const avant = coches(contenu, famille);
  const apres = avant.includes(libelle) ? avant.filter((x) => x !== libelle) : [...avant, libelle];
  return { ...contenu, coches: { ...contenu.coches, [famille]: apres } };
}
/**
 * Ajouter son propre mot à une liste : il entre dans les ajouts, coché d'emblée.
 * Un mot déjà là (de la MSA ou déjà ajouté) ne se dédouble pas.
 */
export function ajouter(contenu: ContenuFiche, famille: Famille, mot: string): ContenuFiche {
  const propre = mot.trim();
  if (!propre) return contenu;
  const deja = libellesAvecLesSiens(contenu, famille).includes(propre);
  const ajouts = deja ? contenu.ajouts : { ...contenu.ajouts, [famille]: [...(contenu.ajouts[famille] ?? []), propre] };
  const suivant = { ...contenu, ajouts };
  return estCoche(suivant, famille, propre) ? suivant : cocher(suivant, famille, propre);
}

/**
 * CE QUI EST GARDÉ D'UNE FICHE À L'AUTRE — sa décision du 21 septembre 2026,
 * en deux temps. D'abord les textes : la main d'œuvre (*« la B, mais faut
 * préciser que ça sera conservé »*), le lieu de la trousse, les deux textes de
 * la co-activité, les observations, et tout ce qu'il ajoute aux listes. Puis,
 * le soir même : *« tout ce qui se coche reste bien enregistré pour les fiches
 * suivantes ? »* — oui, **les cases aussi** : à plus de vingt fiches par an,
 * le chantier suivant ressemble au précédent.
 *
 * **Ce n'est pas un pré-cochage de l'application** : c'est SA fiche d'avant,
 * reprise. L'écran « ce que demande la loi » le dit à la première ouverture,
 * avec la consigne qui va avec — chaque case se vérifie à chaque chantier,
 * c'est sa signature. Ce qui ne se garde pas : ce qui est propre au chantier —
 * le donneur d'ordre, le lieu, les heures, la photo, le point de rencontre.
 */
export type MemoireDesFiches = {
  mainDOeuvre: string;
  lieuTrousse: string;
  risquesAutres: string;
  mesuresAutres: string;
  observations: string;
  ajouts: Partial<Record<Famille, string[]>>;
  coches: Partial<Record<Famille, string[]>>;
  communication: string;
  environnementPreciser: string;
  organisationCommunication: string;
};
export function memoireVide(): MemoireDesFiches {
  return { mainDOeuvre: "", lieuTrousse: "", risquesAutres: "", mesuresAutres: "", observations: "", ajouts: {}, coches: {}, communication: "", environnementPreciser: "", organisationCommunication: "" };
}
export function memoireDepuis(contenu: ContenuFiche): MemoireDesFiches {
  return {
    mainDOeuvre: contenu.mainDOeuvre,
    lieuTrousse: contenu.lieuTrousse,
    risquesAutres: contenu.risquesAutres,
    mesuresAutres: contenu.mesuresAutres,
    observations: contenu.observations,
    ajouts: contenu.ajouts,
    coches: contenu.coches,
    communication: contenu.communication,
    environnementPreciser: contenu.environnementPreciser,
    organisationCommunication: contenu.organisationCommunication,
  };
}
/** Une fiche neuve part de ce qui a été gardé ; ce qui est propre au chantier reste vide. */
export function appliquerLaMemoire(contenu: ContenuFiche, memoire: MemoireDesFiches): ContenuFiche {
  return {
    ...contenu,
    mainDOeuvre: memoire.mainDOeuvre,
    lieuTrousse: memoire.lieuTrousse,
    risquesAutres: memoire.risquesAutres,
    mesuresAutres: memoire.mesuresAutres,
    observations: memoire.observations,
    ajouts: memoire.ajouts,
    coches: memoire.coches,
    communication: memoire.communication,
    environnementPreciser: memoire.environnementPreciser,
    organisationCommunication: memoire.organisationCommunication,
  };
}

export type Manque = { quoi: string; etape: number };

/**
 * Ce que la fiche ne sait pas encore — les sept éléments du décret, et rien
 * d'autre. Une catégorie sans rien de coché n'est pas un manque (*« s'il n'y a
 * pas de co-activité, on ne coche rien »*) : ne compte que le vide TOTAL d'un
 * élément obligatoire.
 */
export function manques(contenu: ContenuFiche): Manque[] {
  const c = contenu;
  const n = (famille: Famille) => coches(c, famille).length;
  const m: Manque[] = [];
  if (c.heureDebut === "" && c.heureFin === "") m.push({ quoi: "Heures d’exécution", etape: 1 });
  if (c.donneur === null || (c.donneur === "autre" && c.donneurNom.trim() === "")) m.push({ quoi: "Donneur d’ordre", etape: 1 });
  if (n("travaux") === 0) m.push({ quoi: "Travaux à réaliser", etape: 2 });
  if (n("elevation") + n("coupe") + n("autresMateriels") === 0) m.push({ quoi: "Matériels", etape: 2 });
  if (c.photoIds.length === 0) m.push({ quoi: "Carte / croquis / photo du chantier", etape: 3 });
  if (n("biologique") + n("balisage") + n("reseaux") + n("environnement") + n("coactivite") === 0 && c.risquesAutres.trim() === "") {
    m.push({ quoi: "Risques spécifiques au chantier", etape: 3 });
  }
  if (n("biologiqueMesures") + n("balisage") + n("reseauxMesures") + n("environnementMesures") + n("organisation") === 0 && c.mesuresAutres.trim() === "") {
    m.push({ quoi: "Mesures de sécurité", etape: 4 });
  }
  if (n("meteo") === 0) m.push({ quoi: "Conduite à tenir en cas de phénomènes météorologiques imprévus", etape: 4 });
  if (n("secours") === 0) m.push({ quoi: "Organisation des secours", etape: 5 });
  if (c.pointDeRencontre.trim() === "") m.push({ quoi: "Point de Rencontre des Secours", etape: 5 });
  if (c.lieuTrousse.trim() === "") m.push({ quoi: "Lieu où se trouve la trousse de secours", etape: 5 });
  return m;
}

/** Deux ans à compter de la signature — la durée du décret, jamais moins. */
export const CONSERVATION_ANNEES = 2;
export function gardeeJusquAu(signeeLe: Date): Date {
  const d = new Date(signeeLe.getTime());
  d.setFullYear(d.getFullYear() + CONSERVATION_ANNEES);
  return d;
}

/** Ce que le bandeau du planning écrit à droite de « Fiche de sécurité ». */
export function compteDuBandeau(fiche: { signeeLe: Date | null; transmiseLe: Date | null; etapeVue: number } | null): string {
  if (!fiche) return "à remplir";
  if (fiche.transmiseLe) return "transmise";
  if (fiche.signeeLe) return "signée";
  if (fiche.etapeVue <= 0) return "à remplir";
  return `${Math.min(fiche.etapeVue, NOMBRE_D_ETAPES)} sur ${NOMBRE_D_ETAPES}`;
}

/** Une signature au doigt compte quand elle a plus de quelques points : un tap n'est pas une signature. */
export const POINTS_MINIMUM_D_UNE_SIGNATURE = 8;

/** Le texte que le PDF (et la liste) écrivent sous une fiche signée. */
export function phraseDeGarde(signeeLe: Date, jourLong: (d: Date) => string): string {
  return `gardée jusqu’au ${jourLong(gardeeJusquAu(signeeLe))}`;
}
