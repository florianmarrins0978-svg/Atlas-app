#!/usr/bin/env node
/*
  Fusionne toutes les maquettes en une seule page consultable.

  Pourquoi un script plutôt qu'un copier-coller : les fichiers ont été
  écrits séparément et se partagent les mêmes noms de classes (.ecran, .prop,
  .nom, .bas…) et les mêmes identifiants (#modele, #duo). Concaténés tels
  quels, ils se marcheraient dessus — la charte de la maquette 6 repeindrait
  la maquette 2. Chaque feuille de style est donc confinée sous un ancêtre
  unique (#s01, #s02, …) et chaque script reçoit un `document` restreint à sa
  propre section.

  Le script est refait à chaque régénération pour que la page unique ne puisse
  pas diverger de ses originaux : ils restent la source, elle est le produit.
*/

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "maquettes");
const SORTIE_PAR_DEFAUT = join(SOURCE, "toutes-les-maquettes.html");

const MAQUETTES = [
  {
    fichier: "01-reference-du-patron.html",
    titre: "La référence",
    famille: "Le point de départ",
    quoi: "Votre capture, reproduite. Sceau, branche, cartes, barre en pilule.",
  },
  {
    fichier: "02-index-et-calme.html",
    titre: "L’index et le calme",
    famille: "Chercher plus minimal",
    quoi: "Deux directions : lignes séparées par un cheveu, ou plages sans bordure ni ombre.",
  },
  {
    fichier: "03-index-trois-chartes.html",
    titre: "L’index, trois chartes",
    famille: "Chercher plus minimal",
    quoi: "Nuit, Pierre, Brume — la même mise en page, trois couleurs.",
  },
  {
    fichier: "04-aman.html",
    titre: "D’après Aman",
    famille: "Le langage d’Aman",
    quoi: "Ivoire, serif claire, capitales espacées, aucun coin arrondi. Jour et nuit.",
  },
  {
    fichier: "05-calme-x-aman.html",
    titre: "Le calme × Aman",
    famille: "Le langage d’Aman",
    quoi: "Les plages de « Le calme », habillées d’ivoire et de capitales.",
  },
  {
    fichier: "06-nuancier-neuf-chartes.html",
    titre: "Le nuancier",
    famille: "Le langage d’Aman",
    quoi: "Neuf couleurs sur la même page : les vôtres, les miennes, celles de 2026.",
  },
  {
    fichier: "07-cinq-mises-en-page.html",
    titre: "Cinq mises en page",
    famille: "Vers la décision",
    quoi: "Registre, colonne, plages larges, action au pouce, vignette — toutes en ivoire.",
  },
  {
    fichier: "08-la-colonne-retenue.html",
    titre: "La colonne — retenue",
    famille: "Vers la décision",
    quoi: "Les trois déclinaisons que vous gardez : le repère, en plages, l’action au pouce.",
    retenu: true,
  },
  {
    fichier: "09-calme-x-aman-retouche.html",
    titre: "Le calme × Aman, retouché",
    famille: "Vers la décision",
    quoi: "Le premier écran de 05, avec le pied d’Aman et le trait qui ferme l’en-tête.",
    retenu: true,
  },
  {
    fichier: "10-le-calme-en-couleurs.html",
    titre: "Les deux retenus, en seize chartes",
    famille: "Vers la décision",
    quoi: "La même paire d’écrans, seize fois : les neuf chartes déjà vues, plus sept qui vont jusqu’à cinq teintes.",
    retenu: true,
  },
  {
    fichier: "11-ecran-retenu-seize-couleurs.html",
    titre: "L’écran retenu, seize couleurs",
    famille: "Vers la décision",
    quoi: "Le trait seul — celui qu’il garde — dans les seize chartes, quatre par rangée.",
    retenu: true,
  },
  {
    fichier: "12-origine-plus-fin.html",
    titre: "Origine, plus fin — trois tentatives",
    famille: "Vers la décision",
    quoi: "Encadrés amincis et resserrés, puis deux façons d’enlever la boîte : l’ourlet, et le fil.",
    retenu: true,
  },
  {
    fichier: "13-le-fil-quatre-couleurs.html",
    titre: "Le fil, en quatre couleurs",
    famille: "Vers la décision",
    quoi: "Sans le cheveu sous ATLAS. Les trois formes de liste × Origine, Ivoire, Sylve, Océan.",
    retenu: true,
  },
  {
    fichier: "14-le-geste-nouveau-chantier.html",
    titre: "Six façons d’ouvrir un chantier",
    famille: "Enlever le gros bouton",
    quoi: "L’aplat vert remplacé six fois : le filet qui se trace, le sceau, le premier brin, le cartouche gravé, la pastille au pouce, la légende sur le trait.",
    retenu: true,
  },
  {
    fichier: "15-encore-six-gestes.html",
    titre: "Encore six gestes",
    famille: "Enlever le gros bouton",
    quoi: "Deuxième tournée : la ligne du registre, le titre qui porte l’action, la marque d’imprimeur, le cinquième onglet, tirer pour ouvrir, le signet sur la tranche.",
    retenu: true,
  },
  {
    fichier: "16-la-pastille-qui-tourne.html",
    titre: "La pastille qui tourne",
    famille: "Enlever le gros bouton",
    quoi: "La seule maquette qui répond au doigt : on appuie, la rose des vents part en trois tours, jette une onde et dix éclats, et la feuille monte une demi-seconde plus tard.",
    retenu: true,
  },
  {
    fichier: "17-six-marques.html",
    titre: "Six marques pour le sceau",
    famille: "Enlever le gros bouton",
    quoi: "Le sceau clair est retenu ; seule la gravure change. Le cadran, le trait pur, le monogramme, la facette, l’anneau et la bille, le point — les six se pressent.",
    retenu: true,
  },
  {
    fichier: "18-six-matieres.html",
    titre: "Six matières, et deux qui s’ouvrent en devenant la page",
    famille: "Enlever le gros bouton",
    quoi: "Plus aucun disque clair : laque, or brossé, cire, encre vivante — ou pas de disque du tout. Sur l’iris et le vide, la feuille ne monte pas : le bouton s’agrandit jusqu’à devenir la page.",
    retenu: true,
  },
  {
    fichier: "19-six-gestes-tenus.html",
    titre: "Six gestes tenus",
    famille: "Enlever le gros bouton",
    quoi: "Retour à la retenue : la gerbe est partie, les matières imitées aussi. Une seule chose bouge à la fois. Le mot, la goutte d’or, le disque de nuit, le cercle qui se ferme, le filet traversé, les deux volets.",
    retenu: true,
  },
  {
    fichier: "20-le-rond-qui-eclate.html",
    titre: "Le rond éclate, et devient la page",
    famille: "Enlever le gros bouton",
    quoi: "Un rond plein, un « + », une explosion de débris, et le rond qui s’agrandit jusqu’à remplir l’écran. Six gerbes : poussière, tessons du rond lui-même, braises qui retombent, aucun débris, gerbe sombre sur or, signe qui se brise.",
    retenu: true,
  },
  {
    fichier: "21-le-plus-du-titre.html",
    titre: "Le « + » du titre, et six tours",
    famille: "Enlever le gros bouton",
    quoi: "Le bouton qu’il a désigné : l’anneau au bout de « Vos chantiers », qui ne coûte aucune ligne. Trois tours rapides puis la page — et six façons de le décliner.",
    retenu: true,
  },
  {
    fichier: "22-le-rond-entre-deux-traits.html",
    titre: "Le rond au milieu, entre deux traits",
    famille: "Enlever le gros bouton",
    quoi: "Le même anneau, ramené AU CENTRE, avec un petit trait de chaque côté qui s’écarte quand le signe part en trois tours. Huit déclinaisons, dont deux qui reprennent l’anneau de la note vocale.",
    retenu: true,
  },
  {
    fichier: "23-le-mot-et-le-rond-qui-bat.html",
    titre: "Le mot, le rond qui bat, et la poussière",
    famille: "Enlever le gros bouton",
    quoi: "Le mixte : le mot écrit, le rond qui bat en attendant le doigt, et au clic le tour et la poussière. Sept dispositions du mot — à droite, coupé en deux, en petit doré dessous, « Ajouter », avec les traits, au-dessus, ou effacé par le geste.",
    retenu: true,
  },
  {
    fichier: "24-le-bouton-retenu.html",
    titre: "Le bouton retenu, resserré",
    famille: "Enlever le gros bouton",
    quoi: "Celui qu’il a gardé, et lui seul : le mot, le rond qui bat à sa droite. Onde ramenée de 1,85 à 1,42 fois le rond, rond de 46 à 38 px, gerbe de seize grains à onze.",
    retenu: true,
  },
  {
    fichier: "25-les-deux-portes.html",
    titre: "Les deux portes, côte à côte",
    famille: "Les deux portes de la création",
    quoi: "Six façons de montrer « créer le chantier » ET « devis à la main » d’un seul coup d’œil. La 4 bascule pour de bon, sans script.",
    retenu: true,
  },
  {
    fichier: "26-la-bascule-affinee.html",
    titre: "La bascule, affinée",
    famille: "Les deux portes de la création",
    quoi: "Six déclinaisons de la proposition 4 : le trait qui glisse, le point d’or, la plage, la perle, le cartouche, la bascule en pied.",
    retenu: true,
  },
  {
    fichier: "28-le-bouton.html",
    titre: "Le bouton, huit façons",
    famille: "Les deux portes de la création",
    quoi: "« Trop gros, carré. » Filet, bandeau fin, plaque gravée, sceau, capsule, double filet, trait d’or, angle adouci. La capsule est retenue.",
    retenu: true,
  },
  {
    fichier: "33-le-devis-parti-allege.html",
    titre: "Le devis parti, allégé",
    famille: "Dire moins sur l’écran du devis",
    quoi: "« Trop d’infos sur cette page » : l’écran en porte onze blocs et déborde de 382 px. Quatre façons de retrancher — l’adresse effacée, l’état monté dans le titre, le devis replié, ou le geste seul sous le pouce — et la question du bouton « carré », mesurée : il est déjà au rayon des cartes.",
    retenu: true,
  },
  {
    fichier: "34-le-devis-sur-sa-base.html",
    titre: "Le devis parti, sur sa base",
    famille: "Dire moins sur l’écran du devis",
    quoi: "Ce qu’il a arrêté : le nom du devis et le total, plus de lignes, « Modifier mon devis » sous le total, et les trois actions en encre foncée. Sa base au mot près, puis quatre façons de la tenir — sans carte, dans le titre, les actions empilées, ou le signet d’or.",
    retenu: true,
  },
  {
    fichier: "35-l-ecran-de-connexion.html",
    titre: "L’écran de connexion",
    famille: "La dernière porte",
    quoi: "Le seul écran resté dans l’identité d’avant le 3 août. L’avant, puis quatre après : la carte gardée, sans carte, le sceau, la ligne d’imprimé. Un bouton montre le refus de connexion sur les cinq écrans à la fois.",
  },
  {
    fichier: "36-le-logo-qui-sanime.html",
    titre: "Le logo qui s’anime",
    famille: "La dernière porte",
    quoi: "La proposition 4 sans son titre, le sceau et ATLAS au-dessus, et la marque qui s’anime une demi-seconde avant d’entrer. Ça s’essaie : on appuie sur « Entrer », l’application arrive. Six animations, l’écran étant identique partout.",
  },
  {
    fichier: "37-le-motif-du-sceau.html",
    titre: "Le motif dans le rond d’or",
    famille: "La dernière porte",
    quoi: "Le tour est retenu ; seule la gravure change. Huit motifs, et une bande en tête qui les montre à leur taille réelle — c’est là que se juge lequel tient encore à six millimètres.",
  },
  {
    fichier: "40-le-message-du-devis-fige.html",
    titre: "Le message du devis figé",
    famille: "Dire moins sur l’écran du devis",
    quoi: "« Le message dit de consulter la case devis, mais aucune case devis n’existe. » Le témoin, puis trois façons : le message devient la porte, un vrai bouton, ou plus de message du tout.",
    retenu: true,
  },
  {
    fichier: "44-la-feuille-denvoi.html",
    titre: "La feuille d’envoi : un seul geste à la fois",
    famille: "La feuille d’envoi",
    quoi: "Deux boutons pleins l’un sous l’autre sur la feuille d’un devis corrigé. Deux lectures du retrait, montrées dans les deux moments — avant et après l’envoi — et trois dosages de « Plutôt par e-mail ».",
  },
  {
    fichier: "45-modifier-son-devis.html",
    titre: "Le devis : le reprendre avant de l’envoyer",
    famille: "Le devis avant l’envoi",
    quoi: "Tout est là pour vérifier, rien pour corriger : « Modifier mon devis » n’existe qu’APRÈS l’envoi. Son idée — le mot « Devis » cliquable — dessinée telle quelle, et quatre autres façons d’y arriver.",
  },
  {
    fichier: "46-pendant-que-ca-batit.html",
    titre: "Pendant que ça bâtit",
    famille: "Le banc d’essai",
    quoi: "« Les nouvelles pages ne chargent mal ou pas du tout. » Rien n’était cassé : le banc sert en mode développement pendant qu’il bâtit, et rien ne le disait. Trois façons de montrer l’avancement, avec les mesures.",
  },
  {
    fichier: "55-une-equipe-part-cinq-jours.html",
    titre: "Une équipe part cinq jours",
    famille: "Le planning",
    quoi: "« Comment on fait si une équipe part en déplacement pour cinq jours ? » Si toute l’entreprise part, l’agenda Google suffit déjà. Si une équipe sur deux part, rien ne convient. Trois endroits où poser le geste.",
    fichier: "57-apparier-deux-demi-journees.html",
    titre: "Apparier deux demi-journées",
    famille: "Le planning",
    quoi: "Quand une demi-journée est prise et l’autre libre, Atlas propose le chantier en attente le plus proche. Quatre façons de le dire, le bandeau dessiné à vol d’oiseau ET par la route, et les deux cas où il n’y a rien de bon à proposer.",
  },
  {
    fichier: "56-le-devis-qui-tarde.html",
    titre: "Le devis qui tarde : le rappel, et le délai",
    famille: "Le devis avant l’envoi",
    quoi: "Un rappel quand un chantier reste sans devis. CODÉ le 16 août sur ses trois réponses : carte teintée avec le compte des jours, quatre jours, et « Chantier sans devis » — le seul libellé qui ne se confond pas avec sa voisine.",
  },
  {
    fichier: "58-le-nombre-de-jours-en-or.html",
    titre: "Le nombre de jours, en or",
    famille: "Le planning",
    quoi: "« Avant il y avait le nombre de jour en doré, où c’est passé ? » — il n’avait jamais existé dans l’application. Quatre écritures de la même ligne, et les trois choses qui en approchaient, retrouvées dans l’historique plutôt que devinées.",
  },
  {
    fichier: "59-la-ligne-qui-dit-tout.html",
    titre: "La ligne qui dit tout",
    famille: "Le planning",
    quoi: "La date, le moment de départ et la durée sur la ligne d’un chantier posé, sur les cinq cas du produit. Retenue puis CODÉE le 15 août — « je veux journée et toute la ligne ».",
  },
  {
    fichier: "60-les-conditions-sur-le-devis.html",
    titre: "Les conditions sur le devis",
    famille: "Le devis",
    quoi: "Six conditions se règlent, une seule arrive sur le document — son constat du 16 août. Trois façons de faire monter les cinq autres, face au champ de notes qu’il peut déjà avoir rempli.",
  },
  {
    fichier: "61-la-reduction-au-client.html",
    titre: "La réduction au client",
    famille: "Le devis",
    quoi: "« Fais cinq pour cent sur le montant du devis » — où la petite ligne se pose, et sous quel mot. Le coût des trois est très inégal : une ligne voyage seule jusqu’à la facture.",
  },
  {
    fichier: "62-la-fiche-dentretien.html",
    titre: "La fiche d’entretien",
    famille: "L’entretien récurrent",
    quoi: "Ce que le paysagiste coche sur le chantier. Vingt prestations, quatre faites : tiennent-elles au pouce ? Trois gestes — la liste d’un bloc, rangée par familles, ou trois états avec « sans objet ».",
  },
  {
    fichier: "63-le-rapport-au-client.html",
    titre: "Le rapport que reçoit le client",
    famille: "L’entretien récurrent",
    quoi: "La sortie de la fiche. L’autre application lui montre seize fois « Faux » sur un passage qu’il paie : tout, seulement ce qui a été fait, ou le reste replié en une phrase.",
  },
  {
    fichier: "64-composer-sa-fiche.html",
    titre: "Composer sa fiche d’entretien",
    famille: "L’entretien récurrent",
    quoi: "Dans les Réglages : ajouter, retirer, renommer ses prestations. La question qui reste — une seule fiche pour tous, ou un modèle puis une fiche par client.",
  },
  {
    fichier: "65-choisir-l-heure.html",
    titre: "Choisir l’heure au pouce",
    famille: "L’entretien récurrent",
    quoi: "« Ne pas avoir à l’écrire » : la molette du téléphone, les quarts d’heure, ou une vraie molette Atlas — faite sans une ligne de JavaScript. Faites-la tourner au doigt.",
  },
  {
    fichier: "66-ce-que-je-sais-du-client.html",
    titre: "Ce que je sais du client",
    famille: "Les chantiers",
    quoi: "L’application sait qu’un client est venu quatre fois et qu’il doit encore 740 € — elle ne le montre nulle part. Un encart, une fiche, ou un cinquième onglet.",
  },
  {
    fichier: "67-le-nouveau-chantier-plus-gros.html",
    titre: "Le nouveau chantier, plus gros",
    famille: "Enlever le gros bouton",
    quoi: "« Le plus gros et en gras » — trois formes, trois tailles, trois graisses, et le témoin d’aujourd’hui figé à côté. Le cran le plus gros est celui qui tient encore sans couper le mot sur un écran de 360 px.",
  },
  {
    fichier: "68-retirer-le-prix-accorde.html",
    titre: "Retirer le prix accordé",
    famille: "Le devis",
    quoi: "« Il n’y a aucun moyen de retirer les cinq pour cent. » Écrire 0 ne le retirait pas, la voix non plus — les deux sont réparés. Reste le « petit moins » : glisser la ligne, un rond en face, ou la ligne du bas qui bascule.",
  },
  {
    fichier: "69-le-plan-darrosage.html",
    titre: "Le plan d’arrosage",
    famille: "L’arrosage automatique",
    quoi: "« Un outil pour les paysagistes pour réaliser des plans d’arrosage automatique. » Trois façons d’entrer le jardin : la feuille, les zones mesurées, ou le plan dessiné.",
  },
  {
    fichier: "70-le-debit-ne-se-partage-pas.html",
    titre: "Le débit ne se partage pas",
    famille: "L’arrosage automatique",
    quoi: "Le calcul qui fait tout l’outil, et rien n’y est à choisir : 1,80 m³/h au robinet, 8,47 demandés, huit secteurs, 3 h 14 de cycle.",
  },
  {
    fichier: "71-ce-qui-sort-du-plan.html",
    titre: "Ce qui sort du plan",
    famille: "L’arrosage automatique",
    quoi: "Le devis, la carte du coffret, le plan remis au client. Ce qu’il y a à choisir : par lequel on commence.",
  },
  {
    fichier: "73-le-trace-du-tuyau.html",
    titre: "Le tracé du tuyau",
    famille: "L’arrosage automatique",
    quoi: "Une seule ligne en serpentin, ou plusieurs lignes parallèles ? Le même secteur tracé des deux façons pour qu’il pointe son geste réel. Tranché : c’est B.",
  },
  {
    fichier: "77-il-ne-paie-pas.html",
    titre: "Il ne paie pas",
    famille: "L’argent qui ne rentre pas",
    quoi: "Un avoir éteint la dette et interdit de réclamer ; une facture déclarée perdue reste réclamable. Trois arrangements.",
  },
  {
    fichier: "78-l-avoir.html",
    titre: "L’avoir",
    famille: "L’argent qui ne rentre pas",
    quoi: "La forme du document : à part, en mention, ou facture refaite. Trois montants essayables, tous recalculés.",
  },
  {
    fichier: "76-le-cinquieme-onglet.html",
    titre: "Le cinquième onglet",
    famille: "L’arrosage automatique",
    quoi: "Où ranger les outils métier ? Sa décision : un cinquième onglet « Outils ». Cinq variantes de barre, mesurées à 360 px — deux sont à écarter.",
  },
  {
    fichier: "75-le-plan-comme-le-sien.html",
    titre: "Le plan comme le sien",
    famille: "L’arrosage automatique",
    quoi: "Sa photo d’un plan d’exécution, refaite un réseau par couleur : la cible du produit, dessinée avant d’écrire le moteur de plan.",
  },
  {
    fichier: "74-ou-sont-les-tes.html",
    titre: "Où sont les tés",
    famille: "L’arrosage automatique",
    quoi: "« Combien de té ? Où sont-ils ? Marque-les d’un point jaune ! » — son tracé libre, cinq tés marqués, et la règle qui vaut partout : N arroseurs, N − 1 tés.",
  },
  {
    fichier: "72-mes-mots-au-catalogue.html",
    titre: "Mes mots au catalogue",
    famille: "Les réglages",
    quoi: "« À quoi sert cette page ?? On peut rien modifier rajouter » — le catalogue appartient à tout le monde : à part, par-dessus, ou tout mélangé. Et la flèche de retour revient.",
  },
];

