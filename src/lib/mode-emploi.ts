/**
 * Le mode d'emploi d'Atlas, écran par écran — ce que l'assistant récite.
 *
 * **Sa demande du 25 août 2026 :** *« j'aimerais que l'assistant qui se trouve
 * dans l'application puisse expliquer chaque fonctionnalité de l'appli. Si
 * l'utilisateur lui demande par exemple : comment je fais pour supprimer un
 * client en attente de rédaction de son devis sur la page chantier, qu'il soit
 * en mesure de lui répondre : slide de droite à gauche puis appuie sur
 * retire. »*
 *
 * **Pourquoi une liste écrite, et pas un modèle qui devine.** Un modèle de
 * langage qui n'a pas l'écran sous les yeux invente un geste plausible — « allez
 * dans les réglages, puis Supprimer » —, et l'artisan le cherche pendant cinq
 * minutes avant de conclure que l'application est cassée. Un geste faux coûte
 * plus cher qu'un « je ne sais pas » : c'est la même règle que les prix
 * (`CLAUDE.md` §4). Ici, l'assistant ne récite QUE ce qui est écrit dans ce
 * fichier, et refuse quand il n'y trouve rien.
 *
 * **Et une fiche se PROUVE contre le code.** Chacune porte son fichier source et
 * des `preuves` : des morceaux de texte qui doivent s'y trouver. Le jour où le
 * bouton « Retirer » change de nom ou disparaît, `scripts/test-mode-emploi.ts`
 * rougit — plutôt que de laisser l'assistant enseigner un geste qui n'existe
 * plus. Une documentation périmée est pire qu'absente : on s'y fie encore
 * (`CLAUDE.md` §1).
 *
 * **Ce qui n'entre pas ici :** les données d'un chantier (les outils de lecture
 * s'en chargent), et nos raisons de conception — l'écran n'a pas besoin de
 * savoir pourquoi le glissement a remplacé la corbeille rouge.
 */

export type FicheModeEmploi = {
  /** Stable : il sert au diagnostic et aux suites. */
  id: string;
  /** L'écran, dit comme il s'appelle à l'écran : « Chantiers », « Planning ». */
  ecran: string;
  /** Où l'on est, en une ligne — de quoi s'y rendre sans chercher. */
  ou: string;
  /** Ce qu'on cherche à faire : « Retirer un chantier de la liste ». */
  intitule: string;
  /**
   * Les mots par lesquels il le demandera — les siens, pas les nôtres.
   * « supprimer » et « enlever » valent « retirer » : c'est ce qu'il tape.
   */
  motsCles: string[];
  /** LE GESTE, à l'impératif, sans un mot de trop. C'est la réponse. */
  geste: string;
  /** Ce que le geste refuse, quand il refuse. Vide sinon. */
  reserve?: string;
  /** Le fichier qui porte ce geste — c'est lui qui fait foi. */
  source: string;
  /** Ce qui doit se trouver dans `source` pour que la fiche reste vraie. */
  preuves: string[];
};

const FICHE_RETRAIT =
  "Glissez la ligne de droite à gauche, puis appuyez sur « Retirer ». " +
  "La ligne tombe et « Annuler » reste six secondes en bas de l'écran.";

