# Ce que l'assistant sait répondre

*Engendré le 2026-09-30 par `npx tsx scripts/engendrer-questions-reponses.ts`.
Ne pas corriger à la main : corriger la fiche, puis relancer.*

**412 questions**, posées comme un artisan les pose. Pour chacune, la
réponse est la fiche que l'assistant trouve et récite. Chaque fiche est
confrontée au code de l'application : le jour où un bouton change de nom, le
contrôle rougit au lieu de laisser l'assistant enseigner un geste mort.

Ce qui n'est pas dans cette liste, il le cherche dans le sommaire de ses
fiches. S'il ne trouve rien, il le dit, et donne l'adresse à qui écrire. Il
répond aussi sur vos données (qui vous doit, ce que vous avez encaissé, votre
planning), qu'il lit dans l'application : ces réponses-là changent chaque jour,
elles ne sont donc pas ici.

## Comment fonctionne un écran

### « Comment fonctionne le planning ? »

Il présente l'écran Planning, geste par geste, puis détaille celui qu'on lui redemande :

- Ouvrir le planning, le calendrier
- Déplacer un chantier à un autre jour, ou seulement sa matinée ou son après-midi
- Enlever un chantier d'un jour du planning, sans le supprimer
- Donner la feuille de chantier à l'équipe, le devis sans les prix
- Changer de mois dans le calendrier
- Voir ce qui est posé un jour donné, le matin et l'après-midi
- Comprendre les couleurs des jours du calendrier
- Poser directement un client sur un jour, sans devis
- Bloquer du temps pour autre chose qu'un chantier : banque, livraison, formation
- Poser un client sans date depuis la liste du bas
- Annuler la pose qu'on vient de faire
- Supprimer un chantier qui attend une date
- Reposer une demi-journée de chantier qui attend
- Voir les clients qui choisissent eux-mêmes leur date
- Choisir quels salariés vont sur un chantier
- Noter qu'un salarié, ou soi même, est absent un jour
- Enlever une absence notée par erreur
- Pourquoi un salarié ne peut pas modifier le planning
- Ouvrir le devis, la fiche client ou la facture d'un chantier depuis le planning
- Facturer un chantier fini depuis le planning
- La phrase de l'agenda en haut du planning, et la masquer
- Envoyer le retour d'intervention du jour : ce qui est fait, photos, remarques
- Ouvrir la fiche d'intervention d'un chantier
- Remplir et signer la fiche de sécurité avant les travaux
- Poser un chantier sur un jour
- Laisser une note sur une journée
- Y aller, appeler le client, copier l'adresse
- Voir les sept jours d'avant ou d'après
- Passer de la journée aux sept jours

### « Comment fonctionnent les chantiers ? »

Il présente l'écran Chantiers, geste par geste, puis détaille celui qu'on lui redemande :

- Trouver les chantiers en cours
- Créer un chantier, un devis
- Compléter l'adresse ou les coordonnées d'un chantier depuis la liste
- Savoir où en est un chantier, si le devis est parti
- Le client demande une correction du devis
- Le client a accepté le devis, ou proposé une autre date
- Le devis est retourné ou caduc, sans réponse du client
- Le client a confirmé avoir reçu la facture
- Rappel de facture impayée : dire qu'on a été payé
- Rappels : devis en attente, devis sans réponse, chantier à facturer
- Faire disparaître une carte de réponse ou de rappel
- Voir toutes les réponses de clients et les rappels
- Retirer un chantier de la liste, devis pas encore écrit
- Annuler une suppression qu'on vient de faire
- Reprendre un chantier là où on s'est arrêté

### « Comment fonctionne le devis ? »

Il présente l'écran Devis, geste par geste, puis détaille celui qu'on lui redemande :

- Changer le taux de TVA d'un devis
- Proposer une ou deux dates d'intervention au client
- Envoyer le devis au client
- Modifier un devis déjà envoyé
- Télécharger le PDF d'un devis envoyé
- Ajouter une ligne au devis
- Corriger la description, la quantité ou le prix d'une ligne
- Choisir l'unité d'une ligne : mètre, m², heure, forfait
- Poser le prix d'une ligne marquée à chiffrer
- Reprendre le prix d'un chantier comparable
- Donner un titre au devis
- Mettre deux taux de TVA sur un même devis
- Passer une ligne d'une TVA à l'autre
- Retirer une catégorie de TVA
- Indiquer la part de main d'œuvre
- Demander un acompte sur le devis
- Corriger le nom, l'adresse, l'e-mail ou le téléphone du client sur le devis
- Rattacher un client à un devis qui n'en a pas
- Corriger l'adresse des travaux sur le devis
- Corriger le nom, l'adresse, le SIRET de mon entreprise sur le devis
- Mettre mon IBAN sur le devis
- Ajouter une note ou des conditions sur le devis
- Corriger le devis à la voix
- Répondre aux questions d'Atlas avant le chiffrage
- Le devis ne se modifie plus, que faire
- Proposer deux dates au choix du client
- Laisser ou non le client proposer une autre date
- Changer la durée du chantier avant d'envoyer
- Voir si l'équipe est libre un jour donné
- Enlever ou déplacer un jour proposé
- Envoyer à un client sans téléphone ni e-mail enregistré
- Fermer la feuille d'envoi sans rien envoyer
- Savoir si le client a répondu au devis
- Relancer le client qui n'a pas répondu
- Envoyer par e-mail plutôt que par SMS, ou l'inverse
- Traiter une correction demandée par le client
- Reprendre un devis refusé ou dont le lien a expiré
- Retirer une ligne du devis
- Voir le devis tel que le client le recevra
- Le lien du devis envoyé au client est-il sûr

### « Comment fonctionne la facture ? »

Il présente l'écran Facture, geste par geste, puis détaille celui qu'on lui redemande :

- Facturer un chantier terminé
- Donner un titre à la facture
- Mettre la facture à jour après avoir renvoyé un devis corrigé
- Écrire les lignes d'une facture faite sans devis
- Marquer la facture acquittée, tout est déjà payé
- Télécharger la facture, la garder sur le téléphone
- Envoyer la facture au client
- Renvoyer une facture déjà envoyée, ou l'envoyer par l'autre moyen
- Envoyer la facture à un client sans numéro ou sans e-mail
- Modifier ou corriger une facture
- Faire un avoir, retrouver ses avoirs, annuler une facture envoyée
- Envoyer une mise en demeure
- Changer la date d'échéance d'une facture
- Voir la facture en PDF
- La facture électronique obligatoire, la plateforme agréée
- Faire une facture de situation, facturer en plusieurs fois

### « Comment fonctionne la tva ? »

Il présente l'écran Ma TVA, geste par geste, puis détaille celui qu'on lui redemande :

- Savoir si le client a ouvert ou reçu sa facture
- Voir la TVA d'un autre mois, trimestre ou année
- Passer la déclaration de TVA de mensuelle à trimestrielle
- Copier le montant de TVA à payer
- Comprendre « Crédit de TVA »
- Scanner un ticket de caisse pour la TVA déductible
- Ajouter un achat à la main pour la TVA déductible
- Voir les factures et les achats comptés dans la TVA
- Noter qu'une facture envoyée est payée, voir celles qui ne le sont pas
- Noter un acompte reçu sur une facture déjà envoyée
- Retirer un paiement noté par erreur
- Voir toutes les factures pas encore payées
- Prévenir un client que votre IBAN a changé
- Savoir combien de TVA déclarer

### « Comment fonctionne l'onglet terminés ? »

Il présente l'écran Terminés, geste par geste, puis détaille celui qu'on lui redemande :

- Retrouver les chantiers terminés, mois par mois
- Retrouver ses factures
- Faire une facture sans devis, pour un dépannage
- Savoir quand un chantier arrive dans Terminés
- Voir le montant facturé d'un chantier
- Ranger une facture que le client ne paiera pas
- Retrouver les chantiers finis qui ne sont pas encore facturés

## La sécurité

| Question | Réponse de l'assistant |
|---|---|
| Est-ce que atlas est sécurisé | Les échanges avec Atlas sont toujours chiffrés (https). Chaque entreprise est cloisonnée dans la base elle-même : aucune autre n'y a accès. Votre mot de passe est gardé chiffré, les essais répétés sont freinés, et vous pouvez entrer avec Face ID. Le chiffrement des données sur le disque dépend de l'hébergeur, qui n'est pas encore désigné. |
| Mes données sont-elles chiffrées | Les échanges avec Atlas sont toujours chiffrés (https). Chaque entreprise est cloisonnée dans la base elle-même : aucune autre n'y a accès. Votre mot de passe est gardé chiffré, les essais répétés sont freinés, et vous pouvez entrer avec Face ID. Le chiffrement des données sur le disque dépend de l'hébergeur, qui n'est pas encore désigné. |
| Mon mot de passe est-il protégé | Votre mot de passe fait au moins 12 caractères. Atlas ne le garde jamais en clair : seule une empreinte chiffrée est enregistrée, personne ne peut le relire. Après 5 essais ratés, chaque nouvel essai doit attendre, jusqu'à 15 minutes. |
| Atlas connaît mon mot de passe ? | Votre mot de passe fait au moins 12 caractères. Atlas ne le garde jamais en clair : seule une empreinte chiffrée est enregistrée, personne ne peut le relire. Après 5 essais ratés, chaque nouvel essai doit attendre, jusqu'à 15 minutes. |
| Combien de caractères pour le mot de passe | Votre mot de passe fait au moins 12 caractères. Atlas ne le garde jamais en clair : seule une empreinte chiffrée est enregistrée, personne ne peut le relire. Après 5 essais ratés, chaque nouvel essai doit attendre, jusqu'à 15 minutes. |
| Que se passe-t-il si quelqu'un essaie de deviner mon mot de passe | Votre mot de passe fait au moins 12 caractères. Atlas ne le garde jamais en clair : seule une empreinte chiffrée est enregistrée, personne ne peut le relire. Après 5 essais ratés, chaque nouvel essai doit attendre, jusqu'à 15 minutes. |
| J'ai oublié mon mot de passe | Sur l'écran de connexion, touchez « Mot de passe oublié ? », écrivez votre adresse, puis « Recevoir un code ». Entrez le code reçu, choisissez le nouveau mot de passe, puis « Enregistrer ». |
| Est-ce qu'il y a une double authentification | Atlas n'a pas encore de code en deux étapes. Ce qui protège en plus du mot de passe : Face ID sur vos appareils, et « Me déconnecter partout » si un téléphone est perdu. |
| Mes concurrents peuvent-ils voir mes clients | Seuls les comptes de votre entreprise voient vos chantiers : une autre entreprise n'y a jamais accès, le cloisonnement est fait dans la base elle-même. Dans votre équipe, chacun voit ce que son rôle permet. Vos clients ne voient que ce que vous leur envoyez. Le rôle de chacun se règle dans Équipe, Accès. |
| Est-ce que atlas revend mes données | Atlas ne se sert de vos données que pour faire tourner le service : les afficher, les sauvegarder, les transmettre à ses sous-traitants, fabriquer vos documents. Les conditions d'utilisation limitent cet usage à ce qui est strictement nécessaire. |
| Est-ce que atlas est conforme rgpd | Vos données sont cloisonnées et se téléchargent dans Mes données. Un client s'efface de sa fiche, ses factures restant gardées dix ans comme la loi l'impose. Ce qui part à l'IA est dit dans les conditions. Le contrat de sous-traitance prévu par le RGPD pour les données de vos clients n'est pas encore rédigé. |
| Mon client peut demander à effacer ses données ? | Tout en bas de sa fiche, touchez « Supprimer ce client ». S'il a des documents, cochez « J’ai sauvegardé ces documents ailleurs », puis « Supprimer ». C'est définitif : ses devis, photos et notes sont détruits. Les factures que la loi oblige à garder restent, sous « Conservé par la loi ». |
| Atlas garde ma carte bancaire ? | Non. Votre carte se saisit sur les pages sécurisées du prestataire de paiement, qui seul la garde : Atlas ne la voit jamais. |
| Le lien envoyé au client est-il sécurisé | Chaque devis part avec son propre lien, fait de 43 caractères tirés au hasard : impossible à deviner. Seul celui qui l'a reçu peut l'ouvrir, sauf s'il le transfère. |
| Quelqu'un d'autre peut ouvrir le lien du devis ? | Chaque devis part avec son propre lien, fait de 43 caractères tirés au hasard : impossible à deviner. Seul celui qui l'a reçu peut l'ouvrir, sauf s'il le transfère. |
| Mes dictées sont-elles écoutées par quelqu'un | Pour transcrire une dictée, rédiger un devis ou regarder une photo, Atlas envoie ce contenu à ses fournisseurs d'intelligence artificielle. Ne dictez pas ce que vous ne voulez pas voir transmis, comme une information de santé. L'enregistrement reste sur la fiche du chantier : vous pouvez le réécouter ou le remplacer. |
| Que devient l'enregistrement audio de ma dictée | Pour transcrire une dictée, rédiger un devis ou regarder une photo, Atlas envoie ce contenu à ses fournisseurs d'intelligence artificielle. Ne dictez pas ce que vous ne voulez pas voir transmis, comme une information de santé. L'enregistrement reste sur la fiche du chantier : vous pouvez le réécouter ou le remplacer. |

## Vos données

| Question | Réponse de l'assistant |
|---|---|
| Combien de temps mes données sont gardées | Tout ce que vous mettez dans Atlas (chantiers, clients, devis, factures, photos, notes) reste enregistré tant que votre compte existe, sur le serveur d'Atlas et pas dans votre téléphone. Rien ne s'efface tout seul : seule une suppression faite par vous retire une donnée. Les factures se gardent dix ans, comme la loi l'impose, même si vous supprimez le client. Pour garder votre propre copie : Mes données, « Télécharger mes données ». |
| Est-ce que mes photos sont effacées au bout d'un moment | Tout ce que vous mettez dans Atlas (chantiers, clients, devis, factures, photos, notes) reste enregistré tant que votre compte existe, sur le serveur d'Atlas et pas dans votre téléphone. Rien ne s'efface tout seul : seule une suppression faite par vous retire une donnée. Les factures se gardent dix ans, comme la loi l'impose, même si vous supprimez le client. Pour garder votre propre copie : Mes données, « Télécharger mes données ». |
| Que deviennent mes données si j'arrête atlas | Avant d'arrêter, téléchargez tout : Mes données, « Télécharger mes données ». Le fichier se lit sans Atlas. Les pièces comptables restent gardées dix ans, comme la loi l'impose. Le délai pendant lequel vos données restent récupérables après la fin de l'abonnement n'est pas encore fixé. |
| Qui peut voir mes données | Seuls les comptes de votre entreprise voient vos chantiers : une autre entreprise n'y a jamais accès, le cloisonnement est fait dans la base elle-même. Dans votre équipe, chacun voit ce que son rôle permet. Vos clients ne voient que ce que vous leur envoyez. Le rôle de chacun se règle dans Équipe, Accès. |
| Est-ce que mes données sont protégées | Seuls les comptes de votre entreprise voient vos chantiers : une autre entreprise n'y a jamais accès, le cloisonnement est fait dans la base elle-même. Dans votre équipe, chacun voit ce que son rôle permet. Vos clients ne voient que ce que vous leur envoyez. Le rôle de chacun se règle dans Équipe, Accès. |
| Est-ce que mes dictées partent chez une intelligence artificielle | Pour transcrire une dictée, rédiger un devis ou regarder une photo, Atlas envoie ce contenu à ses fournisseurs d'intelligence artificielle. Ne dictez pas ce que vous ne voulez pas voir transmis, comme une information de santé. L'enregistrement reste sur la fiche du chantier : vous pouvez le réécouter ou le remplacer. |

