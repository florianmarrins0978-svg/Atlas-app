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
 * (`MemoireDesFiches`) — jamais un choix de l'application.
 *
 * **CE QUE LA LOI EXIGE BLOQUE ; LE RESTE NON — sa règle du 14 octobre 2026.**
 * Il avait d'abord voulu une signature toujours possible (*« au bon vouloir de
 * l'utilisateur »*, 21 septembre). Après avoir signé et enregistré une fiche au
 * croquis inachevé sur la planche `appli/fiche-de-securite-mieux.html` : *« si
 * il n'y a pas le minimum légal, la fiche ne peut pas s'enregistrer et se
 * finaliser, et un message doit indiquer ce qu'il faut faire »*. Le minimum
 * légal (`minimumLegal`) bloque donc la signature ; tout le reste se dit
 * « conseillé » et ne bloque rien. « Rien à signaler » est une réponse : un
 * risque regardé et absent compte, un risque oublié non.
 *
 * **La fiche complète, codée le 14 octobre 2026** d'après les photos de Kleyk
 * qu'il a envoyées (*« si t'as pas ça, c'est pas bon »*) : sous-traitants,
 * plusieurs responsables, l'équipe et ses compétences, EPI, situation des
 * travaux, arbres dangereux un par un, noyade, protocole d'entrée en zone de
 * danger, croquis dessiné (`croquis-securite.ts`), signature de chaque salarié.
 * Les mots ajoutés aux listes de la MSA sont des noms de matériel et de risques
 * communs au métier ; les textes de Kleyk ne sont pas recopiés.
 */
import { filtrerClientsParNom, normaliserPourRecherche } from "./recherche-client";
import { dansLaPeriode } from "./periode";
import { croquisRecu, croquisVide, manquesDuCroquis, type Croquis } from "./croquis-securite";

/** La réponse « j'ai regardé, il n'y a rien » : elle se coche seule, et décoche le reste de sa famille. */
export const RIEN_A_SIGNALER = "Rien à signaler";
export const REPONSES_VIDES: readonly string[] = [RIEN_A_SIGNALER, "Pas de risque de noyade", "Pas besoin pour ce chantier"];

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
    "Débitage d’arbre au sol",
    "Débroussaillage",
    "Démontage d’arbres tombés sur un obstacle",
    "Conduite d’engins",
    "Entretien d’espace vert",
    "Création d’espace vert",
  ],
  epi: [
    "Contrôle visuel des EPI fait",
    "Chaussures de sécurité anti-coupure",
    "Pantalon anti-coupure",
    "Manchettes anti-coupure",
    "Visière et lunettes",
    "Gants",
    "Casque de protection",
    "Casque de communication",
    "Protection auditive",
    "Talkie-walkie",
    "Harnais ou baudrier d’élagage",
    "Corde de travail (rappel)",
    "Corde d’accès (secours)",
    "Longe de maintien",
    "Mousqueton à triple verrouillage",
    "Descendeur mécanique",
    "Descendeur textile",
    "Sifflet",
  ],
  elevation: ["Pas besoin pour ce chantier", "Nacelle (PEMP)", "PIRL", "EPI de grimper", "Échelle", "Échafaudage", "La nacelle ne peut pas être utilisée ici"],
  coupe: ["Tronçonneuse élagueuse", "Tronçonneuse abatteuse", "Lamier d’élagage", "Scie sur perche", "Sécateur"],
  autresMateriels: ["Broyeur", "Essoucheuse / Rogneuse", "Treuil / Câble", "Mini chargeur", "Souffleur", "Scie à main", "Matériel de rétention et de freinage", "Grue", "Engin de coupe mécanisé"],
  situation: [
    "Jardin privé",
    "Voie publique en ville",
    "Voie ferrée",
    "Ligne électrique de transport",
    "Forêt ouverte au public",
    "Site industriel classé Seveso",
    "Arrêté municipal ou document particulier",
  ],
  risquesArbres: [
    "Rien à signaler",
    "Chute de branches ou de charges pendant les travaux",
    "Chute de bois avec la grue",
    "Fissures, champignons ou cavités visibles du sol",
    "Charpentière cassée récemment",
  ],
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
    "Rien à signaler",
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
  reseaux: ["Rien à signaler", "Électrique", "Eau, Vapeur", "Gaz", "Télécom", "Fibre"],
  tensions: ["HTB (U > 50 000 V)", "HTA (U ≤ 50 000 V)", "BT (U ≤ 1 000 V)"],
  reseauxMesures: [
    "DT DICT declaration-travaux-proximite-reseaux (chantier distant < 50 m conducteurs électriques nus ou lors d’arrachage d’arbre, de creusement de tranchées…)",
    "AIPR (Formulaire)",
    "Distance de sécurité à respecter vis-à-vis des conducteurs électriques nus :",
  ],
  distances: ["HTB (U > 50 000 V) : 5 m", "HTA (U ≤ 50 000 V) : 3 m", "BT (U ≤ 1 000 V) : 3 m"],
  noyade: ["Pas de risque de noyade", "Piscine", "Rivière", "Lac", "Fleuve", "Étang ou bassin"],
  environnement: [
    "Rien à signaler",
    "Routier",
    "Facteurs météo ambiants",
    "Bruit",
    "État des sols",
    "Conditions de vie sur le chantier",
    "Éclairage",
    "Vapeurs",
    "Poussières",
    "Noyade",
    "Passants non autorisés",
    "Corde happée par un outil en marche",
    "Pollution accidentelle",
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
    "Rien à signaler",
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
    "Protocole de secours propre au site, lu",
  ],
} as const;