export const FICHES_MODE_EMPLOI: FicheModeEmploi[] = [
  // --- Chantiers (l'accueil) ------------------------------------------------
  {
    id: "chantiers-retirer",
    ecran: "Chantiers",
    ou: "la liste des chantiers, l'écran d'accueil",
    intitule: "Retirer un chantier de la liste, devis pas encore écrit",
    motsCles: [
      "supprimer", "retirer", "enlever", "effacer", "virer", "chantier", "client",
      "liste", "accueil", "devis", "redaction", "rediger", "brouillon", "attente",
    ],
    geste: FICHE_RETRAIT,
    reserve:
      "Un chantier déjà facturé ne part pas : sa facture figure au relevé de TVA. " +
      "Le glissement découvre alors le motif à la place du bouton.",
    source: "src/app/EcranChantiers.tsx",
    preuves: ["useRetraits", "ListeChantiers", "TiroirDesRetires"],
  },
  {
    id: "chantiers-annuler-retrait",
    ecran: "Chantiers",
    ou: "n'importe quel écran d'où l'on retire quelque chose",
    intitule: "Annuler une suppression qu'on vient de faire",
    motsCles: ["annuler", "revenir", "restaurer", "recuperer", "erreur", "trompe", "supprimer", "retirer", "ligne", "trop", "vite"],
    geste: "Appuyez sur « Annuler » dans le bandeau du bas. Il reste six secondes.",
    reserve: "Passé ce délai, la suppression est écrite et ne se défait plus.",
    source: "src/components/atlas/useRetraits.ts",
    preuves: ["delaiMs = 6000", "annuler"],
  },
  {
    id: "chantiers-ouvrir",
    ecran: "Chantiers",
    ou: "la liste des chantiers",
    intitule: "Reprendre un chantier là où on s'est arrêté",
    motsCles: ["ouvrir", "reprendre", "continuer", "chantier", "toucher", "revenir", "etape"],
    geste: "Touchez la ligne : Atlas rouvre l'écran où le travail s'est arrêté, pas la fiche.",
    source: "src/app/ListeChantiers.tsx",
    preuves: ["reprise"],
  },
  {
    id: "chantiers-nouveau",
    ecran: "Chantiers",
    ou: "la liste des chantiers",
    intitule: "Créer un chantier, un devis",
    motsCles: ["creer", "nouveau", "ajouter", "devis", "chantier", "commencer", "demarrer", "client"],
    geste: "Appuyez sur « Créer un devis » en bas de la liste.",
    source: "src/app/EcranChantiers.tsx",
    preuves: ["Créer un devis"],
  },
  {
    id: "nouveau-chantier-saisie",
    ecran: "Un chantier",
    ou: "après « Créer un devis »",
    intitule: "Renseigner le client d'un nouveau chantier",
    motsCles: ["nouveau", "chantier", "client", "nom", "telephone", "email", "adresse", "photos", "saisir"],
    geste:
      "Remplissez la fiche client (nom, téléphone ou e-mail, adresse du chantier), " +
      "choisissez SMS ou e-mail, puis « Enregistrer ».",
    reserve: "Sans coordonnée, le devis ne pourra pas partir : mieux vaut la poser tout de suite.",
    source: "src/app/chantiers/nouveau/FormulaireNouveauChantier.tsx",
    preuves: ["Nom du client", "Par SMS", "Par e-mail", "Adresse du chantier"],
  },

  // --- La fiche du chantier -------------------------------------------------
  {
    id: "fiche-note-vocale",
    ecran: "Fiche du chantier",
    ou: "la fiche d'un chantier",
    intitule: "Dicter le chantier plutôt que de l'écrire",
    motsCles: ["dicter", "dictee", "vocal", "vocale", "note", "micro", "parler", "enregistrer", "voix"],
    geste: "Appuyez sur l'anneau du micro, parlez, appuyez à nouveau pour arrêter.",
    source: "src/app/chantiers/[id]/note-vocale/NoteVocaleClient.tsx",
    preuves: ["Enregistrer une note vocale", "J'écoute — touchez pour arrêter"],
  },
  {
    id: "note-vocale-completer",
    ecran: "Note vocale",
    ou: "l'écran de la note vocale",
    intitule: "Ajouter quelque chose à une note déjà enregistrée",
    motsCles: ["completer", "ajouter", "oublie", "reprendre", "note", "vocale", "suite"],
    geste: "Appuyez sur « Reprendre — j'avais oublié quelque chose », puis parlez.",
    source: "src/app/chantiers/[id]/note-vocale/NoteVocaleClient.tsx",
    preuves: ["Reprendre — j'avais oublié quelque chose"],
  },
  {
    id: "note-vocale-remplacer",
    ecran: "Note vocale",
    ou: "l'écran de la note vocale",
    intitule: "Refaire une note vocale depuis le début",
    motsCles: ["remplacer", "refaire", "recommencer", "note", "vocale", "effacer", "supprimer"],
    geste: "Appuyez sur « Remplacer la note », confirmez, puis réenregistrez.",
    source: "src/app/chantiers/[id]/note-vocale/NoteVocaleClient.tsx",
    preuves: ["Remplacer la note", "Remplacer cette note vocale ?"],
  },
  {
    id: "note-vocale-fichier",
    ecran: "Note vocale",
    ou: "l'écran de la note vocale",
    intitule: "Envoyer un fichier audio déjà enregistré",
    motsCles: ["fichier", "audio", "importer", "televerser", "memo", "dictaphone", "ajouter"],
    geste: "Appuyez sur « Ajouter un fichier audio » et choisissez l'enregistrement.",
    source: "src/app/chantiers/[id]/note-vocale/NoteVocaleClient.tsx",
    preuves: ["Ajouter un fichier audio"],
  },
  {
    id: "transcription-corriger",
    ecran: "Transcription",
    ou: "l'écran de la transcription, après la dictée",
    intitule: "Corriger le texte qu'Atlas a entendu",
    motsCles: ["corriger", "transcription", "texte", "faute", "modifier", "ecrire", "mal", "compris"],
    geste: "Appuyez sur « Corriger le texte à la main », modifiez, puis « Enregistrer le texte ».",
    source: "src/app/chantiers/[id]/transcription/TexteDicte.tsx",
    preuves: ["Corriger le texte à la main", "Enregistrer le texte"],
  },
  {
    id: "photos-ajouter",
    ecran: "Fiche du chantier",
    ou: "la pellicule, sur la fiche du chantier",
    intitule: "Ajouter ou retirer une photo de chantier",
    motsCles: ["photo", "photos", "image", "ajouter", "supprimer", "retirer", "pellicule", "appareil"],
    geste:
      "Appuyez sur la pellicule pour ajouter une photo. Pour en retirer une, " +
      "glissez sa ligne de droite à gauche puis « Retirer ».",
    source: "src/app/chantiers/[id]/Pellicule.tsx",
    preuves: ["useRetraits", "TiroirDesRetires"],
  },

  // --- Informations, prix, devis --------------------------------------------
  {
    id: "informations-prestations",
    ecran: "Informations",
    ou: "l'écran Informations d'un chantier",
    intitule: "Ajouter, corriger ou retirer une prestation ou du matériel",
    motsCles: [
      "prestation", "prestations", "materiel", "ajouter", "modifier", "corriger",
      "supprimer", "retirer", "informations", "ligne",
    ],
    geste:
      "Appuyez sur la ligne pour la corriger, sur « + » pour en ajouter une. " +
      "Pour en retirer une : glissez de droite à gauche, puis « Retirer ».",
    source: "src/app/chantiers/[id]/informations/InformationsClient.tsx",
    preuves: ["LigneRetirable", "useRetraits", "Prestations", "Matériel"],
  },
  {
    id: "informations-duree-equipe",
    ecran: "Informations",
    ou: "l'écran Informations d'un chantier",
    intitule: "Changer la durée du chantier ou la taille de l'équipe",
    motsCles: ["duree", "temps", "jours", "equipe", "combien", "hommes", "personnes", "modifier"],
    geste: "Appuyez sur « Ce chantier prend » ou sur « Équipe », et changez la valeur.",
    source: "src/app/chantiers/[id]/informations/InformationsClient.tsx",
    preuves: ["Ce chantier prend", "Équipe"],
  },
  {
    id: "informations-valider",
    ecran: "Informations",
    ou: "en bas de l'écran Informations",
    intitule: "Passer des informations au prix",
    motsCles: ["valider", "prix", "calculer", "suite", "continuer", "informations", "etape"],
    geste: "Appuyez sur « Valider et calculer le prix ».",
    source: "src/app/chantiers/[id]/informations/InformationsClient.tsx",
    preuves: ["Valider et calculer le prix"],
  },
  {
    id: "prix-lignes",
    ecran: "Prix",
    ou: "l'écran Prix d'un chantier",
    intitule: "Ajouter, corriger ou retirer une ligne de prix",
    motsCles: ["prix", "ligne", "montant", "tarif", "ajouter", "modifier", "supprimer", "retirer", "euro"],
    geste:
      "Appuyez sur une ligne pour changer son libellé ou son montant. " +
      "Pour la retirer : glissez de droite à gauche, puis « Retirer ».",
    source: "src/app/chantiers/[id]/prix/PrixClient.tsx",
    preuves: ["LigneRetirable", "useRetraits"],
  },
  {
    id: "prix-preparer-devis",
    ecran: "Prix",
    ou: "en bas de l'écran Prix",
    intitule: "Passer du prix au devis",
    motsCles: ["preparer", "devis", "prix", "continuer", "suite", "generer"],
    geste: "Appuyez sur « Préparer le devis ».",
    source: "src/app/chantiers/[id]/prix/PrixClient.tsx",
    preuves: ["Préparer le devis"],
  },
  {
    id: "devis-ligne-retirer",
    ecran: "Devis",
    ou: "le devis complet d'un chantier",
    intitule: "Retirer une ligne du devis",
    motsCles: ["devis", "ligne", "supprimer", "retirer", "enlever", "effacer"],
    geste: FICHE_RETRAIT,
    reserve: "Un devis déjà parti chez le client ne se modifie plus : il faut le reprendre (voir « Corriger un devis envoyé »).",
    source: "src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx",
    preuves: ["LigneRetirable", "useRetraits"],
  },
  {
    id: "devis-remise",
    ecran: "Devis",
    ou: "sous le total du devis",
    intitule: "Faire une remise au client",
    motsCles: ["remise", "reduction", "geste", "pourcentage", "rabais", "prix", "accorde"],
    geste: "Renseignez le pourcentage dans « Prix accordé au client, en pourcentage ».",
    source: "src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx",
    preuves: ["Prix accordé au client, en pourcentage"],
  },
  {
    id: "devis-tva",
    ecran: "Devis",
    ou: "sous le total du devis",
    intitule: "Changer le taux de TVA d'un devis",
    motsCles: ["tva", "taux", "10", "20", "changer", "devis"],
    geste: "Appuyez sur « Taux de TVA » et choisissez le taux.",
    source: "src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx",
    preuves: ["Taux de TVA"],
  },
  {
    id: "devis-apercu",
    ecran: "Devis",
    ou: "en bas du devis complet",
    intitule: "Voir le devis tel que le client le recevra",
    motsCles: ["apercu", "pdf", "voir", "regarder", "imprimer", "devis", "telecharger"],
    geste: "Appuyez sur « Aperçu du PDF ».",
    source: "src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx",
    preuves: ["Aperçu du PDF"],
  },
  {
    id: "devis-dates",
    ecran: "Envoi au client",
    ou: "l'écran d'envoi du devis",
    intitule: "Proposer une ou deux dates d'intervention au client",
    motsCles: ["date", "dates", "proposer", "intervention", "calendrier", "jour", "choisir"],
    geste: "Touchez les jours voulus dans le calendrier : les toucher suffit, il n'y a rien à valider.",
    reserve: "Le client ne verra que la date, jamais la demi-journée.",
    source: "src/app/chantiers/[id]/export/EnvoiAuClient.tsx",
    // **La preuve visait une phrase qu'il a fait retirer le 26 août 2026.**
    // Elle vise maintenant le libellé de la molette, qui porte le geste — une
    // preuve doit s'accrocher à ce que l'écran FAIT, pas à ce qu'il explique
    // (`CLAUDE.md` §5 bis). La réserve ci-dessus, elle, reste vraie : c'est
    // l'assistant qui la dit, pas l'écran.
    preuves: ["Proposez une ou deux dates", "Ce chantier prend"],
  },
  {
    id: "devis-envoyer",
    ecran: "Envoi au client",
    ou: "en bas de l'écran d'envoi",
    intitule: "Envoyer le devis au client",
    motsCles: ["envoyer", "envoi", "devis", "client", "sms", "mail", "email", "transmettre"],
    geste: "Choisissez SMS ou e-mail, puis appuyez sur « Envoyer le devis ».",
    reserve: "Rien ne part sans ce geste : Atlas n'envoie jamais de lui-même.",
    source: "src/app/chantiers/[id]/export/EnvoiAuClient.tsx",
    preuves: ["Envoyer le devis", "Par SMS", "Par e-mail"],
  },
  {
    id: "devis-corriger-envoye",
    ecran: "Devis envoyé",
    ou: "l'écran du devis, une fois parti",
    intitule: "Corriger un devis déjà envoyé",
    motsCles: ["corriger", "modifier", "devis", "envoye", "parti", "erreur", "renvoyer", "reprendre"],
    geste: "Appuyez sur « Modifier mon devis », puis « Corriger et renvoyer ».",
    reserve: "Une nouvelle version part chez le client : l'ancienne reste au dossier.",
    source: "src/app/chantiers/[id]/export/ExportClient.tsx",
    preuves: ["Modifier mon devis", "Corriger et renvoyer"],
  },
  {
    id: "devis-telecharger",
    ecran: "Devis envoyé",
    ou: "l'écran du devis, une fois parti",
    intitule: "Télécharger le PDF d'un devis",
    motsCles: ["telecharger", "pdf", "devis", "garder", "enregistrer", "fichier"],
    geste: "Appuyez sur « Télécharger le PDF ».",
    source: "src/app/chantiers/[id]/export/ExportClient.tsx",
    preuves: ["Télécharger le PDF"],
  },

  // --- Facture --------------------------------------------------------------
  {
    id: "facture-creer",
    ecran: "Facture",
    ou: "la fiche du chantier, une fois le chantier réalisé",
    intitule: "Facturer un chantier",
    motsCles: ["facturer", "facture", "creer", "encaisser", "payer", "fin", "termine"],
    geste: "Appuyez sur « Créer la facture ». Atlas reprend le devis tel quel.",
    source: "src/app/chantiers/[id]/facture/FactureClient.tsx",
    preuves: ["Créer la facture", "Reprise du devis"],
  },
  {
    id: "facture-echeance",
    ecran: "Facture",
    ou: "l'écran de la facture, tant qu'elle est brouillon",
    intitule: "Changer la date d'échéance d'une facture",
    motsCles: ["echeance", "date", "regler", "delai", "paiement", "avant", "changer"],
    geste: "Appuyez sur la date sous « À régler avant le » et choisissez-en une autre.",
    reserve: "Une facture arrêtée fige son échéance : elle ne se corrige plus.",
    source: "src/app/chantiers/[id]/facture/FactureClient.tsx",
    preuves: ["À régler avant le"],
  },
  {
    id: "facture-envoyer",
    ecran: "Facture",
    ou: "en bas de l'écran de la facture",
    intitule: "Envoyer la facture au client",
    motsCles: ["envoyer", "facture", "client", "sms", "mail", "email", "transmettre"],
    geste: "Choisissez SMS ou e-mail, puis « Envoyer la facture ».",
    reserve: "Une fois partie, une correction passe par un avoir — la facture ne se réécrit pas.",
    source: "src/app/chantiers/[id]/facture/FactureClient.tsx",
    preuves: ["Envoyer la facture", "Une correction passerait par un avoir."],
  },
  {
    id: "facture-pdf",
    ecran: "Facture",
    ou: "l'écran de la facture",
    intitule: "Voir la facture en PDF",
    motsCles: ["pdf", "facture", "voir", "apercu", "imprimer"],
    geste: "Appuyez sur « Voir la facture en PDF ».",
    source: "src/app/chantiers/[id]/facture/FactureClient.tsx",
    preuves: ["Voir la facture en PDF"],
  },

  // --- Planning -------------------------------------------------------------
  {
    id: "planning-poser",
    ecran: "Planning",
    ou: "l'écran Planning",
    intitule: "Poser un chantier sur un jour",
    motsCles: ["planning", "planifier", "poser", "jour", "date", "semaine", "ajouter", "chantier", "calendrier"],
    geste: "Touchez le jour, puis « Ajouter un chantier », et choisissez matin, après-midi ou journée.",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["Ajouter un chantier", "Matin", "Journée"],
  },
  {
    id: "planning-deplacer",
    ecran: "Planning",
    ou: "la fiche d'un chantier du planning",
    intitule: "Déplacer un chantier planifié",
    motsCles: ["deplacer", "bouger", "changer", "jour", "reporter", "decaler", "planning"],
    geste: "Ouvrez la fiche du chantier dans le planning, puis appuyez sur « Déplacer ».",
    reserve: "Un chantier dont le client a retenu la date refuse d'être déplacé, et le dit.",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["Déplacer", "Déplacement refusé"],
  },
  {
    id: "planning-retirer",
    ecran: "Planning",
    ou: "la fiche d'un chantier du planning",
    intitule: "Retirer un chantier du planning",
    motsCles: ["retirer", "supprimer", "enlever", "planning", "annuler", "jour"],
    geste: FICHE_RETRAIT,
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["LigneRetirable", "Retirer"],
  },
  {
    id: "planning-note",
    ecran: "Planning",
    ou: "la fiche d'un chantier du planning",
    intitule: "Laisser une note sur une journée",
    motsCles: ["note", "penser", "rappel", "ecrire", "memo", "journee", "planning"],
    geste: "Écrivez dans « Ma note », sur la fiche du jour. Elle s'enregistre toute seule.",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["Ma note", "Enregistré."],
  },
  {
    id: "planning-itineraire",
    ecran: "Planning",
    ou: "la fiche d'un chantier du planning",
    intitule: "Y aller, appeler le client, copier l'adresse",
    motsCles: ["maps", "waze", "itineraire", "route", "aller", "appeler", "telephone", "adresse", "copier"],
    geste: "Sur la fiche du chantier : « Maps », « Waze », « Appeler le client » ou « Copier l'adresse ».",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["Maps", "Waze", "Appeler le client"],
  },
  {
    id: "planning-feuille",
    ecran: "Planning",
    ou: "la fiche d'un chantier du planning",
    intitule: "Donner la feuille de chantier à l'équipe, sans les prix",
    motsCles: ["feuille", "chantier", "equipe", "ouvrier", "papier", "prix", "sans", "pdf", "imprimer"],
    geste: "Appuyez sur « Feuille de chantier », puis « Ouvrir le PDF sans les prix ».",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["Feuille de chantier", "Ouvrir le PDF sans les prix"],
  },
  {
    id: "planning-semaine",
    ecran: "Planning",
    ou: "en haut de l'écran Planning",
    intitule: "Voir une autre semaine",
    motsCles: ["semaine", "suivante", "precedente", "avancer", "reculer", "changer", "planning"],
    geste: "Appuyez sur les chevrons de part et d'autre de la semaine.",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["Semaine précédente", "Semaine suivante"],
  },

  // --- Terminés et TVA ------------------------------------------------------
  {
    id: "termines-facturer",
    ecran: "Terminés",
    ou: "l'écran Terminés",
    intitule: "Retrouver les chantiers finis qui ne sont pas encore facturés",
    motsCles: ["termine", "termines", "fini", "facturer", "reste", "oublie", "impaye", "liste"],
    geste: "Ouvrez « Terminés », puis l'onglet « À facturer ».",
    source: "src/app/termines/ListeTermines.tsx",
    preuves: ["À facturer", "Pas encore facturé"],
  },
  {
    id: "tva",
    ecran: "Ma TVA",
    ou: "l'écran Terminés",
    intitule: "Savoir combien de TVA déclarer",
    motsCles: ["tva", "declarer", "declaration", "collectee", "deductible", "impot", "etat", "periode", "voir", "vois", "combien"],
    geste: "Depuis « Terminés », appuyez sur « Ma TVA à déclarer ».",
    source: "src/app/termines/tva/page.tsx",
    preuves: ["Ma TVA", "Collectée", "Déductible"],
  },

  // --- Clients --------------------------------------------------------------
  {
    id: "clients-liste",
    ecran: "Vos clients",
    ou: "l'écran des clients",
    intitule: "Retrouver un client et tout ce qui le concerne",
    motsCles: ["client", "clients", "fiche", "retrouver", "historique", "dossier", "devis", "facture"],
    geste: "Ouvrez « Vos clients », puis touchez son nom : ses devis, factures et fiches de chantier y sont.",
    source: "src/app/clients/[id]/page.tsx",
    preuves: ["Devis", "Facture", "Fiche chantier"],
  },

  // --- Catalogue et vocabulaire --------------------------------------------
  {
    id: "catalogue-mots",
    ecran: "Catalogue",
    ou: "Réglages, puis Tarifs & catalogue, puis Le catalogue",
    intitule: "Apprendre à Atlas un mot du métier",
    motsCles: ["mot", "mots", "vocabulaire", "catalogue", "comprendre", "apprendre", "dictee", "ecime", "jargon"],
    geste: "Dans « Mes mots », écrivez le mot tel que vous le dites, puis « Ajouter ».",
    source: "src/app/catalogue/MesMots.tsx",
    preuves: ["Ajouter", "Comme vous le dites"],
  },
  {
    id: "vocabulaire-regles",
    ecran: "Le vocabulaire de mon métier",
    ou: "Réglages, puis Atlas IA",
    intitule: "Poser une règle que l'IA doit suivre",
    motsCles: ["regle", "regles", "ia", "consigne", "vocabulaire", "habitude", "toujours", "devis"],
    geste: "Dans « Mes règles », écrivez la règle en une phrase, puis « Ajouter ».",
    source: "src/app/reglages/vocabulaire/VocabulaireClient.tsx",
    preuves: ["Mes règles", "La règle, en une phrase"],
  },

  // --- Réglages : l'entreprise ---------------------------------------------
  {
    id: "reglages-identite",
    ecran: "Mon entreprise",
    ou: "Réglages, puis Mon entreprise",
    intitule: "Changer le nom, l'adresse, le SIRET, l'IBAN de l'entreprise",
    motsCles: ["entreprise", "identite", "nom", "adresse", "siret", "iban", "tva", "coordonnees", "siege"],
    geste: "Ouvrez « Mon entreprise », corrigez le champ, puis « Enregistrer ».",
    reserve: "Ces informations figurent en tête de chaque devis et de chaque facture.",
    source: "src/app/reglages/identite/IdentiteClient.tsx",
    preuves: ["Nom de l'entreprise", "Adresse du siège", "Enregistrer"],
  },
  {
    id: "reglages-tarifs",
    ecran: "Mes tarifs",
    ou: "Réglages, puis Tarifs & catalogue, puis Mes prix",
    intitule: "Ajouter, corriger ou retirer un tarif",
    motsCles: ["tarif", "tarifs", "prix", "ajouter", "modifier", "supprimer", "retirer", "grille", "catalogue"],
    geste:
      "Écrivez l'intitulé et le prix, puis « Ajouter ». " +
      "Pour retirer un tarif : glissez sa ligne de droite à gauche, puis « Retirer ».",
    source: "src/app/reglages/ReglagesClient.tsx",
    preuves: ["LigneRetirable", "Intitulé du tarif", "Prix du tarif"],
  },
  {
    id: "reglages-grilles",
    ecran: "Mes prix",
    ou: "Réglages, puis Tarifs & catalogue, puis Mes prix",
    intitule: "Régler un prix qui dépend du diamètre ou de la façon de faire",
    motsCles: ["grille", "diametre", "abattage", "cable", "facon", "travail", "prix", "mesure", "bareme"],
    geste: "Appuyez sur « Ajouter un travail », nommez-le, et choisissez comment son prix se décide.",
    source: "src/app/reglages/prix/GrillesPrixClient.tsx",
    preuves: ["Ajouter un travail", "Comment son prix se décide"],
  },
  {
    id: "reglages-documents",
    ecran: "Devis & factures",
    ou: "Réglages, puis Devis & factures",
    intitule: "Régler la validité d'un devis, l'acompte, le délai de paiement, les mentions",
    motsCles: ["validite", "acompte", "delai", "paiement", "mention", "condition", "document", "devis", "facture"],
    geste: "Ouvrez « Devis & factures » et réglez chaque valeur.",
    source: "src/lib/rubriques-reglages.ts",
    preuves: ["Devis & factures", "Validité, acompte, délai de paiement et mentions"],
  },
  {
    id: "reglages-allure-photo",
    ecran: "Devis & factures",
    ou: "Réglages, puis Devis & factures",
    intitule: "Reprendre l'allure de son ancien devis en le photographiant",
    motsCles: ["photo", "photographier", "allure", "couleur", "police", "logo", "devis", "reprendre", "modele"],
    geste: "Appuyez sur « Photographier mon devis » et choisissez l'appareil photo ou la photothèque.",
    reserve: "L'allure et les mentions sont reprises ; ni les lignes, ni les prix, ni le logo.",
    source: "src/app/reglages/documents/DocumentsClient.tsx",
    preuves: ["Photographier mon devis"],
  },
  {
    id: "reglages-equipe",
    ecran: "Équipe",
    ou: "Réglages, puis Équipe",
    // **Deux réglages distincts depuis le 26 août 2026** (`ARCHITECTURE.md`
    // §192) : combien de chantiers partent en même temps, et combien de gens
    // travaillent avec lui. Les confondre dans la réponse de l'assistant
    // remettrait dans sa tête la confusion qu'on vient de retirer du code.
    intitule: "Régler combien de chantiers partent en même temps, vos salariés et leurs absences",
    motsCles: ["equipe", "equipes", "salarie", "salaries", "nom", "prenom", "gars", "absence", "conge", "vacances", "combien", "partent"],
    geste: "Ouvrez « Équipe » : le nombre de chantiers menés en même temps, vos salariés et leurs absences s'y règlent.",
    source: "src/lib/rubriques-reglages.ts",
    preuves: ["Équipe", "Combien partent en même temps, leurs noms et leurs absences"],
  },
  {
    id: "reglages-fiche-entretien",
    ecran: "Fiche d'entretien",
    ou: "Réglages, puis Fiche d'entretien",
    intitule: "Composer la fiche qu'on coche sur un chantier d'entretien",
    motsCles: ["fiche", "entretien", "modele", "composer", "famille", "prestation", "cocher", "tonte"],
    geste: "Ouvrez « Fiche d'entretien », partez du modèle Atlas ou composez la vôtre.",
    reserve: "La modifier ne change aucun rapport déjà envoyé.",
    source: "src/app/reglages/fiche-entretien/FicheEntretienClient.tsx",
    preuves: ["Partir du modèle Atlas", "Je préfère composer la mienne"],
  },
  {
    id: "reglages-notifications",
    ecran: "Notifications",
    ou: "Réglages, puis Notifications",
    intitule: "Choisir ce qu'Atlas signale et quand",
    motsCles: ["notification", "notifications", "alerte", "rappel", "signaler", "relance", "impaye", "prevenir"],
    geste: "Ouvrez « Notifications » et réglez chaque rappel, ainsi que son délai.",
    reserve: "Deux alertes ne se coupent pas : la réponse à un devis et le lien de devis expiré.",
    source: "src/app/reglages/notifications/NotificationsClient.tsx",
    preuves: ["Ce qui vous est toujours signalé", "Ce que vous réglez"],
  },
  {
    id: "reglages-agenda",
    ecran: "Intégrations",
    ou: "Réglages, puis Intégrations",
    intitule: "Relier son agenda Google",
    motsCles: ["agenda", "calendrier", "google", "relier", "connecter", "brancher", "synchroniser", "doublon"],
    geste: "Ouvrez « Intégrations », puis « Relier mon agenda Google ».",
    reserve: "Sans lui, Atlas ne voit pas les rendez-vous notés ailleurs et un client peut retenir un jour déjà pris.",
    source: "src/app/reglages/agenda/AgendaClient.tsx",
    preuves: ["Relier mon agenda Google", "Mettre en pause"],
  },
  {
    id: "reglages-agenda-apple",
    ecran: "Intégrations",
    ou: "Réglages, puis Intégrations",
    intitule: "Relier son agenda Apple, iCloud",
    motsCles: ["agenda", "calendrier", "apple", "icloud", "iphone", "relier", "connecter", "synchroniser"],
    geste: "Ouvrez « Intégrations », puis « Relier mon agenda Apple ».",
    source: "src/app/reglages/agenda/AgendaAppleClient.tsx",
    preuves: ["Relier mon agenda Apple"],
  },
  {
    id: "reglages-donnees",
    ecran: "Sécurité & données",
    ou: "Réglages, puis Sécurité & données",
    intitule: "Télécharger toutes ses données",
    motsCles: ["donnee", "donnees", "export", "telecharger", "sauvegarde", "copie", "rgpd", "effacer"],
    geste: "Ouvrez « Sécurité & données », puis « Télécharger mes données ».",
    source: "src/app/reglages/donnees/page.tsx",
    preuves: ["Télécharger mes données"],
  },
  {
    id: "reglages-abonnement",
    ecran: "Abonnement",
    ou: "Réglages, puis Abonnement",
    intitule: "Voir son offre, son paiement et ses factures Atlas",
    motsCles: ["abonnement", "offre", "payer", "paiement", "facture", "atlas", "prix", "resilier"],
    geste: "Ouvrez « Abonnement ».",
    source: "src/lib/rubriques-reglages.ts",
    preuves: ["Abonnement", "Offre, paiement et factures Atlas"],
  },

  // --- Réglages : moi -------------------------------------------------------
  {
    id: "reglages-compte",
    ecran: "Mon compte",
    ou: "Réglages, puis Mon compte",
    intitule: "Changer son nom ou son e-mail",
    motsCles: ["compte", "nom", "email", "mail", "moi", "changer", "profil"],
    geste: "Ouvrez « Mon compte », corrigez, puis « Enregistrer ».",
    source: "src/app/reglages/compte/CompteClient.tsx",
    preuves: ["Qui vous êtes", "Enregistrer"],
  },
  {
    id: "reglages-mot-de-passe",
    ecran: "Connexion",
    ou: "Réglages, puis Connexion",
    intitule: "Changer son mot de passe",
    motsCles: ["mot", "passe", "motdepasse", "changer", "securite", "connexion", "identifiant"],
    geste: "Ouvrez « Connexion », puis « Changer de mot de passe ».",
    source: "src/app/reglages/connexion/ConnexionClient.tsx",
    preuves: ["Changer de mot de passe", "Nouveau mot de passe"],
  },
  {
    id: "reglages-face-id",
    ecran: "Connexion",
    ou: "Réglages, puis Connexion",
    intitule: "Ouvrir Atlas avec Face ID",
    motsCles: ["face", "id", "faceid", "empreinte", "biometrie", "ouvrir", "connexion", "rapide", "touch"],
    geste: "Ouvrez « Connexion », puis « Enregistrer cet appareil » sous « Ouvrir avec Face ID ».",
    reserve: "Votre mot de passe reste actif ; c'est à faire sur chaque appareil.",
    source: "src/app/reglages/connexion/SectionFaceId.tsx",
    preuves: ["Ouvrir avec Face ID", "Enregistrer cet appareil"],
  },
  {
    id: "reglages-deconnexion-partout",
    ecran: "Connexion",
    ou: "Réglages, puis Connexion",
    intitule: "Se déconnecter de tous ses appareils (téléphone perdu)",
    motsCles: ["deconnecter", "deconnexion", "partout", "perdu", "vole", "telephone", "appareil", "session"],
    geste: "Ouvrez « Connexion », puis « Me déconnecter partout ».",
    reserve: "Celui-ci compris : vous devrez vous reconnecter.",
    source: "src/app/reglages/connexion/ConnexionClient.tsx",
    preuves: ["Me déconnecter partout"],
  },
  {
    id: "reglages-apparence",
    ecran: "Apparence",
    ou: "Réglages, puis Apparence",
    intitule: "Changer les couleurs de l'application, passer en sombre",
    motsCles: ["couleur", "couleurs", "charte", "apparence", "sombre", "nuit", "theme", "clair", "mode", "fond"],
    geste: "Ouvrez « Apparence » et touchez la charte voulue. « Nuit » et « Sylve » sont sombres.",
    source: "src/app/reglages/apparence/ApparenceClient.tsx",
    preuves: ["Votre charte", "Nuit", "Sylve"],
  },

  // --- Paysage --------------------------------------------------------------
  {
    id: "paysage-arrosage",
    ecran: "Plan d'arrosage automatique",
    ou: "Paysage, puis Plan d'arrosage automatique",
    intitule: "Faire un plan d'arrosage",
    motsCles: ["arrosage", "plan", "reseau", "arroseur", "turbine", "tuyere", "croquis", "piquage", "nourrice"],
    geste:
      "Dites où se fait le piquage, relevez le débit au seau, puis « Ajouter la photo du croquis ».",
    reserve:
      "Le croquis doit porter les métrés, l'endroit du piquage et l'endroit définitif de la nourrice. " +
      "Sans les trois, aucun plan n'est proposé.",
    source: "src/app/paysage/arrosage/ArrosageClient.tsx",
    preuves: ["Le piquage se fait…", "Mesure au seau", "Ajouter la photo du croquis"],
  },
  {
    id: "paysage-fiche",
    ecran: "Fiche de chantier",
    ou: "Paysage, puis Fiche de chantier",
    intitule: "Cocher ce qui a été fait et l'envoyer au client",
    motsCles: ["fiche", "chantier", "entretien", "cocher", "rapport", "compte", "rendu", "envoyer", "passage"],
    geste: "Cochez les prestations faites, ajoutez vos observations, puis « Enregistrer et envoyer ».",
    reserve: "Le temps passé n'apparaît chez le client que si vous le rendez visible.",
    source: "src/app/paysage/fiche/[id]/FicheChantierClient.tsx",
    preuves: ["Enregistrer et envoyer", "Temps passé", "Observations"],
  },
  {
    id: "paysage-fiche-composer",
    ecran: "Fiche de chantier",
    ou: "Paysage, puis Fiche de chantier",
    intitule: "Composer sa fiche d'entretien depuis Paysage",
    motsCles: ["composer", "fiche", "modele", "entretien", "creer", "prestation"],
    geste: "En bas de l'écran, appuyez sur « Composer ma fiche ».",
    reserve: "Réservé au patron : c'est à lui de la composer.",
    source: "src/app/paysage/fiche/page.tsx",
    preuves: ["Composer ma fiche"],
  },
  {
    id: "paysage-diagnostic",
    ecran: "Diagnostic végétal",
    ou: "Paysage, puis Diagnostic végétal",
    intitule: "Savoir ce qu'a un arbre ou une plante",
    motsCles: ["diagnostic", "vegetal", "maladie", "arbre", "feuille", "champignon", "photo", "anomalie", "ecorce"],
    geste: "Appuyez sur « Prendre une photo » et photographiez la zone anormale.",
    source: "src/app/paysage/diagnostic/page.tsx",
    preuves: ["Prendre une photo", "Photographiez la zone qui vous semble anormale."],
  },

  // --- L'assistant lui-même -------------------------------------------------
  {
    id: "assistant-ouvrir",
    ecran: "Assistant",
    ou: "l'en-tête de chaque écran",
    intitule: "Ouvrir l'assistant",
    motsCles: ["assistant", "aide", "question", "ouvrir", "bulle", "parler", "toi"],
    geste: "Appuyez sur la pastille ronde en haut à droite de l'écran.",
    source: "src/components/atlas/BoutonAssistant.tsx",
    preuves: ["Ouvrir l'assistant"],
  },
  {
    id: "assistant-copier-ligne",
    ecran: "Assistant",
    ou: "l'assistant, depuis un devis ouvert",
    intitule: "Reprendre une ligne du devis d'un autre client",
    motsCles: ["reprendre", "copier", "ligne", "devis", "autre", "client", "meme", "chercher", "poser"],
    geste:
      "Ouvrez le devis où poser la ligne, puis demandez à l'assistant, par exemple : " +
      "« reprends la ligne d'élagage du devis de Bernard ». Il la cherche, la propose, et vous la validez.",
    reserve: "Le montant est relu sur la ligne d'origine au moment où vous validez : rien n'est recopié de mémoire.",
    source: "src/server/ai/tools/rechercher-lignes-devis.ts",
    preuves: ["RechercherLignesDevis"],
  },
];

