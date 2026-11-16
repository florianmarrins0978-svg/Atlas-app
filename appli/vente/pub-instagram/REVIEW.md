# La relecture du film

16 novembre 2026, premier montage.

## Les choix faits

- **L'accroche** : « Artisans, marre de la paperasse ? ». Sa demande, à la
  place de « Vous êtes artisan. Pas secrétaire. », qu'il a jugé discriminant.
- **Un seul chantier traverse l'appli**, celui du site de vente (Mr. Lemaire,
  création d'un massif, 862,20 € TTC, 143,70 € de TVA) : on retrouve le même
  montant sur le devis, la page du client, la facture et Terminés.
- **Le micro est filmé en gros plan.** Il vit au bas de la fiche client, donc
  sous l'habillage d'Instagram : la caméra va le chercher et le monte au milieu
  du cadre.
- **Le montant de la TVA n'est pas redessiné en grand.** Une première version
  l'affichait en or au-dessus du téléphone ; le gros plan sur la carte « Ma TVA
  à déclarer » le montre mieux, et c'est l'écran qui le dit.
- **Deux écrans de chargement de l'appli sont coupés** (après « Envoyer le
  devis », à l'ouverture du planning) : dix images chacun, qui se lisaient
  comme une panne.
- **Pas de doigt, pas d'anneau de clic** : sa consigne du 6 novembre pour le
  site de vente. Le geste se lit à ce qui change sur l'écran.

Les deux scénarios non montés sont dans `STORYLINES.md`.

## Ce qui a été mesuré, ce qui a été regardé

- **Mesuré** : `npx hyperframes check` passe (aucune erreur). Durée 50,7 s,
  1080 × 1920, 30 images par seconde. Les montants relus à l'écran avant de
  filmer (`tournage/tourner.mjs` refuse un devis qui ne fait pas 862,20 €).
- **Regardé** : vingt-deux images du rendu final, et les douze enchaînements
  image par image.
- **Personne n'a rien écouté** : le film est muet.

## Les avertissements gardés exprès

- `film_silent` : aucune musique n'a pu être prise ici (le catalogue demande un
  compte). Elle s'ajoute dans Instagram.
- `outside_safe_zone` pour TikTok et YouTube Shorts : le film est cadré pour
  Instagram (marge de 72 px à gauche, textes entre 270 et 1248 px de haut).
  Pour Instagram, le contrôle signale encore le haut des mots de chapitre : il
  mesure la boîte de la ligne, l'encre commence à 276 px.
- `timeline_track_too_dense`, `nested_media_start_basis_ambiguous` : les temps
  des films sont bien ceux de leur scène.

## Le plan le plus faible, et ce qu'il faudrait

- **Le devis** (16 à 19 s). L'écran du devis sur téléphone range chaque ligne
  sur cinq rangées : on lit une ligne et le total, pas les quatre lignes d'un
  coup. L'aperçu du PDF les montrerait ensemble, mais trop petit à cette
  taille.
- **La page du client propose « Mercredi 18 » avant « Lundi 16 »** : l'appli
  range les deux dates dans l'ordre où l'artisan les a touchées. C'est son
  comportement, pas un défaut du film.
- **Sans clé d'IA**, la ligne du devis ne sort pas de la dictée à l'image : on
  voit le micro, puis le devis. À refaire sur son espace le jour où le
  tournage pourra s'y jouer.