/* ————————————————————————————————————————————————————————————————
   Une maquette qu'il ne peut pas atteindre n'existe pas
   ————————————————————————————————————————————————————————————————

   **Ce que ce contrôle a trouvé le 15 août 2026, et qui ne se voyait nulle
   part : six maquettes dessinées, commises, et introuvables.** 38, 39, 41, 42,
   43 et 46 n'étaient inscrites ni au sommaire (`index.html`) ni à la page
   unique. Elles n'existaient que pour qui connaissait leur nom de fichier —
   c'est-à-dire pour personne, le patron ne consultant que ces deux portes.

   Le compte affiché ne pouvait pas l'attraper : « 36 maquettes fusionnées »
   reste parfaitement plausible quand il en manque six.

   Les deux portes n'ont pas le même rôle, et l'exigence porte donc sur leur
   RÉUNION, pas sur chacune : la page unique est une SÉLECTION — elle recolle
   les maquettes de charte, et laisse dehors celles qui se manipulent (les
   « à l'essai », qui ne valent que seules) ; le sommaire est le CATALOGUE.
   Être dans l'une des deux suffit ; n'être dans aucune est le défaut.

   Second contrôle, sur les numéros. Le patron les désigne par leur chiffre —
   « fais la 34 » — et cinq numéros étaient déjà portés en double.
*/
function verifierLaListe() {
  const plaintes = [];

  const surDisque = readdirSync(SOURCE)
    .filter((f) => /^\d/.test(f) && f.endsWith(".html"))
    .sort();
  const inscrites = new Set(MAQUETTES.map((m) => m.fichier));
  const sommaire = readFileSync(join(SOURCE, "index.html"), "utf8");

  for (const f of surDisque) {
    if (!inscrites.has(f) && !sommaire.includes(f)) {
      plaintes.push(
        `« ${f} » n'est ni au sommaire ni dans la page unique : le patron n'a aucun chemin qui y mène.`,
      );
    }
  }
  for (const m of MAQUETTES) {
    if (!existsSync(join(SOURCE, m.fichier))) {
      plaintes.push(`« ${m.fichier} » est inscrite mais introuvable dans ${SOURCE}.`);
    }
  }
  // Un lien mort dans le sommaire est le défaut d'origine de ce dossier : le
  // patron a cliqué, et rien ne s'est ouvert.
  for (const lien of sommaire.matchAll(/href="(\d[^"]*\.html)"/g)) {
    if (!existsSync(join(SOURCE, lien[1]))) {
      plaintes.push(`le sommaire renvoie à « ${lien[1] } », qui n'existe pas.`);
    }
  }

  const parNumero = new Map();
  for (const f of surDisque) {
    const numero = f.slice(0, 2);
    if (!parNumero.has(numero)) parNumero.set(numero, []);
    parNumero.get(numero).push(f);
  }
  // Les doublons d'avant le 15 août sont tolérés NOMMÉMENT : les renuméroter
  // casserait les renvois déjà écrits dans TODO.md, ARCHITECTURE.md et dans les
  // conversations. Tout nouveau doublon, lui, fait rougir.
  //
  // Le 50 est un cas à part, et volontaire : Gunzi, Goonzi et Gunzy sont LA MÊME
  // planche sous trois noms, montrées côte à côte. Les séparer les rendrait
  // incomparables.
  const DOUBLONS_HERITES = new Set(["33", "34", "35", "36", "37", "50"]);
  for (const [numero, fichiers] of parNumero) {
    if (fichiers.length > 1 && !DOUBLONS_HERITES.has(numero)) {
      plaintes.push(
        `le numéro ${numero} est porté par ${fichiers.length} maquettes (${fichiers.join(", ")}) : « fais la ${Number(numero)} » ne désigne plus rien.`,
      );
    }
  }

  if (plaintes.length) {
    console.error("La liste des maquettes est en défaut :\n  • " + plaintes.join("\n  • "));
    process.exit(1);
  }
}