/** Ce qu'on voit sur un arbre dangereux, et ce qu'on fait pour lui : des mots, que l'artisan complète. */
export const DANGERS_D_UN_ARBRE = ["Arbre mort", "Bois mort", "Défaut de structure", "Fissure", "Cavité", "Champignons", "Chancre", "Suie", "Frelons", "Charpentière cassée récemment"] as const;
export const CONSIGNES_D_UN_ARBRE = ["Utiliser une nacelle", "Utiliser un engin de coupe mécanisé", "Rubalise autour du tronc", "Prévenir toute l’équipe"] as const;
/** Ce qu'une personne de l'équipe sait faire : des diplômes et des formations, qu'on complète. */
export const FORMATIONS = ["CS élagage", "Grimpeur élagueur (taille)", "Grimpeur élagueur (démontage)", "CACES nacelle", "Habilitation électrique", "AIPR", "Autorisation de conduite interne", "Mini-pelle et chargeur", "CAP", "BTS"] as const;

/**
 * LE PROTOCOLE D'ENTRÉE EN ZONE DE DANGER — un texte modèle, écrit ici, à
 * adapter au chantier. Kleyk en propose un ; le leur n'est pas recopié.
 */
export const PROTOCOLE_MODELE = [
  "1. Se faire voir ou entendre de celui qui travaille dans la zone.",
  "2. Attendre qu’il arrête sa machine ou sa coupe.",
  "3. Entrer seulement quand il fait signe, avec ses EPI.",
  "4. Lui dire où l’on se trouve tant qu’on est dans la zone.",
  "5. Le prévenir en sortant, avant qu’il reprenne.",
].join("\n");

export type Famille = keyof typeof LIBELLES;

/**
 * Les familles auxquelles l'artisan ajoute ses propres mots, gardés d'une fiche
 * à l'autre. Les sous-cases (tensions, distances) restent celles de la feuille.
 */
