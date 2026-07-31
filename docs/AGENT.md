# L'agent Atlas — cadrage

> Document de cadrage, à relire et valider avant développement. Il précise ce
> que l'agent fait, ce qu'il ne fait jamais, et ce qu'il reste à construire.
> Deux arbitrages restent ouverts : ils sont en fin de document, isolés, parce
> qu'ils ne peuvent être tranchés que par le patron.

## 1. Ce que c'est

Un agent au service du patron artisan, qui prend en charge le travail
administratif autour du chantier : préparer les devis, proposer une date à
partir de l'agenda, préparer l'envoi au client, et se raccorder à la
facturation et à la TVA.

**Ce n'est pas un logiciel de comptabilité.** C'est un assistant qui prépare le
travail comptable et le transmet aux outils qui font ce métier. La distinction
n'est pas cosmétique — voir §6.

L'objectif se mesure en temps rendu : les vingt minutes de bureau qui suivent
chaque visite de chantier doivent devenir trente secondes de relecture.

## 2. Le parcours, et ses points d'arrêt

Le principe directeur : **l'agent s'arrête et attend, il ne file pas jusqu'au
bout.** Chercher un créneau pour un devis qui va être réécrit est du travail
perdu, et une date proposée sur un prix faux est pire qu'inutile.

Trois arrêts jalonnent le parcours : **avant l'envoi du devis**, **avant son
départ chez le client**, et **avant le départ de la facture**. Ce sont les trois
moments où quelque chose quitte l'entreprise ou engage le patron.

```
1. Le patron dicte sa note sur le chantier.
2. L'agent transcrit, structure, cherche les tarifs, RÉDIGE LE DEVIS.

   ┌──────────────────────────────────────────────────────┐
   │  ARRÊT 1 — le patron vérifie et valide le devis.     │
   │  Rien ne continue tant qu'il n'a pas tranché.        │
   └──────────────────────────────────────────────────────┘

3. Une fois le devis validé, et seulement alors, l'agent :
     — lit l'agenda et propose un créneau d'intervention,
     — rédige le message au client,
     — prépare le PDF et l'envoi.

   ┌──────────────────────────────────────────────────────┐
   │  ARRÊT 2 — le patron valide l'envoi.                 │
   │  Rien ne part sans ce geste.                         │
   └──────────────────────────────────────────────────────┘

4. Envoi au client, par le canal convenu avec lui (§2.1).
   Le chantier passe EN ATTENTE DE RÉPONSE — il est bloqué, rien
   ne bouge tant que le client n'a pas répondu (§2.2).

   Réponse positive  → le chantier est planifié à la date retenue.
   Réponse négative  → le patron est notifié : « devis retourné ».

5. Chantier réalisé → onglet CHANTIERS TERMINÉS, bouton « Fin de
   chantier » (§2.3). La facture s'ouvre, pré-remplie sur le devis.

   ┌──────────────────────────────────────────────────────┐
   │  ARRÊT 3 — le patron confirme le départ de la        │
   │  facture. « Rien n'a changé ? » — un appui.          │
   └──────────────────────────────────────────────────────┘

   Puis : envoi au client, et données portées au relevé de TVA.
```

Chaque arrêt doit être franchissable en quelques secondes quand tout est juste.
Un arrêt qui demande dix minutes de vérification est un arrêt raté : c'est le
signe que l'agent n'a pas assez préparé.

### 2.1 Le canal de communication, convenu à l'avance

Avant tout envoi, le patron enregistre avec le client **par quel canal** le
devis lui parviendra : **SMS** ou **e-mail**. C'est un choix du client, pas une
préférence de l'application — un artisan sait que certains de ses clients ne
lisent jamais leurs mails.

Ce canal se règle à la création de la fiche client, et reste modifiable. Sans
canal renseigné, l'envoi est simplement impossible : mieux vaut bloquer que
d'envoyer dans le vide.

> **Conséquences à ne pas oublier.** Le SMS suppose un fournisseur d'envoi, donc
> un coût par message et un **sous-traitant supplémentaire** à inscrire au
> document `RGPD.md`. L'e-mail suppose un service d'envoi authentifié, faute de
> quoi les messages finissent en indésirables.

### 2.2 La réponse du client, et l'attente

Une fois le devis parti, **le chantier est bloqué**. Il n'entre pas au planning,
il n'est pas facturable, il attend. C'est un état à part entière, pas un devis
« en cours » perdu dans une liste.