verifierLaListe();

/* ————————————————————————————————————————————————————————————————
   Confinement de la feuille de style
   ———————————————————————————————————————————————————————————————— */

function sansCommentaires(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Découpe une liste de sélecteurs sur les virgules de premier niveau : une
// virgule dans :not(…) ou rgba(…) n'en sépare pas deux.
function decouperSelecteurs(liste) {
  const morceaux = [];
  let courant = "";
  let parentheses = 0;
  let crochets = 0;
  for (const c of liste) {
    if (c === "(") parentheses += 1;
    else if (c === ")") parentheses -= 1;
    else if (c === "[") crochets += 1;
    else if (c === "]") crochets -= 1;
    if (c === "," && parentheses === 0 && crochets === 0) {
      morceaux.push(courant);
      courant = "";
      continue;
    }
    courant += c;
  }
  morceaux.push(courant);
  return morceaux;
}

function confinerSelecteur(selecteur, hote) {
  const s = selecteur.trim();
  if (!s) return "";
  if (s === "*") return `${hote}, ${hote} *`;
  // :root, html et body désignaient la page entière : ils désignent
  // désormais la section, qui joue ce rôle dans la page fusionnée.
  const racine = s.match(/^(:root|html|body)(?![\w-])/);
  if (racine) return hote + s.slice(racine[1].length);
  return `${hote} ${s}`;
}

// Les règles imbriquées d'une at-rule à blocs (@media, @supports) sont
// confinées récursivement ; @keyframes et @font-face n'ont pas de sélecteurs
// à réécrire et passent intactes.
const AT_RULES_TRANSPARENTES = /^@(media|supports|layer|container)\b/;
const AT_RULES_OPAQUES = /^@(keyframes|-webkit-keyframes|font-face|counter-style|property|page)\b/;

function confinerCss(css, hote) {
  let sortie = "";
  let i = 0;
  while (i < css.length) {
    const ouvrante = css.indexOf("{", i);
    if (ouvrante === -1) {
      sortie += css.slice(i);
      break;
    }
    const prelude = css.slice(i, ouvrante).trim();

    // Une at-rule sans bloc (@import, @charset) se termine par un point-virgule
    // avant l'accolade : on la recopie et on reprend après.
    const pointVirgule = prelude.lastIndexOf(";");
    if (pointVirgule !== -1) {
      sortie += css.slice(i, i + pointVirgule + 1) + "\n";
      i += pointVirgule + 1;
      continue;
    }

    let profondeur = 1;
    let j = ouvrante + 1;
    while (j < css.length && profondeur > 0) {
      if (css[j] === "{") profondeur += 1;
      else if (css[j] === "}") profondeur -= 1;
      j += 1;
    }
    if (profondeur !== 0) {
      throw new Error(`Accolade non refermée près de « ${prelude.slice(0, 60)} »`);
    }
    const corps = css.slice(ouvrante + 1, j - 1);

    if (AT_RULES_TRANSPARENTES.test(prelude)) {
      sortie += `${prelude}{\n${confinerCss(corps, hote)}\n}\n`;
    } else if (AT_RULES_OPAQUES.test(prelude)) {
      sortie += `${prelude}{${corps}}\n`;
    } else {
      const selecteurs = decouperSelecteurs(prelude)
        .map((s) => confinerSelecteur(s, hote))
        .filter(Boolean)
        .join(",");
      sortie += `${selecteurs}{${corps}}\n`;
    }
    i = j;
  }
  return sortie;
}

// Un nom d'animation est GLOBAL, comme un identifiant : deux maquettes qui
// déclarent chacune un `@keyframes halo` se le disputent, et la dernière lue
// gagne pour toute la page. Le confinement par ancêtre ne protège pas de cela —
// il ne touche qu'aux sélecteurs. On préfixe donc les noms, et on ne les
// réécrit que dans `animation` et `animation-name` : ailleurs, le même mot
// pourrait être une classe.
function confinerAnimations(css, prefixe) {
  const noms = [...css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g)].map((m) => m[1]);
  if (noms.length === 0) return css;
  let sortie = css.replace(
    /(@(?:-webkit-)?keyframes\s+)([\w-]+)/g,
    (_, tete, nom) => `${tete}${prefixe}-${nom}`,
  );
  sortie = sortie.replace(/(animation(?:-name)?\s*:)([^;}]*)/g, (_, tete, valeur) => {
    let v = valeur;
    for (const nom of noms) {
      v = v.replace(new RegExp(`(^|[\\s,])${nom}(?![\\w-])`, "g"), `$1${prefixe}-${nom}`);
    }
    return tete + v;
  });
  return sortie;
}

