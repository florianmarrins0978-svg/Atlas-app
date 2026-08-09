# Mes questions

Les questions posées en cours de route, avec leur réponse. Écrit en langage
courant, pas en jargon — c'est fait pour être relu dans six mois sans avoir à
tout redécouvrir.

**Document modifiable.** Corrigez, complétez, supprimez ce qui ne sert plus.
Une réponse qui a vieilli vaut moins que pas de réponse du tout : si un prix ou
une règle change, rayez l'ancienne plutôt que de la laisser traîner.

**Comment ce document est tenu** (règles inscrites dans `AGENTS.md`, donc
relues à chaque session) :

- Une question déjà traitée ici reçoit **le passage existant, cité tel quel** —
  pas une réponse reformulée de mémoire, qui risquerait de dire autre chose que
  la première fois.
- Une nouvelle question n'est ajoutée **qu'après accord explicite**. Elle n'y
  entre jamais toute seule.
- Si une réponse a changé, elle est corrigée ici et le changement est signalé.

---

## Sommaire

1. [Le compte développeur Apple : qui paie, et combien de temps ?](#1-le-compte-développeur-apple--qui-paie-et-combien-de-temps-)
2. [Faut-il une clé API pour que l'e-mail du client se remplisse ?](#2-faut-il-une-clé-api-pour-que-le-mail-du-client-se-remplisse-)
3. [Pourquoi l'adresse du client ne se met pas toute seule dans le mail ?](#3-pourquoi-ladresse-du-client-ne-se-met-pas-toute-seule-dans-le-mail-)
4. [Si l'application se fait pirater, qu'est-ce que je risque ?](#4-si-lapplication-se-fait-pirater-quest-ce-que-je-risque-)
5. [Comment faire signer un contrat à tous les utilisateurs ?](#5-comment-faire-signer-un-contrat-à-tous-les-utilisateurs-)
6. [Le dépôt est public : n'importe qui peut-il voler notre travail ?](#6-le-dépôt-est-public--nimporte-qui-peut-il-voler-notre-travail-)
7. [Concrètement, quels problèmes pose le dépôt public ?](#7-concrètement-quels-problèmes-pose-le-dépôt-public-)
8. [Faut-il héberger l'application pour pouvoir l'essayer en entier ?](#8-faut-il-héberger-lapplication-pour-pouvoir-lessayer-en-entier-)
9. [Ce que je vois là, est-ce le design final ?](#9-ce-que-je-vois-là-est-ce-le-design-final-)
10. [Qui voit quoi : moi, mes clients, leurs salariés ?](#10-qui-voit-quoi--moi-mes-clients-leurs-salariés-)
11. [Qu'est-ce qu'Atlas doit faire sur la plateforme de facturation ?](#11-quest-ce-quatlas-doit-faire-sur-la-plateforme-de-facturation-)

---

## 1. Le compte développeur Apple : qui paie, et combien de temps ?

### Qui a besoin du compte ?

**Vous seul.** Une seule fois, pour votre entreprise.

Vos artisans ne paient rien et n'ont aucun compte à créer. Ils vont sur l'App
Store, ils téléchargent Atlas, ils s'en servent — exactement comme ils
téléchargent WhatsApp.

Le compte développeur, c'est **le droit de déposer une application sur l'App
Store**. Rien d'autre. Il ne concerne que celui qui publie.

### Une fois, ou tout le temps ?

**Tout le temps — 99 $ par an.**

Ce n'est pas un achat, c'est un abonnement. Tant que vous le payez, votre
application reste sur l'App Store et vous pouvez la mettre à jour. **Si vous
arrêtez de payer, elle est retirée du magasin.** Ceux qui l'ont déjà installée
la gardent, mais plus personne ne peut la télécharger.

Pour Android, c'est plus simple : **25 $ une seule fois**, à vie.

### Et l'automatisation du mail, elle coûte quoi ?

**Rien de plus.** Elle utilise l'application Mail déjà présente sur l'iPhone de
l'artisan.

Le web n'a pas le droit d'y toucher ; une vraie application, si. Le problème
disparaît parce qu'on n'est plus dans un navigateur, pas parce qu'on paie
quelque chose.

### En résumé

| | Qui paie | Combien | Quand |
|---|---|---|---|
| Compte Apple | Vous | 99 $ | Chaque année |
| Compte Google | Vous | 25 $ | Une seule fois |
| Vos artisans | Personne | 0 | — |
| Le mail pré-rempli | Personne | 0 | — |

**À prévoir en plus : un Mac.** Apple n'autorise la publication iOS que depuis
un Mac, et personne ne peut le faire à votre place — c'est votre compte et votre
identité qui engagent l'application.

---

## 2. Faut-il une clé API pour que l'e-mail du client se remplisse ?

**Non**, pas pour ce problème-là. Une clé ne peut pas remplir un champ qui
n'existe pas dans la fonction employée.

Il y a trois niveaux, et deux règlent la question sans rien payer :

**Aujourd'hui, sur le web — gratuit.** Le PDF est joint automatiquement, et
l'adresse du client est copiée dans le presse-papier : il ne reste qu'à la
coller dans « À : ».

**Dans l'application iOS/Android — gratuit aussi.** Le composeur de mail natif
accepte destinataire, objet *et* pièce jointe. Tout serait rempli d'un coup.
Aucune clé, aucun serveur : juste un module natif à ajouter au moment du vrai
build (voir question 1 pour le compte développeur).

**L'envoi vraiment automatique — là, oui.** Si le devis doit partir sans que
personne ne touche à rien, il faut un service d'envoi (Brevo, Postmark,
Resend…), donc une clé API, un compte, et un serveur pour garder cette clé au
secret. Une clé placée dans une page publique est une clé perdue.

---

## 3. Pourquoi l'adresse du client ne se met pas toute seule dans le mail ?

Parce que **le partage d'iOS n'a pas de champ destinataire**. Ce n'est pas une
erreur de programmation : ce partage peut envoyer vers Mail, WhatsApp ou
Messages, où « À : » n'aurait aucun sens. C'est aussi pour ça que l'objet reste
vide.

Sur ordinateur, l'adresse *est* remplie automatiquement — parce qu'on y emprunte
une autre voie.

### Le choix qu'il a fallu faire

Les deux voies s'excluent, et aucune ne fait les deux :

| | Destinataire rempli | PDF joint |
|---|---|---|
| Partage natif | non | **oui** |
| Lien `mailto:` | **oui** | non |

**Version retenue : le partage natif**, donc le PDF joint d'office, avec
l'adresse copiée dans le presse-papier pour n'avoir qu'à la coller.

> Une version « mail pré-rempli » a été essayée puis abandonnée : elle obligeait
> à joindre le devis à la main, ce qui est plus pénible sur un téléphone que de
> coller une adresse.

Ce compromis disparaît dans l'application native (question 2).

### Mise à jour du 2026-08-03 : dans Atlas, l'arbitrage s'inverse

Ce qui précède valait pour le site Arborea, où **le PDF était la livraison**.
Dans Atlas, la livraison est **la page du client** — c'est là qu'il choisit sa
date, et ce choix fait tourner la planification et la facture.

Le tableau ci-dessus reste exact, mais la case qui compte a changé : **c'est le
destinataire prérempli qu'on garde**, et le PDF voyage au bout du lien. Le
patron a tranché en ce sens : *« il faut que ça préremplisse automatiquement
soit le numéro de téléphone du client, soit l'adresse e-mail. »*

Et joindre le PDF serait désormais **nuisible** : le client le lirait et
répondrait « c'est bon » par retour de message, sans ouvrir la page — donc sans
date choisie et sans trace d'acceptation. Détail dans `ARCHITECTURE.md` §13.

---

## 4. Si l'application se fait pirater, qu'est-ce que je risque ?

> Ce qui suit n'est pas un avis juridique. Le détail est dans
> [`RGPD.md`](RGPD.md), et le contrat doit être écrit par un juriste.

### D'abord : détenir ces données est légal

Ce n'est pas interdit, c'est **encadré**. Le problème n'est jamais de détenir —
c'est de détenir sans le cadre.

### Votre position exacte

- Pour **vos abonnés artisans** → vous êtes responsable de traitement.
- Pour **les clients de vos artisans** → vous êtes **sous-traitant**, et
  l'artisan est le responsable.

Cette seconde relation impose un **contrat** (article 28 du RGPD). Sans lui,
vous êtes en tort *avant même* tout piratage.

### Ce que vous encourez en cas de fuite

- **Amende administrative (CNIL)** : jusqu'à 10 M€ ou 2 % du chiffre d'affaires
  mondial. En pratique, la CNIL commence souvent par une mise en demeure — mais
  l'absence totale de documentation fait basculer vers la sanction.
- **Pénal** : l'article 226-17 du Code pénal punit le défaut de sécurité de
  5 ans de prison et 300 000 € d'amende. Pour une société, le montant est
  quintuplé (1,5 M€). C'est le point que la plupart des gens ignorent.
- **Civil** : les personnes concernées peuvent réclamer des dommages.
- **Contractuel** : vos artisans peuvent se retourner contre vous.
- **Obligation immédiate** : vous devez alerter l'artisan **sans délai**. C'est
  *lui* qui a ensuite 72 heures pour prévenir la CNIL. Réagir en trois jours lui
  fait manquer son délai.

### Ce qui réduit vraiment le risque

| Levier | Effet |
|---|---|
| **Créer une société** plutôt qu'exercer en nom propre | Sépare votre patrimoine personnel. Le plus gros levier, et le moins cher |
| **Assurance cyber / RC pro** | Absorbe l'essentiel du coût d'une fuite |
| **Contrat de sous-traitance** | Obligatoire, et répartit les responsabilités |
| **Hébergement en Europe, chiffrement** | Réduit la faute retenue contre vous |
| **Ne pas garder ce qui ne sert plus** | Ce qu'on ne détient pas ne peut pas fuir |

---

## 5. Comment faire signer un contrat à tous les utilisateurs ?

**Les conditions générales suffisent.** L'article 28.9 accepte l'écrit « y
compris sous forme électronique » : pas de signature manuscrite, pas de papier.
Une case cochée en ligne est valable — c'est ce que font tous les services de ce
type.

Trois conditions pour que ça tienne :

1. **Un document distinct**, annexé aux conditions générales et non dilué
   dedans. Noyé dans vingt pages, un contrôleur peut estimer que l'artisan n'en
   a jamais eu vraiment connaissance.
2. **Une case non pré-cochée**, distincte de celle des conditions générales,
   avec le texte accessible **avant** de cocher.
3. **Une preuve conservée** : qui, quand, quelle version. C'est le point qu'on
   oublie — sans cette trace, l'acceptation est invérifiable le jour exact où
   elle compte.

> **Déjà construit.** Le mécanisme existe dans l'application : documents
> versionnés, cases jamais pré-cochées, et preuve conservée jusqu'à l'empreinte
> du texte exact accepté. **Les textes juridiques, eux, restent à écrire par un
> juriste** — ce sont des canevas sans valeur en l'état.

Dernier point : quand vous changerez de fournisseur d'IA, vous devrez **prévenir
les artisans à l'avance** et leur laisser la possibilité de s'y opposer.

---

## 6. Le dépôt est public : n'importe qui peut-il voler notre travail ?

### Ce que ça n'autorise pas

**Le code est protégé par le droit d'auteur dès son écriture.** Aucun dépôt à
faire, aucune formalité : il est à vous automatiquement.

Public ne veut pas dire libre de droits. Sans licence — et il n'y en a aucune
dans le dépôt aujourd'hui — personne n'a le droit de reprendre ce code, de le
modifier ou de le vendre. C'est « tous droits réservés » par défaut.

### Ce que ça permet quand même

**Lire, et copier dans les faits.** Un dépôt public peut être forké par
n'importe quel utilisateur GitHub — c'est accepté en le rendant public.

Surtout : la loi protège, mais elle ne défend pas toute seule. Poursuivre
quelqu'un qui copie coûte cher, prend des mois, et suppose de le retrouver.

### Ce qui compte vraiment

**La valeur n'est pas dans le code.** Un concurrent qui copierait tout n'aurait
ni les artisans, ni leurs grilles de tarifs, ni leur confiance, ni le service
qui va avec. Le code est reproductible ; la relation ne l'est pas.

**Le vrai risque du public n'est pas le vol, c'est la sécurité.** Un attaquant
peut étudier le code à loisir pour y chercher une faille : comment les jetons
sont fabriqués, où sont les vérifications, ce qui n'est pas contrôlé. Ça, c'est
concret.

### Les deux options, le jour où

| Option | Coût | Ce que ça règle |
|---|---|---|
| **Fichier LICENSE** « tous droits réservés » | 0 | Rend la position explicite au lieu d'implicite. Ne change pas qui peut lire |
| **GitHub Pro** | ~4 $/mois | Dépôt privé **et** site toujours en ligne : règle d'un coup le code, l'analyse RGPD et les documents internes |

> **Décision au 2026-08-01 : on laisse public.** Rien n'est déplacé, aucune
> licence ajoutée. À rouvrir si l'exposition devient gênante — l'option GitHub
> Pro reste de loin la moins chère.

---

## 7. Concrètement, quels problèmes pose le dépôt public ?

Complément de la question 6, qui répondait « le vol n'est pas le vrai risque »
sans dire lequel l'est.

### Les trois problèmes

**1. Le code serveur est lisible par tous.** Le plus concret. Un attaquant peut
l'étudier tranquillement pour chercher une faille : comment les jetons sont
fabriqués, où sont les vérifications, ce qui n'est *pas* contrôlé. Il n'a pas à
deviner, il lit.

**2. L'analyse RGPD est publique** — détaillée plus bas, c'est le point le moins
évident.

**3. Les documents internes sont publics.** Les coûts, l'exposition juridique,
les arbitrages. Et `AGENT.md`, qui expose la stratégie produit : ce qui est
construit, ce qui manque, où l'on va. Un concurrent y trouve une feuille de
route toute faite.

S'y ajoutent la configuration d'intégration continue et `.env.example`, qui
révèle quels fournisseurs sont utilisés.

### Ce qu'un dépôt privé ne protégerait PAS

Précision importante : dire que le privé « règle le code » est inexact.

L'appli statique publiée sur `github.io/Atlas-app/` est un site web. Son HTML et
son JavaScript sont lisibles par quiconque l'ouvre, dépôt privé ou non. C'est
inhérent au web, et aucun abonnement n'y change quoi que ce soit.

| | Dépôt public | Dépôt privé |
|---|---|---|
| Site en ligne | oui | **oui, même adresse** |
| Code serveur Next.js | lisible | **privé** |
| Documents internes | lisibles | **privés** |
| Analyse RGPD | lisible | **privée** |
| Appli statique dans le navigateur | lisible | lisible *(inévitable)* |

### Pourquoi l'analyse RGPD publique est gênante

`docs/RGPD.md` relève trois manques et l'écrit tel quel : **« État actuel : non
conforme »**.

**Avoir écrit ça est une bonne chose.** Devant la CNIL, un dossier qui recense
ses propres manques et le plan pour les combler vaut bien mieux que rien : ça
prouve une démarche, et c'est ce que le règlement attend. L'effacer serait une
erreur.

Le problème n'est pas le document, c'est sa visibilité. Comparaison : un carnet
d'entretien de camion où l'on note honnêtement « plaquettes à changer », c'est
exactement ce qu'il faut faire — mais on ne le scotche pas sur le pare-brise.

Trois choses échappent alors :

- **La maîtrise du moment.** Ce document se présente normalement quand on le
  demande, avec les corrections déjà en cours. Public, il se trouve à n'importe
  quel moment, y compris le pire.
- **Le choix du lecteur.** Pas seulement un contrôleur : un artisan qui hésite à
  confier son fichier clients, un concurrent qui cherche un argument, un client
  mécontent qui cherche un levier.
- **La nuance.** Le document dit aussi ce qui est déjà solide et ce qui est en
  cours. Celui qui tombe dessus retient trois mots.

**C'est temporaire.** Quand les trois écarts seront comblés, le document dira le
contraire et la gêne disparaîtra d'elle-même. La question n'est donc pas
« faut-il cacher quelque chose », mais « faut-il laisser ça lisible par tout le
monde pendant les quelques semaines où c'est encore vrai ».

---

## 8. Faut-il héberger l'application pour pouvoir l'essayer en entier ?

*Posée le 2026-08-01.*

**Non.** Vous pouvez essayer l'application entière, et la finir, sans l'héberger
nulle part. L'hébergement sert à **sortir** le produit, pas à le terminer.

### La confusion à dissiper d'abord

Deux choses portent le même mot et n'ont rien à voir :

| | Ce que c'est | Ce qu'il faut |
|---|---|---|
| **Un banc d'essai** | Un ordinateur qui monte pour vous dans le navigateur, le temps de vos essais | Votre compte GitHub, rien d'autre |
| **Un hébergement** | Une adresse permanente, ouverte à d'autres que vous | Un fournisseur, un contrat, 30 à 50 € par mois |

Le premier s'ouvre en cinq gestes — voir [`ESSAYER.md`](ESSAYER.md). Le second
est le point 3 du document [`A-FAIRE.md`](A-FAIRE.md).

### Ce que vous pouvez éprouver sans rien héberger

Tout ce qui fait le produit : le parcours du début à la fin, chaque écran,
chaque mot, chaque bouton, et les règles métier — les jours libres proposés au
client, les deux dates au maximum, le refus de facturer un devis jamais envoyé,
la reprise d'un devis retourné.

**Y compris la page du client, sur un vrai téléphone.** Dans l'espace de
travail, l'adresse est **publique dès la création** : le lien du devis est
ouvrable par n'importe qui. Vous l'envoyez à un proche, il choisit sa date depuis
son téléphone, et vous voyez le chantier se planifier. C'était auparavant un
réglage à faire à la main, impossible à viser sur un écran de téléphone — d'où
trois pages blanches d'affilée le 2026-08-01. **En contrepartie, n'y saisissez
que des données inventées** : l'adresse est ouverte à qui la possède, et le mot
de passe de démonstration est écrit dans ce dépôt public.

C'est là que se fait l'essentiel du travail de finition. Les six défauts trouvés
le 2026-08-01 l'ont tous été en regardant des écrans, jamais par un test vert.

### Les quatre choses qui échappent au banc d'essai

Aucune ne change ce que vous voyez à l'écran. Elles décident si le produit tient
dans la durée, pas s'il est juste.

| | Pourquoi cela ne se voit qu'hébergé |
|---|---|
| **La durabilité des fichiers** | Photos et enregistrements vont sur le disque du banc d'essai. En production ce mode est refusé au démarrage : c'est un autre code qui s'exécute |
| **Plusieurs machines à la fois** | La limite de connexions est partagée entre elles précisément pour cela. Avec une seule machine, le défaut ne peut pas apparaître |
| **Sauvegardes et restauration** | Ce sont des fonctions du fournisseur de base de données |
| **La charge réelle** | Un banc d'essai ne dit rien de dix artisans en même temps |

### Ce que l'hébergement apporte vraiment

Trois choses, et aucune ne s'appelle « essayer » :

1. **Une adresse permanente** — le banc d'essai s'arrête après trente minutes
   sans activité.
2. **D'autres utilisateurs que vous** — un artisan n'ouvrira pas un espace de
   développement.
3. **Le droit de confier de vraies données** — chiffrement, sauvegardes, et un
   contrat qui les garantit.

### Dans quel ordre s'y prendre

D'abord essayer, longuement. Il en sortira une liste de corrections — cela a été
le cas à chaque fois. Les traiter. Recommencer.

Quand plus rien ne gêne, l'hébergement devient utile : il ne servira plus à
finir le produit, mais à le sortir.

### La réserve qui vaut dans les deux cas

**Le devis part de votre messagerie, pas de l'application** — ni depuis le banc
d'essai ni depuis un hébergement. Le bouton ouvre votre SMS ou votre e-mail avec
le destinataire et le texte déjà remplis, et vous appuyez sur Envoyer. Décidé le
2026-08-03 ; le détail est au point 5 de [`A-FAIRE.md`](A-FAIRE.md), et cela ne
se règle pas non plus en hébergeant.

---

## 9. Ce que je vois là, est-ce le design final ?

*Posée le 2026-08-01.*

**Oui.** Même code, mêmes écrans, mêmes couleurs, mêmes polices. Ce que vous
avez sous les yeux n'est pas une approximation : c'est l'application. Rien ne
sera redessiné pour la publication.

### Trois choses changeront, toutes en mieux

| | Pendant les essais | Une fois installée |
|---|---|---|
| La barre d'adresse du navigateur | Présente, en haut | **Disparue** — plein écran |
| La vitesse | Chaque écran se compile à la volée | Instantané |
| Le badge noir « N » en bas à gauche | Présent | Disparu — c'est un outil de développement |

### La partie inattendue : deux chemins, pas un

Ce qui était relié à l'outil de fabrication iOS, c'étaient **les cinq maquettes
d'Arborea**, pas l'application. Publier en l'état aurait mis les maquettes sur
l'App Store. Le chemin existe, mais il restait à construire.

**Chemin A — l'App Store.** Une coque native qui affiche l'application
hébergée. Environ une journée de travail, mais elle suppose l'hébergement
d'abord, plus le compte Apple à 99 $ par an, plus un Mac, plus la validation
d'Apple à chaque mise à jour (voir question 1).

**Chemin B — sans App Store.** L'artisan ouvre l'adresse dans Safari, puis
« Ajouter à l'écran d'accueil ». Une icône apparaît, et l'application s'ouvre
**en plein écran, sans barre d'adresse — visuellement identique à une
application téléchargée**.

Coût : **zéro**. Pas de compte Apple, pas de Mac, pas de validation, et vos
corrections arrivent chez l'artisan immédiatement au lieu d'attendre Apple.

Ce que vous perdez : la vitrine de l'App Store. Pour un outil vendu par
abonnement à des artisans que vous démarchez, ce n'est pas là qu'ils vous
trouveront.

**Le chemin B est prêt** depuis le 2026-08-01 : icône, nom, ouverture en plein
écran. Il ne manque que l'hébergement, qui sert les deux chemins.

### Deux défauts corrigés à cette occasion

Ils ne se voyaient **que** sur un téléphone, une fois l'application installée —
jamais dans un navigateur d'ordinateur, jamais dans un test :

- **La barre d'état recouvrait le haut du contenu.** Le titre « VOS CHANTIERS »
  passait sous l'heure et la batterie.
- **L'indicateur d'accueil mangeait le bas de la navigation.** Les libellés
  « Chantiers / Planning / Terminés / Tarifs » se retrouvaient dessous.

Vérifiés en simulant un iPhone à encoche, pas en relisant le code.

### L'icône est provisoire

Un « A » en forme de chevron de charpente, dans les couleurs de l'application.
Volontairement simple : une icône provisoire qui chercherait à bien faire donne
l'illusion d'une décision prise, et personne ne la remplace jamais.

Pour la changer : remplacer `public/icone-source.svg` et lancer `npm run icones`.
Toutes les tailles se régénèrent d'un trait — un jeu d'icônes retouché taille
par taille finit toujours par diverger.

---

## 10. Qui voit quoi : moi, mes clients, leurs salariés ?

*Question posée le 7 août 2026, en construisant la page « Le vocabulaire de mon
métier ».*

### Le point de départ

> *« Est-ce que les utilisateurs auront accès à cette page ? Moi c'est ça que je
> ne veux pas. Je veux qu'il y ait mon application avec mon compte à moi, et
> ensuite qu'on crée un profil entreprise — c'est ce profil-là qu'on va vendre.
> Et il faut aussi que les entrepreneurs, au sein de leur profil entreprise,
> puissent avoir des profils pour leurs salariés : par exemple juste le planning
> et les devis, mais sans les prix. »*

### Trois niveaux, et pas deux

| Qui | Ce qu'il voit |
|---|---|
| **Vous, l'éditeur** | Tout, **plus** le vocabulaire du métier — qui sert à tous vos clients sans qu'ils y touchent |
| **Le patron d'une entreprise** — *ce qui se vend* | Toute son entreprise : chantiers, planning, devis, prix, factures, TVA, réglages, ses tarifs |
| **Le salarié** | Le planning et les chantiers, les devis **sans aucun montant** |

### Ce qui appartient au produit, et ce qui appartient au client

C'est la distinction qui commande tout le reste.

**Va avec l'application, chez tous vos clients :**

- **le vocabulaire du métier** — « charpentière champignonnée », « fendre en
  50 », « taille de cohabitation ». Ce sont des mots, pas des données de client :
  aucun nom, aucune adresse, aucun prix. C'est ce qui les rend partageables sans
  le moindre risque ;
- **vos règles de chiffrage**, dont celle-ci, que vous avez décidé de faire
  partir avec l'application (7 août 2026) :

  > *Chaque ligne doit pouvoir se vendre seule. Une prestation détachable — la
  > fente, l'évacuation, le dessouchage — porte son propre déplacement et sa
  > mise en œuvre, jamais son seul coût marginal. Ne pas ventiler au prorata du
  > temps : alléger la ligne principale, charger la détachable.*

  Le pourquoi, dans vos mots : *« si le client ne veut pas la fente, il va
  trouver le reste cher ; et s'il fait faire le reste par un autre artisan et
  nous prend juste pour la fente, 100 € ce n'est pas assez. »*

**Reste chez chaque client, et ne se partage jamais :**

- **la mémoire de ses corrections** — ce qu'il avait dicté, ce qu'il a
  finalement écrit sur son devis. C'est fait de ses chantiers, de ses libellés
  et de ses prix ;
- ses tarifs, ses clients, ses documents. Rien de tout cela ne traverse d'une
  entreprise à l'autre : c'est ce que garantit l'isolation posée en base
  (`ARCHITECTURE.md` §1).

### « Sans les prix » ne peut pas être un masquage à l'écran

Le point sur lequel il ne faut pas transiger. Cacher un montant dans la page ne
le retire pas de ce que la page a reçu : un salarié qui ouvre l'adresse du PDF,
ou qui regarde ce que son téléphone a téléchargé, verrait tout.

**Les montants ne doivent pas sortir du serveur** pour qui n'a pas le droit de
les voir — ni dans la page, ni dans le PDF, ni dans une réponse d'API. C'est
plus de travail qu'un test dans l'affichage, et c'est la seule version honnête :
un salarié qui découvre votre marge parce qu'il a su regarder, c'est pire que
pas de restriction du tout, puisque vous vous croyiez protégé.

### Ce qui reste à trancher

**Le salarié voit-il le planning de toute l'entreprise, ou seulement ses
chantiers à lui ?** Question posée le 7 août 2026, réponse remise à plus tard :
*« attends, fais déjà tout le reste, on en reparle après. »* Elle change le
travail et elle change ce qui se vend.

---

## 11. Qu'est-ce qu'Atlas doit faire sur la plateforme de facturation ?

*Question posée le 8 août 2026, après que j'ai demandé si une plateforme de
facturation électronique était en vue.*

### La réponse courte : rien, et c'est une décision, pas un oubli

Elle a été prise le 31 juillet 2026 et elle tient. `AGENT.md` §6, mot pour mot :

> La facturation électronique conforme (numérotation inviolable, archivage,
> Factur-X/UBL/CII, obligations 2026/2027) est un projet à part et un risque
> juridique. On s'y branche par **API** sur un outil existant (Pennylane,
> Evoliz, Tiime, Sellsy, Abby…).

Et la ligne qui suit, qui est la vraie règle :

> **Le rôle de l'agent est donc de préparer, pas d'émettre.**

Atlas rassemble les lignes, le client, les taux, la période. L'outil comptable
émet le document légal **et en porte la responsabilité**. C'est inscrit comme
définitif dans `MVP.md` — « hors périmètre définitivement, pas *pas encore* ».

**Pourquoi on ne le recode pas.** Une facture non conforme n'est pas un défaut
d'affichage, c'est un risque légal pour l'artisan. Et une numérotation cassée
ne se rattrape pas après coup : elle se traîne sur tout un exercice.

### Ce que je dois faire, alors

Une seule chose, et c'est le point 6 de la liste de `AGENT.md` §9 : **brancher
l'outil comptable par API**. Concrètement, le jour où vous en avez un — envoyer
vers lui ce qu'Atlas a déjà préparé, récupérer le numéro et le document qu'il a
émis.

C'est un lot de travail ordinaire, quelques jours. Il ne peut pas commencer
avant que l'outil soit choisi : chacun a son API.

### Ce qui existe déjà dans Atlas

| | |
|---|---|
| Facture pré-remplie depuis le devis | fait — c'est l'arrêt 3, un appui si rien n'a bougé |
| Numérotation `F2026-0001`, continue, sans trou | fait — un compteur par entreprise, incrémenté d'un seul coup en base |
| PDF de la facture | fait |
| Relevé de TVA collectée | fait — calculé à partir des factures émises |

### Ce qui n'existe pas, et qu'il ne faut pas croire acquis

- **Aucun format d'échange** : ni Factur-X, ni UBL. Le PDF d'Atlas est un PDF,
  pas une facture électronique au sens de la réforme.
- **Aucun archivage à valeur probante.** La numérotation est continue, ce qui
  est le minimum, mais rien ne prouve qu'un enregistrement n'a pas été modifié
  après coup.
- **Aucun raccordement** à une plateforme agréée, ni à l'annuaire des
  destinataires.

### Le point qui a une date — et qui vous concerne vous, pas Atlas

La réforme oblige d'abord à **recevoir** ses factures fournisseurs par une
plateforme agréée, puis, plus tard, à **émettre** les siennes. Les échéances
annoncées sont **septembre 2026** pour la réception et **septembre 2027** pour
l'émission des petites entreprises.

Deux réserves, posées franchement :

1. **Ce calendrier a déjà été décalé deux fois**, et je ne peux pas le vérifier
   depuis l'environnement de développement — son mandataire réseau refuse les
   sites publics. **À confirmer par un comptable**, pas par moi.
2. **Cela vous concerne comme entreprise, pas comme éditeur.** Eden Nature
   devra passer par une plateforme agréée pour ses propres factures, qu'Atlas
   existe ou non. Et chaque artisan qui utilisera Atlas aussi.

C'est une raison de plus de brancher un outil comptable plutôt que d'en
réécrire un : l'outil, lui, sera à jour de la réforme — c'est son métier, et
c'est ce que vous lui payez.

### Où ça en est

**Vous n'avez aucun logiciel de comptabilité aujourd'hui** (réponse du 8 août
2026). La question devient donc : lequel prendre. Elle est ouverte au point 6
de [`A-FAIRE.md`](A-FAIRE.md), avec ce que je peux préparer et ce que vous seul
pouvez signer.

**Ce que ça ne bloque pas** : ni l'essai d'Atlas, ni sa finition. Comme les
autres points de `A-FAIRE.md`, cela bloque le fait de le confier à un vrai
artisan avec de vrais clients.
