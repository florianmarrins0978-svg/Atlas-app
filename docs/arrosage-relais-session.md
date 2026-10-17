# Arrosage : le relais de la session du 16 et 17 octobre 2026

À lire en entier avant toute chose par la session qui reprend. Tout ce qui suit
est dans le dépôt ; rien ne repose sur la conversation.

## Où est le travail

| | |
|---|---|
| dossier | `C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus` (un worktree à part) |
| branche | `lot/catalogue-aquaplus-corrections`, **locale, jamais poussée** |
| base | `origin/main` à `5e850cc1` |
| aussi dedans | les trois branches de l'autre session, fusionnées en local avec son accord : `claude/tubes-arrosage-v2`, `claude/tuyeres-et-planche`, `claude/legende-bridee` |
| batterie | **aucune jouée**, à sa demande : *« une seule batterie pour toutes les corrections, à la fin »*. Le lot est de niveau 3 (`npm run niveau`) |
| `main` | **rien n'y part sans son accord** |

Le PDF du fournisseur : `C:/Users/Flori/Desktop/Catalogue-Aquaplus-2026.pdf`.
Son texte page par page s'extrait avec `pdfjs-dist` (déjà dans `node_modules`) ;
le rendu en image n'est pas disponible sur ce PC.

## Ce qui est fait (un commit chacun, `git log origin/main..HEAD`)

1. **Catalogue confronté à Aqua Plus** (`docs/arrosage-catalogue-aquaplus.md`) :
   5000 Plus 6,0 Portée+ à 1,36 m³/h ; les 43 buses de turbine livrées avec
   l'arroseur sans référence ni colisage inventés ; pages des relevés justes ;
   la 8-VAN confirmée par la fiche Rain Bird.