## Tirer le maximum d'Atlas

| Question | Réponse de l'assistant |
|---|---|
| Comment l'appli transforme ma dictée en devis | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez le micro au centre, décrivez le chantier, puis touchez l'avion à droite : Atlas prépare le devis et l'ouvre. |
| Comment faire un devis en dictant seulement | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez le micro au centre, décrivez le chantier, puis touchez l'avion à droite : Atlas prépare le devis et l'ouvre. |
| Comment passer du devis à la facture | *« Terminés » dans la barre du bas, puis « À facturer » sur la ligne du chantier.* Touchez la ligne du chantier, puis « Créer la facture » : Atlas la prépare à partir du devis. Rien ne part encore. |
| Comment fonctionne le planning | Touchez « Planning » dans la barre du bas. |
| Comment gagner du temps sur mes devis | Dictez le chantier au lieu de le taper : Atlas écrit le devis. Pour un client déjà venu, « Dernier devis » sur sa fiche reprend le précédent. Posez vos prix une fois dans vos tarifs, ils reviennent dans chaque devis. Et demandez à l'assistant : « qui me doit de l'argent », « crée un chantier pour Martin ». |
| Quelles sont les astuces pour aller plus vite | Dictez le chantier au lieu de le taper : Atlas écrit le devis. Pour un client déjà venu, « Dernier devis » sur sa fiche reprend le précédent. Posez vos prix une fois dans vos tarifs, ils reviennent dans chaque devis. Et demandez à l'assistant : « qui me doit de l'argent », « crée un chantier pour Martin ». |
| Comment ne jamais oublier de relancer un client | *« Chantiers », la carte en haut de la liste.* Touchez le lien de la carte : « Faire le devis » sur « Devis en attente », « Ouvrir le chantier » sur « Devis sans réponse », « Créer la facture » sur « À facturer ». Ces rappels se règlent dans Réglages, Notifications. |
| Comment suivre ce que mes clients me doivent | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Sous les trois premières factures en attente, appuyez sur « Voir toutes les factures en attente ». La liste n'existe que si votre TVA est déclarée aux encaissements. |
| Comment organiser la semaine de mes équipes | Touchez « Planning » dans la barre du bas. |
| Comment gérer les absences de mes gars | *« Réglages » dans la barre du bas, puis Équipe, bloc Absences.* Touchez « + Noter une absence », choisissez qui, le premier et le dernier jour, puis « Noter l’absence ». Pour l'effacer, touchez la croix sur sa ligne. Il faut au moins un salarié : seul, posez vos congés dans votre agenda relié. Les absences demandent la formule Entreprise. |
| Comment ranger mes photos de chantier | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Sous « Photos », touchez le carré « + » puis prenez ou choisissez les photos. Au plus 15 photos à la fois, et 30 par chantier. |
| Qu'est-ce que je peux demander à l'assistant | L'assistant lit vos chantiers, devis, factures, planning et tarifs. Demandez-lui par exemple « qui me doit de l'argent », « combien j'ai encaissé en septembre », « qu'est-ce que j'ai demain » ou « crée un chantier pour Martin » : il prépare, vous cochez puis validez. Il n'envoie jamais un devis, ne facture jamais, et n'écrit rien sans votre validation. |
| L'assistant peut-il me dire qui me doit de l'argent | L'assistant lit vos chantiers, devis, factures, planning et tarifs. Demandez-lui par exemple « qui me doit de l'argent », « combien j'ai encaissé en septembre », « qu'est-ce que j'ai demain » ou « crée un chantier pour Martin » : il prépare, vous cochez puis validez. Il n'envoie jamais un devis, ne facture jamais, et n'écrit rien sans votre validation. |
| Qui peut lire mes devis | Seuls les comptes de votre entreprise voient vos chantiers : une autre entreprise n'y a jamais accès, le cloisonnement est fait dans la base elle-même. Dans votre équipe, chacun voit ce que son rôle permet. Vos clients ne voient que ce que vous leur envoyez. Le rôle de chacun se règle dans Équipe, Accès. |
| Comment atlas écrit mon devis | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez le micro au centre, décrivez le chantier, puis touchez l'avion à droite : Atlas prépare le devis et l'ouvre. |
| Quels conseils pour bien utiliser atlas | Dictez le chantier au lieu de le taper : Atlas écrit le devis. Pour un client déjà venu, « Dernier devis » sur sa fiche reprend le précédent. Posez vos prix une fois dans vos tarifs, ils reviennent dans chaque devis. Et demandez à l'assistant : « qui me doit de l'argent », « crée un chantier pour Martin ». |
| Comment savoir où sont mes équipes aujourd'hui | Touchez « Planning » dans la barre du bas. |
| Comment faire payer un acompte avant de commencer | Appuyez sur « + Ajouter un acompte », puis touchez le pourcentage pour le changer. Le « − » devant l'acompte le retire. Le reste à régler se calcule sous les acomptes. Le bouton disparaît quand il n'y a plus d'acompte à poser. |
| Est-ce que je peux travailler depuis mon ordinateur au bureau | Atlas s'ouvre dans le navigateur, sur téléphone comme sur ordinateur, avec le même compte. Pour l'avoir sur l'écran du téléphone : sur iPhone, dans Safari, touchez Partager puis « Sur l'écran d'accueil » ; sur Android, dans Chrome, menu puis « Ajouter à l'écran d'accueil ». |
| Comment utiliser atlas sur ipad | Atlas s'ouvre dans le navigateur, sur téléphone comme sur ordinateur, avec le même compte. Pour l'avoir sur l'écran du téléphone : sur iPhone, dans Safari, touchez Partager puis « Sur l'écran d'accueil » ; sur Android, dans Chrome, menu puis « Ajouter à l'écran d'accueil ». |

## Le planning expliqué

| Question | Réponse de l'assistant |
|---|---|
| Comment on ajoute un client au planning | *« Planning » dans la barre du bas, puis le jour.* Ouvrez le jour, appuyez sur « Ajouter » puis « Un client ». Tapez son nom et touchez-le s'il est proposé, choisissez « Matin », « Après-midi » ou « Journée », puis « Poser ». Un nom inconnu crée sa fiche : Atlas demande alors téléphone, e-mail et adresse du chantier. « Annuler » ramène aux trois choix. |
| Comment ajouter un client en attente | Touchez d'abord le jour dans le calendrier, ouvrez la barre du bas (« À poser sur… »), puis touchez le nom du client. Sans jour touché, la liste montre les clients « en attente d'un jour » sans pouvoir les poser. |
| Comment ajouter autre chose au planning | *« Planning » dans la barre du bas, puis le jour.* Ouvrez le jour, appuyez sur « Ajouter » puis « Autre chose ». Écrivez ce que c'est, choisissez le moment, puis « Poser ». |
| Comment mettre un salarié absent | *« Planning » dans la barre du bas, puis le jour.* Ouvrez le jour, appuyez sur « Salarié absent ? » puis sur son nom. Il est absent toute la journée : touchez « Matin » ou « Après-midi » pour réduire. Seul, sans salarié, le bouton s'appelle « Absent ? ». Pour plusieurs jours d'affilée : Réglages, Équipe. |
| Comment enlever un salarié des absences | *« Planning » dans la barre du bas, puis le jour.* Ouvrez le jour : sur la ligne « Absent », appuyez sur la croix à droite. Ou « Salarié absent ? » puis « son nom, annuler ». |
| Comment affilier un salarié à un chantier | *« Planning » dans la barre du bas, puis le jour du chantier.* Ouvrez le jour, touchez « + Salarié » ou les noms en face du matin ou de l'après-midi, touchez les noms à cocher ou décocher, puis « Fermer ». Il faut des salariés déclarés dans Réglages, Équipe. Un salarié absent ce jour-là est grisé. |
| Que veulent dire les couleurs du planning | Chaque jour porte deux barres, le matin en haut et l'après-midi en bas. « Rien » : aucun chantier. « Incomplet » : il reste de la place. « Complet » : toutes vos équipes sont prises. « Au-delà » : plus de chantiers que d'équipes. Un salarié absent compte comme un chantier. Le nombre d'équipes se règle dans Réglages, Équipe, « Combien de chantiers par jour ? » : avec 2, « au-delà » commence au troisième chantier. |
| Que signifie au-delà | Chaque jour porte deux barres, le matin en haut et l'après-midi en bas. « Rien » : aucun chantier. « Incomplet » : il reste de la place. « Complet » : toutes vos équipes sont prises. « Au-delà » : plus de chantiers que d'équipes. Un salarié absent compte comme un chantier. Le nombre d'équipes se règle dans Réglages, Équipe, « Combien de chantiers par jour ? » : avec 2, « au-delà » commence au troisième chantier. |
| Que veut dire au-delà sur le planning | Chaque jour porte deux barres, le matin en haut et l'après-midi en bas. « Rien » : aucun chantier. « Incomplet » : il reste de la place. « Complet » : toutes vos équipes sont prises. « Au-delà » : plus de chantiers que d'équipes. Un salarié absent compte comme un chantier. Le nombre d'équipes se règle dans Réglages, Équipe, « Combien de chantiers par jour ? » : avec 2, « au-delà » commence au troisième chantier. |
| Pourquoi le jour est en au-delà | Chaque jour porte deux barres, le matin en haut et l'après-midi en bas. « Rien » : aucun chantier. « Incomplet » : il reste de la place. « Complet » : toutes vos équipes sont prises. « Au-delà » : plus de chantiers que d'équipes. Un salarié absent compte comme un chantier. Le nombre d'équipes se règle dans Réglages, Équipe, « Combien de chantiers par jour ? » : avec 2, « au-delà » commence au troisième chantier. |
| Comment faire pour que au-delà soit à partir de deux chantiers | *« Réglages » dans la barre du bas, puis Équipe.* Sous « Combien de chantiers par jour », touchez « + » ou « − ». C'est votre nombre d'équipes : au planning, un jour qui en demande plus passe en « au-delà ». |
| Comment faire pour que au-delà soit à partir de trois chantiers | *« Réglages » dans la barre du bas, puis Équipe.* Sous « Combien de chantiers par jour », touchez « + » ou « − ». C'est votre nombre d'équipes : au planning, un jour qui en demande plus passe en « au-delà ». |

## Questions d'artisan

