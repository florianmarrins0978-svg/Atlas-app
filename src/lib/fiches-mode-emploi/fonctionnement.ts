/**
 * Mode d'emploi : Comment Atlas garde vos données, qui les voit, où elles partent.
 *
 * **Sa capture du 28 septembre 2026.** « Combien de temps tu conserve les
 * données dans lappli ? » rendait *« ce n'est pas une fonctionnalité d'Atlas,
 * renseignez-vous auprès du support »*. Sa règle : *« je voulais que
 * l'assistant puisse répondre à toutes les questions sur l'application »*.
 * Les autres zones disent comment FAIRE ; aucune ne disait comment
 * l'application se comporte avec ce qu'on y met, et l'assistant, qui ne dit
 * que ce que ses outils lui rendent, refusait donc à raison.
 *
 * **Chaque phrase se prouve contre ce qui la rend vraie**, comme un bouton :
 * le jour où la purge automatique se branche, ou où le délai après
 * résiliation est fixé, la fiche rougit et se récrit au lieu de mentir.
 */
import type { FicheModeEmploi } from "../mode-emploi";
import { FORMULES, JOURS_ESSAI } from "../abonnements";
import { CONTACT_ATLAS } from "../contact-atlas";

const DONNEES = "« Réglages » dans la barre du bas, puis Mes données";
const CONDITIONS = "src/server/documents-legaux/versions.ts";

