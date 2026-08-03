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
5. [Brancher un fournisseur SMS et e-mail](#5-brancher-un-fournisseur-sms-et-e-mail)

---

## 1. Choisir les fournisseurs d'IA définitifs

**Qui : le patron.** Personne d'autre ne peut trancher — cela engage un contrat
et des données de tiers.

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

Verrouiller la configuration sur les deux fournisseurs retenus, pour qu'aucun
autre ne puisse être activé par inadvertance, et tenir la liste à jour dans
[`RGPD.md`](RGPD.md) §3.

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

Même hébergée, **l'application ne pourra pas encore envoyer un devis toute
seule** : le point 5 reste entier. Vous pourrez vous en servir, la montrer, la
faire essayer — mais le dernier mètre jusqu'au client passera toujours par vous.

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

## 5. Brancher un fournisseur SMS et e-mail

**Qui : le patron**, pour le choix et l'abonnement. Le branchement lui-même est
du code, et je peux le faire en une fois.

### Pourquoi c'est bloquant

C'est le dernier mètre du parcours, et il n'existe pas. Tout le reste est
construit : le devis part avec une ou deux dates au choix, le client répond sur
son calendrier, le chantier se planifie, la facture se prépare. Mais **rien ne
quitte l'application**. Le lien du devis vous est remis à l'écran, à charge pour
vous de le recopier dans un SMS. La facture attend le même branchement.

Autrement dit : l'agent fait tout le travail, sauf l'envoyer. Sur dix chantiers
par semaine, c'est vingt gestes manuels — exactement ceux que l'application est
censée vous épargner.

### Ce qu'il faut choisir

Deux abonnements distincts, un par canal :

| Canal | Ce que ça coûte, en ordre de grandeur | Remarque |
|---|---|---|
| **SMS** | quelques centimes par message | Le canal que la plupart de vos clients liront. Un numéro d'expéditeur au nom de votre entreprise se demande à part |
| **E-mail** | quelques euros par mois jusqu'à plusieurs milliers d'envois | Suppose un nom de domaine à vous, et sa configuration anti-usurpation — sans quoi vos devis finissent en indésirables |

### Deux points à vérifier, du même ordre que pour l'IA

- **Où sont leurs serveurs.** Le message porte le nom du client et le lien vers
  son devis : c'est une donnée personnelle qui transite. Un prestataire européen
  évite tout encadrement supplémentaire.
- **Ce qu'ils conservent.** Les journaux d'envoi gardent souvent le destinataire
  plusieurs mois. À faire figurer dans [`RGPD.md`](RGPD.md) §3 comme les autres
  sous-traitants.

### Ce que je fais une fois décidé

L'envoi, la trace de ce qui est parti et quand, la relance d'un devis resté sans
réponse, et le départ automatique de la facture après votre confirmation. Le
canal de chaque client est **déjà enregistré** dans l'application, et l'écran
d'envoi refuse déjà de partir sans lui — il ne manque que le fournisseur au bout.

### En attendant

Rien n'est perdu ni bloqué : le lien affiché à l'écran est le même que celui qui
partirait par SMS, et la page du client fonctionne à l'identique. Seul le geste
d'envoi vous revient.
