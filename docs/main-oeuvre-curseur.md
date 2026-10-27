# La barre de la main d'œuvre : ce qui est codé

*27 octobre 2026. Ses réponses : « si la main d'œuvre c'est 397, ça pourra pas être arrondi à 10 », « je choisis la première », « ne lance pas de batterie ».*

## Le verdict

| | |
|---|---|
| **la barre** | une seule barre pour tout le total, un morceau par travail, aux couleurs **Jardin** (sauge, sable, bleu ciel, menthe, rose poudré) |
| **la poignée** | entre deux travaux, elle ne change qu'eux deux, de 10 € en 10 €, chacun garde au moins 10 € ; une bulle au-dessus du doigt dit les deux montants |
| **le montant écrit** | il se touche, il s'écrit **à l'euro près** ; le travail d'à côté prend la différence, le suivant complète s'il n'a pas assez |
| **dans la barre** | chaque montant s'écrit dans son morceau s'il tient, en plus petit avant de se taire |
| **le devis** | il écrit au centime ce que la barre a montré |
| **ce qui part** | le curseur par travail, le pas de 16 €, les pourcentages qui faisaient 101 % |
| **où** | branche `lot/main-oeuvre-curseur`, **pas sur `main`** : la batterie n'a pas été jouée |

## Ce que sa réponse sur l'arrondi a fait trouver, et qui est corrigé

**Le devis réécrivait à la dizaine ce qu'il avait réglé.** 297 € écrits à l'écran
devenaient 300 € sur le devis, sans que rien ne le dise. La haie de sa grille à
250 € pouvait sortir à 247 €, selon l'ordre des travaux. C'était déjà vrai avec
l'ancien curseur.

**Un écart d'arrondi pouvait écrire un travail à −5 €.** 395 € de main d'œuvre,
un travail qui pesait tout et un autre qui ne pesait rien : 400 € et −5 €.

Reproduits avant de corriger, rouges sur l'ancien code
(`test-repartir-main-oeuvre.ts`, `test-main-oeuvre-dictee-db.ts`). La règle
maintenant : ce qu'il a réglé s'écrit tel quel ; ce que l'outil partage seul
(parts égales, un travail retiré) reste à la dizaine, sa règle du 5 août, et
l'écart ne va jamais sur un travail à zéro.

## Trouvé en jouant le geste, et corrigé

**Une poignée tirée ne bougeait rien quand des travaux étaient à chiffrer.**
Un travail à 0 € n'a pas de largeur : ses poignées s'empilent au même endroit,
et le doigt attrapait celle du dessus, qui sépare deux travaux vides. C'est
le cas le plus courant : l'abattage prend toute la main d'œuvre, la fente et
l'évacuation attendent leur prix. Maintenant, tirer vers la gauche donne au
premier travail de la pile, tirer vers la droite prend au premier travail
qui a de quoi.

Trouvé par la suite navigateur à son premier passage, rouge sur « la poignée
n'a rien déplacé » ; la règle a ses tests, rouges d'abord.

## Ce qui a été fait autrement que la planche

| | la planche | le code | pourquoi |
|---|---|---|---|
| un travail sans part | « 0 € » | « À chiffrer » | c'est ce que le devis écrira : un zéro se lirait « gratuit » |
| retirer ou remettre | les poignées sautaient | elles suivent les morceaux qui coulent | sinon, pendant un quart de seconde, la poignée n'est plus sur son joint |
| l'écriture sur les couleurs | choisie à chaque fois entre l'encre et la carte | une encre fixe | les couleurs sont fixes, leur encre aussi ; mesurée lisible sur les cinq |

## Ce qui a été éprouvé ici

| | |
|---|---|
| règle pure (`test-repartir-main-oeuvre.ts`) | 23 sur 23 |
| devis sous la RLS (`test-main-oeuvre-dictee-db.ts`) | 10 sur 10 |
| chiffrage voisin (grilles, proposition de prix, corrections, identité, leçons, questions) | verts |
| types, style, tirets, flèches, couleurs en clair, pansements, code mort, couches, chartes | verts |
| le composant dans un navigateur, en Origine, Nuit et Sylve | regardé : glissé au doigt, flèches du clavier, croix, Remettre, montant écrit, Échap, une ligne |
| suite navigateur du geste (`test-main-oeuvre-barre-e2e.ts`) | verte : montant écrit à l'euro près, poignée du dessus de la pile tirée, le devis porte les mêmes montants ; rouge avant la correction des poignées empilées |
| suite navigateur des questions (`test-questions-chiffrage-e2e.ts`) | verte |

## Ce qui reste

| | qui |
|---|---|
| la batterie (niveau 3 : le devis), puis `main` | lui, pour le feu vert |
| la regarder sur son téléphone, une fois sur `main` | lui |
