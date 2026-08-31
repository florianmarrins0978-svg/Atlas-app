# « L'appli est lente » — 31 août 2026, au soir

## Ce qui se passait

Tu as rallumé ton espace, et pendant les minutes qui ont suivi, **rien ne
s'ouvrait**. C'est ce que disait le bandeau en haut de ton écran : « Version
rapide en construction ».

Voilà pourquoi. Quand du code neuf arrive, ton espace doit refabriquer la
version rapide de l'application — deux à cinq minutes. Pendant ce temps-là, il
te servait une version d'atelier qui **fabrique chaque écran au moment où tu
l'ouvres** : trente secondes à une minute et demie par écran, alors que GitHub
coupe la connexion au bout d'une minute. Autrement dit : pendant toute la
fabrication, tu ne pouvais ouvrir que les écrans que tu avais déjà ouverts.

**Et ça recommençait à chaque fois.** Il y a plusieurs sessions qui travaillent
sur l'application en même temps ; à chaque redémarrage tu récupérais du code
neuf, donc il refabriquait, donc tu repassais en lent. Ce n'était pas un mauvais
moment à passer : c'était devenu ton état normal.

C'est la huitième fois que tu le signales — les 14, 16, 17, 20, 25 et 29 août,
puis deux fois le 31.

## Ce qui a été corrigé

**Ta version rapide n'est plus jetée.** Elle continue de te servir pendant que
la nouvelle se fabrique à côté, et l'échange se fait tout seul à la fin.

| | avant | maintenant |
|---|---|---|
| pendant la fabrication | rien ne s'ouvre | tout s'ouvre, instantanément |
| si la fabrication échoue | lent jusqu'au lendemain | ta version rapide reste, jusqu'à la tentative suivante |
| ce que tu vois | le code neuf, inatteignable | le code **d'avant**, et c'est écrit à l'écran |

## Le seul défaut, et il est dit à l'écran

Pendant la fabrication, **tu essaies le code d'avant**. C'est important, parce
que c'est exactement le malentendu qui nous a coûté deux heures le 12 août : tu
essayais une correction sur une version qui ne la portait pas encore.

Donc le bandeau te le dit maintenant, en toutes lettres :

> Version rapide en construction — **vous voyez celle d'avant.**

Quand le bandeau disparaît, tu es sur le code du jour.

## Au passage : la fiche de ton espace te mentait

La fiche que ton espace publie disait ce soir, à deux lignes d'écart :

```
Code SERVI : aucune version bâtie
✅ Tout concorde : le code récupéré est le code servi, et il est à jour.
     […] ce n'est pas votre espace — c'est le produit.
```

La seconde phrase est fausse, et elle envoyait chercher le problème dans
l'application alors que la cause était écrite juste au-dessus. Corrigé : cet
état a maintenant son propre verdict, qui nomme la lenteur et dit combien de
temps elle dure.

Et son conseil a changé avec : elle disait « arrêtez puis rouvrez votre espace ».
Maintenant qu'une fabrication en cours ne t'empêche plus de travailler, la
rallumer **jetterait** cette fabrication. Elle dit donc l'inverse : attends,
ça bascule tout seul.

## Ce que tu as à faire

**Rien.** Le prochain démarrage de ton espace prend le correctif.

La première fois, il fabriquera encore une version rapide comme avant — il n'y
en a pas encore une à garder. **À partir de la suivante, tu ne devrais plus
jamais retomber en mode lent.**

## Ce qui a été vérifié, et comment

Pas relu : **joué**. Une vraie version rapide fabriquée, son repère forcé sur un
code périmé, puis le démarrage lancé pour de bon — deux fois.

| | |
|---|---|
| l'application répond | **2 secondes** après le démarrage |
| l'écran de connexion, **pendant** la fabrication | **0,28 seconde** (avant : rien) |
| le bandeau | annonce bien « celle d'avant » |
| à la fin | échange fait, repère à jour, dossiers de travail nettoyés |

## La batterie, chiffres exacts

| | |
|---|---|
| types, lint, mémoire du dépôt | ✅ |
| suites base de données | **299 / 299** |
| suites navigateur | **122 / 122** |
| connexion derrière un proxy | ✅ |

**Trois rouges rencontrés en chemin, tous corrigés, et il faut les dire.** Aucun
n'était un défaut de l'application : c'étaient des contrôles qui visaient la
forme d'hier. L'un comptait les détachements de processus du fichier et en
exigeait exactement deux ; un autre cherchait une ligne de code mot pour mot.
Le troisième, lui, avait raison — un fichier refaisait de son côté la décision
« est-ce le banc d'essai », ce que le dépôt interdit depuis M12 : c'est le code
qui a été corrigé, pas le contrôle.

**Et une difficulté qui n'est pas de ce lot.** Les suites navigateur n'ont pas
tenu d'une traite : le serveur d'essai a été **tué par le noyau à 13,5 Go**,
comme les 27, 29 et 30 août. C'est un défaut connu de la machine des essais,
sans rapport avec ton application ni avec ce correctif — le dépôt a un outil
fait pour ça, qui les joue par groupes avec un serveur neuf à chaque fois. Les
six suites qu'un groupe n'avait pas pu jouer ont été rejouées une par une :
toutes vertes.

## Ce qui a été refusé, et pourquoi

**Ne pas refabriquer quand le code de l'application n'a pas changé.** Un quart
des mises à jour ne touchent que de la documentation — elles déclenchent quand
même une fabrication complète chez toi. C'est mesuré, et c'est vrai.

Écarté quand même. Pour savoir « ce qui ne change rien à l'application », il
faut une liste de dossiers ; se tromper d'un seul, c'est te servir le code
d'hier en croyant te servir celui du jour — précisément la panne qu'on essaie
d'éviter. Et depuis ce soir, une fabrication ne te coûte plus l'usage de
l'application : le gain ne vaut plus le risque. C'est noté pour plus tard.

## Ce qui reste ouvert

Deux choses, et ce sont les mêmes qu'avant :

- **on ne sait toujours pas pourquoi `node_modules/next` disparaît de ton
  espace** (voir le document du 31 août à midi). Le banc répare la conséquence à
  chaque démarrage ;
- **sa mémoire reste juste** — 8 Go, dont la fabrication en demande 2,5. Ce
  correctif enlève au moins une des deux charges qui se les disputaient : quand
  ta version rapide sert déjà, il n'y a plus rien à préchauffer, et la
  fabrication récupère les 900 Mo que le préchauffage lui prenait.

## Où c'est écrit dans le dépôt

- `ARCHITECTURE.md` §225 — le raisonnement, ce qui a été écarté, et les pièges
- `scripts/relais-version-batie.mjs` — la règle de la relève
- `scripts/test-relais-version-batie.ts` — les contrôles, y compris les deux
  façons dont l'échange peut tomber
- `scripts/banc.mjs`, `scripts/diagnostiquer-espace.mjs` — le correctif
