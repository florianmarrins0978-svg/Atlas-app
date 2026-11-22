# Les dossiers du plan d'arrosage : codés

*21 novembre 2026. Réponse au brief « les dossiers du plan d'arrosage ».
La planche d'abord, ses cinq questions, puis son « tu peux tout coder » du
même soir, qui vaut oui à mes cinq recommandations.*

**La planche :** https://florianmarrins0978-svg.github.io/Atlas-app/arrosage-dossiers.html

---

## 0. Le code, le 21 novembre au soir

### Ce que fait l'appli maintenant

| Le brief, et ses réponses | Verdict | Où |
|---|---|---|
| créer un dossier à un nom choisi | **fait** : « Nouveau dossier » dans « Mes dossiers », ou dans la feuille d'enregistrement | `MesDossiers.tsx`, `EnregistrerDansUnDossier.tsx` |
| relié à une fiche client, facultatif (réponse 1) | **fait** : la barre de recherche de l'appli, six clients au plus ; choisir remplit le nom | `ChoixDuClient.tsx` |
| y enregistrer le plan de l'outil | **fait** : sous les réserves. Le serveur refait le plan et compare son empreinte à celle de l'écran avant d'écrire | `dossiers-arrosage/actions.ts` |
| la saisie, le plan, la liste, les réserves, la version du calcul, la date | **fait** : tout est figé dans la ligne, avec les retouches des pièces et le modèle qui a lu la photo | `plans_arrosage`, migration 0193 |
| un enregistrement ne s'écrase pas | **fait** : une version de plus. Le même plan deux fois n'en fait pas, et le dit | `enregistrerPlan` |
| revoir ne recalcule jamais | **fait** : le plan revu affiche le plan stocké, et rien de ce qui le change ne répond | `PlanRevu.tsx`, `LePlanDuJardin.tsx` (`fige`) |
| la photo gardée (réponse 3) | **fait** : nettoyée par la porte commune (GPS retiré), montrée par « Voir la saisie » | `…/[plan]/croquis` |
| le PDF (réponse 4) | **fait** : archivé à l'enregistrement, servi tel quel. Un réseau par page en couleur, avec les photos des pièces, puis la liste. Ni réserves, ni la phrase « Nous ne garantissons pas… », ni prix d'achat, ni pied de page | `plan-arrosage-pdf.ts` |
| supprimer (réponse 2) | **fait** : le nom, le lien, la photo, la lecture de l'IA et le PDF s'effacent ; le calcul est gardé 5 ans puis purgé. Effacer le client et fermer le compte font la même chose | `oublierDesDossiersDans` |
| sans l'option à 6 € (réponse 5) | **fait** : les dossiers restent ouverts, et « Mes dossiers » apparaît sous la fermeture de l'outil quand il en a. Seul enregistrer demande l'option | `SesDossiersSansLOption.tsx` |
| l'outil sans dossier | **inchangé** : faire un plan n'écrit toujours rien | |

### Ce qui a été fait autrement, ou ajouté

1. **« Reprendre dans l'outil »** : le plan enregistré se rouvre dans l'outil
   avec ses paramètres et ses retouches, et se refait avec le calcul du jour.
   Revoir et reprendre sont deux gestes ; enregistré de nouveau, il fait une
   version de plus.
2. **Une cadence sur l'enregistrement** : chaque appel range une photo et un
   PDF. Sans plafond, une boucle remplirait le stockage. Vingt par minute.
3. **L'export « Télécharger mes données »** emporte les dossiers, les plans,
   leurs PDF et leurs croquis, dans « Plans d'arrosage ».
4. **Le plan revu n'affiche pas de prix.** Les prix de vos fournisseurs sont
   ceux d'aujourd'hui ; posés sur un plan d'un autre jour, ils feraient croire
   qu'ils en sont.

### Ce que j'ai écrit et qui était faux (corrigé ici)

1. **« Ses prix d'achat restent à l'écran, dans le plan revu »** (point 3.4
   plus bas) : faux, pour la raison du point 4 juste au-dessus.
2. **« Chaque réserve est dans le PDF, un contrôle qui sait rougir »** (point
   5) : c'est l'inverse depuis ta décision. Le contrôle vérifie qu'AUCUNE
   réserve n'y est, et qu'il y en a bien dans le plan d'essai, sans quoi il
   ne mesurerait rien.
