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

4. Envoi au client. Le chantier entre au planning.
5. Chantier terminé → l'agent prépare la facture et l'écriture de TVA,
   et les transmet à l'outil comptable (§6).
```

Chaque arrêt doit être franchissable en quelques secondes quand tout est juste.
Un arrêt qui demande dix minutes de vérification est un arrêt raté : c'est le
signe que l'agent n'a pas assez préparé.

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
| Envoi au client | à faire | Rédaction du message, PDF joint, envoi par e-mail, trace de ce qui est parti et quand |
| Réponse du client | à faire | Devis accepté / refusé / date renégociée, et ce que l'agent en fait |
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

> `docs/MVP.md` exclut aujourd'hui la TVA et la facturation du périmètre. Les
> y ramener — même sous cette forme « préparer et transmettre » — est une
> extension du périmètre, à acter explicitement dans ce document.

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

### Arbitrage A — Où vivent les données des clients du patron ?

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

### Arbitrage B — Le périmètre s'étend, il faut l'écrire

`docs/MVP.md` dit aujourd'hui : « Atlas MVP n'est pas un ERP. Il ne remplace ni
la facturation, ni la comptabilité », et la V1 s'arrête à l'export vers un
système de devis existant.

La vision décrite va plus loin : agenda, envoi, facturation, TVA. C'est
légitime, mais cela doit être **acté dans `MVP.md`**, sans quoi les deux
documents se contredisent et la prochaine décision se prendra dans le flou.

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