export const FAMILLES_AVEC_AJOUTS: readonly Famille[] = [
  "travaux",
  "epi",
  "situation",
  "risquesArbres",
  "noyade",
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

export const ETAPES = ["Le chantier", "Les travaux", "Croquis et balisage", "Les risques", "Mesures et secours", "Signer"] as const;
export const ETAPES_COURTES = ["Chantier", "Travaux", "Croquis", "Risques", "Secours", "Signer"] as const;
export const NOMBRE_D_ETAPES = ETAPES.length;

/** Une personne de l'équipe. Ses compétences s'écrivent une fois et reviennent sur chaque fiche. */
export type Personne = {
  nom: string;
  /** Vient sur CE chantier. Un absent se décoche : il n'a pas à signer la fiche. */
  present: boolean;
  formations: string[];
  /** Date d'obtention, `AAAA-MM-JJ`, ou vide. Les 24 mois se calculent (`validite`). */
  sst: string;
  gsa: string;
};
/** Une entreprise qui travaille sur le même chantier : sous-traitant, électricien, grutier… */
export type EntrepriseSurPlace = { nom: string; tel: string; quoi: string; presente: boolean; montree: boolean };
export type Responsable = { nom: string; tel: string };
export type ArbreDangereux = {
  /** Un arbre seul, ou un groupe d'arbres traités ensemble. Son numéro est celui du croquis. */
  groupe: boolean;
  intervention: "Abattage" | "Élagage" | null;
  dangers: string[];
  consignes: string[];
  autres: string;
};
/** La signature d'un salarié qui a lu la fiche, posée APRÈS celle du chef d'entreprise. */
export type Lecture = { nom: string; png: string; le: string };

/** Ce que la fiche porte. Rien ne se pré-coche ; seul le minimum légal bloque (`minimumLegal`). */
export type ContenuFiche = {
  /** Le client du devis, ou quelqu'un d'autre — *« pas toujours le client »*. */
  donneur: "client" | "autre" | null;
  donneurNom: string;
  donneurPrenom: string;
  donneurTel: string;
  gps: string;
  /** L'adresse officielle la plus proche du point GPS, lue à la Base Adresse Nationale ; vide quand rien n'y est connu. */
  adresseDuPoint: string;
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
  /**
   * Le nom tel qu'il sera signé — dans le contenu, et non plus dans l'état de
   * l'écran : il s'enregistre en même temps que le reste, et se garde
   * (22 septembre 2026). La colonne `signataire` de la fiche ne porte que le
   * nom FIGÉ à la signature, celui du PDF.
   */
  signataire: string;
  /** Propriétaire, syndic, mairie : ce que le client est pour le chantier. */
  donneurRole: string;
  /** Le portail ou le chemin par où les secours entrent, s'il n'est pas l'adresse du chantier. */
  adresseSecours: string;
  /** Les responsables en plus du premier (`responsableNom`, qui reste à sa place). */
  autresResponsables: Responsable[];
  entreprisesSurPlace: "aucune" | "oui" | null;
  entreprises: EntrepriseSurPlace[];
  equipe: Personne[];
  arbresDangereux: "non" | "oui" | null;
  arbres: ArbreDangereux[];
  croquis: Croquis;
  protocole: string;
  /**
   * **Ce qui vient APRÈS la signature du chef**, par des gestes à eux
   * (`completerLaFicheSignee`) : les salariés qui signent l'avoir lue, à qui
   * elle a été envoyée, et l'enregistrement final. Le téléphone ne les écrit
   * jamais avec le reste du contenu (`contenuRecu` les laisse de côté) : une
   * fiche ne se déclare pas lue par quelqu'un qui ne l'a pas signée.
   */
  lectures: Lecture[];
  prevention: "oui" | "non" | null;
  envois: string[];
  finaliseeLe: string | null;
};

export function contenuVide(): ContenuFiche {
  return {
    donneur: null,
    donneurNom: "",
    donneurPrenom: "",
    donneurTel: "",
    gps: "",
    adresseDuPoint: "",
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
    signataire: "",
    donneurRole: "",
    adresseSecours: "",
    autresResponsables: [],
    entreprisesSurPlace: null,
    entreprises: [],
    equipe: [],
    arbresDangereux: null,
    arbres: [],
    croquis: croquisVide(),
    protocole: PROTOCOLE_MODELE,
    lectures: [],
    prevention: null,
    envois: [],
    finaliseeLe: null,
  };
}

/**
 * **CE QUE LE TÉLÉPHONE ENVOIE SE VÉRIFIE, AVANT TOUTE ÉCRITURE.**
 *
 * Trouvé par la campagne de sécurité de l'établi QA, le 13 octobre 2026. Le
 * formulaire envoie toujours une fiche bien formée ; un appel fait à la main,
 * non. Rien n'était vérifié : n'importe quelle forme entrait en base, jusqu'à
 * 15 Mo par envoi (la limite des actions serveur) et toutes les deux secondes,
 * et une forme fausse (des cases qui ne sont pas une liste, des photos qui ne
 * sont pas un tableau) rendait la fiche et son PDF illisibles. Pour un document
 * qu'un contrôleur peut demander deux ans durant, c'est une fiche détruite.
 *
 * Les bornes sont larges : aucune fiche remplie au doigt ne les approche. Ce qui
 * n'est pas un champ de la fiche est laissé de côté, jamais écrit.
 */
export const LONGUEUR_MAX_D_UN_TEXTE = 4_000;
export const LONGUEUR_MAX_D_UN_MOT = 200;
export const MOTS_MAX_PAR_FAMILLE = 100;
/** Un chantier ne porte pas plus de photos que son plafond (`photos-plafonds.ts`). */
export const PHOTOS_MAX_SUR_LA_FICHE = 30;
export const PERSONNES_MAX = 60;
export const ENTREPRISES_MAX = 40;
export const RESPONSABLES_MAX = 10;
export const ARBRES_MAX = 60;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const texteCourt = (v: unknown, max = LONGUEUR_MAX_D_UN_MOT): v is string => typeof v === "string" && v.length <= max;
const motsCourts = (v: unknown, max = MOTS_MAX_PAR_FAMILLE): v is string[] => Array.isArray(v) && v.length <= max && v.every((m) => texteCourt(m));

/** Une liste d'objets du formulaire : bornée, chaque élément relu par `lire`, sinon refusée entière. */
function listeRecue<T>(brut: unknown, max: number, lire: (x: Record<string, unknown>) => T | null): T[] | null {
  if (brut === undefined) return [];
  if (!Array.isArray(brut) || brut.length > max) return null;
  const sortie: T[] = [];
  for (const x of brut) {
    if (!estUnObjet(x)) return null;
    const lu = lire(x);
    if (lu === null) return null;
    sortie.push(lu);
  }
  return sortie;
}

const IDENTIFIANT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EcritureDeLaFiche = { contenu: ContenuFiche; etapeVue: number; loiLue: boolean };

function estUnObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Des cases ou des ajouts : famille connue, liste de mots courts, en nombre borné. */
function motsRecus(brut: unknown, quoi: string): { ok: true; mots: Partial<Record<Famille, string[]>> } | { ok: false; raison: string } {
  if (brut === undefined) return { ok: true, mots: {} };
  if (!estUnObjet(brut)) return { ok: false, raison: `${quoi} : la forme est fausse.` };
  const mots: Partial<Record<Famille, string[]>> = {};
  for (const [famille, liste] of Object.entries(brut)) {
    if (!(famille in LIBELLES)) return { ok: false, raison: `${quoi} : famille inconnue.` };
    if (!Array.isArray(liste) || liste.length > MOTS_MAX_PAR_FAMILLE) return { ok: false, raison: `${quoi} : la liste est fausse ou trop longue.` };
    if (!liste.every((m) => typeof m === "string" && m.length <= LONGUEUR_MAX_D_UN_MOT)) {
      return { ok: false, raison: `${quoi} : un mot est faux ou trop long.` };
    }
    mots[famille as Famille] = liste as string[];
  }
  return { ok: true, mots };
}

export function contenuRecu(brut: unknown): { ok: true; contenu: ContenuFiche } | { ok: false; raison: string } {
  if (!estUnObjet(brut)) return { ok: false, raison: "La fiche reçue n’a pas la bonne forme." };
  const contenu = contenuVide();
  const textes = contenu as unknown as Record<string, unknown>;
  for (const champ of Object.keys(textes)) {
    if (typeof textes[champ] !== "string" || brut[champ] === undefined) continue;
    const valeur = brut[champ];
    if (typeof valeur !== "string" || valeur.length > LONGUEUR_MAX_D_UN_TEXTE) {
      return { ok: false, raison: "Un champ de la fiche est faux ou trop long." };
    }
    textes[champ] = valeur;
  }
  if (brut.donneur !== undefined) {
    if (brut.donneur !== null && brut.donneur !== "client" && brut.donneur !== "autre") return { ok: false, raison: "Le donneur d’ordre est faux." };
    contenu.donneur = brut.donneur;
  }
  if (brut.nombreDeTravailleurs !== undefined) {
    const n = brut.nombreDeTravailleurs;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 999) return { ok: false, raison: "Le nombre de travailleurs est faux." };
    contenu.nombreDeTravailleurs = n;
  }
  const lesCoches = motsRecus(brut.coches, "Les cases");
  if (!lesCoches.ok) return lesCoches;
  const lesAjouts = motsRecus(brut.ajouts, "Les ajouts");
  if (!lesAjouts.ok) return lesAjouts;
  contenu.coches = lesCoches.mots;
  contenu.ajouts = lesAjouts.mots;
  if (brut.photoIds !== undefined) {
    const ids = brut.photoIds;
    if (!Array.isArray(ids) || ids.length > PHOTOS_MAX_SUR_LA_FICHE || !ids.every((id) => typeof id === "string" && IDENTIFIANT.test(id))) {
      return { ok: false, raison: "Les photos de la fiche sont fausses." };
    }
    contenu.photoIds = ids as string[];
  }
  const forme = (raison: string) => ({ ok: false as const, raison });
  if (brut.entreprisesSurPlace !== undefined) {
    if (brut.entreprisesSurPlace !== null && brut.entreprisesSurPlace !== "aucune" && brut.entreprisesSurPlace !== "oui") return forme("Les entreprises sur place sont fausses.");
    contenu.entreprisesSurPlace = brut.entreprisesSurPlace;
  }
  if (brut.arbresDangereux !== undefined) {
    if (brut.arbresDangereux !== null && brut.arbresDangereux !== "non" && brut.arbresDangereux !== "oui") return forme("Les arbres dangereux sont faux.");
    contenu.arbresDangereux = brut.arbresDangereux;
  }
  const responsables = listeRecue(brut.autresResponsables, RESPONSABLES_MAX, (x) =>
    texteCourt(x.nom) && texteCourt(x.tel) ? { nom: x.nom, tel: x.tel } : null
  );
  if (!responsables) return forme("Les responsables sont faux.");
  const entreprises = listeRecue(brut.entreprises, ENTREPRISES_MAX, (x) =>
    texteCourt(x.nom) && texteCourt(x.tel) && texteCourt(x.quoi) && typeof x.presente === "boolean" && typeof x.montree === "boolean"
      ? { nom: x.nom, tel: x.tel, quoi: x.quoi, presente: x.presente, montree: x.montree }
      : null
  );
  if (!entreprises) return forme("Les entreprises sont fausses.");
  const equipe = listeRecue(brut.equipe, PERSONNES_MAX, (x) =>
    texteCourt(x.nom) && typeof x.present === "boolean" && motsCourts(x.formations, 40) &&
    typeof x.sst === "string" && (x.sst === "" || DATE_ISO.test(x.sst)) && typeof x.gsa === "string" && (x.gsa === "" || DATE_ISO.test(x.gsa))
      ? { nom: x.nom, present: x.present, formations: x.formations, sst: x.sst, gsa: x.gsa }
      : null
  );
  if (!equipe) return forme("L’équipe est fausse.");
  const arbres = listeRecue(brut.arbres, ARBRES_MAX, (x) =>
    typeof x.groupe === "boolean" && (x.intervention === null || x.intervention === "Abattage" || x.intervention === "Élagage") &&
    motsCourts(x.dangers, 40) && motsCourts(x.consignes, 40) && texteCourt(x.autres, LONGUEUR_MAX_D_UN_TEXTE)
      ? { groupe: x.groupe, intervention: x.intervention as ArbreDangereux["intervention"], dangers: x.dangers, consignes: x.consignes, autres: x.autres }
      : null
  );
  if (!arbres) return forme("Les arbres dangereux sont faux.");
  const croquis = croquisRecu(brut.croquis);
  if (!croquis.ok) return croquis;
  contenu.autresResponsables = responsables;
  contenu.entreprises = entreprises;
  contenu.equipe = equipe;
  contenu.arbres = arbres;
  contenu.croquis = croquis.croquis;
  return { ok: true, contenu };
}