// --- La recherche ---------------------------------------------------------

/**
 * Les mots qui ne discriminent rien.
 *
 * **Sans eux, tout ressort.** « comment je fais pour supprimer un client » —
 * « pour », « un », « je » sont dans la moitié des fiches, et le classement se
 * décide alors sur du bruit plutôt que sur « supprimer » et « client ».
 */
const MOTS_VIDES = new Set([
  "je", "j", "tu", "il", "on", "me", "moi", "mon", "ma", "mes", "le", "la", "les", "l", "un", "une", "des", "du", "de",
  "d", "et", "ou", "a", "au", "aux", "en", "y", "que", "qui", "quoi", "est", "ce", "cet", "cette", "ces", "se", "sur",
  "dans", "pour", "avec", "sans", "par", "pas", "plus", "faire", "fais", "fait", "peux", "puis", "veux", "vais",
  "comment", "où", "quand", "pourquoi", "est-ce", "s", "si", "son", "sa", "ses", "leur", "nous", "vous", "ils",
  "app", "appli", "application", "atlas", "page", "ecran",
]);

/** Sans accents, sans ponctuation, en minuscules — il tape comme il parle. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function motsUtiles(texte: string): string[] {
  return normaliser(texte)
    .split(" ")
    .filter((m) => m.length > 1 && !MOTS_VIDES.has(m));
}

/**
 * Un mot de la question est-il dans cet ensemble ?
 *
 * **Par PRÉFIXE au-delà de quatre lettres**, et c'est ce qui rend la recherche
 * utilisable : il tape « facture » là où la fiche dit « facturer », « supprimer »
 * là où elle dit « supprime ». Sans cela, la bonne fiche existait et ne sortait
 * pas. Quatre lettres, parce qu'en dessous les faux voisins abondent (« mot » et
 * « moteur »).
 */
