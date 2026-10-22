# Facturer une mairie : la facture pour Chorus Pro

Lot du 22 octobre 2026. Branche `lot/facture-mairie-code`, dossier
`atlas-app-chorus`. Planche : `appli/facture-mairie-chorus.html`.

**État : sur `main` le 23 octobre 2026**, avec six autres lots, après une
batterie commune. Sa migration a pris le numéro **0137** et son paragraphe
d'architecture le **§486** (trois lots portaient un 0135, cinq un §480).

## 1. Ce que le brief disait, confronté au code

| Point du brief | Verdict | Ce qui le fonde |
|---|---|---|
| La fiche porte Mr, Mme, Entreprise, et le SIRET d'une entreprise | **juste** | `clients.civilite`, migration 0119 |
| La facture fige le SIRET et l'imprime sous le nom | **juste** | `factures.client_siret`, `document-commun.ts` |
| `civilite.ts` reconnaît « mairie » dans un nom | **juste, et c'était un défaut** | `estUneEntreprise` rangeait la mairie avec les entreprises : le bouton « Sous-traitance, sans TVA » s'offrait sur son devis et sa facture |
| Il manque le n° d'engagement, le code service, la distinction publique | **juste** | aucune colonne avant la migration 0137 |
| L'envoi par SMS ou mail est proposé à une mairie | **juste, et c'était pire** | « Envoyer la facture » sert aussi à ARRÊTER la facture. Sans téléphone ni e-mail, il restait grisé : la facture d'une mairie sans coordonnée ne pouvait pas s'arrêter du tout |
| Préremplir le n° d'engagement depuis le devis | **refusé** | le devis n'en porte pas, et ne peut pas en porter : la mairie donne son bon de commande APRÈS avoir accepté le devis |
| Changer l'enum de `civilite` en deux temps | **inutile ici** | la contrainte s'élargit seulement (comme 0119) : l'ancien code accepte tout ce que la base accepte |

## 2. Ce que le patron a choisi sur la planche

| Question | Son choix |
|---|---|
| Comment reconnaître une mairie | une quatrième pastille, « Public » |
| Où se rangent ses clients | trois listes : les particuliers d'office, puis « Vos entreprises » et « Services publics », **toujours visibles, même vides** |
| Où se tapent les numéros | le code service sur la fiche, **repris sur chaque facture et modifiable pour elle seule** (une mairie a parfois plusieurs services qui commandent) ; le n° d'engagement sur la facture |
| Le bouton | « Télécharger pour Chorus Pro » à la place de l'envoi |
| Les couleurs | celles de l'appli : l'or reste l'or (portes, total, pastille choisie) |

## 3. Ce qui a été ajouté et que le brief ne demandait pas

La liste légale des mentions d'une facture à un acheteur public (Code de la
commande publique, art. D2192-2, **lue sur Légifrance**) a été confrontée au
PDF d'Atlas. Deux choses manquaient :

| Ajout | Pourquoi |
|---|---|
| **Échéance plafonnée à 30 jours** pour un client public | un acheteur public paie à 30 jours au plus ; Atlas laissait choisir un an |
| **La phrase des retards de la commande publique** | Atlas imprimait « trois fois le taux d'intérêt légal », la règle entre entreprises. Pour une mairie : taux de la BCE majoré de 8 points, et 40 € d'indemnité |

**Ce qui n'a pas pu être lu** : le texte même de l'article R2192-31 (intérêts
moratoires). Le taux BCE + 8 points et les 40 € viennent de sources qui
concordent, pas du texte officiel. **À faire confirmer par son comptable.**

**Un effet de bord évité.** Sortir les mairies des entreprises leur aurait
retiré les 40 € de frais de recouvrement sur leurs **devis** : la phrase des
pénalités du devis se choisissait selon « entreprise ou non ». Une règle
`estUnClientProfessionnel` (entreprise OU public) la tient désormais, éprouvée.

## 4. Ce qui a été codé

| | Fichier |
|---|---|
| Migration expand : `public` dans les trois contraintes, `clients.code_service`, `factures.client_code_service`, `factures.client_numero_engagement`. Aucune ligne réécrite | `drizzle/0137_client_public_et_chorus.sql` |
| Les règles : client public, catégorie, cases de la fiche, mots des trois listes | `src/lib/civilite.ts` |
| Les règles de la facture : délai, échéance, phrase des retards, lignes du PDF | `src/lib/facture-publique.ts` |
| La fiche : SIRET et code service pour « Public », pas de n° TVA | `SesCoordonnees.tsx` |
| La facture : les deux numéros, le bouton, l'échéance bornée | `FactureClient.tsx`, `factures.ts` |
| Le PDF : les numéros sous le SIRET, la phrase des retards | `document-commun.ts`, `facture-pdf.ts` |
| Les trois listes et leurs deux portes | `clients/page.tsx`, `ListeClients.tsx`, `fiche-client.ts` |
| Le mode d'emploi | une fiche « Facturer une mairie », et « Public » dans celle de la civilité |

**Hors périmètre, comme demandé** : la connexion à l'API Chorus Pro et le format
Factur-X (chantier de la facture électronique de 2027). Et le Filtre avec son
calendrier sur les listes de clients : c'est le **lot suivant**, séparé.

## 5. Les chiffres

| Contrôle | Résultat |
|---|---|
| `test-client-public.ts` (neuf, rouge d'abord) | 13 vertes |
| `test-facture-mairie-db.ts` (neuf, base, sous `atlas_app`) | 10 vertes ; **vu rouge** en cassant deux règles (2 en échec), puis rétabli |
| `test-documents-en-regle-db.ts`, `test-documents-en-regle.ts`, `test-civilite.ts`, `test-echeance-facture.ts` | verts |
| `test-mode-emploi.ts` | 32 sur 32 |
| Flèches, tirets, pansements, code mort, couches, chartes | verts |
| Types, lint | verts |
| **Batterie complète** | **pas lancée**, à sa demande |

**Regardé à l'écran** (base d'essai à part, atelier 9) : la fiche avec ses
quatre pastilles, les deux portes, la liste « Services publics », la facture
avant et après l'appui, et le PDF définitif. Le geste joué en entier : un appui
sur « Télécharger pour Chorus Pro » a arrêté la facture et remis
`F2026-000001.pdf`. Sans adresse du client, il refuse et le dit, sans rien
télécharger.

**Pas vérifiable ici** : la feuille de partage d'un iPhone. Si elle ne suit pas
l'appui, l'écran d'après garde le bouton « Télécharger pour Chorus Pro ».

## 6. Ce qui reste ouvert

| | Qui |
|---|---|
| Lancer la batterie, puis envoyer le lot sur `main` | le patron donne son accord |
| Confirmer la phrase des retards (BCE + 8 points, 40 €) | son comptable |
| Le Filtre et son calendrier sur les trois listes | lot suivant |