/** Le contenu, l'étape où l'on en est, la loi lue : ce qu'un « Suivant » écrit. */
export function ecritureRecue(brut: unknown): { ok: true; ecriture: EcritureDeLaFiche } | { ok: false; raison: string } {
  if (!estUnObjet(brut)) return { ok: false, raison: "La fiche reçue n’a pas la bonne forme." };
  const { etapeVue, loiLue } = brut;
  if (typeof etapeVue !== "number" || !Number.isInteger(etapeVue) || etapeVue < 0 || etapeVue > NOMBRE_D_ETAPES) {
    return { ok: false, raison: "L’étape de la fiche est fausse." };
  }
  if (typeof loiLue !== "boolean") return { ok: false, raison: "La fiche reçue n’a pas la bonne forme." };
  const contenu = contenuRecu(brut.contenu);
  if (!contenu.ok) return contenu;
  return { ok: true, ecriture: { contenu: contenu.contenu, etapeVue, loiLue } };
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
  const vide = REPONSES_VIDES.includes(libelle);
  // « Rien à signaler » et un risque coché ne se contredisent pas sur la même fiche :
  // l'un décoche l'autre, dans les deux sens.
  const apres = avant.includes(libelle)
    ? avant.filter((x) => x !== libelle)
    : vide
      ? [libelle]
      : [...avant.filter((x) => !REPONSES_VIDES.includes(x)), libelle];
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
 *
 * **Les noms aussi — sa plainte du 22 septembre 2026 :** *« la case nom et
 * prénom ne s'enregistre pas d'une fiche à l'autre ! »*. Le responsable sur
 * place et le signataire sont les mêmes d'un chantier à l'autre : ils se
 * gardent, comme la main d'œuvre qu'ils encadrent.
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
  responsableNom: string;
  responsablePrenom: string;
  responsableTel: string;
  signataire: string;
  /**
   * **Sa règle du 14 octobre 2026 : « tout ce qui peut être enregistré pour être
   * réappris sur les prochaines fiches, il faut le faire ».** L'équipe et ses
   * compétences, les entreprises habituelles, son protocole, ses responsables.
   * Ce qui ne se garde jamais reste propre au chantier : le lieu, le GPS, les
   * dates, le donneur d'ordre, le croquis, les photos, les arbres dangereux, le
   * point de rencontre.
   */
  equipe: Personne[];
  entreprises: EntrepriseSurPlace[];
  protocole: string;
  autresResponsables: Responsable[];
};
export function memoireVide(): MemoireDesFiches {
  return { mainDOeuvre: "", lieuTrousse: "", risquesAutres: "", mesuresAutres: "", observations: "", ajouts: {}, coches: {}, communication: "", environnementPreciser: "", organisationCommunication: "", responsableNom: "", responsablePrenom: "", responsableTel: "", signataire: "", equipe: [], entreprises: [], protocole: "", autresResponsables: [] };
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
    responsableNom: contenu.responsableNom,
    responsablePrenom: contenu.responsablePrenom,
    responsableTel: contenu.responsableTel,
    signataire: contenu.signataire,
    // Les personnes et les entreprises se gardent ; leur présence, non : elle est propre au chantier.
    equipe: contenu.equipe,
    entreprises: contenu.entreprises.map((x) => ({ ...x, presente: false, montree: false })),
    protocole: contenu.protocole,
    autresResponsables: contenu.autresResponsables,
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
    responsableNom: memoire.responsableNom,
    responsablePrenom: memoire.responsablePrenom,
    responsableTel: memoire.responsableTel,
    signataire: memoire.signataire,
    // Sur un chantier neuf, toute l'équipe est cochée : un absent se décoche, il ne s'oublie pas.
    equipe: memoire.equipe.map((x) => ({ ...x, present: true })),
    entreprises: memoire.entreprises,
    protocole: memoire.protocole || PROTOCOLE_MODELE,
    autresResponsables: memoire.autresResponsables,
  };
}