| Question | Réponse de l'assistant |
|---|---|
| Est-ce que je peux utiliser atlas sans internet ? | Atlas a besoin d'internet pour s'ouvrir et pour enregistrer : il n'a pas encore de mode hors ligne. Sans réseau, attendez d'en retrouver avant de valider. |
| Ça marche hors ligne ? | Atlas a besoin d'internet pour s'ouvrir et pour enregistrer : il n'a pas encore de mode hors ligne. Sans réseau, attendez d'en retrouver avant de valider. |
| Combien coûte l'abonnement | *« Réglages » dans la barre du bas, puis Abonnement.* Ouvrez « Abonnement », choisissez « Au mois » ou « À l’année, 2 mois offerts », puis « S’abonner » ou « Passer à cette formule » sous la formule voulue. Réservé au patron. Artisan : 39 € HT par mois, ou 390 € HT par an. Entreprise : 59 € HT par mois, ou 590 € HT par an. Illimité : 159 € HT par mois, ou 1590 € HT par an. |
| Est-ce qu'il y a un essai gratuit | Un compte neuf a 15 jours d'essai gratuit, sans carte bancaire, avec toutes les fonctions ouvertes. À la fin, vous voyez toujours tout, mais il faut choisir une formule pour créer de nouveau. |
| Comment contacter atlas | Écrivez à edennature.contact@gmail.com. |
| Est-ce que atlas marche sur ordinateur | Atlas s'ouvre dans le navigateur, sur téléphone comme sur ordinateur, avec le même compte. Pour l'avoir sur l'écran du téléphone : sur iPhone, dans Safari, touchez Partager puis « Sur l'écran d'accueil » ; sur Android, dans Chrome, menu puis « Ajouter à l'écran d'accueil ». |
| Comment installer l'appli sur mon téléphone | Atlas s'ouvre dans le navigateur, sur téléphone comme sur ordinateur, avec le même compte. Pour l'avoir sur l'écran du téléphone : sur iPhone, dans Safari, touchez Partager puis « Sur l'écran d'accueil » ; sur Android, dans Chrome, menu puis « Ajouter à l'écran d'accueil ». |
| La facture électronique obligatoire atlas le fait ? | Atlas ne transmet pas encore vos factures à une plateforme de facturation électronique. Il fabrique la facture et l'envoie à votre client, par SMS ou par e-mail. |
| Comment exporter mes factures pour mon comptable | Ouvrez Mes données, puis « Télécharger mes données » : le fichier range vos factures en PDF, dossier par client et par chantier, avec vos devis. La TVA à déclarer est dans « Terminés », « Ma TVA à déclarer ». |
| Je suis auto-entrepreneur sans tva comment je fais | *« Réglages » dans la barre du bas, puis Mon entreprise, bloc Votre régime de TVA.* Dans « Votre régime de TVA », touchez « Franchise en base » ou « Assujettie ». Assujettie : écrivez votre numéro de TVA intracommunautaire dessous. |
| Le client peut signer le devis en ligne ? | Le client coche la date qui lui va, puis appuie sur « J'accepte ce devis ». Son accord est horodaté et gardé avec le devis. La date est alors retenue dans votre planning. |
| Comment supprimer une facture | Touchez « Terminés », la ligne du chantier facturé, puis « Je fais un avoir ». Choisissez la ligne, écrivez le montant et le motif, et validez. Sur l'écran suivant, « Envoyer par SMS » ou par e-mail le transmet au client. Une facture envoyée ne se supprime pas : c'est l'avoir qui la corrige ou l'annule. Vos avoirs se retrouvent sous la facture, et dans l'onglet « Avoirs » de la fiche du client. |
| Comment annuler une facture | Touchez « Terminés », la ligne du chantier facturé, puis « Je fais un avoir ». Choisissez la ligne, écrivez le montant et le motif, et validez. Sur l'écran suivant, « Envoyer par SMS » ou par e-mail le transmet au client. Une facture envoyée ne se supprime pas : c'est l'avoir qui la corrige ou l'annule. Vos avoirs se retrouvent sous la facture, et dans l'onglet « Avoirs » de la fiche du client. |
| Comment faire un contrat d'entretien | *« Chantiers » dans la barre du bas, puis « Vos clients », puis son nom.* Ouvrez la fiche du client, puis « Contrat d’entretien ». Choisissez les prestations, les passages par mois, le prix du passage, la durée et la facturation, puis envoyez-le au client. Une fois accepté, chaque passage arrive au planning, à poser. |
| Comment voir mon chiffre d'affaires | Atlas n'a pas d'écran de chiffre d'affaires : demandez-le à l'assistant, par exemple « combien j'ai facturé en septembre » ou « combien j'ai encaissé cette année ». |
| Comment importer mes clients depuis excel | Atlas ne sait pas encore importer une liste de clients : un client naît avec son chantier. Seuls les tarifs s'importent, dans Réglages. |
| Est-ce que l'ia peut se tromper | Oui. Ce que l'IA écrit est une proposition : relisez-la avant d'envoyer. Rien ne part chez un client, et rien n'est facturé, sans votre geste. |
| L'assistant peut-il envoyer le devis à ma place ? | L'assistant lit vos chantiers, devis, factures, planning et tarifs. Demandez-lui par exemple « qui me doit de l'argent », « combien j'ai encaissé en septembre », « qu'est-ce que j'ai demain » ou « crée un chantier pour Martin » : il prépare, vous cochez puis validez. Il n'envoie jamais un devis, ne facture jamais, et n'écrit rien sans votre validation. |
| Combien de salariés je peux ajouter | Vos salariés ont accès au planning quelle que soit la formule. Ce qui est compté, ce sont les personnes qui font les devis et les factures : Artisan, 1 ; Entreprise, 5 ; Illimité, autant que vous voulez. |
| Comment ajouter des frais de déplacement | Appuyez sur « + Ajouter une ligne » sous les lignes, puis écrivez la description, la quantité et le prix. Avec plusieurs TVA, chaque catégorie a son bouton : la ligne arrive dans celle où vous appuyez. |
| Comment changer la langue | Atlas n'existe qu'en français pour l'instant. |
| À quoi sert l'onglet paysage | Touchez « Paysage » dans la barre du bas : Plan d'arrosage automatique, Fiche de chantier, Diagnostic végétal et Fiches de sécurité. |
| Comment faire une facture de situation | Atlas ne fait pas encore de facture de situation. Pour être payé en plusieurs fois, demandez un acompte sur le devis : la facture le reprend dans ses règlements reçus. |
| Comment changer mon adresse email de connexion | *« Réglages » dans la barre du bas, puis Mon compte.* Ouvrez « Mon compte », corrigez la civilité, le prénom ou le nom, puis « Enregistrer ». L'e-mail sert à vous connecter et ne se modifie pas encore. |
| C'est quoi le prix d'atlas | *« Réglages » dans la barre du bas, puis Abonnement.* Ouvrez « Abonnement », choisissez « Au mois » ou « À l’année, 2 mois offerts », puis « S’abonner » ou « Passer à cette formule » sous la formule voulue. Réservé au patron. Artisan : 39 € HT par mois, ou 390 € HT par an. Entreprise : 59 € HT par mois, ou 590 € HT par an. Illimité : 159 € HT par mois, ou 1590 € HT par an. |
| J'ai un souci avec l'appli à qui je m'adresse | Écrivez à edennature.contact@gmail.com. |
| Comment je mets atlas sur mon écran d'accueil | Atlas s'ouvre dans le navigateur, sur téléphone comme sur ordinateur, avec le même compte. Pour l'avoir sur l'écran du téléphone : sur iPhone, dans Safari, touchez Partager puis « Sur l'écran d'accueil » ; sur Android, dans Chrome, menu puis « Ajouter à l'écran d'accueil ». |
| Je me suis trompé sur une facture envoyée | Touchez « Terminés », la ligne du chantier facturé, puis « Je fais un avoir ». Choisissez la ligne, écrivez le montant et le motif, et validez. Sur l'écran suivant, « Envoyer par SMS » ou par e-mail le transmet au client. Une facture envoyée ne se supprime pas : c'est l'avoir qui la corrige ou l'annule. Vos avoirs se retrouvent sous la facture, et dans l'onglet « Avoirs » de la fiche du client. |
| J'ai pas de tva comment je le dis | *« Réglages » dans la barre du bas, puis Mon entreprise, bloc Votre régime de TVA.* Dans « Votre régime de TVA », touchez « Franchise en base » ou « Assujettie ». Assujettie : écrivez votre numéro de TVA intracommunautaire dessous. |
| L'intelligence artificielle est fiable ? | Oui. Ce que l'IA écrit est une proposition : relisez-la avant d'envoyer. Rien ne part chez un client, et rien n'est facturé, sans votre geste. |
| Qui a accès à mes devis | *« Réglages » dans la barre du bas, puis Équipe.* Ouvrez « Équipe », puis « Donner un accès ». Remplissez nom, adresse e-mail, mot de passe et sa confirmation, choisissez le rôle, puis « Créer le compte ». |
| Comment ajouter mon numéro de siret | Ouvrez « Mon entreprise », corrigez le champ, puis « Enregistrer ». Ces informations figurent en tête de chaque devis et de chaque facture. |
| Comment envoyer la feuille de route à mes gars | *« Planning » dans la barre du bas, puis le nom du chantier.* Touchez le nom du chantier dans sa journée : « Ouvrir le devis sans les prix » est au bas de sa fiche d'intervention. Le bouton n'apparaît que si le chantier a un devis. |

## Les chantiers et la dictée

| Question | Réponse de l'assistant |
|---|---|
| Comment je crée un nouveau devis | *« Chantiers », dans la barre du bas.* Appuyez sur « Créer un devis », sous le titre « Vos chantiers » : la fiche client monte. Quand l'essai est terminé, le bouton est grisé et l'écran dit de choisir une formule. |
| Je veux fermer la fiche client sans perdre ce que j'ai tapé | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez la flèche en haut à gauche, ou le haut de l'écran derrière la fiche. Ce qui est déjà tapé est enregistré en sortant. |
| Comment compléter l'adresse manquante d'un chantier | *« Chantiers », dans la barre du bas.* Touchez « Adresse non renseignée », en rouge sous le nom : la fiche client du chantier s'ouvre. Cette mention n'apparaît que sur un chantier sans adresse. |
| Comment savoir si le devis est envoyé ou à relancer | Lisez la ligne en capitales sous l'adresse : « Brouillon », « Devis prêt à envoyer », « Devis envoyé, sans réponse », « Devis envoyé, à relancer ». Le jour de l'envoi est écrit dessous. Une ligne en or attend un geste de votre part. |
| Le client demande une correction du devis, je fais quoi | *« Chantiers », la carte teintée en haut de la liste.* Sur la carte « Correction demandée », lisez le message du client puis touchez « Corriger le devis ». |
| Le client a accepté le devis, je fais quoi | *« Chantiers », la carte en haut de la liste.* Sur la carte « Devis accepté » ou « Autre date proposée », touchez « Ouvrir le devis validé ». |
| Mon devis est caduc, comment le renvoyer | *« Chantiers », la carte teintée en haut de la liste.* Sur la carte « Devis retourné » ou « Devis caduc », touchez « Reprendre le devis » pour le renvoyer. |
| Le client a confirmé avoir reçu la facture | *« Chantiers », la carte en haut de la liste.* Sur la carte « Facture reçue », touchez « Voir les factures qui attendent ». |
| Facture impayée, j'ai reçu le paiement | *« Chantiers », la carte en haut de la liste.* Sur la carte « Facture impayée », touchez « J'ai reçu le paiement » ou « J'ai reçu une partie ». « J'ai vu » repousse seulement le rappel. Ce rappel n'apparaît que s'il est allumé dans Réglages, Notifications. |
| J'ai un rappel à facturer, comment je fais | *« Chantiers », la carte en haut de la liste.* Touchez le lien de la carte : « Faire le devis » sur « Devis en attente », « Ouvrir le chantier » sur « Devis sans réponse », « Créer la facture » sur « À facturer ». Ces rappels se règlent dans Réglages, Notifications. |
| Comment faire disparaître une carte notification | *« Chantiers », les cartes en haut de la liste.* Touchez « J'ai vu » sous la carte. Un rappel revient après son délai si rien n'a bougé. |
| Voir les autres cartes de notifications | *« Chantiers », sous la première carte.* Touchez « autres devis à regarder » sous la carte. « Replier » les range. Une seule carte s'affiche d'abord. |
| Comment remplir le client d'un nouveau chantier | Tapez le nom du client, son téléphone, son e-mail et l'adresse du chantier, puis dictez à la note vocale ou touchez « Je rédige à la main ». Le nom crée la fiche du client. Sans téléphone ni e-mail, le devis ne pourra pas partir. |
| Je veux écrire mon devis à la main sans dicter | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez « Je rédige à la main », en bas de la fiche client : le devis s'ouvre, vide. Le bouton disparaît pendant qu'on dicte. |
| Comment mettre madame au lieu de monsieur | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez « Mr » ou « Mme », au-dessus du nom du client. |
| Mettre une adresse client différente du chantier | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez « + Client », à droite de « Chantier » : une seconde case d'adresse s'ouvre. |
| Envoyer le devis par sms ou par mail | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Sur la ligne « Envoi », touchez « SMS » ou « E-mail ». « SMS » ne s'active qu'avec un téléphone tapé, « E-mail » qu'avec une adresse e-mail. |
| Reprendre un client déjà connu | Tapez son nom : touchez-le dans la liste qui s'ouvre. Atlas remplit ce qu'il sait. Si ce n'est pas le bon, touchez « Ce n'est pas lui ». |
| Dicter le téléphone et l'adresse du client au micro | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez le petit micro en haut à droite, dites les coordonnées, puis touchez-le à nouveau. Seules les cases vides sont remplies. |
| Comment dicter une note vocale pour le devis | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez le micro au centre, décrivez le chantier, puis touchez l'avion à droite : Atlas prépare le devis et l'ouvre. |
| Jeter la dictée à la poubelle pour recommencer | Pendant la dictée, touchez la poubelle à gauche du chrono. |
| Supprimer la dictée pour redicter | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Glissez la ligne « Votre dictée » de droite à gauche, puis « Retirer ». Vous pouvez redicter. « Annuler » reste quelques secondes pour revenir en arrière. |
| Comment ajouter des photos au chantier | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Sous « Photos », touchez le carré « + » puis prenez ou choisissez les photos. Au plus 15 photos à la fois, et 30 par chantier. |
| Supprimer une photo du chantier | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez la photo pour l'ouvrir, puis « Retirer ». « Annuler » reste quelques secondes en dessous. |
| Voir les photos en grand | *« Chantiers » dans la barre du bas, « Créer un devis » : écran Fiche client.* Touchez une photo. Glissez du doigt pour passer à la suivante, touchez la croix pour fermer. |
| Reprendre les anciennes photos de la dernière fois | *« Chantiers », « Vos clients », le nom du client, puis « Nouveau devis ».* Sous « La dernière fois », touchez les photos à reprendre : elles s'allument. Une photo non touchée ne rejoint pas le nouveau chantier. |
| Faire une facture directe sans devis pour un client | *« Terminés », dans la barre du bas.* Touchez « Créer une facture » en or, à droite. Remplissez le client, appuyez sur « Faire la facture », puis « Remplir la facture » pour écrire les lignes. |
| Répondre aux questions avant de chiffrer | *l'encadré « Avant de chiffrer », pendant qu'Atlas prépare le devis.* Touchez une réponse sous chaque question, puis « Continuer vers le devis ». Pour passer outre : « Continuer sans répondre à tout ». Ces questions n'apparaissent que quand la dictée ne suffit pas pour chiffrer. |
| Atlas n'a pas trouvé de prix, comment poser les prix | Touchez « Ouvrir le devis et poser les prix », ou « Compléter la durée et l'équipe ». |
| Repartir de la dictée ou conserver mes corrections | Touchez « Conserver mes corrections » pour garder le devis, ou « Repartir de la dictée » pour le refaire. Repartir de la dictée efface vos corrections. |
| Où est l'écran de la note vocale | *« Chantiers » dans la barre du bas, puis le chantier : écran Transcription ou Informations.* Sur l'écran Transcription ou Informations du chantier, touchez « Aller à la note vocale ». Ce lien n'apparaît que tant que la dictée n'est pas transcrite. |
| Enregistrer une note vocale et l'arrêter | Touchez « Enregistrer une note vocale », parlez, puis « Arrêter l'enregistrement ». |
| Comment réécouter ma note vocale | Touchez le rond de lecture à gauche de la note. Touchez-le à nouveau pour la pause. Une fois transcrit, l'audio est effacé : l'écran dit « Enregistrement effacé » et le texte reste. |
| Supprimer la note vocale | Glissez la note de droite à gauche, puis « Retirer ». « Annuler » reste quelques secondes en bas de l'écran. |
| Relancer la transcription de la note | Touchez « Lancer la transcription ». Si elle échoue, touchez « Réessayer ». |
| Créer le devis à partir de la note vocale | Touchez « Créer le devis à partir de ma dictée ». « voir le texte » ouvre la transcription, « Ou rédiger le devis à la main » ouvre le devis vide. Le bouton du devis n'apparaît qu'une fois la transcription faite. |
| Où je relis le texte de ma dictée | *« Chantiers » dans la barre du bas, puis le chantier : écran Informations.* Sur l'écran Informations du chantier, touchez « Voir la transcription ». Ce lien n'apparaît qu'une fois la dictée transcrite. |
| Passer de la transcription aux informations | Touchez « Créer le devis à partir de ma dictée », ou « Ou vérifier les informations une par une ». |
| La transcription a échoué, que faire | Touchez « Relancer depuis la note vocale », ou « Écrire ce que j'ai dit » et tapez-le, puis « Enregistrer le texte ». L'enregistrement reste intact. |
| Générer le brouillon depuis la dictée | Touchez « Générer le brouillon » : Atlas range la dictée en prestations, durée, équipe, matériel. Il faut une dictée transcrite. |
| Confirmer le brouillon entendu | Corrigez les cases, retirez une ligne avec sa croix, puis touchez « Confirmer et ajouter au chantier ». « Régénérer depuis la dictée » refait l'analyse. Tant que ce n'est pas confirmé, les cases du chantier restent cachées. |
| Remplacer mes corrections par la nouvelle analyse | Touchez « Conserver mes corrections », ou « Remplacer par la nouvelle analyse ». Remplacer efface vos corrections. |
| Écrire les lignes à la main dans informations | Touchez « Écrire les lignes à la main » : les cases du chantier s'ouvrent. Ce lien n'apparaît que tant qu'un brouillon attend d'être confirmé. |
| Ajouter une prestation ou du matériel | Touchez une ligne pour la corriger, « + Ajouter une prestation » ou « + Ajouter un matériel » pour en ajouter. Pour en retirer une : glissez de droite à gauche, puis « Retirer ». |
| Changer la durée et l'équipe | Sous « Ce chantier prend », choisissez la durée dans la liste. Sous « Équipe », tapez le nombre. |
| Où noter les contraintes d'accès et les déchets | Tapez dans « Déchets / branchages », « Contraintes d'accès » ou « Remarques ». Ces cases n'apparaissent qu'après un brouillon tiré de la dictée. |
| Aller directement au devis depuis informations | Touchez « Écrire le devis », tout en bas. |
| Modifier le montant d'une ligne de prix | Touchez le texte ou le montant d'une ligne pour le changer, « + Ajouter une ligne » pour en créer une. Pour la retirer : glissez de droite à gauche, puis « Retirer ». |
| Ajouter la proposition de prix au détail | *l'écran Prix, encart « Proposition ».* Touchez « Ajouter au détail ». « Voir le détail » montre le calcul, « Relancer le calcul » le refait. Quand plusieurs tarifs conviennent, cochez le bon d'abord. |
| Le bouton préparer le devis est grisé, une ligne attend son prix | Touchez « Poser les montants » : Atlas vous amène à la ligne sans prix. Sans aucune ligne, « Ouvrir mes tarifs ». |

