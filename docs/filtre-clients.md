# Le Filtre sur les listes de clients

Lot du 22 octobre 2026. Branche `lot/filtre-clients`, dossier
`atlas-app-filtre`. Planche : `appli/facture-mairie-chorus.html`, section
« Le Filtre, puis voyager dans le temps ».

**État : sur `main` le 23 octobre 2026**, avec le lot « Facturer une mairie »
et cinq autres, après une batterie commune. Son paragraphe d'architecture est
devenu le **§487**.

## 1. Ce que le patron a demandé

*« Quand ils vont avoir dix années de dossiers et qu'ils ont envie de retrouver
un devis fait en 2017, il faut qu'ils puissent avoir le filtre qu'on utilise
dans l'application. »* Puis : *« quand c'est marqué par date, que je puisse
cliquer et que le calendrier s'ouvre et que je puisse voyager dans le
temps »*, *« pour les 3 : client, public et entreprise »*.

## 2. Ce qui a été codé

| | Où |
|---|---|
| Le bouton « Filtre » de Terminés, sous la recherche, sur les trois listes | `ListeClients.tsx` |
| Le même bouton pour les deux écrans, sorti de Terminés | `src/components/atlas/BoutonFiltre.tsx` |
| Le volet « Trier par » : Nom du client, Date du devis, Date de facturation | `ListeClients.tsx` |
| Une date touchée **ouvre le calendrier tout de suite** | la case de date est posée, invisible, sur la clé |
| La liste du mois : seuls les clients qui ont une pièce ce mois-là, avec CETTE pièce sous leur nom | `src/lib/tri-clients.ts` |
| Le titre « Devis de juin 2017 », qui rouvre le calendrier | `ListeClients.tsx` |
| Toutes les dates des devis envoyés et des factures émises, jusqu'à la liste | `fiche-client.ts` |
| Le mode d'emploi : une fiche « Retrouver un client par la date de son devis » | `fiches-mode-emploi/paysage.ts` |

**Les couleurs, comme il les a voulues** : le bouton Filtre garde ses couleurs
même quand il agit (*« pas vert »*), et la clé choisie du volet se remplit du
vert des boutons, jamais de noir.

## 3. Ce qui a été tranché sans lui

| Décision | Pourquoi |
|---|---|
| Le jour choisi au calendrier montre **tout son mois** | un jour exact rendrait le plus souvent une liste vide ; le mois retrouve le devis |
| La ligne montre la pièce **du mois**, pas la plus récente | un titre « juin 2017 » au-dessus d'une ligne « 2024 » se lirait comme une erreur |
| Pas de « du plus ancien / du plus récent » pour une date | le calendrier choisit déjà le moment ; le sens n'avait plus rien à dire |
| Terminés n'a pas changé de couleur | sa clé choisie reste noire là-bas : hors de ce lot |

## 4. Les chiffres

| Contrôle | Résultat |
|---|---|
| `test-tri-clients.ts` (neuf, **vu rouge** avant la règle) | 6 vertes |
| `test-liste-clients.ts`, `test-documents-en-regle-db.ts` | verts |
| `test-mode-emploi.ts` | 32 sur 32 |
| Flèches, tirets, pansements, code mort, couches | verts |
| Types, lint | verts |
| **Batterie complète** | **pas lancée**, à sa demande |

**Regardé à l'écran** (base d'essai à part) : le bouton, le volet, juin 2017
qui retrouve le devis, un mois vide qui le dit, et le retour de A à Z.

**Pas vérifiable ici** : le calendrier de l'iPhone lui-même. Le geste est celui
du mois des fiches de sécurité, qui s'ouvre déjà chez lui.

## 5. Ce qui reste ouvert

| | Qui |
|---|---|
| Lancer la batterie des deux lots, puis les envoyer sur `main` | le patron donne son accord |