/** Un élément que la loi exige et qui manque : ce que c'est, ce qu'il faut faire, et où. */
export type Manque = { quoi: string; faire: string; etape: number; bloc: string };

/** Les cinq familles de risques à regarder, chacune avec sa réponse « rien ». */
export const RISQUES_A_REGARDER: readonly (readonly [Famille, string, string])[] = [
  ["risquesArbres", "les arbres", "risques-arbres"],
  ["biologique", "le biologique", "risques-biologiques"],
  ["reseaux", "les réseaux", "risques-reseaux"],
  ["noyade", "la noyade", "risques-noyade"],
  ["environnement", "l’environnement", "risques-environnement"],
];

/**
 * LE MINIMUM LÉGAL — ce que l'art. R. 717-85-16 exige, relu dans la notice MSA :
 * le lieu, les travaux, le matériel, les dates ; le croquis ; les risques ; les
 * mesures, dont la délimitation du chantier que le décret rend obligatoire ; les
 * secours ; la conduite à tenir si le temps tourne. Sans eux, la fiche ne se
 * signe pas (sa règle du 14 octobre 2026). Le lieu et les dates viennent du
 * chantier : ils ne manquent que si le chantier ne les porte pas.
 */
export function minimumLegal(contenu: ContenuFiche, chantier: { adresse: string | null; datePlanifiee: string | null }): Manque[] {
  const c = contenu;
  const n = (famille: Famille) => coches(c, famille).filter((x) => !REPONSES_VIDES.includes(x)).length;
  const m: Manque[] = [];
  if (!chantier.adresse && !c.gps.trim()) m.push({ quoi: "Le lieu", faire: "Relevez la position GPS : le chantier n’a pas d’adresse.", etape: 1, bloc: "lieu" });
  if (!chantier.datePlanifiee) m.push({ quoi: "Les dates", faire: "Posez le chantier au planning : la fiche reprend ses jours.", etape: 1, bloc: "lieu" });
  if (n("travaux") === 0) m.push({ quoi: "Les travaux", faire: "Cochez au moins un type de travaux.", etape: 2, bloc: "travaux" });
  if (n("elevation") + n("coupe") + n("autresMateriels") === 0) m.push({ quoi: "Le matériel", faire: "Cochez le matériel ou les moyens d’élévation utilisés.", etape: 2, bloc: "materiel" });
  const croquis = manquesDuCroquis(c.croquis);
  if (croquis.length > 0) m.push({ quoi: "Le croquis", faire: `Posez sur le croquis : ${croquis.join(", ")}.`, etape: 3, bloc: "croquis" });
  if (coches(c, "balisage").length === 0) m.push({ quoi: "La délimitation du chantier", faire: "Cochez comment le chantier est balisé.", etape: 3, bloc: "balisage" });
  const sansReponse = RISQUES_A_REGARDER.filter(([f]) => coches(c, f).length === 0);
  if (sansReponse.length > 0) {
    m.push({ quoi: "Les risques", faire: `Répondez pour ${sansReponse.map(([, mot]) => mot).join(", ")}. « Rien à signaler » compte comme une réponse.`, etape: 4, bloc: sansReponse[0][2] });
  }
  if (coches(c, "meteo").length === 0) m.push({ quoi: "La météo", faire: "Cochez la conduite à tenir si le temps tourne.", etape: 5, bloc: "meteo" });
  if (coches(c, "secours").length === 0 || !c.pointDeRencontre.trim() || !c.lieuTrousse.trim()) {
    m.push({ quoi: "Les secours", faire: "Cochez les secours prévus, et écrivez le point de rencontre et le lieu de la trousse.", etape: 5, bloc: "secours" });
  }
  return m;
}

