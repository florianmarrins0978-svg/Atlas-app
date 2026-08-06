# Protection des données — registre, sous-traitants, conservation, violations

> Document de conformité RGPD, tenu à jour avec le code. Il décrit ce que
> l'application traite réellement — pas ce qu'elle devrait traiter.
>
> **Il ne remplace pas un avis juridique.** Le contrat de sous-traitance signé
> par les artisans (§3) doit être rédigé ou relu par un juriste. Ce document
> fournit la matière factuelle dont ce juriste aura besoin.
>
> Toute évolution du code qui ajoute une donnée, un destinataire ou une finalité
> doit mettre ce document à jour **dans le même lot**. Un registre faux est pire
> qu'un registre absent : il documente une négligence.

## 1. Qui est responsable de quoi

Deux relations distinctes, qu'il ne faut jamais confondre :

| Relation | Notre rôle | Rôle de l'artisan |
|---|---|---|
| Données **des artisans** (nos abonnés) : compte, entreprise, facturation de l'abonnement | **Responsable de traitement** | Personne concernée |
| Données **des clients des artisans** : nom, adresse, téléphone, chantiers, devis | **Sous-traitant** | **Responsable de traitement** |

Conséquence directe : pour la seconde relation, l'**article 28 du RGPD impose un
contrat de sous-traitance** entre l'artisan et nous. Sans ce contrat, le
manquement existe indépendamment de tout incident.

Ce contrat peut être conclu par voie électronique — l'article 28.9 exige un
écrit, « y compris sous forme électronique », et non une signature manuscrite.
Voir §8 pour les conditions à respecter pour qu'il fasse foi.

## 2. Registre des traitements (article 30)

### 2.1 Gestion des comptes et des entreprises

- **Finalité** : authentifier l'artisan, rattacher ses données à son entreprise.
- **Base légale** : exécution du contrat d'abonnement.
- **Données** : adresse e-mail, empreinte du mot de passe (`users`), raison
  sociale et paramètres (`entreprises`), appartenance (`membres_entreprise`).
- **Personnes concernées** : les artisans abonnés et leurs salariés.
- **Notre rôle** : responsable de traitement.

### 2.2 Gestion des chantiers et des clients de l'artisan

- **Finalité** : permettre à l'artisan de préparer ses devis.
- **Base légale** : intérêt légitime de l'artisan (relation commerciale). Nous
  agissons sur ses instructions.
- **Données** : identité et coordonnées du client (`clients`), adresse et
  description du chantier (`chantiers`), devis et lignes (`devis`,
  `lignes_devis`, `lignes_prix`), photos (`photos`), notes vocales
  (`notes_vocales`), transcriptions, informations structurées
  (`brouillons_informations`), historique des prix (`historique_prix`),
  propositions de l'assistant (`propositions_ia`), documents versés et leurs
  fragments (`documents`, `fragments_documents`).
- **Personnes concernées** : les clients des artisans — des particuliers, le
  plus souvent.
- **Notre rôle** : **sous-traitant**.

> **Point de vigilance.** Une note vocale est dictée librement sur un chantier.
> Elle peut capter, sans que personne l'ait voulu, des propos qui relèvent de
> l'article 9 (santé, situation familiale, difficultés d'un client). Le champ
> est libre : on ne peut pas garantir qu'il ne contiendra jamais de donnée
> sensible. Cela justifie à soi seul une conservation courte (§4) et
> l'interdiction d'exploiter ces contenus à d'autres fins.

### 2.3 Assistance par intelligence artificielle

- **Finalité** : transcrire la dictée, en extraire des informations
  structurées, proposer des lignes de devis.
- **Données transmises** : l'**audio brut** de la note vocale, puis le **texte
  transcrit**. Ces contenus comportent, par construction, l'identité et
  l'adresse du client — l'application est faite pour qu'on les dicte.
- **Destinataires** : voir §3. C'est le point le plus exposé du produit.

### 2.4 Consultation du devis par le client de l'artisan

- **Finalité** : permettre au client de consulter son devis, de l'accepter ou
  de le refuser, et de retenir une date d'intervention.