## Les devis

| Question | Réponse de l'assistant |
|---|---|
| Comment je change la tva du devis | Touchez le chiffre entre parenthèses sur la ligne « TVA » sous le total, puis tapez le taux. Avec plusieurs TVA sur le devis, le taux se change dans le titre de chaque catégorie, au-dessus de ses lignes. |
| Je veux mettre 10 % de tva | Touchez le chiffre entre parenthèses sur la ligne « TVA » sous le total, puis tapez le taux. Avec plusieurs TVA sur le devis, le taux se change dans le titre de chaque catégorie, au-dessus de ses lignes. |
| Comment je propose une date au client | *un chantier, écran Devis, bouton « Choisir la date » en bas.* Appuyez sur « Choisir la date », puis touchez le jour voulu dans le calendrier. Atlas pose déjà le premier jour libre : touchez un autre jour pour le remplacer. Le client ne verra que la date, jamais la demi-journée. |
| Comment j'envoie le devis au client | *un chantier, écran Devis, bouton « Choisir la date » en bas.* Appuyez sur « Choisir la date », touchez la date, puis « Envoyer le devis ». Votre messagerie s'ouvre avec le message tout prêt : c'est vous qui l'envoyez. Tant qu'une ligne est à chiffrer, « Choisir la date » est remplacé par « Poser le prix ». Si la messagerie ne s'ouvre pas, rouvrez le chantier et appuyez sur « Relancer par SMS » ou « Relancer par e-mail ». |
| Je veux transmettre mon devis par sms | *un chantier, écran Devis, bouton « Choisir la date » en bas.* Appuyez sur « Choisir la date », touchez la date, puis « Envoyer le devis ». Votre messagerie s'ouvre avec le message tout prêt : c'est vous qui l'envoyez. Tant qu'une ligne est à chiffrer, « Choisir la date » est remplacé par « Poser le prix ». Si la messagerie ne s'ouvre pas, rouvrez le chantier et appuyez sur « Relancer par SMS » ou « Relancer par e-mail ». |
| Comment je modifie un devis deja envoye | Appuyez sur « Modifier mon devis » sous le montant, puis « Modifier quand même ». Corrigez, puis renvoyez avec « Choisir la date ». Tant que vous n'avez pas renvoyé, le client voit l'ancienne version et peut l'accepter au prix d'avant. |
| Je me suis trompe sur un devis parti comment corriger | Appuyez sur « Modifier mon devis » sous le montant, puis « Modifier quand même ». Corrigez, puis renvoyez avec « Choisir la date ». Tant que vous n'avez pas renvoyé, le client voit l'ancienne version et peut l'accepter au prix d'avant. |
| Comment telecharger le pdf du devis envoye | Appuyez sur « Télécharger le PDF » en bas de l'écran. Le bouton n'apparaît qu'une fois le client a répondu ou le lien expiré. Avant, le PDF est dans « Vos clients », sur le nom du client, onglet « Devis ». |
| Comment ajouter une ligne au devis | Appuyez sur « + Ajouter une ligne » sous les lignes, puis écrivez la description, la quantité et le prix. Avec plusieurs TVA, chaque catégorie a son bouton : la ligne arrive dans celle où vous appuyez. |
| Je veux rajouter une prestation sur le devis | Appuyez sur « + Ajouter une ligne » sous les lignes, puis écrivez la description, la quantité et le prix. Avec plusieurs TVA, chaque catégorie a son bouton : la ligne arrive dans celle où vous appuyez. |
| Comment je change la quantite d'une ligne | Touchez directement la description, la quantité ou le prix unitaire et tapez : le montant se recalcule. Un devis déjà parti ne se modifie plus : voir « Modifier un devis déjà envoyé ». |
| Comment mettre en metre lineaire ou en m2 | Touchez la case « Unité » de la ligne, puis une pastille : u, ml, m², m³, kg, h ou forfait. Un arbre, un arbuste ou une plante se compte en u. |
| Mettre une ligne au forfait | Touchez la case « Unité » de la ligne, puis une pastille : u, ml, m², m³, kg, h ou forfait. Un arbre, un arbuste ou une plante se compte en u. |
| Une ligne est a chiffrer comment poser le prix | Appuyez sur « Poser le prix » en bas du devis : Atlas vous amène sur la case du prix qui manque. Tant qu'une ligne est à chiffrer, le devis ne peut pas partir. |
| Pourquoi le bouton choisir la date a disparu, il manque un prix | Appuyez sur « Poser le prix » en bas du devis : Atlas vous amène sur la case du prix qui manque. Tant qu'une ligne est à chiffrer, le devis ne peut pas partir. |
| Reprendre le prix de la derniere fois | Sous la ligne, appuyez sur « Reprendre ce prix ». Ne s'affiche que si Atlas connaît un travail comparable sur un autre chantier. |
| Comment donner un titre au devis | Touchez « Titre (optionnel) » sous le mot DEVIS et écrivez. |
| Comment mettre deux taux de tva sur un devis | Appuyez sur « + Ajouter une TVA » : une catégorie s'ouvre, touchez son taux pour le changer. |
| Comment deplacer une ligne vers l'autre tva | Gardez le doigt appuyé sur la ligne, puis choisissez « Vers la TVA » voulue, ou « Vers une TVA » pour en créer une. L'appui long ne marche que si le devis a déjà deux TVA, et pas sur un devis parti. |
| Comment supprimer une categorie de tva | Appuyez sur le « − » à droite du titre de la catégorie : ses lignes reviennent dans la TVA principale. La première catégorie n'a pas de « − ». |
| Ou je mets la main d'oeuvre pour le credit d'impot | Appuyez sur « + Main d’œuvre », puis tapez le montant sur la ligne « dont main d’œuvre HT ». Le « − » devant la retire. |
| Comment demander un acompte | Appuyez sur « + Ajouter un acompte », puis touchez le pourcentage pour le changer. Le « − » devant l'acompte le retire. Le reste à régler se calcule sous les acomptes. Le bouton disparaît quand il n'y a plus d'acompte à poser. |
| Je veux 30 % d'acompte a la commande | Appuyez sur « + Ajouter un acompte », puis touchez le pourcentage pour le changer. Le « − » devant l'acompte le retire. Le reste à régler se calcule sous les acomptes. Le bouton disparaît quand il n'y a plus d'acompte à poser. |
| Comment enlever la remise | *sous le Total HT, ligne « Remise de ».* Appuyez sur le « − » devant « Remise de ». La ligne tombe et « Annuler » reste quelques secondes en bas pour la remettre. |
| Comment corriger l'adresse du client sur le devis | Touchez la case du client sur le devis et corrigez. La correction s'enregistre aussi sur la fiche du client. La civilité ne se change pas sur le devis. |
| Le devis n'a pas de client comment en mettre un | Sous « Aucun client rattaché à ce chantier. », appuyez sur « Renseigner la fiche client ». |
| Corriger l'adresse des travaux sur le devis | Touchez l'adresse sous « Chantier » et corrigez. Elle ne s'affiche que si elle diffère de l'adresse du client, ou s'il n'y a pas de client. |
| Changer le siret de mon entreprise sur le devis | Touchez le nom, l'adresse, le téléphone, l'e-mail ou le SIRET en haut du devis et corrigez. La correction vaut aussi pour vos prochains devis et factures. |
| Ou mettre mon iban sur le devis | Sous « Modalités de paiement », touchez « IBAN : FR76 … » et tapez-le. Il reste enregistré pour vos prochains devis. |
| Ajouter une note ou des conditions au devis | Touchez la zone sous « Notes / conditions » et écrivez. |
| Comment dicter une correction dans le devis au micro | Touchez le micro, parlez, puis touchez-le à nouveau. Décochez ce qui ne va pas, puis « Appliquer ce changement », ou « Ne rien changer ». Le micro n'est pas là sur un devis déjà parti. |
| Atlas me pose des questions avant de chiffrer | *l'encadré « Avant de chiffrer », pendant qu'Atlas prépare le devis.* Touchez une réponse sous chaque question, puis « Continuer vers le devis ». Pour passer outre : « Continuer sans répondre à tout ». Ces questions n'apparaissent que quand la dictée ne suffit pas pour chiffrer. |
| Le devis est bloque je ne peux plus le modifier | Appuyez sur « Le corriger et le renvoyer » sous le bandeau en haut du devis. Si aucun lien n'est parti au client, le lien s'appelle « Reprendre et envoyer ». |
| Comment proposer deux dates au client | Allumez « Vous proposez deux dates », puis touchez le premier jour de la deuxième proposition. |
| Je ne veux pas que le client propose une autre date | Allumez ou éteignez « Votre client peut proposer une autre date ». Allumé, il ne voit que vos jours libres. Éteint, il choisit parmi vos dates ou demande une correction. |
| Changer la duree du chantier avant d'envoyer | *après « Choisir la date », en haut de la feuille.* Appuyez sur « changer » à côté de la durée, puis choisissez sous « Ce chantier prend ». |
| Comment savoir si l'equipe est libre ce jour la | *après « Choisir la date », dans le calendrier.* Touchez le jour : dessous, Atlas montre le matin et l'après-midi de votre planning. Si le jour ne va pas, Atlas propose un autre jour : appuyez sur « Proposer le » jour indiqué. |
| Comment enlever un jour propose | *après « Choisir la date », sous le calendrier.* Touchez le jour proposé pour l'effacer, puis le jour que vous voulez à la place. |
| Le client n'a pas de numero de telephone comment envoyer | *après « Choisir la date », quand le client n'a ni numéro ni e-mail.* Choisissez « Par SMS » ou « Par e-mail », tapez le numéro ou l'adresse, puis « Enregistrer et continuer ». |
| Fermer l'envoi sans envoyer | *après « Choisir la date », en bas de la feuille.* Appuyez sur « Annuler » sous « Envoyer le devis ». |
| Comment savoir si le client a accepte le devis | Touchez le chantier dans « Chantiers » : en haut de l'écran Devis, l'état s'affiche, par exemple « En attente de réponse », « Devis accepté » ou « Correction demandée ». |
| Comment relancer un client qui ne repond pas | Appuyez sur « Relancer par SMS » ou « Relancer par e-mail » : le message s'ouvre avec le lien du devis. Le bouton n'est là que tant que le client n'a pas répondu. |
| Envoyer par mail plutot que par sms | Appuyez sur « Plutôt par e-mail » ou « Plutôt par SMS ». S'il manque le numéro ou l'adresse, tapez-le dans la case qui apparaît, puis « Enregistrer et ouvrir le message ». |
| Le client a demande une correction que faire | Lisez le message du client sous l'état, puis appuyez sur « Corriger et renvoyer ». |
| Le client a refuse le devis comment le reprendre | Appuyez sur « Reprendre le devis », corrigez si besoin, puis renvoyez avec « Choisir la date ». |
| Qu'est ce que le client voit quand il ouvre le devis | Il voit le numéro du devis, le total HT, la TVA et le TTC, les dates proposées, et trois boutons : « J'accepte ce devis », « Une correction avant d'accepter » et « Je ne donne pas suite ». |
| Comment le client accepte le devis | Le client coche la date qui lui va, puis appuie sur « J'accepte ce devis ». Son accord est horodaté et gardé avec le devis. La date est alors retenue dans votre planning. |
| Le client peut il proposer une autre date | Le client coche « Cette date ne me convient pas ? Je propose », touche un jour libre, puis « Retenir cette date » et « J'accepte ce devis ». Seulement si vous avez laissé allumé « Votre client peut proposer une autre date ». |
| Comment le client demande une correction | Le client écrit l'erreur dans la case sous les dates, puis appuie sur « Une correction avant d'accepter ». Sans texte écrit, le bouton refuse. Vous lisez son message sur l'écran Devis du chantier. |
| Comment le client refuse le devis | Le client appuie sur « Je ne donne pas suite », puis « Oui, je ne donne pas suite ». Chez vous, le devis passe à « Devis retourné » et peut être repris. |
| Le client peut telecharger son devis | Le client appuie sur « Télécharger mon devis ». Le bouton reste là après son acceptation. |
| C'est quoi la case retractation 14 jours | Si la date tombe dans ses 14 jours de rétractation, le client coche la case pour demander que les travaux commencent avant. La case n'apparaît que pour une date proche. |
| Le client dit que le lien ne marche plus | Ouvrez le chantier, appuyez sur « Reprendre le devis », puis renvoyez-le avec « Choisir la date ». |

## Les factures et la TVA