3. **Les noms du point 5** : la table s'appelle `plans_arrosage`, pas
   `plans_enregistres`, et il n'y a pas de colonne `moteur` : le modèle
   enregistré dit déjà qui a lu la photo.

### Les défauts trouvés avant toi

Par la suite navigateur qui fait ton geste, du dessin au dossier supprimé :

1. **« Reprendre dans l'outil » ne répondait pas.** Il était posé dans la
   partie rendue inerte du plan revu. Seuls les blocs qui modifient le sont
   maintenant.
2. **Après une suppression, la flèche de « Mes dossiers » ramenait au dossier
   supprimé.** Il sort maintenant de l'historique, comme une fiche client
   effacée.

Un trouvé en relisant le code : **un enregistrement refusé (un nom déjà pris,
par exemple) laissait la photo du croquis et le PDF dans le stockage**, sans
rien qui y renvoie : la photo de ton client serait restée chez Cause pour
toujours. Ils partent maintenant à la purge, comme ceux d'un plan enregistré
deux fois.

Et deux vus en regardant les écrans : la feuille « Supprimer ce dossier ? »
promettait d'effacer une photo qu'un plan dessiné n'a pas ; « 3 bar » se
coupait en fin de ligne.

### La batterie

Deux batteries entières, le 21 novembre au soir.

| | première | seconde |
|---|---|---|
| types, lint, construction, mémoire du dépôt, connexion derrière un proxy | vert | vert |
| suites base | **613 sur 617** | **617 sur 617** |
| suites navigateur | 218 sur 218 | **218 sur 218** |

**Les quatre rouges de la première étaient de mon lot, et vrais :**

1. la file qui efface un dossier oublié au bout de 5 ans ne liait pas le
   dossier à son entreprise. La base doit refuser d'elle-même une file qui
   nommerait le dossier d'une autre entreprise ;
2. les deux colonnes qui portent la photo et le PDF n'étaient pas déclarées
   au contrôle qui compare la base et le stockage des fichiers ;
3. une fiche du mode d'emploi de l'assistant citait une ligne de code que
   j'avais déplacée : l'assistant aurait enseigné un geste qu'il ne
   retrouvait plus ;
4. « Télécharger le PDF » était un simple lien : sur iPhone, le PDF se serait
   ouvert au lieu de se ranger. Il passe maintenant par le bouton commun des
   devis et des factures, et la suite navigateur fait l'appui et reçoit le
   fichier.

La suite des dossiers, qui fait ton geste du dessin au dossier supprimé :
8 cas sur 8.

### Le 22 novembre : le plan en couleur agrandi dans le PDF

Ta demande : *« agrandis le plan d'arrosage où il n'y a pas la photo des
pièces, et même sur celle où il n'y a pas vraiment la place »*.

| La page | Avant | Maintenant |
|---|---|---|
| réseau 1, pelouse carrée | 200 points de large | 411 ; le dessin des pièces passe de 441 à 317, ses photos de 34 à 32 points |
| réseau 2, deux pelouses | 200 | 360 ; les pièces de 380 à 277, leurs photos de 34 à 28 points |
| réseau 3, le couloir | 200 | toute la largeur, 511 ; les pièces aussi (470 avant) |
| réseau 4, le goutte-à-goutte | 200 | toute la largeur, 511 |

Le plan est sous l'en-tête, sur la largeur de la page. Quand la page manque de
place, le dessin des pièces rétrécit un peu plus que lui, pour que les photos
restent lisibles. Le vide gardé autour du dessin des pièces et trois lignes
vides sous la tête du bas ont été rendus au plan.

### Le 22 novembre, ensuite : le mot « nourrice », le losange et l'angle

Ton « oui, corrige d'abord le mot nourrice et l'écart d'angle ».

| | Ce qui est fait | Comment je le sais |
|---|---|---|
| le mot « nourrice » | il se pose à la place libre la plus proche du regard : plus aucun trait ne le barre, il ne couvre ni tête, ni losange, ni cote. Le regard est souvent dans un passage de 2 m, plus étroit que le mot : il se pose alors à côté, dans la pelouse | `test-plan-dessine.ts`, sur huit places de nourrice dans trois jardins : rouge partout avant, vert après. Regardé sur les quatre réseaux du PDF, sur quatre jardins et au robinet |
| le losange sous le regard | il sort, à côté, sans tomber sur une tête ni sur une cote | le même contrôle. **Trouvé en regardant** : dans un jardin d'essai, le losange sorti se posait sur la cote « 14 m ». Corrigé, et ajouté au contrôle |
| l'écart d'angle | l'angle et l'échelle s'arrondissent à six décimales | la même nourrice calculée dans Node et dans Chromium : 5 rotations sur 140 différaient avant, aucune après |