- **Données** : le devis et son montant, la ou les dates proposées, la réponse
  et son horodatage, ainsi que la **preuve d'acceptation** — empreinte du PDF
  accepté, adresse IP, canal utilisé, et validation du code SMS le cas échéant.
- **Base légale** : exécution du contrat, pour la réponse elle-même ; obligation
  légale et intérêt légitime (preuve) pour la trace d'acceptation.
- **Notre rôle** : sous-traitant.

> La trace d'acceptation vaut **signature électronique** (`AGENT.md` §2.2 ter).
> Elle doit donc être conservée aussi longtemps que le contrat peut être
> contesté — c'est-à-dire nettement plus longtemps que le reste, et c'est
> voulu. Une preuve purgée trop tôt ne prouve plus rien.

> **La seule surface publique du produit.** Cette page est accessible sans
> compte, depuis un lien reçu par SMS ou e-mail. Elle impose : un identifiant
> impossible à deviner, une **expiration**, et un contenu strictement limité au
> devis concerné — jamais la fiche client complète, jamais l'historique des
> prix, jamais les autres chantiers. Un lien qui fuite ne doit exposer qu'un
> seul devis, et pas indéfiniment.

> **Les jours occupés du patron y sont transmis** (`AGENT.md` §2.2 bis), pour
> que le client ne puisse pas retenir une date impossible. Cette transmission
> est délibérée et strictement bornée : **une liste de dates, rien d'autre** —
> aucun intitulé de chantier, aucun nom de client, aucune adresse, aucune durée,
> aucun motif. Ce sont des données de l'entreprise, non des données personnelles
> de ses clients : aucun tiers n'y est identifiable.
>
> La liste ne couvre que la fenêtre de proposition (trois mois par défaut) et
> disparaît avec l'expiration du lien.

### 2.5 Sécurité et exploitation

- **Finalité** : limitation de débit, journalisation, détection d'anomalies.
- **Données** : identifiants de session, adresses IP, identifiants de requête,
  contextes d'erreur.
- **Base légale** : intérêt légitime (sécurité du service).

## 3. Sous-traitants ultérieurs

L'article 28.2 impose que ces destinataires soient **autorisés par le
responsable de traitement** — donc par l'artisan — et **nommément listés**. Tout
ajout ou remplacement doit lui être notifié, avec un délai raisonnable pour s'y
opposer.

Les fournisseurs d'IA sont interchangeables par variable d'environnement. **La
configuration réellement déployée détermine la liste qui fait foi** : ce tableau
doit être réduit aux fournisseurs effectivement activés en production, et le
contrat doit refléter ce choix.

| Rôle | Fournisseurs possibles | Données transmises | À vérifier |
|---|---|---|---|
| Raisonnement (LLM) | Anthropic, OpenAI, Google Gemini | Texte dicté, informations du chantier | Localisation, durée de rétention côté fournisseur, **non-réutilisation pour l'entraînement**, clauses contractuelles types si hors UE |
| Transcription | Deepgram, OpenAI, Google | **Audio brut** de la note vocale | Idem |
| Stockage de fichiers | Compatible S3 — hébergeur à choisir | Photos, audio | Choisir une région **UE** (`STORAGE_S3_REGION`, `STORAGE_S3_ENDPOINT`) |
| Base de données | Hébergeur à choisir | L'ensemble des données | Région UE, chiffrement au repos |
| Limitation de débit | Redis | Identifiants de session, IP | Région UE |
| Supervision des erreurs | Sentry (optionnel) | Contextes d'erreur — **peuvent contenir des données personnelles** | Filtrer les contextes, ou renoncer à Sentry |
| Envoi de SMS | à choisir | Numéro de téléphone du client, lien vers son devis | Région UE, durée de rétention des messages chez le fournisseur |
| Envoi d'e-mails | à choisir | Adresse du client, devis et facture en pièce jointe | Idem |

Les deux dernières lignes découlent du parcours décidé dans `AGENT.md` §2.1 :
le devis part par **SMS ou e-mail**, selon ce que le client a choisi. Chaque
canal ajoute un sous-traitant à autoriser et à lister.

**Le mode `dev` ne transmet rien.** Les fournisseurs `dev` sont déterministes
et n'effectuent aucun appel réseau. C'est la configuration à privilégier en
développement et en test : elle supprime la question à la racine.