| Question | Réponse de l'assistant |
|---|---|
| Mon client ne me paiera jamais comment je range la facture | Touchez « Terminés », la ligne du chantier, puis « Il ne me paiera pas ». La facture se range dans « Non payées », et Atlas ne vous la rappelle plus. S'il paie un jour, ouvrez-la et touchez « J'ai reçu le paiement ». |
| Comment faire une mise en demeure | Dans « Terminés », ouvrez « Non payées », puis la facture, puis « Mise en demeure ». Relisez la lettre, touchez « Télécharger la lettre » et envoyez-la en recommandé avec accusé de réception. |
| Comment je fais la facture d'un chantier fini | *« Terminés » dans la barre du bas, puis « À facturer » sur la ligne du chantier.* Touchez la ligne du chantier, puis « Créer la facture » : Atlas la prépare à partir du devis. Rien ne part encore. |
| Je veux facturer mon chantier | *« Terminés » dans la barre du bas, puis « À facturer » sur la ligne du chantier.* Touchez la ligne du chantier, puis « Créer la facture » : Atlas la prépare à partir du devis. Rien ne part encore. |
| Comment je mets un titre sur ma facture | *« Terminés » dans la barre du bas, puis la ligne du chantier, écran Facture.* Touchez « Titre (optionnel) » sous le numéro de la facture et écrivez-le, par exemple Aménagement du jardin. Vide, rien ne s'imprime. Une fois la facture envoyée, il ne se change plus. |
| J'ai renvoyé un devis corrigé, la facture a les anciens montants | Quand l'écran dit que le devis est parti depuis, appuyez sur « Reprendre ce devis » : la facture prend ses montants. N'apparaît que sur une facture pas encore envoyée, quand un devis plus récent est parti. |
| Comment rajouter des travaux supplémentaires sur la facture | En bas de la facture, appuyez sur « Ajouter des travaux supplémentaires », puis « + Ajouter des travaux supplémentaires » : écrivez la description, la quantité, l'unité et le prix. Finissez par « Revenir à la facture ». Seulement tant que la facture n'est pas envoyée. Le devis d'origine ne bouge pas : les lignes s'ajoutent sous « Travaux supplémentaires ». |
| Où j'écris les lignes d'une facture sans devis | *« Terminés » dans la barre du bas, puis la ligne du chantier, écran Facture.* Appuyez sur « Remplir la facture » en bas de l'écran, puis « + Ajouter une ligne » : écrivez la description, la quantité, l'unité et le prix. Finissez par « Revenir à la facture ». Une facture sans ligne ou à 0,00 € ne peut pas être envoyée. |
| Comment mettre de la tva à 10 sur une ligne de la facture | *« Terminés » dans la barre du bas, la ligne du chantier, puis « Remplir la facture » ou « Ajouter des travaux supplémentaires ».* Appuyez sur « + Ajouter une TVA » : une ligne s'ouvre sous un nouveau taux. Touchez le chiffre à côté de « TVA » pour le changer. |
| Comment supprimer les travaux supplémentaires | *« Terminés » dans la barre du bas, la ligne du chantier, puis « Remplir la facture » ou « Ajouter des travaux supplémentaires ».* Appuyez sur le « − » rond, à droite du bandeau de la catégorie : toutes ses lignes partent. Il retire la catégorie entière, avec toutes ses lignes. Seulement avant l'envoi de la facture. |
| Comment j'indique la main d'oeuvre sur la facture | *« Terminés » dans la barre du bas, la ligne du chantier, puis « Remplir la facture » ou « Ajouter des travaux supplémentaires ».* Appuyez sur « + Main d’œuvre » et tapez le montant HT : il s'écrit « dont main d’œuvre HT » sous le Total HT. Le « − » rond la retire. |
| Comment faire une remise sur une facture | *« Terminés » dans la barre du bas, la ligne du chantier, puis « Remplir la facture » ou « Ajouter des travaux supplémentaires ».* Sous le Total TTC, appuyez sur « + Remise » : 5 % s'inscrit, touchez le chiffre pour le changer. Le « − » rond la retire. |
| Le client m'a versé un acompte, je le mets où sur la facture | *« Terminés » dans la barre du bas, la ligne du chantier, puis « Remplir la facture » ou « Ajouter des travaux supplémentaires ».* Sous le Total TTC, appuyez sur « + Règlement reçu » : une ligne se pose avec le montant proposé. Touchez la date ou le montant pour les corriger. Le net à payer se recalcule. Grisé quand le net à payer est à zéro. Sur l'écran de la facture, les règlements se lisent seulement. |
| Comment je mets qu'il a payé par chèque et le numéro du chèque | *« Terminés » dans la barre du bas, la ligne du chantier, puis « Remplir la facture » ou « Ajouter des travaux supplémentaires ».* Sur la ligne du règlement, touchez « Chèque » et choisissez Virement, Espèces ou Carte. Pour un chèque, tapez son numéro dans la case « n° ». La case du numéro n'existe que pour un chèque. |
| Je veux écrire arrhes au lieu d'acompte | *« Terminés » dans la barre du bas, la ligne du chantier, puis « Remplir la facture » ou « Ajouter des travaux supplémentaires ».* Touchez le nom à gauche de la ligne, par exemple « Acompte 30 % », et écrivez ce que c'est. Vidé, il reprend le nom proposé. |
| Comment enlever un règlement que j'ai mis par erreur sur la facture | *« Terminés » dans la barre du bas, la ligne du chantier, puis « Remplir la facture » ou « Ajouter des travaux supplémentaires ».* Appuyez sur le « − » rond au début de la ligne du règlement. Seulement là où l'on remplit la facture, avant son envoi. |
| Comment je mets facture acquittée | *« Terminés » dans la barre du bas, puis la ligne du chantier, écran Facture.* Sous « Net à payer », allumez « Facture acquittée » : le reste est compté reçu à la date du jour, et la facture porte « Acquittée le » avec la date. Il s'allume tout seul quand les règlements couvrent tout. Seulement avant l'envoi : après, le paiement se note dans « Ma TVA à déclarer ». |
| Comment télécharger la facture sur mon téléphone | *« Terminés » dans la barre du bas, puis la ligne du chantier, écran Facture.* Sous « Voir la facture en PDF », appuyez sur « Télécharger » : le fichier porte le numéro de la facture. Avant l'envoi, le fichier finit par brouillon. |
| Comment j'envoie la facture au client par sms | *« Terminés » dans la barre du bas, la ligne du chantier, puis le bas de l'écran Facture.* À côté de « Envoi », touchez SMS ou E-mail, puis « Envoyer la facture » : votre messagerie s'ouvre avec le message et le lien tout prêts. Grisé si le client n'a pas de coordonnée pour ce canal, ou si la facture est vide. En l'envoyant, vous l'arrêtez : une correction passerait par un avoir. |
| Comment je renvoie une facture déjà envoyée par mail | *« Terminés » dans la barre du bas, puis la ligne du chantier déjà facturé.* Sous « Facture arrêtée », appuyez sur « Envoyer par SMS » ou « Envoyer par e-mail » : le même message se rouvre. Si le lien n'est pas encore prêt, le bouton s'appelle « Envoyer la facture au client ». |
| Le client n'a pas de numéro, comment je lui envoie la facture | *« Terminés » dans la barre du bas, puis la ligne du chantier déjà facturé.* Sur la facture arrêtée, tapez le numéro ou l'adresse dans la case qui apparaît, puis « Enregistrer et ouvrir le message ». Il reste sur la fiche du client. Avant l'envoi, sans coordonnée pour le canal choisi, « Envoyer la facture » reste grisé : choisissez l'autre canal. |
| Comment je corrige une facture | Avant l'envoi, appuyez sur « Ajouter des travaux supplémentaires » ou « Remplir la facture » en bas de l'écran. Une fois envoyée, elle ne se modifie plus. Une correction après l'envoi passerait par un avoir. |
| Qu'est-ce que le client voit quand il ouvre le lien de la facture | Il voit le numéro, l'échéance et « Télécharger ma facture », puis « Pour régler » : le numéro de facture et votre IBAN, chacun avec « Copier », et l'ordre du chèque. L'IBAN n'apparaît que s'il est rempli dans Mon entreprise. |
| Comment je sais si le client a ouvert sa facture | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Sous « Factures en attente », chaque facture dit « Ouverte le », « Réception confirmée le » ou « Pas encore ouverte. ». Le client confirme en touchant « J'ai bien reçu cette facture » sur sa page. Cette liste n'existe que si votre TVA est déclarée aux encaissements. |
| Comment faire une facture pour un dépannage sans devis | *« Terminés », dans la barre du bas.* Touchez « Créer une facture » en or, à droite. Remplissez le client, appuyez sur « Faire la facture », puis « Remplir la facture » pour écrire les lignes. |
| Pourquoi mon chantier n'apparaît pas dans terminés | Un chantier apparaît dans « Terminés » une fois sa date d'intervention passée. |
| Combien j'ai facturé sur ce chantier | Chaque chantier facturé porte son montant à droite de sa ligne. « À facturer » en vert attend encore sa facture. |
| Comment voir les photos d'un retour d'intervention | *« Terminés » dans la barre du bas, puis « Retours d'intervention ».* Touchez la carte du jour : « Ce qui a été fait », les photos et « À signaler » s'ouvrent. Touchez une photo pour la voir en grand, « Replier » pour refermer. Le point doré marque un retour pas encore lu, il s'éteint à l'ouverture. Réservé à l'abonnement Entreprise. |
| Chercher les retours d'un client | Tapez son nom dans « Un nom de client ». |
| Voir les retours du mois dernier | *« Terminés » dans la barre du bas, puis « Retours d'intervention ».* Dans la date en haut, touchez le jour, le mois ou l'année : la liste suit. Le chevron ouvre la roue pour choisir un autre jour. |
| Comment voir la tva du trimestre précédent | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Touchez un mois sur la frise sous le titre. Pour une autre année, touchez l'année à gauche, les chevrons, puis la période. « Revenir à la période en cours » ramène au présent. |
| Passer ma déclaration de tva en trimestrielle | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Sous la frise des mois, touchez le mot souligné après « Déclaration », puis l'autre rythme. Seul le patron peut le changer, les autres le lisent. |
| Comment copier le montant de tva à payer | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Touchez la ligne « TVA à payer » : le montant est copié et « copié » s'affiche. Pareil pour la collectée et la déductible. |
| Ça veut dire quoi crédit de tva | Quand la TVA déductible dépasse la collectée, la ligne « TVA à payer » devient « Crédit de TVA » : il n'y a rien à payer sur cette période. |
| Comment scanner un ticket de caisse | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Sous « TVA à payer », appuyez sur « Scanner un ticket », prenez la photo ou choisissez-la, vérifiez les montants lus, puis « Ajouter aux achats ». Gardez le papier, la photo ne le remplace pas. Un ticket d'une autre période y part, et l'écran le dit avant. |
| Ajouter un achat à la main pour la tva | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Appuyez sur « Écrire à la main », remplissez Où, Date, Total payé et Taux : la TVA se calcule. Puis « Ajouter aux achats ». Si le ticket affiche une autre TVA, écrivez la sienne : c'est elle qui compte. |
| Où je vois les achats comptés dans la tva | Descendez dans « Ma TVA à déclarer » : « Vos factures » sous TVA collectée, « Vos achats » sous TVA déductible. Ce relevé ne vaut pas déclaration : elle reste à faire par votre outil comptable. |
| Comment je note qu'une facture est payée | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Sous « Factures en attente », appuyez sur « J'ai reçu le paiement », ou « J'ai reçu une partie » pour un acompte. Une facture payée quitte cette liste et entre au relevé de TVA. La liste n'existe que si votre TVA est déclarée aux encaissements. |
| Le client a payé une partie, je le note où | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Sous la facture, appuyez sur « J'ai reçu une partie », choisissez la date, tapez le montant, puis « Enregistrer ce règlement ». Seule la part reçue entre au relevé. |
| Annuler un paiement noté par erreur | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Sous la facture, appuyez sur la croix au bout de la ligne « Acompte payé le ». Une facture entièrement payée quitte cette liste. |
| Voir toutes les factures impayées | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Sous les trois premières factures en attente, appuyez sur « Voir toutes les factures en attente ». La liste n'existe que si votre TVA est déclarée aux encaissements. |
| J'ai changé d'iban, comment prévenir le client | *« Terminés » dans la barre du bas, puis « Ma TVA à déclarer ».* Sous la facture marquée « Ancien IBAN », appuyez sur « Prévenir », relisez le message, puis « Envoyer par SMS » ou « Par e-mail ». La marque n'apparaît que sur une facture partie avec l'ancien IBAN. |

## Le planning et les équipes