// Les pourcentages d'un `@keyframes` ne sont pas des sélecteurs : ils n'ont
// rien à confiner, et le contrôle qui les prenait pour tels refusait toute
// maquette animée. On les retire avant de vérifier le confinement.
function sansBlocsOpaques(css) {
  let sortie = "";
  let i = 0;
  while (i < css.length) {
    const at = css.slice(i).search(/@(?:-webkit-)?keyframes|@font-face/);
    if (at === -1) {
      sortie += css.slice(i);
      break;
    }
    const debut = i + at;
    sortie += css.slice(i, debut);
    const ouvrante = css.indexOf("{", debut);
    if (ouvrante === -1) break;
    let profondeur = 1;
    let j = ouvrante + 1;
    while (j < css.length && profondeur > 0) {
      if (css[j] === "{") profondeur += 1;
      else if (css[j] === "}") profondeur -= 1;
      j += 1;
    }
    i = j;
  }
  return sortie;
}

/* ————————————————————————————————————————————————————————————————
   Lecture et découpe d'une maquette
   ———————————————————————————————————————————————————————————————— */

// Les identifiants que les scripts vont chercher : ils sont dupliqués d'un
// fichier à l'autre, donc préfixés. Ceux d'un SVG (#feuille, #vert) sont
// uniques et référencés par <use>/url() : on n'y touche pas.
const IDS_A_PREFIXER = ["modele", "duo", "trio", "g1", "g2", "g3", "chartes", "ecran"];

