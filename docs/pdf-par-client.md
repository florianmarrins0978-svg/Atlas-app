# Les PDF rangés par client, comme un tableau

Sa demande du 31 octobre 2026 : *« que ça soit un CSV, Excel ou un PDF, il faut que ça soit la même chose. Il faut qu'ils se débrouillent tout seuls pour me les ranger en client. »*

## Ce qui change pour lui

| Avant | Maintenant |
|---|---|
| Les PDF passaient par un écran à part : un nom à taper par pièce douteuse, puis « Tout ranger » | Les PDF lus arrivent au même écran « Par client » qu'un tableau |
| Aucune adresse lue : la fiche naissait sans adresse | L'adresse et le téléphone du client sont lus sur le PDF et posés sur la fiche |
| Deux clients du même nom, à deux adresses, devenaient une seule fiche sans question | Atlas montre les deux adresses et attend sa réponse, comme pour un tableau |
| Le lieu des travaux n'était pas lu | Écrit à part sur le PDF, il reste sur la pièce, « Chantier au … » |

Restent à sa main, comme avant : un nom illisible se tape ; un PDF dont on ne sait pas s'il est un devis ou une facture se dit d'un appui.

## Comment l'adresse se lit, sans se tromper

| Cas | Ce que fait Atlas | Où |
|---|---|---|
| Une seule adresse après le nom du client | c'est la sienne | `src/lib/import-pieces.ts`, `coordonneesApresLeNom` |
| L'adresse de l'artisan, en tête | jamais prise pour celle du client | même fonction |
| Deux adresses différentes après le nom (client et lieu des travaux côte à côte) | le texte ne choisit pas : l'IA lit le texte et sépare les deux | `texteSuffit`, `src/server/import/lire-piece.ts` |
| Un téléphone loin du nom (le pied de page de l'artisan) | ignoré : un faux téléphone séparerait deux fois le même client | `BLOC_DU_TELEPHONE` |

L'IA ne lit l'image que pour un scan sans texte, comme avant : c'est ce qui coûte.

## Fait autrement

- **Une seule règle de rangement.** Les PDF deviennent des lignes de tableau et passent par les mêmes fonctions (`lignesDesPdf`, `planDeRangement`). L'ancienne relecture et son rangement par nom sont supprimés.
- **Le serveur ne croit pas l'écran.** Il relit les pièces en base et refait le plan avant de ranger.
- **Migration 0155**, trois colonnes vides ajoutées, rien d'effacé.

## Trouvé en chemin, et corrigé

L'écran tombait (« Cette page n'a pas pu s'afficher ») à l'arrivée des PDF : il cherchait à montrer les colonnes d'un tableau qui n'existe pas. Vu par la suite navigateur rouge, corrigé, la suite verte.

## Les chiffres

| Contrôle | Résultat |
|---|---|
| Lecture sans base (`test-import-pieces.ts`) | vert, 14 cas nouveaux vus rouges d'abord |
| En base, sous la vraie isolation (`test-pieces-importees-db.ts`) | 9 / 9 |
| Tableau en base (`test-import-tableau-db.ts`) | vert |
| Navigateur, l'import entier (`test-importer-pieces-e2e.ts`) | 9 / 9 |
| Écran regardé | 390 et 360 px, rien ne déborde |
| **Batterie entière** | **pas jouée, à sa demande** |

## Ce qui reste

| | Qui |
|---|---|
| La batterie entière, puis `main` (niveau 3 : la base et les fiches clients) | lui dit quand |
| Un PDF lu avant la migration n'a pas d'adresse : il se range sans | rien à faire |
| Le même numéro dans deux PDF différents se range deux fois | à trancher s'il le voit |