**Le patron choisit la forme de sa proposition de date**, au moment de l'envoi :

- **une date ferme** — « intervention le 12 mars » ;
- **deux dates au choix** — le client retient celle qui l'arrange.

Le second cas évite un aller-retour quand l'agenda le permet. Le premier
convient quand le planning est contraint. C'est au patron de trancher, chantier
par chantier — l'agent propose les créneaux libres, il ne choisit pas la forme.

**Le client répond depuis une page qui lui est destinée.** Le SMS ou l'e-mail
porte un lien vers une page où il consulte le devis et répond : il accepte (en
retenant une date si deux lui sont proposées), ou il refuse.

> Cette page est une **surface publique**, la seule du produit. Elle impose :
> un lien impossible à deviner, une **expiration**, un accès en lecture seule
> limité au strict nécessaire — jamais la fiche client complète, jamais
> l'historique des prix, jamais les autres chantiers. C'est le point à traiter
> avec le plus de soin de tout le parcours.

**Réponse positive** → le chantier est débloqué et planifié à la date retenue,
qui est inscrite à l'agenda.

**Réponse négative** → le patron est notifié dans l'application : *devis
retourné*. Le chantier reste accessible pour être repris, corrigé et renvoyé.
Un refus n'est pas une fin : c'est souvent une négociation qui commence.

**Sans réponse** → il faut prévoir une relance, et un délai au bout duquel le
devis est considéré comme caduc. À défaut, les chantiers en attente
s'accumulent sans que personne ne les voie.

### 2.3 Fin de chantier, facture et TVA

Le patron retrouve ses chantiers réalisés dans un onglet **« Chantiers
terminés »**, où les devis sont **rangés par date**. En tête de chaque devis, un
bouton **« Fin de chantier »**.

Un appui **ouvre la facture, pré-remplie avec les montants du devis**, et pose
une seule question : *rien n'a changé ?*

```
   ┌──────────────────────────────────────────────────────┐
   │  ARRÊT 3 — le patron confirme le départ de la        │
   │  facture. Un appui si tout est conforme au devis.    │
   └──────────────────────────────────────────────────────┘
```

Ce troisième arrêt est **décidé**, pas optionnel. Un chantier finit rarement
exactement comme il a été devisé : travaux en plus, journée en moins, matériel
non utilisé. Une facture construite sur le devis et partie dans la foulée fait
arriver tout écart chez le client — et une facture fausse ne se modifie pas,
elle se corrige par un **avoir**. Le coût d'un appui est sans commune mesure
avec celui d'un avoir.

L'écran doit rester franchissable en un geste quand rien n'a bougé : les
montants du devis sont déjà là, il n'y a rien à saisir. C'est un contrôle, pas
une ressaisie.

La confirmation déclenche alors, en une seule fois :

1. l'**arrêt de la facture** sur les montants confirmés ;
2. son **envoi au client**, par le canal convenu ;
3. l'**inscription des données au relevé de TVA collectée**.

Rappel de §6 : Atlas **prépare** la facture et le relevé de TVA, il ne les
**émet** pas au sens légal. L'émission conforme revient à l'outil comptable.

## 3. Ce que l'agent ne fait jamais

Ces règles viennent de `PRINCIPES.md` et de `docs/MVP.md`. Elles ne sont pas
négociables au cas par cas — les changer suppose de changer ces documents.

- **Il n'invente jamais un prix.** Les prix viennent de la grille du patron, de
  l'historique, ou de nulle part. Un poste sans tarif fiable reste **vide et
  signalé**, jamais deviné, jamais « estimé ».
- **Il n'invente jamais une donnée client.** Nom, adresse, téléphone :
  uniquement ce qui a été dit ou déjà enregistré. Un champ absent reste vide.
- **Il n'invente jamais une prestation.** En cas d'ambiguïté, il signale au lieu
  de supposer.
- **Il n'écrit jamais directement dans les données.** Toute modification passe
  par une proposition structurée que le patron confirme. C'est déjà ainsi que
  le code est bâti (`assistant-service.ts`).
- **Il n'envoie, ne valide et ne facture jamais de lui-même.**
- **Il ne choisit jamais entre deux tarifs plausibles.** Il présente les deux.

