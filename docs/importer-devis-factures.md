# Importer devis et factures : ce qui a été mesuré et décidé

*22 octobre 2026. Rien n'est codé dans `src/` : la maquette `appli/importer-ancienne-appli.html` attend son accord.*

## En cinq lignes

1. **Possible**, y compris dix ans de pièces, mais **en plusieurs envois** : 2 000 documents ou 1 Go au plus par envoi, une année à la fois.
2. **L'envoi demande l'appli ouverte, la lecture non.** C'est la seule contrainte qu'aucun code ne lève : un navigateur fermé n'envoie plus rien.
3. **La lecture se fait sans IA** pour les PDF qui portent leur texte (77 ms par document, mesuré) ; l'IA ne sert qu'aux scans et aux photos.
4. **Le téléphone ne peut pas recevoir de notification aujourd'hui** : Atlas n'a pas de service worker. Le résultat se voit à la prochaine ouverture, dans la liste des clients.
5. **Une pièce importée reste une archive** (ni TVA, ni numérotation, ni modifiable), sans que l'écran le dise : sa décision du 22 octobre.

## Ce qui a été mesuré ici

| Mesure | Résultat | Comment |
|---|---|---|
| Lire le texte d'un PDF, sans IA | **77 ms** en moyenne, texte trouvé dans **23 PDF sur 23** (numéro, client, date) | `pdfjs-dist` (déjà installé), en Node, sur les devis et factures réels produits par Atlas |
| Ouvrir un zip de **4 840 PDF** dans le navigateur | **17,5 s**, **10 Mo** de mémoire au plus | lecture par morceaux (`File.slice`, répertoire central, `DecompressionStream`), Chromium |
| Le même lot sur un iPhone | **non mesuré ici** | aucun moteur Apple sur ce poste. `DecompressionStream` existe depuis Safari 16.4 ; à éprouver sur un vrai téléphone avant de promettre |

**Ce que les PDF d'Atlas ne disent pas** : ceux d'autres logiciels sont plus lourds (100 à 300 Ko, contre 15 ici) et rangent leurs mots autrement. La lecture du texte marchera ; savoir QUEL mot est le nom du client demandera, pour un logiciel inconnu, un appel d'IA sur le texte seul (bien moins cher que sur l'image).

## Ce que le dépôt a déjà, et ce qui manque

| | |
|---|---|
| lecteur de zip protégé contre les bombes | **existe** (`src/server/import/lire-classeur.ts`), à étendre à plusieurs entrées |
| plafond d'un envoi | **15 Mo** par fichier (`src/server/upload-limits.ts`, `next.config` `bodySizeLimit`) : d'où l'envoi pièce par pièce, jamais le zip entier |
| lecture d'un document par l'IA | **existe** (`lire-devis-fournisseur.ts`, même patron) |
| reconnaître un client connu | **existe** (`trouverOuCreerClient`) |
| file de travail en arrière-plan | **n'existe pas.** Le seul travail planifié est la purge, et aucun planificateur n'est posé en production (`docs/DEPLOIEMENT-PURGE.md`) |
| notification sur le téléphone | **n'existe pas** (aucun service worker) |

## Les décisions, et pourquoi

| Décision | Pourquoi |
|---|---|
| **2 000 documents ou 1 Go par envoi** | 1 Go en 4G, c'est 15 à 30 minutes l'appli ouverte : au-delà, l'envoi n'est plus tenable sur un chantier. Le zip simple s'arrête de toute façon à 4 Go et 65 535 fichiers |
| le zip s'ouvre **sur le téléphone**, les PDF partent **un par un** | le serveur ne reçoit jamais 1 Go d'un coup, chaque morceau tient sous les 15 Mo, et un envoi coupé reprend où il en était |
| texte d'abord, IA ensuite | la plupart des PDF de logiciel portent leur texte : gratuit et rapide. L'IA (avec sa clé) ne lit que ce qui est scanné |
| on ne montre que **ce qui est à vérifier** | relire 1 450 lignes est impossible ; « 1 447 rangés, 3 à vérifier » se fait en une minute |
| un document déjà importé est ignoré | empreinte du fichier : importer deux fois le même zip ne double rien |
| formats acceptés | PDF, photos (JPG, PNG, HEIC), zip. Le reste est refusé avec son nom. Sa consigne : « prévoir tous les formats possibles » ; un tableau Excel ou CSV de clients, s'il est fourni, sera préféré aux noms lus dans les PDF |

## Ce qui reste ouvert

| Question | Qui |
|---|---|
| Une ancienne facture impayée : la suivre dans les impayés, ou seulement la ranger ? | le patron |
| Première facture Atlas : continuer après le dernier numéro, ou repartir de 1 ? | le patron |
| Le comportement sur un vrai iPhone (zip de 1 Go) | à mesurer sur son téléphone, avant toute promesse |
| Une file de travail en arrière-plan en production | à construire avec le lot, et à poser chez l'hébergeur comme la purge |