Un plan déjà enregistré dans un dossier garde son dessin de ce jour-là.

Pas encore chez toi : les trois corrections du 22 attendent la batterie, sur
ton oui.

### Ce qui reste, et qui le tranche

| | qui |
|---|---|
| la clause des conditions générales : le calcul d'un dossier supprimé gardé 5 ans, sans rien qui désigne le client | toi, avec ton juriste |
| la batterie, puis `main`, pour les trois corrections du 22 (plan agrandi, mot « nourrice » et losange, angle) | toi : ton oui |
| « Voir la saisie » ne dit pas ce que tu as corrigé de la lecture de l'IA (« lu 2 m, corrigé par vous » sur la planche) : la lecture est gardée, la comparaison n'est pas écrite. **Corrigé le 22 :** je te l'avais présenté comme une question, mais ta planche le montrait et ton « tout coder » l'a validé. Il reste à le coder : une pelouse coupée par un massif devient plusieurs zones, donc chaque zone doit garder la trace de la zone lue d'où elle vient | moi, sans réponse de toi |
| le PDF ouvert sur ton iPhone | toi |

---

# La planche et les cinq questions (avant le code)

---

## 1. Ce qui a été fait

La planche est `appli/arrosage-dossiers.html`.

| Le brief demandait | Verdict |
|---|---|
| la planche sur le VRAI écran d'arrosage figé | **fait** : figé le 21 novembre sur l'appli servie (commit `f7f9468`), base de démonstration, par `scripts/planche-figee/` |
| un vrai plan sous le bouton | **fait** : un jardin (deux pelouses, un massif, un couloir) envoyé au serveur par le chemin du dessin. Le plan, ses 4 réseaux, ses 45 pièces et ses 11 réserves sont ceux du calcul ; rien n'est tapé à la main |
| où sont les dossiers, comment on en crée un | **fait** : « Mes dossiers » sous « J'ai déjà un devis fournisseur », au départ de l'outil. Rien entre le titre et le piquage (sa règle du 20 août) |
| « Enregistrer dans un dossier » sous un plan | **fait** : sous les réserves, à la fin de la liste. La feuille demande le dossier, ou en crée un |
| un dossier ouvert, ses plans, leur date | **fait** : deux versions, la plus récente en tête, Renommer, Supprimer |
| un plan revu, le téléchargement | **fait** : le plan tel qu'enregistré, sans rien qui le modifie, « Voir la saisie », « Reprendre dans l'outil », l'aperçu du PDF en 8 pages, un réseau par page, sans les réserves (sa décision) |
| chaque bouton fait quelque chose | **fait** : parcourue à 390 et 360 px, chaque geste touché, aucun muet, aucune erreur |
| dans `appli/` et `essais.html` | **fait**, et dans `docs/maquettes/index.html`. Les scripts qui la refont : `appli/scripts/dossiers-arrosage/` |

**Deux pilotes en tête de la planche** montrent les deux réponses qui changent
l'écran : le dossier libre ou relié à une fiche client (question 1), la photo
gardée ou non (question 3).

**Aucune batterie** : le lot ne touche que `appli/` et `docs/`, niveau 1. Sur
son « oui » du 21 novembre, un serveur de démonstration a tourné dans le
conteneur du nuage, sur une base neuve, pour figer l'écran.

**Contrôles joués** : `appli/tests/e2e.js` (celui qui garde la publication)
255 sur 255 ; `test-aucun-tiret`, `test-aucune-fleche`, `test-nom-cause`,
`test-une-seule-recherche` verts. La planche pèse 1,1 Mo : les photos des
pièces arrivaient en pleine taille (14 Mo), elles sont réduites à leur place
et écrites une seule fois.

**Pas regardé** : Safari. Ce poste n'a que Chromium.

---

## 2. Ce que le brief disait, et qui est faux ou incomplet

