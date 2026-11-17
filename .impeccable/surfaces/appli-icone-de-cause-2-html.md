---
version: 1
slug: "appli-icone-de-cause-2-html"
primary_target: "appli/icone-de-cause-2.html"
related_targets: []
---

# Surface : planche « L'icône de Cause, sur le bureau du téléphone » (appli/icone-de-cause-2.html)

Mode : Operate. Une planche de décision, lue sur son téléphone : il compare sept icônes et en retient une. Aucun code dans `src/`. Posée À CÔTÉ de `appli/icone-de-cause.html` (trois « C », A, B et C, d'une autre session) : le matin du 17 novembre 2026 il demandait si un autre modèle ferait mieux pour l'icône, puis a redemandé la planche ici. Les deux se comparent sur celle-ci ; l'autre ne se touche pas.

Ce qui ne bouge pas : les lettres. A, B et C désignent pour toujours les dessins de la première planche, D à G ceux-ci. Une lettre qu'il écrit dans la conversation doit vouloir dire la même chose sur les deux pages.

## Direction contract

THESIS : une icône se juge là où elle vivra. La planche EST un bureau de téléphone à taille réelle, parmi des applis aux vraies couleurs ; elle refuse le téléphone dessiné en petit et les tuiles beiges sur lesquelles tout se repère.
OWN-WORLD : celui de l'appli, inchangé (crème, encre, vert pin, or, serif des titres, capsules). La seule matière ajoutée est le bureau lui-même : fond d'écran, voisines génériques, quai.
STORY : il voit l'icône chez lui, change de lettre sous le pouce, l'éprouve (sombre, Android, plein soleil, les sept ensemble, mélangées), la touche pour ouvrir l'appli, puis dit sa lettre.
FIRST VIEWPORT : à 390 × 664, le titre sur une ligne, le bureau entier de la barre d'état au quai (icônes de 60 px, quatre rangées), et la barre fixe des sept vignettes en bas.
FORM : seed: none (pinned) « une planche pour l'icône de l'application quand il sera sur le bureau des téléphones des clients ». Interaction signature : toucher l'icône ouvre l'appli depuis sa place, « Revenir au bureau » la referme sur elle. Voie code-led, aucune image générée.
FINISH : unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Ce qui reste ouvert

- Son choix de lettre. Rien ne s'installe avant.
- Safari n'a pas été regardé : ce poste n'a que Chromium.
- L'icône d'Android est montrée comme `npm run icones` la fabrique aujourd'hui (motif réduit) ; `scripts/generer-icones.mjs` étend le fond en crème écrit en dur, à corriger pour une icône au fond coloré (`TODO.md`).