function contient(ensemble: Set<string>, mot: string): boolean {
  if (ensemble.has(mot)) return true;
  if (mot.length < 4) return false;
  for (const candidat of ensemble) {
    if (candidat.length >= 4 && (candidat.startsWith(mot) || mot.startsWith(candidat))) return true;
  }
  return false;
}

/**
 * Le score d'une fiche pour une question.
 *
 * **Les mots-clés pèsent plus que le geste**, et c'est délibéré : ils sont
 * choisis pour être ce qu'il tape, tandis que le geste contient des mots de
 * liaison qui apparaissent partout (« appuyez », « écran »).
 *
 * **Les trois sources s'AJOUTENT.** Elles s'excluaient, et deux fiches
 * concurrentes tombaient alors à égalité sur leur seul mot-clé commun — le
 * départage se faisait par ordre alphabétique, c'est-à-dire au hasard :
 * « comment on fait une facture » sortait la fiche des clients avant celle qui
 * facture. Un mot qui est à la fois dans les mots-clés ET dans l'intitulé
 * désigne une fiche plus précisément qu'un mot qui n'est que dans l'un des deux.
 */
function score(fiche: FicheModeEmploi, mots: string[]): { points: number; motsTrouves: number } {
  const cles = new Set(fiche.motsCles.flatMap((m) => motsUtiles(m)));
  const titre = new Set(motsUtiles(`${fiche.intitule} ${fiche.ecran}`));
  const corps = new Set(motsUtiles(`${fiche.geste} ${fiche.ou} ${fiche.reserve ?? ""}`));

  let points = 0;
  let motsTrouves = 0;
  for (const mot of new Set(mots)) {
    let gain = 0;
    if (contient(cles, mot)) gain += 3;
    if (contient(titre, mot)) gain += 2;
    if (contient(corps, mot)) gain += 1;
    if (gain > 0) {
      points += gain;
      motsTrouves++;
    }
  }
  return { points, motsTrouves };
}