/** La même phrase partout où la signature est refusée faute du minimum légal. */
export function refusDuMinimumLegal(m: readonly Manque[]): string {
  return `Il manque ${m.length} élément${m.length > 1 ? "s" : ""} que la loi exige : ${m.map((x) => x.quoi.toLowerCase()).join(", ")}.`;
}

/** Deux noms désignent-ils la même personne ? Sans casse ni espaces en trop. */
const memeNom = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * QUI DOIT ENCORE SIGNER L'AVOIR LUE — chaque personne présente, sauf le chef
 * d'entreprise qui a signé la fiche. La notice MSA : *« chaque intervenant sur
 * le chantier doit avoir pris connaissance de cette fiche avant le début des
 * travaux »*. Sa règle du 14 octobre : tant qu'il en manque un, la fiche ne
 * s'enregistre pas ; un absent se décoche de l'équipe.
 */
export function lecturesManquantes(contenu: ContenuFiche): string[] {
  return contenu.equipe
    .filter((p) => p.present && p.nom.trim() && !memeNom(p.nom, contenu.signataire))
    .filter((p) => !contenu.lectures.some((l) => memeNom(l.nom, p.nom)))
    .map((p) => p.nom.trim());
}

/** Peut-on enregistrer la fiche pour de bon ? `null` si oui, sinon la phrase qui dit quoi faire. */
export function refusDeFinaliser(contenu: ContenuFiche, signee: boolean, chantier: { adresse: string | null; datePlanifiee: string | null }): string | null {
  const legal = minimumLegal(contenu, chantier);
  if (legal.length > 0) return refusDuMinimumLegal(legal);
  if (!signee) return "Signez la fiche avant de l’enregistrer.";
  const manquent = lecturesManquantes(contenu);
  if (manquent.length > 0) return `${manquent.join(" et ")} ${manquent.length > 1 ? "doivent" : "doit"} signer avant d’enregistrer la fiche.`;
  return null;
}

