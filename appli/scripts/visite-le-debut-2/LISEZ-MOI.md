# Refaire et revérifier la seconde proposition du début de la visite

`appli/visite-guidee-le-debut-2.html` reprend, tels quels, les quatre premiers
écrans figés de `appli/visite-guidee.html` (l'accueil, Vos clients, la fiche de
Costa, ses factures) et pose dessus le guide de ce dossier. Aucun serveur,
aucune base : rien ici ne demande son « oui ».

```bash
node appli/scripts/visite-le-debut-2/composer.mjs     # réécrit la planche
node appli/scripts/visite-le-debut-2/parcourir.mjs    # la parcourt au doigt, dix cas
```

| | ce qu'il fait |
|---|---|
| `guide.css`, `guide.html`, `guide.js` | le guide : la bulle, l'anneau, la main, le surligneur, l'ouverture et la fin. **C'est ici qu'on le retouche**, puis on recompose |
| `composer.mjs` | prend les feuilles de l'appli et les quatre écrans dans la visite, y ajoute le guide |
| `parcourir.mjs` | touche chaque geste à 320, 360, 390 et 414 points de large, sur tablette, sur ordinateur (1024 et 1280), animations réduites, sans fondu, et sans aucun clic hors des boutons (comme Safari sur un iPhone) |

**Une étape** (`ETAPES`, dans `guide.js`) porte `cible` (ce qu'on touche,
l'anneau), `regard` (ce qu'on lit sans le toucher, surligné), `avec` (ce qui
doit tenir à l'écran en plus) et `memePage` (un onglet ne remonte pas la page).

**Les pièges payés en la faisant**, tous tenus par `parcourir.mjs` :

- les écrans figés ne répondent plus eux-mêmes (`pointer-events: none`) : tout
  appui arrive sur la page et se lit par ses coordonnées. Il se lit **au doigt**
  (`pointerdown` puis `pointerup`), jamais au clic : Safari n'envoie aucun clic
  pour un appui hors d'un lien ou d'un bouton ;
- deux appuis rapides sautaient une étape quand la cible suivante tombait sous
  le même doigt (`verrou`) ;
- à 1024 points de large, la bulle rangée à gauche mord encore sur la colonne
  de l'appli : `zone()` décide par la géométrie, pas par la largeur de l'écran ;
- sur une tablette debout, la barre du bas est une bande étroite au milieu : la
  bulle la couvrait tant qu'on la reconnaissait à sa largeur (`mesurerBarre`) ;
- le trait d'or sous l'onglet ouvert a été figé à 390 points de large : il se
  replace par la règle de l'appli (`recalerLesOnglets`).

**Safari sur un iPhone n'a pas pu être joué ici** (ce poste n'a que Chromium).
