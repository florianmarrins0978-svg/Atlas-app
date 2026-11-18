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
| À qui | **les trois formules** (sa correction du même soir : *« ça doit être pour toutes les formules, pas que pour la formule artisan »*). Entreprise et Illimité **ne comprennent donc plus** ces trois outils |
| Des salariés déjà invités (pendant l'essai) et il choisit Artisan | **refusé** tant qu'il ne les a pas retirés dans Équipe. C'est ce que dit déjà l'article 14.6 des conditions générales |

**Lu par moi, à confirmer par lui** : le module coûte **6 € quelle que soit la
formule**. Il n'a donné qu'un prix, et rien ne dit qu'Entreprise paie plus.

## Ce que la planche montre

| | |
|---|---|
| **En haut** | « Ajouter Paysage », +6 € par mois, son interrupteur, et les trois outils dessous : barrés éteint, cochés allumé |
| **Les cartes** | elles ne parlent plus de Paysage. Allumé, chaque prix prend 6 € (Artisan 45 €, Entreprise 65 €, Illimité 165 €), la carte choisie dit « Avec Paysage », le bouton dit « S'abonner à Entreprise et Paysage » |
| **À l'année** | +60 € ; Entreprise avec Paysage : 780 € barrés, 650 €, « Vous gagnez 130 € » |
| **Artisan** | « Vos salariés ont accès au planning » quitte « Dans les trois formules » et se lit barré sur Artisan ; son accroche commence par « Pour vous seul. » |
| **Entreprise** | son accroche disait « Accès illimité à tous les outils » : ce n'est plus vrai. Elle dit « Jusqu'à cinq personnes qui facturent, et tous vos salariés. » |
| **« Avec 2 salariés »** | Artisan dit « Vous avez 2 salariés. Retirez-les d'abord dans Équipe. », et le bouton s'éteint |

**Une seule place, en haut.** La première planche proposait aussi le module
dans la carte Artisan (A) : pour trois formules, il aurait fallu trois
interrupteurs pour la même chose, ou un interrupteur qui change de carte quand
on en touche une autre. En haut, il se règle une fois, et un second module
viendra s'y ranger dessous.

## Ce que le code devra faire (niveau 3 : c'est de l'argent)

1. **La règle** (`src/lib/abonnements.ts`) : une liste fermée de modules, son
   prix, ses fonctions ; `fonctionOuverte` lit la formule ET les modules ; les
   trois outils quittent les `fonctions` d'Entreprise et d'Illimité ; la ligne
   des salariés devient réservée ; Artisan compte tous les accès, pas
   seulement ceux qui facturent.
2. **L'essai** ouvre toujours tout, Paysage compris : *on essaie tout, on
   choisit après* (`FORMULE_DE_LESSAI`).
3. **La base** : les modules souscrits, sur la ligne d'abonnement, en
   expand (colonne ajoutée, vide par défaut).
4. **Le paiement** : une seconde ligne dans la page de paiement, et
   l'ajout ou le retrait du module au prorata sur un abonnement qui court ;
   les modules relus au retour et au crochet, comme la formule.
5. **Les deux refus** : inviter un salarié sur Artisan, et passer à Artisan
   avec d'autres comptes.
6. **Les écrans fermés** : « Le plan d'arrosage est dans Entreprise » devient
   « dans le module Paysage », pour les trois formules.
7. **La facture d'abonnement de Cause** : une ligne de plus pour le module.

## Ce qui a été trouvé en chemin

- **Un écart déjà là, sans rapport avec le module** : passer d'Entreprise à
  Artisan avec trois personnes qui facturent n'est refusé nulle part
  aujourd'hui (le plafond ne se vérifie qu'à l'invitation), alors que
  l'article 14.6 le promet. Le refus du point 5 le fermera.
- **Les conditions générales publiées (version 3) disent le contraire** :
  *« Les comptes salarié ne sont pas comptés et ne donnent lieu à aucun
  supplément, quel que soit leur nombre »* ; Entreprise et Illimité y
  « comprennent les outils de paysage » ; le module n'existe pas. Il faudra une
  **version 4**, que chaque compte acceptera de nouveau. La publier est sa
  décision.
- **`PRODUCT.md` dit encore** que l'arrosage, le diagnostic et les fiches
  « font partie du cœur, pas d'un module optionnel ». À corriger au codage.
- **Aucun abonné réel** : personne ne perd Paysage en cours d'abonnement.

## Ce qui reste ouvert

| | Qui |
|---|---|
| Le même prix (6 €) pour les trois formules | lui |
| Les plafonds d'IA (Artisan 10 €, Entreprise 20 €, Illimité 60 € par mois) avec le module, qui lit des photos. Mon avis : les garder, et regarder la consommation réelle, qu'on n'a pas encore | lui |
| Publier la version 4 des conditions générales | lui |
