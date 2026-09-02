# Plusieurs TVA sur un devis — ce qui a été fait

*1ᵉʳ septembre 2026. Branche `claude/devis-multiple-tva-2hwnpz`.*

---

## Ta question, et la réponse

> *« Sur la page du devis, si j'ai de la main d'œuvre TVA à 20 et des plantes
> TVA à 10, je peux avoir deux TVA différentes ou il faut rajouter cette
> option ? »*

**Il fallait la rajouter.** Le devis ne portait qu'un seul taux, posé sur la
totalité du document. C'est fait.

## Ce que tu as corrigé, et qui a changé le lot

La première proposition mettait **une colonne TVA sur chaque ligne**. Tu as
répondu autrement :

> *« Il ne faut pas la rajouter à chaque ligne, mais lorsque j'ai plusieurs
> choses à rajouter ou une seule en TVA à 10, j'appuie sur ajouter une TVA, une
> catégorie s'ajoute et là je mets toutes mes lignes qui seront en TVA à 10. »*

**Tu avais raison, et pour une raison qui ne se voit pas en écrivant le code :**
sur un téléphone, poser le même taux sur huit lignes fait huit gestes et huit
occasions de se tromper d'un chiffre. Un taux faux ne se voit pas sur le devis —
il se voit à la déclaration, des mois plus tard.

## Ce que ça donne

| | |
|---|---|
| **un seul taux** | l'écran et le PDF sont **exactement** ceux d'aujourd'hui — aucun titre, aucun sous-total |
| **« + Ajouter une TVA »** | sous le tableau ; une catégorie s'ouvre à 10 %, avec sa première ligne |
| **le taux** | se corrige dans le titre de la catégorie ; toutes ses lignes suivent d'un coup |
| **une catégorie** | porte autant de lignes que tu veux, et affiche son sous-total HT |
| **les totaux** | une ligne de TVA par catégorie, puis le Total TTC |
| **le « − »** | retire la catégorie — **ses lignes reviennent dans la première, elles ne sont pas supprimées** |

Le taux voyage jusqu'au bout : devis → PDF → facture → facture émise → relevé de
TVA.

## Ce qui ne change pas, et c'est la moitié du travail

**Aucun de tes devis déjà émis ne bouge d'un centime.** Les lignes existantes
n'ont pas de taux : elles suivent celui du devis, comme avant. Il n'y a eu
aucune reprise de données — donc aucune occasion de s'y tromper.

## Le piège du lot, invisible à l'œil

**Le prix accordé au client se répartit entre les catégories, au prorata.**

Sans ça, chaque catégorie calculerait sa TVA sur son montant plein. Sur le devis
de la maquette avec 10 % accordés, cela faisait **44,40 € de TVA en trop** sur la
seule catégorie à 20 % — de la TVA sur de l'argent que le client ne verse pas, et
qui part dans une déclaration.

Et le centime qui ne tombe pas rond va à la plus grosse catégorie : sinon le
total ne vaudrait plus la soustraction imprimée juste au-dessus, et le client qui
refait le calcul cesse de croire toute la feuille.

## Trois défauts trouvés en REGARDANT, pas au test

Les trois étaient verts au typage et aux suites. Ils se sont vus à l'image.

| ce qui était vert | ce que l'image montrait |
|---|---|
| le calcul sur zéro ligne | **un devis vide n'avait plus de bouton « Ajouter une ligne »** — donc plus moyen d'écrire la première ligne d'un devis neuf |
| les totaux justes | le « − » s'affichait sur la première catégorie, et ne faisait rien (« 20 » comparé à « 20.00 ») |
| le PDF à deux taux | une catégorie coupée par un saut de page laissait ses dernières lignes et son sous-total **sans titre** — un sous-total orphelin sur une pièce que le client garde |

## Ce qui a été dit et qui était faux

**Trois corrections à écrire noir sur blanc :**

