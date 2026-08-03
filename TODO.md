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
| 1 | Deux fournisseurs d'IA retenus | Verrouiller la configuration sur eux, tenir `docs/RGPD.md` §3 à jour — et **enfin lire vraiment la dictée** : sans modèle, `analyse-demande.ts` découpe sans comprendre (il ne perd plus rien, c'est tout ce qu'on peut lui demander) |
| 2 | Contrat de sous-traitance rédigé | Remplacer les canevas sans valeur par les textes réels |
| 3 | Hébergement européen choisi | Déployer — **sans quoi personne ne peut se servir de l'application** |
| 4 | Société constituée, assurance souscrite | Rien côté code |
| 5 | Fournisseur SMS et e-mail | L'envoi, la trace, la relance automatique, le départ de la facture |

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

### 5. Planifier autrement qu'en journées entières — à trancher avec le patron

**Sa question du 3 août 2026**, en deux morceaux :

> « J'ai déjà un chantier le 6 août, donc pour mon nouveau client on ne propose
> pas le 6 août. Mais si mon 1er chantier du 6 ne dure que le matin, je ne peux
> pas caler une autre demi-journée l'après-midi. »
> « Si j'ai deux équipes dans ma boîte, je peux avoir deux chantiers, voire plus,
> le 6 août. »

**Où en est le code.** `chantiers.date_planifiee` est **une seule date**, et
`joursOccupes()` (`src/server/repositories/envois-devis.ts`) déclare un jour pris
dès qu'un chantier y est posé. Occupation binaire, une équipe implicite.

**Un troisième défaut, du même sang, que personne n'a signalé :** la durée
prévue (« 2 jours ») est saisie dans les informations mais **n'entre nulle part
dans la planification** — `duree_prevue` n'est lu que par le chiffrage. Un
chantier de deux jours calé le 6 laisse donc le 7 proposable au client suivant.

Trois pistes, du plus petit au plus complet — **aucune n'est engagée : c'est au
patron de choisir** (voir `docs/QUESTIONS.md` si le point y a été porté).

| | Piste | Ce que ça change | Ce que ça coûte |
|---|---|---|---|
| a | Un **créneau** par chantier (`matin` / `après-midi` / `journée`) | Le 6 après-midi redevient proposable | Une colonne, une question de plus à la planification |
| b | Une **durée en demi-journées** posée à partir du créneau de départ | Règle aussi le chantier de 2 jours qui n'en bloque qu'un | (a) + le moteur de disponibilité à revoir |
| c | Des **heures réelles** | Le plus fin | Une vraie vue calendrier — disproportionné pour l'instant |

Et pour les équipes :

| | Piste | Ce que ça change | Ce que ça coûte |
|---|---|---|---|
| a | Un **nombre d'équipes** dans les réglages (défaut 1) | Le jour n'est pris qu'une fois ce nombre atteint | Une ligne de réglage, rien à l'écran |
| b | Des **équipes nommées** (`equipes` + `chantiers.equipe_id`) | On sait qui va où, le planning se lit par colonne | Une table, un écran, un choix par chantier |
| c | Une **capacité en hommes** (réutilise `taille_equipe`) | Le plus juste économiquement | La donnée est du texte libre : à fiabiliser d'abord |

### 6. Rien ne mène le patron d'un écran au suivant

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
- ~~La dictée arrivait amputée à l'écran : découpage, durée, vocabulaire, déchets~~ — 2026-08-03
- ~~Écrire le devis soi-même depuis l'écran Informations~~ — 2026-08-03
- ~~Le devis doublait au retour arrière du navigateur (4 017,60 € au lieu de 2 008,80 €)~~ — 2026-08-03
- ~~« Fin de chantier » injoignable sur un chantier planifié~~ — 2026-08-03