// **Et les familles d'identifiants numérotés**, qui ne peuvent pas s'énumérer :
// une maquette à huit écrans en pose vingt-quatre, la suivante en posera
// d'autres. Les nommer un par un dans la liste ci-dessus, c'est se condamner à
// l'oublier — et l'oubli ne se voit pas : deux maquettes qui portent chacune un
// `entrer-1` donnent une page unique où le libellé de la seconde coche la case
// de la PREMIÈRE. Elle s'affiche parfaitement et ne répond à rien. Trouvé le
// 12 août 2026 en ajoutant la maquette 34 à côté de la 33.
const FAMILLES_A_PREFIXER = [
  /^entrer-\d+$/,
  /^adresse-\d+$/,
  /^mdp-\d+$/,
  // Les réglages en lettre-tiret-lettre des planches récentes (`f-a`, `t-3`,
  // `g-2`, `v-b`, `m-1`…). Ils sont si courts que deux maquettes finiront par
  // se les partager, et la panne est muette : la seconde cocherait la case de
  // la première. Préfixés d'avance plutôt qu'après coup.
  /^[a-z]-[a-z0-9]{1,3}$/,
];

/** Les identifiants du corps qui appartiennent à une famille numérotée. */
function idsDeFamille(corps) {
  const trouves = new Set();
  for (const m of corps.matchAll(/id="([^"]+)"/g)) {
    if (FAMILLES_A_PREFIXER.some((f) => f.test(m[1]))) trouves.add(m[1]);
  }
  return [...trouves];
}