/**
 * Les fiches qui répondent à une question, la meilleure d'abord.
 *
 * **Rend un tableau VIDE plutôt qu'une fiche au hasard.** C'est tout l'intérêt :
 * l'assistant doit pouvoir dire « je ne sais pas » (le service le lui impose),
 * et il ne le peut que si la recherche sait ne rien trouver.
 *
 * **DEUX mots communs, pas un.** « Quel temps fait-il ? » partageait « temps »
 * avec la fiche de la durée d'un chantier, et sortait donc une réponse à une
 * question qui n'en était pas une. Un seul mot commun ne fait pas une réponse —
 * et une réponse qui parle à tort s'apprend à être ignorée, ce qui coûte le
 * garde-fou entier. La règle se relâche pour les questions de deux mots
 * (« mode sombre ? »), où il n'y a rien de plus à partager.
 */
export function chercherFiches(question: string, maximum = 3): FicheModeEmploi[] {
  const mots = motsUtiles(question);
  if (mots.length === 0) return [];
  const exigeDeuxMots = mots.length >= 3;
  return FICHES_MODE_EMPLOI.map((fiche) => ({ fiche, ...score(fiche, mots) }))
    .filter((c) => c.points >= 3 && (!exigeDeuxMots || c.motsTrouves >= 2))
    .sort((a, b) => b.points - a.points || a.fiche.id.localeCompare(b.fiche.id))
    .slice(0, maximum)
    .map((c) => c.fiche);
}