| Question | Réponse de l'assistant |
|---|---|
| Comment je déplace un chantier à un autre jour | *« Planning » dans la barre du bas, puis le jour du chantier dans le calendrier.* Ouvrez le jour, appuyez sur « Déplacer » sous le chantier, touchez le nouveau jour dans le calendrier, puis choisissez « Matin », « Après-midi » ou « Journée ». Seul ce que le chantier occupe ce jour-là part. « Journée » n'est proposé que s'il y occupe le matin et l'après-midi. Un jour passé ne se déplace plus. « Annuler » arrête le geste. |
| Je veux décaler juste le matin d'un chantier | *« Planning » dans la barre du bas, puis le jour du chantier dans le calendrier.* Ouvrez le jour, appuyez sur « Déplacer » sous le chantier, touchez le nouveau jour dans le calendrier, puis choisissez « Matin », « Après-midi » ou « Journée ». Seul ce que le chantier occupe ce jour-là part. « Journée » n'est proposé que s'il y occupe le matin et l'après-midi. Un jour passé ne se déplace plus. « Annuler » arrête le geste. |
| Comment enlever un chantier du planning sans le supprimer | *« Planning » dans la barre du bas, puis le jour du chantier.* Ouvrez le jour, puis appuyez sur « Retirer » sous le chantier. Il perd sa date et retourne dans la liste du bas, « sans date ». Refusé si sa facture est déjà préparée : le chantier garde sa date. Un jour passé ne se modifie plus. |
| Comment je donne la feuille sans les prix à mes gars | *« Planning » dans la barre du bas, puis le nom du chantier.* Touchez le nom du chantier dans sa journée : « Ouvrir le devis sans les prix » est au bas de sa fiche d'intervention. Le bouton n'apparaît que si le chantier a un devis. |
| Comment passer au mois suivant | *« Planning » dans la barre du bas, en haut de l'écran.* Appuyez sur les chevrons de part et d'autre du nom du mois, ou balayez le calendrier du doigt. |
| Comment je vois ce qui est posé un jour | *« Planning » dans la barre du bas.* Touchez le jour dans le calendrier : sa carte s'ouvre dessous, avec le matin, l'après-midi et les chantiers posés. Touchez-le à nouveau pour la fermer. |
| Que veulent dire les couleurs du calendrier | Chaque jour porte deux barres, le matin en haut et l'après-midi en bas. « Rien » : aucun chantier. « Incomplet » : il reste de la place. « Complet » : toutes vos équipes sont prises. « Au-delà » : plus de chantiers que d'équipes. Un salarié absent compte comme un chantier. Le nombre d'équipes se règle dans Réglages, Équipe, « Combien de chantiers par jour ? » : avec 2, « au-delà » commence au troisième chantier. |
| Comment ajouter un nouveau client directement au planning sans devis | *« Planning » dans la barre du bas, puis le jour.* Ouvrez le jour, appuyez sur « Ajouter » puis « Un client ». Tapez son nom et touchez-le s'il est proposé, choisissez « Matin », « Après-midi » ou « Journée », puis « Poser ». Un nom inconnu crée sa fiche : Atlas demande alors téléphone, e-mail et adresse du chantier. « Annuler » ramène aux trois choix. |
| Comment bloquer du temps pour la banque | *« Planning » dans la barre du bas, puis le jour.* Ouvrez le jour, appuyez sur « Ajouter » puis « Autre chose ». Écrivez ce que c'est, choisissez le moment, puis « Poser ». |
| Comment je pose un client sans date | Touchez d'abord le jour dans le calendrier, ouvrez la barre du bas (« À poser sur… »), puis touchez le nom du client. Sans jour touché, la liste montre les clients « en attente d'un jour » sans pouvoir les poser. |
| Je me suis trompé de jour en posant, comment annuler la pose | Ouvrez la barre du bas : sur la ligne « est sur… », appuyez sur « Annuler ». Le chantier repart sans date. |
| Comment supprimer définitivement un chantier sans date | Ouvrez la barre du bas, glissez la ligne du chantier de droite à gauche, puis appuyez sur « Retirer ». « Annuler » reste six secondes. Un chantier facturé ne se supprime pas : sa facture figure au relevé de TVA. |
| Comment reposer la demi journée qui attend | Ouvrez la barre du bas, touchez la ligne « ½ journée à poser », puis ouvrez un jour et appuyez sur « Poser ici » en face du matin ou de l'après-midi libre. Le même morceau se prend aussi par « Ajouter », puis « Client en attente ». |
| Où sont les clients qui choisissent leur date | Ouvrez la barre du bas : sous « En attente du client », chaque ligne dit « Il choisit sa date ». Le chantier se pose tout seul quand il a choisi. |
| Comment je choisis quels salariés vont sur le chantier | *« Planning » dans la barre du bas, puis le jour du chantier.* Ouvrez le jour, touchez « + Salarié » ou les noms en face du matin ou de l'après-midi, touchez les noms à cocher ou décocher, puis « Fermer ». Il faut des salariés déclarés dans Réglages, Équipe. Un salarié absent ce jour-là est grisé. |
| Comment noter qu'un salarié est absent | *« Planning » dans la barre du bas, puis le jour.* Ouvrez le jour, appuyez sur « Salarié absent ? » puis sur son nom. Il est absent toute la journée : touchez « Matin » ou « Après-midi » pour réduire. Seul, sans salarié, le bouton s'appelle « Absent ? ». Pour plusieurs jours d'affilée : Réglages, Équipe. |
| Comment enlever une absence mise par erreur | *« Planning » dans la barre du bas, puis le jour.* Ouvrez le jour : sur la ligne « Absent », appuyez sur la croix à droite. Ou « Salarié absent ? » puis « son nom, annuler ». |
| Pourquoi mon salarié ne peut pas modifier le planning | Un salarié consulte le planning : il ne voit ni « Ajouter », ni « Déplacer », ni « Retirer », et lit la note sans l'écrire. Il peut tout de même envoyer le retour du jour, dans « Travaux à faire ». |
| Comment ouvrir la fiche client depuis le planning | Dans la liste sous le calendrier, touchez le chevron à droite du nom du chantier : « Le devis », « La fiche client », et « Créer la facture » ou « La facture ». Réservé au patron. La ligne du devis dit s'il est parti, accepté, refusé ou si une correction est demandée. |
| Comment facturer un chantier fini depuis le planning | Touchez le chevron à droite du nom du chantier, puis « Créer la facture ». Le bouton n'apparaît qu'une fois le jour du chantier passé. Une fois envoyée, il devient « La facture ». |
| C'est quoi le bandeau agenda en pause en haut du planning | « Vous pouvez relier votre agenda » : « Ouvrir » mène à « Mon agenda », « Masquer » l'enlève pour toujours. « Votre agenda n'est plus lu » : « Ouvrir », puis « Rebrancher ». Réservé au patron. Rien ne s'affiche quand l'agenda est relié et lu, ni quand il est en pause. L'alerte d'un agenda qui ne se lit plus ne se masque pas. |
| Comment envoyer le retour d'intervention du soir | *la fiche d'intervention, dans « Planning ».* Touchez le nom du chantier dans sa journée, puis « Travaux à faire ». Cochez ce qui est fait, ajoutez des photos avec « + », écrivez sous « À signaler », puis « Envoyer le retour du jour ». Touchez une photo pour la voir en grand et faire défiler les autres : « Joindre » ou « Ne pas joindre » s'y choisit. Le patron peut exiger qu'une ligne soit cochée et une photo posée : Atlas dit alors ce qui manque. Les retours se lisent dans Terminés, Retours d'intervention. |
| Comment reprendre la fiche de sécurité et passer à l'étape suivante | Remplissez chaque étape, puis « Suivant ». La flèche en haut à gauche revient en arrière. Tout s'enregistre seul : pour reprendre, rouvrez le bandeau et appuyez sur « Continuer ». La première fois, un rappel du décret s'affiche : appuyez sur « Compris, je remplis ». |
| Comment relever la position gps du chantier | *fiche de sécurité, étape « Le chantier ».* Sur place, appuyez sur « Relever ici ». Si le téléphone refuse, un champ apparaît pour écrire les coordonnées à la main. |
| Comment dire que le donneur d'ordre est un syndic | *fiche de sécurité, étape « Le chantier ».* Sous « Donneur d’ordre », touchez « Le client du devis » ou « Quelqu’un d’autre », et remplissez son nom et téléphone. |
| Comment ajouter mon propre matériel dans la fiche de sécurité | Sous la liste, appuyez sur « Ajouter », écrivez le mot, puis « Ajouter ». Ce que vous ajoutez reste proposé sur vos prochaines fiches. |
| Comment retirer la photo de la fiche de sécurité | *fiche de sécurité, étape « Le terrain ».* Appuyez sur l'appareil photo, prenez la photo ou choisissez-la. Pour la retirer : touchez-la, puis « Retirer ». Une fois la fiche signée, une photo ne se retire plus. |
| Quel numéro appeler en cas d'accident | *fiche de sécurité, étape « Les secours ».* Touchez « Protéger, alerter, secourir » : la marche à suivre s'ouvre, et chaque numéro d'urgence s'appelle d'un appui. |
| Comment signer la fiche de sécurité | À la dernière étape, signez dans le cadre au doigt, puis « Signer la fiche ». « Effacer » recommence la signature. La liste « Encore vide » montre ce qui manque : touchez une ligne pour y aller. Rien n'empêche de signer. |
| Comment envoyer la fiche de sécurité par whatsapp | *le bandeau « Fiche de sécurité » de la fiche d'intervention, une fois signée.* Appuyez sur « Transmettre le PDF » : la feuille de partage du téléphone s'ouvre, choisissez Mail, SMS ou WhatsApp. C'est vous qui envoyez. Une fois transmise, le bandeau dit « Transmise le ». |
| Comment voir le pdf de la fiche de sécurité | *le bandeau « Fiche de sécurité » de la fiche d'intervention, une fois signée.* Ouvrez le bandeau « Fiche de sécurité », puis « Ouvrir le PDF ». |
| Comment corriger une fiche de sécurité déjà signée | *le bandeau « Fiche de sécurité » de la fiche d'intervention, une fois signée.* Ouvrez le bandeau « Fiche de sécurité », puis « Modifier ». La signature part : il faut signer à nouveau, puis la retransmettre. |

## Paysage, clients, diagnostic, arrosage

| Question | Réponse de l'assistant |
|---|---|
| Comment je fais un plan d'arrosage | *« Paysage » dans la barre du bas, puis Plan d'arrosage automatique.* Choisissez l'endroit dans « Le piquage se fait… », puis touchez « Ajouter la photo du croquis » et prenez ou choisissez la photo : le plan sort tout seul. Le croquis doit porter les métrés, l'endroit définitif de la nourrice et l'endroit du piquage. Sans les trois, aucun plan n'est proposé. |
| Je suis sur un robinet de jardin, je mets quoi comme pression | *« Paysage », Plan d'arrosage automatique.* Dans « Le piquage se fait… », choisissez « Robinet de jardin », puis remplissez « Bar statique » et « Bar dynamique » relevés au kit buse 5, ou le temps de remplissage d'un seau de 10 L. Ces cases n'apparaissent qu'au robinet de jardin : juste après le compteur, rien n'est à mesurer. Sans seau ni pression dynamique, le plan est refusé, et le seau seul est trop approximatif : prenez le kit. |
| Ou je rentre le debit au seau | *« Paysage », Plan d'arrosage automatique.* Dans « Le piquage se fait… », choisissez « Robinet de jardin », puis remplissez « Bar statique » et « Bar dynamique » relevés au kit buse 5, ou le temps de remplissage d'un seau de 10 L. Ces cases n'apparaissent qu'au robinet de jardin : juste après le compteur, rien n'est à mesurer. Sans seau ni pression dynamique, le plan est refusé, et le seau seul est trop approximatif : prenez le kit. |
| Il me refuse mon croquis, il manque la nourrice | L'écran coche ce qu'il a lu parmi « Les métrés », « Le piquage » et « La nourrice », et marque en rouge ce qui manque. Complétez le croquis, puis touchez « Reprendre la photo ». |
| Pourquoi il me dit le croquis ne sera pas lu | Le message rouge qui finit par « Le croquis ne sera pas lu. » dit pourquoi l'IA ne peut pas lire l'image sur ce serveur. Tant qu'il est là, photographier ne donnera aucun plan. |
| Il y a combien de reseaux et quelle buse | *« Paysage », Plan d'arrosage automatique, sous le plan.* Sous le dessin, une carte par réseau : la zone arrosée, le matériel et sa buse avec sa portée, puis le compte des arroseurs, tés, coudes et mètres de tuyau. |
| C'est quoi les points rouges sous le plan | Lisez les lignes marquées d'un point rouge juste sous le dessin : c'est ce que le calcul n'a pas pu compter ou a dû supposer. |
| Le rond et le carre sur le plan ca veut dire quoi | La légende est sous le dessin : rond, une turbine ; carré, une tuyère ; plein, un té taraudé ; creux, un coude taraudé en fin de ligne ; losange, un té égal ; trait fin, l'antenne Ø16 ; le trait large, la tranchée. |
| A partir de combien de metres je passe en 32 | *« Paysage », Plan d'arrosage automatique, sous les réseaux.* Sous les cartes des réseaux, une ligne dit jusqu'à combien de mètres le Ø25 tient, et le Ø32 au-delà. Quand le débit est trop fort pour le Ø25, elle dit Ø32 d'office. |
| Ou est la liste des pieces a commander | *« Paysage », Plan d'arrosage automatique, sous le plan.* Sous les réseaux, à « Le détail des pièces » : ce qui va du compteur à la nourrice, ce qui est dans le regard, puis ce qui part au jardin. « à mesurer » : la longueur ne se lit pas sur le croquis, relevez-la sur place. |
| Comment je change la marque des arroseurs sur le plan | *« Paysage », Plan d'arrosage automatique, tout en bas sous la liste des pièces.* Sous « Demander une modification », écrivez ce que vous voulez changer dans « Écrire à Atlas… », par exemple une marque, un matériel ou une buse, puis touchez le bouton rond d'envoi : le plan se refait. La discussion n'existe qu'avec un plan à l'écran. Pour changer un métré ou l'endroit de la nourrice, corrigez le croquis et reprenez la photo. |
| Je peux faire une terrasse bois | « Terrasse bois » est dans « Paysage », marquée « Bientôt » : l'outil n'est pas encore disponible. |
| Ou je vois le traitement pour la maladie | *« Paysage », Diagnostic végétal, après la photo.* Sur le résultat, la gravité et « Que faire ? » s'affichent d'emblée. Touchez « Voir les détails » pour le nom scientifique, la prévention, le traitement et les sources. |
| Comment je lie le diagnostic a un chantier | *« Paysage », Diagnostic végétal, résultat, puis Voir les détails.* Ouvrez « Voir les détails », choisissez le chantier sous « Rattacher à un chantier », puis touchez « Rattacher ». Il faut un chantier ouvert. Sans lui, le diagnostic reste indépendant. |
| Je veux faire un autre diagnostic | *« Paysage », Diagnostic végétal, résultat.* Sur le résultat, touchez « Nouvelle photo ». |
| Il me demande une deuxieme photo | Suivez la consigne écrite, puis touchez « Prendre cette photo ». « Recommencer » repart de zéro. Une seule photo de plus, jamais deux. |
| Le diagnostic est sans conclusion | Lisez « Vu sur la photo » et « Pourquoi ça ne suffit pas », puis touchez « Recommencer » pour une nouvelle photo. |
| La photo n'a pas ete regardee, je fais quoi | Touchez « Réessayer ». Si cela recommence, ouvrez « Réglages de l’IA ». |
| Comment j'ouvre le pdf de la fiche de securite | *« Paysage » dans la barre du bas, puis Fiches de sécurité.* Touchez la fiche pour l'ouvrir, puis « Ouvrir le PDF ». « Enregistrer le PDF » la met dans les fichiers du téléphone. Elle est gardée deux ans après la signature, même si le chantier est supprimé. |
| Comment je transmets la fiche de securite | *« Paysage », Fiches de sécurité.* Touchez la fiche, puis « Transmettre le PDF » et choisissez à qui l'envoyer. Le bouton disparaît une fois la fiche transmise ; la ligne porte alors « transmise ». |
| Je veux voir les fiches de securite du mois dernier | En haut, touchez le jour, le mois ou l'année pour ne voir que cette période. Le petit chevron à côté ouvre la roue pour choisir une autre date. |
| Chercher une fiche de securite d'un client | Tapez le nom dans « Chercher un client ». La croix efface la recherche. |
| Comment j'envoie une fiche de chantier au client | *« Paysage » dans la barre du bas, puis Fiche de chantier.* Touchez « Créer une fiche », puis « + Ajouter un client », cochez les prestations faites, ajoutez vos observations, puis « Enregistrer et envoyer » : le SMS ou l'e-mail s'ouvre, prêt à partir. Sans client nommé et sans une prestation cochée, l'envoi est refusé. Un rapport parti ne se modifie plus. |
| Faire la fiche d'hier | *« Paysage », Fiche de chantier.* Touchez « Créer une fiche » : elle s'ouvre sur le jour d'aujourd'hui. En tête de la fiche, touchez le jour écrit : la roue s'ouvre, choisissez le jour du passage. Une fois la fiche partie chez le client, son jour ne change plus. |
| Changer le client sur la fiche de chantier | *« Paysage », Fiche de chantier, une fiche ouverte.* Touchez « + Ajouter un client », ou « Changer » à côté de son nom, cherchez-le dans « Chercher un client » et touchez son nom. Les prestations de son dernier chantier se cochent toutes seules. Un client ne se crée pas ici : il naît d'un devis. |
| Envoyer la fiche par mail au lieu du sms | *« Paysage », Fiche de chantier, une fiche ouverte, sous le nom du client.* Sous le nom du client, à « Envoyé par », touchez « SMS » ou « E-mail ». « absent » veut dire que ce numéro ou cet e-mail manque dans sa fiche : l'envoi par ce moyen est alors refusé. |
| Cacher le temps passe au client | À « Temps passé », choisissez les heures et les minutes. L'interrupteur à côté le rend « Visible » ou « Masqué » sur le rapport du client. |
| Renvoyer le lien de la fiche au client | *« Paysage », Fiche de chantier, un rapport déjà envoyé.* Ouvrez la fiche envoyée, puis touchez « Envoyer par SMS » ou « Envoyer par e-mail » : le message se rouvre. Les cases ne se modifient plus. Si le client n'a ni téléphone ni e-mail, copiez le lien affiché sous la phrase. |
| Supprimer une fiche brouillon | *« Paysage », Fiche de chantier, liste En cours.* Sous « En cours », touchez la croix au bout de la ligne. « Annuler » reste quelques secondes en bas pour se raviser. Seules les fiches marquées « Brouillon » se suppriment ; un rapport envoyé reste. |
| Reprendre une fiche commencee | *« Paysage », Fiche de chantier, liste En cours.* Sous « En cours », touchez la ligne marquée « Brouillon ». |
| Ou sont les rapports envoyes | Descendez à « Rapports envoyés » : touchez le jour, le mois ou l'année pour choisir la période, ou tapez un nom de client, puis touchez la ligne. |
| Ou est composer ma fiche | *« Paysage » dans la barre du bas, Fiche de chantier, puis la carte « Composer ma fiche » sous le titre.* Ouvrez « Composer ma fiche » : le modèle Atlas y est déjà, modifiez-le. S'il vous manque une ligne du modèle, « Remettre le modèle Atlas » la fait revenir. Réservé au patron. La modifier ne change aucun rapport déjà envoyé. |
| Ajouter une prestation sur ma fiche d'entretien | *« Paysage », Fiche de chantier, puis Composer ma fiche.* Sous la famille voulue, touchez « + Ajouter une prestation », écrivez son nom, puis « Ajouter à » suivi du nom de la famille. |
| Creer une nouvelle famille de prestations | En bas, touchez « + Ajouter une famille », écrivez son nom et sa première prestation, puis « Créer la famille ». |
| Renommer une prestation de ma fiche | *« Paysage », Fiche de chantier, puis Composer ma fiche.* Touchez le nom de la prestation ou de la famille et corrigez-le : c'est enregistré dès que vous quittez la case. Cela ne change aucun rapport déjà envoyé. |
| Enlever une prestation de ma fiche | *« Paysage », Fiche de chantier, puis Composer ma fiche.* Touchez la croix au bout de la prestation. « Annuler » reste quelques secondes en bas pour se raviser. |
| Supprimer toute une famille | *« Paysage », Fiche de chantier, puis Composer ma fiche.* À côté du nom de la famille, touchez « Retirer la famille ». « Annuler » reste quelques secondes en bas pour se raviser. Toutes ses prestations partent avec elle. |
| Chercher un client | En haut de « Vos clients », tapez une partie de son nom dans « Chercher un client ». La recherche porte sur le nom du client. |
| Comment je cree un client | Un client ne se crée pas à part : il naît avec son chantier, puis apparaît dans « Vos clients ». |
| Changer le numero de telephone d'un client | *« Chantiers », « Vos clients », puis son nom.* Sur sa fiche, touchez « Modifier ses coordonnées », corrigez les cases, puis « Enregistrer ». Le nom ne peut pas être vide. |
| Refaire le meme devis que l'an dernier | *« Chantiers », « Vos clients », puis son nom.* Sur sa fiche, touchez « Dernier devis » : un devis neuf s'ouvre, repris de ce qu'on lui a fait la dernière fois. Le bouton n'apparaît que si un devis a déjà été fait pour ce client. L'ancien devis ne change pas. |
| Nouveau chantier pour un client que j'ai deja | *« Chantiers », « Vos clients », puis son nom.* Sur sa fiche, touchez « Nouveau devis » : le chantier s'ouvre avec ses coordonnées déjà remplies. |
| Qu'est ce qu'on lui a fait la derniere fois | *« Chantiers », « Vos clients », puis son nom.* Touchez son nom dans « Vos clients » : « Dernière prestation » est sous ses coordonnées. |
| Partager une facture par whatsapp | *« Chantiers », « Vos clients », puis son nom.* Sur sa fiche, choisissez l'onglet « Devis », « Factures » ou « Fiches », touchez le document, puis « Ouvrir », « Enregistrer » ou « Partager ». « Enregistrer » n'apparaît pas quand le document est une page plutôt qu'un PDF. |
| Supprimer un client | Tout en bas de sa fiche, touchez « Supprimer ce client ». S'il a des documents, cochez « J’ai sauvegardé ces documents ailleurs », puis « Supprimer ». C'est définitif : ses devis, photos et notes sont détruits. Les factures que la loi oblige à garder restent, sous « Conservé par la loi ». |
| Apprendre un mot a atlas | *« Réglages » dans la barre du bas, puis Tarifs & catalogue, puis Le catalogue.* Sous la prestation ou le matériel, touchez « + mon mot », écrivez le mot tel que vous le dites, puis « Ajouter ». Vos mots s'ajoutent à la ligne « Aussi appelé ». |
| Ou est le catalogue | Touchez « Réglages » dans la barre du bas, puis « Tarifs & catalogue », puis « Le catalogue ». Le catalogue ne porte aucun prix : les prix sont dans « Mes prix », juste au-dessus. |
| Ajouter un materiel au catalogue | *« Réglages », Tarifs & catalogue, puis Le catalogue.* Sous « Prestations » ou « Matériels », touchez « + Nouvelle prestation » ou « + Nouveau matériel », écrivez son nom, puis « Créer ». |
| Retirer un mot que j'ai ajoute | *« Réglages », Tarifs & catalogue, puis Le catalogue.* Dans la ligne « Aussi appelé », touchez la croix à côté de votre mot. Seuls vos mots portent une croix, pas ceux du catalogue commun. |
| Atlas me propose un mot, je fais quoi | *« Réglages », Tarifs & catalogue, puis Le catalogue, en haut.* Sous « Atlas a entendu ces mots », touchez « Oui, retenir » ou « Non ». Ce bloc n'apparaît que quand Atlas a relevé un mot inconnu dans vos dictées. |