export const FICHES_FONCTIONNEMENT: FicheModeEmploi[] = [
  {
    id: "donnees-conservation",
    ecran: "Mes données",
    ou: DONNEES,
    intitule: "La durée de conservation de vos données, et où elles sont gardées",
    motsCles: ["conserver", "conservation", "garder", "gardees", "duree", "donnees", "stockees", "effacees", "archivees", "photos", "automatiquement"],
    geste:
      "Tout ce que vous mettez dans Atlas (chantiers, clients, devis, factures, photos, notes) reste enregistré " +
      "tant que votre compte existe, sur le serveur d'Atlas et pas dans votre téléphone. Rien ne s'efface tout " +
      "seul : seule une suppression faite par vous retire une donnée. Les factures se gardent dix ans, comme " +
      "la loi l'impose, même si vous supprimez le client.",
    reserve: "Pour garder votre propre copie : Mes données, « Télécharger mes données ».",
    // « Rien ne s'efface tout seul » tient tant que la purge n'est appelée par
    // personne (`docs/DEPLOIEMENT-PURGE.md`). Le jour où elle se branche, cette
    // phrase part de `objets-stockes.ts`, et la fiche doit dire les durées.
    source: "src/lib/objets-stockes.ts",
    preuves: ["tant que le planificateur de purge n'est pas branché"],
    ailleurs: [
      { source: "src/server/retention.ts", preuves: ["facturesAns: 10"] },
      { source: "src/app/clients/[id]/SupprimerCeClient.tsx", preuves: ["Conservé par la loi"] },
      { source: "src/app/reglages/donnees/BoutonTelecharger.tsx", preuves: ["Télécharger mes données"] },
    ],
  },
  {
    id: "donnees-apres-resiliation",
    ecran: "Mes données",
    ou: DONNEES,
    intitule: "Ce que deviennent vos données si vous arrêtez Atlas",
    motsCles: ["deviennent", "arret", "arreter", "resiliation", "apres", "recuperer", "perdre", "quitte"],
    geste:
      "Avant d'arrêter, téléchargez tout : Mes données, « Télécharger mes données ». Le fichier se lit sans " +
      "Atlas. Les pièces comptables restent gardées dix ans, comme la loi l'impose.",
    reserve: "Le délai pendant lequel vos données restent récupérables après la fin de l'abonnement n'est pas encore fixé.",
    source: CONDITIONS,
    preuves: ["restent récupérables par ce moyen pendant [À COMPLÉTER", "dans un format exploitable sans Atlas"],
    ailleurs: [{ source: "src/app/reglages/donnees/BoutonTelecharger.tsx", preuves: ["Télécharger mes données"] }],
  },
  {
    id: "donnees-qui-voit",
    ecran: "Équipe",
    ou: "« Réglages » dans la barre du bas, puis Équipe, Accès",
    intitule: "Qui peut voir vos données, et si elles sont protégées",
    motsCles: ["voir", "securite", "securisees", "protegees", "confidentiel", "privees", "autres", "donnees", "acces"],
    geste:
      "Seuls les comptes de votre entreprise voient vos chantiers : une autre entreprise n'y a jamais accès, " +
      "le cloisonnement est fait dans la base elle-même. Dans votre équipe, chacun voit ce que son rôle permet. " +
      "Vos clients ne voient que ce que vous leur envoyez.",
    reserve: "Le rôle de chacun se règle dans Équipe, Accès.",
    source: CONDITIONS,
    preuves: ["cloisonnement des entreprises appliqué au niveau de la base de données"],
    ailleurs: [{ source: "src/app/reglages/equipe/QuiAAcces.tsx", preuves: ["<ChoixRole"] }],
  },
  {
    id: "donnees-ia",
    ecran: "Atlas IA",
    ou: "« Réglages » dans la barre du bas, puis Atlas IA",
    intitule: "Où partent vos dictées et vos photos quand l'IA travaille",
    motsCles: ["ia", "intelligence", "transmis", "partent", "fournisseur", "fournisseurs", "confidentialite", "envoye"],
    geste:
      "Pour transcrire une dictée, rédiger un devis ou regarder une photo, Atlas envoie ce contenu à ses " +
      "fournisseurs d'intelligence artificielle. Ne dictez pas ce que vous ne voulez pas voir transmis, comme " +
      "une information de santé.",
    source: CONDITIONS,
    preuves: ["est transmis aux fournisseurs listés dans la politique de confidentialité"],
  },

  // --- Ses questions jouées le 28 septembre 2026 ------------------------------
  //
  // *« Joue le rôle d'un utilisateur qui a des questions à lui poser »* : une
  // soixantaine de questions d'artisan passées dans la recherche. Celles-ci
  // n'avaient AUCUNE fiche. Ce qu'Atlas ne fait pas se dit avec `absences` :
  // le jour où l'écran arrive, la fiche rougit au lieu de mentir.
  {
    id: "atlas-internet",
    ecran: "Atlas",
    ou: "partout",
    intitule: "Utiliser Atlas sans internet, hors ligne",
    motsCles: ["internet", "hors ligne", "reseau", "connexion", "wifi", "campagne", "capte", "marche"],
    geste:
      "Atlas a besoin d'internet pour s'ouvrir et pour enregistrer : il n'a pas encore de mode hors ligne. " +
      "Sans réseau, attendez d'en retrouver avant de valider.",
    source: "src/app/layout.tsx",
    preuves: ['manifest: "/manifest.json"'],
    // Un mode hors ligne passerait par un service worker.
    absences: ["serviceWorker"],
  },
  {
    id: "atlas-ordinateur-telephone",
    ecran: "Atlas",
    ou: "le navigateur, Safari ou Chrome",
    intitule: "Ouvrir Atlas sur un ordinateur, l'installer sur l'écran d'accueil du téléphone",
    motsCles: ["ordinateur", "pc", "mac", "tablette", "installer", "installation", "telecharger", "android", "iphone", "icone", "raccourci", "accueil"],
    geste:
      "Atlas s'ouvre dans le navigateur, sur téléphone comme sur ordinateur, avec le même compte. " +
      "Pour l'avoir sur l'écran du téléphone : sur iPhone, dans Safari, touchez Partager puis « Sur l'écran d'accueil » ; " +
      "sur Android, dans Chrome, menu puis « Ajouter à l'écran d'accueil ».",
    source: "src/app/layout.tsx",
    preuves: ['manifest: "/manifest.json"', "appleWebApp"],
  },
  {
    id: "abonnement-essai",
    ecran: "Abonnement",
    ou: "« Réglages » dans la barre du bas, puis Abonnement",
    intitule: "L'essai gratuit : combien de jours, et ce qui se passe après",
    motsCles: ["essai", "gratuit", "gratuitement", "tester", "essayer", "decouvrir", "fin"],
    geste:
      `Un compte neuf a ${JOURS_ESSAI} jours d'essai gratuit, sans carte bancaire, avec toutes les fonctions ouvertes. ` +
      "À la fin, vous voyez toujours tout, mais il faut choisir une formule pour créer de nouveau.",
    source: "src/lib/abonnements.ts",
    preuves: ["export const JOURS_ESSAI", 'FORMULE_DE_LESSAI: FormuleCode = "illimite"', "Choisissez une formule pour créer de nouveau"],
  },
  {
    id: "abonnement-personnes",
    ecran: "Abonnement",
    ou: "« Réglages » dans la barre du bas, puis Abonnement",
    intitule: "Combien de salariés et de personnes on peut ajouter",
    motsCles: ["combien", "salaries", "personnes", "utilisateurs", "comptes", "limite", "maximum", "ajouter"],
    geste:
      "Vos salariés ont accès au planning quelle que soit la formule. Ce qui est compté, ce sont les personnes qui font " +
      "les devis et les factures : " +
      FORMULES.map((f) => `${f.nom}, ${f.plafondFabricants === null ? "autant que vous voulez" : f.plafondFabricants}`).join(" ; ") +
      ".",
    source: "src/lib/abonnements.ts",
    preuves: ["Vos salariés ont accès au planning", "plafondFabricants"],
  },
  {
    id: "ecrire-a-atlas",
    ecran: "Atlas",
    ou: "par e-mail",
    intitule: "Contacter Atlas, écrire à l'équipe",
    motsCles: ["contacter", "contact", "ecrire", "joindre", "aide", "probleme", "bug", "reclamation", "souci", "adresser", "panne"],
    geste: `Écrivez à ${CONTACT_ATLAS}.`,
    source: "src/lib/contact-atlas.ts",
    preuves: ["export const CONTACT_ATLAS"],
  },
  {
    id: "facture-electronique",
    ecran: "Facture",
    ou: "« Terminés » dans la barre du bas",
    intitule: "La facture électronique obligatoire, la plateforme agréée",
    motsCles: ["electronique", "obligatoire", "plateforme", "agreee", "2026", "reforme", "chorus", "dematerialisee"],
    geste:
      "Atlas ne transmet pas encore vos factures à une plateforme de facturation électronique. " +
      "Il fabrique la facture et l'envoie à votre client, par SMS ou par e-mail.",
    source: "src/app/chantiers/[id]/facture/FactureClient.tsx",
    preuves: ["Envoyer la facture", 'libelle="SMS"', 'libelle="E-mail"'],
    // Le connecteur prévu (`ARCHITECTURE.md` §424) commencera par lui.
    absences: ["Pennylane", "pennylane"],
  },
  {
    id: "factures-comptable",
    ecran: "Mes données",
    ou: DONNEES,
    intitule: "Donner ses factures à son comptable",
    motsCles: ["comptable", "expert", "exporter", "export", "comptabilite", "transmettre", "bilan"],
    geste:
      "Ouvrez Mes données, puis « Télécharger mes données » : le fichier range vos factures en PDF, " +
      "dossier par client et par chantier, avec vos devis. La TVA à déclarer est dans « Terminés », « Ma TVA à déclarer ».",
    source: "src/lib/rangement-sauvegarde.ts",
    preuves: ['"facture-pdf": "Factures"'],
    ailleurs: [
      { source: "src/app/reglages/donnees/BoutonTelecharger.tsx", preuves: ["Télécharger mes données"] },
      { source: "src/app/termines/tva/page.tsx", preuves: ["Ma TVA"] },
    ],
  },
  {
    id: "contrat-entretien",
    ecran: "Contrat d'entretien",
    ou: "« Chantiers » dans la barre du bas, puis « Vos clients », puis son nom",
    intitule: "Faire un contrat d'entretien à l'année, des passages chaque mois",
    motsCles: ["contrat", "entretien", "annuel", "abonnement", "passages", "passage", "tonte", "regulier", "mensuel"],
    geste:
      "Ouvrez la fiche du client, puis « Contrat d’entretien ». Choisissez les prestations, les passages par mois, " +
      "le prix du passage, la durée et la facturation, puis envoyez-le au client. Une fois accepté, chaque passage " +
      "arrive au planning, à poser.",
    source: "src/app/clients/[id]/contrat/ContratClient.tsx",
    preuves: ['"Passages par mois"', '"Prix du passage HT"', "<Intitule>Facturation</Intitule>"],
    ailleurs: [{ source: "src/app/clients/[id]/RepartirDeCeClient.tsx", preuves: ['libelle="Contrat d’entretien"'] }],
  },
  {
    id: "chiffre-affaires",
    ecran: "Assistant",
    ou: "l'assistant, depuis n'importe quel écran",
    intitule: "Voir son chiffre d'affaires, ce qu'on a facturé ou encaissé sur une période",
    motsCles: ["chiffre", "affaires", "encaisse", "encaissement", "gagne", "total", "bilan", "mois", "annee"],
    geste:
      "Atlas n'a pas d'écran de chiffre d'affaires : demandez-le à l'assistant, par exemple « combien j'ai facturé " +
      "en septembre » ou « combien j'ai encaissé cette année ».",
    source: "src/server/ai/tools/lire-factures.ts",
    preuves: ["bilanDeLaPeriode"],
  },
  {
    id: "clients-importer",
    ecran: "Vos clients",
    ou: "« Chantiers » dans la barre du bas, puis « Vos clients »",
    intitule: "Importer sa liste de clients depuis un fichier",
    motsCles: ["importer", "import", "excel", "csv", "fichier", "liste", "clients", "carnet", "contacts"],
    geste:
      "Atlas ne sait pas encore importer une liste de clients : un client naît avec son chantier. " +
      "Seuls les tarifs s'importent, dans Réglages.",
    source: "src/app/clients/page.tsx",
    preuves: ["Ils naissent avec vos chantiers."],
    absences: ["importerClients", "ImporterClients"],
  },
  {
    id: "ia-se-trompe",
    ecran: "Atlas IA",
    ou: "« Réglages » dans la barre du bas, puis Atlas IA",
    intitule: "L'IA peut-elle se tromper",
    motsCles: ["ia", "intelligence", "artificielle", "fiable", "fiabilite", "confiance", "verifier"],
    geste:
      "Oui. Ce que l'IA écrit est une proposition : relisez-la avant d'envoyer. " +
      "Rien ne part chez un client, et rien n'est facturé, sans votre geste.",
    source: CONDITIONS,
    preuves: ["susceptible d’être inexacte"],
    ailleurs: [{ source: "src/server/ai/services/assistant-service.ts", preuves: ["Ne valide, n'envoie et ne facture jamais un devis."] }],
  },
  {
    id: "assistant-ce-qu-il-fait",
    ecran: "Assistant",
    ou: "l'assistant, depuis n'importe quel écran",
    intitule: "Ce que l'assistant peut faire à votre place, et ce qu'il ne fait jamais",
    motsCles: ["assistant", "place", "peut", "capable", "sait", "envoyer", "creer", "tout", "seul"],
    geste:
      "L'assistant lit vos chantiers, devis, factures, planning et tarifs, et prépare des modifications que vous " +
      "cochez puis validez. Il n'envoie jamais un devis, ne facture jamais, et n'écrit rien sans votre validation.",
    source: "src/server/ai/services/assistant-service.ts",
    preuves: ["Ne valide, n'envoie et ne facture jamais un devis.", "JAMAIS écrire toi-même dans les données"],
  },
  {
    id: "atlas-langue",
    ecran: "Atlas",
    ou: "partout",
    intitule: "Changer la langue d'Atlas",
    motsCles: ["langue", "anglais", "espagnol", "portugais", "traduire", "traduction", "francais"],
    geste: "Atlas n'existe qu'en français pour l'instant.",
    source: "src/app/layout.tsx",
    preuves: ['<html lang="fr"'],
    absences: ["next-intl", "i18next"],
  },
  {
    id: "facture-situation",
    ecran: "Facture",
    ou: "« Terminés » dans la barre du bas",
    intitule: "Faire une facture de situation, facturer en plusieurs fois",
    motsCles: ["situation", "avancement", "plusieurs", "fois", "partielle", "echelonner", "etapes", "tranche"],
    geste:
      "Atlas ne fait pas encore de facture de situation. Pour être payé en plusieurs fois, demandez un acompte " +
      "sur le devis : la facture le reprend dans ses règlements reçus.",
    source: "src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx",
    preuves: ["+ Ajouter un acompte"],
    ailleurs: [{ source: "src/app/chantiers/[id]/facture/ReglementsRecus.tsx", preuves: ['aria-label="Ce que ce règlement est"'] }],
    absences: ["factureDeSituation", "facture de situation"],
  },
];
