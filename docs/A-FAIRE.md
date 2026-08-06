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
2. [Faire rédiger le contrat de sous-traitance](#2-faire-rédiger-le-contrat-de-sous-traitance)
3. [Choisir un hébergement](#3-choisir-un-hébergement)
4. [Constituer une société et s'assurer](#4-constituer-une-société-et-sassurer)
5. [~~Brancher un fournisseur SMS et e-mail~~ — ne bloque plus](#5-brancher-un-fournisseur-sms-et-e-mail--ne-bloque-plus)

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

Le code accepte aujourd'hui **six fournisseurs interchangeables**. Il en faut
**deux** :

- un pour la **transcription** (l'audio → du texte) ;
- un pour le **raisonnement** (le texte → des informations structurées).

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
