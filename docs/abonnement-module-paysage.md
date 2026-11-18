# Le module Paysage, et Artisan pour une seule personne

*Demande du 18 novembre 2026. Planche posée sur le vrai écran Abonnement,
rien n'est codé.*

Planche : `appli/soignee/abonnement-module-paysage.html`

## Ce qui est décidé (18 novembre 2026)

| | Sa réponse |
|---|---|
| Artisan | **un seul accès**, salariés compris. Aujourd'hui Artisan limite à 1 la personne qui fait les devis, mais laisse inviter autant de salariés qu'on veut |
| Le module | **Paysage**, 6 € HT par mois, 60 € HT à l'année (deux mois offerts, comme les formules). 6 € plutôt que 5,99 € : la grille est en euros ronds, et 5,99 € HT fait 7,19 € TTC |
| Ce qu'il ouvre | les **trois** outils de la page Paysage : plan d'arrosage, diagnostic végétal, fiches de chantier |
| À qui | s'ajoute à **Artisan**. Entreprise et Illimité le comprennent déjà |
| Des salariés déjà invités (pendant l'essai) et il choisit Artisan | **refusé** tant qu'il ne les a pas retirés dans Équipe. C'est ce que dit déjà l'article 14.6 des conditions générales |

**Reste à choisir : A ou B.**

## Ce que la planche montre

| | |
|---|---|
| **A, dans la carte Artisan** | « Ajouter Paysage » et son interrupteur au-dessus des trois lignes qu'il ouvre. Allumé : les trois lignes se cochent, le prix passe à 45 €, le bouton dit « S'abonner à Artisan et Paysage » |
| **B, en haut** | la même rangée sous « au mois ou à l'année ». Avec Entreprise ou Illimité, l'interrupteur s'efface : « Compris dans Entreprise ». La carte Artisan dit « Avec Paysage » |
| **Les deux** | « Vos salariés ont accès au planning » quitte « Dans les trois formules » et se lit barré sur Artisan ; l'accroche d'Artisan commence par « Pour vous seul. » ; à l'année, 540 € barrés, 450 €, « Vous gagnez 90 € » |
| **« Avec 2 salariés »** | Artisan dit « Vous avez 2 salariés. Retirez-les d'abord dans Équipe. », et le bouton s'éteint |

**Mon conseil : A.** Un seul module, qui ne sert qu'à Artisan : l'interrupteur
vit là où se lit ce qui manque. B devient le bon choix le jour où un second
module se vendra aussi avec Entreprise.

## Ce que le code devra faire (niveau 3 : c'est de l'argent)

1. **La règle** (`src/lib/abonnements.ts`) : une liste fermée de modules, son
   prix, ses fonctions ; `fonctionOuverte` lit la formule ET les modules ; la
   ligne des salariés devient réservée ; Artisan compte tous les accès, pas
   seulement ceux qui facturent.
2. **La base** : les modules souscrits, sur la ligne d'abonnement, en
   expand (colonne ajoutée, vide par défaut).
3. **Le paiement** : une seconde ligne dans la page de paiement, et
   l'ajout ou le retrait du module au prorata sur un abonnement qui court ;
   les modules relus au retour et au crochet, comme la formule.
4. **Les deux refus** : inviter un salarié sur Artisan, et passer à Artisan
   avec d'autres comptes.
5. **Les écrans fermés** : « Le plan d'arrosage est dans Entreprise » devra
   proposer aussi le module.
6. **La facture d'abonnement de Cause** : deux lignes au lieu d'une.

## Ce qui a été trouvé en chemin

- **Un écart déjà là, sans rapport avec le module** : passer d'Entreprise à
  Artisan avec trois personnes qui facturent n'est refusé nulle part
  aujourd'hui (le plafond ne se vérifie qu'à l'invitation), alors que
  l'article 14.6 le promet. Le refus du point 4 le fermera.
- **Les conditions générales publiées (version 3) disent le contraire** :
  *« Les comptes salarié ne sont pas comptés et ne donnent lieu à aucun
  supplément, quel que soit leur nombre »*, et le module n'y existe pas. Il
  faudra une **version 4**, que chaque compte acceptera de nouveau. La publier
  est sa décision.
- **`PRODUCT.md` dit encore** que l'arrosage, le diagnostic et les fiches
  « font partie du cœur, pas d'un module optionnel ». À corriger au codage.

## Ce qui reste ouvert

| | Qui |
|---|---|
| A ou B | lui |
| Le plafond d'IA d'Artisan (10 € par mois) avec le module, qui lit des photos. Mon avis : le garder, et regarder la consommation réelle, qu'on n'a pas encore | lui |
| Publier la version 4 des conditions générales | lui |
