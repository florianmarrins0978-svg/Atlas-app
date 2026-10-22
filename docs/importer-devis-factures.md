# Importer devis et factures : ce qui est codé, mesuré et décidé

*22 octobre 2026. Codé sur la branche `claude/importer-devis-factures`, d'après la maquette `appli/importer-ancienne-appli.html`. **Pas sur `main`, aucune batterie jouée** : sa consigne, « tu peux coder, mais ne lance surtout pas de batterie ». Elle se jouera avec les autres lots en attente, à son signal.*

## En cinq lignes

1. **Codé de bout en bout** : la porte « Importer devis / facture » sous la recherche de ses clients, l'envoi, la lecture en arrière-plan, la relecture de ce qui manque, le rangement sur la fiche du client (créée si besoin), et « Annuler ».
2. **Dix ans de pièces passent, en plusieurs envois** : 2 000 documents ou 1 Go au plus par envoi. Au-delà, l'écran refuse et dit quoi faire (« une année par envoi »).
3. **L'envoi demande l'appli ouverte, la lecture non.** Si l'appli se ferme pendant l'envoi, il suffit de rechoisir le même fichier : ce qui est déjà parti est reconnu et sauté.
4. **La lecture se fait sans IA** quand le PDF porte son texte. L'IA ne sert qu'à compléter un nom manquant ou à lire un scan, et **n'invente jamais un client** : ce qu'elle ne sait pas va « à vérifier ».
5. **Une pièce importée reste une archive** : ni TVA, ni numérotation, ni modifiable. Elle apparaît dans les onglets Devis et Factures de la fiche, et s'ouvre dans la visionneuse comme les autres.

## Point par point

| Point | Verdict | Où |
|---|---|---|
| Porte sur l'écran Clients, patron seul | fait | `src/app/clients/page.tsx`, `ListeClients.tsx` (`sousLaRecherche`) |
| Formats | PDF, JPG, PNG, zip ; le reste est nommé et ne part pas | `formatDuFichier`, `src/lib/import-pieces.ts` |
| Zip ouvert sur le téléphone, pièce par pièce | fait | `src/lib/lire-zip.ts` |
| Doublons ignorés | fait, par empreinte du fichier, recalculée au serveur | `drizzle/0135_pieces_importees.sql`, route `/api/pieces-importees` |
| Lecture en arrière-plan, sans l'appli | fait : elle part après chaque envoi (`after`) et reprend à l'ouverture si le serveur a redémarré | `src/server/import/traiter-pieces.ts` |
| Rien d'inventé | fait : sans civilité ni réponse sûre de l'IA, le nom reste vide et la pièce va « à vérifier » | `lireChampsDuTexte`, `relireReponseIA` |
| Client retrouvé ou créé | fait, par le même chemin que le reste de l'appli | `trouverOuCreerClient` |
| « Annuler » après rangement | fait : les pièces redeviennent à ranger, seules les fiches créées par ce rangement (et restées vides) s'en vont ; l'import reprend alors la relecture | `annulerRangement` |
| Cloisonnement entre entreprises | fait, sous FORCE RLS, éprouvé sous `atlas_app` | `test-pieces-importees-db.ts` |
| Export des données de l'entreprise | les pièces importées et leurs fichiers y sont | `export-entreprise.ts` |

## Ce qui a été fait autrement que prévu, et pourquoi

| Prévu | Fait | Pourquoi |
|---|---|---|
| photos HEIC acceptées | **refusées, en le disant** | le serveur ne sait pas les convertir en PDF. L'iPhone convertit de lui-même en JPEG quand on choisit une photo depuis la galerie ; seul un fichier HEIC brut, rare, est refusé |
| étendre `lire-classeur.ts` | **nouveau lecteur `lire-zip.ts`, sur le téléphone** | l'ancien lit le zip entier en mémoire au serveur : impossible pour 1 Go |
| une file de travail planifiée | **lecture lancée après chaque envoi**, reprise à l'ouverture | aucun planificateur n'est posé en production ; ainsi rien n'attend un cron qui n'existe pas |
| ouvrir une pièce à l'adresse `/api/pieces-importees/<genre>/<id>` | adresse finie par **`/pdf`** | la visionneuse refuse toute adresse qui ne finit pas par `/pdf` : « Ouvrir » n'aurait rien peint. Trouvé en éprouvant ; la suite navigateur rougit avec l'ancienne adresse |

**Corrigé noir sur blanc**, contre la version précédente de ce document : elle annonçait « PDF, photos (JPG, PNG, HEIC) » et « un lecteur de zip qui existe, à étendre ». Les deux étaient faux pour ce lot, voir le tableau.

## Défauts trouvés en le faisant, et corrigés

| Défaut | Ce qu'il aurait fait |
|---|---|
| les factures d'Atlas, protégées contre la modification, étaient prises pour des PDF à mot de passe | **six sur six refusées** au premier essai |
| « M. Martins Total » lu comme nom | un client en double, « M. Martins Total », à côté du vrai |
| « M. Bernard DÉSIGNATION » | idem, sur les devis d'Atlas |
| la lecture de deux PDF à la fois plantait | des pièces « illisibles » au hasard |

Chacun a son contrôle, vu rouge avant d'être vert.

## Les décisions prises sans lui (il peut les changer)

| Question | Choisi | Pourquoi |
|---|---|---|
| Une ancienne facture impayée : la suivre dans les impayés ? | **non, seulement rangée** | suivre un impayé demande de savoir ce qui a été payé depuis, que le PDF ne dit pas. Ajouter le suivi plus tard ne casse rien |
| La première facture Atlas : continuer après l'ancien numéro ? | **numérotation d'Atlas inchangée** | une pièce importée n'entre pas dans la numérotation |

## Les chiffres

| Mesure | Résultat |
|---|---|
| Lire le texte d'un PDF, sans IA | 77 ms en moyenne |
| Ouvrir un zip de 4 840 PDF dans le navigateur | 17,5 s, 10 Mo de mémoire au plus (Chromium) |
| Contrôles joués ici | types, lint, `test-import-pieces` (règles), `test-pieces-importees-db` (base, sous `atlas_app`), `test-importer-pieces-e2e` (le parcours dans un navigateur, 5 sur 5), cloisonnement des tables, export, fiche client, rôles, garde-fous (tirets, flèches, pansements, couches, code mort) : **tous verts** |
| Batterie complète | **non jouée**, sur sa consigne |

## Ce qui reste ouvert

| Question | Qui |
|---|---|
| La batterie complète, avec les autres lots en attente, puis `main` | à son signal (« lance ») |
| Un vrai zip de 1 Go sur un iPhone | à mesurer sur son téléphone : aucun moteur Apple ici |
| La lecture par l'IA d'un scan et d'un PDF sans civilité | à éprouver sur son espace, qui a les clés ; ici la suite remplace l'IA par une fausse |
| Supprimer un client ne touche pas ses pièces importées : elles restent, sans lien. Les effacer ou les garder dix ans comme une facture ? | le patron, puis une session (avant `main` de préférence) |
| « Tout télécharger » d'un client ne contient pas encore ses pièces importées | à brancher quand les deux lots seront réunis |