1. **« L'hébergement n'est pas encore choisi. »** Il est choisi : Scaleway
   (`docs/QUESTIONS.md` §30, `HANDOVER.md`). Il n'est pas encore en place.
   Et le stockage des fichiers existe déjà dans le code
   (`src/server/storage/` : le disque sur le banc, S3 en production) ; il
   porte déjà les photos de chantier, les tickets, les photos de diagnostic
   et les PDF. Garder la photo du croquis n'ajoute aucune brique.
2. **« `EnregistrerLaDemande.tsx` montre comment une liste s'enregistre. »**
   Il range le message envoyé à un fournisseur sur la fiche de ce
   fournisseur : ce n'est pas un plan, et rien n'y est figé. Les deux bons
   modèles sont la table `diagnostics` (le résultat figé, `moteur`, `modele`,
   `versionBase`) et **la facture**, dont le PDF est « archivé à l'émission,
   jamais reconstruit » (`docs/QUESTIONS.md` §30).
3. **« Le plan et la liste, exactement comme affichés. »** Une partie de ce
   qui est affiché ne vit QUE dans l'écran : les pièces changées ou
   supprimées au nombre choisi sont un état local de
   `LePlanDuJardin.tsx` (`retouches`), absent des
   paramètres qui voyagent. Un enregistrement fait des seuls paramètres
   perdrait ses retouches sans rien dire. Elles font partie de la saisie
   enregistrée.

## 3. Ce qui manquait au brief

1. **L'enregistrement se recalcule au SERVEUR, et se compare à l'écran.** Si
   le navigateur envoyait le plan tout fait, un envoi bricolé (ou une page
   restée ouverte sur un code ancien : le piège « la page a survécu à son
   serveur », `HANDOVER.md`) enregistrerait un plan que Cause n'a jamais
   calculé. C'est exactement ce que la trace doit pouvoir réfuter. Ce qui
   part du navigateur, c'est la saisie (la lecture de l'IA, ses corrections,
   les paramètres, les retouches) et l'empreinte du plan affiché ; le serveur
   refait le plan avec le même calcul (`le-plan.ts`) et compare. Différent :
   refus, « rechargez la page », et une ligne au journal. La lecture de l'IA,
   elle, ne se recalcule pas : elle s'enregistre telle que rendue, avec le
   modèle qui l'a faite, comme `diagnostics.modele`.
2. **Le PDF s'archive au moment d'enregistrer**, comme celui d'une facture.
   Le plan revu à l'écran redessine des données figées avec le dessin
   d'aujourd'hui ; le PDF, lui, est l'image de ce jour-là, à l'octet près.
   C'est lui qui fait foi.
3. **Sans l'option à 6 €, ses plans enregistrés deviendraient
   inaccessibles** : `layout.tsx` de l’outil ferme tout ce qui
   vit sous l'outil. Question 5.
4. **Ses prix d'achat ne partent pas dans le PDF** : le PDF est fait pour
   être envoyé. Ils restent à l'écran, dans le plan revu.
5. **Enregistrer deux fois le même plan ne crée pas de version.** La planche
   le dit (« Ce plan est déjà enregistré tel quel dans ce dossier »).
6. **Une version ne se supprime pas seule**, sinon l'historique ment. On
   supprime un dossier entier.
7. **L'effacement d'un client, la fermeture du compte et « Télécharger mes
   données »** doivent suivre les dossiers. Pour le premier, seul un dossier
   RELIÉ à la fiche peut être retrouvé (question 1).

---

## 4. Les cinq questions, avec ma recommandation

### Question 1. Un dossier libre, ou relié à la fiche client ?

**Recommandation : un nom libre, toujours possible, et un lien FACULTATIF à
une fiche qui existe.** Choisir le client remplit le nom ; le lien se pose
aussi après coup (« Renommer »). Pilote « Relié à un client » sur la planche.