function lire(maquette, indice) {
  const numero = String(indice + 1).padStart(2, "0");
  const hote = `#s${numero}`;
  const brut = readFileSync(join(SOURCE, maquette.fichier), "utf8");

  const style = brut.match(/<style>([\s\S]*?)<\/style>/);
  if (!style) throw new Error(`${maquette.fichier} : pas de <style>`);

  let corps = brut
    .replace(/<!doctype[^>]*>/i, "")
    .replace(/<\/?(html|head|body)[^>]*>/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<style>[\s\S]*?<\/style>/, "")
    .trim();

  const scripts = [];
  corps = corps.replace(/<script>([\s\S]*?)<\/script>/g, (_, code) => {
    scripts.push(code);
    return "";
  });

  const prefixes = [];
  for (const id of [...IDS_A_PREFIXER, ...idsDeFamille(corps)]) {
    if (!corps.includes(`id="${id}"`)) continue;
    corps = corps.replaceAll(`id="${id}"`, `id="s${numero}-${id}"`);
    // **Et le `for` du libellé avec, sinon la case ne se coche plus.** Une
    // maquette sans script peut dépendre d'un identifiant tout autant qu'une
    // autre : `<label for="g1">` sur `<input id="g1">` est ce qui rend une
    // bascule ou un bouton utilisable sans JavaScript. Préfixer l'un sans
    // l'autre laisse une page qui s'affiche parfaitement et ne répond à rien —
    // la pire des pannes, parce qu'aucune capture ne la montre. Trouvé le
    // 12 août 2026 sur la maquette du logo, par le contrôle et non à l'œil.
    corps = corps.replaceAll(`for="${id}"`, `for="s${numero}-${id}"`);
    prefixes.push(id);
  }

  // **Et la FEUILLE DE STYLE avec, sinon la planche s'affiche et ne répond à
  // rien.** Une maquette sans script pilote ses états par `#t-3:checked ~ …` et
  // colore la pastille choisie par `label[for="t-3"]`. Préfixer l'identifiant
  // dans le corps sans le suivre dans le style, c'est casser exactement ce
  // qu'on venait de protéger : les trois formes disparaissent d'un coup, ou
  // pire, une seule reste figée. Trouvé le 16 août 2026 en ajoutant la 62 —
  // par le contrôle plus bas, jamais à l'œil.
  //
  // Du plus long au plus court : `#t-1` ne doit pas mordre dans `#t-15`.
  let feuille = sansCommentaires(style[1]);
  for (const id of [...prefixes].sort((a, b) => b.length - a.length)) {
    feuille = feuille.replaceAll(`for="${id}"`, `for="s${numero}-${id}"`);
    feuille = feuille.replace(new RegExp(`#${id}\\b`, "g"), `#s${numero}-${id}`);
  }

  return {
    ...maquette,
    numero,
    ancre: `m${numero}`,
    hote: `s${numero}`,
    prefixes,
    css: confinerAnimations(confinerCss(feuille, hote), `s${numero}`),
    corps: corps.trim(),
    scripts,
  };
}