## Les réglages et l'assistant

| Question | Réponse de l'assistant |
|---|---|
| Comment je crée mon compte | Sur l'écran d'accueil, touchez « Créer un compte », répondez à chaque question puis « Continuer ». « Passer » saute une question facultative. À la fin, touchez « Entrer dans Atlas ». Si Atlas vous envoie un code par e-mail, il faut le saisir avant d'entrer. |
| Je veux m'inscrire sur atlas | Sur l'écran d'accueil, touchez « Créer un compte », répondez à chaque question puis « Continuer ». « Passer » saute une question facultative. À la fin, touchez « Entrer dans Atlas ». Si Atlas vous envoie un code par e-mail, il faut le saisir avant d'entrer. |
| J'ai pas reçu le code par mail | Tapez le code reçu par e-mail, puis « Continuer ». Pas reçu ? Touchez « Renvoyer le code ». |
| Comment je me connecte | Touchez « Se connecter », écrivez votre adresse et votre mot de passe, puis « Entrer ». |
| Je peux me connecter avec google ? | Sur l'écran Connexion, touchez « Google » ou « Apple ». Ces deux boutons n'apparaissent que si votre installation d'Atlas les propose. |
| Entrer avec face id | Sur l'écran Connexion, touchez « Ouvrir avec Face ID ». Il faut d'abord avoir enregistré ce téléphone dans « Réglages », puis Mot de passe. Le bouton n'apparaît que sur un appareil qui sait le faire. |
| Comment accepter les conditions pour entrer | Touchez « Lire le texte » pour le lire, cochez « J'ai lu et j'accepte » sous chaque document, puis « Continuer ». Atlas ne s'ouvre pas tant que chaque document n'est pas coché. |
| Comment je me déconnecte | *« Réglages » dans la barre du bas, tout en bas de la liste.* Touchez « Se déconnecter » en bas des réglages, puis encore « Se déconnecter » pour confirmer. |
| Quelle version j'ai | Descendez tout en bas de « Réglages » : la ligne « Version » donne la date et le numéro servis. |
| Comment récupérer les dernières corrections | *« Réglages » dans la barre du bas, tout en bas, sous Version.* Touchez « Chercher les dernières corrections » sous la ligne Version. Ce bouton n'existe que sur un espace d'essai, et seulement pour le patron. Rien n'est effacé. |
| Pourquoi mon salarié ne voit pas les tarifs | Ces rubriques appartiennent au patron. Il peut changer votre rôle dans « Réglages », puis Équipe. |
| Comment ajouter un tarif | *« Réglages » dans la barre du bas, puis Tarifs & catalogue.* Touchez « + Ajouter un tarif », écrivez l'intitulé et le prix, puis touchez la case de l'unité. Pour retirer un tarif : glissez sa ligne de droite à gauche, puis « Retirer ». Chaque case s'enregistre dès que vous la quittez. Après un retrait, « Annuler » reste un instant en bas. |
| Supprimer un tarif | *« Réglages » dans la barre du bas, puis Tarifs & catalogue.* Touchez « + Ajouter un tarif », écrivez l'intitulé et le prix, puis touchez la case de l'unité. Pour retirer un tarif : glissez sa ligne de droite à gauche, puis « Retirer ». Chaque case s'enregistre dès que vous la quittez. Après un retrait, « Annuler » reste un instant en bas. |
| Importer mes prix depuis un fichier excel | *« Réglages » dans la barre du bas, puis Tarifs & catalogue.* Sous « J'ai déjà mes prix ailleurs », touchez « Choisir un fichier ». Vérifiez ce qu'Atlas ajouterait, puis « Enregistrer ces tarifs ». Rien n'est enregistré avant « Enregistrer ces tarifs ». « Annuler » laisse vos tarifs tels quels. |
| Remplir un prix dans la grille du dessouchage | *« Réglages » dans la barre du bas, puis Tarifs & catalogue, puis Mes prix.* Touchez la case du diamètre voulu et écrivez le montant : il s'enregistre en quittant la case. Pour l'abattage, touchez d'abord la façon de faire pour ouvrir ses cases. Videz la case pour effacer le prix. Une case vide reste une question : Atlas vous la posera sur le chantier. |
| Retirer un travail de la grille | *« Réglages » dans la barre du bas, puis Tarifs & catalogue, puis Mes prix.* Touchez la croix à droite du travail ou de la tranche. « Annuler » la remet aussitôt. Les prix posés ne sont pas effacés : ils reviennent si vous remettez le travail. |
| Ajouter une façon d'abattre au câble | *« Réglages » dans la barre du bas, puis Tarifs & catalogue, puis Mes prix, sous l'abattage.* Sous l'abattage, touchez « + Ajouter une façon d'abattre », écrivez son nom, puis « Ajouter ». |
| Changer les tranches de diamètre | *« Réglages » dans la barre du bas, puis Tarifs & catalogue, puis Mes prix, puis « Régler mes mesures ».* Touchez « Régler mes mesures », puis « Ajouter un diamètre » ou « Ajouter une hauteur ». Écrivez de et à, puis « Ajouter ». Pour retirer une tranche, touchez sa croix. Laissez « à » vide pour dire « et plus ». Retirer une tranche n'efface aucun prix, et « Annuler » la remet. |
| Changer la forme juridique sasu | *« Réglages » dans la barre du bas, puis Mon entreprise.* Touchez « Forme juridique » et choisissez dans la liste, ou « À écrire vous-même ». Pour une société, remplissez ensuite « Capital social » et « Ville du RCS ». |
| Où s'impriment les mentions légales | *« Réglages » dans la barre du bas, puis Mon entreprise, bloc Mentions légales.* Dans « Mentions légales », touchez « Sous le nom », « En bas, avec le SIRET » ou « Ne pas les imprimer ». |
| Je suis en franchise de tva | *« Réglages » dans la barre du bas, puis Mon entreprise, bloc Votre régime de TVA.* Dans « Votre régime de TVA », touchez « Franchise en base » ou « Assujettie ». Assujettie : écrivez votre numéro de TVA intracommunautaire dessous. |
| Déclarer la tva tous les trimestres | *« Réglages » dans la barre du bas, puis Mon entreprise, sous Votre régime de TVA.* Sous votre régime de TVA, touchez « Tous les mois » ou « Tous les trimestres ». |
| Tva sur les encaissements ou les débits | *« Réglages » dans la barre du bas, puis Mon entreprise, sous Votre régime de TVA.* Sous « Je reverse ma TVA aux impôts », touchez « Le mois où mon client me paie » ou « Le mois où j'envoie la facture ». Ce choix doit correspondre à ce que les impôts savent de vous : votre comptable vous le dit. |
| Changer l'indicatif du téléphone | Écrivez le numéro sous « Téléphone ». Pour un autre pays, touchez le drapeau à gauche et choisissez l'indicatif. L'e-mail se corrige juste dessous. |
| Changer mon iban | *« Réglages » dans la barre du bas, puis Mon entreprise, bloc Pour être payé.* Dans « Pour être payé », corrigez l'IBAN ou le titulaire du compte. Atlas redemande votre mot de passe : tapez-le, puis « Continuer ». |
| Prévenir les clients de l'ancien iban | *« Réglages » dans la barre du bas, puis Mon entreprise, après un changement d'IBAN.* Sur chaque facture listée, touchez « Prévenir », puis « Envoyer par SMS » ou « Par e-mail ». Seules les factures envoyées et pas encore réglées sont listées. « Plus tard » ferme l'écran sans rien envoyer. |
| Mettre mon assurance décennale | *« Réglages » dans la barre du bas, puis Mon entreprise, bloc Assurance décennale.* Dans « Assurance décennale », remplissez « Assureur », « N° de contrat » et « Couverture géographique ». Sans assureur, vos devis partent sans une mention que la loi y attend. |
| Renseigner le médiateur de la consommation | *« Réglages » dans la barre du bas, puis Mon entreprise, bloc Médiateur de la consommation.* Dans « Médiateur de la consommation », écrivez son nom, puis son adresse ou son site. Obligatoire dès que vous travaillez pour des particuliers. |
| Pourquoi il me redemande mon mot de passe | Tapez votre mot de passe, puis « Continuer ». Il est demandé pour changer l'IBAN, enregistrer ou retirer Face ID, et télécharger vos données. |
| Régler la validité du devis et l'acompte | *« Réglages » dans la barre du bas, puis Devis & factures, puis Ce qui s'imprime sur le devis.* Ouvrez « Ce qui s'imprime sur le devis », allumez l'interrupteur de la ligne voulue, puis écrivez le chiffre : « Durée de validité », « Acompte à la commande » ou « Délai de paiement ». Les documents déjà faits ne changent pas. |
| Mettre virement et chèque comme moyens de paiement | Allumez « Moyens de paiement acceptés », puis touchez « Virement et chèque », « Virement seulement » ou « Virement, chèque, espèces ». |
| Afficher les pénalités de retard sur le devis | Allumez « Rappeler les pénalités sur le devis ». Sur la facture, elles s'impriment toujours : elles ne se coupent pas. |
| Ajouter un texte en bas du devis | Allumez « Texte en bas de vos documents » et écrivez votre phrase dans la case. |
| Mettre mes conditions générales de vente | Allumez « Conditions générales de vente et de règlement » : un texte est proposé, corrigez-le dans la case. Les crochets restants se remplissent depuis Mon entreprise. Elles s'impriment après le bon pour accord. |
| Changer le message envoyé avec le devis | *« Réglages » dans la barre du bas, puis Devis & factures, puis Mon message au client.* Ouvrez « Mon message au client », corrigez le texte sous le document voulu, puis « Enregistrer ». « Remettre le message d'Atlas » revient au texte d'origine. Les mots en doré se remplissent seuls. Le lien et le mot du document ne peuvent pas être retirés. |
| Changer la numérotation des factures | *« Réglages » dans la barre du bas, puis Devis & factures, puis Le numéro de mes documents.* Ouvrez « Le numéro de mes documents » et touchez la forme voulue, par exemple « Année et 4 chiffres ». Vos documents déjà émis gardent leur numéro. |
| Mettre mon logo sur le devis | *« Réglages » dans la barre du bas, puis Devis & factures, puis L'allure de mes devis.* Touchez « Choisir une image ». Un logo déjà posé se remplace par « Changer » ou s'enlève par « Retirer ». PNG ou JPEG, 1,5 Mo au plus. |
| Changer la couleur et la police du devis | *« Réglages » dans la barre du bas, puis Devis & factures, puis L'allure de mes devis.* Touchez la police voulue, puis choisissez le « Fond de page » et la « Couleur d'accent ». « Revenir aux réglages d'aujourd'hui » annule tout. Tout s'enregistre au fur et à mesure. |
| Donner un accès à un salarié | *« Réglages » dans la barre du bas, puis Équipe.* Ouvrez « Équipe », puis « Donner un accès ». Remplissez nom, adresse e-mail, mot de passe et sa confirmation, choisissez le rôle, puis « Créer le compte ». |
| Changer le rôle d'un salarié en facturation | *« Réglages » dans la barre du bas, puis Équipe, Accès.* Dans « Accès », touchez la personne, puis le rôle voulu : Patron, Facturation, Commercial ou Salarié. Sous les rôles, la liste dit ce que ce rôle peut faire et ce qu'il ne peut plus. |
| Limiter ce que le salarié voit du planning | *« Réglages » dans la barre du bas, puis Équipe, Accès.* Touchez le salarié dans « Accès », puis « Tout le planning » ou « Son équipe » et choisissez laquelle. Ne s'affiche que pour une personne au rôle Salarié. |
| Retirer l'accès d'un salarié | *« Réglages » dans la barre du bas, puis Équipe, Accès.* Dans « Accès », touchez la personne, puis « Retirer l'accès ». Impossible sur votre propre compte. |
| Combien de chantiers par jour | *« Réglages » dans la barre du bas, puis Équipe.* Sous « Combien de chantiers par jour », touchez « + » ou « − ». C'est votre nombre d'équipes : au planning, un jour qui en demande plus passe en « au-delà ». |
| Donner un nom à mes salariés | *« Réglages » dans la barre du bas, puis Équipe.* Sous « Combien de salariés », touchez « + » ou « − », puis écrivez le nom de chacun sur sa ligne. |
| Noter un congé d'un salarié | *« Réglages » dans la barre du bas, puis Équipe, bloc Absences.* Touchez « + Noter une absence », choisissez qui, le premier et le dernier jour, puis « Noter l’absence ». Pour l'effacer, touchez la croix sur sa ligne. Il faut au moins un salarié : seul, posez vos congés dans votre agenda relié. Les absences demandent la formule Entreprise. |
| Exiger une photo en fin de chantier | *« Réglages » dans la barre du bas, puis Équipe, bloc Fin de chantier.* Dans « Fin de chantier », allumez « Demander une preuve », puis si besoin « Au moins une photo ». Le salarié voit « Retour à envoyer » sous le chantier du jour ; vous, « Retour pas reçu » sur l'accueil le lendemain. Le retour part quand même. N'apparaît qu'avec la formule Entreprise. |
| Être relancé chaque semaine pour une facture impayée | Allumez « Facture impayée », réglez le nombre de jours après l'échéance, puis sous « Puis me le redire » touchez « Chaque jour », « Chaque semaine » ou « Tous les 15 jours ». Le rappel s'arrête dès que le règlement est noté. |
| Couper le rappel devis sans réponse | *« Réglages » dans la barre du bas, puis Notifications.* Touchez l'interrupteur à droite du rappel. Allumé, réglez « Au bout de » en jours. La réponse d'un client à un devis et le lien de devis expiré sont toujours signalés. |
| Relier mon agenda google | *« Réglages » dans la barre du bas, puis Mon agenda.* Ouvrez « Mon agenda » et touchez « Relier » sur la ligne Google Agenda, puis choisissez votre compte chez Google. Si la ligne dit « Ne se lit plus », touchez « Rebrancher ». Réservé au patron. Sans agenda relié, Atlas ne voit pas les rendez-vous notés ailleurs et peut proposer ce jour-là. |
| Mettre en pause l'agenda | *« Réglages » dans la barre du bas, puis Mon agenda.* Touchez « Gérer » sur la ligne de l'agenda. Éteignez « Lire mon agenda » pour le mettre en pause, rallumez pour repartir. Pour le détacher : « Débrancher », puis « Débrancher » encore. |
| Relier mon agenda icloud | *« Réglages » dans la barre du bas, puis Mon agenda, ligne iCloud.* Sur account.apple.com, créez un mot de passe pour les apps. Dans « Mon agenda », touchez « Relier » sur la ligne iCloud, écrivez votre adresse iCloud et ce mot de passe, puis « Relier ». Réservé au patron. |
| Mettre mes chantiers dans le calendrier de l'iphone | *« Réglages » dans la barre du bas, puis Mon agenda, ligne iCloud, Gérer.* Touchez « Gérer » sur la ligne iCloud, allumez « Écrire mes chantiers dedans » et touchez le calendrier voulu. « Renvoyer mes chantiers » les remet tous. Il faut d'abord avoir relié l'agenda Apple. Atlas ne touche jamais un rendez-vous qu'il n'a pas posé. |
| Qu'est-ce que l'ia sait faire | *« Réglages » dans la barre du bas, puis Atlas IA.* Ouvrez « Atlas IA » : chaque ligne dit « Oui » ou « Pas encore ». Réservé au patron. Rien à faire de votre côté pour ce qui n'est pas encore branché. |
| Ajouter une règle pour l'ia | *« Réglages » dans la barre du bas, puis Atlas IA, puis Mon vocabulaire.* Touchez « Un mot » ou « Une règle », remplissez l'intitulé et « Ce que ça veut dire », puis « Ajouter ». Sur une ligne, « Mettre de côté » la suspend et « Supprimer » l'efface. Réservé à l'éditeur d'Atlas. Vos propres mots se règlent dans Tarifs & catalogue, Le catalogue. |
| Télécharger mes données | *« Réglages » dans la barre du bas, puis Mes données.* Ouvrez « Mes données », puis « Télécharger mes données ». Atlas peut redemander votre mot de passe. Le fichier porte les coordonnées de vos clients. |
| Supprimer mon compte atlas | *« Réglages » dans la barre du bas, puis Mes données, en bas.* Ouvrez « Mes données » : l'adresse à qui écrire pour effacer votre compte est en bas. L'effacement ne se fait pas encore depuis l'application. |
| Résilier mon abonnement | *« Réglages » dans la barre du bas, puis Abonnement.* Ouvrez « Abonnement », puis « Gérer mon abonnement ». Réservé au patron, et seulement une fois abonné. Les factures de vos clients sont dans « Terminés ». |
| Changer de formule d'abonnement | *« Réglages » dans la barre du bas, puis Abonnement.* Ouvrez « Abonnement », choisissez « Au mois » ou « À l’année, 2 mois offerts », puis « S’abonner » ou « Passer à cette formule » sous la formule voulue. Réservé au patron. Artisan : 39 € HT par mois, ou 390 € HT par an. Entreprise : 59 € HT par mois, ou 590 € HT par an. Illimité : 159 € HT par mois, ou 1590 € HT par an. |
| Changer mon prénom | *« Réglages » dans la barre du bas, puis Mon compte.* Ouvrez « Mon compte », corrigez la civilité, le prénom ou le nom, puis « Enregistrer ». L'e-mail sert à vous connecter et ne se modifie pas encore. |
| Changer mon mot de passe | *« Réglages » dans la barre du bas, puis Mot de passe.* Ouvrez « Mot de passe », écrivez l'actuel, le nouveau et sa confirmation, puis « Changer mon mot de passe ». |
| Activer face id | *« Réglages » dans la barre du bas, puis Mot de passe.* Ouvrez « Mot de passe », puis « Enregistrer cet appareil » sous « Ouvrir avec Face ID ». Votre mot de passe reste actif, et c'est à faire sur chaque appareil. Le bloc n'apparaît que sur un appareil qui sait le faire. |
| Retirer face id d'un ancien téléphone | *« Réglages » dans la barre du bas, puis Mot de passe, bloc Ouvrir avec Face ID.* Sous « Ouvrir avec Face ID », touchez « Retirer » à côté de l'appareil. Votre mot de passe marche toujours. Atlas peut vous le redemander avant. |
| J'ai perdu mon téléphone, me déconnecter partout | *« Réglages » dans la barre du bas, puis Mot de passe, en bas.* Ouvrez « Mot de passe », touchez « Me déconnecter partout », puis encore « Me déconnecter partout » pour confirmer. Celui-ci compris : vous devrez vous reconnecter, et Face ID sera retiré. |
| Passer en mode sombre | *« Réglages » dans la barre du bas, puis Couleurs.* Ouvrez « Couleurs » et touchez la charte voulue. « Nuit » et « Sylve » sont sombres. Vos devis et factures ne changent pas de couleur. |
| Écrire une question à l'assistant | Ouvrez l'assistant, écrivez dans « Votre question… », puis touchez la flèche d'envoi. |
| Poser ma question au micro | Touchez le micro et parlez. Touchez ensuite l'envoi à droite pour poser la question, ou la corbeille à gauche pour jeter ce que vous avez dit. Si le micro ne marche pas, autorisez-le dans votre navigateur. |
| Montrer une photo à l'assistant | Touchez l'appareil photo, prenez ou choisissez la photo. Quand « Photo lue » s'affiche, posez votre question ou envoyez tel quel. « Retirer » l'enlève. |
| Effacer la conversation de l'assistant | En haut de l'assistant, touchez « Oublier ». Le mot n'apparaît que s'il y a déjà des messages. |
| Appliquer les modifications proposées | Décochez ce que vous ne voulez pas, puis « Appliquer les modifications ». « Annuler » n'applique rien. Rien n'est modifié tant que vous n'avez pas appuyé sur « Appliquer les modifications ». |
| Fermer l'assistant | Touchez la croix en haut à droite de l'assistant, ou de nouveau la pastille ronde. |

