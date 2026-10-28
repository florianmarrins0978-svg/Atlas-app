# Importer un tableau de devis et factures, 28 octobre 2026

Ses demandes du soir : *« il faut qu'elle importe du CSV, qu'on puisse importer
une année de clients et qu'elle les range en créant des fiches clients »*, puis
*« faut pouvoir importer des devis ou factures en CSV »*, et sa règle : **« il
faut zéro erreur ! Faut pas se tromper sur une adresse »**. Planche
`appli/soignee/clients-importer.html`. Ses trois réponses, données avant le
code : la migration oui, Excel par SheetJS corrigé lu dans le téléphone, les
cases vides d'une fiche déjà là complétées.

Branche : `claude/quatre-planches-atlas-6hi21h`. **Rien n'est sur `main`** :
niveau 3, et la batterie n'a pas été jouée, à sa demande.

## Le verdict, point par point

| Point de la planche | Fait | Où | Vérifié par |
|---|---|---|---|
| Le même bouton « Importer devis / facture », « tableau CSV ou Excel » en plus | **codé** | `ImporterPieces.tsx` | `test-importer-pieces-e2e` (le parcours au navigateur) |
| CSV, et Excel `.xlsx` | **codé**, lu au serveur, sans bibliothèque Office | `lire-tableau.ts`, `lire-classeur.ts` (déjà durci) | `test-import-tableau` (CSV Windows-1252, guillemets, BOM), un `.xlsx` essayé à l'écran |
| Excel `.xls` | **pas codé** : voir plus bas | | |
| Les colonnes, seulement quand Atlas hésite | **codé** : deux colonnes de date, un Total sans HT ni TTC, ni client ni type, une date qui se lit dans les deux sens. « Ranger » attend et dit ce qui manque | `reconnaitreColonnes`, `reglagesDesDecisions` | `test-import-tableau` (37 cas) ; capture à 360 px |
| Par client, les questions d'adresse en tête | **codé** : deux vraies adresses (« laquelle est la sienne ? » ou « deux clients différents »), ou une adresse qui n'est pas celle de sa fiche (« le même » ou « un autre ») | `grouperParClient` | idem, et au navigateur |
| Une seconde adresse reste sur la pièce, « Chantier au … » | **codé**, la même fonction pour l'écran et le rangement | `chantierDeLaLigne` | `test-import-tableau`, `test-import-tableau-db` |
| La même adresse écrite autrement reste la même | **codé** (virgule, tiret, capitales, accents, « bd ») | `normaliserAdresse` | `test-import-tableau` |
| Un nom absent se tape | **codé** ; taper ne redessine rien sous le doigt | `ImporterTableau.tsx` | au navigateur |
| Un numéro en double ne se range qu'une fois | **codé**, et un tableau importé deux fois ne double rien | `lireLignes`, `rangerTableau` | `test-import-tableau-db` |
| Un client déjà là reçoit les pièces, ses cases vides complétées | **codé** : seulement le vide, jamais par-dessus | `complementsPourFiche` | `test-import-tableau-db` |
| « Ranger N documents », puis Annuler | **codé** : tout s'annule, cases complétées comprises, sauf ce qu'il a changé depuis | `annulerRangement` | `test-import-tableau-db`, au navigateur |
| Sur la fiche, une pièce sans PDF s'ouvre sur ses chiffres | **codé** : titre, montant, chantier, « Pas de PDF » ; aucun bouton Télécharger | `PieceDuDossier.tsx` | au navigateur, capture |
| Les PDF au même écran « Par client » | **pas codé** : voir plus bas | | |

## Ce qui a été fait autrement que la planche, et pourquoi

- **Excel `.xlsx` est lu au serveur par le lecteur qu'Atlas avait déjà**, et pas
  par SheetJS. Je ne le savais pas en vous posant la question : Atlas lit déjà
  les `.xlsx` pour les tarifs, sans bibliothèque, et ce lecteur a été durci
  par deux audits. **Ma question disait que SheetJS lirait les deux formats :
  c'était incomplet.** SheetJS ne sert donc qu'au vieux `.xls`.
- **L'écran « Dix ans » (« vous pouvez fermer l'appli ») n'est pas codé.**
  Mesuré : 5 120 lignes et 1 240 clients se lisent en 0,13 s et se rangent en
  1,3 s. Le bouton dit « Rangement… » le temps qu'il faut.
- **Une ligne sans numéro, sans date ni montant n'est pas rangée**, même sous
  « que des factures ». Trouvé en relisant : une liste de clients importée par
  erreur aurait fabriqué de fausses factures.
- **Un nom tapé à la main ne soulève pas de question** : son adresse, si ce
  n'est pas celle de la fiche, reste sur la pièce, comme chantier. Rien ne
  s'écrase.
- **La date reste courte** à l'écran (« 3 oct. 2025 »), comme sur la fiche.

## Ce qui reste, et qui tranche

| | Pourquoi | Qui |
|---|---|---|
| **Le `.xls`** | SheetJS corrigé ne s'installe que depuis `cdn.sheetjs.com`, et le réseau de cette session le refuse. Aujourd'hui, un `.xls` est refusé avec la marche à suivre (l'enregistrer en `.xlsx` ou CSV depuis Excel) | lui : ajouter `cdn.sheetjs.com` aux domaines permis de l'environnement, ou une session sur son espace |
| **Les PDF au même écran « Par client »** | sa réponse du soir sur la planche ; le chemin des PDF garde la relecture du 22 octobre | à coder, dans un lot à part |
| **La batterie, puis `main`** | niveau 3 : migration, argent, route | lui, quand ses autres sessions le permettent |

## Les chiffres

| Contrôle | Résultat |
|---|---|
| Types, style, tirets, flèches, pansements, couches, code mort, routes gardées, fichiers stockés, mode d'emploi | verts |
| Règles du tableau (`test-import-tableau`) | 37 cas, verts ; deux règles cassées exprès, vues rouges |
| Base, sous la RLS (`test-import-tableau-db`, `test-pieces-importees-db`, `test-fiche-client-db`, `test-liste-clients`) | verts ; « Annuler » cassé exprès, vu rouge |
| Migration 0154 sur une base habitée (`test-migration-0154-base-habitee`) | verte ; une migration affaiblie, vue rouge |
| Suites navigateur des écrans touchés, jouées seules | **8 sur 8**, dont les trois cas du tableau |
| **La batterie entière** | **pas jouée**, à sa demande |

## Ce qui a été dit dans ce lot et qui était faux

- Ma question sur Excel disait que SheetJS lirait `.xlsx` et `.xls`. Atlas
  lisait déjà les `.xlsx`, sans bibliothèque. Seul le `.xls` en a besoin.
- Deux fois, j'ai voulu arrêter mon serveur d'essai par son nom ; c'est
  interdit (`CLAUDE.md` §6), la session l'a refusé, et c'est maintenant écrit
  dans `HANDOVER.md`.