/**
 * LE SST ET LE GSA DURENT 24 MOIS — ils se calculent sur la date d'obtention,
 * ils ne se cochent pas (Kleyk les fait recocher à la main sur chaque fiche).
 */
export const MOIS_DE_VALIDITE = 24;
export function validite(obtenu: string, aujourdhui: Date): { ok: boolean; fin: Date | null } {
  if (!DATE_ISO.test(obtenu)) return { ok: false, fin: null };
  const [a, m, j] = obtenu.split("-").map(Number);
  const fin = new Date(Date.UTC(a, m - 1 + MOIS_DE_VALIDITE, j));
  return { ok: fin.getTime() >= aujourdhui.getTime(), fin };
}

/** Deux ans à compter de la signature — la durée du décret, jamais moins. */
export const CONSERVATION_ANNEES = 2;
export function gardeeJusquAu(signeeLe: Date): Date {
  const d = new Date(signeeLe.getTime());
  d.setFullYear(d.getFullYear() + CONSERVATION_ANNEES);
  return d;
}

/** Ce que le bandeau du planning écrit à droite de « Fiche de sécurité ». */
export function compteDuBandeau(fiche: { signeeLe: Date | null; transmiseLe: Date | null; etapeVue: number; contenu?: ContenuFiche } | null): string {
  if (!fiche) return "à remplir";
  // Signée par le chef, la fiche n'est pas finie tant que l'équipe ne l'a pas lue et qu'elle n'est pas enregistrée.
  if (fiche.signeeLe && fiche.contenu && fiche.contenu.equipe.length > 0 && !fiche.contenu.finaliseeLe) {
    return lecturesManquantes(fiche.contenu).length > 0 ? "à faire lire" : "à enregistrer";
  }
  if (fiche.transmiseLe) return "transmise";
  if (fiche.signeeLe) return "signée";
  if (fiche.etapeVue <= 0) return "à remplir";
  return `${Math.min(fiche.etapeVue, NOMBRE_D_ETAPES)} sur ${NOMBRE_D_ETAPES}`;
}