Corollaire : chaque ligne produite doit pouvoir être rattachée à ce que le
patron a réellement dit et à une entrée réelle de sa grille. Une explication de
l'agent ne doit jamais citer un calcul écarté comme s'il était la source du
prix — le code mémorise déjà explicitement quelle branche a produit le prix
(`proposition-builder.ts`, champ `sourcePrix`).

## 4. Ce qui existe déjà

L'essentiel du socle est construit dans l'application Next.js. Inventaire réel,
vérifié dans le code :

**L'agent lui-même** — `src/server/ai/services/assistant-service.ts`. Un
copilote qui répond, explique, et prépare des propositions. Il ne peut rien
écrire : c'est verrouillé par construction, pas seulement par consigne.

**Quinze outils** — `src/server/ai/tools/` : lire les informations du chantier,
les prestations, le matériel, la transcription, les notes, les devis, les
tarifs ; chercher une prestation ou un matériel au catalogue, des tarifs
compatibles, des synonymes, l'historique des prix, dans les documents ;
calculer un chiffrage ; exécuter un workflow.

**Les fournisseurs d'IA** — Anthropic, OpenAI, Gemini pour le raisonnement ;
Deepgram, OpenAI, Google pour la transcription. Interchangeables par variable
d'environnement, plus un mode `dev` déterministe qui ne fait aucun appel réseau
(précieux pour les tests).

**Les données** — 25 tables : `chantiers`, `clients`, `devis`, `lignes_devis`,
`tarifs`, `historique_prix`, `catalogue_prestations`, `catalogue_materiels`,
`notes_vocales`, `photos`, `documents` et `fragments_documents` (recherche
documentaire), `propositions_ia`, `entreprises`, `membres_entreprise`. Avec
cloisonnement par entreprise appliqué en base (RLS), pas seulement dans le code.

**Le reste** — comptes et authentification, génération de PDF, stockage de
fichiers, limitation de débit, purge planifiée, journalisation.

**Les écrans** — chantiers, note vocale, transcription, informations
structurées, prix, export, planning, catalogue, réglages tarifs.

## 5. Ce qu'il reste à construire

| Brique | État | Remarque |
|---|---|---|
| Agenda Google | à faire | Connexion du compte, lecture des disponibilités, proposition de créneau, écriture de l'intervention après validation |
| Canal de communication du client | à faire | Champ SMS / e-mail sur la fiche client ; envoi impossible sans |
| Envoi au client | à faire | Message, PDF joint, envoi SMS **et** e-mail, trace de ce qui est parti et quand |
| Proposition de date : ferme ou au choix | à faire | Le patron tranche à l'envoi ; une date, ou deux entre lesquelles le client retient |
| Page de réponse du client | à faire | **Seule surface publique du produit** : lien non devinable, expiration, lecture seule limitée au devis |
| État « en attente de réponse » | à faire | Le chantier est bloqué : ni planifié, ni facturable |
| Notification « devis retourné » | à faire | Le patron est prévenu d'un refus, et peut reprendre le devis |
| Relance et caducité | à faire | Sans quoi les chantiers sans réponse s'accumulent invisibles |
| Onglet « Chantiers terminés » | à faire | Devis rangés par date, bouton « Fin de chantier » en tête |
| Fin de chantier → facture + TVA | à faire | Un appui : facture construite depuis le devis, envoyée, données portées au relevé de TVA (réserve §2.3) |
| Factures | à brancher | Voir §6 — ne pas recoder |
| TVA | à brancher | Voir §6 — ne pas recoder |
| Enchaînement complet | à faire | Aujourd'hui l'agent répond et propose ; il ne pilote pas encore le parcours de bout en bout avec ses points d'arrêt |
| Mise en ligne | à faire | L'application Next.js n'est hébergée nulle part (§7) |

## 6. Facturation et TVA : on ne les recode pas

`PRINCIPES.md` est déjà explicite là-dessus, et cette décision tient :

> La facturation électronique conforme (numérotation inviolable, archivage,
> Factur-X/UBL/CII, obligations 2026/2027) est un projet à part et un risque
> juridique. On s'y branche par **API** sur un outil existant (Pennylane,
> Evoliz, Tiime, Sellsy, Abby…).

C'est la bonne réponse à l'ambition « agent type comptable ». Une facture non
conforme n'est pas un défaut d'affichage : c'est un risque légal pour l'artisan,
et une numérotation cassée ne se rattrape pas après coup.

