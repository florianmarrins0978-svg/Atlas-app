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
12. [L'agenda Google : mes artisans auront-ils des identifiants à saisir ?](#12-lagenda-google--mes-artisans-auront-ils-des-identifiants-à-saisir-)
13. [Pourquoi tous les boutons ont-ils la même forme ?](#13-pourquoi-tous-les-boutons-ont-ils-la-même-forme-)
14. [Le Calendrier d'Apple : puis-je le relier comme l'agenda Google ?](#14-le-calendrier-dapple--puis-je-le-relier-comme-lagenda-google-)
15. [Ma TVA, je la déclare tous les mois ou tous les trimestres ?](#15-ma-tva-je-la-déclare-tous-les-mois-ou-tous-les-trimestres-)
16. [L'IA se sert-elle de mes réglages pour faire les devis ?](#16-lia-se-sert-elle-de-mes-réglages-pour-faire-les-devis-)
17. [Le « deuxième cerveau » : ce qui apprend déjà, et ce qui ne retient rien](#17-le--deuxième-cerveau---ce-qui-apprend-déjà-et-ce-qui-ne-retient-rien)
18. [À quoi sert le catalogue, et pourquoi je ne peux rien y écrire ?](#18-à-quoi-sert-le-catalogue-et-pourquoi-je-ne-peux-rien-y-écrire-)
19. [Si un client ne me paie pas, la TVA part quand même ?](#19-si-un-client-ne-me-paie-pas-la-tva-part-quand-même-)

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

### Tranché le 13 août 2026 : quatre rôles, et une portée qui se règle par personne

**Le salarié voit-il le planning de toute l'entreprise, ou seulement ses
chantiers à lui ?** Question posée le 7 août, réponse remise (*« attends, fais
déjà tout le reste, on en reparle après »*), puis donnée le 13 août :

> *« Accès à tout, mais le patron choisira s'il a accès qu'à ses chantiers ou à
> tout. »*

**Ce n'est ni l'une ni l'autre des deux options proposées.** C'est un réglage
**par personne**, posé sous le rôle du salarié : deux salariés peuvent ne pas
voir la même chose. Et **le défaut est « tout »** — un salarié invité ce matin
voit le planning entier tant que son patron n'a rien restreint. Restreindre est
un geste, pas un état de départ.

**Un quatrième rôle est ajouté le même jour : le commercial.** Il vend, il
n'engage pas.

| Qui | Ce qu'il voit |
|---|---|
| **Vous, l'éditeur** | Tout, **plus** le vocabulaire du métier |
| **Le patron** — *ce qui se vend* | Toute son entreprise, sans exception |
| **Le commercial** | Les chantiers, le planning, les devis **et les prix** — il en a besoin pour vendre. Ni les factures, ni la TVA, ni l'IBAN, ni les accès, ni l'abonnement. Il lit les tarifs, il ne les change pas |
| **Le salarié** | Le planning et ses chantiers, les devis **sans aucun montant**. Le patron choisit s'il voit tout le planning ou ses seuls chantiers |

**Attention à un mot qui trompe :** dans Atlas, une « équipe » n'est pas un
groupe de personnes, c'est une **file du planning** — combien de chantiers
partent en même temps. « Équipe B » peut désigner deux ouvriers qui n'ouvriront
jamais l'application ; un commercial a un compte et ne conduit aucun chantier.
Les réglages tiennent donc **deux listes séparées** : *qui a accès*, et *vos
équipes*.

### Ce qui reste vrai, et qui n'est pas encore fait

**Rien de ce tableau n'est en place au 13 août 2026.** La base ne connaît que
deux rôles (propriétaire et membre), aucun écran ne permet de donner un accès,
et surtout **rien ne filtre ce qui est envoyé** : un membre voit aujourd'hui
tous les prix et tous les montants. Le dessin de ces écrans existe
(`maquettes/atlas-reglages-equipe.html`) ; le code, non.

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

---

## 12. L'agenda Google : mes artisans auront-ils des identifiants à saisir ?

*Posée le 9 août 2026 :* « une fois que j'aurai créé la clé API pour l'agenda
Google, les utilisateurs, quand je vais commercialiser l'application, eux, ils
auront juste à rentrer leurs identifiants, c'est tout ? »

### Non — et c'est plus simple que ça pour eux

Il y a **deux choses différentes** derrière le mot « identifiants », et les
confondre fait imaginer un parcours invendable.

| | Ce que c'est | Qui s'en occupe |
|---|---|---|
| **Les identifiants de l'application** (client ID + secret) | L'identité d'Atlas auprès de Google. Ce n'est pas un compte utilisateur | **Vous, une seule fois, pour tous** |
| **Le compte Google de l'artisan** | Son agenda à lui | **Lui** — mais il n'a rien à taper |

Concrètement, pour un artisan qui achète Atlas : il ouvre son planning, appuie
sur « Relier mon agenda Google », l'écran de Google s'ouvre, il se connecte
comme partout ailleurs, il accepte. **Fin.** Aucun projet Google à créer, aucun
mot à comprendre.

**Alors à quoi servent les trois cases dans « Mon agenda » ?** À vous,
aujourd'hui, tant qu'aucune configuration n'est posée sur le serveur — et plus
tard à l'artisan qui voudrait son propre projet Google. L'application regarde
d'abord ce que l'entreprise a saisi, et retombe sur votre configuration sinon.
Vos artisans ne verront jamais ces cases.

### Ce que ça coûte

**Rien en argent.** Le projet Google est gratuit, l'API Agenda est gratuite, et
son quota libre est très au-delà de ce qu'une centaine d'artisans
consommeraient.

### Le vrai obstacle, et il n'est pas technique

**Tant que Google n'a pas validé l'application, l'accès est limité à une
centaine de comptes que vous inscrivez à la main.** Suffisant pour vous et vos
premiers artisans ; bloquant au cent-unième.

Pour aller au-delà, Google demande une vérification :

| Ce qu'il faut | Remarque |
|---|---|
| Un nom de domaine dont vous prouvez la propriété | Il vous en faudra un de toute façon |
| Une politique de confidentialité **en ligne** | Le contenu existe déjà (`docs/RGPD.md`), il faut la publier |
| Une page d'accueil publique | Idem |
| Une vidéo montrant l'usage que vous faites de l'agenda | Quelques minutes d'écran |
| **Plusieurs semaines de délai** | C'est le vrai coût |

**Une réserve, écrite parce qu'elle compte.** À ma connaissance, l'agenda relève
des permissions dites « sensibles » — vérification gratuite mais longue — et non
des « restreintes », qui exigent en plus un audit de sécurité payant. **Je n'ai
pas pu le confirmer** : le réseau de l'environnement de développement refuse les
pages de Google. À vérifier avant d'annoncer une date de lancement.

### Ce qu'il faut en retenir pour le calendrier

**Lancez la demande de vérification tôt**, pas la semaine où vous voulez vendre.
C'est le genre de délai qui ne se rattrape pas.

---

## 13. Pourquoi tous les boutons ont-ils la même forme ?

*Posée le 11 août 2026 :* « comment ça ce bouton est sur vingt-sept écrans ? tu
peux m'expliquer » — puis, le lendemain, en voyant sur la feuille d'envoi de son
devis un bouton carré à côté d'une capsule : « remplace tous les boutons
rectangulaires par les boutons arrondis ».

### La réponse courte

**Parce qu'une forme est une phrase.** Dans Atlas, la capsule pleine, en vert
pin, veut dire exactement une chose : *appuie ici, c'est l'action de cet écran*.
Si deux écrans la disent avec deux dessins différents, il faut la réapprendre à
chaque fois — et surtout, on doute : *est-ce que celui-là fait vraiment la même
chose ?*

C'est aussi pour cela que **les champs et les cartes gardent leurs coins presque
droits** (4 px). Le rayon n'est pas une décoration, c'est un panneau : arrondi
plein = on touche, presque droit = on lit. Tout arrondir aurait effacé la
distinction.

### Une correction, parce que je vous ai donné un faux chiffre

**« Vingt-sept écrans » était faux, et c'est moi qui l'ai écrit.** J'avais compté
les fichiers, pas les écrans — les huit maquettes de travail (`/design/…`), qui
ne sont pas votre application, étaient dans le tas.

Le vrai décompte, au 12 août 2026 :

| | Combien |
|---|---|
| Écrans du produit qui portent le bouton partagé | **8** (11 boutons) |
| Écrans d'erreur, qui le prennent par une pièce commune | **9** (1 bouton) |
| Maquettes de travail, hors application | 8 |
| **Total réel dans votre application** | **17 écrans** |

Le code ne porte plus le chiffre, il porte **la commande pour le recompter** —
un nombre écrit à la main dans un commentaire est faux le mois suivant, et
personne ne le vérifie.

### Pourquoi la capsule, et pas autre chose

Vous avez choisi la cinquième de huit propositions dessinées le 11 août
(maquette 28). Le bouton d'avant pesait par **trois** choses à la fois, et vous
n'en avez nommé qu'une — « trop gros, carré, pas esthétique » :

| Ce qui pesait | Avant | La capsule |
|---|---|---|
| La hauteur | 58 px, près d'un dixième de votre écran | 43 px |
| La largeur | il touchait les deux marges, donc rien ne le contenait | juste la largeur du mot |
| La forme | presque droite, 5 px de rayon | pleinement arrondie |

Elle est **plus petite que ce qu'elle remplace**, alors qu'elle a l'air plus
présente : c'est la largeur libre qui fait ça, pas la taille.

**Une chose à savoir sur la comparaison que je vous avais montrée d'abord :
elle mentait.** J'avais découpé chaque bouton au ras, et deux boutons de
largeurs différentes affichés dans deux colonnes de même largeur donnent
l'impression inverse de la vérité — la capsule paraissait plus grosse. La
planche a été refaite en photographiant l'écran entier.

### Ce qui empêche que ça reparte dans tous les sens

Le 12 août, trois écrans dessinaient encore leur bouton à la main : ils avaient
été écrits avant la capsule et ne l'avaient jamais su. **C'est vous qui l'avez
vu, pas nous** — d'où un contrôle automatique
(`scripts/test-boutons-arrondis.ts`) qui refuse désormais tout bouton
rectangulaire ajouté dans l'application. Il tourne à chaque livraison.

Il ne regarde que **la forme**, volontairement : deux boutons (la connexion, les
documents légaux) doivent rester des boutons de formulaire, et les forcer à
passer par la pièce commune casserait leur envoi. La forme, elle, est la même
pour tous.

### Ce que ça vous coûte quand vous changez d'avis

**Un seul fichier à toucher**, `src/components/atlas/PrimaryButton.tsx` : les 17
écrans suivent. C'est tout l'intérêt d'avoir une pièce commune plutôt que
dix-sept dessins — le jour où la capsule ne vous plaît plus, ce n'est pas
dix-sept corrections, c'en est une.

---

## 14. Le Calendrier d'Apple : puis-je le relier comme l'agenda Google ?

*Posée le 12 août 2026*, capture du Calendrier d'Apple à l'appui : « je peux
connecter ce calendrier à mon appli ? »

### Oui — mais ce n'est pas le même travail que Google

**D'abord, une distinction qui change tout : le Calendrier d'Apple n'est qu'une
vitrine.** Il affiche aussi bien un compte iCloud qu'un compte Gmail ou un compte
professionnel. Ce n'est donc pas « le Calendrier » qu'on relie, c'est le compte
qui est derrière.

| Ce qu'il y a derrière la vitrine | Ce que ça coûte |
|---|---|
| Un compte **Google** | **Rien à écrire.** Le code existe déjà ; il reste vos identifiants Google ([A-FAIRE §7](A-FAIRE.md)) |
| **iCloud** | Un fournisseur en plus, et un parcours moins confortable — voir ci-dessous |
| **Outlook / Exchange** | Un troisième raccordement, encore différent |

**Vous avez répondu iCloud**, et vous voulez **les deux sens** : qu'Atlas lise
vos rendez-vous, et qu'il y écrive vos chantiers.

### Pourquoi Apple demande plus de gestes que Google

Chez Google, l'artisan appuie sur un bouton, l'écran de Google s'ouvre, il
accepte, c'est fini — il n'a rien à taper (voir question 12).

**Apple n'offre pas d'équivalent pour l'agenda.** Le bouton « Se connecter avec
Apple » existe, mais il ne donne accès qu'à une identité, jamais au calendrier.
Le seul chemin praticable est le protocole *CalDAV*, avec un **mot de passe
spécifique à l'application** que vous générez sur votre compte Apple.

| | Google | iCloud |
|---|---|---|
| Ce que l'artisan fait | Il appuie, il accepte | Il va sur son compte Apple, génère un mot de passe de 16 caractères, le recopie dans Atlas |
| Ce qu'Apple exige | — | La double authentification activée sur le compte |
| Écrire dans l'agenda | Possible, permission à part | Possible, sans permission supplémentaire |
| Portée de l'accès | **L'agenda seul** | **Tout l'iCloud** — mail, contacts, fichiers |

### Les trois réserves, écrites parce qu'elles comptent

**1. Le mot de passe ouvre tout l'iCloud, pas seulement l'agenda.** Apple ne
sait pas restreindre un mot de passe spécifique à un seul service. Atlas le
chiffre au repos comme il chiffre les jetons Google
(`src/server/agenda/secret-au-repos.ts`), mais le chiffrement protège d'une
sauvegarde recopiée, pas de l'étendue de ce que la clé ouvre. C'est la vraie
différence avec Google, et elle ne se corrige pas côté Atlas.

**2. Apple ne documente pas publiquement ce canal.** Il fonctionne depuis des
années et de nombreux logiciels s'en servent, mais il n'y a **aucun engagement**
d'Apple : cela peut cesser du jour au lendemain, sans préavis. Le raccordement
Google, lui, repose sur une interface publique et versionnée.

**3. Écrire est un geste qui ne se reprend pas tout seul.** Atlas posera des
rendez-vous dans votre agenda personnel. Il ne touchera **jamais** ce qui ne
vient pas de lui, et ce qu'il a posé se retire d'un geste — mais c'est une
décision, pas un réglage par défaut.

### Ce que ça coûte en argent : rien

Et sur ce point, **Apple est moins cher que Google** : pas de compte
développeur, pas d'écran de consentement à faire valider, pas de plafond de cent
comptes de test, **pas de semaines d'attente**. Là où Google impose une
vérification avant de commercialiser ([A-FAIRE §8](A-FAIRE.md)), iCloud ne
demande la permission de personne.

### Ce que je n'ai pas pu vérifier d'ici

**Le réseau de l'environnement de développement refuse `caldav.icloud.com`** —
essayé le 12 août 2026, connexion refusée. Tout ce qui touche au comportement
réel d'Apple devra donc être éprouvé **sur votre banc d'essai**, pas ici. C'est
la même situation que pour Google, et elle se traite pareil : la logique qui
décide vit dans un module qui ne parle à personne et qui, lui, s'éprouve
entièrement ici.

### Ce qui a été fait le jour même

Vous avez répondu *« code pour qu'on puisse lire et écrire dans cet agenda »* —
c'est écrit. Vous collez votre adresse iCloud et le mot de passe pour les apps ;
Atlas trouve vos agendas, cesse de proposer les demi-journées déjà prises, et —
**si vous l'allumez** — pose vos chantiers dans le calendrier que vous désignez.
Débrancher les retire.

**Ce qui n'a PAS pu être vérifié, et qu'il faut lire comme tel :** aucun échange
réel avec iCloud n'a eu lieu ici — le réseau de l'environnement de
développement le refuse. Les contrôles couvrent tout ce qui *décide* ; ce qui
reste à éprouver, c'est le dialogue avec Apple lui-même, et cela demande votre
compte. **Attendez-vous à un premier essai qui échoue** : ce sera dit à l'écran,
avec la phrase d'Apple telle quelle.

### Ce que ça ne change pas

Ce qui décide quelles demi-journées sont prises, et comment elles se fondent
dans votre planning, est **commun à tous les agendas** et ne bouge pas d'une
ligne (`src/lib/agenda-externe.ts`). Le nouveau code n'ajoute qu'une chose : la
manière d'aller chercher les rendez-vous. Deux fournisseurs, une seule règle —
c'est ce qui évite que le planning finisse par répondre différemment selon le
calendrier branché.

## 15. Ma TVA, je la déclare tous les mois ou tous les trimestres ?

*Posée le 2026-08-12.* Vous aviez raison de le demander : l'écran était découpé
en trimestres, et personne n'avait écrit pourquoi.

### La réponse courte

**Tous les mois, par défaut.** La déclaration de TVA au régime réel normal —
le formulaire CA3 — est mensuelle. Le trimestre n'est pas un choix libre : c'est
une **option**, ouverte seulement si votre TVA due de l'année précédente est
**inférieure à 4 000 €**. Au-dessus, on revient au mois.

### Ce qui change en 2027, et qui vous concerne

Il existe encore aujourd'hui un troisième cas : le **régime réel simplifié**,
une déclaration annuelle avec deux acomptes en juillet et décembre. **Il
disparaît au 1er janvier 2027** — voté à l'article 38 de la loi de finances pour
2025 (loi n° 2025-127 du 14 février 2025), ses modalités ajustées par celle pour
2026. Toutes les entreprises basculent alors au réel normal : mensuel ou
trimestriel.

Autrement dit, **la question « mois ou trimestre » sera la seule qui se pose**.
C'est pour cela que l'application ne propose que ces deux-là.

### Ce qu'Atlas ne vous dira jamais, et pourquoi

**Lequel des deux vous concerne.** Le seuil des 4 000 € porte sur la TVA
**due** : ce que vous avez collecté *moins* ce que vous déduisez sur vos achats.
Atlas ne connaît que la première — il ne voit ni votre gazole, ni votre
tronçonneuse, ni votre assurance.

Il ne peut donc pas calculer si vous avez droit au trimestre, et il ne doit pas
le laisser croire. C'est la même règle que pour les prix : sans source fiable,
on n'écrit pas. **Votre comptable tranche ; l'application obéit.**

### Où ça se règle

**Réglages → Votre TVA**, deux boutons : « Tous les mois » ou « Tous les
trimestres ». Le mois est coché d'avance, puisque c'est le défaut légal. L'écran
de TVA et son calendrier suivent votre choix — douze mois d'un côté, quatre
trimestres de l'autre.

---

## 16. L'IA se sert-elle de mes réglages pour faire les devis ?

*Question posée le 13 août 2026, en dessinant l'écran des tarifs.*

### Oui — et dans un ordre précis, qui ne laisse aucune place à l'invention

Quand Atlas doit mettre un prix sur une ligne, il fait toujours la même chose,
dans cet ordre :

| | Ce qu'il fait |
|---|---|
| **1** | Il cherche dans **vos tarifs**. Un seul correspond : il le prend, tel quel |
| **2** | Plusieurs correspondent : **il ne choisit pas**. Il vous les montre et vous laissez trancher |
| **3** | Aucun ne correspond : il **calcule** avec vos coûts (durée × ouvriers × coût journalier, + le chef, + le déplacement, + votre marge) |
| **4** | Il ne peut pas calculer : il écrit **« prix à renseigner »** et se tait |

Le code le dit dans ces mots : *« jamais de prix inventé, jamais de choix
arbitraire »*.

### Ce qui ne part JAMAIS chez un fournisseur d'IA

**Votre identité — nom, adresse, SIRET, IBAN — n'est jamais envoyée au modèle.**
Elle est recopiée dans le document au moment où il est créé, c'est tout. Ce qui
identifie votre entreprise et votre banque ne sort pas de chez vous.

Ce qui sert au modèle, en revanche : **le vocabulaire du métier** (les mots, pour
comprendre votre dictée) et **ce que vous avez chiffré par le passé**.

### Le problème que cette question a fait apparaître

Le calcul du point 3 s'appuie sur **cinq chiffres enregistrés pour votre
entreprise** :

| | Valeur posée aujourd'hui |
|---|---|
| Un ouvrier, à la journée | 200 € |
| Un chef d'équipe, à la journée | 280 € |
| Déplacement, au forfait | 35 € |
| Votre marge | 20 % |
| TVA par défaut | 20 % |

**Aucun écran ne permet de les changer.** Ils décident pourtant du prix proposé
chaque fois qu'aucun tarif ne correspond. Un artisan dont l'ouvrier coûte 260 €
par jour verra donc des prix trop bas — **sans jamais savoir d'où ils viennent**.

C'est pire qu'un réglage absent : c'est un réglage qui existe, qui agit, et qu'on
ne peut pas voir. L'écran est dessiné
(`maquettes/atlas-reglages-tarifs.html`) ; il reste à le coder.

---

## 17. Le « deuxième cerveau » : ce qui apprend déjà, et ce qui ne retient rien

*Direction posée par le patron le 13 août 2026 :*

> *« L'idée, c'est de créer un deuxième cerveau au sein de l'application, pour
> qu'elle s'utilise comme un assistant de gestion / devis, facture, planning.
> Elle doit apprendre, enregistrer, s'améliorer, s'auto-alimenter. »*

C'est la suite d'une phrase plus ancienne, et il faut les lire ensemble :
*« si l'appli n'a aucune mémoire, comment l'IA va enregistrer et se souvenir ?
Pour s'améliorer, elle a besoin de mémoire. »*

### Le piège déjà payé une fois, et qu'il ne faut pas refaire

Une table `historique_prix` existait. Le chiffrage la **lisait**. Et
**l'application ne l'écrivait jamais**. Une mémoire que personne n'alimente n'est
pas une mémoire — c'est du décor.

**La bonne question n'est donc pas « avons-nous une base pour retenir ? », mais
« qui l'écrit, et quand ? »** Chaque fois qu'on parlera d'apprentissage, c'est
cette question-là qu'il faudra poser en premier.

### Ce qui apprend vraiment aujourd'hui

| Ce qui apprend | Ce qu'il retient | Alimenté ? |
|---|---|---|
| **La mémoire des prix** | Ce que vous avez **réellement** facturé sur un chantier comparable — rappelé sur le suivant | **oui** |
| **Les cinq grilles** | Abattage, fendage, dessouchage, haie, grumes : elles se remplissent de vos devis | **oui** |
| **La base documentaire** | Des fragments de texte indexés, réutilisables par l'agent | **oui** |

Un point de méthode important : le prix retenu est présenté comme un **rappel**,
jamais comme un calcul. *« Vous aviez facturé 180 € »* se vérifie d'un coup
d'œil ; *« ça fait 180 € »* demande qu'on fasse confiance.

### Ce qui ne retient rien, et qui manque au deuxième cerveau

- **Vos coûts** (question 15) : figés à des valeurs d'usine, ni réglables ni
  apprises.
- **Le temps réel des chantiers.** Rien n'enregistre combien de temps un chantier
  a *vraiment* pris. Atlas ne peut donc pas savoir si ses estimations de durée
  sont justes — or c'est la durée qui fait le prix au point 3. **C'est le manque
  le plus lourd**, et le plus facile à combler : une question à la clôture d'un
  chantier suffirait.
- **Les délais de paiement.** Rien ne retient qu'un client règle à 45 jours quand
  il en a promis 30.
- **Ce que le client refuse.** Un devis corrigé ou refusé porte une information
  de prix ; elle n'est pas retenue.

### Ce que ça veut dire concrètement

Le deuxième cerveau **existe déjà en partie** : les prix, les grilles, les
documents. Ce qui lui manque, ce ne sont pas des idées, ce sont **des moments où
l'application demande** : à la fin d'un chantier, à la réception d'un paiement,
au refus d'un devis. Chaque moment est un lot de quelques jours ; chacun rend
l'agent plus juste sur le devis suivant.

---

## 18. À quoi sert le catalogue, et pourquoi je ne peux rien y écrire ?

*Question posée le 14 août 2026, capture de l'écran « Catalogue » à l'appui.*

### Ce que c'est

**Le vocabulaire du métier, partagé par toutes les entreprises qui utilisent
Atlas.** Chaque entrée porte un nom officiel et tous les mots qui veulent dire la
même chose : « Élagage » y traîne derrière lui *abattage*, *démontage*,
*dessouchage*, et les variantes *sapin*, *arbre*, *conifère*.

### À quoi ça sert, concrètement

À **comprendre ce que vous dictez**. Quand vous dites *« faut me démonter le
sapin du fond »*, aucun mot de la phrase n'est « élagage » — c'est le catalogue
qui fait le rapprochement. Sans lui, la dictée ne se rattache à rien et l'agent
ne sait pas quelle prestation écrire sur le devis.

**Il ne porte aucun prix**, et c'est voulu. Vos prix vivent ailleurs :

| Où | Ce qu'on y trouve |
|---|---|
| **Mes tarifs** | Ce que vous tapez à la main : un intitulé, un montant, une unité |
| **Mes prix** | Les cinq grilles du métier — abattage, fendage, dessouchage, haie, grumes |
| **La mémoire des prix** | Ce que vous avez réellement facturé, rappelé sur le chantier suivant (question 17) |
| **Le catalogue** | Des **mots**, rien d'autre |

### Pourquoi vous ne pouvez rien y écrire

Parce qu'il est **commun à tout le monde**. Une ligne ajoutée depuis votre
téléphone changerait le vocabulaire de tous les autres artisans, sans qu'ils
l'aient demandé ni qu'ils puissent la corriger. Aujourd'hui, il n'est donc rempli
que par Atlas.

Ce n'est pas un refus définitif : on peut très bien lui ajouter **vos** mots à
vous, visibles de vous seul, par-dessus le vocabulaire commun. Ça n'existe pas
encore, personne ne l'a demandé jusqu'ici.

### Deux défauts que la capture a révélés, le même jour

| Défaut | La vérité |
|---|---|
| **Pas de flèche de retour** | Simple oubli. L'en-tête de l'écran sait afficher la flèche — la page ne la lui a jamais demandée. On y arrive depuis *Tarifs & catalogue*, et on en repart par la barre du bas. |
| **« Aucun prix encore constaté par votre entreprise »** | **Cette phrase ne changera jamais**, quoi que vous fassiez. |

La seconde mérite d'être expliquée, parce qu'elle est exactement le piège décrit
en question 17 — et qu'il traîne encore ici.

**Il y a eu deux mémoires des prix.** La première (`historique_prix`) n'était
jamais écrite : le fameux décor. Elle a été remplacée par une seconde
(`lecons_prix`), celle qui marche vraiment, qui retient ce que vous facturez et
vous le rappelle sur le chantier d'après.

**L'écran du catalogue, lui, est resté branché sur l'ancienne.** Il interroge une
mémoire vide, et annonce donc fidèlement qu'elle est vide. Vos prix sont bien
retenus — c'est cet écran-là qui regarde au mauvais endroit.

**Ce qu'il reste à faire :** remettre la flèche, et rebrancher l'écran sur la
bonne mémoire. Les deux sont inscrits dans `TODO.md` §0 octovicies bis, en
attente de votre feu vert — rien n'a encore été touché.

---

## 19. Si un client ne me paie pas, la TVA part quand même ?

*Question posée le 14 août 2026 : « à partir du moment où j'envoie la facture à
mon client, elle rentre automatiquement dans mon relevé de TVA. Sauf que s'il
décide de ne pas me payer, je vais avoir des problèmes. »*

### La réponse courte

**Votre inquiétude est fondée, et la loi est de votre côté.** Pour une
**prestation de services** — ce que vous vendez —, la TVA est exigible **quand
vous êtes payé**, pas quand vous facturez. C'est le régime par défaut
(article 269-2-c du code général des impôts).

Encaisser la TVA sur un chantier qu'on ne vous a pas réglé, ça n'existe pas :
tant que l'argent n'est pas rentré, l'État n'attend rien.

### Alors pourquoi Atlas la compte à l'émission ?

Parce qu'il a été écrit ainsi, et **c'est à corriger**. Aujourd'hui le relevé
prend toutes les factures marquées « émise », à leur date d'émission. C'est le
régime **des débits** — qui existe, mais qui est une **option** : on la demande
expressément à l'administration, on ne l'a pas par hasard.

| Régime | La TVA est due… | Qui l'a |
|---|---|---|
| **Encaissements** | le jour où le client vous paie | tous les prestataires de services, **par défaut** |
| **Débits** | le jour où vous émettez la facture | ceux qui en ont fait la demande |

### Les deux nuances qui comptent

**Si vous vendez aussi du bois**, c'est une marchandise et non un service : cette
partie-là reste due à la livraison, quel que soit votre régime. Un chantier qui
mélange les deux se sépare en deux lignes.

**Sous le régime des débits, une facture jamais payée n'est pas perdue non
plus** : la TVA se récupère au titre des « créances irrécouvrables », mais
seulement après avoir prouvé que le recouvrement a échoué. C'est plus long, et
c'est de l'argent avancé entre-temps.

### Ce que ça change dans Atlas

Rien n'est encore codé. Ce qu'il faudra :

1. une **date de paiement** sur chaque facture, acomptes compris ;
2. le relevé calculé sur cette date-là, et non sur la date d'émission ;
3. un réglage **encaissements / débits**, parce que les deux existent.

### Ce que je ne peux pas décider à votre place

**Sous quel régime vous êtes.** Votre comptable le sait en une phrase, ou c'est
écrit sur votre dernière déclaration. Le point est inscrit dans
[`A-FAIRE.md`](A-FAIRE.md) §11.