2. **Toutes les lignes provisoires retirées** (sauf son « Régulateur de
   pression FF 3/4" ») ; le plan dit ce qui manque (`manquants`).
3. **Son tube de goutte-à-goutte** : Toro UGGCBL23050, 2 l/h tous les 33 cm,
   par 50 (p. 48). Durée calculée sur l'écart des lignes ; une haie n'a pas
   d'écart, sa durée n'est pas calculée et le plan le dit. Défaut corrigé en
   chemin : un massif de 2,40 m perdait une ligne (virgule flottante).
4. **Au compteur sans mesure : 3 bar et 2 m³/h**, et la phrase en rouge
   `GARANTIE_ABSENTE` (« Nous ne garantissons pas la bonne levée des
   arroseurs. ») partout où le seau ET le kit buse 5 ne sont pas tous les deux
   saisis. La ville ne garantit que 0,3 bar et aucun débit (R1321-58).
5. **Bridage selon la vis Aqua Plus** : 5000 Plus et Mini 8 25 %, 3504 35 %,
   les autres turbines 0, les tuyères jamais. Son 40 % supprimé.
6. **Chaque tête doit tenir la pression mini de SA fiche** (`seLeve`, plages
   d'Aqua Plus sur les corps, fiche Rain Bird pour les VAN). Avant, une
   5000 Plus se posait à 0,82 bar pour 1,7.
7. **Plus de plafond de vitesse** (1,53 m³/h en Ø25) : la pression au dernier
   arroseur décide seule, et le calcul ajoute une vanne quand elle ne tient pas.
   378 jardins d'essai : 155 plans changent, alertes 50 → 0.
8. **Les 4, 6 et 8-VAN à 330°**, réservées aux coins et aux bords (`faitLeTour`).
9. **709 pièces Aqua Plus** dans `CATALOGUE.piecesAjoutables`, pour la touche
   « ajouter une pièce » : désignation mot pour mot, page, aucun prix.
10. **Plus de tiret long** dans la liste des pièces (virgule).
11. **La perte de l'électrovanne** lue sur la fiche Rain Bird de la 100-DV
    (Valves, p. 89), au débit de la vanne, au lieu du forfait de 0,25 bar.
12. **La planche de l'écran** `appli/arrosage-demandes-16-octobre.html`, qui
    embarque le vrai calcul (`appli/arrosage-planche-calcul.js`, esbuild) et
    recalcule à chaque saisie. Lien privé envoyé :
    https://claude.ai/artifact/Aw7JKKNFKZ7ggG9MERVWcj

Ses règles changées sont **barrées puis réécrites** dans
`scripts/test-regles-du-patron.ts` (27 tenues). Contrôles verts à la fin :
calcul, règles, catalogue, consignes, tracé, plan dessiné, mesure, mode
d'emploi, tirets, flèches, pansements, code mort, couches, types, les deux
essais de la page publiée (78/78, 107/107) et les quatre maquettes d'arrosage.

## Ce qu'il doit encore trancher

1. **La planche** : la garde-t-il telle quelle ? Rien ne touche `src/app` avant.
2. **Les 141 buses relevées** (`docs/arrosage-releve-aquaplus/buses-a-trancher.json`,
   pas encore au catalogue) :
   - les lettres d'angle Q, T, H, TT, TQ, F (non écrites au catalogue) ;
   - MP Rotator et série 300 : débit proportionnel au secteur, donc tuyère pour
     le débit ?
   - six chiffres douteux : MPR+ 12T 0,60 ; PRECISION 15Q 0,089 et 8F 0,124 ;
     PSU 17A à 90° 0,41 ; Maxi-Paw 06 à 11,4 m ; Mini 8 buse 2,5 à 0,56.
3. **Combien de turbines au plus par réseau ?** Il trouve 8 ou 9 3504 « trop »,
   le calcul les pose parce qu'elles se lèvent (2,11 bar pour 1,7). Question
   posée, sans réponse : ne pas inventer de plafond.
4. **La largeur qu'arrose une ligne de haie**, pour calculer sa durée.
5. **La vue éclatée** (sa demande du 17 octobre 2026) :
   `appli/arrosage-vue-eclatee.html`, lien privé
   https://claude.ai/artifact/LXfjCHKAbZUm78ncXpVqjn. Chaque pièce en photo,
   écartée, par zone (amenée, regard, réseau par réseau, tête par tête) ;
   retirer et ajouter refont la liste, comparée au calcul. Attend : son avis,
   **ses photos** des pièces (seules les cinq Palaplast existent), et **l'ordre
   de montage de la nourrice** (la fiche ne donne que les pièces). Codée pour de
   vrai, la place de chaque té et coude doit sortir du calcul, pas de l'écran.

## Ce qui reste à faire, dans cet ordre

1. **Le goutte-à-goutte dans le calcul**, ses règles du 16 octobre (`TODO.md`) :
   une sortie par 100 m au plus (ligne ou boucle), un té égal par nouvelle
   sortie sur le Ø25 ou Ø32, à la sortie un coude taraudé 25×3/4" puis, vissé
   dessus, le té Palaplast MID6321 (boucle) ou le coude MID6341 / le droit
   MID6301 avec un bouchon MID6371 au bout (une seule ligne), jamais de filtre,
   la commande en couronnes de 50 ou 100 m. La question « une ligne ou deux »
   se pose par zone (écran).

   **Codé le 17 octobre 2026** (`sortiesGoutte`, `calcul.js`, les deux copies) :
   sorties = max(⌈mètres ÷ 100⌉, vannes de la zone) ; par vanne un coude
   taraudé par sortie, un té égal de moins ; sur le coude, selon
   `z.sortieGoutte` : `'boucle'` MID6321, `'deux-bouts'` MID6321 et deux
   MID6371, `'ligne'` un MID6371 et le coude MID6341. Sans réponse, rien n'est compté et le
   plan pose la question. **Trois questions lui sont posées** : le raccord d'une
   ligne seule (MID6341, MID6352 ou MID6301) ; une référence en 100 m
   (Aqua Plus ne vend l'UGGCBL23050 que par 50, la ligne du tube reste en
   mètres) ; la fiche Toro du tube (pression mini, diamètre intérieur), sans
   laquelle la pression au bout d'une ligne n'est pas vérifiée et le plan le
   dit.
2. **Les lignes de réseau en Ø32** : aujourd'hui toutes en Ø25 dans le calcul.
   Sa règle : Ø32 quand le Ø25 ne tient pas la pression, puis une vanne de plus ;
   le choix 25/32 à la fin ; raccords en 32 (OPL71403220, OPL71503220,
   OPL704032, té réduit OPL73403225) relevés dans `piecesAjoutables`.
3. **L'écran**, une fois la planche choisie : les deux mesures aussi au
   compteur, la ligne ou la boucle, le choix 25/32, la case sonde (le calcul
   sait déjà la compter), ajouter et retirer une pièce. La fiche
   « arrosage-mesure-robinet » du mode d'emploi suit.
4. **Les 141 buses**, une fois ses réponses données (le calcul doit apprendre
   une buse par angle : Q au coin, H au bord, F au milieu).
5. **La batterie unique** (`npm run verifier:avant-livraison`, le prévenir
   avant), puis le document final `docs/arrosage-catalogue-aquaplus.md` mis à
   jour, puis la poussée sur `main` **avec son accord**.

## Ce qu'il ne faut pas faire

- Inventer un chiffre, une référence, un prix. Une valeur absente reste absente.
- Recopier un prix du PDF (ce sont des prix clients).
- Réécrire une règle de `test-regles-du-patron.ts` : on barre, on ajoute sous
  le repère, avec sa phrase et sa date.
- Lancer une batterie ou pousser sans lui demander.
- Tuer un processus par son nom : `Stop-Process -Id <pid>` seulement.
