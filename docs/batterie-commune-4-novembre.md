# Batterie commune du 4 novembre : quatre lots, une seule mesure

Ta demande : *« il y a 4 sessions en attente de jouer une batterie. Fusionne-les toutes et joue une seule batterie pour vous toutes. »*

Branche : `lot/integration-4-novembre`, partie de `main` (`4b199bc5`), qui n'a pas bougé pendant la mesure.

## Les quatre lots

| Lot | Branche fusionnée | Migrations | Rouge venu du lot ? |
|---|---|---|---|
| Le titre des PDF importés et le détail sous la ligne du devis | `claude/quatre-planches-atlas-6hi21h` (`6452421a`) | 0161, 0162 | aucun |
| « Mes partenaires » sur la main d'œuvre dictée | `lot/mo-dictee-partenaires` (`6c979176`) | aucune | aucun |
| La note du devis, chez le client et montrée au patron | `lot/note-du-devis` (`3d0ced37`) | 0163 | un, corrigé |
| La mise en page du devis, ses espaces et le saut vu dans l'écran du devis | `lot/mise-en-page-devis` (`18776b5b`) | 0164 | aucun |

Chaque branche est entièrement dans la fusion : aucun commit manquant, vérifié après la mesure.

## Ce que la fusion a demandé

| Rencontre | Ce qui a été fait |
|---|---|
| Trois migrations **0159** (`main`, la note, la mise en page) | La note devient **0163**, la mise en page **0164**. Aucune n'est jamais passée sur ta base : ton espace ne suit que `main` |
| `ARCHITECTURE.md` : deux §550 (titre, partenaires), trois §544 (`main`, la note, la mise en page) | Partenaires §551, note §552, mise en page §553 ; chaque renvoi relu un par un |
| Les actions du devis : la note et les partenaires ajoutaient chacun un import au même endroit | Les deux imports |
| Les dessins d'icônes : `calendrier`, `personne` et `note` ajoutés par trois lots | Les trois |

## La batterie

| Étape | Résultat |
|---|---|
| Types, style, mémoire, construction | verts |
| Suites base | 556 sur 559 |
| Suites navigateur | 213 sur 213 |
| Connexion derrière un proxy | verte |

| Rouge | Cause | Ce qui a été fait |
|---|---|---|
| `test-actions-gardees-db` | la fenêtre de la note se marque vue par une action serveur sans garde de rôle et sans raison écrite | raison écrite : elle n'écrit que la date sur la ligne de la personne connectée, sans argument, comme la charte. Une garde de rôle n'y fermerait rien, et ferait revenir la fenêtre à chaque ouverture pour un rôle qui lit le devis sans le gérer. Rejouée verte |
| `test-maquettes-hors-production` | rouge de la même façon sur `main` seul | pas ces lots |
| `test-stockage-banc` | rouge de la même façon sur `main` seul | pas ces lots |

Après la correction, ce qui avait bougé a été rejoué (`verifier-ce-qui-a-bouge.ts`), et les deux rouges restants rejoués sur `main` seul (`verifier-rouge-prealable.ts`).

## Ce qui reste ouvert

| | Qui |
|---|---|
| Le geste des partenaires sur ton iPhone (joué ici dans Chromium à la taille d'un iPhone 13) | toi, à ta prochaine dictée |
| La phrase du détail rédigée par le modèle : pas de clé ici | toi, à ta prochaine dictée |
| Tes chantiers déjà dictés n'ont pas de détail : il ne s'est jamais gardé | rien à faire |
| Les deux rouges de `main` (`test-maquettes-hors-production`, `test-stockage-banc`) | nous, lot à part |

## Corrigé noir sur blanc

La première batterie est tombée en entier sans rien mesurer : la base de ce poste s'était arrêtée entre deux tours. Elle a été relancée avec la base démarrée dans la même commande, et c'est cette seconde mesure qui est rapportée ici.
