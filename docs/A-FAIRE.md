# À faire absolument

Ce qui doit être réglé avant qu'Atlas serve de vrais artisans avec de vrais
clients. Ce ne sont pas des idées d'amélioration : ce sont des points bloquants,
ou des risques qu'on ne peut pas laisser courir.

**Ce qu'ils ne bloquent pas.** Aucun de ces points n'empêche d'essayer
l'application ni de la finir : le parcours entier s'éprouve dès aujourd'hui
depuis un navigateur, téléphone compris — voir [`ESSAYER.md`](ESSAYER.md). Ils
bloquent le fait de la **confier à quelqu'un d'autre**, ce qui n'est pas la même
chose et vient plus tard.

**Document modifiable.** Rayez ce qui est fait, ajoutez ce qui manque. Un point
terminé se barre plutôt qu'il ne se supprime : savoir qu'il a été traité, et
quand, évite de le rouvrir.

Chaque point indique **qui peut le faire** — c'est souvent là que ça bloque. Un
point marqué « le patron » n'avancera jamais tout seul.

**Comment ce document est tenu** (règle inscrite dans `AGENTS.md`, donc relue à
chaque session) : dès qu'un point bloquant apparaît dans une conversation, il
est signalé et son ajout **proposé**. Rien n'y entre sans accord explicite, et
les tâches de développement ordinaires n'y figurent pas — ce document sert ce
qui ne se résoudra pas en codant.

---

## Sommaire

