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

**Deux arrêts**, pas plus : **avant l'envoi du devis**, et **avant le départ de
la facture**. Ce sont les deux seuls moments où le patron engage sa parole et
son argent.

> **Un arrêt intermédiaire a été retiré.** Une première version faisait valider
> le devis, puis re-valider l'envoi. C'était un écran de trop : valider un devis
> *est* l'ordre de l'envoyer. On ne redemande pas à quelqu'un s'il est sûr de ce
> qu'il vient de décider — un arrêt qui ne peut mener qu'à « oui » n'est pas un
> contrôle, c'est une formalité. Le choix du nombre de dates, lui, n'est pas un
> contrôle mais un **réglage de l'envoi** : il se pose dans la foulée de la
> validation, pas dans un second temps.

```
1. Le patron dicte sa note sur le chantier.
2. L'agent transcrit, structure, cherche les tarifs, RÉDIGE LE DEVIS.

   ┌──────────────────────────────────────────────────────┐
   │  ARRÊT 1 — le patron vérifie et valide le devis.     │
   │  Une question dans la foulée : une date, ou deux ?   │
   │  Sa réponse déclenche l'envoi. Rien d'autre à faire. │
   └──────────────────────────────────────────────────────┘

3. L'agent fait tout seul : il retient dans l'agenda la ou les
   dates libres, rédige le message, prépare le devis et l'envoie.

4. Envoi au client, par le canal convenu avec lui (§2.1).
   Le chantier passe EN ATTENTE DE RÉPONSE — il est bloqué, rien
   ne bouge tant que le client n'a pas répondu (§2.2).

   Réponse positive  → le chantier est planifié à la date retenue.
   Réponse négative  → le patron est notifié : « devis retourné ».

5. Chantier réalisé → onglet CHANTIERS TERMINÉS, bouton « Fin de
   chantier » (§2.3). La facture s'ouvre, pré-remplie sur le devis.

   ┌──────────────────────────────────────────────────────┐
   │  ARRÊT 2 — le patron confirme le départ de la        │
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

**Une seule question au patron, dans la foulée de sa validation** : une date, ou
deux ?

- **une date ferme** — « intervention le 12 mars » ;
- **deux dates au choix** — le client retient celle qui l'arrange.

Le second cas évite un aller-retour quand l'agenda le permet. Le premier
convient quand le planning est contraint. C'est au patron de trancher, chantier
par chantier — l'agent propose les créneaux libres, il ne choisit pas la forme.

Sa réponse déclenche tout le reste : l'agent retient les créneaux dans l'agenda,
rédige le message et envoie. **Le patron n'a plus rien à faire.**

### 2.2 bis La page du client : devis et dates sur le même écran

Le SMS ou l'e-mail porte **un lien**. Il ouvre une page où le client trouve, au
même endroit, le devis et le choix de la date :

```
   ┌─────────────────────────────────────────────┐
   │  Devis n° 2026-042                          │
   │  Élagage — 2 jours              1 240 €     │
   │  [ Voir le devis complet PDF ]              │
   ├─────────────────────────────────────────────┤
   │  Quelle date vous arrange ?                 │
   │                                             │
   │  ( ) Lundi 23 mars                          │
   │  ( ) Jeudi 27 mars                          │
   │  ( ) Aucune des deux — je propose :         │
   │      [ 📅  jj/mm/aaaa ]                     │
   │      [ précision (facultatif) ............ ]│
   ├─────────────────────────────────────────────┤
   │  ☐ Je demande que les travaux commencent    │
   │    avant la fin de mon délai de             │
   │    rétractation de 14 jours.                │
   │    (formulation à faire valider)            │
   ├─────────────────────────────────────────────┤
   │  [        J'accepte ce devis        ]       │
   │  [      Je ne donne pas suite       ]       │
   └─────────────────────────────────────────────┘
```

#### La contre-proposition de date

Les deux dates proposées ne conviennent pas toujours. Sans troisième voie, le
client doit téléphoner — et tout le gain du parcours disparaît dans un
aller-retour.

**Un sélecteur de date, pas un champ libre.** Un champ de texte produit « le
23 », « fin mars », « après mes congés » : des réponses qu'il faut interpréter,
donc deviner. Le sélecteur natif du téléphone ouvre le calendrier de l'appareil
et rend une date sans ambiguïté. Un champ de **précision facultatif** l'accompagne
pour ce qui n'est pas une date — « plutôt le matin », « pas avant 9 h » — sans
jamais servir à exprimer la date elle-même.

**Le sélecteur ne propose que des dates réellement libres.** Les jours déjà
occupés par un chantier sont désactivés : le client ne peut pas les choisir.
C'est ce qui supprime l'aller-retour — proposer une date impossible, c'est
relancer l'échange qu'on cherchait justement à éviter.

> **Ce qui sort de l'entreprise, et ce qui n'en sort pas.** La page reçoit une
> liste de **dates**, rien d'autre. Aucun intitulé de chantier, aucun nom de
> client, aucune adresse, aucune durée, aucun motif. Le client apprend que le
> patron n'est pas libre le 24 — exactement ce qu'il aurait appris en
> téléphonant. Il n'apprend ni chez qui, ni pour quoi.
>
> La liste est **bornée à la fenêtre de proposition** (par défaut trois mois) :
> au-delà, elle n'aurait aucune utilité et ne ferait qu'exposer davantage.

**Un jour est occupé s'il porte un chantier**, sans finesse de demi-journée pour
l'instant. Un artisan qui pose une demi-journée sait la gérer ; un client qui se
voit proposer un créneau déjà pris, non.

**Le devis est accepté, la date reste ouverte.** C'est la règle qui compte : une
contre-proposition de date **ne remet pas le prix en cause**. Le client a dit
oui au devis — c'est l'événement commercialement décisif, il est enregistré
comme tel. Seule la date reste à convenir. Confondre les deux ferait perdre des
chantiers acceptés pour une question de calendrier.

**Le patron n'a rien à confirmer.** Puisque le client n'a pu retenir qu'un jour
libre, lui redemander son accord serait un arrêt qui ne peut mener qu'à « oui » —
soit précisément la formalité écartée plus haut. Le chantier est planifié, et le
patron **prévenu**, pas interrogé.

> **La disponibilité affichée est un instantané.** Entre l'affichage de la page
> et le clic, il peut se passer des heures — le patron a pu prendre ce jour, ou
> un autre client a pu le retenir. La disponibilité est donc **revérifiée au
> moment de la validation**, côté serveur, jamais sur la seule foi de ce que la
> page affichait.
>
> Si le jour vient d'être pris : on ne bloque pas le client, on lui dit — « cette
> date vient d'être retenue, en voici d'autres » — et **son acceptation du devis
> reste acquise** (le prix ne dépend pas du calendrier). Sans cette
> revérification, deux clients pourraient retenir le même jour, et l'aller-retour
> qu'on voulait supprimer reviendrait, en pire : après coup.

La case de démarrage anticipé n'apparaît que **lorsqu'elle est nécessaire** :
si toutes les dates proposées tombent après le délai de quatorze jours, elle
n'a aucun objet et encombrerait l'écran. Elle est **jamais pré-cochée** — comme
toute case qui recueille un consentement (même principe que `RGPD.md` §8) — et
son état est conservé avec l'acceptation, puisque c'est elle qui autorise le
patron à intervenir plus tôt.

Si le client retient une date proche **sans** cocher, il ne faut ni bloquer
l'acceptation ni intervenir quand même : le devis est accepté, et le patron est
prévenu que la date demande son accord explicite.

**Une page, pas un fichier interactif.** Un PDF à remplir suppose de
l'enregistrer, l'ouvrir ailleurs, le remplir, le renvoyer : sur dix clients, la
plupart abandonnent en route. La page se répond d'un doigt, et le patron est
prévenu dans la seconde. Le PDF reste téléchargeable pour qui le veut — il n'est
simplement plus le chemin obligé.

> Cette page est une **surface publique**, la seule du produit. Elle impose :
> un lien impossible à deviner, une **expiration**, un accès en lecture seule
> limité au strict nécessaire — jamais la fiche client complète, jamais
> l'historique des prix, jamais les autres chantiers. C'est le point à traiter
> avec le plus de soin de tout le parcours.

### 2.2 ter La signature : un clic tracé, pas un PDF renvoyé

**Ne pas demander au client de renvoyer le devis signé.** C'est contre-intuitif
mais mieux fondé :

- La **signature électronique** est reconnue par le Code civil (art. 1366-1367).
  C'est le mécanisme qu'emploient tous les logiciels de devis du marché.
- Ce qui fait la valeur de preuve n'est pas un tracé au doigt sur un PDF, mais
  la **trace du consentement** : qui a cliqué, quand, depuis quelle adresse, sur
  **quelle version exacte** du devis — dont on conserve l'empreinte.
- Un PDF renvoyé par courriel a en pratique *moins* de force probante qu'un clic
  correctement tracé : rien n'y atteste qui l'a signé ni quand.

**Renforcement recommandé, et peu coûteux** : un **code à quatre chiffres envoyé
par SMS**, à saisir avant de valider. Le client démontre qu'il détient le
téléphone enregistré au dossier. Le canal SMS existant (§2.1) suffit.

À conserver pour chaque acceptation : identifiant du devis, empreinte du PDF
exact, horodatage, adresse IP, canal utilisé, et le code SMS validé le cas
échéant.

> **Délai de rétractation — à confirmer par le juriste.** Un particulier qui
> accepte un devis **à distance** dispose d'un délai de rétractation de
> **14 jours**, et les travaux ne peuvent en principe pas débuter avant son
> terme, sauf **demande expresse** de sa part.
>
> Cela touche directement le parcours : une date proposée à moins de quatorze
> jours tombe dans ce délai. La page du client doit donc porter une case
> distincte — « je demande que les travaux commencent avant la fin du délai de
> rétractation » — et cette demande doit être conservée avec l'acceptation.
> C'est peu de code ; c'est la formulation qui doit être validée.

**Réponse positive** → le chantier est débloqué et planifié à la date retenue,
qui est inscrite à l'agenda.

**Réponse positive avec une autre date** → le client n'ayant pu retenir qu'un
jour libre, le chantier est planifié directement et le patron **prévenu**. Voir
la contre-proposition ci-dessous.

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
| Canal de communication du client | fait | Recueilli à la création du chantier, déduit quand une seule coordonnée est donnée ; envoi impossible sans |
| Envoi au client | partiel | Le lien et la trace existent ; **aucun fournisseur de SMS ni d'e-mail n'est branché** — le lien est remis au patron, qui le transmet lui-même |
| Proposition de date : ferme ou au choix | fait | Une question au patron dans la foulée de sa validation ; sa réponse déclenche l'envoi |
| Page de réponse du client | fait | **Seule surface publique du produit** : devis + choix de date sur le même écran, lien non devinable, expiration, lecture seule limitée au devis |
| Acceptation tracée valant signature | partiel | Empreinte du PDF, horodatage, adresse et canal sont conservés ; le code SMS en renfort reste à faire |
| Demande de démarrage anticipé | fait | Case distincte liée au délai de rétractation de 14 jours (§2.2 ter) |
| Contre-proposition de date par le client | fait | Sélecteur limité aux jours libres ; devis accepté, date retenue directement |
| Liste des jours occupés transmise à la page | fait | **Des dates, rien d'autre** : ni intitulé, ni client, ni durée ; bornée à la fenêtre de proposition |
| Revérification de la disponibilité à la validation | fait | L'affichage est un instantané : deux clients pourraient viser le même jour |
| État « en attente de réponse » | à faire | Le chantier est bloqué : ni planifié, ni facturable |
| Notification « devis retourné » | à faire | Le patron est prévenu d'un refus, et peut reprendre le devis |
| Relance et caducité | à faire | Sans quoi les chantiers sans réponse s'accumulent invisibles |
| Onglet « Chantiers terminés » | fait | Chantiers dont la date d'intervention est passée, rangés par date, bouton « Fin de chantier » en tête |
| Fin de chantier → facture + TVA | partiel | Facture construite depuis le devis, arrêt 3, relevé de TVA calculé à partir des factures émises. **Son envoi au client attend le même fournisseur que le devis** (réserve §2.3) |
| Émission légale des factures | à brancher | Voir §6 — préparées ici, **jamais émises** ici ; branchement API sur l'outil comptable |
| Déclaration de TVA | à brancher | Voir §6 — le relevé est préparé, la déclaration reste à l'outil comptable |
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
