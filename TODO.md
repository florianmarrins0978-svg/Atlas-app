# Prochaines tâches

Par ordre de priorité. Une tâche terminée se **barre** avec sa date plutôt que
de disparaître : savoir qu'elle a été traitée évite de la rouvrir.

Ce fichier porte le travail de **développement**. Ce qui bloque et n'avancera
pas en codant est dans `docs/A-FAIRE.md` — tenu pour le patron, dans son
langage, et rien n'y entre sans son accord.

---

## Bloqué par une décision du patron

Rien à coder tant que ces points ne sont pas tranchés. Ne pas les redécouvrir :
ils sont écrits, avec leur coût et leur propriétaire, dans `docs/A-FAIRE.md`.

| | Ce qui débloque | Ce que je fais alors |
|---|---|---|
| 1 | Deux fournisseurs d'IA retenus | Écrire le raccordement si ce n'est ni `anthropic` ni `openai` (les quatre autres sont des coquilles vides), verrouiller la configuration sur eux, tenir `docs/RGPD.md` §3 à jour |
| 2 | Contrat de sous-traitance rédigé | Remplacer les canevas sans valeur par les textes réels |
| 3 | Hébergement européen choisi | Déployer — **sans quoi personne ne peut se servir de l'application** |
| 4 | Société constituée, assurance souscrite | Rien côté code |
| 5 | Fournisseur SMS et e-mail | L'envoi, la trace, la relance automatique, le départ de la facture |

---

## Ce que je peux faire seul

### 0. L'agent qui apprend — le vrai sujet