const pages = MAQUETTES.map(lire);

/* ————————————————————————————————————————————————————————————————
   Contrôles : un contrôle qui ne sait pas échouer ne prouve rien.
   ———————————————————————————————————————————————————————————————— */

const plaintes = [];
for (const p of pages) {
  if (!p.corps) plaintes.push(`${p.fichier} : corps vide après découpe`);
  if (/:root|^\s*body\s*\{/m.test(p.css)) {
    plaintes.push(`${p.fichier} : un :root ou un body a survécu au confinement`);
  }
  const regles = sansBlocsOpaques(p.css).match(/[^{}]+\{/g) ?? [];
  for (const r of regles) {
    const sel = r.slice(0, -1).trim();
    if (sel.startsWith("@")) continue;
    if (!sel.split(",").every((s) => s.trim().startsWith(`#${p.hote}`))) {
      plaintes.push(`${p.fichier} : sélecteur non confiné « ${sel.slice(0, 70)} »`);
    }
  }
  // **Aucune référence orpheline dans le style.** Un `#t-3` ou un
  // `label[for="t-3"]` resté nu dans la feuille alors que le corps porte
  // `s43-t-3` ne désigne plus rien : la page s'affiche parfaitement et ne
  // répond à rien — la panne que ce script existe pour empêcher.
  for (const id of p.prefixes) {
    if (new RegExp(`#${id}\\b`).test(p.css) || p.css.includes(`for="${id}"`)) {
      plaintes.push(
        `${p.fichier} : la feuille désigne encore #${id} alors que le corps porte ` +
          `#${p.hote}-${id} — les réglages ne répondraient plus`,
      );
    }
  }

  // Chaque identifiant que le script va chercher doit exister, PRÉFIXÉ, dans
  // le corps — sinon le clonage tombe sur null au chargement de la page.
  // Le contrôle lit les appels réels plutôt que de supposer un nom : il
  // accusait « gabarit non préfixé » sur une maquette dont le gabarit
  // s'appelait simplement autrement.
  for (const code of p.scripts) {
    for (const appel of code.matchAll(/getElementById\(\s*["'`]([\w-]+)["'`]\s*\)/g)) {
      const id = appel[1];
      if (!IDS_A_PREFIXER.includes(id)) {
        plaintes.push(
          `${p.fichier} : le script cherche #${id}, absent de IDS_A_PREFIXER — ` +
            `il entrerait en collision avec une autre maquette`,
        );
      } else if (!p.corps.includes(`id="${p.hote}-${id}"`)) {
        plaintes.push(`${p.fichier} : le script cherche #${id}, introuvable dans le corps`);
      }
    }
  }
}
if (plaintes.length) {
  console.error("Fusion refusée :\n  " + plaintes.join("\n  "));
  process.exit(1);
}

/* ————————————————————————————————————————————————————————————————
   Assemblage
   ———————————————————————————————————————————————————————————————— */

const familles = [];
for (const p of pages) {
  const derniere = familles[familles.length - 1];
  if (derniere && derniere.nom === p.famille) derniere.pages.push(p);
  else familles.push({ nom: p.famille, pages: [p] });
}

const sommaire = familles
  .map(
    (f) => `      <p class="famille">${f.nom}</p>
${f.pages
  .map(
    (p) => `      <a class="item${p.retenu ? " retenu" : ""}" href="#${p.ancre}">
        <span class="no">${p.numero}</span><span class="titre">${p.titre}</span><span class="fleche">↓</span>
        <span class="quoi">${p.quoi}</span>
      </a>`,
  )
  .join("\n")}`,
  )
  .join("\n");

const sections = pages
  .map(
    (p) => `  <section class="etape" id="${p.ancre}">
    <div class="etape-tete">
      <span class="etape-no">${p.numero}</span>
      <h2>${p.titre}</h2>
      <a class="retour" href="#sommaire">Sommaire ↑</a>
    </div>
    <div class="cadre" id="${p.hote}">
${p.corps}
    </div>
  </section>`,
  )
  .join("\n\n");

const styles = pages.map((p) => `/* ${p.numero} — ${p.titre} */\n${p.css}`).join("\n");

// Chaque script d'origine allait chercher ses nœuds dans `document`. Il reçoit
// ici un `document` restreint à sa section, avec le préfixe d'identifiant
// appliqué : le code n'a pas eu à être réécrit, donc il ne peut pas diverger
// de l'original.
const scripts = pages
  .flatMap((p) =>
    p.scripts.map(
      // Chaque maquette est enfermée dans son propre essai : une erreur dans
      // le script de l'une laissait les suivantes non armées, et la page
      // paraissait à moitié morte sans qu'aucun message ne dise laquelle
      // avait fauté.
      (code) => `try { (function (document) {
${code}
})(porteeDe(${JSON.stringify(p.hote)})); } catch (erreur) {
  console.error("Maquette ${p.numero} — son script a échoué :", erreur);
}`,
    ),
  )
  .join("\n\n");

const corpsDeLaPage = `<style>
  /*
    Toutes les maquettes sur une seule page.

    Chaque feuille de style d'origine est confinée sous #s01, #s02, … : les
    fichiers partagent les mêmes noms de classes, et sans ce confinement la
    charte de l'une repeindrait l'autre. Cette page est engendrée par
    scripts/fusionner-maquettes.mjs à partir des fichiers numérotés voisins, qui
    restent la source.
  */
  :root{
    --fond:#efece6; --plage:#f6f4ef; --encre:#221f1a; --gris:#8b8478;
    --bronze:#8a7452; --trait:rgba(34,31,26,.13);
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --fond:#171613; --plage:#1e1c18; --encre:#e9e5dc; --gris:#8a867c;
      --bronze:#b39b72; --trait:rgba(233,229,220,.16);
    }
  }
  :root[data-theme="dark"]{
    --fond:#171613; --plage:#1e1c18; --encre:#e9e5dc; --gris:#8a867c;
    --bronze:#b39b72; --trait:rgba(233,229,220,.16);
  }

  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  @media (prefers-reduced-motion: reduce){ html{scroll-behavior:auto} }
  body{margin:0;background:var(--fond);color:var(--encre);
       font:16px/1.65 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}

  .enveloppe{max-width:1180px;margin:0 auto;padding:44px 20px 96px}
  .ouverture{max-width:60ch;margin:0 auto 10px;text-align:center}
  .sur{margin:0 0 14px;font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--bronze)}
  h1{margin:0 0 14px;font:400 34px/1.15 ui-serif,Georgia,"Iowan Old Style",serif;letter-spacing:-.015em;text-wrap:balance}
  .chapo{margin:0;color:var(--gris);font-size:15px}
  .regle{height:1px;background:var(--trait);margin:34px auto 8px;max-width:720px}

  .sommaire{max-width:720px;margin:0 auto}
  .famille{margin:30px 0 12px;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--gris)}
  a.item{display:grid;grid-template-columns:auto 1fr auto;gap:0 16px;align-items:baseline;
         padding:17px 18px;margin-bottom:6px;border-radius:6px;background:var(--plage);
         text-decoration:none;color:inherit}
  a.item:focus-visible{outline:2px solid var(--bronze);outline-offset:2px}
  a.item .no{font-variant-numeric:tabular-nums;color:var(--bronze);font-size:12px;letter-spacing:.1em}
  a.item .titre{font:400 19px/1.2 ui-serif,Georgia,serif}
  a.item .quoi{grid-column:2;margin-top:5px;font-size:12.5px;color:var(--gris);line-height:1.5}
  a.item .fleche{color:var(--gris)}
  a.item.retenu{box-shadow:inset 2px 0 0 var(--bronze)}
  .note{max-width:720px;margin:26px auto 0;padding:16px 18px;border:1px solid var(--trait);border-radius:6px;
        font-size:13px;color:var(--gris);line-height:1.6}
  .note b{color:var(--encre);font-weight:500}

  .etape{scroll-margin-top:12px;padding-top:34px}
  .etape-tete{display:flex;align-items:baseline;gap:14px;max-width:1080px;margin:0 auto 4px;
              padding:0 4px 12px;border-bottom:1px solid var(--trait)}
  .etape-no{font-variant-numeric:tabular-nums;font-size:12px;letter-spacing:.1em;color:var(--bronze)}
  .etape-tete h2{margin:0;font:400 22px/1.2 ui-serif,Georgia,serif;flex:1}
  .retour{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gris);text-decoration:none}
  .retour:hover{color:var(--encre)}
  .retour:focus-visible{outline:2px solid var(--bronze);outline-offset:3px}

  /* La section reçoit les styles de « body » de la maquette d'origine : elle
     apporte son propre fond, son propre encrage, ses propres marges. */
  .cadre{overflow-x:auto}

${styles}
</style>

<div class="enveloppe">
  <div class="ouverture">
    <p class="sur">Atlas — écran Chantiers</p>
    <h1>Toutes les maquettes</h1>
    <p class="chapo">Toutes les propositions, dans l’ordre où elles sont nées, sur une seule page. Cliquez un titre : il vous y emmène.</p>
  </div>

  <div class="regle"></div>

  <nav class="sommaire" id="sommaire" aria-label="Les maquettes">
${sommaire}
    <p class="note">
      <b>Ce qui n’est pas ici.</b> « Le calme » en Nuit, Pierre et Brume — celle que vous n’aimiez pas.
      Ce dossier est un chemin, pas un entrepôt.
      <br><br>
      <b>Une réserve sur les polices.</b> Ces écrans empruntent la serif de votre appareil.
      L’application, elle, charge Playfair Display : le rendu final sera plus dessiné.
    </p>
  </nav>
</div>

${sections}

<script>
  // Chaque maquette engendrait ses écrans en clonant un gabarit. Le code est
  // repris tel quel — donc il ne peut pas diverger de l'original — mais il
  // reçoit un « document » qui ne voit que sa propre section, sinon les
  // scripts se disputeraient les mêmes identifiants.
  function porteeDe(hote) {
    const racine = document.getElementById(hote);
    return {
      getElementById: (id) => racine.querySelector("#" + hote + "-" + id),
      createElement: (nom) => document.createElement(nom),
      // Une maquette qui ne cherche AUCUN identifiant — la 16 arme ses
      // pastilles par leur classe — a quand même besoin de balayer sa
      // section. Sans ces deux-là, son script mourait sur
      // « document.querySelectorAll is not a function », et l'exception
      // emportait avec elle les scripts des maquettes suivantes.
      querySelector: (s) => racine.querySelector(s),
      querySelectorAll: (s) => racine.querySelectorAll(s),
    };
  }

${scripts}
</script>
`;

const TITRE = "Atlas — toutes les maquettes de l'écran Chantiers";

// Deux formes, pour deux usages qui ne se recouvrent pas :
//
//   — le document complet, avec sa déclaration d'encodage, parce qu'un fichier
//     ouvert depuis un disque ou un téléphone doit afficher ses accents. C'est
//     la forme qui vit dans le dépôt, et celle qu'on envoie au patron ;
//   — le fragment, pour la publication en artefact : l'hôte fournit alors sa
//     propre enveloppe, et un document imbriqué dans un autre est invalide.
//
// Le patron a été bloqué par une page publiée qui lui demandait de se
// connecter. Le fichier, lui, ne demande rien à personne : c'est la forme sûre,
// donc la forme par défaut.
const arguments_ = process.argv.slice(2);
const fragment = arguments_.includes("--fragment");
const cible = arguments_.find((a) => !a.startsWith("--")) ?? SORTIE_PAR_DEFAUT;

const page = fragment
  ? `<title>${TITRE}</title>\n${corpsDeLaPage}`
  : `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITRE}</title>
</head>
<body>
${corpsDeLaPage}
</body>
</html>
`;

writeFileSync(cible, page);
console.log(`${pages.length} maquettes fusionnées → ${cible} (${(page.length / 1024).toFixed(0)} Ko)`);
