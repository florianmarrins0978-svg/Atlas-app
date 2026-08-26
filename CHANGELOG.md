# Historique des changements qui comptent

Ce qui a changé, et **ce que ça évite**. Les corrections de forme et les
ajustements de test ne figurent pas ici : `git log` les porte déjà.

Format : le plus récent en tête.

---

## 2026-08-26

### L'envoi du devis : trois phrases de moins

*« Supprime la phrase par SMS au + repris de votre dictée + le client pourra
aussi en proposer une. »*

Partent aussi leurs variantes, qui ne se montraient que dans d'autres états — il
les aurait rencontrées demain. Une seule ligne reste sous la molette, la seule
qui apprenne quelque chose : un chantier long réserve plusieurs jours d'affilée.

Ce qu'on perd, et c'est le même arbitrage qu'il a rendu le 24 août sur la
facture : il ne voit plus le canal ni le destinataire avant d'ouvrir sa
messagerie — laquelle les lui montre, et où il peut encore reculer.

Trois contrôles lisaient ces phrases. Ils éprouvent maintenant la règle : la
messagerie qui s'ouvre pour de bon, les deux dates listées, le sous-titre de
l'interrupteur qui suit l'interrupteur. Détail en `ARCHITECTURE.md` §194.
### Changer le rythme de la TVA fait enfin bouger l'écran

*« Quand je change entre tous les mois et tous les trois mois, c'est pareil,
rien ne se passe. »* Reproduit : l'écran gardait « Août 2026 » après le passage
au trimestre.

La base était bien écrite — le réglage revenait au rechargement suivant. Ce qui
manquait est la **revalidation** : le routeur reservait sa copie en cache de la
page, sans appeler le serveur. `force-dynamic` ne protège pas de cela, et c'est
le piège — il fait recalculer le serveur à chaque demande, encore faut-il qu'une
demande parte.

**Aucun contrôle ne pouvait le voir** : tous passaient par Réglages puis
rouvraient le relevé par une navigation neuve, et une page rouverte est toujours
juste. Le cas ajouté rejoue SA séquence — basculer sans quitter l'écran — et a
été vu rouge avant d'être vert. `ARCHITECTURE.md` §193.


### Ses salariés se comptent à part de ses équipes — et ce sont leurs noms qu'on coche

**Sa réponse à la planche 97 : A.** Puis, en tranchant : *« il ne faut pas
changer la méthode d'affiliation des gars sur les chantiers — juste, au lieu que
ce soit les équipes, ce sera les noms qu'on affilie. On garde la même façon de
faire. »*

**Ce que ça débloque.** `entreprises.nombre_equipes` portait deux métiers : la
capacité du planning ET combien de noms se règlent. Un paysagiste à quatre
salariés qui ne mène qu'un chantier à la fois n'avait aucun moyen de le dire —
il devait choisir entre nommer ses gars et dire la vérité sur son planning.
`nombre_salaries` (migration 0067) porte désormais le second.

**Ce qui n'a pas bougé, parce qu'il l'a interdit** : la pastille sur la
demi-journée, la liste qui s'ouvre, les cases cochées une à une, « Terminé ».
Même action serveur, même table, même indépendance matin / après-midi. Seuls les
libellés changent — « Équipe A » a disparu, le repli est « Salarié 3 ».

**Le point délicat, et il est traité :** on coche désormais des GENS, et trois
gars peuvent tenir sur une entreprise à deux chantiers par jour. La charge est
donc plafonnée à la capacité (`equipesMobilisees`) — sans quoi un chantier à
trois gars fermerait à lui seul une journée qui en accepte deux, et l'écran
d'envoi refuserait au client des jours réellement libres. **À effectif égal, le
résultat est identique à celui d'avant** : c'est le cas de son entreprise, dont
le compteur a été repris du nombre d'équipes.

**Un artisan seul reste à zéro salarié**, et non un : sans cette ligne dans la
reprise, il aurait vu apparaître du jour au lendemain une case « Salarié 1 » à
cocher sur chacune de ses demi-journées.

**Aucune table n'a été créée** — la table `equipes` porte déjà un rang et un nom
facultatif, et il y écrit des prénoms depuis le 10 août : ces lignes SONT les
gars. Le renommage `equipes` → `salaries` est une tâche à part (`TODO.md`) :
vingt-trois fichiers, les politiques RLS et les contraintes, à ne pas mêler à un
changement de comportement.

`ARCHITECTURE.md` §192.

### Planche 97 — ses salariés, et ce qui remplit le planning

Sa demande : *« un curseur + ou − qui définit le nombre de salariés, et pouvoir
affilier des noms ; ceux-là permettront d'ajouter ces noms au chantier, et plus
les équipes A ou B. Néanmoins les équipes doivent toujours servir à définir le
remplissage du planning — 2 équipes = 2 chantiers par jour, ça ne bouge pas. »*

**Rien n'est codé dans `src/`** (`CLAUDE.md` §3 bis) : trois propositions
essayables, et il tranche.

**Ce que le code dit, et qui justifie sa demande.** `entreprise.nombreEquipes`
porte aujourd'hui DEUX responsabilités : la capacité du planning, et la fabrique
des libellés « Équipe A / B » (`src/lib/equipes.ts`, `libelleEquipe`). Il veut
les séparer — c'est juste : on peut avoir quatre salariés et ne mener qu'un
chantier à la fois.

**Ce que la planche rend touchable plutôt que d'affirmer.** Un curseur *à côté*
d'une liste de noms crée deux vérités sur la même question. En proposition A, on
monte le curseur à 5 sans taper de nom : l'écran annonce 5 salariés quand le
chantier n'en connaît que 3. C'est la seule raison de la proposition C, qui
supprime ce curseur et compte les noms — **et c'est son appel**, puisque c'est
lui qui l'a demandé.

Le curseur des **équipes** reste dans les trois, comme il l'a exigé.

**Le contrôle ouvre un navigateur, et il a trouvé un vrai défaut** : les
pastilles et les croix de la planche faisaient moins de 40 px. Corrigé à 44 —
il touche cet écran debout, avec un gant.

### Maquette : « Quand je reverse la TVA » — les deux phrases du relevé

*« Quand le client le paye / quand je met la facture. C'est pas clair, on
comprend rien. Qu'est-ce que ça signifie ? »* Puis : *« et lorsque je change
entre les deux, rien ne se passe, c'est normal ? »*

**La seconde question n'était PAS une panne, et le calcul est juste :** quand
toutes les factures d'un mois ont été payées dans le mois, les deux régimes
tombent sur le même chiffre. L'écart n'existe que sur une facture émise un mois
et encaissée le suivant — ou jamais payée.

Mais un écran qui ne bouge pas sans rien dire se lit comme une panne. La
planche porte donc deux réécritures des libellés — le verbe manquant est
« je reverse » — et **la ligne qui dit ce que le choix change sur le mois
affiché, y compris quand il n'y change rien.**

**Il a tranché le soir même : B, sans le tableau d'exemple** — et c'est
**codé**. L'écran porte maintenant un surtitre qui dit le geste, deux lignes qui
répondent à « et alors ? », et la phrase qui annonce ce que le choix change sur
le mois affiché.

**Sa première version a été refusée par son propre contrôle** : elle suivait le
doigt et devançait le grand chiffre pendant l'aller-retour avec le serveur —
deux montants qui se contredisaient une seconde. Elle nomme désormais les deux
régimes. Et la capture a montré un espace mangé par la compilation
(« 1 400,00 €dès l'envoi »), que rien n'aurait vu autrement.
`ARCHITECTURE.md` §195.

### « Sans date » disparaît quand rien n'attend de jour

**Sa question :** *« est-ce que la catégorie sans date a un réel besoin
d'exister ? »*, devant un planning où elle ne portait qu'un titre et
« Aucun chantier n'attend de jour ».

**Elle en a un, et il est unique :** c'est le seul endroit d'où un chantier
reçoit sa date — on touche un jour du calendrier, puis Matin, Après-midi ou
Journée sur un chantier de cette liste. Et « Retirer » un chantier planifié l'y
renvoie plutôt que de l'effacer. La supprimer coûterait le geste qui pose les
dates.

**Mais vide, elle n'est que du bruit** — un titre en capitales et un refus, au
milieu d'un écran qui porte déjà le calendrier, les journées, les retirés et
l'attente du client. C'est exactement sa règle du 23 août, celle qui a fait
disparaître « Ajouter un chantier » : *« lorsqu'aucun chantier n'attend de jour,
il ne faudrait pas que le bouton apparaisse, car il peut nous induire en
erreur »*. La phrase du cul-de-sac que ce bouton promettait, c'était celle-ci.

**Elle revient dès qu'un chantier attend un jour** — rien n'est retiré du
produit, seul l'affichage vide s'en va.

**Le contrôle vise l'ATTRIBUT, jamais le mot.** Chercher le texte « Sans date »
ferait rougir la suite le jour où il fait renommer la section — sur du code
juste, et pour une demande exaucée (`CLAUDE.md` §5 bis). Il compte
`[data-atlas="titre-sans-date"]` et `[data-atlas="ou-poser"]` dans l'état zéro
que la suite installe déjà pour le bouton. **Vu rougir** contre l'ancienne
disposition : « le titre "Sans date" reste sur un écran où rien n'attend de
jour ».

### L'accueil se range par date : le plus récent en haut

*« Je viens de recevoir un devis retourné, il devrait apparaître en premier.
L'ordre doit être dernier arrivé en tête de liste. Le plus récent en haut. »*
Sur sa capture, la nouvelle du jour était **deuxième**, sous un rappel vieux de
treize jours.

**Ce que ça évite :** chercher ce qui vient d'arriver au milieu d'une liste dont
l'ordre ne s'explique pas. Rien ne pouvait le lui expliquer — l'ordre se
décidait par SORTE de carte, jamais par date.

**Ce que ça remplace, et c'est assumé :** son arrangement du 16 août — les
rappels devant, une place garantie aux réponses de clients. Il répondait à une
vraie crainte, trois chantiers sans devis masquant toutes les réponses. **La
date répond à la même crainte et mieux :** une réponse qui vient d'arriver est
la plus récente, donc la première, sans qu'aucune place ait à être réservée. Ce
qu'un tressage obtenait par une exception, l'ordre chronologique l'obtient par
la règle — et il s'explique en une phrase.

**Ce que ça coûte, éprouvé plutôt que supposé :** une réponse ancienne et non
acquittée peut désormais passer derrière des rappels plus frais.

Chaque carte porte l'instant où elle est apparue — pour une réponse, le moment
où le client a répondu ; pour un lien expiré, l'expiration et non l'envoi. Cette
date range, elle ne s'affiche pas.

Les deux contrôles qui exigeaient l'ancien ordre ont été **réécrits, pas
contournés** : une suite qui réclame ce qu'il a fait retirer rend son écran
impossible à changer. `ARCHITECTURE.md` §196.


### « Mon compte » : quarante mots de moins

*« Supprime la phrase sous enregistrer »*, *« supprime ce compte sous compte
démo »*, et sur les deux lignes grises : *« elles sont beaucoup beaucoup trop
longues pour rien »*.

Trois sont parties — « Ce compte », la phrase sous le nom, et les quatre lignes
qui expliquaient l'absence de champ téléphone (elles vivaient sous le bouton,
donc à moitié cachées).

**Une a été gardée, raccourcie de 40 mots à 7 :** celle de l'e-mail. Un champ
qui ne s'ouvre pas quand on le touche se lit comme une panne — sans elle, il
appuierait et chercherait ce qu'il a mal fait. Le pourquoi, lui, a quitté
l'écran pour `ARCHITECTURE.md` §190.

La décision du téléphone n'a pas bougé : aucun champ ici, et le contrôle le
refuse toujours. Ce que ce lot change, c'est qu'il refuse désormais aussi le
RETOUR des phrases retirées, au lieu de les exiger.

### Le port du banc s'ouvre quand le serveur répond, plus avant lui

*« Problème pas de port connecté »*, capture de son onglet PORTS à l'appui. Sa
fiche portait le mot exact : *« error updating port 3000 to public: error getting
tunnel port: […] 404 Not Found »*.

**Le relais ne connaissait pas encore le port.** `demarrer.sh` en demandait
l'ouverture juste après avoir posé le veilleur — dont la construction dure des
minutes. Au moment de la demande, **rien n'écoutait sur 3000** : GitHub n'avait
aucun port à rendre public, et répondait 404. Le serveur démarrait ensuite, le
port se déclarait tout seul… **et restait privé**, parce que plus rien ne
redemandait.

**Ce que ça évite :** GitHub qui sert sa page de connexion à la place d'Atlas.
Depuis son téléphone, non connecté, il n'y a alors rien à voir — c'est le
symptôme du 10 août, sous une autre cause.

**Une tentative unique au démarrage avait lieu au seul moment où elle ne pouvait
pas aboutir.** Le veilleur redemande donc là où il sait que le serveur répond,
donc que le port existe ; une fois obtenu, il n'y revient plus — `gh` interroge
le réseau, et l'appeler tous les quarts de minute userait un quota sans rien
apprendre. La fiche est mise à jour du même geste, sans quoi elle annoncerait
encore le refus et l'enverrait réparer ce qui marche.

Le contrôle a été vu rouge en retirant l'appel.

### Une règle de plus dans `CLAUDE.md` : ne rien jouer à la main pendant la batterie

**Cinq suites navigateur rouges d'un coup, et l'étape « Connexion derrière un
proxy » avec elles. Aucune n'avait de défaut.**

`nettoyerBase()` vide la base — c'est ce que fait toute suite base. Jouée en
parallèle d'une batterie, elle fait disparaître le jeu de démonstration sous les
pieds des suites navigateur, qui accusent alors le produit : « Timeout » sur des
adresses de chantiers évaporés.

**Le message juste existait, et il arrivait trop tard** : « le compte de
démonstration est absent : la base n'est pas amorcée » n'est écrit qu'à la
DERNIÈRE étape. Les quatre suites tombées avant lui ne nommaient que le
symptôme.

**Vérifié plutôt que supposé**, et c'est ce qui permet de l'écrire : les cinq
suites et la connexion derrière proxy sont vertes rejouées sur une base fraîche.

La batterie est une machine à un seul occupant : on la lance, et on attend.

### Les filets à côté des intertitres partent, les séparateurs restent

*« Ça aussi tu peux retirer »*, capture de l'écran Équipe à l'appui — le filet
qui partait du mot et filait jusqu'au bord : « QUI A ACCÈS ————— ». Et dans le
même souffle : *« ceux qui séparent les blocs, laisse-les »*.

Les deux se ressemblent et ne disent pas la même chose. Un séparateur porte une
information — deux choses sont distinctes. Le filet d'intertitre n'ornait qu'un
mot. Le contrôle ne traque donc que la seconde forme, reconnue à ce qui la
caractérise : un filet d'un pixel qui prend la place restante (`flex-1`). Vu
rouge contre un filet remis, et vert avec les séparateurs en place.

**Et une fausse alerte, corrigée avant de coder quoi que ce soit.** Je lui avais
signalé que la barre du bas recouvrait un paragraphe de cet écran : c'était un
artefact de ma capture. Une capture *pleine page* dessine les éléments fixés à
leur place d'écran, donc au milieu d'une longue page. Mesuré pour de bon —
déroulé jusqu'en bas, `bottom` du texte contre `top` de la barre — **rien n'est
recouvert**. Le piège est écrit dans `HANDOVER.md` : c'est la deuxième fois
aujourd'hui qu'il trompe.

### Un choix fait par erreur se défait

*« Si par erreur j'ai sélectionné un des 3 champs je ne peux plus le
désélectionner ! Faut corriger ça, je dois pouvoir désélectionner. »*

Sur la page que reçoit son client, un second appui sur la date déjà cochée la
**défait** maintenant, et rien ne se coche à la place. Cela vaut aussi pour
« une autre date », dont le calendrier se referme.

Ce n'était pas le produit : un bouton radio ne se décoche pas, par
construction — le navigateur ne connaît que « passer de l'un à l'autre ». Le
client qui touchait la mauvaise ligne restait engagé sur une date qu'il n'avait
pas choisie, et c'est le jour où l'artisan se déplace.

Le contrôle qui le garde (`test-devis-client-e2e.ts`) a été vu rouge contre la
version d'avant. Il tient surtout ce qui empêche la correction d'aller trop
loin : **un appui sur une autre ligne choisit toujours** — défaire à chaque
appui rendrait le formulaire inutilisable —, et la case de rétractation s'en va
avec la date qui l'a fait naître. `ARCHITECTURE.md` §191.


### Le numéro de ses documents se choisit — et le millésime n'est plus écrit en dur

*« Dans la catégorie facture il faut rajouter le format de numéro, c'est
obligatoire il me semble. »* Puis, devant la planche : *« garde le F »*,
*« 6 chiffres »*, *« oui remettre à 0 chaque début d'année »*, *« l'utilisateur
peut choisir entre ces 5 façons ? Si oui code ça »*.

**Ce qui existe maintenant.** Réglages → Devis & factures → « Le numéro de mes
documents » : cinq formats, chacun montrant ce qu'il donne, et le changement
s'enregistre seul.

| Format | Le prochain devis | La prochaine facture |
|---|---|---|
| Année et 4 chiffres | 2026-0012 | F2026-0012 |
| **Année et 6 chiffres** (défaut) | 2026-000012 | F2026-000012 |
| Année courte | 26-0012 | F26-0012 |
| Année, mois, numéro | 2026-08-012 | F2026-08-012 |
| Une suite sans année | 0012 | F0012 |

**Le compteur repart à 1 le 1ᵉʳ janvier**, sauf sur « une suite sans année » —
sinon deux documents porteraient le même numéro à un an d'écart, ce que la loi
interdit. L'écran le dit au lieu d'en faire un second réglage.

**CE QUI ÉTAIT CASSÉ, et qu'aucune suite ne voyait.** Le millésime était écrit
en dur dans le dépôt : `2026-…` pour les devis, `F2026-…` pour les factures.
**En janvier 2027, ses factures auraient encore dit 2026** — un défaut à
retardement, invisible tant qu'on teste aujourd'hui, et qui ne serait apparu que
sur un document déjà parti chez un client.

**Ce que le changement ne fait pas :** il ne renumérote rien. Les documents déjà
émis gardent leur numéro — les réécrire creuserait un trou dans la suite.

**Éprouvé** par `test-numero-documents.ts` (la règle, 10 cas),
`test-numero-documents-db.ts` (le compteur et sa remise à zéro au 1ᵉʳ janvier,
9 cas, dont deux factures émises à la même seconde) et
`test-format-numero-e2e.ts` (le fil entier : il choisit, et le devis suivant
porte le format choisi).

### L'assistant redevient le seul outil du patron

*« Les salariés et commerciaux ne doivent pas avoir accès à l'assistant IA. »*

Ouvert aux commerciaux plus tôt dans la journée, sur sa réponse d'alors. Il a
refermé le soir même, et **son dernier mot revient au premier** — celui du
25 août : *« seulement le principal »*.

**La règle a cessé d'en suivre une autre**, et c'est le vrai changement :
`peutUtiliserLAssistant` appelait `peutVoirLesMontants`, ce qui était juste tant
que les deux disaient la même chose. Elles disent maintenant deux choses
différentes. Garder l'appel aurait été pire qu'une erreur — le jour où quelqu'un
élargirait la règle des montants, l'assistant se serait rouvert **en silence**.

**Et la différence n'est pas le prix, c'est la portée.** Un commercial voit les
montants écran par écran, c'est son métier. L'assistant, lui, parcourt
l'entreprise entière et répond en une phrase.

Les trois états de la décision sont écrits dans `ARCHITECTURE.md` §181, avec
leurs dates : une décision dont on ne garde que le dernier état se repose trois
mois plus tard.

### Face ID marche enfin derrière son tunnel — et le bouton du mot de passe remonte

*« Le Face ID ne fonctionne pas »*, capture à l'appui — et *« le bouton changer
mon mdp doit se trouver au-dessus de ouvrir avec Face ID »*.

Atlas enregistrait les clés sous le domaine « localhost » : derrière la
redirection de port de son espace, le serveur ne voit que ça, et une clé posée
pour un domaine ne s'ouvre nulle part ailleurs. L'écran transmet désormais
l'adresse de sa barre d'adresse, comme pour le lien du client (§177) — et
seulement là où l'en-tête est local, jamais en production.

En rendant la panne bavarde, deux défauts de plus sont sortis : le message des
Réglages demandait d'entrer un mot de passe sur un écran où l'on est déjà entré,
et la porte prenait une RÉUSSITE pour une panne — une action qui redirige le
fait en levant, et cette levée tombait dans le filet à erreurs.

Le bouton du mot de passe quitte la barre fixe du bas et rejoint ses champs. Le
contrôle compare deux ordonnées plutôt qu'un libellé.

Ce que ça évite : un raccourci qu'il ne peut pas allumer, et un message rouge
au moment exact où il entre. `ARCHITECTURE.md` §186 et §187.

**Non vérifié ici, et il faut le dire :** que Face ID s'ouvre sur SON iPhone
derrière SON tunnel. Cet environnement n'a ni visage ni tunnel — la règle du
domaine et le parcours entier sont éprouvés, l'ouverture réelle se prouve chez
lui.

### L'assistant devient un agent : dix gestes de plus, et un périmètre fermé

*« Je veux que ce soit un vrai agent IA avec toutes les capacités possibles et
imaginables sur l'appli »*, et *« seulement pour l'appli : si on lui demande
est-ce que le CGR de Mantes est ouvert, il ne doit pas y répondre »*.

**Il sait désormais préparer** : créer un chantier, corriger une fiche client,
changer l'adresse d'un chantier, y laisser une note, le poser au planning, l'y
déplacer, l'en retirer, créer et corriger un tarif, préparer une facture. Et il
sait enfin CHERCHER une cible — chantier, client, planning —, là où il ne
connaissait que le chantier ouvert.

**Tout reste une proposition qu'il coche.** Sa réponse du 26 août à la seule
question posée : *« il ne doit pas pouvoir le faire, très important que ça reste
le doigt du patron »*. Rien en direct, pas même un numéro de téléphone. Et trois
gestes ne sont jamais les siens : envoyer, valider, émettre.

**Le hors-sujet est refusé AVANT le modèle**, pas seulement dans sa consigne :
une consigne se contourne et ne se vérifie pas. Le filtre ne refuse que si la
question porte une marque franche du dehors ET aucun mot d'Atlas — sans quoi il
ferait taire l'assistant devant « j'ai un chantier au cinéma de Mantes ». Un
garde-fou qui parle à tort s'apprend à être ignoré.

**Et un défaut trouvé à l'image, pas par un test :** depuis l'accueil, « crée un
chantier pour Madame Lucie » répondait « Aucun chantier dans le contexte
courant » — alors que créer un chantier n'en demande aucun. Le bouton
« Appliquer » restait inerte par la même occasion.

**Deux sessions travaillaient sur l'agent le même jour.** À la fusion : leur
recherche de chantier a été gardée (elle emploie la règle de l'écran), et leur
outil qui CRÉAIT une fiche tout seul est devenu une proposition — les deux
règles qu'il portait, reprises telles quelles.

Détail : `ARCHITECTURE.md` §188.

### Le filet d'intertitre était revenu sur l'écran des accès

*« Ça aussi tu peux retirer »* (25 août) : le trait qui part du mot et file
jusqu'au bord. Il est réapparu le lendemain sur « Son rôle », un écran neuf.
`test-accueil-en-tete.ts` l'a repris tout seul — c'est exactement pourquoi ce
contrôle existe. Les séparateurs de blocs, eux, restent : *« ceux qui séparent
les blocs, laisse-les »*.

### L'en-tête inversé : le titre d'abord, le surtitre doré en dessous

*« Sur plusieurs catégories le titre était en dessous du sous-titre en doré,
inversez-les »* — puis, sans ambiguïté : *« partout »*.

La grammaire du 10 août posait l'accroche dorée AU-DESSUS du titre. Il la veut
SOUS le titre, là où on lit un sous-titre. Comme l'en-tête est une seule pièce
partagée (`EnTeteEcran`), le changement se propage à tous les écrans d'un coup —
c'est ce qu'il demande. Sur la fiche de chantier, le statut (porté par le
surtitre) passe donc sous le nom du chantier ; la précision « avant » (le client,
en serif gris) reste au-dessus, elle, comme sa maquette du 11 août.

Regardé à l'image (Paysage et un chantier), et le garde-fou d'alignement du
bouton d'assistant (`test-assistant-en-tete-e2e`) reste vert : la pastille tient
toujours sur la ligne du titre.

### « Donner un accès » prend un écran à lui seul — sa réponse « B »

*« B, tu peux coder »*, le 26 août 2026, sur `appli/donner-un-acces.html`.

| Sa remarque | Ce qui a changé |
|---|---|
| le mot de passe s'écrivait une fois, à l'aveugle | **deux saisies, un œil sur chacune** — et la seconde est vérifiée **au serveur**, pas seulement à l'écran |
| *« la case est déjà noire comme la catégorie salarié »* | le rôle choisi est **teinté avec un coche** ; le seul aplat plein de l'écran est le bouton qui crée le compte |
| *« la démarcation […] n'est pas bien séparée »* | le formulaire **quitte la liste** : `/reglages/equipe/nouveau`, un écran d'où sa propre ligne a disparu |

**La règle du mot de passe n'a pas été réécrite** : `verifierNouveauMotDePasse`
la porte depuis le 14 août pour « Mon compte », et les deux écrans la partagent.
La redire ici en aurait fait la seconde — et le jour où la barre passerait de
douze à quatorze caractères, un des deux l'aurait ignorée.

**Les pastilles de rôle sont dessinées UNE fois** (`ChoixRole.tsx`) et servent
aux deux endroits : l'écran de création, et la fiche d'une personne déjà là.
Deux rédactions auraient ramené le défaut par la moitié de l'écran qu'on aurait
oubliée — c'est d'ailleurs ce que le contrôle a vérifié.

**`test-nouveau-compte-e2e.ts` MESURE sa remarque** plutôt que de lire un
libellé : il compare le fond de la pastille cochée à celui du bouton et exige
qu'ils diffèrent. **Vu rouge** en remettant l'aplat plein — et il rougit sur les
deux écrans à la fois.

---

### Donner un accès : une planche, avant de retoucher l'écran

**Ses trois reproches, capture à l'appui, sur l'écran livré le matin même :**
l'œil et la double saisie du mot de passe manquaient ; *« pour valider un compte
c'est pas clair, la case est déjà noire comme la catégorie salarié »* ; *« la
démarcation entre vous patron et le compte qu'on est en train d'attribuer n'est
pas bien séparée »*.

**Les trois ont la même racine**, et c'est ce qui rend la correction simple : le
formulaire du compte NEUF avait été posé dans la liste des comptes EXISTANTS,
sans rien pour dire où l'un finit et où l'autre commence.

Deux séparations proposées, **et rien n'est codé** (`CLAUDE.md` §3 bis) :
`appli/donner-un-acces.html` — **A** une carte posée sur la liste, **B** un écran
à lui seul. L'œil et la double saisie sont recopiés de l'écran qu'il a arrêté le
14 août, jamais réinventés. Le rôle choisi devient teinté avec un coche : la
charte le disait déjà — le plein porte ce qu'on FAIT, et le seul bouton plein de
l'écran redevient celui qui crée le compte.

**Un défaut trouvé en regardant la planche**, avant de la lui donner : le
périmètre affiché ne suivait pas le rôle coché, si bien qu'on lisait « le
planning et rien d'autre » sous « Commercial ». Une maquette qui ment sur ce que
fait un rôle est pire qu'une maquette absente.

### La liste, dans Paysage — deux emplacements à choisir

Sa proposition, une fois la planche des deux fiches comprise : *« est-ce qu'on
peut la déplacer dans la fiche de chantier, dans la catégorie Paysage, sous une
rubrique type "création des rubriques de ma fiche de chantier" ? Et comme ça on
ne la voit plus dans la catégorie Réglages. »*

Il a raison sur le fond : l'outil est mieux là où il sert, et l'écran de Paysage
sait **déjà** que seul le patron peut y toucher (`estProprietaire`) — la réserve
ne se perd donc pas au passage. Restent deux façons de le poser, et elles ne se
valent pas : **sur l'écran** (tout se voit, mais les rapports envoyés passent
au-dessus de vingt lignes qu'il touche deux fois par an) ou **derrière une
porte** (l'écran reste court, un appui de plus). Chacune porte son défaut écrit
sous elle.

`appli/ma-fiche-rangee.html`. Rien n'est codé dans `src/` (§3 bis) : il tranche
d'abord.

### Les deux fiches, côte à côte — une maquette pour trancher

*« La fiche d'entretien c'est la fiche de chantier »*, puis *« ressors-moi les
deux pages côte à côte dans une maquette dynamique que je comprenne bien »*.

Ce ne sont pas deux fois le même écran : à gauche **la liste** (Réglages), à
droite **la fiche d'un jour** (Paysage), qui en naît. Supprimer la première
laisserait la seconde sans rien à cocher — elle refuse d'ailleurs de s'ouvrir
sur une liste vide. Un troisième objet porte le même nom, et il fallait le dire :
le **PDF « Fiche de chantier »**, le devis sans les prix.

`appli/deux-fiches.html`, trois onglets sans une ligne de JavaScript : les deux
écrans, ce qui les relie, et ce qu'un renommage changerait. Les vingt
prestations sont **celles du code** — `verifier-maquette-deux-fiches.mjs` refuse
la moindre invention, et il a été joué rouge contre une prestation inventée puis
contre un script glissé dans la page.

**La question qui reste pour lui :** renommer celle des Réglages en « Les
prestations de ma fiche ». Rien n'a été codé avant sa réponse.

---

## 2026-08-25

### Un septième contrôle, et la leçon qui vaut pour tous

`test-lecons-prix-e2e` guettait la réponse HTTP de l'action serveur. Son délai
avait déjà été relevé de 30 à 60 secondes le matin même, pour la même raison ;
sous la batterie entière, soixante ne suffisaient pas non plus.

**Quatre-vingt-dix n'auraient fait que repousser le mur.** Une attente calée sur
la vitesse de la machine finit toujours par mesurer la machine — et le rouge
qu'elle produit accuse un produit sain.

Ce que la suite veut savoir n'est pas qu'une requête est passée : c'est que le
prix est en base, car c'est cela seul qui apprend quelque chose à l'agent. Elle
regarde donc la base, et l'échec dit ce qu'elle portait vraiment (« lu :
1400.00 »). Confrontée à un prix qui n'arrive jamais, elle rougit.

**Sept contrôles réparés en une journée, aucun défaut de produit derrière.**
Deux cassaient à minuit, trois lisaient trop tôt, un exigeait un état fugace, un
guettait le réseau au lieu du résultat. Le fil commun tient en une phrase :
*ils mesuraient un instant, ou une vitesse, plutôt qu'un état.*


### Ses journées se comptaient à Greenwich

*« Ce soir à 00 h 00 il passe dans Terminés ? »* — non : à **2 h du matin**. Le
jour d'Atlas était le jour UTC, et la France est à UTC+2 l'été. Entre minuit et
deux heures, un chantier fini restait au planning, une facture faite en rentrant
portait la date d'hier, et le calendrier marquait le mauvais jour comme
« aujourd'hui ». Deux heures, mais précisément celles où un artisan range ses
papiers.

Une seule fonction change (`jourIso`, `src/lib/jour.ts`), et tout suit : onglets,
dates d'émission et d'échéance, relevé de TVA, calendrier. Elle passe par `Intl`
sur `Europe/Paris` — un `+2` figé se serait trompé la moitié de l'année.

Le contrôle prend l'été et l'hiver, des deux côtés de minuit, et a été **joué
rouge** contre l'ancienne version. `ARCHITECTURE.md` §182.

**Trois suites qui dépendaient du jour où on les jouait.** Deux posaient leurs
dates avec `CURRENT_DATE` — le jour de PostgreSQL, en UTC — et divergeaient donc
de l'écran pendant ces deux heures ; une troisième lisait le calendrier du mois
COURANT, si bien qu'en fin de mois il n'y restait plus assez de jours ouvrables
et qu'elle accusait le produit. Elles lisent maintenant la même définition du
jour que l'application, et tournent la page du mois quand il le faut. Aucune ne
mesurait un vrai défaut : c'est le pire des rouges, celui qui accuse à tort.

### Plus aucun trait sous les titres, et le texte des données raccourci

*« Souvent sous les titres il y avait un trait comme celui-là, supprime tous les
traits sous les titres »*, capture de « Sécurité & données » à l'appui.

Il l'avait déjà fait retirer de l'accueil la veille. Le trait vivait en réalité
dans l'**en-tête partagé**, allumé par défaut : il paraissait donc sur chaque
écran qui l'emploie. Retiré une fois, il disparaît partout — et le réglage qui
permettait de le rallumer écran par écran a disparu avec, sans quoi il serait
revenu par la porte de service.

*« Le texte sous télécharger est beaucoup beaucoup trop long, synthétise-le. »*
Cinq lignes deviennent deux. **Gardé :** que le fichier s'ouvre sans Atlas — c'est
ce qui en fait une copie de secours et non un objet captif —, et qu'il porte les
coordonnées de ses clients, ce qui l'oblige à le ranger et ne se devine pas.
**Parti :** l'inventaire de ce que le fichier contient, qu'il verra en l'ouvrant,
et l'explication d'une sauvegarde automatique qui n'existe pas encore — un écran
n'a pas à expliquer ce qu'il ne fait pas.

Le contrôle des en-têtes couvre désormais la pièce partagée, et il a été vu rouge
contre le trait remis en place.



### Trois rôles, trois sessions — et le refus est au serveur

*« Je voudrais que l'utilisateur principal puisse donner accès qu'au planning à
ses salariés […] chaque utilisateur possède son propre compte et sa propre
session. Les restrictions d'accès doivent être appliquées côté serveur, et pas
uniquement en masquant des boutons ou des pages. »*

**Ce qui existe maintenant.** Réglages → Équipe → « Qui a accès » : le patron
crée un compte (nom, adresse, mot de passe, rôle), change un rôle, règle ce qu'un
salarié voit du planning, retire un accès. Chaque personne ouvre sa propre
session.

| | Ce qu'il atteint |
|---|---|
| **Patron** | tout Atlas |
| **Commercial** | toute l'application, sauf la mise en page des devis, l'identité de l'entreprise, les accès, l'abonnement et l'export |
| **Salarié** | le planning, sa feuille de chantier sans un seul montant, et ses propres réglages |

**Et le refus est au serveur, aux trois endroits qui comptent** — les écrans
(`GardeAcces`, dans la mise en page racine), les routes d'API
(`exigerOuverture`), les actions (`exigerProprietaire`). Ce qu'un rôle n'atteint
pas ne sort pas de la base : ni dans la page, ni dans le PDF, ni dans une réponse
d'API.

**Ce qui a été trouvé en le faisant.** La base ne connaissait que
`proprietaire` et `membre`, et `membre` ne restreignait rien : l'application
*avait l'air* cloisonnée — le sommaire des réglages cachait des rubriques —
pendant qu'un compte non propriétaire atteignait tous les écrans sauf quatre.
`membre` devient `salarie`, le plus fermé des trois.

**Trois défauts trouvés EN REGARDANT l'écran, qu'aucun test vert ne voyait :**

1. **un salarié qui se connectait voyait une page BLANCHE.** L'adresse affichait
   bien `/planning` — la suite navigateur la lisait et passait au vert — mais la
   page rendue était le « 404 » de Next : 9 540 octets au lieu de 61 208, aucun
   onglet. Cause : deux renvois enchaînés (`/` puis la garde de rôle) dans la
   réponse d'une action serveur. Chacun entre désormais directement chez lui ;
2. **l'assistant restait ouvert au salarié** — et il reconstitue au serveur les
   chantiers, les clients et les PRIX. Tout ce que les rôles ferment se serait
   rouvert en le DEMANDANT. Refusé au serveur, et le bouton ne s'affiche plus ;
3. **le lien « Relier mon agenda Google »** s'affichait sur son planning et le
   renvoyait à son planning. Un renvoi sans explication se lit comme une panne.

**Ce qui reste ouvert :** un commercial ne lit pas encore les tarifs, alors que
la règle du 13 août dit qu'il les lit sans les changer. Détail dans `TODO.md`.

Détail et raisons : `ARCHITECTURE.md` §180 ; la règle, `docs/QUESTIONS.md` §10.

### Plus une seule flèche décorative dans les écrans

**Complété le soir même, à sa demande :** *« fais-moi une photo de chaque flèche
que tu as supprimée, parce qu'il y a des flèches qui servent à faire des retours
ou ouvrir des pages »*. La planche `appli/fleches-retirees.html` montre chaque
libellé en photo, pris sur l'application qui tourne, séparé en deux : ceux qui
étaient sur un bouton, et ceux qui étaient au bout d'un lien qui ouvre une page
— c'est lui qui tranche sur les seconds. Ce qui n'a pas été touché y est listé
aussi. Sept libellés n'ont pas pu être photographiés (leur écran ne s'atteint
pas depuis ce banc) : la planche le DIT, plutôt que de les taire.

*« Retire la flèche ! Il m'avait semblé t'avoir demandé de supprimer toutes les
flèches de l'application ! »* — capture à l'appui, devant « Créer la facture → ».

La règle datait du matin même ; vingt-huit libellés en portaient encore une le
soir. Elles sont parties partout : boutons, liens, chemins de navigation écrits
dans une phrase, légende du plan d'arrosage.

Restent celles qui FONT quelque chose — feuilletage des calendriers, période de
TVA précédente et suivante, « ← Aujourd'hui », le rond d'envoi de la discussion,
et le « 250 € → 350 € » d'une correction de devis, où la flèche porte le sens.

Ce que ça évite : qu'elles reviennent une troisième fois.
`scripts/test-aucune-fleche.ts` les refuse, chaque flèche gardée y étant
déclarée avec sa raison. Détail en `ARCHITECTURE.md` §179.

### Savoir ce que l'application a coûté en temps — `scripts/compter-heures.mjs`

*« Combien d'heures avons-nous passé à créer cette application ? »* — puis, la
réponse donnée : *« on a commencé avant le 10 août »*. Il avait raison.

Le premier commit du dépôt est **un écrasement** (684 fichiers, 129 867 lignes
d'un coup) : `git log` fait donc commencer le projet le 10 août, onze jours trop
tard. Le nouveau script mesure ce qui est horodaté et **estime** le reste par
trois règles de trois indépendantes, qu'il affiche toutes plutôt que d'en
moyenner une quatrième, fausse et rassurante.

Ce que ça évite : un chiffre recopié à la main dans un document, qui serait faux
au commit suivant et dont personne ne saurait dire d'où il sort. Le piège de
datation est écrit en `ARCHITECTURE.md` §178 ; la réponse en langage courant en
`docs/QUESTIONS.md` §26.

### L'assistant explique l'application, et reprend une ligne chez un autre client

*« J'aimerais que l'assistant qui se trouve dans l'application puisse expliquer
chaque fonctionnalité de l'appli »*, avec son exemple : *« comment je fais pour
supprimer un client en attente de rédaction de son devis sur la page chantier »*
→ *« slide de droite à gauche puis appuie sur retire »*.

**Ce que ça évite.** Un modèle qui n'a pas l'écran sous les yeux invente un geste
plausible ; l'artisan le cherche cinq minutes avant de conclure que
l'application est cassée. Le mode d'emploi est donc **écrit**
(`src/lib/mode-emploi.ts`, une soixantaine de fiches), l'assistant le récite
sans le reformuler, et **il dit qu'il ne sait pas** quand il ne trouve rien.

**Chaque fiche se prouve contre le code** : elle porte son fichier source et des
morceaux de texte qui doivent s'y trouver. Le contrôle a rougi à son premier
passage — une fiche annonçait un bouton « Connecter » pour l'agenda là où l'écran
dit « Relier mon agenda Google ».

**Et un défaut trouvé à l'image, pas par un test :** la réponse enchaînait les
trois fiches trouvées — trois gestes pour une question. Une seule sort désormais,
et un contrôle compte les titres.

**Un piège fermé au passage :** « comment je supprime un client ? » tombait dans
la branche des suppressions — l'assistant allait lire les prestations et
proposait d'en retirer une. Il demandait un geste, on lui modifiait ses données.

**Et il va chercher une ligne chez n'importe quel client** pour la poser sur le
devis ouvert. Le montant ne voyage jamais : la proposition ne porte que
l'identifiant de la ligne d'origine, et le prix est relu en base au moment de la
validation. La recherche est bornée par la RLS, pas par un filtre écrit à la
main.

**L'assistant n'est pas pour un salarié** — *« au service de l'utilisateur
principal seulement le principal »*. Il lit les tarifs, les marges et les devis
de tous les clients : ouvert à un salarié, il rendrait en une phrase ce que sa
feuille de chantier tait. La règle vit à un seul endroit
(`peutUtiliserLAssistant`, à côté des autres).

**Ouverte aux commerciaux le 26 dans la journée, REFERMÉE le soir même** —
*« les salariés et commerciaux ne doivent pas avoir accès à l'assistant IA »*.
Son dernier mot revient au premier, celui du 25 août. Les trois états sont
écrits dans `ARCHITECTURE.md` §181 : une décision dont on ne garde que le
dernier état se repose trois mois plus tard.

Détail : `ARCHITECTURE.md` §181.

### Deux contrôles réparés au passage, étrangers au lot

**Une bombe à retardement de calendrier.** `test-envoi-client-e2e` lisait le
seul mois AFFICHÉ, qui commence toujours au 1er : passé le 28, il ne reste plus
assez de jours au-delà du délai minimal, et la suite rougissait sur un produit
sain — chaque fin de mois. Vue rouge le 26 août, **à l'identique sur `main`**,
puis désamorcée : la suite tourne la page du mois quand celui-ci est trop court.

**Et un délai trop court** dans `test-lecons-prix-e2e` : trente secondes pour
une action serveur, ce qui passe seule et tombe sous la batterie entière. Porté
à soixante, comme les attentes d'écran de la même suite.

### La phrase grise sous « Envoyer la facture » a été retirée

*« Supprime le message en gris : votre messagerie s'ouvre aussitôt. »*

Elle avait sa raison le 22 août, quand les trois appuis sont devenus un : il
fallait dire que le geste ouvrait la messagerie sans rien envoyer. Depuis, il l'a
fait des dizaines de fois — la phrase n'apprenait plus rien, et poussait vers le
bas l'avertissement qui, lui, compte : la facture s'arrête et une correction
passerait par un avoir.

**Et deux pièges d'outillage écrits dans `HANDOVER.md`**, qui ont coûté une heure
à croire `main` cassé : une suite d'envoi lancée à la main sans
`ATLAS_URL_PUBLIQUE` voit une adresse locale et rougit sur du code juste ; et le
premier passage sur un écran le compile, ce qui peut dépasser le délai d'une
suite. Rejouée sur serveur chaud, elle passe.

### La facture du client : aux couleurs de l'app, et un bouton pour la garder

*« Mets cette page aux couleurs de l'application »* et *« il faut rajouter un
bouton pour que le client puisse télécharger sa facture »*, sur la page publique
que le client ouvre depuis son lien.

Elle portait des couleurs écrites en dur — dont une terre cuite (`#8C4A2F`)
abandonnée le 3 août — qui n'étaient plus celles du produit. Elle passe par les
jetons de la charte (`design-tokens`), qui retombent sur la charte d'Arborea par
défaut faute de session : c'est bien « la couleur de l'application », et plus
aucune couleur n'est écrite en clair (`CLAUDE.md` §3).

Et le client peut désormais **garder** sa facture : à côté de « Voir la facture en
PDF » (qui l'ouvre), un bouton « Télécharger ma facture » la range. C'est l'en-tête
`Content-Disposition: attachment` du `?telecharger=1` qui décide — l'attribut
`download` du lien ne suffit pas, iOS l'ignore —, le même mécanisme que l'écran du
patron.
### Le rapport repart chez le client : l'adresse venait du serveur, pas du navigateur

*Sa capture : « je ne peux pas l'envoyer au client », devant le refus posé la
veille — alors que sa barre d'adresse portait bien une adresse web.*

Le garde-fou du 24 août barre un lien qui ne mène qu'à sa machine, et il a
raison. Mais il jugeait l'adresse que le SERVEUR voit — et derrière le tunnel de
son espace de travail, le serveur ne voit que `localhost`. Il était donc bloqué
sur un lien parfaitement bon.

Le lien prend désormais l'adresse de sa barre d'adresse, la seule qui ne mente
jamais : c'est celle par laquelle il a ouvert Atlas, donc celle qui s'ouvrira
chez son client. **Le refus reste entier** — ouvert par la redirection de port
de son éditeur, le lien est barré comme avant, et un contrôle le tient.

Corrigé sur les quatre écrans qui envoient : la fiche de chantier, le devis
parti, la facture et son message tout prêt. Le refus ne s'affiche plus non plus
en double.

`ARCHITECTURE.md` §185.

---

### Le calendrier de fin de mois a fait rougir une TROISIÈME suite

Même mal que les deux du matin : le calendrier ouvre sur le mois en cours, et
passé le délai minimal il ne reste qu'un ou deux jours ouvrés en fin de mois.
`test-envoi-client-e2e` s'est arrêté sur « pas assez de jours » — sur un
calendrier parfaitement juste.

Elle appuie maintenant sur « Mois suivant », comme le patron le ferait sans y
penser, et seulement quand le mois courant est trop court : le reste du temps
elle continue d'éprouver le cas ordinaire. Une seule fonction porte la règle
pour les deux contrôles concernés.

**Ce défaut revient chaque mois.** Trois suites l'ont eu le même jour ; le
prochain qui verra « pas assez de jours » saura où regarder.


### L'assistant répond enfin depuis n'importe quel écran

*« Je veux pouvoir faire ça peu importe où je l'ouvre. »* Le panneau était déjà
sur tous les écrans ; ce sont ses outils qui ne suivaient pas. Cinq d'entre eux
refusaient dès qu'aucun chantier n'était ouvert — c'est-à-dire partout sauf sur
une fiche, là où il a déjà l'information sous les yeux.

Ils acceptent maintenant qu'on leur nomme un chantier, et le chantier ouvert
reste le défaut : l'usage d'avant ne bouge pas. Quand il n'y en a vraiment
aucun, le refus dit la suite à donner au lieu de renvoyer le patron ouvrir une
fiche lui-même. Détail : `ARCHITECTURE.md` §185.


### L'assistant ouvre une fiche chantier quand on le lui demande

*« Crée-moi une nouvelle fiche chantier du nom de Fernandez »* — il répondait
qu'il n'était pas en mesure de le faire et donnait trois étapes à suivre à la
main. C'est désormais la **seule écriture** qu'on lui accorde, et elle est
étroite : une fiche vide, pour un client, sans prix ni prestation ni envoi. Tout
le reste passe encore par une proposition qu'il confirme d'un doigt.

Le nom n'est pas inventé : dans Atlas un chantier ne se baptise pas, son
étiquette se déduit du client (sa règle du 5 août). Et le client existant est
repris plutôt que dupliqué — il dit « bernard » là où sa fiche porte
« Mr. Bernard ».

**Un doublon se refuse d'abord** : si ce client a déjà des chantiers, rien n'est
créé et l'assistant demande. Deux fiches pour un même jardin, ça ne se défait
plus. Détail : `ARCHITECTURE.md` §184.


### L'assistant retrouve un devis à partir d'un NOM, sans qu'on ouvre la fiche

*« Peux-tu me ressortir le premier devis de M. Bernard ? »* — il répondait qu'il
n'avait *« aucun chantier ouvert »* et renvoyait le patron ouvrir la fiche
lui-même. Tous ses outils partaient du chantier courant ; ouvert depuis la
liste, il n'avait aucun chemin entre un nom et un dossier. Il en a désormais un,
qui cherche dans le nom du client comme dans celui du chantier, avec la règle de
l'écran — casse, accents et ordre des mots ignorés.

**Et il affirmait une chose fausse :** *« Atlas conserve uniquement le dernier
devis par chantier »*. Un brouillon se réécrit, mais un devis envoyé est
conservé et le suivant devient une version 2. Ce n'est pas le modèle qui
inventait : l'outil lui rendait la dernière version sans jamais dire qu'il en
existait d'autres. Il annonce maintenant toutes les versions à chaque appel, et
sait rendre celle qu'on demande — « le premier » étant la version 1.

Éprouvé contre le décor exact de sa capture, un confrère au même nom compris ;
rejoué contre l'ancien outil, il rougit sur trois cas. Détail :
`ARCHITECTURE.md` §183.


### Le message : les phrases par défaut, modifiables — les mots en doré verrouillés

*« Le message au client doit comporter les phrases par défaut et l'utilisateur les
modifiera s'il le désire ; seuls les mots en doré ne peuvent être modifiés. »*

Le cadre du message n'est plus un `<textarea>` mais un vrai éditeur
(`EditeurMessage`) : il porte le message par défaut, en clair, et l'artisan modifie
ce qu'il veut — le bonjour, la formule de fin, ses propres phrases. Ce qu'Atlas
remplit tout seul — le prénom, la phrase du document (qui s'adapte au devis comme
à la facture), le lien, son nom — est posé **en doré et verrouillé** : on ne peut
ni le retaper, ni le couper.

**Le piège du champ « riche », désamorcé :** les retours à la ligne. Un
`contenteditable` laissé seul insère un `<div>` ou un `<br>` selon le navigateur,
et les deux se relisent mal. On intercepte donc Entrée pour poser un simple « \n »
de texte ; la relecture n'a plus qu'à concaténer texte et pastilles, et rend
EXACTEMENT le modèle. Une seule règle de découpe (`segmentsDuModele`) sert
l'éditeur et les aperçus : la concaténation des morceaux redonne le modèle
(éprouvé sans base), et le fil complet — de l'écran au téléphone du client — reste
tenu au navigateur (`test-message-au-client-e2e`).

### L'émetteur n'était sur le devis qu'une fois de trop

*« Pourquoi il y a deux fois l'émetteur sur l'aperçu ? »* — il avait raison, et
ce n'était pas une convention : l'en-tête portait déjà son identité, et un bloc
« ÉMETTEUR » la réécrivait mot pour mot dix centimètres plus bas. Les mentions
obligatoires doivent figurer, pas figurer deux fois. Le bloc du bas est retiré,
l'en-tête prend tout — nom, adresse, téléphone, e-mail, SIRET — et le client
passe à gauche, seul de sa rangée : une colonne « CLIENT » restée à droite avec
un vide en face se lit comme un bloc oublié à l'impression.

### Une ligne par information, en haut à gauche

*« Il y a un tiret entre le numéro de tél et l'adresse e-mail, change ça, il
faut sauter une ligne, une ligne par information. »* Le `join(" — ")` est parti :
adresse, téléphone, e-mail, SIRET prennent chacun leur ligne, et les absents ne
laissent pas de trou.

**Les deux en-têtes ont bougé ensemble** — le PDF (devis *et* facture, même
moteur) et l'écran où il rédige, qui compose le sien à la main. C'est la leçon
de la veille appliquée le lendemain : corriger un seul des deux recrée
exactement l'écart qui lui avait caché son logo.

Les contrôles ne se contentent plus de lire « CLIENT » : ils **refusent**
qu'« ÉMETTEUR » reparaisse et exigent que le nom de l'entreprise n'apparaisse
qu'une seule fois. Et l'image a été regardée, fond clair et fond sombre, logo
carré et logo en bandeau. `ARCHITECTURE.md` §174.

**Deux contrôles remis d'aplomb au passage.** L'empreinte au pixel du devis et
de la facture (`test-fiche-chantier-pdf.ts`) décrivait la mise en page qu'il a
fait retirer : elle a été relevée à neuf — après avoir REGARDÉ le document —, et
la suite affiche désormais l'empreinte lue quand elle diverge, pour qu'un
changement voulu ne demande plus d'instrumenter le fichier. Et
`test-devis-doublon-e2e.ts` attendait 800 ms fixes après l'enregistrement d'une
prestation : vert seul, rouge dans la batterie complète, en accusant « les
tarifs de démonstration » — le mauvais coupable. Il redemande maintenant la page
une fois avant de conclure.

### L'échéance de la facture : proposée, et modifiable avant l'envoi

*« Il faut qu'il propose une date par défaut et ensuite si l'utilisateur veut la
modifier qu'il puisse. Parce que si l'utilisateur envoie la facture avant de
modifier, faut qu'elle parte avec une date et pas avec [échéance]. »*

Deux choses en découlent :

- **La date par défaut suit désormais son délai de paiement réglé** (0 = comptant),
  30 jours à défaut — au lieu d'un « 30 » écrit en dur qui pouvait contredire la
  mention « Paiement à X jours » imprimée sur la pièce. La facture a donc
  **toujours** une vraie échéance dès sa création : elle ne part jamais avec un
  vide.
- **Elle se corrige à l'écran de la facture**, tant qu'elle n'est pas arrêtée. Une
  facture émise est partie chez le client et inscrite au relevé : sa date se fige
  alors (le champ disparaît, et `majEcheanceFacture` refuse quand même — l'écran
  n'est qu'une politesse, le dépôt est le garde-fou).

La saisie repasse par une règle pure (`src/lib/echeance-facture.ts`, éprouvée
sans base) : une échéance ne précède jamais la facture, ne dépasse pas un an (au-
delà, c'est l'année mal tapée), et le comptant — échéance = émission — est permis.
L'isolation est tenue par la RLS : la facture d'une autre entreprise n'existe tout
simplement pas pour cette requête (`test-factures`).

### Les cinq conditions réglées arrivent enfin sur le devis

*« Les autres qui sont en ON doivent-ils être visibles sur le devis ? car je ne
vois rien, est-ce normal ? »* — non. Depuis le 14 août, six conditions se
réglaient dans « Réglages → Documents » et **une seule atteignait le document** :
la validité. L'acompte, le délai de paiement, les moyens de paiement, le rappel
des pénalités et le texte de bas de page s'enregistraient, s'affichaient dans
l'aperçu de cet écran… et le client n'en voyait rien.

**Ce que ça évite :** un artisan qui règle un acompte de 30 %, le voit à l'écran,
et envoie un devis qui n'en parle pas. Il ne s'en aperçoit qu'au moment où le
client ne verse rien — ou jamais.

**Ce qui a caché le défaut onze jours**, et c'est le plus instructif : son écran
de devis affiche « Acompte de 30 % à la signature… » en gris, comme **exemple**
dans un champ libre vide, et « MODALITÉS DE PAIEMENT / IBAN » s'imprime pour de
bon. Deux choses vraies donnaient l'impression que le réglage marchait.

**Et pourquoi aucun test ne l'a vu :** une suite éprouvait déjà
`lignesConditionsDevis` — les bons réglages donnent les bonnes phrases — et elle
avait raison, la fonction n'a jamais été en cause. Ce qui manquait, c'est le
CHEMIN entre le réglage et le papier. *Un contrôle qui éprouve la règle ne voit
pas une pièce débranchée.*

Migration 0064 : les cinq conditions se **figent** sur le devis à sa création,
comme la validité — les relire à l'impression ferait changer ce qui engage un
devis déjà parti. **Aucun rattrapage sur les anciens** : ils ne portaient pas ces
lignes, les poser rétroactivement ajouterait des conditions à des documents déjà
chez des clients.

Elles s'écrivent sous « NOTES / CONDITIONS », **après** son texte à lui — ce
qu'il écrit parle de CE chantier, les conditions sont les mêmes partout. Son
champ libre n'est ni remplacé ni réécrit. Rien sur la feuille de chantier du
salarié : elle part sans un prix, et un acompte y serait un montant.

*« Si je décoche le bouton OFF, ils sont censés disparaître ? »* Oui — éprouvé,
et le contrôle a été vu rouge en débranchant le raccordement exprès. Trois
captures rendent les trois états en image, parce que ce défaut-là s'est vu à
l'œil et par aucun test. `ARCHITECTURE.md` §185.

### Un jour à moitié pris le dit : « Reste 1 équipe sur 2 »

*« Je peux proposer le 24 alors qu'un client a validé le 24 — corrige-moi ça ! »*
Le défaut de code avait été réparé le 22 août. Ce qui restait n'en était pas un :
avec deux équipes, un jour où une seule est prise **reste proposable**, et c'est
voulu — mais rien ne le disait, et rien ne distinguait un jour vide d'un jour à
moitié pris.

**Ce que ça évite :** proposer une date en croyant la journée entière, découvrir
sur place qu'une équipe est déjà ailleurs, et devoir rappeler le client.

**Le libellé n'est pas celui de la planche, et c'est lui qui l'a redressé** :
elle proposait « 1 chantier sur 2 équipes », il a répondu *« on ne comprend pas
très bien »*. Il avait raison — cela compte ce qui est PRIS quand ce qu'il décide
dépend de ce qui RESTE. La planche porte le nouveau libellé, et un contrôle
interdit aux deux de diverger : une planche qui n'annonce plus ce que l'écran
écrit lui fait valider une phrase qu'il ne verra jamais.

**Le pire des deux demi-journées commande.** Un matin plein et un après-midi
libre ne font pas « une équipe et demie » : il y a un moment de la journée où il
n'y a personne. La moyenne annoncerait de la place là où il n'y en a pas — la
faute exacte qu'il a signalée, sous une autre forme.

Rien ne s'écrit sur un jour entièrement libre, ni quand il n'a qu'une équipe : un
avertissement qui parle à tort s'apprend à être ignoré.

**Deux contrôles, et le second existe à cause du défaut du même jour** : la règle
est balayée pour toutes les combinaisons d'équipes prises sur n, et un second
parcourt le chemin entier — deux équipes en base, un chantier posé, la mention
lue à l'écran. *Un contrôle qui éprouve la règle ne voit pas une pièce
débranchée* : les cinq conditions du devis venaient de le prouver.

### L'aperçu du devis reste collé pendant qu'on le règle

*« Lorsque je modifie mon devis, je suis obligé de descendre pour voir les
modifications »* — trois rangements lui ont été montrés, il a répondu **B** :
l'aperçu reste sous les yeux pendant qu'on fait défiler les réglages.

**Ce que ça évite :** régler une police ou un fond à l'aveugle, puis remonter
pour voir, puis redescendre pour corriger. A — l'aperçu simplement remonté en
tête — ne réglait que la moitié du problème, et c'était écrit sur la planche.

Il colle au haut de la **rubrique**, pas de l'écran : collé à l'écran entier, il
aurait recouvert les conditions de paiement, qui n'ont rien à voir avec
l'apparence. Fond opaque : translucide, les réglages défilent au travers et l'on
ne juge plus une couleur de fond sur un fond qui bouge.

Le contrôle a été vu rouge en le remettant en A. A et B ne diffèrent que pendant
le DÉFILEMENT — un contrôle qui n'aurait pas descendu serait resté vert sur la
proposition qu'il a écartée.

### La molette du temps passé : sa demande décrivait ce qui existait déjà

*« La molette, mais avec d'un côté les heures qu'on peut bouger et de l'autre les
minutes qu'on peut bouger séparément. »* Dessiné le jour même — puis, la planche
livrée : *« la molette a déjà été codée, vérifie »*. **Il avait raison.**

`MoletteDuree` (`src/app/paysage/fiche/[id]/FicheChantierClient.tsx`) pose depuis
le 16 août **deux listes natives : les heures à gauche, les minutes à droite**,
chacune au doigt, au pas de cinq minutes. Sa demande décrivait exactement cela.

**La faute est du même genre que celle de la planche 56** — dessiner un écran qui
existe déjà —, et l'inverse de celle du 20 août, où l'on avait déclaré impossible
un travail à moitié fait. `CLAUDE.md` §5 ter le dit dans les deux sens :
*chercher avant d'affirmer*. Trente secondes de `grep -rn molette src/`.

**Et il a tranché dans la foulée : « je garde celle qui est présente. »** Les
molettes natives restent, rien n'est à coder. La question ne portait plus que sur
l'apparence — le geste était identique.

La planche le dit maintenant en toutes lettres, et un contrôle l'exige : une
planche qui annonce codé ce qui ne l'est pas, ou l'inverse, lui coûte un
aller-retour, et c'est ce qui venait d'arriver.

**Pourquoi il a raison.** D'un seul tenant, la molette compte cinquante-trois
crans de 0 h 00 à 4 h 00 : aller de 0 h 05 à 3 h 30 demande quarante et un crans,
donc plusieurs élans du pouce. Séparées, la même valeur se pose en deux gestes
courts. Et c'est le geste de la molette de son iPhone — l'argument qui lui avait
fait retenir la A le 16 août.

**Ce que ça coûte, et c'est écrit sur la planche :** deux gestes au lieu d'un sur
une durée ronde.

Un seul repère traverse les deux colonnes : un repère par colonne se lirait comme
deux réglages sans rapport, alors que c'est une seule durée. Toujours sans une
ligne de JavaScript.

**Et un chiffre faux a été retiré au passage** : l'écart affichait « − 50 min »
écrit en dur, qui ne suivait pas la molette — 2 h 35 sur 2 h 30 prévues
s'annonçait « − 50 min ». Deux chiffres qui se contredisent dans le même écran,
et c'est toute la liste qu'on cesse de croire.

**Le contrôle a été resserré après avoir été vu FAUSSEMENT vert :** il comptait
les colonnes n'importe où sous la planche, et un enveloppement des deux dans une
seule zone de défilement — c'est-à-dire l'ancienne molette redessinée — passait
au vert. Trouvé en fabriquant exactement cette dégradation.

### La fiche d'entretien : une seule liste, pas une par client

*« Planche une, la A »* — la question posée le 16 août, restée sans réponse faute
d'adresse pour consulter la planche, est tranchée. Une seule liste tenue dans les
Réglages, pré-remplie à chaque envoi ; rien n'est rangé par client.

### Deux planches sans adresse en ont enfin une

*« Je veux les voir »* — « Composer sa fiche d'entretien » et « Choisir l'heure
au pouce » vivaient dans `docs/maquettes/`, que `pages.yml` ne publie pas. On
attendait de lui depuis le 16 août un choix qu'il n'avait aucun moyen de faire.

Déplacées dans `appli/`, pas recopiées : deux exemplaires auraient divergé. Le
recueil des maquettes sait désormais chercher dans les deux dossiers — sans quoi
il se serait plaint d'une planche « introuvable » alors qu'elle est publiée.


### Le message au client, simplifié : plus de pastilles à poser

*« On comprend rien, trop compliqué pour modifier »*, puis, devant la maquette
`appli/message-au-client-simple.html` : *« la modification est parfaite, tu peux
coder »*. Il réglait son message en POSANT à la main quatre pastilles
(« le client », « le document », « le lien », « mon entreprise »).

Fini : **un simple texte**. Le prénom, la phrase du document et le lien se
remplissent seuls — il n'a plus rien à placer. Ce qui s'adapte se **montre**, en
doré, dans **deux aperçus côte à côte** : « Envoi d'un devis » et « Envoi d'une
facture », à message identique. On y voit le mot changer tout seul — le devis dit
*« choisir votre date »*, la facture *« F… à régler avant le… »* (sa « façon 1 »,
re-confirmée le 25 août : Atlas adapte le milieu, il garde le bonjour et la
signature).

Partis avec : la rangée de pastilles, la bascule d'aperçu, la ligne
« l'objet n'est pas modifiable ». Le lien reste **obligatoire** — le serveur
refuse toujours un message sans lui —, et un seul filet demeure : reprendre le
message d'Atlas s'il l'a défait.

**Ce qui reste tenu :** le fil entier — de l'écran jusqu'au téléphone du client
— est éprouvé au navigateur (`test-message-au-client-e2e`), et les deux aperçus
lisent les MÊMES valeurs que l'envoi (`apercuColore` coupe le modèle sur les
mêmes pastilles que `rendreMessage` : jamais une seconde rédaction).

### Photographier un devis pour en reprendre l'allure

*« faut que l'utilisateur puisse prendre la photo de son devis […] pareil pour
sa facture »*, après *« on comprend rien, trop compliqué pour modifier »* sur
l'écran des documents. Il règle aujourd'hui logo, police, couleur et mentions à
la main, sur près de mille lignes qu'il trouve illisibles.

En tête de « L'allure de mes devis », deux boutons photographient un devis ou
une facture — **appareil photo ou photothèque**, son devis étant parfois déjà
une image. L'appli en reprend **l'allure** (couleurs, police reconnue) et les
**mentions** (conditions, politesse), **jamais les lignes ni les prix**, jamais
le logo — un modèle décrit une image, il ne la découpe pas, et l'écran le dit en
réserve plutôt que de le laisser croire.

**Ce qui protège du faux.** On ne pose une police que sur une famille reconnue
parmi les neuf que le PDF sait embarquer ; une couleur mal lue vaut `null` et
laisse celle d'avant ; un acompte hors bornes tombe. Chaque perte se dit à
l'écran. La photo est nettoyée de ses métadonnées comme le logo (coordonnées GPS
du lieu de la prise), avant de partir chez le fournisseur de vision.

**Ce qui n'est PAS éprouvé ici, et l'est ailleurs.** La fonction pure de lecture
est testée sans clé (`test-lecture-allure-devis.ts`), là où vivent les pièges.
L'appel réel au fournisseur demande une clé absente de cet environnement : il se
prouve sur son espace, avec un vrai devis — comme la dictée.

### L'accueil perd son salut et son trait

*« Supprime le bonjour compte »*, et *« une sans le trait gris »* — ses deux
demandes sur la planche 95, puis *« code la mienne »*.

Ce qu'il lisait n'était pas son prénom mais le mot **« Compte »**, le nom du
compte faute de prénom renseigné. Un salut qui se trompe de nom vaut moins que
pas de salut, et il occupait la première ligne de l'écran qu'il ouvre vingt fois
par jour. Le prénom n'est plus lu du tout, et la lecture de session qui ne
servait qu'à lui a disparu avec.

**Le point qui compte : ce trait, il l'avait DEMANDÉ le 11 août**, et le fichier
portait la consigne inverse en toutes lettres. Elle a été récrite, pas
contournée — sans cela, la prochaine session l'aurait remis de bonne foi en
citant une consigne devenue fausse.

**Et rien d'autre n'a bougé.** La planche proposait trois autres améliorations,
dans sa version B ; sa consigne était : *« pour la mienne, fais seulement les
changements que je t'ai demandés »*. Elles restent sur la planche, où il peut les
comparer. Une proposition ne se glisse pas dans la version de quelqu'un sous
prétexte qu'elle l'améliore. `ARCHITECTURE.md` §172.

### Le lot 2B est au vert — et sept contrôles fragiles avec lui

`verifier:avant-livraison` : **223/223** suites base, **110/110** suites
navigateur, connexion réelle dans un navigateur derrière une origine étrangère.
Verdict complet dans `docs/lot-2b-securite-verdict.md`.

**Il a fallu cinq passages, et aucun rouge ne venait du lot.** Le détail des sept
contrôles réparés est ci-dessous ; ils ont un point commun, et c'est le seul qui
mérite d'être retenu : **ils attendaient un délai plutôt qu'un signal**, ou ils
guettaient une formulation plutôt qu'une règle. Aucun n'a été affaibli — les
assertions défendent la même chose, elles regardent seulement au bon moment.


### Deux suites de dates rougissaient un jour sur trente, sur un écran juste

La batterie du lot 2B a franchi minuit, et deux suites navigateur sont tombées
d'un coup — **sans qu'une ligne du lot ne touche un calendrier**. Le 25 août est
le premier jour où :

| | |
|---|---|
| `test-date-lointaine-e2e` | la date à six mois tombe un **1er**. L'écran écrit « 1er mars » — le seul ordinal du français —, la suite cherchait « 1 mars » |
| `test-deux-dates-calendrier-e2e` | il ne reste que **deux** jours ouvrés au mois affiché, alors que la suite en exige trois |

**C'est le pire des rouges : celui qui accuse un code juste.** Une suite qui
tombe un jour sur trente s'apprend à être ignorée, et l'on perd le garde-fou
sans s'en apercevoir.

La première **redisait la règle d'écriture** au lieu de l'employer — exactement
la duplication que `CLAUDE.md` §3 interdit. Elle passe désormais par
`jourLisible`, la fonction qui rend la page du client : ordinal compris, elle
suit la règle au lieu de la deviner.

La seconde supposait que le mois affiché offrait toujours trois jours. Elle fait
maintenant le geste du patron : quand son mois est plein, elle passe au suivant.

*Établi avant de corriger : la date du jour suffit à reproduire les deux
échecs, et le diff du lot ne touche aucun fichier de calendrier.*

### Deux autres suites mesuraient la vitesse de la machine, pas la règle

Au tour suivant de la même batterie, deux suites **différentes** sont tombées —
et vertes dans la foulée jouées seules (7/7). Aucune ne touche une image ni un
corps de requête.

| | Ce qu'elle attendait |
|---|---|
| `test-fiche-chantier-e2e` | `waitForTimeout(900)` puis lecture en base. Sous la batterie, l'enregistrement dépasse ce délai : le contrôle accusait le produit de perdre le temps saisi |
| `test-facture-au-client-e2e` | le corps de la page était lu entre les deux mentions : « arrêtée » était là, « ne l'a pas encore reçue » pas encore |

Les deux attendent désormais **le signal réel** — la valeur en base, la mention à
l'écran — au lieu d'un délai fixe. Les attentes sont bornées et les assertions
inchangées : si le signal ne vient jamais, elles rougissent exactement comme
avant.

*Le second cas portait déjà, en commentaire, le même diagnostic daté du 12 août
2026. Une cause connue et laissée en place se repaie.*

### Et une troisième lisait un écran qui affichait encore « Chargement… »

Au tour d'après, `test-fiche-client-e2e` : `waitForURL` rend la main dès que
l'adresse correspond, alors que le corps de la page porte encore l'écran
d'attente. Le contrôle lisait celui-ci et annonçait « le nom du client manque ».

**Il ne mesurait rien du tout** — la faute du 15 août, dans une autre robe. Les
deux endroits du fichier attendent maintenant que l'écran d'attente s'efface.

*Cherché ailleurs plutôt que corrigé sur place : les autres `waitForURL` du
dépôt lisent par des localisateurs, qui attendent d'eux-mêmes.*

### Un contrôle guettait un état qui ne dure qu'un instant

`test-facture-au-client-e2e` exigeait la phrase « Votre client ne l'a pas encore
reçue ». Or `TransmettreLaFacture` a **deux visages** :

| Lien du client pas encore préparé | Lien préparé |
|---|---|
| « Votre client ne l'a pas encore reçue. » | « … — c'est vous qui l'envoyez. » |

Depuis l'appui unique du 22 août, le même geste arrête la facture, prépare le
lien, ouvre la messagerie, puis rafraîchit l'écran : **on passe du premier visage
au second pendant que la suite regarde.** Le contrôle n'attendait que le premier,
et tombait selon la vitesse de la machine.

**Les deux phrases disent la même chose, et c'est elle la règle** : la facture est
arrêtée, et c'est encore à lui de l'envoyer. Le contrôle vise désormais la règle,
pas l'une de ses deux formulations — un écran qui laisserait croire la facture
partie ne porte ni l'une ni l'autre, et il rougit.

### Et « 0 == 1 » n'accusait personne

`test-ia-02-e2e` écrivait la prestation puis attendait trois cents millisecondes
avant de vérifier qu'elle avait survécu à l'assistant. Sous la batterie, l'action
serveur dépasse ce délai : l'assistant était accusé d'un effacement qui n'avait
pas eu lieu. Elle attend maintenant que la requête soit partie — et son message
nomme le coupable, au lieu d'un « 0 == 1 » qui envoyait chercher partout.
### Deux phrases retirées, et un seul contrôle pour toutes celles à venir

**Ses deux demandes du 25 août :** *« supprime la phrase "aucun chantier pour
l'instant" »*, puis *« supprime la phrase en gris "tout s'enregistre au fur et à
mesure" »* — celle-ci sous l'aperçu du PDF, sur l'écran du devis.

La seconde rassurait sur un doute qu'il n'a plus : il connaît son outil, et rien
ne part effectivement avant qu'il ne le décide. Une phrase qui répond à une
question qu'on ne se pose plus n'informe plus, elle occupe.

**Un seul contrôle, et non un fichier par phrase.** Il en a fait retirer deux en
deux jours et il en fera retirer d'autres : `scripts/test-phrases-retirees.ts`
porte une ligne par retrait — sa demande à la lettre, la date, le fichier — et le
tableau est la documentation. `test-accueil-liste-vide.ts`, écrit la veille pour
la première, y est absorbé.

**Il fixe aussi ce qui doit RESTER**, parce que c'est là que se cache le vrai
risque : les bandeaux sur l'accueil vide, et « Aperçu du PDF » sur l'écran du
devis — le lien vivait juste au-dessus de la phrase retirée. Vu rouge contre le
retour des deux phrases.

---

### L'accueil vide ne dit plus qu'il est vide

**Sa demande, capture à l'appui :** *« supprime la phrase "aucun chantier pour
l'instant" »*.

Elle disait deux choses, et les deux étaient déjà à l'écran : que la liste est
vide — cela se voit — et par où commencer, alors que « CRÉER UN DEVIS » et son
rond doré sont juste au-dessus. Une phrase qui répète ce qu'on voit prend la
place des bandeaux, qui, eux, appellent une action.

**Les bandeaux restent, et c'est la moitié qui compte** : ils portent les
réponses de ses clients — un devis accepté, une autre date proposée — et elles
arrivent justement quand plus aucun chantier n'est en cours.

**Le contrôle lit la SOURCE, et il faut savoir pourquoi.** L'état à mesurer —
aucun chantier — est hors de portée des suites navigateur, qui partagent le
compte de démonstration et en portent toujours. Une suite qui « vérifierait »
l'absence sur un accueil plein serait verte sans avoir rien mesuré. C'est
grossier, et c'est plus honnête qu'un vert qui ne prouve rien
(`scripts/test-phrases-retirees.ts`, vu rouge contre le retour de la phrase).

### Choisir une date se fait d'un seul doigt

**« Proposer ce jour » est retiré** — sa demande : *« je dois pouvoir
sélectionner les jours juste en les touchant, pas besoin de cliquer sur
proposer »*. Toucher une case du calendrier ouvre toujours la fiche de la
journée — qui est déjà là, avec quelle équipe — mais elle n'engage plus rien :
c'est la case qui engage, et la retoucher retire la date. Un appui par date
économisé sur chaque devis.

Ce qui ne change pas : le serveur tranche toujours avant qu'une case s'allume,
et un jour refusé s'ouvre quand même en disant pourquoi. Ce qui a été ajouté au
passage : deux cases touchées coup sur coup ne se marchent plus dessus — la
réponse tardive de la première ne vient plus cocher un jour déjà quitté.

### L'écran Informations : ses cases s'écrivent de nouveau, et il y a moins à lire

*Ses captures du 25 août : « je peux rien modifier, les cases ne sont pas
cliquables », « le à confirmer est trop long, synthétise-le. Moins de mots ! »,
« le sert à calculer le prix en gris, supprime-le ».*

**Le défaut qui comptait.** Une fois le brouillon confirmé, TOUTES ses cases
passaient en lecture seule — et sur iPhone, un champ en lecture seule n'ouvre
même pas le clavier : on tape, rien ne se passe, on croit à une panne. Or
« Déchets », « Contraintes d'accès » et « Remarques » n'ont aucune autre case
dans l'application : cette information devenait impossible à corriger, pour
toujours.

Elles s'écrivent désormais après confirmation. Ce qui a été RECOPIÉ dans le
chantier — prestations, matériel, durée, équipe — disparaît au contraire de
l'encart : les vraies cases sont juste en dessous, et corriger la copie n'aurait
touché à rien. Le dépôt cessait aussi de dé-confirmer le chantier à chaque
frappe (`brouillons-informations.ts`), ce qui aurait réécrit sa durée par-dessus
sa correction au geste suivant.

**Moins à lire.** Les réserves du brouillon tenaient en quatorze lignes de gris
avant d'arriver aux prestations. La consigne donnée au modèle exige maintenant
des groupes nominaux de six mots, cinq au plus ; et à l'écran la liste est
plafonnée à cinq, **le reste étant annoncé** (« + 2 autres ») — une liste
tronquée en silence se lit comme une liste complète.

Trois phrases grises partent aussi, sur sa demande : sous « Ce chantier prend »,
sous « Ou écrire le devis moi-même », et la flèche de « Valider et calculer le
prix ».

**Ce qui n'a PAS été fait, et pourquoi.** Il demandait de supprimer « Ou écrire
le devis moi-même » *si* « Valider et calculer le prix » ouvrait le devis. Ce
n'est pas le cas : ce bouton ouvre l'écran PRIX. Le lien saute cette étape —
c'est la sortie de secours qu'il avait demandée le 3 août 2026. Il reste.

`ARCHITECTURE.md` §172.

### Et un huitième, trouvé en parallèle : la remise lue avant d'être écrite

Même famille que les sept ci-dessus, et découvert par une autre session le même
jour — les deux récits se rejoignent, celui-ci ne garde que ce que l'autre ne
porte pas.

Le contrôle de `test-reduction-devis-e2e` tapait « 15 », attendait 900 ms
choisies au doigt mouillé, puis lisait la base. Sous cent dix suites,
l'enregistrement n'était pas retombé : la base portait encore « 5.00 » et le
contrôle accusait le produit d'écrire un chiffre faux sur un devis.

Il relit désormais jusqu'à ce que la valeur vienne, avec une attente qui monte.
Il n'y perd rien : il exige toujours 15,00 exactement, et rend le contenu réel
de la ligne quand elle ne vient pas — un vrai désaccord entre l'écran et la base
rougirait encore.

### Et un neuvième, qui avait déjà été « réparé » le matin même

`test-ia-02-e2e` vérifie qu'un échange avec l'assistant n'efface aucune
prestation. Une première correction du 25 août avait remplacé un délai de trois
cents millisecondes par une attente de réseau au calme. **La suite a rougi de
nouveau à la batterie suivante**, et la leçon vaut d'être écrite : le réseau se
tait dès que l'action serveur est PARTIE — rien ne dit qu'elle a fini d'écrire,
ni que l'écran d'après la relira.

Le contrôle rouvre maintenant l'écran jusqu'à ce que la prestation s'y montre.
Il ne s'affaiblit pas : passé sept secondes, il rougit comme avant, et une
prestation vraiment effacée par l'assistant ne reviendrait jamais.

**Et ce n'était toujours pas la bonne cause.** Deux corrections ont échoué avant
qu'on regarde au bon endroit : attendre le réseau, puis relire l'écran quatre
fois. Aucune ne pouvait marcher — **la prestation n'avait jamais été écrite**.

Le décor la posait ainsi : appuyer sur « + Ajouter une prestation », patienter
300 ms, puis écrire dans « le premier champ d'un formulaire ». Sous la batterie,
la ligne neuve n'est pas encore rendue : le texte partait dans le champ d'à
côté. Ce champ ne porte ni étiquette ni marque, son seul repère est sa place —
on attend donc que le NOMBRE de champs augmente, ce qui est la seule chose qui
dise que la ligne existe.

**Un décor qui échoue doit s'accuser lui-même.** Le message nommait l'assistant
et l'accusait d'effacer une prestation, sur un code parfaitement sain ; il y a
maintenant une assertion distincte, avant l'échange, qui dit que c'est la suite
qui n'a pas su écrire. Trois batteries ont été payées à cette confusion.

**Attendre « le réseau » n'est pas attendre « le résultat ».** C'est la même
faute que le délai fixe, dans une robe plus convaincante.


### Le banc RÉPARE une dépendance manquante, au lieu de retenter la même construction

**Sa plainte : « l'application est en mode lent, et elle crash ».** Sa fiche
d'espace donnait la cause au mot près, sans qu'on ait à supposer quoi que ce
soit (`CLAUDE.md` §1 bis) :

```
Error: Cannot find module
'/workspaces/Atlas-app/node_modules/@swc/helpers/cjs/_interop_require_default.cjs'
```

**Une cause, ses deux symptômes.** Un paquet absent de ses `node_modules` fait
tomber la construction : le banc reste en mode développement, où chaque écran se
compile à l'ouverture — c'est la lenteur. Et le même paquet manquant fait tomber
les écrans à l'exécution — c'est le crash. Il ne signalait pas deux pannes.

**Le défaut réel n'était pas l'échec, c'était l'absence de réparation.** Le
veilleur retentait la MÊME construction, trois fois à dix minutes puis toutes
les demi-heures, indéfiniment. Contre un fichier absent, insister ne répare
rien : l'espace pouvait rester lent une nuit entière sans que personne y touche.

**C'était la DEUXIÈME fois.** Le 22 août, `Cannot find module './detect-typo'`
dans `node_modules/next` avait éteint son espace toute une soirée, et il avait
fallu lui faire taper `rm -rf node_modules && npm ci` depuis son téléphone. Un
défaut qui revient et qu'on répare deux fois à la main n'est pas réparé.

**Désormais** : quand la construction tombe sur un module absent **sous
`node_modules`**, le banc réinstalle les dépendances et reconstruit — une fois.
Si elle retombe, il s'arrête et le témoin d'échec garde les deux sorties.

**`npm install`, jamais `npm ci`**, et c'est délibéré : `ci` efface
`node_modules` avant de réinstaller, or le serveur de développement TOURNE
pendant ce temps et sert le patron. Lui retirer le sol coûterait sa session pour
réparer une lenteur. `install` complète en place, ce qui suffit à un paquet
absent — le cas que sa fiche montre.

**Le contrôle joue la reconnaissance EXTRAITE du banc**, jamais une copie : une
seconde expression régulière finirait par éprouver une règle que le produit
n'applique plus. Il la confronte aux **deux pannes réelles**, recopiées de ses
fiches, et à quatre cas où réinstaller serait une perte de temps — une erreur de
types, un import cassé du dépôt, un fichier du dépôt absent, une construction
réussie.

**Deux trous trouvés dans ce contrôle avant de le livrer**, en le confrontant aux
états dégradés : renommer la constante du banc le faisait **mourir sur une pile
d'appels** au lieu d'accuser, et retirer la clause `node_modules` ne faisait
rougir personne — elle n'était donc défendue par rien. Les deux sont comblés, et
les trois sabotages rougissent maintenant en nommant ce qui manque.

---

## 2026-08-24

### Le lien que reçoit le client partait vers `localhost` — deux causes, deux correctifs

**Sa capture : « Connexion au serveur impossible », sur `localhost`.** Son client
ouvre le message et tombe sur une page morte. Le document existait, son jeton
était bon, la page fonctionnait — mais l'adresse envoyée désignait **le
téléphone du client lui-même**.

**Cause 1 : l'espace ne DONNAIT PAS son adresse publique au serveur.** Le script
de démarrage la composait déjà — pour l'afficher dans le terminal, à mettre en
favori — sans jamais la poser dans l'environnement. Or le lien prend l'adresse
par laquelle Atlas a été OUVERT : par l'adresse publique de l'espace il est bon,
par la redirection de port de l'éditeur (`http://localhost:3000`) il ne vaut que
sur sa machine. Rien à l'écran ne distinguait les deux. `ATLAS_URL_PUBLIQUE` est
désormais exportée au démarrage, avant tout ce qui se lance : posée, elle
commande, et le lien devient juste **quelle que soit la porte par laquelle il
entre**. L'affichage du terminal réemploie cette même variable — deux formules
pour une seule adresse finiraient par ne plus dire la même chose.

**Cause 2 : le garde-fou n'existait que sur la fiche d'entretien**, là où le
défaut avait été trouvé la veille. Le devis et la facture partent par le même
chemin et prennent la même adresse : ils envoyaient le lien mort.

**Ce second correctif est venu d'une AUTRE SESSION, et c'est la sienne qui a été
gardée à la fusion.** Nous avions écrit le même refus au même endroit, à une
heure d'intervalle ; la sienne va plus loin — la phrase y est paramétrable
(`phraseAdresseLocale("votre devis")`) au lieu d'un texte unique pour les trois
documents. Reporter la nôtre par-dessus aurait été une régression. Ce lot n'y
laisse que le contrôle, qui tient désormais la règle pour les trois écrans :
un quatrième écran qui écrirait à un client sans ce verdict le fera rougir.

**Les deux sont nécessaires, et pas l'un OU l'autre** : le premier rend le lien
juste, le second empêche d'en envoyer un faux le jour où la variable manque sur
une machine qu'on n'a pas prévue.

**Le contrôle EXÉCUTE le bloc du script de démarrage**, il ne le relit pas :
chercher la chaîne « export ATLAS_URL_PUBLIQUE » passerait au vert sur un
`export` commenté, ou placé après le lancement du serveur. Le bloc est extrait
du fichier tel qu'il est, joué dans un bash à part avec les variables que GitHub
pose, et l'on lit ce qui en sort. **Vu rougir** contre l'export retiré, et
contre le garde-fou du devis désactivé.

**Ce que le contrôle des trois écrans NE prouve pas, et c'est écrit dedans** :
il lit la source. L'éprouver au navigateur demanderait de servir Atlas sur une
adresse locale, or la batterie pose délibérément `ATLAS_URL_PUBLIQUE` pour que
les suites aient des liens valides — le refus ne s'y déclencherait jamais, et un
vert n'y prouverait rien.



### Lot 2B : une image ne se range plus jamais sans être nettoyée

**Le revirement du jour, et il est assumé.** Ce dépôt écrivait le matin même :
*« un échec de nettoyage ne refuse JAMAIS la photo »*. La règle venait d'un vrai
principe — un outil qui refuse la photo qu'on vient de prendre est pire que le
risque qu'il évite — et **elle protégeait le geste de l'artisan en sacrifiant la
donnée de son client** : un fichier qu'on ne savait pas lire était rangé avec ses
coordonnées GPS.

Désormais : **taille → format → nettoyage → refus si le nettoyage échoue**, dans
une porte unique (`src/server/photo-entrante.ts`) que les cinq chemins d'image
traversent. Rien n'en sort que des octets nettoyés.

**Le HEIC est refusé**, et le refus donne le geste : *Réglages › Appareil photo ›
Formats › « Le plus compatible »*. Convertir côté serveur aurait demandé un
décodeur natif analysant un fichier hostile — plus de surface d'attaque que ce
qu'on referme.

**Ce qui était le plus exposé n'était dans aucun brief : le logo d'entreprise.**
Une enseigne photographiée au téléphone porte les coordonnées GPS de l'endroit,
et ce fichier est **embarqué dans chaque devis et chaque facture** envoyés aux
clients. Il n'était nettoyé nulle part.

**Un bénéfice non cherché :** le nettoyeur vérifie la signature du fichier.
Refuser sur échec refuse donc aussi tout fichier maquillé — un SVG annoncé
`image/jpeg` ne passe plus.

### Lot 2B : le corps d'une requête est borné PENDANT sa lecture

Le correctif du matin refusait sur `content-length` puis appelait
`requete.formData()`. **C'était un premier rempart et pas une preuve** : cet
en-tête est écrit par le client. Le sous-déclarer, ou envoyer en
`Transfer-Encoding: chunked` qui n'en porte aucun, laissait le parseur avaler ce
qu'on voulait.

Vérifié dans la documentation de Next plutôt que supposé : `bodySizeLimit` ne
couvre **que les actions serveur**, et **aucune limite native n'existe** pour les
*route handlers*. Le corps traverse donc un compteur qui **casse le flux** au-delà
de la borne (`src/server/corps-borne.ts`) — cassé, pas tronqué : un multipart
amputé se lirait comme un fichier valide mais incomplet.

Une suite compte les octets qui sortent réellement du flux borné quand on lui
donne un corps dix fois trop gros.


### Un lien envoyé à un client ne peut plus être une adresse de sa machine

**« Connexion au serveur impossible. »** C'est ce que lisait son client en
ouvrant le SMS de sa fiche de chantier. Le rapport existait et son jeton était
bon : c'est l'adresse qui portait `localhost`, c'est-à-dire le téléphone du
client lui-même. Le lien prenait l'adresse du navigateur qui l'avait fabriqué —
juste quand Atlas est ouvert par son adresse publique, faux dès qu'il passe par
la redirection de port de son éditeur, et rien à l'écran ne distinguait les
deux.

Atlas refuse désormais de composer un message avec une adresse qui ne sort pas
d'une machine — `localhost`, mais aussi `192.168.x.x`, qui est la plus traître :
elle s'ouvre au bureau, donc l'essai réussit, et elle échoue chez tout le monde.
L'écran le dit, et dit que le rapport est enregistré : sans cela il recocherait
toute sa fiche.

**`ATLAS_URL_PUBLIQUE`** répond pour un déploiement dont les en-têtes ne
trahissent pas l'adresse (documentée dans `.env.example`), et **les quatre
copies de ce calcul** — devis parti, devis complet, facture, fiche de chantier —
n'en font plus qu'une. Le garde-fou a été vu rouge : la suite de la fiche,
rejouée sans adresse déclarée, tombe exactement là où son client est tombé.
Détail : `ARCHITECTURE.md` §169.

**Et le devis et la facture partaient par le même mauvais chemin** — il n'avait
signalé que la fiche. Le refus est donc posé sur les cinq gestes qui envoient un
lien à un client. Le pire d'entre eux était l'envoi qui ouvre la messagerie dans
la foulée : le message s'ouvrait tout prêt, avec l'adresse d'une machine dedans,
et rien n'invitait à se méfier avant d'appuyer sur « Envoyer ». Rien n'est
défait pour autant — un devis envoyé reste envoyé, une facture arrêtée reste
arrêtée : c'est le message mort qu'on barre, pas son travail.


### La fiche en cours se supprime, et l'endroit où elle se compose se retrouve

**Rien n'effaçait un brouillon.** Une fiche s'ouvre à chaque geste, et l'écran
qu'il ouvre chaque matin devenait une pile — une fiche du mauvais jour, une
autre pour un jardin qu'il n'a pas fait. Une croix les retire, avec le geste du
10 août : la ligne part, « Annuler » reste, rien n'est écrit tant que le tiroir
est ouvert. **Un rapport déjà parti, lui, ne se supprime pas** et n'a pas de
croix : son lien vit chez le client, et l'effacer changerait cette adresse en
page morte sans que personne puisse le savoir.

**L'endroit où la fiche se compose n'avait pas disparu : il ne s'affichait
plus.** Le lien vers Réglages → Fiche d'entretien vivait dans l'encart de la
fiche VIDE, celui qui s'efface à la première prestation posée — l'écran retirait
sa porte à l'instant où le patron commençait à s'en servir. Elle est désormais
en bas de la liste, en permanence, pour le propriétaire.

**Deux verbes sur trois ne tenaient pas** dans l'écran qui compose la fiche.
« Créer une catégorie » rangeait la ligne dans « Divers », à lui de renommer le
titre au-dessus ; « en enlever » n'existait pas — six retraits au pouce. Le nom
se saisit maintenant avec sa première prestation, et un bouton retire la famille
entière.

**Le rapport figé perd ses deux lignes grises**, à sa demande : la phrase sur la
preuve de passage et l'adresse recopiée sous le bouton. Aucune n'apprenait rien
— l'état figé se lit déjà aux cases qui ne se cochent plus. L'adresse survit là
où elle sert vraiment : chez un client sans téléphone ni e-mail, elle est le
seul moyen de transmettre. **Et le bouton dit enfin par quoi ça part** :
« Envoyer par SMS » ou « Envoyer par e-mail », selon ce qu'il a choisi sous le
nom du client — l'écran le déduisait des coordonnées, et annonçait donc un canal
que personne n'avait demandé.

**Trois défauts trouvés en REGARDANT les captures**, aucune suite ne rougissait :
« EN COURS » restait seul sans une ligne dessous pendant le délai d'annulation ;
la croix d'une famille était le jumeau exact de celle d'une ligne (elle s'écrit
maintenant « Retirer la famille ») ; la porte du modèle butait sur la barre
d'onglets — mesuré à 60 px, contre 116 px après. Détail : `ARCHITECTURE.md`
§168.


### Audit de sécurité, lot 2 : ce qu'on dépose dans Atlas

**Un classeur piégé ne couche plus le serveur.** Un `.xlsx` est une archive, et
`deflate` dépasse mille pour un sur du texte répété : les 5 Mo qu'accepte
l'écran d'import rendaient plusieurs gigaoctets, et le processus mourait
d'épuisement mémoire — sans message, en emportant les requêtes de tout le monde.
Une borne à trente-deux mégaoctets gonflés, et l'import de tarifs reçoit enfin
une cadence : c'était le seul chemin d'Atlas qui décompresse, et le seul sans
seuil. `test-classeur-bombe.ts` assemble une vraie bombe de 200 Mo et a été vue
rouge contre la version d'avant.

**Le type d'un fichier servi ne vient plus du navigateur.** La route des
fichiers renvoyait le type déclaré au dépôt : annoncer `image/svg+xml` faisait
servir un document porteur de script depuis notre propre domaine.
`nosniff` était déjà posé et n'y changeait rien — il interdit de *deviner* un
type, pas d'en *annoncer* un. Le type se déduit désormais de l'extension que le
serveur a posée.

**Les photos de chantier et les tickets de TVA perdent leurs coordonnées GPS**,
et n'acceptent plus n'importe quoi. `startsWith("image/")` laissait passer le
SVG ; une liste blanche le ferme. Le diagnostic végétal faisait déjà tout bien
depuis toujours — il n'y avait qu'à reprendre.

**Le piège de ce lot, et il valait d'être trouvé avant de livrer :** resserrer
les types côté serveur, seul, aurait refusé les photos d'iPhone. Un iPhone
photographie en HEIC ; s'il transcode en JPEG, c'est **parce que l'attribut
`accept` du champ le lui demande**, et trois écrans portaient `image/*`. Les
attributs et la liste serveur bougent donc ensemble, le HEIC est accepté en
filet, et **un échec de nettoyage ne refuse jamais la photo** : elle est rangée
telle quelle, et journalisée. Un artisan sur un chantier, ticket en main, ne
doit pas lire un refus.

**Hors brief, même famille :** le croquis d'arrosage envoyait la photo à un
fournisseur d'IA sans vérifier son type ni compter les appels. Il porte
maintenant les deux — ce seuil-là ne protège pas un service, il borne une
facture.

`ARCHITECTURE.md` §165. Rien de M6 n'a été touché : le plafond d'octets existait
déjà, et le réécrire aurait été du risque contre rien.


### Face ID est codé — sa réponse B, et le mot de passe intact

Il a tranché : **B**, la porte d'aujourd'hui plus une ligne au-dessus. Rien n'a
changé de place — `name="email"`, `name="password"` et `type="submit"` sont où
ils étaient, ce dont dépendent vingt scripts de capture et
`verifier-connexion.mjs`.

**Ce qu'il gagne :** on enregistre son téléphone une fois depuis Réglages ›
Connexion, et la porte s'ouvre ensuite d'un doigt, **sans taper son adresse**
(clés découvrables). Le mot de passe reste actif et ne peut pas se retirer.

**Ce qui n'arrive JAMAIS en base : aucune donnée biométrique.** Le visage ne
quitte pas la puce du téléphone ; Atlas ne garde qu'une clé **publique** — de
quoi vérifier une signature, jamais d'en produire une. L'écran le dit à
l'artisan, et une suite vérifie qu'il le dit.

**La règle qui a commandé tout le reste : un visage refusé ne compte AUCUNE
tentative ratée.** Sans elle, un téléphone qui ne reconnaît pas son
propriétaire — poussière, casquette, lumière rasante — finirait par temporiser
son propre compte : la panne du 6 août 2026 refaite par l'autre bord.
`test-face-id-e2e.ts` l'éprouve avec un appareil réglé pour échouer, et a été
vue rouge contre un `noterEchec` posé exprès sur ce chemin.

**`next-auth/providers/passkey` est écarté, vérifié plutôt que supposé :**
`@auth/core` refuse le WebAuthn sans adaptateur de base (« WebAuthn requires an
adapter »). Atlas n'en a aucun — session JWT, sans table —, et en brancher un
remettrait en jeu le contexte d'entreprise, le `middleware` et « me déconnecter
partout », pour un bouton sur la porte. Retenu : un **second fournisseur
`Credentials`** vérifiant l'assertion avec `@simplewebauthn/server`
(`ARCHITECTURE.md` §163).

**Un défaut trouvé par une suite, pas par une relecture :** la lecture du
domaine découpait sur le premier `:` avant de valider. Sur `https://atlas.fr`,
le morceau restant valait `https` — accepté. Atlas aurait posé des clés sous le
domaine « https », et aucune ne se serait jamais rouverte.

**À poser le jour du déploiement : `ATLAS_RP_ID`.** Sans elle, Atlas **refuse**
d'enregistrer une clé en production plutôt que de deviner le domaine depuis un
en-tête que le client écrit.

Parcouru en entier dans un vrai navigateur, avec l'appareil simulé de Chrome :
enregistrement, déconnexion, ouverture au visage, échec, retrait.

### Face ID : la planche avant le code, et un chemin d'implémentation vérifié

Sa demande du 23 août — *« le Face ID pour le mot de passe, et bien entendu
qu'il faut conserver le mot de passe »* — est un **geste sur la porte** : il se
dessine avant de toucher à `src/` (`CLAUDE.md` §3 bis). `appli/face-id.html`
(planche 94) propose deux places, **A** le visage d'abord, **B** l'écran
d'aujourd'hui plus une ligne, et **ne pose qu'une question** : tout le reste est
identique dans les deux. Elle se manipule — le visage ouvre une fenêtre, un
interrupteur le **fait échouer** exprès, un autre l'**éteint** et la porte
redevient exactement celle d'aujourd'hui.

**Ce qui n'est pas une question, et que la planche écrit** : le mot de passe ne
se retire pas (son interrupteur est allumé et inerte), le compte se crée au mot
de passe, l'activation est **par appareil**, et un échec de visage **ne compte
aucune tentative ratée** — sinon un visage mal reconnu ferait temporiser son
propre compte, la faute du 6 août refaite par un autre bord.

**Le fournisseur `passkey` d'Auth.js est écarté, et c'est vérifié, pas supposé :**
`@auth/core` refuse le WebAuthn sans adaptateur de base (« WebAuthn requires an
adapter »). Atlas n'en a aucun — la session est un JWT sans table —, et en
brancher un remettrait en jeu le contexte d'entreprise, le `middleware` et la
déconnexion partout, pour un bouton sur la porte. Retenu : un **second
fournisseur `Credentials`** qui vérifie l'assertion avec `@simplewebauthn/server`
et laisse le jeton, le cookie et les rappels intacts (`ARCHITECTURE.md` §163).

`appli/tests/essai-face-id.mjs` parcourt la planche dans un vrai navigateur et
**barre la publication** ; elle a été vue rouge contre une porte A privée de son
chemin vers le mot de passe, et contre un échec de visage qui accusait le mot de
passe. **Rien n'est codé dans `src/`.**

### L'écran de la facture arrêtée : ses sept corrections

*Capture à l'appui, le 24 août 2026 au soir.*

| Ce qu'il a demandé | Ce qui a changé |
|---|---|
| *« la facture en PDF, enlève la petite flèche, mais un petit plus pour qu'on comprenne que c'est cliquable »* | la flèche part, le lien est souligné |
| *« Total TTC et Télécharger, mets-les en noir, pas gris »* | fait |
| *« tout ce qui est en gris sous facture F2026, supprime »* | le paragraphe sur l'avoir et le relevé de TVA est retiré |
| *« pareil sous ouvrir le SMS tout prêt »* | le destinataire et le lien en clair sont retirés |
| *« corrige en envoyer par SMS, retire la flèche »* | fait |
| *« corrige envoyer par e-mail en gras doré »* | or, gras, 15 px — la même allure que sur l'écran du devis |
| *« colle-le sous envoyer par SMS »* | fait |

**Et le lien doré ENVOIE désormais, il ne bascule plus.** C'est la condition
pour que son libellé soit vrai : appeler un lien « Envoyer par e-mail » alors
qu'il se contente d'intervertir deux boutons, c'est un écran qui ment — il
appuie, rien ne s'ouvre, et il appuie encore. Quand le client n'a pas d'adresse,
il bascule encore, et c'est le seul cas où il le doit : c'est ainsi que le champ
de saisie apparaît.

**Ce qui est perdu, et qu'il faut savoir avant de le rétablir :** il ne voit
plus à qui le message part avant d'ouvrir sa messagerie. Sa messagerie le lui
montre juste après, et rien n'est envoyé par Atlas. C'est son arbitrage.

`test-facture-au-client-e2e` ne cherche plus le bouton par son libellé mais par
son repère : un contrôle accroché au texte serait mort sur une demande exaucée
(`CLAUDE.md` §5 bis).

### L'allure de ses documents : typographie, fond, accent, logo

*Sa demande du 23 août : « un endroit dédié à la modification de son devis —
s'il veut rajouter son logo, changer la typographie, changer le fond de page ».*

Le réglage vit dans **Réglages › Devis & factures**, sous son message au client
(sa réponse **B**). Dix typographies, deux couleurs libres, un logo. **Le devis
et la facture seulement** : la feuille de chantier est interne, il ne l'a pas
demandée. Migration `0063_allure_documents.sql`.

**Ce que ça évite.** Le défaut, c'est le document d'aujourd'hui — au pixel
près, et ce n'était pas acquis : `ALLURE_PAR_DEFAUT` portait « #ece9e1 », une
teinte lue sur la maquette que ses devis n'ont jamais eue, et les teintes
calculées ne retombaient pas d'elles-mêmes sur les constantes d'origine. Ouvrir
le réglage et le refermer sans rien changer aurait suffi à repeindre tous ses
devis. Attrapé en comparant deux PDF octet pour octet.

**Un défaut MUET, corrigé : les polices ne s'imprimaient pas.** `pdf-lib` sait
découper une police lui-même — et son découpeur perd des caractères sans un
mot. Un devis complet en EB Garamond ne sortait que « e e e Roc e e ». Les
dix-huit fichiers ont été réduits une fois pour toutes (3,9 Mo → 570 ko) et
sont désormais embarqués entiers. `scripts/test-polices-documents.ts` monte la
garde.

**Et l'écran mentait.** Il proposait neuf typographies dont aucune n'était
chargée : « Playfair Display » s'affichait en Georgia. Vu à la capture, jamais
par un test. `/api/polices/[fichier]` sert maintenant les fichiers mêmes que le
PDF embarque.

`ARCHITECTURE.md` §164.

### « Brume moderne » entre dans Apparence — et l'application ne bouge pas

Son choix devant la planche 92 : *« ajoute-moi le Brume moderne comme style,
mais ne change pas l'appli »*. Les deux moitiés commandent ensemble : la charte
s'ajoute aux sept, `origine` reste le défaut, et rien ne change pour qui ne la
choisit pas.

**Une charte peut désormais porter une FORME, pas seulement des couleurs.** Le
champ `formes` est à part de `jetons`, et ce n'est pas un rangement : les
dérivations — `estSombre`, `contraste`, la remontée des couleurs de signal —
parcourent les jetons en supposant que chaque valeur est une couleur. Y glisser
une pile de polices ferait calculer une luminance sur « ui-sans-serif », et le
résultat ne serait pas une erreur, ce serait **un nombre faux, en silence**.

| Ce que Brume porte | Ce qu'elle ne porte pas encore |
|---|---|
| les huit couleurs de la planche | les rayons de 20 px |
| les **titres** dans la police du téléphone | l'ombre bleutée, l'air en plus |

La typographie passait déjà par `--font-display` : elle suit la charte sans
qu'aucun écran soit touché. Les rayons, non — **soixante-six fichiers** les
écrivent en dur (`rounded-[13px]`), et une charte ne peut rien sur ce qui ne
passe pas par elle. C'est annoncé, pas fait.

### « Mon entreprise » perd six phrases, et l'adresse cesse de s'écrire en double

*« Supprime la phrase en gris : vos identifiants + comment vous vous nommez +
où vous êtes établi + pour vous joindre + les espaces se posent tout seuls +
ces informations remplissent vos devis (toute la phrase) + le trimestre est une
option (toute la phrase). »*

**Deux en-têtes restent, et ce n'est pas un oubli** : « Votre régime de TVA » et
« Pour être payé » ne figurent pas dans sa liste. Elles coiffent plusieurs
champs dont le lien ne se devine pas — un IBAN et son titulaire, un régime et un
numéro intracommunautaire. Les quatre retirées, elles, ne disaient rien de plus
que le champ juste dessous : « COMMENT VOUS VOUS NOMMEZ » au-dessus de « Nom de
l'entreprise ».

**Vérifié à l'écran, et dans les deux sens** : les six phrases ont disparu, les
deux autres sont restées. Un contrôle qui ne vérifierait que la disparition
laisserait passer un retrait trop large.

### Un contrôle réclamait la phrase qu'il venait de faire retirer

Retirer *« le trimestre est une option… votre comptable dit lequel vous
concerne »* a fait rougir `test-periodicite-tva-e2e`, qui exigeait ces mots. Le
contrôle a été **re-visé, pas assoupli** : ce qu'il défendait vraiment survit —
**l'écran ne conseille jamais une périodicité**, parce que le seuil des 4 000 €
porte sur la TVA due et qu'Atlas ne connaît que la collectée. C'est cela qu'il
mesure désormais, et non un libellé que le patron peut vouloir réécrire demain
(`CLAUDE.md` §5 bis).

**Il a tranché dans la foulée** — *« tu peux faire une phrase courte »* — et
elle tient sur une ligne : **« Le mois est le défaut ; le trimestre s'obtient
sous condition. »** Sans elle, les deux boutons se lisaient comme un choix
libre, et le mauvais coûte un rappel de l'administration.

**Ce qu'elle ne dit pas, délibérément :** laquelle lui convient. Le seuil porte
sur la TVA DUE, donc sur ses achats, qu'Atlas ne voit pas.

Le contrôle défend désormais **le fait, pas la formule** : un motif large
(« mois » près de « défaut »), pour qu'il puisse la réécrire demain sans faire
rougir la batterie. **Vu rouge** en remplaçant la phrase par « Choisissez votre
rythme » — il tombe, et montre le texte fautif.

### L'adresse écrite deux fois : sa question du 24 août

*« Pourquoi l'adresse est marquée 2 fois de suite ? »* Son siège s'écrivait dans
le champ — « 10 rue denfert rochereau 78200 Mantes la jolie » — et la
proposition juste dessous répétait la même adresse dans son écriture officielle,
« 10 Rue Denfert Rochereau 78200 Mantes-la-Jolie ». Deux lignes, une seule
adresse.

Ce n'était pas un défaut de recherche : **pour une machine, les deux textes
diffèrent** — majuscules, traits d'union — et se ressemblaient assez pour qu'un
œil y voie un doublon. Une liste qui répète ce qui est déjà écrit ne propose
rien : elle occupe la place et fait douter de la saisie.

**Ce qui a été refusé, et c'est délibéré :** réécrire sa saisie dans la forme
officielle. Corriger sous ses doigts un champ qui finira en tête de ses devis,
sans qu'il l'ait demandé, n'est pas de notre ressort (`CLAUDE.md` §4). On cache
la répétition ; on ne touche pas à ce qu'il a écrit.

**NON ÉPROUVÉ DANS UN NAVIGATEUR ICI, et il faut le dire** (`AGENTS.md`) : la
Base Adresse Nationale est refusée par le mandataire de cet environnement, et la
liste de propositions ne s'ouvre pas — **vérifié : elle ne s'ouvrait pas
davantage AVANT cette correction**, zéro requête dans les deux cas. Ce qui est
éprouvé, c'est la règle elle-même, en fonction pure : son cas exact, les
chiffres qui distinguent le 10 du 100, deux vides qui ne sont pas « la même
adresse », et une adresse plus précise qui reste une proposition.

### L'onglet courant devient une pastille — sur Brume moderne, et nulle part ailleurs

*« Modifie aussi la sélection des catégories, juste pour Brume moderne. »* Sur
la planche 92, l'onglet courant de la barre du bas est une pastille arrondie
tenue par l'accent ; dans l'application, c'est un trait doré qui glisse.

**Le « juste » est la moitié qui compte.** Le marqueur se décrit en variables
CSS dont **le repli est la valeur d'aujourd'hui** — une charte muette garde donc
son trait, au pixel près. Mesuré sur trois chartes : Origine 1 px sans rayon,
Brume 29 px avec un rayon de 11, Pierre 1 px sans rayon.

**Ce qui ne change PAS, et c'est délibéré : le mouvement.** Le marqueur glisse
d'un onglet à l'autre sur la même courbe, celle que le patron a retenue en la
voyant. Seule son apparence suit la charte — remplacer le glissement aurait
défait un choix déjà fait.

**Un piège que la pastille réveille et que le trait cachait :** le marqueur est
rendu APRÈS les liens dans le document. Haut d'un pixel au ras du bas, l'ordre
était sans conséquence ; devenu pastille, il passerait par-dessus le libellé.
Les liens prennent donc `relative z-[1]`, et le contrôle l'exige.

**La barre du bas ne sait rien de la charte**, et c'est ce qui compte pour la
suite : le jour où une deuxième charte voudra ce marqueur, il n'y a rien à
rouvrir dans le composant.

### Un contrôle de devis comparait une pendule, pas un document

**Il accusait le code le plus grave de la suite, et il avait tort.** *« Sans
réglage, le devis est EXACTEMENT celui d'avant »* — le contrôle qui garantit
qu'aucun artisan ne voit son devis changer parce qu'un écran est apparu. Il
rougissait environ une fois sur cinq, sur du code qui n'avait pas bougé d'une
ligne.

La cause : `pdf-lib` grave dans chaque document sa date de création, à la
seconde. Les deux compositions comparées tombaient de part et d'autre d'une
seconde, et les octets différaient.

**Mesuré, pas supposé** — le même devis composé à 1,5 s d'écart rend deux
fichiers de même taille dont quelques octets diffèrent. **Et ces octets sont
dans un flux compressé** : c'est ce qui a fait échouer la première correction,
qui effaçait les dates dans le *texte* du PDF. Elles n'y sont pas. On ne peut
pas les ôter après coup — on peut seulement empêcher l'horloge d'avancer entre
les deux compositions, et c'est ce que fait `aLaMemeSeconde`.

**Ce n'est pas un assouplissement**, et il fallait le vérifier plutôt que
l'affirmer : confronté à deux documents réellement différents, le contrôle
rougit toujours et le dit. Stable sur six exécutions d'affilée.

**Ce qui reste à trancher, et qui n'est pas de ce lot** : rendre la composition
reproductible côté produit — dates fixées à l'émission plutôt qu'à la
fabrication. Cela touche le composeur, donc les documents du patron. Noté dans
`TODO.md` plutôt que fait en passant.

### Le gabarit recopiait les couleurs au lieu de les demander

**Le défaut qui a fait perdre le plus de temps ce soir-là, et il était
invisible.** `layout.tsx` reparcourait `c.jetons` de son côté
(`variablesEnStyle`) alors que `variablesCss` existait : **deux implémentations
de la même règle**, ce que `CLAUDE.md` §3 interdit précisément parce qu'elles
finissent par diverger. Elles ont divergé au premier changement — la police de
Brume était émise par l'une et pas par l'autre. À l'écran : le réglage
s'écrivait, les couleurs changeaient, **la typographie non**, et rien ne le
disait.

Les deux formes dérivent maintenant de `variablesCharte`. Un contrôle compare
les deux sorties charte par charte, et **interdit au gabarit de reparcourir les
jetons**.

**Sa première version ne savait pas échouer**, et c'est le genre de contrôle
qui rassure sans rien tenir : elle se contentait de chercher le mot
`variablesCharte` dans le fichier — or l'import y reste même quand le corps
recopie. Confrontée au défaut qu'elle prétendait attraper, elle est restée
verte. Elle vise désormais le parcours lui-même.

### Le script de capture était aveugle à la charte neuve

`capture-chartes.mts` énumérait les sept noms **à la main**. « Brume moderne »
n'a donc pas été capturée : l'outil qui existe pour *regarder l'écran* ne
montrait pas la seule chose qu'on venait d'ajouter. Il lit la liste maintenant.

Une énumération recopiée ne suit jamais la source qu'elle prétend montrer —
c'est la même faute que celle du gabarit, dans l'outillage.

## 2026-08-24

### L'aperçu du devis reste sous les yeux pendant qu'on le change — sa proposition B

**Sa plainte, puis sa réponse.** *« Lorsque je modifie mon devis, je suis obligé
de descendre pour voir les modifications ; il faut mieux organiser la page pour
pouvoir voir ce qu'on modifie. »* Trois rangements lui ont été dessinés
(planche 96) ; devant les trois, il a répondu : **« la B »** — l'aperçu collé en
tête du bloc.

**Le défaut était un défaut d'ORDRE, pas de contenu.** L'aperçu fermait le bloc,
après dix pastilles de typographie sur cinq rangées et deux nuanciers : il
tombait à plus de 900 px du haut. Toucher une police, c'était descendre,
regarder, remonter — dix-huit trajets pour essayer les neuf. Rien n'était de
trop sur cet écran ; tout y était rangé dans le sens qui l'obligeait à voyager.

**`sticky`, et non `fixed`** : la feuille suit tant que le bloc de l'allure est
à l'écran, et s'en va avec lui. Fixée, elle recouvrirait les réglages du message
et du numéro de document, où elle n'a rien à faire.

**Le contrôle mesure le GESTE, pas la feuille de style.** Vérifier que
`position: sticky` est écrit prouverait qu'une propriété existe, pas qu'elle
agit — un parent en `overflow: hidden` la neutralise sans rien changer au CSS.
La suite descend donc jusqu'à la dernière police et regarde où est la feuille,
comme lui : elle exige au moins la moitié de l'aperçu dans l'écran, puis touche
une police et vérifie que la feuille restée en haut s'est repeinte. **Vu rougir**
contre un `relative` : « il ne reste que 0 px d'aperçu sur 217 ».

**Deux pièges d'outillage, payés ici :** le contrôle visait Playfair, qu'un cas
plus haut dans la même suite avait déjà posé — il comparait la même famille
avant et après et accusait un écran juste ; il lit désormais l'état et vise
ailleurs. Et il **repose ce qu'il a trouvé** : le cas suivant vérifie que le
choix survit au rechargement et attend Playfair, si bien que laisser Inter
derrière soi le faisait rougir sur du code juste.

### Planche 96 : voir son devis pendant qu'on le change

**Sa demande**, capture de l'écran des réglages à l'appui : *« problème : lorsque
je modifie mon devis, je suis obligé de descendre pour voir les modifications ;
il faut mieux organiser la page pour pouvoir voir ce qu'on modifie. Propose, ne
code rien. »*

**Rien n'est codé** (`CLAUDE.md` §3 bis). La planche est à
`appli/allure-mieux-rangee.html`, n° 96.

**Un défaut d'ORDRE, pas de contenu.** L'écran range logo → dix typographies
(cinq rangées) → fond de page → couleur d'accent → **puis** « L'allure de la
page ». L'aperçu tombe donc à plus de 900 px du haut du bloc : essayer neuf
polices coûte dix-huit trajets. Rien n'est de trop sur cet écran ; tout y est
rangé dans le sens qui l'oblige à voyager.

**Trois rangements, et chacun dit ce qu'il coûte :**

| | Ce qu'il donne | Ce qu'il coûte |
|---|---|---|
| **A** l'aperçu en tête | on le voit en arrivant | arrivé aux polices, il ressort de l'écran — la moitié du problème seulement |
| **B** l'aperçu collé en haut | il suit chaque choix, sans un aller-retour | le tiers haut de l'écran, en permanence |
| **C** feuille pleine page, réglages en tiroir | la plus grande feuille, proche de ce que le client reçoit | un geste de plus à apprendre |

**La planche se mesure elle-même** : sous le téléphone, elle annonce à chaque
instant si la feuille est dans l'écran, et de combien de pixels il faudrait
remonter sinon. Dire « c'est trop bas » sans chiffre est une opinion.

**Le contrôle a été vu rougir quatre fois**, et le quatrième a changé le
dessin : le tiroir de C, à 74 % de l'écran, recouvrait la feuille entière — on
réglait de nouveau à l'aveugle, c'est-à-dire le défaut qu'il signale. Ramené à
62 %, l'en-tête du devis reste sous les yeux, et le contrôle l'exige désormais.

**Un défaut de la planche trouvé par son propre contrôle**, et qui aurait passé
inaperçu à l'œil : les piles de polices contiennent des guillemets doubles
(`"Playfair Display", …`), et elles finissaient dans un attribut `style="…"`
construit à la main — le guillemet refermait l'attribut au milieu, et la police
ne s'appliquait pas, **en silence**. Le contrôle lisait deux fois la même
famille avant et après le choix.

---

## 2026-08-23

### On peut enfin discuter du plan — et Atlas ne dessine pas, il pose un paramètre

**Sa demande du 21 août, codée :** *« j'ai besoin que si l'utilisateur a besoin
de te demander de faire une modification, qu'il puisse le faire — une petite
interface pour qu'il puisse discuter avec toi »*.

**Sous le plan, un fil et un champ libre.** Il écrit ce qu'il veut ; Atlas
répond, et s'il y a lieu **pose une consigne** — marque, corps, matériel d'une
zone, buse d'une zone, sonde de pluie. C'est le calcul qui refait tout : le
tracé, les métrés et les pièces restent issus de la même source. Un plan
retouché à la main ne se recalculerait plus.

**Ses deux bornes, à la lettre.** La discussion ne s'affiche qu'AVEC un plan —
elle ne peut donc jamais en créer un. Et **aucune phrase pré-écrite** : la
maquette en montrait trois, elle le disait elle-même ; des suggestions
apprennent à ne demander que ce qui est proposé.

**La nourrice ne se discute pas.** Pour la déplacer, on corrige le croquis — et
l'écran le dit sous le champ, pour qu'il ne l'essaie pas et n'y voie une panne.

**Aucune référence inventée.** Une buse hors catalogue est refusée, jamais
rapprochée de la plus proche — mais la réponse d'Atlas reste, et il lit pourquoi
la modification n'a pas été appliquée.

**Non vérifié ici :** le parcours entier, qui demande une clé de vision que cet
environnement n'a pas. Les règles pures, elles, le sont.

Détail : `ARCHITECTURE.md` §167.
### Planche 92 — un blanc à reflets bleutés, neuf écrans qui s'essaient

**Trois demandes en une soirée, et chacune a corrigé la précédente.**

| Ce qu'il a dit | Ce que ça a changé |
|---|---|
| *« un fond blanc avec des reflets bleutés un peu »* | la planche |
| *« j'ai que le visuel de Brume »* | **trois bleus distincts**, pas un seul en trois habits |
| *« des maquettes pour chaque page, que je voie comment ça va rendre »* | **neuf écrans**, la barre du bas fonctionne |

**Ce que la demande mélangeait, et que la planche sépare :** la **couleur** tient
dans les huit valeurs de `chartes.ts` sans toucher un écran ; l'**allure** —
typographie, rayons, ombre, air — les touche tous. Deux réglages indépendants,
douze combinaisons, sur chacun des neuf écrans.

**Pourquoi neuf et pas cinquante-sept.** Ce qu'il faut éprouver n'est pas le
nombre d'écrans mais **les formes de contenu qui cassent une allure** : le
planning (42 cases, deux barres par jour) et le devis (tableau de lignes et
totaux) sont là pour ça. Une allure qui tient sur trois cartes de chantier ne
prouve rien.

**DEUX DÉFAUTS SORTIS D'UNE CAPTURE, JAMAIS D'UN TEST** — les cinquième et
sixième de ce dépôt :

1. la **barre du bas** gardait le crème d'Origine sur les allures bleutées. Un
   jeton composé (`--barre-fond:var(--fond)`) déclaré sur `:root` est substitué
   **là où il est déclaré**, pas là où il est lu ;
2. le **panneau de réglages masquait le titre** de l'écran quand on changeait de
   page — on jugeait donc une allure sans voir son en-tête, ce qui est
   exactement ce qu'on lui demandait de juger.

Les deux sont désormais tenus par le parcours navigateur, qui **refuse aussi de
conclure sur un titre de hauteur nulle** : l'absence de matière à mesurer n'est
pas un succès.

### La première version de cette planche — trois habits pour un seul bleu

Sa demande, capture de « Apparence » à l'appui : *« crée-moi une version de
l'appli plus stylée dans le style des applis d'aujourd'hui, avec un fond blanc
avec des reflets bleutés un peu. Propose avant de coder quoi que ce soit. »*
Rien dans `src/` — `CLAUDE.md` §3 bis.

**Ce que la demande mélange, et que la planche sépare.** Elle porte deux choses
qui n'ont ni le même coût ni le même risque :

| | Ce que ça touche |
|---|---|
| **la couleur** | huit valeurs dans `chartes.ts`. **Aucun écran** |
| **l'allure** — typographie, rayons, ombres, air | **tous** les écrans |

D'où trois propositions du moins cher au plus engageant — A · Brume (la couleur
seule), B · Brume+ (couleur et allure), C · Verre (halos, cartes flottantes,
barre dépolie) — et l'allure d'aujourd'hui gardée comme quatrième bouton, pour
qu'elles se jugent contre quelque chose plutôt que dans le vide.

**Sous chacune, ce qu'elle coûte ET ce qu'elle risque.** C est la plus proche de
ce qu'il décrit, et c'est aussi celle dont le flou peut faire saccader une liste
de quarante chantiers sur un téléphone de trois ans — un choix d'apparence se
paie en écrans à reprendre et en images par seconde, et cela ne se lit sur
aucune capture.

**UN DÉFAUT SORTI D'UNE CAPTURE, JAMAIS D'UN TEST — la cinquième fois dans ce
dépôt.** La barre du bas gardait le crème d'Origine sur les deux allures
bleutées. La cause est un piège de CSS qui ne se voit pas à la lecture : un jeton
composé (`--barre-fond:var(--fond)`) déclaré sur `:root` est substitué **là où il
est déclaré**, donc contre le fond de la racine — pas contre celui du look. Le
parcours navigateur passait au vert pendant ce temps. Il compare désormais le
fond de la barre à celui de la page, allure par allure.

**Le chemin entier a été parcouru**, d'`essais.html` à la planche : la tuile se
touche (64 px), la page s'ouvre, les boutons répondent. Trois fois une adresse
lui a été transmise sans que personne ne l'ait ouverte, et trois fois c'est lui
qui a trouvé le défaut.

### Cinq réseaux pour 208 m² : le critère de choix des buses était à l'envers

*« Cinq réseaux pour ça ??????? »*, devant un plan de 12 × 12 et 8 × 8.

**On prenait la plus GRANDE buse qui pave** — le moins d'arroseurs possible. Mais
une grosse buse boit : son carré de 12 m partait en quatre 5000 Plus à
2,79 m³/h, soit **trois vannes à lui seul** quand une voie n'en passe que 1,53.
Les mêmes 144 m² en 3504 buse 0,75 tiennent sur **une** vanne.

Le critère est retourné : **le moins de vannes d'abord, le moins d'arroseurs
ensuite**. Neuf arroseurs se posent une fois ; une vanne coûte une électrovanne,
une station de programmateur, sa tranchée et son créneau d'arrosage.

**Le vrai fond du défaut était ailleurs**, et plus vicieux : le quinconce
resserrait les arroseurs tant que le damier ne couvrait pas, **sans plancher** —
jusqu'à 4 m d'écart pour une portée de 5,14. La pose sortait « trop serrée »,
donc écartée à la comparaison : la seule buse qui tenait sur une vanne était
disqualifiée par un tour de vis qui enfreignait déjà sa règle du 17 août,
*« jamais moins que la portée »*. Le damier ne se resserre plus sous la portée.

**Son jardin passe de cinq réseaux à deux**, et le carré de 12 m reçoit les
neuf 3504 buse 0,75 qu'il avait dessinés à la main le 21 août.

Détail : `ARCHITECTURE.md` §166.
### Son message au client s'écrit — un seul, pour ses trois documents

*« Y a-t-il un endroit dans les réglages où l'utilisateur peut rédiger ce
message automatique ? S'il n'y en a pas, il faut en créer un. »* Il n'y en avait
pas : le texte vivait dans le code, identique pour toutes les entreprises.

**Ses trois décisions, et elles commandent tout :** le réglage vit dans « Devis
& factures » (A) ; **le lien est obligatoire** — Atlas refuse d'enregistrer sans
lui, à l'écran comme au serveur ; et c'est **un seul message pour les trois
documents**.

**La troisième demandait un arbitrage, et il l'a pris en images.** Un texte
unique et littéral ferait dire à sa facture *« Voici votre devis, choisissez
votre date »*, et l'échéance disparaîtrait. Devant les six bulles de la planche
— ses trois documents, dans les deux façons de faire — il a répondu **« façon
1 »** : il écrit le cadre, Atlas pose la phrase du milieu, à l'endroit où il
met `[document]`.

**Ce qui change dans ce que ses clients reçoivent, et il faut le dire.** La
phrase du devis tenait en deux morceaux, l'un avant le lien, l'autre après ;
un seul emplacement ne peut pas porter les deux. Les deux idées sont réunies
avant le lien — et le « vous POUVEZ » qu'il avait corrigé le 13 août est
resté, un contrôle l'exigeait. L'échéance de la facture, elle, remonte avant le
lien pour la même raison.

**`null` en base veut dire « celui d'Atlas », jamais « vide ».** Recopier le
texte par défaut dans la colonne figerait chaque entreprise sur la version du
jour : une correction ultérieure ne l'atteindrait plus, et personne ne s'en
apercevrait. Le texte d'Atlas retapé à l'identique redevient donc `null`.

**L'objet du courriel ne se règle pas** : il ne se lit que par courriel, jamais
par SMS, et un objet vide ou trompeur envoie le message aux indésirables.

### La pièce jointe à l'INRAE réécrite de sa main, et non de la nôtre

*« J'ai peur qu'il reconnaisse que ça soit fait par une IA. Or je n'ai pas envie
qu'il pense cela, car aujourd'hui l'IA fait encore peur. […] Toutes tes petites
phrases annexes que tu mets en gris pour expliquer, supprime-le. »*

Le document est repris à la première personne, en serif de bout en bout, et
signé. Sont partis : les légendes grises sous les images, les mots surlignés en
doré au fil du texte, la ligne « Document établi à l'intention de… », le « nous »
de société, et le titre « Le principe : le modèle observe, la base décide » — une
formule de conception, qui n'avait rien à faire devant un destinataire.

**Un paragraphe a été conservé contre la lecture littérale de sa demande**, et
cela lui a été dit : celui qui décrit ce que fait la photographie prise sur le
chantier. Son propre courriel l'écrit déjà de sa main — *« j'ai fait le choix de
ne jamais laisser une intelligence artificielle inventer un diagnostic »* — et
une annexe qui décrirait autre chose que la lettre qu'elle accompagne se
contredirait sous les yeux du lecteur. Surtout, une autorisation obtenue sur une
description fausse ne protège de rien le jour où l'institut ouvre l'application.

Ce qui a changé, c'est sa PLACE : le fonctionnement n'est plus le titre d'une
page, c'est un paragraphe parmi d'autres. Et il joue en sa faveur — ce que le
lecteur y voit, c'est un artisan qui a bridé son outil.

### La photo du platane : la licence tenait, la citation non

Sa question, devant la pièce jointe destinée à l'INRAE : *« tu es sûr que la
photo utilisée n'est pas une photo de l'INRAE, parce qu'il ne faut pas les
prendre pour des cons »*. Elle visait juste — c'est la seule affirmation du
document qui pouvait se retourner contre lui.

**Rien n'était éprouvable ici** : le mandataire bloque `commons.wikimedia.org`,
et la vignette servie par Commons ne porte aucune métadonnée. Il a ouvert la
page sur son téléphone. Le bandeau est bien **PD-USDA** — la licence enregistrée
était juste, mot pour mot.

**Mais la page demande une citation nommée que le dépôt ne portait pas :**
« Cite: Clemson University - USDA Cooperative Extension Slide Series,
Bugwood.org ». Le crédit disait « USDA, via Wikimedia Commons » : pas faux, et
pas ce que la source réclame. Corrigé dans la fiche, sous la photo à l'écran et
dans l'annotation n° 4 du document — une demande d'autorisation qui cite mal une
autre source se dessert elle-même.

**Ce que cela apprend, au-delà de cette photo :** une licence recopiée sans la
page qui la porte laisse passer ce que la page EXIGE en plus. Le contrôle
d'intégrité compare le fichier source à la base ; il ne compare rien à
l'original hors du dépôt. Pour toute image future, relever aussi le champ
**Permission**, pas seulement le bandeau de licence.

**Et la capture d'écran de la pièce jointe se refait désormais en une commande**
(`scripts/capture-inrae.mts`). Elle se remontait de mémoire, décrite en prose
dans un mode d'emploi : c'est exactement pourquoi elle a failli partir chez
l'INRAE avec l'ancien crédit affiché dessous. Le script refuse de rendre une
image si la fiche n'est pas en base, si une photo n'est pas chargée ou si une
boîte mesure zéro pixel.

### Le courriel à l'INRAE reprend sa version

Il a reformulé la première partie — d'où il vient, et pourquoi il fait cet
outil : des arbres abattus sous prétexte de maladie, sans diagnostic. Seuls
l'orthographe et quelques tournures sont corrigées ; l'ordre de ses idées ne
bouge pas, parce qu'un institut lit la différence entre un artisan qui explique
son métier et un texte lissé.

Deux écarts rendus plutôt que tranchés en silence : « célèbre » retiré devant le
nom de son école, et « pourrait atteindre quelques centaines » conservé — c'est
ce chiffre-là qui rend l'autorisation nécessaire.

### Les prix tapés sur l'écran du devis partent enfin chez le client

*« Le devis part à zéro euro chez la cliente, alors qu'il y a un arbre à tailler
et un à démonter »*, puis, quand on lui a répondu que rien n'était chiffré :
*« j'avais mis des prix, cinq cent cinquante et je ne sais plus combien, un devis
à mille trois cents euros »*.

**Il avait raison, et la première explication — juste en dessous — était
fausse.** Elle est laissée telle quelle : elle raconte le chemin, et le
garde-fou qu'elle a posé reste utile.

**Rien ne se perdait ; rien n'arrivait.** Ses prix étaient bien en base. Ce sont
les lignes du DOCUMENT qui manquaient : le devis ne se recompose qu'au
CHARGEMENT de l'écran, et tout prix tapé ensuite — c'est-à-dire tous ceux qu'on
tape vraiment — restait dehors. Mesuré sur son geste exact : écran à 660,00 €,
document à 0,00 € et zéro ligne.

Deux nœuds, et le second était le plus discret : l'envoi figeait le devis sans le
recomposer, **et** retenait l'identifiant venu du navigateur — celui du
chargement de la page. Or la page publique du client lit les lignes de ce
devis-là : le document pouvait être juste pendant que le lien pointait sur le
vide.

Le devis se recompose désormais **à l'ouverture de la feuille d'envoi**, et
l'identifiant vient du serveur. Ce que l'écran compte, ce qu'il montre et ce qui
part sont enfin la même chose.

**Et le garde-fou de l'entrée précédente accusait à tort :** il comptait les
lignes du document périmé et refusait un envoi à 660 €. C'est ce refus qui a
révélé la vraie cause. Détail dans `ARCHITECTURE.md` §159.


### Un devis vide ne part plus chez le client

*« Le devis part à zéro euro chez la cliente, alors qu'il y a un arbre à tailler
et un à démonter. Rien n'apparaît chez elle. »*

Sa cliente avait sous les yeux un document qui n'énonçait **rien** — ni
prestation ni prix — et un bouton « J'accepte ce devis » sous ce vide.

**Ce n'était pas une perte de données.** Les lignes du devis viennent des lignes
de PRIX, jamais des prestations : deux arbres décrits mais jamais chiffrés
donnent un devis authentiquement vide. Le document était juste ; c'est de l'avoir
laissé PARTIR qui était le défaut. L'envoi savait refuser un devis absent, un
canal non choisi, une coordonnée manquante — jamais un devis sans une ligne.

**La barrière porte sur les LIGNES, pas sur l'euro.** Un devis à 0,00 € peut être
légitime — un geste commercial, un déplacement offert — et le refuser
interdirait quelque chose qui est son droit. Un devis sans une seule ligne, lui,
n'est jamais légitime : il n'y a rien à accepter.

Le refus vit aux deux bouts depuis une seule règle : l'écran cache le bouton et
le serveur refuse de son côté, car cacher ne ferme rien. Et il passe **avant** le
canal — à quoi bon choisir comment joindre sa cliente pour lui envoyer un
document vide ?

**Le contrôle a d'abord été incapable d'échouer** : il attendait « aucune ligne »
à l'écran, phrase que l'éditeur de devis porte déjà. Il restait vert le garde-fou
retiré. Il vise maintenant une phrase qui n'appartient qu'au refus, et il a été
vu rouge. `ARCHITECTURE.md` §158.


### « La cliente ne peut pas proposer de jour » — le contrôle qui manquait sur son chemin

Son signalement, capture à l'appui : *« je n'ai pas coché la case pour que la
cliente ne puisse pas proposer de jour ; néanmoins elle ne peut quand même pas
proposer de jour »*.

**Cherché pour de bon, et NON REPRODUIT sur le code du jour** — c'est écrit ici
plutôt qu'annoncé corrigé, parce qu'une réparation supposée lui coûterait l'essai
puis l'aller-retour. Vérifié une chose après l'autre : l'interrupteur est ouvert
à chaque ouverture de la feuille, ce qui part en base vaut « autorisé » sans y
toucher — avec une date comme avec deux —, l'état ne survit pas à un envoi
annulé, et un seul chemin de production crée un envoi. Son envoi porte pourtant
« non autorisé », ce que seul un appui réel sur l'interrupteur produit.

**Ce qui manquait vraiment, et qui est livré :** le refus était éprouvé depuis
« Choisir la date », mais l'autorisation depuis l'ANCIEN écran d'envoi
seulement. Le chemin qu'il emprunte tous les jours n'avait donc aucun contrôle
sur la moitié qui l'intéresse — celle où il ne touche à rien. Le nouveau cas ne
touche à rien, délibérément, et il a été vu rouge sur son symptôme exact : deux
dates, aucune option pour en proposer une autre.

**Reste à trancher avec lui :** après l'envoi, rien ne lui dit ce que sa cliente
pourra faire. Il l'a découvert en ouvrant le lien — sans pouvoir distinguer un
appui malheureux d'une panne. Une maquette avant de toucher à l'écran.

### Un croquis à main levée se lit quand même — et l'attente souffle

**Sa correction :** *« il n'arrive pas à me lire mon croquis sous prétexte qu'il
n'est pas à l'échelle. Les utilisateurs ne vont pas s'amuser à faire des croquis
à l'échelle à chaque fois. Là, il y a tous les métrés. »*

**Les cotes commandent, le dessin ne fait qu'ordonner.** Un croquis à main levée
dit avec certitude qui est à gauche de qui ; il ne dit rien de fiable sur les
longueurs — c'est pour cela qu'on y écrit les métrés. Le plan n'est donc plus
refusé parce que le dessin n'est pas proportionné : les zones sont posées
d'après leurs cotes, et l'écart se dit en réserve.

**La sévérité reste où elle sert** : le trajet du regard, qui entre dans le
calcul de pression, garde sa règle stricte. Une pelouse placée de travers se
voit à l'œil ; une pression fausse ne se voit qu'en juillet.

**La haie donne l'échelle, elle aussi.** Sur son croquis elle longe tout le haut
du terrain et porte sa longueur : la lui refuser jetait la moitié de ce que le
dessin disait.

**Et l'agencement n'est plus un motif de tout refuser.** Métrés, piquage,
nourrice restent obligatoires ; un agencement illisible ne retire que le DESSIN.
Le plan sort — arroseurs, réseaux, pièces — et l'on dit pourquoi il n'est pas
dessiné.

**Le message accusait le mauvais coupable.** *« Aucune zone du croquis ne porte
à la fois ses cotes et sa place »* désignait ses métrés alors qu'ils étaient
tous là : le fautif était la lecture, qui n'avait rendu aucune proportion. La
consigne au modèle a été reprise — « tu ne devines jamais » ne s'applique pas
aux places, qui se mesurent sur l'image.

**Et l'attente souffle.** *« Lors de la lecture du croquis, mets les trois
petits points qui bougent. »* Trois points de suspension immobiles étaient
exactement le défaut relevé le 13 août sur la dictée : ils disent « rien ne se
passe » pendant que le travail est en cours, et la lecture d'un croquis est la
plus longue attente de l'application. Le geste est partagé
(`PointsQuiSoufflent`), jamais recopié.

Détail : `ARCHITECTURE.md` §149 et §150.
### Le client touché ne remonte plus : la fiche s'ouvre vers le bas

**Son défaut :** *« lorsque le client se trouve sur la partie haute de l'écran
[…] et que je clique dessus, le client remonte et la fiche chantier aussi. […]
tout remonte d'un bloc et je suis perdu, je ne sais plus où est mon client. Il
disparaît sous mes yeux. »*

Aucun défilement n'était en cause : ouvrir une fiche en referme une autre, et
quand celle-ci se trouvait plus haut dans la page, tout remontait de sa hauteur
— 422 px mesurés. Safari n'ancre pas le défilement ; la ligne touchée reste
désormais immobile sous le doigt (`useAncrageDuGeste`, `ARCHITECTURE.md` §157).

---

### La colonne « Fiche chantier » ne se remplit plus toute seule

*« Je viens de facturer monsieur Bernard […] néanmoins il y a une fiche chantier
qui s'est créée en même temps. Cette catégorie est réservée lorsque les
paysagistes créent une fiche chantier avec les informations type la tonte, la
taille, ce qu'ils ont fait. À aucun moment, lorsqu'une facture doit être
envoyée, une fiche chantier doit être créée. »*

**Le mécanisme, invisible à la lecture.** Émettre une facture POSE la date de
fin du chantier (`factures.ts` : `COALESCE(termine_at, now())`), et la colonne
listait les chantiers terminés. Facturer fabriquait donc une pièce que personne
n'avait écrite.

**Et le document qu'elle ouvrait était le mauvais.** C'est la feuille INTERNE —
équipe, créneau, note vocale, adresse du chantier —, celle que ses salariés
ouvrent dans la camionnette. Rangée au dossier d'un client, elle donnait à
croire qu'il l'avait reçue. Cette feuille reste joignable depuis le chantier :
elle n'a simplement plus sa place dans le dossier du client.

**Ce que la colonne porte désormais :** les fiches d'entretien qu'il a remplies
et ENVOYÉES (Paysage → Fiche de chantier), à l'adresse même que le client a
reçue. Un brouillon n'y entre pas — comme un devis non parti, il n'a ni date
d'envoi ni adresse publique.

**« Enregistrer » disparaît sur ces pièces-là**, et ce n'est pas un oubli : rien
ne fige ce rapport en fichier. Le laisser aurait fait descendre une page web
nommée `.pdf`, que rien n'ouvre — le défaut du 7 août 2026, retourné. La
vignette dit « FICHE » plutôt que « PDF », et « Ouvrir » prend la place du geste
principal.

**Un client sans aucun chantier voit quand même sa fiche.** Elle s'ouvre depuis
Paysage, se nomme, s'envoie — sans qu'aucun chantier n'existe. Le retour
anticipé « ce client n'a pas de chantier » l'aurait fait disparaître de son
dossier.

### « Ça ne marche pas » trois fois : la fiche donnait un geste qui ne pouvait rien

Son espace tournait, le serveur répondait sur 3000, et l'adresse publique rendait
un **404 nu** — pas Atlas. La fiche l'envoyait rendre le port « public ». Il l'a
fait. Trois fois.

**Le défaut n'était pas dans le geste, il était dans la question qu'on ne posait
pas.** « Privé » et « inconnu du relais » portent le même symptôme et n'ont pas
le même remède : basculer la visibilité d'un port que GitHub **n'a jamais
enregistré** ne peut rien — il n'y a rien à basculer. Rien, nulle part, ne
demandait au relais s'il connaissait ce port.

| | |
|---|---|
| `ouvrir-port.sh` | pose désormais la question — `gh codespace ports` — et rend **`non-declare`** quand le port n'y figure pas |
| Le refus de `gh` | partait à `/dev/null` et se lisait « échec », un mot qui ne désigne personne. Il est **cité**, coupé à 160 caractères : la fiche se lit sur un téléphone |
| `_verdict-port.mjs` | **lit enfin ce mot** et donne le geste qui correspond : réenregistrer le port, lever le refus de `gh`, ou reconstruire le conteneur |

**La règle qui reste, et qui vaut au-delà de ce cas :** un diagnostic qui donne
toujours le même remède quel que soit ce qu'il a rencontré n'est pas un
diagnostic, c'est un rituel. Et un rituel qui échoue deux fois s'apprend à être
ignoré — on perd alors la fiche entière, pas seulement sa dernière ligne.

**Éprouvé en le confrontant à l'ancienne version** : les quatre contrôles neufs
rougissent contre elle, et la nomment (`scripts/test-verdict-port.ts`).

### Et son espace installe désormais `gh` au lieu de le réclamer

**La vraie raison pour laquelle rien ne s'ouvrait chez lui**, et elle était
écrite depuis le 10 août : l'image de son conteneur n'embarque pas `gh`. La
fonctionnalité déclarée dans `devcontainer.json` ne vaut que pour un espace **à
naître** — le sien est plus ancien. Rien, chez lui, ne POUVAIT ouvrir ce port :
le démarrage rendait `sans-gh` et le renvoyait viser un panneau minuscule sur un
écran de six pouces. Quatrième fois que ce piège coûte une soirée
(`ARCHITECTURE.md` §55).

`ouvrir-port.sh` tente donc l'installation avant d'abandonner. **Bornée à
90 secondes**, muette, et sans pouvoir faire tomber le démarrage : si elle
échoue, on retombe sur `sans-gh` — l'état d'avant, jamais pire.

**NON ÉPROUVÉE DANS L'ENVIRONNEMENT DE L'AGENT**, et c'est écrit plutôt que de la présenter comme sûre :
son mandataire réseau refuse les dépôts `apt` (403 sur `cli.github.com`). Ce qui
EST éprouvé, et qui fonde la décision de la livrer quand même : le chemin
dégradé rend `sans-gh` en 1,6 seconde, exactement comme avant.

**Les quatre issues sont éprouvées avec un faux `gh`** qui distingue ses deux
sous-commandes (`scripts/test-ouvrir-port.ts`) : `ouvert`, `non-declare`,
`échec:<raison>`, et la liste muette qui ne fait **pas** conclure à une absence.

**Ce qui n'a PAS pu être reproduit ici, et s'écrit comme tel** : cet
environnement n'est pas un espace GitHub. Le nouveau mot `non-declare` est
éprouvé sur la règle qui le lit, pas sur un vrai relais — c'est au prochain
allumage de son espace que la fiche le dira, ou non.
### Audit de sécurité, lot 1 : six trous fermés, dont trois qui ouvraient un compte

Un audit hostile complet a été mené sur le dépôt (base montée, RLS attaquée en
SQL, historique Git balayé, `npm audit`). **L'isolation entre entreprises a
tenu** : 42 tables sur 42 sous RLS forcée, écriture croisée refusée, lecture
sans contexte à zéro ligne, 189 appels à `withEntreprise` sur 189 conformes.
Ce qui manquait était autour d'elle.

**C1 — deviner un mot de passe n'était pas empêché.** Le seuil « cinq essais
par quart d'heure » se calait sur `x-forwarded-for`, un en-tête que celui qui
frappe écrit lui-même : il suffisait de le changer à chaque essai. Le
garde-fou de second rang laissait passer 28 800 essais par jour et par compte.
Et **tout disparaissait dès que Redis toussait**, puisqu'un magasin en panne
laissait tout passer. Trois couches désormais : la source n'est crue que
derrière un mandataire déclaré (`ATLAS_PROXY_SAUTS`) ; un compteur d'échecs
**en base** temporise par paliers, s'oublie au bout d'une heure et s'efface à
la première connexion réussie ; et un magasin de limitation en panne bascule
sur le compteur mémoire au lieu d'ouvrir la porte. Mesuré : **103 essais par
jour au lieu de 28 800**. Le mot de passe minimal passe de 8 à 12 caractères —
à la création et au changement seulement, aucun compte existant n'est mis
dehors.

**E1 — `npm run db:seed` pouvait vider une vraie base.** Son `TRUNCATE …
CASCADE` sur `entreprises` et `users` n'avait pour garde-fou qu'un commentaire.
Il exige maintenant de prouver sa cible : nom de base connu, hôte local, et
`NODE_ENV` qui n'est pas `production`. Forcer se dit en toutes lettres et
oblige alors à poser un mot de passe de démonstration — celui du dépôt est
public. Le banc et les 136 fichiers qui dépendent de `demo1234` sont intacts.

**E2 — l'agenda iCloud était une porte vers le réseau interne.** L'adresse du
calendrier d'écriture arrivait du navigateur, n'était vérifiée nulle part, et
servait d'adresse à `fetch` avec le mot de passe iCloud de l'artisan dans
l'en-tête. Un propriétaire d'entreprise pouvait faire émettre au serveur des
`PUT` vers le service de métadonnées de l'hébergeur. Désormais : `https`
obligatoire, domaine `icloud.com` obligatoire, adresses privées et de
bouclage refusées en v4 comme en v6, **chaque redirection revérifiée**, et le
calendrier choisi doit être l'un de ceux qu'Apple rend pour ce compte. Le
renvoi normal `caldav.icloud.com` → `p42-caldav.icloud.com` continue de passer.

**E3 — un salarié pouvait réécrire les prix de vente.** `poserPrixGrilleAction`
était la seule action de son fichier sans garde de rôle, et les écrans
`/reglages/prix` et `/reglages/prix/mesures` n'en avaient aucune : la
protection ne vivait que dans le sommaire des réglages. La règle du 13 août —
*« un salarié ne doit évidemment pas pouvoir modifier les tarifs »* — est
maintenant tenue par le serveur. **La garde est sur l'action et l'écran, jamais
dans le dépôt** : `apprendre-grille.ts` apprend les prix tout seul depuis les
devis, et la poser plus bas aurait empêché un salarié d'en établir un.

**M7 — `src/auth.ts` écrasait `trustHost`.** `auth.config.ts` calculait la
valeur avec soin et promettait qu'elle protégeait la production ; trois lignes
plus bas, un `trustHost: true` inconditionnel la remplaçait. La documentation
décrivait donc une protection qui n'existait pas — le pire des deux mondes.
Une seule règle désormais (`src/lib/confiance-hote.ts`). **Un déploiement
derrière un mandataire devra poser `AUTH_TRUST_HOST`**, sans quoi Auth.js
refusera chaque connexion : c'est écrit dans `.env.example`.

**M8 — une variable suffisait à ouvrir toute l'application.** Le profil banc
d'essai désactive la protection contre le CSRF des actions serveur. Posé par
erreur sur un vrai déploiement, il ouvrait tout. `src/server/env.ts` refuse
maintenant de démarrer sur la contradiction — profil banc **et** compartiment
S3, ou profil banc **et** `ATLAS_DEPLOIEMENT=production`. **Le critère n'est
surtout pas `NODE_ENV`** : le banc EST « production + profil banc », puisque
`next start` l'impose, et refuser là-dessus l'aurait éteint à la seconde.

Huit suites neuves, toutes écrites pour rougir sur l'ancien code. Ce qui reste
à faire (M1 à M12 hors M7/M8, F1 à F13) est dans `TODO.md`.
### Le banc accusait le mauvais coupable — Atlas signe maintenant ses réponses

*« L'appli ne se lance plus »*, puis une capture : son téléphone propose de
**télécharger** un fichier au lieu d'ouvrir Atlas.

Sa fiche d'état annonçait *« réponse 404 d'ATLAS lui-même — c'est l'application
qui refuse »* et l'envoyait lire le journal du serveur. **C'était une
devinette** : le verdict tranchait sur la présence du mot « github » dans
l'en-tête `Server`, et un refus arrivé nu — sans en-tête ni type, ce qu'il a
justement reçu — tombait du mauvais côté. Deux hypothèses fausses lui ont été
livrées avant qu'on ne le voie : l'espace éteint, puis le port privé, démenti
par un *« je suis déjà en public »*.

`/api/health/live` pose désormais **`x-atlas-vivant: 1`**. Le relais ne peut pas
inventer cette signature : présente, c'est Atlas qui a répondu ; absente, la
requête n'est jamais arrivée jusqu'à lui. Et la fiche ne propose plus « deux
causes possibles, dans cet ordre » — devant lesquelles il essayait la première
et revenait — mais **un seul geste**, celui qui correspond.

**La signature devait être sur le fil, pas dans le code** : éprouvée d'abord sur
un binaire pas reconstruit, elle paraissait absente. Le contrôle interroge donc
le serveur pour de bon, et il a été vu rouge contre une route dont l'en-tête
avait été retiré. `ARCHITECTURE.md` §155.


### La TVA se lit en tête, et les gestes touchent le chiffre qu'ils font monter

*« Je trouve que l'outil Ma TVA à déclarer, il est caché, on ne le voit pas
trop »*, puis, sur l'écran voisin : *« on ne comprend pas trop que scanner ou
écrire à la main, c'est pour la TVA déductible. »*

Rien ne fonctionnait mal dans les deux cas : c'est la **place** qui mentait. Six
propositions dessinées et essayables au doigt (`docs/maquettes/85` et `86`), et
son choix, mot pour mot : **« Pour ma TVA la B / Et pour les achats la C »**.

**La B** met en tête de « Terminés » une carte **portant le montant** — pas un
lien à aller chercher, mais ce qu'il vient y voir. Elle nomme sa période et dit
« Reste à payer sur la période », parce que ce montant n'est **pas dû le jour où
il le lit** : il dépend du rythme et du régime, et n'est exigible qu'à
l'échéance.

**La C** remonte « Scanner un ticket » et « Écrire à la main » **contre**
l'encadré des chiffres. Aucun mot de plus n'a été ajouté : le lien se dit par la
continuité de la pièce.

**Ce qui a coûté le plus n'est pas l'écran, c'est le contrôle.** Une place ne
casse pas : la carte peut redescendre, les boutons repasser sous les achats, et
tout resterait vert. Deux mesures fausses ont été écrites avant les bonnes —
l'une comparait la carte à sa **propre mention**, qui descend avec elle, et
**restait verte sur le défaut dont elle portait le nom** ; l'autre comptait le
rembourrage d'une carte comme une brèche et **accusait à tort**. Détail dans
`ARCHITECTURE.md` §153.

### La note ne part sur aucun document — et le contrôle qui le promettait ne savait pas lire

La note de la feuille de chantier a été codée **deux fois le même jour**, par
deux sessions qui ne se voyaient pas. Celle arrivée la première sur `main` fait
foi ; la seconde a été retirée — deux colonnes pour la même chose auraient été
les deux vérités que le dépôt interdit.

Ce qu'elle apportait et qui reste : le contrôle de sa promesse. La note ne doit
sortir sur **aucun** document, et c'est ce qui l'autorise à y écrire ce qu'il ne
dirait pas devant le client. Or ce contrôle a été **vert deux fois de suite en
confrontation avec une note délibérément versée dans le PDF** : il cherchait les
mots dans les octets bruts d'un fichier comprimé, puis en clair dans un flux qui
écrit son texte en hexadécimal. Il prouve désormais d'abord qu'il sait **lire**
ce PDF. `ARCHITECTURE.md` §154.

### Deux réparations tombées à la batterie

La carte « Ma TVA à déclarer » gardait un coin à 12 px, contre sa règle du
12 août — même forme partout. Elle passe aux 4 px des plages : une capsule sur
une carte pleine largeur serait le galet que la charte refuse. Le contrôle porte
une exception **bornée à cette carte**, et tout autre bouton carré du même écran
le fait toujours rougir.

Et `test-envoyer-la-facture-e2e` visait mot pour mot « Une date, ou deux au choix
du client ? » — une phrase qu'il a fait changer le 23 août même. La suite mourait
sur du code juste, pour une demande exaucée : c'est `CLAUDE.md` §5 bis, et le
repère posé par l'autre session existait exactement pour ça.


### Le plan d'arrosage se DESSINE, à la forme du jardin lu

**Son feu vert :** *« très bien, tu peux coder la maquette »*, après sa demande
du 21 — *« il manque la photo, le schéma avec les réseaux, et l'implantation des
arroseurs ; les différents réseaux de couleurs »*.

**Ce qui manquait n'était pas le calcul.** Les têtes étaient posées depuis le
17 août, leur vanne connue depuis le 19 : rien ne SORTAIT. Le plan des maquettes
portait donc le contour de son jardin, écrit en dur — ce qui suffit pour une
planche et ne fait pas un outil.

**Le contour sort maintenant des zones**, par union et non par juxtaposition :
deux pelouses qui se touchent forment un seul terrain, et la ligne qui les
sépare n'existe pas sur place. Deux pelouses séparées par la maison donnent deux
morceaux, chacun tracé pour lui-même, avec un **pointillé** entre eux — le
cheminement passe hors de la pelouse, et ce mètre-là n'est pas mesuré.

**La tranchée se partage, et c'est ce qui la raccourcit.** Un segment déjà
creusé est facturé zéro au réseau suivant : sa règle du 21 août — *« lorsque
c'est égal il faut privilégier de réutiliser la tranchée, car c'est moins
fatigant »*. Sur son jardin en L, 53 ml de tranchée pour 69 ml de tuyau.

**Les pièces se lisent sur le dessin.** Une tête traversée porte un té, une tête
terminale un coude, un point à trois branches qui n'arrose rien un té égal.
`tés + coudes = arroseurs` tient donc par construction, **réseau par réseau** —
et la suite le vérifie ainsi, jamais au total : au total, deux erreurs
s'annulent, ce qu'il avait relevé.

**Sans nourrice, plus rien.** `CLAUDE.md` §4 bis appliqué à la lettre : pas
d'endroit définitif du regard, pas de plan — ni dessin ni liste de pièces, et
l'on dit ce qui manque. La nourrice n'est jamais déduite : la lecture du croquis
la cherche, et rend `null` plutôt que de la poser au piquage « pour dépanner ».

**Quatre défauts trouvés à la capture, aucun par un test** (`ARCHITECTURE.md`
§150) : les portées débordaient de la pelouse, le mot « nourrice » tombait sur
une cote, deux réseaux partageant une tranchée dessinaient le même trait — le
second effaçant le premier —, et la tranchée était du même jaune que le
troisième réseau. Les deux derniers ne se voient que sur un jardin à trois
réseaux, et la maquette validée n'en portait que deux.

Détail et partis pris : `ARCHITECTURE.md` §150.

### La pluviométrie ne sépare plus deux vannes, et les pièces se comptent en « 13x »

**Ses deux décisions :** *« ne prends pas en compte la pluviométrie »* et *« pour
le calcul des pièces, 13x et pas 13 u »*.

**La pluviométrie sort de la clé de secteur.** Elle y était depuis le 17 août —
c'est lui qui l'y avait mise, c'est lui qui l'en retire. Deux turbines de buses
différentes peuvent désormais partager une vanne ; elles versent alors des
millimètres/heure différents pour une même durée d'ouverture, et c'est lui qui
arbitre à l'arrosage. **Le matériel sépare toujours** : une turbine et une
tuyère ne s'ouvrent jamais ensemble.

**Un réseau peut donc porter deux modèles**, et le plan les nomme tous les deux,
comptés : « 4× Turbine 3504 · buse 0,75 » et « 1× Turbine 5000 Plus · buse 6,0 ».
N'en nommer qu'un ferait commander de travers.

**« 13x » remplace « 13 u »** partout où une pièce se compte — l'application, la
page publiée et la maquette. L'unité reste dans les données : les mètres restent
des mètres, « 80x de PE Ø25 » ne se commande pas. Une seule fonction sert les
deux écrans.

Détail : `ARCHITECTURE.md` §151.

### Une note sur la feuille de chantier — « penser à prendre le broyeur »

*« Entre "Copier l'adresse" et "Ouvrir le PDF", j'aimerais avoir un petit
encadré où l'utilisateur peut marquer quelque chose — penser à prendre le
broyeur, client plus disponible à partir de neuf heures. »*

**Cherché avant d'affirmer que c'était neuf** (`CLAUDE.md` §5 ter) : la table
`chantiers` ne portait aucun champ libre, `notes_vocales` est la dictée, et le
seul `note` du schéma appartenait aux paiements. Colonne posée par la
migration 0061, bornée à 2 000 caractères — la note descend avec la liste
entière du planning.

**La variante A retenue, et c'est LUI qui a tranché sans le savoir.** La
planche 93 proposait aussi une ligne discrète « ＋ Ajouter une note », plus
économe de 96 px sur chaque feuille. Devant l'image, il a répondu : *« B, y'a
rien ? Je vois rien. »* La ligne était pourtant là, en doré. **Une invitation
qu'il ne voit pas sur une capture, il ne la trouvera pas davantage sur un
chantier** — l'argument des 96 px ne pesait plus rien.

**Elle ne part sur aucun document, et sa raison éclaire le PDF sans les prix :**
*« elle peut rester là, car les salariés auront accès au planning ; justement,
c'est pour cela que je voulait le devis sans les prix »*. Le PDF est le devis
expurgé, destiné à sortir ; la note est un pense-bête interne, que ses équipes
lisent en ouvrant la feuille.

**Enregistrée en SORTANT du cadre**, jamais par un bouton : il range son
téléphone et démarre, et un bouton non touché perdrait la note. Le refus se dit
— une note perdue en silence, c'est le broyeur oublié alors qu'il croit l'avoir
noté (le piège du 11 août).

**Le vide efface**, il ne stocke pas une chaîne creuse : sinon l'écran
afficherait un cadre « rempli de rien », indistinguable d'une note oubliée. Et
une note démesurée est **tronquée, jamais refusée** — la borne vit en base, et
un refus lui ferait perdre ce qu'il vient d'écrire au doigt.

**`NOTE_MAX` vit dans `src/lib/`**, pas dans le dépôt : l'écran doit connaître
ce chiffre, et l'importer du serveur aurait tiré la base dans le navigateur.
Trois usages — l'écran, le dépôt, la base — un seul nombre.

Trois contrôles, dont celui qui compte : **une entreprise ne peut ni lire ni
écrire la note d'une autre.**

---

### « Déplacer » offrait des boutons qui n'écrivaient rien

*« Cliquer sur Déplacer ne déplace pas le chantier, ça ne fait rien du tout. »*

**Et c'était vrai, sur un chantier de plus d'une journée.** `departEtDuree`
protège la durée d'un chantier long — la raccourcir lui ferait perdre des jours
de travail en silence —, si bien que « Matin » et « Journée » y écrivent le
**même** état : le départ. Or `quandDuChantier` rendait « journee » dès deux
demi-journées : la pastille se posait sur « Journée », et « Matin » restait
éteint **tout en n'écrivant rien**. Deux boutons sur trois, morts.

Au-delà d'une journée, ce qu'il choisit est donc le **départ**, et l'écran le
dit : « Journée » disparaît, la pastille tombe sur « Matin » ou « Après-midi ».
Un bouton qui n'écrit rien se retire — le laisser en l'expliquant serait pire,
puisqu'il faudrait le lire pour savoir de ne pas s'en servir.

**Le contrôle qui tient ça ne vérifie pas un libellé mais une propriété :** pour
chaque durée, aucun bouton offert n'écrit l'état déjà en place. Il survivra au
prochain remaniement des mots, et il a été vu rouge contre l'ancienne règle.

**`quandDuChantier` a quitté l'écran pour `src/lib/`** : c'est une règle, pas un
dessin, et enfermée dans un composant elle ne s'éprouvait qu'au navigateur
(`CLAUDE.md` §3). Son défaut a d'ailleurs survécu tout ce temps pour cette
raison.

**Et le refus est devenu bavard.** `if (!r.succes) return;` avalait toute erreur
du serveur : « Déplacer » était alors indistinguable d'un bouton mort. C'est le
piège du 11 août 2026 — *« Impossible d'enregistrer la note »* sans que personne
puisse savoir laquelle des quatre causes s'appliquait. Journalisé plutôt que
levé : le message d'une exception d'action serveur n'arrive jamais jusqu'à lui.

---

### Un jour plein se PRÉVIENT, il ne se refuse plus — et « trop tôt » disparaît

*« Si l'utilisateur juge qu'il peut rajouter un chantier, il doit pouvoir le
faire quand même. Nous on a mis un message disant que c'est complet. D'ailleurs
"trop tôt" veut rien dire, on comprend pas bien, faut changer ça. »*

**Le message.** « Trop tôt : proposez au moins après-demain, sinon vous vous
mettez en défaut » énonçait la règle au lieu de dire quoi faire, obligeait à
compter dans sa tête devant un calendrier qui affiche les dates, et le mettait
en tort pour un appui. Il **nomme** désormais le premier jour possible, et
l'offre d'un geste.

**Le refus.** Un jour plein bloquait l'envoi. C'est sa décision du 21 août,
appliquée là où elle manquait : *« il ne doit pas y avoir de limite d'ajout de
chantier par jour [...] nous, on prévient juste »*. Lui seul sait qu'une taille
de haie prend une heure.

**Et c'est ici que ses DEUX règles ont failli se contredire.** Le 22 août :
*« je peux proposer le 24 alors qu'un client a validé le 24 — ça ne doit jamais
se reproduire »*. Le 23 : *« il doit pouvoir le faire quand même »*. Ce qui les
sépare est la **délibération**, et rien d'autre :

| | |
|---|---|
| il force un jour écrit « complet » | sa décision — son client peut prendre la date |
| il propose un jour **libre** qui se remplit après | il n'a rien décidé — le client choisit ailleurs |

**Ces deux cas étaient indiscernables à la lecture du lien**, et le contrôle du
22 août l'a montré en rougissant : une date simplement « proposée » laissait
passer le second cas, c'est-à-dire le double chantier dans sa version course.
D'où la colonne `dates_forcees` (migration 0059) — la photographie, prise à
l'envoi, de ce qui était déjà plein ce jour-là. **Calculée au serveur**, jamais
reçue de l'écran : venue du navigateur, elle serait un moyen de forcer
n'importe quelle date.

**Ce qui reste refusé** : une date passée, ou au-delà de dix-huit mois. Ce ne
sont pas des arbitrages d'artisan. Un contrôle le fixe, sans quoi le
retournement aurait tout ouvert d'un coup.

**Et l'avertissement se voit.** Il s'affichait en gris discret — la couleur des
notes de bas de page —, or c'est le mot « complet » qu'il ne faut pas manquer
avant d'envoyer. Le gris ne reste que pour la remarque du week-end, qui
n'engage à rien.

**Deux contrôles retournés, jamais le libellé remis** (`CLAUDE.md` §5 bis) :
ceux qui réclamaient le refus vérifient désormais l'avertissement et la
possibilité de passer outre.


### « Terminés » : cinq chiffres en moins, et de l'air

**Ses six corrections du 23 août au soir**, capture de l'écran à l'appui :
*« Ma TVA à déclarer, mets-le en gras or ; la petite phrase en dessous d'août
2026, en gris, supprime-la ; là où il y a écrit trois à facturer et huit
facturés, supprime les montants qu'il y a avec, essaye de laisser un peu
d'espace entre cette phrase-là et le premier client, histoire qu'on fasse bien
la démarcation ; pareil le montant 5 028,00 € qui est sur la même ligne qu'août
2026, celui-là tu peux le supprimer. Il faut aérer un peu la page parce qu'il y
a énormément d'informations. »*

**Trois montants sont partis, et ils ne disaient pas la même chose.** Le total à
droite du mois ne comptait que le mois affiché ; les deux montants de la phrase
comptaient tous les mois ; les lignes en dessous, elles, ne montrent que le mois
affiché. Trois portées différentes sur quatre centimètres d'écran : on les
lisait comme une contradiction, et l'on cessait de croire la liste. Ce qu'on
additionne se lit dans les lignes.

**Le titre de la carte de TVA passe en or gras.** C'était l'élément le plus pâle
de la carte alors qu'il nomme l'outil dont il disait le matin même *« il est
caché, on ne le voit pas trop »* — déplacer la carte en tête ne suffisait pas.

**La mention grise sous la carte est retirée**, et ce n'est possible que pour
une raison : ce que `docs/AGENT.md` §6 exige — Atlas prépare le relevé, il ne le
déclare pas — s'écrit en toutes lettres **au bas du relevé lui-même**, là où les
chiffres se lisent. La retirer des deux endroits serait autre chose.

**« À facturer » passe en or**, sa correction du soir même : l'or porte ici ce
qu'il porte déjà sur les lignes en dessous — ce qui attend un geste de lui. Deux
comptes du même noir se lisaient comme un seul chiffre coupé en deux.

**La démarcation qu'il demande est un TRAIT, pas de l'espace.** De l'espace seul
se mange au premier ajout de contenu ; un trait tient. La phrase passe en noir
gras entière — sa demande du 22 août pour le compte des factures —, les montants
partis n'ayant plus rien à quoi s'opposer.

**Le probe `capture-termines.mts` a été adapté, pas contourné** : il exigeait le
compte du mois derrière son repère, que la phrase ne portait pas. Le repère est
allé sur la phrase, qui EST ce compte (`CLAUDE.md` §5 bis).

**Un défaut relevé au passage, et consigné plutôt que corrigé au jugé** : la
planche 90, que `page.tsx` désigne comme la référence de cet écran, a dérivé —
elle ignore la carte de TVA venue de la planche 86 et les retraits de ce soir.
Voir `TODO.md` : il faut trancher entre la remettre à niveau et lui retirer son
titre.

### Le temps passé se masque au client — codé, et il reste au patron

**Sa demande du 22 août, puis ses deux corrections du 23** devant la planche 92 :
*« raccourcis la phrase à "votre client ne le verra pas sur son compte rendu" »*
et *« enlève le 1 h 40 en gris à droite de la sélection de l'heure »*.

**Un interrupteur sur la ligne « Temps passé »**, avec son état écrit en toutes
lettres — Visible / Masqué. Un curseur nu se décode ; cet écran se regarde avec
un gant, entre deux chantiers.

**Masquer n'efface pas**, et c'est tout l'objet de la colonne `temps_visible`
(migration `0060`). Réutiliser `minutes IS NULL` pour masquer aurait confondu
deux choses différentes — « je n'ai pas chronométré » et « je ne veux pas le lui
dire » — et lui aurait fait perdre le chiffre qui dit ce qu'a coûté un chantier.

**Le masquage se décide au SERVEUR, jamais à l'écran.** `lireRapportParJeton`
rend `minutes: null` quand c'est masqué : rendre la durée puis la cacher au
rendu la laisserait dans le HTML du client, à portée d'un clic droit — le défaut
même que le tri des prestations faites évite depuis le 16 août.

**Et l'empreinte scelle ce que le client A LU.** Un temps masqué n'entre pas
dans le contenu haché : y sceller une durée absente de sa page la rendrait
indéfendable le jour où il conteste le passage. Deux fiches identiques, l'une
montrant son temps et l'autre le masquant, portent donc deux empreintes
différentes — c'est ce que le nouveau cas vérifie.

**Le défaut est `true`** : c'est ce que l'application faisait déjà, et repeindre
en masqués les rapports déjà partis changerait ce que des clients ont lu.

**Le total gris à droite de la molette est parti**, à sa demande : les deux
listes disent déjà « 1 h » et « 45 ».

Trois contrôles neufs, **tous vus rougir** contre l'état dégradé qu'ils
prétendent attraper — une lecture publique qui ignore le masquage, un masquage
qui efface la durée, une empreinte qui scelle le temps caché.


### La durée passe sous le nom, et le filet du « + » disparaît

*« Le "une journée" en doré, mets-le sous le nom, et la ligne qui se trouve
entre le nom et le "+ Ajouter un chantier", supprime-la. »*

**Corrigé sur la planche 86 D'ABORD**, puis dans l'écran (`CLAUDE.md` §3 bis) —
la planche reste la référence des planifiés, et c'est elle qu'il ouvre.

**Le filet n'existait que dans l'écran.** La planche n'en porte pas :
`AjoutAuJour` en avait ajouté un, et il refermait la journée juste avant le
geste qui la prolonge. Retiré des trois états du bloc — au repos comme pendant
le choix —, sans quoi il serait apparu à l'appui pour disparaître ensuite.

**Ce que le déplacement corrige, au-delà du goût.** À côté du nom, la durée lui
disputait la largeur : sur sa capture, « Chantier test — Abri Pornic » cassait
en deux lignes et « une demi-journée » finissait seule en dessous, à gauche,
sans qu'on sache à quoi elle se rapportait. Dessous, elle y est toujours.

**Un contrôle a été RETOURNÉ, pas supprimé.** `test-ligne-planning-e2e.ts`
exigeait la ligne entière sous 30 px de haut — c'est-à-dire tout sur une seule
ligne, l'inverse exact de ce qu'il demande aujourd'hui. Ce qu'il défendait
vraiment, c'est que **le nom du chantier ne paie pas la phrase** : il mesure
donc maintenant la hauteur du NOM seul, et vérifie en plus que la durée est
bien SOUS lui (`CLAUDE.md` §5 bis). Sa sonde a été corrigée au passage : elle
lisait `childNodes[0]`, ce qui ne marchait que tant que le nom était un nœud de
texte nu.

Mesuré dans un vrai navigateur, à 390 px : durée sous le nom, nom sur une seule
ligne (23 px), et `border-top: 0px` au-dessus du « + ».

### Rien à poser : le geste « Ajouter un chantier » disparaît

**Sa remarque, capture à l'appui :** *« lorsqu'aucun chantier n'attend de jour,
il ne faudrait pas que le bouton "Ajouter un chantier" apparaisse à l'écran, car
il peut nous induire en erreur »*.

**Il avait raison au sens strict, et c'est ce qui rend la correction évidente :
ce geste ne CRÉE pas de chantier.** Il ouvre la liste de ceux qui attendent une
date, et les pose sur la journée. Sans aucun chantier en attente, il ne pouvait
mener qu'à « Aucun chantier n'attend de jour » — une promesse suivie d'un refus.
Et la même phrase s'écrivait déjà sous « Sans date », deux lignes plus bas :
l'écran la disait deux fois.

**Le bouton DISPARAÎT, il ne se grise pas.** Un rond doré éteint reste un rond
doré : on appuie dessus pour savoir pourquoi il est éteint, et l'on retombe dans
le même cul-de-sac par un chemin plus long.

Le repli « Aucun chantier n'attend de jour » qui vivait dans ce geste est retiré
avec lui : on ne peut plus y arriver, et le garder aurait été une branche morte.

**Deux mesures, et la seconde tient la première.** L'une éprouve qu'aucun bouton
ne subsiste quand rien n'attend — l'état est installé par la base, puis rendu, y
compris si la mesure échoue, car le compte de démonstration sert aux cent quatre
suites. L'autre éprouve qu'il **revient** dès qu'un chantier attend : sans elle,
un bouton supprimé pour de bon passerait au vert.

---

## 2026-08-22

### Planche 92 : le temps passé, montré ou non sur le compte rendu du client

**Sa demande, capture de la fiche d'entretien à l'appui :** *« il faudrait
mettre un petit bouton on/off pour si l'utilisateur ne veut pas que le temps
apparaisse sur la fiche, pouvoir l'effacer — on, le temps apparaîtrait sur la
fiche ; off, il n'apparaîtrait pas »*.

**Rien n'est codé** (`CLAUDE.md` §3 bis : une demande de geste se dessine
avant de toucher `src/`, et « c'est tout petit » n'est pas une exception).
La planche est à `appli/temps-sur-la-fiche.html`, n° 92.

**Ce qu'elle tranche, et qui n'allait pas de soi :**

· **« Effacer » ne veut pas dire OUBLIER.** La durée reste enregistrée sur le
  passage — elle sert au patron, pas seulement au client —, et seul le compte
  rendu l'ignore. Une phrase le dit sous la molette quand c'est éteint : sans
  elle, il croit avoir perdu sa durée et la ressaisit au passage suivant.
· **L'état se lit en toutes lettres**, « Visible » / « Masqué ». Un curseur nu
  se décode ; cet écran se regarde avec un gant, entre deux chantiers.
· **La ligne du client DISPARAÎT**, elle ne se grise pas : c'est ce que le
  compte rendu fera pour de bon (`src/app/entretien/[jeton]/page.tsx` ne rend
  ce paragraphe que si `rapport.minutes !== null`).
· **Les deux côtés se voient à la fois** — sa fiche, et ce que sa cliente
  reçoit. C'est le seul moyen de répondre à ce qu'il demande vraiment :
  « qu'est-ce que mon client voit ? ». Une capture ne le dirait pas.

**Deux questions lui sont posées sur la planche**, et la suite en dépend : le
réglage de départ (elle s'ouvre sur « Visible », ce que l'application fait
aujourd'hui) et le cas où il voudrait **ne rien saisir du tout**, qui serait
autre chose qu'un masquage.

Le contrôle (`scripts/verifier-maquette-temps-sur-la-fiche.mjs`, branché sur
`npm run verifier:maquette`) **a été vu rougir** contre les trois états dégradés
qu'il prétend attraper : une ligne cachée par une simple opacité — donc encore
lue et encore à sa place —, la phrase « reste enregistré » supprimée, et un
interrupteur qui survivait à l'envoi.

## 2026-08-22

### Le mode nuit se lit — huit couleurs claires écrites en dur, et trois signaux tenus pour immuables

**Sa capture du planning, en « Nuit », et six mots :** *« Le mode nuit est
illisible. Corrige ça. »* La pastille d'équipe portait « Julien ＋ » en blanc
sur un fond blanc cassé, les chiffres du week-end n'existaient pas, et
« incomplet » et « complet » étaient devenus deux blancs.

**Trois familles de fautes, toutes invisibles sur les cinq chartes claires.**

1. **Un crème écrit en dur sur l'accent.** Huit endroits posaient `#faf9f5`,
   `#fff` ou `fill="white"` sur `colors.rust`. Sur les claires, l'accent est un
   vert pin sombre : parfait. Sur Nuit et Sylve, **l'accent EST l'encre** — un
   crème sur un crème, 1,05 de contraste. `surPlein` remplace le tout, et vaut
   `card` : dans chacune des sept chartes, la plage et l'accent sont aux deux
   bouts de l'échelle. Sur Origine, `card` vaut `#faf9f5` au caractère près.
2. **Un voile d'encre écrit en dur.** Le calendrier éteignait ses week-ends
   avec `rgba(28,28,26,0.42)` — l'encre d'Origine. Sur un fond noir, du noir à
   42 % est du noir : les « 29 » et « 30 » de sa capture n'existaient pas
   (1,04). `voile(colors.ink, 0.42)` suit la charte, et retombe sur l'encre
   pleine là où `color-mix` manque : trop vu, jamais invisible.
3. **Trois couleurs de signal tenues pour immuables.** `design-tokens.ts`
   affirmait qu'alerte, bordeaux et vert pâle n'avaient pas à suivre la charte.
   Leur rôle est pourtant que quatre états se distinguent d'un coup d'œil — et
   sur les sombres, « incomplet » et « complet » tenaient 1,5, le dépassement
   1,76 contre son fond, un refus 2,5. Elles deviennent des jetons : la TEINTE
   du patron ne bouge pas, seule la clarté s'accorde au fond, et **uniquement
   quand elle en a besoin**.

**Les cinq chartes claires ne bougent pas d'un caractère**, et c'est vérifié :
la dérivation ne remonte la clarté que si le contraste manque, ce qui n'arrive
jamais sur un fond clair. Ce qu'il regarde tous les jours est intact.

**Deux contrôles, et aucun ne remplace l'autre.**
`test-chartes-lisibles.ts` mesure les sept palettes sans navigateur, en dix
secondes. `test-mode-sombre-lisible-e2e.ts` ouvre chaque écran deux fois — en
Origine puis en Nuit — et compare **le même texte à lui-même** : c'est le seul
qui pouvait voir une couleur écrite DANS un écran, hors de toute charte. Les
deux ont été confrontés à l'état d'avant le lot, et ils rougissent en nommant
« Julien ＋ » et les chiffres du week-end.

**Aucun seuil inventé.** Sur Origine, le bordeaux et le vert pin tiennent 1,10
l'un contre l'autre, et le chevron de navigation 2,6 : ce sont ses choix. Une
suite qui les ferait rougir accuserait le dessin qu'il a validé (`CLAUDE.md`
§5 bis). La règle retenue est *le sombre ne fait pas moins bien que le clair*,
et le clair se mesure au lieu de s'écrire.

Le détail : `ARCHITECTURE.md` §172.


### « Choisir la date » ouvre le calendrier du planning, et dit qui est déjà là

**Sa demande, puis sa validation :** *« lorsqu'on clique sur "Choisir la date"
et que le calendrier s'affiche pour proposer une date au client, on devrait
avoir le visuel du calendrier qui se trouve dans la catégorie planning, avec la
possibilité de cliquer sur les jours pour voir quels chantiers y sont déjà
affectés — comme ça on peut savoir si oui ou non on peut rajouter des clients
sur les jours »*, puis, devant la planche 91 : *« cette maquette est parfaite,
tu peux coder ça trait pour trait, ne change rien »*.

**Ce que l'écran d'avant ne pouvait pas dire.** Il montrait des ronds et
éteignait les jours impossibles — sans jamais dire POURQUOI ni ce qu'ils
portaient. Impossible de juger si l'on pouvait quand même s'y glisser, et le
patron n'avait qu'à le croire sur parole.

**Regarder n'est plus retenir**, et c'est le cœur du changement. Toucher une
case ouvre la journée : qui est là, à quelle demi-journée, avec quelle équipe,
et le verdict du serveur pour ce chantier-ci. C'est « Proposer ce jour » qui
engage la date — auparavant, un jour consulté par erreur partait chez le client.

**Un jour complet reste touchable**, à sa demande : c'est justement celui qu'il
veut regarder avant de décider. Il ne se propose simplement pas.

**Trois pièces sortent en partage plutôt qu'en copie**, et c'est ce qui empêche
les deux écrans de se contredire : `MoisCharge` (le dessin du mois),
`useOccupation` (la charge d'une demi-journée) et `contextePlanning` (le
chargement). Deux calendriers, deux calculs ou deux lectures séparés auraient
fini par peindre la même journée différemment à deux écrans d'écart — le défaut
que `CLAUDE.md` §3 interdit, et qui s'est déjà produit ici.

**La durée va jusqu'à 200 jours** — sa correction sur la planche : cent venait
de sa demande du 3 août, et un chantier de six mois ne s'y posait pas.

**Ce que la batterie a trouvé, et que la capture ne montrait pas :** trois
suites tenaient l'ancien geste. La case éteinte n'existe plus, l'exception des
tuiles de calendrier avait déménagé avec le dessin, et la fiche du jour portait
le même `data-jour` que les cases — deux éléments pour le même jour, et une
suite qui ne savait plus lequel viser.

### Le croquis dit enfin OÙ sont les choses — et le dernier trajet est compté

**Sa demande : « oui fais-le lire les proportions ».** Elle répond à ce que je
lui avais présenté comme impossible : le trajet du regard jusqu'au premier
arroseur, que je disais « non saisi ». Sa réponse : *« j'ai pas besoin de lui
dire, il a tous les métrés du terrain, il a juste à calculer »*.

**Il avait raison sur le fond, je me trompais sur le fait.** Le croquis PORTE
l'information — la nourrice y est dessinée, les zones aussi, et les cotes
donnent l'échelle. C'est la LECTURE qui ne relevait rien de tout ça : elle ne
rendait que des dimensions, jamais des places.

**Ce qui change :** la lecture demande maintenant, pour chaque zone et pour la
nourrice, une place en **fraction du dessin** (0 à 1). Pas en mètres — un
modèle voit qu'une pelouse occupe le tiers gauche, il ne voit pas qu'elle est à
douze mètres du regard.

**L'échelle se déduit des cotes déjà lues**, elle ne se demande pas. Une pelouse
de 16 m qui occupe 0,40 du croquis donne 40 m par unité. Chaque zone cotée
fournit ainsi jusqu'à deux estimations, et l'on retient la **médiane** — pas la
moyenne : un modèle qui se trompe sur une zone tirerait la moyenne vers son
erreur.

**Et l'on REFUSE de conclure quand les zones se contredisent.** Plus du double
d'écart entre estimations : le croquis n'est pas à l'échelle, ou la lecture est
fausse. On rend la raison, jamais une distance moyenne qui n'existe nulle part.

Sur le jardin d'exemple, trente mètres de trajet coûtent **0,29 bar** — la
pression au dernier arroseur passe de 2,28 à 2,01. Ce n'était pas un détail.

**La nourrice reste lue, jamais déduite** (`CLAUDE.md` §4 bis). Absente du
dessin, elle reste absente : le trajet n'est pas compté, et l'écran le dit.

**Un contrôle a rougi sur MON erreur, et c'est ce qui prouve qu'il sert.**
J'avais figé « 8 m » pour une distance en diagonale, en lisant les demi-côtés de
travers ; le calcul disait 11. Refaire l'opération à la main était le seul moyen
de trancher — c'est exactement ce que vaut une valeur figée dans une suite.

### Sa notice Rain Bird retire une pièce facturée pour rien

Il envoie la notice de ses électrovannes (`man_DV_DVF.pdf`, Rain Bird, P/N
231576-B) en réponse à la valeur que je disais manquante.

**Elle ne donne pas la perte de charge** — c'est une notice d'installation, pas
une fiche technique : ni courbe, ni tableau ΔP. Le forfait majorant de 0,25 bar
reste donc en place, et reste non relevé.

**Mais elle apprend trois choses**, toutes désormais au catalogue :

| | 075-DV (3/4") | 100-DV (1") |
|---|---|---|
| débit admis | 0,05 à 5,0 m³/h | 0,05 à 9,08 m³/h |
| pression admise | 1 à 10 bar | 1 à 10 bar |

Et surtout : *« if pressure is greater than 80 psi (5,5 bar), install a
pressure regulator on the line before the valve »*.

**Le réducteur de pression était facturé sur CHAQUE chantier** — une pièce que
j'avais posée d'office, sans source (`source:'provisoire'`). Chez lui, la source
donne 3 bar : la vanne travaille dans sa plage, le réducteur ne sert à rien. Il
n'apparaît plus qu'au-delà de 5,5 bar.

### « Il faut qu'il me calcule le nombre juste » — la prudence ne vaut que pour l'inconnu

Sa précision, aussitôt après avoir redressé la règle du sûr : *« faut pas pour
autant qu'il retire un arroseur, il faut qu'il me calcule le nombre juste »*.

La règle pouvait se lire de travers — « en cas de doute, moins d'arroseurs »
n'autorise pas à en retirer un au jugé. Elle distingue maintenant deux choses :

| | |
|---|---|
| ce qui se **calcule** — couverture, débit d'une buse, pertes | **exact**, sans marge ajoutée |
| ce qu'on **ignore** — une valeur non relevée, une longueur non saisie | prudent |

Retirer un arroseur « pour être tranquille » n'est pas de la prudence : c'est un
trou d'arrosage, et il se voit en juillet exactement comme la panne qu'on
voulait éviter.

### La colonne « référence » affichait des noms de variables

**Sa consigne, en majuscules et six points d'exclamation :** *« tu ne dois
surtout pas inventer de prix ni de référence !!!!!!! »*

**Aucun prix n'était en cause** — le catalogue n'en porte aucun, c'est la règle
depuis le 17 août et elle tenait. **Mais les références, si.** La liste de
matériel et la planche du plan affichaient `te-taraude-25-34-25`,
`electrovanne-100dv`, `regard-rect12`, `pehd25` : les clés internes du
catalogue, c'est-à-dire des noms de variables. Un paysagiste qui arrive chez
Aqua Plus en demandant un « te-taraude-25-34-25 » se fait regarder de travers.

Sur vingt-six lignes de matériel, **cinq seulement portaient une vraie
référence** — RA3504, RA3504-B075, RT1804, RBT636, OD501, OD502, celles qu'on a
relevées sur ses documents.

`CATALOGUE.referenceDe` en est désormais le seul juge : une référence ne
s'affiche que si l'entrée du catalogue porte un `releve` (« Aqua Plus 2026,
p. 11 »). Les autres lignes n'en montrent aucune — leur nom suffit au comptoir,
et le silence vaut mieux qu'une référence qui n'existe pas.

Un contrôle interdit maintenant à la planche d'en réafficher : il interroge le
catalogue au lieu de porter sa propre liste, parce qu'une liste recopiée dans un
contrôle finit par défendre le catalogue d'avant-hier — c'est ce qui était
arrivé à la légende le matin même.

### « Un arroseur de trop fait que le réseau ne se lève pas » — la règle était à l'envers

**Sa correction, et elle vise une règle que j'avais écrite le matin même.** Le
`CLAUDE.md` §4 ter disait : *« devant deux hypothèses également défendables,
retenir celle qui pose un arroseur de plus »*. Appliquée à un RÉSEAU, cette
formule produit exactement la panne qu'elle prétend éviter : une tête de plus
sur une vanne, c'est du débit en plus sur la même conduite, donc de la pression
en moins, donc des turbines qui sortent à moitié.

La règle est redressée, et elle se lit maintenant par grandeur :

| Devant un doute | Ce qu'on retient |
|---|---|
| combien d'arroseurs sur **une vanne** | **le moins**, quitte à ouvrir une vanne de plus |
| combien de **réseaux** | **le plus** |
| une perte de charge inconnue | **la plus forte** |
| une portée inconnue | **la plus courte** |

**Le code, lui, allait déjà dans le bon sens** — la marge de 0,85, le plafond du
tuyau et la portée réduite bornent tous le débit par vanne. C'est le vocabulaire
qui était faux, dans quatre commentaires et deux documents. Une règle mal
formulée finit par être appliquée telle qu'elle est écrite.

### Ce qui arrive au DERNIER arroseur est enfin calculé

Sa demande, après qu'on lui a nommé le dernier trou connu : *« oui corrige la
1 »*.

**Le défaut.** Seule l'amenée compteur → regard était comptée, et l'écran
l'avouait : *« ce calcul ne compte QUE l'amenée — ni les antennes, ni les
raccords, ni l'électrovanne »*. Ce qui restait au pied du dernier arroseur d'une
ligne, personne ne le savait. Or c'est lui qui décide : sans la pression à
laquelle sa buse est donnée, il porte moins loin que le plan ne le suppose, et
le coin de pelouse qu'il devait atteindre jaunit en juillet.

**Sur son jardin d'exemple, à 3 bar au compteur :**

| | |
|---|---|
| perdu dans l'amenée | 0,27 bar |
| perdu dans le réseau | **0,44 bar** |
| il arrive au dernier arroseur | **2,28 bar** |

Le réseau perd plus que l'amenée — l'électrovanne seule pèse davantage que
trente mètres de Ø25. C'est cela qui manquait, et les buses sont désormais
dimensionnées sur 2,28 bar et non sur 3.

**Le débit décroît le long de la ligne, et c'est tout le calcul.** Entre la
vanne et la première tête passe le débit du réseau entier ; entre la première et
la deuxième, ce débit moins une tête. Compter le débit total partout — le
raccourci tentant — donnerait 0,77 bar au lieu de 0,44 : assez pour condamner
des plans qui tiennent.

**Deux passes, jamais trois.** La pression au bout dépend des débits, qui
dépendent de la pression : on calcule un premier plan à la pression de la
source, on mesure ce qui se perd, on refait le plan à la pression obtenue. Une
troisième passe *remonterait* la pression (moins de débit, moins de perte) : on
tournerait autour de la valeur au lieu de s'en approcher. S'arrêter à deux garde
les pertes des débits les plus forts, donc le côté sûr.

**Deux valeurs ne viennent pas de ses catalogues**, et cela s'écrit plutôt que de
se taire : la perte de l'électrovanne (0,25 bar, forfait majorant) et la majoration
pour raccords (+15 %). Posées en majorant : une perte surestimée pose un
arroseur de plus, jamais un de moins.

**Ce qui reste dehors, et que l'écran dit :** le trajet du regard à la première
tête. Il dépend de l'endroit où la nourrice est posée, et aucune saisie ne le
donne. La pression annoncée est donc un plafond.

**Un contrôle a été pris en flagrant délit de ne rien prouver.** Il bornait la
perte à « moins du double du pire débit » — la version juste ET la version
fausse y passaient au vert. Il a fallu injecter le défaut pour s'en apercevoir.
La valeur est désormais figée à cinq millièmes de bar près : ce chiffre décide
du nombre d'arroseurs par ligne, il n'a pas le droit de bouger en silence.

### Un réseau est plafonné par SON TUYAU, plus seulement par le compteur

**C'est lui qui l'a déduit**, et il avait raison : *« tu ne viens pas de me dire
qu'en diamètre vingt-cinq c'était 1,76 m³/h ? Donc dans tous les cas le calcul
doit se faire là-dessus, peu importe qu'on ait 2 ou 1,80, non ? »*

**Le découpage ne regardait que la SOURCE.** Un réseau était coupé à
`débit du seau × 0,85`, sans jamais se demander si le tuyau pouvait le porter.
Or toutes ses lignes de réseau sont en Ø25 — c'est le diamètre de tous ses
raccords, té 25×3/4"×25 et coude 25×3/4".

| Source mesurée | Ancienne limite par réseau | Ce que le Ø25 passe |
|---|---|---|
| 1,80 m³/h | 1,53 | 1,76 — la source commandait, rien à voir |
| 3,00 m³/h | 2,55 | **1,76 — dépassé de 45 %** |
| 4,50 m³/h | 3,82 | **1,76 — plus du double** |

**Chez lui, le défaut ne se voyait pas** : son compteur donne 1,80, donc la
source a toujours commandé. Il serait apparu chez le premier utilisateur mieux
alimenté — l'eau à plus de 2 m/s dans la ligne, la pression qui tombe avant le
dernier arroseur, et un gazon jauni en juillet. Exactement ce que sa règle du
22 août interdit (`CLAUDE.md` §4 ter).

**La limite d'un réseau est désormais le plus petit des deux**, et l'écran dit
lequel commande : un artisan qui a mesuré 3 m³/h et voit ses réseaux coupés plus
tôt qu'attendu doit lire que c'est son Ø25, pas un défaut de calcul.

Le plafond du tuyau ne porte pas la marge de 0,85 en plus : les 1,5 m/s sont
déjà une limite de bonne pratique, l'empiler paierait deux fois la même
prudence, en vannes.

**Cinq contrôles rougissent si on retire le plafond** — le pire réseau monte à
1,97 puis 2,63 et 3,94 m³/h à mesure que la source grossit.

### Le débit au compteur reste à 1,80 — et on sait maintenant pourquoi

Sa précision du 22 août : *« je sais que nos fournisseurs, lorsqu'on se pique
après compteur, estiment au moins 2 m³/h »*. Et, sur la proposition de demander
le calibre du compteur plutôt qu'un seau : *« non, laisse le calcul au seau,
tout le monde a l'habitude de faire comme ça »*.

**Aucun code ne change** — c'est la raison qui manquait. Deux chiffres
coexistent : sa mesure au seau sur son compteur (1,80 m³/h) et le plancher que
son métier retient (2,00). Le `CLAUDE.md` §4 ter tranche : calculer sur 2,00
mettrait un arroseur de plus par réseau qu'un compteur à 1,80 ne peut
alimenter, et un réseau qui ne se lève pas se découvre en juillet. Calculer sur
1,80 chez quelqu'un qui a 2,00 coûte au pire une vanne de trop.

**Et le calibre du compteur est écarté**, avec sa raison : le seau est le geste
que tout le monde connaît. C'est écrit dans `mesure-debit.ts` pour que personne
ne rouvre la question.

### Les buses sont ramenées à la pression du chantier, plus à celle du catalogue

Sa demande, après avoir vu ce qui manquait encore : *« oui code le »*.

**Le défaut.** Le catalogue ne donne qu'UNE valeur par buse, à UNE pression de
référence — 2,5 bar pour ses turbines Rain Bird, 2 bar pour ses tuyères VAN. Le
calcul les prenait telles quelles, quelle que soit la pression du chantier. Sur
un robinet à 2 bar, cela mettait **un arroseur de trop par réseau** : la
pression tombe, les turbines sortent à moitié, et le gazon jaunit en bout de
ligne — le défaut le plus cher, parce qu'il ne se voit qu'en août.

**Le débit : de la physique.** L'eau qui sort d'un orifice suit la racine carrée
de la pression (Torricelli) : `Q(P) = Q_catalogue × √(P / P_catalogue)`. Une
5004 buse 3,0 donnée 0,71 m³/h à 2,5 bar en donne 0,63 à 2 bar et 0,78 à 3.
Corrigé **dans les deux sens** — sous-estimer un débit chargerait trop un
réseau, ce qui est exactement le défaut visé.

**La portée : réduite, jamais gonflée.** Aucune loi simple ne donne la portée
d'un jet — la balistique pure la ferait suivre la pression, mais l'air freine le
jet. Les tables des constructeurs montrent une variation de l'ordre de la racine
cubique, et c'est l'exposant retenu. **Il n'est pas relevé de ses catalogues à
lui** : au-dessus de la pression de référence, la portée du catalogue est donc
conservée telle quelle. Gonfler une portée sur une estimation ferait espacer les
arroseurs, et un espacement trop large est un trou d'arrosage qu'on ne découvre
qu'en juillet. En dessous on réduit : c'est le sens où se tromper coûte un
arroseur de plus, jamais une tache sèche. **Et l'écran le dit** — une réserve
apparaît sous le plan dès qu'une portée a été réduite.

**Ce que cela change sur un plan.** Son jardin d'exemple à 3 bar passe de trois
à quatre réseaux : les buses données à 2,5 bar débitent 9,5 % de plus qu'annoncé
à cette pression-là. Le plan d'avant tenait sur des débits sous-estimés.

**Ce qui reste, et qui n'est pas fait :** la pression retenue est celle de la
SOURCE, pas celle qui reste au pied du dernier arroseur — les pertes du réseau
lui-même ne sont toujours pas calculées (`TODO.md`). C'est un progrès, pas une
garantie.

**Les trois défauts plausibles ont été joués** — correction retirée, portée
gonflée vers le haut, loi linéaire au lieu de la racine — et chacun fait rougir
`test-arrosage-calcul.ts`. Le contrôle qui les attrape tient l'égalité exacte :
à quatre fois la pression, la demande doit valoir exactement le double.

### La légende du plan annonçait un arroseur que le plan ne posait pas

**C'est lui qui l'a vu**, et sa question était la bonne : *« il m'a déjà donné
4 arroseurs en 5004 buse 3 sur un seul réseau avec 3 bar de pression et du Ø25
pour le PEHD — est-ce correct ? »*

**Non, et de loin.** Quatre buses 3.0 de 5004 tirent 4 × 0,71 = **2,84 m³/h** :

| | |
|---|---|
| ce qu'un Ø25 laisse passer | 1,76 m³/h |
| ce que donne son compteur à 3 bar | 1,80 m³/h |
| ce que quatre 5004 buse 3.0 demandent | **2,84 m³/h** |

**Mais le calcul, lui, n'a jamais proposé ça.** Sur ce plan, il pose **neuf
turbines 3504 buse 0,75** (0,16 m³/h chacune, 1,44 sur le réseau) et **quatre
tuyères 12-VAN** (0,90). Les deux réseaux tiennent sous 1,80.

**Le mensonge était dans la LÉGENDE de `appli/arrosage-plan.html`**, restée sur
le matériel de la toute première version de la planche : « turbine 5004 · buse
3.0 · portée 6 m » à côté d'un plan de 3504 — et une portée de 6 m qui
n'appartient ni à l'une ni à l'autre (la 5004 buse 3.0 porte à 11,1 m, la 3504
buse 0,75 à 5,2 m).

**Et le contrôle TENAIT le mensonge en place.**
`verifier-maquette-arrosage-plan.mjs` exigeait littéralement `/turbine 5004/`,
`/buse 3\.0/` et `/portée 6 m/` : les libellés de la première version, recopiés
dans le contrôle. Le plan a changé de matériel, la légende est restée, et le
contrôle interdisait de la corriger. C'est le `CLAUDE.md` §5 bis retourné —
un contrôle qui réclame ce qui n'existe plus.

**Ce qu'il vérifie maintenant**, et qui ne peut plus mentir : la légende cite
une buse qui existe au catalogue **sous son nom exact**, elle annonce **la
portée du catalogue**, et elle nomme le matériel que **la liste des pièces
facture**. Les trois défauts — libellé périmé, portée inventée, légende
décalée de la commande — ont été joués et font rougir le contrôle en nommant
le coupable.

### Le diamètre du tuyau se calcule, et l'outil dit À PARTIR DE COMBIEN DE MÈTRES

Sa demande : *« ils sont également en capacité de me dire, passé un certain
nombre de mètres linéaires, qu'il faut passer du PEHD en diamètre vingt-cinq à
celui en diamètre trente-deux. J'aimerais que mon outil arrosage puisse faire la
même chose. »*

**Ce que le calcul savait déjà, et ce qui lui manquait.** Il répondait OUI ou
NON sur la longueur **saisie** — il fallait donc la ressaisir trois fois pour
trouver où la bascule se produit. Il annonce maintenant le **seuil** : « le Ø25
tient jusqu'à 73 m à ce débit, le Ø32 jusqu'à 248 m ». C'est le seul chiffre
utile avant de creuser, parce qu'il se compare au mètre ruban sur place.

C'est la formule de perte de charge déjà présente (Hazen-Williams), retournée :

    L max = budget × 10,2 × D^4,87 / (10,67 × (Q/C)^1,852)

le budget étant ce qui reste à la source une fois retirée la pression à laquelle
la buse posée est donnée au catalogue.

**Un second critère est entré, et il corrige un vrai défaut.** Le calcul ne
regardait que la perte de charge : un tuyau court n'en perd presque aucune,
donc **un Ø25 « passait » à n'importe quel débit pourvu qu'il soit assez
court**. C'est faux — au-delà de 1,5 m/s l'eau cogne, le coup de bélier fatigue
les électrovannes, et le bruit s'entend dans la maison. D'où les débits maximaux
que les fournisseurs annoncent par diamètre, et que l'outil applique désormais :
**1,76 m³/h en Ø25, 2,91 en Ø32**.

**Ce chiffre recoupe sa propre mesure**, et c'est ce qui permet de le croire :
au seau, sur son compteur en Ø25, il avait relevé 1,80 m³/h. La formule en donne
1,76 — le tuyau ne laissait pas passer davantage.

**Ce que la suite a appris en cours de route.** Le premier contrôle du seuil
disait `seuil > 0`. Confronté à la formule retournée de travers — multiplier au
lieu de diviser —, il est resté **vert** en annonçant « 0 m » : le seuil valait
quatre dix-millièmes de mètre. C'est le contrôle qui mesure zéro du `CLAUDE.md`
§5, dans sa version la plus sournoise, puisqu'il affichait le bon chiffre et
concluait le contraire. La suite exige maintenant une longueur **plausible**
(5 à 500 m), et éprouve la bascule un mètre avant et un mètre après le seuil.

**Non éprouvé ici :** l'écran de l'application n'affiche le seuil qu'une fois un
croquis lu, ce qui demande une clé d'IA que cet environnement n'a pas. La ligne
a été vérifiée sur la page publiée (`appli/arrosage.html`), au navigateur, dans
ses deux cas — Ø25 suffisant, et débit qui l'interdit.


### La place se compte en ÉQUIPES, plus en chantiers

*« Pourquoi le matin et l'après-midi de monsieur Eric s'affichent en
incomplet ? »* — Julien **et** Antoine y étaient. Puis, la planche 89 vue :
*« oui si c'est des journées complètes, non si c'est des demi-journées »*.

**Le défaut.** `occupationDemi` et `compterOccupation` divisaient le nombre de
**chantiers** par le nombre d'équipes : un chantier pour deux équipes valait la
moitié, quel que soit le nombre d'équipes réellement cochées dessus.
L'affectation par demi-journée, posée le 21 août, ne pesait donc sur **aucune
capacité** — elle était décorative. Conséquence : ce mardi-là partait chez ses
clients alors qu'il n'avait plus personne à envoyer.

**La règle.** Un chantier prend autant d'équipes qu'on lui en coche, et **au
moins une** — un chantier sans affectation reste du travail à faire, le compter
zéro viderait le planning d'un coup.

**Sa règle tombe d'elle-même du comptage par demi-journée**, et c'est ce qui
évite de la coder deux fois :

| Ce qu'il pose | Résultat |
|---|---|
| journée entière, ses 2 équipes | les deux créneaux sont pris → **le jour se ferme** |
| demi-journée, ses 2 équipes | seul le matin est pris → **l'après-midi reste offert** |
| 1 équipe sur 2 | la moitié → inchangé |

**Les QUATRE lectures de la place sont nourries de la même source** — l'écran
d'envoi, la validation de la date qu'il pose lui-même, la revérification de la
réponse du client, et le planning. Ne corriger que l'affichage aurait fait dire
« complet » au planning pendant que l'écran d'envoi offrait le jour : deux
vérités sur la même capacité (`CLAUDE.md` §3), c'est-à-dire le défaut d'origine
déplacé d'un écran.

**Les deux moitiés de sa règle ont leur contrôle, et chacun a été VU ROUGE sur
la faute qu'il garde** : celui de la journée contre l'ancienne règle, celui de
la demi-journée contre la simplification « toutes les équipes ⇒ jour fermé ».

**Et une assertion muette a été trouvée en chemin.** Les deux contrôles
interrogeaient d'abord `joursLibres` — qui ne rend que les **six premiers** jours
suggérés. Un jour situé plus loin en est absent quoi qu'il arrive : l'assertion
était donc vraie par construction, et celle de la journée « passait » sans rien
prouver. Elles lisent désormais `joursOccupes`, qui couvre douze mois.

---

### Les planifiés : la durée, plus de compte gris, plus de répétition

*« C'est exactement ce que je veux »* — planche 86 retenue le 22 août 2026, avec
une correction, puis : *« code-moi exactement ça »*.

**Ce que l'écran dit maintenant, et pourquoi.**

| Avant | Maintenant | Sa raison |
|---|---|---|
| « matin » en doré | **la durée** — « une demi-journée », « une journée », « 3 jours » | *« ce n'est pas clair quand il y a marqué le matin et l'après-midi »* |
| « 1 chantier · complet » en gris | rien | *« on n'a pas besoin d'avoir cette information-là »* |
| le jour et le nom réécrits sous la ligne | la ligne **se déplie sur place** | *« il y a une répétition qui se crée : deux fois la date, deux fois le nom »* |
| la demi-journée libre après la feuille | **sous le matin**, avant la feuille | *« il doit rester en dessous du matin même s'il est libre »* |

**La durée compte le CHANTIER, jamais ce qui est visible ce jour-là**
(`ditLaDuree`, `src/lib/planning-jour.ts`). Un chantier de trois jours n'occupe
que deux demi-journées sur la journée qu'on regarde : compter celles-là lui
ferait annoncer « une journée » — le malentendu même qu'il demande de faire
disparaître. La première version de la planche est tombée dedans.

**La demi-journée libre appartient à la JOURNÉE, pas au chantier** : c'est pour
cela qu'elle se rangeait après lui, donc après sa feuille, à trois écrans du
matin qu'elle complète. **Aucun contrôle pur ne pouvait le voir** —
`blocsDeLaJournee` la mettait déjà au bon rang, et c'est la feuille, rendue en
dehors de ces blocs, qui s'intercalait. Le contrôle neuf mesure donc les trois
ordonnées à l'écran, et refuse de conclure sur un élément absent.

**Le geste d'ajout a été extrait** (`AjoutAuJour`) : il appartient au jour, et
le laisser dans le volet d'un chantier l'aurait affiché autant de fois qu'il y a
de chantiers ouverts.

**Le chevron reste un LIEN, et c'est une suite du dépôt qui l'a tranché.** Il
avait d'abord été transformé en signe de repli, comme sur la planche —
`test-planning-vers-facture-e2e.ts` a rougi aussitôt : *« depuis le planning, le
chantier mène à son devis »*. Le chevron de la planche est son signe de repli à
elle ; sur cet écran, le NOM déplie et le chevron part. Les confondre coûtait le
seul chemin vers le devis d'un chantier posé — un chantier posé quitte l'onglet
« Chantiers », et la feuille n'offre aucun autre accès. C'est-à-dire exactement
ce qu'il signalait le 8 août 2026 : *« il se range dans les chantiers planifiés,
mais comment moi je fais pour avoir accès au devis ? »*

**La leçon :** une planche dessine ce qu'on VOIT, pas ce que chaque geste
promet. Deux signes identiques peuvent porter deux gestes différents, et c'est
la suite qui garde la différence.

**Les contrôles adaptés, jamais le libellé remis** (`CLAUDE.md` §5 bis) : celui
qui réclamait « 1 chantier » vérifie désormais que le compte a bien disparu et
que la charge se lit encore aux pastilles ; celui qui lisait « matin » sur la
ligne lit la durée ; celui qui visait le chantier par un `href` le vise par son
nom.

---

### Un jour déjà pris pouvait être proposé — et le client pouvait le retenir

*« Je peux proposer le 24 alors qu'un client a validé le 24 — corrige-moi ça !
Ça ne doit jamais se reproduire, c'est une erreur gravissime !!!! »*

**Le défaut.** Les trois chemins qui calculent l'occupation bornaient leur
requête sur `date_planifiee >= début` — le jour où le chantier **commence**. Un
chantier de trois jours parti le **jeudi** tient encore le **lundi** suivant :
sa date de départ tombe hors de la fenêtre, sa ligne n'est pas ramenée, et ce
lundi-là s'affiche **libre** alors qu'il est pris.

**Ce qui le rendait grave, et non pas seulement gênant.** L'écran d'envoi
n'était pas seul à se tromper : la **revérification de la réponse du client**
lisait exactement la même occupation tronquée. Rien ne rattrapait donc la faute
en aval — le client acceptait, le chantier se posait, et deux chantiers se
retrouvaient le même jour sans qu'un seul écran s'en aperçoive. Le contrôle
neuf le montre noir sur blanc contre l'ancienne borne : `succes: true` sur une
date déjà occupée.

**La correction.** Un prédicat unique, `encoreEnCoursDepuis`
(`src/server/repositories/occupation-chantiers.ts`), partagé par les trois
chemins — jamais trois copies (`CLAUDE.md` §3) :

```sql
date_planifiee + COALESCE(duree_demi_journees, 2) * INTERVAL '1 day' >= début
```

Reculer de `n` jours **calendaires** pour `n` demi-journées est toujours
généreux : `n` demi-journées valent `⌈n/2⌉` jours ouvrés, et même un départ le
vendredi ne creuse jamais l'écart au-delà. Trop ramener ne coûte rien —
`compterOccupation` recalcule ensuite les créneaux exacts.

**Trois contrôles, et ils ont été VUS ROUGES** contre l'ancienne borne, remise
exprès (`scripts/test-preparation-envoi.ts`) : le jour n'est plus suggéré,
l'envoi refuse de le proposer, et le client ne peut plus le retenir.

**Le troisième était d'abord vert pour un mauvais motif, et c'est la leçon.**
Il n'affirmait que `succes === false` — or `enregistrerReponse` refusait pour
`expire`, le lien ayant vieilli de mars à août faute de lui passer la date.
Vert des deux côtés de la correction, il ne prouvait rien. **Un contrôle qui
attend un refus doit nommer le motif attendu** : sans quoi il se contente du
premier refus venu, qui n'est presque jamais celui qu'on croit.

**Ce qui n'est PAS corrigé, parce que c'est son choix.** Avec deux équipes,
l'application propose un jour où une seule est prise — c'est le fonctionnement
voulu, mais aucun écran ne le signale. Planche 88,
`appli/envoi-jour-deja-pris.html`, en attente de sa réponse.

---

### Un devis accepté, invisible : le planning s'ouvre sur la mauvaise semaine

*« Un devis a été accepter mais rien n'ai visible sur mon planning »* — avec la
capture de la confirmation vue par son client : « Intervention prévue le lundi
24 août ».

**Reproduit à l'écran AVANT de répondre** (`CLAUDE.md` §1 bis), pas deviné :
fiche d'espace lue — son banc tourne et sert bien le planning réécrit —, chantier
inséré au 24 août en base locale, connexion réelle, capture.

**Rien n'a été perdu, et c'est la première chose à dire.** `enregistrerReponse`
écrit `date_planifiee`, `creneau_debut` et `duree_demi_journees` sur le chantier
dans la **même transaction** que la réponse du client : il ne peut pas y avoir
l'une sans l'autre. Le 24 août portait bien sa barre pleine dans le calendrier.

**Ce qui l'a trompé.** La liste des planifiés s'ouvre sur la semaine du jour
(`useState(() => lundiDe(aujourdHui))`). Samedi 22, cette semaine ne porte rien,
et l'écran écrit alors **« Aucun chantier posé cette semaine »** — une phrase
juste au mot près, et fausse pour qui la lit : le chantier est là, trois jours
plus loin. La seule trace du contraire tient dans une barre de 3 px, de la même
forme que celles des jours vides.

**La leçon, au-delà de ce cas :** un écran qui rend compte d'une **fenêtre**
(une semaine, un mois, une page) doit dire ce qu'il y a **hors de sa fenêtre**
quand elle est vide. Sans quoi son « aucun » se lit comme « il n'y en a nulle
part », et c'est le produit qu'on croit en panne.

**Rien n'est codé** : sur quelle semaine le planning s'ouvre est un choix
d'apparence, et il se dessine d'abord (`CLAUDE.md` §3 bis). Planche 87,
`appli/planning-semaine-ouverte.html` — trois écrans qui se promènent, une
seule fonction de peinture pour les trois.

**Au passage**, deux ancres restées ouvertes dans `docs/maquettes/index.html`
(planches 68 et 86) : chacune avalait la fiche suivante, qui devenait
inatteignable. Trouvé en comptant les `<a>` contre les `</a>`.

---

### La fiche client est enfin celle de sa maquette — les huit écarts d'un coup

**Sa phrase, devant l'écran :** *« C'est toujours pas la même version que celle
que je t'avais demandée. Ça fait déjà deux fois que je te le demande. Je ne
comprends pas pourquoi tu ne veux pas me la coder. »*

Il a raison, et la faute est nette : les écarts avaient été **relevés et
mesurés le matin même**, puis je lui ai demandé son feu vert au lieu de coder —
alors qu'il l'avait déjà donné deux fois (*« tu me la codes trait pour trait, tu
ne changes rien »*). Une liste d'écarts n'est pas un travail livré.

Ce qui manquait, et qui est en place : la flèche de retour sur la ligne du
titre en chevron nu ; le contour **or** des pastilles Mr / Mme ; le nom du
client au même corps que le téléphone ; le choix du canal **toujours visible** ;
les capsules du canal cernées, l'or quand il est pris ; le carré des photos en
74 × 74 avec son liseré **en tirets doré** ; « Je rédige mon devis » en pleine
largeur.

**La batterie a trouvé ce que la capture ne montrait pas.** La flèche ramenée
sur la ligne du titre lui prend trente-six pixels, et la phrase d'attente de la
dictée occupe les 190 px de droite : « Fiche client » se brisait en deux
pendant qu'Atlas travaillait. `test-attente-dictee-e2e` l'a vu. Le titre est
une étiquette, pas du texte : il garde sa largeur, c'est la phrase qui se
replie.

### La fiche d'état MESURE le port au lieu de le deviner

**Sa matinée du 22 août, et trois allers-retours perdus.** La fiche annonçait
« Port 3000 : PRIVÉ (sans-gh) » — sans jamais avoir regardé. Elle recopiait le
mot rendu au démarrage par `ouvrir-port.sh`, lequel ne dit pas l'état du port
mais ce que le script a pu FAIRE : « `gh` est absent, je n'ai pas pu le régler »
devenait « donc il est privé ». Il a fait les trois clics, puis : *« il est en
public déjà »*.

Une fiche existe pour éviter de raisonner sur une machine qu'on ne voit pas
(`CLAUDE.md` §1 bis). Celle-là raisonnait à notre place, et à tort.

L'espace s'appelle désormais par **son adresse publique**, celle de son
téléphone, et rapporte ce qui revient — en nommant qui a répondu, le relais de
GitHub ou Atlas, parce qu'un même 404 appelle deux gestes opposés. C'est ainsi
que la vraie panne est enfin sortie : **son installation de Next.js était
cassée** (`Cannot find module './detect-typo'`), le serveur ne démarrait plus,
et ni le port ni l'application n'y étaient pour quelque chose.
### « Terminés » refait : la B, codée

*« Je choisis la B avec les modifications que je viens de te demander. »*
La planche 90 est retenue et portée dans `src/app/termines/`.

**Elle est née « 86 », puis « 89 », et elle finit « 90 » — deux collisions en
une soirée.** Trois sessions dessinaient le même jour, et chacune a pris le
numéro libre sur SA copie de `main` : 86 pour les planifiés, 89 pour les deux
équipes. C'est la nôtre qui bouge les deux fois, parce qu'elle est celle qui
tient la fusion et que renuméroter chez soi ne réécrit pas le texte d'une
session qui tourne encore.

**Ce n'est pas une étourderie, c'est le numéro lui-même qui est fragile.** Le
relever sur `main` avant d'écrire ne suffit pas : entre le relevé et la poussée,
une autre session a publié. Troisième incident du genre après la §59 en double
du 11 août. Tant qu'il n'y a pas mieux, la règle utile est : **le numéro se
vérifie une dernière fois à la fusion, jamais à l'écriture** — et le fichier de
la planche ne le porte pas dans son nom (`termines-simple.html`), ce qui rend
la renumérotation indolore.

**Ce qui a quitté l'écran, et ne doit pas revenir :**

| | Pourquoi |
|---|---|
| Le **fil vertical** et ses perles pleines ou creuses | 47 px de largeur pour un code que personne n'a appris |
| La **pastille dorée** et le **volet replié** | le seul travail qui reste ne se cache pas derrière une ligne en petites capitales |
| « **Facturé, tous mois confondus** » | il répétait le chiffre déjà écrit à droite du mois, sans qu'on sache pourquoi c'était le même |
| Le surtitre « CHANTIERS RÉALISÉS » et le cheveu | la planche n'en porte pas, et le titre suffit |
| L'or contre le noir comme seul signe | remplacé par des **mots** : « Pas encore facturé », « Facturé le 20 août » |

**Deux règles gouvernent le nouvel écran**, et elles se paient si on les ignore.
Un **seul mois à la fois**, qu'on feuillette — et **ce qui reste à facturer ne
suit pas le mois** : l'onglet « À facturer » montre tout, tous mois confondus.
Elles vivent dans `src/lib/termines-par-mois.ts`, pures et éprouvées sans base ;
l'écran n'y décide de rien.

**« Facturé le 20 août » a coûté une colonne de plus en base.** La maquette
écrivait cette phrase d'après `datePlanifiee` — la date du CHANTIER. Or un
chantier fait le 20 peut être facturé le 30 : l'écran aurait affirmé une date
d'émission qu'il n'a pas. `factures.date_emission` entre donc dans la requête,
et sans elle la phrase se tait plutôt que d'inventer.

**Deux suites ont été adaptées, aucune n'a été satisfaite en remettant ce qu'il
a fait retirer** (`CLAUDE.md` §5 bis) :

- `test-planning-vers-facture-e2e.ts` dépliait le volet pour atteindre un
  chantier non facturé. Il passe désormais par l'onglet « À facturer » — ce qui
  le rend **indifférent au calendrier** : un chantier terminé il y a six jours
  peut tomber dans le mois précédent selon la date du jour, et le contrôle
  aurait cherché dans un mois qui ne le porte pas, en accusant un écran juste ;
- `capture-termines.mts` mesurait le volet, la pastille, et l'absence de tout
  coin arrondi. Il mesure maintenant le feuilletage, le compte **en noir gras**
  (graisse et couleur calculées, pas la classe posée), et refuse de conclure sur
  un écran sans lignes.

**Un défaut trouvé en écrivant la suite pure** : le comparateur de `preparer`
rendait 0 pour deux chantiers du même **mois**, et non du même **jour** — les
lignes d'un mois seraient sorties dans l'ordre de la base. Le contrôle « dans le
mois, le plus récent en tête » l'a attrapé avant l'écran.

**UN CHANTIER CLÔTURÉ EN AVANCE VIDAIT L'ÉCRAN.** Deux suites rouges d'un coup,
et le défaut aurait été chez lui. Clôturer un chantier avant sa date le range
dans « Terminés » **en lui laissant sa date à venir** : le mois d'entrée était
« le plus récent qui porte quelque chose », donc septembre, donc un écran vide —
et tout le travail du mois en cours disparu, sans rien qui dise pourquoi.
`bornesDuFeuilletage` ouvre désormais sur le **mois courant** dès qu'il existe
quelque chose de plus tard, et laisse la flèche › aller voir ce qui est en
avance. Sans rien ce mois-ci, on s'ouvre sur le dernier mois qui porte quelque
chose : après deux mois creux, une page blanche serait exacte et inutile.

**Et un défaut vu sur la CAPTURE, comme les cinq précédents de ce dépôt** :
« Pas encore facturé · 1 764,00 € prévus » était tronqué par la capsule
« Facturer » — le montant y passait. La ligne d'état s'enroule maintenant sur
deux lignes ; le NOM, lui, reste coupé, parce qu'un nom se reconnaît tronqué et
qu'un chiffre coupé ne se devine pas. Corrigé **d'abord sur la planche**, puis
dans l'écran (`CLAUDE.md` §3 bis).

### « Terminés » : revenir dans le passé, et le compte en noir gras

Ses deux corrections sur la planche 90, le soir même : *« en haut il y a marqué
août 2026, mais il faut pouvoir revenir dans le passé si jamais on a du retard
sur la facturation »*, et *« cinq factures envoyées et tant qui attendent leur
facturation, ça tu peux le mettre en noir gras »*.

**Ce qui a été tranché, et qui ne se devinait pas depuis sa phrase :**

| | |
|---|---|
| Le mois se feuillette | `‹ Août 2026 ›`, une flèche de chaque côté. La flèche du futur **se ferme** sur le mois le plus récent : un bouton qui ne fait rien s'appuie deux fois, puis on croit l'écran cassé |
| Un mois vide **le dit** | « Aucune facture en juillet 2026 ». On se déplace sur le **calendrier**, pas sur la liste des mois qui portent quelque chose : sauter de août à mai laisse croire que juin n'existe pas |
| **Ce qui reste à facturer NE suit PAS le mois** | c'est tout l'objet de sa demande. Un chantier de juillet jamais facturé reste sous ses yeux en août — sinon il faudrait déjà savoir qu'il existe pour aller le chercher |
| Dans la B, l'onglet « À facturer » ne se feuillette pas non plus | il montre tout ce qui attend, tous mois confondus |

**Aucune facture n'a été inventée dans le passé, et c'est délibéré.** Ses
numéros commencent à `F2026-0001` le 18 août : il n'a jamais facturé avant. Un
mois d'avant répond donc « aucune facture » plutôt que de porter du faux
(`CLAUDE.md` §4). Ce qui a été ajouté, c'est **un seul** chantier — M. Ferreira,
terminé le 14 juillet, jamais facturé — sans quoi le retour en arrière ne se
juge pas, il se croit sur parole.

**Et il ne va que dans les propositions.** L'onglet « Aujourd'hui » doit rester
sa capture au chiffre près : un cinquième chantier en attente y écrirait « Cinq
à facturer · 2 930,00 € », et on ne comparerait plus à ce qu'il a sous les yeux.
Deux jeux de données, donc, et la page le dit.

**Le noir gras ne s'applique qu'au compte.** « 5 factures envoyées · et
2 040,00 € qui attendent leur facture » est ce qu'il vient chercher ; « Montants
prévus à vos devis » reste gris — c'est une réserve, pas un chiffre. La suite le
**mesure dans le navigateur** (graisse 700, `rgb(28,28,26)`) : une classe posée
ne prouve pas une graisse.

### « Terminés » : trois façons de la simplifier, et rien de codé

*« Comme on a fait avec toutes les pages, on les a bien simplifiées, maintenant
il reste celles-là. Je la trouve beaucoup trop compliquée. Un utilisateur qui ne
connaît pas l'application et qui arrive sur cette page ne comprend rien.
Propose-moi quelque chose pour la simplifier, ne code rien, je veux qu'on fasse
des maquettes dynamiques en HTML que je puisse essayer avant de coder quoi que ce
soit. »*

Mêmes mots que pour le planning le 19 août (planche 84), donc même réponse :
`appli/termines-simple.html` — **planche 90**, essayable, et `src/` n'a pas
bougé (`CLAUDE.md` §3 bis).

**Ce qui se comprend mal sur l'écran actuel**, relevé sur sa capture et non
supposé :

| | |
|---|---|
| Le seul travail qui reste | quatre chantiers à facturer, **repliés** derrière une ligne en petites capitales dorées, sans rien qui dise qu'on peut appuyer |
| « 3 828,00 € » | écrit **deux fois** — à droite d'« août », puis « Facturé, tous mois confondus ». C'est le même chiffre parce qu'il n'y a qu'un mois, mais il faut le deviner |
| Trois codes non appris | la pastille dorée « 4 », les points pleins/creux, le montant en or contre le montant en noir |
| « F2026-0005 · LE 20 » | un numéro de facture avant toute chose, et une date sans son mois |
| Le fil vertical | 47 px de largeur pour ne rien dire que la liste ne dise déjà |
| Le relevé de TVA | coupé en deux par la barre du bas |

**Trois propositions**, et elles facturent pour de bon : **A** deux piles (ce
qui reste en haut, déplié, un bouton par ligne) ; **B** une seule liste où
l'état s'écrit en toutes lettres, avec deux onglets ; **C** une page qui ne fait
qu'une chose et s'appelle « À facturer », l'historique derrière une porte.

**Aucun total n'est écrit en dur** : tout se recalcule à partir de la même
liste, comme le veut la leçon du 21 août — deux chiffres qui se contredisent
dans un même écran, et c'est toute la liste qu'on cesse de croire. Le total du
mois de la proposition B l'a d'ailleurs rappelé : il portait 5 868,00 €, la
somme du facturé ET de l'attendu, c'est-à-dire un chiffre qui n'existe nulle
part.

**Deux défauts trouvés en la parcourant, et un seul par un test.** « Facture
n° **-5** » : le tiret de « F2026-0005 » entrait dans le nombre. Aucun contrôle
ne pouvait le voir — c'est la **capture regardée** qui l'a donné, la cinquième
fois dans ce dépôt (`CLAUDE.md` §5). L'autre, si : un comparateur qui répondait
« plus petit » à deux dates **égales** sortait ses deux factures du 19 août à
l'envers de sa capture, sur les trois écrans à la fois.

**La planche est éprouvée avant de partir en ligne** (`appli/tests/essai-termines.mjs`,
branchée sur `pages.yml`) : les quatre onglets s'ouvrent, les boutons se
pressent, les totaux sont relus **à l'écran**, et un écran de moins de 300 px de
haut est refusé plutôt que compté vert. Confrontée au défaut qu'elle prétend
voir — l'ancien comparateur remis — elle rougit, et sa phrase désigne le bon
coupable.

---

## 2026-08-21

### La nourrice se place par lui, jamais par l'outil

*« Ça, c'est l'utilisateur qui placera la nourrice où il veut. »*

Elle n'est ni calculée, ni déduite, ni proposée d'office : elle est **lue** sur
le croquis. L'IA la cherche ; si elle ne la trouve pas, elle refuse et le dit —
elle ne la pose pas au piquage « pour dépanner », ce que j'avais fait.

**Ce n'est pas une question de politesse.** L'endroit du regard dépend de ce que
lui seul sait : un point d'eau existant, un passage de voiture, un massif qu'on
ne rouvre pas, l'accès pour l'hivernage. Un outil qui le placerait ferait creuser
au mauvais endroit — et une tranchée ne se déplace pas.

**Informer n'est pas proposer** : s'il demande ce que change tel emplacement, on
répond avec des chiffres — l'amenée s'allonge, les lignes raccourcissent. On ne
dit jamais où le mettre. Un contrôle refuse désormais un écran qui suggère un
emplacement, et exige qu'il le LUI demande.

### Le plan avoue qu'il n'est pas valable

*« Il n'est pas valable avec cette nouvelle règle. »*

**La maquette affichait l'interdit puis l'enfreignait juste en dessous** :
« sans les trois, aucun plan n'est proposé », et un plan tracé sur une nourrice
que j'avais placée d'office, son croquis ne la portant pas. **Un écran qui se
contredit ainsi apprend à ne plus lire ses propres avertissements** — c'est
pire que de n'en pas mettre.

Le plan reste montré, parce qu'une maquette sert à voir le rendu, mais il porte
désormais en tête : « ce plan-ci ne respecte pas cette règle — je l'ai placée au
piquage pour vous montrer ; dans l'application, il serait refusé ». Un contrôle
exige cet aveu tant que la nourrice n'est pas sur le croquis.

### L'avertissement passe au-dessus du croquis, et les suggestions restent en maquette

*« C'est un petit message qu'il faut mettre au-dessus du croquis, en noir gras :
votre croquis doit impérativement contenir les métrés, l'endroit définitif de la
nourrice, et l'endroit où le piquage se fait. »*

**Au-dessus, et c'est tout le sujet.** Placé en dessous, il se lirait après avoir
envoyé une photo incomplète — donc trop tard, et il faudrait retourner au jardin.
Le contrôle mesure la **position** et le **poids** du texte, pas seulement sa
présence : éprouvé en le déplaçant sous le croquis, et en lui retirant son gras.

*« Est-ce que tu vas mettre les phrases déjà pré-écrites, ou c'était juste pour
faire un test ? Je pense qu'il ne faut pas les mettre, mais qu'il faut un endroit
où on puisse discuter avec toi. »*

**Il a raison, et c'était bien un artifice.** Une maquette sans JavaScript ne
peut montrer un échange qu'en pré-écrivant les répliques. Dans l'application :
un champ libre, rien d'autre. Des suggestions toutes faites bornent ce qu'on ose
demander, et ce qu'il a à dire ne tient jamais dans trois boutons. Le champ de
saisie remonte donc **au-dessus** des suggestions dans la maquette, et celles-ci
sont désormais annoncées pour ce qu'elles sont.

### Sans croquis complet, aucun plan — et la discussion n'en crée jamais un

*« L'outil doit fonctionner avec un plan avec toutes les métrés, l'emplacement du
piquage et l'endroit définitif de la nourrice. Sans ça il ne doit rien proposer.
La discussion ne doit jamais créer un plan avec des réseaux — elle peut seulement
modifier, ou recréer si un croquis avec tous les bons éléments aux bons endroits
a été fourni. »*

Trois éléments obligatoires : les **métrés**, le **piquage**, l'**endroit
définitif de la nourrice**. Il en manque un, le plan est **retiré** de l'écran —
pas grisé : un plan affiché en pâle se photographie et se pose quand même. Et
l'écran dit lequel manque, avec ce qu'il faut faire.

**Pourquoi la règle vise la discussion en particulier** : c'est sa tentation
exacte. On répond en comblant ce qui manque, parce qu'une phrase se complète plus
facilement qu'un dessin. Un plan tracé sur une nourrice supposée fait creuser au
mauvais endroit, et une tranchée ne se déplace pas.

**Un manquement à noter, et il est de moi :** le plan de son jardin a été tracé
avec une nourrice que j'ai placée moi-même — son croquis porte les métrés et le
piquage, pas le regard. Selon sa règle, ce plan n'aurait pas dû être proposé.

### Discuter le plan — maquette, et un garde-fou qui compte

*« Si l'utilisateur a besoin de te demander une modification, qu'il puisse le
faire. Une petite interface pour discuter avec toi. »*

**`appli/arrosage-discuter.html`** : trois échanges essayables — pourquoi deux
réseaux, passer en 15-VAN, préférer des 5004. Le plan se redessine, les pièces
suivent. Aucun JavaScript : les échanges sont des états choisis par des radios.

**Le point d'architecture prime sur l'interface : Atlas ne dessine pas le plan.**
Il lit la demande, pose un **paramètre** du calcul, et c'est le calcul
déterministe qui refait le schéma et la liste. Trois droits : lire le catalogue
pour répondre, poser un paramètre, refuser en expliquant — et proposer ce qui
s'en approche. Jamais écrire un chiffre absent du catalogue.

C'est la leçon du jour même : laissé libre, il a inventé « 5004 buse 3.0, portée
6 m », et le maillage entier en dépendait. **Une conversation rend cette dérive
plus facile, pas moins** — on écrit une phrase plausible et personne ne la
recompte.

**Son contrôle a dû être retourné pour valoir quelque chose.** La première
version vérifiait qu'une bonne valeur est *présente* — ce qui laisse passer une
valeur fausse citée à côté, exactement comme ce matin. Il vérifie désormais
l'inverse : **toute portée écrite dans la conversation doit exister au
catalogue**. Éprouvé en remplaçant 4,5 m par 4,2 m : « une portée inventée fausse
tout le maillage ».

Deux pièges de contrôle au passage : `innerText` ne rendait que le fil visible et
accusait la maquette de taire ce qu'elle dit ailleurs ; et le « m » de « m³/h »
se faisait prendre pour un mètre, ce qui condamnait un débit juste.

### « Pourquoi pas des 3504 ? » — j'avais inventé les portées

*« Pourquoi tu as utilisé des tuyères 1800 et pas des arroseurs 3500 de chez
Rain Bird ? »* La réponse tient en une ligne de son catalogue : la 3504 porte au
minimum **5,2 m** (buse 0,75) pour une bande de **4 m** de large.

**Mais en vérifiant, j'ai trouvé bien pire dans la maquette.** J'annonçais
« Turbine 5004, buse 3.0 — portée 6 m » : **cette portée n'existe pas**. Ses
relevés donnent 8,5 m pour la buse 1,0 et **11,1 m** pour la 3,0. Et la 12-VAN ne
fait pas 4 m mais **3,6 m**. J'avais inventé des valeurs qui étaient dans le
catalogue depuis le 17 août, et tout le maillage reposait dessus.

**Deux règles de sa part ont débloqué le reste.**

*« Les débits à 360° sont les mêmes qu'à 180° et 90°. »* Le catalogue portait
cette question ouverte depuis le 17 août et écartait toutes les turbines du
calcul faute de réponse. Elle est tranchée — et **c'est l'inverse de ce que le
dépôt supposait** : on imaginait un débit proportionnel à l'arc, ce qui aurait
divisé par quatre celui d'un coin et fait poser quatre fois trop d'arroseurs sur
une voie. La règle ne vaut que pour les turbines : une buse VAN projette
plusieurs filets, et ses propres relevés donnent bien 0,15 / 0,30 / 0,59.

*« On a un recouvrement d'au moins 80 %, pas obligé d'avoir 100 % à chaque
fois. »* Le contrôle exigeait 100 % de la pelouse à portée d'un arroseur — plus
strict que son métier, et cela coûte : chaque point manquant fait resserrer le
maillage, donc ajouter des arroseurs et des raccords. **Un contrôle trop sévère
fait dépenser aussi sûrement qu'un contrôle absent.**

**Le plan refait sur les vraies valeurs est plus simple que le faux :**

| | Avant (valeurs inventées) | Après (ses relevés) |
|---|---|---|
| Arroseurs | 9 turbines 5004 + 4 tuyères | 9 turbines **3504 buse 0,75** + 4 tuyères |
| Portées | 6 m et 4 m — inexistantes | **5,2 m** et **3,6 m** — relevées |
| Réseaux | 3 | **2** |
| Nourrice | 3 voies | **2 voies** |
| Couverture | — | **100 %**, pour 80 % exigés |

**Et un principe s'est imposé de lui-même : un réseau par famille.** Une tuyère
verse environ trois fois plus vite qu'une turbine ; sur une même voie, le temps
qui convient à l'une noie ou assoiffe l'autre. L'ancien plan mélangeait une
turbine et quatre tuyères sur le réseau 3.

**Deux détails trouvés en lisant les fiches** : la 3504 est en **1/2"** (pas
3/4" comme la 5004), ce qui change tous ses SBE de corps ; et elle est **livrée
avec ses six buses**, donc la ligne « buse » disparaît de la commande.

### Le tour plutôt que la coupe — et un contrôle qui dormait

*« On essaye de traverser le moins possible le jardin en faisant des tranchées.
Là, moi, je ferais le tour : la première tuyère en haut à gauche relie celle du
haut à droite, puis celle du bas à droite, puis celle du bas à gauche — et c'est
celle-là la dernière, pas celle du haut à droite. »*

Le réseau 3 coupait l'extension en deux. Son tour coûte **exactement la même
longueur** — 32 ml — et ne creuse que le long des bords.

**Mais le pire est que mon contrôle n'a rien vu, et il ne pouvait pas.** Il
mesurait la tranchée à plus de 2 m d'un bord. Dans une bande de 4 m de large, le
milieu est à 2 m des deux bords : **aucune traversée n'y était jamais
détectable**. Le contrôle dormait exactement là où il fallait qu'il parle.

Le critère est désormais géométrique : *ce segment part-il d'un bord pour arriver
sur un bord en passant par l'intérieur ?* Si oui, c'est une coupe. Un segment qui
va chercher un arroseur du milieu n'arrive sur aucun bord — ce n'en est pas une.
Éprouvé sur l'ancien tracé : « la tranchée coupe le jardin de 16,0 à 16,4 — le
tour par le bord fait la même longueur ».

### « D'où sortent tes électrovannes 24 V ? » — de nulle part, et c'était grave

*« Je ne me souviens pas t'avoir donné des électrovannes en 24 V. Pour moi il n'y
avait que des 9 V. Me suis-je trompé ? »*

**Il ne s'était pas trompé.** Toutes ses fiches de nourrice, relevées le 17 août,
sont en 9 V — `electrovanne-100dv`, programmateur à pile, pile 9 V. Le « 24 V »
venait d'une ligne générique du catalogue, marquée `provisoire`, posée avant
qu'il donne ses références et **jamais confrontée à elles**.

**Et elle ne dormait pas dans un coin : le calcul de l'application la sort.**
`listeMateriel()` pose « Électrovannes 24 V » dès qu'aucune fiche de nourrice ne
correspond au nombre de secteurs. Corrigé dans les deux copies du catalogue et du
calcul.

**Sa règle, qui rend la faute grave et non seulement inexacte :**

| Le programmateur | L'électrovanne |
|---|---|
| à pile, 9 V | 9 V |
| sur secteur, 220 V | 24 V |

Une vanne 24 V pilotée par un boîtier à pile **ne s'ouvre pas**. Le réseau
n'arrose pas du tout — et cela ne se voit ni sur un plan, ni sur un devis, mais
après avoir rebouché la tranchée. Un contrôle refuse désormais le mélange, et
refuse aussi une vanne qui ne dit pas sa tension.

**La leçon dépasse les électrovannes :** une valeur « provisoire » qui survit à
l'arrivée des vraies références devient un mensonge. Quand ses données arrivent,
les lignes qu'elles remplacent se corrigent.

### Se piquer au compteur, c'est couper une ligne — la pièce manquait

*« Je te posais la question sur les tés égaux parce qu'en fait il en faut bien
deux : vu qu'on se pique après le compteur, il va falloir qu'on coupe la ligne,
parce que le compteur c'est une ligne directe qui part vers la maison. On va
devoir la couper et mettre un té égal à cet endroit-là. »*

**Il avait raison, et pour une raison que rien dans le dépôt ne portait.** Le té
égal du regard, je l'avais ; celui du piquage, non — parce qu'il ne dépend
d'aucun calcul de réseau. Ni des arroseurs, ni des voies, ni du débit : du
**point de piquage** seul. Il manquait donc, et il aurait manqué sur chaque plan.
L'oublier, c'est un aller-retour au magasin avec la tranchée ouverte.

**Le plan le montre maintenant** : la ligne du compteur continue vers la maison
en pointillé, et le losange marque l'endroit où on la coupe. Sans ce trait, la
pièce paraissait arbitraire.

**Une troisième zone est née** : « du compteur à la nourrice ». Le plan en avait
deux — le jardin, le regard — et rien pour l'amenée, dont le tuyau n'était même
pas compté. Il ne l'est toujours pas en mètres, et c'est délibéré : la distance
dépend du terrain, elle est marquée **à mesurer** plutôt qu'inventée.

### « Où sont les pièces de la nourrice ? » — et un récapitulatif qui mentait

**Deux questions de sa part, deux défauts réels.**

*« Tu as mis 2 tés égaux 25×25×25, pourquoi ? »* Sur la version qu'il regardait :
un à la nourrice, où le réseau 1 se sépare en deux, et un en 16,0 où partait
l'antenne du réseau 3. Le second a disparu depuis, en faisant contourner
l'extension par le coin. Il n'en reste qu'**un**, celui du regard qu'il avait
lui-même demandé.

**Mais sa capture montrait pire, et je ne l'avais pas vu :** le tableau annonçait
« 8 tés, 5 coudes » et la phrase juste en dessous « 9 tés + 4 coudes = 13
raccords ». La phrase était écrite en dur et n'avait pas suivi le tracé — elle
disait vrai la veille. C'est le pire des cas, parce qu'on la relit sans
méfiance. Un contrôle recalcule désormais le récapitulatif depuis le tableau.

*« Où sont les pièces pour la nourrice 3 voies ? »* Elle tenait en trois lignes —
3 électrovannes, 1 regard, 1 programmateur — qui **ne se montent pas** : il
manquait la clarinette qui relie les vannes, les unions qui permettent de
démonter, les raccords d'entrée, la vanne de purge pour l'hivernage.

**Tout était déjà relevé sur sa planche du 17 août**, dans
`CATALOGUE.nourrices[3]`, et n'avait jamais été repris. Les douze pièces sont
maintenant listées dans leur propre tableau — ce qui est dans le jardin d'un
côté, ce qui est dans le regard de l'autre.

**Un faux coupable évité au passage :** en détaillant la nourrice, le contrôle
des raccords s'est mis à compter ses « coudes taraudés MM 1" » comme des fins de
ligne d'arroseur, et accusait le plan de 2 raccords en trop. Les deux tableaux
portent désormais leur zone.

### La légende montre au lieu de décrire — et une pièce de moins

*« Le petit schéma en dessous n'est pas clair. On ne sait pas vraiment à quel
endroit tu veux utiliser un coude taraudé, à quel endroit un té égal ou un té
taraudé. Là où tu as marqué plein, à côté tu peux mettre un rond plein. »*

**Les symboles sont maintenant dessinés à côté des mots** — le rond plein, le
rond creux, le carré, le losange, le trait de tranchée —, et ce sont ceux du
plan. Chacun nomme **la pièce** qu'il implique : plein → té taraudé ; creux →
coude taraudé ; losange → té égal, qui n'arrose rien. On lisait le plan sans
savoir quoi visser.

**La jonction se voit enfin.** Elle était dans la commande et nulle part au
dessin : « 1 té égal » sans savoir où le poser. Un contrôle exige désormais que
toute pièce facturée soit dessinée quelque part.

**Une jonction supprimée en réordonnant le réseau 3.** Il finissait par une
antenne partant d'un arroseur — donc un té taraudé ET un té égal au même point.
En lui faisant faire le tour de l'extension par le coin, la ligne devient
unique : même longueur (32 ml), un raccord de moins et une pièce de moins.

**Et la phrase sur la tranchée est retirée de l'écran**, à sa demande : *« il
faut juste que ça soit une règle que toi tu conserves, l'utilisateur n'a pas
besoin de voir ça »*. Nos raisons de conception restent dans `CLAUDE.md` ;
l'écran ne porte que ce qui sert à poser le chantier.

**Deux défauts vus à la capture, aucun par un test :** les symboles SVG sans
largeur imposée s'étiraient à 300 px, et la grille CSS de la légende éclatait un
mot par ligne — chaque nœud texte devenant une cellule.

### Le plan dit quel arroseur et pourquoi — et on ne traverse plus le jardin

**Trois règles de plus, toutes sorties de sa lecture du plan.**

**« Combiner les deux économies, et à égalité privilégier la tranchée, car c'est
moins fatigant. »** Le tuyau se pose, la tranchée se creuse, se remblaie et se
voit encore dans le gazon l'été suivant.

**« On traverse le moins possible le jardin dans sa largeur : beaucoup de choses
enterrées. »** Ce n'est pas une question de mètres mais de risque — gaines,
drains, fosse, racines qu'on ne voit qu'à la pelle. Le tour se rebouche, la
traversée se retrouve. Un contrôle mesure le linéaire de tranchée à plus de 2 m
d'un bord et le compare à ce qu'exigent les arroseurs intérieurs. Sur ce plan :
4 m, pour 4 m nécessaires — le seul arroseur du milieu est celui du centre.
Éprouvé en faisant traverser le réseau jaune : « 12 m de tranchée en plein jardin
pour 4 m nécessaires ».

**« Tu dois savoir me dire où sont les tuyères et pourquoi, et quelle buse. »**
Le plan ne montrait que treize points identiques : sur le terrain, on ne sait pas
lequel visser où. **La forme porte désormais la famille** — rond pour une turbine,
carré pour une tuyère —, le remplissage garde la position sur la ligne, et la
légende nomme la buse. Un bloc dit le POURQUOI : les turbines 5004 buse 3.0
couvrent le carré de 12 m avec 9 arroseurs là où une portée plus courte en
demanderait 16 ; les tuyères 1800 buse 12-VAN tiennent la bande de 4 m, qu'une
turbine de 6 m arroserait 2 m au-delà de la limite.

**Un contrôle a dû suivre le libellé plutôt que le figer** : il lisait « 4
arroseurs » sur les cartes, qui annoncent maintenant « 4 turbines ». Il additionne
désormais les familles et les confronte à ce qui est dessiné, famille par famille.

### La tranchée, pas le tuyau — 10 m de terrassement en moins, à tuyau égal

*« Il faut que tu te dises que le trait jaune, c'est une tranchée. C'est une
équipe qui va devoir creuser la terre pour faire passer le tuyau. Donc l'idée,
c'est de faire le moins de tranchée possible. Si on peut réutiliser une tranchée
déjà faite et juste faire une petite antenne — un mètre par exemple — pour aller
chercher l'arroseur, c'est moins éprouvant que de faire tout le tour. »*

**Cela change ce qu'on minimise, et c'était faux jusqu'ici.** Le contrôle
comparait la somme des TUYAUX au plus court. Mais deux tuyaux qui suivent le
même chemin n'occupent qu'une tranchée : le mètre de tuyau se paie une fois, le
mètre de tranchée se paie en heures d'homme et en gazon rouvert.

Le plan le montre : à longueur de tuyau **égale** — 76 ml —, faire remonter le
troisième réseau par le bord haut, déjà creusé pour le premier, au lieu de
traverser la pelouse : **74 → 64 ml de tranchée**.

La tranchée est désormais **dessinée** (le trait ocre large, sous les tuyaux), et
son linéaire annoncé. Deux contrôles la tiennent, séparés parce que ce sont deux
défauts distincts : l'union des tuyaux ne doit pas dépasser le minimum
nécessaire, et aucun tuyau ne doit passer hors d'une tranchée dessinée — sans
quoi le chantier serait chiffré trop court.

**Un contrôle a dû être corrigé au passage, et il interdisait sa règle.** Il
exigeait que CHAQUE ligne parte de la nourrice, et rougissait donc sur la petite
antenne d'un mètre qu'il décrit. La règle juste : **un réseau part de la
nourrice, ses antennes partent de lui**.

### Le comptage s'applique à CHAQUE réseau — un contrôle global mentait

*« Faut surtout que tu en fasses une règle. Il faut que tu l'appliques pour
chaque réseau que tu crées. »*

**Il avait raison contre mon contrôle**, qui vérifiait `tés + coudes = arroseurs`
sur le TOTAL. Une somme juste peut cacher un réseau en excès et un autre en
manque : ils se compensent, le total tombe juste, et c'est sur le terrain qu'on
découvre qu'une voie n'a pas de quoi raccorder son dernier arroseur. **Un
contrôle qui ne regarde que la somme laisse passer exactement le défaut qu'il
prétend attraper.**

Le décompte se lit désormais **sur le plan**, réseau par réseau — têtes pleines
pour les tés, têtes creuses pour les fins de ligne — puis se compare à ce que la
carte annonce. Si les deux divergent, l'un ment et rien ne dit lequel au moment
de commander. Éprouvé sur une compensation exacte (un té de trop chez le 2, un
de moins chez le 3) : les deux réseaux rougissent séparément, là où l'ancien
contrôle voyait un total juste.

Le gabarit complet — arroseurs, coudes, tés, jonctions, SBE, PEBD, PE — est dans
`CLAUDE.md` §4 bis, à dérouler pour chaque réseau créé.

### « D'où sortent tes vingt-deux SBE ? » — un chiffre juste, une ligne muette

*« Je ne comprends pas d'où sort ton calcul des vingt-deux coudes SBE 3/4" et
les 4 SBE 1/2". Ça correspond à quoi ? »*

**Le chiffre était juste** — sa règle du 17 août, écrite dans le catalogue :
deux SBE par arroseur, celui du bas toujours en 3/4" sur la tuyauterie, celui du
haut au diamètre du corps (3/4" turbine, 1/2" tuyère). Soit 13 en bas, 9 sur les
turbines, 4 sur les tuyères.

**Le défaut était la ligne, pas le calcul.** « 22 u Coude SBE 075 » ne dit pas à
quoi ils servent : on recompte, on n'y arrive pas, et c'est toute la liste dont
on doute. Une pièce qui sert à deux endroits s'écrit désormais en deux lignes,
chacune nommant sa position — et un contrôle refuse une ligne SBE qui ne dit pas
si elle va en haut ou en bas, en plus de vérifier le total (2 × arroseurs).

**Le contrôle PLANTAIT au lieu de rougir**, et c'est la deuxième leçon. Éprouvé
en retirant une ligne du tableau, il tombait sur une trace JavaScript qui
n'accusait personne. La sonde ignore maintenant les lignes mal formées et rend
son verdict : « 13 SBE pour 13 arroseurs : il en faut deux par arroseur, soit
26 ».

### « Va au plus court » — un détour de 4 m, devenu un contrôle

*« Pour ton réseau 1 tu t'es trompé : tu aurais dû retirer la dernière ligne
entre l'arroseur du haut et l'arroseur du milieu, mais par contre, devant le
regard, mettre un té — et du coup tu aurais pu joindre le premier arroseur qui
est collé au regard et celui qui est en haut. »*

La ligne faisait le tour puis **revenait sur elle-même** pour rattraper un
arroseur situé à 2 m de la nourrice. Un té de jonction devant le regard et deux
branches courtes : **18 ml au lieu de 22**. Le tuyau en trop se paie deux fois,
au mètre et en tranchée.

**Ce qui compte n'est pas les 4 m, c'est que le détour se MESURE.** La longueur
d'un tracé se compare désormais à l'arbre couvrant minimal de ses points, en
distance de Manhattan — un tuyau suit les axes, il ne coupe pas en diagonale au
milieu du gazon. C'est une borne basse honnête : au-delà de 5 %, le tracé revient
sur lui-même. Éprouvé en remettant l'ancien tracé, il annonce « 22 ml tracés pour
18 ml nécessaires — 4 m de tuyau en trop, payés au mètre ET en tranchée ».

Les réseaux 2 et 3 étaient déjà au plus court : le contrôle ne rougit pas pour
le plaisir.

**Conséquence sur la règle précédente :** « un réseau = une ligne continue »
était une simplification de ma part, pas une règle du métier. Elle empêchait
précisément le raccourci qu'il demande. Un réseau peut donc se ramifier — avec
un té de jonction 25×25×25, qui n'arrose rien et ne compte pas dans l'égalité
`tés + coudes = arroseurs`.

### Le planning, codé trait pour trait — et une migration avec

**Sa décision du 21 août au soir**, après deux soirées de maquette et neuf
corrections : *« maintenant tu peux coder cette version de la maquette ! Ne
modifie rien ! Ne change rien ! Code trait pour trait cette maquette. Prends le
temps qu'il faut, je veux aucune erreur, aucun défaut ! »*

L'écran est celui de `appli/planning-simple.html` : le mois refait, la fiche du
jour bâtie sur le CHANTIER et non sur la demi-journée, les planifiés à la
semaine, et la feuille de chantier — le devis rendu sans un seul prix.

**Ce qui ne se voit pas, et qu'il a fallu poser (détail dans `ARCHITECTURE.md`
§129) :**

| | |
|---|---|
| **Migration 0058** | `equipes_du_chantier` remplace `chantiers.equipe_id`. Une colonne porte UNE équipe, pour le chantier ENTIER : ni « toutes les équipes sur la même demi-journée », ni « Paul le matin, Julien et Paul l'après-midi ». La colonne est retirée, pas doublée — deux vérités auraient divergé au premier retrait |
| **Le quota prévient** | `planifierChantier` ne refuse plus un créneau, et cocher une équipe ne se refuse jamais. Le dépassement se VOIT — bordeaux, « 150 % de vos équipes » — il ne s'interdit pas. **Le chemin du CLIENT garde toutes ses limites** |
| **Le devis sans les prix** | Une route de plus, et zéro moteur de plus : `sansChiffrage` existait depuis la fiche de chantier du 20 août. Le titre devient « FEUILLE DE CHANTIER » et le cadre de signature disparaît — sans prix, ce n'est plus un devis |
| **Deux couleurs à la charte** | `vertPale` et `bordeaux`, fixes comme `sage` et `alert` : dérivées de chaque charte, deux des quatre états finiraient par se ressembler sur l'une des sept |

**Trois choses ont quitté l'écran** parce que la planche ne les portait pas :
« Créer la facture » dans la feuille, la liste « Dans mon agenda », et la
proposition de chantier voisin. Le code serveur des trois est intact ;
`TODO.md` dit où, et ce qu'il faut lui demander.

**Le plus cher du lot ne se voyait pas :** la reprise de données de la migration
recopiait **zéro ligne, sans erreur** — `chantiers` force la RLS jusque sur le
propriétaire, et les migrations tournent sous ce rôle-là. La colonne aurait été
retirée juste après, et toutes ses équipes auraient disparu en silence. Trouvé
en rejouant la migration sur une base remontée à l'état d'avant, **avec des
données dedans** ; aucune relecture ne l'aurait montré. `test-migrations-sous-rls.ts`
garde désormais la porte — et il a trouvé **trois migrations déjà appliquées**
qui portent le même défaut (`TODO.md`, en tête).

**Deux contrôles ont été refaits plutôt que relevés**, et c'est la leçon du
lot : `test-assistant-en-tete-e2e.ts` épinglait « la dernière case du mois finit
au-dessus de 626 px », un nombre relevé sur l'écran d'avant ; il mesure
désormais que le bouton de l'assistant partage la ligne du titre, ce qui était
le vrai défaut et ne dépend d'aucun calendrier. Un contrôle qui suit l'écran ne
le tient plus.

**Et un second défaut invisible, trouvé au journal du serveur :** un
`export type { FeuilleDuChantier };` posé dans `src/app/planning/actions.ts`
tuait **tout** le module d'actions à son évaluation — `ReferenceError`, et les
cinq actions de l'écran en 500. `tsc` et `eslint` restaient verts, et le geste
« réussissait » sans un mot, puisqu'une action serveur ne rend jamais son erreur
au patron. Le type se prend désormais à sa source, avec `import type`, et
`test-actions-serveur-sans-export-de-type.ts` rend la faute impossible sur les
32 fichiers « use server » du dépôt. Le détail et le réflexe qui manquait — lire
le journal du serveur AVANT de soupçonner le contrôle — sont en tête de
`HANDOVER.md`.

**Et un écart avec la planche, trouvé sur une CAPTURE** — la cinquième fois dans
ce dépôt qu'un défaut sort d'une image et d'aucun test. La planche resserre les
petits boutons d'une ligne de demi-journée (`.demi .petit{padding:7px 9px}`) ;
la transcription avait gardé les 12 px par défaut. Six pixels de trop par
bouton, et la ligne « Après-midi · Équipe ? · Déplacer · Retirer » faisait
exactement 324 px dans 324 : « Retirer » basculait à la ligne suivante. Restauré,
et `test-planning-e2e` le tient désormais — confronté au défaut, il rougit sur
« 42 px de décalage ». Il mesure des hauteurs d'origine et non des largeurs :
deux boutons d'une même ligne partagent leur `top`, ce qui ne dépend ni de la
police ni de la longueur des mots.

**Ce qui n'a PAS été corrigé, et pourquoi.** Une équipe qui existe sans porter
de nom s'écrit « Équipe A » — 91 px, là où « Équipe ? » en fait 75. La ligne
déborde alors de quatre pixels. La planche ne dessine jamais cette étiquette :
la régler voudrait dire retoucher un dessin qu'il a validé, et un choix
d'apparence se dessine avant de se coder (`CLAUDE.md` §3 bis). Le cas est décrit
dans `TODO.md`, à lui montrer.

**Un contrôle de notification a été refait pour la même raison de fond**
(`CLAUDE.md` §5 bis) : « J'ai vu » comptait les cartes de l'accueil avant et
après le geste et en exigeait une de moins — un compte qui dépendait de l'ordre
d'exécution des suites et de l'ordre d'affichage des cartes. Il vise maintenant
la carte de CE chantier par son identifiant.

### « Je clique sur Lucie, et j'arrive sur mon devis » — la dictée mène enfin au devis

**Sa panne, mot pour mot :** *« J'ai ouvert un chantier, Madame Lucie. J'ai
rentré ces informations, j'appuie sur note vocale, j'ai dicté la prestation du
chantier. J'ai rappuyé sur la note vocale, ça a enregistré. J'ai quitté
l'application. Je suis retourné dessus. J'ai cliqué sur Madame Lucie. Or, je ne
suis pas arrivé directement sur la page du devis comme demandé, avec mes
informations remplies que j'avais dictées. Corrige-moi ça, c'est le point le
plus important. »*

**Deux défauts, et le second était le vrai.**

Le premier était le chemin : la liste le renvoyait sur l'écran « Informations »
— un écran de contrôle dont il ne veut plus depuis le 5 août (*« je ne veux pas
tous les autres trucs intermédiaires »*). `getNextAction` mène désormais au
devis dès qu'une dictée existe, et **avant** le jalon « informations
vérifiées » : la chaîne pose ce jalon avant son arrêt d'avant-chiffrage, et
l'ordre inverse l'aurait envoyé sur l'écran « Prix » — la même panne sous un
autre nom.

Le second, plus grave : **enregistrer une dictée ne fabriquait aucun devis.** La
chaîne attendait qu'il appuie sur « Mon devis → », et il ne l'a pas fait — il
était chez sa cliente, il a fermé l'application. Corriger le seul chemin
l'aurait mené droit sur une feuille vide, c'est-à-dire sur la panne du 7 août.

**Le devis se prépare donc lui-même en arrivant**, quand une dictée n'a pas
encore été traitée (`src/lib/devis-a-preparer.ts`, `PreparationDictee.tsx`). À
l'arrivée plutôt qu'au relâchement de l'anneau, et c'est délibéré : il ferme
l'application dans la seconde qui suit, l'appel partirait avec l'onglet. Le seul
moment où un navigateur est là pour attendre le résultat, c'est celui où il
rouvre le devis.

Le voile se pose **par-dessus** le devis, jamais à sa place : si la chaîne
échoue, « Ouvrir le devis tel quel » lui rend sa feuille et son crayon.

`scripts/test-madame-lucie-e2e.ts` rejoue sa séquence entière — dicter, fermer
l'application, revenir par la liste, cliquer le nom. Confrontée à l'ancien code,
elle rougit sur trois cas et nomme le coupable : *« la liste l'envoie sur
/informations »*.

### Le plan repris sur ses trois corrections — la nourrice, les raccords, les marques

**« Tous les réseaux doivent partir de la nourrice — règle indiscutable ! »**
La première version montrait le compteur et trois traits qui commençaient dans
le vide : *« je suppose que le réseau jaune partirait du compteur, mais le bleu
et le vert, on ne sait pas d'où »*. La nourrice est dessinée, avec ses trois
vannes, et un contrôle refuse une ligne qui démarre ailleurs.

**Le comptage des raccords était faux, et il l'a vu au chiffre près.** La liste
portait « un collier de prise en charge par arroseur » — une pièce qui n'existe
pas dans sa règle. Sa planche du 17 août, écrite dans le catalogue depuis
quatre jours, dit : **départ et milieu de ligne → té taraudé ; fin de ligne →
coude taraudé**. D'où l'égalité qu'aucune version ne tenait :

> **tés + coudes = nombre d'arroseurs**, et **coudes = nombre de lignes**

En dessous, des arroseurs ne sont raccordés à rien. C'est exactement ce qu'il a
relevé — *« il y a quatre arroseurs qui ne sont pas alimentés »* — sur un plan
qui paraissait juste. Aucun test ne le voyait, parce qu'aucun ne confrontait la
liste des pièces au tracé. Le contrôle le fait maintenant, et il chiffre le
manque : « 4 tés + 0 coudes = 4 raccords pour 13 arroseurs — 9 arroseurs ne sont
alimentés par rien ».

**Une conséquence de forme, et elle vaut d'être notée :** un réseau est
désormais **une ligne continue**. C'est ce qui rend le compte sûr d'un coup
d'œil — une ligne a exactement une fin, donc un coude, et tout le reste est un
té. Une ligne qui se ramifie demanderait un té de jonction non taraudé, et le
compte ne se vérifierait plus à vue.

**Le bandeau des marques est enfin à l'écran** — Rain Bird par défaut, Toro,
Hunter. Il l'avait demandé le 17 août ; c'était écrit dans le catalogue et
n'était jamais monté jusqu'à un écran.

**Et la règle vaut pour TOUS les schémas**, à sa demande : elle est écrite dans
`CLAUDE.md` §4 bis, plus seulement dans un commentaire de catalogue.

### Le plan d'arrosage se DESSINE — maquette, rien n'est codé

*Sa demande, capture à l'appui :* **« il manque la photo, le schéma avec les
réseaux, et l'implantation des arroseurs — les différents réseaux de
couleurs »**. L'application rendait trois listes et aucun dessin.

**`appli/arrosage-plan.html`**, tracée sur son croquis du jour : pelouse en L,
12 × 12 et 8 × 4, **176 m²**, piquage au compteur. 13 arroseurs, 3 réseaux de
couleurs, chacun sous les 1,80 m³/h disponibles. Aucun JavaScript : choisir un
réseau passe par des boutons radio et du CSS, donc ça marche hors ligne sur son
téléphone.

**Ce qui distingue ce plan d'un joli dessin, c'est ce que son contrôle
recalcule** (`scripts/verifier-maquette-arrosage-plan.mjs`) :

- **la surface est relue depuis le polygone tracé** et comparée à celle
  annoncée — un plan juste sur une forme fausse ferait commander les pièces
  d'un autre jardin ;
- **aucun coin de pelouse n'est laissé sans eau** : on maille le terrain tous
  les 50 cm et l'on vérifie que chaque point est à portée d'un arroseur. C'est
  le contrôle qui compte, parce qu'un trou ne se voit pas sur un dessin — il se
  voit en juillet, en jaune. Éprouvé en rétrécissant les turbines : il annonce
  « 48 m² sans arrosage, à partir de 2,25 × 2,75 m » ;
- **aucune voie ne dépasse le débit du compteur** — une voie trop chargée fait
  sortir les arroseurs à moitié ;
- **les métrés sont mesurés sur le tracé**, jamais saisis ;
- **aucun nom de réseau répété ni coupé** — le défaut exact de sa capture, où
  deux réseaux s'appelaient tous les deux « Pelouse pas de gazon à gauche … ».
  Deux vannes qui portent le même nom, c'est la mauvaise qu'on ferme.

**Deux défauts trouvés en la regardant, jamais par un test :** la photo du
croquis s'affichait couchée (une rotation EXIF appliquée à tort), et les quatre
boutons radio se voyaient au-dessus des onglets — le sélecteur CSS ne les
atteignait pas, ils étaient hors de leur conteneur.

### Les cases sont « la carte douce » — la 4, celle qu'il a choisie

**Sa précision du 21 août au soir :** *« n'oublie pas que j'ai choisi la 4 pour
la forme des cases ; dans les 5 modèles elle s'appelait la carte douce »*, avec
l'adresse de la planche.

Il avait tranché plus tôt dans la journée, puis, devant l'écran incomplet, il a
demandé la maquette **trait pour trait** — et sa maquette portait encore
l'ancienne case. J'ai suivi la maquette et défait son choix : deux consignes
justes, un dessin faux.

Les deux portent désormais **la même case** — fond papier, 14 px de rayon, aucun
bord, l'or au doigt posé —, la maquette comme l'application. C'était l'écart qui
lui faisait croire que le code ne suivait pas la planche : il n'y a plus deux
vérités à comparer.

### La fiche client, codée trait pour trait — l'anneau, les photos, un seul bouton

**Sa consigne, après avoir vu la moitié du travail livrée :** *« je veux que ça
ressemble exactement à la maquette qu'on a construite ensemble. Tu me la codes
trait pour trait. Tu ne changes rien, elle est parfaite. »* Il avait raison de
protester : le lot précédent avait été coupé en deux sans qu'il le demande, et
il manquait précisément ce qui compte — la dictée et les photos.

Ce que l'écran `chantiers/nouveau` porte désormais, dans l'ordre de la maquette :

| | |
|---|---|
| **Les photos** | le carré « + » de la fiche chantier, à l'identique — un champ unique, sans `capture`, donc le menu du téléphone |
| **L'anneau** | celui de la fiche chantier, à l'identique : un appui dicte, un second **enregistre** |
| **« Mon devis → »** | n'apparaît qu'une fois la dictée faite |
| **Un seul bouton** | « Je rédige mon devis » |
| **Les cases** | celles de la maquette : fond crème, 4 px, un liseré fin, l'or au doigt posé |

**Les deux pièces ne sont pas des copies :** `Pellicule` et `AnneauNoteVocale`
sont les composants de la fiche chantier, employés tels quels. Deux dessins du
même geste se liraient comme deux fonctions différentes, et le second aurait
divergé au premier ajustement (`CLAUDE.md` §3).

**Elles vivent AVANT que le chantier existe**, et c'est le cœur de sa demande :
il photographie et il dicte chez le client, puis il ferme l'application. Le
chantier naît donc du premier geste (`assurerChantier`), une seule fois — trois
photos et une dictée ne font pas quatre chantiers. Et ce qu'il tape APRÈS ce
premier geste est reporté sur le chantier au moment du bouton : sans cela, un
nom saisi après la dictée serait perdu, en silence.

**Soixante-treize suites passaient par le bouton retiré.** Elles ne dictaient
pas : c'était le chemin le plus court vers la fiche d'un chantier neuf. Elles
passent maintenant par une fonction commune (`scripts/_creer-chantier-e2e.ts`) —
soixante-treize réécritures séparées auraient produit soixante-treize façons de
faire la même chose, et la première divergence serait passée inaperçue.

**Un doublon corrigé au passage, que le nouveau parcours a révélé :** un
brouillon de devis existant dès la création, le tiroir de la fiche chantier
affichait DEUX lignes vers le même écran — « Devis » et « Devis à la main ». La
sortie de secours ne s'affiche plus quand le devis est déjà là.

**Et une leçon d'outillage qui valait 26 suites rouges :** un `.next` de
développement abîmé par des batteries interrompues faisait expirer la navigation
vers `/chantiers/[id]/prix` dans vingt-six suites — le préchauffage mettait
376 s et en ratait deux. `rm -rf .next` : 65 s, zéro raté, zéro rouge. Devant une
grappe de suites qui tombent toutes sur le même écran, vider le cache AVANT de
chercher dans le produit.

### Le planning : un chantier porte son nom UNE fois

**Sa correction du soir, capture à l'appui :** *« Mr. Leroy au-dessus du carré
vert clair matin ; supprime le Mr. Leroy pour l'aprem, c'est le même chantier,
pas besoin de répéter ; pareil pour "1 chantier" ; et supprime le trait entre le
matin et l'après-midi, là on a l'impression que c'est deux chantiers
différents. »*

Il avait raison, et le défaut était de structure. La fiche du jour était bâtie
sur les demi-journées : deux blocs séparés par un filet, chacun rejouant le nom
du client et son compte. Un chantier qui dure la journée s'y écrivait donc
**deux fois**, avec une barre au milieu — et l'écran disait ce qui était faux.

Elle est bâtie sur le CHANTIER : son nom une fois, en tête, avec le compte de la
journée à sa droite ; dessous, les moments où il a lieu, chacun gardant son
équipe, son « Déplacer » et son « Retirer » — le matin et l'après-midi restent
indépendants, c'est sa règle du 21 août.

Une demi-journée que personne n'occupe garde sa ligne et dit « libre » — la
cacher ferait croire que la journée entière est prise —, mais elle passe
**après** les chantiers : *« le nom toujours en premier ! »*. Le 19 et le 26
ouvraient sur « matin — libre », et l'on lisait ce qui manque avant de savoir de
qui il s'agit.

Dans la légende, les deux rectangles qui montrent la POSITION sont désormais
vides tous les deux : *« le rectangle du matin, mets-le blanc comme celui de
l'après-midi »*. Rempli, le premier se lisait comme un cinquième état, juste
après « au-delà » — alors qu'il ne dit rien de la charge.

Les contrôles visent la structure, pas les mots — combien de fois le nom
paraît, combien de comptes sont écrits, quelle bordure sépare les lignes. Un
contrôle sur « Mr. Leroy » rougirait au premier changement de client d'exemple
et ne défendrait plus rien. Les trois ont été confrontés à la version d'avant :
ils rougissent dessus.


### « Il y a une clé IA » — écrit dans le dépôt, plus dans une session

**Sa consigne, et il a fallu qu'il la répète :** *« il y a une clé IA, il y a
Anthropic, elles sont connectées, les deux clés. Enregistre-le vraiment dans le
dossier, histoire que quand j'ouvre une nouvelle session, tu sois au courant que
la clé Anthropic est active et que tu t'en sers déjà pour faire beaucoup de
choses, notamment pour l'arrosage automatique, analyser la photo. »*

Le dépôt disait « aucune clé d'IA » à cinq endroits, sans jamais préciser **de
quelle machine** il parlait. Une session arrivant à froid en concluait que l'IA
n'était pas branchée — et le lui annonçait. Il l'avait déjà corrigé dans l'autre
sens le 20 août (*« tu peux le faire, il y a déjà l'IA dans l'application »*).

`CLAUDE.md` §1 ter tranche désormais, et il est lu au début de chaque
conversation : **chez lui les clés sont posées et l'IA tourne** ; **ici, sur le
poste de l'agent, il n'y en a aucune**. Les cinq phrases ambiguës sont
corrigées, et la formule juste n'est plus « impossible » mais *« pas vérifiable
ici, à jouer sur ton espace »*, avec la commande.


### La fiche client, refaite — premier lot, celui qui se voit

**Sa demande, puis son choix :** *« j'ai envie que les informations prennent
moins de place »*, et, devant cinq dessins de cases relus sur la page entière :
*« je choisis la 4 »* — la carte douce.

Ce qui change sur `chantiers/nouveau` :

| | |
|---|---|
| **Plus un seul « (facultatif) »** | *« je ne veux plus qu'il y ait marqué facultatif nulle part »* |
| **Le titre « Civilité » part**, Mr / Mme reste | *« je voulais juste que tu enlèves le titre »* |
| **Le nom et le numéro sur une ligne** | et le champ Téléphone isolé disparaît |
| **Le numéro s'espace à la frappe** | `0679984514` → `06 79 98 45 14` |
| **« Comment lui envoyer son devis ? » sous l'adresse** | sa place, choisie par lui |
| **Les cases : la carte douce** | fond papier, 14 px de rayon, aucun bord, l'or au doigt posé |

**La case vit dans UNE classe, `.atlas-case`** (`globals.css`). Elle était écrite
en double — dans `Field` et dans `ChampAdresse` —, et deux écritures de la même
case divergent au premier ajustement (`CLAUDE.md` §3). C'est aussi ce qui lui
donne son état au doigt posé : un style en ligne ne sait pas exprimer un
`:focus`.

**La règle du numéro est une fonction pure** (`src/lib/numero-telephone.ts`),
éprouvée sans navigateur. Deux points y sont mesurés plutôt que supposés : un
numéro qui commence par « + » n'est pas retouché (espacé par paires,
`+33679984514` rendrait `+33 67 99 84 51 4`, le numéro de personne), et **le
curseur reste où l'on corrige** — sans quoi corriger un chiffre au milieu
deviendrait impossible.

**Ce qui n'est PAS dans ce lot, et pourquoi.** Le bouton unique (« Je rédige mon
devis ») et l'anneau sur cet écran arrivent ensemble, au lot suivant : retirer
« Je dicte mon devis » aujourd'hui laisserait la dictée sur la fiche chantier
sans aucun chemin pour y aller — et ce sont soixante-treize suites de bout en
bout qui passent par ce bouton.

**Éprouvé dans un vrai navigateur**, pas seulement à la relecture
(`test-nouveau-chantier-e2e.ts`) : les dix chiffres tapés d'affilée, les deux
cases sur la même ligne, le numéro qui ne déborde pas, la question de l'envoi
sous l'adresse, et l'absence des deux mots retirés.

**Le numéro s'espace à l'ÉCRAN, pas en base.** La jolie forme est un affichage ;
en base, le numéro est comparé, composé et envoyé. Y écrire les espaces
obligerait chaque consommateur à savoir les retirer — le rapprochement des
clients, le lien d'appel, l'envoi du devis — et il suffirait qu'un seul l'oublie
pour qu'un client cesse d'être reconnu, en silence. Le groupement deux par deux,
lui, ne s'écrit qu'une fois : il vient de `numero-lisible.ts`, qui l'employait
déjà pour écrire un numéro sur un écran.

### Le lint retombait dans le même piège, pour la quatrième fois

Un serveur monté à la main avec un `ATLAS_DIST_DIR` inédit a suffi : `npm run
lint` est passé de 4 avertissements à **1 095 erreurs**, toutes venues de code
généré, et la batterie a rougi sur une étape sans rapport avec le lot. Les trois
dossiers connus étaient écartés nommément — pas celui-là.

`eslint.config.mjs` écarte désormais `.next-*/**`. Les trois lignes nommées
restent, elles portent chacune leur histoire ; ce motif couvre les dossiers
qu'on ne connaît pas encore, et c'est le seul moyen qu'il n'y ait pas de
cinquième fois.


### La photo se PREND ou se CHOISIT — partout, plus seulement sur la fiche client

*« Quand je clique sur ajouter une photo au croquis, il faut que soit je puisse
mettre une photo de ma bibliothèque, soit prendre une photo. Le même schéma que
pour ajouter des photos à la fiche client. »*

**`capture="environment"` n'est pas une préférence, c'est un ordre.** Le
téléphone saute directement à l'appareil arrière et le menu « Photothèque /
Prendre une photo » ne paraît jamais. Deux écrans le portaient : le croquis
d'arrosage et le diagnostic végétal.

**Le retirer ne coûte rien** — l'appareil reste le premier choix du menu — et
rend un cas entier : la photo prise la veille. Un croquis se dessine souvent au
bureau ; le rephotographier depuis un écran donne une photo de photo, floue et
de travers, que le modèle lit mal. Un feuillage qui jaunit se photographie quand
on le voit, pas quand on ouvre Atlas.

**Un contrôle réclamait l'inverse, et il a fallu le retourner** — cas d'école de
`CLAUDE.md` §5 bis : *un contrôle ne doit pas réclamer ce que le patron a fait
retirer*. Celui du diagnostic verrouillait l'attribut au motif que le parcours
demandé était « ouvrir, photographier, attendre ». La maquette de la fiche
client vocale, elle, l'interdisait déjà : les écrans disent désormais tous la
même chose.

### « Les clés sont posées » — et l'écran répondait à la mauvaise question

**Il a repris trois fois pour dire la même chose**, et il avait raison à chaque
fois : *« la clé Anthropic et OpenAI est mise sur l'application fonctionnelle,
elle fonctionne pour d'autres secteurs comme la rédaction du devis. Donc
utilise-la. »*

L'écran d'arrosage annonçait « aucune clé d'IA n'est posée sur ce serveur » dès
qu'il ne trouvait ni clé Anthropic ni clé OpenAI. **La question posée n'était pas
la bonne.** Ce qui compte n'est pas qu'une clé existe quelque part, mais que
**celui qui va lire l'image** ait la sienne — et les deux se séparent depuis que
`VISION_PROVIDER` existe : on peut rédiger chez l'un et regarder chez l'autre.

**Deux défauts trouvés en tirant ce fil, et le second était silencieux :**

1. **Le croquis partait chez le fournisseur qui RÉDIGE.** `getFournisseurVision()`
   existait depuis la veille, écrit précisément pour que « qui regarde les
   photos » se règle sans toucher à « qui rédige » — et `lireCroquis` appelait
   pourtant `getFournisseurLLM()`. Une installation qui pose `VISION_PROVIDER`
   envoyait donc ses croquis au mauvais endroit, sans que rien ne le dise.
2. **L'écran se trompait dans les deux sens.** Clé posée chez un fournisseur qui
   ne lit pas les images : il annonçait que tout allait bien, on photographiait,
   rien ne revenait — le « troisième bouton qui ne répond pas », déjà payé trois
   fois ici. Et inversement, il criait au manque là où la lecture marchait.

**Une règle pure décide désormais** (`etatVision`, dans `src/lib/etat-ia.ts`),
et le message qu'elle rend est celui que l'écran affiche : « OpenAI (GPT) lit les
croquis, mais OPENAI_API_KEY n'est pas posée », ou « Google Gemini ne sait pas
encore lire une image ici » — car poser la clé de Gemini n'y changerait rien.
Un « aucune clé » uniforme envoyait chercher au mauvais endroit (`CLAUDE.md` §5).

**Et la lecture s'éprouve enfin pour de bon : `npm run verifier:croquis`.**
`lire-croquis.ts` écrivait noir sur blanc que cet appel n'avait jamais été
essayé, faute de clé ici. La commande dessine un croquis dans un navigateur —
deux surfaces aux cotes différentes, une haie en mètres linéaires, un massif, un
point d'eau —, le photographie, et vérifie que ce qui revient porte SES chiffres
et pas des valeurs par défaut. Sans fournisseur de vision, elle refuse de rendre
un vert et nomme ce qui manque.

### Le calcul suit ses seuils, et ils ne sont pas les mêmes partout

*Sa règle du 21 août 2026 :* **au compteur**, 3 bar, on est bien ; **au seau**,
« dix-huit, vingt secondes, ce n'est pas trop mal : tu peux faire le calcul comme
si tu avais deux bars cinq » ; **au kit**, « 2,5 bar, 3 bar, là tu es
impeccable ».

Le calcul menait jusqu'ici toute mesure sans manomètre à 3 bar — la valeur du
compteur. **C'est la conduite qui fait la différence** : après le compteur, le
Ø25 garantit ses 3 bar ; à un robinet de jardin, on ne sait rien de ce qui
l'alimente. On retient donc le minimum viable plutôt que le confortable. Se
tromper vers le bas met un arroseur de moins par réseau ; se tromper vers le haut
en met un de trop, et c'est le gazon qui jaunit en bout de ligne.

Le seuil est atteint **à** 2,5 bar, pas dépassé : une inégalité stricte l'aurait
refusé de justesse et aurait fait douter d'une mesure qu'il juge bonne.

### Quatre corrections du patron sur l'écran d'arrosage, dont un défaut de parcours

**« Quand je clique sur croquis et que j'ajoute une photo, rien ne se passe. »**
Il avait raison, et c'est le pire des quatre : le bouton ouvrait bien l'appareil,
mais rien ne soumettait le formulaire ensuite — il aurait fallu toucher un second
bouton, que l'écran ne montre pas puisqu'il l'avait demandé sans. **La suite ne
l'a pas vu parce qu'elle ne posait jamais de photo** : elle vérifiait que le
bouton existe et qu'il fait 64 px, jamais que le geste aboutit. C'est exactement
ce qu'`AGENTS.md` interdit — parcourir en entier ce qu'on transmet, du premier
geste au dernier. Un contrôle pose désormais un vrai fichier et exige une
réponse de l'écran.

**Les mesures ne s'affichent plus au compteur.** *« Quand je choisis le piquage,
qu'il se fait après le compteur d'eau, rien ne doit s'afficher. […] Or, quand je
choisis piquage après robinet, là un encart doit s'ouvrir. »* Et son métier
explique pourquoi : *« si on se repique directement après le compteur en
diamètre vingt-cinq, on aura au moins trois bars de pression dynamique, et
pareil en statique — tu sais d'office que tu es bien »*.

**Aucune réserve n'est donc écrite dans ce cas, et c'est une correction de ma
part.** La première version avertissait « débit estimé, à vérifier au seau sur
place ». Un avertissement inutile s'apprend à être ignoré — et celui-là faisait
douter de la seule situation où il n'y a rien à vérifier.

**La pression qui compte est la DYNAMIQUE, buse taille 5.** *« C'est celle-là
qui nous intéresse. »* Robinet fermé, un manomètre lit la statique, toujours
flatteuse ; c'est en débit, à travers une buse calibrée, que le chiffre dit ce
qui arrivera aux arroseurs. L'étiquette le porte, faute de quoi il mesurerait la
bonne grandeur au mauvais moment.

**Une règle pure pour dire d'où vient le débit** (`src/lib/arrosage/mesure-debit.ts`) :
au compteur on calcule sans rien demander ; le seau chronométré est une mesure
et prime sur tout ; **le manomètre seul ne donne PAS le débit** — deux robinets
à 3 bar délivrent l'un 1 m³/h, l'autre 3, selon ce qui les alimente. Dans ce
cas le débit est estimé **et la réserve remonte en rouge sous le plan**. Sans
aucune mesure, hors compteur, on refuse plutôt que d'inventer : un plan bâti sur
un débit supposé a toutes les apparences d'un plan juste, et c'est le paysagiste
qui revient poser un arroseur de moins.

**Le kit se nomme, et il porte DEUX pressions.** *« Tu peux même marquer dans
le bandeau déroulant kit de mesure débit/pression avec buse taille 5, nb de bar
statique et nb de bar dynamique. »* Le kit demande donc les deux, et le seuil
qu'il a donné est écrit noir sur blanc dans la règle : **2,5 bar en dynamique**
— *« si il y a 2,5 bar, 3 bar en dynamique, alors c'est parfait, c'est ce qu'il
faut pour que les arroseurs se lèvent correctement »*. En dessous, les tuyères
sortent mal et arrosent court : le plan le dit plutôt que de laisser découvrir.

**Pourquoi les deux, et pas seulement l'utile.** La dynamique seule ne dit pas
d'où vient le manque. C'est l'**écart** entre les deux qui accuse : une statique
à 4 bar qui tombe à 2 dès qu'on ouvre désigne une conduite trop maigre ou trop
longue — le réseau se retaille, il ne se force pas. Une chute de plus de
1,5 bar remonte donc sa propre réserve, distincte de celle du seuil, et les deux
s'empilent quand les deux sont vraies : savoir que deux choses clochent, et
lesquelles, vaut mieux que de les découvrir l'une après l'autre.

**Le seau a son propre encart, et se dédouane** — sa correction du lendemain :
*« la mesure au seau ne doit pas rentrer dans le kit débit/pression […] un titre
du style mesure au seau, en dessous un seau de dix litres en combien de
secondes, et sur ça tu peux marquer peu fiable ou pas précis, quelque chose pour
se dédouaner »*.

Il avait raison de le gêner, et pas seulement pour la mise en page : ce sont
**deux gestes, deux outils, deux fiabilités**. Sous un même titre, un chiffre
tiré d'un seau rempli à la main paraissait valoir celui d'un manomètre — alors
que c'est le seul des trois à donner le DÉBIT, et le moins précis des trois.
**Et la réserve DÉCONSEILLE au lieu de nuancer** — sa deuxième passe le même
jour : *« peu précis, ordre de grandeur, ça ne va rien dire »*. Il a raison :
une mention qui qualifie le chiffre se lit comme une nuance et se franchit sans
y penser. « Trop approximatif pour calculer un arrosage : prenez le kit » ferme
la question et désigne l'outil juste — sous le champ, là où il le lit au moment
de le remplir, et non dans une réserve découverte sous le plan.

**Deux libellés corrigés à sa demande :** le piquage sur pompe est retiré, et
« Ailleurs (robinet de jardin, nourrice existante…) » devient **« Robinet de
jardin »** — l'ancien se coupait dans le menu natif à 390 px, vu à la capture.
Un contrôle mesure désormais qu'un choix tient dans sa boîte.

### Les quatre questions de la fiche chantier sont réglées

*« Fais ça pour le rajout de la 4e photo du jeudi. »* La dernière réponse
attendue. Bilan des quatre choses que portait la fiche chantier, qu'il veut
supprimer :

| | |
|---|---|
| Créer la facture | **Existe déjà** — la feuille du chevron du planning, et le fil des terminés |
| Les étapes du chantier | **Rien à déplacer** — chacune a son écran, la fiche n'en était que la liste, et l'accueil mène déjà à la prochaine |
| Réécouter la note dictée | **Retiré** — « on n'a pas besoin » |
| Une photo ajoutée plus tard | **Sur la fiche client**, où l'on revient par la flèche de retour du devis |

**Deux de ces quatre réponses ont été cherchées dans le code avant d'être
posées**, plutôt que soumises en question : c'est ce que `CLAUDE.md` §5 ter
demande, et cela lui a épargné deux allers-retours.

**Le parcours est donc tranché ; le code peut commencer**, et `TODO.md` porte la
liste de ce qu'il faudra toucher. Ce qui reste ouvert n'est plus le parcours
mais le **dessin des cases**, et il n'empêche rien.

### La page entière, cinq fois — pour choisir en la voyant

**Sa demande :** *« Fais-moi une maquette dynamique, pas de photos, que je puisse
essayer avec les cinq différentes cases. Toute la page de haut en bas avec les
cinq différentes cases, comme ça ce sera plus visuel et je pourrai choisir. »*

`appli/cases-a-remplir.html` montrait les cinq **en morceaux** : trois champs à
la suite. On y juge un dessin, on n'y voit pas ce qu'il devient sur un écran
entier — à côté des capsules « Par SMS », du carré photo, de l'anneau, du bouton
vert. C'est pourtant là que se décide « joli » : dans l'accord, pas dans le
détail.

**`appli/cases-page-entiere.html`** — la fiche client complète, un choix de cinq
en haut, et tout continue de marcher : le numéro qui s'espace à la frappe, les
photos, l'anneau qui dicte. **Un seul jeu de balises, cinq feuilles de style** :
l'écran est écrit une fois et se relit sous chaque dessin, sans quoi la
comparaison serait truquée.

**Ce que la capture a montré et qu'aucune mesure n'aurait vu :** le dessin
« ligne de fiche » masquait TOUS les petits titres pour ranger les intitulés à
gauche — emportant « Comment lui envoyer son devis ? » et « Photos du chantier »,
qui ne coiffent aucune case. Il gagnait en légèreté ce qu'il perdait en contenu.
Le contrôle exige désormais les deux titres dans les cinq dessins.

**Les cases de la fiche client, elles, ne bougent pas** : *« pour les cases,
change rien, on reste comme on est là »* — le temps qu'il choisisse.

### Le numéro s'espace tout seul, et deux questions de moins

**Sa demande :** *« Il faut que je puisse taper les dix chiffres à la suite et
qu'ils se mettent automatiquement avec les bons espaces. »* Sur un chantier,
devant le client, on ne s'arrête pas toutes les deux touches. `0679984514`
devient `06 79 98 45 14` à la frappe, et les points, tirets et lettres tombent.

**Deux choses mesurées plutôt que supposées.** Un numéro qui commence par « + »
n'est **pas** retouché : espacer `+33679984514` par paires rend
`+33 67 99 84 51 4`, qui n'est le numéro de personne — un indicatif ne se découpe
pas comme un numéro français. Et **le curseur ne saute pas à la fin** : corriger
un chiffre au milieu est le geste le plus courant après la frappe, et un curseur
renvoyé au bout à chaque touche rend la correction impossible.

**Deux des quatre questions de l'écran « À trancher » sont réglées** : la facture
(*« dans la catégorie planning ou terminé »* — les deux chemins existaient déjà)
et la relecture de la note (*« on n'a pas besoin de réécouter »*). La question
des photos ajoutées après coup était mal posée : elle est réécrite avec le cas
concret plutôt qu'en résumé.

### Cinq façons de dessiner une case à remplir

**Sa demande :** *« Fais-moi des photos des cases à remplir plus jolies, je peux
plus voir ces encadrés carrés. »*

**`appli/cases-a-remplir.html`** — cinq traitements du MÊME bloc (nom,
téléphone, e-mail, adresse) : le trait, la capsule, la ligne de fiche, la carte
douce, le creux. Le bloc ne change pas d'une proposition à l'autre, sinon il
choisirait un contenu au lieu d'un dessin.

Ce qui ne bouge pas non plus, et c'est délibéré : la charte, la place du texte
saisi (16 px — en dessous, iOS zoome tout seul à la mise au point), et **la
hauteur de prise, 48 px minimum**. Mesurée, pas supposée : la « ligne de fiche »
était à 46 px et a été relevée. Une case élégante qu'on rate deux fois sur trois
n'est pas élégante, elle est ratée.

**Rien n'est codé** — il tranche.

### Mr / Mme revient, son intitulé reste parti

*« Non, remets le Mr et Mme, je voulais juste que tu enlèves le titre
civilité. »* Corrigé dans la minute. Les deux boutons se comprennent seuls, et
c'est une ligne de petites capitales de moins. Le contrôle tient désormais les
deux moitiés : l'intitulé absent **et** les deux boutons présents — retirer le
choix était une amputation, remettre le mot annulerait le gain de place.


### La fiche client qui dicte le devis — dessinée, pas codée

**Sa demande, capture de l'écran à l'appui :** *« J'ai envie que les
informations prennent moins de place. Le nom et le numéro de téléphone l'un à
côté de l'autre. Tu me retires tous les facultatifs. Tu vas m'ajouter la
possibilité de mettre des photos exactement comme il y a sur la page d'après.
Ensuite, avant les deux touches, le bouton de la note vocale qui se trouve sur
la page d'après. On appuie, on dicte les tâches à effectuer, celles qu'on voit
tout de suite avec le client. Dès qu'on rappuie pour arrêter, il faut
impérativement que les infos aillent s'enregistrer dans le devis. »*

Et le pourquoi, qui commande tout le reste : **il est en rendez-vous**. Il dicte
ce qu'il voit, il n'a pas le temps de continuer, il ferme l'application. En
rentrant chez lui, le chantier l'attend à l'accueil et un appui ouvre le devis
déjà rempli.

**`appli/fiche-client-vocale.html`** — essayable, quatre écrans, atteignable
depuis `appli/essais.html`. **Rien n'est codé** (`CLAUDE.md` §3 bis).

**Deux pièces sont REPRISES DU CODE, pas redessinées**, parce qu'il a dit
« exactement comme il y a sur la page d'après » : l'anneau
(`AnneauNoteVocale.tsx` + le bloc `.atlas-lecteur` de `globals.css` — deux
cercles, trois traits d'or qui battent, huit barreaux par aile) et le champ de
photos (`Pellicule.tsx` — un champ unique, `accept="image/*" multiple`, **sans
`capture`**, sans quoi un iPhone imposerait l'appareil et retirerait l'accès à
la pellicule).

**Ce que la capture a montré et qu'aucune mesure à l'œil n'aurait vu :** à la
première largeur essayée, le numéro s'affichait « 06 79 98 45 1 » — le dernier
chiffre tombait, en silence, sur la seule donnée qu'on ne peut pas deviner. Le
contrôle compare désormais la largeur du texte à celle de sa boîte, et refuse de
conclure sur une boîte de zéro pixel.

**Ce qui est posé plutôt que tranché à sa place.** Il veut supprimer la fiche
chantier pour de bon : elle porte « Créer la facture », les étapes, la relecture
de la note et les photos d'après-coup. Un quatrième écran, « Ce qui reste à
reloger », montre où chacune irait — il choisit avant qu'on code.

**Aucun prix n'est inventé sur le devis dessiné** : il n'a annoncé aucun montant
en dictant, les trois lignes arrivent donc à chiffrer (`CLAUDE.md` §4).

**Trois corrections le même soir, sur la planche** : un seul bouton et c'est
*« Je rédige mon devis »* ; *« Comment lui envoyer son devis ? »* descend **sous
l'adresse** ; et *« au-dessus du numéro de téléphone, marqué numéro de
téléphone »*, puis *« enlève numéro de, laisse juste téléphone »* — l'intitulé
unique « Client » laissait deviner ce qu'était la seconde case, et on ne devine
pas sur une fiche qu'on remplit devant le client.
Le contrôle vise ses mots à la lettre et l'ordre des blocs : c'est ce qui les
défend de la réécriture suivante.

**Et la civilité part**, dans la foulée : deux boutons sur la première ligne de
l'écran alors qu'il écrit déjà « M. Julien » dans le nom. Le titre vient du nom
qu'il tape. Le contrôle refuse qu'elle revienne — un retrait ne se tient que par
ce qui ne doit plus être là.

**Puis, capture de l'accueil à l'appui :** *« quand je clique sur devis à
terminer, je dois arriver directement sur la page du devis, pas ailleurs, et les
infos que j'ai dictées doivent être remplies »*. Le chemin y menait déjà —
vérifié au doigt, sur un iPhone simulé. **Ce qui manquait, c'est que ce soit SON
chantier** : la carte et le devis affichaient un nom d'exemple quoi qu'il tape.
Le nom, le numéro et l'adresse saisis partent maintenant avec la dictée jusqu'au
devis, et une case laissée vide se dit (« Client sans nom ») plutôt que de se
remplacer par un exemple.

### La fiche dit enfin si le port est ouvert

**« Elle ne se lance plus »**, alors que sa fiche annonçait un serveur qui
répond, le bon code servi, et « tout concorde ». Un port privé donne exactement
ce symptôme : GitHub répond par sa page de connexion à la place d'Atlas, et
depuis un téléphone non connecté à GitHub il n'y a **rien à voir**.

L'état du port n'était écrit que dans le terminal du démarrage — que personne ne
relit. Il est désormais déposé par `demarrer.sh` et publié sur la fiche, avec le
remède en trois clics quand il est privé.

**Pourquoi ça retombe en panne tout seul :** `devcontainer.json` déclare le port
public depuis le 6 août, mais ce fichier n'est appliqué qu'à la CRÉATION de
l'espace — et le sien est plus ancien. Le geste est rejoué à chaque allumage par
`ouvrir-port.sh`, qui a besoin de `gh`… absent de cette image. D'où un port qui
peut redevenir privé sans que rien ne le dise. C'est la troisième fois que ce
piège coûte une soirée (10 août, puis 21).

### Attendre la construction d'à côté au lieu de la tuer

**Sa plainte du matin :** *« l'appli est hyper lente »*, pour la troisième
matinée. Sa fiche : construction échouée sur « Another next build process is
already running », **4,5 Gio de mémoire libres** — donc pas la saturation qu'on
soupçonnait le 17 août.

Le démarrage lance **deux constructions par nature** : un veilleur est posé
avant la mise à jour pour que l'application réponde tout de suite, et le banc
suivant en relance une. Quand la seconde tombait sur la première, on délogeait
et l'on recommençait — c'est-à-dire qu'on jetait plusieurs minutes de calcul
déjà faites, sur une machine qui n'en a pas les moyens.

Elle est désormais **attendue** (dix minutes au plus, avec un signe de vie
chaque minute), et l'on ne déloge qu'ensuite — ce qui reste alors est bien une
orpheline.

**Et le détenteur du verrou se cherche par le fichier, plus par son nom.** Une
construction Next est faite de cinq processus, dont deux ne portent nulle part
les mots « next build » : un survivant de cette espèce était invisible à toute
recherche par motif. `detenteursDuVerrou()` lit `/proc/<pid>/fd` et trouve qui
tient `<dist>/lock`, quel que soit son nom.

**CE QUI N'EST PAS PROUVÉ :** la panne n'a pas été reproduite ici. Deux
hypothèses ont été éprouvées et écartées — le `sleep 1` du démarrage, et
l'orphelin invisible. Ce qui est livré rend le mécanisme sûr, pas la panne
corrigée. `TODO.md` la garde ouverte.

---

## 2026-08-21

### Les documents d'un client s'enregistrent, au lieu de seulement s'ouvrir

**Sa demande :** *« je veux pouvoir l'enregistrer, mais avant que tu codes quoi
que ce soit, fais-moi une maquette visuelle »*. Trois façons lui ont été
dessinées ; il a retenu **la C**.

Sur la fiche d'un client, toucher un document ouvre désormais trois choix :
**Enregistrer**, Ouvrir, Partager. Le fichier arrive sous son vrai nom —
`devis-2026-0029.pdf` — et non sous celui de la page.

**Pourquoi pas plus court.** La proposition la plus rapide enregistrait dès le
premier appui : ouvrir la fiche d'un client pour relire un montant lui aurait
téléchargé un fichier à chaque coup d'œil. Celle qu'il a retenue ne décide de
rien à sa place.

**« Partager » revient**, après avoir quitté l'écran d'envoi le même matin :
c'était le seul chemin vers WhatsApp, et sa place est sur le document rangé.
`ARCHITECTURE.md` §141.

### Le devis envoyé ramène à l'accueil, sans écran de trop

**Sa demande, capture à l'appui :** *« Quand je clique sur envoyer le devis, il y
a bien l'application SMS qui s'ouvre, ça c'est bien. Par contre juste derrière,
il y a cette page-là qui s'affiche et je n'ai pas besoin qu'elle s'affiche […]
il faut qu'on retourne directement sur l'accueil. »*

Elle ne lui apprenait rien : il venait d'appuyer, et sa messagerie s'était
ouverte par-dessus. Au retour de Messages, un récapitulatif à refermer avant de
reprendre son travail. C'est le deuxième écran de trop retiré du même parcours
en deux jours.

**L'écran du devis parti reste**, mais on ne le voit plus qu'en y revenant par la
carte du chantier. Il s'allège : « Télécharger le PDF · Partager » est retiré. Le
devis parti se range de lui-même en PDF dans la fiche du client, colonne
« Devis » — c'est lui qui l'a rappelé, et le code lui donne raison.

**Ce que ça coûte, dit franchement :** « Partager » était le seul chemin vers
WhatsApp depuis cet écran. Et la bascule « Plutôt par e-mail » a été GARDÉE
malgré sa réponse : c'est le seul endroit où saisir une coordonnée manquante, et
son absence était sa plainte du 13 août. `ARCHITECTURE.md` §140.

### La ligne « Version » disait le disque, pas ce qui tournait

**Sa phrase :** *« Ça n'a pas marché, j'ai encore l'ancienne version. Pourtant
j'ai rechargé les mises à jour. »* Les deux moitiés étaient vraies en même
temps — et c'est ce qui a fait chercher au mauvais endroit.

Son banc sert une version **construite** : c'est ce qui la rend rapide.
Récupérer le code neuf fait avancer le disque sans toucher à ce qui s'exécute.
La ligne « Version » de Réglages, elle, lisait le disque : elle confirmait la
mise à jour à l'instant précis où elle aurait dû avertir que rien de neuf
n'était servi.

**Ce qui change :** cette ligne annonce désormais **ce que l'application
exécute**. Quand du code plus récent attend d'être construit, l'écran le dit, le
nomme, et donne le geste — rouvrir l'espace de travail.

**Ce que ça ne fait pas, dit franchement :** cela n'accélère rien. Cela cesse de
prétendre que le code neuf est là quand il ne l'est pas. `ARCHITECTURE.md` §139.

## 2026-08-20

### « Mieux vaut refuser de conclure que produire un faux diagnostic »

Sa consigne du 20 août, appliquée point par point (`ARCHITECTURE.md` §138). Ce
qui existait déjà : le modèle n'a aucun champ pour nommer une maladie, tout ce
qui s'affiche sort d'une colonne, l'outil sait refuser. Ce qui manquait :

**L'hôte d'abord.** Atlas ne diagnostique plus sans avoir identifié l'essence.
Sans elle, il demande la photo qui identifie un arbre — feuille entière posée à
plat, puis l'arbre entier — et refuse au second passage. Un symptôme
parfaitement caractéristique sur une essence non reconnue ne conclut donc plus :
c'est le prix, et il est assumé.

**La liste d'hôtes exclut, sauf si la source dit le contraire.** Une maladie du
platane ne peut plus remonter sur un chêne. C'est la fiche qui déclare si sa
liste est close, en recopiant ce que le document affirme — l'anthracnose du chêne
dit « de nombreuses espèces », l'anthracnose du platane dit « Hôtes habituels :
Platanes ».

**Le plafond de la source gagne toujours.** Une fiche dont le document exige un
laboratoire ne peut plus afficher mieux que « probable », quel que soit son
score, et l'écran porte désormais un bloc « Ce qui reste à confirmer » avec la
phrase exacte de la source. Les photos de référence portent leur avertissement :
« une ressemblance n'est pas une preuve ».

**Et la comparaison champ par champ après chaque import.** La fiche est relue
depuis la base et confrontée à son fichier, ligne à ligne, dans la transaction,
avant validation. Le moindre écart annule l'import entier et nomme le champ.
Aucune fiche ne peut plus porter « validée » sans ce contrôle — c'est une
contrainte de la base, pas une intention du code.

**Elle a trouvé deux pertes réelles dans l'heure qui a suivi son écriture** : le
chemin des photos, que la base jetait après en avoir tiré une clé de stockage ;
et l'ordre des listes d'hôtes, de sources et de confusions, relues par ordre
alphabétique au lieu de l'ordre du document. Les deux sont réparées — en gardant
l'information, jamais en assouplissant le contrôle.

Un troisième défaut est sorti d'une capture, pas d'un test : la phrase du
laboratoire s'affichait deux fois de suite à l'écran. L'import la refuse
maintenant.


### Anthracnose du chêne et du hêtre — et la relance photo, enfin sur du réel

Troisième fiche réelle, écrite depuis la page Ephytia (INRAE, auteur DSF) que le
patron a transmise et relue champ par champ. La source commande deux choses que
la fiche recopie sans les adoucir : la confirmation **exige un laboratoire**
(d'où `diagnosticPhoto: "indicatif"`, qui plafonne la confiance à « probable »
quel que soit le score), et les chancres **fragilisent les branches** (d'où
`impactMecanique: "possible"`, qui fait apparaître la mention de sécurité). Les
quatre confusions que la page nomme — *Septoria quercicola*, gel, phytotoxicités,
carences aiguës — ne sont **pas** écrites : une confusion doit désigner une fiche
qui existe, et aucune de ces quatre n'existe encore.

**Ce qui a été débloqué pour l'écrire**, et qui vaut pour toutes les fiches à
venir (`ARCHITECTURE.md` §137) :

- une confusion ne pouvait relier que deux fiches d'un **même fichier**. Or les
  fiches qui se confondent sont celles qu'on écrit à deux jours d'écart, depuis
  deux pages différentes. Le contrôle porte désormais sur l'import entier ;
- et son écriture **se perdait en silence** quand la fiche visée n'était pas
  encore en base : `INSERT … SELECT` n'insère rien sans se plaindre. L'ordre
  alphabétique des fichiers décidait de ce qui marchait. Les liens en attente
  sont maintenant raccordés à la fin, et ce qui manque encore fait tomber
  l'import.

Résultat, éprouvé : une nécrose brune sur feuille **sans essence identifiée** ne
conclut plus au hasard entre les deux anthracnoses — elle demande *« Photographiez
une feuille entière, posée à plat »*, puis conclut à la seconde photo. C'est le
premier usage réel du mécanisme de photo complémentaire.

Deux contrôles corrigés au passage : l'un comptait les confusions de la base
entière, ce qui n'était vrai que tant qu'elle ne portait que des fixtures ; la
suite navigateur recopiait à la main le résultat qu'affiche l'écran, au lieu de
le composer comme le fait le produit.

### Le devis part par le canal de la fiche client, pas par celui de la page

**Son défaut, capture à l'appui** : *« sur la fiche client, j'ai choisi
d'envoyer le devis par email. Et lorsque j'ai validé mon devis […] c'est
l'application SMS qui s'est ouverte. »*

**Deux sources décidaient du même canal, et elles divergeaient.** Le serveur
relisait la fiche du client au moment d'envoyer — et refuse d'ailleurs de partir
tant qu'aucun canal n'y est convenu. L'écran, lui, réutilisait une valeur
**chargée avec la page**, qui retombait sur un `?? "sms"` écrit à la main. Un
canal changé entre-temps, ou simplement absent, ouvrait donc la mauvaise
application — vers un numéro que le client n'a peut-être pas.

**L'envoi rend maintenant le canal ET le destinataire qu'il vient de valider**,
et c'est ce que l'écran ouvre. Une seule source, la bonne, et rien à
rafraîchir.

**Et le `?? "sms"` a disparu des écrans** au profit de `canalPourJoindre` : le
canal convenu s'il a sa coordonnée, sinon la seule coordonnée renseignée, sinon
`null` — on ne sait pas, et on le dit. Un client qui n'a qu'une adresse e-mail
ne se voit plus proposer un SMS.

Éprouvé en rejouant son parcours exact, client portant les deux coordonnées :
`test-envoi-client-e2e.ts` (« le canal de la fiche commande l'ouverture »), plus
la règle seule dans `test-message-client.ts`.

### L'écran ne promet plus une version rapide que personne ne construit

**Sa soirée du 20 août :** *« L'application est lente, corrige ça. »* Puis, en
regardant Réglages : *« Si il y a marqué version lente. »* L'écran disait donc
vrai — son banc servait bien la version lente, celle où chaque écran se compile
à l'ouverture.

**Mais il terminait par une promesse fausse :** *« La version rapide prend le
relais dès que la construction aboutit. »* Cette nuit-là elle n'aboutissait pas,
et n'allait jamais aboutir — **son veilleur était tombé, et c'est lui qui
construit**. Le panneau lui demandait d'attendre quelque chose qui n'arriverait
pas ; il a attendu, puis il a redemandé.

Le panneau dit maintenant ce qu'il constate : personne ne construit → « éteignez
puis rouvrez votre espace de travail » ; une construction tombée mais un
veilleur en place → il retente seul, et rallumer répare plus vite ; tout va bien
→ la phrase d'avant, qui redevient vraie. La règle vit dans
`src/lib/version-lente.ts`, éprouvée sans banc ni serveur ; confrontée à
l'ancienne phrase, sa suite rend trois rouges.

**Et le produit, lui, n'est pas lent** — mesuré le même soir sur le code du
jour, version bâtie : connexion à l'accueil en 890 ms, chaque écran entre 0,6 et
1,1 seconde. `TODO.md` porte le relevé.

### « Choisir la date » : envoyer un devis coûte deux écrans au lieu de trois

**Sa demande, trois captures à l'appui :** *« Le bouton envoyer au client, tu vas
me le modifier par "Choisir la date" […] j'arrive directement sur la page où je
peux choisir la date […] on supprime la page qui est entre les deux. On va
raccourcir les étapes. »* Puis son choix devant la planche : *« A et la 2 »*.

**Le doublon était réel.** L'écran du milieu redisait le client, les lignes et le
total que le devis venait d'afficher en entier — pour proposer le même geste. On
ne relit pas un devis qu'on vient de fermer.

**Ce qui change :** sur le devis, un bouton plein **« Choisir la date »**, sans
flèche, au-dessus de l'aperçu du PDF. Un appui ouvre le calendrier **sans
changer d'écran**. L'ancienne adresse renvoie au devis tant que rien n'est parti.

**Ce qui ne change pas :** le calendrier, l'interrupteur « il peut proposer une
autre date » et « Envoyer le devis » sont la MÊME feuille, ouverte plus tôt. Et
l'écran du devis parti — le « signet d'or » qu'il avait retenu — garde son
travail : le lien à transmettre, la reprise.

**Deux effets que seul le navigateur a montrés.** La phrase « Devis prêt pour
Mr. Martins. » se perdait après l'envoi, l'écran annonçant « en attente de
réponse » une seconde après l'appui — vrai, et froid ; le moment voyage
maintenant dans l'adresse. Et deux boutons « Annuler » cohabitaient sur le même
écran sans se distinguer à l'oreille.

**Un défaut corrigé au passage, et qui se voyait à l'œil nu :** rechargé, l'écran
d'après l'envoi reprenait « Devis prêt pour … » comme si le devis venait de
partir — même trois jours plus tard. Il dit maintenant où en est vraiment le
devis, et ne garde la phrase du moment que pour la visite où elle est vraie.

**Ce que ça coûte, dit franchement :** vingt-six suites passaient par l'ancien
chemin et ont dû suivre. La batterie complète en a fait rougir onze de plus, que
deux suites jouées seules n'avaient pas vues — dont celle qui a trouvé le défaut
ci-dessus. Deux suites ont été supprimées avec l'écran qu'elles mesuraient, sans
rien perdre de ce qu'elles gardaient encore de vivant.
`ARCHITECTURE.md` §136, `docs/maquettes/82`.

### « Il faut absolument mettre des photos » — l'écran en montre une, et d'où elle vient

**Sa demande du 20 août 2026 :** *« L'utilisateur a besoin de comparer avec une
vraie photo qui comporte la maladie. »* Il avait raison, et il manquait tout le
chemin : `images_phyto` existait depuis la migration 0056, mais **rien ne les
versait, rien ne les servait, rien ne les affichait**.

Le chemin est complet :

- **verser** — une fiche désigne un fichier du dépôt ; l'import le range dans le
  stockage. Il refuse au-delà de **500 Ko** (ces photos sont versionnées dans
  Git, où rien ne s'efface, et affichées sur un téléphone au bord d'une route),
  et il refuse une **licence qui est un aveu** — « à vérifier », « inconnue »,
  « ? ». Le champ était obligatoire en base, mais rien n'empêchait d'y écrire
  n'importe quoi : l'obligation rassurait au lieu de protéger ;
- **servir** — `/api/phyto/image/[id]`, une route à part. Celle des fichiers
  vérifie la clé contre l'entreprise du contexte, ce qui protège les photos de
  chantier ; la base phytosanitaire est commune, et l'y faire passer aurait
  demandé d'affaiblir ce contrôle. **On sert par identifiant, jamais par clé de
  stockage** : une route acceptant une clé arbitraire laisserait quiconque a un
  compte lire n'importe quel objet en devinant un chemin ;
- **afficher** — sur l'écran PRINCIPAL, sous « À quoi ça ressemble », **avant**
  la conduite à tenir. Comparer suppose de voir les deux ensemble ; reléguer la
  photo derrière « Voir les détails » aurait vidé le geste de son sens. Le
  crédit et la licence sont affichés dessous : la plupart des licences libres
  l'exigent, et une photo sous CC-BY sans son auteur visible est une photo
  employée hors licence.

**Les images sont lues en direct, pas figées dans le résultat.** Le diagnostic
est figé — le nom, la gravité, la conduite, ce sur quoi il a agi. La photo est
une aide à l'œil : la geler par identifiant la casserait au premier réimport de
la fiche, et une image morte est pire qu'une image un peu différente.

**Ce que ça ne règle pas, et qu'il faut dire :** aucune photo réelle n'est
livrée. Celles des organismes portent des crédits nominatifs — sur la seule
fiche du platane : CHAMONT S. (INRA), © GIRAUDEL Arnaud, © Jean-Pierre Henry.
Les trois sources propres sont écrites dans `donnees/phyto/LISEZ-MOI.md`, et la
première est la meilleure : **ses propres photos**, prises au téléphone dans les
conditions réelles — exactement ce que l'utilisateur photographiera.

**Éprouvé en regardant l'écran**, avec une image d'essai générée (aucun droit de
tiers) : photo rendue en 338×338, servie en 200, crédit affiché, placée avant la
conduite, et rien de caché derrière la barre du bas. Une image de zéro pixel
aurait été refusée par le contrôle — c'est le défaut du 15 août.


### Deuxième fiche réelle — et un avertissement qui parlait à tort

**L'anthracnose du platane**, écrite à partir de la page Ephytia (INRAE, auteur
Département de la santé des forêts) que le patron a transmise, faute de pouvoir
l'atteindre depuis ici.

**Le vrai apport de ce lot n'est pas la fiche : c'est le défaut qu'elle a
révélé, et il n'est sorti d'aucun test.** Devant une feuille de platane, Atlas
affichait, sous « Surveiller l'évolution » et une gravité « Faible » :

    ⚠ Une photo ne permet pas de juger la solidité de l'arbre.

La fiche déclare `impact_mecanique: inconnu` — sa source ne parle pas de
stabilité —, et la règle affichait la mention dès que l'impact n'était pas
« aucun ». C'est exactement le travers que `CLAUDE.md` nomme à propos du rappel
de panne : **un avertissement qui parle à tort s'apprend à être ignoré**, et le
jour où il compte, il est devenu du décor.

La règle tient désormais compte de la gravité quand l'impact est inconnu : une
source qui a jugé le dégât mineur n'est pas une source silencieuse. `possible` et
`avere` restent inconditionnels, et une fiche grave dont la stabilité est
inconnue continue de le dire.

**Vérifié en regardant les trois écrans** : platane → pas de mention ; sporophore
au collet d'un épicéa → « Fomès des résineux · confiance probable » avec la
mention ; photo floue → refus.

**Et la fiche dit ce que sa source NE dit pas.** Aucun traitement — la page n'en
donne aucun, le champ reste vide. Aucune confusion — la page n'en nomme aucune.
Les trois figures ne sont pas reprises : une image sans licence ne s'affiche pas.


### Le plan d'arrosage entre DANS l'application, et le croquis se lit

**Sa demande, en trois mots :** *« Code le tout dans l'appli »* — après *« pour
la lecture du croquis tu peux le faire, il y a déjà l'IA dans l'application,
Anthropic et OpenAI »*, puis *« les clés sont présentes également ! »*.

**J'avais dit le contraire, et il avait raison.** J'avais annoncé que lire une
image demandait un contrat qui n'existait pas. Le raccordement des deux
fournisseurs est écrit depuis le 6 août, et l'un comme l'autre sait regarder une
photo. Corrigé dans le dépôt (`d0975ca`) avant d'écrire une ligne.

**Trois morceaux :**

| | Où | Ce qu'il porte |
|---|---|---|
| Le calcul | `src/lib/arrosage/` | le débit au seau, le découpage en réseaux qui tiennent dans ce débit, la liste des pièces prise dans le catalogue |
| La lecture | `src/server/ai/services/lire-croquis.ts` | la photo part au fournisseur, ce qui revient est relu par une fonction pure qui **refuse ce qu'elle ne comprend pas** |
| L'écran | `src/app/paysage/arrosage/` | un titre, un déroulant, trois cases, un bouton |

**UNE SEULE SOURCE POUR LE CALCUL, et un contrôle qui l'impose.** Le calcul et
le catalogue existaient déjà dans `appli/`, éprouvés depuis des jours. Les
réécrire en TypeScript aurait produit **deux calculs qui finissent par ne plus
dire la même chose** (`CLAUDE.md` §3) — et c'est le paysagiste qui aurait vu la
différence entre la page qu'il essaie et l'application qu'il utilise. Les deux
copies sont donc **identiques octet pour octet**, et
`scripts/verifier-arrosage-une-seule-source.mjs` refuse qu'elles divergent. Le
prix : la copie serveur porte des fonctions de navigateur que rien n'appelle,
et un silence de lint qui l'explique.

**Rien ne s'invente, et ce qui manque se dit :**

- une zone sans cote lisible **ne part pas au calcul** — la compter pour zéro
  donnerait un plan qui l'oublie en silence ;
- un croquis dont aucune zone n'est mesurable est **refusé**, avec sa raison ;
- ce que la lecture n'a pas su lire s'affiche en **réserves**, sous le plan ;
- une pièce sans référence n'en reçoit pas une inventée — c'est une ligne à
  mesurer ou à assembler, et le typage l'a imposé ;
- **sans clé d'IA, l'écran le dit AVANT le geste.** Le laisser photographier
  pour rien serait le troisième bouton qui ne répond pas.

**L'écran Paysage cesse de mentir.** Il ouvrait une page publiée hors d'Atlas,
et son commentaire l'expliquait ; le commentaire décrivait un monde disparu dès
que l'outil est entré — corrigé dans le même commit que le code.

**Le plafond de mots suit l'écran dans l'application** : la suite compte les
mots et rougit dès qu'il en regagne. C'est ce que le dépôt réclamait depuis
quatre plaintes sur la même chose.

### La première fiche phytosanitaire RÉELLE — et la chaîne éprouvée de bout en bout

**Le fomès des résineux**, écrit à partir de la plaquette du Département de la
santé des forêts (juillet 2013), récoltée par le workflow puis **lue en
entier** — jamais de mémoire.

Le parcours complet fonctionne sur une donnée réelle : document officiel récolté
→ lu → saisi → six contrôles → importé → rapproché → conclu. Devant un
sporophore au collet d'un épicéa, Atlas répond **« Fomès des résineux ·
confiance probable »**. Le plafond de confiance vient de la fiche elle-même :
elle déclare `diagnostic_photo: indicatif`, parce que le document dit en toutes
lettres que chez l'épicéa « aucun symptôme extérieur n'est visible » et que les
carpophores « sont souvent peu visibles ». **La source borne ce qu'Atlas ose
affirmer** — c'est exactement ce que le module devait faire.

**Ce que la fiche NE dit pas, et pourquoi c'est écrit dedans.** L'impact
mécanique est « possible » et non « avéré » : le document décrit une pourriture
du bois de cœur, mais ne se prononce nulle part sur la stabilité de l'arbre —
c'est un document de gestion forestière. Aucun feuillu n'est listé comme hôte,
le document précisant que le fomès s'y rencontre « de manière anecdotique ». Les
deux confusions réelles qu'il nomme (armillaire, rhizina) ne sont pas écrites :
une confusion doit désigner une fiche existante, et ces deux-là n'ont pas encore
de source lue. Chaque vide porte sa raison, dans un champ `_source_*`.

**Ce qui limite le rythme n'est pas la saisie, c'est le TYPE de document.** Neuf
documents ont été récoltés ; un seul était une fiche-type, et il a suffi. Les
bilans régionaux nomment les problèmes et donnent des niveaux d'impact, mais
décrivent rarement les symptômes assez précisément pour les écrire dans le
vocabulaire fermé. **INRAE (Ephytia) en contient beaucoup — sa licence de
réutilisation est le vrai point bloquant**, et c'est une décision, pas du code.

**Une suite a rougi sur du code juste, et sa correction vaut la règle** : un cas
affirmait « la base est vue comme vide » sans la garde des fixtures. C'était vrai
par ACCIDENT — il n'y avait alors aucune fiche réelle. Il affirme désormais ce
qu'il devait affirmer : *aucune fixture ne sort*. Ce que la base contient par
ailleurs ne le regarde pas (`CLAUDE.md` §5 bis).


### Les sources phytosanitaires sont hors d'atteinte d'ici — la récolte part ailleurs

**Constaté en cherchant à écrire les premières fiches.** Les six domaines que le
patron a nommés — `agriculture.gouv.fr`, `inrae.fr`, `fredon-france.org`,
`onf.fr`, `plante-et-cite.fr`, `ephy.anses.fr` — répondent tous `403 à CONNECT`
au mandataire réseau. La recherche web passe, mais elle rend un **résumé écrit
par un modèle**, pas la page.

**Ce qui a été écarté, et c'est le vrai sujet de ce lot :** écrire les fiches
d'après ces résumés. Le résultat aurait eu toutes les apparences d'une donnée
sourcée — organisme, titre, adresse, date de consultation — sans que personne
ait lu le document. **Une fiche vide se voit ; une fiche mal sourcée se croit.**

`.github/workflows/recolter-sources-phyto.yml` va donc chercher les documents
depuis une machine qui a le réseau, en extrait le texte et le dépose sur une
branche à lui — jamais sur `main`. Même famille que `pages.yml`,
`relever-palette.yml` et `banc-essai.yml`.

**Deux garde-fous posés en même temps, et ils comptent plus que le workflow :**
rien n'est rapatrié sans **licence déclarée** (une source en `a_verifier` garde
son adresse et rien d'autre) ; et la **CI contrôle `donnees/phyto/fiches` à
chaque poussée** — les fiches arrivent par des fichiers de données, pas par du
code, et sans ce contrôle une fiche validée sans source entrerait sur `main`
sans que rien ne s'y oppose. Le contrôle a été confronté à une fiche
volontairement fautive avant d'être branché.

### La batterie ne bâtissait plus — et son rouge était devenu du décor

**Trouvé en jouant `npm run verifier:avant-livraison` le 20 août :** l'étape
« Construction » échouait sur *« Variable d'environnement obligatoire
manquante : DATABASE_URL »*, en accusant une route d'agenda Google qui n'y est
pour rien. Vérifié sur `main` sans aucune modification : **elle échouait déjà**.

La construction collecte les données de page, ce qui instancie la configuration
du serveur. La CI pose `DATABASE_URL` au niveau du job et bâtit donc sans
broncher ; l'étape locale ne la posait pas. **La batterie ne jouait pas ce que
la CI joue** — et une étape rouge en permanence s'apprend à être ignorée, ce qui
fait perdre le seul contrôle qui protège le banc du mode lent (`CHANGELOG` du
16 août : *« l'appli est vraiment très lente, mais vraiment »*).

L'adresse est simplement lisible : aucune requête n'est faite pendant une
construction.

### Dicter le chantier dans le devis, et le retrouver rédigé

**Sa demande :** *« Il existe un petit logiciel que des étudiants posent sur
leur table pendant le cours : ils parlent, ça enregistre, et ensuite ça
synthétise. Sur la page du devis, j'aimerais la même chose — qu'il appuie sur la
note vocale, qu'il parle en expliquant les tâches à faire, et que
l'intelligence artificielle comprenne et rédige ça sous forme de belles
phrases. »*

Le micro du devis existait depuis le 15 août, mais il n'écoutait qu'un artisan
qui **corrige** des lignes déjà écrites. Il écoute désormais aussi celui qui
**raconte** son chantier — les deux dans la même dictée, avec le même micro et
sans rien changer à l'écran.

Sur son exemple — *« j'aimerais tailler ma haie, enfin je ne sais plus, je crois
que c'est quelque chose comme vingt mètres linéaires […] couper les
inflorescences des hortensias, et tondre la pelouse »* — il obtient trois lignes
proposées, à cocher : **Taille de haie** (20 ml), **Taille des inflorescences
d'hortensias**, **Tonte de la pelouse**. Ses hésitations, ses commentaires et le
récit de ce que son client lui a dit ne deviennent aucune ligne.

**Aucun prix n'est inventé pour autant, et c'est délibéré** : il n'en a annoncé
aucun, les trois lignes arrivent donc à chiffrer, signalées en rouge. Une ligne
bien rédigée est plus crédible qu'une ligne bancale — raison de plus pour que
les gardes sur le prix ne bougent pas.

**Les mesures traversent jusqu'au document**, unité comprise : « vingt mètres
linéaires » devient 20 ml, la graphie que le moteur de prix reconnaît. Une unité
sans quantité est refusée (« 1 ml » serait un chiffre que personne n'a dit), une
quantité recopiée dans l'unité aussi (« 20 × 20 mètres » aurait doublé sa haie).
Le stère et l'arbre, eux, restent écrits tels qu'il les dit.

**Ce qui n'a pas pu être vérifié ici, et qui l'est ailleurs.** La rédaction
dépend d'un modèle de langage : cet environnement n'a aucune clé, la CI non
plus. `npm run verifier:dictee` envoie sa dictée entière au vrai modèle et
vérifie les trois lignes, la mesure et l'absence de prix — **il refuse de rendre
un vert sans clé** plutôt que de laisser croire à un contrôle qui n'a pas eu
lieu. Il reste à le jouer depuis son espace. La règle de rédaction, elle, est
éprouvée ici et sait rougir : ses propres phrases recopiées doivent être
refusées (`src/lib/redaction-lignes.ts`).
### La flèche de la fiche client ramène d'où l'on vient

**Sa remarque, capture à l'appui :** *« Quand j'appuie sur retour, ça ne me fait
pas un retour, mais deux retours. Je reviens directement à la page vos
chantiers. Or, je devrais rester dans la catégorie mes clients. »*

Il avait raison, et c'était écrit en toutes lettres : la fiche renvoyait
toujours à l'accueil (`href: "/"`), quel que soit l'écran d'où l'on venait.
Depuis la liste des clients, un seul appui sautait donc **deux** écrans.

**Un lien fixe se serait trompé de toute façon**, parce que la fiche s'ouvre
depuis DEUX endroits : la liste des clients, et le tiroir d'un chantier. Renvoyer
toujours vers les clients ferait sortir du chantier celui qui y était. L'origine
voyage donc dans l'adresse, et `src/lib/retour-fiche-client.ts` la traduit — une
seule fois, hors de tout écran.

**Cette valeur vient de l'adresse, donc de n'importe qui.** Sans filtre,
`?de=https://ailleurs.example` ferait de la flèche « retour » une porte de sortie
vers un site étranger. Seule la forme d'un chemin de chantier est acceptée ; tout
le reste retombe sur la liste des clients, sans erreur ni écran vide.

Éprouvé dans les deux sens : en remettant `href: "/"`, les deux suites rougissent
— celle sans navigateur sur « c'est exactement le double saut qu'il a signalé »,
celle au navigateur sur les trois chemins.

### La mesure du débit revient, et l'IA sait lire une image

**Ses deux décisions du 20 août au soir :** *« Remets la mesure du débit, mais
minimaliste, sans mots qui servent à rien, comme on vient de faire. Et pour la
lecture du croquis, tu peux le faire — il y a déjà l'IA dans l'application,
Anthropic et OpenAI. »*

**Le débit, en trois cases.** Litres, secondes, bar — sous le déroulant du
piquage —, puis le résultat. Les deux paragraphes d'explication qui
l'entouraient ne reviennent pas. L'écran passe de 21 à 26 mots ; le plafond du
contrôle passe de 22 à 28.

**LA CORRECTION QUI COMPTE : j'avais dit à tort qu'Atlas ne savait pas lire une
image.** `src/server/ai/services/lire-ticket.ts` fait **déjà** lire un ticket de
caisse photographié — consigne système, image envoyée au fournisseur, réponse
JSON, fonction pure qui la relit et refuse ce qu'elle ne comprend pas, éprouvée
sans clé. Lire un croquis est le même patron.

Ce n'était donc pas un mur mais une pièce à écrire, et la réponse inverse aurait
enterré une fonctionnalité faisable. D'où **`CLAUDE.md` §5 ter** : avant de dire
« l'application ne sait pas faire ça », chercher qui, dans le dépôt, fait déjà
quelque chose d'approchant. Un `grep` de trente secondes sur `image` l'aurait
donné.

**Deux contrôles ont changé de sens, et c'est normal.** Celui qui exigeait
l'aveu « Atlas ne sait pas lire » visait désormais le mensonge : il vérifie à
présent que la page dit seulement que **son** plan est un exemple dessiné.
Celui qui interdisait tout champ avant le plan en accepte trois — ceux du seau —
et rougit au quatrième (`CLAUDE.md` §5 bis). **Un contrôle neuf s'y ajoute** :
le débit affiché doit tomber juste, 10 L en 20 s font 1,80 m³/h — un écran qui
montre une mesure et un résultat qui ne se suivent pas apprend à douter de tous
ses chiffres.

### Diagnostic végétal — le troisième outil de Paysage, et sa base commence vide

**Sa demande du 20 août 2026 :** *« un professionnel prend en photo une feuille,
une branche, une écorce, un champignon, un arbre ou un arbuste présentant une
anomalie, puis obtient automatiquement un diagnostic probable et une conduite à
tenir »*, avec un parcours en quatre gestes : ouvrir, photographier, attendre,
lire.

**Migration `0056_diagnostic_vegetal.sql`** — douze tables, en deux mondes qui
ne se mélangent jamais : la base phytosanitaire (commune, `GRANT SELECT` seul,
sans RLS, comme `catalogue_prestations`) et les diagnostics (isolés par RLS,
comme tout le reste).

**Le principe qui commande tout : le modèle OBSERVE, la base DÉCIDE.** Un modèle
à qui l'on demande de nommer une maladie en nommera toujours une. On ne lui
demande donc jamais de nommer quoi que ce soit : il décrit ce qu'il voit dans un
**vocabulaire fermé** (14 parties, 25 motifs, 10 couleurs, 12 localisations),
et c'est du code déterministe qui confronte cette description aux fiches.
**Tout texte affiché sort d'une colonne de `fiches_phyto`** — une maladie, une
gravité ou un traitement inventés sont impossibles par construction, pas par
consigne écrite dans un prompt.

**Ce que ça évite, concrètement :** un artisan qui taille un arbre d'après une
recommandation qu'aucune source n'a écrite.

**La base est VIDE, et c'est voulu.** Sa règle : *« ne remplis pas
artificiellement la base avec de fausses données »*. Le module répond alors
« la base ne contient encore aucune fiche validée » — ce qui est vrai. Les
seules données livrées sont quatre fixtures d'essai (`donnees/phyto/fixtures/`),
qui ne décrivent aucun végétal réel et que **trois barrières** empêchent
d'atteindre une production : l'import les refuse si `NODE_ENV=production`, la
lecture les filtre sur `origine = 'reelle'`, et une contrainte CHECK lie
l'origine au préfixe `zz-test-` **dans les deux sens**.

**Les quatre issues d'une analyse, et les trois dernières comptent autant que la
première :** un résultat ; **une seule** demande de photo complémentaire, dont
la consigne est recopiée mot pour mot de `confusions_phyto` (jamais improvisée) ;
« je ne peux pas confirmer » ; ou « personne n'a regardé » quand aucun
fournisseur n'est branché — deux refus distincts, parce qu'ils ne se réparent
pas au même endroit.

**La confiance tient en TROIS MOTS, jamais un pourcentage** — aucun modèle
employé ici ne fournit de probabilité calibrée. Trois plafonds l'abaissent
d'office : photo floue, fiche qui se déclare seulement « indicative », essence
non reconnue. Sans eux, la confiance affichée mentirait exactement dans les cas
où elle compte le plus.

**Une fiche `diagnostic_photo: impossible` n'est JAMAIS rendue**, même seule en
tête avec un score parfait : c'est ce qui empêche d'affirmer sur photo ce qu'une
photo ne montre pas. Et dès que `impact_mecanique` n'est pas « aucun » — *y
compris quand il vaut « inconnu »** —, le résultat porte la phrase qui dit
qu'une photo ne juge pas la solidité d'un arbre.

**Les métadonnées EXIF sont retirées avant tout** (`src/lib/exif.ts`, JPEG/PNG/
WebP, sans réencodage) : une photo de jardin porte les coordonnées GPS du
domicile du client. Un fichier qu'on n'a pas su nettoyer est **refusé**, jamais
rangé — la colonne `exif_retire` affirmerait sinon quelque chose de faux.

**La conservation des photos est CONFIGURABLE**, jamais gravée : 90 jours pour
une photo libre, aucune échéance pour une photo versée au dossier d'un chantier
(`PHOTOS_DIAGNOSTIC_RETENTION_JOURS`). Le rattachement à un chantier **recalcule**
l'échéance — sans quoi la pièce d'un dossier en cours disparaîtrait au bout de
trois mois sans que personne l'ait demandé.

**Le classement sémantique n'existe pas encore ; son verrou, si.** Sa demande :
ne pas empêcher l'ajout ultérieur d'un classement sémantique ou visuel, mais
*« le modèle ne devra jamais pouvoir créer une maladie absente de la base »*.
`appliquerClassement` n'accepte d'un classeur que des fiches déjà présentes,
reprend la fiche d'ORIGINE (pas celle qu'il rend, dont le contenu pourrait être
falsifié), refuse les doublons et borne le score. Éprouvé contre un classeur
volontairement malveillant.

**Ce qui n'est PAS vérifié, et doit s'écrire :** l'appel réel au fournisseur de
vision. Aucune clé d'IA dans cet environnement — comme pour la lecture des
tickets. Il devra l'être sur le banc, avec de vraies photos.


### L'arrosage en deux gestes — dessiné, pas codé

**Sa demande du 20 août 2026**, capture d'`arrosage.html` à l'appui : *« on va
simplifier cette page également. Garde le piquage se fait… avec le bandeau
déroulant. Ensuite : le croquis et ses métrés, avec la possibilité de mettre la
photo. Je veux rien d'autre. Ensuite […] tu fais apparaître un plan avec les
différents réseaux et le détail des pièces. »*

**`appli/arrosage-simple.html`** — sans script ni photo. **Rien n'est codé**
(`CLAUDE.md` §3 bis) : `appli/arrosage.html` n'a pas été touchée.

**La page passait de huit questions à deux.** Partent : le seau, le temps de
remplissage, la pression, le débit affiché en cours de route, la règle de
recouvrement, la marque des arroseurs, le corps d'arroseur, la saisie des zones
une par une, la sonde de pluie, et les boutons copier / envoyer / imprimer.
Restent le piquage et le croquis.

**Ce que la page DIT plutôt que de faire semblant : Atlas ne sait pas lire un
croquis.** Reconnaître un contour tracé au crayon et retrouver « 12 m » écrit en
travers demande une IA qui regarde une image ; le raccordement est écrit
(`ARCHITECTURE.md` §26) mais aucun contrat n'est signé. Le plan montré après la
photo est donc **dessiné**, et un écran de la maquette l'explique — avec ce que
la lecture devra rendre le jour venu : les surfaces, les longueurs, et où est le
point d'eau. Le reste est du calcul, et le calcul est déjà écrit.

**Ce que le retrait coûte, et il est réel :** le débit mesuré au seau décidait
du nombre d'arroseurs par réseau. Sans mesure, il faut le supposer d'après le
piquage — et ce sera parfois faux. Deux façons de vivre avec sont posées dans la
maquette, **et il tranche**.

**Le contrôle recalcule le plan** (`scripts/verifier-maquette-arrosage-simple.mjs`,
dans `npm run verifier:maquette`) : les arroseurs dessinés doivent être ceux du
détail — **et par couleur**, sinon deux réseaux faux se compensent ; une
électrovanne par réseau ; le programmateur assez de voies ; aucun réseau
au-dessus du débit disponible ; et **la somme des réseaux au-dessus** de ce
débit, sans quoi un seul aurait suffi et le découpage ne servirait à rien. Il
refuse aussi tout champ de saisie remis avant le plan. Éprouvé rouge sur cinq
états dégradés.

**Deux défauts trouvés à l'image, aucun par un test :** « amenée 18 m » passait
sous le cadre du compteur, et les massifs portaient leur mesure au-dessus de
leur nom quand la haie faisait l'inverse.

**Elle n'est PAS dans `essais.html`**, à sa demande — *« arrête de me le mettre
dans Atlas app essai »*. Elle se donne par son adresse directe, et figure
nommément dans la liste vérifiée après déploiement : une adresse transmise sans
preuve qu'elle répond n'est pas une adresse.

### L'écran d'arrosage dépouillé une seconde fois : vingt et un mots

**Sa consigne du 20 août au soir**, après avoir vu la première version : *« le
titre plan d'arrosage, et en dessous le piquage se fait avec le bandeau
déroulant — tout ce qu'il y a entre les deux, tu me le supprimes. Ensuite le
croquis et ses métrés avec la possibilité de mettre la photo, et tout le reste
tu me le supprimes. Tous les autres mots, tu me les supprimes. Et je ne veux pas
qu'il y ait marqué un et deux sur les deux machins. »*

Sont partis : le surtitre, la phrase d'introduction, les numéros « 1 · » et
« 2 · », le titre « D'où part l'eau » (le libellé du déroulant le dit déjà), les
deux paragraphes d'aide et les deux encarts du bas. **Il reste un titre, un
déroulant, un bouton — vingt et un mots.**

**Ce que les encarts portaient n'est pas perdu** : les deux écrans qu'ils
ouvraient restent atteignables depuis le plan. Sans aucune porte, ils seraient
devenus des écrans morts — la faute des huit planches introuvables.

**LE CONTRÔLE QUI MANQUAIT DEPUIS QUATRE PLAINTES.** `HANDOVER.md` le réclamait
en toutes lettres : *« ce qui manque, c'est un contrôle qui compte les mots de
chaque écran et rougit quand un écran en gagne ; sans lui, l'application
regrossira, parce que chaque décision juste ajoute une ligne et que personne
n'en retire jamais »*. Il existe désormais pour cet écran : **plafond 22 mots**,
et aucun titre numéroté.

**Il compte ce qu'il LIT, pas ce que le document contient** : la première
version additionnait les trois options du déroulant, dont deux sont invisibles
tant qu'il ne l'ouvre pas, et accusait l'écran de porter 33 mots quand il n'en
montre que 21.

### Les pièces de la maquette d'arrosage venaient de nulle part

**Sa question, et elle valait mieux qu'une réponse rassurante :** *« les pièces
que tu as utilisées pour l'exemple sont choisies au hasard ? »*

**Oui, en partie.** « Turbines, portée 5 m · 0,30 m³/h » ne correspondait à
aucune référence ; « colliers de prise en charge », « filtre à tamis » et
« clapet anti-retour » n'existent nulle part. Les longueurs de tuyau — 28 m,
34 m, 18 m — étaient écrites de mémoire.

**Ce que le dépôt avait déjà, et que la maquette ignorait :**
`appli/arrosage-catalogue.js`, où chaque entrée porte sa **source** — relevée de
ses photos (`patron`, « Aqua Plus 2026, p. 11 ») ou `provisoire` —, et
`appli/arrosage-calcul.js`, qui choisit les buses, l'écart, le recouvrement et
la répartition en secteurs.

**Le calcul a donc été joué pour de bon** (Playwright sur `arrosage.html`, le
jardin de l'exemple saisi dans ses champs), et la maquette porte désormais ce
qu'il rend : 6 turbines *3504 · buse 0,75* à 0,96 m³/h, un arroseur tous les
5,33 m, recouvrement 98 % — **avec son avertissement** « la buse est un peu
grande ici : l'écart tombe sous la portée », que la maquette taisait. Les
électrovannes *100 DV 1" MM 9V*, la *Clarinette taraudée 1"*, le *Programmateur
BL-IP 4 stations*, les *Coudes SBE 050 et 075* remplacent les pièces inventées.
Et les longueurs de tuyau affichent **« à mesurer »**, comme le calcul le fait.

**Deux incohérences trouvées à la capture, aucune par un test :** la page
expliquait un total de 2,46 m³/h quand la somme des réseaux en fait 2,70 ; et le
plan portait « amenée 18 m » quand la liste répondait « à mesurer » pour cette
même amenée.

**Trois gardes neuves**, chacune éprouvée rouge : chaque libellé doit être **à
l'identique** un nom du catalogue, le total écrit doit être la somme des
réseaux, et le plan ne doit pas chiffrer ce que la liste dit ignorer. **La
première version de la garde du catalogue ne prouvait rien** — elle acceptait une
inclusion, et « Turbine portée 5 m » passait grâce à l'entrée générique
« Turbine ». Trouvé en la confrontant à l'invention qu'elle devait bannir.

La règle est écrite dans `CLAUDE.md` §4 bis.

### La fiche client refondue, et un TROISIÈME document en PDF

**Ses trois décisions du 20 août 2026 :** *« Tu peux rajouter une colonne
facture et ranger les factures dans le même ordre. Sous format PDF, et donc
faire en sorte que les fiches chantiers soient au format PDF maintenant. […] On
va modifier la vraie application. »*

**LE PDF DE FICHE DE CHANTIER — `src/server/pdf/fiche-chantier-pdf.ts`.**
Atlas ne fabriquait que deux documents : le devis et la facture. Ce qu'il
appelait « fiche chantier » était un ÉCRAN. La fiche dit ce qui a été fait, avec
quoi, et ce qu'on a observé — **jamais un prix**. C'est ce qui la rend
transmissible : on peut la donner à un locataire, à un syndic, à l'assurance
d'un voisin, sans divulguer ce que le propriétaire a payé.

**Une option dans le moteur commun, et non un troisième moteur** (`CLAUDE.md`
§3). `sansChiffrage` retire le tableau de prix, les totaux, la TVA, l'IBAN ; les
trois pièces gardent la même feuille, parce qu'elles sortent du même artisan.
`blocsTexte` s'y ajoute pour le matériel et les photos — le premier réflexe
avait été de les entasser dans le `rappel` de l'en-tête, qui s'écrit d'un seul
trait : les trois lignes se seraient imprimées bout à bout.

**Ce qui garde le devis et la facture : une EMPREINTE de leur trace**, relevée
avant la première ligne de `sansChiffrage` — chaque texte, sa position au
centième de point, sa taille, sa couleur, sa page. Éprouvée rouge en décalant le
moteur d'un seul point. Sans elle, un `if` mal placé aurait décalé un total sans
que personne le voie avant l'impression.

**Un point corrigé AVANT d'écrire une ligne :** la maquette annonçait
« 8 h 30 → 16 h 00 · 2 personnes ». **Ces horaires n'existent nulle part** — la
base retient le créneau (matin / après-midi), le nombre de demi-journées et
l'équipe. Le document aurait promis ce qu'il ne pouvait pas remplir.

**L'ÉCRAN — `src/app/clients/[id]/page.tsx`.** La dernière prestation en titre
noir gras avec ce qu'elle comprend, puis trois colonnes de PDF — Devis, Fiche
chantier, Facture —, chacune du plus récent au plus ancien. Le nom et les
informations sous le nom restent ; **les trois cases, « Ce qu'on lui fait et
combien de fois », « Ses chantiers » et la phrase sur les factures sont
parties**.

**Une seule règle de tri pour les trois colonnes**
(`src/lib/documents-du-client.ts`). Il a dit « le même ordre » : trois tris
écrits séparément auraient fini par diverger, et c'est lui qui aurait vu une
colonne remonter le temps. Une pièce sans date passe en dernier — jamais en
premier, ce qui la ferait passer pour la plus récente.

**Ce que les colonnes ne montrent pas, et pourquoi :** les devis en brouillon
(le client ne les a jamais reçus, leur version peut encore changer), les
factures non émises, et les fiches des chantiers non terminés (elles
imprimeraient une feuille vide).

**Ce que le retrait coûte, et qu'il a accepté :** on n'ouvre plus un chantier
depuis un client — on ouvre sa fiche en PDF. Un document se lit, un écran se
modifie. Le reste dû se regarde dans Terminés → En attente de paiement.

**Deux défauts d'écran trouvés par la suite navigateur, invisibles à la
lecture :**

- **Deux devis portaient le même numéro.** Le numéro commercial est *stable à
  travers les versions* : un devis révisé puis renvoyé produisait deux lignes
  « n° 2026-0003 », à la même date, indistinguables — il aurait fallu ouvrir les
  deux pour savoir laquelle on tenait. **Seule la dernière version envoyée est
  montrée** ; les révisions restent en base et sur l'écran du chantier.
- **Un chantier ouvert le matin même passait pour la dernière prestation.** Il
  se lisait sur « les chantiers dont la date est passée » — or un chantier créé
  le jour même, sans devis ni date posée, porte la date du jour. L'écran
  annonçait un travail qui n'avait pas eu lieu. Elle se lit désormais sur les
  chantiers **terminés**, ce qui l'aligne sur la colonne « Fiche chantier ».
- **Le nom du chantier se coupait à 97 px.** « Rénovation de la salle de bain »
  devenait « Rénovation de… » et n'apprenait rien. Sous un devis et une facture,
  c'est désormais **la date**, qui tient en entier — et c'est par elle qu'il
  cherche.

**Trois pièges de montage, chacun payé une fois, chacun consigné :**

| Ce qui échouait | Ce que ça a appris |
|---|---|
| Le serveur entier ne démarrait plus | La route était sous `[id]`, le dossier voisin emploie `[chantierId]`. Next.js refuse — et cinq écrans échouaient au préchauffage, la suite accusant un bouton trois écrans plus loin |
| Les dates ne se décalaient pas | Un `UPDATE` par `pool` ne touche **aucune ligne** sous RLS, et ne dit rien. Le tri paraissait « remonter le temps » entre deux dates identiques |
| Le décalage était refusé | Un devis envoyé est **immuable** (`trg_devis_immuable`). La date se pose sur le brouillon — `envoyerDevis` la garde, c'est donc le chemin réel |

**La maquette essayable** (`appli/fiche-client.html`) porte les trois colonnes,
et le contrôle mesure ce qui casse vraiment à 390 px : la colonne la plus
étroite, et tout libellé qui dépasse sa boîte. **Un commentaire faux y a été
corrigé contre la mesure** — il affirmait que rien ne tenait à 107 px de
colonne ; rien n'y était coupé.

### Une barre de recherche sur la liste des clients

**Sa demande, capture à l'appui :** *« Il faut une barre de recherche où je peux
taper le nom d'un client pour le retrouver plus facilement »* — vingt et un
noms à l'écran, dont **quatre Martins**, et le sien perdu au milieu. Elle avait
été dessinée le 17 août (`appli/clients-recherche.html`, proposition B).

La règle vit dans `src/lib/recherche-client.ts`, hors de tout écran : sans
accents, sans casse, sans ponctuation, et chaque mot cherché n'importe où dans
le nom. Il tape « moreau » et trouve « Moréau » ; « renard » et trouve
« Mme Renard » ; « dupont » et trouve « M. Dupont » comme « Mr. Dupont ».
L'ordre des mots ne compte pas.

**Le filtrage se fait dans le navigateur**, sur la liste déjà chargée : un
aller-retour réseau par lettre tapée, en 5G au bord d'un chantier, se sentirait.

**Ce que la capture a montré et qu'aucune suite n'aurait vu :** `type="search"`
fait poser au navigateur sa propre croix d'effacement, **d'un bleu vif** — la
seule tache de couleur de l'écran, sur une page de crème et de bronze. Elle est
remplacée par la nôtre, dans la couleur de l'application, présente seulement
quand il y a quelque chose à effacer. Une suite tient désormais les deux.

**Le champ est toujours affiché**, même avec trois clients : une barre qui
apparaît au-delà d'un certain nombre est une règle de plus à deviner, et le
jour où il en a quatre il la croirait retirée.

### La fiche client, allégée — dessinée, pas codée

**Sa demande, capture de l'écran « Martins » à l'appui :** *« En dessous de
l'adresse, en titre noir gras, dernière prestation avec ce qu'elle comprend.
Ensuite : pas trois encadrés, seulement deux. Un contenant devis, et l'autre
fiche chantier… en deux colonnes… trié par date, de la plus récente à la moins
récente. On garde le nom et les informations sous le nom. Tout le reste, tu
enlèves. C'est du trop. »*

**`appli/fiche-client.html`** — essayable, sans script ni photo, atteignable
depuis `appli/essais.html`. **Rien n'est codé** : `CLAUDE.md` §3 bis, une
demande d'apparence se dessine avant de se coder.

**Ce que la maquette DIT plutôt que de le dessiner en silence : le PDF « fiche
chantier » n'existe pas.** Vérifié dans le dépôt — Atlas ne fabrique que deux
documents en PDF, le devis (`src/server/pdf/devis-pdf.ts`) et la facture
(`facture-pdf.ts`). Ce que le code appelle « fiche chantier » est un **écran** ;
la « fiche d'entretien » est un **modèle de prestations** dans les réglages. La
deuxième colonne serait donc vide aujourd'hui. Un écran de la maquette montre ce
que ce document contiendrait — dessiner un document inexistant comme s'il était
là est la faute que la planche 56 a commise deux fois.

**Et deux questions posées plutôt que tranchées à sa place :** où vont les
**factures**, qui n'ont plus d'encadré (trois réponses proposées, dont une qui
ne casse pas sa règle des deux encadrés) ; et le fait que « Ses chantiers »
était le seul **chemin** d'un client vers un chantier.

**Le contrôle** (`scripts/verifier-maquette-fiche-client-allegee.mjs`, dans
`npm run verifier:maquette`) relit les dates **telles qu'elles s'affichent, en
français**, et refuse une colonne qui remonte le temps — c'est le cœur de sa
demande, dite deux fois. Il refuse aussi un troisième encadré, une colonne qui
retombe sous l'autre à 390 px, un titre qui ne serait ni noir ni gras, le retour
d'une des quatre choses retirées, la disparition de l'aveu sur la fiche
chantier, et **tout lien qui ne mène nulle part** — sa colère du 18 août :
*« quand je fais pour cliquer, je ne peux pas cliquer »*. Éprouvé rouge sur sept
états dégradés.

**Quatre défauts trouvés à l'œil, aucun par un test vert** (`CLAUDE.md` §5) : le
retour « Vos clients » pointait sur l'écran qu'on regardait — il mène désormais
à `clients-recherche.html#liste`, qui existe ; une case cochée ne se distinguait
d'une case vide que par sa couleur ; une conclusion collée à sa liste ; un
espace de trop.

### Le veilleur ne renonce plus : la version rapide se retente jusqu'à passer

**Sa plainte, à 6 h 40 :** *« l'application est lente corrige ça »*. Sa fiche le
disait déjà : la construction avait échoué à 6 h 10 sur « Another next build
process is already running », et le banc servait le mode développement — celui
qui compile chaque écran à l'ouverture.

Le mécanisme de relance existait (§131) mais **s'arrêtait après trois
tentatives**, soit une demi-heure. Passé ce délai, plus rien ne retentait, et la
fiche l'écrivait : *« il est LENT, et le restera »*. Le seul remède était qu'il
rallume son espace — pour une panne qu'il ne pouvait pas voir.

**Ce qui change :** après la salve rapide (trois fois, à dix minutes), le
veilleur continue **indéfiniment, une tentative par demi-heure**. C'est le
rythme qui est borné, plus le nombre. Jamais deux constructions à la fois, et
jamais avant le délai — ces deux garde-fous n'ont pas bougé.

**Ce que ça évite :** une journée entière sur la version lente parce que la
fenêtre où la machine pouvait bâtir est arrivée trente-cinq minutes trop tard.

**Et la fiche a cessé de mentir.** « Il restera lent » était vrai tant que le
veilleur renonçait ; le laisser enverrait rallumer un espace en train de se
réparer tout seul. Elle dit maintenant le rythme des tentatives.

**Ce qui n'est PAS réglé :** pourquoi deux constructions se marchaient dessus à
6 h 10. La mémoire était encore ample à cet instant — ce n'est donc pas la
saturation du 17 août, et la cause n'a pas été reproduite ici. Ouvert dans
`TODO.md`.

---

## 2026-08-18

### Son logo était partout, sauf sur l'écran qu'il regarde

**Sa remarque, capture à l'appui :** *« j'ai rajouté un logo en haut à gauche
mais il n'est pas visible »*. Le logo n'était pas perdu — il partait sur le PDF
et s'affichait dans l'aperçu de « Devis & factures ». Il manquait au seul
endroit où l'artisan passe son temps : **l'écran où il rédige son devis**.

**La cause, et elle vaut d'être retenue :** cet écran compose son en-tête à la
main, sans passer par la fabrique de documents. Deux écritures du même en-tête,
et c'est la seconde qui a vieilli le jour où le logo est arrivé.

Le logo se pose donc avec **les mêmes règles que le PDF** : au-dessus du nom,
hauteur fixe, largeur libre — un logo en bandeau et un logo carré n'ont rien à
voir, et une boîte carrée écraserait le premier.

**Le contrôle refuse de croire une balise.** Il pose le logo comme lui le pose,
ouvre un devis, et vérifie que l'image est **chargée** (`naturalWidth > 0`), pas
seulement présente : une mauvaise adresse rend une balise, et c'est lui qui
verrait le carré vide. Puis qu'elle est au-dessus du nom, et pas écrasée. Vu
rouge avant d'être livré. `ARCHITECTURE.md` §173.

---

## 2026-08-19

### La légende ne promet plus un compte qu'elle ne tient pas

**Sa question du 21 août :** *« le "1 équipe sur 2" bouge en fonction du nombre
d'équipes ? 3, 4, 10, 100 ? »*

**Non, et c'était un défaut** : le mot était écrit en dur dans la page. Mais le
corriger en « 1 équipe sur 5 » n'aurait rien réglé — le carré vert clair ne dit
pas « une seule équipe est prise », il dit **qu'il en reste au moins une de
libre**, que six soient occupées sur dix ou une sur deux.

Le mot juste ne dépend donc d'aucun nombre : **« il reste de la place »**. Le
compte exact, lui, se lit là où il est vrai — dans la fiche du jour, « 4 sur 5 ».
La suite vérifie aux trois réglages (2, 5, 10 équipes) qu'**aucun « sur N »
n'apparaît dans la légende**.

### Bordeaux pour le dépassement, et un carré qui tombait cinq pixels trop bas

**Ses trois corrections du 21 août, la maquette étant retenue :** le bordeaux
pour « au-delà », le carré « incomplet » qui n'était pas au niveau des autres, et
le nom d'un chantier qu'on ajoute qui doit s'aligner sur ceux déjà posés.

**Le carré désaligné venait d'une collision de noms.** `.place` désignait à la
fois l'état « il reste de la place » dans la légende ET les lignes de chantier
de la fiche du jour — lesquelles portent `margin-top:10px`. Le carré héritait de
la marge et tombait cinq pixels plus bas. L'état s'appelle désormais `dispo` :
**deux sens pour un même mot finissent toujours par se croiser**, et c'est lui
qui l'a vu, sur son téléphone.

**Le nom du chantier qu'on ajoute prend la forme d'une ligne de chantier** :
même serif, même bord gauche, les trois moments à la place de la pastille
d'équipe. Écrit en petit gris à côté des boutons, il se lisait comme une
étiquette ; là, il se lit comme le chantier qu'il va devenir. La suite mesure le
bord et le corps plutôt que de juger l'apparence.

**Et la pastille de la fiche du jour lit maintenant la MÊME règle que le
calendrier** (`etatDe`) : elle avait gardé son calcul à elle, hérité de la
version d'avant, et deux calculs pour la même chose finissent par ne plus dire
la même chose.

### Le dépassement passe en bleu ardoise, et la légende retrouve son « rien »

**Sa correction du 21 août :** *« la couleur dorée pour le dépassement, je ne
suis pas très fan. Rajoute un petit carré blanc pour lorsqu'il n'y a rien, le
vert clair c'est incomplet, le vert foncé c'est complet, et trouve-moi une autre
couleur pour au-delà. Et pour matin et après-midi, reprends exactement les mêmes
rectangles que sous les chiffres du mois — même taille, même largeur. »*

**Ni or, ni rouge.** L'or sert partout ailleurs à ce qu'on LIT (les liens, les
mentions) : employé ici, il ne signalait plus rien. Le rouge dit « erreur », et
dépasser est un choix qu'il assume. Le **bleu ardoise** est la seule teinte
froide de l'écran — elle se remarque sans crier.

**La légende dit maintenant les quatre états** : rien · incomplet · complet ·
au-delà, puis la position. Cinq termes sur une ligne, ce qui a demandé de
resserrer le corps et l'écart — mesuré à 390 et 375 px, replié en dessous.

**Et les rectangles de matin / après-midi SONT ceux du calendrier** : la légende
réemploie la classe `.marqueA` telle quelle. Une copie « à la bonne dimension »
aurait divergé au premier réglage ; la suite mesure les deux et exige qu'ils
soient identiques.

**Un défaut trouvé en le faisant** : une règle de la toute première légende
traînait encore et forçait 13 × 13 px à tous ses carrés — les rectangles repris
du calendrier redevenaient des carrés. Et `align-items:center`, hérité d'une
règle voisine, les rétrécissait à zéro. Deux fois la même leçon : ce qui est
mesuré ne se devine pas.

### Un seul bouton d'ajout, sous la journée — et « toute la journée » retiré

**Sa demande du 21 août au soir, la maquette étant par ailleurs retenue :**
*« Le "+ Ajouter un chantier", tu le mets en dessous, un rond avec un plus ; je
ne veux pas qu'il soit affilié à la case matin ou après-midi, ça surcharge et on
ne comprend plus trop. Et "toute la journée" sous les noms, tu me le
supprimes. »*

**Deux boutons disaient la même chose deux fois**, et posaient la question du
moment avant même qu'on ait choisi le client. Un seul rond, sous les deux
demi-journées, et le moment se choisit **après** : d'abord QUI, ensuite QUAND —
c'est le client qu'il a en tête, pas la demi-journée. Se tromper de client
n'oblige plus à revenir en arrière.

**« Toute la journée » disparaît** : le chantier apparaît déjà sous les deux
demi-journées, la mention ne faisait que le répéter.

### Le quota qui prévient sans interdire — sa proposition, et elle est meilleure

**Sa proposition du 21 août au soir**, après avoir vu les trois façons de dire
la charge :

> *« Une fois qu'on a mis deux chantiers avec deux gars, on dit que c'est
> complet. Et s'il en rajoute un troisième, on met une autre couleur pour lui
> signaler qu'il a dépassé le quota — mais il peut quand même le faire. Nous, on
> prévient juste. Au cas où il aurait fait une erreur, ou s'il se dit : ces
> chantiers ne dureront pas vraiment la journée, donc ça passe. »*

**Elle est meilleure que les trois miennes, et voici pourquoi.** « Complet »
donnait un repère mais refusait ; « aucune limite » n'interdisait plus rien mais
ne disait plus rien non plus. Sa règle garde le repère — une équipe, un
chantier, une demi-journée — et le transforme en **avertissement**. Le
dépassement se voit ; il ne se refuse pas. C'est lui qui sait qu'une taille de
haie prend une heure.

**Quatre états**, et le dernier est un signal, pas une faute :

| | Ce que ça veut dire |
|---|---|
| vide | personne |
| vert clair | il reste de la place |
| vert foncé | chaque équipe a son chantier |
| **or** | **au-delà** — plus de chantiers que d'équipes |

**L'or, jamais le rouge.** Le rouge de l'application dit « erreur »
(`colors.alert`) : l'employer ici ferait passer un choix délibéré pour un défaut.

**Le pourcentage ne s'écrit que s'il dépasse** — « 3 chantiers · 150 % de vos
équipes ». À 100 % il n'apprendrait rien de plus que « complet » ; en dessous, il
ferait lire un calcul là où il suffit de compter.

**Et sa première question du même message est réglée par là :** *« pourquoi
quand je clique sur le 21 je n'ai pas le même visuel que sur le 19 ? »* — parce
que « complet » supprimait le « + Ajouter ». Tous les jours proposent maintenant
les mêmes gestes ; la suite le vérifie sur un jour complet ET sur un jour
au-delà.

**Les trois façons de dire la charge (points, équipes, chiffres) sont
retirées** : il a tranché mieux qu'elles, et garder un dessin que plus rien
n'emploie, c'est laisser une seconde façon de dire la même chose.

### Plus de plafond, donc plus de « complet » — trois façons de dire la charge

**Sa décision du 21 août 2026, et elle défait la règle de la veille :**

> *« L'utilisateur ne doit pas avoir de limite d'ajout de chantier, matin ou
> après-midi, parce que c'est lui qui sait le temps qu'il va passer. On peut
> être deux dans la boîte et enchaîner quatre ou cinq chantiers dans la journée,
> surtout en entretien — des chantiers où les gars restent une heure. Donc pas
> de limite, ni de chantiers ni de gars. Par contre le code couleur libre/plein
> ne fonctionne plus, il faudrait le repenser. »*

**Ce que cela emporte.** « Complet » n'existait que parce qu'un jour avait un
maximum : deux équipes, deux places. Sans plafond, le mot ment — et surtout il
**interdisait d'ajouter** là où il n'y avait rien à interdire. Il a disparu de
l'écran, et la suite vérifie qu'il n'y revient pas.

**Ce qui le remplace : des faits, plus un verdict.** La fiche du jour dit
« 3 chantiers · 2 équipes · 1 sans équipe ». Et le mois se lit de trois façons,
à comparer dans la planche :

| | Ce que la case montre | Ce qu'on y lit d'un coup |
|---|---|---|
| **Points** | un point par chantier, matin dessus, après-midi dessous ; creux = personne dessus | la charge du jour, sans jamais plafonner (au-delà de quatre : « +3 ») |
| **Équipes** | une case par équipe, remplie quand elle est dehors | « me reste-t-il quelqu'un de libre ? » — le nombre de chantiers n'y entre pas |
| **Chiffres** | le nombre de chantiers, matin puis après-midi | le plus dense, et muet sur les équipes |

**La légende est écrite par le script, plus figée dans la page.** Chaque façon a
ses mots — et un mot figé finit par mentir, comme « 1 équipe sur 2 » l'a fait la
veille. La suite vérifie les trois : qu'elles tiennent sur une ligne, qu'elles
disent où sont le matin et l'après-midi, et qu'aucune ne promet un « complet »
qui n'existe plus.

### Un « ＋ » sur la pastille, et la journée entière depuis la liste

**Deux demandes du 21 août.**

**1. « Il ne se dira pas qu'il peut cliquer dessus pour ajouter un autre gars. »**
La pastille qui affiche « Paul » ne disait rien de ce qu'elle sait faire. Elle
porte maintenant un **« ＋ » discret**, collé au nom : huit pixels, et le geste
devient visible. Une phrase aurait pris une ligne, et il en a fait retirer trois
la veille.

**2. « Il faut que les deux s'affichent. »** Toucher un chantier dans la liste
des planifiés n'ouvrait que sa feuille. Il ouvre désormais **la journée entière
au-dessus** — matin, après-midi, « + Ajouter un chantier » — puis la feuille en
dessous. C'est la même carte que sous le calendrier : elle est **écrite une fois
et branchée deux fois**, sinon les deux endroits auraient fini par proposer des
gestes différents.

**Ce que ce partage a coûté**, et qui vaut d'être noté : la carte connaissait le
jour par une variable globale (`jourTouche`). Rendue ailleurs, elle aurait posé
les chantiers sur le mauvais jour. Elle reçoit donc sa date en argument, et le
rafraîchissement des compteurs lit la date **sur la carte elle-même**.

### Le matin et l'après-midi ne partagent plus leurs équipes

**Sa remarque du 21 août :** *« sur Mr. Leroy, qui dure toute la journée, je ne
peux pas mettre juste Paul le matin et Julien et Paul l'après-midi — si je mets
les deux l'après-midi, ça me les met aussi le matin. Il faut que tout soit
indépendant. »*

Un chantier portait **une** liste d'équipes ; il en porte maintenant **deux**,
matin et après-midi, qui ne se parlent pas. C'est la réalité du métier : on
démarre à deux et l'on renforce l'après-midi.

**Conséquence sur la liste des planifiés :** la pastille d'un chantier y montre
toujours toutes ses équipes, mais **elle ouvre la journée** au lieu d'un choix.
Une pastille unique ne saurait pas laquelle des deux moitiés modifier — et
choisir pour lui serait exactement le défaut qu'il vient de signaler.

**Le contrôle correspondant met le matin à Paul seul et l'après-midi à Julien et
Paul**, puis vérifie que le matin n'a pas bougé — et que le calendrier peint bien
deux moitiés différentes.

### Un chantier peut mobiliser PLUSIEURS équipes — même toutes

**Sa demande du 21 août :** *« lorsque je choisis une équipe, je dois pouvoir
mettre toutes les équipes si je le souhaite, le même jour ou même sur la même
demi-journée. Je dois pouvoir mettre tout le monde le matin, puis tout le monde
l'aprem. »*

**Cela change le compte, pas seulement la pastille.** Une demi-journée ne compte
plus des CHANTIERS mais des **équipes occupées** : sur un terrain où trois
équipes travaillent, « 1 place prise sur 5 » aurait été l'inverse de la vérité.
Un chantier posé sans équipe réserve quand même une place — il faudra bien
quelqu'un — et elle reste hachurée.

**On coche, et la liste reste ouverte.** Fermer à chaque choix obligerait à
rouvrir pour la seconde équipe, et l'on ne verrait jamais l'effet de la
première. Le calendrier se repeint derrière à chaque coche ; « Terminé » referme.

**Deux défauts trouvés en l'éprouvant, tous deux invisibles à la relecture :**

- la liste se réécrivait entièrement à chaque coche : deux appuis rapprochés, et
  le second tombait sur un bouton qui n'existait plus. Elle se construit
  maintenant une fois, puis se coche sur place ;
- **le compteur de la demi-journée retardait d'un geste** — trois équipes
  cochées, et l'en-tête disait encore « 2 sur 5 ». Vu sur capture. Il se met à
  jour avec le reste, sans que la fiche soit refaite (ce qui refermerait la
  liste sous le doigt).

**Et la liste prend toute la largeur de la ligne** : coincée entre le nom et les
boutons, elle empilait ses noms en colonne et poussait la ligne sur cinq
hauteurs — vu sur capture, à cinq équipes.

### La journée se lit par demi-journées, chacune avec ses chantiers

**Sa remarque du 21 août :** *« le 21, quand je clique le matin je peux
attribuer une équipe, et quand je clique sur l'après-midi je ne peux rien
attribuer — je dois cliquer sur journée pour attribuer l'aprem »*.

**Le défaut était de structure, pas d'affichage.** La fiche du jour montrait deux
lignes d'état — Matin, Après-midi — puis, DESSOUS, une liste unique de
chantiers ; et l'équipe s'attachait au chantier. Il regardait « Après-midi » et
n'y trouvait rien à toucher.

Chaque demi-journée porte donc maintenant **ses propres lignes**, avec leur
pastille d'équipe, leur « Déplacer » et leur « Retirer ». **Un chantier à la
journée apparaît sous les deux, et le dit** (« toute la journée ») : le cacher
d'un côté ferait croire que l'après-midi est libre.

**« Déplacer » ouvre une liste, comme l'équipe** — Matin, Après-midi, Journée.
Aucune rotation qui déciderait à sa place : c'est la même règle qu'il a posée
pour les équipes, et elle vaut partout.

**Ce que la suite éprouve désormais**, et qu'elle ne pouvait pas voir avant :
que les deux demi-journées portent chacune leurs chantiers ET leurs pastilles,
et qu'**on attribue une équipe depuis l'après-midi sans passer par « journée »**.

### « Plein » ne veut pas dire « attribué » — la hachure le dit enfin

**Sa question du 21 août, et elle valait mieux qu'une réponse :** *« j'ai
l'impression qu'il y a quelque chose qui n'est pas clair entre le code couleur
qui fait que les jours sont pleins, parce qu'en fait les jours peuvent être
pleins mais les équipes pas choisies. J'ai l'impression d'être un peu perdu. »*

**Il n'était pas perdu : le dessin confondait deux choses.** Une barre remplie
disait « cette demi-journée est prise », et rien d'autre — elle peignait pareil
un chantier confié à Julien et un chantier posé sans personne dessus. Or ce sont
deux états très différents : le premier est réglé, le second attend une décision.

**Une barre est désormais faite de PLACES, une par équipe.** Chaque chantier posé
en prend une — la journée est prise, qu'on ait nommé l'équipe ou non, et c'est
juste. Mais une place **sans équipe est hachurée** : elle dit « reste à décider
qui y va ». Le 21 août de la planche, complet et sans équipes, se distingue
maintenant du 26, complet et attribué.

### On CHOISIT son équipe : un appui n'en pose plus une d'office

**Sa remarque, dans le même message :** *« quand je clique sur équipe, ça me met
d'office une équipe, je n'ai pas choisi, ce n'est pas normal — je dois pouvoir
choisir, et modifier »*.

La version d'avant faisait **tourner** les noms à chaque appui. Sur deux équipes
c'était discutable ; sur dix, il fallait neuf appuis pour atteindre la dernière,
et l'on posait une équipe non voulue à chaque passage. La pastille ouvre donc la
**liste des équipes**, avec **« Retirer l'équipe »** quand il y en a une :
changer d'avis coûte le même geste que choisir. La liste est la même dans la
fiche du jour et dans les planifiés — deux listes séparées auraient fini par
proposer des choix différents.

**Le contrôle qui vaut ici** ne compare pas deux libellés : il vérifie dans le
CALENDRIER qu'après l'ouverture de la liste, **rien n'a été attribué** — la
place est encore hachurée. L'ancien contrôle serait resté vert sur le défaut
même qu'il signalait.

### Ajouter quelqu'un là où il regarde, et alléger la feuille

**Sa remarque du 21 août :** *« je clique sur le 19, j'ai le matin de pris,
l'après-midi libre, et je ne peux pas rajouter quelqu'un dessus — ce n'est pas
normal »*.

Il avait raison, et le défaut était de conception : poser un chantier ne se
faisait que depuis « Sans date », **tout en bas de l'écran**. Or il regarde la
demi-journée, et c'est là qu'il veut ajouter. Chaque demi-journée qui a de la
place porte donc un **+ Ajouter** ; il ouvre sur place la liste de ceux qui
attendent un jour. Une demi-journée COMPLÈTE n'en propose aucun — le bouton
serait un mensonge.

**Et la feuille perd ce qu'il n'a pas demandé** : *« ce qu'il y a sous le nom,
l'adresse et la date, tu peux supprimer. Tu me laisses Waze, Maps, copier,
appeler »*. L'adresse et le numéro **servent toujours** aux quatre gestes — ils
sont lus sans être écrits. Le bouton dit maintenant ce qu'il fait : « Ouvrir le
PDF sans les prix », ce qui rend la ligne « Aucun prix sur cette feuille »
inutile.

### La légende reprise à la lettre, et le nom cliquable là où il cliquait

**Deux corrections qu'il a fallu redemander, et c'est un échec de lecture de ma
part.**

**1. La légende.** Sa demande, mot pour mot : *« remets comme c'était avant — un
carré blanc pour libre, un carré vert clair pour une équipe sur deux, le carré
foncé pour complet. Et les rectangles FINS que tu as utilisés pour ton code
couleur, mets-en deux l'un au-dessus de l'autre et marque matin et après-midi.
Pourquoi tu m'as mis deux rectangles épais ? Et je veux tout sur la même
ligne. »*

Donc : **trois carrés** (leurs mots d'origine, « complet » compris), puis **les
barres fines du calendrier elles-mêmes**, l'une sur l'autre, annotées — et
**tout sur une seule ligne**, mesuré à 390 px. La suite vérifie les trois
choses : que les états sont carrés, que les deux dernières marques sont fines
(larges au moins deux fois et demie comme elles sont hautes), et que les quatre
termes partagent le même haut. Une légende qui se replierait passerait sinon
inaperçue.

**2. « Je ne peux toujours pas cliquer sur le nom du client. »** Le geste avait
été ajouté — mais dans la fiche du jour, alors qu'il cliquait dans la **liste des
planifiés**. Les deux ouvrent maintenant la feuille.

**Et elle s'ouvre SOUS la ligne touchée.** Première version : elle s'affichait au
bas de la liste — on appuyait sur « Mme Rocher » et la feuille apparaissait après
« Monsieur Martins », trois lignes plus bas. Vu sur capture, jamais par un test ;
la suite mesure désormais l'écart entre la ligne et la feuille.

### Deux corrections : le nom ouvre la feuille, et la légende était fausse

**Ses deux remarques du 21 août, et les deux étaient justes.**

**1. « Je ne peux pas l'ouvrir en cliquant sur le nom du client. »** La feuille
ne s'ouvrait que par le lien « Sa feuille › » posé à côté. Or c'est le NOM qu'on
touche, parce que c'est lui qu'on cherche. Le nom est maintenant le bouton ; le
lien reste, pour qui ne devine pas qu'un nom se touche. La suite vise désormais
le nom — viser le lien aurait rendu un vert sur le défaut même qu'il signalait.

**2. La légende ne disait pas ce qu'il avait demandé.** Sa correction, mot pour
mot : *« il fallait laisser un rectangle blanc pour libre, un vert clair pour
une équipe sur deux, un foncé pour les deux équipes prises ; et ensuite rajouter
deux rectangles l'un sur l'autre — pas deux carrés — avec écrit le matin et
l'après-midi »*. La version d'avant mettait **deux barres partout** et
finissait sur **deux carrés** : l'inverse, terme à terme.

La suite compte donc les rectangles de chaque terme, et **mesure que les deux
derniers sont larges au moins deux fois comme ils sont hauts** — sans quoi
« rectangle » et « carré » se confondent dans un contrôle qui se lit vert.

### Le planning se MANIPULE : poser, changer d'équipe, déplacer, retirer

**Sa consigne du 21 août 2026, et elle vaut jusqu'à nouvel ordre :**

> *« Attends, ne code rien. Je veux qu'on finisse toute la page ensemble en
> maquette dynamique, pour que je puisse essayer : cliquer, modifier, changer,
> voir ce que ça donne. Une fois que tout est validé, je te dirai "c'est bon, tu
> peux coder". En attendant, tu ne me fais que des maquettes dynamiques. »*

Elle est écrite **en tête de `TODO.md`** — pas au milieu : une consigne qui vit à
la deux-centième ligne n'est pas lue, et c'est exactement ce que le dépôt existe
pour éviter.

**Ce que la planche sait faire depuis, et qu'elle ne faisait pas :**

| Geste | Ce qu'il fait vraiment |
|---|---|
| poser un « sans date » | matin, après-midi ou journée, sur le jour touché — et il quitte la liste d'attente |
| toucher l'équipe | elle tourne : Équipe ? → Julien → Paul → Équipe ? |
| toucher la demi-journée | matin → après-midi → journée, et **le calendrier se repeint** |
| retirer du planning | le chantier **redescend dans « Sans date »**, il n'est pas effacé — sinon il serait à ressaisir |

**Le jour se choisit dans le calendrier avant de poser**, comme dans
l'application : un second calendrier dans une feuille serait un deuxième endroit
où dire la même chose. Tant qu'aucun jour n'est touché, la liste le dit au lieu
de rester inerte.

**Deux pièges de contrôle payés en l'éprouvant :**

- la permission du presse-papier se donne **avant** d'ouvrir la page ; accordée
  après, elle ne vaut pas pour l'origine déjà chargée, et le contrôle rougissait
  sur un geste qui marche ;
- le mot « Adresse copiée » n'apparaît qu'**après** l'écriture, qui est
  asynchrone. Lu dans la foulée du clic, il rendait encore « Copier l'adresse ».

### Reprendre les gestes de « Y aller » sur la feuille de chantier

**Sa demande du 21 août :** *« reprends l'adresse cliquable qui ouvre Maps ou
Waze — pas besoin d'en mettre trois —, la possibilité d'appeler le client et de
copier l'adresse. Le reste, on n'en aura pas besoin. »*

Ces gestes existent déjà dans l'application (`FeuilleYAller`,
`src/lib/itineraire.ts`) : la planche **recopie leurs adresses exactes**, jamais
des liens inventés qui ouvriraient sur rien. Deux destinations au lieu de trois —
« Plans » disparaît, Maps et Waze restent.

**La suite éprouve les ADRESSES des liens, pas leurs libellés** : un bouton
nommé « Waze » qui pointe ailleurs se lit juste et ne mène nulle part. Elle
vérifie aussi que « Copier l'adresse » copie pour de bon — et le dit, sans quoi
on appuie deux fois sans savoir si la première a pris.

### La feuille de chantier : le devis, sans un seul prix

**Sa demande du 21 août 2026 :** *« il faut pouvoir rajouter le devis en PDF,
non modifiable, pour que le salarié qui a accès au planning clique sur le jour,
voie à quel client il est affilié, et clique sur le devis pour connaître ses
tâches. Mais le salarié ne doit pas avoir accès au prix. »* Puis sa propre
réponse : *« je pense que le plus simple, ça serait de mettre le devis en PDF
sans les prix »*.

**C'est le bon choix, et la raison n'est pas la simplicité.** Une fiche
« prestations » saisie à côté serait une SECONDE liste de ce qui est à faire :
le devis change — une ligne ajoutée au téléphone, une quantité corrigée — et les
deux divergent en silence. L'équipe partirait alors avec la version d'avant, et
personne ne s'en apercevrait avant le chantier. C'est la règle du dépôt
(`CLAUDE.md` §3, *jamais de règle dupliquée*) appliquée à un document.

La planche montre donc une **feuille de chantier qui n'est pas un document** :
c'est le devis lui-même, rendu sans ses colonnes de prix. Rien à tenir à jour,
rien qui puisse mentir. Elle s'ouvre depuis le jour du planning, chantier par
chantier, et la suite vérifie qu'**aucun caractère `€` n'y figure**.

**Deux points restent ouverts, et ils décident du code** (voir `TODO.md`) : les
libellés de devis qui portent un prix dans leur texte (« forfait 350 € »), et le
fait qu'un compte `membre` voit aujourd'hui la même chose que le propriétaire —
cacher les prix sur cette feuille ne servirait à rien s'il peut ouvrir le devis
par une autre porte.

### La légende suit la suite logique, et annote la dernière marque

**Sa demande, dans le même message :** *« à côté du carré vert foncé complet,
mets les deux rectangles et marque en face du haut "matin", du bas "après-midi".
Comme ça, ça suit la suite logique — blanc c'est libre, vert c'est une équipe
sur deux, foncé c'est les deux équipes — et on explique les deux carrés
superposés plutôt que de rajouter une phrase. »*

La légende se lit maintenant de gauche à droite comme la chose se remplit :
**libre → 1 équipe sur 2 → complet**, puis une quatrième marque **annotée** qui
dit où est le matin et où est l'après-midi. Aucune phrase.

**Un réglage mesuré, pas supposé :** la marque annotée est plus grande que les
trois autres (12 px par barre au lieu de 5). À la hauteur d'une barre de
calendrier, « matin » et « après-midi » se touchaient — la suite vérifie qu'il
reste au moins dix pixels entre les deux mots.

### « Et s'il y a dix équipes ? » — la barre se remplit au lieu de qualifier

**Sa question du 21 août 2026**, posée devant la planche : *« comment tu vas
faire s'il y a dix équipes ? »*. Elle casse le dessin d'avant, et pas seulement
son texte.

**Ce qui ne tenait pas.** Trois états — libre, il reste de la place, complet —
disent tout avec deux équipes. Avec dix, « il reste de la place » couvre une
équipe prise comme neuf : **la même nuance pour une journée presque vide et une
journée presque pleine**. On aurait posé un chantier sur un jour saturé en
croyant y avoir de la place.

**VALIDÉ par lui le jour même :** *« je suis d'accord avec ta méthode pour les
dix équipes, la barre elle se remplit petit à petit, je valide »*.

**Ce qui remplace.** Chaque barre se **remplit à la part occupée** — deux prises
sur dix, c'est un cinquième de barre. « Complet » reste un aplat foncé, et c'est
délibéré : le seul état qui interdit de poser ne doit pas se déduire d'une
nuance. La planche porte un réglage **2 · 5 · 10 équipes** pour qu'il le voie au
lieu qu'on le lui explique.

**Et la fiche du jour compte les noms plutôt que les équipes** : au-delà de
trois, elle écrit « Julien, Paul +8 ». Dix noms sur une ligne de téléphone ne se
lisent pas.

### La légende montre la position au lieu de l'écrire

**Sa demande, dans le même message :** *« la barre du haut c'est le matin, la
barre du bas l'après-midi — enlève cette phrase, mais qu'on le comprenne tout de
suite »*.

La légende porte donc **la marque elle-même** : un dessin rempli en haut à côté
du mot « matin », un rempli en bas à côté d'« après-midi », un plein à côté de
« complet ». Trois mots, aucune phrase — et la position s'apprend en regardant,
pas en lisant. « Touchez un jour pour savoir qui y est » disparaît aussi : on
touche un jour parce qu'on veut savoir, pas parce qu'on l'a lu.

### Retirer du planning tout ce qui répète ce qu'on sait déjà

**Ses quatre coupes du 21 août**, et le motif est le même à chaque fois : *« tu
mets beaucoup de phrases qui ne servent à rien »*.

| Retiré | Ce qu'il en dit |
|---|---|
| « 2 équipes sur 2 » | il a deux équipes, il les connaît par leur nom — reste « Complet · Julien, Paul » |
| « Cette semaine » sous « 24 – 30 août » | *« on sait très bien que c'est une semaine, on n'est pas idiot à ce point-là »* |
| « Le mois » sous « août 2026 » | même chose |
| « ½ journée » après « matin » ou « après-midi » | le mot d'à côté le dit déjà |

**Ce que ces mots coûtaient**, et qui ne se voit qu'une fois retirés : un mot qui
répète son voisin se lit quand même — et pendant qu'on le lit, on cherche ce
qu'il ajoute. Sur un écran qu'il parcourt entre deux chantiers, c'est le genre de
frottement qui fait dire « c'est trop compliqué ».

### Le planning : c'est A, et deux manques qu'il a vus avant nous

**Sa réponse du 21 août :** *« pour le planning du mois je veux le A »* — les
deux barres sous le chiffre, matin dessus, après-midi dessous. Le rond et la
barre unique sont retirés de la planche : garder un dessin que plus rien
n'emploie, c'est laisser deux façons de dire la même chose.

**Et deux manques, qu'il a trouvés en s'en servant :**

- *« Comment vous faites si l'après-midi j'ai mes deux équipes sur le coup ? »*
  La question n'avait aucune réponse visible : **aucune journée des données ne
  montrait ce cas**. « 1 équipe sur 2 » et « complet » ne se distinguent qu'une
  fois vus côte à côte. Le mercredi 26 est ajouté — matin libre, après-midi
  complet —, et la légende compte au lieu de qualifier : « 1 équipe sur 2 »,
  « complet · 2 sur 2 » ;
- *« Il y a marqué le client, si c'est la journée ou la demi-journée, mais pas
  l'équipe qui est affiliée. »* La fiche du jour porte désormais l'équipe, comme
  la liste du bas — le même chantier ne peut pas dire deux choses selon l'endroit
  où on le lit. Elle dit aussi le compte, demi-journée par demi-journée : « matin
  libre », « après-midi : 2 équipes sur 2 — complet ». Le calendrier signale, la
  fiche tranche.

**Un défaut vu sur la capture, et par aucun test :** la phrase de la légende se
redécoupait en colonnes — « Touchez un / jour / pour savoir qui y / est. » — parce
que `.legende span{display:flex}` l'attrapait aussi. Cinquième fois dans ce dépôt
qu'un défaut sort d'une image.

### Un mois qu'on lit sans l'apprendre

**Sa demande, le 21 août :** *« tout en faisant un mois facile à comprendre »*.
Quatre changements dans la planche, et aucun n'est décoratif :

- **les jours des autres mois disparaissent.** Ils ne portent rien, et six
  cases de chiffres gris se lisent quand même — du bruit payé à chaque coup
  d'œil. Le prix, assumé : le 3 septembre ne s'atteint plus depuis la grille
  d'août, il faut la flèche ;
- **les cases sont carrées et espacées** : le doigt vise ses 44 px, et l'œil
  sépare les semaines sans un seul trait ;
- **le week-end est une colonne teintée**, pas un chiffre pâle. Une teinte se
  voit du coin de l'œil ; un gris clair oblige à lire pour comprendre ;
- **aujourd'hui porte un cercle d'or**, et un retour « ← Aujourd'hui »
  apparaît **dès qu'on s'en éloigne** — sans lui on se perd à trois mois ;
  toujours présent, il se lirait comme une action à faire.

**Deux pièges payés en l'éprouvant**, tous deux du genre qui rend un contrôle
vert sur un écran faux :

- `[hidden]` ne cachait rien. `.retour-aujourdhui{display:block}` l'emporte sur
  la règle du navigateur : le bouton restait à l'écran en prétendant être caché.
  Il faut écrire `.retour-aujourdhui[hidden]{display:none}` ;
- le contrôle qui vérifiait l'absence des jours voisins cherchait un « 27 »
  dans la grille d'août — or le 27 août existe. Il accusait une page juste. Il
  compte désormais les cases vides, et vérifie qu'elles le sont.

### Le planning : le mois reste, la semaine ne sert qu'aux planifiés

**Sa correction, le 21 août :** *« je veux un accès au mois ; ce dont je te
parlais pour la semaine, c'était pour les chantiers planifiés »*. La planche de
la veille avait remplacé le mois par une semaine — c'était trop.

`appli/planning-simple.html` est refaite : **le calendrier reste au mois**, avec
ses flèches de mois, et seule la liste du bas se déplace par semaine. Les deux
ne se concurrencent pas — **toucher un jour du mois amène la liste sur sa
semaine** : on vise en haut, on lit en bas. Sans ce lien, l'écran porterait deux
navigations qui s'ignorent, et ce serait la page incompréhensible qu'il vient de
signaler.

Ce qui reste à trancher : **A, B ou C**, trois façons de marquer les
demi-journées sur une case de mois. `src/app/planning/` n'a toujours pas bougé.

### Dessiner le planning en semaines avant d'y toucher

**Sa demande :** *« cette page est beaucoup trop compliquée à comprendre pour
les utilisateurs […] fais-moi une maquette de ça, dynamique, en .html, avant de
me coder quoi que ce soit, que je puisse essayer »*.

`appli/planning-simple.html` **s'essaie pour de bon** : les flèches changent de
semaine, les trois calendriers se comparent sur place, et tout se calcule sur
les mêmes chantiers que la liste — un dessin figé aurait pu mentir sur le point
même qu'il veut juger. `src/app/planning/` n'a pas bougé (`CLAUDE.md` §3 bis).

**Ce que la maquette a fait apparaître, et qui n'était pas dans sa demande :**
le calendrier actuel montre le MOIS, et c'est lui qui sert à poser une date
lointaine. Passer à la semaine coûte huit appuis pour aller à deux mois — la
question est posée dans `TODO.md`, pas tranchée ici.

**Le contrôle joue les gestes** (`scripts/verifier-maquette-planning-simple.mjs`,
dans `verifier:maquette`) : il change de semaine, compare ce que le calendrier
peint à ce que les données disent — le vendredi 21 porte deux chantiers à la
journée, donc ses deux demi-journées sont complètes —, et refuse de conclure sur
une case de zéro pixel.

**Un piège payé en l'écrivant :** le titre du jour est écrit « vendredi 21 août »
dans la page, mais la feuille de style le met en capitales. `innerText` rend ce
que l'ŒIL voit, pas ce que le HTML porte — le contrôle rougissait sur une page
juste. Il lit désormais en insensible à la casse.

### Le compte des chantiers ne se dit plus qu'une fois, et en chiffre

**Sa demande, capture à l'appui :** *« la mention en cours qui se trouve sous
Vos chantiers, supprime-la. Le "Un" qui est à droite, en lettres, je le
supprime. Et le "en cours" au-dessus de la date, à côté je veux le chiffre du
nombre de chantiers en cours, en gras. »*

**Ce que ça corrigeait :** le même nombre était écrit **trois fois** sur le même
écran — « Un en cours » sous le titre, « En cours » à gauche de la rubrique,
« Un » à sa droite. Deux fois en lettres, à deux endroits, pour une seule
information.

Il reste **« EN COURS 4 »** : le mot, puis le chiffre collé à lui. Le chiffre
est le seul élément en gras de la ligne — c'est lui qu'on vient lire.

**Le mot passe au gris du second plan** : `inkSoft` au lieu de `muted`. Trois
gris lui ont été montrés (`appli/en-cours-le-chiffre.html`), **il a pris le
C** — le plus foncé des trois. Jamais une couleur écrite en clair : elle aurait
été juste sur « Origine » et fausse sur les deux chartes sombres, et `inkSoft`
se dérive pour les sept.

**Le repère `data-atlas="compteur"` a suivi le compte** sur la rubrique. Le
laisser sur la ligne supprimée aurait rendu `test-dashboard` muet — et cette
suite lit le nombre en ATTRIBUT depuis le 10 août précisément pour survivre aux
refontes de libellé. Elle vérifie désormais aussi que le nombre **se lit en
chiffre à l'écran** : l'attribut seul resterait vert sur un retour aux lettres.

### Atlas dépouillé, utilisable, pour la plainte « trop de mots »

**Sa plainte, la troisième :** *« il y a beaucoup trop de mots dans tous les
sens […] s'ils passent quinze minutes à essayer de comprendre comment elle
marche, ils ne vont juste pas l'utiliser »*. Le 11 et le 17 août, la même chose
avait été dite et un écran avait été corrigé au jugé ; la gêne est revenue
ailleurs à chaque fois.

`appli/moins-de-mots.html` n'est pas une planche : c'est **l'application
dépouillée, dont on se sert**. La barre du bas fonctionne, « Créer un devis »
ouvre la fiche client, les champs se remplissent au clavier, le devis s'envoie,
« Mes prix » s'ouvre. Un bouton « Avant » remet l'écran d'aujourd'hui sur les
trois écrans qui changent. Boutons radio et `:checked` : pas une ligne de
JavaScript, donc ouvrable depuis son téléphone, hors ligne.

**Ce que ça évite :** lui demander de juger une application sur une capture. On
ne sait pas si un écran est plus simple en le regardant — on le sait en s'en
servant.

**Rien dans `src/`** — `CLAUDE.md` §3 bis : il choisit avant qu'on code.

### Deux versions refusées avant celle-là, et ce qu'elles apprennent

**« Je t'ai dit de rien coder, seulement une maquette dynamique. »** La première
arrivait entourée de deux scripts — un qui mesurait l'application, un qui
recomptait ses nombres. Utiles, hors de `src/`, et **hors sujet** : une demande
de maquette n'autorise pas l'outillage qui va avec. Retirés.

**« Une maquette dynamique QUE JE PUISSE UTILISER. »** La deuxième était une
planche avant/après à regarder — des écrans côte à côte, des comptes de mots,
des flèches. **Une maquette, dans ce dépôt, est un bout d'application qui
marche**, pas une présentation de ce qu'elle serait. Les autres essayables de
`appli/` l'étaient déjà ; il aurait fallu s'en inspirer dès le départ.

### Une maquette qu'il doit ouvrir vit dans `appli/`, pas dans `docs/maquettes/`

**Trouvé en essayant de lui transmettre la planche.** `pages.yml` ne publie
**que** le dossier `appli/` : une planche déposée dans `docs/maquettes/` n'a
aucune adresse, et il ne peut pas l'ouvrir depuis son téléphone. On attendrait
alors un choix qu'il n'a pas les moyens de faire — et l'on conclurait qu'il ne
répond pas.

La planche est donc dans `appli/`, liée depuis `appli/essais.html` — l'adresse
qu'on lui donne —, et son nom est entré dans la liste que `pages.yml` interroge
sur le site publié. Le chemin a été parcouru en entier, du lien à la planche, à
la taille de son téléphone. La règle est écrite dans `CLAUDE.md` §3 bis.

**À vérifier avant de conclure quoi que ce soit :** la planche 81, posée le
17 août et toujours sans réponse, est restée dans `docs/maquettes/`. Son silence
n'est peut-être pas un refus.

### Trois pièges de mesure, trouvés en la fabriquant

- **une feuille qui monte ne retire pas l'écran de dessous du document.**
  `body.innerText` additionnait les deux : la fiche client paraissait peser
  190 mots, dont 151 étaient l'accueil derrière elle. Faux dans le sens qui
  arrange ;
- **un script qui crée une donnée fausse ses propres mesures.** Trois passages
  ont fait passer l'accueil de 135 à 167 mots sans qu'une ligne de produit ait
  bougé, parce que `db:seed` ne retire pas les chantiers créés par le parcours.
  Le script refuse désormais de mesurer sur un jeu de démonstration usagé ;
- **le refus de la limitation de débit à la connexion est muet côté
  navigateur.** La suite expire sur l'attente de redirection et accuse la page ;
  la ligne qui tranche n'est que dans le journal du serveur.

---

## 2026-08-16

### L'écran de création s'appelle « Fiche client »

**Sa demande, capture à l'appui :** *« Enlève nouveau un chantier et remplace par
fiche client. »*

**Ce qui change :** « NOUVEAU · Un chantier » devient **« Fiche client »**, à la
création comme à la reprise. Le surtitre disparaît avec le mot qu'il portait :
il disait « Nouveau », et « Les coordonnées » en reprise **uniquement** parce que
« nouveau » aurait été faux au-dessus d'un chantier ouvert trois jours plus tôt.
Le titre ne disant plus « nouveau », ce contre-mot n'a plus rien à contrer.

**Ce que ça évite :** un écran qui annonce une création alors qu'on vient
corriger une fiche existante. Le nom dit maintenant ce que l'écran EST, pas ce
qu'on y fait.

**Vu à l'écran, pas dans le code :** le micro de la dictée était aligné par le
haut et se posait au-dessus d'un titre devenu seul sur sa ligne. Recentré — les
deux centres tombent sur le même pixel. `ARCHITECTURE.md` §124.

---

## 2026-08-18

### Le bouton de l'accueil dit « Créer un devis »

**Sa demande :** *« change nouveau chantier par crée un devis »*, sur l'écran
d'accueil. Une maquette lui a été montrée avant de toucher au code (§3 bis).

Seul le bouton change — son mot et son `aria-label`. Même geste, même rond, même
feuille au-dessus.

**Ce qu'on a failli casser, et pourquoi on ne l'a pas fait.** Il avait d'abord
demandé de renommer aussi l'écran qui s'ouvre. Or une autre session venait de le
titrer « Fiche client » (sa propre demande du 16 août, vraie à la création comme
à la reprise). Confronté au conflit, il a tranché : **l'écran reste « Fiche
client »**. On ne garde donc que le bouton — et c'est le rebasage qui a fait
remonter la collision plutôt que de l'écraser en silence (`CLAUDE.md` §6).

### Deux boutons à la place de la bascule, sur l'écran de création

**Sa demande, puis sa réponse devant la planche :** *« supprime "je dicterai"
et "je l'écris", remplace par un bouton cliquable "je dicte mon devis" et un
autre "j'écris mon devis" »*, puis *« la 5, mais sans les flèches »*.

L'écran de création porte désormais **deux capsules vertes empilées, à
égalité** — « Je dicte mon devis », « J'écris mon devis ». La bascule et le
bouton dont le libellé la suivait sont retirés : chaque bouton porte sa
destination, et le geste passe de deux temps à un seul.

**Ce que ça évite** : deux gestes pour qui savait déjà qu'il écrirait son devis
lui-même — toucher un onglet, puis un bouton dont le mot venait de changer sous
ses yeux.

**Deux conséquences assumées :**

- **« Créer le chantier » disparaît de l'écran.** C'était le seul endroit qui
  annonçait la création ; les deux boutons créent le chantier avant d'aller où
  ils disent, sans quoi le devis serait orphelin (`creerPuisAller`). La ligne
  qui l'aurait redit lui a été proposée, il ne l'a pas retenue ;
- **en reprise, un seul bouton « Enregistrer »**, comme avant : cet écran sert
  alors à corriger des coordonnées, pas à faire un devis.

**« Entrée » mène à la dictée**, et non plus au dernier choix : il n'y a plus
de choix à suivre, et tomber dans le devis à la main sans l'avoir demandé est
le plus coûteux des deux défauts.

**Les suites visent des repères, pas des mots.** Soixante-treize d'entre elles
créaient leur chantier d'essai en cliquant « Créer le chantier » ; elles visent
maintenant `[data-atlas="action-dicter"]`. Un libellé ne survit pas au
changement suivant — celui-ci vient d'en faire la démonstration.

### Dessiner les deux boutons du devis avant de retirer la bascule

**Sa demande :** *« supprime "je dicterai" et "je l'écris", remplace par un
bouton cliquable "je dicte mon devis" et un autre "j'écris mon devis", en
gardant le chemin »*.

**Rien n'est codé, et c'est la règle** (`CLAUDE.md` §3 bis) : une demande
d'apparence se dessine, se montre, et ne touche à `src/` qu'une fois choisie.
`appli/deux-boutons-devis.html` pose cinq façons de le faire,
sur un écran de 390 px, sans une ligne de JavaScript.

**Ce que le dessin a fait apparaître, et que la demande ne pouvait pas dire.**
Deux choses, toutes deux dans `TODO.md` :

- **« Créer le chantier » disparaît de l'écran.** C'est le libellé actuel du
  bouton, et le seul endroit qui annonce que le chantier se crée. Deux boutons
  nommés d'après le devis l'effacent en silence.
- **Côte à côte, ça ne rentre pas.** Mesuré plutôt qu'estimé
  (`scripts/mesurer-maquette-deux-boutons.mjs`, joué dans `verifier:maquette`) :
  à 390 px chaque moitié fait 166 px, « Je dicte mon devis → » en demande 156 de
  texte et casse sur deux lignes, quand « J'écris mon devis → » tient à 1,5 px
  près. Les capsules montent alors à 73 px et redeviennent les pavés qu'il avait
  fait retirer le 11 août.

Le contrôle **refuse de conclure sur une boîte de zéro pixel** plutôt que de
rendre un vert : c'est la leçon du 15 août 2026, où `0 − 0 = 0` avait certifié
« rien n'est coupé » sur un écran où trois noms l'étaient.


### « Il peut proposer une autre date » : un interrupteur avant l'envoi

**Sa demande :** *« pour le lien du planning qui part au client, il faut que
l'utilisateur puisse choisir avant d'envoyer s'il autorise ou non le client à
choisir une date si celles proposées ne lui conviennent pas »*.

**Jusqu'ici, le client le pouvait TOUJOURS** — la page publique offrait un
calendrier sous les dates, sans que le patron ait rien à dire. Sur un chantier
serré, une contre-proposition à six mois ne l'arrange pas, et son seul recours
était de n'envoyer aucune date.

L'interrupteur se pose **sous les dates, juste avant le bouton d'envoi**, et la
phrase récapitulative le suit : « Le client choisira entre ces deux dates, et
rien d'autre ». **Ouvert par défaut** — un défaut fermé changerait sans un mot
ce qu'il croit envoyer, et ce que les liens déjà partis promettent.

**Le choix est FIGÉ dans l'envoi** (migration 0055), jamais relu dans un
réglage : l'écran du client doit dire demain ce qu'il disait aujourd'hui, comme
les dates proposées et la fenêtre (migration 0027).

**Et la règle ne vit pas à l'écran.** Cette page est publique, son formulaire se
rejoue : le serveur refuse toute date hors des propositions quand l'envoi ne
l'autorise pas, et le message dit au client quoi faire — choisir une date, ou
demander une correction — au lieu de l'accuser. Le contrôle poste la
contre-proposition **sans passer par l'écran** ; c'est le seul qui prouve que la
porte est fermée. Vu rouge avant d'être livré : refus retiré, ce cas-là tombe.

Le parcours entier est éprouvé au navigateur (`test-envoi-client-e2e.ts`) :
l'interrupteur, l'envoi, puis **la page telle que le client la reçoit**, ouverte
sans compte. `ARCHITECTURE.md` §132.

---

## 2026-08-18

### La fiche de chantier se remplit, et le rapport part chez le client

**Sa décision du 17 août : « Fait la C ».** La fiche s'ouvre nue depuis
« Paysage », se coche au doigt, et une ligne discrète — « c'est pour quel
client ? » — se touche à tout moment. Dès qu'un client est nommé, la fiche se
replie sur ses prestations **sans perdre une seule coche**.

**Ce que ça évite :** deux de ses décisions se contredisaient en apparence — le
pré-remplissage par client (16 août) et l'outil qui s'ouvre sans client (17). Le
repli à la demande les fait tenir ensemble. Sans lui, il fallait sacrifier l'une
des deux : soit un outil qui exige un client en visite, soit vingt lignes à
retrier au douzième passage chez le même.

**Deux versions du repli ont été refusées par leur propre contrôle**, avant
d'atteindre le patron. Regarder les lignes *présentes* du dernier passage ne
replie jamais rien ; regarder les lignes *cochées* du seul dernier passage fait
disparaître une taille de haie d'automne dès le passage de mars. Le repli lit
donc **tout l'historique envoyé** du client. `ARCHITECTURE.md` §128.

**Le rapport parti ne change plus jamais.** Les lignes sont copiées, pas lues
dans le modèle ; le nom du client aussi. Retirer une prestation des réglages en
octobre ne réécrit pas le rapport de juillet — c'est ce qui en fait une preuve
de passage, à la place des signatures qu'il a écartées le 16 août (il n'est pas
là quand on tond).

**Le client reçoit ce qui a été FAIT, et rien d'autre** — le tri est en base, pas
à l'affichage : une page qui filtrerait à l'écran laisserait les dix-sept autres
lignes dans le HTML. La page `/entretien/[jeton]` rejoint le devis et la facture
dans les chemins publics **et** les pages du client, sans quoi son client verrait
les onglets de son outil de travail au bas du rapport.

**Le temps se pose à la molette du téléphone** (sa décision : « la A »), par pas
de cinq minutes. Le message part de SA messagerie, comme le devis.

**Éprouvé du premier geste au dernier**, page du client comprise, dans un
contexte sans session : `test-passage-entretien.ts` (19 cas) et
`test-fiche-chantier-e2e.ts` (10 cas, captures en passant).

**Deux gardes ont attrapé ce lot, et une troisième était déjà tombée :**

- la garde des pages publiques a refusé `/entretien` tant qu'il n'était pas
  réellement ouvert par un visiteur sans compte — elle voulait la page, pas la
  déclaration. Le rapport envoyé par la suite de la fiche lui sert désormais de
  matière, comme le devis et la facture le font pour elle depuis toujours ;
- la garde du préchauffage a réclamé les nouveaux écrans avant qu'ils ne
  manquent chez lui ;
- **`test-fiche-client-e2e` comptait quatre onglets et la barre en porte cinq
  depuis « Paysage »** : ce contrôle était rouge sur `main` avant ce lot. Une
  autre session l'a corrigé le même jour, et mieux — elle compare la barre aux
  onglets décidés au lieu d'attendre un nombre. Sa version a été gardée à la
  fusion, la mienne écartée.

### La fiche de chantier rejoint Paysage — et le pont vers le client

**Sa décision du 17 août**, contre ma recommandation : *« la fiche chantier, la
ranger comme étant un outil dans la case paysage à côté de arrosage automatique
et terrasse bois […] faire un pont vers la case client, pour pouvoir ajouter des
informations du client et lui envoyer »*.

J'avais proposé le planning, au motif qu'un rapport n'a pas de sens sans client
ni sans date. **Sa raison est meilleure, et c'est la sienne, posée le matin
même** : un outil doit s'ouvrir SANS client, sinon il ne sert pas en visite. Le
client vient au moment d'envoyer.

**Au passage, je me suis trompé sur un nom** : l'onglet s'appelle bien
« Paysage » — il l'a tranché le 17 au soir, après que `ARCHITECTURE.md` §125 eut
retenu « Outils ». J'ai cité §125 sans voir qu'il était dépassé.

**La tension qui reste, et que la planche 77 pose** : il a décidé la veille que
le pré-remplissage viendrait du DERNIER passage du client — or pré-remplir exige
de savoir qui, dès l'ouverture. Trois moments possibles pour nommer le client,
avec leur coût ; ma recommandation est le troisième : **nommable à tout moment**,
et la fiche se replie sur ses prestations dès qu'il est connu.

Toujours **aucune ligne de `src/`**.

---

### Du croquis au plan : la maquette essayable, et le calcul sorti de l'écran

**Sa demande :** *« une fois que j'ai envoyé la photo de mon jardin avec les
mesures, il y a le petit encart où on peut choisir la marque. Tout ce qu'il y a
en dessous, tu peux le supprimer. Et une fois que tu as lu les mesures avec
l'IA, tu me fais le plan en couleur avec les différents réseaux, contenant la
nourrice, les PE en pointillés, les arroseurs représentés par des ronds, et tu
me fais la liste des pièces à acheter [...] Avant de coder quoi que ce soit,
crée-moi une maquette dynamique que je puisse essayer. »*

**`appli/arrosage-croquis.html`**, publiée avec l'appli — ouvrable au téléphone
(`…github.io/Atlas-app/arrosage-croquis.html`). Un seul écran de saisie : la
photo et la marque. Puis le plan en couleur et les pièces rangées en casiers.

**Le calcul a été SORTI de l'écran** dans `appli/arrosage-calcul.js`, plutôt que
recopié dans la maquette. Deux implémentations d'une même règle finissent
toujours par diverger (`CLAUDE.md` §3) — et la liste des pièces n'est pas un
détail d'affichage, c'est ce qu'il commande chez son fournisseur.

**Ce que la maquette simule, et elle le dit en rouge :** la lecture de la photo.
Le plan et la liste, eux, sont vraiment calculés, sur son catalogue.

### Le quinconce, enfin posé — son croquis, et 12 tuyères qui deviennent 7

**Son croquis du 18 août :** un couloir à **14** arroseurs alignés, le même à
**7** en quinconce. *« Dans les couloirs, le but c'est de poser les tuyères en
quinconce, car le but c'est que celle de gauche recouvre quasi 100 % jusqu'à
celle de droite. »*

**Le code n'en posait aucun.** Il ne décalait que les rangées intérieures ; un
couloir n'a que deux rangées, toutes deux en bord — donc rien. Le drapeau
« quinconce » valait pourtant `true` : l'écran l'annonçait, le dessin le
démentait, et aucun contrôle ne regardait le dessin.

**Le quinconce est maintenant un damier** — un point sur deux, i + j pair — et
il ne se suppose pas : `couvreTout` mesure si tout le terrain reste arrosé, et
`poser` resserre tant que ce n'est pas le cas. Sur son couloir, la boucle tombe
sur **7**, exactement son croquis, par un chemin qui ne le connaissait pas.

| Zone | Avant | Après |
|---|---|---|
| 10 × 2 (son couloir) | 12 | **7** |
| 18 × 12 | 20 | **10** |
| 30 × 22 | 16 | **8** |

**Sept contrôles sont devenus rouges sur du code juste** — tous visaient un
nombre ou un mot, aucun ne visait une règle. Deux étaient pires : ils
continuaient de passer **en éprouvant le cas d'à côté**, sans un mot. Ils
construisent désormais leur cas en visant la condition, et échouent s'ils n'y
arrivent pas.

**Ce que cela révise :** sa règle du 17 août « les derniers arroseurs toujours
dans les coins » vaut pour la pose alignée. Sur un damier deux coins n'ont pas
de tête — ils restent arrosés, et il l'a validé : *« oui, ça me va »*.

### Le disconnecteur disparaît de la liste — sa décision

*« Le disconnecteur, tu peux le supprimer à tout jamais, je n'en mets
jamais. »* Retiré de `listeMateriel` et de la note de bas d'écran qui le disait
obligatoire. **Ce qu'on évite :** une pièce qu'il écarte à chaque chantier, et
qu'il faut décompter à chaque commande.

Les deux contrôles qui exigeaient sa présence ont été **retournés, pas
supprimés** : sans eux, la pièce reviendrait au premier raisonnement « c'est
obligatoire sur l'eau potable » — juste en général, faux pour lui, et sa
décision serait perdue. L'entrée reste au catalogue, inutilisée.

### La liste dit CE QU'ON ACHÈTE, plus POURQUOI — sa consigne du soir

*« Départ milieu de ligne, fin de ligne et jonction, ce sont des données pour
toi, pour que tu comprennes les endroits où doit y avoir des tés et les autres
où c'est des tés taraudés. Mais pour l'utilisateur, il n'a pas besoin de ces
infos-là. Donc tu peux les supprimer, mais tu les gardes pour toi. »*

Quatre mentions retirées des désignations — `(départ/milieu de ligne)`,
`(fin de ligne)`, `(jonction, non taraudé)`, `(~2 m par arroseur)` —, et le
raisonnement conservé en commentaire, là où il sert. **Il commande sur la
désignation du catalogue :** ce qui s'y ajoute est une invitation à chercher
une pièce qui n'existe pas sous ce nom.

**Un contrôle en a trouvé une cinquième que je n'avais pas vue** — le
`(~2 m par arroseur)` du PEBD Ø16 —, en comparant chaque ligne à l'entrée du
catalogue plutôt qu'à une liste écrite à la main.

**Et les deux coudes SBE ont fusionné.** Ils se distinguaient par
`(haut, au corps)` et `(bas, sur la ligne)` : retirer ces mentions aurait donné
**deux lignes identiques** dès qu'un corps est en 3/4" (les grosses turbines),
ce qui se lit comme un défaut de comptage. Les emplois s'additionnent désormais
par référence — un produit, une ligne, une quantité.

**Trois contrôles lisaient ces étiquettes, sur deux suites.** Ils vérifient
maintenant la règle en quantités : un SBE 1/2" par corps de tuyère, un SBE 3/4"
par corps de turbine plus un par arroseur, deux SBE par arroseur au total. **Un
contrôle accroché à un libellé meurt au premier changement de libellé** — c'est
la même leçon que le 17 août, quand la section 3 a disparu.

**Le cas du corps en 3/4" est PROVOQUÉ dans la suite**, avec une pelouse de
40 × 30 en Hunter : les trois jardins d'exemple posent tous des corps en 1/2",
et la garde n'aurait jamais rencontré son cas. Une garde qui ne rencontre pas
son cas ne mesure rien — le piège du 15 août, en version « jamais atteint ». Un
contrôle de plus refuse d'ailleurs de conclure si ce corps en 3/4" venait à
disparaître du catalogue.

### Quatre défauts, et aucun n'a été trouvé par une suite

1. **`corpsCourant` était resté dans `arrosage.html`** à l'extraction. Toute
   page autre que celle-là partait en `ReferenceError` dès qu'un jardin posait
   une tuyère — et l'écran rendait *« la liste se remplit dès qu'un jardin est
   lu »*, un vide qui ressemble à un état normal. Les 73 et les 105 suites
   étaient vertes : aucune ne demandait la liste d'un jardin MIXTE.
2. **Le tuyau se dessinait une ligne par rangée.** Une rangée qui ne portait
   qu'une tête de son réseau n'en avait aucune : l'arroseur flottait, relié à
   rien. Le tracé va désormais de proche en proche, à angle droit.
3. **La bande du goutte-à-goutte était grise et anonyme.** Le dessin montrait
   deux couleurs quand la nourrice en annonçait trois, sans dire où passait la
   troisième voie. Elle porte la couleur de sa vanne (`reseauxDeZone`, ajouté
   à `decouper`).
4. **Le contour de la pelouse était dessiné APRÈS les tuyaux**, et repeignait
   la rangée du bas — dont les têtes sont posées sur la bordure. Le tracé était
   juste, le plan montrait un réseau à moitié relié.

**Les trois premiers sortent de la capture d'écran, le quatrième aussi.** C'est
la sixième fois dans ce dépôt (`CLAUDE.md` §5).

### Les suites de l'arrosage barrent enfin la publication

`appli/tests/essai-arrosage-detaille.cjs` avait son adresse écrite en dur : elle
ne pouvait être jouée qu'à la main, et ne barrait donc rien. Elle lit désormais
`BASE_URL`, et `pages.yml` l'enchaîne avec la nouvelle
`appli/tests/essai-croquis.cjs` (25 contrôles). **Une suite qui ne barre pas la
publication ne barre rien** — c'est exactement ce qui a laissé passer le défaut
n° 1.

Chacun des six contrôles a été vu ROUGE avant d'être gardé, en réintroduisant le
défaut qu'il prétend attraper.

---

## 2026-08-17

### « C'est trop compliqué » — l'avoir, refait en quatre écrans

Sa correction, devant les planches 79 et 80 : *« c'est trop compliqué, il faut
faire quelque chose de simple, l'utilisateur a besoin d'aller à l'essentiel
constamment »*.

**Il avait raison, et le défaut était de méthode.** On lui présentait six
arrangements à comparer, un tableau à cinq lignes et deux pages de comptabilité.
Lui faire trancher un vocabulaire de comptable entre deux chantiers, c'est lui
faire faire notre travail.

`docs/maquettes/81-simple-il-ne-paie-pas.html` — **un lien sur la facture, une
question, deux réponses.** Quatre écrans, et c'est tout.

**Ce qui a été retiré :** le mot « avoir » (le document le portera quand il
partira ; l'écran parle sa langue), le choix entre trois formes de document
(Atlas prend la bonne), les explications de TVA (la sienne ne bouge pas — ce qui
ne bouge pas n'a rien à faire à l'écran).

**Ce qui ne pouvait pas être retiré, et une ligne suffit :** les deux réponses
font l'inverse l'une de l'autre. *Enlever une somme* y renonce définitivement ;
*dire qu'il ne paiera pas* garde la facture et le droit de réclamer. N'en garder
qu'une serait plus simple d'un cran, et la seule qui resterait est celle qui le
désarme.

**Le contrôle garde la simplification, il ne la constate pas :**
`verifier-maquette-avoir.mjs` compte les écrans (quatre), compte les réponses
(deux), **refuse le mot « avoir » sur le téléphone** et exige la phrase sur le
droit de réclamer. Trois planches dégradées, trois rouges — dont le mot de
comptable revenu sur un bouton.

Les 79 et 80 restent au dépôt : écartées, elles racontent le chemin (§3 bis).

### « Il faut pouvoir créer un avoir » — dessiné, et une distinction qui vaut de l'argent

Sa demande du 17 août : *« si jamais on facture un client et qui décide de ne
pas nous payer, il faut avoir la possibilité de créer un avoir […] crée-moi des
maquettes dynamiques en .html, pas de photo »*.

**Ce que les planches lui disent, et qui n'était pas dans sa question.** Un
avoir et un impayé ne sont pas la même chose, et les confondre coûte cher **sans
retour possible** :

| | Ce que ça fait | Peut-il encore réclamer ? |
|---|---|---|
| **Avoir** | annule tout ou partie de la facture | **non, plus jamais** |
| **Facture perdue** | la facture reste entière, le rappel se tait | **oui** |

Un client qui refuse de payer relève du second. Faire un avoir dans ce cas, ce
serait se désarmer soi-même — et rien à l'écran ne l'en avertirait. C'est
pourquoi l'arrangement le plus simple (une porte, un montant) est aussi le plus
dangereux, et la planche le dit en toutes lettres.

**Et une bonne nouvelle qui lui appartient :** sa TVA étant exigible au paiement
depuis le 16 août (§110), une facture jamais payée n'est **jamais entrée** dans
son relevé. Il ne doit rien dessus, il n'a rien à récupérer, aucune démarche à
faire. Sous l'autre régime il aurait avancé 240 € de TVA sur un chantier jamais
payé.

`docs/maquettes/79-il-ne-paie-pas.html` (trois arrangements pour la situation,
deux portes d'entrée) et `80-l-avoir.html` (trois formes de document, trois
montants essayables). **Rien n'est codé** : `src/` n'est pas touché (§3 bis).

**Ce que le code ne permet pas encore, et qui est écrit sur la planche :**
`factures` n'accepte **qu'une facture par chantier**
(`factures_chantier_uk`), la numérotation n'a **qu'une série**
(`prochain_numero_facture`), et `resteDu` ne connaît que les règlements. Un
avoir demande sa place, son compteur, et d'être vu par le reste dû — sans quoi
la fiche client et le rappel d'impayé réclameraient une somme annulée.

Contrôle : `scripts/verifier-maquette-avoir.mjs`, javascript coupé. Il recalcule
chaque total depuis le TTC affiché plutôt que de le recopier, et **refuse la TVA
prise sur le TTC** — 300 € d'avoir font 250,00 € HT et 50,00 € de TVA, jamais
300 € de HT. Confronté à trois planches dégradées : trois rouges, chacun nommant
le bon coupable, y compris le retrait de la phrase sur le droit de réclamer.
### La maquette des clients, ESSAYABLE — et le libellé qui disait « lui » à une cliente

**Sa demande, le soir même :** *« montre-moi depuis chantier ce que ça donnerait,
crée une maquette dynamique que je puisse essayer, pas de photo, en .html »* — et
sa validation dans la foulée : *« c'est bien comme ça, sous le nombre de
chantiers en cours, en or »*. C'était déjà codé et sur `main` ; la planche sert
à l'essayer sans rallumer son espace.

**`appli/clients.html`**, publiée avec l'appli — donc ouvrable au téléphone
(`…github.io/Atlas-app/clients.html`). Quatre écrans qui s'enchaînent pour de
bon : l'accueil, la liste, la fiche d'un client, et **le chemin depuis un
chantier**, celui qu'il voulait voir.

**Sans une ligne de JavaScript.** La navigation passe par `:target`, et le
contrôle coupe le script pour le prouver : une planche qui ne s'ouvrirait pas
chez lui ne vaut rien. Elle marche aussi hors ligne.

**Un piège évité en l'écrivant :** l'accueil devait se cacher dès qu'un autre
écran est visé. La règle évidente (`:has()`) n'existe pas sur les téléphones un
peu anciens — la maquette se serait affichée en double, sans un mot. L'accueil
est donc écrit en dernier, et une règle de frère suffit.

**Et un défaut sorti de la planche, jamais d'un test :** la ligne qui ouvre la
fiche d'un client disait *« Ce qu'on sait de lui »* — devant « Mme
Bracquemont ». Elle est neutre désormais : rien dans la base ne dit le genre
d'un client, et un sur deux est une cliente.


### « Je retourne dans l'application et pas dans la catégorie tarif »

Sa remarque du 17 août, capture à l'appui, depuis « Mes prix ». Les réglages ont
deux étages, et **trois écrans du second renvoyaient au mauvais endroit** — ou
nulle part :

| L'écran | Sa seule porte | Ce que la flèche faisait |
|---|---|---|
| Mes prix | Tarifs & catalogue | ramenait à la racine des réglages |
| Le catalogue | Tarifs & catalogue | **aucune flèche du tout** |
| Le vocabulaire | Atlas IA | ramenait à la racine des réglages |

Chacun ramène désormais à la rubrique qui l'ouvre.

**Pourquoi aucun test ne le voyait :** aucun ne PARCOURAIT le chemin. Chaque
écran s'ouvrait par son adresse, où la question ne se pose pas.
`test-retours-reglages-e2e.ts` entre par la porte et ressort par la flèche,
comme lui — elle rendait **cinq échecs** avant le correctif. Le retour du
vocabulaire, lui, **n'est pas éprouvé** : son renvoi n'existe que pour le compte
éditeur, que la suite ne peut pas être.

**Et vu à la capture, pas par un test :** l'écran affichait « MES PRIX » au-dessus
de « Mes prix ». Le surtitre dit d'où l'on vient — il porte maintenant
« Tarifs & catalogue ».

**Le catalogue a été refait en parallèle par une autre session** (arrangement B
de la planche 72) et porte désormais sa propre flèche vers « Tarifs & catalogue ».
C'est cette version-là qui a été gardée à la fusion ; la suite ci-dessus la
couvre telle quelle.
### « La catégorie client n'a pas été créée » — la liste, sans cinquième onglet

**Sa remarque du soir, et elle était juste.** La FICHE d'un client existait
depuis la veille (arrangement B de la planche 66), mais elle ne s'atteignait que
**depuis un chantier** : il n'y avait aucun endroit d'où voir ses clients, ni
retrouver celui qu'on a en tête sans se rappeler pour quel chantier on l'avait
noté.

**La liste s'ouvre depuis l'accueil, sous « quatre en cours ».** Pas de
cinquième onglet : la barre du bas en porte quatre, le cinquième est déjà décidé
pour les outils métier (`ARCHITECTURE.md` §125), et à cinq colonnes
« CHANTIERS » déborde déjà sur 360 px. Le lien est en or et en petites
capitales, comme le reste de ce bloc — ce qu'on LIT, jamais ce qu'on FAIT :
l'action de cet écran reste « Nouveau chantier ».

**Le calcul est celui de la fiche, pas un second.** `composerFicheClient` sert
les deux écrans : deux façons d'additionner ce qu'un client doit finiraient par
se contredire, et c'est lui qui verrait la différence en passant de la liste à
la fiche. Et la liste se charge en **quatre requêtes**, pas en cinq par ligne :
sinon elle s'ouvrirait d'autant plus lentement qu'il a de clients.

**Rien ne s'invente :** un client sans facture affiche « rien de facturé », pas
« 0 € » — un zéro se lirait comme un mauvais payeur. Ce qui reste dû n'apparaît
que s'il y en a.

Éprouvé par `scripts/test-liste-clients.ts` (isolation, reste dû, ordre, chantier
supprimé) et le parcours complet dans `scripts/test-fiche-client-e2e.ts` — depuis
l'accueil, en touchant le lien, **et un contrôle qui vérifie que la barre du bas
n'a pas gagné d'onglet**.

### CORRIGÉ : poser une date à la main — le calendrier ne venait jamais

Sa plainte : *« je peux toujours pas poser de date sur les chantiers test »*.
**« Toujours » : une autre session l'avait déjà constaté le même jour** et
l'avait contourné en faisant pré-poser un chantier par un script.

**Le geste marchait pourtant de bout en bout.** Ce qui manquait était le
raccord : en touchant un chantier de « Sans date », l'écran écrivait « À poser »
et **ne bougeait pas d'un pixel**. Mesuré sur son écran : le calendrier se
trouvait 231 px **au-dessus** du haut de la fenêtre — seule sa dernière rangée
dépassait, celle des « 31 1 2 3 4 5 6 » de sa capture. Aucun chemin visible vers
une date.

`amenerAuCalendrier` existait déjà et annonçait servir « depuis deux endroits ».
Le second était branché, la liste « Sans date » ne l'a jamais été.

**Pourquoi aucune suite ne le voyait :** Playwright fait défiler un élément
jusqu'à lui avant de cliquer. Un contrôle qui clique éprouve qu'une cible
existe, jamais qu'elle est ATTEIGNABLE. Le nouveau mesure la position du
calendrier dans la fenêtre. `ARCHITECTURE.md` §127.



### Une prestation qu'il ajoute s'écrit en NOIR, comme les autres

Sa correction du 17 août, capture à l'appui : « Entretient » en doré sous
« Élagage » en noir — *« les nouvelles prestations doivent toujours être en noir,
pas en doré »*.

La couleur disait d'où venait l'entrée — du catalogue commun, ou de lui. Mais
**deux couleurs de titre dans la même liste se lisent comme deux natures de
prestation**, alors qu'il les coche de la même façon sur un chantier.

**L'or reste sur ses MOTS**, dans « Aussi appelé » : là il sépare le mot du
commun, qu'on ne retire pas, du sien, qu'un « × » enlève — une distinction qui
porte un geste. Raisons : `ARCHITECTURE.md` §123.

### « L'appli est super lente », deuxième soir — la construction orpheline

**Sa plainte, à 21 h :** *« même problème qu'hier, l'appli est super lente,
corrige-moi ça »*. Sa fiche d'état a tranché en dix secondes, sans lui faire
recopier un terminal : `Code SERVI : AUCUNE — la construction a ÉCHOUÉ`, et le
message exact, `Another next build process is already running`.

**Même message que la veille, cause différente — et c'est le piège.** Le
correctif du 16 tue les constructions orphelines **au démarrage** ; il tient
toujours. Mais son espace n'a que 8 Go (181 Mo libres au moment de la panne) :
quand la mémoire manque, le noyau tue un processus. Le banc part, **sa
construction lui survit**, le veilleur relance un banc, et celui-là tombe sur le
verrou de l'orpheline. Le banc reste alors en mode développement, où chaque
écran se compile à l'ouverture — c'est exactement « l'appli est lente ».

**Un second trou ouvrait la même porte :** le verrou de banc regardait si le
fichier existait, *puis* l'écrivait. Deux bancs démarrant dans la même seconde
ne se voyaient pas et repartaient tous les deux. Il se prend désormais en
**création exclusive** — un seul peut réussir.

**Ce qui est posé :** le banc déloge l'orpheline avant de bâtir et réessaie une
fois si le verrou parle encore (`scripts/verrou-construction.mjs`,
`ARCHITECTURE.md` §129). **On ne double jamais une construction** — on retire
celle qui n'a plus de destinataire, puisque le banc qui aurait basculé dessus
est mort. Et on n'efface toujours pas le fichier `lock` : cette règle-là ne
bouge pas.

**Les contrôles tuent un vrai processus**, et ont été vus rouges avant d'être
livrés : délogement neutralisé, le premier rougit ; création exclusive retirée,
deux cas rougissent — dont celui du 10 août.

**Ce que ça ne règle pas, et qui est écrit noir sur blanc :** la mémoire reste
étroite. Si le noyau tue à nouveau le banc, le démarrage suivant repartira
proprement, mais il repartira.

### Un réglage ajouté après sa première visite lui arrivait VIDE

Sa question : *« C'est normal qu'il n'y a plus aucune info en mémoire ? »* Son
jardin était bien là — mais un piège s'était refermé, et sur lui seul.

`var etat = charger() || {défauts}` : dès qu'une sauvegarde existait, **tout
l'objet de défauts était sauté**. Donc chaque champ ajouté au produit APRÈS sa
première visite lui arrivait `undefined` : le champ « du compteur au regard »
s'ouvrait vide, le verdict Ø25/Ø32 ne pouvait plus se calculer. La page d'un
nouveau venu était juste, la sienne non — le pire des deux cas, puisque rien
ne le disait.

On part désormais **toujours** des défauts, et sa saisie se pose par-dessus,
champ par champ : ses valeurs gagnent, les réglages qu'il n'a jamais vus
prennent celle du jour. Une clé retirée du produit (le `pe32` d'avant le calcul
de diamètre) est effacée plutôt que laissée à traîner.

Le contrôle éprouve le cas réel — un jardin enregistré avant les réglages du
jour — et a été vu rouge sur le piège remis en place. **Ce défaut aurait
frappé à chaque réglage ajouté**, et lui seul : c'est le genre qu'on ne voit
jamais en développant, puisqu'on part d'un navigateur vide.

### « Paysage » plutôt qu'« Outils » — il revient sur son choix, et il a raison

*« As-tu créé la fiche outils ? Je préférerais qu'elle s'appelle Paysage
finalement. »* L'onglet, son écran et son adresse sont renommés.

**J'avais écarté ce mot le matin même**, au motif que le paysage est son métier
entier et ne distinguerait donc rien. **L'argument était faux**, et il faut
dire pourquoi sans quoi quelqu'un le ressortira : il supposait qu'Atlas
resterait l'application d'un paysagiste. Or Atlas sert des artisans, et lui-même
prépare déjà la terrasse bois. Dans une application multi-métiers, « Paysage »
distingue exactement ce qu'il faut — le jour où un menuisier s'en sert, il aura
un onglet « Menuiserie » à côté, là où deux listes d'« Outils » auraient
demandé de les départager en entrant.

Et le mot vaut mieux pour une seconde raison : « Outils » nomme la nature de ce
qu'il y a dedans, « Paysage » nomme le métier servi. Le second se lit sans avoir
à ouvrir.

Un cas de contrôle s'ajoute : **le libellé et l'adresse doivent aller
ensemble**. Renommer l'un sans l'autre donnerait un onglet « Paysage » qui ouvre
`/outils` — un 404 que personne n'aurait voulu, et que rien n'aurait dit.

### Le contrôle de la barre a trouvé une erreur — la mienne, dans la mesure

**Il a rougi dès sa première exécution**, sur le trait d'or : « trait de 66,4 px
pour une colonne de 72,0 px ». Le trait était juste ; c'est ma mesure de la
colonne qui était fausse — je divisais la largeur de la rangée par cinq, en
comptant ses 28 px de marge intérieure comme de la place disponible. **Les deux
contrôles de largeur passaient donc avec 5,6 px de trop.**

**Et la première correction était fausse elle aussi.** Mesurer la boîte du LIEN
paraissait évident — c'est la cellule de grille. Sauf qu'une cellule `1fr`
**s'élargit quand son contenu déborde** : le lien mesure alors exactement la
largeur du mot, et « déborde » ne se voit plus jamais. Un mot de 120 px aurait
rendu « colonne 120, texte 120, tout va bien ».

La mesure juste est la **part** : le contenu de la rangée, marges déduites,
divisé par le nombre d'onglets — 66,4 px. C'est aussi la largeur du trait d'or,
et c'est pour ça que les comparer a révélé l'écart.

**Ce que ça change aux nombres donnés au patron**, et il fallait le lui dire :

| | Annoncé d'abord | Réel |
|---|---|---|
| A · sans rien changer | déborde de 7,2 | **déborde de 12,4** |
| B · espacement resserré | tient de 1,3 | **déborde de 3,9** |
| C · lettre plus petite | 11,8 de marge | **6,2 de marge** |
| D · avec une icône | 14,8 de marge | **9,2 de marge** |

Son choix ne change pas — C reste la seule variante sans icône qui rentre —
mais B ne « tenait » pas du tout, et la planche 76 le dit maintenant.

**Le seuil du contrôle passe de 6 à 4 px**, et le seuil s'explique : il doit
rejeter B (qui déborde) sans mettre C à un cheveu du rouge. Un contrôle qui
passe de justesse rougit au premier rendu un peu différent, et l'on prend
l'habitude de le rejouer au lieu de le croire.

**La leçon, et elle dépasse cette barre : deux mesures qui devraient tomber
pareil valent mieux qu'une mesure seule.** Ici, le trait d'or et la colonne
sont la même largeur par construction ; les comparer a trouvé ce qu'aucune des
deux n'aurait dit isolément.

### Le cinquième onglet est posé, et un contrôle mesure la barre

Sa variante retenue sur la planche 76 : **C**, la lettre à 8,5 px espacée de
0,14em, **sans icône** — sa décision du 10 août de retirer les pictogrammes
tient donc aussi à cinq colonnes. 11,8 px de marge, de quoi encaisser une autre
police de téléphone.

Trois choses sont posées avec l'onglet :

- **La largeur du trait d'or suit le nombre d'onglets.** Elle était écrite en
  dur (`/ 4`) : l'oublier aurait laissé le trait à cheval sur deux colonnes,
  un défaut de dessin que rien n'aurait dit.
- **Un écran derrière l'onglet**, sans quoi il mènerait à une page introuvable
  — la troisième fois qu'il appuierait sur quelque chose qui ne répond pas.
  **Et cet écran dit la vérité** : l'outil d'arrosage n'est pas dans
  l'application, c'est une page publiée à part. La ligne porte « À l'essai » au
  lieu d'un chevron, et ouvre la page dehors. Promettre un écran interne aurait
  été mentir d'un signe.
- **Un contrôle qui mesure la barre à 360 px** (`test-barre-basse-e2e.ts`). Il
  mesure la boîte du **nœud de texte**, pas celle du lien : un lien de grille
  remplit sa colonne quoi qu'il porte, sa largeur ne dirait rien. Il exige
  **6 px de marge minimum** — précisément pour refuser la variante écartée et
  son faux confort de 1,3 px — et refuse de conclure sur une barre absente.

Ce genre de défaut ne se voit pas en développant sur un grand écran ; il
n'apparaît que sur son téléphone. C'est exactement pourquoi il fallait un
contrôle plutôt qu'un commentaire.

**La décision est aussi entrée dans `docs/QUESTIONS.md` §22**, avec son accord
— pourquoi ni les Réglages ni une catégorie « Paysage », et ce que le cinquième
onglet a coûté à la barre.

### Où vivent les outils métier : un cinquième onglet, et ce qu'il coûte

Sa question, en vue des terrasses bois qui suivront l'arrosage : une catégorie
« Paysage », ou une rubrique dans les Réglages ? Les deux ont été écartées — on
règle dans les Réglages ce qui vaut une fois pour toutes, et « paysage » est
son métier entier, donc ne distingue rien. Ma recommandation (attacher les
outils au chantier) l'a été aussi, et son objection tient : un outil qui exige
un chantier ne sert pas en visite de devis, quand le client n'existe pas
encore. **Sa décision : un cinquième onglet « Outils ».**

**Le coût de ce choix est mesurable, et il a été mesuré avant d'écrire une
ligne** (planche 76). La barre porte quatre onglets depuis le 10 août ; à cinq,
la colonne tombe de 89,5 à 71,6 px sur un écran de 360 — et « CHANTIERS » en
demande 78,8. **Il déborde de 7,2 px.** Resserrer l'espacement le fait tenir de
1,3 px, ce qui n'est pas tenir : un changement de police entre téléphones, et
le défaut revient — invisible ici, visible chez lui.

Restent deux variantes viables, et l'une d'elles revient sur sa décision du
10 août (les icônes retirées). Elle est recevable — à cinq colonnes, une icône
sert à viser sans lire, ce qu'elle ne faisait pas à quatre — mais c'est à lui
de la reprendre, pas à moi de la défaire en silence. **Rien n'est codé** :
`ARCHITECTURE.md` §125 porte le raisonnement, `TODO.md` la marche à suivre.

### Le plan de contrôle quitte l'écran à son tour

*« Je ne comprends pas à quoi sert le 3 ? »*, puis, la question posée :
« enlevez-le ». Il ne s'en servait pas, et il avait raison de demander. Ce
plan-là dessinait chaque zone séparément, en rectangles abstraits : utile pour
vérifier un compte — c'est lui qui avait montré l'arroseur en trop du quinconce
le matin — mais ce n'est pas le plan qu'il veut. Le sien, c'est celui de la
planche 75, avec le terrain entier, le regard et les tuyaux. **Un écran
intermédiaire qui ne sert qu'au développeur n'a rien à faire sous ses yeux.**

Restent trois sections : le point d'eau, le croquis, la liste. Tournent
toujours dessous, invisibles : la pose, le découpage, et l'affectation des
arroseurs aux vannes — sans quoi ni le nombre d'électrovannes, ni la fiche de
nourrice, ni les tés du réseau latéral ne seraient justes. Le coloriage par
réseau, lui, disparaît avec le plan ; il reviendra avec le vrai plan
d'ensemble.

**Quatre contrôles lisaient ce dessin. Aucun n'a été supprimé sans regarder ce
qu'il gardait vraiment** : le compte des têtes devient « le nombre annoncé est
exactement la liste de points » — l'invariant qui avait fait tomber l'arroseur
en trop, et qui vaut sans dessin. Deux autres ne gardaient que le rendu (une
boîte non nulle, une cote non rognée) et partent avec lui.

### Le croquis prend la place des zones, et le découpage quitte l'écran

Il a parcouru l'outil écran par écran et tranché en une phrase : *« Tu
supprimes la 3, et la 2 ça doit être la photo du croquis qu'on ajoute. »*

La section 2 devient **Le croquis** : on photographie le croquis du client, il
reste affiché pendant qu'on renseigne le jardin dessous, et il part avec le
chantier. La section 3 — le tableau des secteurs — disparaît. **Le calcul, lui,
tourne toujours** : c'est lui qui donne les couleurs du plan, le nombre
d'électrovannes et la fiche de nourrice. Seul l'écran s'en va.

**Ce qui est parti avec la section 3**, et qu'il faut savoir pour le lui rendre
s'il le redemande : les durées d'arrosage, le cycle total, et le sélecteur de
saison.

**La photo est redimensionnée avant d'être gardée, et ce n'est pas du
confort.** Une photo de téléphone pèse 3 à 8 Mo ; `localStorage` en accepte
environ 5 pour tout le jardin. Gardée telle quelle, elle ferait sauter la
sauvegarde entière — et c'est le jardin qui disparaîtrait au rechargement, pas
seulement l'image. Elle est donc ramenée à 1400 px, en JPEG, ce qui suffit à
relire des cotes écrites à la main. Si l'enregistrement échoue quand même, la
page **remet l'état d'avant et le dit**, au lieu d'afficher une photo qui ne
survivra pas.

Et l'écran **annonce qu'il ne lit pas encore les cotes** : la page est servie
sans serveur, la lecture demande l'application. Laisser croire le contraire
ferait partir un jardin vide sur un chantier.

**Les contrôles qui lisaient la section 3 ont été reportés sur le calcul, pas
supprimés** — aucun secteur au-dessus du robinet, les durées qui baissent en
avril, le découpage qui ne recâble pas. Même leçon que le matin : un contrôle
garde une règle, pas un écran. Le garde-fou du croquis, lui, a d'abord été
écrit trop lâche : il acceptait aussi le texte affiché SANS photo, donc restait
vert quand l'avertissement disparaissait. Il pose maintenant une vraie photo
avant de lire. 73/73 et 96/96.

### La liste de la planche 75 était TAPÉE À LA MAIN, et fausse

Il l'a lue et il a compté : *« énormément de choses qui ne sont pas correctes
[…] le Dura rectangle, tu as mélangé une pièce avec le regard ».* Il avait
raison, et la cause n'est pas une erreur de frappe mais une faute de méthode :
cette liste avait été **écrite à la main dans la planche** au lieu d'être
produite par l'outil. J'y ai composé un « regard 3 voies » en piochant des
pièces dans plusieurs de ses fiches — c'est exactement ce que le §4 interdit,
et ce que le code, lui, refuse de faire depuis le début.

La liste est retirée de la planche, remplacée par la raison de son retrait et
un renvoi vers l'outil. **Une planche ne recopie jamais un calcul** : elle
montre ce qui n'existe pas encore, et rien d'autre. Ici, ce qui n'existait pas
encore, c'était le PLAN — la liste, elle, tournait déjà.

### La cible est dessinée : son plan d'exécution, en couleur

Il a envoyé la photo d'un vrai plan de chantier — échelle 1/100e, légende,
symboles, diamètres cotés le long des tuyaux — et sa demande : *« lorsqu'on te
donne un croquis comme celui-là, tu rentres toutes les infos comme sur la
photo […] tu me fais ça en couleur, tu sépares les réseaux. C'est là où je veux
arriver au final. »*

`docs/maquettes/75-le-plan-comme-le-sien.html` refait ce plan, un réseau par
couleur, **sur les nombres que l'outil calcule déjà** — onze têtes en
quinconce, coupées 5 / 6 entre deux vannes, la liste entière. Pas des nombres
de décor : ce sont ceux du jardin d'exemple.

**C'est une planche et non du code, et c'est sa règle** (§3 bis). Ce plan-là
demande la seule chose que l'outil n'a pas : un jardin d'ENSEMBLE. Il connaît
des zones, pas un terrain — donc ni le regard, ni les tuyaux, ni le robinet
n'ont d'endroit où se poser. Bâtir cela, c'est un moteur de plan entier ; une
planche se corrige en dix minutes. Ce qu'elle lui demande de trancher : les
symboles, les cotes voulues, et surtout la lecture de *« juste la dripline, ça
tu ne le mets pas »* — comprise comme « sa vanne reste, son tracé disparaît ».

**Un piège de dessin payé au passage, et il vaut au-delà de cette planche :**
le contour de la pelouse était un second rectangle `fill="none"` posé après
les couronnes. **Une règle CSS l'emporte sur un attribut de présentation SVG**,
donc le `fill="none"` était ignoré : le rectangle repeignait la pelouse en
opaque et effaçait toutes les couronnes. Le plan s'affichait proprement, sans
la seule chose qu'il doit montrer. Vu sur la capture, par rien d'autre — la
septième fois dans ce dépôt.

### Les tuyères reviennent aux petits espaces, et le Ø25/Ø32 se calcule

Deux règles de métier, données ensemble. **Les tuyères d'abord :** *« on s'en
sert uniquement pour les petits espaces — inférieur à 3,50 m, 4 m grand max.
Un carré de douze par dix, c'est que des arroseurs. Les tuyères, c'est un
carré de trois par trois, ou un long couloir de dix mètres sur deux. »* Le
seuil de l'outil était à **8 m**, il est à **4** — et l'écart n'a rien de
cosmétique : une pelouse de 12 × 8 partait en tuyères, donc en pluviométrie
triple, beaucoup plus de têtes et beaucoup plus de débit. C'est le petit côté
qui décide, et lui seul : son couloir de 10 × 2 prend des tuyères malgré ses
dix mètres de long. Au-delà de 4 m, le repli vers les tuyères est désormais
interdit — si aucune turbine ne pave, l'écran le dit plutôt que de rendre un
plan posable et faux.

Le jardin d'exemple a suivi : ses deux pelouses étaient **forcées** en tuyères
pour montrer une bascule, ce que sa règle interdit maintenant. Un écran
d'accueil qui viole la règle qu'on vient de recevoir enseigne le contraire de
ce qui a été dit. Elles passent sur « au mieux », et son couloir de 10 × 2
entre dans le jardin pour que les tuyères restent montrées à leur place.

**Le Ø25/Ø32 ensuite :** *« du compteur au regard, Ø25 par défaut ; passer en
Ø32 uniquement si le calcul hydraulique démontre que le Ø25 est
insuffisant. »* Le calcul est celui de Hazen-Williams, sur le débit du **plus
gros secteur** — les vannes s'ouvrent l'une après l'autre, prendre la somme
surdimensionnerait chaque chantier. Le verdict tombe quand la pression restant
au regard passe sous celle à laquelle les buses posées sont données. 30 m →
Ø25 (perte 0,27 bar) ; 150 m → Ø32. Les deux champs de tuyau à remplir à la
main deviennent une longueur à mesurer et un diamètre calculé.

Ce que le calcul ne contient pas est écrit à l'écran : ni antennes, ni
raccords, ni électrovanne. Un « le Ø25 suffit » est un plancher, pas une
garantie. Et les diamètres intérieurs sont marqués provisoires — ils dépendent
de la pression nominale du tube, qu'il n'a pas précisée, et se tromper de
gamme fausserait le verdict dans le sens dangereux.

**Le défaut que ces règles ont révélé, vu sur le PLAN et par aucun test : deux
pluviométries sous une même vanne.** La clé de groupe ne portait que le type ;
tant qu'une pelouse était en turbines et l'autre en tuyères, elles ne se
rencontraient jamais. Le jour où sa règle les a mises toutes deux en turbines,
elles se sont retrouvées sur la même vanne avec 5,9 et 6,1 mm/h — et c'est le
coloriage par réseau, livré une heure plus tôt, qui l'a rendu visible. La
pluviométrie entre donc dans la clé : sa règle « ça ne se mélange jamais »,
appliquée à la lettre. Cela coûte une vanne quand deux zones portent des buses
différentes, même de 3 % d'écart — le sens prudent, à relâcher d'une ligne
s'il le juge trop strict.

**Et les contrôles ont été rendus indépendants du jardin d'exemple.** Trois
d'entre eux ont rougi ce soir sans qu'aucun défaut existe : ils gardaient un
jardin (une portée de 3,6 écrite en dur, une référence de buse nommée, une
boucle de cinq clics) au lieu de garder une règle. Ils lisent désormais la
portée réelle de chaque zone, demandent au plan quelle référence il commande,
et retirent les zones jusqu'à ce qu'il n'en reste plus. 67/67 et 91/91.

### Le plan dit enfin quel arroseur est sur quelle vanne

Sa demande, dans le parcours complet qu'il a dicté : *« un petit plan avec le
nombre de réseaux, avec des couleurs différentes pour les différencier —
réseau un en bleu, réseau deux en vert, réseau trois en jaune ».* La couleur
était la partie facile ; **le découpage ne savait pas répondre à la question.**
Il comptait « il faut 4 secteurs » en divisant le débit total en parts égales,
sans jamais désigner les arroseurs de chacun.

`decouper()` rend donc maintenant `reseauDuPoint` — le numéro de vanne de
chaque tête — et le plan colorie d'après cette liste, jamais un second calcul
à côté : c'est cette divergence-là qui avait produit l'arroseur en trop du
quinconce le matin même.

**Deux défauts sont tombés au passage, et aucun n'était visible avant que la
question soit posée :**

- **Les parts égales étaient une fiction.** Sur la pelouse arrière, la coupe
  réelle donne 0,80 et 0,96 m³/h, pas deux fois 0,88. L'écran annonçait un
  chiffre que le plan aurait démenti dès la première capture.
- **Couper entre rangées seulement ne tient pas.** La rangée du milieu de la
  pelouse avant boit 1,77 m³/h à elle seule, au-dessus de la limite de 1,53 —
  insécable, elle fabriquait un secteur en dépassement. La coupe se fait donc
  au point près, dans l'ordre de pose : une longue rangée alimentée par deux
  vannes, une à chaque bout, est ce qu'on pose tous les jours.

Et l'équilibre est visé au lieu de remplir à ras bord : le premier
remplissage mettait 9 têtes sur une vanne et 2 sur l'autre — juste au sens du
débit, absurde au sens du chantier. On calcule combien de vannes il faut, puis
on répartit autour de cette moyenne, la limite ne servant plus que de
garde-fou.

Huit contrôles gardent l'ensemble, **chacun vu rouge sur son défaut** : la
coupe alternée en rougit trois, les parts égales rétablies en rougissent un.
Le numéro du réseau reste écrit à côté de la pastille, pour que le plan se
lise aussi quand on distingue mal deux teintes. 52/52 et 90/90.

### Les turbines se posent enfin — et un corps de tuyère leur était compté

*« Les débits, portées qui sont dans le tableau sont donnés pour les arroseurs
en 360 degrés ; c'est les mêmes données que pour 90 ou 180 degrés. »* Cette
phrase débloque les six familles de turbines, entrées depuis le matin mais
jamais choisies : leurs tableaux ne donnent qu'un chiffre de débit par buse,
et `busesDe` exige les trois angles avant de poser quoi que ce soit.

**On n'a donc jamais eu à diviser** — le chiffre du tableau EST la valeur à
90° comme à 360°. Un passage documenté recopie le 360° sur les deux autres
angles des turbines, **et d'elles seules** : les tuyères gardent leurs valeurs
par angle, qui sont réellement différentes (6-VAN : 0,27 à 90°, 0,32 à 360°).
Physiquement cela se tient — une turbine projette un filet par un orifice fixe
qui balaie l'arc réglé, une tuyère un éventail dont la largeur change avec
l'arc. Sur le jardin d'exemple, la pelouse arrière passe en 3504, son débit
tombe de 3,4 à 1,76 m³/h, et le jardin passe de dix secteurs à sept.

**Le défaut que ce déblocage a créé, et qu'aucun des 39 contrôles n'a vu.** Les
turbines posées, la liste comptait toujours un corps de TUYÈRE pour tous les
arroseurs : 22 corps 1800 et 22 coudes SBE en 1/2", quand 11 de ces arroseurs
étaient des turbines — corps 3504, et 3/4" sur les grosses séries. Tout était
vert. **C'est une capture qui l'a montré, la sixième fois dans ce dépôt qu'un
défaut sort d'une image et d'aucun test.** `listeMateriel()` compte désormais
le corps par FAMILLE et le SBE du haut par DIAMÈTRE DE CORPS : un jardin mixte
porte les deux diamètres, chacun pour sa part.

Et le corps d'une turbine ne se choisit pas, contrairement à celui d'une
tuyère : la buse 0,75 du 3504 ne va que dans un corps 3504.
`CATALOGUE.corpsDeLaBuse` les apparie par la référence
(`RA3504-B075` → `RA3504`), et un contrôle exige que **chaque** buse de
turbine posable trouve son corps — une convention de référence cassée à la
prochaine transcription ferait sinon manquer un corps en silence, donc un
chantier arrêté à la pose.

**Ce qui a été éprouvé à l'envers**, comme le veut le §5 : la division par
l'arc rougit le contrôle du débit ; l'uniformisation étendue aux tuyères
rougit celui qui protège leurs valeurs par angle ; le corps unique pour toutes
les familles rougit les deux contrôles de corps et de diamètre. Chaque cas
refuse aussi de conclure sur un jardin qui ne mêlerait pas les deux familles,
pour ne pas rendre un vert qui ne mesure rien. 44/44 et 90/90.

**Et « corps 1800 » devient « tuyère 1800 »**, sur sa correction — étendue aux
Pro-Spray et I-Spray, et aux corps de turbine devenus « turbine X » : laisser
deux mots pour la même chose dans un même sélecteur aurait été le genre
d'écart qui se voit à l'écran et pas dans le code.

### Il éprouve la règle des tés sur un tracé libre — elle tient, `N − 1`

*« Combien de té ? Où sont-ils ? Marque-les d'un point jaune ! »*, sur un
croquis à lui. **C'était un contrôle, pas une demande de dessin** : son tracé
n'est délibérément pas une grille — six arroseurs répartis n'importe comment
autour du regard, des courbes, des branches de longueurs inégales. Une règle
qui n'aurait tenu que sur une grille ne vaudrait rien sur un chantier.

Elle tient, et elle se résume à une soustraction : un réseau part d'UNE ligne
au regard et doit finir sur `N` bouts ; chaque té coupe une ligne en deux,
donc ajoute un bout. D'où **`N − 1` tés, quelle que soit la forme du terrain
et quel que soit l'ordre de raccordement**. Six arroseurs, cinq tés — marqués
et numérotés dans `docs/maquettes/74-ou-sont-les-tes.html`.

**Ce que ça prouve sur le code, et c'est la vraie prise du lot :** l'outil
compte sur une grille `(nombre − ny)` tés de ligne + `(ny − 1)` jonctions,
**dont la somme vaut exactement `nombre − 1`**. Les deux comptages — l'un par
la grille, l'autre par la topologie de son tracé libre — tombent sur le même
nombre. La formule de `listeMateriel()` n'était donc pas un cas particulier
de la grille. **Aucune ligne de calcul n'a changé** : ce lot livre le dessin,
la certitude — et un garde-fou.

**Le garde-fou tient la règle par son INVARIANT, pas par des nombres**
(`essai-arrosage-detaille.cjs`) : `tés + jonctions === arroseurs − réseaux`
et `tés + coudes === arroseurs`. Écrire « 8 tés sur ce jardin » aurait été
périmé au prochain catalogue ; l'invariant, lui, survit à tout changement de
buse ou de dimension. **Éprouvé à l'envers avant d'être gardé**, comme le
veut le §5 : reposé à `ny` jonctions au lieu de `ny − 1` — l'erreur exacte
que sa correction du 17 août visait — il rougit ; reposé à `nombre` tés au
lieu de `nombre − ny`, les deux contrôles rougissent. Et il refuse de
conclure sur un jardin sans arroseur, pour ne pas rendre un `0 === 0` vert
(le piège du contrôle qui mesure zéro, payé le 15 août). Remis droit :
35/35 et 90/90 au vert.

### Le tracé du réseau latéral est tranché, et calculé automatiquement

La question posée depuis le lot du réseau latéral — le tuyau serpente-t-il
en une seule ligne, ou en plusieurs lignes parallèles depuis le regard ? —
bloquait le comptage des tés, coudes et jonctions. Sur sa demande (*« fais-moi
un croquis pour cette question que je te réponde correctement »*), un dessin
(`docs/maquettes/73-le-trace-du-tuyau.html`) a tracé le même secteur des deux
façons, à toucher plutôt qu'à lire.

Sa réponse : **plusieurs lignes parallèles**, avec une correction physique
qui change le compte. Une jonction (té 25×25×25) ressemble à un té : on doit
couper le tuyau pour l'insérer. Ça vaut à chaque rangée où le tronc continue
vers la suivante — mais PAS à la dernière rangée, où le tronc s'arrête : le
tuyau s'y courbe directement, sans pièce à couper. Pour un secteur de `ny`
rangées, c'est donc `ny − 1` jonctions, jamais `ny`.

`listeMateriel()` (`appli/arrosage.html`) calcule maintenant les quatre pièces
du réseau latéral par secteur, à partir de `ny` et `nombre` que `poser()`
connaît déjà : `nombre − ny` tés de ligne, `ny` coudes de fin, `ny − 1`
jonctions. Elles ne sont plus écartées de la liste au fournisseur — même
geste que pour le SBE du bas et le PEBD16, comptés sans attendre au lot
précédent. Le dessin lui-même a été corrigé pour porter la même règle
(jonction sur les rangées où le tronc continue, coude sans pièce à la
dernière), sinon il aurait fini par contredire le calcul qu'il a motivé.

Vérifié sur le jardin d'exemple (18×12 m, quinconce) : 8 tés, 3 coudes,
2 jonctions pour 11 arroseurs sur 3 rangées. `essai-arrosage-detaille.cjs`
(32/32) et `tests/e2e.js` (90/90) au vert.

### La nourrice se modifie quand une voie part en goutte-à-goutte

Sa règle, envoyée juste après le réseau latéral : *« lorsqu'un réseau est
pour du goutte-à-goutte, quelques modifications s'appliquent […] tout le
reste ne doit pas être modifié, que ce soit pour une voie ou six ».* Par voie
concernée : l'électrovanne 100 DV 1" MM standard cède la place à une
électrovanne 100 DV 1" FF, plus un régulateur de pression FF 3/4", plus deux
mamelons réduits MM 1"-3/4" et un mamelon fileté MM 1".

`CATALOGUE.ficheNourrice(n, combienGoutte)` overlaye cette bascule sur une
fiche de base sans y toucher : elle réduit l'électrovanne MM du nombre de
voies concernées, ajoute les pièces FF, puis fusionne les lignes de même
référence avant de rendre le résultat. `appli/arrosage.html` compte les voies
goutte-à-goutte du jardin (`combienGoutteAGoutte`) et passe désormais partout
par cette fonction plutôt que par `CATALOGUE.nourrices[n]` directement — la
liste au fournisseur, le panneau nourrice, et le texte envoyé aux
fournisseurs lisent tous la même fiche modifiée.

**Piège trouvé avant publication, pas après :** la première version ajoutait
le mamelon réduit de la bascule à CÔTÉ de celui déjà présent dans la fiche de
base, au lieu de les additionner — la liste affichait deux lignes « 2 u
Mamelon réduit » plutôt qu'une ligne « 4 u ». Corrigé par une fusion par
référence en sortie de `ficheNourrice`. Vérifié en construisant un jardin à 4
voies (3 arroseurs + 1 massif goutte-à-goutte) : l'électrovanne MM standard
passe de 4 à 3, une électrovanne FF et un régulateur FF apparaissent, les
mamelons réduits s'affichent en une seule ligne à 4. Les suites
`essai-arrosage-detaille.cjs` (32/32) et `tests/e2e.js` (90/90) restent au
vert.

### Le réseau latéral, et un SBE qui manquait à chaque arroseur

**Sa planche manuscrite** couvre pour la première fois la tuyauterie ENTRE les
arroseurs d'un même secteur — tout ce qui avait été enregistré jusqu'ici
portait sur un arroseur isolé (buse, corps, coude), jamais sur la ligne qui
les relie depuis le regard.

Trois positions le long d'une ligne PE25, sa règle : DÉPART et MILIEU portent
le même té (90° taraudé 25×3/4"×25, puisque le tuyau continue) ; FIN porte un
coude (rien ne continue après). Une quatrième pièce, JONCTION, sert quand le
tuyau tourne sans alimenter d'arroseur à cet endroit — un té non taraudé.

**Ce qui a immédiatement corrigé la liste, sans attendre le reste :** chaque
arroseur porte en réalité DEUX raccords SBE, pas un — celui du bas (toujours
3/4", sur le raccord de tuyauterie) et celui du haut (au diamètre du corps,
déjà compté depuis les coudes SBE). Le SBE du bas ne dépend d'aucun tracé de
tuyau : chaque position en porte un, qu'elle soit départ, milieu ou fin. Il
est compté. Et « environ 2 m de PEBD rigide Ø16 » par arroseur, comme donné.

**Ce qui reste délibérément hors du calcul : les tés, les coudes et les
jonctions.** Combien il en faut pour un secteur dépend de l'ORDRE dans lequel
le tuyau relie les arroseurs — un secteur en grille de plusieurs rangées peut
se piquer d'une seule ligne serpentine ou de plusieurs lignes parallèles, et
rien dans l'outil ne sait aujourd'hui répondre à cette question. Les compter
sans savoir aurait inventé un tracé. Les trois pièces restent au catalogue,
visibles dans son registre de prix, écartées de la liste — même geste que
pour les R-VAN et les turbines avant elles.

### Les six fiches de nourrice, de une à six voies

**Sa consigne :** *« voici toutes les pièces pour la nourrice — ce qui se
trouve dans le regard d'arrosage. »* Six fiches complètes, une par nombre de
voies : clarinettes Dura, coudes, unions, électrovannes Rain Bird 100 DV,
regards (rectangle 12", jumbo RG17106, jumbo 5 et 6 voies), programmateurs
BL-IP, connexions étanches.

**Un catalogue de pièces dédupliqué porte chaque référence une seule fois** —
l'électrovanne 100 DV revient dans les six fiches ; la retaper six fois aurait
fini par diverger d'une virgule, et l'écart se serait vu exactement là où il
compare deux fiches. Chaque fiche référence donc les pièces par un code
plutôt que de recopier leur nom.

**Elles remplacent les lignes génériques au lieu de s'y ajouter.**
« Électrovannes 24 V », « Regards de vannes » et « Programmateur X voies » —
des espaces réservés depuis le premier jour — disparaissent dès qu'une fiche
existe pour le nombre de secteurs, remplacés par ses vraies références. Elles
entrent aussi dans le registre de prix, pour qu'il puisse chiffrer chaque
pièce du regard, pas seulement les arroseurs.

**La redite dans sa fiche 6 voies est confirmée, le même jour :** *« oui c'est
voulu, c'est comme ça que se constitue une nourrice 6 voies. »* Relevée telle
quelle d'abord, sans la corriger, puis confirmée plutôt que devinée.

### Les coudes SBE remplacent une pièce qui n'avait jamais existé

**Sa consigne, photo à l'appui :** *« sous les arroseurs il faut
obligatoirement des coudes SBE, choisis-les en fonction des diamètres, un à
chaque fois par arroseur. »*

La liste au fournisseur portait depuis le premier jour une ligne « Crosse de
raccordement » — un nom inventé, jamais raccordé à une référence réelle,
justement provisoire. Elle disparaît, remplacée par les deux vraies pièces :
OD501 (SBE 050, 16×1/2") et OD502 (SBE 075, 16×3/4").

**Le choix n'est pas laissé au hasard : il suit le taraudage du corps posé.**
Chaque corps du catalogue porte désormais son filetage — 1/2" pour les corps
de tuyère et les petites turbines (3504, SRM-04, PGJ, Mini 8), 3/4" pour les
grosses (PGP-ADJ, PGP Ultra, I 20-04, 5000 Plus) — relevé sur les descriptifs
des photos, pas deviné. Sans corps enregistré pour la marque courante, aucun
coude n'est compté : mieux vaut manquer que se tromper de diamètre.

### Le quinconce déplaçait les arroseurs sans jamais en retirer un

**Son constat, capture cerclée en rouge à l'appui :** *« sur le plan tu t'es
trompé, tu as mis un arroseur en trop. »* Il avait raison — et l'a trouvé en
regardant l'écran, pas en relisant du code.

Le quinconce se contentait de DÉPLACER les arroseurs de la rangée intérieure
d'un demi-écart, sans jamais en retirer : même compte qu'une grille carrée
(nx × ny), juste décalé. Résultat visible sur la capture : deux têtes
entassées d'un côté du rectangle, un vide de l'autre — parce que le point
décalé s'approchait trop de la colonne voisine tandis que l'écart s'ouvrait
de l'autre côté, largement au-delà de sa limite.

Le vrai principe du quinconce, c'est qu'une rangée décalée porte **UN
ARROSEUR DE MOINS** que la rangée alignée, posé exactement entre chaque paire
de ses voisins — c'est ce qui le rend plus économe qu'une grille carrée, pas
seulement plus joli. Sur le jardin d'exemple (18×12 m, buse 18-VAN) : 12 têtes
deviennent 11, sans rien perdre de la couverture.

**Le plan et le calcul partageaient chacun leur propre version du placement**
— exactement l'écart que le §3 du dépôt met en garde contre (« deux
implémentations finissent toujours par diverger »). Les deux passent
maintenant par une seule fonction, `pointsDeLaPose`, qui produit LA liste de
positions ; `poser()` en tire ses comptes (coins/bords/intérieur, débit), et
`dessinerPlans()` la reprend telle quelle pour le SVG. Ils ne peuvent plus
raconter deux histoires différentes.

**Le contrôle qui l'aurait vu avant lui** vérifie maintenant que le plan
dessine EXACTEMENT le nombre de têtes que le calcul a compté, et que le
quinconce en retire une par rapport à la grille carrée. Confronté au défaut
d'origine (rangée décalée sans retrait de point) : trois rouges, dont un qui
lit directement le compte de têtes dans le SVG — pas seulement le texte.

### Six familles de turbines entrées, aucune posée automatiquement

Six photos supplémentaires : Hunter PGP-ADJ, PGP Ultra, I 20-04 Ultra ; Rain
Bird 5000 Plus, 3504 ; Hunter SRM-04, PGJ ; Toro Mini 8. Corps et buses,
transcrits sans prix.

**Le trou est partout le même : une seule valeur de débit par numéro de buse,
aucune répartition par angle.** Les tuyères VAN donnaient 90°/180°/270°/360° ;
ces tableaux de turbines n'en donnent qu'une, à une pression de référence.
Une turbine balaie l'arc avec un seul filet — son débit est peut-être
proportionnel à l'arc réglé, ce qui autoriserait à déduire les valeurs de
coin et de bord, mais c'est précisément le genre de déduction que sa règle du
17 août interdit tant qu'elle n'est pas confirmée. Les valeurs sont donc
entrées en `debit:{360: …}` seulement, et le garde-fou posé la veille pour les
R-VAN (`busesDe` exige les trois angles sur une même référence) les écarte
automatiquement du calcul — visibles dans le registre de prix, écartées de la
pose. La question lui est posée plutôt que devinée.

### Le corps par défaut, choisi par lui — et un sélecteur qu'un montage partiel avait cassé

**Sa réponse :** *« 10 cm sans option, mais proposer à chaque fois les autres en
expliquant ce qu'il apporte — l'utilisateur décidera. »* Un sélecteur dédié,
une phrase par option (hauteur : à quoi elle convient ; clapet anti-vidange :
utile sur une pente ; régulateur : utile si la pression varie), le défaut posé
sur le 10 cm sans option, réversible d'un choix.

**Ce que ça a révélé en cours d'écriture, et qui vaut d'être noté : une édition
en trois scripts a échoué au milieu, et un seul des trois a persisté.** Le
premier posait le marquage HTML, l'initialisation d'état et l'affichage ; il a
buté sur une hypothèse de texte fausse et n'a **rien écrit du tout** — un
script Python n'enregistre qu'à la fin, une assertion qui échoue au milieu
laisse le fichier intact. Un deuxième script, plus tard, a corrigé un point
voisin avec succès et **a été confondu avec une réussite complète**. Résultat :
le code référençait un `<select id="corps">` qui n'existait pas dans la page,
et la page entière plantait au chargement — *aucune* zone ne s'affichait, une
panne bien plus grave que le défaut visé. Retrouvé en ouvrant la page pour de
vrai, pas en relisant le diff.

**Un contrôle le tient désormais, dans la batterie qui garde le site publié** :
un corps sélectionné par défaut, le 10 cm sans option précisément, et
l'explication qui l'accompagne. C'est le contrôle qui aurait dit non avant
publication.
### CODÉ : « Adresse non renseignée » ouvre l'écran du chantier

Sa demande, puis sa correction : *« que ça m'amène sur la page que je t'ai
envoyée sur la deuxième photo. Rien de plus, rien de moins. »*

| | |
|---|---|
| **La cible** | la mention seule — le nom du chantier garde sa reprise du 13 août |
| **L'arrivée** | l'écran de création, prérempli. Aucun écran nouveau |
| **Ce qui change** | deux mots qui mentiraient : « Nouveau » et « Créer le chantier » |
| **Le nom du chantier** | se recalcule — sans quoi la ligne dirait « Chantier du … » pour toujours |

**La leçon, et elle a coûté deux allers-retours :** devant une demande qui touche
à un écran, chercher d'abord si l'écran existe. Une première planche avait
dessiné une fiche client de toutes pièces ; sa seconde photo montrait la
destination. Un manque réel du produit — il n'y a effectivement pas de fiche
client — n'autorise pas à le combler dans le lot d'à côté.

**Sixième défaut trouvé sur une capture et par aucun test :** le trait pointillé
de la mention se posait au bas de la cible de 34 px, à dix pixels sous le mot.
`ARCHITECTURE.md` §124.

### Les corps d'arroseur, Hunter, et une buse qui se vend en deux morceaux

**Cinq photos** : les corps Rain Bird 1800 (« livrée sans buse » — exactement ce
qui manquait), les corps Hunter Pro-Spray/I-Spray, les buses Hunter SRS, les
buses Rain Bird R-VAN, et les MP Rotator (prix et références seulement).

**Hunter devient une marque active**, pas une ligne vide : ses cinq buses SRS
(7A à 17A) sont entrées, même forme que les VAN — une référence, tous les
angles.

**Ce que les corps apportent — et ce qu'ils n'apportent pas encore.** Quatre
hauteurs d'escamotage (5/10/15/30 cm), trois niveaux d'option (rien, clapet
anti-vidange SAM, régulateur de pression PRS). Ils entrent dans le catalogue et
dans son registre de prix ; **aucun n'est encore choisi automatiquement** dans
la liste au fournisseur — quatre hauteurs et trois options, c'est un choix de
chantier, pas une valeur à deviner.

**Et une vraie découverte de structure : les R-VAN se vendent en DEUX
références par taille, pas une.** Les VAN (première page) tiennent en une seule
référence réglable de 90° à 360°. Les R-VAN sont deux produits physiques
différents — une version réglable 45°-270° qui n'atteint jamais le 360°, une
version fixe 360° qui ne fait rien d'autre. Une buse sans 360° ne peut pas
couvrir l'intérieur d'une pelouse ; une buse sans 90°/180° ne peut pas se poser
en coin ou en bord. **Le calcul ne choisit donc ni l'une ni l'autre seule** —
`busesDe()` exige désormais les trois angles sur une même référence — et les
deux restent visibles dans le registre de prix sans être posées automatiquement.

**Le bug qui a précédé ce garde-fou, et pourquoi il fallait le voir tourner
faux avant de le corriger.** Une première version du filtre ne vérifiait que
90°/180°, pas 360°. Elle laissait passer la R-VAN réglable seule, qui n'a pas de
débit à 360° : le calcul de l'intérieur d'une pelouse divisait par une valeur
absente, deux secteurs sortaient au lieu de dix, et l'écran affichait « Mesures
à compléter » à la place d'un plan. Confronté à l'ancien filtre (90°/180° sans
360°) : cinq contrôles rouges, retombés à zéro une fois le troisième angle
exigé.

**Deux familles vues et volontairement PAS entrées.** Les buses « bande »
(SST, RCS, LCS…) arrosent un rectangle, pas un cercle — tout le calcul de
cette page suppose des couronnes, et les compter comme un arroseur rond
donnerait une couverture fausse. Les MP Rotator n'avaient ni portée ni débit
sur la photo, seulement une référence et un prix — sans ces deux nombres, une
entrée calculerait faux plutôt que de manquer honnêtement.

### Sa règle de pose, enfin la sienne — et l'outil faisait l'exact contraire

**Ses mots, au formulaire :** *« 80 % minimum entre chaque arroseur. Donc portée
5 m : distance entre chaque arroseur ~5,50 m, 6 m max, 5 m étant la perfection.
Jamais moins. En dessous de 5 m, 4 m, 3 m : JAMAIS. »*

L'outil posait un arroseur tous les **0,8 × la portée** — soit 4 m pour une
portée de 5. Précisément le cas qu'il écrit en majuscules. Le recouvrement se
mesure sur l'ÉCART, pas sur la portée : écart ≤ portée / 0,80, et jamais sous la
portée. Un arroseur de trop tous les quatre mètres, c'est un secteur de plus, un
devis plus cher, et un client qui compare.

**Et cette règle en a révélé une autre, plus profonde : le choix de buse doit
OBÉIR à la pose, pas être rattrapé après coup.** Une turbine de 9 m ne pave pas
une pelouse de 12 m de large — deux rangées font 12 m d'écart (trop), trois en
font 6 (trop peu). L'outil affichait alors « buse trop grande » **sur toutes les
zones**, y compris celles qui allaient bien. Il prend désormais, de la plus
grande à la plus petite, la première buse qui pave les deux côtés selon sa règle.
L'alerte ne parle plus que des zones réellement impossibles.

**Le quinconce se DESSINE.** Sa règle : quinconce au-delà de quatre arroseurs,
« et les derniers arroseurs doivent toujours être dans les coins ». Le pourtour
reste régulier, seules les rangées intérieures se décalent d'un demi-écart. Une
première version se contentait d'écrire « en quinconce » sous une grille carrée
— un plan qui ment, et que personne n'aurait vérifié.

**Le goutte-à-goutte prend ses mesures à lui :** lignes tous les 80 cm dans les
massifs, 70 cm au potager, et pour une haie **la question est posée** — une ligne
ou deux, c'est l'utilisateur qui tranche. Conséquence : un massif se saisit
désormais en longueur × largeur, plus en mètres de gaine. Demander des mètres de
gaine à quelqu'un « qui ne connaît rien en arrosage » revenait à lui faire faire
le calcul qu'on lui promettait.

**Le point d'eau demande d'où l'on se repique.** Sa règle : juste après le
compteur, la ville délivre au moins 3 bar et c'est du sûr ; ailleurs, **il faut
lui expliquer quoi faire** — seau gradué pour le débit, manomètre à cinq euros
pour la pression. Une question sans marche à suivre renvoie l'utilisateur à son
ignorance.

**Confirmé sans changement :** 85 % du débit par secteur, jamais de mélange de
pluviométries ni de familles, et aucune correction de pression à faire (« à
2 bar ou 3 bar c'est quasiment les mêmes valeurs »).

### Atlas propose de retenir les mots qu'il entend — et ne les écrit jamais tout seul

**Sa question, une heure après le lot ci-dessous :** *« ça veut dire que le
document s'autoalimente à chaque fois qu'on rajoute un nouveau mot dans un devis
et qu'il comprend ce que c'est ? »*. C'était non ; il a répondu « fais-le ».

**Sa condition est dans sa phrase, et c'est elle qui rend le mécanisme
honnête** : un mot inconnu n'est proposé que si la ligne qu'il a RETENUE sur son
devis est reconnue par le catalogue. Sans cela, on proposerait de retenir un mot
dont personne ne sait ce qu'il désigne — c'est-à-dire d'inventer une donnée.

**Atlas propose, deux boutons, et le « non » est définitif** (migration 0053).
Une proposition qui revient après un refus n'est plus une proposition : le mot
écarté reste en base, marqué, invisible et introuvable. **Il peut toutefois
changer d'avis** — écrire le mot à la main le relève, sans quoi l'index unique
le refuserait en silence et rien ne lui dirait que c'est son propre « non » qui
le bloque.

**La liste des mots ordinaires est relevée de ses vraies dictées**, jamais d'un
dictionnaire : *« il FAUDRA écimer le GRAND tilleul du FOND »* proposait trois
mots pour un seul qui apprend quelque chose.

**Le vocabulaire d'Atlas, lui, ne s'alimentera jamais tout seul** — il appartient
à toutes les entreprises. Tout ce qui est retenu entre dans SES mots.

**Deux pièges payés en écrivant les contrôles, et tous deux du côté du
contrôle :**

- une suite navigateur cherchait « Atlas a entendu ces mots » dans la page,
  alors que la charte met ce titre en CAPITALES et qu'`innerText` rend le texte
  **transformé** : elle accusait le produit d'un tort qui était le sien. C'est le
  message d'erreur, enrichi de ce que l'écran disait vraiment, qui l'a montré ;
- un mot d'essai horodaté (`motessai1786…`) n'arrivait jamais à l'écran : les
  chiffres sont retirés des dictées avant rapprochement — un nombre n'apprend
  aucun vocabulaire.


### Sa première page de catalogue entre dans la base — et le registre de SES prix

**Sa photo :** catalogue Aqua Plus 2026, page 8, buses série VAN à secteur
réglable (RBT648 à RBT640). *« Ça c'est les buses qui vont venir se visser sur
les tuyères. Donc là tu as toutes les buses avec les distances, les pressions,
tout. »* Les sept sont entrées, avec leur source et la page d'où elles viennent.

**Trois choses que cette page corrige dans le calcul, et aucune n'est cosmétique :**

| Ce qui était supposé | Ce que le catalogue dit |
|---|---|
| Un arroseur est un produit | C'est un **corps + une buse** : la portée et le débit viennent de la buse. Les corps manquent encore, et l'écran le dit |
| Le débit d'un quart de tour = le quart du tour complet | **Faux sur les petites buses** : la 6-VAN donne 0,27 m³/h à 360° quand quatre fois son 90° ferait 0,32. Les valeurs sont désormais **lues**, jamais déduites |
| Portées données à 3 bars | **2 bars** sur cette page. Une portée relevée à 2 bars sur une installation à 3, ce n'est pas la même |

**Le colisage de 25 est repris dans la liste au fournisseur** : il commande par
paquets, et l'apprendre à la commande est un aller-retour de trop.

**AUCUN PRIX N'A ÉTÉ ENREGISTRÉ, et c'est sa consigne :** *« sur certaines
photos tu auras les prix, néanmoins ne les enregistre pas, car c'est des prix
pour les clients et pas pour les pros »*. Un P.U.H.T. figurait sur la page ; il
n'est recopié nulle part — **pas même en commentaire**. La première rédaction le
citait « pour mémoire » en affirmant ne pas l'enregistrer : une contradiction
retirée avant le commit.

**`appli/arrosage-tarifs.html` — le registre qu'il a demandé.** *« Une fiche
avec tous les produits, à côté une petite case pour le prix […] et à terme tu
seras capable de lui sortir les fournitures, le plan, et donc le total avec ses
prix pro. »* Ses prix vivent dans son navigateur, le plan les reprend, et **une
case vide reste vide** : le total dit combien de lignes lui manquent au lieu
d'afficher un chiffre auquel on se fierait.

**Pourquoi ses prix ne sont PAS dans le catalogue** : un tarif imprimé est
public, le sien est négocié et change d'une agence à l'autre. Les mélanger
finirait par chiffrer un devis au prix public — l'erreur la plus chère que cet
outil puisse commettre, parce qu'elle ne se voit pas : le total reste plausible.

**Et trois contrôles qui ne savaient pas échouer ont été durcis.** Confrontés
aux dégradations qu'ils prétendaient détecter, les trois passaient au vert : un
prix de catalogue glissé dans une fiche produit, un total qui comblait ses
lignes manquantes à 10 € pièce, et les débits d'arc redéduits par division. Ils
vérifient maintenant des **nombres** — 37,20 € au centime, 1,64 m³/h sur une
zone assez petite pour retenir la 6-VAN — et non des tournures de phrase. Un
contrôle posé sur la 18-VAN n'aurait rien vu : cette buse-là est exactement
linéaire.
### Le catalogue s'écrit enfin : ses mots à lui, par-dessus celui de tout le monde

**Codé le jour même de la planche, sur son « là c'est la B ».** L'écran
« Catalogue » se lisait sans pouvoir s'écrire, et il l'a signalé deux fois en
trois jours. Il porte désormais SES mots, en or, accrochés aux entrées d'Atlas.

**La table `mots_catalogue` (migration 0052) existe parce que le catalogue est
PARTAGÉ.** `catalogue_prestations` n'a pas de colonne d'entreprise et pas de
RLS : une ligne écrite depuis son téléphone changerait le vocabulaire de tous
les autres artisans. Ses mots vivent donc à part, isolés comme le reste de ses
données, et se superposent au commun à la lecture.

**Ce qui compte le plus dans ce lot ne se voit pas à l'écran : un mot visible
est un mot RECONNU.** Un mot ajouté et ignoré par la recherche aurait donné le
pire des deux mondes — il aurait cru apprendre quelque chose à Atlas pendant que
la dictée continuait de ne rien comprendre, sans un message pour le détromper.
Les quatre chemins de recherche passent donc par la même fonction : les deux
outils de l'agent, celui des synonymes, et le service de chiffrage. La suite
base rougit précisément là si on les débranche.

**Le mot se pose court, et le champ le dit** (« Comme vous le dites : "écime" ») :
le rapprochement se fait par inclusion, comme pour le vocabulaire commun —
« écime » attrape « écime-moi le tilleul », « écimage » ne l'attrape pas. Deux
règles de rapprochement auraient fini par diverger.

**Trois défauts de ses captures réparés dans le même lot :** la flèche de retour
existe enfin ; « Aucun prix encore constaté par votre entreprise » disparaît —
elle lisait une mémoire que l'application n'écrit nulle part, et ne se serait
jamais éteinte ; « Synonymes » et « Variantes » deviennent « Aussi appelé ».
L'écran est passé à la charte au passage : il portait encore l'échelle de
juillet.

**Un geste qui n'était PAS sur la planche a été ajouté : retirer un de ses
mots.** Sans lui, un mot mal tapé restait pour toujours et faussait la dictée
sans recours. Rien n'atteint le vocabulaire commun.

**Ce que ce lot ne fait pas, et qu'il a demandé :** rien ne s'alimente tout
seul. Un mot compris dans un devis ne s'ajoute nulle part — ni au commun, ni
chez lui. `ARCHITECTURE.md` §122 dit ce qu'il faudrait pour le faire, si la
décision est prise.

Éprouvé par `scripts/test-mots-catalogue.ts` (isolation, refus rendus,
recherche, catalogue partagé intact) et `scripts/test-catalogue-mes-mots-e2e.ts`
(le geste, le rechargement, le retrait, la flèche).

### Le catalogue : une planche pour y écrire enfin, et les deux défauts du 14 août réparés dessus

**Il a posé la même question deux fois, et c'est le vrai signal.** Le 17 août,
capture de l'écran « Catalogue » à l'appui : *« À quoi sert cette page ?? On
peut rien modifier rajouter »*. La réponse existait déjà — `docs/QUESTIONS.md`
§18, écrite le 14 août, après la même capture. Un écran qu'il faut expliquer
deux fois n'est pas mal compris : il ne dit pas ce qu'il fait.

Sa réponse, cette fois : **« Réparer + mes mots »**. La planche
`docs/maquettes/72-mes-mots-au-catalogue.html` est posée, **rien n'est codé**
(`CLAUDE.md` §3 bis) — il désigne un arrangement.

**Ce que la planche tranche, et qui n'est pas une question de goût.** Le
catalogue est **commun à toutes les entreprises** : où vivent *ses* mots à lui
décide de ce que la dictée comprendra ensuite. Ses mots à part (A) laissent
« écimage » à côté d'« Élagage » — et une dictée « écime-moi le tilleul »
créerait une prestation neuve au lieu de reconnaître l'élagage déjà chiffrable.
Par-dessus (B), ils s'accrochent à l'entrée commune. Tout mélangé (C), il ne
sait plus ce qui est à lui, et l'application refuse au moment du geste.

**Les deux défauts de sa capture du 14 août sont réparés dans la planche**
(`TODO.md` §0 octovicies bis, en attente depuis) : la flèche de retour revient
dans les trois arrangements, et « Aucun prix encore constaté par votre
entreprise » disparaît — cette phrase interrogeait `historique_prix`, la mémoire
que l'application n'écrit nulle part, et ne se serait donc **jamais** éteinte.
Aucun montant ne la remplace tant que le rapprochement n'est pas décidé : la
mémoire vivante (`lecons_prix`) range par nature de chantier, pas par mot de
catalogue, et afficher un prix d'abattage sous « Élagage » serait pire que la
phrase d'hier — qui au moins n'inventait rien. La question est posée en bas de
la planche.

Au passage, le jargon s'en va : « Synonymes » et « Variantes » disaient la même
chose sur sa capture, ils deviennent « Aussi appelé ».

**Le contrôle sait échouer, et il nomme le coupable**
(`scripts/verifier-maquette-mes-mots.mjs`) : éprouvé sur quatre copies
dégradées — flèche retirée, phrase morte remise, bouton d'ajout retiré, marque
dorée retirée de B —, chacune rougit sur son propre défaut. Et il refuse de
conclure sur une boîte de zéro pixel (`CLAUDE.md` §5, payé le 15 août).

**Un défaut trouvé en chemin :** le sommaire des maquettes ne fermait pas le
lien de la 66, et la 67 se retrouvait imbriquée dedans.

### Le choix de la marque : Rain Bird par défaut, et rien d'attribué sans preuve

**Sa demande :** *« l'utilisateur pourra également choisir entre les marques.
De base on va mettre les arroseurs et les tuyères de la marque Rain Bird, mais
s'il veut, il faudra créer un petit bandeau déroulant avec le choix de la marque
Toro par exemple, et dans ce cas-là tu lui proposeras des arroseurs et des
tuyères de la marque Toro. Mais de base, ça sera Rain Bird. »*

Le bandeau existe, Rain Bird est le défaut, et `CATALOGUE.marques` s'allonge
d'une ligne par marque — sans toucher au code.

**Ce qui aurait été facile et qui est refusé : coller les valeurs génériques
sous le nom de Rain Bird.** Elles viennent de catalogues courants, pas de ses
photos. L'écran choisit donc Rain Bird, **constate qu'il n'a aucun modèle et le
dit** — dans le bandeau, puis **sur chaque zone** (« modèle générique, pas
encore Rain Bird »). Le repli sur le générique est délibérément bruyant : un
repli muet ferait croire la marque renseignée, et c'est le paysagiste qui
commanderait la mauvaise référence.

**Une conséquence de structure, pas de goût :** une zone retient un TYPE
(turbine ou tuyère), pas une référence. Sans quoi une bascule de Rain Bird vers
Toro viderait ses zones du matériel qu'elles portaient. La liste au fournisseur,
elle, compte par **référence** et porte la marque en tête — c'est elle qui part
en commande.

### Le catalogue d'arrosage attend SES données — et l'écran dit ce qui manque

**Son constat, une fois la page essayée :** *« plusieurs choses sont fausses »*.
Elles l'étaient : les portées, débits et pluviométries venaient de catalogues
génériques, pas de son matériel. Sa suite : *« je vais t'envoyer des photos avec
certains arroseurs, leur portée, et ça tu vas l'intégrer dans une base de
données pour cet outil […] et on va également faire ça pour tout le matériel »*.

**`appli/arrosage-catalogue.js`** est cette base. Chaque entrée porte une
**source** — `'patron'` ou `'provisoire'` — et l'écran affiche le compte de ce
qui attend encore ses photos (onze au 17 août). C'est le §4 du dépôt appliqué au
matériel : une donnée sans source fiable est signalée, jamais présentée comme
acquise. Une portée qu'on croit juste et qui ne l'est pas fait acheter le mauvais
nombre d'arroseurs, et c'est lui qui revient poser les manquants.

**Les nourrices : une fiche, ou rien.** Sa seconde demande — *« pour réaliser une
nourrice de une voie, on utilise ça, ça, ça […] et comme ça quand par tes calculs
tu verras qu'on a besoin d'une voie, tu reprendras toute cette fiche »*. Le
calcul donne le nombre de voies, la fiche donne les pièces. `CATALOGUE.nourrices`
est **vide et volontairement vide** : tant qu'une fiche manque, l'écran l'annonce
au lieu d'en composer une. Une nourrice inventée, c'est un chantier arrêté à la
pose faute d'un té.

**Le recouvrement de 80 %, et ce qu'il a immédiatement révélé.** Sa règle : « il
faut un recouvrement d'au moins quatre-vingt pour cent ». Lue comme *écart entre
deux arroseurs = 80 % de la portée*, et **la lecture est affichée en mètres**
(« portée 9 m → un tous les 7,20 m ») plutôt que cachée dans le calcul : c'est
ainsi qu'il corrigera d'un mot si ce n'est pas sa pose. Le jardin d'exemple passe
de 8 à **9 secteurs**, au-dessus des six voies dont il prévoit les fiches — signe
que les valeurs génériques sont trop faibles, et que son catalogue changera ce
nombre. Dit plutôt que tu.

### La maquette d'arrosage devient ESSAYABLE, et la sortie n'est plus un devis

**Ses trois consignes du 17 août, dans l'ordre où elles sont venues :**

1. *« des maquettes dynamiques en .html que je puisse essayer, pas de photo »* ;
2. *« je veux que tu code rien »* ;
3. *« il faut simplement créer le plan et la liste du matos à acheter, ensuite
   moi j'envoie à mes fournisseurs, ils me font un devis, puis je repasse par le
   circuit normal de l'application pour rédiger le devis et l'envoyer à mes
   clients ».*

**`appli/arrosage.html` — la page qui calcule pour de bon.** On entre son point
d'eau, ses zones et leurs mesures ; le découpage en secteurs, les durées par
saison, le plan et la liste du matériel se refont à chaque frappe. Rien ne sort
du téléphone, ce qui est saisi survit à un rechargement.

**Pourquoi dans `appli/` et pas dans `docs/maquettes/`.** Les planches y sont
volontairement sans JavaScript — son lecteur n'en exécute pas, et une page bâtie
en JS lui arriverait vide. Or il demande à ESSAYER. `appli/` est le seul dossier
du dépôt qui soit **publié** (`pages.yml`), donc le seul endroit où la page
s'ouvre dans un vrai navigateur, au téléphone, avec le calcul qui tourne.

**Sa troisième consigne retire tout prix, et c'est un allègement, pas un
manque.** La planche 71 ne produit plus un devis chiffré mais une **liste de
quantités** qui part chez Chausson ou Aqua Plus. Le devis client se rédige
après, dans Atlas, avec les prix que le fournisseur aura rendus — le circuit
existe déjà, il n'y a rien à réinventer. Un contrôle refuse désormais tout
montant en euros sur la page.

**Ce que l'essai a appris tout seul, et qu'aucune planche ne disait :** laissé
sur « au mieux », le choix d'arroseur met des turbines sur les deux pelouses et
le jardin tombe de **huit secteurs à quatre** — moins d'électrovannes, un cycle
plus court. Le jardin de départ garde donc les tuyères des planches, pour que
la bascule se voie en direct.

**Défaut vu à l'écran, et par rien d'autre :** sur un téléphone, « Pression
(bar) » passe à la ligne et sa case descendait toute seule pendant que les deux
voisines restaient en haut. Les champs s'alignent maintenant sur leur bas.

**La page est gardée par la batterie qui publie le site** (`appli/tests/e2e.js`,
jouée avant chaque déploiement puis **contre le site en ligne**) : aucune erreur
au chargement, aucun secteur au-dessus du débit du robinet, le cycle qui est la
somme de ses secteurs, aucun prix, rien qui déborde à 390 px. Confrontée à trois
pages dégradées : trois rouges, chacun nommant le bon coupable.

**Ce qui a été demandé et ne peut pas se faire ici :** aller chercher les prix
sur les sites de Chausson et d'Aqua Plus. Les deux domaines sont **refusés par
le mandataire réseau** de cet environnement — vérifié, pas supposé. Et même
joignables, ils n'afficheraient que des prix publics, pas les siens. La bonne
voie existe déjà : Chausson laisse **télécharger son tarif négocié en Excel ou
CSV** depuis son compte, et Atlas sait déjà importer un tarif Excel/CSV
(`src/app/reglages/ImportTarifs.tsx`).

### Le plan d'arrosage automatique des paysagistes — TROIS PLANCHES, RIEN N'EST CODÉ

**Sa demande du 17 août :** *« j'ai besoin qu'on crée un outil pour les
paysagistes pour réaliser des plans d'arrosage automatique. »*

Terrain neuf : rien dans le produit ne parle d'arrosage. Trois planches donc, et
**aucune ligne de `src/`** — sa règle du 11 août.

- `69-le-plan-darrosage.html` — par où il entre son jardin. Trois gestes : la
  feuille où il saisit tout, **les zones qu'il mesure et qu'Atlas pose**
  (recommandé), ou le plan dessiné.
- `70-le-debit-ne-se-partage-pas.html` — le découpage en secteurs. **Rien à y
  choisir** : c'est de l'arithmétique, montrée pour être vérifiée.
- `71-ce-qui-sort-du-plan.html` — le devis, la carte du coffret, le plan remis
  au client. Ce qu'il y a à choisir : par lequel on commence.

**Ce que le métier impose, et qui n'est pas un goût.** Un robinet de pavillon
donne 1,80 m³/h ; le jardin de l'exemple en demande 8,47. D'où huit secteurs, un
cycle de 3 h 14 qui doit finir avant le soleil, et deux règles qui passent avant
le remplissage : **une seule pluviométrie par secteur** (la vanne l'ouvre en
entier, pour la même durée : turbines à 11 mm/h et tuyères à 38 dans le même
secteur, c'est trois fois trop d'eau d'un côté) et **un seul rythme par
secteur**.

**Tous les nombres des trois planches sont CALCULÉS**, pas écrits : cinq mesures
entrent, le reste en découle. Une maquette qui compte faux fait douter de tout ce
qu'elle montre — c'est le piège payé sur la fiche d'entretien (« dix-huit » pour
vingt prestations).

**Et le calcul a rendu un vrai défaut avant même d'être montré.** Le champ
`materiel` (une chaîne) était écrasé par l'objet du catalogue : les deux pelouses
— turbines et tuyères — se retrouvaient dans **le même secteur**, exactement la
faute que la planche 70 explique. La planche s'affichait parfaitement. C'est le
listing du générateur qui l'a dit, et c'est maintenant un cas de contrôle.

**Deux défauts trouvés en REGARDANT la capture, et par rien d'autre** — la
sixième et la septième fois dans ce dépôt : le matériel s'affichait en clé
technique (« tuyere », sans accent) au lieu du mot du métier, et la cote
verticale « 12 m » sortait du cadre du plan pour s'afficher **« 2 m »**. Le texte
était entier dans la page : aucun contrôle de DOM ne pouvait le voir. Le contrôle
compare désormais les **boîtes** — celle de chaque cote contre celle du plan.

**Le contrôle (`scripts/verifier-maquette-arrosage.mjs`) ne vérifie pas du goût,
il vérifie de l'arithmétique** : aucun secteur au-dessus du débit du robinet, le
total qui est bien la somme de ses parts, le cycle qui est la somme des durées,
les trois planches qui parlent du même jardin, et **aucun prix inventé** (règle
du §4 : ce qui n'est pas dans « Mes prix » part vide et signalé). Confronté à
sept planches dégradées : **sept rouges, chacun nommant le bon coupable.**

**Ce qui attend sa décision** : par où il entre son jardin, et par quelle sortie
on commence. Rien ne sera codé avant.

### « C'est monsieur Martins » : un client n'est plus recréé à chaque chantier

Sa demande, le lendemain de la fiche client : *« si je crée un nouveau chantier,
mais que c'est monsieur Martins et qu'on a déjà une fiche client monsieur
Martins, [il faut que] le devis, la facture s'ajoute à la fiche client de
monsieur Martins qui est déjà créé. »*

**Ce que ça répare.** `creerClient` insérait **toujours**. Deux chantiers pour le
même homme faisaient deux fiches, et la fiche client livrée la veille annonçait
« 1 chantier » à vie — juste, mais sans matière.

**Le chemin qu'il a écarté**, et qu'il ne faut pas rouvrir sans lui : qu'on lui
**propose** les clients qui ressemblent. *« Non justement, il ne faut pas »*. Le
rapprochement est automatique.

**Ce qui borne le risque de mélanger deux homonymes** — le seul danger, et il ne
se répare pas d'un clic : **une coordonnée qui contredit interdit le
rapprochement**. Deux « Martins » aux téléphones différents restent deux fiches.
Le nom, lui, se compare sans sa civilité (« Martins » = « M. Martins ») et le
téléphone sur ses chiffres (« +33 6 12… » = « 06.12… »).

**Rien n'est jamais écrasé** : ce qu'il tape complète les cases vides de la fiche
retrouvée, et ne touche pas à ce qu'il avait déjà noté. Un client effacé (RGPD)
n'est jamais réutilisé.

`src/lib/rapprochement-client.ts`, `ARCHITECTURE.md` §122. Éprouvé par
`test-rapprochement-client.ts` (19 cas), `test-rapprochement-client-db.ts`
(8 cas, dont l'isolation entre entreprises) et `test-rapprochement-client-e2e.ts`
(deux chantiers créés au formulaire, « 2 chantiers » sur la fiche). La suite base
rend **quatre échecs** contre l'ancien comportement.

**Ce qui n'existe pas encore :** aucun geste ne permet de dire « ce chantier
n'est pas ce client-là ». Deux homonymes que rien ne distingue sont rapprochés
définitivement (`TODO.md` §0 duoquadragies).

### « Il n'y a aucun moyen de retirer les cinq pour cent » — il avait raison deux fois

Son constat du 17 août, capture à l'appui. Trois choses dans une phrase, et
**deux étaient des défauts**, tenant à la même cause : le prix accordé ne vit pas
sur une ligne du tableau mais sur l'en-tête du devis. Tout ce qui recopie « les
lignes » et rien d'autre l'oublie en silence.

| Ce qui n'allait pas | Ce que ça donnait |
|---|---|
| **À la voix** | « retire-moi les cinq pour cent » était compris, coché, enregistré — puis l'écran gardait l'ancien pourcentage et le **réécrivait en base** au passage suivant dans la case |
| **En écrivant 0** | la base retirait bien la remise, mais l'écran laissait une ligne or « 0 % » sans montant : il affirmait une remise que le PDF n'imprimait pas |

**Pourquoi rien ne l'avait vu.** La suite éprouvait le retrait en **vidant** la
case puis en **rechargeant** la page — deux gestes qu'il ne fait ni l'un ni
l'autre, et le rechargement masquait précisément le défaut puisqu'il repartait
de la base. Le nouveau cas mesure sans rechargement, et il est rouge sans le
correctif.

**Ce qui n'a PAS pu être éprouvé ici :** le raccord dictée → écran. Cet
environnement n'a ni service de transcription ni modèle ; la cause a été trouvée
en lisant le code, et ce raccord ne sera parcouru qu'avec une clé.

### CODÉ : le « petit moins » en face de la ligne — sa proposition B

*« Tout comme on ajoute une ligne avec un petit plus, il faudrait qu'on ait un
petit moins. »* Dessiné d'abord (`docs/maquettes/68-retirer-le-prix-accorde.html`,
trois formes sur **ses** chiffres), choisi le 17 août — **« B »** —, puis codé.

Un rond de 26 px devant le libellé, en or. Un appui : le devis affiche son prix
plein **tout de suite**, et « Annuler » reste six secondes sous la feuille. Rien
n'est écrit avant la fermeture du tiroir — c'est le geste unique de
l'application depuis le 10 août, et le prix accordé passe par le même.

Il ne paraît pas sur un devis parti : cet écran ne se modifie plus.

**Et un contrôle de maquette que personne ne jouait** — `verifier-maquette-reduction.mjs`
existait depuis le 16 août sans être branché nulle part. Raccroché, avec celui
de la 68. Raisons : `ARCHITECTURE.md` §129.

---

## 2026-08-18

### « J'ai encore la version lente » — la construction échouée se retente enfin

**Sa fiche disait tout**, sans qu'il ait rien à recopier : *« Code SERVI :
AUCUNE — la construction a ÉCHOUÉ »*, avec le même refus que l'avant-veille.

**Ce qui était déjà réparé ne suffisait pas.** L'orpheline est délogée, le
verrou est exclusif, une seconde tentative part sur ce refus-là — son espace
portait bien ces trois correctifs. Mais **aucun ne couvre le cas où les deux
tentatives tombent**.

**Le trou :** le veilleur ne relançait le banc que lorsque *rien* ne répondait
sur le port. Or une construction ratée laisse le banc en mode développement, et
ce mode-là répond très bien. Le veilleur se déclarait content, et plus rien ne
retentait — toute la soirée sur la version lente.

**Ce que ça évite désormais :** le veilleur regarde aussi *si la version rapide
est là*. Le témoin d'échec existait déjà et personne ne le lisait. Trois
tentatives espacées de dix minutes, jamais deux constructions à la fois, puis on
se tait et la fiche porte la cause.

**Pourquoi réessayer marche ici :** la cause est passagère — 132 Mo libres au
moment de la panne, sur 8 Go. Dix minutes plus tard, la même construction passe.
Détail et tableau des contrôles : `ARCHITECTURE.md` §131.

## 2026-08-16

### « Quelle est la différence entre planning et équipe ? » — aucune, et c'est réparé

*Sa question, capture des réglages à l'appui.* Les deux rubriques rendaient **le
même bloc** : combien d'équipes partent en même temps, et leurs noms. « Équipe »
avait en plus les absences, arrivées la veille. « Planning » était donc un
doublon complet, et sa promesse — *« horaires, équipes et disponibilités »* — ne
tenait que par le mot du milieu : les horaires ne se règlent pas, et les
disponibilités sont les absences, qui vivent dans l'autre rubrique.

**« Planning » est supprimée des réglages.** Tout est dans « Équipe » : combien
partent en même temps, leurs noms, leurs absences. Une seule porte.

**Ce que ça évite :** ouvrir une rubrique pour y trouver ce qu'on vient de régler
dans l'autre, et se demander laquelle fait foi.

**Aucun contrôle ne pouvait le voir** — les deux écrans étaient corrects chacun de
son côté. C'est une question de sens, posée en ouvrant la rubrique. Détail :
`ARCHITECTURE.md` §129, et la réponse dans sa langue : `docs/QUESTIONS.md` §21.

### La fiche du client : montrer ce que l'application savait déjà

**Sa question, photo d'un « graphe de connaissances » à l'appui :** *« ça peut me
servir pour mon appli ? »* Non, deux fois — le dépôt tient déjà sa mémoire, et
ses données sont déjà reliées dans une base qui répond mieux qu'un graphe.

**Mais il y avait quelque chose dessous, et c'est livré :** l'application SAIT
qu'un client est venu quatre fois, qu'il doit encore 740 €, qu'on lui fait
toujours de l'élagage — et elle ne le montrait **nulle part**. Sa fiche s'ouvre
maintenant depuis le tiroir de n'importe lequel de ses chantiers.

Il a choisi l'arrangement B contre le cinquième onglet, et c'était le bon : « qui
me doit de l'argent ? » a déjà son écran, dans Terminés → TVA.

**Ce que ça évite.** Un client dont rien n'est facturé affiche « — » et une
phrase, jamais « 0 € » : un zéro se lirait comme un mauvais payeur, et il
déciderait sur une phrase fausse.

**⚠ CE QUI LIMITE CETTE FICHE, et ce n'est pas elle :** un client n'est **jamais
réutilisé**. Deux chantiers pour « M. Bernard » créent deux clients, donc sa
fiche dira « 1 chantier » à chaque fois. La réparation est une **décision** —
rapprocher deux clients sur leur nom mélangerait deux homonymes sans retour
possible. Trois chemins sont écrits dans `TODO.md`, à trancher.

Détail : `ARCHITECTURE.md` §121.

### L'écran où vous composez votre fiche d'entretien

**Réglages → Fiche d'entretien.** Vingt prestations rangées par famille, qui
s'ajoutent, se retirent et se renomment — les familles aussi. C'est la planche
`64-composer-sa-fiche.html`, telle qu'elle a été retenue.

**Le retrait se défait**, comme partout depuis le 10 août : la ligne se barre,
« Annuler » la ramène, et **rien n'est écrit tant que le tiroir est ouvert**.
C'est le geste le plus coûteux de cet écran — une croix nue sur une liste
composée à la main —, et c'est celui que la suite navigateur éprouve le plus.

**La fiche vide propose, elle ne pose pas.** Elle montre les vingt prestations
du modèle Atlas AVANT que vous n'appuyiez : vous choisissez en sachant. Rien
n'est écrit en base parce que quelqu'un a ouvert un écran.

**Trois garde-fous du dépôt ont rattrapé trois oublis**, et c'est leur rôle :
l'icône empruntée à une autre rubrique, l'écran absent du préchauffage — donc
lent sur votre banc —, et la rubrique glissée devant « Planning », ce qui
bousculait vos quatre priorités.

Et un défaut qui aurait rendu l'écran blanc : un fichier « use server » ne peut
exporter que des fonctions, or les phrases de refus y étaient posées. Elles
vivent désormais avec les règles pures, ce qui garantit aussi qu'un code de
refus n'ait jamais deux phrases écrites à deux endroits.

---

### « L'apparence ne change pas » — c'était vrai, et aucun cache n'était en cause

*Sa capture, la pastille « Nuit » cochée, l'écran resté crème.*

**Mesuré avant d'être réparé**, en rejouant sa séquence — choisir, puis toucher
les onglets du bas, sans jamais recharger : le fond restait `#f5f3ee` après
l'appui, après « Chantiers », après « Planning », et ne passait à `#101210`
qu'**au rechargement complet**. Le choix partait donc bien en base ; c'est
l'écran qui ne le suivait pas.

**La cause n'était pas un cache.** Les couleurs sont posées par le gabarit
racine, sur `<html>` — et une navigation côté client ne rejoue pas ce gabarit.
L'attribut restait celui du chargement initial, quoi qu'on invalide au serveur.
Ni `revalidatePath` ni `router.refresh()` n'auraient réglé cela.

**Le navigateur repeint donc le même élément**, dès l'appui, avec les mêmes
jetons que le serveur. Le serveur garde son rôle — il pose la charte au premier
rendu, sinon chaque page clignoterait avant de se repeindre. Un refus rend aussi
la couleur d'avant.

**Le contrôle existant était vert sur un chemin qu'il ne prend pas :** il
rechargeait la page entre chaque écran. Le nouveau rejoue **sa séquence à lui**,
et distingue « pas enregistré » de « enregistré mais pas peint ». Détail :
`ARCHITECTURE.md` §119.


### La fiche d'entretien commence à exister : le modèle, en base

**Première pierre du troisième parcours**, après quatre planches et cinq
décisions. Ce lot ne porte que le MODÈLE — un seul par entreprise, comme il l'a
tranché — et rien d'autre : le passage et le rapport viendront ensuite.

Ce qui est posé : la table `prestations_entretien` avec son isolation, le dépôt
qui la lit et l'écrit (tout par `withEntreprise`), le modèle fourni de vingt
prestations relevé de sa capture, et les règles qui ordonnent tout ça.

**Trois décisions de fond, écrites dans le code plutôt que supposées :**

- **une ligne ajoutée se range dans SA famille**, pas au bas de la fiche —
  sinon il la cherche en bas de l'écran, sur un chantier ;
- **les doublons sont refusés avec indulgence** : « Tonte » et « tonte » sont le
  même geste, et deux cases pour un geste donneraient une ligne en double sur le
  rapport du client ;
- **les refus se rendent, ils ne lèvent pas** : une exception d'action serveur
  n'arrive jamais jusqu'à lui.

**Un garde-fou du dépôt a rattrapé un oubli, et c'est exactement son rôle.** La
suite d'export RGPD refuse qu'une table portant un `entreprise_id` reste hors de
la sauvegarde : `prestations_entretien` y est entrée. Sans elle, une sauvegarde
aurait rendu des rapports d'entretien sans dire de quelle fiche ils venaient.

Et un contrôle tient les maquettes et le code d'accord : le modèle du code doit
porter les mêmes vingt prestations que la planche. L'écart se verrait à
l'endroit exact où il compare ce qu'on lui a montré et ce qu'il obtient.

**Ce qui n'est pas encore là** : l'écran des Réglages, le passage, le rapport.

---

### « Vraiment très lente » : une construction orpheline, à chaque démarrage

**Sa plainte du soir**, après une page blanche, une lenteur extrême, puis un
écran qui refusait de changer de page. Une seule cause aux trois.

**Le mécanisme, et il se rejouait à CHAQUE allumage qui récupère du code :**

| | |
|---|---|
| 1 | `demarrer.sh` pose le veilleur **avant** la mise à jour — délibéré, pour qu'une application réponde quoi qu'il arrive ensuite |
| 2 | ce veilleur lance un banc, qui lance une **construction** |
| 3 | la mise à jour aboutit : on tue veilleur et serveur pour les remplacer |
| 4 | le motif tuait `next-server`, `next dev`, `next start` — **pas `next build`** |
| 5 | la construction survit, orpheline, en gardant le verrou du système |
| 6 | le banc suivant bâtit → « Another next build process is already running », code 1 |
| 7 | repli en mode développement : chaque écran se compile à l'ouverture |

**Ce que ça évite :** un banc condamné à la lenteur que trois redémarrages ne
réparent pas — puisque chaque redémarrage reproduisait la panne.

**Le contre-sens qu'il ne faut PAS refaire**, et il est écrit dans `banc.mjs` :
le message de Next parle d'une construction « qui n'est pas sortie proprement »,
ce qui fait croire à un verrou périmé qu'il suffirait d'effacer. **Éprouvé :
faux.** Un fichier `lock` posé à la main n'empêche aucune construction — le
verrou est pris auprès du système et relâché par le noyau. Quand le message
apparaît, une construction tourne pour de bon, et l'effacer en lancerait une
seconde à côté.

**Deux aveuglements corrigés, et ils comptent autant que la panne :**

- le témoin d'échec portait l'heure, le code, le disque et la mémoire — **jamais
  ce que la construction avait DIT**. On a donc cherché une saturation pendant
  des heures alors que le message tenait en une phrase ;
- **la batterie ne bâtissait pas.** Types, lint, mémoire, suites base, suites
  navigateur, connexion réelle — et aucune construction. Une panne qui n'existe
  qu'à la construction traversait les cinquante-huit contrôles au vert, et c'est
  le patron qui la découvrait, un soir, en cliquant. `next build` y entre.

`scripts/test-verrou-construction.ts` tient les sept points, dont celui qui joue
le vrai motif de `pkill` sur les vraies lignes de commande — relire un motif ne
prouve rien, c'est ainsi qu'il est passé inaperçu.

### CODÉ : le rappel « facture impayée », et le premier rappel qui a un rythme

Sa demande, en une phrase : *« faut faire a plus b, mais il faut également qu'on
puisse régler, par exemple, je veux un rappel toutes les semaines ou tous les
quinze jours, mais pas qu'il y ait la notification tous les jours. »*

| | |
|---|---|
| **Quand il paraît** | à l'échéance — envoi **+ le délai de paiement** réglé, ou le jour de l'envoi si aucun délai ne l'est |
| **Ce qu'il montre** | le **reste dû**, avec le total quand un acompte est arrivé |
| **« Plus tard »** | espace le rappel du rythme choisi. Il ne classe rien : la facture reste en attente de paiement |
| **Le rythme** | chaque jour · chaque semaine · tous les 15 jours. Jamais une case à remplir — c'est ce qu'il a exclu |
| **Il s'éteint** | tout seul dès que le règlement est enregistré (« Terminés › TVA ») |

**Pourquoi celui-ci a un rythme et pas les trois autres.** Les trois premiers
s'éteignent dès que le geste attendu est fait. Celui-ci dépend du client : sans
rythme, la carte serait revenue chaque jour pendant des mois, et une carte vue
tous les jours cesse d'être lue.

**Deux défauts trouvés sur une capture, par aucun test** — « 1 jours après
l'échéance », et deux espaces mangées autour d'un `<b>` (« tout seuldès que »).
Le contrôle écrit contre le premier ne mesurait rien : il cherchait la valeur
d'un `<input>` dans le texte de la page, où elle ne figure jamais.
`ARCHITECTURE.md` §118.

### Pas de signature sur les rapports d'entretien — et pourquoi c'est mieux

**Sa question, puis sa décision, le 16 août.** *« S'il n'est pas là, on ne peut
pas le faire signer. Donc est-ce qu'on a vraiment besoin de ça ? »*

**Sa propre capture répondait déjà** : sur le rapport de l'autre application,
les deux signatures sont « Non signé ». La sienne — qui ne prouve rien, c'est
son application et son compte — et celle du client, absent onze fois sur douze.
Un champ qui reste vide fait passer chaque rapport pour un document inachevé.

**Ce qui prouve le passage à leur place existe déjà** : la date, l'heure, le
temps passé, et l'empreinte du contenu exact — le mécanisme qui sert déjà à
l'acceptation d'un devis. Plus solide qu'un trait au doigt, et sans un geste.
S'ajoutera un **« J'ai bien reçu »** sur la page du client : un accusé horodaté.

**La règle qui reste, quelle que soit la suite** : un rapport sans signature ne
doit pas AVOIR L'AIR incomplet. Si personne n'a signé, la ligne n'existe pas —
jamais de « Non signé » en gris sur un document qui part chez un client. Un
contrôle le tient désormais, et il vise le document, pas la page qui l'explique.

**Ce que ça économise** : une journée de travail (zone de dessin, stockage,
écran verrouillé, conservation RGPD, survie hors réseau) pour un geste fait une
fois sur vingt.

**Et l'envoi est celui du devis** — sa confirmation du même jour. Le mot
« automatique » mérite d'être précisé : rien ne part tout seul, c'est sa décision
du 3 août. Atlas prépare le message avec le lien, ouvre sa messagerie, il appuie.

---

### « L'appli est vraiment très lente » : le banc le dit enfin lui-même

**Sa plainte du 16 août au soir**, et elle était fondée : chaque écran mettait
jusqu'à une minute à s'ouvrir.

**La cause n'est pas dans le produit.** Le banc sert une version BÂTIE, qui rend
un écran en 50-100 ms. Faute de version bâtie, il retombe sur le mode
développement, qui compile chaque écran **à l'ouverture** — 30 à 100 secondes.
Ce repli existe pour qu'un banc lent vaille mieux qu'un banc mort, et il est
juste. Ce qui ne l'était pas : **il ne se disait pas.**

Sa fiche annonçait « aucune version bâtie — le banc sert le mode
développement ». Vrai, et pourtant inutile : cette phrase recouvrait trois états
qui n'appellent pas la même chose du tout.

| L'état réel | Ce qu'il faut faire |
|---|---|
| la construction tourne encore | attendre deux minutes |
| **elle a ÉCHOUÉ** | **rien ne se réparera seul — le banc restera lent** |
| elle n'a jamais démarré | il manque un démarrage |

**Ce que ça évite :** chercher un défaut de produit devant une machine qui
connaît la réponse. Le message d'échec existait — il partait dans
`/tmp/essai.log`, que personne ne lit et auquel une session n'a pas accès.

Désormais `banc.mjs` dépose un témoin d'échec **hors** du dossier de
construction (il doit survivre à la tentative qui le remplace), avec l'heure, le
code de sortie, et **le disque et la mémoire relevés à cet instant précis** —
une heure plus tard la mémoire est rendue et le coupable a disparu. La fiche le
publie, nomme la lenteur dans ses mots à lui, et publie de toute façon le disque
et la mémoire à chaque passage. Une réussite efface le témoin : un échec d'hier
ne doit pas accuser la construction d'aujourd'hui.

`scripts/test-banc-lent-se-dit.ts` tient les huit points et **sait rougir** :
contre la version d'avant, les huit tombent.

**Ce qui n'est PAS corrigé, et il faut le lire ainsi :** on ne sait pas encore
*pourquoi* sa construction échoue. Ce lot ne rend pas son banc rapide — il rend
la cause lisible en un coup d'œil au lieu d'une soirée.
### La fiche d'entretien : tout est tranché, la construction peut commencer

**Ses deux dernières réponses du 16 août.** La molette : *« la A »* — celle du
téléphone, qu'il connaît déjà et qui ne coûte rien à tenir. J'avais recommandé
la molette Atlas ; sa raison est bonne, et la planche garde la trace du chemin.

Et la fiche, dans ses mots : *« ça sera un modèle à chaque fois qu'on
pré-remplira et qu'on enverra aux clients. Donc au final, chaque client aura sa
fiche parce que ça ne sera jamais la même — mais il n'y aura qu'une seule
fiche. »* Donc **un seul modèle**, tenu dans les Réglages ; rien n'est rangé par
client.

**Ce que cela suppose, écrit plutôt que tu** : le second passage chez le même
client doit retrouver son ajustement, sinon il le referait douze fois par an.
Le pré-remplissage se fera d'après **son dernier passage**, le modèle ne servant
que la première fois. C'est la lecture retenue, corrigeable d'un mot.

Les quatre planches portent désormais ce qui a été retenu, et deux contrôles le
tiennent : une planche qui rouvrirait sur une version écartée lui montrerait,
dans six mois, autre chose que sa décision.

Toujours **aucune ligne de `src/`** — l'ordre de construction est écrit dans
`TODO.md`.

---

### Le temps passé ne se tape plus : une molette, faite sans JavaScript

**Sa demande du 16 août** : *« ne pas avoir à l'écrire, mais une petite molette
ou un truc sympa […] je veux une application ultra luxe et moderne »*.

Trois gestes sur `docs/maquettes/65-choisir-l-heure.html` : la molette native du
téléphone (gratuite, c'est déjà la sienne), les quarts d'heure en pastilles (un
seul appui, mais le quart d'heure comme seule unité), et **la molette Atlas** —
une bande qui s'accroche aux crans, un trait doré au centre, et ce qui est loin
qui s'efface. Elle est faite **sans une ligne de JavaScript** : son lecteur n'en
exécute pas.

**Pourquoi un clavier était le mauvais outil**, indépendamment du goût : le
temps se saisit debout, avec des gants. Un clavier demande de viser quatre
touches et de deviner le format attendu — « 1h40 », « 1:40 », « 100 » ? Une
molette ne peut produire qu'une valeur juste.

Ce qui n'est pas à choisir : le pas de cinq minutes, l'ouverture sur le temps
planifié plutôt que sur zéro, et l'écart qui reste affiché.

Le contrôle mesure ce qu'aucune capture ne montre — que l'accroche rattrape
vraiment un décalage, et que le repère est au centre. **Il refuse de conclure
sur une boîte de zéro pixel**, le piège payé le 15 août. Confronté aux trois
états dégradés qu'il vise : trois rouges, chacun nommant le bon coupable.

Toujours **aucune ligne de `src/`**.

---

### La fiche d'entretien : B et B, la saisie du temps, et où elle se compose

**Sa réponse du 16 août : « B et B »** — rangée par familles sur le chantier,
et seulement ce qui a été fait chez le client. Plus deux ajouts : *« une case
pour pouvoir rentrer le temps passé »*, et *« dans les réglages […] un endroit
où l'utilisateur pourra créer cette fiche »*.

Les planches 62 et 63 s'ouvrent désormais sur **B**, et un contrôle le tient :
une planche qui rouvrirait sur A lui montrerait, dans six mois, autre chose que
ce qu'il a choisi. Le temps passé devient une **case de saisie**, le planifié
rappelé à côté et l'écart calculé.

Une troisième planche, `64-composer-sa-fiche.html` : la fiche se compose dans
les Réglages — ajouter, retirer, renommer, et **se dédire** (le retrait est
réversible, comme partout depuis le 10 août).

**Une question reste, et elle n'est pas de rangement** : une seule fiche pour
tous ses clients, ou un modèle puis une fiche par client ? Et une conséquence
qui n'est pas à choisir : **un rapport déjà envoyé ne change plus jamais** —
retirer une ligne du modèle en octobre ne doit rien changer aux rapports de
juillet, qui sont signés et partis chez le client.

Toujours **aucune ligne de `src/`**.

---

### Deux maquettes pour la fiche d'entretien des paysagistes — RIEN N'EST CODÉ

**Sa demande du 16 août**, captures d'une autre application à l'appui : *« des
fiches de chantier pour les paysagistes qui font de l'entretien […] une fiche où
ils cochent ce qu'ils ont fait ou non, et ensuite qu'ils peuvent enregistrer et
envoyer directement au client »*.

Terrain neuf : rien dans le produit ne parle encore d'entretien récurrent. Deux
planches donc, et **aucune ligne de `src/`** — sa règle du 11 août.

- `62-la-fiche-dentretien.html` — ce qu'il coche sur le chantier. Trois gestes :
  la liste d'un bloc, rangée par familles avec un compte, ou trois états avec
  « sans objet ».
- `63-le-rapport-au-client.html` — ce que le client reçoit. Trois versions :
  tout comme l'autre application, seulement ce qui a été fait, ou le reste
  replié en une phrase.

**Ce que la capture de l'autre application apprend, et qu'il ne faut pas
recopier :** elle affiche les vingt prestations avec « Vrai » ou « Faux ». Sur
ce passage, quatre sont faites — le client lirait donc **seize fois « Faux »**
sur un passage qu'il paie.

Les deux planches sont engendrées d'**une seule liste** : recopiées, elles
finiraient par diverger là où il compare les deux. Le contrôle refuse le
JavaScript (son lecteur n'en exécute pas), vérifie que les deux listes
concordent, et que « Faux » ne sort jamais vers le client. Confronté à quatre
planches dégradées : quatre rouges, chacun nommant le bon coupable.

**Ce qui attend sa décision** : quel geste sur le chantier, et ce que voit le
client. Rien ne sera codé avant.

---

### « Le nouveau chantier » grossit : 13 px, très gras, rond de 42

**Son choix du 16 août, la planche 67 en main : « les capitales, gros et très
gras ».** Le libellé passe de 9 à 13 px, de la graisse 500 à 800, son
interlettrage se resserre de 0,28 à 0,22 em — seize capitales à 0,28 em ne font
plus un mot mais une frise —, et le rond suit, de 38 à 42 px. Le signe reste à
20 : l'agrandir aurait rempli l'anneau.

**Ce que ça évite, et c'est le risque de ce genre de demande :** grossir
jusqu'à la coupure. `test-bouton-nouveau-chantier-e2e.ts` mesure désormais le
mot **à 360 px**, le plus étroit de ses écrans, et refuse les deux dérives
opposées — le retour au libellé minuscule (≥ 12 px, ≥ 700) et le « … ».

**Et `docs/maquettes/24-le-bouton-retenu.html` a été corrigé dans le même
commit.** C'est lui qui avait resserré cet endroit le 11 août, et cette planche
chiffre les mesures que le code est censé suivre : la laisser dire 9 px pendant
que le code en fait 13, c'est garantir qu'une prochaine session croira la
mauvaise. Elle porte maintenant un bandeau, et renvoie à la 67.

### La planche de ce choix — trois formes, trois tailles, trois graisses

**Sa demande du 16 août**, capture à l'appui. `src/` n'est pas touché : la
planche `docs/maquettes/67-le-nouveau-chantier-plus-gros.html` propose trois
formes, trois tailles et trois graisses, avec **le témoin d'aujourd'hui figé à
côté** — sans repère immobile, « plus gros » ne se compare à rien.

**Ce que ça évite :** grossir jusqu'à la coupure. Le cran le plus gros est le
plus gros qui tienne encore sur un écran de 360 px (284 px pour 308 disponibles),
et `scripts/verifier-maquette-nouveau-chantier.mjs` refuse tout ce qui déborde,
en donnant les pixels manquants plutôt que le nom d'un sélecteur.

**Et un défaut de la page unique corrigé au passage, qui ne se voyait pas.**
`fusionner-maquettes.mjs` préfixait les identifiants du corps sans les suivre
dans la feuille de style : `#t-3:checked ~ …` et `label[for="t-3"]` désignaient
alors le vide. La planche s'affichait parfaitement **et ne répondait à rien** —
la panne que ce script existe justement pour empêcher. Les deux sont désormais
réécrits ensemble, et un contrôle refuse la fusion si une référence reste
orpheline (vu rouge sur les maquettes 58, 59 et 60 en le désactivant).

### La fiche du banc se taisait EXACTEMENT quand elle devenait utile

**Trouvé en cherchant pourquoi il ne pouvait plus ouvrir l'application.** Sa
fiche datait de vingt-sept minutes et annonçait un serveur muet. Sa propre règle
de lecture — « passé vingt minutes sans réécriture, l'espace est arrêté » —
envoyait donc rallumer une machine dont rien ne prouvait qu'elle dormait.

**La cause.** La publication vivait au bas de la boucle de `veiller.sh`. Cette
boucle s'arrête d'avancer dès qu'elle appelle `npm run banc`, qui ne rend la
main qu'à la mort du serveur suivant — des heures. Le veilleur **cessait donc de
publier au moment même où il se mettait au travail**.

**Ce que ça évite :** chercher la panne au mauvais endroit, ou rallumer un espace
qui tourne. La publication vit désormais dans un processus séparé, que rien de
la surveillance ne peut endormir, et qui s'arrête avec le veilleur.

`scripts/test-fiche-pendant-relance.ts` le tient — et il **sait rougir** :
confronté à l'ancienne version, il annonce « aucune publication ». Une suite qui
n'a jamais échoué ne prouve rien.
### Cinq chantiers de test pour éprouver la proposition « par le trajet »

**Sa demande :** *« crée-moi quatre, cinq chantiers de test […] avec des
demandes de demi-journée, avec des adresses plus ou moins espacées […] pas
encore ajoutées au planning »* — pour essayer si l'appariement des deux
demi-journées propose bien le chantier le plus proche.

**Un script à part, `npm run essai:chantiers-trajets`, et NON le seed.** Le seed
vide puis reconstruit tout, une dizaine de suites comptent ses quatre chantiers,
et il ne repasse qu'à la création du conteneur : y verser cinq chantiers de plus
aurait cassé la batterie sans jamais parvenir à un banc déjà allumé. Le script
ajoute cinq chantiers à l'entreprise de démonstration **sans rien tronquer**, et
se relance sans doublon (préfixe « Chantier test — »).

**Ce que ça évite.** Chaque chantier a un devis parti, une durée d'une
demi-journée, aucune date, et des coordonnées posées d'avance (mairies autour de
Nantes) : sans elles, l'appariement dépendrait d'un appel à la Base Adresse
Nationale que le mandataire réseau du banc peut refuser. Les distances vont de
5 à 42 km — le dernier (Pornic) au-delà du seuil de 40 km, pour éprouver aussi
l'écart et le « Voir quand même ». Vérifié en base : cinq candidats reconnus,
trois proposés, un écarté, zéro sans position.

**Complété le 17 août : le script POSE le chantier de départ.** Cinq chantiers
tous « sans date » ne montraient jamais la fonctionnalité — la proposition part
d'un chantier DÉJÀ posé sur une demi-journée, et il n'y en avait aucun. Le patron
s'est retrouvé bloqué, la pose à la main lui échappant. Le script pose désormais
« Portail Rezé » le matin de la prochaine journée ouvrable (via
`planifierChantier`, la fonction de l'écran) ; son après-midi reste libre, et à
l'ouverture de ce jour le bandeau propose les plus proches. Vérifié en base à
deux équipes : départ posé, trou de l'après-midi détecté, trois propositions.

### « Fais cinq pour cent sur le montant du devis »

**Sa demande :** pouvoir dire à l'application *« fais cinq pour cent sur le
montant du devis »* et voir s'ajouter une petite ligne — *« réduction ou prix
accordé au client, cinq pour cent, ou dix, ou quinze. C'est moi qui choisis le
nombre de pourcentage »*. Rien de tel n'existait : aucune remise, nulle part.

Trois arrangements lui ont été montrés **avec leur prix écrit en face**. Il a
choisi le plus cher, **B — sous le total, « Prix accordé au client »** : le prix
plein, ce qui a été consenti, puis le net. C'est celui qui permet à son client de
refaire le calcul.

**Ce que ça évite.** La réduction se calcule sur le HT et la TVA vient après —
sur le TTC, elle aurait rendu une déclaration fausse. Et elle **suit jusqu'à la
facture** : accordée sur le devis puis absente de la facture, elle aurait fait
payer au client le prix qu'on venait de lui retirer.

**Quatre défauts trouvés par les contrôles, et pas un par la relecture :**

- le PDF ne se générait plus du tout dès qu'une remise existait — le « moins »
  typographique n'existe pas dans la police du document ;
- vider la case ne retirait rien : le champ disparaissait avant d'avoir
  enregistré, et la remise revenait au rechargement, sans un mot ;
- la retouche dictée cherchait le devis par le chemin réservé aux devis
  **envoyés**, et n'aurait donc jamais rien appliqué à un brouillon ;
- une ligne vide traînait sur les devis sans remise, que le PDF n'imprimait pas.

Il peut aussi la dicter — « fais cinq pour cent », « enlève la remise » — et une
ligne discrète sous les totaux permet de la poser sans parler.

Détail : `ARCHITECTURE.md` §116.

### Le micro du devis ne touche QUE les lignes

Il s'était repris : *« je veux que la note, elle ne remplace que les lignes de
[devis] et rien d'autre, comme c'était déjà avant — on ne touche pas aux
conditions. »* Il avait répondu l'inverse la veille. **Rien n'avait été codé
entre les deux** — c'est ce que la règle de la maquette d'abord protège.

### Un jour barré disait « déjà pris » alors qu'il était vide

**Sa capture du 16 août :** *« lorsque je veux remettre une journée sur le
dix-huit, je ne peux pas ou alors c'est parce que je n'ai pas sectionné la
demi-journée »*. Son intuition était bonne — c'est bien une histoire de durée —
mais pas celle qu'il croyait : **celle du chantier qu'il envoie**.

Un jour barré ne répond pas à « ce jour est-il pris ? » mais à « un chantier de
cette durée peut-il y COMMENCER ? ». Reproduit avant de corriger : avec un seul
jour plein — le 19 —, **le 18 est vide et pourtant barré** dès que le chantier
dure deux jours, parce qu'il déborderait sur le 19. La règle est juste ; sans
elle le chantier mordrait sur une journée prise.

**C'est la phrase qui mentait.** Elle disait *« les jours barrés sont déjà pris »*
— faux sur un jour vide, et elle l'envoyait chercher une occupation qui
n'existait pas. Elle dit maintenant la durée en cause :

> « Les jours barrés ne peuvent pas accueillir 2 jours : soit ils sont pris, soit
> le chantier déborderait sur un jour qui l'est. »

Nommer la durée **montre le levier** : elle se change juste au-dessus du
calendrier, et passer à « 1 journée » rouvre le 18.

**Le client en profite aussi** — c'est le même calendrier, et lui non plus ne
savait pas pourquoi un jour lui était refusé. Sa phrase à lui ne chiffre rien
(« ne peuvent pas accueillir votre chantier ») : rien du découpage de votre
planning ne part chez lui, c'est votre consigne, et c'est la batterie qui l'a
rappelée quand elle avait été enfreinte.

Aucune règle de réservation n'a changé, seulement ce qui est dit. Détail :
`ARCHITECTURE.md` §115.


### CODÉ : la TVA quand le client paie, et l'endroit où les factures attendent

Sa question du 14 août : *« si un client décide de ne pas me payer, la facture
rentre quand même dans mon relevé de TVA »*. Puis sa forme : *« elle arrive dans
un endroit en attente ; quand j'ai reçu le paiement, je clique sur valider, et
boum. »*

**Il avait raison, et Atlas avait tort.** Pour une prestation de services, la TVA
est exigible **à l'encaissement** (CGI art. 269-2-c) ; le régime des débits —
celui que le relevé appliquait — est une **option** qui se demande. Un artisan
qui ne l'a jamais demandée avançait donc la TVA de clients qui n'avaient pas
payé.

| Ce qui change | |
|---|---|
| **Le relevé** | calculé sur la date du **règlement**, plus sur celle de l'émission |
| **L'endroit en attente** | dans Ma TVA : les factures parties, avec « Payée » d'un doigt |
| **L'acompte** | « Noter un règlement » — une date, un montant. Seule la part reçue entre au relevé, au prorata |
| **Le réglage** | encaissements (défaut légal) ou débits, à côté du rythme |

**Le passé ne bouge pas.** Chaque facture déjà émise a reçu un règlement daté de
son émission : un trimestre déjà déclaré rend exactement le même montant
qu'avant. Ces règlements sont annoncés comme supposés, et se retirent.

**Et l'écran ne ment plus** : une facture arrêtée disait « elle figure au relevé
de TVA collectée ». C'était faux dès ce lot. Elle dit maintenant qu'elle y
entrera au paiement. Raisons : `ARCHITECTURE.md` §111.

### Le planning propose de compléter une demi-journée — par la route

**Sa demande du 13 août :** *« lorsqu'on a fini des chantiers en demi-journée,
que le planning soit en mesure de proposer deux demi-journées pour faire une
journée, mais de deux chantiers qui sont les plus proches »*. Sa décision du
16 : *« si c'est possible de faire par la route, code par la route »*, avec
*« la 2 […] mais avec plusieurs proposition comme la 3 »*.

**La vérification a répondu** (`.github/workflows/itineraire.yml`, sur une
machine qui a le réseau) : le service d'itinéraire de l'IGN accepte **sans clé
ni compte**, répond en 186 ms, et le vol d'oiseau se trompe de ×1,33 à ×1,56.
Assez pour **inverser un classement** : un chantier derrière une colline paraît
proche et se paie en camion.

**Ce que ça évite :** traverser le département deux fois dans la même journée.
Le bandeau s'ouvre sous la journée dépareillée, propose jusqu'à trois chantiers
d'une demi-journée classés par temps de route, et **cale sur un appui** — Atlas
propose, le patron décide.

**Ce qui protège le service public** : le vol d'oiseau classe et écarte d'abord,
chez nous, sans le moindre appel ; la route ne départage que les trois premiers.
Trois appels par proposition, pas quinze — aucun en-tête n'annonce de limite
d'usage, et dix appels ne prouvent pas qu'il en supporte mille.

**Ce qui ne sort pas d'Atlas** : deux paires de nombres, jamais un nom ni une
adresse en clair — tenu par un contrôle, pas par une phrase.

Migration `0047` (coordonnées + `adresse_situee`), rattrapage automatique au fil
des ouvertures du planning, et les trois écrans muets dessinés autant que le
premier. `ARCHITECTURE.md` §117.

### « ½ journée » réservait la journée entière

**Trouvé en écrivant les contrôles ci-dessus.** `dureeEnDemiJournees("½ journée")`
rendait **2** : le motif connaissait « demi-journée » et « 1/2 journée », pas le
caractère `½` — qui est pourtant le libellé que la molette affiche au patron,
donc celui qu'il redit et qu'il **dicte**.

**Ce que ça évite :** une demi-journée dictée qui bloque la journée complète, et
un planning qui refuse un après-midi libre sans dire pourquoi. Sans conséquence
par la molette, qui enregistre « une demi-journée ». Réel à la dictée.

### La ligne d'état passe en or sur TOUTES les cartes de l'accueil

*Sa consigne, capture de l'accueil à l'appui : « mets le "devis prêt à envoyer
sans photo" en doré ; pour tous les messages je veux que cette partie-là
apparaisse en doré. »*

**Ce que l'or ne dit plus, et c'est le seul coût.** Il distinguait ce qui appelle
un geste **de lui** — un devis à corriger, un devis caduc — de ce qui attend
ailleurs. La nuance se lit désormais dans **les mots** de la ligne, plus dans la
teinte. C'était déjà à moitié fait : le 13 août, il avait étendu l'or aux devis
partis sans réponse, qui n'appellent aucun geste.

**La liste `APPELLE_UN_GESTE` est retirée**, pas conservée « au cas où » : un
drapeau qui vaut toujours vrai n'est plus un drapeau, et une liste qu'on garde
sans l'employer se met à mentir en silence. Le champ `enOr`, lui, survit — l'écran
n'a jamais décidé de sa couleur, et ce n'est pas le jour où la règle se simplifie
qu'il faut lui rendre ce pouvoir.

**Deux contrôles, parce qu'un seul ne suffit pas ici :** la suite base balaie
**tous** les statuts — tirés du type, jamais recopiés, sans quoi le statut ajouté
demain resterait gris sans que rien ne rougisse ; et la suite navigateur lit la
couleur **calculée** sur l'accueil réel, parce que la règle serait verte même si
l'écran ignorait le drapeau. Elle refuse de conclure sur zéro carte.

---

## 2026-08-15

### Une place garantie à chaque sorte, sur l'accueil

**Sa décision du 16 août, après deux photos et une question — « quelle est le
mieux ? » :** *« ok alors fait le »*.

**Ce que ça évite, et la batterie l'avait dit avant l'image.** Les rappels
passant devant, trois suites ont rougi parce que la réponse de client qu'elles
cherchaient n'était plus à l'écran. Sur le jeu de démonstration, **cinq rappels
occupaient les deux places et masquaient toutes les réponses**.

**La raison, et elle vaut plus que la règle :** un rappel se fabrique tout seul
et s'accumule tant que la situation dure ; une réponse de client est un
ÉVÉNEMENT, provoqué par quelqu'un, et périssable. Une sorte qui grossit seule ne
doit pas pouvoir enterrer une sorte rare et urgente.

**Son choix B tient sans changement** : la première place reste au rappel. C'est
la dernière place visible qui revient aux réponses, et seulement s'il en existe
— réserver dans le vide laisserait un trou là où il y a quelque chose à montrer.

La règle est pure (`src/lib/ordre-notifications.ts`) et éprouvée sur les cas
limites qu'un écran ne produit qu'un jour sur cent : zéro d'une sorte, une seule
place visible, et **aucune carte perdue ni dupliquée** sur les 108 combinaisons.
Cette dernière garde contre le pire défaut possible ici — un refus de client qui
disparaîtrait sans que rien ne le signale.

### Sur l'accueil, les rappels passent devant les réponses

**Sa décision du 16 août, devant trois photos : « fait la B ».**

**Ce que ça évite :** un rappel qu'il faut déplier. L'accueil ne pose que deux
cartes, et tant que les réponses de clients venaient en tête, le rappel passait
derrière « N autres devis à regarder » dès **deux réponses en attente**.

**Une exagération corrigée en chemin, et elle valait d'être dite.** Je lui avais
annoncé que sa carte passait derrière dès qu'une correction était en cours.
Mesuré : avec UNE seule réponse, elle prend la seconde place et se voit très
bien. Il en faut deux. La scène des photos a donc dû être fabriquée exprès —
`scripts/capture-rang-trois-cas.sh`, qui **photographie l'application** au lieu
de la dessiner, et qui rend le code à son état d'origine même en cas d'échec.

**Et la troisième proposition a été écartée par l'image elle-même** : montrer
trois cartes au lieu de deux met bien le rappel à l'écran… sous le bord, hors de
vue. Une capture vaut mieux qu'un raisonnement.
### Dicter dans le devis : « je vais pouvoir lui parler comme ça et qu'elle comprenne »

**Sa demande :** un micro en haut à droite du devis, le même que sur la fiche du
client — trois petits points qui soufflent compris — pour dire ce qu'il faut
reprendre : *« supprime-moi la deuxième ligne, modifie-moi le prix de la taille
de haie, remplace-moi le deux cent cinquante par trois cent cinquante, rajoute-moi
une ligne, broyage des branches et tu mets cinq cents euros […] supprime-moi
fondage du bois, mais en échange je veux que tu mettes débitage du bois. »*

Il a choisi la proposition A de `docs/maquettes/54-dicter-dans-le-devis.html` :
**elle propose, il coche**. Le devis ne bouge pas d'un centime avant son appui, et
il décoche ce qui ne va pas.

**Ce que ça évite**, et c'est pour cela que la feuille existe plutôt qu'une
application directe : une lecture qui se trompe d'un chiffre sur un devis parti
chez un client se rattrape par un avoir. Trois refus sont posés dans le code, pas
dans une consigne :

- **aucun prix ne s'invente** — « rajoute le broyage » sans montant donne une
  ligne vide qui le dit en rouge, jamais « le prix habituel » ;
- **deux lignes qui se ressemblent ne se départagent pas au hasard** — « Élagage
  chêne » et « Élagage frêne » rendent « à préciser », décoché ;
- **un nom reconnu nulle part ne se rabat pas sur le numéro de ligne.**

Et « fondage du bois » trouve « Fendage du bois » : c'est son exemple, et c'est
le cas courant d'une syllabe avalée par le micro.

**Ce qui n'a PAS été éprouvé ici, et qu'il faut savoir.** Cet environnement n'a
ni service de transcription ni modèle : la feuille de confirmation **remplie**
n'a jamais été parcourue de bout en bout. Ses phrases sont éprouvées sans
navigateur (`scripts/test-retouches-devis.ts`, 27 cas) et la feuille a été vue
avec des données posées à la main. Le raccord entre la voix et la feuille ne sera
parcouru qu'avec une clé. Faute de transcription, l'écran le dit plutôt que de
présenter le texte de remplacement comme une dictée.

Détail : `ARCHITECTURE.md` §113.

### Le rappel du devis qui tarde : CODÉ, sur ses trois mots

**Ses décisions, du 16 août :** *« la B et 4 »*, puis *« le G »*. La carte
teintée avec le compte des jours dans l'étiquette, quatre jours par défaut, et
le libellé **« Chantier sans devis »**.

**Un TROISIÈME rappel**, et il ne se déduisait d'aucun des deux codés le 14 :
ceux-là partent d'un envoi (`envois_devis.envoye_at`), et un devis jamais parti
ne laisse aucune ligne d'envoi à interroger. Le sien se lit sur le chantier —
`created_at` et `devis_envoye_at`. `drizzle/0046_rappel_chantier_sans_devis.sql`.

**Ce que ça évite :** un chantier ouvert qui s'enfonce dans la liste sans que
rien ne parte au client — le cas de sa Mme Félicie, vue il y a quatorze jours.

**Deux règles y sont gratuites**, et c'est ce qui a décidé de la forme : le
rappel s'efface seul dès que le devis part (la condition se calcule, il n'y a
rien à ranger), et un chantier terminé sans devis ne réclame plus rien — c'est
justement le dépannage où il a eu raison de ne pas en faire.

**Une réserve lui a été posée, et il l'a tranchée.** En place, le ton teinté
qu'il avait choisi est exactement celui de « CORRECTION DEMANDÉE » — un ton
réservé jusque-là à ce qui appelle une décision. La capture de l'accueil le lui a
montré ; sa réponse : *« le B »*. Il garde le sien, et la règle du §108 se
précise plutôt qu'elle ne tombe : elle vaut pour un **confort**, et celui-ci n'en
est pas un — c'est le seul des trois où **rien n'est encore parti au client**.

### Une carte ne peut plus se reposer à moitié coupée

**Sa capture du 16 août :** *« le premier message est trop haut et le début
n'est pas visible. »*

**Mesuré, et ce n'était pas ce qu'on croyait.** Au repos la carte est entière —
elle commence 38 px sous le bord. Le défaut apparaît **au défilement** : le
cadre porte un fondu de 18 px en haut, et la carte s'arrêtait où le doigt la
laissait. Son étiquette et le nom du chantier passaient dessous ; il ne restait
que la dernière ligne et le geste.

**La cause tenait en une ligne absente.** Le cadre déclarait
`scroll-snap-type: y proximity` depuis toujours — et **aucun de ses enfants
n'avait jamais déclaré de point d'accroche**. La propriété était inerte, et rien
ne pouvait le dire : elle est valide, elle ne fait simplement rien sans cible.

**Ce que ça évite :** le compte des jours qu'il a demandé, effacé par le fondu
au premier glissement. Mesuré après correction : quel que soit le défilement
demandé, une carte s'arrête désormais à 24 px du bord.

### La ligne du planning porte enfin ses trois infos — CODÉ

*« Je veux journée et toute la ligne. Tu peux coder. »*

| Le chantier | La ligne, désormais |
|---|---|
| une journée pleine | **14 août · journée** |
| une vraie demi-journée | **17 août · matin · ½ journée** |
| trois jours | **21 août · matin · 3 jours** |
| une journée partie l'après-midi | **24 août · après-midi · 1 journée** |

La date, le moment de départ, la durée — **en or**, là où c'était gris.

**Ce que ça évite, et ce n'est pas cosmétique.** Le mot « matin » revient sur la
ligne d'où il avait été retiré la veille pour cause de mensonge — mais il ne s'y
écrit **jamais sans sa durée**. Seul, il redit *« juste le matin est bloqué alors
que c'est la journée »* ; accolé au nombre, il dit **quand ça part**. Un contrôle
balaie les deux cents durées pour que personne ne les sépare un jour « pour
alléger ».

**Ce qui se perd, et il vaut mieux le lire ici que le découvrir :** « du 21 au
25 août » disparaît. La ligne ne dit plus quand le chantier **finit**, et les
week-ends sautés interdisent de le recalculer de tête. C'est le prix du nombre de
jours ; sa place, si elle manque, est la feuille du chevron.

**Deux doublons corrigés au passage**, tous deux invisibles séparément : l'équipe
s'écrivait **deux fois** dès qu'il y en a plusieurs — dans la phrase et sur la
pastille, côte à côte — et la date, tombée de la liste le matin même, y est
revenue : la consigne qui l'en avait chassée valait du panneau d'un jour ouvert,
pas d'une liste qui couvre tout le mois.

Détail complet, et le tableau de ce que chaque contrôle voit : `ARCHITECTURE.md`
§111.

### Et le contrôle de ce lot dormait — réveillé par la capture, pas par la batterie

La suite qui devait attraper un nom de chantier coupé mesurait la page **avant
qu'elle soit mise en page** : les deux largeurs comparées valaient zéro, et
`0 − 0 = 0` annonçait « rien n'est coupé ». En vert. Sur un écran où trois noms
l'étaient.

**Rien ne l'aurait montré** : la suite était verte, la batterie entière l'était —
146/146 en base, 82/82 au navigateur. C'est la **capture, regardée**, qui a montré
les « … ». Quatrième fois dans ce dépôt qu'un défaut sort d'une image et d'aucun
test.

**Ce que ça évite désormais**, et c'est écrit en règle permanente
(`CLAUDE.md` §5) : un contrôle qui compare des dimensions attend la mise en page,
et **refuse de conclure sur une boîte de zéro pixel**. L'absence de matière à
mesurer n'est pas un succès, c'est une mesure impossible.

Deux défauts de montage sont tombés avec : l'horodatage collé au nom du client
fabriquait des « Mr. Bernard-Delacroix J1786838107808 » qu'aucun client ne porte —
le contrôle accusait alors le produit d'une coupure que le montage seul avait
créée ; et la pastille d'équipe se cherchait par ce nom, donc en trouvait trois.

### « Le nombre de jour en doré » : une planche plutôt qu'une devinette

**Sa question**, capture du planning à l'appui : *« Avant il y avait le Nombre de
jour en doré et je sais plus quoi, où c'est passé ? »*

**L'historique a été fouillé, toutes branches, avant de répondre quoi que ce
soit** — et il ne dit pas tout à fait ce que la question suppose. Un nombre de
jours en or n'a **jamais** existé dans `src/`. Mais trois choses en approchent,
et elles sont énumérées sur la planche plutôt que gardées pour moi :

| Ce qui a existé | Où | Quand c'est parti |
|---|---|---|
| « matin, 2 jours » sur la ligne — **en gris** | le planning | `064d413`, 10 août |
| « Créer la facture » — **en or**, mais ce n'est pas un nombre | la même ligne | `026e7ba`, 12 août, vers la feuille |
| « occupe : vendredi 21, lundi 24, mardi 25 » — **un nombre de jours en or** | la **maquette 51**, envoyée le 14 août | jamais codé, et sa planche le disait |

La troisième est la plus probable : une planche qu'il a manipulée la veille se
confond aisément avec l'application. Et trois lots ont touché cette ligne en deux
jours — la date tombée, « Déplacer » parti dans la feuille, la pastille d'équipe
arrivée. Se souvenir de travers, à ce rythme, n'a rien d'étonnant.

**Donc : quatre écritures de la même ligne, sur une planche qu'il manipule**
(`docs/maquettes/58-le-nombre-de-jours-en-or.html`) — telle qu'elle est, la date
qui revient, la durée en or, les deux en or. **`src/` n'est pas touché**
(`CLAUDE.md` §3 bis).

**Ce que ça évite :** coder les quatre « pour qu'il essaie », puis en défaire
trois. Et surtout, lui rendre une réponse inventée — le piège nommé dans
`AGENTS.md` : réparer une panne imaginée.

Le contrôle de la planche a été **vu rouge trois fois** avant d'être livré
(or retiré, bascule morte, nom coupé), et chacun nomme le bon coupable.

### Sa réponse : la D, augmentée — et un invariant à ne plus perdre

*« Je veux le 54 la D mais il doit y avoir le nombre de jour, le matin,
l'après-midi et la journée comme infos possible. »*

La ligne portera donc **trois** choses et non deux : la date, **le moment où le
chantier part**, et le nombre de jours.
`docs/maquettes/59-la-ligne-qui-dit-tout.html` les montre sur les **cinq** cas
du produit — la journée pleine, les deux vraies demi-journées, le chantier long,
et celui qui part l'après-midi pour finir le lendemain matin.

**L'invariant qui en sort, et qui vaudra pour le code :** « matin » ne s'écrit
**jamais sans son nombre de jours**. Seul, il redit ce qu'il avait signalé le
13 août — *« ça laisse à penser que juste le matin est bloqué »* — et c'est
précisément pour cela qu'il en avait été retiré la veille. Accolé au nombre, il
ne dit plus ce qui est bloqué mais **quand ça part**, et l'information qu'il
réclamait revient sans le défaut qu'elle portait.

Le contrôle mesure les deux réglages restants dans leurs **quatre**
combinaisons, et il a été vu rouge sur les quatre sabotages qui comptent :
nombre retiré, nom trop long, phrase trop longue, sélecteur d'or cassé.

### « ½ journée, pas jour ! » — une règle écrite depuis dix jours, enfreinte quand même

La planche disait « ½ jour ». `src/lib/durees-chantier.ts` dit « ½ journée »,
« 1 journée », « 3 jours » — **et le dit depuis le 4 août 2026, sur cette même
correction du patron, capture à l'appui**. Il a donc dû la refaire.

**Ce que ça évite désormais :** le contrôle de la planche **lit la liste dans le
dépôt** au lieu de la recopier, et refuse tout libellé qui n'en vient pas. Il ne
peut donc plus dériver le jour où la liste change, et si le fichier disparaît il
**échoue en le disant** plutôt que de passer au vert sans rien mesurer.

Une règle déjà écrite dans le dépôt et enfreinte deux fois n'est pas une règle :
c'est un contrôle qui manque.

**Et un défaut du contrôle lui-même, trouvé en le lançant :** il lisait la ligne
par `textContent`, qui rend aussi le texte ÉTEINT — « 14 août · journéematin ·
1 journée » — et accusait la planche d'un défaut qu'elle n'avait pas. Il compose
maintenant le texte des seuls nœuds visibles. Un contrôle qui mesure autre chose
que l'écran ne prouve rien, et coûte le temps de comprendre qu'il a tort.


### Deux lignes qui commencent par le même mot, l'une sur l'autre

**Il a tranché le 16 août — « la B et 4 » — puis a vu ce qu'aucun contrôle
n'aurait vu :** *« dans la catégorie notification, j'ai peur que la façon dont tu
l'as écrit ne soit pas compréhensible — qu'on ne comprenne pas que cette ligne
sert à ça, le devis non envoyé. »*

**Il avait raison, et ça se mesure à l'œil.** La ligne proposée — « Devis pas
encore parti » — tombe **juste au-dessus de « Devis sans réponse »**, déjà codée.
Deux lignes qui commencent par le même mot, l'une sur l'autre : il faut lire la
petite ligne grise pour les séparer, donc on ne les sépare pas.

**Ce que ça évite :** un écran de réglages où l'on coupe le mauvais rappel. Quatre
mots lui sont proposés, **chacun montré avec sa voisine** — seule façon de juger
une confusion qui n'existe qu'en contexte. Ma préférence : « Chantier sans devis »,
le seul qui se distingue **au premier mot**, et qui fait raconter aux trois lignes
le chantier dans l'ordre.

**Rien n'est codé.** `docs/maquettes/56-le-devis-qui-tarde.html`, § 3.

### Le devis qui tarde : dessiné — et deux fois réécrit contre ce qui existait

**Sa demande du 14 août :** *« un rappel lorsque le chantier a été ouvert mais
le devis n'a pas été envoyé »*, avec *« la possibilité dans les notifications de
mettre le nombre de jours »*.

`docs/maquettes/56-le-devis-qui-tarde.html`. Le troisième rappel n'est pas codé
— `CLAUDE.md` §3 bis.

**La leçon de ce lot, et elle a coûté deux réécritures.** La planche a décrit
deux fois un monde qui n'existait plus : d'abord elle redessinait l'écran des
notifications, dessiné depuis le 13 août ; puis elle proposait quatre façons de
poser un délai, alors que la rubrique avait été **codée le 14** par une autre
session — avec son délai, « Au bout de [ N ] jours ».

**Chercher ce qui existe AVANT de dessiner, dans les deux dossiers de maquettes
et dans le code.** `maquettes/` porte les planches de l'application,
`docs/maquettes/` celles des décisions ; n'en regarder qu'un, c'est redessiner
ce qui est déjà tranché — et mettre le patron devant deux plans du même écran.

**Ce que ça évite, une fois la planche corrigée :** lui faire arbitrer une
question réglée. Sa demande n'est couverte par aucun des deux rappels codés —
ils parlent d'un devis **parti**, lui d'un devis **jamais parti**. C'est une
**troisième ligne** dans un écran qui tourne, et il ne reste que deux mots à
dire : le ton de la carte, et le nombre de jours.

### Un contrôle qui rougissait le samedi, et redevenait vert le lundi

**`main` était rouge en arrivant**, sur `test-pastille-equipe-e2e` — et pas pour
la raison qu'il annonçait. Le message accusait le bouton « Poser » d'être absent
avant le choix ; le bouton allait très bien.

**Le vrai coupable, mesuré et non supposé.** Le contrôle visait un jour à
`+ 20 jours` de la date du jour. Écrit le 14 août, cela tombait un **jeudi** et
tout était vert. Joué le 16, le même calcul tombait un **samedi** — que le
planning refuse par construction : il écrit « Jamais proposé » et ne rend même
pas la journée, donc ni les cases d'équipe ni le bouton. Le contrôle serait
redevenu vert tout seul le lundi, sans que personne ne sache pourquoi.

**Ce que ça évite :** un rouge qui envoie chercher au mauvais endroit. Le jour
visé est maintenant **le premier jour ouvrable** à partir de vingt, via
`estWeekEndIso` — la règle du produit, pas une seconde écriture d'elle.

**Éprouvé dans les deux sens**, comme il se doit : vert un samedi (là où il
échouait la veille), et **remis au rouge** en réintroduisant le défaut qu'il
existe pour attraper — le bouton qui n'apparaît qu'après le choix.

### Six maquettes existaient sans qu'aucun chemin n'y mène

**Trouvé en voulant numéroter la précédente**, et `TODO.md` disait le contraire :
« sans conséquence pour le patron, les planches s'ouvrent une par une ». En
mesurant, 38, 39, 41, 42, 43 et 46 n'étaient **ni dans la page unique, ni au
sommaire** — elles n'existaient que pour qui connaissait leur nom de fichier.
Une autre session avait diagnostiqué le même trou la veille et demandé
exactement ce contrôle ; il est écrit, et le rattrapage fait.

**Ce que ça évite :** dessiner une planche, la commettre, et qu'elle n'atteigne
jamais celui pour qui elle est faite. Le compte affiché ne pouvait pas
l'attraper : « 36 maquettes fusionnées » reste plausible quand il en manque six.

`fusionner-maquettes.mjs` refuse désormais une maquette qu'aucune des deux
portes n'atteint, un lien mort dans le sommaire, et un numéro porté deux fois —
les doublons hérités étant tolérés nommément, dont le 50 qui est volontaire.
Éprouvé sur les trois états. **Il a servi dans l'heure** : la fusion de `main` a
apporté deux planches de plus tombées dans le même trou, qu'il a nommées.

---


## 2026-08-14

### Sept chartes de couleurs, dont deux sombres — au choix de chacun

Il a retrouvé une planche du début du projet — son écran Chantiers dans seize
couleurs — et en a gardé six, plus la sienne : **Origine, Pierre, Beurre, Moka,
Prune, Sylve, Nuit**. Elles se choisissent dans « Apparence », et repeignent
toute l'application, tout de suite.

**Le mode sombre qu'il demandait est dedans, et ce n'est pas un réglage à
part** : Nuit et Sylve sont sombres. Deux interrupteurs — un pour la couleur, un
pour le sombre — se seraient contredits dès la première combinaison.

**Par défaut, rien ne change.** Tant que personne n'a choisi, l'application
affiche exactement les couleurs de la veille : la charte « Origine » reprend les
treize valeurs d'avant, au caractère près, et c'est éprouvé dans les deux sens.

**Ce qui ne suit pas la couleur, et c'est voulu :** les devis et les factures.
Un document ne part pas en noir chez le client parce que l'artisan a choisi
« Nuit » — les deux pages que le client reçoit gardent l'identité d'Atlas.

**Le défaut trouvé sur une capture, jamais par un test :** au premier essai,
l'accueil était passé au noir et la bande sous la barre de navigation restait
blanche. Atlas a deux vocabulaires de couleur — les styles en ligne et les
classes Tailwind — et seul le premier avait été branché (`ARCHITECTURE.md`
§114).

### Les treize rubriques des réglages sont ouvertes — dont deux vrais rappels

Sa consigne : *« Fini toutes les rubriques »*. Plus aucune ne porte
« Bientôt ».

**Ce qui apporte quelque chose de neuf : deux rappels sur l'accueil.** Un devis
parti sans réponse depuis sept jours, un chantier terminé sans facture depuis
trois. Les deux délais se règlent, les deux rappels se coupent — ce sont des
conforts, et rien ne se perd à les éteindre : le devis reste sur la fiche du
chantier, le chantier reste dans « Terminés ».

**Ce qui ne se coupe pas, et l'écran le dit :** la réponse d'un client et le
lien de devis expiré. Les éteindre, ce serait accepter de ne plus savoir qu'on
a été refusé.

**Et ce qui manque est écrit noir sur blanc :** « facture impayée » serait le
rappel le plus utile, et il est impossible — **rien dans Atlas n'enregistre
qu'une facture a été payée**. Tant que ce geste n'existe pas, l'alerte crierait
sur toutes les factures.

**Apparence et Abonnement s'ouvrent sans rien régler**, délibérément : le mode
sombre et la couleur d'accent demandent de reprendre toute l'application, et ni
le prix ni l'offre de l'abonnement ne sont décidés. Les écrans disent ce qui
viendra et ce qui bloque, au lieu d'un « Bientôt » muet — et pour l'abonnement,
ils préviennent que « factures » y désigne celles qu'Atlas enverrait, pas celles
des clients (`ARCHITECTURE.md` §108).

### Une équipe peut partir cinq jours, et Atlas cesse de proposer sa place

**Sa question :** *« Comment on fait si jamais il y a une équipe qui doit partir
en déplacement pour cinq jours ? »* Sa réponse, devant les trois planches :
*« La A »* — sous les noms, dans Réglages → Équipe.

**Ce qui existait déjà et n'a pas été refait :** si TOUTE l'entreprise part,
l'agenda Google relié suffit. On le lui a dit plutôt que de lui vendre du
travail inutile.

**Ce qui manquait :** une équipe sur deux. L'agenda bloque tout le monde —
délibérément — et le nombre d'équipes est un nombre sans dates.

**Ce que ça évite :** proposer à un client une date que l'équipe restante ne
peut pas tenir. Le déplacement se note en quelques secondes, et **tout revient
normal après, sans rien défaire**. Le client ne voit jamais rien de ceci.

**La décision qui a tout tenu :** une absence n'est pas une capacité qui varie,
c'est **une occupation** — elle prend la place qu'un chantier aurait prise. Zéro
signature changée, et les quatre calculs d'occupation en héritent : les trois
chemins du client, l'écran d'envoi, la pose manuelle, et le calendrier.

**Trois gardes pour la même règle** — l'écran, l'action serveur, la contrainte
de base — et une seule fonction pour les trois. Une absence à l'envers
n'occuperait aucun jour et rendrait la capacité fausse en silence.

**Non fait, et dit :** l'équipe inscrite sur un chantier reste une étiquette,
pas une contrainte. Deux chantiers le même matin sur la même équipe passent
toujours. `ARCHITECTURE.md` §109, `docs/QUESTIONS.md` §19.

---

## 2026-08-14


### « Surtout la page équipe » : l'écran qui n'était jamais préparé d'avance

**Son signalement :** *« La connexion est au ralenti sur l'appli. Les nouvelles
pages ne chargent mal ou pas du tout. »* Puis, précis : *« Surtout la page
équipe. »*

**Sa précision était le diagnostic.** Le banc compile ses écrans d'avance pour
qu'ils s'ouvrent du premier coup — mais la liste de ces écrans était écrite à la
main, et Réglages avait été découpé en sept sous-écrans depuis. Aucun des sept
n'y figurait. « Équipe » s'ouvrait donc à froid, pendant que la construction
occupait ses deux cœurs, et le relais de GitHub abandonnait avant que la page
n'arrive.

**Ce que ça évite :** une page qui ne s'ouvre pas et qu'aucun contrôle ne voit.
La liste est désormais confrontée aux écrans réellement présents — un sous-écran
ajouté sans y être inscrit fait rougir `test-prechauffage.ts`, qui le nomme.

### Et une phrase, pour ne plus confondre « ça bâtit » avec « c'est cassé »

Depuis son téléphone, rien ne distinguait les deux : il fallait ouvrir
l'éditeur. Un bandeau le dit maintenant, avec le compte — « Version rapide en
construction, 12 écrans sur 19 déjà prêts » — et **s'efface tout seul** quand
tout est prêt. Il n'existe que sur son banc, jamais ailleurs, et un contrôle
l'éprouve dans les deux sens (`docs/maquettes/46`, `ARCHITECTURE.md` §106).

Le chiffre existait déjà : le préchauffage le comptait, et personne ne l'écrivait
nulle part — la page de diagnostic répondait « pas encore commencé » du début à
la fin.

### Écarté après mesure : bâtir en priorité basse

Plausible et faux. Sur deux cœurs : connexion 16,2 s à priorité normale,
**17,4 s en priorité basse** ; construction 69 s contre 67 s. La contention est
le disque, pas le processeur. **Non livré** — annoncer une réparation supposée
coûte l'essai puis l'aller-retour.

---

## 2026-08-14

### CODÉ : ajouter et retirer des cases dans « Mes prix »

Sa demande du 14 août, capture à l'appui : *« je dois pouvoir ajouter ou retirer
des cases »*, puis devant les trois formes dessinées : *« code les toutes »*.

**Ce que ça change.** Les 82 cases naissaient de constantes écrites dans le
code — huit diamètres, six hauteurs, trois façons d'abattre, cinq travaux.
Elles venaient de ses devis du 8 août, mais étaient figées depuis. Elles se
règlent désormais, à trois niveaux : la **tranche** (dans la grille qu'il
remplit, ou dans le nouvel écran **Mes mesures**), la **façon d'abattre**, et le
**travail entier**.

**Le fait qui commande tout :** une case ne s'ajoute pas toute seule. Un
diamètre de plus en pose **dix** d'un coup — l'écran l'annonce avant qu'il
valide, et le nombre est calculé, jamais écrit à la main.

**Retirer n'efface aucun prix.** Les cases sont rangées, pas supprimées, et
reviennent si la tranche revient. Le tiroir dit combien partent avec elle, et
offre « Annuler » comme partout ailleurs.

**Ce qu'Atlas ne fera PAS**, et l'écran le dit : un travail ajouté par lui n'est
pas reconnu dans une note vocale. Sa grille se remplit et se relit ; le
chiffrage ne la proposera pas de lui-même. Raisons : `ARCHITECTURE.md` §105.

### « Mon compte » et « Connexion » : les deux dernières rubriques sont ouvertes

Sur les treize du sommaire, huit étaient codées. Ces deux-là étaient les seules
qui n'avaient même pas de planche — et les dessiner a révélé que **leur libellé
promettait deux choses qui n'existent nulle part** : un téléphone que la table
des comptes ne porte pas, et une liste d'appareils alors qu'Atlas ne garde
aucune session en base. Le patron a tranché « A A » : les deux mots sont retirés
du sommaire plutôt que d'ouvrir des champs qui ne serviraient à personne.

**Ce que ça apporte, concrètement :** changer son nom, changer son mot de passe
— et **« me déconnecter partout »**, le geste utile un soir de téléphone perdu.
Ce dernier ne coûte qu'une colonne (`users.jetons_valides_depuis`, migration
0042) : plutôt que de tenir une table de sessions, on refuse les jetons signés
avant une coupure. La liste des appareils reste possible plus tard ; avant que
quelqu'un d'autre que lui ne se connecte, elle n'aurait qu'une ligne.

**Sa correction du même jour, et elle valait mieux que ma proposition :** ma
planche remplaçait la seconde saisie du mot de passe par l'œil qui l'affiche. Il
veut **les deux** — l'œil se touche après coup, la confirmation attrape la faute
au moment où elle se fait. L'œil est sur les trois champs : une confirmation
qu'on ne peut pas relire ne confirme rien.

**Ce qui n'est PAS ouvert, et l'écran le dit :** l'e-mail. C'est l'identifiant
de connexion, et rien dans Atlas ne permettrait de vérifier une nouvelle
adresse — ni e-mail sortant, ni SMS. Une faute de frappe fermerait le compte
sans recours. Le champ s'ouvrira quand il y aura de quoi rattraper l'erreur
(`ARCHITECTURE.md` §107).

### L'unité d'un tarif se choisit dans un bandeau, au lieu de se taper

Sa demande du 13 août, capture des tarifs à l'appui : *« crée-moi un bandeau
déroulant avec infos à choisir, jours/hommes, m² etc. »*, puis *« fais celle-là »*
devant la forme 1 de la maquette.

**Ce que ça évite, et qui ne se voyait nulle part.** L'unité désigne un tarif de
main d'œuvre et autorise la multiplication par une quantité — par son **texte, à
la lettre près**. « jour/homme » est reconnu, « jours/homme » ne l'est pas ;
« m2 » et « m² » sont deux unités différentes. Une faute de frappe ne produisait
donc aucune erreur : elle produisait un tarif qui cessait d'être trouvé, en
silence, sur un devis parti chez le client.

**La case reste libre** : le bandeau se termine par une ligne d'écriture. Le
stère, l'arbre, la tonne de grumes — aucune liste ne les devinera, et les
retirer aurait été un recul déguisé en confort.

Deux choses de la maquette ont dû changer, et le pourquoi compte :
« forfait — ne se multiplie pas » était **faux** (un forfait porté par une
quantité confirmée se multiplie ; ce qui ne se multiplie jamais, c'est un tarif
*sans* unité — d'où la ligne « Aucune unité » qui, au passage, permet enfin de
vider un champ pourtant facultatif) ; et le bandeau ne peut pas être posé en
surimpression sur la carte, qui le trancherait. Raisons : `ARCHITECTURE.md` §101.

### La batterie navigateur refuse de partir sans Redis, au lieu de mentir vingt minutes

Lancée sans `REDIS_URL`, elle rendait **vingt rouges qui disaient tous la même
chose** : « dépassement de délai en attendant la redirection après la
connexion » — c'est-à-dire *le formulaire de connexion est cassé*. Il allait
très bien. Le limiteur n'accepte que cinq connexions par quart d'heure pour un
même couple (compte, adresse IP), et le lanceur ne peut remettre ce compteur à
zéro entre deux suites que s'il vit dans Redis.

`run-e2e-tests.ts` refuse désormais de démarrer, et son message nomme le vrai
coupable. La batterie officielle et la CI posaient déjà la variable : c'est
l'appel à la main qui ne l'avait pas. Raisons : `ARCHITECTURE.md` §96.

### CODÉ : les conditions du devis, réglées au lieu d'être en dur

Rubrique **Devis & factures**, migration `0040`. Détail : `ARCHITECTURE.md` §102.

**Ce que ça remplace :** `const VALIDITE = "30 jours"` — une constante, la même
pour tous les artisans, qu'aucun écran ne montrait. Un couvreur qui tient ses
prix quinze jours envoyait un devis qui l'engageait trente.

Se règlent désormais : la **durée de validité**, l'**acompte**, le **délai de
paiement**, les **moyens de paiement**, le **rappel des pénalités** sur le devis
et un **texte de bas de page**. Chacun avec son interrupteur — et les mentions
légales de la facture restent scellées, la ligne le dit là où l'on chercherait
le bouton.

**La validité est RECOPIÉE dans le devis, pas relue.** Sans cela, corriger un
réglage changerait la durée d'engagement d'un devis déjà envoyé, pendant que le
client a une autre feuille sous les yeux.

**« Jamais réglé » n'est pas « éteint ».** Le premier vaut 30 jours, le second
n'imprime rien. Les confondre remettrait la durée sur le devis de quelqu'un qui
l'a retirée.

**Ce qui n'est PAS fait, et qu'il ne faut pas croire acquis :** seule la
validité atteint le PDF. Les cinq autres sont réglés, enregistrés et montrés en
aperçu, mais ne s'impriment pas encore — ils doivent passer par le même
figement. C'est le lot suivant.

Nouveau : `src/lib/conditions-documents.ts`, `/reglages/documents`,
`scripts/test-conditions-documents.ts` (14 contrôles).

### CODÉ : l'équipe d'un chantier validé, et la ligne du planning

Ses deux demandes du 14 août, approuvées sur planche. Détail :
`ARCHITECTURE.md` §100.

**Affilier une équipe sans toucher à la date.** Le geste existait à moitié :
en posant un chantier sur un jour, on choisissait déjà son équipe. Mais un
chantier que le client a validé est celui qu'on ne veut plus déplacer — changer
d'équipe passait donc par un changement de date, c'est-à-dire par un mensonge au
client. La ligne vit dans la feuille du chevron, à côté de « Y aller » et
« Créer la facture », et ne paraît qu'à partir de deux équipes.

**Le refus porte sur les créneaux**, pas sur le jour : deux demi-journées
tiennent sur la même équipe, une journée entière non. Et `EquipeIndisponible`
est distinct de `CreneauIndisponible` — dire « aucune place » devant un planning
à moitié vide enverrait chercher du mauvais côté.

**La ligne du planning** : le chevron rentre de 24 px et passe de 17 à 21 px.
Sa cible reste à 44 px — grossir le signe ne doit pas rétrécir le geste.

**Une suite a rougi en ayant raison** : sans durée dictée, un chantier occupe la
journée ENTIÈRE, pas une demi. Le test se trompait, pas le serveur ; le contrôle
inverse a été ajouté pour que le premier ne passe pas par hasard.

Nouveau : une suite de sept contrôles sur le changement d'équipe — remplacée le
21 août 2026 par `scripts/test-equipes-par-demi-journee.ts`, quand l'équipe est
devenue plusieurs équipes, demi-journée par demi-journée (migration 0058).

### Les équipes reviennent sous « Équipe », et le planning s'explique

**Sa question, le 14 août :** *« les équipes n'apparaissent plus, pourquoi ?
Faut les rajouter dans la catégorie équipe aussi. »* Deux causes, sans rapport.

**Dans les réglages, c'est moi.** Le matin même, le bloc des équipes était parti
sous « Planning » quand l'écran est devenu un sommaire. Le raisonnement tenait —
ici « équipe » désigne une file du planning, pas un compte — mais il ne tient
pas devant l'usage : il les a cherchées sous « Équipe ». Le **même composant**
est désormais servi aux deux adresses, jamais une copie : deux listes qui
divergeraient seraient deux vérités sur ce que le planning propose.

**Sur le planning, c'est sa propre règle du 10 août** : à une seule équipe,
aucun nom ne s'écrit, il n'y a personne à distinguer. Elle ressemble à une panne
quand on l'a oubliée — l'écran « Équipe » la dit maintenant en toutes lettres.

**Et le libellé de la rubrique cessait de mentir** : « Utilisateurs, rôles et
permissions » promettait trois choses qui n'existent pas.

### DESSINÉ : la ligne du planning, et l'équipe d'un chantier validé

Ses deux demandes du 14 août — ramener « Déplacer » et le chevron vers la
gauche, et pouvoir affilier une équipe à un chantier que le client a validé.
`maquettes/atlas-planning-equipe.html`, **44 contrôles au vert**, deux éprouvés
rouges.

**Le décalage se mesure, il ne se raconte pas** : 24 px gagnés, chevron de 17 à
21 px, cible maintenue à 44 px. Et son coût est mesuré aussi — la colonne du nom
perd ces 24 px, un contrôle vérifie qu'aucun nom n'est coupé.

**Le geste de l'équipe existe à moitié** : en posant un chantier sur un jour, on
choisit déjà son équipe. Ce qui manque, c'est la changer ENSUITE — et un
chantier validé est justement celui qu'on ne veut plus déplacer. La ligne se
pose donc dans la feuille du chevron, et promet de ne toucher ni au jour ni à la
demi-journée.

### CODÉ : les quatre saisies de « Mon entreprise »

Ses demandes du 14 août, capture à l'appui, et son choix « A » sur le bouton.
Détail : `ARCHITECTURE.md` §99.

| Ce qu'il demandait | Ce que ça donne |
|---|---|
| l'adresse qui propose | le composant du client, posé ici — il existait depuis le 7 août sans jamais servir sur cet écran |
| le téléphone professionnel | drapeau, indicatif à toucher, sept pays, espaces posés pendant la frappe |
| la forme juridique en liste | dix formes, sigle **et** nom complet, « Autre » qui rouvre le champ libre |
| un bouton d'enregistrement | « Enregistrer » / « Enregistré ✓ », au-dessus des onglets |

**Trois pièges évités, et le deuxième est invisible depuis la France :**
l'espacement suit le PAYS (« 0471 12 34 56 » en Belgique) ; le zéro de tête
disparaît devant l'indicatif, sans quoi le numéro est injoignable de
l'étranger ; et une forme déjà tapée à la main (« Sas ») retrouve son entrée au
lieu de sembler effacée.

**Aucune migration** : le numéro reste rangé tel qu'il s'écrit, l'indicatif se
relit de la valeur. Les documents déjà émis ne bougent pas.

**Le bouton DIT l'état, il ne double pas l'enregistrement automatique** — son
choix. Deux mécanismes auraient donné deux vérités, et il aurait cru perdre ce
qui est déjà écrit.

**Et la capture d'écran mentait sur elle-même** : `capture-identite.mts` vidait
l'identité sans la rendre, si bien que deux prises de suite ont affiché
« SIRET — manquant » sur un jeu complet. Elle restaure désormais.

Nouveau : `src/lib/telephone.ts`, `src/lib/formes-juridiques.ts`,
`scripts/test-telephone-formes.ts` (20 contrôles).

### DESSINÉ : les quatre saisies de « Mon entreprise »

Ses demandes, capture à l'appui : l'adresse qui propose comme chez le client, un
téléphone avec drapeau, indicatif et espacement automatique, la forme juridique
en liste, et un bouton d'enregistrement en bas.
`maquettes/atlas-identite-saisie.html` — **50 contrôles au vert**, deux éprouvés
rouges.

**Le premier point n'est pas un développement** : `ChampAdresse` fait déjà cela
depuis le 7 août, il n'avait pas été posé sur cet écran.

**Le quatrième cache la seule vraie question :** les champs s'enregistrent DÉJÀ
seuls en quittant la ligne. Un bouton qui prétendrait sauver par-dessus
donnerait deux vérités, et le patron croirait perdre ce qui est écrit. Le parti
dessiné : le bouton **dit** l'état — « Enregistrer », puis « Enregistré ✓ ».

**La barre de navigation manquait aux écrans de la planche**, alors que sa
capture la montre. L'oublier aurait validé une hauteur utile qui n'existe pas,
et laissé le bouton se poser là où les onglets se trouvent.

### DÉCIDÉ, CODÉ, PUIS RETIRÉ : le blocage d'un devis sans SIRET

**Le matin**, planche en main, le patron répond « A » à la question 3 : bloquer
l'envoi d'un devis dont l'identité est incomplète. C'est codé — quatre champs
bloquants, refus côté serveur, écran qui liste les manques — et deux captures
lui sont envoyées.

**Le même jour, en voyant l'écran, il tranche l'inverse :** *« il ne faut pas
commencer à modifier les autres rubriques. L'IBAN et le SIRET, c'est des choses
que l'utilisateur va devoir renseigner dans la bonne catégorie. Une fois que
c'est enregistré, il faut que ça s'ajoute automatiquement à la page du devis,
mais c'est tout. Rien de plus, rien de moins. »*

**Ce qu'il refuse est le PÉRIMÈTRE, pas le garde-fou.** Un lot parti des
réglages qui finit par modifier le parcours d'envoi a débordé, quelle que soit
la qualité de ce qu'il ajoute. Tout a été retiré : la règle, le blocage, le
refus serveur, l'écran et leurs suites.

**Ce qu'il demande existe déjà**, vérifié dans le code : le devis recopie
l'entreprise — nom, adresse, SIRET, e-mail, téléphone, IBAN — et un brouillon
rafraîchit cette copie à chaque ouverture. Un SIRET saisi ce soir apparaît sur
le devis dès qu'on le rouvre. Seuls les devis déjà envoyés gardent ce qu'ils
portaient, et c'est voulu.

**Ce qui reste vrai :** un devis part sans SIRET si le patron n'en a pas saisi,
et rien ne l'en avertit. Risque assumé, argument donné. Détail :
`ARCHITECTURE.md` §97.

### DESSINÉ : les trois décisions qui restent, deux écrans chacune

Sa demande : *« fais-moi des visuels pour que je te réponde »*.
`maquettes/atlas-trois-questions.html` — le sommaire en filets ou en cartes,
les prix en trois écrans ou en un seul, et le devis sans SIRET bloqué ou
seulement signalé. **54 contrôles au vert**, deux éprouvés rouges.

**La règle de la planche, et le contrôle qui la tient :** les deux écrans d'une
question portent **exactement les mêmes données**. Sans cela il comparerait deux
contenus au lieu de comparer deux partis — et choisirait une allure en croyant
en choisir une autre.

**Un contrôle a attrapé une exagération dans mon propre texte.** La note
annonçait « cinq fois la hauteur » pour l'écran unique des prix ; le rapport
mesuré valait 2,1. Une planche qui gonfle son propre argument fait pencher le
patron sur un chiffre faux. Le seuil est désormais mesuré, et la note dit ce
qu'elle montre.

Chaque question porte une **recommandation assumée** — « à vous de voir » est
une non-réponse qui lui rend le travail d'analyse —, écrite **sous** les écrans
pour qu'il regarde avant de lire.

### CODÉ : les réglages refondus — un sommaire, et chaque chose rangée dessous

**Sa demande, le 14 août 2026 :** *« je veux que tu recrées entièrement la page
de réglage. La modifier totalement. Et ce qu'on a déjà, soit tu crées les
catégories qu'il y a besoin, soit s'il va y avoir des doublons, tu supprimes.
Exemple, les prix de main-d'œuvre et de machine, eh bien ça, tu l'intègres
directement dans la partie tarif. »*

**L'écran était devenu une page à défilement de douze blocs sans hiérarchie**,
chacun ajouté au bas du précédent le jour où il est né. Changer un prix
demandait de faire défiler quatre écrans, et deux réglages fiscaux — le régime
de TVA et la périodicité — vivaient à deux endroits séparés par tout le reste.

**Rien n'a été jeté : tout a été rangé.** Les tarifs, les grilles de prix et le
catalogue sous « Tarifs & catalogue » ; la périodicité de TVA auprès du régime,
dans « Mon entreprise » ; les équipes du planning dans « Planning » — le mot y
désigne une FILE DU PLANNING, pas un compte ; le vocabulaire du métier sous
« Atlas IA », puisque c'est ce qu'elle sait reconnaître d'une dictée ; le
téléchargement des données sous « Sécurité & données ». La version exécutée
reste sur le sommaire : ce n'est pas un réglage, c'est la réponse à « mes
correctifs sont-ils arrivés ».

**Les trois façons de dire un prix n'ont PAS été fusionnées** : un tarif est une
ligne libre, une grille s'apprend de ses devis, le catalogue est du vocabulaire
partagé sans aucun prix. Les mêler ferait croire qu'un prix du catalogue est le
sien — c'est-à-dire inventerait une donnée.

**Premier endroit d'Atlas où le rôle décide de ce qu'un écran RESTITUE.**
`getRole` n'était appelé dans aucun écran : un membre voyait tout. Le sommaire
ne lui rend que l'ensemble « Moi » — pas grisé, pas masqué : absent — et chaque
rubrique de l'entreprise refuse un non-propriétaire avant de lire la moindre
valeur. **Cela ne ferme pas le sujet** : le reste de l'application ne cloisonne
toujours rien.

**Deux suites étaient vertes en éprouvant une page d'erreur.** `/reglages/mes-donnees`
n'a jamais existé, et deux suites navigateur la parcouraient dans leur liste
d'écrans. Une troisième — le vocabulaire réservé à l'éditeur — serait devenue
verte par accident, en cherchant un lien à un endroit où plus personne ne le met.

Nouveau : `src/lib/rubriques-reglages.ts` (fonction pure : les rubriques, leur
ordre, et qui les voit), `scripts/test-rubriques-reglages.ts` (13 contrôles),
`scripts/capture-reglages.mts`. Détail et raisons : `ARCHITECTURE.md` §96.

### DESSINÉ : le sommaire des réglages, d'après la planche du patron

Il a envoyé une planche qu'il n'avait pas demandée — un sommaire noir et or,
dix rubriques, une icône chacune — avec ce seul mot : « c'est ça que je
voulais ! ». `maquettes/atlas-reglages-sommaire.html` la reprend, dans la
couleur de l'application. **59 contrôles au vert**, dont trois éprouvés rouges.

**Trois choses de sa planche sont meilleures que les miennes** : l'icône par
rubrique (treize lignes de texte se parcourent mal), « Devis & factures »
plutôt que « Documents » (personne ne cherche « Documents » pour changer un
acompte), et **Planning**, qui figurait dans ses quatre priorités et n'avait
pas de rubrique.

**Les couleurs ont été demandées, pas devinées.** Sa planche était sombre,
l'application est crème ; un seul écran sombre au milieu de vingt se lit comme
un écran d'une autre application. Il a répondu « crème, comme le reste ». Le
mode sombre reste « Apparence », marquée *Bientôt*.

**Deux ensembles qu'il n'avait pas dessinés, et qui ne se négocient pas** :
« Moi » et « L'entreprise ». Sa liste de dix était plate, et il n'y avait donc
nulle part où couper — alors que c'est lui qui a posé la règle du salarié qui
ne voit pas les tarifs. Le troisième écran montre ce que la liste devient pour
lui : les neuf rubriques de l'entreprise ne sont pas grisées, elles sont
**absentes**.

**Ce qu'il reste à trancher :** filets ou cartes. Les deux registres portent la
même liste — s'ils divergeaient, il choisirait une allure en croyant en choisir
une autre, et c'est le contrôle le plus important du vérificateur.

Détail et raisons : `ARCHITECTURE.md` §95.

---

## 2026-08-14

### « L'appli ne marche plus » : elle marchait, c'est l'espace qui dormait

**Sa capture, tard le 14 août :** il ouvre son favori Atlas et son iPhone lui
propose de **télécharger un fichier** portant le nom de l'adresse, l'onglet
restant sur `about:blank`. *« L'appli ne marche plus. Je vais me coucher,
corrige-moi ça tout seul. »*

**Ce n'était pas l'application, et c'est sa propre machine qui l'a dit.** La
fiche d'état que son espace publie (`scripts/rapporter-espace.mjs`) portait,
vingt-six minutes plus tôt :

```
Branche suivie   : main
Code récupéré    : 08a5377          ← le correctif de la veille, bien arrivé
Serveur          : répond sur le port 3000
```

Puis plus rien. Or le veilleur réécrit cette fiche **tous les quarts d'heure**
tant que l'espace tourne : passé vingt minutes de silence, l'espace est arrêté.
GitHub éteint un espace inactif au bout d'une trentaine de minutes ; l'adresse
survit, plus personne ne répond derrière, et Safari — qui ne sait que faire de
ce silence — propose d'enregistrer la réponse. D'où le téléchargement.

**Le code, lui, a été mis à l'épreuve avant de conclure**, et pas seulement par
la batterie qui tourne en mode développement :

- `next build` passe ;
- la version **bâtie**, démarrée en profil `banc`, sert bien `200 text/html`
  sur `/` comme sur `/login`.

**Deux enseignements, et le second vaut plus que le premier.**

1. **La fiche d'état a fait son travail**, et pour la première fois : elle a
   répondu « est-ce lui ou est-ce nous ? » sans lui faire recopier un terminal
   depuis un téléphone. C'est exactement ce pour quoi elle a été écrite le
   12 août.
2. **Rien ne le lui disait, à lui.** La fiche est écrite pour l'agent, sur
   GitHub. Le mode d'emploi qu'il peut ouvrir — et qui reste lisible quand son
   espace est éteint — ne couvrait que la panne de l'ÉDITEUR, pas celle-ci.
   `docs/ESSAYER.md` porte désormais une section à son nom, avec sa capture
   décrite dans ses mots, le remède en deux gestes, et le lien vers la fiche
   d'état — avec la règle des vingt minutes pour trancher en un coup d'œil.

**Ce qu'on ne peut pas corriger, et il faut le dire :** l'extinction est une
règle de GitHub, pas d'Atlas. Elle disparaîtra le jour où Atlas tournera sur un
vrai hébergement. Un espace qui dort n'est pas une panne.

---

## 2026-08-13

### Le devis se reprend enfin AVANT de partir

*« J'ai un devis sur le feu […] mais si je veux modifier mon devis avant de
l'envoyer, je peux pas. »* Il avait raison : « Modifier mon devis » n'existait
que sur l'écran du devis **parti**. Avant l'envoi — au moment précis où l'on
corrige — aucun chemin ne menait au devis modifiable.

Cinq propositions lui ont été dessinées avant d'en coder une ; il a retenu
**« Modifier » en or, en face du titre**. Sa première idée — le mot « Devis »
lui-même cliquable — a été écartée par lui après les avoir vues : un titre qui
est secrètement un lien ne s'annonce pas.

**Ce que ça évite, et qui n'est pas la place du mot :** le lien n'apparaît
qu'avant l'envoi. Un devis parti ne se modifie plus — la base refuse la première
frappe — il se *reprend*, ce qui ouvre une nouvelle version, et c'est un geste
qu'il décide. Offrir « Modifier » après l'envoi l'aurait mené sur un document
mort sans lui dire pourquoi.

Le contrôle a été confronté aux **deux** états dégradés — lien absent, puis lien
survivant à l'envoi — et rougit sur chacun. Il vérifie en plus que l'écran
d'après l'envoi garde son propre geste : sans cela, on passerait au vert en
retirant le lien partout.

`ARCHITECTURE.md` §104.


### Deux maquettes perdues en silence dans la page unique

**Trouvé en ajoutant la planche du devis modifiable.** `fusionner-maquettes.mjs`
tient la liste des maquettes à assembler. Deux entrées — la 40 et la 44 —
avaient fusionné en **un seul objet** : le `},{` qui les séparait manquait.
JavaScript ne s'en plaint pas, il garde la dernière valeur de chaque clé.

Résultat : **la maquette 40 avait disparu de la page unique**, celle qu'on lui
envoie. Le script annonçait « 33 maquettes fusionnées » et le contrôle
« 33 titres cliqués, 33 sections peintes » — deux chiffres cohérents entre eux
et faux tous les deux, puisqu'ils comptaient la liste, pas le dossier.

Le sommaire portait le même genre de faute : l'entrée 40 n'était pas refermée,
si bien que le titre de famille suivant devenait un morceau de lien.

Réparé : **35** maquettes, la 40 revenue et la 45 ajoutée.

**Ce qui resterait à faire, et qui n'est pas de ce lot :** un contrôle qui
compare la liste au contenu de `docs/maquettes/`. Tant qu'il n'existe pas, une
maquette oubliée dans la liste ne se voit qu'à l'œil.

### Le devis modifiable avant l'envoi — cinq propositions dessinées

**Sa capture de 21 h 00 :** *« si je veux modifier mon devis avant de l'envoyer,
je peux pas »*. Il a raison : « Modifier mon devis » n'existe que sur l'écran du
devis PARTI. Avant l'envoi, aucun chemin ne mène au devis modifiable.

Sa demande — rendre le mot « Devis » cliquable — est dessinée telle quelle,
avec la marque qui la rend trouvable, à côté de quatre autres façons
(`docs/maquettes/45-modifier-son-devis.html`). **Rien n'est codé** : il choisit
d'abord (`CLAUDE.md` §3 bis).


### CODÉ : l'identité de l'entreprise, et le régime de TVA qui cesse d'être deviné

**Premier lot des réglages qui passe du dessin au code** — et c'est celui qui
bloquait la commercialisation. Migration `0039`, écran `/reglages/identite`,
suite `scripts/test-identite-entreprise.ts`. **128/128 suites base au vert.**

**L'identité se saisit enfin dans les réglages.** Elle ne s'écrivait que depuis
« le devis rédigé à la main » : un artisan qui dictait, chiffrait et envoyait
n'avait jamais l'occasion de saisir son SIRET, et son premier devis partait sans
SIRET ni IBAN, sans un mot.

**Le régime de TVA se déclare.** Il était DEVINÉ — « le taux vaut zéro, donc
c'est une franchise » — et se trompait dans les deux sens : une franchise perdait
sa mention obligatoire dès qu'un 20 % traînait, un assujetti voyait s'imprimer
« TVA non applicable » sur une pièce comptable.

Trois précautions autour de ce changement. **Le défaut est « assujettie »**,
celui qui ne change rien au comportement d'avant. **Le régime est figé dans la
facture**, comme le reste de l'identité : une facture émise sous franchise garde
sa mention même si l'artisan devient assujetti ensuite. Et **le repli sur le taux
demeure** pour les factures antérieures — la migration recopie même cette
déduction une dernière fois, pour que les factures déjà émises gardent
exactement ce qu'elles ont imprimé.

**Deux erreurs de ma propre suite de tests, gardées en mémoire** : elle lisait le
mauvais champ de la trace — deux cas rougissaient à tort, et un troisième
**passait pour une mauvaise raison**, vérifiant une absence dans un texte jamais
lu. Puis elle comparait une fonction au lieu de son résultat. La suite a ensuite
été confrontée à l'ancien code, et elle rougit sur les deux cas exacts que ce lot
corrige.

---

### Réglages, lot 7 : les cinq dernières rubriques — le dessin est complet

`maquettes/atlas-reglages-reste.html` : Atlas IA, intégrations, apparence,
sécurité, abonnement. **Les dix rubriques qu'il a demandées sont dessinées.**

Quatre arbitrages. **Les trois arrêts de l'agent ne se coupent pas** — envoyer un
devis, poser une date, émettre une facture portent « Toujours vous » à la place
où l'on chercherait leur interrupteur. **Un interrupteur mort est pire qu'une
absence** : le mode sombre porte « Bientôt » et aucune bascule. **L'apparence
montre** quatre pastilles de couleur réelles, sans un adjectif. Et **« tout est
effacé » serait faux** : les factures se conservent dix ans, dit avant le geste,
pas après.

Un mot qui trompe désamorcé au passage : sur l'écran d'abonnement, « vos
factures » désigne celles qu'Atlas envoie, pas celles de ses clients.

**Quinze planches, 923 contrôles au vert.** Le dessin est fini ; le code, lui,
ne l'est pas — le tableau des dix rubriques et de leur état réel est dans
`ARCHITECTURE.md` §93.

---

### Réglages, lot 6 : les notifications — huit familles, une seule qui existe

`maquettes/atlas-reglages-notifications.html`, trois écrans. Rien dans `src/`.

**L'état réel, dit à l'écran :** aucune notification ne sort de l'application
aujourd'hui. Une seule famille existe — ce qu'est devenu un devis parti — et
elle s'affiche seulement sur l'accueil. **Le SMS est écarté**, et c'était déjà
tranché le 4 août : le porter comme « bientôt » serait promettre ce qui a été
refusé.

**Huit familles rangées en trois groupes, l'argent d'abord** — huit
interrupteurs à la file font une liste qu'on parcourt sans lire. Le canal se lit
**sur la ligne**, pas dans une grille de seize cases. Et **la phrase exacte est
montrée** : « Facture Martin, 1 240 €. En retard depuis 7 jours. » se juge, « une
alerte d'impayé » non.

**L'impayé se coupe, mais prévient** : l'éteindre, c'est accepter de ne plus
savoir qu'on n'est pas payé. Rien n'est verrouillé — une notification ne pose ni
problème juridique ni problème moral. Et **tout éteindre ne coupe pas d'Atlas** :
les cartes de l'accueil restent, c'est seulement Atlas qui cesse de déranger.

---

### Réglages, lot 5 : les documents — et le modèle qu'on ne remplace pas

`maquettes/atlas-reglages-documents.html`, quatre écrans : les conditions à
interrupteurs, les deux textes libres, le logo, et la réponse à sa question sur
le modèle. Rien dans `src/`.

**Sa question, et il avait posé lui-même la bonne réserve** — *« changer son
devis par le sien, si c'est possible sans casser toute la structure automatisée
créée »*. Ce n'est pas possible : un devis n'est pas une feuille, c'est un
document **calculé**. Le nombre de lignes change, les totaux se déplacent, la
page suivante reprend l'en-tête ; un modèle importé ne saurait pas où poser un
total qui bouge.

**L'écran ne se contente pas de refuser :** il nomme d'abord ce qui est possible
— logo, conditions, textes —, puis l'unique point refusé, puis **les deux côtés
de l'échange**, ce qu'on y gagne et ce qu'on y perd. Un refus sans raison se lit
comme une paresse.

**Le logo est montré à sa taille réelle** (26 mm sur le papier) : un aperçu deux
fois trop grand ferait valider un logo illisible imprimé. Et **« extraire le logo
d'une photo » revient à déposer une image** — même geste pour lui, un pas de
moins qui peut rater.

**Les deux textes libres sont distingués** : les conditions particulières valent
pour CE devis, le bas de page revient sur toutes les pièces. Les fondre en un
champ produirait un texte imprimé deux fois, ou nulle part. Enfin, **le rappel
des pénalités sur le devis part éteint**, et l'écran dit pourquoi : certains
clients le lisent comme une méfiance. Un défaut choisi se justifie.

---

### La direction : un deuxième cerveau, et l'état réel de sa mémoire

**Posé par le patron :** *« créer un deuxième cerveau au sein de l'application,
pour qu'elle s'utilise comme un assistant de gestion / devis, facture, planning.
Elle doit apprendre, enregistrer, s'améliorer, s'auto-alimenter. »*

Écrit dans le dépôt avant d'aller plus loin, avec **le recensement de ce qui
apprend vraiment** : la mémoire des prix facturés, les cinq grilles remplies par
les devis réels, la base documentaire — les trois sont bien alimentées.

**Et ce qui ne retient rien**, par ordre de poids : **le temps réel d'un
chantier** (Atlas ignore donc si ses estimations de durée sont justes, alors que
c'est la durée qui fait le prix), les coûts de chiffrage, les délais de paiement
réels, et ce qu'un client refuse.

**La leçon qui commande ce chantier, et qui a déjà été payée :**
`historique_prix` existait, le chiffrage la lisait, et l'application ne
l'écrivait jamais. Devant toute idée d'apprentissage, la question n'est pas
« avons-nous une table ? » mais **« qui l'écrit, et à quel moment du
parcours ? »** Un lot qui ne désigne pas un geste — une clôture, un paiement, un
refus — produira du décor.

`docs/QUESTIONS.md` gagne deux entrées : **15**, ce dont l'IA se sert pour faire
un devis (et ce qui ne part jamais chez un fournisseur : nom, adresse, SIRET,
IBAN) ; **16**, le deuxième cerveau.

---

### Réglages, lot 4 : tarifs et catalogue — les quatre priorités sont dessinées

`maquettes/atlas-reglages-tarifs.html`, quatre écrans : ses tarifs rangés en
trois familles, la famille qui commande l'unité, ses cinq grilles, et le premier
jour. Rien dans `src/`.

**Trois choses existaient déjà sans être distinguées :** ses **tarifs** (une
liste plate, à lui), ses **cinq grilles de prix** (qui naissent vides et
apprennent de ses devis), et le **catalogue** — partagé, tenu par l'éditeur, le
même chez tous, et qui ne porte aucun prix. L'écran des réglages les mettait
côte à côte sans le dire : un artisan ne savait pas s'il touchait quelque chose
qui lui appartient.

**Ce que la planche tranche.** Trois familles — prestations, main-d'œuvre,
matériel —, et **la colonne n'existe pas en base**. **L'unité suit la famille** :
une main-d'œuvre se compte en temps, un matériel à la journée ; proposer les
mêmes vingt unités aux trois, c'est se tromper une fois sur dix, et l'erreur ne
se voit que sur le devis du client. **Un prix sans unité est signalé sur sa
ligne** — « 90 € » ne dit pas si c'est par mètre cube ou par voyage. Et **une
grille vide se dit vide** en disant pourquoi : c'est l'état normal du premier
jour, et Atlas préfère se taire qu'inventer.

**Sa question — « mais l'IA se servira de ces infos pour constituer les
devis ? » — a mis au jour un réglage invisible.** La réponse est oui, et dans un
ordre précis : Atlas cherche d'abord dans ses **tarifs** ; si plusieurs
correspondent **il ne choisit pas** et les montre ; si aucun ne correspond il
**calcule** ; s'il ne peut pas calculer il **se tait** et écrit « prix à
renseigner ». Son identité — SIRET, IBAN, adresse — n'est **jamais envoyée au
modèle** : elle est recopiée dans le document.

Mais le calcul du point 3 s'appuie sur `parametres_chiffrage` : **cinq valeurs
par entreprise — 200 €/jour l'ouvrier, 280 € le chef, 35 € le déplacement, 20 %
de marge — et aucun écran ne permet de les changer.** Un artisan dont l'ouvrier
coûte 260 € verra des prix trop bas sans savoir d'où ils viennent. Un cinquième
écran, « Mes coûts », les montre avec l'ordre de recherche en quatre pas.

**Ajouter et supprimer, demandés le même jour** — *« pouvoir aussi ajouter ou
supprimer du matériel, ou un prix, ou un machin »*. **Un geste d'ajout par
famille**, qui la nomme et ferme sa liste : « Ajouter » tout court obligerait à
choisir la famille sur un écran de plus. **La suppression vit au bas de la
fiche** — une corbeille sur chaque ligne se touche du pouce en faisant défiler —
et **demande confirmation en disant ce qu'elle ne casse pas** : vérifié dans le
code, `supprimerTarif` pose `deletedAt` et aucune ligne de devis ne pointe vers
un tarif. Un devis déjà fait garde son prix. Le taire aurait suffi à bloquer
l'artisan : personne n'ose supprimer dans le doute.

**Le contrôle des bandes vides, élargi à tous les écrans**, a trouvé un vrai
défaut sur la planche de l'équipe — et cinq faux positifs : une liste dont
chaque ligne porte un filet met 39 px entre deux traits, et c'est normal. Il
regarde désormais **s'il y a du texte entre les deux filets**. Une alerte qui
accuse à tort coûte plus cher que pas d'alerte.

---

### Réglages, lot 3 : l'équipe et les rôles — le mot était déjà pris

`maquettes/atlas-reglages-equipe.html`, quatre écrans : qui a accès, le rôle et
ce qu'il change, le devis vu par un salarié, et l'état « seul ». Rien dans
`src/`.

**« Équipe » désigne déjà autre chose dans Atlas** : une file du planning —
combien de chantiers partent en même temps —, pas un compte. Les deux ne se
recouvrent pas : une file peut s'appeler « Équipe B », deux ouvriers qui
n'ouvriront jamais l'application ; un commercial a un compte et ne conduit aucun
chantier. La rubrique tient donc **deux listes séparées**, et le dit. Les fondre
aurait produit la question insoluble « pourquoi mon commercial est-il dans le
planning ? ».

**Trois réserves, vérifiées dans le code :** le rôle « commercial » n'existe pas
en base ; **aucun parcours d'invitation** n'existe (le dépôt sait ajouter un
membre, aucun écran ne l'appelle) ; et surtout **le cloisonnement en lecture
n'est pas codé** — `exigerProprietaire` protège vingt-trois écritures, mais
`getRole` n'est appelé dans aucun écran : **un membre voit aujourd'hui tous les
prix et tous les montants**, ce que `QUESTIONS.md` §10 refuse expressément.

**Deux décisions de forme.** Un rôle dit **ce qu'il ferme**, pas seulement ce
qu'il ouvre — n'énumérer que les droits laisse croire que le reste est permis.
Et l'écran d'un salarié **ne laisse aucune place pour un montant** : pas de
colonne de prix, pas d'emplacement vide. Un blanc dirait « il y a un chiffre
ici, on te le refuse », et le premier réflexe serait d'ouvrir le PDF.

**La question du 7 août est tranchée le 13, et autrement que prévu.** À
*« le salarié voit-il tout le planning, ou seulement ses chantiers ? »*, le
patron répond : *« accès à tout, mais le patron choisira s'il a accès qu'à ses
chantiers ou à tout »*. Ni l'une ni l'autre des deux options : un **réglage par
personne**, et **le défaut est « tout »** — restreindre est un geste, pas un
état de départ. Le rôle « commercial » est validé tel que dessiné.
`docs/QUESTIONS.md` §10 porte le tableau des quatre rôles ; `docs/A-FAIRE.md`
§9, ajouté à sa demande, porte ce qui bloque la commercialisation.

**Défaut vu à l'œil :** un bloc imbriqué reprenait la marge de son parent et se
retrouvait à 52 px, décalé de tout le reste. Le contrôle du retrait mesure
désormais tous les blocs, et vaut pour les trois planches.

---

### Réglages, lot 2 : l'identité — et trois manques qu'elle a révélés

`maquettes/atlas-reglages-identite.html`, cinq écrans : identité, SIRET, régime
de TVA, coordonnées et banque, puis l'état où les champs manquent. Rien dans
`src/` (`CLAUDE.md` §3 bis).

**Dessiner cette rubrique a obligé à relire ce que la base porte et ce que le
PDF imprime. Trois écarts en sont sortis, aucun cosmétique :**

1. **Le régime de TVA est deviné.** `facture-pdf.ts` imprime la mention de
   l'article 293 B quand le taux vaut zéro — il déduit donc le régime fiscal
   d'un chiffre saisi chantier par chantier. Les deux sens sont faux : une
   franchise perd sa mention si 20 % traîne dans un devis, un assujetti voit
   s'imprimer une phrase qui ne le concerne pas. Le régime doit être **déclaré
   une fois**.
2. **Le numéro de TVA intracommunautaire n'existe nulle part** — ni en base, ni
   sur le document. *Réserve : les mentions obligatoires n'ont pas pu être
   vérifiées à leur source d'ici (le réseau refuse les sites publics). L'écran
   le dit et renvoie au comptable. Ne pas coder sur la foi de cette planche.*
3. **Le téléphone et l'e-mail sont saisis et ne s'impriment nulle part.** Le
   bloc « Émetteur » porte trois lignes : nom, adresse, SIRET. Un client qui
   veut appeler n'a pas de numéro sous les yeux.

**Deux décisions de forme.** Le **SIREN ne se saisit pas** : il est les neuf
premiers chiffres du SIRET, et l'écran le montre au lieu de le redemander — deux
saisies seraient deux façons de se contredire. Et le **manque se signale sur la
ligne** (« SIRET — manquant », trait rouge) en disant ce qu'il empêche : « vos
factures ne sont pas conformes », jamais « champ requis ». Le champ reste vide :
un exemple plausible finirait imprimé sur une pièce comptable.

**Rappel du patron le même jour, et il change le poids de ce lot :** *« quand
l'application sera commercialisée, le devis sera vierge, et c'est avec ces
informations-là qu'il devra se remplir automatiquement ».* Vérifié dans le code,
et l'enchaînement est lourd — **son banc ne montre jamais cet état** (le jeu de
départ pose « Atelier Démo » complet, IBAN compris) ; **il n'existe aucun
parcours d'inscription** ; **l'identité ne se saisit que dans le devis écrit à
la main**, jamais dans les réglages ; **rien ne la vérifie avant l'envoi** ; un
repli poli écrit déjà « Votre entreprise » à la place d'un nom absent ; et **le
devis fige l'identité à sa création**, si bien que corriger son SIRET ce soir ne
répare aucun devis déjà fait.

Deux écrans de plus le montrent : **« Le premier jour »** (compte neuf, trois
rubriques « À REMPLIR », et ce qui peut attendre laissé au calme) et **« Ce qui
est figé »** (un devis dont le SIRET manque, et pourquoi la correction ne vaudra
que pour les suivants).

**La charte devient un module partagé**, `maquettes/charte.mjs` : couleurs
comparées aux jetons, absence d'ombre, grammaire des écrans, retrait de 26 px.
Une seule implémentation pour toutes les planches (`CLAUDE.md` §3).

**Deux défauts trouvés sans test, et un test qui accusait à tort.** L'encart
d'alerte touchait les bords de l'écran ; la dernière ligne manquante perdait son
trait rouge ; et la mesure des cibles comptait une ligne repliée, faisant rougir
un écran sain.

---

### Les réglages : le plan dessiné avant les dix rubriques

**Il a listé dix rubriques d'un coup** — entreprise, équipe, tarifs, documents,
Atlas IA, notifications, intégrations, style, abonnement, sécurité — puis :
*« à toi de décider si on fait tout d'un coup ou rubrique par rubrique pour
qu'il n'y ait pas de problème »*.

**Décision : par lots, et le plan d'abord.** Les dix rubriques héritent des
mêmes trois choix — les deux niveaux, le rôle qui voit, la forme de
l'interrupteur. Les figer sans les regarder aurait condamné les neuf suivantes
à être refaites le jour où l'un d'eux bougeait.

`maquettes/atlas-reglages-plan.html` porte donc quatre écrans : les réglages vus
par le **patron**, par le **commercial**, par le **salarié**, et l'écran de
**l'interrupteur**. Rien dans `src/` (`CLAUDE.md` §3 bis).

**Ce qui s'y décide, et attend son accord :**

- **Deux ensembles, « Moi » et « Mon entreprise »**, dans cet ordre — sa phrase
  du 13 août sur le salarié qui change son mot de passe mais pas les tarifs ;
- **une rubrique absente n'est pas une rubrique masquée.** Ce qu'un rôle n'a pas
  le droit de voir ne sort pas du serveur (`QUESTIONS.md` §10, 7 août). Le
  contrôle cherche les mots interdits dans TOUT le texte de l'écran, pas dans
  ses lignes visibles ;
- **le rôle « commercial » est neuf et n'est acquis nulle part** : la base ne
  connaît que `proprietaire` et `membre`, et les décisions écrites que
  l'éditeur, le patron et le salarié. Il est dessiné pour être tranché ;
- **ce qui n'aura jamais d'interrupteur** : les mentions légales de la facture,
  l'identité de l'émetteur, la numérotation continue, la conservation légale. La
  ligne scellée reste DANS la liste, avec sa raison — c'est là qu'il cherchera
  le bouton.

**Un défaut trouvé à l'œil, pas par un contrôle.** Le champ de l'acompte
affichait « soit 1 044 € sur 3 480 € » : une maquette sans script ne recalcule
pas, et taper 15 laissait le montant de 30 % à côté. Cinquante contrôles au vert
pendant que l'écran se contredisait. Retiré, et un contrôle posé pour que ça ne
revienne pas.

**La planche porte la charte de l'application, valeur pour valeur.** Sa consigne
du même jour : *« toujours en respectant le style de l'appli ultra luxe et très
moderne »*. Les maquettes portaient un nuancier à elles — proche des jetons,
jamais égal. Celle-ci recopie `src/lib/design-tokens.ts`, et **le contrôle lit le
fichier de jetons pour comparer** : un écart rougit en nommant le jeton et la
valeur attendue.

Dans cette charte, le luxe est fait de ce qu'elle REFUSE — aucune ombre, 4 px de
rayon, aucune bordure sur les plages, deux accents aux rôles distincts. Un
dégradé ajouté « pour faire haut de gamme » irait contre ce qu'il a retenu le
10 août ; un contrôle interdit désormais toute ombre dans l'écran.

**Corrigé au passage :** `docs/DESIGN_SYSTEM.md` annonçait encore Playfair
Display et Inter (faux depuis le 10 août — polices du système) et la terre cuite
sur les documents (faux depuis le 10 août — l'or). On ne respecte pas une charte
dont la documentation ment.

**La planche parle la grammaire des ÉCRANS** — *« garde le style de toutes les
pages, pas du devis et facture »*. Quatre écarts relevés **dans le code** des
composants réels, pas à l'œil : le retrait de page est de 26 px et non 24 ; le
titre fait 36 px ; un **cheveu ferme l'en-tête** et manquait ; les titres de
section sont **gris avec un trait au-dessus**, et non dorés avec un filet à
droite ; la barre basse porte 9,5 px / 0,28 em, l'onglet actif monté de deux
pixels.

**La cause commune des libellés rétrécis :** l'écran de la planche ne mesurait
que 336 px au lieu de 390 — le cadre du téléphone lui prenait 54 px. La barre
basse de l'application n'y tenait pas, alors les planches successives avaient
rapetissé sa chasse jusqu'à 9 px, en le justifiant par un commentaire recopié de
l'une à l'autre. **On validait une barre plus petite que la vraie.** Sous 520 px,
la coque s'efface et l'écran occupe toute la largeur du téléphone.

**Deux doublons de filets, vus à l'œil :** le cheveu de l'en-tête au-dessus du
trait du premier bloc, et le filet de la dernière ligne d'une liste au-dessus du
trait de la section suivante — deux traits séparés par 30 px de vide. Un filet
qui ne sépare plus rien n'est pas un filet.

**Aucune de ces quatre corrections n'avait été vue par un contrôle** : la
planche était verte sur soixante-deux points pendant qu'elle parlait une autre
grammaire. Huit contrôles neufs tiennent désormais chacune d'elles.

**Les planches se lisent en gros plan** — *« que je les voie mieux, mais tout
dans un .html comme d'habitude »*. C'est une **loupe** (`zoom`), pas un téléphone
élargi : les proportions restent celles d'un iPhone, et une cible de 44 px reste
une cible de 44 px. Élargir le cadre aurait fait tenir les libellés sur une ligne
et menti sur ce qu'il aura sous le pouce. La loupe n'agit qu'au-dessus de
1000 px, ce qui laisse les contrôles mesurer les vraies dimensions — et un
contrôle vérifie précisément cela, sans quoi une cible de 30 px passerait pour
44. Une planche par rangée, son texte à côté.

**Les lots suivants**, dans l'ordre de ses priorités : identité de l'entreprise,
équipe et rôles, tarifs, documents (conditions, logo, mentions), notifications,
puis le reste.

---

### Un ticket daté d'un autre mois ne disparaît plus sous les yeux du patron

**Son signalement, photo à l'appui :** *« J'ai ajouté ce ticket via phototech
dans l'application TVA, mais il n'est jamais apparu dans la TVA déductible. »*
Ticket de gazole du **24 juillet**, ajouté le 13 août depuis l'écran d'**août**.

**Rien n'était perdu** : l'achat était en base, dans juillet, exactement où il
devait aller. Mais l'écran ne montre qu'une période — total collecté, total
déductible, liste des achats, les trois tirés des mêmes bornes. Aucun des trois
chiffres ne bougeait, et rien ne disait pourquoi. De son point de vue, le geste
n'avait rien produit.

**Ce qui change.** La feuille annonce la destination *avant* qu'il appuie
(« il ira dans Juillet 2026, pas dans Août 2026 »), et l'écran l'y **emmène**
après l'ajout — pas un message à lire puis à suivre : le chiffre est sous ses
yeux.

**Ce que ça évite :** de conclure qu'une saisie n'a pas été prise alors qu'elle
l'a été, et de la refaire. Un doublon de TVA déductible ne se voit pas non plus
à l'écran — il se voit chez le comptable.

**Un correctif qui ne corrigeait rien, attrapé de justesse.** La première
version faisait `router.push(...)` puis `router.refresh()` : les deux
s'annulaient, `refresh` redemandant l'adresse courante. L'écran ne bougeait pas,
sans la moindre erreur. Vu à la sonde uniquement (`ARCHITECTURE.md` §106).

**Nouveau contrôle :** `scripts/test-achat-hors-periode-e2e.ts` traverse le
parcours entier et rougit sur quatre cas quand on retire la réparation.

---

## 2026-08-14

### Les équipes deviennent des cases au moment de poser — son geste C

**Sa demande du 14 août, après avoir vu A tourner :** *« tu peux faire la C »*.

**Ce que C règle, et ce qu'il ne règle pas.** Contrairement à A, il ne comblait
aucun trou : le choix de l'équipe existait déjà dans le panneau du jour. Mais il
se présentait en **lignes de liste** — elles se lisent, elles ne s'offrent pas.
C'était le cœur de sa remarque d'origine : *« pas intuitif »*. Le geste qu'on
fait à chaque nouveau chantier, désormais, ressemble enfin à un choix.

| Avant | Maintenant |
|---|---|
| des lignes empilées, une par équipe | **des cases côte à côte**, deux par demi-journée |
| le bouton n'apparaissait qu'APRÈS le choix | il reste à l'écran, **éteint**, et dit « Choisissez d'abord » |

**Le bouton absent était le vrai défaut de cet écran** : rien ne demandait quoi
que ce soit au doigt, l'écran attendait en silence. Il nommait déjà le choix une
fois fait — « Poser · matin · Équipe B » — mais seulement une fois qu'il était
trop tard pour aider.

**Une seule source pour les deux formes** (`CaseCreneau`) : l'état d'un créneau —
libre, visé, posable — décide à la fois de ce qu'on peut toucher et de ce que le
serveur revalidera. Écrit deux fois, l'une des deux aurait fini par autoriser un
appui que l'autre refuse.

**À une seule équipe, la ligne reste** : il n'y a personne à désigner, et une
case pleine largeur ne choisirait rien. Au-delà de deux ou trois équipes, les
cases reviennent à la ligne — assumé, et plus lisible qu'une colonne de vingt.

**Le contrôle des boutons arrondis a eu raison contre la maquette, au premier
passage.** Elle dessinait des rectangles de 10 px ; le patron avait demandé le
12 août *« la même forme partout »*, et `test-boutons-arrondis.ts` l'a attrapé.
Les cases sont donc des **pastilles**, ce qui impose une ligne unique — deux
lignes dans un stade se collent à la courbe. Le point médian sépare aussi bien
que le retour à la ligne, et la case reste plus basse : « Équipe A · Libre ».

**L'autre contrôle mesure, il ne lit pas une classe** : deux créneaux d'un même
moment doivent avoir le MÊME haut. Empilés en liste ils seraient décalés d'une hauteur
de ligne — c'est la seule façon de distinguer une case d'une ligne sans se fier à
un nom de style qui peut changer.

---

### Retirer une équipe : le geste manquait par le chevron

**Sa question du 14 août, le soir même :** *« si on affilie une équipe et qu'au
final on change d'avis, on doit pouvoir la retirer. Et aujourd'hui, on peut le
faire ou pas ça ? »*

La réponse était **oui, mais par une porte seulement**. « Personne pour
l'instant » venait d'arriver sur la pastille de la ligne ; la feuille du
chevron, qui mène au même choix, ne listait que les équipes. **Deux chemins, deux
réponses** — et celui qui prenait le second en concluait que c'est impossible.

Un écart de ce genre ne se voit jamais en relisant : les deux écrans sont
corrects pris séparément. Il se découvre le jour où l'on prend l'autre porte, et
c'est exactement ce qu'il vient de faire en posant la question.

Une suite navigateur parcourt maintenant **les deux chemins** : donner par la
pastille, retirer par le chevron, et relire la base entre les deux.

---

### La pastille d'équipe sur la ligne du planning — son geste A

**Sa remarque du 13 août :** *« appliquer une équipe à un chantier n'est pas
intuitif »*, puis son choix du 14, capture à l'appui : **la pastille sur la
ligne** (`docs/maquettes/52-appliquer-une-equipe.html`, geste A).

**Ce qu'elle règle, et que la ligne « Équipe » de la feuille ne réglait pas** —
livrée le même jour par une autre session : un chantier **sans** équipe le dit
enfin. « Équipe&nbsp;? », en or pointillé. Jusque-là la ligne n'écrivait rien du
tout, et rien ne signalait qu'il en manquait une — il fallait ouvrir la feuille
de chacun pour l'apprendre. L'or et non le rouge : il n'y a aucune faute à ne
pas avoir encore choisi, et le rouge est réservé aux refus.

**« Déplacer » a quitté la ligne pour la feuille du chevron.** À 390 px, la
ligne ne peut pas porter le nom, ce qu'occupe le chantier, l'équipe,
« Déplacer » et le chevron : c'est le NOM qui aurait rétréci, et c'est la seule
chose qui dit de quel chantier il s'agit. **Le geste n'est pas perdu** — le
supprimer aurait refermé la seule façon de changer une date, et le planning a
déjà été un cul-de-sac une fois (8 août 2026). Une suite le vérifie des deux
côtés : absent de la ligne, présent dans la feuille.

**`changerEquipeChantier` accepte désormais `null` : l'équipe se RETIRE.**
C'était impossible par tout chemin jusqu'à ce jour — `planifierChantier` écrit
`...(equipeId ? { equipeId } : {})`, ignorant le cas en silence, et le geste
livré le matin exigeait un rang. « Personne pour l'instant » figure sur l'écran
qu'il a retenu ; le montrer sans pouvoir l'exécuter aurait été lui livrer un
bouton mort. **Retirer ne se refuse jamais pour occupation** : libérer une place
n'en prend aucune, et refuser enfermerait le patron dans son erreur.

**Les contrôles ont été vus rouges avant d'être livrés** : privés du retrait,
trois cas de la suite du changement d'équipe tombent. Une suite navigateur
(`test-pastille-equipe-e2e.ts`) parcourt le geste entier — poser, changer,
retirer, vérifier en base — parce que la règle serveur serait verte même si le
bouton n'était pas branché : c'est le raccord qui casse, jamais la formule.

**Deux suites ont rougi à juste titre, et ont changé de cible plutôt que de
disparaître** : celle qui vérifiait que le chevron ne recouvre pas son voisin
vise maintenant la pastille (même défaut, nouveau voisin), et celle du
déplacement suit le nouveau chemin par la feuille.

**Ce qui reste ouvert :** le geste C — les cases au moment de poser — n'est pas
codé, il n'a rien dit dessus. Et à la **pose**, le serveur revalide toujours le
compte de la demi-journée sans vérifier l'identité de l'équipe, là où le chemin
du changement le fait. Écrit dans `TODO.md`.

---

### La ligne du planning dit enfin ce que le chantier occupe

**Sa remarque du 13 août, capture à l'appui :** *« pourquoi sous le chantier il
y a marqué matin ? Cela laisse à penser que juste le matin est bloqué alors que
c'est la journée. »* Il avait raison.

`libelleQuand()` écrivait `creneauDebut` — la demi-journée de **départ** — et
rien d'autre. Or `DUREE_PAR_DEFAUT_DEMI_JOURNEES` vaut **2** : un chantier posé
prend la journée entière. **Le cas le plus courant du produit était donc celui
qui mentait**, et un chantier de trois jours annonçait « matin ».

**Ce qui n'était pas cassé, et qu'il fallait lui dire avant tout :**
`compterOccupation()` parcourait déjà `creneauxDuChantier(départ, durée)`. Les
pastilles du calendrier et la réservation ont toujours compté juste — **seule la
phrase se trompait**. Aucune donnée touchée, aucune migration, rien à rattraper.

**Ses mots, arrêtés en deux temps sur maquette** (`docs/maquettes/51`, puis `49`
après sa correction) : « matin », « après-midi », **« journée »**, et **« du 21
au 25 août »** au-delà d'un jour — le week-end sauté, comme la réservation.
« matin et après-midi » et « 3 jours dès le matin » avaient été proposés et
écartés par lui.

**La règle vit dans une fonction pure**, `libelleOccupation()`
(`src/server/disponibilites.ts`) : elle demande à `creneauxDuChantier` ce qui est
occupé au lieu de refaire l'arithmétique à côté. Deux calculs auraient produit
deux vérités — celle de l'écran et celle de la réservation — qui se seraient
contredites un vendredi, jour où le saut du week-end entre en jeu.

**La date tombe sur la liste, pas dans la feuille du chevron.** Sa consigne —
*« elle est déjà présente juste au-dessus »* — vaut du panneau du jour, qui se
titre « Lundi 17 août » ; dans la feuille, la date n'est écrite **nulle part
ailleurs**. `Occupation.porteLaDate` empêche au passage le doublon « 21 août ·
du 21 au 25 août ».

**Le contrôle a été vu rouge avant d'être livré.** `test-libelle-occupation.ts`
a été confronté à l'ancien comportement : deux cas tombent, dont celui qui a
motivé le lot. Il attrape aussi un piège que personne ne voit venir — **deux
demi-journées parties l'après-midi ne sont pas une « journée »** mais cet
après-midi plus le matin suivant, et l'artisan croirait sa matinée libre.

**Ce que ça débloque.** Sans la date, la ligne raccourcit assez pour porter la
pastille d'équipe sans que le nom du chantier rétrécisse : les deux remarques du
même jour se disputaient cette largeur, elles ne se la disputent plus.

---

## 2026-08-13

### L'équipe qu'on ne peut pas changer, et le « matin » qui ne change jamais

**Ses deux remarques du 13 août**, sur la même capture du planning :
*« appliquer une équipe à un chantier n'est pas intuitif »* et *« pourquoi sous
le chantier il y a marqué matin ? Cela laisse à penser que juste le matin est
bloqué alors que c'est la journée. »* — avec la consigne : *« corrige ça mais ne
code rien, propose des maquettes dynamiques en .html que je puisse essayer »*.

Deux planches, `docs/maquettes/51` et `48`. **Rien n'est codé** — `src/` n'est
pas touché (§3 bis). Elles se touchent au doigt **sans JavaScript** : de vraies
machines à états faites de boutons radio, son lecteur n'exécutant pas de script.

**LA PLANCHE DE L'ÉQUIPE A ÉTÉ REFAITE EN COURS DE ROUTE, et c'est la leçon du
lot.** Sa première version disait « l'équipe ne s'écrit qu'en posant une date,
six gestes pour changer une lettre » — vrai en début de soirée. Une autre session
a livré entre-temps `changerEquipeChantier()` et la ligne « Équipe » dans la
feuille du chevron : **exactement la proposition B que j'allais soumettre**. Le
code fait foi (`CLAUDE.md` §1) : la planche a été corrigée avant d'être livrée
plutôt qu'envoyée périmée, et B y figure désormais comme un acquis à juger, non
comme un choix à faire. Trouvé en refusionnant `main` **avant** de pousser, ce
que le §6 impose précisément pour ça.

**Ce que la lecture du code a établi, et qui manquait au dépôt :**

- **Ce qui reste ouvert après cette arrivée** : depuis la liste du planning,
  rien ne signale un chantier **sans** équipe — il faut ouvrir la feuille de
  chacun ; et au moment de **poser**, les équipes restent des lignes de liste.
  La fiche du chantier ne montre l'équipe nulle part.
- **Une équipe ne peut jamais être retirée**, par aucun des deux chemins :
  `...(equipeId ? { equipeId } : {})` ignore le cas en silence, et le geste neuf
  exige un `rangEquipe` non nullable.
- **Les deux chemins ne défendent pas la même règle** : le geste neuf vérifie que
  l'**équipe** visée est libre, la **pose** ne vérifie qu'un compte de
  demi-journée. Inatteignable par l'écran, qui éteint les lignes prises — mais
  c'est le cas que le commentaire de `planifierChantier` prétend couvrir.
- **Le « matin » est un défaut d'affichage seul.** `libelleQuand()` écrit la
  demi-journée de départ ; `compterOccupation()`, lui, parcourt la durée. Les
  pastilles du calendrier et la réservation ont toujours été justes — **seule la
  phrase mentait**. Rien à rattraper, aucune migration.

**Et les deux décisions restantes se disputent la même chose** : la largeur de la
ligne du planning, qui porte déjà le nom, la date, « Déplacer » et le chevron à
390 px. Elles se prennent ensemble ou l'une contre l'autre ; c'est écrit dans les
deux planches et dans `TODO.md`.

**Un défaut de la planche trouvé en la parcourant, jamais en la relisant** : la
barre d'onglets du bas passait devant la feuille et recouvrait sa dernière
option — « Personne pour l'instant » ne répondait pas au doigt. Trois étages
posés (`z-index`), et le parcours rejoué : trente-trois gestes au vert.

### Trois noms à essayer — Gunzi, Goonzi, Gunzy — et l'icône qui est un A

**Sa demande :** *« fais-moi une maquette avec comme nom Gunzi à la place
d'Atlas. Ne code rien. »*, puis les deux autres noms.
`docs/maquettes/50-le-nom-{gunzi,goonzi,gunzy}.html`, trois planches identiques
au mot près, avec un passage de l'une à l'autre en tête de page.

**Rien n'est codé** — `src/` n'est pas touché, c'est `CLAUDE.md` §3 bis. Ce qui
serait à reprendre le jour d'un choix est écrit dans `TODO.md`, avec les
fichiers, pour ne pas le rechercher.

**Ce que faire ces planches a appris, et qui n'était pas su :**

- **L'icône installée est un A.** `public/icone-source.svg` le dit lui-même —
  « un A bâti comme un chevron de charpente », provisoire, jamais remplacé, et
  resté en terre cuite `#C0621F`, la couleur d'avant la charte du 3 août. Un
  autre nom la rendrait fausse ; elle est déjà hors charte. Fiche à part dans
  `TODO.md`, parce qu'elle ne dépend pas du nom.
- **Le client de l'artisan ne voit le nom nulle part** — ni la page publique
  d'un devis, ni celle d'une facture, ni leurs PDF ne portent de marque, vérifié
  fichier par fichier. Renommer ne demande de prévenir personne.
- **Le seul coût qui grandit est celui des CGU** : elles citent le nom, et une
  version acceptée ne se modifie jamais. Gratuit aujourd'hui — personne n'a
  accepté la `canevas-1` —, payant dans six mois.

**Les largeurs sont mesurées, pas estimées**, et la mesure a corrigé ce qui
avait d'abord été écrit : ATLAS et GUNZI font 97 px, GUNZY **105** malgré ses
cinq lettres, GOONZI 118. Compter les lettres ne dit pas la largeur.

**Et un défaut vu sur une capture, jamais par un contrôle** : en thème sombre,
les deux sceaux de la dernière planche disparaissaient — gravure vert pin sur
fond sombre. Ils portent désormais leur propre fond crème, celui de la porte.
Éprouvé aussi **JavaScript coupé** et à 390 px : aucun script, pas de
débordement horizontal, l'entrée et « ↺ Recommencer » répondent.

---

## 2026-08-13

### L'assistant cesse de flotter, et se range dans l'en-tête

**Sa demande :** *« l'onglet de l'assistant est hyper mal placé, propose des
choses pour plus qu'il gêne »*. Puis, devant cinq propositions : *« la B mais de
la même couleur qu'elle est déjà »*.

**Le défaut n'était pas sa position, c'était qu'il flottait.** Mesuré : la bulle
couvrait les dimanches 23 et 30 du planning — deux cases qu'on touche. Et c'était
le sixième écran : cinq fois cet été, c'est l'ÉCRAN qu'on avait déplacé pour
l'éviter (un talon de 112 px, une capsule recentrée, une phrase calée à gauche).
Chaque correction était juste, aucune ne traitait la cause.

Le bouton vit maintenant dans l'en-tête, en vert pin plein comme avant ; le
panneau reste au-dessus de tout. `ARCHITECTURE.md` §106.

**Une erreur de placement, corrigée par la mesure.** Posé d'abord sur une ligne à
lui au-dessus du titre, il ajoutait 72 px en tête de chaque écran et repoussait la
dernière semaine du planning sous la barre : on aurait échangé deux jours
recouverts contre une semaine hors de l'écran. À côté du titre, il ne coûte rien
— aucun titre ne se casse, et le calendrier finit exactement où il finissait.

**Deux sessions ont visé la même ligne le même jour.** « Modifier », posé par une
autre session à droite du titre de l'écran d'envoi, descendait de 21 px une fois
l'assistant à ses côtés : il s'aligne par `self-end`, et son conteneur avait
changé de hauteur. `git` n'avait rien signalé — une fusion propre ne prouve rien
sur la mise en page. C'est leur suite qui l'a dit, au pixel.

**Et le contrôle a failli accuser à tort** : écrit « la dernière semaine tient
au-dessus de la barre », il rougissait sur un débordement de onze pixels qui
existait **avant**. Le repère est devenu la mesure d'avant le déplacement, et le
débordement est parti dans `TODO.md` sous son propre nom.

### Où mettre l'assistant : cinq places, et une gêne enfin mesurée

**Sa demande :** *« l'onglet de l'assistant est hyper mal placé […] crée-moi des
maquettes que j'essaye, ne code rien. »* **Rien n'a été codé** —
`docs/maquettes/51-ou-mettre-l-assistant.html`, sa lettre est attendue.

**L'écran choisi est le planning, et ce n'est pas un hasard :** c'est là que la
gêne se mesure au lieu de se discuter. La bulle recouvre les dimanches 23 et 30.
Et ce n'est pas le premier écran qu'elle mord — cinq fois déjà, c'est l'écran
qu'on a déplacé pour l'éviter (§46, §49, §63, §67, §84). Aucune proposition ne
consiste donc à la bouger de vingt pixels.

**Le contrôle compte les cases recouvertes**, version par version, l'avant
servant de témoin. Il a servi tout de suite : ma reproduction du calendrier était
39 px trop haute, la bulle tombait dans le vide, et la planche aurait démontré
l'inverse de ce qu'elle montre. Une reproduction « à peu près » ne prouve rien.

### Cesser de rejouer soixante suites pour du code qui ne nous concerne pas

**Sa décision, en quatre mots :** *« seulement quand le code touche »*.

**Ce qu'elle corrige.** Le 13 août au soir, un écran fini et vérifié a mis des
heures à lui parvenir — non par difficulté, mais par une course : `main` a bougé
**cinq fois** pendant la vérification (30, puis 4, 11, 20 commits), et chaque
fusion relançait une batterie de dix minutes que la fusion suivante périmait
aussitôt.

`CLAUDE.md` §6 porte désormais un tableau qui dit sans jugement ce qui compte
comme « ça touche » : un fichier commun au lot, une migration, une pièce
partagée (`design-tokens`, `PrimaryButton`, `EnTeteEcran`, `globals.css`,
`layout.tsx`, `middleware.ts`), l'outillage employé. Le reste se contente des
types, du lint, de la mémoire et des suites du domaine.

**Deux garde-fous, écrits avec la règle :** la batterie complète reste
obligatoire **avant la première poussée** d'un lot, et le doute tranche vers la
batterie — une fusion qui ne se lit pas d'un coup d'œil se rejoue en entier.

**Et une migration arrivée par la fusion s'applique AVANT de juger quoi que ce
soit** : le même soir, trois migrations manquantes ont rendu **160 rouges** d'un
coup, qui n'accusaient que la base locale.

---

## 2026-08-13

### Le numéro du devis redevenait un lien d'appel — l'en-tête ne suffisait pas

**Sa capture, aujourd'hui :** « Hydration failed » sur le devis ouvert depuis un
SMS, avec la signature d'iOS — `x-apple-data-detectors-type="telephone"`. Le
même défaut que la veille, sur un banc qui servait pourtant le correctif de la
veille (fiche d'état de 14 h 55, `main` à `5a6e999`).

**Pourquoi le premier remède ne pouvait pas marcher.** `format-detection` est
une **demande** faite au navigateur, et Safari l'écoute. Mais un lien touché
depuis Messages ne s'ouvre pas dans Safari : il s'ouvre dans une vue intégrée
où cette en-tête n'est pas lue — et c'est **le seul chemin** par lequel le
client de l'artisan arrive sur son devis.

**Le remède, cette fois, ne demande plus rien.** Le numéro est écrit en morceaux
dont aucun ne porte assez de chiffres pour être un téléphone
(`src/lib/numero-document.ts`, `NumeroDeDocument`). Ce qui répare n'est pas le
découpage mais l'`inline-flex` qui l'accompagne : un détecteur lit le texte
**aplati** de la page, et seuls les blocs le coupent. Mesuré avant d'écrire une
ligne — entourer chaque moitié d'un `<span>`, la recette qui circule pour ce
défaut, ne change rien du tout.

Appliqué aux six endroits où un numéro s'affiche, pas aux deux signalés : il
consulte son atelier depuis le même téléphone.

**Ce que ça coûte :** un numéro copié depuis l'écran emporte des retours à la
ligne. Il reste intact dans le PDF, dans le SMS et en base.

**Ce qui n'est pas prouvé, et se dit :** la détection appartient à un logiciel
d'Apple absent d'ici. Les contrôles vérifient que le texte offert à ce logiciel
ne contient plus de suite de chiffres appelable — pas ce qu'il en fera. Seul son
iPhone tranchera. Détail : `ARCHITECTURE.md` §87.
### La civilité se choisit, au lieu d'être devinée

*« Tu as raison, il faut intégrer une case monsieur-madame. Mais je veux que ça
soit sous la forme Mr Mme, en cliquable, on choisit au-dessus du nom. »*

C'est la réserve posée le matin même qu'il tranche. Jusque-là « Mr. » était un
**défaut** collé sur tout patronyme nu — y compris dans le SMS qui part chez le
client : une cliente lisait « Bonjour Mr. Roux ». Deux pastilles au-dessus du
nom, et le choix traverse tout : le nom du chantier, l'écran du devis, le PDF,
le message tout prêt, et la page qu'elle ouvre.

**Ce qui ne change pas, et c'est la garantie qui compte :** un client sur lequel
il n'a rien touché garde exactement l'apparence qu'il avait ce matin. Le jour où
la case est apparue, aucune fiche ne la portait ; si l'absence de choix avait
effacé la civilité, tous ses devis en cours auraient changé d'en-tête d'un coup.

**Les pastilles sont à la création, et là seulement.** Elles avaient d'abord été
posées aussi sur l'écran du devis, pour offrir une seconde porte — corriger un
client déjà créé. Il les y a fait retirer dans la foulée : *« il ne faut pas
qu'il y ait les pastilles cliquables sur le devis. En gros quand on rentre les
informations dans la fiche client, si on clique sur monsieur, sur le devis ça
sera marqué monsieur. »*

Son raisonnement vaut au-delà de ce champ : **le devis est le document, pas la
fiche.** Il montre ce qui partira, il ne se remplit pas comme un formulaire. Le
mot y est donc du texte, écrit devant le nom — et à côté du champ, jamais
dedans : dedans, il s'enregistrerait comme nom du client et le document suivant
porterait « Mme Mme Roux ».

**Ce que ce retrait coûte, et qu'il sait :** faute d'écran de fiche client, une
civilité choisie de travers ne se corrige plus après la création.

**Trois pièges, tous payés en le faisant :**

1. **Le choix primant sur la détection, il doublait les civilités déjà
   écrites** : toucher « Mme » sur « Mme Roux » donnait « Mme Mme Roux ». Les
   deux questions — « a-t-il déjà sa civilité ? » et « est-ce une société ? » —
   étaient mêlées dans une seule fonction ; elles sont séparées, et l'ordre est
   désormais écrit noir sur blanc.
2. **Le devis n'est pas un formulaire.** L'étiquette « CIVILITÉ (FACULTATIF) »
   au milieu du bloc « Client » ressemblait à un bout de formulaire collé sur
   une lettre — cet écran est à l'image du papier, tous ses champs y sont nus.
   **Vu en capture, jamais par un contrôle.**
3. **L'exemple du champ contredisait la pastille.** Le nom proposait
   « M. Bernard » : sous une case Mr/Mme, cet exemple invitait à retaper la
   civilité dans le nom, auquel cas la pastille ne servait plus à rien. Il vaut
   « Bernard », et les 54 fichiers de contrôle qui visaient ce texte ont suivi.

`ARCHITECTURE.md` §87.

### La capsule descend jusqu'aux écrans du client — il a tranché

**Question posée avec deux captures**, la sienne et celle de son client :
la capsule s'arrête-t-elle à ses écrans, ou descend-elle jusqu'aux pages que
voit son client ? **Réponse : oui**, elle descend.

Quatre boutons changent de forme, tous sur les écrans que reçoit le client de
l'artisan : accepter le devis, demander une correction, ne pas donner suite, et
télécharger la facture. **Leurs couleurs ne bougent pas** — le vert pin et la
terre cuite de ces pages restent : ce qui devait rester distinct de l'outil de
travail, c'est l'identité, pas la forme du geste.

**Le champ de saisie de la même page garde ses coins doux.** La charte ne donne
la capsule qu'à ce qu'on APPUIE, jamais à ce qu'on remplit — et un champ
entièrement arrondi se confondrait avec un bouton.

L'exception qui protégeait ces écrans dans `scripts/test-boutons-arrondis.ts`
est **levée** : ils sont désormais gardés comme les autres. Il n'en reste
qu'une, le chevron de retour, sur lequel il ne s'est pas prononcé — une icône
encadrée de 32 px, que la capsule transformerait en pastille ronde.

---

### `verifier:memoire` refuse un conflit resté ouvert

**Constaté sur `main` le 13 août 2026 :** `ARCHITECTURE.md` y portait trois
marqueurs de conflit, poussés par une session qui n'avait pas refermé sa fusion.

Ni les types, ni le lint, ni les suites ne lisent les fichiers de mémoire — et
une documentation se consulte par recherche, donc on tombe sur le passage voulu
et jamais sur les marqueurs vingt lignes plus haut. Le fichier avait l'air
complet, en portant **les deux versions** du même passage : plus trompeur qu'une
section absente.

Le contrôle coûte trois lignes, nomme le fichier, le marqueur et sa ligne, et a
été éprouvé en réintroduisant l'état exact qui était passé. Le doublon de section
qu'il avait entraîné — deux `## 81` — est défait au passage.

**Deux sessions l'ont écrit le même jour sans se voir.** Celui qui est resté est
celui qui était déjà sur `main` : il gère en plus un faux positif — `=======`
seul est un soulignement Markdown légitime. Le second a été retiré plutôt
qu'empilé, deux contrôles pour la même chose finissant par diverger.

### L'attente qui s'éternise rend la main, au lieu de souffler dans le vide

**Sa réponse à la question laissée ouverte : « oui fait ça ».** Un geste rassure
les dix premières secondes, puis il inquiète — il dit la même chose à la
trentième qu'à la première. L'écran a donc trois temps : il travaille, il
reconnaît à douze secondes que c'est anormalement long, et il rend la main à
quarante-cinq. `ARCHITECTURE.md` §80.

**Renoncer n'interrompt pas l'appel** : s'il répond enfin, les champs vides se
remplissent. Mais rendre la main crée un cas qui n'existait pas — redicter
pendant que la première réponse court encore —, et celle-ci remettait l'écran au
repos au milieu du nouvel enregistrement. Une réponse ne touche donc l'écran que
si elle est encore celle qu'on attend.

**Un défaut visible seulement à la capture, et la leçon qui va avec.** La
première phrase des douze secondes faisait cent caractères : elle cassait « Un
chantier » en deux lignes, en plein milieu de l'attente. Mesuré dans la vraie
page : 31 caractères tiennent sur une ligne, 33 non. Deux contrôles en sont nés,
et le second existe parce que le premier a dormi — un plafond posé trop haut
laissait passer la phrase de l'abandon, et le compteur de lignes, posé à un seul
instant du parcours, n'éprouvait que cet instant-là.

**La mesure a dénoncé un défaut plus ancien :** le message de fin de dictée
casse le titre lui aussi, à chaque réussite. Non touché — c'est une phrase que le
patron voit depuis des jours, et la raccourcir change ce qu'elle dit (`TODO.md`).

### L'attente de la dictée souffle, et le dit — proposition C

**Il a répondu « code la C ».** Les trois points enflent et se rétractent l'un
après l'autre, sans se déplacer : rien ne sort du rond de 44 px, donc rien ne
peut cogner le titre d'à côté. Le détail et le pourquoi sont dans
`ARCHITECTURE.md` §80.

**Trois choses ont changé au même endroit, et elles ne se remplacent pas.** Le
geste, oui — mais aussi le **bouton qui reste à pleine encre** (le
demi-effacement d'avant était le vocabulaire d'un bouton éteint) et surtout **une
phrase, « Atlas rédige… »**. C'est elle qui compte le plus : l'écran parlait
quand il écoutait et quand il avait fini, et se taisait pendant le seul moment où
l'on se demande s'il est en panne. C'est aussi la seule des trois qui parvienne à
qui n'a pas les yeux sur l'écran.

**Le geste vit dans `PointsQuiSoufflent`, pas dans l'écran** : ce dépôt a payé
deux fois le geste peint sur place (§66, §73). **Et il a servi le jour même** —
le bouton d'ajout de photo portait le même caractère immobile, et il a tranché
d'une phrase : *« oui souffle aussi pour la photo »*. Les points y sont **or** et
non vert sans qu'une mesure ait été recopiée : ils prennent la couleur du bouton
qui les porte.

**Un piège d'outillage payé au passage.** Router une adresse dans Playwright
désactive le cache HTTP de **toute** la page : la visionneuse repartait du réseau
pour une image déjà affichée, son `<img>` n'avait pas fini de charger, et l'échec
accusait la visionneuse — qui n'y était pour rien. Compris en affichant les
images réellement présentes, pas en le supposant. La route se relâche désormais
dès la mesure faite, et seulement une fois l'envoi terminé.

**La suite retient la réponse du serveur trois secondes**, sinon elle courrait
plus vite que l'attente et passerait au vert sans avoir rien regardé. Confrontée
au défaut d'origine, ses quatre points rougissent en nommant chacun son coupable
— au second jet : le premier sortait un « Timeout » sur un sélecteur, ce qui
envoie lire le contrôle au lieu de l'écran.

### Les trois points de la dictée : la maquette, pas encore le code

**Sa demande :** *« une fois qu'on a appuyé sur le dictaphone, on ne sait pas ce
qui se passe. Les trois petits points sont fixes […] on ne sait pas si ça bug ou
non. »*

**Rien n'a changé dans l'application, et c'est délibéré** — une demande de geste
se dessine avant de se coder (`CLAUDE.md` §3 bis). Cinq attentes sont proposées ;
son numéro est attendu (`TODO.md` §0 duovicies).

**Deux planches, parce qu'il a demandé à ESSAYER** — *« juste des points que je
puisse cliquer dessus, enfin le dictaphone, puis je l'arrête et les points se
mettent à bouger »*. La 40 expose les gestes côte à côte ; la **41** joue la
séquence entière sous son doigt : le micro, l'écoute, l'arrêt, l'attente, et le
retour du résultat s'il le demande. Trois états sans une ligne de script — des
boutons radio et des étiquettes qui pointent vers l'état suivant, parce que son
lecteur n'exécute rien et que les pages engendrées en JavaScript lui arrivent
vides. La page est elle-même **écrite par un script**
(`engendrer-maquette-sequence.mjs`), qui refuse de la livrer s'il y trouve la
moindre balise `<script>`.

**Ce que le diagnostic a trouvé, et qui n'était pas dans sa demande.** Ces points
ne sont pas une animation arrêtée : c'est le caractère « … », un seul glyphe
(`DicterCoordonnees.tsx:114`). Et deux choses aggravent l'attente au même
instant — le bouton passe à moitié effacé, ce qui est le vocabulaire d'un bouton
**éteint**, et **aucune phrase n'est affichée**. L'écran parle quand il écoute et
quand il a fini ; il se tait pendant le seul moment où l'on se demande s'il est
en panne.

**Deux outils naissent avec la planche, et chacun a payé sa leçon :**

- `scripts/verifier-maquette-points.mjs` mesure une **vague**, pas un mouvement :
  il exige que le premier et le troisième point soient déphasés. Trois points qui
  montent ensemble bougent de 4 px et ne font aucune vague — vérifié en cassant
  les délais, il rougit alors en nommant la version ;
- `scripts/animer-maquette-points.mjs` fabrique les images animées sans ffmpeg,
  absent d'ici. **Il relit ce qu'il vient d'écrire** : au premier jet il annonçait
  « ✓ » sur une image FIXE, `pageHeight` étant ignoré en silence quand il est
  passé à côté de `raw` au lieu de dedans. Un script qui ne relit pas sa sortie
  certifie le défaut même qu'il répare.

### La poignée de la feuille la referme, et « Créer la facture » devient une capsule

**Ses deux signalements du 13 août, capture à l'appui :** *« si j'appuie sur le
petit trait gris au-dessus de "y aller", c'est censé refermer la page, sauf que
ça ne marche pas »* et *« le bouton créer la facture est encore carré alors qu'il
devrait être arrondi comme tous les autres »*.

**La poignée n'était qu'un trait dessiné — et pire.** Posée dans le panneau qui
arrête les appuis pour que la feuille ne se ferme pas sous les doigts, elle
ABSORBAIT le geste sans rien en faire. Elle est désormais un vrai bouton, nommé
« Refermer », et sa zone touchable fait **342 × 28 px** au lieu des 4 px du
trait : quatre pixels ne s'atteignent pas au doigt, et il aurait conclu « ça ne
marche pas » sur un code pourtant juste.

**Le garde-fou du correctif est éprouvé aussi** : le contenu de la feuille ne la
ferme toujours pas — sinon elle se déroberait en visant « Waze » — et le fond
continue de la fermer. Confronté à la poignée débranchée : un cas au rouge.

**Le bouton carré, lui, dit quelque chose sur nos contrôles.** Il portait
`rounded-md`, et `scripts/test-boutons-arrondis.ts` ne l'a pas vu — **deux
angles morts à la fois** : son motif ne connaissait ni la balise `<Link>` (la
façon normale d'écrire un bouton qui mène quelque part, ici) ni les rayons
NOMMÉS de Tailwind. C'est la troisième fois que ce contrôle attrape le cas rare
et manque le cas courant, et c'est encore le patron qui l'a vu.

Le motif est élargi, avec **quatre témoins** — un par angle mort déjà payé — et
un cinquième qui vérifie qu'une capsule n'est jamais dénoncée à tort. Un
sixième est né sur-le-champ : en arrondissant le bouton, le commentaire écrit
juste au-dessus citait le rayon retiré, et le contrôle a dénoncé un bouton
parfaitement rond. Il ignore désormais les commentaires.

Réparé, il dénonce six boutons. Cinq sont sur les écrans du CLIENT ou le chevron
de retour, jamais arbitrés : **déclarés en exceptions nommées, chacune avec sa
raison**, et portés dans `TODO.md` pour sa décision. Les restyler en silence
aurait changé l'apparence d'écrans qu'il n'a pas demandés.

---

### « Mr. Martins », et le tiret qui collait deux choses différentes

**Sa capture, ce matin :** *« il faut qu'il y ait écrit monsieur Martins et pas
chez Martins. Ensuite tu me retires le tiret entre le nom et l'adresse […]
d'abord le nom, ensuite à la ligne l'adresse. Pour le client, c'est pareil. »*

Trois corrections, et **la deuxième a coûté bien plus cher que la première.**

**1. La civilité.** Le nom du chantier était fabriqué par l'application —
« Chez » suivi du client. C'est la phrase par laquelle un artisan désigne un
chantier ; en tête d'un document, on nomme quelqu'un. `src/lib/civilite.ts` pose
« Monsieur » devant un nom nu, et **jamais** devant un nom qui porte déjà sa
civilité (« Mme Roux ») ni devant une raison sociale (« SARL Untel »). Un seul
fichier sert les trois endroits où le client est nommé.

**Le mot a changé le jour même** : « Monsieur » d'abord, puis, une fois vu à
l'écran, *« Mr. Martins, pas Monsieur »*. Il ne s'écrit donc qu'à un seul
endroit, et les contrôles le demandent à la règle au lieu de le recopier — sans
quoi la moindre correction de sa part rougirait dix suites sans rien apprendre.

Ce que ça coûte, écrit plutôt que tu : il n'existe **aucun champ de civilité**
dans la fiche client. La civilité est un défaut, pas une donnée — une cliente
sera mal nommée. Le vrai remède est un choix à la création du client ; il n'a
pas été ajouté sans son accord.

**2. Une migration qui ne changeait rien, et le disait au vert.** Le nom du
chantier est écrit en base à la création : corriger la règle seule aurait laissé
« Chez Martins » sur l'écran même qu'il photographiait. D'où une migration. La
première version — un `UPDATE` ordinaire — **s'est appliquée sans erreur et n'a
touché aucune ligne** : `chantiers` porte la RLS en mode forcé, le propriétaire
y compris, et sans contexte d'entreprise posé aucune ligne n'est visible. C'est
le piège que `CLAUDE.md` §3 décrit, rencontré pour la première fois dans une
migration ; les précédentes ne modifiaient que `termes_metier`, table sans RLS
forcée.

La version retenue **ne désactive rien** : elle boucle sur les entreprises en
posant le contexte de chacune, comme la file `audios_a_purger`. Et un contrôle
rejoue la migration puis vérifie le **résultat**, parce qu'un « 1 migration
appliquée » ne prouve rien. Ce contrôle a lui-même été un faux vert — il posait
le contexte pour ses propres insertions, dont la migration héritait — et il ne
l'est plus : confronté à la version défaillante, il rougit.

**3. Le tiret.** Il réunissait deux choses de nature différente, qui et où. Sur
les 390 px de son iPhone la phrase se repliait déjà, mais **au mauvais
endroit** : au milieu de l'adresse, jamais entre le nom et elle. Deux
paragraphes désormais, et la suite **mesure les rectangles** — le détail sous le
nom, à la même marge — parce qu'un contrôle qui compte les lignes serait passé
au vert sur ce défaut-là.

**4. Le message tout prêt, et l'encart du client.** Demandés dans la foulée, sa
capture du SMS à l'appui. Le message dit maintenant « Bonjour Mr. Martins » —
devis et facture, par la même règle — et « vous **pouvez** en proposer une
autre » au lieu de « vous pourrez » : le futur repoussait le geste à plus tard.

Et l'encart où le client écrit porte enfin une phrase qui l'y invite. L'intitulé
posait une question sans dire qu'on avait le droit d'y répondre. Ce n'est pas de
la politesse : un client qui repère une faute et n'ose pas l'écrire touche « Je
ne donne pas suite », et le patron lit un refus là où il n'y avait qu'une
coquille. La phrase est au-dessus du champ — lue après coup, elle n'inviterait
plus personne — et elle **ne promet aucune réponse**, que rien ici ne
permettrait de tenir.

`ARCHITECTURE.md` §77.

### « Corriger le devis » ouvre enfin le devis, et non l'écran d'à côté

**Sa demande, capture à l'appui :** *« lorsque je clique sur corriger le devis,
je dois arriver directement sur la page du devis pour pouvoir le corriger. Et
aujourd'hui, ce n'est pas le cas. »*

La veille, ce bouton menait à l'écran d'envoi — celui qui porte « Corriger et
renvoyer » — par crainte de reprendre le devis à sa place. **La crainte visait
juste, mais pas ici : c'est lui qui appuie**, sur un bouton qui annonce la
correction. Le geste était déjà le sien ; l'en priver ne le protégeait de rien
et lui coûtait un écran de plus, puis un second appui, pour arriver là où il
voulait aller d'emblée.

Le bouton reprend donc le devis puis ouvre le document, prêt à être corrigé.
Reprendre ne l'empile pas : un brouillon déjà ouvert est réutilisé tel quel, et
une reprise depuis un devis parti garde le même numéro commercial en montant
d'une version. Appuyer deux fois ne fabrique pas deux devis.

**Ce qui n'a PAS changé, et c'est délibéré.** Un devis **accepté** ne se reprend
jamais d'office : ce serait remplacer sans le dire le document sur lequel le
client et lui se sont mis d'accord. Un **refus** ou un **silence** continuent de
mener à l'écran d'envoi : après un refus, la suite n'est pas forcément de
refaire le devis — elle peut être d'abandonner le chantier ou d'appeler le
client, et ouvrir une version à chaque coup d'œil encombrerait l'historique.

**Éprouvé, et pas seulement écrit.** La règle pure distingue désormais la
destination et la reprise, et refuse qu'on ouvre le document figé sans reprise —
c'est l'ancien défaut, et il reste interdit. La suite navigateur presse le
bouton pour de vrai, suit la navigation, et vérifie que le devis obtenu est
**réellement modifiable** : pas seulement l'absence du bandeau « il ne se
modifie plus », mais un champ de ligne qui accepte la frappe. Confronté au
correctif retiré : deux cas au rouge. Écran capturé, et le devis s'ouvre bien
sans bandeau.

**Un cinquième piège d'attente corrigé au passage** : la préparation du décor de
cette suite patientait trois secondes et demie après l'envoi du devis, puis
accusait le produit — « le devis n'est pas parti » — d'une impatience. Quatre
autres suites étaient tombées sur exactement ce piège la veille.

---

## 2026-08-13

### Six branches réunies dans `main`, et ce que la réunion a coûté

**Sa demande, le 13 août :** *« Fusionne. »* Six branches vivaient à côté de
`main`, dont trois portaient du code produit — l'agenda iCloud, l'écran de la
facture, et le lien cliquable du message au client. Les trois autres ne
portaient que de la mémoire.

Une branche qui vit deux jours de son côté n'est pas une branche en retard :
c'est une **seconde version du dépôt**. Le vrai coût n'a pas été le code — il
n'y a eu qu'un seul conflit dans un fichier de code — mais les six fichiers de
mémoire, que chaque branche avait fait avancer de son côté. Trois pièges, tous
payés ici, et qui reviendront à chaque fusion :

1. **Deux branches numérotent la même section.** `ARCHITECTURE.md` avait deux
   §67 et deux §68. Renuméroter ne suffit pas : **onze renvois** pointaient
   vers ces numéros à travers `CHANGELOG.md`, `HANDOVER.md`, `TODO.md`,
   `PROJECT_STATE.md` et jusque dans un commentaire de
   `scripts/test-envoi-client-e2e.ts`. Un renvoi qui désigne la mauvaise section
   est pire qu'un renvoi absent : on le suit. La facture a pris §73 et §74,
   l'agenda iCloud §75.
2. **Le même bloc rangé à deux endroits fait un doublon silencieux.** Une autre
   conversation avait fusionné le même travail dans `main` en le plaçant
   ailleurs : `git` voyait deux ajouts, pas un déplacement. Garder « les deux
   côtés » aurait écrit deux fois la même chose dans `HANDOVER.md` et
   `CHANGELOG.md`.
3. **Une mémoire fusionnée peut se contredire elle-même.** La branche
   esthétique décrivait `scroll-snap-stop: always` comme la règle à tenir ;
   `main` l'avait **retiré le 11 août** parce que le patron lisait l'arrêt à
   chaque chantier comme du saccadé. Les deux phrases se sont retrouvées dans
   `PROJECT_STATE.md`. De même, `HANDOVER.md` annonçait encore « rien de tout
   cela n'est dans l'application » pour une refonte codée depuis deux jours.
   Les trois passages disent maintenant ce qui fait foi — le code — et pourquoi.

**La règle qui en sort, et qui vaut pour la prochaine fusion :** quand deux
côtés décrivent le même sujet, la question n'est pas « lequel garder » mais
**« lequel est encore vrai »**. Une documentation périmée est pire qu'absente,
parce qu'on s'y fie encore (`CLAUDE.md` §1).

**Vérifié avant de pousser, la batterie entière :** types, lint, mémoire,
**124/124** suites base, **65/65** suites navigateur, les 23 contrôles de
maquette, et la connexion réelle dans un vrai navigateur derrière une origine
étrangère. Aucune régression.

### Deux sessions ont corrigé « Chez Martins » le même jour — et c'est la leur qui tient

Il l'a demandé aux deux, à quelques heures d'écart : *« corrige le nom, Mr
Martins, pas chez Martins ! »* d'un côté, *« il faut qu'il y ait écrit monsieur
Martins et pas chez Martins »* de l'autre.

**Ma version rendait le nom nu** — « Martins » — au motif qu'ajouter « M. »
supposerait un genre. **La sienne écrit « Monsieur Martins »**, et il a levé
cette réserve en connaissance de cause (`src/lib/civilite.ts`). C'est la sienne
qui est retenue : elle fait ce qu'il a demandé au mot près, et elle était sur
`main` la première.

**Et elle a trouvé ce que la mienne ratait.** Ma migration était un `UPDATE …
FROM clients …` tout simple. Sous la RLS forcée, sans contexte d'entreprise
posé, il ne voit **aucune ligne** : il s'applique, rapporte un succès, et ne
change rien — en silence. La sienne procède entreprise par entreprise.
`ARCHITECTURE.md` §77. Ma migration a été retirée.

### La ligne sous le nom dit ce qui est parti, et quand

**Son choix, devant les cinq propositions :** *« j'aime bien le D, mais en
dessous de "devis envoyé" je veux qu'il y ait marqué la date à laquelle on l'a
envoyé. »* La liste porte donc « DEVIS ENVOYÉ · SANS RÉPONSE » en or, et sous
lui « Envoyé le jeudi 13 août. » `ARCHITECTURE.md` §79.

**La date n'est jamais devinée** : sans envoi enregistré, la seconde ligne
n'existe pas. Le repli tentant — la dernière modification du chantier, celle qui
s'affiche à gauche — n'est PAS la date d'envoi : une photo ajoutée la déplace,
et c'est sur elle qu'il compte ses jours d'attente.

**Un doublon né du retrait de « Chez », vu à l'œil sur une capture.** Le titre
étant devenu « Martins », un chantier sans adresse affichait le même mot deux
fois de suite — la ligne du lieu se rabattait sur le nom du client. Elle ne s'y
rabat plus que si elle apprend quelque chose ; sinon elle écrit « Adresse non
renseignée », qui est une information. **Retirer un mot d'un libellé peut faire
entrer deux autres en collision.**

### Cinq libellés pour la ligne sous le nom — à son choix

Il veut y lire que le devis est parti et qu'on attend. Cinq propositions
l'attendent dans `docs/maquettes/41-la-ligne-sous-le-nom.html`, **rien n'est
codé**.

**La planche n'est pas dessinée, elle est photographiée.** La première version
l'était, et elle mentait : une page HTML ordinaire rend ces mots plus larges
qu'Inter dans l'application — au dessin, même le libellé ACTUEL passait sur deux
lignes alors qu'il tient sur une chez lui. La mesure sur l'écran réel a révélé
mieux qu'un oui/non : **la largeur de son téléphone fait partie de la
décision.** Le libellé actuel est déjà à la limite — il tient sur un 430 px,
pas sur un 390. `ARCHITECTURE.md` §78.

---

## 2026-08-13

### La page du client ne parle plus la langue du patron

**Le patron, capture à l'appui :** *« lorsque j'envoie la facture au client,
voilà le lien auquel il a accès. Et s'il clique sur les cases en bas, il est
dans l'application. Or il doit recevoir simplement sa facture en PDF. »*

**La barre était déjà retirée** — corrigée le 12 août, et tenue par
`test-pages-publiques-sans-navigation-e2e`. Vérifié plutôt qu'affirmé : la suite
passe sur les trois adresses publiques réelles. Sa capture vient d'une version
d'avant.

**Mais en le vérifiant, j'ai trouvé ma propre faute, d'un cran plus bas.** Le
veilleur des réponses illisibles, posé la veille, était monté sur SES pages : au
premier serveur lent, son client aurait lu qu'« Atlas est en train de se
préparer après une mise à jour ». Une barre en moins, un bandeau en plus.

**« Public » ne veut pas dire « pour le client ».** `/login` est public aussi,
mais c'est l'écran du patron : ce qui lui parle d'Atlas y est chez lui. D'où
`estPageDuClient`, distinct de `estCheminPublic` — mélanger les deux ferait
qu'une future page d'aide deviendrait « page client » sans que personne l'ait
décidé.

Le contrôle a été confronté à l'état qu'il prétend détecter : veilleur remis
partout, il rougit sur les deux pages, en citant ce que le client lirait.

---

### La TVA due entre dans l'application, et les tickets se photographient

**Sa demande :** *« je veux également qu'on puisse intégrer la TVA due, donc les
essences, les tronçonneuses. Et pour ça j'avais pensé à un petit scanner en
ouvrant l'appareil photo. »*

L'écran de TVA porte désormais **trois chiffres** : collectée, déductible, et ce
qu'il reste à payer. Chacun des deux premiers se copie d'un appui. Les achats
s'ajoutent de deux façons — **scanner un ticket, ou l'écrire à la main** — parce
qu'un ticket perdu, une facture reçue par e-mail et un achat noté sur un coin de
table échappent tous les trois à l'objectif.

**Le piège qui coûte un cinquième :** la TVA d'un ticket de 120 € à 20 % n'est
pas 24 € mais 20 €. Le total est TTC, la taxe est dedans. Un relevé faux de ce
facteur affiche un total parfaitement plausible ; on s'en aperçoit devant le
comptable, un an plus tard.

**« Si le reste à payer est négatif, il faut qu'il le marque négativement. »**
C'est fait, avec un vrai signe moins et une phrase qui dit ce que ça veut dire —
« Crédit de TVA, c'est l'État qui vous doit ». Le mois où l'on achète une machine
sans facturer ne se cache plus derrière un zéro.

**La lecture des tickets est branchée sur ses clés Anthropic et OpenAI.** Il a
fallu apprendre la vision à la couche IA du dépôt, qui ne manipulait que du
texte. Ce qu'elle rend est une **proposition** : les champs arrivent
pré-remplis, et c'est la valeur qu'il confirme qui part en base. Une TVA
supérieure au total est écartée, une TVA absente est recalculée **en le disant**.

**NON VÉRIFIÉ ICI :** la lecture d'un vrai ticket. Cet environnement n'a aucune
clé. Tout ce qui l'entoure l'est — la transformation de la réponse en champs, le
refus de l'absurde, le repli sur la saisie à la main.

**Rattrapé par un contrôle, avant nous :** la table des achats manquait à
l'export RGPD. Les tickets d'un artisan disent où il fait le plein et quand il
travaille ; ils partent avec le reste de ses données.

`ARCHITECTURE.md` §84.

---


### Le message du devis figé est devenu la porte

**Le patron, capture à l'appui :** *« le message dit de consulter la case devis
mais aucune case devis existe »*. Puis, plus utile encore : *« j'aimerais avoir
ton avis — est-ce utile de créer une case, ou est-ce qu'on retire le message ? »*

**Il avait raison sur le fond.** L'écran Devis existe bien
(`/chantiers/[id]/export`) — mais il vit dans le **tiroir** de la fiche, et
**aucune porte n'y menait** depuis la page du devis. La phrase décrivait donc un
itinéraire à reconstituer seul. Pire : deux écrans s'appellent « Devis » de son
point de vue, celui qu'il regarde et celui où l'on corrige. « Ouvrez l'écran
Devis » était introuvable **et** ambigu.

**Ni l'un ni l'autre : le message devient la porte.** Quatre lignes deviennent
deux — ce qui se passe, puis un lien qui y mène.

Pourquoi **pas de nouvelle case** : l'écran existe déjà et vit dans le tiroir de
la fiche ; un second accès permanent ferait deux portes vers la même pièce, ce
qu'on venait justement d'éviter sur l'écran du devis.

Pourquoi **pas de retrait** : cet écran est celui où l'on RÉDIGE. Sans cette
phrase, toucher un prix ne ferait rien et rien ne dirait pourquoi — le silence
que ce dépôt combat depuis le début. Il l'a arbitré lui-même après avoir vu les
trois façons dessinées (`docs/maquettes/40-le-message-du-devis-fige.html`).

`scripts/test-devis-fige-porte-e2e.ts` tient le lien plutôt que la phrase :
**une phrase qui décrit un chemin se dégrade en silence le jour où le chemin
bouge ; un lien qui mène ailleurs se voit tout de suite.** La suite vérifie
aussi que les mots signalés ont disparu, que la porte s'ouvre pour de bon, et
qu'un devis pas encore parti ne s'annonce jamais figé.

---


### Rouvrir un chantier, c'est REPRENDRE — la liste mène là où il s'est arrêté

**Sa demande, redite plus précisément après un premier correctif à côté :** *« si
je me suis arrêté à l'étape d'envoyer le devis [...] que ça me renvoie à l'étape
où je me suis arrêté. [...] Si je me suis arrêté à mettre des photos et à
rédiger la note vocale, il faut que ça me remette à cette page-là. Et ainsi de
suite. »*

Il ne demandait pas que la fiche dise mieux : **il demandait de ne plus y
repasser.** La liste des chantiers ouvre désormais l'écran où le travail s'est
arrêté — l'envoi s'il était sur l'envoi, le prix s'il était sur le prix, la
fiche tant qu'il n'y a que des photos et une dictée (elles y vivent).

La règle est bâtie **sur** l'étape suivante, jamais à côté : deux règles pour la
même question finiraient par se contredire, la fiche proposant un geste et la
liste en ouvrant un autre. Éprouvée sur sa séquence exacte dans un vrai
navigateur, retour par mégarde compris. `ARCHITECTURE.md` §98.

**Ce qui n'a PAS été touché, sur sa consigne :** le centre de la fiche. La
maquette dessinée entre-temps reste au placard.

### « Il n'y a pas de mémoire dans les actions » : on repart du plus avancé

**Son défaut, dans ses mots :** *« J'étais en train de rédiger le devis, [...]
j'ai fait retour sans faire exprès. Si maintenant je reclique sur mon chantier,
je suis obligé de refaire toutes les étapes une à une, alors que j'étais déjà
arrivé à la toute fin, il ne me manquait plus qu'à envoyer le devis. »*

**Rien n'était perdu — sa PLACE l'était**, et rien ne le lui disait. Sa fiche
proposait « Ajouter des photos » et sa liste annonçait « Brouillon », sur un
chantier dont le devis était écrit et n'attendait que son envoi.

**La cause :** les deux règles lisaient la chaîne depuis le début et s'arrêtaient
au premier trou. Il avait rédigé son devis **à la main**, donc sans passer par
l'écran « Informations » — le jalon manquait, et tout retombait au départ. Or
sauter des étapes n'est pas une anomalie : c'est la voie normale depuis que la
chaîne va de la dictée au devis d'un seul geste.

**La chaîne se lit désormais à l'envers**, du plus avancé au plus ancien : le
premier jalon franchi commande. Un état manquait au passage — « Devis prêt à
envoyer » —, sans lequel un devis écrit n'avait aucun état à lui.

**Et la liste des chantiers ne lisait même pas ce jalon** : le compilateur l'a
désigné dès que le champ est devenu obligatoire. C'était l'écran de sa capture.

Reproduit à l'écran avant correction, revu à l'écran après (`ARCHITECTURE.md`
§98). **Le corps de la fiche, lui, n'est pas touché** : il a demandé le jour
même de ne pas y toucher, et la maquette dessinée entre-temps reste au placard.

---

## 2026-08-12

### Le faux rouge de la batterie : un tuyau de 64 Ko, pas un écran lent

**Trois faux rouges avaient été attribués au préchauffage le matin même** — et
le préchauffage n'y était pour rien. La cause est mécanique, et elle se mesure :

`run-e2e-tests.ts` recueillait la sortie du serveur de développement par un
**tuyau**, drainé par un écouteur de son propre processus. Or il lance chaque
suite avec `spawnSync`, **qui bloque sa boucle d'événements** jusqu'à la fin de
la suite. Pendant tout ce temps, personne ne vide le tuyau. Le noyau lui accorde
64 Ko : la suite la plus lourde de la batterie les dépasse, et **le serveur se
bloque alors en écriture**. Il ne répond plus, la navigation suivante dépasse
ses 45 secondes, et le message accuse l'écran qui avait le malheur de venir
après — « /planning », « /termines », selon la fois.

La sortie va désormais dans un **fichier**, par descripteur passé à l'enfant :
le noyau écrit sans jamais rien attendre de nous.

**Mesuré des deux côtés**, comme l'exige le dépôt : rouge 3 fois sur 3 avec le
tuyau, vert avec le fichier, à code applicatif identique. Ce qui explique aussi
pourquoi la suite passait toujours jouée à la main — le serveur écrivait alors
dans un terminal, que personne ne bloque.

### L'agenda iCloud est relié — lecture ET écriture

**Après la maquette (ci-dessous), sa décision :** *« code pour qu'on puisse lire
et écrire dans cet agenda »*.

**Ce qui marche désormais.** L'artisan colle son adresse iCloud et un mot de
passe pour les apps ; Atlas découvre ses agendas, en lit les créneaux occupés —
et **ne les propose plus** à ses clients. S'il allume l'écriture et désigne un
calendrier, ses chantiers y sont posés, retirés quand il déplanifie, effacés
quand il débranche.

**Les deux fournisseurs se fondent en une seule carte d'occupation**
(`periodesOccupeesExterieures`). Un artisan peut relier Google *et* iCloud ; le
point de fusion est unique, parce que laisser chaque écran choisir garantirait
qu'un des deux oublie un agenda — et le doublon reviendrait par la porte qu'on
croyait fermée.

**Ce qui rend l'écriture réversible :** l'identifiant de l'événement se déduit du
chantier, donc replanifier réécrit au lieu d'ajouter, et le préfixe `atlas-` dit
ce qu'Atlas a le droit d'effacer. Débrancher **retire d'abord, oublie ensuite** :
effacer la ligne en premier perdrait le mot de passe, donc le seul moyen d'aller
reprendre les rendez-vous.

**Trois défauts trouvés par les contrôles, aucun à la lecture :**

- `Date.UTC` ne refuse rien, il **reporte** : `20261332` — mois treize, jour
  trente-deux — devenait le 1er février 2027 en silence, et Atlas barrait une
  journée travaillée un an plus tard, sans raison visible ;
- l'écran affichait « votre iCloud**—** pas seulement l'agenda » : le JSX avale
  l'espace qui suit une balise fermante à cet endroit. **Vu sur une capture**,
  pas par un test — quatre autres phrases du même écran portaient le piège ;
- la suite de l'écran des réglages comptait les boutons de **toute la page** et
  rougissait sur « Relier mon agenda Apple », pourtant légitime : iCloud ne
  demande aucune configuration préalable, c'est toute la différence.

**Ce qui n'est PAS vérifié, et qui est écrit comme tel :** aucun échange réel
avec iCloud n'a eu lieu — le réseau d'ici refuse `caldav.icloud.com`. Restent à
éprouver sur son banc : la découverte, la lecture, le dépôt, le retrait. Tout ce
qui *décide* vit dans `src/lib/ics.ts` et `src/lib/caldav.ts`, qui ne parlent à
personne et sont couverts entièrement (`ARCHITECTURE.md` §75).

**Au passage**, deux corrections sans rapport avec Apple : `--seulement <motif>`
sur les suites navigateur — diagnostiquer un rouge coûtait vingt-cinq minutes de
batterie, et c'est ce prix-là qui pousse à supposer une cause au lieu d'aller la
lire ; et `test-envoi-client-e2e` attendait dix secondes là où ses voisines en
attendent vingt pour le même écran, d'où un rouge intermittent qui accusait une
règle métier étrangère à la panne.

### Relier l'agenda iCloud : la maquette, la réponse, et rien dans `src/`

**Sa question, capture du Calendrier d'Apple à l'appui :** *« je peux connecter
ce calendrier à mon appli ? »* — puis, aux deux questions posées : le compte
derrière la vitrine est **iCloud**, et il veut **les deux sens** (Atlas lit ses
rendez-vous, Atlas y écrit ses chantiers).

**Le Calendrier d'Apple n'est qu'une vitrine**, et c'est la distinction qui
commande tout : il affiche aussi bien iCloud que Gmail ou Exchange. Derrière du
Google, il n'y aurait rien eu à écrire — le raccordement existe
(`src/server/agenda/google.ts`). Derrière de l'iCloud, c'est un fournisseur en
plus, et un parcours moins confortable : Apple n'offre **aucun** équivalent au
bouton « accepter » de Google pour l'agenda. Reste CalDAV et un **mot de passe
spécifique à l'app**, recopié à la main.

**Ce qui est livré : une maquette, pas du code** (`maquettes/atlas-agenda-apple.html`,
22 contrôles). Sa règle du 11 août — dessiner avant de toucher à `src/`. Elle
tient deux règles qu'un écran de raccordement peut rater sans que rien ne
proteste :

- **on prévient avant de faire taper.** Ce mot de passe ouvre *tout* l'iCloud —
  mail, contacts, fichiers — et Apple ne sait pas le restreindre à l'agenda. Le
  contrôle vérifie l'avertissement **par sa position**, pas par sa présence :
  une phrase juste placée sous le champ est une phrase lue trop tard ;
- **écrire est une décision.** L'interrupteur est éteint au départ, et le choix
  du calendrier n'existe pas tant qu'il l'est. Le repli est un calendrier
  « Atlas » séparé : ce qu'Atlas a posé se retire alors d'un geste, là où des
  chantiers semés dans « Perso » se reprennent un par un.

**Deux défauts trouvés par les contrôles, pas à l'œil :** `font:400 16px/1.4
inherit` est une déclaration **invalide** — `inherit` n'est pas admis dans le
raccourci `font` — donc entièrement ignorée. Les champs retombaient à 13,3 px,
soit exactement le zoom de Safari que la ligne prétendait éviter, et les boutons
à 43 px, sous les 44 px du doigt. À l'écran, rien ne se voyait.

**Ce qui n'a pas pu être vérifié, et qui est écrit comme tel :** le réseau de
cet environnement refuse `caldav.icloud.com` (essayé, connexion refusée). Le
comportement réel d'Apple ne s'éprouvera que sur son banc. Réponse complète,
avec ce que ça coûte et ce que ça expose, dans `docs/QUESTIONS.md` §14.
### Deux dates se choisissent enfin à même le calendrier

**Le patron :** *« dès que je choisis à même le planning, je ne peux choisir
qu'un seul jour. Or je dois pouvoir proposer deux jours au client. »*
`ARCHITECTURE.md` §74.

La feuille d'envoi portait la sélection à **deux endroits** : un tableau — ce
qui part réellement — et une **chaîne unique** pour le jour choisi au
calendrier. Le calendrier ne recevait que la seconde : choisir un second jour
effaçait le premier sous ses yeux. Le plus traître était l'autre moitié du
défaut : **rappuyer sur le premier jour le remettait au lieu de le retirer.**

Le calendrier marque désormais toute la sélection — ce qu'il voit est ce que son
client recevra. Et la règle « une ou deux, jamais trois » cesse d'être écrite en
double : elle vivait déjà dans `src/lib/calendrier.ts`, éprouvée sans
navigateur, et l'écran en avait sa propre copie.

**Pourquoi aucune suite ne l'avait vu :** celle qui existe choisit UNE date au
calendrier et vérifie qu'elle part. Personne n'avait jamais essayé d'en choisir
deux. Un parcours à moitié joué ne prouve que la moitié qu'on joue — quand un
écran offre un maximum, l'éprouver à un seul exemplaire ne dit rien du second.

**Deux suites voisines ont été réparées au passage**, pour deux raisons
opposées : l'une accusait à tort (elle comptait des boutons pressés, or un même
jour est désormais marqué à deux endroits) ; l'autre **empruntait son chantier à
une autre suite** et ne savait pas tourner seule — ajouter une suite ailleurs a
suffi à changer l'ordre des lignes et à la faire rougir en désignant le mauvais
coupable. Chacune possède maintenant ses données.

### Le bouton de la facture prend la capsule — son choix, la variante A

*« Code la A. »* Après deux planches (30, puis 31 à sa demande), « Ouvrir le SMS
tout prêt » quitte son aplat à 4 px de rayon et passe par **`PrimaryButton`**,
la capsule des dix-sept autres écrans. `ARCHITECTURE.md` §73.

**Il passe par le composant, jamais par un dessin recopié sur place** — c'est le
défaut même qu'on répare : une action principale peinte dans un écran échappe à
toute décision d'ensemble, et c'est ce qui lui avait fait manquer la capsule du
11 août. Deux suites mesurent désormais le rayon calculé du bouton : le
repeindre à la main les rend rouges.

**Deux réglages facultatifs ajoutés à `PrimaryButton`, aucun d'apparence.**
`onClick` est enfin honoré sur la variante `href` — elle le perdait en silence,
et ce bouton-là est un lien qui doit AUSSI retenir le départ vers la messagerie.
`repere` pose un `data-atlas`, pour qu'une suite ne désigne pas ce lien par son
seul texte : « Ouvrir le SMS tout prêt » et « Ouvrir l'e-mail tout prêt » se
ressemblent assez pour qu'un contrôle passe au vert sur le mauvais.

Les quatre gestes écartés — la lueur, le cachet, l'encre, le trait — restent
dans la maquette 39.

### Cinq boutons de facture qui se pressent pour de vrai

**Sa demande :** *« sors-moi une maquette avec plusieurs versions cliquables et
dynamiques. Tout en gardant à l'esprit que c'est une appli hyper luxe et
moderne. »* — `docs/maquettes/39-le-bouton-de-la-facture-a-lessai.html`.

Cinq gestes qui **changent de nature** plutôt que de décliner un même objet :
la capsule nue, la lueur qui traverse la laque, le cachet qui tourne et sème
onze grains d'or, l'encre qui remplit le fond, le trait qui s'ouvre. Chacun
respecte les règles payées par « Nouveau chantier » — enfoncement immédiat,
demi-seconde avant la messagerie, mouvement réduit honoré, libellé stable.
**Rien n'est codé** : `src/` est intact, c'est sa règle.

### Et cette maquette n'affichait RIEN chez lui

*« Rien apparaît sur ta maquette. »* La première version **engendrait ses cinq
téléphones en JavaScript**. Éprouvée ici dans un navigateur complet, elle
passait ; script coupé — visionneuse, aperçu, page qui bloque l'exécution — elle
ne montrait plus rien. Mesuré après coup : **zéro écran, zéro bouton.**

Le contrôle qui l'accompagnait pressait donc cinq boutons qui, pour lui,
n'existaient pas. Et le dépôt avait déjà payé cette leçon sur les maquettes 25
et 26, où `verifier-maquette-bascule.mjs` joue les huit bascules **JavaScript
coupé** — la règle existait, elle n'a pas été appliquée.

**Réécrite sans une ligne de script** : une case à cocher invisible par écran et
des règles `:checked ~` portent le geste, la demi-seconde, la messagerie qui
monte et la reprise. Le contrôle tourne désormais `javaScriptEnabled: false`, et
sa première ligne compte les cinq écrans — un retour au script le rend rouge.

*Une seule chose diffère de l'application, et la maquette le dit : ici un second
appui referme, pour pouvoir réessayer. Dans le code il est ignoré, sinon le
message partirait deux fois.*

**Deux pièges de mesure, et le second vaut d'être retenu.**

`locator.screenshot()` attend que l'élément soit **stable** — donc que
l'animation soit finie. Il montrait l'après, jamais le pendant, et la lueur
paraissait morte.

Surtout : **le contrôle de cette lueur est passé au vert deux fois sur un geste
que l'œil ne voyait jamais.** Il exigeait « opacité > 0 et transform ≠
identité » — vrai même quand la bande est entièrement hors du bouton — puis
« la bande est dedans à mi-geste », vrai aussi de la version fautive, qui se
trouvait passer là au bon instant. La courbe d'accélération faisait traverser
la lumière en quatre-vingts millisecondes. Ce qui se mesure désormais, c'est
**combien de temps** elle est visible : 240 ms, contre 180 exigées. Le défaut a
été trouvé en REGARDANT une capture, pas en lisant un voyant vert — troisième
fois que cela arrive dans ce dépôt.

### La facture part enfin par e-mail, et se télécharge

**Trois manques signalés par le patron le 10 août** (`TODO.md` §8), dont deux
sont réparés. `ARCHITECTURE.md` §73.

**« On ne propose que le SMS » — le plus grave.** L'écran de la facture prenait
le canal de la fiche du client et n'en démordait plus : un client sans portable
ne pouvait tout simplement pas être facturé. Les deux voies sont désormais
offertes à tout moment, et **l'adresse manquante se saisit sur place** — il
n'existe aucun écran de fiche client où l'envoyer. Le lien reste unique (le
client n'aura jamais deux adresses pour la même facture), mais le canal inscrit
au registre est corrigé quand le patron change d'avis : une facture partie par
courriel ne doit pas rester marquée « SMS ».

**Le même défaut avait été réparé sur le DEVIS le 4 août**, après une phrase
presque identique. Il a survécu deux semaines ici parce que rien ne relie deux
écrans qui font la même chose. À retenir : un défaut corrigé quelque part
mérite qu'on cherche aussitôt son jumeau ailleurs.

**« Impossible d'enregistrer la facture ».** Un lien « Télécharger
(F2026-0001.pdf) » se pose sous « Voir la facture en PDF ». C'est le **serveur**
qui range le fichier (`?telecharger=1` → `Content-Disposition: attachment`) :
l'attribut `download` du lien, seul, est ignoré par certaines versions d'iOS et
le PDF s'ouvrait alors dans un onglet — le défaut d'origine, déguisé en
correctif. Le nom porte le numéro de facture ; il en aura des centaines.

**Le troisième manque n'est PAS corrigé, et c'est délibéré.** Il veut le bouton
« Ouvrir le SMS tout prêt » ovale : une demande d'apparence se dessine avant de
se coder (`CLAUDE.md` §3 bis). Deux variantes l'attendent dans
`docs/maquettes/38-le-bouton-de-la-facture.html`, et **`src/` est intact** sur
ce point.

**Ce que les contrôles ont trouvé, et qu'aucune relecture n'aurait vu :** le nom
du fichier vit à deux endroits sans lien entre eux — l'attribut du navigateur et
l'en-tête du serveur. Après l'arrêt de la facture, sans rechargement, l'écran
annonçait « F2026-0001-brouillon.pdf » quand le serveur servait
« F2026-0001.pdf ».

### La fiche d'état se lisait de travers, faute de dire QUAND elle est écrite

**Le 12 août au soir, premier vrai usage.** Le patron signale « l'appli ne
s'ouvre plus ». Sa fiche existe enfin, fraîche de trois minutes, et annonce
« Serveur : NE RÉPOND PAS ». Alarmant — et pourtant parfaitement normal :
c'était la publication de **l'allumage**, écrite volontairement avant que le
serveur ait eu le temps de démarrer. Les mêmes mots vingt minutes plus tard sont
une panne. Rien ne distinguait les deux, et il a fallu recouper des horodatages
pour le comprendre.

Deux ajouts, tirés de ce seul usage :

1. **La fiche dit à quel moment elle est écrite** — « à l'allumage » (et prévient
   alors qu'un serveur muet y est attendu), « après démarrage », « par le
   veilleur », « à la main ». Le contrôle refuse que la fiche du veilleur
   s'excuse comme celle de l'allumage : excuser une panne réelle la masque.
2. **La date devient le premier diagnostic**, et le plus rapide de tous. Le
   veilleur réécrit la fiche tous les quarts d'heure tant que l'espace tourne :
   passé vingt minutes sans réécriture, ce n'est pas le serveur qui est en
   panne, c'est **l'espace qui est arrêté**. La fiche le dit désormais
   elle-même, en tête. Sans cette phrase on cherche dans le produit alors qu'il
   n'y a plus personne pour le servir — une demi-heure perdue ainsi.

**Et ce que la fiche a permis de trancher du premier coup**, elle : le code de
`main` n'était pas en cause. Démarré ici sur le commit exact qu'elle annonçait,
le serveur répond en 5,4 secondes. C'est la première fois de la journée qu'une
panne signalée est écartée sans lui faire recopier un terminal.

---

### La TVA se lit au mois, ou au trimestre — et c'est vous qui le dites

**Sa remarque :** *« la TVA collectée, ça doit être mois par mois et pas
trimestre par trimestre […] renseigne-toi d'abord et ensuite reviens me voir. »*

Il avait raison. La déclaration CA3 est **mensuelle par défaut** ; le trimestre
est une option, ouverte quand la TVA due de l'année précédente reste sous
4 000 €. L'écran ne connaissait que le trimestre, posé sans qu'aucune ligne du
dépôt n'explique pourquoi.

**Réglages → Votre TVA** porte désormais le choix, le mois coché d'avance
puisque c'est le défaut légal. L'écran de TVA et son calendrier suivent.

**Et l'application ne dira jamais lequel s'applique** : le seuil porte sur la
TVA *due* — collectée moins déductible — et Atlas ne connaît que la collectée.
Prétendre conseiller ici serait inventer une donnée. L'écran renvoie au
comptable, et une suite vérifie qu'il ne se met pas à donner des avis.

**Le calendrier arrive avec** (`docs/maquettes/35`) : remonter au 1er trimestre
2025 demandait sept appuis sur « ← » et sept chargements d'écran. Deux appuis
suffisent.

**Corrigé en chemin, trouvé en cherchant autre chose :** « Facturé ce
trimestre », au pied de Terminés, additionnait TOUS les mois du fil. Le chiffre
était juste, sa légende mentait.

`ARCHITECTURE.md` §83.

---


### Le chevron doré du planning : l'adresse jusqu'au GPS en un doigt

**Sa demande :** *« lorsque je vais sur planning et qu'il y a un chantier
planifié, en cliquant dessus je puisse avoir un petit truc genre accéder à
l'adresse, et en cliquant dessus ça met l'adresse toute seule dans le GPS, soit
Maps, soit Waze »*.

Au bout de chaque chantier planifié, un **chevron doré** ouvre une feuille :
Plans, Google Maps, Waze, copier l'adresse, appeler le client. Sans quitter le
planning. Retenu après **quatre maquettes** (`docs/maquettes/29` à `32`), sa
règle de montrer avant de faire.

**Des liens universels, jamais `waze://`.** Un schéma propre échoue *en silence*
quand l'application n'est pas installée : le doigt appuie, rien ne bouge. Sur un
chantier, c'est une adresse qu'on n'a plus. Détail qui ne se devine pas :
`encodeURIComponent` et non `encodeURI`, sans quoi la virgule d'une adresse
sépare deux paramètres chez Waze et tronque la destination au numéro de rue.

**Sans adresse, rien ne s'invente** : les trois destinations disparaissent et la
feuille dit où la saisir.

**Trouvé en regardant la capture, pas par un test :** les 44 px du chevron
rognaient le nom du chantier — « Chez M. Bernard » devenait « Chez M. … ». Ils
sont désormais pris sur les marges. Les huit contrôles étaient verts : le nom
était bien là.

**Puis, sur la capture, il a tranché l'encombrement :** *« il faut que le créer
la facture, tu le mettes dans le chevron »*. « Créer la facture » a donc quitté
la ligne pour la feuille. Le nom du chantier passe d'environ 110 px à plus de
250. Le chemin du planning vers la facture, ouvert le 8 août parce que l'écran
était un cul-de-sac, coûte un appui de plus — **et trois suites le parcourent
en entier**, dont une qui vérifie qu'il a bien quitté la ligne.

**Vu sur la même capture, et corrigé :** la feuille affichait « M. Bernard —
Chez M. Bernard ». Elle collait le client devant un nom que l'application
fabrique justement à partir du client — le cas le plus courant du produit était
le plus laid. Aucun test ne pouvait le voir : les deux textes étaient exacts,
c'est leur mise bout à bout qui ne l'était pas.

`ARCHITECTURE.md` §70.

### La carte de réponse mène enfin là où est le geste

**Le patron :** *« si le chantier il est accepté par le client, il faut qu'à la
place de "ouvrir le chantier", on puisse ouvrir le devis — et le devis validé,
pas le devis en construction. Par contre, si le devis n'est pas validé et il
nous revient pour une modification, il faut qu'on puisse ouvrir le devis, mais
pour pouvoir le modifier. »*

Les quatre cartes menaient toutes à la fiche du chantier — **et leur propre
texte disait déjà autre chose** : « le devis peut être repris et renvoyé ». Un
écran qui annonce un geste et conduit ailleurs fait douter de tout le reste.

Deux destinations, et ce n'est pas une préférence : c'est ce que l'application
permet.

- **Accepté** → `devis-complet`, qui affiche le devis **figé**, tel que le client
  l'a reçu. Un devis parti est immuable (trigger
  `empecher_modification_devis_envoye`) : c'est donc bien « le devis validé », et
  jamais le brouillon.
- **Correction, refus, lien périmé** → l'écran d'envoi, qui porte « Corriger et
  renvoyer » et « Reprendre le devis ». Le mener sur le document paraîtrait plus
  direct, mais **celui-ci refuserait sa première frappe** sans qu'il comprenne
  pourquoi : modifier suppose de reprendre, ce qui ouvre une nouvelle version, et
  c'est SON geste — pas le nôtre.

La règle vit dans une fonction pure (`src/lib/suite-de-la-reponse.ts`), éprouvée
sans navigateur. Mais une adresse juste ne prouve rien : un contrôle de bout en
bout joue les deux parcours entiers — devis envoyé, réponse du client — et
vérifie que **l'écran visé porte réellement ce que le lien promet**. Le devis
accepté s'ouvre bien figé, sans un seul champ modifiable ; l'écran de correction
porte bien le bouton, et le message du client avec.

**Deux pièges rencontrés en écrivant ce contrôle, tous deux dans le contrôle :**

1. Il cherchait la carte par le **nom du chantier** — qui figure aussi dans la
   liste juste dessous. Il lisait donc la ligne de la liste et accusait le
   produit d'un défaut qu'on venait de corriger. Les cartes portent maintenant
   une étiquette de code (`data-atlas="carte-reponse"`), qui ne se réécrit pas
   comme un libellé.
2. Il faisait accepter le client sur **une date proposée** — et aucune carte
   n'apparaissait. C'est délibéré et documenté : cette acceptation-là ne surprend
   personne, la signaler noierait celles qui appellent un geste. La carte que le
   patron a photographiée portait d'ailleurs « AUTRE DATE PROPOSÉE ».

Confronté à l'ancien lien : deux rouges, en nommant l'adresse et le libellé.

### La CI était rouge depuis des heures, et personne ne regardait

**Trouvé en allant voir**, après une poussée sur `main` : les exécutions
échouaient les unes après les autres, 56 suites sur 58. Deux pannes, aucune
visible depuis la machine de l'agent — c'est précisément pour cela qu'une CI
existe, et précisément pourquoi il faut la lire.

**1. Une suite lançait un navigateur qui n'existe que chez l'agent.**
`test-session-perimee-e2e.ts` codait en dur `/opt/pw-browsers/chromium`. En CI,
Playwright installe le sien ailleurs : « executable doesn't exist », à chaque
exécution, pendant que la suite passait ici. Elle emprunte désormais le lanceur
commun, qui sait retomber sur le navigateur installé.

**2. Le badge de développement de Next faisait virer six contrôles au rouge.**
`test-rien-de-recouvert-e2e.ts` voyait l'onglet « CHANTIERS » recouvert par un
`<nextjs-portal>` — le badge « 1 Issue », posé en bas à gauche, exactement
dessus. Il n'apparaît que lorsqu'il a quelque chose à signaler : d'où une CI
rouge par intermittence et une suite verte ici.

Ce badge **n'est pas le produit** — il n'existe pas dans la version bâtie. La
suite l'écarte donc nommément, et un témoin vérifie que l'exclusion reste
étroite : un vrai recouvrement au même endroit est toujours attrapé (éprouvé en
posant les deux voleurs à la même place). **Un contrôle qui échoue au hasard est
pire qu'aucun contrôle** : il apprend à ignorer le rouge, et l'on perd alors la
seule suite qui sache voir un bouton devenu inatteignable.

**Ce que cela ne règle pas, et qui est dans `TODO.md` :** sur le banc du patron,
qui sert le mode développement, ce badge recouvre bel et bien son onglet
« Chantiers ». Les quatre coins ont été mesurés — aucun n'est libre — et
l'éteindre lui ferait perdre le « 1 Issue » par lequel il a justement signalé
l'erreur d'hydratation de Safari. La bonne réponse est probablement de servir
une version bâtie sur son banc ; elle n'est pas prise ici.

---

### La fiche d'état ne partait pas — et personne n'avait jamais essayé de l'envoyer

**Le patron, après avoir redémarré son espace deux fois :** *« normalement tu es
censé voir la machine maintenant. Là je viens de le refaire une deuxième fois. »*
La fiche était toujours introuvable. Zéro fiche dans le dépôt.

**Le code était juste ; c'est le chemin qui ne l'était pas.** La publication
s'en remettait à `gh`, absent de son conteneur — il n'arrive que par une
fonctionnalité déclarée dans `devcontainer.json`, et **une déclaration ne répare
pas un espace déjà né**. Le sien est plus ancien que la ligne : redémarrer
récupère le code, jamais les outils. Quatrième fois que ce piège coûte une
soirée à ce dépôt, et cette fois il a coûté deux redémarrages **au patron**.

Trois choses corrigées, et la troisième est la seule qui empêche la récidive :

1. **La publication ne dépend plus de rien.** Codespaces pose un jeton GitHub
   dans chaque terminal ; l'API suffit. `gh` reste en second recours. L'ordre
   compte et il est gardé par un contrôle : `gh` d'abord, c'est ne rien publier
   chez la seule personne pour qui cette fiche existe.
2. **La fiche part AVANT que le serveur ait répondu**, plus seulement après. La
   version d'origine attendait jusqu'à dix minutes que l'application réponde —
   or le cas pour lequel cette fiche existe est précisément celui où elle ne
   répond pas. Elle se taisait exactement quand elle servait.
3. **Quelqu'un joue enfin l'envoi pour de bon.** Les contrôles éprouvaient la
   censure des secrets et la forme du corps ; **aucun n'avait jamais publié**.
   `scripts/eprouver-publication-fiche.mjs` crée une fiche jetable, vérifie que
   le second passage la met à jour au lieu d'en ouvrir une seconde, puis la
   referme — y compris quand l'épreuve échoue.

**Elle ne peut pas tourner sur la machine de l'agent** : le jeton qu'elle expose
est un substitut de son mandataire réseau, et GitHub le refuse (401 « Bad
credentials » — constaté, pas supposé). Elle tourne donc en CI, dans un travail
séparé, où le jeton est réel. C'est le déplacement que `CLAUDE.md` §5 prescrit.

**Et le journal de démarrage n'y figure plus — décidé par le patron.** En
regardant son dépôt, un détail est apparu qui change tout : **il est public.**
Une fiche y est lisible par n'importe qui, et indexée. La censure automatique
était faite au jugé — acceptable dans un dépôt fermé, pas quand le prix d'un
oubli passe d'une gêne de lecture à une clé publiée sur la place. Mis devant le
choix, il a tranché : retirer le journal.

Ce qu'on y perd, et qui est écrit pour qu'on ne le redécouvre pas : devant un
serveur qui refuse de démarrer, la fiche dira qu'il ne répond pas, **pas
pourquoi**. Ce qui reste répond à la question qui a coûté le plus cher — *sur
quelle version est-il, et son serveur tourne-t-il ?* Si la cause exacte devient
nécessaire, il faudra une extraction **structurée** (le nom de l'erreur, pas les
lignes autour), jamais un retour du journal brut.

`ARCHITECTURE.md` §69.

---

### Safari fabriquait des liens d'appel dans les pages du client

**Sur son iPhone :** la page publique d'une facture rend « Hydration failed ».
Le diff de React désignait le coupable sans ambiguïté — le DOM portait
`<a href="tel:2026-0003">` là où le composant ne rend que le texte `2026-0003`.

Aucune page du dépôt n'écrit de `tel:` sur un numéro de facture : le lien venait
du navigateur. iOS reconnaît d'office ce qui ressemble à un téléphone, une
adresse ou un courriel, et **réécrit le HTML avant que React ne s'installe
dessus**. Un numéro de facture lui ressemble assez.

**Ce n'était pas qu'une alerte de développement.** Le numéro devenait un lien
d'appel sous le doigt du client de l'artisan — sur la facture comme sur le
devis, qui le portent tous deux en titre. Un client dont le téléphone propose
d'appeler « 2026-0003 » n'a pas affaire à un outil sérieux.

Une ligne d'en-tête coupe la détection automatique, sur toutes les pages. **Les
trois formes, pas seulement le téléphone** : les deux autres cassent de la même
façon, et attendre la suivante coûterait un aller-retour de plus. **Rien n'est
perdu au passage** — les `tel:` qu'Atlas écrit lui-même (« appeler » sur la fiche
du client) et le bouton « Y aller » continuent de fonctionner, et c'est éprouvé.

**Ce qui n'a PAS pu être éprouvé ici, et il faut le savoir :** la détection est
propre à Safari, cet environnement n'a que Chromium. La panne d'origine ne peut
pas être rejouée, donc le correctif ne peut pas être vu la faire disparaître.
`scripts/test-detection-automatique-e2e.ts` garde ce qui peut l'être — l'en-tête
sur les deux écrans du client, un témoin qui vérifie qu'ils posent toujours un
numéro nu, et la survie d'un `tel:` explicite. Confronté au correctif retiré :
quatre cas au rouge, avec le bon coupable nommé. **Le verdict, lui, est sur son
téléphone.**

`ARCHITECTURE.md` §68.

---

### « Ça ne marche pas » va désormais chercher la fiche tout seul

**Sa demande :** *« Il faudrait que si j'écris ça ne marche pas, d'elle-même
elle aille regarder la fiche. »*

La consigne existait déjà en toutes lettres (`CLAUDE.md` §1 bis, écrit le matin
même). Elle ne suffisait pas, et pour une raison qui n'a rien à voir avec la
bonne volonté : **une consigne en prose se lit au début d'une conversation et
s'oublie au bout de trois heures** — or c'est au bout de trois heures qu'il
signale une panne, jamais au début.

`.claude/settings.json` branche donc `scripts/rappel-panne.mjs` sur chaque
message reçu. Dès qu'une tournure comme « ça ne marche pas » apparaît, le rappel
est remis sous les yeux de la session **au moment exact où il sert** : lire la
fiche d'état de son espace, regarder sa date d'abord, ne supposer qu'ensuite, et
lui faire lancer `claude` chez lui plutôt que de lui dicter dix commandes depuis
un téléphone.

**Il vaut pour ses trois ou quatre sessions à la fois**, et sans qu'aucune ait
rien à retenir : le fichier est dans le dépôt, donc chacune l'applique. C'est ce
qu'il demandait la veille — *« je veux que si je leur dis ça ne marche pas,
qu'elles se débrouillent »*.

**Il n'interdit rien et ne bloque rien** : il ajoute du contexte, et devant le
moindre doute il se tait. Ce n'est pas de la prudence de façade — un rappel qui
parle à tort s'apprend à être ignoré, et le garde-fou se perd alors sans que
personne s'en aperçoive. D'où deux garde-fous symétriques dans
`scripts/test-rappel-panne.ts` : les tournures qu'il a **réellement écrites**
les 11 et 12 août déclenchent (aucune n'est inventée), et les demandes
ordinaires — « corrige l'erreur de type », « est-ce que la CI est passée ? »,
« ça fonctionne ? » — ne déclenchent rien. Le câblage lui-même est vérifié : un
script juste que rien n'appelle ne protège personne, et son absence ne se voit
nulle part.

Confronté à l'état dégradé : réglages vidés de leur crochet, le contrôle passe
au rouge en nommant le bon coupable. Une entrée illisible, elle, laisse le
déclencheur muet et en succès — il gêne chaque message du patron ou il ne gêne
rien.

### L'espace du patron raconte son état là où l'agent sait lire

**Sa demande :** *« Faut trouver un moyen pour que tu aies accès à mon espace,
trouve. »*

Il n'y en a pas, et il ne fallait pas en fabriquer un. Aucune route ne relie la
machine de l'agent à son Codespace. Et la solution qui « marcherait » — une
boucle qui lirait des ordres dans le dépôt et les exécuterait chez lui — serait
une porte dérobée sur une machine qui porte ses identifiants GitHub et ses clés
d'IA : quiconque obtiendrait le dépôt commanderait son ordinateur. **Refusé, et
écrit ici pour que la question ne se repose pas.**

Le sens inverse est sans danger : **il pousse, l'agent lit.** À chaque allumage,
son espace publie son état sur une fiche GitHub dédiée — toujours la même, mise
à jour au lieu d'être multipliée : le commit récupéré, le commit réellement
SERVI, les services debout ou non, et les quarante dernières lignes du
démarrage. L'agent lit les fiches du dépôt ; il voit donc la machine du patron
sans y toucher, et sans lui faire recopier un terminal depuis un téléphone — ce
qui a coûté quatre allers-retours dans la seule nuit du 11 au 12 août.

**Ce qui ne sort jamais, et c'est éprouvé :** aucune variable d'environnement,
aucune clé. Le journal est recopié mais toute ligne qui ressemble à un secret est
remplacée par une mention. La censure est volontairement grossière — une ligne
innocente retirée ne coûte qu'une gêne de lecture, une clé publiée coûte une
clé. `scripts/test-rapport-espace.ts` tient les deux bouts : clé d'IA, adresse de
base et jeton GitHub disparaissent, le compte de démonstration reste lisible
puisqu'il est public. Confronté : sans la censure, les trois premiers passent.

**Best-effort, et jamais bloquant.** Sans `gh`, ou sans réseau, le script le dit
et rend la main — il ne peut pas empêcher le banc de servir. Vérifié ici, où
`gh` n'existe pas : « ⚠ Rapport non publié », code de sortie 0.

**Et cela vaut pour ses TROIS OU QUATRE sessions à la fois**, puisqu'il en fait
tourner plusieurs en parallèle. Deux choses ont été posées pour ça, sans quoi le
canal n'aurait servi qu'à celle qui l'a construit :

- la consigne vit dans **`CLAUDE.md` §1 bis**, lu au début de CHAQUE
  conversation — pas seulement dans `HANDOVER.md`. Devant un « ça ne marche
  pas » : lire la fiche, regarder sa date, n'avancer une hypothèse qu'ensuite,
  et lui faire lancer `claude` si un geste est nécessaire chez lui ;
- **le veilleur republie la fiche tous les quarts d'heure.** Écrite au seul
  allumage, elle décrivait l'état d'il y a six heures — et une session qui s'y
  fie conclut de travers, exactement comme d'une documentation périmée.

Deux contrôles de plus refusent que l'un ou l'autre disparaisse à la prochaine
réécriture.

Ce que cela ne donne toujours pas : l'écran du patron, et le pouvoir d'agir.
L'agent verra qu'un service est tombé ; c'est `claude`, installé dans l'espace,
qui pourra le relever.

---

### La porte est refaite, et l'adresse ne s'efface plus à chaque erreur

**Sa décision, en trois maquettes :** la ligne d'imprimé de la 32 sans son titre,
le tour de la 33, la rose des vents de la 34. `src/app/login/page.tsx` porte les
trois, plus les corrections qui ne dépendaient d'aucun choix : champs à **16 px**
(en dessous, iOS agrandit la page dès qu'on tape), refus dans le rouge de la
charte, place du message réservée en permanence.

**Et un défaut trouvé en regardant l'écran, antérieur à la refonte :** sur un
mot de passe faux, l'adresse était effacée. Toute à retaper, sur un téléphone,
pour un caractère raté ailleurs. Personne ne l'avait vu parce qu'aucune suite ne
se trompe de mot de passe — elles entrent toutes par une session fabriquée.
`scripts/test-porte-e2e.ts` est la première à passer par où il passe.

**Quatre correctifs sont tombés avant le bon** : la remise à zéro de React
arrive *après* le rendu qui suit l'action, et ni un champ contrôlé, ni un effet,
ni `defaultValue` n'y survivent. Détail dans `ARCHITECTURE.md` §71.

**Une réserve mesurée, pas supposée :** dans cet environnement, `next dev`
n'hydrate pas cet écran (sa liaison de rechargement à chaud est refusée par le
mandataire réseau) et le formulaire part en HTML pur. La suite le détecte et
annonce les contrôles concernés « non concluants » plutôt que rouges. Sur la
version bâtie — celle du banc — le sceau tourne, le bouton se désactive et
l'adresse survit.

**Le tour n'a pas de plancher**, et c'est un arbitrage écrit : il se répète tant
que la vérification n'a pas répondu, mais un serveur très rapide le coupe en son
milieu. Le tenir supposerait de retarder la navigation pour une question
d'allure.

### Huit gravures pour le sceau, et la bande qui en a fait jeter trois

**Sa réponse à la maquette 36 :** *« j'aime bien le 3. Maintenant propose avec
d'autres motifs dans le rond doré, change que le motif à l'intérieur. »* Le tour
est donc **acquis** ; `docs/maquettes/37-le-motif-du-sceau.html` ne fait varier
que la gravure — la feuille d'aujourd'hui (en témoin), la feuille seule, le A,
les cernes et la fente, le conifère, la rose des vents, l'arbre au trait, la
ligne de crête.

**La bande en tête de page n'est pas une décoration**, c'est le contrôle : les
huit motifs à leur **taille réelle**, côte à côte. Trois propositions y sont
mortes — deux brins d'eucalyptus et une branche penchée — parce qu'à six
millimètres, une tige et trois ovales se rejoignent en pâté quel que soit
l'écartement. **Aucune ne se voyait fausse sur le dessin agrandi.** C'est la
troisième fois que ce projet retrouve la même leçon : regarder l'écran, à la
taille de l'écran.

**Une remarque qui change le classement**, écrite sur la maquette : le tour
**impose** quelque chose au motif. La rose des vents tourne parfaitement ; les
cernes ne montreraient rien sans leur trait de fente, un rond concentrique qui
tourne étant un rond immobile ; et le A est le seul qui passe la tête en bas au
milieu du geste.

**Et un défaut du générateur, corrigé au passage.** `fusionner-maquettes.mjs`
préfixait une liste d'identifiants **écrite à la main** : deux maquettes portant
chacune un `entrer-1` donnaient une page unique où le libellé de la seconde
cochait la case de la première. Les familles numérotées sont désormais
reconnues d'elles-mêmes — un oubli de cette sorte ne se voit pas, la page
s'affiche parfaitement et ne répond à rien.

### L'entrée dans Atlas : six façons d'animer la marque, et un libellé qui ne cochait plus rien

**Sa demande, après la maquette 35 :** *« je veux la 4 sans le Connexion et vos
id. Tu rajoutes le nom Atlas comme sur le modèle 3, et tu me mets un logo
dynamique qui s'enclenche au moment où on valide l'adresse et le mdp, pendant
0,5 s avant d'entrer dans l'appli. […] le reste tu touches pas, que le logo qui
change. »*

`docs/maquettes/36-le-logo-qui-sanime.html` — **l'écran est identique sur les
six**, seule l'animation change : le cercle qui se ferme, la feuille qui pousse,
le tour, le battement et l'onde, l'or qui monte, le sceau qui s'imprime. Elle
**s'essaie** : on tape, on appuie, on entre, « ↺ Recommencer » remet l'écran —
et **sans un seul script**, la capsule étant un `<label>` qui coche une case.

**Ce qu'il faudra trancher avec lui avant de coder**, et qui est écrit sur la
maquette : la demi-seconde est un *plancher*, pas une durée d'attente. Le
serveur répond quand il répond, et l'animation doit pouvoir continuer au-delà —
une marque figée deux secondes ressemble à une application plantée. Les six
bouclent, exprès, pour qu'il en juge aussi.

**Deux défauts trouvés par le contrôle, aucun visible à l'œil :**

1. **L'écran de connexion effacé continuait d'intercepter le doigt.** Les deux
   écrans occupent la même case ; sans `pointer-events:none`, « Recommencer »
   ne répondait pas — l'appui allait dans la page invisible. C'est la famille
   des trois seuls défauts que ce dépôt n'a jamais su attraper autrement.
2. **`fusionner-maquettes.mjs` préfixait les `id` sans préfixer les `for`.** Un
   `<label for="g1">` restait donc orphelin dans la page unique : la page
   s'affichait parfaitement et ne répondait à rien. Corrigé pour toutes les
   maquettes, présentes et futures.

`scripts/verifier-maquette-logo.mjs` tient les trois promesses — ça s'anime, on
entre, on recommence — sur les douze écrans (fichier seul **et** page unique),
JavaScript coupé. Éprouvé rouge en retirant l'animation de la proposition 3.

### L'écran de connexion : une maquette avant/après, et un défaut trouvé en la dessinant

**Sa réponse à l'offre de la veille :** *« oui, fais-moi une maquette »*.
`docs/maquettes/35-l-ecran-de-connexion.html` reproduit l'écran d'aujourd'hui,
puis en propose quatre : la carte gardée, sans carte, le sceau, la ligne
d'imprimé. **Rien n'est posé dans `src/`** — c'est sa règle du 11 août, et la
maquette existe précisément pour qu'on n'ait rien à défaire.

**Pourquoi cet écran avait été oublié**, et ce n'est pas un hasard : c'est le
seul qu'on voit **avant** d'être connecté. Chaque refonte s'est faite en
parcourant l'application, donc en partant d'un écran déjà passé. La porte ne
fait pas partie du couloir.

**Le défaut trouvé en dessinant, et il compte plus que le choix esthétique :**
ses champs sont en **15 px**. En dessous de 16, iOS agrandit la page dès qu'un
champ prend le focus — il tape son adresse et l'écran lui saute au visage.
`design-tokens.ts` l'interdit depuis le 10 août ; l'écran de connexion ne s'est
jamais servi du jeton. Le refus de connexion, lui, est peint en rouge vif de
bibliothèque au lieu du rouge sombre de la charte. Les deux se corrigent quelle
que soit la proposition retenue — c'est écrit sur la maquette.

**La maquette a été REGARDÉE, pas seulement engendrée** : une capture au format
de son téléphone a montré un débordement horizontal que la vue au large ne
laissait pas voir. Le bouton « montrer le refus » est une case à cocher native,
éprouvée JavaScript coupé, dans la page seule **et** dans la page unique.

`TODO.md` §0 nonies · `docs/QUESTIONS.md` question 13.

---

## 2026-08-12

### Tous les boutons arrondis, et un contrôle pour que ça le reste

**Sa demande, en une ligne :** *« remplace tous les boutons rectangulaires par
les boutons arrondis »*. Seize boutons du produit portaient encore un rayon de
4 px — tous **dessinés à la main**, donc invisibles à la décision prise la
veille sur le composant partagé.

**Seul le rayon change.** Ni la couleur, ni la taille, ni le composant : deux de
ces boutons sont des boutons de formulaire (connexion, documents légaux) et les
faire passer par le composant partagé aurait cassé leur envoi sans qu'aucun type
ne s'en aperçoive. La connexion a été jouée pour de vrai après coup, dans un
navigateur.

**Et un garde-fou, parce qu'un balayage ne tient pas tout seul** :
`scripts/test-boutons-arrondis.ts` nomme le fichier et la ligne. Il porte un
témoin — un bouton rectangulaire écrit en dur — pour qu'un motif devenu aveugle
ne passe pas pour une application propre.

**Vu en capture, et non demandé :** l'écran de connexion est le seul resté dans
l'ancienne identité — bouton terre cuite, carte blanche, aucune serif. C'est le
premier écran qu'il voit. Rien n'a été touché ; c'est dans `TODO.md`.

`ARCHITECTURE.md` §67.

### Le client recevait sa facture avec les onglets de l'outil du patron dessous

**Le patron, capture à l'appui :** *« lorsque le client reçoit le lien cliquable
de la facture, s'il clique en dessous sur planning ou chantier, il a accès à mon
application. Ce n'est pas du tout ce que je veux. »*

**D'abord ce qui est rassurant, parce qu'il ne pouvait pas le savoir : il n'y a
jamais eu de fuite.** Vérifié dans un navigateur sans session — un appui sur
« Planning » mène à la page de connexion, et aucune de ses données n'est
lisible. Le contrôle qui le prouve était d'ailleurs déjà vert AVANT le
correctif, et il reste en place.

Ce qui était vrai, en revanche : **son client voyait « Chantiers · Planning ·
Terminés · Réglages » au bas de sa facture.** Une facture n'est pas un écran
d'application, et une barre de navigation inopérante est pire qu'absente.

**La cause n'était pas un oubli isolé, c'était une duplication.** Deux listes
tenaient la même vérité, chacune de son côté :

- le middleware savait `/factures` public — il le disait depuis le 6 août ;
- la mise en page tenait sa **propre** liste d'écrans sans navigation, où
  `/devis` figurait et `/factures` avait été oublié.

Un écran public ajouté plus tard n'entrait donc que dans l'une des deux. C'est
mot pour mot le défaut des barres de défilement de la veille : trois zones
portaient la règle, la quatrième l'avait perdue. **Deux copies de la même règle
finissent toujours par diverger** (`CLAUDE.md` §3).

La liste vit désormais à un seul endroit (`src/lib/chemins-publics.ts`), lue par
le contrôle d'accès ET par la mise en page. L'invariant tient par construction :
**ce qui s'atteint sans compte ne porte jamais la navigation du patron.**

`test-pages-publiques-sans-navigation-e2e.ts` balaie tous les chemins publics
**déclarés à leur source** — un nouveau chemin y entre et il est éprouvé le jour
même. Il visite de vraies adresses, avec de vrais jetons : un jeton inventé
rendrait « lien inconnu », dont la mise en page peut différer, et le contrôle
serait vert sur du vide. Il vérifie aussi la porte, pas seulement l'enseigne —
sans compte, les écrans du patron restent fermés. Confronté au code livré : un
seul rouge, sur la facture, exactement.

### « Mon devis » pouvait attendre indéfiniment une réponse déjà perdue

**Le patron :** *« entre le moment où je clique mon devis et le moment où le
devis apparaît, la première fois il s'est passé plus de six minutes et j'ai dû
recharger la page pour que le devis arrive. »*

**Le serveur, lui, avait fini depuis longtemps.** Mesuré ici : la chaîne met
**96 ms et 42 ms** sans modèle raccordé, et chaque appel à un modèle est borné à
trente secondes — elle ne peut pas durer six minutes. Ce qui a duré six minutes,
c'est **son attente** : la réponse de l'action n'est jamais revenue jusqu'à sa
page, et le bouton est resté sur « Atlas prépare le devis… », indéfiniment. Son
rechargement n'a rien réparé — il a montré un devis déjà écrit.

C'est la même famille que les deux défauts de la veille (`ARCHITECTURE.md` §63
et §65) : **un long aller-retour tenu ouvert est fragile par nature.** Un
mandataire qui coupe suffit à le perdre, et le travail continue sans personne
pour en recueillir le résultat.

**On cesse d'en dépendre.** Quand la réponse se perd, l'écran demande
périodiquement si le devis est là (`/api/chantiers/<id>/devis-pret`, sur le
témoin `devisGenereAt` posé quand le devis ET ses lignes sont écrits) et y va
dès qu'il l'est. Recharger la page n'est plus le travail du patron.

Trois précautions, chacune contre un défaut vécu :

- **l'attente sait renoncer.** Une attente sans fin est le défaut qu'on répare,
  pas celui qu'on déplace : passé cinq minutes, l'écran dit quoi faire ;
- **le compteur monte à l'écran.** « Atlas prépare toujours le devis… (48 s) » —
  un écran qui répète la même chose se lit comme un écran figé, et c'est ce qui
  l'a poussé à recharger ;
- **une réponse qui n'est pas du JSON ne passe pas pour un « prêt »**. Derrière
  un mandataire, une session expirée rend une page HTML, parfois avec un code
  200 : l'emmener alors sur un devis inexistant serait pire que l'attente.

**Et la chaîne dit maintenant sa durée au journal**, avec le statut obtenu. Le
raisonnement disait « six minutes, impossible » — mais personne ne l'avait
mesuré chez lui, et raisonner à distance sur une machine qu'on ne voit pas a
déjà coûté cher à ce dépôt. La prochaine fois, le journal tranchera.

### Deux chantiers pour que l'agent n'ait plus besoin du patron pour diagnostiquer

**Sa question, le 12 août 2026 :** *« comment on peut faire pour que tu aies
accès à mon espace, pour que tu sois autonome ? »* Elle vient de deux journées
perdues sur des pannes qui n'étaient PAS dans le code — services couchés, restes
de construction périmés, message qui accusait son mot de passe. Chacune a coûté
un aller-retour, parfois trois, parce qu'il fallait lui faire taper une commande
et recopier ce qu'elle affichait, depuis un téléphone.

**1. Un agent dans son espace.** `preparer.sh` installe Claude Code, et le
message d'accueil le dit : `claude` confie l'espace à l'agent, qui lit les
journaux, relance les services et rebâtit. Installation *best-effort* et jamais
bloquante — le patron ne doit pas perdre son banc parce qu'un registre npm a
hoqueté ; en cas d'échec, un message dit quoi retaper plus tard.

**2. Le contrôle du banc SE CONNECTE, pour de vrai.** Il s'arrêtait à « l'écran
de connexion s'affiche ». Or le 12 août, cet écran s'affichait parfaitement :
c'est ce qui se passait APRÈS l'appui qui était cassé. Un formulaire rendu ne
prouve rien d'une connexion, comme une page de santé ne prouve rien d'un écran.
`.devcontainer/verifier.sh` joue désormais `verifier-connexion.mjs` contre le
banc **déjà en écoute** — donc contre la version bâtie, celle que le patron
ouvre vraiment — avec une origine étrangère.

Trois trous bouchés au passage :

- **le navigateur manquait au conteneur** (`TODO.md` le signalait depuis le
  9 août) : il s'installe dans la commande du workflow, pas dans l'image ;
- **le workflow ne se déclenchait pas sur le code de connexion.** Deux
  correctifs de connexion sont partis sur `main` le 12 août sans qu'il s'en
  aperçoive : ses déclencheurs ne regardaient que l'outillage du banc, jamais ce
  qui laisse entrer ;
- **le nettoyage des types périmés n'avait aucun garde-fou.** Posé après la
  construction, il ne protégerait plus de rien — un contrôle lit maintenant
  l'ordre dans le fichier, et rougit si on l'inverse. Confronté.

Ce que cela ne donne pas, et qu'il faut dire : **l'agent n'a toujours pas son
écran.** Ce qui a été trouvé en regardant une capture — la perle en bas, le
bandeau coupé — restera trouvé par lui.

### Le devis repart, et le bouton de l'envoi devient enfin le bon

**Deux défauts sur une seule capture**, signalés le 12 août au matin.

**Le bloquant :** « je ne peux pas envoyer mon devis, ni par SMS ni par mail ».
La feuille d'envoi affichait *« Stockage local sélectionné en production —
configuration refusée »*. Sa configuration était juste : la barrière ne regardait
que `NODE_ENV`, or son banc sert une version BÂTIE et `next start` impose
`NODE_ENV=production` sans que rien ne soit déployé. La configuration connaissait
cette distinction depuis le 10 août ; cette barrière-là l'ignorait, et se croyait
redondante alors qu'elle était devenue plus stricte. Un déploiement réel exige
toujours S3 — rien n'est relâché de ce côté.

**Le second :** « le bouton, ce n'est pas le même ». Exact. La feuille d'envoi
dessinait son bouton à la main au lieu d'employer le composant partagé. Une
action principale dessinée sur place échappe à toute décision d'ensemble : elle
ne change que si quelqu'un pense à elle.

**Et pourquoi la planche de la veille ne l'avait pas vu :** elle parcourt des
adresses, et une feuille qui monte sur un geste n'en a pas. Le compte
« dix-sept écrans » ne comptait que ce qu'elle savait atteindre.

`ARCHITECTURE.md` §66.

---

### L'écran de connexion accusait le patron pendant qu'un service était couché

**Le 12 août 2026 :** *« Ça ne marche pas, je n'arrive pas à me connecter.
Occupe-toi-en, moi je ne peux pas le faire. »*

Deux défauts distincts, tous deux trouvés en coupant les services pour de bon
plutôt qu'en raisonnant dessus.

**1. La base arrêtée lui répondait « Email ou mot de passe incorrect ».** La
requête qui cherche son compte échouait, Auth.js l'emballait dans une
`AuthError`, et l'écran les traitait toutes pareil. Il pouvait retaper son mot
de passe toute la nuit : le message lui disait de recommencer, et recommencer ne
pouvait rien donner. C'est le défaut que l'en-tête de `src/app/login/actions.ts`
interdit depuis le 6 août — *ne jamais répondre « mot de passe incorrect » à
quelqu'un dont le mot de passe est bon* — sous sa **troisième** forme. Un seul
type d'erreur veut dire « ces identifiants sont faux » ; tous les autres veulent
dire « on n'a pas pu vérifier », et se rendent désormais par une phrase qui dit
les deux choses qui comptent : **ce n'est pas vous**, et ça se répare du côté du
service. Le journal, lui, nomme la cause.

**2. Redis tombé l'enfermait dehors, sans un mot.** `verifierLimite` levait
`MaxRetriesPerRequestError`, l'action de connexion mourait avec, et la page ne
bougeait pas. Un limiteur protège d'un ABUS : refuser tout le monde quand son
magasin tombe, ce n'est pas protéger, c'est infliger soi-même la panne dont on
se protégeait — et la première victime est celui qui a le droit d'entrer. La
demande passe donc, et le journal le dit fort. **Ce que ça coûte, franchement :**
pendant la panne du magasin, la protection contre les essais en rafale n'existe
plus. Risque accepté et borné à la durée de la panne, contre la certitude
d'enfermer l'artisan dehors.

**Ce qui manquait vraiment, et qui existe maintenant :**
`scripts/test-connexion-service-en-panne-e2e.ts` **coupe les services pour de
bon** — Redis, puis PostgreSQL — et regarde ce que l'écran répond, dans un vrai
navigateur. C'est le seul contrôle du dépôt qui fasse cela ; tous les autres
supposent l'environnement debout, et c'est exactement pour cela qu'aucun n'avait
jamais vu ce message mentir. Il remet chaque service en marche derrière lui, et
saute proprement le volet base s'il n'a pas de quoi la remonter — le dire plutôt
que de risquer de la laisser à terre pour les autres suites.

Confronté : en rétablissant l'ancien traitement, deux contrôles rougissent en
citant l'écran mot pour mot — « Email ou mot de passe incorrect » pendant que la
base est arrêtée.

### La note vocale ne partait pas — TROUVÉ : la page vieillissait sous le patron

**Trois signalements, la même phrase, et un défaut qui ne se reproduisait
jamais ici.** *« L'enregistrement n'a pas pu être transmis — la connexion a été
interrompue. »* La dictée passait pourtant à chaque essai : en développement,
sur la version bâtie, derrière une origine étrangère, avec un micro simulé.

**Ce qui manquait à mes essais, c'était le temps.** Les suites ouvrent une page
et agissent dans la seconde. Lui ouvre la fiche, regarde, réfléchit — et pendant
ce temps son banc se met à jour tout seul, comme il est fait pour.

Or **une action serveur n'a pas d'adresse** : elle porte un identifiant fabriqué
à la construction et inscrit dans la page. Après une reconstruction, la page
déjà ouverte appelle un identifiant que le nouveau serveur ne connaît plus.
L'envoi échoue **sans jamais l'atteindre** — d'où l'absence de trace au journal,
l'absence de refus à l'écran, et une phrase de secours qui accusait le réseau
alors que le serveur allait très bien.

Cela explique tout ce qui rendait le défaut insaisissable :

- **il ne se reproduisait pas ici** — l'identifiant était toujours frais ;
- **le reste de l'application marchait** — naviguer recharge la page, donc les
  identifiants. La fiche du chantier est justement l'écran où l'on STATIONNE ;
- **aucun message ne disait rien** — rien n'atteignait le serveur.

**Ce n'est plus une hypothèse : c'est reproduit.**
`scripts/eprouver-page-vieillie.mts` ouvre la fiche, redémarre le serveur, puis
dicte. Sur le code d'avant, il rend un `500` et **le message du patron, mot pour
mot**, avec la base vide. Par la route, un `200` et la note rangée.

L'enregistrement passe donc par une **URL** — `/api/notes-vocales/<chantier>` —
qui, elle, ne vieillit pas. Trois bénéfices s'ajoutent, qui vaudraient à eux
seuls le changement : le client reçoit un vrai code HTTP (401, 409, 500 se
distinguent), la limite de corps des actions serveur ne s'applique plus, et
l'envoi survit à une reconstruction. La règle est écrite une fois, dans
`note-vocale-entrante.ts`, et partagée par les trois écrans qui envoient une
note.

`test-note-vocale-par-url-e2e.ts` (voir `ARCHITECTURE.md` §65) tient l'invariant en continu : ramener
l'enregistrement dans une action serveur le fait rougir.

**Deux contrôles qui accusaient à tort, corrigés au passage.** Ils piochaient
« un chantier sans note » au hasard et tombaient parfois sur celui d'une autre
entreprise ; l'isolation le refusait à très juste titre, et le rouge désignait
l'application. Ils créent désormais leur chantier par l'écran. C'est le message
« étape : base » ajouté le matin même qui a permis de le voir en une lecture.

### La note vocale accusait le réseau d'une panne qui était au serveur

**Le patron, capture à l'appui :** *« L'enregistrement n'a pas pu être transmis
— la connexion a été interrompue. »*

C'était la branche de secours de l'écran, et **c'était le correctif de la veille
laissé à moitié fait**. Les refus ATTENDUS avaient été rendus bavards — format,
taille, cadence, enregistrement vide — mais les pannes IMPRÉVUES continuaient de
lever. La catégorie muette était précisément celle qui se produisait.

**Et sa phrase désignait le mauvais coupable.** Elle parlait de connexion alors
que l'aller-retour avait peut-être parfaitement eu lieu : une session expirée,
un disque plein, un service absent produisaient tous cette même phrase. Le
patron cherchait du côté de son réseau pendant que la panne était ailleurs. Une
erreur qui envoie chercher au mauvais endroit coûte plus cher que pas d'erreur
du tout — c'est écrit dans `AGENTS.md`, et c'est cette ligne-là qui a été
enfreinte.

**Deux changements, et le second est le plus important.**

*L'action ne lève plus rien.* Chaque panne rend une phrase qui **nomme le
maillon** — session, cadence, lecture, stockage, base. Le disque plein, le droit
d'écriture refusé et le service injoignable ont leur propre phrase, parce qu'ils
appellent chacun un geste différent : libérer de la place, corriger des droits,
relancer l'espace. « Le serveur n'a pas pu écrire » aurait fait chercher un
défaut dans le code, là où il n'y en a aucun. Le détail technique reste au
journal : le 11 août, une erreur de base non traduite avait affiché **la requête
SQL entière**, noms de tables et identifiant d'entreprise compris.

*L'écran ne conclut plus, il demande.* Quand l'appel lui-même échoue, il
interroge le serveur avant de parler. S'il répond, ce n'était pas la connexion —
c'est presque toujours une **page vieillie** : l'espace de travail se
reconstruit, les actions serveur changent d'identifiant, et une page ouverte
avant appelle une action qui n'existe plus. Le serveur va très bien, et un
rechargement suffit. Impossible à deviner, trivial à vérifier.

Douze cas éprouvent les deux règles sans base ni navigateur, et le contrôle a
été confronté à une traduction neutralisée : les huit premiers rougissent, y
compris celui qui interdit à la tuyauterie de fuir à l'écran.

**Ce qui n'est PAS corrigé, et qu'il faut dire :** la panne du patron n'a
toujours pas été reproduite ici — la dictée passe, avec un micro simulé, en
développement comme sur la version bâtie derrière une origine étrangère. Ce lot
ne répare pas la panne : il fait qu'elle se désigne. Et la note captée reste
**perdue** quand l'envoi échoue (`TODO.md` §0).

---
### Un contrôle qui s'effaçait lui-même son témoin

`test-detection-automatique-e2e` échouait sur « les `tel:` écrits par Atlas
restent des liens » — quarante-cinq secondes d'attente sur un `#temoin`
introuvable.

**Vérifié sur `main` seul avant de rien conclure : il échouait pareil.** Ce
n'était donc pas le lot en cours — et c'est la deuxième fois de la journée que
cette vérification évite d'accuser à tort.

La cause, reproduite puis comprise : le cas écrivait son témoin par `setContent`
dans la page qui venait de servir `/login`. Or `setContent` ne réécrit que le
document — **l'application, elle, tourne toujours**. Next réinjectait son
`<title>Atlas</title>` dans le `<head>` fraîchement écrit, et emportait tantôt
le témoin avec. Le contrôle accusait la détection automatique là où le fautif
était son propre décor.

Le témoin vit maintenant sur une page neuve, où aucune application ne tourne.

### Le contrôle des boutons ronds ne voyait presque rien

**Trouvé en lui livrant un bouton carré de plus.** `test-boutons-arrondis.ts`,
écrit le 12 août après sa demande — *« remplace tous les boutons rectangulaires
par les boutons arrondis »* —, cherchait la forme avec une classe niée `[^>]`.

Or **la flèche d'une fonction porte un chevron**. Tout bouton écrit
`onClick={() => …}` — c'est-à-dire l'immense majorité — passait donc sous le
radar. Le contrôle avait rougi une fois, sur le seul bouton dépourvu de
`onClick`, et en laissait passer **douze** à côté : quatre dans le devis dicté,
**trois sur la feuille d'envoi elle-même** — l'écran précis où il avait vu « un
bouton carré à côté d'une capsule » —, un sur la facture, un sur la note
vocale, deux sur l'assistant, un sur le calendrier.

Un contrôle qui attrape le cas rare et manque le cas courant est pire
qu'aucun : il fait croire que c'est propre. Le motif accepte désormais `=>`, et
les treize boutons portent la capsule. Sa règle du 12 août n'était appliquée
qu'à moitié ; elle l'est maintenant.

Le contrôle a été confronté à l'état qu'il prétend détecter — un bouton
rectangulaire témoin, avec et sans flèche.

### L'écran du devis parti est codé — « le signet d'or »

*« Code le 5. »* Retenu après onze blocs mesurés et cinq propositions
(`docs/maquettes/34-le-devis-sur-sa-base.html`).

**Ce que l'écran devient**, une fois le devis chez le client : un filet d'or pour
l'état, le nom du devis et le montant seuls au centre (46 px), « Modifier mon
devis » sous le total, et en bas sous le pouce le geste, le destinataire, puis
les trois actions en encre foncée — PDF · Copier le lien · Partager. Les lignes
de prestations n'y sont plus. **Elles restent AVANT l'envoi** : c'est là qu'on
vérifie ce qui part, et ce sont donc deux écrans distincts, pas un avec des
variantes.

**« Modifier mon devis » prévient, et ce n'est pas un ornement.** Vérifié dans le
dépôt avant d'écrire une ligne : rouvrir un devis parti crée une nouvelle version
mais **n'annule pas l'envoi** — la page publique sert `envoi.devis`, la version
reçue. Le client continue donc de la voir et peut l'accepter **au prix d'avant**.
Une feuille le dit en trois lignes, une seule fois, et se refuse. Refuser ne crée
aucune version : la suite le vérifie, parce que c'est exactement le genre de chose
qu'un correctif de confort casse sans bruit (`CLAUDE.md` §4).

**Trois défauts trouvés en éprouvant, et aucun n'était visible dans le code.**

1. **La hauteur, deux fois fausse.** D'abord `min-height: calc(100vh - 232px)` —
   232 étant l'en-tête « mesuré » ; l'écran débordait de 100 px. Puis
   `min-h-screen` + `pb-16`, qui comptait **deux fois** la barre du bas,
   `main.atlas-contenu` la réservant déjà : 68 px de trop. La bonne réponse
   existait depuis toujours — `atlas-ecran`, la classe de l'écran des chantiers.
   Un nombre magique décrivant la hauteur d'un en-tête devient faux au premier
   mot ajouté à un titre.
2. **Deux boutons nommés « Annuler »** dans la feuille — le voile et le vrai. Qui
   ne voit pas l'écran en entendait deux, sans savoir lequel choisir. Le voile est
   désormais `aria-hidden`, comme celui de l'écran des chantiers.
3. **« Plutôt par e-mail » manquait à mes cinq maquettes.** Personne ne l'avait
   remarqué, moi compris. Le livrer ainsi aurait défait sa demande du 4 août —
   *« si je veux l'envoyer par e-mail, je ne peux pas revenir le choisir »*. Il
   reprend sa place sous la ligne du destinataire, qui nomme déjà le canal.

**Deux détails qui viennent de sa capture du 12 août.** Le numéro s'écrit espacé
(`src/lib/numero-lisible.ts`) : collé, il ne se vérifiait pas d'un coup d'œil, et
c'est pourtant la dernière occasion de voir qu'on s'adresse au mauvais client —
son devis n'est pas parti ce jour-là à cause d'une adresse fausse. La fonction
**refuse de grouper** tout ce qui n'est pas un numéro français à dix chiffres :
un numéro étranger découpé par paires aurait l'air juste sans l'être, ce qui est
pire que rien sur une ligne de vérification. Et le bouton dit « Relancer par
SMS » quand le devis est déjà parti, « Ouvrir le SMS tout prêt » au premier envoi.

Éprouvé par `scripts/test-devis-parti-signet-e2e.ts` (huit points, dont le
débordement mesuré sur sa dalle) et `scripts/test-numero-lisible.ts`.
109/109 suites base, 55/55 suites navigateur, connexion réelle comprise.

**Deux suites tombaient, et elles avaient tort.** `test-suivi-devis-e2e` et
`test-envoi-client-e2e` lisaient le jeton du devis **dans l'adresse affichée à
l'écran** — celle-là même qu'il fait retirer. Six contrôles de suivi
dépendaient donc d'un détail d'affichage qui ne les concernait pas, et sont
tombés d'un coup. Ils prennent désormais le jeton là où il compte : dans la base
pour l'un, **dans le message que le patron va envoyer** pour l'autre. Le second
est un meilleur contrôle que l'ancien — il éprouve le lien que le CLIENT
recevra, et non celui qui était affiché à côté.

Un troisième exigeait la phrase « Le lien est toujours actif », et s'appelait
« un devis en attente affiche son lien ». Ce qu'il avait à défendre n'était pas
l'affichage mais le fait que **relancer réutilise le même lien** : il s'appelle
maintenant ainsi, et le vérifie sur le geste de relance et sur le nombre de
versions en base.
### « An unexpected response was received from the server. » — en français, et seulement quand c'est vrai

**Sa capture, à 14 h 04 :** un panneau rouge en anglais, une pile d'appel dans
`node_modules`, rien sur ce qui s'est passé ni sur quoi faire.

**Ce que la capture disait et qu'il fallait lire :** le chemin commençait par
`.next/dev` — **son banc servait la version LENTE**. En version lente, chaque
écran se compile au premier appel — trente à cent secondes, davantage sur son
disque — et **le relais de GitHub abandonne au bout d'une minute** en rendant sa
propre page d'erreur. Le navigateur reçoit du HTML là où il attendait une
réponse d'Atlas : c'est exactement ce message.

**Ce qui n'a PAS été fait, et pourquoi.** La cause n'a pas été reproduite ici :
le bouton de mise à jour, joué dans les conditions du banc avec le code changé
sous la page ouverte, s'est comporté correctement. Rien n'a donc été « corrigé »
au jugé — la seconde faute que ce dépôt s'interdit après avoir accusé à tort.

Deux choses ont été faites, toutes deux vérifiables :

1. **Le défaut parle.** `src/lib/reponse-illisible.ts` reconnaît cette famille
   d'échec — quatre formulations, selon le navigateur et la version du cadre —
   et un veilleur posé dans la coque affiche une phrase française avec le seul
   geste utile : **Recharger**. Sur la version rapide, ce panneau n'existe même
   pas : l'échec y est muet, le bouton pressé ne fait rien. Des deux, le silence
   était le pire.
2. **L'écran dit qu'il est lent.** Réglages annonce désormais, en toutes
   lettres, que la version servie est celle qui se construit encore — et que
   c'est elle qui produit « une réponse inattendue du serveur ». Rien ne le
   disait ; il ne pouvait pas relier les deux.

**Ce que le veilleur REFUSE de faire compte autant.** Un défaut ordinaire du
code n'est jamais habillé en lenteur : l'y habiller enverrait recharger une page
qui ne guérira pas, et masquerait le défaut. Six messages réels — dont
« Invalid Server Actions request. » et une erreur d'hydratation — sont éprouvés
comme devant rester tels quels.

**Trouvé par la suite navigateur, avant lui :** le veilleur n'était monté que
sur les écrans à barre de navigation. **L'écran de connexion en était dépourvu**
— c'est-à-dire précisément l'écran où une réponse coupée est la plus probable,
puisque c'est le premier appel, celui qui compile tout, et le seul où il n'a
aucun autre repère.



### Le devis parti, sur sa base — cinq façons de tenir ce qu'il a arrêté

Après la maquette 33, il tranche le **contenu** : ne garder que le nom du devis
et le total, retirer les lignes de prestations, poser sous le total un lien
**« Modifier mon devis »** qui ramène au devis, et passer « Télécharger le PDF »
et les deux autres **en encre foncée**, visiblement cliquables.

`docs/maquettes/34-le-devis-sur-sa-base.html` : sa base au mot près, puis quatre
façons de la tenir à contenu identique — le montant à même la page (52 px, sans
carte), le montant monté dans le titre, les trois actions empilées, et le signet
d'or. Ce qui se choisit n'est donc plus quoi montrer, mais comment le poser.

**Deux choses réglées en dessinant, et elles ne sont pas décoratives.**
« Partager autrement (WhatsApp…) » ne tient pas à trois sur une ligne : il
devient « Partager », ou bien les trois s'empilent (idée 4), ce qui rend chaque
cible large comme le pouce. Et l'idée 4 débordait de 23 px — resserrée à 11 px
de hauteur de ligne plutôt qu'en retirant « Parti il y a 2 jours », qui est la
seule chose de l'écran disant depuis quand on attend.

**Une question posée, pas tranchée :** reprendre un devis déjà parti en crée une
nouvelle version et rend l'ancien lien caduc. Faut-il le prévenir au clic ?

`src/` n'est toujours pas touché.

### « Trop d'infos sur cette page » — quatre façons de retrancher, dessinées

Le patron, capture à l'appui : *« je trouve qu'il y a trop d'infos sur cette
page, crée moi une maquette optimisée »*, puis : *« fabrique-moi la maquette et
montre-la-moi avant de coder quoi que ce soit »*. `src/` n'est pas touché
(`CLAUDE.md` §3 bis).

**Mesuré avant d'être dessiné.** L'écran du devis parti porte **onze blocs** et
déborde de **382 px** — il faut défiler, et c'est exactement ce qu'il signale.
La carte d'état porte à elle seule six choses, dont l'adresse complète du lien
sur trois lignes illisibles.

`docs/maquettes/33-le-devis-parti-allege.html` propose quatre retranchements qui
ne portent pas au même endroit — l'adresse effacée (6 blocs), l'état monté dans
le titre (4), le devis replié derrière une ligne (5), le geste seul sous le
pouce (3). Chacune dit **ce qu'elle coûte**, parce que c'est cela qui se choisit.

**Un contrôle qui a servi tout de suite.** La proposition A annonçait « tout
tient sans défiler » et débordait de 84 px : le texte était faux, et l'œil ne le
voyait pas. Il a fallu retirer aussi la carte « Chantier / Client », qui redisait
le numéro affiché deux blocs plus bas. Deux autres défauts n'ont été vus que sur
la capture — cinquante pixels de vide sous le total (les jambages d'une serif de
21 px), et quatre vignettes de bouton **vides**, leurs teintes n'existant que
dans le cadre du téléphone.

### Le bouton « carré » : il est déjà au rayon des cartes

*« Le bouton est toujours carré, pas arrondi comme tous les autres. »* Mesuré
avant de corriger : ce bouton porte **exactement le rayon des cartes**, 4 px
(`radius.card`), posé le 10 août à sa demande — *« un rectangle presque droit se
lit comme une pièce imprimée »*.

Il a pourtant raison de le voir carré, et la raison n'est pas dans le code :
**sur un aplat vert foncé, un rayon de 4 px ne se voit pas**, le contraste est
franc et l'œil lit un angle droit ; sur une carte crème posée sur un fond crème,
le même rayon se lit, parce que le coin fond dans la page. Pour *paraître* aussi
arrondi qu'une carte, un bouton plein doit être *plus* arrondi qu'elle.

La maquette montre donc le même bouton à 4, 8, 12 px et en pilule, chacun
au-dessus d'une carte au même rayon. Le choix lui revient — et il vaudra pour
**vingt-sept écrans** (`PrimaryButton`), ce qui est écrit noir sur blanc sur la
page.

### L'envoi du devis n'est pas en panne — et il ne faut pas le « réparer »

Signalé d'abord comme un défaut : *« lorsque le mail est parti je n'ai pas de
message qui prouve qu'il est bien parti, la page reste figée »*. Puis, de
lui-même : *« en fait le mail n'était pas parti […] il y avait une faute sur
l'adresse mail, c'est pour ça »*.

**Sa messagerie s'est bien ouverte. Le message n'est pas parti parce que
l'adresse était fausse.** Rien n'a donc été modifié, et c'est délibéré : la CSP
a été relue (elle ne régit pas la navigation `mailto:`), et l'adresse construite
pour son cas exact a été fabriquée et mesurée — 574 caractères, très en deçà de
toute limite. Écrit ici pour qu'une prochaine conversation ne parte pas réparer
une panne qui n'a pas eu lieu (`TODO.md`, 0 sexdecies).
## 2026-08-11

### Le serveur fantôme du port 3000 : un gardien juste, posé trop tard

Quatre batteries de suite ont fini sur « ❌ Le port 3000 est déjà pris », et
l'une d'elles a fait accuser le calcul du prix — `'0.00' == '34.50'`, un
enregistrement qui n'avait pas eu le temps de partir pendant que l'occupant
compilait. Le prix n'y était pour rien.

**Ce n'était pas une suite oublieuse** — l'hypothèse écrite en premier, et
fausse. Une sentinelle a noté ce qui tournait au moment où le serveur
apparaissait : parent déjà mort, aucune suite en cours, le verrou du banc à la
même minute. Le lanceur était `verifier-connexion-avec-serveur.mts`, qui monte
un vrai banc puis tue son groupe dès la connexion éprouvée.

`banc.mjs` **sert d'abord et bâtit ensuite** ; ses gestionnaires de `SIGTERM`
vivaient en fin de fichier, donc **après** la construction. Entre le lancement du
serveur et leur installation, plusieurs minutes : un signal reçu là tuait le
script net, et le serveur — détaché, pour d'excellentes raisons — survivait sur
le port. Le code était juste ; il arrivait en retard.

Ils sont désormais posés ligne suivante après le lancement. Et la batterie
navigateur **refuse** un port déjà pris au lieu de se rabattre en silence sur
l'occupant : c'était le plus grave, car cinquante suites avaient travaillé une
fois sur un serveur qu'elle n'avait pas lancé, sans un mot. Un résultat obtenu
d'un serveur inconnu ne prouve rien — vert ou rouge, c'est le pire des deux
états.

**Les deux contrôles savent échouer**, et l'un d'eux a dû être renforcé pour
cela : sa première version cherchait le nom de la fonction dans le fichier et
restait verte quand la garde était neutralisée d'un `if (false && …)`. Un
contrôle qui se contente de trouver un mot ne protège que du mot.

### Un chantier dicté ne pouvait plus jamais être envoyé au client

**Le patron, capture à l'appui :** *« l'encart qui permet d'envoyer aux clients
par SMS, par e-mail, a disparu. »* La feuille d'envoi était réduite à une
phrase — « Indiquez d'abord comment joindre ce client — sur sa fiche » — et un
bouton grisé.

**L'encart n'avait pas disparu ; la porte qu'on lui désignait, si.** L'écran
« Informations », seul endroit où saisir un téléphone ou un e-mail, avait quitté
le tiroir de la fiche **quelques heures plus tôt, à sa demande** — c'est donc un
défaut créé le soir même, en allégeant cet écran. Résultat : un chantier né d'une
dictée, dont le client reste « non renseigné », ne pouvait plus jamais partir.

Les deux canaux et le champ sont désormais offerts **là où ça bloque**, et la
coordonnée est écrite sur le client — pas retenue pour ce seul envoi.

**Ce que ça apprend dépasse cet écran, et c'est le vrai enseignement.** Le dépôt
avait déjà tranché ce point exact le 4 août, pour l'écran d'APRÈS l'envoi :
*« si la coordonnée manque, elle se saisit sur place — il n'existe aucun autre
écran pour la renseigner, et renvoyer le patron sur la fiche du client
l'enverrait vers une porte qui n'existe pas »*. La règle était juste, écrite, et
n'avait été appliquée qu'à un seul des deux écrans. Une semaine plus tard, le
second l'a payée. Elle est maintenant générale (`ARCHITECTURE.md` §62) : **un
écran qui refuse d'avancer offre de lever ce qui l'arrête, ou nomme un endroit
qui existe** — jamais l'un sans l'autre. Un renvoi écrit dans une phrase se
périme dès que la navigation bouge, et aucun test ne suit un lien écrit en
français.

**Pourquoi aucune suite ne l'avait vu :** toutes créaient leur chantier AVEC un
numéro. Le chemin le plus courant chez lui — créer, laisser le contact vide,
envoyer — n'était emprunté par personne. Il l'est maintenant, par l'écran, et le
contrôle va jusqu'à vérifier que la coordonnée est rangée en base : un écran qui
accepterait la saisie sans la ranger serait vert à l'œil et faux. Confronté au
code livré : trois rouges.

### Ajouter une photo ne fait plus changer de page — et l'écran Photos disparaît

**Le patron, capture à l'appui :** *« lorsque je suis sur la page chantier et que
je clique sur l'encadré doré avec le petit plus doré pour ajouter des photos, je
veux que ça arrête de me faire changer de page […] et que tu me supprimes toutes
les autres étapes »*.

Ajouter une photo coûtait **quatre gestes et un changement d'écran** : le « + »,
la page Photos, le bouton « Ajouter une photo », notre feuille « Prendre une
photo / Choisir dans ma bibliothèque », et **enfin** le menu du téléphone. Il en
coûte deux : le « + », puis le menu du téléphone.

**Notre feuille maison a disparu parce que le système fait mieux.** Un champ
`accept="image/*"` **sans `capture`** fait afficher par iOS un menu qui porte
déjà les trois entrées — *Photothèque*, *Prendre une photo*, *Choisir les
fichiers*. Les deux chemins que le patron exigeait le 6 août y sont, au même
endroit, un geste plus tôt. `capture` reste interdit : sur un iPhone il n'exprime
pas une préférence, il **impose** l'appareil photo et retire l'accès à la
photothèque.

**L'écran `/chantiers/[id]/photos` n'existe plus** — décision prise avec le
patron le même jour. Ajouter, regarder et retirer se font désormais dans la
pellicule du tiroir de la fiche. La route répond 404, et une suite le vérifie :
un écran à moitié supprimé est un chemin mort qu'on retrouve trois mois plus
tard sans savoir s'il compte encore. Deux choses ont été supprimées avec lui, à
dessein : le décompte « 6 photos » (il comptait ce qu'on a sous les yeux) et le
lien « Passer à la note vocale » (l'anneau est au centre de la fiche depuis la
veille).

**Deux défauts que le déménagement crée, et qu'aucune relecture n'aurait
vus** — détail dans `ARCHITECTURE.md` §60 :

- la visionneuse plein écran, rendue **dans** le tiroir, passait **sous** la
  barre de navigation : le tiroir porte un `z-index` et plafonne ses enfants.
  Elle sort par un portail, et une suite mesure que la barre est bien couverte ;
- le tiroir mesurait sa hauteur sur `[photos.length, etapes.length]`. La
  pellicule ne passant plus par ses propriétés, la mesure ne voyait plus rien :
  le tiroir des retirés apparaissait **derrière le bord**, « Annuler » hors
  d'atteinte. Il observe désormais son corps (`ResizeObserver`).

**Ce que la suite tient :** l'adresse **avant et après** l'ajout — c'est la
demande elle-même, et tout le reste peut être vert pendant que le patron change
d'écran.

### La ligne « Version » ne disait pas la BRANCHE — et il a cru avoir le bouton

**Le patron :** *« la modification du bouton nouveau chantier n'est pas
effectuée. Corrige ça. Et pourtant, j'ai la nouvelle dernière mise à jour, celle
de dix-neuf heures et quelques. »*

**Les deux affirmations étaient vraies, et c'est tout le problème.** Le bouton
est bien codé, poussé, éprouvé — sur la branche
`claude/nouveau-chantier-button-design-2vuu9h`. Son espace de travail, lui, suit
`main`, où il n'a jamais été fusionné. Et `main` avançait ce soir-là en
parallèle : `19:02`, `19:11`, `19:13`, `19:37`. Il a ouvert Réglages, lu
« 11/08/2026 19:37 · b45cd5d », et conclu qu'il avait la livraison de dix-neuf
heures. Il l'avait — ce n'était simplement pas celle-là.

**Rien à l'écran ne pouvait l'arbitrer.** Deux branches vivantes le même soir
portent la même heure, et sept caractères d'empreinte ne se comparent pas de
tête sur six pouces. La ligne Version existait précisément pour répondre à
« est-ce que j'ai les corrections ? » (7 août) ; elle a répondu **oui** à une
question à laquelle la réponse était **non**.

Elle nomme désormais la branche suivie — `… · b45cd5d · main` — et l'écran dit
en toutes lettres qu'un correctif livré sur une autre branche n'arrivera jamais
là, quelle que soit la date et quel que soit le nombre de fois qu'on presse
« Chercher les dernières corrections ». Ce bouton suit la branche courante : il
répondra fidèlement « vous étiez déjà à jour » jusqu'à la fin des temps.

**Un second mensonge, trouvé en chemin, dans `.devcontainer/demarrer.sh`.**
`ATLAS_VERSION` était calculée à la ligne 108 et la mise à jour arrivait à la
ligne 155 : le bandeau du terminal annonçait donc « Le code a été mis à jour au
démarrage » puis « Version exécutée : *celle d'avant* ». Elle est relue après la
mise à jour, avant que le veilleur ne reparte — sans quoi le serveur neuf
héritait lui aussi de la variable périmée.

Les trois états sont éprouvés, y compris ceux où l'on n'invente rien : hors
dépôt git (« inconnue »), et tête détachée (la ligne perd son dernier mot
plutôt que d'affirmer une branche fausse). Confronté à l'ancien code, le
contrôle rougit et nomme la branche manquante.

**Et le bouton est parti chez lui.** Sur son accord — *« fusionne dans main »* —
la branche est fusionnée dans `main` en avance rapide (`6059641`), batterie
complète au vert sur la fusion, 54/54 suites navigateur et connexion réelle
derrière une origine étrangère. Son espace le prendra au prochain allumage, ou
tout de suite par « Chercher les dernières corrections ».

### Six façons d'ouvrir un chantier, pour remplacer l'aplat vert

*« J'aime pas le gros bouton nouveau chantier […] ce gros bouton en plein
milieu, ça ne fait pas très luxe »*, le 11 août 2026, capture à l'appui.

`docs/maquettes/14-le-geste-nouveau-chantier.html` propose six remplaçants au
même endroit, l'écran restant identique par ailleurs — même en-tête, même fil,
même perle : **le filet** qui se trace, **le sceau**, **le premier brin**, **le
cartouche gravé**, **la pastille au pouce**, **la légende sur le trait**.
Rien n'est codé : l'application porte toujours l'aplat (`TODO.md`, 0 terdecies).

**Trois choix de fabrication qui ont compté.**

1. **Les écrans font 390 × 664**, la dalle réelle du patron (`ECRAN_DU_PATRON`),
   et non les 852 px d'une fiche technique. C'est ce qui rend le reproche
   mesurable : l'aplat coûte quatre-vingts pixels, soit **un chantier de moins**
   visible. L'écran d'aujourd'hui figure sur la page, à côté du constat — on ne
   compare pas à un souvenir.
2. **Tout ce qui bouge, bouge sans qu'on le survole.** Le patron regarde depuis
   un téléphone : un état qui n'existe qu'au survol n'existe pas pour lui. Les
   six propositions s'animent seules, en CSS, et l'état « doigt posé » est
   montré en fixe à côté du repos.
3. **Aucun script**, comme les treize maquettes précédentes : son lecteur n'en
   exécute pas, et une page engendrée en JavaScript lui arrive vide.

### Un rouge d'enchaînement qui n'en était pas un

`test-devis-e2e` — le total TTC d'un devis — est tombé **une fois** dans un
balayage complet, puis a repassé au vert sur les trois vérifications suivantes :
seule, sur `main` seul, et dans un second balayage complet de la même branche
(51/51). Il n'y avait donc rien à corriger, et c'est écrit ici pour que la
prochaine conversation ne reprenne pas la chasse.

**Ce que la chasse a quand même appris**, et qui vaut plus que le rouge :
`main` seul passe à 50/50, la branche à 51/51, et la suite fautive est **la
même** dans les deux cas quand on la joue isolément. Un balayage rouge une fois
sur quatre n'est pas une preuve : la machine porte alors un serveur, une base,
un navigateur et parfois un autre balayage — c'est la charge qui bouge, pas le
code. Rejouer AVANT d'accuser.

**Une seconde suite se comporte de même, et elle est nommée ici pour la même
raison** : `test-planning-vers-facture-e2e`, sur son dernier cas — *« clôturé
AVANT sa date : il quitte le planning pour les terminés »*. Deux balayages
complets l'ont vue rouge, deux exécutions isolées l'ont vue verte, sur le même
code. Elle porte déjà sa propre explication, et elle est juste : *« l'écran
Terminés n'a pas répondu en deux tentatives. C'est le serveur de développement
qui n'a pas suivi, pas l'écran. »* Un message qui désigne le bon coupable vaut
la moitié du diagnostic — ne pas le contredire sans preuve.

### L'aplat vert est remplacé — le bouton est CODÉ

Douze jours après le refus (*« ce gros bouton en plein milieu, ça ne fait pas
très luxe »*) et vingt-quatre maquettes plus tard, `src/app/EcranChantiers.tsx`
porte enfin le bouton qu'il a arrêté : **« Nouveau chantier » écrit, un anneau
d'un cheveu à sa droite qui BAT tant qu'on ne l'a pas touché**, et à l'appui
**trois tours avec onze grains d'or**, puis la feuille 520 ms plus tard.

**Les mesures viennent de la maquette, pas d'un souvenir.** Les onze grains
sont recopiés un à un depuis `docs/maquettes/24-le-bouton-retenu.html`, avec
leurs distances irrégulières — onze grains à la même distance dessinent une roue
de vélo, pas une gerbe. Les réinventer, c'était s'assurer que l'écran et la
maquette divergent au premier retour.

**Ce que le geste protège, et qui n'est pas décoratif :**

- **l'appui s'enfonce en 140 ms**, bien avant la fin du tour — une demi-seconde
  sans réponse se lit comme une panne, et on appuie deux fois ;
- **un second appui pendant le geste est ignoré** — sans quoi deux chantiers
  naissent là où il n'en voulait qu'un ;
- **sous « mouvement réduit », la feuille monte tout de suite**, sans battement
  ni gerbe : attendre une animation qui ne joue pas ferait passer un réglage
  d'accessibilité pour une lenteur ;
- **le lien garde son `href`** : sans JavaScript, ou avant l'hydratation, il
  mène à l'écran entier. C'est le repli, et il est voulu.

`scripts/test-bouton-nouveau-chantier-e2e.ts` mesure la demi-seconde et le
double appui ; `scripts/capture-bouton-nouveau-chantier.mts` prend les trois
états — l'attente, le geste figé à mi-course, la feuille — parce que trois
défauts de ces maquettes n'ont été trouvés que par une capture.

**Une variable de plus dans la palette** : `--or`, le second accent, qui
n'existait que dans `design-tokens.ts` et pas en CSS.

### Le bouton est arrêté : le mot, le rond qui bat, resserré

Il a retenu la première disposition — *« j'aime bien le premier »* — et demandé
quatre réglages : une onde d'attente qui va moins loin, un ensemble plus petit,
un rond plus petit, moins de grains.
`docs/maquettes/24-le-bouton-retenu.html` ne montre que celui-là, et chiffre
chaque écart pour qu'il puisse être refait à l'identique dans l'application :

| | avant | après |
|---|---|---|
| portée de l'onde | 1,85 × le rond | **1,42 ×** |
| diamètre du rond | 46 px | **38 px** |
| taille du « + » | 24 px | **20 px** |
| écart mot ↔ rond | 16 px | **13 px** |
| corps du libellé | 9,5 px | **9 px** |
| nombre de grains | 16 | **11** |
| portée des grains | 58 px | **46 px** |

Ce qui n'a pas bougé : les trois tours freinés en 560 ms, la demi-seconde avant
la page, l'arrêt net du battement dès l'appui.

**Le contrôle exigeait au moins trois boutons pressables par page** — une
habitude prise sur les pages de comparaison. Il refusait donc celle-ci, qui
n'en montre qu'un, et pour cette seule raison. Un contrôle qui encode une
habitude finit par refuser ce qui la rompt : le seuil est ramené à un.

### Le mot, le rond qui bat, et la poussière

Il a décrit le mixte pièce par pièce : *« nouveau chantier écrit, le plus à
droite qui clignote en attente qu'on clique dessus, et une fois qu'on clique,
il se met à tourner avec les éclats de poussière »*.

`docs/maquettes/23-le-mot-et-le-rond-qui-bat.html` tient le geste fixe — le
battement d'attente, le tour de trois tours, seize grains d'or, puis la page —
et ne fait varier que **la place du mot** : à droite du rond, coupé en deux par
lui (« Nouveau » | rond | « chantier »), en petit doré dessous, réduit à
**« Ajouter »**, accompagné des deux traits, posé au-dessus, ou **effacé par le
geste lui-même**.

**Le battement n'est pas un clignotement, et c'est délibéré.** Allumé/éteint,
c'est un signal d'alarme ; ici une onde d'or naît du bord de l'anneau toutes les
3,4 secondes et se dissout. Elle s'arrête NET dès l'appui : un objet qui
continue d'appeler alors qu'on l'a déjà pris n'écoute pas. Et le rythme est lent
à dessein — un écran qui alerte dix fois par jour finit par être ignoré, ou
éteint.

**Un défaut vu à la capture :** « le mot dessus » était la copie exacte de « le
mot dessous ». Le mot était déjà écrit avant le rond dans le balisage, et la
colonne était en plus inversée — deux inversions valent une identité. Les sept
contrôles étaient verts, et les deux cartes montraient la même chose.

### Le rond redescend au milieu, entre deux traits

*« Je ne veux pas qu'il soit en haut à droite, je veux qu'il soit vraiment
centré au milieu, et peut-être avec un petit trait de chaque côté du rond […]
et lorsqu'on clique, les traits qui s'écartent légèrement. »*

`docs/maquettes/22-le-rond-entre-deux-traits.html` reprend donc l'anneau et son
« + » — celui qu'il a retenu — mais **au centre**, à la place qu'occupait
l'aplat vert, flanqué de deux traits de 56 px. À l'appui : trois tours, les
traits s'écartent de douze pixels, puis la page.

Les six déclinaisons sont les mêmes qu'à la maquette 21, à une près : « le trait
aspiré » devient **« les traits qui rentrent »** — l'inverse du geste demandé,
gardé pour qu'il puisse comparer plutôt que me croire sur parole.

**Deux de plus, à sa demande, reprennent l'anneau de la note vocale** : un
cercle sombre à l'extérieur, un second à l'intérieur — et la dernière remplace
les traits par **les petits crans de la dictée**. L'argument n'est pas de goût :
les deux écrans cesseraient d'avoir chacun son vocabulaire. On dicte dans un
anneau, on ouvre un chantier dans le même, et le troisième geste rond, le jour
où il faudra, existera déjà.

Deux mesures qui ne se voient pas mais qui décident : le rond passe de 46 à
52 px quand il porte le second anneau — en dessous, deux cercles concentriques
se touchent presque et l'ensemble se lit comme un trait épais ; et les sept
crans ont des hauteurs inégales, parce qu'un peigne régulier se lit comme une
mire d'imprimeur, pas comme un son.

**Les traits sont DANS le lien, pas à côté.** La cible du doigt fait alors toute
la largeur du groupe au lieu des quarante-six pixels de l'anneau : sur un
téléphone, c'est la différence entre viser et toucher.

**Un défaut vu à la capture, invisible au contrôle :** le bloc du titre a perdu
ses marges en changeant de squelette — elles vivaient dans la grille de la
maquette précédente, où le « + » était dans l'en-tête. « Bonjour Florian » se
retrouvait collé au bord de l'écran, et les douze contrôles étaient verts.

### Le bouton est choisi : le « + » au bout du titre

Il l'a désigné sur une capture de la maquette 15 (proposition H) : *« le petit
plus là que tu vois en haut à droite, c'est celui-là que je veux »*. C'est
l'anneau d'un cheveu posé sur la ligne de base de « Vos chantiers » — celui qui
**ne coûte aucune ligne à l'écran**. Ce qu'il demande en plus : *« qu'il se
mette à tourner à fond et qu'ensuite ça ouvre la page »*.

`docs/maquettes/21-le-plus-du-titre.html` en donne six déclinaisons, toutes
bâties sur le même tour — trois tours rapides, freinés à la fin, puis la page :
**le tour franc** (rien d'autre), **le tour et la poussière** (seize grains
d'or), **l'anneau qui s'ouvre** (il s'agrandit jusqu'à devenir la page — et,
comme il est en haut à droite, la page naît du coin), **les deux sens** (l'anneau
contre le signe), **le trait aspiré** (le filet de l'en-tête se rétracte dans
l'anneau), **le tour appuyé** (l'écran recule d'un cheveu, comme il le fait déjà
quand une feuille monte).

**Un cercle qui tourne ne se voit pas tourner.** Celui du contre-tour porte donc
une encoche d'or. C'est exactement l'erreur qui avait rendu invisible la lunette
du cadran, quatre maquettes plus tôt — et elle serait passée une deuxième fois
sans la capture.

### Trois défauts du contrôle, dont deux qui accusaient la maquette

Éprouver des gestes de plus en plus vivants a fini par casser l'outil qui les
éprouve, et chaque fois en accusant le mauvais coupable :

- **Sa fenêtre de mesure partait de l'appui.** Quand le clic mettait cinq
  secondes à rendre la main, elle était close avant d'avoir commencé : il
  annonçait « la feuille n'est jamais montée » alors qu'elle l'était depuis
  longtemps.
- **Son clic attendait un bouton immobile.** Dès qu'un geste déplace son propre
  bouton — l'écran qui recule, les lettres qui s'écartent — Playwright rejouait
  son clic en boucle, et chaque rejeu relançait le geste. Le clic est désormais
  dispatché sans attendre (`force`).
- **Il jugeait « ça bouge » en cherchant un `<svg>`**, ce qui refusait toute
  proposition dont la matière n'a pas de dessin.

### Le rond éclate, et devient la page

*« Un rond avec un plus et lorsque j'appuie, une dynamique un peu style
explosion, de débris, avec le rond qui s'agrandit. »* Le squelette est donc fixé
par lui, et ne varie plus : disque plein (vert pin, ou or), « + », gerbe, puis
agrandissement jusqu'à remplir l'écran. **Aucun fond clair nulle part.**

`docs/maquettes/20-le-rond-qui-eclate.html` ne fait varier que **la nature des
débris** : la poussière d'or (vingt grains fins), les tessons (c'est le rond
lui-même qui se fend en six), la braise (treize étincelles qui **retombent**),
le souffle (aucun débris, trois ondes), l'or plein (disque d'or, gerbe sombre),
la croix éclatée (c'est le « + » qui se brise en quatre barres).

**La feuille ne monte plus du bas** : elle est posée sous le rond qui grandit et
se découvre à mesure. Deux mouvements l'un sur l'autre faisaient bégayer le
geste.

**Trois défauts vus à la capture, et aucun n'aurait été trouvé autrement.**
Le rond commençait à grandir en même temps que la gerbe : le disque de papier
recouvrait les débris avant qu'on ait pu les voir — l'explosion existait dans le
code et nulle part à l'écran. Les débris étaient posés **sous** le disque : on
ne voyait qu'une poussière collée sur le vert, de la saleté plutôt qu'une
explosion. Et ils partaient du centre au lieu du bord, si bien que les trois
quarts de la gerbe restaient cachés.

Les distances de projection sont donc étirées pour le grand format de la planche
(`--f`) : un débris qui naît au bord d'un disque de 76 px naîtrait au milieu
d'un disque de 104.

### Retour à la retenue : six gestes tenus

*« Tu as primé sur l'originalité au détriment de l'élégance. »* Le reproche est
juste, et il est daté : la maquette 18 faisait du spectacle.

`docs/maquettes/19-six-gestes-tenus.html` retire trois choses, et c'est tout le
sujet : **la gerbe d'éclats** (dix esquilles projetées), **les matières
simulées** (métal brossé, laque brillante, cire), et **les mouvements
simultanés** — désormais une seule chose bouge à la fois, le reste de l'écran ne
bronche pas. Restent la proportion, le cheveu d'or et le temps : les six gestes
durent entre 500 et 640 ms.

Les six : **le mot** (les lettres s'écartent, l'œil se referme), **la goutte
d'or** (vingt pixels, le seul aplat de couleur de l'écran), **le disque de
nuit** (galet mat, le cerceau vient s'y poser), **le cercle qui se ferme** (il
manque un arc ; l'appui le complète, puis le cercle devient la page), **le filet
traversé** (le trait qui ferme l'en-tête porte l'œil — rien ne s'ajoute), **les
deux volets** (la ligne s'écarte en deux, la feuille monte par l'ouverture).

**L'ouverture par agrandissement n'est gardée que sur une seule des six.**
Répétée partout, elle deviendrait un tic — et c'est exactement ce qui rendait la
maquette précédente bavarde.

**Un défaut né en cherchant l'élégance, et il en dit long.** L'écartement des
lettres élargissait le lien de vingt-huit pixels *pendant* le geste : le
contrôle automatique n'arrivait plus à le presser deux fois de suite. Une cible
qui grandit sous le doigt est une cible qui se dérobe — la boîte du bouton est
maintenant fixe, seules les lettres bougent dedans. Et sans `nowrap`, le libellé
passait sur deux lignes en plein geste.

**Le contrôle ne cherche plus une classe, mais un rôle.** Il visait
`.pastille`, puis `.geste` ; la maquette suivante l'aurait encore appelé
autrement, et il serait passé au vert **sans rien presser du tout**. Il vise
désormais ce que le bouton annonce à qui ne voit pas l'écran :
`[aria-label="Nouveau chantier"]`.

### Plus aucun fond clair : six matières, et deux boutons qui deviennent la page

*« On s'améliore, mais je n'aime toujours pas. […] J'ai l'impression que le fond
blanc me dérange. J'ai envie que tu sois innovant […] devancer tout le monde,
Apple, Amazon. »*

`docs/maquettes/18-six-matieres.html` change d'axe. Aucune des six ne pose de
disque de papier : **l'iris** (six lames de laque qui s'écartent sur une lumière
d'or), **l'or brossé** (un anneau de métal dont les stries tournent avec lui),
**la laque** (un galet profond où un reflet glisse même au repos), **le cachet
de cire** (bord irrégulier, A en relief, qui s'écrase à l'appui), **le vide**
(pas de disque du tout — un anneau, et le papier de l'écran au milieu), **le
noyau** (de l'encre et de l'or qui dérivent, sans aucune marque).

**Et surtout, deux d'entre elles n'ouvrent plus la feuille : elles la
deviennent.** Sur l'iris et le vide, le bouton s'agrandit jusqu'à remplir
l'écran, et la page est déjà là quand il a fini. Le geste et l'écran qui arrive
ne font qu'un seul mouvement — c'est là que se joue l'écart avec ce que font les
autres, pas dans la couleur.

Tout est fait à la main, sans image ni police : dégradés coniques pour le métal,
ombres internes pour le relief de la cire, six lames en SVG pour l'iris.

**Deux défauts vus à la capture, et un seul aurait suffi à tout gâcher.** Dans
un SVG, un « px » de transformation vaut **une unité de la vue** : les lames de
l'iris, écartées de « 4,2 px », partaient en réalité de treize pixels — le
disque devenait un carré à l'ouverture. Et le grain de lumière du centre,
déclaré avant les lames, passait dessous : en SVG c'est l'ordre du balisage qui
décide, pas l'intention.

**Si une matière est retenue**, la teinte de laque (#10150f → #263025) devra
entrer dans `src/lib/design-tokens.ts` : une couleur qui ne vit que dans une
maquette finit par diverger de l'écran.

### Le contrôle mesurait la demi-seconde à l'œil, il la chronomètre

`verifier-maquette-pastille.mjs` regardait « à 200 ms, la feuille est-elle
fermée ? ». Sur une machine chargée, ce regard arrivait parfois à 520 ms et
accusait un délai qui n'avait pas bougé — un contrôle qui échoue une fois sur
dix ne prouve rien et use la confiance de qui le lit. Il **mesure** désormais
l'instant où la feuille monte. Il ne cherche plus non plus de `<svg>` pour
juger que « ça bouge » : « le noyau » n'a aucun dessin, sa matière est une nappe
de dégradés — chercher une forme précise, c'est refuser la proposition suivante.

### Le sceau est retenu, six gravures le disputent

*« J'aime beaucoup la deuxième. Par contre, ce que je n'aime pas, c'est un peu
le design de la pastille. »*

Le **sceau clair** — disque de papier cerné d'un cheveu d'or — est donc acquis :
sa taille, sa place, la gerbe et la demi-seconde ne bougent plus.
`docs/maquettes/17-six-marques.html` ne fait varier que **la gravure** : le
cadran gradué, le trait pur, le monogramme d'Atlas, la facette, l'anneau et sa
bille, le point. Les six se pressent — côte à côte pour comparer la marque, puis
chacun dans l'écran pour le geste entier.

**Le cadran ne fait pas tourner son signe, mais sa lunette.** Une aiguille qui
tourne se lit comme un chargement ; une lunette qui tourne se lit comme un
mécanisme. C'est la seule des six où le mouvement veut dire quelque chose.

**Trois défauts vus à la capture, invisibles autrement :** la lunette tournait
sans que rien ne le montre — soixante graduations identiques sont immobiles quel
que soit l'angle, il a fallu leur donner un repère ; l'onde d'un grand sceau
débordait de sa carte et n'y laissait que quatre arcs dans les angles ; et la
corde horizontale de la facette brouillait la taille de la pierre.

Le contrôle éprouve désormais la **première et la dernière** pastille armée
d'une page : sur la page fusionnée, ce sont deux maquettes différentes, chacune
avec son script — n'en éprouver qu'une laissait l'autre silencieusement morte.

### La pastille qui tourne, éclate et ouvre — la première maquette qu'on presse

*« Je veux une sorte de pastille un peu ronde avec un design sympa à
l'intérieur. Lorsqu'on appuie dessus, je veux qu'elle se mette à tourner super
vite, qu'elle dégage comme une sorte d'onde ou de petits fragments et qu'au bout
d'une demi-seconde, ça ouvre la page nouveau chantier. »*

`docs/maquettes/16-la-pastille-qui-tourne.html`. Trois habillages du même
disque, tous pressables : jeton de vert pin, sceau clair, disque nu — plus le
même jeton posé sous le pouce. La marque gravée est une **rose des vents** :
Atlas est un nom de cartes, et les quatre branches longues d'une rose dessinent
déjà un « + ». Le signe de l'ajout est dans la marque, il n'a pas eu à s'y
coller.

**C'est la première des seize qui porte un script**, et c'est assumé : une page
qui ne répond pas au doigt ne prouve rien de ce qu'elle avance. Le geste est
donc aussi démonté image par image, pour les lecteurs qui n'exécutent rien.

**Ce qui a été trouvé en regardant, et jamais par un contrôle vert :** au
premier essai, les dix éclats partaient aux bons angles, à la bonne vitesse — et
restaient invisibles, parce qu'ils pâlissaient dès leur départ. Ils gardent
maintenant leur plein jusqu'à 64 % de leur course.

`scripts/verifier-maquette-pastille.mjs` presse la pastille pour de bon, dans
les deux pages (la maquette seule et la page fusionnée) et dans les deux
réglages de mouvement. Confronté à une demi-seconde supprimée, il refuse — avec
le bon coupable dans le message.

### Un script de maquette ne pouvait ni balayer sa section, ni échouer seul

La page unique donnait aux scripts un `document` réduit à `getElementById` : la
maquette 16, qui arme ses pastilles par leur classe, y mourait sur
« querySelectorAll is not a function ». Pire, l'exception emportait les scripts
des maquettes suivantes — une page à moitié morte, sans un mot pour dire
laquelle avait fauté. La portée sait maintenant balayer sa section, et chaque
script est enfermé dans son propre essai.

### Deuxième tournée : six gestes qui, cette fois, ne se ressemblent pas

*« Je ne suis pas encore hyper convaincu. Propose-moi d'autres choses. »*

Le défaut de la première tournée est nommé dans la page elle-même : six façons
d'**amincir le bouton** ne font pas six idées, elles font une idée déclinée six
fois. `docs/maquettes/15-encore-six-gestes.html` change donc de nature à chaque
fois — l'action prend une ligne d'écriture (**G**, une ligne réglée où bat un
curseur), se pose sur la ligne de base du titre sans occuper de rang (**H**),
devient une marque d'imprimeur (**I**), descend au milieu du bandeau (**J**),
disparaît au profit d'un geste de traction (**K**), ou se range en signet sur la
tranche droite (**L**).

**Deux réserves écrites dans la maquette plutôt que tues.** J supprime la bulle
de l'assistant — c'est une décision, pas un détail. Et K, le geste caché, garde
une porte visible (un « + » au bout de la ligne « En cours ») : élégant le
premier jour, un geste invisible coûte cher le trentième, quand un remplaçant
prend le téléphone.

### La page unique acceptait tout, sauf une maquette animée

`fusionner-maquettes.mjs` refusait la maquette 14 avec « sélecteur non confiné
« 0% » » : son contrôle prenait les pourcentages d'un `@keyframes` pour des
sélecteurs. Le message accusait la maquette là où le fautif était le contrôle —
exactement ce que `AGENTS.md` interdit.

**Et un vrai défaut dormait dessous, celui-là silencieux :** un nom d'animation
est **global**. Deux maquettes déclarant chacune un `@keyframes halo` se le
seraient disputé, la dernière lue gagnant pour toute la page — le confinement
par ancêtre ne protège que des sélecteurs. Les noms sont désormais préfixés par
section (`s14-halo`), comme le sont déjà les identifiants.

Le contrôle a été confronté à l'état qu'il prétend détecter : confinement
neutralisé, il refuse la fusion sur les quatorze maquettes.
### « Impossible d'enregistrer la note » ne disait pas pourquoi — et personne ne pouvait le savoir

**Le patron, capture de son téléphone :** *« Pb sur la note vocale, corrige
ça ! »* L'écran affichait *« Impossible d'enregistrer la note pour l'instant.
Réessayez. »*

**Ce défaut-ci n'a pas été reproduit ici, et il faut le dire tel quel.** La
dictée a été rejouée dans un vrai navigateur avec un micro simulé, deux fois :
en mode développement, puis sur la **version bâtie derrière une origine
étrangère** — les conditions de son banc. Les deux fois, la note s'est
enregistrée. Ce qui a donc été corrigé n'est pas la panne : c'est **ce qui
rendait la panne impossible à nommer**.

Deux choses s'y opposaient :

1. **`catch {}` sans variable**, dans l'anneau comme dans l'écran de dictée. Le
   message du serveur n'était même pas lu. Les quatre refus possibles — aucun
   fichier, fichier trop lourd, format non pris en charge, cadence dépassée —
   portaient chacun leur phrase, et l'écran les jetait toutes pour afficher la
   même formule creuse.
2. **Une exception ne traverse pas la version bâtie.** Next.js remplace en
   production le message d'une action serveur par un identifiant opaque. L'écran
   d'import de fichier croyait bien faire en affichant `err.message` : sur le
   banc, il ne pouvait montrer qu'un digest. La documentation du cadre le dit en
   toutes lettres — *« avoid using try/catch blocks and throw errors. Instead,
   model expected errors as return values »*.

Les refus attendus sont donc désormais des **valeurs de retour**, qui traversent
la version bâtie intactes ; les pannes imprévues continuent de lever, mais le
serveur les **écrit** avant, avec le chantier, le format et la taille. Sans
cette ligne, une panne chez lui ne laissait aucune trace nulle part.

**Le refus nomme le format reçu.** Si son iPhone produit un format que la liste
blanche ignore, le message le dit — sans quoi il resterait introuvable, et il
faudrait le lui demander.

**Trouvé en chemin, et plus grave que le reste :** un enregistrement de zéro
octet n'était pas refusé. Il descendait jusqu'à la base, qui le rejetait — et ce
qui remontait à l'écran n'était plus un refus mais **la requête SQL entière,
noms de tables et identifiant d'entreprise compris**. Il est maintenant arrêté à
l'entrée, avec une phrase qui dit quoi faire.

`test-note-vocale-refus-e2e.ts` éprouve les deux, par le chemin d'import qui
emprunte la même action serveur que l'anneau et que l'écran de dictée. Confronté
à l'ancien code : deux rouges.

**La leçon, puisqu'elle se répète.** Deux diagnostics à distance avaient déjà
coûté un aller-retour chacun ce jour-là. Cette fois, rien n'a été supposé : la
dictée a été rejouée dans les conditions du banc avant d'écrire une ligne, et la
configuration soupçonnée a été vérifiée dans la documentation du cadre — elle
était juste, l'hypothèse est morte là. Ce qui reste inconnu est écrit comme
inconnu.

### « Failed to type check » sur l'espace du patron — une course, pas un défaut

**Sur son espace, ce soir :**

> Failed to type check.
> `.next/dev/types/validator.ts:116:39`
> Type error: Cannot find module `.../chantiers/[id]/photos/page.js`

Le fichier existait, et la construction passait ici depuis un état propre. Le
message accusait le code alors que rien n'était cassé — exactement ce que
`AGENTS.md` interdit de laisser passer.

**La cause :** `npm run banc` sert la version de développement — qui écrit dans
`.next/dev/` — PENDANT qu'il bâtit la version rapide dans `.next-batie/`. Le
contrôle de types lisait donc les fichiers de travail d'un autre processus, en
train d'être réécrits : selon l'instant, ils désignent une route à moitié
engendrée. D'où une panne intermittente, sur son espace seulement, sur un code
parfaitement valable.

Ces fichiers sont désormais **exclus** du contrôle de types. Les types de route
restent vérifiés, par ceux qu'engendre la construction elle-même — qui ne
bougent pas pendant qu'on les lit.

**Et la réparation ne tenait pas où on l'aurait mise :** `next build` RÉÉCRIT
`tsconfig.json` et y remet `.next/dev/types/**/*.ts` de lui-même — constaté dans
l'heure. Retirer la ligne de `include` n'aurait tenu qu'une construction. C'est
`exclude` qui répare, parce que Next n'y touche pas et qu'il l'emporte.

**Next se protège pourtant de ce cas — son filtre vise simplement le mauvais
dossier ici.** Sa fonction `runTypeCheck` écarte `<distDir>/dev/types` avant de
vérifier, en disant explicitement pourquoi : « empêcher des types de
développement périmés de faire échouer la construction ». Mais le banc bâtit
dans `.next-batie`, donc le filtre écarte `.next-batie/dev` — pendant que le
serveur de développement écrit dans `.next/dev`. Ce dossier-là passe entre les
mailles, et c'est exactement celui que l'erreur du patron désigne. Le garde-fou
existait ; il visait à côté dès qu'on bâtit ailleurs que dans `.next`.

Reproduit **dans la configuration exacte du banc**, et non dans une approchante
— `ATLAS_DIST_DIR=.next-batie npx next build`, un reste périmé posé dans
`.next/dev/types` : rouge sans les exclusions, avec le message du patron au mot
près, vert avec, le reste périmé toujours en place. La première tentative de
reproduction, faite avec le dossier par défaut, passait au vert : elle aurait
fait croire le correctif inutile.
`scripts/test-tsconfig-sans-restes-dev.ts` refuse le retour en arrière — sans
lui, la prochaine construction rouvrirait la panne en silence, et elle ne se
reverrait que chez lui.

**Et il y avait une SECONDE forme du même piège, trouvée en vérifiant la
première.** `.next/types` — les types d'une construction faite dans le dossier
par défaut — n'est jamais régénéré ici, puisque le banc bâtit dans
`.next-batie`. Il ne peut donc qu'être périmé, et il décrit alors des routes
d'avant : l'écran des photos, supprimé le soir même par une autre session, en est
l'exemple exact. La construction du banc échouait dessus, au mot près comme sur
la première forme.

Celui-là ne s'ignore pas, il s'efface : `scripts/banc.mjs` le supprime avant de
bâtir. Confronté dans les deux sens — avec le reste, la construction échoue ;
après le nettoyage, elle passe.


### Le fil se bloquait à chaque chantier, et montrait sa barre grise

**Le patron, capture de son ordinateur et de son téléphone à l'appui :** *« je
trouve que ça manque de fluidité. Quand je slide en haut ou en bas, c'est
saccadé »*, et *« quand on slide, il y a une espèce de bande déroulante grise
qui apparaît sur le côté à droite. Supprime-moi ça, je ne veux pas voir ça du
tout, je veux juste que ça slide. »*

Deux causes, sans rapport l'une avec l'autre.

**Le saccadé venait de `scroll-snap-stop: always`**, posé la veille pour qu'un
geste vif n'avance que d'un chantier. Mais `always` ne ralentit pas l'élan : il
l'ARRÊTE au premier point rencontré. Le doigt lance la liste, la liste se
bloque, et il faut recommencer à chaque chantier. Retiré. Ce qui reste —
`proximity` sur le cadre, `center` sur la ligne — suffit à la perle : l'élan
court librement et la liste se recale sur un chantier en s'arrêtant. On perd
« un geste = un chantier », on gagne un défilement qui glisse.

**Le coût de rendu a été mis hors de cause AVANT de toucher à quoi que ce
soit** — c'est le point qui compte. Trois choses se superposaient sur ce
défilement, et deux d'entre elles étaient les suspects évidents : le masque en
dégradé posé sur le cadre, et l'animation d'opacité qui joue sur chaque ligne.
`scripts/mesurer-fluidite-fil.mts` relève la durée de chaque image rendue et
sait retirer une cause à la fois dans le navigateur seulement. Verdict : les
quatre combinaisons mesurent la même chose — 60 images par seconde, médiane
16,7 ms. Les retirer aurait abîmé l'écran sans rien gagner, et c'est très
exactement le correctif imaginé que ce dépôt a déjà payé trois fois.

**Et la mesure avait raison, le patron l'a confirmé sur son téléphone le soir
même** : *« la fluidité de l'iPhone, ça aussi, ça a été corrigé. »* Ce n'était
pas acquis — le navigateur sans tête ne produit pas l'élan d'un vrai doigt, et
le masque restait un suspect crédible **sur iOS**, où un cadre masqué se
recompose à chaque image. Le point était donc laissé ouvert par honnêteté
(`TODO.md` §0 bis), et il est clos par l'appareil lui-même. Il reste écrit
plutôt que supprimé : le masque est le suspect qui vient à l'esprit dès qu'on
parle d'un défilement qui accroche sur iOS, et savoir qu'il a été **innocenté
sur le vrai téléphone** évitera à quelqu'un de le déplacer pour rien.

**La barre grise, elle, n'était pas un choix : c'était un oubli.** Les trois
autres zones qui défilent la masquent depuis toujours ; `.atlas-fil-defile`,
**la plus vue de l'application**, avait été sautée. Rien ne pouvait le dire,
puisque chaque zone porte la règle chez elle et que personne ne comptait les
zones. `test-aucune-barre-de-defilement-e2e.ts` les compte désormais sur tout le
parcours — corriger une ligne aurait réparé ce jour-là, le balayage répare la
classe entière, y compris la zone qui n'existe pas encore.

### Le devis coupait le texte du patron, et c'est le balayage qui l'a vu

Trouvé par le contrôle précédent, alors qu'il cherchait tout autre chose : une
barre grise sur une zone de texte du devis. **La barre était le symptôme ; le
défaut était que le devis cachait ce qu'on venait d'y écrire.**

Les trois zones estimaient leur hauteur, et les trois estimaient mal :
l'adresse comptait les caractères (`ceil(longueur / 34)`), la description
comptait les retours à la ligne, les conditions ne comptaient rien (`rows={2}`).
Or un texte se coupe au MOT, quand il touche le bord : deux lignes estimées en
font trois à l'écran. Mesuré sur le jeu de démonstration : 46 px affichés pour
70 px de texte. C'est le défaut même que la zone d'adresse existait pour
corriger — *« le patron lit une adresse amputée sur son propre devis »* — revenu
par une autre porte.

Les trois passent par `ZoneQuiGrandit`, qui **mesure au lieu d'estimer**.

**Et un second contrôle est né du premier, parce que le premier pouvait être
satisfait de travers** : masquer la barre de cette zone aurait rendu le balayage
vert, et la coupure silencieuse — donc pire. `test-aucun-texte-coupe-e2e.ts`
écrit un texte long pour de bon et vérifie qu'il tient dans sa boîte. On ne peut
pas le contenter en cachant quoi que ce soit. Confronté à l'ancien code : il
nomme les deux zones fautives et le nombre de pixels perdus.

### La case « + » de la pellicule ajoute une photo, au lieu de changer d'écran

**Le patron, le 11 août 2026 :** *« quand je clique sur l'encadré avec le plus
là des photos, ça me ramène encore sur cette page-là. »*

Sa case était un simple lien vers l'écran Photos. Ajouter une photo depuis la
fiche demandait donc de changer d'écran d'abord, puis d'appuyer sur un second
bouton : deux appuis et une navigation pour un geste qu'on fait cent fois par
jour, sur un chantier, avec des gants.

Elle ouvre désormais le choix « prendre une photo / choisir dans ma
bibliothèque » **sur place**, et la photo apparaît dans la pellicule sans que
l'écran bouge. Elle **reste un lien** — sans JavaScript, ou ouverte dans un
nouvel onglet, elle mène toujours à l'écran Photos, comme « Nouveau chantier »
sur l'accueil.

Le mécanisme n'a pas été recopié : les deux champs de fichier (dont l'un impose
l'appareil photo), l'ordre de fermeture de la feuille et la boucle d'envoi
vivent dans un composant partagé — **AjoutDePhotos**, depuis supprimé (voir
plus bas) — que l'écran Photos et la fiche partagent. Deux copies auraient divergé au premier correctif
(`CLAUDE.md` §3).

Sa suite — **test-ajout-photo-fiche-e2e**, supprimée avec elle — éprouvait le
PARCOURS, pas la règle :
l'appui n'ouvre pas une page, le choix s'ouvre, la photo part, elle s'affiche
sans rechargement, elle survit au rechargement, et la porte de secours reste un
lien. Confronté en rétablissant l'ancien lien : rouge, avec la phrase du patron
— « on s'est retrouvé sur .../photos ».

**Remplacée le soir même, par arbitrage du patron.** Deux sessions ont traité
cette demande en parallèle, et leurs réponses divergeaient sur l'essentiel : ici,
le « + » ouvre **notre** feuille (« prendre une photo / choisir dans ma
bibliothèque ») ; dans l'autre, il ouvre **le menu du téléphone**, celui que le
patron avait photographié — *Photothèque · Prendre une photo · Choisir les
fichiers*. Sa demande disait les deux choses : ne plus changer d'écran, **et**
« supprime-moi toutes les autres étapes ».

Les deux ne pouvaient pas coexister : le menu du système n'apparaît que si aucun
champ ne porte `capture`, et c'est précisément ce que la feuille ci-dessus
suppose. Mis devant le choix, il a tranché pour le menu du téléphone. Ce qui
disparaît donc avec cette version : le composant **AjoutDePhotos**, la feuille, le second
champ, et l'écran Photos lui-même (voir l'entrée « Ajouter une photo ne fait plus
changer de page » ci-dessus). Ce qui en a été **gardé** : son contrôle de
persistance après rechargement, repris dans `scripts/test-photos-e2e.ts`.


### La perle plongeait avant le départ, sur une liste qui défile à peine

**Le patron, le soir, après la fusion :** *« la perle reste accolée en bas au
numéro dix-huit. »* Il avait raison, et deux fois plutôt qu'une.

La descente s'étalait sur les derniers pixels de défilement — sans vérifier
qu'il y en avait autant. Sur un écran haut, ou chez un artisan qui a trois
chantiers, la liste ne défile presque plus : la plongée commençait donc **avant
le départ**, et la perle arrivait déjà tombée. Et quand la liste tenait
entièrement dans l'écran, une règle écrite exprès la collait au dernier
chantier. Mesuré : 1100 px d'écran, 77 px à défiler pour 226 px de descente,
perle 148 px sous le milieu tout en haut de la liste.

La plongée occupe désormais les derniers pixels **au plus égaux au chemin
disponible**, et une liste qui ne défile pas laisse la perle au milieu.

**La leçon vaut plus que le correctif, et elle est écrite dans le dépôt :** les
deux contrôles étaient VERTS. La suite de cas ne donnait jamais une liste au
chemin trop court ; le contrôle au navigateur ne mesurait qu'un écran de 852 px,
où la liste de démonstration a quatre fois le chemin nécessaire. Un cas manquant
ne rougit pas. Quand une règle porte sur un rapport, il faut l'éprouver des deux
côtés — le contrôle mesure maintenant deux hauteurs d'écran, et la suite a gagné
la liste courte. Confronté : l'ancienne règle rétablie fait rougir le contrôle
en nommant le défaut du soir.


### La perle du fil était tout en bas de l'écran, à demeure

**Constaté par le patron, capture de son téléphone à l'appui :** *« Lorsqu'on
est tout en haut, elle devrait être au niveau du vingt-deux, donc bien centré
sur l'écran. Et en fait là, elle se retrouve constamment tout en bas. »*

La maquette retenue le 10 août fait suivre la perle : elle se tient à
mi-hauteur, et les chantiers défilent dessous. Le portage avait gardé
l'intention PRÉCÉDENTE — la perle posée devant le premier chantier « en
attente » — alors même que `docs/INTEGRER-ORIGINE.md` §3 signalait le
changement et disait de ne pas le « corriger ». Chez le patron, le chantier en
attente est le dernier de la liste : d'où un point de couleur immuablement en
bas, qui ne désignait rien de ce qu'il regardait.

La perle est désormais **premier enfant du fil** et ne bouge plus du milieu —
sauf tout en bas. Le patron a tranché la fin de liste dans le même échange :

> « Quand on arrive au dernier, là, elle descend et elle se met en face du
> dernier jour. »

C'est la seule chose que `position: sticky` ne sache pas faire : sur les
derniers pixels, la perle doit descendre PENDANT que le contenu monte, et une
accroche ne cloue que dans un sens. Trois montages purement CSS ont été essayés
avant de le reconnaître. La descente se calcule donc — `src/lib/perle-descente.ts`,
fonction pure, sept cas de suite — et l'écran ne fait que mesurer et appliquer.
Si ce calcul ne tourne pas, la perle reste au milieu : une dégradation qui reste
juste.

Ce que cela coûte, dit franchement : le chantier dont le devis est revenu n'a
plus de point de couleur. Il garde son libellé « Correction demandée » en
bronze — c'est le compromis de la maquette, assumé pour la troisième fois.

**Un défaut mérite d'être retenu :** la descente a d'abord été calculée juste et
**pas dessinée**. `.atlas-perle` est un `span`, donc une boîte en ligne, et une
transformation ne s'applique pas à une boîte en ligne. `getComputedStyle`
renvoyait pourtant la bonne matrice. Le contrôle disait « il manque 66 px » en
désignant le calcul, qui était innocent — il distingue désormais les deux pannes
et nomme la bonne.

`scripts/capture-accueil-perle.mts` mesure la perle à quatre positions de
défilement et refuse si elle quitte le milieu ailleurs qu'au bout, si elle
désigne du vide, si le dernier jour n'est pas atteint, ou si elle ne vise pas le
même endroit dans la ligne selon l'endroit où l'on est. Confronté trois fois :
perle déplacée à 20 % → rouge ; `display: block` retiré → rouge en nommant le
CSS et non le calcul ; descente supprimée dans la fonction pure → rouge.

L'ancienne règle — celle qui posait la perle sur le chantier en attente — et sa
suite disparaissent : une règle morte qui décrit une intention abandonnée est un
piège pour la conversation suivante.

### La capsule partout — une seule forme d'action dans toute l'application

**Il a répondu « partout ».** Le bouton principal est désormais une capsule sur
les dix-sept écrans, et la variante rectangulaire n'existe plus.

**Le chemin compte autant que la décision.** Il avait posé la règle : *« montre-moi
avant de faire, plutôt que de faire pour revenir en arrière »*. La capsule a donc
été posée dans une copie de travail, photographiée **sur ses vrais écrans** —
informations, photos, note vocale, devis, facture — retirée, puis posée pour de
bon une fois sa réponse reçue. `scripts/capture-bouton-partout.mjs` fait ce
travail et resservira ; il cherche les boutons par leur COULEUR d'action, pas par
une classe, pour qu'un bouton qui l'aurait perdue disparaisse de la planche.

**Aucune variante n'est conservée.** Garder le dessin d'avant « au cas où »
aurait laissé une seconde forme d'action que plus rien n'emploie, et qu'un écran
futur aurait reprise au hasard. Deux formes dans la même application se lisent
comme un travail inachevé.

**Un effet de bord heureux :** sur l'écran d'erreur, la bulle de l'assistant
mordait sur le bouton. Une capsule centrée ne l'atteint plus.

**Et une planche jetée.** La première comparaison avant/après cadrait chaque
bouton au plus près : à tailles différentes remises à la même largeur, la
capsule y paraissait **plus grosse** que le rectangle qu'elle remplace —
l'inverse exact de la vérité. Elle serait partie ainsi si personne ne l'avait
regardée. `ARCHITECTURE.md` §64.

---

### Appliqué : la bascule et la capsule sur l'écran de création

**Il a choisi**, maquettes en main : la bascule « le trait qui glisse » et le
bouton « la capsule ». C'est en place.

Ce qu'on voit maintenant sur l'écran de création : deux mots en serif — *Je
dicterai* · *Je l'écris* — un trait d'or qui glisse de l'un à l'autre, et
**un seul bouton** dont le libellé se fond de « Créer le chantier » à « Ouvrir le
devis ». Toucher « Je l'écris » puis le bouton mène **directement à la page du
devis entier**, avec le client déjà en en-tête.

**Ce qui n'a pas changé, et qui est le point :** il n'y a toujours qu'un seul
bouton à toucher. Deux boutons à égalité obligeraient tout le monde à trancher
avant d'avoir vu le chantier, alors que neuf fois sur dix la réponse est « je
dicterai ».

**La capsule n'allège pas par son rayon mais par sa largeur.** Un bouton qui
touche les deux marges n'est contenu par rien ; celui-ci est tenu par le blanc
autour de lui. L'aplat reste plein — c'est ce qui le sépare des formes sans fond,
plus élégantes mais qui se cherchent au lieu de se trouver. **Un seul écran s'en
sert** : `PrimaryButton` est sur vingt-sept écrans, et basculer la valeur par
défaut les changerait tous sans qu'il les ait vus.

**« Entrée » suit désormais la bascule.** Tant que le devis à la main était un
lien discret, valider un champ au clavier ne devait pas y mener — on serait tombé
dedans sans l'avoir choisi. Le choix étant maintenant explicite et affiché,
l'ignorer serait l'inverse du défaut.

**Et le piège de mesure, payé une seconde fois.** Les deux libellés vivent en
même temps dans le bouton, l'un à `opacity:0` : `innerText` les rend TOUJOURS
tous les deux, donc un contrôle écrit dessus passerait au vert même sur une
bascule morte. La suite lit le style calculé, et attend la fin du fondu.
Éprouvée en sabotant : un rouge, et un seul. `ARCHITECTURE.md` §64.

---

### Le bouton, huit façons — et une décision qu'il faut savoir qu'on rouvre

**Le patron :** *« j'aime bien le premier [le trait qui glisse], par contre le
bouton je le trouve un peu trop gros, carré, pas esthétique ».*

`docs/maquettes/28-le-bouton.html`. La bascule retenue est identique sur les
huit écrans — **seul le bouton change**, sinon on ne comparerait rien.

**D'où vient la masse, puisque c'est elle qu'il faut alléger.** Le bouton pèse
par trois choses à la fois, et chacune se traite séparément : la **hauteur**
(58 px, près d'un dixième de son écran), le **remplissage** (un aplat d'un bord
à l'autre) et la **pleine largeur** (il touche les deux marges, donc rien ne le
contient). Les huit n'attaquent pas les mêmes : 1, 6 et 7 enlèvent le
remplissage ; 2 et 3 rabattent la hauteur ; 5 lâche la pleine largeur ; 4 et 8
gardent la masse et travaillent le détail.

**La réserve, dite avant qu'il choisisse.** Le rayon de 5 px n'est pas un
défaut : il a été retenu le 10 août, et `PrimaryButton.tsx` dit pourquoi — « un
rectangle presque droit se lit comme une pièce imprimée ; le même arrondi à
16 px se lit comme un bouton d'application, c'est très exactement ce dont le
patron ne voulait plus ». La proposition 8 rouvre ce point. Elle est là parce
qu'il dit aujourd'hui « trop carré » et que c'est son écran ; elle est signalée
pour qu'il sache ce qu'il rouvre, pas pour l'en dissuader.

**Et un rappel qui dépasse l'écran :** ce bouton est sur vingt-sept écrans. Le
changer ici, c'est le changer partout.

---

### Un banc d'essai pour la bascule — qu'on utilise, au lieu de la regarder

**Sa demande :** *« créez-moi une maquette en HTML dynamique que je peux tester,
voir si ça me plaît ».* Les maquettes 25 et 26 se regardent ;
`docs/maquettes/27-banc-dessai-bascule.html` s'utilise : on change de
déclinaison en haut, on **tape** dans de vrais champs, on bascule, et le bouton
**mène vraiment quelque part** — à deux écrans différents selon le choix. Sur un
téléphone, le cadre s'efface et l'écran prend toute la place : c'est ainsi qu'il
faut juger.

**Toujours aucun script, et cette page va plus loin que les précédentes.** La
navigation entre écrans se fait par `:target` — de simples ancres. Et **le
bouton est deux liens superposés** : celui qu'on lit est le seul qui reçoive le
doigt. C'est le seul endroit qui méritait un contrôle à lui : si le lien
invisible gardait ses `pointer-events`, il continuerait d'intercepter l'appui et
le bouton mènerait toujours au même écran, **en silence**, pendant que son
libellé, lui, aurait changé. Un contrôle qui se contenterait de lire le libellé
passerait au vert sur exactement ce défaut. Le nôtre appuie pour de bon et
regarde où l'on arrive — douze appuis, six déclinaisons × deux destinations,
JavaScript coupé. Sabotée, la règle rend six rouges.

**Et un défaut trouvé en regardant l'écran, comme les trois autres de ce
projet.** `.champ` est un `<label>`, donc **inline** : ses marges latérales ne
s'appliquaient pas, et sur le téléphone les libellés et les plages partaient à
ras bord pendant que le bouton, lui, était bien en retrait. Invisible sur un
écran d'ordinateur, invisible pour tout contrôle — visible sur une capture au
format de son téléphone.

---

### La bascule retenue, puis affinée — six déclinaisons

**Le patron, dans la foulée :** *« pars sur l'idée de la proposition numéro
quatre, et modifie-la pour que ce soit beaucoup plus esthétique et élégant ».*

`docs/maquettes/26-la-bascule-affinee.html`. Ce qui est acquis et ne se
rediscute plus : les deux chemins se voient, et il n'y a qu'un bouton à toucher.
Ce qui change d'une déclinaison à l'autre, c'est la façon dont le choix se
dessine — le premier essai étant le plus bavard de tous, parce que
l'appareillage (deux onglets en capitales, un filet qui saute) se voyait plus
que le choix.

**Quatre gestes font l'élégance ici, et ils valent au-delà de cet écran :**
la serif remplace les capitales (un mot en capitales est un panneau, le même en
serif est une phrase) ; le repère **glisse** au lieu de sauter ; le mot du bouton
se **fond** au lieu de clignoter, deux libellés superposés dans la même case de
grille — le bouton ne change donc jamais de largeur sous le doigt ; et l'or ne
souligne que ce qui est retenu.

**Un piège de mesure, qui a fait accuser six maquettes justes.** Le contrôle
lisait le libellé du bouton juste après le clic : pendant la première moitié
d'un fondu de 260 ms, l'ancien mot est encore au-dessus de 0,5 d'opacité, et
deux lectures identiques d'affilée y sont la NORME, pas le signe que c'est fini.
Six rouges sur un comportement correct. Le contrôle exige désormais une valeur
tenue plus longtemps que la plus longue transition — et il est devenu générique
(il cherche les blocs marqués `data-bascule`), donc une septième déclinaison
serait éprouvée sans qu'on y touche.

---

### La phrase de pied part, et les deux portes se cherchent une place

**Le patron, capture à l'appui :** *« on ne voit que création de chantier, on ne
voit pas devis à la main. Donc il faut qu'on puisse voir les deux. »* Il a
raison : le lien en capitales d'or est sous le bouton, dans la zone où l'œil ne
revient pas une fois qu'il a trouvé ce qu'il cherchait — et sur son téléphone, la
barre du navigateur mange le bas.

**Retiré, à sa demande :** « Le nom crée la fiche du client. Le reste se corrige
ensuite, sur le devis. » La ligne reste dans la page mais ne parle qu'en cas
d'erreur, et **sa place reste réservée** : sans cela, l'apparition d'un message
ferait sauter la mise en page d'une ligne sous le doigt qui vient d'appuyer.

Ce qu'elle disait reste vrai et n'est plus écrit nulle part à l'écran : c'est le
NOM qui crée la fiche client. Le jour où ce cas doit se voir, c'est sur l'écran
du devis qu'il faudra le dire — pas en remettant une phrase permanente ici.

**Proposé, et pas encore tranché :** `docs/maquettes/25-les-deux-portes.html`,
six mises en page où les deux sorties se voient ensemble — la plaque partagée, les
plaques jumelles, le diptyque, la bascule d'or, le sceau, la balance.

**La bascule bouge sans une ligne de JavaScript**, par cases radio natives. Ce
n'est pas une coquetterie : les maquettes qui engendraient leurs écrans en script
lui rendaient une page blanche, et il a dit trois fois « Je ne peux pas ouvrir
ça ». `scripts/verifier-maquette-bascule.mjs` joue donc la bascule **JavaScript
coupé**, dans le fichier seul et dans la page unique — c'est la fusion, qui
réécrit les sélecteurs pour confiner les feuilles de style, qui pourrait la
casser en silence. Le contrôle sait échouer.

---

### « Réessayer » ne pouvait pas réparer un morceau de code disparu

**Le patron, 18 h 02, deux captures de son téléphone.** L'indicateur de Next.js
marqué **(stale)**, `ChunkLoadError`, « Failed to load chunk
/_next/static/chunks/src_06hhplf._.js » — et dessous l'écran d'Atlas, « Une
erreur — Cette page n'a pas pu s'afficher », avec un seul bouton : *Réessayer*.

**Ce bouton ne pouvait pas le sauver.** `reset()` refait le rendu du même arbre
React, avec les adresses de morceaux gravées dans le code déjà chargé — celui
d'une version que le serveur ne sert plus. Il redemande le même fichier absent,
obtient le même 404, retombe sur le même écran. Autant de fois qu'on appuie.

Son espace redémarre son serveur plusieurs fois par soirée (mise à jour,
bascule du banc, veilleur), et son onglet reste ouvert des heures — dix onglets
sur la capture. Aucune suite ne pouvait le voir : elles ouvrent une page et la
referment dans la minute, sur un serveur qui ne bouge pas. **C'est la durée de
vie de son onglet qui fabrique la panne, pas le code.**

**Désormais la page se recharge toute seule**, une fois par fenêtre de cinq
minutes. La borne n'est pas un détail : recharger sur une panne qui revient
donnerait un téléphone qui tourne en rond pour toujours — la pire des pannes,
puisqu'elle n'affiche jamais rien à lire. Passé la borne, le message nomme les
**deux** causes qui tiennent encore, mise à jour en cours ou connexion coupée,
plutôt que d'en désigner une au hasard.

Et la phrase propre à l'écran (« Impossible de charger le planning… ») s'efface
sur cette panne-là : le planning n'y est pour rien, c'est la page entière qui a
vieilli.

**Au passage, deux choses qui traînaient.** Les dix `error.tsx` portaient dix
copies du même corps — elles partagent maintenant `CorpsErreur`, sans quoi neuf
écrans sur dix n'auraient jamais appris à se relever. Et la cause n'était
affichée que sur l'écran racine, alors que le patron diagnostique depuis un
téléphone : les neuf autres la taisaient. En production, elle reste tue.

Éprouvé : `scripts/test-reprise-erreur.ts` (14 contrôles purs, dont son message
exact et les cinq formulations de navigateurs — Safari compris, c'est le sien) et
`scripts/test-reprise-morceau-e2e.ts` (la panne rejouée dans un vrai navigateur,
à l'écran du patron). Les deux savent échouer : neutraliser la reconnaissance
rend 8 rouges sur 14, et fait expirer le cas navigateur sur soixante secondes —
exactement ce qu'il a vécu. `ARCHITECTURE.md` §63.

---

## 2026-08-10

### Un diagnostic qui regarde l'espace du patron, au lieu de raisonner dessus

**Deux hypothèses avancées pour expliquer son « ça ne marche pas », et les deux
fausses.** D'abord un service de transcription absent — c'était mon
environnement, pas le sien. Puis une branche différente de celle où l'on
pousse — il était bien sur `main`. Chacune lui a coûté un aller-retour pour
rien.

Le défaut n'est pas de s'être trompé : c'est d'avoir raisonné **à distance** sur
une machine qu'on ne voit pas, alors que cette machine sait tout.

`npm run diagnostiquer:espace` ne devine rien, il regarde — et il montre la
seule chose que rien d'autre ne montrait : **le commit RÉELLEMENT SERVI**. La
ligne « Version » de Réglages lit le dépôt, donc le code *récupéré* ; la version
rapide est un dossier bâti et figé. Entre les deux il peut y avoir un monde, et
c'est précisément là que se logeait le malentendu.

Il rend six lignes — branche suivie, code récupéré, **code servi**, serveur,
veilleur, issue de la dernière mise à jour — puis un verdict dans ses mots :
retard, fichiers non enregistrés, historique divergé, version bâtie périmée,
serveur muet. Et quand tout concorde, il le dit aussi, en désignant alors le
produit plutôt que l'espace.

**Éprouvé dans ses états dégradés**, pas seulement au vert : dépôt sale, version
bâtie plus ancienne que le code, tête détachée (où « HEAD » ne serait qu'un
aveu incompréhensible), dépôt distant injoignable.

### « J'ai relancé le banc, ça ne marche pas » — la version rapide ne se recompile jamais

**Le patron, le 11 août 2026 au soir.** Le code neuf était bien tiré, la ligne
Version affichait le commit neuf, et l'écran servi restait l'ancien. Il pouvait
recharger cent fois.

**La cause tient en une phrase :** `next start` sert un dossier **bâti**, figé à
la seconde de sa construction. Tirer du code sous ses pieds n'y change rien. Or
le bouton « Chercher les dernières corrections » annonçait *« rechargez la page,
l'application se recompile »* — exact en développement, **impossible** sur la
version rapide.

C'est la **troisième fois** que ce dépôt paie le même malentendu : *le produit
paraît cassé alors qu'il est simplement vieux*. Les deux premières ont donné la
ligne Version, puis ce bouton. Celle-ci donne trois issues distinctes :

| Ce qui tourne | Ce qu'on annonce | Ce qu'on fait |
|---|---|---|
| développement | « l'application se recompile » | rien — c'est vrai |
| version bâtie, veilleur présent | « elle se reconstruit, injoignable une minute » | on coupe le serveur |
| version bâtie, **sans veilleur** | « arrêtez puis rouvrez l'espace » | **rien** |

**Le troisième cas est le plus important.** Couper sans personne pour relever le
serveur reviendrait à éteindre l'application du patron pour lui livrer un
correctif — le remède serait pire que le mal, et il resterait devant un écran
mort. Le veilleur est donc interrogé par son identifiant de processus, pas par
l'existence de son fichier verrou.

La règle vit dans `src/lib/issue-mise-a-jour.ts`, en fonction pure : une
décision qui peut couper le serveur du patron doit s'éprouver sans base, sans
serveur et sans banc. `scripts/test-issue-mise-a-jour.ts` la tient en cinq
contrôles, vérifiés rouges sur l'ancien comportement.

**Vérifié aussi, et c'est ce qui a permis de trancher :** le tiroir allégé
fonctionne bel et bien, sur les quatre états réels d'un chantier — neuf, avec
dictée, avec devis généré, avec devis envoyé. Ni « Informations » ni « Prix »
n'y figurent nulle part. Ce que le patron voyait était l'ancien code.

### De l'anneau au devis, en une touche

**Le patron, le 11 août 2026, après avoir essayé six formes du déclencheur :**
*« ok, j'aime bien le un »* — l'écriture nue sous l'anneau. Puis la question qui
décidait de tout : *« si je clique dessus, j'arrive directement à la page du
devis et je ne passe pas par une page intermédiaire ? »*

Oui. Un appui sur l'anneau démarre la dictée, un second l'arrête, et
**« MON DEVIS → »** naît dessous. Il transcrit, range les informations, cherche
les prix, rédige, et dépose sur `devis-complet` — la page où il n'y a que le
devis. Aucun écran entre les deux.

**Le maillon qui manquait était la transcription.** Toute cette chaîne existait
et était éprouvée depuis le 4 août, mais elle exigeait une transcription **déjà
faite** — si bien qu'elle ne pouvait vivre que sur l'écran Transcription, à
quatre écrans de l'endroit où l'on vient de parler. `preparerDevisDepuisDictee`
la lance désormais elle-même, une seule fois, et seulement s'il y a un son à
transcrire.

**L'écriture parle en OR, contre l'usage de la charte.** L'or est la voix de ce
qu'on lit, le vert pin celle de ce qu'on fait (`design-tokens.ts`). C'est la
seule action de l'application à déroger — et c'est délibéré : en vert, elle
faisait un second centre à côté de l'anneau, deux objets à regarder là où il
n'en faut qu'un.

**Trois lignes quittent le tiroir** — Informations, Prix, Devis — à sa demande.
Elles décrivaient un travail que la chaîne fait seule. Elles sont **déplacées,
pas supprimées** : les informations se corrigent sur le devis, le prix s'y pose
ligne à ligne, et les écrans restent joignables par leur adresse. Un contrôle
l'exige, parce qu'ôter une ligne d'une liste ne doit jamais condamner une page.

**Et le bandeau du tiroir se tait quand la dictée est là.** L'étape suivante
calculée valait souvent l'une des trois lignes retirées : l'annoncer aurait
envoyé chercher une porte qu'on venait de condamner.

### Ce que l'écran a dit, et que je n'aurais pas deviné

- **Sans service de transcription raccordé, le geste s'arrête — et il le dit.**
  C'est l'état réel de l'application (`TODO.md`, décision n°1) : aucun contrat
  n'est signé. En appuyant aujourd'hui, le patron lit *« aucun prestataire de
  transcription n'est encore raccordé »*. Un contrôle tient cette phrase :
  un geste qui ne fait rien **sans rien dire** se lit comme une panne.
- **L'arrêt d'avant-chiffrage s'ouvre bien sur la fiche.** La dictée d'essai ne
  disait ni la longueur de haie ni le diamètre du tronc : Atlas demande, sans
  changer d'écran, et repart de lui-même. C'est ce qui avait été promis.
- **L'écart sous l'anneau était de 50 px au lieu de 34.** Le compteur, invisible
  mais présent, en prend seize. Mesuré, pas estimé à l'œil — et resserré à 38,
  parce que c'est ce qui rattache le geste à l'anneau plutôt que de le laisser
  flotter : le défaut connu de la forme qu'il a choisie.

### Le devis à la main s'ouvre depuis la création du chantier

**Le patron, le 11 août 2026 :** *« si je clique sur "ou rédiger le devis à la
main", ça m'ouvre la page du devis complet, avec les informations du client qui
se seront ajoutées automatiquement ? C'est bien ça ? »* — oui, et il avait
raison de le demander avant de valider : c'était précisément le point qui
pouvait rendre la porte inutile.

Le lien est posé **sous** le bouton principal, en or, discret. Ce n'est pas un
choix cosmétique : deux boutons à égalité auraient obligé tout le monde à
trancher avant même d'avoir vu le chantier, alors que neuf fois sur dix la
réponse est « je dicterai ». Ici, « Créer le chantier » reste le geste évident.

**Une seule fonction crée le chantier, deux destinations en sortent.** Le
chantier est créé d'abord — c'est ce qui permet à `devis-complet` de relire le
client rattaché. Sauter la création pour « gagner du temps » aurait produit
exactement le devis orphelin qu'il redoutait.

**Elle ne remplace pas celle du tiroir, et ce n'est pas un doublon.** Ce sont
deux *moments*, pas deux chemins : ici, « je sais déjà que je l'écrirai
moi-même » ; sur la fiche, « j'ai commencé, finalement je l'écris ». Retirer la
seconde enfermerait un chantier créé la veille dont la dictée n'a rien donné.

### Deux défauts trouvés en regardant l'écran de création, aucun par un test

- **Une mise en garde devenue fausse.** « Ces informations ne sont plus
  modifiables ensuite » : c'était vrai quand la phrase a été écrite, plus depuis
  que le devis les rend toutes éditables (`majClientDuDevisAction`). Une mise en
  garde périmée est pire qu'aucune — elle fait remplir un formulaire par crainte,
  et elle apprend à se méfier d'un écran qui dit vrai ailleurs. Elle dit
  maintenant ce qui reste vrai, et c'est utile : **c'est le nom qui crée la fiche
  client**, et sans lui le devis n'offre pas d'en rattacher un.
- **La bulle de l'assistant recouvrait cette phrase**, et `finDePage: 0` —
  aucun défilement ne l'en dégageait. Illisible en permanence, sur la moitié de
  sa largeur. Quatrième défaut de cette famille sur ce dépôt.

**Et la réserve du bas d'écran ne vaut qu'EN PAGE.** La poser aussi sur la
feuille ajoutait quatre-vingts pixels de vide pour se protéger de quelque chose
qui n'y arrive pas : la feuille est `fixed` en `z-[50]` et recouvre déjà la
bulle. Vu en mesurant les deux formes, pas en supposant que la seconde
ressemblait à la première.

**Un contrôle qui a d'abord accusé à tort**, et c'est la partie qui a demandé le
plus d'attention : sa première version lisait le texte de la page et annonçait
que le client manquait sur le devis — c'est-à-dire exactement la panne que le
patron redoutait. L'en-tête du devis est fait de champs éditables, et
`innerText` ne rend jamais la valeur d'un `<input>`. Le nom était là, sous les
yeux. Le contrôle lit désormais la valeur des champs, et il a été vérifié rouge
en cassant la destination.

### Toutes les suites mesurent enfin l'écran que le patron a dans la main

*« Fais tout ce que tu penses qu'il faut faire pour que l'application
fonctionne »*, le 11 août 2026, après avoir appris qu'il restait trente-trois
suites cadrant un écran que personne ne possède.

**Le cadre était faux, et de la pire façon : trop grand.** Les suites posaient
393 × 852 — la dalle d'un iPhone 14, pas la place qui reste une fois la barre
d'adresse installée : **390 × 664**. Cent quatre-vingt-dix pixels de bas
d'écran que le patron n'a jamais eus, et où tout tenait donc confortablement.
C'est ce qui a laissé passer, la veille, une bulle d'assistant recouvrant « ou
rédiger le devis à la main ».

**L'écran est désormais posé à UN endroit** (`e2e-browser.ts`,
`ECRAN_DU_PATRON`), comme l'est déjà le délai d'attente et pour la même raison :
quarante sites d'appel, c'est quarante corrections et trente-neuf oublis. Une
suite qui a besoin d'autre chose — le devis complet s'ouvre aussi sur un écran
d'ordinateur — passe son propre cadre, et c'est alors un choix visible.
Quarante-et-une suites et vingt-neuf scripts de capture ont perdu leur cadre
écrit à la main.

**Deux tolérances inventées sont tombées avec.** Un contrôle mesurait le
débordement contre « 400 px » sur un écran de 393 : sept pixels de marge qu'on
s'accordait à soi-même. Il mesure maintenant contre la largeur **réelle** de la
fenêtre. Un autre cadrait 393 px de large là où le vrai téléphone en fait 390.

**Résultat, et il faut le dire tel quel : aucun écran n'a bronché.** 46 suites
sur 47, l'unique rouge étant un dépassement de délai du serveur de
développement — la suite rejouée seule passe. Le cadre honnête n'a donc révélé
aucun défaut caché.

**Mais « aucune suite n'a bronché » ne veut pas dire « rien n'est recouvert »**
— seulement qu'aucun contrôle existant ne l'aurait remarqué. Un seul écran
vérifiait ce genre de chose, et pour un seul bouton. D'où la suite qui suit.

### Un contrôle qui cherche partout ce qui est caché sous le mobilier fixe

`scripts/test-rien-de-recouvert-e2e.ts` parcourt **quatorze écrans** du parcours
et, sur chacun, demande au navigateur qui répondrait au doigt au centre de
chaque lien, bouton et champ. Ce que ça attrape n'a pas d'autre moyen d'être vu :
l'élément est dans le HTML, il répond au clic programmé, **et le doigt ne
l'atteint pas**. Trois défauts réels de ce dépôt sont de cette famille, tous
trouvés à l'œil, aucun par un test.

**Écrire ce contrôle a surtout consisté à l'empêcher de mentir.** Trois versions
successives accusaient des écrans parfaitement sains :

1. un bouton sous la barre du bas n'est pas hors d'atteinte — **il suffit de
   défiler**. On amène donc chaque cible au centre avant de juger : ce qui reste
   recouvert après ce geste l'est pour de bon ;
2. l'encart « à facturer », replié au repos, garde ses liens dans la page. Le
   navigateur les dit « visibles » — ils sont seulement **rognés** par un
   `overflow: hidden`. Onze accusations pour des éléments qui n'étaient pas à
   l'écran du tout ;
3. un lien dont le centre tombe sur son propre libellé se dénonçait lui-même.

**Et il sait échouer, sur les deux défauts qu'il vise.** Le défaut du 11 août a
été reconstitué dans la fiche : il le nomme par son propre libellé et désigne le
coupable, en restant muet sur les treize autres écrans. Son garde-fou — *« la
fenêtre est-elle bien celle d'un téléphone ? »* — rougit dès qu'on lui repose
l'ancien cadre. Sans lui, cette suite serait verte d'un bout à l'autre sans rien
avoir éprouvé : c'est exactement ce qui est arrivé au contrôle de la bulle.

### L'anneau de la dictée est au centre de la fiche, dès l'arrivée

**Le patron, le 11 août 2026, devant un chantier qu'il venait de créer :**
*« pourquoi on est encore sur cette page, il manque la note vocale au
milieu »*, puis *« l'anneau qui est en plein milieu et dès qu'on arrive sur la
page, il y est en fait, qu'on ait cliqué dessus ou non. C'est ça que je veux. »*

Il avait raison, et le défaut était plus profond qu'un anneau absent. L'anneau
n'apparaissait qu'**une fois la dictée faite** — c'était un lecteur — et la
dictée arrivait en **deuxième** action, derrière les photos
(`src/lib/chantier-etat.ts`). Sur un chantier neuf, c'est-à-dire au moment précis
où l'on veut parler, le cœur du produit était donc caché derrière autre chose.

L'anneau est désormais là dès l'arrivée, au centre, **au-dessus** de l'action
principale. Sans enregistrement il devient un micro : un appui dicte, un second
arrête et enregistre, la fiche se rafraîchit sur place et il redevient le
lecteur. Même objet, deux états — jamais deux boutons, jamais un écran de plus.

**Le magnétophone est écrit une seule fois** (`magnetophone.ts`) : l'écran de
dictée savait déjà capter le son, et recopier ces trente lignes dans l'anneau,
c'était s'assurer qu'un jour l'un corrige un défaut que l'autre garde.

**Deux défauts trouvés à l'écran, aucun par un contrôle :**

- Remonter l'anneau au centre a poussé « ou rédiger le devis à la main » **sous
  la bulle de l'assistant**. Le lien existait, il était touchable, il était
  illisible. Sans note, l'anneau réservait encore la place du glissement
  « Retirer », du compteur et du tiroir « note retirée » — trois choses qui
  n'existent pas encore.
- **Et le contrôle qui aurait dû le voir mesurait un écran que personne ne
  possède.** Les suites posaient un cadre de 393 × 852 ; la hauteur utile d'un
  vrai iPhone 13, barre du navigateur déduite, est de 390 × **664**. Sur ce
  cadre trop haut, la bulle tombait 190 px plus bas et ne recouvrait rien. La
  suite emploie maintenant le descripteur d'appareil réel — et elle échoue bien
  sur la mise en page d'avant, ce que l'ancien cadre ne faisait pas.

`scripts/test-anneau-dictee-e2e.ts` tient les quatre points, avec un micro
simulé : la note enregistrée depuis l'anneau existe vraiment en base.

### La fiche chantier suit la maquette, au pixel — et rien n'est perdu au passage

**Le patron, le 11 août, deux fois de suite :** *« ça ressemble toujours pas à
la maquette »*, puis *« exactement, respecte strictement ma maquette »*.

Il avait raison une seconde fois, et pour une raison qui vaut d'être écrite :
**j'avais supposé au lieu de comparer.** Rendre sa maquette
(`maquettes/atlas-note-vocale.html`) côte à côte avec l'écran a montré en une
capture ce que trois lectures n'avaient pas vu — l'anneau portait un point là où
le sien porte trois barres, et sa maquette **ne montre aucun bouton**. Regarder
l'écran n'est pas de la finition (`CLAUDE.md` §5) ; ici c'était le seul moyen.

Ce qui change sur la fiche :

- **Le corps ne porte que l'anneau.** Le pavé vert « Ajouter des photos »
  écrasait tout et faisait de la dictée un à-côté, alors qu'elle EST le produit.
- **L'en-tête suit la maquette** : le client en serif gris **avant** le titre, la
  pastille de facturation sur la ligne de la flèche, pas de trait de fermeture.
  La pastille à côté du titre lui prenait la moitié de la largeur et cassait
  « Intervention prévue vendredi 15 août. » en quatre lignes.
  `EnTeteEcran` reçoit trois réglages **facultatifs** (`precisionPlacee`,
  `cheveu`, `actionPlacee`) : les autres écrans gardent la grammaire commune du
  10 août sans être touchés.
- **Trois barres au repos dans TOUS les états**, le carré n'apparaissant que
  pendant l'enregistrement — comme sur sa maquette.

**Alléger un écran est facile ; le faire sans l'amputer l'est moins.** Vider le
corps a fait tomber **six suites d'un coup**, toutes sur la même phrase
manquante : le bouton portait la seule indication de la marche à suivre. Ce
n'était pas du bruit — un écran qui ne dit pas où l'on va se lit comme une
application en panne. L'étape suivante est donc passée dans le bandeau du
tiroir (« Ajouter des photos → »), et la rédaction à la main dans sa liste. Deux
demandes qu'il avait faites lui-même, les 3 et 4 août, et que ce lot aurait
défaites en silence.

Un contrôle garde cette frontière (`test-anneau-dictee-e2e.ts`) : *le corps ne
porte que l'anneau, et le tiroir garde tout le reste*. Il échoue aussi bien si
l'on remet un bouton dans le corps que si l'on oublie de descendre une entrée
dans le tiroir.

### `npm run essai` accusait la base pendant qu'Atlas démarrait déjà

**Constaté chez le patron, sur son espace de travail.** Il tape `npm run essai`,
et l'écran répond :

> ⚠️ Le serveur s'est arrêté avant de répondre.
> Cause fréquente : la base de données n'est pas montée.

La base n'y était pour rien. L'espace démarre Atlas tout seul à chaque
allumage ; pendant sa construction, **le banc ne répond pas encore** — le
garde-fou d'`essai.mjs`, qui demandait « quelqu'un répond-il ? », l'a donc
laissé passer. Un second serveur est parti, a trouvé le port pris, et est mort
sur « EADDRINUSE ». Le message affiché envoyait chercher au mauvais endroit, ce
qui coûte plus cher que pas de message du tout.

`banc.mjs` prend un verrou depuis le même jour, et sa documentation le disait
déjà : **ce n'est pas le port qu'il faut regarder, c'est l'existence d'un autre
banc.** `essai.mjs` ne le prenait pas — et c'est par là que le patron est passé.
Il le prend désormais, et refuse en disant quoi faire : combien de temps
attendre, quel journal suivre, et quelle ligne attendre.

Éprouvé en reproduisant la situation : un banc tient le verrou, `npm run essai`
arrive dessus, et refuse au lieu de démarrer.

### Refaire la démonstration n'efface plus ce que l'artisan a tapé à la main

**Le patron, le 11 août au matin :** *« On avait raccordé l'agenda Google.
Pourquoi il ne l'est plus ? »* Il l'avait bien relié la veille.

La cause est dans la migration 0032, et elle est sans détour :

```sql
"entreprise_id" ... REFERENCES "entreprises"("id") ON DELETE CASCADE
```

Ses identifiants Google vivent dans une ligne rattachée à son entreprise, et le
seed fait `TRUNCATE … entreprises … CASCADE`. **Un seul `seed` a donc causé les
deux pannes de la nuit** : la session fantôme, et la perte du raccordement.

Ces identifiants ne sont pas une donnée de démonstration — il est allé les créer
chez Google et les a recopiés lui-même. Le seed les conserve désormais et les
rattache à la nouvelle entreprise.

**Mais pas l'autorisation, et c'est délibéré.** Les jetons disent « cet artisan a
donné son accord pour CETTE entreprise » ; l'entreprise disparaît, l'accord tombe
avec elle. Les conserver ferait dire à l'écran « agenda relié » pour un
consentement qui ne vaut plus. Il lui reste **un seul appui** sur « Relier mon
agenda Google », sans repasser par la console de Google.

**Et le premier correctif ne conservait rien, en silence.** La RLS est en
`FORCE` : sans `app.entreprise_id`, la lecture rendait zéro ligne sans un mot, et
le contrôle passait au vert pour cette raison exacte. Le seed pose donc le
contexte de chaque entreprise avant de lire, comme le fait `withEntreprise` — on
ne contourne pas l'isolation pour se simplifier la vie.

`scripts/test-seed-conserve-identifiants.ts`, trois contrôles, chacun vu échouer
sur son état dégradé : le défaut d'origine remis, et le remède qui mentirait en
gardant l'autorisation.

### Le banc concluait à la panne trois secondes avant que l'application réponde

**Le journal du patron, dans cet ordre :**

    ⚠ L'application n'a pas répondu après trois minutes.
      Cause la plus fréquente : la base de données n'est pas montée.
    ✓ Finished filesystem cache database compaction in 15.4s
     GET /api/health/live 200 in 1415ms

Elle répondait **la seconde d'après**, et la base allait parfaitement bien. Deux
fautes que ce dépôt s'interdit explicitement, commises dans la même ligne :
conclure au chronomètre, et **désigner le mauvais coupable**.

Le bon critère n'est pas la montre, c'est **la vie du serveur** : tant qu'il
tourne, il travaille — ici une compaction de cache lui avait pris le disque
quinze secondes. Le banc l'attend donc, avec un signe de vie toutes les trente
secondes pour que l'écran ne paraisse pas figé, et ne renonce que s'il meurt.

Et le message ne suppose plus rien : serveur mort → « regardez les lignes
ci-dessus, et nulle part ailleurs » ; serveur vivant mais muet → la commande de
diagnostic, qui, elle, va voir. Un contrôle échoue si l'accusation de la base
réapparaît.

### Un refus qui n'informe pas ne vaut guère mieux qu'une panne

Le verrou du banc disait « Atlas est DÉJÀ en train de démarrer » et rien d'autre.
Le patron s'est retrouvé devant ce refus sans savoir s'il devait attendre trente
secondes ou cinq minutes, ni si l'application était déjà ouvrable.

Le banc interroge donc l'application avant de répondre :

- **elle sert déjà** → on donne l'adresse et de quoi s'y connecter ;
- **elle se construit encore** → on dit combien de temps compter, la commande
  pour suivre, et **la ligne exacte qu'il attend** (« Version rapide en place »).

### Un orphelin d'hier soir ne condamne plus le démarrage

Un `next-server` laissé par une exécution précédente tient le port et rend
`EADDRINUSE` **avant qu'on ait rien tenté**. Le patron a dû taper `pkill` à la
main plusieurs fois cette nuit-là — ce n'est pas son travail.

Le banc regarde donc le port au démarrage, et la distinction qui compte :

- **quelque chose répond à la santé** → c'est Atlas qui sert, on n'y touche pas ;
- **le port est pris sans que rien ne réponde** → c'est un orphelin, et lui seul.
  Il est délogé, et le banc le dit en une ligne.

Éprouvé en plantant un vrai orphelin sur le port : *« Un serveur d'une exécution
précédente tenait le port 4700 : délogé. »*, puis démarrage, construction,
bascule, `/login` en 183 ms.

### Le serveur est détaché, et c'est son GROUPE qu'on tue

**Quatre fois de suite, le même `EADDRINUSE` — et la vraie cause était plus
simple que tout ce que j'avais corrigé.**

`npx next dev` est une pile d'enveloppes. Le processus qui écoute vraiment se
renomme `next-server` et **survit à la mort de son père**. Tuer l'enfant qu'on
connaît ne libère donc pas le port. Le dépôt le savait, et s'en remettait à
`pkill -f "[n]ext-server"` : on ne visait pas des processus, on visait un
**motif** — ça marchait ici, et pas chez lui.

Le serveur est désormais lancé `detached: true` : il devient chef de son propre
groupe, et `process.kill(-pid)` emporte l'enveloppe **et** le serveur, sans
dépendre d'un nom ni de la présence de `pkill`.

**Mesuré en isolant le mécanisme, hors d'Atlas, en douze lignes :**

| | port pris avant | port libéré après |
|---|---|---|
| enfant tué seul (ce que faisait le banc) | oui | **non — l'orphelin tient le port** |
| groupe tué (le correctif) | oui | **oui** |

**Et cela répare une seconde chose, que personne n'avait reliée : chaque Ctrl+C
laissait un orphelin.** Le patron en a fait plusieurs au fil de la soirée ;
chacun laissait un `next-server` accroché au port 3000, qui condamnait la
tentative suivante. Le banc transmet maintenant le signal à son groupe, à la
sortie comme sur Ctrl+C — vérifié : port libéré, aucun orphelin.

Éprouvé de bout en bout : construction, bascule, « Version rapide en place »,
zéro `EADDRINUSE`, santé en 5 ms, `/login` en 177 ms, et les sept contrôles de
session au vert sur la version bâtie.

### La bascule déloge d'abord, vérifie ensuite, et réessaie

**Le journal du patron a montré ce qu'aucun raisonnement n'avait vu.** Après
« Construction terminée », `EADDRINUSE` **immédiat** — puis le serveur de
développement qui **continue de servir** :

    ⨯ Failed to start server
    Error: listen EADDRINUSE ... 0.0.0.0:3000
    GET / 307 in 95s

Il n'était donc pas mort du tout. `serveur.kill()` ne tue que l'enveloppe `npx` ;
le processus qui écoute se renomme `next-server` et lui survit. Le dépôt le
savait — c'est écrit noir sur blanc dans `veiller.sh` depuis le 9 août — mais le
banc n'appelait `pkill` qu'**en dernier recours**, après vingt secondes, et
seulement si le port semblait encore pris. Or il ne le semblait pas : la question
posée était « la santé répond-elle ? », et un serveur qu'on vient de tuer se tait
bien avant de rendre sa socket.

Trois changements, et l'ordre compte :

1. **On déloge d'abord, sans condition.** Ce serveur est de toute façon
   condamné : il n'y a rien à épargner.
2. **On demande au port**, pas à la santé — la seule question dont la réponse
   engage `next start`.
3. **On réessaie une fois**, et une naissance ratée se voit dans les huit
   secondes. Surtout, **le banc ne meurt plus** : si la reprise échoue, il
   relance un serveur de développement au lieu de laisser le patron sans rien.
   Un banc lent reste un banc ; un banc mort coûte une soirée.

Éprouvé de bout en bout : construction, délogement, reprise du port, « Version
rapide en place », zéro `EADDRINUSE`, `/login` servi en 206 ms.

### Le remède tournait en rond — et la bascule ratait encore le port

Deux défauts, dont **le premier est le mien, introduit le soir même.**

**1. Une boucle sans fin, pire que le défaut qu'elle réparait.** Le patron a vu
défiler, indéfiniment :

    GET /login?session=perimee  307 → /api/session-perimee
    GET /api/session-perimee    303 → /login?session=perimee

Il fallait **deux** causes, et elles se cachaient l'une l'autre :

- **`__Secure-` exige l'attribut `Secure`, sinon le navigateur REFUSE.**
  Derrière le relais de son espace, tout est en HTTPS : Auth.js nomme donc son
  cookie `__Secure-authjs.session-token`. L'effacement partait sans `Secure`, la
  règle des préfixes le faisait jeter, et le fantôme survivait à chaque tour.
  **Vu à `curl`, l'en-tête paraissait parfait** — c'est le navigateur qui
  refusait, pas le serveur qui oubliait, et aucun contrôle ne regardait
  l'attribut. L'inverse est vrai aussi : poser `Secure` sur les noms sans
  préfixe les rendrait inopérants en clair, donc sur le banc local. L'attribut
  suit désormais le NOM, jamais une supposition d'environnement.
- **`/login` était soumis au contrôle du compte.** C'est ce qui transformait une
  panne en boucle : renvoyée vers l'effacement, la page de connexion y
  retournait au tour suivant. Elle en est exemptée — il n'y a rien à y protéger,
  et la connexion remplace le cookie de toute façon.

**2. « EADDRINUSE » revenait, malgré le verrou et le drapeau.** Parce que
`portRendu` posait la mauvaise question : il interrogeait `/api/health/live` et
concluait « port rendu » dès qu'il ne répondait plus. Un serveur qu'on vient de
tuer cesse de répondre **bien avant** de rendre sa socket, et un processus qui
tient le port sans servir Atlas ne répond à cette route dans aucun cas. On
demande maintenant au système, en essayant d'**écouter** dessus — la seule
question dont la réponse engage `next start`. Éprouvé dans les trois états :
port vide, port occupé, port relâché.

Deux contrôles nouveaux, chacun vu échouer sur sa panne : le parcours du fantôme
échoue s'il **repasse deux fois au même endroit** (et le message affiche le
chemin exact du patron), et chaque cookie effacé doit porter l'attribut que son
nom exige — ni plus, ni moins.

### La construction mourait en rendant la main — « setRawMode EIO », segfault

**Après un « Compiled successfully in 62s » :**

    > Build error occurred
    Error: setRawMode EIO   (errno -5, syscall 'setRawMode')
    Segmentation fault (core dumped)

La construction avait **réussi**, et elle est morte en rendant la main. Quand
son entrée est un vrai terminal, Next.js tente d'en prendre le contrôle pour
écouter les touches ; dans un espace distant ce terminal peut disparaître sous
lui — une session rechargée, un onglet fermé — et l'appel échoue en `EIO`, que
la couche native ne rattrape pas : segmentation fault, une minute de travail
perdue.

`next build` ne lit rien au clavier. Ses enfants ne reçoivent donc plus d'entrée
du tout : `isTTY` devient faux et l'opération n'est même plus tentée. La sortie
reste héritée — le patron doit voir ce qui se passe — et **Ctrl+C continue de
fonctionner**, puisqu'il passe par le groupe de processus du terminal, jamais
par l'entrée de l'enfant. Même traitement dans `essai.mjs`.

**Le mécanisme a été mesuré, pas supposé** : un enfant lancé avec l'entrée
héritée depuis un vrai terminal voit `isTTY=true` et obtient `setRawMode` ;
entrée coupée, `isTTY=false` et l'appel n'est plus possible. Puis le banc a été
joué **dans un vrai terminal** (`script -qec`) : construction menée à son terme,
aucun `setRawMode`, aucune segmentation fault, application servie en 7 ms.

### Deux bancs se tuaient l'un l'autre — « EADDRINUSE », errno -98

**Ce que le patron a lu**, après une construction pourtant réussie :

    Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
    errno: -98, syscall: 'listen'

puis, juste dessous, une SECONDE construction qui démarrait. **Deux bancs
tournaient.** Deux causes distinctes, et aucune n'était visible d'un seul
fichier — chacun était juste séparément.

**1. Le veilleur prenait la bascule pour une mort.** Quand `banc.mjs` remplace
son serveur de développement par la version bâtie, il tue le premier avant de
lancer le second. Pendant ce battement, la santé ne répond plus **et** aucun
processus `next` ne tourne — c'est-à-dire, mot pour mot, les deux conditions que
`veiller.sh` exige pour conclure « le serveur est mort ». Il lançait donc un
second banc, qui prenait le port, et le `next start` du premier mourait.

Un drapeau (`.devcontainer/bascule-en-cours.sh`) le lui dit désormais. **Il
expire au bout de trois minutes, et c'est le point qui compte le plus** : un
banc tué au mauvais moment laisserait sinon un drapeau éternel, et le veilleur —
dont l'existence répare le 404 du 9 août — ne relèverait plus jamais rien, sans
un mot. Une bascule bousculée vaut mieux qu'un veilleur muet. Un drapeau
illisible ne vaut pas non plus « ne fais rien ».

**2. Rien n'empêchait d'en lancer un second à la main.** L'espace démarre un
banc tout seul à chaque allumage ; ne voyant rien venir, le patron en a lancé un
autre. `essai.mjs` refuse ce doublon depuis le 9 août — mais en regardant le
port, ce qui ne suffit pas ici : **pendant sa construction, un banc ne répond pas
encore**. C'est l'existence d'un autre banc qu'il faut voir, pas le port.
`scripts/verrou-banc.mjs` porte un identifiant de processus, jamais un simple
drapeau : un verrou laissé par un banc tué bloquerait sinon tout démarrage
ultérieur, pour toujours.

**Éprouvé en rejouant le geste exact du patron** : veilleur en place, un banc
lancé par lui, puis un second à la main. Le second est refusé avec un message
qui dit pourquoi ; le premier va au bout de sa bascule — « Version rapide en
place », zéro `EADDRINUSE`, `/login` en 68 ms. Douze contrôles tiennent le tout,
et chacun a été vu échouer sur l'état dégradé qu'il prétend détecter.

L'un d'eux a d'ailleurs commencé par rester **vert alors que la consultation du
drapeau avait été coupée** : il cherchait `$BASCULE` n'importe où dans le
fichier, et la ligne qui *déclare* le chemin le satisfaisait. Il vise maintenant
l'appel. C'est la deuxième fois ce soir qu'un contrôle regarde une mention au
lieu d'un geste.

### L'annonce cesse d'affirmer que l'adresse est joignable

**Le terminal lui affirmait le contraire de ce qu'il voyait.** À chaque
démarrage, l'annonce écrivait « Ouvrable depuis un téléphone, **telle quelle** »
et « cette adresse est **publique** ». Le 10 août 2026, elle l'a écrit alors que
le port était PRIVÉ : GitHub servait sa page de connexion, le téléphone du
patron ne montrait rien, et le seul message à l'écran disait que tout allait
bien. Il a cherché ailleurs pendant des heures.

Ce module ne **peut pas** savoir : il faudrait interroger l'adresse depuis le
dehors, ce que seul `diagnostiquer-banc.mjs` fait. Il n'affirme donc plus rien —
il décrit la panne (« une page de connexion GITHUB au lieu d'Atlas ») et sa
sortie (onglet PORTS, trois clics). Un message qui affirme sans savoir coûte
plus cher qu'un silence : il envoie chercher partout ailleurs.

Un contrôle échoue désormais si l'une de ces deux promesses réapparaît, ou si la
sortie n'est plus indiquée.

### L'atelier dit ce qu'il est, au lieu de faire attendre en silence

**Le patron a tapé `npm run essai` dans son espace GitHub** et regardé
« toujours en compilation » pendant plus de **trois minutes** — sur
`/api/health/live`, la plus petite route du dépôt. Rien n'était cassé : c'est
l'atelier, `next dev`, qui compile chaque écran au moment où on l'ouvre, sur un
disque distant lent (le journal l'écrit lui-même : « Slow filesystem detected »).
Chaque écran suivant lui aurait coûté la même attente.

**Troisième fois que cette lenteur lui coûte une soirée** — et les deux
premières avaient précisément produit `npm run banc`, qui bâtit une fois puis
sert des écrans immédiats. Le dépôt savait, et se taisait : une commande qui
laisse prendre le mauvais chemin sans un mot vaut un défaut.

`npm run essai` annonce donc, sur un espace distant seulement, ce qu'il est et
quelle commande sert vraiment à se servir d'Atlas. Il n'interdit rien :
l'atelier reste l'outil du développement, et le rechargement à chaud n'existe
que là. En local, où la compilation prend quelques centaines de millisecondes,
il ne dit rien — un mauvais conseil coûte plus cher que le silence.

Le texte vit dans `scripts/annonce-atelier.mjs`, pas enfoui dans `essai.mjs` :
un message enfoui n'est jamais vu échouer. `test-annonce-atelier.ts` vérifie
qu'il nomme la sortie, qu'il se tait en local, et qu'`essai.mjs` l'imprime
vraiment.

### Le port du banc s'ouvre à chaque allumage, au lieu d'être seulement déclaré

**Ce que le diagnostic du patron a rapporté**, le soir même : l'application
saine de l'intérieur — `200 · text/html` sur `/login` — et, à l'adresse
publique, une page `/pf-signin?...`. **C'est GitHub qui répondait, pas Atlas.**
Le port était privé ; depuis son téléphone, non connecté à GitHub, il n'y avait
rien à voir, et rien ne le disait.

Or `devcontainer.json` déclare `visibility: "public"` depuis le 6 août. La
déclaration n'était pas fausse, elle était **inerte** : ce fichier n'est appliqué
qu'à la **création** de l'espace de travail, et le sien est plus ancien que la
ligne. C'est très exactement le piège d'`ATLAS_BANC_ESSAI` dans
`docker-compose.yml` (`src/profil-banc.ts`) — **la troisième fois** qu'une
déclaration exacte et sans effet coûte une soirée. Une déclaration ne répare pas
un espace déjà né ; seul un geste rejoué à chaque allumage le fait.

`.devcontainer/ouvrir-port.sh` publie donc le port à chaque démarrage, et **dit
ce qu'il en advient** : le taire était la moitié du défaut. Sans `gh`, ou si
`gh` refuse, le démarrage affiche la commande de secours au lieu de laisser
croire que tout va bien.

**Et le remède indiqué était introuvable.** Première version, le démarrage et le
diagnostic donnaient `gh codespace ports visibility …` — le patron l'a tapée et
a reçu **« bash: gh: command not found »**. L'image de ce conteneur,
`mcr.microsoft.com/devcontainers/typescript-node:22`, n'embarque pas `gh` ;
l'image Codespaces par défaut si, d'où la méprise. Un remède introuvable coûte
plus cher que pas de remède. Les deux messages mettent donc en avant l'onglet
**PORTS** de l'éditeur — trois clics, rien à installer — et `gh` n'est plus
qu'une mention entre parenthèses. `devcontainer.json` réclame désormais `gh`
comme fonctionnalité, pour les espaces à naître.

Le diagnostic recopiait ce remède **quatre fois** : il est écrit une seule fois,
et un contrôle échoue s'il réapparaît en double.

`scripts/test-ouvrir-port.ts` l'éprouve avec un **faux `gh`** posé devant le
vrai — l'agent n'a pas d'espace GitHub, et un contrôle qu'on ne peut pas jouer
ne prouve rien. Il vérifie la commande exacte envoyée, les deux modes de panne,
et **que `demarrer.sh` l'appelle vraiment** : un script juste que personne
n'appelle ne répare rien, ce qui est le défaut d'origine. Ce dernier contrôle a
d'ailleurs commencé par rester vert alors que l'appel avait été supprimé — il
lisait le commentaire qui le surplombe. Les commentaires sont maintenant retirés
avant de regarder ; c'est le même piège que le test de l'annonce d'adresse.

### Le correctif de la session fantôme, éprouvé — et trois défauts qu'il cachait

Le remède posé quelques heures plus tôt **fonctionnait sur le papier et pas dans
un navigateur**. Le contrôle écrit pour le tenir a trouvé, l'un après l'autre,
trois défauts qu'aucun voyant vert ne montrait.

**1. La redirection n'était pas une redirection.** Le contrôle vivait dans
`src/app/documents-legaux/page.tsx`. Or une page rend sous la frontière de
`src/app/loading.tsx` : l'enveloppe HTML est déjà partie quand la page décide.
Next.js ne peut plus émettre de 307 — il rend **200**, avec un renvoi que le
navigateur joue *en JavaScript*. Mesuré, pas supposé : `curl` recevait 23 ko de
page et `NEXT_REDIRECT;replace;/api/session-perimee` enfoui dans la charge React.
Le contrôle est donc remonté dans le layout (`GardeDocumentsLegaux`), qui précède
le premier octet. Quatre écrans vérifiés — `/`, `/documents-legaux`, `/planning`,
`/login` — rendent désormais un vrai **307**, sans une ligne de JavaScript.

**2. Le remède renvoyait vers une adresse morte.** `NextResponse.redirect` exige
une adresse absolue, fabriquée depuis `request.url` — laquelle vaut l'adresse
d'ÉCOUTE. La route répondait `location: http://0.0.0.0:3000/login`. Derrière le
relais de son espace de travail, le patron aurait atterri nulle part : le
correctif l'aurait laissé devant une page blanche, exactement comme le défaut
qu'il répare. Le `Location` est maintenant **relatif** — aucun relais ne peut
tromper un chemin que le navigateur résout contre l'adresse qu'il a ouverte.

**3. Le premier correctif déconnectait un compte parfaitement valide.**
`resoudreEntrepriseId` envoyait vers l'effacement dès qu'il ne trouvait aucune
adhésion. Or « compte disparu » et « compte sans entreprise » sont deux choses :
le second se serait reconnecté, n'aurait toujours pas d'entreprise, et serait
reparti vers l'effacement — **une boucle sans sortie**. Les deux cas sont
désormais distingués par l'existence du compte ; l'anomalie de données lève de
nouveau `AucuneEntrepriseError`, ce que `test-auth-autorisation` exigeait depuis
toujours et que le correctif avait cassé (deux contrôles au rouge).

`scripts/test-session-perimee-e2e.ts` tient les cinq points, dont un parcours
dans un **vrai navigateur, JavaScript coupé** — le seul qui distingue un 307
d'un renvoi joué après coup. Chacun a été vu échouer sur l'état dégradé qu'il
prétend détecter, et sur lui seul.

### Un nom inventé arrête désormais la livraison

`scripts/banc.mjs` lisait une variable `bati` qui **n'existait pas**. Types au
vert, lint au vert : la panne n'apparaissait qu'à l'exécution — et pas n'importe
où, **après la construction**, une fois le banc annoncé prêt. Le patron perdait
son application au moment précis où elle venait d'arriver, sur un
`ReferenceError` suivi d'un `EADDRINUSE`.

Rien ne pouvait le voir : `no-undef` est éteint par défaut sur ces fichiers, et
TypeScript — qui joue ce rôle ailleurs — ne les regarde pas. La règle est
activée pour tout le JavaScript du dépôt, avec les globales lues **sur Node
lui-même** plutôt qu'énumérées à la main : une liste écrite à la main finit
toujours par accuser à tort un `structuredClone` ou un `fetch`. Éprouvé en
remettant le défaut d'origine : `banc.mjs 'bati' is not defined` — et le défaut
avait **survécu** à la réécriture de l'annonce entre-temps, sous une autre
forme, à une autre ligne.

**Et le dossier que le banc bâtit était lu par le lint.** `.next-batie` n'est
pas couvert par `.next/**` : une fois `npm run banc` joué, `npm run lint`
recrachait **1 271 erreurs** venues de code généré. Personne ne s'en apercevait
tant qu'on ne lançait pas le banc — et un contrôle noyé ne se lit plus.

**La panne qui a tenu la soirée entière.** Le jeu de démonstration avait été
refait, l'ancien compte supprimé, et le navigateur du patron portait toujours la
session de ce fantôme — `38befa76-e564-4751-9060-69ada52e720d`. Le cookie est
signé, donc valide : l'application le laissait entrer, puis **toute écriture
était refusée**. Il a vu « aucune adhésion d'entreprise », puis un `insert` en
échec sur les documents légaux, sans que rien ne relie ces messages à leur cause
commune. Reproduit ici, sous le rôle applicatif :
`new row violates row-level security policy`.

Lui demander de vider ses cookies n'est pas une réponse : c'est lui faire
réparer notre défaut, à vingt-deux heures, sur un téléphone.

`GET /api/session-perimee` efface les cookies de session — **les deux familles
de noms**, `authjs.*` et `__Secure-` / `__Host-`, sans quoi le défaut resterait
intact précisément derrière le relais où il le rencontre — et renvoie à l'écran
de connexion. Elle ne touche à aucune donnée : c'est le navigateur qu'elle
nettoie, jamais la base. Elle est publique dans le middleware, sinon le
garde-fou renverrait vers `/login` **avant** que le cookie soit effacé, et le
fantôme survivrait au remède.

Deux endroits y mènent, parce que le fantôme mord à deux moments : `getCurrentCtx`
quand il n'y a pas d'entreprise, et l'écran des documents légaux — qui précède
toute entreprise — quand le compte lui-même n'existe plus.

Éprouvé contre **son identifiant exact** : `utilisateurExiste` répond `true` pour
le compte réel et `false` pour le fantôme ; la route rend `303` avec les cookies
expirés au 1er janvier 1970.

### Préchauffer TOUS les écrans, et ne plus mourir en basculant

Deux suites au correctif précédent, la seconde trouvée à l'essai et sérieuse.

**Ouvrir la connexion ne suffisait pas.** Chaque écran suivant coûte le même
premier appel, et le relais coupe pareil : le patron se serait connecté pour
retomber sur une page blanche à l'écran d'après — le même défaut, déplacé d'un
cran. Le banc parcourt donc **les dix-sept écrans** avec une vraie session, y
compris ceux d'un chantier, qui sont les plus lourds. Mesuré : 26 s pour les
dix-sept, et chacun s'ouvre ensuite en quelques dizaines de millisecondes.

**La bascule tuait l'application.** `next dev` n'est qu'une enveloppe : le
processus qui ÉCOUTE se renomme `next-server` et **survit à la mort de son
père**. Trois secondes d'attente ne suffisaient pas ; `next start` tombait sur
`EADDRINUSE`, le script mourait, et le patron se retrouvait sans application —
**à cause du remède**. C'est le piège du 404 du 9 août (`veiller.sh`), déplacé
d'un cran.

On attend désormais que le port soit **vraiment** rendu, on le vérifie en
interrogeant la santé, on insiste sur `next-server` s'il le faut — et si le port
ne se libère pas, **on ne bascule pas** : mieux vaut un banc lent qu'un banc mort.

Vu rouge puis vert : `EADDRINUSE` avant, `Ready in 157ms` et `200 en 0,2 s`
après.

### La page blanche, enfin : le relais coupait avant la fin de la compilation

**Mesuré, pas supposé.** `next dev` ne compile un écran qu'au **premier appel** :
la route de santé répond en 0,5 s, mais `/login` coûte **6,8 s ici** — et
**trois minutes** sur le disque du patron, son propre journal le disait depuis
le début : `GET / 307 in 3.0min`. Or le relais de GitHub abandonne au bout d'une
minute.

Il ne pouvait donc **jamais** voir cette page, quoi qu'il fasse : elle n'était
pas encore compilée quand le relais coupait. Toutes les autres pistes — session,
port, protocole, adresse — étaient des symptômes ou des erreurs de ma part.

Le banc paie donc ce coût **de l'intérieur**, où rien n'abandonne, dès que le
serveur répond : il ouvre `/login` puis `/` pour lui. Mesuré de bout en bout :

| | |
|---|---|
| `/login` compilé de l'intérieur | 13 s |
| premier appel extérieur, ensuite | **0,043 s** |
| après bascule sur la version bâtie | 0,062 s |

Quinze minutes de patience accordées au préchauffage : abandonner là rendrait
exactement la page blanche qu'on cherche à épargner. Et un échec n'empêche
rien — ce n'est qu'une avance prise.

### Servir d'abord, bâtir ensuite — la page blanche n'était qu'une attente

Le patron ouvre son adresse : page blanche, encore. Le diagnostic dit
**« Application, vue de l'intérieur : injoignable »**. Rien n'était cassé : le
banc se rebâtissait, et `scripts/banc.mjs` **bâtissait AVANT de servir**. Sur son
disque — que Next.js mesure lui-même deux cents fois trop lent — cela veut dire
des dizaines de minutes sans rien du tout.

Désormais le serveur de développement part **tout de suite**, et la construction
se fait à côté ; on ne bascule qu'une fois qu'elle a abouti. **À aucun moment il
n'y a plus rien.**

Ce que ça exigeait : **deux dossiers de construction**, sinon les deux serveurs
se marchent dessus et le remède casse ce qu'il répare. `next.config.ts` lit donc
`ATLAS_DIST_DIR` — le développement garde `.next`, la version bâtie vit dans
`.next-batie`.

**Mesuré, pas supposé** : l'application répond en **20 secondes** au lieu
d'attendre la fin de la construction ; la bascule se fait ensuite sans coupure —
`200` avant, `200` après.

**Un défaut de mon banc d'essai à moi, au passage** : Turbopack refuse un
`node_modules` en lien symbolique hors du projet. Mon premier essai a donc
échoué sur ma propre installation, pas sur le correctif — et j'ai bien failli en
tirer la mauvaise conclusion.

### `pg_dump: command not found` — j'avais supposé un outil au lieu de le vérifier

La sauvegarde que je venais d'écrire pour protéger sa base a répondu au patron
`pg_dump: command not found`. **C'est encore lui qui l'a découvert**, sur une
machine que je ne peux pas voir, un soir où il essayait déjà de sauver ses
données.

`scripts/sauvegarder-banc.mjs` fait le même travail **sans `pg_dump`** : il
n'emploie que `pg`, déjà dépendance de l'application, et écrit toutes les lignes
de toutes les tables dans un seul JSON. Le script shell garde `pg_dump` quand il
existe — meilleure fidélité — et bascule sur ce chemin sinon, en le disant.

Ce qui est sauvegardé, dit franchement : **les données, pas le schéma**. Celui-ci
vit dans `drizzle/`, versionné, et se rejoue avec `npm run db:migrate`. Ce qui ne
se retrouve nulle part ailleurs, ce sont les chantiers, les clients, et ce que
l'agent a appris.

`ATLAS_SANS_PGDUMP=1` force le repli : un chemin de secours jamais joué ne
protège de rien. Les deux chemins ont été joués sur une vraie base — 39 tables.

### Le banc se diagnostique tout seul, et déclare le protocole de son port

Suite de la soirée du 10 août. Le patron a ouvert l'adresse de son banc dans
**deux navigateurs différents, en navigation privée** — donc sans le moindre
cookie — et les deux lui ont proposé de **télécharger un fichier**. Cela tue
l'hypothèse de la session périmée : ce n'est pas son compte, c'est la réponse
elle-même qui n'est pas une page.

Deux changements, et aucun ne lui demande de taper quoi que ce soit :

- **Le protocole du port est déclaré** dans `devcontainer.json` :
  `"protocol": "http"`. Un relais réglé sur HTTPS devant un serveur qui parle
  HTTP renvoie des octets illisibles — et un navigateur devant des octets sans
  type les prend pour un fichier. C'est la cause qui colle exactement au
  symptôme, et elle se règle par déclaration plutôt que par un panneau à
  trouver sur six pouces.
- **Le démarrage lance le diagnostic tout seul**, détaché : il attend que le
  serveur réponde, puis écrit son verdict dans `/tmp/verdict-banc.txt`. Le
  bandeau de démarrage donne la seule commande à taper si l'adresse ne s'ouvre
  pas — `cat /tmp/verdict-banc.txt` — et la réponse y est **déjà** quand il la
  demande, au lieu d'attendre trente secondes de plus.

Le bloc détaché a été joué pour de vrai, serveur absent : il patiente, puis
écrit « L'APPLICATION NE RÉPOND PAS, même de l'intérieur ».

### Un diagnostic qui dit QUI ment, en une commande

`npm run diagnostiquer:banc`.

**Pourquoi.** Le patron ouvre l'adresse de son banc depuis son téléphone :
Safari affiche `about:blank` et lui propose de **télécharger un fichier**. Pas
une page blanche — un téléchargement. J'ai reproduit l'application ici, base
montée, serveur lancé : elle répond `307 → /login` puis `200 text/html`, y
compris avec les en-têtes du mandataire de GitHub. **L'application est donc hors
de cause**, et je ne pouvais pas aller plus loin : le réseau de l'agent refuse
`*.app.github.dev`.

Ce qui manquait n'était pas une idée, c'était **un fait** : la réponse exacte
que reçoit son téléphone. Ce script va la chercher **depuis l'intérieur de
l'espace de travail**, seul endroit d'où l'adresse publique est joignable, et il
en tire un verdict en français : l'application est morte, l'application renvoie
un type illisible, le port n'est pas ouvert, c'est GitHub qui répond à sa place,
le relais abîme la réponse, ou tout est en ordre.

Il suit les redirections, parce qu'un `307` n'a pas de type de contenu et que
s'arrêter là ne prouverait rien ; et il annonce l'en-tête `accept` d'un
navigateur, sinon il éprouverait un cas que personne ne vit.

**Une erreur n'est pas un type de contenu abîmé.** La première version accusait
le protocole du port devant un `403` du relais — le mauvais coupable, ce que le
dépôt interdit. Les deux cas sont désormais distingués, et le message recopie
**mot pour mot** ce que le relais a répondu.

Les six verdicts ont été joués, chacun contre l'état qu'il prétend détecter.

### Le banc d'essai envoyait le patron chercher au mauvais endroit

Deux défauts trouvés en le regardant s'en servir, le 10 août au soir, et
**aucun dans l'application** — les deux dans `scripts/essai.mjs`.

**« Ok to proceed? »** Sans dépendances installées, `npx` ne trouve pas `next`
en local et **propose de le télécharger** : *« Need to install the following
packages: next@16.3.0 »*, quand le dépôt est figé sur **16.2.12**. Le patron a
lu une question sans rapport avec ce qu'il voulait faire, et accepter aurait
fait tourner l'application sur une version que personne n'a éprouvée. Le script
vérifie donc `node_modules/next` avant tout, et sort en nommant le vrai
coupable ; `npx --no-install` en renfort, pour qu'un cas non prévu **échoue** au
lieu de poser une question.

**« L'application n'a pas répondu après trois minutes »** — alors qu'elle
arrivait. Le journal disait tout, trois lignes plus haut : **`Slow filesystem
detected. The benchmark took 20605 ms`**, deux cents fois la normale. Le serveur
avait démarré en 486 ms et compilait encore. Trois corrections :

1. **Dix minutes au lieu de trois.** Abandonner trop tôt ne coûte pas une
   attente : ça fait croire à une panne.
2. **Un signe de vie toutes les trente secondes.** Un écran figé dix minutes se
   lit comme un plantage — et on ferme alors le terminal, ce qui tue le serveur
   au moment où il aboutit.
3. **Le message n'accuse plus la base de données par défaut.** Il regarde si le
   serveur est **encore en vie**, ce qui sépare les deux cas sans rien
   supposer : s'il tourne, il dit de ne pas fermer le terminal et donne la
   commande qui répond par oui ou non ; s'il est mort, alors seulement la base
   est citée.

**Un défaut trouvé en éprouvant le correctif :** la branche « le serveur s'est
arrêté » était **inatteignable**. `serveur.on("exit")` appelait `process.exit`
sur-le-champ, si bien que le script mourait avant de pouvoir expliquer quoi que
ce soit. La sortie est désormais retenue, traitée après le diagnostic, puis
rendue telle quelle.

Les quatre chemins ont été joués : dépendances absentes, serveur mort, serveur
vivant qui ne répond pas, et démarrage normal.

### « Terminés » : un fil par mois, et facturer en trois appuis

L'écran empilait trois sortes de pavés arrondis, dont **un seul plein** : le
relevé de TVA. L'œil allait donc d'abord sur ce qu'on consulte une fois par
trimestre. « Rien à facturer » s'affichait comme un titre de section suivi de
rien — l'écran avait l'air amputé au lieu d'avoir l'air calme. Et **il ne disait
jamais combien**, alors que c'est la seule question qu'on lui pose.

Il devient un **fil par mois**, le même que la liste des chantiers : deux écrans
qui se ressemblent s'apprennent une seule fois. Des filets, aucun pavé. Les
montants tiennent une colonne et rien ne s'ajoute après eux.

**L'encart « à facturer » se pose DANS le mois**, pas à côté : le chantier du
20 août est un chantier d'août, et le sortir casserait le fil. Une pastille
bronze sur le fil porte le nombre, une ligne l'annonce en toutes lettres, et
tout cela **reste replié au repos** — l'encart appelle, il n'occupe pas. **À
zéro, il n'existe pas** : jamais de « 0 », jamais de compte bancal.

Le montant vient du devis accepté, et l'écran le dit : « Montants prévus aux
devis », **jamais « à encaisser »**.

**« Fin de chantier » devient « Créer la facture »**, sur les trois écrans qui
portaient le mot. L'ancien nom ne disait pas ce que la touche fabrique. Et
**créer n'est toujours pas envoyer** : la facture naît d'un appui, elle part
d'un autre.

**Deux défauts que seule la capture a vus.** Une ligne trop longue déborde
toujours du côté de la fin de ligne, quel que soit `text-align` : « juillet »
passait sous la pastille, qui lui mangeait sa dernière lettre. Et un montant
inconnu s'écrivait « 0,00 € » — un chantier sans devis chiffré n'attend pas zéro
euro, on ne sait pas.

`ARCHITECTURE.md` §53.

### Le planning au mois, et les équipes qui portent un nom

*« Il faut que dans le fichier réglages on puisse mettre le nom des équipes —
soit équipe A équipe B, soit des noms et prénoms. Mais s'il n'a pas d'équipe et
qu'il ne met rien, il ne faut pas qu'il y ait quand même écrit équipe A équipe
B. »*

**La règle qui en découle n'est pas cosmétique :** on n'invente jamais un nom,
et on ne laisse jamais deux lignes indiscernables. À une seule équipe, le mot
« équipe » ne s'écrit **nulle part** — ni dans le planning, ni dans une phrase
d'explication, et Réglages ne propose même pas de champ : le patron y écrirait
un prénom qui n'apparaîtrait nulle part. À deux, chaque ligne porte le sien, et
un champ vide affiche déjà en gris ce qui sera écrit à sa place.

**Le repli est un affichage, jamais une donnée.** `equipes.nom` est nullable et
sans valeur par défaut ; une seule fonction pure décide du libellé, appelée par
l'écran comme par la revalidation serveur. Deux implémentations divergeraient, et
le jour où elles divergent l'écran promet une équipe que le serveur ne connaît
pas.

**Le planning devient un mois.** Sept colonnes, aucune bordure, un chiffre en
serif et un point de 5 px dessous. **Cinq marques et non quatre** : sans
l'anneau « il reste de la place », un jour à moitié pris se lisait comme un jour
libre dès qu'il y a plusieurs équipes. Toucher un jour ouvre sa journée
directement sous le calendrier et l'amène à l'écran — posée plus bas, elle
s'ouvrait hors du champ et le patron a écrit deux fois « rien ne s'ouvre quand
je touche un jour ».

**Poser, c'est dire à la fois quand et qui** : le bouton ne s'arme qu'une fois
l'équipe choisie, et il n'y en a qu'un — « Poser · matin · Théo → ». Le serveur
revalide le créneau, parce qu'entre l'affichage et l'appui un client a pu le
prendre.

**Un aller-retour sur le compteur ne perd aucun nom.** Redescendre de trois à
deux ne supprime rien en base : remonter rend le nom écrit pour la troisième.
Effacer aurait été une perte silencieuse sur une saisie que rien ne
reconstitue.

Détail et pièges dans `ARCHITECTURE.md` §51 et §52.

### Le banc d'essai reparle : deux phrases qui avaient divergé

Depuis le 9 août au soir, la vérification du banc échouait à chaque fois sur
« l'adresse à ouvrir n'est annoncée nulle part » — **et l'adresse était
annoncée**, mot pour mot, deux lignes plus haut dans le même journal.

Il y a deux façons de démarrer le banc. `npm run essai` écrivait
« L'application répond » ; `npm run banc` — celui que l'espace de travail
démarre tout seul depuis qu'il sert une version bâtie — écrivait « Atlas
répond ». Le contrôle cherchait la première phrase dans un journal produit par
le second.

Le message accusait donc le mauvais coupable, ce qui coûte plus cher que pas de
message du tout. L'annonce vient désormais d'un seul endroit
(`scripts/annonce-adresse.mjs`), et un test **lit le script du conteneur** pour
vérifier que la phrase qu'il cherche est celle que le module écrit. En cas
d'échec, la fin du journal de démarrage est recrachée.

### L'anneau muet et la pellicule — la fiche chantier

Sur la fiche, la ligne « Note vocale · 1 min 42 » devient un **anneau** : on le
touche, la note se lit ; on le pousse vers le haut, « Retirer » se découvre.
Elle annonçait une note sans la jouer — il fallait un écran de plus pour
entendre ce que le patron venait de dire. **La chose la plus fréquente devient
le geste le plus court.** Aucun libellé visible, mais un nom accessible :
« Écouter la note vocale ».

**Le compteur suit la lecture réelle, et l'onde le volume réellement
enregistré.** La maquette n'avait qu'une horloge CSS et une onde
vraisemblable ; les recopier aurait donné un écran qui ment. Un `AnalyserNode`
mesure le signal qui sort et pilote la hauteur des barreaux par une variable
CSS — sur le conteneur, jamais barreau par barreau.

**Les photos deviennent une pellicule** dans le tiroir du bas, **case « + » en
tête** : posée à la fin, il fallait faire défiler six photos pour ajouter la
septième. La ligne « Photos · 6 photos » disparaît — elle comptait ce qui est
désormais sous les yeux.

**Et le jeu de démonstration contient enfin des fichiers.** Il déclarait des
clés de stockage sans octets derrière : la lecture était refusée, les vignettes
vides, et rien ne le disait. `seed.ts` fabrique désormais de vraies photos PNG
et une vraie note WAV — une voix de synthèse à modulation syllabique, parce
qu'un signal plat donne une onde plate.

**Cinq pièges payés, tous vus à l'œil et aucun par un contrôle** : un contexte
audio qui mesure un silence qu'il a lui-même créé ; le raccourci `animation:`
qui remet `animation-play-state` à `running` et fait battre l'onde au repos ;
un `<button>` que `display: flex` n'étire pas, d'où « Retirer » collé au bord
gauche, visible et touchable, tous voyants au vert ; `--atlas-barre` qui est une
réserve de place (68 px) et non la hauteur dessinée (49 px), d'où une bande de
pellicule affleurant sous le résumé ; et l'écran de dessous qui doit reculer,
faute de quoi le tiroir tranche l'anneau par le milieu. Détail dans
`ARCHITECTURE.md` §49.

### Le tiroir des retirés — une seule façon de supprimer, partout

*« Je veux qu'il applique ce style à tout ce qu'on peut supprimer dans
l'appli. »* Le texte glisse vers la gauche, « Retirer » se découvre, la ligne
tombe, et un tiroir la retient en bas de l'écran : « Retiré à l'instant —
Annuler ».

**Ce que ce lot déplace, et c'est le cœur du geste :** la sécurité passait par
une confirmation AVANT (« Supprimer cette photo ? »), elle passe par une
réversibilité APRÈS. Les deux panneaux disparaissent — garder les deux ferait
demander deux fois.

**Rien n'est écrit tant que le tiroir est ouvert**, et c'est la promesse dont
tout dépend. La photo et la note vocale mettent leur fichier en file de purge
*dans la même transaction* que la suppression : appeler le serveur au moment du
geste aurait rendu « Annuler » menteur — la ligne serait revenue, le fichier
non. La ligne est donc seulement masquée, et l'écriture attend la fermeture.
Trois sorties la déclenchent : le minuteur, le départ de la page, le démontage.

**Trois mécaniques deviennent une**, sur **huit** endroits — le recensement en
annonçait sept, le planning et ses trois listes manquaient à l'appel.
`CarteGlissante` disparaît ; `AnimatedRow` ne sert plus qu'aux maquettes.

**Le glissement est désormais un défilement natif**, et non un suivi du doigt
en JavaScript. Cent lignes de calcul d'élan en moins, et quatre choses en plus
qui n'existaient pas : l'inertie de la plateforme, `prefers-reduced-motion`, la
molette, et un « Retirer » atteignable au clavier.

**Un seul des huit ne prend pas le glissement, à dessein :** les photos. Une
vignette carrée dans une grille de trois n'est pas une ligne. Elle garde tout
le reste du geste et se retire depuis la visionneuse, là où on la regarde.

**Deux défauts que seule l'exécution pouvait trouver.** Sur le devis complet,
les totaux lisaient le crochet déclaré plus bas : zone morte temporelle, écran
en 500, et ni `tsc` ni `eslint` ne la voient. Et sur le planning comme sur les
tarifs, la carte entière glissait avec son fond — rectangle tiré hors de
l'écran, bordure tranchée net. Vu en capture ; le fond est maintenant porté par
l'enveloppe, qui ne bouge pas.

**Une heure perdue sur un défaut qui n'existait pas**, et la leçon est écrite :
les captures visaient `127.0.0.1`, où Next **refuse de servir ses ressources de
développement**. La page arrivait rendue par le serveur et jamais hydratée — on
cliquait dans le vide, et tout accusait le retrait. C'est `localhost` qu'il
faut viser, et le contrôle attend désormais un marqueur posé après le premier
effet, en échouant s'il n'arrive pas.

### Le corps des écrans Informations et Prix

Étape 2 de la fin de refonte (`TODO.md` §7) : les deux écrans les plus chargés
du parcours. Marges à 26 px, libellés en capitales espacées, textes de
situation à 11,5 px, plages à 4 px sans une ombre.

**Trois choses ont changé de fond, pas seulement d'allure.**

1. **L'encart teinté d'Informations disparaît.** « Proposé à partir de votre
   dictée » vivait dans une plage vert pâle qui ne désignait aucun geste à
   faire. Une couleur qui ne veut rien dire est une couleur en trop — la règle
   née de la maquette 12. La phrase reste, en texte de situation.
2. **L'or ne se pose plus que sur ce qui attend le patron** : « à confirmer »,
   « à compléter », « prix à poser », la mention « recopiée mot à mot », et le
   motif qui grise « Préparer le devis ». Ces avertissements ne sont plus des
   boîtes teintées mais un cheveu d'or à gauche — l'« ourlet » de la maquette.
   Partout ailleurs (provenance d'un prix, « Confirmé »), le gris.
3. **Le total du Prix sort de sa boîte** : capitale, montant en serif de titre,
   phrase dessous. La plage centrée le remettait *au-dessus* de la page, ce que
   le patron a écarté en retenant un écran sans cartes ni ombres.

**Deux défauts trouvés en regardant l'écran, et qu'aucune suite ne pouvait
voir** — les deux étaient là avant ce lot :

- **La croix qui retire une ligne de prix sortait de l'écran.** Une ligne du
  détail porte deux champs ; le conteneur de `AnimatedRow` refusait de
  descendre sous leur largeur intrinsèque, faute d'un `min-w-0`. Le bouton
  existait dans la page — donc les contrôles le trouvaient — mais le doigt du
  patron ne pouvait pas l'atteindre. C'était la seule façon de retirer une
  ligne.
- **La bulle de l'assistant mordait sur « Préparer le devis ».** Soixante-quatre
  pixels de talon ne suffisaient pas.

**Deux voix partagées entrent dans `design-tokens.ts`** — `libelleCaps` et
`texteSituation`. Elles étaient recopiées à la main dans chaque écran refait,
six fois les mêmes quatre valeurs ; un `0.28em` mal retapé ne se voit pas en
relecture. `smallCaps` reste, et sert désormais les seules maquettes
`/design/*`, découplées du produit.

**Ce qui n'a PAS suivi, et pourquoi :** la variante mise en avant de
« Créer le devis à partir de ma dictée » vit sur l'écran Transcription, qui
n'est pas encore refait — lui donner cette voix seule y ferait une fausse note.

**Trois contrôles réparés, dont deux rouges depuis le 10 août au matin.**
`innerText` rend le texte **tel qu'il s'affiche** : depuis que les libellés sont
en capitales, `« Prix Calculé »` et `« Déjà au détail »` ne s'y trouvent plus
tels qu'écrits dans le code. Et le compteur de l'accueil était accusé à tort —
`a[href^="/chantiers/"]` comptait aussi le lien d'une notification, qui défile
avec la liste depuis le 10 août. Aucun de ces trois n'était un défaut du
produit, et le premier réflexe — croire le contrôle — aurait coûté une heure.

### Le lien du client n'était pas cliquable

*« Le lien n'est pas cliquable, je suis obligé de le copier et de le coller
dans une page internet. »*

Le lien était bien seul sur sa ligne, mais **collé sous la phrase qui
l'annonce**. Beaucoup de messageries lisent alors les deux comme un seul
paragraphe : elles n'y reconnaissent plus une adresse, et n'en font pas un
lien. Isolé entre deux lignes vides, il redevient une adresse à leurs yeux.

Corrigé pour le devis **et** pour la facture, qui avait le même défaut sans
que personne l'ait encore vu.

**Ce qu'on ne peut pas faire mieux aujourd'hui, et pourquoi.** Le message part
par `mailto:`, qui ne transporte que du texte brut — donc pas de vrai bouton.
Le jour où Atlas enverra lui-même (`docs/A-FAIRE.md` §5), ce sera un bouton.

`scripts/test-lien-cliquable.ts` tient la règle, et **sait échouer** : remis
dans l'état d'avant, il dit « pas de ligne vide AVANT le lien ».

**Une réserve honnête** : je ne peux pas reproduire ici la messagerie du
patron. C'est le correctif standard pour le texte brut, mais c'est lui qui
dira s'il tient.

### Le devis rejoint la charte : la terre cuite s'efface

*« Oui, harmonise aussi le devis. »* La teinte terre cuite des documents, tenue
à part depuis le 3 août, disparaît. L'accent des intertitres « ÉMETTEUR » /
« CLIENT » devient **l'or**.

**Pourquoi l'or et pas le vert pin.** Le partage des rôles ne change pas : le
vert porte ce qu'on FAIT, l'or ce qu'on LIT. Sur un devis imprimé il n'y a rien
à faire — un intertitre est de la lecture pure.

**`couleursDocument` reste, alors qu'il ne diverge plus**, et ce n'est pas un
oubli : le papier et l'encre d'une pièce imprimée ne suivront pas forcément un
futur changement d'écran. Le jour où l'application passera au sombre, c'est là
qu'on empêchera le devis de partir en noir chez le client.

Le changement traverse d'un seul point : l'écran du devis, celui de la facture
et **les deux PDF** lisent tous ce jeton. Contrôles des deux PDF au vert.

### Une seule écriture pour toute l'application

*« Il faut que toutes les écritures de l'appli changent de police, on harmonise
le tout. »* La réserve laissée ouverte la veille est levée : le devis et la
facture suivent l'écran, et il n'y a plus d'exception de typographie nulle part.

**Rien à changer pour cela, et c'est le point intéressant** — vérifié plutôt
que supposé :

- les pages du client (`devis/[jeton]`, `factures/[jeton]`) et l'écran des
  documents légaux déclaraient déjà `ui-serif, Georgia, serif` en dur : la même
  pile que celle adoptée le 10 août ;
- le **PDF n'a jamais chargé Playfair ni Inter**. Il embarque Times et
  Helvetica, les polices standard du format. Il était donc déjà d'accord avec ce
  que l'écran est devenu.

Un commentaire mentait sur ce dernier point — il annonçait un héritage de
Playfair dans un fichier qui n'en a jamais vu. Corrigé : une documentation qui
décrit une version disparue est pire qu'absente.

**Ce qui ne change PAS, et qu'il ne faudra pas « corriger » :** la couleur terre
cuite des documents. Le patron l'a choisie le 3 août les deux versions sous les
yeux ; une police commune n'est pas une palette commune.

### Le plan de fin de refonte, et le corps de Note vocale

**`TODO.md` §7 existe désormais** : l'ordre des écrans restants, les valeurs
exactes de la grammaire, les sept pièges déjà rencontrés une fois chacun, et
les deux réserves — ce qui ne doit PAS suivre. Le CSS n'y est pas recopié : il
vit dans `docs/maquettes/13-le-fil-quatre-couleurs.html`, du HTML pur qui fait
foi. `PROJECT_STATE.md` dit où en est la refonte et renvoie là.

**Pourquoi ce point plutôt qu'un mot dans une conversation :** une conversation
neuve doit pouvoir reprendre le travail sur une seule ligne — « lis §7, fais
l'étape 1 » — sans rien redemander au patron. C'est la règle du dépôt
(`CLAUDE.md` §2), appliquée à ce chantier-ci.

**Étape 1 faite : le corps de Note vocale.** Marges à 26 px, prises de son en
serif 19 px avec leur situation en capitales, et les deux actions secondaires
— « Ajouter un fichier audio », « Lancer la transcription » — sorties du corps
de texte : à 14 px en graisse moyenne, elles étaient indiscernables d'une
phrase.

### La perle manquait, et le bandeau écrasait la liste

*« Il manque la perle dorée qui glisse. »* Deux causes, l'une derrière l'autre.

**La perle n'avait rien à désigner.** Le jeu de démonstration ne contenait
aucun chantier attendant un geste du patron : l'unique devis envoyé n'avait
jamais reçu de réponse. Or la perle ne se pose que sur ceux-là. Le seed fait
désormais répondre le client — une demande de correction, motivée, comme la
base l'exige (`envois_devis_correction_motivee_ck`). Une fonctionnalité qu'on
ne peut pas voir est une fonctionnalité qu'on croit cassée.

**Et le bandeau de notification écrasait la liste.** Placé dans l'en-tête, il
mangeait deux cents pixels dès qu'il apparaissait : la liste se réduisait à une
bande et la perle passait sous le bord. Les bandeaux défilent maintenant AVEC
la liste. **C'est le même défaut qu'en juillet**, à un autre endroit — et
comme en juillet, il n'était visible que sur une capture : la structure
semblait juste, et les suites étaient vertes.

Mesuré après correction : en-tête intact, liste de 463 px, et la perle qui
s'accroche — elle monte de 864 à 639 px quand la liste défile de 260.

### Les polices de l'artefact, puisque c'est ce qu'il a retenu

*« T'es sûr que t'as pas modifié la typographie ? »* Les caractères n'avaient
pas bougé — Playfair Display et Inter depuis le 3 août. Mais la maquette qu'il
a validée était une **page autonome** : elle ne pouvait charger aucune police
et empruntait donc celles de son iPhone. C'est ce dessin-là qu'il a choisi,
sans le savoir, et il l'a redemandé : *« exactement la même chose […] même
typographie ».*

L'application ne télécharge donc plus aucune police :
`ui-serif, Georgia, "Iowan Old Style", "Palatino Linotype", serif` pour les
titres, `ui-sans-serif, -apple-system, …` pour le texte — les piles exactes de
l'artefact. Mesuré sur le banc : **zéro fichier de police chargé**, contre deux
avant.

**Deux conséquences à connaître avant d'y revenir.** Plus de clignotement au
remplacement de police, l'écran s'affiche d'un coup. Mais le dessin dépend
désormais de l'appareil : Iowan Old Style sur iPhone, Georgia sur Windows, Noto
Serif sur Android — proches, jamais identiques. C'est le prix de ce qu'il a
choisi, et il est assumé.

Les titres repassent en graisse 400 : la serif du système est déjà dense, et la
forcer à 500 la fait synthétiser par le navigateur — un faux gras mou, là où la
maquette montre un trait net.

**Ce changement touche aussi le devis et la facture**, qui partagent ces deux
jetons. Signalé au patron plutôt que décidé pour lui.

### Le corps de l'écran Photos

Premier corps repris, dans l'ordre du parcours. Les marges passent à 26 px
comme partout — vingt-quatre contre vingt-six ne se voit pas seul, mais se voit
dès qu'on descend de l'en-tête à la grille. Le compte prend la voix des
libellés (« 6 PHOTOS », capitales espacées), les vignettes se resserrent de
12 px à 10, et « Passer à la note vocale » rejoint les autres actions
secondaires en capitales.

**Un manque du banc, constaté et non corrigé :** les vignettes s'affichent
cassées. Le jeu de démonstration insère des lignes de photos sans déposer les
fichiers, et `/api/fichiers/…` répond 308. Ce n'est pas la refonte — c'est le
seed. Noté ici pour que personne ne cherche du côté de l'affichage.

### Les six écrans d'étape suivent, et par un codemod plutôt qu'à la main

Photos, Note vocale, Prix, Devis, Export, Facture : les six portaient
exactement le même en-tête — flèche de retour dans son bloc, nom du chantier en
petites capitales vertes, titre à 32 px. Ils sont passés à `EnTeteEcran` d'un
seul coup, par un remplacement de motif.

**Pourquoi un codemod et pas six modifications.** Six retouches à la main, ce
sont six occasions de laisser un pixel derrière soi — et l'écart ne se voit
qu'en mettant les écrans côte à côte, ce que personne ne fait. Le motif a été
reconnu six fois et remplacé six fois par la même chose : il n'y a rien à
comparer.

Les cinq écrans ont été parcourus dans un navigateur, un par un : titre juste,
aucun débordement latéral, aucune erreur de script.

### La fiche chantier passe à la nouvelle grammaire

Le premier écran profond repris. Ce qui change tient en une idée : **la fiche
se lit maintenant comme le fil**.

- Le retour et « Fin de chantier » entrent dans l'en-tête commun. Ils vivaient
  dans un bloc séparé, à `px-6` quand l'en-tête est à `px-[26px]` : deux marges
  différentes sur le même écran, visibles dès qu'on les met côte à côte.
- « Fin de chantier » perd sa pilule pour un rectangle cerné d'un cheveu.
- Les étapes prennent la voix du fil : intitulé en serif 19 px, ligne du
  dessous en capitales espacées. C'est la même information qu'un état de
  chantier — elle doit se lire pareil, sinon l'œil réapprend à chaque écran.
- La sortie de secours « rédiger le devis à la main » passe en capitales : les
  libellés d'action secondaire ont désormais une seule voix.

### La grammaire de l'écran retenu, portée à toute l'application

*« Change le style complet de l'appli par ce style-là. »* Trois pièces
partagées font l'essentiel, et c'est délibéré : recopier une allure écran par
écran, c'est s'assurer qu'ils divergeront de nouveau au premier retouchage.

- **`PrimaryButton`** — présent sur vingt-sept écrans. Rayon de 16 px à 5,
  libellé en serif, hauteur resserrée. Un rectangle presque droit se lit comme
  une pièce imprimée ; le même arrondi à 16 px se lit comme un bouton
  d'application, et c'est ce dont le patron ne voulait plus.
- **`EnTeteEcran`** (nouveau) — surtitre en capitales d'or, titre serif 36 px,
  précision en capitales, et le cheveu qui FERME l'en-tête. Jamais de trait
  au-dessus du titre : il l'a refusé sur l'accueil, et un écran qui en porterait
  un jurerait avec les autres. Posé sur Planning, Terminés, Réglages, le relevé
  de TVA et la fiche chantier.
- **Les jetons** — `radius.card` 16 → 4, `radius.button` 20 → 5, et
  `cardShadow` vaut désormais « aucune ombre ». La constante reste plutôt que
  d'être retirée d'une soixantaine d'endroits : ce brassage aurait mêlé un
  changement d'identité à un changement mécanique, chacun masquant les erreurs
  de l'autre.

**Et un balayage :** 143 coins arrondis ramenés à 4 px dans les écrans du
patron. Deux familles en sont exclues, et ce n'est pas un oubli — les maquettes
`/design/*`, découplées du produit, et **les pages que le CLIENT reçoit**
(`devis/[jeton]`, `factures/[jeton]`). Un devis n'est pas un écran : c'est la
pièce que son client garde, imprime et signe, et elle porte sa propre teinte
depuis le 3 août.

**Ce qui reste dans l'ancienne grammaire :** l'intérieur des écrans profonds —
photos, dictée, prix, export, facture. Leur en-tête et leurs boutons ont suivi ;
leurs listes et leurs encarts non.

### L'écran des chantiers, tel qu'il l'a retenu

Après une soirée de maquettes, le patron s'est arrêté sur une version et l'a
donnée à coder. Elle est en place.

**Ce qui change, et ce que chaque changement évite :**

- **Le fil remplace les cartes.** Un trait vertical traverse la liste et porte
  les jours. Une liste de chantiers n'est pas un tableau de bord : ce qui doit
  se voir, c'est la suite des jours, pas le contenant. Quatre chantiers
  tiennent maintenant à l'écran là où il y en avait trois.
- **La perle, seul point de couleur.** Elle se colle à mi-hauteur et ne se pose
  que sur le PREMIER chantier qui attend un geste du patron. Règle de charte
  qui vaut désormais partout : *une couleur qui ne veut rien dire est une
  couleur en trop*.
- **Plus de cheveu sous ATLAS**, refusé explicitement. Seul reste celui qui
  FERME l'en-tête, au-dessus de « Nouveau chantier » — celui-là, il l'avait
  demandé.
- **Le bandeau du bas perd son aplat vert** au profit d'un trait d'or qui
  glisse d'un onglet à l'autre. Le vert plein était un second bloc de couleur
  sur un écran qui n'en veut qu'un.
- **« Nouveau chantier » monte en feuille** : la liste recule, s'assombrit, le
  formulaire arrive devant. La route `/chantiers/nouveau` reste — les suites y
  vont directement, et un lien profond doit continuer d'ouvrir un écran entier.
  Le formulaire est extrait une fois et servi aux deux endroits : deux copies
  auraient divergé au premier champ ajouté.

**Trois défauts trouvés en REGARDANT, pas en testant.**

1. **Le fil ne s'affichait pas.** Posé une seule fois sous la liste, il était
   repeint par la couche qui glisse pour découvrir la corbeille — celle-ci
   porte le fond de la page. Il est désormais dessiné ligne par ligne ; bout à
   bout, les segments n'en font qu'un.
2. **La perle n'aurait pas pu se coller.** Elle était fille d'un conteneur haut
   d'une seule ligne : `position: sticky` s'y serait arrêté au bout de 97 px.
   Un fragment à la place du conteneur la rend fille directe du fil.
3. **La feuille passait sous le bandeau et sous la bulle de l'assistant**, tous
   deux fixés au-dessus. Sa dernière ligne — celle qui prévient que les
   coordonnées ne seront plus modifiables — était cachée derrière les onglets.

**Et un piège du banc, à retenir.** `npm run banc` ne rebâtit que si le commit
a changé : tant que le travail n'est pas commité, il ressert la version
précédente. Une mesure a été prise sur du code qui n'était pas celui du disque,
et le fil « absent » l'était seulement parce qu'il n'avait jamais été bâti.
Supprimer `.next/atlas-version-batie.txt` force la reconstruction.

**Ce qui a disparu, et pourquoi ce n'est pas une perte.** La carte « Équipe »
au pied de la liste menait aux Réglages, qui sont un onglet du bandeau ; et la
cloche de l'en-tête n'avait jamais eu de comportement. Les notifications, elles,
restent affichées sous le titre.

**Éprouvé** : 99 suites base au vert, la suite bout en bout de l'accueil, et la
connexion réelle derrière une origine étrangère. Le compteur de l'accueil porte
désormais son nombre en attribut (`data-atlas="compteur"`) — un contrôle
accroché au libellé cassait à chaque refonte sans qu'aucun défaut n'existe.

---

## 2026-08-09

### Un sommaire de maquettes qui ne s'ouvrait pas, et la page unique qui le remplace

Les huit maquettes de l'écran Chantiers avaient été partagées comme huit
adresses séparées, avec un sommaire qui pointait dessus. **Le sommaire ne
s'ouvrait pas** : une page publiée s'exécute confinée et ne peut naviguer vers
aucune autre adresse. C'est le patron qui l'a découvert, en cliquant — encore
un parcours transmis sans avoir été parcouru.

`scripts/fusionner-maquettes.mjs` engendre désormais **une seule page** qui
porte les huit maquettes et un sommaire à ancres : cliquer un titre y descend,
sans jamais quitter la page. Les huit fichiers restent la source ; la page
unique est un produit qu'on régénère, donc elle ne peut pas diverger d'eux.

**Pourquoi un script et pas un copier-coller.** Les huit maquettes ont été
écrites séparément et partagent les mêmes noms de classes (`.ecran`, `.prop`,
`.nom`) et les mêmes identifiants (`#modele`, `#duo`). Concaténées, la charte
de l'une repeindrait l'autre. Chaque feuille est donc confinée sous un ancêtre
unique — `:root`, `html` et `body` deviennent `#s01` … `#s08` — et chaque
script d'origine reçoit un `document` restreint à sa section. Le code des
scripts n'a pas été réécrit : il ne peut donc pas s'écarter de l'original.

`scripts/verifier-maquettes-page-unique.mjs` **clique les huit titres** dans un
navigateur et vérifie qu'on arrive sur l'écran. Confronté à trois états
dégradés, il nomme le bon coupable à chaque fois : une ancre morte, un lien
vers l'extérieur — le défaut d'origine, précisément — et une feuille de style
qui ne s'applique plus.

### Le cheveu sous ATLAS tombe, et le fil part en quatre couleurs

Le patron garde l'écran aminci et tranche une chose : **plus de trait entre
ATLAS et « Bonjour Florian »**. Celui qui ferme l'en-tête, au-dessus de
« Nouveau chantier », reste — c'est lui qu'il avait demandé deux échanges plus
tôt. L'en-tête respire donc d'un seul tenant, du nom jusqu'à ce trait.

`scripts/engendrer-maquette-fil.mjs` écrit les douze écrans — trois formes de
liste × quatre chartes (Origine, Ivoire, Sylve, Océan) — **en HTML pur**. Le
contrôle les mesure JavaScript coupé : douze écrans, quatre fonds distincts,
aucun cheveu sous ATLAS, aucun pied hors du téléphone.

### Enlever la boîte : trois tentatives sur Origine

Le patron demande des encadrés *« plus fins, moins larges »*, et surtout de
**tenter quelque chose** pour que l'application soit moderne et unique — sur un
seul coloris.

Les encadrés passent de 16 à 26 px des bords et de 18 à 12 px de hauteur
intérieure : **quatre chantiers tiennent là où il y en avait trois**. Mais la
tentative est ailleurs. Une liste de chantiers n'est pas un tableau de bord :
ce qui doit se voir, c'est la suite des jours, pas le contenant. Les trois
variantes en enlèvent chacune un peu plus.

- **L'ourlet** — la plage devient un simple cheveu vertical, qui passe à l'or
  *uniquement* là où un geste est dû. La couleur cesse de décorer : elle
  désigne.
- **Le fil** — plus aucune boîte : un trait vertical traverse la liste et porte
  les jours, comme une tige. Une seule perle d'or s'y pose, sur le chantier qui
  attend une réponse.

Une règle en sort, qui vaudra pour tout l'écran : **une couleur qui ne veut
rien dire est une couleur en trop.**

### La vraie raison pour laquelle il ne pouvait rien ouvrir : le JavaScript

Trois fois : *« Je ne peux pas ouvrir ça. »* J'ai d'abord accusé la connexion
aux artefacts, puis la taille des écrans. C'était ni l'un ni l'autre.

**La maquette 09 s'est affichée du premier coup sur son téléphone** — il en a
renvoyé la capture. Les 06, 10 et 11, non. La seule différence entre elles :
09 est du HTML pur, les autres engendrent leurs écrans en JavaScript depuis un
gabarit cloné. Son lecteur n'exécute pas les scripts, et il recevait donc une
page vide.

La maquette 11 est réécrite **sans une ligne de script** :
`scripts/engendrer-maquette-couleurs.mjs` dépose les seize écrans en clair. La
promesse « rien ne change sauf la couleur » n'est pas abandonnée, elle change
de gardien — elle passe du navigateur au script qui écrit la page. Le contrôle
charge désormais la page **JavaScript coupé** : il reproduit ses conditions,
pas les miennes.

La leçon vaut au-delà des maquettes : trois correctifs de suite ont réparé une
panne imaginée parce que personne n'était allé chercher ce qui différait
vraiment entre le cas qui marche et celui qui échoue.

### L'écran retenu seul, et un contrôle qui accusait à tort

**Corrigé dans la foulée : la taille.** Le patron a renvoyé sa capture de la
maquette 09 — *« c'est ce modèle-là »*. Le dessin était le bon ; ce sont les
téléphones de 300 px sur une grille de quatre qui étaient illisibles sur son
écran. La maquette 11 reprend donc les mesures exactes de 09 (390 px, corps à
16 px, titre à 40 px) et lui part en **une image par coloris**, pas en
planches. Une maquette qu'il doit pincer pour lire n'a pas été montrée.

Le patron tranche entre les deux écrans : ce sera **le trait seul**. La
maquette 11 le montre dans les seize chartes, quatre par rangée — une seule
variante permet de comparer les couleurs d'un coup d'œil au lieu de faire
défiler.

Ses couleurs sont **recopiées de la maquette 10 par un script**, jamais à la
main : deux nuanciers écrits séparément finissent par diverger, et on ne sait
plus lequel fait foi.

**Un contrôle qui désignait le mauvais coupable.** La fusion refusait la
maquette 11 avec « script présent mais gabarit non préfixé », alors que tout
était préfixé — le contrôle supposait que tout gabarit s'appelle `modele`.
Il lit désormais les appels réels du script et vérifie que chaque identifiant
cherché existe, préfixé, dans le corps. Éprouvé dans les deux sens : un
identifiant absent de la liste de préfixage, et un gabarit renommé.

**Et il ne faut plus lui envoyer d'adresses.** Trois fois de suite il n'a pas
pu ouvrir un artefact. Ce qui marche, ce sont **les images** : elles
s'affichent dans la conversation, sans rien à ouvrir ni à quoi se connecter.
Les maquettes lui partent désormais en planches PNG, l'adresse seulement en
complément.

### Les deux écrans retenus, déclinés en seize chartes

Le patron valide les deux écrans de la maquette 09 et demande à les voir dans
toutes les couleurs déjà employées, plus des chartes franchement colorées :
*« tu peux même rajouter plus que trois couleurs »*.

Seize chartes, deux écrans chacune, engendrés depuis un gabarit unique — les
neuf du nuancier, plus sept nouvelles. Ces sept-là portent **cinq** teintes au
lieu de trois : la cinquième, `--e-attente`, ne colore que les états qui
réclament un geste de lui. C'est la seule couleur de l'écran qui veuille dire
quelque chose ; sans cette règle, ajouter des teintes rend l'écran bavard —
exactement le défaut qu'il reproche aux tableaux de bord.

Un contrôle mesure, pour chacun des trente-deux écrans, que la barre du bas
tient dans le téléphone. La leçon du 9 août : c'est en lisant une BOÎTE, pas
en regardant une image, qu'on avait trouvé la barre de 425 px sur 393.

### Le premier écran de « Le calme × Aman », avec deux emprunts

Le patron reprend le premier des deux écrans de la maquette 05 et demande deux
choses précises : le **pied d'Aman** (un cheveu au-dessus, l'onglet actif
souligné de bronze, plus de plage sous le texte) et le **trait qui ferme
l'en-tête**, comme dans les maquettes « colonne ».

Sa phrase ne tranchait pas si ce trait vient seul ou avec le chapeau entier de
la colonne — « En cours » et le compte sur une même ligne. Les deux sont
proposés côte à côte plutôt que d'en deviner un : `docs/maquettes/09`.

### Les maquettes redeviennent des fichiers qu'on ouvre sans se connecter

Le patron clique l'artefact : on lui demande de se connecter, il ne voit rien.
Une adresse publiée n'est pas un fichier — et un visuel qu'il ne peut pas
ouvrir n'existe pas.

Les maquettes du dépôt étaient de simples fragments : ni doctype, ni
déclaration d'encodage. Ouvertes depuis un disque ou un téléphone, leurs
accents pouvaient tomber. Ce sont désormais des **documents complets**, qu'on
lui envoie directement. La forme « fragment », nécessaire à la publication en
artefact, n'est plus qu'une sortie du script : `--fragment`.

### L'application ne pouvait pas être bâtie — donc personne ne connaissait sa vitesse

Le patron, inquiet : *« l'application là, elle est super lente. Les
utilisateurs, ils ne voudront jamais utiliser une application aussi lente. »*
Ce qu'il mesurait, c'était `next dev`, qui compile chaque écran à l'ouverture.
Mais l'affirmer sans chiffre ne valait rien — et bâtir la version optimisée
s'est révélé **impossible**.

`next build` se déclare `NODE_ENV=production` et importe chaque module ;
`src/auth.ts` lit le secret de session dès l'import. Tous les refus de
`src/server/env.ts` tombaient donc **pendant la compilation** : bâtir exigeait
une clé d'IA facturée, un compartiment S3, un secret de tâche planifiée. Ni la
CI ni le banc ne les ont, et personne n'avait donc jamais bâti Atlas.

Ces refus protègent une application qui **sert** des clients, pas un
compilateur. Ils sont suspendus pendant la construction, et pendant elle seule
(`NEXT_PHASE`) — ce que `scripts/test-env.ts` éprouve dans les deux sens :
construction acceptée sans aucun secret, exécution et démarrage du serveur bâti
toujours refusés.

**La mesure, enfin possible** : démarrage en 212 ms, écrans entre 50 et 100 ms,
et surtout la première ouverture au même prix que la deuxième. Contre 38,7 s
pour un seul écran sur son banc.

### Un serveur mort que personne ne relevait, et des écrans compilés sous ses yeux

Deux pages d'erreur coup sur coup, deux causes différentes, aucune lenteur.

**« HTTP ERROR 504 »** : `next dev` compilait `/reglages/agenda` pendant qu'il
attendait, et le mandataire de GitHub abandonnait avant la fin.

**« HTTP ERROR 404 »** : sur cette adresse, cela veut dire « plus rien
n'écoute ». Le démarrage lançait le serveur une fois et une seule ; mort, il le
restait jusqu'à ce que le patron s'en aperçoive.

Trois pièces : un **veilleur** qui relance (deux conditions avant de le faire,
sinon deux serveurs se disputeraient le port), une **garde** qui empêche une
commande tapée par erreur d'en lancer un second, et un **préchauffage** qui
compile seize écrans au démarrage — pendant que personne ne regarde.

Le préchauffage fabrique sa session directement plutôt que de se connecter : le
limiteur autorise cinq tentatives par quart d'heure et par adresse IP, et
quelques redémarrages auraient **verrouillé le patron hors de son application**.
Jamais en production.

Mesuré : à froid, seize écrans prêts en 43 s ; serveur tué, relevé en 16 s ;
écrans entre 125 et 680 ms ensuite.

### Et deux défauts trouvés en jouant le démarrage pour de bon

Un banc de simulation, volontairement resté en arrière, a servi à parcourir le
chemin exact du patron. Il a montré ce qu'aucune relecture n'avait vu :

**L'`exec` de `demarrer.sh` effaçait ses propres constats.** Le script se
relance dans sa version neuve après une mise à jour ; le second passage
recalcule tout et trouve « à jour ». Conséquence : le démarrage annonçait
« Déjà à jour » juste après avoir mis à jour, et surtout **l'avertissement
« LA BASE N'A PAS SUIVI LE CODE » ne pouvait plus jamais s'afficher** — il ne
se déclenche qu'après une mise à jour. Le correctif du matin même était
mort-né.

**Le préchauffage prenait « le compte le plus ancien ».** Sur une base ayant
servi aux tests, ce n'est pas celui du banc : 2 écrans compilés sur 11, et un
bilan qui disait « 9 en échec » sans dire pourquoi. Le compte est choisi
nommément, et l'obstacle est nommé.

Le contrôle du premier point a d'abord été un **faux vert** : écrit avec
`indexOf`, il trouvait la ligne mise en commentaire. Corrigé, puis éprouvé
rouge sur les deux moitiés.

### Et la cause première du 404, trouvée en dernier

`npx next dev` n'est qu'une pile d'enveloppes : le processus qui écoute
vraiment se **renomme** `next-server`. Le `pkill -f "next dev"` du démarrage —
présent depuis le début — tuait donc les enveloppes et laissait le vrai serveur
orphelin, **accroché au port 3000**. Le suivant ne pouvait plus s'y attacher, et
l'orphelin servait un cache périmé : toutes les pages en 404, y compris la
santé, ce qui rendait le diagnostic incompréhensible.

Trouvée en regardant les processus de la machine, et reproduite sans le vouloir
en éprouvant le veilleur.

Le veilleur traite en outre le cas qu'il ne voyait pas : un serveur **présent
mais muet**, que `pgrep` trouvait — donc aucune relance, et une boucle qui
tournait pour rien. Il est maintenant délogé après deux tours.

### Une page d'état, parce qu'il travaille au téléphone

*« Va regarder toi-même, je peux pas te l'envoyer. »* Trois minutes devant un
écran qui ne s'ouvre pas, et la seule chose capable de dire pourquoi était un
terminal qu'il ne pouvait pas photographier. Je n'ai aucun accès à son espace :
l'information devait venir à lui.

`/api/health/banc` s'ouvre sans se connecter, en quelques millisecondes, et dit
la version exécutée, où en est le préchauffage, et ce qui bloque. En HTML et non
en JSON — sur un téléphone, du JSON se lit sur une ligne minuscule. Sans aucune
requête en base : elle sert quand tout est mort.

En l'éprouvant, deux défauts de plus. **PostgreSQL était arrêté** et le
démarrage annonçait « Préchauffage impossible : pas de session » — ce qui
envoyait chercher du côté des comptes, alors que la base ne répondait pas et
qu'aucun écran ne pouvait fonctionner. Et la page écrivait `**…**` en croyant
faire du gras : le patron aurait lu des astérisques. Les deux sont corrigés, et
tenus par des contrôles éprouvés rouges.

### Le retour de Google renvoyait le téléphone vers le téléphone

Trouvé pendant qu'il autorisait Atlas chez Google — donc après avoir franchi
tout le difficile. Le retour construisait son adresse depuis `NEXTAUTH_URL`,
`ATLAS_URL_PUBLIQUE`, puis `http://localhost:3000`. **Aucune de ces variables
n'est posée sur le banc** : le navigateur du téléphone était renvoyé vers
lui-même.

Le pire n'était pas la page morte : **le raccordement aboutissait**. Les jetons
étaient enregistrés, l'agenda relié pour de bon — et rien ne le lui disait. Il
aurait conclu à un échec devant une réussite.

L'adresse vient désormais de ce que le navigateur a demandé
(`x-forwarded-host`), les variables ne servant plus que de secours. Même famille
de défaut que l'origine des actions serveur : une valeur devinée côté serveur là
où seule la requête fait foi.

### Le banc cesse d'être un atelier : il sert une version bâtie

*« On arrête de tourner en rond, corrige-moi ça une bonne fois pour toutes. »*
Il avait raison : les 504, les 404, les 502, les ports en conflit et les 38,7
secondes par écran avaient **tous la même cause** — le banc faisait tourner
`next dev`, qui ne compile rien d'avance.

Mesuré sur la version bâtie : **36 à 80 ms par écran, au premier accès**, contre
38,7 s. Plus rien ne se compile à l'ouverture.

Ce qui l'empêchait : `next start` impose `NODE_ENV=production`, et la
configuration refuse alors l'IA simulée et le stockage local — les deux seules
choses qu'un banc ne peut pas avoir. D'où un profil **déclaré, jamais deviné**
(`ATLAS_PROFIL=banc`), qui relâche exactement ces deux points. AUTH_SECRET,
CRON_SECRET, Redis restent exigés ; l'isolation entre entreprises ne bouge pas
d'un cran. La suite éprouve les deux sens, y compris les valeurs approchantes.

**Un défaut trouvé par le seul contrôle capable de le voir** : en production,
Auth.js refuse l'hôte transmis par un mandataire (`UntrustedHost`) et l'artisan
lit « Une erreur ». Même famille que « Invalid Server Actions request. ».
`verifier:connexion` monte désormais `npm run banc` — la version bâtie — au lieu
du serveur de développement : éprouver autre chose que ce qu'on livre, c'est ne
rien éprouver.

### Le lancement passait en dernier — donc il ne passait pas

Le journal du patron s'arrêtait net sur « migrations : faites », et
`localhost:3000` ne répondait rien. L'application n'était ni lente ni cassée :
**elle n'avait jamais été lancée.** Deux heures de pages blanches, de 502 et de
404 — et j'ai cherché du côté du mandataire, du port, du navigateur, partout
sauf au bon endroit.

`demarrer.sh` mettait à jour, installait, migrait, se relançait, **puis**
lançait le serveur. Joué par `postStartCommand`, que l'environnement peut
interrompre : le lancement venant en dernier, il ne survivait pas.

Le veilleur est désormais posé **en premier**. Le serveur monte avec le code du
disque, et n'est remplacé qu'une fois la mise à jour terminée. Éprouvé en tuant
le démarrage à cinq secondes : le serveur est debout vingt-six secondes plus
tard, en version bâtie.

### L'écran Chantiers refait d'après sa maquette

Le patron envoie une capture d'un écran redessiné et demande une reproduction,
pas une interprétation. La charte gagne un **second accent, l'or**, avec un
partage clair : le vert pin porte ce qu'on FAIT, l'or ce qu'on LIT — et, sur les
cartes, l'or signale les états qui attendent un geste de lui.

Tout s'est joué sur des chiffres : filets d'1 px, accents de bord de 2 px,
rayons ramenés de 22 à 14 px, ombres de 6 % à 4 %, cartes de 150 px à 94 px.
Le sceau et la branche sont dessinés au trait — aucune image, aucune dépendance.

**Un défaut qu'aucune capture ne montrait :** la branche débordait à droite et
élargissait le document — la barre basse mesurait 425 px sur un écran de 393, et
la page glissait latéralement. Trouvé en demandant au navigateur la BOÎTE de la
barre. Le script de capture l'imprime désormais à chaque passage.


### Une base restée en arrière, et rien pour le dire

Le patron met à jour son banc, lit « Mise à jour récupérée », ouvre le
Planning — l'écran tombe. Rien ne relie les deux.

**La cause était là depuis le début.** Les migrations du banc tournaient sous
`atlas_app`, le rôle applicatif, qui n'a délibérément aucun droit de créer une
table. Elles échouaient donc à chaque fois sur « permission denied for schema
public »… **et l'échec était avalé aux deux endroits qui les lancent**. Le code
neuf arrivait, la base restait vieille, et l'écran annonçait un succès.

La règle était pourtant écrite noir sur blanc dans `CLAUDE.md` §5, pour les
essais locaux. Le banc ne la suivait pas.

Désormais : un seul script, le rôle propriétaire, et **l'échec se voit** — au
démarrage de l'espace comme sur l'écran de mise à jour, qui écrit maintenant
« LA BASE N'A PAS SUIVI » plutôt que « récupérée ».

**Le message a dû être repris deux fois.** Le premier jet rendait
« échec : routine: 'aclcheck_error' » — le nom d'une fonction interne de
PostgreSQL, qui envoie chercher n'importe où. La vraie phrase se trouvait douze
lignes plus haut : c'est la première ligne parlante qu'il faut, pas la dernière.

Et un contrôle existant est passé au rouge en chemin, sans qu'aucune régression
n'ait eu lieu : il repérait la migration par une chaîne que le correctif
supprime. C'est le bon comportement — un repère qui disparaît doit faire du
bruit.


### L'agenda dit AUSSI ce qu'il y a, et les identifiants se collent dans l'appli

*« Si, il doit lire les intitulés aussi ! »* et *« dans planning il faut un
petit bouton connecter son agenda Google cliquable pour rentrer ses
identifiants. »*

**Les intitulés.** J'avais restreint la permission aux seuls créneaux occupés,
en me disant qu'une permission qu'on ne demande pas est une fuite qui ne peut
pas arriver. Le raisonnement tenait, mais il répondait à une question que
personne n'avait posée : une case grise apprend qu'on est pris, pas *pourquoi*
— et c'est ce pourquoi qui sert à décider. Le planning affiche désormais
« Élagage chez Mme Roux » et « Dentiste », avec leurs horaires.

**Ce qui n'a pas bougé, et qui ne bougera pas :** le client ne reçoit que des
dates. Ce n'est pas votre vie privée qui est en cause là, c'est celle de vos
autres clients.

**Les identifiants.** Ils s'attendaient jusqu'ici dans la configuration du
serveur — autrement dit, vous faisiez votre part chez Google et restiez bloqué
faute de pouvoir les poser. Trois cases dans l'écran « Mon agenda », et vous
n'avez plus besoin de personne. Le secret est masqué à la frappe, chiffré en
base, et vous pouvez le laisser vide pour corriger une adresse : Google ne le
remontre jamais, exiger de le ressaisir serait une impasse.

**Et le bouton est dans le Planning**, là où le manque se constate — pas au fond
des réglages. Il disparaît quand tout va bien : un bandeau permanent sur
l'écran le plus consulté devient du décor, et le jour où il annonce une panne,
personne ne le lit.


### La note vocale comprend un numéro sans qu'on l'annonce

*« Lorsque je remplis avec la note vocale, si je ne dis pas "numéro de téléphone
0670…", il ne comprend pas que c'est un numéro de téléphone. Pareil pour le
mail. Il faut qu'il capte même si je ne précise pas. »*

**Le défaut n'était pas là où il semblait.** L'annonce n'a jamais été exigée : le
vrai problème est que le service de transcription écrit parfois les chiffres
**en toutes lettres** — « zéro six douze trente-quatre cinquante-six
soixante-dix-huit » — et qu'aucune recherche de chiffres ne pouvait y voir un
numéro. Quand il annonçait, le modèle de langue rattrapait ; sans l'annonce,
plus rien ne rattrapait. Les mots-nombres sont maintenant rendus en chiffres
avant toute reconnaissance, quelle que soit la façon dont la transcription
découpe — avec traits d'union ou sans.

**Et deux défauts trouvés en cherchant le sien, tous deux du même genre : un
champ faux mais crédible, que personne ne relit.**

« 0033 6 12 34 56 78 » donnait **0336123456** — dix chiffres, l'air d'un numéro,
et pas celui du client. Le devis serait parti chez quelqu'un d'autre. Et
« florian tiret martins arobase gmail point com » donnait
**martins@gmail.com** : le prénom disparaissait en silence. Le tiret et le
souligné dictés sont désormais reconnus, sous leurs différents noms.

Un champ vide se voit et se corrige. Un champ faux et vraisemblable part avec le
devis.


### Relier son agenda Google, ou non — au choix de chaque artisan

*« Ce qui serait bien, c'est que l'utilisateur puisse, s'il le souhaite ou non,
connecter son planning à son agenda Google. »*

Jusqu'ici, Atlas ne connaissait que les chantiers qu'on lui avait dits. Un
rendez-vous noté ailleurs était **invisible** : il proposait ce jour-là, le
client le choisissait, et le doublon se découvrait le matin même — devis parti,
date acceptée, promesse faite. C'était le seul endroit du parcours où Atlas
engageait quelqu'un sur une information qu'il n'avait pas ; partout ailleurs,
quand il ne sait pas, il s'arrête et demande.

Un écran « Mon agenda » apparaît dans les réglages. **Celui qui ne relie rien
garde exactement l'Atlas d'avant** : pas de compte à créer, pas d'appel réseau,
rien qui change. C'est la moitié de la demande, et c'est la moitié qui se
respecte dans le code plutôt que dans une intention.

Ce qu'Atlas lit, quand un agenda est relié : **les créneaux occupés, et rien
d'autre**. Jamais le titre d'un rendez-vous, jamais les participants — la
permission demandée à Google ne le permet même pas, ce qui vaut mieux qu'une
promesse. Rien n'est stocké non plus : Atlas interroge au moment où il en a
besoin. Les jetons, eux, sont chiffrés en base et ne partent pas dans l'export
téléchargeable.

Et **la panne se voit**. Si la lecture cesse de fonctionner — accès révoqué,
quota —, Atlas revient à son comportement d'avant sans interrompre le parcours,
mais l'écran le dit. Un raccordement mort en silence est pire que pas de
raccordement : on se croit protégé du doublon et on ne l'est plus.

**Il manque une chose, et elle ne dépend pas de moi** : les identifiants Google
de l'application, qui se créent depuis un compte Google et engagent
l'acceptation de conditions. Tant qu'ils n'existent pas, l'écran l'annonce et ne
propose aucun bouton qui mènerait à une erreur (`docs/A-FAIRE.md` §7).

**Deux défauts trouvés en regardant l'écran, pas en lisant un test vert.** Un
module de Server Actions ne peut exporter que des fonctions : y avoir ajouté une
constante a fait perdre au fichier *tous* ses exports, types et lint verts. Et
le titre de l'écran annonçait « Atlas tient compte de votre agenda » trois
lignes au-dessus de « Atlas n'arrive plus à lire votre agenda » — le cas de
panne était traité après le cas nominal. Le titre est désormais une fonction
pure, et l'ordre des cas est tenu par un contrôle.


### Un vrai devis dément une définition écrite la veille — et le budget se mesure

Deux documents de plus du même confrère, une facture de débroussaillage et un
devis de frêne. Ils corrigent Atlas sur trois points, et **le premier est une
erreur que j'avais introduite la veille** : le vocabulaire affirmait que le gros
bois se débite « en 40 ou 50 cm ». Le devis du frêne dit **33**. Deux exemples
avaient suffi à me faire écrire une liste fermée — c'est exactement ce que le
dépôt s'interdit. Il n'y a pas de valeur par défaut, et la définition le dit
maintenant.

Les deux autres apports viennent des documents eux-mêmes : le bois a une
**destination** (« ramené sur l'arrière du jardin », « en tas rangé le long de
la haie ») et le portage se paie ; le débroussaillage a **deux machines**, et
c'est l'accessibilité du terrain qui décide du prix. Une règle de plus s'y
ajoute, écrite par le confrère sur un document qui part chez un client : *«
Hauteur du tronc à définir ensemble au moment de l'abattage »* — ce qui reste à
décider s'écrit sur le devis, au lieu d'être inventé ou tu.

**Et la consigne dépassait son budget.** Deux défauts, trouvés en mesurant :
le titre de chaque bloc était déduit *après* coup, si bien que trois blocs
faisaient dépasser de trois titres (6 020 pour 6 000) ; et le plafond lui-même,
posé à vide quand le vocabulaire tenait en dix termes, écartait désormais
**douze termes sur vingt-sept**. Ajouter du vocabulaire dont la moitié ne part
jamais, c'est faire semblant de l'ajouter. Le plafond passe à 9 000 — la
consigne générique qu'il vient corriger en fait déjà 7 300 à elle seule. Tout
part maintenant : 27 termes sur 27, 5 corrections sur 5.

Le contrôle qui affirmait que le budget était tenu était vert, **et pour une
mauvaise raison** : son scénario à deux cents termes épuisait tout dès le
premier bloc, si bien que les en-têtes suivants n'existaient pas. Un scénario
extrême cachait le cas ordinaire.


### Les grumes se facturent à la tonne

*« À la tonne »* — sa réponse à la question laissée ouverte la veille. La
réserve écrite à l'écran aura tenu moins de vingt-quatre heures, et c'est
exactement ce à quoi elle servait : posée dans un commentaire, elle aurait dormi
jusqu'à ce qu'un devis sorte faux.

Atlas lit désormais le tonnage dans la dictée — « 8 tonnes », « 3 t », « trois
tonnes » — et multiplie par son prix. Sans tonnage, il ne chiffre rien et dit ce
qui manque, plutôt qu'un chiffre qui aurait l'air d'un prix. Ce qu'il apprend
d'un devis se range **au poids**, jamais au montant de la ligne : c'est le piège
de la haie, en plus coûteux.

**L'ancien prix au forfait est effacé, pas converti.** 300 € pour un enlèvement
n'est pas 300 € la tonne, et on ne sait pas combien pesait le chantier qui a
produit ce forfait — il n'existe aucune conversion honnête. Une case vide est
une question posée ; une case fausse est un devis faux.

### Douze mois de jours pris sur son calendrier, trois pour son client

Sa réponse à la réserve posée la veille : *« tu peux aller jusqu'à douze mois
d'occupation. »* Son calendrier barre désormais ses journées complètes sur un
an — avant, au-delà de trois mois, un jour déjà pris s'affichait libre et le
serveur ne le refusait qu'après coup, au moment précis où il venait de le
choisir.

**Ce que voit son client n'a pas bougé**, et c'est le point à ne pas confondre :
deux nombres, deux personnes. Ce qui rend l'élargissement sûr n'est pas la
vigilance mais la séparation des chemins — la liste du patron et celle du client
sont calculées séparément et ne se rejoignent nulle part. Vérifié en mutant
l'une pour constater que l'autre ne bouge pas, plutôt qu'en le supposant.

La borne des douze mois est elle-même tenue par un contrôle : au-delà, c'est le
serveur qui tranche, et l'élargir en silence coûterait une requête plus lourde à
chaque ouverture d'écran.

### Un calendrier des deux côtés, où les jours pris ne se touchent pas

Sa demande : *« passe au calendrier pour le choix des dates à proposer au
client, mais également qu'il ait accès au calendrier pour pouvoir proposer une
date, avec un système pour qu'il n'ait pas accès aux dates déjà prises par un
autre client. »*

Les deux écrans employaient le sélecteur du téléphone. Il sait borner une
fenêtre — **il ne sait pas griser un jour au milieu**. Le client choisissait donc
un mardi déjà pris et ne l'apprenait qu'après coup, par un refus. Ce n'est pas
un détail d'affichage : un client qui bute sur un refus rappelle, ou renonce.

Le même composant sert les deux écrans, délibérément : deux calendriers écrits
séparément finiraient par ne pas griser les mêmes jours, et l'écart se verrait
chez le client. Il ne décide de rien — la grille, l'état d'un jour et la règle
« une ou deux dates » sont des fonctions pures, éprouvées sans navigateur.

**Un jour hors de la fenêtre du client ne lui dit jamais qu'il est « déjà
pris »** : lui apprendre qu'un jour de l'an prochain est occupé lui apprendrait
quelque chose du planning du patron, et sa page ne reçoit que des dates.

Côté patron, l'horizon va à dix-huit mois mais les jours occupés ne sont chargés
que sur la fenêtre proche : au-delà, c'est le serveur qui tranche, comme avant.
Le calendrier propose, il ne décide pas. Détail dans `ARCHITECTURE.md` §36.

Les deux contrôles navigateur regardaient `min` et `max` du champ natif —
la mauvaise question, puisqu'un champ bien borné laissait quand même choisir un
jour pris. Ils regardent maintenant ce que la personne peut toucher.

---

## 2026-08-08

### La souche et les grumes se détachent — l'évacuation non

Sa réponse à la question laissée ouverte la veille : *« le dessouchage oui, et
les grumes aussi »*. **Deux sur trois, et le troisième compte autant** :
l'évacuation seule reste avec l'abattage et le broyage, comme sur son devis du
5 août. Un contrôle tient les deux sens, parce qu'un jour quelqu'un trouvera
« logique » de détacher l'évacuation aussi.

La différence n'est pas de vocabulaire : une grume a de la valeur, le client
peut vouloir la garder ou la vendre. Les branches broyées, non.

Cinq grilles désormais, et trois formes : deux axes pour l'abattage et le
fendage, **un seul axe pour le dessouchage** (le diamètre de la souche — la
hauteur de l'arbre qui n'est plus là ne décide de rien), une case unique pour la
haie et les grumes. 82 cases au total.

**Une réserve, dite à l'écran et pas seulement dans le code :** il n'a pas
précisé à quoi se chiffrent les grumes — au mètre cube, à la tonne, au voyage.
Une case unique retient donc ce qu'il facture, et l'écran l'invite à trancher.
Inventer un axe aurait été inventer sa décision. Détail dans `ARCHITECTURE.md`
§35.

Deux détails qui ont failli passer : « enlèvement des grumes et dessouchage »
est une seule prestation que deux règles reconnaissent — sans ordre explicite
elle se serait facturée deux fois ; et « 40 à 50 cm » désigne maintenant deux
champs à l'écran, si bien que le nom accessible porte désormais la grille
entière.

### Le client ne pouvait ni voir sa facture ni télécharger son devis

**Le défaut le plus grave de la journée, et il a été trouvé par accident.** Une
suite navigateur a échoué parce que je l'avais lancée contre un serveur démarré
sous le rôle applicatif au lieu du rôle de test. L'erreur de manipulation a mis
au jour ce qu'aucun contrôle ne pouvait voir.

En production, le lien de facture envoyé au client répondait **« ce lien n'est
plus valable »** sur une facture parfaitement valide. Et le PDF du devis — le
document que son client lit — échouait de la même façon. La branche « envoi de
la facture » qu'il demandait ce jour-là était donc morte avant même d'être
atteinte.

La cause : `envois_devis` et `envois_factures` portent une politique de lecture
par jeton, `devis` et `factures` n'en portent pas. Retrouver l'envoi marchait,
lire le document derrière ne marchait pas. Le correctif pose le contexte
d'entreprise **déduit du jeton** — ce que la page du devis faisait déjà — sans
affaiblir l'isolation : l'entreprise vient de l'envoi, jamais du client.

**Ce qu'il faut en retenir dépasse le défaut.** Les suites navigateur démarrent
leur serveur sous un rôle qui **traverse la RLS**, parce qu'elles inspectent la
base. Elles ne peuvent donc pas, par construction, voir un défaut d'isolation —
et `test-facture-au-client-e2e.ts` parcourait ce chemin exact, vert depuis le
6 août. Tout chemin public par jeton doit désormais être éprouvé par une suite
base, sous le rôle applicatif : `scripts/test-facture-jeton-rls.ts`.
Détail dans `ARCHITECTURE.md` §34.

### Du planning à la facture, sans détour

Le patron : *« le client m'avait retourné la date validée, il se range dans les
chantiers planifiés, mais comment moi je fais pour avoir accès au devis ? Toute
cette branche-là n'est pas faite. »*

**La chaîne était construite — et injoignable depuis là où il se trouvait.**
Facture depuis le devis, arrêt 3, émission, relevé de TVA, message tout prêt :
tout existait. Mais sur le planning, toucher un chantier planifié n'ouvrait
qu'un sélecteur de date. Une chaîne qu'on ne peut pas atteindre vaut une chaîne
qu'on n'a pas écrite ; répondre « c'est déjà fait » aurait été exact et inutile.

La carte du planning mène désormais **au chantier**, porte un bouton **Fin de
chantier**, et garde le changement de date sur un lien discret.

**Deux défauts trouvés en reproduisant son écran**, tous deux issus de la même
cause : la règle de rangement était écrite trois fois. Le planning comparait
`< aujourd'hui` en TypeScript, le dépôt des terminés `<= aujourd'hui` en SQL.

- Un chantier prévu **aujourd'hui** figurait dans **deux onglets** — le défaut
  qu'il avait signalé le 6 août, revenu par la porte du signe.
- Un chantier **clôturé avant sa date** restait au planning comme si de rien
  n'était, absent des terminés, **sa facture en brouillon joignable seulement
  par son adresse**. Or clôturer plus tôt que prévu est autorisé à dessein
  depuis le 3 août.

Un seul cœur désormais, deux portes selon la donnée disponible, et le filtre du
planning **sorti du composant** — c'est le vrai correctif : tant qu'il vivait
dans l'écran, aucun contrôle ne pouvait constater qu'il contredisait la règle.
Détail dans `ARCHITECTURE.md` §33.

**Et un troisième défaut, vu sur une capture.** À l'arrêt 3, les travaux réunis
d'une même ligne s'affichaient « Abattage d'un chêne mort Br… ». La coupe venait
d'un `truncate` : le texte entier restait dans la page, donc **toute assertion
sur le contenu passait**. L'écran qui sert à vérifier avant que la facture parte
en cachait les deux tiers. Le contrôle mesure maintenant la hauteur rendue.

Le contrôle `test-planning-e2e.ts` a rougi, à juste titre : il verrouillait
l'ancien comportement de la carte. Corrigé dans le bon sens, et rendu rejouable
au passage — il visait « text=DÉC » globalement et échouait sur son propre passé
au deuxième passage.

### La facturation électronique : écrire ce qui était déjà décidé

Le patron a demandé : *« qu'est-ce que tu dois faire sur la plateforme de
facturation ? »* La réponse existait dans le dépôt — `docs/AGENT.md` §6, actée
le 31 juillet — mais **elle n'était écrite nulle part dans son langage**, et
c'est exactement le cas que `docs/QUESTIONS.md` sert à couvrir : une décision
expliquée une fois puis oubliée se repose trois mois plus tard.

Ce qui ne se rouvre pas : **Atlas prépare les factures, il ne les émet pas au
sens légal.** Ce qui reste ouvert : sur quel outil comptable se brancher — il
n'en a aucun à ce jour.

Deux points qu'il ne faut pas confondre, et qui sont désormais distingués noir
sur blanc : la conformité d'Atlas comme produit vendu à des artisans, et
l'obligation qui pèse sur **Eden Nature elle-même**, qu'Atlas existe ou non.
Les échéances annoncées — septembre 2026 pour la réception, septembre 2027 pour
l'émission des petites entreprises — sont écrites **avec leur réserve** : ce
calendrier a déjà été décalé deux fois et l'environnement de l'agent ne peut pas
le vérifier, son mandataire refusant les sites publics. À faire confirmer par un
comptable.

`docs/QUESTIONS.md` question 11 et `docs/A-FAIRE.md` point 6, ajoutés avec son
accord explicite. Rien à coder sur la facturation avant que l'outil soit
choisi.

**Au passage, un défaut vu sur une capture et pas par un contrôle :** les quatre
pages consultables affichaient leurs astérisques — `*« … »*` au lieu de
l'italique. Or dans ces documents l'italique porte **les paroles du patron**,
citées mot pour mot : une vingtaine de citations défigurées sur les pages qu'il
lit le plus. `scripts/md-en-page.mjs` connaît maintenant l'italique, après le
gras et jamais avant — l'inverse ferait de `**mot**` un italique contenant un
astérisque.

### Trois grilles de prix, et le devis du 5 août enfin juste

Le patron a répondu à trois questions posées avec leurs options : **on garde les
8 × 6 tranches** de la grille de fendage, **la haie prend sa propre ligne** avec
un prix au mètre linéaire, et **l'abattage a sa grille**, à la technique × le
diamètre.

Son devis de référence du 5 août — haie 350 €, abattage 600 €, fendage 300 €,
total 1 250 € — sort désormais **exactement comme il l'avait écrit**. Il en
comptait deux lignes le matin même.

**La bascule qui va avec, et qu'il faut connaître :** dès que la ligne
principale a un prix dans sa grille, Atlas cesse de chiffrer à la journée et
compte **poste par poste**. Le total devient la somme des grilles, et l'écran le
dit — un total qui change de méthode sans un mot se lit comme une erreur. Tant
que la grille d'abattage est vide, rien ne change, et en silence.

**La haie s'apprend au mètre, jamais au montant.** 350 € sur une haie de 20 ml
range 17,50 €/ml dans la grille. Retenir 350 € ferait facturer 350 € la haie
suivante, quelle que soit sa longueur. Sans longueur connue, on n'apprend rien
plutôt qu'un prix faux.

L'écran s'appelle maintenant `Réglages → Mes prix : abattre, fendre, tailler`.

Détail des choix dans `ARCHITECTURE.md` §32.

### Déposer sa liste de prix, au lieu de la retaper

Le patron : *« si l'utilisateur a déjà un fichier Excel ou un PDF avec ces
lignes de prix, il doit pouvoir le rentrer dans les réglages via une touche, et
que les prix s'ajoutent automatiquement. »*

`Réglages → J'ai déjà mes prix ailleurs → Choisir un fichier`. Atlas y lit les
désignations, les prix et les unités, et **montre ce qu'il ferait avant de le
faire** : ce qui s'ajoute, ce qui change — l'ancien prix barré à côté du nouveau
—, et ce qu'il n'a pas compris, ligne par ligne. Rien n'est enregistré avant
son appui.

**Ce n'est pas de la prudence de principe.** Ces tarifs commandent le prix de
ses devis. Un fichier mal lu écraserait sa grille sans qu'il l'ait vu passer, et
il ne s'en apercevrait que sur un devis déjà parti.

**Rien n'est deviné.** Une ligne de titre (« ABATTAGE »), un « sur devis », une
ligne sans désignation : écartées et signalées, jamais complétées par zéro — un
tarif à 0 € se proposerait ensuite comme « gratuit ». Un même intitulé deux fois
ne crée pas deux tarifs concurrents.

Lu sans aucune bibliothèque, comme l'archive de la sauvegarde : un `.xlsx` est
un ZIP de deux fichiers XML. Au passage, sept pièges de vraies feuilles ont été
traités — le BOM d'Excel, le point-virgule français, un vieux CSV en Latin-1,
un texte coupé en deux par Excel, une cellule vide qui décale les colonnes, une
colonne de numéros d'article prise pour les prix.

**Le PDF est refusé, et le refus dit quoi faire.** Un PDF n'est pas un tableau,
c'est une image de tableau : les colonnes n'y existent plus. Le message donne la
sortie — « Ouvrez la liste dans Excel puis Enregistrer sous → CSV ». Voir
`TODO.md` §0 sexies.

Détail des choix dans `ARCHITECTURE.md` §31.

### Proposer une date dans six mois — ce n'était pas possible

Le patron, en le voyant venir avant que ça ne lui coûte : *« la proposition des
dates au client, on a une visibilité que sur une semaine. Comment je fais si je
dois lui proposer une date dans six mois ? C'est un problème qui va se produire
à coup sûr. »*

L'écran suggérait les six prochains jours ouvrés, et **aucune autre porte
n'existait**. Il peut désormais choisir n'importe quelle date **jusqu'à
dix-huit mois** — l'élagage est saisonnier, une haie « à la fin de l'hiver
prochain », c'est quatorze mois. L'écran répond tout de suite : retenue, ou
pourquoi non, avec le jour libre le plus proche à portée de pouce.

**Ce que son client voit, lui, ne s'ouvre pas d'autant.** La page publique
reçoit la liste des jours occupés : lui donner dix-huit mois reviendrait à lui
donner le carnet de commandes. Elle montre donc trois semaines autour de la date
proposée — assez pour « plutôt la semaine d'après », pas assez pour lire le
planning. Sur « soit jeudi, soit à la Toussaint », les deux dates restent
retenables et **le semestre du milieu reste invisible**.

**Trois barrières se dressaient sur ce chemin**, et la troisième était la plus
chère : la revérification de la réponse. Elle se faisait contre une fenêtre
glissante de trois mois — le client aurait lu « date indisponible » **en
acceptant la date que le patron venait de lui proposer**, et le devis se serait
perdu là.

**Et un défaut latent que personne n'avait signalé :** la fenêtre était
recalculée à chaque ouverture du lien, depuis la date du jour. Un devis parti un
lundi et ouvert trois semaines plus tard n'offrait plus les mêmes jours. Elle
s'ancre maintenant au jour de l'envoi.

Dernier détail, qui n'en est pas un : **l'année s'affiche** quand la date n'est
pas dans l'année en cours. « Lundi 8 février » ne veut plus rien dire quand on
peut proposer à dix-huit mois.

Détail des choix dans `ARCHITECTURE.md` §30.

### Le devis se sépare en lignes vendables, et la fente a son prix

Le patron, pour la troisième fois en deux jours : *« l'agent ne comprend
toujours pas qu'il faut séparer les tâches. Tout ce que je dicte arrive sur la
même ligne du devis. »* Puis, apprenant qu'on l'avait diagnostiqué la veille sans
le corriger : *« on avait déjà travaillé sur ce défaut-là hier et je croyais que
tu l'avais corrigé. »* Il avait raison.

Le défaut tenait en une ligne — `join(" ; ")` — à deux endroits du chiffrage.

**Ce qui change sur son devis :**

- l'abattage, le broyage et l'évacuation sont réunis sur **une** ligne ;
- la fente du bois fait la **sienne**, parce que le client peut la refuser ou la
  confier à un autre ;
- **plus aucun point-virgule** : les travaux réunis s'empilent, un par ligne ;
- le billonnage (« on le coupe en 50 ») ne fait plus de ligne quand un abattage
  l'accompagne — il est compris dedans, comme il l'avait dit le 5 août. Ce qui
  est ainsi fondu est **signalé**, jamais escamoté.

Et la raison, dans ses mots, qui ne se devine pas : *« si le client ne veut pas
la fente, il va trouver le reste cher ; et s'il fait faire le reste par un autre
artisan et qu'il nous prend juste pour la fente, 100 € ce n'est pas assez
cher. »* D'où **850 + 250** au lieu de 1 000 + 100, à total égal.

### Une grille de prix pour la fente : hauteur × diamètre, 48 cases

*« Pour la fente, ils devraient demander la hauteur de l'arbre et son diamètre,
et on crée une liste de prix en fonction de la hauteur et du diamètre, comme ça
il n'invente rien. »* Puis, sur une première grille à 3 × 3 : *« par contre il
faut faire plus de tranche. »* Elle en compte donc **8 diamètres × 6 hauteurs**.

**Elle naît vide, et c'est le point entier.** Aucun prix n'est semé par le
dépôt, et aucune case ne se devine depuis ses voisines : une case vide est une
question posée, la ligne s'écrit à 0 € — visible comme un prix à poser — et
l'écran nomme la case qui manque.

**Elle se remplit toute seule.** Chaque prix de fente écrit sur un vrai devis
vient se ranger dans la bonne case. C'est son idée : *« le mieux, c'est que je
fasse plein de devis et que tu enregistres toutes mes modifications, et dans un
mois tu sauras les remplir tout seul. »* Il peut aussi poser un prix à l'avance,
dans `Réglages → Mes prix pour fendre le bois` — et une observation n'écrase
jamais une décision qu'il a prise lui-même.

Ses prix restent **les siens** : la grille est isolée par entreprise, à la
différence du vocabulaire du métier, qui part avec l'application
(`docs/QUESTIONS.md` §10).

### Deux défauts trouvés en construisant, et qui n'auraient rien dit

- **Une seconde écriture de la proposition au détail** dormait dans le code,
  exportée et appelée par personne. Elle ignorait le contrôle de doublon. Elle a
  été supprimée plutôt que mise à jour une fois de plus.
- **Le contrôle d'exhaustivité de l'export a fait son travail** : la nouvelle
  table portant une entreprise manquait dans la sauvegarde du patron. Sans lui,
  il aurait emporté ses données en y laissant ses prix de fendage.

### La batterie de tests ne finissait pas — et rien ne le disait

Trouvé en voulant simplement jouer `npm test` avant de livrer.

`test-ia-03-propositions.ts` affichait **« 8 test(s) réussi(s), 0 échoué(s) »**
puis restait là, pour toujours. La batterie s'arrêtait à cette suite, sans un
mot, et les cinquante suivantes n'étaient jamais jouées. Aucun test n'échouait :
c'est le pire des états, parce qu'une batterie qui ne finit pas ne dit pas
« rouge » — elle ne dit plus rien, et on croit vert ce qu'on n'a pas regardé.

**La cause :** le limiteur de débit ouvre une connexion Redis dès qu'une action
protégée est traversée, et personne ne la fermait. Le processus ne pouvait pas
s'arrêter.

**Pourquoi ça ne s'est jamais vu en CI :** l'étape `npm test` de la CI ne posait
pas `REDIS_URL` — alors que `CLAUDE.md` §5 la demande pour jouer la batterie en
local. La CI ne jouait donc pas ce que le dépôt dit de jouer, et l'écart cachait
le défaut. Les deux se jouent désormais dans les mêmes conditions.

**Trois corrections, pas une :**

1. `fermerLimiteur()` ferme la connexion, appelée en fin des neuf suites qui
   traversent une action limitée ;
2. la CI pose `REDIS_URL` sur `npm test` ;
3. le lanceur **tue toute suite qui n'a pas rendu la main en huit minutes**, avec
   un message qui désigne le bon coupable — « ses tests ont peut-être tous
   réussi ; c'est le processus qui ne s'arrête pas ». Éprouvé contre une suite
   volontairement bloquée : il la voit, et il ne se déclenche pas sur une suite
   saine.

**Et un quatrième, de la même famille :** `test-adresse-suggestions-e2e`
échouait en batterie et passait seule. Elle est la première dans l'ordre
alphabétique et attendait la toute première compilation des écrans — son message
accusait l'adresse, qui n'y était pour rien. Le lanceur préchauffe désormais les
écrans avant de commencer.

Détail des choix dans `ARCHITECTURE.md` §29.

---

## 2026-08-07

### L'adresse se propose pendant la frappe, et se choisit d'un doigt

Le patron : *« comme quand on passe une commande — on commence à taper
l'adresse et il nous propose tout un tas de listes, et plus on écrit, plus
l'adresse se réduit ; ensuite il n'y a plus qu'à cliquer sur notre adresse et ça
la valide. »*

**La source est la Base Adresse Nationale, pas celle de Google** — et ce choix
n'est pas technique. Google aurait demandé un compte de facturation, une clé, et
serait devenu un **sous-traitant de plus** à nommer dans les documents du
patron : exactement le contrat qui le bloque aujourd'hui (`docs/A-FAIRE.md`
point 2). Le service de l'État est public, français, sans compte ni clé.

**Ce qui part, et ce qui ne part pas.** Uniquement la rue en cours de frappe :
ni le nom du client, ni le chantier, rien qui permette de rattacher l'adresse à
quelqu'un. Un contrôle vérifie qu'aucun autre paramètre ne s'y ajoute — sans
lui, cette phrase serait rassurante plutôt que vraie.

**La requête part du serveur d'Atlas, jamais du navigateur.** La politique de
sécurité interdit à un écran de joindre un hôte extérieur, et c'est ce qui
garantit qu'aucun écran ne peut envoyer quoi que ce soit ailleurs sans qu'on
l'ait décidé. Un seul endroit à lire, à limiter et à couper.

**Le champ reste libre.** Un lieu-dit, un chemin de campagne, « derrière la
scierie » ne figurent dans aucune base — et c'est là qu'il travaille. Une liste
qui enfermerait le patron dans ce que la base connaît serait une régression.
De même, une panne du service laisse un champ ordinaire : le chantier se crée
quand même.

Trois contrôles, chacun sur ce qu'il peut réellement éprouver :
`test-suggestions-adresse.ts` (réponses illisibles, doublons, longueur minimale),
`test-recherche-adresse.ts` (service en panne, injoignable, muet — sur un vrai
service monté pour l'occasion), `test-adresse-suggestions-e2e.ts` (le geste
entier dans un navigateur). Et le **vrai** service est interrogé par une machine
qui peut le joindre : `.github/workflows/adresses.yml`, le mandataire réseau de
l'environnement de développement refusant `api-adresse.data.gouv.fr`.

Un détail vu sur une capture, jamais par un test : la bulle de l'assistant
recouvrait la troisième proposition, et le doigt touchait la bulle au lieu de
l'adresse.

### La sauvegarde arrive sous son nom, y compris sur un iPhone

Le patron touche « Télécharger mes données » depuis son téléphone, et Safari lui
propose un fichier nommé **`reglages`**, sans extension — le nom de la page. Il
arrive dans Fichiers illisible, donc inouvrable. **Une sauvegarde qui ne s'ouvre
pas ne sauvegarde rien**, et c'est la condition qu'il avait posée lui-même avant
de nourrir la mémoire de l'agent.

L'archive était pourtant complète et l'en-tête `Content-Disposition` correct :
un attribut `download` **vide** laisse Safari se rabattre sur le document
courant. Chrome, lui, lit l'en-tête — d'où un contrôle au vert sur un lien
pourtant muet. Contrôler l'un ne contrôlait pas l'autre.

Le nom est désormais porté par le lien **et** par l'en-tête, calculés par une
seule fonction (`src/lib/nom-sauvegarde.ts`) : deux implémentations finiraient
par diverger, et un fichier qui ne porte pas le nom annoncé est pire qu'un
fichier sans nom.

`scripts/test-mes-donnees-e2e.ts` lit maintenant l'attribut du lien lui-même.
Lien remis muet, il repasse au rouge : « Le lien annonce «  » : sur iPhone, la
sauvegarde arrivera sous le nom de la page, sans extension, et ne s'ouvrira
pas. »

### Le bouton de mise à jour n'accuse plus à tort, et son issue survit

**« La mise à jour n'a pas abouti. Redémarrez l'espace de travail. »** Le patron
a lu cette phrase, et elle désignait le mauvais coupable. Tirer le code neuf
remplace des centaines de fichiers **sous le serveur en train de tourner** :
celui-ci se recompile aussitôt, et la réponse en cours de route est coupée. Le
navigateur ne reçoit donc rien — **y compris quand la mise à jour a parfaitement
réussi**. Il est reparti redémarrer un espace qui n'en avait aucun besoin.

Trois changements, qui tiennent ensemble :

1. **L'issue est déposée dans un fichier** (`/tmp/atlas-mise-a-jour.txt`) avant
   que quoi que ce soit puisse couper la connexion, et l'écran la relit au rendu
   suivant. C'est elle qui donne la **raison** d'un refus — « des modifications
   non enregistrées sont présentes » n'appelle pas le même geste qu'« historique
   divergent », et personne ne peut la deviner.
2. **L'écran se rafraîchit tout seul** après l'appui. La ligne Version étant
   désormais lue dans le dépôt servi, elle répond d'elle-même à la seule question
   qui compte, sans qu'il faille recharger.
3. **Le message d'échec ne prétend plus savoir.** Il désigne l'endroit qui, lui,
   ne peut pas se tromper : « regardez la ligne Version juste au-dessus ».

Le journal vit dans `/tmp`, **jamais dans le dépôt** : un fichier déposé à la
racine rendrait l'arbre git sale, et `mettre-a-jour.sh` refuserait alors *toutes*
les mises à jour suivantes. Le remède aurait créé la panne, définitivement.
`scripts/test-issue-mise-a-jour.ts` le démontre sur un vrai dépôt git plutôt que
de le promettre.

### La version affichée vient du dépôt servi, plus d'une variable

Le 7 août au matin, sur un espace de travail **tout neuf**, l'écran Réglages
annonçait : « Version : inconnue — cette installation n'annonce pas sa version ».
L'écran ne pouvait donc plus répondre à la seule question que le patron sache
poser depuis un téléphone : *est-ce que j'ai les corrections ?*

La version venait de `ATLAS_VERSION`, posée par `.devcontainer/demarrer.sh` juste
avant de lancer le serveur. Une variable est **figée à la naissance du
processus**, et cela produisait deux mensonges :

- **absente** dès que le serveur n'avait pas été lancé par ce script précis ;
- **périmée** après « Chercher les dernières corrections » — ce bouton tire le
  code neuf *sans redémarrer*, donc l'écran continuait d'afficher l'ancien
  commit. Le bouton censé éteindre le malentendu l'alimentait.

La version est désormais lue **dans le dépôt réellement servi**, à chaque
affichage (`src/server/version-executee.ts`). Sur le banc d'essai seulement :
une application déployée n'a pas de dépôt sous la main, et sa version continue
de venir de sa chaîne de livraison. `safe.directory` est passé à l'appel — dans
un conteneur, le dossier appartient souvent à un autre compte, et git refuserait
en silence.

Le bouton de mise à jour **nomme aussi la version obtenue** : « Vous étiez déjà
à jour » ne prouvait rien tout seul — c'est précisément la phrase qu'affiche un
espace resté en arrière.

Éprouvé en retirant le correctif : la suite retombe sur « aucune version » et
sur « l'écran annonce 01/01/2020 alors que le code servi est … ».

### Rallumer un espace arrêté : le geste s'appelle « Open in Browser »

Le mode d'emploi disait « menu ⋯ → **Stop codespace**, puis rouvrez-le ». Devant
un espace **déjà éteint** — ce qui arrive tout seul au bout de trente minutes —
cette ligne envoie chercher une entrée de menu qui n'existe pas, et il n'y a
aucun bouton « Démarrer » ni « Réactiver » pour la remplacer. Le patron est resté
bloqué là : « je ne peux pas le réactiver ».

`docs/ESSAYER.md` nomme maintenant le geste, et dit ce que signifie l'absence de
« Stop codespace ».

---

## 2026-08-06

### Aller chercher les corrections sans quitter l'application

**Trois soirées perdues sur le même malentendu.** Le patron essaie des
correctifs livrés une heure plus tôt, ne voit rien changer, et conclut — à
raison, de son point de vue — que rien n'a été corrigé. Le 6 août au soir :
« en fait tu as corrigé aucun problème, ou alors j'ai quelque chose à faire pour
que le terminal ouvre la dernière mise à jour ? »

La question était juste, et la réponse était **oui** : l'espace de travail ne
récupère le code neuf qu'au DÉMARRAGE. Recharger la page du navigateur ne
redémarre pas l'espace, et rien ne le disait. Trois signes le prouvaient sur ses
captures — l'adresse encore mal placée, l'appareil photo sans accès à la
bibliothèque, un défaut réparé la veille toujours présent.

L'écran Réglages porte donc un bouton **« Chercher les dernières corrections »**,
qui va chercher le code, applique les migrations, et le dit. Banc d'essai
uniquement (`ATLAS_BANC_ESSAI`) : une application déployée qui tire son propre
code serait une porte d'entrée. Les prudences restent celles de
`mettre-a-jour.sh`, déjà éprouvé — jamais par-dessus du travail non enregistré,
jamais en forçant.

### La note vocale ne fait plus planter l'application

« Runtime NotSupportedError », en pleine page, en touchant « écouter ». Deux
fautes cumulées : `audio.play()` rend une promesse qui peut être rejetée — non
interceptée, elle remonte en erreur d'exécution et l'application entière paraît
cassée ; et la cause du rejet est presque toujours la même, Safari sur iPhone ne
sait pas décoder le WebM. L'écran dit maintenant, en français, que le téléphone
ne sait pas lire ce format — le fichier est intact et la transcription, elle,
n'en dépend pas.

### Ce qui tient à dix mille utilisateurs, et ce qui ne tiendra pas

Le patron : « l'application doit pouvoir supporter dix mille, voire cent mille
utilisateurs. Il ne faut pas qu'il y ait de problème si dix personnes rentrent
des mots de passe en même temps, créent des devis en même temps, font des
factures en même temps. »

**Éprouvé pour de vrai** (`scripts/test-concurrence.ts`) : trente numéros de
devis et trente numéros de facture demandés à la même seconde, deux entreprises
qui facturent en parallèle, vingt chantiers créés d'un coup, et quarante
lectures entrelacées entre deux entreprises.

**Ce qui tient :** la numérotation est atomique (`UPDATE … RETURNING`), aucun
doublon, aucun trou ; chaque entreprise garde sa propre suite ; et l'isolation
ne fuit pas sous charge — quarante lectures simultanées, aucune ligne d'une
entreprise vue par l'autre. Contrôle éprouvé en remplaçant la numérotation par
la version naïve (lire puis écrire) : **25 factures sur 30 portaient alors le
même numéro**. C'est exactement le défaut que ce contrôle existe pour attraper.

**Ce qui devient réglable :** le nombre de connexions à la base était écrit en
dur à 10 par instance. `DATABASE_POOL_MAX` permet de l'ajuster — au-delà de
quelques dizaines d'instances, c'est un répartiteur (PgBouncer) qu'il faudra,
pas un chiffre plus grand.

**Ce qui ne tiendra pas, mesuré :** la vérification d'un mot de passe prend
**80 ms** et ne se parallélise pas — dix connexions simultanées = 785 ms,
cinquante = 3,9 s, pendant lesquelles l'instance ne sert rien d'autre. La cause
est `bcryptjs`, une implémentation en JavaScript pur. Le remède est connu (une
implémentation native, qui rend la main entre deux calculs) mais engage une
dépendance compilée : soumis au patron avant d'être fait.

### La connexion refusait les bons identifiants, et trois écrans se marchaient dessus

**Ses parents ne pouvaient pas entrer.** Il leur donne l'adresse de
l'application ; ils saisissent les bons identifiants et lisent « Email ou mot de
passe incorrect ». Ils recommencent — ce que le message leur dit de faire — et
s'enfoncent. Deux causes cumulées :

- le compteur de tentatives était tenu **par email**, or le banc d'essai partage
  un compte unique : cinq essais en quinze minutes, tous visiteurs confondus, et
  tout le monde était bloqué, y compris ceux qui tapaient juste. Il est
  désormais tenu par email **et adresse IP** ;
- **le message mentait.** On taisait le blocage pour ne pas révéler qu'un email
  existe : protection dérisoire — celui qui martèle un compte le sait déjà —
  payée d'un prix total, puisque l'utilisateur légitime n'avait aucun moyen de
  comprendre. On lit maintenant « trop de tentatives, réessayez dans N minutes ».

**Un chantier n'apparaît plus que dans un seul onglet.** « Chez Martins »,
marqué FACTURÉ, figurait dans la liste des chantiers **et**, planifié le 12 août,
dans le planning. Désormais : planifié → au planning ; facturé, terminé, ou date
dépassée → aux terminés ; tout le reste → aux chantiers. Règle unique et
partagée (`src/lib/onglet-chantier.ts`), sans quoi elle se serait remise à
diverger d'un écran à l'autre.

**Un chantier planifié se supprime d'un glissement.** Vers la gauche, une
corbeille rouge se découvre ; un appui dessus, et il disparaît. Deux gestes,
jamais un — un bouton toujours visible finirait par être touché avec des gants.
Suppression douce (les traces restent), et **refusée dès qu'une facture est
émise** : une pièce comptable numérotée ne s'efface pas d'un mouvement du doigt,
elle se corrige par un avoir.

### Quatre points relevés en se servant vraiment de l'application

**Le PDF disait « Chantier : » là où on attend une adresse.** Le client
apparaissait sans adresse, et la rue des travaux figurait en dessous sous une
étiquette technique. Désormais : l'adresse du client — ou, à défaut, celle du
chantier — s'imprime nue, à sa place ; la ligne « Chantier : … » ne subsiste que
si les travaux ont lieu ailleurs, cas où l'étiquette est indispensable. Écran et
papier partagent la même fonction (`src/lib/adresses.ts`).

**Un seul bouton pour les photos, et le choix à l'appui.** Première version : deux
boutons côte à côte. « Ça fait trop de boutons » — il a raison, c'est une
décision imposée avant même qu'elle se pose. L'écran ne montre plus que
« Ajouter une photo » ; une feuille demande alors *prendre une photo* ou
*choisir dans ma bibliothèque*, et sait se refermer sans rien faire.

**Les photos : l'appareil photo, et rien d'autre.** « J'ai besoin de pouvoir
accéder aux photos que j'ai déjà prises. Il faut bien évidemment pouvoir faire
les deux. » L'attribut `capture` d'un champ de fichier n'est pas une
préférence : sur un iPhone, il **impose** l'appareil et retire l'accès à la
pellicule. Un artisan qui a photographié le chantier le matin ne pouvait rien
joindre l'après-midi. Deux champs, deux boutons : « Prendre une photo » et
« Choisir dans mes photos ».

**Le client recevait du JSON.** En touchant « voir le devis en PDF » depuis son
lien, il tombait sur `{"error":"Ce lien n'est plus valable"}` en pleine page.
Un client qui lit cela n'y comprend rien et appelle son artisan — quand il n'en
conclut pas que le devis est un piège. Il est renvoyé vers la page du devis, qui
sait s'expliquer en français.

**« La facture s'affiche partie, mais le client ne la reçoit pas. »** Exact au
mot près : l'écran annonçait « facture arrêtée » — vrai comptablement — et
**rien** ne portait la facture jusqu'au client. Le devis avait tout cela depuis
des semaines ; la facture, rien. Elle a désormais son lien public à jeton
(migration `0024_envois_factures.sql`), sa page client, son PDF archivé servi
tel quel, et le message tout prêt qui s'ouvre dans la messagerie du patron —
puisque aucun prestataire n'envoie à sa place (`docs/A-FAIRE.md` §5). L'écran ne
dit plus « arrêtée » sans ajouter « votre client ne l'a pas encore reçue », et
c'est l'envoi, non l'arrêt comptable, qui pose le jalon `facture_envoyee_at`.

### Le premier devis écrit à la main : trois défauts, trouvés par le patron

Il crée un chantier, saisit son client, ouvre « rédiger le devis à la main », et
rapporte trois choses. Toutes vraies, toutes reproduites avant correction.

**1. L'adresse au mauvais endroit, le téléphone au mauvais rang.** Il avait
rempli « adresse du chantier » et laissé vide « adresse du client — *si
différente de l'adresse du chantier* ». Le devis affichait donc un client sans
adresse, et la rue resurgissait tout en bas, nue, sans étiquette. Laissée vide,
l'adresse du client **est** celle du chantier : c'est ce que l'écran promet, ce
n'est donc pas une donnée inventée. Le bloc se lit désormais comme une lettre —
nom, adresse, e-mail, **puis** téléphone —, la même rue ne s'imprime pas deux
fois, et l'adresse des travaux ne réapparaît que si elle diffère, sous son
titre. Écran et PDF appliquent la **même** fonction (`src/lib/adresses.ts`).

**2. « Quand j'essaye de cliquer pour mettre un prix, ce n'est pas
cliquable. »** Il l'était. Mais vide, sans exemple, sans repère, et haut de
**24 pixels** — mesuré. Apple recommande 44. Un contrôle automatique répondait
« éditable : oui » et n'y voyait rien : c'est l'œil qui l'a vu, pas le test.
Le champ a maintenant la hauteur d'un doigt, un trait tant qu'il est vide, et
un exemple en gris.

**3. « Quand je fais aperçu en PDF, rien n'a été enregistré. »** Le plus grave,
et le mieux caché : ses lignes étaient bien en base — dans `lignes_prix`, celles
qu'il modifie — pendant que le PDF imprimait `lignes_devis`, l'instantané du
document, rafraîchi seulement au **chargement de la page**, donc avant qu'il
n'écrive quoi que ce soit. Deux lectures d'une même chose qui divergent, ce que
`CLAUDE.md` §3 interdit. L'instantané est désormais rafraîchi à l'instant de
l'impression. Un aperçu qui montre autre chose que l'écran fait douter de tout
ce qu'on vient de saisir.

`scripts/test-devis-papier-e2e.ts` parcourt son chemin exact sur un écran de six
pouces. Éprouvé en remettant chacun des trois défauts : chacun rougit le sien.
Piège rencontré en l'écrivant : `innerText` **ignore le contenu des champs de
saisie** — un contrôle qui l'interroge ne voit ni le nom, ni l'adresse, ni le
téléphone, et conclut à tort.

### Poser une clé suffit à brancher l'IA — elle ne l'était pas

Le patron : « J'ai déjà mis Anthropic et OpenAI. Les clés sont mises, je ne
comprends pas pourquoi l'IA n'est toujours pas branchée. Elle est censée
l'être. »

Elle ne l'était pas, et **trois causes se cumulaient** — chacune suffisant à
tout bloquer, aucune visible nulle part :

1. **`LLM_PROVIDER` valait `dev` par défaut**, et rien d'autre ne le changeait.
   Poser une clé ne branchait strictement rien. Désormais la présence d'une clé
   décide : Anthropic rédige, OpenAI transcrit. La variable explicite reste
   souveraine — `LLM_PROVIDER=dev` coupe l'IA sans retirer les clés.
2. **Le conteneur d'essai écrivait `dev` en dur et ne transmettait aucune clé.**
   Un secret d'espace de travail vit côté hôte ; ce qui ne figure pas dans
   `.devcontainer/docker-compose.yml` n'existe pas à l'intérieur. Le même piège
   avait déjà coûté une demi-journée avec `CODESPACE_NAME`.
3. **`src/server/ai/providers/llm/openai.ts` n'était qu'une ébauche** répondant
   « non implémenté » — une phrase que personne ne voyait jamais, puisqu'elle
   ressortait sous la forme d'un devis recopié mot à mot. Elle est maintenant
   implémentée pour de bon, appels d'outils compris.

**Deux pièges voisins, refermés au passage.** Une variable transmise à vide
(`${ANTHROPIC_API_KEY:-}`) passait pour renseignée : `?? défaut` ne rattrape
pas la chaîne vide. Et `LLM_PROVIDER=Anthropic`, avec sa majuscule, retombait
en mode déterministe sans un mot.

**Pour que la question ne se repose jamais sans réponse :**

- l'écran **Réglages** affiche les fournisseurs réellement actifs, et nomme la
  variable qui manque le cas échéant ;
- le bandeau de démarrage de l'espace d'essai le dit aussi ;
- `npm run verifier:ia` répond en une commande, et `-- --reseau` appelle
  réellement les fournisseurs. Ce contrôle **sait échouer** : clé absente, nom
  inconnu, ébauche déguisée en fournisseur, clé refusée.

**Un message qui accusait à tort.** Un HTTP 401 se traduisait par « fournisseur
indisponible » — soit une panne du prestataire, alors que la clé était
simplement mauvaise. Nouveau type d'erreur `cle_api_refusee`, qui nomme la
variable à corriger.

**Et pour qu'il n'ait rien à comprendre.** « Créez un fichier `.env.local` à la
racine du projet » n'a pas été compris — consigne mal posée : créer un fichier
caché, au bon endroit, avec le bon nom, sur six pouces. Le fichier est donc
**créé d'avance et vide** au premier démarrage de l'espace, avec une ligne par
clé et la marche à suivre en français. Il n'y a qu'à coller après le signe égal.

*Piège refermé en le construisant, et il aurait été grave :* charger ce fichier
naïvement aurait **écrasé avec du vide** des clés déjà présentes dans le
conteneur — le remède aurait causé la panne qu'il répare.
`.devcontainer/charger-cles.sh` ne ressort que ce qui apporte quelque chose, et
`scripts/test-charger-cles.ts` tient ce cas précis.

**Un espace de travail construit avant ce correctif garde l'ancien réglage**, et
aucune clé n'y servirait tant qu'il n'est pas reconstruit — geste introuvable sur
un téléphone. `.devcontainer/reglage-ia.sh` distingue « `dev` parce qu'on l'a
voulu » de « `dev` parce qu'un vieux fichier l'écrivait », et neutralise le
second. Éprouvé sur les quatre états par `scripts/test-reglage-ia-espace.ts`.

**Et un défaut de démarrage, découvert en préparant la livraison :** l'espace
récupère bien le code neuf, mais `demarrer.sh` continuait ensuite dans sa
version ancienne — le correctif du jour n'entrait en vigueur qu'au démarrage
suivant. Le script se rejoue désormais dans sa version neuve, une fois et une
seule.

**Ce que cela change pour les données.** La protection ne repose plus sur une
valeur par défaut mais sur **l'absence de clé** — voir `docs/RGPD.md` §3. La
batterie de contrôles retire donc les clés d'IA de toute étape qui exécute le
produit : une suite lancée dans l'espace du patron enverrait sinon les dictées
d'essai chez les fournisseurs, et les lui ferait payer.

### L'agent retient ce que le patron chiffre, et le lui rappelle

*« Si l'appli n'a aucune mémoire, comment l'IA va enregistrer et se souvenir ?
Pour s'améliorer elle a besoin de mémoire. »* Il avait raison, et le dépôt lui
donnait raison plus qu'on ne le croyait.

**Ce que ça a révélé.** `historique_prix` existe depuis des mois, elle est lue
par le chiffrage, affichée au catalogue — et **jamais écrite par
l'application**. Seuls les tests l'alimentaient. Une mémoire que personne ne
remplit n'est pas une mémoire ; c'est une table.

Désormais : il chiffre une ligne de devis, l'agent retient. Sur le chantier
comparable suivant, il lit sous la ligne *« La dernière fois — « Abattage d'un
chêne mort — démontage avec rétention, ⌀ 70 cm », le 6 août — vous aviez retenu
1 400 € HT »*, et un lien reprend ce prix.

**Pourquoi une table neuve plutôt qu'`historique_prix`.** Celle-ci s'appuie sur
`catalogue_prestations`, catalogue **partagé** repéré par nom canonique. Elle ne
sait pas distinguer un abattage au pied d'un démontage avec rétention — les deux
seules choses qui font passer le même chêne de 600 à 1 400 €. Une mémoire
aveugle à cette distinction rappellerait un prix faux de 800 € **avec l'autorité
de l'expérience**. `lecons_prix` porte donc une signature de métier
(`abattage|retention|d70`) construite par une fonction pure.

**Quatre décisions, et leur pourquoi :**

- **Un rappel, jamais un calcul** (`docs/EXEMPLE-DICTEE.md` §9c). La phrase dit
  d'où vient le chiffre et de quel chantier. Rien ne s'applique tout seul : le
  patron appuie, ou ignore.
- **Une leçon par ligne de devis, jamais une de plus.** Il tape son prix chiffre
  par chiffre, et chaque champ quitté déclenche un enregistrement : compter
  chacun emplirait la mémoire de 1, puis 14, puis 140 en allant vers 1 400.
  Seule sa dernière décision subsiste.
- **Le rapprochement se trompe dans le bon sens.** Les diamètres sont groupés
  par tranche de dix centimètres — 68 et 70 cm sont le même arbre. Une frontière
  subsiste (64 contre 66), et elle fait **manquer** un rappel, jamais en
  fabriquer un faux. C'est écrit noir sur blanc, avec un contrôle qui interdit
  de l'« améliorer » en élargissant : ce serait échanger un manque contre une
  erreur.
- **L'apprentissage ne gêne jamais le travail.** Une ligne dont on ne sait rien
  tirer — « Déplacement », « Acompte » — s'enregistre quand même. Faire échouer
  son devis parce qu'on n'a pas su en tirer une leçon serait le comble.

Au passage, `src/lib/arrondi-prix.ts` applique enfin sa règle : *« en HT on fait
des prix ronds : 350, 400, 420, 560 »*. Un devis à 1 002,53 € trahit la machine.

**Un défaut de conception trouvé par un test**, et pas en relisant : découper
les diamètres en tronquant mettait 68 cm et 70 cm dans deux tranches distinctes
— la frontière tombait pile entre deux valeurs voisines et courantes, et le
rappel ne se serait affiché qu'au hasard. Arrondi au plus proche depuis.

### Trouvé en vérifiant : les clés du patron n'entraient jamais dans son espace d'essai

Le patron a demandé de vérifier moi-même si Atlas était branché à un fournisseur.
La réponse est **non**, et la cause n'était pas chez lui.

Sur `main`, `.devcontainer/docker-compose.yml` **fige** `LLM_PROVIDER: dev` et
`TRANSCRIPTION_PROVIDER: dev`, et ne transmet **aucune clé d'API**. Un espace de
travail créé depuis la branche par défaut écrase donc tout ce que les secrets de
Codespaces peuvent contenir : il a ouvert deux comptes, payé, posé quatre
secrets — et le conteneur les ignorait par construction.

Le correctif (`${VAR:-dev}` et les cinq clés) existe depuis le 5 août sur la
branche de travail. Il n'a simplement **jamais atteint `main`** : tant que la PR
n'est pas fusionnée, son espace reste en mode déterministe quoi qu'il fasse.

**Deux corrections apportées au passage, sur des défauts réels du correctif
lui-même :**

1. **Un second chemin pour les secrets** (`remoteEnv` dans `devcontainer.json`).
   L'interpolation `${VAR:-dev}` est faite par docker-compose au moment de bâtir
   le conteneur, et ne lit que ce que l'hôte lui présente alors — rien ne
   garantit qu'un secret de Codespaces y soit déjà. `remoteEnv` est appliqué à
   l'intérieur, là où les secrets sont posés. Deux chemins pour la même valeur,
   parce que le coût de l'échec est asymétrique : s'ils échouent tous les deux,
   il dicte et reçoit un texte fabriqué sans que rien ne le lui dise.
2. **Une variable vide vaut « absente »** (`src/server/env.ts`). C'est le cas
   ORDINAIRE quand une valeur ne traverse pas : `${VAR:-dev}` comme
   `${localEnv:VAR}` produisent la chaîne vide, jamais `undefined`. Avec `??`,
   cette chaîne passait pour un nom de fournisseur, et le message annonçait « le
   nom "" n'est pas reconnu » — il aurait cherché une faute de frappe là où il
   n'y avait qu'une variable non transmise. Une erreur qui accuse à tort coûte
   plus cher que pas d'erreur du tout.

Les deux contrôles ont été **confrontés à l'état dégradé** : en annulant le
correctif, ils rougissent tous les deux.

### Passer outre l'arrêt donnait un devis vide — réparé

Trouvé par la CI, sur une suite qui n'était pas la mienne. L'arrêt d'ajout de la
veille avait un défaut que le code seul ne montrait pas : **quand le patron
passait outre sans répondre, le chiffrage ne tournait jamais.** L'écran
l'emmenait bien au devis — un devis sans la moindre ligne.

Le pire des deux mondes : il choisissait de ne pas répondre, et cela lui coûtait
son devis.

**L'arrêt est une offre, jamais une barrière.** Appuyer sur « Continuer » EST sa
décision : la chaîne va désormais jusqu'au bout, répondu ou non. Et ce qu'il
laisse de côté **ressort signalé sur le devis** plutôt que de disparaître — la
seconde moitié de sa propre règle du 6 août.

**Et une suite qui abîmait les données d'une autre.** `test-questions-chiffrage-e2e`
récrivait la dictée du jeu de démonstration, dont `test-transcription-e2e`
vérifie le texte. Invisible ici, où chaque suite est jouée seule ; visible en CI,
sur une suite innocente. Elle crée maintenant son propre chantier.

### L'agent s'arrête et demande ce qui coûte de l'argent

**Choisi par le patron en QCM**, devant la mémoire des corrections et
l'entretien de départ. Et sa règle, confirmée le même jour : *« il demande si ça
change le prix, il signale sinon »* — ce qui réconcilie deux réponses qu'il avait
données à une heure d'intervalle, et qui ne portaient pas sur la même chose.

**Ce que ça évite, chiffré.** Il a dicté « un chêne mort à abattre, de vingt
mètres de haut ». Chez lui, l'abattage vaut 600 € au pied, 1 000 € en démontage,
1 400 € avec rétention. Ce qui décide, c'est la **technique** et le **diamètre du
tronc** : sa dictée donne la *hauteur*, qui ne décide de rien, et tait les deux
autres. L'agent chiffrait donc à l'aveugle, avec 800 € d'écart possible.

Il pose maintenant deux questions, boutons au pouce, et repart.

**Et il se tait partout ailleurs**, ce qui compte autant. `AGENT.md` §2 exige un
arrêt « franchissable en quelques secondes » : un arrêt devenu formulaire est un
arrêt contourné, et le contournement ici c'est le devis faux. Le billonnage, le
fendage, le matériel ne déclenchent rien. Une suite l'éprouve en comptant les
questions, pas seulement en vérifiant qu'elles sont là.

**Trois décisions de conception :**

- **Les réponses vivent dans leur propre table** (`precisions_chantier`), pas
  dans le brouillon. Le brouillon se régénère à chaque relecture de la dictée ;
  ses réponses, elles, ne viennent pas de la dictée. Rangées là, elles seraient
  effacées à chaque relecture et il serait questionné deux fois sur le même
  arbre — la meilleure façon de lui faire abandonner l'arrêt.
- **La reprise ne rappelle pas le modèle.** Repasser par la lecture de la dictée
  lui ferait payer une seconde analyse, et pourrait renuméroter les questions
  auxquelles il vient de répondre.
- **« Vingt mètres » n'est jamais cherché dans la transcription brute.** Le mot
  figure deux fois dans cette dictée, pour la haie et pour la hauteur du chêne
  (`docs/EXEMPLE-DICTEE.md` §3). Un filtre qui lirait le texte entier prendrait
  l'un pour l'autre et tairait une question qui vaut 800 €.

**Ce que ça ne fait pas, et qu'il ne faut pas croire acquis :** la réponse
n'change pas encore le *montant*. Par sa propre règle (§9c) : tant qu'aucun
rapport n'a été observé entre techniques et prix, l'agent demande le prix plutôt
que d'en fabriquer un. Il manque la mémoire, pas la question. `TODO.md` §0 ter
dit ce qui la débloque.

### Trois défauts de mes propres contrôles, trouvés en regardant l'écran

Aucun n'était dans le produit ; tous auraient laissé passer un vrai défaut.

1. **« Abattage » était pris pour une technique.** Le premier filtre cherchait le
   premier mot de chaque option — dont « Abattage ». « Abattage d'un chêne mort »
   comptait donc comme technique déclarée, et la question qui vaut 800 € n'était
   jamais posée : le défaut que ce module existe pour empêcher, dans le module
   lui-même. « Abattage » est le mot générique du métier ; la technique, c'est ce
   qui suit.
2. **La suite navigateur cliquait un paragraphe.** « démontage avec rétention »
   figure aussi dans la phrase qui explique la question. Le contrôle visait le
   texte, cliquait l'explication, aucune option n'était retenue — et il passait
   quand même. Vert sur une réponse jamais donnée.
3. **Elle lisait le texte de la page là où les prestations sont des champs de
   saisie.** `innerText` n'en rend pas la valeur : le contrôle accusait le
   produit d'un tort qui n'était qu'un mauvais sélecteur.

Aucun des trois ne se voyait en relisant le code. Les trois se sont vus en
ouvrant l'écran et en regardant la base.

---

## 2026-08-05

### Le patron peut emporter ses données, en un appui

**Ce qui l'exigeait.** Il a perdu ses chantiers une fois, en supprimant l'espace
de travail — sur mon conseil, donné deux fois. Puis il a posé la question qui
commande tout le reste : *« le jour où je mets ça en ligne, est-ce que je perds
toute la mémoire ? »* Tant que la réponse honnête restait « peut-être », il avait
raison de ne rien vouloir saisir. Sa consigne, mot pour mot : *« oublie pas de le
faire, note-le, enregistre-le ! »*

Réglages porte désormais **« Télécharger mes données »** : un fichier ZIP, sur
son téléphone, sans terminal ni compte. Dedans, `donnees.json` (les vingt-trois
tables de son entreprise), ses photos, ses enregistrements, ses PDF, et un mode
d'emploi qui dit ce que le fichier contient de sensible.

**Trois décisions, et leur pourquoi** (détail dans `ARCHITECTURE.md` §26) :

- **Ni `pg_dump`, ni privilège en plus.** L'export passe par `withEntreprise`,
  comme n'importe quelle lecture. Une sauvegarde n'est pas une raison d'ouvrir
  une brèche dans l'isolation — et c'est l'endroit où une fuite ne se verrait
  pas, personne ne relisant trois mille lignes de JSON.
- **Le ZIP est écrit à la main**, sans bibliothèque, méthode « stockage ». Le
  format est figé depuis 1989 ; une dépendance coûterait plus cher que les
  quatre-vingts lignes. Photos et PDF étant déjà compressés, la compression ne
  gagnerait que quelques pour cent contre un chemin de code capable de se
  tromper en silence.
- **Un fichier manquant n'interrompt pas la sauvegarde.** L'audio est purgé
  après transcription : l'absence est le cas *normal*. `fichiers-absents.txt`
  liste ce qui manque et dit lequel des deux cas s'applique — une photo absente,
  elle, signale un espace de travail supprimé.

**Ce qui le vérifie.** Une suite ouvre l'archive avec l'`unzip` du système, pas
avec notre propre lecteur : un décalage d'un octet ou un CRC faux ne se verraient
nulle part ailleurs. Une autre interroge `information_schema` et **échoue si une
table portant un `entreprise_id` n'est pas dans l'export** — une table ajoutée
demain et oubliée disparaîtrait sinon des sauvegardes sans un bruit. Et une
troisième appuie sur le bouton dans un vrai navigateur, récupère le fichier,
l'ouvre, et vérifie qu'aucun compte de connexion ni empreinte de mot de passe
n'y figure.

**Ce que ça ne fait pas** : la sauvegarde *automatique*. Elle reste bloquée sur
le choix d'un hébergeur, faute de destination extérieure — ni le dépôt (public),
ni le disque de l'espace de travail (c'est précisément ce dont on se protège).
Écrit dans `TODO.md` §0(b), et redit à l'écran sous le bouton.

### Un contrôle qui accusait le produit pour un tort de la machine

`test-archive-zip.ts` vérifiait qu'un nom accentué ressortait accentué **en
relisant le disque après `unzip`**. Vert ici, rouge en CI — le runner tourne en
locale C, où `unzip` translittère le nom en l'extrayant. L'archive était juste ;
c'est l'attente qui dépendait de la machine.

Le contrôle porte désormais sur la propriété qu'on maîtrise vraiment, et qui est
*dans l'archive* : les octets du nom sont de l'UTF-8, et le drapeau qui l'annonce
est levé — c'est ce qui fait qu'un téléphone ou un Windows affiche « chêne ». Le
contenu, lui, est relu quel que soit le nom que le système d'accueil écrit.

Rejoué en forçant `LC_ALL=C`, la condition du runner, plutôt qu'en supposant
qu'elle est réglée. **Un contrôle qui accuse à tort coûte plus cher que pas de
contrôle du tout** — la règle était écrite, elle s'applique aussi aux contrôles
que j'écris moi-même.

### Cet environnement peut faire tourner PostgreSQL et Redis

**Correction d'une croyance qui coûtait cher.** `CLAUDE.md` §5 et `AGENTS.md`
affirmaient que la batterie base de données ne pouvait pas tourner ici, faute de
Docker. C'est vrai pour Docker, et faux pour la conclusion : les binaires
PostgreSQL 16 (`/usr/lib/postgresql/16/bin`) et `redis-server` sont installés.
Un `initdb` sous l'utilisateur `postgres` — `root` ne peut pas — suffit.

La conséquence était réelle : « c'est la CI qui vérifiera » a été dit trois fois
alors que la CI n'avait jamais tourné, et les suites base restaient éprouvées
nulle part. `scripts/monter-base-locale.sh` monte désormais le tout en une
commande. À utiliser **avant** de livrer, pas à la place de la CI.

### Une leçon : j'ai reconstruit ce qui existait déjà

J'ai écrit un « tapis roulant » qui enchaînait la dictée jusqu'au devis — et
`main` le portait déjà, livré le matin même par la PR #18 sous le nom
`devis-depuis-dictee.ts`. Le doublon a été supprimé au moment de la fusion ;
c'est la version de `main` qui reste.

**Comment c'est arrivé, parce que la cause est plus utile que l'excuse.** Ma
branche datait de cinq commits en arrière. J'y ai lu `docs/AGENT.md` §5, qui
disait « Enchaînement complet — à faire », et j'ai construit d'après cette
phrase. Sur `main`, la même ligne était déjà corrigée.

C'est exactement le défaut que j'avais diagnostiqué deux heures plus tôt chez
une autre conversation : *le dépôt est la source de vérité, pas la
conversation* — encore faut-il lire le dépôt à jour. **Avant de construire :
`git fetch origin main` et vérifier ce que la branche n'a pas.**

### L'écran Réglages dit enfin qui écoute et qui rédige

Le patron a ouvert deux comptes, payé, posé quatre clés — puis dicté, et
l'application a continué à fabriquer ses réponses **sans rien dire**. Il a fallu
qu'il pose la question dans une autre conversation pour l'apprendre.

Le garde-fou ajouté deux jours plus tôt refuse ce mode en production, mais reste
muet sur le banc d'essai, où c'est justement le mode normal. Il manquait la
moitié de la règle du dépôt : *un contrôle doit savoir échouer, et son message
doit désigner le bon coupable.* Ici il n'y avait aucun message du tout.

`src/lib/etat-ia.ts` décrit l'état réel à partir des deux seules variables qui
décident — jamais de la présence d'une clé, qui n'a jamais rien choisi. L'écran
`Réglages` l'affiche. Trois états, et le troisième est celui qui coûtait le plus
cher :

- **branché** : le prestataire est nommé, et l'écran dit ce qui part chez lui ;
- **déterministe** : rien ne part, avec une explication propre à chaque rôle ;
- **nom non reconnu** : une faute de frappe donnait le mode simulé, exactement
  comme une configuration absente, et rien ne distinguait les deux à l'écran.

Un quatrième cas est signalé au passage : un fournisseur reconnu mais dont le
raccordement n'est pas écrit (Deepgram, Google, Gemini) affiche « raccordement
non écrit » plutôt qu'un nom rassurant suivi d'une panne à chaque dictée.

**Un défaut trouvé en regardant, pas en testant.** La première version servait
la même phrase aux deux rôles : la carte « Rédaction » annonçait donc des
transcriptions simulées, ce qui n'est pas son sujet. Les onze tests passaient au
vert. C'est une capture des trois états qui l'a montré — le quatrième défaut de
ce projet trouvé de cette façon.
### La dictée mène droit au devis, et le devis est seul sur sa page

Le patron, en précisant : « une fois qu'on valide la note vocale, cette page
s'ouvre — la page où il n'y a que le devis — et là je fais mes modifications
s'il y a besoin. **Je ne veux pas tous les autres trucs intermédiaires.** Et
sous la note vocale, un petit lien pour y accéder directement : si je n'ai pas
envie de dicter, que je puisse le rédiger à la main. »

**Ce qui change au parcours :**

- La dictée validée ouvre **le devis lui-même**. Le compte rendu qui
  s'affichait — ce qui a été retenu, à combien — était un écran de plus entre
  sa dictée et son devis. Ce qu'il disait se lit maintenant sur le document :
  les lignes y sont, le total aussi, et la mention « recopiée mot à mot »
  s'affiche en tête quand aucun modèle n'a compris la dictée.
- Sous l'enregistreur, **« Ou rédiger le devis à la main → »**, quel que soit
  l'état de la dictée.
- La page du devis ne porte plus **aucun décor d'application** : ni barre
  d'onglets, ni titre d'écran, ni phrase d'explication. Une feuille, pas un
  formulaire — les champs n'ont ni cadre ni fond tant qu'on n'y écrit pas.

**Deux défauts trouvés en le construisant, tous deux sur le devis du client :**

- La ligne de prix s'appelait **« Prestation (prix calculé) »**. C'est ce que le
  client lisait, et cela ne lui disait rien du travail. Elle nomme désormais ce
  qui a été dicté. Le prix, lui, reste global : il se calcule sur la durée et
  l'équipe, pas prestation par prestation.
- **Rejouer la dictée dupliquait les prestations** — la même taille de haie deux
  fois, et le prix calculé qui la comptait double. C'est le défaut du 3 août
  sous un autre visage : ce qui est déjà au chantier n'y entre plus une seconde
  fois, et la règle se lit dans les données (`ARCHITECTURE.md` §10).

### « Le fichier devis, le vrai ! Le document entier »

Sa demande : « je veux que lorsqu'on clique sur rédiger à la main, ça ouvre le
fichier devis, le vrai ! Celui qui se trouve dans modèle de devis, le fichier en
entier, pas juste les lignes pour remplir les infos et les prix. »

Il avait raison sur le fond. « Rédiger à la main » ouvrait l'écran Prix : des
lignes et des montants. Or ce qu'il envoie à son client est un **document** —
son en-tête, ses coordonnées, celles du client, le tableau, les totaux, ses
conditions, le cadre de signature.

**Le document entier, dans l'ordre de son modèle** (`appli/devis-modele.html`,
celui qu'il avait construit lui-même pour Arborea, et que le PDF reproduit
déjà) : émetteur — nom, adresse, téléphone, e-mail, SIRET, **IBAN** —, numéro,
date, validité, client, adresse du chantier, tableau avec quantité et prix
unitaire, totaux avec **le taux de TVA qu'il fixe**, notes et conditions, cadre
de signature.

**Pourquoi pas le fichier d'origine tel quel.** Il garde tout dans le navigateur
(`localStorage`) : ce qu'il y écrirait n'existerait pas pour Atlas — ni facture
de fin de chantier, ni TVA, ni suivi de l'envoi. Ici chaque champ part vers **sa
source** (l'entreprise, la fiche du client, le chantier, les lignes de prix), et
le devis se reconstruit à partir d'elles. Aucune seconde vérité.

**Deux choses qui manquaient, révélées en le construisant :**

- **Aucun écran ne demandait l'IBAN ni le SIRET.** Le modèle les imprime ; sans
  IBAN, le client reçoit un devis qu'il ne peut pas payer.
- **Modifier une quantité ou un prix unitaire ne recalculait pas le montant.**
  Trois tilleuls à 250 € affichaient 750 € à l'écran et **0,00 € en base** —
  donc un devis à zéro chez le client. L'invariant `montant = quantité × prix
  unitaire` ne tenait que dans un sens ; il tient maintenant dans les deux.

Et le taux de TVA appartient désormais au document : une ligne ajoutée n'efface
plus le 10 % choisi la veille.

### La case « Nom du chantier » a disparu

Sa demande, en une phrase : « dans la catégorie chantier, retire la case nom du
chantier ». C'était **le seul champ obligatoire** de la création, et le seul qui
lui demandait d'inventer quelque chose. Un élagueur ne baptise pas ses
chantiers : il dit « chez M. Bernard » ou « rue des Lilas ». Lui faire trouver
un titre avant de pouvoir commencer, c'était une porte fermée à clé devant une
maison ouverte.

**Plus rien n'est obligatoire.** Le nom se déduit de ce qu'il a donné, dans
l'ordre où il en parle :

| Ce qu'il saisit | Le chantier s'appelle |
|---|---|
| Un client | « Chez M. Bernard » |
| Une adresse seule | « 12 rue des Lilas, Nantes » |
| Rien du tout | « Chantier du mercredi 5 août » |

**Ce n'est pas inventer une donnée** (`CLAUDE.md` §4) : rien n'est fabriqué,
tout est repris de sa saisie — et la date, à défaut, reste vraie. Ce nom est une
**étiquette** (ce qui s'affiche en tête de la fiche et dans la liste), jamais
une information sur le chantier ; il ne figure pas sur le devis du client, qui
porte l'adresse. Un contrôle tient l'invariant : *aucun mot du nom qui n'ait été
saisi*.

La règle vit dans une fonction pure appliquée **côté serveur**, pour qu'un appel
direct produise le même nom que le formulaire. Les 32 suites qui remplissaient
ce champ ont été reprises : elles identifient désormais leur chantier par son
client.

---

## 2026-08-04 (soir)

### Il éprouvait le code de la veille — et rien ne le lui disait

**Le défaut le plus coûteux de toute la série, et il n'était pas dans
l'application.** Le patron signale deux correctifs qui « ne marchent toujours
pas » : la bande déroulante des durées « a disparu !!!! », le numéro du client
« ne se met toujours pas ». Les deux étaient corrigés, éprouvés et fusionnés la
veille.

Un espace de travail garde le code qu'il avait **le jour de sa création**. Il ne
récupère jamais rien tout seul. Trois échanges ont été perdus à chercher des
défauts déjà réparés.

Deux réponses :

- **L'espace se met à jour à chaque allumage** (`.devcontainer/mettre-a-jour.sh`),
  puis réinstalle les dépendances et joue les migrations — un code neuf sur une
  base ancienne serait une panne au lieu d'un correctif. Il ne touche à rien si
  du travail n'est pas enregistré, n'avance qu'en ligne droite, et **dit
  toujours ce qu'il a fait**. Éprouvé contre les quatre états qu'il distingue :
  à jour, en retard, sale, divergent (`scripts/test-mise-a-jour-espace.ts`).
- **L'application annonce sa version** (Réglages, en bas) : « 04/08/2026 21:12 ·
  b05e282 ». Une capture d'écran répond désormais à « quelle version
  essayez-vous ? » sans qu'il ait à se le demander.

### « La date est à l'envers » sur le devis

Le PDF imprimait `2026-08-04`, tel que la date est stockée. Ce format est
parfait en base — il se trie tout seul — et illisible sur une pièce présentée à
un client. Devis et facture écrivent maintenant **04/08/2026**, échéance
comprise.

### La bande déroulante des durées, là où il la cherchait

Elle n'avait pas disparu : elle n'existait que sur l'écran d'envoi, au bout du
parcours, alors que c'est sur l'écran Informations qu'on décrit le chantier.
Elle y est désormais aussi, avec **la même liste** — ½ journée, puis 1 à 100
jours. Une seule source, parce que deux molettes qui divergent, c'est le patron
qui fixe deux durées pour le même chantier sans savoir laquelle compte.

Elle affiche « Non précisé » tant que rien n'a été dit : montrer « 1 journée »
par défaut ferait entrer un chiffre que personne n'a donné, et il ressortirait
dans un prix.

### « Je ne peux toujours pas rédiger mon devis seulement à la main »

Il le pouvait — par un lien au bas de l'écran Informations, c'est-à-dire après
avoir traversé photos et dictée. Et sa fiche annonçait « Prix — en attente des
informations », qui se lit comme un verrou alors que rien n'a jamais été
verrouillé. **Un chemin qu'on ne trouve pas n'existe pas.**

- « Ou rédiger le devis à la main → », sous l'action principale de la fiche.
- Les étapes disent ce qui manque, plus ce qu'il faudrait attendre : « À
  remplir, ou à dicter », « À calculer, ou à écrire à la main ».

**Et un défaut trouvé en éprouvant ce chemin :** l'écran Devis listait les
*prestations* du chantier. Un devis écrit entièrement à la main n'en a aucune —
le patron y voyait un total, et rien qui dise ce qui partirait chez son client.
Il montre maintenant **les lignes du devis**, avec leurs montants : ce sont
elles qui sont imprimées, et elles seules.

---

## 2026-08-04

### « Toujours pas de devis créé tout seul à partir de la note vocale »

Sa phrase, avec sa capture : sous « Générer le brouillon », en rouge, **« Réponse
du fournisseur non conforme (JSON invalide). »** Et rien d'autre — pas de
brouillon, pas de prestations, pas de prix, pas de devis. « Problème qui traîne.
Je veux vraiment que tu te consacres à fond pour régler ce problème une bonne
fois pour toutes. »

**Deux défauts, de nature différente.**

#### 1. Une réponse mal emballée arrêtait tout

Le service faisait `JSON.parse(reponse)` sans filet. Un modèle qui encadre sa
réponse en ```` ```json ````, ou qui écrit « Voici : { … } », suffisait à tout
bloquer. Et quand plus rien ne répond — pas de clé, quota dépassé, réseau coupé
— le patron n'avait pas davantage : un écran mort, alors que sa dictée était là,
sous ses yeux.

Trois changements :

- **L'emballage est toléré, le fond ne l'est pas.** `lireObjetJson` isole le
  premier objet équilibré ; le schéma strict reste seul juge du contenu.
- **On dit ce qui s'est passé.** Le nom du fournisseur et le début de sa réponse
  partent au journal. L'incident du patron était indiagnosticable : rien, nulle
  part, ne disait qui avait mal répondu.
- **Il n'existe plus un seul chemin où il se retrouve sans rien.** Quoi que
  réponde le fournisseur, la dictée est au minimum lue **mot à mot** — sans
  réseau, sans clé, sans jamais rien inventer. Le brouillon porte alors la
  mention « recopiée mot à mot », persistée en base (migration 0021) pour
  qu'elle survive au rechargement : présenter une recopie comme une analyse
  serait lui mentir sur ce qu'il relit.

#### 2. Et surtout : la chaîne n'existait pas

Le vrai « problème qui traîne » n'était pas le message d'erreur. Même tout vert,
Atlas s'arrêtait au brouillon. Le patron devait ensuite enchaîner **« Confirmer »,
« Valider et calculer le prix », « Ajouter au détail », « Préparer le devis »** —
cinq gestes sur quatre écrans, dont aucun ne menait au suivant. S'il en oubliait
un, un devis à **0,00 €** l'attendait au bout.

Or `docs/AGENT.md` §2 décrit depuis le début l'agent qui « transcrit, structure,
cherche les tarifs, **rédige le devis** », avec **un seul arrêt** : le patron
vérifie et valide. Chaque maillon existait et était éprouvé ; c'est
l'enchaînement qui manquait, et aucun contrôle ne le parcourait à la file.

**Un bouton, sur l'écran de la dictée : « Créer le devis à partir de ma
dictée ».** Il fait tout — prestations, matériel, durée, équipe, tarif ou
chiffrage, ligne de prix, devis — puis montre ce qui a été retenu, à combien, et
ce qui reste à regarder. Sur la dictée du patron : **1 674,00 € HT**, ses six
lignes, « 2 jours · 2 hommes ».

**Ce qu'il ne fait pas :** envoyer. L'arrêt avant l'envoi est intact, et une
suite le vérifie explicitement. Il n'invente pas non plus de prix : sans tarif
correspondant et sans durée ni équipe, aucune ligne n'est écrite, et le rapport
dit pourquoi et quoi faire.

#### Au passage

« J'estime le temps de travaux à 2 jours » laissait la bribe « j'estime le temps
de travaux à » — **imprimée comme une prestation sur le devis du client**. La
phrase d'annonce est maintenant reconnue entière ; elle passe en remarque, donc
elle n'est pas perdue, mais elle ne va plus sur le devis.

### Le SMS partait sans destinataire, et le canal ne se rediscutait plus

Le patron, sur deux captures : « l'ajout automatique du numéro ne fonctionne
pas », et « si je change d'avis et que je veux l'envoyer par e-mail, je ne peux
pas revenir au choix SMS/e-mail ».

**Le premier défaut ne pouvait être vu par aucun contrôle existant.** Le bouton
« Ouvrir le SMS tout prêt » passait par `navigator.share`. Sur iPhone, la
feuille de partage transmet un **texte** — et rien d'autre : ni numéro, ni
adresse. Le patron arrivait donc dans Messages avec le message tout écrit et un
champ « À : » vide, à retaper un numéro qu'Atlas connaissait. La fonction qui
compose `sms:0679…` était juste et éprouvée ; c'est l'écran qui ne s'en servait
pas. *Une règle juste que personne n'applique ne protège personne.*

L'adresse est désormais portée par un **vrai lien** (`<a href="sms:…">`), donc
lisible dans la page — c'est ce qui la rend vérifiable, et c'est le seul moyen
qu'un contrôle voie ce que la messagerie du patron voyait seule, trop tard. Le
partage reste offert à part, pour WhatsApp ou Signal.

**Le second se corrige au même endroit.** Le canal venait de la fiche du client
et ne se rediscutait plus au moment d'envoyer. Les deux voies sont maintenant
offertes sur l'écran « Devis prêt », et si la coordonnée manque, elle **se
saisit sur place** puis est conservée sur la fiche : aucun autre écran ne
permet de la renseigner, et renvoyer le patron « sur la fiche du client »
l'enverrait vers une porte qui n'existe pas.

**Un troisième défaut est tombé au passage**, trouvé par le contrôle neuf :
l'écran lisait la coordonnée dans **l'instantané figé du devis**, si bien
qu'une adresse tout juste enregistrée n'apparaissait jamais. Il lit maintenant
la fiche vivante du client.

### « 1 journée », pas « 1 jour »

Le patron, sur capture : « ce chantier va durer **1 journée**, pas jour ». Il a
raison — on dit « ça prend une journée », jamais « ça prend un jour ». La
première entrée de la liste des durées est corrigée.

Une seconde faute dormait à côté, jamais vue à l'écran parce qu'elle ne
s'affiche que sur une journée et demie : `libelleDuree(3)` rendait « 1 jours et
demi » — deux fautes en trois mots. Elle dit maintenant « une journée et demie ».

### Le même défaut survivait sur un numéro tel qu'il est saisi

Corriger l'écran ne suffisait pas. La fiche du client enregistre le numéro **tel
qu'il est écrit** — « 06 12 34 56 78 », espaces compris, puisque c'est la forme
que propose le champ. Ces espaces partaient tels quels dans l'adresse `sms:`, où
ils deviennent `%20` : l'application de messagerie n'y reconnaissait plus un
numéro et rouvrait un message **sans destinataire**, exactement le défaut qu'on
venait de traiter.

Aucun contrôle ne pouvait le voir, ni les anciens ni le neuf : tous employaient
un numéro collé (« 0679984514 »), sur lequel il est invisible. Les nouveaux cas
emploient la forme réelle — espaces, points, tirets — et ont été confrontés au
défaut réintroduit pour vérifier qu'ils savent échouer.

*La leçon, à côté de celle du jour :* un contrôle qui n'emploie pas la donnée
**sous la forme où l'utilisateur la saisit** ne prouve rien de ce qui lui
arrive.

### Il n'y aura pas de fournisseur SMS ni d'e-mail — décision du patron

Ses mots : *« ça sera plus rassurant, même pour les patrons, de passer par leur
e-mail et par leur numéro de téléphone. »* Ce n'est donc plus un pis-aller en
attendant un prestataire : c'est le chemin retenu.

Le point 5 de `docs/A-FAIRE.md` cesse de bloquer — ne restent que des conforts
(relance automatique, accusé de réception, code SMS) — et la décision **allège**
les points 2 et 3 : aucune donnée de client ne transitant chez un tiers, il n'y
a aucun sous-traitant de plus à autoriser ni à faire contractualiser.

Écartée du même coup, et pour de bon : **joindre le PDF au message**. Ni `sms:`
ni `mailto:` ne portent de pièce jointe, et l'API de partage qui le peut n'a pas
de destinataire. Surtout, ce serait nuisible — chez Atlas le devis est **la
page**, pas le PDF : un client qui répond sur la pièce jointe ne choisit pas sa
date et ne laisse aucune trace d'acceptation. Voir `ARCHITECTURE.md` §13.


---

## 2026-08-03

### La production refuse enfin de démarrer avec l'IA simulée

`src/server/env.ts` refusait déjà le stockage local, un `CRON_SECRET` faible et
l'absence de Redis en production — au nom de la règle inscrite dans son propre
en-tête : jamais de repli silencieux vers un comportement de développement.
L'IA simulée était le seul oubli qui passait en silence.

Trois chemins y menaient, tous muets : laisser `LLM_PROVIDER` /
`TRANSCRIPTION_PROVIDER` à leur défaut, écrire « dev » explicitement, ou faire
une **faute de frappe** dans le nom du fournisseur — les fabriques retombent sur
`dev` par leur `default:`. Un quatrième cas restait ouvert : un fournisseur réel
sans sa clé, qui ne se découvrait qu'à la première dictée.

L'application refuse désormais de démarrer dans les quatre cas, avec un message
qui nomme la variable en cause et renvoie à `docs/A-FAIRE.md` §1. Ce que ça
évite : le patron dictant sur un vrai chantier et recevant
« [Transcription simulée — 48000 octets reçus] » au lieu de ses mots. En
développement et sur le banc d'essai, rien ne change : le mode simulé y reste le
fonctionnement normal, et un test le garde.

Le contrôle a été confronté à ce qu'il prétend détecter : les six tests de
`scripts/test-env.ts` qui le couvrent virent au rouge quand on retire le
garde-fou.

### Les tarifs d'IA se relèvent maintenant à leur source

`docs/TRANSCRIPTION.md` ne portait aucun chiffre, et le disait : le mandataire
réseau de l'environnement de développement répond `403 Forbidden` sur les pages
tarifaires de tous les prestataires. À la question « combien ça me coûterait ? »,
la seule réponse honnête était « je ne peux pas savoir ».

`.github/workflows/relever-tarifs-ia.yml` déplace la mesure vers une machine qui
a le réseau — le même remède que `pages.yml` pour le site publié,
`banc-essai.yml` pour l'espace de travail et `relever-palette.yml` pour les
modèles du patron. Le script ne devine rien : une page injoignable est rapportée
comme telle avec son adresse, et il sort en échec si aucune source n'a pu être
lue.

Deux sources passent déjà depuis l'environnement de développement (Anthropic via
`docs.claude.com` — la page commerciale, elle, reste refusée ; et Google Speech-
to-Text). De quoi chiffrer un mois d'Atlas au volume du patron : **2 à 8 $**,
transcription comprise. Le prix ne décidera donc pas — ce sont les trois
questions RGPD qui décident, et `TRANSCRIPTION.md` §7 le dit maintenant avec des
chiffres à l'appui plutôt qu'en s'en excusant.

### Le tableau des prestataires de transcription disait vrai pour un seul

`docs/TRANSCRIPTION.md` annonçait trois prestataires « déjà écrits et prêts à
être activés » : OpenAI, Deepgram, Google. En réalité seul OpenAI l'est.
`src/server/ai/providers/transcription/deepgram.ts` et son voisin `google.ts`
sont des coquilles de quatorze lignes qui répondent « fournisseur non
implémenté » à chaque appel.

Ce que ça évitait : le patron doit choisir un prestataire, ouvrir un compte et
faire rédiger un contrat de sous-traitance avant de brancher quoi que ce soit
(point 1 de `docs/A-FAIRE.md`). Un tableau qui coche Deepgram lui aurait fait
dépenser cet argent et ce temps pour découvrir la panne au premier essai — après
la signature, pas avant.

Le tableau dit maintenant lequel est écrit et lesquels ne le sont pas, avec la
demi-journée que coûte chacun des autres. La même correction vaut pour la liste
d'étapes du jour où il tranche : écrire le raccordement est devenu l'étape 1,
sautée seulement si le choix tombe sur OpenAI.
### Le message du client arrivait dans le vide — et il n'avait que deux boutons

Le patron : « si le client remarque une faute, il doit pouvoir avoir une ligne
pour écrire et renvoyer le devis pour correction ».

**Deux défauts, dont un invisible.**

1. Le client n'avait que deux issues : accepter, ou ne pas donner suite. Celui
   qui repère une coquille ne veut ni l'une ni l'autre. Il touchait donc « Je ne
   donne pas suite », et le patron lisait « Le client n'a pas donné suite » — un
   chantier perdu pour une faute de frappe.
2. **Le champ pour écrire existait déjà**, intitulé « Une précision ?
   (facultatif) ». Le client y écrivait — la capture du patron montre « Le devis
   comprend une fautes » — c'était enregistré dans `precision_client`… et
   **aucun écran ne l'affichait jamais**. Le message partait dans le vide. C'est
   le plus coûteux des deux, parce que rien ne le signale.

**Ce qui change.** Une troisième issue, « Une correction avant d'accepter »,
inactive tant que rien n'est écrit — une demande muette obligerait le patron à
rappeler, c'est-à-dire à refaire l'aller-retour que ce parcours supprime. Le
champ devient une zone de texte, s'intitule « Une erreur, une question, une
précision ? » et annonce que l'artisan lira le message tel quel.

**Et le message arrive.** Il s'affiche entre guillemets, dans la carte de
l'accueil et sur l'écran Devis — pas derrière une pastille : c'est la seule
chose qui dise au patron quoi faire, et un geste de plus pour la lire serait un
geste de trop. Il accompagne aussi les refus (« trop cher ») et les
acceptations (« plutôt le matin ») ; une acceptation muette sur une date
proposée, elle, continue de ne déranger personne.

Nouvel état `Correction demandée`, distinct de `Devis retourné` : le chantier
est presque acquis, il ne tient qu'à une reprise. Le bouton dit alors
« Corriger et renvoyer ».

La base tient sa part : une correction sans message y est refusée par contrainte
(migration 0020), indépendamment du code.

### La durée du chantier se choisit à la molette, jusqu'à 100 jours

Sa demande : « au lieu de rajouter des jours à chaque fois, mettre une bande
déroulante qui fait défiler le nombre de jours (100 max) — si un chantier dure
20 jours ce sera plus simple et prendra moins de place ».

Les quatre boutons deviennent une liste déroulante : ½ journée, puis 1 à
100 jours. Sur son téléphone, c'est exactement la molette qu'il décrit, elle
occupe une seule ligne, et elle répond au lecteur d'écran — ce qu'une bande
écrite à la main n'aurait pas fait. Au-delà de trois jours, une phrase annonce
combien de jours ouvrés seront réservés : un chantier long bloque beaucoup de
jours d'affilée, c'est juste mais invisible.

### Le planning compte en demi-journées, et le patron peut avoir plusieurs équipes

Sa question :

> « J'ai déjà un chantier le 6 août, donc pour mon nouveau client on ne propose
> pas le 6 août. Mais si mon 1er chantier du 6 ne dure que le matin, je ne peux
> pas caler une autre demi-journée l'après-midi. »
> « Si j'ai deux équipes dans ma boîte, je peux avoir deux chantiers, voire plus,
> le 6 août. »

Trois pistes lui ont été présentées pour chaque moitié du problème. Il a retenu
la durée en demi-journées (« la demi-journée suffit ») et le compteur d'équipes,
et il a écarté les heures réelles. Le détail des choix est dans
`ARCHITECTURE.md` §22 — pour que personne ne rouvre le débat dans trois mois.

**Ce qui change.** Un jour porte deux demi-journées ; chacune tient autant de
chantiers que l'entreprise a d'équipes (réglable dans Réglages, une par défaut).
Un chantier occupe une suite de demi-journées à partir d'un départ que le
planning choisit — matin de préférence, après-midi sinon. L'écran d'envoi porte
désormais la durée du chantier, reprise de la dictée et corrigible d'un doigt :
elle commande les jours proposables.

**Un troisième défaut, que personne n'avait signalé.** La durée dictée
(« 2 jours ») n'entrait **nulle part** dans la planification : seul le chiffrage
la lisait. Un chantier de deux jours calé le 6 laissait donc le 7 proposable au
client suivant. Il bloque maintenant les deux.

**Ce que le client voit n'a pas bougé d'un iota**, et c'était sa consigne :
« mon client ne doit pas être informé de la demi-journée, seulement moi ; lui
verra le 6 août ». La page publique ne reçoit toujours que des dates. Un
contrôle inspecte le contenu sérialisé et échoue si « matin », « après-midi »,
« créneau » ou « durée » y apparaît.

**Le piège de la migration, et comment il est fermé.** Les chantiers déjà
planifiés n'ont ni créneau ni durée. Les lire comme « rien de réservé » aurait
libéré, du jour au lendemain, des après-midis déjà pris — et le patron se serait
retrouvé avec deux clients au même endroit. Ils sont donc traités comme une
journée entière, exactement ce qu'ils étaient.

**Ce que j'ai cassé en cours de route, et que la batterie a vu.** J'avais rendu
les samedis non retenables, alors que les autoriser était un choix délibéré :
on ne *propose* jamais le week-end, mais un client qui en demande un doit
pouvoir l'obtenir. Deux suites sans rapport ont viré au rouge sur des dates qui
tombaient un samedi. Corrigé, et écrit noir sur blanc dans le code.

### Le devis qui doublait tout seul

Le patron : « lorsque je clique sur la touche retour de mon navigateur et que je
reviens sur la page, ça me compte deux prestations, donc le prix du devis a fait
×2 tout seul ». Sa capture : **4 017,60 € TTC**, soit 3 348 € HT — deux fois
1 674 €.

Reproduit à l'identique, au centime près. La cause n'était pas un calcul faux,
c'était **un bouton sans mémoire** : « Ajouté au détail » vivait dans le
navigateur. Un retour arrière, un rechargement, un onglet rouvert, et l'écran
réaffichait « Ajouter au détail » alors que la ligne était déjà là. Un seul
appui suffisait. L'application avait invité l'erreur, puis l'avait exécutée sans
un mot — pire qu'un calcul faux, parce que rien ne le signale : le total paraît
simplement plus élevé que prévu, et ce total part au client.

L'état vient désormais **du détail lui-même** (`src/lib/proposition-au-detail.ts`),
plus du navigateur : le bouton dit « Déjà au détail », il est inerte, et une
phrase indique la sortie — modifier la ligne existante. Le serveur applique la
**même fonction** et refuse de son côté : une page laissée ouverte, deux appuis
pendant que le premier voyage, et l'écran ne protège plus rien.

Trois contrôles, à trois hauteurs : la règle (`test-proposition-au-detail.ts`),
le refus serveur (`test-prix-doublon-serveur.ts`), et **le geste exact du
patron rejoué dans un navigateur** (`test-devis-doublon-e2e.ts`). Les deux
premiers ont été confrontés au défaut d'origine : ils virent au rouge.

### « Fin de chantier » était injoignable sur un chantier planifié

« Le chantier est planifié mais je dois pouvoir retourner dessus une fois
terminé pour cliquer sur chantier fini — pourquoi n'y ai-je pas accès ??? »

Parce que la clôture n'existait que dans l'onglet **Terminés**, où un chantier
n'entre qu'une fois sa **date d'intervention passée**. Le sien était prévu deux
jours plus tard : la facture était donc réellement injoignable, et sa fiche
disait « rien à faire pour l'instant » sans indiquer ni où ni quand cela
changerait.

La fiche du chantier porte maintenant, en haut à droite comme il l'a demandé,
un bouton **« Fin de chantier → »** dès que le chantier est planifié. Aucune
barrière de date, délibérément : un chantier se finit parfois plus tôt, et c'est
le patron qui sait quand il est fait. Le geste reste sans danger — la fonction
appelée est idempotente, exige un devis réellement envoyé, et n'émet rien : elle
bâtit la facture qu'il vérifiera (arrêt 3). L'émission, elle, reste son geste,
et c'est elle qui alimente le relevé de TVA.

Le message d'attente dit enfin quelque chose d'utile : la date prévue, et le
geste suivant.

### La dictée arrive entière à l'écran

Le patron a écrit trois lignes et photographié ce qu'Atlas en avait fait :

    Taille de haie laurier 20 m linéaires
    Abattage chêne mort, couper le bois en 50 cm fendre laisser sur place
    Estimation 2 jours 2 hommes broyeur plus camion plus fendeuse

L'écran lui rendait **une** prestation au libellé collé (« Taille de haie
laurier 20 m linéaires⏎Abattage chêne mort »), « Rien de détecté dans la
dictée » en face du matériel, et « Non mentionné » en face des déchets. Son
verdict : « ça n'a rien à voir ».

Quatre fautes, toutes silencieuses :

1. **le découpage ignorait les retours à la ligne.** Une dictée met un élément
   par ligne ; deux prestations se retrouvaient dans un seul libellé ;
2. **un segment contenant la durée ou l'équipe était jeté en entier.** Sa
   troisième ligne portait tout son matériel — broyeur, camion, fendeuse — et
   elle a disparu sans laisser de trace ;
3. **le vocabulaire du matériel était celui d'un plaquiste** (plaque, rail,
   colle, enduit) dans une application faite pour un élagueur. Les unités (m²,
   kg) y figuraient aussi : « 20 m² de débroussaillage » finissait classé en
   matériel ;
4. **« bois » comptait comme un déchet.** Pour un élagueur, le bois est sa
   matière : « couper le bois en 50 cm, fendre, laisser sur place » — du travail
   facturable — basculait tout entier en gestion des déchets.

Les quatre sont corrigées. La même dictée rend maintenant trois prestations,
trois matériels, « laisser sur place » en gestion des déchets, la durée et
l'équipe — et ne réclame plus une information qu'il avait donnée.

**Ce qui empêchera la rechute.** Une heuristique ne comprendra jamais un
chantier ; ce qu'on peut exiger d'elle, c'est de ne rien perdre.
`scripts/test-analyse-dictee.ts` tient donc un invariant mot à mot : **aucun mot
dicté ne disparaît**, avec la liste explicite des mots de liaison qu'on
s'autorise à absorber. Il a été confronté aux deux défauts d'origine, qu'il
rattrape ; il en a aussi trouvé un troisième que personne ne cherchait —
`jours?` se déclenchait à l'intérieur de « journée », et « Une journée » laissait
une prestation nommée « née ».

**Ce que cela ne règle pas, et qu'il faut dire.** Ce découpage reste une
heuristique : il ne comprend rien, il se contente de ne rien jeter. La vraie
lecture d'une dictée demande un modèle de langage, et donc le choix de
prestataire qui attend le patron dans `docs/A-FAIRE.md`.

### Écrire le devis soi-même, depuis l'écran Informations

Demandé dans le même message : « je dois pouvoir cliquer sur mon devis et
pouvoir le remplir manuellement si je le souhaite ». L'écran Informations n'avait
qu'une sortie — « Valider et calculer le prix → » — qui passe par la proposition
automatique. Après une extraction ratée, c'était le seul chemin, et il menait au
même endroit.

Un second lien, « Ou écrire le devis moi-même → », mène directement à l'écran
Prix, qui **est** le devis en cours de rédaction. Il ne marque pas les
informations comme vérifiées — le patron quitte cet écran sans le trancher, et
la fiche du chantier ne doit pas prétendre le contraire. La proposition de prix
y arrive repliée, jamais supprimée : un lien la rappelle s'il change d'avis.

### L'adresse d'Atlas est écrite par la machine, plus recomposée par le patron

Le mode d'emploi lui donnait `https://<nom-de-l-espace>-3000.app.github.dev`.
Il a répondu : « Je comprends pas ce que je dois faire avec ça ». Il avait
raison — on lui demandait de deviner un morceau d'adresse, au doigt, sur six
pouces, alors que l'espace de travail connaît son propre nom.

`.devcontainer/demarrer.sh` compose désormais l'adresse complète à partir de
`CODESPACE_NAME` et `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`, l'affiche dans
un cadre au démarrage et la dépose dans `/tmp/adresse-atlas.txt` — le terminal
défile, pas le fichier. Hors Codespace, où ces variables n'existent pas, le
script n'annonce rien plutôt que d'inventer une adresse fausse ; les deux cas
ont été joués.

Le mode d'emploi ne porte plus aucun gabarit à remplir : une adresse
d'exemple complète, la consigne de la mettre en favori dès la première fois, et
— pour qui ne l'a pas fait — un tableau qui montre les deux caractères à ajouter
à l'adresse de l'éditeur, plutôt qu'une phrase à interpréter.

### « Déconnecté de codespace » ne veut pas dire « Atlas est en panne »

Le patron a envoyé une capture de son téléphone : *The workbench failed to
connect to the server (Error: deadline exceeded)*, et en bas **« Déconnecté de
codespace »**. Un seul mot avec : « Problème ».

Ce n'était pas Atlas — c'était l'éditeur qui n'avait pas réussi à joindre
l'espace de travail réveillé de sa veille. Mais rien dans `docs/ESSAYER.md` ne
le disait : la section de dépannage couvrait la page blanche, `Missing script`,
`EADDRINUSE`, le port pris — jamais l'éditeur lui-même. Le patron n'avait donc
aucun moyen de savoir que **l'éditeur ne lui sert à rien pour ouvrir Atlas** :
l'application démarre seule à chaque allumage, et son adresse est ouverte.

Le cas est écrit, en tête de la section de dépannage puisque c'est la première
chose qu'il voit : recharger, rouvrir depuis `github.com/codespaces`, et surtout
aller droit à `https://<nom-de-l-espace>-3000.app.github.dev` sans attendre
l'éditeur.
### Deux concurrents directs, trouvés en cherchant un nom

Le patron a demandé quel nom donner à l'application. « Atlas » n'avait jamais
été choisi ni vérifié — c'était un nom de travail, et le mot s'est révélé
massivement occupé dans les classes de marque du logiciel.

En vérifiant l'occupation des candidats, deux **concurrents directs** sont
apparus : `ouvra.app`, qui a pris un métier (plombiers-chauffagistes, catalogue
et TVA du secteur pré-remplis), et `fabro.app`, qui a pris l'absence de réseau
(100 % hors ligne, données sur le téléphone).

Consigné dans `PROJECT_STATE.md` parce que ce n'est pas une anecdote de
recherche de nom : une conversation qui croit le créneau vierge se trompera
d'arbitrage. Notre angle — la dictée et l'agent — reste distinct des deux, mais
il n'est plus une évidence qu'on peut laisser sans défense.

Le nom définitif n'est pas tranché : rien n'a été renommé.

### Le devis est enfin celui du patron

Le patron a ouvert le PDF d'Atlas à côté de celui qu'il avait construit
lui-même pour Arborea : « le devis n'a rien à voir avec celui qu'on a fait pour
arborea, je veux exactement le même, et même à l'impression ce n'est pas le
même ». Il avait raison — Atlas alignait quelques lignes de texte là où son
modèle portait un en-tête, un titre centré, deux colonnes émetteur/client, un
tableau réglé, un bloc de totaux, ses conditions de paiement et un cadre de
signature.

`src/server/pdf/devis-pdf.ts` reproduit désormais `appli/devis-modele.html` :
même ordre, mêmes libellés, mêmes montants à la française — « 1 400,00 € » et
non « 1400.00 EUR ». Les accents ont été rendus aux intertitres (« ÉMETTEUR »,
« QTÉ », « MODALITÉS DE PAIEMENT ») et à la mention légale, qui reprend mot pour
mot celle du modèle. Les petites capitales sont espacées comme en CSS, lettre
par lettre : pdf-lib ne sait pas le faire autrement, et sans cela le document
perdait exactement ce qui le rendait reconnaissable.

**Le détail qui n'était pas demandé, et qu'il fallait quand même régler :** un
devis d'une vingtaine de lignes — un chantier sur plusieurs arbres, rien
d'extravagant — écrivait par-dessus la mention légale et le cadre de signature.
Le devis se pagine, chaque page du tableau reporte son en-tête de colonnes, et
la numérotation n'apparaît qu'à partir de deux pages : le modèle n'en porte pas,
mais une feuille de devis peut se perdre.

**Ce que ça a demandé pour être vérifiable.** Un PDF ne se relit pas, et un
intertitre écrit lettre par lettre ne se retrouve même pas dans son flux.
`composerDevisPdf` renvoie donc le PDF *et* la trace de ce qu'il a déposé —
textes, traits, cadres, avec leurs coordonnées et leur page.
`scripts/test-devis-pdf.ts` l'interroge, dix contrôles, dont celui qu'aucun coup
d'œil sur la première page ne remplace : aucune ligne ne descend sur le cadre de
signature. Chacun a été confronté au défaut qu'il prétend détecter avant d'être
acté ; le premier jet cherchait « EUR » n'importe où et accusait « ÉMETTEUR ».

### Le détail quitte la page du client, et le PDF devient accessible

Le patron a confirmé : plus de détail sur la page, « de toute façon le client
aura le détail dans le PDF joint au mail ». Le tableau est retiré — sa page
montre le numéro, le client, l'adresse et les trois totaux.

**Sa prémisse ne tenait pas, et c'était le point qui comptait.** Rien n'est
joint au message : le partage n'envoie que le titre et le texte
(`navigator.share` sans `files`), et un `mailto:` ne peut porter aucune pièce.
Le client ne reçoit qu'un **lien**. Retirer le détail sans rien d'autre l'aurait
laissé accepter un total sans pouvoir consulter ce qu'il paie nulle part.

Le devis complet est donc servi par son jeton — `/devis/<jeton>/pdf`, mêmes
garanties que la page : contexte RLS posé par le jeton, lien expiré sans effet,
et **seul le PDF archivé à l'envoi** est rendu, jamais une reconstruction. Un
jeton inconnu et un jeton expiré donnent le même 404.

**Un défaut du banc d'essai trouvé en parcourant le lien** : le devis de
démonstration était marqué « envoyé » sans qu'aucun PDF n'ait été archivé — le
lien renvoyait 404. Le seed archive désormais la pièce comme le fait `envoyerDevis`
en vrai. C'est la deuxième fois que ce même devis de démonstration se contredit ;
il fallait le corriger à la source plutôt que de l'expliquer.

### La page du client montre les totaux, le détail se déplie

Le patron a demandé de retirer le détail du devis pour n'afficher que Total HT,
TVA et Total TTC. C'est fait **sur la page que son client ouvre** : elle tient
désormais sur un écran, les trois totaux au premier regard.

**Le détail n'est pas supprimé, il est replié** derrière « Voir le détail des
prestations » — un `<details>` natif, qui s'ouvre sans JavaScript. Deux raisons,
et elles ne sont pas décoratives :

- Le client engage son accord sur **le contenu exact** : la mention au bas de la
  page le dit, et l'acceptation conserve l'empreinte du document. Lui demander
  d'accepter un total sans pouvoir consulter ce qu'il paie retournerait contre
  le patron le jour d'un litige.
- Un devis de travaux doit porter le **décompte détaillé** de chaque prestation,
  en quantité et prix unitaire (arrêté du 2 mars 1990). **Le PDF n'a donc pas
  été touché** — c'est lui, la pièce qui engage.

Le patron a été informé de cette limite avant que le travail ne soit fait, et
il peut demander la suppression complète en connaissance de cause.

### « Aucune des deux » quand il n'y en avait qu'une

Trouvé en sortant, à la demande du patron, le visuel de la page que son client
ouvre. La question des dates y proposait toujours « Aucune des deux — je
propose : », que le patron ait envoyé une date ou deux. Le libellé était écrit
en dur.

Or c'est exactement le choix qu'il fait avant l'envoi — l'arrêt 1 de
`docs/AGENT.md`, sa seule question avant que le devis parte. Avec une seule
date, son client lisait donc une phrase qui ne correspondait pas à ce qu'il
avait sous les yeux, sur la **seule** page qu'il voit.

Le libellé s'accorde désormais : une date, deux, davantage, ou aucune. La règle
est une fonction pure dans `src/lib/` — l'importer depuis l'écran entraînait
toute la chaîne de connexion à la base, ce qui la rendait intestable.

### L'accueil prend la carte d'Arborea, la barre du bas reste

Les deux formes ont été rendues au patron en photos, côte à côte, avec ce que
chacune coûte. Sa réponse : **la barre du bas reste** (elle se touche d'une main
sur un chantier, quand celle d'Arborea défile et sort de l'écran), et **l'action
principale prend la carte** — rond d'icône, titre en Playfair, sous-ligne,
flèche.

Le refus est écrit au même titre que le changement (`ARCHITECTURE.md` §21) :
sans cela, une prochaine conversation verrait une incohérence avec la charte
d'Arborea et « corrigerait » la barre, en défaisant un choix délibéré.

Deux écarts assumés avec le modèle : la sous-ligne décrit le parcours réel — « Le
client, l'adresse, puis la dictée sur place » — et l'icône est un `+`, pas un
micro. Chez Arborea la carte ouvre l'écran de dictée ; ici elle ouvre un
formulaire, et un micro y serait une petite tromperie répétée à chaque ouverture.

### Le devis à 0 € ne part plus, et l'écran dit par où sortir

Quand aucun tarif ne correspondait, l'écran Prix affichait « Aucun prix
proposable » puis « Aucune ligne pour l'instant » — et laissait « Préparer le
devis → » actif. Le patron pouvait valider un prix inexistant, arriver sur un
devis à **0,00 €** et l'envoyer à son client. Aucun garde-fou nulle part. Un
devis accepté étant immuable, le corriger aurait demandé une nouvelle version.

Le bouton est désormais grisé, et surtout **l'écran dit quoi faire** : ajouter
une ligne avec son montant, ou enregistrer un tarif — avec un lien direct vers
Réglages. Un bouton grisé sans explication se lit comme une panne, et le patron
l'avait déjà conclu sur l'écran de dictée.

La règle est une **fonction pure** employée par l'écran *et* par l'action
serveur (`CLAUDE.md` §3) : un écran ne protège rien seul, et une seconde
implémentation de la même règle aurait fini par diverger. Elle attrape aussi le
cas plus sournois des lignes qui existent mais totalisent zéro.

**Un défaut trouvé en lançant l'application, que types et lint ne voyaient
pas :** la classe d'erreur avait été exportée depuis un fichier `"use server"`,
ce qui annule **tous** les exports du module — l'application entière renvoyait
500. Consigné comme piège n° 7 dans `HANDOVER.md`.

### Les modèles du dépôt sont bien ceux du patron — vérifié, pas supposé

Le patron a demandé de récupérer exactement le modèle qui se trouve sur son
site Arborea-, plutôt qu'une reproduction. Avant de reprendre quoi que ce soit,
un contrôle est allé chercher les six fichiers publiés et les a comparés octet
par octet à ceux de `appli/`.

**Le modèle de facture est identique** — 26 445 octets de part et d'autre.
Celui dont le PDF vient d'être bâti est donc déjà exactement le sien : il n'y
avait rien à récupérer. Quatre autres modèles sont identiques eux aussi.

Le seul écart concerne le modèle de devis, et c'est une **avance** : la copie
d'ici contient 2 717 octets de plus, le message d'accompagnement de l'envoi
ajouté à dessein. Le reprendre en ligne le supprimerait.

Cela clôt une question qui a coûté deux explications fausses : elle se mesure
désormais au lieu de se supposer, et le contrôle se rejoue
(`ARCHITECTURE.md` §20).

### La facture a enfin son document

Le devis produisait un PDF ; la facture, non — seulement un écran de
confirmation. Le patron validait donc un montant sans avoir jamais vu la pièce
que son client recevrait, alors que c'est précisément ce que l'arrêt 3 lui
demande de vérifier.

La facture a maintenant son PDF, sur le modèle `appli/facture-modele.html` :
numéro, date d'émission, date d'échéance, rappel du devis d'origine, mentions
légales de retard de paiement — et **aucun cadre de signature**, une facture se
règle. Un lien « Voir la facture en PDF » l'ouvre depuis l'écran.

**Une seule mise en page pour les deux pièces.** Plutôt que de copier cinq cents
lignes, le moteur a été extrait dans `document-commun.ts`. La refonte a été
prouvée sans effet : le devis rendu avant et après est identique **au pixel
près**.

**Un piège évité, et il aurait été coûteux :** le modèle porte la mention « TVA
non applicable, art. 293 B du CGI » avec la consigne « à retirer si vous êtes
assujetti ». Elle ne s'imprime désormais que si le taux appliqué est nul — une
facture qui annonce « TVA (10 %) » et la franchise dans la même page est une
facture fausse.

Onze contrôles, chacun confronté au défaut qu'il prétend détecter : cadre de
signature ajouté, échéance inventée, franchise annoncée à tort, rappel du devis
retiré, mention de pénalité amputée. Chacun a rougi en désignant le bon coupable.

Détail dans `ARCHITECTURE.md` §19.

### L'application reprend la charte d'Arborea

Le patron a fourni l'adresse de son Arborea d'origine et posé la bonne
question : pourquoi le style de ce site ne correspond-il en rien à
l'application ? Réponse mesurée : deux chartes coexistaient sans que personne
l'ait décidé. Atlas s'était donné un accent terre cuite et les polices du
système ; les maquettes gardaient le vert pin, Playfair Display et Inter.

Sa décision : **l'application reprend Arborea, les documents gardent la terre
cuite.**

| | Avant | Après |
|---|---|---|
| Accent | terre cuite `#B25A2E` | **vert pin `#2f3b2f`** |
| Fond | `#F6F1E6` | `#f5f3ee` |
| Titres | Arial Narrow | **Playfair Display** |
| Texte | polices système | **Inter** |
| Devis, facture | terre cuite | **terre cuite, inchangée** |

Les valeurs viennent du relevé automatisé sur son site publié, pas d'une
approximation à l'œil. Les polices sont rapatriées au build : les charger chez
Google serait bloqué par la politique de sécurité, et l'artisan verrait les
polices de repli de son téléphone.

Détail des choix, et de ce qui n'a **pas** été aligné, dans `ARCHITECTURE.md` §18.

### Terre cuite : le patron a choisi, les deux versions sous les yeux

Les deux devis lui ont été rendus côte à côte, même contenu, seule la teinte des
intertitres changeant, avec l'origine de chacune — terre cuite de son Arborea
d'origine, vert de la page encore en ligne. Réponse : « je veux terre cuite ».

Rien à changer dans le code, c'était déjà en place. Mais la couleur cesse d'être
une déduction tirée d'une capture pour devenir une décision, et elle est écrite
comme telle : une prochaine conversation qui découvrirait le vert en ligne
n'aura pas à la reposer.

### La cause annoncée était fausse : correction

J'avais écrit que « la copie versée dans `appli/` avait divergé de son
original ». C'est faux, et je l'ai vérifié plutôt que de le supposer une
seconde fois.

Un relevé automatisé (`relever-palette.yml`) ouvre le devis publié dans un vrai
navigateur et rapporte ce qu'il calcule. Il dit trois choses :

| Ce qui a été vérifié | Résultat |
|---|---|
| La page publiée, `…/Atlas-app/devis-modele.html` | intertitres en **vert** `#2f3b2f` |
| La copie du dépôt, depuis son premier commit | **le même vert**, jamais modifiée |
| Une page de devis à la racine du site du patron | **404** — il n'y en a pas |

Donc : la copie n'a pas dérivé ici. C'est la capture du patron qui montre une
version **qui n'est plus en ligne nulle part** — son Arborea d'origine, dont la
copie s'était écartée avant même d'entrer dans ce dépôt.

**Le choix de couleur reste le bon** : la terre cuite est bien celle qu'il
désigne en disant « voilà mon devis », et c'est l'accent qu'Atlas emploie
partout ailleurs. Ce qui change, c'est ce qu'on a le droit d'en dire : elle
repose sur sa capture, pas sur une page vérifiable. Quand la référence n'est
plus joignable, on l'écrit.

**Ce que le relevé a rapporté en prime**, et qui n'était vérifiable d'aucune
autre façon : la moitié basse du devis, que la capture ne montrait pas. Mention
légale, légende de signature, total final, en-têtes de colonnes — le devis
d'Atlas s'y conformait déjà.

Le mandataire de l'environnement de développement refuse `github.io`
(`403 à CONNECT — policy denial`, essayé et non supposé) et la fenêtre
d'autorisation ne s'affiche pas chez le patron. C'est pourquoi la mesure est
faite par une machine qui, elle, a accès — comme `pages.yml` et
`banc-essai.yml` avant elle. Détail dans `ARCHITECTURE.md` §17.

### Et la couleur n'était pas la bonne — la copie avait divergé

Le patron a renvoyé une capture de son devis tel qu'il le voit en ligne :
« ce n'est pas le style du devis ». Mesure faite sur ses pixels plutôt que sur
une impression d'œil — ses intertitres « ÉMETTEUR » et « CLIENT » sont en
`#a95c35`, une terre cuite, quand `appli/devis-modele.html` de ce dépôt leur
donne un vert `#2f3b2f`. **La copie prise chez Arborea avait déjà divergé de
l'original**, et je l'avais reproduite fidèlement — écart compris.

Cette terre cuite est, à l'antialiasing près, le `rust` `#B25A2E` que toute
l'application Atlas emploie déjà. Le devis s'y aligne, et son papier redevient
crème (`#faf9f5`) plutôt que blanc. Les couleurs posées entrent dans la trace :
un contrôle les constate désormais, au lieu qu'on les répète.

**La règle qui en sort, et elle vaut au-delà du devis :** la référence est ce que
le patron a sous les yeux, jamais notre copie de sa référence.

Détail des choix dans `ARCHITECTURE.md` §16.

---

## 2026-08-02

### Le dernier mètre existe : le message s'ouvre tout prêt

Le patron a demandé pourquoi le site Arborea réussissait à envoyer des e-mails
sans hébergeur ni nom de domaine, alors qu'Atlas n'y arrive pas. La réponse
était dans son propre code (`appli/devis-modele.html`) : **Arborea n'envoyait
rien**. Il ouvrait la boîte mail du patron avec le message pré-rempli, et c'est
lui qui appuyait sur Envoyer. Cette possibilité ne lui avait jamais été
présentée — une omission.

Elle est reprise : « Ouvrir le message tout prêt » sur l'écran du devis. Sur
téléphone, le menu de partage laisse choisir SMS, e-mail ou messagerie ; sur
ordinateur, l'application par défaut s'ouvre.

**Ce que ça débloque, et c'est le patron qui l'a vu :** la réponse du client ne
passe pas par l'e-mail — il répond sur la page web, et Atlas la voit en base.
Acceptation, planification, fin de chantier, facture et relevé de TVA sont donc
éprouvables dès aujourd'hui, sans abonnement ni nom de domaine.

Ce que ça ne donne pas, et qui reste au point 5 : Atlas ignore que le message
est parti, donc pas de relance automatique à sept jours.

Le message est une fonction pure (`src/lib/message-client.ts`), éprouvée par
sept contrôles : aucun montant n'y est répété — le prix vit dans le devis, et
deux endroits finiraient par se contredire le jour d'une reprise.

### La démonstration se contredisait à l'écran

« Devis non envoyé — le client n'a rien reçu », affiché sur un devis marqué
comme émis. L'écran ne mentait pas : la donnée de démonstration marquait le
devis envoyé sans jamais créer l'envoi. Deux notions se télescopaient — le
document émis, immuable, et le fait de l'avoir transmis.

Elle porte désormais un vrai envoi en attente de réponse, avec un lien client
ouvrable : le parcours de réponse s'éprouve dès l'ouverture, sans monter un
chantier complet d'abord.

### Un contrôle qui sait voir un élément recouvert — après deux fausses pistes

`isVisible()` de Playwright considère visible un élément caché derrière un
autre. C'est le trou par lequel sont passés trois défauts de ce projet, tous
trouvés en regardant une capture.

Les deux premières versions du contrôle accusaient à tort : l'une mesurait un
élément hors champ, l'autre l'amenait au bord de la fenêtre — c'est-à-dire
exactement sous la barre de navigation. La mise en page n'avait rien.

La version retenue ne dépend plus du défilement : reste-t-il, sous cet élément,
au moins la hauteur de la barre ? Sinon, aucun défilement ne le dégagera, et le
message dit combien de pixels manquent.

**La leçon, encore la même :** un contrôle qui échoue sur le mauvais motif ne
vaut pas mieux qu'un contrôle qui n'échoue jamais. Il a fallu deux corrections
pour qu'il dise vrai — et sans elles, un écran aurait été rembourré pour rien.

### Le devis se remplissait de prestations que personne n'avait dictées

Le patron a dicté une note vocale et retrouvé ceci dans son devis :

```
[Transcription simulée — fournisseu
1137980 octets reçus]
```

Deux prestations, fabriquées de toutes pièces. Et au-dessus, l'écran affirmait
« Proposé à partir de votre dictée » — d'où sa conclusion : *elle ne comprend
pas ce que je dis*. En réalité elle ne l'avait pas entendu.

**La chaîne complète.** Aucun prestataire de transcription n'étant raccordé
(point 1 de `docs/A-FAIRE.md`), le fournisseur de développement renvoie un texte
de remplacement. Ce texte était enregistré comme une transcription ordinaire,
puis découpé en segments par l'extraction — et chaque segment devenait une
prestation.

C'est l'interdit le plus net de ce dépôt (`CLAUDE.md` §4) : **ne jamais inventer
une prestation**. Il a fallu qu'un artisan le voie dans son devis pour qu'on
s'en aperçoive.

**Ce qui change.** Le texte de remplacement porte désormais un préfixe constant,
exporté et importé là où il faut le reconnaître — jamais une heuristique sur du
texte quelconque. La génération refuse alors de s'exécuter et n'écrit rien.
L'écran dit la vérité : la dictée est enregistrée mais n'a pas été transcrite,
et les prestations sont à saisir à la main.

**La garde est resserrée sur le texte, pas sur la configuration.** Une première
version testait le prestataire configuré : elle aurait bloqué aussi une
transcription légitime, et cassé les suites existantes. Une garde qui protège
trop large est un bouchon, pas une protection.

Cinq contrôles de non-régression, dont **un qui constate le défaut** — sans lui,
rien ne prouverait que la garde sert à quelque chose — et un qui vérifie qu'une
vraie dictée continue d'être analysée normalement.

## 2026-08-01

### L'écart d'origine allait dans l'autre sens — trois correctifs pour rien

Le patron a fini par lancer `npm run essai` lui-même et par coller la ligne que
le serveur écrivait depuis le début :

```
x-forwarded-host … 'xxx-3000.app.github.dev' does not match
origin header with value 'localhost:3000'
```

**C'est l'HÔTE qui porte l'adresse publique, et l'ORIGINE qui vaut
`localhost:3000`.** L'inverse de ce qu'on suppose spontanément — et de ce qui a
été supposé trois fois.

Conséquence : chaque correctif autorisait `*.app.github.dev` *en tant
qu'origine*, et l'alignement du middleware ne s'activait que pour ce domaine. Or
l'origine du patron est `localhost:3000` : la fonction ressortait à sa première
ligne, sans rien faire, dans tous les environnements.

**Et les épreuves simulaient la panne à l'envers de la vraie.** Elles passaient
au vert en corrigeant un défaut qui n'existait pas. C'est là que le temps a été
perdu : pas dans le code, mais dans un contrôle qui prouvait autre chose que ce
qu'il prétendait.

Ce qui change : l'alignement ne présume plus rien — ni du domaine, ni du sens de
l'écart. Hors production, l'hôte vu par Next devient celui qu'annonce le
navigateur, point. Et `verifier-connexion.mjs` rejoue exactement la combinaison
réelle : `x-forwarded-host` public, `Origin: localhost:3000`. Éprouvé dans les
deux sens — il échoue correctif désactivé, il passe correctif actif.

**La leçon, au-delà de ce défaut :** un contrôle éprouvé contre une panne
*imaginée* ne vaut rien, même s'il sait échouer. Ce qu'il faut reproduire, c'est
le message du serveur — pas l'idée qu'on s'en fait. Ici, il suffisait de le lire.

### Le correctif ne dépend plus d'aucun fichier de configuration

Troisième tentative sur le même défaut, et la leçon est là : **deux correctifs
de suite ont échoué parce qu'ils reposaient sur une variable déclarée dans
`.devcontainer/docker-compose.yml`.** Une variable écrite là n'existe pas dans un
espace de travail créé avant qu'elle n'y soit — et le correctif reste alors
inerte, sans le moindre message. C'est ce qui était arrivé à `CODESPACE_NAME`,
puis à `ATLAS_BANC_ESSAI`.

La condition ne tient plus qu'à `NODE_ENV`, que `next dev` pose lui-même. Aucun
fichier du dépôt n'a besoin d'être à jour pour que la connexion passe.

Éprouvé en retirant tous les filets : `allowedOrigins` vidé, `ATLAS_BANC_ESSAI`
absent. Rien d'autre que le correctif ne pouvait faire passer cette connexion —
et elle passe.

**Le contrôle distingue désormais deux causes qu'il confondait** : « l'origine
est refusée » et « la base n'est pas amorcée » n'ont rien à voir, et le second
cas s'est présenté en cours de route sous le premier message. Une épreuve a
failli être lue comme un échec du correctif alors qu'il venait de fonctionner.

### La connexion refusée : supprimer l'écart au lieu de l'autoriser

`allowedOrigins` ne suffisait pas. Le patron a recréé un espace de travail avec
tout le correctif précédent et a retrouvé « Invalid Server Actions request. »
mot pour mot — c'était sa vingtième tentative de la journée.

La configuration est pourtant correcte : l'algorithme de comparaison de Next a
été relu ligne à ligne dans `node_modules`, le joker `*.app.github.dev` couvre
bien l'adresse, et le contrôle passe en local. Il ne passait pas dans un vrai
Codespace, sans qu'on puisse reproduire pourquoi.

**Plutôt que d'ajouter une hypothèse de plus, l'écart est supprimé à la
source.** Le middleware aligne l'hôte vu par Next sur l'origine du navigateur :
il n'y a plus de désaccord à autoriser. Cela ne s'applique que si
`ATLAS_BANC_ESSAI` vaut 1 — posé par le seul docker-compose du banc d'essai,
jamais en production — et seulement pour un domaine de Codespaces.

Éprouvé en reproduisant la panne à volonté : `allowedOrigins` neutralisé, le
contrôle affiche « Invalid Server Actions request » ; avec le correctif, la
connexion passe. La cause est donc rattrapée quelle qu'elle soit.

**Et une page pour ne plus chercher à l'aveugle.** `/api/health/diagnostic`
affiche ce que le serveur voit réellement — origine, hôte, hôte transmis,
origines autorisées, variables d'environnement — et conclut par oui ou non sur
la possibilité de se connecter. Accessible sans session, à dessein : c'est quand
on n'arrive pas à entrer qu'on en a besoin. Une journée a été perdue faute de
pouvoir lire ces trois valeurs depuis un téléphone.

### La connexion était refusée derrière le proxy — et rien ne le voyait

**Invalid Server Actions request.** Voilà ce que le patron avait sous les yeux
en essayant de se connecter, une demi-journée durant. L'application démarrait
parfaitement ; elle refusait simplement d'ouvrir sa porte.

Next.js compare l'en-tête `Origin` à l'hôte avant d'accepter une action serveur.
Derrière le proxy de Codespaces les deux diffèrent, et `allowedOrigins` doit
donc être rempli. Il l'était — à partir de `CODESPACE_NAME`.

Sauf que le conteneur de l'application est décrit par un **docker-compose avec
une liste d'environnement explicite**, et que `CODESPACE_NAME` n'y figurait pas.
Une variable ne traverse pas cette frontière toute seule. À l'intérieur, elle
n'existait pas ; `allowedOrigins` restait vide ; toute action était refusée, à
commencer par le formulaire de connexion.

Deux corrections, parce qu'une seule ne suffit pas :

- La variable est désormais transmise au conteneur.
- **Et la connexion n'en dépend plus** : en développement, `allowedOrigins`
  accepte le domaine de redirection de façon générique. Le domaine de Codespaces
  varie, et une variable manquante ne doit plus pouvoir tout bloquer. En
  production, la liste reste vide — la protection est entière.

**Pourquoi aucune suite ne l'a vu.** Elles interrogent toutes `127.0.0.1`, où
l'origine et l'hôte coïncident : le défaut n'existait que derrière un autre nom
de domaine, c'est-à-dire uniquement chez le patron. `verifier-connexion.mjs`
comble ce trou — il se connecte dans un vrai navigateur en posant délibérément
une origine étrangère, et sans `CODESPACE_NAME`, l'état exact du conteneur en
panne. Éprouvé contre le défaut avant d'être ajouté : il échoue avec l'ancienne
configuration, il passe avec la nouvelle.

### L'application démarre seule : plus rien à taper

Quatre tentatives d'ouverture ont échoué d'affilée, **toutes sur le terminal, et
aucune sur l'application** : une commande tapée deux fois, un serveur arrêté
sans qu'on le sache, un espace endormi, un `Ctrl+C` demandé à quelqu'un qui n'a
pas de touche `Ctrl`. Le banc d'essai sert à essayer Atlas depuis un téléphone —
et on y faisait piloter un terminal au doigt.

`postStartCommand` lance désormais l'application à chaque allumage de l'espace,
veille comprise. Le patron n'a plus qu'une adresse à ouvrir.

Le contrôle du banc d'essai ne démarre plus rien de lui-même : il vérifie que
l'application répond **sans qu'aucune commande ait été tapée**. S'il échoue,
c'est qu'il resterait un geste à faire — précisément ce qu'on ne veut plus.

Un défaut trouvé en le lançant, pas en le relisant : `pkill -f "next dev"`
compare la ligne de commande entière de chaque processus, y compris celle du
shell qui joue le script. Le motif se trouvait lui-même et le script se tuait
avant d'avoir rien démarré. Les crochets de `[n]ext dev` l'évitent.

### Rien n'est acté valide sans avoir été éprouvé

Règle posée par le patron après trois bancs d'essai livrés « prêts » qui ont
échoué chez lui — script absent, application pas encore prête, port fermé. À
chaque fois le code était juste ; c'est le parcours qui ne l'était pas, et c'est
lui qui a fait le test.

Elle est désormais en tête d'`AGENTS.md`, lu à chaque conversation, et rappelée
dans `HANDOVER.md` — pas seulement dans `CLAUDE.md` §5, qu'on atteint après avoir
déjà commencé à travailler.

Appliquée à elle-même : le contrôle du banc d'essai a été confronté aux deux
états dégradés qu'il prétend détecter — base vide, puis schéma appliqué sans
données. Il échoue dans les deux cas, sort en erreur, et nomme la bonne cause.
Un contrôle qui n'a jamais échoué ne prouve rien.

Corrigé au passage : le message de fin de préparation promettait encore une
adresse joignable « tant que vous êtes connecté au même compte GitHub ». Le port
est public depuis, et cette phrase envoyait chercher un problème de compte là où
il n'y en avait plus. Il dit maintenant d'attendre la ligne « L'application
répond », et pourquoi n'y saisir que des données inventées.

### Installable sur un téléphone, et correcte une fois installée

Le patron a demandé si ce qu'il voyait pendant ses essais serait le design
final. Oui — même code, mêmes écrans. Mais la question a mis au jour deux
défauts et un manque, tous invisibles depuis un navigateur d'ordinateur.

**Les bords de l'écran.** Ajoutée à l'écran d'accueil, l'application s'ouvre en
plein écran : plus de barre d'adresse, mais plus de marges non plus. La barre
d'état recouvrait le titre « VOS CHANTIERS », et l'indicateur d'accueil mangeait
les libellés de la navigation. `viewport-fit=cover` et `env(safe-area-inset-*)`
règlent les deux ; posés sur `body`, ils servent aussi la page publique du
client, qui ne passe pas par la même mise en page. Vérifiés en simulant un
iPhone à encoche, pas en relisant le code.

**L'icône n'existait pas** — `"icons": []`. Un artisan qui aurait installé
l'application aurait vu une vignette grise. Elle est provisoire et assumée comme
telle : une icône provisoire qui cherche à bien faire donne l'illusion d'une
décision prise, et personne ne la remplace jamais. Toutes les tailles se
régénèrent d'un trait depuis une source unique (`npm run icones`) — un jeu
d'icônes retouché taille par taille finit toujours par diverger, et c'est la
moins regardée qui se retrouve fausse.

**Ce qui était relié à l'outil de fabrication iOS, c'étaient les maquettes
d'Arborea**, pas l'application. Le chemin « Ajouter à l'écran d'accueil » est
désormais prêt : il donne le même rendu qu'une application téléchargée, sans
compte Apple, sans Mac et sans validation. Il ne manque que l'hébergement.

### Le site public dit enfin ce qu'il est

Le patron a ouvert l'adresse publiée et demandé où étaient passées les autres
rubriques. Réponse : elles n'y ont jamais été. Ce site est la coque statique
reprise d'Arborea — cinq maquettes sans base ni serveur — et il en porte encore
le nom, tandis que l'application réelle n'est hébergée nulle part.

Un bandeau en tête de chaque écran le dit maintenant. Ce n'est pas un détail de
présentation : un site public qui se présente mal ne trompe pas les inconnus, il
trompe d'abord ceux qui savent ce qu'il devrait être — ici, celui qui le
finance.

La batterie de la coque accepte par ailleurs `PLAYWRIGHT_EXECUTABLE_PATH`, comme
le fait déjà `scripts/e2e-browser.ts` : elle était injouable dans les
environnements où le navigateur ne vit pas là où Playwright l'attend, ce qui
revenait à ne pas la jouer du tout.

### Caducité, compteur d'accueil, maquettes découplées

**Un lien périmé n'est pas un refus.** L'écran affichait « Devis retourné » dans
les deux cas — laissant croire à un refus qui n'avait jamais eu lieu, ce qui
décourage précisément de relancer. Les deux situations ont désormais leur état,
leur icône et leur phrase. Et un devis périmé **remonte à l'accueil** : sans
cela, le patron ne l'apprenait qu'en ouvrant la fiche du chantier, c'est-à-dire
jamais, puisque rien ne l'y ramenait.

**Le compteur d'accueil mentait doucement.** « N chantiers en cours » comptait
tout, y compris les chantiers réalisés et facturés — qui restaient d'ailleurs
affichés « planifié », un état qu'ils avaient quitté depuis longtemps. Deux
jalons de fin (`termine`, `facture`) et un compteur qui les exclut.

**Les maquettes `/design/*` sont découplées du produit.** Elles étaient typées
sur le `ChantierStatut` vivant : chaque nouvel état cassait cinq fichiers que
personne ne consulte. Pire, cette contrainte poussait insidieusement à ne pas
ajouter d'état pour s'éviter la corvée — un outil de conception ne doit jamais
peser sur les décisions du produit. Elles ont maintenant leur propre type, gelé.
`StatusIcon`, lui, est un vrai composant : il tire désormais son type de la
source vivante, dont il dépendait par accident via les données fictives.

### Suivi du devis parti — `07fa28c`

Le parcours savait tout et ne montrait rien. Un devis envoyé restait « devis
envoyé » indéfiniment : le patron voyait la même chose que le client réfléchisse
depuis une heure, qu'il soit sans nouvelles depuis trois semaines, ou qu'on lui
ait dit non. Le refus vivait en base et nulle part ailleurs.

- Cinq états, déduits par **une seule fonction pure** (`src/lib/etat-envoi.ts`) :
  en attente, à relancer (7 jours), caduc (lien expiré), retourné, accepté.
- Le planning ne propose plus de planifier soi-même un chantier dont le client
  choisit sa date — c'était préparer deux engagements sur le même jour. Il
  apparaît sous « En attente du client » plutôt que de disparaître.
- L'accueil annonce les refus, avec le **nom du chantier**. « J'ai vu » est un
  appui : une notification qui s'efface au premier coup d'œil se manque en
  faisant défiler l'écran.
- « Reprendre le devis » ouvre une nouvelle version sans toucher à celle qui est
  partie. Sans ce chemin, un chantier retourné l'était définitivement.

**Trois défauts corrigés au passage**, dont deux invisibles à la relecture :
l'adresse du lien était composée depuis le navigateur, donc différente de ce que
le serveur avait rendu (React régénérait tout l'arbre) ; l'état « envoyé » était
figé à l'ouverture de l'écran et survivait à une reprise de devis ; et une pile
de notifications repoussait les chantiers hors de l'écran.

### Lanceur de tests de bout en bout — `d54740f`, `4f15735`

Un passage de CI avait produit cinq suites en échec accusant chacune un écran
différent, alors qu'aucune n'avait pu charger la page de connexion : le serveur
était mort six minutes plus tôt et le lanceur ne le remarquait pas.

Le lanceur conserve désormais la sortie du serveur, l'interroge avant chaque
suite, et s'arrête net s'il ne répond plus. Le premier jet de ce contrôle
n'accordait que dix secondes et a déclaré mort un serveur simplement occupé à
compiler, faisant échouer un passage entier — corrigé à six tentatives réparties
sur une minute.

### Fin de chantier, facture et relevé de TVA — `d311752`

- Onglet « Terminés » : les chantiers dont la date d'intervention est **passée**,
  rangés par date. Le critère est cette date et non `termine_at` — sinon un
  chantier n'apparaîtrait qu'une fois déclaré terminé, c'est-à-dire jamais,
  puisque c'est là qu'on le déclare.
- « Fin de chantier » bâtit la facture depuis le devis et **s'arrête là**
  (arrêt 3). Idempotent : deux factures pour un chantier doubleraient la TVA.
- Le relevé de TVA se **calcule** à partir des factures émises, jamais stocké.
  Une table tenue en parallèle finirait par diverger de ce qui a été facturé.
- Immuabilité d'une facture émise posée par **trigger**, pas par convention —
  c'est ce qui rend le relevé stable.
- Migration `drizzle/0018_factures.sql`.

### Envoi du devis au client — `4c683f8`

La page publique de réponse existait, testée, mais **aucun chemin réel n'y
menait** : rien dans l'application ne créait le lien qu'elle attend.

- Bouton « Envoyer au client » et unique arrêt du parcours : *une date, ou deux
  au choix du client ?* Les jours proposés sont les jours réellement libres,
  relus à chaque ouverture.
- La chaîne était coupée un maillon plus tôt : aucun écran n'enregistrait le
  canal convenu avec le client. La création du chantier le recueille désormais,
  et le déduit quand une seule coordonnée est renseignée.

### Conformité RGPD — `6b8a8d1`

- Purge de l'audio sept jours après une transcription réussie, via la file
  `audios_a_purger`. Un balayage direct de `notes_vocales` aurait purgé **zéro**
  ligne, silencieusement : le planificateur n'a le contexte d'aucune entreprise.
- Export complet des données d'un client.
- Effacement qui **trie** au lieu de supprimer : les devis acceptés et le nom qui
  les rend valables survivent au titre de la conservation légale, tout le reste
  part, et le lien public est détruit dans tous les cas.
- Migrations `drizzle/0016_retention_et_effacement.sql`,
  `drizzle/0017_file_purge_audio.sql`.

### Documents tenus pour le patron — `9a461f0` → `a33201f`

`docs/QUESTIONS.md` (journal des questions et de leurs réponses) et
`docs/A-FAIRE.md` (points bloquants, avec leur propriétaire). Pages consultables
générées par `scripts/md-en-page.mjs`, sommaires cliquables. Règles de tenue
inscrites dans `AGENTS.md` pour survivre au changement de conversation.

### Page de réponse du client et cycle d'envoi — `ea815f2`

Seule surface publique du produit : devis et choix de date sur le même écran,
sans session. Jeton de 256 bits, expiration à 45 jours, calendrier borné aux
jours libres du patron, contre-proposition possible, case de rétractation quand
la date est proche. Migration `drizzle/0015_envois_devis.sql`.

**Correction critique du même lot :** le middleware remplaçait les en-têtes de la
requête par un objet vide, effaçant les cookies de session. Aucune erreur — 
l'application se comportait simplement comme déconnectée. 3 suites sur 19
passaient ; 19 sur 19 après correction.

### Cadrage de l'agent et documents légaux — `9ff1b16`

`docs/AGENT.md` (le parcours et ses arrêts), `docs/RGPD.md` (registre,
sous-traitants, conservation), et le mécanisme d'acceptation des documents
légaux avec empreinte SHA-256 du texte exact accepté.

## 2026-07-31

### Vérification du site publié — `bcd0e57`

Le workflow Pages vérifie le site **à son adresse publique** après déploiement :
chaque écran répond, la racine mène à l'application, et la batterie de tests est
rejouée contre l'adresse en ligne. L'environnement de développement ne peut pas
joindre `github.io` ; la vérification a donc été déplacée là où elle est
possible, plutôt que contournée.

### Reprise de l'application Arborea — `45b6d97`

Écrans, Capacitor et tests repris depuis `arborea-`, **sans le site vitrine**.
Publiée sur GitHub Pages.
