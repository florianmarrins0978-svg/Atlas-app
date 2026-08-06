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
| 1 | Deux fournisseurs d'IA retenus | **Le code n'attend plus rien** depuis le 2026-08-06 : poser `ANTHROPIC_API_KEY` et `OPENAI_API_KEY` suffit à brancher l'IA (`ARCHITECTURE.md` §25), et `npm run verifier:ia` dit l'état réel. Ce qui reste bloqué est le **contrat**, pas la technique : sans lui, seules des données inventées peuvent être dictées. Sans clé, la dictée est recopiée mot à mot (`src/server/ai/lecture-litterale.ts`) — elle va jusqu'au devis chiffré, mais elle ignore qu'un chêne mort s'abat et qu'une haie se taille |
| 2 | Contrat de sous-traitance rédigé | Remplacer les canevas sans valeur par les textes réels |
| 3 | Hébergement européen choisi | Déployer — **sans quoi personne ne peut se servir de l'application** |
| 4 | Société constituée, assurance souscrite | Rien côté code |
| 5 | ~~Fournisseur SMS et e-mail~~ — **tranché le 2026-08-04 : il n'y en aura pas** | Rien de bloqué. Le devis part de la messagerie du patron (`ARCHITECTURE.md` §13). Ne restent suspendus qu'aux conforts : relance automatique, accusé de réception, code SMS |

---

## Ce que je peux faire seul

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
code à usage unique envoyé au client au moment où il accepte.

**Sans objet en l'état** : le patron a écarté tout fournisseur d'envoi
(`ARCHITECTURE.md` §13), et un code qu'il devrait transmettre lui-même
n'apporterait rien. À rouvrir seulement si un fournisseur est un jour souscrit.

### 3. Relance automatique d'un devis sans réponse

L'état « à relancer » existe, s'affiche, et le lien reste proposé pour un renvoi
manuel. **Sans objet en l'état**, pour la même raison qu'au point 2 : la relance
part de la messagerie du patron, comme l'envoi.

### 4. L'assistant répond en JSON brut

Interrogé « Comment a été envoyé le devis ? », il a répondu :
`D'après LireDevis, voici ce que j'ai trouvé : {"existe":true,"numeroCommercial":"2026-0003",…}`.
Le patron n'a pas à lire du JSON. L'assistant doit répondre en français, ou dire
qu'il ne sait pas — et jamais recracher la sortie d'un outil telle quelle.

### 5. Les équipes nommées, si l'entreprise grandit

Le patron a retenu un **compteur** d'équipes (Réglages), pas des équipes
nommées : il sait combien de chantiers il mène de front, pas encore qui va où.
Le jour où il aura deux vraies équipes distinctes, la suite est une table
`equipes` + `chantiers.equipe_id`, et un planning qui se lit par colonne.

Écarté aussi, et volontairement : les **heures réelles** (« la demi-journée
suffit ») et la **capacité en hommes** — `taille_equipe` est du texte libre, il
faudrait le fiabiliser avant d'en faire une contrainte. Voir `ARCHITECTURE.md`
§22 pour les arbitrages.

### 6. Rien ne mène le patron d'un écran au suivant

**Le tronçon principal est réglé** (2026-08-04) : depuis la transcription, un
seul appui va jusqu'au devis chiffré. Restent les marches d'à côté — après une
photo, après un tarif enregistré, après une facture émise, rien n'indique où
l'on va. Un écran qui ne dit pas la suite se lit comme une application en panne,
et c'est déjà arrivé.

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
- ~~La dictée arrivait amputée à l'écran : découpage, durée, vocabulaire, déchets~~ — 2026-08-03
- ~~Écrire le devis soi-même depuis l'écran Informations~~ — 2026-08-03
- ~~Le devis doublait au retour arrière du navigateur (4 017,60 € au lieu de 2 008,80 €)~~ — 2026-08-03
- ~~« Fin de chantier » injoignable sur un chantier planifié~~ — 2026-08-03
- ~~Planifier en demi-journées, et compter les équipes (le client ne voit que la date)~~ — 2026-08-03
- ~~Le client peut demander une correction, et son message parvient au patron~~ — 2026-08-03
- ~~La durée du chantier se choisit à la molette (½ journée à 100 jours)~~ — 2026-08-03
- ~~La durée dictée n'entrait pas dans la planification : un chantier de 2 jours n'en bloquait qu'un~~ — 2026-08-03
- ~~Le SMS s'ouvrait sans destinataire ; le canal se change désormais, et la coordonnée manquante se saisit sur place~~ — 2026-08-04
- ~~De la dictée au devis en un seul geste, et plus aucun écran mort quand le fournisseur répond à côté~~ — 2026-08-04
- ~~L'espace d'essai récupère le code neuf à chaque allumage, et l'application annonce sa version~~ — 2026-08-04
- ~~La date des documents s'écrit jour/mois/année~~ — 2026-08-04
- ~~La bande des durées est aussi sur l'écran Informations, là où il la cherchait~~ — 2026-08-04
- ~~Rédiger le devis entièrement à la main, depuis la fiche du chantier~~ — 2026-08-04
- ~~Retirer la case « Nom du chantier » : plus rien n'est obligatoire à la création~~ — 2026-08-05
- ~~« Rédiger à la main » ouvre le devis ENTIER, à l'image du modèle, et il reste dans Atlas~~ — 2026-08-05
