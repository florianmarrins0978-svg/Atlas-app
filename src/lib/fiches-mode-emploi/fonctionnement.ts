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
import { LONGUEUR_MINIMALE } from "../mot-de-passe";
import { PALIERS_MS, SEUIL_AVANT_TEMPORISATION } from "../tentatives-connexion";

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
    motsCles: ["voir", "securite", "securisees", "protegees", "confidentiel", "privees", "autres", "donnees", "acces", "concurrents", "entreprises", "lire"],
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
    motsCles: ["ia", "intelligence", "transmis", "partent", "fournisseur", "fournisseurs", "confidentialite", "envoye", "ecoute", "ecoutees", "audio", "enregistrement"],
    geste:
      "Pour transcrire une dictée, rédiger un devis ou regarder une photo, Atlas envoie ce contenu à ses " +
      "fournisseurs d'intelligence artificielle. Ne dictez pas ce que vous ne voulez pas voir transmis, comme " +
      "une information de santé. L'enregistrement reste sur la fiche du chantier : vous pouvez le réécouter " +
      "ou le remplacer.",
    source: CONDITIONS,
    preuves: ["est transmis aux fournisseurs listés dans la politique de confidentialité"],
    ailleurs: [{ source: "src/app/chantiers/[id]/note-vocale/NoteVocaleClient.tsx", preuves: ["Remplacer la note"] }],
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
    motsCles: ["internet", "hors ligne", "reseau", "connexion", "wifi", "campagne", "capte"],
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
    motsCles: ["ordinateur", "pc", "mac", "tablette", "installer", "installation", "telecharger", "android", "iphone", "icone", "raccourci", "accueil", "ipad", "bureau"],
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
    motsCles: ["chiffre", "affaires", "gagne", "total", "bilan", "mois", "annee"],
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
    motsCles: ["assistant", "place", "capable", "sait", "envoyer", "creer", "tout", "seul", "demander", "doit", "argent"],
    geste:
      "L'assistant lit vos chantiers, devis, factures, planning et tarifs. Demandez-lui par exemple « qui me doit " +
      "de l'argent », « combien j'ai encaissé en septembre », « qu'est-ce que j'ai demain » ou « crée un chantier " +
      "pour Martin » : il prépare, vous cochez puis validez. Il n'envoie jamais un devis, ne facture jamais, et " +
      "n'écrit rien sans votre validation.",
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

  // --- La sécurité, et tirer le maximum d'Atlas (29 septembre 2026) ----------
  //
  // *« Repose-lui plein de questions sur le fonctionnement, la sécurité, et
  // comment l'exploiter au maximum. »* « Est-ce que Atlas est sécurisé »
  // rendait la fiche de sécurité d'un CHANTIER. Chaque affirmation ci-dessous
  // est prouvée par le fichier qui la rend vraie ; ce qui n'est pas encore
  // décidé (l'hébergeur, le contrat de sous-traitance) se dit comme tel.
  {
    id: "atlas-securite",
    ecran: "Atlas",
    ou: "partout",
    intitule: "Atlas est-il sécurisé : ce qui protège votre compte et vos données",
    motsCles: ["securise", "securisee", "protege", "chiffre", "chiffrees", "pirate", "piratage", "hacker", "https", "fiable"],
    geste:
      "Les échanges avec Atlas sont toujours chiffrés (https). Chaque entreprise est cloisonnée dans la base " +
      "elle-même : aucune autre n'y a accès. Votre mot de passe est gardé chiffré, les essais répétés sont " +
      "freinés, et vous pouvez entrer avec Face ID.",
    reserve: "Le chiffrement des données sur le disque dépend de l'hébergeur, qui n'est pas encore désigné.",
    source: "next.config.ts",
    preuves: ["Strict-Transport-Security"],
    ailleurs: [
      { source: CONDITIONS, preuves: ["cloisonnement des entreprises appliqué au niveau de la base de données", "Hébergeur : [À COMPLÉTER"] },
      { source: "src/server/repositories/compte.ts", preuves: ['from "bcryptjs"'] },
    ],
  },
  {
    id: "mot-de-passe-protege",
    ecran: "Mot de passe",
    ou: "« Réglages » dans la barre du bas, puis Mot de passe",
    intitule: "Comment votre mot de passe est protégé",
    motsCles: ["mot", "passe", "motdepasse", "protege", "connait", "clair", "caracteres", "longueur", "deviner", "essais", "tentatives", "bloque"],
    geste:
      `Votre mot de passe fait au moins ${LONGUEUR_MINIMALE} caractères. Atlas ne le garde jamais en clair : ` +
      "seule une empreinte chiffrée est enregistrée, personne ne peut le relire. " +
      `Après ${SEUIL_AVANT_TEMPORISATION} essais ratés, chaque nouvel essai doit attendre, jusqu'à ` +
      `${Math.max(...PALIERS_MS) / 60_000} minutes.`,
    source: "src/lib/mot-de-passe.ts",
    preuves: ["export const LONGUEUR_MINIMALE"],
    ailleurs: [
      { source: "src/server/repositories/compte.ts", preuves: ['from "bcryptjs"'] },
      { source: "src/lib/tentatives-connexion.ts", preuves: ["export const PALIERS_MS", "export const SEUIL_AVANT_TEMPORISATION"] },
    ],
  },
  {
    id: "mot-de-passe-oublie",
    ecran: "Connexion",
    ou: "l'écran de connexion",
    intitule: "Mot de passe oublié : en choisir un nouveau",
    motsCles: ["oublie", "perdu", "retrouver", "reinitialiser", "mot", "passe", "motdepasse", "souviens"],
    geste:
      "Sur l'écran de connexion, touchez « Mot de passe oublié ? », écrivez votre adresse, puis « Recevoir un " +
      "code ». Entrez le code reçu, choisissez le nouveau mot de passe, puis « Enregistrer ».",
    source: "src/app/login/FormulaireConnexion.tsx",
    preuves: ["Mot de passe oublié&nbsp;?"],
    ailleurs: [
      {
        source: "src/app/mot-de-passe-oublie/EcranMotDePasseOublie.tsx",
        preuves: ["Recevoir un code", "<SaisieDuCode", "Nouveau mot de passe", '"Enregistrer"'],
      },
    ],
  },
  {
    id: "atlas-double-authentification",
    ecran: "Double vérification",
    ou: "« Réglages » dans la barre du bas, puis Double vérification",
    intitule: "La double authentification, un code en plus du mot de passe",
    motsCles: ["double", "authentification", "deux", "etapes", "facteurs", "2fa", "verification"],
    geste:
      "Allumez Double vérification, ajoutez Atlas à votre appli d'authentification (Google Authenticator, par " +
      "exemple), tapez le premier code qu'elle affiche, puis gardez vos codes de secours. Ensuite, chaque " +
      "connexion par mot de passe demande le code de l'appli. Face ID entre sans code.",
    source: "src/app/reglages/connexion/SectionDoubleVerification.tsx",
    preuves: ['aria-label="Double vérification"', "Ajouter à mon appli d&apos;authentification", "codes de secours"],
  },
  {
    id: "donnees-usage",
    ecran: "Atlas",
    ou: "les conditions d'utilisation, acceptées à l'inscription",
    intitule: "Ce qu'Atlas fait de vos données, s'il les revend",
    motsCles: ["revend", "revendre", "vendre", "vend", "publicite", "exploite", "utilise", "commercial", "usage"],
    geste:
      "Atlas ne se sert de vos données que pour faire tourner le service : les afficher, les sauvegarder, les " +
      "transmettre à ses sous-traitants, fabriquer vos documents. Les conditions d'utilisation limitent cet usage " +
      "à ce qui est strictement nécessaire.",
    source: CONDITIONS,
    preuves: ["strictement nécessaire à l’exécution du service"],
  },
  {
    id: "atlas-rgpd",
    ecran: "Atlas",
    ou: "« Réglages » dans la barre du bas, puis Mes données",
    intitule: "Atlas et le RGPD",
    motsCles: ["rgpd", "conforme", "conformite", "cnil", "reglementation", "personnelles", "protection"],
    geste:
      "Vos données sont cloisonnées et se téléchargent dans Mes données. Un client s'efface de sa fiche, ses " +
      "factures restant gardées dix ans comme la loi l'impose. Ce qui part à l'IA est dit dans les conditions.",
    reserve: "Le contrat de sous-traitance prévu par le RGPD pour les données de vos clients n'est pas encore rédigé.",
    source: CONDITIONS,
    preuves: ["document distinct, à faire rédiger]", "est transmis aux fournisseurs listés"],
    ailleurs: [
      { source: "src/app/reglages/donnees/BoutonTelecharger.tsx", preuves: ["Télécharger mes données"] },
      { source: "src/app/clients/[id]/SupprimerCeClient.tsx", preuves: ["Conservé par la loi"] },
    ],
  },
  {
    id: "abonnement-carte",
    ecran: "Abonnement",
    ou: "« Réglages » dans la barre du bas, puis Abonnement",
    intitule: "Atlas garde-t-il ma carte bancaire",
    motsCles: ["carte", "bancaire", "cb", "garde", "stocke", "numero", "prelevement"],
    geste:
      "Non. Votre carte se saisit sur les pages sécurisées du prestataire de paiement, qui seul la garde : " +
      "Atlas ne la voit jamais.",
    source: CONDITIONS,
    preuves: ["ne collecte ni ne conserve aucune donnée de carte bancaire"],
  },
  {
    id: "lien-client",
    ecran: "Devis",
    ou: "le lien envoyé au client par SMS ou par e-mail",
    intitule: "Le lien du devis envoyé au client est-il sûr",
    motsCles: ["lien", "securise", "ouvrir", "autre", "transferer", "deviner", "partage", "jeton"],
    geste:
      "Chaque devis part avec son propre lien, fait de 43 caractères tirés au hasard : impossible à deviner. " +
      "Seul celui qui l'a reçu peut l'ouvrir, sauf s'il le transfère.",
    source: "src/server/repositories/envois-devis.ts",
    // 32 octets en base64url font 43 caractères : la phrase et le code se tiennent.
    preuves: ['randomBytes(32).toString("base64url")'],
  },
  {
    id: "atlas-astuces",
    ecran: "Atlas",
    ou: "partout",
    intitule: "Gagner du temps : les gestes qui font le plus",
    motsCles: ["astuce", "astuces", "vite", "rapide", "rapidement", "temps", "gagner", "conseil", "maximum", "efficace", "utiliser"],
    geste:
      "Dictez le chantier au lieu de le taper : Atlas écrit le devis. Pour un client déjà venu, « Dernier devis » " +
      "sur sa fiche reprend le précédent. Posez vos prix une fois dans vos tarifs, ils reviennent dans chaque " +
      "devis. Et demandez à l'assistant : « qui me doit de l'argent », « crée un chantier pour Martin ».",
    source: "src/app/chantiers/[id]/AnneauNoteVocale.tsx",
    preuves: ['aria-label="Dicter une note vocale"'],
    ailleurs: [
      { source: "src/app/clients/[id]/RepartirDeCeClient.tsx", preuves: ['libelle="Dernier devis"'] },
      { source: "src/app/reglages/ReglagesClient.tsx", preuves: ["+ Ajouter un tarif"] },
    ],
  },
];
