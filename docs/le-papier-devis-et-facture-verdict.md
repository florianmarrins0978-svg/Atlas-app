# Le papier, le même pour le devis et la facture — codé le 14 septembre 2026

*Votre planche `le-papier-devis-et-facture.html`, et votre « PARFAIT ! Code
exactement cette planche, du devis à la facture ». Un verdict par point, ce qui
a été décidé sans vous et dit, ce qui reste.*

---

## En une phrase

**Le devis et la facture sortent du même papier**, avec les colonnes des pros,
les acomptes reçus déduits et le net à payer ; l'écran de la facture a tous les
boutons de la planche. Votre chemin, du devis à la facture, a été joué dans un
navigateur, et le PDF regardé en grand contre la planche : les colonnes, les
gras et les fontes y sont.

---

## 1. Ce qui est codé, point par point

| Sur la planche | Dans l'application |
|---|---|
| Un seul papier, seul le titre change | oui — un seul composeur ; la facture ajoute ce qu'elle seule porte |
| Désignation · Qté · Unité · P.U. HT · Rem. % · Total HT · TVA % · Total TTC | oui ; Rem. %, TVA % et Unité centrés ; Total TTC en gras, en-tête comprise |
| « 3 », jamais « 3.00 » ; l'unité dans sa colonne | oui — et l'unité suit enfin le devis jusqu'à la facture (elle se perdait en route) |
| Le taux de TVA sur la ligne, les bases par taux dessous | oui — plus de tableau coupé « TVA 20 % / TVA 10 % » |
| Le numéro à droite du titre, CLIENT et LIEU DES TRAVAUX côte à côte | oui |
| « Titre (optionnel) », en italique sous DEVIS ou FACTURE | oui — sur le devis, recopié sur la facture, retouchable tant qu'elle n'est pas arrêtée. Vide : rien |
| Total HT et Total HT après remise en gras, la remise en or, « TVA 20 % » | oui |
| Reste à régler / Net à payer dans la fonte du Total TTC | oui |
| « dont main d'œuvre HT » sur la facture, « + Main d'œuvre » | oui — recopiée du devis, retouchable |
| Chaque montant reçu est un acompte : « Acompte 30 % », « Acompte 50 % », puis « Acompte » ; chacun sa ligne, la somme se déduit sans s'écrire | oui — le rang dit le taux du devis |
| « + Règlement reçu » propose le rang suivant du devis avec son montant | oui |
| Chèque déjà écrit, à toucher pour virement / espèces / carte ; la case du numéro seulement pour un chèque | oui |
| « Montants versés : chèque n° … du …, … € ; virement du …, … €. » | oui, sans le mot acompte |
| « Facture acquittée » : interrupteur ; allumé, le solde est compté reçu, tampon « Acquittée le … » | oui |
| « Pour information, montant de la main d'œuvre TTC » | oui |
| Les colonnes de saisie centrées ; un chiffre touché est sélectionné | oui |

## 2. Décidé sans vous, et dit

**Un acompte reçu avant la facture.** La règle de TVA refusait tout règlement
daté d'avant la facture. Sur une facture pas encore arrêtée, l'acompte de la
signature est daté d'avant par nature : il se pose désormais, et il entre au
relevé de TVA à la date où l'argent est tombé — c'est la même table que
« Noter un règlement ». Sur une facture arrêtée, rien ne change.

**Les pénalités ne se répètent pas** dans les conditions en gras de la
facture : elle les porte déjà, scellées, au pied — c'est la loi.

## 3. Ce qui n'est pas codé, et pourquoi

| | |
|---|---|
| la case « crédit d'impôt 50 % » | elle était « à trancher » sur la planche de l'écran, et votre planche du papier ne la porte pas. À vous : une case sur la facture, ou une facture à part comme chez le paysagiste |
| la décennale et le médiateur dans Mon entreprise | dessinés sur votre accord, en attente de votre « code » |

## 4. Ce qui a été vérifié

| | |
|---|---|
| règles pures | `test-papier-devis-facture` : les centimes des colonnes tombent juste, les noms d'acompte, les montants versés, le tampon, les deux papiers aux mêmes abscisses — vert |
| base, sous la RLS | `test-papier-facture-db` : la facture recopie titre, main d'œuvre, unité ; l'acompte de la signature se pose, se corrige, se refuse au-delà du reste ; acquittée pose et reprend le solde ; le PDF dit tout ; une facture arrêtée ne bouge plus — vert |
| suites adaptées à la planche | `test-devis-pdf`, `test-facture-pdf`, `test-acomptes-pdf`, `test-planche-b-devis` — vertes |
| types, lint, couches, code mort, chartes, flèches | verts |
| **suites navigateur** — `test-papier-facture-e2e` (votre chemin : le devis avec tous ses boutons, le titre, la main d'œuvre, la facture, « + Règlement reçu », le chèque et son numéro, « Facture acquittée », le PDF dans la visionneuse), `planche-b-devis`, `acomptes-devis`, `reduction-devis` | **vertes**, jouées le 14 septembre au soir une fois la machine redémarrée |
| **le papier, regardé** | le PDF du devis et celui de la facture, capturés en grand : mêmes colonnes, mêmes gras, seul le titre et le bloc sous le TTC changent — comme la planche |

**Ce que la suite navigateur a attrapé, que rien d'autre ne voyait :** après
« Créer la facture », l'écran gardait un titre vide et pas de main d'œuvre
alors que la base les tenait — il fallait recharger. Corrigé à la racine (une
facture = un montage de l'écran, `page.tsx`). Et sur un téléphone, la flèche
native du choix du moyen mangeait « Virement », et cinq colonnes ne tenaient
pas dans la carte d'un téléphone : chaque colonne est mesurée au plus long
qu'elle porte, et regardée à 390 px.

**Non éprouvé :** ce que votre espace affiche à vous. La batterie complète
se joue avant la fusion sur `main`.