1. **Le premier contrôle du centime résiduel ne prouvait rien.** Il posait trois
   bases à 100 € avec 33,33 % : ça fait 99,99 €, soit trois fois 33,33
   exactement — aucun reste à répartir. Le contrôle passait au vert sans rien
   éprouver. Il a fallu des centimes qui ne se divisent pas (3,02 € à 33,33 %)
   pour qu'il morde.
2. **Deux contrôles ont rougi sur du code juste.** Ils cherchaient le libellé
   d'une ligne dans le texte de la page — or une description est une zone de
   saisie, dont le contenu n'est jamais dans le texte rendu. La base était
   parfaite ; c'est le contrôle qui regardait au mauvais endroit.
3. **Le bouton « Annuler » de la feuille était carré**, avec le rayon repris de
   la maquette. Ta règle du 12 août — la même forme partout — est tenue par un
   contrôle du dépôt, qui l'a attrapé. La maquette a été corrigée aussi : une
   planche qui montre autre chose que l'écran ne sert plus de référence.

## Ce qui a été éprouvé

| | |
|---|---|
| types, lint, mémoire du dépôt | ✅ |
| **suites base de données** | **302 / 302** |
| **suites navigateur du domaine** (devis, facture, TVA, prix) | **20 / 20**, jouées par groupes |
| l'appui long | éprouvé par un vrai appui maintenu dans un navigateur |
| connexion derrière un proxy | ✅ |
| la feuille imprimée | regardée : un taux, deux taux, trois taux sur deux pages |
| l'écran | regardé sur téléphone, à deux catégories |

**Ce qui n'a PAS pu être éprouvé ici, et il faut le dire :** la batterie
navigateur **complète** (124 suites d'affilée) ne tient pas dans ce conteneur —
le serveur s'arrête vers la troisième suite, et le journal noyau dit « out of
memory ». Les suites passent toutes une par une ou par groupes de cinq ; le
runner lui-même propose ce découpage. Ce n'est pas un rouge du produit, mais je
ne peux pas te rendre un vert de batterie complète depuis ce poste.

## Les deux points ouverts sont tranchés

1. **Le sous-total HT est gardé**, tu l'as vu et validé.
2. **Déplacer une ligne : l'appui long**, comme tu l'as choisi. C'est codé.

### L'appui long, en détail

Un appui d'une demi-seconde sur une ligne la soulève, puis la feuille monte du
bas : les autres catégories, plus « vers une TVA 5,5 % » qui en ouvre une de plus
sans avoir à fermer.

**Ce que la maquette a corrigé avant que ce soit codé :** la ligne déplacée
rejoint la FIN de son nouveau groupe. Sans ça, déplacer la première ligne du
devis faisait remonter toute sa catégorie au-dessus de l'autre — on croyait
avoir bougé le tableau entier.

**Trois réglages, chacun pour éviter une gêne :**

| | |
|---|---|
| une demi-seconde | en dessous, un doigt qui hésite ouvre la feuille tout seul |
| le doigt qui glisse annule | sinon tu ne peux plus faire défiler la page en partant d'une ligne |
| les champs de saisie sont épargnés | l'appui long y sert à sélectionner et copier, ça reste au téléphone |

Sur un devis à un seul taux, l'appui long ne fait rien : une feuille ouverte sur
un seul choix ferait croire à un geste cassé.

## Un défaut du dépôt trouvé au passage

`monter-base-locale.sh` démarre Redis mais **n'exporte pas `REDIS_URL`**. Sans
elle, toutes les suites navigateur tombent à partir de la deuxième, sur un
« dépassement de délai » qui accuse le formulaire de connexion alors qu'il va
très bien. C'est noté dans `TODO.md` avec le correctif.

## Où regarder

| | |
|---|---|
| la maquette | `appli/devis-tva-multiple.html` |
| la règle de calcul | `src/lib/reduction-devis.ts` |
| le pourquoi, en détail | `ARCHITECTURE.md` §231 |
| la migration | `drizzle/0073_tva_par_ligne.sql` |