| | |
|---|---|
| pourquoi le nom libre reste | l'outil sert en visite de devis, avant que le client existe : c'est sa décision du 17 août (`ARCHITECTURE.md` §125) |
| pourquoi le lien compte | **l'effacement d'un client ne retrouve que ce qui lui est relié** (`effacerClient`, `donnees-client.ts`, par l'identifiant du client). Un dossier tapé « Madame Intel » survivrait à l'effacement de Mme Intel : son nom resterait chez Cause, contre la demande |
| ce qu'il gagne | ne pas taper deux fois ; le dossier se retrouve depuis la fiche |
| ce que ça coûte | une colonne et le champ de recherche de l'appli dans la feuille |
| écarté | le lien au chantier : un jardin reçoit plusieurs devis, le client est la bonne attache |

### Question 2. Supprimer un dossier ?

**Recommandation : le dossier disparaît pour lui, et tout ce qui désigne son
client s'efface aussitôt : le nom du dossier, le lien à la fiche, la photo du
croquis. Cause garde le calcul seul (les cotes, les mesures, les choix, le
plan, la liste, les réserves, la version, la date) pendant 5 ans, lisible par
Cause seule, puis l'efface.** La feuille « Supprimer ce dossier ? » de la
planche le dit en deux phrases.

| | |
|---|---|
| ce que dit le RGPD | les données du client de l'artisan sont à l'artisan ; Cause est sous-traitant (`docs/QUESTIONS.md` §33, article 28). Son ordre d'effacer s'exécute |
| pourquoi garder le calcul reste permis | sans nom, sans photo et sans lien, il ne désigne plus le client de l'artisan : c'est la trace du service que Cause a rendu à l'artisan, gardée pour le propre compte de Cause, pour se défendre (RGPD article 17.3.e, intérêt légitime article 6.1.f) |
| pourquoi 5 ans | la prescription des actions entre commerçants (Code de commerce L110-4) et de droit commun (Code civil 2224) |
| écarté : tout effacer | plus aucune preuve, c'est ce qu'il veut éviter |
| écarté : tout garder | Cause garderait le nom de Mme Intel contre l'ordre de l'artisan : c'est le point attaquable, le même qu'au §33 |

**Confiance : moyenne.** Ce qui la ferait changer : si l'arrosage enterré
relève de la garantie décennale de l'artisan, un recours contre Cause peut
arriver après 5 ans, et la durée passerait à 10. **C'est au juriste de
trancher**, et la règle doit être écrite dans les conditions générales et la
politique de confidentialité **avant** que le code parte : une nouvelle
version des conditions, que chaque compte accepte. Cela, c'est sa décision.
La fermeture du compte suit la même règle.

### Question 3. La photo du croquis : on la garde ?

**Recommandation : oui, avec le plan, tant que le dossier vit ; effacée avec
lui.** Pilote « La photo » sur la planche.

| | |
|---|---|
| pourquoi | c'est la seule preuve de ce que l'artisan a fourni. Sans elle, « l'IA a mal lu mon croquis » ne se tranche pas : on a les cotes lues, jamais ce qui était écrit |
| ce qui existe déjà | elle passe par `preparerPhotoEntrante` : coordonnées GPS retirées, 8 Mo au plus. Le stockage existe (point 2.1) |
| le poids | quelques centaines de Ko une fois réduite (estimation, à mesurer au codage) |
| le coût | le stockage d'objets de Scaleway coûte de l'ordre d'un à deux centimes par Go et par mois (grille relevée en 2024, à revérifier) : mille plans, moins d'un euro par an. Confiance sur l'ordre de grandeur : haute ; sur le prix exact : faible |
| un plan dessiné au doigt | pas de photo : c'est le dessin qui s'enregistre |

### Question 4. Le téléchargement en PDF, comme les devis ?

**Recommandation : oui**, fait par l'appli comme le devis (`src/server/pdf/`),
archivé au moment d'enregistrer.

**Revu le soir même, sur sa demande** : *« ce qui serait bien, c'est qu'on
puisse voir les réseaux en grand »*, chaque réseau sur sa page, à la fois en
couleur et avec ses pièces, *« qu'on voie la photo des pièces »*. C'était ma
question ouverte (les dessins des pièces dans le PDF) : il l'a tranchée.

**Puis, sur la planche** : *« Ce qui n'est pas calculé, tu me l'enlèves. Pas
besoin de l'avoir sur le PDF »*, et les petites lignes grises du bas des
pages, qui passaient sur d'autres mots, retirées. La planche montre
maintenant 8 pages :

| page | ce qu'elle porte |
|---|---|
| 1 | l'entreprise, le dossier, la date, le résumé ; la légende des symboles (rond, carré, plein, creux, losange) |
| 2 à 5 | **un réseau par page**, à la même taille que les autres : en haut son nom, son matériel, son tuyau, et le réseau en couleur dans le jardin ; au milieu le dessin de ses pièces avec leurs photos, aussi grand que la page le permet ; en bas une tête, de bas en haut, avec ses photos |
| 6 à 8 | la liste des pièces, chaque groupe coupé redit son nom |

**Toutes les pages à la même taille** (sa remarque : couchées, les pages des
réseaux sortaient plus petites sur le téléphone, qui les réduit à sa largeur).
Pour garder la place aux photos, le réseau en couleur se pose en haut à
droite, à côté du nom, et le dessin des pièces prend le milieu de la page :
ses photos sont deux fois plus grandes que sur la première version. Les deux
dessins sont ceux de l'écran, jamais redessinés.

**Les réserves ne sont plus dans le PDF** (sa décision). Elles restent sous
le plan à l'écran, et dans l'enregistrement figé : c'est lui qui sert si un
réseau est contesté. La phrase « Nous ne garantissons pas la bonne levée des arroseurs. » y est
revenue un temps à la toute fin, sur sa demande, puis **il l'a retirée** : le
PDF ne porte plus aucune réserve.

**Pourquoi des mots se chevauchaient chez lui.** Les pages étaient mesurées
ici, avec les polices de ce poste, et le pied gris posé à hauteur fixe : son
iPhone écrit plus large, et la dernière ligne passait dessous. Le pied est
parti, les pages gardent 8 % de jeu, et une page qui déborderait encore
s'allonge au lieu de recouvrir. Éprouvé avec une police plus large que la
sienne : aucun texte sur un autre. **Pas vu sur Safari** (ce poste n'a que
Chromium).

**Vu en regardant, et pas touché** : sur le plan en couleur d'un réseau, le
mot « nourrice » mord sur le losange du té égal. C'est le dessin de l'appli,
le même qu'à l'écran : à corriger dans l'appli, sur son oui.

Les pages se remplissent en mesurant chaque bloc : une ligne qui ne tient pas
passe à la page suivante, elle n'est jamais coupée. Le PDF ne suit pas la
charte de couleurs (comme les devis) et **ne porte pas ses prix d'achat**.

### Question 5, que le brief n'avait pas. Sans l'option à 6 €, ses plans ?

**Recommandation : revoir et télécharger restent ouverts, en lecture seule,
même sans l'option ; seul un nouveau plan la demande.** Une trace sert au
moment d'un litige, souvent après avoir arrêté l'option : la lui fermer
reviendrait à garder ses propres données hors de sa portée. Aujourd'hui,
`layout.tsx` ferme tout l'outil : les dossiers vivraient donc à une adresse
hors de cette porte.

---

## 5. Comment ce serait codé (écrit avant le code ; ce qui a changé est au point 0)

| | |
|---|---|
| deux tables | `dossiers_arrosage` (le nom, le client facultatif) et `plans_enregistres` (la version, la saisie, le résultat figé, l'empreinte, la photo, le PDF archivé, `moteur`, `modele`, `version_calcul`, la date, qui l'a enregistré) |
| isolation | `FORCE ROW LEVEL SECURITY`, tout par `withEntreprise`, et une suite base sous `atlas_app` qui prouve qu'une entreprise ne voit pas les dossiers d'une autre, ni par leur identifiant |
| migration | en expansion seulement : deux tables neuves, rien d'autre ne bouge. Le numéro se prend au-dessus de `main` (0192) **et** des branches actives, juste avant la batterie |
| tests rouges d'abord | l'isolation ; une empreinte qui diffère est refusée ; une version s'ajoute, l'ancienne reste ; le même plan deux fois ne fait pas de version ; supprimer efface le nom, le lien et la photo ; effacer un client emporte ses dossiers ; chaque réserve est dans le PDF (un contrôle qui sait rougir) |
| niveau | 3 (`drizzle/`). La batterie sur son « oui », puis `main` |
| à corriger dans le même lot | `ARCHITECTURE.md` « Rien n'est enregistré », l'en-tête de `actions.ts` de l’outil, le tableau des durées de `docs/RGPD.md` |

---

## 6. Ce qui reste ouvert, et qui le tranche

| | qui |
|---|---|
| les cinq questions | lui |
| la durée de garde du calcul après suppression, et son écriture dans les conditions générales | lui, avec le juriste |
| la planche sur Safari | lui, sur son iPhone |
