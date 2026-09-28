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
];
