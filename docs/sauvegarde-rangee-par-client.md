# La sauvegarde rangée par client

**Ta capture du 26 septembre 2026** : dans Fichiers, des dossiers nommés
« 0b2034d5-11bb-4… ». Personne ne s'y retrouve.

## Ce qui change

| Avant | Maintenant |
|---|---|
| `fichiers/chantiers/0b2034d5…/photos/a81f….jpg` | `fichiers/Mme Costa/Terrasse bois/Photos/Photo 2026-09-12.jpg` |
| `fichiers/chantiers/…/devis/….pdf` | `fichiers/M. Faucher/Reprise de toiture/Devis/Devis 2026-000001.pdf` |
| `fichiers/logos/….png` | `fichiers/Entreprise/Logo.png` |
| `fichiers/achats/….jpg` | `fichiers/Tickets de caisse/Ticket Total Access 2026-09-12.jpg` |

Dans chaque chantier : **Photos**, **Devis**, **Factures** (avoirs compris),
**Notes vocales**. Un chantier sans client va dans **Sans client**.

## Ce qui ne change pas

`donnees.json` garde la clé d'origine de chaque fichier, à côté du nouveau
chemin : une reprise ailleurs saura remettre chaque fichier à sa place.

## Vérifié

| | |
|---|---|
| la sauvegarde téléchargée dans un vrai navigateur, ouverte avec `unzip` | rouge sur l'ancien code (« chantiers/65165471-… »), vert maintenant |
| l'export lu en base | rouge avant, vert après |
| la règle de rangement, sans base | 5 cas : noms, doublons, « / » dans un nom, sans client |

## Ce qui reste

Rien à trancher. Pour le voir : **Réglages, Télécharger mes données**, une fois
la mise à jour arrivée sur ton espace.