1. [Choisir les fournisseurs d'IA définitifs](#1-choisir-les-fournisseurs-dia-définitifs)
1 bis. [La mémoire de l'agent : où elle vit, et ce qu'elle devient](#1-bis-la-mémoire-de-lagent--où-elle-vit-et-ce-quelle-devient)
2. [Faire rédiger le contrat de sous-traitance](#2-faire-rédiger-le-contrat-de-sous-traitance)
3. [Choisir un hébergement](#3-choisir-un-hébergement)
4. [Constituer une société et s'assurer](#4-constituer-une-société-et-sassurer)
5. [~~Brancher un fournisseur SMS et e-mail~~ — ne bloque plus](#5-brancher-un-fournisseur-sms-et-e-mail--ne-bloque-plus)
6. [Choisir l'outil qui émet les factures](#6-choisir-loutil-qui-émet-les-factures)
7. [Créer les identifiants Google, pour qui veut relier son agenda](#7-créer-les-identifiants-google-pour-qui-veut-relier-son-agenda)
8. [Faire valider l'application par Google — AVANT de commercialiser](#8-faire-valider-lapplication-par-google--avant-de-commercialiser)
9. [Demander à votre comptable : TVA au mois ou au trimestre ?](#9-demander-à-votre-comptable--tva-au-mois-ou-au-trimestre-)
10. [Le premier jour d'un artisan : ce qui manque pour lui confier Atlas](#10-le-premier-jour-dun-artisan--ce-qui-manque-pour-lui-confier-atlas)
11. [Décider si Atlas peut calculer des trajets par la route](#11-décider-si-atlas-peut-calculer-des-trajets-par-la-route)
12. [Demander à votre comptable : TVA sur les encaissements ou sur les débits ?](#12-demander-à-votre-comptable--tva-sur-les-encaissements-ou-sur-les-débits-)
13. [Choisir le prestataire qui lit vos virements](#13-choisir-le-prestataire-qui-lit-vos-virements)

---

## 1. Choisir les fournisseurs d'IA définitifs

**Qui : le patron.** Personne d'autre ne peut trancher — cela engage un contrat
et des données de tiers.

> **Mise à jour du 6 août 2026.** Vous avez pris vos clés chez **Anthropic** et
> **OpenAI**, et l'application sait maintenant s'en servir : poser une clé suffit
> à la brancher, l'écran Réglages dit lequel tourne, et `npm run verifier:ia`
> répond en une commande. **Le code ne bloque donc plus rien.**
>
> Ce qui reste bloquant est ailleurs, et n'a pas bougé : **aucun de ces deux
> prestataires ne figure encore dans un contrat**, et rien n'a été signé avec
> eux sur ce qu'ils font de ce qu'on leur envoie. Tant que c'est le cas, ne
> dictez que des données inventées — pas un vrai nom de client, pas une vraie
> adresse. Voir le point 2, qui devient le vrai verrou.

### Pourquoi c'est bloquant

L'audio de la note vocale et le texte dicté partent chez un prestataire. Ils
contiennent, par construction, **le nom et l'adresse du client de l'artisan** —
l'application est faite pour qu'on les dicte.

Ces prestataires sont donc des **sous-traitants ultérieurs** au sens du RGPD :
ils doivent être autorisés par l'artisan, nommés dans le contrat, et leurs
transferts hors d'Europe encadrés. Aujourd'hui, aucun ne figure nulle part.

On ne peut pas éviter de leur envoyer ces données : c'est le cœur du produit. On
peut seulement **choisir à qui**, et **combien de temps ça reste chez eux**.

### Ce qu'il faut décider

Il faut **deux** prestataires :

- un pour la **transcription** (l'audio → du texte) ;
- un pour le **raisonnement** (le texte → des informations structurées).

Le code sait en accueillir six, mais **deux seulement sont écrits** aujourd'hui —
un par besoin :

| Besoin | Écrit et prêt | Simples coquilles |
|---|---|---|
| Transcription | **OpenAI** (Whisper) | Deepgram, Google |
| Raisonnement | **Anthropic** (Claude) | OpenAI, Gemini |

Une coquille répond « fournisseur non implémenté » à chaque appel : l'activer
mettrait la dictée en panne. Compter **une demi-journée** pour en finir une, le
jour où votre choix tombe dessus. Ce n'est pas ce qui doit décider — mais mieux
vaut le savoir avant d'ouvrir un compte et de payer un contrat.

> Ce paragraphe annonçait « six fournisseurs interchangeables ». C'était faux, et
> corrigé le 3 août 2026 : deux d'entre eux seulement fonctionnent.
> [`TRANSCRIPTION.md`](TRANSCRIPTION.md) porte le même détail, candidat par
> candidat.

### Les trois points à vérifier chez chacun

| Point | Pourquoi |
|---|---|
| **Où sont leurs serveurs** | Hors d'Europe, il faut un encadrement contractuel supplémentaire. En Europe, la question ne se pose pas |
| **Combien de temps ils conservent** ce qu'on leur envoie | Certains gardent 30 jours « pour la sécurité ». C'est autant de temps où l'audio d'un client vit ailleurs que chez vous |
| **S'ils s'en servent pour entraîner leurs modèles** | Le point le plus important, et celui qu'on oublie. Cela se refuse contractuellement — mais il faut le demander explicitement |

### La grille de décision est prête

**[`TRANSCRIPTION.md`](TRANSCRIPTION.md)** reprend ces trois points, en ajoute
deux apparus en construisant l'application — la reconnaissance du vocabulaire de
métier, et ce que fait le prestataire quand il échoue — et donne un tableau à
remplir candidat par candidat.

Il ne contient **aucun tarif** : le réseau de l'environnement de développement
refuse les pages tarifaires de tous les prestataires. Un chiffre inventé ferait
choisir de travers, et ne se découvrirait qu'à la première facture.

Ce qu'il dit aussi, et qui compte plus que le prix : à raison d'une heure et
demie d'audio par mois, **ce n'est pas le tarif qui décide**, mais les réponses
écrites sur ces trois points.

**En attendant, la dictée fonctionne déjà** avec le micro du clavier du
téléphone — sans prestataire, sans contrat, et sans qu'aucune donnée ne parte.

### Ce que je peux faire une fois décidé

**Fait le 6 août 2026, pour Anthropic et OpenAI :** ils sont raccordés, éprouvés,
et la liste est tenue à jour dans [`RGPD.md`](RGPD.md) §3.

Reste, le jour où le choix est définitif : **verrouiller** la configuration sur
ces deux-là, pour qu'aucun autre ne puisse être activé par inadvertance.

Un point à connaître, parce qu'il change la nature de la protection : jusqu'ici,
rien ne sortait parce que le réglage par défaut l'interdisait. Désormais, **rien
ne sort parce qu'aucune clé n'est posée**. Une clé posée quelque part suffit à
faire partir l'audio et le texte dicté. C'est plus simple à utiliser, et cela
demande de savoir où sont ses clés.

---

## 1 bis. La mémoire de l'agent : où elle vit, et ce qu'elle devient

**Qui : le patron**, pour les trois arbitrages. Le reste se code.

### Ce qui est acquis

Le patron veut que l'agent **s'améliore jour après jour** à partir de ce qu'il
lui apprend : cette photo, cette prestation, ce prix. Et il a été clair sur le
« où » :

> *« Je n'ai pas envie que la mémoire aille chez Anthropic. Je veux que ça reste
> dans l'application. »*

C'est aussi le bon choix techniquement. Deux choses très différentes s'appellent
« entraîner l'IA » :

| | Entraîner le modèle | La mémoire de l'application |
|---|---|---|
| Où vivent vos prix | Chez le prestataire | **Chez vous, en base** |
| Vous pouvez les relire, les corriger | Non | **Oui** |
| Si vous changez de prestataire | Tout est perdu | **La mémoire suit** |
| Effet | Après des centaines d'exemples | **Dès le premier** |

**C'est la seconde qui se construit.** Rien de ce que le patron apprend à
l'agent ne part chez un prestataire.

### La vraie question : le passage en ligne

> *« Le jour où je vais mettre ça en ligne, est-ce que je vais perdre toute la
> mémoire qui sert à l'agent à s'améliorer ? »*

**Non — mais seulement si on agit avant.** La base du banc d'essai vit dans
l'espace de travail ; l'hébergement en aura une autre. Le transfert d'une base à
l'autre est une procédure connue, documentée dans
[`PRODUCTION_BACKUP_RESTORE.md`](PRODUCTION_BACKUP_RESTORE.md), et **elle a déjà
été exécutée avec succès le 29 juillet 2026** sur la base de développement.

Ce qui est vrai, en revanche :

- **Rien ne se transfère tout seul.** Sans geste, la mémoire meurt avec l'espace
  de travail — et un espace inutilisé finit par être supprimé sans prévenir.
- **Il n'existe aujourd'hui aucune commande simple** pour que le patron exporte
  ses données depuis son téléphone. La procédure suppose un terminal.
- **Rien n'est perdu à ce jour** : la mémoire d'apprentissage n'existe pas
  encore, c'est le premier point de `TODO.md`. Il reste donc le temps de bien
  faire.

**Tranché le 5 août 2026 : construire l'export d'abord**, puis nourrir sans
risque.

### L'obstacle de la sauvegarde automatique

Le patron a demandé une **sauvegarde automatique** plutôt qu'un bouton. C'est le
bon réflexe — elle ne dépend pas de sa mémoire — mais elle bute sur une
condition qu'il n'a pas encore :

**une sauvegarde automatique doit déposer son fichier quelque part.**

| Destination | Verdict |
|---|---|
| Le dépôt lui-même | **Jamais.** Le dépôt est public (décision du 1ᵉʳ août) : y déposer une base contenant des noms et adresses de clients serait une fuite, pas une sauvegarde |
| Un stockage objet (S3, R2) | Possible, mais demande un compte et une carte — une décision de plus |
| L'hébergement, une fois choisi | **La bonne réponse** : un hébergeur managé sauvegarde tout seul, c'est déjà ce que décrit `PRODUCTION_BACKUP_RESTORE.md` |

**Ce qui est donc fait en attendant : le bouton.** « Télécharger mes données »
dans Réglages, un fichier sur son téléphone, aucun terminal, aucun compte, aucune
dépendance. Il fonctionne le jour où il est écrit.

**L'automatique suit** dès qu'une destination existe — c'est-à-dire dès le
point 3. Une raison de plus de le trancher.

### Ce qui reste à décider pour la commercialisation

Le patron a choisi **« un socle commun, puis chacun ajuste »** : un nouvel
artisan reçoit une base de départ plutôt que rien. Trois questions en découlent,
aucune tranchée :

1. ~~**Le socle, c'est quoi ?**~~ **Tranché le 5 août 2026 :** les prix du
   patron, **anonymisés**, servis **dès le deuxième artisan**. Réserve à garder
   en tête : à deux, l'anonymat est mince — le second saura vraisemblablement
   d'où viennent ces prix.
2. **Ses prix sortiraient alors de chez lui.** L'application isole aujourd'hui
   hermétiquement chaque entreprise. Un socle commun est une **dérogation
   volontaire** à ce principe : elle se construit exprès, jamais par accident.
3. ~~**Un artisan qui ajuste doit-il nourrir le socle en retour ?**~~ **Tranché
   le 5 août 2026 : non.** Le socle est un cadeau de départ, figé. Simple à
   expliquer, simple à contractualiser, et personne n'a à s'inquiéter de ce que
   deviennent ses prix.

**En attendant, la mémoire se construit strictement privée** — le seul choix qui
n'interdit rien. Ouvrir plus tard restera possible ; reprendre ce qui a été
partagé, non.

---

## 2. Faire rédiger le contrat de sous-traitance

**Qui : un juriste.** Quelques centaines d'euros, et c'est l'investissement le
plus rentable du projet.

Le mécanisme d'acceptation est **déjà construit** : documents versionnés, cases
jamais pré-cochées, preuve conservée jusqu'à l'empreinte du texte exact accepté.
Ce sont les **textes** qui manquent — ceux livrés aujourd'hui sont des canevas
sans aucune valeur, et marqués comme tels.

Le juriste aura besoin de :

- la liste des sous-traitants ultérieurs (point 1) ;
- l'inventaire des données traitées — il est fait, dans [`RGPD.md`](RGPD.md) §2 ;
- les durées de conservation retenues.

Sans ce contrat, le manquement existe **avant même** tout incident.

---

## 3. Choisir un hébergement

**Qui : le patron**, pour la décision, le budget et la signature.

L'application Next.js — celle qui porte l'agent, la page du client et le
calendrier — n'est hébergée nulle part. **Personne d'autre que vous ne peut
s'en servir.**

### Ce que l'hébergement ne bloque PAS

Point établi le 2026-08-01, et à ne pas réoublier : **vous n'avez pas besoin
d'héberger pour essayer l'application, ni pour la finir.**

Un banc d'essai s'ouvre en un geste depuis un navigateur, téléphone compris,
sans compte à créer ni budget — voir [`ESSAYER.md`](ESSAYER.md). Le parcours
entier s'y éprouve : dictée, prix, devis, envoi, réponse du client sur son
calendrier, planification, fin de chantier, facture, relevé de TVA. C'est là
que se fait l'essentiel du travail de finition.

Quatre choses seulement échappent au banc d'essai, et **aucune ne change ce que
vous voyez à l'écran** :

| | Pourquoi cela ne se voit qu'hébergé |
|---|---|
| La durabilité des fichiers | Photos et enregistrements vont sur le disque du banc d'essai. En production ce mode est refusé au démarrage : c'est un autre code qui s'exécute |
| Plusieurs machines à la fois | La limite de connexions est partagée par Redis précisément pour cela. Avec une seule machine, le défaut ne peut pas apparaître |
| Sauvegardes et restauration | Ce sont des fonctions du fournisseur de base de données |
| La charge réelle | Un banc d'essai ne dit rien de dix artisans simultanés |

**L'hébergement sert à sortir le produit, pas à le finir.** Il apporte une
adresse permanente, des utilisateurs autres que vous, et le droit de confier de
vraies données. Rien de plus, rien de moins.

*Astuce* : dans l'espace de travail, l'adresse est **publique dès la création** —
plus rien à régler. Une vraie personne peut donc ouvrir le lien du devis depuis
son propre téléphone, de quoi éprouver la page du client pour de bon. En
contrepartie, l'adresse est ouverte à qui la possède et le mot de passe de
démonstration est écrit dans le dépôt : **n'y saisissez que des données
inventées**.

### Les quatre briques nécessaires

| Brique | À quoi elle sert | Ce qui se passe sans elle |
|---|---|---|
| **Un serveur** | Faire tourner l'application | Rien ne s'ouvre |
| **PostgreSQL** | Chantiers, devis, factures | Rien n'est enregistré |
| **Redis** | Empêcher les essais de mots de passe en série | L'application **refuse de démarrer** en production |
| **Stockage de fichiers** (S3) | Photos, enregistrements, PDF | L'application **refuse de démarrer** en production |

Les deux refus sont volontaires (`src/server/env.ts`) : sans Redis, la limite de
connexions ne tient pas entre plusieurs machines ; sans stockage externe, les
photos disparaissent à chaque redéploiement. Un refus franc vaut mieux qu'une
perte silencieuse.

### Deux façons de s'y prendre

**Une seule machine louée** — 10 à 20 € par mois. Tout tourne dessus. Le moins
cher, mais les mises à jour de sécurité, les sauvegardes et la surveillance
deviennent votre travail. Et le jour d'un contrôle, c'est à vous de prouver que
la base est chiffrée.

**Des services gérés** — 30 à 50 € par mois. Chaque brique est maintenue par son
fournisseur, avec **sauvegardes automatiques et chiffrement au repos inclus au
contrat**.

**Recommandation : les services gérés.** Pas pour des raisons techniques. Vous
traitez les données des clients de vos artisans : le chiffrement au repos et les
sauvegardes ne sont pas du confort, ce sont des obligations que vous devrez
démontrer. Les acheter coûte moins cher que les construire et les prouver.

### Le point qui allège le reste

**Prendre les quatre briques chez un seul fournisseur français.**

Chaque fournisseur est un sous-traitant au sens du RGPD : à nommer, à
contractualiser, à vérifier. Quatre fournisseurs, c'est quatre fois ce travail —
et quatre fois pour le juriste du point 2. Un seul, c'est **un contrat, une
facture, un interlocuteur**. Le point 3 allège alors le point 2 au lieu de
l'alourdir.

Deux candidats qui couvrent les quatre briques :

| | Où | Remarque |
|---|---|---|
| **Scaleway** | Paris | Le plus complet, le plus économique |
| **Clever Cloud** | Nantes | Plus simple à prendre en main, un peu plus cher |

Exigences non négociables dans les deux cas : **région européenne** pour la base
comme pour le stockage de fichiers, et **chiffrement au repos**.

### Qui fait quoi

**Vous — une heure environ, une seule fois :**

1. Créer le compte, au nom de la société si elle existe (point 4).
2. Créer les quatre services, **tous en région Paris**.
3. Transmettre les identifiants **par le gestionnaire de secrets de GitHub**,
   jamais par message.
4. Télécharger le contrat de sous-traitance du fournisseur — c'est lui qui ira
   chez le juriste du point 2.

**Moi, ensuite :** appliquer le schéma, vérifier que l'isolation entre
entreprises tient en conditions réelles, brancher le déploiement automatique,
activer la purge planifiée, et contrôler le site à son adresse publique — comme
cela existe déjà pour le site de maquettes.

**Puis vous, avant d'ouvrir à quiconque :** tout reprendre depuis votre
téléphone, sur la vraie adresse.

### Ce que je ne peux pas faire à votre place

Créer le compte et accepter les conditions : cela engage juridiquement.

### Réserve

Même hébergée, **l'application n'enverra pas le devis toute seule** — et depuis
le 2026-08-03 c'est voulu, pas subi : il part de votre messagerie, destinataire
et texte déjà remplis, et vous appuyez sur Envoyer. Voir le point 5.

---

## 4. Constituer une société et s'assurer

**Qui : le patron.** Hors code, mais déterminant.

**Une société plutôt qu'une entreprise individuelle.** C'est ce qui sépare votre
patrimoine personnel de celui de l'activité. En cas de fuite de données, la
différence n'est pas théorique : les sanctions peuvent atteindre des montants
qu'un particulier n'absorbe pas.

**Une assurance cyber / responsabilité civile professionnelle.** Quelques
centaines d'euros par an, et elle absorbe l'essentiel du coût financier d'un
incident.

Ces deux points sont les moins chers et les plus efficaces de toute la liste.
Voir [`QUESTIONS.md`](QUESTIONS.md) question 4 pour le détail de ce qui est
encouru.

---

## 5. ~~Brancher un fournisseur SMS et e-mail~~ — ne bloque plus

**Tranché le 2026-08-03 : il n'y aura pas de fournisseur d'envoi, et c'est un
choix, pas un manque.** Le devis part de **votre** messagerie et de **votre**
numéro. Ce point reste ici pour mémoire, et parce qu'il garde une petite suite.

### Ce que vous faites, à l'écran

Vous appuyez sur « Envoyer le devis », vous choisissez une date ou deux. Un
bouton apparaît, qui **ouvre votre messagerie avec le numéro de votre client
déjà rempli** et le message déjà écrit. Il ne reste qu'à appuyer sur Envoyer.

Pareil pour un client joint par e-mail. Et un partage à part, si vous préférez
WhatsApp ce jour-là.

Dans le message, il y a **le lien du devis**. Votre client clique, il voit son
devis, télécharge le PDF s'il le veut, et **choisit sa date**. C'est ce choix qui
fait tourner la suite : planification, fin de chantier, facture.

### Pourquoi c'est mieux qu'un prestataire, et pas juste moins cher

- Votre client **reconnaît votre numéro** et peut vous répondre. Un expéditeur
  commercial se lit comme de la publicité, et se supprime comme telle.
- **Aucune donnée de votre client ne part chez un tiers.** Donc aucun
  sous-traitant de plus à autoriser, à lister, à faire relire par le juriste du
  point 2. Ce choix **allège** les points 2 et 3.
- Ni abonnement, ni nom de domaine, ni configuration anti-usurpation.

### Ce que ça ne fait pas, et qu'un prestataire ferait

Votre téléphone ne rend pas de comptes à l'application : elle ne sait donc pas
qu'un message est parti, ni s'il est arrivé. Restent hors de portée :

| | Ce que vous faites à la place |
|---|---|
| La **relance automatique** à sept jours | L'application affiche « à relancer » ; vous appelez |
| Le **départ automatique de la facture** | Même bouton, même geste |
| L'**accusé de réception** | Rien — vous le saurez en rappelant |
| Le **code SMS** à usage unique quand le client accepte | L'acceptation reste tracée : empreinte du devis, heure, adresse |

Ce sont des conforts. Si un jour le volume les justifie, le branchement est
toujours possible : deux abonnements, un par canal, quelques centimes par SMS et
quelques euros par mois pour l'e-mail — ce dernier supposant un nom de domaine à
vous. Les deux points à vérifier sont ceux de l'IA : **où sont leurs serveurs**
et **ce qu'ils conservent** (à porter dans [`RGPD.md`](RGPD.md) §3).

### Ce qui n'est pas possible, et pourquoi

**Joindre le PDF au message, automatiquement.** Un message préparé par un site
web ne peut pas porter de pièce jointe — c'est le format qui n'en a pas, aucun
développement n'y changera rien.

Ce n'est pas une perte : **le PDF est au bout du lien**. Et l'y joindre serait
même nuisible — votre client lirait la pièce jointe et vous répondrait « c'est
bon » par SMS, sans jamais ouvrir la page. Donc sans date choisie, et sans la
trace qui vous protège en cas de litige. Vous ressaisiriez tout à la main.

Le jour où l'application s'installera vraiment depuis l'App Store, le composeur
du téléphone acceptera destinataire **et** pièce jointe : on l'ajoutera alors, en
gardant le lien dans le message. Cela suppose le compte développeur Apple —
[`QUESTIONS.md`](QUESTIONS.md) question 1.

---

## 6. Choisir l'outil qui émet les factures

**Qui : le patron**, pour le choix, le compte et la signature. Le branchement
se code ensuite.

*Ajouté le 8 août 2026, après votre question « qu'est-ce que tu dois faire sur
la plateforme de facturation ? ». La réponse longue est dans
[`QUESTIONS.md`](QUESTIONS.md) question 11 ; ce point ne garde que ce qui
attend une décision.*

### Ce qui est déjà décidé, et ne se rouvre pas

**Atlas prépare les factures, il ne les émet pas au sens légal.** Décision du
31 juillet 2026, inscrite comme définitive dans [`AGENT.md`](AGENT.md) §6 et
[`MVP.md`](MVP.md) — « hors périmètre définitivement, pas *pas encore* ».

Une facture non conforme n'est pas un défaut d'affichage : c'est un risque
légal pour l'artisan, et une numérotation cassée se traîne sur tout un
exercice. On se branche par **API** sur un outil dont c'est le métier.

### Pourquoi c'est bloquant

Deux choses, et elles ne sont pas de même nature :

1. **Pour vendre Atlas à un artisan**, il faut que ses factures sortent
   conformes. Aujourd'hui Atlas produit un PDF numéroté en continu — le
   minimum — mais **ni Factur-X, ni UBL, ni archivage à valeur probante, ni
   raccordement à une plateforme agréée**. Vendre l'application en laissant
   croire l'inverse l'exposerait, lui.
2. **Pour Eden Nature elle-même**, la réforme de la facturation électronique
   impose de passer par une plateforme agréée — d'abord pour **recevoir** ses
   factures fournisseurs, plus tard pour **émettre** les siennes. Cela vaut
   qu'Atlas existe ou non.

### Les échéances, avec la réserve qui va avec

Les dates annoncées sont **septembre 2026** pour la réception et **septembre
2027** pour l'émission des petites entreprises.

**Ce calendrier a déjà été décalé deux fois, et je ne peux pas le vérifier
d'ici** : le mandataire réseau de l'environnement de développement refuse les
sites publics. Le faire confirmer par un comptable est le premier geste — pas
me croire sur parole.

### Ce qu'il faut décider

**Vous n'avez aucun logiciel de comptabilité ni de facturation aujourd'hui**
(réponse du 8 août 2026). Il en faut un, et le choix vous appartient : il
engage un abonnement et vos écritures.

Les candidats cités dans `AGENT.md` §6 — Pennylane, Evoliz, Tiime, Sellsy,
Abby. Les trois points à regarder :

| Point | Pourquoi |
|---|---|
| **Est-il immatriculé comme plateforme agréée**, ou branché sur une | Sans cela il ne vous met pas en règle, quelle que soit sa qualité par ailleurs |
| **A-t-il une API** pour créer une facture depuis un autre logiciel | C'est la condition du branchement. Certains outils très corrects n'en ont pas |
| **Que fait votre comptable**, s'il en existe un | Prendre l'outil qu'il utilise déjà vous épargne deux saisies et une brouille |

**Aucun tarif n'est cité ici, volontairement** : le réseau de l'environnement
de développement refuse les pages tarifaires. Un chiffre inventé ferait choisir
de travers, et ne se découvrirait qu'à la première facture — c'est déjà la
règle appliquée au point 1.

### Ce que je peux faire, et ce que je ne peux pas

**Moi, une fois l'outil choisi :** brancher son API, envoyer ce qu'Atlas a déjà
préparé — client, lignes, montants, taux, période — récupérer le numéro et le
document qu'il a émis, et éprouver le parcours de bout en bout. C'est le
point 6 de la liste de `AGENT.md` §9, un lot de quelques jours.

**Moi, avant :** rien d'utile. Chaque outil a son API ; écrire du code avant le
choix, ce serait écrire du code à jeter.

**Ce que je ne peux pas faire à votre place :** ouvrir le compte et accepter
les conditions. Cela engage juridiquement, comme pour l'hébergement au point 3.

### Ce que ça ne bloque pas

Ni l'essai d'Atlas, ni sa finition. Le parcours entier — dictée, prix, devis,
envoi, réponse du client, planification, fin de chantier, facture, relevé de
TVA — s'éprouve dès aujourd'hui. Ce point bloque le fait de **confier Atlas à
un vrai artisan avec de vrais clients**, comme les autres.

---

## 7. Créer les identifiants Google, pour qui veut relier son agenda

**Qui : le patron.** Personne d'autre : cela se crée depuis un compte Google et
engage l'acceptation de conditions.

> **Demande du 9 août 2026 :** *« ce qui serait bien, c'est que l'utilisateur
> puisse, s'il le souhaite ou non, connecter son planning à son agenda
> Google. »*

### Pourquoi c'est bloquant

Aujourd'hui, Atlas déduit vos jours libres des **seuls chantiers planifiés dans
Atlas** (`src/server/disponibilites.ts`). Il ne sait rien de ce qui existe
ailleurs.

La conséquence n'est pas théorique : un rendez-vous noté dans un agenda Google
et pas dans Atlas est **invisible**. Atlas proposera ce jour-là au client, le
client le choisira, et l'artisan découvrira le doublon le matin même. Le devis
sera parti, la date acceptée, la promesse faite.

C'est le seul endroit du parcours où Atlas peut engager l'artisan sur une
information qu'il n'a pas. Partout ailleurs, il s'arrête et demande.

### Ce qu'il faut, et ce que ça coûte

| Ce qu'il faut | Où | Coût |
|---|---|---|
| Un projet dans la console Google Cloud | console.cloud.google.com | Gratuit |
| L'API Google Calendar activée dessus | idem | Gratuit |
| Un identifiant OAuth (client ID + secret) | idem | Gratuit |
| Un écran de consentement, et sa **validation par Google** si l'application sort du cercle des testeurs | idem | Gratuit, mais **compter des semaines** |

**Le vrai coût n'est pas l'argent, c'est le délai de validation.** Tant que
l'application n'est pas validée, Google limite l'accès à une centaine de comptes
de test inscrits à la main. Suffisant pour vous et vos premiers artisans ;
bloquant le jour où Atlas se vend.

**À vérifier auprès de Google, je ne peux pas le faire d'ici** : le réseau de
l'environnement de développement refuse les pages de Google. Ce qui est écrit
ci-dessus vient de ce que je sais du fonctionnement de cette console, pas d'une
page lue aujourd'hui — traitez-le comme une indication à confirmer, pas comme
une source.

### Ce que votre phrase a tranché, et qui ne se rediscutera pas

**La connexion est un choix, par artisan, jamais un réglage de l'application.**
Chacun relie son agenda ou ne le relie pas ; celui qui ne veut rien relier garde
exactement l'Atlas d'aujourd'hui, sans écran en plus ni compte à créer.

Ce n'est pas un détail de confort. Un agenda personnel contient les rendez-vous
médicaux, les vacances, la vie privée de la famille. **Atlas n'a besoin que des
créneaux occupés** — jamais des intitulés, jamais des participants. La même règle
qu'à la page du client, qui reçoit des dates et rien d'autre
(`docs/AGENT.md` §2.2 bis).

### Ce que je peux faire, et ce que je ne peux pas

> **Mise à jour du 9 août 2026 — tout est écrit, il ne manque que vos
> identifiants.** L'écran « Mon agenda », le bouton dans le Planning, le
> stockage chiffré, la lecture des créneaux **et de leurs intitulés**, la fusion
> dans la disponibilité, les deux chemins du client : c'est fait et éprouvé
> (`ARCHITECTURE.md` §39 et §41).
>
> **Et vous n'avez plus besoin de moi pour la suite.** Les identifiants se
> collent directement dans l'écran « Mon agenda » — trois cases. Ils attendaient
> auparavant dans la configuration du serveur, ce qui vous laissait bloqué après
> avoir fait votre part chez Google.

**Ce que je ne peux toujours pas faire à votre place :** créer le projet Google
et accepter ses conditions. Cela vous engage, comme l'hébergement au point 3 et
l'outil de facturation au point 6.

**Et ce que je n'ai pas pu éprouver ici, dit noir sur blanc :** l'aller-retour
réel avec Google — l'autorisation, l'échange du code, le renouvellement du
jeton. Cet environnement n'a pas de compte Google et son réseau refuse ses
adresses. Tout ce qui *décide* de quelque chose a été sorti de ce chemin-là
exprès ; il ne reste que trois appels et la lecture de leurs réponses. **Le
premier vrai raccordement sera donc le premier essai** : si Google refuse, son
message s'affichera tel quel à l'écran plutôt que d'être deviné.

**Ce que je ne peux pas faire à votre place :** créer le projet Google et
accepter ses conditions. Comme l'hébergement au point 3 et l'outil de facturation
au point 6, cela vous engage.

### Ce que ça ne bloque pas

Ni l'essai d'Atlas, ni sa finition. Un artisan qui tient son planning **dans
Atlas seulement** n'a aucun doublon possible, et c'est le cas aujourd'hui. Ce
point bloque le jour où un artisan tient son agenda ailleurs — c'est-à-dire à
peu près tout le monde.

---

## 8. Faire valider l'application par Google — AVANT de commercialiser

**Qui : le patron.** Cela engage une entreprise auprès de Google, et demande des
pièces que vous seul possédez.

> **À ressortir au moment de la commercialisation.** Sa consigne du 9 août
> 2026 : *« quand on sera arrivé à la partie commercialisation, je veux que tu
> me le ressortes automatiquement parce que je ne vais pas m'en souvenir. »*
> Le rappel est armé dans `HANDOVER.md`, que chaque conversation lit en
> arrivant.

### Pourquoi c'est bloquant, et pourquoi ça ne se voit pas venir

Le raccordement de l'agenda **fonctionnera parfaitement** pour vous et vos
premiers artisans. Rien n'annoncera le mur.

Tant que Google n'a pas validé l'application, l'accès est limité à **une
centaine de comptes que vous inscrivez à la main dans la console**. Le
cent-unième artisan verra un écran d'avertissement de Google, puis un refus. Ce
n'est pas un défaut d'Atlas : c'est la règle de Google pour les applications non
vérifiées qui demandent l'accès à un agenda.

### Ce que la vérification demande

| Pièce | État aujourd'hui |
|---|---|
| Un nom de domaine dont vous prouvez la propriété | À acquérir — il vous en faut un de toute façon |
| Une **politique de confidentialité publiée en ligne** | Le contenu existe (`docs/RGPD.md`), il reste à le publier à une adresse publique |
| Une page d'accueil publique décrivant l'application | À faire |
| Une vidéo montrant ce que vous faites de l'agenda | Quelques minutes d'écran |
| L'écran de consentement rempli et soumis | Dans la console Google |

**Le coût est le délai, pas l'argent.** Comptez **plusieurs semaines**, parfois
davantage si Google demande des précisions. C'est un délai qui ne se rattrape
pas : lancez la demande **bien avant** la date à laquelle vous voulez vendre.

**Réserve, dite plutôt que tue.** À ma connaissance, l'agenda relève des
permissions « sensibles » — vérification gratuite — et non des « restreintes »,
qui exigent en plus un audit de sécurité facturé par un tiers. **Je n'ai pas pu
le confirmer** : le réseau de l'environnement de développement refuse les pages
de Google. À vérifier vous-même dans la console avant de vous engager.

### Ce que ça ne bloque pas

Ni l'essai, ni la finition, ni vos premiers artisans. Ce point bloque
**uniquement** le passage à l'échelle — et il le bloque d'un coup, sans
prévenir, le jour où vous dépasserez la centaine.

---

## 9. Demander à votre comptable : TVA au mois ou au trimestre ?

**Qui peut le faire :** vous, en une question à votre comptable.
**Ce que ça débloque :** rien de technique — l'application marche dans les deux
cas. Mais elle affiche aujourd'hui le rythme que vous lui avez indiqué, et
personne n'a encore vérifié que c'est le bon.

### Ce qui est déjà fait

Le réglage existe : **Réglages → Votre TVA**, « Tous les mois » ou « Tous les
trimestres ». Le mois est coché d'avance, parce que c'est le défaut légal — la
déclaration CA3 est mensuelle.

### Pourquoi je ne peux pas répondre à votre place

Le trimestre est une **option**, ouverte seulement si votre TVA **due** de
l'année précédente est inférieure à 4 000 €. La TVA due, c'est ce que vous avez
collecté *moins* ce que vous déduisez sur vos achats — et Atlas ne voit que la
première. Il ne voit ni votre gazole, ni votre matériel, ni votre assurance.

Il ne peut donc **pas** calculer si vous y avez droit, et il ne doit pas faire
semblant. C'est la même règle que pour les prix : sans source fiable, on n'écrit
pas.

### La question exacte à poser

> « Je déclare ma TVA au mois ou au trimestre ? Et est-ce que ça change cette
> année ? »

Puis cochez la bonne case dans Réglages. C'est tout.

### À savoir pour 2027

Le régime réel simplifié — déclaration annuelle avec deux acomptes — **disparaît
au 1er janvier 2027**. Si vous y êtes aujourd'hui, votre comptable vous fera
basculer au mois ou au trimestre. L'application est déjà prête pour les deux :
il n'y aura rien à changer, sinon la case.

*Ajouté le 2026-08-12, à votre demande.*

---

## 10. Le premier jour d'un artisan : ce qui manque pour lui confier Atlas

**Qui : moi.** C'est du code, pas une décision — mais c'est ici parce que **ça
bloque la commercialisation**, exactement comme l'hébergement ou l'outil de
facturation. Vous devez savoir que c'est là.

*Ajouté le 13 août 2026, à votre demande, après votre remarque : « quand
l'application sera commercialisée, le devis ne comportera aucune information,
il sera vierge, et c'est avec ces informations-là qu'il devra se remplir
automatiquement ».*

### Le point de départ

Vous avez raison, et c'est plus lourd que ça n'en a l'air. J'ai vérifié dans le
code : **rien n'est prévu pour un artisan qui arrive les mains vides.**

### Ce qui manque, dans l'ordre où ça se voit

| | Ce qui se passe aujourd'hui | Ce que ça donne pour lui |
|---|---|---|
| 1 | **Votre banc d'essai démarre avec une entreprise déjà remplie** — nom, SIRET, adresse, IBAN | Vous n'avez jamais vu l'écran d'un vrai débutant, et moi non plus |
| 2 | **Aucun écran ne permet de créer son entreprise** | Il ne peut pas commencer |
| 3 | **Son identité ne se saisit que dans « le devis écrit à la main »** | S'il suit le parcours normal — dicter, chiffrer, envoyer — il ne la saisit jamais |
| 4 | **Rien ne vérifie son identité avant l'envoi** | Son premier devis part **sans SIRET, sans adresse, sans IBAN**, sans un mot |
| 5 | Quand son nom manque, l'application écrit poliment « Votre entreprise » | Le manque est maquillé au lieu d'être signalé |
| 6 | **Chaque devis fige ses informations le jour où il est créé** | Compléter son SIRET ce soir ne répare **aucun** devis déjà fait — et rien ne le prévient |

Le point 6 mérite d'être compris, parce que c'est du **bon** travail : une pièce
comptable doit garder l'identité qu'elle portait le jour de son émission. Ce qui
manque n'est pas le mécanisme, c'est **la phrase qui l'explique**.

### Ce que ça coûte

Rien, en argent. En travail : **les écrans sont dessinés**
(`maquettes/atlas-reglages-identite.html`), la décision est prise, il reste à
coder — la création d'entreprise, les champs d'identité dans les réglages, le
garde-fou avant l'envoi. C'est un lot de quelques jours, pas un chantier.

### ~~La question que je vous pose, et qui vous appartient~~ — **close le 14 août 2026**

~~Faut-il EMPÊCHER l'envoi d'un devis tant que l'identité est incomplète, ou
seulement avertir ?~~

**Votre réponse finale : ni l'un ni l'autre.** Vous aviez d'abord choisi
d'empêcher l'envoi, et je l'ai codé. En voyant l'écran, vous avez tranché
autrement : *« l'IBAN et le SIRET, c'est des choses que l'utilisateur va devoir
renseigner dans la bonne catégorie. Une fois que c'est enregistré, il faut que
ça s'ajoute automatiquement à la page du devis, mais c'est tout. Rien de plus,
rien de moins. »* Tout ce que j'avais ajouté a été retiré.

**Ce que vous demandiez existait déjà**, et je l'ai vérifié dans le code : ce
que vous saisissez dans « Mon entreprise » — nom, adresse, SIRET, téléphone,
e-mail, IBAN — se recopie tout seul dans le devis, et un devis pas encore envoyé
rafraîchit cette copie **chaque fois que vous l'ouvrez**. Un SIRET saisi ce soir
apparaît donc sur vos devis en cours dès demain. Seuls les devis **déjà partis**
gardent ce qu'ils portaient, et c'est voulu : une pièce comptable ne se réécrit
pas après coup.

**Ce qui reste vrai, et que vous savez :** si vous n'avez pas saisi votre SIRET,
le devis part sans, et rien ne vous prévient. C'est votre choix, pris en
connaissance de cause.

### Ce qui est lié, et qui n'est pas fait non plus

**Les accès de ses salariés.** Un patron ne peut donner aucun accès aujourd'hui
— l'écran n'existe pas —, et surtout **rien ne filtre ce que chacun reçoit** :
un salarié verrait tous vos prix et toutes vos marges. La règle a été posée le
7 août ([QUESTIONS.md](QUESTIONS.md) question 10) et complétée le 13 : quatre
rôles, et une portée du planning réglée salarié par salarié. **Le dessin
existe ; le code, non.** Tant que ce n'est pas fait, Atlas ne peut être confié
qu'à un artisan qui travaille seul.

### Ce que ça ne bloque pas

Ni votre usage à vous, ni la suite du développement. Ce point bloque **le jour
où vous confiez Atlas à quelqu'un d'autre que vous** — et il le bloque
entièrement.

---

## 11. Décider si Atlas peut calculer des trajets par la route

**Qui : vous**, et le juriste du point 2 si la réponse penche vers un
prestataire privé.

**D'où ça vient.** Le 13 août 2026 : *« lorsqu'on a fini des chantiers en
demi-journée, que le planning soit en mesure de proposer deux demi-journées pour
faire une journée, mais de deux chantiers qui sont les plus proches »*. Une
bonne idée, qui bute sur une question simple : **proche comment ?**

### Les deux mesures, et ce qu'elles engagent

| | Ce que ça donne | Ce que ça engage |
|---|---|---|
| **À vol d'oiseau** | La distance directe, calculée **chez nous** à partir des coordonnées que la Base Adresse Nationale rend déjà | **Rien.** Aucune donnée ne sort, aucun contrat nouveau |
| **Par la route** | Le vrai temps de trajet | **L'envoi des adresses de vos clients à un service extérieur** |

**Pourquoi la route pose problème**, et c'est le même problème que le point 1 :
un service de calcul d'itinéraire devient un **sous-traitant ultérieur** au sens
du RGPD. Il doit être autorisé par l'artisan, nommé dans le contrat, et ses
transferts hors d'Europe encadrés. Tant que le contrat du point 2 n'existe pas,
chaque prestataire ajouté aggrave le même manquement.

C'est exactement le raisonnement qui a fait préférer la Base Adresse Nationale à
Google pour l'aide à la saisie : un service public français, sans compte ni clé,
à qui l'on n'envoie qu'une rue.

### La piste qui pourrait tout régler

**L'État publie aussi un service d'itinéraire**, sur la même Géoplateforme que
les adresses. S'il tient ses promesses, la route rentre dans la même case que
les adresses — service public, sans compte, sans clé, **sans contrat avec une
entreprise privée**.

**Une vérification a été lancée le 13 août 2026** pour le savoir, sur une
machine qui a le réseau — l'environnement de développement, lui, refuse les
services extérieurs. Elle répond à trois questions : le service accepte-t-il
sans clé, que vaut l'écart entre vol d'oiseau et route dans les monts, et
tient-il le rythme de plusieurs appels d'affilée
(`.github/workflows/itineraire.yml`).

### Ce qui est proposé en attendant

**Commencer à vol d'oiseau**, et le dire à l'écran — « à 8 km à vol d'oiseau »
plutôt que « à 14 min ». C'est utile tout de suite, ça n'engage rien, et la
maquette est dessinée pour que **seule la phrase change** le jour où la route
devient possible : pas un écran à redessiner
(`docs/maquettes/57-apparier-deux-demi-journees.html`).

### Ce que ça ne bloque pas

Ni l'essai, ni la finition. L'appariement fonctionnera à vol d'oiseau, et
gagnera en justesse le jour où la route sera tranchée.

---

## 12. Demander à votre comptable : TVA sur les encaissements ou sur les débits ?

**Qui peut le faire : vous seul.** La réponse est chez votre comptable, ou sur
votre dernière déclaration de TVA.

### Pourquoi c'est un point bloquant, et pas un détail

Atlas fait aujourd'hui entrer une facture dans votre relevé de TVA **le jour où
vous l'émettez**. Si votre client met trois mois à payer, vous avancez sa TVA
pendant trois mois. S'il ne paie jamais, vous l'avancez pour rien — et il faut
ensuite la récupérer, avec des preuves.

Or, pour une **prestation de services**, la TVA est due **à l'encaissement** par
défaut (article 269-2-c du CGI). Le régime que l'application applique
aujourd'hui — les **débits** — est une **option**, qui se demande.

**Donc, de deux choses l'une :**

| Si vous êtes… | Alors |
|---|---|
| **aux encaissements** (le cas le plus probable) | Atlas déclare **trop tôt**, et c'est un défaut à corriger |
| **aux débits** (vous en avez fait la demande) | Atlas est juste, et le réglage servira aux autres artisans |

### La question à lui poser, mot pour mot

> *« Pour mon entreprise, la TVA est-elle exigible sur les encaissements ou sur
> les débits ? Ai-je opté pour les débits à un moment ? »*

Et, tant qu'il est au téléphone, la question 9 de ce document — mois ou
trimestre — se règle dans la même phrase.

### Ce que sa réponse débloque

Le codage de la date de paiement sur la facture, du relevé calculé dessus, et du
réglage entre les deux régimes. Le détail est dans
[`QUESTIONS.md`](QUESTIONS.md) §19, et une maquette montre à quoi ça
ressemblerait : `maquettes/atlas-tva-au-paiement.html`.

### Ce que ça ne bloque pas

Rien du reste. Le parcours devis → chantier → facture fonctionne ; c'est le
relevé de TVA, et lui seul, qui déclare trop tôt.

---

## 13. Choisir le prestataire qui lit vos virements

**Qui peut le faire : vous seul.** C'est un contrat et un coût mensuel, pas une
ligne de code.

*Décidé le 14 août 2026 : à la question « comment Atlas saura que j'ai été
payé ? », trois réponses étaient possibles — vous le dites, Atlas vous le
demande chaque trimestre, ou la banque le dit. Vous avez choisi la banque.
Dessin : `maquettes/atlas-banque-rapprochement.html`.*

### Pourquoi ça ne se code pas tout seul

**Personne ne se branche directement à une banque.** La loi européenne (DSP2)
impose de passer par un **prestataire agréé** — un « agrégateur ». Il faut donc
en choisir un, signer, et payer.

Les noms qui reviennent en France : **Bridge**, **Powens**, **Tink**,
**GoCardless** (anciennement Nordigen), **Linxo**. Certains annoncent une offre
gratuite jusqu'à un volume donné ; **à vérifier au devis, je ne l'ai pas
constaté moi-même**.

### Les trois choses à demander, quel que soit celui que vous retenez

| Quoi | Pourquoi ça compte |
|---|---|
| **Le coût réel** : par compte relié et par mois, ou au forfait | À cinq factures par trimestre, un abonnement peut coûter plus cher que le temps qu'il fait gagner |
| **Votre banque est-elle couverte ?** | Toutes ne le sont pas également, et les banques régionales le sont parfois mal |
| **Le contrat de sous-traitance RGPD** | Vos virements portent les noms de vos clients. Ce prestataire s'ajoute au registre, comme l'hébergeur (§2 de ce document) |

### Ce qu'il faut savoir avant de signer, et qui ne se négocie pas

**L'accès se coupe tous les 90 jours.** Règle européenne : passé ce délai, vous
devez vous ré-identifier chez votre banque. Un automatisme qui s'arrête tout
seul sans prévenir vaudrait mieux ne pas exister — l'écran vous préviendra une
semaine avant, et les paiements se noteront à la main pendant ce temps.

**Un relevé bancaire ne porte pas de numéro de facture.** Il porte une date, un
montant et un libellé écrit par la banque de votre client. Atlas ne pourra donc
que **proposer** un rapprochement ; c'est vous qui confirmez. Quand le montant
ne tombe pas juste — un acompte, deux factures réglées en un virement —, il le
dira au lieu de deviner.

### Ce que ça ne bloque pas

**Rien.** La saisie à la main (« Noter un paiement ») se code sans attendre, et
c'est elle qui reste quand l'accès bancaire dort. La banque n'est pas une
condition : c'est un confort qui supprime un oubli.