**Ce qui déclenche le mode `dev`, depuis le 6 août 2026 : l'absence de clé.**
Auparavant, `LLM_PROVIDER` valait `dev` par défaut et rien d'autre ne le
changeait — poser une clé d'API ne branchait rien, ce qui a fait perdre une
journée. Désormais **une clé présente suffit à brancher le fournisseur
correspondant**, et il faut poser `LLM_PROVIDER=dev` explicitement pour couper
l'IA tout en gardant la clé en place.

Cette inversion mérite d'être comprise pour ce qu'elle est : **la protection ne
repose plus sur une valeur par défaut, mais sur l'absence de clé.** Une clé
posée quelque part — secret d'espace de travail, `.env.local`, variable
d'hébergeur — suffit à faire sortir l'audio et le texte dicté. Pour savoir ce
qu'il en est réellement sur une installation donnée : `npm run verifier:ia`, et
l'écran Réglages, qui l'affiche en clair.

> **État actuel : non conforme.** Aucun de ces fournisseurs n'est aujourd'hui
> listé dans un contrat, ni autorisé par un artisan. Cette liste doit être
> annexée au contrat de sous-traitance avant la première utilisation réelle.

## 4. Durées de conservation

Le principe : **ce qui n'est pas conservé ne peut pas fuir.** C'est la mesure de
sécurité la moins coûteuse et la plus efficace.

| Donnée | Durée actuelle | Durée à retenir |
|---|---|---|
| Fichiers orphelins | **24 h** — implémenté (`purgerFichiersEnAttente`) | Inchangé |
| Audio des notes vocales | **illimitée** | À supprimer une fois la transcription validée — l'audio n'a plus d'utilité |
| Transcriptions | **illimitée** | À supprimer avec les informations structurées validées |
| Chantiers, devis, clients | **illimitée** | Durée de la relation + prescription commerciale |
| Historique des prix | **illimitée** | Peut être **anonymisé** : l'intérêt est le prix, pas le client |
| Photos | **illimitée** | Durée de la relation |
| Journaux techniques | non défini | 6 à 12 mois |
| Compte supprimé | non défini | Effacement complet sous 30 jours |

> **Écart à combler.** Seuls les fichiers orphelins sont purgés. Il n'existe
> aujourd'hui **aucune politique de conservation** pour les données métier.
> C'est le principal manquement technique, et le plus simple à corriger : la
> mécanique de purge planifiée existe déjà, il suffit de l'étendre.

Deux gestes réduisent l'exposition sans rien coûter en fonctionnalité :
supprimer l'audio après validation de la transcription, et anonymiser
l'historique des prix.

## 5. Droits des personnes

Les clients des artisans exercent leurs droits **auprès de l'artisan**, pas
auprès de nous. Notre obligation (art. 28.3.e) est de lui fournir les moyens d'y
répondre :

| Droit | Ce que l'application doit permettre |
|---|---|
| Accès | Exporter toutes les données d'un client |
| Rectification | Déjà couvert : tous les champs sont éditables |
| Effacement | Supprimer un client et tout ce qui s'y rattache |
| Portabilité | Export dans un format lisible (JSON ou CSV) |
| Opposition | Ne pas soumettre un client donné à l'assistance IA |

> **À construire.** L'export et l'effacement complets d'un client n'existent
> pas encore.

## 6. Sécurité — ce qui est déjà en place

À porter au dossier : ces mesures existent et sont vérifiables dans le code.

- **Cloisonnement par entreprise appliqué en base** (RLS PostgreSQL), pas
  seulement dans le code applicatif. Les rôles applicatifs sont `NOBYPASSRLS`
  et la CI échoue si l'un d'eux devient trop privilégié.
- **Mots de passe** stockés sous forme d'empreinte (bcrypt).
- **En-têtes de sécurité** stricts : CSP, HSTS, anti-clickjacking,
  `Permissions-Policy` limitant caméra et micro.
- **Limitation de débit** adossée à Redis, jamais à la mémoire en production.
- **Purge planifiée** protégée par un secret, comparaison en temps constant.
- **Injection de consigne** : le texte dicté est explicitement présenté au
  modèle comme une donnée à analyser, jamais comme une instruction.
