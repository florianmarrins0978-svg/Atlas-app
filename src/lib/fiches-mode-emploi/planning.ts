/**
 * Mode d'emploi : Le planning, la fiche d'intervention, les équipes et la fiche de sécurité.
 *
 * Chaque fiche se prouve contre le code (`scripts/test-mode-emploi.ts`) : la
 * règle, la recherche et le pourquoi vivent dans `src/lib/mode-emploi.ts`.
 */
import type { FicheModeEmploi } from "../mode-emploi";

const PC = "src/app/planning/PlanningClient.tsx";
const FS = "src/app/planning/FicheDeSecurite.tsx";
const FORM = "src/app/planning/fiche-de-securite/[chantierId]/FormulaireFicheDeSecurite.tsx";
const TRAVAUX = "src/app/planning/TravauxAFaire.tsx";

export const FICHES_PLANNING: FicheModeEmploi[] = [
  // --- Récritures -----------------------------------------------------------
  {
    id: "planning-deplacer",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le jour du chantier dans le calendrier",
    intitule: "Déplacer un chantier à un autre jour, ou seulement sa matinée ou son après-midi",
    motsCles: ["deplacer", "bouger", "changer", "reporter", "decaler", "jour", "date", "matin", "apres", "journee", "chantier", "planning"],
    geste:
      "Ouvrez le jour, appuyez sur « Déplacer » sous le chantier, touchez le nouveau jour dans le calendrier, " +
      "puis choisissez « Matin », « Après-midi » ou « Journée ».",
    reserve:
      "Seul ce que le chantier occupe ce jour-là part. « Journée » n'est proposé que s'il y occupe le matin et l'après-midi. " +
      "Un jour passé ne se déplace plus. « Annuler » arrête le geste.",
    source: PC,
    preuves: ['data-atlas="deplacer"', "Déplacer", "Touchez le jour au-dessus", "Quel moment ?", 'journee: "Journée"', "Annuler"],
    ailleurs: [{ source: "src/lib/creneaux-chantier.ts", preuves: ["Ce chantier occupe déjà ce moment-là."] }],
  },
  {
    id: "planning-retirer",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le jour du chantier",
    intitule: "Enlever un chantier d'un jour du planning, sans le supprimer",
    motsCles: ["retirer", "enlever", "deplanifier", "annuler", "date", "jour", "planning", "oter", "chantier"],
    geste:
      "Ouvrez le jour, puis appuyez sur « Retirer » sous le chantier. " +
      "Il perd sa date et retourne dans la liste du bas, « sans date ».",
    reserve:
      "Refusé si sa facture est déjà préparée : le chantier garde sa date. Un jour passé ne se modifie plus.",
    source: PC,
    preuves: ['data-atlas="retirer"', "Retirer", "deplanifierChantierAction"],
    ailleurs: [{ source: "src/app/planning/actions.ts", preuves: ["Sa facture est déjà préparée : le chantier garde sa date."] }],
  },
  {
    id: "planning-feuille",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le nom du chantier",
    intitule: "Donner la feuille de chantier à l'équipe, le devis sans les prix",
    motsCles: ["feuille", "equipe", "ouvrier", "papier", "prix", "sans", "pdf", "imprimer", "salarie"],
    geste:
      "Touchez le nom du chantier dans sa journée : « Ouvrir le devis sans les prix » est au bas de sa fiche d'intervention.",
    reserve: "Le bouton n'apparaît que si le chantier a un devis.",
    source: PC,
    preuves: ["pdf-sans-prix", "Ouvrir le devis sans les prix", "feuille?.avecDevis"],
  },
  // --- Le calendrier --------------------------------------------------------
  {
    id: "planning-mois",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, en haut de l'écran",
    intitule: "Changer de mois dans le calendrier",
    motsCles: ["mois", "suivant", "precedent", "prochain", "avancer", "reculer", "calendrier", "passer"],
    geste: "Appuyez sur les chevrons de part et d'autre du nom du mois, ou balayez le calendrier du doigt.",
    source: "src/components/atlas/MoisCharge.tsx",
    preuves: ['libelle="Mois précédent"', 'libelle="Mois suivant"', "pasDuGlissement"],
  },
  {
    id: "planning-ouvrir-jour",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas",
    intitule: "Voir ce qui est posé un jour donné, le matin et l'après-midi",
    motsCles: ["jour", "journee", "ouvrir", "voir", "vois", "pose", "calendrier", "matin", "apres", "occupe"],
    geste:
      "Touchez le jour dans le calendrier : sa carte s'ouvre dessous, avec le matin, l'après-midi et les chantiers posés. " +
      "Touchez-le à nouveau pour la fermer.",
    source: PC,
    preuves: ['data-atlas="carte-jour"', "onToucherJour={toucherLeJour}"],
    ailleurs: [{ source: "src/lib/planning-jour.ts", preuves: ['matin: "Matin"', 'apres_midi: "Après-midi"'] }],
  },
  {
    id: "planning-couleurs",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, le calendrier du mois",
    intitule: "Comprendre les couleurs des jours du calendrier",
    motsCles: ["couleur", "couleurs", "legende", "carre", "complet", "incomplet", "plein", "barre", "veut", "dire"],
    geste:
      "Chaque jour porte deux barres, le matin en haut et l'après-midi en bas. La légende sous le calendrier dit " +
      "« rien », « incomplet », « complet » ou « au-delà » de vos équipes.",
    source: "src/components/atlas/MoisCharge.tsx",
    preuves: ['data-atlas="legende"', "MOT_ETAT[etat]"],
    ailleurs: [{ source: "src/lib/planning-jour.ts", preuves: ['libre: "rien"', 'dispo: "incomplet"', 'plein: "complet"', 'dela: "au-delà"'] }],
    lieu: true,
  },
  // --- Ajouter --------------------------------------------------------------
  {
    id: "planning-ajouter-un-client",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le jour",
    intitule: "Poser directement un client sur un jour, sans devis",
    motsCles: ["ajouter", "client", "nouveau", "poser", "rendez", "sans", "devis", "direct", "creer", "noter"],
    geste:
      "Ouvrez le jour, appuyez sur « Ajouter » puis « Un client ». Tapez son nom et touchez-le s'il est proposé, " +
      "choisissez « Matin », « Après-midi » ou « Journée », puis « Poser ».",
    reserve:
      "Un nom inconnu crée sa fiche : Atlas demande alors téléphone, e-mail et adresse du chantier. " +
      "« Annuler » ramène aux trois choix.",
    source: PC,
    preuves: ['data-atlas="voie-client"', "Un client", 'placeholder="Nom du client"', "Inconnu, sa fiche sera créée", 'data-atlas="poser-le-client"', '"Poser"'],
  },
  {
    id: "planning-ajouter-autre-chose",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le jour",
    intitule: "Bloquer du temps pour autre chose qu'un chantier : banque, livraison, formation",
    motsCles: ["bloquer", "temps", "banque", "livraison", "formation", "rendez", "perso", "indisponible", "occupe", "autre"],
    geste:
      "Ouvrez le jour, appuyez sur « Ajouter » puis « Autre chose ». Écrivez ce que c'est, " +
      "choisissez le moment, puis « Poser ».",
    source: PC,
    preuves: ['data-atlas="voie-temps"', "Autre chose", 'placeholder="Rendez-vous à la banque, livraison…"', 'data-atlas="poser-le-temps"'],
  },
  {
    id: "planning-poser-depuis-le-bas",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, la barre dorée en bas de l'écran",
    intitule: "Poser un client sans date depuis la liste du bas",
    motsCles: ["sans", "date", "attente", "liste", "bas", "poser", "planifier", "client", "tiroir", "dater"],
    geste:
      "Touchez d'abord le jour dans le calendrier, ouvrez la barre du bas (« À poser sur… »), puis touchez le nom du client.",
    reserve: "Sans jour touché, la liste montre les clients « en attente d'un jour » sans pouvoir les poser.",
    source: PC,
    preuves: ['data-atlas="poignee-tiroir"', "À poser sur", " sans date", "Touchez d’abord un jour du calendrier", "en attente d’un jour"],
  },
  {
    id: "planning-annuler-pose",
    ecran: "Planning",
    ou: "la barre du bas du Planning, juste après avoir posé un chantier",
    intitule: "Annuler la pose qu'on vient de faire",
    motsCles: ["annuler", "pose", "erreur", "trompe", "mauvais", "jour", "defaire", "revenir"],
    geste: "Ouvrez la barre du bas : sur la ligne « est sur… », appuyez sur « Annuler ».",
    reserve: "Le chantier repart sans date.",
    source: PC,
    preuves: ['data-atlas="defaire-la-pose"', "est sur", "Annuler"],
  },
  {
    id: "planning-supprimer-sans-date",
    ecran: "Planning",
    ou: "la barre du bas du Planning, liste des clients sans date",
    intitule: "Supprimer un chantier qui attend une date",
    motsCles: ["supprimer", "effacer", "virer", "chantier", "date", "attente", "definitivement", "tiroir"],
    geste:
      "Ouvrez la barre du bas, glissez la ligne du chantier de droite à gauche, puis appuyez sur « Retirer ». " +
      "« Annuler » reste six secondes.",
    reserve: "Un chantier facturé ne se supprime pas : sa facture figure au relevé de TVA.",
    source: PC,
    preuves: ["LigneRetirable", 'data-atlas="sans-date"', "TiroirDesRetires", "supprimerChantierAction"],
    ailleurs: [
      { source: "src/components/atlas/LigneRetirable.tsx", preuves: ["Retirer"] },
      { source: "src/app/planning/actions.ts", preuves: ["Ce chantier est facturé"] },
    ],
  },
  {
    id: "planning-reposer-demi-journee",
    ecran: "Planning",
    ou: "la barre du bas du Planning",
    intitule: "Reposer une demi-journée de chantier qui attend",
    motsCles: ["demi", "journee", "reposer", "morceau", "attend", "reste", "poser", "moitie"],
    geste:
      "Ouvrez la barre du bas, touchez la ligne « ½ journée à poser », puis ouvrez un jour et appuyez sur « Poser ici » " +
      "en face du matin ou de l'après-midi libre.",
    reserve: "Le même morceau se prend aussi par « Ajouter », puis « Client en attente ».",
    source: PC,
    preuves: ["½ journée à poser", "demi-journées à poser", "touchez une demi-journée", "Poser ici", "{m.chantier.nom}, ½"],
  },
  {
    id: "planning-attente-client",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, en bas de l'écran : « En attente du client »",
    intitule: "Voir les clients qui choisissent eux-mêmes leur date",
    motsCles: ["attente", "client", "choisit", "choisir", "date", "reponse", "devis", "envoye"],
    geste:
      "Ouvrez la barre du bas : sous « En attente du client », chaque ligne dit « Il choisit sa date ». " +
      "Le chantier se pose tout seul quand il a choisi.",
    source: PC,
    preuves: ['"En attente du client"', "Il choisit sa date"],
    lieu: true,
  },
  // --- Équipes et absences --------------------------------------------------
  {
    id: "planning-equipe-cocher",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le jour du chantier",
    intitule: "Choisir quels salariés vont sur un chantier",
    motsCles: ["salarie", "salaries", "equipe", "affecter", "qui", "gars", "ouvrier", "cocher", "envoyer"],
    geste:
      "Ouvrez le jour, touchez « + Salarié » ou les noms en face du matin ou de l'après-midi, " +
      "touchez les noms à cocher ou décocher, puis « Fermer ».",
    reserve:
      "Il faut des salariés déclarés dans Réglages, Équipe. Un salarié absent ce jour-là est grisé.",
    source: PC,
    preuves: ['data-atlas="equipe"', "Salarié", "Fermer", "basculerEquipe(c.id, jour, demi, e.rang)"],
  },
  {
    id: "planning-absence",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le jour",
    intitule: "Noter qu'un salarié, ou soi même, est absent un jour",
    motsCles: ["absent", "absence", "malade", "conge", "vacances", "salarie", "repos", "indisponible", "manque"],
    geste:
      "Ouvrez le jour, appuyez sur « Salarié absent ? » puis sur son nom. Il est absent toute la journée : " +
      "touchez « Matin » ou « Après-midi » pour réduire.",
    reserve:
      "Seul, sans salarié, le bouton s'appelle « Absent ? ». Pour plusieurs jours d'affilée : Réglages, Équipe.",
    source: PC,
    // L'écran écrit une espace insécable avant le point d'interrogation.
    preuves: ['"Salarié absent ?"', '"Absent ?"','data-atlas="qui-nest-pas-la"', 'mot: "Journée"'],
  },
  {
    id: "planning-absence-retirer",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le jour",
    intitule: "Enlever une absence notée par erreur",
    motsCles: ["absence", "absent", "enlever", "supprimer", "annuler", "erreur", "revient", "present"],
    geste:
      "Ouvrez le jour : sur la ligne « Absent », appuyez sur la croix à droite. " +
      "Ou « Salarié absent ? » puis « son nom, annuler ».",
    source: PC,
    preuves: ['data-atlas="retirer-absence"', "Supprimer l’absence de", ", annuler", "Absent"],
  },
  {
    id: "planning-salarie-lecture",
    ecran: "Planning",
    ou: "« Planning », sur le téléphone d'un salarié",
    intitule: "Pourquoi un salarié ne peut pas modifier le planning",
    motsCles: ["salarie", "modifier", "lecture", "consulter", "droit", "bouton", "manque", "employe"],
    geste:
      "Un salarié consulte le planning : il ne voit ni « Ajouter », ni « Déplacer », ni « Retirer », et lit la note sans l'écrire.",
    reserve: "Il peut tout de même envoyer le retour du jour, dans « Travaux à faire ».",
    source: PC,
    preuves: ["peutModifierLePlanning(role)", "La note"],
  },
  // --- Les portes du chantier -----------------------------------------------
  {
    id: "planning-portes",
    ecran: "Planning",
    ou: "la liste sous le calendrier du Planning",
    intitule: "Ouvrir le devis, la fiche client ou la facture d'un chantier depuis le planning",
    motsCles: ["ouvrir", "devis", "fiche", "client", "facture", "chantier", "coordonnees", "acceder", "chevron"],
    geste:
      "Dans la liste sous le calendrier, touchez le chevron à droite du nom du chantier : " +
      "« Le devis », « La fiche client », et « Créer la facture » ou « La facture ».",
    reserve: "Réservé au patron. La ligne du devis dit s'il est parti, accepté, refusé ou si une correction est demandée.",
    source: PC,
    preuves: ["Ouvrir le chantier", "ChevronDesPortes"],
    ailleurs: [
      {
        source: "src/lib/portes-du-planning.ts",
        preuves: ['libelle: "Le devis"', 'libelle: "La fiche client"', 'libelle: "Créer la facture"', 'libelle: "La facture"', "correction demandée"],
      },
    ],
  },
  {
    id: "planning-facturer",
    ecran: "Planning",
    ou: "la liste sous le calendrier du Planning",
    intitule: "Facturer un chantier fini depuis le planning",
    motsCles: ["facturer", "fin", "planning", "chevron"],
    geste: "Touchez le chevron à droite du nom du chantier, puis « Créer la facture ».",
    reserve: "Le bouton n'apparaît qu'une fois le jour du chantier passé. Une fois envoyée, il devient « La facture ».",
    source: "src/lib/portes-du-planning.ts",
    preuves: ['libelle: "Créer la facture"', 'etat: "envoyée"', "aEuLieu"],
    ailleurs: [{ source: PC, preuves: ["Ouvrir le chantier"] }],
  },
  // --- L'agenda -------------------------------------------------------------
  {
    id: "planning-agenda-bandeau",
    ecran: "Planning",
    ou: "le haut du Planning",
    intitule: "La phrase de l'agenda en haut du planning, et la masquer",
    motsCles: ["agenda", "google", "bandeau", "relier", "connecter", "lu", "doublon", "masquer", "cacher", "phrase", "enlever"],
    geste:
      "« Vous pouvez relier votre agenda » : « Ouvrir » mène à « Mon agenda », « Masquer » l'enlève pour toujours. " +
      "« Votre agenda n'est plus lu » : « Ouvrir », puis « Rebrancher ».",
    reserve:
      "Réservé au patron. Rien ne s'affiche quand l'agenda est relié et lu, ni quand il est en pause. " +
      "L'alerte d'un agenda qui ne se lit plus ne se masque pas.",
    source: PC,
    preuves: ['href="/reglages/agenda"', "Vous pouvez relier votre agenda", "Votre agenda n'est plus lu", "Ouvrir", "Masquer"],
  },
  // --- La fiche d'intervention ----------------------------------------------
  {
    id: "planning-retour-du-jour",
    ecran: "Planning",
    ou: "la fiche d'intervention, dans « Planning »",
    intitule: "Envoyer le retour d'intervention du jour : ce qui est fait, photos, remarques",
    motsCles: ["retour", "intervention", "fait", "cocher", "travaux", "compte", "rendu", "salarie", "soir", "photo"],
    geste:
      "Touchez le nom du chantier dans sa journée, puis « Travaux à faire ». Cochez ce qui est fait, ajoutez des photos " +
      "avec « + », écrivez sous « À signaler », puis « Envoyer le retour du jour ».",
    reserve:
      "Le patron peut exiger qu'une ligne soit cochée et une photo posée : Atlas dit alors ce qui manque. " +
      "Les retours se lisent dans Terminés, Retours d'intervention.",
    source: TRAVAUX,
    preuves: ["Travaux à faire", 'aria-label="Ajouter une photo"', 'placeholder="À signaler, facultatif"', "Envoyer le retour du jour", "À retrouver dans Terminés"],
    ailleurs: [{ source: "src/lib/retour-intervention.ts", preuves: ["cochez ce que vous avez fait", "ajoutez une photo"] }],
  },
  // --- La fiche de sécurité -------------------------------------------------
  {
    id: "fiche-securite-etapes",
    ecran: "Fiche de sécurité",
    ou: "la fiche d'intervention dans « Planning », bandeau « Fiche de sécurité »",
    intitule: "Avancer dans la fiche de sécurité, la reprendre plus tard",
    motsCles: ["securite", "fiche", "etape", "suivant", "reprendre", "continuer", "enregistrer", "retour"],
    geste:
      "Remplissez chaque étape, puis « Suivant ». La flèche en haut à gauche revient en arrière. " +
      "Tout s'enregistre seul : pour reprendre, rouvrez le bandeau et appuyez sur « Continuer ».",
    reserve: "La première fois, un rappel du décret s'affiche : appuyez sur « Compris, je remplis ».",
    source: FORM,
    preuves: ['data-atlas="suivant"', "Suivant", 'aria-label="Retour"', "Compris, je remplis"],
    ailleurs: [{ source: FS, preuves: ['"Continuer"', "Reprise à"] }],
  },
  {
    id: "fiche-securite-gps",
    ecran: "Fiche de sécurité",
    ou: "fiche de sécurité, étape « Le chantier »",
    intitule: "Relever la position GPS du chantier pour les secours",
    motsCles: ["gps", "position", "coordonnees", "localiser", "secours", "releve", "emplacement"],
    geste: "Sur place, appuyez sur « Relever ici ».",
    reserve: "Si le téléphone refuse, un champ apparaît pour écrire les coordonnées à la main.",
    source: FORM,
    preuves: ['"Relever ici"', 'data-atlas="relever-gps"', "Coordonnées GPS"],
  },
  {
    id: "fiche-securite-donneur",
    ecran: "Fiche de sécurité",
    ou: "fiche de sécurité, étape « Le chantier »",
    intitule: "Dire qui a commandé les travaux : le client ou un autre donneur d'ordre",
    motsCles: ["donneur", "ordre", "commande", "sous", "traitant", "syndic", "mairie", "entreprise"],
    geste: "Sous « Donneur d’ordre », touchez « Le client du devis » ou « Quelqu’un d’autre », et remplissez son nom et téléphone.",
    source: FORM,
    preuves: ["Le client du devis", "Quelqu’un d’autre", "Donneur d’ordre"],
  },
  {
    id: "fiche-securite-ajouter",
    ecran: "Fiche de sécurité",
    ou: "fiche de sécurité, sous une liste à cocher",
    intitule: "Ajouter son propre matériel, risque ou mesure dans la fiche de sécurité",
    motsCles: ["ajouter", "materiel", "risque", "mesure", "liste", "manque", "propre", "securite"],
    geste: "Sous la liste, appuyez sur « Ajouter », écrivez le mot, puis « Ajouter ».",
    reserve: "Ce que vous ajoutez reste proposé sur vos prochaines fiches.",
    source: FORM,
    preuves: ["<Plus /> Ajouter", "Ce que vous ajoutez reste pour vos prochaines fiches."],
  },
  {
    id: "fiche-securite-photo",
    ecran: "Fiche de sécurité",
    ou: "fiche de sécurité, étape « Le terrain »",
    intitule: "Mettre ou retirer la photo du chantier dans la fiche de sécurité",
    motsCles: ["photo", "croquis", "carte", "acces", "ajouter", "retirer", "supprimer", "securite"],
    geste:
      "Appuyez sur l'appareil photo, prenez la photo ou choisissez-la. Pour la retirer : touchez-la, puis « Retirer ».",
    reserve: "Une fois la fiche signée, une photo ne se retire plus.",
    source: FORM,
    preuves: ['data-atlas="prendre-une-photo"', "Prenez la photo, ou choisissez-la dans la photothèque.", 'aria-label="Retirer cette photo"'],
  },
  {
    id: "fiche-securite-secours",
    ecran: "Fiche de sécurité",
    ou: "fiche de sécurité, étape « Les secours »",
    intitule: "Lire la marche à suivre en cas d'accident, appeler les secours",
    motsCles: ["accident", "secours", "urgence", "pompiers", "samu", "appeler", "blesse", "112", "15", "18"],
    geste: "Touchez « Protéger, alerter, secourir » : la marche à suivre s'ouvre, et chaque numéro d'urgence s'appelle d'un appui.",
    source: FORM,
    preuves: ["Protéger, alerter, secourir", "15, 18, 112", "href={`tel:${n}`}"],
  },
  {
    id: "fiche-securite-signer",
    ecran: "Fiche de sécurité",
    ou: "fiche de sécurité, dernière étape « Signer »",
    intitule: "Signer la fiche de sécurité au doigt",
    motsCles: ["signer", "signature", "doigt", "valider", "terminer", "securite", "fiche", "effacer"],
    geste:
      "À la dernière étape, signez dans le cadre au doigt, puis « Signer la fiche ». « Effacer » recommence la signature.",
    reserve:
      "La liste « Encore vide » montre ce qui manque : touchez une ligne pour y aller. Rien n'empêche de signer.",
    source: FORM,
    preuves: ["Signer la fiche", "Encore vide", "Touchez une ligne pour y aller."],
    ailleurs: [{ source: "src/app/planning/fiche-de-securite/[chantierId]/Signature.tsx", preuves: ["Signez ici, au doigt", "Effacer"] }],
  },
  {
    id: "fiche-securite-transmettre",
    ecran: "Fiche de sécurité",
    ou: "le bandeau « Fiche de sécurité » de la fiche d'intervention, une fois signée",
    intitule: "Envoyer la fiche de sécurité signée, par mail, SMS ou WhatsApp",
    motsCles: ["transmettre", "envoyer", "partager", "mail", "sms", "whatsapp", "securite", "pdf", "client"],
    geste:
      "Appuyez sur « Transmettre le PDF » : la feuille de partage du téléphone s'ouvre, choisissez Mail, SMS ou WhatsApp.",
    reserve: "C'est vous qui envoyez. Une fois transmise, le bandeau dit « Transmise le ».",
    source: FS,
    preuves: ["Transmettre le PDF", "Transmise le"],
    ailleurs: [{ source: FORM, preuves: ["ouvre la feuille de partage du téléphone"] }],
  },
  {
    id: "fiche-securite-pdf",
    ecran: "Fiche de sécurité",
    ou: "le bandeau « Fiche de sécurité » de la fiche d'intervention, une fois signée",
    intitule: "Voir le PDF de la fiche de sécurité",
    motsCles: ["pdf", "voir", "securite", "fiche", "imprimer", "montrer", "equipe"],
    geste: "Ouvrez le bandeau « Fiche de sécurité », puis « Ouvrir le PDF ».",
    source: FS,
    preuves: ["Ouvrir le PDF", 'data-atlas="ouvrir-le-pdf-de-la-fiche"'],
  },
  {
    id: "fiche-securite-modifier",
    ecran: "Fiche de sécurité",
    ou: "le bandeau « Fiche de sécurité » de la fiche d'intervention, une fois signée",
    intitule: "Corriger une fiche de sécurité déjà signée",
    motsCles: ["modifier", "corriger", "changer", "erreur", "signee", "securite", "fiche", "resigner"],
    geste: "Ouvrez le bandeau « Fiche de sécurité », puis « Modifier ».",
    reserve: "La signature part : il faut signer à nouveau, puis la retransmettre.",
    source: FS,
    preuves: ['data-atlas="modifier-la-fiche"', "Modifier", "rouvrirLaFicheAction"],
  },
  {
    id: "planning-fiche-intervention",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le jour du chantier",
    intitule: "Ouvrir la fiche d'intervention d'un chantier",
    motsCles: ["fiche", "intervention", "chantier", "jour", "planning", "ouvrir", "trouver", "sont"],
    geste:
      "Touchez « Planning » dans la barre du bas, puis le nom du chantier dans sa journée : " +
      "sa fiche d'intervention se déplie dessous.",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["Fiche d&apos;intervention", 'data-atlas="nom-du-jour"'],
    lieu: true,
  },
  {
    id: "fiche-securite-remplir",
    ecran: "Planning",
    ou: "la fiche d'intervention, dans « Planning »",
    intitule: "Remplir et signer la fiche de sécurité avant les travaux",
    motsCles: ["securite", "fiche", "remplir", "signer", "elagage", "abattage", "risques", "remplit"],
    geste:
      "Dans « Planning », touchez le nom du chantier, puis le bandeau « Fiche de sécurité » " +
      "et « Remplir la fiche ».",
    reserve: "Elle existe sur tous les chantiers, et reste facultative.",
    source: "src/app/planning/FicheDeSecurite.tsx",
    preuves: ["Fiche de sécurité", "Remplir la fiche"],
  },
  {
    id: "fiche-securite-retrouver",
    ecran: "Fiches de sécurité",
    ou: "« Paysage » dans la barre du bas, puis « Fiches de sécurité »",
    intitule: "Retrouver les fiches de sécurité signées",
    motsCles: ["securite", "fiche", "fiches", "signees", "sont", "retrouver", "trouver", "range", "anciennes"],
    geste: "Touchez « Paysage » dans la barre du bas, puis « Fiches de sécurité ».",
    reserve: "Elles y sont gardées deux ans.",
    source: "src/app/paysage/page.tsx",
    preuves: ['href: "/paysage/fiches-securite"', "Gardées deux ans."],
    lieu: true,
  },
  // --- Planning -------------------------------------------------------------
  {
    id: "planning-poser",
    ecran: "Planning",
    ou: "« Planning », dans la barre du bas",
    intitule: "Poser un chantier sur un jour",
    motsCles: ["planning", "planifier", "poser", "jour", "date", "semaine", "ajouter", "chantier", "calendrier"],
    // **Le second temps a disparu le 9 septembre 2026** — *« si Claudette c'est
    // un chantier 1 journée, deux, ou une demi, ça doit se mettre tout seul »*.
    // La durée vient du devis ; la pose ne redemande plus rien.
    // **« Ajouter un chantier » n'existe plus** (sa planche du 18 septembre
    // 2026) : « Ajouter » ouvre trois voies, et la preuve ne tenait plus que
    // par un commentaire qui citait l'ancien nom.
    geste:
      "Touchez le jour, puis « Ajouter » et « Client en attente », et touchez le nom : " +
      "sa durée fait le reste.",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ['data-atlas="ajouter"', "Client en attente"],
  },
  {
    id: "planning-note",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le nom du chantier",
    intitule: "Laisser une note sur une journée",
    motsCles: ["note", "penser", "rappel", "ecrire", "memo", "journee", "planning"],
    geste: "Écrivez dans « Ma note », sur la fiche du jour. Elle s'enregistre toute seule.",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["Ma note", "Enregistré."],
  },
  {
    id: "planning-itineraire",
    ecran: "Planning",
    ou: "« Planning » dans la barre du bas, puis le nom du chantier",
    intitule: "Y aller, appeler le client, copier l'adresse",
    motsCles: ["maps", "waze", "itineraire", "route", "aller", "appeler", "telephone", "adresse", "copier"],
    geste: "Sur la fiche du chantier : « Maps », « Waze », « Appeler le client » ou « Copier l'adresse ».",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["Maps", "Waze", "Appeler le client"],
  },
  {
    id: "planning-semaine",
    ecran: "Planning",
    ou: "sous le calendrier, quand les sept jours sont affichés",
    intitule: "Voir les sept jours d'avant ou d'après",
    motsCles: ["semaine", "suivante", "precedente", "avancer", "reculer", "changer", "planning"],
    geste: "Appuyez sur les chevrons de part et d'autre des dates.",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["Sept jours avant", "Sept jours après"],
  },
  {
    // **Un geste qui ne se voit pas ne s'apprend pas seul** : le balayage a donc
    // sa fiche, et les deux points sous le calendrier se touchent aussi.
    id: "planning-journee-ou-semaine",
    ecran: "Planning",
    ou: "sous le calendrier du mois",
    intitule: "Passer de la journée aux sept jours",
    motsCles: ["journee", "semaine", "aujourdhui", "jour", "liste", "planning", "balayer"],
    geste:
      "Balayez la liste du doigt, ou appuyez sur l'un des deux points. " +
      "L'écran s'ouvre toujours sur la journée du jour.",
    source: "src/app/planning/PlanningClient.tsx",
    preuves: ["La journée", "Les sept jours"],
  },
];