Le tapis roulant (dictée → devis, d'un seul geste) est en place. La suite, dans
l'ordre décidé avec le patron le 5 août 2026 :

| | Quoi | Pourquoi maintenant |
|---|---|---|
| a | **Mémoire des corrections.** Ce que le patron change à l'arrêt 1 devient une leçon qu'il valide. | Rien ne retient ses corrections aujourd'hui : chaque devis repart de zéro. C'est le début du « s'auto-alimente » qu'il demande. |
| b | **Entretien de départ.** Il n'a aucun ancien devis à donner en référence — c'est donc l'agent qui l'interroge une fois et écrit ses règles. | Sans ça, l'agent démarre en ne sachant rien et apprend aux frais du patron. |
| c | **Écart devis / facture.** Les données existent déjà des deux côtés. | La meilleure leçon qui soit : ce qui avait été mal estimé s'y voit tout seul. |
| d | **Photos ↔ prix.** Conserver le lien entre les photos d'un chantier et le devis qui a suivi. | Objectif du patron : « à force de comparer les photos des arbres et les devis, il devra proposer un prix juste ». Impossible aujourd'hui — mais **l'accumulation doit commencer maintenant**, sinon dans six mois il n'y aura toujours rien à apprendre. |

**Réserve levée le 5 août 2026.** Un prix déduit d'une photo est une estimation,
ce que `docs/AGENT.md` §3 interdisait. Le patron a tranché : *« rien ne sera
jamais envoyé sans vérification du patron, ça restera qu'une proposition. »* La
règle est assouplie — l'estimation est permise **à condition d'être signalée
comme telle**, et c'est l'arrêt 1 qui porte la garantie. Voir `AGENT.md` §3.

**Et une contrainte de fond, soulevée par le patron le même jour :** *« si
l'appli n'a aucune mémoire, comment l'IA va enregistrer et se souvenir ? »* Il a
raison, et ça conditionne (a) à (d). L'application a bien une mémoire — une base
PostgreSQL sur volume persistant — mais **celle du banc d'essai meurt avec
l'espace de travail**, qui est jetable par construction. Tout ce qui s'apprend
ne sera durable qu'une fois l'hébergement choisi (point 3 de `A-FAIRE.md`).
Construire l'apprentissage sur le banc reste utile pour l'éprouver ; ce qui s'y
accumule ne doit pas être présenté comme conservé.


### 1. Agenda Google — lecture des disponibilités

**Partiellement bloqué.** La connexion du compte demande des identifiants OAuth
que le patron doit créer ; le reste est codable.

Aujourd'hui, les jours libres se déduisent des seuls chantiers planifiés dans
Atlas (`src/server/disponibilites.ts`). Un patron qui tient son agenda ailleurs
verra donc proposer des jours où il est déjà pris — et c'est le client qui
choisira ce jour-là.

À faire une fois les identifiants disponibles : lecture des événements sur la
fenêtre de proposition, fusion avec les chantiers Atlas dans la **même** fonction
de disponibilité (jamais un second calcul), et écriture de l'intervention après
acceptation.

### 2. Code SMS en renfort de l'acceptation

L'acceptation conserve déjà l'empreinte du PDF, l'horodatage, l'adresse IP et le
canal (`docs/AGENT.md` §5, ligne « Acceptation tracée »). Ce qui manque est un
code à usage unique envoyé au client au moment où il accepte — ce qui **dépend du
point 5 ci-dessus**.

### 3. Relance automatique d'un devis sans réponse

L'état « à relancer » existe, s'affiche, et le lien reste proposé pour un renvoi
manuel. **L'automatiser suppose un fournisseur d'envoi** — point 5 ci-dessus.

### 4. L'assistant répond en JSON brut

Interrogé « Comment a été envoyé le devis ? », il a répondu :
`D'après LireDevis, voici ce que j'ai trouvé : {"existe":true,"numeroCommercial":"2026-0003",…}`.
Le patron n'a pas à lire du JSON. L'assistant doit répondre en français, ou dire
qu'il ne sait pas — et jamais recracher la sortie d'un outil telle quelle.

### 5. Rien ne mène le patron d'un écran au suivant

Après « Enregistrer le texte », rien n'indique qu'il faut ensuite générer le
brouillon, puis le confirmer pour l'ajouter au chantier. Le lien « Continuer vers
les informations → » a été ajouté à la transcription ; les autres marches du
parcours n'en ont pas. Un écran qui ne dit pas où l'on va se lit comme une
application en panne — c'est déjà arrivé.

---

## Terminé

- ~~Reprendre l'application Arborea sans le site vitrine, et la publier~~ — 2026-07-31
- ~~Vérifier le site publié à son adresse publique~~ — 2026-07-31
- ~~Cadrer l'agent (`docs/AGENT.md`) et la conformité (`docs/RGPD.md`)~~ — 2026-08-01
- ~~Acceptation des documents légaux avec empreinte~~ — 2026-08-01
- ~~Page publique de réponse du client, jeton, expiration, contre-proposition~~ — 2026-08-01
- ~~Purge de l'audio, export et effacement d'un client~~ — 2026-08-01
- ~~Envoi du devis au client, canal recueilli à la création~~ — 2026-08-01
- ~~Onglet « Terminés », fin de chantier, facture, relevé de TVA~~ — 2026-08-01
- ~~Suivi du devis parti : cinq états, notification, reprise~~ — 2026-08-01
- ~~Mémoire permanente du dépôt (ces fichiers)~~ — 2026-08-01
- ~~Caducité distincte du refus, et remontée à l'accueil~~ — 2026-08-01
- ~~Compteur d'accueil : ne plus compter les chantiers facturés~~ — 2026-08-01
- ~~Découpler les maquettes `/design/*` du type de statut vivant~~ — 2026-08-01
- ~~Le devis PDF reprend le modèle d'Arborea, et se pagine~~ — 2026-08-03
- ~~`test-reglages-e2e.ts` : attendre l'enregistrement, pas un délai fixe~~ — 2026-08-03
- ~~Document PDF pour la facture, sur le moteur partagé avec le devis~~ — 2026-08-03
- ~~Le devis à 0 € : bouton grisé, marche à suivre, et refus côté serveur~~ — 2026-08-03
- ~~Navigation : la barre du bas reste (décidé) ; l'action principale prend la carte d'Arborea~~ — 2026-08-03