- **Sauvegarde et restauration** documentées et testées
  (`PRODUCTION_BACKUP_RESTORE.md`).

### Ce qui manque

- Chiffrement au repos de la base — dépend de l'hébergeur retenu.
- Journal des accès aux données clients (qui a consulté quoi, et quand).
- Filtrage des données personnelles avant envoi à Sentry.
- Politique de conservation (§4).
- Export et effacement d'un client (§5).

## 7. Violation de données — que faire, et en combien de temps

**La contrainte de temps est le point critique.** En tant que sous-traitant,
nous devons alerter l'artisan **sans délai** (art. 33.2). C'est *lui* qui
dispose ensuite de **72 heures** pour notifier la CNIL. Une alerte tardive de
notre part lui fait manquer son propre délai — et engage notre responsabilité.

```
T+0     Détection ou soupçon.
        → Ouvrir un incident (voir INCIDENT_RESPONSE.md).
        → Ne rien détruire : les journaux sont la preuve.

T+ qques heures
        → Établir : quelles données, combien de personnes,
          quelles entreprises concernées.
        → ALERTER LES ARTISANS CONCERNÉS. Sans attendre
          d'avoir tout compris — une alerte partielle vaut
          mieux qu'une alerte tardive.

T+72 h  → L'artisan notifie la CNIL. Nous lui fournissons
          les éléments techniques.

Ensuite → Si risque élevé : l'artisan informe ses clients (art. 34).
        → Consigner l'incident au registre des violations,
          y compris ceux qui n'ont pas été notifiés.
```

Le registre interne des violations est **obligatoire** (art. 33.5), même pour
les incidents jugés sans risque.

À préparer d'avance, à froid : le modèle de message d'alerte aux artisans. On ne
le rédige pas correctement dans l'urgence.

## 8. Faire accepter le contrat de sous-traitance

L'article 28.9 exige un écrit « y compris sous forme électronique ». Une
acceptation en ligne est donc valable — c'est ce que font tous les services de
ce type. Trois conditions pour qu'elle fasse foi :

1. **Un document distinct**, annexé aux conditions générales et non dilué dans
   leur corps. L'article 28.3 impose un contenu précis : objet, durée, nature et
   finalité, types de données, catégories de personnes, et huit obligations à la
   charge du sous-traitant. Un texte séparé est vérifiable et versionnable.
2. **Une acceptation explicite** : case à cocher **non pré-cochée**, distincte
   de celle des conditions générales, avec le texte accessible **avant**
   l'acceptation — pas derrière un lien qu'on découvre après.
3. **Une preuve conservée** : qui, quand, quelle version. Sans cette trace,
   l'acceptation est invérifiable le jour où elle compte.

> **À construire** : une table d'acceptations (utilisateur, version du document,
> horodatage, adresse IP) et la conservation de chaque version publiée. C'est
> peu de travail, et c'est ce qui transforme une case cochée en preuve.

Le changement de sous-traitants ultérieurs (§3) impose une **information
préalable** et une possibilité d'opposition : prévoir un canal pour cela, une
adresse e-mail suffit au départ.

## 9. Ce qui reste à faire

Par ordre d'urgence.

**Avant toute utilisation réelle avec des données de vrais clients :**

1. Faire rédiger le contrat de sous-traitance par un juriste, avec la liste des
   sous-traitants ultérieurs en annexe.
2. Arrêter la liste des fournisseurs d'IA réellement utilisés, et vérifier pour
   chacun : localisation, rétention, non-réutilisation pour l'entraînement.
3. Choisir un hébergement en **Union européenne**, base et stockage compris.
4. Mettre en place l'acceptation en ligne et sa trace (§8).

**Rapidement ensuite :**

5. Politique de conservation : suppression de l'audio après validation,
   anonymisation de l'historique des prix.
6. Export et effacement complets d'un client.
7. Filtrage des données personnelles avant envoi à Sentry.
8. Modèle d'alerte aux artisans, préparé à froid.

**Hors code, mais déterminant :**

9. Constituer une société — le patrimoine personnel n'est pas engagé de la même
   façon selon la forme juridique.
10. Souscrire une assurance cyber / responsabilité civile professionnelle.