## Divers

| Question | Réponse de l'assistant |
|---|---|
| Où sont mes chantiers en cours | Touchez « Chantiers » dans la barre du bas : tous les chantiers en cours, devis compris. |
| Comment supprimer un chantier de la liste | *« Chantiers », dans la barre du bas.* Glissez la ligne de droite à gauche, puis appuyez sur « Retirer ». La ligne tombe et « Annuler » reste six secondes en bas de l'écran. Un chantier déjà facturé ne part pas : sa facture figure au relevé de TVA. Le glissement découvre alors le motif à la place du bouton. |
| J'ai supprimé par erreur comment annuler | Appuyez sur « Annuler » dans le bandeau du bas. Il reste six secondes. Passé ce délai, la suppression est écrite et ne se défait plus. |
| Comment reprendre un chantier là où je me suis arrêté | *« Chantiers », dans la barre du bas.* Touchez la ligne : Atlas rouvre l'écran où le travail s'est arrêté, pas la fiche. |
| Comment compléter ma note vocale j'avais oublié quelque chose | Appuyez sur « Reprendre, j'avais oublié quelque chose », puis parlez. |
| Comment remplacer la note vocale | Appuyez sur « Remplacer la note », confirmez, puis réenregistrez. |
| J'ai un fichier audio comment l'envoyer | Appuyez sur « Ajouter un fichier audio » et choisissez l'enregistrement. |
| Comment corriger le texte de la dictée | Appuyez sur « Corriger le texte à la main », modifiez, puis « Enregistrer le texte ». |
| Comment valider les informations du chantier | Appuyez sur « Valider et calculer le prix ». |
| Comment préparer le devis depuis les prix | Appuyez sur « Préparer le devis ». |
| Comment retirer une ligne du devis | Glissez la ligne de droite à gauche, puis appuyez sur « Retirer ». La ligne tombe et « Annuler » reste six secondes en bas de l'écran. Un devis déjà parti chez le client ne se modifie plus : il faut le reprendre (voir « Corriger un devis envoyé »). |
| Comment voir l'aperçu du devis en pdf | Appuyez sur « Aperçu du PDF ». |
| Comment changer l'échéance de la facture | Appuyez sur la date sous « À régler avant le » et choisissez-en une autre. Une facture arrêtée fige son échéance : elle ne se corrige plus. |
| Comment voir la facture en pdf | Appuyez sur « Voir la facture en PDF ». |
| Où sont les chantiers pas encore facturés | Touchez « Terminés » dans la barre du bas, puis l'œil à côté de « à facturer » : il ne reste que ceux qui attendent. « À facturer » sur une ligne ouvre sa facture. |
| Comment poser un chantier sur un jour du planning | *« Planning », dans la barre du bas.* Touchez le jour, puis « Ajouter » et « Client en attente », et touchez le nom : sa durée fait le reste. |
| Comment laisser une note sur une journée | Écrivez dans « Ma note », sur la fiche du jour. Elle s'enregistre toute seule. |
| Comment aller au chantier avec waze | *« Planning » dans la barre du bas, puis le nom du chantier.* Sur la fiche du chantier : « Maps », « Waze », « Appeler le client » ou « Copier l'adresse ». |
| Comment voir la semaine suivante | Appuyez sur les chevrons de part et d'autre des dates. |
| Comment passer de la journée aux sept jours | Balayez la liste du doigt, ou appuyez sur l'un des deux points. L'écran s'ouvre toujours sur la journée du jour. |
| Comment faire un diagnostic d'un arbre malade | Appuyez sur « Prendre une photo » et photographiez la zone anormale. |
| Comment régler mes grilles de prix | Appuyez sur « Ajouter un travail », nommez-le, et choisissez comment son prix se décide. |
| Comment reprendre l'allure de mon devis en photo | Ouvrez « L’allure de mes devis », appuyez sur « Photographier mon devis » et choisissez l'appareil photo ou la photothèque. L'allure et les mentions sont reprises ; ni les lignes, ni les prix, ni le logo. |
| Combien de chantiers partent en même temps, où je règle ça | Ouvrez « Équipe » : le nombre de chantiers menés en même temps, vos salariés et leurs absences s'y règlent. |
| Comment couper les notifications | Ouvrez « Notifications » et réglez chaque rappel, ainsi que son délai. Deux alertes ne se coupent pas : la réponse à un devis et le lien de devis expiré. |
| Comment ouvrir l'assistant | Appuyez sur la pastille ronde en haut à droite de l'écran. |
| Reprendre la ligne d'élagage du devis d'un autre client | Ouvrez le devis où poser la ligne, puis demandez à l'assistant, par exemple : « reprends la ligne d'élagage du devis de Bernard ». Il la cherche, la propose, et vous la validez. Le montant est relu sur la ligne d'origine au moment où vous validez : rien n'est recopié de mémoire. |