**Le rôle de l'agent est donc de préparer, pas d'émettre.** Il rassemble les
lignes, le client, les taux, la période ; l'outil comptable émet le document
légal et en porte la responsabilité. Le patron garde son comptable et son
logiciel — l'agent lui épargne la saisie.

Les écrans `facture-modele.html` et `tva-modele.html` de `appli/` restent ce
qu'ils sont : des maquettes, utiles pour montrer l'intention, destinées à être
remplacées par ce branchement.

> **Acté le 2026-07-31.** `docs/MVP.md` excluait la TVA et la facturation du
> périmètre ; l'extension y est désormais inscrite, et l'**émission légale**
> reste explicitement hors périmètre — définitivement, pas « pas encore ».

## 7. Où ça tourne

L'application Next.js a besoin d'un serveur, d'une base PostgreSQL et de Redis.
GitHub Pages ne peut pas l'héberger : Pages sert des fichiers statiques, sans
exécution côté serveur. C'est précisément pourquoi seul `appli/` y est publié.

Deux besoins nouveaux renforcent cette contrainte :

- **Google Agenda** exige un secret d'application et une connexion OAuth, donc
  un serveur. Un secret placé dans une page publique est un secret perdu.
- **L'envoi d'e-mails** exige un service d'envoi authentifié, donc un serveur.

Il faudra donc choisir un hébergement, et cela aura un coût mensuel. C'est un
arbitrage à faire, pas une évidence technique.

## 8. Les deux arbitrages qui restent

Ils ne sont pas techniques. Ils engagent le produit et la responsabilité du
patron — je ne les prends pas à sa place.

### Arbitrage A — Où vivent les données des clients du patron ? — TRANCHÉ

> **Décision du 2026-07-31 : oui, les données vivent sur nos serveurs.**
> `appli/PRINCIPES.md` porte désormais cette précision, et `docs/RGPD.md` en
> tire les conséquences. Restent à honorer, dans cet ordre : hébergement en
> Union européenne, contrat de sous-traitance, durées de conservation, et la
> promesse réécrite envers les artisans.
>
> Le raisonnement qui a conduit à trancher est conservé ci-dessous.

Contradiction réelle entre les deux codes :

- `PRINCIPES.md` pose que l'application est **local-first** : « la grille de
  tarifs et les données des clients du patron restent sur son appareil
  (`localStorage`), **jamais sur nos serveurs** ». C'est ce que fait `appli/`.
- L'application Next.js stocke ces mêmes données dans une base **sur un
  serveur** : `clients`, `chantiers`, `devis` y sont des tables.

Les deux ne peuvent pas être vrais en même temps. Or l'agenda partagé, l'envoi
d'e-mails et l'historique des prix supposent un serveur : le local-first strict
est incompatible avec la vision décrite.

Ce qu'il faut trancher : **assume-t-on que les données des clients du patron
vivent sur nos serveurs ?** Si oui, `PRINCIPES.md` doit être corrigé, et les
engagements pris envers les artisans doivent l'être aussi (hébergement en
Europe, chiffrement, durée de conservation, sortie des données, RGPD). Ce n'est
pas une formalité : c'est ce qu'un artisan lira avant de confier son fichier
clients.

### Arbitrage B — Le périmètre s'étend, il faut l'écrire — TRANCHÉ

> **Acté le 2026-07-31 dans `docs/MVP.md`.** L'extension — agenda, envoi au
> client, préparation de la facture et de la TVA — y est inscrite, avec la
> limite qui la rend tenable : l'**émission légale** des factures reste hors
> périmètre définitivement.

Le parcours socle décrit au §3 de `MVP.md` reste la référence de ce qui existe
et fonctionne. `AGENT.md` fait autorité sur la direction.

## 9. Ce que je propose de faire ensuite

Une fois ce cadrage validé, dans cet ordre :

1. Mettre à jour `MVP.md` et `PRINCIPES.md` selon les arbitrages A et B, pour
   que les documents disent la même chose que le produit.
2. Mettre l'application Next.js en ligne, pour la voir tourner pour de vrai
   avant d'y ajouter des briques.
3. Construire l'enchaînement complet avec ses deux points d'arrêt — d'abord
   sans agenda ni envoi, pour valider la mécanique.
4. Brancher l'agenda Google.
5. Brancher l'envoi au client.
6. Brancher l'outil comptable pour les factures et la TVA.

Chaque étape reste vérifiable seule, et aucune ne démarre avant que la
précédente fonctionne.