/** Une signature au doigt compte quand elle a plus de quelques points : un tap n'est pas une signature. */
export const POINTS_MINIMUM_D_UNE_SIGNATURE = 8;

/**
 * Le trait mesure 600 sur 260 (`pngDeLaSignature`) : même dense, il tient très
 * en dessous. Au-delà, ce n'est pas une signature, c'est un envoi qui remplit
 * la base.
 */
export const LONGUEUR_MAX_D_UNE_SIGNATURE = 500_000;

const ENTETE_PNG = "data:image/png;base64,";
/** Les huit octets qui ouvrent tout PNG, écrits en base64. */
const MAGIE_PNG = "iVBORw0KGgo";

/**
 * **Une signature est un vrai PNG, tracé au doigt** : sinon le PDF de la fiche
 * embarque ce qu'on lui a donné, et une image qui n'en est pas une le fait
 * tomber, pour une fiche que le contrôleur demandera.
 */
export function refusDeLaSignature(png: unknown, points: unknown): string | null {
  if (typeof points !== "number" || points < POINTS_MINIMUM_D_UNE_SIGNATURE) return "Signez au doigt avant de signer la fiche.";
  if (typeof png !== "string" || !png.startsWith(ENTETE_PNG) || png.length > LONGUEUR_MAX_D_UNE_SIGNATURE) {
    return "Signez au doigt avant de signer la fiche.";
  }
  const donnees = png.slice(ENTETE_PNG.length);
  if (!donnees.startsWith(MAGIE_PNG) || !/^[A-Za-z0-9+/]+={0,2}$/.test(donnees)) return "Signez au doigt avant de signer la fiche.";
  return null;
}

/** Le texte que le PDF (et la liste) écrivent sous une fiche signée. */
export function phraseDeGarde(signeeLe: Date, jourLong: (d: Date) => string): string {
  return `gardée jusqu’au ${jourLong(gardeeJusquAu(signeeLe))}`;
}

/**
 * LES FICHES QUE LA LISTE DE PAYSAGE MONTRE — le mois ou le jour choisi, ou le
 * nom tapé.
 *
 * **Sa demande du 22 septembre 2026 :** *« faut pouvoir faire une recherche par
 * nom aussi et il te sort toutes les fiches de ce client »*. Un nom tapé passe
 * donc PAR-DESSUS le mois : la fiche de juin d'un client se retrouve depuis
 * septembre, sans tourner la roue mois par mois.
 *
 * La comparaison est celle de la recherche des clients (`filtrerClientsParNom`),
 * sur le client et sur le nom du chantier — une seule façon de chercher un nom
 * dans l'application (`CLAUDE.md` §3).
 *
 * **Le jour aussi — sa demande du même soir :** *« rajoute le jour aussi en
 * filtre jour mois année »*. La période est donc `2026-09` (le mois) ou
 * `2026-09-22` (le jour), lue à l'heure du patron (`dansLaPeriode`).
 */
export function fichesAMontrer<T extends { client: string; chantierNom: string; signeeLe: Date }>(
  fiches: readonly T[],
  choix: { periode: string; saisie: string }
): T[] {
  if (normaliserPourRecherche(choix.saisie)) {
    return filtrerClientsParNom(
      fiches.map((f) => ({ nom: `${f.client} ${f.chantierNom}`, fiche: f })),
      choix.saisie
    ).map((x) => x.fiche);
  }
  return fiches.filter((f) => dansLaPeriode(f.signeeLe, choix.periode));
}
