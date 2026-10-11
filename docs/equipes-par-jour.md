# Les équipes se choisissent jour par jour — ce qui a été fait

*Lot du 15 septembre 2026. Écrit pour être transmis tel quel.*

## Ce que vous avez constaté

Sur un chantier de huit jours : *« si je mets Antoine et Julien le premier jour,
ça les met automatiquement sur les 8 jours, ça c'est bien. Mais si le 4ᵉ jour je
décide de ne pas mettre Julien, ça l'enlève partout et ça faut pas ! Ce sera pas
forcément les mêmes équipes tous les jours. »*

Vous aviez raison : jusqu'ici, une coche valait pour **tout** le chantier. Le
planning ne savait pas dire « Julien, sauf jeudi ».

## Ce qui a été fait

La règle que vous avez confirmée, et rien d'autre :

| Sur la carte d'un jour, vous… | Ce que fait Atlas |
|---|---|
| **ajoutez** quelqu'un | il est mis **ce jour-là et tous les jours suivants** du chantier |
| **retirez** quelqu'un | il est retiré **ce jour-là seulement** |

Concrètement, sur votre chantier de huit jours :

1. Lundi, vous cochez Antoine et Julien → ils sont sur les huit jours, comme avant.
2. Jeudi, vous décochez Julien → **jeudi seulement**. Lundi, mardi, mercredi,
   vendredi et la semaine suivante, Julien est toujours là.
3. Si vous le recochez jeudi, il revient jeudi — et les jours suivants, où il
   était déjà, ne bougent pas.

Chaque écran qui montre **un jour** (la carte du jour, la ligne du planning, la
charge du calendrier, la journée vue depuis la fiche du chantier) montre les
gens **de ce jour-là**.

## Ce que ça ne change pas

- **Vos coches existantes** restent exactement ce qu'elles étaient : « chaque
  jour du chantier ». Rien n'a été retouché dans votre base. Elles ne se
  découpent que le jour où vous retirez quelqu'un sur un jour précis.
- Les **congés** se déduisent toujours tout seuls (la pastille « Julien ven. »
  du 8 septembre). Ajouter quelqu'un n'est refusé que s'il n'est là aucun des
  jours qu'on ajoute.
- Si vous **déplacez** un chantier une autre semaine, ses gens suivent : celui
  qui était « à partir du 4ᵉ jour » est à partir du 4ᵉ jour de la nouvelle
  semaine. Si vous le rendez à « Sans date », personne n'est perdu.
- La fiche PDF du chantier et l'agenda nomment qui vient au moins un jour.

## Ce qui a été vérifié

- La règle seule, sans base : 17 contrôles (ajouter, retirer, recocher sans
  doublon, chantier d'une demi-journée, chantier déplacé, rendu sans date).
- La base : 7 contrôles, dont votre cas mot pour mot (Antoine et Julien le
  lundi, Julien décoché le jeudi → encore là sept jours sur huit), et les
  coches d'avant qui valent toujours chaque jour.
- Votre geste dans un vrai navigateur : la carte du 4ᵉ jour, décocher Julien,
  la base ne perd qu'un jour, le 1ᵉʳ jour l'annonce encore, le 4ᵉ ne l'annonce
  plus, le recocher ne doublonne rien.
- Une batterie complète, pour ce lot et celui de la durée au renvoi (voir le
  message qui accompagne cette livraison pour le détail).

## Pour l'avoir chez vous

Rallumer votre espace : la migration 0093 s'applique toute seule au démarrage.
